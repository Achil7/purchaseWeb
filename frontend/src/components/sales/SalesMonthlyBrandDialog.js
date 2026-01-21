import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Box, Typography, Alert, Autocomplete,
  Chip, CircularProgress
} from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AddIcon from '@mui/icons-material/Add';
import { monthlyBrandService } from '../../services';
import { getAllBrands, assignBrandToMe } from '../../services/userService';
import SalesBrandCreateDialog from './SalesBrandCreateDialog';

function SalesMonthlyBrandDialog({ open, onClose, onSuccess, viewAsUserId = null }) {
  const [formData, setFormData] = useState({
    name: '',
    brand_id: '',
    year_month: '',
    description: ''
  });
  const [allBrands, setAllBrands] = useState([]);    // 전체 브랜드 (검색용)
  const [monthlyBrandIds, setMonthlyBrandIds] = useState(new Set()); // 연월브랜드로 등록된 브랜드 ID
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [loading, setLoading] = useState(false);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [error, setError] = useState('');
  const [openBrandCreate, setOpenBrandCreate] = useState(false);

  // 현재 연월 자동 계산 (YYMM)
  const getCurrentYearMonth = () => {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    return yy + mm;
  };

  // 브랜드 목록 로드
  useEffect(() => {
    if (open) {
      loadBrands();
      // 연월 기본값 설정
      setFormData(prev => ({
        ...prev,
        year_month: getCurrentYearMonth()
      }));
    }
  }, [open]);

  const loadBrands = async () => {
    setBrandsLoading(true);
    try {
      // 전체 브랜드, 연월브랜드 동시 로드
      const [allBrandsRes, monthlyBrandsRes] = await Promise.all([
        getAllBrands(),
        monthlyBrandService.getMonthlyBrands(viewAsUserId)
      ]);
      setAllBrands(allBrandsRes.data || []);

      // 연월브랜드에 등록된 브랜드 ID 추출
      const mbIds = new Set((monthlyBrandsRes.data || []).map(mb => mb.brand_id));
      setMonthlyBrandIds(mbIds);
    } catch (err) {
      console.error('Failed to load brands:', err);
    } finally {
      setBrandsLoading(false);
    }
  };

  // 브랜드 옵션 생성 (내 브랜드 = 연월브랜드가 존재하는 브랜드 + 기타 브랜드)
  const getBrandOptions = () => {
    const options = [];
    const addedBrandIds = new Set();

    // 내 브랜드 = 연월브랜드가 존재하는 브랜드만
    allBrands.forEach(brand => {
      if (monthlyBrandIds.has(brand.id)) {
        options.push({
          ...brand,
          group: '내 브랜드',
          isMyBrand: true,
          hasMonthlyBrand: true
        });
        addedBrandIds.add(brand.id);
      }
    });

    // 기타 브랜드 (연월브랜드가 없는 모든 브랜드)
    allBrands.forEach(brand => {
      if (!addedBrandIds.has(brand.id)) {
        options.push({
          ...brand,
          group: '기타 브랜드',
          isMyBrand: false,
          hasMonthlyBrand: false
        });
      }
    });

    // 마지막에 "새 브랜드 등록" 옵션
    options.push({
      id: '__new__',
      name: '새 브랜드 등록',
      group: '추가',
      isNew: true
    });

    return options;
  };

  const handleBrandSelect = async (event, value) => {
    if (!value) {
      setSelectedBrand(null);
      setFormData(prev => ({ ...prev, brand_id: '', name: '' }));
      return;
    }

    // "새 브랜드 등록" 선택 시
    if (value.isNew) {
      setOpenBrandCreate(true);
      return;
    }

    setSelectedBrand(value);

    // 기타 브랜드 선택 시 자동으로 brand_sales에 할당 (연월브랜드 생성 시 필요)
    if (!value.isMyBrand) {
      try {
        await assignBrandToMe(value.id, viewAsUserId);
      } catch (err) {
        // 이미 할당된 경우도 성공으로 처리됨 (멱등성)
      }
    }

    // 폼 데이터 업데이트
    setFormData(prev => ({
      ...prev,
      brand_id: value.id,
      name: `${prev.year_month}${value.name}`
    }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // 연월 변경 시 이름 자동 업데이트
    if (name === 'year_month' && selectedBrand && !selectedBrand.isNew) {
      setFormData(prev => ({
        ...prev,
        year_month: value,
        name: `${value}${selectedBrand.name}`
      }));
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      brand_id: '',
      year_month: getCurrentYearMonth(),
      description: ''
    });
    setSelectedBrand(null);
    setError('');
    onClose();
  };

  const handleSubmit = async () => {
    // 필수 필드 검증
    if (!formData.brand_id || !formData.name) {
      setError('브랜드와 연월브랜드명을 입력해주세요');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Admin이 영업사 대신 생성하는 경우 viewAsUserId 전달
      await monthlyBrandService.createMonthlyBrand(formData, viewAsUserId);
      alert('연월브랜드가 등록되었습니다');
      handleClose();
      if (onSuccess) onSuccess();
    } catch (err) {
      const message = err.response?.data?.message || '연월브랜드 등록 중 오류가 발생했습니다';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // 새 브랜드 생성 성공 시
  const handleBrandCreateSuccess = (newBrand) => {
    // 브랜드 목록 새로고침
    loadBrands();
    // 새로 생성된 브랜드 자동 선택
    if (newBrand) {
      const brandOption = {
        ...newBrand,
        group: '내 브랜드',
        isMyBrand: true
      };
      setSelectedBrand(brandOption);
      setFormData(prev => ({
        ...prev,
        brand_id: newBrand.id,
        name: `${prev.year_month}${newBrand.name}`
      }));
    }
  };

  const brandOptions = getBrandOptions();

  return (
    <>
      <Dialog open={open} onClose={(event, reason) => { if (reason !== 'backdropClick') handleClose(); }} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 'bold', borderBottom: '1px solid #eee' }}>
          <CalendarMonthIcon color="primary" />
          연월브랜드 추가
        </DialogTitle>

        <DialogContent sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            브랜드를 검색하여 선택하거나 새로 등록하세요. (예: 2512어댑트)
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* 1행: 브랜드 검색 (Autocomplete), 연월 */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Autocomplete
              fullWidth
              options={brandOptions}
              groupBy={(option) => option.group}
              getOptionLabel={(option) => option.name || ''}
              value={selectedBrand}
              onChange={handleBrandSelect}
              loading={brandsLoading}
              isOptionEqualToValue={(option, value) => option.id === value?.id}
              filterOptions={(options, { inputValue }) => {
                const filtered = options.filter(option => {
                  if (option.isNew) return true; // 항상 "새 브랜드 등록" 표시
                  return option.name.toLowerCase().includes(inputValue.toLowerCase());
                });
                return filtered;
              }}
              renderOption={(props, option) => {
                const { key, ...otherProps } = props;
                if (option.isNew) {
                  return (
                    <li key={key} {...otherProps}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'primary.main' }}>
                        <AddIcon fontSize="small" />
                        <Typography fontWeight="bold">{option.name}</Typography>
                      </Box>
                    </li>
                  );
                }
                return (
                  <li key={key} {...otherProps}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {option.name}
                      {option.hasMonthlyBrand && (
                        <Chip label="담당" size="small" color="primary" variant="outlined" sx={{ height: 20, fontSize: 11 }} />
                      )}
                    </Box>
                  </li>
                );
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="브랜드 검색 *"
                  placeholder="브랜드명을 입력하세요"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {brandsLoading ? <CircularProgress color="inherit" size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
            <TextField
              label="연월 (YYMM)"
              name="year_month"
              value={formData.year_month}
              onChange={handleInputChange}
              placeholder="예: 2512"
              sx={{ width: 150 }}
              inputProps={{ maxLength: 4 }}
            />
          </Box>

          {/* 2행: 연월브랜드명 (자동 생성) */}
          <Box sx={{ mb: 2 }}>
            <TextField
              label="연월브랜드명 *"
              name="name"
              fullWidth
              value={formData.name}
              onChange={handleInputChange}
              placeholder="예: 2512어댑트"
              helperText="브랜드와 연월을 선택하면 자동 생성됩니다"
            />
          </Box>

          {/* 3행: 설명 (선택) */}
          <Box sx={{ mb: 2 }}>
            <TextField
              label="설명 (선택)"
              name="description"
              fullWidth
              multiline
              rows={2}
              value={formData.description}
              onChange={handleInputChange}
              placeholder="연월브랜드에 대한 설명을 입력하세요"
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

      {/* 브랜드 생성 다이얼로그 */}
      <SalesBrandCreateDialog
        open={openBrandCreate}
        onClose={() => setOpenBrandCreate(false)}
        onSuccess={handleBrandCreateSuccess}
        viewAsUserId={viewAsUserId}
      />
    </>
  );
}

export default SalesMonthlyBrandDialog;
