# Wanna Bet?

Fun two-player betting app for Ben and Sheh.

## Local run
Open `index.html` in a browser.

## Reset data
App keys are versioned. Current reset version uses:
- `betchaos_v2`
- `wanna_bet_auth_v2`
- `wanna_bet_session_v2`

## Cloudflare deploy (Wrangler)
- `npm i -g wrangler` (if needed)
- `wrangler login`
- `wrangler pages project create wanna-bet` (first time)
- `wrangler pages deploy . --project-name wanna-bet`
