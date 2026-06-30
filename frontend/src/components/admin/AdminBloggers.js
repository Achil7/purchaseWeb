import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Button, IconButton, Switch, TextField, InputAdornment, Dialog, DialogTitle,
  DialogContent, DialogActions, Stack, Link, Alert, CircularProgress, Tooltip, Chip,
  TableSortLabel
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import { bloggerService } from '../../services';

const EMPTY_FORM = {
  activity_name: '',
  blog_url: '',
  daily_visitors: '',
  main_content: '',
  memo: '',
  is_active: true
};

// 방문자수 등 TEXT 컬럼에서 숫자만 추출 (정렬용)
const parseNum = (v) => parseInt(String(v ?? '').replace(/[^0-9]/g, ''), 10) || 0;

function AdminBloggers() {
  const [bloggers, setBloggers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  // 정렬 상태 (컬럼 클릭)
  const [sortKey, setSortKey] = useState(null);   // 'activity_name' | 'daily_visitors' | 'is_active'
  const [sortDir, setSortDir] = useState('asc');

  // 등록/수정 다이얼로그
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState(null); // null이면 신규
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await bloggerService.list();
      if (res.success) {
        setBloggers(res.data || []);
      } else {
        setError(res.message || '목록을 불러오지 못했습니다');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const openCreate = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (b) => {
    setEditId(b.id);
    setForm({
      activity_name: b.activity_name || '',
      blog_url: b.blog_url || '',
      daily_visitors: b.daily_visitors || '',
      main_content: b.main_content || '',
      memo: b.memo || '',
      is_active: !!b.is_active
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.activity_name.trim()) {
      setError('활동명은 필수입니다');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = { ...form };
      const res = editId
        ? await bloggerService.update(editId, payload)
        : await bloggerService.create(payload);
      if (res.success) {
        setDialogOpen(false);
        load();
      } else {
        setError(res.message || '저장에 실패했습니다');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (b) => {
    if (!window.confirm(`'${b.activity_name}' 블로거를 삭제하시겠습니까?`)) return;
    try {
      const res = await bloggerService.remove(b.id);
      if (res.success) {
        setBloggers(prev => prev.filter(x => x.id !== b.id));
      } else {
        setError(res.message || '삭제에 실패했습니다');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  };

  const handleToggle = async (b) => {
    // 낙관적 업데이트
    setBloggers(prev => prev.map(x => x.id === b.id ? { ...x, is_active: !x.is_active } : x));
    try {
      await bloggerService.toggleActive(b.id);
    } catch (err) {
      // 실패 시 롤백
      setBloggers(prev => prev.map(x => x.id === b.id ? { ...x, is_active: b.is_active } : x));
      setError(err.response?.data?.message || err.message);
    }
  };

  const q = search.trim().toLowerCase();
  const filtered = q
    ? bloggers.filter(b =>
        (b.activity_name || '').toLowerCase().includes(q) ||
        (b.main_content || '').toLowerCase().includes(q) ||
        (b.blog_url || '').toLowerCase().includes(q))
    : bloggers;

  // 정렬 적용 (미선택 시 등록순=서버 id순 유지)
  const rows = useMemo(() => {
    if (!sortKey) return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      if (sortKey === 'daily_visitors') {
        return sortDir === 'asc' ? parseNum(a.daily_visitors) - parseNum(b.daily_visitors) : parseNum(b.daily_visitors) - parseNum(a.daily_visitors);
      }
      if (sortKey === 'is_active') {
        const av = a.is_active ? 1 : 0, bv = b.is_active ? 1 : 0;
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      const av = (a[sortKey] || '').toString();
      const bv = (b[sortKey] || '').toString();
      return sortDir === 'asc' ? av.localeCompare(bv, 'ko') : bv.localeCompare(av, 'ko');
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const activeCount = bloggers.filter(b => b.is_active).length;

  const sortHeader = (key, label, width) => (
    <TableCell sx={{ width, fontWeight: 'bold' }} sortDirection={sortKey === key ? sortDir : false}>
      <TableSortLabel
        active={sortKey === key}
        direction={sortKey === key ? sortDir : 'asc'}
        onClick={() => handleSort(key)}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  );

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2, flexWrap: 'wrap' }}>
        <Typography variant="h5" fontWeight="bold">블로거 관리</Typography>
        <Chip label={`전체 ${bloggers.length}명`} size="small" />
        <Chip label={`노출 ${activeCount}명`} size="small" color="success" variant="outlined" />
        <Box sx={{ flexGrow: 1 }} />
        <TextField
          size="small"
          placeholder="활동명 / 콘텐츠 / 주소 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            )
          }}
          sx={{ width: 280 }}
        />
        <Tooltip title="새로고침">
          <IconButton onClick={load}><RefreshIcon /></IconButton>
        </Tooltip>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          블로거 추가
        </Button>
      </Stack>

      <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
        여기에 등록된 블로거는 <b>모든 브랜드사</b>가 공통으로 보게 됩니다 (올리브영 랭킹 탭처럼).
        목록은 등록순으로 표시되며, 컬럼 헤더(활동명/평균 1일 방문자/노출)를 클릭해 정렬할 수 있습니다.
        노출을 끄면 브랜드 화면에서 숨겨집니다. 메모는 내부용으로 브랜드에 보이지 않습니다.
      </Alert>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Paper sx={{ position: 'relative' }}>
        {loading && !bloggers.length ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : rows.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
            <Typography>{bloggers.length === 0 ? '등록된 블로거가 없습니다. "블로거 추가"로 등록하세요.' : '검색 결과가 없습니다.'}</Typography>
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                <TableCell sx={{ width: 50, fontWeight: 'bold' }}>No.</TableCell>
                {sortHeader('activity_name', '활동명')}
                <TableCell sx={{ fontWeight: 'bold' }}>블로그 주소</TableCell>
                {sortHeader('daily_visitors', '평균 1일 방문자', 140)}
                <TableCell sx={{ fontWeight: 'bold' }}>주요 콘텐츠</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>메모</TableCell>
                {sortHeader('is_active', '노출', 90)}
                <TableCell sx={{ width: 100, fontWeight: 'bold' }} align="center">작업</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((b, idx) => (
                <TableRow key={b.id} hover sx={{ opacity: b.is_active ? 1 : 0.5 }}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell sx={{ fontWeight: 500 }}>{b.activity_name}</TableCell>
                  <TableCell sx={{ maxWidth: 240 }}>
                    {b.blog_url ? (
                      <Link href={b.blog_url} target="_blank" rel="noopener" underline="hover"
                        sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {b.blog_url}
                      </Link>
                    ) : '-'}
                  </TableCell>
                  <TableCell>{b.daily_visitors || '-'}</TableCell>
                  <TableCell sx={{ maxWidth: 220, whiteSpace: 'pre-wrap' }}>{b.main_content || '-'}</TableCell>
                  <TableCell sx={{ maxWidth: 200, color: 'text.secondary', whiteSpace: 'pre-wrap' }}>{b.memo || '-'}</TableCell>
                  <TableCell align="center">
                    <Switch size="small" checked={!!b.is_active} onChange={() => handleToggle(b)} />
                  </TableCell>
                  <TableCell align="center">
                    <IconButton size="small" onClick={() => openEdit(b)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDelete(b)}><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      {/* 등록/수정 다이얼로그 */}
      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editId ? '블로거 수정' : '블로거 추가'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="활동명 *"
              value={form.activity_name}
              onChange={(e) => setForm(f => ({ ...f, activity_name: e.target.value }))}
              fullWidth autoFocus
            />
            <TextField
              label="블로그 주소"
              placeholder="https://blog.naver.com/..."
              value={form.blog_url}
              onChange={(e) => setForm(f => ({ ...f, blog_url: e.target.value }))}
              fullWidth
            />
            <TextField
              label="평균 1일 방문자 수"
              placeholder="예: 3,000 또는 2000~3000"
              value={form.daily_visitors}
              onChange={(e) => setForm(f => ({ ...f, daily_visitors: e.target.value }))}
              fullWidth
            />
            <TextField
              label="주요 콘텐츠"
              placeholder="예: 뷰티 / 육아 / 맛집"
              value={form.main_content}
              onChange={(e) => setForm(f => ({ ...f, main_content: e.target.value }))}
              fullWidth multiline minRows={2}
            />
            <TextField
              label="메모 (내부용 - 브랜드 비노출)"
              value={form.memo}
              onChange={(e) => setForm(f => ({ ...f, memo: e.target.value }))}
              fullWidth multiline minRows={2}
            />
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Switch checked={form.is_active} onChange={(e) => setForm(f => ({ ...f, is_active: e.target.checked }))} />
              <Typography variant="body2">브랜드 노출</Typography>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>취소</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? '저장 중...' : '저장'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default AdminBloggers;
