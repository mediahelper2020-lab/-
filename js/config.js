// Supabase 연결 설정 — 두 값을 비워두면 DB 없이 이 브라우저에만 저장(로컬 모드)으로 동작합니다.
// · supabaseUrl: Supabase 대시보드 → Project Settings → API → Project URL
// · supabaseAnonKey: 같은 화면의 anon(public) 키 또는 Publishable 키
//   이 키는 웹에 공개되어도 되는 키이며, 데이터 보호는 DB의 RLS 정책이 담당합니다.
// ⚠ service_role 키·Secret 키는 절대 넣지 마세요(모든 보안 정책을 무시합니다). 넣으면 앱이 실행을 거부합니다.
window.PPP_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  idleLogoutMinutes: 30, // 이 시간 동안 조작이 없으면 자동 로그아웃
  // 로그인 화면 '체험하기(관리자 키)': 맞게 넣으면 DB 연결 없이 가상 예시 데이터 화면을 보여줍니다.
  // 화면 소스에 그대로 보이는 값이라 보안용 비밀번호가 아니며, 실제 기록·DB 권한과는 무관합니다. 비우면 체험하기가 사라집니다.
  demoKey: '1212',
};
