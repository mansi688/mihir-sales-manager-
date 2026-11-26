/* Mihir Sales — staff app (built from scratch). Hash routes, role-aware, mobile-first. */
(() => {
  /* ======================= utilities ======================= */
  const $ = (id) => document.getElementById(id);
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const inr = (n) => (n === null || n === undefined || n === '' ? '—' : '₹' + Number(n).toLocaleString('en-IN'));
  const inrShort = (n) => { n = Number(n) || 0; return n >= 1e7 ? `₹${(n / 1e7).toFixed(n >= 1e8 ? 0 : 2)} Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(1)} L` : inr(n); };
  const when = (s) => {
    if (!s) return ''; const d = new Date(s); const diff = (Date.now() - d) / 60000;
    if (diff < 1) return 'just now'; if (diff < 60) return `${Math.round(diff)} min ago`;
    const sameDay = d.toDateString() === new Date().toDateString();
    return sameDay ? d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) + ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };
  const day = (s) => (s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
  const first = (n) => String(n || '').split(' ')[0];
  const ph = (p) => { const d = String(p || '').replace(/\D/g, ''); return d.length === 12 && d.startsWith('91') ? `+91 ${d.slice(2, 7)} ${d.slice(7)}` : d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : '+' + d; };
  const ini = (n) => String(n || '?').split(' ').filter(Boolean).map((x) => x[0]).slice(0, 2).join('').toUpperCase();
  const avatar = (name, url, cls = '') => `<span class="avatar ${cls}">${url ? `<img src="${esc(url)}" alt="">` : esc(ini(name))}</span>`;
  const slugS = (s) => 's-' + String(s).toLowerCase().replace(/\s+/g, '-');

  const P = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h5v-6h4v6h5V9.5"/>',
    board: '<rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5c1.9.6 3.1 2.4 3.5 5.5"/>',
    stamp: '<path d="M9 3h6l-1 7h-4z"/><path d="M4 14h16v4H4zM6 21h12"/>',
    rupee: '<path d="M6 4h12M6 9h12M6 4c5 0 8 1.5 8 5s-3 5-8 5l8 6"/>',
    team: '<circle cx="12" cy="7" r="3.5"/><path d="M5 21c.8-4 3.5-6 7-6s6.2 2 7 6"/>',
    wa: '<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/><path d="M9 9.5c.3 2 2.5 4.2 4.5 4.5l1.2-1.2 1.8.9c-.3 1.3-1.3 2-2.5 1.8C10.8 15 9 13.2 8.5 10.5 8.3 9.3 9 8.3 10.3 8l.9 1.8z"/>',
    doc: '<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3v5h5M8.5 13h7M8.5 17h5"/>',
    print: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
    card: '<rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="11" r="2.2"/><path d="M5.8 16c.6-1.5 1.8-2.3 3.2-2.3s2.6.8 3.2 2.3M14.5 10h4M14.5 13.5h3"/>',
    out: '<path d="M15 4h4v16h-4"/><path d="m10 8-4 4 4 4M6 12h10"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    upload: '<path d="M12 16V4m0 0-4 4m4-4 4 4"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
    share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    cols: '<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="11" rx="1.5"/><rect x="17" y="4" width="4" height="7" rx="1.5"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    home2: '<path d="M4 21V8l8-5 8 5v13"/><path d="M9 21v-6h6v6"/>',
    sign: '<path d="M3 17c3-1 4-5 6-5s1 5 3 5 3-3 4-3 2 2 5 2"/><path d="M3 21h18"/>',
    alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  };
  const ic = (n, s) => `<svg class="ic" viewBox="0 0 24 24"${s ? ` style="width:${s}px;height:${s}px"` : ''}>${P[n] || ''}</svg>`;

  let toastT;
  const toast = (m, err) => { const t = $('toast'); t.textContent = m; t.className = 'toast show' + (err ? ' err' : ''); clearTimeout(toastT); toastT = setTimeout(() => (t.className = 'toast'), err ? 6000 : 2600); };

  async function api(path, opts = {}) {
    const o = { method: 'GET', headers: {}, ...opts };
    if (o.json !== undefined) { o.body = JSON.stringify(o.json); o.headers['Content-Type'] = 'application/json'; if (o.method === 'GET') o.method = 'POST'; }
    const r = await fetch(path, o);
    const j = await r.json().catch(() => ({}));
    if (r.status === 401 && path !== '/api/auth/login') { state.user = null; renderLogin(); throw new Error(j.error || 'Please log in'); }
    if (!r.ok) throw Object.assign(new Error(j.error || 'Something went wrong'), { errors: j.errors });
    return j;
  }
  const run = (fn) => async (...a) => { try { return await fn(...a); } catch (e) { toast(e.message, true); } };

  /* ======================= state & nav ======================= */
  const state = { user: null, org: null, stages: [], statuses: [], form: null, kiosk: null, view: { mode: 'list', stage: '', q: '' } };
  const NAV = {
    sales: [['home', 'Home', 'home'], ['customers', 'Customers', 'users'], ['forms', 'Forms', 'print'], ['profile', 'My card', 'card']],
    reception: [['board', 'Dashboard', 'board'], ['customers', 'Enquiries', 'users'], ['whatsapp', 'WhatsApp', 'wa'], ['forms', 'Forms', 'print']],
    manager: [['board', 'Dashboard', 'board'], ['customers', 'Customers', 'users'], ['approvals', 'Approvals', 'stamp'], ['team', 'Team', 'team'], ['whatsapp', 'WhatsApp', 'wa'], ['forms', 'Forms', 'print'], ['profile', 'My card', 'card']],
    accounts: [['payments', 'Payments', 'rupee'], ['customers', 'Customers', 'users'], ['forms', 'Forms', 'print']],
    admin: [['board', 'Dashboard', 'board'], ['customers', 'Customers', 'users'], ['approvals', 'Approvals', 'stamp'], ['payments', 'Payments', 'rupee'], ['team', 'Team', 'team'], ['whatsapp', 'WhatsApp', 'wa'], ['forms', 'Forms', 'print']],
  };
  const nav = () => NAV[state.user.role] || NAV.sales;
  const can = {
    sell: () => ['sales', 'manager', 'admin'].includes(state.user.role),
    desk: () => ['reception', 'manager', 'admin'].includes(state.user.role),
    approve: () => ['manager', 'admin'].includes(state.user.role),
  };
  const STAGE_TONE = { 'Walk-in': 'warn', Attending: 'info', 'Site visit': 'info', 'Booking form': 'cu', KYC: 'cu', Payment: 'cu', Signatures: 'cu', Booked: 'ok', Lost: 'bad' };
  const badge = (s) => `<span class="badge ${STAGE_TONE[s] || ''}"><i></i>${esc(s)}</span>`;
  const NEXT = {
    'Walk-in': 'Meet the customer', Attending: 'Log the site visit', 'Site visit': 'Start booking application', 'Booking form': 'Submit the application',
    KYC: 'Upload KYC documents', Payment: 'Record / verify payment', Signatures: 'Signatures & approval', Booked: 'Booked', Lost: 'Closed',
  };

  /* ======================= login ======================= */
  function renderLogin() {
    closeAll();
    $('root').innerHTML = `<div class="auth">
      <div class="art rings"><img class="logo" src="/assets/logo-light.png" alt="Mihir Group">
        <h1>Every walk-in, from hello to handshake.</h1>
        <p>Enquiries, site visits, booking applications, payments and signatures — beautifully in one place.</p>
        <div class="feat"><span>Reception kiosk</span><span>Smart assignment</span><span>Booking application</span><span>RERA-ready</span><span>e-Visiting cards</span></div></div>
      <div class="pane"><form id="lf" class="fade-in">
        <div class="over" style="color:var(--cu-d)">Mihir Sales</div><h1 style="margin:6px 0 4px">Welcome back</h1><p class="muted" style="margin-bottom:26px">Log in with your registered mobile number and PIN.</p>
        <div class="field"><label>Mobile number</label><input type="tel" name="phone" required placeholder="98XXX XXXXX" autocomplete="username" inputmode="numeric" maxlength="14"></div>
        <div class="field"><label>PIN</label><input type="password" name="pin" required inputmode="numeric" maxlength="6" placeholder="••••" autocomplete="current-password"></div>
        <button class="btn cu lg full mt-8" id="lb">Log in ${ic('arrow')}</button>
        <p class="xs muted mt-16">Forgot your PIN? Your sales manager can reset it from Team.</p>
        <a class="btn ghost full mt-16" href="/kiosk/">${ic('home2')} Open reception kiosk</a></form></div></div>`;
    $('lf').onsubmit = run(async (ev) => {
      ev.preventDefault(); const fd = new FormData(ev.target); $('lb').disabled = true;
      try { await api('/api/auth/login', { json: { phone: fd.get('phone'), pin: fd.get('pin') } }); await boot(); } finally { if ($('lb')) $('lb').disabled = false; }
    });
  }

  /* ======================= shell ======================= */
  function shell() {
    const u = state.user; const items = nav();
    const tab = items.slice(0, 4);
    $('root').innerHTML = `<div class="shell">
      <aside class="rail"><div class="brand"><img src="/assets/logo.png" alt="Mihir Group"></div>
        <button class="btn cu new" id="newWalk">${ic('plus')} New walk-in</button>
        <nav class="nav" id="nav">${items.map(([k, l, i]) => `<a href="#${k}" data-v="${k}">${ic(i)}<span>${l}</span><span class="cnt hide" data-cnt="${k}"></span></a>`).join('')}</nav>
        <div class="me">${avatar(u.name, u.photoUrl)}<div class="grow"><b>${esc(u.name)}</b><span>${esc(u.role)}</span></div><button class="btn ghost icon sm" id="out" title="Log out">${ic('out')}</button></div></aside>
      <div class="main"><header class="topbar" id="topbar"><img class="mlogo" src="/assets/logo.png" alt="Mihir">
          <div class="kbar" id="kbar">${ic('search')}<span>Search customers, IDs, mobile…</span><kbd>⌘K</kbd></div>
          <span class="grow hide-m"></span>
          <a class="btn line sm hide-m" href="#forms">${ic('print')} Forms</a>
          <button class="btn ghost icon show-m" id="out2" title="Log out">${ic('out')}</button></header>
        <main class="page" id="view"></main></div></div>
      <nav class="tabbar" id="tabbar">${tab.slice(0, 2).map(([k, l, i]) => `<a href="#${k}" data-v="${k}">${ic(i, 20)}<span>${l}</span></a>`).join('')}
        <button class="fab" id="newWalk2" aria-label="New walk-in">${ic('plus', 24)}</button>
        ${tab.slice(2, 4).map(([k, l, i]) => `<a href="#${k}" data-v="${k}">${ic(i, 20)}<span>${l}</span></a>`).join('')}</nav>`;
    const logout = run(async () => { await api('/api/auth/logout', { method: 'POST' }); state.user = null; renderLogin(); });
    $('out').onclick = logout; $('out2').onclick = logout;
    $('kbar').onclick = openCmdk;
    const nw = run(async () => { if (!state.kiosk) state.kiosk = (await api('/api/kiosk-link')).url; window.open(state.kiosk, '_blank'); });
    $('newWalk').onclick = nw; $('newWalk2').onclick = nw;
    window.onscroll = () => $('topbar') && $('topbar').classList.toggle('scrolled', window.scrollY > 4);
    refreshCounts();
  }
  async function refreshCounts() {
    try {
      const s = await api('/api/stats'); state.stats = s;
      const set = (k, n) => { const el = qs(`[data-cnt="${k}"]`); if (el) { el.textContent = n; el.classList.toggle('hide', !n); } };
      set('approvals', s.approvals); set('payments', s.pendingPayments);
    } catch { /* ignore */ }
  }

  let boardTimer;
  function route() {
    if (!state.user) return;
    clearInterval(boardTimer);
    closeAll();
    const h = location.hash.slice(1);
    const allowed = nav().map((n) => n[0]);
    if (h.startsWith('c-')) { mark('customers'); return guard(viewCustomer(h.slice(2))); }
    const v = allowed.includes(h) ? h : allowed[0];
    mark(v);
    const fn = { home: viewHome, board: viewBoard, customers: viewCustomers, approvals: viewApprovals, payments: viewPayments, team: viewTeam, whatsapp: viewWhatsApp, forms: viewForms, profile: viewProfile }[v];
    guard(fn());
  }
  const mark = (v) => qsa('#nav a, #tabbar a').forEach((a) => a.classList.toggle('on', a.dataset.v === v));
  const guard = (p) => Promise.resolve(p).catch((e) => toast(e.message, true));
  const go = (h) => { if (location.hash === '#' + h) route(); else location.hash = h; };
  window.addEventListener('hashchange', route);
  const skel = (n = 3, h = 120) => `<div class="g g3">${Array.from({ length: n }, () => `<div class="skel" style="height:${h}px"></div>`).join('')}</div>`;
  const loading = () => { $('view').innerHTML = `<div class="skel" style="height:34px;width:240px;margin-bottom:20px"></div>${skel(3, 110)}<div class="skel mt-16" style="height:320px"></div>`; window.scrollTo(0, 0); };
  const pageHead = (t, sub, actions = '') => `<div class="ph"><div><h1>${t}</h1>${sub ? `<p>${sub}</p>` : ''}</div><div class="row">${actions}</div></div>`;
  const tile = (label, v, icon, tone = '') => `<div class="card tile"><div class="top"><span class="ico ${tone}">${ic(icon, 20)}</span></div><div><div class="v num">${v}</div><div class="l">${label}</div></div></div>`;

  /* ======================= overlays ======================= */
  function modal({ title, sub = '', body, onOpen, wide }) {
    closeModal();
    const scrim = document.createElement('div'); scrim.className = 'scrim'; scrim.id = 'scrim';
    const m = document.createElement('div'); m.className = 'modal'; m.id = 'modal'; if (wide) m.style.width = 'min(720px,calc(100vw - 24px))';
    m.innerHTML = `<div class="mh"><div><h2>${title}</h2>${sub ? `<p class="muted sm" style="margin-top:4px">${sub}</p>` : ''}</div><button class="btn ghost icon sm" data-close>${ic('x')}</button></div><div class="mb">${body}</div>`;
    document.body.append(scrim, m);
    scrim.onclick = closeModal; qsa('[data-close]', m).forEach((b) => (b.onclick = closeModal));
    onOpen && onOpen(m);
    return m;
  }
  function closeModal() { ['modal', 'scrim'].forEach((id) => { const el = $(id); if (el) el.remove(); }); }
  function closeAll() { closeModal(); const w = $('wiz'); if (w) { w.remove(); document.body.style.overflow = ''; } }
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && state.user) { e.preventDefault(); openCmdk(); }
    if (e.key === 'Escape') closeModal();
  });

  function openCmdk() {
    closeModal();
    const scrim = document.createElement('div'); scrim.className = 'scrim'; scrim.id = 'scrim';
    const m = document.createElement('div'); m.className = 'modal cmdk'; m.id = 'modal';
    m.innerHTML = `<div class="ci">${ic('search', 20)}<input id="cq" placeholder="Search by name, mobile or enquiry ID…" autocomplete="off"><span class="xs muted">ESC</span></div><div class="res" id="cres"><div class="empty sm">Start typing to find a customer</div></div>`;
    document.body.append(scrim, m); scrim.onclick = closeModal;
    const inp = $('cq'); inp.focus();
    let t, items = [], sel = 0;
    const draw = () => { $('cres').innerHTML = items.length ? items.map((e, i) => `<div class="r ${i === sel ? 'on' : ''}" data-i="${i}">${avatar(e.name)}<div class="grow"><b>${esc(e.name)}</b><div class="xs muted">${e.id} · ${esc(e.mobile)} · ${esc(e.project_name)}</div></div>${badge(e.stage)}</div>`).join('') : '<div class="empty sm">No matches</div>'; qsa('.r', m).forEach((r) => (r.onclick = () => { closeModal(); go('c-' + items[r.dataset.i].id); })); };
    inp.oninput = () => { clearTimeout(t); t = setTimeout(run(async () => { if (!inp.value.trim()) { $('cres').innerHTML = '<div class="empty sm">Start typing to find a customer</div>'; items = []; return; } items = (await api('/api/enquiries?q=' + encodeURIComponent(inp.value.trim()))).enquiries.slice(0, 8); sel = 0; draw(); }), 180); };
    inp.onkeydown = (e) => { if (e.key === 'ArrowDown') { sel = Math.min(items.length - 1, sel + 1); draw(); e.preventDefault(); } if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); draw(); e.preventDefault(); } if (e.key === 'Enter' && items[sel]) { closeModal(); go('c-' + items[sel].id); } };
  }

  /* ======================= HOME (sales) ======================= */
  async function viewHome() {
    loading();
    const u = state.user;
    const [{ enquiries }, s] = await Promise.all([api('/api/enquiries?mine=1'), api('/api/stats')]);
    const active = enquiries.filter((e) => !['Booked', 'Lost'].includes(e.stage));
    const hr = new Date().getHours(); const greet = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
    $('view').innerHTML = `<div class="fade-in">
      <div class="hero rings"><div class="grow"><div class="over" style="color:var(--cu-l)">${greet}, ${esc(first(u.name))}</div><h1 style="font-size:28px;margin-top:6px">You have ${active.length} active customer${active.length === 1 ? '' : 's'}</h1>
        <div class="sub mt-8">${u.projects.map((p) => esc(p.name)).join(' · ') || 'No projects assigned yet'}</div></div>
        <div class="stack gap-6"><span class="over" style="color:#C5C9DE">My status</span><div class="status-pick" id="st">${state.statuses.map((x) => `<button data-s="${x}" class="${u.status === x ? 'on' : ''}"><span class="dot ${slugS(x)}"></span>${x}</button>`).join('')}</div></div></div>
      <div class="g g4 mt-16">${tile('New today', s.today, 'bolt', 'warn')}${tile('In booking', ['Booking form', 'KYC', 'Payment', 'Signatures'].reduce((a, k) => a + (s.stages[k] || 0), 0), 'doc', 'cu')}${tile('Booked this month', s.bookedThisMonth, 'star', 'ok')}${tile('Value booked (month)', inrShort(s.valueThisMonth), 'rupee')}</div>
      <div class="g mt-16 split">
        <div class="card"><div class="card-h"><h3>Next actions</h3><a class="btn ghost sm" href="#customers">All customers ${ic('arrow', 16)}</a></div><div class="card-b">
          ${active.length ? `<div class="list">${active.slice(0, 8).map((e) => `<div class="li go" data-c="${e.id}">${avatar(e.name)}<div class="grow"><b>${esc(e.name)}</b><div class="xs muted">${esc(e.project_name)} · ${esc(e.config)} · ${when(e.updated_at)}</div></div><div class="stack" style="align-items:flex-end;gap:4px">${badge(e.stage)}<span class="xs b hide-m" style="color:var(--cu-d)">${NEXT[e.stage]} →</span></div></div>`).join('')}</div>`
            : `<div class="empty">${ic('users')}<div class="b">No active customers</div><div class="sm">New walk-ins assigned to you appear here instantly.</div></div>`}</div></div>
        <div class="card"><div class="card-h"><h3>My pipeline</h3></div><div class="card-b">${funnel(s.stages)}</div></div>
      </div></div>`;
    qsa('[data-c]').forEach((el) => (el.onclick = () => go('c-' + el.dataset.c)));
    qsa('#st button').forEach((b) => (b.onclick = run(async () => { const j = await api('/api/me', { method: 'PATCH', json: { status: b.dataset.s } }); state.user = j.user; qsa('#st button').forEach((x) => x.classList.toggle('on', x === b)); toast('Status: ' + b.dataset.s); })));
  }
  function funnel(stages) {
    const order = ['Walk-in', 'Attending', 'Site visit', 'Booking form', 'KYC', 'Payment', 'Signatures', 'Booked'];
    const max = Math.max(1, ...order.map((k) => stages[k] || 0));
    return `<div class="funnel">${order.map((k) => `<div class="fb"><span>${k}</span><span class="bar"><i style="width:${((stages[k] || 0) / max) * 100}%"></i></span><span class="num" style="text-align:right">${stages[k] || 0}</span></div>`).join('')}</div>`;
  }

  /* ======================= DASHBOARD (reception / manager) ======================= */
  async function viewBoard() {
    loading();
    const draw = async () => {
      const [b, s] = await Promise.all([api('/api/board'), api('/api/stats')]);
      const st = b.stats;
      $('view').innerHTML = `<div class="fade-in">${pageHead('Dashboard', `${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} · updates live`, `<button class="btn cu" id="nw3">${ic('plus')} New walk-in</button>`)}
        <div class="g g4">${tile('Walk-ins today', st.walkins, 'users')}${tile('Waiting to be met', st.waiting, 'clock', 'warn')}${tile('Booked today', st.booked, 'star', 'ok')}${tile('Sales team free', `${st.free}<span class="muted" style="font-size:18px"> / ${st.team}</span>`, 'team', 'cu')}</div>
        ${st.unassigned ? `<div class="banner warn mt-16">${ic('alert')}<span><b>${st.unassigned} walk-in(s) need a sales person</b> — nobody was available. Assign them below.</span></div>` : ''}
        <div class="g mt-16 split">
          <div class="card"><div class="card-h"><h3>Walk-ins today</h3><span class="badge plain">${b.enquiries.length}</span></div>
            ${b.enquiries.length ? `<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Customer</th><th class="hide-m">Interest</th><th>Assigned to</th><th class="hide-m">Stage</th><th></th></tr></thead><tbody>
            ${b.enquiries.map((e) => `<tr class="go" data-c="${e.id}"><td><div class="person">${avatar(e.name)}<div style="min-width:0"><b>${esc(e.name)}</b><div class="xs muted">${when(e.created_at)} · ${e.id}</div></div></div></td>
              <td class="hide-m"><b class="sm">${esc(e.project_name)}</b><div class="xs muted">${esc(e.config)} · ${esc(e.source)}</div></td>
              <td data-stop><select data-re="${e.id}" style="height:36px;min-width:140px"><option value="">— assign —</option>${b.team.map((x) => `<option value="${x.id}" ${x.id === e.assigned_to ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></td>
              <td class="hide-m">${badge(e.stage)}${e.wa_linked_at ? ' <span class="badge ok">WA</span>' : ''}</td>
              <td data-stop>${e.assigned_to ? `<a class="btn wa sm icon" title="Send the alert to the sales person on WhatsApp" target="_blank" rel="noopener" href="${alertLink(e, b.team.find((x) => x.id === e.assigned_to))}">${ic('wa', 16)}</a>` : ''}</td></tr>`).join('')}</tbody></table></div>`
              : `<div class="empty">${ic('users')}<div class="b">No walk-ins yet today</div><div class="sm">Open the kiosk on the reception tablet to start.</div></div>`}</div>
          <div class="stack gap-14"><div class="card"><div class="card-h"><h3>Sales team</h3></div><div class="card-b"><div class="list">${b.team.map((x) => `<div class="li">${avatar(x.name, x.photoUrl)}<div class="grow"><b class="sm">${esc(x.name)}</b><div class="xs muted">${x.today} today · ${x.projects.map((p) => esc(p.name)).join(', ')}</div></div>
              <select data-st="${x.id}" style="height:34px;width:auto;font-size:12.5px;padding-left:10px">${state.statuses.map((v) => `<option ${v === x.status ? 'selected' : ''}>${v}</option>`).join('')}</select></div>`).join('')}</div></div></div>
            <div class="card"><div class="card-h"><h3>Pipeline</h3></div><div class="card-b">${funnel(s.stages)}</div></div></div>
        </div></div>`;
      $('nw3').onclick = () => $('newWalk').click();
      qsa('tr[data-c]').forEach((tr) => (tr.onclick = (ev) => { if (!ev.target.closest('[data-stop]')) go('c-' + tr.dataset.c); }));
      qsa('[data-st]').forEach((sel) => (sel.onchange = run(async () => { await api(`/api/team/${sel.dataset.st}/status`, { method: 'PATCH', json: { status: sel.value } }); toast('Status updated'); })));
      qsa('[data-re]').forEach((sel) => (sel.onchange = () => { if (sel.value) reassign(sel.dataset.re, sel.value, sel.selectedOptions[0].text, () => guard(draw())); }));
    };
    await draw();
    boardTimer = setInterval(() => { if (!$('modal') && location.hash.slice(1) === 'board') guard(draw()); }, 20000);
  }
  const alertLink = (e, x) => (x ? `https://wa.me/${x.phone}?text=${encodeURIComponent(`🔔 New walk-in assigned to you\n${e.id}\n👤 ${e.name}\n📱 +91 ${e.mobile}\n🏢 ${e.project_name} · ${e.config}\n💰 ${e.budget}\n📣 ${e.source}${e.cp_name ? ' (' + e.cp_name + ')' : ''}\nCustomer is at reception.`)}` : '#');

  function reassign(id, userId, name, after) {
    modal({ title: `Assign to ${esc(name)}`, sub: `${id} · the reason is saved in the audit log`, body: `
      <div class="field"><label>Reason</label><select id="rr"><option>Assigned person busy / in a meeting</option><option>Customer asked for someone else</option><option>Language preference</option><option>Project specialist needed</option><option>No one was on duty</option><option>Other</option></select></div>
      <div class="row" style="justify-content:flex-end"><button class="btn line" data-close>Cancel</button><button class="btn cu" id="ok">${ic('check')} Assign & notify</button></div>`,
    onOpen: (m) => { $('ok').onclick = run(async () => { await api(`/api/enquiries/${id}/reassign`, { json: { userId, reason: $('rr').value } }); closeModal(); toast('Assigned'); after && after(); }); qsa('[data-close]', m).forEach((b) => (b.onclick = () => { closeModal(); after && after(); })); } });
  }

  /* ======================= CUSTOMERS ======================= */
  async function viewCustomers() {
    const mine = state.user.role === 'sales';
    const v = state.view;
    $('view').innerHTML = `<div class="fade-in">${pageHead(mine ? 'My customers' : 'Customers', 'Every enquiry and where it stands.',
      `<div class="seg" id="mode"><button data-m="list" class="${v.mode === 'list' ? 'on' : ''}">${ic('list', 16)} List</button><button data-m="board" class="${v.mode === 'board' ? 'on' : ''}">${ic('cols', 16)} Pipeline</button></div>`)}
      <div class="row mb-16"><div class="search grow" style="max-width:380px">${ic('search')}<input type="text" id="q" placeholder="Search name, mobile or ID" value="${esc(v.q)}"></div></div>
      <div class="chips mb-16" id="stg"></div><div id="cl">${skel(3, 90)}</div></div>`;
    let all = [];
    const drawChips = () => {
      const counts = {}; all.forEach((e) => (counts[e.stage] = (counts[e.stage] || 0) + 1));
      $('stg').innerHTML = [['', 'All', all.length], ...state.stages.filter((s) => counts[s]).map((s) => [s, s, counts[s]])].map(([k, l, n]) => `<button class="chip ${v.stage === k ? 'on' : ''}" data-k="${k}">${l}<span class="n">${n}</span></button>`).join('');
      qsa('#stg .chip').forEach((c) => (c.onclick = () => { v.stage = c.dataset.k; drawChips(); drawList(); }));
      $('stg').classList.toggle('hide', v.mode === 'board');
    };
    const drawList = () => {
      const rows = all.filter((e) => !v.stage || e.stage === v.stage);
      if (v.mode === 'board') {
        const cols = state.stages.filter((s) => s !== 'Lost');
        $('cl').innerHTML = `<div class="kanban">${cols.map((s) => { const items = all.filter((e) => e.stage === s); return `<div class="col"><div class="col-h"><span>${s}</span><span class="badge plain">${items.length}</span></div>
          ${items.map((e) => `<div class="kc" data-c="${e.id}"><div class="row spread"><b>${esc(e.name)}</b><span class="xs faint">${e.id}</span></div><div class="xs muted mt-8">${esc(e.project_name)} · ${esc(e.config)}</div><div class="row spread mt-8"><span class="xs b" style="color:var(--cu-d)">${esc(e.budget)}</span>${mine ? '' : `<span class="xs muted">${esc(first(e.assigned_name) || '—')}</span>`}</div></div>`).join('') || '<div class="xs faint" style="padding:8px">—</div>'}</div>`; }).join('')}</div>`;
      } else {
        $('cl').innerHTML = rows.length ? `<div class="card">${rows.map((e) => `<div class="li go" style="margin:0;border-radius:0;padding:14px 18px;border-bottom:1px solid var(--line-2)" data-c="${e.id}">${avatar(e.name)}
            <div class="grow"><div class="row gap-6"><b>${esc(e.name)}</b><span class="xs faint">${e.id}</span></div><div class="xs muted">${esc(e.project_name)} · ${esc(e.config)} · ${esc(e.budget)}${mine ? '' : ' · ' + esc(e.assigned_name || 'Unassigned')}</div></div>
            <div class="stack" style="align-items:flex-end;gap:3px">${badge(e.stage)}<span class="xs muted hide-m">${when(e.updated_at)}</span></div></div>`).join('')}</div>`
          : `<div class="card"><div class="empty">${ic('users')}<div class="b">No customers here</div><div class="sm">Try another filter or search.</div></div></div>`;
      }
      qsa('[data-c]', $('cl')).forEach((el) => (el.onclick = () => go('c-' + el.dataset.c)));
    };
    const load = run(async () => { all = (await api('/api/enquiries?' + new URLSearchParams({ q: v.q }))).enquiries; drawChips(); drawList(); });
    let t; $('q').oninput = () => { v.q = $('q').value; clearTimeout(t); t = setTimeout(load, 220); };
    qsa('#mode button').forEach((b) => (b.onclick = () => { v.mode = b.dataset.m; qsa('#mode button').forEach((x) => x.classList.toggle('on', x === b)); drawChips(); drawList(); }));
    load();
  }

  /* ======================= CUSTOMER JOURNEY ======================= */
  const JSTEPS = [
    { k: 'meet', t: 'Meet', at: 'Walk-in', done: 'Attending' },
    { k: 'visit', t: 'Site visit', at: 'Attending', done: 'Site visit' },
    { k: 'app', t: 'Booking application', at: 'Site visit', done: 'KYC' },
    { k: 'kyc', t: 'KYC documents', at: 'KYC', done: 'Payment' },
    { k: 'pay', t: 'Booking payment', at: 'Payment', done: 'Signatures' },
    { k: 'sign', t: 'Signatures', at: 'Signatures', done: null },
    { k: 'approve', t: 'Developer approval', at: 'Signatures', done: 'Booked' },
  ];
  const KYC = [['pan', 'PAN card', true], ['aadhaar', 'Aadhaar', true], ['photo', 'Passport photo', true], ['co_pan', 'Co-applicant PAN', false], ['co_aadhaar', 'Co-applicant Aadhaar', false], ['other', 'Other document', false]];
  const MODES = ['UPI', 'NEFT/RTGS', 'IMPS', 'Cheque', 'Demand Draft', 'Payment link'];
  let selStep = null;

  async function viewCustomer(id, keepStep) {
    if (!keepStep) loading();
    const { enquiry: e } = await api('/api/enquiries/' + id);
    const S = state.stages; const si = (s) => S.indexOf(s); const ci = e.stage === 'Lost' ? -1 : si(e.stage);
    const b = e.booking || {}; const form = b.extra || {}; const hasA2 = !!(form.a2 && form.a2.name);
    const sig = e.signatures; const paid = e.payments.find((p) => p.status === 'Received'); const pending = e.payments.find((p) => p.status === 'Pending verification');
    const signed = !!sig.customer && (!hasA2 || !!sig.co_applicant);
    const status = (st) => {
      if (st.k === 'sign') return signed ? 'done' : paid ? 'cur' : 'lock';
      if (st.k === 'approve') return sig.developer ? 'done' : signed && paid ? 'cur' : 'lock';
      if (st.k === 'app' && e.booking && ci < si('KYC')) return 'cur';
      if (ci >= si(st.done)) return 'done';
      if (ci >= si(st.at)) return 'cur';
      return 'lock';
    };
    const curStep = (JSTEPS.find((st) => status(st) === 'cur') || JSTEPS[JSTEPS.length - 1]).k;
    if (!keepStep || !selStep) { selStep = state.wantStep || (e.stage === 'Booked' ? 'approve' : curStep); state.wantStep = null; }
    const pct = e.stage === 'Booked' ? 8 : Math.max(0, ci);

    $('view').innerHTML = `<div class="fade-in">
      <a class="btn ghost sm" href="#customers" style="margin:-6px 0 10px -8px">${ic('back', 16)} Customers</a>
      <div class="card p"><div class="cust-h">${avatar(e.name, null, 'lg')}
        <div class="grow"><h1>${esc(e.name)} ${badge(e.stage)}</h1>
          <div class="sm muted mt-8"><span class="b">${e.id}</span> · ${esc(e.project_name)} · ${esc(e.config)} · ${esc(e.budget)} · ${esc(e.source)}${e.cp_name ? ' — ' + esc(e.cp_name) : ''}</div>
          <div class="sm mt-8 row gap-6">${ic('team', 16)}<span class="b">${esc(e.assigned_name || 'Unassigned')}</span><span class="xs muted">${esc(e.assign_reason)}</span></div></div>
        <div class="row">
          <a class="btn line sm" href="tel:+91${esc(e.mobile)}">${ic('phone', 16)} Call</a>
          <a class="btn wa sm" target="_blank" rel="noopener" href="https://wa.me/91${esc(e.mobile)}?text=${encodeURIComponent('Hi ' + first(e.name) + ', this is ' + (e.assigned_name || state.user.name) + ' from ' + state.org.name + '.')}">${ic('wa', 16)} WhatsApp</a>
          <a class="btn line sm" target="_blank" rel="noopener" href="/api/enquiries/${e.id}/enquiry.pdf">${ic('print', 16)} Enquiry form</a>
          ${e.booking ? `<a class="btn line sm" target="_blank" rel="noopener" href="/api/enquiries/${e.id}/${sig.developer ? 'booking' : 'application'}.pdf">${ic('doc', 16)} Application</a>` : ''}
          ${can.desk() && !['Booked', 'Lost'].includes(e.stage) ? '<button class="btn line sm" id="bRe">Reassign</button>' : ''}
          ${can.sell() && !['Booked', 'Lost'].includes(e.stage) ? '<button class="btn danger sm" id="bLost">Mark lost</button>' : ''}</div></div>
        ${e.stage === 'Lost' ? '<div class="banner warn mt-16">This enquiry was marked lost.</div>' : `<div class="track">${S.filter((s) => s !== 'Lost').map((s, i) => `<span class="${i < pct ? 'done' : i === pct ? 'cur' : ''}" title="${s}"></span>`).join('')}</div>`}</div>
      <div class="journey">
        <div class="card steps">${JSTEPS.map((st, i) => { const s = status(st); return `<div class="step ${s} ${selStep === st.k ? 'sel' : ''}" data-s="${st.k}"><span class="n">${s === 'done' ? ic('check', 16) : s === 'lock' ? ic('lock', 14) : i + 1}</span><div><b>${st.t}</b><small>${s === 'done' ? 'Completed' : s === 'cur' ? 'Next up' : 'Locked'}</small></div></div>`; }).join('')}</div>
        <div class="stack gap-14"><div class="card p" id="panel"></div>
          <div class="card"><div class="card-h"><div class="seg" id="tabs"><button class="on" data-t="act">Activity</button><button data-t="det">Details</button><button data-t="sync">CRM sync</button></div></div><div class="card-b" id="tabb"></div></div></div>
      </div></div>`;

    const re = () => guard(viewCustomer(id, true));
    const post = (p, json) => api(`/api/enquiries/${id}/${p}`, { json: json || {} });
    qsa('.step').forEach((el) => (el.onclick = () => { selStep = el.dataset.s; qsa('.step').forEach((x) => x.classList.toggle('sel', x === el)); drawPanel(); if (window.innerWidth < 980) $('panel').scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
    if ($('bRe')) $('bRe').onclick = run(async () => {
      const { team } = await api('/api/board');
      modal({ title: 'Reassign customer', sub: `${e.id} · ${esc(e.name)}`, body: `<div class="field"><label>Sales person</label><select id="rp">${team.filter((t) => t.id !== e.assigned_to).map((t) => `<option value="${t.id}">${esc(t.name)} — ${esc(t.status)}</option>`).join('')}</select></div>
        <div class="field"><label>Reason</label><select id="rr"><option>Assigned person busy / in a meeting</option><option>Customer asked for someone else</option><option>Language preference</option><option>Project specialist needed</option><option>Other</option></select></div>
        <div class="row" style="justify-content:flex-end"><button class="btn line" data-close>Cancel</button><button class="btn cu" id="ok">Reassign</button></div>`,
      onOpen: () => { $('ok').onclick = run(async () => { await post('reassign', { userId: $('rp').value, reason: $('rr').value }); closeModal(); toast('Reassigned'); re(); }); } });
    });
    if ($('bLost')) $('bLost').onclick = () => modal({ title: 'Mark as lost', sub: 'The reason is shared with the CRM.', body: `<div class="chips mb-16" id="lr">${['Budget', 'Location', 'Bought elsewhere', 'Not interested', 'Loan not approved', 'Other'].map((x) => `<button class="chip" data-v="${x}">${x}</button>`).join('')}</div>
      <div class="field"><label>Note (optional)</label><input type="text" id="ln"></div><div class="row" style="justify-content:flex-end"><button class="btn line" data-close>Cancel</button><button class="btn danger" id="ok">Mark lost</button></div>`,
    onOpen: () => { let r = ''; qsa('#lr .chip').forEach((c) => (c.onclick = () => { r = c.dataset.v; qsa('#lr .chip').forEach((x) => x.classList.toggle('on', x === c)); })); $('ok').onclick = run(async () => { await post('lost', { reason: [r, $('ln').value].filter(Boolean).join(' — ') }); closeModal(); toast('Marked lost'); re(); }); } });

    const drawTab = (t) => {
      $('tabb').innerHTML = t === 'act' ? `${can.sell() || can.desk() ? `<div class="row mb-16"><input type="text" id="note" placeholder="Add a note or follow-up…" style="flex:1;min-width:180px"><button class="btn sm" id="bNote">Add</button></div>` : ''}
          <ul class="feed">${e.activities.map((a) => `<li><span class="d"></span><div><div class="sm b">${esc(a.note || a.type)}</div><div class="xs muted">${when(a.at)} · ${esc(a.user_name || 'System')}</div></div></li>`).join('')}</ul>`
        : t === 'det' ? `<dl class="kv"><dt>Mobile</dt><dd>${ph(e.mobile)} ${e.wa_linked_at ? '<span class="badge ok">on WhatsApp</span>' : ''}</dd><dt>Email</dt><dd>${esc(e.email || '—')}</dd><dt>Residence</dt><dd>${esc(e.residence || '—')}</dd>
            <dt>Interest</dt><dd>${esc(e.project_name)} · ${esc(e.config)}</dd><dt>Budget</dt><dd>${esc(e.budget)}</dd><dt>Purpose</dt><dd>${esc(e.purpose || '—')}</dd><dt>Source</dt><dd>${esc(e.source)}${e.cp_name ? ' — ' + esc(e.cp_name) : ''}</dd>
            <dt>Visit preference</dt><dd>${esc(e.visit_pref || '—')}</dd><dt>Walked in</dt><dd>${when(e.created_at)}</dd></dl>`
          : `<div class="row mb-12">${e.sync.some((x) => x.status === 'failed') ? '<button class="btn danger sm" id="bRetry">Retry failed sync</button>' : '<span class="badge ok"><i></i>CRM in sync</span>'}</div><div class="log">${e.sync.map((x) => `${when(x.at)}  [${x.target}] ${x.action} → ${x.status}`).map(esc).join('\n') || 'Nothing yet.'}</div>`;
      if ($('bNote')) $('bNote').onclick = run(async () => { const n = $('note').value.trim(); if (!n) return; await post('notes', { note: n }); toast('Note added'); re(); });
      if ($('bRetry')) $('bRetry').onclick = run(async () => { await post('sync/retry'); toast('Retried'); re(); });
    };
    qsa('#tabs button').forEach((bn) => (bn.onclick = () => { qsa('#tabs button').forEach((x) => x.classList.toggle('on', x === bn)); drawTab(bn.dataset.t); }));
    drawTab('act');

    const head = (k, title, sub) => `<div class="row spread mb-16"><div><h2>${title}</h2>${sub ? `<p class="muted sm mt-8">${sub}</p>` : ''}</div>${curStep === k && !['Booked', 'Lost'].includes(e.stage) ? '<span class="next-up">' + ic('bolt', 13) + ' Next up</span>' : ''}</div>`;
    const lockNote = (msg) => `<div class="banner info">${ic('lock')}<span>${msg}</span></div>`;
    function drawPanel() {
      const Pn = $('panel'); const st = JSTEPS.find((x) => x.k === selStep); const s = status(st);
      const sell = can.sell();
      if (selStep === 'meet') {
        Pn.innerHTML = head('meet', 'Meet the customer', 'Greet them in the lounge and start the conversation.') + `<dl class="kv"><dt>Customer</dt><dd>${esc(e.name)} · ${ph(e.mobile)}</dd><dt>Looking for</dt><dd>${esc(e.project_name)} · ${esc(e.config)} · ${esc(e.budget)}</dd><dt>Visit</dt><dd>${esc(e.visit_pref || '—')}</dd></dl>
          <div class="row mt-16">${e.stage === 'Walk-in' && sell ? `<button class="btn cu lg" id="bAttend">${ic('check')} I'm with the customer</button>` : `<span class="badge ok"><i></i>Met ${when((e.activities.find((a) => a.type === 'attending') || {}).at)}</span>`}
          <a class="btn wa" target="_blank" rel="noopener" href="https://wa.me/91${esc(e.mobile)}?text=${encodeURIComponent(`Hi ${first(e.name)}, I'm ${e.assigned_name || state.user.name} from ${state.org.name}. Welcome! Here's my card: ${state.user.cardUrl}`)}">${ic('wa', 16)} Send my card</a></div>`;
        if ($('bAttend')) $('bAttend').onclick = run(async () => { await post('attend'); toast('Status set to "With customer"'); selStep = 'visit'; re(); });
      } else if (selStep === 'visit') {
        const done = e.activities.find((a) => a.type === 'site_visit');
        Pn.innerHTML = head('visit', 'Site visit', 'Which units did you show, and how did it go?') + (s === 'lock' ? lockNote('Starts after you meet the customer.') : `${done ? `<div class="banner ok mb-16">${ic('check')}<span>${esc(done.note)}</span></div>` : ''}
          <div class="fgrid"><div class="field"><label>Units shown</label><input type="text" id="svU" placeholder="e.g. A-1204, A-0905"></div>
          <div class="field"><label>How interested?</label><select id="svF"><option>Hot — ready to book</option><option>Warm — family visit needed</option><option>Cold — just exploring</option></select></div></div>
          <div class="field"><label>Note</label><input type="text" id="svN" placeholder="Optional"></div>${sell ? `<button class="btn cu" id="bVisit">${ic('check')} Save site visit</button>` : ''}`);
        if ($('bVisit')) $('bVisit').onclick = run(async () => { await post('visit', { units: $('svU').value, feedback: $('svF').value, note: $('svN').value }); toast('Site visit saved'); selStep = 'app'; re(); });
      } else if (selStep === 'app') {
        const submitted = ci >= si('KYC');
        Pn.innerHTML = head('app', 'Booking application', 'The 12-section Mihir booking application, filled with the customer.') + (s === 'lock' && !e.booking ? lockNote('Opens once you have met the customer.') : `
          ${e.booking ? `<div class="unit mb-16"><div><span>Unit</span><b>${esc(b.tower)} · ${esc(b.unit)}</b></div><div><span>Floor</span><b>${esc(b.floor || '—')}</b></div><div><span>Carpet</span><b>${esc(b.carpet_area || '—')} sq ft</b></div><div><span>Total</span><b>${inrShort(b.total_consideration)}</b></div>
            <div><span>Applicants</span><b>${esc(first((form.a1 && form.a1.name) || e.name))}${hasA2 ? ' + ' + esc(first(form.a2.name)) : ''}</b></div><div><span>Status</span><b>${submitted ? 'Submitted' : 'Draft'}</b></div></div>
            ${b.hold_until ? `<div class="banner cu mb-16">${ic('clock')}<span>Flat on hold until <b>${when(b.hold_until)}</b>.</span></div>` : ''}` : `<div class="banner info mb-16">${ic('doc')}<span>Choose the flat from live inventory and fill the application together with the customer. Drafts hold the flat for 48 hours.</span></div>`}
          <div class="row"><button class="btn cu lg" id="bApp">${ic('doc')} ${e.booking ? (e.stage === 'Booked' || !sell ? 'View application' : 'Continue application') : 'Start booking application'}</button>
          ${e.booking ? `<a class="btn line" target="_blank" rel="noopener" href="/api/enquiries/${e.id}/application.pdf">${ic('print', 16)} Print / PDF</a>` : ''}</div>`);
        if ($('bApp')) $('bApp').onclick = run(() => openWizard(e, re));
      } else if (selStep === 'kyc') {
        const have = new Set(e.kyc.map((k) => k.kind));
        Pn.innerHTML = head('kyc', 'KYC documents', 'Take photos with the phone camera — they are compressed automatically.') + (s === 'lock' ? lockNote('Submit the booking application first.') : `
          ${KYC.filter(([k, , req]) => req || hasA2 || have.has(k) || k === 'other').map(([k, l, req]) => { const docs = e.kyc.filter((d) => d.kind === k); return `<div class="doc-row ${docs.length ? 'ok' : ''}"><span class="ico">${docs.length ? ic('check') : ic('doc')}</span><div class="grow"><b class="sm">${l}${req ? '' : ' <span class="xs muted">(optional)</span>'}</b><div class="xs muted">${docs.length ? `Uploaded ${when(docs[docs.length - 1].uploaded_at)}` : 'Not uploaded'}</div></div>
            ${docs.map((d) => `<a class="btn ghost sm icon" target="_blank" rel="noopener" href="/api/files/${d.file_id}">${ic('eye', 16)}</a>`).join('')}
            ${sell && ci < si('Booked') ? `<label class="btn line sm" style="cursor:pointer">${ic('upload', 16)} ${docs.length ? 'Replace' : 'Upload'}<input type="file" data-k="${k}" hidden accept="image/*,application/pdf"></label>` : ''}</div>`; }).join('')}
          ${sell ? `<button class="btn cu mt-12" id="bKyc" ${['pan', 'aadhaar', 'photo'].every((k) => have.has(k)) && ci < si('Payment') ? '' : 'disabled'}>${ic('check')} KYC complete</button>` : ''}`);
        qsa('input[data-k]', Pn).forEach((inp) => (inp.onchange = run(async () => { if (!inp.files[0]) return; const fd = new FormData(); fd.append('kind', inp.dataset.k); fd.append('file', await shrink(inp.files[0]), inp.files[0].name); toast('Uploading…'); await api(`/api/enquiries/${id}/kyc`, { method: 'POST', body: fd }); toast('Uploaded'); re(); })));
        if ($('bKyc')) $('bKyc').onclick = run(async () => { await post('kyc/complete'); selStep = 'pay'; re(); });
      } else if (selStep === 'pay') {
        const cap = b.total_consideration ? Math.floor(b.total_consideration * 0.1) : null;
        const bookAmt = form.clp ? (form.clp.find((r) => /booking/i.test(r.milestone)) || {}).amount : '';
        Pn.innerHTML = head('pay', 'Booking payment', 'First transaction — Accounts verify it against the bank statement.') + (s === 'lock' ? lockNote('Complete KYC first.') : `
          ${cap ? `<div class="banner cu mb-16">${ic('stamp')}<span>RERA: before the Agreement for Sale the booking amount can be at most <b>${inr(cap)}</b> (10% of ${inr(b.total_consideration)}). Collect only into the project's RERA designated account.</span></div>` : ''}
          ${e.payments.map((p) => `<div class="doc-row ${p.status === 'Received' ? 'ok' : ''}"><span class="ico">${ic(p.status === 'Received' ? 'check' : p.status === 'Rejected' ? 'x' : 'clock')}</span><div class="grow"><b>${inr(p.amount)}</b> <span class="sm muted">· ${esc(p.mode)} · <span class="mono">${esc(p.ref || '—')}</span></span><div class="xs muted">${esc(p.bank_name || '')} ${esc(p.branch || '')} ${p.txn_date ? '· ' + day(p.txn_date) : ''} ${p.remarks ? '· ' + esc(p.remarks) : ''}</div></div>${p.status === 'Received' ? `<span class="badge ok">${esc(p.receipt_no)}</span>` : p.status === 'Rejected' ? '<span class="badge bad">Rejected</span>' : '<span class="badge warn">With Accounts</span>'}</div>`).join('')}
          ${paid || !sell ? '' : pending ? `<div class="banner info">${ic('clock')}<span>Waiting for Accounts to verify. You'll be notified on WhatsApp when it's done.</span></div>` : `<div class="fgrid mt-12">
            <div class="field"><label>Booking amount (₹) <span class="req">*</span></label><input type="text" id="pyA" inputmode="numeric" value="${esc(bookAmt || '')}"><span class="hint" id="pyW"></span></div>
            <div class="field"><label>Transaction date <span class="req">*</span></label><input type="date" id="pyD" value="${new Date().toISOString().slice(0, 10)}"></div>
            <div class="field"><label>Payment mode <span class="req">*</span></label><select id="pyM">${MODES.map((m) => `<option>${m}</option>`).join('')}</select></div>
            <div class="field"><label>Cheque / UTR / Txn no. <span class="req">*</span></label><input type="text" id="pyR"></div>
            <div class="field"><label>Bank</label><input type="text" id="pyB" value="${esc((form.a1 && form.a1.bank) || '')}"></div>
            <div class="field"><label>Branch</label><input type="text" id="pyBr" value="${esc((form.a1 && form.a1.branch) || '')}"></div></div>
            <button class="btn cu" id="bPay">${ic('arrow')} Send to Accounts</button>`}`);
        if ($('pyA') && cap) { const w = () => { const v = Number($('pyA').value.replace(/[^\d.]/g, '')); $('pyW').textContent = v ? (v > cap ? `Above the RERA limit of ${inr(cap)}` : `${inr(v)} · ${((v / b.total_consideration) * 100).toFixed(1)}% of total`) : ''; $('pyW').style.color = v > cap ? 'var(--bad)' : ''; }; $('pyA').oninput = w; w(); }
        if ($('bPay')) $('bPay').onclick = run(async () => { await post('payments', { amount: $('pyA').value, mode: $('pyM').value, ref: $('pyR').value, txnDate: $('pyD').value, bankName: $('pyB').value, branch: $('pyBr').value }); toast('Sent to Accounts'); re(); });
      } else if (selStep === 'sign') {
        const a1 = (form.a1 && form.a1.name) || e.name;
        Pn.innerHTML = head('sign', 'Applicant signatures', 'The applicant(s) confirm the declaration and sign with a finger or stylus.') + (s === 'lock' ? lockNote('Opens when Accounts verifies the booking payment.') : `
          <div class="g ${hasA2 ? 'g2' : ''}">${[['customer', 'First applicant', a1, 'sgC'], ...(hasA2 ? [['co_applicant', 'Second applicant', form.a2.name, 'sgC2']] : [])].map(([k, l, n, cid]) => `<div><div class="lbl mb-12">${l} — ${esc(n)}</div>${sig[k] ? `<div class="sigimg"><img src="/api/files/${sig[k].file_id}" alt="Signature"><div class="xs muted mt-8">Signed ${when(sig[k].signed_at)}</div></div>` : `<div class="sigpad"><div class="base"></div><canvas id="${cid}"></canvas></div><button class="btn ghost sm mt-8" data-clr="${cid}">Clear</button>`}</div>`).join('')}</div>
          ${signed || !sell ? '' : `<button class="btn cu mt-16" id="bSign">${ic('sign')} Save signatures</button>`}`);
        const pads = {}; ['sgC', 'sgC2'].forEach((k) => { if ($(k)) pads[k] = sigPad($(k)); });
        qsa('[data-clr]', Pn).forEach((bn) => (bn.onclick = () => pads[bn.dataset.clr] && pads[bn.dataset.clr].clear()));
        if ($('bSign')) $('bSign').onclick = run(async () => { const body = {}; if (pads.sgC) { if (!pads.sgC.has()) throw new Error("First applicant's signature is missing"); body.customer = pads.sgC.png(); } if (pads.sgC2) { if (!pads.sgC2.has()) throw new Error("Second applicant's signature is missing"); body.coApplicant = pads.sgC2.png(); } await post('signatures', body); toast('Signed — sent for approval'); selStep = 'approve'; re(); });
      } else if (selStep === 'approve') {
        Pn.innerHTML = head('approve', 'Developer approval', 'The sales manager signs for the Developer / Authorised Representative.') + (sig.developer ? `
          <div class="banner ok mb-16">${ic('star')}<span><b>Booked!</b> Approved ${when(sig.developer.signed_at)}. Flat marked Sold, CRM enquiry closed and the signed application sent to the customer.</span></div>
          <div class="row"><a class="btn cu" target="_blank" rel="noopener" href="/api/enquiries/${e.id}/booking.pdf">${ic('doc')} Signed booking application</a><button class="btn wa" id="bShare">${ic('wa', 16)} Send to customer</button></div>`
          : s === 'lock' ? lockNote('Available after the booking payment is verified and the applicants have signed.')
            : can.approve() ? `<a class="btn line sm mb-12" target="_blank" rel="noopener" href="/api/enquiries/${e.id}/application.pdf">${ic('eye', 16)} Review the application</a>
              <div class="lbl mb-12">Signature — ${esc(state.user.name)}, ${esc(state.user.designation)}</div><div class="sigpad"><div class="base"></div><canvas id="sgD"></canvas></div>
              <div class="row mt-12"><button class="btn ghost sm" id="clrD">Clear</button><span class="grow"></span><button class="btn cu lg" id="bApprove">${ic('stamp')} Sign & approve booking</button></div>`
              : lockNote('Waiting for the sales manager to sign and approve.'));
        const pad = $('sgD') ? sigPad($('sgD')) : null;
        if ($('clrD')) $('clrD').onclick = () => pad.clear();
        if ($('bApprove')) $('bApprove').onclick = run(async () => { if (!pad.has()) throw new Error('Please sign first'); const bt = $('bApprove'); bt.disabled = true; bt.textContent = 'Approving…'; try { await post('approve', { developer: pad.png() }); toast('🎉 Booked! Confirmation sent to the customer'); refreshCounts(); } finally { re(); } });
        if ($('bShare')) $('bShare').onclick = run(async () => { const { url } = await api(`/api/enquiries/${id}/share-link`); window.open(`https://wa.me/91${e.mobile}?text=${encodeURIComponent(`Hi ${first(e.name)}, congratulations on your new home at ${e.project_name}! 🎉 Here is your signed booking application for ${b.unit}: ${url}`)}`, '_blank', 'noopener'); });
      }
    }
    drawPanel();
  }

  /* ======================= BOOKING APPLICATION WIZARD ======================= */
  async function openWizard(e, onDone) {
    if (!state.form) state.form = await api('/api/booking-form');
    const F = state.form; const b = e.booking || {};
    const ro = ['Booked', 'Lost'].includes(e.stage) || !can.sell();
    const f = JSON.parse(JSON.stringify(b.extra || {})); f.a1 = f.a1 || {}; f.a2 = f.a2 || {};
    if (!b.extra) { Object.assign(f.a1, { name: e.name.toUpperCase(), mobile: e.mobile, email: e.email, address: e.residence, nationality: 'Indian' }); f.funding = 'Self-Funded'; f.cpName = e.cp_name || ''; f.smName = e.assigned_name || ''; f.smPhone = e.assigned_phone ? '+' + e.assigned_phone : ''; }
    if (!f.clp || !f.clp.length) f.clp = F.defaultClp.map((r) => ({ ...r, due: '' }));
    let flatId = b.flat_id || ''; let units = []; let cur = 0;

    const input = (fd, path, v) => {
      const dis = ro || fd.auto ? 'disabled' : '';
      const a = `data-p="${path}" ${dis} ${fd.max ? `maxlength="${fd.max}"` : ''} ${fd.ph ? `placeholder="${esc(fd.ph)}"` : ''}`;
      const ctl = fd.type === 'select' ? `<select ${a}><option value="">Select…</option>${fd.options.map((o) => `<option ${o === v ? 'selected' : ''}>${o}</option>`).join('')}</select>`
        : fd.type === 'textarea' ? `<textarea ${a}>${esc(v)}</textarea>`
          : `<input type="${fd.type === 'date' ? 'date' : fd.type === 'email' ? 'email' : 'text'}" ${fd.digits || fd.type === 'money' || fd.type === 'number' ? 'inputmode="numeric"' : ''} ${a} value="${esc(v ?? '')}" ${fd.upper ? 'style="text-transform:uppercase"' : ''}>`;
      return `<div class="field" ${fd.showIf === 'loan' ? 'data-loan' : ''}><label>${esc(fd.label)}${fd.req ? ' <span class="req">*</span>' : ''}</label>${ctl}</div>`;
    };
    const secBody = (s) => {
      if (s.kind === 'pair') return `<div class="pair">${['a1', 'a2'].map((who) => `<div><div class="who"><span>${who === 'a1' ? 'First applicant' : 'Second applicant'}</span>${who === 'a2' ? '<span style="text-transform:none;letter-spacing:0;color:var(--muted)">Optional</span>' : ''}</div>
        ${s.fields.filter((fd) => !fd.only || fd.only === who).map((fd) => input(who === 'a2' ? { ...fd, req: false } : fd, `${who}.${fd.k}`, f[who][fd.k] ?? (fd.def && who === 'a1' ? fd.def : ''))).join('')}</div>`).join('')}</div>
        ${(s.extra || []).map((fd) => input(fd, fd.k, f[fd.k])).join('')}${s.note ? `<p class="xs muted">${esc(s.note)}</p>` : ''}`;
      if (s.kind === 'flat') return `<div class="fgrid"><div class="field"><label>Project</label><input type="text" value="${esc(e.project_name)}" disabled></div>
          <div class="field"><label>Building / Tower · Wing <span class="req">*</span></label><select id="uT" ${ro ? 'disabled' : ''}><option>Loading…</option></select></div>
          <div class="field"><label>Flat / Unit <span class="req">*</span></label><select id="uU" ${ro ? 'disabled' : ''}><option value="">—</option></select></div></div>
        <div class="unit mb-16" id="uCard"></div><div class="fgrid">${s.fields.map((fd) => input(fd, fd.k, f[fd.k])).join('')}</div>
        <div class="total"><span class="b">Total consideration value</span><b class="num" id="tot">—</b></div>`;
      if (s.kind === 'payment') { const p = e.payments.find((x) => x.status !== 'Rejected'); return p ? `<dl class="kv"><dt>Booking amount</dt><dd>${inr(p.amount)}</dd><dt>Date</dt><dd>${day(p.txn_date || p.submitted_at)}</dd><dt>Mode</dt><dd>${esc(p.mode)}</dd><dt>Cheque / UTR</dt><dd class="mono">${esc(p.ref)}</dd><dt>Bank / branch</dt><dd>${esc(p.bank_name || '—')} ${esc(p.branch || '')}</dd><dt>Status</dt><dd>${esc(p.status)} ${p.receipt_no ? '· ' + esc(p.receipt_no) : ''}</dd></dl>` : `<div class="banner info">${ic('rupee')}<span>Recorded after the application is submitted and KYC is complete (journey step 5). It then appears here and on the printed application, with the amount in words.</span></div>`; }
      if (s.kind === 'single') return s.groups ? s.groups.map((g) => `<h4 class="mb-12 mt-8">${esc(g.title)} ${g.auto ? '<span class="badge plain">Auto-filled</span>' : ''}</h4><div class="fgrid">${g.fields.map((fd) => input(fd, fd.k, f[fd.k])).join('')}</div>`).join('') : `<div class="fgrid">${s.fields.map((fd) => input(fd, fd.k, f[fd.k] ?? fd.def ?? '')).join('')}</div>`;
      if (s.kind === 'clp') return `<div style="overflow-x:auto"><table class="tbl clp"><thead><tr><th style="width:40px">#</th><th>Milestone</th><th style="width:100px">%</th><th style="width:140px">Amount</th><th style="width:170px">Due date</th>${ro ? '' : '<th style="width:44px"></th>'}</tr></thead><tbody id="clpB"></tbody>
        <tfoot><tr><td></td><td class="b">Total</td><td id="clpP"></td><td id="clpA" class="b num"></td><td colspan="2"></td></tr></tfoot></table></div>${ro ? '' : `<button class="btn line sm mt-12" id="clpAdd">${ic('plus', 16)} Add milestone</button>`}<p class="xs muted mt-12">RERA: the booking amount cannot exceed 10%. Amounts are calculated from the total consideration.</p>`;
      if (s.id === 'terms') return `<ol class="legal">${F.terms.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>`;
      if (s.id === 'cancellation') return `<ol class="legal">${F.cancellation.map((t) => `<li>${esc(t)}</li>`).join('')}</ol><div class="rera"><div class="row mb-12">${ic('stamp')}<h4>Cancellation & refund norms as per MahaRERA</h4></div><p class="sm mb-12">For buyer-initiated cancellation (Developer not in default), deductions are capped by the time from the allotment letter:</p>
        <table class="tbl"><thead><tr><th>Cancellation request received</th><th>Maximum deduction</th></tr></thead><tbody>${F.reraSlabs.map(([a, c]) => `<tr><td>${esc(a)}</td><td class="b">${esc(c)}</td></tr>`).join('')}</tbody></table><ul class="legal mt-12">${F.reraNorms.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>`;
      if (s.id === 'declaration') return `<ul class="legal">${F.declaration.map((t) => `<li>${esc(t)}</li>`).join('')}</ul><label class="check card p mt-16"><input type="checkbox" data-p="declarationAccepted" ${f.declarationAccepted ? 'checked' : ''} ${ro ? 'disabled' : ''}><span>The applicant(s) have read and accept the declaration, standard terms & conditions and the cancellation policy.</span></label>`;
      return `<div class="banner info">${ic('sign')}<span>Signatures are captured on screen in the customer journey after Accounts verifies the booking payment: first applicant, second applicant (if any), and the Developer / Authorised Representative at approval.</span></div>`;
    };

    closeAll(); document.body.style.overflow = 'hidden';
    const w = document.createElement('div'); w.className = 'wiz'; w.id = 'wiz';
    w.innerHTML = `<div class="wiz-h"><img src="/assets/logo.png" alt=""><div class="grow"><h3>Booking application</h3><div class="xs muted">${e.id} · ${esc(e.name)} · ${esc(e.project_name)}${ro ? ' · read only' : ''}</div></div>
        <a class="btn line sm hide-m" target="_blank" rel="noopener" href="/api/enquiries/${e.id}/application.pdf" id="wPdf" ${b.flat_id ? '' : 'style="display:none"'}>${ic('print', 16)} Print / PDF</a><button class="btn ghost icon" id="wX">${ic('x')}</button></div>
      <nav class="wiz-side" id="wSide"><div class="prog"><div class="row spread xs b"><span>Completion</span><span id="pT">0%</span></div><div class="bar"><i id="pB"></i></div></div>
        ${F.sections.map((s, i) => `<a data-i="${i}" data-s="${s.id}"><span class="n">${s.no}</span><span class="t">${esc(s.title)}</span></a>`).join('')}</nav>
      <div class="wiz-body" id="wBody"><div class="inner">${F.sections.map((s, i) => `<section class="wiz-sec" id="ws-${s.id}" data-i="${i}"><div class="head"><span class="n">${s.no}</span><div><div class="over">Section ${s.no} of ${F.sections.length}</div><h2>${esc(s.title)}</h2></div></div><div class="card p">${secBody(s)}</div></section>`).join('')}</div></div>
      <div class="wiz-f"><span class="note xs muted grow" id="wNote">${ro ? 'This application is read only.' : 'Drafts keep the flat on hold. Submit once the customer confirms every detail.'}</span>
        <button class="btn line" id="wPrev">${ic('back', 16)} Back</button>${ro ? '' : '<button class="btn soft" id="wSave">Save draft</button>'}<button class="btn" id="wNext">Next ${ic('arrow', 16)}</button>${ro ? '' : `<button class="btn cu hide" id="wSubmit">${ic('check', 16)} Submit application</button>`}</div>`;
    document.body.appendChild(w);
    const show = (i) => {
      cur = Math.max(0, Math.min(F.sections.length - 1, i));
      qsa('.wiz-sec', w).forEach((s) => s.classList.toggle('on', Number(s.dataset.i) === cur));
      qsa('#wSide a', w).forEach((a) => a.classList.toggle('on', Number(a.dataset.i) === cur));
      $('wPrev').disabled = cur === 0;
      const last = cur === F.sections.length - 1;
      $('wNext').classList.toggle('hide', last); if ($('wSubmit')) $('wSubmit').classList.toggle('hide', !last);
      $('wBody').scrollTop = 0; const a = qs(`#wSide a[data-i="${cur}"]`, w); if (a && a.scrollIntoView) a.scrollIntoView({ block: 'nearest', inline: 'center' });
    };
    $('wX').onclick = () => { closeAll(); onDone && onDone(); };
    $('wPrev').onclick = () => show(cur - 1); $('wNext').onclick = () => show(cur + 1);
    qsa('#wSide a', w).forEach((a) => (a.onclick = () => show(Number(a.dataset.i))));

    const setP = (p, v) => { const [x, k] = p.includes('.') ? p.split('.') : [null, p]; if (x) f[x][k] = v; else f[k] = v; };
    qsa('[data-p]', w).forEach((inp) => inp.addEventListener(inp.type === 'checkbox' || inp.tagName === 'SELECT' ? 'change' : 'input', () => {
      setP(inp.dataset.p, inp.type === 'checkbox' ? inp.checked : inp.value); inp.classList.remove('bad');
      if (['agreementValue', 'otherCharges'].includes(inp.dataset.p)) drawClp();
      if (inp.dataset.p === 'funding') loanVis();
      if (inp.dataset.p === 'carpetSqft') { const m = qs('[data-p="carpetSqm"]', w); if (m && !m.dataset.t && inp.value) { m.value = (Number(inp.value) / 10.7639).toFixed(2); f.carpetSqm = m.value; } }
      if (inp.dataset.p === 'carpetSqm') inp.dataset.t = '1';
      progress();
    }));
    const loanVis = () => qsa('[data-loan]', w).forEach((d) => (d.style.display = (f.funding || 'Self-Funded') === 'Self-Funded' ? 'none' : ''));
    loanVis();
    const total = () => { const a = Number(String(f.agreementValue || '').replace(/[^\d.]/g, '')); const o = Number(String(f.otherCharges || '').replace(/[^\d.]/g, '')); return a ? a + (o || 0) : 0; };
    function drawClp() {
      const t = total(); $('tot').textContent = t ? inr(t) : '—';
      $('clpB').innerHTML = f.clp.map((r, i) => `<tr><td class="muted">${i + 1}</td><td><input type="text" data-c="${i}" data-f="milestone" value="${esc(r.milestone)}" ${ro ? 'disabled' : ''}></td><td><input type="text" inputmode="decimal" data-c="${i}" data-f="pct" value="${esc(r.pct)}" ${ro ? 'disabled' : ''}></td>
        <td class="num b">${t ? inr(Math.round((t * (Number(r.pct) || 0)) / 100)) : '—'}</td><td><input type="date" data-c="${i}" data-f="due" value="${esc(r.due || '')}" ${ro ? 'disabled' : ''}></td>${ro ? '' : `<td><button class="btn ghost icon sm" data-del="${i}">${ic('x', 15)}</button></td>`}</tr>`).join('');
      const pct = f.clp.reduce((a, r) => a + (Number(r.pct) || 0), 0);
      $('clpP').innerHTML = `<span class="badge ${Math.abs(pct - 100) < 0.01 ? 'ok' : 'bad'}">${pct}%</span>`; $('clpA').textContent = t ? inr(t) : '—';
      qsa('[data-c]', w).forEach((inp) => inp.addEventListener('change', () => { f.clp[inp.dataset.c][inp.dataset.f] = inp.dataset.f === 'pct' ? Number(inp.value) || 0 : inp.value; drawClp(); progress(); }));
      qsa('[data-del]', w).forEach((bn) => (bn.onclick = () => { f.clp.splice(Number(bn.dataset.del), 1); drawClp(); }));
    }
    if ($('clpAdd')) $('clpAdd').onclick = () => { f.clp.splice(f.clp.length - 1, 0, { milestone: 'New milestone', pct: 0, due: '' }); drawClp(); };
    drawClp();

    const lab = (u) => u.tower + (u.wing && u.wing !== u.tower ? ' · Wing ' + u.wing : '');
    try { units = (await api(`/api/projects/${e.project_id}/units`)).units; } catch { units = []; }
    const usable = units.filter((u) => u.status === 'Available' || u.held_by === e.id);
    const curU = units.find((u) => u.id === flatId);
    $('uT').innerHTML = '<option value="">Select tower…</option>' + [...new Set(usable.map(lab))].map((g) => `<option ${curU && lab(curU) === g ? 'selected' : ''}>${esc(g)}</option>`).join('');
    const fillU = () => { const pref = String(e.config || ''); const list = usable.filter((u) => lab(u) === $('uT').value).sort((x, y) => (y.flat_type === pref) - (x.flat_type === pref));
      $('uU').innerHTML = '<option value="">Select flat…</option>' + list.map((u) => `<option value="${u.id}" ${u.id === flatId ? 'selected' : ''}>${esc(u.flat_no)} · ${esc(u.flat_type || '')}${u.floor !== null ? ' · Floor ' + u.floor : ''}${u.held_by === e.id ? ' · held for you' : ''}</option>`).join(''); card(); };
    const card = () => { const u = units.find((x) => x.id === $('uU').value); flatId = u ? u.id : '';
      $('uCard').innerHTML = u ? `<div><span>Tower</span><b>${esc(u.tower)}</b></div><div><span>Wing</span><b>${esc(u.wing || '—')}</b></div><div><span>Flat</span><b>${esc(u.flat_no)}</b></div><div><span>Floor</span><b>${u.floor ?? '—'}</b></div><div><span>Type</span><b>${esc(u.flat_type || '—')}</b></div><div><span>Carpet</span><b>${u.carpet_area ? esc(u.carpet_area) + ' sq ft' : '—'}</b></div>`
        : `<div><span>Live inventory</span><b>${usable.length} of ${units.length} available</b></div>`;
      if (u && u.carpet_area && !f.carpetSqft) { f.carpetSqft = String(u.carpet_area); const a = qs('[data-p="carpetSqft"]', w); if (a) a.value = f.carpetSqft; const m = qs('[data-p="carpetSqm"]', w); if (m && !f.carpetSqm) { f.carpetSqm = (Number(u.carpet_area) / 10.7639).toFixed(2); m.value = f.carpetSqm; } }
      progress(); };
    $('uT').onchange = fillU; $('uU').onchange = card; fillU();

    function progress() {
      let done = 0;
      F.sections.forEach((s) => {
        let ok = true;
        if (s.kind === 'pair') ok = s.fields.filter((fd) => fd.req && fd.only !== 'a2').every((fd) => f.a1[fd.k]);
        else if (s.kind === 'flat') ok = !!flatId && !!f.agreementValue;
        else if (s.kind === 'clp') ok = Math.abs(f.clp.reduce((a, r) => a + (Number(r.pct) || 0), 0) - 100) < 0.01;
        else if (s.id === 'declaration') ok = !!f.declarationAccepted;
        else if (s.id === 'loan') ok = (f.funding || 'Self-Funded') === 'Self-Funded' || !!f.loanBank;
        else if (s.kind === 'payment') ok = e.payments.some((p) => p.status !== 'Rejected');
        else if (s.kind === 'signatures') ok = !!e.signatures.customer;
        qs(`#wSide a[data-s="${s.id}"]`, w).classList.toggle('done', ok); if (ok) done++;
      });
      const pct = Math.round((done / F.sections.length) * 100); $('pT').textContent = pct + '%'; $('pB').style.width = pct + '%';
    }
    progress(); show(0);

    const markErrors = (errs) => {
      qsa('.bad', w).forEach((x) => x.classList.remove('bad')); qsa('#wSide a.err', w).forEach((a) => a.classList.remove('err'));
      let firstSec = null;
      for (const msg of errs) for (const s of F.sections) {
        const fields = s.kind === 'pair' ? s.fields : s.groups ? s.groups.flatMap((g) => g.fields) : s.fields || [];
        let hit = (/CLP/.test(msg) && s.kind === 'clp') || (/declaration/.test(msg) && s.id === 'declaration') || (/Loaning Bank/.test(msg) && s.id === 'loan');
        for (const fd of fields) { if (!msg.includes(fd.label)) continue; const who = /^Second applicant/.test(msg) ? 'a2' : 'a1'; const el = qs(`[data-p="${s.kind === 'pair' ? who + '.' + fd.k : fd.k}"]`, w); if (el) el.classList.add('bad'); hit = true; }
        if (hit) { qs(`#wSide a[data-s="${s.id}"]`, w).classList.add('err'); if (firstSec === null) firstSec = F.sections.indexOf(s); }
      }
      if (firstSec !== null) show(firstSec);
    };
    const save = async (submit) => {
      if (!flatId) { show(F.sections.findIndex((s) => s.kind === 'flat')); throw new Error('Choose the flat first'); }
      try { await api(`/api/enquiries/${e.id}/booking`, { method: 'PUT', json: { flatId, form: f, submit } }); } catch (err) { if (err.errors) markErrors(err.errors); throw err; }
      $('wPdf').style.display = '';
      if (submit) { toast('Application submitted — next: KYC'); closeAll(); selStep = 'kyc'; onDone && onDone(); } else { toast('Draft saved — flat on hold'); $('wNote').textContent = 'Draft saved at ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }); }
    };
    if ($('wSave')) $('wSave').onclick = run(() => save(false));
    if ($('wSubmit')) $('wSubmit').onclick = run(() => save(true));
  }

  /* ======================= APPROVALS ======================= */
  async function viewApprovals() {
    loading();
    const { enquiries } = await api('/api/enquiries?stage=Signatures');
    $('view').innerHTML = `<div class="fade-in">${pageHead('Approvals', 'Payment verified and applicants signed — review, sign for the Developer and approve.')}
      <div class="card">${enquiries.length ? enquiries.map((e) => `<div class="li go" style="margin:0;border-radius:0;padding:16px 20px;border-bottom:1px solid var(--line-2)" data-c="${e.id}">${avatar(e.name)}<div class="grow"><b>${esc(e.name)}</b><div class="xs muted">${e.id} · ${esc(e.project_name)} · ${esc(e.config)} · ${esc(e.assigned_name)}</div></div><span class="xs muted hide-m">${when(e.updated_at)}</span><button class="btn cu sm">Review ${ic('arrow', 15)}</button></div>`).join('')
        : `<div class="empty">${ic('stamp')}<div class="b">All caught up</div><div class="sm">Bookings waiting for your signature appear here.</div></div>`}</div></div>`;
    qsa('[data-c]').forEach((el) => (el.onclick = () => { state.wantStep = 'approve'; go('c-' + el.dataset.c); }));
  }

  /* ======================= PAYMENTS ======================= */
  async function viewPayments() {
    $('view').innerHTML = `<div class="fade-in">${pageHead('Payments', 'Verify booking payments against the bank statement.', `<div class="seg" id="pt">${['Pending verification', 'Received', 'Rejected'].map((s, i) => `<button data-s="${s}" class="${i ? '' : 'on'}">${s.replace(' verification', '')}</button>`).join('')}</div>`)}<div id="pl">${skel(2, 90)}</div></div>`;
    let cur = 'Pending verification';
    const load = run(async () => {
      const { payments } = await api('/api/payments?status=' + encodeURIComponent(cur));
      $('pl').innerHTML = payments.length ? `<div class="g">${payments.map((p) => `<div class="card p"><div class="row spread"><div class="person">${avatar(p.customer)}<div><b>${esc(p.customer)}</b><div class="xs muted">${p.enquiry_id} · ${esc(p.project_name)} · ${esc(p.unit || '—')}</div></div></div><div class="stack" style="align-items:flex-end"><div style="font-size:22px;font-weight:800" class="num">${inr(p.amount)}</div><span class="xs muted">${when(p.submitted_at)} · ${esc(p.submitted_name || '')}</span></div></div>
          <div class="sep"></div><dl class="kv"><dt>Mode</dt><dd>${esc(p.mode)}</dd><dt>Cheque / UTR</dt><dd class="mono">${esc(p.ref || '—')}</dd><dt>Bank · branch</dt><dd>${esc(p.bank_name || '—')} ${esc(p.branch || '')}</dd><dt>Transaction date</dt><dd>${day(p.txn_date) || '—'}</dd></dl>
          ${p.status === 'Pending verification' ? `<div class="row mt-16"><input type="text" placeholder="Receipt no. (optional)" data-rn="${p.id}" style="max-width:240px"><span class="grow"></span><button class="btn danger" data-no="${p.id}">Reject</button><button class="btn cu" data-ok="${p.id}">${ic('check')} Verify payment</button></div>`
            : `<div class="mt-12">${p.status === 'Received' ? `<span class="badge ok"><i></i>Received · ${esc(p.receipt_no)}</span>` : `<span class="badge bad"><i></i>Rejected</span> <span class="sm muted">${esc(p.remarks || '')}</span>`}</div>`}</div>`).join('')}</div>`
        : `<div class="card"><div class="empty">${ic('rupee')}<div class="b">Nothing here</div></div></div>`;
      qsa('[data-ok]').forEach((bn) => (bn.onclick = run(async () => { await api(`/api/payments/${bn.dataset.ok}/verify`, { json: { receiptNo: qs(`[data-rn="${bn.dataset.ok}"]`).value } }); toast('Payment verified — sales notified'); refreshCounts(); load(); })));
      qsa('[data-no]').forEach((bn) => (bn.onclick = () => modal({ title: 'Reject payment', body: `<div class="field"><label>Reason</label><input type="text" id="rm" placeholder="e.g. UTR not found in bank statement"></div><div class="row" style="justify-content:flex-end"><button class="btn line" data-close>Cancel</button><button class="btn danger" id="ok">Reject</button></div>`,
        onOpen: () => { $('ok').onclick = run(async () => { await api(`/api/payments/${bn.dataset.no}/reject`, { json: { remarks: $('rm').value } }); closeModal(); toast('Rejected'); load(); }); } })));
    });
    qsa('#pt button').forEach((bn) => (bn.onclick = () => { cur = bn.dataset.s; qsa('#pt button').forEach((x) => x.classList.toggle('on', x === bn)); load(); }));
    load();
  }

  /* ======================= TEAM ======================= */
  async function viewTeam() {
    loading();
    const t = await api('/api/team');
    const projs = (sel = []) => `<div class="chips">${t.projects.map((p) => `<label class="chip"><input type="checkbox" name="projectIds" value="${p.id}" ${sel.includes(p.id) ? 'checked' : ''} style="accent-color:var(--navy)"> ${esc(p.name)}</label>`).join('')}</div>`;
    $('view').innerHTML = `<div class="fade-in">${pageHead('Team', 'Staff, projects and channel partners.', `<button class="btn cu" id="addU">${ic('plus')} Add staff</button><button class="btn line" id="addCp">Add channel partner</button>`)}
      <div class="g split">
        <div class="card">${t.users.map((u) => `<div class="li go" style="margin:0;border-radius:0;padding:14px 18px;border-bottom:1px solid var(--line-2);${u.active ? '' : 'opacity:.5'}" data-u="${u.id}">${avatar(u.name, u.photoUrl)}<div class="grow"><div class="row gap-6"><b>${esc(u.name)}</b><span class="badge plain">${esc(u.role)}</span>${u.role === 'sales' ? `<span class="dot ${slugS(u.status)}" title="${esc(u.status)}"></span>` : ''}</div><div class="xs muted">${esc(u.designation)}${u.employeeId ? ' · ' + esc(u.employeeId) : ''} · ${ph(u.phone)}</div></div><span class="xs muted hide-m">${u.projects.map((p) => esc(p.name)).join(', ')}</span></div>`).join('')}</div>
        <div class="card"><div class="card-h"><h3>Channel partners</h3></div><div class="card-b"><p class="xs muted mb-12">Leads from a channel partner go straight to its owner; details auto-fill the booking application.</p>
          ${t.channelPartners.map((c) => `<div class="li"><span class="avatar" style="border-radius:12px">${esc(ini(c.name))}</span><div class="grow"><b class="sm">${esc(c.name)}</b><div class="xs muted">${esc(c.reg_code || 'No RERA code')} · ${esc(c.rep_name || '—')}</div></div><span class="xs muted">${esc(c.owner_name || 'Round-robin')}</span></div>`).join('') || '<div class="empty sm">None yet</div>'}</div></div></div></div>`;
    $('addU').onclick = () => modal({ title: 'Add staff', wide: true, body: `<form id="nf"><div class="fgrid">
        <div class="field"><label>Name *</label><input type="text" name="name" required></div><div class="field"><label>Designation</label><input type="text" name="designation"></div>
        <div class="field"><label>Mobile *</label><input type="tel" name="phone" required></div><div class="field"><label>Email</label><input type="email" name="email"></div>
        <div class="field"><label>Employee ID</label><input type="text" name="employeeId"></div><div class="field"><label>Role *</label><select name="role"><option value="sales">Sales</option><option value="reception">Reception</option><option value="manager">Manager</option><option value="accounts">Accounts</option></select></div>
        <div class="field"><label>Starting PIN *</label><input type="text" name="pin" required inputmode="numeric" maxlength="6"></div></div>
        <div class="field"><label>Projects</label>${projs()}</div><div class="row" style="justify-content:flex-end"><button type="button" class="btn line" data-close>Cancel</button><button class="btn cu">Add staff</button></div></form>`,
    onOpen: () => { $('nf').onsubmit = run(async (ev) => { ev.preventDefault(); const fd = new FormData(ev.target); await api('/api/team', { json: { ...Object.fromEntries(fd), projectIds: fd.getAll('projectIds') } }); closeModal(); toast('Staff added'); viewTeam(); }); } });
    $('addCp').onclick = () => modal({ title: 'Channel partner', body: `<form id="cf"><div class="fgrid"><div class="field"><label>Agency name *</label><input type="text" name="name" required></div><div class="field"><label>MahaRERA reg. code</label><input type="text" name="regCode"></div>
        <div class="field"><label>Representative</label><input type="text" name="repName"></div><div class="field"><label>Contact</label><input type="tel" name="phone"></div><div class="field"><label>Email</label><input type="email" name="email"></div>
        <div class="field"><label>Owner</label><select name="ownerUserId"><option value="">— none —</option>${t.users.filter((u) => u.role === 'sales' && u.active).map((u) => `<option value="${u.id}">${esc(u.name)}</option>`).join('')}</select></div></div>
        <div class="row" style="justify-content:flex-end"><button type="button" class="btn line" data-close>Cancel</button><button class="btn cu">Save</button></div></form>`,
    onOpen: () => { $('cf').onsubmit = run(async (ev) => { ev.preventDefault(); await api('/api/channel-partners', { json: Object.fromEntries(new FormData(ev.target)) }); closeModal(); toast('Saved'); viewTeam(); }); } });
    qsa('[data-u]').forEach((el) => (el.onclick = () => {
      const u = t.users.find((x) => String(x.id) === el.dataset.u);
      modal({ title: esc(u.name), sub: `${esc(u.role)} · ${ph(u.phone)}`, wide: true, body: `<form id="ef"><div class="fgrid">
        <div class="field"><label>Name</label><input type="text" name="name" value="${esc(u.name)}"></div><div class="field"><label>Designation</label><input type="text" name="designation" value="${esc(u.designation)}"></div>
        <div class="field"><label>Email</label><input type="email" name="email" value="${esc(u.email)}"></div><div class="field"><label>Employee ID</label><input type="text" name="employeeId" value="${esc(u.employeeId)}"></div>
        <div class="field"><label>Reset PIN</label><input type="text" name="pin" inputmode="numeric" maxlength="6" placeholder="Leave blank to keep"></div>
        <div class="field"><label>Status</label><select name="active"><option value="1" ${u.active ? 'selected' : ''}>Active</option><option value="0" ${u.active ? '' : 'selected'}>Deactivated</option></select></div></div>
        <div class="field"><label>Projects</label>${projs(u.projects.map((p) => p.id))}</div><div class="row" style="justify-content:flex-end"><button type="button" class="btn line" data-close>Cancel</button><button class="btn cu">Save</button></div></form>`,
      onOpen: () => { $('ef').onsubmit = run(async (ev) => { ev.preventDefault(); const fd = new FormData(ev.target); const body = Object.fromEntries(fd); body.projectIds = fd.getAll('projectIds'); body.active = body.active === '1'; if (!body.pin) delete body.pin; await api(`/api/team/${u.id}`, { method: 'PATCH', json: body }); closeModal(); toast('Saved'); viewTeam(); }); } });
    }));
  }

  /* ======================= WHATSAPP CENTRE ======================= */
  async function viewWhatsApp() {
    loading();
    const o = await api('/api/outbox');
    const out = o.whatsapp.filter((m) => m.direction === 'out');
    $('view').innerHTML = `<div class="fade-in">${pageHead('WhatsApp', 'Every message the portal sends.')}
      <div class="banner info mb-16">${ic('wa')}<span><b>Demo mode:</b> messages are prepared here and on each customer page — one tap opens WhatsApp with the text filled in, sent from your own number. Connect the WhatsApp Business API later and they go out automatically.</span></div>
      <div class="g split"><div class="card">${out.length ? out.map((m) => `<div class="li" style="padding:16px 20px;align-items:flex-start;margin:0">${avatar('W A')}<div class="grow"><div class="row gap-6"><b class="sm">To ${ph(m.to_from)}</b>${m.enquiry_id ? `<a class="badge plain" href="#c-${m.enquiry_id}" style="text-decoration:none">${m.enquiry_id}</a>` : ''}<span class="xs muted">${when(m.at)}</span></div>
          <div class="sm mt-8" style="white-space:pre-line">${esc(m.body)}</div></div><a class="btn wa sm" target="_blank" rel="noopener" href="https://wa.me/${esc(String(m.to_from).replace(/\D/g, ''))}?text=${encodeURIComponent(m.body)}">${ic('wa', 15)} Send</a></div>`).join('') : `<div class="empty">${ic('wa')}<div class="b">No messages yet</div></div>`}</div>
        <div class="card"><div class="card-h"><h3>CRM & inventory sync</h3></div><div class="card-b"><div class="log" style="max-height:60vh">${o.sync.map((x) => `${when(x.at)}  [${x.target}] ${x.action} ${x.enquiry_id || ''} → ${x.status}`).map(esc).join('\n') || 'Nothing yet.'}</div></div></div></div></div>`;
  }

  /* ======================= FORMS ======================= */
  async function viewForms() {
    const forms = [
      ['Walk-in Enquiry Form', 'One page · for reception when the tablet is unavailable', '/api/forms/enquiry.pdf', 'users'],
      ['Booking Application Form', '12 sections · applicants, flat, bank, loan, CLP, T&C, MahaRERA norms, signatures', '/api/forms/booking-application.pdf', 'doc'],
    ];
    $('view').innerHTML = `<div class="fade-in">${pageHead('Forms', 'Every form in the app is also printable — blank for paper use, or filled from any customer page.')}
      <div class="g g2">${forms.map(([t, d, u, i]) => `<div class="card p stack gap-14"><div class="row" style="flex-wrap:nowrap"><span class="avatar lg" style="border-radius:16px;background:var(--cu-t);color:var(--cu-d)">${ic(i, 24)}</span><div class="grow"><h3>${t}</h3><p class="sm muted">${d}</p></div></div>
        <div class="row"><a class="btn cu" target="_blank" rel="noopener" href="${u}">${ic('print', 16)} Open & print</a><a class="btn line" href="${u}?download=1">Download PDF</a></div></div>`).join('')}</div>
      <div class="card p mt-16 row" style="flex-wrap:nowrap"><span class="avatar" style="border-radius:12px;background:var(--navy-t)">${ic('users', 18)}</span><div class="grow"><h3>Filled forms for a customer</h3><p class="sm muted">Open any customer → <b>Enquiry form</b> or <b>Application</b> in the header. The booking application shows a DRAFT watermark until the manager signs and approves.</p></div></div></div>`;
  }

  /* ======================= PROFILE / CARD STUDIO ======================= */
  async function viewProfile() {
    const u = state.user;
    const d = { name: u.name, designation: u.designation, phone: u.phone, email: u.email, website: state.org.website, tagline: state.org.tagline, photoUrl: u.photoUrl, cardUrl: u.cardUrl, qrUrl: u.qrUrl };
    const text = `${u.name}\n${u.designation}, ${state.org.name}\n📞 ${ph(u.phone)}\n✉️ ${u.email}\n🪪 ${u.cardUrl}`;
    $('view').innerHTML = `<div class="fade-in">${pageHead('My visiting card', 'One Mihir design for everyone — share it as a link, an image or a contact.')}
      <div class="g split" style="align-items:start">
        <div class="card p stack" style="align-items:center;gap:18px;background:radial-gradient(600px 300px at 50% 0%,#fff,var(--surface-2))"><div id="vc" style="width:100%;display:flex;justify-content:center;padding-top:6px"></div>
          <div class="row" style="justify-content:center"><button class="btn cu" id="shImg">${ic('share', 16)} Share card image</button><a class="btn wa" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(text)}">${ic('wa', 16)} Send link</a><button class="btn line" id="cpL">${ic('copy', 16)} Copy link</button><a class="btn line" target="_blank" rel="noopener" href="${esc(u.cardUrl)}">${ic('eye', 16)} Open page</a></div></div>
        <div class="stack gap-14"><div class="card p"><div class="row" style="flex-wrap:nowrap"><label style="cursor:pointer;position:relative">${avatar(u.name, u.photoUrl, 'xl')}<span style="position:absolute;right:-2px;bottom:-2px;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:var(--cu-grad);color:#fff;border:2px solid #fff">${ic('upload', 15)}</span><input type="file" id="ph" accept="image/*" hidden></label>
            <div class="grow"><h2>${esc(u.name)}</h2><p class="muted sm">${esc(u.designation)}${u.employeeId ? ' · ' + esc(u.employeeId) : ''}</p><p class="sm mt-8">${ph(u.phone)} · ${esc(u.email)}</p></div></div>
            <p class="xs muted mt-12">Tap your photo to change it — your card updates everywhere instantly.</p></div>
          <div class="card p"><h3 class="mb-12">Change PIN</h3><form id="pf" class="fgrid"><div class="field"><label>Current PIN</label><input type="password" name="current" inputmode="numeric" maxlength="6" required></div><div class="field"><label>New PIN</label><input type="password" name="next" inputmode="numeric" maxlength="6" required></div><div><button class="btn">Update PIN</button></div></form></div></div></div></div>`;
    $('vc').innerHTML = MihirCard.html(d); MihirCard.bind($('vc'));
    $('shImg').onclick = run(async () => { const r = await MihirCard.share(d); if (r === 'downloaded') toast('Card image downloaded'); });
    $('cpL').onclick = async () => { try { await navigator.clipboard.writeText(u.cardUrl); toast('Link copied'); } catch { toast(u.cardUrl); } };
    $('ph').onchange = run(async (ev) => { const fl = ev.target.files[0]; if (!fl) return; const fd = new FormData(); fd.append('photo', await shrink(fl), fl.name); state.user = (await api('/api/me/photo', { method: 'POST', body: fd })).user; shell(); route(); toast('Photo updated'); });
    $('pf').onsubmit = run(async (ev) => { ev.preventDefault(); await api('/api/me/pin', { json: Object.fromEntries(new FormData(ev.target)) }); ev.target.reset(); toast('PIN changed'); });
  }

  /* ======================= helpers ======================= */
  async function shrink(file) {
    if (!/^image\//.test(file.type) || file.size < 900 * 1024) return file;
    try { const img = await createImageBitmap(file); const k = Math.min(1, 1600 / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return await new Promise((r) => c.toBlob((bl) => r(bl || file), 'image/jpeg', 0.82)); } catch { return file; }
  }
  function sigPad(c) {
    const r = c.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1; c.width = r.width * dpr; c.height = r.height * dpr;
    const g = c.getContext('2d'); g.scale(dpr, dpr); g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#14162B';
    let down = false, has = false, last = null;
    const pt = (ev) => { const b = c.getBoundingClientRect(); return { x: ev.clientX - b.left, y: ev.clientY - b.top, t: Date.now() }; };
    c.onpointerdown = (ev) => { down = true; c.setPointerCapture(ev.pointerId); last = pt(ev); };
    c.onpointermove = (ev) => { if (!down) return; const p = pt(ev); const v = Math.hypot(p.x - last.x, p.y - last.y) / Math.max(1, p.t - last.t); g.lineWidth = Math.max(1.4, 3.2 - v * 1.2); g.beginPath(); g.moveTo(last.x, last.y); g.lineTo(p.x, p.y); g.stroke(); last = p; has = true; };
    c.onpointerup = c.onpointercancel = () => (down = false);
    return { has: () => has, clear: () => { g.clearRect(0, 0, c.width, c.height); has = false; }, png: () => c.toDataURL('image/png') };
  }

  /* ======================= boot ======================= */
  async function boot() {
    try { const j = await api('/api/me'); Object.assign(state, { user: j.user, org: j.org, stages: j.stages, statuses: j.statuses }); shell(); route(); }
    catch { renderLogin(); }
  }
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  boot();
})();
