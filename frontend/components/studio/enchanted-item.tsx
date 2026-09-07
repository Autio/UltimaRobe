'use client';
import {useState,cloneElement,type ReactElement,type MouseEvent,type FocusEvent} from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import type {Item} from '@/lib/types';
import {garmentLabel,slotFor,SLOT_LABEL} from '@/lib/inventory';
import {garmentBonuses,enchantedIdentity} from '@/lib/garment-bonuses';
import {defaultPlacement,type ItemDetail} from '@/lib/use-item-details';
export function EnchantedTooltip({item,detail,enabled,theme='classic',children}:{item:Item;detail?:ItemDetail;enabled:boolean;theme?:string;children:ReactElement}){
 const [open,setOpen]=useState(false);
 const identity=enchantedIdentity(item,detail);
 const child=children as ReactElement<{onMouseEnter?:(e:MouseEvent<HTMLElement>)=>void;onFocusCapture?:(e:FocusEvent<HTMLElement>)=>void;onBlurCapture?:(e:FocusEvent<HTMLElement>)=>void}>;
 // Explicit entry/focus handling makes the whole nested sprite tile a trigger,
 // including its image and action buttons, at every inventory density.
 const trigger=cloneElement(child,{
  onMouseEnter:(e:MouseEvent<HTMLElement>)=>{child.props.onMouseEnter?.(e);setOpen(true);},
  onFocusCapture:(e:FocusEvent<HTMLElement>)=>{child.props.onFocusCapture?.(e);setOpen(true);},
  onBlurCapture:(e:FocusEvent<HTMLElement>)=>{child.props.onBlurCapture?.(e);if(!e.currentTarget.contains(e.relatedTarget as Node))setOpen(false);},
 });
 return <Tooltip.Provider delayDuration={150}><Tooltip.Root open={open} onOpenChange={setOpen}><Tooltip.Trigger asChild>{trigger}</Tooltip.Trigger><Tooltip.Portal><Tooltip.Content className={`ur-lore-tooltip ur-tooltip-${theme}`} side="top" sideOffset={10} collisionPadding={12} onEscapeKeyDown={()=>setOpen(false)}><strong>{enabled?identity.name:garmentLabel(item)}</strong><p>{garmentLabel(item)} · {SLOT_LABEL[slotFor(item)]}<br/>{[item.primary_color,item.tags?.material,item.tags?.fit].filter(Boolean).join(' · ')}</p>{enabled&&<><p>{identity.lore}</p>{garmentBonuses(item).map(b=><div className="ur-tooltip-bonus" key={b.attribute}><b>+{b.value} {b.attribute}</b><span>{b.reason}</span></div>)}</>}<Tooltip.Arrow fill={theme==='moonstone'?'#617a95':'#796244'}/></Tooltip.Content></Tooltip.Portal></Tooltip.Root></Tooltip.Provider>;
}
export function LoreEditor({item,detail,onSave}:{item:Item;detail?:ItemDetail;onSave:(id:string,d:ItemDetail)=>Promise<void>}){
 const [name,setName]=useState(detail?.enchanted_name||''),[lore,setLore]=useState(detail?.lore||''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const defaults=enchantedIdentity(item);
 async function save(){setBusy(true);try{await onSave(item.id,{placement:detail?.placement||defaultPlacement,enchanted_name:name.trim(),lore:lore.trim()});setMessage('Name and lore saved.');}catch(e){setMessage(e instanceof Error?e.message:'Save failed');}finally{setBusy(false);}}
 return <section className="ur-lore-editor"><h4>Name your enchanted item</h4><label>Fantasy name<input maxLength={100} value={name} placeholder={defaults.name} onChange={e=>setName(e.target.value)}/></label><label>Item lore<textarea maxLength={400} value={lore} placeholder={defaults.lore} onChange={e=>setLore(e.target.value)}/></label><p>Leave blank to use the generated story. Your wardrobe name stays the same.</p><button type="button" disabled={busy} onClick={save}>{busy?'Saving…':'Save name & lore'}</button><p role="status">{message}</p></section>;
}
