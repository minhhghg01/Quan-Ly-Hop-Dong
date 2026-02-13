/**
 * FILE: code/js/contract.js
 * FINAL FIX:
 * 1. Auto-hide Menu (Ẩn khi cuộn window xuống bảng)
 * 2. Table Scroll Back-to-Top (Chỉ cuộn nội dung bảng)
 * 3. Custom Rows Per Page (Chọn số dòng hiển thị)
 * 4. Fix Overlay UI (Sửa lỗi nút đè nhau)
 */

let globalContracts = [];
let currentFilteredData = [];
let myChart = null;
let filterTimeout = null;

// --- CẤU HÌNH PHÂN TRANG ---
let currentPage = 1;
let rowsPerPage = 20; // Mặc định 20

let selectedContextId = null; // ID cho menu chuột phải

// --- 1. KHỞI TẠO & LOAD DỮ LIỆU ---
async function loadContracts() {
    try {
        const res = await fetch(`${API_URL}/contract`);
        if (!res.ok) throw new Error("Lỗi kết nối Server");

        globalContracts = await res.json();

        // --- LOGIC 1: CẬP NHẬT TRẠNG THÁI TỰ ĐỘNG ---
        // Lấy ngày hiện tại theo múi giờ máy tính (tránh lỗi lệch giờ của toISOString)
        const now = new Date();
        const today = now.getFullYear() + '-' +
            String(now.getMonth() + 1).padStart(2, '0') + '-' +
            String(now.getDate()).padStart(2, '0');

        globalContracts.forEach(c => {
            // Nếu trạng thái là "Hoàn thành" hoặc "Hủy" thì bỏ qua, không tự đổi
            if (c.status === 'Hoàn thành' || c.status === 'Hủy') return;

            // 1. Kiểm tra HẾT HẠN trước (Ưu tiên cao nhất)
            if (c.expireDate && c.expireDate < today) {
                c.status = 'Hết hạn';
            }
            // 2. Nếu chưa hết hạn thì kiểm tra NHẮC NHỞ
            else if (c.reminderDate && c.reminderDate <= today) {
                c.status = 'Sắp hết hạn';
            }
        });

        // --- LOGIC 2: SẮP XẾP ƯU TIÊN ---
        globalContracts.sort((a, b) => {
            // Hàm tính điểm ưu tiên (Số càng lớn càng nổi lên trên)
            const getScore = (status) => {
                if (status === 'Sắp hết hạn') return 3; // Nổi lên đầu
                if (status === 'Hết hạn') return 2;     // Nổi thứ nhì
                return 1;                               // Các cái khác nằm dưới
            };

            const scoreA = getScore(a.status);
            const scoreB = getScore(b.status);

            if (scoreA !== scoreB) {
                return scoreB - scoreA; // Sắp xếp theo điểm (cao xếp trước)
            } else {
                return b.id - a.id; // Nếu cùng điểm thì cái nào mới tạo (ID lớn) xếp trước
            }
        });

        // Gán dữ liệu vào biến lọc hiện tại
        currentFilteredData = globalContracts;
        currentPage = 1;

        // Đồng bộ Select Box
        const rowSelect = document.getElementById('rows-select');
        if (rowSelect) rowSelect.value = rowsPerPage;

        // Render bảng
        renderContractTable();
        setupGlobalClick();

        // Kích hoạt UX
        if (typeof setupMenuAutoHide === 'function') setupMenuAutoHide();
        if (typeof setupTableScroll === 'function') setupTableScroll();

    } catch (e) { console.error(e); }
}

function setupGlobalClick() {
    document.addEventListener('click', () => {
        const menu = document.getElementById('context-menu');
        if (menu) menu.style.display = 'none';
    });
}

// --- 2. LOGIC TỰ ĐỘNG ẨN MENU (WINDOW SCROLL) ---
function setupMenuAutoHide() {
    window.onscroll = function () {
        const menu = document.querySelector('.main-tabs');
        const tableCard = document.querySelector('.table-responsive');

        if (!menu || !tableCard) return;

        // Lấy vị trí bảng so với đỉnh màn hình
        const tableTop = tableCard.getBoundingClientRect().top;

        // Nếu bảng trượt lên gần sát đỉnh (còn cách 60px) -> Ẩn menu đi cho rộng chỗ
        if (tableTop < 150) {
            menu.classList.add('menu-hidden');
        } else {
            menu.classList.remove('menu-hidden');
        }
    };
}

// --- 3. LOGIC BACK TO TOP (TABLE SCROLL) ---
function setupTableScroll() {
    const tableContainer = document.querySelector('.table-responsive');
    const btn = document.getElementById("btn-back-to-top");

    if (tableContainer && btn) {
        // Lắng nghe sự kiện cuộn CỦA BẢNG
        tableContainer.onscroll = function () {
            // Nếu bảng cuộn xuống quá 300px thì hiện nút
            if (tableContainer.scrollTop > 300) {
                btn.style.display = "block";
            } else {
                btn.style.display = "none";
            }
        };

        // Khi bấm nút -> Đẩy thanh cuộn BẢNG lên 0
        btn.onclick = function () {
            tableContainer.scrollTo({ top: 0, behavior: 'smooth' });
        };
    }
}

// --- 4. LOGIC ĐỔI SỐ DÒNG HIỂN THỊ ---
function changeRowsPerPage() {
    const select = document.getElementById('rows-select');
    const val = select.value;

    if (val === 'all') {
        rowsPerPage = currentFilteredData.length || 10000;
    } else {
        rowsPerPage = parseInt(val);
    }

    currentPage = 1; // Reset về trang 1
    renderContractTable();
}

// --- 5. RENDER BẢNG & PHÂN TRANG ---
function updateContractStats(data) {
    const total = data.reduce((sum, c) => sum + (c.amount || 0), 0);
    const el = document.getElementById('stat-contract');
    if (el) el.innerText = fmt(total) + ' đ';
}

function renderContractTable() {
    const tableContainer = document.querySelector('.table-responsive');
    const tbody = document.getElementById('table-contract-body');
    if (!tbody) return;

    // A. LẤY DATA TRANG HIỆN TẠI
    let pageData = [];
    if (rowsPerPage >= currentFilteredData.length) {
        pageData = currentFilteredData; // Lấy hết
    } else {
        const start = (currentPage - 1) * rowsPerPage;
        const end = start + rowsPerPage;
        pageData = currentFilteredData.slice(start, end);
    }

    // B. GHI NHỚ VỊ TRÍ CUỘN
    let savedScrollTop = 0;
    if (tableContainer) savedScrollTop = tableContainer.scrollTop;

    tbody.innerHTML = '';

    // Update Stats & Chart theo toàn bộ dữ liệu lọc
    updateContractStats(currentFilteredData);
    renderChart(currentFilteredData);
    renderPagination();

    const today = new Date().toISOString().split('T')[0];

    pageData.forEach((c, index) => {
        // Tính STT thực tế (cộng dồn các trang trước)
        const realIndex = ((currentPage - 1) * (rowsPerPage === 'all' ? 0 : rowsPerPage)) + index + 1;
        const tr = document.createElement('tr');

        // Click chuột trái -> Sửa
        tr.onclick = function (e) {
            if (e.target.tagName === 'A' || e.target.closest('a')) return;
            editContract(c.id);
        };

        // Click chuột phải -> Menu
        tr.oncontextmenu = function (e) {
            e.preventDefault();
            selectedContextId = c.id;
            const menu = document.getElementById('context-menu');
            if (menu) {
                menu.style.display = 'block';
                menu.style.left = e.pageX + 'px';
                menu.style.top = e.pageY + 'px';
            }
        };

        if (c.status === 'Sắp hết hạn') tr.className = 'row-reminder';

        let badgeClass = 'st-moi';
        if (c.status === 'Chờ thanh toán') badgeClass = 'st-cho-tt';
        else if (c.status === 'Hoạt động') badgeClass = 'st-hoat-dong';
        else if (c.status === 'Sắp hết hạn') badgeClass = 'st-sap-het';
        else if (c.status === 'Hết hạn') badgeClass = 'st-het-han';
        else if (c.status === 'Hủy') badgeClass = 'st-huy';
        else if (c.status === 'Hoàn thành') badgeClass = 'st-hoat-dong';

        let fileLink = c.image ? `<a href="/data/${c.image}" target="_blank" title="Tải file">📎</a>` : '';
        const formatDate = (d) => d ? d.split('-').reverse().join('/') : '';

        let reminderInfo = '';
        if (c.reminderDate) {
            const isDue = (c.status === 'Sắp hết hạn');
            const icon = isDue ? '🔔' : '⏰';
            const color = isDue ? '#d63384' : '#868e96';
            reminderInfo = `<br><span style="font-size:10px; color:${color}; font-weight:500;">${icon} Nhắc: ${formatDate(c.reminderDate)}</span>`;
        }

        let tagsHtml = '';
        if (c.tags) c.tags.split(',').forEach(t => { if (t.trim()) tagsHtml += `<span class="tag-badge-cell">${t.trim()}</span> `; });

        tr.innerHTML = `
            <td>${realIndex}</td>
            <td title="${c.title}"><b>${c.title}</b> ${reminderInfo}</td>
            <td>${c.company || ''}</td>
            <td style="font-weight:bold; color:#cc5de8; text-align:right;">${fmt(c.amount)}</td>
            <td>${tagsHtml}</td>
            <td>${formatDate(c.paymentDate)}</td>
            <td>${formatDate(c.signDate)}</td>
            <td>${formatDate(c.expireDate)}</td>
            <td><span class="status-badge ${badgeClass}">${c.status}</span></td>
            <td><small>${c.note || ''}</small></td>
            <td style="text-align:center;">${fileLink}</td>
        `;
        tbody.appendChild(tr);
    });

    if (tableContainer) {
        requestAnimationFrame(() => { tableContainer.scrollTop = savedScrollTop; });
    }
}

function renderPagination() {
    // Cập nhật số tổng bản ghi ra giao diện
    const lblTotal = document.getElementById('lbl-total-records');
    if (lblTotal) lblTotal.innerText = currentFilteredData.length;

    const container = document.getElementById('pagination');
    if (!container) return;
    container.innerHTML = '';

    const totalPages = Math.ceil(currentFilteredData.length / rowsPerPage);
    if (totalPages <= 1) return;

    // Prev
    const btnPrev = document.createElement('button');
    btnPrev.innerText = '<'; btnPrev.className = 'page-btn';
    btnPrev.disabled = currentPage === 1;
    btnPrev.onclick = () => { currentPage--; renderContractTable(); };
    container.appendChild(btnPrev);

    // Page Numbers
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            const btn = document.createElement('button');
            btn.innerText = i;
            btn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
            btn.onclick = () => { currentPage = i; renderContractTable(); };
            container.appendChild(btn);
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            const span = document.createElement('span');
            span.innerText = '...'; span.style.padding = '0 5px';
            container.appendChild(span);
        }
    }

    // Next
    const btnNext = document.createElement('button');
    btnNext.innerText = '>'; btnNext.className = 'page-btn';
    btnNext.disabled = currentPage === totalPages;
    btnNext.onclick = () => { currentPage++; renderContractTable(); };
    container.appendChild(btnNext);
}

// --- 6. XỬ LÝ CONTEXT MENU (Đã bỏ Xóa) ---
async function handleContextAction(action) {
    if (!selectedContextId) return;
    const item = globalContracts.find(c => c.id == selectedContextId);
    if (!item) return;

    if (action === 'edit') {
        editContract(selectedContextId);
    }
    else if (action === 'duplicate') {
        // Nhân bản cũng cần mật khẩu (vì nó là thêm mới) -> Gọi saveContract sẽ tự hỏi mật khẩu
        // Ở đây chỉ cần mở form lên thôi
        resetContractForm();
        setVal('c-title', item.title + ' (Copy)');
        setVal('c-company', item.company);
        setVal('c-amount', new Intl.NumberFormat('vi-VN').format(item.amount));
        setVal('c-status', 'Mới');
        setVal('c-signDate', item.signDate);
        setVal('c-paymentDate', item.paymentDate);
        setVal('c-expireDate', item.expireDate);
        setVal('c-tags', item.tags);
        setVal('c-note', item.note);
        document.getElementById('form-title').innerText = "Nhân bản Hợp đồng";
        document.getElementById('modal-contract').style.display = 'flex';
    }

    // Đã xóa phần else if (action === 'delete') ...

    // Ẩn menu sau khi chọn
    const menu = document.getElementById('context-menu');
    if (menu) menu.style.display = 'none';
}

// --- 7. CÁC HÀM CŨ (MODAL, CHART, SAVE, FILTER...) ---
function openModal() { resetContractForm(); document.getElementById('modal-contract').style.display = 'flex'; }
function closeModal() { document.getElementById('modal-contract').style.display = 'none'; }
window.onclick = function (event) { if (event.target == document.getElementById('modal-contract')) closeModal(); }

function initChartYearSelect(data) {
    const yearSelect = document.getElementById('chart-year-select');
    if (!yearSelect) return;
    const years = new Set();
    data.forEach(c => { if (c.signDate) years.add(new Date(c.signDate).getFullYear()); });
    if (years.size === 0) years.add(new Date().getFullYear());
    const sortedYears = Array.from(years).sort((a, b) => b - a);
    const currentVal = yearSelect.value;
    yearSelect.innerHTML = '';
    sortedYears.forEach(y => {
        const opt = document.createElement('option');
        opt.value = y; opt.innerText = y; yearSelect.appendChild(opt);
    });
    yearSelect.value = (currentVal && years.has(parseInt(currentVal))) ? currentVal : sortedYears[0];
}
function updateChartLogic() { renderChart(globalContracts); }
function renderChart(data) {
    const ctx = document.getElementById('contractChart');
    if (!ctx) return;
    initChartYearSelect(data);
    const viewMode = document.getElementById('chart-view-mode').value;
    const selectedYear = parseInt(document.getElementById('chart-year-select').value);
    document.getElementById('chart-year-select').style.display = (viewMode === 'year') ? 'none' : 'block';
    let labels = [], values = [], labelTitle = '', barColor = '#8b5cf6';
    if (viewMode === 'year') {
        labelTitle = 'Doanh thu theo Năm'; barColor = '#3b82f6';
        const yearMap = {};
        data.forEach(c => { if (c.signDate) { const y = new Date(c.signDate).getFullYear(); yearMap[y] = (yearMap[y] || 0) + (c.amount || 0); } });
        labels = Object.keys(yearMap).sort(); values = labels.map(y => yearMap[y]);
    } else if (viewMode === 'quarter') {
        labelTitle = `Doanh thu Quý năm ${selectedYear}`; labels = ['Quý 1', 'Quý 2', 'Quý 3', 'Quý 4']; values = [0, 0, 0, 0];
        data.forEach(c => { if (c.signDate) { const d = new Date(c.signDate); if (d.getFullYear() === selectedYear) values[Math.floor(d.getMonth() / 3)] += (c.amount || 0); } });
    } else {
        labelTitle = `Doanh thu Tháng năm ${selectedYear}`; labels = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12']; values = Array(12).fill(0);
        data.forEach(c => { if (c.signDate) { const d = new Date(c.signDate); if (d.getFullYear() === selectedYear) values[d.getMonth()] += (c.amount || 0); } });
    }
    if (myChart) myChart.destroy();
    myChart = new Chart(ctx, { type: 'bar', data: { labels: labels, datasets: [{ label: labelTitle, data: values, backgroundColor: barColor, borderRadius: 4, barPercentage: 0.6 }] }, options: { responsive: true, maintainAspectRatio: false, animation: { duration: 400 }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (context) { return new Intl.NumberFormat('vi-VN').format(context.raw) + ' đ'; } } } }, scales: { y: { beginAtZero: true, ticks: { callback: function (value) { if (value >= 1e9) return (value / 1e9).toFixed(1) + ' tỷ'; if (value >= 1e6) return (value / 1e6).toFixed(0) + ' tr'; return value; }, font: { size: 10 } } }, x: { ticks: { font: { size: 11 } } } } } });
}

// --- 5. LƯU & SỬA HỢP ĐỒNG (CÓ MẬT KHẨU BẢO VỆ) ---
async function saveContract() {
    // 1. Kiểm tra dữ liệu nhập
    if (!getVal('c-title')) return alert("Vui lòng nhập tên hợp đồng!");

    // 2. YÊU CẦU MẬT KHẨU (BẢO MẬT)
    const password = prompt("🔒 YÊU CẦU BẢO MẬT\nĐể Thêm mới hoặc Sửa, vui lòng nhập mật khẩu quản trị:", "");

    // Nếu bấm Hủy hoặc không nhập gì
    if (password === null) return;

    // Kiểm tra mật khẩu (Bạn có thể đổi '123456' thành số khác)
    if (password !== '123456') {
        return alert("⛔ SAI MẬT KHẨU! Bạn không có quyền thực hiện thao tác này.");
    }

    // 3. Nếu đúng mật khẩu thì mới chạy tiếp logic lưu
    const id = getVal('c-id');
    const formData = new FormData();
    if (id) formData.append('id', id);
    formData.append('type', 'contract');
    formData.append('title', getVal('c-title'));
    formData.append('company', getVal('c-company'));
    formData.append('amount', getRaw('c-amount'));
    formData.append('status', getVal('c-status'));
    formData.append('signDate', getVal('c-signDate'));
    formData.append('paymentDate', getVal('c-paymentDate'));
    formData.append('expireDate', getVal('c-expireDate'));
    formData.append('reminderDate', getVal('c-reminderDate'));
    formData.append('tags', getVal('c-tags'));
    formData.append('note', getVal('c-note'));
    const file = document.getElementById('c-image').files[0];
    if (file) formData.append('image', file);

    const endpoint = id ? `${API_URL}/contract/update` : `${API_URL}/contract`;
    try {
        await fetch(endpoint, { method: 'POST', body: formData });
        showToast(id ? "Đã cập nhật thành công!" : "Đã thêm mới thành công!");
        closeModal();
        loadContracts();
    } catch (err) { alert("Lỗi khi lưu: " + err); }
}

function editContract(id) {
    const c = globalContracts.find(item => item.id == id);
    if (!c) return;
    setVal('c-id', c.id); setVal('c-title', c.title); setVal('c-company', c.company);
    setVal('c-amount', new Intl.NumberFormat('vi-VN').format(c.amount));
    setVal('c-status', c.status); setVal('c-signDate', c.signDate);
    setVal('c-paymentDate', c.paymentDate); setVal('c-expireDate', c.expireDate);
    setVal('c-reminderDate', c.reminderDate || ''); setVal('c-tags', c.tags); setVal('c-note', c.note);
    document.getElementById('form-title').innerText = "Sửa hợp đồng: " + c.title;
    document.getElementById('btn-save-contract').innerText = "Cập nhật";
    document.getElementById('modal-contract').style.display = 'flex';
}
function resetContractForm() {
    document.querySelectorAll('#form-contract input').forEach(i => i.value = '');
    document.getElementById('c-status').value = 'Mới'; setVal('c-id', '');
    document.getElementById('form-title').innerText = "Thêm mới Hợp đồng";
    document.getElementById('btn-save-contract').innerText = "Lưu Hợp Đồng";
}

function filterContractTable() {
    if (filterTimeout) clearTimeout(filterTimeout);
    filterTimeout = setTimeout(() => { executeFilter(); }, 300);
}
function executeFilter() {
    const fTitle = getVal('f-title').toLowerCase();
    const fCompany = getVal('f-company').toLowerCase();
    const fTags = getVal('f-tags').toLowerCase();
    const fStatus = getVal('f-status');
    const fNote = getVal('f-note').toLowerCase();
    const inputMin = document.getElementById('f-amount-min').value;
    const inputMax = document.getElementById('f-amount-max').value;
    const fMin = inputMin ? getRaw('f-amount-min') : null;
    const fMax = inputMax ? getRaw('f-amount-max') : null;
    const checkDateRange = (itemDate, start, end) => { if (!itemDate) return true; if (start && itemDate < start) return false; if (end && itemDate > end) return false; return true; };

    const filtered = globalContracts.filter(c => {
        const matchTitle = (c.title || '').toLowerCase().includes(fTitle);
        const matchComp = (c.company || '').toLowerCase().includes(fCompany);
        const matchTags = (c.tags || '').toLowerCase().includes(fTags);
        const matchStatus = fStatus === "" || c.status === fStatus;
        const matchNote = (c.note || '').toLowerCase().includes(fNote);
        let matchAmount = true;
        if (fMin !== null && c.amount < fMin) matchAmount = false;
        if (fMax !== null && c.amount > fMax) matchAmount = false;
        const matchPay = checkDateRange(c.paymentDate, getVal('f-pay-start'), getVal('f-pay-end'));
        const matchSign = checkDateRange(c.signDate, getVal('f-sign-start'), getVal('f-sign-end'));
        const matchExp = checkDateRange(c.expireDate, getVal('f-exp-start'), getVal('f-exp-end'));
        return matchTitle && matchComp && matchTags && matchStatus && matchNote && matchAmount && matchPay && matchSign && matchExp;
    });

    currentFilteredData = filtered;
    currentPage = 1;
    renderContractTable();
}

// --- 7. EXPORT EXCEL (TẢI TRỰC TIẾP) ---
// --- 7. EXPORT EXCEL (TẢI VỀ MÁY KHÁCH - FILE ĐỊNH DẠNG ĐẸP) ---
async function exportToExcel() {
    if (currentFilteredData.length === 0) return alert("Không có dữ liệu để xuất!");

    const btn = document.querySelector('button[onclick="exportToExcel()"]');
    if (btn) { var oldText = btn.innerText; btn.innerText = "⏳ Đang tải..."; btn.disabled = true; }

    try {
        const res = await fetch(`${API_URL}/export`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(currentFilteredData)
        });

        if (!res.ok) throw new Error("Lỗi Server");

        // 1. Nhận dữ liệu BLOB
        const blob = await res.blob();

        // 2. Tạo link tải
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        // --- SỬA LẠI TÊN FILE TẠI ĐÂY ---
        const now = new Date();
        // Lấy 2 số cuối của năm
        const yy = String(now.getFullYear()).slice(-2);
        // Tháng (tháng bắt đầu từ 0 nên phải +1)
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const HH = String(now.getHours()).padStart(2, '0');
        const MM = String(now.getMinutes()).padStart(2, '0');

        // Ghép chuỗi: DanhSachHopDong_2512300945.xlsx
        a.download = `DanhSachHopDong_${yy}${mm}${dd}${HH}${MM}.xlsx`;
        // -------------------------------

        document.body.appendChild(a);
        a.click();

        a.remove();
        window.URL.revokeObjectURL(url);

        showToast("Đã tải file Excel thành công!");

    } catch (err) {
        console.error(err);
        alert("Lỗi kết nối khi xuất file: " + err.message);
    } finally {
        if (btn) { btn.innerText = oldText; btn.disabled = false; }
    }
}