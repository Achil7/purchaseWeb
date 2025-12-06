import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Typography,
  TextField, Grid, Button, MenuItem
} from '@mui/material';
import AddCircleIcon from '@mui/icons-material/AddCircle';

function SalesAddItemDialog({ open, onClose, onSave, campaignId }) {
  const initialFormState = {
    name: '',
    description: '',
    status: 'active',
    shipping_type: '실출고',
    target_keyword: '',
    total_purchase_count: '',
    daily_purchase_count: '',
    product_url: '',
    purchase_option: '',
    product_price: '',
    shipping_deadline: '18:00',
    review_guide: '',
    delivery_service: true,
    notes: ''
  };

  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    if (open) {
      // 다이얼로그가 열릴 때 폼 초기화
      setFormData(initialFormState);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSave = () => {
    if (!formData.name) {
      alert("품목명을 입력해주세요.");
      return;
    }

    const itemData = {
      ...formData,
      total_purchase_count: parseInt(formData.total_purchase_count) || 0,
      daily_purchase_count: parseInt(formData.daily_purchase_count) || 0,
      product_price: parseInt(formData.product_price) || 0
    };

    onSave(itemData);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle sx={{ fontWeight: 'bold', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 1 }}>
        <AddCircleIcon color="success" />
        품목 추가
      </DialogTitle>

      <DialogContent sx={{ mt: 2 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
          캠페인에 새로운 품목을 추가합니다. 품목 생성 시 이미지 업로드 링크가 자동으로 생성됩니다.
        </Typography>

        <Grid container spacing={2}>
          {/* 기본 정보 */}
          <Grid item xs={12}>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>기본 정보</Typography>
          </Grid>

          <Grid item xs={6}>
            <TextField
              label="품목명 *"
              name="name"
              fullWidth
              value={formData.name}
              onChange={handleInputChange}
              placeholder="예: 무선 이어폰 A100"
            />
          </Grid>

          <Grid item xs={6}>
            <TextField
              label="상태"
              name="status"
              fullWidth
              select
              value={formData.status}
              onChange={handleInputChange}
            >
              <MenuItem value="active">진행 중</MenuItem>
              <MenuItem value="completed">완료</MenuItem>
              <MenuItem value="cancelled">취소</MenuItem>
            </TextField>
          </Grid>

          <Grid item xs={12}>
            <TextField
              label="설명"
              name="description"
              fullWidth
              multiline
              rows={2}
              value={formData.description}
              onChange={handleInputChange}
              placeholder="품목에 대한 간단한 설명"
            />
          </Grid>

          {/* 제품 정보 */}
          <Grid item xs={12} sx={{ mt: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>제품 정보</Typography>
          </Grid>

          <Grid item xs={4}>
            <TextField
              label="제품 미출고/실출고 *"
              name="shipping_type"
              fullWidth
              select
              value={formData.shipping_type}
              onChange={handleInputChange}
            >
              <MenuItem value="미출고">미출고</MenuItem>
              <MenuItem value="실출고">실출고</MenuItem>
            </TextField>
          </Grid>

          <Grid item xs={4}>
            <TextField
              label="제품 구매 가격 (원)"
              name="product_price"
              fullWidth
              type="number"
              value={formData.product_price}
              onChange={handleInputChange}
              placeholder="예: 59000"
            />
          </Grid>

          <Grid item xs={4}>
            <TextField
              label="출고 마감 시간"
              name="shipping_deadline"
              fullWidth
              value={formData.shipping_deadline}
              onChange={handleInputChange}
              placeholder="예: 18:00"
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              label="상품 확인 URL"
              name="product_url"
              fullWidth
              value={formData.product_url}
              onChange={handleInputChange}
              placeholder="https://example.com/product/..."
            />
          </Grid>

          <Grid item xs={6}>
            <TextField
              label="구매 옵션"
              name="purchase_option"
              fullWidth
              value={formData.purchase_option}
              onChange={handleInputChange}
              placeholder="예: 블랙 / 기본"
            />
          </Grid>

          <Grid item xs={6}>
            <TextField
              label="택배대행 Y/N"
              name="delivery_service"
              fullWidth
              select
              value={formData.delivery_service}
              onChange={handleInputChange}
            >
              <MenuItem value={true}>Y (사용)</MenuItem>
              <MenuItem value={false}>N (미사용)</MenuItem>
            </TextField>
          </Grid>

          {/* 캠페인 정보 */}
          <Grid item xs={12} sx={{ mt: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>캠페인 정보</Typography>
          </Grid>

          <Grid item xs={12}>
            <TextField
              label="희망 유입 키워드"
              name="target_keyword"
              fullWidth
              value={formData.target_keyword}
              onChange={handleInputChange}
              placeholder="예: 무선이어폰 블루투스이어폰 고음질"
              helperText="키워드를 공백으로 구분하여 입력하세요"
            />
          </Grid>

          <Grid item xs={6}>
            <TextField
              label="총 구매 건수"
              name="total_purchase_count"
              fullWidth
              type="number"
              value={formData.total_purchase_count}
              onChange={handleInputChange}
              placeholder="예: 100"
            />
          </Grid>

          <Grid item xs={6}>
            <TextField
              label="일 구매 건수"
              name="daily_purchase_count"
              fullWidth
              type="number"
              value={formData.daily_purchase_count}
              onChange={handleInputChange}
              placeholder="예: 10"
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              label="리뷰가이드 및 소구점"
              name="review_guide"
              fullWidth
              multiline
              rows={3}
              value={formData.review_guide}
              onChange={handleInputChange}
              placeholder="리뷰 작성 시 포함해야 할 내용이나 소구점을 입력하세요"
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              label="비고"
              name="notes"
              fullWidth
              multiline
              rows={2}
              value={formData.notes}
              onChange={handleInputChange}
              placeholder="기타 특이사항이나 참고사항"
            />
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ p: 3, borderTop: '1px solid #eee' }}>
        <Button onClick={onClose} color="inherit" size="large">
          취소
        </Button>
        <Button onClick={handleSave} variant="contained" color="success" size="large" disableElevation>
          추가하기
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default SalesAddItemDialog;
