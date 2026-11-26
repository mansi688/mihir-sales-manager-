/**
 * Quotation (cost sheet) maths — shared by the API (authoritative) and mirrored in the app for live preview.
 * All rates are editable per quotation; defaults follow common Maharashtra practice and must be confirmed by Accounts.
 */
const DEFAULTS = {
  rate: 0,                 // ₹ per sq ft of RERA carpet area
  floorRise: 0,            // ₹ per sq ft per floor above the first
  plc: 0,                  // preferential location charge (lump sum)
  parking: 0,              // covered parking (lump sum)
  otherCharges: 0,         // outside agreement value: maintenance deposit, legal, society formation…
  gstPct: 5,               // under-construction residential (non-affordable)
  stampPct: 6,             // Pune urban: 5% + 1% metro cess (1% concession for women buyers)
  regPct: 1, regCap: 30000, // registration: 1% capped at ₹30,000
  validDays: 15,
};

const n = (v) => { const x = Number(String(v ?? '').replace(/[^\d.]/g, '')); return Number.isFinite(x) ? x : 0; };
const round = (v, to = 1) => Math.round(v / to) * to;

function compute(input) {
  const d = { ...DEFAULTS };
  for (const k of Object.keys(DEFAULTS)) if (input[k] !== undefined && input[k] !== '') d[k] = n(input[k]);
  const carpet = n(input.carpet); const floor = Math.max(0, Math.floor(n(input.floor)));
  const base = round(carpet * d.rate);
  const floorRise = round(carpet * d.floorRise * Math.max(0, floor - 1));
  const agreement = base + floorRise + d.plc + d.parking;
  const gst = round((agreement * d.gstPct) / 100);
  const stamp = round((agreement * d.stampPct) / 100, 100);
  const reg = Math.min(round((agreement * d.regPct) / 100), d.regCap);
  const total = agreement + gst + stamp + reg + d.otherCharges;
  return {
    inputs: { ...d, carpet, floor },
    lines: [
      { k: 'base', label: `Basic cost (${carpet} sq ft × Rs. ${d.rate.toLocaleString('en-IN')})`, amount: base, group: 'agreement' },
      ...(floorRise ? [{ k: 'floorRise', label: `Floor rise (floor ${floor})`, amount: floorRise, group: 'agreement' }] : []),
      ...(d.plc ? [{ k: 'plc', label: 'Preferential location charge', amount: d.plc, group: 'agreement' }] : []),
      ...(d.parking ? [{ k: 'parking', label: 'Covered parking', amount: d.parking, group: 'agreement' }] : []),
      { k: 'gst', label: `GST @ ${d.gstPct}%`, amount: gst, group: 'govt' },
      { k: 'stamp', label: `Stamp duty @ ${d.stampPct}%`, amount: stamp, group: 'govt' },
      { k: 'reg', label: `Registration @ ${d.regPct}% (max Rs. ${d.regCap.toLocaleString('en-IN')})`, amount: reg, group: 'govt' },
      ...(d.otherCharges ? [{ k: 'other', label: 'Other charges (maintenance, legal, society)', amount: d.otherCharges, group: 'other' }] : []),
    ],
    agreement, gst, stamp, reg, total,
    bookingAmount: round(agreement * 0.1), // RERA: max 10% before agreement
  };
}

module.exports = { DEFAULTS, compute };
