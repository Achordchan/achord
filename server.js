const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

// 提供静态文件服务
app.use(express.static(path.join(__dirname)));

// 启动服务器
app.listen(port, () => {
    console.log(`服务器运行在 http://localhost:${port}`);
}); 