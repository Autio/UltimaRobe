'use client';
/* eslint-disable @next/next/no-img-element */
import {useState} from 'react';
import type {Item} from '@/lib/types';
import {QUESTS,suggestQuests,type Quest} from '@/lib/outfit-quests';
import {garmentLabel} from '@/lib/inventory';
export function OutfitQuests({items,onWear}:{items:Item[];onWear:(items:Item[],name:string)=>void}){
 const [quest,setQuest]=useState<Quest>('gallery'),[requested,setRequested]=useState<Quest|null>(null);
 const suggestions=requested?suggestQuests(items,requested):[];
 return <section className="ur-panel ur-quests"><header><h2>Choose your next quest</h2><label>Occasion<select value={quest} onChange={e=>{setQuest(e.target.value as Quest);setRequested(null);}}>{Object.entries(QUESTS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><button disabled={!items.length} onClick={()=>setRequested(quest)}>Suggest outfits</button></header><p>Suggestions use your actual wardrobe and its clothing details. Wear a suggestion, then pin it to compare.</p><div className="ur-comparison-grid">{suggestions.map((look,n)=><article key={look.items.map(i=>i.id).join()}><h3>{QUESTS[requested!]} · {n+1}</h3><ul>{look.items.map((item,index)=><li key={item.id}><img src={item.thumbnail_url||item.image_url} alt=""/><div><strong>{garmentLabel(item)}</strong><p>{look.reasons[index]}</p></div></li>)}</ul><p>{look.note}</p><button onClick={()=>onWear(look.items,`${QUESTS[requested!]} ${n+1}`)}>Wear this suggestion</button></article>)}</div>{requested&&!suggestions.length&&<p>Add shirts, trousers, dresses or footwear to build a quest outfit.</p>}</section>;
}
