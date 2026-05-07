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

    const imageUrl =
      linkEl.find('img').attr('src') ||
      linkEl.find('img').attr('data-original') ||
      null;

    results.push({
      rank,
      product_name: productName,
      product_url: fullUrl,
      goods_no: goodsNo,
      brand_name: brandName,
      price: priceText,
      original_price: parsedPrice.original,
      sale_price: parsedPrice.sale,
      discount_rate: parsedPrice.discount,
      image_url: imageUrl
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
    await page.waitForTimeout(500);

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

/**
 * 21개 카테고리 전체 수집 (1개 브라우저 인스턴스 재사용)
 * @param {object} options
 * @param {function} options.onProgress - (idx, total, category, result) => void
 * @param {AbortSignal} options.signal - 중단 신호
 * @returns {Promise<{successCount, failCount, errors, items}>}
 */
async function scrapeAllCategories({ onProgress, signal } = {}) {
  let browser;
  let successCount = 0;
  let failCount = 0;
  const errors = [];
  const allItems = [];

  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled'
      ]
    });

    const context = await browser.newContext({
      userAgent: USER_AGENT,
      viewport: VIEWPORT,
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
      extraHTTPHeaders: {
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    const page = await context.newPage();

    for (let i = 0; i < CATEGORIES.length; i++) {
      if (signal && signal.aborted) {
        break;
      }

      const category = CATEGORIES[i];
      const result = await scrapeCategoryWithPage(page, category);

      if (result.success) {
        successCount++;
        for (const item of result.items) {
          allItems.push({ ...item, category_id: category.id, category_name: category.name });
        }
      } else {
        failCount++;
        errors.push({ category: category.name, error: result.error });
      }

      if (typeof onProgress === 'function') {
        try {
          await onProgress(i + 1, CATEGORIES.length, category, result);
        } catch (_) { /* swallow */ }
      }

      if (i < CATEGORIES.length - 1 && !(signal && signal.aborted)) {
        const delay = 1000 + Math.floor(Math.random() * 2000);
        await page.waitForTimeout(delay);
      }
    }
  } finally {
    if (browser) {
      try { await browser.close(); } catch (_) { /* swallow */ }
    }
  }

  return { successCount, failCount, errors, items: allItems };
}

module.exports = {
  scrapeAllCategories,
  scrapeCategoryWithPage,
  parseRankingHtml,
  extractGoodsNo
};
