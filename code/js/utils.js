// Cấu hình chung
const API_URL = '/api';

// Hàm Format tiền
const fmt = (num) => new Intl.NumberFormat('vi-VN').format(num);

// Hàm hiển thị thông báo
function showToast(msg) {
    const t = document.getElementById("toast");
    if (t) {
        t.innerText = "✅ " + msg;
        t.className = "toast show";
        setTimeout(() => t.className = t.className.replace("show", ""), 3006);
    }
}

// Xử lý nhập tiền
function formatCurrencyInput(input) {
    let val = input.value.replace(/\D/g, "");
    input.value = val ? new Intl.NumberFormat('vi-VN').format(val) : "";
}

function handleAmountShortcuts(e) {
    let val = e.target.value.replace(/\D/g, "") || "1";
    if (e.key === 'k') { e.preventDefault(); e.target.value = new Intl.NumberFormat('vi-VN').format(val + "000"); }
    if (e.key === 'm') { e.preventDefault(); e.target.value = new Intl.NumberFormat('vi-VN').format(val + "000000"); }
}

function getRaw(id) { return Number(document.getElementById(id).value.replace(/\D/g, "")) || 0; }
function getVal(id) { return document.getElementById(id).value; }
function setVal(id, val) { document.getElementById(id).value = val; }

// Chuyển đổi Tab Lớn (Giao diện)
function switchMainTab(tabName) {
    // Ẩn tất cả section
    document.querySelectorAll('.tab-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.main-tab-btn').forEach(el => el.classList.remove('active'));

    // Hiện section được chọn
    document.getElementById(`section-${tabName}`).classList.add('active');
    document.getElementById(`btn-main-${tabName}`).classList.add('active');

    // Lưu trạng thái tab để F5 không bị mất
    localStorage.setItem('currentTab', tabName);
}

// Tự động load tab cũ khi F5
document.addEventListener("DOMContentLoaded", () => {
    const savedTab = localStorage.getItem('currentTab') || 'contract';
    switchMainTab(savedTab);
});

// ... (Code cũ giữ nguyên) ...

// --- LOGIC NÚT BACK TO TOP ---
// Lắng nghe sự kiện cuộn của toàn bộ trang
window.onscroll = function () {
    const btn = document.getElementById("btn-back-to-top");
    if (btn) {
        // Nếu cuộn quá 300px thì hiện nút
        if (document.body.scrollTop > 300 || document.documentElement.scrollTop > 300) {
            btn.style.display = "block";
        } else {
            btn.style.display = "none";
        }
    }
};

// Hàm cuộn lên đầu (Đã có hoặc thêm mới)
function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}