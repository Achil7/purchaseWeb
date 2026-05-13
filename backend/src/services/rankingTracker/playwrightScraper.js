/**
 * Playwright 기반 올리브영 BEST 100 스크래퍼
 *
 * - playwright-extra + stealth 플러그인으로 봇 감지 우회
 * - 가정용 IP에서만 챌린지 통과 (데이터센터 IP는 차단됨)
 * - 21개 카테고리를 1개 브라우저 인스턴스로 순회 (재사용)
 *
 * **PC 로컬 워커 전용** (EC2에서 실행되지 않음)
 */

const { chromium: chromiumOriginal } = require('playwright');
let chromium = chromiumOriginal;
try {
  const { chromium: chromiumExtra } = require('playwright-extra');
  const StealthPlugin = require('puppeteer-extra-plugin-stealth')();
  chromiumExtra.use(StealthPlugin);
  chromium = chromiumExtra;
} catch (err) {
  // stealth 플러그인 설치 안 됐으면 vanilla playwright 사용
}

const cheerio = require('cheerio');
const { CATEGORIES, buildBestListUrl } = require('./categories');
const { getProxyForPlaywright, isProxyEnabled } = require('./proxyConfig');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36';
const VIEWPORT = { width: 1920, height: 1080 };
const NAV_TIMEOUT = 30000;
const SELECTOR_TIMEOUT = 30000;

function extractGoodsNo(url) {
  if (!url) return null;
  const match = url.match(/goodsNo=([A-Z0-9]+)/i);
  return match ? match[1] : null;
}

/**
 * 가격 텍스트 파싱
 *
 * 올리브영 가격 노출 패턴:
 *  - 할인 있음:  "38,000원\n27,200원"  (또는 한 줄에 "38,000원 27,200원")
 *  - 할인 없음:  "11,300원"
 *  - 가끔 "원" 없이 숫자만, 또는 "~" 가 포함되기도 함
 *
 * @returns {{ original: string|null, sale: string|null, discount: number|null }}
 */
function parsePriceText(rawText) {
  if (!rawText) return { original: null, sale: null, discount: null };

  // 모든 "숫자[,숫자]*원" 패턴 추출
  const matches = rawText.match(/[0-9]{1,3}(?:,[0-9]{3})*\s*원/g) || [];
  if (matches.length === 0) return { original: null, sale: null, discount: null };

  // 정규화 (공백 제거)
  const prices = matches.map((p) => p.replace(/\s+/g, ''));

  if (prices.length === 1) {
    // 할인 없음 → 판매가만
    return { original: null, sale: prices[0], discount: null };
  }

  // 가격 2개 이상이면 첫 번째 = 원가, 두 번째 = 판매가 (올리브영 DOM 노출 순서)
  const originalNum = parseInt(prices[0].replace(/[^0-9]/g, ''), 10);
  const saleNum = parseInt(prices[1].replace(/[^0-9]/g, ''), 10);

  // 원가 < 판매가 (역전) 이면 단일가 두 번 나온 것일 수 있어 판매가만 채택
  if (!Number.isFinite(originalNum) || !Number.isFinite(saleNum) || originalNum <= saleNum) {
    return { original: null, sale: prices[1] || prices[0], discount: null };
  }

  const discount = Math.round((1 - saleNum / originalNum) * 100);
  return {
    original: prices[0],
    sale: prices[1],
    discount: discount > 0 && discount < 100 ? discount : null
  };
}

function parseRankingHtml(html) {
  const $ = cheerio.load(html);
  const results = [];
  const items = $('div.prd_info');

  items.each((idx, el) => {
    const $el = $(el);

    const linkEl = $el.find('a.prd_thumb').first();
    const href = linkEl.attr('href') || $el.find('a[href*="goodsNo"]').first().attr('href') || '';

    const goodsNo =
      linkEl.attr('data-ref-goodsno') ||
      $el.find('button.btn_zzim').first().attr('data-ref-goodsno') ||
      extractGoodsNo(href);

    if (!goodsNo) return;

    const fullUrl = href.startsWith('http')
      ? href
      : (href.startsWith('/')
        ? `https://www.oliveyoung.co.kr${href}`
        : `https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=${goodsNo}`);

    const rankText = $el.find('span.thumb_flag.best').first().text().trim();
    let rank = parseInt(rankText, 10);
    if (isNaN(rank)) rank = idx + 1;

    const productName =
      $el.find('button.btn_zzim').first().attr('data-ref-goodsnm') ||
      $el.find('div.prd_name').first().text().trim() ||
      linkEl.find('img').attr('alt') ||
      null;

    const brandName =
      $el.find('button.btn_zzim').first().attr('data-ref-goodsbrand') ||
      null;

    // 가격: 줄바꿈 포함 raw 텍스트에서 파싱
    const priceRaw = $el.find('p.prd_price').first().text() || '';
    const priceText = priceRaw.trim().replace(/\s+/g, ' ') || null;
    const parsedPrice = parsePriceText(priceRaw);

    results.push({
      rank,
      product_name: productName,
      product_url: fullUrl,
      goods_no: goodsNo,
      brand_name: brandName,
      price: priceText,
      original_price: parsedPrice.original,
      sale_price: parsedPrice.sale,
      discount_rate: parsedPrice.discount
    });
  });

  return results;
}

async function scrapeCategoryWithPage(page, category) {
  const url = buildBestListUrl(category);

  try {
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: NAV_TIMEOUT
    });

    await page.waitForSelector('div.prd_info', { timeout: SELECTOR_TIMEOUT });
    // 이미지/CSS 차단했으므로 추가 대기 불필요

    const html = await page.content();
    const items = parseRankingHtml(html);

    if (items.length === 0) {
      return { success: false, items: [], error: 'No items parsed' };
    }
    return { success: true, items, error: null };
  } catch (err) {
    return {
      success: false,
      items: [],
      error: err.message
    };
  }
}

async function launchBrowser() {
  return chromium.launch({
    headless: true,
    proxy: getProxyForPlaywright(),
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled'
    ]
  });
}

async function newPageWithContext(browser) {
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    viewport: VIEWPORT,
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    extraHTTPHeaders: {
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
    },
    ignoreHTTPSErrors: true
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const page = await context.newPage();

  // 트래픽/속도 최적화: 불필요한 리소스 차단
  // - 이미지/폰트/미디어/광고/분석 스크립트 모두 거절
  // - HTML + 필수 JS만 통과 → 트래픽 약 70~80% 감소, 속도 약 3~5배 향상
  await page.route('**/*', (route) => {
    const req = route.request();
    const type = req.resourceType();
    const url = req.url();

    // 1) 무거운 리소스 차단
    if (type === 'image' || type === 'media' || type === 'font' || type === 'stylesheet') {
      return route.abort();
    }
    // 2) 분석/광고/추적 도메인 차단
    if (/google-analytics|googletagmanager|facebook|datadog|criteo|adservice|doubleclick|appier|braze/i.test(url)) {
      return route.abort();
    }
    return route.continue();
  });

  return { context, page };
}

/**
 * 21개 카테고리 전체 수집 (1개 브라우저 인스턴스 재사용 + 실패 카테고리 재시도)
 * @param {object} options
 * @param {function} options.onProgress - (idx, total, category, result, attempt) => void
 * @param {AbortSignal} options.signal - 중단 신호
 * @param {number} options.maxRetries - 실패 시 재시도 횟수 (기본 2 → 총 3회 시도)
 * @returns {Promise<{successCount, failCount, errors, items, proxyEnabled}>}
 */
async function scrapeAllCategories({ onProgress, signal, maxRetries = 2 } = {}) {
  let browser;
  const itemsByCategoryId = new Map();
  const errorByCategoryId = new Map();
  let retryAttempts = 0;       // 재시도 라운드 수 (0=1차만, 1=2차 했음, 2=3차 했음)
  let totalAttempts = 0;       // 카테고리 시도 총 횟수 (재시도 포함)

  try {
    browser = await launchBrowser();
    let { context, page } = await newPageWithContext(browser);

    // attempt 0 (1차) → 21개 모두 시도
    // attempt 1, 2 (재시도) → 실패한 카테고리만 다시
    let pendingCategories = CATEGORIES.slice();

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (signal && signal.aborted) break;
      if (pendingCategories.length === 0) break;

      if (attempt > 0) retryAttempts = attempt;

      // 재시도 시 새로운 브라우저 컨텍스트 사용 (IP 회전 효과)
      if (attempt > 0) {
        try { await context.close(); } catch (_) { /* ignore */ }
        const r = await newPageWithContext(browser);
        context = r.context;
        page = r.page;
        await page.waitForTimeout(2000 + Math.floor(Math.random() * 3000));
      }

      const nextPending = [];

      for (let i = 0; i < pendingCategories.length; i++) {
        if (signal && signal.aborted) break;

        const category = pendingCategories[i];
        totalAttempts++;
        const result = await scrapeCategoryWithPage(page, category);

        // 전체 21개 중 몇 번째인지 (UI 진행률용)
        const globalIdx = CATEGORIES.findIndex((c) => c.id === category.id) + 1;

        if (result.success) {
          itemsByCategoryId.set(category.id, result.items);
          errorByCategoryId.delete(category.id);
        } else {
          errorByCategoryId.set(category.id, result.error);
          nextPending.push(category);
        }

        if (typeof onProgress === 'function') {
          try {
            await onProgress(globalIdx, CATEGORIES.length, category, result, attempt);
          } catch (_) { /* swallow */ }
        }

        if (i < pendingCategories.length - 1 && !(signal && signal.aborted)) {
          const delay = 300 + Math.floor(Math.random() * 700);
          await page.waitForTimeout(delay);
        }
      }

      pendingCategories = nextPending;
    }
  } finally {
    if (browser) {
      try { await browser.close(); } catch (_) { /* swallow */ }
    }
  }

  // 결과 집계 (CATEGORIES 순서 보존)
  const allItems = [];
  let successCount = 0;
  let failCount = 0;
  const errors = [];
  for (const category of CATEGORIES) {
    const items = itemsByCategoryId.get(category.id);
    if (items) {
      successCount++;
      for (const item of items) {
        allItems.push({ ...item, category_id: category.id, category_name: category.name });
      }
    } else {
      failCount++;
      errors.push({ category: category.name, error: errorByCategoryId.get(category.id) || 'unknown' });
    }
  }

  return {
    successCount,
    failCount,
    errors,
    items: allItems,
    proxyEnabled: isProxyEnabled(),
    retryAttempts,
    totalAttempts
  };
}

module.exports = {
  scrapeAllCategories,
  scrapeCategoryWithPage,
  parseRankingHtml,
  extractGoodsNo
};
