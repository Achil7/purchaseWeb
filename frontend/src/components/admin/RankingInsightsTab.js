import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Paper, Typography, Grid, CircularProgress, Stack, Chip, Tooltip
} from '@mui/material';
import { rankingService } from '../../services';

/**
 * 카테고리 인사이트 탭 — 급상승/급하락/신규/꾸준 4개 패널
 *
 * Props:
 *  - categoryId: string
 *  - windowParam: '6h' | '12h' | '24h' | '48h'
 *  - onProductClick: (product) => void  // 카드 클릭 시 history 모달 열기
 */
function RankingInsightsTab({ categoryId, windowParam, onProductClick }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!categoryId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await rankingService.getInsights(categoryId, windowParam);
      if (res.success) {
        setData(res.data);
      } else {
        setError(res.message || '인사이트 조회 실패');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [categoryId, windowParam]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  if (!data) return null;

  const { biggestGainers = [], biggestLosers = [], newEntries = [], consistent = [] } = data;

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={6}>
        <InsightPanel
          title="🚀 급상승"
          subtitle={`${windowParam} 내 순위가 가장 많이 오른 제품`}
          color="#2e7d32"
          bgColor="#e8f5e9"
          items={biggestGainers}
          emptyText="급상승한 제품이 없습니다"
          renderMeta={(g) => (
            <Stack direction="row" spacing={0.5}>
              <Chip
                size="small"
                label={`▲${g.deltaFromStart}`}
                sx={{ height: 20, fontSize: '0.7rem', bgcolor: '#c8e6c9', color: '#1b5e20', fontWeight: 'bold' }}
              />
              <Chip
                size="small"
                label={`${g.rankBefore}위 → ${g.rankNow}위`}
                variant="outlined"
                sx={{ height: 20, fontSize: '0.7rem' }}
              />
            </Stack>
          )}
          onProductClick={onProductClick}
        />
      </Grid>

      <Grid item xs={12} md={6}>
        <InsightPanel
          title="📉 급하락"
          subtitle={`${windowParam} 내 순위가 가장 많이 떨어진 제품`}
          color="#c62828"
          bgColor="#ffebee"
          items={biggestLosers}
          emptyText="급하락한 제품이 없습니다"
          renderMeta={(g) => (
            <Stack direction="row" spacing={0.5}>
              <Chip
                size="small"
                label={`▼${Math.abs(g.deltaFromStart)}`}
                sx={{ height: 20, fontSize: '0.7rem', bgcolor: '#ffcdd2', color: '#b71c1c', fontWeight: 'bold' }}
              />
              <Chip
                size="small"
                label={`${g.rankBefore}위 → ${g.rankNow}위`}
                variant="outlined"
                sx={{ height: 20, fontSize: '0.7rem' }}
              />
            </Stack>
          )}
          onProductClick={onProductClick}
        />
      </Grid>

      <Grid item xs={12} md={6}>
        <InsightPanel
          title="🆕 신규 진입"
          subtitle={`${windowParam} 내 새로 100위 안에 등장한 제품`}
          color="#e65100"
          bgColor="#fff3e0"
          items={newEntries}
          emptyText="신규 진입 제품이 없습니다"
          renderMeta={(g) => {
            const hoursAgo = Math.round((Date.now() - new Date(g.firstSeenAt).getTime()) / 3600000);
            return (
              <Stack direction="row" spacing={0.5}>
                <Chip
                  size="small"
                  label="NEW"
                  sx={{ height: 20, fontSize: '0.7rem', bgcolor: '#ffe0b2', color: '#e65100', fontWeight: 'bold' }}
                />
                <Chip
                  size="small"
                  label={`현재 ${g.rankNow}위 · ${hoursAgo}시간 전 등장`}
                  variant="outlined"
                  sx={{ height: 20, fontSize: '0.7rem' }}
                />
              </Stack>
            );
          }}
          onProductClick={onProductClick}
        />
      </Grid>

      <Grid item xs={12} md={6}>
        <InsightPanel
          title="👑 꾸준한 상위"
          subtitle={`${windowParam} 내 순위 변동이 거의 없는 안정 제품 (변동 < 5위)`}
          color="#4527a0"
          bgColor="#ede7f6"
          items={consistent}
          emptyText="꾸준한 제품이 없습니다"
          renderMeta={(g) => (
            <Stack direction="row" spacing={0.5}>
              <Chip
                size="small"
                label={`평균 ${g.avgRank}위`}
                sx={{ height: 20, fontSize: '0.7rem', bgcolor: '#d1c4e9', color: '#311b92', fontWeight: 'bold' }}
              />
              <Chip
                size="small"
                label={`변동 ±${g.range} · ${g.samples}회`}
                variant="outlined"
                sx={{ height: 20, fontSize: '0.7rem' }}
              />
            </Stack>
          )}
          onProductClick={onProductClick}
        />
      </Grid>
    </Grid>
  );
}

function InsightPanel({ title, subtitle, color, bgColor, items, emptyText, renderMeta, onProductClick }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ pb: 1, mb: 1, borderBottom: '1px solid #eee' }}>
        <Typography variant="subtitle1" fontWeight="bold" sx={{ color }}>{title}</Typography>
        <Typography variant="caption" color="text.secondary">{subtitle}</Typography>
      </Box>

      {items.length === 0 ? (
        <Box sx={{ py: 3, textAlign: 'center', color: 'text.secondary' }}>
          <Typography variant="body2">{emptyText}</Typography>
        </Box>
      ) : (
        <Stack spacing={1}>
          {items.map((item) => (
            <Tooltip key={item.goods_no} title="클릭하면 시간별 순위 추이를 볼 수 있습니다" placement="left">
              <Box
                onClick={() => onProductClick && onProductClick(item)}
                sx={{
                  display: 'flex', flexDirection: 'column', gap: 0.4, p: 1, borderRadius: 1,
                  cursor: 'pointer', bgcolor: bgColor,
                  '&:hover': { bgcolor: '#fafafa', boxShadow: 1 }
                }}
              >
                <Typography variant="body2" fontWeight="bold" sx={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  lineHeight: 1.3
                }}>
                  {item.product_name || '(이름 없음)'}
                </Typography>
                <Typography variant="caption" color="text.secondary">{item.brand_name || '-'}</Typography>
                <Box>{renderMeta(item)}</Box>
              </Box>
            </Tooltip>
          ))}
        </Stack>
      )}
    </Paper>
  );
}

export default RankingInsightsTab;
