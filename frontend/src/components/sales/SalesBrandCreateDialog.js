import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Box, Typography, Alert
} from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { createBrand } from '../../services/userService';

function SalesBrandCreateDialog({ open, onClose, onSuccess, viewAsUserId = null }) {
  const initialFormState = {
    username: '',
    password: '',
    name: '',
    phone: ''
  };

  const [formData, setFormData] = useState(initialFormState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleClose = () => {
    setFormData(initialFormState);
    setError('');
    onClose();
  };

  const handleSubmit = async () => {
    // 필수 필드 검증
    if (!formData.username || !formData.password || !formData.name) {
      setError('필수 필드를 모두 입력해주세요');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 브랜드 사용자 생성 (서버에서 자동으로 영업사에 할당됨)
      // Admin이 영업사 대신 생성하는 경우 viewAsUserId 전달
      await createBrand(formData, viewAsUserId);
      alert('브랜드가 등록되었습니다');
      handleClose();
      if (onSuccess) onSuccess();
    } catch (err) {
      // 409 상태코드는 브랜드명 중복
      if (err.response?.status === 409) {
        setError(err.response?.data?.error || '이미 존재하는 브랜드 이름입니다.');
      } else {
        const message = err.response?.data?.message || '브랜드 등록 중 오류가 발생했습니다';
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={(event, reason) => { if (reason !== 'backdropClick') handleClose(); }} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 'bold', borderBottom: '1px solid #eee' }}>
        <PersonAddIcon color="primary" />
        브랜드 등록
      </DialogTitle>

      <DialogContent sx={{ mt: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          새로운 브랜드를 등록합니다. 등록한 브랜드는 캠페인 생성 시 선택할 수 있습니다.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* 1행: 브랜드명, 로그인 ID */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField
            label="브랜드명 *"
            name="name"
            fullWidth
            value={formData.name}
            onChange={handleInputChange}
            placeholder="예: 삼성전자"
          />
          <TextField
            label="로그인 ID *"
            name="username"
            fullWidth
            value={formData.username}
            onChange={handleInputChange}
            placeholder="예: samsung"
          />
        </Box>

        {/* 2행: 비밀번호 */}
        <Box sx={{ mb: 2 }}>
          <TextField
            label="비밀번호 *"
            name="password"
            type="password"
            fullWidth
            value={formData.password}
            onChange={handleInputChange}
          />
        </Box>

        {/* 3행: 전화번호 */}
        <Box sx={{ mb: 2 }}>
          <TextField
            label="전화번호"
            name="phone"
            fullWidth
            value={formData.phone}
            onChange={handleInputChange}
            placeholder="예: 010-1234-5678"
          />
        </Box>

        <Typography variant="caption" color="text.secondary">
          * 등록한 브랜드는 자동으로 귀하가 담당하게 됩니다.
        </Typography>
      </DialogContent>

      <DialogActions sx={{ p: 3, borderTop: '1px solid #eee' }}>
        <Button onClick={handleClose} color="inherit" disabled={loading}>
          취소
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          color="primary"
          disabled={loading}
        >
          {loading ? '등록 중...' : '등록하기'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default SalesBrandCreateDialog;
