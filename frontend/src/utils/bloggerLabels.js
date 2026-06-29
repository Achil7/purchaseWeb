// 블로거 협의 요청 관련 라벨/색상 공통 정의

export const REQUEST_STATUS = {
  requested: { label: '요청됨', color: 'info' },
  reviewing: { label: '확인중', color: 'warning' },
  in_progress: { label: '진행중', color: 'primary' },
  completed: { label: '완료', color: 'success' },
  cancelled: { label: '취소', color: 'default' }
};

export const PARTICIPATION_STATUS = {
  pending: { label: '대기', color: 'default' },
  accepted: { label: '참여', color: 'success' },
  declined: { label: '거절', color: 'error' }
};

export const PRODUCT_PROVISION = {
  sponsored: '협찬(배송)',
  self_purchase: '내돈내산'
};

export const requestStatusLabel = (s) => REQUEST_STATUS[s]?.label || s || '-';
export const requestStatusColor = (s) => REQUEST_STATUS[s]?.color || 'default';
export const participationLabel = (s) => PARTICIPATION_STATUS[s]?.label || s || '-';
export const participationColor = (s) => PARTICIPATION_STATUS[s]?.color || 'default';
export const provisionLabel = (p) => PRODUCT_PROVISION[p] || (p || '-');
