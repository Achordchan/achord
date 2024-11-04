let userUID = null;

// 检查用户状态
async function checkUserStatus() {
    try {
        const response = await fetch('/api/user/status');
        const data = await response.json();
        
        const userInfo = document.getElementById('user-info');
        const qrcodeContainer = document.getElementById('qrcode-container');
        
        if (data.success) {
            userUID = data.data.uid;
            // 显示用户信息
            document.getElementById('user-uid').textContent = data.data.uid;
            document.getElementById('bind-time').textContent = new Date(data.data.created_at).toLocaleString();
            // 设置车牌号
            document.getElementById('plateNumber').value = data.data.plate_number;
            userInfo.style.display = 'block';
            qrcodeContainer.style.display = 'none';
        } else {
            userInfo.style.display = 'none';
            qrcodeContainer.style.display = 'block';
            generateQR();
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

async function generateQR() {
    try {
        const response = await fetch('/api/qrcode/user');
        const data = await response.json();
        
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
    }
}

async function checkQRStatus(code) {
    const checkInterval = setInterval(async () => {
        try {
            const response = await fetch(`/api/user/check?code=${code}`);
            const data = await response.json();
            
            if (data.success) {
                clearInterval(checkInterval);
                userUID = data.data.uid;
                window.location.reload();
            }
        } catch (error) {
            console.error('Error checking status:', error);
        }
    }, 2000);
}

document.getElementById('submitBtn')?.addEventListener('click', async function(e) {
    e.preventDefault();
    
    const plateNumber = document.getElementById('plateNumber').value;
    const messageDiv = document.getElementById('message');
    const submitBtn = document.getElementById('submitBtn');

    // 添加确认弹窗
    const confirmDialog = document.createElement('div');
    confirmDialog.className = 'confirm-dialog';
    confirmDialog.innerHTML = `
        <div class="confirm-content">
            <h3>确认提交</h3>
            <p>请认真核对车牌号信息，一旦提交就算作缴费。</p>
            <p class="plate-preview">车牌号：<strong>${plateNumber}</strong></p>
            <div class="confirm-buttons">
                <button class="cancel-btn">返回修改</button>
                <button class="confirm-btn">确认提交</button>
            </div>
        </div>
    `;
    document.body.appendChild(confirmDialog);

    // 处理弹窗按钮点击
    return new Promise((resolve) => {
        const cancelBtn = confirmDialog.querySelector('.cancel-btn');
        const confirmBtn = confirmDialog.querySelector('.confirm-btn');

        cancelBtn.onclick = () => {
            document.body.removeChild(confirmDialog);
            resolve(false);
        };

        confirmBtn.onclick = async () => {
            document.body.removeChild(confirmDialog);
            resolve(true);
        };
    }).then(async (confirmed) => {
        if (!confirmed) return;

        // 禁用提交按钮
        submitBtn.disabled = true;
        messageDiv.textContent = '正在提交...';
        messageDiv.className = 'message';

        try {
            const response = await fetch('/api/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    plateNumber: plateNumber,
                    userUID: userUID
                })
            });

            const result = await response.json();
            
            if (result.success) {
                messageDiv.textContent = '提交成功！';
                messageDiv.className = 'message success';
                
                setTimeout(() => {
                    window.location.href = '/success';
                }, 1500);
            } else {
                throw new Error(result.message || '提交失败');
            }
        } catch (error) {
            messageDiv.textContent = error.message || '提交失败，请稍后重试';
            messageDiv.className = 'message error';
            console.error('Error:', error);
        } finally {
            submitBtn.disabled = false;
        }
    });
});

// 重置用户绑定
async function resetUser() {
    if (!confirm('确定要重新绑定微信吗？这将清除当前绑定。')) {
        return;
    }
    
    try {
        const response = await fetch('/api/user/reset', {
            method: 'POST'
        });
        const data = await response.json();
        
        if (data.success) {
            alert('已清除绑定，请重新扫码');
            window.location.reload();
        } else {
            alert('重置失败：' + (data.message || '未知错误'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('重置失败，请稍后重试');
    }
}

// 保存车牌号
async function savePlateNumber() {
    const plateNumber = document.getElementById('plateNumber').value;
    const messageDiv = document.getElementById('message');
    
    try {
        const response = await fetch('/api/user/plate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                plateNumber: plateNumber,
                userUID: userUID
            })
        });

        const result = await response.json();
        
        if (result.success) {
            messageDiv.textContent = '车牌号保存成功！';
            messageDiv.className = 'message success';
        } else {
            throw new Error(result.message || '保存失败');
        }
    } catch (error) {
        messageDiv.textContent = error.message || '保存失败，请稍后重试';
        messageDiv.className = 'message error';
        console.error('Error:', error);
    }
}

// 页面加载时的事件监听
document.addEventListener('DOMContentLoaded', () => {
    checkUserStatus();
    
    // 添加重置按钮事件监听
    const resetUserBtn = document.getElementById('resetUserBtn');
    if (resetUserBtn) {
        resetUserBtn.addEventListener('click', resetUser);
    }

    // 添加保存车牌按钮事件监听
    const savePlateBtn = document.getElementById('savePlateBtn');
    if (savePlateBtn) {
        savePlateBtn.addEventListener('click', savePlateNumber);
    }
}); 