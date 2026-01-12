const { BrowserWindow, app } = require('electron');
const path = require('path');
const fs = require('fs');

let addWindow = null;
let pluginApi = null;

// Determine Data Path Strategy
let DATA_PATH;
const LOCAL_DATA_PATH = path.join(__dirname, 'homework_data.json');

// Try to use local path if possible (for portable/dev versions)
let useLocal = false;
try {
    // Check if running from source (not in asar) and directory is writable
    if (!__dirname.includes('.asar')) {
        // Try to write a test file
        const testFile = path.join(__dirname, '.write_test');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        useLocal = true;
    }
} catch (e) {
    console.log('Local write test failed, falling back to userData:', e.message);
}

if (useLocal) {
    DATA_PATH = LOCAL_DATA_PATH;
} else {
    // Fallback to userData
    const DATA_DIR = path.join(app.getPath('userData'), 'homework-board');
    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
    } catch (e) {
        console.error('Failed to create data dir:', e);
    }
    DATA_PATH = path.join(DATA_DIR, 'homework_data.json');
}

// Ensure data file exists
try {
    if (!fs.existsSync(DATA_PATH)) {
        fs.writeFileSync(DATA_PATH, '{}', 'utf-8');
    }
} catch (e) {
    console.error('Failed to init data file:', e);
}

console.log('[Homework] Using Data Path:', DATA_PATH);

function loadData() {
    try {
        if (!fs.existsSync(DATA_PATH)) return {};
        const raw = fs.readFileSync(DATA_PATH, 'utf-8');
        return JSON.parse(raw || '{}');
    } catch (e) {
        console.error('[Homework] Load data error:', e);
        return {};
    }
}

function saveData(data) {
    try {
        fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
        return true;
    } catch (e) {
        console.error('Save data error:', e);
        return false;
    }
}

module.exports = {
  name: '每日作业',
  init: (api) => {
    pluginApi = api;
    console.log('Homework Board plugin initialized. Data Path:', DATA_PATH);
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
            const data = loadData();
            // Normalize date string just in case
            const key = String(date).trim();
            console.log(`[Homework] Requesting date: "${key}"`);
            console.log(`[Homework] Available keys in DB:`, Object.keys(data));
            
            // Try date key, fallback to homework_ prefix just in case
            let content = data[key];
            if (!content && data['homework_' + key]) {
                content = data['homework_' + key];
            }
            
            console.log(`Get Homework [${key}]:`, content ? `Found (${content.length} chars)` : 'Empty');
            // If content is an object (legacy save?), stringify it? 
            // The frontend expects stringified JSON or plain text.
            // If it's already an object in JSON, we should probably return it as is if IPC supports it,
            // but our frontend logic handles string parsing.
            // Let's ensure we return what's stored.
            return { ok: true, data: content || '' };
        } catch (e) {
            console.error('Get Homework Error:', e);
            return { ok: false, error: e.message };
        }
    },
    saveHomework: (date, content) => {
        try {
            const key = String(date).trim();
            console.log(`[Homework] Saving [${key}] to ${DATA_PATH}`);
            
            // Validate content
            if (content === undefined) {
                return { ok: false, error: 'Content is undefined' };
            }

            const data = loadData();
            data[key] = content;
            
            if (saveData(data)) {
                // Verify write
                const verify = loadData();
                if (verify[key] !== content) {
                    console.error('[Homework] Verify failed! Disk content does not match.');
                    return { ok: false, error: 'Write verification failed' };
                }

                // Notify widgets
                if (pluginApi) {
                    pluginApi.emit('homework-board:update', { date: key, content });
                }
                return { ok: true, path: DATA_PATH };
            } else {
                return { ok: false, error: 'Failed to write to disk' };
            }
        } catch (e) {
            console.error('[Homework] Save Error:', e);
            return { ok: false, error: e.message };
        }
    },
    getDataPath: () => {
        return DATA_PATH;
    }
  }
};
