#!/usr/bin/env node
/**
 * 올리브영 카테고리 BEST 랭킹 자동 수집 워커 (PC 로컬 전용)
 *
 * 사용법:
 *   PC에서 backend/scripts/runRankingWorker.bat 더블클릭
 *   또는: node backend/scripts/runRankingWorker.js
 *
 * 동작:
 *   1. 대화형으로 시작일/종료일/인터벌(분) 입력
 *   2. 정각 기준 + 0~59초 랜덤으로 다음 수집 시각 계산
 *   3. 21개 카테고리 순회 → DB INSERT
 *   4. 종료일 도달 또는 Ctrl+C 시 graceful shutdown
 *
 * 의존성: playwright, playwright-extra, puppeteer-extra-plugin-stealth, node-notifier
 * RDS 외부 접속 가능해야 함 (.env 설정 + 보안그룹 IP 허용)
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const { sequelize, PlatformRanking } = require('../src/models');
const { scrapeAllCategories } = require('../src/services/rankingTracker/playwrightScraper');
const { CATEGORIES } = require('../src/services/rankingTracker/categories');

// node-notifier (옵션)
let notifier = null;
try {
  notifier = require('node-notifier');
} catch (_) {
  // 없으면 알림만 생략
}

// ===== 로그 =====
const LOGS_DIR = path.join(__dirname, '..', 'logs');
fs.mkdirSync(LOGS_DIR, { recursive: true });

let currentLogFile = null;
let currentLogStream = null;

function logFilePath(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return path.join(LOGS_DIR, `ranking-worker-${yyyy}-${mm}-${dd}.log`);
}

function ensureLogStream() {
  const target = logFilePath();
  if (target !== currentLogFile) {
    if (currentLogStream) {
      try { currentLogStream.end(); } catch (_) { /* ignore */ }
    }
    currentLogStream = fs.createWriteStream(target, { flags: 'a' });
    currentLogFile = target;
  }
  return currentLogStream;
}

function fmtTs(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function fmtDate(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function logLine(level, msg) {
  const line = `[${fmtTs()}] [${level}] ${msg}`;
  console.log(line);
  try {
    ensureLogStream().write(line + '\n');
  } catch (_) { /* ignore */ }
}

const log = {
  info: (msg) => logLine('INFO', msg),
  warn: (msg) => logLine('WARN', msg),
  error: (msg) => logLine('ERROR', msg)
};

function notify(title, message, isError = false) {
  if (!notifier) return;
  try {
    notifier.notify({
      title,
      message,
      sound: isError,
      wait: false,
      timeout: 10
    });
  } catch (_) { /* ignore */ }
}

// ===== 대화형 입력 =====
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

function isValidDateString(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function parseDate(s) {
  if (!isValidDateString(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}

async function inputStartDate() {
  while (true) {
    console.log('\n[1/4] 수집을 시작할 날짜를 입력하세요.');
    console.log('  형식: YYYY-MM-DD (예: 2026-05-01)');
    console.log('  ※ 그냥 Enter를 누르면 "지금 이 시각"부터 시작합니다.\n');
    const ans = await ask('  → 시작일: ');
    if (ans === '') {
      // 빈 입력 = 지금 이 시각
      return new Date();
    }
    const d = parseDate(ans);
    if (!d) {
      console.log('  ❌ 형식이 잘못됐어요. 예: 2026-05-01 처럼 입력해주세요.');
      continue;
    }
    // 직접 입력한 날짜 = 그 날짜의 00:00:00
    return d;
  }
}

async function inputEndDate(startDate) {
  while (true) {
    console.log('\n[2/4] 수집을 종료할 날짜를 입력하세요.');
    console.log('  형식: YYYY-MM-DD (예: 2026-05-31)');
    console.log('  ※ 종료일 23:59:59까지 자동으로 수집합니다.');
    console.log('  ※ 시작일과 같은 날짜를 입력하면 그날 23:59:59까지만 수집합니다.\n');
    const ans = await ask('  → 종료일: ');
    if (ans === '') {
      console.log('  ❌ 종료일은 필수입니다.');
      continue;
    }
    const d = parseDate(ans);
    if (!d) {
      console.log('  ❌ 형식이 잘못됐어요. 예: 2026-05-31 처럼 입력해주세요.');
      continue;
    }
    d.setHours(23, 59, 59, 999);
    if (d < startDate) {
      console.log('  ❌ 종료일이 시작일보다 빨라요. 다시 입력해주세요.');
      continue;
    }
    return d;
  }
}

async function inputInterval() {
  while (true) {
    console.log('\n[3/4] 몇 분마다 수집할까요?');
    console.log('  추천:');
    console.log('    20  → 20분마다 (하루 약 72회, 데이터 풍부)');
    console.log('    30  → 30분마다 (하루 약 48회)');
    console.log('    60  → 1시간마다 (하루 약 24회, 가벼움)');
    console.log('  ※ 너무 짧게 하면 올리브영에서 차단당할 수 있어요.');
    console.log('  ※ 10분 미만은 권장하지 않습니다.\n');
    const ans = await ask('  → 인터벌(분) [기본 20]: ');
    const value = ans === '' ? 20 : Number(ans);
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      console.log('  ❌ 숫자만 입력해주세요. 예: 20');
      continue;
    }
    if (value < 1) {
      console.log('  ❌ 1 이상 숫자를 입력해주세요.');
      continue;
    }
    if (value > 1440) {
      console.log('  ❌ 1440분(24시간) 이하로 입력해주세요.');
      continue;
    }
    if (value < 10) {
      const conf = await ask('  ⚠️  너무 짧아요. 차단 위험이 있습니다. 그래도 진행할까요? (y/n): ');
      if (conf.toLowerCase() !== 'y') continue;
    }
    return value;
  }
}

async function confirmInputs(startDate, endDate, intervalMin) {
  const totalMs = endDate.getTime() - startDate.getTime();
  const totalMinutes = Math.floor(totalMs / (60 * 1000));
  const expectedRounds = Math.max(0, Math.floor(totalMinutes / intervalMin));
  const expectedRows = expectedRounds * 21 * 100;

  // 첫 수집 시각: startDate 시점에서 다음 정각 슬롯
  const firstSchedule = computeNextSchedule(intervalMin, startDate);

  console.log('\n[4/4] 입력하신 내용을 확인해주세요.\n');
  console.log('  ┌─────────────────────────────────────────────────┐');
  console.log(`  │ 시작 시각:    ${fmtTs(startDate).padEnd(34)} │`);
  console.log(`  │ 종료 시각:    ${fmtTs(endDate).padEnd(34)} │`);
  console.log(`  │ 인터벌:       ${(intervalMin + '분').padEnd(34)} │`);
  console.log(`  │ 예상 라운드:  약 ${(expectedRounds.toLocaleString() + '회').padEnd(31)} │`);
  console.log(`  │ 예상 데이터:  약 ${(expectedRows.toLocaleString() + '개').padEnd(31)} │`);
  console.log('  │                                                 │');
  console.log(`  │ 첫 수집 예정: ${fmtTs(firstSchedule).padEnd(34)} │`);
  console.log('  └─────────────────────────────────────────────────┘\n');
  console.log('  맞으면 y, 다시 입력하려면 n을 누르세요.\n');
  const ans = await ask('  → 시작할까요? (y/n): ');
  return ans.toLowerCase() === 'y';
}

// ===== 인터벌 계산 (정각 기준 + 0~59초 랜덤) =====
function computeNextSchedule(intervalMin, after = new Date()) {
  const ref = new Date(after);
  ref.setMilliseconds(0);

  // 인터벌이 60 이상인 경우 (시간 단위) - 다음 정시
  if (intervalMin >= 60) {
    const intervalHours = Math.ceil(intervalMin / 60);
    const next = new Date(ref);
    next.setMinutes(0, 0, 0);
    next.setHours(next.getHours() + intervalHours);
    next.setSeconds(Math.floor(Math.random() * 60));
    if (next <= ref) {
      next.setHours(next.getHours() + intervalHours);
    }
    return next;
  }

  // 분 단위: 정각 그리드 (00, intervalMin, 2*intervalMin, ...)
  const minutes = ref.getMinutes();
  const seconds = ref.getSeconds();
  const slotsInHour = Math.floor(60 / intervalMin);

  // 다음 슬롯 분 계산
  let nextSlotMin = -1;
  for (let i = 1; i <= slotsInHour; i++) {
    const candidate = i * intervalMin;
    if (candidate >= 60) break;
    if (candidate > minutes || (candidate === minutes && seconds < 0)) {
      nextSlotMin = candidate;
      break;
    }
  }

  const next = new Date(ref);
  if (nextSlotMin === -1) {
    // 다음 시간의 0분
    next.setHours(next.getHours() + 1);
    next.setMinutes(0, 0, 0);
  } else {
    next.setMinutes(nextSlotMin, 0, 0);
  }
  next.setSeconds(Math.floor(Math.random() * 60));

  if (next <= ref) {
    next.setMinutes(next.getMinutes() + intervalMin);
  }
  return next;
}

function fmtDuration(ms) {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m === 0) return `${s}초`;
  return `${m}분 ${s}초`;
}

// ===== Sleep with abort =====
function sleepUntil(targetTs, abortSignal) {
  return new Promise((resolve) => {
    const tick = () => {
      if (abortSignal.aborted) {
        resolve('aborted');
        return;
      }
      const remain = targetTs - Date.now();
      if (remain <= 0) {
        resolve('ready');
        return;
      }
      setTimeout(tick, Math.min(remain, 1000));
    };
    tick();
  });
}

// ===== 라운드 실행 =====
async function runRound(roundNumber, abortController) {
  const collectedAt = new Date();
  log.info(`=== 라운드 #${roundNumber} 시작 ===`);

  const result = await scrapeAllCategories({
    signal: abortController.signal,
    onProgress: (idx, total, category, res) => {
      if (res.success) {
        log.info(`[${idx}/${total}] ${category.name} OK (${res.items.length}개)`);
      } else {
        log.error(`[${idx}/${total}] ${category.name} FAIL: ${res.error}`);
      }
    }
  });

  // DB INSERT
  if (result.items.length > 0) {
    const rows = result.items.map((it) => ({
      category_id: it.category_id,
      category_name: it.category_name,
      rank: it.rank,
      product_name: it.product_name,
      brand_name: it.brand_name,
      goods_no: it.goods_no,
      product_url: it.product_url,
      image_url: it.image_url,
      price: it.price,
      original_price: it.original_price,
      sale_price: it.sale_price,
      discount_rate: it.discount_rate,
      collected_at: collectedAt
    }));
    try {
      await PlatformRanking.bulkCreate(rows);
      log.info(`DB INSERT ${rows.length}개 완료`);
    } catch (err) {
      log.error(`DB INSERT 실패: ${err.message}`);
      notify('올리브영 랭킹 워커', `DB 저장 실패: ${err.message}`, true);
    }
  }

  log.info(`=== 라운드 #${roundNumber} 완료 (성공 ${result.successCount}/${CATEGORIES.length}, 실패 ${result.failCount}) ===`);

  if (result.failCount >= Math.ceil(CATEGORIES.length / 2)) {
    notify('올리브영 랭킹 워커', `라운드 #${roundNumber} 절반 이상 실패 (${result.failCount}개)`, true);
  } else if (result.failCount > 0) {
    notify('올리브영 랭킹 워커', `라운드 #${roundNumber} 일부 실패 (${result.failCount}개)`);
  }

  return result;
}

// ===== 메인 =====
let isShuttingDown = false;
let abortController = null;

async function main() {
  console.log('================================================================');
  console.log('        올리브영 카테고리 BEST 랭킹 자동 수집기');
  console.log('================================================================');
  console.log('');
  console.log('이 프로그램은 입력하신 기간 동안, 입력하신 인터벌마다');
  console.log('올리브영 21개 카테고리의 BEST 100위를 자동 수집합니다.');
  console.log('');
  console.log('⚠️  실행하는 동안 컴퓨터를 끄거나 절전 모드에 들어가면 안 됩니다.');
  console.log('⚠️  인터넷이 끊기면 일부 데이터가 누락될 수 있습니다.');
  console.log('----------------------------------------------------------------');

  let startDate, endDate, intervalMin;
  while (true) {
    startDate = await inputStartDate();
    endDate = await inputEndDate(startDate);
    intervalMin = await inputInterval();
    const ok = await confirmInputs(startDate, endDate, intervalMin);
    if (ok) break;
    console.log('\n처음부터 다시 입력합니다.\n');
  }

  // 시작 시각이 과거면 지금으로 보정 (직접 입력한 날짜의 00:00이 이미 지난 경우)
  const now = new Date();
  if (startDate < now) {
    console.log(`\n⚠️  시작 시각이 과거(${fmtTs(startDate)})입니다. 지금 시각(${fmtTs(now)})부터 시작합니다.`);
    startDate = now;
  }

  rl.close();

  // DB 연결
  log.info('================================================================');
  log.info(`워커 시작 (기간: ${fmtDate(startDate)} ~ ${fmtDate(endDate)}, 인터벌: ${intervalMin}분)`);
  try {
    await sequelize.authenticate();
    log.info('DB 연결 성공');
  } catch (err) {
    log.error(`DB 연결 실패: ${err.message}`);
    notify('올리브영 랭킹 워커', `DB 연결 실패: ${err.message}`, true);
    process.exit(1);
  }

  console.log('\n================================================================');
  console.log('✅ 수집 시작됨!');
  console.log('================================================================');
  console.log(`📅 기간: ${fmtDate(startDate)} ~ ${fmtDate(endDate)}`);
  console.log(`⏱️  인터벌: ${intervalMin}분`);
  console.log(`📂 로그 파일: ${currentLogFile}`);
  console.log('-----------------------------------------------------------------');
  console.log('⚠️  배경에 떠있는 "ranking-ssh-tunnel" 창은 절대 닫지 마세요!');
  console.log('   (DB 연결 통로입니다. 닫히면 데이터 저장이 실패합니다)');
  console.log('-----------------------------------------------------------------');

  abortController = new AbortController();

  // SIGINT 핸들러
  let sigintCount = 0;
  process.on('SIGINT', () => {
    sigintCount++;
    if (sigintCount === 1) {
      isShuttingDown = true;
      console.log('\n\n🛑 종료 신호 받음. 안전하게 종료 중... (한 번 더 Ctrl+C 누르면 강제 종료)');
      log.info('SIGINT 수신. graceful shutdown 시작');
      abortController.abort();
    } else {
      console.log('\n강제 종료합니다.');
      process.exit(130);
    }
  });

  let roundNumber = 0;
  let consecutiveFails = 0;

  // 첫 라운드 시각 계산
  let nextRunAt = computeNextSchedule(intervalMin, new Date(Math.max(Date.now(), startDate.getTime())));

  while (!isShuttingDown) {
    if (Date.now() > endDate.getTime()) {
      log.info('종료일 도달. 워커 정상 종료');
      console.log('\n✅ 종료일 도달. 워커가 정상 종료됩니다.');
      break;
    }

    if (nextRunAt.getTime() > endDate.getTime()) {
      log.info('다음 수집 시각이 종료일 이후. 워커 정상 종료');
      console.log('\n✅ 다음 수집 예정이 종료일 이후입니다. 워커가 정상 종료됩니다.');
      break;
    }

    const remain = nextRunAt.getTime() - Date.now();
    console.log(`\n⏰ 다음 수집 예정: ${fmtTs(nextRunAt)} (${fmtDuration(remain)} 남음)`);
    console.log('⏳ 대기 중... (창을 끄지 마세요. 종료하려면 Ctrl+C)');

    const sleepResult = await sleepUntil(nextRunAt.getTime(), abortController.signal);
    if (sleepResult === 'aborted') break;

    roundNumber++;
    console.log(`\n[${fmtTs()}] 🚀 ${roundNumber}회차 수집 시작`);
    try {
      const result = await runRound(roundNumber, abortController);
      if (result.successCount === 0) {
        consecutiveFails++;
        log.error(`라운드 전체 실패. 연속 실패 ${consecutiveFails}회`);
        if (consecutiveFails >= 5) {
          log.error('5회 연속 라운드 실패. 워커 정지');
          notify('올리브영 랭킹 워커', '5회 연속 실패로 워커가 정지되었습니다', true);
          break;
        }
      } else {
        consecutiveFails = 0;
      }
    } catch (err) {
      log.error(`라운드 #${roundNumber} 예외: ${err.message}`);
      notify('올리브영 랭킹 워커', `라운드 예외: ${err.message}`, true);
      consecutiveFails++;
      if (consecutiveFails >= 5) {
        log.error('5회 연속 실패. 워커 정지');
        break;
      }
    }

    if (isShuttingDown) break;

    nextRunAt = computeNextSchedule(intervalMin, new Date());
  }

  console.log('\n================================================================');
  console.log('👋 워커가 종료되었습니다.');
  console.log('');
  console.log('📂 로그 파일 위치:');
  console.log(`   ${currentLogFile}`);
  console.log('');
  console.log('문제가 있었다면 위 로그 파일을 개발자에게 전달해주세요.');
  console.log('================================================================');

  try {
    await sequelize.close();
  } catch (_) { /* ignore */ }
  if (currentLogStream) {
    try { currentLogStream.end(); } catch (_) { /* ignore */ }
  }
}

main().catch((err) => {
  log.error(`FATAL: ${err.message}`);
  if (err.stack) log.error(err.stack);
  notify('올리브영 랭킹 워커', `치명적 오류: ${err.message}`, true);
  process.exit(1);
});
