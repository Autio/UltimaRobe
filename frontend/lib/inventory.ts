import type { Item } from '@/lib/types';

export const SLOTS = ['head', 'neck', 'top', 'mid', 'outer', 'bottom', 'socks', 'feet', 'belt', 'bag', 'extra'] as const;
export type Slot = typeof SLOTS[number];
export const SLOT_LABEL: Record<Slot, string> = { head: 'Head', neck: 'Neck', top: 'Shirt', mid: 'Mid layer', outer: 'Outerwear', bottom: 'Legs', socks: 'Socks', feet: 'Footwear', belt: 'Belt', bag: 'Bag', extra: 'Accessory' };
export type Garment = Pick<Item, 'id' | 'type'> & Partial<Item>;
export function slotFor(item: Pick<Garment, 'type'>): Slot {
  const type = item.type.toLowerCase();
  if (/hat|cap|beanie/.test(type)) return 'head';
  if (/scarf|tie|necklace/.test(type)) return 'neck';
  if (/cardigan|vest/.test(type)) return 'mid';
  if (/jacket|coat|blazer|hoodie/.test(type)) return 'outer';
  if (/pants|jeans|shorts|skirt|trousers/.test(type)) return 'bottom';
  if (/socks/.test(type)) return 'socks';
  if (/shoes|sneakers|boots|sandals|loafers|heels|footwear/.test(type)) return 'feet';
  if (/belt/.test(type)) return 'belt';
  if (/bag|backpack/.test(type)) return 'bag';
  if (/shirt|blouse|polo|tank|top|sweater|dress|jumpsuit/.test(type)) return 'top';
  return 'extra';
}
export function fullBody(item: Pick<Garment, 'type'>) { return /dress|jumpsuit/.test(item.type); }
export function equip<T extends Garment>(items: T[], item: T): T[] {
  if (items.some(i => i.id === item.id)) return items.filter(i => i.id !== item.id);
  return [...items.filter(i => slotFor(i) !== slotFor(item) && !(fullBody(item) && slotFor(i) === 'bottom') && !(slotFor(item) === 'bottom' && fullBody(i))), item];
}
const colors: Record<string, string> = { black:'#29282c',white:'#e7e5d9',gray:'#7a7d80',grey:'#7a7d80',navy:'#293c61',blue:'#46729e','light-blue':'#a2bdc8','dark-blue':'#2f496c',green:'#637758','army-green':'#687057',olive:'#6c7050',burgundy:'#713848',red:'#a13e3b',yellow:'#c9a745',mustard:'#ad8932',brown:'#725541',tan:'#ac8862',beige:'#baa98a',cream:'#ded1b2',orange:'#be7949',purple:'#745675',pink:'#c692a1',teal:'#497b79',khaki:'#96906c',silver:'#aeb6ba',gold:'#bda058' };
export function garmentColor(item?: {primary_color?:string|null;colors?:string[]}): string {
  const value = (item?.primary_color || item?.colors?.[0] || '').toLowerCase().trim().replace(/ /g,'-');
  return /^#[0-9a-f]{6}$/i.test(value) ? value : colors[value] || '#88857b';
}
export function garmentLabel(item: Garment): string { return item.name || `${item.primary_color || ''} ${item.type}`.trim(); }
export function outfitPrompt(items: Garment[]): string {
  return 'Full-length realistic studio fashion photograph of an adult masculine model, neutral relaxed front-facing pose, head and shoes entirely visible, natural proportions, plain warm gray background, soft daylight. Wearing: ' + items.map(i => `${i.primary_color || ''} ${i.type}${i.tags?.pattern ? ', '+i.tags.pattern+' pattern' : ''}${i.tags?.material ? ', '+i.tags.material : ''}${i.tags?.fit ? ', '+i.tags.fit+' fit' : ''}${i.ai_description ? ': '+i.ai_description.slice(0,400) : ''}`).join('; ') + '. One person. Preserve these garment colors and categories. No text or logos added.';
}
