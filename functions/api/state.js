import { getState, json } from './_lib.js';

export async function onRequestGet(context) {
  const state = await getState(context.env.DB);
  return json({ ok: true, ...state });
}
