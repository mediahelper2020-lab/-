// 교육·시연용 가상 예시 데이터 — 실제 인물·기관 이용자 정보가 아닙니다.

function loadSampleData() {
  if (state.cases.some(c => c.sample) && !confirm('이미 예시 데이터가 있습니다. 한 번 더 추가할까요?')) return;
  const base = new Date();
  const ago = (days) => { const d = new Date(base); d.setDate(d.getDate() - days); return d.toISOString().slice(0, 10); };
  const ahead = (days) => ago(-days);
  const people = [
    { label: '가온(가명)', gender: '남', birth: '1998', dis: '지적장애', worker: '김복지', steps: 14, start: 900, status: '진행중', dream: '카페에서 바리스타로 일하고 싶어요', areas: ['직업', '소득재정', '문화여가'] },
    { label: '나래(가명)', gender: '여', birth: '2001', dis: '자폐성장애', worker: '김복지', steps: 11, start: 520, status: '진행중', dream: '혼자 버스를 타고 도서관에 가고 싶어요', areas: ['교육', '주거', '문화여가'] },
    { label: '다온(가명)', gender: '남', birth: '1990', dis: '지적장애', worker: '이사랑', steps: 9, start: 400, status: '진행중', dream: '친구들과 등산 모임을 하고 싶어요', areas: ['문화여가', '보건의료'] },
    { label: '라희(가명)', gender: '여', birth: '1995', dis: '지적장애', worker: '이사랑', steps: 7, start: 300, status: '진행중', dream: '내 방을 내가 꾸미고 싶어요', areas: ['주거', '법적'] },
    { label: '마루(가명)', gender: '남', birth: '1987', dis: '자폐성장애', worker: '박나눔', steps: 5, start: 200, status: '진행중', dream: '요리를 배워서 가족에게 밥을 해주고 싶어요', areas: ['교육', '결혼'] },
    { label: '보라(가명)', gender: '여', birth: '2004', dis: '지적장애', worker: '박나눔', steps: 3, start: 90, status: '진행중', dream: '노래 동아리에 들어가고 싶어요', areas: ['문화여가'] },
    { label: '새롬(가명)', gender: '여', birth: '1993', dis: '지적장애', worker: '김복지', steps: 6, start: 450, status: '보류', dream: '건강하게 운동하고 싶어요', areas: ['보건의료'] },
    { label: '아라(가명)', gender: '남', birth: '1985', dis: '자폐성장애', worker: '이사랑', steps: 14, start: 1200, status: '자조활동 연계', dream: '동료들과 자조모임을 계속하고 싶어요', areas: ['법적', '문화여가', '직업'] },
  ];
  const levels = ['달성', '부분 달성', '진행 중', '달성', '미달성'];
  const goalText = {
    교육: ['주 1회 평생학습관 요리 수업에 참여한다', '활동지원사와 함께 수업 일정을 확인하고 참석한다'],
    보건의료: ['6개월마다 정기 건강검진을 받는다', '보호자와 병원 예약, 복지관 동행 지원'],
    문화여가: ['한 달에 2번 지역 동호회 활동에 참여한다', '시민옹호인과 함께 동호회를 찾아 참여한다'],
    직업: ['직업훈련 과정을 수료한다', '장애인직업재활기관 연계, 출퇴근 연습'],
    결혼: ['좋아하는 사람에게 마음을 표현하는 방법을 배운다', '관계 교육 프로그램 참여'],
    주거: ['내 방 청소와 정리를 스스로 한다', '주 2회 정리 체크리스트 사용'],
    법적: ['나를 응원하는 옹호인을 정한다', '시민옹호인 매칭 및 월 1회 만남'],
    소득재정: ['용돈기입장을 쓴다', '체크카드 사용 연습과 월말 점검'],
  };
  const added = people.map((s, idx) => {
    const c = normalizeCase({
      id: uid(), sample: true, label: s.label, created: new Date(ago(s.start)).toISOString(),
      meta: { status: s.status, start: ago(s.start), worker: s.worker, memo: '교육용 가상 예시' },
      intro: { gender: s.gender, birth: s.birth + '-01-01', disability_type: s.dis, dream: s.dream, one_word: '웃음이 많은 사람', date: ago(s.start - 30) },
      plan: {
        year: base.getFullYear(), stage: s.steps >= 9 ? '확정' : '초안', dream: s.dream, midGoal: `${s.dream} — 3년 안에 이루기`,
        domains: s.areas.map(a => ({ area: a, goal: goalText[a][0], plan: goalText[a][1], note: '' })),
      },
      process: {}, evals: [], activityLog: [], events: [],
    });
    STEPS.slice(0, s.steps).forEach((st, i) => {
      c.process[st.id] = { done: true, date: ago(Math.max(1, s.start - 30 - i * Math.floor(s.start / 16))), memo: '' };
    });
    if (s.steps >= 11) {
      c.activityLog.push({ date: ago(idx === 1 ? 120 : 40), kind: '분기', content: '동호회 활동 3회 참여, 스스로 버스 이용 시도', adjust: '활동 횟수 유지' });
      c.evals = c.plan.domains.map((_, i) => ({ level: levels[(idx + i) % levels.length], memo: '' }));
    }
    const nextStep = STEPS[s.steps];
    if (nextStep && s.status === '진행중') c.events.push({ id: uid(), kind: nextStep.phase === '계획' ? '지원회의' : '실천활동', date: ahead(3 + idx * 3), time: '14:00', title: nextStep.name, memo: '복지관 상담실', done: false });
    c.events.push({ id: uid(), kind: '상담', date: ago(idx * 2 + 1), time: '10:30', title: '정기 상담', memo: '', done: true });
    return c;
  });
  state.cases.push(...added);
  state.currentId = added[0].id;
  save(); render(); flash(`가상 예시 참여자 ${added.length}명을 추가했습니다`);
}
