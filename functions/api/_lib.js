const USERS = ['Ben', 'Sheh'];

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function isUser(name) {
  return USERS.includes(name);
}

export function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return `h${h}`;
}

export function normalizeName(name) {
  if (name === 'Me') return 'Ben';
  if (name === 'BF') return 'Sheh';
  return name;
}

export async function getState(DB) {
  const userRows = await DB.prepare('SELECT name, pass_hash FROM users').all();
  const betRows = await DB.prepare('SELECT * FROM bets ORDER BY datetime(created_at) DESC').all();

  const auth = {
    Ben: { passwordSet: false },
    Sheh: { passwordSet: false }
  };

  for (const row of userRows.results || []) {
    if (isUser(row.name)) auth[row.name].passwordSet = !!row.pass_hash;
  }

  const bets = (betRows.results || []).map((row) => ({
    id: row.id,
    title: row.title,
    details: row.details,
    prize: row.prize,
    creator: normalizeName(row.creator),
    status: row.status,
    createdAt: row.created_at,
    agreedAt: row.agreed_at,
    completedAt: row.completed_at,
    winner: normalizeName(row.winner),
    winnerVoteBen: normalizeName(row.winner_vote_ben),
    winnerVoteSheh: normalizeName(row.winner_vote_sheh)
  }));

  return { auth, bets };
}
