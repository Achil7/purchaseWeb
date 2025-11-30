import React, { useState, useEffect } from 'react'; // useEffect 추가 (데이터 로딩용)
import {
  AppBar, Toolbar, Typography, Button, IconButton, Drawer, List, ListItem,
  ListItemButton, ListItemIcon, ListItemText, Box, CssBaseline, Container,
  Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Divider, Avatar, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Grid, Breadcrumbs, Link
} from '@mui/material';

// 실제 통신을 위한 라이브러리 (설치되었다고 가정)
// import axios from 'axios'; 

// 아이콘
import AssignmentIcon from '@mui/icons-material/Assignment';
import LogoutIcon from '@mui/icons-material/Logout';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ImageIcon from '@mui/icons-material/Image';

const drawerWidth = 240;

// [데이터] - 현재는 Mock Data
const assignedCampaigns = [
  { id: 1, date: '2023-06-07', title: '영업사의 스트 캠페인', status: '진행 중' },
  { id: 2, date: '2023-06-22', title: '여름 시즌 프로모션', status: '진행 중' },
];

const assignedItems = [
  { id: 101, campaignId: 1, name: '품목 A (30대 타겟)', status: '진행 중' },
  { id: 102, campaignId: 1, name: '품목 B (40대 타겟)', status: '진행 중' },
  { id: 201, campaignId: 2, name: '캠핑 의자 세트', status: '진행 중' },
];

const initialBuyers = [
  { 
    id: 1001, 
    itemId: 101, 
    orderNum: '20230607-001', 
    buyer: '홍길동', 
    recipient: '홍길동', 
    userId: 'hong', 
    contact: '010-1234-5678', 
    address: '서울시 강남구 테헤란로 123번길 45, 101동 1204호', 
    bankAccount: '국민 111-222', 
    amount: '50000',
    reviewImage: 'sample.jpg' 
  },
];

function OperatorDashboard() {
  const [buyers, setBuyers] = useState(initialBuyers);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [openModal, setOpenModal] = useState(false);
  const [pasteInput, setPasteInput] = useState('');
  
  // [State] 입력 폼
  const [infoForm, setInfoForm] = useState({
    orderNum: '', buyer: '', recipient: '', userId: '', contact: '', address: '', bankAccount: '', amount: '',
    reviewImage: null 
  });

  // -------------------------------------------------------------------------
  // [AWS DB 연결 시 추가될 로직: 초기 데이터 로딩]
  // -------------------------------------------------------------------------
  /*
  useEffect(() => {
    // 페이지 로드 시(또는 아이템 선택 시) AWS RDS(Postgres)에서 저장된 리뷰 데이터를 불러옴
    const fetchBuyers = async () => {
      try {
        if (!selectedItem) return;

        // 예: GET /api/reviews?itemId=101
        // const response = await axios.get(`/api/reviews`, { params: { itemId: selectedItem.id } });
        
        // 받아온 데이터를 state에 저장. 
        // DB에는 이미지 경로가 'https://my-bucket.s3.ap-northeast-2.amazonaws.com/image.jpg' 형태로 저장되어 있음
        // setBuyers(response.data); 
      } catch (error) {
        console.error("데이터 로딩 실패:", error);
      }
    };
    fetchBuyers();
  }, [selectedItem]); // selectedItem이 바뀔 때마다 실행
  */
  // -------------------------------------------------------------------------

  const handleSelectCampaign = (campaign) => setSelectedCampaign(campaign);
  const handleSelectItem = (item) => setSelectedItem(item);
  const handleBackToCampaigns = () => { setSelectedCampaign(null); setSelectedItem(null); };
  const handleBackToItems = () => setSelectedItem(null);

  const handleOpenAddModal = () => {
    setPasteInput('');
    setInfoForm({ orderNum: '', buyer: '', recipient: '', userId: '', contact: '', address: '', bankAccount: '', amount: '', reviewImage: null });
    setOpenModal(true);
  };

  // --- [AWS S3] 이미지 파일 선택 및 업로드 핸들러 ---
  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      // 1. 일단 로컬 미리보기를 위해 파일 객체를 state에 임시 저장 (현재 로직)
      setInfoForm({ ...infoForm, reviewImage: file });
      
      console.log("선택된 파일:", file.name);

      // -----------------------------------------------------------------------
      // [AWS S3 업로드 로직 구현 가이드]
      // S3 업로드는 보안을 위해 'Presigned URL(미리 서명된 URL)' 방식을 주로 사용합니다.
      // -----------------------------------------------------------------------
      /*
      try {
        // [Step 1] 백엔드 API에 업로드할 파일명 등을 보내고 S3 업로드용 임시 URL(Presigned URL)을 요청
        // const { data: { presignedUrl, fileKey } } = await axios.post('/api/upload/presigned-url', {
        //   fileName: file.name,
        //   fileType: file.type
        // });

        // [Step 2] 발급받은 URL로 프론트엔드에서 S3로 직접 파일 전송 (PUT 방식)
        // await axios.put(presignedUrl, file, {
        //   headers: { 'Content-Type': file.type }
        // });

        // [Step 3] 업로드 성공 시, DB 저장을 위해 실제 이미지 URL(또는 Key)을 state에 업데이트
        // const s3ImageUrl = `https://my-s3-bucket-url.com/${fileKey}`;
        
        // infoForm state를 업데이트하여 나중에 '리스트에 추가' 버튼 누를 때 이 URL이 DB로 가도록 함
        // setInfoForm(prev => ({ ...prev, reviewImage: s3ImageUrl })); 
        
        console.log("S3 업로드 완료:", s3ImageUrl);

      } catch (error) {
        console.error("이미지 업로드 중 오류 발생:", error);
        alert("이미지 업로드 실패");
      }
      */
      // -----------------------------------------------------------------------
    }
  };

  const handleSmartPaste = (e) => {
    const text = e.target.value;
    setPasteInput(text);
    if (!text) return;

    let parts = text.split('\t'); 
    if (parts.length < 2) parts = text.split('/'); 
    if (parts.length < 2) parts = text.split(','); 

    setInfoForm({
      ...infoForm,
      orderNum: parts[0]?.trim() || '',
      buyer: parts[1]?.trim() || '',
      recipient: parts[2]?.trim() || '',
      userId: parts[3]?.trim() || '',
      contact: parts[4]?.trim() || '',
      address: parts[5]?.trim() || '',
      bankAccount: parts[6]?.trim() || '',
      amount: parts[7]?.trim() || '',
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setInfoForm({ ...infoForm, [name]: value });
  };

  // --- [AWS RDS] 데이터 저장 핸들러 ---
  const handleAddBuyer = async () => {
    if (!infoForm.orderNum && !infoForm.buyer) {
      alert("최소한 주문번호나 구매자 정보는 입력해주세요.");
      return;
    }

    // -----------------------------------------------------------------------
    // [AWS RDS(PostgreSQL) 저장 로직 구현 가이드]
    // -----------------------------------------------------------------------
    /*
    try {
      // 1. 전송할 데이터 객체 구성
      // (infoForm.reviewImage는 위 handleImageChange에서 이미 S3 URL 문자열로 바뀌어 있다고 가정)
      const payload = {
        itemId: selectedItem.id,
        ...infoForm 
      };

      // 2. 백엔드 API 호출하여 DB에 Insert (POST 요청)
      // const response = await axios.post('/api/reviews', payload);
      
      // 3. 성공 시 처리
      // const savedBuyerData = response.data; // DB에서 생성된 ID 등이 포함된 완성된 데이터

      // 4. 화면 갱신 (새로고침 없이 리스트에 추가)
      // setBuyers([savedBuyerData, ...buyers]);
      
      alert("저장되었습니다.");
      setOpenModal(false);

    } catch (error) {
      console.error("DB 저장 실패:", error);
      alert("저장에 실패했습니다.");
    }
    */

    // --- [현재 로컬 테스트용 코드 유지] ---
    const newBuyer = {
      id: Date.now(),
      itemId: selectedItem.id, 
      ...infoForm
    };
    
    setBuyers([newBuyer, ...buyers]); 
    setOpenModal(false);
  };

  const renderContent = () => {
    if (!selectedCampaign) {
      return (
        <>
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" fontWeight="bold" color="text.primary">나의 캠페인 목록</Typography>
            <Typography variant="body2" color="text.secondary">관리자로부터 배정받은 캠페인입니다.</Typography>
          </Box>
          <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
            <TableContainer>
              <Table hover>
                <TableHead sx={{ bgcolor: '#e0f2f1' }}>
                  <TableRow>
                    <TableCell fontWeight="bold">날짜</TableCell>
                    <TableCell fontWeight="bold">캠페인명</TableCell>
                    <TableCell align="center">상태</TableCell>
                    <TableCell align="right">이동</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {assignedCampaigns.map((camp) => (
                    <TableRow key={camp.id} hover onClick={() => handleSelectCampaign(camp)} sx={{ cursor: 'pointer' }}>
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

    if (selectedCampaign && !selectedItem) {
      const filteredItems = assignedItems.filter(item => item.campaignId === selectedCampaign.id);
      return (
        <>
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" fontWeight="bold" color="text.primary">{selectedCampaign.title}</Typography>
            <Typography variant="body2" color="text.secondary">작업할 품목을 선택하세요.</Typography>
          </Box>
          <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
            <TableContainer>
              <Table hover>
                <TableHead sx={{ bgcolor: '#e0f2f1' }}>
                  <TableRow>
                    <TableCell fontWeight="bold">품목명</TableCell>
                    <TableCell align="center">등록된 구매자</TableCell>
                    <TableCell align="center">상태</TableCell>
                    <TableCell align="right">작업하기</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredItems.map((item) => {
                    const count = buyers.filter(b => b.itemId === item.id).length;
                    return (
                      <TableRow key={item.id} hover onClick={() => handleSelectItem(item)} sx={{ cursor: 'pointer' }}>
                        <TableCell sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
                           <InsertDriveFileIcon color="action" /> {item.name}
                        </TableCell>
                        <TableCell align="center">{count}명</TableCell>
                        <TableCell align="center"><Chip label={item.status} size="small" /></TableCell>
                        <TableCell align="right"><Button variant="contained" size="small" color="primary">선택</Button></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      );
    }

    if (selectedItem) {
      const filteredBuyers = buyers.filter(b => b.itemId === selectedItem.id);
      return (
        <>
          <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="h5" fontWeight="bold" color="text.primary">{selectedItem.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                캠페인: {selectedCampaign.title} | 총 {filteredBuyers.length}명
              </Typography>
            </Box>
            <Button 
              variant="contained" 
              color="success" 
              startIcon={<AddCircleIcon />} 
              onClick={handleOpenAddModal}
              sx={{ px: 3, py: 1 }}
            >
              구매자 추가
            </Button>
          </Box>

          <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 3, boxShadow: 2 }}>
            <TableContainer sx={{ maxHeight: '60vh' }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#fff3e0', whiteSpace: 'nowrap' }}>주문번호</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#fff3e0', whiteSpace: 'nowrap' }}>구매자</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#fff3e0', whiteSpace: 'nowrap' }}>수취인</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#fff3e0', whiteSpace: 'nowrap' }}>아이디</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#fff3e0', whiteSpace: 'nowrap' }}>이미지</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#fff3e0', whiteSpace: 'nowrap' }}>연락처</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#fff3e0', minWidth: 300 }}>주소</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#fff3e0', whiteSpace: 'nowrap' }}>계좌정보</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#fff3e0', whiteSpace: 'nowrap' }}>금액</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#e0f2f1', whiteSpace: 'nowrap' }}>관리</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredBuyers.length > 0 ? (
                    filteredBuyers.map((buyer) => (
                      <TableRow key={buyer.id} hover>
                        <TableCell>{buyer.orderNum}</TableCell>
                        <TableCell>{buyer.buyer}</TableCell>
                        <TableCell>{buyer.recipient}</TableCell>
                        <TableCell>{buyer.userId}</TableCell>
                        
                        {/* 이미지 유무 표시 및 링크 처리 */}
                        <TableCell align="center">
                            {buyer.reviewImage ? (
                                /* 실제 구현 시: 이미지를 클릭하면 S3 URL로 새 창 열기 등의 동작 */
                                <Link href={typeof buyer.reviewImage === 'string' ? buyer.reviewImage : '#'} target="_blank">
                                    <ImageIcon color="primary" fontSize="small" titleAccess="이미지 확인" />
                                </Link>
                            ) : (
                                <Typography variant="caption" color="text.disabled">-</Typography>
                            )}
                        </TableCell>

                        <TableCell>{buyer.contact}</TableCell>
                        <TableCell sx={{ wordBreak: 'keep-all' }}>{buyer.address}</TableCell>
                        <TableCell>{buyer.bankAccount}</TableCell>
                        <TableCell>{buyer.amount}</TableCell>
                        <TableCell align="center">
                          <Button size="small" color="error">삭제</Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={10} align="center" sx={{ py: 5, color: '#aaa' }}>
                        등록된 데이터가 없습니다.
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
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, bgcolor: '#00897b' }}>
        <Toolbar>
          <Typography variant="h6" noWrap sx={{ flexGrow: 1, fontWeight: 'bold' }}>CampManager (진행자)</Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'rgba(255,255,255,0.1)', px: 1.5, py: 0.5, borderRadius: 2 }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'teal' }}>OP</Avatar>
            <Typography variant="subtitle2">김진행 님</Typography>
          </Box>
        </Toolbar>
      </AppBar>

      <Drawer variant="permanent" sx={{ width: drawerWidth, flexShrink: 0, [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box' } }}>
        <Toolbar />
        <Box sx={{ overflow: 'auto' }}>
          <List>
            <ListItem disablePadding><ListItemButton selected><ListItemIcon><AssignmentIcon color="success" /></ListItemIcon><ListItemText primary="구매 정보 입력" sx={{ fontWeight: 'bold', color: '#00897b' }} /></ListItemButton></ListItem>
            <Divider sx={{ my: 1 }} />
            <ListItem disablePadding><ListItemButton><ListItemIcon><LogoutIcon /></ListItemIcon><ListItemText primary="로그아웃" /></ListItemButton></ListItem>
          </List>
        </Box>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3, bgcolor: '#f0fdf4', minHeight: '100vh', width: '100%' }}>
        <Toolbar />
        <Container maxWidth="xl">
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
          {renderContent()}
        </Container>
      </Box>

      {/* 모달 */}
      <Dialog open={openModal} onClose={() => setOpenModal(false)} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontWeight: 'bold', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 1 }}>
          <ContentPasteIcon color="primary"/> 구매자 정보 추가
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Box sx={{ mb: 4, p: 2, bgcolor: '#e3f2fd', borderRadius: 2, border: '1px dashed #1976d2' }}>
            <Typography variant="subtitle2" color="primary" fontWeight="bold" gutterBottom>⚡ 엑셀/텍스트 붙여넣기 (Ctrl+V)</Typography>
            <Typography variant="caption" display="block" color="text.secondary" sx={{ mb: 1 }}>순서: 주문번호 / 구매자 / 수취인 / 아이디 / 연락처 / 주소 / 은행계좌 / 금액</Typography>
            <TextField fullWidth multiline rows={2} placeholder="여기에 붙여넣으세요..." value={pasteInput} onChange={handleSmartPaste} sx={{ bgcolor: 'white' }} />
          </Box>
          
          <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>입력 데이터 확인</Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} sm={3}><TextField label="주문번호" name="orderNum" fullWidth size="small" value={infoForm.orderNum} onChange={handleInputChange} /></Grid>
            <Grid item xs={6} sm={3}><TextField label="구매자" name="buyer" fullWidth size="small" value={infoForm.buyer} onChange={handleInputChange} /></Grid>
            <Grid item xs={6} sm={3}><TextField label="수취인" name="recipient" fullWidth size="small" value={infoForm.recipient} onChange={handleInputChange} /></Grid>
            <Grid item xs={6} sm={3}><TextField label="아이디" name="userId" fullWidth size="small" value={infoForm.userId} onChange={handleInputChange} /></Grid>
            <Grid item xs={6} sm={4}><TextField label="연락처" name="contact" fullWidth size="small" value={infoForm.contact} onChange={handleInputChange} /></Grid>
            <Grid item xs={6} sm={4}><TextField label="금액" name="amount" fullWidth size="small" value={infoForm.amount} onChange={handleInputChange} /></Grid>
            <Grid item xs={12} sm={4}><TextField label="은행/계좌/이름" name="bankAccount" fullWidth size="small" value={infoForm.bankAccount} onChange={handleInputChange} /></Grid>
            <Grid item xs={12}><TextField label="주소" name="address" fullWidth size="small" value={infoForm.address} onChange={handleInputChange} /></Grid>
            
            {/* 리뷰 이미지 업로드 버튼 영역 */}
            <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" gutterBottom>리뷰 이미지 첨부</Typography>
                <Button 
                    component="label" 
                    variant="outlined" 
                    fullWidth 
                    startIcon={<CloudUploadIcon />} 
                    sx={{ height: 50, borderStyle: 'dashed', borderColor: infoForm.reviewImage ? 'green' : '#bbb', color: infoForm.reviewImage ? 'green' : 'inherit' }}
                >
                    {infoForm.reviewImage 
                      ? `선택된 파일: ${infoForm.reviewImage.name || '이미지 URL'}` 
                      : "이미지 파일 선택 (클릭)"}
                    <input type="file" hidden accept="image/*" onChange={handleImageChange} />
                </Button>
                {infoForm.reviewImage && (
                    <Typography variant="caption" color="success.main" sx={{ mt: 1, display: 'block' }}>
                        * 저장을 누르면 S3에 업로드되고 DB에 URL이 저장됩니다.
                    </Typography>
                )}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3, borderTop: '1px solid #eee' }}>
          <Button onClick={() => setOpenModal(false)} color="inherit" size="large">취소</Button>
          <Button onClick={handleAddBuyer} variant="contained" color="success" size="large" disableElevation>리스트에 추가</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default OperatorDashboard;