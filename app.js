(function(){
"use strict";
const TZ="America/Sao_Paulo";
const $=id=>document.getElementById(id);
const Q=new URLSearchParams(location.search);
let SIM=false,REMONTADO=false,BASE=null,CAT=null, SEGS=[], IDX=-1, DIA=null, player=null, pronto=false, ligado=false, timer=null, carregouEm=0, ultimoEstado=-1;
const ruins=new Set(JSON.parse(sessionStorage.getItem("bz_ruins")||"[]"));
/* relógio simulado: só existe com ?admin=1. Quem abre o endereço normal sempre vê a hora real. */
const ADMIN=Q.get("admin")==="1";
const LS_REL="bz.unificado.relogio.v1";
let deslocamento=0;
if(ADMIN){try{const r=JSON.parse(localStorage.getItem(LS_REL)||"null");if(r&&typeof r.desl==="number"&&isFinite(r.desl))deslocamento=r.desl;}catch(e){}
  const t=Q.get("t"),m=t&&t.match(/^(\d{1,2}):(\d{2})$/);if(m){deslocamento=0;deslocamento=(+m[1]*3600+ +m[2]*60)-agoraSP(0).seg;}}

/* ---------- edição (overrides do painel, localStorage deste navegador) ---------- */
const LS_ED="bz.unificado.edicao.v1";
const Edicao={
  padrao(){return {versao:1,grade:null,videosOff:[],canaisOff:[],videosAdd:[],atualizado:null};},
  ler(){try{const c=JSON.parse(localStorage.getItem(LS_ED)||"null");if(c&&c.versao===1)return Object.assign(this.padrao(),c);}catch(e){}return this.padrao();},
  gravar(c){c.atualizado=new Date().toISOString();try{localStorage.setItem(LS_ED,JSON.stringify(c));return true;}catch(e){return false;}},
  limpar(){try{localStorage.removeItem(LS_ED);}catch(e){}},
  mescla(base){
    const c=this.ler(),cat=JSON.parse(JSON.stringify(base));
    if(c.grade){["util","fds","madrugada","quiz_horas"].forEach(k=>{if(c.grade[k])cat.grade[k]=c.grade[k];});}
    const off=new Set(c.videosOff),coff=new Set(c.canaisOff);
    const ids=new Set(cat.videos.map(v=>v.id));
    (c.videosAdd||[]).forEach(v=>{if(v&&/^[A-Za-z0-9_-]{11}$/.test(v.id)&&!ids.has(v.id)&&v.dur>0&&cat.tipos[v.tipo]){cat.videos.push(v);ids.add(v.id);}});
    cat.videos=cat.videos.filter(v=>!off.has(v.id)&&!coff.has(v.canal));
    return cat;
  }
};

/* ---------- relógio de Brasília ---------- */
function agoraSP(desl){
  const d=new Date(Date.now()+((desl===undefined?deslocamento:desl)*1000));
  const p={};new Intl.DateTimeFormat("en-CA",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",weekday:"short",hourCycle:"h23"}).formatToParts(d).forEach(x=>p[x.type]=x.value);
  const h=+p.hour%24;
  return {chave:`${p.year}-${p.month}-${p.day}`,seg:h*3600+ +p.minute*60+ +p.second,dow:p.weekday,data:d};
}
const fds=dow=>dow==="Sat"||dow==="Sun";
function hm(s){s=((s%86400)+86400)%86400;const h=Math.floor(s/3600),m=Math.floor(s%3600/60);return m?`${h}h${String(m).padStart(2,"0")}`:`${h}h`;}
function hm5(s){return hm(Math.ceil(s/300)*300);}

/* ---------- sorteio estável por dia ---------- */
function hash(str){let h=1779033703^str.length;for(let i=0;i<str.length;i++){h=Math.imul(h^str.charCodeAt(i),3432918353);h=h<<13|h>>>19;}return h>>>0;}
function rng(seed){let a=seed;return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function embaralha(arr,r){const a=arr.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

/* ---------- monta a grade do dia ---------- */
const LONGOS=new Set(["sho","doc","via","mpb","cie"]);
const RESERVA={cli:["cli","mpb","cur"],mpb:["mpb","sho","cur"],sho:["sho","mpb","doc","cur"]};
const CAP={hum:20*60,cur:5*60,cli:8*60,rec:15*60,doc2:12*60,esp:30*60,his:30*60};
function montaDia(chave,dow){
  const r=rng(hash("bz"+chave)), G=CAT.grade, eFds=fds(dow);
  const tab=eFds?G.fds:G.util, mad=G.madrugada[eFds?"fds":"util"], qh=G.quiz_horas[eFds?"fds":"util"];
  const pools={};
  CAT.videos.forEach(v=>{(pools[v.tipo]=pools[v.tipo]||[]).push(v);});
  Object.keys(pools).forEach(k=>pools[k]=embaralha(pools[k],r));
  let ultimoCanal="", usados={};
  function pega(tipo,rest){
    const p=pools[tipo];if(!p||!p.length)return null;
    const cap=CAP[tipo]||Infinity;
    const cabe=v=>Math.min(v.dur,cap)<=rest+20;
    let i=p.findIndex(v=>cabe(v)&&v.canal!==ultimoCanal&&!ruins.has(v.id)&&v.dur<=cap);
    if(i<0)i=p.findIndex(v=>cabe(v)&&!ruins.has(v.id)&&v.dur<=cap);
    let corta=0;
    if(i<0&&LONGOS.has(tipo)&&rest>=600){i=p.findIndex(v=>v.canal!==ultimoCanal&&!ruins.has(v.id));if(i<0)i=0;corta=rest;}
    if(i<0)return null;
    const v=p.splice(i,1)[0];p.push(v);ultimoCanal=v.canal;
    let dur=v.dur, fim=0;
    if(corta&&v.dur>corta){dur=corta;fim=corta;}
    return {v,dur,fim};
  }
  const segs=[];let t=0;
  for(let h=0;h<24;h++){
    const H=h*3600, rep=h<6, fonte=rep?String(mad[String(h)]):String(h), slots=tab[fonte]||[];
    const itens=[];let usado=0;
    const temQuiz=!rep&&qh.includes(h);
    const slots2=slots.slice();if(temQuiz&&!slots2.some(x=>x[0]==="quiz"))slots2.push(["quiz",3]);
    for(const [tipo0,min] of slots2){
      if(tipo0==="quiz"){if(temQuiz){itens.push({kind:"quiz",dur:180});usado+=180;}continue;}
      const tipo=tipo0==="fil"?"doc":tipo0; let rest=min*60;
      let guarda=0;
      while(rest>=40&&guarda++<40){
        let x=null,tp=tipo;
        for(const alt of (RESERVA[tipo]||[tipo,"cur"])){x=pega(alt,rest);if(x){tp=alt;break;}}
        if(!x)break;
        itens.push({kind:"video",tipo:tp,v:x.v,dur:x.dur,fim:x.fim,reprise:rep});rest-=x.dur;usado+=x.dur;
      }
    }
    let sobra=3600-180-usado,g=0;
    while(sobra>150&&g++<30){const x=pega("cur",sobra-60);if(!x)break;itens.push({kind:"video",tipo:"cur",v:x.v,dur:x.dur,fim:x.fim,reprise:rep});sobra-=x.dur;usado+=x.dur;}
    if(t<H)t=H; // nunca deixa buraco
    const marcos=[usado/3,usado*2/3];let acum=0,mi=0;
    for(const it of itens){
      segs.push(Object.assign({ini:t},it));t+=it.dur;acum+=it.dur;
      if(mi<2&&acum>=marcos[mi]){mi++;segs.push({kind:"intervalo",ini:t,dur:60});t+=60;}
    }
    const fimH=H+3600, rest=fimH-t;
    if(rest>=30){segs.push({kind:"intervalo",ini:t,dur:Math.min(rest,150)});t+=Math.min(rest,150);if(t<fimH){const ult=segs[segs.length-1];ult.dur+=fimH-t;t=fimH;}}
  }
  return segs;
}
function localiza(s){for(let i=0;i<SEGS.length;i++){const x=SEGS[i];if(s>=x.ini&&s<x.ini+x.dur)return i;}return SEGS.length-1;}
function garanteDia(){const n=agoraSP();if(!DIA||DIA.chave!==n.chave){DIA=n;SEGS=montaDia(n.chave,n.dow);}return n;}

/* ---------- textos ---------- */
const rot=s=>s.kind==="quiz"?"Quiz VivaBr":s.v.canal;
function tagDe(s){const base=CAT.tipos[s.tipo]||"";return s.reprise?base+" · Reprise":base;}
function proximos(i,n){const out=[];const vistos=new Set();for(let k=i+1;k<SEGS.length&&out.length<n;k++){const s=SEGS[k];if(s.kind==="intervalo")continue;if(s.kind==="video"&&ruins.has(s.v.id))continue;const nome=rot(s);if(out.length&&out[out.length-1].nome===nome)continue;if(vistos.has(nome+"|"+s.tipo))continue;vistos.add(nome+"|"+s.tipo);out.push({nome,seg:s,faixa:s.kind==="quiz"?"Responda nos comentários":tagDe(s)});}return out;}

function atualizaSeguirDepois(){const n=agoraSP();const k=SEGS.findIndex(x=>x.ini>=n.seg-5);const p=proximos(k-1,4);desenhaSeguir(p);}
function atualizaSeguir(){desenhaSeguir(proximos(IDX,4));}
function desenhaSeguir(p){
  if(!p.length){$("cardSeguir").hidden=true;$("pSeguir").hidden=true;return;}
  $("seguirQuando").textContent="Em seguida";$("seguirNome").textContent=p[0].nome;$("cardSeguir").hidden=false;
  $("lista").innerHTML=p.map((x,k)=>`<div><span>${k===0?"Já já":hm(x.seg.ini)}</span>${esc(x.nome)}</div>`).join("");$("pSeguir").hidden=false;
}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}

function mostraTarja(s){
  const t=$("tarjas");
  $("tarjaTag").textContent=tagDe(s);$("tarjaNome").textContent=s.v.canal;$("tarjaCredito").textContent=`Vídeo: ${s.v.canal} / YouTube`;
  t.hidden=false;t.classList.remove("entra");void t.offsetWidth;t.classList.add("entra");
}

/* ---------- tempo (Open-Meteo, sem chave) ---------- */
const CAPS=[["São Paulo",-23.55,-46.63],["Rio de Janeiro",-22.91,-43.17],["Brasília",-15.79,-47.88],["Salvador",-12.97,-38.50],["Recife",-8.05,-34.88],["Belo Horizonte",-19.92,-43.94],["Porto Alegre",-30.03,-51.23],["Manaus",-3.12,-60.02]];
let CLIMA=null;
function wmo(c){
  if(c===0)return["Céu limpo","sol","#FF9A1F"];if(c===1)return["Poucas nuvens","parcial","#19E3F0"];if(c===2)return["Parcialmente nublado","parcial","#19E3F0"];if(c===3)return["Nublado","nuvem","#A98BFF"];
  if(c===45||c===48)return["Neblina","nuvem","#B9A8E0"];if(c>=51&&c<=57)return["Chuvisco","chuvisco","#5B8CFF"];if(c>=61&&c<=67)return["Chuva","chuva","#3D7BFF"];
  if(c>=71&&c<=77||c===85||c===86)return["Neve","nuvem","#BFD3FF"];if(c>=80&&c<=82)return["Pancadas de chuva","chuva","#3D7BFF"];if(c>=95)return["Trovoadas","trovoada","#FFC21A"];return null;
}
const ICON={
 sol:`<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="13" fill="#FFE600" stroke="#1A0638" stroke-width="2.4"/><path d="M32 8v7M32 49v7M8 32h7M49 32h7M15 15l5 5M44 44l5 5M15 49l5-5M44 20l5-5" stroke="#FFB000" stroke-width="3" stroke-linecap="round"/></svg>`,
 parcial:`<svg viewBox="0 0 64 64"><circle cx="24" cy="24" r="11" fill="#FFE600" stroke="#1A0638" stroke-width="2.2"/><path d="M24 8v5M24 35v5M10 24h5M33 24h5M13.5 13.5l3.5 3.5M31 17l3.5-3.5" stroke="#FFB000" stroke-width="2.4" stroke-linecap="round"/><ellipse cx="36" cy="36" rx="15" ry="11" fill="#F7FBFF" stroke="#1A0638" stroke-width="2.4"/><ellipse cx="26" cy="38" rx="11" ry="8" fill="#E8EEF8" stroke="#1A0638" stroke-width="2"/></svg>`,
 nuvem:`<svg viewBox="0 0 64 64"><ellipse cx="26" cy="32" rx="15" ry="11" fill="#C5D6EE" stroke="#1A0638" stroke-width="2.4"/><ellipse cx="40" cy="34" rx="14" ry="11" fill="#F7FBFF" stroke="#1A0638" stroke-width="2.4"/></svg>`,
 chuvisco:`<svg viewBox="0 0 64 64"><ellipse cx="26" cy="28" rx="15" ry="11" fill="#D9E6F8" stroke="#1A0638" stroke-width="2.4"/><ellipse cx="40" cy="30" rx="13" ry="10" fill="#F7FBFF" stroke="#1A0638" stroke-width="2.4"/><path d="M22 44v7M30 46v7M38 44v7M46 46v6" stroke="#1E5BFF" stroke-width="3.2" stroke-linecap="round"/></svg>`,
 chuva:`<svg viewBox="0 0 64 64"><ellipse cx="24" cy="24" rx="15" ry="11" fill="#7FA3D6" stroke="#1A0638" stroke-width="2.4"/><ellipse cx="38" cy="26" rx="14" ry="11" fill="#C5D6EE" stroke="#1A0638" stroke-width="2.4"/><path d="M18 40v12M26 38v14M34 40v13M42 38v14M50 41v11" stroke="#1E5BFF" stroke-width="3.6" stroke-linecap="round"/></svg>`,
 trovoada:`<svg viewBox="0 0 64 64"><ellipse cx="24" cy="24" rx="15" ry="11" fill="#3A4A78" stroke="#1A0638" stroke-width="2.4"/><ellipse cx="39" cy="26" rx="14" ry="11" fill="#5A6A98" stroke="#1A0638" stroke-width="2.4"/><path d="M34 28l-8 14h8l-5 14 16-18h-9l8-10z" fill="#FFE600" stroke="#1A0638" stroke-width="2" stroke-linejoin="round"/></svg>`};
async function buscaClima(){
  try{
    const u="https://api.open-meteo.com/v1/forecast?latitude="+CAPS.map(c=>c[1]).join(",")+"&longitude="+CAPS.map(c=>c[2]).join(",")+"&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=America%2FSao_Paulo&forecast_days=1";
    const r=await fetch(u,{cache:"no-store"});if(!r.ok)throw 0;let j=await r.json();if(!Array.isArray(j))j=[j];
    const lista=[];
    j.forEach((x,k)=>{const d=x&&x.daily;if(!d||!CAPS[k])return;const mx=d.temperature_2m_max&&d.temperature_2m_max[0],mn=d.temperature_2m_min&&d.temperature_2m_min[0],c=d.weather_code&&d.weather_code[0];const w=wmo(c);
      if(typeof mx!=="number"||typeof mn!=="number"||!w)return;lista.push({cidade:CAPS[k][0],max:Math.round(mx),min:Math.round(mn),cond:w[0],icone:w[1],cor:w[2]});});
    CLIMA=lista.length?lista:null;
  }catch(e){/* sem dados: o bloco não aparece */}
  desenhaClima();montaLetreiro();
}
function desenhaClima(){
  if(!CLIMA){$("blocoClima").hidden=true;return;}
  $("capitais").innerHTML=CLIMA.map(c=>`<article class="capital" style="--cor:${c.cor}"><div class="teto"></div><div class="icone">${ICON[c.icone]}</div><div class="cidade">${esc(c.cidade)}</div><div class="condicao">${esc(c.cond)}</div><div class="temps"><div class="max">${c.max}°</div><div class="min">mín. ${c.min}°</div></div></article>`).join("");
  $("blocoClima").hidden=false;
}

/* ---------- letreiro ---------- */
let letreiroHora=-1;
function montaLetreiro(){
  if(!CAT)return;
  const L=CAT.letreiro||{},av=(L.avisos||[]).slice(),cu=(L.curiosidades||[]).slice();
  const r=rng(hash("let"+(DIA?DIA.chave:"")+letreiroHora));
  const cur=embaralha(cu,r).slice(0,4);
  const itens=[];let a=0;
  cur.forEach(c=>{itens.push(av[a++%av.length]);itens.push("Você sabia? "+c);});
  if(CLIMA){const s=CLIMA.slice(0,4).map(c=>`${c.cidade} ${c.max}°`).join(" · ");itens.push("Hoje: "+s);}
  const G=CAT.grade.quiz_horas[fds(agoraSP().dow)?"fds":"util"],h=Math.floor(agoraSP().seg/3600),pq=G.find(x=>x>h);
  if(pq!==undefined)itens.push(`Quiz VivaBr hoje às ${pq}h: responda nos comentários`);
  const cores=["c-navy","c-green","c-pink","c-blue"],seps=["","g","b","o"];
  const html=itens.map((t,k)=>`<span class="item ${cores[k%4]}">${esc(t)}</span><span class="sep ${seps[k%4]}"></span>`).join("");
  const f=$("faixa");f.style.animation="none";f.innerHTML=html+html;
  requestAnimationFrame(()=>{const w=f.scrollWidth/2;f.style.animation=`rolar ${Math.max(30,w/110)}s linear infinite`;});
}
const st=document.createElement("style");st.textContent="@keyframes rolar{from{transform:translateX(0)}to{transform:translateX(-50%)}}";document.head.appendChild(st);

/* ---------- telas ---------- */
function telaCheia(qual){
  ["intervalo","quiz"].forEach(k=>$(k).classList.toggle("ativa",k===qual));
  document.body.classList.toggle("cheia",!!qual);
  $("telaVideo").classList.toggle("oculto",!!qual);
}
function desenhaIntervalo(i){
  const n=agoraSP();
  $("dataHoje").textContent=new Intl.DateTimeFormat("pt-BR",{timeZone:TZ,weekday:"long",day:"numeric",month:"long"}).format(n.data).replace(/^./,c=>c.toUpperCase());
  desenhaClima();
  const p=proximos(i,3);
  if(p.length){$("chamadas").innerHTML=p.map((x,k)=>`<article class="chamada"><div class="quando">${k===0?"Em seguida":"Às "+hm(x.seg.ini)}</div><div class="prog">${esc(x.nome)}</div><div class="faixa-nome">${esc(x.faixa)}</div></article>`).join("");$("blocoChamadas").hidden=false;}
  else $("blocoChamadas").hidden=true;
}
function perguntaDo(seg){const qs=CAT.quiz||[];if(!qs.length)return null;const r=rng(hash("quiz"+DIA.chave+seg.ini));return qs[Math.floor(r()*qs.length)];}
let quizTimer=null;
function desenhaQuiz(seg,off){
  const q=perguntaDo(seg);if(!q)return false;
  const box=$("quiz");box.classList.remove("revelado");
  $("quizPergunta").textContent=q.pergunta;
  $("quizAlts").innerHTML=q.alternativas.map((a,k)=>`<div class="alt${k===q.resposta_indice?" certa":""}"><b>${"ABCD"[k]}</b>${esc(a)}</div>`).join("");
  $("quizCurio").textContent=`Resposta: ${q.alternativas[q.resposta_indice]}. ${q.curiosidade||""}`;
  $("quizFonte").textContent=q.fonte_nome?`Fonte: ${q.fonte_nome}`:"";
  const tPerg=Math.round(seg.dur*0.72),falta=Math.max(0,tPerg-off);
  const b=$("quizBarra");b.style.transition="none";b.style.transform=`scaleX(${falta/tPerg})`;requestAnimationFrame(()=>requestAnimationFrame(()=>{b.style.transition=`transform ${falta}s linear`;b.style.transform="scaleX(0)";}));
  clearTimeout(quizTimer);quizTimer=setTimeout(()=>box.classList.add("revelado"),falta*1000);
  return true;
}

/* ---------- reprodução ---------- */
function toca(i,off){
  clearTimeout(timer);IDX=i;const s=SEGS[i];if(!s){reSync();return;}
  atualizaSeguir();
  const h=Math.floor(s.ini/3600);if(h!==letreiroHora){letreiroHora=h;montaLetreiro();}
  if(s.kind==="video"){
    if(ruins.has(s.v.id)){proximo();return;}
    telaCheia(null);mostraTarja(s);
    if(player&&pronto){
      const o={videoId:s.v.id,startSeconds:Math.max(0,Math.floor(off))};if(s.fim)o.endSeconds=s.fim;
      carregouEm=Date.now();ultimoEstado=-1;player.loadVideoById(o);
    }
    return;
  }
  if(player&&pronto){try{player.stopVideo();}catch(e){}}
  $("tarjas").hidden=true;
  if(s.kind==="quiz"){if(!desenhaQuiz(s,off)){proximo();return;}telaCheia("quiz");}
  else{desenhaIntervalo(i);telaCheia("intervalo");}
  timer=setTimeout(proximo,Math.max(1,s.dur-off)*1000);
}
function reSync(){const n=garanteDia();const i=localiza(n.seg);toca(i,n.seg-SEGS[i].ini);}
function proximo(){
  const n=agoraSP();
  if(!DIA||DIA.chave!==n.chave){reSync();return;}
  if(REMONTADO){REMONTADO=false;const k=SEGS.findIndex(x=>x.ini>=n.seg-5);if(k<0){reSync();return;}toca(k,0);return;}
  const i=IDX+1,s=SEGS[i];if(!s){reSync();return;}
  if(n.seg-s.ini>120){reSync();return;}  // atrasado: volta pro relógio
  toca(i,0);
}
function marcaRuim(id){ruins.add(id);try{sessionStorage.setItem("bz_ruins",JSON.stringify([...ruins]));}catch(e){}}

window.onYouTubeIframeAPIReady=function(){
  player=new YT.Player("player",{width:"100%",height:"100%",host:"https://www.youtube.com",
    playerVars:{autoplay:0,controls:0,disablekb:1,fs:0,iv_load_policy:3,modestbranding:1,playsinline:1,rel:0,cc_load_policy:0,hl:"pt",cc_lang_pref:"pt",origin:location.origin},
    events:{
      onReady:()=>{pronto=true;if(ligado&&!SIM)reSync();},
      onStateChange:e=>{ultimoEstado=e.data;if(e.data===1){try{player.unloadModule("captions");player.unloadModule("cc");}catch(x){}}if(e.data===0)proximo();},
      onError:()=>{const s=SEGS[IDX];if(s&&s.kind==="video")marcaRuim(s.v.id);proximo();}
    }});
};
setInterval(()=>{ // vigia: vídeo travado não deixa a tela parada
  const s=SEGS[IDX];if(!ligado||!pronto||!s||s.kind!=="video")return;
  const st=player.getPlayerState?player.getPlayerState():-1;
  if((st===-1||st===5||st===3)&&Date.now()-carregouEm>15000){if(st!==3)marcaRuim(s.v.id);carregouEm=Date.now();proximo();}
},2000);

/* ---------- relógio na tela ---------- */
function relogio(){const n=agoraSP();const h=Math.floor(n.seg/3600),m=Math.floor(n.seg%3600/60);
  const dia=new Intl.DateTimeFormat("pt-BR",{timeZone:TZ,weekday:"short",day:"2-digit",month:"2-digit"}).format(n.data).replace(".","");
  $("relogio").innerHTML=`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}<small>${esc(dia)}</small>`;}
setInterval(relogio,5000);

/* ---------- escala (TV deitada / celular em pé) ---------- */
function encaixa(){
  const vp=$("vp"),W=vp.clientWidth||innerWidth,H=vp.clientHeight||innerHeight,ret=H>W*1.15;document.body.classList.toggle("retrato",ret);
  const sw=ret?1080:1920,sh=ret?Math.max(1920,Math.round(1080*H/W)):1080,k=Math.min(W/sw,H/sh);
  $("stage").style.height=sh+"px";
  $("stage").style.transform=`translate(${(W-sw*k)/2}px,${(H-sh*k)/2}px) scale(${k})`;
}
addEventListener("resize",encaixa);window.bzEncaixa=encaixa;addEventListener("orientationchange",()=>setTimeout(encaixa,300));

function confetes(){const cores=["#19E3F0","#FF2D6F","#B026FF","#E01CD8","#FF8A00"],c=$("confetes"),r=rng(7);let h="";
  for(let i=0;i<26;i++){const x=Math.round(r()*1900),y=Math.round(r()*1000),s=6+Math.round(r()*10),k=["dot","losango","barra-conf"][i%3];
    h+=`<span class="${k}" style="left:${x}px;top:${y}px;width:${k==="barra-conf"?s*2:s}px;height:${s}px;background:${cores[i%5]}"></span>`;}
  c.innerHTML=h;}

/* ---------- ligar ---------- */
function liga(){
  if(ligado)return;ligado=true;$("inicio").classList.add("some");
  if(player&&pronto){try{player.unMute();player.setVolume(100);}catch(e){}reSync();}
  else{reSync();}
  try{if(document.documentElement.requestFullscreen&&matchMedia("(pointer:coarse)").matches)document.documentElement.requestFullscreen().catch(()=>{});}catch(e){}
}
$("inicio").addEventListener("click",liga);
$("inicio").addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" ")liga();});

/* ---------- relógio simulado (só painel / ?admin=1) ---------- */
const Relogio={
  desl:()=>deslocamento,
  simulado:()=>deslocamento!==0,
  grava(){try{if(deslocamento)localStorage.setItem(LS_REL,JSON.stringify({desl:deslocamento,gravado:new Date().toISOString()}));else localStorage.removeItem(LS_REL);}catch(e){}},
  aplica(d){deslocamento=Math.round(d);this.grava();DIA=null;REMONTADO=false;
    if(!ligado){ligado=true;$("inicio").classList.add("some");if(player&&pronto){try{player.unMute();player.setVolume(100);}catch(e){}}}
    reSync();relogio();letreiroHora=-1;montaLetreiro();},
  soma(seg){this.aplica(deslocamento+seg);},
  paraHora(h,m){const n=agoraSP();this.soma(h*3600+m*60-n.seg);},
  // dia útil / fim de semana: avança até o próximo dia desse tipo (mesma hora); se hoje já é desse tipo, fica
  paraDia(tipo){let k=0;for(;k<7;k++){const n=agoraSP(deslocamento+k*86400);if(fds(n.dow)===(tipo==="fds"))break;}if(k)this.soma(k*86400);else this.aplica(deslocamento);},
  pular(){const n=garanteDia();const i=localiza(n.seg),prox=SEGS[i+1];
    if(prox)this.soma(prox.ini-n.seg+1);else this.soma(86400-n.seg+1);},
  aoVivo(){this.aplica(0);}
};

async function inicia(){
  encaixa();confetes();relogio();
  try{const r=await fetch("catalogo.json",{cache:"no-store"});BASE=await r.json();}catch(e){return;}
  CAT=Edicao.mescla(BASE);
  garanteDia();const n=agoraSP();IDX=localiza(n.seg);atualizaSeguir();
  const s=SEGS[IDX];if(s&&s.kind==="video")mostraTarja(s);
  montaLetreiro();buscaClima();setInterval(buscaClima,30*60*1000);
  const tag=document.createElement("script");tag.src="https://www.youtube.com/iframe_api";document.head.appendChild(tag);
  const sim=Q.get("ver"); // só para conferência visual: ?ver=intervalo | ?ver=quiz
  if(sim==="intervalo"||sim==="quiz"){SIM=true;ligado=true;$("inicio").classList.add("some");const k=SEGS.findIndex(x=>x.kind===sim&&x.ini>=n.seg);const j=k>=0?k:SEGS.findIndex(x=>x.kind===sim);if(j>=0){IDX=j;const sg=SEGS[j];atualizaSeguir();if(sim==="quiz")desenhaQuiz(sg,Q.has("revela")?sg.dur:0);else desenhaIntervalo(j);telaCheia(sim);$("tarjas").hidden=true;}}
  window.__bz={segs:()=>SEGS,idx:()=>IDX};
  window.BZ={base:()=>BASE,cat:()=>CAT,segs:()=>SEGS,idx:()=>IDX,agora:agoraSP,hm,Edicao,
    remonta(){CAT=Edicao.mescla(BASE);const atual=SEGS[IDX];DIA=null;garanteDia();REMONTADO=true;
      if(!ligado){const n=agoraSP();IDX=localiza(n.seg);REMONTADO=false;}
      else if(atual&&atual.kind!=="video"){clearTimeout(timer);REMONTADO=false;reSync();return;}
      atualizaSeguirDepois();letreiroHora=-1;montaLetreiro();},
    relogio:ADMIN?Relogio:null};
  if(Q.get("admin")==="1"){const sc=document.createElement("script");sc.src="painel.js";document.body.appendChild(sc);const ln=document.createElement("link");ln.rel="stylesheet";ln.href="painel.css";document.head.appendChild(ln);}
}
inicia();
})();
