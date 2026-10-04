"""X Router — renderer halaman (style 9router, token identik)."""

from html import escape

import db

# ------------------------------------------------------------------ helpers


def ms(name, cls=""):
    return f'<span class="material-symbols-outlined ms-hidden {cls}">{name}</span>'


def plogo(p, size_cls="plogo"):
    """Badge inisial provider dengan warna katalog."""
    color = p.get("color") or "#E56A4A"
    nm = p.get("name") or p.get("id", "?")
    letters = "".join(w[0] for w in nm.replace("-", " ").split()[:2]).upper()
    return (f'<div class="{size_cls}" style="background:linear-gradient(135deg,'
            f'{escape(color)},color-mix(in srgb,{escape(color)} 68%,#000))">{letters}</div>')


NAV = [
    ("Gateway", [
        ("endpoint", "Endpoint & Key", "api"),
        ("providers", "Providers", "dns"),
        ("models", "Models", "deployed_code"),
    ]),
    ("Monitor", [
        ("usage", "Usage", "bar_chart"),
        ("logs", "Console Log", "terminal"),
    ]),
    ("System", [
        ("settings", "Settings", "settings"),
    ]),
]

CRUMB = {
    "dashboard": ("Dashboard", "Ringkasan gateway", "space_dashboard"),
    "endpoint": ("Endpoint & Key", "Base URL, API key & snippet siap pakai", "api"),
    "providers": ("Providers", "Koneksi upstream & katalog provider", "dns"),
    "models": ("Models", "Katalog model dari provider yang terhubung", "deployed_code"),
    "usage": ("Usage", "Statistik token, request & latensi", "bar_chart"),
    "logs": ("Console Log", "Request terakhir yang lewat gateway", "terminal"),
    "keys": ("API Keys", "Kelola key akses /v1", "key"),
    "settings": ("Settings", "Tema, keamanan & data gateway", "settings"),
}


def layout(title_key, body, user, extra_topbar=""):
    title, desc, icon = CRUMB.get(title_key, (title_key, "", "apps"))
    groups = []
    for gname, items in NAV:
        links = "".join(
            f'<a class="nav-item{" active" if k == title_key else ""}" href="/{k}">'
            f'{ms(i)}<span class="lbl">{lbl}</span></a>'
            for k, lbl, i in items
        )
        groups.append(f'<div class="nav-label">{gname}</div><div class="nav-group">{links}</div>')
    nav = "".join(groups)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{escape(title)} · X Router</title>
<link rel="icon" href="/static/logo.png" type="image/png">
<link rel="stylesheet" href="/static/style.css">
<link rel="stylesheet" href="/static/motion.css">
<script src="/static/app.js" defer></script>
</head>
<body>
<div class="shell">
  <aside class="sidebar">
    <div class="brand">
      <img src="/static/logo.png" alt="X Router">
      <div class="name">X<b>Router</b></div>
    </div>
    {nav}
    <div class="foot">
      <a class="nav-item" href="/logout">{ms("logout")}<span class="lbl">Keluar · {escape(user)}</span></a>
    </div>
  </aside>
  <div class="main">
    <header class="topbar">
      <button class="btn ghost icon menu-btn" data-toggle-sidebar aria-label="Menu">{ms("menu")}</button>
      <span class="icon-chip">{ms(icon)}</span>
      <div>
        <h1>{escape(title)} <span class="sl">//</span></h1>
        <div class="desc">{escape(desc)}</div>
      </div>
      <div class="spacer"></div>
      <div class="topbar-actions">
        {extra_topbar}
        <button class="btn ghost icon" id="themeToggle" onclick="xrTheme(document.body.classList.contains('light')?'dark':'light')" title="Tema">
          {ms("light_mode")}
        </button>
      </div>
    </header>
    <div class="content">{body}</div>
  </div>
</div>
</body>
</html>"""


def login_page(msg=""):
    alert = f'<div class="alert err">{escape(msg)}</div>' if msg else ""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Login · X Router</title>
<link rel="icon" href="/static/logo.png" type="image/png">
<link rel="stylesheet" href="/static/style.css">
<link rel="stylesheet" href="/static/motion.css">
<script src="/static/app.js" defer></script>
</head>
<body>
<div class="auth-wrap">
  <div class="auth-card">
    <div class="auth-brand">
      <img src="/static/logo.png" alt="">
      <div class="name">X<b>Router</b></div>
      <div class="tag">llm gateway</div>
    </div>
    {alert}
    <form method="post" action="/login">
      <div class="field">
        <label for="pw">Password</label>
        <input id="pw" type="password" name="password" autocomplete="current-password" autofocus
               placeholder="••••••••">
      </div>
      <button class="btn primary lg" style="width:100%" type="submit">
        {ms("login")} Masuk
      </button>
    </form>
    <div class="hint">session 12 jam · pbkdf2-sha256</div>
  </div>
</div>
</body>
</html>"""


# ------------------------------------------------------------------ chart


def bar_chart(rows, key="tokens", height=120):
    """rows: list of dict dengan 'day' + numeric key. SVG murni, animasi naik."""
    if not rows:
        return '<div class="empty">%s<span class="t">Belum ada data</span>' \
               '<span class="d">Chart muncul setelah ada request masuk.</span></div>' % ms("monitoring")
    mx = max(r.get(key) or 0 for r in rows) or 1
    n = len(rows)
    gap = 6
    bw = max(8, int((760 - gap * (n - 1)) / max(n, 1)))
    W = n * (bw + gap)
    bars, labels = [], []
    for i, r in enumerate(rows):
        v = r.get(key) or 0
        h = max(3, int((v / mx) * (height - 26)))
        x = i * (bw + gap)
        y = height - h - 20
        bars.append(
            f'<rect class="bar" x="{x}" y="{y}" width="{bw}" height="{h}" rx="4" '
            f'fill="url(#xrGrad)" style="animation-delay:{i * 45}ms"><title>'
            f'{r["day"]}: {v:,}</title></rect>'
        )
        if i % max(1, n // 7) == 0 or i == n - 1:
            labels.append(
                f'<text x="{x + bw / 2}" y="{height - 5}" text-anchor="middle" '
                f'font-size="10" fill="currentColor" opacity=".55">{r["day"][5:]}</text>'
            )
    return (
        f'<svg class="spark" viewBox="0 0 {W} {height}" width="100%" height="{height}" '
        f'preserveAspectRatio="none" style="color:var(--color-text-muted);overflow:visible">'
        f'<defs><linearGradient id="xrGrad" x1="0" y1="0" x2="0" y2="1">'
        f'<stop offset="0%" stop-color="#EA7855"/><stop offset="100%" stop-color="#A64027"/>'
        f'</linearGradient></defs>'
        + "".join(bars) + "".join(labels) + "</svg>"
    )


def sparkline(values, w=120, h=34):
    if len(values) < 2:
        return ""
    mx = max(values) or 1
    pts = [((i / (len(values) - 1)) * w, h - (v / mx) * (h - 6) - 3)
           for i, v in enumerate(values)]
    d = "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in pts)
    area = d + f" L{w} {h} L0 {h} Z"
    return (
        f'<svg class="spark" width="{w}" height="{h}" viewBox="0 0 {w} {h}">'
        f'<path class="area" d="{area}" fill="rgba(229,106,74,.14)"/>'
        f'<path d="{d}" fill="none" stroke="var(--color-brand-400)" stroke-width="1.8" '
        f'stroke-linecap="round" stroke-linejoin="round"/></svg>'
    )


def hbar(pct, label=None, sub=None):
    pct = max(0, min(100, int(pct)))
    lbl = f'<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px">' \
          f'<span class="muted">{label}</span><span style="font-weight:650">{pct}%</span></div>' if label else ""
    return f'{lbl}<div class="progress"><i style="width:{pct}%"></i></div>' + \
           (f'<div style="font-size:11.5px;color:var(--color-text-subtle);margin-top:5px">{sub}</div>' if sub else "")


# ------------------------------------------------------------------ pages

def _stat(k, v, m, icon, cls="", spark=""):
    return (f'<div class="stat"><div class="k">{ms(icon)}{k}</div>'
            f'<div class="v {cls}">{v}</div><div class="m">{m}</div>{spark}</div>')


def page_endpoint(user, base_url):
    keys = db.list_api_keys()
    main_key = next((k for k in keys if k["isActive"]), None)
    key_val = main_key["key"] if main_key else "(belum ada key — generate dulu)"
    kc = "k" if main_key else "muted"

    if keys:
        rows = ""
        for k in keys:
            st = "on" if k["isActive"] else "off"
            st_txt = "aktif" if k["isActive"] else "dicabut"
            used = f'{k["usedTokens"]:,}'
            if k["isActive"]:
                act = (f'<button class="btn ghost sm" onclick="revokeKey(\'{k["key"]}\')">'
                       f'{ms("block")}Cabut</button>')
            else:
                act = ""
            rows += (
                f'<tr><td class="lead">{escape(k["name"] or "default")}</td>'
                f'<td><button class="copyable" data-copy="{k["key"]}" data-copy-label="API key">'
                f'<span class="val">{k["key"][:12]}...{k["key"][-4:]}</span>'
                f'{ms("content_copy")}</button></td>'
                f'<td>{used}</td>'
                f'<td class="muted">{escape(k["lastUsedAt"] or "never")}</td>'
                f'<td><span class="pill {st}">{st_txt}</span></td>'
                f'<td style="text-align:right">{act}</td></tr>'
            )
    else:
        rows = ('<tr><td colspan="6"><div class="empty">' + ms("key") +
                '<span class="t">Belum ada API key</span>'
                '<span class="d">Generate key pertama untuk mulai pakai endpoint /v1.</span>'
                '</div></td></tr>')

    curl = (
        f'<span class="c"># OpenAI-compatible</span>\n'
        f'curl {base_url}/v1/chat/completions \\\n'
        f'  -H <span class="s">"Authorization: Bearer {key_val}"</span> \\\n'
        f'  -H <span class="s">"Content-Type: application/json"</span> \\\n'
        f'  -d <span class="s">\'{{"model":"deepseek-v4-flash","messages":[{{"role":"user","content":"halo"}}]}}\'</span>'
    )
    curl_anthropic = (
        f'<span class="c"># Anthropic-compatible</span>\n'
        f'curl {base_url}/v1/messages \\\n'
        f'  -H <span class="s">"x-api-key: {key_val}"</span> \\\n'
        f'  -H <span class="s">"anthropic-version: 2023-06-01"</span> \\\n'
        f'  -H <span class="s">"Content-Type: application/json"</span> \\\n'
        f'  -d <span class="s">\'{{"model":"claude-sonnet-4-5","max_tokens":128,"messages":[{{"role":"user","content":"halo"}}]}}\'</span>'
    )

    body = f"""
<div class="grid g-2">
  <div class="card">
    <div class="card-h">
      <div class="t"><span class="icon-chip">{ms("link")}</span>
        <div>Base URL<div class="sub">endpoint gateway ini</div></div></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:9px">
      <button class="copyable" style="justify-content:space-between;width:100%" data-copy="{base_url}" data-copy-label="Base URL">
        <span class="val">{base_url}</span>{ms("content_copy")}
      </button>
      <div class="grid g-3" style="gap:9px">
        <div class="chip">{ms("open_in_new", "")} OpenAI <b class="mono" style="color:var(--color-brand-300)">/v1</b></div>
        <div class="chip">{ms("open_in_new")} Anthropic <b class="mono" style="color:var(--color-brand-300)">/v1/messages</b></div>
        <div class="chip">{ms("shield")} Bearer + x-api-key</div>
      </div>
    </div>
    <hr class="divider">
    <div class="card-h" style="margin-bottom:12px">
      <div class="t"><span class="icon-chip">{ms("key")}</span>
        <div>API Key<div class="sub">klik untuk salin</div></div></div>
      <button class="btn primary sm" onclick="newKey()">{ms("add")}Generate</button>
    </div>
    <button class="copyable {kc}" style="width:100%;justify-content:space-between" data-copy="{key_val}" data-copy-label="API key">
      <span class="val">{key_val}</span>{ms("content_copy")}
    </button>
  </div>

  <div class="card">
    <div class="card-h">
      <div class="t"><span class="icon-chip">{ms("code")}</span>
        <div>Quick start<div class="sub">siap tempel ke terminal</div></div></div>
      <div class="tabs">
        <button class="tab active" data-snippet="openai" onclick="snipTab(this,'openai')">OpenAI</button>
        <button class="tab" data-snippet="anthropic" onclick="snipTab(this,'anthropic')">Anthropic</button>
      </div>
    </div>
    <div class="code" id="snip-openai">{curl}</div>
    <div class="code" id="snip-anthropic" style="display:none">{curl_anthropic}</div>
    <div style="display:flex;gap:8px;margin-top:12px">
      <button class="btn secondary sm" data-copy-target="#snip-openai" data-copy-label="Snippet">
        {ms("content_copy")}Salin snippet</button>
      <a class="btn ghost sm" href="/models">{ms("deployed_code")}Lihat model</a>
    </div>
  </div>
</div>

<div class="card" style="margin-top:16px">
  <div class="card-h">
    <div class="t"><span class="icon-chip">{ms("vpn_key")}</span>
      <div>API Keys<div class="sub">{len(keys)} key terdaftar</div></div></div>
    <button class="btn primary sm" onclick="newKey()">{ms("add")}Key baru</button>
  </div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Nama</th><th>Key</th><th>Tokens</th><th>Terakhir</th><th>Status</th><th></th></tr></thead>
      <tbody>{rows}</tbody>
    </table>
  </div>
</div>

<script>
function snipTab(btn, which) {{
  document.querySelectorAll('[data-snippet]').forEach(function(b){{b.classList.remove('active')}});
  btn.classList.add('active');
  document.getElementById('snip-openai').style.display = which==='openai' ? '' : 'none';
  document.getElementById('snip-anthropic').style.display = which==='anthropic' ? '' : 'none';
}}
function newKey() {{
  var n = prompt('Nama key', 'default');
  if (n === null) return;
  var f = document.createElement('form');
  f.method = 'post'; f.action = '/keys/new';
  var i = document.createElement('input');
  i.type = 'hidden'; i.name = 'name'; i.value = n || 'default';
  f.appendChild(i); document.body.appendChild(f); f.submit();
}}
function revokeKey(k) {{
  xrConfirm({{title:'Cabut API key', message:'Key '+k.slice(0,14)+'... tidak bisa dipakai lagi. Yakin?', okLabel:'Cabut'}}, function(){{
    var f = document.createElement('form');
    f.method = 'post'; f.action = '/keys/revoke';
    var i = document.createElement('input');
    i.type='hidden'; i.name='key'; i.value=k;
    f.appendChild(i); document.body.appendChild(f); f.submit();
  }});
}}
</script>"""
    return layout("endpoint", body, user)


def page_providers(user):
    provs = db.load_registry()
    conns = db.list_connections(active_only=False)
    by_provider = {}
    for c in conns:
        by_provider.setdefault(c["provider"], []).append(c)

    # --- terhubung
    if conns:
        conn_rows = ""
        for c in conns:
            p = next((x for x in provs if x["id"] == c["provider"]), None)
            name = (p or {}).get("name", c["provider"])
            color = (p or {}).get("color", "#E56A4A")
            st = "on" if c["isActive"] else "off"
            st_txt = "aktif" if c["isActive"] else "nonaktif"
            masked = "•" * 6 + (c["data"].get("apiKey") or "")[-4:]
            conn_rows += (
                f'<div class="prov-row" data-match="{escape(name)} {c["provider"]}">'
                f'<div class="plogo" style="background:linear-gradient(135deg,{escape(color)},color-mix(in srgb,{escape(color)} 68%,#000))">'
                f'{"".join(w[0] for w in name.split()[:2]).upper()}</div>'
                f'<div class="meta"><div class="pn">{escape(name)}</div>'
                f'<div class="pu">{escape(c["data"].get("baseUrl") or (p or {}).get("baseUrl") or "-")} · key {escape(masked)}</div></div>'
                f'<div class="acts"><span class="pill {st}">{st_txt}</span>'
                f'<form method="post" action="/providers/delete" style="display:inline" '
                f'onsubmit="return confirm(\'Hapus koneksi {escape(name)}?\')">'
                f'<input type="hidden" name="id" value="{c["id"]}">'
                f'<button class="btn ghost icon sm" title="Hapus">{ms("delete")}</button></form></div></div>'
            )
    else:
        conn_rows = ('<div class="empty">' + ms("cloud_off") +
                     '<span class="t">Belum ada provider terhubung</span>'
                     '<span class="d">Tambah koneksi API key di bawah — model dari provider '
                     'itu langsung muncul di halaman Models.</span></div>')

    # --- katalog (yang belum terhubung)
    connected_ids = {c["provider"] for c in conns}
    opts = "".join(
        f'<option value="{p["id"]}">{escape(p["name"])} ({len(p["models"])} model)</option>'
        for p in provs
        if p["category"] in ("apikey", "freeTier") and not p["noAuth"]
        and p["id"] not in connected_ids
    )
    if not opts:
        opts = '<option value="">— semua provider katalog sudah terhubung —</option>'

    counts = f'{len(provs)} provider · {sum(len(p["models"]) for p in provs)} model di katalog'

    body = f"""
<div class="grid g-4">
  {_stat("Terhubung", len({c['provider'] for c in conns}), "provider aktif", "dns", "hot")}
  {_stat("Koneksi", len(conns), "total akun", "hub")}
  {_stat("Katalog", len(provs), "provider tersedia", "cloud")}
  {_stat("Model", sum(len(p["models"]) for p in provs), "siap dirutekan", "deployed_code")}
</div>

<div class="card" style="margin-top:16px">
  <div class="card-h">
    <div class="t"><span class="icon-chip">{ms("hub")}</span>
      <div>Koneksi aktif<div class="sub">{len(conns)} akun upstream</div></div></div>
    <div class="search-box" style="width:min(56vw,260px)">
      {ms("search")}
      <input type="search" data-search placeholder="Cari provider  ( / )" data-provider-search>
    </div>
  </div>
  <div id="connList" style="display:flex;flex-direction:column;gap:10px">{conn_rows}</div>
</div>

<div class="card" style="margin-top:16px">
  <div class="card-h">
    <div class="t"><span class="icon-chip">{ms("add_circle")}</span>
      <div>Tambah koneksi<div class="sub">{counts}</div></div></div>
  </div>
  <form method="post" action="/providers/add" class="form-grid">
    <div class="field"><label>Provider</label>
      <select name="provider" required>{opts}</select></div>
    <div class="field"><label>API Key</label>
      <input type="password" name="apiKey" placeholder="sk-..." autocomplete="off" required></div>
    <div class="field"><label>Base URL override (opsional)</label>
      <input type="text" name="baseUrl" placeholder="https://..."></div>
    <div class="field"><label>&nbsp;</label>
      <button class="btn primary" type="submit">{ms("add")}Hubungkan</button></div>
  </form>
</div>

<script>
xrFilter('[data-provider-search]', '#connList .prov-row', null, null, 'data-match');
</script>"""
    return layout("providers", body, user)


def page_models(user, base_url):
    provs = db.load_registry()
    active = {c["provider"] for c in db.list_connections()}

    main_key = db.first_key()
    total = 0
    groups_html = ""
    # provider terhubung dulu, lalu sisanya (dim)
    ordered = sorted(provs, key=lambda p: (0 if p["id"] in active else 1, p.get("name", "").lower()))
    for p in ordered:
        if not p["models"]:
            continue
        is_on = p["id"] in active
        cards = ""
        for m in p["models"]:
            total += 1
            mid = m["id"]
            suffix = "" if is_on else (
                ' · <b style="color:var(--color-warning)">belum terhubung</b>')
            dim = "" if is_on else "opacity:.5"
            cards += (
                f'<div class="model-card" data-match="{escape(mid)} {escape(m.get("name") or "")} {escape(p["name"])}" '
                f'style="{dim}">'
                f'{plogo(p)}'
                f'<div class="meta"><div class="mn" title="{escape(mid)}">{escape(m.get("name") or mid)}</div>'
                f'<div class="mp"><span class="mono">{escape(mid)}</span>{suffix}</div></div>'
                f'<button class="copy" title="Salin id model" data-copy="{escape(mid)}" data-copy-label="Model id">'
                f'{ms("content_copy")}</button></div>'
            )
        chip = (f'<span class="pill on" style="margin-left:2px">terhubung</span>' if is_on
                else f'<span class="pill warn" style="margin-left:2px">butuh key</span>')
        groups_html += (
            f'<div data-group><div class="group-head">{plogo(p, "plogo")}'
            f'<span>{escape(p["name"])}</span><span class="cnt">{len(p["models"])}</span>{chip}</div>'
            f'<div class="model-grid">{cards}</div></div>'
        )

    usage_hint = (
        f'<div class="card" style="margin-bottom:16px;display:flex;gap:14px;align-items:center;flex-wrap:wrap">'
        f'<span class="icon-chip">{ms("info")}</span>'
        f'<div style="flex:1;min-width:220px"><b>Cara pakai:</b> <span class="muted">kirim id model persis '
        f'(contoh <code class="mono" style="color:var(--color-brand-300)">deepseek-v4-flash</code>) atau beri prefix '
        f'<code class="mono" style="color:var(--color-brand-300)">provider-</code>. '
        f'Field request tidak pernah di-strip.</div>'
        f'<button class="btn secondary sm" data-copy="{base_url}/v1/chat/completions" data-copy-label="Endpoint">'
        f'{ms("content_copy")}Salin endpoint</button></div>'
    )

    body = f"""
{usage_hint}
<div class="grid g-4">
  {_stat("Model", total, "di seluruh katalog", "deployed_code", "hot")}
  {_stat("Terhubung", len(active), "provider siap dipakai", "dns", "ok")}
  {_stat("Bisa dipakai", sum(len(p["models"]) for p in provs if p["id"] in active),
         "model aktif", "check_circle")}
  {_stat("Menunggu key", sum(len(p["models"]) for p in provs if p["id"] not in active),
         "model dormant", "hourglass_empty")}
</div>

<div class="card" style="margin-top:16px">
  <div class="card-h">
    <div class="t"><span class="icon-chip">{ms("deployed_code")}</span>
      <div>Katalog model<div class="sub"><span id="mCount">{total}</span> model · grup per provider</div></div></div>
    <div class="search-box" style="width:min(56vw,300px)">
      {ms("search")}
      <input type="search" data-search placeholder="Cari model / provider  ( / )" data-model-search>
    </div>
  </div>
  {groups_html}
  <div class="empty" id="modelEmpty" style="display:none">{ms("search_off")}
    <span class="t">Tidak ada yang cocok</span>
    <span class="d">Coba kata kunci lain — mis. "claude", "glm", atau nama provider.</span></div>
</div>

<script>
xrFilter('[data-model-search]', '.model-card', '#mCount', '#modelEmpty', 'data-match');
</script>"""
    return layout("models", body, user)


def page_usage(user):
    s = db.stats()
    daily = db.usage_daily(14)
    tops = db.top_models(10)
    provs = db.provider_breakdown(12)
    lat = db.latency_stats()
    hourly = s["recent"][:30]
    spark_vals = [r["completionTokens"] + r["promptTokens"] for r in reversed(hourly)] or [0, 0]

    err_pct = 0 if not s["requests"] else round((s["requests"] - s["ok"]) / s["requests"] * 100, 1)

    # bar chart per hari
    if daily:
        chart = bar_chart([{"day": r["day"], "tokens": r["pt"] + r["ct"]} for r in daily])
    else:
        chart = '<div class="empty">' + ms("monitoring") + \
                '<span class="t">Belum ada token tercatat</span>' \
                '<span class="d">Chart 14 hari terisi otomatis tiap request lewat gateway.</span></div>'

    # top models table
    if tops:
        maxr = max(t["reqs"] for t in tops) or 1
        trows = "".join(
            f'<tr><td class="lead">{escape(t["model"])}</td>'
            f'<td class="muted">{escape(t["provider"] or "-")}</td>'
            f'<td>{t["reqs"]}</td><td>{t["tokens"]:,}</td>'
            f'<td>{t["avg_ms"]} ms</td>'
            f'<td style="width:180px"><div class="progress"><i style="width:{round(t["reqs"] / maxr * 100)}%"></i></div></td></tr>'
            for t in tops
        )
        top_tbl = (
            '<div class="table-wrap"><table><thead><tr><th>Model</th><th>Provider</th>'
            '<th>Req</th><th>Tokens</th><th>Avg</th><th></th></tr></thead>'
            f'<tbody>{trows}</tbody></table></div>'
        )
    else:
        top_tbl = '<div class="empty">' + ms("leaderboard") + \
                  '<span class="t">Belum ada request</span>' \
                  '<span class="d">Leaderboard model terisi setelah gateway dipakai.</span></div>'

    # provider breakdown
    if provs:
        maxp = max(p["reqs"] for p in provs) or 1
        blocks = []
        for p in provs:
            sub = f'{p["reqs"]} req · {p["tokens"]:,} token · {p["ok"]} ok'
            blocks.append(
                f'<div style="margin-bottom:13px">'
                f'{hbar(round(p["reqs"] / maxp * 100), escape(p["provider"]), sub)}</div>'
            )
        pblocks = "".join(blocks)
    else:
        pblocks = '<div class="empty">' + ms("dns") + '<span class="t">Belum ada trafik per provider</span></div>'

    body = f"""
<div class="grid g-4">
  {_stat("Requests", f'{s["requests"]:,}', f'{err_pct}% error rate', "swap_horiz", "hot",
         sparkline(spark_vals))}
  {_stat("Tokens", f'{s["tokens"]:,}', "prompt + completion", "data_usage", "ok")}
  {_stat("Latensi p95", f'{lat["p95"]:,} ms', f'p50 {lat["p50"]:,} ms · avg {lat["avg"]:,} ms', "speed")}
  {_stat("1 jam terakhir", db.last_hour_requests(), "request masuk", "schedule")}
</div>

<div class="grid g-2" style="margin-top:16px">
  <div class="card">
    <div class="card-h">
      <div class="t"><span class="icon-chip">{ms("monitoring")}</span>
        <div>Token harian<div class="sub">14 hari terakhir (UTC)</div></div></div>
    </div>
    {chart}
  </div>
  <div class="card">
    <div class="card-h">
      <div class="t"><span class="icon-chip">{ms("dns")}</span>
        <div>Per provider<div class="sub">distribusi request</div></div></div>
    </div>
    {pblocks}
  </div>
</div>

<div class="card" style="margin-top:16px">
  <div class="card-h">
    <div class="t"><span class="icon-chip">{ms("leaderboard")}</span>
      <div>Model teratas<div class="sub">berdasarkan jumlah request</div></div></div>
  </div>
  {top_tbl}
</div>"""
    return layout("usage", body, user)


def page_logs(user):
    s = db.stats()
    recent = s["recent"]
    if recent:
        rows = "".join(
            f'<tr><td class="lead">{escape(r["model"] or "-")}</td>'
            f'<td class="muted">{escape(r["provider"] or "-")}</td>'
            f'<td class="mono muted">{escape(r["endpoint"] or "-")}</td>'
            f'<td><span class="pill {"on" if r["status"] == "ok" else "off"}">{escape(str(r["status"]))}</span></td>'
            f'<td>{r["latencyMs"]} ms</td>'
            f'<td class="muted">{r["promptTokens"]}+{r["completionTokens"]}</td>'
            f'<td class="muted">{escape(r["timestamp"][11:19])}</td></tr>'
            for r in recent
        )
        table = (
            '<div class="table-wrap"><table><thead><tr><th>Model</th><th>Provider</th>'
            '<th>Endpoint</th><th>Status</th><th>Latency</th><th>Tokens</th><th>Waktu</th>'
            f'</tr></thead><tbody>{rows}</tbody></table></div>'
        )
    else:
        table = '<div class="empty">' + ms("terminal") + \
                '<span class="t">Log kosong</span>' \
                '<span class="d">Setiap request /v1 yang lewat gateway muncul di sini.</span></div>'

    body = f"""
<div class="grid g-4">
  {_stat("Total", f'{s["requests"]:,}', "request tercatat", "terminal", "hot")}
  {_stat("Sukses", f'{s["ok"]:,}', "status ok", "check_circle", "ok")}
  {_stat("Gagal", f'{s["requests"] - s["ok"]:,}', "error / upstream", "error")}
  {_stat("Menampilkan", min(len(recent), 40), "baris terakhir", "manage_search")}
</div>
<div class="card" style="margin-top:16px">
  <div class="card-h">
    <div class="t"><span class="icon-chip">{ms("terminal")}</span>
      <div>Request log<div class="sub">40 terakhir · auto-refresh via reload</div></div></div>
    <button class="btn secondary sm" onclick="location.reload()">{ms("refresh")}Muat ulang</button>
  </div>
  {table}
</div>"""
    return layout("logs", body, user)


def page_settings(user, base_url):
    s = db.stats()
    reg = db.load_registry()
    daily = db.usage_daily(30)
    tok = sum((r["pt"] + r["ct"]) for r in daily)

    body = f"""
<div class="grid g-2">
  <div class="card">
    <div class="card-h">
      <div class="t"><span class="icon-chip">{ms("palette")}</span>
        <div>Tema<div class="sub">terang / gelap · tekan G</div></div></div>
    </div>
    <div style="display:flex;gap:9px;flex-wrap:wrap">
      <button class="btn secondary" onclick="xrTheme('dark')">{ms("dark_mode")}Gelap</button>
      <button class="btn secondary" onclick="xrTheme('light')">{ms("light_mode")}Terang</button>
    </div>
    <hr class="divider">
    <div class="card-h" style="margin-bottom:12px">
      <div class="t"><span class="icon-chip">{ms("password")}</span>
        <div>Ganti password<div class="sub">login dashboard</div></div></div>
    </div>
    <form method="post" action="/settings/password">
      <div class="field"><label>Password baru</label>
        <input type="password" name="password" minlength="6" placeholder="minimal 6 karakter" required></div>
      <button class="btn primary" type="submit">{ms("save")}Simpan password</button>
    </form>
  </div>

  <div class="card">
    <div class="card-h">
      <div class="t"><span class="icon-chip">{ms("info")}</span>
        <div>Gateway<div class="sub">info runtime</div></div></div>
      <span class="pill on">running</span>
    </div>
    <dl class="kv">
      <dt>Versi</dt><dd>x-router 0.2.0</dd>
      <dt>Base URL</dt><dd class="mono">{escape(base_url)}</dd>
      <dt>Provider</dt><dd>{len(reg)} di katalog · {s["connections"]} koneksi aktif</dd>
      <dt>API keys</dt><dd>{s["keys"]}</dd>
      <dt>Total request</dt><dd>{s["requests"]:,}</dd>
      <dt>Total token</dt><dd>{s["tokens"]:,}</dd>
      <dt>Database</dt><dd class="mono">data/xrouter.db (SQLite WAL)</dd>
      <dt>Engine</dt><dd>Python stdlib · tanpa dependensi</dd>
    </dl>
    <hr class="divider">
    <div class="card-h" style="margin-bottom:12px">
      <div class="t"><span class="icon-chip">{ms("cleaning_services")}</span>
        <div>Maintenance<div class="sub">operasi data</div></div></div>
    </div>
    <div style="display:flex;gap:9px;flex-wrap:wrap">
      <button class="btn secondary" onclick="backupDb()">{ms("save")}Backup DB</button>
      <button class="btn danger" onclick="clearLogs()">{ms("delete_sweep")}Bersihkan log</button>
    </div>
  </div>
</div>

<div class="card" style="margin-top:16px">
  <div class="card-h">
    <div class="t"><span class="icon-chip">{ms("database")}</span>
      <div>Data 30 hari<div class="sub">token & request per hari</div></div></div>
  </div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Hari</th><th>Request</th><th>Prompt</th><th>Completion</th><th>Total</th></tr></thead>
      <tbody>{"".join(f'<tr><td class="lead mono">{r["day"]}</td><td>{r["reqs"]}</td><td>{r["pt"]:,}</td><td>{r["ct"]:,}</td><td>{r["pt"]+r["ct"]:,}</td></tr>' for r in reversed(daily)) or '<tr><td colspan="5" class="muted" style="padding:22px;text-align:center">Belum ada data</td></tr>'}</tbody>
    </table>
  </div>
  <div style="font-size:12.5px;color:var(--color-text-subtle);margin-top:10px">
    Token 30 hari: <b style="color:var(--color-brand-300)">{tok:,}</b>
  </div>
</div>

<script>
function backupDb() {{
  fetch('/settings/backup', {{method:'POST'}}).then(function(r){{return r.json()}}).then(function(d){{
    if (d.ok) xrToast('success','Backup dibuat', d.file);
    else xrToast('error','Backup gagal', d.error || '');
  }}).catch(function(){{xrToast('error','Backup gagal')}});
}}
function clearLogs() {{
  xrConfirm({{title:'Bersihkan log', message:'Semua baris usageHistory dihapus. API key, koneksi & registry tetap aman. Lanjut?', okLabel:'Bersihkan'}}, function(){{
    fetch('/settings/clear-logs', {{method:'POST'}}).then(function(r){{return r.json()}}).then(function(d){{
      if (d.ok) {{ xrToast('success','Log dibersihkan', d.deleted + ' baris dihapus'); setTimeout(function(){{location.reload()}}, 900); }}
      else xrToast('error','Gagal', d.error || '');
    }}).catch(function(){{xrToast('error','Gagal')}});
  }});
}}
</script>"""
    return layout("settings", body, user)
