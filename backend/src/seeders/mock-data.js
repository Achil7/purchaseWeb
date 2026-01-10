/**
 * Mock 데이터 생성 스크립트
 * 로컬 테스트를 위한 샘플 데이터
 */

module.exports = {
  // 사용자 목록
  users: [
    {
      username: 'admin',
      email: 'admin@campmanager.com',
      password: 'admin123!@#',
      name: '관리자',
      role: 'admin',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      username: 'sales1',
      email: 'sales1@company.com',
      password: 'sales123!',
      name: '영업사1',
      role: 'sales',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      username: 'operator1',
      email: 'operator1@company.com',
      password: 'operator123!',
      name: '진행자1',
      role: 'operator',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      username: 'brand1',
      email: 'brand1@company.com',
      password: 'brand123!',
      name: '브랜드사1',
      role: 'brand',
      created_at: new Date(),
      updated_at: new Date()
    }
  ],

  // 캠페인 목록
  campaigns: [
    {
      name: '여름 신상품 리뷰 캠페인',
      description: '2024년 여름 신상품에 대한 리뷰 캠페인입니다.',
      status: 'active',
      sales_user_id: 2, // sales1
      brand_user_id: 4, // brand1
      start_date: new Date('2024-06-01'),
      end_date: new Date('2024-08-31'),
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      name: '가을 시즌 프로모션',
      description: '가을 시즌 특별 할인 이벤트',
      status: 'active',
      sales_user_id: 2,
      brand_user_id: 4,
      start_date: new Date('2024-09-01'),
      end_date: new Date('2024-11-30'),
      created_at: new Date(),
      updated_at: new Date()
    }
  ],

  // 품목 목록
  items: [
    {
      campaign_id: 1,
      name: '무선 이어폰 A100',
      description: '고음질 무선 블루투스 이어폰',
      status: 'active',
      shipping_type: '실출고',
      target_keyword: '무선이어폰 블루투스이어폰 고음질',
      total_purchase_count: 100,
      daily_purchase_count: 10,
      product_url: 'https://example.com/product/a100',
      purchase_option: '블랙 / 기본',
      product_price: 59000,
      shipping_deadline: '18:00',
      review_guide: '제품의 음질과 착용감에 대해 상세히 작성해주세요.',
      delivery_service: true,
      notes: '리뷰 작성 시 사진 3장 이상 필수',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      campaign_id: 1,
      name: '스마트워치 W200',
      description: '건강관리 기능이 있는 스마트워치',
      status: 'active',
      shipping_type: '미출고',
      target_keyword: '스마트워치 건강관리 운동',
      total_purchase_count: 50,
      daily_purchase_count: 5,
      product_url: 'https://example.com/product/w200',
      purchase_option: '실버 / 스포츠밴드',
      product_price: 129000,
      shipping_deadline: '15:00',
      review_guide: '건강 측정 기능과 배터리 수명에 대해 작성해주세요.',
      delivery_service: false,
      notes: '심박수 측정 화면 캡처 필수',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      campaign_id: 2,
      name: '가을 신상 자켓',
      description: '트렌디한 디자인의 가을 자켓',
      status: 'active',
      shipping_type: '실출고',
      target_keyword: '가을자켓 아우터 패션',
      total_purchase_count: 80,
      daily_purchase_count: 8,
      product_url: 'https://example.com/product/jacket01',
      purchase_option: '네이비 / M사이즈',
      product_price: 89000,
      shipping_deadline: '17:00',
      review_guide: '착용샷과 소재감에 대해 상세히 작성해주세요.',
      delivery_service: true,
      notes: '전신샷 포함 필수',
      created_at: new Date(),
      updated_at: new Date()
    }
  ],

  // 진행자 배정
  campaign_operators: [
    {
      campaign_id: 1,
      operator_user_id: 3, // operator1
      assigned_at: new Date()
    },
    {
      campaign_id: 2,
      operator_user_id: 3,
      assigned_at: new Date()
    }
  ],

  // 구매자 목록
  buyers: [
    {
      item_id: 1,
      order_number: '20240601-001',
      buyer_name: '김철수',
      recipient_name: '김철수',
      user_id: 'kimcs@naver.com',
      contact: '010-1234-5678',
      address: '서울특별시 강남구 테헤란로 123 멀티빌딩 10층',
      bank_account: '국민은행 123-456-789012 김철수',
      amount: 59000,
      payment_status: 'completed',
      review_image_url: 'https://example.com/images/review1.jpg',
      notes: '빠른 배송 부탁드립니다',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      item_id: 1,
      order_number: '20240601-002',
      buyer_name: '이영희',
      recipient_name: '이영희',
      user_id: 'leeyh@gmail.com',
      contact: '010-2345-6789',
      address: '경기도 성남시 분당구 정자동 123-45',
      bank_account: '신한은행 987-654-321098 이영희',
      amount: 59000,
      payment_status: 'pending',
      review_image_url: null,
      notes: '',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      item_id: 2,
      order_number: '20240602-001',
      buyer_name: '박민수',
      recipient_name: '박민수',
      user_id: 'parkms@hanmail.net',
      contact: '010-3456-7890',
      address: '인천광역시 연수구 송도동 센트럴로 100',
      bank_account: '우리은행 111-222-333444 박민수',
      amount: 129000,
      payment_status: 'completed',
      review_image_url: 'https://example.com/images/review2.jpg',
      notes: '운동 기록 테스트 예정',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      item_id: 3,
      order_number: '20240901-001',
      buyer_name: '정수진',
      recipient_name: '정수진',
      user_id: 'jungsj@naver.com',
      contact: '010-4567-8901',
      address: '부산광역시 해운대구 우동 123번지',
      bank_account: 'KEB하나은행 555-666-777888 정수진',
      amount: 89000,
      payment_status: 'completed',
      review_image_url: 'https://example.com/images/review3.jpg',
      notes: '',
      created_at: new Date(),
      updated_at: new Date()
    }
  ]
};
