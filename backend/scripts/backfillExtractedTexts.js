#!/usr/bin/env node
/**
 * 백필 스크립트: 기존 approved 이미지에 대해 리뷰 텍스트 추출
 *
 * 사용법:
 *   node backend/scripts/backfillExtractedTexts.js --dry-run
 *   node backend/scripts/backfillExtractedTexts.js --limit=10 --random --detail=low
 *   node backend/scripts/backfillExtractedTexts.js --detail=low              # 전체 실행
 *
 * 옵션:
 *   --dry-run          실제 API 호출 없이 대상 수/예상 비용만 출력
 *   --limit=N          최대 N건만 실행 (기본: 전체)
 *   --random           --limit과 함께 쓰면 랜덤 선택 (품질 테스트용)
 *   --detail=low|high|auto   GPT-4o detail 옵션 (기본 low)
 *   --brand-id=N       특정 monthly_brand_id만
 *   --concurrency=N    동시 실행 수 (기본 10)
 *   --model=gpt-4o     모델 오버라이드
 */

// .env 로드
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { Buyer, Image, Item, Campaign, ReviewExtractedText, sequelize, Sequelize } = require('../src/models');
const { Op } = Sequelize;
const { extractForBuyer } = require('../src/services/imageExtractor');
const { calculateCost, DEFAULT_MODEL } = require('../src/config/openai');

// ===== 인자 파싱 =====
function parseArgs(argv) {
  const args = {
    dryRun: false,
    limit: null,
    random: false,
    detail: 'high',  // 기본값: high (한국어 리뷰 정확도 95%+ 검증 완료)
    brandId: null,
    concurrency: 10,
    model: DEFAULT_MODEL
  };

  for (const a of argv.slice(2)) {
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--random') args.random = true;
    else if (a.startsWith('--limit=')) args.limit = parseInt(a.split('=')[1], 10);
    else if (a.startsWith('--detail=')) args.detail = a.split('=')[1];
    else if (a.startsWith('--brand-id=')) args.brandId = parseInt(a.split('=')[1], 10);
    else if (a.startsWith('--concurrency=')) args.concurrency = parseInt(a.split('=')[1], 10);
    else if (a.startsWith('--model=')) args.model = a.split('=')[1];
    else console.warn(`[WARN] Unknown arg: ${a}`);
  }

  if (!['low', 'high', 'auto'].includes(args.detail)) {
    console.error(`[ERROR] --detail must be low|high|auto (got: ${args.detail})`);
    process.exit(1);
  }

  return args;
}

// ===== 대상 구매자 조회 =====
async function findTargetBuyers(args) {
  // 방침: approved 이미지가 있고 아직 추출 안 된 구매자만
  // extraction_status = 'failed'는 재시도 포함 (새로 시도할 수 있도록)
  const replacements = {};

  let brandFilter = '';
  if (args.brandId) {
    brandFilter = `
      AND EXISTS (
        SELECT 1 FROM items it
        JOIN campaigns c ON it.id = b.item_id AND c.id = it.campaign_id
        WHERE c.monthly_brand_id = :brandId
      )
    `;
    replacements.brandId = args.brandId;
  }

  const orderClause = args.random ? 'ORDER BY RANDOM()' : 'ORDER BY b.created_at';
  const limitClause = args.limit ? `LIMIT ${parseInt(args.limit, 10)}` : '';

  const sql = `
    SELECT b.id
    FROM buyers b
    WHERE EXISTS (
        SELECT 1 FROM images i
        WHERE i.buyer_id = b.id
          AND i.status = 'approved'
          AND i.deleted_at IS NULL
    )
    AND NOT EXISTS (
        SELECT 1 FROM review_extracted_texts ret
        WHERE ret.buyer_id = b.id
          AND ret.extraction_status IN ('completed', 'not_review')
    )
    AND b.deleted_at IS NULL
    ${brandFilter}
    ${orderClause}
    ${limitClause}
  `;

  const results = await sequelize.query(sql, {
    replacements,
    type: Sequelize.QueryTypes.SELECT
  });

  return results.map(r => r.id);
}

// ===== 대상 이미지 수 (비용 추정용) =====
async function countImagesForBuyers(buyerIds) {
  if (buyerIds.length === 0) return 0;
  const result = await sequelize.query(`
    SELECT COUNT(*) AS cnt FROM images
    WHERE buyer_id = ANY(ARRAY[:ids]::int[])
      AND status = 'approved'
      AND deleted_at IS NULL
  `, {
    replacements: { ids: buyerIds },
    type: Sequelize.QueryTypes.SELECT
  });
  return parseInt(result[0].cnt, 10) || 0;
}

// ===== 비용 추정 =====
function estimateCost(imageCount, detail, model) {
  // OpenAI Vision 토큰 계산 (GPT-4o 기준)
  // - detail=low: 이미지당 고정 85 tokens
  // - detail=high: 원본 해상도 타일링, 이미지당 평균 ~900~1500 tokens (리뷰 스크린샷은 세로로 긴 편)
  // - detail=auto: 이미지 크기에 따라 자동 (평균 ~700 tokens)
  const inputPerImg = detail === 'low' ? 85 : (detail === 'high' ? 1200 : 700);
  // 시스템 프롬프트 ~350 tokens per call (환각 방지 문구 포함)
  // 구매자당 평균 1.1 이미지, 출력 평균 200 tokens (본문 리뷰)

  const buyersCount = Math.ceil(imageCount / 1.1);
  const totalInput = imageCount * inputPerImg + buyersCount * 350;
  const totalOutput = buyersCount * 200;
  const cost = calculateCost(model, totalInput, totalOutput);
  return { totalInput, totalOutput, cost, buyersCount };
}

// ===== 메인 =====
async function main() {
  const args = parseArgs(process.argv);

  console.log('===== Backfill Extracted Texts =====');
  console.log('Args:', args);

  // 대상 조회
  const buyerIds = await findTargetBuyers(args);
  const imageCount = await countImagesForBuyers(buyerIds);

  console.log(`\n대상 구매자: ${buyerIds.length.toLocaleString()}명`);
  console.log(`대상 이미지: ${imageCount.toLocaleString()}장`);

  if (buyerIds.length === 0) {
    console.log('\n추출 대상이 없습니다. 종료.');
    await sequelize.close();
    return;
  }

  // 예상 비용
  const estimate = estimateCost(imageCount, args.detail, args.model);
  console.log(`\n예상 비용: ~$${estimate.cost.toFixed(4)} (약 ${Math.round(estimate.cost * 1400).toLocaleString()}원)`);
  console.log(`  - 입력 토큰: ~${estimate.totalInput.toLocaleString()}`);
  console.log(`  - 출력 토큰: ~${estimate.totalOutput.toLocaleString()}`);
  console.log(`  - 모델: ${args.model}, detail: ${args.detail}`);

  if (args.dryRun) {
    console.log('\n[DRY RUN] 실제 호출은 하지 않습니다. 종료.');
    await sequelize.close();
    return;
  }

  // OpenAI API Key 체크
  if (!process.env.OPENAI_API_KEY) {
    console.error('\n[ERROR] OPENAI_API_KEY 환경변수가 설정되지 않았습니다.');
    process.exit(1);
  }

  // 5초 대기 (Ctrl+C로 취소 가능)
  console.log('\n5초 후 실행 시작. Ctrl+C로 취소하세요...');
  await new Promise(r => setTimeout(r, 5000));

  // 실행
  const startTime = Date.now();
  const stats = {
    completed: 0,
    not_review: 0,
    unreadable: 0,
    failed: 0,
    skipped: 0,
    totalCost: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0
  };

  let processed = 0;
  const total = buyerIds.length;
  const concurrency = args.concurrency;

  // 중단 핸들링
  let aborted = false;
  process.on('SIGINT', () => {
    console.log('\n\n[SIGINT] 중단 요청됨. 현재 작업 완료 후 종료합니다...');
    aborted = true;
  });

  for (let i = 0; i < buyerIds.length; i += concurrency) {
    if (aborted) break;
    const chunk = buyerIds.slice(i, i + concurrency);

    const results = await Promise.all(
      chunk.map(id => extractForBuyer(id, {
        detail: args.detail,
        model: args.model
      }))
    );

    results.forEach(r => {
      if (r.status && stats[r.status] !== undefined) stats[r.status]++;
      else if (r.status === 'completed') stats.completed++;
      if (r.cost) stats.totalCost += r.cost;
      if (r.inputTokens) stats.totalInputTokens += r.inputTokens;
      if (r.outputTokens) stats.totalOutputTokens += r.outputTokens;
    });

    processed = Math.min(i + concurrency, buyerIds.length);

    // 매 100건(또는 전체)마다 진행률 로깅
    if (processed % 100 < concurrency || processed === total) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = processed / elapsed;
      const remaining = (total - processed) / rate;
      console.log(
        `[${processed}/${total}] (${((processed/total)*100).toFixed(1)}%) ` +
        `cost=$${stats.totalCost.toFixed(4)} ` +
        `rate=${rate.toFixed(1)}/s eta=${Math.round(remaining)}s ` +
        `completed=${stats.completed} not_review=${stats.not_review} unreadable=${stats.unreadable} failed=${stats.failed}`
      );
    }
  }

  // 최종 요약
  const elapsed = (Date.now() - startTime) / 1000;
  console.log('\n===== 완료 =====');
  console.log(`처리: ${processed}/${total}명`);
  console.log(`  완료: ${stats.completed}`);
  console.log(`  리뷰 아님: ${stats.not_review}`);
  console.log(`  판독 불가: ${stats.unreadable}`);
  console.log(`  실패: ${stats.failed}`);
  console.log(`  스킵: ${stats.skipped || 0}`);
  console.log(`총 비용: $${stats.totalCost.toFixed(4)} (약 ${Math.round(stats.totalCost * 1400).toLocaleString()}원)`);
  console.log(`입력 토큰: ${stats.totalInputTokens.toLocaleString()}`);
  console.log(`출력 토큰: ${stats.totalOutputTokens.toLocaleString()}`);
  console.log(`소요 시간: ${Math.round(elapsed)}초`);

  if (aborted) {
    console.log('\n[중단됨] 나머지 대상은 다음 실행 시 자동으로 이어서 처리됩니다.');
  }

  await sequelize.close();
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
