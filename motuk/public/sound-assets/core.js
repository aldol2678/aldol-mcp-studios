(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AldolSound = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = '0.1.0';
  const PRESETS = Object.freeze({
    fire: {name:'불꽃', description:'짧은 점화, 거친 불꽃, 낮은 잔향', duration:1.1, tone:0.42, intensity:0.7, color:'#ff9865'},
    water: {name:'물결', description:'부드럽게 쓸고 지나가는 물결', duration:1.3, tone:0.45, intensity:0.6, color:'#6ed4e5'},
    light: {name:'빛', description:'맑은 반짝임과 유리 같은 잔향', duration:1.25, tone:0.6, intensity:0.55, color:'#ffe3a0'},
    break: {name:'블록 파괴', description:'단단한 충격 뒤 부서지는 파편', duration:0.55, tone:0.35, intensity:0.75, color:'#c4b5a1'},
    button: {name:'버튼', description:'짧고 부드러운 선택음', duration:0.13, tone:0.55, intensity:0.4, color:'#a6dac3'},
    clear: {name:'클리어', description:'차례로 올라가는 밝은 네 음', duration:1.65, tone:0.5, intensity:0.6, color:'#edb8d8'}
  });
  function number(v, lo, hi, name) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) throw new Error(name+' must be '+lo+'..'+hi);
    return v;
  }
  function recipe(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('recipe must be an object');
    if (!Object.hasOwn(PRESETS,input.preset)) throw new Error('Unknown preset');
    const allowed=['preset','duration','tone','intensity','seed','sampleRate'];
    for (const k of Object.keys(input)) if (!allowed.includes(k)) throw new Error('Unknown recipe field: '+k);
    const p=PRESETS[input.preset];
    const r={preset:input.preset,duration:input.duration??p.duration,tone:input.tone??p.tone,intensity:input.intensity??p.intensity,seed:input.seed??20261027,sampleRate:input.sampleRate??44100};
    number(r.duration,0.08,6,'duration'); number(r.tone,0,1,'tone'); number(r.intensity,0,1,'intensity'); number(r.seed,0,4294967295,'seed');
    if (!Number.isInteger(r.seed)) throw new Error('seed must be an integer');
    if (![22050,44100,48000].includes(r.sampleRate)) throw new Error('Unsupported sampleRate');
    return r;
  }
  function random(seed) {
    let s=seed>>>0;
    return function(){s=(s+0x6D2B79F5)|0;let t=Math.imul(s^(s>>>15),1|s);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296;};
  }
  const TAU=Math.PI*2;
  function synth(input) {
    const r=recipe(input), sr=r.sampleRate, n=Math.round(r.duration*sr), data=new Float32Array(n), rnd=random(r.seed);
    let lp=0,slow=0,phase=0;
    const pitch=Math.pow(2,(r.tone-.5)*2), variation=.96+rnd()*.08;
    const sparks=Array.from({length:18},()=>({t:rnd()*.88,f:(500+rnd()*2200)*pitch,a:.2+rnd()*.8}));
    for(let i=0;i<n;i++){
      const t=i/sr,u=i/(n-1), noise=rnd()*2-1;
      lp+=.10*(noise-lp);slow+=.012*(noise-slow);
      let v=0;
      if(r.preset==='fire'){
        const swell=(1-Math.exp(-u*42))*Math.pow(1-u,1.6);
        const cutoff=.045+r.tone*.30;
        // Independent filter envelope, noisy flame + descending ignition body.
        v=(lp*2.4+noise*cutoff+Math.sin(TAU*(72*pitch*t-20*pitch*t*t/r.duration))*Math.exp(-u*9)*.26)*swell;
        for(const s of sparks){const d=u-s.t;if(d>=0&&d<.025)v+=Math.sin(TAU*s.f*d*r.duration)*Math.exp(-d*260)*s.a*.10;}
      }else if(r.preset==='water'){
        const swell=Math.pow(Math.sin(Math.PI*u),1.5);
        v=(lp*1.3+slow*2.2)*swell*(.75+.25*Math.sin(TAU*3.2*u));
        for(let k=0;k<7;k++){const st=.08+k*.11, d=u-st;if(d>=0&&d<.20){const f=(260+80*k)*pitch;v+=.11*Math.sin(TAU*f*r.duration*(d+1.8*d*d))*Math.exp(-d*25)*(1-Math.exp(-d*300));}}
      }else if(r.preset==='light'){
        for(let k=0;k<5;k++){const d=t-k*r.duration*.055;if(d>=0){const f=[1046.5,1568,2093,2637,3136][k]*pitch*variation;v+=(Math.sin(TAU*f*d)+.22*Math.sin(TAU*f*2.73*d))*.14*Math.exp(-d/(r.duration*.24))*(1-Math.exp(-d*650));}}
      }else if(r.preset==='break'){
        phase+=TAU*(55+135*Math.exp(-u*22))*pitch/sr;
        v=Math.sin(phase)*Math.exp(-u*14)*.65+noise*Math.exp(-u*23)*.20+lp*Math.exp(-u*6)*.60;
        for(const s of sparks){const d=u-s.t*.6;if(d>=0&&d<.055)v+=Math.sin(TAU*s.f*d*r.duration)*Math.exp(-d*120)*s.a*.13;}
      }else if(r.preset==='button'){
        phase+=TAU*(420+400*Math.exp(-u*5))*pitch*variation/sr;
        v=(Math.sin(phase)+.1*Math.sin(phase*2))*Math.sin(Math.PI*u)*Math.exp(-u*4)*.85;
      }else if(r.preset==='clear'){
        for(let k=0;k<4;k++){const d=t-k*r.duration*.15;if(d>=0){const f=[523.25,659.25,783.99,1046.5][k]*pitch*variation;v+=(Math.sin(TAU*f*d)+.28*Math.sin(TAU*f*2*d)+.10*Math.sin(TAU*f*3*d))*.22*Math.exp(-d/(r.duration*.23))*(1-Math.exp(-d*350));}}
      }
      const edge=Math.min(1,i/(sr*.004),(n-1-i)/(sr*.012));
      data[i]=v*Math.max(0,edge)*(.32+.68*r.intensity);
    }
    // DC removal with edge fades maintained; headroom normalization never increases a near-silent signal.
    let mean=0;for(const v of data)mean+=v;mean/=n;
    let peak=0;for(let i=0;i<n;i++){const e=Math.min(1,i/(sr*.004),(n-1-i)/(sr*.012));data[i]-=mean*Math.max(0,e);peak=Math.max(peak,Math.abs(data[i]));}
    const target=.35+.45*r.intensity, scale=peak>1e-7?target/peak:1;
    for(let i=0;i<n;i++)data[i]*=scale;
    return {samples:data,sampleRate:sr,recipe:r,processing:null,processingHistory:[]};
  }
  function processAudio(audio,opts={}){
    if(!audio||!audio.samples||audio.samples.length<2||audio.samples.length>48000*6)throw new Error('Audio must contain 2..288000 samples');
    if(![22050,44100,48000].includes(audio.sampleRate))throw new Error('Unsupported sample rate');
    const allowed=['gain','normalize','trim','fadeInMs','fadeOutMs'];for(const k of Object.keys(opts))if(!allowed.includes(k))throw new Error('Unknown processing field: '+k);
    const o={gain:opts.gain??1,normalize:opts.normalize??false,trim:opts.trim??false,fadeInMs:opts.fadeInMs??4,fadeOutMs:opts.fadeOutMs??12};
    number(o.gain,0,2,'gain');number(o.fadeInMs,0,500,'fadeInMs');number(o.fadeOutMs,0,500,'fadeOutMs');
    if(typeof o.normalize!=='boolean'||typeof o.trim!=='boolean')throw new Error('normalize and trim must be boolean');
    let data=Float32Array.from(audio.samples);for(const v of data)if(!Number.isFinite(v))throw new Error('Non-finite sample');
    if(o.trim){let a=0,b=data.length-1;while(a<b&&Math.abs(data[a])<.001)a++;while(b>a&&Math.abs(data[b])<.001)b--;if(b-a>1)data=data.slice(Math.max(0,a-32),Math.min(data.length,b+33));}
    let peak=0;for(const v of data)peak=Math.max(peak,Math.abs(v));
    const g=o.gain*(o.normalize&&peak>1e-7?.8/peak:1);
    for(let i=0;i<data.length;i++){const a=o.fadeInMs?Math.min(1,i/(audio.sampleRate*o.fadeInMs/1000)):1,b=o.fadeOutMs?Math.min(1,(data.length-1-i)/(audio.sampleRate*o.fadeOutMs/1000)):1;data[i]=Math.max(-.95,Math.min(.95,data[i]*g*a*b));}
    return {samples:data,sampleRate:audio.sampleRate,recipe:audio.recipe,processing:o,processingHistory:[...(audio.processingHistory||[]),o]};
  }
  function stats(audio){let peak=0,sum=0,clipped=0;for(const v of audio.samples){peak=Math.max(peak,Math.abs(v));sum+=v*v;if(Math.abs(v)>=1)clipped++;}return {durationSeconds:audio.samples.length/audio.sampleRate,sampleRate:audio.sampleRate,sampleCount:audio.samples.length,peak,peakDb:peak?20*Math.log10(peak):null,rms:Math.sqrt(sum/audio.samples.length),clippedSamples:clipped};}
  function wav(audio){
    const n=audio.samples.length, buf=new ArrayBuffer(44+n*2),v=new DataView(buf),str=(p,s)=>{for(let i=0;i<s.length;i++)v.setUint8(p+i,s.charCodeAt(i));};
    str(0,'RIFF');v.setUint32(4,36+n*2,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,audio.sampleRate,true);v.setUint32(28,audio.sampleRate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,n*2,true);
    for(let i=0;i<n;i++){const x=Math.max(-1,Math.min(1,audio.samples[i]));v.setInt16(44+i*2,Math.round(x*(x<0?32768:32767)),true);}return new Uint8Array(buf);
  }
  function crc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
  function hash(audio){return crc32(wav(audio)).toString(16).padStart(8,'0');}
  function manifest(entries){return {schema:'aldol.sound-pack/v1',engine:'aldol-procedural',engineVersion:VERSION,format:'pcm_s16le',channels:1,externalSamples:false,assets:entries.map(({audio,filename})=>({filename,type:'audio',mimeType:'audio/wav',recipe:audio.recipe,processing:audio.processing,processingHistory:audio.processingHistory||[],stats:stats(audio),crc32:hash(audio),provenance:{method:'procedural_synthesis',externalApi:false,externalSamples:false,rightsNote:'No third-party source samples. This is a technical provenance record, not a legal rights certification.'}}))};}
  // ZIP STORE encoder shared by browser and Node; bounded pack, UTF-8 filenames, deterministic timestamps.
  function zip(files){const enc=new TextEncoder(),chunks=[],central=[];let offset=0;
    for(const f of files){if(!/^[a-zA-Z0-9_.-]+$/.test(f.name))throw new Error('Unsafe ZIP filename');const name=enc.encode(f.name),data=typeof f.data==='string'?enc.encode(f.data):f.data,crc=crc32(data),h=new Uint8Array(30+name.length),v=new DataView(h.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(12,33,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);h.set(name,30);chunks.push(h,data);
      const c=new Uint8Array(46+name.length),d=new DataView(c.buffer);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);d.setUint16(14,33,true);d.setUint32(16,crc,true);d.setUint32(20,data.length,true);d.setUint32(24,data.length,true);d.setUint16(28,name.length,true);d.setUint32(42,offset,true);c.set(name,46);central.push(c);offset+=h.length+data.length;
    }const cs=central.reduce((s,c)=>s+c.length,0),end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,cs,true);e.setUint32(16,offset,true);const out=new Uint8Array(offset+cs+22);let p=0;for(const c of [...chunks,...central,end]){out.set(c,p);p+=c.length;}return out;
  }
  function pack(entries){const m=manifest(entries);return zip([...entries.map(e=>({name:e.filename,data:wav(e.audio)})),{name:'manifest.json',data:JSON.stringify(m,null,2)}]);}
  return {VERSION,PRESETS,recipe,random,synth,processAudio,stats,wav,crc32,hash,manifest,zip,pack};
});
