/**
 * 날짜 관련 유틸리티 함수
 * 모든 비즈니스 로직은 KST (Korea Standard Time, UTC+9) 기준으로 처리
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000; // UTC+9 = 9시간 * 60분 * 60초 * 1000ms

/**
 * UTC Date를 KST Date로 변환합니다.
 * 주의: 반환된 Date 객체의 UTC 메서드들이 KST 값을 반환하도록 조정됨
 *
 * @param {Date|string} date - UTC 기준 날짜
 * @returns {Date} KST로 조정된 Date 객체
 */
function toKST(date) {
  const inputDate = date instanceof Date ? date : new Date(date);
  return new Date(inputDate.getTime() + KST_OFFSET_MS);
}

/**
 * 현재 시간을 KST 기준으로 반환합니다.
 *
 * @returns {Date} KST 현재 시간
 */
function nowKST() {
  return toKST(new Date());
}

/**
 * 주어진 날짜의 다음 영업일을 계산합니다. (KST 기준)
 * - 평일(월~목): 다음날
 * - 금요일: 월요일
 * - 토요일: 월요일
 * - 일요일: 월요일
 *
 * @param {Date|string} date - 기준 날짜 (UTC)
 * @returns {Date} 다음 영업일 (KST 기준으로 계산된 날짜)
 */
function getNextBusinessDay(date) {
  const inputDate = date instanceof Date ? date : new Date(date);

  // KST로 변환하여 요일 판단
  const kstDate = toKST(inputDate);

  // KST 기준 다음날로 이동
  const result = new Date(kstDate);
  result.setDate(result.getDate() + 1);

  // KST 기준 요일 확인 (0=일요일, 6=토요일)
  const dayOfWeek = result.getDay();

  if (dayOfWeek === 6) {
    // 토요일 → 월요일 (2일 추가)
    result.setDate(result.getDate() + 2);
  } else if (dayOfWeek === 0) {
    // 일요일 → 월요일 (1일 추가)
    result.setDate(result.getDate() + 1);
  }

  return result;
}

/**
 * Date 객체를 YYYY-MM-DD 형식의 문자열로 변환합니다.
 * getNextBusinessDay에서 반환된 Date는 이미 KST 조정되어 있으므로 그대로 사용
 *
 * @param {Date} date - 변환할 날짜
 * @returns {string} YYYY-MM-DD 형식의 문자열
 */
function formatDateToYYYYMMDD(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * UTC Date를 KST 기준 YYYY-MM-DD 형식의 문자열로 변환합니다.
 *
 * @param {Date|string} date - UTC 기준 날짜
 * @returns {string} KST 기준 YYYY-MM-DD 형식의 문자열
 */
function formatDateToYYYYMMDD_KST(date) {
  const kstDate = toKST(date);
  const year = kstDate.getFullYear();
  const month = String(kstDate.getMonth() + 1).padStart(2, '0');
  const day = String(kstDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 한국어 요일명을 반환합니다. (KST 기준)
 *
 * @param {Date} date - 날짜 (UTC)
 * @returns {string} 한국어 요일명
 */
function getKoreanDayName(date) {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const kstDate = toKST(date);
  return days[kstDate.getDay()];
}

/**
 * KST 기준 날짜 범위를 반환합니다. (특정 날짜의 00:00:00 ~ 23:59:59)
 * DB 쿼리에서 특정 날짜(KST)에 해당하는 UTC 범위를 구할 때 사용
 *
 * @param {number} year - 연도
 * @param {number} month - 월 (1-12)
 * @param {number} day - 일
 * @returns {{ start: Date, end: Date }} UTC 기준 시작/종료 시간
 */
function getKSTDateRange(year, month, day) {
  // KST 특정일 00:00:00 = UTC 전날 15:00:00
  const start = new Date(Date.UTC(year, month - 1, day, -9, 0, 0));
  // KST 다음날 00:00:00 = UTC 당일 15:00:00
  const end = new Date(Date.UTC(year, month - 1, day + 1, -9, 0, 0));
  return { start, end };
}

/**
 * KST 기준 월 범위를 반환합니다. (특정 월의 1일 00:00:00 ~ 마지막일 23:59:59)
 *
 * @param {number} year - 연도
 * @param {number} month - 월 (1-12)
 * @returns {{ start: Date, end: Date }} UTC 기준 시작/종료 시간
 */
function getKSTMonthRange(year, month) {
  // KST 특정월 1일 00:00:00 = UTC 전월 마지막일 15:00:00
  const start = new Date(Date.UTC(year, month - 1, 1, -9, 0, 0));
  // KST 다음월 1일 00:00:00 = UTC 당월 마지막일 15:00:00
  const end = new Date(Date.UTC(year, month, 1, -9, 0, 0));
  return { start, end };
}

module.exports = {
  KST_OFFSET_MS,
  toKST,
  nowKST,
  getNextBusinessDay,
  formatDateToYYYYMMDD,
  formatDateToYYYYMMDD_KST,
  getKoreanDayName,
  getKSTDateRange,
  getKSTMonthRange
};
