import React, { useState, useEffect } from 'react';
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, Box, Typography, 
  TextField, Grid, Divider, Button, Alert 
} from '@mui/material';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

function OperatorAddBuyerDialog({ open, onClose, onSave }) {
  const initialFormState = {
    orderNum: '',    // 0
    buyer: '',       // 1
    recipient: '',   // 2
    userId: '',      // 3
    contact: '',     // 4
    address: '',     // 5
    bankAccount: '', // 6
    amount: '',      // 7
    reviewImage: null 
  };

  const [pasteInput, setPasteInput] = useState('');
  const [infoForm, setInfoForm] = useState(initialFormState);

  // 모달이 열릴 때마다 초기화
  useEffect(() => {
    if (open) {
        setPasteInput('');
        setInfoForm(initialFormState);
    }
  }, [open]);

  // [핵심 수정] 슬래시(/) 구분자 파싱 로직
  const handleSmartPaste = (e) => {
    const text = e.target.value;
    setPasteInput(text);
    if (!text) return;

    // 1. 요청하신 대로 '/' 기준으로 먼저 자릅니다.
    let parts = text.split('/');

    // 2. 만약 슬래시가 없어서 제대로 안 잘렸다면, 엑셀(탭)이나 콤마도 시도해봅니다.
    if (parts.length < 2) parts = text.split('\t');
    if (parts.length < 2) parts = text.split(','); 

    setInfoForm(prev => ({
      ...prev,
      orderNum: parts[0]?.trim() || '',    // 주문번호
      buyer: parts[1]?.trim() || '',       // 구매자
      recipient: parts[2]?.trim() || '',   // 수취인
      userId: parts[3]?.trim() || '',      // 아이디
      contact: parts[4]?.trim() || '',     // 연락처
      address: parts[5]?.trim() || '',     // 주소
      bankAccount: parts[6]?.trim() || '', // 은행명 계좌번호 이름 (통으로)
      amount: parts[7]?.trim() || '',      // 금액
    }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setInfoForm({ ...infoForm, [name]: value });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setInfoForm({ ...infoForm, reviewImage: file });
    }
  };

  const handleSave = () => {
    if (!infoForm.orderNum && !infoForm.buyer) {
      alert("데이터가 입력되지 않았습니다.");
      return;
    }
    onSave(infoForm);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle sx={{ fontWeight: 'bold', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 1 }}>
        <ContentPasteIcon color="primary"/> 구매자 정보 일괄 추가
      </DialogTitle>
      <DialogContent sx={{ mt: 2 }}>
        
        {/* 붙여넣기 영역 */}
        <Box sx={{ mb: 3, p: 2, bgcolor: '#e3f2fd', borderRadius: 2, border: '1px dashed #1976d2' }}>
          <Typography variant="subtitle1" color="primary" fontWeight="bold" gutterBottom>
            ⚡ 데이터 붙여넣기 (슬래시 '/' 구분)
          </Typography>
          <Alert severity="info" sx={{ mb: 1, py: 0 }}>
             형식: <b>주문번호/구매자/수취인/아이디/연락처/주소/계좌정보/금액</b>
          </Alert>
          <TextField 
            fullWidth 
            multiline 
            rows={2} 
            placeholder="예: 20231130-01/홍길동/홍길동/hong123/010-0000-0000/서울 강남구/국민 123-45 홍길동/50000" 
            value={pasteInput} 
            onChange={handleSmartPaste} 
            sx={{ bgcolor: 'white' }} 
          />
        </Box>
        
        {/* 데이터 확인 영역 */}
        <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>데이터 확인 및 이미지 업로드</Typography>
        <Grid container spacing={2}>
          <Grid item xs={6} sm={2}><TextField label="1. 주문번호" name="orderNum" fullWidth size="small" value={infoForm.orderNum} onChange={handleInputChange} focused={!!infoForm.orderNum} /></Grid>
          <Grid item xs={6} sm={2}><TextField label="2. 구매자" name="buyer" fullWidth size="small" value={infoForm.buyer} onChange={handleInputChange} focused={!!infoForm.buyer} /></Grid>
          <Grid item xs={6} sm={2}><TextField label="3. 수취인" name="recipient" fullWidth size="small" value={infoForm.recipient} onChange={handleInputChange} focused={!!infoForm.recipient} /></Grid>
          <Grid item xs={6} sm={2}><TextField label="4. 아이디" name="userId" fullWidth size="small" value={infoForm.userId} onChange={handleInputChange} focused={!!infoForm.userId} /></Grid>
          <Grid item xs={6} sm={4}><TextField label="5. 연락처" name="contact" fullWidth size="small" value={infoForm.contact} onChange={handleInputChange} focused={!!infoForm.contact} /></Grid>
          
          <Grid item xs={12} sm={5}><TextField label="6. 주소" name="address" fullWidth size="small" value={infoForm.address} onChange={handleInputChange} focused={!!infoForm.address} /></Grid>
          <Grid item xs={12} sm={5}><TextField label="7. 계좌정보(은행/계좌/이름)" name="bankAccount" fullWidth size="small" value={infoForm.bankAccount} onChange={handleInputChange} focused={!!infoForm.bankAccount} /></Grid>
          <Grid item xs={6} sm={2}><TextField label="8. 금액" name="amount" fullWidth size="small" value={infoForm.amount} onChange={handleInputChange} focused={!!infoForm.amount} /></Grid>
          
          {/* 이미지 업로드 */}
          <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" gutterBottom>리뷰 캡처 이미지 (필수)</Typography>
              <Button 
                  component="label" variant="outlined" fullWidth startIcon={<CloudUploadIcon />} 
                  sx={{ height: 50, borderStyle: 'dashed', borderColor: infoForm.reviewImage ? 'green' : '#bbb', color: infoForm.reviewImage ? 'green' : '#666', bgcolor: infoForm.reviewImage ? '#f0fdf4' : 'transparent' }}
              >
                  {infoForm.reviewImage ? `파일 선택됨: ${infoForm.reviewImage.name}` : "이미지 파일 선택 또는 드래그"}
                  <input type="file" hidden accept="image/*" onChange={handleImageChange} />
              </Button>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ p: 3, borderTop: '1px solid #eee' }}>
        <Button onClick={onClose} color="inherit" size="large">취소</Button>
        <Button onClick={handleSave} variant="contained" color="success" size="large" disableElevation>추가하기</Button>
      </DialogActions>
    </Dialog>
  );
}

export default OperatorAddBuyerDialog;