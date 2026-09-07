import {NextRequest,NextResponse} from 'next/server';
import {getServerSession} from 'next-auth';
import {authOptions} from '@/lib/auth';
import {garmentDetails} from '@/lib/garment-details';
import type {Item} from '@/lib/types';
export const dynamic='force-dynamic';
const root=()=>process.env.SPRITEFY_URL;
const headers=()=>({'X-Spritefy-Key':process.env.SPRITEFY_KEY||''});
async function forward(path:string,init:RequestInit={}) {
 const r=await fetch(`${root()}${path}`,{...init,headers:{...headers(),...init.headers},cache:'no-store',signal:AbortSignal.timeout(120000)});
 if(r.headers.get('content-type')?.includes('image/png'))return new NextResponse(await r.arrayBuffer(),{status:r.status,headers:{'Content-Type':'image/png','Cache-Control':'private, no-store'}});
 const data=await r.json();return NextResponse.json(r.ok?data:{error:data.detail||'Sprite request failed'},{status:r.status,headers:{'Cache-Control':'private, no-store'}});
}
export async function GET(req:NextRequest){
 const s=await getServerSession(authOptions);
 if(!s?.accessToken||!s.user?.id)return NextResponse.json({error:'Sign in first'},{status:401});
 if(!root())return NextResponse.json({error:'Sprite engine is unavailable'},{status:503});
 const owner=encodeURIComponent(s.user.id),id=req.nextUrl.searchParams.get('id'),kind=req.nextUrl.searchParams.get('kind');
 if(id&&!/^[a-f0-9]{32}$/.test(id))return NextResponse.json({error:'Invalid sprite'},{status:400});
 if(kind&&!['avatar','avatar-settings','details','inventory','paperdoll'].includes(kind))return NextResponse.json({error:'Invalid image'},{status:400});
 try{return await forward(kind==='details'?`/api/v1/details?owner=${owner}`:kind==='avatar-settings'?`/api/v1/avatar/settings?owner=${owner}`:kind==='avatar'?`/api/v1/avatar/base?owner=${owner}`:id?`/api/v1/jobs/${id}${kind?'/'+kind:''}?owner=${owner}`:`/api/v1/jobs?owner=${owner}`);}catch{return NextResponse.json({error:'Sprite engine is unavailable'},{status:503});}
}
export async function POST(req:NextRequest){
 if(req.headers.get('origin')!==new URL(process.env.NEXTAUTH_URL||req.url).origin)return NextResponse.json({error:'Invalid origin'},{status:403});
 const s=await getServerSession(authOptions);
 if(!s?.accessToken||!s.user?.id)return NextResponse.json({error:'Sign in first'},{status:401});
 if(!root())return NextResponse.json({error:'Sprite engine is unavailable'},{status:503});
 try{
  if(req.headers.get('content-type')?.includes('multipart/form-data')){
   if(Number(req.headers.get('content-length')||0)>13*1024*1024)return NextResponse.json({error:'Use an image under 12 MB'},{status:413});
   const form=await req.formData(),file=form.get('file');
   if(!(file instanceof Blob)||file.size>12*1024*1024)return NextResponse.json({error:'Use an image under 12 MB'},{status:400});
   const data=new FormData();data.append('owner',s.user.id);data.append('file',file,'avatar.png');
   return await forward('/api/v1/avatar',{method:'POST',body:data});
  }
  const body=await req.json();
  if(body.action==='avatar-calibration')return await forward('/api/v1/avatar/calibration',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({owner:s.user.id,choice:body.choice,calibration:body.calibration})});
  if(body.action==='avatar-select'){
   if(!['masculine','feminine','personal'].includes(body.choice))return NextResponse.json({error:'Invalid avatar choice'},{status:400});
   return await forward('/api/v1/avatar/select',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({owner:s.user.id,choice:body.choice})});
  }
  if(body.action==='composite'){
   if(!Array.isArray(body.jobs)||body.jobs.length>11||body.jobs.some((v:unknown)=>typeof v!=='string'||!/^[a-f0-9]{32}$/.test(v)))return NextResponse.json({error:'Invalid equipped sprites'},{status:400});
   return await forward('/api/v1/paperdoll/composite',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({owner:s.user.id,equipped_job_ids:body.jobs,tucked:body.tucked===true,scale:2,preview_placement:body.previewPlacement,preview_calibration:body.previewCalibration})});
  }
  if(typeof body.id!=='string'||!/^[a-f0-9-]{36}$/i.test(body.id))return NextResponse.json({error:'Invalid garment'},{status:400});
  const backend=process.env.BACKEND_URL||'http://backend:8000';
  const response=await fetch(`${backend}/api/v1/items/${body.id}`,{headers:{Authorization:`Bearer ${s.accessToken}`},cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!response.ok)return NextResponse.json({error:'Garment unavailable'},{status:404});
  const item=await response.json() as Item;
  if(item.is_archived)return NextResponse.json({error:'Garment archived'},{status:400});
  if(body.action==='sprite-select'){
   if(typeof body.jobId!=='string'||!/^[a-f0-9]{32}$/.test(body.jobId))return NextResponse.json({error:'Invalid sprite'},{status:400});
   return await forward('/api/v1/jobs/select',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({owner:s.user.id,item_id:item.id,job_id:body.jobId,dismiss:body.dismiss===true})});
  }
  if(body.action==='details-save')return await forward('/api/v1/details',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({owner:s.user.id,item_id:item.id,placement:body.placement,enchanted_name:body.enchanted_name||'',lore:body.lore||''})});
  const source=item.image_url;
  if(!source?.startsWith('/api/v1/images/')||source.includes('..'))throw new Error('Invalid source');
  const photo=await fetch(`${backend}${source}`,{headers:{Authorization:`Bearer ${s.accessToken}`},signal:AbortSignal.timeout(15000)});
  if(!photo.ok)throw new Error('Source unavailable');
  const form=new FormData();form.append('file',await photo.blob(),'garment.png');form.append('owner',s.user.id);form.append('item_id',item.id);
  form.append('force',body.force===true?'true':'false');
  const overrides:Record<string,string>={};
  for(const key of ['cut_details','primary_color','pattern','material','fit'])if(typeof body.overrides?.[key]==='string')overrides[key]=body.overrides[key].slice(0,key==='cut_details'?400:80);
  form.append('user_hint',JSON.stringify(garmentDetails(item,typeof body.correction==='string'?body.correction.slice(0,400):'',overrides)));
  return await forward('/api/v1/jobs',{method:'POST',body:form});
 }catch{return NextResponse.json({error:'Could not reach the sprite engine or source photograph. Try again.'},{status:503});}
}
