// Metadata validation and stateless procedural audio. No uploaded files or external services.
import {soundTools,callSoundTool,SOUND_VERSION,INLINE_LIMIT_BYTES} from './sound-mcp.js';
import {bgmToolDefinitions} from './bgm-mcp-adapter.mjs';
import {callBgmTool,BGM_HOST_LIMITS} from './sound-bgm-host.mjs';
import {SOUND_SITE_PUBLIC} from './sound-access.mjs';
import {byteTools,runByteTool} from './asset-byte-mcp-p1.mjs';
import {titleTools,runTitleTool} from './title-studio-mcp.mjs';
const id = {type:'string',pattern:'^[A-Za-z0-9][A-Za-z0-9_-]{0,59}$',maxLength:60};
const entry = {type:'object',additionalProperties:false,required:['id','file','byte_size'],properties:{id:{type:'string',minLength:1,maxLength:100},file:{type:'string',minLength:1,maxLength:240},byte_size:{type:'integer',minimum:0,maximum:20971520},sha256:{type:'string',pattern:'^[a-f0-9]{64}$'},status:{type:'string',enum:['PASS','FAIL','UNKNOWN']}}};
const previewSchema={type:'object',additionalProperties:false,required:['project_id','assets'],properties:{project_id:id,assets:{type:'array',maxItems:500,items:entry}}};
export const tools=[
 {name:'capabilities',description:'Read metadata validation and stateless procedural sound capabilities and limits.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
 {name:'inventory_preview',description:'Validate caller-supplied inventory metadata only. No file upload, storage, Python parity, or byte verification.',inputSchema:previewSchema},
 {name:'audit_preview',description:'Audit caller-supplied manifest metadata. Byte/visual/engine/rights checks remain UNKNOWN.',inputSchema:previewSchema}
,...(SOUND_SITE_PUBLIC?[]:byteTools),...soundTools,...bgmToolDefinitions,...titleTools
].map(t=>({...t,annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}}));
const allowed=new Set(['id','file','byte_size','sha256','status']);
function inspectInput(a){
 if(!a||typeof a!=='object'||Array.isArray(a)||Object.keys(a).some(k=>!['project_id','assets'].includes(k)))throw Error('Unexpected input fields');
 if(typeof a.project_id!=='string'||!new RegExp(id.pattern).test(a.project_id))throw Error('Invalid project_id');
 if(!Array.isArray(a.assets)||a.assets.length>500)throw Error('At most 500 metadata entries');
 const ids=new Set(),paths=new Set();let total=0;
 for(const x of a.assets){
  if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).some(k=>!allowed.has(k)))throw Error('Unexpected asset fields; file bytes/URLs not accepted');
  if(typeof x.id!=='string'||!x.id||x.id.length>100||/[\u0000-\u001f]/.test(x.id)||ids.has(x.id))throw Error('Invalid or duplicate asset ID');ids.add(x.id);
  if(typeof x.file!=='string'||x.file.length>240||!/^assets\/[^/\\:]+$/.test(x.file)||x.file.includes('..')||/[\u0000-\u001f\u007f]/.test(x.file)||/[. ]$/.test(x.file)||paths.has(x.file.toLowerCase()))throw Error('Unsafe or duplicate path');paths.add(x.file.toLowerCase());
  if(!Number.isSafeInteger(x.byte_size)||x.byte_size<0||x.byte_size>20971520)throw Error('File size limit');total+=x.byte_size;
  if(x.sha256!==undefined && (typeof x.sha256!=='string'||!/^[a-f0-9]{64}$/.test(x.sha256)))throw Error('Invalid SHA-256 metadata');
  if(x.status!==undefined&&!['PASS','FAIL','UNKNOWN'].includes(x.status))throw Error('Invalid caller status');
 }
 if(total>83886080)throw Error('Total size limit');return total;
}
export async function callTool(name,a){
 if(!tools.some(t=>t.name===name))throw Error('Unknown tool');
 if(name==='capabilities'){
  if(!a||typeof a!=='object'||Array.isArray(a)||Object.keys(a).length)throw Error('No arguments accepted');
  return {adapter_version:'0.3.0',browser_studio:{version:'5.6-candidate',visual_kit:{version:'0.1.1-p1-integration-candidate',execution:'browser_local',font_formats:['ttf','otf','woff','woff2'],rights:'UNKNOWN',engine_import:'UNKNOWN'},game_bridge:{version:'0.2.0-visual-candidate',execution:'browser_local',engine_import:'UNKNOWN',rights:'UNKNOWN',production:'UNKNOWN'},sound_editor:'0.3',multitrack_editor:'0.1.0-beta',multitrack_path:'/sound/multitrack',entry_path:'/',sound_path:'/sound',audio_processing:'browser_local',audio_formats:['wav'],audio_revision_backup:true,server_audio_processing:true},sound_mcp:{version:SOUND_VERSION,access:SOUND_SITE_PUBLIC?'public':'authenticated',bgm_engine_version:'0.1.0',bgm_limits:BGM_HOST_LIMITS,artifact_version:'0.4.0',export_formats:['assets','game','aldx'],aldx_schema_version:'0.2.0',inline_delivery:{max_bytes:INLINE_LIMIT_BYTES,wav:'audio',zip:'embedded_resource',fallback:'structuredContent.inline_delivery',opt_in:true},stateless:true,generation:'procedural',uploaded_audio:false,max_duration_seconds:6,max_pack_sounds:6,max_pack_source_seconds:12},runtime:'Sites / Cloudflare Workers',tools:tools.map(t=>t.name),byte_pipeline_p1:{execution:'browser_local',supported_formats:['glb','mp3','wav','png'],actual_bytes:true,zip_readback:true,mcp_inline_bytes:SOUND_SITE_PUBLIC?'DISABLED_PUBLIC_SITE':'PRIVATE_SITE_CANDIDATE',mcp_inline_limit_bytes:2200000,persisted:false},read_only:true,storage:false,file_upload:false,network_calls:false,python_core_reference:'0.3.5 candidate',title_mcp:{version:'0.1.0-candidate',tools:titleTools.map(t=>t.name),schema:'motuk.title-studio.v1',stateless:true,browser_storage_access:false,max_inline_bytes:131072,export_formats:['json','html','svg','zip'],png_export:'BROWSER_ONLY',visual_qa:'UNKNOWN'},installed_plugin_version:'UNCHANGED (0.3.4)',python_sdk_l2:'NOT_TESTED',core_parity:'UNKNOWN',limits:{max_assets:500,max_file_bytes:20971520,max_total_bytes:83886080},evidence:{basis:'implemented adapter contract',files_read:0,writes:0}};
 }
 if(byteTools.some(t=>t.name===name)){if(SOUND_SITE_PUBLIC)throw Error('Private Site required for byte input');return runByteTool(name,a);}
 if(soundTools.some(t=>t.name===name))return (await callSoundTool(name,a)).structuredContent;
 if(titleTools.some(t=>t.name===name))return runTitleTool(name,a);
 const total=inspectInput(a);
 const normalized={project_id:a.project_id,assets:a.assets.map(x=>({id:x.id,file:x.file,byte_size:x.byte_size,sha256:x.sha256??null,caller_status:x.status??'UNKNOWN'}))};
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(normalized)));
 const metadata_sha256=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 return {project_id:a.project_id,metadata_structure:'PASS',asset_count:a.assets.length,total_declared_bytes:total,...(name==='inventory_preview'?{inventory:normalized.assets}:{issues:normalized.assets.filter(x=>x.caller_status!=='PASS').map(x=>({id:x.id,caller_status:x.caller_status})),declared_status_only:true}),content_integrity:'UNKNOWN',visual_qa:'UNKNOWN',engine_import_qa:'UNKNOWN',rights_qa:'UNKNOWN',evidence:{basis:'caller_supplied_metadata',metadata_sha256,files_read:0,writes:0,persisted:false,hash_scope:'normalized request metadata, not asset bytes'}};
}
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
export async function handleMcp(req){
 // Sites dispatch authenticates Site visibility. Caller identity is forwarded by dispatch.
 if(!SOUND_SITE_PUBLIC&&!req.headers.get('oai-authenticated-user-id'))return response({error:'Authenticated Site identity required'},401);
 if(req.method!=='POST')return response({error:'POST required'},405);
 if(!req.headers.get('content-type')?.includes('application/json'))return response({error:'JSON required'},415);
 // Private Site only: bounded larger requests for inline bytes; current public endpoint stays at 256 KiB.
 const requestLimit=SOUND_SITE_PUBLIC?262144:4*1024*1024;
 if(Number(req.headers.get('content-length'))>requestLimit)return response({error:'Request size limit'},413);
 let size=0,parts=[];const reader=req.body?.getReader();
 if(!reader)return response({error:'Body required'},400);
 try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>requestLimit){await reader.cancel();return response({error:'Request exceeds 256 KiB'},413)}parts.push(value)}}catch{return response({error:'Read failed'},400)}
 let r;try{const bytes=new Uint8Array(size);let off=0;for(const part of parts){bytes.set(part,off);off+=part.length}r=JSON.parse(new TextDecoder().decode(bytes))}catch{return response({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}},400)}
 if(!r||Array.isArray(r)||r.jsonrpc!=='2.0'||typeof r.method!=='string'||!(typeof r.id==='string'||typeof r.id==='number'||r.id===undefined)||Object.keys(r).some(k=>!['jsonrpc','id','method','params'].includes(k)))return response({jsonrpc:'2.0',id:null,error:{code:-32600,message:'Invalid request'}},400);
 const out=(result)=>response({jsonrpc:'2.0',id:r.id??null,result});
 if(r.method==='notifications/initialized')return new Response(null,{status:202});
 if(r.method==='server/discover')return out({supportedVersions:['2026-07-28'],capabilities:{tools:{}}});
 if(r.method==='initialize')return out({protocolVersion:'2026-07-28',capabilities:{tools:{}},serverInfo:{name:'ALDOL Asset Factory Studio',version:'0.3.0'}});
 if(r.method==='tools/list')return out({tools});
 if(r.method==='tools/call'){
  try{
   // MCP request metadata belongs to the protocol envelope, never tool arguments.
   const p=r.params;
   if(!p||typeof p!=='object'||Array.isArray(p)||typeof p.name!=='string'||Object.keys(p).some(k=>!['name','arguments','_meta'].includes(k)))throw Error('Invalid tool parameters');
   if(p._meta!==undefined&&(!p._meta||typeof p._meta!=='object'||Array.isArray(p._meta)))throw Error('Invalid MCP metadata');
   const args=p.arguments===undefined?{}:p.arguments;
   if(!args||typeof args!=='object'||Array.isArray(args))throw Error('Tool arguments must be an object');
   if(bgmToolDefinitions.some(t=>t.name===p.name))return out(await callBgmTool(p.name,args,req.headers.get('oai-authenticated-user-id')));
   if(soundTools.some(t=>t.name===p.name))return out(await callSoundTool(p.name,args));
   if(byteTools.some(t=>t.name===p.name)&&(!req.headers.get('oai-authenticated-user-id')||SOUND_SITE_PUBLIC))throw Error('Private authenticated Site required for byte tool');
   const value=await callTool(p.name,args);
   return out({content:[{type:'text',text:JSON.stringify(value)}],isError:false});
  }
  catch(e){return out({content:[{type:'text',text:e.message}],isError:true})}
 }
 return response({jsonrpc:'2.0',id:r.id??null,error:{code:-32601,message:'Method not found'}});
}
