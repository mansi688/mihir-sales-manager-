/* Mihir e-visiting card — one design for every sales person.
 * MihirCard.html(data)        → flip card markup (front + back) for the app and the public card page
 * MihirCard.share(data)       → renders both sides to a PNG and opens the phone's share sheet (WhatsApp etc.),
 *                               or downloads the image on desktop
 * data: { name, designation, phone, email, website, tagline, photoUrl, cardUrl, qrUrl }
 */
(function () {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ph = (p) => { const d = String(p || '').replace(/\D/g, ''); return d.length === 12 && d.startsWith('91') ? `+91 ${d.slice(2, 7)} ${d.slice(7)}` : '+' + d; };
  const svg = (p) => `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const I = {
    phone: svg('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>'),
    mail: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'),
    web: svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'),
  };

  function html(d) {
    return `<div class="vcard3d" tabindex="0" role="button" aria-label="Flip visiting card"><div class="vc-inner">
      <div class="vc-face vc-front">
        <div class="vc-orb a"></div><div class="vc-orb b"></div>
        <div class="vc-top"><img class="vc-logo" src="/assets/logo-light.png" alt="Mihir"><div class="vc-photo"><img src="${esc(d.photoUrl || '/assets/mark.png')}" alt=""></div></div>
        <div class="vc-id"><div class="vc-name">${esc(d.name)}</div><div class="vc-role">${esc(d.designation)}</div></div>
        <div class="vc-ct"><span>${I.phone}${esc(ph(d.phone))}</span><span>${I.mail}${esc(d.email)}</span><span>${I.web}${esc(d.website)}</span></div>
        <div class="vc-bar"></div>
      </div>
      <div class="vc-face vc-back">
        <img class="vc-mark" src="/assets/logo.png" alt="Mihir">
        <div class="vc-qr"><img src="${esc(d.qrUrl)}" alt="QR code"><span>Scan to save my contact</span></div>
        <div class="vc-tag">${esc(d.tagline)}</div><div class="vc-bar"></div>
      </div></div><div class="vc-hint">Tap to flip</div></div>`;
  }

  function bind(root) {
    root.querySelectorAll('.vcard3d').forEach((c) => {
      const flip = () => c.classList.toggle('flipped');
      c.onclick = flip; c.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } };
    });
  }

  /* ---------- PNG export (both sides stacked) ---------- */
  const load = (src) => new Promise((res) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

  async function render(d) {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const W = 1050, H = 600, GAP = 40, PAD = 50;
    const c = document.createElement('canvas'); c.width = W + PAD * 2; c.height = H * 2 + GAP + PAD * 2;
    const g = c.getContext('2d');
    g.fillStyle = '#F6F3EE'; g.fillRect(0, 0, c.width, c.height);
    const [logoL, logo, photo, qr] = await Promise.all([load('/assets/logo-light.png'), load('/assets/logo.png'), load(d.photoUrl || '/assets/mark.png'), load(d.qrUrl)]);
    const copper = g.createLinearGradient(0, 0, W, 0); copper.addColorStop(0, '#DFAA78'); copper.addColorStop(0.5, '#C4895A'); copper.addColorStop(1, '#A86F48');

    // front
    let ox = PAD, oy = PAD;
    g.save(); rr(g, ox, oy, W, H, 34); g.clip();
    const bg = g.createLinearGradient(ox, oy, ox + W, oy + H); bg.addColorStop(0, '#2E3560'); bg.addColorStop(1, '#171A33'); g.fillStyle = bg; g.fillRect(ox, oy, W, H);
    g.strokeStyle = 'rgba(196,137,90,.45)'; g.lineWidth = 3; g.beginPath(); g.arc(ox + W - 40, oy + H + 60, 330, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = 'rgba(196,137,90,.25)'; g.beginPath(); g.arc(ox + W - 40, oy + H + 60, 220, 0, Math.PI * 2); g.stroke();
    if (logoL) g.drawImage(logoL, ox + 60, oy + 50, (logoL.width / logoL.height) * 120, 120);
    if (photo) { g.save(); g.beginPath(); g.arc(ox + W - 140, oy + 130, 82, 0, Math.PI * 2); g.clip(); const s = Math.max(164 / photo.width, 164 / photo.height); g.drawImage(photo, ox + W - 140 - (photo.width * s) / 2, oy + 130 - (photo.height * s) / 2, photo.width * s, photo.height * s); g.restore(); }
    g.strokeStyle = copper; g.lineWidth = 6; g.beginPath(); g.arc(ox + W - 140, oy + 130, 85, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#fff'; g.font = '800 58px Montserrat, Inter, sans-serif'; g.fillText(d.name, ox + 60, oy + 300);
    g.fillStyle = '#EBD3BE'; g.font = '700 23px Inter, sans-serif'; g.fillText(String(d.designation || '').toUpperCase().split('').join(String.fromCharCode(8202)), ox + 62, oy + 342);
    g.fillStyle = '#E3E6F2'; g.font = '500 26px Inter, sans-serif';
    [ph(d.phone), d.email, d.website].forEach((t, i) => { g.fillStyle = '#C4895A'; g.beginPath(); g.arc(ox + 70, oy + 413 + i * 46, 6, 0, Math.PI * 2); g.fill(); g.fillStyle = '#E3E6F2'; g.fillText(t, ox + 92, oy + 422 + i * 46); });
    g.fillStyle = copper; g.fillRect(ox, oy + H - 12, W, 12);
    g.restore();

    // back
    oy = PAD + H + GAP;
    g.save(); rr(g, ox, oy, W, H, 34); g.clip();
    g.fillStyle = '#FFFFFF'; g.fillRect(ox, oy, W, H);
    g.strokeStyle = 'rgba(196,137,90,.35)'; g.lineWidth = 3; g.beginPath(); g.arc(ox + 40, oy - 60, 300, 0, Math.PI * 2); g.stroke();
    if (logo) g.drawImage(logo, ox + 70, oy + (H - 300) / 2, (logo.width / logo.height) * 300, 300);
    if (qr) { g.fillStyle = '#F6F3EE'; rr(g, ox + W - 410, oy + 90, 340, 380, 26); g.fill(); g.drawImage(qr, ox + W - 380, oy + 115, 280, 280); }
    g.fillStyle = '#343A5E'; g.font = '600 22px Inter, sans-serif'; g.textAlign = 'center'; g.fillText('Scan to save my contact', ox + W - 240, oy + 440);
    g.fillStyle = '#A86F48'; g.font = 'italic 500 24px Inter, sans-serif'; g.textAlign = 'left'; g.fillText(d.tagline || '', ox + 70, oy + H - 60);
    g.fillStyle = copper; g.fillRect(ox, oy + H - 12, W, 12);
    g.restore();
    return c;
  }

  async function share(d) {
    const canvas = await render(d);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
    const file = new File([blob], `${String(d.name).replace(/\s+/g, '-')}-Mihir-card.png`, { type: 'image/png' });
    const text = `${d.name} · ${d.designation}, Mihir Group\n${ph(d.phone)} · ${d.email}\n${d.cardUrl}`;
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: `${d.name} — Mihir Group`, text }); return 'shared'; } catch (e) { if (e.name === 'AbortError') return 'cancelled'; }
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    return 'downloaded';
  }

  window.MihirCard = { html, bind, share, render };
})();
