'use client';
/* eslint-disable @next/next/no-img-element */
import {useEffect,useState,useId} from 'react';
import {parseMeasurements,BUILDS} from '@/lib/body-measurements';
import type {Item} from '@/lib/types';
type Job={id:string;status:string;message:string;key:string};
export function RealisticPreview({items,skin,hair,userId,corrections={},storageSuffix='',appearanceRevision=''}:{storageSuffix?:string;appearanceRevision?:string;items:Item[];skin:string;hair:string;userId:string;corrections?:Record<string,string>}){
 const [job,setJob]=useState<Job|null>(null),[error,setError]=useState(''),[submitting,setSubmitting]=useState(false),[loaded,setLoaded]=useState(false);
 const [height,setHeight]=useState(''),[weight,setWeight]=useState(''),[measurementsLoaded,setMeasurementsLoaded]=useState(false);
 const [shoulder,setShoulder]=useState(''),[waist,setWaist]=useState(''),[build,setBuild]=useState('');
 const measurementSource=useId();
 const measurementStorage='ultimarobe-measurements:'+userId;
 useEffect(()=>{function load(event?:Event){if(event instanceof CustomEvent&&event.detail===measurementSource)return;setHeight('');setWeight('');setShoulder('');setWaist('');setBuild('');try{const m=parseMeasurements(JSON.parse(localStorage.getItem(measurementStorage)||'null'));setHeight(m.heightCm===undefined?'':String(m.heightCm));setWeight(m.weightKg===undefined?'':String(m.weightKg));setShoulder(m.shoulderCm===undefined?'':String(m.shoulderCm));setWaist(m.waistCm===undefined?'':String(m.waistCm));setBuild(m.build||'');}catch{}setMeasurementsLoaded(true);}load();window.addEventListener(measurementStorage,load);window.addEventListener('storage',load);return()=>{window.removeEventListener(measurementStorage,load);window.removeEventListener('storage',load);};},[measurementStorage,measurementSource]);
 const rawMeasurements={heightCm:height===''?undefined:Number(height),weightKg:weight===''?undefined:Number(weight),shoulderCm:shoulder===''?undefined:Number(shoulder),waistCm:waist===''?undefined:Number(waist),build};
 let measurementError='';try{parseMeasurements(rawMeasurements);}catch(e){measurementError=e instanceof Error?e.message:'Check your measurements.';}
 useEffect(()=>{if(measurementsLoaded&&!measurementError)try{const data=JSON.stringify(parseMeasurements(rawMeasurements));if(localStorage.getItem(measurementStorage)!==data){localStorage.setItem(measurementStorage,data);window.dispatchEvent(new CustomEvent(measurementStorage,{detail:measurementSource}));}}catch{}},[height,weight,shoulder,waist,build,measurementsLoaded,measurementStorage,measurementError,measurementSource]);
 const key=JSON.stringify({items:items.map(i=>[i.id,i.updated_at,i.tags,i.notes,i.ai_description,corrections[i.id]]).sort(),skin,hair,measurements:rawMeasurements,appearanceRevision});
 const storage='ultimarobe-render:'+userId+(storageSuffix?':'+storageSuffix:'');
 useEffect(()=>{try{const value=JSON.parse(localStorage.getItem(storage)||'null');if(value&&/^[a-f0-9]{32}$/.test(value.id))setJob(value);}catch{}setLoaded(true);},[storage]);
 useEffect(()=>{if(loaded)try{localStorage.setItem(storage,JSON.stringify(job));}catch{}},[job,loaded,storage]);
 const active=!!job&&!['complete','failed'].includes(job.status);
 useEffect(()=>{
  if(!active||!job)return;
  let stopped=false;const controller=new AbortController();
  async function check(){try{const response=await fetch(`/api/inventory/render?id=${job!.id}`,{signal:controller.signal});const result=await response.json();if(stopped)return;if(!response.ok){setError(result.error||'Could not check progress. Retrying…');return;}setError('');setJob(old=>old?{...old,...result}:old);}catch{if(!stopped)setError('Connection interrupted. Retrying…');}}
  void check();const timer=setInterval(check,4000);return()=>{stopped=true;controller.abort();clearInterval(timer);};
 },[active,job?.id]);
 async function generate(){if(measurementError||!measurementsLoaded)return;setSubmitting(true);setError('');const snapshot=key;try{const response=await fetch('/api/inventory/render',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:items.map(i=>i.id),skin,hair,corrections,measurements:parseMeasurements(rawMeasurements)})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Could not start rendering.');setJob({...result,key:snapshot});}catch(e){setError(e instanceof Error?e.message:'Could not render.');}finally{setSubmitting(false);}}
 const stale=!!job&&job.key!==key;
 return <div className="ur-realistic">
  <fieldset className="ur-measurements" disabled={!measurementsLoaded||submitting}><legend>Body measurements <small>optional</small></legend><div><label>Height (cm)<input type="number" inputMode="decimal" min="50" max="275" step="0.1" value={height} placeholder="e.g. 180" onChange={e=>setHeight(e.target.value)}/></label><label>Weight (kg)<input type="number" inputMode="decimal" min="15" max="500" step="0.1" value={weight} placeholder="e.g. 80" onChange={e=>setWeight(e.target.value)}/></label><label>Build<select value={build} onChange={e=>setBuild(e.target.value)}><option value="">Use avatar reference</option>{BUILDS.map(b=><option key={b} value={b}>{b[0].toUpperCase()+b.slice(1)}</option>)}</select></label><label>Shoulder width (cm)<input type="number" min="20" max="100" step="0.1" value={shoulder} onChange={e=>setShoulder(e.target.value)}/></label><label>Waist circumference (cm)<input type="number" min="40" max="250" step="0.1" value={waist} onChange={e=>setWaist(e.target.value)}/></label></div><p>Shoulders: straight across from shoulder point to shoulder point. Waist: around your natural waist. Guides the next realistic estimate. Saved in this browser for your account; leave blank to omit. Height and weight alone cannot specify exact body shape or clothing fit.</p>{measurementError&&<p role="alert">{measurementError}</p>}</fieldset>
  {job?.status==='complete'?<img src={`/api/inventory/render?id=${job.id}&image=1`} alt="Locally generated outfit appearance estimate"/>:<div className="ur-render-placeholder"><span aria-hidden="true">✧</span><h3>{active?'Painting the possibility…':'A glimpse of the real world'}</h3><p>{active?job?.message:'Generate a realistic image using your selected clothing colours, cuts, materials and garment details.'}</p></div>}
  {stale&&<p className="ur-render-stale">Outfit or appearance changed. This preview belongs to the earlier selection.</p>}
  {job?.status==='failed'&&<p role="alert">{job.message}</p>}
  {error&&<p role="alert">{error}</p>}
  <button className="ur-save-button" disabled={!items.length||active||submitting||!measurementsLoaded||!!measurementError} onClick={generate}>{submitting?'Starting…':active?'Rendering locally…':job?'Generate new estimate':'Generate realistic estimate'}</button>
  {job?.status==='complete'&&<a href={`/api/inventory/render?id=${job.id}&image=1`} download="ultimarobe-outfit-estimate.png">Download image ↓</a>}
  <p className="ur-render-note">Local AI estimate from garment tags, not a photo-exact try-on or fit prediction. It may change patterns, proportions and details.</p>
 </div>;
}
