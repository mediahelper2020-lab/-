// 네트워크: 환경변수(HTTPS_PROXY/HTTP_PROXY/NO_PROXY)가 있으면 그 프록시를 경유한다.
// 프록시 설정이 없는 일반 환경에서는 아무 영향 없이 그대로 직접 연결된다.
import { EnvHttpProxyAgent, setGlobalDispatcher } from "undici";
if (process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy) {
  try { setGlobalDispatcher(new EnvHttpProxyAgent()); } catch { /* noop */ }
}

// 보안 자가진단 스캐너 (방어적/수동 분석)
// 핵심 원칙:
//  - 본인 소유 사이트 점검 전용. 호출부에서 권한 확인을 강제한다.
//  - 브라우저가 어차피 내려받는 "공개된" 리소스(HTML/JS 번들/응답 헤더)만 분석한다.
//  - 공격/익스플로잇을 수행하지 않는다. 데이터를 변경하거나 대량 요청을 보내지 않는다.

const FETCH_TIMEOUT_MS = 12000;
const MAX_BYTES = 3 * 1024 * 1024; // 리소스당 최대 3MB
const MAX_JS_FILES = 25; // 분석할 외부 스크립트 최대 개수
const USER_AGENT = "WebappSecuritySelfCheck/1.0 (defensive self-assessment)";

function newFinding(severity, title, detail, howto, evidence) {
  return { severity, title, detail, howto, evidence: evidence || null };
}

// ---- 안전한 fetch (타임아웃 + 크기 제한) ----
async function safeFetch(url, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, ...(opts.headers || {}) },
      method: opts.method || "GET",
    });
    let body = "";
    if (opts.method !== "HEAD") {
      const reader = res.body?.getReader?.();
      if (reader) {
        const decoder = new TextDecoder();
        let received = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          received += value.length;
          if (received > MAX_BYTES) {
            try { await reader.cancel(); } catch { /* noop */ }
            break;
          }
          body += decoder.decode(value, { stream: true });
        }
      } else {
        body = await res.text();
        if (body.length > MAX_BYTES) body = body.slice(0, MAX_BYTES);
      }
    }
    return { ok: true, status: res.status, headers: res.headers, body, finalUrl: res.url };
  } catch (err) {
    return { ok: false, error: err.name === "AbortError" ? "요청 시간 초과" : String(err.message || err) };
  } finally {
    clearTimeout(timer);
  }
}

// ---- 민감정보/시크릿 패턴 ----
// 주의: 일부 키(예: Supabase anon 키, Firebase apiKey)는 "공개 전제"로 설계됨.
// 따라서 패턴마다 심각도를 다르게 둔다.
const SECRET_PATTERNS = [
  {
    re: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
    classify: (m) => {
      // JWT payload 디코드로 role 확인 (Supabase 키)
      try {
        const payload = JSON.parse(Buffer.from(m.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
        if (payload.role === "service_role") {
          return newFinding("critical", "Supabase service_role 키 노출 (매우 위험)",
            "클라이언트 코드에 service_role 키가 들어 있습니다. 이 키는 RLS(행 수준 보안)를 완전히 무시하므로, 누구나 DB의 모든 데이터를 읽고/수정/삭제할 수 있습니다.",
            "① 즉시 Supabase 대시보드에서 이 키를 폐기(rotate)하세요. ② service_role 키는 절대 프론트엔드/클라이언트에 넣지 말고 서버(Edge Function, 백엔드)에서만 사용하세요. ③ 코드에서 키를 제거하고 재배포하세요.",
            maskSecret(m));
        }
        if (payload.role === "anon") {
          return newFinding("info", "Supabase anon(공개) 키 발견",
            "anon 키는 공개되도록 설계된 키라 노출 자체는 정상입니다. 다만 이 키로 접근 가능한 모든 테이블은 RLS(행 수준 보안) 정책으로 반드시 보호되어야 합니다. RLS가 꺼져 있으면 이 키만으로 데이터가 전부 유출될 수 있습니다.",
            "Supabase 대시보드 > Authentication > Policies 에서 모든 테이블에 RLS가 '활성화'되어 있고, 적절한 정책이 걸려 있는지 확인하세요. 아래 'Supabase RLS 점검' 결과를 함께 보세요.",
            maskSecret(m));
        }
      } catch { /* JWT 아님 */ }
      return null; // 일반 JWT는 노이즈가 많아 보고하지 않음
    },
  },
  { re: /AIza[0-9A-Za-z_-]{35}/g, finding: () => newFinding("medium", "Google API 키 발견",
      "Google API 키가 코드에 노출되어 있습니다. Firebase/Maps 등에서는 공개가 불가피할 수 있으나, 키 제한(HTTP 리퍼러/도메인 제한, API 범위 제한)이 없으면 악용·과금 폭탄의 위험이 있습니다.",
      "Google Cloud Console에서 이 키에 '애플리케이션 제한(도메인)'과 'API 제한'을 설정하세요.") },
  { re: /AKIA[0-9A-Z]{16}/g, finding: () => newFinding("critical", "AWS Access Key ID 노출 (매우 위험)",
      "AWS 액세스 키가 클라이언트 코드에 노출되었습니다. AWS 계정이 탈취될 수 있습니다.",
      "즉시 AWS IAM에서 해당 키를 비활성화/삭제(rotate)하고, 키는 서버에서만 사용하세요.") },
  { re: /sk_live_[0-9a-zA-Z]{20,}/g, finding: () => newFinding("critical", "Stripe 라이브 시크릿 키 노출 (매우 위험)",
      "Stripe 결제 시크릿 키(sk_live_)가 노출되었습니다. 결제/환불을 임의로 조작당할 수 있습니다.",
      "즉시 Stripe 대시보드에서 키를 폐기(roll)하고, 시크릿 키는 서버에서만 사용하세요. 프론트엔드에는 공개 키(pk_)만 사용합니다.") },
  { re: /sk-ant-[a-zA-Z0-9_-]{20,}/g, finding: () => newFinding("critical", "Anthropic API 키 노출 (매우 위험)",
      "Anthropic(Claude) API 키가 노출되었습니다. 타인이 사용자의 비용으로 API를 호출할 수 있습니다.",
      "즉시 Anthropic Console에서 키를 폐기하고, API 호출은 서버(백엔드)를 거치도록 바꾸세요.") },
  { re: /sk-(?:proj-)?[a-zA-Z0-9]{20,}/g, finding: () => newFinding("critical", "OpenAI API 키로 보이는 값 노출 (매우 위험)",
      "OpenAI API 키로 보이는 값이 노출되었습니다. 타인이 사용자의 비용으로 API를 호출할 수 있습니다.",
      "즉시 OpenAI 대시보드에서 키를 폐기하고, API 호출은 서버를 거치도록 바꾸세요.") },
  { re: /gh[pousr]_[A-Za-z0-9]{36,}/g, finding: () => newFinding("critical", "GitHub 토큰 노출 (매우 위험)",
      "GitHub 개인 액세스 토큰이 노출되었습니다. 저장소 접근/수정이 가능할 수 있습니다.",
      "즉시 GitHub Settings > Developer settings 에서 토큰을 폐기하세요.") },
  { re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g, finding: () => newFinding("critical", "개인키(Private Key) 노출 (매우 위험)",
      "개인키가 클라이언트에 노출되었습니다.",
      "해당 키를 즉시 폐기/재발급하고 코드에서 제거하세요. 개인키는 절대 프론트엔드에 포함하지 마세요.") },
  { re: /(?:["'`]?(?:password|passwd|pwd|secret|api[_-]?secret|client[_-]?secret|private[_-]?key)["'`]?\s*[:=]\s*["'`])([^"'`\s]{6,})["'`]/gi,
    finding: (m) => newFinding("medium", "하드코딩된 비밀번호/시크릿으로 보이는 값",
      "코드에 password/secret 형태의 하드코딩된 값이 발견되었습니다. 실제 자격증명이라면 노출된 것입니다.",
      "실제 비밀값이면 폐기 후 환경변수/서버로 옮기세요. 테스트용 더미 값이면 무시해도 됩니다.",
      maskSecret(m)) },
];

function maskSecret(s) {
  if (!s) return s;
  const str = String(s);
  if (str.length <= 12) return str.slice(0, 3) + "***";
  return str.slice(0, 6) + "…" + str.slice(-4) + ` (길이 ${str.length})`;
}

function scanSecrets(text, sourceLabel, findings, seen) {
  for (const pat of SECRET_PATTERNS) {
    pat.re.lastIndex = 0;
    let m;
    let count = 0;
    while ((m = pat.re.exec(text)) !== null && count < 20) {
      count++;
      const matched = m[0];
      const key = (pat.re.source.slice(0, 12)) + "|" + maskSecret(matched);
      if (seen.has(key)) continue;
      seen.add(key);
      const f = pat.classify ? pat.classify(matched) : (pat.finding ? pat.finding(m[1] || matched) : null);
      if (f) {
        f.source = sourceLabel;
        findings.push(f);
      }
    }
  }
}

// ---- 보안 헤더 점검 ----
function checkSecurityHeaders(headers, findings) {
  const want = [
    { name: "content-security-policy", sev: "medium", label: "Content-Security-Policy (CSP)",
      why: "XSS·데이터 탈취를 크게 줄여주는 핵심 헤더입니다. 없으면 악성 스크립트 삽입 방어가 약해집니다.",
      howto: "응답에 Content-Security-Policy 헤더를 추가하세요. (호스팅/프레임워크 설정에서 지정)" },
    { name: "strict-transport-security", sev: "low", label: "Strict-Transport-Security (HSTS)",
      why: "HTTPS 강제. 없으면 중간자 공격으로 HTTP 다운그레이드 위험이 있습니다.",
      howto: "Strict-Transport-Security: max-age=31536000; includeSubDomains 를 추가하세요." },
    { name: "x-content-type-options", sev: "low", label: "X-Content-Type-Options",
      why: "브라우저의 MIME 스니핑을 막습니다.",
      howto: "X-Content-Type-Options: nosniff 를 추가하세요." },
    { name: "x-frame-options", sev: "low", label: "X-Frame-Options / frame-ancestors",
      why: "클릭재킹(화면 겹치기 공격) 방어입니다.",
      howto: "X-Frame-Options: DENY 또는 CSP의 frame-ancestors 'none' 을 설정하세요." },
    { name: "referrer-policy", sev: "info", label: "Referrer-Policy",
      why: "외부로 나가는 리퍼러에 민감한 URL이 새지 않도록 합니다.",
      howto: "Referrer-Policy: strict-origin-when-cross-origin 를 권장합니다." },
  ];
  for (const h of want) {
    if (!headers.has(h.name)) {
      findings.push(newFinding(h.sev, `보안 헤더 누락: ${h.label}`, h.why, h.howto));
    }
  }
  // CORS 와일드카드
  const acao = headers.get("access-control-allow-origin");
  if (acao === "*") {
    const acac = headers.get("access-control-allow-credentials");
    if (acac === "true") {
      findings.push(newFinding("high", "CORS 설정 위험: '*' + credentials",
        "Access-Control-Allow-Origin 이 '*' 인데 자격증명 허용이 켜져 있습니다(브라우저가 차단하지만 설정 자체가 위험 신호).",
        "허용 도메인을 명시적으로 지정하세요."));
    } else {
      findings.push(newFinding("info", "CORS가 모든 도메인(*) 허용",
        "공개 API라면 정상일 수 있으나, 인증이 필요한 API라면 특정 도메인만 허용하는 것이 안전합니다.",
        "필요한 도메인만 Access-Control-Allow-Origin 으로 지정하세요."));
    }
  }
  // 서버 정보 노출
  const server = headers.get("server");
  const xpb = headers.get("x-powered-by");
  if (xpb) findings.push(newFinding("info", `기술 스택 노출: X-Powered-By: ${xpb}`,
    "사용 중인 기술/버전이 노출되면 공격자가 알려진 취약점을 노리기 쉬워집니다.",
    "X-Powered-By 헤더를 끄세요 (예: Express 는 app.disable('x-powered-by'))."));
  if (server && /\d/.test(server)) findings.push(newFinding("info", `서버 버전 노출: Server: ${server}`,
    "서버 소프트웨어 버전이 노출되었습니다.",
    "Server 헤더에서 버전 정보를 숨기도록 설정하세요."));
}

// ---- HTML에서 스크립트/소스맵 추출 ----
function extractScripts(html, baseUrl) {
  const urls = new Set();
  const re = /<script[^>]+src=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    try { urls.add(new URL(m[1], baseUrl).href); } catch { /* skip */ }
  }
  // 모듈 preload / link
  const re2 = /<link[^>]+href=["']([^"']+\.js)["']/gi;
  while ((m = re2.exec(html)) !== null) {
    try { urls.add(new URL(m[1], baseUrl).href); } catch { /* skip */ }
  }
  return [...urls];
}

// ---- Supabase 설정 탐지 + 안전한 RLS 점검 ----
async function detectSupabase(allText, findings) {
  const urlMatch = allText.match(/https:\/\/[a-z0-9]{10,30}\.supabase\.co/i);
  if (!urlMatch) return null;
  const supaUrl = urlMatch[0];
  // anon 키 추출 (role=anon JWT)
  let anonKey = null;
  const jwtRe = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;
  let jm;
  while ((jm = jwtRe.exec(allText)) !== null) {
    try {
      const payload = JSON.parse(Buffer.from(jm[0].split(".")[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
      if (payload.role === "anon") { anonKey = jm[0]; break; }
    } catch { /* skip */ }
  }
  findings.push(newFinding("info", `Supabase 프로젝트 감지: ${supaUrl}`,
    "이 앱은 Supabase를 백엔드로 사용합니다. Supabase의 보안은 대부분 RLS(행 수준 보안) 정책에 달려 있습니다.",
    "아래 RLS 점검 결과를 확인하세요."));

  if (!anonKey) return { supaUrl, anonKey: null };

  // 안전한 읽기 전용 점검: REST 루트에 anon 키로 접근 → OpenAPI 스키마(테이블 목록) 노출 여부
  // 데이터를 덤프하지 않고, 스키마 메타데이터만 확인한다.
  const probe = await safeFetch(`${supaUrl}/rest/v1/`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });
  if (probe.ok && probe.status === 200 && /"paths"|"definitions"|"swagger"|"openapi"/i.test(probe.body)) {
    let tables = [];
    try {
      const spec = JSON.parse(probe.body);
      tables = Object.keys(spec.definitions || spec.components?.schemas || {}).filter((t) => t !== "(rpc)");
    } catch { /* ignore parse */ }
    const tableNote = tables.length ? ` 익명 키로 조회된 테이블/뷰: ${tables.slice(0, 30).join(", ")}${tables.length > 30 ? " …" : ""}` : "";
    findings.push(newFinding("medium", "Supabase 스키마가 익명(anon) 키로 열람 가능",
      "anon 키만으로 데이터베이스 스키마(테이블 목록)를 조회할 수 있습니다. 이 자체가 치명적이진 않지만, 각 테이블에 RLS 정책이 올바로 걸려있지 않으면 실제 데이터까지 유출될 수 있습니다." + tableNote,
      "Supabase 대시보드 > Table Editor 의 모든 테이블에서 'Enable RLS'가 켜져 있는지, 그리고 Authentication > Policies 에 의도한 정책만 있는지 반드시 확인하세요. 공개가 필요 없는 테이블은 anon 역할의 SELECT 권한을 제거하세요."));
  } else if (probe.ok) {
    findings.push(newFinding("info", "Supabase REST 스키마 열람 제한됨",
      "익명 키로 스키마 전체를 가져오지 못했습니다(좋은 신호일 수 있음). 그래도 개별 테이블 RLS는 직접 확인하는 것이 안전합니다.",
      "Supabase 대시보드에서 각 테이블의 RLS 활성화 여부를 확인하세요."));
  }
  return { supaUrl, anonKey: maskSecret(anonKey) };
}

// ---- 흔한 민감 경로 노출 점검 (본인 사이트 대상, GET만) ----
async function checkExposedPaths(origin, findings) {
  const paths = [
    { p: "/.env", sev: "critical", label: ".env 환경변수 파일" },
    { p: "/.git/config", sev: "high", label: ".git 저장소 노출" },
    { p: "/config.json", sev: "low", label: "config.json" },
    { p: "/.env.local", sev: "critical", label: ".env.local" },
    { p: "/backup.sql", sev: "critical", label: "DB 백업 파일" },
  ];
  await Promise.all(paths.map(async (item) => {
    const res = await safeFetch(origin + item.p);
    if (!res.ok) return;
    if (res.status === 200 && res.body && res.body.length > 0) {
      // HTML(보통 SPA fallback)인지 실제 파일인지 간단 판별
      const looksHtml = /<!doctype html>|<html/i.test(res.body.slice(0, 200));
      if (item.p === "/.env" && !/=/.test(res.body.slice(0, 500))) return;
      if (looksHtml && item.p !== "/.git/config") return;
      findings.push(newFinding(item.sev, `민감 파일 접근 가능: ${item.label} (${item.p})`,
        `${item.p} 경로가 공개적으로 접근 가능합니다. 환경변수/백업/소스가 그대로 노출될 수 있습니다.`,
        "해당 파일을 공개 경로에서 제거하고, 배포 시 포함되지 않도록 .gitignore / 빌드 설정을 점검하세요."));
    }
  }));
}

// ---- 메인 스캔 ----
export async function runScan(targetUrl) {
  const findings = [];
  const seen = new Set();
  const meta = { target: targetUrl, scannedAt: new Date().toISOString(), resources: [] };

  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return { error: "올바른 URL이 아닙니다. 예: https://my-app.vercel.app" };
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    return { error: "http 또는 https URL만 점검할 수 있습니다." };
  }
  if (parsed.protocol === "http:") {
    findings.push(newFinding("high", "HTTPS 미사용",
      "사이트가 HTTP로 제공됩니다. 통신 내용이 암호화되지 않아 가로채기/변조 위험이 있습니다.",
      "HTTPS를 적용하세요. 대부분의 호스팅(Vercel/Netlify 등)은 무료 HTTPS를 제공합니다."));
  }

  // 1) 메인 페이지
  const main = await safeFetch(targetUrl);
  if (!main.ok) {
    return { error: `사이트에 접속할 수 없습니다: ${main.error}` };
  }
  meta.finalUrl = main.finalUrl;
  meta.status = main.status;
  const origin = new URL(main.finalUrl || targetUrl).origin;

  checkSecurityHeaders(main.headers, findings);
  scanSecrets(main.body, "메인 HTML", findings, seen);
  meta.resources.push({ url: main.finalUrl, bytes: main.body.length, type: "html" });

  // 2) 외부 스크립트 (같은 오리진 우선)
  let scripts = extractScripts(main.body, main.finalUrl || targetUrl);
  scripts.sort((a, b) => {
    const sa = a.startsWith(origin) ? 0 : 1;
    const sb = b.startsWith(origin) ? 0 : 1;
    return sa - sb;
  });
  scripts = scripts.slice(0, MAX_JS_FILES);

  let combinedText = main.body;
  await Promise.all(scripts.map(async (su) => {
    const r = await safeFetch(su);
    if (r.ok && r.body) {
      scanSecrets(r.body, su.replace(origin, ""), findings, seen);
      combinedText += "\n" + r.body;
      meta.resources.push({ url: su, bytes: r.body.length, type: "js" });
      // 소스맵 노출 점검
      if (/\/\/[#@]\s*sourceMappingURL=([^\s]+\.map)/.test(r.body)) {
        const mm = r.body.match(/\/\/[#@]\s*sourceMappingURL=([^\s]+\.map)/);
        try {
          const mapUrl = new URL(mm[1], su).href;
          const mapRes = await safeFetch(mapUrl, { method: "HEAD" });
          if (mapRes.ok && mapRes.status === 200) {
            findings.push(newFinding("low", "소스맵(.map) 공개",
              `${mapUrl} — 소스맵이 공개되어 원본 소스가 복원될 수 있습니다. 치명적이진 않지만, 민감한 주석/로직이 그대로 노출됩니다.`,
              "운영 빌드에서는 소스맵을 비공개(또는 미생성)로 설정하세요."));
          }
        } catch { /* skip */ }
      }
    }
  }));

  // 3) Supabase 탐지 + RLS 점검
  const supa = await detectSupabase(combinedText, findings);
  meta.supabase = supa || null;

  // 4) 흔한 민감 경로
  await checkExposedPaths(origin, findings);

  // 정렬: 심각도 순
  const order = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  findings.sort((a, b) => order[a.severity] - order[b.severity]);

  const summary = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) summary[f.severity]++;

  return { meta, summary, findings };
}
