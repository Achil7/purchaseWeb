import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Box, Typography, Button, Paper, TableContainer, Table, TableHead, TableRow, TableCell, TableBody, 
  Link, Breadcrumbs 
} from '@mui/material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import ImageIcon from '@mui/icons-material/Image';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import OperatorAddBuyerDialog from './OperatorAddBuyerDialog';

const initialBuyers = [
  { 
    id: 1001, itemId: 101, 
    orderNum: '20230607-001', 
    buyer: '홍길동', 
    recipient: '홍길동', 
    userId: 'hong123', 
    contact: '010-1234-5678', 
    address: '서울 강남구 테헤란로 123, 역삼동 멀티캠퍼스 10층 1004호', 
    bankAccount: '국민은행 123-45-67890 홍길동', 
    amount: '50,000', 
    reviewImage: 'sample.jpg' 
  },
];

function OperatorBuyerTable() {
  const { campaignId, itemId } = useParams();
  const navigate = useNavigate();

  const [buyers, setBuyers] = useState(initialBuyers);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 현재 아이템 필터링
  const filteredBuyers = buyers.filter(b => b.itemId === parseInt(itemId));

  const handleAddBuyer = (newData) => {
    const newBuyer = { 
        id: Date.now(), 
        itemId: parseInt(itemId), 
        ...newData 
    };
    setBuyers([newBuyer, ...buyers]);
    setIsModalOpen(false);
  };

  // [총 금액 계산]
  const totalAmount = filteredBuyers.reduce((acc, curr) => {
    const value = curr.amount ? parseInt(curr.amount.toString().replace(/,/g, ''), 10) : 0;
    return acc + (isNaN(value) ? 0 : value);
  }, 0);

  // 테이블 컬럼 정의
  const columns = [
    { id: 'orderNum', label: '주문번호', width: 120 },
    { id: 'buyer', label: '구매자', width: 80 },
    { id: 'recipient', label: '수취인', width: 80 },
    { id: 'userId', label: '아이디', width: 100 },
    { id: 'contact', label: '연락처', width: 130 },
    { id: 'address', label: '주소', width: 300 },
    { id: 'bankAccount', label: '계좌정보', width: 250 },
    { id: 'amount', label: '금액', width: 100 },
    { id: 'image', label: '리뷰샷', width: 80 },
    { id: 'action', label: '관리', width: 80 },
  ];

  return (
    <>
      <Box sx={{ mb: 2 }}>
        <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />}>
          <Link underline="hover" color="inherit" onClick={() => navigate('/operator')} sx={{ cursor: 'pointer' }}>
            캠페인 목록
          </Link>
          <Link underline="hover" color="inherit" onClick={() => navigate(`/operator/campaign/${campaignId}`)} sx={{ cursor: 'pointer' }}>
            품목 목록
          </Link>
          <Typography color="text.primary">리뷰 관리</Typography>
        </Breadcrumbs>
      </Box>

      {/* 헤더 및 버튼 */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
           <Button startIcon={<ArrowBackIcon/>} onClick={() => navigate(-1)} sx={{ mb:1 }}>뒤로가기</Button>
           <Typography variant="h5" fontWeight="bold">구매자 리뷰 리스트</Typography>
           <Typography variant="body2" color="text.secondary">
             Item ID: {itemId} | 총 {filteredBuyers.length}명
           </Typography>
        </Box>
        <Button 
          variant="contained" 
          color="success" 
          startIcon={<AddCircleIcon />} 
          onClick={() => setIsModalOpen(true)} 
          sx={{ px: 3, py: 1.5, fontWeight: 'bold' }}
        >
          구매자 추가 (붙여넣기)
        </Button>
      </Box>

      {/* 테이블 영역 */}
      <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 3, boxShadow: 3 }}>
        <TableContainer sx={{ maxHeight: '75vh' }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                {columns.map((col) => (
                  <TableCell 
                    key={col.id} 
                    align={col.id === 'image' || col.id === 'action' ? 'center' : 'left'}
                    sx={{ 
                        fontWeight: 'bold', 
                        bgcolor: '#fafafa', 
                        whiteSpace: 'nowrap', 
                        minWidth: col.width,
                        verticalAlign: 'bottom' 
                    }}
                  >
                    {/* [수정] 금액 컬럼 헤더: 폰트 사이즈 subtitle2로 약간 키움 */}
                    {col.id === 'amount' ? (
                        <Box sx={{ lineHeight: 1 }}>
                            <Typography 
                                variant="subtitle2"  // 기존 caption -> subtitle2 (약간 더 큼)
                                display="block" 
                                color="success.main" 
                                fontWeight="bold" 
                                sx={{ mb: 0.5 }}
                            >
                                Total: {totalAmount.toLocaleString()}
                            </Typography>
                            {col.label}
                        </Box>
                    ) : (
                        col.label
                    )}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredBuyers.length > 0 ? (
                filteredBuyers.map((buyer) => (
                  <TableRow key={buyer.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{buyer.orderNum}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{buyer.buyer}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{buyer.recipient}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{buyer.userId}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{buyer.contact}</TableCell>
                    
                    {/* 주소 */}
                    <TableCell sx={{ whiteSpace: 'normal', wordBreak: 'keep-all', minWidth: 300, lineHeight: 1.5 }}>
                        {buyer.address}
                    </TableCell>
                    
                    {/* 계좌 */}
                    <TableCell sx={{ whiteSpace: 'normal', wordBreak: 'keep-all', minWidth: 250, lineHeight: 1.5 }}>
                        {buyer.bankAccount}
                    </TableCell>
                    
                    <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 'bold', color: '#1b5e20' }}>
                        {buyer.amount}
                    </TableCell>
                    
                    <TableCell align="center">
                        {buyer.reviewImage ? (
                            <Link 
                                href={typeof buyer.reviewImage === 'string' ? buyer.reviewImage : URL.createObjectURL(buyer.reviewImage)} 
                                target="_blank"
                            >
                                <ImageIcon color="primary" />
                            </Link>
                        ) : <Typography variant="caption" color="text.disabled">-</Typography>}
                    </TableCell>
                    
                    <TableCell align="center">
                      <Button size="small" color="error">삭제</Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 6, color: '#999' }}>
                    등록된 데이터가 없습니다. 우측 상단 버튼을 눌러 추가하세요.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <OperatorAddBuyerDialog 
        open={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={handleAddBuyer} 
      />
    </>
  );
}

export default OperatorBuyerTable;