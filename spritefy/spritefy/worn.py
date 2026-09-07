"""Versioned raster clothing geometry; all layers share the portrait-v2 pose.

Photo texture supplies colour/pattern; explicit cut controls supply silhouette.
This is a stylised clothing reconstruction, not a simulated physical try-on.
"""
import re
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SIZE = (220, 276)
VERSION = 'portrait-v2.1'
SLOTS = ('head', 'neck', 'top', 'mid', 'outer', 'bottom', 'socks', 'feet', 'belt', 'bag', 'extra')

def garment_mask(meta):
    mask = Image.new('L', SIZE)
    d = ImageDraw.Draw(mask)
    slot = meta['slot']
    detail = ' '.join(str(meta.get(k, '')) for k in ('garment_type','cut_details','fit','features','description')).lower()
    def poly(points): d.polygon(points, fill=255)
    if slot in ('top','mid','outer'):
        outer = slot == 'outer'
        hem = 162 if outer and re.search(r'long|coat|parka', detail) else 133
        poly([(87,57),(101,52),(119,52),(133,57),(139,95),(133,hem),(87,hem),(81,95)])
        sleeveless = bool(re.search(r'sleeveless|tank|vest|gilet',detail)) or slot == 'mid'
        short = bool(re.search(r'short.sleeve|t.shirt|polo',detail))
        if not sleeveless:
            end = 94 if short else 147
            # Follow the bent outer-arm contour; a straight shoulder-to-cuff
            # edge cuts across the avatar's elbow and exposes a strip of skin.
            poly([(87,58),(78,62),(73,85),(72,94),(71,end),(82,end),(96,77)])
            poly([(133,58),(142,62),(147,85),(148,94),(149,end),(138,end),(124,77)])
        # Neck base is y=52 in the portrait, not the lower chest. Only V-necks
        # should have a deep opening; collared/crew shirts sit at the clavicles.
        neck_end = 66 if re.search(r'v.neck|deep.neck', detail) else 59
        d.polygon([(103,51),(117,51),(115,neck_end-2),(110,neck_end),(105,neck_end-2)],fill=0)
        if outer:
            d.polygon([(104,63),(116,63),(121,hem),(100,hem)], fill=0)
        if re.search(r'dress|jumpsuit', detail):
            poly([(88,126),(132,126),(148,235),(72,235)])
    elif slot == 'bottom':
        shorts = 'short' in detail
        skirt = 'skirt' in detail
        end = 169 if shorts else 247
        if skirt:
            poly([(87,124),(133,124),(151,214),(69,214)])
        else:
            poly([(87,124),(133,124),(136,152),(117,157),(110,150),(103,157),(84,152)])
            knee = min(193, end)
            flare = 6 if re.search(r'flar|bell.bottom',detail) else 3 if 'bootcut' in detail else 0
            wide = 5 if re.search(r'wide|relaxed|baggy',detail) else 0
            poly([(85-wide,144),(109,145),(102,knee),(100+flare+wide,end),(80-flare-wide,end),(84-wide,knee)])
            poly([(111,145),(135+wide,144),(136+wide,knee),(140+flare+wide,end),(120-flare-wide,end),(118,knee)])
    elif slot in ('feet','socks'):
        boot = 'boot' in detail
        start = 221 if boot or slot == 'socks' else 238
        poly([(85, start), (97, start), (97, 248), (95, 255), (91, 259), (81, 259), (77, 253), (80, 246)])
        poly([(122, start), (134, start), (138, 246), (141, 253), (135, 259), (126, 259), (122, 255), (122, 248)])
    elif slot == 'belt': d.rectangle((86,125,134,130),fill=255)
    elif slot == 'head':
        d.ellipse((94,12,126,34),fill=255)
        if re.search(r'hat|cap',detail): d.rectangle((90,29,130,32),fill=255)
    elif slot == 'neck': poly([(100,57),(104,73),(112,78),(122,63),(119,58),(110,69)])
    elif slot == 'bag':
        d.rounded_rectangle((146,91,179,132),radius=3,fill=255)
        d.line([(132,66),(147,91),(154,103)],fill=255,width=3)
    else: d.ellipse((141,145,150,154),fill=255)
    return mask

def worn_layer(photo, meta):
    mask = garment_mask(meta)
    a = np.array(mask)
    bbox = mask.getbbox()
    if not bbox: return Image.new('RGBA',SIZE)
    # Use garment-only samples, avoiding white/transparent background bleed.
    rgba = np.array(photo.convert('RGBA'))
    opaque = rgba[:,:,3] > 128
    fallback = np.median(rgba[opaque,:3],axis=0) if opaque.any() else np.array([95,90,75])
    
    # Lift black floor for dark garments so directional shading is visible
    if np.mean(fallback) < 55:
        fallback = np.array([44.0, 44.0, 50.0])
        
    rgba[~opaque,:3] = fallback
    texture = Image.fromarray(rgba[:,:,:3]).resize((bbox[2]-bbox[0],bbox[3]-bbox[1]),Image.Resampling.BOX)
    out = Image.new('RGB',SIZE,tuple(map(int,fallback)))
    out.paste(texture,bbox[:2])
    rgb = np.array(out).astype(float)
    yy,xx = np.indices(a.shape)
    # Broad light planes plus stable small pixel clusters, never random noise.
    shade = .80 + .20*np.cos((xx-98)/12) + .07*np.sin(xx*.60+np.sin(yy*.09)) + .025*((xx//2+yy//2)%2)
    rgb *= shade[:,:,None]
    pattern = str(meta.get('pattern','')).lower()
    if 'strip' in pattern: rgb[((xx//3)%3)==0] *= .70
    if pattern in ('plaid','check','checked'): rgb[((xx//5)%2==0)|((yy//5)%2==0)] *= .76
    edge = (a>0)&(np.array(mask.filter(ImageFilter.MinFilter(3)))==0)
    rgb[edge] *= .35
    rgb = np.clip(rgb,0,255).astype('uint8')
    # Each garment keeps a compact palette derived from its actual photo.
    im = Image.fromarray(rgb).quantize(colors=24,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.NONE).convert('RGBA')
    im.putalpha(mask)
    details = Image.new('RGBA',SIZE)
    draw = ImageDraw.Draw(details)
    dark=tuple(int(c*.40) for c in fallback)+(220,)
    light=tuple(min(255,int(c*1.5+15)) for c in fallback)+(190,)
    slot=meta['slot']
    if slot=='bottom':
        draw.line([(88,128),(132,128)],fill=dark)
        draw.line([(110,129),(110,148)],fill=dark)
        draw.line([(91,130),(88,141),(86,143)],fill=dark)
        draw.line([(129,130),(132,141),(134,143)],fill=dark)
        for x in (92,128):
            draw.line([(x,158),(x-2,185),(x,231)],fill=light)
    if slot in ('top','mid','outer'):
        description=str(meta.get('garment_type',''))+' '+str(meta.get('cut_details',''))
        if re.search(r'button|collar|blazer|jacket',description):
            draw.line([(101,53),(104,64),(110,59),(116,64),(119,53)],fill=light)
            if slot!='outer':
                draw.line([(110,62),(110,130)],fill=dark)
                for y in range(68,129,10): draw.point((111,y),fill=light)
        draw.line([(88,131),(132,131)],fill=dark)
    if slot in ('feet','socks'):
        # Sole lines along base of each shoe
        draw.line([(81, 259), (91, 259)], fill=dark, width=1)
        draw.line([(126, 259), (135, 259)], fill=dark, width=1)
        # Shoe collar opening
        draw.line([(86, 239), (96, 239)], fill=light, width=1)
        draw.line([(123, 239), (133, 239)], fill=light, width=1)
        # Vamp / laces highlight
        draw.line([(88, 241), (87, 250)], fill=light, width=1)
        draw.line([(131, 241), (132, 250)], fill=light, width=1)
    da=np.array(details);da[:,:,3]=np.minimum(da[:,:,3],a)
    im.alpha_composite(Image.fromarray(da))
    # Keep final alpha strictly binary even after detail overlays.
    im.putalpha(mask)
    return im
