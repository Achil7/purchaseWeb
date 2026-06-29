import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Stack, Chip, Alert, CircularProgress, Button, IconButton, Tooltip, TextField,
  Select, MenuItem, Accordion, AccordionSummary, AccordionDetails, Link, Divider, Snackbar
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RefreshIcon from '@mui/icons-material/Refresh';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import LinkIcon from '@mui/icons-material/Link';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { bloggerService } from '../../services';
import {
  REQUEST_STATUS, PARTICIPATION_STATUS, PRODUCT_PROVISION,
  requestStatusLabel, requestStatusColor
} from '../../utils/bloggerLabels';

const STATUS_FILTERS = ['', 'requested', 'reviewing', 'in_progress', 'completed', 'cancelled'];

function AdminBloggerRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await bloggerService.getAllRequests(statusFilter || null);
      if (res.success) setRequests(res.data || []);
      else setError(res.message || '요청 목록을 불러오지 못했습니다');
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  // 로컬 상태에서 요청 필드 수정
  const patchRequest = (reqId, patch) => {
    setRequests(prev => prev.map(r => r.id === reqId ? { ...r, ...patch } : r));
  };
  const patchItem = (reqId, itemId, patch) => {
    setRequests(prev => prev.map(r => {
      if (r.id !== reqId) return r;
      return { ...r, items: (r.items || []).map(it => it.id === itemId ? { ...it, ...patch } : it) };
    }));
  };

  const saveRequest = async (r) => {
    try {
      const res = await bloggerService.updateRequest(r.id, {
        status: r.status,
        guide_text: r.guide_text,
        admin_memo: r.admin_memo,
        product_provision: r.product_provision
      });
      if (res.success) setToast('요청 정보를 저장했습니다');
      else setError(res.message);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  };

  const saveItem = async (reqId, it) => {
    try {
      const res = await bloggerService.updateRequestItem(it.id, {
        participation_status: it.participation_status,
        unit_price: it.unit_price,
        product_provision: it.product_provision,
        shipping_address: it.shipping_address,
        admin_memo: it.admin_memo
      });
      if (res.success) setToast('항목을 저장했습니다');
      else setError(res.message);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  };

  const issueAndCopy = async (reqId, it) => {
    try {
      let token = it.submit_token;
      if (!token) {
        const res = await bloggerService.issueToken(it.id);
        if (!res.success) { setError(res.message); return; }
        token = res.data.submit_token;
        patchItem(reqId, it.id, { submit_token: token });
      }
      const url = `${window.location.origin}/blogger-submit/${token}`;
      try { await navigator.clipboard.writeText(url); setToast('제출 링크를 복사했습니다'); }
      catch { setToast(url); }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2, flexWrap: 'wrap' }}>
        <Typography variant="h5" fontWeight="bold">블로거 협의 요청</Typography>
        <Chip label={`${requests.length}건`} size="small" />
        <Box sx={{ flexGrow: 1 }} />
        <Select size="small" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} sx={{ minWidth: 140 }} displayEmpty>
          <MenuItem value="">전체 상태</MenuItem>
          {STATUS_FILTERS.filter(Boolean).map(s => (
            <MenuItem key={s} value={s}>{requestStatusLabel(s)}</MenuItem>
          ))}
        </Select>
        <Tooltip title="새로고침"><IconButton onClick={load}><RefreshIcon /></IconButton></Tooltip>
      </Stack>

      <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
        브랜드사가 보낸 협의 요청입니다. 블로거별 참여의사/단가를 입력하고, 작성 링크(제출용 토큰)를 발급해 블로거에게 전달하세요.
      </Alert>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {loading && !requests.length ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : requests.length === 0 ? (
        <Paper sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
          <Typography>해당하는 협의 요청이 없습니다.</Typography>
        </Paper>
      ) : (
        <Stack spacing={1.5}>
          {requests.map((r) => {
            const accepted = (r.items || []).filter(it => it.participation_status === 'accepted').length;
            return (
              <Accordion key={r.id} defaultExpanded={r.status === 'requested'}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flexWrap: 'wrap', width: '100%' }}>
                    <Chip size="small" label={requestStatusLabel(r.status)} color={requestStatusColor(r.status)} />
                    <Typography variant="subtitle2">#{r.id} · {r.brand?.name || r.brand?.username || '브랜드'}</Typography>
                    {r.campaign?.name && <Chip size="small" variant="outlined" label={r.campaign.name} />}
                    <Typography variant="caption" color="text.secondary">{new Date(r.created_at).toLocaleString('ko-KR')}</Typography>
                    <Typography variant="caption" color="text.secondary">블로거 {r.items?.length || 0}명 · 참여 {accepted}명</Typography>
                  </Stack>
                </AccordionSummary>
                <AccordionDetails>
                  {/* 요청 헤더 편집 */}
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
                    <Box sx={{ minWidth: 160 }}>
                      <Typography variant="caption" color="text.secondary">상태</Typography>
                      <Select size="small" fullWidth value={r.status} onChange={(e) => patchRequest(r.id, { status: e.target.value })}>
                        {Object.keys(REQUEST_STATUS).map(s => (
                          <MenuItem key={s} value={s}>{REQUEST_STATUS[s].label}</MenuItem>
                        ))}
                      </Select>
                    </Box>
                    <TextField label="브랜드 가이드 (키워드/소구점)" size="small" fullWidth multiline minRows={2}
                      value={r.guide_text || ''} onChange={(e) => patchRequest(r.id, { guide_text: e.target.value })} />
                    <TextField label="CS 메모 (내부)" size="small" fullWidth multiline minRows={2}
                      value={r.admin_memo || ''} onChange={(e) => patchRequest(r.id, { admin_memo: e.target.value })} />
                  </Stack>
                  {r.brand_memo && (
                    <Alert severity="info" variant="outlined" sx={{ mb: 1 }}>브랜드 요청 메모: {r.brand_memo}</Alert>
                  )}
                  <Box sx={{ textAlign: 'right', mb: 1 }}>
                    <Button size="small" variant="outlined" onClick={() => saveRequest(r)}>요청 정보 저장</Button>
                  </Box>

                  <Divider sx={{ mb: 1 }} />

                  {/* 항목(블로거)별 CS */}
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#fafafa' }}>
                        <TableCell sx={{ fontWeight: 'bold' }}>활동명</TableCell>
                        <TableCell sx={{ width: 110, fontWeight: 'bold' }}>참여의사</TableCell>
                        <TableCell sx={{ width: 130, fontWeight: 'bold' }}>단가</TableCell>
                        <TableCell sx={{ width: 130, fontWeight: 'bold' }}>제품 제공</TableCell>
                        <TableCell sx={{ width: 150, fontWeight: 'bold' }}>작성 글</TableCell>
                        <TableCell sx={{ width: 180, fontWeight: 'bold' }} align="right">작업</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(r.items || []).map((it) => (
                        <TableRow key={it.id}>
                          <TableCell>
                            {it.blogger?.blog_url ? (
                              <Link href={it.blogger.blog_url} target="_blank" rel="noopener" underline="hover">
                                {it.blogger?.activity_name}
                              </Link>
                            ) : (it.blogger?.activity_name || '-')}
                          </TableCell>
                          <TableCell>
                            <Select size="small" fullWidth value={it.participation_status}
                              onChange={(e) => patchItem(r.id, it.id, { participation_status: e.target.value })}>
                              {Object.keys(PARTICIPATION_STATUS).map(s => (
                                <MenuItem key={s} value={s}>{PARTICIPATION_STATUS[s].label}</MenuItem>
                              ))}
                            </Select>
                          </TableCell>
                          <TableCell>
                            <TextField size="small" fullWidth placeholder="예: 50000"
                              value={it.unit_price || ''} onChange={(e) => patchItem(r.id, it.id, { unit_price: e.target.value })} />
                          </TableCell>
                          <TableCell>
                            <Select size="small" fullWidth value={it.product_provision || ''}
                              onChange={(e) => patchItem(r.id, it.id, { product_provision: e.target.value })} displayEmpty>
                              <MenuItem value="">(요청 기본)</MenuItem>
                              {Object.keys(PRODUCT_PROVISION).map(p => (
                                <MenuItem key={p} value={p}>{PRODUCT_PROVISION[p]}</MenuItem>
                              ))}
                            </Select>
                          </TableCell>
                          <TableCell>
                            {it.submission_url ? (
                              <Link href={it.submission_url} target="_blank" rel="noopener" underline="hover">
                                보기 <OpenInNewIcon sx={{ fontSize: 13, verticalAlign: 'middle' }} />
                              </Link>
                            ) : <Typography variant="caption" color="text.disabled">미제출</Typography>}
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip title={it.submit_token ? '제출 링크 복사' : '제출 링크 발급 + 복사'}>
                              <IconButton size="small" onClick={() => issueAndCopy(r.id, it)}>
                                {it.submit_token ? <ContentCopyIcon fontSize="small" /> : <LinkIcon fontSize="small" />}
                              </IconButton>
                            </Tooltip>
                            <Button size="small" variant="text" onClick={() => saveItem(r.id, it)}>저장</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </AccordionDetails>
              </Accordion>
            );
          })}
        </Stack>
      )}

      <Snackbar open={!!toast} autoHideDuration={2500} onClose={() => setToast('')} message={toast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
}

export default AdminBloggerRequests;
