// Vercel 서버 함수 공통 — API 키는 Vercel 환경변수에만 있고 브라우저로 보내지 않는다.
const env = (k) => (process.env[k] || '').trim();

export const KEYS = () => ({
  openai: env('OPENAI_API_KEY'),
  gemini: env('GEMINI_API_KEY') || env('GOOGLE_API_KEY') || env('GOOGLE_GENERATIVE_AI_API_KEY'),
  anthropic: env('ANTHROPIC_API_KEY') || env('CLAUDE_API_KEY'),
});
const PROVIDER_NAME = { openai: 'ChatGPT', gemini: 'Gemini', anthropic: 'Claude' };

/* ---------------------------------------------------------------
   모델 목록: 각 회사의 "모델 목록" API에서 지금 쓸 수 있는 최신 모델을 받아온다.
   새 모델이 나오면 코드 수정 없이 자동으로 목록에 나타난다.
   - AI_MODEL_LIMIT: 회사별로 보여줄 최대 개수(기본 15)
   - AI_MODELS: 목록에 꼭 넣을 모델(JSON). 예: [{"provider":"openai","model":"gpt-6-luna","label":"GPT-6 Luna"}]
   - AI_MODELS_EXCLUDE: 숨길 모델 ID(쉼표 구분, 앞부분만 써도 됨)
   --------------------------------------------------------------- */
const SKIP_OPENAI = /(audio|realtime|tts|transcri|whisper|image|dall-e|embedding|moderation|search|instruct|babbage|davinci|codex|computer-use|sora|omni-moderation|deep-research)/i;
const SKIP_GEMINI = /(embedding|tts|image|live|audio|robotics|computer-use|aqa|learnlm|gemma|veo|imagen|banana|thinking-exp)/i;
const DATED = /-\d{4}-\d{2}-\d{2}$|-\d{3,4}$|-\d{2}-\d{2}$/;

async function getJSON(url, headers) {
  const r = await fetch(url, { headers });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = data?.error?.message || data?.error?.type || r.statusText || '';
    throw Object.assign(new Error(r.status === 401 || r.status === 403 || /api.?key/i.test(msg) ? `API 키가 올바르지 않다 (${r.status})` : `목록 조회 실패 (${r.status}) ${msg}`.trim()), { status: r.status });
  }
  return data;
}
function verNum(id) { const m = String(id).match(/(\d+(?:\.\d+)?)/); return m ? parseFloat(m[1]) : 0; }
function prettyOpenAI(id) { return id.replace(/^gpt-/i, 'GPT-').replace(/^o(\d)/, 'o$1').split('-').map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ').replace(/^GPT /, 'GPT-'); }

const discoverers = {
  async openai(key) {
    const d = await getJSON('https://api.openai.com/v1/models', { Authorization: `Bearer ${key}` });
    return (d.data || [])
      .filter((m) => /^(gpt-|o\d|chatgpt-)/i.test(m.id) && !SKIP_OPENAI.test(m.id) && !DATED.test(m.id))
      .sort((a, b) => (b.created || 0) - (a.created || 0) || verNum(b.id) - verNum(a.id))
      .map((m) => ({ provider: 'openai', model: m.id, label: prettyOpenAI(m.id) }));
  },
  async gemini(key) {
    const d = await getJSON('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', { 'x-goog-api-key': key });
    return (d.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m) => ({ ...m, id: String(m.name || '').replace(/^models\//, '') }))
      .filter((m) => /^gemini-/i.test(m.id) && !SKIP_GEMINI.test(m.id) && !DATED.test(m.id))
      .sort((a, b) => verNum(b.id) - verNum(a.id) || (/preview|exp/.test(a.id) ? 1 : 0) - (/preview|exp/.test(b.id) ? 1 : 0) || a.id.localeCompare(b.id))
      .map((m) => ({ provider: 'gemini', model: m.id, label: m.displayName || m.id }));
  },
  async anthropic(key) {
    const d = await getJSON('https://api.anthropic.com/v1/models?limit=100', { 'x-api-key': key, 'anthropic-version': '2023-06-01' });
    return (d.data || [])
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
      .map((m) => ({ provider: 'anthropic', model: m.id, label: m.display_name || m.id }));
  },
};

let cache = { at: 0, value: null };
const TTL = 10 * 60 * 1000;

export async function discover(force = false) {
  if (!force && cache.value && Date.now() - cache.at < TTL) return cache.value;
  const keys = KEYS();
  const limit = Math.max(1, Number(env('AI_MODEL_LIMIT')) || 15);
  const exclude = env('AI_MODELS_EXCLUDE').split(',').map((s) => s.trim()).filter(Boolean);
  const providers = {};
  const lists = await Promise.all(Object.keys(discoverers).map(async (p) => {
    if (!keys[p]) { providers[p] = { ok: false, configured: false, count: 0, error: '키가 등록되지 않았다' }; return []; }
    try {
      const list = (await discoverers[p](keys[p])).filter((m) => !exclude.some((x) => m.model.startsWith(x))).slice(0, limit);
      providers[p] = { ok: list.length > 0, configured: true, count: list.length, error: list.length ? '' : '쓸 수 있는 대화형 모델이 없다' };
      return list;
    } catch (err) {
      providers[p] = { ok: false, configured: true, count: 0, error: err.message };
      return [];
    }
  }));
  let list = lists.flat();
  // 직접 지정한 모델 추가 (키가 있는 회사만)
  try {
    const extra = env('AI_MODELS') ? JSON.parse(env('AI_MODELS')) : [];
    extra.filter((m) => m && keys[m.provider] && m.model).forEach((m) => {
      if (!list.some((x) => x.provider === m.provider && x.model === m.model)) list.unshift({ provider: m.provider, model: m.model, label: m.label || m.model });
    });
  } catch (_) { /* 잘못된 JSON은 무시 */ }
  list = list.map((m) => ({ ...m, id: `${m.provider}:${m.model}`, group: PROVIDER_NAME[m.provider] }));
  const value = { list, providers };
  // 목록 조회가 실패한 회사가 있으면 오래 캐시하지 않는다.
  cache = { at: Object.values(providers).some((p) => p.configured && !p.ok) ? Date.now() - TTL + 60000 : Date.now(), value };
  return value;
}
export async function models() { return (await discover()).list; }

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
    r = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ model: m.model, instructions: system, input: prompt }) });
    data = await r.json().catch(() => ({}));
    if (r.ok) {
      const text = typeof data.output_text === 'string' ? data.output_text
        : (data.output || []).flatMap((o) => o.content || []).filter((c) => c.type === 'output_text' || c.type === 'text').map((c) => c.text).join('');
      return String(text || '').trim();
    }
    if (r.status === 404 || r.status === 400) { // Responses API를 지원하지 않는 모델이면 예전 방식으로 한 번 더
      const r2 = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ model: m.model, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] }) });
      const d2 = await r2.json().catch(() => ({}));
      if (r2.ok) return (d2.choices?.[0]?.message?.content || '').trim();
    }
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
    : r.status === 404 ? `모델 「${m.model}」을 쓸 수 없다. 이 키의 계정에 해당 모델 권한이 있는지 확인하거나 다른 모델을 고른다.`
    : r.status === 429 ? '사용량 한도를 넘었거나 결제(크레딧)가 필요하다. 잠시 후 다시 하거나 다른 모델을 고른다.'
    : 'AI 호출에 실패했다.';
  throw Object.assign(new Error(`${hint}\n[${m.provider} ${r.status}] ${msg}`), { status: 502 });
}
