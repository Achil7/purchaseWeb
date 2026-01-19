import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Box, Typography,
  TextField, Button, MenuItem, CircularProgress, Alert,
  Autocomplete
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import FolderIcon from '@mui/icons-material/Folder';
import InventoryIcon from '@mui/icons-material/Inventory';
import { getSalesUsers, getBrandsBySalesId } from '../../services/userService';
import { itemService } from '../../services';

// UTC+9 현재 시간을 YYYY-MM-DDTHH:mm 형식으로 반환
const getKoreanDateTime = () => {
  const now = new Date();
  const kstOffset = 9 * 60;
  const kstTime = new Date(now.getTime() + (kstOffset + now.getTimezoneOffset()) * 60000);
  const year = kstTime.getFullYear();
  const month = String(kstTime.getMonth() + 1).padStart(2, '0');
  const day = String(kstTime.getDate()).padStart(2, '0');
  const hours = String(kstTime.getHours()).padStart(2, '0');
  const minutes = String(kstTime.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

function AdminEditDialog({ open, onClose, onSave, campaign, item }) {
  const today = new Date().toISOString().split('T')[0];

  // 캠페인 폼 상태
  const [campaignForm, setCampaignForm] = useState({
    registered_at: today,
    description: '',
    status: 'active',
    start_date: '',
    end_date: '',
    brand_id: '',
    sales_id: ''
  });

  // 제품 폼 상태
  const [itemForm, setItemForm] = useState({
    product_name: '',
    status: 'active',
    shipping_type: '실출고',
    keyword: '',
    total_purchase_count: '',
    daily_purchase_count: '',
    product_url: '',
    purchase_option: '',
    product_price: '',
    shipping_deadline: '',
    review_guide: '',
    courier_service_yn: '',
    notes: '',
    registered_at: getKoreanDateTime()
  });

  const [brandList, setBrandList] = useState([]);
  const [salesList, setSalesList] = useState([]);
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [loadingSales, setLoadingSales] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // 다이얼로그 열릴 때 데이터 fetch
  useEffect(() => {
    if (open) {
      setError('');
      // 영업사 선택 후에만 브랜드 로드하므로 초기화
      setBrandList([]);
      fetchSalesUsers();
    }
  }, [open]);

  // 캠페인 데이터 로드 (campaign 또는 open 변경 시)
  useEffect(() => {
    if (open && campaign) {
      setCampaignForm({
        registered_at: campaign.registered_at ? campaign.registered_at.split('T')[0] : today,
        description: campaign.description || '',
        status: campaign.status || 'active',
        start_date: campaign.start_date ? campaign.start_date.split('T')[0] : '',
        end_date: campaign.end_date ? campaign.end_date.split('T')[0] : '',
        brand_id: campaign.brand_id || '',
        sales_id: campaign.created_by || ''
      });
      // 영업사가 있으면 해당 영업사의 브랜드 로드
      if (campaign.created_by) {
        fetchBrandsBySales(campaign.created_by);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, campaign, today]);

  // 제품 데이터 로드 (item 또는 open 변경 시)
  useEffect(() => {
    if (open && item) {
      let registeredAt = item.registered_at || getKoreanDateTime();
      if (registeredAt && registeredAt.includes('T')) {
        registeredAt = registeredAt.slice(0, 16);
      }
      setItemForm({
        product_name: item.product_name || '',
        status: item.status || 'active',
        shipping_type: item.shipping_type || '실출고',
        keyword: item.keyword || '',
        total_purchase_count: item.total_purchase_count || '',
        daily_purchase_count: item.daily_purchase_count || '',
        product_url: item.product_url || '',
        purchase_option: item.purchase_option || '',
        product_price: item.product_price || '',
        shipping_deadline: item.shipping_deadline || '',
        review_guide: item.review_guide || '',
        courier_service_yn: item.courier_service_yn || '',
        notes: item.notes || '',
        registered_at: registeredAt
      });
    }
  }, [open, item]);

  // 특정 영업사의 브랜드 목록 조회
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

  const fetchSalesUsers = async () => {
    setLoadingSales(true);
    try {
      const response = await getSalesUsers();
      setSalesList(response.data || []);
    } catch (error) {
      console.error('영업사 목록 조회 실패:', error);
    } finally {
      setLoadingSales(false);
    }
  };

  // 영업사 선택 시 해당 영업사의 브랜드 로드
  const handleSalesChange = (newValue) => {
    const salesId = newValue ? newValue.id : '';
    setCampaignForm({ ...campaignForm, sales_id: salesId, brand_id: '' }); // 브랜드 초기화
    if (salesId) {
      fetchBrandsBySales(salesId);
    } else {
      setBrandList([]);
    }
  };

  const handleCampaignChange = (e) => {
    const { name, value } = e.target;
    setCampaignForm({ ...campaignForm, [name]: value });
  };

  const handleItemChange = (e) => {
    const { name, value, type, checked } = e.target;
    setItemForm({
      ...itemForm,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSave = async () => {
    // 캠페인 검증
    if (!campaignForm.brand_id) {
      setError('브랜드사를 선택해주세요.');
      return;
    }

    // 제품 검증 (제품이 있는 경우)
    if (item && !itemForm.product_name) {
      setError('제품명을 입력해주세요.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      // 캠페인 데이터 준비
      const brandId = typeof campaignForm.brand_id === 'number' ? campaignForm.brand_id : parseInt(campaignForm.brand_id, 10);
      const selectedBrand = brandList.find(b => b.id === brandId);
      const brandName = selectedBrand ? selectedBrand.name : '브랜드';
      const dateStr = campaignForm.registered_at.replace(/-/g, '').slice(2);
      const autoName = `${dateStr}_${brandName}`;

      const campaignData = {
        ...campaignForm,
        name: autoName,
        brand_id: brandId,
        created_by: campaignForm.sales_id ? parseInt(campaignForm.sales_id, 10) : campaign?.created_by
      };
      delete campaignData.sales_id;

      // 제품 데이터 준비 (제품이 있는 경우)
      let itemData = null;
      if (item) {
        itemData = {
          product_name: itemForm.product_name,
          status: itemForm.status || 'active',
          shipping_type: itemForm.shipping_type || null,
          keyword: itemForm.keyword || null,
          total_purchase_count: itemForm.total_purchase_count ? parseInt(itemForm.total_purchase_count) : null,
          daily_purchase_count: itemForm.daily_purchase_count ? parseInt(itemForm.daily_purchase_count) : null,
          product_url: itemForm.product_url || null,
          purchase_option: itemForm.purchase_option || null,
          product_price: itemForm.product_price ? parseFloat(itemForm.product_price) : null,
          shipping_deadline: itemForm.shipping_deadline || null,
          review_guide: itemForm.review_guide || null,
          courier_service_yn: itemForm.courier_service_yn || null,
          notes: itemForm.notes || null,
          registered_at: itemForm.registered_at ? new Date(itemForm.registered_at).toISOString() : new Date().toISOString()
        };

        // 제품 업데이트
        await itemService.updateItem(item.id, itemData);
      }

      // 부모 컴포넌트에 캠페인 데이터 전달
      await onSave(campaignData);

    } catch (err) {
      console.error('저장 실패:', err);
      setError(err.response?.data?.message || '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle sx={{ fontWeight: 'bold', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 1 }}>
        <EditIcon color="primary" />
        통합 수정
      </DialogTitle>

      <DialogContent sx={{ mt: 2, px: 3, pb: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', gap: 2 }}>
          {/* 왼쪽: 캠페인 수정 */}
          <Box sx={{ flex: '0 0 340px', minWidth: 340 }}>
            <Box sx={{ p: 2, bgcolor: '#f5f5f5', borderRadius: 2, height: '100%' }}>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <FolderIcon color="primary" />
                캠페인 정보
              </Typography>

              {/* 영업사 선택 */}
              <Box sx={{ mb: 2 }}>
                <Autocomplete
                  options={salesList}
                  getOptionLabel={(option) => option ? `${option.name} (${option.username})` : ''}
                  value={salesList.find(s => s.id === campaignForm.sales_id) || null}
                  onChange={(event, newValue) => handleSalesChange(newValue)}
                  loading={loadingSales}
                  isOptionEqualToValue={(option, value) => option.id === value?.id}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="영업사"
                      size="small"
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
                />
              </Box>

              {/* 등록 날짜 */}
              <Box sx={{ mb: 2 }}>
                <TextField
                  label="등록 날짜"
                  name="registered_at"
                  type="date"
                  fullWidth
                  size="small"
                  value={campaignForm.registered_at}
                  onChange={handleCampaignChange}
                  InputLabelProps={{ shrink: true }}
                />
              </Box>

              {/* 브랜드사 */}
              <Box sx={{ mb: 2 }}>
                <Autocomplete
                  options={brandList}
                  getOptionLabel={(option) => option ? option.name : ''}
                  value={brandList.find(b => b.id === campaignForm.brand_id) || null}
                  onChange={(event, newValue) => {
                    setCampaignForm({ ...campaignForm, brand_id: newValue ? newValue.id : '' });
                  }}
                  loading={loadingBrands}
                  isOptionEqualToValue={(option, value) => option.id === value?.id}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="브랜드사 *"
                      size="small"
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
                />
                {brandList.length === 0 && !loadingBrands && !campaignForm.sales_id && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    영업사를 먼저 선택하세요.
                  </Typography>
                )}
                {brandList.length === 0 && !loadingBrands && campaignForm.sales_id && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                    해당 영업사에 등록된 브랜드가 없습니다.
                  </Typography>
                )}
              </Box>

              {/* 설명 */}
              <Box sx={{ mb: 2 }}>
                <TextField
                  label="설명"
                  name="description"
                  fullWidth
                  size="small"
                  multiline
                  rows={2}
                  value={campaignForm.description}
                  onChange={handleCampaignChange}
                />
              </Box>

              {/* 시작일, 종료일 */}
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <TextField
                  label="시작일"
                  name="start_date"
                  type="date"
                  fullWidth
                  size="small"
                  value={campaignForm.start_date}
                  onChange={handleCampaignChange}
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  label="종료일"
                  name="end_date"
                  type="date"
                  fullWidth
                  size="small"
                  value={campaignForm.end_date}
                  onChange={handleCampaignChange}
                  InputLabelProps={{ shrink: true }}
                />
              </Box>

              {/* 상태 */}
              <TextField
                label="상태"
                name="status"
                fullWidth
                size="small"
                select
                value={campaignForm.status}
                onChange={handleCampaignChange}
              >
                <MenuItem value="active">진행 중</MenuItem>
                <MenuItem value="completed">완료</MenuItem>
                <MenuItem value="cancelled">취소</MenuItem>
              </TextField>
            </Box>
          </Box>

          {/* 오른쪽: 제품 수정 */}
          <Box sx={{ flex: 1 }}>
            <Box sx={{ p: 2, bgcolor: item ? '#e3f2fd' : '#f5f5f5', borderRadius: 2, height: '100%' }}>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <InventoryIcon color={item ? 'primary' : 'disabled'} />
                제품 정보
                {!item && <Typography variant="caption" color="text.secondary">(제품 없음)</Typography>}
              </Typography>

              {item ? (
                <>
                  {/* 제품명, 상태 */}
                  <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    <TextField
                      label="제품명 *"
                      name="product_name"
                      fullWidth
                      size="small"
                      value={itemForm.product_name}
                      onChange={handleItemChange}
                    />
                    <TextField
                      label="상태"
                      name="status"
                      select
                      size="small"
                      value={itemForm.status}
                      onChange={handleItemChange}
                      sx={{ minWidth: 120 }}
                    >
                      <MenuItem value="active">진행 중</MenuItem>
                      <MenuItem value="hold">보류</MenuItem>
                      <MenuItem value="completed">완료</MenuItem>
                      <MenuItem value="cancelled">취소</MenuItem>
                    </TextField>
                  </Box>

                  {/* 출고타입, 가격 */}
                  <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    <TextField
                      label="출고타입"
                      name="shipping_type"
                      select
                      size="small"
                      value={itemForm.shipping_type}
                      onChange={handleItemChange}
                      sx={{ minWidth: 100 }}
                    >
                      <MenuItem value="미출고">미출고</MenuItem>
                      <MenuItem value="실출고">실출고</MenuItem>
                    </TextField>
                    <TextField
                      label="제품 가격 (원)"
                      name="product_price"
                      type="number"
                      size="small"
                      fullWidth
                      value={itemForm.product_price}
                      onChange={handleItemChange}
                    />
                    <TextField
                      label="출고 마감"
                      name="shipping_deadline"
                      size="small"
                      value={itemForm.shipping_deadline}
                      onChange={handleItemChange}
                      placeholder="18:00"
                      sx={{ minWidth: 100 }}
                    />
                  </Box>

                  {/* 구매 옵션, 택배대행 */}
                  <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    <TextField
                      label="구매 옵션"
                      name="purchase_option"
                      size="small"
                      fullWidth
                      value={itemForm.purchase_option}
                      onChange={handleItemChange}
                    />
                    <TextField
                      label="택배대행"
                      name="courier_service_yn"
                      size="small"
                      value={itemForm.courier_service_yn}
                      onChange={handleItemChange}
                      sx={{ minWidth: 100 }}
                      placeholder="Y/N"
                    />
                  </Box>

                  {/* 상품 URL */}
                  <Box sx={{ mb: 2 }}>
                    <TextField
                      label="상품 URL"
                      name="product_url"
                      fullWidth
                      size="small"
                      value={itemForm.product_url}
                      onChange={handleItemChange}
                    />
                  </Box>

                  {/* 키워드 */}
                  <Box sx={{ mb: 2 }}>
                    <TextField
                      label="유입 키워드"
                      name="keyword"
                      fullWidth
                      size="small"
                      value={itemForm.keyword}
                      onChange={handleItemChange}
                    />
                  </Box>

                  {/* 구매 건수 */}
                  <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    <TextField
                      label="총 구매 건수"
                      name="total_purchase_count"
                      type="number"
                      size="small"
                      fullWidth
                      value={itemForm.total_purchase_count}
                      onChange={handleItemChange}
                    />
                    <TextField
                      label="일 구매 건수"
                      name="daily_purchase_count"
                      type="number"
                      size="small"
                      fullWidth
                      value={itemForm.daily_purchase_count}
                      onChange={handleItemChange}
                    />
                  </Box>

                  {/* 리뷰가이드 */}
                  <Box sx={{ mb: 2 }}>
                    <TextField
                      label="리뷰가이드"
                      name="review_guide"
                      fullWidth
                      size="small"
                      multiline
                      rows={2}
                      value={itemForm.review_guide}
                      onChange={handleItemChange}
                    />
                  </Box>

                  {/* 비고 */}
                  <TextField
                    label="비고"
                    name="notes"
                    fullWidth
                    size="small"
                    multiline
                    rows={2}
                    value={itemForm.notes}
                    onChange={handleItemChange}
                  />
                </>
              ) : (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300, color: '#999' }}>
                  <Typography>이 캠페인에는 제품이 없습니다.</Typography>
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3, borderTop: '1px solid #eee' }}>
        <Button onClick={onClose} color="inherit" size="large" disabled={saving}>
          취소
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          color="primary"
          size="large"
          disableElevation
          disabled={saving}
        >
          {saving ? <CircularProgress size={24} /> : '저장하기'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default AdminEditDialog;
