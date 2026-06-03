const { app, BrowserWindow, Tray, Menu, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Generate a local auth token for this session
const LOCAL_AUTH_TOKEN = crypto.randomBytes(32).toString('hex');
process.env.LOCAL_AUTH_TOKEN = LOCAL_AUTH_TOKEN;

let mainWindow = null;
let tray = null;
let serverProcess = null;
let isQuitting = false;

const PORT = getPort();
const HOST = '127.0.0.1';

function getPort() {
  try {
    const configPath = path.join(app.getPath('userData'), 'data', 'config.json');
    if (fs.existsSync(configPath)) {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return cfg.port || 18080;
    }
  } catch (e) {}
  return 18080;
}

function startServer() {
  return new Promise((resolve, reject) => {
    const bundlePath = path.join(__dirname, 'dist', 'bundle.js');
    if (!fs.existsSync(bundlePath)) {
      reject(new Error('bundle.js not found at: ' + bundlePath));
      return;
    }

    // For packaged app, extract bundle to temp dir (asar files can't be forked)
    let serverScript = bundlePath;
    const isAsar = __dirname.includes('app.asar');
    if (isAsar) {
      const tmpDir = path.join(app.getPath('userData'), 'server');
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      const tmpBundle = path.join(tmpDir, 'bundle.js');
      fs.copyFileSync(bundlePath, tmpBundle);
      // Also copy public directory
      const tmpPublic = path.join(tmpDir, 'public');
      if (!fs.existsSync(tmpPublic)) fs.mkdirSync(tmpPublic, { recursive: true });
      const htmlSrc = path.join(__dirname, 'public', 'index.html');
      if (fs.existsSync(htmlSrc)) {
        fs.copyFileSync(htmlSrc, path.join(tmpPublic, 'index.html'));
      }
      serverScript = tmpBundle;
    }

    // Set environment for the server
    process.env.ORCA_BASE_DIR = app.getPath('userData');

    // Fork the server process
    const { fork } = require('child_process');
    serverProcess = fork(serverScript, [], {
      env: { ...process.env, ORCA_BASE_DIR: app.getPath('userData'), LOCAL_AUTH_TOKEN },
      silent: true
    });

    serverProcess.stdout.on('data', (data) => {
      const msg = data.toString();
      console.log('[Server]', msg);
      if (msg.includes('Listening on')) {
        resolve();
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error('[Server Error]', data.toString());
    });

    serverProcess.on('error', (err) => {
      console.error('Server process error:', err);
      reject(err);
    });

    serverProcess.on('exit', (code) => {
      console.log('Server process exited with code:', code);
      serverProcess = null;
      if (!isQuitting) {
        // Auto-restart on unexpected exit
        setTimeout(() => startServer().catch(console.error), 2000);
      }
    });

    // Timeout fallback
    setTimeout(resolve, 3000);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Orca Universal Proxy',
    icon: getIconPath(),
    show: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0b0d14',
      symbolColor: '#6b7094',
      height: 38
    },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Load the server URL with auth token
  const url = `http://${HOST}:${PORT}?token=${LOCAL_AUTH_TOKEN}`;
  mainWindow.loadURL(url);

  // Show when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Minimize to tray instead of closing
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function getIconPath() {
  const iconPaths = [
    path.join(__dirname, 'assets', 'icon.ico'),
    path.join(__dirname, 'assets', 'icon.png'),
    path.join(__dirname, 'public', 'favicon.ico')
  ];
  for (const p of iconPaths) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

function createTray() {
  const iconPath = getIconPath();
  let trayIcon;
  if (iconPath && iconPath.endsWith('.ico')) {
    trayIcon = nativeImage.createFromPath(iconPath);
  } else {
    // Create a simple 16x16 icon
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('Orca Universal Proxy v2.1.0');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: `打开 Web 界面`,
      click: () => {
        shell.openExternal(`http://${HOST}:${PORT}?token=${LOCAL_AUTH_TOKEN}`);
      }
    },
    { type: 'separator' },
    {
      label: '服务状态: 运行中',
      enabled: false
    },
    {
      label: `端口: ${PORT}`,
      enabled: false
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true;
        if (serverProcess) {
          serverProcess.kill();
        }
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// App lifecycle
app.whenReady().then(async () => {
  // Copy data files to userData if needed
  copyDataFiles();

  // Start the Express server
  try {
    await startServer();
    console.log('Server started successfully');
  } catch (err) {
    console.error('Failed to start server:', err);
  }

  // Create the native window
  createWindow();

  // Create system tray
  createTray();
});

app.on('window-all-closed', () => {
  // Don't quit - keep running in tray
  if (process.platform !== 'darwin' && isQuitting) {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  if (serverProcess) {
    serverProcess.kill();
  }
});

function copyDataFiles() {
  const userData = app.getPath('userData');
  const dataDir = path.join(userData, 'data');

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Copy default config if not exists
  const configPath = path.join(dataDir, 'config.json');
  if (!fs.existsSync(configPath)) {
    const defaultConfig = {
      activeProviderId: 'deepseek',
      providerKeys: {},
      customProviders: [],
      modelOverrides: {},
      port: 18080,
      logLevel: 'info'
    };
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
  }

  // Copy .env if exists in app resources
  const envSrc = path.join(__dirname, '.env');
  const envDst = path.join(userData, '.env');
  if (fs.existsSync(envSrc) && !fs.existsSync(envDst)) {
    fs.copyFileSync(envSrc, envDst);
  }
}
