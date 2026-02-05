import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  CircularProgress, Alert, Button, IconButton, Grid,
  FormControl, InputLabel, Select, MenuItem, Chip, TableContainer, Link, Breadcrumbs,
  Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import InfoIcon from '@mui/icons-material/Info';
import CloseIcon from '@mui/icons-material/Close';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import WarningIcon from '@mui/icons-material/Warning';
import { useNavigate, useParams } from 'react-router-dom';
import { getUsers } from '../../services/userService';
import { itemService, campaignService, itemSlotService } from '../../services';

function AdminCampaignAssignment() {
  const navigate = useNavigate();
  const { campaignId } = useParams();

  const [campaign, setCampaign] = useState(null);
  const [items, setItems] = useState([]);
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pendingAssignments, setPendingAssignments] = useState({});
  const [reassignMode, setReassignMode] = useState({});
  const [saving, setSaving] = useState(false);

  // 제품 상세 다이얼로그 상태
  const [itemDetailDialogOpen, setItemDetailDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  // 일괄 배정 다이얼로그 상태
  const [bulkAssignDialogOpen, setBulkAssignDialogOpen] = useState(false);
  const [bulkOperatorId, setBulkOperatorId] = useState('');

  // 데이터 로드
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [campaignResponse, itemsResponse, operatorsResponse] = await Promise.all([
        campaignService.getCampaign(campaignId),
        itemService.getItemsByCampaign(campaignId),
        getUsers('operator')
      ]);

      setCampaign(campaignResponse.data);
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
  }, [campaignId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // key 생성
  const getAssignmentKey = (itemId, dayGroup) => `${itemId}_${dayGroup}`;

  // 진행자 변경 핸들러
  const handleOperatorChange = (itemId, dayGroup, newOperatorId, isReassign = false) => {
    const key = getAssignmentKey(itemId, dayGroup);
    setPendingAssignments(prev => ({
      ...prev,
      [key]: { operatorId: newOperatorId, isReassign, itemId, dayGroup }
    }));
  };

  // 재배정 모드 활성화
  const handleEnableReassign = (itemId, dayGroup, currentOperatorName) => {
    const confirmed = window.confirm(
      `⚠️ 진행자 재배정 경고\n\n` +
      `현재 배정된 진행자: ${currentOperatorName}\n` +
      `일자 그룹: ${dayGroup}일차\n\n` +
      `진행자를 변경하면 해당 일자 그룹의 배정 정보가 변경됩니다.\n` +
      `정말 진행자를 재배정하시겠습니까?`
    );

    if (confirmed) {
      const key = getAssignmentKey(itemId, dayGroup);
      setReassignMode(prev => ({ ...prev, [key]: true }));
    }
  };

  // 특정 day_group에 배정된 진행자 찾기
  const getAssignedOperatorForDayGroup = (item, dayGroup) => {
    if (item.operatorAssignments && item.operatorAssignments.length > 0) {
      return item.operatorAssignments.find(a => a.day_group === dayGroup);
    }
    return null;
  };

  // 특정 day_group이 중단 상태인지 확인
  const isDayGroupSuspended = (item, dayGroup) => {
    if (item.dayGroupSuspended && item.dayGroupSuspended[dayGroup] !== undefined) {
      return item.dayGroupSuspended[dayGroup];
    }
    return false;
  };

  // day_group 중단 핸들러
  const handleSuspendDayGroup = async (itemId, dayGroup, itemName) => {
    const confirmed = window.confirm(
      `⚠️ day_group 중단 경고\n\n` +
      `제품명: ${itemName}\n` +
      `일자 그룹: ${dayGroup}일차\n\n` +
      `중단하면:\n` +
      `- 배정된 진행자가 해제됩니다\n` +
      `- 배정 미완료 카운트에서 제외됩니다\n` +
      `- 진행자에게 더 이상 표시되지 않습니다\n\n` +
      `정말 중단하시겠습니까?`
    );

    if (!confirmed) return;

    try {
      await itemSlotService.suspendDayGroup(itemId, dayGroup);
      alert(`${itemName}의 ${dayGroup}일차가 중단되었습니다.`);
      await loadData();
    } catch (err) {
      console.error('Failed to suspend day group:', err);
      alert('중단 처리에 실패했습니다: ' + (err.response?.data?.message || err.message));
    }
  };

  // day_group 재개 핸들러
  const handleResumeDayGroup = async (itemId, dayGroup, itemName) => {
    const confirmed = window.confirm(
      `day_group 재개\n\n` +
      `제품명: ${itemName}\n` +
      `일자 그룹: ${dayGroup}일차\n\n` +
      `재개하면 다시 배정 대상이 됩니다.\n` +
      `(진행자는 수동으로 다시 배정해야 합니다)\n\n` +
      `재개하시겠습니까?`
    );

    if (!confirmed) return;

    try {
      await itemSlotService.resumeDayGroup(itemId, dayGroup);
      alert(`${itemName}의 ${dayGroup}일차가 재개되었습니다. 진행자를 다시 배정해주세요.`);
      await loadData();
    } catch (err) {
      console.error('Failed to resume day group:', err);
      alert('재개 처리에 실패했습니다: ' + (err.response?.data?.message || err.message));
    }
  };


  // 저장 핸들러
  const handleSaveAssignments = async () => {
    if (Object.keys(pendingAssignments).length === 0) {
      alert('변경된 배정 내용이 없습니다.');
      return;
    }

    try {
      setSaving(true);

      for (const [, data] of Object.entries(pendingAssignments)) {
        const { operatorId, isReassign, itemId, dayGroup } = data;

        if (operatorId) {
          if (isReassign) {
            await itemService.reassignOperator(itemId, operatorId, dayGroup);
          } else {
            await itemService.assignOperator(itemId, operatorId, dayGroup);
          }
        }
      }

      alert('진행자 배정이 완료되었습니다.');
      await loadData();
    } catch (err) {
      console.error('Failed to save assignments:', err);
      alert('진행자 배정 저장에 실패했습니다: ' + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  // 행 데이터 생성
  const getAssignmentRows = () => {
    const rows = [];
    for (const item of items) {
      const dayGroups = item.dayGroups && item.dayGroups.length > 0 ? item.dayGroups : [1];
      for (const dayGroup of dayGroups) {
        rows.push({
          item,
          dayGroup,
          totalDayGroups: dayGroups.length
        });
      }
    }
    return rows;
  };

  const assignmentRows = getAssignmentRows();

  // 미배정 항목 목록 가져오기 (중단된 항목 제외)
  const getUnassignedRows = () => {
    return assignmentRows.filter(({ item, dayGroup }) => {
      const key = getAssignmentKey(item.id, dayGroup);
      const assignedOperator = getAssignedOperatorForDayGroup(item, dayGroup);
      const hasPendingChange = pendingAssignments[key] !== undefined;
      const isSuspended = isDayGroupSuspended(item, dayGroup);
      // 중단된 항목은 미배정으로 카운트하지 않음
      return !assignedOperator && !hasPendingChange && !isSuspended;
    });
  };

  const unassignedCount = getUnassignedRows().length;

  // 중단된 항목 수
  const suspendedCount = assignmentRows.filter(({ item, dayGroup }) =>
    isDayGroupSuspended(item, dayGroup)
  ).length;

  // 일괄 배정 핸들러
  const handleBulkAssign = () => {
    if (!bulkOperatorId) {
      alert('진행자를 선택해주세요.');
      return;
    }

    const unassignedRows = getUnassignedRows();
    if (unassignedRows.length === 0) {
      alert('미배정 항목이 없습니다.');
      return;
    }

    const newAssignments = {};
    unassignedRows.forEach(({ item, dayGroup }) => {
      const key = getAssignmentKey(item.id, dayGroup);
      newAssignments[key] = { operatorId: bulkOperatorId, isReassign: false, itemId: item.id, dayGroup };
    });

    setPendingAssignments(prev => ({
      ...prev,
      ...newAssignments
    }));

    setBulkAssignDialogOpen(false);
    setBulkOperatorId('');
    alert(`${unassignedRows.length}개 항목에 진행자가 일괄 배정되었습니다. 저장 버튼을 눌러주세요.`);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* 브레드크럼 네비게이션 */}
      <Box sx={{ mb: 2 }}>
        <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />}>
          <Link
            component="button"
            variant="body2"
            onClick={() => navigate('/admin/control-tower')}
            sx={{ textDecoration: 'none', cursor: 'pointer' }}
          >
            컨트롤 타워
          </Link>
          {campaign?.monthlyBrand?.name && (
            <Typography color="text.secondary">
              {campaign.monthlyBrand.name}
            </Typography>
          )}
          <Typography color="text.primary">
            {campaign?.name || '캠페인'}
          </Typography>
        </Breadcrumbs>
      </Box>

      {/* 타이틀 영역 */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <Button
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate('/admin/control-tower')}
              size="small"
            >
              목록으로
            </Button>
            {campaign?.monthlyBrand?.name && (
              <Chip label={campaign.monthlyBrand.name} size="small" color="secondary" variant="filled" />
            )}
            <Typography variant="h5" fontWeight="bold">
              {campaign?.name}
            </Typography>
            {campaign?.brand?.name && (
              <Chip label={campaign.brand.name} size="small" color="primary" variant="outlined" />
            )}
          </Box>
          <Typography variant="body2" color="text.secondary">
            영업사: {campaign?.creator?.name || '-'} |
            제품 {items.length}개
            {suspendedCount > 0 && (
              <Chip
                label={`${suspendedCount}건 중단됨`}
                color="error"
                size="small"
                sx={{ ml: 1 }}
              />
            )}
            {Object.keys(pendingAssignments).length > 0 && (
              <Chip
                label={`${Object.keys(pendingAssignments).length}건 변경 중`}
                color="warning"
                size="small"
                sx={{ ml: 1 }}
              />
            )}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadData}
            disabled={loading}
          >
            새로고침
          </Button>
          <Button
            variant="contained"
            color="info"
            startIcon={<GroupAddIcon />}
            onClick={() => setBulkAssignDialogOpen(true)}
            disabled={unassignedCount === 0}
            sx={{ fontWeight: 'bold' }}
          >
            일괄 배정 ({unassignedCount}건)
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
            onClick={handleSaveAssignments}
            disabled={saving || Object.keys(pendingAssignments).length === 0}
            sx={{ fontWeight: 'bold', px: 3 }}
          >
            배정 내용 저장
          </Button>
        </Box>
      </Box>

      {/* 테이블 */}
      <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 2 }}>
        <TableContainer sx={{ maxHeight: 'calc(100vh - 280px)' }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f8f9fa' }}>제품명</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#e8f5e9', width: '100px' }}>날짜</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#e8f5e9', width: '70px' }}>건수</TableCell>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: '#e3f2fd', width: '220px' }}>
                  진행자 배정 (필수)
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#f8f9fa', width: '100px' }}>상태</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: '#fff3e0', width: '80px' }}>중단</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {assignmentRows.length > 0 ? (
                assignmentRows.map(({ item, dayGroup, totalDayGroups }, index) => {
                  const key = getAssignmentKey(item.id, dayGroup);
                  const assignedOperator = getAssignedOperatorForDayGroup(item, dayGroup);
                  const pendingData = pendingAssignments[key];
                  const isAssigned = !!assignedOperator;
                  const hasPendingChange = pendingData !== undefined;
                  const isInReassignMode = reassignMode[key];
                  const isSuspended = isDayGroupSuspended(item, dayGroup);

                  // 같은 품목의 첫 번째 행인지 확인
                  const isFirstRowOfItem = index === 0 || assignmentRows[index - 1].item.id !== item.id;
                  const itemRowCount = totalDayGroups;

                  return (
                    <TableRow
                      hover
                      key={`${item.id}_${dayGroup}`}
                      sx={{
                        borderTop: isFirstRowOfItem && index > 0 ? '2px solid #333' : 'none',
                        bgcolor: isSuspended ? '#ffebee' : 'inherit',
                        opacity: isSuspended ? 0.8 : 1
                      }}
                    >
                      {isFirstRowOfItem && (
                        <TableCell rowSpan={itemRowCount} sx={{ verticalAlign: 'top', borderRight: '1px solid #e0e0e0' }}>
                          <Typography
                            variant="body2"
                            fontWeight="bold"
                            sx={{
                              cursor: 'pointer',
                              color: '#1976d2',
                              '&:hover': { textDecoration: 'underline' }
                            }}
                            onClick={() => {
                              setSelectedItem(item);
                              setItemDetailDialogOpen(true);
                            }}
                          >
                            {item.product_name}
                          </Typography>
                          {item.keyword && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              키워드: {item.keyword}
                            </Typography>
                          )}
                          {totalDayGroups > 1 && (
                            <Chip
                              label={`${totalDayGroups}개 그룹`}
                              size="small"
                              color="info"
                              variant="outlined"
                              sx={{ mt: 0.5, fontSize: '0.65rem', height: 20 }}
                            />
                          )}
                        </TableCell>
                      )}
                      <TableCell align="center" sx={{ bgcolor: '#f5f5f5' }}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.8rem', color: '#2e7d32' }}>
                          {item.dayGroupDates?.[dayGroup] || ''}
                        </Typography>
                      </TableCell>
                      <TableCell align="center" sx={{ bgcolor: '#f5f5f5' }}>
                        {(() => {
                          // daily_purchase_count가 "10/10/5" 형식이면 각 일차별 건수 표시
                          const dailyCount = item.daily_purchase_count;
                          if (dailyCount && typeof dailyCount === 'string' && dailyCount.includes('/')) {
                            const counts = dailyCount.split('/');
                            const countForDay = counts[dayGroup - 1];
                            return (
                              <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#1565c0' }}>
                                {countForDay || '-'}건
                              </Typography>
                            );
                          } else if (dailyCount) {
                            // 단일 숫자인 경우
                            return (
                              <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#1565c0' }}>
                                {dailyCount}건
                              </Typography>
                            );
                          }
                          return <Typography variant="body2" color="text.secondary">-</Typography>;
                        })()}
                      </TableCell>
                      <TableCell sx={{ bgcolor: (isAssigned || hasPendingChange) ? '#f1f8e9' : 'inherit' }}>
                        {isAssigned && !hasPendingChange && !isInReassignMode ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                              {assignedOperator.operator?.name}
                            </Typography>
                            <Button
                              size="small"
                              variant="outlined"
                              color="warning"
                              onClick={() => handleEnableReassign(item.id, dayGroup, assignedOperator.operator?.name)}
                              sx={{ minWidth: 'auto', px: 1, py: 0.5, fontSize: '0.7rem' }}
                            >
                              변경
                            </Button>
                          </Box>
                        ) : (
                          <FormControl fullWidth size="small">
                            <InputLabel id={`select-operator-label-${key}`}>
                              {isInReassignMode ? '새 진행자 선택' : '선택하세요'}
                            </InputLabel>
                            <Select
                              labelId={`select-operator-label-${key}`}
                              value={pendingData?.operatorId || ''}
                              label={isInReassignMode ? '새 진행자 선택' : '선택하세요'}
                              onChange={(e) => handleOperatorChange(item.id, dayGroup, e.target.value, isInReassignMode || false)}
                              sx={{ bgcolor: isInReassignMode ? '#fff3e0' : 'white' }}
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
                        {isSuspended ? (
                          <Chip
                            label="중단됨"
                            color="error"
                            size="small"
                            icon={<WarningIcon sx={{ fontSize: '1rem' }} />}
                          />
                        ) : hasPendingChange ? (
                          <Chip label="배정 중" color="warning" size="small" />
                        ) : isAssigned ? (
                          <Chip label="배정 완료" color="success" size="small" />
                        ) : (
                          <Chip label="미배정" color="default" size="small" variant="outlined" />
                        )}
                      </TableCell>
                      <TableCell align="center">
                        {isSuspended ? (
                          <IconButton
                            size="small"
                            color="success"
                            onClick={() => handleResumeDayGroup(item.id, dayGroup, item.product_name)}
                            title="재개"
                          >
                            <PlayCircleIcon />
                          </IconButton>
                        ) : (
                          <IconButton
                            size="small"
                            color="warning"
                            onClick={() => handleSuspendDayGroup(item.id, dayGroup, item.product_name)}
                            title="중단"
                          >
                            <PauseCircleIcon />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 5, color: '#999' }}>
                    등록된 제품이 없습니다. 영업사가 캠페인에서 제품을 등록하면 여기에 표시됩니다.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* 일괄 배정 다이얼로그 */}
      <Dialog open={bulkAssignDialogOpen} onClose={(event, reason) => { if (reason !== 'backdropClick') setBulkAssignDialogOpen(false); }} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <GroupAddIcon color="info" />
            진행자 일괄 배정
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            미배정된 {unassignedCount}개 항목에 동일한 진행자를 일괄 배정합니다.
          </Typography>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel id="bulk-operator-label">진행자 선택</InputLabel>
            <Select
              labelId="bulk-operator-label"
              value={bulkOperatorId}
              label="진행자 선택"
              onChange={(e) => setBulkOperatorId(e.target.value)}
            >
              <MenuItem value="">
                <em>선택하세요</em>
              </MenuItem>
              {operators.map((op) => (
                <MenuItem key={op.id} value={op.id}>{op.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkAssignDialogOpen(false)}>취소</Button>
          <Button
            variant="contained"
            color="info"
            onClick={handleBulkAssign}
            disabled={!bulkOperatorId}
          >
            일괄 배정
          </Button>
        </DialogActions>
      </Dialog>

      {/* 제품 상세 다이얼로그 */}
      <Dialog
        open={itemDetailDialogOpen}
        onClose={() => {
          setItemDetailDialogOpen(false);
          setSelectedItem(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: '#1976d2', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <InfoIcon />
            <Typography variant="h6" fontWeight="bold">제품 상세 정보</Typography>
          </Box>
          <IconButton
            size="small"
            onClick={() => {
              setItemDetailDialogOpen(false);
              setSelectedItem(null);
            }}
            sx={{ color: 'white' }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 3, bgcolor: '#fafafa' }}>
          {selectedItem && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              {/* 기본 정보 카드 */}
              <Paper elevation={0} sx={{ p: 2.5, border: '1px solid #e0e0e0', borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ color: '#1976d2', fontWeight: 'bold', mb: 2, pb: 1, borderBottom: '2px solid #1976d2' }}>
                  기본 정보
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                      <Typography sx={{ color: '#666', minWidth: 100, fontWeight: 500 }}>제품명</Typography>
                      <Typography sx={{ fontWeight: 'bold', color: '#1565c0', fontSize: '1.1rem' }}>
                        {selectedItem.product_name || '-'}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography sx={{ color: '#666', minWidth: 100, fontWeight: 500 }}>플랫폼</Typography>
                      <Chip label={selectedItem.platform || '-'} size="small" color="primary" variant="outlined" />
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography sx={{ color: '#666', minWidth: 100, fontWeight: 500 }}>출고 유형</Typography>
                      <Chip
                        label={selectedItem.shipping_type || '-'}
                        size="small"
                        color={selectedItem.shipping_type === '실출고' ? 'success' : 'default'}
                        variant="outlined"
                      />
                    </Box>
                  </Grid>
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                      <Typography sx={{ color: '#666', minWidth: 100, fontWeight: 500 }}>상품 URL</Typography>
                      {selectedItem.product_url ? (
                        <Link
                          href={selectedItem.product_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{ wordBreak: 'break-all', fontSize: '0.875rem' }}
                        >
                          {selectedItem.product_url}
                        </Link>
                      ) : (
                        <Typography>-</Typography>
                      )}
                    </Box>
                  </Grid>
                </Grid>
              </Paper>

              {/* 구매 정보 카드 */}
              <Paper elevation={0} sx={{ p: 2.5, border: '1px solid #e0e0e0', borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ color: '#2e7d32', fontWeight: 'bold', mb: 2, pb: 1, borderBottom: '2px solid #2e7d32' }}>
                  구매 정보
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6} sm={4}>
                    <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: '#e3f2fd', borderRadius: 1 }}>
                      <Typography variant="caption" sx={{ color: '#666' }}>총 구매 건수</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1976d2' }}>
                        {selectedItem.total_purchase_count || '-'}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} sm={4}>
                    <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: '#e8f5e9', borderRadius: 1 }}>
                      <Typography variant="caption" sx={{ color: '#666' }}>일 구매 건수</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#2e7d32' }}>
                        {selectedItem.daily_purchase_count || '-'}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: '#fff3e0', borderRadius: 1 }}>
                      <Typography variant="caption" sx={{ color: '#666' }}>제품 가격</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#e65100' }}>
                        {selectedItem.product_price ? `${Number(String(selectedItem.product_price).replace(/,/g, '')).toLocaleString()}원` : '-'}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography sx={{ color: '#666', minWidth: 100, fontWeight: 500 }}>구매 옵션</Typography>
                      <Typography>{selectedItem.purchase_option || '-'}</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography sx={{ color: '#666', minWidth: 100, fontWeight: 500 }}>희망 키워드</Typography>
                      <Typography sx={{ color: '#1565c0', fontWeight: 500 }}>{selectedItem.keyword || '-'}</Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Paper>

              {/* 배송 정보 카드 */}
              <Paper elevation={0} sx={{ p: 2.5, border: '1px solid #e0e0e0', borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ color: '#ed6c02', fontWeight: 'bold', mb: 2, pb: 1, borderBottom: '2px solid #ed6c02' }}>
                  배송 정보
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography sx={{ color: '#666', minWidth: 120, fontWeight: 500 }}>출고 마감 시간</Typography>
                      <Typography sx={{ fontWeight: 500 }}>{selectedItem.shipping_deadline || '-'}</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography sx={{ color: '#666', minWidth: 120, fontWeight: 500 }}>택배대행 Y/N</Typography>
                      <Chip
                        label={selectedItem.courier_service_yn || '-'}
                        size="small"
                        color={selectedItem.courier_service_yn === 'Y' ? 'success' : 'default'}
                      />
                    </Box>
                  </Grid>
                </Grid>
              </Paper>

              {/* 리뷰 가이드 & 특이사항 카드 */}
              <Paper elevation={0} sx={{ p: 2.5, border: '1px solid #e0e0e0', borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ color: '#7b1fa2', fontWeight: 'bold', mb: 2, pb: 1, borderBottom: '2px solid #7b1fa2' }}>
                  추가 정보
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Typography sx={{ color: '#666', fontWeight: 500, mb: 0.5 }}>리뷰 가이드</Typography>
                    <Box sx={{ bgcolor: '#f5f5f5', p: 1.5, borderRadius: 1, minHeight: 60 }}>
                      <Typography sx={{ whiteSpace: 'pre-wrap', fontSize: '0.875rem', lineHeight: 1.6 }}>
                        {selectedItem.review_guide || '-'}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography sx={{ color: '#666', fontWeight: 500, mb: 0.5 }}>특이사항</Typography>
                    <Box sx={{ bgcolor: '#fff8e1', p: 1.5, borderRadius: 1, minHeight: 60 }}>
                      <Typography sx={{ whiteSpace: 'pre-wrap', fontSize: '0.875rem', lineHeight: 1.6 }}>
                        {selectedItem.notes || '-'}
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Paper>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, bgcolor: '#fafafa', borderTop: '1px solid #e0e0e0' }}>
          <Button
            variant="contained"
            onClick={() => {
              setItemDetailDialogOpen(false);
              setSelectedItem(null);
            }}
          >
            닫기
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default AdminCampaignAssignment;
