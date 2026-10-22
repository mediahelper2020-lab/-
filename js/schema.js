// 평생과정설계(PPP) 양식 정의 — 한글 원본 서식(자기소개서 / 미래설계 실천계획서)을 데이터로 옮긴 것
// 필드 타입: heading, note, text, textarea, radio, check, grid, scale

const LEVELS = ['시도하지않음', '수행불가', '가끔씩', '도움주면가능', '수행가능'];
const WEEK = ['월', '화', '수', '목', '금', '토', '일'];
const DOMAINS = ['교육', '보건의료', '문화여가', '직업', '결혼', '주거', '법적', '소득재정'];

// AI로 보낼 때 제외할 개인식별 필드
const PRIVATE_FIELDS = ['name', 'birth', 'phone', 'phone2', 'address', 'family', 'advocate_name', 'advocate_phone', 'writer', 'supporter'];

const INTRO_SCHEMA = [
  {
    section: '기본', title: '작성 정보',
    desc: '「행복을 이루기 위한 “나”의 이야기」는 평생과정설계 계획수립의 기본 자료입니다. “나”는 장애 당사자를 의미하며, 당사자와 가족이 함께 작성하는 것이 가장 좋습니다.',
    fields: [
      { type: 'text', id: 'date', label: '작성일', input: 'date' },
      { type: 'text', id: 'writer', label: '작성자' },
      { type: 'text', id: 'supporter', label: '지원자(담당 사회복지사)' },
    ],
  },
  {
    section: '나를 소개합니다', title: '나를 소개합니다',
    fields: [
      { type: 'textarea', id: 'photo_desc', label: '♥ 내가 가장 멋있게 나온 사진을 설명해주세요', rows: 2 },
      { type: 'text', id: 'one_word', label: '“나”를 한마디로 표현하기' },
      { type: 'heading', text: '○ 나의 기본정보' },
      { type: 'text', id: 'name', label: '이름', private: true },
      { type: 'radio', id: 'gender', label: '성별', options: ['남', '여'] },
      { type: 'text', id: 'birth', label: '생년월일', placeholder: '예: 1995-03-02 (양력)', private: true },
      { type: 'text', id: 'phone', label: '연락처(나)', private: true },
      { type: 'text', id: 'phone2', label: '긴급연락처', private: true },
      { type: 'text', id: 'address', label: '주소', private: true },
      { type: 'text', id: 'disability_type', label: '장애유형' },
      { type: 'textarea', id: 'disability_trait', label: '장애특성', rows: 2 },
      { type: 'radio', id: 'pa_use', label: '활동지원서비스', options: ['이용함', '이용안함'] },
      { type: 'text', id: 'pa_hours', label: '활동지원 시간(월)', placeholder: '예: 월 120시간' },
      { type: 'textarea', id: 'pa_content', label: '활동지원 내용', rows: 2 },
      { type: 'text', id: 'blood', label: '혈액형' },
      { type: 'text', id: 'vision', label: '시력' },
      { type: 'text', id: 'height', label: '키(cm)' },
      { type: 'text', id: 'weight', label: '몸무게(kg)' },
      { type: 'text', id: 'size', label: '사이즈', placeholder: '상의 / 하의 / 신발' },
      { type: 'text', id: 'religion', label: '종교 (종교시설 활동)' },
      { type: 'text', id: 'nickname', label: '별명' },
      { type: 'textarea', id: 'personality', label: '성격', rows: 2 },
      { type: 'textarea', id: 'basic_etc', label: '기타', rows: 2 },
      { type: 'heading', text: '○ 나의 특성' },
      { type: 'textarea', id: 'good_at', label: '내가 잘하는 것 (좋은 점, 좋은 습관 등)' },
      { type: 'textarea', id: 'memory', label: '내가 좋아하는 이야기 또는 추억' },
      { type: 'textarea', id: 'liked_by', label: '사람들이 좋아하는 나의 모습' },
      {
        type: 'grid', id: 'likes', label: '좋아하는 것 / 싫어하는 것',
        cols: ['내가 좋아하는 것 (기분 좋게 하는 것)', '내가 싫어하는 것 (어렵게 하는 것)'],
        rowLabels: ['상황', '공간', '사람', '활동', '물건', '음식', '의사표현', '기타(색깔, 음악 등)'],
      },
      { type: 'textarea', id: 'comfort', label: '나를 편안하게 하는 방법' },
      { type: 'textarea', id: 'console', label: '나에게 위로를 주는 방법' },
      { type: 'heading', text: '○ 나와 함께 하고 있는 사람들' },
      { type: 'grid', id: 'family', label: '함께하는 사람', cols: ['관계', '이름', '나이', '직업', '전화번호', '도움을 주는 내용'], rows: 4, private: true },
      { type: 'textarea', id: 'anniversary', label: '나와 가족이 기념하는 행사와 기념하는 방법' },
      { type: 'textarea', id: 'friends', label: '나의 친구(지인 등) 소개 및 함께 하는 방법' },
      { type: 'textarea', id: 'orgs', label: '내가 소속된 기관(단체 등)과 활동 방법' },
    ],
  },
  {
    section: '꿈과 행복 찾기', title: '꿈과 행복 찾기',
    fields: [
      { type: 'heading', text: '○ 나의 일상 나누기' },
      { type: 'grid', id: 'routine', label: '하루 일과', cols: ['하루 일과', '나만의 중요한 규칙(루틴)'], rowLabels: ['아침', '점심', '저녁', '밤'] },
      { type: 'grid', id: 'week_now', label: '현재 주간 활동', cols: ['관계(누구와)', '활동(무엇을)', '장소(어디서)'], rowLabels: WEEK },
      { type: 'textarea', id: 'happiness', label: '○ 내가 생각하는 행복이란? (행복하고 즐거웠던 경험 등)', ai: true },
      { type: 'textarea', id: 'dream', label: '○ 나의 꿈은?', ai: true },
      { type: 'grid', id: 'week_hope', label: '○ 내가 기대하는 일상 (주간 활동)', cols: ['관계(누구와)', '활동(무엇을)', '장소(어디서)'], rowLabels: WEEK },
    ],
  },
  {
    section: '행복한 삶 준비하기', title: '행복한 삶 준비하기 — 자립생활에 필요한 것 돌아보기',
    fields: [
      {
        type: 'scale', id: 'adl', label: '일상생활 활동 — 스스로 할 수 있나요?',
        groups: [
          { title: '(1) 청소와 정리하기', items: ['집안 청소하기', '이부자리 정리하기', '옷장 정리하기', '탁자, 서랍장 정리하기', '싱크대 정리하기', '냉장고 정리하기', '설거지하기', '화장실 청소하기'] },
          { title: '(2) 빨래하기', items: ['세탁기 사용하기', '손빨래하기', '세탁소 이용하기'] },
          { title: '(3) 쓰레기 버리기', items: ['재활용 쓰레기', '음식물 쓰레기', '일반쓰레기'] },
          { title: '(4) 음식 만들기', items: ['양념 및 음식재료 알기', '요리도구 사용하기', '밥솥 사용하기'] },
          { title: '(5) 단정하게 옷 입기', items: ['자신의 옷 고르기', '깨끗한 옷 고르기', '결혼/장례식 때에 맞는 옷 입기'] },
          { title: '(6) 멋내기', items: ['머리 정돈하기', '손톱과 발톱 관리하기', '화장품 사용하기', '액세서리 사용하기'] },
          { title: '(7) 고장난 물건 고치기', items: ['라디오나 핸드폰이 고장 났을 때 서비스 센터 이용하기'] },
        ],
      },
      {
        type: 'scale', id: 'social', label: '사람들과 친하게 지내기 활동 — 스스로 할 수 있나요?',
        groups: [
          { title: '(1) 사람들과 대화하기', items: ['대화할 때 바른 행동 알기', '좋은 말 사용하기', '나의 어려운 점 이야기하기'] },
          { title: '(2) 친구들과 친하게 지내기', items: ['취미생활 함께 하기', '모임에 참석하기', '집에 초대하기', '비밀지키기', '약속 지키기'] },
          { title: '(3) 이웃들과 함께 살기', items: ['이웃에게 인사하기', '질서 지키기', '피해주지 않기', '버스/지하철 예의 지키기'] },
          { title: '(4) 가족들과 친하게 지내기', items: ['가족 행사가기 (생일, 결혼 등)', '어른에게 안부 전화하기'] },
          { title: '(5) 지역사회시설 이용하기', items: ['주민센터 위치 알기 (구청, 동주민센터, 시청 등)', '우체국, 은행, 병원 등 찾기', '각 시설 이용하는 방법 알기'] },
          { title: '(6) 핸드폰으로 카카오톡, 문자, SNS 사용하기', items: ['들어가는 방법 알기', '문자 쓰는 방법 알기', '사진 올리는 방법 알기'] },
          { title: '(7) 원하는 곳으로 외출하기', items: ['내가 갈 곳 찾기', '버스, 택시, 지하철 이용 방법 알기', '길 묻기'] },
        ],
      },
    ],
  },
  {
    section: '교육', title: '교육설계 — 꿈을 이루기 위한 이야기', domain: '교육',
    fields: [
      { type: 'textarea', id: 'edu_academy', label: '평생과정설계 아카데미에서 표현한 ‘교육’ 이야기', hint: '영역별 활동내용, 예비 미래설계서 중 해당 영역 내용' },
      { type: 'grid', id: 'edu_past', label: '○ 과거 교육', cols: ['교육명', '교육기관', '교육기간', '비고'], rows: 3 },
      { type: 'grid', id: 'edu_now', label: '○ 현재 교육', cols: ['교육명', '교육기관', '교육기간', '만족도(소감 등)'], rows: 3 },
      { type: 'grid', id: 'edu_future', label: '○ 꿈을 이루기 위한 미래 교육', cols: ['희망교육', '이유', '필요한 도움'], rows: 3 },
    ],
  },
  {
    section: '보건의료', title: '보건의료 설계 — 몸과 마음이 건강하기 위한 이야기', domain: '보건의료',
    fields: [
      { type: 'textarea', id: 'health_academy', label: '평생과정설계 아카데미에서 표현한 ‘보건의료’ 이야기' },
      { type: 'textarea', id: 'health_state', label: '○ 나의 건강은 어떤가요?' },
      { type: 'check', id: 'health_need', label: '내가 더 건강해지기 위해 필요한 도움', options: ['정기적 건강검진(구강검진 등)', '건강한 식단관리', '건강한 체형(다이어트 등)', '건강한 마음챙김(스트레스 해소)', '건강관련 정보 알기', '약물복용 방법 알기', '기타'] },
      { type: 'textarea', id: 'health_need_desc', label: '필요한 도움 내용', rows: 2 },
      { type: 'textarea', id: 'role_family', label: '가족에서 어떤 역할을 하고 싶나요?', rows: 2 },
      { type: 'textarea', id: 'role_people', label: '친구, 동료 등 주변 사람들에게 어떤 역할을 하고 싶나요?', rows: 2 },
      { type: 'heading', text: '○ 나의 건강 정보' },
      { type: 'text', id: 'diagnosis', label: '진단명(또는 질환)' },
      { type: 'grid', id: 'hospital', label: '이용병원', cols: ['병원이름(의사)', '진료내용', '방문주기(정기/비정기)'], rows: 2 },
      { type: 'grid', id: 'medicine', label: '약 복용', cols: ['약 이름', '복용이유', '복용시기'], rows: 2 },
      { type: 'radio', id: 'med_manage', label: '복용관리', options: ['스스로 복용', '복용 지원 필요'] },
      { type: 'check', id: 'aids', label: '보조기구', options: ['안경', '보청기', '휠체어', '기타'] },
      { type: 'grid', id: 'habits', label: '건강습관', cols: ['내용'], rowLabels: ['식습관', '수면', '보조식품', '구강관리', '건강검진'] },
      { type: 'radio', id: 'stress', label: '스트레스가 있나요?', options: ['없다', '가끔', '자주'] },
      { type: 'text', id: 'stress_sol', label: '스트레스 해결방법' },
      { type: 'radio', id: 'depress', label: '우울을 느낀 적이 있나요?', options: ['없다', '가끔', '자주'] },
      { type: 'text', id: 'depress_sol', label: '우울 해결방법' },
      { type: 'heading', text: '○ 늙어감' },
      { type: 'textarea', id: 'aging_know', label: '나이 들어감(노화)과 몸에 나타나는 변화를 알고 있나요?', rows: 2 },
      { type: 'textarea', id: 'aging_hope', label: '나는 어떤 모습으로 늙어가고 싶나요?', rows: 2 },
      { type: 'textarea', id: 'death', label: '죽음에 대해 어떻게 생각하나요?', rows: 2 },
      { type: 'radio', id: 'death_exp', label: '주변 사람의 죽음을 경험한 적이 있나요?', options: ['없다', '있다'] },
      { type: 'text', id: 'death_feel', label: '그때 느꼈던 감정' },
    ],
  },
  {
    section: '문화여가', title: '문화여가설계 — 신나고 즐겁게 활동하기 위한 이야기', domain: '문화여가',
    fields: [
      { type: 'textarea', id: 'leisure_academy', label: '평생과정설계 아카데미에서 표현한 ‘문화여가’ 이야기' },
      { type: 'grid', id: 'leisure_past', label: '○ 나의 문화여가 경험', cols: ['문화여가 활동', '좋았던 이유', '싫었던 이유'], rows: 3 },
      { type: 'grid', id: 'leisure_hope', label: '○ 내가 희망하는 문화여가', cols: ['문화여가 활동', '누구와', '언제(낮, 밤)', '이유'], rows: 3 },
      { type: 'check', id: 'leisure_need', label: '필요한 도움', options: ['함께 하는 사람', '다양한 문화여가 활동 경험', '문화여가 활동비용', '문화여가 활동 시간과 장소 확보', '문화여가 관련 정보 알기', '기타'] },
    ],
  },
  {
    section: '직업', title: '직업설계 — 사회에서 즐겁게 일하기 위한 이야기', domain: '직업',
    fields: [
      { type: 'textarea', id: 'job_academy', label: '평생과정설계 아카데미에서 표현한 ‘직업’ 이야기' },
      { type: 'heading', text: '○ 직업이 있는 경우' },
      { type: 'radio', id: 'job_keep', label: '현재 직업을 계속 하고 싶나요?', options: ['네', '아니오'] },
      { type: 'textarea', id: 'job_keep_prep', label: '직업을 계속 하기 위해 필요한 준비', rows: 2 },
      { type: 'textarea', id: 'job_keep_support', label: '직업을 계속 하기 위해 필요한 지원', rows: 2 },
      { type: 'heading', text: '○ 직업이 없는 경우 (또는 직업을 바꾸고 싶은 경우)' },
      { type: 'radio', id: 'job_want', label: '직업을 희망하나요?', options: ['네', '아니오'] },
      { type: 'text', id: 'job_hope', label: '희망하는 직업' },
      { type: 'textarea', id: 'job_hope_prep', label: '희망하는 직업을 위해 필요한 준비', rows: 2 },
      { type: 'textarea', id: 'job_hope_support', label: '희망하는 직업을 위해 필요한 지원', rows: 2 },
      { type: 'heading', text: '○ 사회에 도움이 되는 활동' },
      { type: 'radio', id: 'volunteer_want', label: '사회에 도움이 되는 활동을 희망하나요?', options: ['네', '아니오'] },
      { type: 'text', id: 'volunteer', label: '희망하는 활동' },
    ],
  },
  {
    section: '결혼', title: '결혼설계 — 좋아하는 사람과 함께 하기 위한 이야기', domain: '결혼',
    fields: [
      { type: 'textarea', id: 'marry_academy', label: '평생과정설계 아카데미에서 표현한 ‘결혼’ 이야기' },
      { type: 'check', id: 'meaningful', label: '○ 나에게 의미있는 사람은 누구인가요? (가족 외)', options: ['친구', '동료', '선후배', '배우자', '기타', '없다'] },
      { type: 'textarea', id: 'meaningful_why', label: '이유는 무엇인가요?', rows: 2 },
      { type: 'textarea', id: 'meaningful_need', label: '의미있는 사람과의 관계에 필요한 도움', rows: 2 },
      { type: 'radio', id: 'dating_now', label: '○ 이성교제 중인가요?', options: ['네', '아니요'] },
      { type: 'radio', id: 'dating_want', label: '이성교제를 희망하나요? (교제 중이면 지속적 교제)', options: ['네', '아니요'] },
      { type: 'check', id: 'dating_need', label: '이성교제에 필요한 도움', options: ['감정표현하기', '상대방 이해하기', '데이트하기', '성적욕구(스킨십 등)', '결혼을 위한 준비', '기타'] },
      { type: 'radio', id: 'married', label: '○ 결혼생활 중인가요?', options: ['네', '아니요'] },
      { type: 'radio', id: 'marry_want', label: '결혼을 희망하나요? (결혼한 경우 지속적 결혼생활)', options: ['네', '아니요'] },
      { type: 'check', id: 'marry_need', label: '결혼생활에 필요한 도움', options: ['가사활동(요리, 빨래 등)', '부부관계', '임신과 출산', '자녀 양육', '가족(시가, 처가 등)에서의 역할', '갈등해소 지원(부부 또는 가족)', '기타'] },
    ],
  },
  {
    section: '주거', title: '주거설계 — 살고 싶은 집에 대한 이야기', domain: '주거',
    fields: [
      { type: 'textarea', id: 'house_academy', label: '평생과정설계 아카데미에서 표현한 ‘주거’ 이야기' },
      { type: 'heading', text: '○ 내가 선택하는 주거생활 (현재 → 미래)' },
      { type: 'check', id: 'live_with_now', label: '누구와 살고 있나요? (현재)', options: ['가족', '혼자', '배우자', '친구, 동료'] },
      { type: 'check', id: 'live_with_future', label: '누구와 살고 싶나요? (미래)', options: ['가족', '혼자', '배우자', '친구, 동료'] },
      { type: 'radio', id: 'house_type_now', label: '집의 유형 (현재)', options: ['아파트', '주택', '빌라/다가구주택', '거주시설(그룹홈 등)', '기타'] },
      { type: 'radio', id: 'house_type_future', label: '집의 유형 (미래)', options: ['아파트', '주택', '빌라/다가구주택', '거주시설(그룹홈 등)', '기타'] },
      { type: 'radio', id: 'house_own_now', label: '집의 형태 (현재)', options: ['자가', '전세', '월세', '무상(임대)', '기타'] },
      { type: 'radio', id: 'house_own_future', label: '집의 형태 (미래)', options: ['자가', '전세', '월세', '무상(임대)', '기타'] },
      { type: 'text', id: 'house_loc', label: '집의 위치 (현재 → 미래)', placeholder: '예: 서울시 OO구 → 서울시 OO구' },
      { type: 'check', id: 'house_around', label: '집 주변에 필요한 것 (미래)', options: ['공원', '학교', '마트', '은행', '우체국', '식당', '관공서', '편리한교통', 'PC방', '도서관', '복지기관', '종교시설', '영화관', '미용실', '병원', '기타'] },
      { type: 'check', id: 'own_space', label: '나만의 공간', options: ['있다', '없다', '필요하다', '필요없다'] },
      { type: 'text', id: 'important_item', label: '나에게 중요한 물건이나 가구' },
      { type: 'text', id: 'neighbor_hope', label: '내 주변에 누가 살았으면 좋겠나요?' },
      { type: 'check', id: 'house_chores', label: '독립적으로 수행할 수 있는 집안 일', options: ['청소', '빨래', '설거지', '요리', '가스 잠그기', '문단속', '기타'] },
      { type: 'check', id: 'safety', label: '안전장치', options: ['소화기', '비상벨', '도움요청 방법 알고 있다', '읽기 쉬운 설명서', '채광, 환기', '기타'] },
      { type: 'check', id: 'house_need', label: '필요한 도움', options: ['집 준비 관련 정보제공 (임대주택, 자가주택 준비 등)', '집 준비 관련 비용 지원(주거생활 비용)', '집 내부 환경 바꾸기(주거환경 개선)', '가사 활동 및 관리 방법 알기', '기타'] },
    ],
  },
  {
    section: '법적', title: '법적설계 — 나를 이해하고 도와주는 사람에 대한 이야기', domain: '법적',
    fields: [
      { type: 'textarea', id: 'legal_academy', label: '평생과정설계 아카데미에서 표현한 ‘법’ 이야기' },
      { type: 'check', id: 'advocate', label: '○ 누가 나를 이해하고 응원해주길 희망하나요? (옹호인)', options: ['가족', '친인척', '친구', '이웃', '사회복지사', '활동지원사', '기타'] },
      { type: 'text', id: 'advocate_name', label: '옹호인 이름', private: true },
      { type: 'text', id: 'advocate_phone', label: '옹호인 연락처', private: true },
      {
        type: 'check', id: 'advocate_help', label: '어떤 도움을 받고 싶은가요?', column: true,
        options: ['내 꿈을 위해 배우고 싶은 것을 알아보는 것', '몸이 아플 때 약국이나 병원에 가서 진료를 받는 것', '친구를 만들거나 친한 사람들과 신나고 즐거운 활동을 하는 것', '친한 사람들과 갈등이 생겼을 때 해결하는 것', '사랑하는 사람과 이성교제(데이트) 또는 결혼하는 것', '직장에서 생긴 어려운 일 해결, 직장생활 잘 할 수 있도록 하는 것', '은행에서 통장을 만들거나 돈을 찾는 것, 공과금 납부하는 것', '돈을 관리 하는 방법을 아는 것', '앞으로 살고 싶은 집을 준비하는 것', '요리활동, 집안일(청소, 빨래 등) 등을 잘 하는 것', '내 생각을 잘 말할 수 있도록 하는 것', '기타'],
      },
    ],
  },
  {
    section: '소득재정', title: '소득재정설계 — 돈을 잘 사용하기 위한 이야기', domain: '소득재정',
    fields: [
      { type: 'textarea', id: 'money_academy', label: '평생과정설계 아카데미에서 표현한 ‘소득재정’ 이야기' },
      { type: 'radio', id: 'money_exp', label: '○ 돈 사용에 대한 경험', options: ['있다', '없다'] },
      { type: 'check', id: 'money_purpose', label: '사용목적', options: ['식비', '간식비', '교통비', '통신비', '물건구매', '기타'] },
      { type: 'text', id: 'money_noexp', label: '돈 사용 경험이 없는 이유' },
      { type: 'radio', id: 'money_who', label: '○ 돈 관리는 누가 하나요?', options: ['내가 직접 관리', '가족이 관리', '후견인이 관리', '기타', '누가 관리하는지 모름'] },
      { type: 'radio', id: 'money_keep', label: '돈 보관 방법', options: ['현금으로 보관', '은행에 저금함', '저금통에 저금함', '기타', '보관방법 모름'] },
      { type: 'radio', id: 'money_use', label: '돈 사용방법', options: ['현금 사용', '체크카드 사용', '신용카드 사용', '기타', '사용방법 모름'] },
      { type: 'check', id: 'money_need', label: '돈을 잘 관리하기 위해 필요한 도움', options: ['들어온 돈(수입)과 사용한 돈(지출)의 의미 알기', '계획적인 소비(돈 사용) 방법을 알고 실행하기', '다양한 분야의 소비 경험 늘리기', '기타'] },
      { type: 'heading', text: '※ 지원자(보호자 등)가 체크합니다 — 자녀의 소득재정 관리에 대한 생각' },
      { type: 'radio', id: 'asset_manager', label: '보호자 부재 시 장애자녀의 재산관리 주체', options: ['장애자녀', '비장애형제', '친인척', '지인', '금융기관', '기타'] },
      { type: 'check', id: 'asset_need', label: '장애자녀의 재산관리를 위해 필요한 도움', options: ['영역별 활동에 따른 필요비용 설계', '신탁제도 정보 제공 및 활용 방법 지원', '후견제도 정보 제공 및 활용 방법 지원', '안전한 재산관리를 위한 방법 지원', '재산상속 정보 제공', '기타'] },
      { type: 'grid', id: 'assets', label: '○ 재산과 수입현황 (월 평균 금액, 원)', cols: ['내용', '금액(원)'], rowLabels: ['현금', '예금', '연금, 보험', '유가증권', '부동산', '은행대출(-)', '기타 부채(-)', '근로소득', '부동산소득', '장애연금/수당', '개인연금', '결연후원', '정부지원금', '기타 수입'] },
      { type: 'grid', id: 'insurance', label: '보험', cols: ['보험 보장 내용', '보장 금액'], rowLabels: ['의료', '상해', '연금', '기타'] },
      { type: 'grid', id: 'expense', label: '○ 지출현황 (월 평균 금액, 원)', cols: ['금액(원)', '비고'], rowLabels: ['주거생활비(월세, 공과금 등)', '식비', '외식비', '교통비', '통신비', '교육비', '용돈', '각종 할부금', '저축', '금융비용(대출이자 등)', '의료비', '보험비', '경조사비', '의류(신발)비', '문화여가비', '의료기구', '생활용품비', '이미용비', '기타'] },
    ],
  },
];

// 미래설계 실천계획서 (원본 HWP 양식)
const PLAN_FIELDS = [
  { id: 'dream', label: '꿈과 희망' },
  { id: 'midGoal', label: '중장기목표' },
  { id: 'important', label: '내가 중요하게 생각하는 것' },
  { id: 'needs', label: '나에게 필요한 것' },
  { id: 'success', label: '성공경험' },
];

// 단계별 프로세스 (성민복지관 평생과정설계 단계별 Process)
const PROCESS = [
  {
    phase: '준비', sub: '',
    steps: [
      { id: 'academy', name: '아카데미', desc: '당사자/보호자/지원자 대상 아카데미 수료' },
      { id: 'prep_counsel', name: '준비상담', desc: '영역별 정보 제공, 준비 과정 안내 (당사자/보호자)' },
      { id: 'family_prog', name: '가족 지원 프로그램', desc: '장애수용, 교육, 심리활동, 자조모임 등 (보호자/비장애형제)' },
    ],
  },
  {
    phase: '계획', sub: '지원회의',
    steps: [
      { id: 'counsel', name: '상담', desc: '회의 설계, 자기소개서 작성 안내' },
      { id: 'pre_meeting', name: '사전회의', desc: '꿈과 히스토리 공유' },
      { id: 'integrated', name: '통합회의', desc: '힘과 필요 찾기' },
      { id: 'conference', name: '컨퍼런스회의', desc: '중장기목표 협의' },
      { id: 'confirm', name: '확정회의', desc: '중장기목표 및 영역 우선순위 확정' },
      { id: 'short_plan', name: '단기계획 수립', desc: '단기목표(2년) 및 해당연도 실천계획 수립' },
    ],
  },
  {
    phase: '실천', sub: '',
    steps: [
      { id: 'detail_check', name: '세부계획 확인', desc: '월별, 연간 활동 계획 협의' },
      { id: 'practice', name: '실천활동 진행', desc: '계획 기반 지역중심 활동 이행 (시민옹호인, 활동지원사 등 협력)' },
      { id: 'activity_eval', name: '활동평가', desc: '월/분기/반기 등 약속된 기간 내 실천과정 평가 및 세부계획 조정' },
      { id: 'self_help', name: '미래설계 자조활동', desc: '보호자(준비/핵심그룹), 당사자(욕구/생애주기별) 지역모임' },
    ],
  },
  {
    phase: '평가', sub: '모니터링',
    steps: [
      { id: 'yearly_eval', name: '실천과정 평가 (연 1회)', desc: '목표평가 및 지원평가 → 연초 해당연도 실천계획에 반영' },
    ],
  },
];
