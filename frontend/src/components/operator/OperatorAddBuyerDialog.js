import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Box, Typography,
  TextField, Grid, Button, Alert
} from '@mui/material';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import EditIcon from '@mui/icons-material/Edit';

// [수정] props에 editData 추가
function OperatorAddBuyerDialog({ open, onClose, onSave, editData = null }) {
  const initialFormState = {
    order_number: '',
    buyer_name: '',
    recipient_name: '',
    user_id: '',
    contact: '',
    address: '',
    account_info: '',
    amount: ''
  };

  const [pasteInput, setPasteInput] = useState('');
  const [infoForm, setInfoForm] = useState(initialFormState);

  // [수정] 모달이 열릴 때 editData가 있으면 폼에 채워넣기 (수정 모드)
  useEffect(() => {
    if (open) {
      if (editData) {
        // 수정 모드: 기존 데이터 로드
        setInfoForm({
            order_number: editData.order_number || '',
            buyer_name: editData.buyer_name || '',
            recipient_name: editData.recipient_name || '',
            user_id: editData.user_id || '',
            contact: editData.contact || '',
            address: editData.address || '',
            account_info: editData.account_info || '',
            amount: editData.amount || ''
        });
        setPasteInput(''); // 수정 때는 붙여넣기 창 비움
      } else {
        // 추가 모드: 초기화
        setInfoForm(initialFormState);
        setPasteInput('');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editData]);

  const handleSmartPaste = (e) => {
    const text = e.target.value;
    setPasteInput(text);
    if (!text) return;

    let parts = text.split('/');
    if (parts.length < 2) parts = text.split('\t');
    if (parts.length < 2) parts = text.split(',');

    setInfoForm(prev => ({
      ...prev,
      order_number: parts[0]?.trim() || '',
      buyer_name: parts[1]?.trim() || '',
      recipient_name: parts[2]?.trim() || '',
      user_id: parts[3]?.trim() || '',
      contact: parts[4]?.trim() || '',
      address: parts[5]?.trim() || '',
      account_info: parts[6]?.trim() || '',
      amount: parts[7]?.trim() || '',
    }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setInfoForm({ ...infoForm, [name]: value });
  };

  const handleSave = () => {
    if (!infoForm.order_number && !infoForm.buyer_name) {
      alert("데이터가 입력되지 않았습니다.");
      return;
    }
    onSave(infoForm);
  };

  // 모드에 따라 UI 텍스트 변경
  const isEditMode = !!editData;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle sx={{ fontWeight: 'bold', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 1 }}>
        {isEditMode ? <EditIcon color="primary"/> : <ContentPasteIcon color="primary"/>}
        {isEditMode ? "구매자 정보 수정" : "구매자 정보 일괄 추가"}
      </DialogTitle>
      
      <DialogContent sx={{ mt: 2 }}>
        
        {/* 수정 모드가 아닐 때만 붙여넣기 박스 표시 (수정할 때는 보통 개별 필드를 고치므로) */}
        {!isEditMode && (
          <Box sx={{ mb: 3, p: 2, bgcolor: '#e3f2fd', borderRadius: 2, border: '1px dashed #1976d2' }}>
            <Typography variant="subtitle1" color="primary" fontWeight="bold" gutterBottom>
              ⚡ 데이터 붙여넣기 (슬래시 '/' 구분)
            </Typography>
            <Alert severity="info" sx={{ mb: 1, py: 0 }}>
               형식: <b>주문번호/구매자/수취인/아이디/연락처/주소/계좌정보/금액</b>
            </Alert>
            <TextField 
              fullWidth multiline rows={2} 
              placeholder="예: 20231130-01/홍길동/홍길동/hong123/010-0000-0000/서울 강남구/국민 123-45 홍길동/50000" 
              value={pasteInput} onChange={handleSmartPaste} sx={{ bgcolor: 'white' }} 
            />
          </Box>
        )}
        
        <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
            {isEditMode ? "데이터 수정" : "데이터 확인"}
        </Typography>

        <Grid container spacing={2}>
          <Grid item xs={6} sm={2}><TextField label="1. 주문번호" name="order_number" fullWidth size="small" value={infoForm.order_number} onChange={handleInputChange} focused={!!infoForm.order_number}/></Grid>
          <Grid item xs={6} sm={2}><TextField label="2. 구매자" name="buyer_name" fullWidth size="small" value={infoForm.buyer_name} onChange={handleInputChange} focused={!!infoForm.buyer_name}/></Grid>
          <Grid item xs={6} sm={2}><TextField label="3. 수취인" name="recipient_name" fullWidth size="small" value={infoForm.recipient_name} onChange={handleInputChange} focused={!!infoForm.recipient_name}/></Grid>
          <Grid item xs={6} sm={2}><TextField label="4. 아이디" name="user_id" fullWidth size="small" value={infoForm.user_id} onChange={handleInputChange} focused={!!infoForm.user_id}/></Grid>
          <Grid item xs={6} sm={4}><TextField label="5. 연락처" name="contact" fullWidth size="small" value={infoForm.contact} onChange={handleInputChange} focused={!!infoForm.contact}/></Grid>

          <Grid item xs={12} sm={5}><TextField label="6. 주소" name="address" fullWidth size="small" value={infoForm.address} onChange={handleInputChange} focused={!!infoForm.address}/></Grid>
          <Grid item xs={12} sm={5}><TextField label="7. 계좌정보" name="account_info" fullWidth size="small" value={infoForm.account_info} onChange={handleInputChange} focused={!!infoForm.account_info}/></Grid>
          <Grid item xs={6} sm={2}><TextField label="8. 금액" name="amount" fullWidth size="small" value={infoForm.amount} onChange={handleInputChange} focused={!!infoForm.amount}/></Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ p: 3, borderTop: '1px solid #eee' }}>
        <Button onClick={onClose} color="inherit" size="large">취소</Button>
        <Button onClick={handleSave} variant="contained" color="success" size="large" disableElevation>
            {isEditMode ? "수정 완료" : "추가하기"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default OperatorAddBuyerDialog;