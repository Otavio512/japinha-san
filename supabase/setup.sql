-- =====================================================================
--  JAPINHA SAN · Sistema de Pedidos · estrutura do banco (Supabase)
--  Cole este arquivo inteiro no Supabase: SQL Editor → New query → Run.
--  Pode rodar de novo sem perder dados (só recria regras e funções).
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- tabelas ----------
create table if not exists public.config (
  id int primary key default 1 check (id = 1),
  empresa text not null default 'Japinha San',
  whatsapp text not null default '',
  aprovacao text not null default 'manual' check (aprovacao in ('manual','auto')),
  corte time not null default '08:00',
  dias int[] not null default '{1,2,3,4,5,6}',
  domingo boolean not null default true,
  dias_oferecidos int not null default 21 check (dias_oferecidos between 1 and 60),
  especiais date[] not null default '{}'
);
insert into public.config (id) values (1) on conflict (id) do nothing;

create table if not exists public.datas_bloqueadas (
  data date primary key,
  motivo text not null default ''
);

create table if not exists public.sabores (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 1 and 80),
  descricao text not null default '',
  preco int not null check (preco >= 0),              -- centavos
  ordem int not null default 999,
  ativo boolean not null default true,               -- false = pausado
  excluido boolean not null default false,
  criado_em timestamptz not null default now()
);

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 1 and 120),
  contato text not null default '',
  telefone text not null default '',
  usuario text not null unique check (usuario ~ '^[a-z0-9._-]{3,30}$'),
  senha_hash text not null,
  bloqueado boolean not null default false,
  criado_em timestamptz not null default now()
);

create table if not exists public.catalogo (
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  sabor_id uuid not null references public.sabores(id) on delete cascade,
  preco int check (preco is null or preco >= 0),     -- null = preço padrão do sabor
  primary key (cliente_id, sabor_id)
);

create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity unique,
  cliente_id uuid not null references public.clientes(id),
  cliente_nome text not null,
  criado_em timestamptz not null default now(),
  retirada date not null,
  itens jsonb not null,                              -- preços congelados no momento do pedido
  total_qtd int not null,
  total int not null,
  status text not null check (status in ('pendente','confirmado','em_preparacao','concluido','cancelado')),
  historico jsonb not null default '[]'
);
create index if not exists pedidos_retirada_idx on public.pedidos (retirada);
create index if not exists pedidos_cliente_idx on public.pedidos (cliente_id, criado_em desc);

create table if not exists public.sessoes (
  token uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  criado_em timestamptz not null default now(),
  expira timestamptz not null default now() + interval '60 days'
);

create table if not exists public.tentativas_login (
  usuario text not null,
  quando timestamptz not null default now()
);

create table if not exists public.admins (
  user_id uuid primary key,
  criado_em timestamptz not null default now()
);

-- sabores iniciais (só entram se a tabela estiver vazia)
insert into public.sabores (nome, descricao, preco, ordem)
select * from (values
  ('Carne','',700,1),
  ('Carne com queijo','',700,2),
  ('Queijo','',700,3),
  ('Pizza','',700,4),
  ('Calabresa com queijo','',700,5),
  ('Calabresa com catupiry','',700,6),
  ('Carne com catupiry','',700,7),
  ('Mini especial de carne','carne, queijo, tomate, calabresa, azeitonas e ovos cozidos',750,8),
  ('Mini de carne','',700,9),
  ('Palmito','',700,10),
  ('Palmito com queijo','',700,11),
  ('Bauru','',700,12),
  ('4 queijos','mussarela, catupiry, queijo branco e parmesão',700,13),
  ('Salame com queijo','',700,14),
  ('Bacon com queijo','',700,15),
  ('Carne seca com queijo','',700,16),
  ('Escarola com queijo','',700,17),
  ('Bacalhau','',750,18),
  ('Camarão com queijo','',750,19),
  ('Camarão com catupiry','',750,20),
  ('Frango puro','',700,21),
  ('Frango com queijo','',700,22),
  ('Frango com catupiry','',700,23),
  ('Mini especial de frango','frango, queijo, tomate, calabresa, azeitonas e ovos cozidos',750,24),
  ('Frango com cheddar','',700,25),
  ('Caipira','',700,26),
  ('Mineiro','frango, catupiry, milho e bacon',700,27),
  ('Portuguesa','',700,28),
  ('Pedra Grande','',700,29),
  ('Romanesca','',700,30),
  ('Couve com shimeji','',700,31),
  ('Milho','',700,32),
  ('Peito de peru','',700,33),
  ('Brócolis com bacon e queijo','',700,34),
  ('Supimpa','',700,35),
  ('Carne seca com catupiry','',700,36),
  ('Toscana','',700,37),
  ('Costela com queijo','',700,38),
  ('Costela com catupiry','',700,39),
  ('Morango','',700,40),
  ('Pepperoni','',700,41)
) v(nome, descricao, preco, ordem)
where not exists (select 1 from public.sabores);

-- ---------- funções de apoio ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- O primeiro usuário do painel que entrar vira administrador (cadastros públicos ficam desligados).
create or replace function public.reivindicar_admin() returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  if exists (select 1 from public.admins where user_id = auth.uid()) then return true; end if;
  if exists (select 1 from public.admins) then return false; end if;
  insert into public.admins (user_id) values (auth.uid());
  return true;
end $$;

-- Relógio oficial: horário de Brasília do servidor
create or replace function public.agora_br() returns timestamp
language sql stable as $$ select (now() at time zone 'America/Sao_Paulo') $$;

-- Regra de data de retirada (escopo 3.2 e 3.3). Devolve null se a data pode ser escolhida, ou o motivo.
create or replace function public.regra_data(p_data date) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  c public.config; n timestamp := public.agora_br(); hoje date := n::date;
  dow int := extract(dow from p_data); esp boolean; lim date;
begin
  select * into c from public.config where id = 1;
  if p_data is null then return 'Escolha a data de retirada'; end if;
  if p_data < hoje then return 'Data já passou'; end if;
  if p_data > hoje + c.dias_oferecidos then return 'Data muito distante'; end if;
  if exists (select 1 from public.datas_bloqueadas where data = p_data) then return 'Data bloqueada'; end if;
  esp := p_data = any (c.especiais);
  if dow = 0 then
    if not c.domingo and not esp then return 'Sem retirada aos domingos'; end if;
    lim := p_data - 1;
    if hoje > lim or (hoje = lim and n::time >= c.corte) then
      return 'Retirada no domingo: pedir até sábado às ' || to_char(c.corte, 'HH24:MI');
    end if;
    return null;
  end if;
  if not (dow = any (c.dias)) and not esp then return 'Sem atendimento neste dia'; end if;
  if p_data = hoje and n::time >= c.corte then return 'Para hoje, só até as ' || to_char(c.corte, 'HH24:MI'); end if;
  return null;
end $$;

create or replace function public.datas_disponiveis() returns date[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(d::date order by d), '{}')
  from public.config c,
       generate_series(public.agora_br()::date, public.agora_br()::date + (c.dias_oferecidos - 1), interval '1 day') d
  where c.id = 1 and public.regra_data(d::date) is null;
$$;

create or replace function public.pedido_json(p public.pedidos) returns json
language sql stable as $$
  select json_build_object(
    'id', p.id, 'numero', p.numero, 'cliente_id', p.cliente_id, 'cliente_nome', p.cliente_nome,
    'criado_em', to_char(p.criado_em at time zone 'America/Sao_Paulo', 'YYYY-MM-DD HH24:MI'),
    'retirada', p.retirada, 'itens', p.itens, 'total_qtd', p.total_qtd, 'total', p.total,
    'status', p.status, 'historico', p.historico);
$$;

create or replace function public._sessao(p_token uuid) returns public.clientes
language plpgsql security definer set search_path = public as $$
declare c public.clientes;
begin
  select cl.* into c from public.sessoes s join public.clientes cl on cl.id = s.cliente_id
   where s.token = p_token and s.expira > now();
  if c.id is null then raise exception 'SESSAO_INVALIDA'; end if;
  if c.bloqueado then raise exception 'ACESSO_BLOQUEADO'; end if;
  return c;
end $$;

-- ---------- portal do cliente (acesso sem conta do Supabase, por token) ----------
create or replace function public.publico_info() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('empresa', empresa, 'whatsapp', whatsapp, 'corte', to_char(corte, 'HH24:MI')) from public.config where id = 1;
$$;

create or replace function public.cliente_login(p_usuario text, p_senha text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare c public.clientes; t uuid; falhas int;
begin
  p_usuario := lower(trim(coalesce(p_usuario, '')));
  delete from public.tentativas_login where quando < now() - interval '1 day';
  select count(*) into falhas from public.tentativas_login where usuario = p_usuario and quando > now() - interval '10 minutes';
  if falhas >= 8 then
    return json_build_object('ok', false, 'msg', 'Muitas tentativas. Aguarde alguns minutos e tente de novo.');
  end if;
  select * into c from public.clientes where usuario = p_usuario;
  if c.id is null or c.senha_hash <> extensions.crypt(coalesce(p_senha, ''), c.senha_hash) then
    insert into public.tentativas_login (usuario) values (p_usuario);
    return json_build_object('ok', false, 'msg', 'Usuário ou senha incorretos.');
  end if;
  if c.bloqueado then
    return json_build_object('ok', false, 'msg', 'Seu acesso está bloqueado. Fale com a ' || (select empresa from public.config where id = 1) || '.');
  end if;
  delete from public.tentativas_login where usuario = p_usuario;
  delete from public.sessoes where expira < now();
  insert into public.sessoes (cliente_id) values (c.id) returning token into t;
  return json_build_object('ok', true, 'token', t);
end $$;

create or replace function public.cliente_sair(p_token uuid) returns void
language sql security definer set search_path = public as $$
  delete from public.sessoes where token = p_token;
$$;

create or replace function public.cliente_dados(p_token uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare c public.clientes := public._sessao(p_token); cfg public.config;
begin
  select * into cfg from public.config where id = 1;
  return json_build_object(
    'cliente', json_build_object('id', c.id, 'nome', c.nome, 'contato', c.contato),
    'config', json_build_object('empresa', cfg.empresa, 'whatsapp', cfg.whatsapp, 'aprovacao', cfg.aprovacao, 'corte', to_char(cfg.corte, 'HH24:MI')),
    'agora', to_char(public.agora_br(), 'YYYY-MM-DD HH24:MI'),
    'datas', public.datas_disponiveis(),
    'catalogo', coalesce((
      select json_agg(json_build_object('id', s.id, 'nome', s.nome, 'descricao', s.descricao, 'preco', coalesce(k.preco, s.preco)) order by s.ordem, s.nome)
      from public.catalogo k join public.sabores s on s.id = k.sabor_id
      where k.cliente_id = c.id and s.ativo and not s.excluido), '[]'));
end $$;

create or replace function public.cliente_pedidos(p_token uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare c public.clientes := public._sessao(p_token);
begin
  return coalesce((select json_agg(public.pedido_json(p) order by p.criado_em desc)
                   from (select * from public.pedidos where cliente_id = c.id order by criado_em desc limit 500) p), '[]');
end $$;

-- Finalização do pedido: confere data (horário de Brasília), catálogo, preços e grava com preço congelado.
create or replace function public.cliente_criar_pedido(p_token uuid, p_retirada date, p_itens jsonb, p_total_esperado int) returns json
language plpgsql security definer set search_path = public as $$
declare
  c public.clientes := public._sessao(p_token); cfg public.config; motivo text;
  r record; it jsonb := '[]'; tq int := 0; tot int := 0; st text; ped public.pedidos; faltando int := 0; agora text;
begin
  select * into cfg from public.config where id = 1;
  motivo := public.regra_data(p_retirada);
  if motivo is not null then
    return json_build_object('ok', false, 'erro', 'data', 'msg', motivo, 'datas', public.datas_disponiveis());
  end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' then
    return json_build_object('ok', false, 'erro', 'vazio', 'msg', 'Seu pedido está vazio.');
  end if;
  for r in
    select x.sid, sum(x.q)::int as q, s.nome, coalesce(k.preco, s.preco) as preco, (s.id is not null) as disponivel
    from (select (e->>'sabor_id')::uuid as sid, floor((e->>'qtd')::numeric)::int as q from jsonb_array_elements(p_itens) e) x
    left join public.catalogo k on k.cliente_id = c.id and k.sabor_id = x.sid
    left join public.sabores s on s.id = k.sabor_id and s.ativo and not s.excluido
    where x.q > 0
    group by x.sid, s.id, s.nome, s.ordem, k.preco, s.preco
    order by s.ordem nulls last, s.nome
  loop
    if not r.disponivel then faltando := faltando + 1; continue; end if;
    if r.q > 100000 then return json_build_object('ok', false, 'erro', 'qtd', 'msg', 'Quantidade muito alta em ' || r.nome || '.'); end if;
    it := it || jsonb_build_object('sabor_id', r.sid, 'nome', r.nome, 'qtd', r.q, 'preco', r.preco, 'subtotal', r.q * r.preco);
    tq := tq + r.q; tot := tot + r.q * r.preco;
  end loop;
  if faltando > 0 then
    return json_build_object('ok', false, 'erro', 'catalogo', 'msg', 'Alguns sabores deixaram de estar disponíveis e foram retirados. Confira o pedido de novo.');
  end if;
  if tq = 0 then return json_build_object('ok', false, 'erro', 'vazio', 'msg', 'Seu pedido está vazio.'); end if;
  if p_total_esperado is not null and p_total_esperado <> tot then
    return json_build_object('ok', false, 'erro', 'precos', 'msg', 'Os preços foram atualizados. Confira o novo total antes de confirmar.');
  end if;
  st := case when cfg.aprovacao = 'auto' then 'confirmado' else 'pendente' end;
  agora := to_char(public.agora_br(), 'YYYY-MM-DD HH24:MI');
  insert into public.pedidos (cliente_id, cliente_nome, retirada, itens, total_qtd, total, status, historico)
  values (c.id, c.nome, p_retirada, it, tq, tot, st, jsonb_build_array(jsonb_build_object('quando', agora, 'status', st, 'por', c.nome)))
  returning * into ped;
  return json_build_object('ok', true, 'pedido', public.pedido_json(ped));
end $$;

-- ---------- administração ----------
create or replace function public.admin_salvar_cliente(p jsonb) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid := nullif(p->>'id', '')::uuid; v_senha text := nullif(p->>'senha', ''); v_usuario text := lower(trim(p->>'usuario'));
begin
  if not public.is_admin() then raise exception 'SEM_PERMISSAO'; end if;
  if v_senha is not null and length(v_senha) < 4 then raise exception 'SENHA_CURTA'; end if;
  if exists (select 1 from public.clientes where usuario = v_usuario and id is distinct from v_id) then raise exception 'USUARIO_EXISTE'; end if;
  if v_id is null then
    if v_senha is null then raise exception 'SENHA_OBRIGATORIA'; end if;
    insert into public.clientes (nome, contato, telefone, usuario, senha_hash, bloqueado)
    values (trim(p->>'nome'), coalesce(p->>'contato', ''), coalesce(p->>'telefone', ''), v_usuario,
            extensions.crypt(v_senha, extensions.gen_salt('bf')), coalesce((p->>'bloqueado')::boolean, false))
    returning id into v_id;
  else
    update public.clientes set nome = trim(p->>'nome'), contato = coalesce(p->>'contato', ''), telefone = coalesce(p->>'telefone', ''),
      usuario = v_usuario, bloqueado = coalesce((p->>'bloqueado')::boolean, false),
      senha_hash = case when v_senha is null then senha_hash else extensions.crypt(v_senha, extensions.gen_salt('bf')) end
    where id = v_id;
    if v_senha is not null or coalesce((p->>'bloqueado')::boolean, false) then
      delete from public.sessoes where cliente_id = v_id;     -- desconecta o cliente
    end if;
  end if;
  return v_id;
end $$;

create or replace function public.admin_salvar_catalogo(p_cliente uuid, p_itens jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'SEM_PERMISSAO'; end if;
  delete from public.catalogo where cliente_id = p_cliente;
  insert into public.catalogo (cliente_id, sabor_id, preco)
  select p_cliente, (e->>'sabor_id')::uuid, nullif(e->>'preco', '')::int from jsonb_array_elements(p_itens) e;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.admin_mudar_status(p_pedido uuid, p_status text, p_motivo text) returns json
language plpgsql security definer set search_path = public as $$
declare p public.pedidos;
begin
  if not public.is_admin() then raise exception 'SEM_PERMISSAO'; end if;
  if p_status not in ('pendente','confirmado','em_preparacao','concluido','cancelado') then raise exception 'STATUS_INVALIDO'; end if;
  update public.pedidos set status = p_status,
    historico = historico || jsonb_build_array(jsonb_build_object('quando', to_char(public.agora_br(), 'YYYY-MM-DD HH24:MI'), 'status', p_status, 'por', 'Administração', 'motivo', coalesce(p_motivo, '')))
  where id = p_pedido returning * into p;
  return public.pedido_json(p);
end $$;

create or replace function public.admin_excluir_sabor(p_sabor uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'SEM_PERMISSAO'; end if;
  update public.sabores set excluido = true, ativo = false where id = p_sabor;
  delete from public.catalogo where sabor_id = p_sabor;
end $$;

create or replace function public.admin_criar_pedido(p_cliente uuid, p_retirada date, p_itens jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare c public.clientes; r record; it jsonb := '[]'; tq int := 0; tot int := 0; ped public.pedidos; agora text;
begin
  if not public.is_admin() then raise exception 'SEM_PERMISSAO'; end if;
  select * into c from public.clientes where id = p_cliente;
  if c.id is null then raise exception 'CLIENTE_INEXISTENTE'; end if;
  if p_retirada is null or p_retirada < public.agora_br()::date then raise exception 'DATA_INVALIDA'; end if;
  for r in
    select x.sid, sum(x.q)::int as q, s.nome, coalesce(k.preco, s.preco) as preco
    from (select (e->>'sabor_id')::uuid as sid, floor((e->>'qtd')::numeric)::int as q from jsonb_array_elements(p_itens) e) x
    join public.sabores s on s.id = x.sid and not s.excluido
    left join public.catalogo k on k.cliente_id = c.id and k.sabor_id = x.sid
    where x.q > 0
    group by x.sid, s.nome, s.ordem, k.preco, s.preco
    order by s.ordem, s.nome
  loop
    it := it || jsonb_build_object('sabor_id', r.sid, 'nome', r.nome, 'qtd', r.q, 'preco', r.preco, 'subtotal', r.q * r.preco);
    tq := tq + r.q; tot := tot + r.q * r.preco;
  end loop;
  if tq = 0 then raise exception 'PEDIDO_VAZIO'; end if;
  agora := to_char(public.agora_br(), 'YYYY-MM-DD HH24:MI');
  insert into public.pedidos (cliente_id, cliente_nome, retirada, itens, total_qtd, total, status, historico)
  values (c.id, c.nome, p_retirada, it, tq, tot, 'confirmado',
          jsonb_build_array(jsonb_build_object('quando', agora, 'status', 'confirmado', 'por', 'Administração', 'motivo', 'Lançado pela administração a partir de mensagem')))
  returning * into ped;
  return public.pedido_json(ped);
end $$;

create or replace function public.admin_agora() returns text
language sql stable as $$ select to_char(public.agora_br(), 'YYYY-MM-DD HH24:MI') $$;

-- ---------- segurança: cada um só acessa o que pode ----------
alter table public.config enable row level security;
alter table public.datas_bloqueadas enable row level security;
alter table public.sabores enable row level security;
alter table public.clientes enable row level security;
alter table public.catalogo enable row level security;
alter table public.pedidos enable row level security;
alter table public.sessoes enable row level security;
alter table public.tentativas_login enable row level security;
alter table public.admins enable row level security;

do $$
declare t text;
begin
  foreach t in array array['config','datas_bloqueadas','sabores','clientes','catalogo','pedidos'] loop
    execute format('drop policy if exists admin_tudo on public.%I', t);
    execute format('create policy admin_tudo on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;
drop policy if exists admin_ve_admins on public.admins;
create policy admin_ve_admins on public.admins for select to authenticated using (public.is_admin());

revoke all on all tables in schema public from anon, authenticated;
grant select, insert, update, delete on public.config, public.datas_bloqueadas, public.sabores, public.catalogo, public.pedidos to authenticated;
grant select (id, nome, contato, telefone, usuario, bloqueado, criado_em) on public.clientes to authenticated;
grant select on public.admins to authenticated;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.publico_info() to anon, authenticated;
grant execute on function public.cliente_login(text, text) to anon, authenticated;
grant execute on function public.cliente_sair(uuid) to anon, authenticated;
grant execute on function public.cliente_dados(uuid) to anon, authenticated;
grant execute on function public.cliente_pedidos(uuid) to anon, authenticated;
grant execute on function public.cliente_criar_pedido(uuid, date, jsonb, int) to anon, authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.reivindicar_admin() to authenticated;
grant execute on function public.admin_salvar_cliente(jsonb) to authenticated;
grant execute on function public.admin_salvar_catalogo(uuid, jsonb) to authenticated;
grant execute on function public.admin_mudar_status(uuid, text, text) to authenticated;
grant execute on function public.admin_excluir_sabor(uuid) to authenticated;
grant execute on function public.admin_agora() to authenticated;
grant execute on function public.admin_criar_pedido(uuid, date, jsonb) to authenticated;

-- funções internas usadas dentro das outras
grant execute on function public.agora_br(), public.regra_data(date), public.datas_disponiveis(), public.pedido_json(public.pedidos) to authenticated;

notify pgrst, 'reload schema';
