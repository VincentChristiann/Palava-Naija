/* Shared by the payment check and the Paystack webhook.
   Environment variables (Vercel > Project > Settings > Environment Variables):
     PAYSTACK_SECRET_KEY       sk_live_... (or sk_test_... while testing)
     FIREBASE_SERVICE_ACCOUNT  the whole service-account JSON from Firebase > Project settings > Service accounts
     FIREBASE_DATABASE_ID      the Firestore database name; this project uses "default"            */
const CATALOG = require('./_catalog');

let _admin = null;
function admin() {
  if (_admin) return _admin;
  const { initializeApp, getApps, cert } = require('firebase-admin/app');
  const { getFirestore, FieldValue } = require('firebase-admin/firestore');
  const { getAuth } = require('firebase-admin/auth');
  const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  _admin = { db: getFirestore(app, process.env.FIREBASE_DATABASE_ID || '(default)'), auth: getAuth(app), FieldValue };
  return _admin;
}

/* ask Paystack about a payment. Never trust the browser's word for it. */
async function paystackLookup(reference) {
  const r = await fetch('https://api.paystack.co/transaction/verify/' + encodeURIComponent(reference), {
    headers: { Authorization: 'Bearer ' + process.env.PAYSTACK_SECRET_KEY }
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.status || !j.data) throw new Error('paystack: ' + (j.message || r.status));
  return j.data;
}

function meta(tx) {
  let m = tx.metadata || {};
  if (typeof m === 'string') { try { m = JSON.parse(m); } catch (e) { m = {}; } }
  return m;
}

/* check a Paystack transaction and, once only, give the player what they paid for */
async function grant(tx, wantUid) {
  const m = meta(tx), product = CATALOG[m.product];
  if (tx.status !== 'success') return { ok: false, error: 'Payment not successful (' + tx.status + ')' };
  if (tx.currency !== 'NGN') return { ok: false, error: 'Wrong currency' };
  if (!product) return { ok: false, error: 'Unknown item' };
  if (Number(tx.amount) !== product.naira * 100) return { ok: false, error: 'Amount does not match the price' };
  if (!m.uid || (wantUid && m.uid !== wantUid)) return { ok: false, error: 'This payment belongs to another player' };
  const { db, FieldValue } = admin();
  const payRef = db.collection('purchases').doc(String(tx.reference));
  const entRef = db.collection('entitlements').doc(m.uid);
  await db.runTransaction(async t => {
    const [p, e] = await Promise.all([t.get(payRef), t.get(entRef)]);
    if (p.exists) return;                                                          // already given: webhook and check can both arrive
    const now = Date.now(), cur = e.exists ? e.data() : {};
    const g = { ref: String(tx.reference), product: m.product, ts: now };
    const upd = { grants: FieldValue.arrayUnion(g), updated: now };
    if (product.eko) g.eko = product.eko;
    if (product.days) { g.days = product.days; upd.passUntil = Math.max(now, cur.passUntil || 0) + product.days * 864e5; }
    t.set(payRef, { uid: m.uid, product: m.product, naira: product.naira, paystackId: tx.id || null, channel: tx.channel || null, paidAt: tx.paid_at || null, ts: now });
    t.set(entRef, upd, { merge: true });
  });
  const e = await entRef.get();
  return { ok: true, ent: e.exists ? e.data() : {} };
}

module.exports = { admin, paystackLookup, grant, CATALOG, _setAdmin: a => { _admin = a; } };   // _setAdmin: for tests only
