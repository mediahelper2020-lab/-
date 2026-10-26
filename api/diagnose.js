import { requireUser, diagnose } from './_lib.js';
// AI 연결 점검 (로그인한 사람만)
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await requireUser(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });
  const provider = String(req.query?.provider || '');
  if (!['openai', 'gemini', 'anthropic'].includes(provider)) return res.status(400).json({ error: 'provider를 확인한다.' });
  try { return res.status(200).json(await diagnose(provider)); }
  catch (err) { return res.status(500).json({ error: err.message }); }
}
