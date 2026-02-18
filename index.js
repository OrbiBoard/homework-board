const { BrowserWindow, app } = require('electron');
const path = require('path');
const fs = require('fs');

let addWindow = null;
let pluginApi = null;

// New Data Directory: userData/data/homework-board/
const DATA_DIR = path.join(app.getPath('userData'), 'data', 'homework-board');

// Ensure directory exists
try {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
} catch (e) {
    console.error('Failed to create data dir:', e);
}

console.log('[Homework] Using Data Dir:', DATA_DIR);

function getFilePath(date) {
    // Sanitize filename just in case, though date comes from date picker usually
    const safeDate = String(date).replace(/[^a-zA-Z0-9-]/g, '');
    return path.join(DATA_DIR, `${safeDate}.json`);
}

function loadData(date) {
    try {
        const filePath = getFilePath(date);
        if (!fs.existsSync(filePath)) return null;
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw || 'null');
    } catch (e) {
        console.error(`[Homework] Load error for ${date}:`, e);
        return null;
    }
}

function saveData(date, data) {
    try {
        const filePath = getFilePath(date);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
        return true;
    } catch (e) {
        console.error(`[Homework] Save error for ${date}:`, e);
        return false;
    }
}

module.exports = {
  name: '每日作业',
  init: (api) => {
    pluginApi = api;
    console.log('Homework Board plugin initialized. Data Dir:', DATA_DIR);
  },
  functions: {
    openAddWindow: () => {
      if (addWindow && !addWindow.isDestroyed()) {
        addWindow.show();
        addWindow.focus();
        return { ok: true };
      }

      addWindow = new BrowserWindow({
        width: 600,
        height: 600,
        title: '添加作业',
        autoHideMenuBar: true,
        backgroundColor: '#1e1e1e',
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false
        }
      });

      addWindow.loadFile(path.join(__dirname, 'add-homework.html'));

      addWindow.on('closed', () => {
        addWindow = null;
      });
      return { ok: true };
    },
    getHomework: (date) => {
        try {
            const key = String(date).trim();
            console.log(`[Homework] Requesting date: "${key}"`);
            
            const content = loadData(key);
            
            console.log(`Get Homework [${key}]:`, content ? (Array.isArray(content) ? `Found (${content.length} items)` : 'Found (Object)') : 'Empty');
            return { ok: true, data: content || '' };
        } catch (e) {
            console.error('Get Homework Error:', e);
            return { ok: false, error: e.message };
        }
    },
    saveHomework: (date, content) => {
        try {
            const key = String(date).trim();
            console.log(`[Homework] Saving [${key}]`);
            
            // Validate content
            if (content === undefined) {
                return { ok: false, error: 'Content is undefined' };
            }

            if (saveData(key, content)) {
                // Verify write
                const verify = loadData(key);
                const verifyContent = JSON.stringify(verify);
                const originalContent = JSON.stringify(content);
                
                if (verifyContent !== originalContent) {
                    console.error('[Homework] Verify failed! Disk content does not match.');
                    return { ok: false, error: 'Write verification failed' };
                }

                // Notify widgets
                if (pluginApi) {
                    pluginApi.emit('homework-board:update', { date: key, content });
                }
                return { ok: true, path: getFilePath(key) };
            } else {
                return { ok: false, error: 'Failed to write to disk' };
            }
        } catch (e) {
            console.error('[Homework] Save Error:', e);
            return { ok: false, error: e.message };
        }
    },
    getDataPath: () => {
        return DATA_DIR;
    }
  }
};
