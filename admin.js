// 检查管理员状态
async function checkAdminStatus() {
    try {
        const response = await fetch('/api/admin/status');
        const data = await response.json();
        
        const adminInfo = document.getElementById('admin-info');
        const qrcodeContainer = document.getElementById('qrcode-container');
        
        if (data.success) {
            // 显示管理员信息
            document.getElementById('current-uid').textContent = data.data.uid;
            document.getElementById('created-at').textContent = new Date(data.data.created_at).toLocaleString();
            adminInfo.style.display = 'block';
            qrcodeContainer.style.display = 'none';
        } else {
            // 显示二维码
            adminInfo.style.display = 'none';
            qrcodeContainer.style.display = 'block';
            generateQR();
        }
    } catch (error) {
        console.error('Error:', error);
        document.querySelector('.message').textContent = '获取管理员状态失败，请刷新页面重试';
    }
}

async function generateQR() {
    try {
        const response = await fetch('/api/qrcode');
        const data = await response.json();
        console.log('QR response:', data);
        
        if (data.success) {
            new QRCode(document.getElementById('qrcode'), {
                text: data.data.url,
                width: 200,
                height: 200,
                colorDark: '#000000',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.H
            });

            checkQRStatus(data.data.code);
        } else {
            document.querySelector('.message').textContent = '生成二维码失败：' + (data.message || '未知错误');
        }
    } catch (error) {
        console.error('Error:', error);
        document.querySelector('.message').textContent = '生成二维码失败，请刷新页面重试';
    }
}

async function checkQRStatus(code) {
    const checkInterval = setInterval(async () => {
        try {
            console.log('Checking status for code:', code);
            const response = await fetch(`/api/admin?code=${code}`);
            const data = await response.json();
            console.log('Status response:', data);
            
            if (data.success) {
                clearInterval(checkInterval);
                alert('设置管理员成功！');
                window.location.reload(); // 重新加载页面显示管理员信息
            }
        } catch (error) {
            console.error('Error checking status:', error);
        }
    }, 2000);
}

// 重置管理员
async function resetAdmin() {
    if (!confirm('确定要重置管理员吗？这将清除当前管理员的设置。')) {
        return;
    }
    
    try {
        const response = await fetch('/api/admin/reset', {
            method: 'POST'
        });
        const data = await response.json();
        
        if (data.success) {
            alert('管理员已重置');
            window.location.reload();
        } else {
            alert('重置失败：' + (data.message || '未知错误'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('重置失败，请稍后重试');
    }
}

// 页面加载时检查管理员状态
document.addEventListener('DOMContentLoaded', () => {
    checkAdminStatus();
    
    // 添加重置按钮事件监听
    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetAdmin);
    }
});