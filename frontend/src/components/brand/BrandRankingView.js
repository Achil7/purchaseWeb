import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Container, Typography, Paper, Table, TableHead, TableRow,
  TableCell, TableBody, Avatar, Chip, Alert, CircularProgress, Stack, Link
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { rankingService } from '../../services';

function BrandRankingView() {
  const [collectedAt, setCollectedAt] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams(window.location.search);
      const viewAsUserId = params.get('viewAsUserId');
      const res = await rankingService.getMyProducts(viewAsUserId);
      if (res.success) {
        setCollectedAt(res.data.collected_at);
        setProducts(res.data.products || []);
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
    load();
  }, [load]);

  const exposed = products.filter((p) => p.rankings.length > 0);
  const notExposed = products.filter((p) => p.rankings.length === 0);

  return (
    <Container maxWidth="xl" sx={{ pt: 12, pb: 4 }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight="bold">올리브영 BEST 노출 현황</Typography>
        <Chip
          icon={<RefreshIcon />}
          label={collectedAt ? `최근 수집: ${new Date(collectedAt).toLocaleString('ko-KR')}` : '수집 데이터 없음'}
          color={collectedAt ? 'success' : 'default'}
          variant="outlined"
        />
      </Stack>

      <Alert severity="info" sx={{ mb: 2 }}>
        등록하신 제품 URL의 올리브영 상품코드를 카테고리 BEST 100과 매칭한 결과입니다.
      </Alert>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Typography variant="h6" sx={{ mt: 2, mb: 1, color: 'success.main' }}>
            BEST 노출 제품 ({exposed.length}개)
          </Typography>
          <Paper sx={{ mb: 4 }}>
            {exposed.length === 0 ? (
              <Box sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
                <Typography>현재 BEST 100에 노출된 제품이 없습니다.</Typography>
              </Box>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                    <TableCell sx={{ width: 80, fontWeight: 'bold' }}>이미지</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>제품명</TableCell>
                    <TableCell sx={{ width: 140, fontWeight: 'bold' }}>상품 코드</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>노출 카테고리 / 순위</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {exposed.map((p) => (
                    <TableRow key={p.goods_no} hover>
                      <TableCell>
                        {p.image_url ? (
                          <Avatar variant="rounded" src={p.image_url} sx={{ width: 56, height: 56 }} />
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {p.product_url ? (
                          <Link href={p.product_url} target="_blank" rel="noopener" underline="hover">
                            {p.product_name || '(이름 없음)'}
                          </Link>
                        ) : (
                          p.product_name || '(이름 없음)'
                        )}
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace' }}>{p.goods_no}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          {p.rankings.map((r) => (
                            <Chip
                              key={`${r.category_id}_${r.rank}`}
                              label={`${r.category_name} ${r.rank}위`}
                              color={r.rank <= 10 ? 'error' : r.rank <= 30 ? 'warning' : 'default'}
                              size="small"
                            />
                          ))}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Paper>

          <Typography variant="h6" sx={{ mt: 2, mb: 1, color: 'text.secondary' }}>
            미노출 제품 ({notExposed.length}개)
          </Typography>
          <Paper>
            {notExposed.length === 0 ? (
              <Box sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
                <Typography>모든 제품이 BEST 100에 노출 중입니다.</Typography>
              </Box>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                    <TableCell sx={{ fontWeight: 'bold' }}>제품명</TableCell>
                    <TableCell sx={{ width: 140, fontWeight: 'bold' }}>상품 코드</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {notExposed.map((p) => (
                    <TableRow key={p.goods_no}>
                      <TableCell>{p.product_name || '(이름 없음)'}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace' }}>{p.goods_no}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Paper>
        </>
      )}
    </Container>
  );
}

export default BrandRankingView;
