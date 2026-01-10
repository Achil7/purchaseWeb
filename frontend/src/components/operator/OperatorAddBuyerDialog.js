import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Box, Typography,
  TextField, Grid, Button, Alert, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, IconButton
} from '@mui/material';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import GroupAddIcon from '@mui/icons-material/GroupAdd';

function OperatorAddBuyerDialog({ open, onClose, onSave, onSaveBulk, editData = null }) {
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
  const [parsedBuyers, setParsedBuyers] = useState([]);
  const [isBulkMode, setIsBulkMode] = useState(false);

  useEffect(() => {
    if (open) {
      if (editData) {
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
        setPasteInput('');
        setParsedBuyers([]);
        setIsBulkMode(false);
      } else {
        setInfoForm(initialFormState);
        setPasteInput('');
        setParsedBuyers([]);
        setIsBulkMode(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editData]);

  // 단일 라인 파싱 (기존 로직)
  const parseSingleLine = (line) => {
    let parts = line.split('/');
    if (parts.length < 2) parts = line.split('\t');
    if (parts.length < 2) parts = line.split(',');

    return {
      order_number: parts[0]?.trim() || '',
      buyer_name: parts[1]?.trim() || '',
      recipient_name: parts[2]?.trim() || '',
      user_id: parts[3]?.trim() || '',
      contact: parts[4]?.trim() || '',
      address: parts[5]?.trim() || '',
      account_info: parts[6]?.trim() || '',
      amount: parts[7]?.trim() || ''
    };
  };

  // 다중 라인 파싱
  const handleMultiLinePaste = (e) => {
    const text = e.target.value;
    setPasteInput(text);

    if (!text.trim()) {
      setParsedBuyers([]);
      setIsBulkMode(false);
      return;
    }

    const lines = text.split('\n').filter(line => line.trim());

    if (lines.length > 1) {
      // 여러 줄 입력: 다중 추가 모드
      setIsBulkMode(true);
      const buyers = lines.map(line => parseSingleLine(line));
      setParsedBuyers(buyers);
    } else {
      // 단일 줄 입력: 기존 모드
      setIsBulkMode(false);
      setParsedBuyers([]);
      const parsed = parseSingleLine(lines[0]);
      setInfoForm(prev => ({
        ...prev,
        ...parsed
      }));
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setInfoForm({ ...infoForm, [name]: value });
  };

  // 파싱된 구매자 삭제
  const handleRemoveParsedBuyer = (index) => {
    setParsedBuyers(prev => prev.filter((_, i) => i !== index));
  };

  // 단일 저장
  const handleSaveSingle = () => {
    if (!infoForm.order_number && !infoForm.buyer_name) {
      alert("데이터가 입력되지 않았습니다.");
      return;
    }
    onSave(infoForm);
  };

  // 다중 저장
  const handleSaveBulk = () => {
    if (parsedBuyers.length === 0) {
      alert("추가할 구매자가 없습니다.");
      return;
    }

    // 필수 필드 검증
    const invalidBuyers = parsedBuyers.filter(
      b => !b.order_number || !b.buyer_name || !b.recipient_name
    );

    if (invalidBuyers.length > 0) {
      alert(`${invalidBuyers.length}명의 구매자에 필수 필드(주문번호, 구매자, 수취인)가 누락되었습니다.`);
      return;
    }

    onSaveBulk(parsedBuyers);
  };

  const isEditMode = !!editData;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle sx={{ fontWeight: 'bold', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 1 }}>
        {isEditMode ? <EditIcon color="primary" /> : (isBulkMode ? <GroupAddIcon color="primary" /> : <ContentPasteIcon color="primary" />)}
        {isEditMode ? "구매자 정보 수정" : (isBulkMode ? `구매자 ${parsedBuyers.length}명 일괄 추가` : "구매자 정보 추가")}
      </DialogTitle>

      <DialogContent sx={{ mt: 2 }}>

        {/* 수정 모드가 아닐 때만 붙여넣기 박스 표시 */}
        {!isEditMode && (
          <Box sx={{ mb: 3, p: 2, bgcolor: '#e3f2fd', borderRadius: 2, border: '1px dashed #1976d2' }}>
            <Typography variant="subtitle1" color="primary" fontWeight="bold" gutterBottom>
              데이터 붙여넣기 (슬래시 '/' 구분)
            </Typography>
            <Alert severity="info" sx={{ mb: 1, py: 0 }}>
              형식: <b>주문번호/구매자/수취인/아이디/연락처/주소/계좌정보/금액</b>
              <br />
              <Typography variant="caption" color="text.secondary">
                여러 줄 입력 시 한 번에 여러 명 추가 가능
              </Typography>
            </Alert>
            <TextField
              fullWidth
              multiline
              rows={4}
              placeholder={`예시 (한 줄에 한 명):
20231130-01/홍길동/홍길동/hong123/010-0000-0000/서울 강남구/국민 123-45 홍길동/50000
20231130-02/김철수/김철수/kim456/010-1111-1111/부산 해운대구/신한 456-78 김철수/30000`}
              value={pasteInput}
              onChange={handleMultiLinePaste}
              sx={{ bgcolor: 'white' }}
            />
          </Box>
        )}

        {/* 다중 추가 모드: 파싱된 데이터 미리보기 테이블 */}
        {!isEditMode && isBulkMode && parsedBuyers.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip label={`${parsedBuyers.length}명`} color="primary" size="small" />
              파싱된 데이터 미리보기
            </Typography>
            <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>주문번호</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>구매자</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>수취인</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>아이디</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>계좌정보</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>금액</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', width: 50 }}></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {parsedBuyers.map((buyer, idx) => (
                    <TableRow key={idx} hover>
                      <TableCell>{buyer.order_number || '-'}</TableCell>
                      <TableCell>{buyer.buyer_name || '-'}</TableCell>
                      <TableCell>{buyer.recipient_name || '-'}</TableCell>
                      <TableCell>{buyer.user_id || '-'}</TableCell>
                      <TableCell sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {buyer.account_info || '-'}
                      </TableCell>
                      <TableCell>{buyer.amount || '-'}</TableCell>
                      <TableCell>
                        <IconButton size="small" color="error" onClick={() => handleRemoveParsedBuyer(idx)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* 단일 추가/수정 모드: 데이터 확인 폼 */}
        {(isEditMode || !isBulkMode) && (
          <>
            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
              {isEditMode ? "데이터 수정" : "데이터 확인"}
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={6} sm={2}>
                <TextField label="1. 주문번호" name="order_number" fullWidth size="small" value={infoForm.order_number} onChange={handleInputChange} focused={!!infoForm.order_number} />
              </Grid>
              <Grid item xs={6} sm={2}>
                <TextField label="2. 구매자" name="buyer_name" fullWidth size="small" value={infoForm.buyer_name} onChange={handleInputChange} focused={!!infoForm.buyer_name} />
              </Grid>
              <Grid item xs={6} sm={2}>
                <TextField label="3. 수취인" name="recipient_name" fullWidth size="small" value={infoForm.recipient_name} onChange={handleInputChange} focused={!!infoForm.recipient_name} />
              </Grid>
              <Grid item xs={6} sm={2}>
                <TextField label="4. 아이디" name="user_id" fullWidth size="small" value={infoForm.user_id} onChange={handleInputChange} focused={!!infoForm.user_id} />
              </Grid>
              <Grid item xs={6} sm={4}>
                <TextField label="5. 연락처" name="contact" fullWidth size="small" value={infoForm.contact} onChange={handleInputChange} focused={!!infoForm.contact} />
              </Grid>

              <Grid item xs={12} sm={5}>
                <TextField label="6. 주소" name="address" fullWidth size="small" value={infoForm.address} onChange={handleInputChange} focused={!!infoForm.address} />
              </Grid>
              <Grid item xs={12} sm={5}>
                <TextField label="7. 계좌정보" name="account_info" fullWidth size="small" value={infoForm.account_info} onChange={handleInputChange} focused={!!infoForm.account_info} />
              </Grid>
              <Grid item xs={6} sm={2}>
                <TextField label="8. 금액" name="amount" fullWidth size="small" value={infoForm.amount} onChange={handleInputChange} focused={!!infoForm.amount} />
              </Grid>
            </Grid>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3, borderTop: '1px solid #eee' }}>
        <Button onClick={onClose} color="inherit" size="large">취소</Button>

        {isEditMode ? (
          <Button onClick={handleSaveSingle} variant="contained" color="success" size="large" disableElevation>
            수정 완료
          </Button>
        ) : isBulkMode ? (
          <Button
            onClick={handleSaveBulk}
            variant="contained"
            color="primary"
            size="large"
            disableElevation
            startIcon={<GroupAddIcon />}
          >
            {parsedBuyers.length}명 일괄 추가
          </Button>
        ) : (
          <Button onClick={handleSaveSingle} variant="contained" color="success" size="large" disableElevation>
            추가하기
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default OperatorAddBuyerDialog;
