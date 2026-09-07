"""Non-destructive adjustments applied after sprite generation."""
from PIL import Image

def place_layer(image, placement):
    p=placement or {}
    dx=int(p.get('x',0));dy=int(p.get('y',0))
    width=float(p.get('width',100))/100
    sleeve=float(p.get('sleeve',100))/100
    result=image.copy()
    if sleeve!=1:
        # Only the outer arm strips stretch; the neckline and torso stay fixed.
        for left,right in ((0,86),(134,220)):
            strip=image.crop((left,58,right,148))
            result.paste((0,0,0,0),(left,58,right,148))
            strip=strip.resize((right-left,round(90*sleeve)),Image.Resampling.NEAREST)
            result.alpha_composite(strip,(left,58))
    if width!=1:
        resized=result.resize((round(220*width),276),Image.Resampling.NEAREST)
        result=Image.new('RGBA',(220,276));result.alpha_composite(resized,((220-resized.width)//2,0))
    if dx or dy:
        shifted=Image.new('RGBA',(220,276));shifted.alpha_composite(result,(dx,dy));result=shifted
    return result
