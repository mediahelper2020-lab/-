import { models, requireUser, callModel } from './_lib.js';
const MAX = 60000;
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST만 허용한다.' });
  try {
    const auth = await requireUser(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const m = models().find((x) => x.id === body.model);
    if (!m) return res.status(400).json({ error: '등록되지 않은 모델이다. Vercel 환경변수를 확인한다.' });
    const prompt = String(body.prompt || ''), system = String(body.system || '');
    if (!prompt.trim()) return res.status(400).json({ error: '보낼 내용이 없다.' });
    if (prompt.length + system.length > MAX) return res.status(413).json({ error: '보낼 내용이 너무 길다. 나눠서 요청한다.' });
    const text = await callModel(m, system, prompt);
    return res.status(200).json({ text, model: m.id });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message || 'AI 호출 중 오류가 났다.' });
  }
}
