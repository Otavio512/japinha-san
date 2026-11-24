/* =========================== PORTAL DO CLIENTE =========================== */
const sb=semConfig()?null:window.supabase.createClient(CFG.url,CFG.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const TKEY='japinha-token';
let token=''; try{ token=localStorage.getItem(TKEY)||''; }catch(e){}
let D=null, PED=null, INFO={empresa:'Japinha San',whatsapp:'',corte:'08:00'}, carregando=false, erroCarga='', dadosEm=0;
const ui={v:'pedido',carrinho:{},retirada:'',busca:'',soEscolhidos:false,ultimo:null,veioDoHist:false,rel:{tipo:'semana',ref:''},aviso:''};
try{ const c=JSON.parse(localStorage.getItem('japinha-carrinho')||'null'); if(c) ui.carrinho=c; }catch(e){}
const salvaCarrinho=()=>{ try{ localStorage.setItem('japinha-carrinho',JSON.stringify(ui.carrinho)); }catch(e){} };

async function rpc(fn,args){
  const r=await sb.rpc(fn,args||{});
  if(r.error){ const m=r.error.message||''; if(/SESSAO_INVALIDA|ACESSO_BLOQUEADO/.test(m)){ sair(/BLOQUEADO/.test(m)?'Seu acesso foi bloqueado. Fale com a '+INFO.empresa+'.':'Sua sessão terminou. Entre de novo.'); throw new Error('SESSAO'); } throw r.error; }
  return r.data;
}
function sair(msg){ if(token) sb.rpc('cliente_sair',{p_token:token}).then(()=>{},()=>{}); token=''; D=null; PED=null; try{ localStorage.removeItem(TKEY); }catch(e){} ui.aviso=msg||''; render(); }
async function carregaDados(forcar){
  if(!token) return; if(!forcar&&D&&Date.now()-dadosEm<60000) return;
  carregando=true; erroCarga='';
  try{ D=await rpc('cliente_dados',{p_token:token}); dadosEm=Date.now(); INFO.empresa=D.config.empresa; INFO.whatsapp=D.config.whatsapp; }
  catch(e){ if(e.message!=='SESSAO') erroCarga=msgErro(e); }
  carregando=false;
}
async function carregaPedidos(){ try{ PED=await rpc('cliente_pedidos',{p_token:token}); }catch(e){ if(e.message!=='SESSAO') erroCarga=msgErro(e); } }

function route(){ const h=location.hash.replace('#',''); ui.v=['pedido','revisao','comprovante','historico','relatorios'].indexOf(h)>=0?h:'pedido'; abrir(); }
function go(v){ if(location.hash==='#'+v) route(); else location.hash=v; }
async function abrir(){
  if(!token){ render(); return; }
  if(!D){ render(); await carregaDados(true); }
  else if(ui.v==='pedido') await carregaDados(false);
  if(ui.v==='historico'||ui.v==='relatorios'||(ui.v==='comprovante'&&!PED)){ render(); await carregaPedidos(); }
  render();
}
function render(){
  $('#brandName').innerHTML=`<span>JAPINHA</span> <em>SAN</em>`;
  const logged=!!token&&!!D;
  $('#whoBox').hidden=!logged; $('#whoName').textContent=logged?D.cliente.nome:'';
  const sn=$('#subnav'); sn.hidden=!logged;
  if(logged) sn.innerHTML=[['pedido','Fazer pedido'],['historico','Meus pedidos'],['relatorios','Relatórios']].map(v=>`<a href="#${v[0]}" class="${v[0]===ui.v||(v[0]==='pedido'&&ui.v==='revisao')||(v[0]==='historico'&&ui.v==='comprovante')?'on':''}">${v[1]}</a>`).join('');
  const app=$('#app');
  if(semConfig()) app.innerHTML='<div class="loading"><p>Sistema ainda não configurado.</p></div>';
  else if(!token) app.innerHTML=vLogin();
  else if(!D) app.innerHTML=`<div class="loading">${erroCarga?`<p class="bad-t">${esc(erroCarga)}</p><button class="btn" type="button" data-act="recarregar">Tentar de novo</button>`:'<p>Carregando…</p>'}</div>`;
  else app.innerHTML=(({pedido:vPedido,revisao:vRevisao,comprovante:vComprovante,historico:vHistorico,relatorios:vRel})[ui.v]||vPedido)();
  labelTables(app); if(D&&ui.v==='pedido') atualizaBarra();
  const af=app.querySelector('[autofocus]'); if(af) af.focus();
}
const hojeSrv=()=>D?D.agora.slice(0,10):agoraLocal().slice(0,10);
const rotData=d=>{ const n=hojeSrv(); return d===n?'Hoje':d===addDays(n,1)?'Amanhã':DOWL[pKey(d).getDay()]; };

function vLogin(){
  return `<div class="auth"><section class="card auth-card"><div class="brand-big">${LOGO}<div><b>JAPINHA <em>SAN</em></b><span>Pedidos on-line</span></div></div>
    ${ui.aviso?`<div class="note">${esc(ui.aviso)}</div>`:''}
    <p class="muted">Entre com o usuário e a senha que você recebeu da ${esc(INFO.empresa)}.</p>
    <form id="loginF" novalidate>
      <label class="field">Usuário<input name="u" autocomplete="username" autocapitalize="none" spellcheck="false" autofocus></label>
      <label class="field">Senha<input name="p" type="password" autocomplete="current-password"></label>
      <p class="form-err" role="alert"></p><button class="btn-big" type="submit">Entrar</button>
    </form>
    ${INFO.whatsapp?`<p class="muted" style="font-size:13px">Esqueceu a senha? <a href="${esc(waLink(INFO.whatsapp,'Olá! Esqueci minha senha do site de pedidos.'))}" target="_blank" rel="noopener">Fale com a ${esc(INFO.empresa)} no WhatsApp</a>.</p>`:''}
  </section></div>`;
}
async function login(fd){
  const r=await sb.rpc('cliente_login',{p_usuario:String(fd.get('u')||''),p_senha:String(fd.get('p')||'')});
  if(r.error) return msgErro(r.error);
  if(!r.data.ok) return r.data.msg;
  token=r.data.token; try{ localStorage.setItem(TKEY,token); }catch(e){} ui.aviso=''; D=null; PED=null; ui.v='pedido';
  if(location.hash!=='#pedido') location.hash='pedido'; else abrir(); return null;
}
function catalogo(){ return D?D.catalogo:[]; }
function limpaCarrinho(){ const ids=new Set(catalogo().map(s=>s.id)); let tirou=0; Object.keys(ui.carrinho).forEach(k=>{ if(!ids.has(k)){ delete ui.carrinho[k]; tirou++; } }); if(tirou) salvaCarrinho(); return tirou; }
function totais(){ let qtd=0,total=0; catalogo().forEach(s=>{ const q=ui.carrinho[s.id]||0; if(q){ qtd+=q; total+=q*s.preco; } }); return {qtd:qtd,total:total}; }
function vPedido(){
  const datas=D.datas||[]; if(ui.retirada&&datas.indexOf(ui.retirada)<0) ui.retirada=''; if(!ui.retirada) ui.retirada=datas[0]||'';
  limpaCarrinho();
  const cat=catalogo(), t=totais(), q=ui.busca.trim().toLowerCase();
  return `<div class="page-head"><div><h1>Olá, ${esc(D.cliente.contato||D.cliente.nome)}</h1><p>Escolha a data de retirada e digite a quantidade de cada sabor.</p></div></div>
  ${ui.aviso?`<div class="note">${ui.aviso}</div>`:''}
  <section class="card"><div class="card-head"><h2>Retirada</h2><span class="muted" style="font-size:13px">Pedido para o mesmo dia até as ${esc(D.config.corte)} (horário de Brasília)</span></div>
    ${datas.length?`<div class="datechips" role="radiogroup" aria-label="Data de retirada">${datas.map(d=>`<button type="button" role="radio" aria-checked="${d===ui.retirada}" class="${d===ui.retirada?'on':''}" data-act="data" data-d="${d}"><span>${rotData(d)}</span><b>${dShort(d)}</b></button>`).join('')}</div>`:'<p class="empty">Nenhuma data disponível no momento.</p>'}
  </section>
  <section class="card"><div class="card-head"><h2>Sabores</h2><span class="muted" style="font-size:13px">${cat.length} disponíveis para você</span></div>
    <div class="filters"><label class="field" style="flex:1">Procurar sabor<input id="busca" value="${esc(ui.busca)}" placeholder="Ex.: frango" autocomplete="off"></label>
    <label class="check"><input type="checkbox" id="soEsc" ${ui.soEscolhidos?'checked':''}> Mostrar só os escolhidos</label></div>
    ${cat.length?`<ul class="cat">${cat.map(s=>{ const qv=ui.carrinho[s.id]||0; const hide=(q&&s.nome.toLowerCase().indexOf(q)<0)||(ui.soEscolhidos&&!qv);
      return `<li class="${qv?'has':''}" data-sid="${s.id}" ${hide?'hidden':''}><span class="nm">${esc(s.nome)}</span>${s.descricao?`<span class="ds">${esc(s.descricao)}</span>`:''}<span class="pr">${brl(s.preco)} cada</span>
        <span class="q"><input inputmode="numeric" pattern="[0-9]*" data-qtd="${s.id}" value="${qv||''}" placeholder="0" aria-label="Quantidade de ${esc(s.nome)}"><small data-sub="${s.id}">${qv?brl(qv*s.preco):''}</small></span></li>`; }).join('')}</ul>`:'<p class="empty">Nenhum sabor liberado para você no momento. Fale com a '+esc(INFO.empresa)+'.</p>'}
  </section>
  <div class="cartbar"><div><span class="muted" style="font-size:13px" id="cbQ"></span><b id="cbT">${brl(t.total)}</b></div>
    <button class="btn primary" type="button" data-act="revisar" id="cbBtn">Revisar pedido</button></div>`;
}
function atualizaBarra(){ const t=totais(), q=$('#cbQ'); if(!q) return; q.textContent=num(t.qtd)+' pastéis'+(ui.retirada?' · '+rotData(ui.retirada)+' '+dShort(ui.retirada):''); $('#cbT').textContent=brl(t.total); $('#cbBtn').disabled=!(t.qtd&&ui.retirada); }
function itens(){ return catalogo().filter(s=>ui.carrinho[s.id]>0).map(s=>({sabor_id:s.id,nome:s.nome,qtd:ui.carrinho[s.id],preco:s.preco,subtotal:ui.carrinho[s.id]*s.preco})); }
function vRevisao(){
  const it=itens(); if(!it.length||!ui.retirada){ ui.v='pedido'; return vPedido(); }
  const qtd=it.reduce((a,x)=>a+x.qtd,0), total=it.reduce((a,x)=>a+x.subtotal,0);
  return `<div class="page-head"><div><h1>Confira seu pedido</h1><p>Revise os itens, a data e o valor antes de confirmar.</p></div></div>
  ${ui.aviso?`<div class="warnbox">${ui.aviso}</div>`:''}
  <section class="rcpt">
    <div class="kv"><div><span>Cliente</span>${esc(D.cliente.nome)}</div><div><span>Retirada</span>${cap(rotData(ui.retirada))} · ${dBr(ui.retirada)}</div></div>
    <ul class="lines">${it.map(x=>`<li><span class="qt">${num(x.qtd)}×</span><span>${esc(x.nome)}</span><span class="sb">${brl(x.subtotal)}</span><small>${brl(x.preco)} cada</small></li>`).join('')}</ul>
    <div class="sumline"><span>${num(qtd)} pastéis</span><span>${brl(total)}</span></div>
    <p class="muted" style="margin:0;font-size:13px">Valor total a pagar: <strong>${brl(total)}</strong>. ${D.config.aprovacao==='manual'?'O pedido fica pendente até a confirmação da '+esc(INFO.empresa)+'.':'O pedido é confirmado na hora.'}</p>
  </section>
  <div class="actions"><button class="btn" type="button" data-act="voltar">Voltar e alterar</button><button class="btn primary" type="button" data-act="confirmar" id="btnConf">Confirmar pedido</button></div>`;
}
async function confirmar(btn){
  const it=itens(); if(!it.length) return;
  btn.disabled=true; btn.textContent='Enviando…';
  const esperado=it.reduce((a,x)=>a+x.subtotal,0);
  try{
    const r=await rpc('cliente_criar_pedido',{p_token:token,p_retirada:ui.retirada,p_itens:it.map(x=>({sabor_id:x.sabor_id,qtd:x.qtd})),p_total_esperado:esperado});
    if(!r.ok){
      if(r.erro==='data'){ const antes=ui.retirada; D.datas=r.datas||[]; ui.retirada=D.datas[0]||''; ui.aviso='A data '+dShort(antes)+' não está mais disponível ('+esc(String(r.msg).toLowerCase())+'). Mudamos para '+(ui.retirada?rotData(ui.retirada)+' '+dShort(ui.retirada):'a próxima data')+'. Confira e confirme de novo.'; }
      else { await carregaDados(true); const tirou=limpaCarrinho(); ui.aviso=esc(r.msg)+(tirou?' ('+tirou+' sabor'+(tirou>1?'es':'')+' retirado'+(tirou>1?'s':'')+')':''); }
      render(); return;
    }
    ui.carrinho={}; salvaCarrinho(); ui.aviso=''; ui.ultimo=r.pedido.id; ui.veioDoHist=false;
    PED=PED?[r.pedido].concat(PED):[r.pedido]; go('comprovante');
  }catch(e){ if(e.message!=='SESSAO'){ btn.disabled=false; btn.textContent='Confirmar pedido'; toast(msgErro(e)); } }
}
function vComprovante(){
  const p=(PED||[]).find(x=>x.id===ui.ultimo); if(!p){ ui.v='historico'; return vHistorico(); }
  const aberto=['pendente','confirmado','em_preparacao'].indexOf(p.status)>=0, novo=!ui.veioDoHist;
  const msgCancel='Olá! Sou '+D.cliente.nome+' e gostaria de pedir o cancelamento do pedido nº '+nPed(p.numero)+', com retirada em '+dBr(p.retirada)+'.';
  return `<div class="page-head"><div><h1>${novo?'Pedido enviado':'Comprovante'}</h1><p>${novo?(p.status==='pendente'?'Aguardando a confirmação da '+esc(INFO.empresa)+'. Acompanhe em “Meus pedidos”.':'Pedido confirmado. Até a retirada!'):'Guarde ou compartilhe este comprovante.'}</p></div></div>
  ${cardComprovante(p)}
  <div class="actions">
    <a class="btn primary" href="${esc(waLink('',comprovanteTxt(p,INFO.empresa)))}" target="_blank" rel="noopener">Enviar no WhatsApp</a>
    <button class="btn" type="button" data-act="copiar" data-id="${p.id}">Copiar</button>
    <button class="btn" type="button" data-act="pdf" data-id="${p.id}">Baixar PDF</button>
    <button class="btn" type="button" data-act="repetir" data-id="${p.id}">Repetir pedido</button>
    ${aberto&&INFO.whatsapp?`<a class="btn danger" href="${esc(waLink(INFO.whatsapp,msgCancel))}" target="_blank" rel="noopener">Pedir cancelamento</a>`:''}
  </div>
  ${aberto?`<p class="muted" style="font-size:13px;margin:0">O cancelamento é feito pela ${esc(INFO.empresa)} pelo WhatsApp, porque a produção pode já ter começado.</p>`:''}`;
}
function vHistorico(){
  if(!PED) return '<div class="loading"><p>Carregando seus pedidos…</p></div>';
  return `<div class="page-head"><div><h1>Meus pedidos</h1><p>Veja o comprovante, a situação ou repita um pedido.</p></div><button class="btn small" type="button" data-act="atualizar">Atualizar</button></div>
  <section class="card">${PED.length?`<div class="tw"><table><thead><tr><th>Pedido</th><th>Feito em</th><th>Retirada</th><th class="num">Pastéis</th><th class="num">Total</th><th>Situação</th><th></th></tr></thead><tbody>
    ${PED.map(p=>`<tr><td><strong class="mono">nº ${nPed(p.numero)}</strong></td><td class="nowrap">${carBr(p.criado_em)}</td><td class="nowrap">${dDow(p.retirada)}</td><td class="num">${num(p.total_qtd)}</td><td class="num money">${brl(p.total)}</td><td><span class="pill ${ST[p.status].c}">${ST[p.status].t}</span></td>
      <td class="nowrap"><button class="link" type="button" data-act="ver" data-id="${p.id}">Comprovante</button> · <button class="link" type="button" data-act="repetir" data-id="${p.id}">Repetir</button></td></tr>`).join('')}
    </tbody></table></div>`:'<p class="empty">Você ainda não fez pedidos.</p>'}</section>`;
}
async function repetir(id){
  const p=(PED||[]).find(x=>x.id===id); if(!p) return;
  await carregaDados(true); const cat=catalogo(); ui.carrinho={}; const fora=[];
  p.itens.forEach(x=>{ if(cat.some(s=>s.id===x.sabor_id)) ui.carrinho[x.sabor_id]=(ui.carrinho[x.sabor_id]||0)+x.qtd; else fora.push(x.nome); });
  salvaCarrinho();
  const mud=p.itens.filter(x=>{ const s=cat.find(s=>s.id===x.sabor_id); return s&&s.preco!==x.preco; }).length;
  ui.aviso='<b>Pedido nº '+nPed(p.numero)+' copiado.</b> Confira as quantidades e escolha a data.'+(fora.length?' Fora do seu catálogo agora: '+esc(fora.join(', '))+'.':'')+(mud?' Alguns preços mudaram e valem os de hoje.':'');
  ui.retirada=''; ui.busca=''; ui.soEscolhidos=false; go('pedido');
}
function vRel(){
  if(!PED) return '<div class="loading"><p>Carregando…</p></div>';
  const r=ui.rel; if(!r.ref) r.ref=hojeSrv(); const P=periodoRel(r.tipo,r.ref);
  const L=PED.filter(p=>p.status!=='cancelado'&&p.criado_em.slice(0,10)>=P.de&&p.criado_em.slice(0,10)<=P.ate).sort((a,b)=>a.criado_em<b.criado_em?-1:1);
  const R=resumo(L,id=>{ const i=catalogo().findIndex(s=>s.id===id); return i<0?999:i; });
  return `<div class="page-head"><div><h1>Relatórios</h1><p>Pedidos feitos no período, sem os cancelados.</p></div>
    <div class="toggle" role="group" aria-label="Período"><button type="button" class="${r.tipo==='semana'?'on':''}" data-act="rel-tipo" data-t="semana">Semana</button><button type="button" class="${r.tipo==='mes'?'on':''}" data-act="rel-tipo" data-t="mes">Mês</button></div></div>
  <section class="card"><div class="navrow"><button class="btn small" type="button" data-act="rel-nav" data-d="-1" aria-label="Período anterior">‹</button><strong>${esc(P.rot)}</strong><button class="btn small" type="button" data-act="rel-nav" data-d="1" aria-label="Próximo período">›</button></div>
    <div class="tiles" style="grid-template-columns:repeat(3,minmax(0,1fr))"><div class="tile" style="--c:var(--accent)"><b>${num(R.qtd)}</b><span>pastéis</span></div><div class="tile" style="--c:var(--ok)"><b>${brl(R.total)}</b><span>valor total</span></div><div class="tile" style="--c:var(--ink)"><b>${R.n}</b><span>pedidos</span></div></div></section>
  <section class="card"><h2>Por sabor</h2>${R.sab.length?`<div class="tw"><table><thead><tr><th>Sabor</th><th class="num">Quantidade</th><th class="num">Valor</th></tr></thead><tbody>${R.sab.map(x=>`<tr><td>${esc(x.nome)}</td><td class="num">${num(x.qtd)}</td><td class="num money">${brl(x.total)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="empty">Nenhum pedido no período.</p>'}</section>
  <section class="card"><h2>Pedidos do período</h2>${L.length?`<div class="tw"><table><thead><tr><th>Pedido</th><th>Feito em</th><th>Retirada</th><th class="num">Pastéis</th><th class="num">Total</th><th>Situação</th></tr></thead><tbody>${L.map(p=>`<tr><td><button class="link mono" type="button" data-act="ver" data-id="${p.id}">nº ${nPed(p.numero)}</button></td><td class="nowrap">${carBr(p.criado_em)}</td><td class="nowrap">${dDow(p.retirada)}</td><td class="num">${num(p.total_qtd)}</td><td class="num money">${brl(p.total)}</td><td><span class="pill ${ST[p.status].c}">${ST[p.status].t}</span></td></tr>`).join('')}</tbody></table></div>`:'<p class="empty">Nenhum pedido no período.</p>'}</section>`;
}
/* PDF do comprovante gerado no próprio aparelho, sem serviço externo */
function pdfComprovante(p){
  const enc=s=>String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^\x20-\x7e]/g,'').replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
  const L=[]; let y=800; const t=(x,s,size,bold)=>{ L.push('BT /'+(bold?'F2':'F1')+' '+size+' Tf '+x+' '+y+' Td ('+enc(s)+') Tj ET'); };
  L.push('0.84 0.1 0.16 rg 40 770 515 50 re f'); y=800; L.push('1 1 1 rg'); t(56,'JAPINHA SAN',22,true); y=782; t(56,'Comprovante de pedido',11,false); L.push('0 0 0 rg');
  y=740; t(56,'Pedido no '+nPed(p.numero)+'  -  '+ST[p.status].t,14,true);
  y-=22; t(56,'Cliente: '+p.cliente_nome,11); y-=16; t(56,'Feito em: '+carBr(p.criado_em),11); y-=16; t(56,'Retirada: '+DOWL[pKey(p.retirada).getDay()]+', '+dBr(p.retirada),11);
  y-=28; t(56,'Qtd',10,true); t(110,'Sabor',10,true); t(380,'Unit.',10,true); t(460,'Subtotal',10,true); L.push('0.6 G 56 '+(y-6)+' m 540 '+(y-6)+' l S');
  p.itens.forEach(x=>{ y-=18; if(y<90) return; t(56,num(x.qtd),10); t(110,x.nome.slice(0,42),10); t(380,brl(x.preco),10); t(460,brl(x.subtotal),10); });
  y-=12; L.push('0 G 56 '+y+' m 540 '+y+' l S'); y-=20; t(56,'Total: '+num(p.total_qtd)+' pasteis',12,true); t(420,brl(p.total),14,true);
  const stream=L.join('\n');
  const objs=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>','<< /Length '+stream.length+' >>\nstream\n'+stream+'\nendstream'];
  let pdf='%PDF-1.4\n', offs=[]; objs.forEach((o,i)=>{ offs.push(pdf.length); pdf+=(i+1)+' 0 obj\n'+o+'\nendobj\n'; });
  const xref=pdf.length; pdf+='xref\n0 '+(objs.length+1)+'\n0000000000 65535 f \n'+offs.map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+(objs.length+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF';
  const blob=new Blob([pdf],{type:'application/pdf'}), url=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url; a.download='pedido-'+nPed(p.numero)+'.pdf'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),4000);
}

document.addEventListener('submit',async ev=>{
  if(ev.target.id!=='loginF') return; ev.preventDefault(); const f=ev.target, btn=f.querySelector('[type=submit]'), el=f.querySelector('.form-err');
  btn.disabled=true; el.textContent=''; let err; try{ err=await login(new FormData(f)); }catch(e){ err=msgErro(e); } btn.disabled=false; if(err&&document.body.contains(el)) el.textContent=err;
});
document.addEventListener('click',ev=>{
  const b=ev.target.closest('[data-act]'); if(!b) return; const a=b.dataset.act, id=b.dataset.id, p=()=>(PED||[]).find(x=>x.id===id);
  if(a==='sair') sair();
  else if(a==='recarregar'){ D=null; abrir(); }
  else if(a==='data'){ ui.retirada=b.dataset.d; document.querySelectorAll('.datechips button').forEach(x=>{ const on=x.dataset.d===ui.retirada; x.classList.toggle('on',on); x.setAttribute('aria-checked',on); }); atualizaBarra(); }
  else if(a==='revisar'){ ui.aviso=''; go('revisao'); }
  else if(a==='voltar'){ ui.aviso=''; go('pedido'); }
  else if(a==='confirmar') confirmar(b);
  else if(a==='ver'){ ui.ultimo=id; ui.veioDoHist=true; go('comprovante'); }
  else if(a==='copiar') copyText(comprovanteTxt(p(),INFO.empresa),b);
  else if(a==='pdf') pdfComprovante(p());
  else if(a==='repetir') repetir(id);
  else if(a==='atualizar'){ PED=null; abrir(); }
  else if(a==='rel-tipo'){ ui.rel={tipo:b.dataset.t,ref:''}; render(); }
  else if(a==='rel-nav'){ const P=periodoRel(ui.rel.tipo,ui.rel.ref||hojeSrv()); const d=Number(b.dataset.d); ui.rel.ref=ui.rel.tipo==='semana'?addDays(P.de,7*d):(()=>{ const x=pKey(P.de); return dKey(new Date(x.getFullYear(),x.getMonth()+d,1)); })(); render(); }
});
document.addEventListener('input',ev=>{
  const t=ev.target;
  if(t.dataset.qtd){ const v=parseInt0(t.value); if(t.value!==''&&String(v||'')!==t.value) t.value=v||''; const sid=t.dataset.qtd; if(v) ui.carrinho[sid]=v; else delete ui.carrinho[sid]; salvaCarrinho();
    const s=catalogo().find(k=>k.id===sid), li=t.closest('li'); li.classList.toggle('has',!!v); li.querySelector('[data-sub]').textContent=v?brl(v*s.preco):''; atualizaBarra(); }
  else if(t.id==='busca'){ ui.busca=t.value; const q=t.value.trim().toLowerCase(); document.querySelectorAll('.cat li').forEach(li=>{ li.hidden=(q&&li.querySelector('.nm').textContent.toLowerCase().indexOf(q)<0)||(ui.soEscolhidos&&!ui.carrinho[li.dataset.sid]); }); }
});
document.addEventListener('change',ev=>{ if(ev.target.id==='soEsc'){ ui.soEscolhidos=ev.target.checked; render(); } });
document.addEventListener('keydown',ev=>{ if(ev.key==='Escape'&&!$('#dlg').hidden) closeDlg(); });
document.addEventListener('visibilitychange',async()=>{ if(!document.hidden&&token&&D&&ui.v==='pedido'&&!/INPUT/.test((document.activeElement||{}).tagName||'')){ await carregaDados(true); render(); } });
window.addEventListener('hashchange',route);
(async()=>{ if(sb){ try{ const r=await sb.rpc('publico_info'); if(r.data) INFO=r.data; }catch(e){} } route(); })();
setInterval(async()=>{ if(token&&D&&ui.v==='pedido'&&document.visibilityState==='visible'){ const antes=(D.datas||[]).join(); await carregaDados(true); if(D&&(D.datas||[]).join()!==antes&&!/INPUT/.test((document.activeElement||{}).tagName||'')) render(); } },120000);
