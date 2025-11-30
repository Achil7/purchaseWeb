import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Paper, TableContainer, Table, TableHead, TableRow, TableCell, TableBody, Chip, Button, Breadcrumbs, Link } from '@mui/material';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';

// [데이터] (실제로는 API에서 가져오는 부분)
const itemsData = [
  { id: 101, campaignId: 1, name: '품목 A (30대 타겟)', status: '진행 중' },
  { id: 102, campaignId: 1, name: '품목 B (40대 타겟)', status: '진행 중' },
  { id: 201, campaignId: 2, name: '캠핑 의자 세트', status: '진행 중' },
];

function OperatorItemTable() {
  const { campaignId } = useParams(); 
  const navigate = useNavigate();

  // URL 파라미터(String)를 숫자로 변환하여 비교
  const filteredItems = itemsData.filter(item => item.campaignId === parseInt(campaignId));

  return (
    <>
      <Box sx={{ mb: 2 }}>
        <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />}>
          <Link underline="hover" color="inherit" onClick={() => navigate('/operator')} sx={{ cursor: 'pointer' }}>
            캠페인 목록
          </Link>
          <Typography color="text.primary">캠페인 상세 (ID: {campaignId})</Typography>
        </Breadcrumbs>
      </Box>

      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" fontWeight="bold">품목 선택</Typography>
        <Typography variant="body2" color="text.secondary">작업할 품목을 선택하여 리뷰를 관리하세요.</Typography>
      </Box>

      <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <TableContainer>
          <Table hover>
            <TableHead sx={{ bgcolor: '#e0f2f1' }}>
              <TableRow>
                <TableCell>품목명</TableCell>
                <TableCell align="center">상태</TableCell>
                <TableCell align="right">작업하기</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredItems.length > 0 ? (
                filteredItems.map((item) => (
                  <TableRow 
                    key={item.id} 
                    hover 
                    onClick={() => navigate(`/operator/campaign/${campaignId}/item/${item.id}`)} 
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
                        <InsertDriveFileIcon color="action" /> {item.name}
                    </TableCell>
                    <TableCell align="center"><Chip label={item.status} size="small" /></TableCell>
                    <TableCell align="right"><Button variant="contained" size="small" color="primary">선택</Button></TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} align="center" sx={{ py: 3, color: '#999' }}>
                    등록된 품목이 없거나 잘못된 캠페인 ID입니다.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </>
  );
}

export default OperatorItemTable;