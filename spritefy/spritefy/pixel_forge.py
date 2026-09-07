"""Pixel Forge: Post-processing pipeline for authentic Ultima VII pixel art.

Implements downsampling, edge outline enforcement, despeckling, and 1-bit alpha
masking prior to palette quantization.
"""
from typing import Tuple, Optional
import numpy as np
from PIL import Image, ImageFilter
from spritefy.palette import quantize_image, nearest_color_idx, U7_PALETTE

DARK_OUTLINE_RGB = (0, 0, 0)
DARK_OUTLINE_ALPHA = 255

def add_dark_outline(
    image: Image.Image,
    outline_color: Tuple[int, int, int] = DARK_OUTLINE_RGB,
    connectivity: int = 4
) -> Image.Image:
    """
    Enforces a 1-pixel dark contour outline around opaque regions,
    characteristic of Ultima VII sprite artwork.
    """
    if image.mode != 'RGBA':
        image = image.convert('RGBA')
        
    arr = np.array(image)
    alpha = arr[:, :, 3]
    opaque = alpha >= 128
    
    H, W = opaque.shape
    outline_mask = np.zeros((H, W), dtype=bool)
    
    # 4-connectivity shifts (up, down, left, right)
    shifts = [(-1, 0), (1, 0), (0, -1), (0, 1)]
    if connectivity == 8:
        shifts += [(-1, -1), (-1, 1), (1, -1), (1, 1)]
        
    for dy, dx in shifts:
        rolled = np.roll(np.roll(opaque, dy, axis=0), dx, axis=1)
        # Handle wrap-around borders
        if dy == -1: rolled[-1, :] = False
        elif dy == 1: rolled[0, :] = False
        if dx == -1: rolled[:, -1] = False
        elif dx == 1: rolled[:, 0] = False
        outline_mask |= rolled
        
    outline_mask &= ~opaque
    
    out_arr = arr.copy()
    out_arr[outline_mask, :3] = outline_color
    out_arr[outline_mask, 3] = DARK_OUTLINE_ALPHA
    return Image.fromarray(out_arr, mode='RGBA')

def despeckle(image: Image.Image) -> Image.Image:
    """
    Removes orphaned single pixels that differ from all 8 adjacent neighbors.
    Improves pixel cluster coherence.
    """
    if image.mode != 'RGBA':
        image = image.convert('RGBA')
        
    arr = np.array(image)
    alpha = arr[:, :, 3]
    rgb = arr[:, :, :3]
    H, W = alpha.shape
    
    opaque = alpha >= 128
    out_arr = arr.copy()
    
    for y in range(1, H - 1):
        for x in range(1, W - 1):
            if not opaque[y, x]:
                continue
            neighbors_alpha = opaque[y-1:y+2, x-1:x+2]
            # Count opaque neighbors excluding self
            if np.sum(neighbors_alpha) - 1 <= 1:
                # Isolated pixel -> erase
                out_arr[y, x, 3] = 0
                continue
                
    return Image.fromarray(out_arr, mode='RGBA')

def forge_pixel_sprite(
    image: Image.Image,
    target_size: Tuple[int, int],
    add_outline: bool = True,
    dither: bool = False,
    dither_strength: float = 0.2,
    enhance_contrast: bool = True,
    alpha_threshold: int = 128
) -> Image.Image:
    """
    Transform an image into an authentic Ultima VII pixel sprite.
    
    1. Pre-crops/fits image into target_size preserving aspect ratio.
    2. Optional contrast accentuation for retro shading.
    3. Sharp downsample to integer grid.
    4. Despeckles stray pixels.
    5. Applies 1-pixel dark contour.
    6. Strict 256-color CIELAB palette quantization.
    """
    if image.mode != 'RGBA':
        rgba = image.convert('RGBA')
    else:
        rgba = image.copy()
        
    # Clean transparent background threshold and trim fringe bleed
    arr = np.array(rgba)
    alpha = arr[:, :, 3] >= alpha_threshold
    if np.any(alpha):
        rgb_raw = arr[:, :, :3]
        lum_raw = 0.299 * rgb_raw[:, :, 0] + 0.587 * rgb_raw[:, :, 1] + 0.114 * rgb_raw[:, :, 2]
        if np.median(lum_raw[alpha]) < 80:
            # Dark garment: boundary pixels with high luminance are background bleed
            eroded = np.array(Image.fromarray((alpha.astype(np.uint8) * 255)).filter(ImageFilter.MinFilter(3))) > 0
            bleed = alpha & (~eroded) & (lum_raw > 110)
            arr[bleed, 3] = 0
            if np.sum(bleed) > 50:
                alpha2 = arr[:, :, 3] >= alpha_threshold
                eroded2 = np.array(Image.fromarray((alpha2.astype(np.uint8) * 255)).filter(ImageFilter.MinFilter(3))) > 0
                bleed2 = alpha2 & (~eroded2) & (lum_raw > 130)
                arr[bleed2, 3] = 0
    arr[:, :, 3] = np.where(arr[:, :, 3] >= alpha_threshold, 255, 0).astype(np.uint8)
    rgba = Image.fromarray(arr, mode='RGBA')
    
    # Extract bounding box of non-transparent content
    bbox = rgba.getbbox()
    if bbox:
        cropped = rgba.crop(bbox)
    else:
        cropped = rgba
        
    # Calculate scale to fit inside target_size with padding
    tgt_w, tgt_h = target_size
    pad_w = 2 if add_outline else 0
    pad_h = 2 if add_outline else 0
    avail_w = max(1, tgt_w - (pad_w * 2))
    avail_h = max(1, tgt_h - (pad_h * 2))
    
    cw, ch = cropped.size
    ratio = min(avail_w / cw, avail_h / ch)
    new_w = max(1, int(round(cw * ratio)))
    new_h = max(1, int(round(ch * ratio)))
    
    # Downscale using high-quality resampling first, then nearest
    scaled = cropped.resize((new_w, new_h), Image.Resampling.LANCZOS)
    
    # Enhance contrast if requested (gives distinct retro shadow/mid/highlight steps)
    if enhance_contrast:
        s_arr = np.array(scaled, dtype=np.float32)
        s_alpha = s_arr[:, :, 3] >= alpha_threshold
        rgb_norm = s_arr[:, :, :3] / 255.0
        
        # Check median luminance of opaque pixels
        if np.any(s_alpha):
            lum = 0.299 * rgb_norm[s_alpha, 0] + 0.587 * rgb_norm[s_alpha, 1] + 0.114 * rgb_norm[s_alpha, 2]
            med_lum = np.median(lum)
            
            # If garment is predominantly dark (black shoes, charcoal, dark navy),
            # expand dynamic range so details/textures don't collapse into crushed black.
            if med_lum < 0.28:
                dark_lum = lum[lum < 0.55]
                p10 = float(np.percentile(dark_lum, 5)) if len(dark_lum) else 0.05
                p90 = float(np.percentile(dark_lum, 95)) if len(dark_lum) else 0.25
                scale_factor = (0.48 - 0.10) / max(p90 - p10, 0.05)
                mask_dark = s_alpha & ((0.299 * rgb_norm[:, :, 0] + 0.587 * rgb_norm[:, :, 1] + 0.114 * rgb_norm[:, :, 2]) < 0.55)
                rgb_norm[mask_dark] = np.clip((rgb_norm[mask_dark] - p10) * scale_factor + 0.10, 0.0, 1.0)
                gamma = 1.05
            else:
                gamma = 1.25
        else:
            gamma = 1.25

        rgb_cont = np.where(
            rgb_norm < 0.5,
            0.5 * np.power(np.maximum(0.0, 2.0 * rgb_norm), gamma),
            1.0 - 0.5 * np.power(np.maximum(0.0, 2.0 * (1.0 - rgb_norm)), gamma)
        )
        s_arr[:, :, :3] = np.clip(rgb_cont * 255.0, 0, 255)
        scaled = Image.fromarray(s_arr.astype(np.uint8), mode='RGBA')
        
    # Paste centered into target_size canvas
    canvas = Image.new('RGBA', target_size, (0, 0, 0, 0))
    paste_x = (tgt_w - new_w) // 2
    paste_y = (tgt_h - new_h) // 2
    canvas.paste(scaled, (paste_x, paste_y), scaled)
    
    # Clean binary alpha
    c_arr = np.array(canvas)
    c_arr[:, :, 3] = np.where(c_arr[:, :, 3] >= alpha_threshold, 255, 0).astype(np.uint8)
    canvas = Image.fromarray(c_arr, mode='RGBA')
    
    # Clean stray noise
    canvas = despeckle(canvas)
    
    # Enforce dark outline if requested
    if add_outline:
        canvas = add_dark_outline(canvas, outline_color=DARK_OUTLINE_RGB, connectivity=4)
        
    # Quantize to Ultima VII 256-color palette
    quantized = quantize_image(
        canvas,
        dither=dither,
        dither_strength=dither_strength,
        alpha_threshold=alpha_threshold
    )
    return quantized
