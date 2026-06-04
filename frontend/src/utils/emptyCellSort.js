/**
 * BUYER_DATA 행을 그룹 내에서 주문번호 유무 기준으로 정렬.
 * 주문번호 있는 행 → 위, 없는 행 → 아래 (stable partition).
 * 정렬 후 그룹 내 순번(seqCol)을 1부터 재할당하고,
 * slot_number 변경 목록을 반환하여 저장 시 DB에 반영 가능.
 *
 * @param {Array} data - baseTableData 배열
 * @param {string} orderNumberCol - 주문번호 컬럼 키 ('col7', 'col8' 등)
 * @param {Object} [options]
 * @param {string} [options.seqCol] - 순번 컬럼 키 ('col2', 'col3' 등)
 * @param {Object} [options.indexMap] - OperatorItemSheet의 baseSlotIndexMap (row index → slotId)
 * @param {Map}    [options.metaMap]  - OperatorItemSheet의 baseRowMetaMap (row index → meta object)
 * @param {Array}  [options.metaArray] - DailyWorkSheet의 baseRowMeta (index-parallel array)
 * @returns {{ sortedData: Array, slotNumberChanges: Array<{slotId, slot_number}>, newIndexMap?: Object, newMetaMap?: Map, sortedMetaArray?: Array }}
 */
export function sortEmptyCells(data, orderNumberCol, options = {}) {
  const { indexMap, metaMap, metaArray, seqCol } = options;

  const sorted = [...data];
  let sortedMeta = metaArray ? [...metaArray] : null;
  const slotNumberChanges = [];

  // 연속된 BUYER_DATA 행 그룹 식별
  const groups = [];
  let groupStart = -1;

  for (let i = 0; i <= sorted.length; i++) {
    const isBuyer = i < sorted.length && sorted[i]._rowType === 'buyer_data';
    if (isBuyer && groupStart === -1) {
      groupStart = i;
    } else if (!isBuyer && groupStart !== -1) {
      groups.push({ start: groupStart, end: i - 1 });
      groupStart = -1;
    }
  }

  // 각 그룹 내에서 stable partition: filled → 앞, empty → 뒤
  for (const { start, end } of groups) {
    const slice = sorted.slice(start, end + 1);
    const filled = [];
    const empty = [];

    for (const row of slice) {
      const val = row[orderNumberCol];
      if (val && String(val).trim() !== '') {
        filled.push(row);
      } else {
        empty.push(row);
      }
    }

    const reordered = [...filled, ...empty];
    for (let j = 0; j < reordered.length; j++) {
      sorted[start + j] = reordered[j];
    }

    // 순번 재할당 + slot_number 변경 기록
    for (let j = 0; j < reordered.length; j++) {
      const row = reordered[j];
      const newSeqNumber = j + 1;

      // 순번 컬럼 값 업데이트
      if (seqCol) {
        row[seqCol] = newSeqNumber;
      }

      // slot_number 변경 기록 (DB 저장용)
      if (row._slotId) {
        slotNumberChanges.push({ slotId: row._slotId, slot_number: newSeqNumber });
      }
    }

    // metaArray도 동일하게 재정렬
    if (sortedMeta) {
      const metaSlice = sortedMeta.slice(start, end + 1);
      const metaFilled = [];
      const metaEmpty = [];

      for (let k = 0; k < slice.length; k++) {
        const val = slice[k][orderNumberCol];
        if (val && String(val).trim() !== '') {
          metaFilled.push(metaSlice[k]);
        } else {
          metaEmpty.push(metaSlice[k]);
        }
      }

      const metaReordered = [...metaFilled, ...metaEmpty];
      for (let j = 0; j < metaReordered.length; j++) {
        sortedMeta[start + j] = metaReordered[j];
      }
    }
  }

  const result = { sortedData: sorted, slotNumberChanges };

  // indexMap 재구축 (OperatorItemSheet)
  if (indexMap) {
    const newIndexMap = {};
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i]._slotId) {
        newIndexMap[i] = sorted[i]._slotId;
      }
    }
    result.newIndexMap = newIndexMap;
  }

  // metaMap 재구축 (OperatorItemSheet)
  if (metaMap) {
    const newMetaMap = new Map();
    const slotIdToMeta = new Map();
    for (const [, meta] of metaMap) {
      if (meta.slotId) {
        slotIdToMeta.set(meta.slotId, meta);
      }
    }
    for (let i = 0; i < sorted.length; i++) {
      const row = sorted[i];
      if (row._slotId && slotIdToMeta.has(row._slotId)) {
        newMetaMap.set(i, slotIdToMeta.get(row._slotId));
      } else {
        const originalMeta = metaMap.get(i);
        if (originalMeta) {
          newMetaMap.set(i, originalMeta);
        }
      }
    }
    result.newMetaMap = newMetaMap;
  }

  if (sortedMeta) {
    result.sortedMetaArray = sortedMeta;
  }

  return result;
}
