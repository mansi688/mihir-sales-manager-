/* Customer portal — mobile-first online enquiry, usually opened from a WhatsApp link. */
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m, err) => { const t = $('toast'); t.textContent = m; t.className = 'toast show' + (err ? ' err' : ''); clearTimeout(t._t); t._t = setTimeout(() => (t.className = 'toast'), 3200); };
  const ic = (d, s = '') => `<svg class="ic" viewBox="0 0 24 24" ${s}>${d}</svg>`;
  const I = {
    home: '<path d="M4 21V8l8-5 8 5v13"/><path d="M9 21v-6h6v6"/>',
    wa: '<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/>',
    ok: '<path d="M20 6 9 17l-5-5"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9m-4 4 3 3"/>',
    save: '<path d="M12 4v11m0 0-4-4m4 4 4-4"/><path d="M5 20h14"/>',
  };
  const rmSlug = new URLSearchParams(location.search).get('rm') || '';
  let cfg = null, rm = null, d = { projectId: '', config: '', budget: '', purpose: '', visitPref: '' }, sending = false;

  const opts = (k, list) => `<div class="cp-opts" data-k="${k}">${list.map((v) => `<button type="button" data-v="${esc(v)}" class="${d[k] === v ? 'on' : ''}">${esc(v)}</button>`).join('')}</div>`;
  const proj = () => cfg.projects.find((p) => String(p.id) === String(d.projectId));

  function form() {
    const p = proj();
    return `<form class="cp-form" id="f" novalidate>
      ${rm ? `<div class="cp-rm" style="margin-bottom:16px"><img src="${esc(rm.photoUrl || '/assets/mark.png')}" alt=""><div><div class="over" style="color:var(--cu-d)">Your relationship manager</div><b style="font-size:16px">${esc(rm.name)}</b><div class="sm muted">${esc(rm.designation)}</div></div></div>` : ''}
      <h2>Tell us about your new home</h2>
      <p class="sub">Takes under a minute. Fields marked * are required.</p>
      <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
      <div class="g g2" style="gap:0 14px">
        <div class="field"><label for="name">Full name <span class="req">*</span></label><input type="text" id="name" autocomplete="name" placeholder="e.g. Rahul Sharma"></div>
        <div class="field"><label for="mobile">WhatsApp number <span class="req">*</span></label><input type="tel" id="mobile" inputmode="numeric" maxlength="10" autocomplete="tel-national" placeholder="10-digit mobile"></div>
      </div>
      <div class="field"><label for="email">Email <span class="hint">(optional)</span></label><input type="email" id="email" autocomplete="email" placeholder="name@example.com"></div>
      <div class="field" id="fx-projectId"><label>Project <span class="req">*</span></label>
        <div class="cp-proj">${cfg.projects.map((x, i) => `<div class="pcard ${String(d.projectId) === String(x.id) ? 'on' : ''}" data-p="${esc(x.id)}" style="animation-delay:${i * 0.05}s" role="button" tabindex="0">
          <div class="art"><span>${esc(x.name)}</span></div><div class="bd"><small>${esc((x.configs || []).join(' · '))}</small></div></div>`).join('')}</div></div>
      <div class="field" id="fx-config"><label>Configuration <span class="req">*</span></label>${p ? opts('config', p.configs) : '<span class="hint">Choose a project first</span>'}</div>
      <div class="field" id="fx-budget"><label>Budget <span class="req">*</span></label>${opts('budget', cfg.budgets)}</div>
      <div class="field"><label>Purpose</label>${opts('purpose', cfg.purposes)}</div>
      <div class="field"><label>When would you like to visit?</label>${opts('visitPref', cfg.visitPrefs.filter((v) => v !== 'Right now'))}</div>
      <label class="check" style="margin:6px 0 18px" id="fx-consent"><input type="checkbox" id="consent"><span class="sm">I agree that ${esc(cfg.org.name)} may contact me on WhatsApp, phone and email about this enquiry.</span></label>
      <button class="btn lg full" id="go">${ic(I.wa)} Send enquiry</button>
      <p class="xs muted" style="text-align:center;margin-top:10px">We never share your details. You'll hear from us on WhatsApp.</p>
    </form>`;
  }

  function side() {
    return `<aside class="cp-side stack" style="gap:12px">
      <div class="cp-why">
        <div>${ic(I.shield)}<b>RERA registered</b><p class="sm muted">Every project is MahaRERA registered with transparent cost sheets.</p></div>
        <div>${ic(I.clock)}<b>Quick response</b><p class="sm muted">A dedicated relationship manager replies on WhatsApp, usually within the hour.</p></div>
        <div>${ic(I.key)}<b>End-to-end help</b><p class="sm muted">Site visits, home-loan tie-ups and paperwork — handled with you.</p></div>
      </div></aside>`;
  }

  function render() {
    $('main').innerHTML = form() + side();
    const f = $('f');
    f.querySelectorAll('.pcard').forEach((c) => {
      const pick = () => { if (String(d.projectId) !== c.dataset.p) { grab(); d.projectId = c.dataset.p; d.config = ''; render(); setTimeout(() => $('fx-config').scrollIntoView({ behavior: 'smooth', block: 'center' }), 60); } };
      c.onclick = pick; c.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } };
    });
    f.querySelectorAll('.cp-opts').forEach((g) => g.querySelectorAll('button').forEach((b) => (b.onclick = () => {
      d[g.dataset.k] = d[g.dataset.k] === b.dataset.v && g.dataset.k !== 'config' && g.dataset.k !== 'budget' ? '' : b.dataset.v;
      g.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x.dataset.v === d[g.dataset.k]));
      clearErr(g.dataset.k);
    })));
    ['name', 'mobile', 'email'].forEach((k) => { const el = $(k); el.value = d[k] || ''; el.oninput = () => { if (k === 'mobile') el.value = el.value.replace(/\D/g, '').slice(0, 10); el.classList.remove('bad'); const t = el.parentNode.querySelector('.err-t'); if (t) t.remove(); }; });
    $('consent').checked = !!d.consent; $('consent').onchange = () => clearErr('consent');
    f.onsubmit = (e) => { e.preventDefault(); submit(); };
  }
  function grab() { ['name', 'mobile', 'email'].forEach((k) => { const el = $(k); if (el) d[k] = el.value.trim(); }); const c = $('consent'); if (c) d.consent = c.checked; }
  function err(id, msg) {
    const el = $(id) || $('fx-' + id); if (!el) return;
    if (el.tagName === 'INPUT') el.classList.add('bad');
    const host = el.tagName === 'INPUT' ? el.parentNode : el;
    if (!host.querySelector('.err-t')) host.insertAdjacentHTML('beforeend', `<span class="err-t">${esc(msg)}</span>`);
  }
  function clearErr(k) { const h = $('fx-' + k); if (h) { const t = h.querySelector('.err-t'); if (t) t.remove(); } }

  async function submit() {
    if (sending) return;
    grab();
    document.querySelectorAll('.err-t').forEach((x) => x.remove());
    const bad = [];
    if ((d.name || '').length < 2) bad.push(['name', 'Please enter your name']);
    if (!/^[6-9]\d{9}$/.test(d.mobile || '')) bad.push(['mobile', 'Enter a valid 10-digit mobile number']);
    if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) bad.push(['email', 'This email looks incomplete']);
    if (!d.projectId) bad.push(['projectId', 'Choose a project']);
    if (!d.config) bad.push(['config', 'Choose a configuration']);
    if (!d.budget) bad.push(['budget', 'Choose a budget']);
    if (!d.consent) bad.push(['consent', 'Please accept to continue']);
    if (bad.length) { bad.forEach(([k, m]) => err(k, m)); const first = $(bad[0][0]) || $('fx-' + bad[0][0]); first.scrollIntoView({ behavior: 'smooth', block: 'center' }); return toast('Please check the highlighted fields', true); }
    sending = true; const b = $('go'); b.disabled = true; b.textContent = 'Sending…';
    try {
      const body = { ...d, rm: rmSlug, website: document.querySelector('.hp').value, source: rmSlug ? 'WhatsApp' : 'Website' };
      const r = await fetch('/api/public/enquiries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Could not send — please try again');
      done(j);
    } catch (e) { toast(e.message, true); b.disabled = false; b.innerHTML = `${ic(I.wa)} Send enquiry`; }
    sending = false;
  }

  function done(j) {
    const s = j.sales;
    $('main').innerHTML = `<div class="cp-form" style="text-align:center">
      <div class="okc">${ic(I.ok, 'style="width:32px;height:32px;stroke-width:2.4"')}</div>
      <span class="badge info">Enquiry ${esc(j.id)}</span>
      <h2 style="margin-top:12px;font-size:26px">Thank you, ${esc(j.firstName)}!</h2>
      <p class="sub" style="margin-bottom:18px">${s ? `${esc(s.name.split(' ')[0])} will message you on WhatsApp shortly.` : 'Our team will message you on WhatsApp shortly.'}</p>
      ${s ? `<div class="cp-rm" style="text-align:left;max-width:420px;margin:0 auto 18px"><img src="${esc(s.photoUrl || '/assets/mark.png')}" alt=""><div class="grow"><div class="over" style="color:var(--cu-d)">Your relationship manager</div><b style="font-size:16px">${esc(s.name)}</b><div class="sm muted">${esc(s.designation || '')}</div></div>
        <a class="btn line icon sm" href="/card/${esc(s.slug)}.vcf" title="Save contact">${ic(I.save)}</a></div>` : ''}
      <a class="btn wa lg full" style="max-width:420px" href="${esc(j.whatsappLink)}">${ic(I.wa)} Chat on WhatsApp now</a>
      ${s ? `<div style="margin-top:12px"><a class="lnk" href="/card/${esc(s.slug)}">View ${esc(s.name.split(' ')[0])}'s visiting card</a></div>` : ''}
    </div>${side()}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  Promise.all([
    fetch('/api/public/config').then((r) => r.json()),
    rmSlug ? fetch('/api/public/rm/' + encodeURIComponent(rmSlug)).then((r) => (r.ok ? r.json() : null)).catch(() => null) : null,
  ]).then(([c, r]) => {
    cfg = c; rm = r;
    $('nProj').textContent = c.projects.length; $('tag').textContent = c.org.tagline || '';
    $('foot').textContent = `${c.org.name} · ${c.org.tagline || ''}`;
    $('callBtn').href = 'tel:+' + c.org.whatsapp;
    if (c.projects.length === 1) d.projectId = c.projects[0].id;
    render();
  }).catch(() => { $('main').innerHTML = '<div class="cp-form"><h2>We\'re offline</h2><p class="sub">Please try again in a moment.</p></div>'; });
})();
