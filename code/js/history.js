async function loadHistory() {
    try {
        const res = await fetch(`${API_URL}/history`);
        let logs = await res.json();

        // Mới nhất lên đầu
        logs.sort((a, b) => b.id - a.id);

        const tbody = document.getElementById('table-history-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        logs.forEach((log, index) => {
            // Đổi màu chữ theo hành động
            let color = 'black';
            if (log.action === 'Thêm' || log.action === 'Thêm mới') color = 'green';
            if (log.action === 'Sửa' || log.action === 'Cập nhật') color = 'blue';
            if (log.action === 'Xóa') color = 'red';

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
    } catch (err) {
        console.error("Lỗi tải lịch sử", err);
    }
}