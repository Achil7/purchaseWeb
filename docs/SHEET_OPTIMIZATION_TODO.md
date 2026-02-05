# Handsontable 시트 성능 최적화 TODO

## 1. 개요

### 1.1 목적
Handsontable 기반 시트 컴포넌트들의 성능을 개선하여, 대용량 데이터(500~1000+ 행)에서도 버벅거림 없이 부드러운 사용자 경험 제공

### 1.2 목표
1. **초기 로딩**: 1000행 기준 300ms 이내
2. **스크롤**: 60fps 유지 (버벅거림 없음)
3. **데이터 입력**: 키 입력 후 50ms 이내 반응
4. **100행 제한 해제**: 제한 없이도 위 성능 목표 달성

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
| 100행 제한 | 임시방편으로 100행씩 로딩 중 (근본 해결 아님) |

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

## 3. 성능 병목 분석

### 3.1 확인된 병목점

#### 🔴 심각 (Critical)
| # | 문제 | 위치 | 영향 |
|---|------|------|------|
| 1 | afterChange 내 O(n) filter | `handleAfterChange` 함수 | 매 편집마다 전체 slots 순회 |
| 2 | tableData 변경 시 모든 행 새 객체 생성 | `useMemo` 내 map() | GC 부담, 불필요한 리렌더링 |
| 3 | 렌더러가 tableData 의존 | `createXxxRenderer` 함수들 | 데이터 변경 시 렌더러 재생성 |

#### 🟠 중간 (Medium)
| # | 문제 | 위치 | 영향 |
|---|------|------|------|
| 4 | hiddenRowIndices 매번 전체 순회 | `useMemo` 내 forEach | 접기 상태 변경 시 불필요한 계산 |
| 5 | cellsRenderer 매 셀마다 분기 처리 | `cells` prop | 보이는 모든 셀에 대해 실행 |
| 6 | changedSlots + changedSlotsRef 이중 관리 | 상태 관리 | 메모리 오버헤드 |

#### 🟡 낮음 (Low)
| # | 문제 | 위치 | 영향 |
|---|------|------|------|
| 7 | 슬롯 조회 시 항상 filter/find 사용 | 여러 곳 | O(n) 조회 반복 |
| 8 | 스크롤 이벤트 쓰로틀링 없음 | 스크롤 핸들러 | 과도한 이벤트 발생 |

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

### 테스트 #1
- **날짜**: ____-__-__
- **적용한 방안**:
- **테스트 환경**:
  - 캠페인:
  - 품목 수:
  - 구매자 수:
- **측정 결과**:
  - 초기 로딩: __ms → __ms
  - 스크롤 FPS: __fps → __fps
  - 입력 반응: __ms → __ms
- **기능 검증**:
  - [ ] 데이터 표시 정상
  - [ ] 편집 기능 정상
  - [ ] 저장 기능 정상
  - [ ] 접기/펼치기 정상
- **결론**: [ ] 채택 / [ ] 기각 / [ ] 추가 테스트 필요
- **비고**:

---

### 테스트 #2
- **날짜**: ____-__-__
- **적용한 방안**:
- **테스트 환경**:
  - 캠페인:
  - 품목 수:
  - 구매자 수:
- **측정 결과**:
  - 초기 로딩: __ms → __ms
  - 스크롤 FPS: __fps → __fps
  - 입력 반응: __ms → __ms
- **기능 검증**:
  - [ ] 데이터 표시 정상
  - [ ] 편집 기능 정상
  - [ ] 저장 기능 정상
  - [ ] 접기/펼치기 정상
- **결론**: [ ] 채택 / [ ] 기각 / [ ] 추가 테스트 필요
- **비고**:

---

### 테스트 #3
- **날짜**: ____-__-__
- **적용한 방안**:
- **테스트 환경**:
- **측정 결과**:
- **기능 검증**:
- **결론**:
- **비고**:

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

## 최종 업데이트: 2026-02-05
