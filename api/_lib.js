// Vercel 서버 함수 공통 — API 키는 Vercel 환경변수에만 있고 브라우저로 보내지 않는다.
const env = (k) => (process.env[k] || '').trim();

const DEFAULT_MODELS = {
  openai: [['gpt-5-mini', 'GPT-5 mini'], ['gpt-5', 'GPT-5']],
  gemini: [['gemini-2.5-flash', 'Gemini 2.5 Flash'], ['gemini-2.5-pro', 'Gemini 2.5 Pro']],
  anthropic: [['claude-sonnet-5-5', 'Claude Sonnet 5.5'], ['claude-haiku-5-5', 'Claude Haiku 5.5']],
};
export const KEYS = () => ({
  openai: env('OPENAI_API_KEY'),
  gemini: env('GEMINI_API_KEY') || env('GOOGLE_API_KEY'),
  anthropic: env('ANTHROPIC_API_KEY'),
});

// AI_MODELS 환경변수(JSON)가 있으면 그 목록을, 없으면 키가 있는 회사의 기본 모델을 쓴다.
// 예: [{"provider":"openai","model":"gpt-5-mini","label":"GPT-5 mini"},{"provider":"anthropic","model":"claude-sonnet-5-5","label":"Claude"}]
export function models() {
  const keys = KEYS();
  let list = [];
  const raw = env('AI_MODELS');
  if (raw) {
    try { list = JSON.parse(raw).map((m) => ({ provider: m.provider, model: m.model, label: m.label || m.model })); }
    catch (_) { list = []; }
  }
  if (!list.length) list = Object.entries(DEFAULT_MODELS).flatMap(([provider, ms]) => ms.map(([model, label]) => ({ provider, model, label })));
  return list.filter((m) => keys[m.provider]).map((m) => ({ ...m, id: `${m.provider}:${m.model}` }));
}

// 흔한 입력 실수를 바로잡는다: 대시보드 주소, 프로젝트 ID만 입력, https 누락, /rest/v1 등 꼬리 경로, 따옴표.
export function normalizeSupabaseUrl(raw) {
  let v = String(raw || '').trim().replace(/^["']|["']$/g, '').trim();
  if (!v) return '';
  const dash = v.match(/supabase\.com\/dashboard\/project\/([a-z0-9]{10,})/i);
  if (dash) return `https://${dash[1].toLowerCase()}.supabase.co`;
  if (/^[a-z0-9]{15,}$/i.test(v)) return `https://${v.toLowerCase()}.supabase.co`;
  if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
  try { const u = new URL(v); return `${u.protocol}//${u.host}`; } catch (_) { return v; }
}
export function supabaseConfig() {
  return { url: normalizeSupabaseUrl(env('SUPABASE_URL')), anonKey: env('SUPABASE_ANON_KEY').replace(/^["']|["']$/g, '').trim() };
}

// Supabase 로그인 토큰을 확인한다. ALLOWED_EMAILS(쉼표 구분, "@기관도메인" 가능)가 있으면 그 사람만 허용한다.
export async function requireUser(req) {
  const { url, anonKey } = supabaseConfig();
  if (!url || !anonKey) return { error: 'Supabase가 설정되지 않아 AI를 쓸 수 없다. Vercel 환경변수 SUPABASE_URL, SUPABASE_ANON_KEY를 등록한다.', status: 503 };
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return { error: '로그인이 필요하다.', status: 401 };
  const r = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: `Bearer ${token}` } });
  if (!r.ok) return { error: '로그인이 만료되었다. 다시 로그인한다.', status: 401 };
  const user = await r.json();
  const allow = env('ALLOWED_EMAILS').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const email = String(user.email || '').toLowerCase();
  if (allow.length && !allow.some((a) => (a.startsWith('@') ? email.endsWith(a) : email === a))) return { error: '이 계정은 AI 사용 권한이 없다. 관리자에게 문의한다.', status: 403 };
  return { user };
}

export async function callModel(m, system, prompt) {
  const key = KEYS()[m.provider];
  let r, data;
  if (m.provider === 'openai') {
    r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ model: m.model, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] }) });
    data = await r.json().catch(() => ({}));
    if (r.ok) return (data.choices?.[0]?.message?.content || '').trim();
  } else if (m.provider === 'gemini') {
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m.model)}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: prompt }] }] }) });
    data = await r.json().catch(() => ({}));
    if (r.ok) return (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();
  } else if (m.provider === 'anthropic') {
    r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: m.model, max_tokens: 4096, system, messages: [{ role: 'user', content: prompt }] }) });
    data = await r.json().catch(() => ({}));
    if (r.ok) return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  } else throw Object.assign(new Error('알 수 없는 회사'), { status: 400 });
  const msg = data?.error?.message || data?.error?.type || r.statusText || '';
  const hint = r.status === 401 || r.status === 403 ? 'Vercel에 등록한 API 키가 올바르지 않거나 권한이 없다.'
    : r.status === 404 ? `모델 「${m.model}」을 찾지 못했다. AI_MODELS 환경변수의 모델 ID를 확인한다.`
    : r.status === 429 ? '사용량 한도를 넘었거나 결제(크레딧)가 필요하다. 잠시 후 다시 하거나 다른 모델을 고른다.'
    : 'AI 호출에 실패했다.';
  throw Object.assign(new Error(`${hint}\n[${m.provider} ${r.status}] ${msg}`), { status: 502 });
}
