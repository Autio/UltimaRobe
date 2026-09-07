"""Exercise a running PRIVATE sprite service with synthetic fixtures only.

Run inside its container: python /app/scripts/smoke_sprite.py
Creates test records under a random owner; does not touch real users.
"""
import io
import json
import os
import time
import uuid
import sys
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from PIL import Image, ImageDraw

ROOT=os.environ.get('SMOKE_SPRITE_URL','http://localhost:8190')
KEY=os.environ['SPRITEFY_KEY']

def request(path, data=None, content_type='application/json', authenticated=True):
    headers={'X-Spritefy-Key':KEY} if authenticated else {}
    if data is not None:
        headers['Content-Type']=content_type
        if isinstance(data,dict):data=json.dumps(data).encode()
    try:
        with urlopen(Request(ROOT+path,data=data,headers=headers),timeout=15) as response:
            return response.status,response.read()
    except HTTPError as error:
        return error.code,error.read()

def upload(path, fields, image):
    boundary='sprite-smoke-'+uuid.uuid4().hex
    body=b''
    for key,value in fields.items():
        body+=f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n'.encode()
    body+=f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="synthetic.png"\r\nContent-Type: image/png\r\n\r\n'.encode()+image+f'\r\n--{boundary}--\r\n'.encode()
    return request(path,body,'multipart/form-data; boundary='+boundary)

def main():
    state_path=Path(os.environ.get('SPRITEFY_DATA','/data'))/'release-smoke-state.json'
    if '--verify-persistence' in sys.argv:
        saved=json.loads(state_path.read_text())
        owner=saved['owner']
        assert json.loads(request('/api/v1/avatar/settings?owner='+owner)[1])['choice']=='personal'
        assert saved['item'] in json.loads(request('/api/v1/details?owner='+owner)[1])
        assert json.loads(request('/api/v1/jobs/'+saved['job']+'?owner='+owner)[1])['status']=='complete'
        assert request('/api/v1/jobs/'+saved['job']+'/inventory?owner='+owner)[0]==200
        print('PASS: personal avatar choice, item adjustments, completed job and image survive container recreation.')
        return
    owner='release-smoke-'+uuid.uuid4().hex
    other=owner+'-other'
    assert request('/health',authenticated=False)[0]==401
    assert request('/health')[0]==200
    assert request('/api/v1/avatar/base?owner='+owner)[0]==200
    assert request('/api/v1/avatar/select',{'owner':owner,'choice':'personal'})[0]==400
    image=Image.new('RGBA',(220,276))
    ImageDraw.Draw(image).rectangle((74,50,146,150),fill=(45,100,150,255))
    buf=io.BytesIO();image.save(buf,format='PNG');png=buf.getvalue()
    assert upload('/api/v1/avatar',{'owner':owner,'prepared':'true'},png)[0]==200
    assert request('/api/v1/avatar/select',{'owner':owner,'choice':'feminine'})[0]==200
    status,payload=request('/api/v1/avatar/settings?owner='+owner)
    assert status==200 and json.loads(payload)['has_personal']
    assert request('/api/v1/avatar/select',{'owner':owner,'choice':'personal'})[0]==200
    assert not json.loads(request('/api/v1/avatar/settings?owner='+other)[1])['has_personal']
    item=str(uuid.uuid4())
    details={'owner':owner,'item_id':item,'placement':{'x':3,'y':-2,'width':105,'sleeve':100},'enchanted_name':'Synthetic Raincoat','lore':'Release test fixture'}
    assert request('/api/v1/details',details)[0]==200
    assert item in json.loads(request('/api/v1/details?owner='+owner)[1])
    assert item not in json.loads(request('/api/v1/details?owner='+other)[1])
    details['placement']['x']=1000
    assert request('/api/v1/details',details)[0]==422
    status,payload=upload('/api/v1/jobs',{'owner':owner,'item_id':item,'user_hint':json.dumps({'slot':'top','garment_type':'long-sleeve shirt'})},png)
    assert status==202,(status,payload)
    job=json.loads(payload)['job_id']
    for _ in range(60):
        state=json.loads(request('/api/v1/jobs/'+job+'?owner='+owner)[1])
        if state['status'] in ('complete','failed'):break
        time.sleep(1)
    assert state['status']=='complete',state['status']
    assert request('/api/v1/jobs/'+job+'?owner='+other)[0]==404
    assert request('/api/v1/jobs/'+job+'/inventory?owner='+owner)[0]==200
    status,payload=request('/api/v1/paperdoll/composite',{'owner':owner,'equipped_job_ids':[job],'scale':1})
    assert status==200,(status,payload)
    assert Image.open(io.BytesIO(payload)).size==(220,276)
    state_path.write_text(json.dumps({'owner':owner,'item':item,'job':job}))
    print('PASS: authenticated service, avatar preservation, owner isolation, placement validation, real sprite job, inventory image, and dressed composite.')

if __name__=='__main__':main()
