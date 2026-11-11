/* Sala de controle do Canal VivaBr — só carrega com ?admin=1.
   Toda mudança passa por Painel.aplicar(acao) -> grava no localStorage deste navegador -> BZ.remonta().
   A cena no ar não é cortada: a grade nova entra no próximo item. */
(function(){
"use strict";
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const pad=n=>String(n).padStart(2,"0");
const mmss=s=>{s=Math.round(s);return s>=3600?Math.floor(s/3600)+"h"+pad(Math.floor(s%3600/60)):Math.floor(s/60)+":"+pad(s%60);};
const B=window.BZ;

document.body.insertAdjacentHTML("beforeend",`<div class="adm fechado" id="adm">
 <button class="alca" id="admAlca">⚙ Sala de controle <small id="admSim" class="sim" hidden></small><small id="admResumo">toque para abrir</small><span id="admSeta">▲</span></button>
 <div class="admCorpo">
  <div class="tabs"><button data-tab="grade" class="on">Grade</button><button data-tab="videos">Vídeos</button><button data-tab="canais">Canais</button><button data-tab="relogio">Relógio</button><button data-tab="fila">Fila</button><button data-tab="status">Status</button></div>
  <div class="aviso" id="admAviso"></div>
  <div class="tab" id="tab-grade"></div><div class="tab" id="tab-videos" hidden></div><div class="tab" id="tab-canais" hidden></div><div class="tab" id="tab-relogio" hidden></div><div class="tab" id="tab-fila" hidden></div><div class="tab" id="tab-status" hidden></div>
 </div></div><div id="admTeste"><div id="admTesteP"></div></div>`);

const TIPOS_EDITAVEIS=()=>Object.keys(B.cat().tipos).filter(t=>t!=="quiz");
const nomeTipo=t=>t==="fil"?"Filme das 20h (vira Documentário)":t==="quiz"?"Quiz VivaBr":(B.cat().tipos[t]||t);

const Painel={
  aba:"grade", aberto:false, dia:"util", hora:null, filtroTipo:"", busca:"",
  ed(){return B.Edicao.ler();},
  gradeAtual(){const g=B.cat().grade;return {util:g.util,fds:g.fds,madrugada:g.madrugada,quiz_horas:g.quiz_horas};},
  aviso(t,ok){const a=$("admAviso");a.textContent=t||"";a.classList.toggle("on",!!t);a.classList.toggle("ok",!!ok);},
  aplicar(acao){
    const c=this.ed();
    const G=c.grade?JSON.parse(JSON.stringify(c.grade)):JSON.parse(JSON.stringify(this.gradeAtual()));
    const slots=()=>{const t=G[this.dia];return (t[String(acao.h)]=t[String(acao.h)]||[]);};
    let ok=true,mexeuGrade=false;
    switch(acao.tipo){
      case "slotTipo": slots()[acao.i][0]=acao.valor; mexeuGrade=true; break;
      case "slotMin": { const v=Math.max(1,Math.min(60,parseInt(acao.valor,10)||0)); slots()[acao.i][1]=v; mexeuGrade=true; break; }
      case "slotMover": { const s=slots(),j=acao.i+acao.dir; if(j<0||j>=s.length){ok=false;break;} [s[acao.i],s[j]]=[s[j],s[acao.i]]; mexeuGrade=true; break; }
      case "slotRemover": { const s=slots(); if(s.length<=1){ok=false;this.aviso("A hora precisa de pelo menos 1 faixa.");break;} s.splice(acao.i,1); mexeuGrade=true; break; }
      case "slotAdicionar": slots().push([acao.valor,10]); mexeuGrade=true; break;
      case "copiarHora": { const de=G[this.dia][String(acao.de)]; if(!de){ok=false;break;} G[this.dia][String(acao.h)]=JSON.parse(JSON.stringify(de)); mexeuGrade=true; break; }
      case "madrugada": G.madrugada[this.dia][String(acao.h)]=parseInt(acao.valor,10); mexeuGrade=true; break;
      case "quizHora": { const q=G.quiz_horas[this.dia]; const i=q.indexOf(acao.h); if(i>=0)q.splice(i,1); else q.push(acao.h); q.sort((a,b)=>a-b); mexeuGrade=true; break; }
      case "restaurarGrade": c.grade=null; break;
      case "videoToggle": { const i=c.videosOff.indexOf(acao.id); if(i>=0)c.videosOff.splice(i,1); else c.videosOff.push(acao.id); break; }
      case "videoRemoverAdd": c.videosAdd=c.videosAdd.filter(v=>v.id!==acao.id); break;
      case "videoAdicionar": c.videosAdd.push(acao.video); c.videosOff=c.videosOff.filter(x=>x!==acao.video.id); break;
      case "canalToggle": { const i=c.canaisOff.indexOf(acao.canal); if(i>=0)c.canaisOff.splice(i,1); else c.canaisOff.push(acao.canal); break; }
      case "importar": { let j; try{ j=JSON.parse(acao.json); }catch(e){ this.aviso("JSON inválido: "+e.message); return false; } if(!j||j.versao!==1){ this.aviso("Arquivo de ajustes inválido (versão)."); return false; } B.Edicao.gravar(j); B.remonta(); this.aviso("✔ Ajustes importados e salvos neste navegador.",true); this.render(); return true; }
      case "restaurar": B.Edicao.limpar(); B.remonta(); this.aviso("✔ Padrão restaurado. Os ajustes deste navegador foram apagados.",true); this.render(); return true;
      default: ok=false;
    }
    if(!ok){this.render();return false;}
    if(mexeuGrade)c.grade=G;
    if(!B.Edicao.gravar(c)){this.aviso("O navegador bloqueou o salvamento (localStorage). A mudança vale só nesta sessão.");}
    else this.aviso("✔ Salvo neste navegador. Entra no próximo item da programação — o que está no ar não é cortado.",true);
    B.remonta(); this.render(); return true;
  },
  abrir(v){this.aberto=v;$("adm").classList.toggle("fechado",!v);$("admSeta").textContent=v?"▼":"▲";this.ajustaTela();if(v)this.render();},
  ajustaTela(){const h=$("adm").getBoundingClientRect().height;$("vp").style.bottom=Math.round(h)+"px";window.bzEncaixa&&window.bzEncaixa();},
  resumo(){const s=B.segs()[B.idx()];const n=s?(s.kind==="video"?s.v.canal:s.kind==="quiz"?"Quiz VivaBr":"Intervalo"):"—";const c=this.ed();const mud=(c.grade?1:0)+c.videosOff.length+c.canaisOff.length+c.videosAdd.length;
    const R=B.relogio;$("admSim").hidden=!(R&&R.simulado());if(R&&R.simulado())$("admSim").textContent="⏱ horário simulado "+this.horaTxt(B.agora());
    $("admResumo").textContent=`no ar: ${n}`+(mud?` · ${mud} ajuste(s) salvos neste navegador`:" · programação padrão");},
  render(){
    this.resumo(); if(!this.aberto) return;
    document.querySelectorAll(".adm .tabs button").forEach(b=>b.classList.toggle("on",b.dataset.tab===this.aba));
    ["grade","videos","canais","relogio","fila","status"].forEach(t=>$("tab-"+t).hidden=t!==this.aba);
    this["r_"+this.aba](); this.ajustaTela();
  },
  r_grade(){
    const G=this.gradeAtual(),T=G[this.dia],agoraH=Math.floor(B.agora().seg/3600);
    if(this.hora===null)this.hora=Math.max(6,agoraH);
    let h=`<div class="bts"><select id="selDia" class="mini"><option value="util"${this.dia==="util"?" selected":""}>Dia útil</option><option value="fds"${this.dia==="fds"?" selected":""}>Fim de semana</option></select><span class="sec" style="margin:0">Grade 6h–23h · toque numa hora para editar as faixas</span></div>`;
    for(let x=6;x<24;x++){const sl=T[String(x)]||[];const tot=sl.reduce((a,b)=>a+b[1],0);const q=G.quiz_horas[this.dia].includes(x);
      h+=`<div class="row${x===agoraH?" ar":""}" data-a="hora" data-h="${x}" style="cursor:pointer"><span class="h">${pad(x)}h${x===agoraH?"<br><b style='color:#19E3F0'>NO AR</b>":""}</span><span class="n">${sl.map(s=>esc(nomeTipo(s[0]))+" "+s[1]+"′").join(" · ")}${q?" · <b style='color:#FF6A9A'>Quiz</b>":""}<small>${tot} min de conteúdo</small></span><span class="ib tog">${x===this.hora?"editando":"editar"}</span></div>`;
      if(x===this.hora) h+=this.editorHora(x,sl);
    }
    h+=`<div class="sec">Madrugada (reprises) — cada hora repete as faixas de uma hora da noite</div>`;
    for(let x=0;x<6;x++){const v=G.madrugada[this.dia][String(x)];h+=`<div class="row"><span class="h">${pad(x)}h</span><span class="n">repete a grade das</span><select class="mini" data-mad="${x}">${Array.from({length:18},(_,k)=>k+6).map(k=>`<option value="${k}"${k===v?" selected":""}>${pad(k)}h</option>`).join("")}</select></div>`;}
    h+=`<div class="sec">Horários do quiz (${this.dia==="util"?"dia útil":"fim de semana"}) — pergunta na tela, respostas nos comentários</div><div class="horas">`+
      Array.from({length:18},(_,k)=>k+6).map(k=>{const on=G.quiz_horas[this.dia].includes(k);return `<label class="${on?"on":""}"><input type="checkbox" data-quiz="${k}"${on?" checked":""}>${pad(k)}h</label>`;}).join("")+`</div>`;
    h+=`<div class="bts"><button class="bt dang" data-a="restaurarGrade">↺ Grade padrão</button></div>`;
    $("tab-grade").innerHTML=h;
  },
  editorHora(x,sl){
    const ops=v=>TIPOS_EDITAVEIS().map(t=>`<option value="${t}"${t===v?" selected":""}>${esc(nomeTipo(t))}</option>`).join("")+(v==="fil"?`<option value="fil" selected>${esc(nomeTipo("fil"))}</option>`:"")+(v==="quiz"?`<option value="quiz" selected>Quiz VivaBr</option>`:"");
    const tot=sl.reduce((a,b)=>a+b[1],0);
    let h=`<div class="frm"><b>Faixas das ${pad(x)}h (${this.dia==="util"?"dia útil":"fim de semana"})</b>`;
    h+=sl.map((s,i)=>`<div class="bts"><select class="mini" data-slot="${i}" data-campo="tipo" style="flex:1;max-width:none">${ops(s[0])}</select><input class="mini" type="number" min="1" max="60" value="${s[1]}" data-slot="${i}" data-campo="min" style="max-width:90px" aria-label="minutos"><span class="total">min</span><button class="ib" data-a="slotMover" data-i="${i}" data-dir="-1">↑</button><button class="ib" data-a="slotMover" data-i="${i}" data-dir="1">↓</button><button class="ib dang" data-a="slotRemover" data-i="${i}">✕</button></div>`).join("");
    h+=`<div class="total${tot>56?" mais":""}">Total: ${tot} min ${tot>56?"(passa de 56 min: a hora seguinte começa um pouco depois)":"(até 56 min cabe com os 3 intervalos)"}</div>`;
    h+=`<div class="bts"><select id="novoSlot" class="mini" style="flex:1;max-width:none">${ops("")}</select><button class="bt" data-a="slotAdicionar">+ adicionar faixa</button></div>`;
    h+=`<div class="bts"><span class="sec" style="margin:0">Copiar de</span><select id="copiaDe" class="mini">${Array.from({length:18},(_,k)=>k+6).filter(k=>k!==x).map(k=>`<option value="${k}">${pad(k)}h</option>`).join("")}</select><button class="bt" data-a="copiarHora">Copiar faixas</button></div></div>`;
    return h;
  },
  r_videos(){
    const base=B.base(),c=this.ed(),off=new Set(c.videosOff),coff=new Set(c.canaisOff),addIds=new Set(c.videosAdd.map(v=>v.id));
    const todos=base.videos.concat(c.videosAdd.filter(v=>!base.videos.some(b=>b.id===v.id)));
    const tipos=Object.keys(base.tipos).filter(t=>t!=="quiz");
    let h=`<div class="frm"><b>Adicionar ou trocar vídeo (ID ou link do YouTube)</b>
      <label>ID ou link<input id="fId" placeholder="ex.: https://www.youtube.com/watch?v=..." autocomplete="off"></label>
      <label>Faixa<select id="fTipo">${tipos.map(t=>`<option value="${t}">${esc(nomeTipo(t))}</option>`).join("")}</select></label>
      <label>Desligar este vídeo ao adicionar (troca) — opcional<select id="fTroca"><option value="">— nenhum —</option></select></label>
      <div class="bts"><button class="bt pri" data-a="conferir">Conferir e adicionar</button><span id="fMsg" class="sec" style="margin:0;text-transform:none;letter-spacing:0"></span></div>
      <small style="color:#9aa6c8">O vídeo só entra se o YouTube confirmar (oEmbed) e se tocar de verdade no player incorporado. A duração vem do próprio player.</small></div>`;
    h+=`<div class="bts"><select id="fFiltro" class="mini"><option value="">Todas as faixas</option>${tipos.map(t=>`<option value="${t}"${t===this.filtroTipo?" selected":""}>${esc(nomeTipo(t))}</option>`).join("")}</select><input type="search" id="fBusca" class="mini" placeholder="buscar título ou canal" value="${esc(this.busca)}" style="flex:1;max-width:none"></div>`;
    const b=this.busca.toLowerCase();
    const lista=todos.filter(v=>(!this.filtroTipo||v.tipo===this.filtroTipo)&&(!b||(v.titulo+" "+v.canal).toLowerCase().includes(b)));
    h+=`<div class="sec">${lista.length} vídeo(s) · ligados: ${todos.filter(v=>!off.has(v.id)&&!coff.has(v.canal)).length} de ${todos.length}</div>`;
    h+=lista.map(v=>{const ligado=!off.has(v.id)&&!coff.has(v.canal);return `<div class="row${ligado?"":" off"}"><span class="n">${addIds.has(v.id)?"✚ ":""}${esc(v.titulo)}<small>${esc(v.canal)} · ${esc(nomeTipo(v.tipo))} · ${mmss(v.dur)} · ${esc(v.id)}${coff.has(v.canal)?" · canal desligado":""}</small></span><button class="ib tog${ligado?" on":""}" data-a="videoToggle" data-id="${esc(v.id)}">${off.has(v.id)?"desligado":"ligado"}</button>${addIds.has(v.id)?`<button class="ib dang" data-a="videoRemoverAdd" data-id="${esc(v.id)}">✕</button>`:""}</div>`;}).join("");
    $("tab-videos").innerHTML=h;
    const sel=$("fTroca");todos.filter(v=>!off.has(v.id)).slice(0,400).forEach(v=>{const o=document.createElement("option");o.value=v.id;o.textContent=v.canal+" — "+v.titulo.slice(0,60);sel.appendChild(o);});
  },
  r_canais(){
    const base=B.base(),c=this.ed(),coff=new Set(c.canaisOff),cont={};
    base.videos.concat(c.videosAdd).forEach(v=>cont[v.canal]=(cont[v.canal]||0)+1);
    let h=`<div class="sec">Canais — desligar tira todos os vídeos do canal da programação</div>`;
    h+=Object.keys(cont).sort((a,b)=>a.localeCompare(b,"pt")).map(k=>`<div class="row${coff.has(k)?" off":""}"><span class="n">${esc(k)}<small>${cont[k]} vídeo(s)</small></span><button class="ib tog${coff.has(k)?"":" on"}" data-a="canalToggle" data-canal="${esc(k)}">${coff.has(k)?"desligado":"ligado"}</button></div>`).join("");
    $("tab-canais").innerHTML=h;
  },
  horaTxt(n){const h=Math.floor(n.seg/3600),m=Math.floor(n.seg%3600/60);return pad(h)+":"+pad(m)+" · "+new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",weekday:"short",day:"2-digit",month:"2-digit"}).format(n.data).replace(".","");},
  r_relogio(){
    const R=B.relogio,n=B.agora(),real=B.agora(0),S=B.segs(),s=S[B.idx()],sim=R.simulado();
    const nome=x=>!x?"—":x.kind==="video"?esc(x.v.canal)+" <small>"+esc(nomeTipo(x.tipo))+(x.reprise?" · Reprise":"")+"</small>":x.kind==="quiz"?"Quiz VivaBr":"Intervalo <small>tempo + chamadas</small>";
    const prox=S.slice(B.idx()+1).find(x=>x.kind!=="intervalo");
    let h=`<div class="relHora${sim?" sim":""}"><b>${this.horaTxt(n)}</b><span>${sim?"horário simulado · hora real "+this.horaTxt(real):"ao vivo (hora real de Brasília)"}</span></div>`;
    h+=`<div class="kv"><b>No ar</b><span>${nome(s)}${s?" <small>desde "+B.hm(s.ini)+"</small>":""}</span><b>A seguir</b><span>${nome(prox)}${prox?" <small>às "+B.hm(prox.ini)+"</small>":""}</span></div>`;
    h+=`<div class="sec">Adiantar a programação</div><div class="bts">
      <button class="bt pri" data-a="relPular">⏭ Pular para o próximo</button><button class="bt" data-a="relSoma" data-s="900">+15 min</button><button class="bt" data-a="relSoma" data-s="3600">+1 h</button></div>
      <div class="bts"><span class="sec" style="margin:0">Ir para</span><input id="relHM" class="mini" type="time" step="60" value="${pad(Math.floor(n.seg/3600))}:${pad(Math.floor(n.seg%3600/60))}"><button class="bt" data-a="relIr">Ir</button>
      <button class="bt" data-a="relDia" data-d="util">Dia útil</button><button class="bt" data-a="relDia" data-d="fds">Fim de semana</button></div>
      <div class="bts"><button class="bt${sim?" pri":""}" data-a="relVivo"${sim?"":" disabled"}>⟲ Voltar ao vivo</button></div>
      <small style="color:#9aa6c8">Só para conferir como a grade fica no ar. Vale só neste navegador e só com ?admin=1 — quem abre o endereço normal sempre vê a hora real. “Pular” e “+15 min/+1 h” cortam o item atual na hora. “Dia útil”/“Fim de semana” vão para o próximo dia desse tipo, mesma hora.</small>`;
    $("tab-relogio").innerHTML=h;
  },
  rel(fn,msg){fn();this.aviso(msg,true);setTimeout(()=>this.render(),400);this.render();},
  r_fila(){
    const S=B.segs(),i0=Math.max(0,B.idx());
    let h=`<div class="sec">Fila de hoje (horário de Brasília) — próximos itens</div>`;
    h+=S.slice(i0,i0+25).map((s,k)=>`<div class="row${k===0?" ar":""}"><span class="h">${B.hm(s.ini)}${k===0?"<br><b style='color:#19E3F0'>NO AR</b>":""}</span><span class="n">${s.kind==="video"?esc(s.v.canal):s.kind==="quiz"?"Quiz VivaBr":"Intervalo (tempo + chamadas)"}<small>${s.kind==="video"?esc(nomeTipo(s.tipo))+(s.reprise?" · Reprise":"")+" · "+esc(s.v.titulo):""} · ${mmss(s.dur)}</small></span></div>`).join("");
    $("tab-fila").innerHTML=h;
  },
  r_status(){
    const c=this.ed(),base=B.base(),cat=B.cat();let tam="—";try{tam=((localStorage.getItem("bz.unificado.edicao.v1")||"").length/1024).toFixed(1)+" KB";}catch(e){}
    const kv=[["Onde salva","localStorage deste navegador (não vai para outros aparelhos)"],["Última gravação",c.atualizado?new Date(c.atualizado).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"})+" (Brasília)":"— (padrão)"],["Tamanho dos ajustes",tam],
      ["Grade",c.grade?"editada":"padrão (grade-v3-proposta)"],["Vídeos no catálogo",base.videos.length+" + "+c.videosAdd.length+" adicionados"],["Vídeos desligados",c.videosOff.length],["Canais desligados",c.canaisOff.length],["Vídeos na programação agora",cat.videos.length],["Itens hoje",B.segs().length]];
    $("tab-status").innerHTML=`<div class="kv">${kv.map(([a,b])=>`<b>${esc(a)}</b><span>${esc(b)}</span>`).join("")}</div>
     <div class="sec">Arquivos</div><div class="bts"><button class="bt pri" data-a="exportarCatalogo">⬇ Exportar catalogo.json</button><button class="bt" data-a="exportarAjustes">⬇ Exportar ajustes</button><button class="bt" data-a="importar">⬆ Importar ajustes</button><button class="bt dang" data-a="restaurar">↺ Restaurar padrão</button></div>
     <small style="color:#9aa6c8">“Exportar catalogo.json” gera o catálogo já com as mudanças (para subir no site e valer para todo mundo). “Exportar ajustes” gera só as mudanças deste navegador.</small>
     <textarea id="cfgTxt" rows="5" style="width:100%;background:#070b16;border:1px solid #26314f;border-radius:8px;padding:10px" placeholder="Cole aqui um arquivo de ajustes para importar"></textarea>`;
  },
  baixar(nome,obj){const j=JSON.stringify(obj,null,1);const url=URL.createObjectURL(new Blob([j],{type:"application/json"}));const l=document.createElement("a");l.href=url;l.download=nome;document.body.appendChild(l);l.click();l.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);return j;},
  /* conferência de vídeo novo: oEmbed + tocar de verdade num player incorporado escondido */
  testePlayer:null,
  conferePlayer(id){
    return new Promise(res=>{
      let fim=false;const acaba=r=>{if(fim)return;fim=true;clearTimeout(t);try{this.testePlayer.stopVideo();}catch(e){}res(r);};
      const t=setTimeout(()=>acaba({ok:false,erro:"o vídeo não começou a tocar em 15 s"}),15000);
      const cria=()=>{this.testePlayer=new YT.Player("admTesteP",{width:320,height:180,videoId:id,playerVars:{autoplay:1,mute:1,playsinline:1,controls:0,origin:location.origin},
        events:{onReady:e=>{e.target.mute();e.target.playVideo();},onStateChange:e=>{if(e.data===1){const d=Math.round(e.target.getDuration()||0);acaba(d>0?{ok:true,dur:d}:{ok:false,erro:"sem duração"});}},onError:e=>acaba({ok:false,erro:"o dono não permite tocar fora do YouTube (erro "+e.data+")"})}});};
      if(!window.YT||!YT.Player){acaba({ok:false,erro:"player do YouTube ainda não carregou"});return;}
      if(this.testePlayer){this.testePlayer.__h=null;try{this.testePlayer.destroy();}catch(e){}this.testePlayer=null;$("admTeste").innerHTML='<div id="admTesteP"></div>';}
      cria();
    });
  },
  async conferir(){
    const msg=t=>{const m=$("fMsg");if(m)m.textContent=t;};
    const raw=$("fId").value.trim(),m=raw.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([A-Za-z0-9_-]{11})/)||raw.match(/^([A-Za-z0-9_-]{11})$/);
    if(!m)return msg("ID inválido: 11 caracteres ou um link do YouTube.");
    const id=m[1],tipo=$("fTipo").value,troca=$("fTroca").value;
    if(B.cat().videos.some(v=>v.id===id))return msg("Esse vídeo já está na programação.");
    msg("Conferindo no YouTube…");
    let o;try{const r=await fetch("https://www.youtube.com/oembed?url="+encodeURIComponent("https://www.youtube.com/watch?v="+id)+"&format=json");if(!r.ok)throw new Error("HTTP "+r.status);o=await r.json();}catch(e){return msg("Não entrou: o YouTube não confirmou o vídeo ("+e.message+").");}
    msg("Testando no player…");
    const t=await this.conferePlayer(id);
    if(!t.ok)return msg("Não entrou: "+t.erro+".");
    const video={id,tipo,titulo:o.title,canal:o.author_name,canal_url:o.author_url||"",dur:t.dur,formato:"video",adicionado:new Date().toISOString(),verificado:"oEmbed 200 + tocou no player incorporado"};
    this.aplicar({tipo:"videoAdicionar",video});
    if(troca)this.aplicar({tipo:"videoToggle",id:troca});
    this.aviso(`✔ “${o.title}” (${o.author_name}, ${mmss(t.dur)}) entrou na faixa ${nomeTipo(tipo)}${troca?" e o vídeo trocado foi desligado":""}. Salvo neste navegador.`,true);
  },
  ligar(){
    $("admAlca").onclick=()=>this.abrir(!this.aberto);
    document.querySelector(".adm .tabs").onclick=e=>{const b=e.target.closest("button");if(!b)return;this.aba=b.dataset.tab;this.aviso("");this.render();};
    const corpo=document.querySelector(".admCorpo");
    corpo.addEventListener("click",e=>{const b=e.target.closest("[data-a]");if(!b)return;const a=b.dataset.a,i=+b.dataset.i,dir=+b.dataset.dir;
      if(a==="hora"){const h=+b.dataset.h;this.hora=this.hora===h?-1:h;this.render();}
      else if(a==="slotMover")this.aplicar({tipo:a,h:this.hora,i,dir});
      else if(a==="slotRemover")this.aplicar({tipo:a,h:this.hora,i});
      else if(a==="slotAdicionar")this.aplicar({tipo:a,h:this.hora,valor:$("novoSlot").value});
      else if(a==="copiarHora")this.aplicar({tipo:a,h:this.hora,de:+$("copiaDe").value});
      else if(a==="restaurarGrade"){if(confirm("Voltar a grade (faixas, madrugada e quiz) para o padrão?"))this.aplicar({tipo:a});}
      else if(a==="videoToggle")this.aplicar({tipo:a,id:b.dataset.id});
      else if(a==="videoRemoverAdd")this.aplicar({tipo:a,id:b.dataset.id});
      else if(a==="canalToggle")this.aplicar({tipo:a,canal:b.dataset.canal});
      else if(a==="conferir")this.conferir();
      else if(a==="relPular")this.rel(()=>B.relogio.pular(),"⏭ Pulou para o próximo item. Horário da grade adiantado junto.");
      else if(a==="relSoma"){const sg=+b.dataset.s;this.rel(()=>B.relogio.soma(sg),"⏩ Grade adiantada "+(sg>=3600?sg/3600+" h":sg/60+" min")+".");}
      else if(a==="relIr"){const v=($("relHM").value||"").match(/^(\d{1,2}):(\d{2})/);if(!v){this.aviso("Hora inválida (use HH:MM).");return;}this.rel(()=>B.relogio.paraHora(+v[1],+v[2]),"⏩ Grade em "+pad(+v[1])+":"+v[2]+".");}
      else if(a==="relDia"){const d=b.dataset.d;this.rel(()=>B.relogio.paraDia(d),d==="fds"?"Fim de semana: grade de sábado/domingo.":"Dia útil: grade de segunda a sexta.");}
      else if(a==="relVivo")this.rel(()=>B.relogio.aoVivo(),"⟲ De volta ao vivo (hora real).");
      else if(a==="exportarCatalogo"){const cat=JSON.parse(JSON.stringify(B.cat()));cat.meta=Object.assign({},cat.meta,{exportado_do_painel:new Date().toISOString()});const j=this.baixar("catalogo.json",cat);$("cfgTxt").value=j.slice(0,2000)+(j.length>2000?"\n…":"");this.aviso("✔ catalogo.json exportado (download).",true);}
      else if(a==="exportarAjustes"){const j=this.baixar("vivabr-ajustes.json",this.ed());$("cfgTxt").value=j;this.aviso("✔ Ajustes exportados (arquivo + texto abaixo).",true);}
      else if(a==="importar")this.aplicar({tipo:"importar",json:$("cfgTxt").value});
      else if(a==="restaurar"){if(confirm("Restaurar a programação padrão? Os ajustes deste navegador serão apagados."))this.aplicar({tipo:"restaurar"});}
    });
    corpo.addEventListener("change",e=>{const t=e.target;
      if(t.id==="selDia"){this.dia=t.value;this.render();}
      else if(t.dataset.slot!==undefined)this.aplicar({tipo:t.dataset.campo==="tipo"?"slotTipo":"slotMin",h:this.hora,i:+t.dataset.slot,valor:t.value});
      else if(t.dataset.mad!==undefined)this.aplicar({tipo:"madrugada",h:+t.dataset.mad,valor:t.value});
      else if(t.dataset.quiz!==undefined)this.aplicar({tipo:"quizHora",h:+t.dataset.quiz});
      else if(t.id==="fFiltro"){this.filtroTipo=t.value;this.render();}
    });
    corpo.addEventListener("input",e=>{if(e.target.id==="fBusca"){this.busca=e.target.value;clearTimeout(this._b);this._b=setTimeout(()=>{const pos=e.target.selectionStart;this.render();const f=$("fBusca");if(f){f.focus();f.setSelectionRange(pos,pos);}},300);}});
    setInterval(()=>{this.resumo();if(this.aberto&&this.aba==="fila")this.r_fila();if(this.aberto&&this.aba==="relogio"&&!document.activeElement.matches("#relHM"))this.r_relogio();},5000);
    addEventListener("resize",()=>this.ajustaTela());
    const q=new URLSearchParams(location.search);if(q.get("aba")){this.aba=q.get("aba");this.abrir(true);}
    this.render();this.ajustaTela();
  }
};
window.Painel=Painel;Painel.ligar();
})();
