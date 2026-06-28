/**
 * SQL 읽기전용 검증기 (앱 레벨 이중 안전장치)
 *
 * 읽기전용 DB 역할(ai_readonly)이 1차 방어선이지만, 앱 레벨에서도
 * SELECT/WITH 전용임을 검증하고 친절한 에러를 돌려준다.
 *
 * - 단일 구문만 허용 (다중 구문 ; 차단)
 * - 첫 키워드는 SELECT 또는 WITH 만 허용
 * - 데이터/스키마 변경 키워드 차단 (CTE 내부 INSERT 등도 차단)
 * - LIMIT 없으면 자동으로 LIMIT 500 부착 (토큰/부하 폭주 방지)
 */

const FORBIDDEN_KEYWORDS = [
  'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'TRUNCATE',
  'GRANT', 'REVOKE', 'COPY', 'MERGE', 'CALL', 'DO', 'EXECUTE',
  'VACUUM', 'REINDEX', 'REFRESH', 'LOCK', 'SET', 'RESET', 'COMMENT',
  'INTO' // SELECT ... INTO (테이블 생성) 차단
];

const MAX_LIMIT = 500;

/**
 * 주석 제거 (라인 주석 -- , 블록 주석 /* *​/ )
 */
const stripComments = (sql) =>
  sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')   // 블록 주석
    .replace(/--[^\n\r]*/g, ' ');        // 라인 주석

/**
 * @param {string} rawSql
 * @returns {{ sql: string, appliedLimit: number }} 정제된 SQL + 실제 적용된 행 제한 (위반 시 throw)
 */
const validateAndPrepare = (rawSql) => {
  if (!rawSql || typeof rawSql !== 'string' || !rawSql.trim()) {
    throw new Error('빈 쿼리입니다.');
  }

  // 주석 제거 후 정제
  let sql = stripComments(rawSql).trim();

  // 끝의 세미콜론 제거
  sql = sql.replace(/;+\s*$/, '').trim();

  if (!sql) {
    throw new Error('빈 쿼리입니다.');
  }

  // 다중 구문 차단 (남은 세미콜론)
  if (sql.includes(';')) {
    throw new Error('다중 SQL 구문은 허용되지 않습니다. 단일 SELECT 쿼리만 실행하세요.');
  }

  // 첫 키워드 검사 (SELECT 또는 WITH)
  const firstKeyword = (sql.match(/^[a-zA-Z]+/) || [''])[0].toUpperCase();
  if (firstKeyword !== 'SELECT' && firstKeyword !== 'WITH') {
    throw new Error('SELECT 또는 WITH로 시작하는 읽기전용 쿼리만 허용됩니다.');
  }

  // 금지 키워드 검사 (단어 경계, 대소문자 무시) - CTE 내부 변경 구문도 차단
  for (const kw of FORBIDDEN_KEYWORDS) {
    const re = new RegExp(`\\b${kw}\\b`, 'i');
    if (re.test(sql)) {
      throw new Error(`금지된 키워드(${kw})가 포함되어 실행할 수 없습니다. 읽기전용 쿼리만 가능합니다.`);
    }
  }

  // LIMIT 처리: 있으면 MAX_LIMIT 초과분 하향, 없으면 자동 부착
  let appliedLimit = MAX_LIMIT;
  const existing = sql.match(/\bLIMIT\s+(\d+)\b/i);
  if (existing) {
    const n = parseInt(existing[1], 10);
    appliedLimit = Math.min(n, MAX_LIMIT);
    if (n > MAX_LIMIT) {
      sql = sql.replace(/\bLIMIT\s+\d+\b/i, `LIMIT ${MAX_LIMIT}`);
    }
  } else {
    sql = `${sql} LIMIT ${MAX_LIMIT}`;
  }

  return { sql, appliedLimit };
};

module.exports = { validateAndPrepare, MAX_LIMIT };
