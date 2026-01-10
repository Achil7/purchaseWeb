/**
 * 계좌번호 정규화 유틸리티
 * 계좌정보 문자열에서 숫자만 추출하여 비교 가능한 형태로 변환
 */

/**
 * 계좌번호 정규화 - 숫자만 추출
 * @param {string} accountInfo - 계좌정보 문자열
 * @returns {string|null} - 정규화된 계좌번호 (숫자만) 또는 null
 *
 * @example
 * normalizeAccountNumber("국민 111-1234-123456 홍길동") // "1111234123456"
 * normalizeAccountNumber("신한은행 110-123-456789") // "110123456789"
 * normalizeAccountNumber("123-456-789012") // "123456789012"
 */
function normalizeAccountNumber(accountInfo) {
  if (!accountInfo || typeof accountInfo !== 'string') {
    return null;
  }

  // 숫자만 추출
  const normalized = accountInfo.replace(/[^0-9]/g, '');

  // 최소 길이 검증 (너무 짧으면 유효하지 않은 것으로 간주)
  // 일반적으로 계좌번호는 10자리 이상
  if (normalized.length < 8) {
    return null;
  }

  return normalized;
}

/**
 * 두 계좌번호가 일치하는지 비교
 * @param {string} account1 - 첫 번째 계좌정보
 * @param {string} account2 - 두 번째 계좌정보
 * @returns {boolean} - 일치 여부
 */
function compareAccounts(account1, account2) {
  const norm1 = normalizeAccountNumber(account1);
  const norm2 = normalizeAccountNumber(account2);

  if (!norm1 || !norm2) {
    return false;
  }

  return norm1 === norm2;
}

module.exports = {
  normalizeAccountNumber,
  compareAccounts
};
