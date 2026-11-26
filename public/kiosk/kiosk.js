/* Reception kiosk — one question per screen → auto-assign → WhatsApp QR. */
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m, err) => { const t = $('toast'); t.textContent = m; t.className = 'toast show' + (err ? ' err' : ''); clearTimeout(t._t); t._t = setTimeout(() => (t.className = 'toast'), 3200); };
  const ICON = {
    back: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
    next: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>',
    ok: '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    reset: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
  };

  // The kiosk key arrives once via ?key=… and is remembered on this tablet.
  const qsKey = new URLSearchParams(location.search).get('key');
  if (qsKey) { try { localStorage.setItem('mg_kiosk_key', qsKey); } catch {} history.replaceState(null, '', location.pathname); }
  let KEY = qsKey; try { KEY = KEY || localStorage.getItem('mg_kiosk_key'); } catch {}

  let cfg = null; let i = -1; let data = {}; let result = null; let idle; let busy = false;
  const IDLE_FORM = 3 * 60 * 1000, IDLE_DONE = 90 * 1000;
  const armIdle = (ms) => { clearTimeout(idle); idle = setTimeout(reset, ms); };
  ['pointerdown', 'keydown'].forEach((ev) => document.addEventListener(ev, () => { if (i >= 0 && !result) armIdle(IDLE_FORM); }));
  function reset() { i = -1; data = {}; result = null; busy = false; clearTimeout(idle); render(); }

  const proj = () => cfg.projects.find((p) => String(p.id) === String(data.projectId));

  /* ---------- questions ---------- */
  const Q = [
    { k: 'name', t: 'text', h: "What's your name?", help: 'So your relationship manager can greet you.', ph: 'Full name', req: true,
      ok: (v) => v.trim().length >= 2 || 'Please enter your name' },
    { k: 'mobile', t: 'tel', h: (d) => `Hi ${first(d)}! Your mobile number?`, help: "We'll share your relationship manager's details on WhatsApp.", ph: '10-digit mobile', req: true,
      ok: (v) => /^[6-9]\d{9}$/.test(v) || 'Please enter a valid 10-digit mobile number' },
    { k: 'email', t: 'email', h: 'Your email address', help: 'Optional — for brochures and price sheets.', ph: 'name@example.com', skip: true,
      ok: (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || 'That email looks incomplete' },
    { k: 'residence', t: 'text', h: 'Where do you live currently?', help: 'Area and city — optional.', ph: 'e.g. Baner, Pune', skip: true },
    { k: 'projectId', t: 'opt', h: 'Which project are you interested in?', req: true,
      opts: () => cfg.projects.map((p) => ({ v: p.id, l: p.name, s: p.location || (p.configs || []).join(' · ') })),
      after: () => { data.config = ''; } },
    { k: 'config', t: 'opt', h: 'Which configuration?', help: (d) => proj() ? `Available at ${proj().name}` : '', req: true,
      opts: () => ((proj() && proj().configs) || []).map((c) => ({ v: c, l: c })) },
    { k: 'budget', t: 'opt', h: 'What budget are you considering?', help: 'All-inclusive, approximate is fine.', req: true, opts: () => cfg.budgets.map((b) => ({ v: b, l: b })) },
    { k: 'purpose', t: 'opt', h: 'Is this for you to live in, or an investment?', skip: true, opts: () => cfg.purposes.map((b) => ({ v: b, l: b })) },
    { k: 'source', t: 'opt', h: 'How did you hear about us?', req: true, opts: () => cfg.sources.map((b) => ({ v: b, l: b })), extra: true },
    { k: 'visitPref', t: 'opt', h: 'When would you like to see the site or sample flat?', skip: true, opts: () => cfg.visitPrefs.map((b) => ({ v: b, l: b })) },
    { k: 'consent', t: 'review', h: 'Almost done — please check', req: true },
  ];
  const first = (d) => esc(String(d.name || '').trim().split(/\s+/)[0] || 'there');
  const val = (q, f) => (typeof f === 'function' ? f(data) : f || '');

  /* ---------- rendering ---------- */
  function top() {
    const t = $('top');
    if (i < 0 || result) { t.innerHTML = `<span class="muted small" style="font-weight:700">${esc(cfg ? cfg.org.name : 'Mihir Group')} · Sales Lounge</span>`; return; }
    const pct = Math.round(((i + 1) / Q.length) * 100);
    t.innerHTML = `<button class="btn ghost icon" id="tb" aria-label="Back">${ICON.back}</button>
      <div class="bar" aria-label="Progress"><i style="width:${pct}%"></i></div>
      <span class="muted small" style="font-weight:800;min-width:54px;text-align:right">${i + 1} / ${Q.length}</span>
      <button class="btn ghost sm" id="tr">${ICON.reset} Start over</button>`;
    $('tb').onclick = back; $('tr').onclick = () => { if (confirmReset()) reset(); };
  }
  let resetArmed = 0;
  function confirmReset() { if (Date.now() - resetArmed < 3000) return true; resetArmed = Date.now(); toast('Tap "Start over" again to clear the form'); return false; }

  function render() {
    const app = $('app');
    if (!KEY) { top(); app.innerHTML = `<div class="k-q k-welcome"><h2>Kiosk not set up</h2><p class="help">Ask a sales manager to open <b>New walk-in</b> on the portal once on this tablet.</p></div>`; return; }
    if (!cfg) return;
    top();
    if (result) return done(app);
    if (i < 0) {
      app.innerHTML = `<div class="k-q k-welcome">
        <img src="/assets/logo.png" alt="" style="height:86px;margin:0 auto 18px;display:block">
        <div class="stp">Welcome to ${esc(cfg.org.name)}</div>
        <h2>Let's find your<br>perfect home.</h2>
        <p class="help">A few quick taps — about a minute.</p>
        <button class="btn cu xl" id="go" style="min-width:240px">Tap to begin ${ICON.next}</button>
      </div>`;
      $('go').onclick = () => { i = 0; armIdle(IDLE_FORM); render(); };
      return;
    }
    const q = Q[i];
    let body = '';
    if (q.t === 'opt') {
      const os = q.opts();
      body = os.length
        ? `<div class="k-opts">${os.map((o, n) => `<button type="button" class="k-opt ${String(data[q.k]) === String(o.v) ? 'on' : ''}" data-v="${esc(o.v)}"><span class="k">${String.fromCharCode(65 + n)}</span><span>${esc(o.l)}${o.s ? `<small>${esc(o.s)}</small>` : ''}</span></button>`).join('')}</div>`
        : '<p class="help">No options available — please ask reception.</p>';
      if (q.extra) body += `<div id="cpBox" style="margin-top:16px;${data.source === 'Channel partner' ? '' : 'display:none'}"><label class="lbl">Channel partner / broker name</label><input type="text" id="cp" class="inp" value="${esc(data.cpName)}" placeholder="Name of the firm or person"></div>`;
    } else if (q.t === 'review') {
      const p = proj();
      const rows = [['Name', data.name], ['Mobile', data.mobile], ['Email', data.email], ['Project', p && p.name], ['Configuration', data.config], ['Budget', data.budget], ['Purpose', data.purpose], ['Heard via', data.source + (data.cpName ? ` — ${data.cpName}` : '')], ['Site visit', data.visitPref]].filter((r) => r[1]);
      body = `<div class="card"><div class="card-b"><dl class="kv">${rows.map(([a, b]) => `<dt>${a}</dt><dd>${esc(b)}</dd>`).join('')}</dl></div></div>
        <label style="display:flex;gap:14px;align-items:flex-start;margin-top:18px;font-weight:600;font-size:15.5px;cursor:pointer">
          <input type="checkbox" id="consent" ${data.consent ? 'checked' : ''} style="width:26px;height:26px;flex:none;margin-top:1px;accent-color:#262B52">
          <span>I agree that ${esc(cfg.org.name)} may contact me on WhatsApp, phone and email about this enquiry.</span></label>`;
    } else {
      body = `<input type="${q.t}" id="inp" autocomplete="off" ${q.t === 'tel' ? 'inputmode="numeric" maxlength="10"' : ''} value="${esc(data[q.k])}" placeholder="${esc(q.ph)}">`;
    }
    const last = q.t === 'review';
    app.innerHTML = `<form class="k-q" id="f" novalidate>
      <div class="stp">Question ${i + 1} of ${Q.length}${q.skip ? ' · optional' : ''}</div>
      <h2>${val(q, q.h)}</h2>
      ${q.help ? `<p class="help">${val(q, q.help)}</p>` : '<div style="height:18px"></div>'}
      ${body}
      <div class="k-nav">
        ${i > 0 ? `<button type="button" class="btn line lg" id="bk">${ICON.back} Back</button>` : ''}
        <span style="flex:1"></span>
        ${q.skip && !data[q.k] ? '<button type="button" class="btn ghost lg" id="sk">Skip</button>' : ''}
        <button class="btn ${last ? 'cu xl' : 'lg'}" id="nx">${last ? 'Submit enquiry' : 'Continue'} ${ICON.next}</button>
      </div></form>`;

    const inp = $('inp'); if (inp) { setTimeout(() => inp.focus(), 60); if (q.t === 'tel') inp.oninput = () => (inp.value = inp.value.replace(/\D/g, '').slice(0, 10)); }
    app.querySelectorAll('.k-opt').forEach((b) => (b.onclick = () => {
      const changed = String(data[q.k]) !== b.dataset.v;
      data[q.k] = b.dataset.v; if (changed && q.after) q.after();
      app.querySelectorAll('.k-opt').forEach((x) => x.classList.toggle('on', x === b));
      if (q.extra) { const show = data.source === 'Channel partner'; $('cpBox').style.display = show ? '' : 'none'; if (show) { $('cp').focus(); return; } data.cpName = ''; }
      setTimeout(next, 240);
    }));
    const bk = $('bk'); if (bk) bk.onclick = back;
    const sk = $('sk'); if (sk) sk.onclick = () => { data[q.k] = ''; go(1); };
    $('f').onsubmit = (e) => { e.preventDefault(); next(); };
  }

  function grab() {
    const q = Q[i]; if (!q) return;
    const inp = $('inp'); if (inp) data[q.k] = inp.value.trim();
    const cp = $('cp'); if (cp) data.cpName = cp.value.trim();
    const c = $('consent'); if (c) data.consent = c.checked;
  }
  function go(d) { i = Math.max(-1, Math.min(Q.length - 1, i + d)); render(); window.scrollTo(0, 0); }
  function back() { grab(); go(-1); }

  async function next() {
    if (busy) return;
    grab();
    const q = Q[i];
    const v = data[q.k];
    if (q.ok) { const r = q.ok(String(v || '')); if (r !== true) return toast(r, true); }
    if (q.req && !v) return toast(q.t === 'review' ? 'Please tick the consent box to continue' : 'Please choose an option to continue', true);
    if (q.k === 'source' && v === 'Channel partner' && !data.cpName) return toast("Please enter the channel partner's name", true);
    if (q.t !== 'review') return go(1);
    busy = true; const btn = $('nx'); btn.disabled = true; btn.textContent = 'Submitting…';
    try {
      const r = await fetch('/api/kiosk/enquiries', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Kiosk-Key': KEY }, body: JSON.stringify(data) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Could not submit — please try again');
      result = j; render(); window.scrollTo(0, 0); armIdle(IDLE_DONE);
    } catch (e) { toast(e.message, true); btn.disabled = false; btn.innerHTML = `Submit enquiry ${ICON.next}`; }
    busy = false;
  }

  function done(app) {
    const d = result; const s = d.sales;
    app.innerHTML = `<div class="k-q k-welcome">
      <div class="okc">${ICON.ok}</div>
      <span class="badge ok">Enquiry ${esc(d.id)} received</span>
      <h2 style="margin-top:14px">Thank you, ${esc(d.firstName)}!</h2>
      <p class="help">Scan with your phone camera to chat with your relationship manager on WhatsApp.</p>
      <div class="qr"><img src="${d.qr}" alt="WhatsApp QR code"></div>
      ${s ? `<div class="rm"><img class="avatar" style="width:64px;height:64px;border-radius:18px;object-fit:cover" src="${esc(s.photoUrl || '/assets/mark.png')}" alt="">
          <div><div class="stp" style="font-size:11px">Your relationship manager</div>
          <div style="font-weight:800;font-size:20px;margin-top:2px">${esc(s.name)}</div>
          <div class="muted small">${esc(s.designation || '')}</div></div></div>
        <p class="help" style="margin:14px 0 0">${d.busy ? 'Our team is with other guests — someone will be with you very shortly.' : esc(s.name.split(' ')[0]) + ' will meet you in the lounge in a few minutes.'}</p>`
        : '<p class="help">Our reception team will introduce you to a relationship manager shortly.</p>'}
      <div class="k-nav" style="justify-content:center">${d.formUrl ? `<a class="btn line lg" target="_blank" rel="noopener" href="${esc(d.formUrl)}">Print enquiry form</a>` : ''}<button class="btn lg" id="dn">Done — return tablet to reception</button></div>
    </div>`;
    $('dn').onclick = reset;
  }

  fetch('/api/public/config').then((r) => r.json()).then((c) => {
    cfg = c; render();
    $('projChips').innerHTML = c.projects.map((p) => `<span>${esc(p.name)}</span>`).join('');
  }).catch(() => { $('app').innerHTML = '<div class="k-q k-welcome"><h2>Offline</h2><p class="help">Cannot reach the server. Please call reception.</p></div>'; });

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
})();
