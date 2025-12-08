import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Box, Typography,
  TextField, Button, MenuItem, CircularProgress, FormControl, InputLabel, Select, Alert
} from '@mui/material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import EditIcon from '@mui/icons-material/Edit';
import { getBrandUsers } from '../../services/userService';
import { useAuth } from '../../context/AuthContext';

function SalesCampaignDialog({ open, onClose, onSave, mode = 'create', initialData = null }) {
  const { user } = useAuth();

  const emptyFormState = {
    name: '',
    description: '',
    status: 'active',
    start_date: '',
    end_date: '',
    brand_id: ''
  };

  const [formData, setFormData] = useState(emptyFormState);
  const [brandList, setBrandList] = useState([]);
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setError('');
      fetchBrandUsers();

      if (mode === 'edit' && initialData) {
        setFormData({
          name: initialData.name || '',
          description: initialData.description || '',
          status: initialData.status || 'active',
          start_date: initialData.start_date ? initialData.start_date.split('T')[0] : '',
          end_date: initialData.end_date ? initialData.end_date.split('T')[0] : '',
          brand_id: initialData.brand_id || ''
        });
      } else {
        setFormData(emptyFormState);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, initialData]);

  const fetchBrandUsers = async () => {
    setLoadingBrands(true);
    try {
      const response = await getBrandUsers();
      setBrandList(response.data || []);
    } catch (error) {
      console.error('브랜드사 목록 조회 실패:', error);
      setBrandList([]);
    } finally {
      setLoadingBrands(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSave = () => {
    if (!formData.name) {
      setError('캠페인명을 입력해주세요.');
      return;
    }

    if (!formData.brand_id) {
      setError('브랜드사를 선택해주세요.');
      return;
    }

    const campaignData = {
      ...formData,
      brand_id: parseInt(formData.brand_id, 10),
      created_by: user?.id
    };

    onSave(campaignData);
  };

  const isEdit = mode === 'edit';

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 'bold', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 1 }}>
        {isEdit ? <EditIcon color="primary" /> : <AddCircleIcon color="primary" />}
        {isEdit ? '캠페인 수정' : '캠페인 추가'}
      </DialogTitle>

      <DialogContent sx={{ mt: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {isEdit ? '캠페인 정보를 수정합니다.' : '새로운 캠페인을 생성합니다. 생성 후 품목을 추가할 수 있습니다.'}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* 캠페인명 */}
        <Box sx={{ mb: 2 }}>
          <TextField
            label="캠페인명 *"
            name="name"
            fullWidth
            value={formData.name}
            onChange={handleInputChange}
            placeholder="예: 여름 신상품 리뷰 캠페인"
          />
        </Box>

        {/* 설명 */}
        <Box sx={{ mb: 2 }}>
          <TextField
            label="설명"
            name="description"
            fullWidth
            multiline
            rows={3}
            value={formData.description}
            onChange={handleInputChange}
            placeholder="캠페인에 대한 간단한 설명을 입력하세요"
          />
        </Box>

        {/* 시작일, 종료일 */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField
            label="시작일"
            name="start_date"
            type="date"
            fullWidth
            value={formData.start_date}
            onChange={handleInputChange}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="종료일"
            name="end_date"
            type="date"
            fullWidth
            value={formData.end_date}
            onChange={handleInputChange}
            InputLabelProps={{ shrink: true }}
          />
        </Box>

        {/* 상태, 브랜드사 */}
        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControl fullWidth>
            <InputLabel id="status-label">상태</InputLabel>
            <Select
              labelId="status-label"
              name="status"
              value={formData.status}
              label="상태"
              onChange={handleInputChange}
            >
              <MenuItem value="active">진행 중</MenuItem>
              <MenuItem value="completed">완료</MenuItem>
              <MenuItem value="cancelled">취소</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth disabled={loadingBrands}>
            <InputLabel id="brand-label">브랜드사 *</InputLabel>
            <Select
              labelId="brand-label"
              name="brand_id"
              value={formData.brand_id}
              label="브랜드사 *"
              onChange={handleInputChange}
              endAdornment={loadingBrands ? <CircularProgress size={20} sx={{ mr: 2 }} /> : null}
            >
              <MenuItem value="" disabled>
                브랜드사를 선택하세요
              </MenuItem>
              {brandList.map((brand) => (
                <MenuItem key={brand.id} value={brand.id}>
                  {brand.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3, borderTop: '1px solid #eee' }}>
        <Button onClick={onClose} color="inherit" size="large">
          취소
        </Button>
        <Button onClick={handleSave} variant="contained" color="primary" size="large" disableElevation>
          {isEdit ? '수정하기' : '추가하기'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default SalesCampaignDialog;
