import numpy as np
from PIL import Image
from spritefy.default_fit import fit_default
from spritefy.worn import worn_layer

def test_personal_avatar_clothing_is_unchanged():
    layer=Image.new('RGBA',(220,276),(30,50,80,255))
    assert fit_default(layer,'personal').tobytes()==layer.tobytes()

def test_defaults_keep_binary_alpha_and_continuous_trouser_legs():
    layer=worn_layer(Image.new('RGBA',(30,40),(80,70,60,255)),{'slot':'bottom','garment_type':'trousers'})
    for choice in ('masculine','feminine'):
        result=fit_default(layer,choice)
        a=np.array(result)[:,:,3]
        assert result.size==(220,276) and set(np.unique(a))<={0,255}
        for y in range(170,225): assert np.count_nonzero(a[y])>25
