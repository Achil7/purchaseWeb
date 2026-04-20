const OpenAI = require('openai');

/**
 * OpenAI 클라이언트 싱글턴
 * - Vision API (이미지 텍스트 추출)용
 * - 환경변수 OPENAI_API_KEY 필요
 */
let openaiClient = null;

const getOpenAIClient = () => {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
};

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';
const DEFAULT_DETAIL = process.env.OPENAI_VISION_DETAIL || 'high'; // low | high | auto (기본 high - 한국어 리뷰 정확도 95%+ 검증 완료)
const EXTRACTION_ENABLED = process.env.EXTRACTION_ENABLED === 'true';

/**
 * EXTRACTION_ALLOWED_BRAND_IDS 파싱
 * - 미설정/빈값 → null (전체 차단 - 안전 기본값)
 * - "all" → "all" (전체 허용)
 * - "1,5,10" → [1, 5, 10]
 *
 * 이 규칙으로 운영에 실수로 EXTRACTION_ENABLED=true만 설정되어도
 * ALLOWED_BRAND_IDS가 없으면 자동으로 OFF 유지 (이중 안전장치)
 */
const parseAllowedBrandIds = () => {
  const raw = (process.env.EXTRACTION_ALLOWED_BRAND_IDS || '').trim();
  if (!raw) return null;
  if (raw.toLowerCase() === 'all') return 'all';
  return raw.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
};

const ALLOWED_BRAND_IDS = parseAllowedBrandIds();

/**
 * 특정 브랜드 ID의 자동 추출 허용 여부 판단
 * @param {number|null} brandId - monthly_brand_id
 * @returns {boolean}
 */
const isBrandAllowed = (brandId) => {
  if (!EXTRACTION_ENABLED) return false;
  if (ALLOWED_BRAND_IDS === null) return false;          // 미설정 → 차단
  if (ALLOWED_BRAND_IDS === 'all') return true;          // 전체 허용
  if (brandId == null) return false;                      // brandId 없으면 차단
  return ALLOWED_BRAND_IDS.includes(brandId);             // 목록 체크
};

// gpt-4o 가격 (USD per 1M tokens) - 2026-04 기준
// https://openai.com/api/pricing/
const PRICING = {
  'gpt-4o': {
    input: 2.50 / 1_000_000,   // $2.50 per 1M input tokens
    output: 10.00 / 1_000_000, // $10.00 per 1M output tokens
  },
  'gpt-4o-mini': {
    input: 0.15 / 1_000_000,
    output: 0.60 / 1_000_000,
  }
};

/**
 * 토큰 사용량으로 비용 계산
 * @param {string} model - 모델명
 * @param {number} inputTokens
 * @param {number} outputTokens
 * @returns {number} USD 비용
 */
const calculateCost = (model, inputTokens, outputTokens) => {
  const price = PRICING[model] || PRICING['gpt-4o'];
  return (inputTokens * price.input) + (outputTokens * price.output);
};

module.exports = {
  getOpenAIClient,
  DEFAULT_MODEL,
  DEFAULT_DETAIL,
  EXTRACTION_ENABLED,
  ALLOWED_BRAND_IDS,
  isBrandAllowed,
  PRICING,
  calculateCost
};
