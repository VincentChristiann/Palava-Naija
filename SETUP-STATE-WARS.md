# Switching on State Wars

State Wars runs on the same server setup as the shop. The game reads the table
straight from Firestore, and every run's points go through `api/statewars.js`,
which checks the run before adding anything. Players can't add points themselves.

## 1. Vercel environment variables

You only need these once. If you already added them for the shop, skip this step.

| Name | Value |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | the whole JSON file from Firebase > Project settings > Service accounts > Generate new private key |
| `FIREBASE_DATABASE_ID` | `default` |

Keep that JSON file private. Never put it in chat or in GitHub.

## 2. Firestore rules

Add the `statewars` block from `firestore-rules-add.txt` to your rules and press Publish.

## 3. Deploy

The `api` folder and `package.json` must go up with the game. Push to GitHub
(Vercel deploys it), or run `npx vercel --prod` from the unzipped folder.

## 4. Check it

Sign in with Google, finish a run of at least 100 m, and look for the yellow
"+… for Kano · State Wars" line on the results screen. Then open State Wars on
the menu. You can also see the data in Firebase > Firestore > `statewars`.

## Rules the server applies

- **Points per run:** 1 point per 10 m, up to 600 a run, and 1.5× when you run in your own state.
- **Your state:** locked for the week from your first score. Pick a different one next week.
- **Limits:** at least 20 s between runs and at most 9,000 points per player per day. Runs that are impossibly fast are rejected.
- **The week:** Monday 00:00 to Sunday 23:59, Lagos time. Last week's top state shows a crown.
