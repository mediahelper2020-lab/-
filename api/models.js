import { discover } from './_lib.js';
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const force = req.query?.refresh === '1';
  const { list, providers } = await discover(force);
  const def = (process.env.AI_DEFAULT_MODEL || '').trim();
  res.status(200).json({
    models: list.map(({ id, provider, model, label, group }) => ({ id, provider, model, label, group })),
    providers,
    defaultId: list.find((m) => m.id === def || m.model === def)?.id || list[0]?.id || null,
  });
}
