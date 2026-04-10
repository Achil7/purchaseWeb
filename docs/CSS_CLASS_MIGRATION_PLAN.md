# 시트 렌더러 CSS 클래스 기반 전환 계획서

## 1. 개요

### 1.1 목적
Handsontable 셀 렌더러의 인라인 스타일(`td.style.xxx = ...`)을 CSS 클래스 기반으로 전환하여 스크롤 성능을 근본적으로 개선한다.

### 1.2 배경
- 현재 각 셀 렌더러에서 `td.style.backgroundColor`, `td.style.fontSize`, `td.style.color`, `td.style.fontWeight` 등을 **매 렌더링마다** 개별 설정
- 스크롤 시 뷰포트에 들어오는 셀마다 5~8개 인라인 스타일을 JS로 조작 → 레이아웃 스래싱(layout thrashing) 발생
- 셀 재사용 시 이전 행의 잔여 인라인 스타일이 남아 스크롤 흔들림 유발
- 현재 `td.style.cssText = ''` 초기화로 임시 대응 중

### 1.3 기대 효과
- 셀당 스타일 설정 횟수: **5~8회 → 1회** (className 할당)
- 브라우저가 CSS 클래스별 스타일을 **캐싱** → 재계산 최소화
- 클래스 교체 시 이전 스타일 **자동 제거** → `cssText = ''` 불필요
- 스크롤 흔들림 근본 해결

### 1.4 제약 조건
- **UI 변경 절대 불가** — 화면에 보이는 모든 색상, 크기, 정렬이 100% 동일해야 함
- **기능 변경 절대 불가** — 편집, 저장, 접기/펼치기, 필터, 클릭 이벤트 등 모두 유지
- **innerHTML 사용 부분**은 유지 (접기 토글, 리뷰샷 링크, 상태 칩 등은 HTML 구조 필요)
- **columnAlignmentsRef 동적 정렬**은 인라인 스타일 유지 (사용자가 컨텍스트 메뉴로 변경하는 동적 값)

---

## 2. 대상 파일

| 파일 | 렌더러 수 | 인라인 스타일 수 | 비고 |
|------|----------|---------------|------|
| `OperatorItemSheet.js` | 6개 | ~45개 | 편집 가능, 가장 복잡 |
| `SalesItemSheet.js` | 6개 | ~45개 | Operator와 거의 동일 구조 |
| `BrandItemSheet.js` | 5개 | ~30개 | 읽기 전용, 업로드 링크 바 없음 |

**DailyWorkSheet.js, UnifiedItemSheet.js**도 유사 구조이나, 우선 3개 시트에서 검증 후 확장.

---

## 3. 현재 상태 — 렌더러별 인라인 스타일 전수 목록

### 3.1 OperatorItemSheet.js

#### itemSeparatorRenderer (라인 68)
| 속성 | 값 | CSS 클래스로 이동 |
|------|---|:---:|
| `td.className = 'item-separator-row'` | - | 기존 유지 |
| `td.style.backgroundColor = '#1565c0'` | 파란색 | ✅ |
| `td.style.height = '8px'` | 구분선 높이 | ✅ |
| `td.style.padding = '0'` | 패딩 제거 | ✅ |

**현재 sx에 이미 정의됨**: `'& .item-separator-row': { backgroundColor: '#1565c0 !important', height: '8px !important', padding: '0 !important' }`
→ **인라인 스타일만 제거하면 됨** (CSS 클래스가 이미 동일한 스타일 포함)

#### productHeaderRenderer (라인 77)
| 속성 | 값 | CSS 클래스로 이동 |
|------|---|:---:|
| `td.className = 'product-header-row'` | - | 기존 유지 |
| `td.style.backgroundColor = '#e0e0e0'` | 회색 | ✅ |
| `td.style.fontWeight = 'bold'` | 굵게 | ✅ |
| `td.style.textAlign = 'center'` | 가운데 | ✅ |
| `td.style.fontSize = '11px'` | 크기 | ✅ |

**현재 sx에 이미 정의됨**: `'& .product-header-row': { backgroundColor: '#e0e0e0 !important', fontWeight: 'bold !important', textAlign: 'center' }`
→ **fontSize만 sx에 추가 필요**, 나머지는 인라인 제거만

#### createBuyerHeaderRenderer (라인 87)
| 속성 | 조건 | 값 |
|------|------|---|
| `td.className = 'buyer-header-row'` | 항상 | - |
| `td.style.fontWeight = 'bold'` | 항상 | ✅ sx에 이미 있음 |
| `td.style.textAlign = 'center'` | 항상 | ✅ sx에 이미 있음 |
| `td.style.fontSize = '11px'` | 항상 | ❌ sx에 없음 → 추가 필요 |
| `td.style.backgroundColor = '#ef9a9a'` | isSuspended | 새 클래스 필요 |
| `td.style.color = '#b71c1c'` | isSuspended | 새 클래스 필요 |
| `td.style.backgroundColor = '#f5f5f5'` | !isSuspended | ✅ sx에 이미 있음 |
| `td.style.color = ''` | !isSuspended | 기본값 |

**필요한 새 클래스**: `.buyer-header-row.suspended { background-color: #ef9a9a; color: #b71c1c; }`

#### createProductDataRenderer (라인 112)
| 속성 | 조건 | 값 | 처리 |
|------|------|---|------|
| `td.className = 'product-data-row'` | 항상 | - | 유지 |
| `td.style.cssText = ''` | 항상 | 초기화 | **제거** (클래스 전환으로 불필요) |
| `td.style.backgroundColor` | isSuspended | `#ffcdd2` / `#fff8e1` | 새 클래스 |
| `td.style.fontSize = '11px'` | 항상 | 11px | sx 추가 |
| `td.style.color = '#b71c1c'` | isSuspended | 빨간색 | suspended 클래스 |
| `td.style.textAlign = 'center'` | col0 | - | col0 클래스 |
| `td.style.cursor = 'pointer'` | col0 | - | col0 클래스 |
| `td.style.fontWeight = 'bold'` | col2,3,7 | - | 각 컬럼 클래스 |
| `td.style.color = '#1565c0'` | col2 | 파란색 | col-platform 클래스 |
| `td.style.color = '#1b5e20'` | col3 | 초록색 | col-product-name 클래스 |
| `td.style.color = '#c2185b'` | col7 | 분홍색 | col-price 클래스 |
| `td.style.whiteSpace = 'nowrap'` | col12 | - | col-url 클래스 |
| `td.style.overflow = 'hidden'` | col12 | - | col-url 클래스 |
| `td.style.textOverflow = 'ellipsis'` | col12 | - | col-url 클래스 |

**처리 방식 (렌더러 코드)**:
```javascript
// 변경 전
td.className = 'product-data-row';
td.style.cssText = '';
td.style.backgroundColor = isSuspended ? '#ffcdd2' : '#fff8e1';
td.style.fontSize = '11px';
if (isSuspended) td.style.color = '#b71c1c';
// ... col별 분기에서 각각 td.style.xxx 설정

// 변경 후
td.className = `product-data-row${isSuspended ? ' suspended' : ''}`;
// col별 분기에서:
if (prop === 'col2') {
  td.textContent = value ?? '';
  if (!isSuspended) td.className += ' col-platform';
} else if (prop === 'col3') {
  td.textContent = value ?? '';
  if (!isSuspended) td.className += ' col-product-name';
}
// ...
```

#### createUploadLinkBarRenderer (라인 187)
| 속성 | 조건 | 값 | 처리 |
|------|------|---|------|
| `td.className = 'upload-link-bar'` | 항상 | - | 유지 |
| `td.style.cssText = ''` | 항상 | 초기화 | **제거** |
| `td.style.backgroundColor` | isSuspended | `#d32f2f` / `#424242` | suspended 클래스 |
| `td.style.color = 'white'` | 항상 | - | ✅ sx에 이미 있음 |
| `td.style.cursor = 'pointer'` | 항상 | - | ✅ sx에 이미 있음 |
| `td.style.fontSize = '11px'` | 항상 | - | sx 추가 |
| `td.style.paddingLeft = '8px'` | col1 | - | 새 클래스 또는 인라인 유지 |

#### createBuyerDataRenderer (라인 211)
| 속성 | 조건 | 값 | 처리 |
|------|------|---|------|
| `td.className` | dayGroup | `day-even` / `day-odd` | 유지 |
| `td.style.cssText = ''` | 항상 | 초기화 | **제거** |
| `td.style.fontSize = '11px'` | 항상 | - | sx 추가 |
| `td.style.setProperty('background-color', '#ffcdd2', 'important')` | isSuspended | - | suspended 클래스 |
| `td.style.setProperty('color', '#b71c1c', 'important')` | isSuspended | - | suspended 클래스 |
| `td.style.textAlign = 'center'` | col0,1 | - | col 클래스 |
| `td.style.color = '#666'` | col2 | 회색 | col 클래스 |
| `td.style.color = '#555'` | col3,4 | 회색 | col 클래스 |
| `td.style.color = '#388e3c'` | col20 (입금완료) | 초록 | col-payment-done 클래스 |
| `td.style.fontWeight = 'bold'` | col20 (입금완료) | - | col-payment-done 클래스 |

**인라인 유지 항목** (동적 값이라 클래스 불가):
- `columnAlignmentsRef.current[c]` 기반 `td.style.textAlign` — 사용자 커스텀 정렬
- `td.innerHTML` 내 인라인 스타일 — 접기 토글, 리뷰샷 링크, 상태 칩의 동적 색상/텍스트

---

### 3.2 SalesItemSheet.js

OperatorItemSheet과 동일한 구조. 차이점만 기록:

| 차이점 | Operator | Sales |
|--------|----------|-------|
| day-even 색상 | `#e0f2f1` (청록) | `#e3f2fd` (파랑) |
| 입금여부 컬럼 | col20 | col19 |
| 입금여부 표시 | `YYMMDD 입금완료` | `YYMMDD` |

→ CSS 클래스는 각 시트의 sx prop에서 별도 정의 (이미 그렇게 되어 있음)

### 3.3 BrandItemSheet.js

| 차이점 | Operator/Sales | Brand |
|--------|---------------|-------|
| 구매자 행 클래스 | `day-even`/`day-odd` | `has-review`/`no-review` |
| 업로드 링크 바 | 있음 | 없음 |
| 편집 가능 | 예 | 아니오 (읽기 전용) |
| 중복 주문번호 | 있음 | 없음 |

---

## 4. 필요한 CSS 클래스 정의

### 4.1 공통 클래스 (3개 시트 모두)

```css
/* 기본 폰트 크기 - 모든 데이터 셀 */
.product-data-row { font-size: 11px; }
.buyer-header-row { font-size: 11px; }
/* day-even, day-odd, has-review, no-review에도 font-size 추가 */

/* 중단(suspended) 상태 */
.product-data-row.suspended { background-color: #ffcdd2 !important; color: #b71c1c !important; }
.upload-link-bar.suspended { background-color: #d32f2f !important; }
.buyer-header-row.suspended { background-color: #ef9a9a !important; color: #b71c1c !important; }
.day-even.suspended, .day-odd.suspended,
.has-review.suspended, .no-review.suspended {
  background-color: #ffcdd2 !important;
  color: #b71c1c !important;
}

/* 제품 데이터 행 — 컬럼별 색상 */
.product-data-row .col-toggle { text-align: center; cursor: pointer; }
.col-platform { font-weight: bold; color: #1565c0; }
.col-product-name { font-weight: bold; color: #1b5e20; }
.col-price { font-weight: bold; color: #c2185b; }
.col-url { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* 구매자 데이터 행 — 컬럼별 색상 */
.col-center { text-align: center; }
.col-gray { color: #666; }
.col-dark-gray { color: #555; }
.col-buyer-bold { font-weight: bold; color: #1565c0; }
.col-payment-done { text-align: center; color: #388e3c; font-weight: bold; }
.col-tracking { color: #1565c0; }
```

### 4.2 클래스 적용 방식

렌더러에서 조건별로 className을 **조합**:

```javascript
// 변경 전 (인라인 스타일)
td.className = 'product-data-row';
td.style.cssText = '';
td.style.backgroundColor = isSuspended ? '#ffcdd2' : '#fff8e1';
td.style.fontSize = '11px';
if (isSuspended) td.style.color = '#b71c1c';

if (prop === 'col2') {
  td.textContent = value ?? '';
  td.style.fontWeight = 'bold';
  if (!isSuspended) td.style.color = '#1565c0';
}

// 변경 후 (CSS 클래스)
td.className = isSuspended ? 'product-data-row suspended' : 'product-data-row';

if (prop === 'col2') {
  td.textContent = value ?? '';
  if (!isSuspended) td.className += ' col-platform';
}
```

---

## 5. 변환 규칙

### 5.1 변환 대상 (인라인 → CSS 클래스)
| 패턴 | 변환 |
|------|------|
| `td.style.backgroundColor = '상수'` | CSS 클래스 |
| `td.style.fontSize = '11px'` | CSS 클래스 |
| `td.style.fontWeight = 'bold'` | CSS 클래스 |
| `td.style.color = '상수'` | CSS 클래스 |
| `td.style.textAlign = 'center'` | CSS 클래스 (고정 값) |
| `td.style.cursor = 'pointer'` | CSS 클래스 |
| `td.style.whiteSpace/overflow/textOverflow` | CSS 클래스 |
| `td.style.height/padding` | CSS 클래스 |
| `td.style.cssText = ''` | **제거** (불필요) |
| `td.style.setProperty('...', '...', 'important')` | CSS 클래스 + `!important` |

### 5.2 변환 제외 (인라인 유지)
| 패턴 | 이유 |
|------|------|
| `td.style.textAlign = columnAlignmentsRef.current[c]` | **동적 값** (사용자 커스텀 정렬) |
| `td.style.paddingLeft = '8px'` (업로드 링크 col1) | 단일 컬럼, 클래스 불필요 |
| `td.innerHTML` 내부의 인라인 스타일 | HTML 문자열 내 스타일, 클래스 변환 복잡 |
| `td.setAttribute('data-token', ...)` | 데이터 속성, 스타일 아님 |
| `td.title = value` | 속성, 스타일 아님 |

---

## 6. 구현 순서

### Phase 1: CSS 클래스 정의 추가 (sx prop 확장)
각 시트 컴포넌트의 `<Paper sx={{ ... }}>` 에 새 CSS 클래스 추가.
기존 sx 정의와 중복되지 않도록 확인.

**작업**:
1. 기존 sx에 fontSize, 추가 상태 클래스 보강
2. 컬럼별 색상 클래스 추가
3. suspended 상태 클래스 추가

### Phase 2: 렌더러 변환 — 단순 렌더러 먼저
`itemSeparatorRenderer`, `productHeaderRenderer`는 조건 분기가 없어 안전.

**작업**:
1. 인라인 스타일 제거
2. sx에 이미 정의된 CSS가 동일하게 적용되는지 확인

### Phase 3: 렌더러 변환 — 조건 분기 렌더러
`createProductDataRenderer`, `createBuyerDataRenderer` 등 조건 분기가 있는 렌더러.

**작업**:
1. isSuspended 분기 → `suspended` 클래스 추가/미추가
2. 컬럼별 분기 → `col-platform`, `col-product-name` 등 추가
3. `td.style.cssText = ''` 제거
4. `columnAlignmentsRef` 동적 정렬은 인라인 유지

### Phase 4: 시트별 적용 순서
1. **BrandItemSheet** 먼저 (읽기 전용, 가장 단순, 리스크 낮음)
2. **OperatorItemSheet** (편집 가능, 가장 복잡)
3. **SalesItemSheet** (Operator와 거의 동일)

### Phase 5: DailyWorkSheet, UnifiedItemSheet 확장
3개 시트 검증 완료 후 나머지 2개 시트에 동일 패턴 적용.

---

## 7. 검증 체크리스트

### 7.1 UI 동일성 검증 (각 시트별)
- [ ] 품목 구분선 파란색 8px 정상
- [ ] 제품 헤더 회색 배경, 굵은 글씨 정상
- [ ] 제품 데이터 노란 배경 정상
- [ ] 구매자 헤더 회색 배경 정상
- [ ] 구매자 짝수/홀수 일차 배경색 구분 정상
- [ ] 업로드 링크 바 검정 배경, 흰색 글씨 정상
- [ ] 중단(suspended) 행 빨간 배경 정상
- [ ] 플랫폼 파란색 굵은 글씨 정상
- [ ] 제품명 초록색 굵은 글씨 정상
- [ ] 가격 분홍색 굵은 글씨 정상
- [ ] URL 하이퍼링크 정상
- [ ] 접기 토글 ▶/▼ 아이콘 정상
- [ ] 리뷰샷 링크 정상
- [ ] 상태 칩 색상 정상
- [ ] 입금완료 초록색 굵은 글씨 정상
- [ ] 중복 주문번호 빨간 배경 정상
- [ ] 금액 숫자 포맷 정상

### 7.2 기능 검증 (각 시트별)
- [ ] 셀 편집 정상 (Operator, Sales)
- [ ] 한글 입력 "홍길동" 10회 정상
- [ ] Ctrl+S 저장 정상
- [ ] 접기/펼치기 (개별 + 모두) 정상
- [ ] 슬래시(/) 복붙 정상
- [ ] 우클릭 컨텍스트 메뉴 정상
- [ ] 컬럼 정렬 변경 정상 (우클릭 → 좌/중/우 정렬)
- [ ] 컬럼 너비 조절 정상
- [ ] Shift+스크롤 횡스크롤 정상
- [ ] 필터 정상 (Brand)

### 7.3 성능 검증
- [ ] 500행+ 데이터에서 스크롤 흔들림 감소/제거
- [ ] 스크롤 시 프레임 드랍 없음
- [ ] 초기 로딩 속도 저하 없음

---

## 8. 롤백 계획

문제 발생 시 22차 상태(현재 서버 main 폴더 배포 버전)로 복원.
- `td.style.cssText = ''` 임시방편 코드가 있으므로 CSS 전환 전에도 기본 동작은 보장됨
- Phase별 적용이므로 특정 Phase에서 문제 발생 시 해당 Phase만 롤백 가능

---

## 9. 예상 작업량

| Phase | 파일 수 | 예상 변경 라인 | 리스크 |
|-------|---------|-------------|--------|
| 1 (CSS 정의) | 3 | ~60줄 추가 | 낮음 |
| 2 (단순 렌더러) | 3 | ~30줄 변경 | 낮음 |
| 3 (조건 렌더러) | 3 | ~200줄 변경 | 중간 |
| 4 (시트별 적용) | - | Phase 2+3 포함 | - |
| 5 (확장) | 2 | ~150줄 변경 | 낮음 |
| **합계** | **5** | **~440줄** | **중간** |
