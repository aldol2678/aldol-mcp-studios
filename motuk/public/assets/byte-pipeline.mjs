/* ALDOL Asset Factory P1 - candidate, byte-level, stateless, no network/storage.
 * The existing Asset Core owns GLB/PNG/WAV structural checks and ZIP writing.
 * PASS: bytes/hash/limited structural parsing; UNKNOWN: runtime, legal rights, engine import.
 */
const MAX_FILE=20*1024*1024, MAX_TOTAL=80*1024*1024, MAX_ASSETS=500;
const dec=new TextDecoder('utf-8',{fatal:true}), enc=new TextEncoder();
const HEX=/^[0-9a-f]{64}$/;
const FORMATS=new Set(['glb','mp3','wav','png']);
const nameValid=x=>typeof x==='string'&&x.length>=1&&x.length<=180&&x!=='manifest.json'&&x!=='qa-report.json'&&!/[\\/:\u0000-\u001f\u007f%?#]/.test(x)&&!x.includes('..')&&!/[. ]$/.test(x);
const fail=(msg)=>{throw Error(msg)};
const core=()=>globalThis.AldolAssetCore || fail('AldolAssetCore is required');
const u8=x=>x instanceof Uint8Array?x:x instanceof ArrayBuffer?new Uint8Array(x):fail('원본 바이트가 필요합니다');
// Check File metadata before allocating or reading any caller-selected bytes.
export function validateFileSelection(files){
 if(!Array.isArray(files)||!files.length||files.length>MAX_ASSETS)fail('에셋 개수 제한');
 const seen=new Set();let total=0;
 for(const f of files){
  if(!f||!nameValid(f.name))fail('안전하지 않은 파일명');
  if(seen.has(f.name.toLowerCase()))fail('대소문자 무시 파일명 중복');seen.add(f.name.toLowerCase());
  if(!FORMATS.has(f.name.split('.').pop().toLowerCase()))fail('지원하지 않는 확장자');
  if(!Number.isSafeInteger(f.size)||f.size<=0||f.size>MAX_FILE)fail('파일당 크기 제한');
  total+=f.size;if(total>MAX_TOTAL)fail('총 용량 제한');
 }
 return total;
}
function mp3Header(b,p){
 if(p+4>b.length)return null;
 const h=((b[p]*0x1000000)+(b[p+1]<<16)+(b[p+2]<<8)+b[p+3])>>>0;
 if(((h & 0xffe00000)>>>0)!==0xffe00000)return null;
 const version=(h>>>19)&3,layer=(h>>>17)&3,rateIdx=(h>>>12)&15,sampleIdx=(h>>>10)&3,pad=(h>>>9)&1;
 if(version===1||layer!==1||rateIdx===0||rateIdx===15||sampleIdx===3)return null;
 const rates=version===3?[32,40,48,56,64,80,96,112,128,160,192,224,256,320]:[8,16,24,32,40,48,56,64,80,96,112,128,144,160];
 const rate=rates[rateIdx-1], samples=[44100,48000,32000][sampleIdx]/(version===3?1:version===2?2:4);
 const length=Math.floor((version===3?144000:72000)*rate/samples)+pad;
 return length>=21 && p+length<=b.length?{length,version,samples,rate}:null;
}
export function inspectMp3(bytes){
 const b=u8(bytes);if(b.length<128)return {status:'FAIL',reason:'MP3 길이가 너무 짧습니다'};
 let p=0;
 if(b[0]===73&&b[1]===68&&b[2]===51){
  if(b.length<10||b[3]<2||b[3]>4||b[4]===255||b[5]===255||[b[6],b[7],b[8],b[9]].some(x=>x>127))return {status:'FAIL',reason:'ID3 헤더 오류'};
  p=10+((b[6]<<21)|(b[7]<<14)|(b[8]<<7)|b[9])+((b[5]&0x10)?10:0);
  if(p>=b.length)return {status:'FAIL',reason:'ID3 데이터 범위 오류'};
 }
 // Some MP3 encoders add a small, bounded zero spacer before MPEG frames.
 let first=null;for(let i=p;i<Math.min(p+4096,b.length-50);i++){
  const head=mp3Header(b,i);
  if(head&&mp3Header(b,i+head.length)){first={offset:i,header:head};break;}
 }
 if(!first)return {status:'FAIL',reason:'연속된 MPEG Layer III 프레임 2개를 찾지 못했습니다'};
 return {status:'PASS',reason:'ID3/MPEG Layer III 연속 프레임 구조 확인 · 실제 디코딩·청음 UNKNOWN',format:'mp3',first_frame_offset:first.offset,sample_rate:first.header.samples};
}
export function inspectBytes(bytes,format){
 const b=u8(bytes);if(!FORMATS.has(format))return {status:'FAIL',reason:'지원하지 않는 형식'};
 if(format==='mp3')return inspectMp3(b);
 const f=({glb:'inspectGlb',png:'inspectPng',wav:'inspectWav'})[format];
 const [status,reason]=core()[f](b);return {status,reason,format};
}
function validateNames(projectId,assets){
 if(!/^[a-zA-Z0-9][\w-]{0,59}$/.test(projectId))fail('잘못된 프로젝트 ID');
 if(!Array.isArray(assets)||assets.length===0||assets.length>MAX_ASSETS)fail('에셋 개수 제한');
 const seen=new Set(),ids=new Set();let total=0;
 for(const a of assets){
  if(!a||!nameValid(a.name))fail('안전하지 않은 파일명');
  if(typeof a.id!=='string'||!a.id||a.id.length>100||/[\u0000-\u001f\u007f]/.test(a.id)||ids.has(a.id))fail('중복/잘못된 에셋 ID');ids.add(a.id);
  if(seen.has(a.name.toLowerCase()))fail('대소문자 무시 파일명 중복');seen.add(a.name.toLowerCase());
  const b=u8(a.bytes);if(!b.length||b.length>MAX_FILE)fail('파일당 크기 제한');total+=b.length;if(total>MAX_TOTAL)fail('총 용량 제한');
  if(!FORMATS.has(a.name.slice(a.name.lastIndexOf('.')+1).toLowerCase()))fail('지원하지 않는 확장자: '+a.name);
  if(a.expected_sha256!==undefined && !HEX.test(a.expected_sha256))fail('잘못된 예상 SHA-256');
 }
 return total;
}
export async function verifyFiles(projectId,assets){
 const total=validateNames(projectId,assets),rows=[];
 for(const a of assets){
  const bytes=u8(a.bytes),format=a.name.split('.').pop().toLowerCase();
  const digest=await core().hash(bytes);
  if(a.expected_sha256 && digest!==a.expected_sha256)fail('원본 SHA-256 불일치: '+a.name);
  const structure=inspectBytes(bytes,format);
  if(structure.status!=='PASS')fail('구조 검사 '+structure.status+': '+a.name+' ('+structure.reason+')');
  rows.push({id:a.id,file:'assets/'+a.name,format,byte_size:bytes.length,sha256:digest,byte_integrity:'PASS',structure_qa:'PASS',engine_import_qa:'UNKNOWN',rights_qa:'UNKNOWN',visual_audio_qa:'UNKNOWN',inspection_note:structure.reason});
 }
 rows.sort((a,b)=>a.file.localeCompare(b.file,'en'));
 const manifest={schema:'aldol-asset-byte-pipeline/1.0',project_id:projectId,asset_count:rows.length,total_bytes:total,assets:rows,qa:{byte_integrity:'PASS',structure_qa:'PASS',engine_import_qa:'UNKNOWN',rights_qa:'UNKNOWN',visual_audio_qa:'UNKNOWN'},source:'actual bytes in caller memory; not metadata-only',persistence:'none'};
 return {manifest,bytes_processed:total,files_read:assets.length};
}
function unzipStore(raw){
 const b=u8(raw),v=new DataView(b.buffer,b.byteOffset,b.length);if(b.length<22||b.length>MAX_TOTAL+5*1024*1024)fail('ZIP 크기 제한');
 const end=b.length-22;
 if(v.getUint32(end,true)!==0x06054b50||v.getUint16(end+20,true)!==0||v.getUint16(end+4,true)!==0||v.getUint16(end+6,true)!==0)fail('지원하지 않는 ZIP 종료 구조');
 const n=v.getUint16(end+10,true),centralAt=v.getUint32(end+16,true),centralLen=v.getUint32(end+12,true);
 if(n<3||n>MAX_ASSETS+2||v.getUint16(end+8,true)!==n||centralAt+centralLen!==end)fail('ZIP 중앙 목록 오류');
 const entries=new Map(),locals=[];let p=0,uncompressed=0;
 for(let i=0;i<n;i++){
  if(p+30>centralAt||v.getUint32(p,true)!==0x04034b50||v.getUint16(p+8,true)!==0||v.getUint16(p+6,true)!==0x800)fail('ZIP 압축/flags 미지원');
  const len=v.getUint32(p+18,true),flen=v.getUint16(p+26,true),extra=v.getUint16(p+28,true),start=p+30+flen+extra;
  if(v.getUint32(p+22,true)!==len||start+len>centralAt)fail('ZIP 로컬 엔트리 경계 오류');
  const name=dec.decode(b.subarray(p+30,p+30+flen)),data=b.subarray(start,start+len);
  if(!(name==='manifest.json'||name==='qa-report.json'||(name.startsWith('assets/')&&nameValid(name.slice(7))))||entries.has(name.toLowerCase()))fail('ZIP 경로/중복 차단');
  const crc=core().crc32(data);if(crc!==v.getUint32(p+14,true))fail('ZIP CRC 불일치: '+name);
  entries.set(name.toLowerCase(),{name,data});locals.push({name,at:p,size:len,crc});
  uncompressed+=len;if(uncompressed>MAX_TOTAL+5*1024*1024)fail('ZIP 전체 크기 제한');p=start+len;
 }
 if(p!==centralAt)fail('ZIP 로컬 엔트리 개수 불일치');p=centralAt;
 for(let i=0;i<n;i++){
  const x=locals[i];if(p+46>end||v.getUint32(p,true)!==0x02014b50||v.getUint16(p+10,true)!==0||v.getUint16(p+8,true)!==0x800)fail('ZIP 중앙 엔트리 오류');
  const flen=v.getUint16(p+28,true),extra=v.getUint16(p+30,true),comment=v.getUint16(p+32,true);
  if(p+46+flen+extra+comment>end||v.getUint32(p+16,true)!==x.crc||v.getUint32(p+20,true)!==x.size||v.getUint32(p+24,true)!==x.size||v.getUint32(p+42,true)!==x.at||dec.decode(b.subarray(p+46,p+46+flen))!==x.name)fail('ZIP 중앙/로컬 기록 불일치');
  p+=46+flen+extra+comment;
 }
 if(p!==end)fail('ZIP 뒤쪽 데이터 오류');return entries;
}
export async function verifyPack(pack){
 const entries=unzipStore(pack),m=entries.get('manifest.json'),qa=entries.get('qa-report.json');
 if(!m||!qa||m.data.length>2*1024*1024||qa.data.length>1024*1024)fail('Manifest/QA 누락 또는 제한 초과');
 let manifest,report;try{manifest=JSON.parse(dec.decode(m.data));report=JSON.parse(dec.decode(qa.data))}catch{fail('Manifest/QA JSON 오류')}
 if(manifest?.schema!=='aldol-asset-byte-pipeline/1.0'||report?.schema!=='aldol-byte-pipeline-qa/1.0'||manifest.asset_count!==entries.size-2)fail('Manifest/ZIP 구조 불일치');
 if(!Array.isArray(manifest.assets)||manifest.assets.length!==manifest.asset_count)fail('Manifest 에셋 목록 오류');
 const files=manifest.assets.map(a=>{
  if(typeof a?.file!=='string'||!a.file.startsWith('assets/')||!nameValid(a.file.slice(7))||!HEX.test(a.sha256)||!Number.isSafeInteger(a.byte_size)||a.byte_integrity!=='PASS'||a.structure_qa!=='PASS')fail('Manifest 항목 오류');
  const x=entries.get(a.file.toLowerCase());if(!x||x.name!==a.file||a.byte_size!==x.data.length)fail('Manifest 파일 불일치: '+a.file);
  return {id:a.id,name:a.file.slice(7),bytes:x.data,expected_sha256:a.sha256};
 });
 const {manifest:verified}=await verifyFiles(manifest.project_id,files);
 if(JSON.stringify(verified)!==JSON.stringify(manifest))fail('Manifest 내용 위변조 또는 schema 불일치');
 const expectedReport={schema:'aldol-byte-pipeline-qa/1.0',asset_count:verified.asset_count,content_integrity:'PASS',structure_qa:'PASS',zip_crc:'PASS',zip_readback:report.zip_readback,engine_import_qa:'UNKNOWN',rights_qa:'UNKNOWN',visual_audio_qa:'UNKNOWN',network_calls:0,storage_writes:0};
 if(!['PENDING','PASS'].includes(report.zip_readback)||JSON.stringify(report)!==JSON.stringify(expectedReport))fail('QA 보고서 내용 불일치');
 return {manifest:verified,report,files_read:files.length,zip_crc:'PASS',sha256_rechecked:'PASS',integrity:'PASS'};
}
export async function createPackage(projectId,assets){
 const {manifest}=await verifyFiles(projectId,assets);
 const report={schema:'aldol-byte-pipeline-qa/1.0',asset_count:manifest.asset_count,content_integrity:'PASS',structure_qa:'PASS',zip_crc:'PASS',zip_readback:'PENDING',engine_import_qa:'UNKNOWN',rights_qa:'UNKNOWN',visual_audio_qa:'UNKNOWN',network_calls:0,storage_writes:0};
 const entries=assets.map(a=>['assets/'+a.name,u8(a.bytes)]);
 entries.push(['manifest.json',enc.encode(JSON.stringify(manifest,null,2))]);
 entries.push(['qa-report.json',enc.encode(JSON.stringify(report,null,2))]);
 entries.sort((a,b)=>a[0].localeCompare(b[0],'en'));
 const archive=core().zipStore(entries);
 const replay=await verifyPack(archive);
 if(replay.integrity!=='PASS')fail('ZIP readback 실패');
 return {archive,sha256:await core().hash(archive),manifest,qa:{...report,zip_readback:'PASS'},readback:replay};
}
export const limits=Object.freeze({MAX_FILE,MAX_TOTAL,MAX_ASSETS,supported:[...FORMATS]});
