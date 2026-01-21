import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, TextField, Button, IconButton, Tooltip,
  CircularProgress, Snackbar, Alert
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SaveIcon from '@mui/icons-material/Save';
import NoteAltIcon from '@mui/icons-material/NoteAlt';
import { getMyMemo, saveMyMemo } from '../../services/memoService';

function OperatorMemoDialog({ open, onClose }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [hasChanges, setHasChanges] = useState(false);
  const originalContent = useRef('');

  // 다이얼로그 열릴 때 메모 로드
  useEffect(() => {
    if (open) {
      loadMemo();
    }
  }, [open]);

  const loadMemo = async () => {
    try {
      setLoading(true);
      const response = await getMyMemo();
      const memoContent = response.data?.content || '';
      setContent(memoContent);
      originalContent.current = memoContent;
      setHasChanges(false);
    } catch (err) {
      console.error('Failed to load memo:', err);
      setSnackbar({
        open: true,
        message: '메모를 불러오는데 실패했습니다.',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  // 내용 변경 감지
  const handleContentChange = (e) => {
    const newContent = e.target.value;
    setContent(newContent);
    setHasChanges(newContent !== originalContent.current);
  };

  // 메모 저장
  const handleSave = async () => {
    try {
      setSaving(true);
      await saveMyMemo(content);
      originalContent.current = content;
      setHasChanges(false);
      setSnackbar({
        open: true,
        message: '메모가 저장되었습니다.',
        severity: 'success'
      });
    } catch (err) {
      console.error('Failed to save memo:', err);
      setSnackbar({
        open: true,
        message: '메모 저장에 실패했습니다.',
        severity: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  // 닫기 시 자동 저장
  const handleClose = async () => {
    if (hasChanges) {
      try {
        setSaving(true);
        await saveMyMemo(content);
        originalContent.current = content;
        setHasChanges(false);
      } catch (err) {
        console.error('Failed to auto-save memo:', err);
      } finally {
        setSaving(false);
      }
    }
    onClose();
  };

  // 클립보드에 복사
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setSnackbar({
        open: true,
        message: '메모가 클립보드에 복사되었습니다!',
        severity: 'success'
      });
    } catch (err) {
      console.error('Failed to copy:', err);
      setSnackbar({
        open: true,
        message: '복사에 실패했습니다.',
        severity: 'error'
      });
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={(event, reason) => { if (reason !== 'backdropClick') handleClose(); }}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { minHeight: '60vh' }
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#2c387e', color: 'white' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <NoteAltIcon />
            <Typography variant="h6" fontWeight="bold">
              나의 메모장
            </Typography>
            {hasChanges && (
              <Typography variant="caption" sx={{ ml: 1, opacity: 0.8 }}>
                (변경사항 있음)
              </Typography>
            )}
          </Box>
          <IconButton onClick={handleClose} sx={{ color: 'white' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TextField
              multiline
              fullWidth
              value={content}
              onChange={handleContentChange}
              placeholder="자유롭게 메모를 작성하세요...&#10;&#10;작성한 내용은 그대로 카카오톡에 붙여넣기 할 수 있습니다."
              variant="outlined"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 0,
                  minHeight: '50vh',
                  alignItems: 'flex-start',
                  '& fieldset': {
                    border: 'none'
                  }
                },
                '& .MuiInputBase-input': {
                  fontFamily: 'monospace',
                  fontSize: '14px',
                  lineHeight: 1.6,
                  padding: 2,
                  whiteSpace: 'pre-wrap'
                }
              }}
            />
          )}
        </DialogContent>

        <DialogActions sx={{ px: 2, py: 1.5, bgcolor: '#f5f5f5', justifyContent: 'space-between' }}>
          <Typography variant="caption" color="text.secondary">
            * 닫을 때 자동 저장됩니다
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="클립보드에 복사">
              <Button
                variant="outlined"
                color="primary"
                startIcon={<ContentCopyIcon />}
                onClick={handleCopy}
                disabled={!content}
              >
                복사
              </Button>
            </Tooltip>
            <Button
              variant="contained"
              color="primary"
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
              onClick={handleSave}
              disabled={saving || !hasChanges}
              sx={{ bgcolor: '#2c387e', '&:hover': { bgcolor: '#3f51b5' } }}
            >
              저장
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}

export default OperatorMemoDialog;
