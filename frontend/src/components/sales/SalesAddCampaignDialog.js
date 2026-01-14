import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Box, Typography,
  TextField, Button, MenuItem, CircularProgress, FormControl, InputLabel, Select, Alert,
  Autocomplete
} from '@mui/material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import EditIcon from '@mui/icons-material/Edit';
import { getMyBrands, getSalesUsers, getBrandsBySalesId } from '../../services/userService';
import { monthlyBrandService } from '../../services';
import { useAuth } from '../../context/AuthContext';

function SalesCampaignDialog({ open, onClose, onSave, mode = 'create', initialData = null, preSelectedMonthlyBrandId = null, viewAsUserId = null }) {
  const { user } = useAuth();

  // 오늘 날짜를 기본값으로 설정
  const today = new Date().toISOString().split('T')[0];

  const isAdmin = user?.role === 'admin';
  // Admin이 영업사 대시보드를 보고 있을 때는 해당 영업사로 생성
  const effectiveUserId = viewAsUserId || user?.id;

  const emptyFormState = {
    name: '',  // 캠페인명 (영업사 직접 입력)
    registered_at: today,
    description: '',
    status: 'new',  // 기본값: 신규
    start_date: '',
    end_date: '',
    brand_id: '',
    sales_id: '',  // Admin이 선택할 영업사 ID
    monthly_brand_id: ''  // 연월브랜드 ID
  };

  const [formData, setFormData] = useState(emptyFormState);
  const [brandList, setBrandList] = useState([]);
  const [salesList, setSalesList] = useState([]);  // 영업사 목록
  const [monthlyBrandList, setMonthlyBrandList] = useState([]);  // 연월브랜드 목록
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [loadingSales, setLoadingSales] = useState(false);
  const [loadingMonthlyBrands, setLoadingMonthlyBrands] = useState(false);
  const [error, setError] = useState('');

  // 다이얼로그가 열릴 때 데이터 로드
  useEffect(() => {
    if (open) {
      setError('');

      // 연월브랜드 목록 로드
      fetchMonthlyBrands();

      // Admin인 경우 영업사 목록 조회, Sales인 경우 담당 브랜드 조회
      if (isAdmin) {
        fetchSalesUsers();
        // Admin은 영업사 선택 후 브랜드 로드
        setBrandList([]);
      } else {
        fetchMyBrands();
      }

      if (mode === 'edit' && initialData) {
        setFormData({
          name: initialData.name || '',
          registered_at: initialData.registered_at ? initialData.registered_at.split('T')[0] : today,
          description: initialData.description || '',
          status: initialData.status || 'active',
          start_date: initialData.start_date ? initialData.start_date.split('T')[0] : '',
          end_date: initialData.end_date ? initialData.end_date.split('T')[0] : '',
          brand_id: initialData.brand_id || '',
          sales_id: initialData.created_by || '',
          monthly_brand_id: initialData.monthly_brand_id || ''
        });
        // 수정 모드에서 영업사가 있으면 해당 브랜드 로드
        if (isAdmin && initialData.created_by) {
          fetchBrandsBySales(initialData.created_by);
        }
      } else {
        // 새 캠페인 생성 시 preSelectedMonthlyBrandId가 있으면 설정
        const initialMonthlyBrandId = preSelectedMonthlyBrandId || '';
        setFormData({ ...emptyFormState, registered_at: today, monthly_brand_id: initialMonthlyBrandId });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, initialData, isAdmin, preSelectedMonthlyBrandId]);

  // preSelectedMonthlyBrandId가 있고 연월브랜드 목록이 로드되면 브랜드 자동 선택
  useEffect(() => {
    if (!open || !preSelectedMonthlyBrandId || monthlyBrandList.length === 0) {
      return;
    }

    const selectedMb = monthlyBrandList.find(mb => mb.id === preSelectedMonthlyBrandId);
    if (selectedMb && selectedMb.brand_id) {
      // 브랜드 ID가 아직 설정되지 않았거나 비어있을 때만 자동 선택
      setFormData(prev => {
        if (!prev.brand_id) {
          return { ...prev, brand_id: selectedMb.brand_id };
        }
        return prev;
      });
    }
  }, [open, preSelectedMonthlyBrandId, monthlyBrandList]);

  const fetchMyBrands = async () => {
    setLoadingBrands(true);
    try {
      // 담당 브랜드만 조회 (영업사는 자신이 담당하는 브랜드만, Admin은 모든 브랜드)
      const response = await getMyBrands();
      setBrandList(response.data || []);
    } catch (error) {
      console.error('브랜드사 목록 조회 실패:', error);
      setBrandList([]);
    } finally {
      setLoadingBrands(false);
    }
  };

  const fetchMonthlyBrands = async () => {
    setLoadingMonthlyBrands(true);
    try {
      const response = await monthlyBrandService.getMonthlyBrands();
      setMonthlyBrandList(response.data || []);
    } catch (error) {
      console.error('연월브랜드 목록 조회 실패:', error);
      setMonthlyBrandList([]);
    } finally {
      setLoadingMonthlyBrands(false);
    }
  };

  const fetchSalesUsers = async () => {
    setLoadingSales(true);
    try {
      const response = await getSalesUsers();
      setSalesList(response.data || []);
    } catch (error) {
      console.error('영업사 목록 조회 실패:', error);
      setSalesList([]);
    } finally {
      setLoadingSales(false);
    }
  };

  // Admin용: 특정 영업사의 브랜드 목록 조회
  const fetchBrandsBySales = async (salesId) => {
    setLoadingBrands(true);
    try {
      const response = await getBrandsBySalesId(salesId);
      setBrandList(response.data || []);
    } catch (error) {
      console.error('영업사 담당 브랜드 조회 실패:', error);
      setBrandList([]);
    } finally {
      setLoadingBrands(false);
    }
  };

  // 영업사 선택 시 해당 영업사의 브랜드 로드
  const handleSalesChange = (newValue) => {
    const salesId = newValue ? newValue.id : '';
    setFormData({ ...formData, sales_id: salesId, brand_id: '' }); // 브랜드 초기화

    if (salesId) {
      fetchBrandsBySales(salesId);
    } else {
      setBrandList([]);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSave = () => {
    if (!formData.name || !formData.name.trim()) {
      setError('캠페인명을 입력해주세요.');
      return;
    }

    if (!formData.registered_at) {
      setError('등록 날짜를 선택해주세요.');
      return;
    }

    // Admin인 경우 영업사 선택 필수
    if (isAdmin && !formData.sales_id) {
      setError('영업사를 선택해주세요.');
      return;
    }

    if (!formData.brand_id) {
      setError('브랜드사를 선택해주세요.');
      return;
    }

    const brandId = typeof formData.brand_id === 'number' ? formData.brand_id : parseInt(formData.brand_id, 10);
    const salesId = typeof formData.sales_id === 'number' ? formData.sales_id : parseInt(formData.sales_id, 10);
    const monthlyBrandId = formData.monthly_brand_id ?
      (typeof formData.monthly_brand_id === 'number' ? formData.monthly_brand_id : parseInt(formData.monthly_brand_id, 10)) : null;

    const campaignData = {
      ...formData,
      name: formData.name.trim(),
      brand_id: brandId,
      monthly_brand_id: monthlyBrandId,
      // viewAsUserId가 있으면 해당 영업사로, Admin이 직접 선택한 경우 salesId, 그 외 자기 자신
      created_by: viewAsUserId || (isAdmin ? salesId : user?.id)
    };

    // sales_id는 서버에 보낼 필요 없음
    delete campaignData.sales_id;

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
          {isEdit ? '캠페인 정보를 수정합니다.' : '새로운 캠페인을 생성합니다. 생성 후 제품을 추가할 수 있습니다.'}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* 캠페인명 입력 */}
        <Box sx={{ mb: 2 }}>
          <TextField
            label="캠페인명 *"
            name="name"
            fullWidth
            value={formData.name}
            onChange={handleInputChange}
            placeholder="캠페인명을 입력하세요"
            autoFocus
          />
        </Box>

        {/* Admin일 때만 영업사 선택 드롭다운 표시 (검색 가능) */}
        {isAdmin && (
          <Box sx={{ mb: 2 }}>
            <Autocomplete
              options={salesList}
              getOptionLabel={(option) => option ? `${option.name} (${option.username})` : ''}
              value={salesList.find(s => s.id === formData.sales_id) || null}
              onChange={(event, newValue) => handleSalesChange(newValue)}
              loading={loadingSales}
              isOptionEqualToValue={(option, value) => option.id === value?.id}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="영업사 *"
                  placeholder="영업사 검색..."
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {loadingSales ? <CircularProgress size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              noOptionsText="검색 결과가 없습니다"
            />
            {salesList.length === 0 && !loadingSales && (
              <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                등록된 영업사가 없습니다.
              </Typography>
            )}
          </Box>
        )}

        {/* 등록 날짜 */}
        <Box sx={{ mb: 2 }}>
          <TextField
            label="등록 날짜 *"
            name="registered_at"
            type="date"
            fullWidth
            value={formData.registered_at}
            onChange={handleInputChange}
            InputLabelProps={{ shrink: true }}
            helperText="캠페인이 등록된 날짜 (자동 저장됨)"
          />
        </Box>

        {/* 브랜드사 - Admin은 검색 가능, Sales는 일반 Select */}
        <Box sx={{ mb: 2 }}>
          {isAdmin ? (
            <>
              <Autocomplete
                options={brandList}
                getOptionLabel={(option) => option ? option.name : ''}
                value={brandList.find(b => b.id === formData.brand_id) || null}
                onChange={(event, newValue) => {
                  setFormData({ ...formData, brand_id: newValue ? newValue.id : '' });
                }}
                loading={loadingBrands}
                isOptionEqualToValue={(option, value) => option.id === value?.id}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="브랜드사 *"
                    placeholder="브랜드사 검색..."
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {loadingBrands ? <CircularProgress size={20} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
                noOptionsText="검색 결과가 없습니다"
              />
              {brandList.length === 0 && !loadingBrands && formData.sales_id && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                  해당 영업사에 등록된 브랜드가 없습니다.
                </Typography>
              )}
              {!formData.sales_id && !loadingBrands && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  영업사를 먼저 선택하세요.
                </Typography>
              )}
            </>
          ) : (
            <>
              <FormControl fullWidth disabled={loadingBrands}>
                <InputLabel id="brand-label">브랜드사 *</InputLabel>
                <Select
                  labelId="brand-label"
                  name="brand_id"
                  value={formData.brand_id || ''}
                  label="브랜드사 *"
                  onChange={(e) => setFormData({ ...formData, brand_id: e.target.value })}
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
              {brandList.length === 0 && !loadingBrands && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                  담당 브랜드가 없습니다. 관리자에게 문의하세요.
                </Typography>
              )}
            </>
          )}
        </Box>

        {/* 연월브랜드 선택 */}
        <Box sx={{ mb: 2 }}>
          <FormControl fullWidth disabled={loadingMonthlyBrands || !!preSelectedMonthlyBrandId}>
            <InputLabel id="monthly-brand-label">
              {preSelectedMonthlyBrandId ? '연월브랜드' : '연월브랜드 (선택)'}
            </InputLabel>
            <Select
              labelId="monthly-brand-label"
              name="monthly_brand_id"
              value={formData.monthly_brand_id}
              label={preSelectedMonthlyBrandId ? '연월브랜드' : '연월브랜드 (선택)'}
              onChange={handleInputChange}
              endAdornment={loadingMonthlyBrands ? <CircularProgress size={20} sx={{ mr: 2 }} /> : null}
            >
              <MenuItem value="">
                연월브랜드 선택 안함
              </MenuItem>
              {monthlyBrandList.map((mb) => (
                <MenuItem key={mb.id} value={mb.id}>
                  {mb.name} {mb.brand?.name ? `(${mb.brand.name})` : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {preSelectedMonthlyBrandId ? (
            <Typography variant="caption" color="primary" sx={{ mt: 0.5, display: 'block' }}>
              이 캠페인은 선택된 연월브랜드에 추가됩니다
            </Typography>
          ) : (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              연월브랜드를 선택하면 해당 월의 캠페인으로 그룹화됩니다 (예: 2512어댑트)
            </Typography>
          )}
        </Box>

        {/* 설명 */}
        <Box sx={{ mb: 2 }}>
          <TextField
            label="설명"
            name="description"
            fullWidth
            multiline
            rows={2}
            value={formData.description}
            onChange={handleInputChange}
            placeholder="캠페인에 대한 간단한 설명을 입력하세요"
          />
        </Box>

        {/* 시작일, 종료일, 상태 */}
        <Box sx={{ display: 'flex', gap: 2 }}>
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
          <FormControl fullWidth>
            <InputLabel id="status-label">상태</InputLabel>
            <Select
              labelId="status-label"
              name="status"
              value={formData.status}
              label="상태"
              onChange={handleInputChange}
            >
              <MenuItem value="new">신규</MenuItem>
              <MenuItem value="hold">보류</MenuItem>
              {/* Admin만 진행 중/완료/취소 선택 가능 */}
              {isAdmin && <MenuItem value="active">진행 중</MenuItem>}
              {isAdmin && <MenuItem value="completed">완료</MenuItem>}
              {isAdmin && <MenuItem value="cancelled">취소</MenuItem>}
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
