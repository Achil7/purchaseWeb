import React, { useState } from 'react';
import {
  AppBar, Toolbar, Typography, Button, IconButton, Drawer, List, ListItem,
  ListItemButton, ListItemIcon, ListItemText, Box, CssBaseline, Container,
  Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Divider, Avatar, Select, MenuItem, FormControl, InputLabel, Chip
} from '@mui/material';

// 아이콘 불러오기
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd'; // 진행자 배정 아이콘
import SettingsIcon from '@mui/icons-material/Settings';
import NotificationsIcon from '@mui/icons-material/Notifications';
import SaveIcon from '@mui/icons-material/Save';

const drawerWidth = 240;

// [더미 데이터] 영업사들이 등록한 품목 리스트 (실제론 DB에서 가져옴)
const initialItems = [
  { id: 1, date: '2023-06-07', salesPerson: '김영업(A팀)', campaign: '영업사의 스트 캠페인', detail: '품목 이명', operator: '' },
  { id: 2, date: '2023-06-22', salesPerson: '박영업(B팀)', campaign: '여름 시즌 프로모션', detail: '품목 상세 정보', operator: '' },
  { id: 3, date: '2023-03-15', salesPerson: '김영업(A팀)', campaign: '마엔라의 신규 런칭', detail: '품목 상세 정보', operator: '이미배정됨' },
  { id: 4, date: '2023-02-10', salesPerson: '최영업(C팀)', campaign: '마인라의 스트 캠페인', detail: '품목 상세 정보', operator: '' },
  { id: 5, date: '2023-02-15', salesPerson: '박영업(B팀)', campaign: '마예리의 스트 캠페인', detail: '품목 상세 정보', operator: '' },
];

// [더미 데이터] 배정 가능한 진행자 목록
const operatorList = ['김진행', '이진행', '박진행', '최진행'];

function AdminDashboard() {
  // [상태] 전체 아이템 및 배정 상태 관리
  const [items, setItems] = useState(initialItems);

  // [핸들러] 특정 품목의 진행자 변경 시 실행
  const handleOperatorChange = (itemId, newOperator) => {
    const updatedItems = items.map(item => 
      item.id === itemId ? { ...item, operator: newOperator } : item
    );
    setItems(updatedItems);
  };

  // [핸들러] 저장 버튼 클릭 시
  const handleSaveAssignments = () => {
    // 실제로는 여기서 백엔드 API로 변경된 배정 정보를 전송합니다.
    const assignedCount = items.filter(item => item.operator && item.operator !== '이미배정됨').length;
    if (assignedCount === 0) {
      alert("배정된 내역이 없습니다.");
      return;
    }
    console.log("저장할 배정 내역:", items);
    alert(`${assignedCount}건의 진행자 배정이 저장되었습니다.`);
    // 저장 후 '이미배정됨' 상태로 변경하는 로직 등이 추가될 수 있음
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      
      {/* 1. 상단 헤더 (AppBar) - 관리자용 색상 변경 */}
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, bgcolor: '#2c387e' }}> {/* 조금 더 진한 색상 */}
        <Toolbar>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
            CampManager (총관리자)
          </Typography>
          
          {/* 우측 상단 저장 버튼 (핵심 기능) */}
          <Button 
            variant="contained" 
            color="error" // 강조를 위해 붉은 계열 사용
            startIcon={<SaveIcon />} 
            onClick={handleSaveAssignments}
            sx={{ mr: 2, fontWeight: 'bold' }}
          >
            배정 내용 저장
          </Button>

          <IconButton color="inherit" sx={{ mr: 1 }}>
            <NotificationsIcon />
          </IconButton>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', bgcolor: 'rgba(255,255,255,0.1)', px: 1.5, py: 0.5, borderRadius: 2 }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'purple' }}>A</Avatar> {/* 관리자 이니셜 A */}
            <Typography variant="subtitle2">관리자님</Typography>
          </Box>
        </Toolbar>
      </AppBar>

      {/* 2. 좌측 사이드바 (Drawer) - 관리자 메뉴로 변경 */}
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
              <ListItemButton>
                <ListItemIcon><DashboardIcon /></ListItemIcon>
                <ListItemText primary="전체 대시보드" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton selected> {/* 현재 페이지 강조 */}
                <ListItemIcon><AssignmentIndIcon color="primary" /></ListItemIcon>
                <ListItemText primary="품목 관리 및 배정" sx={{ fontWeight: 'bold', color: '#1976d2' }} />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton>
                <ListItemIcon><PeopleIcon /></ListItemIcon>
                <ListItemText primary="사용자 관리 (영업/진행)" />
              </ListItemButton>
            </ListItem>
            <Divider sx={{ my: 1 }} />
            <ListItem disablePadding>
              <ListItemButton>
                <ListItemIcon><SettingsIcon /></ListItemIcon>
                <ListItemText primary="시스템 설정" />
              </ListItemButton>
            </ListItem>
          </List>
        </Box>
      </Drawer>

      {/* 3. 메인 컨텐츠 영역 */}
      <Box component="main" sx={{ flexGrow: 1, p: 3, bgcolor: '#eef2f6', minHeight: '100vh' }}>
        <Toolbar />
        
        <Container maxWidth="xl"> {/* 더 넓은 화면 사용 */}
          {/* 타이틀 영역 */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" fontWeight="bold" color="text.primary" gutterBottom>
              등록된 품목 및 진행자 배정
            </Typography>
            <Typography variant="body2" color="text.secondary">
              영업사가 등록한 품목을 확인하고, 담당 진행자를 지정해주세요. 배정 후 반드시 우측 상단의 '저장' 버튼을 눌러야 합니다.
            </Typography>
          </Box>

          {/* 데이터 테이블 카드 */}
          <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 3, boxShadow: 3 }}>
            <TableContainer sx={{ maxHeight: 'calc(100vh - 250px)' }}> {/* 높이 자동 조절 */}
              <Table stickyHeader aria-label="sticky table">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f8f9fa' }}>날짜</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f8f9fa' }}>영업사 (소속)</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f8f9fa' }}>품목명 / 상세 정보</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#e3f2fd', width: '220px' }}> {/* 배정 컬럼 강조 */}
                      진행자 배정 (필수)
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#f8f9fa' }}>상태</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((row) => (
                    <TableRow hover role="checkbox" tabIndex={-1} key={row.id} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                      <TableCell>{row.date}</TableCell>
                      <TableCell>{row.salesPerson}</TableCell>
                      <TableCell>
                        <Typography variant="subtitle2" fontWeight="bold">{row.campaign}</Typography>
                        <Typography variant="caption" color="text.secondary">{row.detail}</Typography>
                      </TableCell>
                      {/* 핵심 기능: 진행자 선택 드롭다운 */}
                      <TableCell sx={{ bgcolor: row.operator ? '#f1f8e9' : 'inherit' }}>
                        {row.operator === '이미배정됨' ? (
                          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                            배정 완료 (김진행)
                          </Typography>
                        ) : (
                          <FormControl fullWidth size="small">
                            <InputLabel id={`select-operator-label-${row.id}`}>선택하세요</InputLabel>
                            <Select
                              labelId={`select-operator-label-${row.id}`}
                              value={row.operator}
                              label="선택하세요"
                              onChange={(e) => handleOperatorChange(row.id, e.target.value)}
                              sx={{ bgcolor: 'white' }}
                            >
                              <MenuItem value="">
                                <em>선택 안 함</em>
                              </MenuItem>
                              {operatorList.map((op) => (
                                <MenuItem key={op} value={op}>{op}</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        {row.operator && row.operator !== '이미배정됨' ? (
                          <Chip label="배정 중" color="warning" size="small" />
                        ) : row.operator === '이미배정됨' ? (
                          <Chip label="배정 완료" color="success" size="small" />
                        ) : (
                          <Chip label="미배정" color="default" size="small" variant="outlined" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Container>
      </Box>
    </Box>
  );
}

export default AdminDashboard;