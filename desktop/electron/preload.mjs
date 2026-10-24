import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { contextBridge, ipcRenderer } from 'electron';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { version: appVersion } = require(path.join(__dirname, '..', 'package.json'));

function resolveApiBase() {
  const fromArg = process.argv
    .find((a) => a.startsWith('--basis-api-base='))
    ?.slice('--basis-api-base='.length)
    ?.trim();
  const raw = fromArg || process.env.BASIS_DESKTOP_API_BASE || '';
  return raw.replace(/\/$/, '');
}

const apiBase = resolveApiBase();
const hasCustomWindowControls = process.platform !== 'darwin';

contextBridge.exposeInMainWorld('__BASIS_RUNTIME__', {
  authRequired: false,
  apiBase,
  desktop: true,
  environment: 'local',
  activeTarget: 'local',
  localApiBase: apiBase,
});

contextBridge.exposeInMainWorld('__BASIS_DESKTOP__', {
  apiBase,
  desktop: true,
  authRequired: false,
  hasCustomWindowControls,
  isMac: process.platform === 'darwin',
  windowMinimize: () => {
    ipcRenderer.send('desktop:window-minimize');
  },
  windowMaximize: () => {
    ipcRenderer.send('desktop:window-maximize');
  },
  windowClose: () => {
    ipcRenderer.send('desktop:window-close');
  },
  isWindowMaximized: () => ipcRenderer.invoke('desktop:window-is-maximized'),
  onWindowMaximizedChange: (handler) => {
    const listener = (_event, maximized) => {
      handler(maximized);
    };
    ipcRenderer.on('desktop:window-maximized', listener);
    return () => {
      ipcRenderer.removeListener('desktop:window-maximized', listener);
    };
  },
  appVersion,
  openExternal: (url) => ipcRenderer.invoke('desktop:open-external', url),
});
