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
const EXTRACTION_ENABLED = process.env.EXTRACTION_ENABLED !== 'false';

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
  PRICING,
  calculateCost
};
