import React, { useEffect, useState, useRef } from 'react';
import {
  Box, Container, Paper, Typography, Stack, Chip, Button, TextField,
  Select, MenuItem, FormControl, InputLabel, LinearProgress, Alert,
  IconButton, Divider, List, ListItem, ListItemText
} from '@mui/material';

function fmtTs(d) {
  if (!d) return '-';
  const x = new Date(d);
  const z = (n) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${z(x.getMonth() + 1)}-${z(x.getDate())} ${z(x.getHours())}:${z(x.getMinutes())}:${z(x.getSeconds())}`;
}

function toLocalDateTimeInput(d) {
  const x = d ? new Date(d) : new Date();
  const z = (n) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${z(x.getMonth() + 1)}-${z(x.getDate())}T${z(x.getHours())}:${z(x.getMinutes())}`;
}

export default function MainView({ env, onReset }) {
  const [running, setRunning] = useState(false);
  const [envSummary, setEnvSummary] = useState(null);
  const [startAt, setStartAt] = useState(toLocalDateTimeInput(new Date()));
  const [endAt, setEndAt] = useState(() => {
    const e = new Date();
    e.setDate(e.getDate() + 7);
    e.setHours(23, 59, 0, 0);
    return toLocalDateTimeInput(e);
  });
  const [intervalMin, setIntervalMin] = useState(30);
  const [statusMsg, setStatusMsg] = useState('대기 중. 일정을 설정하고 "수집 시작"을 눌러주세요.');
  const [nextRunAt, setNextRunAt] = useState(null);
  const [currentRound, setCurrentRound] = useState(null);
  const [recentRounds, setRecentRounds] = useState([]);
  const [recentEvents, setRecentEvents] = useState([]);
  const [error, setError] = useState(null);
  const unsubRef = useRef(null);

  useEffect(() => {
    window.api.getEnvSummary(env).then(setEnvSummary);
  }, [env]);

  useEffect(() => {
    refreshState();
    unsubRef.current = window.api.onProgress(handleEvent);
    return () => {
      unsubRef.current && unsubRef.current();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshState = async () => {
    const s = await window.api.getWorkerState();
    setRunning(s.running);
    setNextRunAt(s.nextRunAt);
  };

  const handleEvent = (e) => {
    setRecentEvents((prev) => [{ ts: Date.now(), ...e }, ...prev].slice(0, 30));
    switch (e.type) {
      case 'tunnel':
        setStatusMsg(`SSH 터널 연결됨 (localhost:${e.localPort})`);
        break;
      case 'db':
        setStatusMsg('DB 연결 성공');
        break;
      case 'schedule':
      case 'waiting':
        setNextRunAt(e.nextRunAt);
        setStatusMsg(`다음 수집 예정: ${fmtTs(e.nextRunAt)}`);
        setCurrentRound(null);
        break;
      case 'round-start':
        setCurrentRound({ round: e.round, total: e.total, completed: 0, succeeded: 0, failed: 0, currentCategory: null, items: [] });
        setStatusMsg(`라운드 #${e.round} 시작`);
        break;
      case 'progress':
        setCurrentRound((cur) => {
          if (!cur) return cur;
          const next = { ...cur };
          next.completed = e.idx;
          next.currentCategory = e.category;
          if (e.success) next.succeeded += 1; else next.failed += 1;
          next.items = [{ idx: e.idx, name: e.category, success: e.success, count: e.items, error: e.error }, ...cur.items].slice(0, 10);
          return next;
        });
        break;
      case 'round-complete':
        setRecentRounds((prev) => [{ round: e.round, success: e.successCount, fail: e.failCount, rows: e.insertedRows, completedAt: new Date() }, ...prev].slice(0, 10));
        setStatusMsg(`라운드 #${e.round} 완료 (${e.successCount}/${e.successCount + e.failCount}, ${e.insertedRows}개 저장)`);
        setCurrentRound(null);
        break;
      case 'round-exception':
      case 'db-error':
      case 'fatal':
        setError(e.error || e.reason || '오류');
        break;
      case 'finished':
        setStatusMsg('수집 일정 종료. 대기 중.');
        setRunning(false);
        setCurrentRound(null);
        break;
      case 'stopped':
        setStatusMsg('중지되었습니다.');
        setRunning(false);
        setCurrentRound(null);
        break;
      default:
        break;
    }
  };

  const start = async () => {
    setError(null);
    const result = await window.api.startWorker({
      env,
      startAt: new Date(startAt).toISOString(),
      endAt: new Date(endAt).toISOString(),
      intervalMin
    });
    if (!result.success) {
      setError(result.error);
    } else {
      setRunning(true);
      setStatusMsg('시작 신호 전송됨. 연결 중...');
    }
  };

  const stop = async () => {
    await window.api.stopWorker();
    setRunning(false);
    setStatusMsg('중지 요청됨.');
  };

  const openLogs = async () => {
    await window.api.openLogsFolder();
  };

  const openWeb = async () => {
    await window.api.openExternal('https://kwad.co.kr/admin/rankings');
  };

  const envLabel = env === 'main' ? 'main (운영)' : 'test (테스트)';
  const envColor = env === 'main' ? 'error' : 'info';

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight="bold">🌳 올리브영 BEST 랭킹 수집기</Typography>
        <Chip label={envLabel} color={envColor} variant="filled" />
        <Box sx={{ flexGrow: 1 }} />
        <Button size="small" onClick={openLogs}>📂 로그 폴더</Button>
        <Button size="small" onClick={openWeb}>📊 웹 결과</Button>
        <Button size="small" color="warning" onClick={onReset} disabled={running}>🔄 환경 다시 선택</Button>
      </Stack>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>📅 수집 일정</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="시작 일시"
            type="datetime-local"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
            InputLabelProps={{ shrink: true }}
            disabled={running}
            fullWidth
          />
          <TextField
            label="종료 일시"
            type="datetime-local"
            value={endAt}
            onChange={(e) => setEndAt(e.target.value)}
            InputLabelProps={{ shrink: true }}
            disabled={running}
            fullWidth
          />
          <FormControl sx={{ minWidth: 140 }} disabled={running}>
            <InputLabel>인터벌</InputLabel>
            <Select label="인터벌" value={intervalMin} onChange={(e) => setIntervalMin(Number(e.target.value))}>
              <MenuItem value={20}>20분</MenuItem>
              <MenuItem value={30}>30분</MenuItem>
              <MenuItem value={60}>1시간</MenuItem>
              <MenuItem value={120}>2시간</MenuItem>
            </Select>
          </FormControl>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          {!running ? (
            <Button variant="contained" color="primary" onClick={start} size="large">▶ 수집 시작</Button>
          ) : (
            <Button variant="contained" color="error" onClick={stop} size="large">⏹ 중지</Button>
          )}
        </Stack>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>📊 진행 상황</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{statusMsg}</Typography>

        {currentRound ? (
          <Box>
            <Typography variant="body2" sx={{ mt: 1 }}>
              라운드 #{currentRound.round} | 현재: {currentRound.currentCategory || '-'} | 성공 {currentRound.succeeded} / 실패 {currentRound.failed}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={(currentRound.completed / currentRound.total) * 100}
              sx={{ mt: 1, height: 10, borderRadius: 5 }}
            />
            <Typography variant="caption" color="text.secondary">
              {currentRound.completed} / {currentRound.total}
            </Typography>
          </Box>
        ) : (
          <Alert severity={running ? 'info' : 'success'} variant="outlined" sx={{ mt: 1 }}>
            {running ? `대기 중 — 다음 수집: ${fmtTs(nextRunAt)}` : '실행 중이 아닙니다'}
          </Alert>
        )}
      </Paper>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <Paper sx={{ p: 2, flex: 1 }}>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>최근 라운드</Typography>
          {recentRounds.length === 0 ? (
            <Typography variant="body2" color="text.secondary">아직 완료된 라운드가 없습니다.</Typography>
          ) : (
            <List dense>
              {recentRounds.map((r) => (
                <ListItem key={r.round} divider>
                  <ListItemText
                    primary={`#${r.round} — ${r.success}성공 / ${r.fail}실패 / ${r.rows}개 저장`}
                    secondary={fmtTs(r.completedAt)}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Paper>

        <Paper sx={{ p: 2, flex: 1 }}>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>최근 이벤트</Typography>
          {recentEvents.length === 0 ? (
            <Typography variant="body2" color="text.secondary">이벤트가 없습니다.</Typography>
          ) : (
            <List dense>
              {recentEvents.slice(0, 10).map((e, idx) => (
                <ListItem key={idx} divider>
                  <ListItemText
                    primary={e.type + (e.category ? ` - ${e.category}` : '') + (e.round ? ` (라운드 ${e.round})` : '')}
                    secondary={fmtTs(e.ts) + (e.error ? ` | ${e.error}` : '')}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Paper>
      </Stack>
    </Container>
  );
}
