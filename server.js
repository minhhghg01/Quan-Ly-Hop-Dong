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

// --- THÊM ĐOẠN NÀY: TỰ ĐỘNG CHUYỂN HƯỚNG VÀO TRANG CHỦ ---
app.get('/', (req, res) => {
    // Khi ai đó vào trang chủ (root), tự động đẩy họ sang file index.html
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
const DB_FILE = path.join(__dirname, 'database.json');
const CONTRACT_FILE = path.join(__dirname, 'contract.json');

if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify([]));
if (!fs.existsSync(CONTRACT_FILE)) fs.writeFileSync(CONTRACT_FILE, JSON.stringify([]));

// --- API GET ---
app.get('/api/transactions', (req, res) => {
    try {
        if (fs.existsSync(DB_FILE)) {
            res.json(JSON.parse(fs.readFileSync(DB_FILE)));
        } else {
            res.json([]);
        }
    } catch (error) {
        res.json([]);
    }
});
app.get('/api/contract', (req, res) => {
    try {
        if (fs.existsSync(CONTRACT_FILE)) {
            res.json(JSON.parse(fs.readFileSync(CONTRACT_FILE)));
        } else {
            res.json([]);
        }
    } catch (error) {
        res.json([]);
    }
});

// --- API POST THU CHI ---
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
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// --- API POST HỢP ĐỒNG (THÊM MỚI) ---
app.post('/api/contract', upload.single('image'), (req, res) => {
    try {
        const {
            title, amount, tags, company,
            paymentDate, signDate, expireDate, reminderDate, // Thêm reminderDate
            status, note
        } = req.body;

        const contracts = JSON.parse(fs.readFileSync(CONTRACT_FILE));

        const newContract = {
            id: Date.now(),
            title: title || "",
            company: company || "",
            amount: Number(amount) || 0,
            paymentDate: paymentDate || "",
            signDate: signDate || "",
            expireDate: expireDate || "",
            reminderDate: reminderDate || "", // Lưu ngày nhắc
            status: status || "Mới",
            note: note || "",
            tags: tags || "",
            image: req.file ? req.file.filename : null,
            created_at: new Date().toLocaleString('vi-VN')
        };

        contracts.push(newContract);
        fs.writeFileSync(CONTRACT_FILE, JSON.stringify(contracts, null, 2));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// --- API POST HỢP ĐỒNG (CẬP NHẬT / SỬA) ---
// Logic: Tìm theo ID và ghi đè dữ liệu mới vào
app.post('/api/contract/update', upload.single('image'), (req, res) => {
    try {
        const {
            id, title, amount, tags, company,
            paymentDate, signDate, expireDate, reminderDate,
            status, note
        } = req.body;

        let contracts = JSON.parse(fs.readFileSync(CONTRACT_FILE));

        // Tìm vị trí hợp đồng cần sửa
        const index = contracts.findIndex(c => c.id == id);

        if (index !== -1) {
            // Cập nhật các trường
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

            // Chỉ cập nhật ảnh nếu người dùng upload ảnh mới
            if (req.file) {
                contracts[index].image = req.file.filename;
            }

            fs.writeFileSync(CONTRACT_FILE, JSON.stringify(contracts, null, 2));
            res.json({ success: true });
        } else {
            res.status(404).json({ success: false, message: "Không tìm thấy hợp đồng" });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// --- IMPORT THƯ VIỆN EXCEL ---
// Đảm bảo thư mục report tồn tại
const REPORT_DIR = path.join(__dirname, 'report');
if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR);
}

// --- API XUẤT EXCEL (TÙY BIẾN) ---
app.post('/api/export', async (req, res) => {
    try {
        const contracts = req.body;

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Danh sách Hợp đồng');

        // 1. TÍNH TỔNG TIỀN
        const totalAmount = contracts.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

        // 2. THÊM DÒNG TỔNG TIỀN (Dòng 1)
        const rowTotal = worksheet.addRow(['', 'TỔNG GIÁ TRỊ HỢP ĐỒNG:', '', totalAmount]);

        // Style cho ô Tiêu đề (Cột B - Cell 2)
        const cellTitle = rowTotal.getCell(2);
        cellTitle.font = { bold: true, size: 14, color: { argb: 'FFFF0000' } }; // Chữ đỏ

        // Style cho ô Số tiền (Cột C - Cell 3)
        const cellValue = rowTotal.getCell(3);
        cellValue.numFmt = '#,##0 "đ"';
        cellValue.font = { bold: true, size: 14, color: { argb: 'FFFF0000' } };

        // 3. THÊM 2 DÒNG TRỐNG (Dòng 2, 3)
        worksheet.addRow([]);
        worksheet.addRow([]);

        // 4. THÊM TIÊU ĐỀ BẢNG (Dòng 4)
        const headerRow = worksheet.addRow([
            'STT', 'Tên Hợp đồng', 'Công ty', 'Giá trị', 'Tags',
            'Ngày ký', 'Thanh toán', 'Hết hạn', 'Trạng thái', 'Ghi chú'
        ]);

        // Style cho Header
        headerRow.font = { bold: true };
        headerRow.eachCell((cell) => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE9ECEF' } // Nền xám
            };
            cell.border = { bottom: { style: 'thin' } };
        });

        // 5. THÊM DỮ LIỆU (Từ dòng 5 trở đi)
        contracts.forEach((c, index) => {
            worksheet.addRow([
                index + 1,
                c.title,
                c.company,
                c.amount,
                c.tags,
                c.signDate ? c.signDate.split('-').reverse().join('/') : '',
                c.paymentDate ? c.paymentDate.split('-').reverse().join('/') : '',
                c.expireDate ? c.expireDate.split('-').reverse().join('/') : '',
                c.status,
                c.note
            ]);
        });

        // 6. KẺ BẢNG (BORDERS) TỰ ĐỘNG
        // Lặp từ dòng Header (dòng 4) đến dòng cuối cùng
        const lastRow = worksheet.lastRow.number;
        for (let i = 4; i <= lastRow; i++) {
            const row = worksheet.getRow(i);
            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                // Chỉ kẻ khung cho 10 cột dữ liệu
                if (colNumber <= 10) {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                }
            });
        }

        // 7. ĐỊNH DẠNG ĐỘ RỘNG CỘT
        worksheet.getColumn(4).numFmt = '#,##0 "đ"'; // Cột Giá trị
        worksheet.columns = [
            { width: 5 }, { width: 30 }, { width: 25 }, { width: 18 }, { width: 15 },
            { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 20 }
        ];

        // 8. GỬI FILE VỀ CLIENT (STREAM)
        const now = new Date();
        const fileName = `HopDong_${String(now.getDate()).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        // Thêm dấu ngoặc kép quanh biến fileName để đúng chuẩn HTTP
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error("Lỗi xuất Excel:", error);
        res.status(500).json({ success: false, message: "Lỗi server" });
    }
});

// Thêm API xóa (để tính năng chuột phải hoạt động)
app.post('/api/contract/delete', (req, res) => {
    // ... Logic xóa ID khỏi database.json (Bạn tự thêm nhé nếu cần) ...
    // Để demo thì trả về success luôn
    res.json({ success: true });
});

// API TẢI FILE (Download)
app.get('/api/download/:fileName', (req, res) => {
    const filePath = path.join(REPORT_DIR, req.params.fileName);
    if (fs.existsSync(filePath)) {
        res.download(filePath); // Trình duyệt sẽ tự tải xuống
    } else {
        res.status(404).send("File không tồn tại");
    }
});

// --- API POST SỬA GIAO DỊCH QUỸ ---
app.post('/api/transaction/update', upload.single('image'), (req, res) => {
    try {
        const { id, title, amount, type, tags, date } = req.body; // date ở đây là ngày ghi sổ
        let transactions = JSON.parse(fs.readFileSync(DB_FILE));

        const index = transactions.findIndex(t => t.id == id);
        if (index !== -1) {
            transactions[index].title = title;
            transactions[index].amount = Number(amount);
            transactions[index].type = type;
            transactions[index].tags = tags;
            // Nếu muốn cho sửa ngày thì cập nhật, không thì giữ nguyên
            if (date) transactions[index].date = date;

            if (req.file) transactions[index].image = req.file.filename;

            fs.writeFileSync(DB_FILE, JSON.stringify(transactions, null, 2));
            res.json({ success: true });
        } else {
            res.status(404).json({ success: false, message: "Không tìm thấy giao dịch" });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// --- API XUẤT EXCEL QUỸ (STREAM) ---
app.post('/api/export-fund', async (req, res) => {
    try {
        const transactions = req.body;
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sổ Quỹ');

        // 1. TÍNH TOÁN
        const totalThu = transactions.filter(t => t.type === 'Thu').reduce((sum, t) => sum + (t.amount || 0), 0);
        const totalChi = transactions.filter(t => t.type === 'Chi').reduce((sum, t) => sum + (t.amount || 0), 0);
        const balance = totalThu - totalChi;

        // 2. HEADER TỔNG HỢP
        worksheet.addRow(['', 'TỔNG THU:', totalThu]).font = { bold: true, color: { argb: 'FF008000' } }; // Xanh
        worksheet.addRow(['', 'TỔNG CHI:', totalChi]).font = { bold: true, color: { argb: 'FFFF0000' } }; // Đỏ
        worksheet.addRow(['', 'TỒN QUỸ:', balance]).font = { bold: true, size: 14, color: { argb: 'FF0000FF' } }; // Xanh dương

        // Format tiền cho các ô tổng
        ['C1', 'C2', 'C3'].forEach(cell => {
            worksheet.getCell(cell).numFmt = '#,##0 "đ"';
        });

        worksheet.addRow([]); // Dòng trống

        // 3. HEADER BẢNG
        const headerRow = worksheet.addRow(['STT', 'Nội dung', 'Loại', 'Số tiền', 'Tags', 'Ngày ghi', 'Chứng từ']);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }; // Nền xanh
            cell.alignment = { horizontal: 'center' };
        });

        // 4. DỮ LIỆU
        transactions.forEach((t, index) => {
            const row = worksheet.addRow([
                index + 1,
                t.title,
                t.type,
                t.amount,
                t.tags,
                t.date,
                t.image ? 'Có file' : ''
            ]);

            // Màu chữ cho Thu/Chi
            const color = t.type === 'Thu' ? 'FF008000' : 'FFFF0000';
            row.getCell(3).font = { bold: true, color: { argb: color } }; // Cột Loại
            row.getCell(4).font = { bold: true, color: { argb: color } }; // Cột Tiền
        });

        // 5. FORMAT VÀ BORDER
        worksheet.getColumn(4).numFmt = '#,##0 "đ"';
        worksheet.columns = [{ width: 5 }, { width: 40 }, { width: 10 }, { width: 20 }, { width: 15 }, { width: 20 }, { width: 15 }];

        // Kẻ khung
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