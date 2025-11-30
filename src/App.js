import React from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { CssBaseline, Box, Container, Typography, Card, CardActionArea, CardContent, Grid } from '@mui/material';

// --- 아이콘들 ---
import PeopleIcon from '@mui/icons-material/People';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import AssignmentIcon from '@mui/icons-material/Assignment';
import StoreIcon from '@mui/icons-material/Store';

// --- 페이지들 ---
import SalesDashboard from './components/sales/SalesDashboard';
import AdminDashboard from './components/admin/AdminDashboard';
import BrandDashboard from './components/brand/BrandDashboard';

// --- 진행자 관련 페이지 (분리) ---
import OperatorLayout from './components/operator/OperatorLayout';
import OperatorCampaignTable from './components/operator/CampaignTable';
import OperatorItemTable from './components/operator/OperatorItemTable';
import OperatorBuyerTable from './components/operator/OperatorBuyerTable';

function Home() {
  const navigate = useNavigate();

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f0f2f5', display: 'flex', alignItems: 'center', justifyContent: 'center', py: 5 }}>
      <Container maxWidth="lg">
        <Typography variant="h3" component="h1" align="center" gutterBottom fontWeight="bold" color="text.primary">
          CampManager
        </Typography>
        <Typography variant="h6" align="center" color="text.secondary" sx={{ mb: 6 }}>
          접속하실 역할을 선택해주세요.
        </Typography>

        <Grid container spacing={3} justifyContent="center">
          {/* 1. 영업사 */}
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ height: '100%', borderRadius: 4, transition: '0.3s', '&:hover': { transform: 'translateY(-5px)', boxShadow: 6 } }}>
              <CardActionArea sx={{ height: '100%', p: 3 }} onClick={() => navigate('/sales')}>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ p: 2, bgcolor: '#e3f2fd', borderRadius: '50%' }}>
                    <PeopleIcon sx={{ fontSize: 40, color: '#1976d2' }} />
                  </Box>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" fontWeight="bold">영업사</Typography>
                    <Typography variant="caption" color="text.secondary">캠페인 등록</Typography>
                  </CardContent>
                </Box>
              </CardActionArea>
            </Card>
          </Grid>

          {/* 2. 관리자 */}
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ height: '100%', borderRadius: 4, transition: '0.3s', '&:hover': { transform: 'translateY(-5px)', boxShadow: 6 } }}>
              <CardActionArea sx={{ height: '100%', p: 3 }} onClick={() => navigate('/admin')}>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ p: 2, bgcolor: '#ede7f6', borderRadius: '50%' }}>
                    <AdminPanelSettingsIcon sx={{ fontSize: 40, color: '#673ab7' }} />
                  </Box>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" fontWeight="bold">총관리자</Typography>
                    <Typography variant="caption" color="text.secondary">진행자 배정</Typography>
                  </CardContent>
                </Box>
              </CardActionArea>
            </Card>
          </Grid>

          {/* 3. 진행자 */}
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ height: '100%', borderRadius: 4, transition: '0.3s', '&:hover': { transform: 'translateY(-5px)', boxShadow: 6 } }}>
              <CardActionArea sx={{ height: '100%', p: 3 }} onClick={() => navigate('/operator')}>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ p: 2, bgcolor: '#e0f2f1', borderRadius: '50%' }}>
                    <AssignmentIcon sx={{ fontSize: 40, color: '#00897b' }} />
                  </Box>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" fontWeight="bold">진행자</Typography>
                    <Typography variant="caption" color="text.secondary">리뷰 작성</Typography>
                  </CardContent>
                </Box>
              </CardActionArea>
            </Card>
          </Grid>

          {/* 4. 브랜드사 */}
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ height: '100%', borderRadius: 4, transition: '0.3s', '&:hover': { transform: 'translateY(-5px)', boxShadow: 6 } }}>
              <CardActionArea sx={{ height: '100%', p: 3 }} onClick={() => navigate('/brand')}>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ p: 2, bgcolor: '#f3e5f5', borderRadius: '50%' }}>
                    <StoreIcon sx={{ fontSize: 40, color: '#8e24aa' }} />
                  </Box>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" fontWeight="bold">브랜드사</Typography>
                    <Typography variant="caption" color="text.secondary">결과 조회</Typography>
                  </CardContent>
                </Box>
              </CardActionArea>
            </Card>
          </Grid>

        </Grid>
      </Container>
    </Box>
  );
}

function App() {
  return (
    <Router>
      <CssBaseline />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/sales" element={<SalesDashboard />} />
        <Route path="/admin" element={<AdminDashboard />} />
        
        {/* [변경점] 진행자 드릴다운 구조 */}
        <Route path="/operator" element={<OperatorLayout />}>
          {/* 1단계: 캠페인 목록 (operator/) */}
          <Route index element={<OperatorCampaignTable />} />
          
          {/* 2단계: 품목 목록 (operator/campaign/1) */}
          <Route path="campaign/:campaignId" element={<OperatorItemTable />} />
          
          {/* 3단계: 구매자/리뷰 관리 (operator/campaign/1/item/101) */}
          <Route path="campaign/:campaignId/item/:itemId" element={<OperatorBuyerTable />} />
        </Route>

        <Route path="/brand" element={<BrandDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;