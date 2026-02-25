let globalHistory = [];
let currentFilteredHistory = [];
let histFilterTimeout = null;

async function loadHistory() {
    try {
        const res = await fetch(`${API_URL}/history`);
        globalHistory = await res.json();

        // Mới nhất lên đầu
        globalHistory.sort((a, b) => b.id - a.id);

        currentFilteredHistory = globalHistory;
        renderHistory();

    } catch (err) {
        console.error("Lỗi tải lịch sử", err);
    }
}

// Hàm vẽ bảng
function renderHistory() {
    const tbody = document.getElementById('table-history-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (currentFilteredHistory.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px;">Không tìm thấy lịch sử phù hợp!</td></tr>`;
        return;
    }

    currentFilteredHistory.forEach((log, index) => {
        let color = 'black';
        const actionCheck = (log.action || '').toLowerCase();

        if (actionCheck.includes('thêm')) color = 'green';
        if (actionCheck.includes('sửa') || actionCheck.includes('cập nhật')) color = 'blue';
        if (actionCheck.includes('xóa')) color = 'red';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="text-align:center">${index + 1}</td>
            <td>${log.time}</td>
            <td style="color:${color}; font-weight:bold">${log.action}</td>
            <td><span class="tag-badge-cell">${log.module}</span></td>
            <td>${log.details}</td>
            <td style="color:#666">${log.ip === '127.0.0.1' ? 'Máy chủ (Local)' : log.ip}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Hàm xử lý độ trễ gõ phím
function filterHistory() {
    if (histFilterTimeout) clearTimeout(histFilterTimeout);
    histFilterTimeout = setTimeout(() => { executeHistFilter(); }, 300);
}

// Hàm thực thi bộ lọc
function executeHistFilter() {
    const fTime = document.getElementById('f-hist-time').value; // Định dạng YYYY-MM-DD
    const fAction = document.getElementById('f-hist-action').value.toLowerCase();
    const fModule = document.getElementById('f-hist-module').value.toLowerCase();
    const fDetails = document.getElementById('f-hist-details').value.toLowerCase();
    const fIp = document.getElementById('f-hist-ip').value.toLowerCase();

    currentFilteredHistory = globalHistory.filter(log => {
        // 1. Lọc theo ngày
        let matchTime = true;
        if (fTime) {
            // log.time của ta đang là "16:18:48 25/02/2026"
            const datePart = log.time.split(' ')[1]; // Lấy "25/02/2026"
            if (datePart) {
                const [d, m, y] = datePart.split('/');
                const logDateIso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                if (logDateIso !== fTime) matchTime = false;
            } else {
                matchTime = false;
            }
        }

        // 2. Lọc các trường text
        const matchAction = (log.action || '').toLowerCase().includes(fAction);
        const matchModule = (log.module || '').toLowerCase().includes(fModule);
        const matchDetails = (log.details || '').toLowerCase().includes(fDetails);

        const ipDisplay = log.ip === '127.0.0.1' ? 'máy chủ (local)' : (log.ip || '');
        const matchIp = ipDisplay.toLowerCase().includes(fIp);

        return matchTime && matchAction && matchModule && matchDetails && matchIp;
    });

    renderHistory();
}