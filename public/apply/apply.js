/* Customer fills their part of the booking application on their own phone; can print the filled or blank form. */
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m, err) => { const t = $('toast'); t.textContent = m; t.className = 'toast show' + (err ? ' err' : ''); clearTimeout(t._t); t._t = setTimeout(() => (t.className = 'toast'), 3400); };
  const ic = (d) => `<svg class="ic" viewBox="0 0 24 24">${d}</svg>`;
  const I = { ok: '<path d="M20 6 9 17l-5-5"/>', print: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>', dl: '<path d="M12 4v11m0 0-4-4m4 4 4-4"/><path d="M5 20h14"/>', back: '<path d="M19 12H5M11 6l-6 6 6 6"/>', next: '<path d="M5 12h14M13 6l6 6-6 6"/>', lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', home: '<path d="M4 21V8l8-5 8 5v13"/><path d="M9 21v-6h6v6"/>', doc: '<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3v5h5M8.5 13h7M8.5 17h5"/>' };
  const inr = (n) => (n ? '₹' + Number(n).toLocaleString('en-IN') : '—');

  const T = new URLSearchParams(location.search).get('t') || '';
  const API = '/api/apply/' + encodeURIComponent(T);
  const pdfUrl = API + '/application.pdf';
  $('pdfTop').href = pdfUrl;
  let D = null, f = null, step = 0, hasA2 = false, busy = false;

  const STEPS = [
    { id: 'applicants', t: 'About you' },
    { id: 'contact', t: 'Address & contact' },
    { id: 'bank', t: 'Bank details' },
    { id: 'loan', t: 'Home loan' },
    { id: 'review', t: 'Terms & declaration' },
  ];
  const sec = (id) => D.schema.sections.find((s) => s.id === id);

  function field(fd, path, v, ro) {
    const a = `data-p="${path}" ${ro ? 'disabled' : ''} ${fd.max ? `maxlength="${fd.max}"` : ''} ${fd.ph ? `placeholder="${esc(fd.ph)}"` : ''} ${fd.pattern ? `data-re="${esc(fd.pattern)}"` : ''} ${fd.req ? 'data-req="1"' : ''}`;
    const ctl = fd.type === 'select' ? `<select ${a}><option value="">Select…</option>${fd.options.map((o) => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`
      : fd.type === 'textarea' ? `<textarea ${a} rows="3">${esc(v)}</textarea>`
        : `<input type="${fd.type === 'date' ? 'date' : fd.type === 'email' ? 'email' : 'text'}" ${fd.digits || fd.type === 'money' ? 'inputmode="numeric"' : ''} ${a} value="${esc(v ?? '')}" ${fd.upper ? 'style="text-transform:uppercase"' : ''}>`;
    return `<div class="field" ${fd.showIf === 'loan' ? 'data-loan' : ''}><label>${esc(fd.label)}${fd.req ? ' <span class="req">*</span>' : ''}</label>${ctl}</div>`;
  }
  const get = (path) => path.split('.').reduce((o, k) => (o ? o[k] : ''), f);
  const set = (path, v) => { const ks = path.split('.'); let o = f; while (ks.length > 1) { const k = ks.shift(); o[k] = o[k] || {}; o = o[k]; } o[ks[0]] = v; };

  function body(id, ro) {
    if (id === 'review') {
      const S = D.schema;
      return `<div class="legal-box"><h3>Standard terms &amp; conditions</h3><ol class="legal">${S.terms.map((t) => `<li>${esc(t)}</li>`).join('')}</ol></div>
        <div class="legal-box"><h3>Cancellation policy</h3><ol class="legal">${S.cancellation.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>
          <div class="rera"><div class="over mb-12" style="color:var(--cu-d)">MahaRERA cancellation norms</div><table class="tbl"><thead><tr><th>Cancelled within</th><th>Deduction</th></tr></thead><tbody>${S.reraSlabs.map((r) => `<tr><td>${esc(r.when || r[0])}</td><td>${esc(r.deduction || r[1])}</td></tr>`).join('')}</tbody></table>
          <ul class="legal mt-12">${S.reraNorms.map((t) => `<li class="sm">${esc(t)}</li>`).join('')}</ul></div></div>
        <div class="legal-box"><h3>Customer declaration</h3><ol class="legal">${S.declaration.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>
          <label class="check mt-12" id="decl"><input type="checkbox" id="dc" ${f.declarationAccepted ? 'checked' : ''} ${ro ? 'disabled' : ''}><span><b>I/We have read and accept the terms, cancellation policy and declaration above.</b></span></label></div>`;
    }
    const s = sec(id);
    if (s.kind === 'pair') {
      const who = (w) => `<div class="ap-who">${w === 'a1' ? 'First applicant' : 'Second applicant'}</div>${s.fields.filter((fd) => !fd.only || fd.only === w).map((fd) => field(w === 'a2' && !(id === 'applicants' && fd.k === 'relationship') ? { ...fd, req: fd.req && id !== 'bank' } : fd, `${w}.${fd.k}`, get(`${w}.${fd.k}`) || (fd.def && w === 'a1' ? fd.def : ''), ro)).join('')}`;
      return `<div class="fgrid ap-grid">${who('a1')}</div>
        ${id === 'applicants' ? `<label class="check mt-16 mb-16"><input type="checkbox" id="a2t" ${hasA2 ? 'checked' : ''} ${ro ? 'disabled' : ''}><span>Add a second (joint) applicant</span></label>` : ''}
        ${hasA2 ? `<div class="fgrid ap-grid ap-a2">${who('a2')}</div>` : ''}
        ${(s.extra || []).map((fd) => field(fd, fd.k, get(fd.k), ro)).join('')}${s.note ? `<p class="xs muted">${esc(s.note)}</p>` : ''}`;
    }
    return `<div class="fgrid ap-grid">${s.fields.map((fd) => field(fd, fd.k, get(fd.k) || fd.def || '', ro)).join('')}</div>`;
  }

  function render() {
    const ro = D.locked;
    const e = D.enquiry;
    const done = !!D.submittedAt;
    $('app').innerHTML = `
      <section class="ap-head"><div class="over" style="color:var(--cu-l)">Booking application · ${esc(e.id)}</div><h1>${esc(e.name.split(' ')[0])}, let's complete your application</h1>
        <p>Fill in your details at your own pace — everything is saved as you go. Your relationship manager will add the flat, cost sheet and payment details.</p>
        ${D.unit ? `<div class="ap-unit"><div><span>Project</span><b>${esc(e.project)}</b></div><div><span>Unit</span><b>${esc(D.unit.tower)} · ${esc(D.unit.unit)}</b></div><div><span>Carpet</span><b>${esc(D.unit.carpet || '—')} sq ft</b></div><div><span>Total</span><b>${inr(D.unit.total)}</b></div></div>`
          : `<div class="ap-unit"><div><span>Project</span><b>${esc(e.project)}</b></div><div><span>Configuration</span><b>${esc(e.config)}</b></div></div>`}</section>
      <div class="ap-wrap">
        ${ro ? `<div class="banner info mb-16">${ic(I.lock)}<span>Your application is with the Mihir team now, so it can't be edited here. You can still print or download it below.</span></div>` : done ? `<div class="banner ok mb-16">${ic(I.ok)}<span>Submitted ${new Date(D.submittedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}. You can still make changes and submit again.</span></div>` : ''}
        <div class="ap-steps">${STEPS.map((s, i) => `<button class="${i === step ? 'on' : ''} ${i < step ? 'done' : ''}" data-i="${i}"><span class="n">${i < step ? '✓' : i + 1}</span><span class="t">${s.t}</span></button>`).join('')}</div>
        <div class="cp-form ap-card"><div class="over" style="color:var(--aqua-d)">Step ${step + 1} of ${STEPS.length}</div><h2 class="mb-16">${STEPS[step].t}</h2>
          <div id="errs"></div>${body(STEPS[step].id, ro)}
          <div class="row mt-16">${step ? `<button class="btn line lg" id="bk">${ic(I.back)} Back</button>` : ''}<span class="grow"></span>
            ${step < STEPS.length - 1 ? `<button class="btn lg" id="nx">${ro ? 'Next' : 'Save & continue'} ${ic(I.next)}</button>` : ro ? '' : `<button class="btn cu lg" id="sb">${ic(I.ok)} Submit application</button>`}</div></div>
        <div class="card p ap-print"><div class="row" style="flex-wrap:nowrap;align-items:flex-start"><span class="fi aq">${ic(I.print)}</span><div class="grow"><h3>Print or save a copy</h3><p class="sm muted">Your filled application (draft until signed), or the blank original form to fill by hand.</p></div></div>
          <div class="row mt-12"><a class="btn sm" target="_blank" rel="noopener" href="${pdfUrl}">${ic(I.print)} Print filled form</a><a class="btn line sm" href="${pdfUrl}?download=1">${ic(I.dl)} Download PDF</a><a class="btn ghost sm" target="_blank" rel="noopener" href="/forms/booking-application.pdf">${ic(I.doc)} Blank form</a></div></div>
        ${D.rm ? `<div class="cp-rm"><img src="${esc(D.rm.photoUrl || '/assets/mark.png')}" alt=""><div class="grow"><div class="over" style="color:var(--cu-d)">Questions? Your relationship manager</div><b>${esc(D.rm.name)}</b><div class="sm muted">${esc(D.rm.designation)}</div></div><a class="btn wa sm" href="https://wa.me/${esc(D.rm.phone)}?text=${encodeURIComponent(`Hi ${D.rm.name.split(' ')[0]}, I have a question about my booking application ${e.id}.`)}">WhatsApp</a></div>` : ''}
      </div>`;
    bind(ro);
  }

  function grab() {
    document.querySelectorAll('[data-p]').forEach((el) => {
      let v = el.value;
      const fd = el;
      if (fd.getAttribute('maxlength') && el.inputMode === 'numeric') v = v.replace(/\D/g, '');
      set(el.dataset.p, el.style.textTransform === 'uppercase' ? v.toUpperCase().trim() : v.trim());
    });
    const dc = $('dc'); if (dc) f.declarationAccepted = dc.checked;
    if (!hasA2) f.a2 = {};
  }
  function check() {
    let bad = 0;
    document.querySelectorAll('[data-p]').forEach((el) => {
      const v = el.value.trim(); const field = el.closest('.field'); if (field && field.hasAttribute('data-loan') && field.style.display === 'none') return;
      const wrong = (el.dataset.req && !v) || (v && el.dataset.re && !new RegExp(el.dataset.re).test(el.style.textTransform === 'uppercase' ? v.toUpperCase() : v.replace(/\s/g, '')));
      el.classList.toggle('bad', !!wrong); if (wrong) bad++;
    });
    if (STEPS[step].id === 'review' && !$('dc').checked) { bad++; $('decl').classList.add('bad-t'); }
    return bad;
  }
  function bind(ro) {
    document.querySelectorAll('.ap-steps button').forEach((b) => (b.onclick = async () => { const i = Number(b.dataset.i); if (i === step) return; if (!ro) { grab(); await save(false, true); } step = i; render(); top(); }));
    const loanShow = () => document.querySelectorAll('[data-loan]').forEach((x) => (x.style.display = (get('funding') || 'Self-Funded') === 'Self-Funded' ? 'none' : ''));
    const fund = document.querySelector('[data-p="funding"]'); if (fund) fund.onchange = () => { set('funding', fund.value); loanShow(); }; loanShow();
    document.querySelectorAll('[data-p]').forEach((el) => (el.oninput = () => el.classList.remove('bad')));
    const a2t = $('a2t'); if (a2t) a2t.onchange = () => { grab(); hasA2 = a2t.checked; render(); };
    if ($('bk')) $('bk').onclick = async () => { if (!ro) { grab(); await save(false, true); } step--; render(); top(); };
    if ($('nx')) $('nx').onclick = async () => {
      if (!ro) { grab(); if (check()) return toast('Please check the highlighted fields', true); if (!(await save(false))) return; }
      step++; render(); top();
    };
    if ($('sb')) $('sb').onclick = async () => { grab(); if (check()) return toast('Please accept the declaration to submit', true); if (await save(true)) { D.submittedAt = new Date().toISOString(); success(); } };
  }
  const top = () => window.scrollTo({ top: document.querySelector('.ap-wrap').offsetTop - 70, behavior: 'smooth' });

  async function save(submit, quiet) {
    if (busy) return false; busy = true;
    try {
      const r = await fetch(API, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ form: f, submit }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (j.errors && j.errors.length) $('errs').innerHTML = `<div class="banner warn mb-16"><span><b>${esc(j.error)}</b><br>${j.errors.map(esc).join('<br>')}</span></div>`;
        throw new Error(j.error || 'Could not save');
      }
      if (!quiet && !submit) toast('Saved');
      return true;
    } catch (e) { if (!quiet) toast(e.message, true); return false; } finally { busy = false; }
  }

  function success() {
    $('app').querySelector('.ap-card').outerHTML = `<div class="cp-form ap-card" style="text-align:center"><div class="okc">${ic(I.ok)}</div><h2>Application submitted</h2>
      <p class="sub" style="margin:6px auto 18px;max-width:420px">Thank you! ${D.rm ? esc(D.rm.name.split(' ')[0]) : 'Your relationship manager'} will review it, add the flat and cost details, and meet you for the payment and signatures.</p>
      <div class="row" style="justify-content:center"><a class="btn lg" target="_blank" rel="noopener" href="${pdfUrl}">${ic(I.print)} Print my application</a><a class="btn line lg" href="${pdfUrl}?download=1">${ic(I.dl)} Download PDF</a></div>
      <button class="lnk mt-16" id="edit">Make changes</button></div>`;
    document.querySelector('.ap-steps').style.display = 'none';
    $('edit').onclick = () => { step = 0; render(); top(); };
    top();
  }

  if (!T) { $('app').innerHTML = '<div class="cp-form"><h2>Link incomplete</h2><p class="sub">Please open the full link your relationship manager sent you.</p></div>'; return; }
  fetch(API).then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'This link is not valid.'); return j; })
    .then((j) => { D = j; f = j.form; f.a1 = f.a1 || {}; f.a2 = f.a2 || {}; hasA2 = !!f.a2.name; render(); })
    .catch((e) => { $('app').innerHTML = `<div class="ap-wrap" style="padding-top:30px"><div class="cp-form"><h2>We couldn't open this application</h2><p class="sub">${esc(e.message)}</p><a class="btn line" href="/forms/booking-application.pdf" target="_blank" rel="noopener">${ic(I.doc)} Blank booking form</a></div></div>`; });
})();
