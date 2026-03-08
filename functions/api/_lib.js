const SESSION_TTL_HOURS = 24 * 14;

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

export function nowIso() {
  return new Date().toISOString();
}

export function uid() {
  return crypto.randomUUID();
}

export function sanitizeText(value, maxLen = 300) {
  return String(value || '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, maxLen);
}

export async function sha256(text) {
  const enc = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', enc);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password, username) {
  const salt = `wanna-bet:v1:${String(username || '').toLowerCase()}`;
  return sha256(`${salt}:${password}`);
}

export function readBearerToken(request) {
  const auth = request.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  return token || null;
}

export async function createSession(DB, userId) {
  const token = uid();
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_TTL_HOURS * 3600 * 1000).toISOString();
  await DB.prepare('INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .bind(token, userId, expires, now.toISOString())
    .run();
  return token;
}

export async function getAuthedUser(DB, request) {
  const token = readBearerToken(request);
  if (!token) return null;

  const row = await DB.prepare(
    `SELECT u.id, u.username, u.avatar_url
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND datetime(s.expires_at) > datetime('now')`
  ).bind(token).first();

  return row || null;
}

export async function deleteSession(DB, request) {
  const token = readBearerToken(request);
  if (!token) return;
  await DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
}

export async function getState(DB, currentUserId) {
  const usersRes = await DB.prepare('SELECT id, username, avatar_url FROM users ORDER BY username ASC').all();
  const users = usersRes.results || [];

  let bets = [];
  if (currentUserId) {
    const betsRes = await DB.prepare(
      `SELECT b.*,
              cu.username AS creator_username,
              ou.username AS opponent_username,
              wu.username AS winner_username
       FROM bets b
       JOIN users cu ON cu.id = b.creator_id
       JOIN users ou ON ou.id = b.opponent_id
       LEFT JOIN users wu ON wu.id = b.winner_id
       WHERE b.creator_id = ? OR b.opponent_id = ?
       ORDER BY datetime(b.created_at) DESC`
    ).bind(currentUserId, currentUserId).all();

    const voteRes = await DB.prepare(
      `SELECT bv.bet_id, bv.voter_id, bv.selected_winner_id, u.username AS selected_winner_username
       FROM bet_votes bv
       JOIN users u ON u.id = bv.selected_winner_id
       WHERE bv.bet_id IN (
         SELECT id FROM bets WHERE creator_id = ? OR opponent_id = ?
       )`
    ).bind(currentUserId, currentUserId).all();

    const voteMap = new Map();
    for (const row of voteRes.results || []) {
      if (!voteMap.has(row.bet_id)) voteMap.set(row.bet_id, {});
      voteMap.get(row.bet_id)[row.voter_id] = {
        selectedWinnerId: row.selected_winner_id,
        selectedWinner: row.selected_winner_username
      };
    }

    bets = (betsRes.results || []).map((row) => ({
      id: row.id,
      title: row.title,
      details: row.details,
      prize: row.prize,
      creatorId: row.creator_id,
      creator: row.creator_username,
      opponentId: row.opponent_id,
      opponent: row.opponent_username,
      status: row.status,
      createdAt: row.created_at,
      agreedAt: row.agreed_at,
      completedAt: row.completed_at,
      winnerId: row.winner_id,
      winner: row.winner_username,
      votes: voteMap.get(row.id) || {}
    }));
  }

  return { users, bets };
}