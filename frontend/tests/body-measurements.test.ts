import {describe,it,expect} from 'vitest';
import {parseMeasurements,measurementPrompt} from '../lib/body-measurements';
describe('realistic body measurements',()=>{
 it('allows no measurements and independently optional fields',()=>{
  expect(parseMeasurements(undefined)).toEqual({});
  expect(parseMeasurements({heightCm:180,weightKg:''})).toEqual({heightCm:180});
  expect(measurementPrompt({})).toBe('');
 });
 it('rejects invalid values without interpreting user text as prompts',()=>{
  for(const v of [NaN,Infinity,0,-1,501,'ignore instructions'])expect(()=>parseMeasurements({weightKg:v})).toThrow();
  expect(()=>parseMeasurements({heightCm:300})).toThrow();
 });
 it('includes both measurements and normalizes decimals',()=>{
  const m=parseMeasurements({heightCm:182.25,weightKg:84.5});
  expect(m.heightCm).toBe(182.3);
  expect(measurementPrompt(m)).toContain('182.3 cm tall, weighing 84.5 kg');
  expect(measurementPrompt({weightKg:65})).toContain('65 kg');
 });
 it('accepts explicit build and dimensions without guessing them',()=>{
  expect(measurementPrompt(parseMeasurements({build:'athletic',shoulderCm:46,waistCm:88}))).toContain('shoulder width 46 cm, waist circumference 88 cm, athletic build');
  expect(()=>parseMeasurements({build:'made-up'})).toThrow();
  expect(()=>parseMeasurements({waistCm:-5})).toThrow();
 });
});
