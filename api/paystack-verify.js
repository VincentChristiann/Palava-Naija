/* POST /api/paystack-verify  { reference }   Authorization: Bearer <Firebase ID token>
   Called by the game right after the Paystack window says "paid". */
const { admin, paystackLookup, grant } = require('./_lib');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  try {
    const tok = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!tok) return res.status(401).json({ ok: false, error: 'Sign in first' });
    let user; try { user = await admin().auth.verifyIdToken(tok); } catch (e) { return res.status(401).json({ ok: false, error: 'Sign in again' }); }
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const reference = String(body.reference || '');
    if (!/^[A-Za-z0-9_.=-]{6,100}$/.test(reference)) return res.status(400).json({ ok: false, error: 'Bad reference' });
    const tx = await paystackLookup(reference);
    const out = await grant(tx, user.uid);
    return res.status(out.ok ? 200 : 402).json(out);
  } catch (e) {
    console.error('verify', e);
    return res.status(500).json({ ok: false, error: 'Could not confirm the payment yet' });
  }
};
