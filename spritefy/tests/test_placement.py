from PIL import Image
from spritefy.placement import place_layer

def test_identity_and_translation_leave_source_unchanged():
    source=Image.new('RGBA',(220,276));source.putpixel((110,80),(90,40,20,255))
    original=source.tobytes()
    assert place_layer(source,{}).tobytes()==original
    shifted=place_layer(source,{'x':4,'y':-3})
    assert shifted.getpixel((114,77))==(90,40,20,255)
    assert source.tobytes()==original

def test_sleeve_adjustment_preserves_torso_and_alpha():
    source=Image.new('RGBA',(220,276));source.paste((90,40,20,255),(72,58,82,148));source.putpixel((110,80),(30,60,90,255))
    result=place_layer(source,{'sleeve':80})
    assert result.getpixel((110,80))==source.getpixel((110,80))
    assert result.getpixel((75,140))[3]==0
    assert result.getpixel((75,120))[3]==255
