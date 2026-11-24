/**
 * ALDOL SOUND MCP procedural BGM engine v0.1 (development candidate).
 * Zero third-party dependencies; deterministic, offline, Workers-compatible ES module.
 * Produces loopable 4/4 PCM16 mono WAV; it does NOT change the deployed SFX engine.
 */
export const BGM_ENGINE_VERSION = '0.1.0';
export const BGM_MOODS = Object.freeze({
  cozy: {name:'포근한 밤', root:60, minor:false, degrees:[0,5,3,4], percussion:0.05, brightness:0.68},
  hope: {name:'희망', root:60, minor:false, degrees:[0,4,5,3], percussion:0.15, brightness:0.9},
  mystery: {name:'미스터리', root:57, minor:true, degrees:[0,5,3,6], percussion:0.03, brightness:0.48},
  tension: {name:'긴장', root:57, minor:true, degrees:[0,1,4,6], percussion:0.20, brightness:0.75},
});
export const BGM_INSTRUMENTS = Object.freeze({
  soft: '부드러운 피아노', bell: '유리종', chip: '레트로 칩튠',
});
export const BGM_DEFAULTS = Object.freeze({mood:'cozy',instrument:'soft',bpm:90,bars:12,seed:42,sampleRate:22050});
const MAJOR=[0,2,4,5,7,9,11], MINOR=[0,2,3,5,7,8,10];
const TAU=Math.PI*2;
export class BgmError extends Error { constructor(code,message){super(message);this.name='BgmError';this.code=code;} }
const fail=(code,msg)=>{throw new BgmError(code,msg);};
function integer(name,value,min,max){if(!Number.isInteger(value)||value<min||value>max)fail('BAD_'+name.toUpperCase(),`${name} must be an integer in [${min}, ${max}]`);}
export function validateBgmRecipe(raw={}){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))fail('BAD_RECIPE','Recipe must be an object');
  const allowed=new Set(Object.keys(BGM_DEFAULTS));
  for(const key of Object.keys(raw))if(!allowed.has(key))fail('UNKNOWN_PARAMETER',`Unknown BGM parameter: ${key}`);
  const r={...BGM_DEFAULTS,...raw};
  if(typeof r.mood!=='string'||!Object.hasOwn(BGM_MOODS,r.mood))fail('BAD_MOOD',`mood must be ${Object.keys(BGM_MOODS).join('|')}`);
  if(typeof r.instrument!=='string'||!Object.hasOwn(BGM_INSTRUMENTS,r.instrument))fail('BAD_INSTRUMENT',`instrument must be ${Object.keys(BGM_INSTRUMENTS).join('|')}`);
  integer('bpm',r.bpm,60,150);
  integer('bars',r.bars,4,16);
  integer('seed',r.seed,0,0xffffffff);
  if(![22050,44100].includes(r.sampleRate))fail('BAD_SAMPLE_RATE','sampleRate must be 22050 or 44100');
  const seconds=r.bars*240/r.bpm;
  if(seconds>60)fail('DURATION_LIMIT','BGM duration exceeds 60 seconds; reduce bars or increase bpm');
  return Object.freeze(r);
}
function rng(seed){let x=(seed^0x9e3779b9)>>>0;return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;};}
function pitch(note){return 440*Math.pow(2,(note-69)/12);}
function scaleNote(root,scale,degree,octave=0){const d=((degree%7)+7)%7;return root+scale[d]+12*(Math.floor(degree/7)+octave);}
function wave(phase,inst,brightness){
  if(inst==='bell')return (Math.sin(phase)+0.29*Math.sin(phase*2.71)+0.13*Math.sin(phase*4.12))/1.42;
  if(inst==='chip')return (Math.sin(phase)+0.23*Math.sin(phase*3)+0.10*Math.sin(phase*5))/1.33;
  return (Math.sin(phase)+0.28*brightness*Math.sin(phase*2)+0.12*Math.sin(phase*3))/1.4;
}
function addNote(mix,sr,start,duration,midi,gain,inst,brightness,attack=0.012,release=0.12){
  const at=Math.round(start*sr), len=Math.max(1,Math.round(duration*sr));
  const begin=Math.max(0,at),end=Math.min(mix.length,at+len);
  const hz=pitch(midi), advance=TAU*hz/sr;
  const attackSamples=Math.max(1,Math.round(attack*sr)),releaseSamples=Math.max(1,Math.round(release*sr));
  for(let i=begin;i<end;i++){
    const n=i-at;
    const fade=Math.min(1,n/attackSamples,(len-1-n)/releaseSamples);
    const age=n/sr;
    const decay=inst==='bell'?Math.exp(-1.1*age):inst==='chip'?0.91+0.09*Math.exp(-2*age):Math.exp(-0.37*age);
    mix[i]+=gain*Math.max(0,fade)*decay*wave(advance*n,inst,brightness);
  }
}
function addPad(mix,sr,start,duration,midi,gain,brightness){
  const at=Math.round(start*sr),len=Math.max(1,Math.round(duration*sr));
  const begin=Math.max(0,at),end=Math.min(mix.length,at+len);
  const inc=TAU*pitch(midi)/sr;
  const a=Math.max(1,Math.round(Math.min(0.32,duration*0.17)*sr));
  const r=Math.max(1,Math.round(Math.min(0.38,duration*0.22)*sr));
  for(let i=begin;i<end;i++){
    const n=i-at,env=Math.max(0,Math.min(1,n/a,(len-n-1)/r));
    mix[i]+=gain*env*(Math.sin(inc*n)+0.11*brightness*Math.sin(inc*n*2.002))/1.11;
  }
}
function addHat(mix,sr,start,gain,rand){
  const at=Math.round(start*sr),len=Math.round(sr*0.038);
  let prev=0;
  for(let n=0;n<len&&at+n<mix.length;n++){
    const raw=rand()*2-1;const hp=raw-prev;prev=raw;
    const e=Math.exp(-95*n/sr)*Math.min(1,n/(sr*.001+1));
    if(at+n>=0)mix[at+n]+=hp*gain*e;
  }
}
export function renderBgm(raw={}){
  const deadline=Date.now()+5000;
  const checkBudget=()=>{if(Date.now()>deadline)fail('BGM_TIME_LIMIT','BGM render exceeded the 5 second execution budget');};
  const recipe=validateBgmRecipe(raw), {mood,instrument,bpm,bars,seed,sampleRate:sr}=recipe;
  const cfg=BGM_MOODS[mood],scale=cfg.minor?MINOR:MAJOR;
  const spb=60/bpm,barSec=4*spb;
  const frames=Math.round(bars*barSec*sr);
  const mix=new Float64Array(frames);
  const rand=rng(seed);
  const chords=[];
  // Build a four-bar phrase once, then repeat it to prevent phrase drift at loop boundaries.
  const motifs=Array.from({length:4},()=>Array.from({length:8},()=>({degree:Math.floor(rand()*7), rest:rand()<0.24, octave:rand()<0.12?1:0})));
  for(let bar=0;bar<bars;bar++){
    checkBudget();
    const barStart=bar*barSec, degree=cfg.degrees[bar%4];
    const root=scaleNote(cfg.root,scale,degree,-1);
    const triad=[degree,degree+2,degree+4];
    chords.push(triad.map(d=>scaleNote(cfg.root,scale,d,0)));
    // Thin, sustained pad layer. Avoid crossing the file boundary.
    for(const d of triad)addPad(mix,sr,barStart,barSec-0.045,scaleNote(cfg.root,scale,d,0),0.031,cfg.brightness);
    for(let beat=0;beat<4;beat+=2){
      addNote(mix,sr,barStart+beat*spb,spb*1.60,root,0.17,'soft',0.5,0.009,0.13);
    }
    // Arpeggio at half-beat resolution, with predictable accents.
    for(let step=0;step<8;step++){
      const chordDegree=triad[[0,1,2,1,2,1,0,1][step]];
      const arpMidi=scaleNote(cfg.root,scale,chordDegree,0);
      addNote(mix,sr,barStart+step*spb/2,spb*(instrument==='bell'?.64:.42),arpMidi,
        (step%2===0?.13:.088)*cfg.brightness,instrument,cfg.brightness,0.008,0.09);
    }
    // 4-bar coherent melody built from seeded motif; motif variations preserve harmony.
    for(let step=0;step<8;step++){
      const m=motifs[bar%4][step];if(m.rest)continue;
      const degreeOffset=[0,2,4,2][step%4];
      const degreeCandidate=degree+((m.degree+degreeOffset)%7);
      addNote(mix,sr,barStart+step*spb/2,spb*(step%3===0?.76:.41),
        scaleNote(cfg.root,scale,degreeCandidate,m.octave),
        instrument==='chip'?.095:.107,instrument,cfg.brightness,0.008,0.115);
    }
    // Lightweight synthesized high-frequency percussion. No external samples.
    if(cfg.percussion>0){for(let beat=0;beat<4;beat++){
      addHat(mix,sr,barStart+beat*spb,cfg.percussion*(beat===0?0.8:0.43),rand);
    }}
  }
  let peak=0;for(let i=0;i<frames;i++)peak=Math.max(peak,Math.abs(mix[i]));
  if(peak<0.00001)fail('SILENT_RENDER','Synthesizer produced silence');
  const scaleGain=0.82/peak;
  // Force the start/end to zero to eliminate a sample-value discontinuity on looping.
  const edge=Math.max(2,Math.round(sr*0.027));
  const wav=new Uint8Array(44+frames*2),v=new DataView(wav.buffer);
  const s=(i,value)=>wav.set(new TextEncoder().encode(value),i);
  s(0,'RIFF');v.setUint32(4,wav.length-8,true);s(8,'WAVE');s(12,'fmt ');
  v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);
  v.setUint32(24,sr,true);v.setUint32(28,sr*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);
  s(36,'data');v.setUint32(40,frames*2,true);
  let rmsSum=0,finalPeak=0;
  for(let i=0;i<frames;i++){
    if((i&16383)===0)checkBudget();
    const taper=Math.min(1,i/edge,(frames-1-i)/edge);
    const val=Math.max(-1,Math.min(1,mix[i]*scaleGain*Math.max(0,taper)));
    const pcm=Math.round(val*32767);
    v.setInt16(44+i*2,pcm,true);
    rmsSum+=val*val;finalPeak=Math.max(finalPeak,Math.abs(val));
  }
  const meta={engine_version:BGM_ENGINE_VERSION,recipe:{...recipe},format:'wav',channels:1,pcm_bits:16,
    frames,duration_seconds:frames/sr,byte_length:wav.length,peak_dbfs:20*Math.log10(finalPeak),rms_dbfs:10*Math.log10(rmsSum/frames),
    loop:{enabled:true,start_frame:0,end_frame_exclusive:frames,zero_boundary:true},harmonic_progression:chords};
  return {wav,metadata:meta};
}
export async function sha256(bytes){const hash=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('');}
export async function generateBgm(raw={}){
  const r=renderBgm(raw);return {...r,sha256:await sha256(r.wav),filename:`aldol-bgm-${r.metadata.recipe.mood}-${r.metadata.recipe.seed}.wav`};
}
