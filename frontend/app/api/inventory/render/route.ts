import {NextRequest,NextResponse} from 'next/server';
import {getServerSession} from 'next-auth';
import {authOptions} from '@/lib/auth';
import {createHash} from 'crypto';
import {describeGarment} from '@/lib/garment-details';
import {parseMeasurements,measurementPrompt} from '@/lib/body-measurements';
import type {Item} from '@/lib/types';

export const dynamic='force-dynamic';
const renderUrl=()=>process.env.IMAGE_RENDER_URL;
const headers=()=>({'Content-Type':'application/json','X-Render-Key':process.env.IMAGE_RENDER_KEY||''});
export async function POST(req:NextRequest){
 const origin=req.headers.get('origin');
 if(!origin||origin!==new URL(process.env.NEXTAUTH_URL||req.url).origin)return NextResponse.json({error:'Invalid request origin.'},{status:403});
 const session=await getServerSession(authOptions);
 if(!session?.accessToken||!session.user?.id)return NextResponse.json({error:'Please sign in.'},{status:401});
 if(!renderUrl())return NextResponse.json({error:'The local renderer is not configured.'},{status:503});
 try{
  const body=await req.json();
  if(!Array.isArray(body.ids)||!body.ids.length||body.ids.length>11||body.ids.some((id:unknown)=>typeof id!=='string'||!/^[a-f0-9-]{36}$/i.test(id)))return NextResponse.json({error:'Choose between 1 and 11 garments.'},{status:400});
  let measurements;try{measurements=parseMeasurements(body.measurements);}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Invalid measurements.'},{status:400});}
  const ids=Array.from(new Set<string>(body.ids));
  const backend=process.env.BACKEND_URL||'http://backend:8000';
  const responses=await Promise.all(ids.map(id=>fetch(`${backend}/api/v1/items/${id}`,{headers:{Authorization:`Bearer ${session.accessToken}`},cache:'no-store',signal:AbortSignal.timeout(15000)})));
  if(responses.some(r=>!r.ok))return NextResponse.json({error:'Some selected clothes are unavailable.'},{status:400});
  const items=await Promise.all(responses.map(r=>r.json())) as Item[];
  if(items.some(i=>i.is_archived))return NextResponse.json({error:'Some selected clothes are archived.'},{status:400});
  const corrections=body.corrections&&typeof body.corrections==='object'?body.corrections:{};
  let spriteJobs:any[]=[];
  let reference:string|undefined;
  let avatarChoice='personal';
  if(process.env.SPRITEFY_URL){
   try{const r=await fetch(`${process.env.SPRITEFY_URL}/api/v1/jobs?owner=${encodeURIComponent(session.user.id)}`,{headers:{'X-Spritefy-Key':process.env.SPRITEFY_KEY||''},signal:AbortSignal.timeout(3000),cache:'no-store'});
    if(r.ok){spriteJobs=await r.json();}
    const a=await fetch(`${process.env.SPRITEFY_URL}/api/v1/avatar/settings?owner=${encodeURIComponent(session.user.id)}`,{headers:{'X-Spritefy-Key':process.env.SPRITEFY_KEY||''},signal:AbortSignal.timeout(3000),cache:'no-store'});
    if(a.ok)avatarChoice=(await a.json()).choice;
    for(const job of spriteJobs)if(!corrections[job.item_id]&&job.metadata?.cut_details)corrections[job.item_id]=String(job.metadata.cut_details).slice(0,400);
   }catch{/* Wardrobe metadata remains available if the sprite service is offline. */}
  }
  const equipped=items.map(i=>spriteJobs.find(j=>j.item_id===i.id&&j.status==='complete'));
  if(equipped.every(Boolean)&&process.env.SPRITEFY_URL){
   try{const r=await fetch(`${process.env.SPRITEFY_URL}/api/v1/paperdoll/composite`,{method:'POST',headers:{'Content-Type':'application/json','X-Spritefy-Key':process.env.SPRITEFY_KEY||''},body:JSON.stringify({owner:session.user.id,equipped_job_ids:equipped.map(j=>j.job_id),scale:1}),signal:AbortSignal.timeout(10000)});if(r.ok)reference=Buffer.from(await r.arrayBuffer()).toString('base64');}catch{}
  }
  const garments=items.map(i=>describeGarment(i,typeof corrections[i.id]==='string'?corrections[i.id].slice(0,400):'').slice(0,260)).join('; ');
  const tone=/^#[0-9a-f]{6}$/i.test(body.skin||'')?body.skin:'#ba8664';
  const hair=/^#[0-9a-f]{6}$/i.test(body.hair||'')?body.hair:'#423128';
  const toneValue=parseInt(tone.slice(1,3),16);
  const skinWords=toneValue<100?'dark skin':toneValue<180?'medium brown skin':'light tan skin';
  const hairWords=parseInt(hair.slice(1,3),16)>170?'light hair':'dark hair';
  const subject=avatarChoice==='feminine'?'adult woman':avatarChoice==='masculine'?'adult man':'adult person matching the reference avatar';
  const prompt=`Full body fashion photograph, one ${subject} with ${skinWords} and short ${hairWords}, wearing ${garments}.${measurementPrompt(measurements)} Preserve the specified garment cuts, leg flare, sleeve lengths and fabric texture. Standing front-facing with feet apart, uncrossed legs, full head and shoes visible, neutral studio backdrop, natural proportions, soft daylight, detailed clothing, editorial photography.`;
  const fingerprint=createHash('sha256').update(JSON.stringify({ids:[...ids].sort(),tone,hair,garments,measurements,avatarChoice,avatarReference:reference?createHash('sha256').update(reference).digest('hex'):null,guide:equipped.map(j=>j?.job_id)})).digest('hex');
  const result=await fetch(`${renderUrl()}/jobs`,{method:'POST',headers:headers(),body:JSON.stringify({owner:session.user.id,prompt,fingerprint,reference}),signal:AbortSignal.timeout(10000)});
  const payload=await result.json();
  return NextResponse.json(result.ok?payload:{error:payload.detail||'The renderer is busy.'},{status:result.status});
 }catch{return NextResponse.json({error:'The local renderer is unavailable. Try again shortly.'},{status:503});}
}
export async function GET(req:NextRequest){
 const session=await getServerSession(authOptions);
 if(!session?.accessToken||!session.user?.id)return NextResponse.json({error:'Please sign in.'},{status:401});
 if(!renderUrl())return NextResponse.json({error:'Renderer unavailable.'},{status:503});
 const id=req.nextUrl.searchParams.get('id');
 if(!id||!/^[a-f0-9]{32}$/.test(id))return NextResponse.json({error:'Invalid render.'},{status:400});
 const image=req.nextUrl.searchParams.get('image')==='1';
 try{
  const result=await fetch(`${renderUrl()}/jobs/${id}${image?'/image':''}?owner=${encodeURIComponent(session.user.id)}`,{headers:headers(),cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!result.ok)return NextResponse.json({error:'Render not available.'},{status:result.status});
  if(image)return new NextResponse(await result.arrayBuffer(),{headers:{'Content-Type':'image/png','Cache-Control':'private, no-store'}});
  return NextResponse.json(await result.json(),{headers:{'Cache-Control':'private, no-store'}});
 }catch{return NextResponse.json({error:'The local renderer is unavailable.'},{status:503});}
}
