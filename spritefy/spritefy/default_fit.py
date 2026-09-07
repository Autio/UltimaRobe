"""Fit clothing to default silhouettes without altering the avatar artwork."""
import json
from functools import lru_cache
from pathlib import Path
import numpy as np
from PIL import Image

@lru_cache(maxsize=2)
def geometry(choice):
    folder=Path(__file__).parent/'assets'
    target=np.array(Image.open(folder/('default-'+choice+'.png')))[:,:,3]
    anchors=json.loads((folder/'default-anchors.json').read_text())[choice]
    return target,anchors

def fit_default(layer,choice):
    if choice not in ('masculine','feminine'): return layer.copy()
    target,anchors=geometry(choice)
    original=[12,49,58,125,152,195,244,260]
    result=Image.new('RGBA',(220,276))
    # One smooth horizontal scale avoids discontinuities where hands and legs
    # become separate alpha regions. Never derive width from individual rows.
    target_x=np.where(target[anchors[2]:anchors[4]]>128)[1]
    ratio=76/max(1,target_x.max()-target_x.min())
    offset=110-110*ratio
    for y in range(276):
        sy=int(round(np.interp(y,[0,*anchors,275],[0,*original,275])))
        row=layer.crop((0,sy,220,sy+1)).transform((220,1),Image.Transform.AFFINE,(ratio,0,offset,0,1,0),resample=Image.Resampling.NEAREST)
        result.paste(row,(0,y))
    return result
