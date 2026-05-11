const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const log = require('electron-log');

const { startWorker, stopWorker, getWorkerState } = require('./worker');
const { testTunnel } = require('./sshTunnel');
const { testDb } = require('./dbProbe');
const { getConfigForEnv } = require('./embeddedConfig');

log.transports.file.level = 'info';
log.transports.file.maxSize = 10 * 1024 * 1024;
log.info('App starting');

const isDev = process.env.NODE_ENV === 'development';

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 760,
    minWidth: 720,
    minHeight: 600,
    title: '올리브영 랭킹 수집기',
    icon: path.join(__dirname, '../../build/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5174');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist-renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function broadcastProgress(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('worker:progress', payload);
  }
}

// === IPC ===

// 환경별 설정 반환 (UI는 비밀번호 등을 받지 않음, env만 알면 됨)
ipcMain.handle('config:get-env-summary', (_, env) => {
  const cfg = getConfigForEnv(env || 'main');
  return {
    env: cfg.env,
    dbName: cfg.dbName,
    dbHost: cfg.dbHost,
    sshHost: cfg.sshHost
  };
});

// 연결 테스트 (선택)
ipcMain.handle('connection:test', async (_, env) => {
  try {
    const cfg = getConfigForEnv(env || 'main');
    const tunnelResult = await testTunnel(cfg);
    if (!tunnelResult.success) return tunnelResult;
    const dbResult = await testDb({ ...cfg, localPort: tunnelResult.localPort });
    tunnelResult.close && tunnelResult.close();
    return dbResult;
  } catch (err) {
    log.error('connection:test error', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('worker:start', async (_, payload) => {
  try {
    const cfg = getConfigForEnv(payload.env || 'main');
    return await startWorker({ ...cfg, ...payload }, broadcastProgress);
  } catch (err) {
    log.error('worker:start error', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('worker:stop', async () => {
  try {
    await stopWorker();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('worker:state', () => getWorkerState());

ipcMain.handle('logs:open-folder', () => {
  const logPath = log.transports.file.getFile().path;
  shell.showItemInFolder(logPath);
  return { success: true };
});

ipcMain.handle('web:open', (_, url) => {
  shell.openExternal(url);
  return { success: true };
});

// === App lifecycle ===
app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', async () => {
  try { await stopWorker(); } catch (_) { /* ignore */ }
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', async () => {
  try { await stopWorker(); } catch (_) { /* ignore */ }
});

process.on('uncaughtException', (err) => {
  log.error('uncaughtException', err);
});
process.on('unhandledRejection', (err) => {
  log.error('unhandledRejection', err);
});
