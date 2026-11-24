var j="0.4.0",S=["threads","x","discord","youtube_shorts","instagram","website"],P=["awareness","traffic","game_start","reactivation"],I=e=>({tool:e,version:j,execution:"remote_draft_only",external_actions:"none"}),s=class extends Error{},_=e=>e!==null&&typeof e=="object"&&!Array.isArray(e);function A(e,t){if(!_(e))throw new s("\uC785\uB825 \uAC1D\uCCB4\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4");for(let n of Object.keys(e))if(!t.includes(n))throw new s("\uC9C0\uC6D0\uD558\uC9C0 \uC54A\uB294 \uC785\uB825 \uD544\uB4DC\uAC00 \uC788\uC2B5\uB2C8\uB2E4")}function l(e,t,n=1500,i=!0){if(e===void 0&&!i)return"";if(typeof e!="string")throw new s(t+": \uBB38\uC790\uC5F4\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4");let r=e.trim();if(i&&!r)throw new s(t+": \uBE48 \uBB38\uC790\uC5F4\uC740 \uD5C8\uC6A9\uB418\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4");if(r.length>n)throw new s(t+": \uCD5C\uB300 "+n+"\uC790\uC785\uB2C8\uB2E4");return r}function z(e,t,n=12,i=500){if(!Array.isArray(e)||e.length>n)throw new s(t+": \uBB38\uC790\uC5F4 \uBC30\uC5F4 \uBC94\uC704 \uCD08\uACFC");return e.map((r,a)=>l(r,t+"["+a+"]",i))}function U(e,t="url"){if(e=l(e,t,2e3),/[\x00-\x1f\x7f]/.test(e))throw new s(t+": \uC81C\uC5B4\uBB38\uC790 \uD5C8\uC6A9\uB418\uC9C0 \uC54A\uC74C");let n;try{n=new URL(e)}catch{throw new s(t+": \uC720\uD6A8\uD55C https URL\uC774 \uD544\uC694\uD569\uB2C8\uB2E4")}if(!/^https:\/\//i.test(e)||n.protocol!=="https:"||!n.hostname||n.username||n.password)throw new s(t+": \uACC4\uC815\uC815\uBCF4 \uC5C6\uB294 https URL\uB9CC \uD5C8\uC6A9\uD569\uB2C8\uB2E4");return e}function J(e,t="source_urls"){if(!Array.isArray(e)||e.length>12)throw new s(t+": \uCD5C\uB300 12\uAC1C URL \uBC30\uC5F4");return e.map((n,i)=>U(n,t+"["+i+"]"))}function B(e){A(e,["project_id","name","description","category","features","audiences","source_urls"]);let t=l(e.project_id,"project_id",90);if(!/^[A-Za-z0-9][A-Za-z0-9._-]{1,89}$/.test(t))throw new s("project_id: \uC601\uBB38\xB7\uC22B\uC790\uB85C \uC2DC\uC791\uD558\uB294 \uC601\uBB38/\uC22B\uC790/._- \uC2DD\uBCC4\uC790\uC5EC\uC57C \uD569\uB2C8\uB2E4");return{project_id:t,name:l(e.name,"name",120),description:l(e.description??"","description",1e3,!1),category:l(e.category??"other","category",80),features:z(e.features??[],"features",15),audiences:z(e.audiences??[],"audiences",8),source_urls:J(e.source_urls??[])}}function fe(e){let t=B(e);return{...I("marketing_project_profile"),status:"draft",profile:t,provenance:"user_supplied_unverified",unverified_fields:["description","features","audiences"].filter(n=>!!(Array.isArray(t[n])?t[n].length:t[n])),next_step:"\uC2DC\uC7A5\xB7\uC0C1\uD488 \uC815\uBCF4\uB294 \uCD9C\uCC98 \uD655\uC778 \uD6C4 \uCEA0\uD398\uC778\uC5D0 \uC0AC\uC6A9\uD558\uC138\uC694"}}function me(e){A(e,["project","campaign_id","objective","audience","channels","offer","evidence_notes"]);let t=B(e.project),n=l(e.campaign_id,"campaign_id",100),i=l(e.objective,"objective",30);if(!P.includes(i))throw new s("objective: \uC9C0\uC6D0\uD558\uC9C0 \uC54A\uB294 \uBAA9\uD45C");let r=[...new Set(z(e.channels??[],"channels",6,40))];if(!r.length||r.some(x=>!S.includes(x)))throw new s("channels: \uC9C0\uC6D0\uD558\uC9C0 \uC54A\uB294 \uCC44\uB110");let a=l(e.audience,"audience",180),c=l(e.offer??"","offer",300,!1),o=z(e.evidence_notes??[],"evidence_notes",10,700),v={awareness:"\uAD00\uC2EC \uC720\uB3C4",traffic:"\uC18C\uAC1C \uD398\uC774\uC9C0 \uBC29\uBB38",game_start:"\uAC8C\uC784 \uC2DC\uC791 \uC804\uD658",reactivation:"\uAE30\uC874 \uC774\uC6A9\uC790 \uBCF5\uADC0"},k={awareness:"reach",traffic:"landing_visits",game_start:"game_starts",reactivation:"returning_players"},m={campaign_id:n,project:t,objective:i,target_audience:a,channels:r,offer:c,goal:v[i],core_message_candidate:t.features.length?`${t.name}: ${t.features[0]}`:t.name,measuring_plan:{primary_kpi:k[i],baseline:null,target:null,note:"\uBAA9\uD45C\uCE58\uB294 \uC2E4\uC81C \uAE30\uCD08 \uB370\uC774\uD130\uB85C \uBCC4\uB3C4 \uC124\uC815"},evidence_notes:o,assumptions:["\uC81C\uACF5\uB41C \uAE30\uB2A5\xB7\uD0C0\uAE43\xB7\uC81C\uC548 \uC815\uBCF4\uB294 \uB3C5\uB9BD \uAC80\uC99D\uB418\uC9C0 \uC54A\uC74C","\uC2E4\uC81C \uCC44\uB110 \uAC8C\uC2DC \uBC0F \uAD11\uACE0 \uAD6C\uB9E4\uB294 \uC218\uD589\uD558\uC9C0 \uC54A\uC74C"],status:"draft_needs_review"};return{...I("marketing_create_brief"),status:"draft_needs_review",brief:m}}function ge(e){A(e,["brief","landing_url","tone","channel_copy"]);let t=e.brief;if(!_(t))throw new s("brief: \uAC1D\uCCB4\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4");for(let p of["project","channels","objective","target_audience","core_message_candidate"])if(!Object.hasOwn(t,p))throw new s("brief: "+p+" \uD544\uB4DC \uD544\uC694");let n=B(t.project),i=z(t.channels,"brief.channels",6,40);if(!i.length||i.some(p=>!S.includes(p)))throw new s("brief.channels: \uC9C0\uC6D0\uD558\uC9C0 \uC54A\uB294 \uCC44\uB110");if(!P.includes(t.objective))throw new s("brief.objective: \uC9C0\uC6D0\uD558\uC9C0 \uC54A\uB294 \uBAA9\uD45C");l(t.target_audience,"brief.target_audience",180);let r=l(t.core_message_candidate,"brief.core_message_candidate",600),a=l(e.tone??"informative","tone",20);if(!["informative","playful","concise"].includes(a))throw new s("tone: \uC798\uBABB\uB41C \uAC12");let c=e.channel_copy===void 0?{}:e.channel_copy;A(c,["threads","discord"]);for(let[p,d]of Object.entries(c)){if(!i.includes(p))throw new s("channel_copy: \uBE0C\uB9AC\uD504\uC758 \uCC44\uB110\uACFC \uC77C\uCE58\uD574\uC57C \uD569\uB2C8\uB2E4");l(d,"channel_copy."+p,1800)}let o=e.landing_url===void 0||e.landing_url===""?"":U(e.landing_url,"landing_url"),v=o?`\uC790\uC138\uD788 \uBCF4\uAE30: ${o}`:"\uC790\uC138\uD55C \uB0B4\uC6A9\uC740 \uACF5\uC2DD \uC548\uB0B4\uC5D0\uC11C \uD655\uC778\uD574 \uC8FC\uC138\uC694.",k={informative:"\uC0C8\uB85C\uC6B4 \uC18C\uC2DD\uC744 \uC804\uD569\uB2C8\uB2E4.",playful:"\uC774\uBC88\uC5D4 \uC5B4\uB5A4 \uC774\uC57C\uAE30\uAC00 \uAE30\uB2E4\uB9B4\uAE4C\uC694?",concise:"\uC5C5\uB370\uC774\uD2B8 \uC18C\uC2DD."},m=n.name+": ",x=r.startsWith(m)?r.slice(m.length).trim()||n.name:r,b={};for(let p of i){let d;if(p==="threads"||p==="discord"){if(Object.hasOwn(c,p))d=c[p].trim();else if(p==="threads")d=x.includes(n.name)?x:`${x}

${n.name}`;else{let de=x.includes(n.name)?"":`**${n.name} \uC18C\uC2DD**
`,ue=a==="playful"?`

\uBCF4\uC2E0 \uBD84\uB4E4\uC740 \uC5B4\uB560\uB294\uC9C0 \uD3B8\uD558\uAC8C \uB9D0\uD574 \uC8FC\uC138\uC694.`:"";d=de+x+ue}o&&!d.includes(o)&&(d+=`

`+o)}else p==="x"?(d=`${r}
${v}`,d.length>280&&(d=`${n.name} \uC18C\uC2DD
${v}`),d.length>280&&(d=`${n.name.slice(0,60)} \uC18C\uC2DD
\uC790\uC138\uD55C \uB0B4\uC6A9\uC740 \uACF5\uC2DD \uC548\uB0B4\uC5D0\uC11C \uD655\uC778\uD574 \uC8FC\uC138\uC694.`)):p==="youtube_shorts"?d=`[15\uCD08 \uC20F\uD3FC \uB300\uBCF8 \uCD08\uC548]
0~3\uCD08: ${n.name} \uC18C\uC2DD\uC744 \uC54C\uB9AC\uB294 \uC7A5\uBA74
3~12\uCD08: ${r}
12~15\uCD08: ${v}
\u203B \uC601\uC0C1 \uC790\uB8CC\uC640 \uAE30\uB2A5 \uC0AC\uC2E4\uD655\uC778 \uD544\uC694`:p==="website"?d=`\uC81C\uBAA9: ${n.name} \uC18C\uC2DD
\uC18C\uAC1C: ${r}
\uC548\uB0B4: ${v}`:d=`${n.name} \uC5C5\uB370\uC774\uD2B8 \uC548\uB0B4
${k[a]}
${r}
${v}`;b[p]={text:d,length:d.length,status:"unverified_draft"}}return{...I("marketing_generate_copy"),status:"draft_needs_fact_check",variants:b,validation_required:["\uAE30\uB2A5 \uC124\uBA85\uACFC \uC81C\uACF5 \uC0AC\uC2E4 \uAC80\uC99D","\uD50C\uB7AB\uD3FC\uBCC4 \uC815\uCC45\xB7\uAE00\uC790 \uC218\xB7\uB9C1\uD06C \uC81C\uC57D \uCD5C\uC2E0 \uD655\uC778","\uAC8C\uC2DC \uC804 \uB2F4\uB2F9\uC790 \uC2B9\uC778"]}}function he(e){A(e,["text","supporting_sources","platform"]);let t=l(e.text,"text",15e3),n=J(e.supporting_sources??[],"supporting_sources"),i=l(e.platform??"unspecified","platform",60),a=[[/\b100\s*%\s*(?:보장|성공|효과|안전|수익)|(?:무조건|절대|반드시)\s*(?:보장|성공|효과|안전|수익)/i,"guarantee_claim","\uBCF4\uC7A5\xB7\uD655\uC815\uC801 \uC131\uACFC \uC8FC\uC7A5 \uD655\uC778"],[/(?:세계\s*1위|국내\s*최초|업계\s*최고|압도적\s*1위)/i,"ranking_claim","\uC21C\uC704\xB7\uCD5C\uCD08 \uC8FC\uC7A5 \uADFC\uAC70 \uD655\uC778"],[/(?:지금\s*안\s*하면|딱\s*오늘만|마감\s*임박)/i,"urgency_claim","\uB9C8\uAC10\xB7\uD76C\uC18C\uC131 \uC8FC\uC7A5\uC758 \uC0AC\uC2E4 \uD655\uC778"],[/(?:수익\s*보장|원금\s*보장|무위험\s*투자)/i,"financial_claim","\uACBD\uC81C\uC801 \uC774\uC775\xB7\uBB34\uC704\uD5D8 \uC8FC\uC7A5\uC758 \uAC80\uD1A0"],[/(?:\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b|\b01[016789]-?\d{3,4}-?\d{4}\b)/i,"personal_data","\uAC1C\uC778\uC815\uBCF4 \uB178\uCD9C \uAC00\uB2A5\uC131 \uD655\uC778"]].filter(([c])=>c.test(t)).map(([,c,o])=>({id:c,detail:o,evidence:"pattern_only_not_fact_verified"}));return/\b\d+(?:\.\d+)?\s*%/.test(t)&&!n.length&&a.push({id:"unsourced_percentage",detail:"\uBC31\uBD84\uC728\uC5D0 \uB300\uD55C \uADFC\uAC70 URL\uC774 \uC81C\uACF5\uB418\uC9C0 \uC54A\uC74C",evidence:"missing_source"}),n.length||a.push({id:"no_sources",detail:"\uCD9C\uCC98 \uBBF8\uC81C\uACF5. \uAE30\uB2A5\xB7\uCD9C\uC2DC\xB7\uBB34\uB8CC \uC5EC\uBD80 \uB4F1\uC744 \uB3C5\uB9BD \uAC80\uC99D\uD558\uC9C0 \uBABB\uD568",evidence:"missing_source"}),{...I("marketing_review_campaign"),status:"human_review_required",platform:i,flags:a,source_urls_provided:n,automatic_checks:"keyword_and_format_heuristics_only",not_checked:["\uCD9C\uCC98\uC758 \uC2E4\uC81C \uB0B4\uC6A9","\uBC95\uB960\xB7\uADDC\uC81C \uC801\uD569\uC131","\uD50C\uB7AB\uD3FC \uCD5C\uC2E0 \uC815\uCC45","\uC2E4\uC81C \uAC8C\uC2DC \uAC00\uB2A5 \uC5EC\uBD80"],approved_for_publication:!1}}function xe(e){A(e,["base_url","source","medium","campaign","content","term"]);let t=U(e.base_url,"base_url"),n=new URL(t),i={};for(let r of["source","medium","campaign"]){let a=l(e[r],r,110);if(!/^[A-Za-z0-9가-힣._-]+$/.test(a))throw new s(r+": \uACF5\uBC31\xB7\uD2B9\uC218\uBB38\uC790 \uC81C\uC678, \uC601\uC22B\uC790\xB7\uD55C\uAE00\xB7._-\uB9CC \uD5C8\uC6A9");i["utm_"+r]=a}for(let r of["content","term"]){let a=l(e[r]??"",r,110,!1);if(a){if(!/^[A-Za-z0-9가-힣._-]+$/.test(a))throw new s(r+": \uC798\uBABB\uB41C \uAC12");i["utm_"+r]=a}}for(let r of[...n.searchParams.keys()])/^utm_(?:source|medium|campaign|content|term)$/i.test(r)&&n.searchParams.delete(r);for(let[r,a]of Object.entries(i))n.searchParams.append(r,a);if(n.toString().length>3e3)throw new s("\uCD5C\uC885 URL\uC774 \uB108\uBB34 \uAE41\uB2C8\uB2E4");return{...I("marketing_build_tracking"),status:"generated_not_visited",url:n.toString(),utm:i,network_requests:0,limitations:["\uB9C1\uD06C \uC720\uD6A8\uC131\xB7\uB9AC\uB514\uB809\uC158 \uBBF8\uAC80\uC99D","\uCEA0\uD398\uC778 \uC131\uACFC\uB294 \uC5F0\uACB0\uB41C \uBD84\uC11D \uB3C4\uAD6C\uC5D0\uC11C \uBCC4\uB3C4 \uAC80\uC99D \uD544\uC694"]}}var M={marketing_project_profile:fe,marketing_create_brief:me,marketing_generate_copy:ge,marketing_review_campaign:he,marketing_build_tracking:xe};var q="padong:draft";async function Y(e,t){if(Number(e.headers.get("content-length"))>t)return null;if(!e.body)return"";let n=e.body.getReader(),i=new TextDecoder("utf-8",{fatal:!0}),r=0,a="";try{for(;;){let{done:c,value:o}=await n.read();if(c)return a+i.decode();if(r+=o.byteLength,r>t)return n.cancel().catch(()=>{}),null;a+=i.decode(o,{stream:!0})}}finally{n.releaseLock()}}function w(e,t,n={}){return new Response(t,{status:e,headers:{"cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer","content-type":"text/plain; charset=utf-8",...n}})}function Q(e,t,n=""){let i=e.headers.get("origin");return i===null||i===t||n.split(",").map(r=>r.trim()).filter(Boolean).includes(i)}var y={type:"string"},be={type:"integer",minimum:0},h=e=>({const:e}),T={type:"array",items:y},D=e=>({type:"string",enum:e}),f=(e,t=Object.keys(e),n=!1)=>({type:"object",properties:e,required:t,additionalProperties:n}),E={type:"string",pattern:"^[Hh][Tt][Tt][Pp][Ss]://"},C=(e,t,n=0)=>({type:"array",minItems:n,maxItems:t,items:e}),u=e=>({type:"string",maxLength:e}),ve={type:"string",pattern:"^[A-Za-z0-9][A-Za-z0-9._-]{1,89}$"},V={project_id:ve,name:u(120),description:u(1e3),category:u(80),features:C(u(500),15),audiences:C(u(500),8),source_urls:C({...E,maxLength:2e3},12)},F=f(V,["project_id","name"]),K=C(D(S),6,1),W=D(P),G={project:F,channels:K,objective:W,target_audience:u(180),core_message_candidate:u(600)},ye=f({...G,project:f(V),campaign_id:u(100),offer:u(300),goal:y,measuring_plan:f({primary_kpi:D(["reach","landing_visits","game_starts","returning_players"]),baseline:{type:"null"},target:{type:"null"},note:y}),evidence_notes:T,assumptions:T,status:h("draft_needs_review")}),_e=Object.fromEntries(S.map(e=>[e,f({text:y,length:be,status:h("unverified_draft")})])),O={type:"string",maxLength:110,pattern:"^[A-Za-z0-9\uAC00-\uD7A3._-]+$"},we=Object.fromEntries(["source","medium","campaign","content","term"].map(e=>["utm_"+e,O]));function N(e,t,n,i,r){let a=[{type:"oauth2",scopes:[q]}];return{name:e,description:t,inputSchema:n,outputSchema:f({tool:h(e),version:h(j),execution:h("remote_draft_only"),external_actions:h("none"),status:h(i),...r}),annotations:{readOnlyHint:!0,destructiveHint:!1,openWorldHint:!1},securitySchemes:a,_meta:{securitySchemes:a}}}var $=[N("marketing_project_profile","\uC0AC\uC6A9\uC790\uAC00 \uC81C\uACF5\uD55C \uD504\uB85C\uC81D\uD2B8 \uAE30\uBCF8 \uC815\uBCF4\uB97C \uC815\uB9AC\uD569\uB2C8\uB2E4.",F,"draft",{profile:f(V),provenance:h("user_supplied_unverified"),unverified_fields:T,next_step:y}),N("marketing_create_brief","\uD504\uB85C\uC81D\uD2B8, \uBAA9\uD45C, \uB300\uC0C1, \uCC44\uB110\uC744 \uBC14\uD0D5\uC73C\uB85C \uCEA0\uD398\uC778 \uBE0C\uB9AC\uD504\uC640 KPI \uCD08\uC548\uC744 \uB9CC\uB4ED\uB2C8\uB2E4.",f({project:F,campaign_id:u(100),objective:W,audience:u(180),channels:K,offer:u(300),evidence_notes:C(u(700),10)},["project","campaign_id","objective","audience","channels"]),"draft_needs_review",{brief:ye}),N("marketing_generate_copy","\uCEA0\uD398\uC778 \uBE0C\uB9AC\uD504\uB85C \uCC44\uB110\uBCC4 \uCD08\uC548\uC744 \uB9CC\uB4ED\uB2C8\uB2E4. \uD655\uC815\uD55C Threads\xB7Discord \uBB38\uAD6C\uAC00 \uC788\uC73C\uBA74 channel_copy\uB85C \uC804\uB2EC\uD558\uC138\uC694.",f({brief:f(G,Object.keys(G),!0),landing_url:{anyOf:[E,h("")]},tone:D(["informative","playful","concise"]),channel_copy:{...f({threads:u(1800),discord:u(1800)},[]),description:"\uC0AC\uC6A9\uC790\uAC00 \uD655\uC815\uD55C \uBB38\uAD6C\uB97C \uC9C0\uC815\uD55C \uCC44\uB110\uC758 \uCD08\uC548\uC73C\uB85C \uBCF4\uC874\uD569\uB2C8\uB2E4."}},["brief"]),"draft_needs_fact_check",{variants:{...f(_e,[]),minProperties:1},validation_required:T}),N("marketing_review_campaign","\uD64D\uBCF4\uBB38\uC5D0\uC11C \uADFC\uAC70\uAC00 \uD544\uC694\uD55C \uC8FC\uC7A5\uACFC \uAC80\uD1A0 \uD56D\uBAA9\uC744 \uD45C\uC2DC\uD569\uB2C8\uB2E4.",f({text:u(15e3),supporting_sources:C(E,12),platform:u(60)},["text"]),"human_review_required",{platform:y,flags:{type:"array",items:f({id:y,detail:y,evidence:y})},source_urls_provided:{type:"array",items:E},automatic_checks:y,not_checked:T,approved_for_publication:h(!1)}),N("marketing_build_tracking","HTTPS \uC8FC\uC18C\uC5D0 \uCEA0\uD398\uC778 \uCD94\uC801\uC6A9 UTM \uB9E4\uAC1C\uBCC0\uC218\uB97C \uBD99\uC785\uB2C8\uB2E4.",f({base_url:{...E,maxLength:2e3},source:O,medium:O,campaign:O,content:{anyOf:[O,h("")]},term:{anyOf:[O,h("")]}},["base_url","source","medium","campaign"]),"generated_not_visited",{url:{...E,maxLength:3e3},utm:f(we,["utm_source","utm_medium","utm_campaign"]),network_requests:h(0),limitations:T})];var ne="2026-07-28",Z=["2025-11-25","2025-06-18","2025-03-26"],H=[ne,...Z],ke={name:"aldol-padong-marketing-mcp-qa",version:j},X={tools:{listChanged:!1}},ee="\uD504\uB85C\uC81D\uD2B8 \uC815\uB9AC, \uCEA0\uD398\uC778 \uBE0C\uB9AC\uD504, \uCC44\uB110\uBCC4 \uD64D\uBCF4\uBB38 \uCD08\uC548, \uD64D\uBCF4\uBB38 \uAC80\uD1A0, UTM \uC0DD\uC131\uC744 \uC9C0\uC6D0\uD569\uB2C8\uB2E4.",R="io.modelcontextprotocol/",je=32768;function re(e,t=200){return new Response(JSON.stringify(e),{status:t,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}})}function g(e,t,n,i=200,r){return re({jsonrpc:"2.0",id:e,error:{code:t,message:n,...r?{data:r}:{}}},i)}function L(e,t,n,i){let r=n?{...t,resultType:"complete",_meta:{[R+"serverInfo"]:i}}:t;return re({jsonrpc:"2.0",id:e,result:r})}var Ae=e=>typeof e=="string"||Number.isSafeInteger(e),te=e=>_(e)&&typeof e.name=="string"&&e.name.length>0&&typeof e.version=="string"&&e.version.length>0;function Ee(e){let t=/^=\?base64\?([A-Za-z0-9+/]+={0,2})\?=$/.exec(e??"");if(!t)return e;try{return new TextDecoder("utf-8",{fatal:!0}).decode(Uint8Array.from(atob(t[1]),n=>n.charCodeAt(0)))}catch{return null}}function Oe(e){let t=e.toLowerCase().split(",").flatMap(n=>{let[i,...r]=n.trim().split(";").map(a=>a.trim());return r.some(a=>/^q\s*=\s*0(?:\.0*)?$/.test(a))?[]:[i]});return t.includes("application/json")&&t.includes("text/event-stream")}function Te(e,t,n){let i;switch(e){case"marketing_project_profile":i=t.project_id;break;case"marketing_create_brief":i=t.project?.project_id;break;case"marketing_generate_copy":i=t.brief?.project?.project_id;break}if(typeof i=="string"&&n!==null&&!n?.includes(i.trim()))return{isError:!0,content:[{type:"text",text:"\uC774 \uD504\uB85C\uC81D\uD2B8\uC758 \uC0AC\uC6A9 \uAD8C\uD55C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4."}]};try{let r=M[e](t);return{isError:!1,content:[{type:"text",text:JSON.stringify(r)}],structuredContent:r}}catch(r){return{isError:!0,content:[{type:"text",text:r instanceof s?r.message:"\uB3C4\uAD6C\uB97C \uCC98\uB9AC\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4."}]}}}async function ae(e,t,{server:n=ke,tools:i=$}={}){if(e.method!=="POST")return w(405,null,{Allow:"POST"});if(!/^application\/json(?:\s*;|$)/i.test(e.headers.get("content-type")??""))return w(415,"Use application/json");if(!Oe(e.headers.get("accept")??""))return w(406,"Accept application/json and text/event-stream");let r;try{let b=await Y(e,je);if(b===null)return w(413,"Payload too large");r=JSON.parse(b)}catch{return g(null,-32700,"Parse error",400)}let a=Ae(r?.id)?r.id:null;if(!_(r)||r.jsonrpc!=="2.0"||typeof r.method!="string"||Object.hasOwn(r,"id")&&a===null)return g(null,-32600,"Invalid Request",400);let{method:c,params:o={}}=r;if(!_(o))return g(a,-32602,"Invalid params",400);let v=e.headers.get("mcp-protocol-version"),k=v??"2025-03-26";if(!/^\d{4}-\d{2}-\d{2}$/.test(k))return g(a,-32020,"Invalid protocol version header",400);if(!H.includes(k))return g(a,-32022,"UnsupportedProtocolVersion",400,{supported:H,requested:k});let m=k===ne,x=o._meta;if((m||x?.[R+"protocolVersion"])&&(x?.[R+"protocolVersion"]!==v||e.headers.get("mcp-method")!==c))return g(a,-32020,"HeaderMismatch",400);if(m){if(!te(x[R+"clientInfo"])||!_(x[R+"clientCapabilities"]))return g(a,-32602,"Invalid client metadata",400);let b={"tools/call":"name","prompts/get":"name","resources/read":"uri"}[c];if(b&&(typeof o[b]!="string"||Ee(e.headers.get("mcp-name"))!==o[b]))return g(a,-32020,"HeaderMismatch",400)}if(a===null)return!m&&["notifications/initialized","notifications/cancelled"].includes(c)?new Response(null,{status:202,headers:{"cache-control":"no-store"}}):g(null,-32600,"Unsupported notification",400);if(c==="initialize"&&!m){if(!te(o.clientInfo)||!_(o.capabilities)||typeof o.protocolVersion!="string")return g(a,-32602,"Invalid initialize parameters",400);let b=Z.includes(o.protocolVersion)?o.protocolVersion:Z[0];return L(a,{protocolVersion:b,capabilities:X,serverInfo:n,instructions:ee},!1,n)}return c==="server/discover"&&m?L(a,{supportedVersions:H,capabilities:X,instructions:ee,ttlMs:0,cacheScope:"private"},!0,n):c==="ping"?L(a,{},m,n):c==="tools/list"?o.cursor!==void 0?g(a,-32602,"Invalid cursor"):L(a,{tools:i,...m?{ttlMs:0,cacheScope:"private"}:{}},m,n):c==="tools/call"?typeof o.name!="string"||!Object.hasOwn(M,o.name)?g(a,-32602,"Unknown tool"):o.arguments!==void 0&&!_(o.arguments)?g(a,-32602,"Tool arguments must be an object"):L(a,Te(o.name,o.arguments??{},t),m,n):g(a,-32601,"Method not found",m?404:200)}var ie=`<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#fbf9f4">
  <meta name="description" content="\uCEA0\uD398\uC778 \uBE0C\uB9AC\uD504\uBD80\uD130 \uCC44\uB110\uBCC4 \uD64D\uBCF4\uBB38\uACFC UTM \uB9C1\uD06C\uAE4C\uC9C0. \uD30C\uB3D9 \uB9C8\uCF00\uD305 \uC791\uC5C5\uC2E4.">
  <meta property="og:title" content="\uD30C\uB3D9 \xB7 \uB9C8\uCF00\uD305 \uC791\uC5C5\uC2E4">
  <meta property="og:description" content="\uCEA0\uD398\uC778 \uBE0C\uB9AC\uD504, \uCC44\uB110\uBCC4 \uD64D\uBCF4\uBB38, \uBB38\uAD6C \uAC80\uD1A0, UTM \uB9C1\uD06C\uB97C \uD55C\uACF3\uC5D0\uC11C.">
  <title>\uD30C\uB3D9 \xB7 \uB9C8\uCF00\uD305 \uC791\uC5C5\uC2E4</title>
  <link rel="stylesheet" href="/styles.css">
  <script type="module" src="/app.js"><\/script>
</head>
<body>
<a class="skip" href="#workspace">\uC791\uC5C5 \uB3C4\uAD6C\uB85C \uAC74\uB108\uB6F0\uAE30</a>
<div class="shell">
  <aside class="rail">
    <a class="brand" href="/" aria-label="\uD30C\uB3D9 \uC791\uC5C5\uC2E4 \uD648">
      <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
      <span><strong>\uD30C\uB3D9</strong><small>PADONG STUDIO</small></span>
    </a>
    <nav class="navigation" aria-label="\uD30C\uB3D9 \uB3C4\uAD6C">
      <span class="nav-label">\uC791\uC5C5 \uB3C4\uAD6C</span>
      <button type="button" data-tool="brief" aria-current="page"><span aria-hidden="true">\u25A4</span> \uCEA0\uD398\uC778 \uBE0C\uB9AC\uD504</button>
      <button type="button" data-tool="copy"><span aria-hidden="true">\u224B</span> \uCC44\uB110\uBCC4 \uD64D\uBCF4\uBB38</button>
      <button type="button" data-tool="review"><span aria-hidden="true">\u2713</span> \uBB38\uAD6C \uAC80\uD1A0</button>
      <button type="button" data-tool="tracking"><span aria-hidden="true">\u2197</span> UTM \uB9C1\uD06C</button>
      <button type="button" data-tool="profile"><span aria-hidden="true">\u25A2</span> \uD504\uB85C\uC81D\uD2B8 \uC815\uB9AC</button>
      <button type="button" data-tool="connect" class="nav-connect"><span aria-hidden="true">\u2318</span> ChatGPT \uC5F0\uACB0</button>
    </nav>
    <div class="rail-footer"><b>ALDOL STUDIO</b><span>\uB9C8\uCF00\uD305 \uC791\uC5C5\uC2E4</span></div>
  </aside>

  <main id="main" class="main">
    <header class="top">
      <span>\uB9C8\uCF00\uD305 \uC791\uC5C5\uC2E4</span>
      <button class="top-connect" type="button" data-tool="connect"><span aria-hidden="true">\u2318</span> ChatGPT \uC5F0\uACB0</button>
    </header>
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-copy">
        <h1 id="hero-title">\uCEA0\uD398\uC778 \uCCAB \uC904\uBD80\uD130<br>\uCD94\uC801 \uB9C1\uD06C\uAE4C\uC9C0.</h1>
        <p>\uBB34\uC5C7\uC744 \uC54C\uB9B4\uC9C0 \uC815\uD558\uACE0, \uCC44\uB110\uC5D0 \uB9DE\uAC8C \uC368\uBCF4\uACE0, \uBC18\uC751\uC744 \uD655\uC778\uD560 \uB9C1\uD06C\uB97C \uB9CC\uB4DC\uC138\uC694.</p>
        <button class="primary hero-button" type="button" data-starter>\uBE0C\uB9AC\uD504 \uB9CC\uB4E4\uAE30 <span aria-hidden="true">\u2198</span></button>
      </div>
      <div class="waves" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><b>\u2733</b></div>
    </section>

    <section class="workspace" id="workspace" tabindex="-1" aria-labelledby="tool-title">
      <div class="tool-heading">
        <div><h2 id="tool-title">\uCEA0\uD398\uC778 \uBE0C\uB9AC\uD504</h2><p id="tool-description">\uB204\uAD6C\uC5D0\uAC8C \uBB34\uC5C7\uC744 \uC54C\uB9B4\uC9C0 \uC815\uD558\uACE0 \uC131\uACFC\uB97C \uD655\uC778\uD560 \uC9C0\uD45C\uB97C \uC7A1\uC73C\uC138\uC694.</p></div>
        <button id="sample" class="secondary" type="button">\uC608\uC81C \uB123\uAE30</button>
      </div>
      <div class="workspace-grid" id="workspace-grid">
        <form class="panel form-panel" id="tool-form"></form>
        <section class="panel result-panel" aria-labelledby="result-title">
          <div class="result-header">
            <h3 id="result-title">\uACB0\uACFC</h3>
            <button id="copy-result" class="secondary compact" type="button" hidden>\uBCF5\uC0AC</button>
          </div>
          <div id="result" class="result-content" aria-live="polite">
            <div class="empty"><span aria-hidden="true">\u2198</span><p>\uC785\uB825\uD55C \uB0B4\uC6A9\uC73C\uB85C \uB9CC\uB4E0 \uACB0\uACFC\uAC00 \uC5EC\uAE30\uC5D0 \uD45C\uC2DC\uB429\uB2C8\uB2E4.</p></div>
          </div>
          <button class="secondary continue-button" id="next-tool" type="button" hidden>\uC774 \uBE0C\uB9AC\uD504\uB85C \uD64D\uBCF4\uBB38 \uC4F0\uAE30 <span aria-hidden="true">\u2192</span></button>
        </section>
      </div>
      <section class="panel connection" id="connection" hidden aria-label="ChatGPT \uC5F0\uACB0 \uC548\uB0B4">
        <h3>MCP \uC5F0\uACB0 \uC8FC\uC18C</h3>
        <div class="endpoint"><code id="endpoint"></code><button class="secondary" id="copy-endpoint" type="button">\uC8FC\uC18C \uBCF5\uC0AC</button></div>
        <p id="availability" class="availability" aria-live="polite">\uC11C\uBC84 \uC0C1\uD0DC \uD655\uC778 \uC911</p>
        <ol>
          <li>ChatGPT \uC6F9\uC5D0\uC11C \uD50C\uB7EC\uADF8\uC778 \uD654\uBA74\uC758 <strong>\uCEE4\uC2A4\uD140 MCP \uC11C\uBC84 \uCD94\uAC00</strong>\uB97C \uC5FD\uB2C8\uB2E4.</li>
          <li>\uC704 \uC8FC\uC18C\uB97C \uBD99\uC5EC \uB123\uACE0 \uC778\uC99D\uC744 <strong>\uC778\uC99D \uC5C6\uC74C</strong>\uC73C\uB85C \uC120\uD0DD\uD569\uB2C8\uB2E4.</li>
          <li>\uC124\uCE58\uD55C \uD30C\uB3D9\uC744 \uC0C8 \uB300\uD654\uC5D0\uC11C \uC120\uD0DD\uD558\uACE0 \uB3C4\uAD6C\uB97C \uD638\uCD9C\uD569\uB2C8\uB2E4.</li>
        </ol>
        <div class="connection-actions">
          <a class="primary" href="https://chatgpt.com/plugins" target="_blank" rel="noopener">ChatGPT \uD50C\uB7EC\uADF8\uC778 \uC5F4\uAE30 \u2197</a>
          <button class="secondary" type="button" id="copy-command">\uD14C\uC2A4\uD2B8 \uBB38\uC7A5 \uBCF5\uC0AC</button>
        </div>
      </section>
      <p id="notice" class="notice" role="status"></p>
    </section>

    <footer class="footer"><span>\uD30C\uB3D9 \xB7 ALDOL STUDIO</span><span>\uC785\uB825 \uC790\uB8CC\uB85C \uCD08\uC548\uC744 \uB9CC\uB4E4\uACE0 \uBB38\uAD6C\uB97C \uAC80\uD1A0\uD569\uB2C8\uB2E4.</span></footer>
  </main>
</div>
</body>
</html>
`;var oe=`:root {
  color-scheme: light;
  --bg: #fbf9f4;
  --paper: #fffdfa;
  --ink: #262129;
  --muted: #645a63;
  --line: #e8dfd6;
  --accent: #f6d75d;
  --plum: #46263d;
  --hero: #f3e3e8;
  font-family: "Pretendard", "Noto Sans KR", "Apple SD Gothic Neo", system-ui, sans-serif;
  font-synthesis: none;
  line-height: 1.55;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); }
a { color: inherit; text-decoration: none; }
button, input, textarea, select { font: inherit; }
button { cursor: pointer; }
button:disabled { cursor: wait; opacity: .63; }
:focus-visible { outline: 3px solid #9b4a79; outline-offset: 3px; }
[hidden] { display: none !important; }
.skip { position: fixed; left: 16px; top: -70px; z-index: 4; background: var(--paper); padding: 10px; }
.skip:focus { top: 12px; }
.shell { min-height: 100vh; display: grid; grid-template-columns: 228px minmax(0, 1fr); }
.rail { border-right: 1px solid var(--line); display: flex; flex-direction: column; padding: 29px 16px 24px; background: #f8f3eb; }
.brand { display: flex; gap: 11px; align-items: center; margin: 0 9px 43px; color: var(--plum); }
.brand strong { display: block; font-weight: 850; font-size: 25px; letter-spacing: -.085em; line-height: 1.12; }
.brand small { font-size: 9px; font-weight: 750; letter-spacing: .13em; }
.brand-mark { display: grid; place-items: center; width: 43px; height: 43px; flex: none; border-radius: 14px; background: var(--plum); position: relative; }
.brand-mark i { border: 1px solid #ffe28a; width: 27px; height: 13px; border-radius: 50%; position: absolute; transform: rotate(-28deg) translateY(-5px); }
.brand-mark i:nth-child(2) { transform: rotate(-28deg); }
.brand-mark i:nth-child(3) { transform: rotate(-28deg) translateY(5px); }
.navigation { display: grid; gap: 4px; }
.nav-label { font-size: 12px; margin: 0 10px 8px; color: var(--muted); }
.navigation button { appearance: none; border: 0; background: transparent; color: var(--muted); border-radius: 9px; text-align: left; padding: 10px 12px; min-height: 44px; font-size: 14px; white-space: nowrap; }
.navigation button span { display: inline-block; width: 22px; font-size: 16px; }
.navigation button:hover { background: #eee5dd; color: var(--ink); }
.navigation button[aria-current] { background: #ebdce4; color: #482039; font-weight: 750; }
.navigation .nav-connect { margin-top: 16px; border-top: 1px solid var(--line); border-radius: 0 0 9px 9px; }
.rail-footer { margin: auto 12px 0; padding-top: 36px; color: var(--muted); font-size: 11px; display: grid; gap: 3px; }
.rail-footer b { color: var(--plum); font-size: 10px; letter-spacing: .13em; }
.main { min-width: 0; width: 100%; max-width: 1400px; padding: 0 clamp(22px, 4vw, 68px); margin-inline: auto; }
.top { min-height: 73px; display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--muted); font-size: 14px; font-weight: 650; }
.top-connect, .secondary { display: inline-flex; align-items: center; gap: 7px; background: transparent; color: var(--plum); border: 1px solid #ddcdd5; border-radius: 9px; font-size: 13px; font-weight: 700; min-height: 42px; padding: 8px 13px; text-decoration: none; white-space: nowrap; }
.top-connect:hover, .secondary:hover { background: #f2e7ed; }
.hero { min-height: 280px; padding: 36px clamp(23px, 5.1vw, 65px) 33px; display: grid; grid-template-columns: minmax(0, 1fr) 36%; position: relative; isolation: isolate; overflow: hidden; border-radius: 23px; background: var(--hero); }
.hero-copy { z-index: 1; }
.hero h1 { font-size: clamp(35px, 5.4vw, 72px); line-height: 1.08; letter-spacing: -.075em; margin: 0; font-weight: 850; color: #34232f; word-break: keep-all; }
.hero p { font-size: 14px; color: #5b4856; margin: 16px 0 23px; word-break: keep-all; }
.primary { color: #2a211b; background: var(--accent); border: 1px solid #e1c049; min-height: 44px; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center; gap: 12px; padding: 9px 15px; font-weight: 780; font-size: 14px; }
.primary:hover { background: #f7e186; }
.waves { position: absolute; z-index: 0; right: -4%; top: -20%; width: 52%; height: 140%; display: grid; place-items: center; transform: rotate(-25deg); pointer-events: none; }
.waves i { width: 86%; height: 63%; position: absolute; border: 1px solid #945b7d; border-radius: 50%; opacity: .65; }
.waves i:nth-child(2) { width: 69%; height: 51%; }
.waves i:nth-child(3) { width: 53%; height: 39%; }
.waves i:nth-child(4) { width: 38%; height: 28%; }
.waves i:nth-child(5) { width: 24%; height: 17%; border-color: #8e4f70; }
.waves i:nth-child(6) { width: 12%; height: 8%; background: var(--accent); border: 0; opacity: 1; }
.waves b { color: #884b70; position: absolute; bottom: 20%; right: 22%; font-size: 26px; }
.workspace { outline-offset: 6px; padding-top: 33px; scroll-margin-top: 10px; }
.tool-heading { display: flex; justify-content: space-between; align-items: center; gap: 14px; margin-bottom: 15px; }
.tool-heading h2 { margin: 0; font-size: clamp(22px, 3vw, 32px); letter-spacing: -.06em; line-height: 1.2; }
.tool-heading p { color: var(--muted); margin: 5px 0 0; font-size: 14px; }
.workspace-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 15px; align-items: start; }
.panel { border: 1px solid var(--line); border-radius: 14px; padding: clamp(15px, 2.1vw, 24px); background: var(--paper); min-width: 0; }
.form-panel { display: grid; gap: 14px; }
.form-panel label, legend { color: var(--ink); font-weight: 700; font-size: 13px; }
.form-panel label.field { display: grid; gap: 5px; }
.form-panel label small { color: var(--muted); font-weight: 450; }
.form-panel input:not([type=checkbox]), textarea, select { display: block; width: 100%; color: var(--ink); padding: 8px 10px; min-height: 42px; border-radius: 8px; border: 1px solid #ded2d4; background: #fff; font-size: 14px; }
textarea { resize: vertical; min-height: 76px; }
fieldset { border: 0; padding: 0; margin: 0; min-width: 0; }
.choices { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 5px; }
.choices label { border: 1px solid var(--line); min-height: 38px; display: inline-flex; align-items: center; gap: 4px; padding: 4px 7px; border-radius: 7px; font-weight: 550; }
input[type=checkbox] { accent-color: #77365d; margin: 0 3px 0 0; }
.submit { justify-self: start; }
.result-panel { display: flex; flex-direction: column; min-height: 249px; }
.result-header { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 34px; border-bottom: 1px solid var(--line); padding-bottom: 9px; }
.result-header h3, .connection h3 { margin: 0; font-size: 17px; letter-spacing: -.035em; }
.compact { min-height: 34px; padding: 2px 9px; }
.result-content { padding-top: 12px; overflow-wrap: anywhere; white-space: pre-wrap; }
.result-content h4 { font-size: 13px; color: var(--plum); margin: 10px 0 5px; font-weight: 800; }
.result-content p { margin: 0 0 12px; }
.result-content .error { color: #8a2443; }
.empty { min-height: 151px; display: grid; justify-content: center; align-content: center; justify-items: center; gap: 8px; color: var(--muted); font-size: 13px; text-align: center; white-space: normal; }
.empty span { background: #f3e6ed; color: #703d5c; border-radius: 12px; width: 43px; height: 43px; display: grid; place-items: center; font-size: 20px; }
.continue-button { align-self: start; margin-top: 9px; }
.connection { max-width: 770px; }
.connection ol { padding-left: 21px; }
.connection li { padding-block: 3px; }
.endpoint { display: flex; align-items: center; flex-wrap: wrap; gap: 9px; margin-top: 12px; }
.endpoint code { color: var(--plum); min-width: 0; max-width: 100%; overflow-wrap: anywhere; background: #f6edf1; padding: 8px 10px; border-radius: 6px; }
.availability { color: #645065; font-size: 13px; }
.connection-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.notice { color: var(--muted); font-size: 13px; min-height: 19px; margin: 10px 0; }
.footer { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 6px 18px; color: var(--muted); border-top: 1px solid var(--line); padding: 19px 0 23px; font-size: 12px; }
@media (max-width: 900px) {
  .shell { grid-template-columns: 175px minmax(0, 1fr); }
  .rail { padding-inline: 10px; }
  .main { padding-inline: 22px; }
  .hero { grid-template-columns: minmax(0, 1fr) 28%; }
}
@media (max-width: 650px) {
  .shell { display: block; }
  .rail { border-right: 0; border-bottom: 1px solid var(--line); padding: 13px 14px 5px; }
  .brand { margin: 0 0 7px; }
  .brand strong { font-size: 21px; }
  .brand-mark { width: 37px; height: 37px; }
  .navigation { display: flex; overflow-x: auto; scrollbar-width: thin; gap: 3px; padding: 3px 1px 5px; }
  .navigation button { min-height: 42px; padding: 6px 9px; font-size: 12px; }
  .navigation button span { width: 15px; font-size: 13px; }
  .navigation .nav-connect, .nav-label, .rail-footer, .top > span { display: none; }
  .main { padding-inline: 14px; }
  .top { justify-content: end; min-height: 54px; }
  .top-connect { min-height: 35px; padding: 5px 8px; font-size: 12px; }
  .hero { min-height: 220px; padding: 25px 17px 21px; border-radius: 16px; grid-template-columns: minmax(0, 1fr); }
  .hero h1 { font-size: clamp(32px, 8.9vw, 43px); }
  .hero p { max-width: 220px; font-size: 12px; margin: 12px 0 16px; }
  .waves { opacity: .31; right: -16%; width: 67%; }
  .workspace { padding-top: 24px; }
  .workspace-grid { grid-template-columns: minmax(0, 1fr); gap: 11px; }
  .tool-heading p { font-size: 12px; }
}
`;var se=`const all = (selector, from = document) => [...from.querySelectorAll(selector)];
const get = id => document.getElementById(id);
const channels = {
  threads: 'Threads', discord: 'Discord', x: 'X', instagram: 'Instagram',
  youtube_shorts: 'YouTube Shorts', website: '\uC6F9\uC0AC\uC774\uD2B8',
};
const objective = { awareness: '\uC778\uC9C0\uB3C4', traffic: '\uC0AC\uC774\uD2B8 \uBC29\uBB38', game_start: '\uAC8C\uC784 \uC2DC\uC791', reactivation: '\uAE30\uC874 \uC774\uC6A9\uC790 \uBCF5\uADC0' };
const tones = { informative: '\uC815\uBCF4 \uC911\uC2EC', playful: '\uCE5C\uADFC\uD558\uAC8C', concise: '\uC9E7\uAC8C' };
const text = (name, label, placeholder = '', max = 120, required = true) => ({ name, label, placeholder, max, required });
const area = (name, label, placeholder, max, required = false) => ({ ...text(name, label, placeholder, max, required), kind: 'textarea' });
const select = (name, label, values) => ({ name, label, values, kind: 'select' });
const check = { name: 'channels', label: '\uCC44\uB110', values: channels, kind: 'checks' };
const landing = name => ({ ...text(name, name === 'base_url' ? '\uC6D0\uBCF8 URL' : '\uC548\uB0B4 \uB9C1\uD06C \xB7 \uC120\uD0DD', 'https://example.org/game', 2000, name === 'base_url'), kind: 'url' });
const projectName = text('name', '\uD504\uB85C\uC81D\uD2B8 \uC774\uB984', '\uC608: \uC791\uC740 \uC815\uC6D0');
const feature = area('feature', '\uC18C\uAC1C\uD560 \uBCC0\uD654', '\uC608: \uBC24\uC5D0\uB9CC \uC5F4\uB9AC\uB294 \uC628\uC2E4\uC744 \uCD94\uAC00\uD588\uC5B4\uC694.', 500, true);
const audience = text('audience', '\uB300\uC0C1', '\uC608: \uC774\uC804\uC5D0 \uAC8C\uC784\uC744 \uD574\uBCF8 \uC0AC\uB78C', 180);
const channelDefaults = ['threads', 'discord'];

const tools = {
  brief: {
    name: '\uCEA0\uD398\uC778 \uBE0C\uB9AC\uD504', api: 'marketing_create_brief', run: '\uBE0C\uB9AC\uD504 \uB9CC\uB4E4\uAE30',
    description: '\uB204\uAD6C\uC5D0\uAC8C \uBB34\uC5C7\uC744 \uC54C\uB9B4\uC9C0 \uC815\uD558\uACE0 \uC131\uACFC\uB97C \uD655\uC778\uD560 \uC9C0\uD45C\uB97C \uC7A1\uC73C\uC138\uC694.',
    fields: [projectName, feature, audience, select('objective', '\uCEA0\uD398\uC778 \uBAA9\uD45C', objective), check],
    defaults: { channels: channelDefaults },
    sample: { name: '\uC791\uC740 \uC815\uC6D0', feature: '\uBC24\uC5D0\uB9CC \uC5F4\uB9AC\uB294 \uC628\uC2E4\uC744 \uCD94\uAC00\uD588\uC5B4\uC694.', audience: '\uC791\uC740 \uC815\uC6D0\uC744 \uD574\uBCF8 \uC774\uC6A9\uC790', objective: 'reactivation', channels: channelDefaults },
  },
  copy: {
    name: '\uCC44\uB110\uBCC4 \uD64D\uBCF4\uBB38', api: 'marketing_generate_copy', run: '\uD64D\uBCF4\uBB38 \uB9CC\uB4E4\uAE30',
    description: '\uBE0C\uB9AC\uD504\uC5D0\uC11C \uAC8C\uC2DC\uBB3C \uCD08\uC548\uC744 \uB9CC\uB4E4\uAC70\uB098 \uCC44\uB110\uBCC4\uB85C \uB2E4\uB4EC\uC740 \uBB38\uC7A5\uC744 \uC0AC\uC6A9\uD558\uC138\uC694.',
    fields: [projectName, feature, check, select('tone', '\uB9D0\uD22C', tones), landing('landing_url'),
      area('threads_copy', 'Threads \uBB38\uAD6C \xB7 \uC120\uD0DD', '\uC9C1\uC811 \uC368\uB454 \uBB38\uAD6C\uAC00 \uC788\uC73C\uBA74 \uB123\uC73C\uC138\uC694.', 1800),
      area('discord_copy', 'Discord \uBB38\uAD6C \xB7 \uC120\uD0DD', '\uC9C1\uC811 \uC368\uB454 \uBB38\uAD6C\uAC00 \uC788\uC73C\uBA74 \uB123\uC73C\uC138\uC694.', 1800)],
    defaults: { channels: channelDefaults },
    sample: {
      name: '\uC791\uC740 \uC815\uC6D0', feature: '\uBC24\uC5D0\uB9CC \uC5F4\uB9AC\uB294 \uC628\uC2E4\uC744 \uCD94\uAC00\uD588\uC5B4\uC694.', channels: channelDefaults, tone: 'playful',
      threads_copy: '\uC791\uC740 \uC815\uC6D0\uC5D0 \uBC24\uC5D0\uB9CC \uC5F4\uB9AC\uB294 \uC628\uC2E4\uC744 \uB9CC\uB4E4\uC5C8\uC5B4\uC694. \uB0AE\uC5D0 \uBCF8 \uC815\uC6D0\uC774\uB791 \uC5BC\uB9C8\uB098 \uB2E4\uB978\uC9C0 \uC2AC\uCA4D \uB4E4\uB7EC\uBCF4\uC138\uC694.',
    },
  },
  review: {
    name: '\uBB38\uAD6C \uAC80\uD1A0', api: 'marketing_review_campaign', run: '\uBB38\uAD6C \uAC80\uD1A0\uD558\uAE30',
    description: '\uAC80\uC99D\uC774 \uD544\uC694\uD55C \uC8FC\uC7A5\uACFC \uAC1C\uC778\uC815\uBCF4\uAC00 \uB4E4\uC5B4\uAC14\uB294\uC9C0 \uC0B4\uD3B4\uBCF4\uC138\uC694.',
    fields: [area('copy', '\uAC80\uD1A0\uD560 \uBB38\uAD6C', '\uD64D\uBCF4\uBB38\uC744 \uBD99\uC5EC \uB123\uC73C\uC138\uC694.', 15000, true), select('platform', '\uCC44\uB110', { unspecified: '\uC120\uD0DD \uC548 \uD568', ...channels }),
      { ...text('source_url', '\uADFC\uAC70 \uB9C1\uD06C \xB7 \uC120\uD0DD', 'https://example.org/source', 2000, false), kind: 'url' }],
    sample: { copy: '\uAD6D\uB0B4 \uCD5C\uCD08! \uBAA8\uB4E0 \uC774\uC6A9\uC790\uAC00 100% \uD6A8\uACFC\uB97C \uBD24\uC2B5\uB2C8\uB2E4. \uB531 \uC624\uB298\uB9CC \uB9CC\uB098\uBCF4\uC138\uC694.', platform: 'threads' },
  },
  tracking: {
    name: 'UTM \uB9C1\uD06C', api: 'marketing_build_tracking', run: '\uCD94\uC801 \uB9C1\uD06C \uB9CC\uB4E4\uAE30',
    description: '\uCEA0\uD398\uC778\uACFC \uCC44\uB110\uC744 \uAD6C\uBD84\uD560 \uC218 \uC788\uB3C4\uB85D \uB9C1\uD06C\uC5D0 UTM\uC744 \uBD99\uC774\uC138\uC694.',
    fields: [landing('base_url'), text('source', '\uC720\uC785 \uCC44\uB110 \xB7 source', 'threads', 110),
      text('medium', '\uB9E4\uCCB4 \xB7 medium', 'social', 110), text('campaign', '\uCEA0\uD398\uC778 \xB7 campaign', 'garden-launch', 110),
      text('content', '\uC18C\uC7AC \xB7 content \xB7 \uC120\uD0DD', 'night-greenhouse', 110, false)],
    sample: { base_url: 'https://example.org/garden', source: 'threads', medium: 'social', campaign: 'garden-launch', content: 'night-greenhouse' },
  },
  profile: {
    name: '\uD504\uB85C\uC81D\uD2B8 \uC815\uB9AC', api: 'marketing_project_profile', run: '\uD504\uB85C\uC81D\uD2B8 \uC815\uB9AC\uD558\uAE30',
    description: '\uD504\uB85C\uC81D\uD2B8 \uC774\uB984\uACFC \uD2B9\uC9D5, \uC774\uC6A9\uC790 \uC815\uBCF4\uB97C \uD55C \uBC88\uC5D0 \uC815\uB9AC\uD558\uC138\uC694.',
    fields: [projectName, area('description', '\uD504\uB85C\uC81D\uD2B8 \uC124\uBA85', '\uC5B4\uB5A4 \uD504\uB85C\uC81D\uD2B8\uC778\uC9C0 \uC801\uC5B4\uBCF4\uC138\uC694.', 1000),
      area('feature', '\uB300\uD45C \uD2B9\uC9D5', '\uC608: \uC57C\uAC04 \uC628\uC2E4 \uD0D0\uD5D8', 500), { ...audience, required: false }],
    sample: { name: '\uC791\uC740 \uC815\uC6D0', description: '\uB0AE\uACFC \uBC24\uC774 \uB2EC\uB77C\uC9C0\uB294 \uC9E7\uC740 \uC815\uC6D0 \uD0D0\uD5D8 \uAC8C\uC784\uC785\uB2C8\uB2E4.', feature: '\uC57C\uAC04 \uC628\uC2E4 \uD0D0\uD5D8', audience: '\uD3B8\uC548\uD55C \uD0D0\uD5D8\uC744 \uC88B\uC544\uD558\uB294 \uC774\uC6A9\uC790' },
  },
  connect: { name: 'ChatGPT \uC5F0\uACB0', description: '\uD30C\uB3D9\uC744 ChatGPT\uC5D0 \uCD94\uAC00\uD558\uBA74 \uB300\uD654\uC5D0\uC11C \uCEA0\uD398\uC778 \uB3C4\uAD6C\uB97C \uBD88\uB7EC \uC4F8 \uC218 \uC788\uC5B4\uC694.' },
};

const form = get('tool-form');
const drafts = new Map();
const results = new Map();
const running = new Set();
const endpoint = new URL('/mcp', location.origin).href;
const testPrompt = '\uD30C\uB3D9\uC758 marketing_build_tracking \uB3C4\uAD6C\uB85C https://example.org/garden \uB9C1\uD06C\uC5D0 source=threads, medium=social, campaign=garden-launch\uB97C \uBD99\uC5EC\uC918.';
let active = 'brief';
let lastBrief;

function element(tag, value, className) {
  const node = document.createElement(tag);
  if (value !== undefined) node.textContent = value;
  if (className) node.className = className;
  return node;
}

function inputField(field, value) {
  if (field.kind === 'checks') {
    const group = element('fieldset');
    const choices = element('div', undefined, 'choices');
    group.append(element('legend', field.label), choices);
    for (const [id, title] of Object.entries(field.values)) {
      const row = element('label');
      const box = element('input');
      Object.assign(box, { type: 'checkbox', name: field.name, value: id, checked: (value ?? []).includes(id) });
      row.append(box, title);
      choices.append(row);
    }
    return group;
  }
  const row = element('label', field.label, 'field');
  const input = element(field.kind === 'select' ? 'select' : field.kind === 'textarea' ? 'textarea' : 'input');
  input.name = field.name;
  if (field.kind === 'select') {
    for (const [id, title] of Object.entries(field.values)) {
      const option = element('option', title);
      option.value = id;
      input.append(option);
    }
    if (value && Object.hasOwn(field.values, value)) input.value = value;
  } else {
    if (input.tagName === 'INPUT') input.type = field.kind === 'url' ? 'url' : 'text';
    input.required = field.required;
    input.placeholder = field.placeholder;
    input.maxLength = field.max;
    input.value = value ?? '';
  }
  row.append(input);
  return row;
}

function readForm() {
  const data = new FormData(form);
  const values = Object.fromEntries([...data].map(([key, value]) => [key, value.trim()]));
  if (tools[active].fields?.includes(check)) values.channels = data.getAll('channels');
  return values;
}

function renderForm() {
  if (active === 'connect') return;
  const configuration = tools[active];
  const values = drafts.get(active) ?? configuration.defaults ?? {};
  const submit = element('button', configuration.run + ' \u2197', 'primary submit');
  submit.type = 'submit';
  submit.disabled = running.has(active);
  form.replaceChildren(...configuration.fields.map(field => inputField(field, values[field.name])), submit);
}

function renderResult() {
  const entry = results.get(active);
  const result = get('result');
  get('copy-result').hidden = !entry?.parts;
  get('next-tool').hidden = active !== 'brief' || !entry?.parts;
  if (running.has(active)) {
    result.replaceChildren(element('p', '\uC791\uC131 \uC911\u2026'));
    return;
  }
  if (!entry) {
    const empty = element('div', undefined, 'empty');
    empty.append(element('span', '\u2198'), element('p', '\uC785\uB825\uD55C \uB0B4\uC6A9\uC73C\uB85C \uB9CC\uB4E0 \uACB0\uACFC\uAC00 \uC5EC\uAE30\uC5D0 \uD45C\uC2DC\uB429\uB2C8\uB2E4.'));
    result.replaceChildren(empty);
    return;
  }
  if (entry.error) {
    result.replaceChildren(element('p', entry.error, 'error'));
    return;
  }
  result.replaceChildren(...entry.parts.flatMap(([title, content]) => [
    element('h4', title), element('p', content),
  ]));
}

function activate(key, focus = true) {
  if (!Object.hasOwn(tools, key)) return;
  if (active !== 'connect') drafts.set(active, readForm());
  active = key;
  for (const button of all('.navigation [data-tool]')) {
    if (button.dataset.tool === key) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
  get('tool-title').textContent = tools[key].name;
  get('tool-description').textContent = tools[key].description;
  get('workspace-grid').hidden = key === 'connect';
  get('sample').hidden = key === 'connect';
  get('connection').hidden = key !== 'connect';
  get('notice').textContent = '';
  if (key === 'connect') refreshStatus();
  else {
    renderForm();
    renderResult();
  }
  if (focus) {
    get('workspace').focus({ preventScroll: true });
    get('workspace').scrollIntoView({ block: 'start' });
  }
}

function argumentsFor(key, values) {
  const name = values.name;
  const project = { project_id: 'studio-project', name, features: values.feature ? [values.feature] : [] };
  switch (key) {
    case 'profile':
      return { ...project, description: values.description, audiences: values.audience ? [values.audience] : [] };
    case 'brief':
      if (!values.channels.length) throw new Error('\uCC44\uB110\uC744 \uD558\uB098 \uC774\uC0C1 \uACE8\uB77C\uC8FC\uC138\uC694.');
      return { project, campaign_id: 'studio-campaign', objective: values.objective, audience: values.audience, channels: values.channels };
    case 'copy': {
      if (!values.channels.length) throw new Error('\uCC44\uB110\uC744 \uD558\uB098 \uC774\uC0C1 \uACE8\uB77C\uC8FC\uC138\uC694.');
      const approved = {};
      for (const channel of ['threads', 'discord']) {
        const wording = values[channel + '_copy'];
        if (!wording) continue;
        if (!values.channels.includes(channel)) throw new Error(channels[channel] + ' \uBB38\uAD6C\uB97C \uC4F0\uB824\uBA74 \uCC44\uB110\uB3C4 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.');
        approved[channel] = wording;
      }
      const matchesBrief = lastBrief?.project.name === name && lastBrief?.project.features[0] === values.feature;
      const brief = {
        ...(matchesBrief ? lastBrief : {}),
        project, channels: values.channels,
        objective: matchesBrief ? lastBrief.objective : 'awareness',
        target_audience: matchesBrief ? lastBrief.target_audience : '\uD504\uB85C\uC81D\uD2B8\uC5D0 \uAD00\uC2EC \uC788\uB294 \uC774\uC6A9\uC790',
        core_message_candidate: values.feature,
      };
      return { brief, tone: values.tone, landing_url: values.landing_url, channel_copy: approved };
    }
    case 'review':
      return { text: values.copy, platform: values.platform, supporting_sources: values.source_url ? [values.source_url] : [] };
    case 'tracking':
      return values;
  }
}

async function invoke(name, args) {
  const protocol = '2026-07-28';
  const response = await fetch('/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream',
      'mcp-protocol-version': protocol, 'mcp-method': 'tools/call', 'mcp-name': name },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: {
      name, arguments: args, _meta: {
        'io.modelcontextprotocol/protocolVersion': protocol,
        'io.modelcontextprotocol/clientInfo': { name: 'PADONG Studio', version: '1' },
        'io.modelcontextprotocol/clientCapabilities': {},
      },
    } }),
    signal: AbortSignal.timeout(15000),
  });
  if (response.status === 413) throw new Error('\uC785\uB825\uB7C9\uC774 \uB108\uBB34 \uB9CE\uC544\uC694. \uBCF8\uBB38\uC744 \uC904\uC5EC \uB2E4\uC2DC \uC2E4\uD589\uD574 \uC8FC\uC138\uC694.');
  if (!response.ok) throw new Error('\uC694\uCCAD\uC744 \uCC98\uB9AC\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694. \uC7A0\uC2DC \uB4A4 \uB2E4\uC2DC \uC2E4\uD589\uD574 \uC8FC\uC138\uC694.');
  const { result, error } = await response.json();
  if (result?.isError || error) throw new Error(result?.content?.[0]?.text ?? '\uC785\uB825 \uB0B4\uC6A9\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694.');
  if (!result?.structuredContent) throw new Error('\uACB0\uACFC\uB97C \uC77D\uC9C0 \uBABB\uD588\uC5B4\uC694. \uB2E4\uC2DC \uC2E4\uD589\uD574 \uC8FC\uC138\uC694.');
  return result.structuredContent;
}

function partsFor(key, data) {
  switch (key) {
    case 'brief': {
      lastBrief = data.brief;
      const metric = { reach: '\uB3C4\uB2EC \uC218', landing_visits: '\uC0AC\uC774\uD2B8 \uBC29\uBB38 \uC218', game_starts: '\uAC8C\uC784 \uC2DC\uC791 \uC218', returning_players: '\uBCF5\uADC0 \uC774\uC6A9\uC790 \uC218' };
      return [
        ['\uCEA0\uD398\uC778 \uBAA9\uD45C', lastBrief.goal], ['\uB300\uC0C1', lastBrief.target_audience],
        ['\uD575\uC2EC \uB0B4\uC6A9', lastBrief.project.features[0] ?? lastBrief.core_message_candidate],
        ['\uCC44\uB110', lastBrief.channels.map(channel => channels[channel]).join(', ')],
        ['\uD575\uC2EC \uC9C0\uD45C', metric[lastBrief.measuring_plan.primary_kpi] ?? lastBrief.measuring_plan.primary_kpi],
      ];
    }
    case 'copy':
      return Object.entries(data.variants).map(([channel, variant]) => [channels[channel], variant.text]);
    case 'review':
      return [['\uAC80\uD1A0\uD560 \uD56D\uBAA9', data.flags.length ? data.flags.map(flag => '\u2022 ' + flag.detail).join('\\n') : '\uC785\uB825\uC5D0\uC11C \uC801\uC6A9\uB41C \uADDC\uCE59\uC758 \uACBD\uACE0\uAC00 \uC5C6\uC5C8\uC5B4\uC694. \uAC8C\uC2DC \uC804\uC5D0 \uC0AC\uC2E4\uACFC \uADFC\uAC70\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694.']];
    case 'tracking':
      return [['\uCD94\uC801 \uB9C1\uD06C', data.url]];
    case 'profile': {
      const p = data.profile;
      return [['\uD504\uB85C\uC81D\uD2B8', p.name], ['\uC18C\uAC1C', p.description || '\uC785\uB825 \uC5C6\uC74C'],
        ['\uD2B9\uC9D5', p.features.join('\\n') || '\uC785\uB825 \uC5C6\uC74C'], ['\uB300\uC0C1', p.audiences.join(', ') || '\uC785\uB825 \uC5C6\uC74C']];
    }
  }
}

async function copyToClipboard(value) {
  try {
    await navigator.clipboard.writeText(value);
    get('notice').textContent = '\uBCF5\uC0AC\uD588\uC5B4\uC694.';
  } catch {
    get('notice').textContent = '\uD074\uB9BD\uBCF4\uB4DC\uB97C \uC5F4 \uC218 \uC5C6\uC5B4\uC694. \uD654\uBA74\uC758 \uBB38\uAD6C\uB97C \uC120\uD0DD\uD574 \uBCF5\uC0AC\uD574 \uC8FC\uC138\uC694.';
  }
}

async function refreshStatus() {
  get('availability').textContent = '\uC11C\uBC84 \uC0C1\uD0DC \uD655\uC778 \uC911';
  try {
    const response = await fetch('/api/status', { signal: AbortSignal.timeout(6000) });
    if (!response.ok) throw new Error('Unavailable');
    const { tool_count } = await response.json();
    get('availability').textContent = '\uC11C\uBC84 \uC5F0\uACB0 \uAC00\uB2A5 \xB7 \uB3C4\uAD6C ' + tool_count + '\uAC1C \xB7 \uD30C\uB3D9 \uACC4\uC815 \uC5C6\uC774 \uC0AC\uC6A9';
  } catch {
    get('availability').textContent = '\uC11C\uBC84 \uC0C1\uD0DC\uB97C \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694.';
  }
}

get('endpoint').textContent = endpoint;
for (const button of all('[data-tool]')) button.addEventListener('click', () => activate(button.dataset.tool));
get('sample').addEventListener('click', () => {
  drafts.set(active, tools[active].sample);
  renderForm();
});
get('next-tool').addEventListener('click', () => {
  drafts.set('copy', { name: lastBrief.project.name, feature: lastBrief.project.features[0], channels: lastBrief.channels });
  activate('copy');
});
get('copy-result').addEventListener('click', () => {
  const parts = results.get(active)?.parts;
  if (parts) copyToClipboard(parts.length === 1 ? parts[0][1] : parts.map(([key, value]) => key + '\\n' + value).join('\\n\\n'));
});
get('copy-endpoint').addEventListener('click', () => copyToClipboard(endpoint));
get('copy-command').addEventListener('click', () => copyToClipboard(testPrompt));
document.querySelector('[data-starter]').addEventListener('click', () => activate('brief'));
form.addEventListener('submit', async event => {
  event.preventDefault();
  const key = active;
  if (running.has(key)) return;
  const values = readForm();
  drafts.set(key, values);
  running.add(key);
  get('notice').textContent = '';
  renderForm();
  renderResult();
  try {
    const result = await invoke(tools[key].api, argumentsFor(key, values));
    results.set(key, { parts: partsFor(key, result) });
  } catch (error) {
    const known = error instanceof Error && error.name === 'Error' && /[\uAC00-\uD7A3]/.test(error.message);
    results.set(key, { error: known ? error.message : '\uC5F0\uACB0\uC774 \uB04A\uACBC\uC5B4\uC694. \uB2E4\uC2DC \uC2E4\uD589\uD574 \uC8FC\uC138\uC694.' });
  } finally {
    running.delete(key);
    if (active === key) {
      drafts.set(key, readForm());
      renderForm();
      renderResult();
    }
  }
});
renderForm();
`;var ce={name:"aldol-padong-studio",version:j},le=$.map(({_meta:e,...t})=>{let n=[{type:"noauth"}];return{...t,securitySchemes:n,_meta:{...e,securitySchemes:n}}}),Ie=new Map([["/",["text/html; charset=utf-8",ie]],["/styles.css",["text/css; charset=utf-8",oe]],["/app.js",["text/javascript; charset=utf-8",se]]]),pe={"x-content-type-options":"nosniff","referrer-policy":"no-referrer","permissions-policy":"camera=(), microphone=(), geolocation=()","content-security-policy":"default-src 'none'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"},We={async fetch(e){let t=new URL(e.url);if(t.pathname==="/mcp")return Q(e,t.origin)?ae(e,null,{server:ce,tools:le}):w(403,"Origin forbidden");if(!["GET","HEAD"].includes(e.method))return w(405,null,{Allow:"GET, HEAD"});if(t.pathname==="/api/status"){let a=JSON.stringify({service:ce.name,version:j,mcp:"/mcp",tool_count:le.length,authentication:"none"});return new Response(e.method==="HEAD"?null:a,{headers:{...pe,"content-type":"application/json; charset=utf-8","cache-control":"no-store"}})}let n=Ie.get(t.pathname);if(!n)return w(404,"Not found");let[i,r]=n;return new Response(e.method==="HEAD"?null:r,{headers:{...pe,"content-type":i,"cache-control":"public, max-age=300"}})}};export{We as default};
