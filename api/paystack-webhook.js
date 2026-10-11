/* POST /api/paystack-webhook   (Paystack dashboard > Settings > API Keys & Webhooks > Webhook URL)
   Paystack calls this when a payment succeeds, even if the player closed the game,
   so nobody pays without getting their eko. */
const crypto = require('crypto');
const { paystackLookup, grant } = require('./_lib');

function rawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c)); req.on('end', () => resolve(Buffer.concat(chunks))); req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const raw = await rawBody(req);
    const sig = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY).update(raw).digest('hex');
    const got = String(req.headers['x-paystack-signature'] || '');
    if (got.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(got))) return res.status(401).end();
    const ev = JSON.parse(raw.toString('utf8'));
    if (ev.event === 'charge.success' && ev.data && ev.data.reference) {
      const tx = await paystackLookup(ev.data.reference);      // ask Paystack again rather than trust the message body
      const out = await grant(tx, null);
      if (!out.ok) console.warn('webhook not granted', ev.data.reference, out.error);
    }
    return res.status(200).end();
  } catch (e) {
    console.error('webhook', e);
    return res.status(500).end();                                // Paystack retries later
  }
};

module.exports.config = { api: { bodyParser: false } };
