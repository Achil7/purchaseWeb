/**
 * 올리브영 카테고리 BEST 페이지 정의 (실제 URL 검증 완료)
 *
 * - 21개 카테고리 (전체 + 20개 세부)
 * - URL: https://www.oliveyoung.co.kr/store/main/getBestList.do?dispCatNo=...&fltDispCatNo=...
 * - "전체"는 fltDispCatNo 없음 (빈 값)
 */

const CATEGORIES = [
  { id: 'all',         name: '전체',          dispCatNo: '900000100100001', fltDispCatNo: '' },
  { id: 'skincare',    name: '스킨케어',      dispCatNo: '900000100100001', fltDispCatNo: '10000010001' },
  { id: 'mask',        name: '마스크팩',      dispCatNo: '900000100100001', fltDispCatNo: '10000010009' },
  { id: 'cleansing',   name: '클렌징',        dispCatNo: '900000100100001', fltDispCatNo: '10000010010' },
  { id: 'suncare',     name: '선케어',        dispCatNo: '900000100100001', fltDispCatNo: '10000010011' },
  { id: 'makeup',      name: '메이크업',      dispCatNo: '900000100100001', fltDispCatNo: '10000010002' },
  { id: 'nail',        name: '네일',          dispCatNo: '900000100100001', fltDispCatNo: '10000010012' },
  { id: 'beauty_tool', name: '뷰티소품',      dispCatNo: '900000100100001', fltDispCatNo: '10000010006' },
  { id: 'dermo',       name: '더모 코스메틱', dispCatNo: '900000100100001', fltDispCatNo: '10000010008' },
  { id: 'mens',        name: '맨즈에딧',      dispCatNo: '900000100100001', fltDispCatNo: '10000010007' },
  { id: 'fragrance',   name: '향수/디퓨저',   dispCatNo: '900000100100001', fltDispCatNo: '10000010005' },
  { id: 'haircare',    name: '헤어케어',      dispCatNo: '900000100100001', fltDispCatNo: '10000010004' },
  { id: 'bodycare',    name: '바디케어',      dispCatNo: '900000100100001', fltDispCatNo: '10000010003' },
  { id: 'health_food', name: '건강식품',      dispCatNo: '900000100100001', fltDispCatNo: '10000020001' },
  { id: 'food',        name: '푸드',          dispCatNo: '900000100100001', fltDispCatNo: '10000020002' },
  { id: 'oral',        name: '구강용품',      dispCatNo: '900000100100001', fltDispCatNo: '10000020003' },
  { id: 'health_tool', name: '헬스/건강용품', dispCatNo: '900000100100001', fltDispCatNo: '10000020005' },
  { id: 'feminine',    name: '위생용품',      dispCatNo: '900000100100001', fltDispCatNo: '10000020004' },
  { id: 'fashion',     name: '패션',          dispCatNo: '900000100100001', fltDispCatNo: '10000030007' },
  { id: 'lifestyle',   name: '홈리빙/가전',   dispCatNo: '900000100100001', fltDispCatNo: '10000030005' },
  { id: 'hobby',       name: '취미/팬시',     dispCatNo: '900000100100001', fltDispCatNo: '10000030006' }
];

const BASE_URL = 'https://www.oliveyoung.co.kr/store/main/getBestList.do';

function buildBestListUrl(category) {
  const params = new URLSearchParams();
  params.append('dispCatNo', category.dispCatNo);
  if (category.fltDispCatNo) {
    params.append('fltDispCatNo', category.fltDispCatNo);
  }
  return `${BASE_URL}?${params.toString()}`;
}

module.exports = {
  CATEGORIES,
  buildBestListUrl
};
