const { BrowserWindow, app } = require('electron');
const path = require('path');
const fs = require('fs');

let addWindow = null;
let pluginApi = null;

// Define data path explicitly
const DATA_PATH = path.join(__dirname, 'homework_data.json');

// Ensure data file exists
if (!fs.existsSync(DATA_PATH)) {
    try {
        fs.writeFileSync(DATA_PATH, '{}', 'utf-8');
    } catch (e) {
        console.error('Failed to init data file:', e);
    }
}

function loadData() {
    try {
        if (!fs.existsSync(DATA_PATH)) return {};
        const raw = fs.readFileSync(DATA_PATH, 'utf-8');
        return JSON.parse(raw || '{}');
    } catch (e) {
        console.error('Load data error:', e);
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
            console.log(`Saving Homework [${key}]`);
            const data = loadData();
            data[key] = content;
            
            if (saveData(data)) {
                // Notify widgets
                if (pluginApi) {
                    pluginApi.emit('homework-board:update', { date: key, content });
                }
                return { ok: true };
            } else {
                return { ok: false, error: 'Failed to write to disk' };
            }
        } catch (e) {
            console.error('Save Homework Error:', e);
            return { ok: false, error: e.message };
        }
    }
  }
};
