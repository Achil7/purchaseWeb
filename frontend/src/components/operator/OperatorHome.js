import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Breadcrumbs, Link, Container, CircularProgress, Alert,
  Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip
} from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';

// 하위 컴포넌트 임포트
import OperatorBuyerTable from './OperatorBuyerTable';
import OperatorAddBuyerDialog from './OperatorAddBuyerDialog';

// API 서비스
import { itemService, buyerService } from '../../services';

function OperatorHome() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 구매자 목록 (선택된 품목의)
  const [buyers, setBuyers] = useState([]);
  const [buyersLoading, setBuyersLoading] = useState(false);

  // 데이터 로드
  useEffect(() => {
    loadAssignedItems();
  }, []);

  // 품목 선택 시 구매자 목록 로드
  useEffect(() => {
    if (selectedItem) {
      loadBuyers(selectedItem.id);
    }
  }, [selectedItem]);

  const loadAssignedItems = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await itemService.getMyAssignedItems();
      setCampaigns(response.data || []);
    } catch (err) {
      console.error('Failed to load assigned items:', err);
      setError('배정된 품목을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const loadBuyers = async (itemId) => {
    try {
      setBuyersLoading(true);
      const response = await buyerService.getBuyersByItem(itemId);
      setBuyers(response.data || []);
    } catch (err) {
      console.error('Failed to load buyers:', err);
      setBuyers([]);
    } finally {
      setBuyersLoading(false);
    }
  };

  // 네비게이션 핸들러
  const handleSelectCampaign = (camp) => setSelectedCampaign(camp);
  const handleSelectItem = (item) => setSelectedItem(item);
  const handleBackToCampaigns = () => { setSelectedCampaign(null); setSelectedItem(null); };
  const handleBackToItems = () => setSelectedItem(null);

  // 데이터 추가 핸들러 (AddBuyerDialog에서 호출)
  const handleAddBuyerData = async (newBuyerData) => {
    try {
      await buyerService.createBuyer(selectedItem.id, newBuyerData);
      await loadBuyers(selectedItem.id);
      setIsModalOpen(false);
    } catch (err) {
      console.error('Failed to add buyer:', err);
      alert('구매자 추가에 실패했습니다.');
    }
  };

  const getStatusLabel = (status) => {
    const statusMap = {
      'active': '진행 중',
      'completed': '완료',
      'cancelled': '취소'
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status) => {
    const colorMap = {
      'active': 'primary',
      'completed': 'success',
      'cancelled': 'error'
    };
    return colorMap[status] || 'default';
  };

  // 캠페인 목록 테이블
  const renderCampaignTable = () => (
    <>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" fontWeight="bold">나의 캠페인 목록</Typography>
        <Typography variant="body2" color="text.secondary">
          관리자로부터 배정받은 캠페인입니다. (총 {campaigns.length}개)
        </Typography>
      </Box>
      <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: '#e0f2f1' }}>
              <TableRow>
                <TableCell>캠페인명</TableCell>
                <TableCell>브랜드</TableCell>
                <TableCell align="center">품목 수</TableCell>
                <TableCell align="center">상태</TableCell>
                <TableCell align="right">이동</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {campaigns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 5, color: '#999' }}>
                    배정된 캠페인이 없습니다. 관리자가 품목을 배정하면 여기에 표시됩니다.
                  </TableCell>
                </TableRow>
              ) : (
                campaigns.map((camp) => (
                  <TableRow
                    key={camp.id}
                    hover
                    onClick={() => handleSelectCampaign(camp)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <FolderIcon color="action" /> {camp.name}
                    </TableCell>
                    <TableCell>{camp.brand || '-'}</TableCell>
                    <TableCell align="center">{camp.items?.length || 0}개</TableCell>
                    <TableCell align="center">
                      <Chip
                        label={getStatusLabel(camp.status)}
                        size="small"
                        color={getStatusColor(camp.status)}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right"><NavigateNextIcon color="disabled" /></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </>
  );

  // 품목 목록 테이블
  const renderItemTable = () => (
    <>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" fontWeight="bold">품목 목록</Typography>
        <Typography variant="body2" color="text.secondary">
          {selectedCampaign?.name} - 배정된 품목 (총 {selectedCampaign?.items?.length || 0}개)
        </Typography>
      </Box>
      <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: '#e3f2fd' }}>
              <TableRow>
                <TableCell>품목명</TableCell>
                <TableCell>키워드</TableCell>
                <TableCell align="center">구매자 수</TableCell>
                <TableCell align="center">상태</TableCell>
                <TableCell align="right">이동</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(!selectedCampaign?.items || selectedCampaign.items.length === 0) ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 5, color: '#999' }}>
                    등록된 품목이 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                selectedCampaign.items.map((item) => (
                  <TableRow
                    key={item.id}
                    hover
                    onClick={() => handleSelectItem(item)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <InsertDriveFileIcon color="primary" /> {item.product_name}
                    </TableCell>
                    <TableCell>{item.keyword || '-'}</TableCell>
                    <TableCell align="center">{item.buyerCount || 0}명</TableCell>
                    <TableCell align="center">
                      <Chip
                        label={getStatusLabel(item.status)}
                        size="small"
                        color={getStatusColor(item.status)}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right"><NavigateNextIcon color="disabled" /></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </>
  );

  // 현재 단계에 따른 화면 렌더링
  const renderContent = () => {
    if (loading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <CircularProgress />
        </Box>
      );
    }

    if (error) {
      return (
        <Box sx={{ mb: 4 }}>
          <Alert severity="error">{error}</Alert>
        </Box>
      );
    }

    if (!selectedCampaign) {
      return renderCampaignTable();
    }

    if (selectedCampaign && !selectedItem) {
      return renderItemTable();
    }

    if (selectedItem) {
      if (buyersLoading) {
        return (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
            <CircularProgress />
          </Box>
        );
      }
      return (
        <OperatorBuyerTable
          buyers={buyers}
          item={selectedItem}
          campaignTitle={selectedCampaign.name}
          onOpenModal={() => setIsModalOpen(true)}
          onRefresh={() => loadBuyers(selectedItem.id)}
        />
      );
    }
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 2 }}>
       {/* 브레드크럼 (경로 네비게이션) */}
      <Box sx={{ mb: 3 }}>
         <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} aria-label="breadcrumb">
            <Link underline="hover" color="inherit" onClick={handleBackToCampaigns} sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <FolderIcon sx={{ mr: 0.5 }} fontSize="inherit" />캠페인 목록
            </Link>
            {selectedCampaign && (
              <Link underline="hover" color="inherit" onClick={handleBackToItems} sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <InsertDriveFileIcon sx={{ mr: 0.5 }} fontSize="inherit" />{selectedCampaign.name}
              </Link>
            )}
            {selectedItem && (<Typography color="text.primary" fontWeight="bold">{selectedItem.product_name}</Typography>)}
         </Breadcrumbs>
      </Box>

      {/* 메인 콘텐츠 영역 */}
      {renderContent()}

      {/* 추가 모달 (독립 컴포넌트) */}
      <OperatorAddBuyerDialog
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleAddBuyerData}
      />
    </Container>
  );
}

export default OperatorHome;
