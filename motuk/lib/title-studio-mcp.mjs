/* MOTUK Title Studio MCP P0. Stateless, no network, storage, browser IDB or privileged asset access. */
import {GAME_CSS,GAME_JS} from './title-export-templates.mjs';

const SCHEMA='motuk.title-studio.v1';
const MAX_INLINE=131072;
const PRESETS=Object.freeze({hybrid:{titleX:13,titleY:23,menuX:13,menuY:56},cinematic:{titleX:50,titleY:17,menuX:50,menuY:62},poster:{titleX:8,titleY:14,menuX:8,menuY:68}});
const allowedKeys=new Set(['schema','title','english','menus','preset','device','bg','bgName','accent','titleSize','menuSize','shade','titleX','titleY','menuX','menuY']);
const patchKeys=new Set(['title','english','menus','preset','device','bg','bgName','accent','titleSize','menuSize','shade','titleX','titleY','menuX','menuY']);
const enc=new TextEncoder();
const obj=(props,required=[])=>({type:'object',properties:props,required,additionalProperties:false});
const str=(maxLength)=>({type:'string',minLength:1,maxLength});
const projectSchema=obj({schema:{type:'string',enum:[SCHEMA]},title:str(32),english:str(48),menus:{type:'array',minItems:1,maxItems:6,items:str(18)},preset:{type:'string',enum:['hybrid','cinematic','poster']},device:{type:'string',enum:['desktop','mobile']},bg:{type:'string',maxLength:164000,description:'Optional embedded PNG/JPEG/WebP data URI; no network URL'},bgName:str(75),accent:{type:'string',pattern:'^#[0-9a-fA-F]{6}$'},titleSize:{type:'number',minimum:36,maximum:104},menuSize:{type:'number',minimum:14,maximum:30},shade:{type:'number',minimum:0,maximum:70},titleX:{type:'number',minimum:0,maximum:95},titleY:{type:'number',minimum:0,maximum:95},menuX:{type:'number',minimum:0,maximum:95},menuY:{type:'number',minimum:0,maximum:95}},['schema','title','english','menus','preset','device']);
const changesSchema=obj(Object.fromEntries(Object.entries(projectSchema.properties).filter(([k])=>patchKeys.has(k))));
export const titleTools=[
 {name:'title_create',description:'Create an editable MOTUK Title Studio v1 JSON project. Stateless: does not save to the browser or server.',inputSchema:obj({title:str(32),english:str(48),menus:projectSchema.properties.menus,preset:projectSchema.properties.preset,device:projectSchema.properties.device,accent:projectSchema.properties.accent},['title'])},
 {name:'title_preview',description:'Return a deterministic schematic SVG preview of a supplied Title Studio project; not a browser screenshot or full asset rendering.',inputSchema:obj({project:projectSchema},['project'])},
 {name:'title_update',description:'Apply validated, nonpersistent changes to a Title Studio project JSON and return the updated project.',inputSchema:obj({project:projectSchema,changes:changesSchema},['project','changes'])},
 {name:'title_export',description:'Export a Title Studio project as JSON, self-contained HTML, SVG or ZIP (HTML/CSS/JS/project JSON/assets). Inline delivery max 128 KiB, no persistence or external uploads.',inputSchema:obj({project:projectSchema,format:{type:'string',enum:['json','html','svg','zip']}},['project','format'])}
].map(t=>({...t,annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}}));

function isRecord(o){return o!==null&&typeof o==='object'&&!Array.isArray(o)}
function rejectExtras(o,keys){if(!isRecord(o))throw Error('Expected object');for(const k of Object.keys(o))if(!keys.has(k))throw Error('Unexpected field: '+k);}
function cleanText(s,n,label){if(typeof s!=='string'||!s.trim()||s.length>n||/[\u0000-\u001f\u007f]/.test(s))throw Error('Invalid '+label);return s.trim();}
function validateMenus(v){if(!Array.isArray(v)||v.length<1||v.length>6)throw Error('menus: 1–6 entries required');return v.map(x=>cleanText(x,18,'menu label'));}
function number(v,a,b,label){if(typeof v!=='number'||!Number.isFinite(v)||v<a||v>b)throw Error('Invalid '+label);return v;}
function imageBg(uri){
 if(typeof uri!=='string'||uri.length>164000)throw Error('Background data URI exceeds input limit');
 const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(uri);
 if(!match)throw Error('Only embedded base64 PNG/JPEG/WebP are accepted; URLs and SVG are not accepted');
 const data=match[2];if(data.length%4!==0)throw Error('Invalid base64 length');
 let bytes;try{const raw=atob(data);bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));}catch{throw Error('Invalid base64');}
 if(bytes.length>122880||bytes.length<12)throw Error('Background byte-size limit');
 if(bytes.length<1024 && btoa(String.fromCharCode(...bytes))!==data)throw Error('Noncanonical base64');
 const format=match[1];const eq=(arr)=>arr.every((x,i)=>bytes[i]===x);
 if(format==='png'&&!eq([137,80,78,71,13,10,26,10]))throw Error('Invalid PNG signature');
 if(format==='jpeg'&&!eq([255,216,255]))throw Error('Invalid JPEG signature');
 if(format==='webp'&&(!eq([82,73,70,70])||String.fromCharCode(...bytes.subarray(8,12))!=='WEBP'))throw Error('Invalid WebP signature');
 return {uri,bytes,extension:{png:'png',jpeg:'jpg',webp:'webp'}[format]};
}
function projectValidation(p){
 rejectExtras(p,allowedKeys);
 if(p.schema!==SCHEMA)throw Error('Unsupported project schema');
 const preset=p.preset,device=p.device;if(!Object.hasOwn(PRESETS,preset))throw Error('Invalid preset');if(!['desktop','mobile'].includes(device))throw Error('Invalid device');
 const result={schema:SCHEMA,title:cleanText(p.title,32,'title'),english:cleanText(p.english,48,'english'),menus:validateMenus(p.menus),preset,device,
  bgName:cleanText(p.bgName===undefined?'샘플 광산 풍경':p.bgName,75,'bgName'),accent:p.accent===undefined?'#ffc78a':p.accent,titleSize:number(p.titleSize===undefined?72:p.titleSize,36,104,'titleSize'),menuSize:number(p.menuSize===undefined?19:p.menuSize,14,30,'menuSize'),shade:number(p.shade===undefined?28:p.shade,0,70,'shade'),
  titleX:number(p.titleX===undefined?PRESETS[preset].titleX:p.titleX,0,95,'titleX'),titleY:number(p.titleY===undefined?PRESETS[preset].titleY:p.titleY,0,95,'titleY'),menuX:number(p.menuX===undefined?PRESETS[preset].menuX:p.menuX,0,95,'menuX'),menuY:number(p.menuY===undefined?PRESETS[preset].menuY:p.menuY,0,95,'menuY')};
 if(!/^#[\da-f]{6}$/i.test(result.accent))throw Error('Invalid accent');
 if(p.bg!==undefined)result.bg=imageBg(p.bg).uri;
 return result;
}
function defaultProject(arg){
 rejectExtras(arg,new Set(['title','english','menus','preset','device','accent']));
 const title=cleanText(arg.title,32,'title');const english=cleanText(arg.english??'GAME',48,'english');const preset=arg.preset??'hybrid';
 if(!Object.hasOwn(PRESETS,preset))throw Error('Unsupported preset');
 return projectValidation({schema:SCHEMA,title,english,menus:arg.menus??['게임 시작','설정'],preset,device:arg.device??'desktop',accent:arg.accent??'#ffc78a'});
}
const htmlEsc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const xmlEsc=htmlEsc;
function sampleBg(){return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#17182d"/><stop offset=".7" stop-color="#3e3654"/><stop offset="1" stop-color="#7b5266"/></linearGradient></defs><rect width="1280" height="720" fill="url(#sky)"/><circle cx="984" cy="188" r="97" fill="#c9acac" opacity=".75"/><path fill="#241d35" d="M0 400L150 296 266 386 470 252 652 383 865 265 1100 358 1280 260V720H0Z"/><path fill="#1a1c30" d="M0 504L209 420 410 530 625 395 840 520 1040 390 1280 508V720H0Z"/><path fill="#131524" d="M0 620L154 556 335 620 520 546 710 611 890 565 1120 623 1280 560V720H0Z"/><path d="M865 466l48 41 24-25 30 60" fill="none" stroke="#8de2db" stroke-width="13" opacity=".7"/><path d="M1075 606l29-62 27 52 27-36 27 58" fill="none" stroke="#a98be0" stroke-width="13" opacity=".8"/></svg>`;}
function svgPreview(p){
 const W=1280,H=p.device==='mobile'?591:720;
 const bg=p.bg&&p.bg.length<=24000?`<image href="${xmlEsc(p.bg)}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`:`<rect width="${W}" height="${H}" fill="#24243c"/><path d="M0 ${H*.65}L260 ${H*.36} 540 ${H*.66} 810 ${H*.28} ${W} ${H*.54} V${H}H0Z" fill="#17172b"/><circle cx="${W*.76}" cy="${H*.23}" r="${H*.12}" fill="#857693" opacity=".8"/>`;
 const menus=p.menus.map((m,i)=>{const x=p.preset==='poster'?p.menuX/100*W+i*185:p.menuX/100*W;
 const y=p.preset==='poster'?p.menuY/100*H:p.menuY/100*H+i*(p.menuSize+29);const w=Math.max(140,m.length*18+32);
 return `<g><rect x="${Math.min(W-20,x)}" y="${y}" width="${w}" height="${p.menuSize+23}" rx="6" fill="${i===0?p.accent:'#1c2030'}" opacity="${i===0?1:'.86'}"/><text x="${x+15}" y="${y+p.menuSize+5}" fill="${i===0?'#221b1a':'#ffffff'}" font-family="sans-serif" font-size="${p.menuSize}" font-weight="bold">${xmlEsc(m)}</text></g>`;}).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${xmlEsc(p.title)} title preview">${bg}<rect width="${W}" height="${H}" fill="#0a0d18" opacity="${p.shade/100}"/><text x="${p.titleX/100*W}" y="${p.titleY/100*H+p.titleSize}" fill="#fff1df" font-family="serif" font-weight="bold" font-size="${p.titleSize}">${xmlEsc(p.title)}</text><text x="${p.titleX/100*W}" y="${p.titleY/100*H+p.titleSize+29}" fill="${p.accent}" font-family="sans-serif" font-weight="bold" font-size="18" letter-spacing="4">${xmlEsc(p.english)}</text>${menus}</svg>`;
}
function safeJSON(o){return JSON.stringify(o).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');}
function htmlDoc(p,background,inline){
 const config={...p,background};delete config.bg;
 const css=inline?`<style>${GAME_CSS}</style>`:'<link rel="stylesheet" href="styles.css">';
 const js=inline?`<script>${GAME_JS.replace(/<\//g,'<\\/')}</script>`:'<script src="main.js" defer></script>';
 return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#15141d"><title>${htmlEsc(p.title)} | ${htmlEsc(p.english)}</title>${css}</head><body><main class="screen" data-preset="${p.preset}" data-device="${p.device}"><div class="scene"><div class="shade"></div><div class="title"><h1></h1><p></p></div><nav class="buttons" aria-label="메인 메뉴"></nav></div></main><div class="overlay" role="dialog" aria-modal="true" aria-label="게임 동작 연결 안내"><div class="modal"><h2>메뉴 동작 안내</h2><p id="modal-message"></p><button id="close-modal" type="button">닫기</button></div></div><script>window.MOTUK_TITLE_CONFIG=${safeJSON(config)};</script>${js}</body></html>`;
}
let crcTable;
function crc32(buf){if(!crcTable){crcTable=Array.from({length:256},(_,i)=>{let c=i;for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0);return c>>>0;});}let c=0xffffffff;for(const b of buf)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function zipStore(files){
 const parts=[],central=[],names=Object.keys(files);let offset=0;
 const u16=(a,n)=>a.push(n&255,(n>>8)&255),u32=(a,n)=>a.push(n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255);
 for(const [name,data] of Object.entries(files)){
  const path=enc.encode(name),b=typeof data==='string'?enc.encode(data):data;if(path.length>65535)throw Error('ZIP filename too long');
  const crc=crc32(b),hdr=[];u32(hdr,0x04034b50);u16(hdr,20);u16(hdr,0x800);u16(hdr,0);u16(hdr,0);u16(hdr,0);u32(hdr,crc);u32(hdr,b.length);u32(hdr,b.length);u16(hdr,path.length);u16(hdr,0);
  parts.push(new Uint8Array(hdr),path,b);const cen=[];u32(cen,0x02014b50);u16(cen,20);u16(cen,20);u16(cen,0x800);u16(cen,0);u16(cen,0);u16(cen,0);u32(cen,crc);u32(cen,b.length);u32(cen,b.length);u16(cen,path.length);u16(cen,0);u16(cen,0);u16(cen,0);u16(cen,0);u32(cen,0);u32(cen,offset);central.push(new Uint8Array(cen),path);offset+=hdr.length+path.length+b.length;
 }
 const centralSize=central.reduce((n,a)=>n+a.length,0),tail=[];u32(tail,0x06054b50);u16(tail,0);u16(tail,0);u16(tail,names.length);u16(tail,names.length);u32(tail,centralSize);u32(tail,offset);u16(tail,0);
 const len=[...parts,...central,new Uint8Array(tail)].reduce((n,a)=>n+a.length,0),out=new Uint8Array(len);let pos=0;for(const part of [...parts,...central,new Uint8Array(tail)]){out.set(part,pos);pos+=part.length;}return out;
}
const b64=bytes=>{let s='';for(let i=0;i<bytes.length;i+=4096)s+=String.fromCharCode(...bytes.subarray(i,i+4096));return btoa(s);};
const digest=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
function exportBytes(p,format){
 if(format==='json')return {bytes:enc.encode(JSON.stringify(p,null,2)),name:'motuk-title-project.json',mime:'application/json',files:['motuk-title-project.json']};
 if(format==='svg')return {bytes:enc.encode(svgPreview(p)),name:'motuk-title-preview.svg',mime:'image/svg+xml',files:['motuk-title-preview.svg']};
 const background=p.bg?imageBg(p.bg):null;
 const asset=background?{name:'assets/background.'+background.extension,bytes:background.bytes,data:background.uri}:{name:'assets/background.svg',bytes:enc.encode(sampleBg()),data:'data:image/svg+xml;base64,'+b64(enc.encode(sampleBg()))};
 if(format==='html')return {bytes:enc.encode(htmlDoc(p,asset.data,true)),name:'motuk-title.html',mime:'text/html',files:['motuk-title.html']};
 if(format==='zip'){
  const files={'index.html':htmlDoc(p,asset.name,false),'styles.css':GAME_CSS,'main.js':GAME_JS,'project.json':JSON.stringify(p,null,2),'README.txt':'MOTUK Title Studio MCP P0. Open index.html in a browser.\nMenu buttons emit motuk:title-action for integration with a game; no browser or server state is modified.\nIf your project included no background, assets/background.svg is a generated placeholder, not the actual game artwork.\n',[asset.name]:asset.bytes};
  return {bytes:zipStore(files),name:'motuk-title-studio.zip',mime:'application/zip',files:Object.keys(files)};
 }
 throw Error('Unsupported export format');
}
export async function runTitleTool(name,args){
 if(!titleTools.some(t=>t.name===name))throw Error('Unsupported title tool');
 if(!isRecord(args))throw Error('Arguments must be an object');
 if(name==='title_create'){
  const p=defaultProject(args);return {project:p,importable_in:'/title-studio',persisted:false,background:'EDITOR_SAMPLE_ON_IMPORT',rights_qa:'UNKNOWN'};
 }
 if(name==='title_preview'){
  rejectExtras(args,new Set(['project']));const p=projectValidation(args.project);
  return {schema:SCHEMA,preview_svg:svgPreview(p),width:1280,height:p.device==='mobile'?591:720,preview_fidelity:'SCHEMATIC',background_embedded:!!p.bg&&p.bg.length<=24000,rendered_in_browser:false,persisted:false};
 }
 if(name==='title_update'){
  rejectExtras(args,new Set(['project','changes']));const p=projectValidation(args.project);rejectExtras(args.changes,patchKeys);
  const c=args.changes;if(!Object.keys(c).length)throw Error('Empty changes');
  const changed={...p,...c};
  if(c.preset!==undefined&&c.preset!==p.preset){if(!Object.hasOwn(PRESETS,c.preset))throw Error('Invalid preset');for(const [k,v]of Object.entries(PRESETS[c.preset]))if(c[k]===undefined)changed[k]=v;}
  const next=projectValidation(changed);return {project:next,changed_keys:Object.keys(c),persisted:false,editor_sync:'IMPORT_JSON_MANUALLY'};
 }
 rejectExtras(args,new Set(['project','format']));const p=projectValidation(args.project),format=args.format;
 const {bytes,name:filename,mime,files}=exportBytes(p,format);
 if(bytes.length>MAX_INLINE)return {status:'INLINE_LIMIT_EXCEEDED',file_name:filename,mime_type:mime,byte_size:bytes.length,files,inline_base64:null,limit_bytes:MAX_INLINE,persisted:false,alternative:'Use the browser editor export; MCP does not upload or store large files.'};
 return {status:'INLINE_BASE64',file_name:filename,mime_type:mime,byte_size:bytes.length,sha256:await digest(bytes),inline_base64:b64(bytes),files,content_integrity:'ACTUAL_OUTPUT_SHA256',visual_qa:'UNKNOWN',engine_integration_qa:'UNKNOWN',rights_qa:'UNKNOWN',persisted:false,external_calls:0};
}
