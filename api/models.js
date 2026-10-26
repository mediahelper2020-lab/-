import { models } from './_lib.js';
export default function handler(req, res) {
  const list = models().map(({ id, provider, model, label }) => ({ id, provider, model, label }));
  const def = (process.env.AI_DEFAULT_MODEL || '').trim();
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ models: list, defaultId: list.find((m) => m.id === def || m.model === def)?.id || list[0]?.id || null });
}
