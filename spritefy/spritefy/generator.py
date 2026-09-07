"""Sprite Generator: Coordinates garment segmentation, attribute analysis,
inventory sprite synthesis, and paperdoll layer snapping.
"""
import os
import sys
from pathlib import Path
from typing import Dict, Any, Optional, Tuple, Union
import numpy as np
from PIL import Image

from spritefy.palette import quantize_image, nearest_color_idx, U7_PALETTE
from spritefy.pixel_forge import forge_pixel_sprite
from spritefy.worn import worn_layer, VERSION
from spritefy.segmenter import segment_garment
from spritefy.analyzer import analyze_garment
from spritefy.paperdoll import CANVAS_SIZE, CANVAS_WIDTH, CANVAS_HEIGHT, SLOT_BOUNDS

class SpriteGenerator:
    """Generates authentic Ultima VII inventory sprites and paperdoll layers."""

    def __init__(self, use_ollama: bool = True):
        self.use_ollama = use_ollama

    def process(
        self,
        image: Image.Image,
        user_hint: Optional[Dict[str, Any]] = None,
        inventory_size: Tuple[int, int] = (48, 48),
        dither: bool = True
    ) -> Dict[str, Any]:
        """
        Complete sprite-ification pipeline.
        
        1. Segments garment cleanly from photo.
        2. Analyzes clothing attributes (category, slot, color, pattern).
        3. Forges 48x48 inventory sprite.
        4. Synthesizes 220x276 paperdoll layer sprite snapped to the Avatar.
        """
        # 1. Segment
        segmented, bbox = segment_garment(image, auto_crop=True)
        
        # 2. Analyze
        meta = analyze_garment(segmented, user_hint=user_hint, use_ollama=self.use_ollama)
        slot = meta['slot']
        dom_colors = meta.get('dominant_colors', [(100, 100, 100)])
        primary_rgb = dom_colors[0] if dom_colors else (120, 100, 80)
        pattern = meta.get('pattern', 'solid')
        
        if meta.get('color_override'):
            from PIL import ImageColor
            names={'mustard-yellow':'#c9972c','amber':'#d97d25','army-green':'#556044','navy':'#293c61','burgundy':'#713848','tan':'#ac8862','olive':'#687057'}
            try:
                color=ImageColor.getrgb(names.get(meta['color_override'],meta['color_override']))
                arr=np.array(segmented.convert('RGBA'))
                light=arr[:,:,:3].astype(float).mean(axis=2)
                opaque=arr[:,:,3]>128
                median=float(np.median(light[opaque])) if opaque.any() else 100
                shade=np.clip(light/max(median,1),.25,1.7)
                arr[:,:,:3]=np.clip(shade[:,:,None]*np.array(color),0,255).astype('uint8')
                segmented=Image.fromarray(arr);primary_rgb=color
            except ValueError:
                pass
        # 3. Forge Inventory Sprite (Gump for bags and chests)
        # Solid fabrics use clean flat retro VGA fills; textured fabrics use subtle dither
        use_inv_dither = dither and (pattern in ('plaid', 'knit', 'denim', 'tweed', 'check'))
        inventory_sprite = forge_pixel_sprite(
            segmented,
            target_size=inventory_size,
            add_outline=True,
            dither=use_inv_dither,
            dither_strength=0.15 if use_inv_dither else 0.0,
            enhance_contrast=True
        )
        
        # 4. Forge Paperdoll Worn Layer Sprite (Fitted to Avatar anatomy)
        paperdoll_sprite = worn_layer(segmented, meta)

        return {
            'version': VERSION,
            'cut_details': meta.get('cut_details', ''),
            'fit': meta.get('fit', ''),
            'features': meta.get('features', []),
            'slot': slot,
            'garment_type': meta.get('garment_type', 'clothing'),
            'primary_color': meta.get('primary_color', f'rgb({primary_rgb[0]},{primary_rgb[1]},{primary_rgb[2]})'),
            'dominant_rgb': primary_rgb,
            'palette_index': meta.get('palette_index', nearest_color_idx(primary_rgb)),
            'pattern': pattern,
            'material': meta.get('material', 'cloth'),
            'segmented_image': segmented,
            'inventory_sprite': inventory_sprite,
            'paperdoll_sprite': paperdoll_sprite,
            'slot_bounds': SLOT_BOUNDS.get(slot)
        }
