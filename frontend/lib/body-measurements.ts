export const BUILDS=['slender','average','athletic','broad','fuller'] as const;
export type BodyMeasurements={heightCm?:number;weightKg?:number;shoulderCm?:number;waistCm?:number;build?:typeof BUILDS[number]};
export function parseMeasurements(value:unknown):BodyMeasurements{
 if(value===undefined||value===null)return {};
 if(typeof value!=='object'||Array.isArray(value))throw new Error('Enter valid height and weight.');
 const input=value as Record<string,unknown>,result:BodyMeasurements={};
 for(const [key,label,min,max] of [['heightCm','Height',50,275],['weightKg','Weight',15,500],['shoulderCm','Shoulder width',20,100],['waistCm','Waist circumference',40,250]] as const){
  const n=input[key];if(n===undefined||n===null||n==='')continue;
  if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max)throw new Error(`${label} must be between ${min} and ${max} ${key==='weightKg'?'kg':'cm'}.`);
  result[key]=Math.round(n*10)/10;
 }
 if(input.build!==undefined&&input.build!==''){
  if(!BUILDS.includes(input.build as typeof BUILDS[number]))throw new Error('Choose one of the listed builds.');
  result.build=input.build as typeof BUILDS[number];
 }
 return result;
}
export function measurementPrompt(m:BodyMeasurements):string{
 const parts=[m.heightCm!==undefined?`${m.heightCm} cm tall`:null,m.weightKg!==undefined?`weighing ${m.weightKg} kg`:null,m.shoulderCm!==undefined?`shoulder width ${m.shoulderCm} cm`:null,m.waistCm!==undefined?`waist circumference ${m.waistCm} cm`:null,m.build?`${m.build} build`:null].filter(Boolean);
 return parts.length?` User-supplied body measurements: ${parts.join(', ')}. Use these measurements as approximate guidance for body scale and proportions, allowing the body silhouette to differ from the pixel reference while preserving garment cuts. Do not add measurement text to the image.`:'';
}
