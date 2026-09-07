"""Garment Analyzer: Semantic and visual attribute extraction.

Connects to local Ollama (e.g. a configured vision model) or falls back to
color/geometric heuristics.
"""
import os
import fcntl
import json
import base64
import io
from typing import Dict, Any, Optional, Tuple
import requests
import numpy as np
from PIL import Image
from spritefy.palette import nearest_color_idx, U7_PALETTE

DEFAULT_OLLAMA_URL = os.environ.get('OLLAMA_HOST', 'http://host.docker.internal:11434')
DEFAULT_VISION_MODEL = os.environ.get('VISION_MODEL', 'gemma4:latest')

SLOT_MAP = {
    'hat': 'head', 'cap': 'head', 'beanie': 'head', 'helmet': 'head', 'hood': 'head',
    'scarf': 'neck', 'tie': 'neck', 'necklace': 'neck', 'amulet': 'neck', 'collar': 'neck',
    'shirt': 'top', 't-shirt': 'top', 'blouse': 'top', 'polo': 'top', 'tunic': 'top', 'tank': 'top',
    'sweater': 'top', 'sweatshirt': 'top', 'pullover': 'top',
    'cardigan': 'mid', 'vest': 'mid', 'gilet': 'mid',
    'jacket': 'outer', 'coat': 'outer', 'blazer': 'outer', 'hoodie': 'outer', 'cloak': 'outer', 'parka': 'outer',
    'pants': 'bottom', 'jeans': 'bottom', 'trousers': 'bottom', 'shorts': 'bottom', 'skirt': 'bottom', 'chinos': 'bottom',
    'socks': 'socks',
    'shoes': 'feet', 'boots': 'feet', 'sneakers': 'feet', 'sandals': 'feet', 'loafers': 'feet', 'footwear': 'feet',
    'belt': 'belt',
    'bag': 'bag', 'backpack': 'bag', 'purse': 'bag', 'pouch': 'bag'
}

def image_to_base64_jpeg(image: Image.Image, max_dim: int = 512) -> str:
    """Resize image and encode to base64 JPEG."""
    img = image.convert('RGB')
    if max(img.size) > max_dim:
        img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format='JPEG', quality=85)
    return base64.b64encode(buf.getvalue()).decode('utf-8')

def extract_dominant_colors(image: Image.Image, num_colors: int = 3) -> list[Tuple[int, int, int]]:
    """Extract dominant RGB colors from non-transparent pixels."""
    if image.mode != 'RGBA':
        rgba = image.convert('RGBA')
    else:
        rgba = image
        
    arr = np.array(rgba)
    alpha = arr[:, :, 3]
    opaque = arr[alpha >= 128, :3]
    
    if len(opaque) == 0:
        return [(128, 128, 128)]
        
    # Sample up to 1000 pixels
    if len(opaque) > 1000:
        indices = np.linspace(0, len(opaque)-1, 1000, dtype=int)
        sample = opaque[indices]
    else:
        sample = opaque
        
    # Quantize to 16 color bins
    quant = (sample // 32) * 32 + 16
    unique, counts = np.unique(quant, axis=0, return_counts=True)
    sorted_indices = np.argsort(-counts)
    
    dominant = []
    for idx in sorted_indices[:num_colors]:
        dominant.append(tuple(map(int, unique[idx])))
    return dominant

def analyze_with_ollama(
    image: Image.Image,
    ollama_url: str = DEFAULT_OLLAMA_URL,
    model: str = DEFAULT_VISION_MODEL,
    timeout: int = 90
) -> Optional[Dict[str, Any]]:
    """Query local Ollama vision model for structured garment metadata."""
    b64_img = image_to_base64_jpeg(image)
    prompt = (
        "Analyze this clothing item for an Ultima VII RPG paperdoll and inventory sprite system.\n"
        "Return a JSON object with:\n"
        "- slot: exactly one of ['head', 'neck', 'top', 'mid', 'outer', 'bottom', 'socks', 'feet', 'belt', 'bag']\n"
        "- garment_type: e.g. 't-shirt', 'button-down shirt', 'jeans', 'boots', 'hoodie', 'cloak'\n"
        "- primary_color: e.g. 'navy blue', 'crimson red', 'forest green'\n"
        "- pattern: 'solid', 'striped', 'plaid', 'check', or 'graphic'\n"
        "- material: 'cotton', 'denim', 'leather', 'wool', 'silk'\n"
        "- cut_details: brief description of collar, sleeve length, garment length, leg silhouette (flared, bootcut, tapered, straight or wide), hem width and rise. Do not assume straight legs\n"
        "Output valid JSON only with no markdown formatting."
    )
    
    endpoint = f"{ollama_url.rstrip('/')}/api/generate"
    payload = {
        "model": model,
        "prompt": prompt,
        "images": [b64_img],
        "stream": False,
        "format": "json",
        "keep_alive": 0
    }
    
    try:
        # Fast connect timeout (2s) so if Ollama is unreachable, failover to heuristics immediately
        with open(os.environ.get('AI_LOCK_PATH', '/shared/ai-work.lock'), 'a') as lease:
            fcntl.flock(lease, fcntl.LOCK_EX)
            resp = requests.post(endpoint, json=payload, timeout=(2.0, float(timeout)))
        if resp.status_code == 200:
            data = resp.json()
            raw_text = data.get('response', '')
            parsed = json.loads(raw_text)
            if 'slot' in parsed:
                slot = parsed['slot'].lower()
                if slot in SLOT_MAP.values():
                    parsed['slot'] = slot
                else:
                    parsed['slot'] = SLOT_MAP.get(slot, 'top')
            return parsed
    except Exception:
        pass
    return None

def analyze_heuristic(image: Image.Image) -> Dict[str, Any]:
    """Fallback rule-based heuristic analysis based on aspect ratio and dominant colors."""
    w, h = image.size
    aspect = h / max(1, w)
    
    # Aspect ratio heuristics:
    # Very tall items (aspect > 1.6) are usually pants, dresses, or boots
    if aspect > 1.6:
        slot = 'bottom'
        garment_type = 'trousers'
    elif aspect < 0.7:
        slot = 'belt'
        garment_type = 'belt'
    elif aspect >= 1.1:
        slot = 'top'
        garment_type = 'shirt'
    else:
        slot = 'outer'
        garment_type = 'jacket'
        
    dominant_colors = extract_dominant_colors(image, num_colors=2)
    primary_rgb = dominant_colors[0] if dominant_colors else (100, 100, 100)
    palette_idx = nearest_color_idx(primary_rgb)
    
    return {
        'slot': slot,
        'garment_type': garment_type,
        'primary_color': f"rgb({primary_rgb[0]},{primary_rgb[1]},{primary_rgb[2]})",
        'palette_index': palette_idx,
        'pattern': 'solid',
        'material': 'cloth',
        'cut_details': 'standard fit',
        'dominant_colors': dominant_colors
    }

def analyze_garment(
    image: Image.Image,
    user_hint: Optional[Dict[str, Any]] = None,
    use_ollama: bool = True
) -> Dict[str, Any]:
    """
    Main analysis entry point. Merges Ollama vision output with user hints
    and extracts dominant palette indices.
    """
    result = None
    if use_ollama and os.environ.get("VISION_MODEL"):
        result = analyze_with_ollama(image)
        
    if not result:
        result = analyze_heuristic(image)
        
    # Apply user hints if provided (e.g. user overrides slot or type)
    if user_hint:
        for k, v in user_hint.items():
            if v is not None and k in ('slot', 'garment_type', 'primary_color', 'pattern', 'material', 'cut_details', 'fit', 'features', 'description', 'color_override'):
                if k == 'cut_details' and not user_hint.get('correction'):
                    result[k] = str(result.get(k, '')) + '; ' + str(v)
                else:
                    result[k] = v
                
    # Normalize slot
    raw_slot = str(result.get('slot', 'top')).lower()
    result['slot'] = SLOT_MAP.get(raw_slot, raw_slot if raw_slot in SLOT_MAP.values() else 'top')
    
    # Extract dominant palette indices
    dom_colors = extract_dominant_colors(image, num_colors=3)
    result['dominant_colors'] = dom_colors
    result['palette_indices'] = [nearest_color_idx(c) for c in dom_colors]
    return result
