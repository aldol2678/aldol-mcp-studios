// Stateless hosted adapter over the same deterministic engine as the browser.
import * as SoundEngine from '../public/sound-assets/core.js';
import '../public/sound-assets/editor.js';
import * as GameExport from '../public/sound-assets/game-export.js';
import '../public/sound-assets/runtime-source.js';
import {toAldxMcpResult,ALDXExportError} from './sound-aldx-export.mjs';
import {wrapGeneratedFileInline,toMcpInlineError,INLINE_LIMIT_BYTES} from './sound-inline-delivery.mjs';
import {SOUND_SITE_PUBLIC} from './sound-access.mjs';

// Vite converts UMD to CommonJS exports; native ESM executes the browser branch.
// Resolve both explicitly instead of depending on bundled global side effects.
const S=SoundEngine.default??globalThis.AldolSound,G=GameExport.default??globalThis.AldolGameExport;
const SITE='https://aldol-asset-factory-studio.al-dori.chatgpt.site';
export const SOUND_VERSION='0.4.4';
// Transport-only release: preserve existing recipes, links and archive bytes.
const ARTIFACT_VERSION='0.4.0';
export {INLINE_LIMIT_BYTES};
const object=(properties,required=[])=>({type:'object',properties,required,additionalProperties:false});
const number=(minimum,maximum)=>({type:'number',minimum,maximum});
const recipeSchema=object({preset:{type:'string',enum:Object.keys(S.PRESETS)},duration:number(.08,6),tone:number(0,1),intensity:number(0,1),seed:{type:'integer',minimum:0,maximum:4294967295},sampleRate:{type:'integer',enum:[22050,44100,48000]}},['preset']);
const processingSchema=object({gain:number(0,2),normalize:{type:'boolean'},trim:{type:'boolean'},fadeInMs:number(0,500),fadeOutMs:number(0,500)});
const soundSchema=object({recipe:recipeSchema,processing:processingSchema},['recipe']);
export const soundTools=[
 {name:'sound_presets',description:'List six procedural sound presets and hosted audio limits. No paid API or AI music/voice model.',inputSchema:object({})},
 {name:'sound_generate',description:'Generate a deterministic mono WAV using preset and seed, with optional gain, normalization, trim and fades. Returns audio plus an download URL under the current Site access policy. Stateless; does not modify browser assets.',inputSchema:object({...soundSchema.properties,include_audio:{type:'boolean'}},['recipe'])},
 {name:'sound_variations',description:'Compare 1–4 deterministic seed/tone variations. Returns measurements, full recipes, SHA-256 and WAV download URLs; no audio blobs. Regenerate any recipe with sound_generate.',inputSchema:object({...soundSchema.properties,count:{type:'integer',minimum:1,maximum:4}},['recipe'])},
 {name:'sound_export_pack',description:'Set include_file=true for an embedded ZIP plus structured Base64 (128 KiB cap). Return a downloadable ZIP under the current Site access policy from 1–6 sound recipes, at most 12 source seconds total. Format assets includes WAVs and manifest; game requires one sound and adds playback runtime and offline demo. Format aldx wraps the same game files in ALDX v0.2 and always returns embedded bytes with a 128 KiB cap. No persistent storage or browser inventory mutation.',inputSchema:object({sounds:{type:'array',minItems:1,maxItems:6,items:soundSchema},format:{type:'string',enum:['assets','game','aldx']},include_file:{type:'boolean'}},['sounds'])}
].map(t=>({...t,annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}}));

export function validate(value,schema,path='arguments'){
 if(schema.type==='object'){
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error(path+' must be an object');
  for(const k of Object.keys(value))if(!Object.hasOwn(schema.properties,k))throw Error(path+': unknown field '+k);
  for(const k of schema.required)if(!Object.hasOwn(value,k))throw Error(path+': missing '+k);
  for(const [k,v]of Object.entries(value))validate(v,schema.properties[k],path+'.'+k);
 }else if(schema.type==='array'){
  if(!Array.isArray(value)||value.length<schema.minItems||value.length>schema.maxItems)throw Error(path+': array limit');
  value.forEach((v,i)=>validate(v,schema.items,path+'['+i+']'));
 }else{
  if(schema.type==='integer'?!Number.isSafeInteger(value):typeof value!==schema.type)throw Error(path+': invalid type');
  if(typeof value==='number'&&(!Number.isFinite(value)||(schema.minimum!==undefined&&value<schema.minimum)||(schema.maximum!==undefined&&value>schema.maximum)))throw Error(path+': out of range');
  if(schema.enum&&!schema.enum.includes(value))throw Error(path+': unsupported value');
 }
}
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
function base64(bytes){let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);}
const limits={max_duration_seconds:6,max_variations:4,max_pack_sounds:6,max_pack_source_seconds:12,sample_rates:[22050,44100,48000],channels:1,pcm_bits:16};
const qa={listening:'UNKNOWN',engine_import:'UNKNOWN',rights:'UNKNOWN'};
function normalize(sound){
 const recipe=S.recipe(sound.recipe);
 // Canonical defaults also distinguish omitted processing from a processed copy.
 return {recipe,...(sound.processing!==undefined?{processing:{gain:1,normalize:false,trim:false,fadeInMs:4,fadeOutMs:12,...sound.processing}}:{})};
}
function job(format,sounds){
 if(!['wav','assets','game'].includes(format))throw Error('Unsupported output format');
 validate(sounds,{type:'array',minItems:1,maxItems:6,items:soundSchema});
 if(format!=='assets'&&sounds.length!==1)throw Error('WAV/game output requires one sound');
 const canonical=sounds.map(normalize);
 if(canonical.reduce((n,s)=>n+s.recipe.duration,0)>12)throw Error('Pack exceeds 12 source seconds');
 return {version:ARTIFACT_VERSION,format,sounds:canonical};
}
function urlFor(spec){const url=new URL('/sound/render',SITE);url.searchParams.set('spec',JSON.stringify(spec));return url.href;}
export async function renderSoundJob(input){
 validate(input,object({version:{type:'string',enum:[ARTIFACT_VERSION,'0.4.2','0.4.3',SOUND_VERSION]},format:{type:'string',enum:['wav','assets','game']},sounds:{type:'array',minItems:1,maxItems:6,items:soundSchema}},['version','format','sounds']));
 const spec=job(input.format,input.sounds),entries=[];
 for(const sound of spec.sounds){
  let audio=S.synth(sound.recipe);if(sound.processing)audio=S.processAudio(audio,sound.processing);
  const bytes=S.wav(audio),sha256=await digest(bytes),filename=String(entries.length+1).padStart(2,'0')+'-'+sound.recipe.preset+'.wav';
  entries.push({audio,bytes,filename,meta:{...sound,filename,sha256,byte_length:bytes.length,stats:S.stats(audio),qa:{...qa},download_url:urlFor(job('wav',[sound]))}});
 }
 const manifest={schema:'aldol.sound-mcp-pack/v1',adapter_version:ARTIFACT_VERSION,engine_version:S.VERSION,format:'pcm_s16le',channels:1,provenance:{method:'procedural_synthesis',external_api:false,external_samples:false},assets:entries.map(e=>e.meta),qa:{...qa}};
 let bytes,mimeType,filename;
 if(spec.format==='wav'){bytes=entries[0].bytes;mimeType='audio/wav';filename=entries[0].filename;}
 else{
  const files=entries.map(e=>({name:e.filename,data:e.bytes}));
  if(spec.format==='game'){
   const e=entries[0],runtime=globalThis.AldolGameSource;
   files.push({name:'game-audio.js',data:runtime},{name:'index.html',data:G.demo(e.bytes,{name:S.PRESETS[e.audio.recipe.preset].name},runtime)},
    {name:'README.txt',data:'Open index.html for an offline playback demo. The exact registered WAV is included. Game engine import, listening and rights remain UNKNOWN. Asset Factory: import the WAV from this ZIP; no automatic inventory writes. Reproduce with manifest.json recipes and processing.'});
  }
  files.push({name:'manifest.json',data:JSON.stringify(manifest,null,2)});
  bytes=S.zip(files);mimeType='application/zip';filename='aldol-sound-'+spec.format+'.zip';
 }
 return {bytes,mimeType,filename,sha256:await digest(bytes),manifest,spec,download_url:urlFor(spec)};
}
const reply=(data,extra=[])=>({content:[{type:'text',text:JSON.stringify(data)},...extra],structuredContent:data,isError:false});
export async function callSoundTool(name,args){
 const tool=soundTools.find(t=>t.name===name);if(!tool)throw Error('Unknown sound tool');validate(args,tool.inputSchema);
 if(name==='sound_presets')return reply({version:SOUND_VERSION,engine_version:S.VERSION,presets:S.PRESETS,limits,stateless:true,storage:false,file_upload:false,network_calls:false,generation:'procedural; no AI music or voice model'});
 if(name==='sound_variations'){
  const count=args.count??3,base=S.recipe(args.recipe),assets=[];
  for(let i=0;i<count;i++){
   const recipe={...base,seed:(base.seed+i+1)>>>0,tone:Math.max(0,Math.min(1,base.tone+(i-(count-1)/2)*.045))};
   const rendered=await renderSoundJob(job('wav',[{recipe,...(args.processing!==undefined?{processing:args.processing}:{})}]));assets.push(rendered.manifest.assets[0]);
  }
  return reply({assets,qa:{...qa},persisted:false});
 }
 if(name==='sound_export_pack'&&args.format==='aldx'){
  const generated=await renderSoundJob(job('game',args.sounds));
  try{return {...await toAldxMcpResult({gameZipBytes:generated.bytes}),isError:false};}
  catch(e){if(!(e instanceof ALDXExportError))throw e;return {isError:true,content:[{type:'text',text:e.code+': '+e.message}],structuredContent:{error:{code:e.code,message:e.message}}};}
 }
 const spec=name==='sound_generate'?job('wav',[{recipe:args.recipe,...(args.processing!==undefined?{processing:args.processing}:{})}]):job(args.format??'assets',args.sounds);
 const r=await renderSoundJob(spec);
 const data={version:SOUND_VERSION,filename:r.filename,mime_type:r.mimeType,byte_length:r.bytes.length,sha256:r.sha256,download_url:r.download_url,manifest:r.manifest,persisted:false,download_requires_site_access:!SOUND_SITE_PUBLIC,factory_import:'Download WAV (or extract it from ZIP), then import in Asset Library.'};
 if((name==='sound_generate'&&args.include_audio===true)||(name==='sound_export_pack'&&args.include_file===true)){
  try{return {...await wrapGeneratedFileInline({type:name==='sound_generate'?'wav':'zip',existingResult:data,generatedBytes:r.bytes}),isError:false};}
  catch(e){return toMcpInlineError(e);}
 }
 return reply(data,name==='sound_generate'?(args.include_audio===false?[]:[{type:'audio',mimeType:r.mimeType,data:base64(r.bytes)}]):[{type:'resource_link',uri:r.download_url,name:r.filename,mimeType:r.mimeType,size:r.bytes.length,description:'Deterministically regenerated download under the current Site access policy.'}]);
}

export async function handleSoundDownload(req){
 const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; sandbox"};
 const error=(message,status)=>new Response(message,{status,headers});
 if(!SOUND_SITE_PUBLIC&&!req.headers.get('oai-authenticated-user-id'))return error('Authenticated Site identity required',401);
 if(req.method!=='GET')return error('GET required',405);
 const url=new URL(req.url),spec=url.searchParams.get('spec');
 if(!spec||spec.length>8192||[...url.searchParams.keys()].some(k=>k!=='spec')||url.searchParams.getAll('spec').length!==1)return error('Invalid render specification',400);
 try{
  const r=await renderSoundJob(JSON.parse(spec));
  return new Response(r.bytes,{headers:{...headers,'Content-Type':r.mimeType,'Content-Disposition':'attachment; filename="'+r.filename+'"','Content-Length':String(r.bytes.length),'X-Content-SHA256':r.sha256}});
 }catch(e){return error(e.message,400);}
}
