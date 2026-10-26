// Vercel 서버 함수 공통 — API 키는 Vercel 환경변수에만 있고 브라우저로 보내지 않는다.
const env = (k) => (process.env[k] || '').trim();
const keyEnv = (k) => env(k).replace(/^["']|["']$/g, '').replace(/\s+/g, '');

export const KEYS = () => ({
  openai: keyEnv('OPENAI_API_KEY') || keyEnv('CHATGPT_API_KEY'),
  gemini: keyEnv('GEMINI_API_KEY') || keyEnv('GOOGLE_API_KEY') || keyEnv('GOOGLE_GENERATIVE_AI_API_KEY'),
  anthropic: keyEnv('ANTHROPIC_API_KEY') || keyEnv('CLAUDE_API_KEY'),
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

/* 회사별 오류를 사회복지사가 이해할 수 있는 말과 해결 방법으로 바꾼다. */
export function explainError(provider, status, data, model) {
  const err = data?.error || {};
  const code = String(err.code || err.type || err.status || '');
  const msg = String(err.message || data?.message || '');
  const all = (code + ' ' + msg).toLowerCase();
  const tag = `[${provider} ${status}${code ? ' ' + code : ''}] ${msg}`.trim();
  let hint;
  if (provider === 'openai') {
    if (/insufficient_quota|exceeded your current quota|billing/.test(all)) hint = 'OpenAI 계정에 크레딧(잔액)이 없다. platform.openai.com → Settings → Billing 에서 결제수단 등록 후 크레딧을 충전한다. (ChatGPT Plus 구독과 API 요금은 별개다)';
    else if (/invalid_api_key|incorrect api key/.test(all) || status === 401 && !/permission/.test(all)) hint = 'OpenAI API 키가 올바르지 않다. platform.openai.com/api-keys 에서 새 키를 만들어 Vercel의 OPENAI_API_KEY에 다시 넣고 Redeploy 한다.';
    else if (/insufficient permissions|missing scopes|restricted/.test(all)) hint = '이 키는 권한이 제한된 키(Restricted)다. 새 키를 만들 때 Permissions를 「All」로 선택한다.';
    else if (/verif/.test(all)) hint = `「${model}」은(는) OpenAI 조직 인증(Verify Organization)이 필요한 모델이다. platform.openai.com → Settings → Organization → General 에서 인증하거나, 다른 GPT 모델을 고른다.`;
    else if (status === 404 || /model_not_found|does not exist|do not have access/.test(all)) hint = `이 키로는 「${model}」을 쓸 수 없다. 다른 GPT 모델을 고른다. (사용량 등급(Tier)이 낮으면 최신 모델이 막혀 있을 수 있다)`;
    else if (status === 429) hint = '요청이 너무 많다(사용량 등급 한도). 잠시 후 다시 하거나 다른 모델을 고른다.';
    else if (status === 400) hint = `「${model}」이 이 요청 형식을 받지 않는다. 다른 GPT 모델을 고른다.`;
  } else if (provider === 'gemini') {
    if (/api key not valid|api_key_invalid/.test(all)) hint = 'Gemini API 키가 올바르지 않다. aistudio.google.com/apikey 에서 키를 다시 복사한다.';
    else if (status === 429 || /quota|resource_exhausted/.test(all)) hint = 'Gemini 사용량 한도를 넘었다. 무료 등급이면 잠시 후 다시 하거나, AI Studio에서 결제를 연결한다. (최신 Pro 모델은 무료 등급에서 막혀 있을 수 있다)';
    else if (status === 404) hint = `「${model}」을 쓸 수 없다. 다른 Gemini 모델을 고른다.`;
    else if (/location|region/.test(all)) hint = '이 지역에서 Gemini API를 쓸 수 없다는 응답이다.';
  } else if (provider === 'anthropic') {
    if (/credit balance|billing/.test(all)) hint = 'Anthropic 계정 크레딧이 부족하다. console.anthropic.com → Billing 에서 충전한다.';
    else if (status === 401) hint = 'Claude API 키가 올바르지 않다. console.anthropic.com/settings/keys 에서 새 키를 만들어 넣는다.';
    else if (status === 404) hint = `「${model}」을 쓸 수 없다. 다른 Claude 모델을 고른다.`;
    else if (status === 429 || status === 529) hint = 'Claude 사용량 한도이거나 서버가 붐빈다. 잠시 후 다시 한다.';
  }
  if (!hint) hint = status === 401 || status === 403 ? 'API 키가 올바르지 않거나 권한이 없다.' : status >= 500 ? `${PROVIDER_NAME[provider] || provider} 서버에 일시적인 문제가 있다. 잠시 후 다시 한다.` : 'AI 호출에 실패했다.';
  return `${hint}\n${tag}`;
}

async function openaiResponses(key, model, system, prompt) {
  const r = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ model, instructions: system, input: prompt, store: false }) });
  const data = await r.json().catch(() => ({}));
  if (r.ok) {
    if (data.status === 'incomplete' && !data.output?.length) return { ok: false, status: 502, data: { error: { message: '응답이 중간에 끊겼다: ' + (data.incomplete_details?.reason || '') } } };
    const text = typeof data.output_text === 'string' && data.output_text ? data.output_text
      : (data.output || []).filter((o) => o.type === 'message').flatMap((o) => o.content || []).filter((c) => c.type === 'output_text' || c.type === 'text').map((c) => c.text).join('');
    return { ok: true, text: String(text || '').trim() };
  }
  return { ok: false, status: r.status, data };
}
async function openaiChat(key, model, system, prompt) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] }) });
  const data = await r.json().catch(() => ({}));
  if (r.ok) return { ok: true, text: (data.choices?.[0]?.message?.content || '').trim() };
  return { ok: false, status: r.status, data };
}

export async function callModel(m, system, prompt) {
  const key = KEYS()[m.provider];
  if (!key) throw Object.assign(new Error(`${PROVIDER_NAME[m.provider]} API 키가 Vercel에 등록되지 않았다.`), { status: 503 });
  let r, data;
  if (m.provider === 'openai') {
    const a = await openaiResponses(key, m.model, system, prompt);
    if (a.ok) return a.text;
    // 키·크레딧 문제가 아니면 예전 방식(Chat Completions)으로 한 번 더 시도한다.
    const keyProblem = a.status === 401 || /insufficient_quota|invalid_api_key/.test(JSON.stringify(a.data?.error || {}));
    if (!keyProblem) { const b = await openaiChat(key, m.model, system, prompt); if (b.ok) return b.text; if (a.status === 404 || a.status === 400) { r = { status: b.status }; data = b.data; } }
    if (!r) { r = { status: a.status }; data = a.data; }
  } else if (m.provider === 'gemini') {
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m.model)}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: prompt }] }] }) });
    data = await r.json().catch(() => ({}));
    if (r.ok) return (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();
  } else if (m.provider === 'anthropic') {
    r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: m.model, max_tokens: 16000, system, messages: [{ role: 'user', content: prompt }] }) });
    data = await r.json().catch(() => ({}));
    if (r.ok) return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  } else throw Object.assign(new Error('알 수 없는 회사'), { status: 400 });
  throw Object.assign(new Error(explainError(m.provider, r.status, data, m.model)), { status: 502 });
}

/* 연결 점검: 키 형식 → 모델 목록 → 실제 짧은 호출(가벼운 모델부터 최대 3개) */
const KEY_PREFIX = { openai: /^sk-/, gemini: /^AIza/, anthropic: /^sk-ant-/ };
export async function diagnose(provider) {
  const key = KEYS()[provider];
  const out = { provider, steps: [] };
  if (!key) { out.steps.push({ name: '키 등록', ok: false, detail: `Vercel 환경변수에 키가 없다. (${{ openai: 'OPENAI_API_KEY', gemini: 'GEMINI_API_KEY', anthropic: 'ANTHROPIC_API_KEY' }[provider]})` }); return out; }
  const raw = process.env[{ openai: 'OPENAI_API_KEY', gemini: 'GEMINI_API_KEY', anthropic: 'ANTHROPIC_API_KEY' }[provider]] || '';
  const fmtOk = KEY_PREFIX[provider].test(key);
  out.steps.push({ name: '키 형식', ok: fmtOk, detail: fmtOk ? `${key.slice(0, 6)}… (${key.length}자)${raw !== raw.trim() || /["'\s]/.test(raw.trim()) ? ' · 앞뒤 공백/따옴표는 자동으로 지웠다' : ''}` : `키가 ${KEY_PREFIX[provider].source.replace(/[\^\\/]/g, '')}로 시작하지 않는다. 다른 회사 키나 잘못 복사한 값일 수 있다.` });
  let list = [];
  try { list = await discoverers[provider](key); out.steps.push({ name: '모델 목록', ok: list.length > 0, detail: list.length ? `대화형 모델 ${list.length}개 확인 (예: ${list.slice(0, 4).map((m) => m.model).join(', ')})` : '쓸 수 있는 대화형 모델이 없다.' }); }
  catch (err) { out.steps.push({ name: '모델 목록', ok: false, detail: err.message }); return out; }
  const light = /(mini|nano|flash|haiku|lite|luna)/i;
  const order = [...list.filter((m) => light.test(m.model)), ...list.filter((m) => !light.test(m.model))].slice(0, 3);
  for (const m of order) {
    const t0 = Date.now();
    try { const text = await callModel({ ...m, id: `${provider}:${m.model}` }, '짧게 답한다.', 'OK라고만 답한다.'); out.steps.push({ name: `호출 · ${m.model}`, ok: true, detail: `${Date.now() - t0}ms · 응답 "${text.slice(0, 20)}"` }); break; }
    catch (err) { out.steps.push({ name: `호출 · ${m.model}`, ok: false, detail: err.message }); if (/키가 올바르지|크레딧|잔액|Restricted/.test(err.message)) break; }
  }
  return out;
}
