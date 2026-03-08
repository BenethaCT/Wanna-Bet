import { getAuthedUser, getState, json } from './_lib.js';

export async function onRequestGet(context) {
  const me = await getAuthedUser(context.env.DB, context.request);
  if (!me) return json({ ok: false, error: 'Unauthorized' }, 401);
  return json({ ok: true, user: me, ...(await getState(context.env.DB, me.id)) });
}