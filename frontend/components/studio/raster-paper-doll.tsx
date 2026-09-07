'use client';
/* eslint-disable @next/next/no-img-element */
import {useEffect,useState} from 'react';
import type {Item} from '@/lib/types';
import {garmentLabel,slotFor,SLOT_LABEL,type Slot} from '@/lib/inventory';
import type {SpriteJob} from '@/lib/use-sprites';
export function RasterPaperDoll({items,jobs,generate,corrections,correct,userId,onEquip,wardrobe,placementRevision='',onAvatarChange}:{onAvatarChange?:()=>void;placementRevision?:string;items:Item[];jobs:Record<string,SpriteJob>;generate:(i:Item,force?:boolean)=>Promise<void>;corrections:Record<string,string>;correct:(id:string,v:string)=>void;userId:string;onEquip:(item:Item)=>void;wardrobe:Item[]}){
 const [url,setUrl]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[tucked,setTucked]=useState(false),[revision,setRevision]=useState(0);
 const [avatar,setAvatar]=useState(''),[hasPersonal,setHasPersonal]=useState(false),[avatarBusy,setAvatarBusy]=useState(false),[avatarNotice,setAvatarNotice]=useState('');
 useEffect(()=>{let stale=false;fetch('/api/inventory/sprites?kind=avatar-settings').then(async r=>{if(!r.ok)throw new Error('Could not load avatar choices');return r.json();}).then(d=>{if(!stale){setAvatar(d.choice);setHasPersonal(d.has_personal);}}).catch(e=>{if(!stale)setError(e.message);});return()=>{stale=true;};},[userId]);
 async function chooseAvatar(choice:string){setAvatarBusy(true);setError('');setAvatarNotice('');try{const r=await fetch('/api/inventory/sprites',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'avatar-select',choice})});const d=await r.json();if(!r.ok)throw new Error(d.error);setAvatar(d.choice);setHasPersonal(d.has_personal);setRevision(v=>v+1);onAvatarChange?.();}catch(e){setError(e instanceof Error?e.message:'Could not change avatar');}finally{setAvatarBusy(false);}}
 const jobIds=items.map(i=>jobs[i.id]).filter(j=>j?.status==='complete'&&j.metadata?.version==='portrait-v2.1').map(j=>j.job_id);
 const key=jobIds.join(',');
 useEffect(()=>{
  let stale=false;let objectUrl='';const abort=new AbortController();setBusy(true);setError('');
  async function compose(){try{
   const r=await fetch('/api/inventory/sprites',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'composite',jobs:jobIds,tucked}),signal:abort.signal});
   if(!r.ok){const e=await r.json();throw new Error(e.error);}
   const blob=await r.blob();if(stale)return;objectUrl=URL.createObjectURL(blob);setUrl(objectUrl);
  }catch(e){if(!stale)setError(e instanceof Error?e.message:'Preview unavailable');}finally{if(!stale)setBusy(false);}}
  void compose();return()=>{stale=true;abort.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};
 },[key,tucked,revision,userId,placementRevision]);
 async function upload(file:File){if(file.size>12*1024*1024){setError('Use an image under 12 MB');return;}setAvatarBusy(true);setAvatarNotice('');setError('');try{const form=new FormData();form.append('file',file);const r=await fetch('/api/inventory/sprites',{method:'POST',body:form});const data=await r.json();if(!r.ok)throw new Error(data.error);setAvatar('personal');setHasPersonal(true);setAvatarNotice('Your pixel likeness is ready.');setRevision(v=>v+1);onAvatarChange?.();}catch(e){setError(e instanceof Error?e.message:'Upload failed');}finally{setAvatarBusy(false);}}
 return <div className="ur-raster">
  <div className="ur-gump" aria-busy={busy}><div className="ur-gump-title">THE ADVENTURER</div>{url?<img src={url} alt="Pixel art mannequin wearing the generated clothing layers"/>:<p>Opening character sheet…</p>}<div className="ur-gump-pockets">{(['top','bottom','feet','outer','head','bag'] as Slot[]).map((slot,n)=>{const item=items.find(i=>slotFor(i)===slot);const job=item?jobs[item.id]:undefined;return <button key={slot} className={'ur-pocket ur-pocket-'+n} title={item?'Remove '+garmentLabel(item):SLOT_LABEL[slot]} onClick={()=>{if(item)onEquip(item);}} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();e.stopPropagation();const id=e.dataTransfer.getData('text/plain');const garment=wardrobe.find(i=>i.id===id);if(garment&&slotFor(garment)===slot){if(item?.id!==id)onEquip(garment);}else setError('Choose clothing for '+SLOT_LABEL[slot].toLowerCase());}}><span>{SLOT_LABEL[slot]}</span>{job?.status==='complete'?<div className="ur-pocket-content"><img src={`/api/inventory/sprites?id=${job.job_id}&kind=inventory&t=${job.updated_at||''}`} alt={item?garmentLabel(item):''}/></div>:<b>{item?'…':'＋'}</b>}</button>;})}</div><span className="ur-gump-count">{jobIds.length} / {items.length} SPRITES EQUIPPED</span></div>
  {error&&<p role="alert">{error}</p>}
  <label className="ur-tuck"><input type="checkbox" checked={tucked} onChange={e=>setTucked(e.target.checked)}/> Tuck shirt into trousers</label>
  <p className="ur-caption">Drop a garment on the character or a slot below. Each slot holds one piece.</p>
  <section className="ur-avatar-tools" aria-label="Avatar"><h3>Your avatar</h3><label>Starting appearance<select aria-label="Starting appearance" value={avatar} disabled={avatarBusy||!avatar} onChange={e=>void chooseAvatar(e.target.value)}>{!avatar&&<option value="">Loading choices…</option>}<option value="masculine">Masculine default</option><option value="feminine">Feminine default</option><option value="personal" disabled={!hasPersonal}>My uploaded likeness{!hasPersonal?' · upload below':''}</option></select></label><p>Make it yours: upload a front-facing, full-body photo, including your feet, with arms slightly away from your sides and a plain background. A fitted top and shorts work well.</p><label className="ur-upload">{avatarBusy?'Preparing avatar…':'Upload photo & create pixel avatar'}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={avatarBusy} onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file);e.target.value='';}}/></label><p>PNG, JPEG or WebP · up to 12 MB. Converted on your server. Your pose is preserved, so matching the default stance helps clothes line up. Switching defaults keeps your uploaded likeness.</p>{avatarNotice&&<p role="status">{avatarNotice}</p>}</section>
  <details className="ur-sprite-tools"><summary>Clothing sprites &amp; cut details</summary>
   <p>Generate missing sprites, or correct a cut and regenerate. These details also guide realistic estimates.</p>
   {items.map(i=>{const job=jobs[i.id];const active=job&&!['complete','failed'].includes(job.status);return <div className="ur-sprite-row" key={i.id}><strong>{garmentLabel(i)}</strong><small>{job?.message||'Sprite not generated yet'}</small><label>Cut &amp; details<input maxLength={400} value={corrections[i.id]||''} placeholder="e.g. flared legs, high waist, corduroy" onChange={e=>correct(i.id,e.target.value)}/></label><button disabled={!!active} onClick={()=>generate(i,true)}>{active?'Generating…':job?'Regenerate sprite':'Generate sprite'}</button></div>;})}
  </details>

 </div>;
}
