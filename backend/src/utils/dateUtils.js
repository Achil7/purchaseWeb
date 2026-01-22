/**
 * 날짜 관련 유틸리티 함수
 */

/**
 * 주어진 날짜의 다음 영업일을 계산합니다.
 * - 평일(월~금): 다음날
 * - 금요일: 월요일
 * - 토요일: 월요일
 * - 일요일: 월요일
 *
 * @param {Date|string} date - 기준 날짜
 * @returns {Date} 다음 영업일
 */
function getNextBusinessDay(date) {
  const inputDate = date instanceof Date ? date : new Date(date);
  const result = new Date(inputDate);

  // 다음날로 이동
  result.setDate(result.getDate() + 1);

  // 요일 확인 (0=일요일, 6=토요일)
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
 * 한국어 요일명을 반환합니다.
 *
 * @param {Date} date - 날짜
 * @returns {string} 한국어 요일명
 */
function getKoreanDayName(date) {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return days[date.getDay()];
}

module.exports = {
  getNextBusinessDay,
  formatDateToYYYYMMDD,
  getKoreanDayName
};
