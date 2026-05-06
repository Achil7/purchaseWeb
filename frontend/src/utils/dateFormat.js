// 연월(year_month) 표시용 포맷터
// 다양한 입력 형식을 받아 사용자에게 보기 편한 한국어 표기('YY년 M월')로 변환합니다.
//
// 입력 예시:
//   '2026-02'     → '26년 2월'
//   '26-02'       → '26년 2월'
//   '2602'        → '26년 2월'   (YYMM)
//   '202602'      → '26년 2월'   (YYYYMM)
//   '2026.02'     → '26년 2월'
//   '2026-02-07'  → '26년 2월'
//   '26-02-07'    → '26년 2월'
//
// 변환 불가능한 경우 원본 그대로 반환 (사용자가 보고 추측이라도 가능하도록).
export function formatYearMonthLabel(raw) {
  if (raw === null || raw === undefined || raw === '') return '';
  const s = String(raw).trim();

  // 1) 4자리 연도 + 구분자(-, ., /) + 1~2자리 월
  let m = s.match(/^(\d{4})[-./](\d{1,2})/);
  if (m) {
    const yy = m[1].slice(2);
    const mm = parseInt(m[2], 10);
    if (mm >= 1 && mm <= 12) return `${yy}년 ${mm}월`;
  }

  // 2) 2자리 연도 + 구분자 + 1~2자리 월
  m = s.match(/^(\d{2})[-./](\d{1,2})/);
  if (m) {
    const yy = m[1];
    const mm = parseInt(m[2], 10);
    if (mm >= 1 && mm <= 12) return `${yy}년 ${mm}월`;
  }

  // 3) YYYYMM (6자리 숫자, 연속)
  m = s.match(/^(\d{4})(\d{2})$/);
  if (m) {
    const yy = m[1].slice(2);
    const mm = parseInt(m[2], 10);
    if (mm >= 1 && mm <= 12) return `${yy}년 ${mm}월`;
  }

  // 4) YYMM (4자리 숫자, 연속)
  m = s.match(/^(\d{2})(\d{2})$/);
  if (m) {
    const yy = m[1];
    const mm = parseInt(m[2], 10);
    if (mm >= 1 && mm <= 12) return `${yy}년 ${mm}월`;
  }

  // 변환 불가 - 원본 그대로
  return s;
}
