import {describe,it,expect} from 'vitest';
import {describeGarment,garmentDetails} from '../lib/garment-details';
import type {Item} from '../lib/types';
const item={id:'a',type:'trousers',primary_color:'burgundy',tags:{fit:'relaxed',material:'corduroy',features:['flared legs']},ai_description:'High waist and wide hem',updated_at:'today'} as Item;
describe('garment detail preservation',()=>{
 it('keeps fabric and silhouette in realistic prompts',()=>{const text=describeGarment(item);expect(text).toContain('flared legs');expect(text).toContain('corduroy');expect(text).toContain('High waist');});
 it('gives explicit user cut corrections precedence for sprites',()=>{expect(garmentDetails(item,'bootcut, ankle length').cut_details).toBe('bootcut, ankle length');});
});
