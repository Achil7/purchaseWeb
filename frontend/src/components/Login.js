import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton
} from '@mui/material';
import { Visibility, VisibilityOff, Login as LoginIcon } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { settingService } from '../services';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 로그인 페이지 설정
  const [loginSettings, setLoginSettings] = useState({
    login_title: 'CampManager',
    login_subtitle: '캠페인 관리 시스템',
    login_banner_image: '',
    login_announcement: '',
    banner_title: 'CampManager',
    banner_subtitle: '캠페인 관리 시스템'
  });

  // 로그인 페이지 설정 로드
  useEffect(() => {
    loadLoginSettings();
  }, []);

  const loadLoginSettings = async () => {
    try {
      const response = await settingService.getLoginSettings();
      if (response.data) {
        setLoginSettings(response.data);
      }
    } catch (err) {
      console.error('Failed to load login settings:', err);
    }
  };

  // 역할에 맞는 기본 페이지로 이동
  const getRoleRedirect = (role) => {
    const redirects = {
      admin: '/admin',
      sales: '/sales',
      operator: '/operator',
      brand: '/brand'
    };
    return redirects[role] || '/';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(username, password);

      if (result.success) {
        const user = result.data.user;
        const redirectPath = getRoleRedirect(user.role);
        navigate(redirectPath, { replace: true });
      } else {
        setError(result.message || '로그인에 실패했습니다');
      }
    } catch (err) {
      setError(err.response?.data?.message || '로그인 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        bgcolor: '#f5f6fa'  // Admin 테마 기반 연한 배경
      }}
    >
      {/* 왼쪽: 배너 영역 */}
      <Box
        sx={{
          flex: 1,
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          bgcolor: '#2c387e',  // Admin 상단바 색상
          color: 'white',
          p: 4,
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* 배경 장식 */}
        <Box
          sx={{
            position: 'absolute',
            width: 300,
            height: 300,
            borderRadius: '50%',
            bgcolor: 'rgba(255, 255, 255, 0.1)',  // Admin 테마 기반
            top: -100,
            left: -100
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            width: 200,
            height: 200,
            borderRadius: '50%',
            bgcolor: 'rgba(255, 255, 255, 0.1)',  // Admin 테마 기반
            bottom: -50,
            right: -50
          }}
        />

        {/* 콘텐츠 영역 */}
        <Box sx={{ textAlign: 'center', zIndex: 1, maxWidth: '80%' }}>
          {/* 배너 타이틀 */}
          <Typography variant="h3" fontWeight="bold" gutterBottom>
            {loginSettings.banner_title || 'CampManager'}
          </Typography>
          <Typography variant="h6" sx={{ opacity: 0.9, mb: 3 }}>
            {loginSettings.banner_subtitle || '캠페인 관리 시스템'}
          </Typography>

          {/* 배너 이미지 */}
          {loginSettings.login_banner_image && (
            <Box
              component="img"
              src={loginSettings.login_banner_image}
              alt="Login Banner"
              sx={{
                width: 400,
                height: 300,
                objectFit: 'contain',
                borderRadius: 2,
                mb: 3,
                bgcolor: 'rgba(255,255,255,0.1)'
              }}
            />
          )}

          {/* 공지사항 */}
          {loginSettings.login_announcement && (
            <Box
              sx={{
                mt: 2,
                p: 3,
                bgcolor: 'rgba(255,255,255,0.15)',
                borderRadius: 2,
                textAlign: 'left',
                width: 800,
                minHeight: 200,
                maxHeight: 400,
                overflowY: 'auto'
              }}
            >
              <Typography
                variant="body1"
                sx={{
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.8
                }}
              >
                {loginSettings.login_announcement}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* 오른쪽: 로그인 폼 */}
      <Box
        sx={{
          flex: { xs: 1, md: '0 0 480px' },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 4
        }}
      >
        <Card sx={{ maxWidth: 400, width: '100%', borderRadius: 3, boxShadow: 3 }}>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <Typography variant="h4" fontWeight="bold" sx={{ color: '#2c387e' }} gutterBottom>
                {loginSettings.login_title || 'CampManager'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {loginSettings.login_subtitle || '캠페인 관리 시스템'}
              </Typography>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <TextField
                fullWidth
                label="아이디"
                variant="outlined"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                autoFocus
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                label="비밀번호"
                type={showPassword ? 'text' : 'password'}
                variant="outlined"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                sx={{ mb: 3 }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={loading || !username || !password}
                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <LoginIcon />}
                sx={{ py: 1.5, borderRadius: 2, bgcolor: '#2c387e', '&:hover': { bgcolor: '#3f51b5' } }}
              >
                {loading ? '로그인 중...' : '로그인'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default Login;
