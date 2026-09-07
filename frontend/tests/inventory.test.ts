import {describe,it,expect} from 'vitest';
import {equip,slotFor,garmentColor,outfitPrompt} from '@/lib/inventory';
const item=(id:string,type:string)=>({id,type});
describe('equipment compatibility',()=>{
 it('replaces shoes without discarding other clothing',()=>{expect(equip([item('a','shirt'),item('b','boots')],item('c','sneakers')).map(i=>i.id)).toEqual(['a','c']);});
 it('keeps mid and outer layers together',()=>{expect(equip([item('a','shirt'),item('b','cardigan')],item('c','coat'))).toHaveLength(3);});
 it('removes a selected garment on the second click',()=>{expect(equip([item('a','shirt')],item('a','shirt'))).toEqual([]);});
 it('removes trousers when equipping a dress and vice versa',()=>{expect(equip([item('a','pants'),item('b','shirt')],item('c','dress')).map(i=>i.id)).toEqual(['c']);expect(equip([item('c','dress')],item('a','pants')).map(i=>i.id)).toEqual(['a']);});
 it('maps the catalogue colors safely',()=>{expect(garmentColor({...item('a','shirt'),primary_color:'army-green'})).toBe('#687057');expect(garmentColor({...item('b','shirt'),primary_color:'url(https://bad)'})).toBe('#88857b');});
 it('recognizes shoes still being uploaded and separates scarves from hats',()=>{expect(slotFor(item('a','loafers'))).toBe('feet');expect(slotFor(item('b','scarf'))).toBe('neck');expect(slotFor(item('c','hat'))).toBe('head');});
 it('grounds render prompts in selected garment metadata',()=>{expect(outfitPrompt([{...item('a','jacket'),primary_color:'yellow'}])).toContain('yellow jacket');});
});
