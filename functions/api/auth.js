import { getState, isUser, json, readJson, simpleHash } from './_lib.js';

export async function onRequestPost(context) {
  const body = await readJson(context.request);
  if (!body) return json({ ok: false, error: 'Invalid JSON' }, 400);

  const user = body.user;
  const mode = body.mode;

  if (!isUser(user)) return json({ ok: false, error: 'Invalid user' }, 400);

  const row = await context.env.DB.prepare('SELECT pass_hash FROM users WHERE name = ?').bind(user).first();

  if (mode === 'setup') {
    const password = String(body.password || '');
    if (password.length < 4) return json({ ok: false, error: 'Password too short' }, 400);
    if (row?.pass_hash) return json({ ok: false, error: 'Password already set' }, 400);

    await context.env.DB.prepare('UPDATE users SET pass_hash = ? WHERE name = ?').bind(simpleHash(password), user).run();
    return json({ ok: true, ...(await getState(context.env.DB)) });
  }

  if (mode === 'login') {
    const password = String(body.password || '');
    if (password.length < 4) return json({ ok: false, error: 'Password too short' }, 400);
    if (!row?.pass_hash) return json({ ok: false, error: 'Password not set' }, 400);
    if (row.pass_hash !== simpleHash(password)) return json({ ok: false, error: 'Wrong password' }, 401);

    return json({ ok: true, ...(await getState(context.env.DB)) });
  }

  if (mode === 'reset') {
    const currentPassword = String(body.currentPassword || '');
    const newPassword = String(body.newPassword || '');

    if (newPassword.length < 4) return json({ ok: false, error: 'Password too short' }, 400);
    if (!row?.pass_hash) return json({ ok: false, error: 'Password not set' }, 400);
    if (row.pass_hash !== simpleHash(currentPassword)) return json({ ok: false, error: 'Current password is incorrect' }, 401);

    await context.env.DB.prepare('UPDATE users SET pass_hash = ? WHERE name = ?').bind(simpleHash(newPassword), user).run();
    return json({ ok: true, ...(await getState(context.env.DB)) });
  }

  return json({ ok: false, error: 'Invalid mode' }, 400);
}
