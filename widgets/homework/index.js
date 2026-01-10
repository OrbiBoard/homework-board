const { ipcRenderer } = require('electron');

const dateDisplay = document.getElementById('date-display');
const contentDiv = document.getElementById('homework-content');
const refreshBtn = document.getElementById('refresh-btn');
const addBtn = document.getElementById('add-btn');

let currentFontSize = 14;

function getLocalISODate() {
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
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
        const res = await ipcRenderer.invoke('plugin:call', 'homework-board', 'getHomework', [date]);
        renderHomework(res && res.ok ? res.data : null);
    } catch (e) {
        contentDiv.innerHTML = '<div class="empty">加载失败</div>';
        console.error(e);
    }
}

function renderHomework(data) {
    contentDiv.innerHTML = '';
    
    if (!data || (Array.isArray(data) && data.length === 0)) {
        contentDiv.innerHTML = '<div class="empty">今日暂无作业<br>点击 + 号添加</div>';
        return;
    }

    // Handle string data (legacy or JSON string)
    if (typeof data === 'string') {
        try {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
                renderList(parsed);
            } else {
                renderSingleItem('备注', data);
            }
        } catch {
            renderSingleItem('作业', data);
        }
        return;
    }

    // Handle Array data
    if (Array.isArray(data)) {
        renderList(data);
    }
}

function renderList(items) {
    items.forEach(item => {
        if (!item.content && !item.subject) return;
        const row = document.createElement('div');
        row.className = 'homework-item';
        
        const subject = item.subject || '其他';
        const content = item.content || '';
        
        row.innerHTML = `
            <div class="subject-tag" style="font-size: ${currentFontSize}px">${subject}</div>
            <div class="homework-text" style="font-size: ${currentFontSize}px">${content}</div>
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
