const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const log = require('electron-log');
const { Sequelize, DataTypes } = require('sequelize');

const { SshTunnel } = require('./sshTunnel');
const { resolveRankingTrackerPath } = require('./playwrightLaunch');

let runtime = {
  running: false,
  abort: null,
  tunnel: null,
  sequelize: null,
  PlatformRanking: null,
  schedule: { startAt: null, endAt: null, intervalMin: 20 },
  stats: { lastRound: null, totalRounds: 0, totalRows: 0 },
  nextRunAt: null
};

function getWorkerState() {
  return {
    running: runtime.running,
    schedule: runtime.schedule,
    stats: runtime.stats,
    nextRunAt: runtime.nextRunAt
  };
}

function computeNextSchedule(intervalMin, after = new Date()) {
  const ref = new Date(after);
  ref.setMilliseconds(0);
  if (intervalMin >= 60) {
    const intervalHours = Math.ceil(intervalMin / 60);
    const next = new Date(ref);
    next.setMinutes(0, 0, 0);
    next.setHours(next.getHours() + intervalHours);
    next.setSeconds(Math.floor(Math.random() * 60));
    if (next <= ref) next.setHours(next.getHours() + intervalHours);
    return next;
  }
  const minutes = ref.getMinutes();
  const slotsInHour = Math.floor(60 / intervalMin);
  let nextSlotMin = -1;
  for (let i = 1; i <= slotsInHour; i++) {
    const c = i * intervalMin;
    if (c >= 60) break;
    if (c > minutes) { nextSlotMin = c; break; }
  }
  const next = new Date(ref);
  if (nextSlotMin === -1) {
    next.setHours(next.getHours() + 1);
    next.setMinutes(0, 0, 0);
  } else {
    next.setMinutes(nextSlotMin, 0, 0);
  }
  next.setSeconds(Math.floor(Math.random() * 60));
  if (next <= ref) next.setMinutes(next.getMinutes() + intervalMin);
  return next;
}

function sleepUntil(targetTs, signal) {
  return new Promise((resolve) => {
    const tick = () => {
      if (signal && signal.aborted) return resolve('aborted');
      const remain = targetTs - Date.now();
      if (remain <= 0) return resolve('ready');
      setTimeout(tick, Math.min(remain, 1000));
    };
    tick();
  });
}

function definePlatformRankingModel(sequelize) {
  return sequelize.define('PlatformRanking', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    category_id: { type: DataTypes.STRING(50), allowNull: false },
    category_name: { type: DataTypes.STRING(100), allowNull: false },
    rank: { type: DataTypes.INTEGER, allowNull: false },
    product_name: DataTypes.TEXT,
    brand_name: DataTypes.STRING(255),
    goods_no: DataTypes.STRING(100),
    product_url: DataTypes.TEXT,
    image_url: DataTypes.TEXT,
    price: DataTypes.STRING(255),
    original_price: DataTypes.STRING(50),
    sale_price: DataTypes.STRING(50),
    discount_rate: DataTypes.INTEGER,
    collected_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'platform_rankings',
    timestamps: false
  });
}

async function startWorker(payload, emit) {
  if (runtime.running) {
    return { success: false, error: '이미 실행 중입니다' };
  }

  // schedule
  const startAt = payload.startAt ? new Date(payload.startAt) : new Date();
  const endAt = payload.endAt ? new Date(payload.endAt) : null;
  const intervalMin = Math.max(1, Math.min(1440, parseInt(payload.intervalMin || 20, 10)));
  if (!endAt) return { success: false, error: '종료 일시가 필요합니다' };
  if (endAt < startAt) return { success: false, error: '종료 시각이 시작보다 빠릅니다' };

  // SSH tunnel
  const tunnel = new SshTunnel();
  let localPort;
  try {
    const r = await tunnel.open(payload);
    localPort = r.localPort;
    emit && emit({ type: 'tunnel', status: 'open', localPort });
  } catch (err) {
    return { success: false, error: `SSH 터널 실패: ${err.message}` };
  }

  // Sequelize (RDS는 SSL 필수, 자체서명이라 검증 비활성)
  const sequelize = new Sequelize(payload.dbName, payload.dbUser, payload.dbPassword, {
    host: '127.0.0.1',
    port: localPort,
    dialect: 'postgres',
    logging: false,
    pool: { max: 3 },
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }
  });
  try {
    await sequelize.authenticate();
    emit && emit({ type: 'db', status: 'connected' });
  } catch (err) {
    tunnel.close();
    return { success: false, error: `DB 연결 실패: ${err.message}` };
  }

  const PlatformRanking = definePlatformRankingModel(sequelize);

  // playwright scraper (extraResources 또는 backend 폴더)
  const trackerDir = resolveRankingTrackerPath();
  const { scrapeAllCategories } = require(path.join(trackerDir, 'playwrightScraper'));
  const { CATEGORIES } = require(path.join(trackerDir, 'categories'));

  const abort = new AbortController();
  runtime = {
    running: true,
    abort,
    tunnel,
    sequelize,
    PlatformRanking,
    schedule: { startAt, endAt, intervalMin },
    stats: { lastRound: null, totalRounds: 0, totalRows: 0 },
    nextRunAt: null
  };

  // 비동기 메인 루프 (await 안 함, 호출자에게는 곧장 success 반환)
  (async () => {
    log.info(`Worker started: ${startAt.toISOString()} ~ ${endAt.toISOString()}, every ${intervalMin}m`);
    let roundNumber = 0;
    let consecutiveFails = 0;
    let nextRunAt = computeNextSchedule(intervalMin, new Date(Math.max(Date.now(), startAt.getTime())));
    runtime.nextRunAt = nextRunAt;
    emit && emit({ type: 'schedule', nextRunAt });

    while (runtime.running) {
      if (Date.now() > endAt.getTime()) {
        emit && emit({ type: 'finished', reason: 'end-date-reached' });
        break;
      }
      if (nextRunAt.getTime() > endAt.getTime()) {
        emit && emit({ type: 'finished', reason: 'next-run-after-end' });
        break;
      }

      runtime.nextRunAt = nextRunAt;
      emit && emit({ type: 'waiting', nextRunAt });

      const r = await sleepUntil(nextRunAt.getTime(), abort.signal);
      if (r === 'aborted') break;

      roundNumber++;
      const collectedAt = new Date();
      emit && emit({ type: 'round-start', round: roundNumber, total: CATEGORIES.length, collectedAt });

      try {
        const result = await scrapeAllCategories({
          signal: abort.signal,
          onProgress: (idx, total, category, res) => {
            emit && emit({
              type: 'progress',
              round: roundNumber,
              idx,
              total,
              category: category.name,
              success: res.success,
              items: res.items.length,
              error: res.error
            });
          }
        });

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
            runtime.stats.totalRows += rows.length;
          } catch (err) {
            log.error('INSERT failed', err.message);
            emit && emit({ type: 'db-error', error: err.message });
          }
        }

        runtime.stats.totalRounds++;
        runtime.stats.lastRound = {
          number: roundNumber,
          successCount: result.successCount,
          failCount: result.failCount,
          insertedRows: result.items.length,
          completedAt: new Date()
        };

        emit && emit({
          type: 'round-complete',
          round: roundNumber,
          successCount: result.successCount,
          failCount: result.failCount,
          insertedRows: result.items.length
        });

        consecutiveFails = result.successCount === 0 ? consecutiveFails + 1 : 0;
        if (consecutiveFails >= 5) {
          emit && emit({ type: 'fatal', reason: '5회 연속 라운드 실패' });
          break;
        }
      } catch (err) {
        log.error('Round exception', err);
        emit && emit({ type: 'round-exception', round: roundNumber, error: err.message });
        consecutiveFails++;
        if (consecutiveFails >= 5) break;
      }

      if (!runtime.running) break;
      nextRunAt = computeNextSchedule(intervalMin, new Date());
    }

    // cleanup
    log.info('Worker loop ended');
    try { await sequelize.close(); } catch (_) { /* ignore */ }
    try { tunnel.close(); } catch (_) { /* ignore */ }
    runtime.running = false;
    runtime.abort = null;
    runtime.tunnel = null;
    runtime.sequelize = null;
    runtime.nextRunAt = null;
    emit && emit({ type: 'stopped' });
  })().catch((err) => {
    log.error('Worker fatal', err);
    runtime.running = false;
  });

  return { success: true };
}

async function stopWorker() {
  if (!runtime.running) return;
  log.info('Stop requested');
  runtime.running = false;
  try { runtime.abort && runtime.abort.abort(); } catch (_) { /* ignore */ }
  // wait briefly for cleanup
  await new Promise((res) => setTimeout(res, 500));
  try { runtime.sequelize && (await runtime.sequelize.close()); } catch (_) { /* ignore */ }
  try { runtime.tunnel && runtime.tunnel.close(); } catch (_) { /* ignore */ }
  runtime.tunnel = null;
  runtime.sequelize = null;
  runtime.nextRunAt = null;
}

module.exports = { startWorker, stopWorker, getWorkerState };
