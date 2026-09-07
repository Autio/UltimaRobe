'use client';
/* eslint-disable @next/next/no-img-element */
import {useEffect,useState} from 'react';
import {defaultPlacement,type ItemDetail,type Placement} from '@/lib/use-item-details';
import {slotFor} from '@/lib/inventory';
import type {Item} from '@/lib/types';
export function PlacementEditor({item,jobId,detail,onSave}:{item:Item;jobId?:string;detail?:ItemDetail;onSave:(id:string,d:ItemDetail)=>Promise<void>}){
 const [p,setP]=useState<Placement>(detail?.placement||defaultPlacement),[url,setUrl]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{if(!jobId)return;let stale=false;let objectUrl='';const controller=new AbortController();
 const timer=setTimeout(()=>{fetch('/api/inventory/sprites',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'composite',jobs:[jobId],previewPlacement:p}),signal:controller.signal}).then(async r=>{if(!r.ok)throw new Error('Placement preview unavailable');return r.blob();}).then(b=>{if(!stale){objectUrl=URL.createObjectURL(b);setUrl(objectUrl);}}).catch(e=>{if(!stale)setMessage(e.message);});},200);
 return()=>{stale=true;clearTimeout(timer);controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};},[jobId,p]);
 const sleeves=['top','outer'].includes(slotFor(item));
 async function save(){setBusy(true);setMessage('');try{await onSave(item.id,{enchanted_name:detail?.enchanted_name||'',lore:detail?.lore||'',placement:p});setMessage('Placement saved. It will survive sprite regeneration.');}catch(e){setMessage(e instanceof Error?e.message:'Save failed');}finally{setBusy(false);}}
 return <section className="ur-placement"><h4>Fit the pixel layer</h4><p>Preview this garment on your avatar. Changes apply when saved.</p><div className="ur-placement-canvas">{url&&<img src={url} alt="Preview of adjusted garment placement"/>}</div><div>{([['x','Left / right',-12,12,'px'],['y','Up / down',-12,12,'px'],['width','Width',80,120,'%'],...(sleeves?[['sleeve','Sleeve length',80,120,'%']]:[])] as [keyof Placement,string,number,number,string][]).map(([key,label,min,max,unit])=><label key={key}>{label}: {p[key]}{unit}<input type="range" min={min} max={max} value={p[key]} onChange={e=>{setP({...p,[key]:Number(e.target.value)});setMessage('');}}/></label>)}</div><button type="button" onClick={()=>{setP({...defaultPlacement});setMessage('Defaults restored in preview. Save to apply.');}}>Reset placement</button><button type="button" disabled={busy||!jobId} onClick={save}>{busy?'Saving…':'Save placement'}</button><p role="status">{message}</p></section>;
}
