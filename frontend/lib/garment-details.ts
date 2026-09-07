import type {Item} from './types';
import {slotFor} from './inventory';
export function garmentDetails(item:Item, correction='', overrides: Record<string, any> = {}) {
 const tags=item.tags||{};
 const text=[correction,overrides.cut_details,item.subtype,tags.fit,tags.material,...(tags.features||[]),item.notes,item.ai_description].filter(Boolean).join('; ').slice(0,900);
 return {
  correction: correction || overrides.cut_details || '',
  slot: slotFor(item),
  garment_type: overrides.garment_type || item.subtype || item.type,
  color_override: overrides.primary_color,
  primary_color: overrides.primary_color || item.primary_color,
  pattern: overrides.pattern || tags.pattern || 'solid',
  material: overrides.material || tags.material || 'cotton',
  fit: overrides.fit || tags.fit,
  features: overrides.features || tags.features,
  cut_details: correction || overrides.cut_details || text,
  description: text,
  source_version: item.updated_at
 };
}
export function describeGarment(item:Item,correction='', overrides: Record<string, any> = {}) {
 const d=garmentDetails(item,correction,overrides);
 return [d.primary_color,d.garment_type,d.cut_details,d.pattern&&d.pattern!=='solid'?d.pattern+' pattern':'',d.material].filter(Boolean).join(', ').slice(0,700);
}
