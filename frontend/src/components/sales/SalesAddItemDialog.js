import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Typography,
  TextField, Box, Button, MenuItem, Alert, Paper, Chip,
  Table, TableHead, TableBody, TableRow, TableCell, IconButton, Tooltip,
  Tabs, Tab
} from '@mui/material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import EditIcon from '@mui/icons-material/Edit';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import MergeTypeIcon from '@mui/icons-material/MergeType';

// UTC+9 현재 시간을 YYYY-MM-DDTHH:mm 형식으로 반환
const getKoreanDateTime = () => {
  const now = new Date();
  const kstOffset = 9 * 60;
  const kstTime = new Date(now.getTime() + (kstOffset + now.getTimezoneOffset()) * 60000);

  const year = kstTime.getFullYear();
  const month = String(kstTime.getMonth() + 1).padStart(2, '0');
  const day = String(kstTime.getDate()).padStart(2, '0');
  const hours = String(kstTime.getHours()).padStart(2, '0');
  const minutes = String(kstTime.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

// 일 구매 건수 문자열 파싱 (예: "6/6" -> [6, 6], "1/3/4/2" -> [1, 3, 4, 2])
const parseDailyPurchaseCounts = (value) => {
  if (!value) return [];
  // 숫자와 슬래시만 추출 후 슬래시로 분리
  const cleaned = value.replace(/[^0-9/]/g, '');
  if (!cleaned) return [];
  return cleaned.split('/').filter(n => n).map(n => parseInt(n, 10));
};

// 일 구매 건수 배열의 합계 계산
const sumDailyPurchaseCounts = (dailyCountStr) => {
  const counts = parseDailyPurchaseCounts(dailyCountStr);
  return counts.reduce((sum, n) => sum + n, 0);
};

// URL 문자열을 " | " 로 분리하여 각각 하이퍼링크로 렌더링
const renderUrlLinks = (urlString) => {
  if (!urlString || urlString === '-') return '-';

  const urls = urlString.split(' | ').map(u => u.trim()).filter(Boolean);
  if (urls.length === 0) return '-';

  return urls.map((url, index) => (
    <React.Fragment key={index}>
      {index > 0 && <span style={{ margin: '0 4px' }}>|</span>}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: '#1976d2', textDecoration: 'underline' }}
      >
        {url}
      </a>
    </React.Fragment>
  ));
};

// 필드 키워드 매칭 함수 - 라인이 특정 필드의 시작인지 확인
const isFieldLine = (line) => {
  const colonIndex = line.indexOf(':');
  if (colonIndex === -1) return false;

  const key = line.substring(0, colonIndex).trim().toLowerCase();

  // 알려진 필드 키워드들
  const fieldKeywords = [
    '미출고', '실출고', '제품명', '제품', '총', '건수', '일', 'url', '상품', '확인',
    '구매', '옵션', '가격', '리뷰', '가이드', '소구점', '택배', '대행', '키워드', '유입',
    '출고', '마감', '비고', '플랫폼', '판매처'
  ];

  return fieldKeywords.some(kw => key.includes(kw));
};

// 단일 품목 텍스트를 파싱하는 함수
const parseItemText = (text) => {
  const lines = text.split('\n');
  const result = {
    product_name: '',
    shipping_type: '실출고',
    total_purchase_count: '',
    daily_purchase_count: '',
    product_url: '',
    purchase_option: '',
    product_price: '',
    review_guide: '',
    courier_service_yn: '',
    keyword: '',
    shipping_deadline: '',
    notes: '',
    platform: '-',
    registered_at: getKoreanDateTime()
  };

  let currentField = null;
  let multiLineContent = [];

  const saveMultiLineContent = () => {
    if (currentField === 'review_guide' && multiLineContent.length > 0) {
      result.review_guide = multiLineContent.join('\n');
    }
    multiLineContent = [];
    currentField = null;
  };

  lines.forEach((line, index) => {
    const trimmedLine = line.trim();

    // 빈 줄은 멀티라인 컨텐츠에 포함 (리뷰가이드 내 빈줄 보존)
    if (!trimmedLine) {
      if (currentField === 'review_guide') {
        multiLineContent.push('');
      }
      return;
    }

    const colonIndex = line.indexOf(':');

    // 콜론이 없거나 필드 라인이 아니면 멀티라인 컨텐츠에 추가
    if (colonIndex === -1 || !isFieldLine(line)) {
      if (currentField === 'review_guide') {
        multiLineContent.push(trimmedLine);
      }
      return;
    }

    // 새 필드 시작 - 이전 멀티라인 컨텐츠 저장
    saveMultiLineContent();

    const key = line.substring(0, colonIndex).trim().toLowerCase();
    const value = line.substring(colonIndex + 1).trim();

    if (key.includes('미출고') || key.includes('실출고')) {
      result.shipping_type = value.includes('미출고') ? '미출고' : '실출고';
    } else if (key.includes('제품명') || key === '제품') {
      result.product_name = value;
    } else if (key.includes('총') && key.includes('건수')) {
      result.total_purchase_count = value.replace(/[^0-9]/g, '');
    } else if (key.includes('일') && key.includes('건수')) {
      // 일 구매 건수는 슬래시 포함하여 저장 (예: "6/6", "1/3/4/2")
      result.daily_purchase_count = value.replace(/[^0-9/]/g, '');
    } else if (key.includes('url') && (key.includes('상품') || key.includes('확인'))) {
      result.product_url = value;
    } else if (key.includes('구매') && key.includes('옵션')) {
      result.purchase_option = value;
    } else if (key.includes('가격')) {
      result.product_price = value.replace(/[^0-9]/g, '');
    } else if (key.includes('리뷰') || key.includes('가이드') || key.includes('소구점')) {
      // 리뷰 가이드는 멀티라인 지원
      currentField = 'review_guide';
      if (value) multiLineContent.push(value);
    } else if (key.includes('택배') && key.includes('대행')) {
      // TEXT 필드 - 'Y' 또는 'N' 문자열로 저장
      result.courier_service_yn = (value.toUpperCase() === 'Y' || value.includes('사용')) ? 'Y' : 'N';
    } else if (key.includes('키워드') || key.includes('유입')) {
      result.keyword = value;
    } else if (key.includes('출고') && key.includes('마감')) {
      result.shipping_deadline = value;
    } else if (key.includes('비고')) {
      result.notes = value;
    } else if (key.includes('플랫폼') || key.includes('판매처')) {
      // 쿠팡, 네이버, 11번가 등 키워드 매칭
      const lower = value.toLowerCase();
      if (lower.includes('쿠팡') || lower.includes('coupang')) {
        result.platform = '쿠팡';
      } else if (lower.includes('네이버') || lower.includes('naver') || lower.includes('스마트스토어')) {
        result.platform = '네이버';
      } else if (lower.includes('11번가') || lower.includes('11st')) {
        result.platform = '11번가';
      } else if (lower.includes('지마켓') || lower.includes('gmarket')) {
        result.platform = '지마켓';
      } else if (lower.includes('옥션') || lower.includes('auction')) {
        result.platform = '옥션';
      } else if (lower.includes('티몬') || lower.includes('tmon')) {
        result.platform = '티몬';
      } else if (lower.includes('위메프') || lower.includes('wemakeprice')) {
        result.platform = '위메프';
      } else {
        result.platform = value;
      }
    }
  });

  // 마지막 멀티라인 필드 저장
  saveMultiLineContent();

  // 특이사항 자동 생성: "리뷰가이드, 가격, 출고마감시간"
  const noteParts = [];
  if (result.review_guide) noteParts.push(result.review_guide);
  if (result.product_price) noteParts.push(`${Number(result.product_price).toLocaleString()}원`);
  if (result.shipping_deadline) noteParts.push(result.shipping_deadline);
  result.notes = noteParts.join('\n\n');  // 줄바꿈으로 구분

  return result;
};

// 파이프(|)로 구분된 텍스트를 그대로 하나의 제품으로 파싱
// 파이프 구분 데이터는 분리하지 않고 그대로 저장
// 총 구매건수: 파이프로 분리된 값 중 최대값
// 일 구매건수: 총 구매건수 최대값과 동일
const parseCombineText = (text) => {
  const lines = text.split('\n').filter(line => line.trim());

  // 파이프 구분자가 있는지 확인
  const hasPipe = lines.some(line => line.includes('|'));
  if (!hasPipe) return null;

  const result = {
    product_name: '',
    product_url: '',
    purchase_option: '',
    keyword: '',
    shipping_type: '',
    total_purchase_count: '',
    daily_purchase_count: '',
    review_guide: '',
    product_price: '',
    shipping_deadline: '',
    courier_service_yn: '',
    platform: '',
    notes: '',
    registered_at: getKoreanDateTime()
  };

  lines.forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) return;

    const key = line.substring(0, colonIndex).trim().toLowerCase();
    const value = line.substring(colonIndex + 1).trim(); // 파이프 포함 그대로

    // 필드 키 매핑
    if (key.includes('제품명') || key === '제품') {
      result.product_name = value;
    } else if (key.includes('url') && (key.includes('상품') || key.includes('확인'))) {
      result.product_url = value;
    } else if (key.includes('구매') && key.includes('옵션')) {
      result.purchase_option = value;
    } else if (key.includes('키워드') || key.includes('유입')) {
      result.keyword = value;
    } else if (key.includes('플랫폼') || key.includes('판매처')) {
      result.platform = value;
    } else if (key.includes('미출고') || key.includes('실출고') || key.includes('출고') && !key.includes('마감')) {
      result.shipping_type = value;
    } else if (key.includes('총') && key.includes('건수')) {
      // 총 구매건수: 파이프로 분리된 값 중 최대값
      const values = value.split('|').map(v => parseInt(v.replace(/[^0-9]/g, ''), 10) || 0);
      result.total_purchase_count = Math.max(...values);
    } else if (key.includes('일') && key.includes('건수')) {
      // 일 구매건수는 무시 (총 구매건수 최대값으로 대체)
      // 아무것도 안 함
    } else if (key.includes('리뷰') || key.includes('가이드') || key.includes('소구점')) {
      result.review_guide = value;
    } else if (key.includes('가격')) {
      result.product_price = value;
    } else if (key.includes('출고') && key.includes('마감')) {
      result.shipping_deadline = value;
    } else if (key.includes('택배') && key.includes('대행')) {
      result.courier_service_yn = value;  // 그대로 저장
    }
  });

  // 일 구매건수 = 총 구매건수 최대값
  result.daily_purchase_count = String(result.total_purchase_count);

  // 특이사항 자동 생성
  const noteParts = [];
  if (result.review_guide) noteParts.push(result.review_guide);
  if (result.product_price) noteParts.push(result.product_price);
  if (result.shipping_deadline) noteParts.push(result.shipping_deadline);
  result.notes = noteParts.join(', ');

  return result.product_name ? result : null;
};

// 여러 품목 텍스트를 파싱 (빈 줄로 구분 또는 파이프 구분)
// 파이프(|) 구분 텍스트가 감지되면 하나의 제품으로 처리 (데이터 그대로 유지)
const parseMultipleItems = (text) => {
  // 파이프 구분 텍스트인지 확인 (여러 라인에 |가 있는 경우)
  const lines = text.split('\n').filter(line => line.trim());
  const pipeLines = lines.filter(line => line.includes('|') && line.includes(':'));

  // 2개 이상의 라인에 파이프가 있으면 하나의 제품으로 합침
  if (pipeLines.length >= 2) {
    const combinedItem = parseCombineText(text);
    if (combinedItem) {
      // 하나의 제품으로 반환 (isCombineMode: true)
      // combinedItem.total_purchase_count가 있으면 유효한 품목
      return { items: [combinedItem], isCombineMode: true };
    }
  }

  // 일반 모드: 빈 줄(1개 이상)로 품목 구분
  const itemBlocks = text.split(/\n\s*\n/).filter(block => block.trim());

  const items = [];

  for (const block of itemBlocks) {
    const parsed = parseItemText(block);
    // 총건수가 있는 경우에만 유효한 품목으로 인정 (일건수는 선택)
    if (parsed.total_purchase_count) {
      items.push(parsed);
    }
  }

  return { items, isCombineMode: false };
};

function SalesItemDialog({ open, onClose, onSave, onSaveBulk, mode = 'create', initialData = null }) {
  const emptyFormState = {
    product_name: '',
    description: '',
    status: 'active',
    shipping_type: '실출고',
    keyword: '',
    total_purchase_count: '',
    daily_purchase_count: '',
    product_url: '',
    purchase_option: '',
    product_price: '',
    shipping_deadline: '',
    review_guide: '',
    courier_service_yn: '',
    notes: '',
    platform: '-',
    registered_at: getKoreanDateTime(),
    sale_price_per_unit: '',
    courier_price_per_unit: ''
  };

  const [formData, setFormData] = useState(emptyFormState);
  const [error, setError] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [parsedItems, setParsedItems] = useState([]);

  // 탭 상태: 'paste' (붙여넣기) | 'combine' (제품 합치기)
  const [inputMode, setInputMode] = useState('paste');

  // 제품 합치기 상태
  const [combinedProducts, setCombinedProducts] = useState([]);
  const [combineText, setCombineText] = useState('');

  useEffect(() => {
    if (open) {
      setError('');
      setPasteText('');
      setParsedItems([]);
      setInputMode('paste');
      setCombinedProducts([]);
      setCombineText('');

      if (mode === 'edit' && initialData) {
        let registeredAt = initialData.registered_at || getKoreanDateTime();
        if (registeredAt && registeredAt.includes('T')) {
          registeredAt = registeredAt.slice(0, 16);
        }
        setFormData({
          product_name: initialData.product_name || '',
          description: initialData.description || '',
          status: initialData.status || 'active',
          shipping_type: initialData.shipping_type || '실출고',
          keyword: initialData.keyword || '',
          total_purchase_count: initialData.total_purchase_count || '',
          daily_purchase_count: initialData.daily_purchase_count || '',
          product_url: initialData.product_url || '',
          purchase_option: initialData.purchase_option || '',
          product_price: initialData.product_price || '',
          shipping_deadline: initialData.shipping_deadline || '',
          review_guide: initialData.review_guide || '',
          courier_service_yn: initialData.courier_service_yn || '',
          notes: initialData.notes || '',
          platform: initialData.platform || '-',
          registered_at: registeredAt,
          sale_price_per_unit: initialData.sale_price_per_unit || '',
          courier_price_per_unit: initialData.courier_price_per_unit || ''
        });
      } else {
        setFormData({ ...emptyFormState, registered_at: getKoreanDateTime() });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, initialData]);

  const handlePasteTextChange = (e) => {
    const text = e.target.value;
    setPasteText(text);

    if (text.trim()) {
      const result = parseMultipleItems(text);
      const items = result.items;

      if (items.length > 0) {
        setParsedItems(items);
        // 단일 품목인 경우 formData도 업데이트
        if (items.length === 1) {
          setFormData({
            ...emptyFormState,
            ...items[0],
            status: 'active',
            registered_at: getKoreanDateTime()
          });
        }
      } else {
        setParsedItems([]);
      }
    } else {
      setParsedItems([]);
      setFormData({ ...emptyFormState, registered_at: getKoreanDateTime() });
    }
  };

  const handleRemoveItem = (index) => {
    setParsedItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleItemFieldChange = (index, field, value) => {
    setParsedItems(prev => prev.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    ));
  };

  // 제품 합치기: 제품 삭제
  const removeProductFromCombine = (index) => {
    setCombinedProducts(prev => prev.filter((_, i) => i !== index));
  };

  // 제품 합치기: 개별 제품 필드 수정
  const handleCombinedProductFieldChange = (index, field, value) => {
    setCombinedProducts(prev => prev.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    ));
  };

  // 제품 합치기: 합쳐진 결과 생성
  // 총 구매건수: 모든 제품 중 최대값
  // 일 구매건수: 총 구매건수의 최대값과 동일 (day_group 1개로 통합)
  const mergeCombinedProducts = () => {
    if (combinedProducts.length === 0) return null;

    // 총 구매건수: 모든 제품 중 최대값
    const maxTotalCount = Math.max(
      ...combinedProducts.map(p => parseInt(p.total_purchase_count) || 0)
    );

    // 모든 필드를 | 로 합침
    const merged = {
      product_name: combinedProducts.map(p => p.product_name).filter(Boolean).join(' | '),
      keyword: combinedProducts.map(p => p.keyword || '').filter(Boolean).join(' | '),
      product_price: combinedProducts.map(p => p.product_price || '').filter(Boolean).join(' | '),
      product_url: combinedProducts.map(p => p.product_url || '').filter(Boolean).join(' | '),
      purchase_option: combinedProducts.map(p => p.purchase_option || '').filter(Boolean).join(' | '),
      review_guide: combinedProducts.map(p => p.review_guide || '').filter(Boolean).join(' | '),
      notes: combinedProducts.map(p => p.notes || '').filter(Boolean).join(' | '),
      shipping_type: combinedProducts.map(p => p.shipping_type || '').filter(Boolean).join(' | '),
      platform: combinedProducts.map(p => p.platform || '').filter(Boolean).join(' | '),
      shipping_deadline: combinedProducts.map(p => p.shipping_deadline || '').filter(Boolean).join(' | '),

      // 총 구매건수: 최대값, 일 구매건수: 총 구매건수와 동일
      total_purchase_count: maxTotalCount,
      daily_purchase_count: String(maxTotalCount),

      // courier_service_yn: 하나라도 Y면 Y (TEXT 필드)
      courier_service_yn: combinedProducts.some(p => p.courier_service_yn === 'Y' || p.courier_service_yn === true) ? 'Y' : '',
      registered_at: getKoreanDateTime()
    };

    return merged;
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  // 일 구매 건수 검증 (총 구매 건수와 일치 여부)
  // 일 구매건수가 빈 값이면 총 구매건수와 동일하게 처리 (선택적 필드)
  const validateDailyPurchaseCount = (totalCount, dailyCountStr) => {
    // 총 구매 건수 필수
    if (!totalCount) {
      return { valid: false, error: '총 구매 건수를 입력해주세요.' };
    }

    // 일 구매 건수가 빈 값이면 유효 (총 구매건수와 동일하게 처리됨)
    if (!dailyCountStr || dailyCountStr.trim() === '') {
      return { valid: true, error: '' };
    }

    const total = parseInt(totalCount, 10);
    const dailySum = sumDailyPurchaseCounts(dailyCountStr);

    if (dailySum !== total) {
      return {
        valid: false,
        error: `일 구매 건수의 합(${dailySum})이 총 구매 건수(${total})와 일치하지 않습니다.`
      };
    }
    return { valid: true, error: '' };
  };

  const handleSave = () => {
    // 제품 합치기 모드인 경우 - parsedItems[0] 사용
    if (inputMode === 'combine') {
      if (parsedItems.length === 0 || !parsedItems[0].product_name) {
        setError('파이프(|) 구분 텍스트를 붙여넣어 주세요.');
        return;
      }

      const item = parsedItems[0];

      const saveData = {
        product_name: item.product_name,
        description: null,
        status: 'active',
        shipping_type: item.shipping_type || null,
        keyword: item.keyword || null,
        total_purchase_count: item.total_purchase_count ? parseInt(item.total_purchase_count) : null,
        daily_purchase_count: item.daily_purchase_count || null,
        product_url: item.product_url || null,
        purchase_option: item.purchase_option || null,
        product_price: item.product_price || null,
        shipping_deadline: item.shipping_deadline || null,
        review_guide: item.review_guide || null,
        courier_service_yn: item.courier_service_yn || null,  // 그대로 저장 (TEXT)
        notes: item.notes || null,
        platform: item.platform || null,
        registered_at: item.registered_at ? new Date(item.registered_at).toISOString() : new Date().toISOString(),
        sale_price_per_unit: null,
        courier_price_per_unit: null
      };

      onSave(saveData);
      return;
    }

    // 여러 품목인 경우
    if (parsedItems.length > 1 && onSaveBulk) {
      // 각 품목의 일 구매 건수 검증
      for (let i = 0; i < parsedItems.length; i++) {
        const item = parsedItems[i];
        const validation = validateDailyPurchaseCount(item.total_purchase_count, item.daily_purchase_count);
        if (!validation.valid) {
          setError(`[${i + 1}번 품목: ${item.product_name || '이름없음'}] ${validation.error}`);
          return;
        }
      }

      const itemsData = parsedItems.map(item => ({
        product_name: item.product_name,
        description: item.description || null,
        status: 'active',
        shipping_type: item.shipping_type || null,
        keyword: item.keyword || null,
        total_purchase_count: item.total_purchase_count ? parseInt(item.total_purchase_count) : null,
        daily_purchase_count: item.daily_purchase_count || null, // 슬래시 포함 문자열 저장
        product_url: item.product_url || null,
        purchase_option: item.purchase_option || null,
        product_price: item.product_price || null,
        shipping_deadline: item.shipping_deadline || null,
        review_guide: item.review_guide || null,
        courier_service_yn: item.courier_service_yn || null,
        notes: item.notes || null,
        platform: item.platform || '-',
        registered_at: new Date().toISOString(),
        sale_price_per_unit: item.sale_price_per_unit ? parseInt(item.sale_price_per_unit) : null,
        courier_price_per_unit: item.courier_price_per_unit ? parseInt(item.courier_price_per_unit) : null
      }));
      onSaveBulk(itemsData);
      return;
    }

    // 단일 품목
    const itemData = parsedItems.length === 1 ? parsedItems[0] : formData;

    // 일 구매 건수 검증
    const validation = validateDailyPurchaseCount(itemData.total_purchase_count, itemData.daily_purchase_count);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    const saveData = {
      product_name: itemData.product_name,
      description: itemData.description || null,
      status: itemData.status || 'active',
      shipping_type: itemData.shipping_type || null,
      keyword: itemData.keyword || null,
      total_purchase_count: itemData.total_purchase_count ? parseInt(itemData.total_purchase_count) : null,
      daily_purchase_count: itemData.daily_purchase_count || null, // 슬래시 포함 문자열 저장
      product_url: itemData.product_url || null,
      purchase_option: itemData.purchase_option || null,
      product_price: itemData.product_price || null,
      shipping_deadline: itemData.shipping_deadline || null,
      review_guide: itemData.review_guide || null,
      courier_service_yn: itemData.courier_service_yn || null,
      notes: itemData.notes || null,
      platform: itemData.platform || '-',
      registered_at: itemData.registered_at ? new Date(itemData.registered_at).toISOString() : new Date().toISOString(),
      sale_price_per_unit: itemData.sale_price_per_unit ? parseInt(itemData.sale_price_per_unit) : null,
      courier_price_per_unit: itemData.courier_price_per_unit ? parseInt(itemData.courier_price_per_unit) : null
    };

    onSave(saveData);
  };

  const isEdit = mode === 'edit';

  const samplePlaceholder = `제품 미출고/실출고 : 실출고
총 구매 건수 : 12
일 구매 건수 : 6/6
상품 확인Url : https://www.coupang.com/vp/products/...
제품명 : 푸드올로지 콜레올로지컷 다이어트 유산균
구매 옵션 : 푸드올로지 콜레올로지컷, 20정, 1개
제품 구매 가격 : 27600
리뷰가이드 및 소구점 : 100자 이상 포토리뷰
택배대행 Y/N : N
희망 유입 키워드 : 다이어트유산균 장건강
출고 마감 시간 : 오후1시마감
플랫폼 : 쿠팡

※ 필수: 총 구매 건수, 일 구매 건수 (합계 일치 필요)
※ 플랫폼: 쿠팡, 네이버, 11번가, 지마켓, 옥션, 티몬, 위메프 등
※ 여러 품목 추가 시 빈 줄로 구분해주세요.`;

  return (
    <Dialog open={open} onClose={(event, reason) => { if (reason !== 'backdropClick') onClose(); }} fullWidth maxWidth="xl">
      <DialogTitle sx={{ fontWeight: 'bold', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 1 }}>
        {isEdit ? <EditIcon color="primary" /> : <AddCircleIcon color="success" />}
        {isEdit ? '제품 수정' : '제품 추가'}
        {parsedItems.length > 1 && inputMode === 'paste' && (
          <Chip label={`${parsedItems.length}개 품목`} color="primary" size="small" sx={{ ml: 1 }} />
        )}
        {combinedProducts.length > 0 && inputMode === 'combine' && (
          <Chip label={`${combinedProducts.length}개 제품 합치기`} color="success" size="small" sx={{ ml: 1 }} />
        )}
      </DialogTitle>

      <DialogContent sx={{ mt: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* 생성 모드 */}
        {!isEdit && (
          <>
            {/* 탭 선택: 붙여넣기 / 제품 합치기 */}
            <Tabs
              value={inputMode}
              onChange={(e, v) => setInputMode(v)}
              sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
            >
              <Tab
                value="paste"
                icon={<ContentPasteIcon />}
                iconPosition="start"
                label="붙여넣기"
                sx={{ minHeight: 48 }}
              />
              <Tab
                value="combine"
                icon={<MergeTypeIcon />}
                iconPosition="start"
                label="제품 합치기"
                sx={{ minHeight: 48 }}
              />
            </Tabs>

            {/* 붙여넣기 모드 */}
            {inputMode === 'paste' && (
              <>
                <Paper sx={{ p: 2, mb: 3, border: '2px solid #e3f2fd', borderRadius: 2, bgcolor: '#fafafa' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <ContentPasteIcon color="primary" />
                    <Typography variant="subtitle1" color="primary" fontWeight="bold">
                      데이터 붙여넣기 (여러 품목 동시 추가 가능)
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1.5 }}>
                    <InfoOutlinedIcon sx={{ color: 'text.secondary', fontSize: 20, mt: 0.3 }} />
                    <Typography variant="body2" color="text.secondary">
                      품목별로 빈 줄로 구분하거나 "상품 확인 URL"로 시작하면 자동으로 여러 품목을 인식합니다.
                      <br />
                      <strong>특이사항</strong>에 "리뷰가이드, 가격, 출고마감시간"이 자동 합쳐져 저장됩니다.
                    </Typography>
                  </Box>
                  <TextField
                    multiline
                    rows={8}
                    fullWidth
                    value={pasteText}
                    onChange={handlePasteTextChange}
                    placeholder={samplePlaceholder}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        bgcolor: 'white',
                        fontFamily: 'monospace',
                        fontSize: '0.85rem'
                      }
                    }}
                  />
                </Paper>

            {/* 파싱된 품목 미리보기 */}
            {parsedItems.length > 0 && (
              <Paper sx={{ p: 2, mb: 2 }}>
                <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
                  파싱된 품목 미리보기 ({parsedItems.length}개)
                </Typography>
                <Table size="small" sx={{ '& th, & td': { fontSize: '0.8rem', py: 0.8, px: 1 } }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                      <TableCell sx={{ fontWeight: 'bold', width: 40 }}>#</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', minWidth: 200 }}>제품명</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', width: 90 }}>플랫폼</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', width: 100 }}>출고</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', width: 80 }}>총건수</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', width: 80 }}>일건수</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', minWidth: 150 }}>옵션</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', minWidth: 150 }}>키워드</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', minWidth: 200 }}>특이사항</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', width: 50 }}></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {parsedItems.map((item, index) => (
                      <TableRow key={index} hover>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            value={item.product_name}
                            onChange={(e) => handleItemFieldChange(index, 'product_name', e.target.value)}
                            variant="standard"
                            fullWidth
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            value={item.platform || '-'}
                            onChange={(e) => handleItemFieldChange(index, 'platform', e.target.value)}
                            select
                            variant="standard"
                            fullWidth
                          >
                            <MenuItem value="-">-</MenuItem>
                            <MenuItem value="쿠팡">쿠팡</MenuItem>
                            <MenuItem value="네이버">네이버</MenuItem>
                            <MenuItem value="11번가">11번가</MenuItem>
                            <MenuItem value="지마켓">지마켓</MenuItem>
                            <MenuItem value="옥션">옥션</MenuItem>
                            <MenuItem value="티몬">티몬</MenuItem>
                            <MenuItem value="위메프">위메프</MenuItem>
                            <MenuItem value="기타">기타</MenuItem>
                          </TextField>
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            value={item.shipping_type}
                            onChange={(e) => handleItemFieldChange(index, 'shipping_type', e.target.value)}
                            select
                            variant="standard"
                            fullWidth
                          >
                            <MenuItem value="미출고">미출고</MenuItem>
                            <MenuItem value="실출고">실출고</MenuItem>
                          </TextField>
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            type="number"
                            value={item.total_purchase_count}
                            onChange={(e) => handleItemFieldChange(index, 'total_purchase_count', e.target.value)}
                            variant="standard"
                            fullWidth
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            value={item.daily_purchase_count}
                            onChange={(e) => handleItemFieldChange(index, 'daily_purchase_count', e.target.value)}
                            variant="standard"
                            fullWidth
                            placeholder="6/6"
                            error={item.total_purchase_count && item.daily_purchase_count && sumDailyPurchaseCounts(item.daily_purchase_count) !== parseInt(item.total_purchase_count)}
                            helperText={
                              item.total_purchase_count && item.daily_purchase_count &&
                              sumDailyPurchaseCounts(item.daily_purchase_count) !== parseInt(item.total_purchase_count)
                                ? `합: ${sumDailyPurchaseCounts(item.daily_purchase_count)}`
                                : ''
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            value={item.purchase_option}
                            onChange={(e) => handleItemFieldChange(index, 'purchase_option', e.target.value)}
                            variant="standard"
                            fullWidth
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            value={item.keyword}
                            onChange={(e) => handleItemFieldChange(index, 'keyword', e.target.value)}
                            variant="standard"
                            fullWidth
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            value={item.notes}
                            onChange={(e) => handleItemFieldChange(index, 'notes', e.target.value)}
                            variant="standard"
                            fullWidth
                          />
                        </TableCell>
                        <TableCell>
                          <Tooltip title="삭제">
                            <IconButton size="small" color="error" onClick={() => handleRemoveItem(index)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            )}

            {/* 단일 품목 상세 편집 (파싱 결과가 1개일 때) */}
            {parsedItems.length === 1 && (
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 2 }}>
                  상세 정보 확인
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  <TextField
                    label="상품 URL"
                    value={parsedItems[0].product_url}
                    onChange={(e) => handleItemFieldChange(0, 'product_url', e.target.value)}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label="플랫폼"
                    value={parsedItems[0].platform || '-'}
                    onChange={(e) => handleItemFieldChange(0, 'platform', e.target.value)}
                    select
                    sx={{ width: 110 }}
                    size="small"
                  >
                    <MenuItem value="-">-</MenuItem>
                    <MenuItem value="쿠팡">쿠팡</MenuItem>
                    <MenuItem value="네이버">네이버</MenuItem>
                    <MenuItem value="11번가">11번가</MenuItem>
                    <MenuItem value="지마켓">지마켓</MenuItem>
                    <MenuItem value="옥션">옥션</MenuItem>
                    <MenuItem value="티몬">티몬</MenuItem>
                    <MenuItem value="위메프">위메프</MenuItem>
                    <MenuItem value="기타">기타</MenuItem>
                  </TextField>
                  <TextField
                    label="리뷰가이드"
                    value={parsedItems[0].review_guide}
                    onChange={(e) => handleItemFieldChange(0, 'review_guide', e.target.value)}
                    sx={{ flex: 1, minWidth: 200 }}
                    size="small"
                  />
                  <TextField
                    label="가격"
                    value={parsedItems[0].product_price}
                    onChange={(e) => handleItemFieldChange(0, 'product_price', e.target.value)}
                    sx={{ width: 120 }}
                    size="small"
                    type="number"
                  />
                  <TextField
                    label="출고마감"
                    value={parsedItems[0].shipping_deadline}
                    onChange={(e) => handleItemFieldChange(0, 'shipping_deadline', e.target.value)}
                    sx={{ width: 150 }}
                    size="small"
                  />
                  <TextField
                    label="택배대행"
                    value={parsedItems[0].courier_service_yn || ''}
                    onChange={(e) => handleItemFieldChange(0, 'courier_service_yn', e.target.value)}
                    sx={{ width: 100 }}
                    size="small"
                    placeholder="Y/N"
                  />
                </Box>
              </Paper>
            )}
              </>
            )}

            {/* 제품 합치기 모드 - 파이프(|) 구분 텍스트를 그대로 저장 */}
            {inputMode === 'combine' && (
              <Paper sx={{ p: 2, mb: 3, border: '2px solid #e8f5e9', borderRadius: 2, bgcolor: '#fafafa' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <MergeTypeIcon color="success" />
                  <Typography variant="subtitle1" color="success.main" fontWeight="bold">
                    제품 합치기 (파이프 | 구분 텍스트)
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1.5 }}>
                  <InfoOutlinedIcon sx={{ color: 'text.secondary', fontSize: 20, mt: 0.3 }} />
                  <Typography variant="body2" color="text.secondary">
                    파이프(|)로 구분된 텍스트를 붙여넣으면 미리보기를 표시하고, DB에는 그대로 저장됩니다.
                    <br />
                    총 구매건수: 파이프 값 중 최대값 / 일 구매건수: 총 구매건수와 동일
                  </Typography>
                </Box>

                {/* 텍스트 입력 영역 */}
                <TextField
                  multiline
                  rows={8}
                  fullWidth
                  value={combineText}
                  onChange={(e) => {
                    const text = e.target.value;
                    setCombineText(text);

                    if (text.trim()) {
                      // 파이프 구분 파싱
                      const parsed = parseCombineText(text);
                      if (parsed) {
                        setParsedItems([parsed]);
                        setError('');
                      } else {
                        setParsedItems([]);
                      }
                    } else {
                      setParsedItems([]);
                    }
                  }}
                  placeholder={`상품 확인 URL : URL1 | URL2
제품명 : 제품A | 제품B
플랫폼 : 쿠팡 | 네이버
구매 옵션 : 옵션A | 옵션B
희망 유입 키워드 : 키워드A | 키워드B
제품 미출고/ 실출고 : 실출고 | 실출고
총 구매 건수 : 12 | 10
일 구매 건수 : (무시됨 - 총건수 최대값 사용)
리뷰 가이드 및 소구점 : 가이드A | 가이드B
제품 구매 가격 : 27600 | 30000
출고 마감 시간 : 오후1시 | 오전10시
택배대행 Y/N : Y | N`}
                  sx={{
                    mb: 1,
                    '& .MuiOutlinedInput-root': {
                      bgcolor: 'white',
                      fontFamily: 'monospace',
                      fontSize: '0.85rem'
                    }
                  }}
                />

                {/* 개별 제품 추가 버튼 */}
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      if (!combineText.trim()) return;
                      // 단일 제품으로 파싱
                      const parsed = parseItemText(combineText);
                      if (parsed.product_name) {
                        setCombinedProducts(prev => [...prev, parsed]);
                        setCombineText('');
                        setError('');
                      } else {
                        setError('제품명을 인식할 수 없습니다.');
                      }
                    }}
                  >
                    제품 추가
                  </Button>
                  <Button
                    variant="text"
                    size="small"
                    color="inherit"
                    onClick={() => {
                      setCombineText('');
                      setCombinedProducts([]);
                      setParsedItems([]);
                    }}
                  >
                    초기화
                  </Button>
                </Box>

                {/* 추가된 제품 목록 테이블 */}
                {combinedProducts.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold', color: '#1565c0' }}>
                      추가된 제품 목록 ({combinedProducts.length}개) - 클릭하여 수정 가능
                    </Typography>
                    <Box sx={{ overflowX: 'auto', border: '1px solid #e0e0e0', borderRadius: 1 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                            <TableCell sx={{ fontWeight: 'bold', width: 40 }}>#</TableCell>
                            <TableCell sx={{ fontWeight: 'bold', minWidth: 150 }}>제품명</TableCell>
                            <TableCell sx={{ fontWeight: 'bold', width: 90 }}>플랫폼</TableCell>
                            <TableCell sx={{ fontWeight: 'bold', width: 80 }}>출고</TableCell>
                            <TableCell sx={{ fontWeight: 'bold', width: 80 }}>총건수</TableCell>
                            <TableCell sx={{ fontWeight: 'bold', minWidth: 100 }}>옵션</TableCell>
                            <TableCell sx={{ fontWeight: 'bold', minWidth: 100 }}>키워드</TableCell>
                            <TableCell sx={{ fontWeight: 'bold', width: 50 }}></TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {combinedProducts.map((item, index) => (
                            <TableRow key={index} hover>
                              <TableCell>{index + 1}</TableCell>
                              <TableCell>
                                <TextField
                                  size="small"
                                  value={item.product_name}
                                  onChange={(e) => handleCombinedProductFieldChange(index, 'product_name', e.target.value)}
                                  variant="standard"
                                  fullWidth
                                />
                              </TableCell>
                              <TableCell>
                                <TextField
                                  size="small"
                                  value={item.platform || '-'}
                                  onChange={(e) => handleCombinedProductFieldChange(index, 'platform', e.target.value)}
                                  variant="standard"
                                  fullWidth
                                />
                              </TableCell>
                              <TableCell>
                                <TextField
                                  size="small"
                                  value={item.shipping_type || ''}
                                  onChange={(e) => handleCombinedProductFieldChange(index, 'shipping_type', e.target.value)}
                                  variant="standard"
                                  fullWidth
                                />
                              </TableCell>
                              <TableCell>
                                <TextField
                                  size="small"
                                  type="number"
                                  value={item.total_purchase_count}
                                  onChange={(e) => handleCombinedProductFieldChange(index, 'total_purchase_count', e.target.value)}
                                  variant="standard"
                                  fullWidth
                                />
                              </TableCell>
                              <TableCell>
                                <TextField
                                  size="small"
                                  value={item.purchase_option || ''}
                                  onChange={(e) => handleCombinedProductFieldChange(index, 'purchase_option', e.target.value)}
                                  variant="standard"
                                  fullWidth
                                />
                              </TableCell>
                              <TableCell>
                                <TextField
                                  size="small"
                                  value={item.keyword || ''}
                                  onChange={(e) => handleCombinedProductFieldChange(index, 'keyword', e.target.value)}
                                  variant="standard"
                                  fullWidth
                                />
                              </TableCell>
                              <TableCell>
                                <IconButton size="small" onClick={() => removeProductFromCombine(index)} color="error">
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Box>

                    {/* 합쳐진 결과 요약 */}
                    {combinedProducts.length >= 2 && (
                      <Box sx={{ mt: 2, p: 1.5, bgcolor: '#e8f5e9', borderRadius: 1, border: '1px solid #a5d6a7' }}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#2e7d32', mb: 0.5 }}>
                          합쳐진 결과 (총건수: {Math.max(...combinedProducts.map(p => parseInt(p.total_purchase_count) || 0))}개 슬롯 생성)
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          제품명: {combinedProducts.map(p => p.product_name).filter(Boolean).join(' | ')}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                )}

                {/* 파이프 텍스트 파싱된 결과 미리보기 */}
                {parsedItems.length === 1 && parsedItems[0].product_name && combinedProducts.length === 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold', color: '#1565c0' }}>
                      파싱 결과 미리보기 (DB 저장 데이터)
                    </Typography>
                    <Box sx={{ bgcolor: '#fff', border: '1px solid #e0e0e0', borderRadius: 1, p: 2 }}>
                      <Table size="small">
                        <TableBody>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', width: 120 }}>제품명</TableCell>
                            <TableCell>{parsedItems[0].product_name}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>플랫폼</TableCell>
                            <TableCell>{parsedItems[0].platform || '-'}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>출고</TableCell>
                            <TableCell>{parsedItems[0].shipping_type || '-'}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>총건수</TableCell>
                            <TableCell sx={{ color: '#d32f2f', fontWeight: 'bold' }}>{parsedItems[0].total_purchase_count} (최대값)</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>일건수</TableCell>
                            <TableCell sx={{ color: '#d32f2f', fontWeight: 'bold' }}>{parsedItems[0].daily_purchase_count} (= 총건수)</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>옵션</TableCell>
                            <TableCell>{parsedItems[0].purchase_option || '-'}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>키워드</TableCell>
                            <TableCell>{parsedItems[0].keyword || '-'}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>가격</TableCell>
                            <TableCell>{parsedItems[0].product_price || '-'}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>택배대행</TableCell>
                            <TableCell>{parsedItems[0].courier_service_yn || '-'}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>URL</TableCell>
                            <TableCell sx={{ wordBreak: 'break-all' }}>{renderUrlLinks(parsedItems[0].product_url)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </Box>
                  </Box>
                )}
              </Paper>
            )}
          </>
        )}

        {/* 수정 모드 */}
        {isEdit && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              제품 정보를 수정합니다.
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'flex-start' }}>
              <Typography fontWeight="bold" sx={{ minWidth: 80, pt: 2 }}>기본 정보</Typography>
              <TextField
                label="제품명"
                name="product_name"
                fullWidth
                value={formData.product_name}
                onChange={handleInputChange}
              />
              <TextField
                label="상태"
                name="status"
                fullWidth
                select
                value={formData.status}
                onChange={handleInputChange}
                sx={{ minWidth: 120 }}
              >
                <MenuItem value="active">진행 중</MenuItem>
                <MenuItem value="completed">완료</MenuItem>
                <MenuItem value="cancelled">취소</MenuItem>
              </TextField>
            </Box>

            <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'flex-start' }}>
              <Typography fontWeight="bold" sx={{ minWidth: 80, pt: 2 }}>제품 정보</Typography>
              <TextField
                label="플랫폼"
                name="platform"
                select
                value={formData.platform}
                onChange={handleInputChange}
                sx={{ minWidth: 110 }}
              >
                <MenuItem value="-">-</MenuItem>
                <MenuItem value="쿠팡">쿠팡</MenuItem>
                <MenuItem value="네이버">네이버</MenuItem>
                <MenuItem value="11번가">11번가</MenuItem>
                <MenuItem value="지마켓">지마켓</MenuItem>
                <MenuItem value="옥션">옥션</MenuItem>
                <MenuItem value="티몬">티몬</MenuItem>
                <MenuItem value="위메프">위메프</MenuItem>
                <MenuItem value="기타">기타</MenuItem>
              </TextField>
              <TextField
                label="미출고/실출고"
                name="shipping_type"
                select
                value={formData.shipping_type}
                onChange={handleInputChange}
                sx={{ minWidth: 120 }}
              >
                <MenuItem value="미출고">미출고</MenuItem>
                <MenuItem value="실출고">실출고</MenuItem>
              </TextField>
              <TextField
                label="총 구매건수"
                name="total_purchase_count"
                type="number"
                value={formData.total_purchase_count}
                onChange={handleInputChange}
                sx={{ width: 120 }}
              />
              <TextField
                label="일 구매건수"
                name="daily_purchase_count"
                value={formData.daily_purchase_count}
                onChange={handleInputChange}
                sx={{ width: 150 }}
                placeholder="6/6 또는 1/3/4/2"
                error={formData.total_purchase_count && formData.daily_purchase_count && sumDailyPurchaseCounts(formData.daily_purchase_count) !== parseInt(formData.total_purchase_count)}
                helperText={
                  formData.total_purchase_count && formData.daily_purchase_count
                    ? sumDailyPurchaseCounts(formData.daily_purchase_count) !== parseInt(formData.total_purchase_count)
                      ? `합: ${sumDailyPurchaseCounts(formData.daily_purchase_count)} ≠ ${formData.total_purchase_count}`
                      : `합: ${sumDailyPurchaseCounts(formData.daily_purchase_count)} ✓`
                    : '예: 6/6'
                }
              />
              <TextField
                label="가격(원)"
                name="product_price"
                type="number"
                value={formData.product_price}
                onChange={handleInputChange}
                sx={{ width: 120 }}
              />
            </Box>

            <Box sx={{ display: 'flex', gap: 2, mb: 2, pl: '96px' }}>
              <TextField
                label="상품 URL"
                name="product_url"
                fullWidth
                value={formData.product_url}
                onChange={handleInputChange}
              />
            </Box>

            <Box sx={{ display: 'flex', gap: 2, mb: 2, pl: '96px' }}>
              <TextField
                label="구매 옵션"
                name="purchase_option"
                value={formData.purchase_option}
                onChange={handleInputChange}
                sx={{ flex: 1 }}
              />
              <TextField
                label="키워드"
                name="keyword"
                value={formData.keyword}
                onChange={handleInputChange}
                sx={{ flex: 1 }}
              />
            </Box>

            <Box sx={{ display: 'flex', gap: 2, mb: 2, pl: '96px' }}>
              <TextField
                label="리뷰가이드"
                name="review_guide"
                multiline
                rows={2}
                value={formData.review_guide}
                onChange={handleInputChange}
                fullWidth
              />
            </Box>

            <Box sx={{ display: 'flex', gap: 2, mb: 2, pl: '96px' }}>
              <TextField
                label="특이사항"
                name="notes"
                multiline
                rows={2}
                value={formData.notes}
                onChange={handleInputChange}
                fullWidth
                helperText="리뷰가이드, 가격, 출고마감 등 종합 정보"
              />
            </Box>

            {/* 매출 정보 섹션 */}
            <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'flex-start' }}>
              <Typography fontWeight="bold" sx={{ minWidth: 80, pt: 2 }}>매출 정보</Typography>
              <TextField
                label="판매 단가 (원/개)"
                name="sale_price_per_unit"
                type="number"
                value={formData.sale_price_per_unit}
                onChange={handleInputChange}
                sx={{ width: 150 }}
                helperText="견적서 판매 단가"
              />
              <TextField
                label="택배대행 단가 (원/개)"
                name="courier_price_per_unit"
                type="number"
                value={formData.courier_price_per_unit}
                onChange={handleInputChange}
                sx={{ width: 180 }}
                disabled={!formData.courier_service_yn}
                helperText={formData.courier_service_yn ? "견적서 택배 단가" : "택배대행 N일 때 비활성화"}
              />
            </Box>

            {/* 예상 매출 미리보기 */}
            {(formData.sale_price_per_unit || formData.courier_price_per_unit) && formData.total_purchase_count && (
              <Paper sx={{ p: 2, mb: 2, ml: '96px', bgcolor: '#e8f5e9', border: '1px solid #a5d6a7' }}>
                <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1, color: '#2e7d32' }}>
                  예상 매출 미리보기
                </Typography>
                {(() => {
                  const count = parseInt(formData.total_purchase_count) || 0;
                  const salePrice = parseInt(formData.sale_price_per_unit) || 0;
                  const courierPrice = formData.courier_service_yn ? (parseInt(formData.courier_price_per_unit) || 0) : 0;
                  const saleRevenue = salePrice * count;
                  const courierRevenue = courierPrice * count;
                  const totalRevenue = saleRevenue + courierRevenue;
                  const totalRevenueVat = Math.round(totalRevenue * 1.1);
                  return (
                    <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">판매매출</Typography>
                        <Typography variant="body2">{saleRevenue.toLocaleString()}원</Typography>
                      </Box>
                      {formData.courier_service_yn && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">택배매출</Typography>
                          <Typography variant="body2">{courierRevenue.toLocaleString()}원</Typography>
                        </Box>
                      )}
                      <Box>
                        <Typography variant="caption" color="text.secondary">총 매출 (공급가)</Typography>
                        <Typography variant="body2" fontWeight="bold">{totalRevenue.toLocaleString()}원</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">총 매출 (VAT 포함)</Typography>
                        <Typography variant="body2" fontWeight="bold" color="primary">{totalRevenueVat.toLocaleString()}원</Typography>
                      </Box>
                    </Box>
                  );
                })()}
              </Paper>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3, borderTop: '1px solid #eee' }}>
        <Button onClick={onClose} color="inherit" size="large">
          취소
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          color={isEdit ? 'primary' : 'success'}
          size="large"
          disableElevation
          disabled={
            isEdit
              ? false
              : inputMode === 'combine'
                ? parsedItems.length === 0 || !parsedItems[0]?.product_name
                : parsedItems.length === 0 && !formData.product_name
          }
        >
          {isEdit
            ? '수정하기'
            : inputMode === 'combine'
              ? parsedItems.length > 0 && parsedItems[0]?.product_name
                ? '제품 추가'
                : '파이프(|) 텍스트 입력'
              : parsedItems.length > 1
                ? `${parsedItems.length}개 품목 추가`
                : '추가하기'
          }
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default SalesItemDialog;
