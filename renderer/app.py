"""Local SDXL outfit estimates. Private service; the Next.js route authenticates users."""
import gc
import base64
import io
from PIL import Image
import fcntl
import hashlib
import json
import os
import secrets
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

ROOT = Path(os.environ.get('RENDER_DATA', '/opt/ultimarobe-renderer/data'))
ROOT.mkdir(parents=True, exist_ok=True)
TOKEN = os.environ['RENDER_KEY']
MODEL = os.environ.get('RENDER_MODEL', 'stabilityai/stable-diffusion-xl-base-1.0')
jobs = {}
lock = threading.Lock()
pool = ThreadPoolExecutor(max_workers=1)
pipeline = None
app = FastAPI(docs_url=None, redoc_url=None)

def authorize(x_render_key: str = Header(default='')):
    if not secrets.compare_digest(x_render_key, TOKEN):
        raise HTTPException(401, 'Unauthorized')

class RenderRequest(BaseModel):
    owner: str = Field(min_length=1, max_length=200)
    prompt: str = Field(min_length=10, max_length=4000)
    fingerprint: str = Field(pattern=r'^[a-f0-9]{64}$')
    reference: str | None = Field(default=None, max_length=2_000_000)

def persist(job):
    target = ROOT / (job['id'] + '.json')
    tmp = target.with_suffix('.tmp')
    with tmp.open('w') as stream:
        stream.write(json.dumps(job));stream.flush();os.fsync(stream.fileno())
    tmp.replace(target)

def render(job_id):
    global pipeline
    job = jobs[job_id]
    lease = open(os.environ.get('AI_LOCK_PATH', '/shared/ai-work.lock'), 'a')
    try:
        fcntl.flock(lease, fcntl.LOCK_EX)
        import torch
        torch.set_grad_enabled(False)
        free, _ = torch.cuda.mem_get_info()
        if free < 18 * 1024 ** 3:
            raise RuntimeError('At least 18 GB of free GPU memory is needed. Unload other idle image models and try again.')
        from diffusers import StableDiffusionXLPipeline
        job.update(status='loading', message='Loading the local image model')
        persist(job)
        if pipeline is None:
            pipeline = StableDiffusionXLPipeline.from_pretrained(
                MODEL, torch_dtype=torch.float16, variant='fp16', use_safetensors=True,
                local_files_only=os.environ.get('HF_HUB_OFFLINE', '0') == '1')
            pipeline.enable_vae_slicing()
            pipeline.enable_vae_tiling()
            pipeline.set_progress_bar_config(disable=True)
        free, _ = torch.cuda.mem_get_info()
        if free < 11 * 1024 ** 3:
            raise RuntimeError('The GPU is busy. Pause other image or compute jobs and try again.')
        pipeline.to('cuda')
        job.update(status='rendering', message='Rendering your outfit')
        persist(job)
        generator = torch.Generator(device='cuda').manual_seed(job['seed'])
        # SDXL silently truncates ordinary text at 77 tokens. Encode all garment
        # detail chunks so later trousers/shoes are not lost from long outfits.
        tokens = pipeline.tokenizer(job['prompt'], add_special_tokens=False).input_ids
        positives, negatives, pooled = [], [], None
        for start in range(0, min(len(tokens), 1200), 75):
            chunk = pipeline.tokenizer.decode(tokens[start:start+75])
            pos, neg, pp, npool = pipeline.encode_prompt(
                prompt=chunk, device='cuda', do_classifier_free_guidance=True,
                negative_prompt='cropped head, cropped feet, multiple people, cartoon, text, watermark, deformed body')
            positives.append(pos); negatives.append(neg)
            if pooled is None: pooled = (pp, npool)
        render_pipe = pipeline
        extra = {'width':768, 'height':1152}
        reference_path = ROOT / (job_id + '-guide.png')
        if reference_path.exists():
            from diffusers import StableDiffusionXLImg2ImgPipeline
            render_pipe = StableDiffusionXLImg2ImgPipeline(**pipeline.components)
            render_pipe.set_progress_bar_config(disable=True)
            extra = {'image':Image.open(reference_path).convert('RGB'), 'strength':0.68}
        image = render_pipe(
            prompt_embeds=torch.cat(positives, dim=1),
            negative_prompt_embeds=torch.cat(negatives, dim=1),
            pooled_prompt_embeds=pooled[0], negative_pooled_prompt_embeds=pooled[1],
            **extra, num_inference_steps=36, guidance_scale=7,
            generator=generator,
        ).images[0]
        image.save(ROOT / (job_id + '.png'))
        job.update(status='complete', message='Estimate ready', completed_at=time.time())
    except Exception as exc:
        print(f'Render {job_id} failed: {type(exc).__name__}: {exc}', flush=True)
        message=str(exc) if 'free GPU memory' in str(exc) else 'The local renderer could not finish. The GPU may be busy; try again.'
        job.update(status='failed', message=message)
    finally:
        if pipeline is not None:
            try: pipeline.to('cpu')
            except Exception: pipeline = None
        gc.collect()
        try:
            import torch
            torch.cuda.empty_cache()
        except Exception:
            pass
        persist(job)
        lease.close()

@app.get('/health', dependencies=[Depends(authorize)])
def health():
    return {'status': 'ready', 'model': MODEL}

@app.post('/jobs', status_code=202, dependencies=[Depends(authorize)])
def create_job(request: RenderRequest):
    with lock:
        active = [j for j in jobs.values() if j['status'] in ('queued', 'loading', 'rendering')]
        if any(j['owner'] == request.owner for j in active):
            raise HTTPException(409, 'Your previous estimate is still running.')
        if len(active) >= 3:
            raise HTTPException(429, 'The renderer queue is full. Try again shortly.')
        job_id = uuid.uuid4().hex
        job = dict(id=job_id, owner=request.owner, prompt=request.prompt, fingerprint=request.fingerprint,
                   status='queued', message='Waiting for the GPU', seed=secrets.randbelow(2**31),
                   created_at=time.time(), model=MODEL, steps=28, width=768, height=1152)
        if request.reference:
            try:
                guide=Image.open(io.BytesIO(base64.b64decode(request.reference,validate=True))).convert('RGBA')
                if guide.size not in ((220,276),(440,552)): raise ValueError('Unexpected guide size')
                guide=guide.resize((220,276),Image.Resampling.NEAREST).crop((45,0,175,276)).resize((510,1080),Image.Resampling.BICUBIC)
                canvas=Image.new('RGB',(768,1152),(160,157,150));canvas.paste(guide,(129,36),guide)
                with (ROOT/(job_id+'-guide.png')).open('wb') as stream:
                    canvas.save(stream,format='PNG');stream.flush();os.fsync(stream.fileno())
                job['guided']=True
            except Exception: raise HTTPException(400,'Invalid outfit guide')
        jobs[job_id] = job
        persist(job)
        pool.submit(render, job_id)
        return public_job(job)

def get_job(job_id, owner):
    if len(job_id) != 32 or any(c not in '0123456789abcdef' for c in job_id):
        raise HTTPException(404, 'Not found')
    job = jobs.get(job_id)
    if job is None:
        try:
            job = json.loads((ROOT / (job_id + '.json')).read_text())
        except (FileNotFoundError, ValueError):
            raise HTTPException(404, 'Not found')
        if job['status'] in ('queued', 'loading', 'rendering'):
            job.update(status='failed', message='The renderer restarted. Please generate again.')
    if job['owner'] != owner:
        raise HTTPException(404, 'Not found')
    return job

def public_job(job):
    return {k: job[k] for k in ('id', 'status', 'message', 'fingerprint')}

@app.get('/jobs/{job_id}', dependencies=[Depends(authorize)])
def status(job_id: str, owner: str):
    return public_job(get_job(job_id, owner))

@app.get('/jobs/{job_id}/image', dependencies=[Depends(authorize)])
def result(job_id: str, owner: str):
    job = get_job(job_id, owner)
    if job['status'] != 'complete':
        raise HTTPException(409, 'Image not ready')
    return FileResponse(ROOT / (job_id + '.png'), media_type='image/png', headers={'Cache-Control':'private, no-store'})
