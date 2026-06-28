/**
 * HTML → PDF 렌더러 (AI 챗 문서 생성용)
 *
 * - 베이스 Docker 이미지가 Playwright(Chromium 사전설치)라 새 무거운 의존성 없이 렌더 가능.
 * - playwright는 optionalDependencies → lazy require (미설치 시 친절한 에러).
 * - 모델이 생성한 HTML을 렌더하므로 보안 강하게: offline + JS off + 외부요청 전부 차단 + navigation 없이 setContent만.
 */

const MAX_HTML_BYTES = 1_000_000; // 1MB

/**
 * @param {string} html  완결형 HTML (inline CSS만, 외부 리소스 불가)
 * @param {string} title 리포트 제목(로그용)
 * @returns {Promise<Buffer>} PDF 바이너리
 */
const renderHtmlToPdf = async (html) => {
  if (!html || typeof html !== 'string' || !html.trim()) {
    throw new Error('HTML 내용이 비어 있습니다.');
  }
  if (Buffer.byteLength(html, 'utf8') > MAX_HTML_BYTES) {
    throw new Error('HTML이 너무 큽니다(최대 1MB). 내용을 줄여 다시 시도하세요.');
  }

  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch (e) {
    throw new Error('PDF 생성 모듈(playwright)이 설치되어 있지 않습니다. (운영 환경에서는 사용 가능)');
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const context = await browser.newContext({
      offline: true,            // 외부 네트워크 차단
      javaScriptEnabled: false, // 모델 생성 HTML의 스크립트 실행 금지 (차트는 inline SVG)
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
    });
    const page = await context.newPage();

    // data:/about: 외 모든 요청 차단 (이미지/폰트/스크립트 등 외부 리소스 봉쇄)
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('data:') || url.startsWith('about:')) {
        return route.continue();
      }
      return route.abort();
    });

    // navigation 없이 setContent만 (외부 URL 로드 금지)
    await page.setContent(html, { waitUntil: 'load', timeout: 10000 });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' },
    });
    return pdf;
  } finally {
    await browser.close().catch(() => {});
  }
};

module.exports = { renderHtmlToPdf };
