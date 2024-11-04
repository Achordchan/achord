let currentPage = 1;
const pageSize = 10;
let currentTab = 'pending';
let currentFilter = 'all';
let searchText = '';
let allSubmissions = [];

async function loadSubmissions() {
    try {
        const response = await fetch('/api/submissions');
        const data = await response.json();
        
        if (data.success) {
            allSubmissions = data.data;
            renderSubmissions();
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

function filterSubmissions() {
    let filtered = [...allSubmissions];
    
    // 状态过滤
    if (currentTab === 'pending') {
        filtered = filtered.filter(s => s.status === 'submitted');
    } else if (currentTab === 'completed') {
        filtered = filtered.filter(s => s.status === 'paid');
    }
    
    // 搜索过滤
    if (searchText) {
        filtered = filtered.filter(s => 
            s.plate_number.toLowerCase().includes(searchText.toLowerCase())
        );
    }
    
    // 日期过滤
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(today.getTime() - today.getDay() * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    if (currentFilter === 'today') {
        filtered = filtered.filter(s => new Date(s.created_at) >= today);
    } else if (currentFilter === 'week') {
        filtered = filtered.filter(s => new Date(s.created_at) >= thisWeek);
    } else if (currentFilter === 'month') {
        filtered = filtered.filter(s => new Date(s.created_at) >= thisMonth);
    }
    
    return filtered;
}

function renderSubmissions() {
    const filtered = filterSubmissions();
    const totalPages = Math.ceil(filtered.length / pageSize);
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const pageSubmissions = filtered.slice(start, end);
    
    const list = document.getElementById('submissions-list');
    list.innerHTML = pageSubmissions.map(submission => `
        <div class="submission-item">
            <p>车牌号：${submission.plate_number}</p>
            <p>提交时间：${new Date(submission.created_at).toLocaleString()}</p>
            <p>状态：<span class="status status-${submission.status}">${
                submission.status === 'submitted' ? '待处理' : '已完成'
            }</span></p>
            ${submission.status === 'submitted' ? 
                `<button onclick="markAsPaid('${submission.id}', '${submission.user_uid}')">标记为已缴费</button>` : 
                ''}
        </div>
    `).join('');
    
    // 更新分页
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === totalPages;
    document.getElementById('pageInfo').textContent = `第 ${currentPage} / ${totalPages || 1} 页`;
}

async function markAsPaid(submissionId, userUID) {
    if (!confirm('确认标记为已缴费？')) {
        return;
    }
    
    try {
        const response = await fetch('/api/mark-paid', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                submissionId: submissionId,
                userUID: userUID
            })
        });

        const result = await response.json();
        
        if (result.success) {
            alert('已标记为缴费成功！');
            loadSubmissions();
        } else {
            alert('操作失败：' + (result.message || '未知错误'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('操作失败，请稍后重试');
    }
}

// 事件监听
document.addEventListener('DOMContentLoaded', () => {
    loadSubmissions();
    
    // 标签切换
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTab = btn.dataset.tab;
            currentPage = 1;
            renderSubmissions();
        });
    });
    
    // 搜索
    document.getElementById('searchInput').addEventListener('input', (e) => {
        searchText = e.target.value;
        currentPage = 1;
        renderSubmissions();
    });
    
    // 日期筛选
    document.getElementById('dateFilter').addEventListener('change', (e) => {
        currentFilter = e.target.value;
        currentPage = 1;
        renderSubmissions();
    });
    
    // 分页
    document.getElementById('prevPage').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderSubmissions();
        }
    });
    
    document.getElementById('nextPage').addEventListener('click', () => {
        const filtered = filterSubmissions();
        const totalPages = Math.ceil(filtered.length / pageSize);
        if (currentPage < totalPages) {
            currentPage++;
            renderSubmissions();
        }
    });
    
    // 自动刷新
    setInterval(loadSubmissions, 30000); // 每30秒刷新一次
}); 