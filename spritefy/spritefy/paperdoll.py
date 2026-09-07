"""Shared coordinate constants for the garment generator."""
from typing import Dict, Tuple

CANVAS_WIDTH = 220
CANVAS_HEIGHT = 276
CANVAS_SIZE = (CANVAS_WIDTH, CANVAS_HEIGHT)

# Exact slot bounding boxes on the 220x276 canvas
SLOT_BOUNDS: Dict[str, Tuple[int, int, int, int]] = {
    'head':   (84, 14, 136, 56),      # X1, Y1, X2, Y2 (Hat / Cap / Beanie / Helm)
    'neck':   (92, 46, 128, 68),      # Scarf / Tie / Necklace / Amulet
    'top':    (52, 50, 168, 126),     # Shirt / T-shirt / Sweater / Tunic + Sleeves
    'mid':    (60, 52, 160, 130),     # Vest / Cardigan / Pullover
    'outer':  (48, 44, 172, 175),     # Jacket / Coat / Blazer / Cloak / Parka
    'bottom': (66, 114, 154, 214),    # Pants / Jeans / Trousers / Skirt / Shorts
    'socks':  (70, 195, 150, 216),    # Socks
    'feet':   (54, 170, 166, 228),    # Boots / Shoes / Sneakers / Loafers
    'belt':   (80, 92, 140, 108),     # Belt & Buckle
    'bag':    (145, 35, 210, 125),    # Backpack / Shoulder Bag / Pouch
}

