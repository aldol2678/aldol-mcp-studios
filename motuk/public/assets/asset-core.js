/* ALDOL Asset Core - candidate split from verified private Studio v5.1 snapshot.
 * NOT PUBLISHED; NO OPEN-SOURCE LICENSE GRANTED.
 * This is a STRUCTURAL VALIDATOR, not a sanitizer or engine/visual/rights attestation.
 */
(function(root, factory){
  'use strict';
  const api=factory(root);
  if(typeof module==='object' && module.exports)module.exports=api;
  else root.AldolAssetCore=api;
})(typeof globalThis==='undefined'?this:globalThis,function(env){
  'use strict';
  const MAX_ASSETS=500, MAX_FILE=20*1024*1024, MAX_TOTAL=80*1024*1024;
  const encode=new TextEncoder();
  const safePath = v => typeof v==='string' && !!v && !/[\\/\u0000-\u001f\u007f:]/.test(v) && !v.includes('..') && !/[. ]$/.test(v);
  const safeBasename = (name) => name.replace(/\\/g,'/').split('/').pop().replace(/[\u0000-\u001F]/g,'_');
  const extension = name => (name.split('.').pop()||'').toLowerCase();
  const slug = name => name.replace(/\.[^.]+$/,'').toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-|-$/g,'').slice(0,90) || 'asset';

  // Keep slug() stable for existing consumers; new file IDs include their format.
  const assetId = name => slug(name)+'.'+(extension(name).replace(/[^a-z0-9]/g,'').slice(0,9)||'bin');
  function uniqueAssetId(name,used=[]){const ext=assetId(name).split('.').pop(),base=slug(name);let id=base+'.'+ext,n=2;const ids=new Set(used);while(ids.has(id)){const suffix='-'+n++;id=base.slice(0,90-suffix.length)+suffix+'.'+ext;}return id;}

  function sha256Local(input){
    // SHA-256 fallback for HTTP-only internal previews. No file leaves the browser.
    const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    const h=new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
    const raw=new Uint8Array(Math.ceil((input.length+9)/64)*64);raw.set(input);raw[input.length]=128;
    const d=new DataView(raw.buffer);d.setUint32(raw.length-8,Math.floor(input.length/536870912));d.setUint32(raw.length-4,(input.length*8)>>>0);
    const ro=(v,n)=>(v>>>n)|(v<<(32-n)),w=new Uint32Array(64);
    for(let off=0;off<raw.length;off+=64){
      for(let i=0;i<16;i++)w[i]=d.getUint32(off+i*4);
      for(let i=16;i<64;i++){const x=w[i-15],y=w[i-2];w[i]=(w[i-16]+(ro(x,7)^ro(x,18)^(x>>>3))+w[i-7]+(ro(y,17)^ro(y,19)^(y>>>10)))>>>0}
      let [a,b,c,e0,e,f,g,z]=h;
      for(let i=0;i<64;i++){const t1=(z+(ro(e,6)^ro(e,11)^ro(e,25))+((e&f)^(~e&g))+K[i]+w[i])>>>0,t2=((ro(a,2)^ro(a,13)^ro(a,22))+((a&b)^(a&c)^(b&c)))>>>0;z=g;g=f;f=e;e=(e0+t1)>>>0;e0=c;c=b;b=a;a=(t1+t2)>>>0}
      for(const [i,v] of [a,b,c,e0,e,f,g,z].entries())h[i]=(h[i]+v)>>>0;
    }
    return Array.from(h,v=>v.toString(16).padStart(8,'0')).join('');
  }
  async function hash(bytes){if(env.crypto?.subtle){const data=await env.crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(data),v=>v.toString(16).padStart(2,'0')).join('')}return sha256Local(bytes)}
  const bytesEqual=(arr,bytes)=>bytes.every((b,i)=>arr[i]===b);

  function inspectSvg(raw, options={}){
    const Parser=options.DOMParser || env.DOMParser;
    if(!Parser)return ['UNKNOWN','SVG XML 파서를 사용할 수 없어요'];
    if(raw.length>1024*1024)return ['FAIL','SVG 1 MB 검사 제한 초과'];
    const s=new TextDecoder('utf-8',{fatal:true}).decode(raw);
    if(/<!DOCTYPE|<!ENTITY|<\?[^x]|<\?xml-stylesheet/i.test(s))return ['FAIL','DTD/엔터티/처리 명령이 포함돼 있어요'];
    const doc=new Parser().parseFromString(s,'application/xml');
    if(doc.querySelector('parsererror'))return ['FAIL','유효한 SVG XML이 아니에요'];
    const root=doc.documentElement;
    if(root?.localName!=='svg' || root.namespaceURI!=='http://www.w3.org/2000/svg')return ['FAIL','SVG 루트가 올바르지 않아요'];
    // DOMParser consumes the XML declaration, leaving real processing instructions.
    const pending=[doc];let nodeCount=0;
    while(pending.length){const node=pending.pop();if(++nodeCount>50000)return ['FAIL','SVG 노드 수 제한 초과'];if(node.nodeType===7)return ['FAIL','SVG 처리 명령 차단'];for(const child of node.childNodes)pending.push(child);}
    let unsupported=false;const ids=new Set();
    const elements=doc.getElementsByTagName('*');
    if(elements.length>10000)return ['FAIL','SVG 요소 수 제한 초과'];
    const banned=new Set(['script','foreignObject','iframe','object','embed','use','image','audio','video','animate','animateTransform','animateMotion','set','feImage','style','link']);
    const allowed=new Set(['svg','g','path','circle','rect','line','ellipse','polyline','polygon','defs','linearGradient','radialGradient','stop','clipPath','mask','title','desc','text','tspan','symbol','pattern']);
    for (const el of elements) {
      let depth=0;for(let p=el;p;p=p.parentElement)if(++depth>64)return ['FAIL','SVG 깊이 제한 초과'];
      if(el.attributes.length>64)return ['FAIL','SVG 속성 수 제한 초과'];
      if(el.hasAttribute('id')){const id=el.getAttribute('id');if(!/^[A-Za-z_][\w.-]*$/.test(id)||ids.has(id))return ['FAIL','잘못되거나 중복된 SVG ID'];ids.add(id);}
      if(el.namespaceURI!=='http://www.w3.org/2000/svg')return ['FAIL','외부 XML 네임스페이스'];
      if(banned.has(el.localName))return ['FAIL','스크립트·외부 참조·동적 콘텐츠 요소 차단: '+el.localName];
      if(!allowed.has(el.localName))unsupported=true;
      for(const a of el.attributes){
        const n=a.name.toLowerCase(),v=a.value.trim();
        if(n==='xmlns' && v==='http://www.w3.org/2000/svg')continue;
        if(n.startsWith('xmlns:') || n==='xml:base')return ['FAIL','외부 네임스페이스/기준 경로 차단'];
        if(n==='style'){
          const result=(options?.validateInlineStyle || env.ALDOLSvgStyleV51?.validateInlineStyle)?.(a.value);
          if(!result)return ['UNKNOWN','SVG 스타일 검증기를 사용할 수 없어요'];
          if(result.status==='FAIL')return ['FAIL',result.reason];
          if(result.status!=='PASS')unsupported=true;
          continue;
        }
        if(/[\\\u0000-\u001f\u007f]/.test(v))return ['FAIL','SVG 속성 이스케이프/제어문자 차단'];
        if(n.startsWith('on') || /(?:javascript:|data:|https?:|file:|ftp:|\\\\|\/\/)/i.test(v))return ['FAIL','이벤트/스타일/외부 경로 속성 차단: '+n];
        if(n.endsWith('href'))return ['FAIL','참조 속성 차단: '+n];
        if(/url\s*\(/i.test(v) && !/^url\(\s*['"]?#[A-Za-z_][\w.-]*['"]?\s*\)$/i.test(v))return ['FAIL','외부 리소스 URL 차단'];
        if(a.namespaceURI && !['http://www.w3.org/2000/xmlns/','http://www.w3.org/XML/1998/namespace'].includes(a.namespaceURI))unsupported=true;
      }
    }
    return unsupported?['UNKNOWN','지원되지 않는 SVG 표현이 포함되어 있어요']:['PASS','기본 수동 SVG 프로파일 통과 · 시각적 안전성 별도'];
  }
  function inspectPng(raw) {
    if(raw.length<45 || !bytesEqual(raw,[137,80,78,71,13,10,26,10]))return ['FAIL','잘못된 PNG 서명'];
    const d=new DataView(raw.buffer,raw.byteOffset,raw.byteLength);let o=8,first=true,idat=false,end=false;
    while(o<raw.length){
      if(o+12>raw.length)return ['FAIL','잘린 PNG 청크'];
      const n=d.getUint32(o),type=new TextDecoder().decode(raw.subarray(o+4,o+8));
      if(n>raw.length-o-12)return ['FAIL','PNG 청크 길이 초과'];
      if(crc32(raw.subarray(o+4,o+8+n))!==d.getUint32(o+8+n))return ['FAIL','PNG CRC 불일치'];
      if(first){if(type!=='IHDR'||n!==13)return ['FAIL','PNG IHDR 누락'];
        const w=d.getUint32(o+8),h=d.getUint32(o+12);if(!w||!h||w*h>16777216||w>8192||h>8192)return ['FAIL','PNG 해상도 제한 초과'];first=false;
      }else if(type==='IHDR')return ['FAIL','중복 PNG IHDR'];
      if(type==='IDAT')idat=true;
      o+=12+n;if(type==='IEND'){if(n!==0||o!==raw.length)return ['FAIL','잘못된 PNG 종료'];end=true;break;}
    }
    return idat&&end?['PASS','PNG 청크 CRC 통과']:['FAIL','PNG IDAT/IEND 누락'];
  }
  function inspectWav(raw){
    if(raw.length<44||raw.length>20971520)return ['FAIL','WAV 길이 제한'];
    const d=new DataView(raw.buffer,raw.byteOffset,raw.byteLength);
    const str=(o,n)=>String.fromCharCode(...raw.subarray(o,o+n));
    if(str(0,4)!=='RIFF'||str(8,4)!=='WAVE'||d.getUint32(4,true)!==raw.length-8)return ['FAIL','RIFF/WAVE 헤더 불일치'];
    let off=12,fmt=null,dataBytes=null,chunks=0;
    while(off<raw.length){if(off+8>raw.length)return ['FAIL','잘린 WAV 청크'];
      const kind=str(off,4),len=d.getUint32(off+4,true);off+=8;
      if(len>raw.length-off)return ['FAIL','WAV 청크 길이 초과'];
      if(kind==='fmt '){if(fmt||len<16)return ['FAIL','WAV fmt 청크 중복/오류'];fmt={codec:d.getUint16(off,true),channels:d.getUint16(off+2,true),rate:d.getUint32(off+4,true),byteRate:d.getUint32(off+8,true),align:d.getUint16(off+12,true),bits:d.getUint16(off+14,true)};}
      if(kind==='data'){if(dataBytes!==null)return ['FAIL','WAV data 중복'];dataBytes=len;}
      off+=len+(len%2);chunks++;if(chunks>128||off>raw.length)return ['FAIL','WAV 청크 경계 오류'];
    }
    if(off!==raw.length||!fmt||!dataBytes)return ['FAIL','WAV 필수 청크 없음'];
    if(!((fmt.codec===1&&[8,16,24,32].includes(fmt.bits))||(fmt.codec===3&&fmt.bits===32))||![1,2].includes(fmt.channels)||fmt.rate<8000||fmt.rate>96000)return ['UNKNOWN','지원하지 않는 WAV PCM 형식'];
    if(fmt.align!==fmt.channels*fmt.bits/8||fmt.byteRate!==fmt.rate*fmt.align||dataBytes%fmt.align)return ['FAIL','WAV 샘플 정렬 오류'];
    return ['PASS','WAV PCM 헤더/청크 구조 PASS · 청음/게임 import UNKNOWN'];
  }
  function inspectGlb(raw) {
    if(raw.length<20)return ['FAIL','GLB 최소 길이보다 작아요'];
    const d=new DataView(raw.buffer,raw.byteOffset,raw.byteLength);
    if(!bytesEqual(raw,[0x67,0x6c,0x54,0x46]))return ['FAIL','GLB 매직 오류'];
    if(d.getUint32(4,true)!==2)return ['UNKNOWN','GLB v2만 지원'];
    if(d.getUint32(8,true)!==raw.length)return ['FAIL','GLB 헤더 길이 오류'];
    let o=12,first=true,json=null,bin=false;
    while(o<raw.length){
      if(o+8>raw.length)return ['FAIL','GLB 청크 잘림'];
      const n=d.getUint32(o,true),t=d.getUint32(o+4,true);o+=8;
      if(n%4||n>raw.length-o)return ['FAIL','GLB 청크 길이/정렬 오류'];
      if(first){if(t!==0x4e4f534a)return ['FAIL','GLB JSON 청크 누락'];
        try{json=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw.subarray(o,o+n)).trim())}catch{return ['FAIL','GLB JSON 오류']}
        if(json.asset?.version!=='2.0')return ['FAIL','GLB asset.version 오류'];first=false;
      }else if(t!==0x004e4942||bin)return ['UNKNOWN','지원되지 않는 GLB 청크'];else bin=true;
      o+=n;
    }
    const hasUri=v=>v && typeof v==='object' && Object.entries(v).some(([k,x])=>k==='uri'||hasUri(x));
    if(hasUri(json))return ['FAIL','GLB 외부/내장 URI 참조 차단'];
    return ['PASS','GLB v2 기본 구조 통과 · 메시/텍스처 런타임 미검증'];
  }

  function crc32(data){let crc=0xffffffff;for(const val of data){crc^=val;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}return (crc^0xffffffff)>>>0}
  function concat(parts){const n=parts.reduce((s,p)=>s+p.byteLength,0),arr=new Uint8Array(n);let offset=0;for(const p of parts){arr.set(p,offset);offset+=p.byteLength}return arr}
  function zipStore(entries){
    // Deterministic uncompressed ZIP with CRC32, no remote dependencies. Reject 4 GiB/ZIP64.
    const local=[],central=[];let offset=0;const dosDate=(1<<5)|1,dosTime=0;
    if(entries.length>MAX_ASSETS+16)throw Error('ZIP 항목 제한 초과');
    const seen=new Set();
    for(const [filename,raw] of entries){if(!/^(assets\/)?[^/]+$/.test(filename)||!safePath(filename.replace(/^assets\//,''))||seen.has(filename.toLowerCase()))throw Error('ZIP 경로/중복 오류');seen.add(filename.toLowerCase());const data=ArrayBuffer.isView(raw)&&raw.BYTES_PER_ELEMENT===1?new Uint8Array(raw.buffer,raw.byteOffset,raw.byteLength):encode.encode(raw),path=encode.encode(filename),crc=crc32(data);if(path.length>65535)throw Error('ZIP 파일명 길이 초과');
      const lh=new Uint8Array(30+path.length),lv=new DataView(lh.buffer);lv.setUint32(0,0x04034b50,true);lv.setUint16(4,20,true);lv.setUint16(6,0x800,true);lv.setUint16(10,dosTime,true);lv.setUint16(12,dosDate,true);lv.setUint32(14,crc,true);lv.setUint32(18,data.length,true);lv.setUint32(22,data.length,true);lv.setUint16(26,path.length,true);lh.set(path,30);local.push(lh,data);
      const ch=new Uint8Array(46+path.length),cv=new DataView(ch.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x800,true);cv.setUint16(12,dosTime,true);cv.setUint16(14,dosDate,true);cv.setUint32(16,crc,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,path.length,true);cv.setUint32(42,offset,true);ch.set(path,46);central.push(ch);offset+=lh.length+data.length;
    }
    const center=concat(central);const end=new Uint8Array(22);const d=new DataView(end.buffer);d.setUint32(0,0x06054b50,true);d.setUint16(8,central.length,true);d.setUint16(10,central.length,true);d.setUint32(12,center.length,true);d.setUint32(16,offset,true);
    return concat([...local,center,end]);
  }

  return Object.freeze({
    version:'0.1.0-split-candidate',limits:Object.freeze({MAX_ASSETS,MAX_FILE,MAX_TOTAL}),
    safePath,safeBasename,extension,slug,assetId,uniqueAssetId,sha256Local,hash,crc32,
    inspectSvg,inspectPng,inspectGlb,inspectWav,zipStore
  });
});
