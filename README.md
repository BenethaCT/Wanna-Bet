# Wanna Bet?

A lightweight social betting app where two users can create bets, agree on terms, and close bets only when both submit the same winner.

## Why this project
This started as a private two-person app and was refactored into a generalized multi-user architecture.

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

## Tech stack
- Frontend: HTML, CSS, Vanilla JavaScript
- Backend: Cloudflare Pages Functions
- Database: Cloudflare D1 (SQLite)

## Project structure
- `index.html` - app shell and auth/app views
- `script.js` - client logic, state handling, API actions
- `style.css` - UI styling
- `functions/api/auth.js` - auth endpoints
- `functions/api/bets.js` - bet lifecycle endpoints
- `functions/api/state.js` - authenticated state fetch
- `functions/api/_lib.js` - shared helpers
- `migrations/001_init.sql` - database schema

## Security notes
- Input is sanitized server-side before writes.
- Session token auth is used for API authorization.
- Password hashing is currently SHA-256 based for Worker portability.
- Production recommendation: migrate password hashing to Argon2/scrypt/bcrypt.

## Showcase notes
This repository is presented as a code showcase. A live deployment is optional and not required to evaluate architecture, business rules, or implementation quality.
Current status: this repository is local and not yet connected/deployed to Cloudflare.
