const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // env summary (no secrets)
  getEnvSummary: (env) => ipcRenderer.invoke('config:get-env-summary', env),

  // connection test (선택)
  testConnection: (env) => ipcRenderer.invoke('connection:test', env),

  // worker
  startWorker: (payload) => ipcRenderer.invoke('worker:start', payload),
  stopWorker: () => ipcRenderer.invoke('worker:stop'),
  getWorkerState: () => ipcRenderer.invoke('worker:state'),

  // misc
  openLogsFolder: () => ipcRenderer.invoke('logs:open-folder'),
  openExternal: (url) => ipcRenderer.invoke('web:open', url),

  // events
  onProgress: (handler) => {
    const listener = (_e, payload) => handler(payload);
    ipcRenderer.on('worker:progress', listener);
    return () => ipcRenderer.removeListener('worker:progress', listener);
  }
});
