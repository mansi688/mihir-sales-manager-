/* Reception tablet: 3-step enquiry form → auto-assign → QR to WhatsApp. */
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m, err) => { const t = $('toast'); t.textContent = m; t.className = 'toast show' + (err ? ' err' : ''); clearTimeout(t._t); t._t = setTimeout(() => (t.className = 'toast'), 3000); };

  // The kiosk key arrives once via ?key=… and is remembered on this tablet.
  const qsKey = new URLSearchParams(location.search).get('key');
  if (qsKey) { try { localStorage.setItem('mg_kiosk_key', qsKey); } catch {} history.replaceState(null, '', location.pathname); }
  let KEY = qsKey; try { KEY = KEY || localStorage.getItem('mg_kiosk_key'); } catch {}

  let cfg = null; let step = 0; let data = {}; let idle;
  const IDLE_FORM = 3 * 60 * 1000, IDLE_DONE = 90 * 1000;

  function armIdle(ms) { clearTimeout(idle); idle = setTimeout(reset, ms); }
  ['pointerdown', 'keydown'].forEach((ev) => document.addEventListener(ev, () => { if (step < 3 && step > 0) armIdle(IDLE_FORM); }));

  function reset() { step = 0; data = {}; clearTimeout(idle); render(); window.scrollTo(0, 0); }

  const opts = (name, list, val = (x) => x, lab = (x) => x) =>
    `<div class="opts">${list.map((o) => `<label><input type="radio" name="${name}" value="${esc(val(o))}" ${String(data[name]) === String(val(o)) ? 'checked' : ''}> ${esc(lab(o))}</label>`).join('')}</div>`;
  const prog = () => `<div class="k-steps">${['About you', 'Your new home', 'Finish'].map((l, i) => `<div class="${i <= step ? 'on' : ''}"><i></i><span>${l}</span></div>`).join('')}</div>`;

  function render() {
    const app = $('app');
    if (!KEY) { app.innerHTML = '<div class="card"><h2>Kiosk not set up</h2><p>Open this page once with the kiosk key: <code>/kiosk/?key=…</code></p></div>'; return; }
    if (step === 0) {
      app.innerHTML = `${prog()}<h1>Tell us about yourself</h1><p class="muted" style="margin-top:-4px">Takes about a minute. Your relationship manager will be with you shortly.</p>
      <form id="f" autocomplete="off">
        <div class="field"><label>Full name *</label><input type="text" name="name" required value="${esc(data.name)}" placeholder="e.g. Rahul Sharma"></div>
        <div class="row">
          <div class="field"><label>Mobile (WhatsApp) *</label><input type="tel" name="mobile" required inputmode="numeric" pattern="[6-9][0-9]{9}" maxlength="10" value="${esc(data.mobile)}" placeholder="10-digit number"></div>
          <div class="field"><label>Email</label><input type="email" name="email" value="${esc(data.email)}" placeholder="optional"></div>
        </div>
        <div class="field"><label>Current residence (area, city)</label><input type="text" name="residence" value="${esc(data.residence)}" placeholder="e.g. Baner, Pune"></div>
        <div class="row" style="justify-content:flex-end"><button class="btn copper lg">Next →</button></div>
      </form>`;
    } else if (step === 1) {
      const proj = cfg.projects.find((p) => String(p.id) === String(data.projectId));
      app.innerHTML = `${prog()}<h1>What are you looking for?</h1>
      <form id="f">
        <div class="field"><label>Project *</label>${opts('projectId', cfg.projects, (p) => p.id, (p) => p.name)}</div>
        <div class="field" id="cfgF"><label>Configuration *</label>${proj ? opts('config', proj.configs) : '<p class="muted small">Choose a project first</p>'}</div>
        <div class="field"><label>Budget *</label>${opts('budget', cfg.budgets)}</div>
        <div class="field"><label>Purpose</label>${opts('purpose', cfg.purposes)}</div>
        <div class="row between"><button type="button" class="btn ghost lg" id="back">← Back</button><button class="btn copper lg">Next →</button></div>
      </form>`;
      app.querySelectorAll('input[name=projectId]').forEach((r) => (r.onchange = () => { grab(); data.config = ''; render(); }));
    } else if (step === 2) {
      app.innerHTML = `${prog()}<h1>Almost done</h1>
      <form id="f">
        <div class="field"><label>How did you hear about us? *</label>${opts('source', cfg.sources)}</div>
        <div class="field ${data.source === 'Channel partner' ? '' : 'hidden'}" id="cpF"><label>Channel partner name</label><input type="text" name="cpName" value="${esc(data.cpName)}"></div>
        <div class="field"><label>When would you like to see the site / sample flat?</label>${opts('visitPref', cfg.visitPrefs)}</div>
        <label class="small" style="font-weight:500;display:flex;gap:10px;align-items:flex-start;margin:8px 0 18px"><input type="checkbox" name="consent" ${data.consent ? 'checked' : ''} style="margin-top:4px;width:20px;height:20px"> I agree that ${esc(cfg.org.name)} may contact me on WhatsApp, phone and email about this enquiry.</label>
        <div class="row between"><button type="button" class="btn ghost lg" id="back">← Back</button><button class="btn copper lg" id="submit">Submit enquiry</button></div>
      </form>`;
      app.querySelectorAll('input[name=source]').forEach((r) => (r.onchange = () => $('cpF').classList.toggle('hidden', r.value !== 'Channel partner')));
    } else {
      const d = data._result; const s = d.sales;
      app.innerHTML = `<div style="text-align:center">
        <div class="done-ic"><svg class="i" viewBox="0 0 24 24" style="width:32px;height:32px"><path d="M20 6 9 17l-5-5"/></svg></div>
        <span class="chip ok">Enquiry ${esc(d.id)} received</span>
        <h1 style="margin-top:12px">Thank you, ${esc(d.firstName)}!</h1>
        <p class="muted" style="margin-top:-4px;font-size:16px">Scan with your phone camera to chat with your relationship manager on WhatsApp.</p>
        <div class="qrbox"><img src="${d.qr}" alt="WhatsApp QR code"></div>
        ${s ? `<div class="rm"><img src="${esc(s.photoUrl || '/assets/mark.png')}" alt=""><div><div class="tiny muted" style="font-weight:700;letter-spacing:.6px">YOUR RELATIONSHIP MANAGER</div><div style="font-family:Montserrat;font-weight:700;font-size:19px">${esc(s.name)}</div><div class="muted small">${esc(s.designation)}</div></div></div>
        <p class="small muted" style="margin-top:12px">${d.busy ? 'Our team is with other guests — someone will be with you very shortly.' : esc(s.name.split(' ')[0]) + ' will meet you in the lounge in a few minutes.'}</p>`
          : '<p>Our reception team will introduce you to a relationship manager shortly.</p>'}
        <button class="btn lg" style="margin-top:18px" id="done">Done — return tablet to reception</button></div>`;
      $('done').onclick = reset;
      armIdle(IDLE_DONE);
      return;
    }
    const f = $('f');
    const back = $('back'); if (back) back.onclick = () => { grab(); step--; render(); };
    f.onsubmit = (ev) => { ev.preventDefault(); grab(); next(); };
  }

  function grab() {
    const f = $('f'); if (!f) return;
    const fd = new FormData(f);
    for (const [k, v] of fd.entries()) data[k] = v;
    if (f.querySelector('input[name=consent]')) data.consent = f.querySelector('input[name=consent]').checked;
  }

  async function next() {
    const need = { 1: ['projectId', 'config', 'budget'], 2: ['source'] }[step] || [];
    const labels = { projectId: 'project', config: 'configuration', budget: 'budget', source: 'how you heard about us' };
    const miss = need.filter((k) => !data[k]);
    if (miss.length) return toast('Please choose: ' + miss.map((m) => labels[m]).join(', '), true);
    if (step === 0 && !/^[6-9]\d{9}$/.test(data.mobile || '')) return toast('Please enter a valid 10-digit mobile number', true);
    if (step < 2) { step++; render(); window.scrollTo(0, 0); armIdle(IDLE_FORM); return; }
    if (!data.consent) return toast('Please tick the consent box to continue', true);
    const btn = $('submit'); btn.disabled = true; btn.textContent = 'Submitting…';
    try {
      const r = await fetch('/api/kiosk/enquiries', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Kiosk-Key': KEY }, body: JSON.stringify(data) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Could not submit');
      data._result = j; step = 3; render(); window.scrollTo(0, 0);
    } catch (e) { toast(e.message, true); btn.disabled = false; btn.textContent = 'Submit enquiry'; }
  }

  fetch('/api/public/config').then((r) => r.json()).then((c) => {
    cfg = c; render();
    const chips = document.getElementById('projChips'); if (chips) chips.innerHTML = c.projects.map((p) => `<span>${esc(p.name)}</span>`).join('');
  })
    .catch(() => { $('app').innerHTML = '<div class="card"><h2>Offline</h2><p>Cannot reach the server. Please call reception.</p></div>'; });
})();
