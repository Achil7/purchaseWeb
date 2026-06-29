/**
 * Anthropic(Claude) 클라이언트 싱글턴
 * - Admin AI 챗(text-to-SQL)용
 * - 환경변수 ANTHROPIC_API_KEY 필요
 * - SDK는 lazy require: 패키지 미설치 시 서버 부팅은 정상, AI 챗 호출 시에만 에러
 */
let anthropicClient = null;

const getAnthropicClient = () => {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }
    const Anthropic = require('@anthropic-ai/sdk');
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
};

// AI 챗 기본 모델: 재무성 작업(견적 대조/마진/이상치) 안전을 위해 Sonnet 4.6
// (env ANTHROPIC_MODEL로 override 가능. 사용자는 프론트에서 질문별 모델 선택 가능)
const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

// AI 챗에서 사용자가 선택 가능한 모델 (저렴 → 정밀)
const AI_CHAT_MODELS = ['claude-haiku-4-5', 'claude-sonnet-4-6', 'claude-opus-4-8'];

// 요청 모델이 허용 목록에 없으면 기본 모델로 폴백 (서버측 화이트리스트)
const resolveModel = (requested) =>
  (typeof requested === 'string' && AI_CHAT_MODELS.includes(requested)) ? requested : DEFAULT_MODEL;

// AI 챗 기능 토글 (미설정 시 OFF - 안전 기본값)
const AI_CHAT_ENABLED = process.env.AI_CHAT_ENABLED === 'true';

// 모델별 가격 (USD per 1M tokens) - 2026-06 기준
// https://platform.claude.com/docs/en/pricing
const PRICING = {
  'claude-opus-4-8': {
    input: 5.00 / 1_000_000,        // $5.00 per 1M (uncached input)
    output: 25.00 / 1_000_000,      // $25.00 per 1M output
    cache_write: 6.25 / 1_000_000,  // 1.25x (캐시 기록)
    cache_read: 0.50 / 1_000_000,   // 0.1x (캐시 읽기)
  },
  'claude-sonnet-4-6': {
    input: 3.00 / 1_000_000,
    output: 15.00 / 1_000_000,
    cache_write: 3.75 / 1_000_000,
    cache_read: 0.30 / 1_000_000,
  },
  'claude-haiku-4-5': {
    input: 1.00 / 1_000_000,
    output: 5.00 / 1_000_000,
    cache_write: 1.25 / 1_000_000,
    cache_read: 0.10 / 1_000_000,
  },
};

/**
 * 토큰 사용량으로 비용 계산 (캐시 가격 반영)
 * @param {string} model
 * @param {{inputTokens?:number, outputTokens?:number, cacheReadTokens?:number, cacheWriteTokens?:number}} usage
 * @returns {number} USD 비용
 */
const calculateCost = (model, usage = {}) => {
  const p = PRICING[model] || PRICING['claude-opus-4-8'];
  const { inputTokens = 0, outputTokens = 0, cacheReadTokens = 0, cacheWriteTokens = 0 } = usage;
  return (
    inputTokens * p.input +
    outputTokens * p.output +
    cacheReadTokens * p.cache_read +
    cacheWriteTokens * p.cache_write
  );
};

module.exports = {
  getAnthropicClient,
  DEFAULT_MODEL,
  AI_CHAT_MODELS,
  resolveModel,
  AI_CHAT_ENABLED,
  PRICING,
  calculateCost
};
