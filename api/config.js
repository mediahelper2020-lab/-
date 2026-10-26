import { supabaseConfig, models } from './_lib.js';
// 브라우저가 쓸 공개 설정만 돌려준다(anon key는 공개용 키다. API 키는 절대 포함하지 않는다).
export default function handler(req, res) {
  const { url, anonKey } = supabaseConfig();
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ supabaseUrl: url || null, supabaseAnonKey: anonKey || null, aiModels: models().length });
}
