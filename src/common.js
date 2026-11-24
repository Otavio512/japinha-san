/* ---------- utilidades compartilhadas (portal e administração) ---------- */
const CFG=window.JS_CONFIG||{};
const DOW=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const DOWL=['domingo','segunda','terça','quarta','quinta','sexta','sábado'];
const MESES=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const $=s=>document.querySelector(s);
const pad=n=>String(n).padStart(2,'0');
const dKey=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const pKey=k=>{ const p=String(k).slice(0,10).split('-').map(Number); return new Date(p[0],p[1]-1,p[2]); };
const addDays=(k,n)=>{ const d=pKey(k); d.setDate(d.getDate()+n); return dKey(d); };
const dBr=k=>{ const d=pKey(k); return pad(d.getDate())+'/'+pad(d.getMonth()+1)+'/'+d.getFullYear(); };
const dShort=k=>{ const d=pKey(k); return pad(d.getDate())+'/'+pad(d.getMonth()+1); };
const dDow=k=>DOW[pKey(k).getDay()]+' '+dShort(k);
const cap=s=>s?s.charAt(0).toUpperCase()+s.slice(1):s;
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const brl=c=>(c<0?'−':'')+'R$ '+(Math.abs(c||0)/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const moneyIn=c=>c==null?'':(c/100).toFixed(2).replace('.',',');
function parseMoney(s){ s=String(s==null?'':s).trim().replace(/R\$|\s/g,''); if(!s) return null; if(s.indexOf(',')>=0) s=s.replace(/\./g,'').replace(',','.'); const v=Number(s); if(!isFinite(v)||v<0) return NaN; return Math.round(v*100); }
function parseInt0(s){ s=String(s==null?'':s).replace(/\D/g,''); return s?Math.min(99999,parseInt(s,10)):0; }
const num=n=>Number(n||0).toLocaleString('pt-BR');
const nPed=n=>String(n).padStart(4,'0');
const carBr=s=>s?dBr(s.slice(0,10))+' às '+s.slice(11,16):'—';
/* hora de Brasília deste aparelho, só para exibição; as regras valem pelo relógio do servidor */
function agoraLocal(){ const o={}; new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).forEach(x=>{ o[x.type]=x.value; }); return o.year+'-'+o.month+'-'+o.day+' '+o.hour+':'+o.minute; }
function isoSP(iso){ const o={}; new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(iso)).forEach(x=>{ o[x.type]=x.value; }); return o.year+'-'+o.month+'-'+o.day+' '+o.hour+':'+o.minute; }
const ST={pendente:{t:'Pendente',c:'warn'},confirmado:{t:'Confirmado',c:'info'},em_preparacao:{t:'Em preparação',c:'ok'},concluido:{t:'Concluído',c:'done'},cancelado:{t:'Cancelado',c:'off'}};
const waLink=(tel,txt)=>{ let d=String(tel||'').replace(/\D/g,''); if(d&&d.length<=11) d='55'+d; return 'https://wa.me/'+d+'?text='+encodeURIComponent(txt); };
function labelTables(root){
  (root||document).querySelectorAll('table:not(.no-rt)').forEach(t=>{
    t.classList.add('rt'); const heads=[...t.querySelectorAll('thead th')].map(th=>th.textContent.trim());
    t.querySelectorAll('tbody tr, tfoot tr').forEach(tr=>{ let col=0; const cells=[...tr.children];
      cells.forEach((td,i)=>{ const span=Number(td.getAttribute('colspan')||1); td.setAttribute('data-label',span>1||!heads.length?'':(heads[col]||''));
        if(i===0&&heads.length&&cells.length>2) td.classList.add('first'); if(i===cells.length-1&&cells.length>2&&!heads[col]) td.classList.add('last'); col+=span; }); });
  });
}
let toastT=null;
function toast(m){ const t=$('#toast'); t.textContent=m; t.hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>{ t.hidden=true; },4200); }
function openDlg(title,html,opt){
  opt=opt||{}; const d=$('#dlg');
  d.innerHTML=`<div class="dlg-back"></div><div class="dlg-box ${opt.size||''}" role="dialog" aria-modal="true" aria-labelledby="dlgT"><h2 id="dlgT">${esc(title)}</h2>
    <form id="dlgF" novalidate>${html}<p class="form-err" id="dlgErr" role="alert"></p>
    <div class="dlg-actions"><button type="button" class="btn ghost" data-close>${opt.onOk?'Cancelar':'Fechar'}</button>${opt.onOk?`<button type="submit" class="btn primary">${esc(opt.ok||'Salvar')}</button>`:''}</div></form></div>`;
  d.hidden=false; labelTables(d);
  d.querySelector('[data-close]').onclick=closeDlg; d.querySelector('.dlg-back').onclick=closeDlg;
  d.querySelector('#dlgF').onsubmit=async ev=>{ ev.preventDefault(); if(!opt.onOk) return closeDlg(); const btn=ev.target.querySelector('[type=submit]'); btn.disabled=true; $('#dlgErr').textContent='';
    let err; try{ err=await opt.onOk(new FormData(ev.target)); }catch(e){ err=msgErro(e); } btn.disabled=false; if(err) $('#dlgErr').textContent=err; else closeDlg(); };
  const f=d.querySelector('input:not([type=checkbox]):not([type=radio]),select,textarea'); if(f&&!opt.noFocus) f.focus();
}
let aoFecharDlg=null;
function closeDlg(){ const d=$('#dlg'); d.hidden=true; d.innerHTML=''; if(aoFecharDlg){ const f=aoFecharDlg; aoFecharDlg=null; f(); } }
function copyText(txt,btn){
  const fb=()=>openDlg('Copiar',`<label class="field">Selecione e copie<textarea readonly style="min-height:220px;font-family:var(--f-mono);font-size:12px">${esc(txt)}</textarea></label>`);
  try{ navigator.clipboard.writeText(txt).then(()=>{ const o=btn.textContent; btn.textContent='Copiado'; setTimeout(()=>{ if(document.body.contains(btn)) btn.textContent=o; },1800); },fb); }catch(e){ fb(); }
}
const ERROS={USUARIO_EXISTE:'Esse usuário já é de outro cliente.',SENHA_CURTA:'A senha precisa ter pelo menos 4 caracteres.',SENHA_OBRIGATORIA:'Defina uma senha para o cliente.',SEM_PERMISSAO:'Sua conta não tem permissão de administrador.',STATUS_INVALIDO:'Situação inválida.'};
function msgErro(e){
  const m=String((e&&(e.message||e.error_description))||e||'');
  for(const k in ERROS) if(m.indexOf(k)>=0) return ERROS[k];
  if(/Failed to fetch|NetworkError|network|fetch/i.test(m)) return 'Sem conexão com a internet. Confira e tente de novo.';
  if(/duplicate key/i.test(m)) return 'Já existe um registro igual.';
  return 'Não foi possível concluir: '+m;
}
function resumo(L,ordem){
  const por={}; let qtd=0,total=0;
  L.forEach(p=>{ qtd+=p.total_qtd; total+=p.total; p.itens.forEach(x=>{ const k=x.sabor_id; if(!por[k]) por[k]={id:k,nome:x.nome,qtd:0,total:0,ord:ordem?ordem(k):999}; por[k].qtd+=x.qtd; por[k].total+=x.subtotal; }); });
  return {qtd:qtd,total:total,n:L.length,sab:Object.values(por).sort((a,b)=>b.qtd-a.qtd||a.ord-b.ord)};
}
function periodoRel(tipo,ref){
  if(tipo==='semana'){ const dow=(pKey(ref).getDay()+6)%7; const ini=addDays(ref,-dow); return {de:ini,ate:addDays(ini,6),rot:'Semana de '+dShort(ini)+' a '+dShort(addDays(ini,6))}; }
  const p=ref.split('-'); const ini=p[0]+'-'+p[1]+'-01'; const fim=dKey(new Date(+p[0],+p[1],0)); return {de:ini,ate:fim,rot:cap(MESES[+p[1]-1])+' de '+p[0]};
}
function cardComprovante(p,admin){
  return `<section class="rcpt">
    <div class="rcpt-h"><div><span class="muted" style="font-size:13px">Pedido nº</span><br><b>${nPed(p.numero)}</b></div><span class="pill ${ST[p.status].c}">${ST[p.status].t}</span></div>
    <div class="kv"><div><span>Cliente</span>${esc(p.cliente_nome)}</div><div><span>Feito em</span>${carBr(p.criado_em)}</div><div><span>Retirada</span>${cap(DOWL[pKey(p.retirada).getDay()])}, ${dBr(p.retirada)}</div></div>
    <ul class="lines">${p.itens.map(x=>`<li><span class="qt">${num(x.qtd)}×</span><span>${esc(x.nome)}</span><span class="sb">${brl(x.subtotal)}</span><small>${brl(x.preco)} cada</small></li>`).join('')}</ul>
    <div class="sumline"><span>${num(p.total_qtd)} pastéis</span><span>${brl(p.total)}</span></div>
    ${admin?`<ul class="hist">${(p.historico||[]).map(h=>`<li>${carBr(h.quando)} · ${ST[h.status]?ST[h.status].t:esc(h.status)} · ${esc(h.por)}${h.motivo?' · '+esc(h.motivo):''}</li>`).join('')}</ul>`:''}
  </section>`;
}
function comprovanteTxt(p,empresa){
  const L=['*'+(empresa||'Japinha San')+'*','Pedido nº '+nPed(p.numero)+' · '+p.cliente_nome,'Feito em '+carBr(p.criado_em),'Retirada: '+DOWL[pKey(p.retirada).getDay()]+', '+dBr(p.retirada),''];
  p.itens.forEach(x=>L.push(num(x.qtd)+'× '+x.nome+' · '+brl(x.preco)+' = '+brl(x.subtotal)));
  L.push('','Total: '+num(p.total_qtd)+' pastéis · *'+brl(p.total)+'*','Situação: '+ST[p.status].t); return L.join('\n');
}
const LOGO=`<svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="9" fill="#141414"/><circle cx="20" cy="20" r="12.5" fill="#D7192A"/><text x="20" y="24.6" text-anchor="middle" font-family="Barlow Condensed,Arial Narrow,sans-serif" font-weight="700" font-size="14" fill="#fff" letter-spacing=".5">JS</text></svg>`;
function semConfig(){ return !CFG.url||!CFG.key||!window.supabase; }
