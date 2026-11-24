# Japinha San · Sistema de Pedidos

| Parte | Onde fica | Para quem |
|---|---|---|
| **Site de pedidos** | https://otavio512.github.io/japinha-san/ | Clientes (login com usuário e senha dados pela Japinha San) |
| **Administração (web)** | https://otavio512.github.io/japinha-san/admin/ | Administração, pelo computador |
| **App de administração (APK)** | aba *Releases* deste repositório | Administração, pelo celular |
| **Banco de dados** | Supabase, projeto `japinha-san` | — |

## Como funciona
- `supabase/setup.sql`: tabelas, regras de segurança e funções. Cole no Supabase (SQL Editor) e rode. Pode rodar de novo sem perder dados.
- As regras de horário (pedido para o mesmo dia até 08h00, domingo até sábado 08h00, datas bloqueadas), o catálogo e os preços são conferidos **no servidor**, pelo horário de Brasília.
- Cada pedido guarda o preço do momento em que foi feito.
- `site/`: o site dos clientes (`index.html`) e a administração (`admin/index.html`). São gerados a partir de `src/` com `python3 src/build.py`.
- `site/config.js`: endereço do Supabase e chave *publishable* (pode ser pública).
- A cada envio para `main`, o GitHub publica o site e gera um APK novo em *Releases*.

## Acesso de administrador
Criado no Supabase em *Authentication → Users* (ex.: `admin@japinhasan.app`). No app, basta digitar `admin`.
A primeira conta que entrar vira administradora. Deixe desligado o cadastro público em *Authentication → Sign In / Providers*.
