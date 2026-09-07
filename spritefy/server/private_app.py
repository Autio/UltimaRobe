"""Private Wardrowbe bridge. Identity is supplied only by the authenticated Next server."""
import hashlib
import io
import json
import os
import secrets
import threading
from pathlib import Path
from typing import Literal
from fastapi import FastAPI, Depends, Header, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field
from PIL import Image, ImageOps
from spritefy.queue import JobQueue
from spritefy.worn import SIZE, SLOTS, VERSION
from spritefy.segmenter import segment_garment
from spritefy.pixel_forge import forge_pixel_sprite
from spritefy.placement import place_layer
from spritefy.default_fit import fit_default
from spritefy.calibration import warp
from pydantic import model_validator

ROOT=Path(os.environ.get('SPRITEFY_DATA','/opt/spritefy/data'))
ROOT.mkdir(parents=True,exist_ok=True)
TOKEN=os.environ['SPRITEFY_KEY']
def authorize(x_spritefy_key: str=Header(default='')):
    if not secrets.compare_digest(TOKEN,x_spritefy_key): raise HTTPException(401,'Unauthorized')
app=FastAPI(dependencies=[Depends(authorize)],docs_url=None,redoc_url=None,openapi_url=None)
queue=JobQueue(data_dir=ROOT,max_workers=1,use_ollama=True)
submit_lock=threading.Lock()

def owner_key(owner):
    if not owner or len(owner)>200: raise HTTPException(400,'Invalid owner')
    return hashlib.sha256(owner.encode()).hexdigest()

def item_details(owner):
    path=ROOT/'details'/(owner_key(owner)+'.json')
    try: return json.loads(path.read_text())
    except (OSError,ValueError): return {}

class Placement(BaseModel):
    x:int=Field(default=0,ge=-12,le=12)
    y:int=Field(default=0,ge=-12,le=12)
    width:int=Field(default=100,ge=80,le=120)
    sleeve:int=Field(default=100,ge=80,le=120)

class ItemDetails(BaseModel):
    owner:str=Field(min_length=1,max_length=200)
    item_id:str=Field(pattern=r'^[a-f0-9-]{36}$')
    placement:Placement=Field(default_factory=Placement)
    enchanted_name:str=Field(default='',max_length=100)
    lore:str=Field(default='',max_length=400)

@app.get('/api/v1/details')
def get_details(owner:str): return item_details(owner)

@app.post('/api/v1/details')
def save_details(req:ItemDetails):
    with submit_lock:
        data=item_details(req.owner)
        if req.item_id not in data and len(data)>=2000: raise HTTPException(400,'Too many customized garments')
        data[req.item_id]={**data.get(req.item_id,{}),**req.model_dump(exclude={'owner','item_id'})}
        folder=ROOT/'details';folder.mkdir(exist_ok=True)
        path=folder/(owner_key(req.owner)+'.json');temp=path.with_suffix('.tmp')
        temp.write_text(json.dumps(data));temp.replace(path)
    return data[req.item_id]
def owned(job_id,owner):
    owner_key(owner)
    job=queue.get_job(job_id)
    if not job or job['owner']!=owner: raise HTTPException(404,'Sprite not found')
    return job
def public(job):
    job=dict(job)
    if isinstance(job.get('user_hint'),str):
        try: job['user_hint']=json.loads(job['user_hint'])
        except ValueError: job['user_hint']={}
    return {k:job.get(k) for k in ('job_id','item_id','status','progress','message','metadata','created_at','updated_at','user_hint')}
def png(im):
    buf=io.BytesIO();im.save(buf,format='PNG')
    return Response(buf.getvalue(),media_type='image/png',headers={'Cache-Control':'private, no-store'})
def uploaded(file):
    data=file.file.read(12*1024*1024+1)
    if len(data)>12*1024*1024: raise HTTPException(413,'Image exceeds 12 MB')
    try:
        im=Image.open(io.BytesIO(data))
        if im.width*im.height>24_000_000: raise ValueError()
        im=ImageOps.exif_transpose(im).convert('RGBA');im.thumbnail((1600,1600));im.load()
        return im
    except Exception: raise HTTPException(400,'Use a PNG, JPEG or WebP image under 24 megapixels')

@app.get('/health')
def health(): return {'status':'ready','version':VERSION}

@app.get('/api/v1/jobs')
def list_jobs(owner:str):
    owner_key(owner)
    latest={}
    for job in queue.list_jobs(owner,1000):
        if job['item_id'] not in latest: latest[job['item_id']]=public(job)
    details=item_details(owner)
    result=[]
    for item,job in latest.items():
        saved=details.get(item,{})
        accepted=queue.get_job(saved.get('accepted_job','')) if saved.get('accepted_job') else None
        if accepted and accepted['owner']==owner and accepted['item_id']==item and accepted['status']=='complete':
            chosen=public(accepted)
            if job['job_id'] not in (accepted['job_id'],saved.get('dismissed_job')):chosen['candidate']=job
            result.append(chosen)
        else:result.append(job)
    return result

class SpriteSelection(BaseModel):
    owner:str=Field(min_length=1,max_length=200)
    item_id:str
    job_id:str
    dismiss:bool=False

@app.post('/api/v1/jobs/select')
def select_sprite(req:SpriteSelection):
    job=owned(req.job_id,req.owner)
    if job['item_id']!=req.item_id:raise HTTPException(400,'Sprite belongs to a different garment')
    if not req.dismiss and job['status']!='complete':raise HTTPException(409,'Wait for this sprite to finish')
    with submit_lock:
        data=item_details(req.owner);detail=data.setdefault(req.item_id,{})
        detail['dismissed_job' if req.dismiss else 'accepted_job']=req.job_id
        folder=ROOT/'details';folder.mkdir(exist_ok=True)
        path=folder/(owner_key(req.owner)+'.json');temp=path.with_suffix('.tmp');temp.write_text(json.dumps(data));temp.replace(path)
    return {'status':'saved'}

@app.post('/api/v1/jobs',status_code=202)
def create_job(file:UploadFile=File(...),item_id:str=Form(...),owner:str=Form(...),user_hint:str=Form('{}'),force:bool=Form(False)):
    owner_key(owner)
    if len(item_id)>100: raise HTTPException(400,'Invalid item')
    try: hint=json.loads(user_hint)
    except Exception: raise HTTPException(400,'Invalid garment details')
    if not isinstance(hint,dict) or hint.get('slot') not in SLOTS: raise HTTPException(400,'Invalid slot')
    im=uploaded(file)
    with submit_lock:
        previous=queue.get_by_item(item_id,owner)
        if previous and previous['status'] not in ('complete','failed'): return public(previous)
        if previous and not force and previous['status']=='complete' and previous.get('user_hint')==hint and (previous.get('metadata') or {}).get('version')==VERSION: return public(previous)
        active=[j for j in queue.list_jobs(None,1000) if j['status'] not in ('complete','failed')]
        if len(active)>=24: raise HTTPException(429,'Sprite queue is full; try shortly')
        if previous and previous['status']=='complete':
            data=item_details(owner);detail=data.setdefault(item_id,{})
            detail.setdefault('accepted_job',previous['job_id'])
            folder=ROOT/'details';folder.mkdir(exist_ok=True)
            path=folder/(owner_key(owner)+'.json');temp=path.with_suffix('.tmp');temp.write_text(json.dumps(data));temp.replace(path)
        return public(queue.get_job(queue.enqueue(item_id,im,owner,hint)))

@app.get('/api/v1/jobs/{job_id}')
def get_job(job_id:str,owner:str): return public(owned(job_id,owner))

@app.get('/api/v1/jobs/{job_id}/{kind}')
def get_sprite(job_id:str,kind:str,owner:str):
    job=owned(job_id,owner)
    if kind not in ('inventory','paperdoll') or job['status']!='complete': raise HTTPException(404,'Sprite not ready')
    with Image.open(job[kind+'_sprite']) as im: return png(im)

AvatarChoice=Literal['masculine','feminine','personal']

def avatar_settings(owner):
    key=owner_key(owner)
    personal=(ROOT/'avatars'/(key+'.png')).exists()
    choice='personal' if personal else 'masculine'
    saved={}
    try:
        saved=json.loads((ROOT/'avatars'/(key+'-settings.json')).read_text())
        if saved.get('choice') in ('masculine','feminine','personal'): choice=saved['choice']
    except (OSError,ValueError): pass
    if choice=='personal' and not personal: choice='masculine'
    calibration=saved.get('calibrations',{}).get(choice)
    return {'choice':choice,'has_personal':personal,'calibration':calibration,'default_calibration':default_calibration(choice)}

def default_calibration(choice):
    if choice=='personal':return {'anchors':[58,125,152,195,244],'width':76}
    from spritefy.default_fit import geometry
    alpha,anchors=geometry(choice)
    import numpy as np
    xs=np.where(alpha[anchors[2]:anchors[4]]>128)[1]
    return {'anchors':anchors[2:7],'width':int(xs.max()-xs.min())}

def save_avatar_choice(owner,choice):
    folder=ROOT/'avatars';folder.mkdir(exist_ok=True)
    path=folder/(owner_key(owner)+'-settings.json')
    with submit_lock:
        try:saved=json.loads(path.read_text())
        except (ValueError,OSError):saved={}
        saved['choice']=choice
        temp=path.with_suffix('.tmp');temp.write_text(json.dumps(saved));temp.replace(path)

class Calibration(BaseModel):
    anchors:list[int]=Field(min_length=5,max_length=5)
    width:int=Field(ge=32,le=160)
    @model_validator(mode='after')
    def validate_anchors(self):
        if not 20<=self.anchors[0] or not self.anchors[-1]<=270 or any(b-a<8 for a,b in zip(self.anchors,self.anchors[1:])):
            raise ValueError('Landmarks must be ordered, at least eight pixels apart, between 20 and 270.')
        return self

class CalibrationRequest(BaseModel):
    owner:str=Field(min_length=1,max_length=200)
    choice:AvatarChoice
    calibration:Calibration|None=None

@app.post('/api/v1/avatar/calibration')
def save_calibration(req:CalibrationRequest):
    folder=ROOT/'avatars';folder.mkdir(exist_ok=True)
    path=folder/(owner_key(req.owner)+'-settings.json')
    with submit_lock:
        try:saved=json.loads(path.read_text())
        except (ValueError,OSError):saved={}
        calibrations=saved.setdefault('calibrations',{})
        if req.calibration:calibrations[req.choice]=req.calibration.model_dump()
        else:calibrations.pop(req.choice,None)
        temp=path.with_suffix('.tmp');temp.write_text(json.dumps(saved));temp.replace(path)
    return avatar_settings(req.owner)

def base(owner):
    choice=avatar_settings(owner)['choice']
    path=ROOT/'avatars'/(owner_key(owner)+'.png') if choice=='personal' else Path(__file__).parents[1]/'spritefy'/'assets'/('default-'+choice+'.png')
    with Image.open(path) as im: return im.convert('RGBA')

@app.get('/api/v1/avatar/settings')
def get_avatar_settings(owner:str): return avatar_settings(owner)

class AvatarSelection(BaseModel):
    owner:str=Field(min_length=1,max_length=200)
    choice:AvatarChoice

@app.post('/api/v1/avatar/select')
def select_avatar(req:AvatarSelection):
    if req.choice=='personal' and not avatar_settings(req.owner)['has_personal']:
        raise HTTPException(400,'Upload your photo first')
    save_avatar_choice(req.owner,req.choice)
    return avatar_settings(req.owner)

@app.get('/api/v1/avatar/base')
def avatar(owner:str): return png(base(owner))

@app.post('/api/v1/avatar')
def upload_avatar(owner:str=Form(...),file:UploadFile=File(...),prepared:bool=Form(False)):
    key=owner_key(owner);im=uploaded(file)
    source=ROOT/'avatars';source.mkdir(exist_ok=True)
    im.save(source/(key+'-source.png'))
    if prepared:
        if im.size!=SIZE: raise HTTPException(400,'Prepared sprite must be 220 by 276 pixels')
        sprite=im
    else:
        segmented,_=segment_garment(im)
        # Front-facing full-body photos are normalized to the same vertical anchors.
        sprite=forge_pixel_sprite(segmented,(84,248),dither=True)
        canvas=Image.new('RGBA',SIZE);canvas.alpha_composite(sprite,((220-sprite.width)//2,12));sprite=canvas
    temp=source/(key+'.tmp');sprite.save(temp,format='PNG');temp.replace(source/(key+'.png'))
    save_avatar_choice(owner,'personal')
    return {'status':'complete','version':hashlib.sha256(sprite.tobytes()).hexdigest()[:16]}

class Composite(BaseModel):
    owner:str=Field(min_length=1,max_length=200)
    equipped_job_ids:list[str]=Field(default_factory=list,max_length=11)
    tucked:bool=False
    scale:int=Field(default=1,ge=1,le=4)
    preview_placement:Placement|None=None
    preview_calibration:Calibration|None=None

@app.post('/api/v1/paperdoll/composite')
def composite(req:Composite):
    layers={}
    settings=avatar_settings(req.owner)
    avatar_choice=settings['choice']
    calibration=req.preview_calibration.model_dump() if req.preview_calibration else settings['calibration']
    details=item_details(req.owner)
    for jid in req.equipped_job_ids:
        job=owned(jid,req.owner)
        if job['status']!='complete': raise HTTPException(409,'A sprite is still being generated')
        meta=job.get('metadata') or {};slot=meta.get('slot')
        if meta.get('version')!=VERSION: raise HTTPException(409,'Regenerate legacy sprites for the new mannequin')
        if slot in layers: raise HTTPException(400,'Only one garment is allowed in each slot')
        adjustment=details.get(job['item_id'],{}).get('placement',{})
        if req.preview_placement is not None and len(req.equipped_job_ids)==1: adjustment=req.preview_placement.model_dump()
        if slot not in ('top','outer'): adjustment={**adjustment,'sleeve':100}
        with Image.open(job['paperdoll_sprite']) as im:
            layer=fit_default(im.convert('RGBA'),avatar_choice)
            if calibration:layer=warp(layer,settings['default_calibration'],calibration)
            layers[slot]=place_layer(layer,adjustment)
    result=base(req.owner)
    order=['socks','feet','bottom','top','mid','outer','belt','neck','head','bag','extra']
    if req.tucked: order=['top','socks','feet','bottom','mid','outer','belt','neck','head','bag','extra']
    for slot in order:
        if slot in layers: result.alpha_composite(layers[slot])
    return png(result.resize((220*req.scale,276*req.scale),Image.Resampling.NEAREST))
