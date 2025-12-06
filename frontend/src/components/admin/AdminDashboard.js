import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AppBar, Toolbar, Typography, Button, IconButton, Box, CssBaseline, Container,
  Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Avatar, Select, MenuItem, FormControl, InputLabel, Chip, CircularProgress, Alert
} from '@mui/material';

// 아이콘 불러오기
import AssignmentIcon from '@mui/icons-material/Assignment';
import NotificationsIcon from '@mui/icons-material/Notifications';
import SaveIcon from '@mui/icons-material/Save';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useAuth } from '../../context/AuthContext';
import AdminUserCreate from './AdminUserCreate';
import ProfileEditDialog from '../common/ProfileEditDialog';
import { itemService } from '../../services';
import { getUsers } from '../../services/userService';

function AdminDashboard() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  // [상태] 전체 아이템 및 배정 상태 관리
  const [items, setItems] = useState([]);
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // [상태] 로컬 배정 변경 사항 추적 (아직 저장 안 된 변경)
  const [pendingAssignments, setPendingAssignments] = useState({});

  // [상태] 사용자 등록 다이얼로그
  const [userDialogOpen, setUserDialogOpen] = useState(false);

  // [상태] 프로필 수정 다이얼로그
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);

  // 데이터 로드
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 품목 목록과 진행자 목록 동시 조회
      const [itemsResponse, operatorsResponse] = await Promise.all([
        itemService.getAllItems(),
        getUsers('operator')
      ]);

      setItems(itemsResponse.data || []);
      setOperators(operatorsResponse.data || []);
      setPendingAssignments({});
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // [핸들러] 로그아웃
  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  // [핸들러] 특정 품목의 진행자 변경 시 실행 (로컬 상태만 변경)
  const handleOperatorChange = (itemId, newOperatorId) => {
    setPendingAssignments(prev => ({
      ...prev,
      [itemId]: newOperatorId
    }));
  };

  // [핸들러] 저장 버튼 클릭 시 - 실제 API 호출
  const handleSaveAssignments = async () => {
    const assignmentsToSave = Object.entries(pendingAssignments).filter(
      ([_, operatorId]) => operatorId
    );

    if (assignmentsToSave.length === 0) {
      alert("배정된 내역이 없습니다.");
      return;
    }

    try {
      setSaving(true);

      // 각 배정을 순차적으로 처리
      for (const [itemId, operatorId] of assignmentsToSave) {
        await itemService.assignOperator(parseInt(itemId), parseInt(operatorId));
      }

      alert(`${assignmentsToSave.length}건의 진행자 배정이 저장되었습니다.`);

      // 데이터 새로고침
      await loadData();
    } catch (err) {
      console.error('Failed to save assignments:', err);
      const errorMessage = err.response?.data?.message || '배정 저장에 실패했습니다.';
      alert(`배정 저장 실패: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  // 품목의 현재 배정된 진행자 가져오기
  const getAssignedOperator = (item) => {
    if (item.operatorAssignments && item.operatorAssignments.length > 0) {
      return item.operatorAssignments[0];
    }
    return null;
  };

  // 날짜 포맷팅
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('ko-KR');
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      <CssBaseline />

      {/* 헤더 (상단 고정) */}
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, bgcolor: '#2c387e' }}>
        <Toolbar>
          {/* 왼쪽: 아이콘 및 타이틀 */}
          <AssignmentIcon sx={{ mr: 2 }} />
          <Typography
            variant="h6"
            color="inherit"
            noWrap
            component="div"
            sx={{ flexGrow: 1, fontWeight: 'bold', cursor: 'pointer' }}
            onClick={() => navigate('/admin')}
          >
            Campaign Manager
          </Typography>

          {/* 사용자 등록 버튼 */}
          <Button
            variant="contained"
            color="success"
            startIcon={<PersonAddIcon />}
            onClick={() => setUserDialogOpen(true)}
            sx={{ mr: 2, fontWeight: 'bold' }}
          >
            사용자 등록
          </Button>

          {/* 새로고침 버튼 */}
          <Button
            variant="outlined"
            color="inherit"
            startIcon={<RefreshIcon />}
            onClick={loadData}
            sx={{ mr: 2 }}
          >
            새로고침
          </Button>

          {/* 우측 상단 저장 버튼 (핵심 기능) */}
          <Button
            variant="contained"
            color="error"
            startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
            onClick={handleSaveAssignments}
            disabled={saving || Object.keys(pendingAssignments).length === 0}
            sx={{ mr: 2, fontWeight: 'bold' }}
          >
            배정 내용 저장
          </Button>

          {/* 오른쪽: 알림 아이콘 */}
          <IconButton color="inherit">
            <NotificationsIcon />
          </IconButton>

          {/* 오른쪽: 프로필 정보 박스 (클릭 시 프로필 수정) */}
          <Box
            onClick={() => setProfileDialogOpen(true)}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1, ml: 2, mr: 2,
              bgcolor: 'rgba(255,255,255,0.1)', px: 1.5, py: 0.5, borderRadius: 2,
              cursor: 'pointer',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' }
            }}
          >
            <Avatar sx={{ width: 32, height: 32, bgcolor: '#1976d2' }}>
              {user?.username?.charAt(0)?.toUpperCase() || 'A'}
            </Avatar>
            <Typography variant="subtitle2">{user?.name || '관리자'}</Typography>
          </Box>

          {/* 오른쪽: 로그아웃 버튼 */}
          <Button color="inherit" onClick={handleLogout} sx={{ fontWeight: 'bold' }}>
            로그아웃
          </Button>
        </Toolbar>
      </AppBar>

      {/* AppBar 높이만큼 콘텐츠 밀어주기 */}
      <Toolbar />

      {/* 메인 컨텐츠 영역 */}
      <Container maxWidth={false} sx={{ mt: 4, mb: 4, px: 3 }}>

        {/* 타이틀 영역 */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" fontWeight="bold" color="text.primary" gutterBottom>
            등록된 품목 및 진행자 배정
          </Typography>
          <Typography variant="body2" color="text.secondary">
            영업사가 등록한 품목을 확인하고, 담당 진행자를 지정해주세요. 배정 후 반드시 우측 상단의 '저장' 버튼을 눌러야 합니다.
            {Object.keys(pendingAssignments).length > 0 && (
              <Chip
                label={`${Object.keys(pendingAssignments).length}건 변경 중`}
                color="warning"
                size="small"
                sx={{ ml: 2 }}
              />
            )}
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        )}

        {/* 데이터 테이블 카드 */}
        <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 3, boxShadow: 3 }}>
            <TableContainer sx={{ maxHeight: 'calc(100vh - 250px)' }}>
              <Table stickyHeader aria-label="sticky table">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f8f9fa' }}>날짜</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f8f9fa' }}>영업사</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f8f9fa' }}>캠페인 (브랜드)</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f8f9fa' }}>품목명</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', bgcolor: '#e3f2fd', width: '220px' }}>
                      진행자 배정 (필수)
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#f8f9fa' }}>상태</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.length > 0 ? (
                    items.map((item) => {
                      const assignedOperator = getAssignedOperator(item);
                      const pendingOperatorId = pendingAssignments[item.id];
                      const isAssigned = !!assignedOperator;
                      const hasPendingChange = pendingOperatorId !== undefined;

                      return (
                        <TableRow hover role="checkbox" tabIndex={-1} key={item.id} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                          <TableCell>{formatDate(item.created_at)}</TableCell>
                          <TableCell>{item.campaign?.creator?.name || '-'}</TableCell>
                          <TableCell>
                            <Typography variant="subtitle2" fontWeight="bold">
                              {item.campaign?.name || '-'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {item.campaign?.brand?.name || '-'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="subtitle2">{item.product_name}</Typography>
                            {item.keyword && (
                              <Typography variant="caption" color="text.secondary">
                                키워드: {item.keyword}
                              </Typography>
                            )}
                          </TableCell>
                          {/* 핵심 기능: 진행자 선택 드롭다운 */}
                          <TableCell sx={{ bgcolor: (isAssigned || hasPendingChange) ? '#f1f8e9' : 'inherit' }}>
                            {isAssigned && !hasPendingChange ? (
                              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                배정 완료 ({assignedOperator.operator?.name})
                              </Typography>
                            ) : (
                              <FormControl fullWidth size="small">
                                <InputLabel id={`select-operator-label-${item.id}`}>선택하세요</InputLabel>
                                <Select
                                  labelId={`select-operator-label-${item.id}`}
                                  value={pendingOperatorId || ''}
                                  label="선택하세요"
                                  onChange={(e) => handleOperatorChange(item.id, e.target.value)}
                                  sx={{ bgcolor: 'white' }}
                                >
                                  <MenuItem value="">
                                    <em>선택 안 함</em>
                                  </MenuItem>
                                  {operators.map((op) => (
                                    <MenuItem key={op.id} value={op.id}>{op.name}</MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            )}
                          </TableCell>
                          <TableCell align="center">
                            {hasPendingChange ? (
                              <Chip label="배정 중" color="warning" size="small" />
                            ) : isAssigned ? (
                              <Chip label="배정 완료" color="success" size="small" />
                            ) : (
                              <Chip label="미배정" color="default" size="small" variant="outlined" />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 5, color: '#999' }}>
                        등록된 품목이 없습니다. 영업사가 캠페인에서 품목을 등록하면 여기에 표시됩니다.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
        </Paper>
      </Container>

      {/* 사용자 등록 다이얼로그 */}
      <AdminUserCreate
        open={userDialogOpen}
        onClose={() => setUserDialogOpen(false)}
        onSuccess={() => {
          // 필요시 사용자 목록 새로고침 등
        }}
      />

      {/* 프로필 수정 다이얼로그 */}
      <ProfileEditDialog
        open={profileDialogOpen}
        onClose={() => setProfileDialogOpen(false)}
      />
    </Box>
  );
}

export default AdminDashboard;
