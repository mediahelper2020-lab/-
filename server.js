import express from "express";
import { fileURLToPath } from "url";
import path from "path";
import { runScan } from "./lib/scanner.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "64kb" }));
app.use(express.static(path.join(__dirname, "public")));

// 간단한 레이트 리밋 (오남용 방지)
const hits = new Map();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;
app.use("/api/scan", (req, res, next) => {
  const ip = req.ip || "unknown";
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= MAX_PER_WINDOW) {
    return res.status(429).json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도하세요." });
  }
  arr.push(now);
  hits.set(ip, arr);
  next();
});

// SSRF 방지: 내부/사설 대상 차단
function isDisallowedHost(hostname) {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "0.0.0.0" || h.endsWith(".localhost") || h.endsWith(".internal") || h.endsWith(".local")) return true;
  // IPv4 사설/루프백/링크로컬
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 169 && b === 254) return true; // 링크로컬 (클라우드 메타데이터 포함)
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  if (h === "[::1]" || h.startsWith("[fd") || h.startsWith("[fe80")) return true;
  return false;
}

app.post("/api/scan", async (req, res) => {
  const { url, authorized } = req.body || {};
  if (!authorized) {
    return res.status(400).json({ error: "본인 소유 또는 점검 권한이 있는 사이트임을 먼저 확인해주세요." });
  }
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "점검할 URL을 입력하세요." });
  }
  let parsed;
  try {
    parsed = new URL(url.trim());
  } catch {
    return res.status(400).json({ error: "올바른 URL 형식이 아닙니다. 예: https://my-app.vercel.app" });
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    return res.status(400).json({ error: "http/https 주소만 점검할 수 있습니다." });
  }
  if (isDisallowedHost(parsed.hostname)) {
    return res.status(400).json({ error: "내부/사설 네트워크 주소는 점검할 수 없습니다." });
  }
  try {
    const result = await runScan(parsed.href);
    return res.json(result);
  } catch (err) {
    console.error("scan error:", err);
    return res.status(500).json({ error: "점검 중 오류가 발생했습니다: " + String(err.message || err) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`보안 자가진단 도구 실행 중: http://localhost:${PORT}`);
});
