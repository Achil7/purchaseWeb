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
 */

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
  getProxySummary
};
