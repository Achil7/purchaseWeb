// frontend/src/theme/kwadTheme.js
// Kwad — Refined Slate palette for Material-UI 7
// Drop into frontend/src/theme/ and wire via ThemeProvider in App.js

import { createTheme } from '@mui/material/styles';

// ──────────────────────────────────────────────────────────────────────────
// Design tokens (single source of truth, mirrored in kwad-tokens.css)
// ──────────────────────────────────────────────────────────────────────────
export const kwadTokens = {
  // Brand
  primary:        '#2a3568',
  primaryHover:   '#1f285a',
  primarySoft:    '#eceefa',
  primarySoftStr: '#d7dcf2',
  headerBg:       '#1f2a4d',

  // Accent / status
  accent:   '#5b5fc7',
  info:     '#1d6dbf',
  infoSoft: '#e6f0f9',
  success:  '#0e8a5e',
  successSoft: '#e6f4ee',
  warning:  '#b25e09',
  warningSoft: '#fdefdc',
  danger:   '#cd1d31',
  dangerSoft: '#fde7ea',

  // Neutrals
  bg:           '#f7f8fa',
  surface:      '#ffffff',
  surfaceMuted: '#f1f3f8',
  surfaceSubtle:'#fafbfd',
  border:       '#e4e6ed',
  borderStrong: '#d1d5e0',
  divider:      '#eef0f5',

  // Text
  text:           '#1a1f36',
  textSecondary:  '#545a6b',
  textTertiary:   '#8c93a8',
  textInverse:    '#ffffff',

  // Chips
  chipBg:   '#f1f3f8',
  chipText: '#3c4357',

  // Typography
  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "Pretendard", sans-serif',
};

// ──────────────────────────────────────────────────────────────────────────
// MUI theme
// ──────────────────────────────────────────────────────────────────────────
const kwadTheme = createTheme({
  palette: {
    mode: 'light',
    primary:   { main: kwadTokens.primary,  dark: kwadTokens.primaryHover, light: '#5b65a3', contrastText: '#ffffff' },
    secondary: { main: kwadTokens.accent,   contrastText: '#ffffff' },
    success:   { main: kwadTokens.success,  light: kwadTokens.successSoft, contrastText: '#ffffff' },
    warning:   { main: kwadTokens.warning,  light: kwadTokens.warningSoft, contrastText: '#ffffff' },
    error:     { main: kwadTokens.danger,   light: kwadTokens.dangerSoft,  contrastText: '#ffffff' },
    info:      { main: kwadTokens.info,     light: kwadTokens.infoSoft,    contrastText: '#ffffff' },
    background:{ default: kwadTokens.bg, paper: kwadTokens.surface },
    text:      { primary: kwadTokens.text, secondary: kwadTokens.textSecondary, disabled: kwadTokens.textTertiary },
    divider:   kwadTokens.border,
  },
  typography: {
    fontFamily: kwadTokens.fontFamily,
    fontSize: 16,
    h1: { fontWeight: 700, letterSpacing: '-0.03em' },
    h2: { fontWeight: 700, letterSpacing: '-0.024em' },
    h3: { fontWeight: 600, letterSpacing: '-0.02em' },
    h4: { fontWeight: 600, letterSpacing: '-0.018em' },
    h5: { fontWeight: 600, letterSpacing: '-0.015em' },
    h6: { fontWeight: 600, letterSpacing: '-0.01em' },
    subtitle1: { fontWeight: 500, fontSize: '1.05rem' },
    subtitle2: { fontWeight: 500, fontSize: '1rem' },
    body1: { fontSize: '1rem' },
    body2: { fontSize: '0.95rem' },
    button: { fontWeight: 500, letterSpacing: '-0.005em', textTransform: 'none', fontSize: '1rem' },
    caption: { fontSize: '0.85rem' },
  },
  shape: { borderRadius: 6 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: kwadTokens.bg,
          color: kwadTokens.text,
          fontFeatureSettings: '"ss01" on, "cv11" on',
          WebkitFontSmoothing: 'antialiased',
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 500 },
      },
    },
    MuiPaper: {
      styleOverrides: {
        outlined: { borderColor: kwadTokens.border },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        colorPrimary: { backgroundColor: kwadTokens.headerBg },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500, letterSpacing: '-0.005em' },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { fontSize: 12, fontWeight: 500, padding: '6px 10px' },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
          boxShadow: '0 20px 60px rgba(0,0,0,0.18), 0 6px 16px rgba(0,0,0,0.08)',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontSize: 18, fontWeight: 600,
          letterSpacing: '-0.015em',
          padding: '20px 24px',
        },
      },
    },
    MuiBackdrop: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(10, 15, 30, 0.55)',
          backdropFilter: 'blur(4px)',
        },
      },
    },
  },
});

export default kwadTheme;
