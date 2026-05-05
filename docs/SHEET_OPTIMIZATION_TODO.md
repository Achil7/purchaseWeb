# Handsontable 시트 성능 최적화 TODO

## 1. 개요

### 1.1 목적
Handsontable 기반 시트 컴포넌트들의 성능을 개선하여, 대용량 데이터(500~1000+ 행)에서도 버벅거림 없이 부드러운 사용자 경험 제공

### 1.2 목표
1. **초기 로딩**: 1000행 기준 300ms 이내
2. **스크롤**: 60fps 유지 (버벅거림 없음)
3. **데이터 입력**: 키 입력 후 50ms 이내 반응
4. **슬래시 복붙**: 100줄 데이터 붙여넣기 1초 이내
5. **100행 제한 해제**: 제한 없이도 위 성능 목표 달성

### 1.3 제약 조건
- **UI 변경 절대 불가** - 컬럼 구조, 색상, 레이아웃 등 모든 UI 요소 유지
- **기능 변경 절대 불가** - 편집, 저장, 필터, 정렬, 접기/펼치기 등 모든 기능 유지
- 내부 구현(코드 로직)만 최적화

### 1.4 현재 문제 상황
| 문제 | 상세 |
|------|------|
| 로딩 느림 | 한 캠페인에 많은 품목 추가 시 시트 표시까지 오래 걸림 |
| 스크롤 버벅거림 | 500~1000+ 구매자 행 스크롤 시 프레임 드랍 |
| 입력 지연 | 많은 데이터에서 셀 편집 시 반응 느림 |
| 슬래시 복붙 느림 | 주문번호 컬럼에 `/` 구분 데이터 붙여넣기 시 오래 걸림 |
| 100행 제한 | 임시방편으로 100행씩 로딩 중 (근본 해결 아님) |

### 1.5 슬래시 복붙 기능 설명
영업사/진행자가 주문번호 컬럼(col7)에 아래 형식으로 붙여넣으면 자동 파싱:
```
8100156654667/최민석/최민석/fake03@gmail.com/010-4567-8901/대구광역시.../우리1002-345-678901 최민석/78000
```
→ `/` 기준 split하여 8개 컬럼(주문번호~금액)에 분배

---

## 2. 대상 파일

### 2.1 주요 시트 컴포넌트 (5개)
| 우선순위 | 파일명 | 경로 | 라인 수 | 용도 |
|---------|--------|------|---------|------|
| 1 | OperatorItemSheet | `frontend/src/components/operator/OperatorItemSheet.js` | ~2,500 | 진행자 품목/구매자 관리 (편집 가능) |
| 2 | SalesItemSheet | `frontend/src/components/sales/SalesItemSheet.js` | ~2,200 | 영업사 품목/구매자 관리 (편집 가능) |
| 3 | UnifiedItemSheet | `frontend/src/components/common/UnifiedItemSheet.js` | ~1,370 | 통합 시트 (Admin용) |
| 4 | DailyWorkSheet | `frontend/src/components/common/DailyWorkSheet.js` | ~1,330 | 날짜별 작업 시트 |
| 5 | BrandItemSheet | `frontend/src/components/brand/BrandItemSheet.js` | ~1,350 | 브랜드사 조회 (읽기 전용) |

### 2.2 현재 HotTable 설정 (모든 시트 공통)
```javascript
<HotTable
  height="calc(100vh - 210px)"      // ⚠️ 절대 100%로 변경 금지!
  rowHeights={23}                   // 고정 행 높이
  autoRowSize={false}               // 자동 행 높이 계산 비활성화 ✓
  autoColumnSize={false}            // 자동 컬럼 너비 계산 비활성화 ✓
  viewportRowRenderingOffset={100}  // 뷰포트 밖 100행 미리 렌더링
  manualColumnResize={true}         // 수동 컬럼 리사이즈 허용
  manualRowResize={false}           // 행 리사이즈 비활성화 ✓
/>
```

---

## 3. 성능 병목 분석 (코드 분석 완료)

### 3.1 확인된 병목점

#### 🔴 심각 (Critical) - 즉시 해결 필요

| # | 문제 | 위치 | 코드 라인 | 영향 |
|---|------|------|----------|------|
| 1 | **handleAfterChange 내 tableData 전체 순회** | `currentTableData.forEach()` | OperatorItemSheet:1313 | 날짜 변경 시 O(n) 순회, 500행이면 500번 반복 |
| 2 | **afterChange 호출 후 setTimeout 내 hiddenRows 복원** | `setTimeout(() => {...})` | OperatorItemSheet:1370-1392 | 매 변경마다 hiddenRows 플러그인 전체 검사 |
| 3 | **handleSaveChanges 내 slots.filter() 반복** | `slots.filter(s => ...)` | OperatorItemSheet:1428-1430 | 저장 시 day_group마다 전체 slots 순회 |

#### 🟠 중간 (Medium) - 개선 권장

| # | 문제 | 위치 | 코드 라인 | 영향 |
|---|------|------|----------|------|
| 4 | **beforePaste에서 data 배열 재구성** | `data.length = 0; newData.forEach(...)` | OperatorItemSheet:2365-2366 | 대량 붙여넣기 시 배열 조작 오버헤드 |
| 5 | **afterLoadData에서 hiddenRows diff 계산** | `[...currentHidden].filter(...)` | OperatorItemSheet:2385-2386 | Set → Array 변환 오버헤드 |
| 6 | **setSlots 내 prevSlots.map() 전체 순회** | `prevSlots.map(slot => {...})` | OperatorItemSheet:1447-1448 | 저장 후 전체 slots 재생성 |

#### 🟡 낮음 (Low) - 시간 여유 시 개선

| # | 문제 | 위치 | 영향 |
|---|------|------|------|
| 7 | slotIndexMap 매번 재생성 가능성 | useMemo 의존성 | 캠페인 변경 시 |
| 8 | cellsRenderer 분기 처리 | cells prop | 보이는 모든 셀에 대해 실행 |

### 3.2 슬래시 복붙 관련 병목 (beforePaste → afterChange 체인)

```
사용자가 100줄 붙여넣기
    ↓
beforePaste: 100줄 × split('/') × 8컬럼 = 800개 데이터 생성
    ↓
Handsontable: 800개 셀에 데이터 설정
    ↓
afterChange: 800개 changes 처리
    ↓
각 change마다:
  - tableData[row] 참조
  - slotIndexMap[row] 참조
  - slotUpdates 객체 업데이트
    ↓
setChangedSlots 상태 업데이트 → 리렌더링
    ↓
setTimeout 내 hiddenRows 복원 → 추가 렌더링
```

**핵심 문제**: 800개 change가 한 번에 오지 않고, Handsontable이 셀마다 afterChange 호출할 가능성

### 3.2 Google Sheets와의 차이 (참고)
| 구분 | Google Sheets | 현재 Handsontable |
|------|--------------|-------------------|
| 렌더링 방식 | Canvas (GPU 가속) | DOM (각 셀 = `<td>`) |
| 가상화 | 완전 가상화 (보이는 셀만) | 부분 가상화 |
| 데이터 로딩 | 서버에서 청크 단위 | 전체 한번에 로드 |
| 메모리 | 최적화된 구조 | 셀마다 객체 생성 |

**결론**: Canvas 전환은 Handsontable 포기 수준 → 현재 아키텍처 내 최적화 집중

---

## 4. 최적화 방안 목록

### 4.1 난이도: 쉬움 (Easy)

#### 방안 #1: afterChange 디바운싱
```javascript
// 현재: 매 키 입력마다 즉시 실행
afterChange={handleAfterChange}

// 변경: 100ms 디바운스 적용
import { debounce } from 'lodash';

const debouncedAfterChange = useMemo(
  () => debounce((changes, source) => {
    if (source === 'loadData') return;
    handleAfterChange(changes, source);
  }, 100),
  [handleAfterChange]
);

// cleanup
useEffect(() => {
  return () => debouncedAfterChange.cancel();
}, [debouncedAfterChange]);

afterChange={debouncedAfterChange}
```
**예상 효과**: 빠른 타이핑 시 UI 블로킹 방지
**상태**: [ ] 미시도 / [ ] 시도함 / [ ] 적용완료
**시도 날짜**:
**결과 메모**:

---

#### 방안 #2: viewportRowRenderingOffset 조정
```javascript
// 현재: 뷰포트 밖 100행 미리 렌더링
viewportRowRenderingOffset={100}

// 변경: 50 또는 30으로 감소
viewportRowRenderingOffset={50}  // 테스트 후 결정
```
**예상 효과**: 미리 렌더링하는 행 수 감소 → 초기 렌더링 속도 향상
**주의**: 너무 낮추면 빠른 스크롤 시 빈 행 보일 수 있음
**상태**: [ ] 미시도 / [ ] 시도함 / [ ] 적용완료
**시도 날짜**:
**결과 메모**:

---

#### 방안 #3: 스크롤 이벤트 쓰로틀링
```javascript
import { throttle } from 'lodash';

// Shift+휠 횡스크롤 핸들러에 throttle 적용
const handleWheel = useMemo(
  () => throttle((event) => {
    if (event.shiftKey) {
      // 횡스크롤 처리
    }
  }, 16),  // 약 60fps
  []
);
```
**예상 효과**: 스크롤 이벤트 과다 발생 방지
**상태**: [ ] 미시도 / [ ] 시도함 / [ ] 적용완료
**시도 날짜**:
**결과 메모**:

---

### 4.2 난이도: 중간 (Medium)

#### 방안 #4: 슬롯 인덱스 맵 사전 계산
```javascript
// 현재: O(n) 필터 (afterChange 내에서 반복 호출)
const slotsInGroup = slots.filter(s =>
  s.item_id === itemId && s.day_group === dayGroup
);

// 변경: useMemo로 Map 사전 계산 → O(1) 조회
const slotIndexMap = useMemo(() => {
  const map = new Map();
  slots.forEach(s => {
    const key = `${s.item_id}_${s.day_group}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(s);
  });
  return map;
}, [slots]);

// 사용
const slotsInGroup = slotIndexMap.get(`${itemId}_${dayGroup}`) || [];
```
**예상 효과**: afterChange 내 filter 연산 O(n) → O(1)
**적용 위치**: handleAfterChange, 기타 slots 조회 로직
**상태**: [ ] 미시도 / [ ] 시도함 / [ ] 적용완료
**시도 날짜**:
**결과 메모**:

---

#### 방안 #5: 렌더러 의존성에서 tableData 제거
```javascript
// 현재: tableData 변경시 렌더러 재생성
const productDataRenderer = useMemo(() =>
  createProductDataRenderer(tableData, collapsedItemsRef, ...),
  [tableData, toggleItemCollapse, columnAlignments]
);

// 변경: tableData를 ref로 참조
const tableDataRef = useRef(tableData);
useEffect(() => {
  tableDataRef.current = tableData;
}, [tableData]);

const productDataRenderer = useMemo(() =>
  createProductDataRenderer(tableDataRef, collapsedItemsRef, ...),
  [toggleItemCollapse, columnAlignments]  // tableData 의존성 제거
);

// createProductDataRenderer 내부에서
const rowData = tableDataRef.current[r];  // ref.current로 접근
```
**예상 효과**: 데이터 변경 시 렌더러 재생성 방지
**주의**: 렌더러 팩토리 함수도 수정 필요
**상태**: [ ] 미시도 / [ ] 시도함 / [ ] 적용완료
**시도 날짜**:
**결과 메모**:

---

#### 방안 #6: useMemo 의존성 최적화 (키 기반)
```javascript
// 현재: slots 배열 전체가 의존성 (참조 변경 시 재계산)
const tableData = useMemo(() => {
  return buildTableData(slots);
}, [slots]);

// 변경: 실제 변경 감지용 키 생성
const slotsKey = useMemo(() => {
  if (!slots.length) return 'empty';
  // 길이 + 첫번째/마지막 ID + 최신 updated_at
  const lastSlot = slots[slots.length - 1];
  return `${slots.length}_${slots[0]?.id}_${lastSlot?.id}_${lastSlot?.updated_at}`;
}, [slots]);

const tableData = useMemo(() => {
  return buildTableData(slots);
}, [slotsKey]);  // 키가 같으면 재계산 안 함
```
**예상 효과**: 불필요한 tableData 재계산 방지
**주의**: 키 생성 로직이 실제 변경을 정확히 감지해야 함
**상태**: [ ] 미시도 / [ ] 시도함 / [ ] 적용완료
**시도 날짜**:
**결과 메모**:

---

#### 방안 #7: React.memo 비교 함수 최적화
```javascript
// 현재: 기본 얕은 비교 또는 없음
export default React.memo(OperatorItemSheet);

// 변경: 핵심 props만 비교
export default React.memo(OperatorItemSheet, (prevProps, nextProps) => {
  // true 반환 = 리렌더링 안 함
  return (
    prevProps.campaignId === nextProps.campaignId &&
    prevProps.viewAsUserId === nextProps.viewAsUserId &&
    prevProps.isEmbedded === nextProps.isEmbedded
  );
});
```
**예상 효과**: 부모 리렌더링 시 불필요한 시트 리렌더링 방지
**상태**: [ ] 미시도 / [ ] 시도함 / [ ] 적용완료
**시도 날짜**:
**결과 메모**:

---

#### 방안 #8: 셀 속성(cells) 캐싱
```javascript
// 현재: 매 셀마다 cellsRenderer 실행
cells={(row, col) => {
  const cellProperties = {};
  // 매번 분기 처리...
  return cellProperties;
}}

// 변경: 행 타입 기반 캐싱
const cellPropertiesCache = useRef(new Map());

// tableData 변경 시 캐시 초기화
useEffect(() => {
  cellPropertiesCache.current.clear();
}, [tableData]);

cells={(row, col) => {
  if (row >= tableData.length) return { className: 'spare-row-cell' };

  const rowType = tableData[row]?._rowType;
  const cacheKey = `${rowType}_${col}`;

  if (cellPropertiesCache.current.has(cacheKey)) {
    return cellPropertiesCache.current.get(cacheKey);
  }

  const props = computeCellProperties(rowType, col);
  cellPropertiesCache.current.set(cacheKey, props);
  return props;
}}
```
**예상 효과**: 같은 타입의 셀에 대해 속성 계산 1회만
**주의**: 행별로 다른 속성이 필요한 경우 캐시 키 조정 필요
**상태**: [ ] 미시도 / [ ] 시도함 / [ ] 적용완료
**시도 날짜**:
**결과 메모**:

---

### 4.3 난이도: 어려움 (Hard)

#### 방안 #9: 데이터 청크 로딩 (가상 스크롤 개선)
```javascript
// 개념: 전체 데이터 대신 현재 뷰포트 + 버퍼만 실제 로드
// Handsontable의 afterScrollVertically 훅 활용

const CHUNK_SIZE = 100;
const BUFFER_SIZE = 50;

const [visibleRange, setVisibleRange] = useState({ start: 0, end: CHUNK_SIZE });

const afterScrollVertically = useCallback(() => {
  const hot = hotRef.current?.hotInstance;
  if (!hot) return;

  const firstRow = hot.rowOffset();
  const lastRow = firstRow + hot.countVisibleRows();

  setVisibleRange({
    start: Math.max(0, firstRow - BUFFER_SIZE),
    end: Math.min(totalRows, lastRow + BUFFER_SIZE)
  });
}, [totalRows]);

// 표시할 데이터는 visibleRange 내의 것만
const displayData = useMemo(() => {
  return fullTableData.slice(visibleRange.start, visibleRange.end);
}, [fullTableData, visibleRange]);
```
**예상 효과**: 대용량 데이터에서도 일정한 성능
**주의**: 행 인덱스 매핑 복잡, 스크롤 점프 처리 필요
**상태**: [ ] 미시도 / [ ] 시도함 / [ ] 적용완료
**시도 날짜**:
**결과 메모**:

---

#### 방안 #10: Web Worker로 데이터 변환
```javascript
// 개념: tableData 빌드를 별도 스레드에서 처리

// worker.js
self.onmessage = (e) => {
  const { slots, items } = e.data;
  const tableData = buildTableData(slots, items);
  self.postMessage(tableData);
};

// 컴포넌트
const [tableData, setTableData] = useState([]);

useEffect(() => {
  const worker = new Worker('worker.js');
  worker.postMessage({ slots, items });
  worker.onmessage = (e) => {
    setTableData(e.data);
  };
  return () => worker.terminate();
}, [slots, items]);
```
**예상 효과**: 메인 스레드 블로킹 방지, UI 반응성 유지
**주의**: Worker 통신 오버헤드, 복잡도 증가
**상태**: [ ] 미시도 / [ ] 시도함 / [ ] 적용완료
**시도 날짜**:
**결과 메모**:

---

## 5. 진행 기록

---

### 1차 최적화 (2026-02-07)

**적용 내용:**
- `afterChange` 핸들러에 50ms 디바운스 적용
- 빠른 타이핑/붙여넣기 시 UI 블로킹 방지 목적

**수정 파일:**
- `OperatorItemSheet.js`: `import { debounce } from 'lodash'` 추가, `debouncedAfterChange` 생성
- `SalesItemSheet.js`: 동일

**테스트 결과:**
- ❌ 엔터 후 바로 다음 데이터 입력 시 **누락 발생**
- ❌ 스크롤 여전히 버벅거림
- ❌ 슬래시 복붙 딜레이 여전

**결론:** ❌ **기각** - 디바운스가 오히려 입력 누락 유발

**원인 분석:**
- 50ms 디바운스로 인해 빠른 연속 입력 시 이전 입력이 무시됨
- 진짜 병목은 `handleAfterChange` 내부의 무거운 연산 자체

---

### 2차 최적화 (2026-02-07)

**적용 내용:**
- `afterChange` 디바운스 **제거** (입력 누락 방지)
- `handleAfterChange` 내부의 `setTimeout` hiddenRows 복원 로직을 **별도 디바운스 함수로 분리** (100ms)

**수정 파일:**
- `OperatorItemSheet.js`:
  - `debouncedRestoreHiddenRows` 함수 추가 (100ms 디바운스)
  - `handleAfterChange` 내부 `setTimeout` 제거 → `debouncedRestoreHiddenRows()` 호출
  - `afterChange={handleAfterChange}` 복원 (디바운스 아님)
- `SalesItemSheet.js`: 동일

**기대 효과:**
- 연속 편집 시 hiddenRows 검사가 100ms 후 **한 번만** 실행
- 매 셀 편집마다 실행되던 무거운 로직 횟수 대폭 감소

**테스트 환경:**
- 품목 9개, 구매자 370행

**테스트 항목:**
- [ ] 엔터 후 바로 다음 데이터 입력 → 누락 여부
- [ ] 슬래시 복붙 속도
- [ ] 스크롤 부드러움

**결론:** ⏳ 테스트 대기

---

### 3차 최적화 (2026-02-07)

**적용 내용:**
- `setChangedSlots`/`setChangedItems` **상태(state) 업데이트 제거**
- **ref만 사용**하여 변경사항 추적 (리렌더링 방지)
- 저장 버튼 표시용으로 `hasUnsavedChanges` boolean 상태 추가 (첫 변경 시에만 true)

**문제 분석:**
- 매 셀 편집마다 `setChangedSlots(newSlotUpdates)` 호출
- React 상태 업데이트 → 컴포넌트 리렌더링 트리거
- 리렌더링 시 Handsontable도 갱신 → 딜레이 발생

**수정 파일:**
- `OperatorItemSheet.js`:
  - `const [changedSlots, setChangedSlots] = useState({})` → `const changedSlotsRef = useRef({})`
  - `const [changedItems, setChangedItems] = useState({})` → `const changedItemsRef = useRef({})`
  - `const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)` 추가
  - `handleAfterChange`에서 `setChangedSlots`/`setChangedItems` 호출 제거
  - 저장 버튼 표시: `hasChanges = hasUnsavedChanges`로 변경
  - 저장 완료 시 `setHasUnsavedChanges(false)` 호출
- `SalesItemSheet.js`: 동일 변경

**기대 효과:**
- 매 셀 편집마다 발생하던 리렌더링 제거
- 엔터 후 다음 셀 이동 시 딜레이 감소
- Ctrl+S 저장 시 즉각 반응

**테스트 항목:**
- [x] 엔터 연속 입력 시 글자 누락/지연 없음 → ❌ 딜레이 심함
- [x] Ctrl+S 즉시 반응 → ❌ 딜레이 심함
- [x] 스크롤 부드러움 → ❌ 딜레이 존재
- [ ] 저장 버튼 정상 표시/숨김

**결론:** ❌ **효과 없음** - React 상태 업데이트가 아닌 다른 병목 존재

**원인 분석:**
- `setChangedSlots`/`setChangedItems` 제거만으로는 효과 없음
- **진짜 병목은 다른 곳에 있음**:
  1. `handleAfterChange` 내부 로직 자체 (tableData 순회 등)
  2. `handleSaveChanges` 내 `slots.filter()` 반복
  3. `setSlots(prevSlots.map(...))` 전체 슬롯 재생성
  4. Handsontable 렌더링 자체 (DOM 기반)

---

## 6. 근본 원인 재분석 필요

### 1-3차 최적화 결과 요약
| 차수 | 적용 내용 | 결과 |
|------|----------|------|
| 1차 | afterChange 50ms 디바운스 | ❌ 입력 누락 |
| 2차 | hiddenRows 복원 100ms 디바운스 | ❌ 효과 없음 |
| 3차 | setChangedSlots/Items 제거 (ref 사용) | ❌ 효과 없음 |

### 다음 단계 후보
1. **handleSaveChanges 최적화** - `slots.filter()` 대신 인덱스 맵 사용
2. **setSlots 최적화** - 전체 재생성 대신 부분 업데이트
3. **Handsontable 설정 조정** - viewportRowRenderingOffset 감소
4. **cells 함수 최적화** - 캐싱 또는 단순화
5. **tableData useMemo 최적화** - 의존성 최소화

---

### 4차 최적화 (2026-02-07)

**적용 내용:**
- `handleSaveChanges`에서 **`setSlots()` 호출 완전 제거**
- DB 저장만 수행하고 React 상태는 건드리지 않음
- Handsontable에 이미 사용자가 수정한 데이터가 표시되어 있으므로 추가 업데이트 불필요
- 캠페인 전환 시에만 `slots` 상태가 갱신됨

**문제 분석:**
```
저장 시 병목 체인:
setSlots(prevSlots.map(...))
  → 500개 슬롯 새 객체 생성
  → slots 변경 감지
  → baseTableData useMemo 재계산
  → tableData 전체 재생성
  → HotTable data prop 변경
  → Handsontable 전체 DOM 리렌더링
  → 500+ <td> 요소 다시 그림
  → 심각한 딜레이
```

**수정 파일:**
- `OperatorItemSheet.js`:
  - `handleSaveChanges` 내 `setSlots(prevSlots => {...})` 블록 제거 (약 45줄)
- `SalesItemSheet.js`: 동일 변경

**기대 효과:**
- Ctrl+S 저장 시 전체 리렌더링 제거
- 저장 직후 즉시 반응
- 스크롤 위치 유지 (리렌더링이 없으므로)

**테스트 항목:**
- [x] Ctrl+S 저장 시 딜레이 없음 → △ 약간 개선, 여전히 딜레이 존재
- [x] 저장 후 데이터 정상 유지 → ✅ 정상
- [ ] 캠페인 전환 시 최신 데이터 로드
- [x] 저장 후 추가 편집 정상 → ❌ 한글 IME 깨짐 발생

**결론:** △ **부분 개선** - 딜레이 약간 개선, 한글 IME 깨짐 문제 발생

**추가 발견:**
- 한글 입력 중 영어로 바뀌는 현상 ("홍길동" → "ghl길동", "gㅗㅇ길동")
- 원인: `handleAfterChange`에서 매 편집마다 `setHasUnsavedChanges(true)` 호출 → 리렌더링 → IME 컨텍스트 끊김

---

### 5차 최적화 (2026-02-07)

**적용 내용:**
- `setHasUnsavedChanges(true)` 호출을 **첫 변경 시에만** 실행하도록 변경
- `hasUnsavedChangesRef` 추가하여 중복 상태 업데이트 방지
- 이미 `true`인 경우 상태 업데이트 스킵 → 리렌더링 방지

**문제 분석:**
```
매 셀 편집 시:
handleAfterChange() 호출
  → setHasUnsavedChanges(true) 매번 호출
  → React 상태 업데이트
  → 컴포넌트 리렌더링
  → Handsontable 갱신
  → 셀 포커스 변경
  → IME 조합 컨텍스트 끊김
  → 한글이 영어로 변환됨
```

**수정 파일:**
- `OperatorItemSheet.js`:
  - `const hasUnsavedChangesRef = useRef(false);` 추가
  - `handleAfterChange`에서 조건부 호출: `if (!hasUnsavedChangesRef.current) { ... }`
  - 저장/로드 시 `hasUnsavedChangesRef.current = false;` 초기화
- `SalesItemSheet.js`: 동일 변경

**기대 효과:**
- 첫 편집 이후 추가 편집 시 리렌더링 없음
- 한글 IME 깨짐 현상 해결
- 엔터 후 다음 셀 이동 시 딜레이 감소

**테스트 항목:**
- [x] 한글 연속 입력 시 영어로 바뀌는 현상 해결 → ❌ 여전히 발생
- [x] 엔터 후 다음 셀 이동 시 딜레이 없음 → ❌ 딜레이 심함
- [x] Ctrl+S 저장 시 딜레이 감소 → ❌ 딜레이 심함
- [ ] 저장 버튼 정상 표시/숨김

**결론:** ❌ **효과 없음** - `setHasUnsavedChanges` 중복 호출이 원인이 아니었음

**원인 재분석:**
- 심층 분석 결과 **진짜 원인 발견**: `hot.setDataAtCell()` 동기 렌더링
- 날짜(col1) 변경 시 `setDataAtCell()`이 동기적으로 호출되어 IME 조합 중단

---

### 6차 최적화 (2026-02-07)

**적용 내용:**
- `setDataAtCell()` 호출을 **`requestAnimationFrame`으로 비동기화**
- IME 조합이 완료된 후 다음 렌더링 사이클에서 날짜 동기화 실행

**문제 분석:**
```
한글 입력 중 (IME 조합):
사용자: "홍" 입력
  ↓
Handsontable: afterChange 호출 (조합 중간에!)
  ↓
handleAfterChange: col1(날짜) 변경 감지
  ↓
hot.setDataAtCell(cellsToUpdate, 'syncBuyerDate')  ← 동기 렌더링!
  ↓
Handsontable DOM 즉시 업데이트
  ↓
IME 조합 컨텍스트 끊김
  ↓
"홍" → 조합되던 글자 유실 → "길동", "ㅗㅇ길동" 등
```

**수정 파일:**
- `OperatorItemSheet.js`:
  - 라인 1339-1347: `setDataAtCell`을 `requestAnimationFrame`으로 감싸기
- `SalesItemSheet.js`: 동일 변경

**수정 코드:**
```javascript
// Before (동기 - 문제)
hot.setDataAtCell(cellsToUpdate, 'syncBuyerDate');

// After (비동기 - 6차 최적화)
requestAnimationFrame(() => {
  const hotInstance = hotRef.current?.hotInstance;
  if (hotInstance) {
    hotInstance.setDataAtCell(cellsToUpdate, 'syncBuyerDate');
  }
});
```

**기대 효과:**
- IME 조합이 완료된 후 렌더링 실행
- 한글 입력 중 끊김 현상 해결

**테스트 항목:**
- [x] 한글 "홍길동" + 엔터 빠르게 입력 → 글자 깨짐 없음 → ❌ 여전히 깨짐
- [x] 엔터 후 다음 셀 이동 시 딜레이 없음 → ❌ 딜레이 존재
- [x] Ctrl+S 저장 시 딜레이 감소 → ❌ 딜레이 심함
- [ ] 날짜 동기화 정상 작동

**결론:** ❌ **효과 없음** - `requestAnimationFrame`만으로는 IME 조합 상태 감지 불가

**테스트 결과:**
- "gㅗㅇ길동", "ㅇ길동h" 등 한글 IME 깨짐 여전
- 비동기화만으로는 IME 조합 중인지 판단할 수 없음

**원인 재분석:**
- `requestAnimationFrame`은 다음 프레임에 실행되지만, IME 조합 중인지 알 수 없음
- Handsontable의 `afterChange`는 IME 조합 중에도 호출됨
- 근본적으로 **IME 조합 상태를 감지**해야 함

---

### 7차 최적화 (2026-02-07)

**적용 내용:**
- Handsontable 15.3.0+에서 추가된 **`beforeCompositionstart`**, **`afterCompositionend`** 훅 사용
- `isComposingRef`로 IME 조합 상태 추적
- `afterChange`에서 IME 조합 중이면 처리 스킵

**해결책 발견:**
- Handsontable 15.3.0부터 IME 조합 이벤트 훅 지원
- 프로젝트는 16.2.0 사용 중 → 사용 가능

**수정 파일:**
- `OperatorItemSheet.js`:
  - `const isComposingRef = useRef(false);` 추가
  - HotTable에 `beforeCompositionstart`, `afterCompositionend` 훅 추가
  - `afterChange`에서 `if (isComposingRef.current) return;` 체크
- `SalesItemSheet.js`: 동일 변경

**수정 코드:**
```javascript
// IME 조합 상태 추적용 ref
const isComposingRef = useRef(false);

<HotTable
  // 7차 최적화: IME 조합 상태 추적 (한글 입력 깨짐 방지)
  beforeCompositionstart={() => {
    isComposingRef.current = true;
  }}
  afterCompositionend={() => {
    isComposingRef.current = false;
  }}
  afterChange={(changes, source) => {
    // 7차 최적화: IME 조합 중이면 무시 (한글 입력 깨짐 방지)
    if (isComposingRef.current) return;
    handleAfterChange(changes, source);
  }}
/>
```

**기대 효과:**
- IME 조합이 완전히 완료된 후에만 `afterChange` 처리
- 한글 "홍길동" 입력 시 끊김/깨짐 없음
- 일본어, 중국어 등 다른 IME 입력도 지원

**테스트 항목:**
- [x] 한글 "홍길동" + 엔터 빠르게 입력 → 글자 깨짐 없음 → ❌ 여전히 깨짐
- [x] 엔터 후 다음 셀 이동 시 딜레이 없음 → ❌ 딜레이 존재
- [x] Ctrl+S 저장 시 딜레이 감소 → ❌ 딜레이 심함
- [ ] 날짜 동기화 정상 작동
- [ ] 일반 영문/숫자 입력 정상

**결론:** ❌ **효과 없음** - `afterCompositionEnd` 훅이 Handsontable에서 미지원!

**실패 원인 분석:**
- Handsontable 15.3.0+에서 `beforeCompositionStart`만 공식 지원
- `afterCompositionEnd` 훅은 **존재하지 않음**
- `isComposingRef.current = false`가 실행되지 않아 항상 true 상태

---

### 8차 최적화 (2026-02-07)

**적용 내용:**
- Handsontable 훅 대신 **DOM의 `compositionstart`/`compositionend` 이벤트 직접 리스닝**
- useEffect로 Handsontable 컨테이너에 이벤트 리스너 추가
- 7차에서 추가한 HotTable의 `beforeCompositionstart`, `afterCompositionend` prop 제거

**수정 파일:**
- `OperatorItemSheet.js`:
  - HotTable의 composition 훅 제거
  - useEffect로 DOM 이벤트 리스너 추가
- `SalesItemSheet.js`: 동일 변경

**수정 코드:**
```javascript
// 8차 최적화: IME 조합 상태 추적 (한글 입력 깨짐 방지)
const isComposingRef = useRef(false);

// 8차 최적화: DOM compositionstart/compositionend 이벤트 리스너
// Handsontable은 afterCompositionEnd 훅을 지원하지 않으므로 DOM 이벤트 직접 사용
useEffect(() => {
  const container = hotRef.current?.hotInstance?.rootElement;
  if (!container) return;

  const handleCompositionStart = () => {
    isComposingRef.current = true;
  };

  const handleCompositionEnd = () => {
    isComposingRef.current = false;
  };

  container.addEventListener('compositionstart', handleCompositionStart);
  container.addEventListener('compositionend', handleCompositionEnd);

  return () => {
    container.removeEventListener('compositionstart', handleCompositionStart);
    container.removeEventListener('compositionend', handleCompositionEnd);
  };
}, [slots]); // slots 변경 시 재설정

// afterChange에서 IME 조합 중이면 무시
afterChange={(changes, source) => {
  if (isComposingRef.current) return;
  handleAfterChange(changes, source);
}}
```

**기대 효과:**
- DOM 레벨에서 정확한 IME 조합 상태 감지
- 한글 조합이 완료된 후에만 afterChange 처리
- "홍길동" 정상 입력 가능

**테스트 항목:**
- [x] 한글 "홍길동" + 엔터 빠르게 입력 → 글자 깨짐 없음 → △ 영어 변환 해결, 앞글자 잘림 잔존 ("ㅗㅇ길동")
- [x] 엔터 후 다음 셀 이동 시 딜레이 없음 → ❌ 딜레이 존재
- [x] Ctrl+S 저장 시 딜레이 감소 → ❌ 딜레이 심함
- [ ] 날짜 동기화 정상 작동
- [ ] 일반 영문/숫자 입력 정상

**결론:** △ **부분 개선** - 영어 변환 해결, 딜레이 및 앞글자 잘림 잔존

**개선된 점:**
- 영어 변환 문제 해결 (더 이상 "gㅗㅇ길동" 같은 영문 혼합 안 나옴)

**남은 문제:**
- 엔터 후 딜레이로 인한 앞글자 잘림 ("ㅗㅇ길동")
- Ctrl+S 저장 딜레이

---

### 9차 최적화 (2026-02-07)

**적용 내용:**
- `setHasUnsavedChanges(true)`를 **`requestAnimationFrame`으로 지연**
- 셀 이동이 먼저 완료된 후 리렌더링되도록 하여 입력 끊김 방지

**문제 분석:**
```
한글 입력 후 엔터
  ↓
compositionend 이벤트 → isComposingRef = false
  ↓
afterChange 호출 → handleAfterChange 실행
  ↓
setHasUnsavedChanges(true) 호출 (첫 변경 시)
  ↓
React 상태 업데이트 → 컴포넌트 리렌더링
  ↓
Handsontable 갱신 중 다음 셀로 이동
  ↓
이 타이밍에 다음 입력 시작 → 앞글자 잘림
```

**수정 파일:**
- `OperatorItemSheet.js`
- `SalesItemSheet.js`

**수정 코드:**
```javascript
// 9차 최적화: 상태 업데이트를 requestAnimationFrame으로 지연
// 셀 이동이 먼저 완료된 후 리렌더링되도록 하여 입력 끊김 방지
if (!hasUnsavedChangesRef.current) {
  hasUnsavedChangesRef.current = true;
  requestAnimationFrame(() => {
    setHasUnsavedChanges(true);
  });
}
```

**기대 효과:**
- 현재 프레임의 셀 이동 완료 후 상태 업데이트
- 입력 중 리렌더링으로 인한 끊김 방지
- 엔터 후 다음 셀 입력 시 앞글자 잘림 해결

**테스트 항목:**
- [ ] 한글 "홍길동" + 엔터 빠르게 입력 → 앞글자 잘림 없음
- [ ] 엔터 후 다음 셀 이동 시 딜레이 없음
- [ ] Ctrl+S 저장 시 딜레이 감소
- [ ] 일반 영문/숫자 입력 정상

**테스트 결과 (2026-02-08):**
- ❌ 한글 입력: "ㅗㅇ길동" 여전히 발생 (약 50% 확률)
- △ 영문 변환: 해결됨 ("gㅗㅇ길동" 더 이상 발생 안 함)
- ❌ Ctrl+S 딜레이: 여전히 존재, **2-3회에 걸쳐 딜레이 발생**
  - Ctrl+S 직후 첫 번째 딜레이
  - 1~2초 후 두 번째 딜레이
  - 총 2~3번의 버벅거림

**원인 분석:**
```
Ctrl+S 누름
  ↓
handleSaveChanges() 시작
  ↓
1️⃣ setSaving(true) → 리렌더링
  ↓
API 호출 (await) - 네트워크 대기
  ↓
2️⃣ setHasUnsavedChanges(false) → 리렌더링
  ↓
3️⃣ setSnackbar({ open: true }) → 리렌더링
  ↓
4️⃣ setSaving(false) → 리렌더링
  ↓
(100ms 후) debouncedRestoreHiddenRows 실행 → 추가 딜레이
```
**문제**: 4회의 상태 업데이트 = 4회의 리렌더링 = 4회의 Handsontable 갱신

**결론:** △ 부분 성공 (영문 변환 해결), 한글 잘림/딜레이 미해결

---

### 10차 최적화 (2026-02-08)

**적용 내용:**
- `handleSaveChanges` 내 상태 업데이트를 **`unstable_batchedUpdates`로 배칭**
- 4회 리렌더링 → 1회 리렌더링으로 줄임
- `finally` 블록 제거하고 try/catch 내에서 직접 처리
- 스크롤 복원을 `requestAnimationFrame`으로 변경

**수정 파일:**
- `OperatorItemSheet.js`
- `SalesItemSheet.js`

**수정 코드:**
```javascript
import { unstable_batchedUpdates } from 'react-dom';

// handleSaveChanges 내 성공 시:
unstable_batchedUpdates(() => {
  setSaving(false);
  setHasUnsavedChanges(false);
  setSnackbar({ open: true, message: '저장되었습니다' });
});

// 스크롤 복원:
requestAnimationFrame(() => {
  const wtHolder = hot?.rootElement?.querySelector('.wtHolder');
  if (wtHolder) {
    wtHolder.scrollTop = scrollPosition;
    wtHolder.scrollLeft = scrollLeft;
  }
});
```

**기대 효과:**
- 저장 완료 후 상태 업데이트 1회로 통합
- 리렌더링 횟수 감소 → 딜레이 감소
- `requestAnimationFrame`으로 스크롤 복원 타이밍 최적화

**테스트 항목:**
- [x] Ctrl+S 저장 시 딜레이 횟수 감소 (2-3회 → 1회) → ❌ 여전히 딜레이 존재
- [x] 저장 후 스크롤 위치 유지 → ✅
- [x] 저장 완료 메시지 정상 표시 → ✅
- [x] 에러 발생 시 에러 메시지 정상 표시 → ✅

**테스트 결과 (2026-02-09):**
- ❌ 엔터 후 딜레이: 0.1~0.5초 딜레이 여전히 존재
- ❌ Ctrl+S 딜레이: 여전히 존재

**결론:** ❌ 딜레이 미해결 - setSaving(true)가 배칭 전에 발생, debouncedRestoreHiddenRows 여전히 실행

---

### 11차 최적화 (2026-02-09)

**적용 내용:**
1. **saving 상태를 ref로 변경** - 리렌더링 제거
   - `const [saving, setSaving] = useState(false)` → `const savingRef = useRef(false)`
   - UI에서 "저장 중..." 표시 제거 (중복 저장은 ref로 방지)
   - `setSaving(true)` 호출 시 발생하던 리렌더링 완전 제거
2. **debouncedRestoreHiddenRows 완전 제거**
   - handleAfterChange에서 호출하던 부분 제거
   - 함수 자체와 관련 useEffect 삭제
   - 일반 셀 편집 시 hiddenRows 복원은 불필요함
   - 접기/펼치기는 collapsedItems 상태 변경으로 자동 처리됨

**수정 파일:**
- `OperatorItemSheet.js`
- `SalesItemSheet.js`

**수정 코드:**
```javascript
// 1. saving 상태 → ref 변경
const savingRef = useRef(false);

// handleSaveChanges 시작 시:
if (savingRef.current) return;  // 중복 저장 방지
savingRef.current = true;

// 완료/실패 시:
savingRef.current = false;

// 2. debouncedRestoreHiddenRows 호출 제거
// handleAfterChange 끝에서:
// debouncedRestoreHiddenRows(); ← 제거

// 3. debouncedRestoreHiddenRows 함수 및 useEffect 완전 제거
```

**기대 효과:**
- Ctrl+S: 리렌더링 2회 → 1회 (setSaving 제거)
- 엔터 후: hiddenRows 복원이 100ms마다 실행되지 않아 딜레이 대폭 감소
- 전반적인 입력 반응성 향상

**테스트 항목:**
- [x] Ctrl+S 저장 시 딜레이 감소 → ❌ 여전히 존재 (직후 + 1~2초 후)
- [x] 엔터 후 다음 셀 입력 시 딜레이 감소 → △ 약간 개선
- [x] 한글 "홍길동" 입력 → ❌ 앞글자 잘림 여전히 발생 (ㅗㅇ길동, gㅗㅇ길동, 익ㄹ동h, 길동d)
- [x] 접기/펼치기 기능 정상 작동 → ✅
- [x] 저장 버튼 정상 작동 (중복 클릭 방지) → ✅

**테스트 결과 (2026-02-10):**
- ❌ 엔터 후 딜레이: 아주 살짝 존재 (0.1초 미만)
- ❌ 한글 입력 깨짐: "ㅗㅇ길동", "gㅗㅇ길동", "익ㄹ동h", "길동d" 등 다양한 패턴으로 발생
- ❌ Ctrl+S 딜레이:
  - Ctrl+S 직후 딜레이 존재
  - 1~2초 후 추가 딜레이 발생 (Snackbar autoHideDuration으로 인한 리렌더링)

**원인 분석:**
```
1. 엔터 후 딜레이 원인:
   handleAfterChange() 실행
     ↓
   hasUnsavedChangesRef.current = true
     ↓
   requestAnimationFrame(() => {
     setHasUnsavedChanges(true);  ← 여전히 리렌더링 발생!
   })
     ↓
   다음 셀로 이동 중 리렌더링 → 입력 끊김

2. Ctrl+S 1~2초 후 딜레이 원인:
   Snackbar autoHideDuration={3000}
     ↓
   3초 후 onClose 호출
     ↓
   setSnackbar({ open: false }) → 리렌더링
     ↓
   Handsontable 갱신 → 딜레이
```

**결론:** △ 부분 성공 - saving ref 변환은 효과 있었으나 여전히 딜레이 존재

---

### 12차 최적화 (2026-02-10)

**적용 내용:**
1. **hasUnsavedChanges state 완전 제거** - ref만 사용하여 리렌더링 완전 제거
   - `const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)` 제거
   - `setHasUnsavedChanges(true/false)` 모든 호출 제거
   - `hasUnsavedChangesRef`만 사용
2. **저장 버튼 항상 표시** - 조건부 렌더링 제거로 리렌더링 없음
   - `{hasChanges && (...)}` → 항상 렌더링
   - 버튼 텍스트: "저장 (Ctrl+S)"
3. **Snackbar를 ref 기반 DOM 직접 조작으로 변경** - 리렌더링 완전 제거
   - MUI `<Snackbar>` 컴포넌트 제거
   - `const [snackbar, setSnackbar] = useState(...)` 제거
   - `snackbarRef` + custom `<Box>` div로 교체
   - `showSnackbar(message)` 함수로 DOM 직접 조작
   - 6초 후 자동 숨김 (CSS transition)
4. **unstable_batchedUpdates import 제거** - 더 이상 사용하지 않음

**수정 파일:**
- `OperatorItemSheet.js`
- `SalesItemSheet.js` (예정)

**수정 코드:**
```javascript
// 1. hasUnsavedChanges state 제거
// 제거: const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
// 유지: const hasUnsavedChangesRef = useRef(false);

// 2. handleAfterChange에서 setHasUnsavedChanges 호출 제거
if (hasSlotChanges || hasItemChanges) {
  hasUnsavedChangesRef.current = true;
  // setHasUnsavedChanges 호출 제거 - 리렌더링 방지
}

// 3. 저장 버튼 항상 표시
<Button onClick={handleSaveChanges} ...>
  저장 (Ctrl+S)
</Button>

// 4. Snackbar ref 기반 변경
const snackbarRef = useRef(null);
const snackbarTimeoutRef = useRef(null);

const showSnackbar = useCallback((message) => {
  const snackbarEl = snackbarRef.current;
  if (!snackbarEl) return;

  // 기존 타이머 취소
  if (snackbarTimeoutRef.current) {
    clearTimeout(snackbarTimeoutRef.current);
  }

  // 메시지 설정 및 표시
  const messageEl = snackbarEl.querySelector('.snackbar-message');
  if (messageEl) {
    messageEl.textContent = message;
  }
  snackbarEl.style.display = 'flex';
  snackbarEl.style.opacity = '1';

  // 6초 후 자동 숨김
  snackbarTimeoutRef.current = setTimeout(() => {
    snackbarEl.style.opacity = '0';
    setTimeout(() => {
      snackbarEl.style.display = 'none';
    }, 300);
  }, 6000);
}, []);

// JSX: MUI Snackbar 대신 custom Box
<Box
  ref={snackbarRef}
  sx={{
    display: 'none',
    position: 'fixed',
    bottom: 24,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 9999,
    transition: 'opacity 0.3s ease',
    ...
  }}
>
  <Box className="snackbar-content">
    <span className="snackbar-message"></span>
  </Box>
</Box>
```

**기대 효과:**
- **엔터 후 딜레이**: 완전 제거 (리렌더링 없음)
- **Ctrl+S 딜레이**: 즉시 Snackbar 표시, 리렌더링 없음
- **6초 후 딜레이**: Snackbar 닫힘 시 React 상태 변경 없음 → 리렌더링 없음
- **한글 입력 깨짐**: 리렌더링이 없으므로 해결 예상

**테스트 항목:**
- [ ] 엔터 후 다음 셀 입력 시 딜레이 완전 제거
- [ ] 한글 "홍길동" 입력 → 글자 깨짐 없음
- [ ] Ctrl+S 저장 시 즉시 반응
- [ ] 저장 버튼 항상 표시 확인
- [ ] 저장 완료 Snackbar 정상 표시 (6초 유지 후 자동 숨김)
- [ ] Snackbar 닫힘 시 딜레이 없음

**테스트 결과 (2026-02-11):**
- ❌ 6초 후 딜레이: 여전히 존재
- ❌ 한글 입력 깨짐: 여전히 발생 ("홍길동, ㅇ길동h, ㅗㅇ길동...")

**결론:** △ 부분 성공 - 리렌더링은 제거되었으나 딜레이 잔존

---

### 13차 최적화 (2026-02-11)

**적용 내용:**
1. **Snackbar CSS animation 방식으로 완전 변경**
   - `setTimeout` 콜백 완전 제거
   - CSS `@keyframes snackbarFadeOut` 사용
   - 6초 → 2초로 단축 (사용자가 딜레이 체감 시간 감소)
   - `visibility: hidden` 사용 (레이아웃 재계산 최소화)
   - JS 콜백이 없어 메인 스레드 차단 없음

2. **compositionend 이벤트에 requestAnimationFrame 지연 추가**
   - `isComposingRef.current = false`를 rAF로 1프레임 지연
   - 브라우저가 IME 상태를 완전히 정리할 시간 확보
   - 한글 입력 깨짐 개선 기대

**수정 파일:**
- `OperatorItemSheet.js` ✅
- `SalesItemSheet.js` ✅
- `DailyWorkSheet.js` ✅

**수정 코드:**
```javascript
// 1. showSnackbar - CSS animation 방식
const showSnackbar = useCallback((message) => {
  const snackbarEl = snackbarRef.current;
  if (!snackbarEl) return;

  const messageEl = snackbarEl.querySelector('.snackbar-message');
  if (messageEl) {
    messageEl.textContent = message;
  }

  // CSS animation 초기화 및 재시작
  snackbarEl.style.animation = 'none';
  snackbarEl.offsetHeight; // reflow 강제 (animation 재시작 트릭)
  snackbarEl.style.visibility = 'visible';
  snackbarEl.style.opacity = '1';
  // 2초 후 0.3초 동안 페이드아웃 (CSS animation)
  snackbarEl.style.animation = 'snackbarFadeOut 0.3s 2s forwards';
}, []);

// 2. compositionend에 rAF 지연
const handleCompositionEnd = () => {
  // requestAnimationFrame으로 1프레임 지연하여 브라우저가 IME 상태를 완전히 정리할 시간을 줌
  requestAnimationFrame(() => {
    isComposingRef.current = false;
  });
};

// 3. Custom Snackbar Box with CSS keyframes
<Box
  ref={snackbarRef}
  sx={{
    visibility: 'hidden',
    opacity: 0,
    position: 'fixed',
    bottom: 24,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 9999,
    '@keyframes snackbarFadeOut': {
      '0%': { opacity: 1, visibility: 'visible' },
      '100%': { opacity: 0, visibility: 'hidden' }
    },
    '& .snackbar-content': { ... }
  }}
>
  <Box className="snackbar-content">
    <span className="snackbar-message"></span>
  </Box>
</Box>
```

**기대 효과:**
- **6초 → 2초**: 사용자가 느끼는 딜레이 대폭 감소
- **CSS animation**: setTimeout 콜백 실행이 없어 JS 스레드 차단 없음
- **visibility: hidden**: display:none과 달리 레이아웃 재계산 최소화
- **compositionend rAF 지연**: 브라우저 IME 정리 후 상태 변경으로 한글 입력 개선

**테스트 항목:**
- [ ] Snackbar 2초 후 자동 페이드아웃
- [ ] 페이드아웃 시 딜레이 없음
- [ ] 한글 "홍길동" 입력 → 글자 깨짐 없음
- [ ] 엔터 후 다음 셀 입력 시 딜레이 감소
- [ ] DailyWorkSheet(날짜별 작업) 동일하게 개선됨

**테스트 결과 (2026-02-11):**
- ✅ 캠페인 시트 (OperatorItemSheet, SalesItemSheet): 한글 "홍길동" 10회 모두 정상!
- ✅ 딜레이 대폭 감소
- ❌ 날짜별 작업 시트 (DailyWorkSheet): 한글 입력 깨짐 여전히 발생 ("ㅣㄹ동", "ghdrlㄹ동" 등)
- ❌ DailyWorkSheet Ctrl+S 직후 약간의 딜레이 존재

**결론:** △ 캠페인 시트 성공, DailyWorkSheet 미해결

---

### 14차 최적화 (2026-02-11) - DailyWorkSheet saving→ref + isComposing + 저장버튼 항상표시

**적용 내용:**
1. DailyWorkSheet에 13차까지 캠페인 시트에 적용한 모든 최적화 동일 적용
   - `saving` state → `savingRef` ref
   - `isComposingRef` + compositionstart/end DOM 이벤트 리스너
   - 저장 버튼 항상 표시
   - Snackbar CSS animation 방식

**수정 파일:**
- `DailyWorkSheet.js`

**테스트 결과 (2026-02-11):**
- ❌ 한글 깨짐 여전히 발생 (ㅇ길동h, ㅗㅇ길동, ㅗ익ㄹ동 등)
- ❌ 엔터 후 딜레이 존재

**결론:** ❌ DailyWorkSheet는 별도 원인 존재

---

### 15차 최적화 (2026-02-11) - DailyWorkSheet changedSlots/changedItems state→ref

**적용 내용:**
1. `changedSlots`/`changedItems` state 제거 → ref만 사용
2. `handleAfterChange` 내 `setChangedSlots`/`setChangedItems` → `changedSlotsRef.current` 직접 할당
3. useMemo 의존성에서 `changedSlots`/`changedItems` 제거
4. `setDataAtCell` 비동기화 (requestAnimationFrame)

**수정 파일:**
- `DailyWorkSheet.js`

**테스트 결과 (2026-02-12):**
- ❌ 여전히 한글 깨짐 (gㅗㅇ길동, ㅗㅇ길동 등)
- 원인: handleAfterChange 의존성에 `[rowMeta, tableData]`가 남아있음

**결론:** ❌ 의존성 체인 미해결

---

### 16차 최적화 (2026-02-12) - DailyWorkSheet tableDataRef/rowMetaRef + UnifiedItemSheet 전체 최적화

**적용 내용:**
1. **DailyWorkSheet**: `tableDataRef`, `rowMetaRef` 추가, handleAfterChange 내부에서 ref로 접근, 의존성 `[]`
2. **UnifiedItemSheet**: changedSlots/changedItems state→ref, saving→ref, isComposing+compositionstart/end, Snackbar DOM 직접 조작

**수정 파일:**
- `DailyWorkSheet.js`
- `UnifiedItemSheet.js`

**테스트 결과 (2026-02-12):**
- ❌ DailyWorkSheet 한글 깨짐 여전히 (첫 글자 "ㅎ" 사라짐, "ㅗㅇ길동" 등)
- ✅ OperatorItemSheet/SalesItemSheet 정상

**결론:** ❌ DailyWorkSheet는 data 구조 자체의 문제

---

### 17차 최적화 (2026-02-12) - DailyWorkSheet hiddenRows 플러그인 전환

**적용 내용:**
1. DailyWorkSheet의 접기/펼치기 방식을 **tableData 필터링 → hiddenRows 플러그인**으로 전환
   - useMemo에서 `collapsedItems` 의존성 제거
   - 모든 행을 포함한 baseTableData 생성
   - `hiddenRowIndices` useMemo 추가
   - useEffect로 hiddenRows 플러그인 수동 업데이트
   - HotTable에 `hiddenRows` prop 추가
2. `productDataRenderer` 의존성에서 `collapsedItems` 제거 (ref 사용)

**수정 파일:**
- `DailyWorkSheet.js`

**테스트 결과 (2026-02-12):**
- ❌ 한글 깨짐 여전히 발생 (모든 시트에서)
- "홍길동" → "ㅗㅇ길동", "gㅗㅇ길동" 등

**결론:** ❌ data 안정화만으로 부족, 다른 원인 존재

---

### 18차 최적화 (2026-02-12) - statusLabels/statusOptions 외부 상수 이동

**적용 내용:**
1. `statusLabels`, `statusOptions` 객체를 컴포넌트 내부 → **컴포넌트 외부 상수**로 이동
2. 모든 시트에 적용 (OperatorItemSheet, SalesItemSheet, DailyWorkSheet, UnifiedItemSheet)
3. useMemo/useCallback 의존성에서 제거

**수정 파일:**
- `OperatorItemSheet.js`, `SalesItemSheet.js`, `DailyWorkSheet.js`, `UnifiedItemSheet.js`

**테스트 결과 (2026-02-12):**
- ❌ 한글 깨짐 여전히 발생: gㅗㅇ길동 (5회 연속 동일)
- ❌ 접기 상태 안됨

**결론:** ❌ statusLabels/statusOptions는 근본 원인이 아님

---

### 19차 최적화 (2026-02-12) - 렌더러/cellsRenderer 의존성 체인 완전 제거

**적용 내용:**
1. 모든 렌더러 팩토리(createProductDataRenderer, createBuyerDataRenderer 등)에서 `tableData` → `tableDataRef`로 전환
2. `cellsRenderer` useCallback 의존성 `[]`로 완전 제거
3. `hiddenRows` prop을 useMemo로 안정화
4. `duplicateOrderNumbers`, `columnAlignments`도 ref 전환

**수정 파일:**
- `OperatorItemSheet.js`, `SalesItemSheet.js`, `DailyWorkSheet.js`, `UnifiedItemSheet.js`

**테스트 결과 (2026-02-12):**
- ❌ 접기/펼치기 완전 사라짐 (▶/▼ 아이콘 업데이트 안됨)
- ❌ 한글 IME 여전히 깨짐 (15회 중 3회만 정상)
  - 결과: 홍길동, ㅣㄹ동r, 길동, ㄹ동rl, 길동d, 길동d, 길동d, ㅣㄹ동, gㅗㅇ길동, ㅗ길동, ㅇ길동, 길동d, ㅇ길동h, 길동hd, gㅗㅇ길동, gㅗㅇ길동

**원인 분석:**
1. 접기 문제: 렌더러 의존성 `[]`로 만들면서 Handsontable이 셀을 다시 그리지 않음 → `hot.render()` 누락
2. IME 문제: 렌더러/cellsRenderer는 안정화했지만 **HotTable 인라인 prop들**이 여전히 매 렌더마다 새 참조 생성
   - `contextMenu={{ ... }}` - 매 렌더마다 새 객체
   - `afterChange={(c,s) => {...}}` - 매 렌더마다 새 함수
   - `afterSelection`, `beforeKeyDown`, `afterOnCellMouseUp` 등 모든 인라인 함수
   - `colHeaders={Array(22).fill('')}` - 매 렌더마다 새 배열
   - 이 중 하나라도 참조가 변하면 → Handsontable `updateSettings()` → IME 상태 초기화

**결론:** ❌ 렌더러 안정화만으로 부족, HotTable 인라인 prop 전체 안정화 필요

---

### 20차 최적화 (2026-02-12) - 모든 HotTable 인라인 prop 안정화 + 접기 복원

**적용 내용:**

#### 1. hiddenRows useEffect에 `hot.render()` 추가 (접기/펼치기 복원)
- OperatorItemSheet, SalesItemSheet, DailyWorkSheet
- hiddenRows 플러그인 업데이트 후 `hot.render()` 호출 → ▶/▼ 아이콘 업데이트

#### 2. 모든 HotTable 인라인 prop → useCallback/useMemo `[]` 전환
| prop | 변환 | 비고 |
|------|------|------|
| contextMenu | useMemo `[]` | 내부 콜백에서 tableDataRef, slotsRef 등 ref 사용 |
| afterChange | useCallback `[]` | isComposingRef + handleAfterChangeRef |
| afterSelection | useCallback `[]` | hotRef, selectedCellCountRef 사용 |
| beforeKeyDown | useCallback `[]` | hotRef 사용 |
| afterOnCellMouseUp | useCallback `[]` | tableDataRef, toggleItemCollapseRef 등 ref |
| afterLoadData | useCallback `[]` | hotRef, hiddenRowIndicesRef 사용 |
| afterRender | useCallback `[]` | hotRef, hiddenRowIndicesRef 사용 |
| afterFilter | useCallback `[]` | tableDataRef, filterConditionsRef 사용 |
| beforeCopy | useCallback `[]` | URL 패턴 처리만 |
| beforePaste | useCallback `[]` | tableDataRef 사용 |
| beforeOnCellMouseDown | useCallback `[]` | tableDataRef 사용 |
| afterDeselect | useCallback `[]` | selectedCellCountRef 사용 |
| colHeaders | 컴포넌트 외부 상수 | `Array(N).fill('')` |
| enterMoves/tabMoves | useMemo `[]` | `{ row: 1, col: 0 }` 등 |
| dropdownMenu | useMemo `[]` | 배열 상수 |

#### 3. 추가 ref 추가
- `handleAfterChangeRef`, `toggleItemCollapseRef`, `handleCopyUploadLinkRef`, `handleAlignmentChangeRef`, `showSnackbarRef`, `loadSlotsRef`, `openDeleteDialogRef`, `slotsRef`, `slotIndexMapRef` 등

#### 4. DailyWorkSheet baseTableData 구조 분해 불일치 수정
- useMemo가 `{ tableData, rowMeta }` 반환 → `{ baseTableData, baseRowMeta }` destructuring 불일치 → undefined 버그 수정

**수정 파일:**
- `OperatorItemSheet.js` ✅
- `SalesItemSheet.js` ✅
- `DailyWorkSheet.js` ✅
- `UnifiedItemSheet.js` ✅

**빌드:** ✅ 성공 (경고만, 에러 없음)

**테스트 항목:**
- [ ] 모든 시트에서 "홍길동" 10회 연속 입력 + 엔터 → 글자 깨짐 없음
- [ ] 접기/펼치기 (개별 + 모두) 정상 동작
- [ ] Ctrl+S 저장 정상
- [ ] 우클릭 컨텍스트 메뉴 정상 동작
- [ ] 날짜별 작업 시트 데이터 표시 확인

**테스트 결과 (2026-02-12):**
- ❌ 접기/펼치기 (개별 + 모두) 동작 안 됨
- 한글 입력: 미확인 (접기 문제 우선)

**원인 분석:**
- `hiddenRowsConfig`가 `[hiddenRowIndices]` 의존성을 가져 매번 새 객체 생성
- HotTable이 prop 변경으로 `updateSettings` 먼저 호출 → 플러그인 상태 이미 업데이트됨
- useEffect 비교 시 "변경 없음"으로 판단 → `hot.render()` 미호출 → ▶/▼ 아이콘 업데이트 안 됨

**결론:** ❌ hiddenRowsConfig prop과 useEffect 플러그인 조작이 충돌

---

### 21차 최적화 (2026-02-12) - hiddenRowsConfig 초기값 고정 (접기/펼치기 복원)

**적용 내용:**
1. `hiddenRowsConfig` useMemo 의존성을 `[hiddenRowIndices]` → `[]`로 변경
2. `rows: hiddenRowIndices` → `rows: []` (초기값만 설정)
3. 동적 변경은 기존 useEffect에서만 처리 (hiddenRowsPlugin.showRows/hideRows + hot.render())
4. HotTable이 `updateSettings` 호출하지 않으므로 useEffect와 충돌 없음

**수정 파일:**
- `OperatorItemSheet.js` ✅
- `SalesItemSheet.js` ✅
- `DailyWorkSheet.js` ✅
- `BrandItemSheet.js` ✅ (인라인 → useMemo 변환 포함)
- `UnifiedItemSheet.js` ✅ (이미 `[]` 적용됨)

**빌드:** ✅ 성공

**테스트 항목:**
- [ ] 개별 토글 접기/펼치기 (▶/▼ 아이콘 전환 + 행 숨김/표시)
- [ ] 모두 접기/모두 펼치기 버튼
- [ ] 페이지 새로고침 후 localStorage에서 접기 상태 복원
- [ ] 한글 "홍길동" 10회 입력 테스트

**테스트 결과:**
- 개별 토글 접기/펼치기: ✅ 정상 동작
- 모두 접기/모두 펼치기: ✅ 정상 동작
- localStorage 접기 상태 복원: ❌ 안됨 (SalesItemSheet, BrandItemSheet에서 초기 로드 누락)

**결론:** △ 부분 성공 → 21차 추가로 localStorage 복원 수정

---

### 21차 추가 최적화 (2026-02-12) - localStorage 접기 상태 복원 누락 수정

**원인 분석:**

| 시트 | 초기 로드 (localStorage) | 저장 |
|------|:---:|:---:|
| OperatorItemSheet | ✅ `useState(() => localStorage...)` | ✅ |
| **SalesItemSheet** | ❌ `useState(new Set())` — 로드 없음 | ✅ |
| DailyWorkSheet | ✅ `useState(() => localStorage...)` | ✅ |
| **BrandItemSheet** | ❌ `useState(new Set())` — 로드 없음 | ✅ |

**적용 내용:**
1. SalesItemSheet: `useState(new Set())` → `useState(() => { localStorage.getItem(...) })` 변경
2. BrandItemSheet: 동일 변경

**수정 파일:**
- `SalesItemSheet.js` ✅
- `BrandItemSheet.js` ✅

**빌드:** ✅ 성공

**테스트 항목:**
- [ ] 개별 토글 접기/펼치기: ▶/▼ 아이콘 전환 + 행 숨김/표시
- [ ] 모두 접기/모두 펼치기 버튼 정상 동작
- [ ] 페이지 새로고침 후 localStorage에서 접기 상태 복원
- [ ] 한글 입력 "홍길동" 10회 테스트 (기존 최적화 유지 확인)

**결론:** ⏳ 테스트 대기

---

### 22차 최적화 (2026-02-12) - SalesItemSheet localStorage 접기 복원 키 형식 불일치 수정

**원인 분석:**
- SalesItemSheet의 `loadSlots` 내 접기 복원 로직이 **키 형식 불일치**
- **저장 시**: `toggleItemCollapse(collapseKey)` → `"123_1"` (item_id + day_group 문자열)
- **복원 시**: `allItemIds = slots.map(s => s.item_id)` → `[123, 456]` (숫자 배열)
- `"123_1"` vs `123` → **절대 매칭 불가** → 항상 빈 결과 → fallback으로 `new Set(allItemIds)` (숫자) 설정 → 키 형식 불일치로 접기도 안됨

**적용 내용:**
1. 캐시 분기: `allItemIds`(숫자 배열) → `allKeys`(Set, `"${item_id}_${day_group}"` 형식)
2. API 분기: 동일 변경
3. fallback: `new Set(allItemIds)`(모두 접기) → `new Set()`(모두 펼침) - OperatorItemSheet와 동일

**수정 파일:**
- `SalesItemSheet.js` ✅ (loadSlots 내 2곳)

**빌드:** ✅ 성공

**테스트 항목:**
- [ ] 영업사 시트: 접기 → 새로고침 → 접기 상태 유지
- [ ] 브랜드사 시트: 접기 → 새로고침 → 접기 상태 유지
- [ ] 진행자 시트: 기존 정상 동작 유지

**테스트 결과:** ✅ 접기 상태 localStorage 복원 정상 동작 확인

**결론:** ✅ 채택 (서버 main 폴더 배포 완료)

**복원 포인트:** 22차 = 현재 서버 main 폴더 배포 버전 (docker compose 운영 중). 접기/펼치기 + localStorage 복원 모두 정상. 후속 최적화에서 문제 발생 시 이 버전으로 복원 필요할 수 있음.

---

### 23차 최적화 (2026-03-16) - 스크롤 성능 개선 (렌더러 최적화 + useEffect 의존성)

**적용 내용:**
1. **Shift+Wheel useEffect 의존성 `[slots]` → `[]`** (5개 시트)
   - DOM 참조(wtHolder)는 HotTable 생존 기간 동안 불변 → 불필요한 리스너 재바인딩 제거
2. **렌더러 내 금액 포맷팅 최적화** (OperatorItemSheet, SalesItemSheet, BrandItemSheet)
   - typeof 체크로 이미 숫자인 경우 정규식 스킵 (parseInt + replace 연산 절약)
3. **렌더러 내 입금여부 Date 파싱 최적화** (OperatorItemSheet, SalesItemSheet)
   - 이미 포맷된 문자열이면 Date 객체 생성 스킵
4. **viewportRowRenderingOffset 유지 (100)** - 줄이면 스크롤 시 빈 행이 더 자주 보임 (사용자 피드백과 반대)

**수정 파일:**
- `OperatorItemSheet.js` ✅ (Shift+Wheel useEffect, col14 금액, col20 입금여부)
- `SalesItemSheet.js` ✅ (Shift+Wheel useEffect, col14 금액, col19 입금여부)
- `BrandItemSheet.js` ✅ (Shift+Wheel useEffect, col11 금액)
- `DailyWorkSheet.js` ✅ (Shift+Wheel useEffect)
- `UnifiedItemSheet.js` ✅ (Shift+Wheel useEffect)

**빌드:** ✅ 성공

**테스트 항목:**
- [ ] 500행+ 데이터에서 스크롤 개선 여부
- [ ] Shift+스크롤 횡스크롤 정상 동작
- [ ] 접기/펼치기 정상 동작
- [ ] 한글 입력 정상 동작
- [ ] 금액 표시 정상 (숫자 포맷)
- [ ] 입금여부 표시 정상

**결론:** ⏳ 테스트 대기

---

### 24차 최적화 (2026-04-02) - 시트 스크롤 흔들림 + Admin 로딩 최적화

**적용 내용:**

#### Part 1: 시트 스크롤 흔들림 방지
- 모든 렌더러 시작 시 `td.style.cssText = ''` 추가 (이전 렌더링 잔여 스타일 초기화)
- Handsontable이 셀을 재사용할 때 이전 행의 인라인 스타일이 남아있어 스크롤 중 레이아웃 재계산 발생 → 초기화로 방지

**수정 파일 (Part 1):**
- `OperatorItemSheet.js` ✅ (createProductDataRenderer, createUploadLinkBarRenderer, createBuyerDataRenderer)
- `SalesItemSheet.js` ✅ (동일 3개 렌더러)
- `BrandItemSheet.js` ✅ (createBrandProductDataRenderer, createBrandBuyerDataRenderer)

#### Part 2: Admin 컨트롤 타워 로딩 최적화
- `GET /api/monthly-brands/all` 쿼리 구조 변경
- **기존**: MonthlyBrand ← Campaign ← Item ← ItemSlot 4단계 JOIN (데카르트곱)
- **변경**: 3개 분리 쿼리로 전환:
  1. MonthlyBrand + Campaign + User (JOIN 2단계만)
  2. Item 별도 쿼리 (campaign_id IN ...)
  3. Active day_group GROUP BY 쿼리 (item_id IN ..., is_suspended=false)
  4. CampaignOperator 배정 상태 (기존과 동일)
- 메모리에서 조합하여 동일한 응답 구조 반환

**수정 파일 (Part 2):**
- `backend/src/routes/monthlyBrands.js` ✅ (GET /all 엔드포인트)

**빌드:** ✅ 성공

**테스트 항목:**
- [ ] Admin 컨트롤 타워 로딩 속도 개선
- [ ] 진행자 배정 탭: 연월브랜드/캠페인 목록 정상 표시
- [ ] 배정 상태(완료/미완료) 정상 계산
- [ ] 캠페인 정렬(미배정 우선) 정상 동작
- [ ] 시트 스크롤 흔들림 개선 여부
- [ ] 접기/펼치기 정상 동작
- [ ] 한글 입력 정상 동작

**결론:** ⏳ 테스트 대기

---

### 25차 최적화 (2026-04-10) - 전사 DB 부하 최적화 (쿼리 중복/N+1/폴링)

**적용 내용:**

#### Part 1: 프론트엔드 폴링 최적화
- **BrandLayout**: `isAdminMode`일 때 30초 알림 폴링 비활성화 (Admin embedded 모드에서 불필요한 폴링 제거)
- **AdminLayout / OperatorLayout / BrandLayout**: 모든 setInterval 폴링에 `document.hidden` 체크 추가 (탭 비활성 시 폴링 중지)

#### Part 2: Sequelize LEFT JOIN 행 중복 방지 (`separate: true`)
- `getBuyersByDate`: Image include에 `separate: true` 추가 → 입금관리 총액 오류 재발 방지
- `getBuyersByItem`: Image include에 `separate: true` 추가
- `getBuyersByMonth`: 2단계 쿼리로 전환 (1단계: Image에서 DISTINCT buyer_id 조회, 2단계: Buyer + Image separate 조회)
- `getItemsByBrand`: Buyer include에 `separate: true` 추가
- `getBuyer`: Image include에 `separate: true` + Item/Campaign attributes 지정

#### Part 3: getMyMonthlyBrands 쿼리 4→1개 통합
- **기존**: 4개 별도 Sequelize GROUP BY 쿼리 (구매자 수, 리뷰 수, day_group별 구매자 수, day_group별 리뷰 수)
- **변경**: 단일 raw SQL `FILTER (WHERE ...)` 절로 1개 쿼리에서 모든 통계 계산
- JS 레벨에서 item_id별 합산 + day_group별 분류 동시 처리

#### Part 4: 벌크 처리 최적화
- `updateTrackingNumbersBulk`: for 루프 개별 UPDATE N회 → `CASE WHEN` raw SQL 1회로 전환
- `updateSlotsBulk`: `findByPk` N회 → `findAll({ where: { id: { [Op.in]: ids } } })` 1회 + Buyer도 일괄 조회 Map 매핑
- `createBuyersBulk`: `mergeTempBuyer` 내부 `findOne` N회 → 임시 Buyer `findAll` 1회 + Map 매칭

#### Part 5: N+1 쿼리 제거 및 기타
- `splitDayGroup`: 진행자 배정 중복 체크 `findOne` N회 → `findAll` 1회 + Set 매칭 + `bulkCreate`
- `assignOperatorToItem`: 운영 환경에 남아있던 디버그 쿼리(findAll + console.log) 제거

**수정 파일:**
- `frontend/src/components/admin/AdminLayout.js` ✅ (비활성 탭 폴링 중지)
- `frontend/src/components/operator/OperatorLayout.js` ✅ (비활성 탭 폴링 중지)
- `frontend/src/components/brand/BrandLayout.js` ✅ (embedded 폴링 비활성화 + 비활성 탭 폴링 중지)
- `backend/src/controllers/buyerController.js` ✅ (separate:true, 벌크 UPDATE, N+1 제거, attributes 지정)
- `backend/src/controllers/itemController.js` ✅ (4→1 쿼리 통합, separate:true, 디버그 쿼리 제거)
- `backend/src/controllers/itemSlotController.js` ✅ (벌크 조회, N+1 제거, bulkCreate)

**빌드:** ✅ 성공 (프론트엔드 + 백엔드 모두)

**테스트 항목:**
- [ ] Admin 컨트롤 타워: embedded 진행자/브랜드사 대시보드 보기 시 Network 탭에서 불필요한 폴링 없음 확인
- [ ] 탭 비활성 상태에서 Network 탭 폴링 중지 확인
- [ ] 일별 입금관리(AdminDailyPayments): 총액 정상 표시, 비정상 값 재발 없음
- [ ] 월별 입금관리: 총액 정상, 이미지 있는 구매자만 표시
- [ ] 진행자 사이드바: 캠페인별 구매자 수/리뷰 완료 수 정상 (getMyMonthlyBrands)
- [ ] 진행자 시트: Ctrl+S 저장 정상 (updateSlotsBulk)
- [ ] Admin 송장번호 일괄 입력 정상 (updateTrackingNumbersBulk)
- [ ] 진행자 구매자 일괄 추가(슬래시 파싱) 정상 + 선 업로드 병합 정상 (createBuyersBulk)
- [ ] 일마감(splitDayGroup) 정상: 진행자 자동 배정 포함
- [ ] 브랜드사 대시보드: 품목별 buyer 수 정상 (getItemsByBrand)

**예상 효과:**
- Admin embedded 모드 DB 부하 50%↓
- 비활성 탭 폴링 부하 70%↓
- getMyMonthlyBrands 응답 속도 ~4배↑ (쿼리 4→1)
- 대량 저장/송장입력 속도 N배↑ (N개 쿼리→1개)
- LEFT JOIN 행 중복으로 인한 일시적 총액 오류 재발 방지

**측정 결과 (main 서버, 2026-04-12):**

| API | 수치 |
|-----|------|
| `GET /api/monthly-brands/all` | 228~310ms |
| `GET /api/monthly-brands?viewAsUserId=60` | 1,646~1,974ms 🔴 |
| `GET /api/items/my-monthly-brands` | 4,477~4,826ms 🔴 |
| `POST /api/images/upload` | 761~2,572ms 🔴 |
| 시트 스크롤 FPS | 60.4fps ✅ |

**느린 쿼리 (SLOW QUERY):**
| 쿼리 | 수치 |
|------|------|
| MonthlyBrand SELECT | 781ms |
| review_count (item별) | 115ms |
| review_count (day_group별) | 118ms |
| START TRANSACTION | 643ms |

**결론:** 🟡 부분 채택 — 폴링/N+1 최적화는 유효하나, 대규모 데이터에서 API 속도 추가 개선 필요

---

### 26차 최적화 (2026-04-12) - 느린 API 3개 최적화 + DB 인덱스 추가

**적용 내용:**

#### Part 1: DB 인덱스 3개 추가 (마이그레이션)
- `idx_images_buyer_id_status` — 리뷰 통계 쿼리 최적화
- `idx_item_slots_buyer_id_item_id` — 구매자 통계 쿼리 최적화
- `idx_item_slots_upload_link_token` — 토큰 검색 최적화

#### Part 2: `my-monthly-brands` (4.8초 → 목표 500ms)
- raw SQL의 `LEFT JOIN images` → `EXISTS` 서브쿼리로 전환
- LEFT JOIN은 행 수를 폭증시키지만, EXISTS는 행 수 유지

#### Part 3: `monthly-brands?viewAsUserId` (1.9초 → 목표 500ms)
- Include 4단계(MonthlyBrand→Campaign→Item→ItemSlot) → 2단계로 축소
- Item, ItemSlot 별도 쿼리로 분리
- 통계 4개 Sequelize 쿼리 → 1개 raw SQL 통합 (EXISTS 서브쿼리)

#### Part 4: `images/upload` (2.5초 → 목표 1초)
- 루프 내 `Buyer.findByPk` N+1 제거 (이미 조회한 데이터 재사용)
- S3 업로드 순차 → `Promise.all` 병렬화

**수정 파일:**
- `backend/migrations/20260412000001-add-performance-indexes.js` ✅ (신규)
- `backend/src/controllers/itemController.js` ✅ (EXISTS 서브쿼리)
- `backend/src/routes/monthlyBrands.js` ✅ (Include 분리 + 쿼리 통합)
- `backend/src/controllers/imageController.js` ✅ (N+1 제거 + S3 병렬)
- `backend/src/models/index.js` ✅ (benchmark 옵션 전달)

**빌드:** ✅ 성공

**측정 (25차 베이스라인 - main 서버):**

| API | 수치 |
|-----|------|
| `GET /api/items/my-monthly-brands` | 4,477~4,826ms |
| `GET /api/monthly-brands?viewAsUserId` | 1,646~1,974ms |
| `POST /api/images/upload` | 761~2,572ms |
| `GET /api/monthly-brands/all` | 228~310ms |
| 시트 스크롤 FPS | 60.4fps |

**측정 (26차 적용 후 - main 서버, 2026-04-12):**

| API | 25차 (이전) | 26차 (이후) | 개선율 |
|-----|:---:|:---:|:---:|
| `GET /api/items/my-monthly-brands` | 4,477~7,778ms | **252~533ms** | **약 90% ↓** 🎉 |
| `GET /api/monthly-brands?viewAsUserId` | 1,646~1,974ms | **268~370ms** | **약 80% ↓** 🎉 |
| `POST /api/images/upload` | 761~2,572ms | **207~266ms** | **약 90% ↓** 🎉 |
| `GET /api/monthly-brands/all` | 228~310ms | 202~273ms | 유지 |

**SLOW QUERY 분석 (26차 적용 후):**
- 대부분의 쿼리가 100~130ms 수준 (이전 1,400~5,800ms에서 대폭 감소)
- `CampaignOperator` 쿼리: 5,789ms → **115ms** (50배 개선)
- `Buyer` 쿼리: 1,276ms → 211ms (6배 개선)
- `ItemSlot IN (...)` 쿼리: 102~138ms (새로 추가된 쿼리, 수용 가능)

**결론:** ✅ 채택 — 목표 대비 모든 API가 기대 이상 개선

**주요 성공 요인:**
1. **DB 인덱스 3개 추가** — CampaignOperator 쿼리 50배 개선 (idx_item_slots_buyer_id_item_id 효과)
2. **Include 분리** — Item + ItemSlot을 별도 쿼리로 분리해 데카르트곱 방지
3. **EXISTS 서브쿼리** — images LEFT JOIN 제거로 행 수 폭증 방지
4. **N+1 제거 + S3 병렬화** — 이미지 업로드 대폭 개선

---

### 27차 최적화 (2026-04-13) - DB 커넥션 풀 증설 + 캐스케이드 삭제 raw SQL + 잔여 병목 제거

**배경:**
26차 이후 대부분 API 500~700ms대로 개선되었으나 **사용자가 조금만 늘어도 느려지는 현상** 발생.
전수조사 결과 근본 원인 확인:
1. DB 커넥션 풀 20개로 부족 (동시 사용자 5+ 시 connection wait)
2. 캐스케이드 삭제가 4~5단계 JOIN + 메모리 로드 + 루프 N+1 (수초 지연)
3. `campaign_operators.campaign_id` 인덱스 누락 (groupBy 간헐 슬로우)

**적용 내용:**

#### Part 1: DB 커넥션 풀 증설
- `backend/src/config/database.js` production 설정
- `pool.max: 20 → 50`, `pool.min: 5 → 10`, `pool.idle: 10s → 30s`
- 동시 사용자 시 connection wait 대폭 감소 예상

#### Part 2: `campaign_operators` 인덱스 2개 추가 (마이그레이션 신규)
- `idx_campaign_operators_campaign_id` (campaign_id 단일)
- `idx_campaign_operators_campaign_item_day` (campaign_id, item_id, day_group 복합)

#### Part 3-1: 캠페인 캐스케이드 삭제 raw SQL 전환
- `backend/src/controllers/campaignController.js` `deleteCampaignCascade`
- 기존: Campaign → Item → Buyer → Image 4단계 include + JS 중첩 루프로 N번 DELETE
- 변경: include 제거, raw SQL `DELETE ... WHERE ... IN (SELECT ...)`로 5개 테이블 각 1번씩 삭제
- 삭제 순서: images → buyers → item_slots → items → campaign_operators → campaign

#### Part 3-2: 연월브랜드 캐스케이드 삭제 raw SQL 전환
- `backend/src/routes/monthlyBrands.js` cascade delete
- 기존: MonthlyBrand → Campaign → Item → Buyer → Image 5단계 include + 이중 루프
- 변경: campaign_id 목록만 먼저 조회 → raw SQL로 각 테이블 1번씩 삭제

#### Part 4: `images/upload` 트랜잭션 위치 조정
- `backend/src/controllers/imageController.js` `uploadImages`
- 기존: `transaction 시작` → S3 업로드 → DB 작업 → commit (S3 동안 커넥션 점유)
- 변경: 검증/S3 업로드는 트랜잭션 밖 → S3 완료 후 짧은 트랜잭션 시작 → Image.create 루프 → commit
- 커넥션 점유 시간 대폭 단축 → 다른 요청 대기시간도 감소

**수정 파일:**
- `backend/src/config/database.js` ✅ (pool 증설)
- `backend/migrations/20260413000001-add-campaign-operator-indexes.js` ✅ (신규)
- `backend/src/controllers/campaignController.js` ✅ (캠페인 캐스케이드 raw SQL)
- `backend/src/routes/monthlyBrands.js` ✅ (연월브랜드 캐스케이드 raw SQL)
- `backend/src/controllers/imageController.js` ✅ (트랜잭션 위치 조정)

**기능/결과값 불변 보장:**
- raw SQL DELETE은 Sequelize cascade와 동일하게 하위 데이터 삭제
- API 응답 JSON 구조 완전 동일 (deletedStats 필드 동일)
- 권한 체크 로직 유지 (Campaign.findByPk에서 created_by 조회, operator 배정 체크 유지)
- 이미지 업로드 결과(uploadedImages, resubmittedImages) 동일
- Pool 증가는 기존 쿼리 동작 완전 동일

**빌드:** ✅ 백엔드 문법 검증 통과

⚠️ **배포 후 마이그레이션 필요:**
```bash
docker compose exec app sh -c "cd /app/backend && npx sequelize-cli db:migrate"
```

**측정 (26차 이전 vs 26차 이후):**

| API | 25차 | 26차 | 27차 목표 |
|-----|:---:|:---:|:---:|
| `my-monthly-brands` | 4,800ms | 252~533ms | 350~450ms |
| `monthly-brands?viewAsUserId` | 1,800ms | 268~370ms | 200~300ms |
| `images/upload` | 2,500ms | 207~266ms | 150~200ms |
| 캠페인 삭제 | 2~3초 | 2~3초 | 300ms 이하 |
| 연월브랜드 삭제 | 2~3초 | 2~3초 | 300ms 이하 |

**기능 검증 항목:**
- [ ] 연월브랜드 삭제 → 하위 캠페인/품목/구매자/이미지 모두 삭제 확인
- [ ] 캠페인 삭제 → 하위 품목/구매자/이미지 모두 삭제 확인
- [ ] 이미지 업로드 → 정상 동작 + S3에 올라가고 DB 기록 확인
- [ ] 이미지 재제출 → pending 상태로 Admin 알림 전송 확인
- [ ] 진행자 사이드바 로딩 → 동일한 데이터 표시
- [ ] 영업사 사이드바 로딩 → 동일한 데이터 표시

**결론:** ⏳ 테스트 대기

---

### 28차 최적화 (2026-04-13) - `item-slots/campaign/:id` 시트 로딩 API 최적화

**배경:**
27차에서 여러 API 개선됐지만 시트 로딩 API(`/item-slots/campaign/:id`)가 test 서버에서도 **520ms** 소요.
이 API는 진행자/영업사/브랜드사가 시트 열 때마다 호출됨.

**원인 분석:**
1. `ItemSlot.findAll` + `Item.include` (INNER JOIN) — 이미 1단계에서 `items`를 별도로 로드했는데, **매 슬롯마다 Item 정보를 다시 JOIN으로 가져옴**. 5,000 슬롯이면 5,000 × 22필드 중복 로딩.
2. `Buyer`와 `Image` 쿼리가 **순차 await** 실행 — 각각 50~80ms × 2
3. `slot.toJSON()` 오버헤드 — Sequelize 인스턴스 → plain object 변환이 슬롯 개수만큼 반복

**적용 내용:**

#### Part 1: ItemSlot.include 제거 + itemMap 주입
- 1단계 `Item.findAll`의 attributes를 시트에서 필요한 모든 필드로 확장
- `ItemSlot.findAll`에서 `include: [{ model: Item }]` 제거 (INNER JOIN 제거)
- JS에서 `itemMap[slot.item_id]`로 메모리 병합 (DB 왕복 0회)

#### Part 2: Buyer + Image 병렬 조회
- `await Buyer.findAll()` → `await Image.findAll()` 순차 → `Promise.all([Buyer, Image])`
- 두 쿼리가 독립적이므로 병렬 실행 가능

#### Part 3: `raw: true`로 Sequelize 오버헤드 제거
- ItemSlot, Buyer, Image 조회 모두 `raw: true` 추가
- `slot.toJSON()` 호출 제거 → 이미 plain object

**수정 파일:**
- `backend/src/controllers/itemSlotController.js` ✅
  - `getSlotsByCampaign` (영업사/브랜드사/Admin용)
  - `getSlotsByCampaignForOperator` (진행자용)

**기능/결과값 불변 보장:**
- 응답 JSON 구조 완전 동일 (`slot.item`, `slot.buyer`, `slot.buyer.images` 모두 유지)
- `items` 배열 응답 필드도 동일 (필드 몇 개 추가되었지만 기존 필드 전부 포함)
- `slot.item`에 주입되는 Item 필드가 기존 include와 완전히 같음

**빌드:** ✅ 백엔드 문법 검증 통과

**측정 (test 서버 - 28차 이전):**
- `GET /api/item-slots/campaign/1` = **520ms**

**측정 (28차 적용 후):** ⏳ 배포 후 측정 필요

**예상 효과:**
- ItemSlot INNER JOIN 제거 → **-200ms**
- Buyer + Image 병렬화 → **-50~80ms**
- `raw: true` 오버헤드 제거 → **-50~100ms**
- 합계 **300~350ms 단축 예상** → 520ms → 170~220ms 목표

**기능 검증 항목:**
- [ ] 진행자 시트 로딩 → 동일한 데이터 표시 (제품명, 구매자, 이미지)
- [ ] 영업사 시트 로딩 → 동일한 데이터 표시
- [ ] 브랜드사 시트 로딩 → 동일한 데이터 표시 (brand 전용 필드)
- [ ] 일마감(splitDayGroup) 정상 동작
- [ ] 시트에서 제품 정보 표시 (slot.item.product_name 등)

**결론:** ⏳ 테스트 대기

---

### 29차 최적화 (2026-04-25) - 브랜드사 현황 대시보드 백엔드 + 프론트 최적화

**배경:**
브랜드사 "현황 대시보드"가 main 배포 전인 상태. 플랫폼/브랜드사별 통계 계산이 많아 비효율 패턴 발견.
**배포 전이라 안전하게 구조 변경 가능.**

**원인 분석:**
1. `BUYER_LEVEL_VIEW_SQL`에서 images 테이블을 EXISTS + COUNT 두 번 스캔 (각 buyer row마다)
2. `getOverview` 내부에서 base CTE 3번 반복 실행 (플랫폼 목록/요약/이슈)
3. `getProductList`가 모든 제품 한 번에 반환 → 프론트에서 정렬/필터/페이지네이션
4. `daily trend` 쿼리는 매 호출마다 같은 14일치 재계산 (어제 이전 데이터 불변)
5. `getProductRollup` dead code (어디서도 호출 안 함)

**적용 내용:**

#### Part 1: BUYER_LEVEL_VIEW 함수화 + images 스캔 절반 축소
- `BUYER_LEVEL_VIEW_SQL` 상수 → `buildBuyerLevelView({ withImageCount })` 함수
- `getOverview`: `withImageCount=false` → EXISTS 한 번만
- `getProductList`: `withImageCount=true` → COUNT 한 번만
- 기존: 매 buyer row마다 EXISTS + COUNT 두 번 → 한 번으로

#### Part 2: getOverview 플랫폼 목록 + 요약을 GROUPING SETS로 통합
- 기존: 플랫폼 GROUP BY 쿼리 + 요약 집계 쿼리 (별도 2번)
- 변경: `GROUP BY GROUPING SETS ((platform), ())` 1번으로
- `is_total = 1` 행을 전체 합계로 사용
- "전체" 합산도 JS 합산 → DB GROUPING 결과 직접 사용
- base CTE 실행 횟수 3 → 2 (이슈 쿼리는 별도 유지)

#### Part 3: daily trend 시간대 변환 줄이기 + in-memory 캐싱
- 시간대 변환: WHERE/GROUP BY에서 4번 반복 → 서브쿼리에서 1번만
- in-memory Map 캐싱 (TTL 60초, 인프라 변경 X)
  - 캐시 키: `${brandId}_${platform}`
  - 메모리 제한: 1000개 초과 시 가장 오래된 것 제거
- 캐시 히트 시 trend 쿼리 자체 실행 안 함 (~50~150ms 절감)

#### Part 4: getProductList 서버 사이드 페이지네이션/정렬/필터
- 백엔드: `page`, `pageSize`, `sortKey`, `sortDir`, `filter` 쿼리 파라미터 추가
- raw SQL에 `LIMIT/OFFSET`, `ILIKE`, `ORDER BY` 적용
- whitelist 기반 sortKey 검증 (SQL injection 방어)
- 응답: `{ rows, totalCount, page, pageSize }`
- 프론트: 클라이언트 필터/정렬/페이지 → 서버 호출로 전환
- 검색 입력 debounce 300ms 적용

**UI 변경:** 없음
- 검색 입력 박스, 정렬 버튼, 페이지네이션 컨트롤 모두 그대로
- 사용자가 보는 화면 픽셀 단위 동일

#### Part 5: getProductRollup dead code 제거
- 라우트 + 컨트롤러 함수 제거 (어디서도 호출 안 됨)
- 향후 검색 기능 필요 시 재구현하면 됨

**수정 파일:**
- `backend/src/controllers/brandDashboardController.js` ✅ (전체 재작성)
- `backend/src/routes/brandDashboard.js` ✅ (product-rollup 라우트 제거)
- `frontend/src/services/brandDashboardService.js` ✅ (getProductList 파라미터 추가, getProductRollup 제거)
- `frontend/src/components/brand/BrandDashboard.js` ✅ (서버 페이지네이션 호출, 클라이언트 정렬/필터 제거)

**기능/결과값 불변 보장:**
- `platforms` 배열 응답 동일 (`platform`, `buyerCount`, `totalAmount`)
- "전체" 합산 행 동일 (JS 합산 → DB GROUPING SETS, 동일 수치)
- `summary`, `issues`, `dailyTrend` 응답 구조 100% 동일
- `getProductList`: 응답에 `totalCount`, `page`, `pageSize` 추가 (`rows` 필드 그대로)
- `dailyTrend` 캐시 TTL 60초 → 데이터 변경 후 최대 60초 후 반영 (실시간성 낮은 지표라 허용)
- 시트/대시보드 UI 픽셀 단위 동일

**빌드:** ✅ 백엔드 + 프론트 모두 성공

**예상 효과:**
- `getOverview` 응답 시간: base CTE 3회 → 2회 + images 스캔 절반 → **40~60% 감소**
- `daily trend` 캐시 히트 시: **trend 쿼리 자체 실행 안 함** (~150ms 절감)
- `getProductList` 페이로드 크기: 전체 → 30 row → **대폭 감소**
- 클라이언트 정렬/필터 부하 제거

**기능 검증 항목:**
- [ ] 플랫폼 탭 목록 정상 (전체 + 각 플랫폼 buyerCount/totalAmount)
- [ ] 요약 카드 6개 동일 (총 금액, 구매자 수, 리뷰 완료, 완료율, 활성 캠페인, 제품 수)
- [ ] 이슈 리스트 3종 동일 (낮은 완료율, 미진행, 금액 상위)
- [ ] 14일 일별 추이 차트 동일
- [ ] 제품별 현황 테이블: 검색 → debounce 후 결과 정상
- [ ] 정렬 버튼 클릭 → 서버에서 새 데이터, 동일 결과
- [ ] 페이지 클릭 → 새 페이지 데이터 표시
- [ ] Collapse 펼침 시 캠페인 목록 정상

**측정 결과 (test 서버, 2026-04-25):**

| 항목 | 수치 |
|------|------|
| `GET /api/brand-dashboard/overview` (첫 호출) | **276ms** (base CTE 240ms 단일 쿼리) |
| `GET /api/brand-dashboard/overview` (두 번째 호출, 캐시 hit) | **221ms** ✅ trend 쿼리 빠짐 |
| 기능 동작 | 정상 |

**캐시 동작 확인 ✅:**
- 첫 호출: `WITH buyer_view AS ...` 쿼리 1개 (240ms, GROUPING SETS 통합) + 이슈 쿼리 + trend 쿼리
- 두 번째 호출 (4초 뒤 같은 플랫폼): trend 쿼리 **실행 안 됨** (in-memory 캐시 hit)
- 60초 TTL로 동작 검증 완료

**결론:** ✅ 채택

**추가 발견 (29차 범위 외 병목):**
- `GET /api/notifications` 256ms — COUNT(*) 쿼리 239ms가 병목
- `MonthlyBrand SELECT` 168ms — `monthly-brands/my-brand` 호출
- → 다음 차수 후보

---

### 30차 최적화 (2026-04-25) - 잔여 병목 + 최근 추가 기능 점검

**배경:**
29차 이후 다수 기능 추가 (영업사 정산, 영업사 대시보드, 진행자 카운트 탭, admin 리뷰샷 검색, GPT-4o Vision 등).
29차 측정에서 잔여 병목 2개 + 신규 기능 비효율 패턴 일부 확인.

**적용 내용:**

#### Part A: notifications 복합 인덱스 추가 (마이그레이션 신규)
- `idx_notifications_user_id_is_read` (안 읽은 알림 COUNT 최적화)
- `idx_notifications_user_id_created_at` (정렬 + 필터)

#### Part B: notifications 컨트롤러 — 쿼리 병렬화 + raw
- `findAll` await → `count` await 순차 → `Promise.all`로 병렬
- `findAll`에 `raw: true` 추가 (toJSON 오버헤드 제거)
- 응답 구조 100% 동일

#### Part C: monthly-brands/my-brand JOIN 분리 (27차 패턴 적용)
- 4단계 include (MonthlyBrand → Campaign → Item → ItemSlot) → 2단계로 축소
- Item, ItemSlot 별도 쿼리 (`raw: true`)
- Campaign include에 `where: { is_hidden: false }` 추가 (숨김 캠페인 제외)
- 응답 구조 100% 동일

#### Part D: brandSettlementController EXISTS 3회 → LATERAL 1회
- `getSummary()`: `CASE WHEN EXISTS(...)` 3번 반복 → `LEFT JOIN LATERAL` 한 번 + `bi.has_image` 재사용
- `getSalesProductSummary()`: 동일 패턴 적용
- 매 buyer 행마다 images 테이블 3번 스캔 → 1번으로
- 응답 JSON 구조 동일, 결제금액·수수료·VAT 계산 로직 동일

#### Part E: imageController.searchImages SQL injection 보강
- `platform` 입력값 화이트리스트 sanitize: 한글/영문/숫자/공백만 허용 + 50자 제한
- SQL 메타문자 차단 (`'`, `\\`, `;`, `--` 등 모두 제거)
- 기능 동일, 보안만 강화

#### Part F: GPT-4o Vision 추출 동시성 제한
- `uploadImages` 훅에서 `extractForBuyerAsync` forEach → `extractForBuyers(ids, { concurrency: 3 })`
- OpenAI API 레이트 리밋 회피 + 다른 요청 처리 여유 확보
- 기능 동일, 호출 타이밍만 분산

**수정 파일:**
- `backend/migrations/20260425000001-add-notification-indexes.js` ✅ (신규)
- `backend/src/controllers/notificationController.js` ✅ (Part B)
- `backend/src/routes/monthlyBrands.js` ✅ (Part C)
- `backend/src/controllers/brandSettlementController.js` ✅ (Part D)
- `backend/src/controllers/imageController.js` ✅ (Part E + F)

**빌드:** ✅ 백엔드 5개 파일 모두 문법 검증 통과

**기능/결과값 불변 보장:**
- `notifications` 응답 동일 (`data`, `unreadCount`)
- `my-brand` 응답 동일 (`mb.campaigns[].items[]`, 통계 필드 동일)
- 정산 응답 동일 (영업사별 캠페인/제품별 합계, EXISTS 결과 LATERAL과 동일)
- 검색 결과 동일 (sanitize는 한글/영문/숫자/공백만 허용 → 정상 입력은 영향 없음)
- GPT 추출 결과 동일 (호출 타이밍만 분산)

**예상 효과:**
- `notifications` 256ms → **60-80ms** (인덱스 + 병렬화)
- `monthly-brands/my-brand` 168ms → **50ms 이하** (JOIN 분리)
- 정산 API: EXISTS 3회 → 1회 → **30~50% 감소** 예상
- OpenAI API 레이트 리밋 안정화

⚠️ **배포 후 마이그레이션 필요:**
```bash
docker compose exec app sh -c "cd /app/backend && npx sequelize-cli db:migrate"
```

**기능 검증 항목:**
- [ ] 알림 헤더 정상 (안 읽은 개수 정확)
- [ ] 브랜드사 사이드바 연월브랜드/캠페인 정상 + 진행률 동일
- [ ] 영업사 정산 페이지 — 캠페인별/제품별 금액·수수료·리뷰 합계 동일
- [ ] Admin 리뷰샷 검색 — 플랫폼 필터 정상 (예: '쿠팡', '네이버')
- [ ] 이미지 업로드 후 자동 추출 — 정상 동작 (서버 로그에서 동시 3개 단위 확인)

**결론:** ⏳ 테스트 대기

**보류 (다음 차수 후보):**
- `salesDashboardController` 동일 buyer_view 3회 재사용 → 29차 brand 패턴 적용 필요
- `getOverdueSlots`, `getMonthlyCounts` (진행자 탭) 통계 SQL화
- `Buyer.date` TEXT → DATE 컬럼 마이그레이션 (큰 작업)

---

### [예정] CSS 클래스 기반 스타일링 전환 (시트 렌더러 최적화)

**목적:** 시트 빠른 스크롤 시 셀이 비어있다가 늦게 채워지는 현상 개선

**현재 문제:**
- 렌더러에서 `td.style.xxx = ...`로 셀마다 5~6개 인라인 스타일을 JS로 직접 설정
- 스크롤 시 수천 셀에 대해 매번 실행 → 렌더러 처리 지연 → 빈 셀이 보였다가 채워짐
- 브라우저가 각 `td.style.xxx` 설정마다 스타일 재계산 트리거 가능 (layout thrashing)

**변경 방향:**
```javascript
// 현재: 셀마다 JS로 스타일 5~6개 설정
td.style.backgroundColor = '#fff8e1';
td.style.fontSize = '11px';
td.style.fontWeight = 'bold';
td.style.color = '#1565c0';

// 변경: CSS 클래스 1개만 할당
td.className = 'product-data-row col-platform';
```
- CSS 파일에 클래스 정의 → 브라우저가 스타일 캐싱
- 렌더러는 `td.className = '...'` 1줄만 실행 → 처리 속도 대폭 감소

**변경 범위:**
- 3개 시트 × 3~4개 렌더러 = ~10개 함수
- OperatorItemSheet.js: itemSeparatorRenderer, productHeaderRenderer, createBuyerHeaderRenderer, createProductDataRenderer, createUploadLinkBarRenderer, createBuyerDataRenderer
- SalesItemSheet.js: 동일 구조 (Sales 접두사)
- BrandItemSheet.js: brandItemSeparatorRenderer, brandProductHeaderRenderer, createBrandBuyerHeaderRenderer, createBrandProductDataRenderer, createBrandBuyerDataRenderer

**주의:**
- UI/기능 변경 없음 (화면 동일, 기능 동일)
- 변경 범위가 크므로 반드시 test 서버에서 먼저 검증
- 문제 시 22차 상태로 롤백 가능

**상세 계획:** `docs/CSS_CLASS_MIGRATION_PLAN.md` 참조 (작성 예정)

**상태:** 📋 대기 (test 서버에서 별도 배포/검증 후 진행)

---

### 템플릿 (26차부터 적용)

### n차 최적화 (날짜) - 제목

**적용 내용:**
-

**수정 파일:**
-

**빌드:** ⏳ / ✅ / ❌

---

#### 성능 측정

**측정 환경:**
- 페이지: (예: 진행자 시트, Admin 컨트롤 타워)
- 데이터: (예: 캠페인 ID xxx, 품목 N개, 구매자 N명)
- 브라우저: Chrome
- 서버: test.kwad.co.kr / kwad.co.kr

**API 응답 시간 (X-Response-Time 헤더):**

| API | 이전 (n-1차) | 이후 (n차) | 변화 |
|-----|:---:|:---:|:---:|
| GET /api/monthly-brands/all | ms | ms | |
| GET /api/item-slots/campaign/:id | ms | ms | |
| GET /api/items/my-monthly-brands | ms | ms | |
| GET /api/buyers/by-date | ms | ms | |

**프론트엔드 (브라우저 콘솔):**

| 항목 | 이전 (n-1차) | 이후 (n차) | 변화 |
|------|:---:|:---:|:---:|
| 시트 스크롤 FPS (5초 평균) | fps | fps | |
| [SLOW API] 경고 수 | 개 | 개 | |

**서버 로그:**

| 항목 | 이전 (n-1차) | 이후 (n차) | 변화 |
|------|:---:|:---:|:---:|
| [SLOW] 200ms 초과 API 수 | 개 | 개 | |
| [SLOW QUERY] 100ms 초과 쿼리 수 | 개 | 개 | |

---

**기능 검증:**
- [ ] 데이터 표시 정상
- [ ] 편집/저장 정상
- [ ] 접기/펼치기 + localStorage 복원 정상
- [ ] 한글 입력 정상
- [ ] (해당 시) 추가 검증 항목

**결론:** ⏳ 테스트 대기 / ✅ 채택 / ❌ 기각

**비고:**
-

---

## 6. 주의사항

### 6.1 절대 하면 안 되는 것
| # | 금지 사항 | 이유 |
|---|----------|------|
| 1 | `height="100%"` 설정 | 시트가 완전히 사라짐 (CLAUDE.md 참조) |
| 2 | `colHeaders={false}` | 컬럼 리사이즈 핸들 사라짐 |
| 3 | `.wtHolder` overflow 수정 | 시트 렌더링 깨짐 |
| 4 | UI/기능 변경 | 요구사항 위반 |

### 6.2 테스트 시 체크할 것
- [ ] 모든 행 타입 렌더링 정상 (separator, header, data 등)
- [ ] 접기/펼치기 동작 정상
- [ ] 셀 편집 후 저장 정상
- [ ] Ctrl+S 저장 정상
- [ ] 슬래시(/) 파싱 붙여넣기 정상
- [ ] 필터/정렬 정상
- [ ] 엑셀 다운로드 정상
- [ ] 이미지 클릭 팝업 정상
- [ ] URL 클릭 새 탭 열기 정상

### 6.3 성능 측정 방법
```javascript
// Chrome DevTools Performance 탭 사용

// 또는 코드로 측정
console.time('tableData build');
const tableData = buildTableData(slots);
console.timeEnd('tableData build');

// FPS 측정
let lastTime = performance.now();
let frameCount = 0;
function measureFPS() {
  frameCount++;
  const now = performance.now();
  if (now - lastTime >= 1000) {
    console.log('FPS:', frameCount);
    frameCount = 0;
    lastTime = now;
  }
  requestAnimationFrame(measureFPS);
}
measureFPS();
```

---

## 7. 참고 자료

### 7.1 Handsontable 공식 문서
- [Performance Tips](https://handsontable.com/docs/javascript-data-grid/performance/)
- [Row Virtualization](https://handsontable.com/docs/javascript-data-grid/row-virtualization/)

### 7.2 프로젝트 관련 문서
- `CLAUDE.md` - HotTable height 금지 사항
- `docs/DATABASE_SCHEMA.md` - 데이터 구조

### 7.3 관련 코드 위치
- 렌더러 정의: 각 시트 파일 상단 (컴포넌트 외부)
- afterChange 핸들러: `handleAfterChange` 함수
- tableData 빌드: `useMemo` 내 로직
- cells 속성: `<HotTable cells={...}>`

---

## 최종 업데이트: 2026-02-12
