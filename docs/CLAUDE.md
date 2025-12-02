# CLAUDE.md - CampManager 프로젝트 가이드

**최종 업데이트:** 2025-12-02
**프로젝트:** purchaseWeb (CampManager)
**버전:** 0.1.0

## 목차
1. [프로젝트 개요](#프로젝트-개요)
2. [기술 스택](#기술-스택)
3. [코드베이스 구조](#코드베이스-구조)
4. [사용자 역할 및 접근 패턴](#사용자-역할-및-접근-패턴)
5. [라우팅 아키텍처](#라우팅-아키텍처)
6. [컴포넌트 패턴 및 규칙](#컴포넌트-패턴-및-규칙)
7. [개발 워크플로우](#개발-워크플로우)
8. [주요 파일 참조](#주요-파일-참조)
9. [AI 어시스턴트를 위한 가이드라인](#ai-어시스턴트를-위한-가이드라인)

---

## 프로젝트 개요

**CampManager**는 React로 구축된 다중 역할 캠페인 관리 웹 애플리케이션입니다. 마케팅 캠페인, 제품(품목), 구매자/리뷰를 관리하기 위한 역할 기반 대시보드를 제공합니다.

### 주요 사용자 역할
- **영업사 (Sales)**: 캠페인 등록 및 관리
- **총관리자 (Admin)**: 진행자 배정 및 전체 관리
- **진행자 (Operator)**: 리뷰 작성 및 캠페인 실행
- **브랜드사 (Brand)**: 결과 조회 및 모니터링

### 핵심 기능
- 다단계 드릴다운 네비게이션 (캠페인 → 품목 → 구매자)
- 역할 기반 접근 제어 및 UI 커스터마이징
- 캠페인 배정 및 진행자 관리
- 코드 재사용성을 위한 공유 컴포넌트 아키텍처

---

## 기술 스택

### 핵심 프레임워크
- **React 19.2.0** - 최신 기능을 갖춘 모던 React
- **React Router DOM 7.9.6** - 중첩 라우트를 지원하는 클라이언트 사이드 라우팅
- **Create React App 5.0.1** - 빌드 도구 및 개발 서버

### UI 프레임워크
- **Material-UI (MUI) 7.3.5** - 주요 컴포넌트 라이브러리
  - `@mui/material` - 핵심 컴포넌트
  - `@mui/icons-material` - 아이콘 라이브러리
  - `@emotion/react` & `@emotion/styled` - CSS-in-JS 스타일링
- **Lucide React 0.555.0** - 추가 아이콘 라이브러리

### 테스팅
- **Jest** - 테스트 러너 (react-scripts를 통해)
- **React Testing Library 16.3.0** - 컴포넌트 테스팅
- **@testing-library/jest-dom 6.9.1** - 커스텀 매처
- **@testing-library/user-event 13.5.0** - 사용자 상호작용 시뮬레이션

### 개발 도구
- **ESLint** - 코드 린팅 (react-app을 통해 설정됨)
- **Web Vitals 2.1.4** - 성능 모니터링

---

## 코드베이스 구조

```
purchaseWeb/
├── public/                      # 정적 자산
│   ├── index.html              # HTML 템플릿
│   ├── favicon.ico             # 사이트 아이콘
│   ├── logo192.png             # PWA 아이콘 (192x192)
│   ├── logo512.png             # PWA 아이콘 (512x512)
│   ├── manifest.json           # PWA 매니페스트
│   └── robots.txt              # 검색 엔진 지시문
│
├── src/                        # 소스 코드
│   ├── components/             # React 컴포넌트
│   │   ├── admin/             # 관리자 전용 컴포넌트
│   │   │   └── AdminDashboard.js
│   │   ├── brand/             # 브랜드사 전용 컴포넌트
│   │   │   ├── BrandLayout.js
│   │   │   ├── BrandCampaignTable.js
│   │   │   ├── BrandItemTable.js
│   │   │   └── BrandBuyerTable.js
│   │   ├── operator/          # 진행자 전용 컴포넌트
│   │   │   ├── OperatorLayout.js
│   │   │   ├── OperatorCampaignTable.js
│   │   │   ├── OperatorItemTable.js
│   │   │   ├── OperatorBuyerTable.js
│   │   │   ├── OperatorHome.js
│   │   │   └── OperatorAddBuyerDialog.js
│   │   ├── sales/             # 영업사 전용 컴포넌트
│   │   │   └── SalesDashboard.js
│   │   └── SharedCampaignTable.js  # 모든 역할이 공유하는 컴포넌트
│   │
│   ├── App.js                 # 라우팅을 포함한 메인 앱 컴포넌트
│   ├── App.css                # 앱 레벨 스타일
│   ├── App.test.js            # 앱 컴포넌트 테스트
│   ├── index.js               # 애플리케이션 진입점
│   ├── index.css              # 전역 스타일
│   ├── setupTests.js          # 테스트 설정
│   └── reportWebVitals.js     # 성능 모니터링
│
├── .gitignore                 # Git 무시 규칙
├── package.json               # 의존성 및 스크립트
├── package-lock.json          # 의존성 락 파일
├── README.md                  # 표준 CRA 문서
└── CLAUDE.md                  # 이 파일 (AI 어시스턴트 가이드)
```

### 디렉토리 규칙

1. **역할별 컴포넌트 구성**: 컴포넌트는 역할별 폴더로 구성됩니다 (`admin/`, `brand/`, `operator/`, `sales/`)
2. **공유 컴포넌트**: 여러 역할이 사용하는 컴포넌트는 `components/` 루트에 배치됩니다 (예: `SharedCampaignTable.js`)
3. **레이아웃 패턴**: 각 역할은 중첩 라우트를 감싸는 전용 Layout 컴포넌트를 가집니다
4. **네이밍 규칙**: 컴포넌트는 역할 접두사를 포함한 PascalCase를 사용합니다 (예: `OperatorLayout`, `BrandCampaignTable`)

---

## 사용자 역할 및 접근 패턴

### 역할 상수
`src/components/SharedCampaignTable.js:12-17`에 정의됨:

```javascript
export const USER_ROLES = {
  SALES: 'SALES',       // 영업사
  ADMIN: 'ADMIN',       // 총 관리자
  OPERATOR: 'OPERATOR', // 진행자
  BRAND: 'BRAND'        // 브랜드사
};
```

### 역할별 기능

| 역할 | 주요 기능 | 핵심 특징 |
|------|---------|----------|
| **Sales (영업사)** | 캠페인 생성 | 신규 캠페인 등록, 캠페인 관리 |
| **Admin (총관리자)** | 시스템 관리 | 진행자 배정, 전체 캠페인 접근 |
| **Operator (진행자)** | 캠페인 실행 | 리뷰 작성, 구매자 관리 |
| **Brand (브랜드사)** | 결과 조회 | 캠페인 결과, 성과 모니터링 |

### 접근 제어 패턴
- 각 역할은 역할별 헤더/네비게이션을 가진 전용 Layout 컴포넌트를 가집니다
- `SharedCampaignTable` 컴포넌트는 `userRole` prop에 따라 UI를 조정합니다
- 역할에 따라 다른 컬럼과 액션이 표시/숨김 처리됩니다
- 네비게이션 경로는 역할 접두사를 포함합니다 (예: `/operator/campaign/1`)

---

## 라우팅 아키텍처

### 라우트 구조 (`src/App.js`에서)

```
/                                    → Home (역할 선택)
├── /sales                          → SalesDashboard
├── /admin                          → AdminDashboard
├── /operator                       → OperatorLayout
│   ├── index                       → OperatorCampaignTable (캠페인 목록)
│   ├── campaign/:campaignId        → OperatorItemTable (캠페인 내 품목)
│   └── campaign/:campaignId/item/:itemId → OperatorBuyerTable (구매자/리뷰)
└── /brand                          → BrandLayout
    ├── index                       → BrandCampaignTable (캠페인 목록)
    ├── campaign/:campaignId        → BrandItemTable (캠페인 내 품목)
    └── campaign/:campaignId/item/:itemId → BrandBuyerTable (구매자/리뷰)
```

### 드릴다운 네비게이션 패턴
앱은 Operator와 Brand 역할을 위한 3단계 드릴다운 구조를 구현합니다:

1. **1단계**: 캠페인 목록 (인덱스 라우트)
2. **2단계**: 캠페인 내 품목 (`campaign/:campaignId`)
3. **3단계**: 품목의 구매자/리뷰 (`campaign/:campaignId/item/:itemId`)

### URL 파라미터 규칙
- `:campaignId` - 캠페인의 숫자 식별자
- `:itemId` - 품목/제품의 숫자 식별자
- 경로의 역할 접두사 (예: `/operator/`, `/brand/`)는 적절한 컨텍스트를 보장합니다

---

## 컴포넌트 패턴 및 규칙

### 레이아웃 컴포넌트
**목적**: 중첩 라우트를 위한 일관된 헤더, 네비게이션, 컨테이너 제공

**예시**: `src/components/operator/OperatorLayout.js:7-58`

주요 특징:
- 역할별 브랜딩을 가진 고정 AppBar
- 사용자 프로필 표시 (현재 하드코딩됨)
- 홈으로 이동하는 로그아웃 버튼
- 중첩 라우트 렌더링을 위한 `<Outlet />`
- 고정 헤더와 콘텐츠 겹침 방지를 위한 Toolbar 스페이서

```javascript
function OperatorLayout() {
  const navigate = useNavigate();
  return (
    <Box>
      <AppBar position="fixed">
        {/* Header content */}
      </AppBar>
      <Toolbar /> {/* Spacer */}
      <Container>
        <Outlet /> {/* 중첩 라우트가 여기에 렌더링됨 */}
      </Container>
    </Box>
  );
}
```

### 공유 컴포넌트 패턴
**예시**: `SharedCampaignTable` 컴포넌트

디자인 원칙:
- 동작을 커스터마이징하기 위해 `userRole` prop을 받습니다
- 역할에 따른 조건부 렌더링
- 역할별 컬럼을 가진 통합 데이터 구조
- 필요할 때 전파를 방지하는 이벤트 핸들러 (`e.stopPropagation()`)

**주요 구현 세부사항** (`src/components/SharedCampaignTable.js`):
- 36-161줄: 역할 기반 커스터마이징을 가진 메인 컴포넌트
- 63-67줄: 역할별 설명 텍스트
- 71-80줄: 조건부 버튼 렌더링 (영업사만)
- 95-97줄: 조건부 컬럼 렌더링 (관리자만)
- 121-140줄: 조건부 진행자 배정 드롭다운

### 테이블 네비게이션 패턴
테이블은 `TableRow`의 `onClick` 핸들러를 사용하여 네비게이션합니다:
```javascript
<TableRow
  onClick={() => navigate(`/${userRole.toLowerCase()}/campaign/${camp.id}`)}
  sx={{ cursor: 'pointer' }}
>
```

### Material-UI 스타일링 패턴
코드베이스는 인라인 스타일링을 위해 MUI의 `sx` prop을 일관되게 사용합니다:
```javascript
<Box sx={{
  minHeight: '100vh',
  bgcolor: '#f5f5f5',
  display: 'flex',
  alignItems: 'center'
}}>
```

### 아이콘 사용
- MUI Icons: 주요 아이콘 라이브러리 (`@mui/icons-material`)
- Lucide React: 추가 옵션을 위한 보조 아이콘 라이브러리
- 아이콘은 버튼, 카드, 테이블 행에서 일관되게 사용됩니다

---

## 개발 워크플로우

### 사용 가능한 스크립트

#### 개발
```bash
npm start
```
- `http://localhost:3000`에서 개발 서버 시작
- 핫 리로딩 활성화
- 브라우저 자동으로 열림

#### 테스팅
```bash
npm test
```
- watch 모드에서 Jest 실행
- 모든 `*.test.js` 파일 실행
- 커버리지 옵션이 있는 대화형 테스트 러너

#### 프로덕션 빌드
```bash
npm run build
```
- `build/` 폴더에 최적화된 프로덕션 빌드 생성
- 코드 최소화 및 소스 맵 생성
- 번들 분석 정보 출력

#### Eject (권장하지 않음)
```bash
npm run eject
```
- 일방향 작업 - 모든 CRA 설정 노출
- 절대 필요한 경우에만 사용

### 개발 서버
- **포트**: 3000 (기본값)
- **핫 리로드**: 활성화
- **에러 오버레이**: 브라우저에서 활성화
- **린트 경고**: 터미널 및 브라우저 콘솔에 표시

### 빌드 출력
- **디렉토리**: `build/`
- **자산**: 캐시 무효화를 위한 해시된 파일명
- **최적화**: 코드 스플리팅, 최소화, 트리 쉐이킹

---

## 주요 파일 참조

### 진입점
- **src/index.js:1-18** - React 앱 초기화, StrictMode 활성화

### 메인 애플리케이션
- **src/App.js:115-149** - 라우터와 모든 라우트 정의를 포함한 메인 App 컴포넌트
- **src/App.js:27-113** - 역할 선택 카드가 있는 Home 컴포넌트

### 라우팅 설정
- **src/App.js:119-147** - Operator와 Brand를 위한 중첩 라우트가 있는 완전한 라우트 트리

### 공유 로직
- **src/components/SharedCampaignTable.js:12-17** - USER_ROLES 상수 정의
- **src/components/SharedCampaignTable.js:20-31** - 캠페인과 진행자를 위한 Mock 데이터 구조

### 레이아웃 템플릿
- **src/components/operator/OperatorLayout.js** - 진행자 역할 레이아웃
- **src/components/brand/BrandLayout.js** - 브랜드 역할 레이아웃

### 설정
- **package.json:21-26** - npm 스크립트
- **package.json:5-20** - 프로젝트 의존성
- **.gitignore** - `node_modules/`만 무시

---

## AI 어시스턴트를 위한 가이드라인

### 코드 수정 원칙

#### 1. **기존 패턴 유지**
- 역할별로 구성된 컴포넌트 구조를 따릅니다
- 네이밍 규칙을 일관되게 유지합니다 (RoleNameComponent 패턴)
- Material-UI 컴포넌트와 `sx` prop을 스타일링에 사용합니다
- 드릴다운 네비게이션 구조를 보존합니다

#### 2. **역할 기반 개발**
기능 추가 시:
- 어떤 역할이 접근해야 하는지 고려합니다
- 기능이 여러 역할에 걸쳐 있으면 `SharedCampaignTable`을 업데이트합니다
- 적절한 디렉토리에 역할별 컴포넌트를 생성합니다
- 중첩 패턴을 따라 `App.js`에 라우트를 추가합니다

#### 3. **컴포넌트 가이드라인**

**새 컴포넌트 생성:**
```javascript
// 적절한 역할 폴더에 배치
// src/components/operator/OperatorNewFeature.js
import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Typography } from '@mui/material';

function OperatorNewFeature() {
  const navigate = useNavigate();
  const { campaignId } = useParams(); // 중첩 라우트인 경우

  return (
    <Box sx={{ /* Material-UI 스타일링 */ }}>
      {/* 컴포넌트 내용 */}
    </Box>
  );
}

export default OperatorNewFeature;
```

**공유 컴포넌트 수정:**
- 컴포넌트를 사용하는 모든 역할을 확인합니다
- 역할에 따라 동작이 다르면 `userRole` 조건부 로직을 추가합니다
- mock 데이터 구조를 일관되게 업데이트합니다
- 모든 역할의 네비게이션 경로를 테스트합니다

#### 4. **라우팅 변경**

**새 라우트 추가:**
1. 라우트가 역할별인지 전역인지 판단합니다
2. `App.js:119-147`에 라우트 정의를 추가합니다
3. 중첩 라우트의 경우, 적절한 Layout의 `<Route>` 블록 내에 추가합니다
4. 올바른 경로 구조를 사용하도록 네비게이션 호출을 업데이트합니다
5. Layout 컴포넌트가 중첩 라우트를 위한 `<Outlet />`을 포함하는지 확인합니다

**경로 구조:**
- 역할별: `/{role}/feature` (예: `/operator/settings`)
- 드릴다운: `/{role}/campaign/:campaignId/item/:itemId`
- 전역: `/feature` (예: `/about`)

#### 5. **데이터 플로우 패턴**

**현재 상태 관리:**
- 컴포넌트는 mock 데이터를 위해 로컬 `useState`를 사용합니다
- 아직 전역 상태 관리 라이브러리(Redux, Context API)가 없습니다
- 데이터는 props를 통해 전달되거나 mock 상수에서 읽습니다

**API 통합 추가 시:**
- mock 데이터 배열을 API 호출로 대체합니다
- 로딩 및 에러 상태 추가를 고려합니다
- 호환성을 위해 동일한 데이터 구조를 유지합니다
- API 소스를 나타내도록 mock 데이터 주석을 업데이트합니다

#### 6. **스타일링 가이드라인**

**Material-UI 테마:**
- MUI 컬러 팔레트 사용 (예: `primary`, `secondary`, `error`)
- 역할별 일관된 컬러 스킴:
  - Operator: Teal/Green (`#00897b`)
  - Brand: Purple (`#8e24aa`)
  - Sales: Blue (`#1976d2`)
  - Admin: Deep Purple (`#673ab7`)

**반응형 디자인:**
- 레이아웃에 MUI Grid 사용
- 반응형 브레이크포인트 적용: `xs`, `sm`, `md`, `lg`, `xl`
- 모바일 및 데스크톱 뷰포트에서 테스트

**간격:**
- `sx` prop에서 MUI 간격 단위 사용 (예: `mt: 4` = 32px)
- 일관된 패딩/마진 패턴 유지

#### 7. **테스팅 고려사항**

**테스트 파일 위치:**
- 테스트 파일을 컴포넌트와 함께 배치하거나 `__tests__` 폴더에 배치
- 네이밍 규칙: `ComponentName.test.js`

**테스트 구조:**
```javascript
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ComponentName from './ComponentName';

test('renders component correctly', () => {
  render(
    <BrowserRouter>
      <ComponentName />
    </BrowserRouter>
  );
  // 테스트 단언
});
```

**테스트 대상:**
- 컴포넌트가 크래시 없이 렌더링되는지
- 역할 기반 조건부 렌더링
- 버튼/행 클릭 시 네비게이션
- Mock 데이터가 올바르게 표시되는지

#### 8. **일반적인 작업**

**새 역할별 페이지 추가:**
1. `src/components/{role}/RoleNewPage.js`에 컴포넌트 생성
2. `src/App.js`에 임포트
3. 적절한 섹션에 라우트 추가
4. Layout 컴포넌트에 네비게이션 링크 추가
5. 네비게이션 플로우 테스트

**캠페인 테이블에 컬럼 추가:**
1. `SharedCampaignTable.js:20-24`에서 mock 데이터 업데이트
2. 헤더(`TableHead`)에 `<TableCell>` 추가
3. 본문(`TableBody`)에 대응하는 `<TableCell>` 추가
4. 조건부 렌더링으로 역할 기반 가시성 고려

**API 통합 구현:**
1. API 유틸리티 파일 생성 (예: `src/services/api.js`)
2. `useState` 초기화를 `useEffect` + API 호출로 대체
3. 로딩 상태 추가: `const [loading, setLoading] = useState(true)`
4. try-catch로 에러 처리 추가
5. 로딩 스피너와 에러 메시지를 표시하도록 UI 업데이트

#### 9. **성능 모범 사례**

- 비용이 많이 드는 컴포넌트의 경우 `React.memo()`로 불필요한 리렌더링 방지
- 자식 컴포넌트에 전달되는 이벤트 핸들러에 `useCallback` 사용
- 대용량 데이터 테이블에 페이지네이션 구현 (현재는 없음)
- 번들 크기가 커지면 라우트 지연 로딩: `React.lazy()` + `Suspense`

#### 10. **접근성**

- 모든 상호작용 요소에 적절한 `aria-label` 보장
- 키보드 네비게이션 지원 유지
- 시맨틱 HTML 요소 사용
- 복잡한 상호작용 추가 시 스크린 리더로 테스트

### 피해야 할 일반적인 함정

1. **네비게이션 이슈**
   - ❌ 내부 링크에 `<a>` 태그 사용하지 않기
   - ✅ `useNavigate()` 훅의 `navigate()` 또는 `<Link>` 컴포넌트 사용

2. **라우트 파라미터 불일치**
   - ❌ 네비게이션에 ID 하드코딩하지 않기
   - ✅ 템플릿 리터럴 사용: `` navigate(`/operator/campaign/${id}`) ``

3. **테이블의 이벤트 전파**
   - ❌ 클릭 가능한 행 내부의 상호작용 요소에서 `e.stopPropagation()` 잊지 않기
   - ✅ 행 내부의 드롭다운, 버튼에 `onClick={(e) => e.stopPropagation()}` 추가

4. **스타일 충돌**
   - ❌ 인라인 스타일과 `sx` prop 혼용하지 않기
   - ✅ Material-UI 컴포넌트에는 `sx` prop을 일관되게 사용

5. **Mock 데이터 관리**
   - ❌ 컴포넌트 간에 mock 데이터 중복하지 않기
   - ✅ 공유 파일 또는 최상위 컴포넌트에 mock 데이터 유지

### 파일 수정 체크리스트

코드 수정 시 확인사항:
- [ ] import 문이 올바르고 컴포넌트가 존재하는지
- [ ] 라우트 경로가 네비게이션 호출과 일치하는지
- [ ] 영향받는 컴포넌트 전체에서 역할 기반 로직이 일관되는지
- [ ] 브라우저에 콘솔 에러가 없는지
- [ ] 관련된 모든 역할에 대해 컴포넌트가 올바르게 렌더링되는지
- [ ] 네비게이션 플로우가 종단간 작동하는지
- [ ] 스타일이 기존 패턴과 일관되는지
- [ ] 주석이 복잡한 로직을 설명하는지 (한국어 또는 영어 모두 허용)

### 디버깅 팁

**컴포넌트가 렌더링되지 않는 경우:**
1. `App.js` 라우트 정의 확인
2. import 경로와 컴포넌트 export 검증
3. 브라우저 콘솔에서 에러 확인
4. Layout 컴포넌트가 `<Outlet />`을 가지는지 확인

**네비게이션이 작동하지 않는 경우:**
1. `Router`가 App을 감싸는지 확인
2. 경로가 라우트 정의와 정확히 일치하는지 확인
3. `useNavigate()`가 Router 컨텍스트 내부에서 호출되는지 확인

**스타일이 적용되지 않는 경우:**
1. `sx` prop 문법 확인
2. MUI 테마 접근 검증
3. 브라우저 DevTools에서 요소 검사
4. CSS 우선순위 충돌 확인

### 한국어 주석
코드베이스는 한국어 주석과 UI 텍스트를 포함합니다. 수정 시:
- 사용자 대면 텍스트(UI 레이블, 메시지)는 한국어 유지
- 코드 주석은 영어 또는 한국어 사용 (둘 다 허용)
- 동일 파일 내에서 일관성 유지

---

## 버전 히스토리

| 날짜 | 버전 | 변경사항 |
|------|---------|---------|
| 2025-12-02 | 1.0.0 | 포괄적인 문서화를 통한 초기 CLAUDE.md 생성 |

---

## 추가 자료

- [React 문서](https://react.dev/)
- [Material-UI 문서](https://mui.com/)
- [React Router 문서](https://reactrouter.com/)
- [Create React App 문서](https://create-react-app.dev/)

---

**AI 어시스턴트를 위한 참고사항**: 이 문서는 코드 수정을 위한 포괄적인 컨텍스트를 제공하기 위해 설계되었습니다. 변경하기 전에 항상 실제 소스 코드를 읽어 이해를 확인하세요. 의문이 있을 때는 의도된 동작이나 사용자 요구사항에 대해 명확히 질문하세요.
