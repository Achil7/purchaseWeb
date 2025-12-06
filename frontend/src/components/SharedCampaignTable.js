import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Box, Typography, Paper, TableContainer, Table, TableHead, TableRow, TableCell, TableBody, 
  Chip, Button, Select, MenuItem, FormControl, InputLabel 
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import AddIcon from '@mui/icons-material/Add';

// 1. 사용자 역할 상수 정의 (나중에 실제 로그인 로직과 연동)
export const USER_ROLES = {
  SALES: 'SALES',       // 영업사
  ADMIN: 'ADMIN',       // 총 관리자
  OPERATOR: 'OPERATOR', // 진행자
  BRAND: 'BRAND'        // 브랜드사
};

// 2. Mock Data (품목 수, 배정된 진행자 정보 추가)
const initialCampaigns = [
  { id: 1, date: '2023-06-07', title: '영업사의 베스트 캠페인', itemCount: 15, status: '진행 중', assignedOperator: 'kim_op' },
  { id: 2, date: '2023-06-22', title: '여름 시즌 프로모션', itemCount: 8, status: '진행 중', assignedOperator: '' }, // 미배정 상태
  { id: 3, date: '2023-07-01', title: '가을 신상품 기획전', itemCount: 22, status: '대기', assignedOperator: 'lee_op' },
];

// 진행자 목록 (관리자용 Mock)
const operators = [
  { id: 'kim_op', name: '김진행' },
  { id: 'lee_op', name: '이진행' },
  { id: 'park_op', name: '박진행' },
];

/**
 * @param {string} userRole - 현재 로그인한 사용자의 역할 (USER_ROLES 중 하나)
 */
function SharedCampaignTable({ userRole = USER_ROLES.OPERATOR }) {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState(initialCampaigns);

  // [기능] 관리자: 진행자 변경 핸들러
  const handleOperatorChange = (event, campaignId) => {
    const newOperator = event.target.value;
    // 실제로는 여기서 API 호출
    setCampaigns(prev => prev.map(c => 
      c.id === campaignId ? { ...c, assignedOperator: newOperator } : c
    ));
    console.log(`캠페인 ${campaignId}의 진행자가 ${newOperator}로 변경되었습니다.`);
  };

  // [기능] 영업사: 새 캠페인 등록 버튼 핸들러
  const handleCreateCampaign = () => {
    navigate('/sales/create'); // 등록 페이지로 이동 예시
    console.log('새 캠페인 등록 페이지로 이동');
  };

  return (
    <>
      {/* 상단 헤더 영역: 역할별로 다르게 표시 */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <Box>
          <Typography variant="h5" fontWeight="bold">캠페인 목록 대시보드</Typography>
          <Typography variant="body2" color="text.secondary">
            {/* 역할에 따른 멘트 분기 */}
            {userRole === USER_ROLES.ADMIN && '전체 캠페인을 관리하고 진행자를 배정합니다.'}
            {userRole === USER_ROLES.SALES && '직접 등록한 캠페인을 관리합니다.'}
            {(userRole === USER_ROLES.OPERATOR || userRole === USER_ROLES.BRAND) && '배정된 캠페인 목록입니다.'}
          </Typography>
        </Box>

        {/* [추가 기능 2] 영업사일 경우 : 새 캠페인 등록 버튼 노출 */}
        {userRole === USER_ROLES.SALES && (
          <Button 
            variant="contained" 
            startIcon={<AddIcon />} 
            onClick={handleCreateCampaign}
            sx={{ bgcolor: '#009688', '&:hover': { bgcolor: '#00796b' } }}
          >
            새 캠페인 등록
          </Button>
        )}
      </Box>

      <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <TableContainer>
          <Table hover>
            <TableHead sx={{ bgcolor: '#e0f2f1' }}>
              <TableRow>
                <TableCell width="15%">날짜</TableCell>
                <TableCell>캠페인명</TableCell>
                
                {/* [추가 기능 1] 전체 공통: 품목 수 컬럼 */}
                <TableCell align="center" width="10%">품목 수</TableCell>

                {/* [추가 기능 3] 관리자일 경우 : 진행자 배정 컬럼 노출 */}
                {userRole === USER_ROLES.ADMIN && (
                  <TableCell align="center" width="20%">진행자 배정</TableCell>
                )}

                <TableCell align="center" width="10%">상태</TableCell>
                <TableCell align="right" width="10%">이동</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {campaigns.map((camp) => (
                <TableRow 
                  key={camp.id} 
                  hover 
                  // [핵심] 클릭 시 ID 기반으로 URL 이동
                  onClick={() => navigate(`/${userRole.toLowerCase()}/campaign/${camp.id}`)} 
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>{camp.date}</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <FolderIcon color="action" /> {camp.title}
                  </TableCell>

                  {/* [추가 기능 1] 품목 수 데이터 표시 */}
                  <TableCell align="center">{camp.itemCount}개</TableCell>

                  {/* [추가 기능 3] 관리자일 경우 : 드롭다운 렌더링 */}
                  {userRole === USER_ROLES.ADMIN && (
                    <TableCell align="center" onClick={(e) => e.stopPropagation()}> 
                      {/* e.stopPropagation()이 중요: 드롭다운 클릭 시 상세페이지 이동 방지 */}
                      <FormControl size="small" fullWidth>
                        <Select
                          value={camp.assignedOperator}
                          displayEmpty
                          onChange={(e) => handleOperatorChange(e, camp.id)}
                          sx={{ fontSize: '0.875rem', bgcolor: 'white' }}
                        >
                          <MenuItem value="">
                            <em style={{ color: '#aaa' }}>미배정</em>
                          </MenuItem>
                          {operators.map((op) => (
                            <MenuItem key={op.id} value={op.id}>{op.name}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </TableCell>
                  )}

                  <TableCell align="center">
                    <Chip 
                      label={camp.status} 
                      size="small" 
                      color={camp.status === '진행 중' ? 'primary' : 'default'} 
                      variant="outlined" 
                    />
                  </TableCell>
                  
                  {/* [추가 기능 4] 브랜드사/진행자 포함 모두 화살표 아이콘은 동일하게 표시 */}
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

export default SharedCampaignTable;