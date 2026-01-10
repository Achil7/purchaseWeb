// 로컬 테스트용 Mock 데이터
// DB 연결 없이 API 테스트 가능

const mockUsers = [
  { id: 1, username: 'admin', name: '시스템 관리자', role: 'admin' },
  { id: 2, username: 'sales1', name: '영업사1', role: 'sales' },
  { id: 3, username: 'operator1', name: '진행자1', role: 'operator' },
  { id: 4, username: 'brand1', name: '브랜드사1', role: 'brand' }
];

const mockCampaigns = [
  {
    id: 1,
    name: '여름 시즌 프로모션',
    description: '여름 신상품 리뷰 캠페인',
    created_by: 2,
    brand_id: 4,
    status: 'active',
    start_date: '2024-06-01',
    end_date: '2024-08-31',
    created_at: '2024-06-01T00:00:00Z',
    updated_at: '2024-06-01T00:00:00Z',
    creator: { id: 2, name: '영업사1', username: 'sales1' },
    brand: { id: 4, name: '브랜드사1', username: 'brand1' },
    items: []
  },
  {
    id: 2,
    name: '신제품 론칭 캠페인',
    description: '신제품 리뷰 이벤트',
    created_by: 2,
    brand_id: 4,
    status: 'active',
    start_date: '2024-07-01',
    end_date: '2024-09-30',
    created_at: '2024-07-01T00:00:00Z',
    updated_at: '2024-07-01T00:00:00Z',
    creator: { id: 2, name: '영업사1', username: 'sales1' },
    brand: { id: 4, name: '브랜드사1', username: 'brand1' },
    items: []
  }
];

const mockItems = [
  {
    id: 1,
    campaign_id: 1,
    product_name: '올리브영 스킨케어 세트',
    shipping_type: '실출고',
    keyword: '스킨케어',
    total_purchase_count: 40,
    daily_purchase_count: 10,
    product_url: 'https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000224888',
    purchase_option: '1개',
    product_price: 25560.00,
    shipping_deadline: null,
    review_guide: '포토리뷰 작성',
    courier_service_yn: false,
    notes: '9시 20개, 10시 20개 구매',
    upload_link_token: 'mock-token-1',
    status: 'active',
    created_at: '2024-06-01T00:00:00Z',
    updated_at: '2024-06-01T00:00:00Z',
    campaign: { id: 1, name: '여름 시즌 프로모션' },
    buyers: []
  },
  {
    id: 2,
    campaign_id: 1,
    product_name: '여름 선크림 세트',
    shipping_type: '실출고',
    keyword: '선크림',
    total_purchase_count: 30,
    daily_purchase_count: 15,
    product_url: 'https://example.com/product2',
    purchase_option: '2개',
    product_price: 35000.00,
    shipping_deadline: null,
    review_guide: '상세 후기 작성',
    courier_service_yn: false,
    notes: '재고 충분',
    upload_link_token: 'mock-token-2',
    status: 'active',
    created_at: '2024-06-05T00:00:00Z',
    updated_at: '2024-06-05T00:00:00Z',
    campaign: { id: 1, name: '여름 시즌 프로모션' },
    buyers: []
  }
];

const mockBuyers = [
  {
    id: 1,
    item_id: 1,
    order_number: '8100156654664',
    buyer_name: '김민형',
    recipient_name: '김민형',
    user_id: 'p4che@naver.com',
    contact: '010-8221-1864',
    address: '경남 거제시 사등면 두동로 54-40 영진자이온 201동 18층 5호',
    account_info: '부산112-2323-738601 김민지',
    amount: 22800.00,
    payment_status: 'pending',
    payment_confirmed_by: null,
    payment_confirmed_at: null,
    notes: '',
    created_by: 3,
    created_at: '2024-06-10T00:00:00Z',
    updated_at: '2024-06-10T00:00:00Z',
    item: {
      id: 1,
      product_name: '올리브영 스킨케어 세트',
      campaign: { id: 1, name: '여름 시즌 프로모션' }
    },
    images: [],
    creator: { id: 3, name: '진행자1', username: 'operator1' }
  },
  {
    id: 2,
    item_id: 1,
    order_number: '8100156654665',
    buyer_name: '이영희',
    recipient_name: '이영희',
    user_id: 'younghee@naver.com',
    contact: '010-1234-5678',
    address: '서울시 강남구 테헤란로 123',
    account_info: '신한 110-123-456789 이영희',
    amount: 25560.00,
    payment_status: 'completed',
    payment_confirmed_by: 1,
    payment_confirmed_at: '2024-06-11T00:00:00Z',
    notes: '빠른 배송 요청',
    created_by: 3,
    created_at: '2024-06-11T00:00:00Z',
    updated_at: '2024-06-11T00:00:00Z',
    item: {
      id: 1,
      product_name: '올리브영 스킨케어 세트',
      campaign: { id: 1, name: '여름 시즌 프로모션' }
    },
    images: [],
    creator: { id: 3, name: '진행자1', username: 'operator1' }
  }
];

const mockCampaignOperators = [
  { id: 1, campaign_id: 1, item_id: null, operator_id: 3, assigned_by: 1, assigned_at: '2024-06-01T00:00:00Z' },
  { id: 2, campaign_id: 2, item_id: null, operator_id: 3, assigned_by: 1, assigned_at: '2024-07-01T00:00:00Z' }
];

module.exports = {
  mockUsers,
  mockCampaigns,
  mockItems,
  mockBuyers,
  mockCampaignOperators
};
