import numpy as np
from PIL import Image
from spritefy.worn import garment_mask,worn_layer,SIZE

def test_flare_changes_hem_without_changing_waist():
 straight=np.array(garment_mask({'slot':'bottom','garment_type':'trousers'}))
 flare=np.array(garment_mask({'slot':'bottom','garment_type':'trousers','cut_details':'flared legs'}))
 assert np.array_equal(straight[125],flare[125])
 assert np.count_nonzero(flare[242])>np.count_nonzero(straight[242])+20

def test_short_sleeves_and_shorts_expose_limbs():
 short=np.array(garment_mask({'slot':'top','garment_type':'short-sleeve t-shirt'}))
 long=np.array(garment_mask({'slot':'top','garment_type':'long-sleeve shirt'}))
 assert np.count_nonzero(short[115])<np.count_nonzero(long[115])
 assert not np.array(garment_mask({'slot':'bottom','garment_type':'shorts'}))[190].any()

def test_every_slot_produces_binary_alpha():
 from spritefy.worn import SLOTS
 photo=Image.new('RGBA',(40,60),(30,65,90,255))
 for slot in SLOTS:
  im=worn_layer(photo,{'slot':slot})
  assert im.size==SIZE and im.getbbox()
  assert set(np.unique(np.array(im)[:,:,3]))<={0,255}


def test_shirt_anchors_at_shoulders_and_preserves_cuffs():
    mask=np.array(garment_mask({'slot':'top','garment_type':'button-down shirt'}))
    assert mask[57,90] == 255
    assert mask[61,110] == 255  # Normal shirt closes below the neck.
    assert mask[145,75] == 255  # Raising shoulders must not shorten the cuffs.
    vneck=np.array(garment_mask({'slot':'top','garment_type':'v-neck shirt'}))
    assert vneck[61,110] == 0

def test_long_sleeves_cover_rig_arm_coordinates():
    for slot in ('top','outer'):
        mask=np.array(garment_mask({'slot':slot,'garment_type':'long-sleeve shirt'}))
        for x,y in ((74,100),(74,135),(146,100),(146,135)):
            assert mask[y,x]==255
