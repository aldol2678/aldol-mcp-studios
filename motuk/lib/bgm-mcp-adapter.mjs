/**
 * Additive integration adapter for existing ALDOL SOUND MCP 0.4.2.
 * No changes to existing SFX handlers. Owner-private download callback must be
 * provided by the host after its own authentication/access checks.
 * Do NOT deploy this file alone: it does not register a tool or HTTP route.
 */
import {BGM_DEFAULTS,BGM_MOODS,BGM_INSTRUMENTS,BGM_ENGINE_VERSION,generateBgm,validateBgmRecipe,BgmError} from './bgm-engine.mjs';

export const bgmToolDefinitions=Object.freeze([
  {name:'sound_bgm_presets',description:'List available deterministic offline BGM moods/instruments and limits.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
  {name:'sound_bgm_generate',description:'Generate loopable PCM16 WAV BGM under the current Site access policy from a bounded procedural recipe. Uses a verified same-site WAV route; never returns a fake URL.',inputSchema:{type:'object',properties:{recipe:{type:'object',properties:{
    mood:{type:'string',enum:Object.keys(BGM_MOODS)},instrument:{type:'string',enum:Object.keys(BGM_INSTRUMENTS)},
    bpm:{type:'integer',minimum:60,maximum:150},bars:{type:'integer',minimum:4,maximum:16},
    seed:{type:'integer',minimum:0,maximum:4294967295},sampleRate:{type:'integer',enum:[22050,44100]}
  },additionalProperties:false}},required:['recipe'],additionalProperties:false}}
]);
export function soundBgmPresets(){return {version:BGM_ENGINE_VERSION,mode:'procedural',local_synthesis:true,external_api:false,
  moods:BGM_MOODS,instruments:BGM_INSTRUMENTS,defaults:BGM_DEFAULTS,
  limits:{max_duration_seconds:60,bpm_min:60,bpm_max:150,bars_min:4,bars_max:16,sample_rates:[22050,44100],channels:1,pcm_bits:16},
  existing_sfx_unchanged:true};}
/**
 * @param {{recipe: object}} args
 * @param {{issueOwnerPrivateDownload: function}} runtime
 * The host callback MUST only provide a URL from an authenticated, same-site,
 * owner-only endpoint. Caller must implement signed/validated params or private
 * regeneration, rate limits and streaming; this module cannot implement access.
 */
export async function soundBgmGenerate(args,{issueOwnerPrivateDownload,allowPublicDelivery=false}={}){
  if(!args||typeof args!=='object'||!args.recipe||Object.keys(args).some(k=>k!=='recipe'))throw new BgmError('BAD_ARGS','Expected {recipe} only');
  const recipe=validateBgmRecipe(args.recipe);
  if(typeof issueOwnerPrivateDownload!=='function')throw new BgmError('BGM_PRIVATE_DELIVERY_NOT_CONFIGURED','Current SOUND MCP has no verified private BGM delivery route. No WAV URL will be invented.');
  const result=await generateBgm(recipe);
  const delivery=await issueOwnerPrivateDownload({recipe,filename:result.filename,bytes:result.wav,sha256:result.sha256,mimeType:'audio/wav'});
  if(!delivery||!(delivery.access==='owner-private'||allowPublicDelivery&&delivery.access==='site-public')||typeof delivery.url!=='string'||!delivery.url.startsWith('/sound/')||delivery.url.startsWith('//')||/[\r\n]/.test(delivery.url)){
    throw new BgmError('BGM_DELIVERY_NOT_PRIVATE','Host must confirm an authenticated owner-private same-site /sound/ URL');
  }
  const data={version:BGM_ENGINE_VERSION,format:'bgm',filename:result.filename,mime_type:'audio/wav',download_path:delivery.url,
    sha256:result.sha256,byte_length:result.wav.length,metadata:result.metadata,download_access:delivery.access,persisted:delivery.persisted===true};
  return {content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data};
}
