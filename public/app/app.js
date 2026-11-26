/* Mihir Group staff app — one page, views chosen by role. */
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const inr = (n) => (n === null || n === undefined || n === '' ? '—' : '₹' + Number(n).toLocaleString('en-IN'));
  const time = (s) => (s ? new Date(s).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }) : '');
  const day = (s) => (s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
  const first = (n) => String(n || '').split(' ')[0];
  const ph = (p) => { const d = String(p || '').replace(/\D/g, ''); return d.length === 12 && d.startsWith('91') ? `+91 ${d.slice(2, 7)} ${d.slice(7)}` : '+' + d; };
  const ini = (n) => String(n || '?').split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase();
  const avatar = (url, name, cls = 'av') => (url ? `<img class="${cls}" src="${esc(url)}" alt="">` : `<span class="initials">${esc(ini(name))}</span>`);

  /* ---------- icons ---------- */
  const P = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 14.5c1.9.6 3.1 2.4 3.5 5.5"/>',
    board: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    stamp: '<path d="M9 3h6l-1 7h-4z"/><path d="M4 14h16v4H4z"/><path d="M6 21h12"/>',
    rupee: '<path d="M6 4h12M6 9h12M6 4c5 0 8 1.5 8 5s-3 5-8 5l8 6"/>',
    team: '<circle cx="12" cy="7" r="3.5"/><path d="M5 21c.8-4 3.5-6 7-6s6.2 2 7 6"/>',
    send: '<path d="M21 3 10 14"/><path d="M21 3 14.5 21 10 14 3 9.5z"/>',
    out: '<path d="M15 4h4v16h-4"/><path d="M10 12h10"/><path d="m6 8-4 4 4 4"/><path d="M2 12h8"/>',
    wa: '<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/><path d="M9 9.5c.3 2 2.5 4.2 4.5 4.5l1.2-1.2 1.8.9c-.3 1.3-1.3 2-2.5 1.8C10.8 15 9 13.2 8.5 10.5 8.3 9.3 9 8.3 10.3 8l.9 1.8z"/>',
    doc: '<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3v5h5M8.5 13h7M8.5 17h5"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    card: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="9" cy="11" r="2.2"/><path d="M5.8 16c.6-1.5 1.8-2.3 3.2-2.3s2.6.8 3.2 2.3M14.5 10h4M14.5 13.5h3"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  };
  const ic = (n, s = 18) => `<svg class="i" viewBox="0 0 24 24" style="width:${s}px;height:${s}px">${P[n] || ''}</svg>`;

  const toast = (m, err) => { const t = $('toast'); t.textContent = m; t.className = 'toast show' + (err ? ' err' : ''); clearTimeout(t._t); t._t = setTimeout(() => (t.className = 'toast'), err ? 6000 : 2800); };

  async function api(path, opts = {}) {
    const o = { method: 'GET', headers: {}, ...opts };
    if (o.json !== undefined) { o.body = JSON.stringify(o.json); o.headers['Content-Type'] = 'application/json'; o.method = o.method === 'GET' ? 'POST' : o.method; }
    const r = await fetch(path, o);
    const j = await r.json().catch(() => ({}));
    if (r.status === 401 && path !== '/api/auth/login') { state.user = null; renderLogin(); throw new Error(j.error || 'Please log in'); }
    if (!r.ok) throw Object.assign(new Error(j.error || 'Request failed'), { errors: j.errors });
    return j;
  }
  const run = (fn) => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message, true); } };

  const state = { user: null, org: null, stages: [], statuses: [], form: null };
  const NAV = {
    sales: [['home', 'My profile', 'home'], ['customers', 'My customers', 'users']],
    reception: [['board', 'Reception board', 'board'], ['customers', 'All enquiries', 'users']],
    manager: [['board', 'Board', 'board'], ['approvals', 'Approvals', 'stamp'], ['customers', 'Enquiries', 'users'], ['home', 'My profile', 'home'], ['team', 'Team', 'team'], ['outbox', 'Outbox & sync', 'send']],
    accounts: [['payments', 'Payments', 'rupee'], ['customers', 'Enquiries', 'users']],
    admin: [['board', 'Board', 'board'], ['approvals', 'Approvals', 'stamp'], ['customers', 'Enquiries', 'users'], ['payments', 'Payments', 'rupee'], ['team', 'Team', 'team'], ['outbox', 'Outbox & sync', 'send']],
  };
  const nav = () => NAV[state.user.role] || NAV.sales;

  /* ---------------- Login ---------------- */
  function renderLogin() {
    closeDrawer(); closeApp();
    $('root').innerHTML = `<div class="login">
      <div class="art"><img src="/assets/logo-light.png" alt="Mihir Group">
        <div style="position:relative;z-index:1"><div class="eyebrow" style="color:var(--copper-l)">Sales & customer portal</div>
        <h2>Every walk-in, from hello to handshake.</h2><p>Enquiries, site visits, booking applications, payments and signatures — in one place.</p></div>
        <div class="tiny" style="color:#8F94B0;position:relative;z-index:1">Live Beyond Time</div></div>
      <div class="pane"><form id="lf">
        <h1>Welcome back</h1><p class="muted" style="margin:-2px 0 22px">Log in with your registered mobile number.</p>
        <div class="field"><label>Mobile number</label><input type="tel" name="phone" required placeholder="10-digit mobile" autocomplete="username" inputmode="numeric"></div>
        <div class="field"><label>PIN</label><input type="password" name="pin" required inputmode="numeric" maxlength="6" placeholder="••••" autocomplete="current-password"></div>
        <button class="btn copper lg" style="width:100%;margin-top:6px">Log in</button>
        <p class="tiny muted" style="margin-top:16px">Forgot your PIN? Ask your sales manager to reset it from the Team page.</p></form></div></div>`;
    $('lf').onsubmit = run(async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      await api('/api/auth/login', { json: { phone: fd.get('phone'), pin: fd.get('pin') } });
      await boot();
    });
  }

  /* ---------------- Shell ---------------- */
  function shell() {
    const u = state.user;
    $('root').innerHTML = `<div class="shell">
      <aside class="side"><div class="brand"><img src="/assets/logo-light.png" alt="Mihir Group"></div>
        <nav id="nav">${nav().map(([k, l, i]) => `<a href="#${k}" data-v="${k}">${ic(i)}<span>${l}</span></a>`).join('')}</nav>
        <div class="me"><img src="${esc(u.photoUrl || '/assets/mark.png')}" alt=""><div><b>${esc(u.name)}</b><span>${esc(u.role)}</span></div>
          <button id="out" title="Log out">${ic('out')}</button></div></aside>
      <div class="main"><div class="topbar"><img class="logo" src="/assets/logo-light.png" alt="Mihir Group"><img class="av" src="${esc(u.photoUrl || '/assets/mark.png')}" alt="" id="out2" title="Log out"></div>
        <main class="page" id="view"></main></div></div>
      <nav class="mnav" id="mnav">${nav().slice(0, 5).map(([k, l, i]) => `<a href="#${k}" data-v="${k}">${ic(i, 20)}<span>${l.replace(/^My /, '').split(' ')[0]}</span></a>`).join('')}</nav>`;
    const logout = run(async () => { await api('/api/auth/logout', { method: 'POST' }); state.user = null; renderLogin(); });
    $('out').onclick = logout; $('out2').onclick = logout;
  }

  function route() {
    if (!state.user) return;
    const allowed = nav().map((n) => n[0]);
    const v = allowed.includes(location.hash.slice(1)) ? location.hash.slice(1) : allowed[0];
    document.querySelectorAll('#nav a, #mnav a').forEach((a) => a.classList.toggle('on', a.dataset.v === v));
    const fn = { home: viewHome, customers: viewCustomers, board: viewBoard, approvals: viewApprovals, payments: viewPayments, team: viewTeam, outbox: viewOutbox }[v];
    $('view').innerHTML = '<p class="muted">Loading…</p>';
    window.scrollTo(0, 0);
    run(fn)();
  }
  window.addEventListener('hashchange', route);

  const stageChip = (s) => {
    const cls = s === 'Booked' ? 'ok' : s === 'Lost' ? 'bad' : s === 'Walk-in' ? 'warn' : ['Booking form', 'KYC', 'Payment', 'Signatures'].includes(s) ? 'cu' : 'info';
    return `<span class="chip ${cls}">${esc(s)}</span>`;
  };
  const pageHead = (title, sub, actions = '') => `<div class="page-h"><div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div><div class="row">${actions}</div></div>`;
  const kpi = (label, value, icon, tone = '') => `<div class="card kpi"><div class="ic ${tone}">${ic(icon, 20)}</div><div><div class="stat">${value}</div><div class="small muted">${label}</div></div></div>`;

  /* ---------------- My profile ---------------- */
  const contactText = (u) => `*${u.name}*\n${u.designation}, ${state.org.name}\n📞 ${ph(u.phone)}\n✉️ ${u.email}\n🌐 ${state.org.website}\n🪪 ${u.cardUrl}`;
  const ecard = (u) => `<div class="ecard"><div class="ecard-top"><img class="ecard-logo" src="/assets/logo-light.png" alt="${esc(state.org.name)}"><img class="ecard-photo" src="${esc(u.photoUrl || '/assets/mark.png')}" alt=""></div>
    <div><div class="ecard-name">${esc(u.name)}</div><div class="ecard-desig">${esc(u.designation)}</div></div>
    <div class="ecard-ct">📞 ${esc(ph(u.phone))}<br>✉️ ${esc(u.email)}<br>🌐 ${esc(state.org.website)}</div><div class="ecard-tag">${esc(state.org.tagline)}</div><div class="ecard-bar"></div></div>`;

  async function viewHome() {
    const u = state.user;
    const { enquiries } = await api('/api/enquiries?mine=1');
    const inBooking = enquiries.filter((e) => ['Booking form', 'KYC', 'Payment', 'Signatures'].includes(e.stage)).length;
    const recent = enquiries.slice(0, 5);
    $('view').innerHTML = `
      <div class="hero">
        <label style="margin:0;cursor:pointer;position:relative" title="Change photo"><img class="big" src="${esc(u.photoUrl || '/assets/mark.png')}" alt="Profile photo"><span class="edit">✎</span>
          <input type="file" id="ph" accept="image/png,image/jpeg,image/webp" hidden></label>
        <div style="flex:1;min-width:220px;position:relative;z-index:1"><div class="eyebrow" style="color:var(--copper-l)">${esc(state.org.name)}</div><h1>${esc(u.name)}</h1>
          <div class="meta">${esc(u.designation)}${u.employeeId ? ' · ' + esc(u.employeeId) : ''} · ${esc(ph(u.phone))} · ${esc(u.email)}</div>
          <div class="meta" style="margin-top:4px">${ic('pin', 14)} ${u.projects.map((p) => esc(p.name)).join(' · ') || 'No projects assigned'}</div></div>
        <div class="row" style="position:relative;z-index:1"><a class="btn wa" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(contactText(u))}">${ic('wa')} Share my details</a><button class="btn ghost" id="cp">Copy</button></div>
      </div>
      <div class="grid g4" style="margin:16px 0">${kpi('My customers', enquiries.length, 'users', 'navy')}${kpi('In booking', inBooking, 'doc')}${kpi('Booked', enquiries.filter((e) => e.stage === 'Booked').length, 'star', 'ok')}${kpi('New walk-ins', enquiries.filter((e) => e.stage === 'Walk-in').length, 'clock', 'warn')}</div>
      <div class="grid g2">
        <div class="card"><div class="row between" style="margin-bottom:12px"><h3 style="margin:0">My status</h3><span class="tiny muted">New walk-ins only go to people marked Available</span></div>
          <div class="pill-tog" id="st">${state.statuses.map((s) => `<button class="${u.status === s ? 'on' : ''}" data-s="${s}">${s}</button>`).join('')}</div>
          <h3 style="margin:22px 0 6px">Latest customers</h3>
          ${recent.length ? recent.map((e) => `<div class="ex-row" style="cursor:pointer" data-open="${e.id}"><span class="initials">${esc(ini(e.name))}</span><div style="flex:1"><b>${esc(e.name)}</b><div class="tiny muted">${esc(e.project_name)} · ${esc(e.config)} · ${time(e.created_at)}</div></div>${stageChip(e.stage)}</div>`).join('') : '<div class="empty">No customers yet — they appear here as soon as a walk-in is assigned to you.</div>'}
        </div>
        <div class="card"><div class="row between" style="margin-bottom:12px"><h3 style="margin:0">My e-visiting card</h3><span class="tiny muted">Same Mihir format for everyone</span></div>
          ${ecard(u)}
          <div class="row" style="margin-top:16px">
            <a class="btn wa sm" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent('My ' + state.org.name + ' visiting card: ' + u.cardUrl)}">${ic('wa', 16)} Send card on WhatsApp</a>
            <a class="btn ghost sm" href="${esc(u.cardUrl)}" target="_blank" rel="noopener">${ic('eye', 16)} Open card page</a></div></div>
      </div>
      <div class="card" style="margin-top:16px"><h3>Change PIN</h3><form id="pf" class="row" style="align-items:flex-end">
        <div class="field"><label>Current PIN</label><input type="password" name="current" inputmode="numeric" maxlength="6" required></div>
        <div class="field"><label>New PIN (4–6 digits)</label><input type="password" name="next" inputmode="numeric" maxlength="6" required></div>
        <div class="field" style="flex:0"><button class="btn">Update PIN</button></div></form></div>`;
    $('ph').onchange = run(async (ev) => {
      const f = ev.target.files[0]; if (!f) return;
      const fd = new FormData(); fd.append('photo', await shrink(f), f.name);
      const j = await api('/api/me/photo', { method: 'POST', body: fd });
      state.user = j.user; shell(); route(); toast('Photo updated');
    });
    document.querySelectorAll('#st button').forEach((b) => (b.onclick = run(async () => {
      const j = await api('/api/me', { method: 'PATCH', json: { status: b.dataset.s } }); state.user = j.user; viewHome(); toast('Status: ' + b.dataset.s);
    })));
    document.querySelectorAll('[data-open]').forEach((b) => (b.onclick = () => openEnquiry(b.dataset.open)));
    $('cp').onclick = async () => { try { await navigator.clipboard.writeText(contactText(u).replace(/\*/g, '')); toast('Copied'); } catch { toast('Copy not allowed here', true); } };
    $('pf').onsubmit = run(async (ev) => { ev.preventDefault(); const fd = new FormData(ev.target); await api('/api/me/pin', { json: Object.fromEntries(fd) }); ev.target.reset(); toast('PIN changed'); });
  }

  /* ---------------- Customers ---------------- */
  async function viewCustomers() {
    const mine = state.user.role === 'sales';
    $('view').innerHTML = pageHead(mine ? 'My customers' : 'All enquiries', 'Tap a customer to open their journey.',
      `<div style="position:relative"><span style="position:absolute;left:11px;top:11px;color:var(--muted)">${ic('search', 16)}</span><input type="text" id="q" placeholder="Search name, mobile or ID" style="width:250px;padding-left:34px"></div>
       <select id="sg" style="width:auto"><option value="">All stages</option>${state.stages.map((s) => `<option>${s}</option>`).join('')}</select>`) +
      '<div class="card pad-0" style="overflow-x:auto"><table id="t"></table></div>';
    const load = run(async () => {
      const qs = new URLSearchParams({ q: $('q').value, stage: $('sg').value });
      const { enquiries } = await api('/api/enquiries?' + qs);
      $('t').innerHTML = `<thead><tr><th>Customer</th><th>Interest</th><th>Source</th>${mine ? '' : '<th>Sales</th>'}<th>Stage</th><th>Walk-in</th><th></th></tr></thead><tbody>` +
        (enquiries.length ? enquiries.map((e) => `<tr class="click" data-open="${e.id}"><td><div class="who-cell"><span class="initials">${esc(ini(e.name))}</span><div><b>${esc(e.name)}</b><div class="tiny muted">${e.id} · ${esc(e.mobile)}</div></div></div></td>
          <td class="small">${esc(e.project_name)}<div class="tiny muted">${esc(e.config)} · ${esc(e.budget)}</div></td><td class="small">${esc(e.source)}${e.cp_name ? `<div class="tiny muted">${esc(e.cp_name)}</div>` : ''}</td>
          ${mine ? '' : `<td class="small">${esc(e.assigned_name || '—')}</td>`}<td>${stageChip(e.stage)}</td><td class="small muted">${time(e.created_at)}</td>
          <td style="white-space:nowrap" onclick="event.stopPropagation()"><a class="btn wa sm" target="_blank" rel="noopener" title="WhatsApp" href="https://wa.me/91${esc(e.mobile)}?text=${encodeURIComponent('Hi ' + first(e.name) + ', this is ' + state.user.name + ' from ' + state.org.name + '.')}">${ic('wa', 15)}</a></td></tr>`).join('')
          : `<tr><td colspan="7" class="empty">No enquiries match.</td></tr>`) + '</tbody>';
      document.querySelectorAll('[data-open]').forEach((b) => (b.onclick = () => openEnquiry(b.dataset.open)));
    });
    let t; $('q').oninput = () => { clearTimeout(t); t = setTimeout(load, 250); }; $('sg').onchange = load; load();
  }

  /* ---------------- Reception board ---------------- */
  let boardTimer;
  async function viewBoard() {
    clearInterval(boardTimer);
    const draw = async () => {
      const b = await api('/api/board');
      const s = b.stats;
      $('view').innerHTML = pageHead('Reception board', `Today's walk-ins · refreshes every 20 seconds`, `<a class="btn copper" href="/kiosk/" target="_blank" rel="noopener">${ic('plus', 16)} Open kiosk</a>`) +
        `<div class="grid g4" style="margin-bottom:16px">${kpi('Walk-ins today', s.walkins, 'users', 'navy')}${kpi('Waiting to be attended', s.waiting, 'clock', 'warn')}${kpi('Booked today', s.booked, 'star', 'ok')}${kpi('Sales team free', `${s.free}<span class="muted" style="font-size:18px"> / ${s.team}</span>`, 'team')}</div>
        ${s.unassigned ? `<div class="banner" style="margin-bottom:14px"><b>${s.unassigned} walk-in(s) need a sales person</b> — no one was on duty. Assign below.</div>` : ''}
        <div class="grid" style="grid-template-columns:minmax(0,2.3fr) minmax(270px,1fr)">
          <div class="card pad-0" style="overflow-x:auto"><div class="card-h"><h3>Walk-ins today</h3><span class="chip plain">${b.enquiries.length}</span></div><table>
            <thead><tr><th>Time</th><th>Customer</th><th>Interest</th><th>Assigned to</th><th>Stage</th></tr></thead><tbody>
            ${b.enquiries.map((e) => `<tr class="click" data-open="${e.id}"><td class="small muted">${time(e.created_at).split(', ').pop()}</td><td><b>${esc(e.name)}</b><div class="tiny muted">${e.id} · ${esc(e.mobile)}</div></td>
              <td class="small">${esc(e.project_name)}<div class="tiny muted">${esc(e.config)} · ${esc(e.source)}</div></td>
              <td onclick="event.stopPropagation()"><select data-re="${e.id}" style="min-width:150px;padding:8px 10px"><option value="">— choose —</option>${b.team.map((x) => `<option value="${x.id}" ${x.id === e.assigned_to ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></td>
              <td>${stageChip(e.stage)}${e.wa_linked_at ? ' <span class="chip ok plain" title="Customer messaged on WhatsApp">WA ✓</span>' : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">No walk-ins yet today.</td></tr>'}
          </tbody></table></div>
          <div class="card"><h3>Sales team</h3>${b.team.map((x) => `<div class="ex-row">${avatar(x.photoUrl, x.name)}
            <div style="flex:1;min-width:0"><b>${esc(x.name)}</b><div class="tiny muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${x.projects.map((p) => esc(p.name)).join(', ')} · ${x.today} today</div></div>
            <select data-st="${x.id}" style="width:auto;font-size:12px;padding:6px 8px">${state.statuses.map((st) => `<option ${st === x.status ? 'selected' : ''}>${st}</option>`).join('')}</select></div>`).join('')}</div>
        </div>`;
      document.querySelectorAll('[data-open]').forEach((bn) => (bn.onclick = () => openEnquiry(bn.dataset.open)));
      document.querySelectorAll('[data-st]').forEach((sel) => (sel.onchange = run(async () => { await api(`/api/team/${sel.dataset.st}/status`, { method: 'PATCH', json: { status: sel.value } }); toast('Status updated'); })));
      document.querySelectorAll('[data-re]').forEach((sel) => (sel.onchange = () => { if (sel.value) reassignDialog(sel.dataset.re, sel.value, sel.selectedOptions[0].text, draw); }));
    };
    await draw();
    boardTimer = setInterval(() => { if (!$('drawer').classList.contains('on') && ['#board', ''].includes(location.hash) && !$('appSheet')) run(draw)(); }, 20000);
  }

  function reassignDialog(id, userId, name, after) {
    $('drawer').innerHTML = `<div class="dh"><div class="t"><div><h2>Assign ${esc(id)}</h2><div class="sub">to ${esc(name)}</div></div><button class="icon-btn" id="x">${ic('x')}</button></div></div>
      <div class="db"><div class="sec"><div class="field"><label>Reason (saved in the audit log)</label>
      <select id="rr"><option>Assigned person busy / in a meeting</option><option>Customer asked for someone else</option><option>Language preference</option><option>Project specialist needed</option><option>No one was on duty</option><option>Other</option></select></div>
      <button class="btn copper" id="ok">Assign & notify on WhatsApp</button></div></div>`;
    openDrawer();
    $('x').onclick = () => { closeDrawer(); after && run(after)(); };
    $('ok').onclick = run(async () => { await api(`/api/enquiries/${id}/reassign`, { json: { userId, reason: $('rr').value } }); closeDrawer(); toast('Assigned — WhatsApp sent'); after && run(after)(); });
  }

  /* ---------------- Approvals ---------------- */
  async function viewApprovals() {
    const { enquiries } = await api('/api/enquiries?stage=Signatures');
    $('view').innerHTML = pageHead('Waiting for approval', 'Payment verified and applicants have signed. Review the application, sign for the Developer and approve.') +
      `<div class="card pad-0" style="overflow-x:auto"><table><thead><tr><th>Customer</th><th>Project</th><th>Sales</th><th>Updated</th><th></th></tr></thead><tbody>
      ${enquiries.map((e) => `<tr class="click" data-open="${e.id}"><td><b>${esc(e.name)}</b><div class="tiny muted">${e.id}</div></td><td class="small">${esc(e.project_name)} · ${esc(e.config)}</td><td class="small">${esc(e.assigned_name)}</td><td class="small muted">${time(e.updated_at)}</td>
        <td><button class="btn sm copper">Review</button></td></tr>`).join('') || '<tr><td colspan="5" class="empty">Nothing waiting for approval.</td></tr>'}</tbody></table></div>`;
    document.querySelectorAll('[data-open]').forEach((b) => (b.onclick = () => openEnquiry(b.dataset.open)));
  }

  /* ---------------- Payments (accounts) ---------------- */
  async function viewPayments() {
    $('view').innerHTML = pageHead('Payments', 'Verify booking payments against the bank statement.',
      `<div class="pill-tog" id="pt">${['Pending verification', 'Received', 'Rejected'].map((s, i) => `<button data-s="${s}" class="${i ? '' : 'on'}">${s}</button>`).join('')}</div>`) +
      '<div class="card pad-0" style="overflow-x:auto"><table id="pa"></table></div>';
    let cur = 'Pending verification';
    const load = run(async () => {
      const { payments } = await api('/api/payments?status=' + encodeURIComponent(cur));
      $('pa').innerHTML = `<thead><tr><th>Customer</th><th>Unit</th><th>Amount</th><th>Mode / Ref</th><th>Bank</th><th>Submitted</th><th></th></tr></thead><tbody>` +
        (payments.map((p) => `<tr><td><b>${esc(p.customer)}</b><div class="tiny muted">${p.enquiry_id} · ${esc(p.mobile)}</div></td><td class="small">${esc(p.project_name)}<div class="tiny muted">${esc(p.unit || '—')}</div></td>
          <td><b>${inr(p.amount)}</b></td><td class="small">${esc(p.mode)}<div class="tiny muted mono">${esc(p.ref)}</div></td><td class="small">${esc(p.bank_name || '—')}<div class="tiny muted">${esc(p.branch || '')} ${p.txn_date ? '· ' + day(p.txn_date) : ''}</div></td>
          <td class="small">${esc(p.submitted_name || '')}<div class="tiny muted">${time(p.submitted_at)}</div></td>
          <td style="white-space:nowrap">${p.status === 'Pending verification'
            ? `<input type="text" placeholder="Receipt no." data-rn="${p.id}" style="width:120px;padding:7px 9px"> <button class="btn sm" data-ok="${p.id}">Verify</button> <button class="btn danger sm" data-no="${p.id}">Reject</button>`
            : `<span class="chip ${p.status === 'Received' ? 'ok' : 'bad'}">${esc(p.receipt_no || p.status)}</span> <span class="tiny muted">${esc(p.remarks || '')}</span>`}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">Nothing here.</td></tr>') + '</tbody>';
      document.querySelectorAll('[data-ok]').forEach((b) => (b.onclick = run(async () => {
        await api(`/api/payments/${b.dataset.ok}/verify`, { json: { receiptNo: document.querySelector(`[data-rn="${b.dataset.ok}"]`).value } }); toast('Payment verified — sales notified'); load();
      })));
      document.querySelectorAll('[data-no]').forEach((b) => (b.onclick = () => {
        $('drawer').innerHTML = `<div class="dh"><div class="t"><h2>Reject payment</h2><button class="icon-btn" id="x">${ic('x')}</button></div></div><div class="db"><div class="sec">
          <div class="field"><label>Reason</label><input type="text" id="rm" placeholder="e.g. UTR not found in bank statement"></div><button class="btn danger" id="ok">Reject payment</button></div></div>`;
        openDrawer(); $('x').onclick = closeDrawer;
        $('ok').onclick = run(async () => { await api(`/api/payments/${b.dataset.no}/reject`, { json: { remarks: $('rm').value } }); closeDrawer(); toast('Rejected'); load(); });
      }));
    });
    document.querySelectorAll('#pt button').forEach((b) => (b.onclick = () => { cur = b.dataset.s; document.querySelectorAll('#pt button').forEach((x) => x.classList.toggle('on', x === b)); load(); }));
    load();
  }

  /* ---------------- Team ---------------- */
  async function viewTeam() {
    const t = await api('/api/team');
    const projBoxes = (sel = []) => `<div class="opts">${t.projects.map((p) => `<label><input type="checkbox" name="projectIds" value="${p.id}" ${sel.includes(p.id) ? 'checked' : ''}> ${esc(p.name)}</label>`).join('')}</div>`;
    $('view').innerHTML = pageHead('Team', 'Staff logins, project assignment and channel partners.') + `<div class="grid g2">
      <div class="card pad-0" style="overflow-x:auto"><div class="card-h"><h3>Staff</h3><span class="chip plain">${t.users.length}</span></div><table><thead><tr><th>Name</th><th>Role</th><th>Projects</th><th></th></tr></thead><tbody>
        ${t.users.map((u) => `<tr style="${u.active ? '' : 'opacity:.5'}"><td><div class="who-cell">${avatar(u.photoUrl, u.name)}<div><b>${esc(u.name)}</b><div class="tiny muted">${esc(u.designation)}${u.employeeId ? ' · ' + esc(u.employeeId) : ''} · ${esc(ph(u.phone))}</div></div></div></td>
          <td><span class="chip plain">${esc(u.role)}</span></td><td class="tiny">${u.projects.map((p) => esc(p.name)).join(', ') || '—'}</td><td><button class="btn ghost sm" data-ed="${u.id}">Edit</button></td></tr>`).join('')}</tbody></table></div>
      <div><div class="card"><h3>Add staff</h3><form id="nf">
        <div class="fgrid"><div class="field"><label>Name *</label><input type="text" name="name" required></div><div class="field"><label>Designation</label><input type="text" name="designation"></div>
        <div class="field"><label>Mobile *</label><input type="tel" name="phone" required></div><div class="field"><label>Email</label><input type="email" name="email"></div>
        <div class="field"><label>Employee ID</label><input type="text" name="employeeId"></div>
        <div class="field"><label>Role *</label><select name="role"><option value="sales">Sales</option><option value="reception">Reception</option><option value="manager">Manager</option><option value="accounts">Accounts</option></select></div>
        <div class="field"><label>Starting PIN *</label><input type="text" name="pin" required inputmode="numeric" maxlength="6"></div></div>
        <div class="field"><label>Projects (sales)</label>${projBoxes()}</div><button class="btn copper">Add staff</button></form></div>
      <div class="card" style="margin-top:16px"><h3>Channel partners</h3><p class="small muted" style="margin-top:-4px">Leads from a channel partner go straight to its owner; details auto-fill the booking application.</p>
        ${t.channelPartners.map((c) => `<div class="ex-row"><div style="flex:1"><b>${esc(c.name)}</b><div class="tiny muted">${esc(c.reg_code || 'No RERA code')} · ${esc(c.rep_name || '—')} ${c.phone ? '· ' + esc(c.phone) : ''}</div></div><span class="small muted">${esc(c.owner_name || 'Round-robin')}</span></div>`).join('')}
        <form id="cf" style="margin-top:12px"><div class="fgrid">
          <div class="field"><label>Agency name *</label><input type="text" name="name" required></div><div class="field"><label>MahaRERA reg. code</label><input type="text" name="regCode"></div>
          <div class="field"><label>Representative</label><input type="text" name="repName"></div><div class="field"><label>Contact</label><input type="tel" name="phone"></div>
          <div class="field"><label>Email</label><input type="email" name="email"></div>
          <div class="field"><label>Owner</label><select name="ownerUserId"><option value="">— none —</option>${t.users.filter((u) => u.role === 'sales' && u.active).map((u) => `<option value="${u.id}">${esc(u.name)}</option>`).join('')}</select></div></div>
          <button class="btn sm">Save channel partner</button></form></div></div></div>`;
    $('nf').onsubmit = run(async (ev) => {
      ev.preventDefault(); const fd = new FormData(ev.target);
      await api('/api/team', { json: { ...Object.fromEntries(fd), projectIds: fd.getAll('projectIds') } }); toast('Staff added'); viewTeam();
    });
    $('cf').onsubmit = run(async (ev) => { ev.preventDefault(); const fd = new FormData(ev.target); await api('/api/channel-partners', { json: Object.fromEntries(fd) }); toast('Saved'); viewTeam(); });
    document.querySelectorAll('[data-ed]').forEach((b) => (b.onclick = () => {
      const u = t.users.find((x) => String(x.id) === b.dataset.ed);
      $('drawer').innerHTML = `<div class="dh"><div class="t"><div><h2>Edit ${esc(u.name)}</h2><div class="sub">${esc(u.role)} · ${esc(ph(u.phone))}</div></div><button class="icon-btn" id="x">${ic('x')}</button></div></div><div class="db"><form class="sec" id="ef">
        <div class="fgrid"><div class="field"><label>Name</label><input type="text" name="name" value="${esc(u.name)}"></div><div class="field"><label>Designation</label><input type="text" name="designation" value="${esc(u.designation)}"></div>
        <div class="field"><label>Email</label><input type="email" name="email" value="${esc(u.email)}"></div><div class="field"><label>Employee ID</label><input type="text" name="employeeId" value="${esc(u.employeeId)}"></div>
        <div class="field"><label>Reset PIN (blank = keep)</label><input type="text" name="pin" inputmode="numeric" maxlength="6"></div>
        <div class="field"><label>Status</label><select name="active"><option value="1" ${u.active ? 'selected' : ''}>Active</option><option value="0" ${u.active ? '' : 'selected'}>Deactivated</option></select></div></div>
        <div class="field"><label>Projects</label>${projBoxes(u.projects.map((p) => p.id))}</div>
        <button class="btn copper">Save</button></form></div>`;
      openDrawer(); $('x').onclick = closeDrawer;
      $('ef').onsubmit = run(async (ev) => {
        ev.preventDefault(); const fd = new FormData(ev.target); const body = Object.fromEntries(fd);
        body.projectIds = fd.getAll('projectIds'); body.active = body.active === '1'; if (!body.pin) delete body.pin;
        await api(`/api/team/${u.id}`, { method: 'PATCH', json: body }); closeDrawer(); toast('Saved'); viewTeam();
      });
    }));
  }

  /* ---------------- Outbox ---------------- */
  async function viewOutbox() {
    const o = await api('/api/outbox');
    $('view').innerHTML = pageHead('Outbox & sync', 'In mock mode nothing leaves the server — this is exactly what would be sent.') + `<div class="grid g2">
      <div class="card"><h3>WhatsApp</h3><div style="max-height:70vh;overflow:auto">${o.whatsapp.map((m) => `<div class="ex-row" style="align-items:flex-start"><div style="flex:1">
        <div class="tiny muted">${time(m.at)} · ${m.direction === 'in' ? 'from' : 'to'} +${esc(m.to_from)} · ${esc(m.kind)} <span class="chip ${m.status === 'failed' ? 'bad' : m.status === 'mock' ? 'warn' : 'ok'}">${esc(m.status)}</span> ${esc(m.enquiry_id || '')}</div>
        <div class="small" style="white-space:pre-line;margin-top:4px">${esc(m.body)}</div></div></div>`).join('') || '<div class="empty">Nothing yet.</div>'}</div></div>
      <div class="card"><h3>CRM & inventory sync</h3><div class="log" style="max-height:70vh">${o.sync.map((s) => `${time(s.at)}  [${s.target}] ${s.action} ${s.enquiry_id || ''} → ${s.status}`).map(esc).join('\n') || 'Nothing yet.'}</div></div></div>`;
  }

  /* ---------------- Enquiry sheet: walk-in → booked ---------------- */
  function openDrawer() { $('drawer').classList.add('on'); $('dBg').classList.add('on'); }
  function closeDrawer() { $('drawer').classList.remove('on'); $('dBg').classList.remove('on'); }
  $('dBg').onclick = () => { closeDrawer(); route(); };

  const KYC = [['pan', 'PAN card', true], ['aadhaar', 'Aadhaar', true], ['photo', 'Passport photo', true], ['co_pan', 'Co-applicant PAN', false], ['co_aadhaar', 'Co-applicant Aadhaar', false], ['other', 'Other', false]];
  const MODES = ['UPI', 'NEFT/RTGS', 'IMPS', 'Cheque', 'Demand Draft', 'Payment link'];

  async function openEnquiry(id) {
    const { enquiry: e } = await api('/api/enquiries/' + id).catch((err) => { toast(err.message, true); return {}; });
    if (!e) return;
    const role = state.user.role; const canSell = ['sales', 'manager', 'admin'].includes(role);
    const canDesk = ['reception', 'manager', 'admin'].includes(role); const canApprove = ['manager', 'admin'].includes(role);
    const st = state.stages.filter((s) => s !== 'Lost'); const ci = e.stage === 'Lost' ? -1 : st.indexOf(e.stage);
    const b = e.booking || {}; const form = b.extra || {};
    const paid = e.payments.find((p) => p.status === 'Received'); const pending = e.payments.find((p) => p.status === 'Pending verification');
    const lock = (minStage) => (ci < st.indexOf(minStage) || !canSell ? 'lock' : '');
    const haveKyc = new Set(e.kyc.map((k) => k.kind));
    const sig = e.signatures; const hasA2 = !!(form.a2 && form.a2.name);
    const cap = b.total_consideration ? Math.floor(b.total_consideration * 0.1) : null;
    const submitted = ci >= st.indexOf('KYC');

    $('drawer').innerHTML = `<div class="dh"><div class="t"><div><div class="eyebrow" style="color:var(--copper-l)">${e.id} · ${esc(e.project_name)}</div><h2>${esc(e.name)}</h2>
      <div class="sub">${esc(e.assigned_name || 'Unassigned')} · ${esc(e.assign_reason)}</div></div>
      <div class="row" style="gap:8px"><a class="btn wa sm" target="_blank" rel="noopener" href="https://wa.me/91${esc(e.mobile)}">${ic('wa', 16)}</a><button class="icon-btn" id="x">${ic('x')}</button></div></div>
      ${e.stage === 'Lost' ? '<div class="chip bad" style="margin-top:10px">Marked lost</div>' : `<div class="stepper">${st.map((s, i) => `<div class="${i < ci ? 'done' : i === ci ? 'cur' : ''}">${s}</div>`).join('')}</div>`}</div>
    <div class="db">
      <div class="sec"><h3><span><span class="n">1</span>Enquiry</span>${e.stage === 'Walk-in' && canSell ? '<button class="btn sm copper" id="bAttend">Start attending</button>' : stageChip(e.stage)}</h3>
        <div class="kv"><span>Mobile</span><span>+91 ${esc(e.mobile)} ${e.wa_linked_at ? '<span class="chip ok plain">on WhatsApp</span>' : ''}</span><span>Email</span><span>${esc(e.email || '—')}</span>
        <span>Residence</span><span>${esc(e.residence || '—')}</span><span>Interest</span><span>${esc(e.project_name)} · ${esc(e.config)} · ${esc(e.budget)}</span>
        <span>Purpose</span><span>${esc(e.purpose || '—')}</span><span>Source</span><span>${esc(e.source)}${e.cp_name ? ' — ' + esc(e.cp_name) : ''}</span><span>Visit</span><span>${esc(e.visit_pref || '—')}</span><span>Walked in</span><span>${time(e.created_at)}</span></div>
        ${canDesk ? `<div class="row" style="margin-top:14px"><label style="margin:0">Reassign to</label><select id="reSel" style="width:auto"><option value="">— choose —</option></select></div>` : ''}</div>

      <div class="sec ${lock('Attending')}"><h3><span><span class="n">2</span>Site visit</span>${ci >= st.indexOf('Site visit') ? '<span class="chip ok">Done</span>' : ''}</h3>
        <div class="fgrid"><div class="field"><label>Units shown</label><input type="text" id="svU" placeholder="e.g. A-1204, A-0905"></div>
        <div class="field"><label>Feedback</label><select id="svF"><option>Hot — ready to book</option><option>Warm — family visit needed</option><option>Cold — just exploring</option></select></div>
        <div class="field"><label>Note</label><input type="text" id="svN" placeholder="optional"></div></div>
        <button class="btn sm" id="bVisit">Save visit</button></div>

      <div class="sec ${lock('Attending')}"><h3><span><span class="n">3</span>Booking application</span>${e.booking ? (submitted ? '<span class="chip ok">Submitted</span>' : '<span class="chip warn">Draft</span>') : ''}</h3>
        ${e.booking ? `<div class="unit-card"><div><span>Unit</span><b>${esc(b.tower)} · ${esc(b.unit)}</b></div><div><span>Floor</span><b>${esc(b.floor || '—')}</b></div><div><span>Carpet</span><b>${esc(b.carpet_area || '—')} sq ft</b></div>
          <div><span>Total consideration</span><b>${inr(b.total_consideration)}</b></div><div><span>Applicants</span><b>${esc((form.a1 && form.a1.name) || e.name)}${hasA2 ? ' + ' + esc(form.a2.name) : ''}</b></div>
          <div><span>Unit hold</span><b>${b.hold_until ? 'till ' + time(b.hold_until) : e.stage === 'Booked' ? 'Sold' : '—'}</b></div></div>` : '<p class="small muted">Fill the full Booking Application Form with the customer: applicants, address, flat, bank, loan, CLP, sales & channel partner, declaration.</p>'}
        <div class="row"><button class="btn copper" id="bApp">${ic('doc', 16)} ${e.booking ? (e.stage === 'Booked' ? 'View application' : 'Open booking application') : 'Start booking application'}</button>
          ${e.booking ? `<a class="btn ghost sm" href="/api/enquiries/${e.id}/application.pdf" target="_blank" rel="noopener">${ic('eye', 16)} Preview PDF</a>` : ''}</div></div>

      <div class="sec ${lock('KYC')}"><h3><span><span class="n">4</span>KYC documents</span>${ci >= st.indexOf('Payment') ? '<span class="chip ok">Complete</span>' : ''}</h3>
        ${KYC.map(([k, l, req]) => `<div class="row between" style="padding:8px 0;border-bottom:1px solid var(--line-2)"><span>${l}${req ? ' <span class="muted">*</span>' : ''}</span><span class="row" style="gap:6px">
          ${e.kyc.filter((d) => d.kind === k).map((d) => `<a class="chip ok plain" href="/api/files/${d.file_id}" target="_blank" rel="noopener">View</a>`).join('')}
          <label class="btn ghost sm" style="margin:0">Upload<input type="file" data-k="${k}" hidden accept="image/*,application/pdf"></label></span></div>`).join('')}
        <div style="margin-top:12px"><button class="btn sm" id="bKyc" ${['pan', 'aadhaar', 'photo'].every((k) => haveKyc.has(k)) && ci < st.indexOf('Payment') ? '' : 'disabled'}>Mark KYC complete</button></div></div>

      <div class="sec ${lock('Payment')}"><h3><span><span class="n">5</span>First transaction / booking payment</span>${paid ? `<span class="chip ok">Received · ${esc(paid.receipt_no)}</span>` : pending ? '<span class="chip warn">With Accounts</span>' : ''}</h3>
        ${cap ? `<div class="banner info" style="margin-bottom:12px">${ic('stamp', 16)}<span>RERA: booking amount before the Agreement for Sale can be at most <b>${inr(cap)}</b> (10% of ${inr(b.total_consideration)}). Pay into the project's RERA designated collection account only.</span></div>` : ''}
        ${e.payments.map((p) => `<div class="ex-row"><div style="flex:1"><b>${inr(p.amount)}</b> · ${esc(p.mode)} · <span class="mono small">${esc(p.ref || '—')}</span><div class="tiny muted">${esc(p.bank_name || '')} ${esc(p.branch || '')} ${p.txn_date ? '· ' + day(p.txn_date) : ''}${p.remarks ? ' · ' + esc(p.remarks) : ''}</div></div><span class="chip ${p.status === 'Received' ? 'ok' : p.status === 'Rejected' ? 'bad' : 'warn'}">${esc(p.status)}</span></div>`).join('')}
        ${paid ? '' : `<div class="fgrid" style="margin-top:10px">
          <div class="field"><label>Booking amount (₹) *</label><input type="text" id="pyA" inputmode="numeric" value="${cap && form.clp ? esc((form.clp.find((r) => /booking/i.test(r.milestone)) || {}).amount || '') : ''}"></div>
          <div class="field"><label>Transaction date *</label><input type="date" id="pyD" value="${new Date().toISOString().slice(0, 10)}"></div>
          <div class="field"><label>Payment mode *</label><select id="pyM">${MODES.map((m) => `<option>${m}</option>`).join('')}</select></div>
          <div class="field"><label>Cheque / UTR / Transaction no. *</label><input type="text" id="pyR"></div>
          <div class="field"><label>Bank name</label><input type="text" id="pyB" value="${esc((form.a1 && form.a1.bank) || '')}"></div>
          <div class="field"><label>Branch</label><input type="text" id="pyBr" value="${esc((form.a1 && form.a1.branch) || '')}"></div></div>
          <div class="row"><button class="btn" id="bPay" ${pending ? 'disabled' : ''}>Send to Accounts</button><span class="tiny muted" id="pyW"></span></div>`}</div>

      <div class="sec ${paid && canSell ? '' : 'lock'}"><h3><span><span class="n">6</span>Applicant signatures</span>${sig.customer && (!hasA2 || sig.co_applicant) ? '<span class="chip ok">Signed</span>' : ''}</h3>
        <p class="small muted" style="margin-top:-6px">The applicant(s) confirm the declaration and sign on screen.</p>
        <div class="grid g2">
          <div><label>First applicant — ${esc((form.a1 && form.a1.name) || e.name)}</label>${sig.customer ? `<div class="sig-box"><img src="/api/files/${sig.customer.file_id}" alt="Signature"><div class="tiny muted">${time(sig.customer.signed_at)}</div></div>` : '<canvas class="sig" id="sgC"></canvas><button class="btn ghost sm" style="margin-top:6px" data-clr="sgC">Clear</button>'}</div>
          ${hasA2 ? `<div><label>Second applicant — ${esc(form.a2.name)}</label>${sig.co_applicant ? `<div class="sig-box"><img src="/api/files/${sig.co_applicant.file_id}" alt="Signature"><div class="tiny muted">${time(sig.co_applicant.signed_at)}</div></div>` : '<canvas class="sig" id="sgC2"></canvas><button class="btn ghost sm" style="margin-top:6px" data-clr="sgC2">Clear</button>'}</div>` : ''}
        </div>
        ${sig.customer && (!hasA2 || sig.co_applicant) ? '' : '<button class="btn" id="bSign" style="margin-top:12px">Save signatures</button>'}</div>

      <div class="sec ${sig.customer && (!hasA2 || sig.co_applicant) && paid ? '' : 'lock'}"><h3><span><span class="n">7</span>Developer approval</span>${sig.developer ? '<span class="chip ok">Booked</span>' : ''}</h3>
        ${sig.developer ? `<p class="small">Approved ${time(sig.developer.signed_at)}. Flat marked <b>Sold</b>, CRM enquiry closed, signed application sent to the customer on WhatsApp.</p>
          <div class="row"><a class="btn copper sm" href="/api/enquiries/${e.id}/booking.pdf" target="_blank" rel="noopener">${ic('doc', 16)} Signed booking application</a><button class="btn wa sm" id="bShare">${ic('wa', 16)} Send PDF link</button></div>`
          : canApprove ? `<p class="small muted" style="margin-top:-6px">Review the application, then sign for the Developer / Authorised Representative.</p>
            <canvas class="sig" id="sgD"></canvas><div class="row" style="margin-top:10px"><button class="btn ghost sm" data-clr="sgD">Clear</button><a class="btn ghost sm" href="/api/enquiries/${e.id}/application.pdf" target="_blank" rel="noopener">${ic('eye', 16)} Review application</a><button class="btn copper" id="bApprove" style="margin-left:auto">${ic('stamp', 16)} Sign & approve booking</button></div>`
          : '<p class="small muted">Waiting for the sales manager to sign and approve.</p>'}</div>

      <div class="sec"><h3><span>Activity</span></h3>
        ${canSell || canDesk ? '<div class="row" style="margin-bottom:12px"><input type="text" id="note" placeholder="Add a note / follow-up" style="flex:1"><button class="btn sm" id="bNote">Add</button></div>' : ''}
        <ul class="timeline">${e.activities.map((a) => `<li><span class="tiny muted">${time(a.at)} · ${esc(a.user_name || 'System')}</span><br>${esc(a.note || a.type)}</li>`).join('')}</ul>
        ${canSell && !['Booked', 'Lost'].includes(e.stage) ? '<button class="btn danger sm" id="bLost" style="margin-top:10px">Mark as lost</button>' : ''}</div>

      <div class="sec"><h3><span>CRM & inventory sync</span>${e.sync.some((s) => s.status === 'failed') ? '<button class="btn danger sm" id="bRetry">Retry</button>' : ''}</h3>
        <div class="log">${e.sync.map((s) => `${time(s.at)}  [${s.target}] ${s.action} → ${s.status}`).map(esc).join('\n') || 'Nothing yet.'}</div></div>
    </div>`;
    openDrawer();
    $('drawer').scrollTop = 0;
    const re = () => openEnquiry(id);
    const on = (elId, fn) => { const el = $(elId); if (el) el.onclick = run(fn); };
    const post = (p, json) => api(`/api/enquiries/${id}/${p}`, { json: json || {} });
    $('x').onclick = () => { closeDrawer(); route(); };

    if ($('reSel')) {
      const { team } = await api('/api/board').catch(() => ({ team: [] }));
      $('reSel').innerHTML = '<option value="">— choose —</option>' + team.filter((t) => t.id !== e.assigned_to).map((t) => `<option value="${t.id}">${esc(t.name)} (${esc(t.status)})</option>`).join('');
      $('reSel').onchange = () => { const s = $('reSel'); if (s.value) reassignDialog(id, s.value, s.selectedOptions[0].text, re); };
    }
    on('bAttend', async () => { await post('attend'); toast('Your status is now "With customer"'); re(); });
    on('bVisit', async () => { await post('visit', { units: $('svU').value, feedback: $('svF').value, note: $('svN').value }); toast('Visit saved'); re(); });
    on('bApp', async () => openApplication(e, re));
    document.querySelectorAll('#drawer input[data-k]').forEach((inp) => (inp.onchange = run(async () => {
      if (!inp.files[0]) return; const fd = new FormData(); fd.append('kind', inp.dataset.k); fd.append('file', await shrink(inp.files[0]), inp.files[0].name);
      await api(`/api/enquiries/${id}/kyc`, { method: 'POST', body: fd }); toast('Uploaded'); re();
    })));
    on('bKyc', async () => { await post('kyc/complete'); re(); });
    if ($('pyA') && cap) $('pyA').oninput = () => { const v = Number($('pyA').value.replace(/[^\d.]/g, '')); $('pyW').textContent = v > cap ? `Above the RERA 10% limit (${inr(cap)})` : ''; };
    on('bPay', async () => {
      await post('payments', { amount: $('pyA').value, mode: $('pyM').value, ref: $('pyR').value, txnDate: $('pyD').value, bankName: $('pyB').value, branch: $('pyBr').value });
      toast('Sent to Accounts for verification'); re();
    });
    const pads = {}; ['sgC', 'sgC2', 'sgD'].forEach((k) => { if ($(k)) pads[k] = sigPad($(k)); });
    document.querySelectorAll('[data-clr]').forEach((bn) => (bn.onclick = () => pads[bn.dataset.clr] && pads[bn.dataset.clr].clear()));
    on('bSign', async () => {
      const body = {};
      if (pads.sgC) { if (!pads.sgC.has()) throw new Error("First applicant's signature is missing"); body.customer = pads.sgC.png(); }
      if (pads.sgC2) { if (!pads.sgC2.has()) throw new Error("Second applicant's signature is missing"); body.coApplicant = pads.sgC2.png(); }
      await post('signatures', body); toast('Signatures saved — sent for approval'); re();
    });
    on('bApprove', async () => {
      if (!pads.sgD || !pads.sgD.has()) throw new Error('Sign for the Developer / Authorised Representative first');
      const btn = $('bApprove'); btn.disabled = true; btn.textContent = 'Approving…';
      try { await post('approve', { developer: pads.sgD.png() }); toast('Booked! Confirmation sent to the customer'); } finally { re(); }
    });
    on('bShare', async () => {
      const { url } = await api(`/api/enquiries/${id}/share-link`);
      window.open(`https://wa.me/91${e.mobile}?text=${encodeURIComponent(`Hi ${first(e.name)}, here is your signed booking application for ${b.unit} at ${e.project_name}: ${url}`)}`, '_blank', 'noopener');
    });
    on('bNote', async () => { const n = $('note').value.trim(); if (!n) return; await post('notes', { note: n }); re(); });
    on('bLost', async () => {
      const reason = window.prompt('Why is this customer lost? (e.g. budget, location, bought elsewhere)');
      if (reason === null) return; await post('lost', { reason }); toast('Marked lost'); re();
    });
    on('bRetry', async () => { await post('sync/retry'); toast('Retried'); re(); });
  }

  /* ---------------- Booking Application Form (full screen) ---------------- */
  function closeApp() { const s = $('appSheet'); if (s) s.remove(); document.body.style.overflow = ''; }

  async function openApplication(e, onDone) {
    if (!state.form) state.form = await api('/api/booking-form');
    const F = state.form;
    const b = e.booking || {};
    const readOnly = ['Booked', 'Lost'].includes(e.stage) || !['sales', 'manager', 'admin'].includes(state.user.role);
    // Start from saved application, else prefill from the enquiry.
    const f = JSON.parse(JSON.stringify(b.extra || {}));
    f.a1 = f.a1 || {}; f.a2 = f.a2 || {};
    if (!b.extra) {
      Object.assign(f.a1, { name: e.name.toUpperCase(), mobile: e.mobile, email: e.email, address: e.residence, nationality: 'Indian' });
      f.a2.nationality = ''; f.funding = 'Self-Funded'; f.cpName = e.cp_name || '';
      f.smName = e.assigned_name || ''; f.smPhone = e.assigned_phone ? '+' + e.assigned_phone : '';
    }
    if (!f.clp || !f.clp.length) f.clp = F.defaultClp.map((r) => ({ ...r, due: '' }));
    let flatId = b.flat_id || '';
    let units = [];

    const val = (o, k) => esc(o[k] ?? '');
    const input = (fd, path, v) => {
      const req = fd.req ? ' <span class="req">*</span>' : '';
      const attrs = `data-p="${path}" ${readOnly || fd.auto ? 'readonly disabled' : ''} ${fd.max ? `maxlength="${fd.max}"` : ''} ${fd.ph ? `placeholder="${esc(fd.ph)}"` : ''}`;
      let ctl;
      if (fd.type === 'select') ctl = `<select ${attrs}><option value="">— select —</option>${fd.options.map((o) => `<option ${o === v ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
      else if (fd.type === 'textarea') ctl = `<textarea ${attrs}>${esc(v)}</textarea>`;
      else ctl = `<input type="${fd.type === 'date' ? 'date' : fd.type === 'email' ? 'email' : 'text'}" ${fd.digits || fd.type === 'money' || fd.type === 'number' ? 'inputmode="numeric"' : ''} ${attrs} value="${esc(v ?? '')}" style="${fd.upper ? 'text-transform:uppercase' : ''}">`;
      return `<div class="field" ${fd.showIf === 'loan' ? 'data-loan="1"' : ''}><label>${esc(fd.label)}${req}</label>${ctl}</div>`;
    };
    const pairSection = (s) => `<div class="pair">${['a1', 'a2'].map((who) => `<div class="${who}"><div class="col-h">${who === 'a1' ? 'First applicant (primary)' : 'Second applicant (co-applicant)'}${who === 'a2' && s.id === 'applicants' ? '<span class="tiny muted" style="text-transform:none;letter-spacing:0">optional</span>' : ''}</div>
      ${s.fields.filter((fd) => !fd.only || fd.only === who).map((fd) => input(who === 'a2' ? { ...fd, req: fd.req && false } : fd, `${who}.${fd.k}`, f[who][fd.k] ?? (fd.def && who === 'a1' ? fd.def : ''))).join('')}</div>`).join('')}</div>
      ${(s.extra || []).map((fd) => input(fd, fd.k, f[fd.k])).join('')}${s.note ? `<p class="tiny muted" style="font-style:italic">${esc(s.note)}</p>` : ''}`;

    const sections = F.sections.map((s) => {
      let body = '';
      if (s.kind === 'pair') body = pairSection(s);
      else if (s.kind === 'flat') {
        body = `<div class="fgrid"><div class="field"><label>Project</label><input type="text" value="${esc(e.project_name)}" readonly disabled></div>
          <div class="field"><label>Building / Tower · Wing <span class="req">*</span></label><select id="uT" ${readOnly ? 'disabled' : ''}><option>Loading units…</option></select></div>
          <div class="field"><label>Flat / Unit Number <span class="req">*</span></label><select id="uU" ${readOnly ? 'disabled' : ''}><option value="">—</option></select></div></div>
          <div class="unit-card" id="uCard"></div>
          <div class="fgrid">${s.fields.map((fd) => input(fd, fd.k, f[fd.k])).join('')}</div>
          <div class="total-band"><span>Total Consideration Value</span><b id="totalCons">${inr(b.total_consideration)}</b></div>`;
      } else if (s.kind === 'payment') {
        const p = e.payments.find((x) => x.status !== 'Rejected');
        body = p ? `<div class="kv"><span>Booking amount</span><span><b>${inr(p.amount)}</b></span><span>Transaction date</span><span>${day(p.txn_date || p.submitted_at)}</span><span>Mode</span><span>${esc(p.mode)}</span>
          <span>Cheque / UTR</span><span class="mono">${esc(p.ref)}</span><span>Bank / Branch</span><span>${esc(p.bank_name || '—')} ${esc(p.branch || '')}</span><span>Status</span><span>${esc(p.status)}${p.receipt_no ? ' · ' + esc(p.receipt_no) : ''}</span></div>`
          : '<div class="banner info">The first transaction is recorded after the application is submitted and KYC is done (step 5 on the customer screen). It then appears here and on the PDF, with the amount in words.</div>';
      } else if (s.kind === 'single') {
        body = s.groups ? s.groups.map((g) => `<h4 style="margin:6px 0 10px">${esc(g.title)}${g.auto ? ' <span class="chip plain">auto-filled</span>' : ''}</h4><div class="fgrid">${g.fields.map((fd) => input(fd, fd.k, f[fd.k])).join('')}</div>`).join('')
          : `<div class="fgrid">${s.fields.map((fd) => input(fd, fd.k, f[fd.k] ?? fd.def ?? '')).join('')}</div>`;
      } else if (s.kind === 'clp') {
        body = `<table class="clp"><thead><tr><th style="width:44px">Sr.</th><th>Payment milestone</th><th style="width:110px">Payment %</th><th style="width:150px">Amount (₹)</th><th style="width:170px">Due date</th>${readOnly ? '' : '<th style="width:40px"></th>'}</tr></thead>
          <tbody id="clpB"></tbody><tfoot><tr><td></td><td>Total</td><td id="clpPct"></td><td id="clpAmt"></td><td colspan="2"></td></tr></tfoot></table>
          ${readOnly ? '' : '<button class="btn ghost sm" id="clpAdd" style="margin-top:10px">+ Add milestone</button>'}
          <p class="tiny muted" style="margin-top:8px">Booking amount cannot exceed 10% under RERA. Amounts are calculated from the total consideration.</p>`;
      } else if (s.id === 'terms') body = `<ol class="legal">${F.terms.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>`;
      else if (s.id === 'cancellation') {
        body = `<ol class="legal">${F.cancellation.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>
          <div class="rera"><h4 style="margin:0 0 6px">${ic('stamp', 16)} Cancellation & refund norms as per MahaRERA</h4><p class="small" style="margin:0 0 8px">For buyer-initiated cancellation (Developer not in default), deductions are capped by time elapsed from issue of the allotment letter:</p>
          <table><thead><tr><th>Cancellation request received</th><th>Maximum deduction</th></tr></thead><tbody>${F.reraSlabs.map(([a, c]) => `<tr><td>${esc(a)}</td><td><b>${esc(c)}</b></td></tr>`).join('')}</tbody></table>
          <ul class="legal" style="margin-top:10px">${F.reraNorms.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>`;
      } else if (s.id === 'declaration') {
        body = `<ul class="legal">${F.declaration.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
          <label class="check" style="margin-top:14px;padding:14px;border:1px solid var(--line);border-radius:12px;background:#FCFBF8"><input type="checkbox" data-p="declarationAccepted" ${f.declarationAccepted ? 'checked' : ''} ${readOnly ? 'disabled' : ''}> <span>The applicant(s) have read and accept the declaration, the standard terms & conditions and the cancellation policy above.</span></label>`;
      } else if (s.kind === 'signatures') {
        body = '<div class="banner info">Signatures are captured on screen after the booking payment is verified by Accounts — First applicant, Second applicant (if any) and the Developer / Authorised Representative at approval.</div>';
      }
      return `<section id="sec-${s.id}"><h3><span class="n">${s.no}</span>${esc(s.title)}</h3>${body}</section>`;
    }).join('');

    closeApp();
    document.body.style.overflow = 'hidden';
    const el = document.createElement('div');
    el.className = 'app-sheet'; el.id = 'appSheet';
    el.innerHTML = `<div class="ah"><img src="/assets/logo-light.png" alt=""><div><h2>Residential Flat Booking Application</h2><div class="sub">${e.id} · ${esc(e.name)} · ${esc(e.project_name)}${readOnly ? ' · read only' : ''}</div></div>
        <button class="icon-btn" id="appX" style="margin-left:auto">${ic('x')}</button></div>
      <nav class="app-nav" id="appNav"><div class="prog"><div class="row between tiny"><b>Completion</b><span id="progT">0%</span></div><div class="bar"><i id="progB" style="width:0"></i></div></div>
        ${F.sections.map((s) => `<a href="#sec-${s.id}" data-s="${s.id}"><span class="dot">${s.no}</span><span class="lbl">${esc(s.title)}</span></a>`).join('')}</nav>
      <div class="app-body" id="appBody">${sections}</div>
      <div class="app-foot"><span class="note" id="appNote">${readOnly ? 'This application is closed.' : 'Draft saves keep the flat on hold. Submit when the customer has confirmed every detail.'}</span>
        ${b.flat_id ? `<a class="btn ghost" href="/api/enquiries/${e.id}/application.pdf" target="_blank" rel="noopener">${ic('eye', 16)} Preview PDF</a>` : ''}
        ${readOnly ? '' : `<button class="btn ghost" id="appSave">Save draft</button><button class="btn copper" id="appSubmit">${ic('check', 16)} Submit application</button>`}</div>`;
    document.body.appendChild(el);
    $('appX').onclick = () => { closeApp(); onDone && onDone(); };
    document.querySelectorAll('#appNav a').forEach((a) => (a.onclick = (ev) => { ev.preventDefault(); $('sec-' + a.dataset.s).scrollIntoView({ behavior: 'smooth' }); }));

    // --- sync inputs into f
    const setPath = (p, v) => { const [a, k] = p.includes('.') ? p.split('.') : [null, p]; if (a) f[a][k] = v; else f[k] = v; };
    el.querySelectorAll('[data-p]').forEach((inp) => {
      inp.addEventListener(inp.type === 'checkbox' || inp.tagName === 'SELECT' ? 'change' : 'input', () => {
        setPath(inp.dataset.p, inp.type === 'checkbox' ? inp.checked : inp.value);
        inp.classList.remove('bad');
        if (['agreementValue', 'otherCharges'].includes(inp.dataset.p)) drawClp();
        if (inp.dataset.p === 'funding') loanVis();
        if (inp.dataset.p === 'carpetSqft' && inp.value) { const m = el.querySelector('[data-p="carpetSqm"]'); if (m && !m.dataset.touched) { m.value = (Number(inp.value) / 10.7639).toFixed(2); f.carpetSqm = m.value; } }
        if (inp.dataset.p === 'carpetSqm') inp.dataset.touched = '1';
        progress();
      });
    });
    const loanVis = () => el.querySelectorAll('[data-loan]').forEach((d) => (d.style.display = (f.funding || 'Self-Funded') === 'Self-Funded' ? 'none' : ''));
    loanVis();

    // --- total & CLP
    const total = () => { const a = Number(String(f.agreementValue || '').replace(/[^\d.]/g, '')); const o = Number(String(f.otherCharges || '').replace(/[^\d.]/g, '')); return a ? a + (o || 0) : 0; };
    function drawClp() {
      const t = total();
      $('totalCons').textContent = t ? inr(t) : '—';
      const body = $('clpB'); if (!body) return;
      body.innerHTML = f.clp.map((r, i) => `<tr><td>${i + 1}</td>
        <td><input type="text" data-c="${i}" data-f="milestone" value="${esc(r.milestone)}" ${readOnly ? 'disabled' : ''}></td>
        <td><input type="text" inputmode="decimal" data-c="${i}" data-f="pct" value="${esc(r.pct)}" ${readOnly ? 'disabled' : ''}></td>
        <td class="mono">${t ? Math.round((t * (Number(r.pct) || 0)) / 100).toLocaleString('en-IN') : '—'}</td>
        <td><input type="date" data-c="${i}" data-f="due" value="${esc(r.due || '')}" ${readOnly ? 'disabled' : ''}></td>
        ${readOnly ? '' : `<td><button class="icon-btn" data-del="${i}" title="Remove" style="width:30px;height:30px">${ic('x', 14)}</button></td>`}</tr>`).join('');
      const pct = f.clp.reduce((a, r) => a + (Number(r.pct) || 0), 0);
      $('clpPct').innerHTML = `<span class="chip ${Math.abs(pct - 100) < 0.01 ? 'ok' : 'bad'} plain">${pct}%</span>`;
      $('clpAmt').textContent = t ? inr(t) : '—';
      body.querySelectorAll('[data-c]').forEach((inp) => inp.addEventListener('change', () => { f.clp[inp.dataset.c][inp.dataset.f] = inp.dataset.f === 'pct' ? Number(inp.value) || 0 : inp.value; drawClp(); progress(); }));
      body.querySelectorAll('[data-del]').forEach((bn) => (bn.onclick = () => { f.clp.splice(Number(bn.dataset.del), 1); drawClp(); }));
    }
    if ($('clpAdd')) $('clpAdd').onclick = () => { f.clp.splice(f.clp.length - 1, 0, { milestone: 'New milestone', pct: 0, due: '' }); drawClp(); };
    drawClp();

    // --- units
    const label = (u) => u.tower + (u.wing && u.wing !== u.tower ? ' · ' + u.wing : '');
    try { units = (await api(`/api/projects/${e.project_id}/units`)).units; } catch { units = []; }
    const usable = units.filter((u) => u.status === 'Available' || u.held_by === e.id);
    const cur = units.find((u) => u.id === flatId);
    const groups = [...new Set(usable.map(label))];
    $('uT').innerHTML = '<option value="">— choose —</option>' + groups.map((g) => `<option ${cur && label(cur) === g ? 'selected' : ''}>${esc(g)}</option>`).join('');
    const fillUnits = () => {
      const pref = String(e.config || '');
      const list = usable.filter((u) => label(u) === $('uT').value).sort((x, y) => (y.flat_type === pref) - (x.flat_type === pref));
      $('uU').innerHTML = '<option value="">— choose —</option>' + list.map((u) => `<option value="${u.id}" ${u.id === flatId ? 'selected' : ''}>${esc(u.flat_no)} · ${esc(u.flat_type || '')}${u.floor !== null ? ' · Floor ' + u.floor : ''}${u.held_by === e.id ? ' (held for you)' : ''}</option>`).join('');
      unitCard();
    };
    const unitCard = () => {
      const u = units.find((x) => x.id === $('uU').value);
      flatId = u ? u.id : '';
      $('uCard').innerHTML = u ? `<div><span>Building / Tower</span><b>${esc(u.tower)}</b></div><div><span>Wing</span><b>${esc(u.wing || '—')}</b></div><div><span>Flat</span><b>${esc(u.flat_no)}</b></div>
        <div><span>Floor</span><b>${u.floor ?? '—'}</b></div><div><span>Configuration</span><b>${esc(u.flat_type || '—')}</b></div><div><span>Carpet (CRM)</span><b>${u.carpet_area ? esc(u.carpet_area) + ' sq ft' : '—'}</b></div>`
        : `<div><span>Availability</span><b>${usable.length} of ${units.length} units available</b></div>`;
      if (u && u.carpet_area && !f.carpetSqft) { f.carpetSqft = String(u.carpet_area); const i1 = el.querySelector('[data-p="carpetSqft"]'); if (i1) i1.value = f.carpetSqft; const i2 = el.querySelector('[data-p="carpetSqm"]'); if (i2 && !f.carpetSqm) { f.carpetSqm = (Number(u.carpet_area) / 10.7639).toFixed(2); i2.value = f.carpetSqm; } }
      progress();
    };
    $('uT').onchange = fillUnits; $('uU').onchange = unitCard;
    fillUnits();

    // --- completion per section
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
        const a = el.querySelector(`#appNav a[data-s="${s.id}"]`); a.classList.toggle('done', ok); if (ok) done++;
      });
      const pct = Math.round((done / F.sections.length) * 100);
      $('progT').textContent = pct + '%'; $('progB').style.width = pct + '%';
    }
    progress();

    // --- active section highlight
    const body = $('appBody');
    body.addEventListener('scroll', () => {
      let curId = F.sections[0].id;
      for (const s of F.sections) { const sec = $('sec-' + s.id); if (sec.offsetTop - body.scrollTop < 120) curId = s.id; }
      document.querySelectorAll('#appNav a').forEach((a) => a.classList.toggle('on', a.dataset.s === curId));
    });

    const save = async (submit) => {
      if (!flatId) { $('sec-flat').scrollIntoView({ behavior: 'smooth' }); throw new Error('Choose the flat first'); }
      f.declarationAccepted = !!f.declarationAccepted;
      try {
        await api(`/api/enquiries/${e.id}/booking`, { method: 'PUT', json: { flatId, form: f, submit } });
      } catch (err) {
        if (err.errors) markErrors(err.errors);
        throw err;
      }
      toast(submit ? 'Application submitted — next: KYC' : 'Draft saved — flat on hold');
      if (submit) { closeApp(); onDone && onDone(); } else { $('appNote').textContent = 'Draft saved ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }); }
    };
    function markErrors(errs) {
      el.querySelectorAll('.bad').forEach((x) => x.classList.remove('bad'));
      document.querySelectorAll('#appNav a.err').forEach((a) => a.classList.remove('err'));
      let firstBad = null;
      for (const msg of errs) {
        for (const s of F.sections) {
          const fields = s.kind === 'pair' ? s.fields : s.groups ? s.groups.flatMap((g) => g.fields) : s.fields || [];
          for (const fd of fields) {
            if (!msg.includes(fd.label)) continue;
            const who = /^Second applicant/.test(msg) ? 'a2' : 'a1';
            const inp = el.querySelector(`[data-p="${s.kind === 'pair' ? who + '.' + fd.k : fd.k}"]`);
            if (inp) { inp.classList.add('bad'); firstBad = firstBad || inp; }
            el.querySelector(`#appNav a[data-s="${s.id}"]`).classList.add('err');
          }
        }
        if (/CLP/.test(msg)) el.querySelector('#appNav a[data-s="clp"]').classList.add('err');
        if (/declaration/.test(msg)) el.querySelector('#appNav a[data-s="declaration"]').classList.add('err');
      }
      if (firstBad) firstBad.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if ($('appSave')) $('appSave').onclick = run(() => save(false));
    if ($('appSubmit')) $('appSubmit').onclick = run(() => save(true));
  }

  /* Downscale photos of documents so uploads stay small (max ~1600 px JPEG). PDFs pass through. */
  async function shrink(file) {
    if (!/^image\//.test(file.type) || file.size < 900 * 1024) return file;
    try {
      const img = await createImageBitmap(file);
      const k = Math.min(1, 1600 / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return await new Promise((res) => c.toBlob((bl) => res(bl || file), 'image/jpeg', 0.82));
    } catch { return file; }
  }

  function sigPad(c) {
    const r = c.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
    c.width = r.width * dpr; c.height = r.height * dpr;
    const g = c.getContext('2d'); g.scale(dpr, dpr); g.lineWidth = 2.4; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#171A33';
    let down = false, has = false;
    const pt = (ev) => { const b = c.getBoundingClientRect(); return [ev.clientX - b.left, ev.clientY - b.top]; };
    c.onpointerdown = (ev) => { down = true; c.setPointerCapture(ev.pointerId); const [x, y] = pt(ev); g.beginPath(); g.moveTo(x, y); };
    c.onpointermove = (ev) => { if (!down) return; const [x, y] = pt(ev); g.lineTo(x, y); g.stroke(); has = true; };
    c.onpointerup = c.onpointercancel = () => (down = false);
    return { has: () => has, clear: () => { g.clearRect(0, 0, c.width, c.height); has = false; }, png: () => c.toDataURL('image/png') };
  }

  /* ---------------- Boot ---------------- */
  async function boot() {
    try {
      const j = await api('/api/me');
      Object.assign(state, { user: j.user, org: j.org, stages: j.stages, statuses: j.statuses });
      shell(); route();
    } catch { renderLogin(); }
  }
  boot();
})();
