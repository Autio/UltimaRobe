"""Garment Segmenter: Background removal and subject isolation.

Uses rembg (using CPU inference) or OpenCV GrabCut / alpha thresholding fallback.
"""
from typing import Tuple, Optional
import numpy as np
from PIL import Image
import importlib.util
_REMBG_SESSION = None

def segment_garment_rembg(image: Image.Image) -> Optional[Image.Image]:
    """Segment garment using rembg library if available."""
    try:
        if importlib.util.find_spec('onnxruntime') is None: return None
        import rembg
        global _REMBG_SESSION
        if _REMBG_SESSION is None:
            _REMBG_SESSION = rembg.new_session('u2net', providers=['CPUExecutionProvider'])
        # If on GPU, rembg uses ONNX Runtime with CUDAExecutionProvider
        output = rembg.remove(image, session=_REMBG_SESSION)
        return output
    except (Exception, SystemExit) as e:
        return None

def segment_garment_opencv(image: Image.Image) -> Image.Image:
    """
    Fallback garment segmentation using OpenCV GrabCut.
    Assumes garment is roughly centered within the image frame.
    """
    import cv2
    
    if image.mode != 'RGB':
        rgb_img = image.convert('RGB')
    else:
        rgb_img = image.copy()
        
    np_img = np.array(rgb_img)
    H, W, _ = np_img.shape
    
    # Define margin rectangle (assuming object is within central 90% of frame)
    margin_x = max(2, int(W * 0.05))
    margin_y = max(2, int(H * 0.05))
    rect = (margin_x, margin_y, W - (2 * margin_x), H - (2 * margin_y))
    
    mask = np.zeros((H, W), np.uint8)
    bgd_model = np.zeros((1, 65), np.float64)
    fgd_model = np.zeros((1, 65), np.float64)
    
    try:
        cv2.grabCut(
            np_img,
            mask,
            rect,
            bgd_model,
            fgd_model,
            iterCount=3,
            mode=cv2.GC_INIT_WITH_RECT
        )
        # Probable foreground or definite foreground
        fg_mask = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
        
        # Smooth mask slightly
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_OPEN, kernel)
        
        rgba = np.dstack([np_img, fg_mask])
        return Image.fromarray(rgba, 'RGBA')
    except Exception:
        # Ultimate fallback: return original image with 255 alpha
        return image.convert('RGBA')

def segment_garment(image: Image.Image, auto_crop: bool = True) -> Tuple[Image.Image, Tuple[int, int, int, int]]:
    """
    Segment garment from background and optionally auto-crop to its bounding box.
    Returns:
        (segmented_rgba_image, (x1, y1, x2, y2))
    """
    if image.mode == 'RGBA':
        # If already has alpha transparency, check if it's already segmented
        alpha = np.array(image)[:, :, 3]
        if np.any(alpha == 0):
            bbox = image.getbbox() or (0, 0, image.width, image.height)
            if auto_crop:
                return image.crop(bbox), bbox
            return image, bbox
            
    # Try rembg first
    segmented = segment_garment_rembg(image)
    if segmented is None:
        segmented = segment_garment_opencv(image)
        
    bbox = segmented.getbbox() or (0, 0, segmented.width, segmented.height)
    if auto_crop and bbox:
        return segmented.crop(bbox), bbox
    return segmented, bbox
