import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography,
  Stack, CircularProgress, Chip, ToggleButtonGroup, ToggleButton
} from '@mui/material';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ReferenceLine
} from 'recharts';
import { rankingService } from '../../services';

/**
 * 특정 제품의 시간별 순위 추이 모달
 *
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - product: { goods_no, product_name, brand_name, image_url, product_url }
 *  - categoryId: string
 */
function RankingHistoryDialog({ open, onClose, product, categoryId }) {
  const [hours, setHours] = useState(48);
  const [loading, setLoading] = useState(false);
  const [points, setPoints] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !product?.goods_no || !categoryId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await rankingService.getHistory(categoryId, product.goods_no, hours);
        if (cancelled) return;
        if (res.success) {
          setPoints(res.data.points || []);
        } else {
          setError(res.message || '데이터 조회 실패');
        }
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, product, categoryId, hours]);

  // chart 데이터 변환 (X: 짧은 시간 라벨, Y: rank)
  const chartData = points.map(p => ({
    time: new Date(p.collected_at).toLocaleString('ko-KR', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    }),
    rank: p.rank,
    rawTime: p.collected_at
  }));

  const ranks = points.map(p => p.rank);
  const stats = ranks.length > 0 ? {
    best: Math.min(...ranks),
    worst: Math.max(...ranks),
    avg: Math.round((ranks.reduce((a, b) => a + b, 0) / ranks.length) * 10) / 10,
    samples: ranks.length
  } : null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ borderBottom: '1px solid #eee', pb: 1.5 }}>
        <Typography variant="subtitle1" fontWeight="bold" sx={{ lineHeight: 1.3 }}>
          {product?.product_name || '(이름 없음)'}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {product?.brand_name || '-'} · 상품코드 {product?.goods_no}
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
          <Typography variant="body2" color="text.secondary">기간:</Typography>
          <ToggleButtonGroup
            size="small"
            value={hours}
            exclusive
            onChange={(_, v) => v && setHours(v)}
          >
            <ToggleButton value={24}>24h</ToggleButton>
            <ToggleButton value={48}>48h</ToggleButton>
            <ToggleButton value={72}>72h</ToggleButton>
            <ToggleButton value={168}>7일</ToggleButton>
          </ToggleButtonGroup>
          <Box sx={{ flex: 1 }} />
          {stats && (
            <Stack direction="row" spacing={1}>
              <Chip size="small" label={`최고 ${stats.best}위`} color="success" variant="outlined" />
              <Chip size="small" label={`최저 ${stats.worst}위`} color="error" variant="outlined" />
              <Chip size="small" label={`평균 ${stats.avg}위`} variant="outlined" />
              <Chip size="small" label={`${stats.samples}회 노출`} variant="outlined" />
            </Stack>
          )}
        </Stack>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Typography color="error">{error}</Typography>
        ) : chartData.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
            <Typography>이 기간 동안 100위 안에 노출된 기록이 없습니다.</Typography>
          </Box>
        ) : (
          <Box sx={{ width: '100%', height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 16, right: 32, left: 0, bottom: 16 }}>
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  reversed
                  domain={[1, 100]}
                  ticks={[1, 10, 25, 50, 75, 100]}
                  tick={{ fontSize: 11 }}
                  label={{ value: '순위', angle: -90, position: 'insideLeft', fontSize: 12 }}
                />
                <RechartsTooltip
                  formatter={(value) => [`${value}위`, '순위']}
                  labelFormatter={(label) => label}
                />
                <ReferenceLine y={10} stroke="#888" strokeDasharray="3 3" label={{ value: 'TOP 10', fontSize: 10, fill: '#888', position: 'right' }} />
                <ReferenceLine y={50} stroke="#ccc" strokeDasharray="3 3" />
                <Line
                  type="monotone"
                  dataKey="rank"
                  stroke="#1976d2"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>닫기</Button>
      </DialogActions>
    </Dialog>
  );
}

export default RankingHistoryDialog;
