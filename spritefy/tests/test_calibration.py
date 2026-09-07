import numpy as np
from PIL import Image
from spritefy.calibration import warp

def test_identity_preserves_avatar_layer_and_input():
    source=Image.new('RGBA',(220,276));source.putpixel((110,125),(80,40,20,255))
    rig={'anchors':[58,125,152,195,244],'width':76}
    original=source.tobytes()
    assert warp(source,rig,rig).tobytes()==original
    assert source.tobytes()==original

def test_landmark_adjustment_moves_clothes_without_soft_alpha():
    source=Image.new('RGBA',(220,276));source.paste((90,30,20,255),(95,120,125,131))
    rig={'anchors':[58,125,152,195,244],'width':76}
    target={'anchors':[58,135,160,200,244],'width':100}
    result=warp(source,rig,target)
    assert result.getpixel((110,135))[3]==255
    assert set(np.unique(np.array(result)[:,:,3]))<={0,255}
