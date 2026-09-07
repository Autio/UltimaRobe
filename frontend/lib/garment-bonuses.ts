import {slotFor, type Garment} from './inventory';

export type Bonus = {attribute:string; value:number; reason:string};
export function enchantedIdentity(item:Garment,custom?:{enchanted_name?:string;lore?:string}){
 const bonus=garmentBonuses(item)[0];
 const titles:Record<string,string>={Swagger:'the Grand Entrance',Creativity:'the Wandering Artisan',Diplomacy:'the Silver Tongue',Endurance:'the Long Road',Warmth:'the Hearthkeeper',Composure:'the Summer Wanderer',Agility:'the Quickstep',Presence:'the Golden Hour',Mystique:'the Midnight Guild',Woodcraft:'the Woodland Wayfarer',Charm:'the Friendly Stranger',Fortune:'Small Miracles'};
 return {name:custom?.enchanted_name||(item.name||item.type)+' of '+(titles[bonus.attribute]||'Everyday Adventures'),lore:custom?.lore||`${bonus.reason} Its enchantment grows with the stories you collect while wearing it.`};
}
/** Fictional flavour only. Stable rules keep a garment's bonuses consistent. */
export function garmentBonuses(item:Garment):Bonus[]{
 const text=[item.name,item.type,item.subtype,item.primary_color,item.tags?.material,item.tags?.pattern,item.tags?.fit,...(item.tags?.features||[])].filter(Boolean).join(' ').toLowerCase();
 const bonuses:Bonus[]=[];
 const add=(attribute:string,value:number,reason:string)=>{if(!bonuses.some(b=>b.attribute===attribute))bonuses.push({attribute,value,reason});};
 if(/flar|bell.bottom/.test(text))add('Swagger',3,'A little extra sweep with every stride.');
 if(/batik|paisley|floral|embroider/.test(text))add('Creativity',3,'Patterns worthy of a wandering artisan.');
 if(/blazer|suit|formal|tie\b/.test(text))add('Diplomacy',3,'Gain an audience before saying a word.');
 if(/boot|denim|corduroy|leather/.test(text))add('Endurance',2,'Made for the long road to the next tavern.');
 if(/wool|fleece|knit|sweater|parka/.test(text))add('Warmth',3,'A small ward against the northern wind.');
 if(/linen|shorts|sandal/.test(text))add('Composure',2,'Keep your cool when the quest heats up.');
 if(/sneaker|stretch|relaxed/.test(text))add('Agility',2,'Ready for an unexpected side quest.');
 if(/yellow|gold|red|orange|pink|purple/.test(text))add('Presence',2,'Hard to overlook at the guild gathering.');
 if(/black|navy|charcoal/.test(text))add('Mystique',2,'Leaves a little of your story untold.');
 if(/green|olive|teal|hunting/.test(text))add('Woodcraft',2,'At home among woodland paths and garden parties.');
 const base:Record<string,[string,string]>={head:['Wit','A thinking cap for everyday puzzles.'],neck:['Charm','The finishing touch to a persuasive introduction.'],top:['Charm','A friendly face deserves a worthy frame.'],mid:['Warmth','An extra layer of adventuring resolve.'],outer:['Resolve','Ready to step out into the unknown.'],bottom:['Swagger','Every journey begins with a confident stride.'],feet:['Wayfinding','These soles know the way to the next adventure.'],socks:['Comfort','Quiet luxury for the road less travelled.'],belt:['Readiness','Keeps the whole expedition together.'],bag:['Preparedness','Room for provisions and improbable discoveries.'],extra:['Fortune','A small talisman for everyday adventures.']};
 const [attribute,reason]=base[slotFor(item)];add(attribute,1,reason);
 if(bonuses.length<2)add('Individuality',1,'A signature piece in your personal legend.');
 return bonuses.slice(0,3);
}
export function outfitBonuses(items:Garment[]):{attribute:string;value:number}[]{
 const totals=new Map<string,number>();
 for(const item of Array.from(new Map(items.map(i=>[i.id,i])).values()))for(const bonus of garmentBonuses(item))totals.set(bonus.attribute,(totals.get(bonus.attribute)||0)+bonus.value);
 return Array.from(totals).map(([attribute,value])=>({attribute,value})).sort((a,b)=>b.value-a.value||a.attribute.localeCompare(b.attribute));
}
