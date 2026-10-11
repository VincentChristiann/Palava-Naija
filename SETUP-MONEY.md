# Switching on ads and the shop

This copy of the game already has the ad spots and the Paystack shop built in.
They stay switched off until the steps below are done, so it is safe to deploy now.

## 0. Vercel plan

Vercel's free Hobby plan is for non-commercial use only. Ads and payments count as
commercial, so upgrade the project to Vercel Pro before switching either one on.

## 1. Deploy with the Vercel CLI (needed for the payment check)

The payment check runs as two small server functions in the `api` folder, so this
deploy must include `api/` and `package.json`. From the unzipped folder:

    npx vercel link
    npx vercel --prod

## 2. Paystack

1. In the Paystack dashboard, open Settings > API Keys & Webhooks.
2. Set the Webhook URL to `https://palava-naija.vercel.app/api/paystack-webhook`.
3. Copy your **public** key (`pk_test_...` while testing, `pk_live_...` when live)
   and send it to Claude. It goes inside the game, and it is safe to share.
4. Keep the **secret** key (`sk_...`) to yourself. Put it only in Vercel (step 3).
   Never send it in chat and never put it in the game.

## 3. Vercel environment variables

Go to Vercel > the project > Settings > Environment Variables and add:

| Name | Value |
|---|---|
| `PAYSTACK_SECRET_KEY` | your `sk_test_...` or `sk_live_...` key |
| `FIREBASE_SERVICE_ACCOUNT` | the whole JSON file from Firebase > Project settings > Service accounts > Generate new private key |
| `FIREBASE_DATABASE_ID` | `default` |

Redeploy after adding them (`npx vercel --prod`).

## 4. Firestore rules

Open `firestore-rules-add.txt`. Add its two blocks to your existing rules in
Firebase > Firestore > Rules, then press Publish.

## 5. Google ads (H5 Games Ads)

1. Apply at https://adsense.google.com/start/h5-games-ads/ with the game's address.
2. Once you are approved, send Claude your publisher ID (`ca-pub-...`).
3. Claude rebuilds the game with test ads first. When those look right, it does a final build with live ads.

## 6. Test before going live

- Use the `pk_test_...` and `sk_test_...` keys first.
- Buy a bag with Paystack's test card, then check that the eko lands.
- Open Firestore and confirm that `purchases` and `entitlements` got a new document.
- Then swap both keys for the live ones.

## What players get

| Item | Price | What they get |
|---|---|---|
| Small bag | ₦500 | Ɇ500,000 |
| Ghana-must-go | ₦1,000 | Ɇ1,200,000 |
| Big money bag | ₦2,000 | Ɇ2,800,000 |
| Hustle Pass | ₦1,500 | 30 days: no forced ads, every "watch an ad" reward without the ad, daily pay doubled, +20% eko per run |

Rewarded ads (all optional for the player):

- Double today's daily pay.
- Escape the police for free, once per run.
- Double the cash from a run.

There is also one ad between runs, every third run at most. Hustle Pass holders never see it.

Eko is play money only. It can't be cashed out or sent to another player.
