import React, { useState } from 'react';
import {
  AppBar, Toolbar, Typography, Button, IconButton, Drawer, List, ListItem,
  ListItemButton, ListItemIcon, ListItemText, Box, CssBaseline, Container,
  Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Divider, Avatar, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Chip, Breadcrumbs, Link
} from '@mui/material';

// 아이콘
import DashboardIcon from '@mui/icons-material/Dashboard';
import InventoryIcon from '@mui/icons-material/Inventory';
import PersonIcon from '@mui/icons-material/Person';
import SettingsIcon from '@mui/icons-material/Settings';
import NotificationsIcon from '@mui/icons-material/Notifications';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack'; // 뒤로가기 아이콘
import NavigateNextIcon from '@mui/icons-material/NavigateNext';

const drawerWidth = 240;

// [더미 데이터 1] 캠페인 목록 (상위 개념)
const initialCampaigns = [
  { id: 1, date: '2023-06-07', title: '영업사의 리스트 캠페인', itemCount: 3, status: '진행 중' },
  { id: 2, date: '2023-06-22', title: '여름 시즌 프로모션', itemCount: 1, status: '등록 완료' },
];

// [더미 데이터 2] 품목 목록 (하위 개념 - campaignId로 연결됨)
const initialItems = [
  { id: 101, campaignId: 1, name: '여름 샌들 A타입', detail: '30대 여성 타겟', status: '접수' },
  { id: 102, campaignId: 1, name: '비치 웨어 세트', detail: 'S/M/L 사이즈', status: '접수' },
  { id: 103, campaignId: 1, name: '방수 폰케이스', detail: '색상 랜덤', status: '접수' },
  { id: 201, campaignId: 2, name: '캠핑용 의자', detail: '1+1 행사', status: '접수' },
];

function SalesDashboard() {
  // [State] 데이터 상태
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [items, setItems] = useState(initialItems);

  // [State] 화면 전환 상태 (null이면 목록, 값이 있으면 상세화면)
  const [selectedCampaign, setSelectedCampaign] = useState(null);

  // [State] 모달 상태 (type: 'campaign' | 'item')
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState('campaign'); 

  // [State] 입력 폼
  const [form, setForm] = useState({ date: '', title: '', name: '', detail: '' });

  // --- 핸들러: 상세 보기 진입 ---
  const handleViewDetail = (campaign) => {
    setSelectedCampaign(campaign);
  };

  // --- 핸들러: 뒤로 가기 ---
  const handleBackToList = () => {
    setSelectedCampaign(null);
  };

  // --- 핸들러: 모달 열기 ---
  const openAddModal = (type) => {
    setModalType(type);
    setForm({ date: '', title: '', name: '', detail: '' }); // 폼 초기화
    setModalOpen(true);
  };

  // --- 핸들러: 저장 (캠페인 추가 OR 품목 추가) ---
  const handleRegister = () => {
    if (modalType === 'campaign') {
      // 1. 캠페인 추가 로직
      if (!form.date || !form.title) return alert("날짜와 캠페인명을 입력해주세요.");
      const newCampaign = {
        id: Date.now(), // 임시 ID
        date: form.date,
        title: form.title,
        itemCount: 0,
        status: '등록 완료'
      };
      setCampaigns([newCampaign, ...campaigns]);

    } else {
      // 2. 품목 추가 로직 (상세 화면에서)
      if (!form.name) return alert("품목명을 입력해주세요.");
      const newItem = {
        id: Date.now(),
        campaignId: selectedCampaign.id,
        name: form.name,
        detail: form.detail,
        status: '접수'
      };
      setItems([newItem, ...items]);

      // 캠페인의 품목 수(itemCount) 증가시키기
      const updatedCampaigns = campaigns.map(c => 
        c.id === selectedCampaign.id ? { ...c, itemCount: c.itemCount + 1 } : c
      );
      setCampaigns(updatedCampaigns);
      
      // 현재 보고 있는 캠페인 정보도 업데이트 (화면 갱신용)
      setSelectedCampaign({ ...selectedCampaign, itemCount: selectedCampaign.itemCount + 1 });
    }
    setModalOpen(false);
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      
      {/* 헤더 */}
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, bgcolor: '#1976d2' }}>
        <Toolbar>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
            CampManager (영업사)
          </Typography>
          <IconButton color="inherit"><NotificationsIcon /></IconButton>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 2, bgcolor: 'rgba(255,255,255,0.1)', px: 1.5, py: 0.5, borderRadius: 2 }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'orange' }}>K</Avatar>
            <Typography variant="subtitle2">김영업 대리</Typography>
          </Box>
        </Toolbar>
      </AppBar>

      {/* 사이드바 */}
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
                <ListItemIcon><DashboardIcon color="primary" /></ListItemIcon>
                <ListItemText primary="대시보드" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton>
                <ListItemIcon><InventoryIcon /></ListItemIcon>
                <ListItemText primary="내 품목 관리" />
              </ListItemButton>
            </ListItem>
            <Divider sx={{ my: 1 }} />
            <ListItem disablePadding>
              <ListItemButton>
                <ListItemIcon><PersonIcon /></ListItemIcon>
                <ListItemText primary="내 정보" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton>
                <ListItemIcon><SettingsIcon /></ListItemIcon>
                <ListItemText primary="설정" />
              </ListItemButton>
            </ListItem>
          </List>
        </Box>
      </Drawer>

      {/* 메인 컨텐츠 */}
      <Box component="main" sx={{ flexGrow: 1, p: 3, bgcolor: '#f5f5f5', minHeight: '100vh' }}>
        <Toolbar />
        
        <Container maxWidth="lg">
          {/* 상단 브레드크럼 (네비게이션 경로) */}
          <Box sx={{ mb: 3 }}>
             <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} aria-label="breadcrumb">
                <Link underline="hover" color="inherit" onClick={handleBackToList} sx={{ cursor: 'pointer' }}>
                  대시보드
                </Link>
                {selectedCampaign && (
                  <Typography color="text.primary">{selectedCampaign.title}</Typography>
                )}
             </Breadcrumbs>
          </Box>

          {/* === 조건부 렌더링: 목록 화면 vs 상세 화면 === */}
          {!selectedCampaign ? (
            // [1] 캠페인 목록 화면
            <>
              <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h4" fontWeight="bold" color="text.primary">
                  진행 중인 캠페인
                </Typography>
                <Button 
                  variant="contained" 
                  size="large"
                  startIcon={<AddIcon />} 
                  onClick={() => openAddModal('campaign')}
                >
                  새 캠페인 등록
                </Button>
              </Box>

              <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 2, boxShadow: 3 }}>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold', bgcolor: '#e3f2fd' }}>등록 날짜</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', bgcolor: '#e3f2fd' }}>캠페인명</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#e3f2fd' }}>등록된 품목 수</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#e3f2fd' }}>상태</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: '#e3f2fd' }}>관리</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {campaigns.map((row) => (
                        <TableRow key={row.id} hover>
                          <TableCell>{row.date}</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>{row.title}</TableCell>
                          <TableCell align="center">{row.itemCount}개</TableCell>
                          <TableCell align="center">
                            <Chip label={row.status} color="primary" variant="outlined" size="small" />
                          </TableCell>
                          <TableCell align="right">
                            <Button size="small" variant="contained" onClick={() => handleViewDetail(row)}>
                              상세보기
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </>
          ) : (
            // [2] 캠페인 상세 화면 (품목 리스트)
            <>
              <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <IconButton onClick={handleBackToList} sx={{ bgcolor: 'white', border: '1px solid #ddd' }}>
                    <ArrowBackIcon />
                  </IconButton>
                  <Box>
                    <Typography variant="h4" fontWeight="bold" color="text.primary">
                      {selectedCampaign.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      등록일: {selectedCampaign.date} | 총 품목: {selectedCampaign.itemCount}개
                    </Typography>
                  </Box>
                </Box>
                
                {/* 여기가 핵심: 상세 화면 내 품목 추가 */}
                <Button 
                  variant="contained" 
                  color="secondary" // 색상 구분
                  size="large"
                  startIcon={<AddIcon />} 
                  onClick={() => openAddModal('item')}
                >
                  이 캠페인에 품목 추가
                </Button>
              </Box>

              <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 2, boxShadow: 3 }}>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f3e5f5' }}>품목명</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f3e5f5' }}>상세 정보</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#f3e5f5' }}>상태</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: '#f3e5f5' }}>관리</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {/* 현재 선택된 캠페인 ID에 맞는 품목만 필터링해서 보여줌 */}
                      {items.filter(item => item.campaignId === selectedCampaign.id).length > 0 ? (
                        items.filter(item => item.campaignId === selectedCampaign.id).map((item) => (
                          <TableRow key={item.id} hover>
                            <TableCell sx={{ fontWeight: 'bold' }}>{item.name}</TableCell>
                            <TableCell>{item.detail}</TableCell>
                            <TableCell align="center">
                                <Chip label={item.status} size="small" />
                            </TableCell>
                            <TableCell align="right">
                              <Button size="small" color="error">삭제</Button>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} align="center" sx={{ py: 5, color: '#aaa' }}>
                            등록된 품목이 없습니다. 품목을 추가해주세요.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </>
          )}

        </Container>
      </Box>

      {/* --- 통합 등록 모달 (캠페인용 / 품목용) --- */}
      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 'bold' }}>
          {modalType === 'campaign' ? '새 캠페인 등록' : `[${selectedCampaign?.title}] 품목 추가`}
        </DialogTitle>
        <DialogContent dividers>
          <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            
            {modalType === 'campaign' ? (
              // 캠페인 등록 폼
              <>
                <TextField
                  label="등록 날짜"
                  type="date"
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
                <TextField
                  label="캠페인명"
                  placeholder="예: 여름 시즌 프로모션"
                  fullWidth
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </>
            ) : (
              // 품목 추가 폼
              <>
                <TextField
                  label="품목명"
                  placeholder="예: 여성용 샌들"
                  fullWidth
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <TextField
                  label="품목 상세 정보"
                  placeholder="옵션, 타겟 등 상세 정보"
                  multiline
                  rows={3}
                  fullWidth
                  value={form.detail}
                  onChange={(e) => setForm({ ...form, detail: e.target.value })}
                />
              </>
            )}

          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setModalOpen(false)} color="inherit">취소</Button>
          <Button onClick={handleRegister} variant="contained" disableElevation>
            {modalType === 'campaign' ? '캠페인 생성' : '품목 추가하기'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default SalesDashboard;