# 구현 진행 상황

**최종 업데이트**: 2026-01-10
**프로젝트**: CampManager (purchaseWeb)
**배포 URL**: https://your-domain.com

---

## 2026-01-10 업데이트 내역 (Phase 12)

### 1. URL/플랫폼 컬럼 하이퍼링크 버그 수정

**문제:** 시트의 제품 테이블에서 하이퍼링크가 URL 컬럼(col11)이 아닌 플랫폼 컬럼(col12)에 적용됨

**원인:** Handsontable 렌더러에서 `prop === 'col12'`로 잘못 지정

**해결:** `col12` → `col11`로 수정

**수정 파일:**
- `frontend/src/components/sales/SalesItemSheet.js`
- `frontend/src/components/operator/OperatorItemSheet.js`

### 2. Brand 시트 14컬럼 확장

**문제:** 브랜드사 시트가 8컬럼만 표시하여 영업사/진행자 시트와 불일치

**해결:** 14컬럼으로 확장 (Sales/Operator와 동일)

**컬럼 구성:**
- col0: 접기 버튼
- col1: 날짜
- col2: 플랫폼 (신규)
- col3: 제품명
- col4: 옵션
- col5: 출고
- col6: 키워드
- col7: 가격
- col8: 총건수
- col9: 일건수
- col10: 택배대행
- col11: URL
- col12: 빈 컬럼
- col13: 특이사항

**수정 파일:**
- `frontend/src/components/brand/BrandItemSheet.js`

### 3. Brand 페이지 스크롤 수정

**문제:** 페이지 전체 스크롤이 발생하여 시트 스크롤바 접근 불편

**해결:** Sales/Operator와 동일하게 시트만 스크롤되도록 변경

**수정 사항:**
- `height: '100vh'`, `overflow: 'hidden'` 적용

**수정 파일:**
- `frontend/src/components/brand/BrandLayout.js`

### 4. 순번 → 플랫폼 컬럼 변경 (Brand 시트)

**변경:** Brand 시트에서 "순번(display_order)" 컬럼을 "플랫폼(platform)" 컬럼으로 대체

**스타일:** 플랫폼 값에 볼드 + 파란색 적용

```javascript
// col2 - 플랫폼 (볼드, 파란색)
else if (prop === 'col2') {
  td.textContent = value ?? '';
  td.style.fontWeight = 'bold';
  td.style.color = '#1565c0';
}
```

**수정 파일:**
- `frontend/src/components/brand/BrandItemSheet.js`

### 5. 품목 추가 다이얼로그 플랫폼 예시 추가

**변경:** SalesAddItemDialog의 예시 텍스트에 플랫폼 필드 추가

```
플랫폼 : 쿠팡

※ 플랫폼: 쿠팡, 네이버, 11번가, 지마켓, 옥션, 티몬, 위메프 등
```

**수정 파일:**
- `frontend/src/components/sales/SalesAddItemDialog.js`

### 6. Backend API - date, display_order 필드 추가

**변경:** itemSlotController의 Item attributes에 `date`, `display_order` 필드 추가

**수정 파일:**
- `backend/src/controllers/itemSlotController.js`
  - `getSlotsByCampaign` 함수
  - `getSlotsByCampaignForOperator` 함수

---

## 2026-01-09 업데이트 내역 (Phase 11)

### 1. Operator 시트 UI 개선

**변경 사항:**
- 필터링 버튼이 호버 시에만 표시되도록 변경 (엑셀처럼)
- 접기 컬럼 너비 축소: 30px → 20px
- 제품 컬럼 순서 변경:
  - 기존: 날짜, 제품명, 플랫폼, 출고, 옵션, 키워드, 가격, 총건수, 일건수, 택배, URL, 특이사항
  - 변경: 날짜, 순번, 제품명, 옵션, 플랫폼, 출고, 키워드, 가격, 총건수, 일건수, 택배, URL, 특이사항

**CSS 수정:**
```css
'& .handsontable thead th .changeType': {
  opacity: 0,
  transition: 'opacity 0.15s ease-in-out'
},
'& .handsontable thead th:hover .changeType': {
  opacity: 1
}
```

**수정 파일:**
- `frontend/src/components/operator/OperatorItemSheet.js`

### 2. Operator 시트 건수/금액 계산 버그 수정

**문제:** 접기/펼치기 시 전체 건수와 금액 합계가 변경됨

**원인:** `tableData`가 `collapsedItems`에 의존하여 접힌 품목의 구매자 행을 아예 생성하지 않음

**해결:** 건수와 금액 계산을 `tableData` 대신 원본 `slots` 데이터에서 직접 계산

**변경 코드:**
```javascript
// 전체 데이터 건수 (원본 slots 데이터 기준 - 접기/펼치기와 무관)
const totalDataCount = useMemo(() => {
  return slots.length;
}, [slots]);

// 금액 합산 계산 (원본 slots 데이터 기준 - 접기/펼치기와 무관)
const totalAmount = useMemo(() => {
  return slots.reduce((sum, slot) => {
    const buyer = slot.buyer || {};
    const amount = parseInt(String(buyer.amount || 0).replace(/[^0-9]/g, '')) || 0;
    return sum + amount;
  }, 0);
}, [slots]);
```

**수정 파일:**
- `frontend/src/components/operator/OperatorItemSheet.js`

### 3. Brand 퍼센트 계산 수정

**문제:** 캠페인 진행률이 `total_purchase_count` (목표 건수) 기준으로 계산됨

**변경:**
- 기존: `totalPurchaseTarget` (목표 건수) 대비 리뷰 완료
- 변경: `totalBuyerCount` (실제 등록된 구매자 수) 대비 리뷰 완료

**변경 코드:**
```javascript
// 변경 전
let totalPurchaseTarget = 0;
totalPurchaseTarget += item.total_purchase_count || 0;

// 변경 후
let totalBuyerCount = 0;
const realBuyers = buyers.filter(b => !b.is_temporary);
totalBuyerCount += realBuyers.length;
```

**수정 파일:**
- `frontend/src/components/brand/BrandLayout.js`

### 4. Admin 상단바 간소화

**변경:** "전체 제품 조회" 버튼 삭제

**수정 파일:**
- `frontend/src/components/admin/AdminLayout.js`

---

## 2026-01-08 업데이트 내역 (Phase 10)

### 1. 일 구매건수 슬래시 구분 지원

**문제**: 품목 생성 시 `daily_purchase_count` 필드에 "6/6" 같은 슬래시 구분 값을 입력하면 에러 발생
- 에러 메시지: `invalid input syntax for type integer: "6/6"`

**원인**: `daily_purchase_count` 컬럼이 INTEGER 타입으로 정의되어 있어서 문자열 저장 불가

**해결**:
1. 마이그레이션 생성: `20260108000001-change-daily-purchase-count-to-string.js`
2. 컬럼 타입 변경: `INTEGER` → `TEXT` (길이 제한 없음)
3. Item 모델 업데이트

**수정 파일**:
- `backend/migrations/20260108000001-change-daily-purchase-count-to-string.js` (신규)
- `backend/src/models/Item.js`

### 2. 업로드 페이지 주문번호 입력 필드 추가

**기능**: 이미지 업로드 시 계좌번호 외에 주문번호로도 구매자 매칭 가능

**변경 사항**:
- 주문번호 입력 필드 추가
- 검증 로직 변경: 주문번호 또는 계좌번호 **둘 중 하나 필수**
- 구매자 매칭 우선순위: 주문번호 > 계좌번호

**수정 파일**:
- `frontend/src/components/upload/UploadPage.js`
  - `orderNumber` state 추가
  - 주문번호 TextField 추가
  - 검증 로직 변경: 둘 중 하나 필수
- `frontend/src/services/imageService.js`
  - `uploadImages` 함수에 `orderNumber` 파라미터 추가
- `backend/src/controllers/imageController.js`
  - `order_number` 파라미터 처리
  - 구매자 매칭 로직 수정 (주문번호 우선 매칭)
  - 에러 메시지 업데이트

**구매자 매칭 로직**:
```javascript
// 1. 주문번호로 매칭 (우선)
if (orderNumberNormalized && buyer.order_number) {
  if (buyer.order_number.trim() === orderNumberNormalized) return true;
}
// 2. 계좌번호로 매칭 (보조)
if (accountNormalized && buyer.account_normalized === accountNormalized) return true;
```

---

## 2026-01-06 업데이트 내역 (Phase 9)

### 1. 품목별 매출/지출/마진 계산 기능

**기능 요약:**
- 영업사가 품목 등록 시 견적서 내용(판매단가, 택배단가)을 입력하면 매출이 자동 계산
- Admin이 항목별 지출을 입력하면 순 마진이 계산
- 별도 마진 대시보드에서 조회 가능

**DB 마이그레이션:**
- `20260106000001-add-revenue-expense-to-items.js`
  - `sale_price_per_unit` - 판매 단가 (원/개)
  - `courier_price_per_unit` - 택배대행 단가 (원/개)
  - `expense_product` - 지출: 제품비 (원)
  - `expense_courier` - 지출: 택배비 (원)
  - `expense_review` - 지출: 리뷰비용 (원)
  - `expense_other` - 지출: 기타비용 (원)
  - `expense_note` - 지출 메모

**매출 계산 로직:**
```
판매매출 = 판매단가 × 총건수
택배매출 = 택배단가 × 총건수 (택배대행 Y일 때만)
총 매출 (공급가) = 판매매출 + 택배매출
총 매출 (VAT 포함) = 총 매출 × 1.1
```

**마진 계산 로직:**
```
총 지출 = 제품비 + 택배비 + 리뷰비용 + 기타비용
순 마진 = 총 매출(VAT 포함) - 총 지출
마진율 = 순 마진 / 총 매출(VAT 포함) × 100
```

**신규 API:**
| Method | Endpoint | 설명 | 권한 |
|--------|----------|------|------|
| GET | `/api/items/margin-summary` | 마진 대시보드 데이터 | Admin, Sales |
| PUT | `/api/items/:id/expense` | 품목 지출 입력/수정 | Admin only |
| GET | `/api/items/:id/margin` | 단일 품목 마진 조회 | Admin, Sales |

**신규 컴포넌트:**
- `frontend/src/components/admin/AdminMarginDashboard.js` - Admin 마진 대시보드
- `frontend/src/components/admin/AdminItemExpenseDialog.js` - 지출 입력 다이얼로그
- `frontend/src/components/sales/SalesMarginDashboard.js` - 영업사 마진 대시보드 (조회 전용)

**수정 파일:**
- `backend/src/models/Item.js` - 7개 필드 추가
- `backend/src/controllers/itemController.js` - 3개 API 함수 추가
- `backend/src/routes/items.js` - 3개 라우트 추가
- `frontend/src/services/itemService.js` - 3개 서비스 메서드 추가
- `frontend/src/components/sales/SalesAddItemDialog.js` - 판매단가/택배단가 입력 필드 + 예상 매출 미리보기
- `frontend/src/components/admin/AdminLayout.js` - "마진 현황" 메뉴 버튼 추가
- `frontend/src/components/sales/SalesLayout.js` - "마진 현황" 메뉴 버튼 추가
- `frontend/src/App.js` - `/admin/margin`, `/sales/margin` 라우트 추가

**라우트:**
- `/admin/margin` - Admin 마진 대시보드 (지출 입력 가능)
- `/sales/margin` - 영업사 마진 대시보드 (조회 전용)

### 2. 브랜드사 송장번호 컬럼 추가

**기능:** 브랜드사 화면에서도 Admin이 입력한 송장번호 표시

**수정 파일:**
- `frontend/src/components/brand/BrandBuyerTable.js`
  - 테이블 뷰에 송장번호 컬럼 추가
  - 갤러리 뷰 이미지 상세에 송장번호 표시

---

## 2026-01-05 업데이트 내역 (Phase 8)

### 1. Admin 컨트롤 타워 제품 상세 다이얼로그

**기능**: 진행자 배정 탭에서 제품명 클릭 시 상세 정보 팝업

**다이얼로그 내용:**
- 기본 정보: 제품명, 캠페인, 브랜드, 영업사
- 키워드 및 구매 정보: 희망유입 키워드, 구매 옵션, 총/일 구매 건수, 가격, 입금명
- 출고 정보: 미출고, 실출고, 출고 마감 시간, 택배대행
- 상품 URL (외부 링크)
- 리뷰가이드 및 소구점
- 비고

**수정 파일:**
- `frontend/src/components/admin/AdminControlTower.js`
  - state 추가: `itemDetailDialogOpen`, `selectedItem`
  - 핸들러 추가: `handleOpenItemDetail`, `handleCloseItemDetail`
  - 제품명을 클릭 가능한 Link 컴포넌트로 변경
  - Dialog 컴포넌트 추가

### 2. Brand 시트 뷰 403 에러 수정

**문제**: 브랜드사가 캠페인 클릭 시 Handsontable 시트 로드 실패 (403 Forbidden)

**원인**: `/api/item-slots/campaign/:campaignId` 라우트에 `brand` 권한이 없었음

**해결**: 라우트에 `brand` 권한 추가

**수정 파일:**
- `backend/src/routes/itemSlots.js`
  ```javascript
  // 변경 전
  authorize(['sales', 'admin'])
  // 변경 후
  authorize(['sales', 'admin', 'brand'])
  ```

### 3. 미사용 파일 정리

**삭제된 파일들:**
- `frontend/src/components/admin/AdminDashboard.js` - 어디서도 import 안됨
- `frontend/src/components/SharedCampaignTable.js` - 어디서도 import 안됨
- `frontend/src/components/operator/OperatorHome.js` - App.js 라우트에 없음
- `frontend/src/components/sales/SalesDashboard.js` - 어디서도 import 안됨
- `frontend/src/components/brand/BrandDashboard.js` - 어디서도 import 안됨

---

## 2026-01-04 업데이트 내역 (Phase 7)

### 1. 일차별(day_group) 진행자 배정 기능 수정

**문제**: 같은 품목의 다른 일차(1일차, 2일차 등)에 같은 진행자를 배정할 수 없었음
- 에러 메시지: "해당 일차에 이미 같은 진행자가 배정되어 있습니다"

**원인**: DB에 기존 unique constraint `unique_campaign_operator(campaign_id, item_id, operator_id)`가 `day_group`을 포함하지 않아서 같은 진행자가 다른 일차에 배정 불가

**해결**:
1. 새 마이그레이션 생성: `20260103000001-fix-campaign-operator-unique-index.js`
2. 기존 constraint `unique_campaign_operator` 제거
3. 새 constraint `unique_campaign_operator_daygroup(campaign_id, item_id, day_group, operator_id)` 추가
4. `itemController.js`에서 null day_group 비교 로직 개선 (`{ [Op.is]: null }` 사용)

**수정 파일**:
- `backend/migrations/20260103000001-fix-campaign-operator-unique-index.js` (신규)
- `backend/src/controllers/itemController.js` (null 비교 로직 수정)

### 2. 그룹 삭제 시 404 에러 수정

**문제**: 이미 삭제된 그룹을 다시 삭제하려고 하면 404 에러 발생

**해결**: `deleteSlotsByGroup`에서 `deletedCount === 0`일 때 404 대신 200 success 반환

**수정 파일**:
- `backend/src/controllers/itemSlotController.js`
- `frontend/src/components/operator/OperatorItemSheet.js` (에러 메시지 개선)

### 3. 슬래시(/) 파싱 붙여넣기 기능 (계획됨)

**기능**: 진행자가 OperatorItemSheet의 주문번호 컬럼에 슬래시 구분 데이터를 붙여넣으면 자동으로 8개 컬럼에 파싱하여 분배

**구현 예정**:
- Handsontable `beforePaste` 훅 사용
- 주문번호 컬럼(인덱스 7)에서만 작동
- 슬래시로 분리: 주문번호/구매자/수취인/아이디/연락처/주소/계좌번호/금액

---

## 2025-12-31 업데이트 내역 (Phase 6)

### 1. Admin viewAsUserId 완전 지원
- **기능**: Admin이 영업사 대신 브랜드/연월브랜드 생성 시 해당 영업사 소유로 생성
- **수정 사항**:
  - SalesLayout에서 SalesBrandCreateDialog, SalesMonthlyBrandDialog에 viewAsUserId prop 전달
  - 다이얼로그 내부에서 API 호출 시 viewAsUserId 파라미터 포함
- **수정 파일**:
  - `frontend/src/components/sales/SalesLayout.js`

### 2. Handsontable 필터 버튼 UI 개선
- **문제**: 필터 드롭다운 버튼이 헤더 텍스트와 겹쳐서 가독성 저하
- **해결**: 필터 버튼을 헤더 오른쪽 끝에 절대 위치로 배치
- **CSS 수정**:
  ```css
  '& .handsontable thead th .changeType': {
    position: 'absolute',
    right: '2px',
    top: '50%',
    transform: 'translateY(-50%)'
  }
  ```
- **수정 파일**:
  - `frontend/src/components/operator/OperatorItemSheet.js`
  - `frontend/src/components/sales/SalesItemSheet.js`

### 3. Operator 컬럼 너비 조정
- **문제**: 일부 컬럼의 텍스트가 여전히 필터 버튼과 겹침
- **해결**: 해당 컬럼들의 기본 너비 증가
- **변경 사항**:
  - 구매옵션: 80 → 100
  - 희망유입키워드: 100 → 130
  - 예상구매자: 80 → 100
  - 구매자: 70 → 90
  - 리뷰작성: 60 → 80
- **수정 파일**:
  - `frontend/src/components/operator/OperatorItemSheet.js`

### 4. Shift+스크롤 횡스크롤 전용
- **문제**: Shift+휠 스크롤 시 종횡 동시 이동
- **해결**: Shift+휠 시 횡스크롤만 이동하도록 수정
- **구현**:
  - capture phase에서 이벤트 가로채기
  - `e.preventDefault()` + `e.stopPropagation()`으로 기본 동작 차단
  - `wtHolder.scrollLeft`만 변경 (scrollTop 미변경)
- **수정 파일**:
  - `frontend/src/components/operator/OperatorItemSheet.js`
  - `frontend/src/components/sales/SalesItemSheet.js`

### 5. 사용자별 컬럼 너비 localStorage 저장
- **기능**: 사용자가 컬럼 너비를 조정하면 브라우저 localStorage에 저장
- **저장 키**:
  - Operator: `operator_itemsheet_column_widths`
  - Sales: `sales_itemsheet_column_widths`
- **동작**:
  - 페이지 로드 시 저장된 너비 복원
  - 컬럼 리사이즈 시 자동 저장
- **이미 구현됨** (기존 코드에 포함)

---

## 2025-12-29 업데이트 내역

### 1. Sales/Operator 시트 스크롤 개선
- **문제**: 페이지 전체 스크롤이 발생하여 시트 횡스크롤바가 아래로 내려야만 보임
- **해결**: 페이지 스크롤 제거, Handsontable 시트에만 고정 종횡 스크롤 적용
- **수정 사항**:
  - Layout 컴포넌트: `overflow: 'hidden'` + flex 레이아웃
  - ItemSheet 컴포넌트: `height: "100%"` + flex 컨테이너
- **수정 파일**:
  - `frontend/src/components/sales/SalesLayout.js`
  - `frontend/src/components/sales/SalesItemSheet.js`
  - `frontend/src/components/operator/OperatorLayout.js`
  - `frontend/src/components/operator/OperatorItemSheet.js`

### 2. Admin 컨트롤 타워 - 사용자별 대시보드 조회
- **기능**: Admin이 영업사/진행자/브랜드사 대시보드를 그대로 볼 수 있음
- **라우트**:
  - `/admin/view-sales?userId=xxx` - 영업사 대시보드
  - `/admin/view-operator?userId=xxx` - 진행자 대시보드
  - `/admin/view-brand?userId=xxx` - 브랜드사 대시보드
- **viewAsUserId 지원 API**:
  - `GET /api/items/my-monthly-brands?viewAsUserId=xxx`
  - `GET /api/item-slots/operator/campaign/:id?viewAsUserId=xxx`
  - `GET /api/monthly-brands?viewAsUserId=xxx`
- **수정 파일**:
  - `frontend/src/App.js` - AdminViewSales, AdminViewOperator, AdminViewBrand 래퍼
  - `frontend/src/components/sales/SalesLayout.js` - viewAsUserId prop
  - `frontend/src/components/operator/OperatorLayout.js` - viewAsUserId prop
  - `frontend/src/components/brand/BrandLayout.js` - viewAsUserId prop
  - `backend/src/controllers/itemController.js` - viewAsUserId 처리

### 3. ItemSlot 기반 엑셀 시트 시스템
- **개념**: 일 구매건수(daily_purchase_count)별로 그룹화된 슬롯
- **테이블**: `item_slots` - 구매자 정보를 슬롯 단위로 관리
- **기능**:
  - 슬롯 자동 생성 (품목 생성 시)
  - 그룹별 업로드 링크 토큰
  - 인라인 편집 및 저장
  - 행/그룹 삭제
- **수정 파일**:
  - `frontend/src/components/sales/SalesItemSheet.js`
  - `frontend/src/components/operator/OperatorItemSheet.js`
  - `backend/src/models/ItemSlot.js`
  - `backend/src/controllers/itemSlotController.js`

### 4. 연월브랜드(MonthlyBrand) 시스템
- **개념**: 영업사/진행자가 월별로 브랜드를 그룹핑
- **테이블**: `monthly_brands` - YYMM 형식의 연월 + 브랜드명
- **사이드바**: 연월브랜드 목록, 선택 시 해당 캠페인 필터링
- **수정 파일**:
  - `backend/src/models/MonthlyBrand.js`
  - `backend/src/controllers/monthlyBrandController.js`
  - `frontend/src/components/sales/SalesLayout.js`
  - `frontend/src/components/operator/OperatorLayout.js`

---

## 2025-12-13 업데이트 내역 (Phase 3)

### 1. 알림 시스템
- **Admin/Brand 헤더**: 알림 아이콘 + Badge로 읽지 않은 알림 수 표시
- **30초 폴링**: 실시간 알림 갱신
- **브랜드-영업사 연결**: 선 업로드 시 브랜드사에게 알림 전송
- **"모두 읽음" 개선**: 클릭 시 UI에서 읽은 알림 숨김 (`is_read=false`만 표시)
- **수정 파일**:
  - `frontend/src/components/admin/AdminLayout.js`
  - `frontend/src/components/brand/BrandLayout.js`

### 2. 캠페인 관련 개선
- **캠페인명 형식 변경**: `yymmdd_브랜드명` (예: 251213_삼성)
  - 기존: `브랜드명_YYYY-MM-DD`
  - 변경: `dateStr.replace(/-/g, '').slice(2) + '_' + brandName`
- **캠페인 정렬**: DESC → ASC (등록일 오름차순)
- **수정 파일**:
  - `frontend/src/components/sales/SalesAddCampaignDialog.js`
  - `backend/src/controllers/campaignController.js`

### 3. 품목 추가 개선
- **출고마감시간 기본값**: `'18:00'` → `''` (빈 값/null)
- **수정 파일**: `frontend/src/components/sales/SalesAddItemDialog.js`

### 4. Sales 검색창 Enter 키
- **기능**: Enter 키 입력 시 검색 실행
- **수정 파일**: `frontend/src/components/sales/SalesCampaignTable.js`
- **수정 코드**:
  ```javascript
  onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
  ```

### 5. 입금명 수정 권한 확대
- **기존**: Admin, Operator만 가능
- **변경**: Admin, Operator, **Sales** 가능
- **Backend 수정**: `backend/src/routes/items.js`
  ```javascript
  authorize(['operator', 'admin', 'sales'])
  ```
- **Frontend 수정**: `frontend/src/components/sales/SalesItemTable.js`
  - 입금명 컬럼 추가
  - 인라인 편집 UI (TextField + Check/Cancel 버튼)

### 6. 입력 칸 박스 UI
- **문제**: 편집 가능한 셀이 빈칸으로 보여서 입력 가능한지 인식 어려움
- **해결**: 테두리 + 배경색으로 입력 가능 영역 표시
- **스타일**:
  ```javascript
  sx={{
    cursor: 'pointer',
    border: '1px solid #e0e0e0',
    bgcolor: '#fafafa',
    '&:hover': { bgcolor: '#f0f0f0', borderColor: '#bdbdbd' },
    p: 0.5,
    borderRadius: 1,
    minHeight: 28,
    minWidth: 80
  }}
  ```
- **수정 파일**:
  - `frontend/src/components/admin/AdminBuyerTable.js` (송장번호)
  - `frontend/src/components/admin/AdminItemTable.js` (입금명)
  - `frontend/src/components/operator/OperatorItemTable.js` (입금명)
  - `frontend/src/components/sales/SalesItemDetail.js` (송장번호)
  - `frontend/src/components/sales/SalesItemTable.js` (입금명)

### 7. Operator 품목명 UI 개선
- **문제**: 품목명 앞 파일 아이콘으로 인한 줄 끊김
- **해결**: `InsertDriveFileIcon` 제거
- **수정 파일**: `frontend/src/components/operator/OperatorItemTable.js`

---

## 2025-12-11 업데이트 내역

### 1. Operator 선 업로드 알림 기능
- **헤더 알림 아이콘**: 선 업로드가 있는 품목 수 Badge로 표시
- **드롭다운 메뉴**: 선 업로드가 있는 품목 목록 표시
- **빠른 이동**: 메뉴 클릭 시 해당 품목의 리뷰 관리 페이지로 이동
- **자동 갱신**: 30초마다 선 업로드 현황 자동 업데이트
- **신규 API**: `GET /api/items/my-preuploads` (진행자 전용)
- **수정 파일**:
  - `frontend/src/components/operator/OperatorLayout.js`
  - `frontend/src/services/itemService.js`
  - `backend/src/controllers/itemController.js`
  - `backend/src/routes/items.js`

### 2. Admin 캠페인 테이블 개선
- **컬럼 순서 변경**: 등록일 → 브랜드 → 캠페인명 → 영업사 → 상태 → 관리
- **디폴트 정렬**: 등록일 → 브랜드 → 영업사 순서로 오름차순
- **헤더 클릭 정렬**: 관리 컬럼 제외한 모든 컬럼에 정렬 기능 추가
  - 클릭 시: asc → desc → 기본 정렬 순환
  - 정렬 방향 화살표 표시
- **수정 파일**: `frontend/src/components/admin/AdminCampaignTable.js`

### 3. Operator 품목 페이지 검색/필터 기능
- **품목명 검색**: 실시간 검색 (입력 즉시 필터링)
- **상태 필터**: 전체/진행 중/완료/취소 선택 가능
- **결과 카운트**: "총 N개 중 M개 표시" 형태로 표시
- **빈 결과 메시지**: 검색 조건에 맞는 품목이 없을 때 별도 메시지
- **수정 파일**: `frontend/src/components/operator/OperatorItemTable.js`

---

## 2025-12-10 (2차) 업데이트 내역

### 1. 이미지-구매자 1:1 매칭 시스템
- **로직 변경**: 계좌번호 기반으로 이미지와 구매자 1:1 매칭
- **매칭 방식**:
  - 같은 계좌번호의 구매자 중 이미지가 없는 구매자 우선 매칭
  - 예: 5명 구매자 + 6개 이미지 → 5개 매칭, 1개는 선 업로드
- **수정 파일**: `backend/src/controllers/imageController.js`

### 2. 선 업로드(Pre-upload) 시스템 개선
- **임시 Buyer 생성**: 매칭할 구매자가 없으면 `is_temporary: true`인 Buyer 자동 생성
- **선 업로드 표시**: 노란색 배경 + "선 업로드" 칩
- **브랜드사 숨김**: `buyers.filter(b => !b.is_temporary)`로 정상 구매자만 표시
- **수정 파일**:
  - `frontend/src/components/admin/AdminBuyerTable.js`
  - `frontend/src/components/operator/OperatorBuyerTable.js`
  - `frontend/src/components/brand/BrandBuyerTable.js`

### 3. 파일 업로드 제한 강화
- **이미지당 최대 10MB**
- **프론트엔드 검증**: 파일 선택 시 크기 체크, 초과 시 파일별 에러 메시지
- **백엔드 제한**: multer `fileSize: 10MB`, express `body-parser: 20MB`
- **수정 파일**:
  - `backend/src/app.js` (body-parser limit 증가)
  - `backend/src/controllers/imageController.js` (multer limit)
  - `frontend/src/components/upload/UploadPage.js` (프론트엔드 검증)

### 4. 진행자 배정 UI 대폭 개선
- **드롭다운 항상 표시**: 배정된 진행자도 드롭다운에서 선택된 상태로 표시
- **"현재 배정" 칩**: 드롭다운 메뉴에서 현재 배정된 진행자에 칩 표시
- **배정 취소 기능**: "선택 안 함" 선택 시 배정 취소
- **상태별 칩**:
  - `배정 완료` (초록) - 현재 배정됨
  - `변경 중` (주황) - 다른 진행자로 변경 대기
  - `취소 예정` (빨강) - 배정 취소 대기
  - `미배정` (회색) - 아직 배정 안 됨
- **저장 로직**: 신규(POST), 재배정(PUT), 취소(DELETE) 모두 처리
- **수정 파일**: `frontend/src/components/admin/AdminItemTable.js`

### 5. Backend API 수정
- **`getItemsByCampaign`**: `operatorAssignments` include 추가
- **목적**: 품목 목록에서 배정된 진행자 정보 표시
- **수정 파일**: `backend/src/controllers/itemController.js`

---

## 2025-12-10 (1차) 업데이트 내역

### 1. 로그인 리다이렉트 수정
- **문제**: 캠페인/품목 페이지에서 로그아웃 후 재로그인하면 해당 페이지로 돌아감
- **해결**: 로그인 시 항상 역할별 기본 페이지(`/admin`, `/sales` 등)로 리다이렉트
- **수정 파일**: `frontend/src/components/Login.js`

### 2. Admin 기능 확장 (Sales/Operator 기능 통합)
- **AdminCampaignTable.js**: 캠페인 추가 버튼 + `SalesAddCampaignDialog` 재사용
- **AdminItemTable.js**: 품목 추가 버튼 + `SalesAddItemDialog` 재사용
- **AdminBuyerTable.js**:
  - 구매자 추가 버튼 + `OperatorAddBuyerDialog` 재사용
  - 구매자 수정/삭제 버튼 (관리 컬럼 추가)
  - 업로드 링크 복사 버튼

### 3. 입금 완료 토글 개선
- **문제**: 입금 완료 버튼 클릭 시 전체 목록 새로고침 → 스크롤 위치 초기화
- **해결**: `loadBuyers()` 대신 `setBuyers()` 로컬 상태 업데이트
- **결과**: 스크롤 위치 유지, 해당 행만 업데이트
- **수정 파일**: `frontend/src/components/admin/AdminBuyerTable.js`

---

## 2025-12-09 업데이트 내역

### 1. 역할별 페이지 격리
- Admin도 다른 역할 페이지 접근 불가하도록 변경
- `/sales`, `/operator`, `/brand` 라우트에서 `admin` 역할 제거
- 각 역할은 자신의 대시보드만 접근 가능

### 2. Admin 입금관리 기능 개선
- 기존: 헤더에 별도 "입금관리" 버튼
- 변경: 품목 테이블에 "입금관리" 컬럼 추가 (배정 완료 품목만 버튼 표시)
- 드릴다운: Admin 대시보드 → 품목 입금관리 → 구매자별 입금 토글

### 3. 진행자 재배정 기능
- 배정 완료된 품목에서 "변경" 버튼 클릭 → 경고 다이얼로그 → 새 진행자 선택
- 신규 배정: `POST /api/items/:id/operator`
- 재배정: `PUT /api/items/:id/operator` (기존 배정 삭제 후 새로 생성)
- 최종 저장 시 재배정 건수 별도 안내

### 4. BrandBuyerTable API 연동
- 더미 데이터 제거
- 실제 `buyerService.getBuyersByItem(itemId)` API 호출
- 브랜드사는 조회만 가능 (수정/삭제 버튼 없음)

### 5. CSP (Content Security Policy) 수정
- helmet 설정에 S3 도메인 추가
- `imgSrc`: `https://your-bucket-name.s3.ap-northeast-2.amazonaws.com` 허용

### 6. BrandItemTable API 연동
- 더미 데이터 제거
- 실제 `itemService.getItemsByCampaign(campaignId)` API 호출
- `campaignService.getCampaign(campaignId)`로 캠페인 정보 조회

### 7. 브랜드사 구매자 컬럼 제한
- BrandBuyerTable에서 5개 컬럼만 표시
- 표시 컬럼: 주문번호, 구매자, 수취인, 아이디, 리뷰샷
- 제외 컬럼: 연락처, 주소, 계좌정보, 금액, 입금확인

### 8. buyerController 버그 수정
- `Campaign` 모델 import 누락 수정
- `getBuyer` 함수에서 Campaign 포함 조회 정상 동작

---

## 2025-12-08 업데이트 내역

### 이미지 업로드 링크 기능 구현 (S3 연동)

#### 백엔드 API
| Method | Endpoint | 설명 | 권한 |
|--------|----------|------|------|
| GET | `/api/items/token/:token` | 토큰으로 품목 조회 | Public |
| POST | `/api/images/upload/:token` | 이미지 업로드 (S3) | Public |
| GET | `/api/images/item/:itemId` | 품목 이미지 목록 | Private |
| DELETE | `/api/images/:id` | 이미지 삭제 | Private |

#### 신규 파일
- `backend/src/config/s3.js` - S3 클라이언트 설정
- `backend/src/controllers/imageController.js` - 이미지 업로드/조회/삭제 API
- `frontend/src/components/upload/UploadPage.js` - 이미지 업로드 페이지 (Public)
- `frontend/src/services/imageService.js` - 이미지 API 서비스

#### 기능 설명
- **업로드 페이지** (`/upload/:token`): 로그인 불필요, 캠페인명/품목명 표시, 주문번호 입력, 이미지 선택/붙여넣기(Ctrl+V)
- **이미지 저장**: AWS S3 (`your-bucket-name` 버킷) → DB에 URL 저장
- **이미지-구매자 연결**: 주문번호로 buyer_id 자동 매칭

---

## 2025-12-08 (Session 4) 업데이트 내역

### Sales 품목/캠페인 CRUD 기능 구현

#### 품목 생성 버그 수정
| 프론트엔드 (기존) | 백엔드 (필요) |
|------------------|---------------|
| `name` | `product_name` |
| `target_keyword` | `keyword` |
| `delivery_service` | `courier_service_yn` |

#### 품목 다이얼로그 개선
- create/edit 모드 지원
- Box + flex 레이아웃

#### 품목 상세보기 페이지
- **신규 파일**: `SalesItemDetail.js`
- **라우트**: `/sales/campaign/:campaignId/item/:itemId`

---

## 완료된 작업

### 1. 데이터베이스 설계
- [x] PostgreSQL 스키마 설계 완료
- [x] 6개 테이블: users, campaigns, items, campaign_operators, buyers, images

### 2. 백엔드 구현
- [x] Node.js + Express 기반 RESTful API
- [x] Sequelize ORM
- [x] JWT 인증 미들웨어
- [x] 역할 기반 권한 체크
- [x] AWS S3 연동

### 3. 프론트엔드 구현
- [x] React 19 + Material-UI 7
- [x] 역할별 대시보드 (Admin, Sales, Operator, Brand)
- [x] JWT 토큰 관리 (AuthContext)
- [x] 역할 기반 라우트 보호

### 4. 배포
- [x] Docker 컨테이너 배포
- [x] Nginx 리버스 프록시 + SSL (Let's Encrypt)
- [x] AWS EC2 + RDS + S3

---

## 파일 구조

```
purchaseweb/
├── backend/
│   ├── src/
│   │   ├── models/           # 6개 모델
│   │   ├── routes/
│   │   │   ├── auth.js       # 로그인/로그아웃/프로필수정
│   │   │   ├── users.js      # 사용자 CRUD (Admin)
│   │   │   ├── campaigns.js  # 캠페인 CRUD
│   │   │   ├── items.js      # 품목 CRUD + 진행자 배정/재배정
│   │   │   ├── buyers.js     # 구매자 CRUD + 입금확인
│   │   │   └── images.js     # 이미지 업로드
│   │   ├── controllers/
│   │   ├── middleware/       # JWT, 권한 체크
│   │   ├── config/           # DB, S3 설정
│   │   └── app.js
│   ├── migrations/
│   └── seeders/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── admin/
│   │   │   │   ├── AdminControlTower.js  # 컨트롤 타워 (진행자 배정 + 사용자 대시보드)
│   │   │   │   ├── AdminBuyerTable.js    # 입금확인 토글
│   │   │   │   ├── AdminUserCreate.js    # 사용자 등록
│   │   │   │   └── ...
│   │   │   ├── sales/
│   │   │   │   ├── SalesCampaignTable.js
│   │   │   │   ├── SalesItemTable.js
│   │   │   │   ├── SalesItemDetail.js
│   │   │   │   └── ...
│   │   │   ├── operator/
│   │   │   │   ├── OperatorBuyerTable.js # 구매자 CRUD
│   │   │   │   └── ...
│   │   │   ├── brand/
│   │   │   │   ├── BrandBuyerTable.js    # 조회 전용
│   │   │   │   └── ...
│   │   │   ├── upload/
│   │   │   │   └── UploadPage.js         # 이미지 업로드 (Public)
│   │   │   └── common/
│   │   │       └── ProfileEditDialog.js
│   │   ├── services/
│   │   │   ├── api.js
│   │   │   ├── authService.js
│   │   │   ├── campaignService.js
│   │   │   ├── itemService.js
│   │   │   ├── buyerService.js
│   │   │   ├── imageService.js
│   │   │   └── userService.js
│   │   ├── context/
│   │   │   └── AuthContext.js
│   │   └── App.js
│   └── package.json
│
├── deploy/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── deploy.sh
│
└── docs/
    ├── CLAUDE.md
    ├── DATABASE_SCHEMA.md
    ├── BACKEND_STRUCTURE.md
    ├── DEPLOYMENT_GUIDE.md
    ├── LOCAL_TESTING.md
    └── IMPLEMENTATION_PROGRESS.md (이 파일)
```

---

## 기술 스택

### 백엔드
- Node.js + Express.js
- PostgreSQL (AWS RDS)
- Sequelize ORM
- JWT 인증
- bcrypt (비밀번호 해싱)
- AWS SDK v3 (S3 업로드)
- multer (파일 업로드)
- helmet (보안 헤더)

### 프론트엔드
- React 19.2.0
- Material-UI 7.3.5
- React Router 7.9.6
- Axios

### 인프라
- AWS EC2 (서버 호스팅)
- AWS RDS (PostgreSQL)
- AWS S3 (이미지 저장)
- Docker + Docker Compose
- Nginx + Let's Encrypt SSL

---

## 환경 설정

### RDS 연결 정보
- Host: `your-rds-endpoint.region.rds.amazonaws.com`
- Port: `5432`
- Database: `your_database_name`
- User: `your_db_username`

### S3 설정
- Bucket: `your-bucket-name`
- Region: `ap-northeast-2` (서울)

### 로컬 개발
- 프론트엔드: `http://localhost:3000`
- 백엔드 API: `http://localhost:5000`

---

## 배포 방법

### 로컬에서 (Windows)
```bash
cd /path/to/your/project
make deploy
```

### EC2에서
```bash
docker compose pull
docker compose up -d --force-recreate

# (필요시) 마이그레이션
docker compose exec app sh -c "cd /app/backend && npx sequelize-cli db:migrate"
```

---

## 참고 문서

- [CLAUDE.md](CLAUDE.md) - 프로젝트 전체 가이드
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - 데이터베이스 스키마 상세
- [BACKEND_STRUCTURE.md](BACKEND_STRUCTURE.md) - 백엔드 구조 및 API 설계
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - EC2 배포 가이드
- [LOCAL_TESTING.md](LOCAL_TESTING.md) - 로컬 테스트 가이드
