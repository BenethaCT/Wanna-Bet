# Wanna Bet?

A lightweight social betting app where two users can create bets, agree on terms, and close bets only when both submit the same winner.

## Quick start (no backend needed)
1. Download or clone the repo.
2. Open `index.html` in your browser.
3. Create accounts and start betting.

This build runs fully in `localStorage`, so no Cloudflare, Wrangler, server, or database setup is required.

## Core features
- Account-based auth (register, login, logout, password reset)
- Create bets against a selected opponent
- Edit only while bet is pending (creator-only)
- Opponent must explicitly agree before voting starts
- Two independent winner votes required
- Bet auto-closes to history only when both votes match

## Rules enforced in code
- Only bet participants can view/interact with their bets
- Only creator can edit pending bets
- Only opponent can agree pending bets
- Winner vote must be one of the two participants

## Tech stack (showcase mode)
- Frontend: HTML, CSS, Vanilla JavaScript
- Storage: Browser localStorage

## Project structure
- `index.html` - app shell and auth/app views
- `script.js` - client logic, local auth, local data store, bet lifecycle
- `style.css` - UI styling

## Notes
- Data is browser-local and not shared across devices/browsers.
- Clearing browser storage clears app data.
- Cloudflare Functions/D1 files remain in repo as optional backend reference.
