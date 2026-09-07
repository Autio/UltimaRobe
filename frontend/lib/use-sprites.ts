'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {Item} from '@/lib/types';
export type SpriteJob={job_id:string;item_id:string;status:string;message:string;updated_at?:number;user_hint?:{correction?:string;cut_details?:string;primary_color?:string;pattern?:string};metadata?:{version?:string;cut_details?:string;primary_color?:string;pattern?:string}};
export function useSprites(userId?:string){
 const [jobs,setJobs]=useState<Record<string,SpriteJob>>({}),[error,setError]=useState('');
 const [corrections,setCorrections]=useState<Record<string,string>>({});
 const pending=useRef(new Set<string>());
 const refresh=useCallback(async()=>{
  if(!userId)return;
  try{const r=await fetch('/api/inventory/sprites');const data=await r.json();if(!r.ok)throw new Error(data.error);
   setCorrections(old=>{const next={...old};for(const j of data as SpriteJob[])if(next[j.item_id]===undefined&&j.user_hint?.correction)next[j.item_id]=j.user_hint.correction;return next;});
   setError('');
   setJobs(Object.fromEntries((data as SpriteJob[]).map(j=>[j.item_id,j])));
  }catch(e){setError(e instanceof Error?e.message:'Could not load sprites');}
 },[userId]);
 useEffect(()=>{setJobs({});setCorrections({});pending.current.clear();if(!userId)return;
  try{setCorrections(JSON.parse(localStorage.getItem('ultimarobe-cuts:'+userId)||'{}'));}catch{}
  void refresh();const timer=setInterval(refresh,5000);return()=>clearInterval(timer);
 },[userId,refresh]);
 function correct(id:string,value:string){setCorrections(old=>{const next={...old,[id]:value};if(userId)localStorage.setItem('ultimarobe-cuts:'+userId,JSON.stringify(next));return next;});}
 async function generate(item:Item,force=false,overrides?:Record<string,any>){
  if(pending.current.has(item.id))return;pending.current.add(item.id);setError('');
  try{const r=await fetch('/api/inventory/sprites',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:item.id,force,correction:typeof overrides?.cut_details==='string'?overrides.cut_details:corrections[item.id]||'',overrides:overrides||{}})});const j=await r.json();if(!r.ok)throw new Error(j.error);setJobs(old=>({...old,[item.id]:j}));}
  catch(e){setError(e instanceof Error?e.message:'Generation failed');}
  finally{pending.current.delete(item.id);}
 }
 return {jobs,error,generate,refresh,corrections,correct};
}

