import { getState, isUser, json, normalizeName, readJson } from './_lib.js';

function nowIso() {
  return new Date().toISOString();
}

function cleanText(value) {
  if (!value) return '';
  return String(value).replace(/`r`n/g, ' ').replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

function uid() {
  return `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function otherPerson(person) {
  return person === 'Ben' ? 'Sheh' : 'Ben';
}

export async function onRequestPost(context) {
  const body = await readJson(context.request);
  if (!body) return json({ ok: false, error: 'Invalid JSON' }, 400);

  const action = body.action;
  const DB = context.env.DB;

  if (action === 'create') {
    const title = cleanText(body.title);
    const details = cleanText(body.details);
    const prize = cleanText(body.prize);
    const creator = normalizeName(body.creator);

    if (!title || !details || !prize || !isUser(creator)) return json({ ok: false, error: 'Invalid bet' }, 400);

    await DB.prepare(
      `INSERT INTO bets (id, title, details, prize, creator, status, created_at, agreed_at, completed_at, winner, winner_vote_ben, winner_vote_sheh)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, NULL, NULL, NULL, NULL, NULL)`
    ).bind(uid(), title, details, prize, creator, nowIso()).run();

    return json({ ok: true, ...(await getState(DB)) });
  }

  if (action === 'agree') {
    const id = body.id;
    const actor = normalizeName(body.actor);
    if (!id || !isUser(actor)) return json({ ok: false, error: 'Invalid agree request' }, 400);

    const bet = await DB.prepare('SELECT id, creator, status FROM bets WHERE id = ?').bind(id).first();
    if (!bet) return json({ ok: false, error: 'Bet not found' }, 404);
    if (bet.status !== 'pending') return json({ ok: false, error: 'Bet not pending' }, 400);
    if (actor !== otherPerson(normalizeName(bet.creator))) return json({ ok: false, error: 'Only other user can agree' }, 403);

    await DB.prepare(
      'UPDATE bets SET status = ?, agreed_at = ?, winner_vote_ben = NULL, winner_vote_sheh = NULL WHERE id = ?'
    ).bind('agreed', nowIso(), id).run();

    return json({ ok: true, ...(await getState(DB)) });
  }

  if (action === 'edit') {
    const id = body.id;
    const title = cleanText(body.title);
    const details = cleanText(body.details);
    const prize = cleanText(body.prize);
    if (!id || !title || !details || !prize) return json({ ok: false, error: 'Invalid edit data' }, 400);

    const bet = await DB.prepare('SELECT status FROM bets WHERE id = ?').bind(id).first();
    if (!bet) return json({ ok: false, error: 'Bet not found' }, 404);
    if (bet.status !== 'pending') return json({ ok: false, error: 'Only pending bets can be edited' }, 400);

    await DB.prepare('UPDATE bets SET title = ?, details = ?, prize = ? WHERE id = ?').bind(title, details, prize, id).run();

    return json({ ok: true, ...(await getState(DB)) });
  }

  if (action === 'vote') {
    const id = body.id;
    const actor = normalizeName(body.actor);
    const selectedWinner = normalizeName(body.selectedWinner);
    if (!id || !isUser(actor) || !isUser(selectedWinner)) return json({ ok: false, error: 'Invalid vote data' }, 400);

    const bet = await DB.prepare('SELECT status, winner_vote_ben, winner_vote_sheh FROM bets WHERE id = ?').bind(id).first();
    if (!bet) return json({ ok: false, error: 'Bet not found' }, 404);
    if (bet.status !== 'agreed') return json({ ok: false, error: 'Bet not in vote stage' }, 400);

    if (actor === 'Ben') {
      await DB.prepare('UPDATE bets SET winner_vote_ben = ? WHERE id = ?').bind(selectedWinner, id).run();
    } else {
      await DB.prepare('UPDATE bets SET winner_vote_sheh = ? WHERE id = ?').bind(selectedWinner, id).run();
    }

    const updated = await DB.prepare('SELECT winner_vote_ben, winner_vote_sheh FROM bets WHERE id = ?').bind(id).first();
    if (updated?.winner_vote_ben && updated?.winner_vote_sheh && updated.winner_vote_ben === updated.winner_vote_sheh) {
      await DB.prepare('UPDATE bets SET status = ?, winner = ?, completed_at = ? WHERE id = ?')
        .bind('history', updated.winner_vote_ben, nowIso(), id)
        .run();
    }

    return json({ ok: true, ...(await getState(DB)) });
  }

  return json({ ok: false, error: 'Unknown action' }, 400);
}
