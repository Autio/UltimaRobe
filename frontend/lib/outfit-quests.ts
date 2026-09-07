import {equip,slotFor,fullBody,type Garment} from './inventory';
export const QUESTS={rain:'Rainy commute',wedding:'Summer wedding',gallery:'Gallery opening',weekend:'Weekend wandering',evening:'Evening with friends'} as const;
export type Quest=keyof typeof QUESTS;
type Rule={pattern:RegExp;score:number;reason:string};
const rules:Record<Quest,Rule[]>={
 rain:[{pattern:/waterproof|water.resistant|raincoat|shell/,score:9,reason:'rain protection noted in its details'},{pattern:/boot|coat|jacket/,score:3,reason:'a practical layer or footwear for the commute'},{pattern:/sandal|silk/,score:-4,reason:'less suited to wet-weather travel'}],
 wedding:[{pattern:/linen|lightweight|breathable/,score:5,reason:'lightweight fabric for a summer occasion'},{pattern:/blazer|dress|suit|formal|loafers|heels|button/,score:4,reason:'a dressier piece for the occasion'},{pattern:/shorts|hoodie|gym/,score:-4,reason:'more casual than the occasion'}],
 gallery:[{pattern:/batik|pattern|print|embroider|paisley|flar/,score:6,reason:'an expressive pattern or silhouette'},{pattern:/black|blazer|teal|burgundy/,score:3,reason:'a gallery-ready accent or grounding piece'}],
 weekend:[{pattern:/cotton|relaxed|sneaker|denim|shorts|stretch/,score:5,reason:'casual fabric or cut for an easy day'},{pattern:/formal|heels|tie\b/,score:-3,reason:'a dressier choice for a relaxed outing'}],
 evening:[{pattern:/silk|batik|blazer|burgundy|black|navy|leather/,score:4,reason:'an evening colour, texture or detail'},{pattern:/flar|pattern|print/,score:3,reason:'a conversational statement piece'}],
};
export function questScore(item:Garment,quest:Quest){
 const text=[item.name,item.type,item.subtype,item.primary_color,item.tags?.material,item.tags?.fit,item.tags?.pattern,item.tags?.formality,...(item.tags?.style||[]),...(item.tags?.features||[])].filter(Boolean).join(' ').toLowerCase();
 const matches=rules[quest].filter(r=>r.pattern.test(text));
 return {score:matches.reduce((s,r)=>s+r.score,0),reason:matches.find(r=>r.score>0)?.reason||'fills an available outfit slot'};
}
export function suggestQuests<T extends Garment>(items:T[],quest:Quest):{items:T[];reasons:string[];note:string}[]{
 const available=items.filter(i=>!i.is_archived&&i.status!=='archived'&&i.status!=='error');
 const groups=['top','bottom','feet',...(quest==='rain'||quest==='wedding'||quest==='gallery'||quest==='evening'?['outer']:[])];
 const results:{items:T[];reasons:string[];note:string}[]=[];
 for(let variant=0;variant<3;variant++){
  let selected:T[]=[];
  for(const slot of groups){
   if(slot==='bottom'&&selected.some(fullBody))continue;
   const pool=available.filter(i=>slotFor(i)===slot).sort((a,b)=>questScore(b,quest).score-questScore(a,quest).score||a.id.localeCompare(b.id));
   // Vary statement garments first; retain the best matching shoes/layer.
   const item=pool[(slot==='top'||slot==='bottom')?variant%Math.max(pool.length,1):0];
   if(item)selected=equip(selected,item);
  }
  if(!selected.length||results.some(r=>r.items.map(i=>i.id).sort().join()===selected.map(i=>i.id).sort().join()))continue;
  const note=quest==='rain'&&!selected.some(i=>/waterproof|water.resistant|raincoat|shell/i.test([i.name,i.type,...(i.tags?.features||[])].join(' ')))?'No explicit rain protection found in these garment details.':selected.some(i=>slotFor(i)==='feet')?'Based on your garment details; swap pieces to taste.':'No footwear available for this suggestion.';
  results.push({items:selected,reasons:selected.map(i=>questScore(i,quest).reason),note});
 }
 return results;
}
