import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Box, Typography, IconButton, CircularProgress, Paper } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import itemSlotService from '../../services/itemSlotService';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function OperatorMonthlyCalendar({ viewAsUserId = null, onDateSelect }) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [counts, setCounts] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadCounts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await itemSlotService.getMonthlyCounts(year, month, viewAsUserId);
      if (response.success) {
        setCounts(response.data || []);
      }
    } catch (err) {
      console.error('Load monthly counts error:', err);
    } finally {
      setLoading(false);
    }
  }, [year, month, viewAsUserId]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  const countsMap = useMemo(() => {
    const map = {};
    counts.forEach(c => { map[c.date] = c; });
    return map;
  }, [counts]);

  // 월 그리드 계산: 해당 월 1일의 요일 ~ 말일까지, 6주 × 7일
  const calendarCells = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, month, 0).getDate();

    const cells = [];
    // 앞 빈칸
    for (let i = 0; i < startWeekday; i++) {
      cells.push(null);
    }
    // 일자
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, dateStr });
    }
    // 마지막 행 채우기 (7의 배수)
    while (cells.length % 7 !== 0) cells.push(null);

    return cells;
  }, [year, month]);

  const handlePrevMonth = () => {
    if (month === 1) {
      setYear(year - 1);
      setMonth(12);
    } else {
      setMonth(month - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setYear(year + 1);
      setMonth(1);
    } else {
      setMonth(month + 1);
    }
  };

  const handleCellClick = (cell) => {
    if (!cell) return;
    const date = new Date(year, month - 1, cell.day);
    if (onDateSelect) onDateSelect(date);
  };

  const todayStr = useMemo(() => {
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }, [today]);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, p: 2.5 }}>
      {/* 월 네비게이션 헤더 + 범례 (한 줄) */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        mb: 1.5,
        flexShrink: 0
      }}>
        {/* 좌측: 범례 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontSize: '0.85rem' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: '#424242' }} />
            <Typography sx={{ fontSize: '0.85rem', color: '#424242', fontWeight: 600 }}>전체</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: '#2e7d32' }} />
            <Typography sx={{ fontSize: '0.85rem', color: '#2e7d32', fontWeight: 600 }}>작성</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: '#1565c0' }} />
            <Typography sx={{ fontSize: '0.85rem', color: '#1565c0', fontWeight: 600 }}>리뷰샷</Typography>
          </Box>
        </Box>

        {/* 중앙: 월 네비게이션 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton onClick={handlePrevMonth} size="small" sx={{ color: '#555' }}>
            <ChevronLeftIcon />
          </IconButton>
          <Typography sx={{ minWidth: 140, textAlign: 'center', fontSize: '1.2rem', fontWeight: 'bold', color: '#222' }}>
            {year}년 {month}월
          </Typography>
          <IconButton onClick={handleNextMonth} size="small" sx={{ color: '#555' }}>
            <ChevronRightIcon />
          </IconButton>
          {loading && <CircularProgress size={18} sx={{ ml: 1 }} />}
        </Box>

        {/* 우측: 자리 맞춤용 spacer */}
        <Box sx={{ width: 200 }} />
      </Box>

      {/* 요일 헤더 */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 0.75,
        mb: 0.75,
        flexShrink: 0
      }}>
        {WEEKDAYS.map((wd, idx) => (
          <Box
            key={wd}
            sx={{
              textAlign: 'center',
              fontWeight: 'bold',
              fontSize: '0.95rem',
              color: idx === 0 ? '#d32f2f' : idx === 6 ? '#1976d2' : '#555',
              py: 1.25,
              bgcolor: '#f5f5f5',
              borderRadius: 1,
              letterSpacing: '0.05em'
            }}
          >
            {wd}
          </Box>
        ))}
      </Box>

      {/* 캘린더 그리드 */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gridAutoRows: '1fr',
        gap: 0.75,
        flex: 1,
        minHeight: 0
      }}>
        {calendarCells.map((cell, idx) => {
          if (!cell) {
            return <Box key={`empty-${idx}`} sx={{ bgcolor: '#fafafa', borderRadius: 1, opacity: 0.4 }} />;
          }

          const count = countsMap[cell.dateStr];
          const hasData = count && count.total > 0;
          const isToday = cell.dateStr === todayStr;
          const weekday = idx % 7;

          return (
            <Paper
              key={cell.dateStr}
              elevation={0}
              onClick={() => handleCellClick(cell)}
              sx={{
                p: 0.75,
                cursor: 'pointer',
                border: isToday ? '2px solid #1976d2' : '1px solid #e0e0e0',
                bgcolor: isToday ? '#e3f2fd' : (hasData ? '#fff' : '#fafafa'),
                display: 'flex',
                flexDirection: 'column',
                gap: 0.4,
                minHeight: 76,
                transition: 'all 0.15s',
                '&:hover': {
                  bgcolor: isToday ? '#bbdefb' : '#f0f7ff',
                  borderColor: '#1976d2',
                  transform: 'translateY(-1px)',
                  boxShadow: 3
                }
              }}
            >
              {/* 일자 + 오늘 뱃지 */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography
                  sx={{
                    fontSize: '0.9rem',
                    fontWeight: 'bold',
                    color: weekday === 0 ? '#d32f2f' : weekday === 6 ? '#1976d2' : '#222',
                    lineHeight: 1
                  }}
                >
                  {cell.day}
                </Typography>
                {isToday && (
                  <Box sx={{
                    fontSize: '0.55rem',
                    fontWeight: 'bold',
                    color: '#fff',
                    bgcolor: '#1976d2',
                    px: 0.4,
                    py: 0.1,
                    borderRadius: 0.4,
                    letterSpacing: '0.05em'
                  }}>
                    TODAY
                  </Box>
                )}
              </Box>

              {/* 카운트 라인 */}
              {hasData ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.2 }}>
                  {/* 전체 */}
                  <Box sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    bgcolor: '#f5f5f5',
                    borderRadius: 0.4,
                    px: 0.5,
                    py: 0.15
                  }}>
                    <Typography sx={{ fontSize: '0.65rem', color: '#555', fontWeight: 500 }}>전체</Typography>
                    <Typography sx={{ fontSize: '0.78rem', color: '#222', fontWeight: 'bold', lineHeight: 1 }}>
                      {count.total}
                    </Typography>
                  </Box>
                  {/* 작성 */}
                  <Box sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    bgcolor: '#e8f5e9',
                    borderRadius: 0.4,
                    px: 0.5,
                    py: 0.15
                  }}>
                    <Typography sx={{ fontSize: '0.65rem', color: '#2e7d32', fontWeight: 500 }}>작성</Typography>
                    <Typography sx={{ fontSize: '0.78rem', color: '#1b5e20', fontWeight: 'bold', lineHeight: 1 }}>
                      {count.written}
                    </Typography>
                  </Box>
                  {/* 리뷰샷 */}
                  <Box sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    bgcolor: '#e3f2fd',
                    borderRadius: 0.4,
                    px: 0.5,
                    py: 0.15
                  }}>
                    <Typography sx={{ fontSize: '0.65rem', color: '#1565c0', fontWeight: 500 }}>리뷰샷</Typography>
                    <Typography sx={{ fontSize: '0.78rem', color: '#0d47a1', fontWeight: 'bold', lineHeight: 1 }}>
                      {count.reviewed}
                    </Typography>
                  </Box>
                </Box>
              ) : (
                <Box sx={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Typography sx={{ fontSize: '0.75rem', color: '#ccc' }}>·</Typography>
                </Box>
              )}
            </Paper>
          );
        })}
      </Box>
    </Box>
  );
}

export default OperatorMonthlyCalendar;
