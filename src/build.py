"""Monta site/index.html (portal do cliente) e site/admin/index.html (administração)."""
import os, re
R = os.path.dirname(os.path.abspath(__file__))
J = lambda *p: os.path.join(R, *p)
ler = lambda p: open(p, encoding='utf-8').read()

head = re.sub(r'<title>.*?</title>', '<title>__TITLE__</title>', ler(J('base.html')), count=1)  # cabeçalho + estilos comuns

MARCA = """
/* ---- marca Japinha San: vermelho e preto ---- */
:root{--bg:#f2f2f2;--surface:#ffffff;--surface-2:#f6f6f6;--ink:#141414;--muted:#5f5f5f;--line:#dadada;
  --accent:#c8102e;--accent-ink:#ffffff;--signal:#c8102e;--signal-ink:#ffffff;--kiosk:#141414;--kiosk-ink:#f5f5f5;}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#0d0d0d;--surface:#171717;--surface-2:#1f1f1f;--ink:#f2f2f2;--muted:#a6a6a6;--line:#303030;
  --accent:#ff4a5a;--accent-ink:#141414;--signal:#ff4a5a;--signal-ink:#141414;--kiosk:#000000;--kiosk-ink:#f5f5f5;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#0d0d0d;--surface:#171717;--surface-2:#1f1f1f;--ink:#f2f2f2;--muted:#a6a6a6;--line:#303030;
  --accent:#ff4a5a;--accent-ink:#141414;--signal:#ff4a5a;--signal-ink:#141414;--kiosk:#000000;--kiosk-ink:#f5f5f5;color-scheme:dark}
.topbar{background:var(--kiosk);color:var(--kiosk-ink);border-bottom:3px solid var(--accent)}
.topbar .who-admin{color:var(--kiosk-ink);opacity:.9}
.topbar .btn{background:transparent;color:var(--kiosk-ink);border-color:rgba(255,255,255,.35)}
.brand strong{font-family:var(--f-display);font-size:24px;letter-spacing:.04em}
.brand strong em,.brand-big b em{font-style:normal;color:#ff3b4b}
.brand small{color:rgba(255,255,255,.7)}
.brand-big{display:flex;gap:12px;align-items:center}
.brand-big svg{width:56px;height:56px}
.brand-big b{display:block;font-family:var(--f-display);font-size:32px;letter-spacing:.04em;line-height:1}
.brand-big b em{color:var(--accent)}
.brand-big span{color:var(--muted);font-size:14px}
.badge-n{display:inline-grid;place-items:center;min-width:20px;height:20px;padding:0 6px;border-radius:999px;background:var(--accent);color:var(--accent-ink);font-size:12px;font-weight:700;margin-left:4px}
.loading .actions{justify-content:center}
"""

FAV = "data:image/svg+xml," + "%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' rx='9' fill='%23141414'/%3E%3Ccircle cx='20' cy='20' r='12.5' fill='%23D7192A'/%3E%3C/svg%3E"

def pagina(titulo, sub, js, extra_head=''):
    corpo = f"""{MARCA}
</style>
<link rel="icon" href="{FAV}">
<meta name="theme-color" content="#141414">
{extra_head}
</head>
<body>
<header class="topbar">
  <div class="brand"><span id="logoBox"></span><div><strong id="brandName">JAPINHA <em>SAN</em></strong><small>{sub}</small></div></div>
  <div class="top-right"><span class="who-admin" id="whoBox" hidden><span id="whoName"></span><button class="btn small" type="button" data-act="sair">Sair</button></span></div>
</header>
<nav class="subnav" id="subnav" hidden></nav>
<main id="app"><div class="loading"><p>Carregando…</p></div></main>
<div class="dlg" id="dlg" hidden></div>
<div class="toast" id="toast" role="status" hidden></div>
<script src="config.js"></script>
<script src="supabase.js"></script>
<script>
(function(){{
'use strict';
{ler(J('common.js'))}
document.getElementById('logoBox').innerHTML=LOGO;
{js}
}})();
</script>
</body>
</html>
"""
    return head.replace('__TITLE__', titulo) + corpo

site = os.path.join(R, '..', 'site')
os.makedirs(os.path.join(site, 'admin'), exist_ok=True)
open(os.path.join(site, 'index.html'), 'w', encoding='utf-8').write(
    pagina('Japinha San · Pedidos', 'Pedidos on-line', ler(J('portal.js')),
           '<link rel="manifest" href="manifest.webmanifest">'))
open(os.path.join(site, 'admin', 'index.html'), 'w', encoding='utf-8').write(
    pagina('Japinha San · Administração', 'Administração', ler(J('admin.js'))))
print('ok')
