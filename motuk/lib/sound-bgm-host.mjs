import {validateBgmRecipe,generateBgm,BgmError} from './bgm-engine.mjs';
import {soundBgmGenerate,soundBgmPresets} from './bgm-mcp-adapter.mjs';
import {SOUND_SITE_PUBLIC} from './sound-access.mjs';

// Sites dispatch owns the audience. The owner explicitly made this Site public.
// Anonymous requests share one bounded per-isolate budget; audio is not persisted.
// Per-isolate abuse guard: bounded map, 12 renders/minute/identity. Distributed
// global throttling is NOT claimed; hard duration/sample/time caps always apply.
const windows=new Map();
export const BGM_HOST_LIMITS={max_duration_seconds:60,max_wav_bytes:5292044,render_budget_ms:5000,per_isolate_renders_per_minute:12};
function reserve(identity){
  if(!identity&&!SOUND_SITE_PUBLIC)throw new BgmError('AUTH_REQUIRED','Authenticated Site identity required');
  identity=identity||'anonymous-shared-budget';
  const now=Date.now();
  for(const [key,w]of windows)if(now-w.start>=60000)windows.delete(key);
  let w=windows.get(identity);
  if(!w){if(windows.size>=256)throw new BgmError('BGM_BUSY','BGM renderer busy; retry later');w={start:now,count:0};windows.set(identity,w);}
  if(w.count>=12)throw new BgmError('BGM_RATE_LIMIT','At most 12 BGM renders per minute in this runtime');
  w.count++;
}
export function bgmDownloadPath(recipe){return '/sound/bgm/render?recipe='+encodeURIComponent(JSON.stringify(validateBgmRecipe(recipe)));}
export async function callBgmTool(name,args,identity){
  if(name==='sound_bgm_presets'){
    if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).length)throw new BgmError('BAD_ARGS','No arguments accepted');
    const data={...soundBgmPresets(),host_limits:BGM_HOST_LIMITS};
    return {content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data,isError:false};
  }
  if(name!=='sound_bgm_generate')throw new BgmError('BAD_TOOL','Unknown BGM tool');
  if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).some(k=>k!=='recipe')||!args.recipe)throw new BgmError('BAD_ARGS','Expected {recipe} only');
  validateBgmRecipe(args.recipe);reserve(identity);
  const result=await soundBgmGenerate(args,{allowPublicDelivery:SOUND_SITE_PUBLIC,issueOwnerPrivateDownload:async({recipe})=>({url:bgmDownloadPath(recipe),access:SOUND_SITE_PUBLIC?'site-public':'owner-private',persisted:false})});
  const data={...result.structuredContent,download_url:new URL(result.structuredContent.download_path,'https://aldol-asset-factory-studio.al-dori.chatgpt.site').href};
  return {content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data,isError:false};
}
export async function handleBgmDownload(req){
  const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; sandbox"};
  const error=(message,status)=>new Response(message,{status,headers});
  const identity=req.headers.get('oai-authenticated-user-id');
  if(!identity&&!SOUND_SITE_PUBLIC)return error('Authenticated Site identity required',401);
  if(req.method!=='GET')return error('GET required',405);
  const u=new URL(req.url),q=u.searchParams;
  if(u.search.length>2048||q.getAll('recipe').length!==1||[...q.keys()].some(k=>k!=='recipe'))return error('Invalid BGM specification',400);
  try{
    const recipe=validateBgmRecipe(JSON.parse(q.get('recipe')));reserve(identity);
    const r=await generateBgm(recipe);
    return new Response(r.wav,{headers:{...headers,'Content-Type':'audio/wav','Content-Disposition':'attachment; filename="'+r.filename+'"','Content-Length':String(r.wav.length),'X-Content-SHA256':r.sha256,'X-BGM-Duration':String(r.metadata.duration_seconds)}});
  }catch(e){return error((e.code?e.code+': ':'')+e.message,e.code==='BGM_RATE_LIMIT'?429:e.code==='BGM_BUSY'?503:e.code==='BGM_TIME_LIMIT'?503:400);}
}
