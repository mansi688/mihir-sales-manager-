/* Landing page: projects from the CRM, WhatsApp link, scroll reveal, nav state. */
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  $('yr').textContent = '© ' + new Date().getFullYear();

  const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12 }) : null;
  const watch = (root = document) => root.querySelectorAll('.reveal:not(.in)').forEach((el) => (io ? io.observe(el) : el.classList.add('in')));
  watch();

  const nav = $('nav');
  const onScroll = () => nav.classList.toggle('solid', window.scrollY > 40);
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  fetch('/api/public/config').then((r) => r.json()).then((c) => {
    $('nProj').textContent = c.projects.length;
    $('waBtn').href = `https://wa.me/${c.org.whatsapp}?text=${encodeURIComponent(`Hi ${c.org.name}, I'd like to know more about your projects.`)}`;
    $('proj').innerHTML = c.projects.map((p, i) => `<a class="pc reveal" style="transition-delay:${i * 0.06}s" href="/enquire/?p=${encodeURIComponent(p.id)}">
        <div class="art"><span class="tag">${esc(p.project_type === 'commercial' ? 'Commercial' : 'Residential')}</span><b>${esc(p.name)}</b></div>
        <div class="bd"><span>${esc((p.configs || []).join(' · '))}</span><span class="go">Enquire →</span></div></a>`).join('');
    watch($('proj'));
  }).catch(() => { $('proj').innerHTML = '<p class="muted">Projects will appear here shortly.</p>'; });
})();
