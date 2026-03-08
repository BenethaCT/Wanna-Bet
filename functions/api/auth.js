import { createSession, deleteSession, getAuthedUser, getState, hashPassword, json, nowIso, readJson, sanitizeText, uid } from './_lib.js';

export async function onRequestGet(context) {
  const me = await getAuthedUser(context.env.DB, context.request);
  if (!me) return json({ ok: false, error: 'Unauthorized' }, 401);
  return json({ ok: true, user: me, ...(await getState(context.env.DB, me.id)) });
}

export async function onRequestPost(context) {
  const body = await readJson(context.request);
  if (!body) return json({ ok: false, error: 'Invalid JSON' }, 400);

  const action = String(body.action || '').toLowerCase();
  const DB = context.env.DB;

  if (action === 'register') {
    const username = sanitizeText(body.username, 24);
    const password = String(body.password || '');

    if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
      return json({ ok: false, error: 'Username must be 3-24 chars: letters, numbers, underscore.' }, 400);
    }
    if (password.length < 8 || password.length > 72) {
      return json({ ok: false, error: 'Password must be 8-72 characters.' }, 400);
    }

    const exists = await DB.prepare('SELECT id FROM users WHERE lower(username) = lower(?)').bind(username).first();
    if (exists) return json({ ok: false, error: 'Username already exists' }, 409);

    const id = uid();
    const passHash = await hashPassword(password, username);
    await DB.prepare('INSERT INTO users (id, username, pass_hash, avatar_url, created_at) VALUES (?, ?, ?, NULL, ?)')
      .bind(id, username, passHash, nowIso())
      .run();

    const token = await createSession(DB, id);
    const user = await DB.prepare('SELECT id, username, avatar_url FROM users WHERE id = ?').bind(id).first();
    return json({ ok: true, token, user, ...(await getState(DB, id)) });
  }

  if (action === 'login') {
    const username = sanitizeText(body.username, 24);
    const password = String(body.password || '');
    if (!username || !password) return json({ ok: false, error: 'Username and password are required.' }, 400);

    const row = await DB.prepare('SELECT id, username, pass_hash, avatar_url FROM users WHERE lower(username) = lower(?)')
      .bind(username)
      .first();
    if (!row) return json({ ok: false, error: 'Invalid credentials' }, 401);

    const passHash = await hashPassword(password, row.username);
    if (passHash !== row.pass_hash) return json({ ok: false, error: 'Invalid credentials' }, 401);

    const token = await createSession(DB, row.id);
    return json({ ok: true, token, user: { id: row.id, username: row.username, avatar_url: row.avatar_url }, ...(await getState(DB, row.id)) });
  }

  if (action === 'logout') {
    await deleteSession(DB, context.request);
    return json({ ok: true });
  }

  if (action === 'reset_password') {
    const me = await getAuthedUser(DB, context.request);
    if (!me) return json({ ok: false, error: 'Unauthorized' }, 401);

    const currentPassword = String(body.currentPassword || '');
    const newPassword = String(body.newPassword || '');
    if (newPassword.length < 8 || newPassword.length > 72) {
      return json({ ok: false, error: 'New password must be 8-72 characters.' }, 400);
    }

    const row = await DB.prepare('SELECT pass_hash FROM users WHERE id = ?').bind(me.id).first();
    const currentHash = await hashPassword(currentPassword, me.username);
    if (!row || row.pass_hash !== currentHash) return json({ ok: false, error: 'Current password is incorrect.' }, 401);

    const nextHash = await hashPassword(newPassword, me.username);
    await DB.prepare('UPDATE users SET pass_hash = ? WHERE id = ?').bind(nextHash, me.id).run();

    return json({ ok: true, user: me, ...(await getState(DB, me.id)) });
  }

  return json({ ok: false, error: 'Invalid action' }, 400);
}