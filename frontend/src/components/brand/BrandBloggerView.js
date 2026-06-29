import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Container, Typography, Paper, Table, TableHead, TableRow, TableCell,
  TableBody, Link, Alert, CircularProgress, Stack, TextField, InputAdornment, Chip,
  Checkbox, Button, ToggleButtonGroup, ToggleButton, Dialog, DialogTitle, DialogContent,
  DialogActions, RadioGroup, FormControlLabel, Radio, Divider, Select, MenuItem, InputLabel, FormControl
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import SendIcon from '@mui/icons-material/Send';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { bloggerService, monthlyBrandService } from '../../services';
import {
  requestStatusLabel, requestStatusColor,
  participationLabel, participationColor, provisionLabel
} from '../../utils/bloggerLabels';

function BrandBloggerView() {
  const viewAsUserId = new URLSearchParams(window.location.search).get('userId');

  const [mode, setMode] = useState('list'); // 'list' | 'requests'

  // 블로거 목록
  const [bloggers, setBloggers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]); // blogger id 배열

  // 요청 다이얼로그
  const [dialogOpen, setDialogOpen] = useState(false);
  const [provision, setProvision] = useState('sponsored');
  const [brandMemo, setBrandMemo] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [campaigns, setCampaigns] = useState([]); // [{ id, name, mbName }]
  const [submitting, setSubmitting] = useState(false);

  // 내 협의 요청
  const [requests, setRequests] = useState([]);
  const [reqLoading, setReqLoading] = useState(false);

  const loadBloggers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await bloggerService.list();
      if (res.success) setBloggers(res.data || []);
      else setError(res.message || '블로거 목록을 불러오지 못했습니다');
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRequests = useCallback(async () => {
    setReqLoading(true);
    try {
      const res = await bloggerService.getMyRequests(viewAsUserId);
      if (res.success) setRequests(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setReqLoading(false);
    }
  }, [viewAsUserId]);

  const loadCampaigns = useCallback(async () => {
    try {
      const res = await monthlyBrandService.getMyBrandMonthlyBrands(viewAsUserId);
      const mbs = res?.data || [];
      const flat = [];
      mbs.forEach(mb => (mb.campaigns || []).forEach(c => flat.push({ id: c.id, name: c.name, mbName: mb.name })));
      setCampaigns(flat);
    } catch (_) { /* 캠페인 로드 실패는 무시 (선택 항목) */ }
  }, [viewAsUserId]);

  useEffect(() => { loadBloggers(); loadCampaigns(); }, [loadBloggers, loadCampaigns]);
  useEffect(() => { if (mode === 'requests') loadRequests(); }, [mode, loadRequests]);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? bloggers.filter(b =>
        (b.activity_name || '').toLowerCase().includes(q) ||
        (b.main_content || '').toLowerCase().includes(q))
    : bloggers;

  const toggleOne = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const allFilteredSelected = filtered.length > 0 && filtered.every(b => selected.includes(b.id));
  const toggleAll = () => {
    if (allFilteredSelected) {
      setSelected(prev => prev.filter(id => !filtered.some(b => b.id === id)));
    } else {
      setSelected(prev => Array.from(new Set([...prev, ...filtered.map(b => b.id)])));
    }
  };

  const handleSubmitRequest = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        blogger_ids: selected,
        product_provision: provision,
        brand_memo: brandMemo || null,
        campaign_id: campaignId || null
      };
      if (viewAsUserId) payload.brand_id = parseInt(viewAsUserId, 10);
      const res = await bloggerService.createRequest(payload);
      if (res.success) {
        setDialogOpen(false);
        setSelected([]);
        setBrandMemo('');
        setProvision('sponsored');
        setCampaignId('');
        setMode('requests');
        loadRequests();
      } else {
        setError(res.message || '요청 생성에 실패했습니다');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (reqId) => {
    if (!window.confirm('이 협의 요청을 취소하시겠습니까?')) return;
    try {
      const res = await bloggerService.cancelRequest(reqId);
      if (res.success) loadRequests();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  };

  return (
    <Box sx={{ height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
      <Container maxWidth="xl" sx={{ pt: 2, pb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2, flexWrap: 'wrap' }}>
          <Typography variant="h5" fontWeight="bold">블로거 체험단</Typography>
          <ToggleButtonGroup size="small" value={mode} exclusive onChange={(_, v) => v && setMode(v)}>
            <ToggleButton value="list">블로거 목록</ToggleButton>
            <ToggleButton value="requests">내 협의 요청{requests.length > 0 ? ` (${requests.length})` : ''}</ToggleButton>
          </ToggleButtonGroup>
          <Box sx={{ flexGrow: 1 }} />
          {mode === 'list' && (
            <TextField
              size="small"
              placeholder="활동명 / 콘텐츠 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>) }}
              sx={{ width: 260 }}
            />
          )}
        </Stack>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

        {mode === 'list' ? (
          <>
            <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
              진행하고 싶은 블로거를 선택하고 <b>발행 협의 요청</b>을 보내주세요. 담당자가 블로거와 단가/참여를 협의한 뒤 회신드립니다.
            </Alert>

            {/* 선택 액션 바 */}
            {selected.length > 0 && (
              <Paper variant="outlined" sx={{ p: 1.5, mb: 1.5, display: 'flex', alignItems: 'center', gap: 2, bgcolor: '#fff8e1', borderColor: '#ffb300' }}>
                <Typography variant="body2" fontWeight="bold">{selected.length}명 선택됨</Typography>
                <Button size="small" onClick={() => setSelected([])}>선택 해제</Button>
                <Box sx={{ flexGrow: 1 }} />
                <Button variant="contained" startIcon={<SendIcon />} onClick={() => setDialogOpen(true)}>
                  발행 협의 요청
                </Button>
              </Paper>
            )}

            <Paper sx={{ position: 'relative' }}>
              {loading && !bloggers.length ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
              ) : filtered.length === 0 ? (
                <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
                  <Typography>{bloggers.length === 0 ? '아직 등록된 블로거가 없습니다.' : '검색 결과가 없습니다.'}</Typography>
                </Box>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                      <TableCell padding="checkbox">
                        <Checkbox size="small" checked={allFilteredSelected}
                          indeterminate={!allFilteredSelected && filtered.some(b => selected.includes(b.id))}
                          onChange={toggleAll} />
                      </TableCell>
                      <TableCell sx={{ width: 50, fontWeight: 'bold' }}>No.</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>활동명</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>블로그 주소</TableCell>
                      <TableCell sx={{ width: 140, fontWeight: 'bold' }}>평균 1일 방문자</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>주요 콘텐츠</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filtered.map((b, idx) => (
                      <TableRow key={b.id} hover selected={selected.includes(b.id)} onClick={() => toggleOne(b.id)} sx={{ cursor: 'pointer' }}>
                        <TableCell padding="checkbox">
                          <Checkbox size="small" checked={selected.includes(b.id)} onChange={() => toggleOne(b.id)} onClick={(e) => e.stopPropagation()} />
                        </TableCell>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell sx={{ fontWeight: 500 }}>{b.activity_name}</TableCell>
                        <TableCell sx={{ maxWidth: 300 }}>
                          {b.blog_url ? (
                            <Link href={b.blog_url} target="_blank" rel="noopener" underline="hover" onClick={(e) => e.stopPropagation()}
                              sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {b.blog_url}
                            </Link>
                          ) : '-'}
                        </TableCell>
                        <TableCell>{b.daily_visitors || '-'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'pre-wrap' }}>{b.main_content || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Paper>
          </>
        ) : (
          /* ===== 내 협의 요청 ===== */
          <Box>
            {reqLoading && !requests.length ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
            ) : requests.length === 0 ? (
              <Paper sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
                <Typography>아직 보낸 협의 요청이 없습니다. "블로거 목록"에서 블로거를 선택해 요청해 보세요.</Typography>
              </Paper>
            ) : (
              <Stack spacing={2}>
                {requests.map((r) => {
                  const accepted = (r.items || []).filter(it => it.participation_status === 'accepted').length;
                  return (
                    <Paper key={r.id} variant="outlined" sx={{ p: 2 }}>
                      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1, flexWrap: 'wrap' }}>
                        <Chip size="small" label={requestStatusLabel(r.status)} color={requestStatusColor(r.status)} />
                        <Typography variant="subtitle2">요청 #{r.id}</Typography>
                        {r.campaign?.name && <Chip size="small" variant="outlined" label={r.campaign.name} />}
                        <Typography variant="caption" color="text.secondary">
                          {new Date(r.created_at).toLocaleString('ko-KR')}
                        </Typography>
                        <Chip size="small" variant="outlined" label={`제품 제공: ${provisionLabel(r.product_provision)}`} />
                        <Typography variant="caption" color="text.secondary">
                          블로거 {r.items?.length || 0}명 · 참여 확정 {accepted}명
                        </Typography>
                        <Box sx={{ flexGrow: 1 }} />
                        {r.status !== 'cancelled' && r.status !== 'completed' && (
                          <Button size="small" color="error" onClick={() => handleCancel(r.id)}>요청 취소</Button>
                        )}
                      </Stack>
                      {r.brand_memo && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>요청 메모: {r.brand_memo}</Typography>
                      )}
                      <Divider sx={{ my: 1 }} />
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>활동명</TableCell>
                            <TableCell sx={{ width: 90, fontWeight: 'bold' }}>참여</TableCell>
                            <TableCell sx={{ width: 120, fontWeight: 'bold' }}>작성일자</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>작성 글</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(r.items || []).map((it) => (
                            <TableRow key={it.id}>
                              <TableCell>{it.blogger?.activity_name || '-'}</TableCell>
                              <TableCell>
                                <Chip size="small" label={participationLabel(it.participation_status)} color={participationColor(it.participation_status)} variant="outlined" />
                              </TableCell>
                              <TableCell>
                                {it.submitted_at ? new Date(it.submitted_at).toLocaleDateString('ko-KR') : '-'}
                              </TableCell>
                              <TableCell>
                                {it.submission_url ? (
                                  <Link href={it.submission_url} target="_blank" rel="noopener" underline="hover">
                                    작성 보기 <OpenInNewIcon sx={{ fontSize: 13, verticalAlign: 'middle' }} />
                                  </Link>
                                ) : <Typography variant="caption" color="text.disabled">대기 중</Typography>}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Paper>
                  );
                })}
              </Stack>
            )}
          </Box>
        )}
      </Container>

      {/* 협의 요청 다이얼로그 */}
      <Dialog open={dialogOpen} onClose={() => !submitting && setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>발행 협의 요청 ({selected.length}명)</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {campaigns.length > 0 && (
              <FormControl size="small" fullWidth>
                <InputLabel id="blogger-campaign-label">연관 캠페인 (선택)</InputLabel>
                <Select
                  labelId="blogger-campaign-label"
                  label="연관 캠페인 (선택)"
                  value={campaignId}
                  onChange={(e) => setCampaignId(e.target.value)}
                >
                  <MenuItem value=""><em>선택 안 함</em></MenuItem>
                  {campaigns.map(c => (
                    <MenuItem key={c.id} value={c.id}>{c.mbName ? `${c.mbName} · ` : ''}{c.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>제품 제공 방식</Typography>
              <RadioGroup row value={provision} onChange={(e) => setProvision(e.target.value)}>
                <FormControlLabel value="sponsored" control={<Radio />} label="협찬 (제품 배송)" />
                <FormControlLabel value="self_purchase" control={<Radio />} label="내돈내산 (직접 구매)" />
              </RadioGroup>
            </Box>
            <TextField
              label="요청 메모"
              placeholder="어떤 제품/캠페인에 진행하고 싶은지, 희망 사항 등을 적어주세요"
              value={brandMemo}
              onChange={(e) => setBrandMemo(e.target.value)}
              fullWidth multiline minRows={3}
            />
            <Alert severity="info" variant="outlined">
              선택한 블로거 {selected.length}명에 대한 협의 요청이 담당자에게 전달됩니다.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={submitting}>취소</Button>
          <Button variant="contained" onClick={handleSubmitRequest} disabled={submitting}>
            {submitting ? '전송 중...' : '협의 요청 보내기'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default BrandBloggerView;
