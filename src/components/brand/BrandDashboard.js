import React, { useState } from 'react';
import {
  AppBar, Toolbar, Typography, Button, IconButton, Drawer, List, ListItem,
  ListItemButton, ListItemIcon, ListItemText, Box, CssBaseline, Container,
  Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Divider, Avatar, Chip, Dialog, DialogTitle, DialogContent, Breadcrumbs, Link,
  Grid
} from '@mui/material';

// 아이콘
import StoreIcon from '@mui/icons-material/Store';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import LogoutIcon from '@mui/icons-material/Logout';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import ImageIcon from '@mui/icons-material/Image'; // 이미지 아이콘
import CloseIcon from '@mui/icons-material/Close';

const drawerWidth = 240;

// ================= [더미 데이터: 브랜드사 관점] =================

// 1. 캠페인 (Level 1)
const brandCampaigns = [
  { id: 1, date: '2023-05-20', title: '가정의 달 기획전 (건강식품)', status: '완료' },
  { id: 2, date: '2023-06-15', title: '여름 바캉스 필수템 모음', status: '진행 중' },
];

// 2. 품목 (Level 2)
const brandItems = [
  { id: 101, campaignId: 1, name: '홍삼 선물세트 (30대 타겟)', goal: 10, current: 10, status: '마감' },
  { id: 102, campaignId: 1, name: '비타민 C (전연령)', goal: 5, current: 3, status: '진행 중' },
  { id: 201, campaignId: 2, name: '캠핑용 의자', goal: 20, current: 5, status: '진행 중' },
];

// 3. 완료된 리뷰 데이터 (Level 3) - 진행자가 입력한 데이터 기반
const completedReviews = [
  { 
    id: 1001, 
    itemId: 101, 
    orderNum: '20230520-001', 
    buyer: '김구매', 
    userId: 'kim123', 
    blogName: '김구매의 일상', // 예시 데이터
    reviewImage: 'sample1.jpg', // 이미지가 있다고 가정
    uploadDate: '2023-05-22'
  },
  { 
    id: 1002, 
    itemId: 101, 
    orderNum: '20230521-005', 
    buyer: '이리뷰', 
    userId: 'lee_review', 
    blogName: '리뷰왕', 
    reviewImage: null, // 이미지 없음
    uploadDate: '2023-05-23'
  },
];

// ===============================================================

function BrandDashboard() {
  // [State] 네비게이션 상태
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  // [State] 이미지 미리보기 모달
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  // --- 네비게이션 핸들러 ---
  const handleSelectCampaign = (campaign) => setSelectedCampaign(campaign);
  const handleSelectItem = (item) => setSelectedItem(item);
  const handleBackToCampaigns = () => { setSelectedCampaign(null); setSelectedItem(null); };
  const handleBackToItems = () => setSelectedItem(null);

  // --- 이미지 모달 핸들러 ---
  const handleOpenImage = (imageName) => {
    if (!imageName) return;
    setPreviewImage(imageName); // 실제 구현 시에는 S3 URL이 들어감
    setImageModalOpen(true);
  };

  // --- 화면 렌더링 로직 ---
  const renderContent = () => {
    // Level 1: 캠페인 목록 조회
    if (!selectedCampaign) {
      return (
        <>
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" fontWeight="bold" color="text.primary">내 캠페인 목록</Typography>
            <Typography variant="body2" color="text.secondary">의뢰하신 캠페인의 진행 상황을 확인하세요.</Typography>
          </Box>
          <Paper sx={{ borderRadius: 3, overflow: 'hidden', boxShadow: 2 }}>
            <TableContainer>
              <Table hover>
                <TableHead sx={{ bgcolor: '#ede7f6' }}>
                  <TableRow>
                    <TableCell fontWeight="bold">날짜</TableCell>
                    <TableCell fontWeight="bold">캠페인명</TableCell>
                    <TableCell align="center">상태</TableCell>
                    <TableCell align="right">상세보기</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {brandCampaigns.map((camp) => (
                    <TableRow key={camp.id} hover onClick={() => handleSelectCampaign(camp)} sx={{ cursor: 'pointer' }}>
                      <TableCell>{camp.date}</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
                        <FolderIcon color="secondary" /> {camp.title}
                      </TableCell>
                      <TableCell align="center">
                        <Chip 
                            label={camp.status} 
                            color={camp.status === '완료' ? 'secondary' : 'default'} 
                            variant="outlined" 
                            size="small" 
                        />
                      </TableCell>
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

    // Level 2: 품목 목록 조회
    if (selectedCampaign && !selectedItem) {
      const filteredItems = brandItems.filter(item => item.campaignId === selectedCampaign.id);
      return (
        <>
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" fontWeight="bold" color="text.primary">{selectedCampaign.title}</Typography>
            <Typography variant="body2" color="text.secondary">결과를 확인하고 싶은 품목을 선택하세요.</Typography>
          </Box>
          <Paper sx={{ borderRadius: 3, overflow: 'hidden', boxShadow: 2 }}>
            <TableContainer>
              <Table hover>
                <TableHead sx={{ bgcolor: '#ede7f6' }}>
                  <TableRow>
                    <TableCell fontWeight="bold">품목명</TableCell>
                    <TableCell align="center">목표 / 현재</TableCell>
                    <TableCell align="center">진행률</TableCell>
                    <TableCell align="center">상태</TableCell>
                    <TableCell align="right">리뷰 보기</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredItems.map((item) => {
                    const progress = Math.round((item.current / item.goal) * 100);
                    return (
                      <TableRow key={item.id} hover onClick={() => handleSelectItem(item)} sx={{ cursor: 'pointer' }}>
                        <TableCell sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
                           <InsertDriveFileIcon color="action" /> {item.name}
                        </TableCell>
                        <TableCell align="center">{item.goal}건 / <strong style={{ color: '#4a148c' }}>{item.current}건</strong></TableCell>
                        <TableCell align="center">{progress}%</TableCell>
                        <TableCell align="center"><Chip label={item.status} size="small" /></TableCell>
                        <TableCell align="right"><Button variant="contained" size="small" color="secondary">선택</Button></TableCell>
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

    // Level 3: 리뷰 결과 리스트 (진행자가 입력한 데이터)
    if (selectedItem) {
      const reviews = completedReviews.filter(r => r.itemId === selectedItem.id);
      return (
        <>
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" fontWeight="bold" color="text.primary">{selectedItem.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              캠페인: {selectedCampaign.title} | 총 {reviews.length}건의 완료된 리뷰가 있습니다.
            </Typography>
          </Box>

          <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 3, boxShadow: 2 }}>
            <TableContainer sx={{ maxHeight: '60vh' }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f3e5f5' }}>등록일</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f3e5f5' }}>주문번호</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f3e5f5' }}>구매자</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f3e5f5' }}>아이디</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f3e5f5' }}>블로그/매체명</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#f3e5f5' }}>리뷰 이미지</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reviews.length > 0 ? (
                    reviews.map((row) => (
                      <TableRow key={row.id} hover>
                        <TableCell>{row.uploadDate}</TableCell>
                        <TableCell>{row.orderNum}</TableCell>
                        <TableCell fontWeight="bold">{row.buyer}</TableCell>
                        <TableCell>{row.userId}</TableCell>
                        <TableCell>{row.blogName}</TableCell>
                        <TableCell align="center">
                            {row.reviewImage ? (
                                <Button 
                                    size="small" 
                                    variant="outlined" 
                                    startIcon={<ImageIcon />}
                                    color="secondary"
                                    onClick={() => handleOpenImage(row.reviewImage)}
                                >
                                    이미지 보기
                                </Button>
                            ) : (
                                <Typography variant="caption" color="text.disabled">이미지 없음</Typography>
                            )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 5, color: '#aaa' }}>
                        아직 등록된 리뷰 데이터가 없습니다.
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
      
      {/* 1. 헤더 (브랜드사 테마 - 보라색) */}
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, bgcolor: '#4a148c' }}>
        <Toolbar>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
            CampManager (브랜드사)
          </Typography>
          <IconButton color="inherit"><NotificationsIcon /></IconButton>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 2, bgcolor: 'rgba(255,255,255,0.1)', px: 1.5, py: 0.5, borderRadius: 2 }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'orange' }}>B</Avatar>
            <Typography variant="subtitle2">마엔라(주)</Typography>
          </Box>
        </Toolbar>
      </AppBar>

      {/* 2. 사이드바 */}
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box' },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto' }}>
          <List>
            <ListItem disablePadding>
              <ListItemButton selected>
                <ListItemIcon><StoreIcon color="secondary" /></ListItemIcon>
                <ListItemText primary="내 캠페인 현황" sx={{ fontWeight: 'bold', color: '#4a148c' }} />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton>
                <ListItemIcon><TrendingUpIcon /></ListItemIcon>
                <ListItemText primary="통계 / 성과" />
              </ListItemButton>
            </ListItem>
            <Divider sx={{ my: 1 }} />
            <ListItem disablePadding>
              <ListItemButton>
                <ListItemIcon><LogoutIcon /></ListItemIcon>
                <ListItemText primary="로그아웃" />
              </ListItemButton>
            </ListItem>
          </List>
        </Box>
      </Drawer>

      {/* 3. 메인 컨텐츠 */}
      <Box component="main" sx={{ flexGrow: 1, p: 3, bgcolor: '#f3e5f5', minHeight: '100vh', width: '100%' }}>
        <Toolbar />
        <Container maxWidth="xl">
          
          {/* 브레드크럼 (상단 네비게이션 경로) */}
          <Box sx={{ mb: 3 }}>
             <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} aria-label="breadcrumb">
                <Link 
                  underline="hover" 
                  color="inherit" 
                  onClick={handleBackToCampaigns} 
                  sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <FolderIcon sx={{ mr: 0.5 }} fontSize="inherit" />
                  캠페인 목록
                </Link>
                {selectedCampaign && (
                  <Link 
                    underline="hover" 
                    color="inherit" 
                    onClick={handleBackToItems}
                    sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    <InsertDriveFileIcon sx={{ mr: 0.5 }} fontSize="inherit" />
                    {selectedCampaign.title}
                  </Link>
                )}
                {selectedItem && (
                  <Typography color="text.primary" fontWeight="bold">{selectedItem.name}</Typography>
                )}
             </Breadcrumbs>
          </Box>

          {/* 컨텐츠 렌더링 */}
          {renderContent()}

        </Container>
      </Box>

      {/* 4. 이미지 미리보기 모달 */}
      <Dialog open={imageModalOpen} onClose={() => setImageModalOpen(false)} maxWidth="md">
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            리뷰 이미지 확인
            <IconButton onClick={() => setImageModalOpen(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ textAlign: 'center', p: 4 }}>
            {previewImage && (
                <Box>
                    {/* 실제 구현 시 src에 S3 URL을 넣습니다 */}
                    <img 
                        src="https://via.placeholder.com/600x400?text=Review+Image" 
                        alt="Review Preview" 
                        style={{ maxWidth: '100%', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} 
                    />
                    <Typography variant="caption" display="block" sx={{ mt: 2, color: '#666' }}>
                        파일명: {previewImage}
                    </Typography>
                </Box>
            )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}

export default BrandDashboard;