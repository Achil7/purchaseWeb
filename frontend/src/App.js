import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { CssBaseline } from '@mui/material';

// --- 인증 관련 ---
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './components/Login';

// --- 페이지들 ---
import AdminLayout from './components/admin/AdminLayout';
import AdminMonthlyBuyers from './components/admin/AdminMonthlyBuyers';
import AdminDailyPayments from './components/admin/AdminDailyPayments';
import AdminTrackingManagement from './components/admin/AdminTrackingManagement';
import AdminControlTower from './components/admin/AdminControlTower';
import AdminMarginDashboard from './components/admin/AdminMarginDashboard';
import AdminCampaignAssignment from './components/admin/AdminCampaignAssignment';
import AdminTrash from './components/admin/AdminTrash';
import AdminImageApproval from './components/admin/AdminImageApproval';

// --- 영업사 관련 페이지 ---
import SalesLayout from './components/sales/SalesLayout';
import SalesCampaignTable from './components/sales/SalesCampaignTable';
import SalesItemTable from './components/sales/SalesItemTable';
import SalesItemDetail from './components/sales/SalesItemDetail';
import SalesMonthlyBuyers from './components/sales/SalesMonthlyBuyers';

// --- 진행자 관련 페이지 ---
import OperatorLayout from './components/operator/OperatorLayout';
import OperatorCampaignTable from './components/operator/OperatorCampaignTable';
import OperatorItemTable from './components/operator/OperatorItemTable';
import OperatorBuyerTable from './components/operator/OperatorBuyerTable';
import OperatorMonthlyBuyers from './components/operator/OperatorMonthlyBuyers';

// --- 브랜드사 관련 페이지 ---
import BrandLayout from './components/brand/BrandLayout';
import BrandCampaignTable from './components/brand/BrandCampaignTable';
import BrandItemTable from './components/brand/BrandItemTable';
import BrandBuyerTable from './components/brand/BrandBuyerTable';

// --- 이미지 업로드 페이지 (Public) ---
import UploadPage from './components/upload/UploadPage';

// --- Admin View 래퍼 컴포넌트 (URL 쿼리에서 viewAsUserId 추출) ---
function AdminViewSales() {
  const [searchParams] = useSearchParams();
  const viewAsUserId = searchParams.get('userId');
  return <SalesLayout isAdminMode={true} viewAsUserId={viewAsUserId ? parseInt(viewAsUserId, 10) : null} />;
}

function AdminViewOperator() {
  const [searchParams] = useSearchParams();
  const viewAsUserId = searchParams.get('userId');
  return <OperatorLayout isAdminMode={true} viewAsUserId={viewAsUserId ? parseInt(viewAsUserId, 10) : null} />;
}

function AdminViewBrand() {
  const [searchParams] = useSearchParams();
  const viewAsUserId = searchParams.get('userId');
  return <BrandLayout isAdminMode={true} viewAsUserId={viewAsUserId ? parseInt(viewAsUserId, 10) : null} />;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <CssBaseline />
        <Routes>
          {/* 로그인 페이지 */}
          <Route path="/login" element={<Login />} />

          {/* 이미지 업로드 페이지 (Public - 인증 불필요) */}
          <Route path="/upload/:token" element={<UploadPage />} />
          {/* 슬롯 토큰용 이미지 업로드 페이지 (일 구매건수 그룹별) */}
          <Route path="/upload-slot/:token" element={<UploadPage isSlotUpload={true} />} />

          {/* 기본 경로는 로그인으로 리다이렉트 */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* 총관리자 드릴다운 구조 (메인=컨트롤타워) */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            {/* 메인 페이지 = 컨트롤 타워 */}
            <Route index element={<AdminControlTower />} />
            <Route path="control-tower" element={<AdminControlTower />} />
            <Route path="campaigns/:campaignId/assignment" element={<AdminCampaignAssignment />} />
            <Route path="daily-items" element={<AdminMonthlyBuyers />} />
            <Route path="daily-payments" element={<AdminDailyPayments />} />
            <Route path="tracking-management" element={<AdminTrackingManagement />} />
            <Route path="margin" element={<AdminMarginDashboard />} />
            <Route path="trash" element={<AdminTrash />} />
            <Route path="image-approval" element={<AdminImageApproval />} />
          </Route>

          {/* Admin이 영업사 페이지를 그대로 볼 수 있는 라우트 (쿼리: ?userId=xxx) */}
          <Route
            path="/admin/view-sales"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminViewSales />
              </ProtectedRoute>
            }
          >
            <Route index element={<SalesCampaignTable />} />
            <Route path="campaign/:campaignId" element={<SalesItemTable />} />
            <Route path="campaign/:campaignId/item/:itemId" element={<SalesItemDetail />} />
            <Route path="daily-items" element={<SalesMonthlyBuyers />} />
          </Route>

          {/* Admin이 진행자 페이지를 그대로 볼 수 있는 라우트 (쿼리: ?userId=xxx) */}
          <Route
            path="/admin/view-operator"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminViewOperator />
              </ProtectedRoute>
            }
          >
            <Route index element={<OperatorCampaignTable />} />
            <Route path="campaign/:campaignId" element={<OperatorItemTable />} />
            <Route path="campaign/:campaignId/item/:itemId" element={<OperatorBuyerTable />} />
            <Route path="daily-items" element={<OperatorMonthlyBuyers />} />
          </Route>

          {/* Admin이 브랜드사 페이지를 그대로 볼 수 있는 라우트 (쿼리: ?userId=xxx) */}
          <Route
            path="/admin/view-brand"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminViewBrand />
              </ProtectedRoute>
            }
          >
            <Route index element={<BrandCampaignTable />} />
            <Route path="campaign/:campaignId" element={<BrandItemTable />} />
            <Route path="campaign/:campaignId/item/:itemId" element={<BrandBuyerTable />} />
          </Route>

          {/* 영업사 드릴다운 구조 */}
          <Route
            path="/sales"
            element={
              <ProtectedRoute allowedRoles={['sales']}>
                <SalesLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<SalesCampaignTable />} />
            <Route path="campaign/:campaignId" element={<SalesItemTable />} />
            <Route path="campaign/:campaignId/item/:itemId" element={<SalesItemDetail />} />
            <Route path="daily-items" element={<SalesMonthlyBuyers />} />
          </Route>

          {/* 진행자 드릴다운 구조 */}
          <Route
            path="/operator"
            element={
              <ProtectedRoute allowedRoles={['operator']}>
                <OperatorLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<OperatorCampaignTable />} />
            <Route path="campaign/:campaignId" element={<OperatorItemTable />} />
            <Route path="campaign/:campaignId/item/:itemId" element={<OperatorBuyerTable />} />
            <Route path="daily-items" element={<OperatorMonthlyBuyers />} />
          </Route>

          {/* 브랜드사 드릴다운 구조 */}
          <Route
            path="/brand"
            element={
              <ProtectedRoute allowedRoles={['brand']}>
                <BrandLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<BrandCampaignTable />} />
            <Route path="campaign/:campaignId" element={<BrandItemTable />} />
            <Route path="campaign/:campaignId/item/:itemId" element={<BrandBuyerTable />} />
          </Route>

          {/* 404 - 로그인으로 리다이렉트 */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
