const http = require('http');
const { exec } = require('child_process');
const url = require('url');

// 创建 HTTP 服务器来处理转账请求
const server = http.createServer((req, res) => {
    // 设置 CORS 头以允许浏览器访问
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    if (req.method === 'POST' && req.url === '/transfer') {
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', () => {
            try {
                const transferData = JSON.parse(body);
                const { fromAccount, toAccount, amount, denom } = transferData;
                
                // 构造转账命令
                const command = `/Users/ggbond/go/bin/feicoind tx bank send ${fromAccount} ${toAccount} ${amount}${denom} --from ${fromAccount} --keyring-backend test --chain-id feicoin --yes --node http://localhost:26657`;
                
                console.log(`执行转账命令: ${command}`);
                
                // 执行转账命令
                exec(command, (error, stdout, stderr) => {
                    if (error) {
                        console.error(`转账错误: ${error}`);
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ 
                            success: false, 
                            error: error.message,
                            stderr: stderr 
                        }));
                        return;
                    }
                    
                    console.log(`转账成功: ${stdout}`);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ 
                        success: true, 
                        output: stdout,
                        command: command
                    }));
                });
                
            } catch (parseError) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: false, 
                    error: 'Invalid JSON data' 
                }));
            }
        });
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`转账服务器运行在 http://localhost:${PORT}`);
    console.log('现在区块链浏览器可以执行真实转账了！');
});