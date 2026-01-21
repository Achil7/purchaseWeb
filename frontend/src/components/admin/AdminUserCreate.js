import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Box, MenuItem, FormControlLabel, Checkbox,
  Typography, Alert, FormControl, InputLabel, Select
} from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { createUser, getSalesUsers } from '../../services/userService';

const roleOptions = [
  { value: 'admin', label: '관리자' },
  { value: 'sales', label: '영업사' },
  { value: 'operator', label: '진행자' },
  { value: 'brand', label: '브랜드사' }
];

function AdminUserCreate({ open, onClose, onSuccess }) {
  const initialFormState = {
    username: '',
    password: '',
    name: '',
    role: '',
    phone: '',
    is_active: true,
    assigned_sales_id: ''
  };

  const [formData, setFormData] = useState(initialFormState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [salesUsers, setSalesUsers] = useState([]);

  // 다이얼로그 열릴 때 영업사 목록 로드
  useEffect(() => {
    if (open) {
      loadSalesUsers();
    }
  }, [open]);

  const loadSalesUsers = async () => {
    try {
      const response = await getSalesUsers();
      setSalesUsers(response.data || []);
    } catch (err) {
      console.error('Failed to load sales users:', err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleClose = () => {
    setFormData(initialFormState);
    setError('');
    onClose();
  };

  const handleSubmit = async () => {
    // 필수 필드 검증
    if (!formData.username || !formData.password || !formData.name || !formData.role) {
      setError('필수 필드를 모두 입력해주세요');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await createUser(formData);
      alert('사용자가 생성되었습니다');
      handleClose();
      if (onSuccess) onSuccess();
    } catch (err) {
      const message = err.response?.data?.message || '사용자 생성 중 오류가 발생했습니다';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={(event, reason) => { if (reason !== 'backdropClick') handleClose(); }} fullWidth maxWidth="md">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 'bold', borderBottom: '1px solid #eee' }}>
        <PersonAddIcon color="primary" />
        사용자 등록
      </DialogTitle>

      <DialogContent sx={{ mt: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          새로운 사용자를 등록합니다. * 표시는 필수 입력 항목입니다.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* 1행: 사용자명, 비밀번호, 이름 */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField
            label="사용자명 (로그인 ID) *"
            name="username"
            fullWidth
            value={formData.username}
            onChange={handleInputChange}
            placeholder="예: sales01"
          />
          <TextField
            label="비밀번호 *"
            name="password"
            type="password"
            fullWidth
            value={formData.password}
            onChange={handleInputChange}
          />
          <TextField
            label="이름 *"
            name="name"
            fullWidth
            value={formData.name}
            onChange={handleInputChange}
            placeholder="예: 홍길동"
          />
        </Box>

        {/* 2행: 역할, 전화번호 */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <FormControl fullWidth>
            <InputLabel id="role-label">역할 *</InputLabel>
            <Select
              labelId="role-label"
              name="role"
              value={formData.role}
              label="역할 *"
              onChange={handleInputChange}
            >
              <MenuItem value="" disabled>
                역할을 선택하세요
              </MenuItem>
              {roleOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="전화번호"
            name="phone"
            fullWidth
            value={formData.phone}
            onChange={handleInputChange}
            placeholder="예: 010-1234-5678"
          />
        </Box>

        {/* 3행: 브랜드사 선택 시 담당 영업사 선택 */}
        {formData.role === 'brand' && (
          <Box sx={{ mb: 2 }}>
            <FormControl fullWidth>
              <InputLabel id="sales-label">담당 영업사</InputLabel>
              <Select
                labelId="sales-label"
                name="assigned_sales_id"
                value={formData.assigned_sales_id}
                label="담당 영업사"
                onChange={handleInputChange}
              >
                <MenuItem value="">
                  선택 안함
                </MenuItem>
                {salesUsers.filter(u => u.is_active).map((user) => (
                  <MenuItem key={user.id} value={user.id}>
                    {user.name} ({user.username})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              담당 영업사를 선택하면, 해당 영업사만 이 브랜드를 캠페인에 선택할 수 있습니다.
            </Typography>
          </Box>
        )}

        {/* 4행: 활성화 상태 */}
        <Box>
          <FormControlLabel
            control={
              <Checkbox
                name="is_active"
                checked={formData.is_active}
                onChange={handleInputChange}
              />
            }
            label="활성화 상태"
          />
        </Box>
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

export default AdminUserCreate;
