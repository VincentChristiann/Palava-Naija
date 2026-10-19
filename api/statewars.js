/* POST /api/statewars   Authorization: Bearer <Firebase ID token>
   body: { home, played, dist, time, mode }
   Adds one run's points to the player's state for this week. The browser never
   writes the totals itself: this function checks the run and caps what it can add.

   Firestore layout (week = Lagos-time ISO week, e.g. "2026w42"):
     statewars/{week}                 { total, runs, updated }
     statewars/{week}/states/{state}  { pts, runs, players, top: [{uid,name,pts}], updated }
     statewars/{week}/players/{uid}   { state, name, pts, runs, lastTs, day, dayPts }      */
const { admin } = require('./_lib');

const STATES = ['lagos', 'ph', 'abuja', 'kano', 'enugu', 'ibadan', 'calabar', 'benin', 'jos', 'warri', 'owerri', 'onitsha', 'kaduna', 'abeokuta', 'uyo', 'ilorin', 'maiduguri', 'katsina', 'sokoto', 'dutse', 'minna', 'makurdi', 'ado', 'aba', 'abakaliki', 'yenagoa', 'akure', 'osogbo', 'lokoja', 'lafia', 'kebbi', 'gusau', 'yola', 'bauchi', 'gombe', 'jalingo', 'damaturu'];
const RULES = {
  perRun: 600,        // most points one run can add (before the home-state bonus)
  homeBonus: 1.5,     // running in your own state counts more
  perDay: 9000,       // most one player can add in a day
  gapMs: 20000,       // at least 20 s between two runs
  maxSpeed: 34,       // m/s: faster than the game's top speed means the numbers are made up
  minTime: 8, maxTime: 3600
};

const p2 = n => String(n).padStart(2, '0');
function lagosNow() { return new Date(Date.now() + 3600e3); }             // WAT, UTC+1, no daylight saving
function dayKey(d = lagosNow()) { return d.getUTCFullYear() + p2(d.getUTCMonth() + 1) + p2(d.getUTCDate()); }
function weekKey(d = lagosNow()) {                                          // the same ISO week the game uses
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())), wd = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - wd);
  const wk = Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7);
  return t.getUTCFullYear() + 'w' + p2(wk);
}
function pointsFor(dist, home, played) {
  const base = Math.min(RULES.perRun, Math.floor(dist / 10));
  return Math.round(base * (home === played ? RULES.homeBonus : 1));
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  try {
    const tok = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!tok) return res.status(401).json({ ok: false, error: 'Sign in first' });
    let user; try { user = await admin().auth.verifyIdToken(tok); } catch (e) { return res.status(401).json({ ok: false, error: 'Sign in again' }); }
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const home = String(b.home || ''), played = String(b.played || ''), dist = Number(b.dist), time = Number(b.time);
    if (!STATES.includes(home) || !STATES.includes(played)) return res.status(400).json({ ok: false, error: 'Unknown state' });
    if (!(dist >= 0) || !(time >= RULES.minTime) || time > RULES.maxTime) return res.status(400).json({ ok: false, error: 'Run too short' });
    if (dist > time * RULES.maxSpeed) return res.status(400).json({ ok: false, error: 'That run does not add up' });

    const { db, FieldValue } = admin(), week = weekKey(), day = dayKey(), now = Date.now();
    const name = String(b.name || user.name || 'Runner').replace(/[<>]/g, '').slice(0, 16);
    const wRef = db.collection('statewars').doc(week), pRef = wRef.collection('players').doc(user.uid);
    const out = await db.runTransaction(async t => {
      const p = await t.get(pRef), pd = p.exists ? p.data() : null;
      if (pd && now - (pd.lastTs || 0) < RULES.gapMs) return { ok: false, error: 'Too fast · wait a little' };
      const team = pd ? pd.state : home;                                    // your state is fixed for the week once you score
      let pts = pointsFor(dist, team, played);
      const dayPts = pd && pd.day === day ? pd.dayPts || 0 : 0;
      pts = Math.max(0, Math.min(pts, RULES.perDay - dayPts));
      const sRef = wRef.collection('states').doc(team), s = await t.get(sRef), sd = s.exists ? s.data() : { pts: 0, runs: 0, players: 0, top: [] };
      const mine = (pd ? pd.pts || 0 : 0) + pts;
      const top = (sd.top || []).filter(r => r.uid !== user.uid); top.push({ uid: user.uid, name, pts: mine }); top.sort((a, c) => c.pts - a.pts);
      t.set(pRef, { state: team, name, pts: mine, runs: (pd ? pd.runs || 0 : 0) + 1, lastTs: now, day, dayPts: dayPts + pts }, { merge: true });
      t.set(sRef, { pts: (sd.pts || 0) + pts, runs: (sd.runs || 0) + 1, players: (sd.players || 0) + (pd ? 0 : 1), top: top.slice(0, 5), updated: now }, { merge: true });
      t.set(wRef, { total: FieldValue.increment(pts), runs: FieldValue.increment(1), updated: now }, { merge: true });
      return { ok: true, week, team, pts, mine, statePts: (sd.pts || 0) + pts, capped: dayPts + pts >= RULES.perDay };
    });
    return res.status(out.ok ? 200 : 429).json(out);
  } catch (e) {
    console.error('statewars', e);
    return res.status(500).json({ ok: false, error: 'State Wars is not available right now' });
  }
};
module.exports.weekKey = weekKey; module.exports.pointsFor = pointsFor; module.exports.RULES = RULES;
