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
        setTimeout(() => t.className = t.className.replace("show", ""), 3000); // Đổi 3006 thành 3000 (3 giây) cho chuẩn
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

// =========================================================
// --- HÀM KIỂM TRA QUYỀN (QUẢN LÝ PHIÊN BẰNG SESSION) ---
// =========================================================
function checkAuth() {
    // 1. Kiểm tra xem trong phiên này đã nhập đúng pass chưa
    if (sessionStorage.getItem('isAdminLogged') === 'true') {
        return true; // Đã đăng nhập trong phiên -> Cho qua luôn
    }

    // 2. Nếu chưa, yêu cầu nhập mật khẩu
    const pass = prompt("🔒 BẢO MẬT: Nhập mật khẩu quản trị (Chỉ cần nhập 1 lần cho suốt phiên làm việc):", "");

    if (pass === null) return false; // Người dùng bấm Hủy

    if (pass === '123456') { // Mật khẩu của bạn (có thể đổi)
        // Lưu cờ đánh dấu đã đăng nhập vào Session của trình duyệt
        sessionStorage.setItem('isAdminLogged', 'true');
        showToast("🔓 Đã mở khóa phiên làm việc!");
        return true;
    } else {
        alert("⛔ Mật khẩu sai! Bạn không có quyền thực hiện thao tác này.");
        return false;
    }
}

// Chuyển đổi Tab Lớn (Giao diện)
function switchMainTab(tabName) {
    // Ẩn tất cả section
    document.querySelectorAll('.tab-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.main-tab-btn').forEach(el => el.classList.remove('active'));

    // Hiện section được chọn
    const section = document.getElementById(`section-${tabName}`);
    const btn = document.getElementById(`btn-main-${tabName}`);

    if (section) section.classList.add('active');
    if (btn) btn.classList.add('active');

    // Lưu trạng thái tab để F5 không bị mất
    localStorage.setItem('currentTab', tabName);
}

// Tự động load tab cũ khi F5
document.addEventListener("DOMContentLoaded", () => {
    const savedTab = localStorage.getItem('currentTab') || 'contract';
    switchMainTab(savedTab);
});


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

// Hàm cuộn lên đầu
function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}