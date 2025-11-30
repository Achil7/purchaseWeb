import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Paper, TableContainer, Table, TableHead, TableRow, TableCell, TableBody, Chip } from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';

// Mock Data
const campaigns = [
  { id: 1, date: '2023-06-07', title: '영업사의 베스트 캠페인', status: '진행 중' },
  { id: 2, date: '2023-06-22', title: '여름 시즌 프로모션', status: '진행 중' },
];

function OperatorCampaignTable() {
  const navigate = useNavigate();

  return (
    <>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" fontWeight="bold">나의 캠페인 목록</Typography>
        <Typography variant="body2" color="text.secondary">관리자로부터 배정받은 캠페인입니다.</Typography>
      </Box>
      <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <TableContainer>
          <Table hover>
            <TableHead sx={{ bgcolor: '#e0f2f1' }}>
              <TableRow>
                <TableCell width="20%">날짜</TableCell>
                <TableCell>캠페인명</TableCell>
                <TableCell align="center">상태</TableCell>
                <TableCell align="right">이동</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {campaigns.map((camp) => (
                <TableRow 
                  key={camp.id} 
                  hover 
                  // [핵심] 클릭 시 ID 기반으로 URL 이동
                  onClick={() => navigate(`/operator/campaign/${camp.id}`)} 
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>{camp.date}</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <FolderIcon color="action" /> {camp.title}
                  </TableCell>
                  <TableCell align="center"><Chip label={camp.status} size="small" color="primary" variant="outlined" /></TableCell>
                  <TableCell align="right"><NavigateNextIcon color="disabled" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </>
  );
}

export default OperatorCampaignTable;