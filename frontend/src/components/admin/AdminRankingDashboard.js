import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Container, Typography, Tabs, Tab, Paper, Table, TableHead, TableRow,
  TableCell, TableBody, Avatar, Chip, Alert, CircularProgress, Link, Stack
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { rankingService } from '../../services';

function PriceCell({ row }) {
  const sale = row.sale_price;
  const original = row.original_price;
  const discount = row.discount_rate;

  if (!sale && !original) {
    return <span>{row.price || '-'}</span>;
  }
  if (!sale) {
    return <span style={{ fontWeight: 'bold' }}>{original}</span>;
  }
  if (!original) {
    return <span style={{ fontWeight: 'bold' }}>{sale}</span>;
  }
  return (
    <Stack spacing={0.2}>
      <Box component="span" sx={{ color: 'text.disabled', textDecoration: 'line-through', fontSize: '0.78rem' }}>
        {original}
      </Box>
      <Box component="span">
        {discount ? (
          <Box component="span" sx={{ color: 'error.main', fontWeight: 'bold', mr: 0.6 }}>
            {discount}%
          </Box>
        ) : null}
        <Box component="span" sx={{ fontWeight: 'bold' }}>{sale}</Box>
      </Box>
    </Stack>
  );
}

function AdminRankingDashboard() {
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [collectedAt, setCollectedAt] = useState(null);
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadCategories = useCallback(async () => {
    try {
      const res = await rankingService.getCategories();
      if (res.success) setCategories(res.data || []);
    } catch (err) {
      console.error('카테고리 로드 실패:', err);
    }
  }, []);

  const loadRankings = useCallback(async (categoryId) => {
    setLoading(true);
    setError(null);
    try {
      const res = await rankingService.getLatest(categoryId);
      if (res.success) {
        setCollectedAt(res.data.collected_at);
        setRankings(res.data.rankings || []);
      } else {
        setError(res.message || '데이터를 불러오지 못했습니다');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    if (activeCategory) loadRankings(activeCategory);
  }, [activeCategory, loadRankings]);

  return (
    <Container maxWidth="xl" sx={{ pt: 12, pb: 4 }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight="bold">올리브영 카테고리 BEST 랭킹</Typography>
        <Chip
          icon={<RefreshIcon />}
          label={collectedAt ? `최근 수집: ${new Date(collectedAt).toLocaleString('ko-KR')}` : '수집 데이터 없음'}
          color={collectedAt ? 'success' : 'default'}
          variant="outlined"
        />
      </Stack>

      <Alert severity="info" sx={{ mb: 2 }}>
        수집은 본인 PC에서 <code>backend/scripts/runRankingWorker.bat</code> 실행으로 진행됩니다.
        EC2 서버에서는 자동 수집이 동작하지 않습니다 (올리브영 봇 차단).
      </Alert>

      <Paper sx={{ mb: 2 }}>
        <Tabs
          value={activeCategory}
          onChange={(_, v) => setActiveCategory(v)}
          variant="scrollable"
          scrollButtons="auto"
        >
          {categories.map((c) => (
            <Tab key={c.id} value={c.id} label={c.name} />
          ))}
        </Tabs>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      )}

      <Paper>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : rankings.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
            <Typography>이 카테고리에 수집된 데이터가 없습니다.</Typography>
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                <TableCell sx={{ width: 60, fontWeight: 'bold' }}>순위</TableCell>
                <TableCell sx={{ width: 80, fontWeight: 'bold' }}>이미지</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>제품명</TableCell>
                <TableCell sx={{ width: 160, fontWeight: 'bold' }}>브랜드</TableCell>
                <TableCell sx={{ width: 160, fontWeight: 'bold' }}>가격</TableCell>
                <TableCell sx={{ width: 140, fontWeight: 'bold' }}>상품 코드</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rankings.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>
                    <Typography variant="h6" color={r.rank <= 3 ? 'error.main' : 'text.primary'}>
                      {r.rank}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {r.image_url ? (
                      <Avatar variant="rounded" src={r.image_url} sx={{ width: 56, height: 56 }} />
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {r.product_url ? (
                      <Link href={r.product_url} target="_blank" rel="noopener" underline="hover">
                        {r.product_name || '(이름 없음)'}
                      </Link>
                    ) : (
                      r.product_name || '(이름 없음)'
                    )}
                  </TableCell>
                  <TableCell>{r.brand_name || '-'}</TableCell>
                  <TableCell><PriceCell row={r} /></TableCell>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{r.goods_no || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>
    </Container>
  );
}

export default AdminRankingDashboard;
