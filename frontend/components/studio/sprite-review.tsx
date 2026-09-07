'use client';
/* eslint-disable @next/next/no-img-element */
import {useState} from 'react';
import type {SpriteJob} from '@/lib/use-sprites';
export function SpriteReview({job}:{job?:SpriteJob}){
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const candidate=job?.candidate;
 if(!candidate)return null;
 async function choose(dismiss:boolean){setBusy(true);setNotice('');try{const r=await fetch('/api/inventory/sprites',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'sprite-select',id:job!.item_id,jobId:candidate!.job_id,dismiss})});if(!r.ok)throw Error('Could not update this sprite.');window.dispatchEvent(new Event('ultimarobe:sprites'));setNotice(dismiss?'Kept your current sprite.':'New sprite accepted.');}catch(e){setNotice(e instanceof Error?e.message:'Could not save');}finally{setBusy(false);}}
 return <section className="ur-sprite-review" aria-label="Review regenerated sprite"><h4>Review new sprite</h4><p>Your current sprite stays equipped until you accept this replacement.</p>{candidate.status==='complete'?<div style={{display:'flex',gap:16}}>{[job!,candidate].map((j,i)=><figure key={j.job_id}><img src={`/api/inventory/sprites?id=${j.job_id}&kind=paperdoll`} alt={i?'Proposed clothing sprite':'Current clothing sprite'} width={110} height={138} style={{imageRendering:'pixelated'}}/><figcaption>{i?'Proposed':'Current'}</figcaption></figure>)}</div>:<p>{candidate.message}</p>}<button disabled={busy||candidate.status!=='complete'} onClick={()=>void choose(false)}>Use new sprite</button><button disabled={busy} onClick={()=>void choose(true)}>Keep current sprite</button>{notice&&<p role="status">{notice}</p>}</section>;
}
