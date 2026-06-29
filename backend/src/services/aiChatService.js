const { QueryTypes } = require('sequelize');
const { getAnthropicClient, resolveModel, calculateCost } = require('../config/anthropic');
const { readonlySequelize } = require('../config/readonlyDb');
const { validateAndPrepare, MAX_LIMIT } = require('./sqlValidator');
const { KNOWLEDGE } = require('./aiChatKnowledge');
const { renderHtmlToPdf } = require('./pdfRenderer');

const MAX_ITERATIONS = 12; // 무한 tool 루프 방지

/**
 * DB 스키마 + 도구 사용 규칙 (정적). 지식 문서(KNOWLEDGE)와 합쳐 캐시 블록으로 사용.
 */
const SCHEMA_AND_RULES = `# DB 질의 / 도구 사용 규칙

당신은 위 "CampManager 기능/업무규칙 지식"을 아는 총관리자 전용 AI 비서다. PostgreSQL DB를 읽기전용으로 조회하고, 한국어로 명확히 답한다.

## 질문 라우팅
- **기능/규칙/사용법** 질문(예: "진행률은 어떻게 계산돼?", "임시구매자가 뭐야?", "진행자 배정은 어떻게 해?") → 위 지식으로 run_sql 없이 답한다.
- **실제 데이터 수치/목록** 질문(예: "이번 달 캠페인 몇 개?", "리뷰 완료율 낮은 상품") → run_sql로 조회해 답한다.
- **혼합** 질문 → 지식으로 개념을 설명하고 run_sql로 수치를 채운다.
- 지식과 DB가 충돌하면 **DB(사실) 우선**, 차이를 언급한다.

## 도구
- **run_sql(query)**: 읽기전용 PostgreSQL 쿼리 실행. SELECT/WITH로 시작하는 단일 구문만 가능(변경 쿼리 차단).
- **generate_pdf(html, title)**: 리포트 HTML을 PDF로 렌더링(아래 "문서/PDF 생성" 참고).

## 정확도 규칙 (매우 중요)
- **개수/건수/합계는 반드시 SQL 집계(COUNT(*), SUM())로 구하라.** tool_result의 \`rows\` 배열 길이를 직접 세지 마라 — 최대 ${MAX_LIMIT}행에서 잘릴 수 있다.
- tool_result에 **\`truncated: true\`**가 있으면 결과가 ${MAX_LIMIT}행에서 잘린 것이다. 그 부분집합으로 총계를 단언하지 말고, 집계(COUNT/SUM/GROUP BY)로 다시 조회하거나 사용자에게 "상위 N건만 표시"임을 명시하라.
- 데이터로 확인되지 않은 내용은 추측하지 말고 쿼리로 확인하라.

## DB 스키마 (snake_case)
### users (soft delete 없음)
id, username, name, email, role('admin'|'sales'|'operator'|'brand'), phone, is_active, last_login, assigned_sales_id, serial(브랜드 일련번호 'BR0001' 형식, 브랜드 전용 - 견적서 매칭키), created_at
### monthly_brands (paranoid: deleted_at)
id, name, brand_id→users.id, created_by→users.id, year_month('YYMM'), status, is_hidden, sort_order, created_at
### campaigns (paranoid)
id, name, registered_at(date), created_by→users.id(영업사), brand_id→users.id(브랜드사), monthly_brand_id→monthly_brands.id, status('active'|'completed'|'cancelled'), is_hidden, created_at
### items (paranoid)
id, campaign_id→campaigns.id, product_name, platform, shipping_type, keyword, total_purchase_count(TEXT), daily_purchase_count(TEXT), product_price(TEXT), purchase_option, product_url, courier_service_yn, courier_name, deposit_name, status, sale_price_per_unit(TEXT), courier_price_per_unit(TEXT), date(TEXT), created_at
(platform/product_name 등은 파이프 '|'로 복수값 가능)
### item_slots (paranoid)
id, item_id→items.id, slot_number, day_group(int), date(TEXT), buyer_id→buyers.id(nullable), is_suspended(bool), status, created_at (+ 제품정보 컬럼 day_group별 독립)
### campaign_operators (timestamps/soft delete 없음)
id, campaign_id, item_id, operator_id→users.id, day_group(nullable), assigned_by, assigned_at
### buyers (paranoid)
id, item_id→items.id, order_number, buyer_name, recipient_name, user_id(쇼핑몰 아이디), contact, address, account_info, is_temporary(bool), amount(TEXT), payment_status('pending'|'completed'), payment_confirmed_at, tracking_number, courier_company, shipping_delayed(bool), deposit_name, expected_payment_date(date), review_submitted_at, date(TEXT), created_by→users.id, created_at
### images (paranoid, updated_at 없음)
id, buyer_id→buyers.id, item_id→items.id, s3_url, status('pending'|'approved'|'rejected', 기본 'approved'), created_at
(이 외 review_extracted_texts 등도 SELECT 가능)

## 쿼리 작성 규칙
- **Soft delete**: monthly_brands/campaigns/items/item_slots/buyers/images 조회 시 항상 \`deleted_at IS NULL\`. (users, campaign_operators는 deleted_at 없음)
- **시간대(KST)**: 타임스탬프는 timestamptz(UTC). 날짜 집계·표시는 \`(created_at AT TIME ZONE 'Asia/Seoul')\`, 날짜만 \`(created_at AT TIME ZONE 'Asia/Seoul')::date\`.
- **유효 데이터/리뷰 완료**: \`buyers.is_temporary=false\` + \`item_slots.is_suspended=false\`, "리뷰 완료"는 buyer에 \`images.status='approved'\` 이미지 1건 이상.
- **구매자 등록 판정(중요)**: 구매자 행(슬롯)은 영업사가 품목 등록 시 자동 생성되는 빈 칸이다. **주문번호(order_number)가 있으면 등록된 구매자, 없으면 미등록 슬롯(정상)**. "등록 구매자 수"는 \`order_number IS NOT NULL AND order_number <> ''\` 기준으로 센다. 빈 슬롯(주문번호 없음)은 누락·이상치가 아니다.
- **숫자 캐스팅**: amount/product_price/total_purchase_count/sale_price_per_unit 등 TEXT → \`CAST(NULLIF(regexp_replace(amount,'[^0-9]','','g'),'') AS BIGINT)\`.
- **진행률 분모**: item_slots 행 수(is_suspended=false)가 기본.

## 결과 보고 = 사람이 알아볼 수 있게 (raw ID 금지, 위치 경로 필수)
관리자는 **연월브랜드 → 캠페인** 순으로 화면을 찾아간다. 연월브랜드·캠페인이 수십 개라 이 위치 정보가 없으면 어디 데이터인지 못 찾는다. 따라서 점검·분석 결과의 **모든 항목**에 raw ID 대신 아래를 **빠짐없이** 붙여라 — 일부만 채우고 나머지를 생략하지 마라. 매번 필요한 테이블을 전부 JOIN해서 채운다.
**표의 컬럼 순서는 반드시 다음으로 고정한다** (앞 6개 필수, 그 뒤에 질문에 따른 값 컬럼들, 마지막에 비고):
\`영업사 | 진행자 | 브랜드 | 연월브랜드 | 캠페인 | 제품 | (질문별 값…) | 비고\`
- **영업사 ≠ 진행자 — 절대 혼동·병합 금지.** 영업사 = 캠페인을 만든 사람(\`campaigns.created_by\`, role='sales'). 진행자 = 그 작업을 배정받아 수행하는 사람(\`campaign_operators.operator_id\`, role='operator'). 둘은 서로 다른 사람이며 **각각 별도 컬럼**이다. "진행자·영업사 OO"처럼 한 칸에 합치지 마라.
- 값이 비면 빈 칸 대신 "미배정" 또는 "-"로 명시.
- 구매자 단위 이슈면 위 6개 뒤에 구매자명·주문번호·날짜·금액 등 관련 컬럼을 덧붙인다.
연결 경로(FK):
- 제품 → 캠페인: \`items.campaign_id = campaigns.id\` (campaigns.name)
- 캠페인 → 연월브랜드: \`campaigns.monthly_brand_id = monthly_brands.id\` (monthly_brands.name)
- 브랜드사: \`campaigns.brand_id = users.id\` (role='brand', users.name) — 또는 \`monthly_brands.brand_id\`
- 영업사(생성자): \`campaigns.created_by = users.id\` (role='sales', users.name)
- 진행자: \`campaign_operators.campaign_id = campaigns.id\` AND \`campaign_operators.operator_id = users.id\` (role='operator', users.name). 필요하면 item_id/day_group으로 더 좁힌다.
- 구매자 → 제품: \`buyers.item_id = items.id\`
예: "item 13443 / 2건"이 아니라 "트리코닉스 두피 스케일러 — 브랜드 어댑트 / 영업사 김OO / 진행자 박OO / 캠페인 2606쿠팡 / 2026-06-02, 2건".
\`order_number\` 등에 들어 있는 비표준 텍스트('품절','진행보류','X' 등)는 그대로 보고하되 **의미를 임의로 추측하지 마라**(예: '예약/대기 표기'라고 단정 금지). 모르면 "order_number 자리에 비표준 텍스트가 들어 있음"으로만.

## 데이터 검증/감사 (사용자가 "검증/감사/이상 점검/맞는지 확인"을 요청할 때)
날짜·품목·캠페인·브랜드·기간 단위로 아래를 점검하고, **문제 항목만** 유형별 표로(심각도 높음/중간 표기), 정상은 건수만 요약한다. 모든 쿼리는 읽기전용.
- **중복**: 같은 품목 내 \`order_number\` 중복(같은 날·다른 날 교차 포함), 구매자(\`buyer_name\`+\`recipient_name\`+\`contact\`) 중복, \`account_normalized\` 중복. (is_temporary=false, deleted_at IS NULL)
- **빈값·누락**:
  (a) **주문번호 누락(문제)**: order_number는 비었는데 구매자명/수취인/연락처/주소/금액 등 **다른 컬럼은 채워진** 행 — 등록하려다 주문번호만 빠뜨린 것이므로 보고 대상.
  (b) **금액 등 누락(문제)**: order_number 있는데 \`amount\`가 비었거나 0, 또는 다른 필수값이 빈 경우.
  ⚠️ 단, **order_number도 없고 다른 컬럼(구매자/수취인/연락처/주소/금액 등)도 전부 비어있는 행은 "미등록 슬롯(정상)"** 이니 누락·이상치로 잡지 마라 — 영업사가 품목 등록 시 자동 생성된 빈 칸이다.
- **금액 이상치**: \`amount\`=0/음수, 같은 품목 \`product_price\` 대비 큰 차이, 같은 품목 평균 대비 극단값. (숫자 캐스팅 규칙 사용)
- **날짜·입금일 정합성**: \`item_slots.date\` vs 연결된 \`buyers.date\` 불일치; 날짜 형식 혼재('YYYY-MM-DD' ↔ 'YY-MM-DD'); payment_status='completed'인데 \`expected_payment_date\` ≠ \`(payment_confirmed_at AT TIME ZONE 'Asia/Seoul')::date\`.
- 위 목록에 갇히지 말고, 사용자가 무엇을 검증·계산해 달라고 하든 스키마·규칙으로 유연하게 수행한다. 건수/수량이 필요하면 해당 행을 COUNT로 센다. 어떤 데이터·컬럼이 DB에 없으면 그 사실만 알려주면 된다(임의로 거부하지 마라).

## 견적서 대조 검증 (일련번호 매칭)
사용자가 엑셀(견적서 등)을 첨부하면 메시지 앞에 \`[첨부 파일: ...] 컬럼: ... 데이터(JSON): ...\` 로 제공된다.
- **매칭 키는 브랜드 일련번호(serial)다.** 견적서엔 브랜드명이 시스템 계정명과 다른 경우가 많다(예: 견적서 "푸드올로지" = 시스템 계정 "어댑트"). 따라서 견적서에 일련번호(BR0001 형식) 컬럼이 있으면 **그 값으로 \`users.serial\`을 매칭하라(브랜드명 텍스트 매칭보다 우선)**. 매칭된 brand 계정의 id가 곧 brand_id다.
- 절차: (1) 첨부에서 일련번호·검증대상값(제품비/리뷰비/금액/기간) 파악 → (2) \`users.serial\`로 브랜드 계정 매칭 → (3) 그 \`brand_id\`의 monthly_brands→campaigns→items→buyers에서 해당 기간(KST) 제품비/리뷰비, 입금완료(payment_status='completed') 금액을 집계 → (4) 견적 금액과 대조. 예: "5월 견적 제품비 5천만 vs 등록 제품비 5천만, 그 중 4,800만 입금완료".
- 일련번호가 없거나 매칭 안 되면 브랜드명으로 시도하되 **매칭 불확실성을 반드시 명시**한다.
- **불일치 항목만** 표로(식별키 | 견적값 | DB값 | 차이), 일치는 합계만. 파일이 일부만 제공(truncated)이면 명시한다.

## 문서/PDF 생성
사용자가 "문서/리포트/PDF 생성"을 요청하면:
1. run_sql로 필요한 데이터를 모두 수집한다.
2. **자기완결적 HTML**(\`<html>...</html>\`, inline CSS만)을 구성한다. 표·요약을 포함하고, 차트가 필요하면 **inline SVG**로 그린다. 외부 이미지/폰트/JS/스크립트는 렌더 시 모두 차단되니 사용하지 마라.
3. \`generate_pdf(html, title)\`를 호출한다.
4. 성공하면 사용자에게 "아래 다운로드 버튼으로 받으세요"라고만 안내한다. **HTML 원문을 다시 출력하지 마라.**

## 답변 형식
- **가능하면 표(마크다운 GFM 표)로 답하라.** 점검·목록·비교 결과는 표가 보기 편하다. 화면에서 마크다운이 렌더링되니 표·**굵게**·목록을 자유롭게 써라.
- 표에는 위치/식별 컬럼(위 고정 순서)과 함께 **비고/이유/에러 같은 설명 컬럼**을 넣어 "왜 문제인지·무슨 상태인지"가 한눈에 보이게 하라.
- 여러 건을 "외 N건"으로 줄일 땐 **정확한 건수를 밝히고**, 사용자가 그 전체를 요청하면 빠짐없이 다 보여줘라(생략한 항목도 후속 질문에 그대로 답할 수 있어야 한다).
- 금액/숫자는 한국어 단위(원/건/명/%)로 읽기 쉽게. 결과가 많으면 집계·상위 N개로 요약한다.`;

// 정적 시스템 프롬프트(지식 + 규칙) — prompt caching 대상
const STATIC_SYSTEM = `${KNOWLEDGE}\n\n${SCHEMA_AND_RULES}`;

/**
 * 시스템 프롬프트 빌드: 정적 블록(캐시) + 가변 블록(날짜, 캐시 안 함)
 */
const buildSystem = () => {
  const todayKST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
  return [
    { type: 'text', text: STATIC_SYSTEM, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: `오늘(KST) 날짜: ${todayKST}. "이번 달/지난주" 등 상대 기간은 이 날짜 기준으로 계산하라.` },
  ];
};

const TOOLS = [
  {
    name: 'run_sql',
    description:
      'CampManager PostgreSQL DB에 읽기전용 SQL을 실행하고 결과 행(JSON)을 반환한다. SELECT 또는 WITH로 시작하는 단일 쿼리만 허용.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '실행할 PostgreSQL SELECT/WITH 쿼리(단일 구문)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'generate_pdf',
    description:
      'run_sql로 수집한 데이터로 구성한 자기완결적 HTML 리포트를 PDF로 렌더링한다. 외부 리소스(이미지/폰트/스크립트)는 차단되므로 inline CSS만 쓰고, 차트는 inline SVG로 그려라.',
    input_schema: {
      type: 'object',
      properties: {
        html: { type: 'string', description: '완결형 HTML(<html>...</html>), inline CSS만' },
        title: { type: 'string', description: '리포트 제목(파일명에 사용)' },
      },
      required: ['html', 'title'],
    },
  },
];

/**
 * 첨부 파일 데이터를 마지막 user 메시지에 주입 (messages에만 — 캐시 영향 없음)
 */
const injectAttachment = (messages, attachment) => {
  const fileCtx =
    `[첨부 파일: ${attachment.fileName}, 총 ${attachment.rowCount}행` +
    `${attachment.truncated ? ` (상위 ${attachment.rows.length}행만 제공)` : ''}]\n` +
    `컬럼: ${(attachment.columns || []).join(', ')}\n` +
    `데이터(JSON):\n${JSON.stringify(attachment.rows)}`;

  const lastIdx = messages.length - 1;
  const last = messages[lastIdx];
  const userText = last && typeof last.content === 'string' ? last.content : '';

  const block = {
    role: 'user',
    content: [
      { type: 'text', text: fileCtx },
      { type: 'text', text: userText || '(첨부 파일을 DB와 대조 검증해줘)' },
    ],
  };

  if (last && last.role === 'user') {
    messages[lastIdx] = block;
  } else {
    messages.push(block);
  }
};

/**
 * 매 요청 직전, messages의 마지막 메시지 끝에 캐시 분기점을 둔다.
 * → 에이전트 루프에서 누적되는 대화(조회결과 등)가 다음 단계에서 캐시 읽기(약 1/10 가격)로 재사용됨.
 * (stored messages는 건드리지 않고 요청용 사본에만 cache_control 부착)
 */
const withCacheBreakpoint = (msgs) => {
  if (!msgs.length) return msgs;
  const out = msgs.slice();
  const last = out[out.length - 1];
  let content = last.content;
  if (typeof content === 'string') {
    content = [{ type: 'text', text: content, cache_control: { type: 'ephemeral' } }];
  } else if (Array.isArray(content) && content.length) {
    content = content.map((b, i) =>
      i === content.length - 1 ? { ...b, cache_control: { type: 'ephemeral' } } : b
    );
  } else {
    return msgs;
  }
  out[out.length - 1] = { ...last, content };
  return out;
};

/**
 * 대화 history를 받아 에이전트 루프 실행.
 * @param {Array<{role:'user'|'assistant', content:string}>} history
 * @param {{ attachment?: object }} [opts]
 * @returns {Promise<{answer:string, executedQueries:string[], pdfArtifacts:Array, usage:object}>}
 */
const runChat = async (history, opts = {}) => {
  const { attachment, model: requestedModel } = opts;
  const model = resolveModel(requestedModel); // 화이트리스트 외/미지정 시 기본 모델
  const client = getAnthropicClient();

  const messages = history.map((m) => ({ role: m.role, content: m.content }));
  if (attachment && Array.isArray(attachment.rows) && attachment.rows.length > 0) {
    injectAttachment(messages, attachment);
  }

  const system = buildSystem();
  const executedQueries = [];
  const pdfArtifacts = [];
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheWriteTokens = 0;
  let answer = '';

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const createParams = {
      model,
      // PDF 리포트 HTML이 tool 입력(=출력 토큰)으로 생성되므로 넉넉히 (비스트리밍 안전 상한)
      max_tokens: 16000,
      system,
      tools: TOOLS,
      messages: withCacheBreakpoint(messages),
    };
    // adaptive thinking은 4.6/4.7+ 세대 기능(Sonnet 4.6, Opus 4.x). Haiku 4.5는
    // 미지원이라 보내면 400 → 생략(단순 조회용이라 thinking 불필요, 비용도 절감).
    if (model !== 'claude-haiku-4-5') {
      createParams.thinking = { type: 'adaptive' };
    }
    const resp = await client.messages.create(createParams);

    inputTokens += resp.usage?.input_tokens || 0;
    outputTokens += resp.usage?.output_tokens || 0;
    cacheReadTokens += resp.usage?.cache_read_input_tokens || 0;
    cacheWriteTokens += resp.usage?.cache_creation_input_tokens || 0;

    if (resp.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: resp.content });

      const toolResults = [];
      for (const block of resp.content) {
        if (block.type !== 'tool_use') continue;

        if (block.name === 'run_sql') {
          let content;
          let isError = false;
          const rawQuery = (block.input && block.input.query) || '';
          try {
            const { sql: safeSql, appliedLimit } = validateAndPrepare(rawQuery);
            executedQueries.push(safeSql);
            const rows = await readonlySequelize.query(safeSql, { type: QueryTypes.SELECT });
            const arr = Array.isArray(rows) ? rows : [rows];
            const truncated = arr.length >= appliedLimit;
            content = JSON.stringify({
              row_count: arr.length,
              applied_limit: appliedLimit,
              truncated,
              rows: arr.slice(0, appliedLimit),
            });
          } catch (e) {
            isError = true;
            content = `Error: ${e.message}`;
            executedQueries.push(rawQuery);
          }
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content, is_error: isError });
        } else if (block.name === 'generate_pdf') {
          let content;
          let isError = false;
          try {
            const html = (block.input && block.input.html) || '';
            const title = (block.input && block.input.title) || 'report';
            const buf = await renderHtmlToPdf(html);
            pdfArtifacts.push({ title, base64: buf.toString('base64') });
            content = JSON.stringify({ ok: true, message: 'PDF 생성 완료. 사용자에게 다운로드 버튼 이용을 안내하라.' });
          } catch (e) {
            isError = true;
            content = `PDF 생성 실패: ${e.message}`;
          }
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content, is_error: isError });
        } else {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: `알 수 없는 도구: ${block.name}`,
            is_error: true,
          });
        }
      }

      messages.push({ role: 'user', content: toolResults });
      continue;
    }

    // tool_use 외(end_turn / max_tokens / refusal 등) → 최종 텍스트 추출 후 종료
    if (resp.stop_reason === 'refusal') {
      answer = '요청을 처리할 수 없습니다. (안전 정책상 거부됨)';
    } else {
      answer = resp.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();
    }
    break;
  }

  if (!answer) {
    answer = pdfArtifacts.length
      ? '문서를 생성했습니다. 아래 다운로드 버튼을 이용하세요.'
      : '답변을 생성하지 못했습니다. 질문을 더 구체적으로 다시 시도해 주세요.';
  }

  return {
    answer,
    executedQueries,
    pdfArtifacts,
    usage: {
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cache_read_input_tokens: cacheReadTokens,
      cache_creation_input_tokens: cacheWriteTokens,
      cost_usd: calculateCost(model, {
        inputTokens,
        outputTokens,
        cacheReadTokens,
        cacheWriteTokens,
      }),
    },
  };
};

module.exports = { runChat };
