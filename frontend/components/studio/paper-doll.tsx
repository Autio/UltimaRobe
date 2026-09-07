'use client';
import { useId } from 'react';
import { garmentColor, slotFor, type Garment, type Slot } from '@/lib/inventory';

export function PaperDoll({items,skin='#ba8664',hair='#423128'}:{items:Garment[];skin?:string;hair?:string}) {
  const uid=useId().replace(/:/g,'');
  const slots=Object.fromEntries(items.map(i=>[slotFor(i),i])) as Partial<Record<Slot,Garment>>;
  const top=slots.top, outer=slots.outer, pants=slots.bottom;
  function fabric(item:Garment|undefined) {
    if(!item)return '#b6a78d';
    const pattern=item.tags?.pattern||'';
    return /strip|plaid|check/.test(pattern)?`url(#${uid}-${slotFor(item)})`:garmentColor(item);
  }
  const sleeve = top && /t-shirt|polo|tank/.test(top.type) ? 65 : 87;
  return <svg viewBox="0 0 96 168" role="img" aria-label={`Masculine paper doll wearing ${items.length} selected garments`} shapeRendering="crispEdges" style={{width:'100%',height:'100%',maxHeight:440}}>
    <defs>{items.map(i=><pattern key={i.id} id={`${uid}-${slotFor(i)}`} patternUnits="userSpaceOnUse" width="8" height="8"><rect width="8" height="8" fill={garmentColor(i)}/><path d="M0 1H8" stroke="#e0d8c4" opacity=".35"/>{/plaid|check/.test(i.tags?.pattern||'')&&<path d="M2 0V8" stroke="#171b20" opacity=".3"/>}</pattern>)}</defs>
    <ellipse cx="48" cy="157" rx="28" ry="5" fill="#241d15" opacity=".3"/>
    <g stroke="#37291f" strokeWidth="1">
      <path d="M38 83H58L61 111 57 151H48L47 114 44 151H35L35 111Z" fill={skin}/>
      <path d="M35 44L25 50 19 91 24 98 29 94 33 65 35 85H61L63 65 67 94 72 98 77 91 71 50 61 44 55 42V35H41V42Z" fill={skin}/>
      <path d="M35 82H61L60 100H50L48 92 46 100H35Z" fill="#aaa08e"/>
      <path d="M37 17L42 12H55L60 19 59 33 54 41H43L37 34Z" fill={skin}/>
      <path d="M35 24V16L41 10H55L61 16V27H57V20L49 17 39 22V28H36Z" fill={hair}/>
    </g>
    <path d="M41 28H44M52 28H55" stroke="#302621" strokeWidth="2"/>
    <path d="M48 28V33H50M44 36H52" fill="none" stroke="#845c47"/>
    <path d="M38 34L43 41H54L59 34 55 39H43Z" fill={hair} opacity=".4"/>
    {slots.socks&&<g fill={fabric(slots.socks)}><path d="M35 139H45V154H34Z"/><path d="M49 139H58V154H48Z"/></g>}
    {pants&&<g stroke="#28251f" strokeWidth="1"><path d={pants.type==='skirt'?'M35 81H61L68 124H29Z':pants.type==='shorts'?'M35 81H61L61 112H50L48 94 46 112H34Z':'M35 81H61L61 110 58 148H48L48 111 45 148H34L35 109Z'} fill={fabric(pants)}/><path d="M38 89L39 104M56 89L55 105M48 86V95" opacity=".3"/><path d="M38 85H44M53 85H59" stroke="#f1e3bc" opacity=".3"/></g>}
    {top&&<g stroke="#2a2622" strokeWidth="1"><path d={`M39 43L27 48 22 ${sleeve} 31 ${sleeve+2} 35 59V85H61V59L65 ${sleeve+2} 74 ${sleeve} 69 48 57 43 52 48H44Z`} fill={fabric(top)}/>{/shirt|polo/.test(top.type)&&<><path d="M40 43L45 51 48 47 51 51 57 43M48 49V83" fill="none" stroke="#fff" opacity=".3"/><path d="M49 56V58M49 65V67M49 75V77" stroke="#d8c8a5"/></>}{/dress|jumpsuit/.test(top.type)&&<path d="M35 81H61L68 142H28Z" fill={fabric(top)}/>}</g>}
    {slots.mid&&<path d="M36 45L43 44 48 60 54 44 61 46V88H35Z" fill={fabric(slots.mid)} stroke="#342c23"/>}
    {outer&&<g stroke="#26221e" strokeWidth="1"><path d="M36 42L25 48 18 89 29 92 35 61 33 94H45L47 57 49 57 51 94H63L61 61 67 92 78 89 71 48 59 42 52 46 48 54 44 46Z" fill={fabric(outer)}/><path d="M38 44L46 56 40 62 43 89M58 44L50 56 56 62 53 89M34 78H41M55 78H63" stroke="#d4b98a" opacity=".4" fill="none"/>{outer.type==='coat'&&<path d="M34 89H45L43 119H30ZM51 89H63L66 119H53Z" fill={fabric(outer)}/>}</g>}
    {slots.feet&&<g fill={fabric(slots.feet)} stroke="#24221d"><path d={slots.feet.type==='boots'?'M34 132H45V154H29V150L34 147Z':'M34 147H45V155H28V151Z'}/><path d={slots.feet.type==='boots'?'M49 132H59V147L65 150V154H49Z':'M49 147H59L66 151V155H49Z'}/><path d="M28 155H45M49 155H66" stroke="#c7bda5" strokeWidth="2"/></g>}
    {slots.belt&&<><path d="M34 83H62" stroke={garmentColor(slots.belt)} strokeWidth="4"/><rect x="45" y="81" width="6" height="5" fill="#b99b56"/></>}
    {slots.neck&&<path d="M40 42L45 46 44 56 50 73 54 66 50 47 57 41 54 45 43 46Z" fill={fabric(slots.neck)}/>}
    {slots.head&&<path d="M34 20V14L40 8H56L61 14V20H66V23H32V20Z" fill={fabric(slots.head)} stroke="#30271e"/>}
    {slots.bag&&<g stroke="#34281f"><path d="M30 68L62 104" stroke={garmentColor(slots.bag)} strokeWidth="3"/><rect x="60" y="99" width="17" height="22" rx="2" fill={fabric(slots.bag)}/><path d="M60 105H77"/></g>}
    {slots.extra&&<rect x="70" y="90" width="6" height="3" fill={garmentColor(slots.extra)}/>}
    <path d="M21 92H26M70 92H75" stroke="#e7b68b" opacity=".6"/>
  </svg>;
}
