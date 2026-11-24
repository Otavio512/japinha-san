/* =========================== ADMINISTRAÇÃO =========================== */
const sb=semConfig()?null:window.supabase.createClient(CFG.url,CFG.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'japinha-admin'}});
const DOMINIO_ADM='japinhasan.app';
const nomeUsuario=()=>usuario&&usuario.email?usuario.email.replace('@'+DOMINIO_ADM,''):'';
let S=null, usuario=null, estado='inicio', erroCarga='', hojeSrv=agoraLocal().slice(0,10);
const ui={v:'pedidos',af:{st:'abertos',cli:'todos',per:'proximos'},cal:{mes:'',sel:''},ar:{per:'semana',base:'retirada',de:'',ate:''}};
const AV=[['pedidos','Pedidos'],['calendario','Calendário'],['clientes','Clientes'],['sabores','Sabores'],['relatorios','Relatórios'],['ajustes','Ajustes']];

async function q(prom){ const r=await prom; if(r.error) throw r.error; return r.data; }
async function todos(tabela,sel,mod){ let out=[], i=0; for(;;){ let qb=sb.from(tabela).select(sel); if(mod) qb=mod(qb); const d=await q(qb.range(i,i+999)); out=out.concat(d); if(d.length<1000) break; i+=1000; } return out; }
const normPed=p=>Object.assign({},p,{criado_em:isoSP(p.criado_em)});
async function carregaTudo(){
  const desde=addDays(agoraLocal().slice(0,10),-200);
  const [cfg,blq,sab,cli,cat,ped,agora]=await Promise.all([
    q(sb.from('config').select('*').eq('id',1).single()),
    q(sb.from('datas_bloqueadas').select('*')),
    todos('sabores','*',x=>x.order('ordem')),
    todos('clientes','id,nome,contato,telefone,usuario,bloqueado,criado_em',x=>x.order('nome')),
    todos('catalogo','*'),
    todos('pedidos','*',x=>x.or('retirada.gte.'+desde+',status.eq.pendente').order('numero',{ascending:false})),
    q(sb.rpc('admin_agora'))
  ]);
  const catMap={}; cat.forEach(r=>{ (catMap[r.cliente_id]=catMap[r.cliente_id]||{})[r.sabor_id]=r.preco; });
  cli.forEach(c=>{ c.catalogo=catMap[c.id]||{}; });
  cfg.corte=String(cfg.corte).slice(0,5);
  S={config:cfg,bloqueadas:blq,sabores:sab,clientes:cli,pedidos:ped.map(normPed)}; hojeSrv=String(agora).slice(0,10);
}
async function recarregaPedidos(avisar){
  if(!S) return; const desde=addDays(hojeSrv,-200);
  const antes=new Set(S.pedidos.map(p=>p.id));
  const ped=await todos('pedidos','*',x=>x.or('retirada.gte.'+desde+',status.eq.pendente').order('numero',{ascending:false}));
  S.pedidos=ped.map(normPed);
  try{ hojeSrv=String(await q(sb.rpc('admin_agora'))).slice(0,10); }catch(e){}
  if(avisar){ const novos=S.pedidos.filter(p=>!antes.has(p.id)); if(novos.length) toast(novos.length===1?'Novo pedido nº '+nPed(novos[0].numero)+' de '+novos[0].cliente_nome+'.':novos.length+' pedidos novos.'); return novos.length; }
  return 0;
}
async function recarregaClientes(){ const [cli,cat]=await Promise.all([todos('clientes','id,nome,contato,telefone,usuario,bloqueado,criado_em',x=>x.order('nome')),todos('catalogo','*')]); const m={}; cat.forEach(r=>{ (m[r.cliente_id]=m[r.cliente_id]||{})[r.sabor_id]=r.preco; }); cli.forEach(c=>{ c.catalogo=m[c.id]||{}; }); S.clientes=cli; }
async function recarregaSabores(){ S.sabores=await todos('sabores','*',x=>x.order('ordem')); }
async function recarregaConfig(){ const [cfg,blq]=await Promise.all([q(sb.from('config').select('*').eq('id',1).single()),q(sb.from('datas_bloqueadas').select('*'))]); cfg.corte=String(cfg.corte).slice(0,5); S.config=cfg; S.bloqueadas=blq; }

async function iniciar(){
  if(semConfig()){ estado='semconfig'; render(); return; }
  const {data}=await sb.auth.getSession();
  if(!data.session){ estado='login'; render(); return; }
  usuario=data.session.user; await entrar();
}
async function entrar(){
  estado='carregando'; render();
  try{
    const ok=await q(sb.rpc('reivindicar_admin'));
    if(!ok){ await sb.auth.signOut(); estado='login'; erroCarga='Esta conta não é de administrador.'; render(); return; }
    await carregaTudo(); estado='ok'; erroCarga='';
  }catch(e){ estado='erro'; erroCarga=msgErro(e); }
  route();
}
async function sair(){ await sb.auth.signOut(); S=null; usuario=null; estado='login'; render(); }

function route(){ const h=location.hash.replace('#',''); if(AV.some(v=>v[0]===h)) ui.v=h; render(); }
function go(v){ if(location.hash==='#'+v) route(); else location.hash=v; }
function render(){
  $('#brandName').innerHTML=`<span>JAPINHA</span> <em>SAN</em>`;
  const ok=estado==='ok';
  $('#whoBox').hidden=!ok; $('#whoName').textContent=ok?nomeUsuario():'';
  const sn=$('#subnav'); sn.hidden=!ok;
  if(ok) sn.innerHTML=AV.map(v=>`<a href="#${v[0]}" class="${v[0]===ui.v?'on':''}">${v[1]}${v[0]==='pedidos'?pendBadge():''}</a>`).join('');
  const app=$('#app');
  if(estado==='semconfig') app.innerHTML='<div class="loading"><p>Sistema ainda não configurado.</p></div>';
  else if(estado==='login') app.innerHTML=vLogin();
  else if(estado==='carregando'||estado==='inicio') app.innerHTML='<div class="loading"><p>Carregando…</p></div>';
  else if(estado==='erro') app.innerHTML=`<div class="loading"><p class="bad-t">${esc(erroCarga)}</p><div class="actions" style="justify-content:center"><button class="btn" type="button" data-act="tentar">Tentar de novo</button><button class="btn ghost" type="button" data-act="sair">Sair</button></div></div>`;
  else app.innerHTML=(({pedidos:aPedidos,calendario:aCalendario,clientes:aClientes,sabores:aSabores,relatorios:aRelatorios,ajustes:aAjustes})[ui.v]||aPedidos)();
  labelTables(app);
  const af=app.querySelector('[autofocus]'); if(af) af.focus();
}
function pendBadge(){ const n=S?S.pedidos.filter(p=>p.status==='pendente').length:0; return n?` <span class="badge-n">${n}</span>`:''; }
function vLogin(){
  return `<div class="auth"><section class="card auth-card"><div class="brand-big">${LOGO}<div><b>JAPINHA <em>SAN</em></b><span>Administração</span></div></div>
    ${erroCarga?`<div class="warnbox">${esc(erroCarga)}</div>`:''}
    <form id="loginF" novalidate>
      <label class="field">Usuário<input name="u" autocomplete="username" autocapitalize="none" spellcheck="false" autofocus placeholder="admin"></label>
      <label class="field">Senha<input name="p" type="password" autocomplete="current-password"></label>
      <p class="form-err" role="alert"></p><button class="btn-big" type="submit">Entrar</button>
    </form>
    <p class="muted" style="font-size:13px">Use o usuário e a senha criados no Supabase (Authentication → Users).</p></section></div>`;
}
async function login(fd){
  const u=String(fd.get('u')||'').trim().toLowerCase(); if(!u) return 'Informe o usuário.';
  const r=await sb.auth.signInWithPassword({email:u.indexOf('@')>=0?u:u+'@'+DOMINIO_ADM,password:String(fd.get('p')||'')});
  if(r.error) return /Invalid login|invalid_credentials/i.test(r.error.message+r.error.code)?'Usuário ou senha incorretos.':msgErro(r.error);
  usuario=r.data.user; erroCarga=''; await entrar(); return null;
}
const sabOrd=()=>S.sabores.filter(s=>!s.excluido).sort((a,b)=>a.ordem-b.ordem||a.nome.localeCompare(b.nome,'pt-BR'));
const ordemDe=id=>{ const s=S.sabores.find(x=>x.id===id); return s?s.ordem:999; };
const catDe=c=>sabOrd().filter(s=>s.ativo&&c.catalogo[s.id]!==undefined);
const FLUXO={pendente:['confirmado','Aprovar pedido'],confirmado:['em_preparacao','Iniciar preparação'],em_preparacao:['concluido','Marcar como concluído']};
function regraData(d){
  const c=S.config, dow=pKey(d).getDay(), esp=(c.especiais||[]).indexOf(d)>=0;
  if(S.bloqueadas.some(b=>b.data===d)) return 'bloqueada'; if(dow===0) return (c.domingo||esp)?'':'fechado'; return (c.dias.indexOf(dow)>=0||esp)?'':'fechado';
}

/* ----- pedidos ----- */
function aPedidos(){
  const n=hojeSrv, f=ui.af;
  let L=S.pedidos.slice();
  if(f.st==='abertos') L=L.filter(p=>['pendente','confirmado','em_preparacao'].indexOf(p.status)>=0); else if(f.st!=='todos') L=L.filter(p=>p.status===f.st);
  if(f.cli!=='todos') L=L.filter(p=>p.cliente_id===f.cli);
  if(f.per==='hoje') L=L.filter(p=>p.retirada===n); else if(f.per==='amanha') L=L.filter(p=>p.retirada===addDays(n,1)); else if(f.per==='proximos') L=L.filter(p=>p.retirada>=n&&p.retirada<=addDays(n,6)); else if(f.per==='passados') L=L.filter(p=>p.retirada<n);
  L.sort((a,b)=>f.per==='passados'?(a.retirada<b.retirada?1:-1):(a.retirada<b.retirada?-1:a.retirada>b.retirada?1:a.numero-b.numero));
  const pend=S.pedidos.filter(p=>p.status==='pendente'), hoje=S.pedidos.filter(p=>p.retirada===n&&p.status!=='cancelado');
  const opt=(arr,cur)=>arr.map(o=>`<option value="${o[0]}" ${o[0]===cur?'selected':''}>${esc(o[1])}</option>`).join('');
  return `<div class="page-head"><div><h1>Pedidos</h1><p>Aprovação: <strong>${S.config.aprovacao==='manual'?'manual (pedidos entram pendentes)':'automática (entram confirmados)'}</strong></p></div><button class="btn small" type="button" data-act="atualizar">Atualizar</button></div>
  <div class="tiles">
    <button class="tile" style="--c:var(--warn);text-align:left;cursor:pointer;font:inherit;color:inherit" type="button" data-act="filtro-pend"><b>${pend.length}</b><span>Pendentes de aprovação</span></button>
    <div class="tile" style="--c:var(--accent)"><b>${hoje.length}</b><span>Retiradas hoje</span></div>
    <div class="tile" style="--c:var(--ok)"><b>${num(hoje.reduce((a,p)=>a+p.total_qtd,0))}</b><span>Pastéis para hoje</span></div>
    <div class="tile" style="--c:var(--ink)"><b>${brl(hoje.reduce((a,p)=>a+p.total,0))}</b><span>Valor das retiradas de hoje</span></div>
  </div>
  <section class="card"><div class="filters">
    <label class="field">Situação<select data-af="st">${opt([['abertos','Em aberto'],['todos','Todas']].concat(Object.keys(ST).map(k=>[k,ST[k].t])),f.st)}</select></label>
    <label class="field">Retirada<select data-af="per">${opt([['proximos','Hoje e próximos 7 dias'],['hoje','Hoje'],['amanha','Amanhã'],['passados','Datas passadas'],['todas','Todas']],f.per)}</select></label>
    <label class="field">Cliente<select data-af="cli">${opt([['todos','Todos']].concat(S.clientes.map(c=>[c.id,c.nome])),f.cli)}</select></label>
    <span class="muted" style="margin-left:auto;font-size:13px">${L.length} pedido${L.length===1?'':'s'}</span></div>
    <div class="tw"><table><thead><tr><th>Pedido</th><th>Cliente</th><th>Feito em</th><th>Retirada</th><th class="num">Pastéis</th><th class="num">Total</th><th>Situação</th><th></th></tr></thead><tbody>
    ${L.slice(0,400).map(p=>`<tr><td><button class="link mono" type="button" data-act="ped" data-id="${p.id}">nº ${nPed(p.numero)}</button></td><td>${esc(p.cliente_nome)}</td><td class="nowrap">${carBr(p.criado_em)}</td><td class="nowrap">${dDow(p.retirada)}</td><td class="num">${num(p.total_qtd)}</td><td class="num money">${brl(p.total)}</td><td><span class="pill ${ST[p.status].c}">${ST[p.status].t}</span></td>
      <td class="nowrap">${FLUXO[p.status]?`<button class="btn small primary" type="button" data-act="avancar" data-id="${p.id}">${FLUXO[p.status][1]}</button> `:''}<button class="link" type="button" data-act="ped" data-id="${p.id}">Abrir</button></td></tr>`).join('')||'<tr><td colspan="8" class="empty">Nenhum pedido neste filtro.</td></tr>'}
    </tbody></table></div></section>`;
}
function dlgPedido(id){
  const p=S.pedidos.find(x=>x.id===id); if(!p) return; const c=S.clientes.find(x=>x.id===p.cliente_id)||{};
  const msg='Olá, '+(c.contato||p.cliente_nome)+'! Seu pedido nº '+nPed(p.numero)+' com retirada em '+dBr(p.retirada)+' está: '+ST[p.status].t+'.';
  openDlg('Pedido nº '+nPed(p.numero),cardComprovante(p,true)+`<div class="actions">
    ${FLUXO[p.status]?`<button class="btn primary" type="button" data-act="avancar" data-id="${p.id}">${FLUXO[p.status][1]}</button>`:''}
    ${c.telefone?`<a class="btn" href="${esc(waLink(c.telefone,msg))}" target="_blank" rel="noopener">Avisar cliente no WhatsApp</a>`:''}
    <button class="btn" type="button" data-act="copiar-comp" data-id="${p.id}">Copiar comprovante</button>
    ${['pendente','confirmado','em_preparacao'].indexOf(p.status)>=0?`<button class="btn danger" type="button" data-act="cancelar" data-id="${p.id}">Cancelar pedido</button>`:''}</div>`,{size:'wide'});
}
async function mudaStatus(p,st,motivo){ const r=await q(sb.rpc('admin_mudar_status',{p_pedido:p.id,p_status:st,p_motivo:motivo||''})); const i=S.pedidos.findIndex(x=>x.id===p.id); const np=Object.assign({},r,{criado_em:p.criado_em}); if(i>=0) S.pedidos[i]=np; return np; }
function dlgCancelar(id){
  const p=S.pedidos.find(x=>x.id===id);
  openDlg('Cancelar pedido nº '+nPed(p.numero),`<p style="margin:0">${esc(p.cliente_nome)} · retirada ${dBr(p.retirada)} · ${brl(p.total)}</p><label class="field">Motivo<textarea name="m" placeholder="Ex.: cliente pediu pelo WhatsApp antes do início da produção."></textarea></label><p class="muted" style="margin:0;font-size:13px">O pedido continua no histórico do cliente, como cancelado.</p>`,
  {ok:'Cancelar pedido',onOk:async fd=>{ const m=String(fd.get('m')||'').trim(); if(m.length<5) return 'Informe o motivo.'; await mudaStatus(p,'cancelado',m); render(); toast('Pedido nº '+nPed(p.numero)+' cancelado.'); return null; }});
}

/* ----- calendário ----- */
function aCalendario(){
  const n=hojeSrv; if(!ui.cal.mes) ui.cal.mes=n.slice(0,7); if(!ui.cal.sel) ui.cal.sel=n;
  const [y,m]=ui.cal.mes.split('-').map(Number), startOff=new Date(y,m-1,1).getDay(), last=new Date(y,m,0).getDate();
  const cells=[]; for(let i=0;i<startOff;i++) cells.push(null); for(let d=1;d<=last;d++) cells.push(y+'-'+pad(m)+'-'+pad(d)); while(cells.length%7) cells.push(null);
  const dia=k=>{ const ps=S.pedidos.filter(p=>p.retirada===k&&p.status!=='cancelado'); return {n:ps.length,q:ps.reduce((a,p)=>a+p.total_qtd,0)}; };
  const c=S.config, esps=c.especiais||[];
  const btn=k=>{ if(!k) return '<span></span>'; const r=regraData(k), esp=esps.indexOf(k)>=0, x=dia(k);
    return `<button type="button" data-act="cal-dia" data-d="${k}" class="${r==='bloqueada'?'blk':r==='fechado'?'closed':''} ${esp?'esp':''} ${k===n?'today':''} ${k===ui.cal.sel?'sel':''} ${k<n?'out':''}" aria-label="${dBr(k)}${r==='bloqueada'?', bloqueada':''}${x.n?', '+x.n+' pedidos':''}"><span class="n">${Number(k.slice(8))}</span>${x.n?`<span class="c">${x.n} ped.</span><span class="muted">${num(x.q)} un</span>`:''}</button>`; };
  const k=ui.cal.sel, dw=pKey(k).getDay(), blk=S.bloqueadas.find(b=>b.data===k), esp=esps.indexOf(k)>=0, regular=dw===0?c.domingo:c.dias.indexOf(dw)>=0;
  const ps=S.pedidos.filter(p=>p.retirada===k).sort((a,b)=>a.numero-b.numero), ativos=ps.filter(p=>p.status!=='cancelado');
  const prod=resumo(ativos,ordemDe).sab.sort((a,b)=>a.ord-b.ord);
  return `<div class="page-head"><div><h1>Calendário</h1><p>Pedidos por data de retirada. Toque em um dia para ver a produção, bloquear ou liberar.</p></div></div>
  <section class="card"><div class="navrow"><button class="btn small" type="button" data-act="cal-nav" data-d="-1" aria-label="Mês anterior">‹</button><strong>${cap(MESES[m-1])} de ${y}</strong><button class="btn small" type="button" data-act="cal-nav" data-d="1" aria-label="Próximo mês">›</button></div>
    <div class="cal">${DOW.map(d=>`<span class="hd">${d}</span>`).join('')}${cells.map(btn).join('')}</div>
    <div class="legend"><span><i style="border:2px solid var(--accent)"></i>hoje</span><span><i style="background:repeating-linear-gradient(135deg,var(--bad-bg),var(--bad-bg) 3px,var(--surface) 3px,var(--surface) 6px);border-color:var(--bad)"></i>bloqueada</span><span><i style="background:var(--surface-2)"></i>sem atendimento</span><span><i style="border:1px dashed var(--ok)"></i>data especial</span></div></section>
  <section class="card"><div class="card-head"><div><h2>${cap(DOWL[dw])}, ${dBr(k)}</h2><span class="muted" style="font-size:13px">${blk?'Bloqueada'+(blk.motivo?': '+esc(blk.motivo):''):(regular||esp)?'Dia de atendimento':'Sem atendimento'}</span></div>
    <div class="actions">${k>=n?(blk?`<button class="btn" type="button" data-act="liberar" data-d="${k}">Liberar data</button>`:`<button class="btn danger" type="button" data-act="bloquear" data-d="${k}">Bloquear data</button>`):''}
    ${k>=n&&!regular?(esp?`<button class="btn" type="button" data-act="esp-off" data-d="${k}">Fechar data especial</button>`:`<button class="btn" type="button" data-act="esp-on" data-d="${k}">Abrir como data especial</button>`):''}</div></div>
    <h3 style="font-size:14px">Produção do dia · ${num(ativos.reduce((a,p)=>a+p.total_qtd,0))} pastéis</h3>
    ${prod.length?`<div class="tw"><table><thead><tr><th>Sabor</th><th class="num">Quantidade</th></tr></thead><tbody>${prod.map(x=>`<tr><td>${esc(x.nome)}</td><td class="num"><strong>${num(x.qtd)}</strong></td></tr>`).join('')}</tbody></table></div>
      <div><button class="btn small" type="button" data-act="copiar-prod" data-d="${k}">Copiar produção do dia</button></div>`:'<p class="empty">Nenhum pedido para esta data.</p>'}
    <h3 style="font-size:14px">Pedidos (${ps.length})</h3>
    ${ps.length?`<div class="tw"><table><thead><tr><th>Pedido</th><th>Cliente</th><th class="num">Pastéis</th><th>Situação</th></tr></thead><tbody>${ps.map(p=>`<tr><td><button class="link mono" type="button" data-act="ped" data-id="${p.id}">nº ${nPed(p.numero)}</button></td><td>${esc(p.cliente_nome)}</td><td class="num">${num(p.total_qtd)}</td><td><span class="pill ${ST[p.status].c}">${ST[p.status].t}</span></td></tr>`).join('')}</tbody></table></div>`:''}
  </section>`;
}
function dlgBloquear(d){
  const n=S.pedidos.filter(p=>p.retirada===d&&p.status!=='cancelado').length;
  openDlg('Bloquear '+dBr(d),`<label class="field">Motivo (opcional)<input name="m" placeholder="Ex.: feriado, manutenção"></label>${n?`<div class="warnbox">Já existem ${n} pedido${n>1?'s':''} para esta data. Eles continuam valendo; o bloqueio só impede pedidos novos.</div>`:''}`,
  {ok:'Bloquear',onOk:async fd=>{ await q(sb.from('datas_bloqueadas').upsert({data:d,motivo:String(fd.get('m')||'').trim()})); await recarregaConfig(); render(); toast('Data '+dShort(d)+' bloqueada.'); return null; }});
}

/* ----- clientes ----- */
function aClientes(){
  const total=S.sabores.filter(s=>!s.excluido).length;
  return `<div class="page-head"><div><h1>Clientes</h1><p>Acesso, catálogo e preços de cada cliente.</p></div><button class="btn primary" type="button" data-act="cli-edit" data-id="">Novo cliente</button></div>
  <section class="card">${S.clientes.length?`<div class="tw"><table><thead><tr><th>Cliente</th><th>Usuário</th><th>WhatsApp</th><th class="num">Sabores liberados</th><th class="num">Pedidos</th><th>Acesso</th><th></th></tr></thead><tbody>
  ${S.clientes.map(c=>`<tr class="${c.bloqueado?'dim':''}"><td><strong>${esc(c.nome)}</strong>${c.contato?`<br><span class="muted">${esc(c.contato)}</span>`:''}</td><td class="mono">${esc(c.usuario)}</td><td class="nowrap">${esc(c.telefone||'—')}</td><td class="num">${catDe(c).length} de ${total}</td><td class="num">${S.pedidos.filter(p=>p.cliente_id===c.id).length}</td>
    <td>${c.bloqueado?'<span class="pill bad">Bloqueado</span>':'<span class="pill ok">Liberado</span>'}</td><td class="nowrap"><button class="link" type="button" data-act="cli-edit" data-id="${c.id}">Dados e acesso</button> · <button class="link" type="button" data-act="cli-cat" data-id="${c.id}">Catálogo e preços</button> · <button class="link" type="button" data-act="cli-peds" data-id="${c.id}">Pedidos</button></td></tr>`).join('')}
  </tbody></table></div>`:'<p class="empty">Nenhum cliente ainda. Toque em “Novo cliente” para criar o primeiro acesso.</p>'}</section>`;
}
const USR=/^[a-z0-9._-]{3,30}$/;
function dlgCliente(id){
  const c=id?S.clientes.find(x=>x.id===id):{id:'',nome:'',contato:'',telefone:'',usuario:'',bloqueado:false};
  openDlg(id?'Dados e acesso':'Novo cliente',`
    <label class="field">Nome do cliente<input name="nome" value="${esc(c.nome)}"></label>
    <div class="row2"><label class="field">Pessoa de contato<input name="contato" value="${esc(c.contato||'')}"></label><label class="field">WhatsApp<input name="tel" value="${esc(c.telefone||'')}" inputmode="tel"></label></div>
    <div class="row2"><label class="field">Usuário de acesso<input name="u" value="${esc(c.usuario)}" autocapitalize="none" spellcheck="false" placeholder="ex.: padaria"></label><label class="field">${id?'Nova senha (vazio = manter)':'Senha'}<input name="p" autocomplete="off" placeholder="${id?'':'mín. 4 caracteres'}"></label></div>
    <div><button class="btn small" type="button" data-act="gera-senha">Gerar senha</button></div>
    <label class="check"><input type="checkbox" name="blk" ${c.bloqueado?'checked':''}> Bloquear acesso deste cliente</label>
    <p class="muted" style="margin:0;font-size:13px">Anote a senha antes de salvar: depois ela fica guardada cifrada e não aparece mais.${id?' Ao trocar a senha ou bloquear, o cliente sai do site.':''}</p>`,
  {ok:'Salvar',onOk:async fd=>{
    const nome=String(fd.get('nome')||'').trim(), u=String(fd.get('u')||'').trim().toLowerCase(), p=String(fd.get('p')||'').trim();
    if(nome.length<2) return 'Informe o nome do cliente.';
    if(!USR.test(u)) return 'Usuário: de 3 a 30 letras minúsculas, números, ponto, hífen ou sublinhado, sem espaços.';
    if(!id&&p.length<4) return 'A senha precisa ter pelo menos 4 caracteres.';
    if(id&&p&&p.length<4) return 'A nova senha precisa ter pelo menos 4 caracteres.';
    const nid=await q(sb.rpc('admin_salvar_cliente',{p:{id:id||null,nome:nome,contato:String(fd.get('contato')||'').trim(),telefone:String(fd.get('tel')||'').trim(),usuario:u,senha:p||null,bloqueado:!!fd.get('blk')}}));
    await recarregaClientes(); render();
    const link=CFG.site||(location.origin+location.pathname.replace(/admin\/(index\.html)?$/,''));
    if(!id){ aoFecharDlg=()=>dlgAcesso(nid,u,p,link); }
    else if(p) aoFecharDlg=()=>dlgAcesso(nid,u,p,link);
    toast(id?'Cliente atualizado.':'Cliente criado.'); return null;
  }});
}
function dlgAcesso(id,u,p,link){
  const c=S.clientes.find(x=>x.id===id); const site=/^https?:/.test(link)&&!/localhost|capacitor|file:/.test(link)?link:'(endereço do site)';
  const txt='Olá, '+(c.contato||c.nome)+'! Seu acesso para fazer pedidos na Japinha San:\n'+site+'\nUsuário: '+u+'\nSenha: '+p;
  openDlg('Acesso de '+c.nome,`<p style="margin:0">Envie o usuário e a senha para o cliente:</p><pre class="mono" style="white-space:pre-wrap;background:var(--surface-2);padding:12px;border-radius:8px;margin:0">${esc(txt)}</pre>
    <div class="actions">${c.telefone?`<a class="btn primary" href="${esc(waLink(c.telefone,txt))}" target="_blank" rel="noopener">Enviar no WhatsApp</a>`:''}<button class="btn" type="button" data-act="copiar-txt" data-txt="${esc(txt)}">Copiar</button><button class="btn" type="button" data-act="cli-cat" data-id="${c.id}">Definir catálogo</button></div>`);
}
function dlgCatalogo(id){
  const c=S.clientes.find(x=>x.id===id), outros=S.clientes.filter(x=>x.id!==id);
  openDlg('Catálogo · '+c.nome,`<p class="muted" style="margin:0;font-size:13px">Marque os sabores que este cliente pode ver e comprar. Preço vazio = preço padrão. Sabores pausados não aparecem para ninguém até serem reativados.</p>
    <div class="actions"><button class="btn small" type="button" data-act="cat-todos" data-v="1">Liberar todos</button><button class="btn small" type="button" data-act="cat-todos" data-v="0">Desmarcar todos</button>
    ${outros.length?`<select class="price-in" style="width:auto" id="catCopia" aria-label="Copiar catálogo de"><option value="">Copiar de outro cliente…</option>${outros.map(o=>`<option value="${o.id}">${esc(o.nome)}</option>`).join('')}</select>`:''}</div>
    <ul class="catgrid">${sabOrd().map(s=>{ const lib=c.catalogo[s.id]!==undefined, pr=c.catalogo[s.id];
      return `<li class="${lib?'':'off'}"><input type="checkbox" name="lib_${s.id}" ${lib?'checked':''} aria-label="Liberar ${esc(s.nome)}"><span><span class="nm">${esc(s.nome)}</span>${s.ativo?'':' <span class="pill warn">pausado</span>'}<br><small class="muted">padrão ${brl(s.preco)}</small></span><input class="price-in" name="pr_${s.id}" value="${pr!=null?moneyIn(pr):''}" placeholder="${moneyIn(s.preco)}" inputmode="decimal" aria-label="Preço de ${esc(s.nome)} para ${esc(c.nome)}"></li>`; }).join('')}</ul>`,
  {size:'wide',ok:'Salvar catálogo',onOk:async fd=>{
    const itens=[];
    for(const s of sabOrd()){ if(!fd.get('lib_'+s.id)) continue; const v=parseMoney(fd.get('pr_'+s.id)); if(isNaN(v)) return 'Preço inválido em '+s.nome+'.'; itens.push({sabor_id:s.id,preco:v==null?null:v}); }
    await q(sb.rpc('admin_salvar_catalogo',{p_cliente:c.id,p_itens:itens})); await recarregaClientes(); render(); toast('Catálogo de '+c.nome+' salvo: '+itens.length+' sabores.'); return null;
  }});
}

/* ----- sabores ----- */
function aSabores(){
  const L=sabOrd();
  return `<div class="page-head"><div><h1>Sabores</h1><p>Preço padrão, pausa e quem tem acesso a cada sabor.</p></div><button class="btn primary" type="button" data-act="sab-edit" data-id="">Novo sabor</button></div>
  <section class="card"><div class="tw"><table><thead><tr><th>Nº</th><th>Sabor</th><th class="num">Preço padrão</th><th class="num">Clientes com acesso</th><th>Situação</th><th></th></tr></thead><tbody>
  ${L.map(s=>{ const cs=S.clientes.filter(c=>c.catalogo[s.id]!==undefined); return `<tr class="${s.ativo?'':'dim'}"><td class="num">${s.ordem}</td><td><strong>${esc(s.nome)}</strong>${s.descricao?`<br><small class="muted">${esc(s.descricao)}</small>`:''}</td><td class="num money">${brl(s.preco)}</td><td class="num">${cs.length}</td>
    <td>${s.ativo?'<span class="pill ok">Ativo</span>':'<span class="pill warn">Pausado</span>'}</td><td class="nowrap"><button class="link" type="button" data-act="sab-pausa" data-id="${s.id}">${s.ativo?'Pausar':'Reativar'}</button> · <button class="link" type="button" data-act="sab-edit" data-id="${s.id}">Editar</button></td></tr>`; }).join('')}
  </tbody></table></div></section>`;
}
function dlgSabor(id){
  const s=id?S.sabores.find(x=>x.id===id):{id:'',nome:'',descricao:'',preco:700,ativo:true,ordem:S.sabores.filter(x=>!x.excluido).length+1};
  const cs=id?S.clientes.filter(c=>c.catalogo[s.id]!==undefined):[];
  openDlg(id?'Editar sabor':'Novo sabor',`
    <label class="field">Nome<input name="nome" value="${esc(s.nome)}"></label>
    <label class="field">Descrição (opcional)<input name="desc" value="${esc(s.descricao||'')}"></label>
    <div class="row2 keep"><label class="field">Preço padrão (R$)<input name="preco" value="${moneyIn(s.preco)}" inputmode="decimal"></label><label class="field">Posição na lista<input name="ord" type="number" min="1" value="${s.ordem}"></label></div>
    <label class="check"><input type="checkbox" name="pausa" ${s.ativo?'':'checked'}> Pausado (some do catálogo de todos os clientes)</label>
    ${id?`<div class="note"><b>Clientes com acesso (${cs.length}):</b> ${cs.length?cs.map(c=>esc(c.nome)+(c.catalogo[s.id]!=null?' ('+brl(c.catalogo[s.id])+')':'')).join(', '):'nenhum'}</div>
    <div><button class="btn small danger" type="button" data-act="sab-del" data-id="${s.id}">Excluir sabor</button></div>`:(S.clientes.length?`<label class="check"><input type="checkbox" name="todos"> Liberar para todos os clientes</label>`:'')}`,
  {ok:'Salvar',onOk:async fd=>{
    const nome=String(fd.get('nome')||'').trim(), pr=parseMoney(fd.get('preco'));
    if(nome.length<2) return 'Informe o nome do sabor.'; if(pr==null||isNaN(pr)) return 'Informe um preço válido.';
    const dados={nome:nome,descricao:String(fd.get('desc')||'').trim(),preco:pr,ordem:Number(fd.get('ord'))||1,ativo:!fd.get('pausa')};
    if(id) await q(sb.from('sabores').update(dados).eq('id',id));
    else { const novo=await q(sb.from('sabores').insert(dados).select().single()); if(fd.get('todos')&&S.clientes.length) await q(sb.from('catalogo').insert(S.clientes.map(c=>({cliente_id:c.id,sabor_id:novo.id,preco:null})))); }
    await recarregaSabores(); if(!id) await recarregaClientes(); render(); toast('Sabor salvo.'); return null;
  }});
}

/* ----- relatórios ----- */
function periodoAdm(){
  const n=hojeSrv, r=ui.ar;
  if(r.per==='semana') return periodoRel('semana',n); if(r.per==='semana-1') return periodoRel('semana',addDays(n,-7));
  if(r.per==='mes') return periodoRel('mes',n); if(r.per==='mes-1'){ const d=pKey(n); return periodoRel('mes',dKey(new Date(d.getFullYear(),d.getMonth()-1,1))); }
  if(r.per==='prox7') return {de:n,ate:addDays(n,6),rot:'Próximos 7 dias'};
  return {de:r.de||n,ate:r.ate||n,rot:'De '+dShort(r.de||n)+' a '+dShort(r.ate||n)};
}
function pedidosPeriodo(){ const r=ui.ar, P=periodoAdm(), campo=p=>r.base==='retirada'?p.retirada:p.criado_em.slice(0,10); return {P:P,L:S.pedidos.filter(p=>p.status!=='cancelado'&&campo(p)>=P.de&&campo(p)<=P.ate)}; }
function aRelatorios(){
  const r=ui.ar, x=pedidosPeriodo(), P=x.P, L=x.L, R=resumo(L,ordemDe);
  const porCli=S.clientes.map(c=>{ const y=L.filter(p=>p.cliente_id===c.id); return {c:c,n:y.length,q:y.reduce((a,p)=>a+p.total_qtd,0),t:y.reduce((a,p)=>a+p.total,0)}; }).filter(o=>o.n).sort((a,b)=>b.t-a.t);
  const datas={}; L.forEach(p=>{ (datas[p.retirada]=datas[p.retirada]||[]).push(p); });
  const prodDatas=Object.keys(datas).sort().map(d=>({d:d,R:resumo(datas[d],ordemDe)}));
  const opt=(arr,cur)=>arr.map(o=>`<option value="${o[0]}" ${o[0]===cur?'selected':''}>${esc(o[1])}</option>`).join('');
  return `<div class="page-head"><div><h1>Relatórios</h1><p>${esc(P.rot)} · ${dBr(P.de)} a ${dBr(P.ate)} · sem pedidos cancelados</p></div></div>
  <section class="card"><div class="filters">
    <label class="field">Período<select data-ar="per">${opt([['semana','Esta semana'],['semana-1','Semana passada'],['mes','Este mês'],['mes-1','Mês passado'],['prox7','Próximos 7 dias'],['custom','Escolher datas']],r.per)}</select></label>
    ${r.per==='custom'?`<label class="field">De<input type="date" data-ar="de" value="${r.de||hojeSrv}"></label><label class="field">Até<input type="date" data-ar="ate" value="${r.ate||hojeSrv}"></label>`:''}
    <label class="field">Considerar a data<select data-ar="base">${opt([['retirada','de retirada'],['pedido','em que o pedido foi feito']],r.base)}</select></label></div>
    <div class="tiles"><div class="tile" style="--c:var(--ink)"><b>${R.n}</b><span>pedidos</span></div><div class="tile" style="--c:var(--accent)"><b>${num(R.qtd)}</b><span>pastéis</span></div><div class="tile" style="--c:var(--ok)"><b>${brl(R.total)}</b><span>faturamento</span></div><div class="tile" style="--c:var(--warn)"><b>${R.n?brl(Math.round(R.total/R.n)):'—'}</b><span>valor médio por pedido</span></div></div></section>
  <section class="card"><div class="card-head"><h2>Por cliente</h2><button class="btn small" type="button" data-act="copiar-rel" data-k="cli">Copiar para o Excel</button></div>${porCli.length?`<div class="tw"><table><thead><tr><th>Cliente</th><th class="num">Pedidos</th><th class="num">Pastéis</th><th class="num">Faturamento</th></tr></thead><tbody>${porCli.map(o=>`<tr><td>${esc(o.c.nome)}</td><td class="num">${o.n}</td><td class="num">${num(o.q)}</td><td class="num money">${brl(o.t)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="empty">Sem pedidos no período.</p>'}</section>
  <section class="card"><div class="card-head"><h2>Por sabor</h2><button class="btn small" type="button" data-act="copiar-rel" data-k="sab">Copiar para o Excel</button></div>${R.sab.length?`<div class="tw"><table><thead><tr><th>Sabor</th><th class="num">Pastéis</th><th class="num">Valor</th></tr></thead><tbody>${R.sab.map(s=>`<tr><td>${esc(s.nome)}</td><td class="num">${num(s.qtd)}</td><td class="num money">${brl(s.total)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="empty">Sem pedidos no período.</p>'}</section>
  <section class="card"><h2>Produção por data de retirada</h2>${prodDatas.length?prodDatas.map(z=>`<details><summary><strong>${dDow(z.d)}</strong> · ${num(z.R.qtd)} pastéis · ${z.R.n} pedido${z.R.n>1?'s':''}</summary><ul class="lines" style="margin:8px 0 4px">${z.R.sab.sort((a,b)=>a.ord-b.ord).map(s=>`<li><span class="qt">${num(s.qtd)}</span><span>${esc(s.nome)}</span><span></span></li>`).join('')}</ul></details>`).join(''):'<p class="empty">Sem pedidos no período.</p>'}</section>
  <section class="card"><h2>Histórico de vendas</h2>${L.length?`<div class="tw"><table><thead><tr><th>Pedido</th><th>Cliente</th><th>Feito em</th><th>Retirada</th><th class="num">Pastéis</th><th class="num">Total</th><th>Situação</th></tr></thead><tbody>${L.slice().sort((a,b)=>a.numero-b.numero).map(p=>`<tr><td><button class="link mono" type="button" data-act="ped" data-id="${p.id}">nº ${nPed(p.numero)}</button></td><td>${esc(p.cliente_nome)}</td><td class="nowrap">${carBr(p.criado_em)}</td><td class="nowrap">${dDow(p.retirada)}</td><td class="num">${num(p.total_qtd)}</td><td class="num money">${brl(p.total)}</td><td><span class="pill ${ST[p.status].c}">${ST[p.status].t}</span></td></tr>`).join('')}</tbody></table></div>`:'<p class="empty">Sem pedidos no período.</p>'}</section>`;
}
function relTSV(k){
  const L=pedidosPeriodo().L, b=c=>(c/100).toFixed(2).replace('.',',');
  if(k==='sab') return ['Sabor\tPastéis\tValor'].concat(resumo(L,ordemDe).sab.map(x=>x.nome+'\t'+x.qtd+'\t'+b(x.total))).join('\n');
  return ['Cliente\tPedidos\tPastéis\tFaturamento'].concat(S.clientes.map(c=>{ const y=L.filter(p=>p.cliente_id===c.id); return y.length?c.nome+'\t'+y.length+'\t'+y.reduce((a,p)=>a+p.total_qtd,0)+'\t'+b(y.reduce((a,p)=>a+p.total,0)):null; }).filter(Boolean)).join('\n');
}

/* ----- ajustes ----- */
function aAjustes(){
  const c=S.config;
  return `<div class="page-head"><div><h1>Ajustes</h1><p>Aprovação, regras de data e dados da empresa.</p></div></div>
  <div class="cfg">
    <section class="card"><h2>Aprovação de pedidos</h2><form id="cfgAprov" novalidate>
      <label class="check"><input type="radio" name="ap" value="manual" ${c.aprovacao==='manual'?'checked':''}> <span><b>Manual</b> · todo pedido entra como pendente e espera sua aprovação</span></label>
      <label class="check"><input type="radio" name="ap" value="auto" ${c.aprovacao==='auto'?'checked':''}> <span><b>Automática</b> · o pedido é confirmado assim que o cliente finaliza</span></label>
      <p class="form-err" role="alert"></p><button class="btn primary" type="submit" style="align-self:flex-start">Salvar</button></form></section>
    <section class="card"><h2>Datas e horário</h2><form id="cfgDatas" novalidate>
      <div class="row2 keep"><label class="field">Horário limite para o mesmo dia<input type="time" name="corte" value="${esc(c.corte)}"></label><label class="field">Datas oferecidas ao cliente (dias)<input type="number" name="dias" min="1" max="60" value="${c.dias_oferecidos}"></label></div>
      <div class="field">Dias regulares de atendimento<div class="tags">${[1,2,3,4,5,6].map(i=>`<label class="check"><input type="checkbox" name="d${i}" ${c.dias.indexOf(i)>=0?'checked':''}> ${DOW[i]}</label>`).join('')}</div></div>
      <label class="check"><input type="checkbox" name="dom" ${c.domingo?'checked':''}> Permitir retirada aos domingos (pedido até sábado no horário limite)</label>
      <p class="form-err" role="alert"></p><button class="btn primary" type="submit" style="align-self:flex-start">Salvar</button></form></section>
    <section class="card"><h2>Datas bloqueadas</h2>${S.bloqueadas.length?`<ul class="hist" style="font-size:14px;color:var(--ink)">${S.bloqueadas.slice().sort((a,b)=>a.data<b.data?-1:1).map(b=>`<li>${dBr(b.data)}${b.motivo?' · '+esc(b.motivo):''} · <button class="link" type="button" data-act="liberar" data-d="${b.data}">Liberar</button></li>`).join('')}</ul>`:'<p class="empty">Nenhuma data bloqueada.</p>'}
      <p class="muted" style="margin:0;font-size:13px">Para bloquear uma data, toque nela no Calendário.</p></section>
    <section class="card"><h2>Empresa</h2><form id="cfgEmp" novalidate>
      <label class="field">Nome da empresa<input name="emp" value="${esc(c.empresa)}"></label>
      <label class="field">WhatsApp da administração (cancelamentos e senha esquecida)<input name="wa" value="${esc(c.whatsapp)}" inputmode="tel" placeholder="(11) 90000-0000"></label>
      <p class="form-err" role="alert"></p><button class="btn primary" type="submit" style="align-self:flex-start">Salvar</button></form></section>
    <section class="card"><h2>Minha senha</h2><form id="cfgSenha" novalidate>
      <p class="muted" style="margin:0;font-size:13px">Usuário: ${esc(nomeUsuario())}</p>
      <div class="row2"><label class="field">Nova senha<input name="p1" type="password" autocomplete="new-password"></label><label class="field">Repita<input name="p2" type="password" autocomplete="new-password"></label></div>
      <p class="form-err" role="alert"></p><button class="btn primary" type="submit" style="align-self:flex-start">Trocar senha</button></form></section>
  </div>`;
}

/* ----- eventos ----- */
const FORMS={
  loginF:login,
  cfgAprov:async fd=>{ await q(sb.from('config').update({aprovacao:fd.get('ap')==='auto'?'auto':'manual'}).eq('id',1)); await recarregaConfig(); render(); toast('Modo de aprovação salvo.'); return null; },
  cfgDatas:async fd=>{ const dias=[1,2,3,4,5,6].filter(i=>fd.get('d'+i)), corte=fd.get('corte'), nd=Number(fd.get('dias')); if(!corte) return 'Informe o horário limite.'; if(!(nd>=1&&nd<=60)) return 'Datas oferecidas: de 1 a 60 dias.';
    await q(sb.from('config').update({dias:dias,corte:corte,domingo:!!fd.get('dom'),dias_oferecidos:nd}).eq('id',1)); await recarregaConfig(); render(); toast('Regras de data salvas.'); return null; },
  cfgEmp:async fd=>{ const emp=String(fd.get('emp')||'').trim(); if(emp.length<2) return 'Informe o nome da empresa.'; await q(sb.from('config').update({empresa:emp,whatsapp:String(fd.get('wa')||'').trim()}).eq('id',1)); await recarregaConfig(); render(); toast('Dados salvos.'); return null; },
  cfgSenha:async fd=>{ const a=String(fd.get('p1')||''), b=String(fd.get('p2')||''); if(a.length<8) return 'A senha precisa ter pelo menos 8 caracteres.'; if(a!==b) return 'As duas senhas não são iguais.'; const r=await sb.auth.updateUser({password:a}); if(r.error) return msgErro(r.error); toast('Senha trocada.'); render(); return null; }
};
document.addEventListener('submit',async ev=>{
  const f=ev.target, fn=FORMS[f.id]; if(!fn) return; ev.preventDefault();
  const btn=f.querySelector('[type=submit]'), el=f.querySelector('.form-err'); btn.disabled=true; if(el) el.textContent='';
  let err; try{ err=await fn(new FormData(f)); }catch(e){ err=msgErro(e); }
  if(document.body.contains(btn)) btn.disabled=false; if(err&&el&&document.body.contains(el)) el.textContent=err;
});
async function acao(fn){ try{ await fn(); }catch(e){ toast(msgErro(e)); } }
document.addEventListener('click',ev=>{
  const b=ev.target.closest('[data-act]'); if(!b) return; const a=b.dataset.act, id=b.dataset.id, ped=()=>S.pedidos.find(x=>x.id===id);
  if(a==='sair') sair();
  else if(a==='tentar') entrar();
  else if(a==='atualizar') acao(async()=>{ const n=await recarregaPedidos(true); render(); if(!n) toast('Pedidos atualizados.'); });
  else if(a==='filtro-pend'){ ui.af={st:'pendente',cli:'todos',per:'todas'}; render(); }
  else if(a==='ped') dlgPedido(id);
  else if(a==='avancar') acao(async()=>{ const p=ped(), nx=FLUXO[p.status]; if(!nx) return; b.disabled=true; await mudaStatus(p,nx[0]); const inDlg=!$('#dlg').hidden; render(); if(inDlg) dlgPedido(id); toast('Pedido nº '+nPed(p.numero)+': '+ST[nx[0]].t+'.'); });
  else if(a==='cancelar') dlgCancelar(id);
  else if(a==='copiar-comp') copyText(comprovanteTxt(ped(),S.config.empresa),b);
  else if(a==='copiar-txt') copyText(b.dataset.txt,b);
  else if(a==='cal-dia'){ ui.cal.sel=b.dataset.d; render(); }
  else if(a==='cal-nav'){ const [y,m]=ui.cal.mes.split('-').map(Number); ui.cal.mes=dKey(new Date(y,m-1+Number(b.dataset.d),1)).slice(0,7); render(); }
  else if(a==='bloquear') dlgBloquear(b.dataset.d);
  else if(a==='liberar') acao(async()=>{ await q(sb.from('datas_bloqueadas').delete().eq('data',b.dataset.d)); await recarregaConfig(); render(); toast('Data '+dShort(b.dataset.d)+' liberada.'); });
  else if(a==='esp-on') acao(async()=>{ await q(sb.from('config').update({especiais:(S.config.especiais||[]).concat([b.dataset.d])}).eq('id',1)); await recarregaConfig(); render(); toast('Data especial aberta para pedidos.'); });
  else if(a==='esp-off') acao(async()=>{ await q(sb.from('config').update({especiais:(S.config.especiais||[]).filter(x=>x!==b.dataset.d)}).eq('id',1)); await recarregaConfig(); render(); });
  else if(a==='copiar-prod'){ const d=b.dataset.d; const R=resumo(S.pedidos.filter(p=>p.retirada===d&&p.status!=='cancelado'),ordemDe); copyText('Produção '+dBr(d)+' · '+R.qtd+' pastéis\n'+R.sab.sort((x,y)=>x.ord-y.ord).map(s=>s.qtd+'  '+s.nome).join('\n'),b); }
  else if(a==='cli-edit') dlgCliente(id);
  else if(a==='cli-cat') dlgCatalogo(id);
  else if(a==='cli-peds'){ ui.af={st:'todos',cli:id,per:'todas'}; go('pedidos'); }
  else if(a==='gera-senha'){ const f=$('#dlgF'); if(f&&f.p){ const a2=new Uint32Array(1); crypto.getRandomValues(a2); f.p.value=String(100000+a2[0]%900000); } }
  else if(a==='cat-todos'){ document.querySelectorAll('#dlgF .catgrid input[type=checkbox]').forEach(x=>{ x.checked=b.dataset.v==='1'; x.closest('li').classList.toggle('off',!x.checked); }); }
  else if(a==='sab-edit') dlgSabor(id);
  else if(a==='sab-pausa') acao(async()=>{ const s=S.sabores.find(x=>x.id===id); await q(sb.from('sabores').update({ativo:!s.ativo}).eq('id',id)); await recarregaSabores(); render(); toast(s.nome+(s.ativo?' pausado: sumiu do catálogo dos clientes.':' reativado.')); });
  else if(a==='sab-del'){ const s=S.sabores.find(x=>x.id===id); closeDlg(); openDlg('Excluir '+s.nome+'?','<p style="margin:0">O sabor sai do cadastro e do catálogo de todos os clientes. Pedidos antigos continuam mostrando o sabor e o preço da época.</p>',{ok:'Excluir',onOk:async()=>{ await q(sb.rpc('admin_excluir_sabor',{p_sabor:id})); await recarregaSabores(); await recarregaClientes(); render(); toast(s.nome+' excluído.'); return null; }}); }
  else if(a==='copiar-rel') copyText(relTSV(b.dataset.k),b);
});
document.addEventListener('change',ev=>{
  const t=ev.target;
  if(t.dataset.af){ ui.af[t.dataset.af]=t.value; render(); }
  else if(t.dataset.ar){ ui.ar[t.dataset.ar]=t.value; render(); }
  else if(t.id==='catCopia'&&t.value){ const o=S.clientes.find(x=>x.id===t.value); document.querySelectorAll('#dlgF .catgrid li').forEach(li=>{ const cb=li.querySelector('input[type=checkbox]'), pr=li.querySelector('.price-in'), sid=cb.name.slice(4); const lib=o.catalogo[sid]!==undefined; cb.checked=lib; li.classList.toggle('off',!lib); pr.value=lib&&o.catalogo[sid]!=null?moneyIn(o.catalogo[sid]):''; }); toast('Catálogo de '+o.nome+' copiado. Salve para confirmar.'); t.value=''; }
  else if(t.type==='checkbox'&&t.name&&t.name.indexOf('lib_')===0) t.closest('li').classList.toggle('off',!t.checked);
});
document.addEventListener('keydown',ev=>{ if(ev.key==='Escape'&&!$('#dlg').hidden) closeDlg(); });
window.addEventListener('hashchange',route);
async function autoAtualiza(){ if(estado!=='ok'||document.hidden||!$('#dlg').hidden) return; const foco=document.activeElement&&/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName); try{ const n=await recarregaPedidos(true); if((n||ui.v==='pedidos'||ui.v==='calendario')&&!foco) render(); }catch(e){} }
setInterval(autoAtualiza,30000);
document.addEventListener('visibilitychange',autoAtualiza);
iniciar();
