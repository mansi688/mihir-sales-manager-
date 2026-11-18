/* Mihir Group staff app — one page, views chosen by role. */
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m, err) => { const t = $('toast'); t.textContent = m; t.className = 'toast show' + (err ? ' err' : ''); clearTimeout(t._t); t._t = setTimeout(() => (t.className = 'toast'), 2800); };
  const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
  const time = (s) => { if (!s) return ''; const d = new Date(s); return d.toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }); };
  const first = (n) => String(n || '').split(' ')[0];
  const ph = (p) => { const d = String(p || '').replace(/\D/g, ''); return d.length === 12 && d.startsWith('91') ? `+91 ${d.slice(2, 7)} ${d.slice(7)}` : '+' + d; };

  async function api(path, opts = {}) {
    const o = { method: 'GET', headers: {}, ...opts };
    if (o.json !== undefined) { o.body = JSON.stringify(o.json); o.headers['Content-Type'] = 'application/json'; o.method = o.method === 'GET' ? 'POST' : o.method; }
    const r = await fetch(path, o);
    const j = await r.json().catch(() => ({}));
    if (r.status === 401 && path !== '/api/auth/login') { state.user = null; renderLogin(); throw new Error(j.error || 'Please log in'); }
    if (!r.ok) throw new Error(j.error || 'Request failed');
    return j;
  }
  const run = (fn) => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message, true); } };

  const state = { user: null, org: null, stages: [], statuses: [] };
  const NAV = {
    sales: [['home', 'My profile'], ['customers', 'My customers']],
    reception: [['board', 'Reception board'], ['customers', 'All enquiries']],
    manager: [['board', 'Board'], ['approvals', 'Approvals'], ['customers', 'All enquiries'], ['home', 'My profile'], ['team', 'Team'], ['outbox', 'Outbox & sync']],
    accounts: [['payments', 'Payments'], ['customers', 'All enquiries']],
    admin: [['board', 'Board'], ['approvals', 'Approvals'], ['customers', 'All enquiries'], ['payments', 'Payments'], ['team', 'Team'], ['outbox', 'Outbox & sync']],
  };
  const nav = () => NAV[state.user.role] || NAV.sales;

  /* ---------------- Login ---------------- */
  function renderLogin() {
    closeDrawer();
    $('root').innerHTML = `<div class="login"><form class="box" id="lf">
      <img src="/assets/logo.png" alt="Mihir Group"><h2>Sales portal</h2><p class="muted small" style="margin-top:-6px">Staff login</p>
      <div class="field" style="text-align:left"><label>Mobile number</label><input type="tel" name="phone" required placeholder="10-digit mobile" autocomplete="username"></div>
      <div class="field" style="text-align:left"><label>PIN</label><input type="password" name="pin" required inputmode="numeric" maxlength="6" autocomplete="current-password"></div>
      <button class="btn copper" style="width:100%">Log in</button></form></div>`;
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
    $('root').innerHTML = `<header class="top"><img class="logo" src="/assets/logo-light.png" alt="Mihir Group">
      <nav id="nav">${nav().map(([k, l]) => `<a href="#${k}" data-v="${k}">${l}</a>`).join('')}</nav>
      <div class="who"><img class="av" style="width:30px;height:30px" src="${esc(u.photoUrl || '/assets/mark.png')}" alt=""><span class="n">${esc(u.name)}</span><button class="btn ghost sm" style="color:#fff;border-color:#5A6088" id="out">Log out</button></div></header>
      <main id="view"></main>`;
    $('out').onclick = run(async () => { await api('/api/auth/logout', { method: 'POST' }); state.user = null; renderLogin(); });
  }

  function route() {
    if (!state.user) return;
    const allowed = nav().map((n) => n[0]);
    const v = allowed.includes(location.hash.slice(1)) ? location.hash.slice(1) : allowed[0];
    document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.v === v));
    const fn = { home: viewHome, customers: viewCustomers, board: viewBoard, approvals: viewApprovals, payments: viewPayments, team: viewTeam, outbox: viewOutbox }[v];
    $('view').innerHTML = '<p class="muted">Loading…</p>';
    run(fn)();
  }
  window.addEventListener('hashchange', route);

  const stageChip = (s) => {
    const cls = s === 'Booked' ? 'ok' : s === 'Lost' ? 'bad' : s === 'Walk-in' ? 'warn' : ['Booking form', 'KYC', 'Payment', 'Signatures'].includes(s) ? 'cu' : '';
    return `<span class="chip ${cls}">${esc(s)}</span>`;
  };

  /* ---------------- My profile (sales) ---------------- */
  const contactText = (u) => `*${u.name}*\n${u.designation}, ${state.org.name}\n📞 ${ph(u.phone)}\n✉️ ${u.email}\n🌐 ${state.org.website}\n🪪 ${u.cardUrl}`;
  const ecard = (u) => `<div class="ecard"><div class="ecard-top"><img class="ecard-logo" src="/assets/logo-light.png" alt="${esc(state.org.name)}"><img class="ecard-photo" src="${esc(u.photoUrl || '/assets/mark.png')}" alt=""></div>
    <div><div class="ecard-name">${esc(u.name)}</div><div class="ecard-desig">${esc(u.designation)}</div></div>
    <div class="ecard-ct">📞 ${esc(ph(u.phone))}<br>✉️ ${esc(u.email)}<br>🌐 ${esc(state.org.website)}</div><div class="ecard-tag">${esc(state.org.tagline)}</div><div class="ecard-bar"></div></div>`;

  async function viewHome() {
    const u = state.user;
    const { enquiries } = await api('/api/enquiries?mine=1');
    const inBooking = enquiries.filter((e) => ['Booking form', 'KYC', 'Payment', 'Signatures'].includes(e.stage)).length;
    $('view').innerHTML = `<div class="grid g2">
      <div class="card">
        <div class="prof"><label style="margin:0;cursor:pointer;position:relative" title="Change photo"><img class="big" src="${esc(u.photoUrl || '/assets/mark.png')}" alt="Profile photo">
          <span style="position:absolute;bottom:2px;right:2px;background:var(--grad);color:#fff;border-radius:50%;width:26px;height:26px;display:grid;place-items:center;font-size:13px">✎</span>
          <input type="file" id="ph" accept="image/png,image/jpeg,image/webp" hidden></label>
          <div style="flex:1;min-width:200px"><h1 style="margin:0">${esc(u.name)}</h1><div class="muted" style="font-weight:600">${esc(u.designation)} · ${esc(state.org.name)}</div>
          <div class="small">${esc(ph(u.phone))} · ${esc(u.email)}</div><div class="small muted">${u.projects.map((p) => esc(p.name)).join(' · ')}</div></div></div>
        <div style="margin-top:16px"><label>My status <span class="muted" style="font-weight:400">(new walk-ins only go to people marked Available)</span></label>
          <div class="pill-tog" id="st">${state.statuses.map((s) => `<button class="${u.status === s ? 'on' : ''}" data-s="${s}">${s}</button>`).join('')}</div></div>
        <div class="row" style="margin-top:16px">
          <a class="btn wa sm" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(contactText(u))}">Share my details on WhatsApp</a>
          <button class="btn ghost sm" id="cp">Copy details</button></div>
        <div class="grid" style="grid-template-columns:repeat(3,1fr);gap:10px;margin-top:16px">
          ${[['Customers', enquiries.length], ['In booking', inBooking], ['Booked', enquiries.filter((e) => e.stage === 'Booked').length]]
            .map(([l, v]) => `<div style="text-align:center;background:var(--copper-xl);border-radius:10px;padding:10px"><div class="stat" style="font-size:24px">${v}</div><div class="small muted">${l}</div></div>`).join('')}</div>
      </div>
      <div class="card"><h3>My e-visiting card</h3><p class="small muted" style="margin-top:-4px">One ${esc(state.org.name)} format for everyone — only your photo, name, designation and contact change.</p>
        ${ecard(u)}
        <div class="row" style="margin-top:14px">
          <a class="btn wa sm" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent('My ' + state.org.name + ' visiting card: ' + u.cardUrl)}">Send card on WhatsApp</a>
          <a class="btn ghost sm" href="${esc(u.cardUrl)}" target="_blank" rel="noopener">Open card page</a></div>
        <p class="small muted" style="margin-top:8px">The card page has a "Save contact" button that adds you straight to the customer's phone.</p></div></div>
      <div class="card" style="margin-top:16px"><h3>Change PIN</h3><form id="pf" class="row" style="align-items:flex-end">
        <div class="field"><label>Current PIN</label><input type="password" name="current" inputmode="numeric" maxlength="6" required></div>
        <div class="field"><label>New PIN (4–6 digits)</label><input type="password" name="next" inputmode="numeric" maxlength="6" required></div>
        <div class="field" style="flex:0"><button class="btn sm">Update</button></div></form></div>`;
    $('ph').onchange = run(async (ev) => {
      const f = ev.target.files[0]; if (!f) return;
      const fd = new FormData(); fd.append('photo', await shrink(f), f.name);
      const j = await api('/api/me/photo', { method: 'POST', body: fd });
      state.user = j.user; shell(); route(); toast('Photo updated');
    });
    document.querySelectorAll('#st button').forEach((b) => (b.onclick = run(async () => {
      const j = await api('/api/me', { method: 'PATCH', json: { status: b.dataset.s } }); state.user = j.user; viewHome(); toast('Status: ' + b.dataset.s);
    })));
    $('cp').onclick = async () => { try { await navigator.clipboard.writeText(contactText(u).replace(/\*/g, '')); toast('Copied'); } catch { toast('Copy not allowed here', true); } };
    $('pf').onsubmit = run(async (ev) => { ev.preventDefault(); const fd = new FormData(ev.target); await api('/api/me/pin', { json: Object.fromEntries(fd) }); ev.target.reset(); toast('PIN changed'); });
  }

  /* ---------------- Customer list ---------------- */
  async function viewCustomers() {
    const mine = state.user.role === 'sales';
    $('view').innerHTML = `<div class="row between" style="margin-bottom:12px"><h1 style="margin:0">${mine ? 'My customers' : 'All enquiries'}</h1>
      <div class="row"><input type="text" id="q" placeholder="Search name, mobile or ID" style="width:240px"><select id="sg" style="width:auto"><option value="">All stages</option>${state.stages.map((s) => `<option>${s}</option>`).join('')}</select></div></div>
      <div class="card" style="overflow-x:auto"><table id="t"></table></div>`;
    const load = run(async () => {
      const qs = new URLSearchParams({ q: $('q').value, stage: $('sg').value });
      const { enquiries } = await api('/api/enquiries?' + qs);
      $('t').innerHTML = `<tr><th>Customer</th><th>Interest</th><th>Source</th>${mine ? '' : '<th>Sales</th>'}<th>Stage</th><th>Walk-in</th><th></th></tr>` +
        (enquiries.length ? enquiries.map((e) => `<tr><td><b>${esc(e.name)}</b><br><span class="small muted">${e.id} · ${esc(e.mobile)}</span></td>
          <td class="small">${esc(e.project_name)}<br>${esc(e.config)} · ${esc(e.budget)}</td><td class="small">${esc(e.source)}${e.cp_name ? '<br>' + esc(e.cp_name) : ''}</td>
          ${mine ? '' : `<td class="small">${esc(e.assigned_name || '—')}</td>`}<td>${stageChip(e.stage)}</td><td class="small">${time(e.created_at)}</td>
          <td style="white-space:nowrap"><a class="btn wa sm" target="_blank" rel="noopener" href="https://wa.me/91${esc(e.mobile)}?text=${encodeURIComponent('Hi ' + first(e.name) + ', this is ' + state.user.name + ' from ' + state.org.name + '.')}">WA</a>
          <button class="btn sm" data-open="${e.id}">Open</button></td></tr>`).join('') : `<tr><td colspan="7" class="muted">No enquiries yet.</td></tr>`);
      document.querySelectorAll('[data-open]').forEach((b) => (b.onclick = () => openEnquiry(b.dataset.open)));
    });
    let t; $('q').oninput = () => { clearTimeout(t); t = setTimeout(load, 250); }; $('sg').onchange = load; load();
  }

  /* ---------------- Reception board ---------------- */
  let boardTimer;
  async function viewBoard() {
    clearInterval(boardTimer);
    const draw = async () => {
      if (!document.getElementById('bd') && location.hash && !['#board', ''].includes(location.hash)) return clearInterval(boardTimer);
      const b = await api('/api/board');
      const s = b.stats;
      $('view').innerHTML = `<div id="bd"><div class="row between" style="margin-bottom:12px"><div><h1 style="margin:0">Reception board</h1><span class="muted small">Today's walk-ins · refreshes every 20 s</span></div>
        <a class="btn copper sm" href="/kiosk/" target="_blank" rel="noopener">Open kiosk</a></div>
        <div class="grid g4" style="margin-bottom:14px">${[['Walk-ins today', s.walkins], ['Waiting to be attended', s.waiting], ['Booked today', s.booked], ['Sales free', `${s.free} / ${s.team}`]]
          .map(([l, v]) => `<div class="card"><div class="small muted" style="font-weight:700">${l}</div><div class="stat">${v}</div></div>`).join('')}</div>
        ${s.unassigned ? `<div class="card" style="border-color:#E9B24B;background:var(--warnbg);margin-bottom:14px"><b>${s.unassigned} walk-in(s) need a sales person</b> — no one was on duty. Assign below.</div>` : ''}
        <div class="grid" style="grid-template-columns:minmax(0,2.2fr) minmax(260px,1fr)">
          <div class="card" style="overflow-x:auto"><h3>Walk-ins today</h3><table>
            <tr><th>Time</th><th>Customer</th><th>Interest</th><th>Assigned to</th><th>Stage</th><th></th></tr>
            ${b.enquiries.map((e) => `<tr><td class="small">${time(e.created_at)}</td><td><b>${esc(e.name)}</b><br><span class="small muted">${e.id} · ${esc(e.mobile)}</span></td>
              <td class="small">${esc(e.project_name)}<br>${esc(e.config)} · ${esc(e.source)}</td>
              <td><select data-re="${e.id}" style="min-width:150px"><option value="">— choose —</option>${b.team.map((x) => `<option value="${x.id}" ${x.id === e.assigned_to ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></td>
              <td>${stageChip(e.stage)}${e.wa_linked_at ? ' <span class="chip ok" title="Customer messaged on WhatsApp">WA ✓</span>' : ''}</td>
              <td><button class="btn ghost sm" data-open="${e.id}">View</button></td></tr>`).join('') || '<tr><td colspan="6" class="muted">No walk-ins yet today.</td></tr>'}
          </table></div>
          <div class="card"><h3>Sales team</h3>${b.team.map((x) => `<div class="ex-row"><img class="av" src="${esc(x.photoUrl || '/assets/mark.png')}" alt="">
            <div style="flex:1"><b>${esc(x.name)}</b><div class="tiny muted">${x.projects.map((p) => esc(p.name)).join(', ')} · ${x.today} today</div></div>
            <select data-st="${x.id}" style="width:auto;font-size:12px;padding:5px 6px">${state.statuses.map((st) => `<option ${st === x.status ? 'selected' : ''}>${st}</option>`).join('')}</select></div>`).join('')}</div>
        </div></div>`;
      document.querySelectorAll('[data-open]').forEach((bn) => (bn.onclick = () => openEnquiry(bn.dataset.open)));
      document.querySelectorAll('[data-st]').forEach((sel) => (sel.onchange = run(async () => { await api(`/api/team/${sel.dataset.st}/status`, { method: 'PATCH', json: { status: sel.value } }); toast('Status updated'); })));
      document.querySelectorAll('[data-re]').forEach((sel) => (sel.onchange = () => { if (sel.value) reassignDialog(sel.dataset.re, sel.value, sel.selectedOptions[0].text, draw); }));
    };
    await draw();
    boardTimer = setInterval(() => { if (!$('drawer').classList.contains('on') && location.hash.replace('#', '') in { board: 1, '': 1 }) run(draw)(); }, 20000);
  }

  function reassignDialog(id, userId, name, after) {
    $('drawer').innerHTML = `<div class="dh"><b>Assign ${esc(id)} to ${esc(name)}</b><button class="btn sm copper" id="x">Cancel</button></div>
      <div class="db"><div class="sec"><div class="field"><label>Reason (saved in the audit log)</label>
      <select id="rr"><option>Assigned person busy / in a meeting</option><option>Customer asked for someone else</option><option>Language preference</option><option>Project specialist needed</option><option>No one was on duty</option><option>Other</option></select></div>
      <button class="btn" id="ok">Assign & notify on WhatsApp</button></div></div>`;
    openDrawer();
    $('x').onclick = () => { closeDrawer(); after && run(after)(); };
    $('ok').onclick = run(async () => { await api(`/api/enquiries/${id}/reassign`, { json: { userId, reason: $('rr').value } }); closeDrawer(); toast('Assigned — WhatsApp sent'); after && run(after)(); });
  }

  /* ---------------- Approvals (manager) ---------------- */
  async function viewApprovals() {
    const { enquiries } = await api('/api/enquiries?stage=Signatures');
    $('view').innerHTML = `<h1>Waiting for approval</h1><p class="muted" style="margin-top:-6px">Payment verified, customer and sales person have signed. Approving confirms the booking, marks the unit Sold and sends the PDF to the customer.</p>
      <div class="card" style="overflow-x:auto"><table><tr><th>Customer</th><th>Project</th><th>Sales</th><th>Updated</th><th></th></tr>
      ${enquiries.map((e) => `<tr><td><b>${esc(e.name)}</b><br><span class="small muted">${e.id}</span></td><td class="small">${esc(e.project_name)} · ${esc(e.config)}</td><td class="small">${esc(e.assigned_name)}</td><td class="small">${time(e.updated_at)}</td>
        <td><button class="btn sm" data-open="${e.id}">Review</button></td></tr>`).join('') || '<tr><td colspan="5" class="muted">Nothing waiting.</td></tr>'}</table></div>`;
    document.querySelectorAll('[data-open]').forEach((b) => (b.onclick = () => openEnquiry(b.dataset.open)));
  }

  /* ---------------- Payments (accounts) ---------------- */
  async function viewPayments() {
    $('view').innerHTML = `<div class="row between" style="margin-bottom:12px"><h1 style="margin:0">Payments</h1>
      <div class="pill-tog" id="pt">${['Pending verification', 'Received', 'Rejected'].map((s, i) => `<button data-s="${s}" class="${i ? '' : 'on'}">${s}</button>`).join('')}</div></div>
      <div class="card" style="overflow-x:auto"><table id="pa"></table></div>`;
    let cur = 'Pending verification';
    const load = run(async () => {
      const { payments } = await api('/api/payments?status=' + encodeURIComponent(cur));
      $('pa').innerHTML = `<tr><th>Customer</th><th>Unit</th><th>Amount</th><th>Mode / Ref</th><th>Submitted</th><th></th></tr>` +
        (payments.map((p) => `<tr><td><b>${esc(p.customer)}</b><br><span class="small muted">${p.enquiry_id} · ${esc(p.mobile)}</span></td><td class="small">${esc(p.project_name)}<br>${esc(p.unit || '—')}</td>
          <td><b>${inr(p.amount)}</b></td><td class="small">${esc(p.mode)}<br>${esc(p.ref)}</td><td class="small">${esc(p.submitted_name || '')}<br>${time(p.submitted_at)}</td>
          <td style="white-space:nowrap">${p.status === 'Pending verification'
            ? `<input type="text" placeholder="Receipt no." data-rn="${p.id}" style="width:120px;padding:6px 8px"> <button class="btn sm" data-ok="${p.id}">Verify</button> <button class="btn danger sm" data-no="${p.id}">Reject</button>`
            : `${p.receipt_no ? esc(p.receipt_no) : ''} ${esc(p.remarks || '')}`}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Nothing here.</td></tr>');
      document.querySelectorAll('[data-ok]').forEach((b) => (b.onclick = run(async () => {
        await api(`/api/payments/${b.dataset.ok}/verify`, { json: { receiptNo: document.querySelector(`[data-rn="${b.dataset.ok}"]`).value } }); toast('Payment verified — sales notified'); load();
      })));
      document.querySelectorAll('[data-no]').forEach((b) => (b.onclick = () => {
        $('drawer').innerHTML = `<div class="dh"><b>Reject payment</b><button class="btn sm copper" id="x">Cancel</button></div><div class="db"><div class="sec">
          <div class="field"><label>Reason</label><input type="text" id="rm" placeholder="e.g. UTR not found in bank statement"></div><button class="btn danger" id="ok">Reject payment</button></div></div>`;
        openDrawer(); $('x').onclick = closeDrawer;
        $('ok').onclick = run(async () => { await api(`/api/payments/${b.dataset.no}/reject`, { json: { remarks: $('rm').value } }); closeDrawer(); toast('Rejected'); load(); });
      }));
    });
    document.querySelectorAll('#pt button').forEach((b) => (b.onclick = () => { cur = b.dataset.s; document.querySelectorAll('#pt button').forEach((x) => x.classList.toggle('on', x === b)); load(); }));
    load();
  }

  /* ---------------- Team (manager/admin) ---------------- */
  async function viewTeam() {
    const t = await api('/api/team');
    const projBoxes = (sel = []) => t.projects.map((p) => `<label style="font-weight:500;display:inline-flex;gap:6px;margin-right:12px"><input type="checkbox" name="projectIds" value="${p.id}" ${sel.includes(p.id) ? 'checked' : ''}> ${esc(p.name)}</label>`).join('');
    $('view').innerHTML = `<h1>Team</h1><div class="grid g2">
      <div class="card" style="overflow-x:auto"><h3>Staff</h3><table><tr><th>Name</th><th>Role</th><th>Projects</th><th></th></tr>
        ${t.users.map((u) => `<tr style="${u.active ? '' : 'opacity:.5'}"><td><div class="row" style="gap:8px;flex-wrap:nowrap"><img class="av" src="${esc(u.photoUrl || '/assets/mark.png')}" alt=""><div><b>${esc(u.name)}</b><div class="tiny muted">${esc(u.designation)} · ${esc(ph(u.phone))}</div></div></div></td>
          <td class="small">${esc(u.role)}</td><td class="tiny">${u.projects.map((p) => esc(p.name)).join(', ') || '—'}</td><td><button class="btn ghost sm" data-ed="${u.id}">Edit</button></td></tr>`).join('')}</table></div>
      <div><div class="card"><h3>Add staff</h3><form id="nf">
        <div class="row"><div class="field"><label>Name *</label><input type="text" name="name" required></div><div class="field"><label>Designation</label><input type="text" name="designation"></div></div>
        <div class="row"><div class="field"><label>Mobile *</label><input type="tel" name="phone" required></div><div class="field"><label>Email</label><input type="email" name="email"></div></div>
        <div class="row"><div class="field"><label>Role *</label><select name="role"><option value="sales">Sales</option><option value="reception">Reception</option><option value="manager">Manager</option><option value="accounts">Accounts</option></select></div>
        <div class="field"><label>Starting PIN *</label><input type="text" name="pin" required inputmode="numeric" maxlength="6"></div></div>
        <div class="field"><label>Projects (sales)</label>${projBoxes()}</div><button class="btn">Add</button></form></div>
      <div class="card" style="margin-top:16px"><h3>Channel partners</h3><p class="small muted" style="margin-top:-4px">Leads from a channel partner go straight to its owner.</p>
        ${t.channelPartners.map((c) => `<div class="ex-row"><b style="flex:1">${esc(c.name)}</b><span class="small muted">${esc(c.owner_name || 'No owner — round-robin')}</span></div>`).join('')}
        <form id="cf" class="row" style="margin-top:10px;align-items:flex-end"><div class="field"><label>Name</label><input type="text" name="name" required></div>
        <div class="field"><label>Owner</label><select name="ownerUserId"><option value="">— none —</option>${t.users.filter((u) => u.role === 'sales' && u.active).map((u) => `<option value="${u.id}">${esc(u.name)}</option>`).join('')}</select></div>
        <div class="field" style="flex:0"><button class="btn sm">Save</button></div></form></div></div></div>`;
    $('nf').onsubmit = run(async (ev) => {
      ev.preventDefault(); const fd = new FormData(ev.target);
      await api('/api/team', { json: { ...Object.fromEntries(fd), projectIds: fd.getAll('projectIds') } }); toast('Staff added'); viewTeam();
    });
    $('cf').onsubmit = run(async (ev) => { ev.preventDefault(); const fd = new FormData(ev.target); await api('/api/channel-partners', { json: Object.fromEntries(fd) }); toast('Saved'); viewTeam(); });
    document.querySelectorAll('[data-ed]').forEach((b) => (b.onclick = () => {
      const u = t.users.find((x) => String(x.id) === b.dataset.ed);
      $('drawer').innerHTML = `<div class="dh"><b>Edit ${esc(u.name)}</b><button class="btn sm copper" id="x">Close</button></div><div class="db"><form class="sec" id="ef">
        <div class="row"><div class="field"><label>Name</label><input type="text" name="name" value="${esc(u.name)}"></div><div class="field"><label>Designation</label><input type="text" name="designation" value="${esc(u.designation)}"></div></div>
        <div class="field"><label>Email</label><input type="email" name="email" value="${esc(u.email)}"></div>
        <div class="field"><label>Projects</label>${projBoxes(u.projects.map((p) => p.id))}</div>
        <div class="row"><div class="field"><label>Reset PIN (leave blank to keep)</label><input type="text" name="pin" inputmode="numeric" maxlength="6"></div>
        <div class="field"><label>Active</label><select name="active"><option value="1" ${u.active ? 'selected' : ''}>Active</option><option value="0" ${u.active ? '' : 'selected'}>Deactivated</option></select></div></div>
        <button class="btn">Save</button></form></div>`;
      openDrawer(); $('x').onclick = closeDrawer;
      $('ef').onsubmit = run(async (ev) => {
        ev.preventDefault(); const fd = new FormData(ev.target); const body = Object.fromEntries(fd);
        body.projectIds = fd.getAll('projectIds'); body.active = body.active === '1'; if (!body.pin) delete body.pin;
        await api(`/api/team/${u.id}`, { method: 'PATCH', json: body }); closeDrawer(); toast('Saved'); viewTeam();
      });
    }));
  }

  /* ---------------- Outbox (manager/admin) ---------------- */
  async function viewOutbox() {
    const o = await api('/api/outbox');
    $('view').innerHTML = `<h1>WhatsApp outbox & system sync</h1><p class="muted" style="margin-top:-6px">In mock mode nothing leaves the server — this is exactly what would be sent.</p><div class="grid g2">
      <div class="card"><h3>WhatsApp (last 100)</h3><div style="max-height:70vh;overflow:auto">${o.whatsapp.map((m) => `<div class="ex-row" style="align-items:flex-start"><div style="flex:1">
        <div class="tiny muted">${time(m.at)} · ${m.direction === 'in' ? 'from' : 'to'} +${esc(m.to_from)} · ${esc(m.kind)} · <span class="chip ${m.status === 'failed' ? 'bad' : m.status === 'mock' ? 'warn' : 'ok'}">${esc(m.status)}</span> ${esc(m.enquiry_id || '')}</div>
        <div class="small" style="white-space:pre-line">${esc(m.body)}</div></div></div>`).join('') || '<p class="muted">Nothing yet.</p>'}</div></div>
      <div class="card"><h3>CRM & internal portal (last 100)</h3><div class="log" style="max-height:70vh">${o.sync.map((s) => `${time(s.at)}  [${s.target}] ${s.action} ${s.enquiry_id || ''} → ${s.status}\n   ${s.payload}`).map(esc).join('\n') || 'Nothing yet.'}</div></div></div>`;
  }

  /* ---------------- Enquiry drawer: walk-in → booked ---------------- */
  function openDrawer() { $('drawer').classList.add('on'); $('dBg').classList.add('on'); }
  function closeDrawer() { $('drawer').classList.remove('on'); $('dBg').classList.remove('on'); }
  $('dBg').onclick = () => { closeDrawer(); route(); };

  const KYC = [['pan', 'PAN card', true], ['aadhaar', 'Aadhaar', true], ['photo', 'Passport photo', true], ['co_pan', 'Co-applicant PAN', false], ['co_aadhaar', 'Co-applicant Aadhaar', false], ['other', 'Other', false]];

  async function openEnquiry(id) {
    const { enquiry: e } = await api('/api/enquiries/' + id).catch((err) => { toast(err.message, true); return {}; });
    if (!e) return;
    const role = state.user.role; const canSell = ['sales', 'manager', 'admin'].includes(role);
    const canDesk = ['reception', 'manager', 'admin'].includes(role); const canApprove = ['manager', 'admin'].includes(role);
    const st = state.stages.filter((s) => s !== 'Lost'); const ci = e.stage === 'Lost' ? -1 : st.indexOf(e.stage);
    const b = e.booking || {}; const paid = e.payments.find((p) => p.status === 'Received'); const pending = e.payments.find((p) => p.status === 'Pending verification');
    const lock = (minStage) => (ci < st.indexOf(minStage) || !canSell ? 'lock' : '');
    const haveKyc = new Set(e.kyc.map((k) => k.kind));
    const sig = e.signatures;

    $('drawer').innerHTML = `<div class="dh"><div><b>${esc(e.name)}</b> <span class="small" style="color:var(--copper-l)">${e.id}</span><div class="tiny" style="color:#BFC4DA">${esc(e.assigned_name || 'Unassigned')} · ${esc(e.assign_reason)}</div></div>
      <div class="row" style="gap:6px"><a class="btn wa sm" target="_blank" rel="noopener" href="https://wa.me/91${esc(e.mobile)}">WhatsApp</a><button class="btn sm copper" id="x">Close</button></div></div>
    <div class="db">
      ${e.stage === 'Lost' ? '<div class="sec" style="background:var(--badbg)"><b>Marked lost.</b></div>' : `<div class="stepper">${st.map((s, i) => `<div class="${i < ci ? 'done' : i === ci ? 'cur' : ''}">${s}</div>`).join('')}</div>`}

      <div class="sec"><h3>Enquiry ${e.stage === 'Walk-in' && canSell ? '<button class="btn sm copper" id="bAttend">Start attending</button>' : ''}</h3>
        <div class="kv"><span>Mobile</span><span>+91 ${esc(e.mobile)} ${e.wa_linked_at ? '<span class="chip ok">on WhatsApp</span>' : ''}</span><span>Email</span><span>${esc(e.email || '—')}</span>
        <span>Residence</span><span>${esc(e.residence || '—')}</span><span>Project</span><span>${esc(e.project_name)} · ${esc(e.config)}</span>
        <span>Budget</span><span>${esc(e.budget)}</span><span>Purpose</span><span>${esc(e.purpose || '—')}</span>
        <span>Source</span><span>${esc(e.source)}${e.cp_name ? ' — ' + esc(e.cp_name) : ''}</span><span>Visit</span><span>${esc(e.visit_pref || '—')}</span><span>Walked in</span><span>${time(e.created_at)}</span></div>
        ${canDesk ? `<div class="row" style="margin-top:12px"><label style="margin:0">Reassign to</label><select id="reSel" style="width:auto"><option value="">— choose —</option></select></div>` : ''}</div>

      <div class="sec ${lock('Attending')}"><h3>Site visit ${ci >= st.indexOf('Site visit') ? '<span class="chip ok">Done</span>' : ''}</h3>
        <div class="row"><div class="field"><label>Units shown</label><input type="text" id="svU" placeholder="e.g. A-1204, A-0905"></div>
        <div class="field"><label>Feedback</label><select id="svF"><option>Hot — ready to book</option><option>Warm — family visit needed</option><option>Cold — just exploring</option></select></div></div>
        <div class="field"><label>Note</label><input type="text" id="svN" placeholder="optional"></div>
        <button class="btn sm" id="bVisit">Save visit</button></div>

      <div class="sec ${lock('Attending')}"><h3>Booking form ${e.booking ? `<span class="chip ok">${esc(b.tower)} ${esc(b.unit)}${b.hold_until ? ' · on hold till ' + time(b.hold_until) : ''}</span>` : ''}</h3>
        <p class="tiny muted" style="margin-top:-6px">Units come live from the Mihir CRM inventory. Saving puts the unit on hold so no one else can book it.</p>
        <div class="row"><div class="field"><label>Tower / wing *</label><select id="bkT"><option value="">Loading units…</option></select></div>
          <div class="field"><label>Unit *</label><select id="bkU"><option value="">—</option></select></div></div>
        <div class="small muted" id="bkInfo" style="margin:-6px 0 10px"></div>
        <div class="row"><div class="field"><label>Agreement value (₹)</label><input type="text" id="bkV" inputmode="numeric" value="${esc(b.agreement_value ?? '')}"></div></div>
        <div class="row"><div class="field"><label>Payment plan</label><select id="bkP">${['Construction-linked', 'Down payment', 'Flexi 20:80'].map((v) => `<option ${b.payment_plan === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
          <div class="field"><label>Co-applicant</label><input type="text" id="bkCo" value="${esc(b.co_applicant || '')}" placeholder="optional"></div></div>
        <button class="btn sm" id="bBook" ${ci >= st.indexOf('Booked') ? 'disabled' : ''}>${e.booking ? 'Update' : 'Save & hold unit'}</button></div>

      <div class="sec ${lock('KYC')}"><h3>KYC documents</h3>
        ${KYC.map(([k, l, req]) => `<div class="row between" style="padding:6px 0;border-bottom:1px solid var(--line)"><span>${l}${req ? ' *' : ''}</span><span class="row" style="gap:6px">
          ${e.kyc.filter((d) => d.kind === k).map((d) => `<a class="chip ok" href="/api/files/${d.file_id}" target="_blank" rel="noopener">View</a>`).join('')}
          <label class="btn ghost sm" style="margin:0">Upload<input type="file" data-k="${k}" hidden accept="image/*,application/pdf"></label></span></div>`).join('')}
        <div style="margin-top:10px"><button class="btn sm" id="bKyc" ${['pan', 'aadhaar', 'photo'].every((k) => haveKyc.has(k)) && ci < st.indexOf('Payment') ? '' : 'disabled'}>Mark KYC complete</button></div></div>

      <div class="sec ${lock('Payment')}"><h3>First payment (booking amount) ${paid ? `<span class="chip ok">Received · ${esc(paid.receipt_no)}</span>` : pending ? '<span class="chip warn">Pending verification by Accounts</span>' : ''}</h3>
        ${e.payments.map((p) => `<div class="small" style="padding:4px 0">${inr(p.amount)} · ${esc(p.mode)} · ${esc(p.ref || '—')} · <b>${esc(p.status)}</b>${p.remarks ? ' — ' + esc(p.remarks) : ''}</div>`).join('')}
        ${paid ? '' : `<div class="row"><div class="field"><label>Amount (₹) *</label><input type="text" id="pyA" inputmode="numeric"></div>
          <div class="field"><label>Mode *</label><select id="pyM"><option>UPI</option><option>NEFT/RTGS</option><option>Cheque</option><option>Payment link</option></select></div>
          <div class="field"><label>UTR / Cheque / UPI ref *</label><input type="text" id="pyR"></div></div>
          <button class="btn sm" id="bPay" ${pending ? 'disabled' : ''}>Send to Accounts</button>`}</div>

      <div class="sec ${paid && canSell ? '' : 'lock'}"><h3>Signatures ${sig.customer && sig.sales ? '<span class="chip ok">Customer & sales signed</span>' : ''}</h3>
        <div class="grid g2">
          <div><label>Customer — ${esc(e.name)}</label>${sig.customer ? `<img src="/api/files/${sig.customer.file_id}" alt="Customer signature" style="max-height:80px">` : '<canvas class="sig" id="sgC"></canvas><button class="btn ghost sm" style="margin-top:6px" data-clr="sgC">Clear</button>'}</div>
          <div><label>Sales — ${esc(e.assigned_name || '')}</label>${sig.sales ? `<img src="/api/files/${sig.sales.file_id}" alt="Sales signature" style="max-height:80px">` : '<canvas class="sig" id="sgE"></canvas><button class="btn ghost sm" style="margin-top:6px" data-clr="sgE">Clear</button>'}</div></div>
        ${sig.customer && sig.sales ? '' : '<button class="btn sm" id="bSign" style="margin-top:10px">Save signatures</button>'}</div>

      <div class="sec ${sig.customer && sig.sales && paid ? '' : 'lock'}"><h3>Manager approval ${sig.manager ? '<span class="chip ok">Booked</span>' : ''}</h3>
        ${sig.manager ? `<p class="small">Approved ${time(sig.manager.signed_at)}. Lead marked <b>Booked</b> in CRM, unit marked <b>Sold</b>, booking form sent to the customer on WhatsApp.</p>
          <div class="row"><a class="btn sm" href="/api/enquiries/${e.id}/booking.pdf" target="_blank" rel="noopener">Open booking form PDF</a><button class="btn wa sm" id="bShare">Send PDF link on WhatsApp</button></div>`
          : canApprove ? '<p class="small">Check the details above, then approve. This confirms the booking.</p><button class="btn copper" id="bApprove">Approve booking</button>'
          : '<p class="small muted">Waiting for the sales manager to approve.</p>'}</div>

      <div class="sec"><h3>Activity</h3>
        ${canSell || canDesk ? '<div class="row" style="margin-bottom:8px"><input type="text" id="note" placeholder="Add a note / follow-up" style="flex:1"><button class="btn sm" id="bNote">Add</button></div>' : ''}
        <ul class="timeline">${e.activities.map((a) => `<li><span class="tiny muted">${time(a.at)} · ${esc(a.user_name || 'System')}</span><br>${esc(a.note || a.type)}</li>`).join('')}</ul>
        ${canSell && !['Booked', 'Lost'].includes(e.stage) ? '<button class="btn danger sm" id="bLost" style="margin-top:10px">Mark as lost</button>' : ''}</div>

      <div class="sec"><h3>CRM / internal portal sync ${e.sync.some((s) => s.status === 'failed') ? '<button class="btn danger sm" id="bRetry">Retry failed</button>' : ''}</h3>
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
    on('bVisit', async () => { await post('visit', { units: $('svU').value, feedback: $('svF').value, note: $('svN').value }); toast('Visit saved & synced'); re(); });
    on('bBook', async () => {
      if (!$('bkU').value) throw new Error('Choose a unit');
      await api(`/api/enquiries/${id}/booking`, { method: 'PUT', json: { flatId: $('bkU').value, agreementValue: $('bkV').value, paymentPlan: $('bkP').value, coApplicant: $('bkCo').value } });
      toast('Booking form saved — unit on hold'); re();
    });
    if ($('bkT')) loadUnits(e, b);
    document.querySelectorAll('#drawer input[data-k]').forEach((inp) => (inp.onchange = run(async () => {
      if (!inp.files[0]) return; const fd = new FormData(); fd.append('kind', inp.dataset.k); fd.append('file', await shrink(inp.files[0]), inp.files[0].name);
      await api(`/api/enquiries/${id}/kyc`, { method: 'POST', body: fd }); toast('Uploaded'); re();
    })));
    on('bKyc', async () => { await post('kyc/complete'); re(); });
    on('bPay', async () => { await post('payments', { amount: $('pyA').value, mode: $('pyM').value, ref: $('pyR').value }); toast('Sent to Accounts for verification'); re(); });
    const pads = {}; ['sgC', 'sgE'].forEach((k) => { if ($(k)) pads[k] = sigPad($(k)); });
    document.querySelectorAll('[data-clr]').forEach((bn) => (bn.onclick = () => pads[bn.dataset.clr] && pads[bn.dataset.clr].clear()));
    on('bSign', async () => {
      const body = {};
      if (pads.sgC) { if (!pads.sgC.has()) throw new Error('Customer signature is missing'); body.customer = pads.sgC.png(); }
      if (pads.sgE) { if (!pads.sgE.has()) throw new Error('Sales signature is missing'); body.sales = pads.sgE.png(); }
      await post('signatures', body); toast('Signatures saved — sent for manager approval'); re();
    });
    on('bApprove', async () => { const btn = $('bApprove'); btn.disabled = true; btn.textContent = 'Approving…'; try { await post('approve'); toast('Booked! Confirmation sent to customer'); } finally { re(); } });
    on('bShare', async () => {
      const { url } = await api(`/api/enquiries/${id}/share-link`);
      window.open(`https://wa.me/91${e.mobile}?text=${encodeURIComponent(`Hi ${first(e.name)}, here is your signed booking form for ${b.unit} at ${e.project_name}: ${url}`)}`, '_blank', 'noopener');
    });
    on('bNote', async () => { const n = $('note').value.trim(); if (!n) return; await post('notes', { note: n }); re(); });
    on('bLost', async () => {
      const reason = window.prompt('Why is this customer lost? (e.g. budget, location, bought elsewhere)');
      if (reason === null) return; await post('lost', { reason }); toast('Marked lost'); re();
    });
    on('bRetry', async () => { await post('sync/retry'); toast('Retried'); re(); });
  }

  /* Unit picker: towers/wings → available flats from the CRM inventory */
  async function loadUnits(e, b) {
    let units = [];
    try { units = (await api(`/api/projects/${e.project_id}/units`)).units; } catch (err) { $('bkT').innerHTML = '<option value="">Could not load units</option>'; return; }
    const usable = units.filter((u) => u.status === 'Available' || u.held_by === e.id);
    const groups = [...new Set(usable.map((u) => u.tower + (u.wing && u.wing !== u.tower ? ' · ' + u.wing : '')))];
    const label = (u) => u.tower + (u.wing && u.wing !== u.tower ? ' · ' + u.wing : '');
    const cur = b.flat_id ? units.find((u) => u.id === b.flat_id) : null;
    const pref = String(e.config || '');
    $('bkT').innerHTML = '<option value="">— choose —</option>' + groups.map((g) => `<option ${cur && label(cur) === g ? 'selected' : ''}>${esc(g)}</option>`).join('');
    const fill = () => {
      const list = usable.filter((u) => label(u) === $('bkT').value).sort((x, y) => (y.flat_type === pref) - (x.flat_type === pref));
      $('bkU').innerHTML = '<option value="">— choose —</option>' + list.map((u) => `<option value="${u.id}" ${cur && cur.id === u.id ? 'selected' : ''}>${esc(u.flat_no)} · ${esc(u.flat_type || '')}${u.floor !== null ? ' · Floor ' + u.floor : ''}${u.carpet_area ? ' · ' + u.carpet_area + ' sq ft' : ''}${u.held_by === e.id ? ' (held for you)' : ''}</option>`).join('');
      info();
    };
    const info = () => {
      const u = units.find((x) => x.id === $('bkU').value);
      $('bkInfo').textContent = u ? `${u.flat_type || ''} · Floor ${u.floor ?? '—'} · Carpet ${u.carpet_area ?? '—'} sq ft` : `${usable.length} of ${units.length} units available in ${e.project_name}`;
    };
    $('bkT').onchange = fill; $('bkU').onchange = info;
    fill();
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
    const g = c.getContext('2d'); g.scale(dpr, dpr); g.lineWidth = 2.2; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#23284A';
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
