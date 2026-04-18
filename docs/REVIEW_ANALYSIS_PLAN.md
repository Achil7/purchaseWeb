# 리뷰 분석 보고서 기능 - 구현 계획

## Context

브랜드사에게 제품별 리뷰 분석 보고서를 월 1~2회 제공하는 기능. 우리 DB의 리뷰샷 이미지에서 텍스트를 추출(GPT-4o Vision)하고, 실제 플랫폼에서 리뷰를 크롤링한 뒤, 우리쪽 리뷰(돈 주고 쓴 리뷰)를 제외한 순수 고객 리뷰만 Claude API로 분석하여 보고서를 생성한다.

---

## 전체 파이프라인 흐름

### A. 실시간 텍스트 추출 (업로드 시점)
```
[구매자가 리뷰 이미지 업로드]
    ↓
이미지 S3 저장 + Image 레코드 생성 (기존 로직)
    ↓
GPT-4o Vision으로 각 이미지 텍스트 추출 (비동기, fire-and-forget)
    ↓
review_extracted_texts 테이블에 저장 (buyer_id 기준으로 그룹)
    ↓
[재제출 승인 시] 기존 추출 텍스트 삭제 → 새 이미지 텍스트 추출

※ 1 구매자 = N개 이미지 가능 → 같은 buyer_id의 모든 이미지 텍스트를 합쳐서 저장
※ 이미지 크기/장수가 구매자마다 다름 → GPT-4o detail:"auto" 사용 (이미지 크기에 따라 자동 조절)
```

### B. 보고서 생성 (Admin 수동 트리거 또는 스케줄)
```
[Admin이 브랜드 선택 → "리포트 생성" 클릭]
    ↓
Step 1. 플랫폼 리뷰 크롤링 (Playwright)
  - Item.product_url로 플랫폼 접속
  - 최신순 최대 1000개 리뷰 텍스트 추출 → DB 저장
    ↓
Step 2. 리뷰 매칭 (B - A = 순수 리뷰)
  - 크롤링 리뷰(B)에서 이미 추출된 우리 리뷰(A)와 유사한 텍스트 제거
  - Levenshtein 유사도 80%+ → 매칭(paid) 처리
    ↓
Step 3. AI 분석 (Claude API)
  - 순수 리뷰만 배치로 Claude API에 전달
  - 제품별: 긍정 테마, 부정 테마, 키워드 빈도, 감성 분포, 요약, 추천사항
    ↓
Step 4. PDF 보고서 생성
  - HTML 템플릿 → Playwright page.pdf()
  - S3 업로드 → 다운로드 링크 제공
```

### 핵심 변경: 이미지 텍스트 추출 시점
- **변경 전**: 보고서 생성 시 수백장 한꺼번에 추출 (느림, 비효율)
- **변경 후**: 업로드 시 즉시 추출 → 보고서 생성 시에는 이미 DB에 있는 텍스트만 조회
- **장점**: 보고서 생성 속도 대폭 향상, GPT-4o 호출이 분산되어 rate limit 걱정 없음
- **재제출 처리**: approveImage() 함수에 훅 추가 → 기존 텍스트 삭제 + 새 이미지 텍스트 추출

---

## 1. 새 DB 테이블 (5개)

### `review_analysis_jobs` - 작업 마스터
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | SERIAL PK | |
| monthly_brand_id | INT FK | 대상 연월브랜드 |
| status | TEXT | pending → crawling → filtering → analyzing → generating → completed / failed |
| triggered_by | INT FK(users) | 실행한 admin |
| total_items / processed_items | INT | 진행률 |
| current_step | TEXT | 현재 작업 설명 |
| error_message | TEXT | 실패 시 |
| gpt4o_tokens_used, gpt4o_cost_usd | | GPT-4o 비용 |
| claude_input_tokens, claude_output_tokens, claude_cost_usd | | Claude 비용 |
| total_cost_usd | DECIMAL | 총 비용 |
| report_s3_key, report_s3_url | TEXT | 생성된 PDF |
| started_at, completed_at, created_at, updated_at | TIMESTAMP | |

### `review_extracted_texts` - GPT-4o 추출 텍스트 (우리쪽 리뷰)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | SERIAL PK | |
| buyer_id | INT FK(buyers) | 구매자 (1 buyer = 1 row, N개 이미지 합산) |
| item_id | INT FK(items) | 품목 (buyer.item_id 복사, 쿼리 편의) |
| campaign_id | INT FK(campaigns) | 캠페인 (상위 집계용) |
| monthly_brand_id | INT FK(monthly_brands) | 브랜드 (보고서 조회용) |
| extracted_text | TEXT | 추출된 리뷰 텍스트 (여러 이미지면 `\n\n`로 합침). NOT_A_REVIEW면 NULL |
| image_count | INT | 추출에 사용된 이미지 수 |
| image_ids | JSONB | 추출한 이미지 ID 배열 [101, 102, 103] |
| extraction_status | TEXT | pending / completed / not_review / failed / skipped |
| tokens_used_input | INT | GPT-4o 입력 토큰 |
| tokens_used_output | INT | GPT-4o 출력 토큰 |
| cost_usd | DECIMAL(10,6) | 이번 호출 비용 |
| model_used | TEXT | 사용한 모델명 (gpt-4o) |
| extraction_error | TEXT | 실패 시 에러 메시지 |
| last_image_updated_at | TIMESTAMP | 추출 시점의 최신 이미지 created_at (재추출 판단용) |
| extracted_at | TIMESTAMP | 추출 완료 시각 |
| created_at, updated_at | TIMESTAMP | |
| UNIQUE(buyer_id) | | 구매자당 1개 (재제출 시 UPDATE) |

**인덱스:**
- buyer_id (UNIQUE), item_id, campaign_id, monthly_brand_id, extraction_status

**설계 포인트:**
- `image_id` 대신 `buyer_id` 기준: 1 구매자가 N장 업로드 가능하므로 구매자 단위로 합산
- `campaign_id`, `monthly_brand_id` 중복 저장: 보고서 생성 시 JOIN 없이 빠른 조회
- 업로드 시점에 즉시 추출 (보고서 생성과 무관하게 항상 최신 상태 유지)
- 재제출 승인 시: 기존 row UPDATE (새 이미지 텍스트로 교체)
- `image_ids` JSONB: 어떤 이미지에서 추출했는지 추적 가능
- `last_image_updated_at`: 이미지가 바뀌었는지 비교해서 재추출 필요 여부 판단

### 리뷰 판별 로직 (NOT_A_REVIEW)
GPT-4o 프롬프트에 "리뷰가 아니면 NOT_A_REVIEW 출력" 지시 포함:
- 리뷰 이미지 → 본문 텍스트 추출 → `extraction_status = 'completed'`
- 리뷰 아닌 이미지 (영수증/상품사진/엉뚱) → `NOT_A_REVIEW` 응답 → `extraction_status = 'not_review'`, `extracted_text = NULL`
- API 실패 → `extraction_status = 'failed'`, `extraction_error`에 메시지
- 매칭 단계에서 `completed` 상태만 사용

### `review_crawled_texts` - 플랫폼 크롤링 리뷰
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | SERIAL PK | |
| item_id | INT FK(items) | 품목 |
| job_id | INT FK(jobs) | 작업 |
| platform | TEXT | 쿠팡/네이버/... |
| product_url | TEXT | 크롤링한 URL |
| reviewer_name | TEXT | 리뷰어 |
| review_text | TEXT | 리뷰 본문 |
| review_date | TEXT | 작성일 |
| rating | INT | 별점 1-5 |
| review_hash | TEXT | 텍스트 MD5 (매칭용) |
| is_organic | BOOLEAN | null=미확인, true=순수, false=유료매칭 |
| matched_extracted_id | INT FK | 매칭된 추출 텍스트 |

### `review_analysis_results` - Claude 분석 결과 (제품별)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | SERIAL PK | |
| job_id | INT FK(jobs) | 작업 |
| item_id | INT FK(items) | 품목 |
| total_crawled_reviews | INT | 총 크롤링 |
| matched_paid_reviews | INT | 매칭된 유료 리뷰 수 |
| organic_reviews_count | INT | 순수 리뷰 수 |
| positive_themes | JSONB | [{theme, count, example_quotes}] |
| negative_themes | JSONB | [{theme, count, example_quotes}] |
| common_keywords | JSONB | [{keyword, count, sentiment}] |
| sentiment_distribution | JSONB | {positive, neutral, negative} |
| summary | TEXT | AI 요약 |
| recommendations | TEXT | AI 추천사항 |
| UNIQUE(job_id, item_id) | | |

### `review_job_schedules` - 스케줄 (선택적)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | SERIAL PK | |
| monthly_brand_id | INT FK | 대상 브랜드 |
| cron_expression | TEXT | 예: '0 2 1,15 * *' |
| is_active | BOOLEAN | |
| last_run_at, next_run_at | TIMESTAMP | |

---

## 2. API 비용 분석

### GPT-4o Vision (이미지 텍스트 추출 - 업로드 시 실시간)
- **모델**: `gpt-4o` (Vision 지원)
- 가격: input $2.50/1M tokens, output $10.00/1M tokens
- 리뷰 이미지 크기/장수가 구매자마다 다름:
  - 작은 이미지 (≤512px): ~765 tokens → `detail: "low"` 자동
  - 큰 이미지 (>512px): ~1,105+ tokens → `detail: "high"` 타일링
- **이미지당 비용: ~$0.003~$0.008** (크기에 따라)
- 100장: ~$0.30~$0.80

**실행 시점**: 구매자 이미지 업로드/재제출 승인 시 즉시 (보고서와 무관)
**최적화 전략:**
- `detail: "auto"` 사용 (이미지 크기에 맞게 자동 조절)
- 1 구매자 N장 → 여러 이미지를 한 번의 API 호출로 전송 (멀티이미지 지원)
- 업로드 시점에 분산되어 rate limit 부담 없음
- 재제출 승인 시만 재추출 (불필요한 중복 호출 없음)

### Claude API (리뷰 분석)
- **모델**: `claude-haiku-4-5-20251001` (비용 효율, 한국어 우수)
- 가격: input $1.00/1M, output $5.00/1M, 캐시 write $1.25/1M, 캐시 read $0.10/1M
- 시스템 프롬프트 ~500 tokens (캐싱 → 2번째부터 90% 할인)
- 리뷰 50개 배치 ≈ 5,000 input tokens + 2,000 output tokens
- **배치당 비용: ~$0.015**
- 제품 10개 × 각 2배치: ~$0.30

**최적화 전략:**
- 시스템 프롬프트 캐싱 (prompt caching)
- Haiku 4.5 사용 (Sonnet 대비 1/3 비용, 분석 품질 충분)
- 리뷰 50개씩 배치 (컨텍스트 효율)

### 브랜드당 1회 보고서 총 비용 추정
| 항목 | 수량 | 비용 |
|------|------|------|
| GPT-4o Vision (이미지 추출) | 업로드 시 분산 (보고서 비용 아님) | $0 (이미 추출됨) |
| Claude Haiku (리뷰 분석) | 10제품 × 2배치 | ~$0.30 |
| **보고서 생성 비용** | | **~$0.30 (~430원)** |

**이미지 추출 비용 (별도, 업로드 시 발생):**
- 월 200장 업로드 기준: ~$0.60~$1.60/월
- 보고서 생성과 무관하게 발생

**월간 총 비용 (10개 브랜드 × 2회):**
- 보고서 분석: ~$6/월 (~8,600원)
- 이미지 추출: ~$1/월 (~1,400원)
- **합계: ~$7/월 (~10,000원)**

---

## 3. 플랫폼별 크롤러 설계

**도구**: Playwright (Node.js 네이티브, Selenium보다 적합)

### 공통 전략 (baseCrawler)
- User-Agent 20개 풀 랜덤 로테이션
- 요청간 2~5초 랜덤 딜레이
- `playwright-extra` + `stealth` 플러그인 (headless 감지 우회)
- 실패 시 3회 재시도 (5s → 15s → 45s 백오프)
- 프록시 지원 (env: `CRAWLER_PROXY_URL`)
- 크롤링 실패 시 해당 플랫폼만 skip, 나머지 계속 진행

### 플랫폼별 상세

| 플랫폼 | 난이도 | 리뷰 로딩 방식 | 안티봇 | 전략 |
|--------|--------|---------------|--------|------|
| **쿠팡** | 최상 | AJAX API (`/vp/product/reviews`) | Cloudflare, 핑거프린팅 | stealth + 프록시 + 3초 딜레이. 차단 시 fallback으로 skip 처리 |
| **네이버** | 중 | 리뷰탭 클릭 → 페이지네이션 | 기본 rate limit | 리뷰탭 클릭 후 페이지 순회. 스마트스토어/쇼핑 URL 구분 |
| **11번가** | 중하 | AJAX 호출 | 약함 | 직접 AJAX 엔드포인트 호출, 페이지네이션 파라미터 |
| **지마켓** | 중하 | AJAX 호출 | 약함 | eBay Korea API, 옥션과 유사 |
| **옥션** | 중하 | AJAX 호출 | 약함 | 지마켓과 동일 구조 |
| **티몬** | 중 | 페이지네이션 | 약함 | 리뷰 페이지 순회 |
| **위메프** | 중 | 페이지네이션 | 약함 | 리뷰 페이지 순회 |

### 쿠팡 특별 대응
1. `playwright-extra-plugin-stealth` 필수
2. 전용 프록시 지원 (`COUPANG_PROXY_URL` env)
3. 쿠팡 리뷰 AJAX API 직접 호출 시도 → 차단되면 풀 렌더링 모드
4. 최악의 경우: 해당 제품 쿠팡 리뷰 skip → 보고서에 "크롤링 실패" 표기

### Docker 변경 필요
```dockerfile
# 현재: FROM node:18-alpine
# 변경: FROM node:18-bullseye-slim (Playwright Chromium 의존성)
# 추가: RUN npx playwright install --with-deps chromium
# 이미지 크기 증가: ~400-500MB
```

---

## 4. 리뷰 매칭 로직 (B - A)

```
1. 우리 리뷰(A): extracted_text를 정규화 (공백/특수문자 제거)
2. 플랫폼 리뷰(B): review_text를 정규화
3. 각 B에 대해 모든 A와 비교:
   - 정확 매칭: 정규화 텍스트 동일 → is_organic = false
   - 유사 매칭: Levenshtein 유사도 80%+ → is_organic = false
   - 부분 매칭: A가 B에 포함 (substring) → is_organic = false
4. 매칭 안 됨 → is_organic = true (순수 리뷰)
```

**주의**: 리뷰 이미지에서 추출한 텍스트와 플랫폼 리뷰 텍스트는 완전히 동일하지 않을 수 있음 (이미지 OCR 오류, 줄바꿈 차이 등). 따라서 유사도 기반 매칭 필수.

---

## 5. PDF 보고서 구조

**방식**: HTML 템플릿(EJS) → Playwright `page.pdf()` → S3 업로드

### 보고서 페이지 구성
```
1. 표지
   - 브랜드명, "리뷰 분석 리포트"
   - 분석 기간, 생성일
   - 분석 제품 수, 총 리뷰 수

2. 종합 요약 (Executive Summary)
   - 전체 감성 분포 (긍정/중립/부정 비율 - SVG 차트)
   - TOP 3 칭찬 포인트
   - TOP 3 불만 포인트
   - 핵심 권장사항

3. 제품별 분석 (제품당 1~2페이지)
   - 제품명, 플랫폼, URL
   - 리뷰 수: 총 크롤링 / 유료 / 순수
   - 감성 분포 바 차트
   - 긍정 테마 테이블 (테마 | 빈도 | 대표 인용문)
   - 부정 테마 테이블
   - 주요 키워드 (빈도 기반 크기 표시)
   - AI 요약 문단
   - AI 추천사항

4. 부록
   - 크롤링 성공/실패 현황
   - API 비용 내역
```

**폰트**: Noto Sans KR (Google Fonts, 한국어 지원)

---

## 6. 백엔드 새 파일 구조

```
backend/src/
  models/
    ReviewAnalysisJob.js
    ReviewExtractedText.js
    ReviewCrawledText.js
    ReviewAnalysisResult.js
    ReviewJobSchedule.js
  controllers/
    reviewAnalysisController.js
  routes/
    reviewAnalysis.js
  services/
    reviewAnalysis/
      jobManager.js              # 작업 상태머신 + 파이프라인 오케스트레이션
      imageExtractor.js          # GPT-4o Vision 연동
      platformCrawler.js         # 크롤러 오케스트레이터
      crawlers/
        baseCrawler.js           # 공통 로직 (UA 로테이션, 딜레이, 재시도)
        coupangCrawler.js
        naverCrawler.js
        elevenstreetCrawler.js
        gmarketCrawler.js
        auctionCrawler.js
        timonCrawler.js
        wemakepriceCrawler.js
        userAgents.js            # UA 풀
      reviewMatcher.js           # 유사도 매칭 (B - A)
      reviewAnalyzer.js          # Claude API 배치 분석
      reportGenerator.js         # PDF 생성 + S3 업로드
      templates/
        report.ejs               # HTML 보고서 템플릿
  schedulers/
    reviewAnalysisScheduler.js   # 스케줄 자동 실행
  migrations/
    YYYYMMDD-create-review-analysis-tables.js
```

## 7. 프론트엔드 새 파일 구조

```
frontend/src/
  components/admin/
    reviewAnalysis/
      ReviewAnalysisDashboard.js  # 메인: 브랜드 선택 + 작업 목록 + 생성 버튼
      ReviewAnalysisJobDetail.js  # 작업 상세: MUI Stepper 진행률 + 비용 + PDF 다운로드
      ReviewAnalysisSchedules.js  # 스케줄 관리 (선택적)
      ReviewAnalysisCosts.js      # 비용 추적 (선택적)
  services/
    reviewAnalysisService.js      # API 클라이언트
```

### API 엔드포인트
```
POST   /api/review-analysis/jobs                 # 작업 생성 (admin)
GET    /api/review-analysis/jobs                 # 작업 목록
GET    /api/review-analysis/jobs/:id             # 작업 상세
GET    /api/review-analysis/jobs/:id/progress    # 실시간 진행률 (polling)
POST   /api/review-analysis/jobs/:id/cancel      # 작업 취소
GET    /api/review-analysis/jobs/:id/report       # PDF 다운로드
GET    /api/review-analysis/costs                 # 비용 요약
```

---

## 8. 수정이 필요한 기존 파일

| 파일 | 변경 내용 |
|------|----------|
| [models/index.js](backend/src/models/index.js) | 5개 새 모델 등록 |
| [app.js](backend/src/app.js) | `/api/review-analysis` 라우트 등록 |
| [imageController.js](backend/src/controllers/imageController.js) | **uploadImages()에 텍스트 추출 훅 추가** (업로드 완료 후 비동기 추출) |
| [imageController.js](backend/src/controllers/imageController.js) | **approveImage()에 재추출 훅 추가** (승인 시 기존 텍스트 삭제 → 새 이미지 텍스트 추출) |
| [Dockerfile](deploy/Dockerfile) | `node:18-alpine` → `node:18-bullseye-slim`, Playwright 설치 |
| [docker-compose.yml](deploy/docker-compose.yml) | 환경변수 추가 (OPENAI_API_KEY, ANTHROPIC_API_KEY 등) |
| [App.js](frontend/src/App.js) | `/admin/review-analysis` 라우트 추가 |
| AdminLayout (toolbar) | "리뷰 분석" 네비게이션 버튼 추가 |

---

## 9. npm 의존성 추가

### Backend
```
openai                           # GPT-4o Vision API
@anthropic-ai/sdk                # Claude API
playwright                       # 크롤링 + PDF 생성
playwright-extra                  # stealth 플러그인
puppeteer-extra-plugin-stealth   # headless 감지 우회
ejs                              # HTML 템플릿
```

### Frontend
- 추가 의존성 없음 (MUI 기존 컴포넌트 활용)

---

## 10. 환경변수 추가

```env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
MAX_CONCURRENT_ANALYSIS_JOBS=2
ANALYSIS_JOB_TIMEOUT_MS=1800000    # 30분
ANALYSIS_COST_CAP_USD=5.00         # 작업당 비용 상한
CRAWLER_PROXY_URL=                 # (선택) 범용 프록시
COUPANG_PROXY_URL=                 # (선택) 쿠팡 전용 프록시
```

---

## 11. 구현 순서

### Phase 1: 기반 (DB + 작업 관리 + UI 골격)
- 마이그레이션 + 5개 모델 생성
- jobManager 상태머신
- 컨트롤러/라우트 CRUD
- 프론트엔드 Dashboard 기본 UI

### Phase 2: 실시간 이미지 텍스트 추출 (GPT-4o - 업로드 훅)
- openai 패키지 설치
- imageExtractor 서비스 구현
- **imageController.uploadImages()** 수정: 업로드 완료 후 비동기 텍스트 추출 호출
- **imageController.approveImage()** 수정: 승인 시 기존 텍스트 삭제 → 새 이미지 재추출
- 1 구매자 N장 이미지 → GPT-4o 멀티이미지 한 번 호출 → 합산 텍스트 저장
- 추출 실패 시 로그만 남김 (업로드 자체는 실패하지 않음, fire-and-forget)
- 프롬프트에 "리뷰 아니면 NOT_A_REVIEW" 지시 → 리뷰 아닌 이미지 자동 구분

### Phase 2.5: 기존 이미지 일회성 백필 스크립트
- **현황**: approved 이미지 68,278장 (대부분 1인 1장, 최대 14장)
- 스크립트: `backend/scripts/backfillExtractedTexts.js`
  - 아직 추출 안 된 buyer만 조회 (LEFT JOIN review_extracted_texts)
  - 동시 실행 제한 (10개씩 concurrent)
  - 진행률 로깅 (매 100개마다: 건수, 누적 비용, 예상 남은 시간)
  - 중단/재실행 가능 (이미 추출된 건 skip)
  - 완료 시 요약 출력 (총 건수, 성공/실패/not_review, 총 비용)

**detail 옵션별 비용 (68,278장 기준):**
| 옵션 | 동작 | 이미지당 토큰 | 전체 비용 |
|------|------|-------------|----------|
| `low` (추천) | 항상 512x512 축소 | 고정 85 | **~$15 (~2만원)** |
| `auto` | 작은 이미지는 low, 큰 이미지는 타일링 | 85~수백 | ~$100~400 |
| `high` | 원본 해상도 타일링 | 85 + N×170 | $150~700 |

**사용자 결정**: `low`로 먼저 10장 테스트 → 품질 확인 → 전체 실행
- 리뷰 스크린샷은 글씨 크기가 충분히 커서 low로도 대부분 읽힘
- 테스트에서 읽기 어려운 경우만 auto로 재실행

**실행 방법 (단계적 권장):**
1. `node backend/scripts/backfillExtractedTexts.js --dry-run` - 대상 수/예상 비용 확인
2. `node backend/scripts/backfillExtractedTexts.js --limit=10 --detail=low` - 10장 품질 테스트
3. 품질 OK → `node backend/scripts/backfillExtractedTexts.js --detail=low` - 전체 실행

**스크립트 옵션:**
- `--dry-run`: 실제 호출 없이 대상 수/예상 비용만 출력
- `--limit=N`: 소량 실행 (기본: 오래된 순)
- `--random`: `--limit`과 함께 쓰면 랜덤 선택 (**품질 테스트용**)
- `--detail=low|auto|high`: 해상도 모드 (기본값 `low`)
- `--brand-id=N`: 특정 브랜드만 (선택)

**검증 쿼리** (품질 테스트 후 실행):
```sql
SELECT
  ret.buyer_id,
  b.buyer_name,
  ret.extraction_status,
  LEFT(ret.extracted_text, 200) as text_preview,
  ret.image_count,
  ret.cost_usd,
  (SELECT s3_url FROM images WHERE buyer_id = ret.buyer_id AND status='approved' LIMIT 1) as sample_image_url
FROM review_extracted_texts ret
JOIN buyers b ON b.id = ret.buyer_id
ORDER BY ret.created_at DESC
LIMIT 10;
```
→ `sample_image_url`을 브라우저로 열어 원본과 `text_preview` 비교하여 품질 판단

### Phase 3: 플랫폼 크롤링 (가장 큰 작업)
- Playwright 설치 + Dockerfile 수정
- baseCrawler 구현
- 네이버 → 쿠팡 → 11번가 → 지마켓/옥션 → 티몬/위메프 순서

### Phase 4: 매칭 + Claude 분석
- reviewMatcher (유사도 기반 B - A)
- reviewAnalyzer (Claude API 배치 호출)
- 프롬프트 튜닝

### Phase 5: PDF 보고서
- HTML 템플릿 제작
- reportGenerator (Playwright PDF)
- S3 업로드 + 다운로드

### Phase 6: UI 완성 + 스케줄러
- JobDetail 진행률 UI (Stepper)
- 비용 추적 UI
- 스케줄 자동 실행 (선택적)

---

## 12. 리스크 및 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| 쿠팡 봇 차단 | 쿠팡 리뷰 수집 불가 | stealth + 프록시. 실패 시 해당 제품만 skip |
| 플랫폼 HTML 변경 | 크롤러 깨짐 | 크롤링 성공률 모니터링, 실패 시 알림 |
| Docker 이미지 크기 증가 | 배포 시간 증가 | Chromium만 설치 (~400MB), 멀티스테이지 빌드 |
| API 비용 초과 | 예산 초과 | 작업당 비용 상한 ($5) 설정, 비용 대시보드 |
| OCR 텍스트 품질 | 매칭 정확도 저하 | Levenshtein 80% 임계값 + substring 매칭 병용 |
| 서버 재시작 중 작업 | 작업 중단 | 서버 시작 시 미완료 작업 failed 처리, 재실행 가능 |

---

## 13. Phase 2 상세 구현 설계 (지금 바로 진행할 것)

### 13.1 파일 추가/수정 목록 (Phase 2만)

**추가:**
- `backend/migrations/YYYYMMDDHHMMSS-create-review-extracted-texts.js` - 테이블 마이그레이션
- `backend/src/models/ReviewExtractedText.js` - Sequelize 모델
- `backend/src/services/imageExtractor.js` - GPT-4o Vision 호출 로직
- `backend/src/config/openai.js` - OpenAI 클라이언트 싱글턴
- `backend/scripts/backfillExtractedTexts.js` - 일회성 백필 스크립트

**수정:**
- `backend/package.json` - `openai` 의존성 추가
- `backend/src/models/index.js` - ReviewExtractedText 모델 등록
- `backend/src/controllers/imageController.js`:
  - `uploadImages()` 마지막 부분: 성공 시 `imageExtractor.extractForBuyer(buyerId)` fire-and-forget 호출
  - `approveImage()` 마지막 부분: 승인 완료 후 `imageExtractor.extractForBuyer(buyerId, { force: true })` 호출
  - `rejectImage()`: 재추출 불필요 (기존 approved 이미지는 그대로 유지됨)
- `deploy/docker-compose.yml` - `OPENAI_API_KEY` 환경변수 추가

### 13.2 `imageExtractor.js` API 설계

```javascript
// 주요 함수 시그니처
extractForBuyer(buyerId, options = {})
  // options.force: true면 기존 row 강제 재추출 (approveImage 호출 시)
  // options.force: false면 이미 있으면 skip (uploadImages 호출 시)
  // returns: { status, text, tokensUsed, cost } (호출자는 결과 무시 가능)

// 내부 로직:
// 1. buyer + approved 이미지 조회
// 2. 이미지 0장이면 early return
// 3. 기존 review_extracted_texts 조회 (force=false면 존재 시 skip)
// 4. GPT-4o Vision API 호출 (멀티이미지)
// 5. 응답 파싱: NOT_A_REVIEW 체크
// 6. DB upsert (buyer_id UNIQUE)
// 7. 에러 시 DB에 failed 상태 기록 (throw 하지 않음)
```

### 13.3 GPT-4o 프롬프트

```
System:
당신은 한국 쇼핑몰 리뷰 이미지에서 리뷰 본문을 추출하는 도구입니다. 다음 규칙을 엄격히 지키세요:

1. 이미지가 쇼핑몰(쿠팡/네이버/11번가 등)의 상품 리뷰 스크린샷이 아니면 정확히 "NOT_A_REVIEW"만 출력하세요. 다른 말 추가 금지.
   - 영수증, 상품 사진만 있는 것, 채팅창, 광고 등은 리뷰가 아님
2. 리뷰 이미지라면 리뷰 "본문 텍스트"만 추출하세요:
   - 작성자명, 작성일, 별점, "도움돼요" 버튼 등 메타데이터 제외
   - 본문 그대로 (오타/맞춤법 수정 금지)
   - 여러 리뷰가 한 이미지에 있으면 "---"로 구분
3. 이미지 여러 장이 주어지면 모든 리뷰를 순서대로 추출하여 "\n\n"로 구분

User (multi-image):
[image_url_1]
[image_url_2]
...
```

### 13.4 OpenAI API 호출 파라미터

```javascript
{
  model: "gpt-4o",
  messages: [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        { type: "image_url", image_url: { url: s3Url1, detail: "low" } },
        { type: "image_url", image_url: { url: s3Url2, detail: "low" } },
      ]
    }
  ],
  max_tokens: 2000,
  temperature: 0,
}
```

**detail 선택**:
- `"low"`: 모든 이미지 고정 85 tokens → 저비용, 속도 빠름 → **백필 스크립트 기본값**
- `"high"`: 이미지 해상도에 따라 토큰 증가 → 정확도 우선 시
- `"auto"`: 이미지 크기에 따라 자동 → 실시간 업로드 기본값

### 13.5 백필 스크립트 흐름

```
1. 인자 파싱 (--dry-run, --limit, --brand-id)
2. 대상 buyer 조회:
   SELECT b.id, b.item_id
   FROM buyers b
   WHERE EXISTS (SELECT 1 FROM images WHERE buyer_id=b.id AND status='approved' AND deleted_at IS NULL)
     AND NOT EXISTS (SELECT 1 FROM review_extracted_texts WHERE buyer_id=b.id)
   ORDER BY b.created_at
   LIMIT ?
3. 동시 실행 10개로 chunk 처리 (p-limit 또는 Promise.all with batch)
4. 각 buyer마다 imageExtractor.extractForBuyer(id) 호출
5. 진행률/비용 로깅 (매 100건)
6. Ctrl+C 핸들링: 진행 상황 저장 후 종료
```

### 13.6 비용 가드 (최종 결정)

**자동충전 활용 + 점진적 한도 설정 전략:**
- 스크립트 내 비용 상한 없음 (끊김 없이 운영)
- OpenAI 자동충전 활성화 (크레딧 소진 시 자동 충전)
- **지금은 월 한도 미설정** (이벤트로 구매자 폭주 대비)
- **2~3개월 후 평균 사용량 파악 후 월 한도 설정** (평균의 3~5배)

**조기 감지 장치 (꼭 설정):**
- OpenAI Dashboard → Settings → Limits → **Threshold alerts** 설정
  - $50, $100, $200 도달 시 이메일 알림
  - 폭주 발생 시 조기 인지 가능
- 백필 스크립트 시작 시 대상 수/예상 비용 출력 후 5초 대기 (Ctrl+C로 취소 가능)
- 진행 중 매 100건마다 누적 비용 로깅

### 13.7 환경변수 추가 (docker-compose.yml)

```yaml
OPENAI_API_KEY: ${OPENAI_API_KEY}
OPENAI_MODEL: gpt-4o
OPENAI_VISION_DETAIL: low           # low/high/auto (default: low)
EXTRACTION_ENABLED: true             # false면 훅 비활성화 (테스트용)
```

### 13.8 구현 단계 (Phase 2 내부)

1. **DB 준비** (5분)
   - 마이그레이션 파일 작성
   - 로컬/테스트 DB에 마이그레이션 적용 확인용 SQL 제공

2. **모델 + OpenAI 클라이언트** (10분)
   - ReviewExtractedText.js
   - config/openai.js

3. **imageExtractor 서비스** (30분)
   - 프롬프트 + 호출 로직
   - 에러 처리 + DB upsert

4. **uploadImages / approveImage 훅** (15분)
   - fire-and-forget 호출 추가

5. **백필 스크립트** (30분)
   - --dry-run 먼저 확인
   - 실제 실행 가이드 제공

6. **검증** (사용자가 실행)
   - --dry-run으로 대상 수/비용 확인
   - --limit=10으로 소량 테스트
   - 결과 SQL로 확인
   - 전체 실행

---

## 14. 검증 방법

1. **DB 마이그레이션**: `npx sequelize-cli db:migrate` 실행 후 테이블 확인
2. **실시간 추출 테스트**: 이미지 업로드 → review_extracted_texts에 자동 저장 확인
   - 1장 업로드 테스트
   - 3장 동시 업로드 테스트 (멀티이미지 합산)
   - 재제출 승인 → 텍스트 업데이트 확인
3. **크롤러 테스트**: 플랫폼별 1개 URL로 리뷰 10개 추출 확인
4. **매칭 테스트**: 알려진 유료 리뷰가 정확히 제외되는지 확인
5. **Claude 분석 테스트**: 리뷰 50개로 분석 결과 JSON 구조 확인
6. **PDF 테스트**: 한국어 폰트 렌더링, 차트 표시, 페이지 레이아웃 확인
7. **E2E 테스트**: 1개 브랜드, 2개 제품으로 전체 파이프라인 실행
