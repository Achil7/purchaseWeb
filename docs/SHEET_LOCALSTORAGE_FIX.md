# Sheet localStorage 저장 기능 수정 (2026-01-14)

## 개요

ItemSheet 컴포넌트들(Operator, Sales, Brand)에서 localStorage 기반 상태 저장 기능 수정.
- 접기/펼치기 상태
- 컬럼 너비
- 구매자 데이터 즉시 반영

---

## 1. 접기/펼치기 상태 저장

### 문제점
캠페인 A → B → A로 이동 시 접기 상태가 복원되지 않음.

### 원인
`useEffect`에서 `slots` 변경을 감지하여 localStorage를 복원했는데, 캠페인 전환 시 **이전 캠페인의 slots 데이터가 남아있는 상태**에서 useEffect가 먼저 실행됨.

```
문제 흐름:
1. A 캠페인 → 접기 → localStorage에 [142] 저장
2. B 캠페인 클릭 → campaignId=36으로 변경
3. useEffect 실행 → slots는 아직 A의 데이터 [142]
4. B 캠페인 API 응답 → slots = [143, 144, ...] (28개)
5. A 캠페인 클릭 → campaignId=37로 변경
6. useEffect 실행 → slots는 아직 B의 데이터 [143, 144, ...]
7. localStorage에서 [142] 로드 → 현재 slots에 142가 없음 → 필터링 실패 → 빈 Set
```

### 해결 방법
**useEffect 대신 API 응답 직후 `loadSlots` 함수 내에서 localStorage 복원**

```javascript
// loadSlots 함수 내부
const loadSlots = useCallback(async () => {
  const response = await API();
  if (response.success) {
    const newSlots = response.data || [];
    setSlots(newSlots);

    // API 응답 직후 localStorage에서 접기 상태 복원
    const allItemIds = [...new Set(newSlots.map(s => s.item_id))];
    const collapsedKey = `operator_itemsheet_collapsed_items_${campaignId}`;
    try {
      const saved = localStorage.getItem(collapsedKey);
      if (saved) {
        const savedIds = JSON.parse(saved);
        const validIds = savedIds.filter(id => allItemIds.includes(id));
        setCollapsedItems(new Set(validIds));
      } else {
        setCollapsedItems(new Set(allItemIds)); // 기본값: 모두 접기
      }
    } catch (e) {
      setCollapsedItems(new Set(allItemIds));
    }
  }
}, [campaignId]);
```

### 수정 파일
- `frontend/src/components/operator/OperatorItemSheet.js`
- `frontend/src/components/sales/SalesItemSheet.js`
- `frontend/src/components/brand/BrandItemSheet.js`

### 핵심 변경
1. 기존 useEffect 기반 복원 로직 제거
2. `loadSlots` 함수 내에서 API 응답 직후 복원
3. 이렇게 하면 **확실히 올바른 캠페인의 데이터**로 복원됨

---

## 2. 컬럼 너비 저장

### 문제점
캠페인 A에서 컬럼 너비 조절 후 B로 이동했다가 A로 돌아오면 원래 너비로 복원 안됨.

### 원인
`columns` useMemo의 dependency가 `[]`로 설정되어 마운트 시 한 번만 실행됨.
캠페인이 변경되어도 컬럼 너비가 다시 로드되지 않음.

### 해결 방법
1. `columnWidths` state 추가
2. `loadSlots`에서 API 응답 직후 컬럼 너비 localStorage 복원
3. `columns` useMemo dependency를 `[columnWidths]`로 변경
4. `handleColumnResize`에서 state 업데이트 추가

```javascript
// 1. state 추가
const [columnWidths, setColumnWidths] = useState(DEFAULT_COLUMN_WIDTHS);

// 2. loadSlots에서 복원
const loadSlots = useCallback(async () => {
  // ... API 호출 ...

  // API 응답 직후 localStorage에서 컬럼 너비 복원
  const widthKey = `operator_itemsheet_column_widths_${campaignId}`;
  try {
    const savedWidths = localStorage.getItem(widthKey);
    if (savedWidths) {
      setColumnWidths(JSON.parse(savedWidths));
    } else {
      setColumnWidths(DEFAULT_COLUMN_WIDTHS);
    }
  } catch (e) {
    setColumnWidths(DEFAULT_COLUMN_WIDTHS);
  }
}, [campaignId]);

// 3. columns useMemo
const columns = useMemo(() => {
  const baseColumns = [];
  for (let i = 0; i < 20; i++) {
    baseColumns.push({
      data: `col${i}`,
      width: columnWidths[i] || DEFAULT_COLUMN_WIDTHS[i],
      // ...
    });
  }
  return baseColumns;
}, [columnWidths]); // dependency 변경

// 4. handleColumnResize
const handleColumnResize = useCallback((newSize, column) => {
  const widths = [...]; // 현재 컬럼 너비 수집

  setColumnWidths(widths); // state 업데이트 추가
  localStorage.setItem(COLUMN_WIDTHS_KEY, JSON.stringify(widths));
}, [COLUMN_WIDTHS_KEY]);
```

### 수정 파일
- `frontend/src/components/operator/OperatorItemSheet.js`
- `frontend/src/components/sales/SalesItemSheet.js`
- `frontend/src/components/brand/BrandItemSheet.js`

---

## 3. 구매자 데이터 즉시 반영

### 문제점
구매자 데이터 수정 후:
1. 시트에 바로 보이지 않음
2. 다른 제품 토글 후 돌아오면 수정한 데이터가 원상복구됨

### 원인
`handleAfterChange`에서 `changedSlots`만 업데이트하고 `slots` state는 업데이트하지 않음.
다른 제품 토글 시 `tableData`가 `slots`에서 다시 생성되면서 원래 값으로 돌아감.

### 해결 방법
셀 편집 시 `changedSlots`와 함께 `slots` state도 즉시 업데이트.

```javascript
// OperatorItemSheet.js - handleAfterChange
const handleAfterChange = useCallback((changes, source) => {
  // ... 기존 로직 ...

  setChangedSlots(slotUpdates);
  setChangedItems(itemUpdates);

  // slots 상태 즉시 업데이트 (토글 시 데이터 유지를 위해)
  if (Object.keys(slotImmediateUpdates).length > 0) {
    setSlots(prevSlots => {
      return prevSlots.map(slot => {
        const changes = slotImmediateUpdates[slot.id];
        if (changes) {
          // buyer 필드와 slot 필드 분리
          const buyerChanges = {};
          const slotChanges = {};

          Object.entries(changes).forEach(([key, value]) => {
            if (buyerFieldsList.includes(key)) {
              buyerChanges[key] = value;
            } else {
              slotChanges[key] = value;
            }
          });

          const updatedBuyer = slot.buyer
            ? { ...slot.buyer, ...buyerChanges }
            : buyerChanges;

          return { ...slot, ...slotChanges, buyer: updatedBuyer };
        }
        return slot;
      });
    });
  }
}, [...]);
```

### buyer 필드 목록
```javascript
const buyerFieldsList = [
  'order_number', 'buyer_name', 'recipient_name', 'user_id',
  'contact', 'address', 'account_info', 'amount',
  'tracking_number', 'deposit_name', 'payment_confirmed'
];
```

### 수정 파일
- `frontend/src/components/operator/OperatorItemSheet.js` - `handleAfterChange`
- `frontend/src/components/sales/SalesItemSheet.js` - `afterChange` (inline)

---

## 4. 저장 시 buyer 객체 업데이트

### 문제점
저장(Ctrl+S) 후에도 시트에 변경사항이 바로 반영되지 않음.

### 원인
`handleSaveChanges`에서 `slots` state 업데이트 시 `buyer` 객체를 업데이트하지 않음.
구매자 필드(order_number 등)는 `slot.buyer` 객체 안에 있음.

### 해결 방법
저장 시 buyer 필드와 slot 필드를 분리하여 업데이트.

```javascript
const handleSaveChanges = async () => {
  // ... DB 저장 ...

  // 로컬 slots 상태 업데이트
  const buyerFields = ['order_number', 'buyer_name', ...];

  setSlots(prevSlots => {
    return prevSlots.map(slot => {
      const changes = changedSlots[slot.id];
      if (changes) {
        const slotChanges = {};
        const buyerChanges = {};

        Object.entries(changes).forEach(([key, value]) => {
          if (key === 'id') return;
          if (buyerFields.includes(key)) {
            buyerChanges[key] = value;
          } else {
            slotChanges[key] = value;
          }
        });

        const updatedBuyer = slot.buyer
          ? { ...slot.buyer, ...buyerChanges }
          : buyerChanges;

        return { ...slot, ...slotChanges, buyer: updatedBuyer };
      }
      return slot;
    });
  });
};
```

### 수정 파일
- `frontend/src/components/operator/OperatorItemSheet.js` - `handleSaveChanges`
- `frontend/src/components/sales/SalesItemSheet.js` - `handleSaveChanges`

---

## localStorage 키 구조

### 캠페인별 저장 (캠페인 간 독립)
```
operator_itemsheet_collapsed_items_${campaignId}  // 접기 상태 [item_id, ...]
operator_itemsheet_column_widths_${campaignId}    // 컬럼 너비 [width, ...]
operator_itemsheet_column_alignments_${campaignId} // 컬럼 정렬

sales_itemsheet_collapsed_items_${campaignId}
sales_itemsheet_column_widths_${campaignId}
sales_itemsheet_column_alignments_${campaignId}

brand_itemsheet_collapsed_items_${campaignId}
brand_itemsheet_column_widths_${campaignId}
brand_itemsheet_column_alignments_${campaignId}
```

---

## 핵심 교훈

### useEffect vs API 응답 직후
- **useEffect 문제**: React 렌더링 사이클에서 실행되어 이전 데이터로 잘못 실행될 수 있음
- **API 응답 직후**: 확실히 올바른 데이터로 실행됨

### State 동기화
- 화면에 표시되는 데이터는 **state에서** 가져옴
- 변경사항이 있으면 **state도 함께 업데이트**해야 즉시 반영됨
- 저장 대기 중인 변경사항(`changedSlots`)과 실제 데이터(`slots`)를 분리하되, 둘 다 업데이트 필요

---

## 테스트 시나리오

### 접기/펼치기
1. A 캠페인 열기 → 제품 접기
2. B 캠페인으로 이동
3. A 캠페인으로 돌아오기
4. **기대**: 접힌 상태 유지

### 컬럼 너비
1. A 캠페인 열기 → 컬럼 너비 조절
2. B 캠페인으로 이동
3. A 캠페인으로 돌아오기
4. **기대**: 조절한 너비 유지

### 구매자 데이터
1. A 제품 펼치기 → 구매자 정보 수정 (엔터)
2. B 제품 토글 (접기/펼치기)
3. A 제품 다시 확인
4. **기대**: 수정한 데이터 유지 (저장 전이어도)
