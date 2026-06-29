# 총관리자 (Admin) 기능 가이드

> 총관리자는 시스템 전체를 관리하며, 영업사/진행자/브랜드사 모든 역할의 기능에 API로 접근할 수 있습니다.

`/admin` 경로는 **AdminLayout(자식 라우트 Outlet 구조)** 로 동작하며, 메인 화면은 **컨트롤 타워**입니다. 부가 화면들은 상단 헤더의 **"메뉴" 햄버거 드롭다운**으로 묶여 있고, 다른 사용자의 대시보드는 `view-sales` / `view-operator` / `view-brand` 라우트로 대리 조회합니다.

---

## 0. 실제 라우트 구조 (App.js 기준)

| 라우트 | 컴포넌트 | 설명 |
|-----|-----|-----|
| `/admin` (index), `/admin/control-tower` | AdminControlTower | 메인 = 컨트롤 타워 |
| `/admin/campaigns/:campaignId/assignment` | AdminCampaignAssignment | 진행자 배정 페이지 |
| `/admin/daily-items` | AdminMonthlyBuyers | 월별/일별 구매자 조회 |
| `/admin/daily-payments` | AdminDailyPayments | 날짜별 입금관리 |
| `/admin/tracking-management` | AdminTrackingManagement | 날짜별 송장/배송 관리 |
| `/admin/courier-tracking` | AdminCourierTracking | 택배대행 송장관리 (Handsontable) |
| `/admin/trash` | AdminTrash | 휴지통 (소프트 삭제 복원) |
| `/admin/image-approval` | AdminImageApproval | 이미지 재제출 승인 |
| `/admin/review-search` | AdminReviewSearch | 리뷰샷 검색 (공통 ReviewSearchDashboard) |
| `/admin/brand-settlement` | AdminBrandCampaignSettlement | 브랜드/캠페인 정산 |
| `/admin/rankings` | AdminRankingDashboard | 올리브영 랭킹 대시보드 |
| `/admin/buyer-analytics` | AdminBuyerAnalytics | 구매자 분석 (공통 BuyerAnalyticsDashboard) |
| `/admin/ai-chat` | AdminAIChat | AI 챗 (조건부 노출) |
| `/admin/view-sales?userId=xxx` | (SalesLayout) | 특정 영업사 대시보드 대리 조회 |
| `/admin/view-operator?userId=xxx` | (OperatorLayout) | 특정 진행자 대시보드 대리 조회 |
| `/admin/view-brand?userId=xxx` | (BrandLayout) | 특정 브랜드사 대시보드 대리 조회 (자식 `/rankings` 포함) |

> 참고: 과거 문서에 있던 `/admin/margin` (마진 현황) 라우트는 현재 존재하지 않습니다. 마진/정산/견적 관련 일부 기능은 정리되었고, 매출/완료율 등은 각 역할 대시보드 및 브랜드 정산 화면으로 통합되었습니다.

---

## 1. 상단 헤더(AppBar) 구성

### 1.1 "메뉴" 햄버거 드롭다운
좌측 상단 **"메뉴"** 버튼을 누르면 부가 화면들이 드롭다운으로 펼쳐집니다.

- 날짜별 입금관리
- 택배대행 송장관리
- AI 챗 (조건부: 운영은 `masterkangwoo` 계정만, test 도메인은 모든 admin)
- 브랜드 정산
- 올리브영 랭킹
- 리뷰샷 검색
- 구매자 분석
- 이미지 승인
- 휴지통

> **햄버거 배지**: 메뉴 아이콘과 "이미지 승인" 항목에 **재제출 이미지 대기 수(pendingImageCount)** 가 빨간 배지로 표시됩니다. (날짜별 송장/배송 관리, 진행자 배정 등은 컨트롤 타워/시트 흐름에서 접근)

### 1.2 헤더 우측 영역
- **사용자 등록** 버튼 (AdminUserCreate)
- **로그인 페이지 설정** (톱니 아이콘, AdminLoginSettings)
- **알림 아이콘** (NotificationsIcon, 읽지 않은 알림 수 `unreadCount` 배지) + 알림 드롭다운
- **프로필 박스** (ProfileEditDialog) + 로그아웃

> 알림/재제출 대기 카운트는 30초마다 폴링하며, `document.hidden`(비활성 탭) 시 폴링을 멈춥니다.

---

## 2. 컨트롤 타워 (AdminControlTower)

### 2.1 진행자 배정 탭 (기본)
- 연월브랜드 목록 표시 (접기/펼치기 가능)
- 캠페인 → "배정하기" → `/admin/campaigns/:campaignId/assignment` 이동
- 제품명 클릭 → 제품 상세 정보 팝업 (기본 정보, 키워드/구매 정보, 출고 정보, 상품 URL, 리뷰가이드, 비고)
- 연월브랜드/캠페인 삭제 (cascade)

### 2.2 진행자/영업사/브랜드사 사용자 탭
- 각 역할의 사용자 목록 표시 (초기 비밀번호 / 온라인 상태 / 로그인 횟수 포함)
- 사용자 선택 → 우측에 embedded 대시보드(UserDashboardViewer) 미리보기
- "전체 화면 보기" → `view-sales` / `view-operator` / `view-brand` 라우트로 전체 조회

### 2.3 컨트롤 타워 관리 기능
- 비밀번호 초기화 (임시 8자리 발급)
- 사용자 비활성화 / 재활성화 / 삭제 (삭제 시 force/delegateTo로 연관 데이터 위임 또는 cascade)
- 캠페인 영업사 변경
- **영업사 일괄 이전** (transferAllFromSales: 영업사 A → B 전체 권한 이전, 미리보기 지원)
- **브랜드-영업사 매핑** (한 브랜드에 여러 영업사 할당/해제, 브랜드 단위 영업사 이전)

---

## 3. 진행자 배정 (AdminCampaignAssignment)

### 3.1 신규 배정
- 품목별/일차별(day_group) 드롭다운에서 진행자 선택
- "저장" 클릭 시 배정 완료 (`미배정` → `배정 완료`)

### 3.2 진행자 재배정
- 이미 배정된 드롭다운에서 다른 진행자 선택 (`배정 완료` → `변경 중`)
- "저장" 클릭 시 재배정 완료

### 3.3 배정 취소
- 드롭다운에서 "선택 안 함" 선택 (`배정 완료` → `취소 예정`)
- "저장" 클릭 시 배정 취소

### 3.4 상태 칩 표시
| 상태 | 색상 | 설명 |
|-----|-----|-----|
| 배정 완료 | 녹색 | 현재 진행자가 배정됨 |
| 변경 중 | 주황 | 다른 진행자로 변경 대기 |
| 취소 예정 | 빨강 | 배정 취소 대기 |
| 미배정 | 회색 | 아직 배정되지 않음 |

> 같은 진행자를 다른 일차에 중복 배정 가능 (unique 제약: campaign_id, item_id, day_group, operator_id)

---

## 4. 캠페인/품목 관리 (영업사 기능 API 접근)

### 4.1 연월브랜드 / 브랜드 추가
- 연월 + 브랜드 선택으로 연월브랜드 생성 (동일 연월+브랜드 조합 불가)
- 브랜드 추가 시 자동 할당

### 4.2 캠페인 추가
- 캠페인명, 설명(선택), 시작일/종료일(선택), 상태(신규/보류), 브랜드 연결

### 4.3 품목 추가
- 제품명, 미출고/실출고, 희망 유입 키워드
- 총 구매 건수, 일 구매 건수 (슬래시 구분 가능: "6/6" 또는 "2/2/2/...")
- 상품 URL, 구매 옵션, 플랫폼, 상품 가격, 출고 마감 시간
- 리뷰가이드, 소구점, 택배대행 여부, 비고

> Admin은 `viewAsUserId`로 특정 영업사를 대신해 연월브랜드/캠페인/품목을 대리 생성할 수 있습니다.

---

## 5. 구매자 관리 (진행자 기능 API 접근)

### 5.1 구매자 조회 / 추가 / 수정 / 삭제
- 캠페인 → 품목 선택 시 Handsontable 구매자 시트 표시
- 단일/일괄(슬래시 파싱) 추가, 직접 편집 후 Ctrl+S 저장
- 형식: `주문번호/구매자/수취인/아이디/연락처/주소/계좌번호/금액`

### 5.2 업로드 링크 복사
- 품목/슬롯별 업로드 링크 복사 후 구매자에게 전달

---

## 6. 입금 관리

### 6.1 품목별 입금 확인
- 구매자별 입금 완료 스위치 토글 (로컬 상태 업데이트, 스크롤 위치 유지)

### 6.2 날짜별 입금 관리 (메뉴 → 날짜별 입금관리)
- 달력에서 날짜 선택 → 해당 날짜 전체 구매자 입금 확인

---

## 7. 송장 / 배송 관리

### 7.1 날짜별 송장/배송 관리 (AdminTrackingManagement)
- 날짜별 송장번호/택배사/배송지연 상태 일괄 관리
- 송장번호 일괄 입력(등록 순서 매칭) 지원

### 7.2 택배대행 송장관리 (AdminCourierTracking, 메뉴 → 택배대행 송장관리)
- 택배대행(Y) 구매자만 모아 날짜별로 송장 입력 (Handsontable)

---

## 8. 이미지 재제출 승인 (AdminImageApproval, 메뉴 → 이미지 승인)

### 8.1 승인 워크플로우
- 재제출된 이미지는 `status='pending'` 으로 들어옴
- 그룹별로 **기존(approved) vs 신규(pending)** 이미지를 나란히 비교
- 승인(approve) / 거절(reject, 사유 입력) 처리
- 통계/대시보드는 `status='approved'` 만 집계

### 8.2 대기 수 배지
- 햄버거 메뉴 + "이미지 승인" 항목에 대기 수(pendingImageCount) 배지 표시 (30초 폴링)

---

## 9. 리뷰샷 검색 (메뉴 → 리뷰샷 검색)

- 공통 ReviewSearchDashboard 사용 (admin/operator 공유)
- 브랜드사 필수 + 제품명/기간 선택으로 리뷰샷 검색
- 결과 ZIP 다운로드(이미지 프록시) 지원

---

## 10. 구매자 분석 (메뉴 → 구매자 분석)

- 공통 BuyerAnalyticsDashboard 사용 (admin/operator 공유)
- 계좌(account_normalized) 단위로 구매자 통계 집계
- 특정 계좌에 묶인 구매자 상세 목록 조회

---

## 11. 브랜드 정산 (AdminBrandCampaignSettlement, 메뉴 → 브랜드 정산)

- 브랜드사 > 연월브랜드 > 캠페인 3단 정산 요약
- 정산 수식 툴팁 제공

---

## 12. 올리브영 랭킹 (AdminRankingDashboard, 메뉴 → 올리브영 랭킹)

- 올리브영 BEST 랭킹 대시보드 + RankingInsightsTab + RankingHistoryDialog
- 랭킹 수집 트리거, 스파크라인, 순위 변동 분석, 인사이트
- 수집은 백엔드 인-프로세스 워커(스케줄러)가 수행하며, 진행 상태를 폴링으로 표시

---

## 13. AI 챗 (AdminAIChat, 메뉴 → AI 챗)

- 자연어 질의를 SELECT 전용 SQL로 변환해 읽기 전용 DB에서 조회 (text-to-SQL)
- 노출 조건: **운영은 `masterkangwoo` 계정만**, test 도메인은 모든 admin
- 질문 난이도별 모델 선택 UI + 답변 비용 표시

---

## 14. 휴지통 (AdminTrash, 메뉴 → 휴지통)

- 소프트 삭제된 연월브랜드/캠페인/품목 목록 (30일 만료일 표시)
- 복원(하위 cascade 복원) / 영구 삭제 / 휴지통 비우기

---

## 15. 사용자 관리 (헤더 → 사용자 등록)

### 15.1 사용자 등록 (AdminUserCreate)
- 역할 선택: 총관리자 / 영업사 / 진행자 / 브랜드사
- 이름, 사용자명(로그인 ID), 초기 비밀번호 입력
- **브랜드사 등록 시 일련번호(serial, 예: BR0001) 자동 부여** (DB에서 생성)

### 15.2 비밀번호 초기화 / 비활성화 / 삭제
- 컨트롤 타워에서 비밀번호 초기화(임시 8자리), 비활성화/활성화, 삭제 수행

---

## 16. 로그인 페이지 설정 (헤더 → 톱니 아이콘)

- 공지사항 텍스트 설정 (로그인 화면 표시)
- 역할별 배너 제목 / 배너 이미지 설정

---

## 17. 알림 / 프로필

### 17.1 알림 (헤더 알림 아이콘)
- 읽지 않은 알림 수 배지 표시 (unreadCount)
- 알림 클릭 시 해당 품목 → 캠페인 배정 페이지 / 캠페인으로 이동
- "모두 읽음" 처리

### 17.2 프로필
- 프로필 수정(이름/비밀번호 변경), 로그아웃

---

## 18. serial(일련번호) 개념

- 브랜드사 계정은 생성 시 고유 일련번호(serial, BR0001 형식)를 부여받습니다.
- 사용자 등록(AdminUserCreate)과 대시보드 뷰어(UserDashboardViewer)에서 serial을 함께 표시해 동일 이름 브랜드를 구분합니다.

---

## 화면별 이미지 위치

> 아래 항목에 맞춰 캡처 이미지를 추가해주세요.

- [ ] 1.1 "메뉴" 햄버거 드롭다운 (배지 포함)
- [ ] 2.1 컨트롤 타워 - 진행자 배정 탭
- [ ] 2.2 컨트롤 타워 - 사용자 대시보드 미리보기
- [ ] 3.1 진행자 배정 - 드롭다운 선택
- [ ] 3.4 배정 상태 칩 표시
- [ ] 6.2 날짜별 입금 관리
- [ ] 7.2 택배대행 송장관리
- [ ] 8.1 이미지 재제출 승인 (기존 vs 신규 비교)
- [ ] 9 리뷰샷 검색
- [ ] 10 구매자 분석
- [ ] 11 브랜드 정산
- [ ] 12 올리브영 랭킹 대시보드
- [ ] 13 AI 챗
- [ ] 14 휴지통
- [ ] 15.1 사용자 등록 다이얼로그

---

**최종 업데이트**: 2026-06-29
