/**
 * FILE: code/js/fund.js
 * Logic quản lý thu chi:
 * 1. Tính toán số dư lũy kế (Sắp xếp cũ -> mới để cộng dồn).
 * 2. Hiển thị (Sắp xếp mới -> cũ).
 * 3. Filter giống Excel.
 * 4. Modal nhập liệu & Bảo mật mật khẩu Session.
 */

let globalTransactions = [];
let currentFilteredFund = [];
let fundFilterTimeout = null;

// Phân trang
let curFundPage = 1;
let rowsPerFundPage = 20;
let selectedFundId = null; // Cho context menu

// --- 1. KHỞI TẠO & LOAD DATA ---
async function loadTransactions() {
    try {
        const res = await fetch(`${API_URL}/transactions`);
        let rawData = await res.json();

        // BƯỚC 1: Sắp xếp TĂNG DẦN theo thời gian để tính số dư
        rawData.sort((a, b) => a.id - b.id);

        // BƯỚC 2: Tính số dư lũy kế
        let runningBalance = 0;
        let totalThu = 0;
        let totalChi = 0;

        rawData = rawData.map(t => {
            if (t.type === 'thu') {
                runningBalance += t.amount;
                totalThu += t.amount;
            } else {
                runningBalance -= t.amount;
                totalChi += t.amount;
            }
            // Lưu số dư tại thời điểm này vào object
            return { ...t, balanceAfter: runningBalance };
        });

        // Update Stats Cards (Tổng quan)
        updateFundOverview(runningBalance, totalThu, totalChi);

        // BƯỚC 3: Sắp xếp GIẢM DẦN (Mới nhất lên đầu) để hiển thị
        globalTransactions = rawData.sort((a, b) => b.id - a.id);

        currentFilteredFund = globalTransactions;
        curFundPage = 1;

        // Sync select box
        const sel = document.getElementById('rows-select-fund');
        if (sel) sel.value = rowsPerFundPage;

        renderFundTable();

        // UX Features
        setupFundGlobalClick();
        setupFundMenuAutoHide();
        setupFundTableScroll();

    } catch (e) { console.error(e); }
}

function updateFundOverview(remain, inTotal, outTotal) {
    const elRemain = document.getElementById('stat-remain');
    const elIn = document.getElementById('stat-in');
    const elOut = document.getElementById('stat-out');

    if (elRemain) elRemain.innerText = fmt(remain) + ' đ';
    if (elIn) elIn.innerText = fmt(inTotal) + ' đ';
    if (elOut) elOut.innerText = fmt(outTotal) + ' đ';
}

function setupFundGlobalClick() {
    document.addEventListener('click', () => {
        const menu = document.getElementById('context-menu-fund');
        if (menu) menu.style.display = 'none';
    });
}

// --- 2. RENDER BẢNG ---
function renderFundTable() {
    const tbody = document.getElementById('table-transaction-body');
    const tableContainer = document.querySelector('.table-responsive');
    if (!tbody) return;

    let pageData = [];
    if (rowsPerFundPage === 'all' || rowsPerFundPage >= currentFilteredFund.length) {
        pageData = currentFilteredFund;
    } else {
        const start = (curFundPage - 1) * rowsPerFundPage;
        const end = start + parseInt(rowsPerFundPage);
        pageData = currentFilteredFund.slice(start, end);
    }

    let savedScrollTop = 0;
    if (tableContainer) savedScrollTop = tableContainer.scrollTop;

    tbody.innerHTML = '';

    const lblTotal = document.getElementById('lbl-total-fund');
    if (lblTotal) lblTotal.innerText = currentFilteredFund.length;

    pageData.forEach((t, index) => {
        const realIndex = ((curFundPage - 1) * (rowsPerFundPage === 'all' ? 0 : rowsPerFundPage)) + index + 1;
        const tr = document.createElement('tr');

        tr.oncontextmenu = function (e) {
            e.preventDefault();
            selectedFundId = t.id;
            const menu = document.getElementById('context-menu-fund');
            if (menu) {
                menu.style.display = 'block';
                menu.style.left = e.pageX + 'px';
                menu.style.top = e.pageY + 'px';
            }
        };

        tr.onclick = function (e) {
            if (e.target.tagName === 'A' || e.target.closest('a')) return;
            editTransaction(t.id);
        };

        const cellThu = t.type === 'thu' ? `<span class="col-thu">+${fmt(t.amount)}</span>` : '';
        const cellChi = t.type === 'chi' ? `<span class="col-chi">-${fmt(t.amount)}</span>` : '';
        const imgDisplay = t.image
            ? `<a href="/data/${t.image}" target="_blank">📷</a>`
            : '';

        let timePart = '', datePart = t.date;
        if (t.date && t.date.includes(' ')) {
            const parts = t.date.split(' ');
            timePart = parts[0];
            datePart = parts[1];
        }

        tr.innerHTML = `
            <td style="text-align:center; color:#888;">${realIndex}</td>
            <td>
                <span style="font-weight:bold;">${datePart}</span>
                <span class="date-small">${timePart}</span>
            </td>
            <td><b>${t.title}</b></td>
            <td><small>${t.tags || ''}</small></td>
            <td style="text-align:right;">${cellThu}</td>
            <td style="text-align:right;">${cellChi}</td>
            <td style="text-align:right;" class="col-balance">${fmt(t.balanceAfter)}</td>
            <td style="text-align:center;">${imgDisplay}</td>
        `;
        tbody.appendChild(tr);
    });

    if (tableContainer) requestAnimationFrame(() => { tableContainer.scrollTop = savedScrollTop; });
}

// --- 3. FILTER LOGIC ---
function filterTransactions() {
    if (fundFilterTimeout) clearTimeout(fundFilterTimeout);
    fundFilterTimeout = setTimeout(() => { executeFundFilter(); }, 300);
}

function executeFundFilter() {
    const fTitle = getVal('f-title').toLowerCase();
    const fTags = getVal('f-tags').toLowerCase();
    const fDateStart = getVal('f-date-start');
    const fDateEnd = getVal('f-date-end');

    const rawMinThu = getRaw('f-min-thu');
    const rawMinChi = getRaw('f-min-chi');
    const minThu = rawMinThu ? parseFloat(rawMinThu) : null;
    const minChi = rawMinChi ? parseFloat(rawMinChi) : null;

    const parseDateStr = (str) => {
        if (!str) return null;
        const parts = str.split(' ');
        const dPart = parts.length > 1 ? parts[1] : parts[0];
        const [d, m, y] = dPart.split('/');
        return `${y}-${m}-${d}`;
    };

    const filtered = globalTransactions.filter(t => {
        const matchTitle = t.title.toLowerCase().includes(fTitle);
        const matchTags = (t.tags || '').toLowerCase().includes(fTags);

        let matchAmount = true;

        if (minThu !== null) {
            if (t.type !== 'thu' || t.amount < minThu) matchAmount = false;
        }

        if (minChi !== null) {
            if (t.type !== 'chi' || t.amount < minChi) matchAmount = false;
        }

        let matchDate = true;
        const tDateIso = parseDateStr(t.date);
        if (fDateStart && tDateIso < fDateStart) matchDate = false;
        if (fDateEnd && tDateIso > fDateEnd) matchDate = false;

        return matchTitle && matchTags && matchAmount && matchDate;
    });

    currentFilteredFund = filtered;
    curFundPage = 1;
    renderFundTable();
}

// --- 4. MODAL & SAVE (CÓ SESSION PASS) ---
function openFundModal() {
    resetFundForm();
    document.getElementById('modal-transaction').style.display = 'flex';
}
function closeFundModal() {
    document.getElementById('modal-transaction').style.display = 'none';
}
window.onclick = function (event) {
    if (event.target == document.getElementById('modal-transaction')) closeFundModal();
}

function resetFundForm() {
    document.querySelectorAll('#form-transaction input').forEach(i => i.value = '');
    document.getElementById('t-type').value = 'chi';
    setVal('t-id', '');
    document.getElementById('form-fund-title').innerText = "Thêm Giao Dịch Mới";
    document.getElementById('btn-save-fund').innerText = "Lưu Giao Dịch";
}

async function saveTransaction() {
    // Validation
    if (!getVal('t-title')) return alert("Vui lòng nhập nội dung!");
    const amount = getRaw('t-amount');
    if (!amount || amount <= 0) return alert("Vui lòng nhập số tiền hợp lệ!");

    // --- BẢO MẬT: KIỂM TRA PHIÊN LÀM VIỆC ---
    if (!checkAuth()) return; // Chỉ cần 1 dòng này để check pass

    // Data preparation
    const id = getVal('t-id');
    const formData = new FormData();
    if (id) formData.append('id', id);

    formData.append('title', getVal('t-title'));
    formData.append('amount', amount);
    formData.append('type', getVal('t-type'));
    formData.append('tags', getVal('t-tags'));

    const customDate = getVal('t-date-custom');
    if (customDate) {
        formData.append('date', customDate);
    }

    const file = document.getElementById('t-image').files[0];
    if (file) formData.append('image', file);

    const endpoint = id ? `${API_URL}/transaction/update` : `${API_URL}/add`;

    try {
        const res = await fetch(endpoint, { method: 'POST', body: formData });
        if (!res.ok) throw new Error("Lỗi kết nối máy chủ");

        showToast(id ? "Đã cập nhật thành công!" : "Đã thêm mới thành công!");
        closeFundModal();
        loadTransactions();
    } catch (err) {
        alert('Lỗi: ' + err.message);
    }
}

function editTransaction(id) {
    const t = globalTransactions.find(item => item.id == id);
    if (!t) return;

    setVal('t-id', t.id);
    setVal('t-title', t.title);
    setVal('t-amount', fmt(t.amount));
    setVal('t-type', t.type);
    setVal('t-tags', t.tags);

    document.getElementById('form-fund-title').innerText = "Sửa Giao Dịch";
    document.getElementById('btn-save-fund').innerText = "Cập nhật";
    document.getElementById('modal-transaction').style.display = 'flex';
}

// --- 5. UTILITIES (Auto hide menu, Scroll, Pagination) ---
function changeFundRowsPerPage() {
    const val = document.getElementById('rows-select-fund').value;
    if (val === 'all') rowsPerFundPage = currentFilteredFund.length || 10000;
    else rowsPerFundPage = parseInt(val);
    curFundPage = 1;
    renderFundTable();
}

function renderFundPagination() {
    const container = document.getElementById('pagination-fund');
    if (!container) return;
    container.innerHTML = '';
    const totalPages = Math.ceil(currentFilteredFund.length / rowsPerFundPage);
    if (totalPages <= 1) return;

    const btnPrev = createPageBtn('<', curFundPage === 1, () => { curFundPage--; renderFundTable(); });
    container.appendChild(btnPrev);

    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= curFundPage - 1 && i <= curFundPage + 1)) {
            const btn = createPageBtn(i, false, () => { curFundPage = i; renderFundTable(); });
            if (i === curFundPage) btn.classList.add('active');
            container.appendChild(btn);
        } else if (i === curFundPage - 2 || i === curFundPage + 2) {
            const span = document.createElement('span');
            span.innerText = '...'; span.style.padding = '0 5px';
            container.appendChild(span);
        }
    }

    const btnNext = createPageBtn('>', curFundPage === totalPages, () => { curFundPage++; renderFundTable(); });
    container.appendChild(btnNext);
}

function createPageBtn(text, disabled, onClick) {
    const btn = document.createElement('button');
    btn.innerText = text;
    btn.className = 'page-btn';
    btn.disabled = disabled;
    btn.onclick = onClick;
    return btn;
}

function setupFundMenuAutoHide() {
    window.onscroll = function () {
        const menu = document.querySelector('.main-tabs');
        const tableCard = document.querySelector('.table-responsive');
        if (!menu || !tableCard) return;
        const tableTop = tableCard.getBoundingClientRect().top;
        if (tableTop < 150) menu.classList.add('menu-hidden');
        else menu.classList.remove('menu-hidden');
    };
}

function setupFundTableScroll() {
    const tableContainer = document.querySelector('.table-responsive');
    const btn = document.getElementById("btn-back-to-top");
    if (tableContainer && btn) {
        tableContainer.onscroll = function () {
            if (tableContainer.scrollTop > 300) btn.style.display = "block";
            else btn.style.display = "none";
        };
        btn.onclick = function () {
            tableContainer.scrollTo({ top: 0, behavior: 'smooth' });
        };
    }
}

// Context Actions (Xử lý Menu Chuột phải)
function handleFundContextAction(action) {
    if (!selectedFundId) return;
    const item = globalTransactions.find(t => t.id == selectedFundId);

    if (action === 'edit') {
        editTransaction(selectedFundId);
    }
    else if (action === 'duplicate') {
        resetFundForm();
        setVal('t-title', item.title + ' (Copy)');
        setVal('t-amount', fmt(item.amount));
        setVal('t-type', item.type);
        setVal('t-tags', item.tags);
        document.getElementById('form-fund-title').innerText = "Nhân bản Giao dịch";
        document.getElementById('modal-transaction').style.display = 'flex';
    }
    else if (action === 'delete') {
        deleteFund(selectedFundId);
    }

    const menu = document.getElementById('context-menu-fund');
    if (menu) menu.style.display = 'none';
}

// --- HÀM XÓA QUỸ (CÓ MẬT KHẨU SESSION) ---
async function deleteFund(id) {
    if (!confirm("⚠️ Bạn có chắc chắn muốn XÓA VĨNH VIỄN giao dịch này không?")) return;

    // YÊU CẦU MẬT KHẨU
    if (!checkAuth()) return;

    try {
        const res = await fetch(`${API_URL}/transaction/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id })
        });

        if (!res.ok) throw new Error("Lỗi kết nối máy chủ");

        showToast("🗑️ Đã xóa giao dịch thành công!");
        loadTransactions();

    } catch (err) {
        alert("Lỗi khi xóa: " + err.message);
    }
}

async function exportFundToExcel() {
    if (currentFilteredFund.length === 0) return alert("Không có dữ liệu!");
    const btn = document.querySelector('button[onclick="exportFundToExcel()"]');
    if (btn) { var old = btn.innerText; btn.innerText = "⏳..."; btn.disabled = true; }

    try {
        const res = await fetch(`${API_URL}/export-fund`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(currentFilteredFund)
        });

        if (!res.ok) throw new Error("Lỗi Server");

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        const now = new Date();
        const yy = String(now.getFullYear()).slice(-2);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const HH = String(now.getHours()).padStart(2, '0');
        const MM = String(now.getMinutes()).padStart(2, '0');

        a.download = `SoQuy_${yy}${mm}${dd}${HH}${MM}.xlsx`;

        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

        showToast("Đã tải file Excel thành công!");

    } catch (e) {
        console.error(e);
        alert("Lỗi kết nối khi xuất file: " + e.message);
    } finally {
        if (btn) { btn.innerText = old; btn.disabled = false; }
    }
}