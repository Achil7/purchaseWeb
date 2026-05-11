import React, { useState } from 'react';
import { Box, Container, Paper, Typography, Button, Stack, Alert, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';

export default function EnvSelect({ onSelect }) {
  const [confirming, setConfirming] = useState(null);

  const handleSelect = (env) => {
    if (env === 'main') {
      setConfirming(env);
    } else {
      onSelect(env);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ pt: 8, pb: 4 }}>
      <Paper elevation={3} sx={{ p: 5, textAlign: 'center' }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          🌳 올리브영 BEST 랭킹 수집기
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          데이터를 저장할 환경을 선택하세요.
        </Typography>

        <Stack spacing={2}>
          <Button
            variant="outlined"
            size="large"
            onClick={() => handleSelect('test')}
            sx={{ py: 3, fontSize: '1.1rem' }}
          >
            🧪 test (테스트 환경)
            <br />
            <Typography variant="caption" color="text.secondary">
              DB: serverdb_test
            </Typography>
          </Button>

          <Button
            variant="contained"
            color="error"
            size="large"
            onClick={() => handleSelect('main')}
            sx={{ py: 3, fontSize: '1.1rem' }}
          >
            🚀 main (운영 환경)
            <br />
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.85)' }}>
              DB: serverdb · 실제 운영 데이터에 저장됩니다
            </Typography>
          </Button>
        </Stack>

        <Alert severity="info" sx={{ mt: 4 }}>
          연결 정보(서버 주소, 인증 키)는 프로그램 안에 이미 들어 있습니다.
          별도 입력 없이 환경 선택만 하시면 됩니다.
        </Alert>
      </Paper>

      <Dialog open={!!confirming} onClose={() => setConfirming(null)}>
        <DialogTitle>⚠️ 운영 환경 선택</DialogTitle>
        <DialogContent>
          <Typography>
            <b>main</b>은 실제 서비스에서 사용 중인 운영 데이터베이스입니다.
          </Typography>
          <Typography sx={{ mt: 1 }}>
            저장된 랭킹 데이터는 즉시 모든 사용자에게 노출됩니다.
            계속 진행할까요?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirming(null)}>취소</Button>
          <Button variant="contained" color="error" onClick={() => { onSelect('main'); setConfirming(null); }}>
            네, main으로 진행
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
