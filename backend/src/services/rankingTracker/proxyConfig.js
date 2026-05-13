/**
 * 주거용 프록시 설정 (환경변수 기반)
 *
 * 어느 서비스를 쓰든 동일한 인터페이스:
 *  - PROXY_SERVER : 'http://host:port' 또는 'http://user:pass@host:port'
 *  - PROXY_USERNAME : 사용자명 (Smartproxy: user-xxx-country-kr 형식)
 *  - PROXY_PASSWORD : 비밀번호
 *  - PROXY_ENABLED : 'true' 인 경우만 활성화
 *
 * 예시 (Smartproxy):
 *  PROXY_SERVER=http://gate.smartproxy.com:7000
 *  PROXY_USERNAME=user-xxx-country-kr
 *  PROXY_PASSWORD=yyy
 *
 * 예시 (Bright Data):
 *  PROXY_SERVER=http://brd.superproxy.io:22225
 *  PROXY_USERNAME=brd-customer-xxx-zone-residential
 *  PROXY_PASSWORD=yyy
 *
 * 미설정 시: 프록시 없이 직접 연결 (EC2 IP로 시도, 보통 차단됨)
 *
 * .env 자동 재로드:
 *  - 서버 재시작 없이 .env 파일 변경을 감지하여 PROXY_* 변수만 안전하게 갱신
 *  - DB/JWT 등 다른 변수는 갱신하지 않음 (재시작 필요)
 */

const fs = require('fs');
const path = require('path');

const PROXY_KEYS = ['PROXY_ENABLED', 'PROXY_SERVER', 'PROXY_USERNAME', 'PROXY_PASSWORD'];

// .env 파일 경로 (backend/.env)
const ENV_PATH = path.resolve(__dirname, '../../../.env');

let watcherStarted = false;
let lastChangeListener = null; // (newSnapshot, oldSnapshot) => void

/**
 * .env 파일을 직접 파싱해서 PROXY_* 값을 추출
 * (process.env 전체를 덮어쓰지 않고, PROXY 관련만 가져옴)
 */
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
      // 따옴표 제거
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
    PROXY_ENABLED: process.env.PROXY_ENABLED || '',
    PROXY_SERVER: process.env.PROXY_SERVER || '',
    PROXY_USERNAME: process.env.PROXY_USERNAME || '',
    PROXY_PASSWORD: process.env.PROXY_PASSWORD || ''
  };
}

/**
 * .env 파일에서 PROXY_* 값을 다시 읽어 process.env에 반영
 * @returns {{changed: boolean, before: object, after: object}}
 */
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

/**
 * .env 파일 변경 감지 시작 (서버 부팅 시 한 번만 호출)
 * @param {(after, before) => void} onChange - 변경 감지 콜백 (선택)
 */
function startEnvWatcher(onChange) {
  if (watcherStarted) return;
  lastChangeListener = onChange || null;

  if (!fs.existsSync(ENV_PATH)) {
    console.warn(`[proxyConfig] .env not found at ${ENV_PATH}, watcher disabled`);
    return;
  }

  // fs.watchFile은 폴링 기반이라 도커 볼륨 마운트에서도 동작
  fs.watchFile(ENV_PATH, { interval: 2000 }, () => {
    try {
      const { changed, before, after } = reloadProxyEnv();
      if (changed) {
        const beforeOn = before.PROXY_ENABLED?.toLowerCase() === 'true' && !!before.PROXY_SERVER;
        const afterOn = after.PROXY_ENABLED?.toLowerCase() === 'true' && !!after.PROXY_SERVER;
        console.log(`[proxyConfig] .env changed: proxy ${beforeOn ? 'ON' : 'OFF'} → ${afterOn ? 'ON' : 'OFF'}`);
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

function isProxyEnabled() {
  return (
    String(process.env.PROXY_ENABLED || '').toLowerCase() === 'true' &&
    !!process.env.PROXY_SERVER
  );
}

/**
 * Playwright launch options용 proxy 객체
 * @returns {object|undefined}
 */
function getProxyForPlaywright() {
  if (!isProxyEnabled()) return undefined;
  const opts = { server: process.env.PROXY_SERVER };
  if (process.env.PROXY_USERNAME) opts.username = process.env.PROXY_USERNAME;
  if (process.env.PROXY_PASSWORD) opts.password = process.env.PROXY_PASSWORD;
  return opts;
}

function getProxySummary() {
  if (!isProxyEnabled()) return { enabled: false };
  const server = process.env.PROXY_SERVER || '';
  return {
    enabled: true,
    server,
    username: process.env.PROXY_USERNAME ? '***' : null
  };
}

module.exports = {
  isProxyEnabled,
  getProxyForPlaywright,
  getProxySummary,
  reloadProxyEnv,
  startEnvWatcher
};
