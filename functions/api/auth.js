import { getState, isUser, json, readJson, simpleHash } from './_lib.js';

export async function onRequestPost(context) {
  const body = await readJson(context.request);
  if (!body) return json({ ok: false, error: 'Invalid JSON' }, 400);

  const user = body.user;
  const password = String(body.password || '');
  const mode = body.mode;

  if (!isUser(user)) return json({ ok: false, error: 'Invalid user' }, 400);
  if (password.length < 4) return json({ ok: false, error: 'Password too short' }, 400);

  const row = await context.env.DB.prepare('SELECT pass_hash FROM users WHERE name = ?').bind(user).first();
  const hashed = simpleHash(password);

  if (mode === 'setup') {
    if (row?.pass_hash) return json({ ok: false, error: 'Password already set' }, 400);
    await context.env.DB.prepare('UPDATE users SET pass_hash = ? WHERE name = ?').bind(hashed, user).run();
    const state = await getState(context.env.DB);
    return json({ ok: true, ...state });
  }

  if (mode === 'login') {
    if (!row?.pass_hash) return json({ ok: false, error: 'Password not set' }, 400);
    if (row.pass_hash !== hashed) return json({ ok: false, error: 'Wrong password' }, 401);
    const state = await getState(context.env.DB);
    return json({ ok: true, ...state });
  }

  return json({ ok: false, error: 'Invalid mode' }, 400);
}
