import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Box, Typography, Alert, Stepper, Step, StepLabel
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import EditIcon from '@mui/icons-material/Edit';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const steps = ['비밀번호 확인', '정보 수정'];

function ProfileEditDialog({ open, onClose }) {
  const { user } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleClose = () => {
    // 상태 초기화
    setActiveStep(0);
    setPassword('');
    setName('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setSuccess('');
    onClose();
  };

  // 1단계: 비밀번호 확인
  const handleVerifyPassword = async () => {
    if (!password) {
      setError('비밀번호를 입력해주세요');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.post('/auth/verify-password', { password });
      // 비밀번호 확인 성공 - 다음 단계로
      setName(user?.name || '');
      setActiveStep(1);
    } catch (err) {
      setError(err.response?.data?.message || '비밀번호가 일치하지 않습니다');
    } finally {
      setLoading(false);
    }
  };

  // 2단계: 프로필 수정
  const handleUpdateProfile = async () => {
    // 유효성 검사
    if (!name.trim()) {
      setError('이름을 입력해주세요');
      return;
    }

    if (newPassword && newPassword.length < 4) {
      setError('새 비밀번호는 4자 이상이어야 합니다');
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      setError('새 비밀번호가 일치하지 않습니다');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const updateData = { name: name.trim() };
      if (newPassword) {
        updateData.newPassword = newPassword;
      }

      const response = await api.put('/auth/profile', updateData);

      // localStorage의 user 정보 업데이트
      const savedUser = JSON.parse(localStorage.getItem('user') || '{}');
      savedUser.name = response.data.data.name;
      localStorage.setItem('user', JSON.stringify(savedUser));

      setSuccess('프로필이 수정되었습니다. 변경사항을 적용하려면 다시 로그인해주세요.');

      // 2초 후 다이얼로그 닫기
      setTimeout(() => {
        handleClose();
        // 페이지 새로고침하여 변경사항 반영
        window.location.reload();
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || '프로필 수정 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 'bold', borderBottom: '1px solid #eee' }}>
        <EditIcon color="primary" />
        내 정보 수정
      </DialogTitle>

      <DialogContent sx={{ mt: 2 }}>
        {/* Stepper */}
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        {/* Step 1: 비밀번호 확인 */}
        {activeStep === 0 && (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <LockIcon color="action" />
              <Typography variant="body1">
                본인 확인을 위해 현재 비밀번호를 입력해주세요
              </Typography>
            </Box>
            <TextField
              label="현재 비밀번호"
              type="password"
              fullWidth
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleVerifyPassword()}
              autoFocus
            />
          </Box>
        )}

        {/* Step 2: 정보 수정 */}
        {activeStep === 1 && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              수정할 정보를 입력해주세요. 비밀번호를 변경하지 않으려면 비워두세요.
            </Typography>

            <TextField
              label="이름 *"
              fullWidth
              value={name}
              onChange={(e) => setName(e.target.value)}
              sx={{ mb: 2 }}
            />

            <TextField
              label="새 비밀번호"
              type="password"
              fullWidth
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="변경 시에만 입력"
              sx={{ mb: 2 }}
            />

            <TextField
              label="새 비밀번호 확인"
              type="password"
              fullWidth
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="변경 시에만 입력"
            />
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3, borderTop: '1px solid #eee' }}>
        <Button onClick={handleClose} color="inherit" disabled={loading}>
          취소
        </Button>

        {activeStep === 0 && (
          <Button
            onClick={handleVerifyPassword}
            variant="contained"
            color="primary"
            disabled={loading}
          >
            {loading ? '확인 중...' : '확인'}
          </Button>
        )}

        {activeStep === 1 && (
          <Button
            onClick={handleUpdateProfile}
            variant="contained"
            color="primary"
            disabled={loading}
          >
            {loading ? '저장 중...' : '저장'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default ProfileEditDialog;
