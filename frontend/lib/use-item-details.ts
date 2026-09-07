'use client';
import {useEffect,useState} from 'react';
export type Placement={x:number;y:number;width:number;sleeve:number};
export type ItemDetail={placement:Placement;enchanted_name:string;lore:string};
export const defaultPlacement:Placement={x:0,y:0,width:100,sleeve:100};
export function useItemDetails(userId?:string){
 const [details,setDetails]=useState<Record<string,ItemDetail>>({}),[loaded,setLoaded]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let stale=false;setDetails({});setLoaded(false);if(!userId)return;
 fetch('/api/inventory/sprites?kind=details').then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);if(!stale){setDetails(d);setLoaded(true);setError('');}}).catch(e=>{if(!stale)setError(String(e.message));});return()=>{stale=true;};},[userId]);
 async function save(id:string,detail:ItemDetail){
  const r=await fetch('/api/inventory/sprites',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'details-save',id,...detail})});const d=await r.json();
  if(!r.ok)throw new Error(typeof d.error==='string'?d.error:'Could not save item details.');
  setDetails(old=>({...old,[id]:d}));
 }
 return {details,loaded,error,save};
}
