/**
 * CampManager 기능/업무규칙 지식 베이스 (AI 챗 기능 Q&A용)
 *
 * - "이 기능 어떻게 동작해?", "이 규칙이 뭐야?" 같은 기능적 질문에 답하기 위한 정적 지식.
 * - repo 루트 CLAUDE.md는 Docker 이미지(COPY backend ./)에 포함되지 않으므로 backend 내부에 내장.
 * - 시스템 프롬프트에 합쳐 prompt caching의 정적 블록으로 사용 (자주 바뀌지 않아야 캐시 적중).
 */

const KNOWLEDGE = `# CampManager 기능/업무규칙 지식

CampManager는 리뷰 캠페인 관리 시스템이다. 영업사가 캠페인을 만들고, 진행자가 구매자(리뷰어)를 관리하며, 브랜드사가 진행현황을 모니터링하고, 총관리자가 전체를 통제한다.

## 역할(Role)과 권한
- **admin(총관리자)**: 모든 기능. 진행자 배정/재배정, 입금확인, 사용자 등록/관리, 마진 관리, 캠페인 영업사 변경, 모든 역할의 대시보드 조회(컨트롤 타워). 다른 역할의 기능 API도 사용 가능.
- **sales(영업사)**: 연월브랜드/캠페인/품목 생성(자신 것만), 브랜드 등록, 구매자 조회(읽기 전용·수정/삭제 불가), 송장번호 입력, 입금명 수정, 자신의 캠페인 마진 조회(지출 입력 불가).
- **operator(진행자)**: 배정된 품목의 구매자 CRUD, 이미지 업로드 링크 공유, 입금명 수정, 메모장, 배송지연 토글, 선 업로드 알림 수신.
- **brand(브랜드사)**: 연결된 캠페인의 리뷰 현황 조회(읽기 전용, 제한된 컬럼 — 연락처/계좌 제외, 선 업로드 숨김).

권한 요약표:
- 캠페인/품목 생성: admin, sales
- 구매자 CRUD: admin, operator (sales는 읽기만)
- 진행자 배정/재배정: admin만
- 입금확인 토글: admin만
- 송장 입력: admin, sales(송장만)
- 배송지연 토글: admin, operator
- 마진 지출 입력: admin만 / 마진 조회: admin(전체), sales(자기 캠페인만)
- 사용자 CRUD: admin만

## 데이터 계층 구조
연월브랜드(monthly_brands) → 캠페인(campaigns) → 품목(items) → 품목슬롯(item_slots) → 구매자(buyers) → 리뷰이미지(images)
- **연월브랜드**: 브랜드+연월 조합(예 "2512어댑트"). 영업사가 생성, 브랜드사 연결.
- **캠페인**: 연월브랜드 하위 프로모션. 상태 active/completed/cancelled.
- **품목(item)**: 판매 제품. 제품명/플랫폼(쿠팡·네이버 등)/총구매건수/일구매건수/가격 등. 일부 컬럼은 파이프('|')로 복수값.
- **품목슬롯(item_slot)**: 일 구매건수 단위의 리뷰 슬롯. day_group(일차)으로 그룹화. buyer_id로 구매자 연결. is_suspended(중단) 플래그.
- **구매자(buyer)**: 리뷰어. 주문번호/구매자명/수취인/연락처/주소/계좌/금액. is_temporary(선업로드 임시), payment_status(pending/completed).
- **이미지(image)**: 리뷰샷. S3 저장. status(pending/approved/rejected, 기본 approved).

## 핵심 업무규칙

### 진행자 배정
- admin이 컨트롤 타워 → 진행자 배정 탭에서 캠페인별/품목별/일차(day_group)별로 진행자를 배정.
- 같은 진행자를 다른 일차에 중복 배정 가능. unique 제약: (campaign_id, item_id, day_group, operator_id).
- 배정 시 진행자에게 알림 발송.

### 일마감(splitDayGroup)
- 진행자/영업사 시트에서 "일 마감" 버튼 → 현재 day_group을 분할해 다음 day_group 생성.
- 분할 시: (1) 새 day_group에 고유 업로드 토큰 부여, (2) 현재 day_group의 제품 정보(제품명/플랫폼/출고유형/키워드/가격/건수/택배대행 등)를 새 슬롯에 복사 — 각 day_group은 제품정보가 완전 독립, (3) 현재 day_group 진행자를 새 day_group에 자동 배정.
- 제품정보 우선순위: 슬롯 값 > 품목(item) 값(하위호환).

### 선 업로드 / 임시 구매자
- 구매자 정보 입력 전에 먼저 업로드된 이미지 → is_temporary=true인 임시 buyer로 보관.
- 진행자에게 헤더 알림으로 "선 업로드 N건" 표시(30초 갱신).
- 이후 진행자가 실제 구매자를 등록하면 account_normalized(계좌 정규화) 키로 임시 buyer를 찾아 이미지를 이관하고 임시 buyer는 삭제(병합).
- 브랜드사 화면에는 is_temporary=false인 구매자만 표시(선 업로드 숨김).

### 이미지 업로드(구매자) 및 매칭
- 업로드 링크: /upload-slot/:token (로그인 불필요). 구매자가 이름 검색 → 본인 주문 선택 → 이미지 업로드.
- 검색은 같은 슬롯그룹(item_id+day_group) 내 구매자만, buyer_name/recipient_name/계좌 이름으로 매칭.
- 한 구매자가 여러 이미지를 가질 수 있음(재제출/추가).

### 재제출 승인
- 브랜드/관리자가 이미지를 "불량"으로 보면 status=pending(재제출 요청).
- admin "이미지 승인" 메뉴에서 기존 vs 신규 이미지를 비교해 그룹 단위로 승인(approved)/거절(rejected).
- "리뷰 완료"는 buyer에 status='approved' 이미지가 1개 이상 있는 것으로 판정.

### 입금/송장/배송
- 입금확인: admin이 구매자별 토글(payment_status pending↔completed). payment_confirmed_at 기록.
- 송장: sales는 tracking_number만, admin은 tracking_number+courier_company(택배사). 일괄 입력 가능.
- 배송지연: admin/operator가 shipping_delayed 토글.

### 구매자 행 생명주기 / 등록·리뷰 판정 (매우 중요)
- 구매자 행(슬롯, item_slots)은 영업사가 품목 등록 시 일 구매건수만큼 **자동 생성되는 빈 칸**이다. 진행자/영업사가 나중에 채운다.
- **구매자 "등록" 여부 = 주문번호(order_number) 유무.** order_number 있으면 등록됨, 없으면 미등록. → 전부 빈 행(주문번호 포함 다 비어있음)은 정상(미등록 슬롯). **단, 다른 컬럼(구매자명/수취인/연락처/주소/금액 등)은 채워졌는데 주문번호만 비어있으면 그건 주문번호 누락 = 문제다.**
- **구매자 "리뷰 완료" 여부 = 리뷰샷(images, status='approved') 유무.**

### 진행률/완료율 계산 (3개 역할 공통 기준)
- **분모 = item_slots 행 수**(is_suspended=false). 시트의 "전체 N건"과 동일.
- **분자 = 리뷰 완료 구매자 수** = buyers(is_temporary=false) 중 images(status='approved')가 있는 구매자, item_slots.is_suspended=false.
- 진행률(%) = 분자/분모 × 100.

### 마진 계산
- 총매출(공급가) = total_purchase_count × sale_price_per_unit
- 총매출(VAT포함) = 공급가 × 1.1
- 총지출 = 제품원가 + 배송비 + 리뷰비 + 기타비용
- 마진 = 총매출(VAT포함) − 총지출 / 마진율 = 마진/총매출(VAT포함) × 100
- admin: 지출 입력+전체 조회. sales: 자기 캠페인 조회만.

### 정산(settlement)
- 업체별/월별 정산. 매출(진행비/택배대행 단가×수량) − 지출(실비). admin 전용. 브랜드 정산 별도.

### 슬래시 파싱 구매자 추가
- "주문번호/구매자/수취인/아이디/연락처/주소/계좌정보/금액" 형식을 슬래시로 8개 컬럼 분배.
- 시트에서 주문번호 컬럼에 붙여넣으면 자동 분배.

### 올리브영 랭킹
- 올리브영 상품 순위를 주기적으로 수집(Playwright)해 저장. admin/brand가 순위·추이·인사이트 조회.

### 블로거 체험단 중개 (bloggers / blogger_requests / blogger_request_items)
- 리뷰 캠페인(구매자/리뷰어)과 **완전히 별개**의 블로그 체험단 중개 기능이다. buyers/images와 무관.
- **블로거 목록(bloggers)**: kwad가 모집한 블로거 풀. 활동명/블로그주소/평균 1일 방문자/주요 콘텐츠. **전역 공통**(brand_id 없음) — 모든 브랜드사가 동일 목록을 본다(올리브영 랭킹 탭처럼). admin이 등록/노출관리, is_active=false면 브랜드에 숨김. 블로거는 시스템에 로그인하지 않는다.
- **협의 요청(blogger_requests)**: 브랜드사가 블로거 목록에서 원하는 블로거를 여러 명 골라 "발행 협의 요청"을 보낸 단위(브랜드당 여러 건). status: requested→reviewing→in_progress→completed(+cancelled). product_provision: 협찬(sponsored, 제품 배송) / 내돈내산(self_purchase, 블로거가 직접 구매).
- **요청 항목(blogger_request_items)**: 한 요청에 포함된 블로거별 진행 행. participation_status(대기/참여/거절), 협의 단가(unit_price), 작성 글 링크(submission_url)+제출일(submitted_at).
- **중개 흐름(CS)**: 브랜드 요청 → admin이 "블로거 협의 요청" 보드에서 블로거별 참여의사/단가 입력 → admin이 항목별 공개 제출 토큰(submit_token) 발급 → 블로거가 \`/blogger-submit/:token\`(로그인 불필요)에서 작성 글 링크 제출 → 브랜드가 "내 협의 요청"에서 작성 현황(작성일+링크) 확인.
- 판정: "참여 확정" = participation_status='accepted', "작성 완료" = submission_url 존재. 한 요청의 확정 인원 = 그 요청의 accepted 항목 수.

### 리뷰 텍스트 추출
- GPT-4o Vision으로 승인된 리뷰샷에서 리뷰 본문 텍스트 추출(EXTRACTION_ENABLED + 브랜드 허용 시). NOT_A_REVIEW/UNREADABLE 판별.

### 알림(notification)
- 진행자 배정 시 진행자에게, 재제출 발생 시 admin에게 등. 벨 아이콘 배지로 표시.

### 대리 조회(viewAsUserId)
- admin이 특정 영업사/진행자/브랜드사 대신 데이터를 조회·생성. 컨트롤 타워 embedded 대시보드 / 별도 페이지(view-*).

### 숨김/휴지통
- 연월브랜드/캠페인은 is_hidden으로 숨김/복구(삭제 아님).
- 삭제는 soft delete(paranoid, deleted_at). 휴지통에서 복구/영구삭제. 대부분 테이블이 paranoid.

### 브랜드 일련번호(serial) / 견적서 대조
- 각 브랜드 계정(users role='brand')은 고유 일련번호 \`serial\`(예: BR0001)을 가진다. 계정 생성 시 자동 부여되고 기존 계정은 등록 순으로 부여됨.
- **목적**: 견적서 엑셀의 브랜드명과 시스템 브랜드 계정명이 다른 경우가 많아(예: 견적서 "푸드올로지" = 시스템 "어댑트") 이름 매칭이 어렵다. 견적서에 일련번호를 같이 적어 보내면 \`users.serial\`로 정확히 매칭한다.
- 매칭된 브랜드 계정 id = brand_id → monthly_brands.brand_id / campaigns.brand_id로 그 브랜드의 캠페인·제품·구매자·금액을 찾는다. 견적서의 제품비/리뷰비 vs DB의 등록 금액·입금완료 금액을 대조하는 게 핵심 용도다.

## 데이터 해석 주의 (DB 질의 시)
- 금액/건수/가격(amount, product_price, total_purchase_count, sale_price_per_unit 등)은 **TEXT 컬럼** → 집계 시 숫자 캐스팅 필요.
- 타임스탬프는 UTC(timestamptz) → 날짜 집계는 KST 변환.
- soft delete 테이블은 deleted_at IS NULL 필수.
- "유효 데이터"는 is_temporary=false + images approved + is_suspended=false 기준.
- 모든 엔티티는 FK로 연결돼 있다: 제품(item)→캠페인→연월브랜드/브랜드사(users), 캠페인→영업사(created_by, users), 진행자(campaign_operators→users), 구매자(buyer)→제품. 결과를 보고할 땐 raw ID가 아니라 조인해서 제품명·캠페인·브랜드사·영업사·진행자 이름으로 풀어 보여줄 것.`;

module.exports = { KNOWLEDGE };
