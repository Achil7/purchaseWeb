import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { CssBaseline } from '@mui/material';

// --- 인증 관련 ---
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './components/Login';

// --- 페이지들 ---
import AdminDashboard from './components/admin/AdminDashboard';

// --- 영업사 관련 페이지 ---
import SalesLayout from './components/sales/SalesLayout';
import SalesCampaignTable from './components/sales/SalesCampaignTable';
import SalesItemTable from './components/sales/SalesItemTable';

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

function App() {
  return (
    <AuthProvider>
      <Router>
        <CssBaseline />
        <Routes>
          {/* 로그인 페이지 */}
          <Route path="/login" element={<Login />} />

          {/* 기본 경로는 로그인으로 리다이렉트 */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* 총관리자 페이지 */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* 영업사 드릴다운 구조 */}
          <Route
            path="/sales"
            element={
              <ProtectedRoute allowedRoles={['admin', 'sales']}>
                <SalesLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<SalesCampaignTable />} />
            <Route path="campaign/:campaignId" element={<SalesItemTable />} />
          </Route>

          {/* 진행자 드릴다운 구조 */}
          <Route
            path="/operator"
            element={
              <ProtectedRoute allowedRoles={['admin', 'operator']}>
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
              <ProtectedRoute allowedRoles={['admin', 'brand']}>
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
