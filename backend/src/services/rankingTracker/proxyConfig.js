/**
 * 프록시 설정 (환경변수 기반)
 *
 * PROXY_MODE 로 모드 선택:
 *  - none            : 프록시 없이 직접 연결 (EC2 IP, 보통 차단됨)
 *  - residential     : Playwright + 주거용 프록시 (Decodo/Smartproxy 등)
 *  - site_unblocker  : Decodo Site Unblocker HTTP (Cloudflare 우회 포함)
 *
 * residential 모드 필수 환경변수:
 *  - PROXY_SERVER, PROXY_USERNAME, PROXY_PASSWORD
 *
 * site_unblocker 모드 필수 환경변수:
 *  - SITE_UNBLOCKER_HOST, SITE_UNBLOCKER_USER, SITE_UNBLOCKER_PASS
 *
 * .env 자동 재로드:
 *  - 서버 재시작 없이 .env 파일 변경을 감지하여 PROXY_* 변수만 안전하게 갱신
 *  - DB/JWT 등 다른 변수는 갱신하지 않음 (재시작 필요)
 */

const fs = require('fs');
const path = require('path');

const PROXY_KEYS = [
  'PROXY_MODE',
  'PROXY_SERVER', 'PROXY_USERNAME', 'PROXY_PASSWORD',
  'SITE_UNBLOCKER_HOST', 'SITE_UNBLOCKER_USER', 'SITE_UNBLOCKER_PASS'
];

const ENV_PATH = path.resolve(__dirname, '../../../.env');

let watcherStarted = false;
let lastChangeListener = null;

function readEnvFromFile() {
  try {
    if (!fs.existsSync(ENV_PATH)) return {};
    const raw = fs.readFileSync(ENV_PATH, 'utf8');
    const result = {};
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      if (!PROXY_KEYS.includes(key)) continue;
      let value = trimmed.slice(eqIdx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      result[key] = value;
    }
    return result;
  } catch (err) {
    console.error('[proxyConfig] readEnvFromFile error:', err.message);
    return {};
  }
}

function snapshotProxyEnv() {
  return {
    PROXY_MODE: process.env.PROXY_MODE || '',
    PROXY_SERVER: process.env.PROXY_SERVER || '',
    PROXY_USERNAME: process.env.PROXY_USERNAME || '',
    PROXY_PASSWORD: process.env.PROXY_PASSWORD || '',
    SITE_UNBLOCKER_HOST: process.env.SITE_UNBLOCKER_HOST || '',
    SITE_UNBLOCKER_USER: process.env.SITE_UNBLOCKER_USER || '',
    SITE_UNBLOCKER_PASS: process.env.SITE_UNBLOCKER_PASS || ''
  };
}

function reloadProxyEnv() {
  const before = snapshotProxyEnv();
  const fromFile = readEnvFromFile();

  for (const key of PROXY_KEYS) {
    const newValue = fromFile[key] !== undefined ? fromFile[key] : '';
    if (newValue) {
      process.env[key] = newValue;
    } else {
      delete process.env[key];
    }
  }

  const after = snapshotProxyEnv();
  const changed = PROXY_KEYS.some(k => before[k] !== after[k]);
  return { changed, before, after };
}

function startEnvWatcher(onChange) {
  if (watcherStarted) return;
  lastChangeListener = onChange || null;

  if (!fs.existsSync(ENV_PATH)) {
    console.warn(`[proxyConfig] .env not found at ${ENV_PATH}, watcher disabled`);
    return;
  }

  fs.watchFile(ENV_PATH, { interval: 2000 }, () => {
    try {
      const { changed, before, after } = reloadProxyEnv();
      if (changed) {
        console.log(`[proxyConfig] .env changed: ${before.PROXY_MODE || 'none'} → ${after.PROXY_MODE || 'none'}`);
        if (lastChangeListener) {
          try { lastChangeListener(after, before); } catch (e) { console.error('[proxyConfig] listener error:', e.message); }
        }
      }
    } catch (err) {
      console.error('[proxyConfig] watcher reload error:', err.message);
    }
  });

  watcherStarted = true;
  console.log(`[proxyConfig] watching ${ENV_PATH} for PROXY_* changes (poll interval 2s)`);
}

function getProxyMode() {
  const mode = (process.env.PROXY_MODE || '').toLowerCase().trim();
  if (mode === 'site_unblocker') return 'site_unblocker';
  if (mode === 'residential') return 'residential';
  return 'none';
}

function isAnyProxyEnabled() {
  const mode = getProxyMode();
  if (mode === 'none') return false;
  if (mode === 'site_unblocker') return !!getSiteUnblockerConfig();
  return !!process.env.PROXY_SERVER;
}

function getProxyForPlaywright() {
  if (getProxyMode() !== 'residential' || !process.env.PROXY_SERVER) return undefined;
  const opts = { server: process.env.PROXY_SERVER };
  if (process.env.PROXY_USERNAME) opts.username = process.env.PROXY_USERNAME;
  if (process.env.PROXY_PASSWORD) opts.password = process.env.PROXY_PASSWORD;
  return opts;
}

function getProxySummary() {
  const mode = getProxyMode();
  if (mode === 'none') return { enabled: false, mode: 'none' };
  if (mode === 'site_unblocker') {
    return {
      enabled: !!getSiteUnblockerConfig(),
      mode: 'site_unblocker',
      server: process.env.SITE_UNBLOCKER_HOST || '',
      username: process.env.SITE_UNBLOCKER_USER ? '***' : null
    };
  }
  if (!process.env.PROXY_SERVER) return { enabled: false, mode: 'residential' };
  return {
    enabled: true,
    mode: 'residential',
    server: process.env.PROXY_SERVER,
    username: process.env.PROXY_USERNAME ? '***' : null
  };
}

function getSiteUnblockerConfig() {
  const host = process.env.SITE_UNBLOCKER_HOST || '';
  const user = process.env.SITE_UNBLOCKER_USER || '';
  const pass = process.env.SITE_UNBLOCKER_PASS || '';
  if (!host || !user || !pass) return null;
  return { host, user, pass };
}

module.exports = {
  isAnyProxyEnabled,
  getProxyForPlaywright,
  getProxySummary,
  getProxyMode,
  getSiteUnblockerConfig,
  reloadProxyEnv,
  startEnvWatcher
};
