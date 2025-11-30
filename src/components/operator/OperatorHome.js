import React, { useState } from 'react';
import { Box, Typography, Breadcrumbs, Link, Container, Toolbar } from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';

// 하위 컴포넌트 임포트
import CampaignTable from './CampaignTable';
import ItemTable from './OperatorItemTable';
import BuyerTable from './OperatorBuyerTable';
import AddBuyerDialog from './OperatorAddBuyerDialog';

// --- [Mock Data] (실제로는 API에서 가져오겠지만 편의상 여기에 둠) ---
const initialCampaigns = [
  { id: 1, date: '2023-06-07', title: '영업사의 베스트 캠페인', status: '진행 중' },
  { id: 2, date: '2023-06-22', title: '여름 시즌 프로모션', status: '진행 중' },
];

const initialItems = [
  { id: 101, campaignId: 1, name: '품목 A (30대 타겟)', status: '진행 중' },
  { id: 102, campaignId: 1, name: '품목 B (40대 타겟)', status: '진행 중' },
  { id: 201, campaignId: 2, name: '캠핑 의자 세트', status: '진행 중' },
];

const initialBuyers = [
  { 
    id: 1001, itemId: 101, orderNum: '20230607-001', buyer: '홍길동', recipient: '홍길동', 
    userId: 'hong', contact: '010-1234-5678', address: '서울시 강남구...', 
    bankAccount: '국민 111-222', amount: '50000', reviewImage: 'sample.jpg' 
  },
];

function OperatorHome() {
  const [buyers, setBuyers] = useState(initialBuyers);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 네비게이션 핸들러
  const handleSelectCampaign = (camp) => setSelectedCampaign(camp);
  const handleSelectItem = (item) => setSelectedItem(item);
  const handleBackToCampaigns = () => { setSelectedCampaign(null); setSelectedItem(null); };
  const handleBackToItems = () => setSelectedItem(null);

  // 데이터 추가 핸들러 (AddBuyerDialog에서 호출)
  const handleAddBuyerData = (newItemData) => {
    const newBuyer = {
      id: Date.now(),
      itemId: selectedItem.id,
      ...newItemData
    };
    setBuyers([newBuyer, ...buyers]);
    setIsModalOpen(false);
  };

  // 현재 단계에 따른 화면 렌더링
  const renderContent = () => {
    if (!selectedCampaign) {
      return <CampaignTable campaigns={initialCampaigns} onSelect={handleSelectCampaign} />;
    }
    if (selectedCampaign && !selectedItem) {
      const filteredItems = initialItems.filter(item => item.campaignId === selectedCampaign.id);
      return (
        <ItemTable 
          items={filteredItems} 
          campaignTitle={selectedCampaign.title} 
          buyers={buyers} // 카운트 계산용
          onSelect={handleSelectItem} 
        />
      );
    }
    if (selectedItem) {
      const filteredBuyers = buyers.filter(b => b.itemId === selectedItem.id);
      return (
        <BuyerTable 
          buyers={filteredBuyers} 
          item={selectedItem} 
          campaignTitle={selectedCampaign.title}
          onOpenModal={() => setIsModalOpen(true)}
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
                <InsertDriveFileIcon sx={{ mr: 0.5 }} fontSize="inherit" />{selectedCampaign.title}
              </Link>
            )}
            {selectedItem && (<Typography color="text.primary" fontWeight="bold">{selectedItem.name}</Typography>)}
         </Breadcrumbs>
      </Box>

      {/* 메인 콘텐츠 영역 */}
      {renderContent()}

      {/* 추가 모달 (독립 컴포넌트) */}
      <AddBuyerDialog 
        open={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={handleAddBuyerData} 
      />
    </Container>
  );
}

export default OperatorHome;