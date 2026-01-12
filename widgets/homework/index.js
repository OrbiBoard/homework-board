const { ipcRenderer } = require('electron');

const dateDisplay = document.getElementById('date-display');
const contentDiv = document.getElementById('homework-content');
const refreshBtn = document.getElementById('refresh-btn');
const addBtn = document.getElementById('add-btn');

let currentFontSize = 14;

function getLocalISODate() {
    const d = new Date();
    // To ensure consistency with the input[type="date"] value which is local YYYY-MM-DD
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDateDisplay(dateStr) {
    const today = getLocalISODate();
    if (dateStr === today) return '今日作业';
    return dateStr + ' 作业';
}

async function loadHomework() {
    const date = getLocalISODate();
    dateDisplay.textContent = formatDateDisplay(date);
    
    try {
        console.log('Fetching homework for date:', date);
        const res = await ipcRenderer.invoke('plugin:call', 'homework-board', 'getHomework', [date]);
        console.log('Get homework response:', res);
        
        if (res && res.ok) {
            renderHomework(res.data);
        } else {
            console.error('Get homework failed:', res);
            contentDiv.innerHTML = '<div class="empty">加载失败</div>';
        }
    } catch (e) {
        contentDiv.innerHTML = '<div class="empty">加载错误</div>';
        console.error('Load Error:', e);
    }
}

function renderHomework(data) {
    console.log('Rendering Data:', typeof data, data);
    contentDiv.innerHTML = '';
    
    if (!data) {
        contentDiv.innerHTML = '<div class="empty">今日暂无作业<br>点击 + 号添加</div>';
        return;
    }

    let items = [];

    // Handle string data (legacy or JSON string)
    if (typeof data === 'string') {
        try {
            // Try to parse
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
                items = parsed;
            } else if (typeof parsed === 'object') {
                // If it's an object but not array, maybe legacy format?
                // Or maybe it's just a single object item?
                items = [parsed];
            } else {
                // Primitive value?
                items = [{ subject: '备注', content: String(parsed) }];
            }
        } catch (e) {
            console.warn('JSON parse failed, treating as raw string:', e);
            // Treat as raw text if not empty
            if (data.trim()) {
                items = [{ subject: '作业', content: data }];
            }
        }
    } else if (Array.isArray(data)) {
        items = data;
    } else if (typeof data === 'object') {
        items = [data]; // Single object
    }

    if (items.length === 0) {
        contentDiv.innerHTML = '<div class="empty">今日暂无作业<br>点击 + 号添加</div>';
        return;
    }

    renderList(items);
}

function renderList(items) {
    console.log('Rendering List Items:', items);
    items.forEach(item => {
        // Skip if subject is missing, but allow empty content
        if (!item || !item.subject) return;
        
        const row = document.createElement('div');
        row.className = 'homework-item';
        
        const subject = item.subject || '其他';
        const content = item.content || '';
        
        // Ensure content is visible even if empty (min-height handled by CSS usually, but adding &nbsp; if really needed?)
        // CSS has padding, so it should be fine.
        
        row.innerHTML = `
            <div class="subject-tag" style="font-size: ${currentFontSize}px">${subject}</div>
            <div class="homework-text" style="font-size: ${currentFontSize}px">${content || '&nbsp;'}</div>
        `;
        contentDiv.appendChild(row);
    });
}

function renderSingleItem(subject, content) {
    const row = document.createElement('div');
    row.className = 'homework-item';
    row.innerHTML = `
        <div class="subject-tag" style="font-size: ${currentFontSize}px">${subject}</div>
        <div class="homework-text" style="font-size: ${currentFontSize}px">${content}</div>
    `;
    contentDiv.appendChild(row);
}

// Config Listener
ipcRenderer.on('config-updated', (event, newConfig) => {
    if (newConfig && newConfig.fontSize) {
        currentFontSize = newConfig.fontSize;
        // Re-render to apply font size
        loadHomework();
    }
});

// Initial load
loadHomework();

// Subscribe to updates
ipcRenderer.send('plugin:event:subscribe', 'homework-board:update');
ipcRenderer.on('plugin:event', (event, { name, payload }) => {
    if (name === 'homework-board:update') {
        if (payload.date === getLocalISODate()) {
            renderHomework(payload.content);
        }
    }
});

refreshBtn.addEventListener('click', () => {
    loadHomework();
    refreshBtn.classList.add('spinning');
    setTimeout(() => { refreshBtn.classList.remove('spinning'); }, 500);
});

addBtn.addEventListener('click', () => {
    ipcRenderer.invoke('plugin:call', 'homework-board', 'openAddWindow', []);
});

// Auto refresh at midnight
setInterval(() => {
    const date = getLocalISODate();
    if (dateDisplay.textContent !== formatDateDisplay(date)) {
        loadHomework();
    }
}, 60000);
