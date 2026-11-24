/* Private-only MCP candidate: raw bytes carried inline as bounded Base64.
 * Not enabled while the existing Site is public. No URL fetch, R2, D1 or persistence.
 */
import '../public/assets/asset-core.js';
import {verifyFiles,createPackage} from '../public/assets/byte-pipeline.mjs';
const MAX_BODY_B64=3_000_000, MAX_ASSET_BYTES=2_200_000, MAX_ITEMS=20, MAX_INLINE=131072;
const BYTE_ITEM={type:'object',additionalProperties:false,required:['id','file','content_base64'],properties:{id:{type:'string',minLength:1,maxLength:100},file:{type:'string',minLength:5,maxLength:200,pattern:'^assets/[^/\\\\:]+\\.(?:glb|mp3|wav|png)$'},content_base64:{type:'string',minLength:4,maxLength:3000000},expected_sha256:{type:'string',pattern:'^[a-f0-9]{64}$'}}};
const BYTE_ARGS={type:'object',additionalProperties:false,required:['project_id','assets'],properties:{project_id:{type:'string',pattern:'^[A-Za-z0-9][A-Za-z0-9_-]{0,59}$'},assets:{type:'array',minItems:1,maxItems:MAX_ITEMS,items:BYTE_ITEM}}};
export const byteTools=[
 {name:'asset_bytes_inspect',description:'Private-Site-only: verify actual inline base64 bytes (GLB, MP3, WAV, PNG) and return SHA-256 manifest. Stateless; never accepts URLs or stores files.',inputSchema:BYTE_ARGS},
 {name:'asset_bytes_export',description:'Private-Site-only: verify actual inline base64 assets and build/readback a deterministic stored ZIP. Inline delivery only when ZIP <=128 KiB; otherwise use browser-local P1 for download. Stateless.',inputSchema:BYTE_ARGS}
];
function strictBase64(value){
 if(typeof value!=='string'||value.length<4||value.length>MAX_BODY_B64||value.length%4!==0||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))throw Error('Invalid bounded base64');
 const outLen=value.length*3/4-(value.endsWith('==')?2:value.endsWith('=')?1:0);if(outLen>MAX_ASSET_BYTES)throw Error('Inline asset size limit');
 const binary=atob(value),out=new Uint8Array(binary.length);for(let i=0;i<out.length;i++)out[i]=binary.charCodeAt(i);
 return out;
}
export async function runByteTool(name,args){
 if(!byteTools.some(x=>x.name===name))throw Error('Unknown byte tool');
 if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).some(k=>!['project_id','assets'].includes(k)))throw Error('Unexpected request fields');
 if(typeof args.project_id!=='string'||!(/^[A-Za-z0-9][A-Za-z0-9_-]{0,59}$/).test(args.project_id))throw Error('Invalid project_id');
 if(!Array.isArray(args.assets)||!args.assets.length||args.assets.length>MAX_ITEMS)throw Error('Asset count limit');
 const items=[];let total=0;for(const x of args.assets){
  if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).some(k=>!['id','file','content_base64','expected_sha256'].includes(k)))throw Error('Unexpected asset fields');
  if(typeof x.id!=='string'||!x.id||x.id.length>100||typeof x.file!=='string'||!/^assets\/[^/\\:%?#\u0000-\u001f]+\.(glb|mp3|wav|png)$/.test(x.file)||x.file.includes('..'))throw Error('Unsafe asset ID/path');
  const bytes=strictBase64(x.content_base64);total+=bytes.length;if(total>MAX_ASSET_BYTES)throw Error('Inline total byte limit');
  if(x.expected_sha256!==undefined && !/^[a-f0-9]{64}$/.test(x.expected_sha256))throw Error('Invalid expected hash');
  items.push({id:x.id,name:x.file.slice(7),bytes,expected_sha256:x.expected_sha256});
 }
 const comparison=items.every(x=>typeof x.expected_sha256==='string')?'PASS':'NOT_PROVIDED_FOR_ALL_FILES';
 if(name==='asset_bytes_inspect'){
  const data=await verifyFiles(args.project_id,items);
  return {project_id:args.project_id,asset_count:items.length,actual_files_read:items.length,actual_bytes_read:total,manifest:data.manifest,expected_sha256_comparison:comparison,storage_writes:0,network_fetches:0,persisted:false,engine_import_qa:'UNKNOWN',rights_qa:'UNKNOWN',basis:'actual inline byte content; not caller metadata'};
 }
 const result=await createPackage(args.project_id,items);
 const inline=result.archive.length<=MAX_INLINE;
 const encoded=inline?Array.from(result.archive,b=>String.fromCharCode(b)).join(''):null;
 return {project_id:args.project_id,asset_count:items.length,actual_bytes_read:total,manifest:result.manifest,zip_sha256:result.sha256,zip_byte_size:result.archive.length,zip_crc:'PASS',zip_readback:'PASS',expected_sha256_comparison:comparison,delivery:inline?'INLINE_BASE64':'BROWSER_LOCAL_REQUIRED',zip_base64:inline?btoa(encoded):null,storage_writes:0,network_fetches:0,persisted:false,rights_qa:'UNKNOWN',engine_import_qa:'UNKNOWN',basis:'actual inline byte content; not metadata'};
}
