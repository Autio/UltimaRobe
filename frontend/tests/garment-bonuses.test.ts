import {describe,it,expect} from 'vitest';
import {garmentBonuses,outfitBonuses,enchantedIdentity} from '../lib/garment-bonuses';
describe('wardrobe enchantments',()=>{
 it('generates lore and preserves user-written names',()=>{
  const item={id:'1',type:'shirt',name:'Blue Batik'};
  expect(enchantedIdentity(item).name).toContain('Wandering Artisan');
  expect(enchantedIdentity(item,{enchanted_name:'My lucky shirt',lore:'Found on a journey.'})).toEqual({name:'My lucky shirt',lore:'Found on a journey.'});
  expect(item.name).toBe('Blue Batik');
 });
 it('reflects distinctive garment details',()=>{
  expect(garmentBonuses({id:'1',type:'trousers',name:'Flared trousers'})).toContainEqual(expect.objectContaining({attribute:'Swagger',value:3}));
  expect(garmentBonuses({id:'2',type:'shirt',name:'Blue Batik'})).toContainEqual(expect.objectContaining({attribute:'Creativity'}));
 });
 it('gives untagged items stable, bounded bonuses',()=>{
  const item={id:'1',type:'unknown'};const b=garmentBonuses(item);
  expect(b).toEqual(garmentBonuses(item));expect(b.length).toBeGreaterThanOrEqual(2);expect(b.length).toBeLessThanOrEqual(3);
  expect(new Set(b.map(x=>x.attribute)).size).toBe(b.length);
 });
 it('totals equipped items once and removes unequipped contributions',()=>{
  const a={id:'1',type:'shirt'},b={id:'2',type:'shirt'};
  expect(outfitBonuses([a,a])).toEqual(outfitBonuses([a]));
  expect(outfitBonuses([a,b]).find(x=>x.attribute==='Charm')?.value).toBe(2);
  expect(outfitBonuses([])).toEqual([]);
 });
});
