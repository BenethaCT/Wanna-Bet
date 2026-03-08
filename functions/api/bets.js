import { getAuthedUser, getState, json, nowIso, readJson, sanitizeText, uid } from './_lib.js';

function isParticipant(bet, userId) {
  return bet && (bet.creator_id === userId || bet.opponent_id === userId);
}

function isConsensus(votes, a, b) {
  return votes[a] && votes[b] && votes[a] === votes[b];
}

export async function onRequestPost(context) {
  const body = await readJson(context.request);
  if (!body) return json({ ok: false, error: 'Invalid JSON' }, 400);

  const DB = context.env.DB;
  const me = await getAuthedUser(DB, context.request);
  if (!me) return json({ ok: false, error: 'Unauthorized' }, 401);

  const action = String(body.action || '').toLowerCase();

  if (action === 'create') {
    const title = sanitizeText(body.title, 80);
    const details = sanitizeText(body.details, 300);
    const prize = sanitizeText(body.prize, 120);
    const opponentId = String(body.opponentId || '');

    if (!title || !details || !prize || !opponentId) return json({ ok: false, error: 'All fields are required.' }, 400);
    if (opponentId === me.id) return json({ ok: false, error: 'You cannot bet against yourself.' }, 400);

    const opponent = await DB.prepare('SELECT id FROM users WHERE id = ?').bind(opponentId).first();
    if (!opponent) return json({ ok: false, error: 'Opponent not found.' }, 404);

    await DB.prepare(
      `INSERT INTO bets (id, title, details, prize, creator_id, opponent_id, status, created_at, agreed_at, completed_at, winner_id)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, NULL, NULL, NULL)`
    ).bind(uid(), title, details, prize, me.id, opponentId, nowIso()).run();

    return json({ ok: true, ...(await getState(DB, me.id)) });
  }

  if (action === 'agree') {
    const id = String(body.id || '');
    if (!id) return json({ ok: false, error: 'Invalid bet id.' }, 400);

    const bet = await DB.prepare('SELECT id, creator_id, opponent_id, status FROM bets WHERE id = ?').bind(id).first();
    if (!bet) return json({ ok: false, error: 'Bet not found.' }, 404);
    if (!isParticipant(bet, me.id)) return json({ ok: false, error: 'Forbidden.' }, 403);
    if (bet.status !== 'pending') return json({ ok: false, error: 'Bet is not pending.' }, 400);
    if (me.id !== bet.opponent_id) return json({ ok: false, error: 'Only opponent can agree.' }, 403);

    await DB.prepare('UPDATE bets SET status = ?, agreed_at = ? WHERE id = ?').bind('agreed', nowIso(), id).run();
    await DB.prepare('DELETE FROM bet_votes WHERE bet_id = ?').bind(id).run();

    return json({ ok: true, ...(await getState(DB, me.id)) });
  }

  if (action === 'edit') {
    const id = String(body.id || '');
    const title = sanitizeText(body.title, 80);
    const details = sanitizeText(body.details, 300);
    const prize = sanitizeText(body.prize, 120);

    if (!id || !title || !details || !prize) return json({ ok: false, error: 'Invalid edit payload.' }, 400);

    const bet = await DB.prepare('SELECT id, creator_id, opponent_id, status FROM bets WHERE id = ?').bind(id).first();
    if (!bet) return json({ ok: false, error: 'Bet not found.' }, 404);
    if (!isParticipant(bet, me.id)) return json({ ok: false, error: 'Forbidden.' }, 403);
    if (bet.status !== 'pending') return json({ ok: false, error: 'Only pending bets can be edited.' }, 400);
    if (me.id !== bet.creator_id) return json({ ok: false, error: 'Only creator can edit pending bet.' }, 403);

    await DB.prepare('UPDATE bets SET title = ?, details = ?, prize = ? WHERE id = ?').bind(title, details, prize, id).run();

    return json({ ok: true, ...(await getState(DB, me.id)) });
  }

  if (action === 'vote') {
    const id = String(body.id || '');
    const selectedWinnerId = String(body.selectedWinnerId || '');

    if (!id || !selectedWinnerId) return json({ ok: false, error: 'Invalid vote payload.' }, 400);

    const bet = await DB.prepare('SELECT id, creator_id, opponent_id, status FROM bets WHERE id = ?').bind(id).first();
    if (!bet) return json({ ok: false, error: 'Bet not found.' }, 404);
    if (!isParticipant(bet, me.id)) return json({ ok: false, error: 'Forbidden.' }, 403);
    if (bet.status !== 'agreed') return json({ ok: false, error: 'Bet is not in voting stage.' }, 400);
    if (selectedWinnerId !== bet.creator_id && selectedWinnerId !== bet.opponent_id) {
      return json({ ok: false, error: 'Winner must be one of bet participants.' }, 400);
    }

    await DB.prepare(
      `INSERT INTO bet_votes (bet_id, voter_id, selected_winner_id, voted_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(bet_id, voter_id)
       DO UPDATE SET selected_winner_id = excluded.selected_winner_id, voted_at = excluded.voted_at`
    ).bind(id, me.id, selectedWinnerId, nowIso()).run();

    const votesRes = await DB.prepare('SELECT voter_id, selected_winner_id FROM bet_votes WHERE bet_id = ?').bind(id).all();
    const votes = {};
    for (const row of votesRes.results || []) votes[row.voter_id] = row.selected_winner_id;

    if (isConsensus(votes, bet.creator_id, bet.opponent_id)) {
      await DB.prepare('UPDATE bets SET status = ?, winner_id = ?, completed_at = ? WHERE id = ?')
        .bind('history', votes[bet.creator_id], nowIso(), id)
        .run();
    }

    return json({ ok: true, ...(await getState(DB, me.id)) });
  }

  return json({ ok: false, error: 'Unknown action' }, 400);
}