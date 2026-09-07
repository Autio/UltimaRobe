'use client';
/* eslint-disable @next/next/no-img-element */
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {useQuery} from '@tanstack/react-query';
import {useSession} from 'next-auth/react';
import {api,setAccessToken,getErrorMessage} from '@/lib/api';
import type {Item,ItemListResponse} from '@/lib/types';
import {useCreateStudioOutfit} from '@/lib/hooks/use-studio';
import {useOutfits} from '@/lib/hooks/use-outfits';
import {equip,garmentColor,garmentLabel,slotFor,SLOTS,SLOT_LABEL,type Slot} from '@/lib/inventory';
import {useSprites} from '@/lib/use-sprites';
import {RasterPaperDoll} from '@/components/studio/raster-paper-doll';
import {PaperDoll} from '@/components/studio/paper-doll';
import {RealisticPreview} from '@/components/studio/realistic-preview';
import {SpriteTuningModal} from '@/components/studio/sprite-tuning-modal';
import {garmentBonuses,outfitBonuses,enchantedIdentity} from '@/lib/garment-bonuses';
import {useItemDetails} from '@/lib/use-item-details';
import {OutfitComparison} from '@/components/studio/outfit-comparison';
import {EnchantedTooltip} from '@/components/studio/enchanted-item';
import {OutfitQuests} from '@/components/studio/outfit-quests';
import './inventory.css';

export default function InventoryPage(){
 const {data:session}=useSession();
 const userId=session?.user?.id;
 const sprites=useSprites(userId);
 const custom=useItemDetails(userId);
 const [avatarRevision,setAvatarRevision]=useState(0);
 const appearanceRevision=JSON.stringify({details:custom.details,avatarRevision});
 const [ids,setIds]=useState<string[]>([]),[name,setName]=useState(''),[occasion,setOccasion]=useState('casual');
 const [filter,setFilter]=useState<Slot|'all'>('all'),[search,setSearch]=useState(''),[view,setView]=useState<'sprite'|'svg'|'photos'|'realistic'>('sprite');
 const [skin,setSkin]=useState('#ba8664'),[hair,setHair]=useState('#423128'),[ready,setReady]=useState(false),[notice,setNotice]=useState('');
 const [tuningItem, setTuningItem] = useState<Item | null>(null);
 const [theme,setTheme]=useState<'classic'|'moonstone'>('classic');
 const [density,setDensity]=useState<'small'|'medium'|'large'>('small');
 const [showBonuses,setShowBonuses]=useState(false),[inspectedId,setInspectedId]=useState<string|null>(null);
 const save=useCreateStudioOutfit();
 const looks=useOutfits({is_lookbook:true},1,12);
 const wardrobe=useQuery({queryKey:['inventory-items',userId],enabled:!!session?.accessToken,refetchInterval:15000,queryFn:async()=>{
   setAccessToken(session!.accessToken as string);
   const result:Item[]=[];let page=1;let more=true;
   while(more){const data=await api.get<ItemListResponse>('/items',{params:{page:String(page++),page_size:'100',is_archived:'false'}});result.push(...data.items);more=data.has_more;}
   return result;
 }});
 useEffect(()=>{if(!userId)return;try{const d=JSON.parse(localStorage.getItem('ultimarobe:'+userId)||'null');if(d){setTheme(d.theme==='moonstone'?'moonstone':'classic');setShowBonuses(d.showBonuses===true);if(['small','medium','large'].includes(d.density))setDensity(d.density);setIds(Array.isArray(d.ids)?d.ids.filter((i:unknown)=>typeof i==='string'):[]);setName(typeof d.name==='string'?d.name:'');setOccasion(typeof d.occasion==='string'?d.occasion:'casual');if(/^#[0-9a-f]{6}$/i.test(d.skin))setSkin(d.skin);if(/^#[0-9a-f]{6}$/i.test(d.hair))setHair(d.hair);}}catch{}setReady(true);},[userId]);
 useEffect(()=>{if(ready&&userId)try{localStorage.setItem('ultimarobe:'+userId,JSON.stringify({ids,name,occasion,skin,hair,density,showBonuses,theme}));}catch{}},[ready,userId,ids,name,occasion,skin,hair,density,showBonuses,theme]);
 const items=wardrobe.data||[];
 const selected=useMemo(()=>ids.map(id=>items.find(i=>i.id===id)).filter((i):i is Item=>!!i),[ids,items]);
 const visible=items.filter(i=>(filter==='all'||slotFor(i)===filter)&&`${i.name||''} ${i.type} ${i.primary_color||''}`.toLowerCase().includes(search.toLowerCase()));
 const inspected=items.find(i=>i.id===inspectedId);
 const bonuses=outfitBonuses(selected);
 const missing=wardrobe.isSuccess?ids.filter(id=>!items.some(i=>i.id===id)).length:0;
 function select(item:Item){if(!ids.includes(item.id)&&!sprites.jobs[item.id])void sprites.generate(item);setIds(equip(selected,item).map(i=>i.id));setNotice(`${garmentLabel(item)} ${ids.includes(item.id)?'removed':'equipped'}.`);}
 async function saveLook(){try{await save.mutateAsync({items:selected.map(i=>i.id),name:name.trim(),occasion,scheduled_for:null,mark_worn:false});setNotice(`“${name.trim()}” saved to your looks.`);await looks.refetch();}catch(e){setNotice(getErrorMessage(e,'Could not save your outfit.'));}}
 return <div className={`ur-inventory ur-theme-${theme}`}>
  <header className="ur-heading"><div><span className="ur-eyebrow">THE EVERYDAY ADVENTURER</span><h1>UltimaRobe</h1><p>Your wardrobe. A different kind of character sheet.</p></div><Link href="/dashboard/wardrobe" className="ur-link">＋ Add clothing</Link></header>
  <div className="ur-toolbar"><label className="ur-theme-picker">Theme <select value={theme} onChange={e=>setTheme(e.target.value as 'classic'|'moonstone')}><option value="classic">Classic</option><option value="moonstone">Moonstone</option></select></label><span><i className="ur-live"/> {items.length} possessions</span><span>{selected.length} equipped</span><span className="ur-local">Your private wardrobe</span></div>
  <div className="ur-workbench">
   <section className="ur-character ur-panel" aria-label="Character and equipped clothing">
    <div className="ur-panel-title"><span>Ⅰ</span><h2>The character</h2><span>✦</span></div>
    <div className="ur-tabs" aria-label="Outfit preview"><button onClick={()=>setView('sprite')} aria-pressed={view==='sprite'}>Pixel avatar</button><button onClick={()=>setView('svg')} aria-pressed={view==='svg'}>SVG sketch</button><button onClick={()=>setView('photos')} aria-pressed={view==='photos'}>Photos</button><button onClick={()=>setView('realistic')} aria-pressed={view==='realistic'}>Realistic</button></div>
    {view==='realistic'&&userId?<RealisticPreview appearanceRevision={appearanceRevision} items={selected} skin={skin} hair={hair} userId={userId} corrections={sprites.corrections}/>:<div className="ur-stage" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const item=items.find(i=>i.id===e.dataTransfer.getData('text/plain'));if(item&&!ids.includes(item.id)){select(item);if(!sprites.jobs[item.id])void sprites.generate(item);}}}>
     {view==='sprite'&&userId?<RasterPaperDoll onAvatarChange={()=>setAvatarRevision(v=>v+1)} placementRevision={appearanceRevision} items={selected} jobs={sprites.jobs} generate={sprites.generate} corrections={sprites.corrections} correct={sprites.correct} userId={userId} onEquip={select} wardrobe={items}/>:view==='svg'?<><div className="ur-rune" aria-hidden="true">✧</div><PaperDoll items={selected} skin={skin} hair={hair}/></>:<div className="ur-photo-layout">{selected.length?selected.map(i=><figure key={i.id}><img src={i.image_url||i.thumbnail_url} alt={garmentLabel(i)}/><figcaption>{garmentLabel(i)}</figcaption></figure>):<p>Equip clothing from your inventory to compare the original photographs.</p>}</div>}
    </div>}
    {view!=='realistic'&&view!=='sprite'&&<p className="ur-caption">{view==='svg'?'Prototype vector silhouettes, coloured from your clothing tags.':'Your actual garment photos. This is a layout, not a generated try-on.'}</p>}
    {view==='svg'&&<details className="ur-appearance"><summary>Character appearance</summary><div><label>Skin <input type="color" value={skin} onChange={e=>setSkin(e.target.value)}/></label><label>Hair <input type="color" value={hair} onChange={e=>setHair(e.target.value)}/></label></div></details>}
    {showBonuses&&<section className="ur-enchantments" aria-label="Equipped outfit bonuses"><h3>✦ Equipped enchantments</h3><p>Fictional RPG bonuses · for the joy of dressing.</p><div className="ur-bonus-totals">{bonuses.length?bonuses.map(b=><span key={b.attribute}>+{b.value} {b.attribute}</span>):<span>Equip a garment to begin your legend.</span>}</div></section>}
    <div className="ur-equipped">{SLOTS.map(slot=>{const item=selected.find(i=>slotFor(i)===slot);return <button key={slot} className={item?'ur-slot filled':'ur-slot'} title={item?`Remove ${garmentLabel(item)}`:`Browse ${SLOT_LABEL[slot]}`} onClick={()=>item?select(item):setFilter(slot)} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const i=items.find(i=>i.id===e.dataTransfer.getData('text/plain'));if(i&&slotFor(i)===slot)select(i);else setNotice(`Choose an item for ${SLOT_LABEL[slot].toLowerCase()}.`);}}><span>{SLOT_LABEL[slot]}</span>{item?<><i style={{background:garmentColor(item)}}/><strong>{garmentLabel(item)}</strong><b aria-hidden="true">×</b></>:<em>＋ Equip</em>}</button>;})}</div>
   </section>
   <section className="ur-bag ur-panel" aria-label="Clothing inventory">
    <div className="ur-panel-title"><span>Ⅱ</span><h2>The travelling wardrobe</h2><span>▧</span></div>
    <div className="ur-bag-tools"><label className="ur-search"><span className="sr-only">Search clothing</span><input placeholder="Find a possession…" value={search} onChange={e=>setSearch(e.target.value)}/></label><label><span className="sr-only">Filter clothing slot</span><select value={filter} onChange={e=>setFilter(e.target.value as Slot|'all')}><option value="all">All clothing</option>{SLOTS.map(s=><option key={s} value={s}>{SLOT_LABEL[s]}</option>)}</select></label></div>
    <div className="ur-density" role="group" aria-label="Inventory item size"><span>Item size</span>{(['small','medium','large'] as const).map(size=><button key={size} aria-pressed={density===size} onClick={()=>setDensity(size)}>{size[0].toUpperCase()+size.slice(1)}</button>)}</div><p className="ur-hint">Drag a garment onto the character, or click to equip it. A new piece replaces the same slot.</p>
    <div className="ur-enchantment-toggle"><label><input type="checkbox" checked={showBonuses} onChange={e=>setShowBonuses(e.target.checked)}/> Show enchantments</label>{showBonuses&&<span>Hover, focus, or tap ✦ to inspect.</span>}</div>
    {showBonuses&&<section className="ur-enchantments ur-item-lore" aria-label="Garment enchantments">{inspected?<><h3>✦ {enchantedIdentity(inspected,custom.details[inspected.id]).name}</h3><p>{enchantedIdentity(inspected,custom.details[inspected.id]).lore}</p><button onClick={()=>setTuningItem(inspected)}>Edit name &amp; lore</button><ul>{garmentBonuses(inspected).map(b=><li key={b.attribute}><strong>+{b.value} {b.attribute}</strong><span>{b.reason}</span></li>)}</ul></>:<><h3>✦ A little everyday magic</h3><p>Inspect a possession to discover its enchantments.</p></>}</section>}
    {wardrobe.isLoading&&<p className="ur-empty">Opening your wardrobe…</p>}
    {wardrobe.isError&&<div className="ur-empty" role="alert">Couldn’t load your clothing. <button onClick={()=>wardrobe.refetch()}>Try again</button></div>}
    <div className={`ur-grid ur-grid-${density}`}>{visible.map(i=>{
      const job=sprites.jobs[i.id];
      const isGen=job&&!['complete','failed'].includes(job.status);
      return <EnchantedTooltip key={i.id} item={i} detail={custom.details[i.id]} enabled={showBonuses} theme={theme}><div onMouseEnter={()=>{if(showBonuses)setInspectedId(i.id);}} onFocus={()=>{if(showBonuses)setInspectedId(i.id);}} title={showBonuses?undefined:`${garmentLabel(i)} · ${SLOT_LABEL[slotFor(i)]} · ${i.tags?.material||''} ${i.tags?.fit||''}`} aria-label={`${garmentLabel(i)}, ${SLOT_LABEL[slotFor(i)]}`} className={`ur-item ${ids.includes(i.id)?'equipped':''}`}>
        <div className="ur-item-image" role="button" tabIndex={0} aria-label={`Equip ${garmentLabel(i)}`} aria-pressed={ids.includes(i.id)} onKeyDown={e=>{if(e.target!==e.currentTarget)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();select(i);}}} onClick={()=>select(i)} draggable onDragStart={e=>e.dataTransfer.setData('text/plain',i.id)}>
          <img className={job?.status==='complete'?'ur-pixel-icon':''} src={job?.status==='complete'?`/api/inventory/sprites?id=${job.job_id}&kind=inventory&t=${job.updated_at||''}`:i.thumbnail_url||i.image_url} alt="" loading="lazy"/>
          {ids.includes(i.id)&&<span className="ur-check">✓</span>}
          <div className="ur-item-actions">
            {showBonuses&&<button type="button" className="ur-item-action-btn" aria-label={`Inspect enchantments for ${garmentLabel(i)}`} onClick={e=>{e.stopPropagation();setInspectedId(i.id);}}>✦</button>}
            <button type="button" className="ur-item-action-btn" title="Tune & inspect sprite" onClick={(e)=>{e.stopPropagation();setTuningItem(i);}}>⚙</button>
            <button type="button" className={`ur-item-action-btn ${isGen?'spinning':''}`} title={isGen?'Generating sprite…':'Regenerate sprite'} disabled={isGen} onClick={(e)=>{e.stopPropagation();void sprites.generate(i,true);}}>↻</button>
          </div>
        </div>
        <button type="button" className="ur-item-body" onClick={()=>select(i)}>
          <span className="ur-item-type">{i.type.replaceAll('-',' ')}{i.status==='processing'?' · analysing':''}</span>
          <strong>{i.name||`${i.primary_color||''} ${i.type}`}</strong>
          <span className="ur-color"><i style={{background:garmentColor(i)}}/>{i.primary_color||'Colour untagged'}</span>
        </button>
      </div></EnchantedTooltip>;
    })}</div>
    {wardrobe.isSuccess&&!visible.length&&<p className="ur-empty">{items.length?'No clothing matches this search.':'Your wardrobe is empty. Add your first garment to begin.'}</p>}
    <div className="ur-bag-footer"><button onClick={async()=>{for(const item of items)await sprites.generate(item,true);}}>↻ Force regenerate all sprites</button><span>{visible.length} items · {Object.values(sprites.jobs).filter(j=>j.status==='complete').length} sprites ready · {Object.values(sprites.jobs).filter(j=>!['complete','failed'].includes(j.status)).length} generating</span><button onClick={()=>wardrobe.refetch()} disabled={wardrobe.isFetching}>{wardrobe.isFetching?'Refreshing…':'↻ Refresh wardrobe'}</button></div>
   </section>
  </div>
  <OutfitQuests items={items} onWear={(outfit,label)=>{setIds(outfit.map(i=>i.id));setName(label);setNotice(`Equipped ${label}. Pin it below to compare.`);for(const item of outfit)if(!sprites.jobs[item.id])void sprites.generate(item);}}/>
  {userId&&<OutfitComparison userId={userId} selected={selected} wardrobe={items} name={name} jobs={sprites.jobs} revision={appearanceRevision} skin={skin} hair={hair} corrections={sprites.corrections} onLoad={(outfit,label)=>{setIds(outfit.reduce<Item[]>((acc,i)=>equip(acc,i),[]).map(i=>i.id));setName(label);setNotice(`Loaded ${label}.`);}}/>}
  <section className="ur-save ur-panel"><div><span className="ur-eyebrow">PRESERVE THE ENSEMBLE</span><h2>Ready for the next adventure?</h2><p>Save this combination to your Wardrowbe looks.</p></div><div className="ur-save-controls"><label>Outfit name<input maxLength={100} value={name} onChange={e=>setName(e.target.value)} placeholder="The Sunday wanderer"/></label><label>Occasion<select value={occasion} onChange={e=>setOccasion(e.target.value)}>{['casual','office','work','formal','date','sport','party','travel'].map(o=><option key={o}>{o}</option>)}</select></label><button className="ur-save-button" disabled={!name.trim()||!selected.length||save.isPending||!!missing} onClick={saveLook}>{save.isPending?'Saving…':'✓ Save outfit'}</button></div></section>
  {custom.error&&<p role="alert">{custom.error}</p>}
  {sprites.error&&<p role="alert">{sprites.error}</p>}
  <div className="ur-notice" role="status" aria-live="polite">{missing?`${missing} selected item(s) are no longer available. Equip a garment to refresh this draft.`:notice}</div>
  <section className="ur-looks"><div className="ur-looks-heading"><h2>The lookbook</h2><Link href="/dashboard/outfits?filter=my-looks">All saved outfits →</Link></div><div className="ur-looks-list">{looks.data?.outfits?.map(look=><button key={look.id} onClick={()=>{const available=look.items.map(i=>items.find(g=>g.id===i.id)).filter((i):i is Item=>!!i);const next=available.reduce<Item[]>((acc,i)=>equip(acc,i),[]);setIds(next.map(i=>i.id));setName(look.name||'');setOccasion(look.occasion);setNotice(`Loaded ${look.name||'outfit'}${next.length!==look.items.length?' · some unavailable or overlapping items were omitted':''}. Saving creates a new look.`);}}><span className="ur-look-colors">{look.items.slice(0,6).map(i=><i key={i.id} style={{background:garmentColor(i)}}/>)}</span><strong>{look.name||'Untitled outfit'}</strong><small>{look.items.length} pieces · {look.occasion}</small></button>)}</div>{!looks.data?.outfits?.length&&<p>Your saved adventures will appear here.</p>}</section>
  {tuningItem && (
    <SpriteTuningModal
      item={tuningItem}
      detail={custom.details[tuningItem.id]} detailsLoaded={custom.loaded} onSaveDetail={custom.save}
      job={sprites.jobs[tuningItem.id]}
      correction={sprites.corrections[tuningItem.id] || ''}
      onClose={()=>setTuningItem(null)}
      onRegenerate={sprites.generate}
      onSaveCorrection={sprites.correct}
    />
  )}
 </div>;
}


