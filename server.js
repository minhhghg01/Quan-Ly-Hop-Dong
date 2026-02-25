const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const ExcelJS = require('exceljs');
const app = express();
const PORT = 3006;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sử dụng đường dẫn tuyệt đối để tránh lỗi khi di chuyển thư mục
app.use(express.static(path.join(__dirname, 'code')));
app.use('/data', express.static(path.join(__dirname, 'data')));

// --- TỰ ĐỘNG CHUYỂN HƯỚNG VÀO TRANG CHỦ ---
app.get('/', (req, res) => {
    res.redirect('/html/index.html');
});

// --- CẤU HÌNH LƯU FILE ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, 'data');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        let prefix = 'FILE_';
        if (req.body && req.body.type === 'contract') prefix = 'HD_';
        else prefix = 'TC_';
        cb(null, `${prefix}${originalName}`);
    }
});
const upload = multer({ storage: storage });

// Sử dụng đường dẫn tuyệt đối cho file dữ liệu
const DB_FILE = path.join(__dirname, 'report', 'database.json');
const CONTRACT_FILE = path.join(__dirname, 'report', 'contract.json');
const HISTORY_FILE = path.join(__dirname, 'report', 'history.json'); // File lưu lịch sử

const REPORT_DIR = path.join(__dirname, 'report');
if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR);
}

// Khởi tạo file rỗng nếu chưa có
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify([]));
if (!fs.existsSync(CONTRACT_FILE)) fs.writeFileSync(CONTRACT_FILE, JSON.stringify([]));
if (!fs.existsSync(HISTORY_FILE)) fs.writeFileSync(HISTORY_FILE, JSON.stringify([]));


// --- HÀM GHI LOG LỊCH SỬ ---
function saveLog(action, moduleName, details, req) {
    try {
        let logs = [];
        try { logs = JSON.parse(fs.readFileSync(HISTORY_FILE)); } catch (e) { }

        let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        if (ip.includes('::ffff:')) ip = ip.split('::ffff:')[1]; // Lọc IPv4

        logs.push({
            id: Date.now(),
            time: new Date().toLocaleString('vi-VN'),
            action: action,
            module: moduleName,
            details: details,
            ip: ip
        });

        fs.writeFileSync(HISTORY_FILE, JSON.stringify(logs, null, 2));
    } catch (e) { console.error("Lỗi ghi log", e); }
}

// --- API GET DỮ LIỆU ---
app.get('/api/transactions', (req, res) => {
    try { res.json(JSON.parse(fs.readFileSync(DB_FILE))); } catch (error) { res.json([]); }
});

app.get('/api/contract', (req, res) => {
    try { res.json(JSON.parse(fs.readFileSync(CONTRACT_FILE))); } catch (error) { res.json([]); }
});

app.get('/api/history', (req, res) => {
    try { res.json(JSON.parse(fs.readFileSync(HISTORY_FILE))); } catch (error) { res.json([]); }
});


// ================= API QUỸ PHÒNG =================

// Thêm mới Quỹ
app.post('/api/add', upload.single('image'), (req, res) => {
    try {
        const { title, amount, type, tags } = req.body;
        const transactions = JSON.parse(fs.readFileSync(DB_FILE));

        const newTrans = {
            id: Date.now(),
            title, amount: Number(amount), type, tags: tags || "",
            image: req.file ? req.file.filename : null,
            date: new Date().toLocaleString('vi-VN')
        };
        transactions.push(newTrans);
        fs.writeFileSync(DB_FILE, JSON.stringify(transactions, null, 2));

        // Ghi Log
        saveLog("Thêm mới", "Quỹ phòng", `[${type.toUpperCase()}] ${title} - Số tiền: ${new Intl.NumberFormat('vi-VN').format(amount)} đ`, req);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Cập nhật Quỹ
app.post('/api/transaction/update', upload.single('image'), (req, res) => {
    try {
        const { id, title, amount, type, tags, date } = req.body;
        let transactions = JSON.parse(fs.readFileSync(DB_FILE));

        const index = transactions.findIndex(t => t.id == id);
        if (index !== -1) {
            transactions[index].title = title;
            transactions[index].amount = Number(amount);
            transactions[index].type = type;
            transactions[index].tags = tags;
            if (date) transactions[index].date = date;
            if (req.file) transactions[index].image = req.file.filename;

            fs.writeFileSync(DB_FILE, JSON.stringify(transactions, null, 2));

            // Ghi log
            saveLog("Sửa", "Quỹ phòng", `Cập nhật giao dịch [ID: ${id}] -> ${title} (${new Intl.NumberFormat('vi-VN').format(amount)} đ)`, req);

            res.json({ success: true });
        } else {
            res.status(404).json({ success: false, message: "Không tìm thấy giao dịch" });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Xóa Quỹ
app.post('/api/transaction/delete', (req, res) => {
    try {
        const { id } = req.body;
        let transactions = JSON.parse(fs.readFileSync(DB_FILE));

        const target = transactions.find(t => t.id == id);
        transactions = transactions.filter(t => t.id != id);

        fs.writeFileSync(DB_FILE, JSON.stringify(transactions, null, 2));

        // Ghi log
        const title = target ? target.title : `ID ${id}`;
        saveLog("Xóa", "Quỹ phòng", `Đã xóa giao dịch: ${title}`, req);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});


// ================= API HỢP ĐỒNG =================

// Thêm mới Hợp đồng
app.post('/api/contract', upload.single('image'), (req, res) => {
    try {
        const { title, amount, tags, company, paymentDate, signDate, expireDate, reminderDate, status, note } = req.body;
        const contracts = JSON.parse(fs.readFileSync(CONTRACT_FILE));

        const newContract = {
            id: Date.now(),
            title: title || "", company: company || "",
            amount: Number(amount) || 0,
            paymentDate: paymentDate || "", signDate: signDate || "", expireDate: expireDate || "", reminderDate: reminderDate || "",
            status: status || "Mới", note: note || "", tags: tags || "",
            image: req.file ? req.file.filename : null,
            created_at: new Date().toLocaleString('vi-VN')
        };

        contracts.push(newContract);
        fs.writeFileSync(CONTRACT_FILE, JSON.stringify(contracts, null, 2));

        // Ghi log
        saveLog("Thêm mới", "Hợp đồng", `Tên HĐ: ${title} - Giá trị: ${new Intl.NumberFormat('vi-VN').format(amount)} đ`, req);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Cập nhật Hợp đồng
app.post('/api/contract/update', upload.single('image'), (req, res) => {
    try {
        const { id, title, amount, tags, company, paymentDate, signDate, expireDate, reminderDate, status, note } = req.body;
        let contracts = JSON.parse(fs.readFileSync(CONTRACT_FILE));

        const index = contracts.findIndex(c => c.id == id);

        if (index !== -1) {
            contracts[index].title = title;
            contracts[index].company = company;
            contracts[index].amount = Number(amount);
            contracts[index].paymentDate = paymentDate;
            contracts[index].signDate = signDate;
            contracts[index].expireDate = expireDate;
            contracts[index].reminderDate = reminderDate;
            contracts[index].status = status;
            contracts[index].note = note;
            contracts[index].tags = tags;
            if (req.file) contracts[index].image = req.file.filename;

            fs.writeFileSync(CONTRACT_FILE, JSON.stringify(contracts, null, 2));

            // Ghi log
            saveLog("Sửa", "Hợp đồng", `Cập nhật HĐ: ${title} [Trạng thái: ${status}]`, req);

            res.json({ success: true });
        } else {
            res.status(404).json({ success: false, message: "Không tìm thấy hợp đồng" });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Xóa Hợp đồng
app.post('/api/contract/delete', (req, res) => {
    try {
        const { id } = req.body;
        let contracts = JSON.parse(fs.readFileSync(CONTRACT_FILE));

        const target = contracts.find(c => c.id == id);
        contracts = contracts.filter(c => c.id != id);

        fs.writeFileSync(CONTRACT_FILE, JSON.stringify(contracts, null, 2));

        // Ghi log
        const title = target ? target.title : `ID ${id}`;
        saveLog("Xóa", "Hợp đồng", `Đã xóa Hợp đồng: ${title}`, req);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});


// ================= EXPORT & DOWNLOAD =================

// API Tải file (Download)
app.get('/api/download/:fileName', (req, res) => {
    const filePath = path.join(REPORT_DIR, req.params.fileName);
    if (fs.existsSync(filePath)) {
        res.download(filePath);
    } else {
        res.status(404).send("File không tồn tại");
    }
});

// API Xuất Excel Hợp đồng
app.post('/api/export', async (req, res) => {
    try {
        const contracts = req.body;
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Danh sách Hợp đồng');

        const totalAmount = contracts.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
        const rowTotal = worksheet.addRow(['', 'TỔNG GIÁ TRỊ HỢP ĐỒNG:', '', totalAmount]);
        rowTotal.getCell(2).font = { bold: true, size: 14, color: { argb: 'FFFF0000' } };
        rowTotal.getCell(3).numFmt = '#,##0 "đ"';
        rowTotal.getCell(3).font = { bold: true, size: 14, color: { argb: 'FFFF0000' } };

        worksheet.addRow([]); worksheet.addRow([]);

        const headerRow = worksheet.addRow(['STT', 'Tên Hợp đồng', 'Công ty', 'Giá trị', 'Tags', 'Ngày ký', 'Thanh toán', 'Hết hạn', 'Trạng thái', 'Ghi chú']);
        headerRow.font = { bold: true };
        headerRow.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE9ECEF' } }; cell.border = { bottom: { style: 'thin' } }; });

        contracts.forEach((c, index) => {
            worksheet.addRow([index + 1, c.title, c.company, c.amount, c.tags, c.signDate ? c.signDate.split('-').reverse().join('/') : '', c.paymentDate ? c.paymentDate.split('-').reverse().join('/') : '', c.expireDate ? c.expireDate.split('-').reverse().join('/') : '', c.status, c.note]);
        });

        const lastRow = worksheet.lastRow.number;
        for (let i = 4; i <= lastRow; i++) {
            worksheet.getRow(i).eachCell({ includeEmpty: true }, (cell, colNumber) => {
                if (colNumber <= 10) cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            });
        }
        worksheet.getColumn(4).numFmt = '#,##0 "đ"';
        worksheet.columns = [{ width: 5 }, { width: 30 }, { width: 25 }, { width: 18 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 20 }];

        const now = new Date();
        const fileName = `HopDong_${String(now.getDate()).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) { res.status(500).json({ success: false, message: "Lỗi server" }); }
});

// API Xuất Excel Quỹ
app.post('/api/export-fund', async (req, res) => {
    try {
        const transactions = req.body;
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sổ Quỹ');

        const totalThu = transactions.filter(t => t.type === 'Thu').reduce((sum, t) => sum + (t.amount || 0), 0);
        const totalChi = transactions.filter(t => t.type === 'Chi').reduce((sum, t) => sum + (t.amount || 0), 0);
        const balance = totalThu - totalChi;

        worksheet.addRow(['', 'TỔNG THU:', totalThu]).font = { bold: true, color: { argb: 'FF008000' } };
        worksheet.addRow(['', 'TỔNG CHI:', totalChi]).font = { bold: true, color: { argb: 'FFFF0000' } };
        worksheet.addRow(['', 'TỒN QUỸ:', balance]).font = { bold: true, size: 14, color: { argb: 'FF0000FF' } };
        ['C1', 'C2', 'C3'].forEach(cell => { worksheet.getCell(cell).numFmt = '#,##0 "đ"'; });
        worksheet.addRow([]);

        const headerRow = worksheet.addRow(['STT', 'Nội dung', 'Loại', 'Số tiền', 'Tags', 'Ngày ghi', 'Chứng từ']);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }; cell.alignment = { horizontal: 'center' }; });

        transactions.forEach((t, index) => {
            const row = worksheet.addRow([index + 1, t.title, t.type, t.amount, t.tags, t.date, t.image ? 'Có file' : '']);
            const color = t.type === 'Thu' ? 'FF008000' : 'FFFF0000';
            row.getCell(3).font = { bold: true, color: { argb: color } };
            row.getCell(4).font = { bold: true, color: { argb: color } };
        });

        worksheet.getColumn(4).numFmt = '#,##0 "đ"';
        worksheet.columns = [{ width: 5 }, { width: 40 }, { width: 10 }, { width: 20 }, { width: 15 }, { width: 20 }, { width: 15 }];

        const lastRow = worksheet.lastRow.number;
        for (let i = 5; i <= lastRow; i++) {
            worksheet.getRow(i).eachCell({ includeEmpty: true }, cell => {
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            });
        }

        const now = new Date();
        const fileName = `SoQuy_${String(now.getDate()).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) { res.status(500).send("Lỗi xuất Excel"); }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server đang chạy!`);
    console.log(`👉 Truy cập trên máy này: http://localhost:${PORT}`);
    console.log(`👉 Truy cập từ máy khác: http://192.168.10.8:${PORT}`);
});