"""Fit garment layers to measured avatar anchors without changing the avatar."""
import numpy as np
from PIL import Image

def warp(layer,source,target):
    if source==target:return layer.copy()
    source_y=[0,*source['anchors'],275]
    target_y=[0,*target['anchors'],275]
    ratio=source['width']/target['width']
    result=Image.new('RGBA',(220,276))
    for y in range(276):
        sy=int(round(np.interp(y,target_y,source_y)))
        row=layer.crop((0,sy,220,sy+1)).transform((220,1),Image.Transform.AFFINE,(ratio,0,110-110*ratio,0,1,0),resample=Image.Resampling.NEAREST)
        result.paste(row,(0,y))
    return result
