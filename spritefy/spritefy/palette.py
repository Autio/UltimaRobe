"""Original retro 256-color VGA Palette and Quantization Engine."""
from typing import List, Tuple, Dict, Optional
import numpy as np
from PIL import Image

# 256 RGB colors generated mathematically; no game palette data is distributed
U7_PALETTE: List[Tuple[int, int, int]] = [(r,g,b) for r in range(0,256,51) for g in range(0,256,51) for b in range(0,256,51)] + [(round(i*255/39),)*3 for i in range(40)]

# Linearized RGB to CIELAB conversion helpers
def _rgb_to_xyz(rgb: np.ndarray) -> np.ndarray:
    mask = rgb > 0.04045
    rgb_lin = np.where(mask, ((rgb + 0.055) / 1.055) ** 2.4, rgb / 12.92)
    m = np.array([
        [0.4124564, 0.3575761, 0.1804375],
        [0.2126729, 0.7151522, 0.0721750],
        [0.0193339, 0.1191920, 0.9503041]
    ])
    return rgb_lin @ m.T

def _xyz_to_lab(xyz: np.ndarray) -> np.ndarray:
    white = np.array([0.95047, 1.00000, 1.08883])
    norm = xyz / white
    delta = 6.0 / 29.0
    mask = norm > delta ** 3
    f = np.where(mask, norm ** (1.0 / 3.0), (norm / (3 * delta ** 2)) + (4.0 / 29.0))
    L = 116.0 * f[..., 1] - 16.0
    a = 500.0 * (f[..., 0] - f[..., 1])
    b = 200.0 * (f[..., 1] - f[..., 2])
    return np.stack([L, a, b], axis=-1)

def rgb_to_lab(rgb: np.ndarray) -> np.ndarray:
    """Convert uint8 or [0, 1] RGB array to CIELAB."""
    if rgb.dtype == np.uint8:
        rgb_float = rgb.astype(np.float32) / 255.0
    else:
        rgb_float = np.clip(rgb.astype(np.float32), 0.0, 1.0)
    xyz = _rgb_to_xyz(rgb_float)
    return _xyz_to_lab(xyz)

# Precompute LAB representation of all 256 colors
_PALETTE_ARR = np.array(U7_PALETTE, dtype=np.uint8)
_PALETTE_LAB = rgb_to_lab(_PALETTE_ARR)

def nearest_color_idx(rgb: Tuple[int, int, int]) -> int:
    """Find the closest retro palette index for a single RGB color using CIELAB ΔE."""
    arr = np.array([[rgb]], dtype=np.uint8)
    lab = rgb_to_lab(arr)[0, 0]
    diff = _PALETTE_LAB - lab
    dist_sq = np.sum(diff ** 2, axis=-1)
    return int(np.argmin(dist_sq))

def quantize_array(rgb_arr: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
    """
    Quantize an (H, W, 3) uint8 image array to U7 palette.
    Returns:
        (indices (H, W) uint8, quantized_rgb (H, W, 3) uint8)
    """
    H, W, _ = rgb_arr.shape
    pixels_lab = rgb_to_lab(rgb_arr.reshape(-1, 3))
    
    chunk_size = 8192
    num_pixels = H * W
    indices = np.zeros(num_pixels, dtype=np.int32)
    
    for start in range(0, num_pixels, chunk_size):
        end = min(start + chunk_size, num_pixels)
        chunk = pixels_lab[start:end, np.newaxis, :]
        diff = chunk - _PALETTE_LAB[np.newaxis, :, :]
        dists = np.sum(diff ** 2, axis=-1)
        indices[start:end] = np.argmin(dists, axis=-1)
        
    idx_2d = indices.reshape(H, W).astype(np.uint8)
    rgb_quant = _PALETTE_ARR[idx_2d]
    return idx_2d, rgb_quant

# Bayer matrix 4x4 for ordered dithering
BAYER_4X4 = (np.array([
    [ 0,  8,  2, 10],
    [12,  4, 14,  6],
    [ 3, 11,  1,  9],
    [15,  7, 13,  5]
], dtype=np.float32) / 16.0) - 0.5

def quantize_image(
    image: Image.Image,
    dither: bool = False,
    dither_strength: float = 0.25,
    alpha_threshold: int = 128
) -> Image.Image:
    """
    Quantize PIL Image to original retro 256-color palette.
    Preserves 1-bit alpha transparency.
    """
    if image.mode != 'RGBA':
        rgba = image.convert('RGBA')
    else:
        rgba = image.copy()
        
    arr = np.array(rgba)
    rgb = arr[:, :, :3]
    alpha = arr[:, :, 3]
    
    if dither and dither_strength > 0:
        H, W, _ = rgb.shape
        tiled_bayer = np.tile(BAYER_4X4, (int(np.ceil(H / 4)), int(np.ceil(W / 4))))[:H, :W]
        noise = (tiled_bayer[:, :, np.newaxis] * (dither_strength * 64.0))
        dithered_rgb = np.clip(rgb.astype(np.float32) + noise, 0, 255).astype(np.uint8)
        _, quant_rgb = quantize_array(dithered_rgb)
    else:
        _, quant_rgb = quantize_array(rgb)
        
    out_arr = np.zeros_like(arr)
    out_arr[:, :, :3] = quant_rgb
    out_arr[:, :, 3] = np.where(alpha >= alpha_threshold, 255, 0).astype(np.uint8)
    return Image.fromarray(out_arr, mode='RGBA')

