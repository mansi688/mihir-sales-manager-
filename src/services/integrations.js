/**
 * Connections to the rest of Mihir's systems.
 *
 * CRM (CRM_MODE=supabase, default): the CRM lives in the same Supabase database, so each walk-in is
 *   written into public.enquiries (page = 'sales-portal'). The CRM's own triggers notify its managers.
 *   Status mapping: Walk-in → new · Attending…Signatures → contacted · Booked/Lost → closed.
 *   Notes carry the portal ID, stage and owner so CRM staff can see where the sale is.
 * Inventory: real units from public.projects/towers/wings/flats; hold/sold kept in sales.unit_status.
 * Accounts (INTERNAL_MODE): mock = log only; rest = POST receipts to INTERNAL_BASE_URL.
 * Every call is written to sync_log (Outbox & sync page).
 */
const config = require('../config');
const { all, one, run } = require('../db');

const log = (enquiryId, target, action, payload, status, response) =>
  run('INSERT INTO sync_log(enquiry_id,target,action,payload,status,response) VALUES(?,?,?,?::jsonb,?,?)',
    enquiryId || null, target, action, JSON.stringify(payload || {}), status, typeof response === 'string' ? response : JSON.stringify(response ?? {}));

async function guarded(target, enquiryId, action, payload, fn) {
  try { const r = await fn(); await log(enquiryId, target, action, payload, 'ok', r || {}); return r || {}; }
  catch (err) { await log(enquiryId, target, action, payload, 'failed', String(err.message || err)); console.error(`[${target}] ${action}:`, err.message); return { error: err.message }; }
}

/* ---------------- CRM ---------------- */
const crmStatus = (stage) => (stage === 'Walk-in' ? 'new' : ['Booked', 'Lost'].includes(stage) ? 'closed' : 'contacted');

async function crmNotes(enquiryId) {
  const e = await one('SELECT e.id, e.stage, u.name owner FROM enquiries e LEFT JOIN users u ON u.id=e.assigned_to WHERE e.id=?', enquiryId);
  const b = await one('SELECT unit FROM bookings WHERE enquiry_id=?', enquiryId);
  const acts = await all("SELECT at, note FROM activities WHERE enquiry_id=? AND type IN ('site_visit','note','booking_form','payment_verified','approved','lost') ORDER BY id DESC LIMIT 5", enquiryId);
  return [`Sales portal ${e.id} · Stage: ${e.stage} · Owner: ${e.owner || 'Unassigned'}${b ? ' · Unit: ' + b.unit : ''}`,
    ...acts.map((a) => `- ${new Date(a.at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}: ${a.note}`)].join('\n').slice(0, 4000);
}

const crm = {
  async upsertLead(e) {
    const payload = { enquiry: e.id };
    if (config.crm.mode !== 'supabase') { await log(e.id, 'crm', 'upsertLead', payload, 'mock', {}); return {}; }
    return guarded('crm', e.id, 'upsertLead', payload, async () => {
      const msg = `Walk-in at sales lounge (${e.id}). ${e.config}, budget ${e.budget}, ${e.purpose || 'purpose n/a'}. Source: ${e.source}${e.cp_name ? ' (' + e.cp_name + ')' : ''}. Residence: ${e.residence || '—'}. Visit: ${e.visit_pref || '—'}.`;
      let id = e.crm_enquiry_id;
      if (!id) {
        const r = await one(`INSERT INTO public.enquiries(name, phone, email, project_id, message, page) VALUES(?,?,?,?,?,'sales-portal') RETURNING id`,
          e.name.slice(0, 120), '+91 ' + e.mobile, /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e.email || '') ? e.email : null, e.project_id, msg.slice(0, 2000));
        id = r.id;
        await run('UPDATE enquiries SET crm_enquiry_id=? WHERE id=?', id, e.id);
      }
      await run('UPDATE public.enquiries SET status=?, notes=? WHERE id=?', crmStatus(e.stage), await crmNotes(e.id), id);
      return { crmEnquiryId: id };
    });
  },
  /** Push the current stage/owner/notes to the CRM row. */
  async sync(enquiryId, action = 'update') {
    const e = await one('SELECT * FROM enquiries WHERE id=?', enquiryId);
    if (!e) return {};
    if (config.crm.mode !== 'supabase') { await log(e.id, 'crm', action, { stage: e.stage }, 'mock', {}); return {}; }
    if (!e.crm_enquiry_id) return crm.upsertLead(e);
    return guarded('crm', e.id, action, { stage: e.stage, status: crmStatus(e.stage) }, async () => {
      await run('UPDATE public.enquiries SET status=?, notes=? WHERE id=?', crmStatus(e.stage), await crmNotes(e.id), e.crm_enquiry_id);
      return { status: crmStatus(e.stage) };
    });
  },
};

/* ---------------- Inventory (CRM flats) ---------------- */
const inventory = {
  async projectUnits(projectId) {
    return all(`SELECT f.id, f.flat_no, f.floor, f.flat_type, f.carpet_area, t.name tower, w.name wing,
          CASE WHEN us.status='Sold' THEN 'Sold' WHEN us.status='On hold' AND us.hold_until>now() THEN 'On hold' ELSE 'Available' END status,
          CASE WHEN us.hold_until>now() OR us.status='Sold' THEN us.enquiry_id END held_by
        FROM public.flats f JOIN public.wings w ON w.id=f.wing_id JOIN public.towers t ON t.id=w.tower_id
        LEFT JOIN unit_status us ON us.flat_id=f.id
        WHERE t.project_id=? ORDER BY t.sort_order, t.name, w.sort_order, w.name, f.floor NULLS FIRST, f.flat_no`, projectId);
  },
  getUnit: (flatId) => one(`SELECT f.*, t.name tower, w.name wing, t.project_id FROM public.flats f
      JOIN public.wings w ON w.id=f.wing_id JOIN public.towers t ON t.id=w.tower_id WHERE f.id=?`, flatId),
  /** Atomically hold a flat for an enquiry. Returns false if someone else holds it or it is sold. */
  async hold(flatId, enquiryId, hours) {
    const r = await one(`INSERT INTO unit_status(flat_id,status,enquiry_id,hold_until,updated_at)
        VALUES(?,'On hold',?,now() + (? || ' hours')::interval, now())
        ON CONFLICT (flat_id) DO UPDATE SET status='On hold', enquiry_id=excluded.enquiry_id, hold_until=excluded.hold_until, updated_at=now()
        WHERE unit_status.status<>'Sold' AND (unit_status.enquiry_id=excluded.enquiry_id OR unit_status.hold_until<now() OR unit_status.enquiry_id IS NULL)
        RETURNING hold_until`, flatId, enquiryId, String(hours));
    await log(enquiryId, 'inventory', 'holdUnit', { flatId, hours }, r ? 'ok' : 'refused', r ? { holdUntil: r.hold_until } : 'Unit not available');
    return r ? r.hold_until : null;
  },
  async release(flatId, enquiryId) {
    await run("DELETE FROM unit_status WHERE flat_id=? AND enquiry_id=? AND status='On hold'", flatId, enquiryId);
    await log(enquiryId, 'inventory', 'releaseUnit', { flatId }, 'ok', {});
  },
  async markSold(flatId, enquiryId) {
    await run(`INSERT INTO unit_status(flat_id,status,enquiry_id,hold_until,updated_at) VALUES(?,'Sold',?,NULL,now())
        ON CONFLICT (flat_id) DO UPDATE SET status='Sold', enquiry_id=excluded.enquiry_id, hold_until=NULL, updated_at=now()`, flatId, enquiryId);
    await log(enquiryId, 'inventory', 'markSold', { flatId }, 'ok', {});
  },
};

/* ---------------- Accounts (internal portal) ---------------- */
const accounts = {
  async submitReceipt(enquiryId, p) {
    const payload = { ref: enquiryId, paymentId: p.id, amount: p.amount, mode: p.mode, utrOrCheque: p.ref };
    if (config.internal.mode !== 'rest') { await log(enquiryId, 'accounts', 'submitReceipt', payload, 'mock', { queued: true }); return {}; }
    return guarded('accounts', enquiryId, 'submitReceipt', payload, async () => {
      const r = await fetch(config.internal.baseUrl.replace(/\/$/, '') + '/accounts/receipts', {
        method: 'POST', headers: { Authorization: `Bearer ${config.internal.apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(`${r.status} ${JSON.stringify(j)}`);
      return j;
    });
  },
};

module.exports = { crm, inventory, accounts, log };
