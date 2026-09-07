'use client';
/* eslint-disable @next/next/no-img-element */
import {useEffect,useState} from 'react';
import type {Item} from '@/lib/types';
import type {SpriteJob} from '@/lib/use-sprites';
import {garmentLabel} from '@/lib/inventory';
import {RealisticPreview} from './realistic-preview';
type Pin={id:string;name:string;ids:string[]};
function PixelComparison({items,jobs,revision}:{items:Item[];jobs:Record<string,SpriteJob>;revision:string}){
 const [url,setUrl]=useState(''),[error,setError]=useState('');
 const ids=items.map(i=>jobs[i.id]).filter(j=>j?.status==='complete').map(j=>j.job_id);
 const key=JSON.stringify(ids);
 useEffect(()=>{let stale=false;let objectUrl='';const controller=new AbortController();setError('');
 fetch('/api/inventory/sprites',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'composite',jobs:ids}),signal:controller.signal}).then(async r=>{if(!r.ok)throw new Error('Pixel preview unavailable');return r.blob();}).then(b=>{if(!stale){objectUrl=URL.createObjectURL(b);setUrl(objectUrl);}}).catch(e=>{if(!stale)setError(e.message);});return()=>{stale=true;controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};},[key,revision]);
 return <><div className="ur-comparison-canvas">{url&&<img className="ur-comparison-pixel" src={url} alt="Pinned outfit on your current avatar"/>}</div>{ids.length<items.length&&<p>Some garments need sprites before they appear here.</p>}{error&&<p role="alert">{error}</p>}</>;
}
export function OutfitComparison({userId,selected,wardrobe,name,jobs,revision,skin,hair,corrections,onLoad}:{userId:string;selected:Item[];wardrobe:Item[];name:string;jobs:Record<string,SpriteJob>;revision:string;skin:string;hair:string;corrections:Record<string,string>;onLoad:(items:Item[],name:string)=>void}){
 const [pins,setPins]=useState<Pin[]>([]),[ready,setReady]=useState(false),[views,setViews]=useState<Record<string,string>>({});
 const storage='ultimarobe-comparison:'+userId;
 useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem(storage)||'[]');if(Array.isArray(saved))setPins(saved.filter(p=>typeof p.id==='string'&&typeof p.name==='string'&&Array.isArray(p.ids)&&p.ids.every((id:unknown)=>typeof id==='string')).slice(0,3));}catch{}setReady(true);},[storage]);
 useEffect(()=>{if(ready)try{localStorage.setItem(storage,JSON.stringify(pins));}catch{}},[pins,ready,storage]);
 function pin(){if(!selected.length||pins.length>=3)return;setPins([...pins,{id:crypto.randomUUID(),name:name.trim()||`Outfit ${pins.length+1}`,ids:selected.map(i=>i.id)}]);}
 return <section className="ur-panel ur-comparison"><header><h2>Compare adventures</h2><button disabled={!ready||!selected.length||pins.length>=3} onClick={pin}>＋ Pin current outfit ({pins.length}/3)</button></header><p>Pin up to three outfits. Your pins are saved in this browser. Each uses your current avatar and saved garment adjustments.</p><div className="ur-comparison-grid">{pins.map(pin=>{const items=pin.ids.map(id=>wardrobe.find(i=>i.id===id)).filter((i):i is Item=>!!i);return <article key={pin.id}><header><input aria-label="Comparison outfit name" maxLength={100} value={pin.name} onChange={e=>setPins(pins.map(p=>p.id===pin.id?{...p,name:e.target.value}:p))}/><button aria-label={`Remove ${pin.name} from comparison`} onClick={()=>setPins(pins.filter(p=>p.id!==pin.id))}>×</button></header><div className="ur-tabs"><button aria-pressed={views[pin.id]!=='realistic'} onClick={()=>setViews({...views,[pin.id]:'pixel'})}>Pixel</button><button aria-pressed={views[pin.id]==='realistic'} onClick={()=>setViews({...views,[pin.id]:'realistic'})}>Realistic</button></div>{views[pin.id]==='realistic'?<RealisticPreview items={items} userId={userId} skin={skin} hair={hair} corrections={corrections} storageSuffix={pin.id} appearanceRevision={revision}/>:<PixelComparison items={items} jobs={jobs} revision={revision}/>}<p>{items.map(garmentLabel).join(' · ')}</p>{items.length!==pin.ids.length&&<p>Some pinned garments are no longer available.</p>}<button disabled={!items.length} onClick={()=>onLoad(items,pin.name)}>Wear this outfit</button></article>;})}</div>{!pins.length&&<p>Equip an outfit above, then pin it here to compare.</p>}</section>;
}
