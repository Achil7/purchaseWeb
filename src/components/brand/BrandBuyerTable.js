import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Box, Typography, Button, Paper, TableContainer, Table, TableHead, TableRow, TableCell, TableBody, 
  Link, Breadcrumbs, Chip 
} from '@mui/material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import ImageIcon from '@mui/icons-material/Image';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

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
    isDepositConfirmed: true, 
    reviewImage: 'sample.jpg' 
  },
];

function BrandBuyerTable() {
  const { campaignId, itemId } = useParams();
  const navigate = useNavigate();

  const [buyers, setBuyers] = useState(initialBuyers);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // [수정] 수정할 대상을 저장하는 state (null이면 추가 모드)
  const [editingBuyer, setEditingBuyer] = useState(null);

  const filteredBuyers = buyers.filter(b => b.itemId === parseInt(itemId));

  // [수정] 다이얼로그 열기 (추가 모드)
  const handleOpenAdd = () => {
    setEditingBuyer(null); // 수정 상태 초기화
    setIsModalOpen(true);
  };

  // [수정] 다이얼로그 열기 (수정 모드)
  const handleOpenEdit = (buyer) => {
    setEditingBuyer(buyer); // 수정할 데이터 세팅
    setIsModalOpen(true);
  };

  // [수정] 저장 핸들러 (추가/수정 분기 처리)
  const handleSaveBuyer = (formData) => {
    if (editingBuyer) {
        // [수정 로직] ID가 일치하는 데이터를 찾아서 업데이트
        setBuyers(prev => prev.map(b => 
            b.id === editingBuyer.id 
                ? { ...b, ...formData } // 기존 데이터 + 폼 데이터 병합
                : b
        ));
    } else {
        // [추가 로직]
        const newBuyer = { 
            id: Date.now(), 
            itemId: parseInt(itemId), 
            isDepositConfirmed: false, // 기본값
            ...formData 
        };
        setBuyers([newBuyer, ...buyers]);
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id) => {
      if(window.confirm("정말 삭제하시겠습니까?")) {
          setBuyers(prev => prev.filter(b => b.id !== id));
      }
  };

  const totalAmount = filteredBuyers.reduce((acc, curr) => {
    const value = curr.amount ? parseInt(curr.amount.toString().replace(/,/g, ''), 10) : 0;
    return acc + (isNaN(value) ? 0 : value);
  }, 0);

  const columns = [
    { id: 'orderNum', label: '주문번호', width: 120 },
    { id: 'buyer', label: '구매자', width: 80 },
    { id: 'recipient', label: '수취인', width: 80 },
    { id: 'userId', label: '아이디', width: 100 },
    { id: 'contact', label: '연락처', width: 130 },
    { id: 'address', label: '주소', width: 300 },
    { id: 'bankAccount', label: '계좌정보', width: 250 },
    { id: 'amount', label: '금액', width: 100 },
    { id: 'deposit', label: '입금확인', width: 90 },
    { id: 'image', label: '리뷰샷', width: 80 },
    { id: 'action', label: '관리', width: 140 }, // [수정] 버튼 2개가 들어가야 하므로 너비 확보
  ];

  return (
    <>
      <Box sx={{ mb: 2 }}>
        <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />}>
          <Link underline="hover" color="inherit" onClick={() => navigate('/brand')} sx={{ cursor: 'pointer' }}>
            캠페인 목록
          </Link>
          <Link underline="hover" color="inherit" onClick={() => navigate(`/brand/campaign/${campaignId}`)} sx={{ cursor: 'pointer' }}>
            품목 목록
          </Link>
          <Typography color="text.primary">리뷰 관리</Typography>
        </Breadcrumbs>
      </Box>

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
          onClick={handleOpenAdd} 
          sx={{ px: 3, py: 1.5, fontWeight: 'bold' }}
        >
          구매자 추가 (붙여넣기)
        </Button>
      </Box>

      <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 3, boxShadow: 3 }}>
        <TableContainer sx={{ maxHeight: '75vh' }}>
          <Table stickyHeader size="small" sx={{ minWidth: 1600 }}>
            <TableHead>
              <TableRow>
                {columns.map((col) => (
                  <TableCell 
                    key={col.id} 
                    align={col.id === 'image' || col.id === 'action' || col.id === 'deposit' ? 'center' : 'left'}
                    sx={{ 
                        fontWeight: 'bold', 
                        bgcolor: '#fafafa', 
                        whiteSpace: 'nowrap', 
                        minWidth: col.width,
                        verticalAlign: 'bottom' 
                    }}
                  >
                    {col.id === 'amount' ? (
                        <Box sx={{ lineHeight: 1 }}>
                            <Typography variant="subtitle2" display="block" color="success.main" fontWeight="bold" sx={{ mb: 0.5 }}>
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
                    <TableCell sx={{ whiteSpace: 'normal', wordBreak: 'keep-all', minWidth: 300, lineHeight: 1.5 }}>
                        {buyer.address}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'normal', wordBreak: 'keep-all', minWidth: 250, lineHeight: 1.5 }}>
                        {buyer.bankAccount}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 'bold', color: '#1b5e20' }}>
                        {buyer.amount}
                    </TableCell>

                    <TableCell align="center">
                        {buyer.isDepositConfirmed ? (
                            <Chip label="입금완료" color="primary" size="small" sx={{ fontWeight: 'bold' }} />
                        ) : (
                            <Chip label="대기중" size="small" variant="outlined" sx={{ color: '#999', borderColor: '#ddd' }} />
                        )}
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
                    
                    {/* [수정] 관리 컬럼: 수정 및 삭제 버튼 */}
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                          <Button 
                              size="small" 
                              variant="outlined" 
                              onClick={() => handleOpenEdit(buyer)}
                              sx={{ minWidth: 50, padding: '2px 8px' }}
                          >
                              수정
                          </Button>
                          <Button 
                              size="small" 
                              color="error" 
                              variant="outlined"
                              onClick={() => handleDelete(buyer.id)}
                              sx={{ minWidth: 50, padding: '2px 8px' }}
                          >
                              삭제
                          </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={11} align="center" sx={{ py: 6, color: '#999' }}>
                    등록된 데이터가 없습니다. 우측 상단 버튼을 눌러 추가하세요.
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

export default BrandBuyerTable;