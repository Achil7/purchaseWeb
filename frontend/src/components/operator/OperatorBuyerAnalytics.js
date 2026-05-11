import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, AppBar, Toolbar, Typography, Button, IconButton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useAuth } from '../../context/AuthContext';
import BuyerAnalyticsDashboard from '../common/BuyerAnalyticsDashboard';

function OperatorBuyerAnalytics() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      <AppBar position="fixed" sx={{ bgcolor: '#2c387e' }}>
        <Toolbar>
          <IconButton color="inherit" onClick={() => navigate('/operator')} sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ fontWeight: 'bold', cursor: 'pointer' }} onClick={() => navigate('/operator')}>
            Campaign Manager — 구매자 분석
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Button color="inherit" onClick={handleLogout} sx={{ fontWeight: 'bold' }}>
            로그아웃
          </Button>
        </Toolbar>
      </AppBar>
      <Toolbar />
      <Box sx={{ p: 2 }}>
        <BuyerAnalyticsDashboard />
      </Box>
    </Box>
  );
}

export default OperatorBuyerAnalytics;
