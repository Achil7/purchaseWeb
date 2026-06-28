import XLSX from 'xlsx-js-style';

const MAX_ROWS = 200;
const MAX_COLS = 30;
const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2MB

/**
 * 업로드한 엑셀/CSV를 클라이언트에서 파싱해 JSON으로 변환.
 * (AI 챗 대조 검증용 — 첫 시트만, 행/열 캡 적용)
 *
 * @param {File} file
 * @returns {Promise<{ fileName, columns: string[], rows: object[], rowCount: number, truncated: boolean }>}
 */
export const parseUploadFile = async (file) => {
  if (!file) throw new Error('파일이 없습니다.');
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('파일이 너무 큽니다(최대 2MB).');
  }

  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('시트를 찾을 수 없습니다.');

  const json = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null, raw: false });
  const totalRows = json.length;

  const rows = json.slice(0, MAX_ROWS).map((r) => {
    const keys = Object.keys(r).slice(0, MAX_COLS);
    const obj = {};
    keys.forEach((k) => {
      obj[k] = r[k] == null ? null : String(r[k]);
    });
    return obj;
  });

  const columns = rows[0] ? Object.keys(rows[0]) : [];

  return {
    fileName: file.name,
    columns,
    rows,
    rowCount: totalRows,
    truncated: totalRows > MAX_ROWS,
  };
};
