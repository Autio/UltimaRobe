import {describe,it,expect} from 'vitest';
import {suggestQuests,questScore} from '../lib/outfit-quests';
import {slotFor} from '../lib/inventory';
describe('outfit quests',()=>{
 const items=[{id:'a',type:'shirt',name:'Blue Batik'},{id:'b',type:'shirt',name:'plain shirt'},{id:'c',type:'trousers'},{id:'d',type:'boots'},{id:'e',type:'jacket'}];
 it('uses existing items without overlapping slots',()=>{for(const look of suggestQuests(items,'gallery')){expect(look.items.every(i=>items.some(x=>x.id===i.id))).toBe(true);expect(new Set(look.items.map(slotFor)).size).toBe(look.items.length);}});
 it('prefers expressive gallery clothing and handles empty wardrobes',()=>{expect(questScore(items[0],'gallery').score).toBeGreaterThan(questScore(items[1],'gallery').score);expect(suggestQuests([],'rain')).toEqual([]);});
 it('does not invent rain protection or combine a dress with trousers',()=>{expect(suggestQuests(items,'rain')[0].note).toContain('No explicit rain protection');const look=suggestQuests([{id:'a',type:'dress'},{id:'b',type:'trousers'}],'wedding')[0];expect(look.items.map(i=>i.type)).toEqual(['dress']);});
});
