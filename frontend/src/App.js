import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { CssBaseline } from '@mui/material';

// --- 인증 관련 ---
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './components/Login';

// --- 페이지들 ---
import AdminDashboard from './components/admin/AdminDashboard';
import AdminLayout from './components/admin/AdminLayout';
import AdminCampaignTable from './components/admin/AdminCampaignTable';
import AdminItemTable from './components/admin/AdminItemTable';
import AdminBuyerTable from './components/admin/AdminBuyerTable';

// --- 영업사 관련 페이지 ---
import SalesLayout from './components/sales/SalesLayout';
import SalesCampaignTable from './components/sales/SalesCampaignTable';
import SalesItemTable from './components/sales/SalesItemTable';
import SalesItemDetail from './components/sales/SalesItemDetail';

// --- 진행자 관련 페이지 ---
import OperatorLayout from './components/operator/OperatorLayout';
import OperatorCampaignTable from './components/operator/OperatorCampaignTable';
import OperatorItemTable from './components/operator/OperatorItemTable';
import OperatorBuyerTable from './components/operator/OperatorBuyerTable';

// --- 브랜드사 관련 페이지 ---
import BrandLayout from './components/brand/BrandLayout';
import BrandCampaignTable from './components/brand/BrandCampaignTable';
import BrandItemTable from './components/brand/BrandItemTable';
import BrandBuyerTable from './components/brand/BrandBuyerTable';

// --- 이미지 업로드 페이지 (Public) ---
import UploadPage from './components/upload/UploadPage';

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

          {/* 기본 경로는 로그인으로 리다이렉트 */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* 총관리자 대시보드 (진행자 배정) */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* 총관리자 캠페인/품목/구매자 드릴다운 (입금확인) */}
          <Route
            path="/admin/campaigns"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminCampaignTable />} />
            <Route path=":campaignId" element={<AdminItemTable />} />
            <Route path=":campaignId/item/:itemId" element={<AdminBuyerTable />} />
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
