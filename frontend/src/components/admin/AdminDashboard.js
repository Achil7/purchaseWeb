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
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
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
  // { itemId: { operatorId, isReassign: boolean } }
  const [pendingAssignments, setPendingAssignments] = useState({});

  // [상태] 재배정 모드 (배정 완료된 품목 수정 활성화)
  const [reassignMode, setReassignMode] = useState({});

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
      setReassignMode({});
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
  const handleOperatorChange = (itemId, newOperatorId, isReassign = false) => {
    setPendingAssignments(prev => ({
      ...prev,
      [itemId]: { operatorId: newOperatorId, isReassign }
    }));
  };

  // [핸들러] 재배정 모드 활성화 (경고 후)
  const handleEnableReassign = (itemId, currentOperatorName) => {
    const confirmed = window.confirm(
      `⚠️ 진행자 재배정 경고\n\n` +
      `현재 배정된 진행자: ${currentOperatorName}\n\n` +
      `진행자를 변경하면 해당 품목의 배정 정보가 변경됩니다.\n` +
      `정말 진행자를 재배정하시겠습니까?`
    );

    if (confirmed) {
      setReassignMode(prev => ({
        ...prev,
        [itemId]: true
      }));
    }
  };

  // [핸들러] 저장 버튼 클릭 시 - 실제 API 호출
  const handleSaveAssignments = async () => {
    const assignmentsToSave = Object.entries(pendingAssignments).filter(
      ([_, data]) => data.operatorId
    );

    if (assignmentsToSave.length === 0) {
      alert("배정된 내역이 없습니다.");
      return;
    }

    // 재배정이 포함된 경우 최종 확인
    const hasReassignments = assignmentsToSave.some(([_, data]) => data.isReassign);
    if (hasReassignments) {
      const confirmed = window.confirm(
        `⚠️ 재배정 포함 알림\n\n` +
        `${assignmentsToSave.filter(([_, d]) => d.isReassign).length}건의 재배정이 포함되어 있습니다.\n` +
        `기존 진행자의 배정이 해제되고 새 진행자로 변경됩니다.\n\n` +
        `계속하시겠습니까?`
      );
      if (!confirmed) return;
    }

    try {
      setSaving(true);

      // 각 배정을 순차적으로 처리 (신규 배정 vs 재배정 분기)
      for (const [itemId, data] of assignmentsToSave) {
        if (data.isReassign) {
          // 재배정 API 호출
          await itemService.reassignOperator(parseInt(itemId), parseInt(data.operatorId));
        } else {
          // 신규 배정 API 호출
          await itemService.assignOperator(parseInt(itemId), parseInt(data.operatorId));
        }
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
        <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="h5" fontWeight="bold" color="text.primary" gutterBottom>
              등록된 품목 및 진행자 배정
            </Typography>
            <Typography variant="body2" color="text.secondary">
              영업사가 등록한 품목을 확인하고, 담당 진행자를 지정해주세요.
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
          {/* 배정 저장 버튼 */}
          <Button
            variant="contained"
            color="error"
            startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
            onClick={handleSaveAssignments}
            disabled={saving || Object.keys(pendingAssignments).length === 0}
            sx={{ fontWeight: 'bold', px: 3, py: 1.5 }}
          >
            배정 내용 저장
          </Button>
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
                    <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#fff3e0' }}>입금관리</TableCell>
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
                            {isAssigned && !hasPendingChange && !reassignMode[item.id] ? (
                              // 배정 완료 상태 - 재배정 버튼 표시
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="body2" color="text.secondary">
                                  {assignedOperator.operator?.name}
                                </Typography>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="warning"
                                  onClick={() => handleEnableReassign(item.id, assignedOperator.operator?.name)}
                                  sx={{ minWidth: 'auto', px: 1, py: 0.5, fontSize: '0.75rem' }}
                                >
                                  변경
                                </Button>
                              </Box>
                            ) : (
                              // 미배정 또는 재배정 모드 - 드롭다운 표시
                              <FormControl fullWidth size="small">
                                <InputLabel id={`select-operator-label-${item.id}`}>
                                  {reassignMode[item.id] ? '새 진행자 선택' : '선택하세요'}
                                </InputLabel>
                                <Select
                                  labelId={`select-operator-label-${item.id}`}
                                  value={pendingOperatorId?.operatorId || ''}
                                  label={reassignMode[item.id] ? '새 진행자 선택' : '선택하세요'}
                                  onChange={(e) => handleOperatorChange(item.id, e.target.value, reassignMode[item.id] || false)}
                                  sx={{ bgcolor: reassignMode[item.id] ? '#fff3e0' : 'white' }}
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
                          {/* 입금관리 버튼 - 배정 완료된 품목만 활성화 */}
                          <TableCell align="center">
                            {isAssigned && !hasPendingChange ? (
                              <Button
                                variant="contained"
                                size="small"
                                color="warning"
                                startIcon={<OpenInNewIcon />}
                                onClick={() => navigate(`/admin/campaigns/${item.campaign?.id}/item/${item.id}`)}
                                sx={{ fontWeight: 'bold' }}
                              >
                                입금관리
                              </Button>
                            ) : (
                              <Typography variant="caption" color="text.disabled">-</Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 5, color: '#999' }}>
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
