"""Exercise avatar calibration and review-before-replace in an isolated stack."""
import json
import time
from pathlib import Path
import smoke_sprite as base

def main():
    base.main()
    saved=json.loads((Path(base.os.environ.get('SPRITEFY_DATA','/data'))/'release-smoke-state.json').read_text())
    owner,item,first=saved['owner'],saved['item'],saved['job']
    settings=json.loads(base.request('/api/v1/avatar/settings?owner='+owner)[1])
    calibration={**settings['default_calibration'],'anchors':[60,128,155,198,246]}
    assert base.request('/api/v1/avatar/calibration',{'owner':owner,'choice':'personal','calibration':calibration})[0]==200
    assert base.request('/api/v1/avatar/calibration',{'owner':owner,'choice':'personal','calibration':{'anchors':[50,40,80,100,120],'width':76}})[0]==422
    assert base.request('/api/v1/avatar/select',{'owner':owner,'choice':'feminine'})[0]==200
    assert base.request('/api/v1/avatar/select',{'owner':owner,'choice':'personal'})[0]==200
    assert json.loads(base.request('/api/v1/avatar/settings?owner='+owner)[1])['calibration']==calibration
    image=base.Image.new('RGBA',(80,100));base.ImageDraw.Draw(image).rectangle((10,10,70,90),fill=(120,45,60,255));buf=base.io.BytesIO();image.save(buf,format='PNG')
    status,payload=base.upload('/api/v1/jobs',{'owner':owner,'item_id':item,'force':'true','user_hint':json.dumps({'slot':'top','garment_type':'short-sleeve shirt'})},buf.getvalue())
    assert status==202
    second=json.loads(payload)['job_id']
    for _ in range(60):
        status=json.loads(base.request('/api/v1/jobs/'+second+'?owner='+owner)[1])['status']
        if status in ('failed','complete'):break
        time.sleep(1)
    assert status=='complete'
    listing=json.loads(base.request('/api/v1/jobs?owner='+owner)[1])[0]
    assert listing['job_id']==first and listing['candidate']['job_id']==second
    assert base.request('/api/v1/jobs/select',{'owner':owner+'other','item_id':item,'job_id':second})[0]==404
    assert base.request('/api/v1/jobs/select',{'owner':owner,'item_id':item,'job_id':second,'dismiss':True})[0]==200
    assert 'candidate' not in json.loads(base.request('/api/v1/jobs?owner='+owner)[1])[0]
    assert base.request('/api/v1/jobs/select',{'owner':owner,'item_id':item,'job_id':second})[0]==200
    assert json.loads(base.request('/api/v1/jobs?owner='+owner)[1])[0]['job_id']==second
    assert base.request('/api/v1/paperdoll/composite',{'owner':owner,'equipped_job_ids':[second],'scale':1})[0]==200
    print('PASS: calibration validation and preservation, review-before-replace, dismissal, acceptance, cross-owner rejection, calibrated composite.')

if __name__=='__main__':main()
