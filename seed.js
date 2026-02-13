const fs = require('fs');
const path = require('path');

// --- SỬA LẠI ĐÚNG TÊN FILE Ở ĐÂY ---
const DB_PATH = path.join(__dirname, 'contract.json'); 
// ------------------------------------

// Dữ liệu mẫu
const companies = [
    "Tập đoàn Viettel", "FPT Telecom", "VNPT Vinaphone", "CMC Corp", "VNG Corporation",
    "VinGroup", "Sun Group", "Thế Giới Di Động", "FPT Shop", "Shopee Việt Nam",
    "Lazada VN", "Tiki", "Grab VN", "Be Group", "Momo", "ZaloPay",
    "Ngân hàng Techcombank", "Ngân hàng MB", "Vietcombank", "Công ty Xây dựng Hòa Bình",
    "Công ty Nội thất Nhà Xinh", "Điện lực EVN", "Nước sạch Hà Nội"
];

const titles = [
    "Thanh toán tiền điện T{month}", "Thanh toán tiền nước T{month}", "Thuê Server AWS T{month}",
    "Phí bảo trì phần mềm T{month}", "Hợp đồng Marketing Facebook", "Hợp đồng SEO Website",
    "Mua sắm văn phòng phẩm Quý {quarter}", "Thuê ngoài nhân sự IT", "Thiết kế Banner quảng cáo",
    "Tổ chức sự kiện Year End Party", "Du lịch công ty hè 2026", "Bảo hiểm sức khỏe nhân viên",
    "Thuê văn phòng trọn gói", "Dịch vụ dọn dẹp vệ sinh", "Nâng cấp hệ thống mạng Lan",
    "Mua bản quyền Office 365", "Chi phí tiếp khách đối tác", "Tài trợ giải bóng đá",
    "Hợp đồng pháp lý", "Tư vấn tài chính"
];

const statuses = ["Mới", "Hoạt động", "Chờ thanh toán", "Sắp hết hạn", "Hết hạn", "Hoàn thành", "Hủy"];
const tagsList = ["dien_nuoc", "internet", "marketing", "it_software", "nhan_su", "van_phong", "tiep_khach", "bao_hiem", "su_kien"];

// Các hàm tiện ích
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomArr = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomDate = (start, end) => new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
const fmtDate = (date) => date.toISOString().split('T')[0];

function generateContract(index) {
    const month = randomInt(1, 12);
    const quarter = Math.ceil(month / 3);
    const amount = randomInt(1, 500) * 1000000; 
    
    const signDateObj = randomDate(new Date(2025, 0, 1), new Date(2026, 6, 1));
    const signDate = fmtDate(signDateObj);
    
    const paymentDateObj = new Date(signDateObj);
    paymentDateObj.setDate(signDateObj.getDate() + randomInt(5, 30));
    const paymentDate = fmtDate(paymentDateObj);
    
    const expireDateObj = new Date(signDateObj);
    expireDateObj.setMonth(signDateObj.getMonth() + randomInt(1, 12));
    const expireDate = fmtDate(expireDateObj);

    const reminderDateObj = new Date(expireDateObj);
    reminderDateObj.setDate(expireDateObj.getDate() - 7);
    const reminderDate = fmtDate(reminderDateObj);

    let status = randomArr(statuses);
    const today = new Date(); 

    // Logic status thông minh
    if (expireDateObj < today) status = randomArr(["Hết hạn", "Hoàn thành"]);
    else if (expireDateObj > today && expireDateObj < new Date(today.getTime() + 7*24*60*60*1000)) status = "Sắp hết hạn";
    
    let title = randomArr(titles).replace("{month}", month).replace("{quarter}", quarter);
    
    return {
        id: Date.now() + index, 
        title: title,
        amount: amount,
        image: Math.random() > 0.7 ? `file_demo_${index}.pdf` : null,
        date: new Date().toLocaleTimeString() + " " + new Date().toLocaleDateString(),
        company: randomArr(companies),
        paymentDate: paymentDate,
        signDate: signDate,
        expireDate: expireDate,
        status: status,
        note: `Bản ghi tự động số ${index}`,
        tags: randomArr(tagsList),
        reminderDate: reminderDate,
        created_at: new Date().toISOString()
    };
}

try {
    let data = [];
    
    // Đọc file contract.json
    if (fs.existsSync(DB_PATH)) {
        const fileContent = fs.readFileSync(DB_PATH, 'utf-8');
        try {
            data = JSON.parse(fileContent);
        } catch(e) { data = [] }
        console.log(`✅ Đã tìm thấy ${data.length} bản ghi cũ trong contract.json.`);
    }

    console.log("🔄 Đang sinh 200 bản ghi mới...");
    for (let i = 0; i < 200; i++) {
        data.push(generateContract(i));
    }

    // Ghi lại vào contract.json
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`🎉 XONG! Tổng cộng: ${data.length} hợp đồng.`);
    console.log(`📂 Đã lưu vào: ${DB_PATH}`);

} catch (err) {
    console.error("❌ Lỗi:", err);
}