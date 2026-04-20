const { Buyer, Image, Item, Campaign, ReviewExtractedText, sequelize } = require('../models');
const {
  getOpenAIClient,
  DEFAULT_MODEL,
  DEFAULT_DETAIL,
  EXTRACTION_ENABLED,
  isBrandAllowed,
  calculateCost
} = require('../config/openai');

/**
 * GPT-4o Vision 프롬프트
 * - 리뷰 이미지 → 본문 텍스트 추출
 * - 리뷰가 아니면 NOT_A_REVIEW 반환
 * - 글씨가 안 읽히면 UNREADABLE 반환 (환각 방지)
 */
const SYSTEM_PROMPT = `당신은 한국 쇼핑몰 리뷰 이미지에서 리뷰 본문을 추출하는 OCR 도구입니다. 다음 규칙을 엄격히 지키세요:

[매우 중요 - 환각 금지]
- 이미지에 실제로 보이는 글자만 추출하세요.
- 내용을 추측하거나 창작하지 마세요. 절대로.
- 글씨가 흐려서 명확히 읽을 수 없으면 정확히 "UNREADABLE"만 출력하세요.
- 확실하지 않은 글자는 ?로 표시하세요.
- 리뷰처럼 보이지만 글자가 안 읽히면 "UNREADABLE" (NOT_A_REVIEW 아님).

[판별 규칙]
1. 이미지가 쇼핑몰(쿠팡/네이버/11번가/지마켓/옥션/티몬/위메프 등)의 상품 리뷰 스크린샷이 아니면 정확히 "NOT_A_REVIEW"만 출력하세요.
   - 영수증, 상품 사진만 있는 것, 채팅창, 광고, 기타 무관한 이미지는 리뷰가 아님
2. 리뷰 이미지인데 글씨가 너무 흐려 판독 불가 → "UNREADABLE"
3. 리뷰 이미지이고 글씨를 읽을 수 있음 → 본문 텍스트만 추출:
   - 작성자명, 작성일, 별점, "도움돼요" 버튼 등 메타데이터 제외
   - 본문 그대로 (오타/맞춤법 수정 금지)
   - 여러 리뷰가 한 이미지에 있으면 "---"로 구분
4. 이미지 여러 장이 주어지면 각 이미지의 리뷰를 순서대로 추출하여 빈 줄 하나로 구분

출력은 "NOT_A_REVIEW", "UNREADABLE", 또는 실제 리뷰 본문 중 하나입니다.`;

/**
 * GPT-4o Vision API 호출
 * @param {string[]} imageUrls - S3 이미지 URL 배열
 * @param {object} options - { model, detail }
 * @returns {Promise<{text: string, isNotReview: boolean, inputTokens: number, outputTokens: number, cost: number, model: string, detail: string}>}
 */
async function callVisionAPI(imageUrls, options = {}) {
  const model = options.model || DEFAULT_MODEL;
  const detail = options.detail || DEFAULT_DETAIL;

  const openai = getOpenAIClient();

  const content = imageUrls.map(url => ({
    type: 'image_url',
    image_url: { url, detail }
  }));

  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content }
    ],
    max_tokens: 2000,
    temperature: 0
  });

  const rawText = response.choices[0]?.message?.content?.trim() || '';
  const isNotReview = rawText === 'NOT_A_REVIEW';
  const isUnreadable = rawText === 'UNREADABLE';

  const inputTokens = response.usage?.prompt_tokens || 0;
  const outputTokens = response.usage?.completion_tokens || 0;
  const cost = calculateCost(model, inputTokens, outputTokens);

  return {
    text: (isNotReview || isUnreadable) ? null : rawText,
    isNotReview,
    isUnreadable,
    inputTokens,
    outputTokens,
    cost,
    model,
    detail
  };
}

/**
 * 특정 구매자의 리뷰 이미지 텍스트 추출
 *
 * @param {number} buyerId
 * @param {object} options
 *   - force: true면 기존 row 강제 재추출 (approveImage 호출 시)
 *   - detail: low | high | auto (기본값 DEFAULT_DETAIL)
 *   - model: 모델 오버라이드
 * @returns {Promise<{status: string, reason?: string, cost?: number}>}
 *
 * 설계:
 * - fire-and-forget 호출 대비: 에러를 throw하지 않고 DB에 기록
 * - 동일 buyer_id UNIQUE: upsert로 처리
 */
async function extractForBuyer(buyerId, options = {}) {
  if (!EXTRACTION_ENABLED) {
    return { status: 'disabled' };
  }

  try {
    // 1. 구매자 + approved 이미지 조회
    //    - Image 모델은 paranoid(soft-delete) 설정이지만 include 안에서 where를 쓰면 기본 필터가 비활성화됨
    //    - 명시적으로 deleted_at: null 추가 필수
    const buyer = await Buyer.findByPk(buyerId, {
      include: [
        {
          model: Image,
          as: 'images',
          where: {
            status: 'approved',
            deleted_at: null  // soft-delete 명시적 필터 (중요)
          },
          required: false,
          paranoid: true,
          attributes: ['id', 's3_url', 'created_at']
        },
        {
          model: Item,
          as: 'item',
          attributes: ['id', 'campaign_id'],
          include: [{
            model: Campaign,
            as: 'campaign',
            attributes: ['id', 'monthly_brand_id']
          }]
        }
      ]
    });

    if (!buyer) {
      return { status: 'skipped', reason: 'buyer_not_found' };
    }

    const approvedImages = buyer.images || [];
    if (approvedImages.length === 0) {
      return { status: 'skipped', reason: 'no_images' };
    }

    const itemId = buyer.item_id;
    const campaignId = buyer.item?.campaign_id || null;
    const monthlyBrandId = buyer.item?.campaign?.monthly_brand_id || null;

    // 2. 브랜드 허용 여부 체크 (EXTRACTION_ALLOWED_BRAND_IDS env)
    //    - 옵션으로 skipBrandCheck를 넘기면 우회 (백필 스크립트의 --brand-id 지정 시 사용)
    if (!options.skipBrandCheck && !isBrandAllowed(monthlyBrandId)) {
      return { status: 'skipped', reason: 'brand_not_allowed', monthlyBrandId };
    }

    // 3. 기존 추출 레코드 확인
    const existing = await ReviewExtractedText.findOne({ where: { buyer_id: buyerId } });

    if (existing && !options.force) {
      // 이미지 수가 같고 최신 이미지 시점도 같으면 skip
      const latestImageTime = approvedImages
        .map(img => new Date(img.created_at).getTime())
        .reduce((a, b) => Math.max(a, b), 0);

      const prevTime = existing.last_image_updated_at
        ? new Date(existing.last_image_updated_at).getTime()
        : 0;

      if (existing.image_count === approvedImages.length && prevTime >= latestImageTime) {
        return { status: 'skipped', reason: 'already_extracted' };
      }
    }

    // 3. GPT-4o Vision 호출
    const imageUrls = approvedImages.map(img => img.s3_url);
    const imageIds = approvedImages.map(img => img.id);
    const latestImageTime = approvedImages
      .map(img => new Date(img.created_at).getTime())
      .reduce((a, b) => Math.max(a, b), 0);

    const result = await callVisionAPI(imageUrls, options);

    // 4. DB upsert
    let statusLabel = 'completed';
    if (result.isNotReview) statusLabel = 'not_review';
    else if (result.isUnreadable) statusLabel = 'unreadable';

    const row = {
      buyer_id: buyerId,
      item_id: itemId,
      campaign_id: campaignId,
      monthly_brand_id: monthlyBrandId,
      extracted_text: (result.isNotReview || result.isUnreadable) ? null : result.text,
      image_count: imageUrls.length,
      image_ids: imageIds,
      extraction_status: statusLabel,
      tokens_used_input: result.inputTokens,
      tokens_used_output: result.outputTokens,
      cost_usd: result.cost,
      model_used: result.model,
      detail_used: result.detail,
      extraction_error: null,
      last_image_updated_at: new Date(latestImageTime),
      extracted_at: new Date()
    };

    if (existing) {
      await existing.update(row);
    } else {
      await ReviewExtractedText.create(row);
    }

    return {
      status: statusLabel,
      cost: result.cost,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      imageCount: imageUrls.length
    };

  } catch (err) {
    console.error(`[imageExtractor] extractForBuyer(${buyerId}) failed:`, err.message);

    // 에러도 DB에 기록 (throw 하지 않음 - fire-and-forget 안전성)
    try {
      const existing = await ReviewExtractedText.findOne({ where: { buyer_id: buyerId } });
      const errorData = {
        extraction_status: 'failed',
        extraction_error: err.message?.slice(0, 1000),
        extracted_at: new Date()
      };
      if (existing) {
        await existing.update(errorData);
      } else {
        // 최소한의 정보로 row 생성
        const buyer = await Buyer.findByPk(buyerId, {
          include: [{ model: Item, as: 'item', include: [{ model: Campaign, as: 'campaign' }] }]
        });
        if (buyer) {
          await ReviewExtractedText.create({
            buyer_id: buyerId,
            item_id: buyer.item_id,
            campaign_id: buyer.item?.campaign_id || null,
            monthly_brand_id: buyer.item?.campaign?.monthly_brand_id || null,
            ...errorData
          });
        }
      }
    } catch (logErr) {
      console.error(`[imageExtractor] failed to record error for buyer ${buyerId}:`, logErr.message);
    }

    return { status: 'failed', error: err.message };
  }
}

/**
 * 여러 구매자의 이미지 텍스트 추출 (동시 실행 제한)
 *
 * @param {number[]} buyerIds
 * @param {object} options - { concurrency: 10, detail: 'low' }
 * @returns {Promise<{results, totalCost, totalInputTokens, totalOutputTokens}>}
 */
async function extractForBuyers(buyerIds, options = {}) {
  const concurrency = options.concurrency || 10;
  const results = [];
  let totalCost = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // 동시 실행 제한 (chunk 단위 Promise.all)
  for (let i = 0; i < buyerIds.length; i += concurrency) {
    const chunk = buyerIds.slice(i, i + concurrency);
    const chunkResults = await Promise.all(
      chunk.map(id => extractForBuyer(id, options))
    );
    chunkResults.forEach((r, idx) => {
      results.push({ buyer_id: chunk[idx], ...r });
      if (r.cost) totalCost += r.cost;
      if (r.inputTokens) totalInputTokens += r.inputTokens;
      if (r.outputTokens) totalOutputTokens += r.outputTokens;
    });

    if (options.onProgress) {
      options.onProgress({
        processed: Math.min(i + concurrency, buyerIds.length),
        total: buyerIds.length,
        totalCost,
        totalInputTokens,
        totalOutputTokens
      });
    }
  }

  return { results, totalCost, totalInputTokens, totalOutputTokens };
}

/**
 * fire-and-forget 래퍼 (에러 무시, 로깅만)
 * uploadImages/approveImage 훅에서 호출
 */
function extractForBuyerAsync(buyerId, options = {}) {
  if (!EXTRACTION_ENABLED) return;
  setImmediate(() => {
    extractForBuyer(buyerId, options).catch(err => {
      console.error(`[imageExtractor] async extract for buyer ${buyerId} failed:`, err.message);
    });
  });
}

module.exports = {
  extractForBuyer,
  extractForBuyers,
  extractForBuyerAsync,
  SYSTEM_PROMPT
};
