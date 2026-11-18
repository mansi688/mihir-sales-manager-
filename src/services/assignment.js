/**
 * Who gets the walk-in?
 *  1. Repeat customer (same mobile)  → original owner, if still active.
 *  2. Channel-partner lead           → the CP's owner, if one is set and they're not Off.
 *  3. Otherwise                      → Available sales people on that project, fewest walk-ins today.
 *  4. Nobody free on the project     → any Available sales person, fewest today.
 *  5. Everyone busy                  → least-loaded sales person who is not Off (reception sees a warning).
 * Reception / manager can always reassign (logged with a reason).
 */
const { all, one } = require('../db');
const { todayStartUtc } = require('../util');

async function assign({ mobile, projectId, cpName }) {
  const prev = await one(`SELECT e.assigned_to id FROM enquiries e JOIN users u ON u.id=e.assigned_to
      WHERE e.mobile=? AND u.active ORDER BY e.created_at ASC LIMIT 1`, mobile);
  if (prev) return { userId: prev.id, reason: 'Repeat customer — original owner', repeat: true };

  if (cpName) {
    const cp = await one(`SELECT u.id FROM channel_partners c JOIN users u ON u.id=c.owner_user_id
        WHERE lower(c.name)=lower(?) AND u.active AND u.status<>'Off'`, cpName.trim());
    if (cp) return { userId: cp.id, reason: `Channel partner ${cpName.trim()} — CP owner` };
  }

  // Candidates with today's load and last assignment time, best first.
  const pool = await all(`SELECT u.id, u.status,
        EXISTS(SELECT 1 FROM user_projects up WHERE up.user_id=u.id AND up.project_id=?) on_project,
        (SELECT count(*)::int FROM enquiries e WHERE e.assigned_to=u.id AND e.created_at>=?) today,
        (SELECT max(created_at) FROM enquiries e WHERE e.assigned_to=u.id) last_at
      FROM users u WHERE u.role='sales' AND u.active AND u.status<>'Off'
      ORDER BY today ASC, last_at ASC NULLS FIRST, u.id`, projectId, todayStartUtc());

  let u = pool.find((x) => x.status === 'Available' && x.on_project);
  if (u) return { userId: u.id, reason: 'Round-robin: available on project, fewest walk-ins today' };
  u = pool.find((x) => x.status === 'Available');
  if (u) return { userId: u.id, reason: 'Nobody free on project — next available' };
  if (pool[0]) return { userId: pool[0].id, reason: 'Everyone busy — least loaded', busy: true };
  return { userId: null, reason: 'No sales person on duty — reception to assign', busy: true };
}

module.exports = { assign };
