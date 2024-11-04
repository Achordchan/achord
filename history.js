let userUID = null;
let currentFilter = 'all';  // 默认显示全部

// 检查用户状态并加载历史记录
async function init() {
    try {
        const response = await fetch('/api/user/status');
        const data = await response.json();
        
        if (data.success) {
            userUID = data.data.uid;
            loadHistory();
            initializeStatItems();
        } else {
            document.getElementById('history-list').innerHTML = `
                <div class="empty-state">
                    <i class="ri-user-follow-line"></i>
                    <p>请先在首页绑定微信</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error:', error);
        showError('获取用户状态失败');
    }
}

// 初始化统计项点击事件
function initializeStatItems() {
    document.querySelectorAll('.stat-item').forEach(item => {
        item.addEventListener('click', () => {
            // 移除所有活跃状态
            document.querySelectorAll('.stat-item').forEach(i => i.classList.remove('active'));
            // 添加当前活跃状态
            item.classList.add('active');
            // 更新筛选条件
            currentFilter = item.dataset.filter;
            // 重新渲染列表
            loadHistory();
        });
    });
    
    // 默认激活"全部"选项
    document.querySelector('.stat-item[data-filter="all"]').classList.add('active');
}

// 加载历史记录
async function loadHistory() {
    try {
        const response = await fetch(`/api/user/history?uid=${userUID}`);
        const data = await response.json();
        
        if (data.success) {
            renderHistory(data.data);
        } else {
            showError(data.message || '加载历史记录失败');
        }
    } catch (error) {
        console.error('Error:', error);
        showError('加载历史记录失败');
    }
}

// 渲染历史记录
function renderHistory(records) {
    const historyList = document.getElementById('history-list');
    
    // 更新统计数据
    const totalCount = records.length;
    const pendingCount = records.filter(r => r.status === 'submitted').length;
    const completedCount = records.filter(r => r.status === 'paid').length;
    
    document.getElementById('totalCount').textContent = totalCount;
    document.getElementById('pendingCount').textContent = pendingCount;
    document.getElementById('completedCount').textContent = completedCount;
    
    if (!records || records.length === 0) {
        historyList.innerHTML = `
            <div class="empty-state">
                <i class="ri-inbox-line"></i>
                <p>暂无缴费记录</p>
            </div>
        `;
        return;
    }

    // 根据筛选条件过滤记录
    let filteredRecords = records;
    if (currentFilter === 'pending') {
        filteredRecords = records.filter(r => r.status === 'submitted');
    } else if (currentFilter === 'completed') {
        filteredRecords = records.filter(r => r.status === 'paid');
    }

    if (filteredRecords.length === 0) {
        historyList.innerHTML = `
            <div class="empty-state">
                <i class="ri-inbox-line"></i>
                <p>暂无${currentFilter === 'pending' ? '待处理' : currentFilter === 'completed' ? '已完成' : ''}记录</p>
            </div>
        `;
        return;
    }

    historyList.innerHTML = filteredRecords.map(record => `
        <div class="history-item">
            <div class="history-header">
                <span class="plate-number">${record.plate_number}</span>
                <span class="status status-${record.status}">
                    ${record.status === 'submitted' ? '待处理' : '已完成'}
                </span>
            </div>
            <div class="history-content">
                <p><i class="ri-time-line"></i>提交时间：${formatDate(record.created_at)}</p>
                ${record.paid_at ? 
                    `<p><i class="ri-check-line"></i>处理时间：${formatDate(record.paid_at)}</p>` : 
                    ''}
            </div>
        </div>
    `).join('');
}

// 格式化日期
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 显示错误信息
function showError(message) {
    document.getElementById('history-list').innerHTML = `
        <div class="error-state">
            <i class="ri-error-warning-line"></i>
            <p>${message}</p>
        </div>
    `;
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', init); 