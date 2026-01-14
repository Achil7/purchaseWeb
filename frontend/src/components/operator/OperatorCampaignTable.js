import React from 'react';
import { Box, Typography, Paper, Alert } from '@mui/material';
import StoreIcon from '@mui/icons-material/Store';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

function OperatorCampaignTable() {
  return (
    <Box>
      <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
        <StoreIcon sx={{ fontSize: 64, color: '#2c387e', mb: 2 }} />
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          캠페인을 선택해주세요
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          왼쪽 사이드바에서 브랜드를 펼치고 캠페인을 선택하면<br />
          해당 캠페인의 제품 목록이 여기에 표시됩니다.
        </Typography>

        <Alert
          severity="info"
          sx={{
            maxWidth: 500,
            mx: 'auto',
            textAlign: 'left'
          }}
          icon={<ArrowBackIcon />}
        >
          <Typography variant="body2">
            <strong>사용 방법:</strong>
          </Typography>
          <Typography variant="body2" component="div">
            1. 왼쪽 사이드바에서 브랜드명을 클릭하여 펼칩니다<br />
            2. 캠페인을 선택하면 제품 목록이 표시됩니다<br />
            3. 제품을 클릭하면 구매자 관리 화면으로 이동합니다
          </Typography>
        </Alert>
      </Paper>
    </Box>
  );
}

export default OperatorCampaignTable;
