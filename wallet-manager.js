const http = require('http');
const { exec } = require('child_process');
const url = require('url');

// 区块链管理服务器 - 支持钱包、转账和验证者管理
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
    
    const urlPath = req.url;
    
    // 路由处理
    if (req.method === 'POST') {
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', () => {
            try {
                const requestData = JSON.parse(body);
                handlePostRequest(urlPath, requestData, res);
            } catch (parseError) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: false, 
                    error: 'Invalid JSON data' 
                }));
            }
        });
    } else if (req.method === 'GET') {
        handleGetRequest(urlPath, res);
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

// 处理 POST 请求
function handlePostRequest(path, data, res) {
    switch (path) {
        case '/transfer':
            handleTransfer(data, res);
            break;
        case '/wallet/create':
            handleCreateWallet(data, res);
            break;
        case '/wallet/import':
            handleImportWallet(data, res);
            break;
        case '/wallet/send-tokens':
            handleSendTokens(data, res);
            break;
        case '/validator/create':
            handleCreateValidator(data, res);
            break;
        case '/validator/delegate':
            handleDelegate(data, res);
            break;
        case '/validator/undelegate':
            handleUndelegate(data, res);
            break;
        case '/rewards/withdraw':
            handleWithdrawRewards(data, res);
            break;
        case '/token/mint':
            handleMintTokens(data, res);
            break;
        case '/token/real-mint':
            handleRealMintTokens(data, res);
            break;
        default:
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Endpoint not found' }));
    }
}

// 处理 GET 请求
function handleGetRequest(path, res) {
    switch (path) {
        case '/wallets/list':
            handleListWallets(res);
            break;
        case '/validators/list':
            handleListValidators(res);
            break;
        default:
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Endpoint not found' }));
    }
}

// 转账功能
function handleTransfer(data, res) {
    const { fromAccount, toAccount, amount, denom } = data;
    const command = `/Users/ggbond/go/bin/feicoind tx bank send ${fromAccount} ${toAccount} ${amount}${denom} --from ${fromAccount} --keyring-backend test --chain-id feicoin --yes --node http://localhost:26657`;
    
    console.log(`执行转账命令: ${command}`);
    executeCommand(command, res, '转账');
}

// 创建新钱包
function handleCreateWallet(data, res) {
    const { name } = data;
    if (!name) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Wallet name is required' }));
        return;
    }
    
    const command = `/Users/ggbond/go/bin/feicoind keys add ${name} --keyring-backend test --output json`;
    console.log(`创建钱包: ${name}`);
    executeCommand(command, res, '创建钱包');
}

// 导入钱包（通过助记词）
function handleImportWallet(data, res) {
    const { name, mnemonic } = data;
    if (!name || !mnemonic) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Name and mnemonic are required' }));
        return;
    }
    
    // 注意：这里需要通过stdin传入助记词，实际实现可能需要更复杂的处理
    const command = `echo "${mnemonic}" | /Users/ggbond/go/bin/feicoind keys add ${name} --recover --keyring-backend test --output json`;
    console.log(`导入钱包: ${name}`);
    executeCommand(command, res, '导入钱包');
}

// 发送代币给新钱包（水龙头功能）
function handleSendTokens(data, res) {
    const { toAccount, amount, denom } = data;
    const command = `/Users/ggbond/go/bin/feicoind tx bank send alice ${toAccount} ${amount}${denom} --from alice --keyring-backend test --chain-id feicoin --yes --node http://localhost:26657`;
    
    console.log(`发送代币到新钱包: ${command}`);
    executeCommand(command, res, '发送代币');
}

// 创建验证者
function handleCreateValidator(data, res) {
    const { fromAccount, amount, moniker, commissionRate, maxCommissionRate, maxCommissionChangeRate } = data;
    
    // 首先获取账户的公钥
    const pubkeyCommand = `/Users/ggbond/go/bin/feicoind tendermint show-validator`;
    
    exec(pubkeyCommand, (error, stdout, stderr) => {
        if (error) {
            console.error(`获取公钥错误: ${error}`);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: error.message, stderr: stderr }));
            return;
        }
        
        const pubkeyStr = stdout.trim();
        
        try {
            // 解析公钥JSON
            const pubkey = JSON.parse(pubkeyStr);
            
            // 创建验证者JSON数据
            const validatorData = {
                pubkey: pubkey,
                amount: `${amount}stake`,
                moniker: moniker,
                identity: "",
                website: "",
                security: "",
                details: `Validator created via FeiCoin Explorer`,
                "commission-rate": commissionRate,
                "commission-max-rate": maxCommissionRate,
                "commission-max-change-rate": maxCommissionChangeRate,
                "min-self-delegation": "1"
            };
            
            // 写入临时JSON文件
            const fs = require('fs');
            const validatorJsonPath = `/tmp/validator_${Date.now()}.json`;
            fs.writeFileSync(validatorJsonPath, JSON.stringify(validatorData, null, 2));
            
            console.log(`验证者数据: ${JSON.stringify(validatorData, null, 2)}`);
            
            // 使用新格式的命令
            const command = `/Users/ggbond/go/bin/feicoind tx staking create-validator ${validatorJsonPath} --from ${fromAccount} --keyring-backend test --chain-id feicoin --yes --node http://localhost:26657`;
            
            console.log(`创建验证者: ${command}`);
            
            // 执行命令并清理临时文件
            exec(command, (error, stdout, stderr) => {
                // 清理临时文件
                try {
                    fs.unlinkSync(validatorJsonPath);
                } catch (e) {
                    console.log('清理临时文件失败:', e.message);
                }
                
                if (error) {
                    console.error(`创建验证者错误: ${error}`);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: error.message, stderr: stderr, output: stdout }));
                    return;
                }
                
                console.log(`创建验证者成功: ${stdout}`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, output: stdout }));
            });
            
        } catch (parseError) {
            console.error(`解析公钥JSON错误: ${parseError}`);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: '公钥格式错误: ' + parseError.message }));
        }
    });
}

// 委托给验证者
function handleDelegate(data, res) {
    const { fromAccount, validatorAddress, amount } = data;
    const command = `/Users/ggbond/go/bin/feicoind tx staking delegate ${validatorAddress} ${amount}stake --from ${fromAccount} --keyring-backend test --chain-id feicoin --yes --node http://localhost:26657`;
    
    console.log(`委托质押: ${command}`);
    executeCommand(command, res, '委托质押');
}

// 取消委托
function handleUndelegate(data, res) {
    const { fromAccount, validatorAddress, amount } = data;
    const command = `/Users/ggbond/go/bin/feicoind tx staking unbond ${validatorAddress} ${amount}stake --from ${fromAccount} --keyring-backend test --chain-id feicoin --yes --node http://localhost:26657`;
    
    console.log(`取消委托: ${command}`);
    executeCommand(command, res, '取消委托');
}

// 提取奖励
function handleWithdrawRewards(data, res) {
    const { delegatorAddress, validatorAddress, fromAccount } = data;
    
    if (!fromAccount || !validatorAddress) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'fromAccount and validatorAddress are required' }));
        return;
    }
    
    const command = `/Users/ggbond/go/bin/feicoind tx distribution withdraw-rewards ${validatorAddress} --from ${fromAccount} --keyring-backend test --chain-id feicoin --yes --node http://localhost:26657`;
    
    console.log(`提取奖励: ${command}`);
    executeCommand(command, res, '提取奖励');
}

// 列出所有钱包
function handleListWallets(res) {
    const command = `/Users/ggbond/go/bin/feicoind keys list --keyring-backend test --output json`;
    console.log('获取钱包列表');
    executeCommand(command, res, '获取钱包列表');
}

// 列出所有验证者
function handleListValidators(res) {
    const command = `/Users/ggbond/go/bin/feicoind query staking validators --output json`;
    console.log('获取验证者列表');
    executeCommand(command, res, '获取验证者列表');
}

// Token增发功能（模拟增发，实际上是从管理员账户转账）
function handleMintTokens(data, res) {
    const { fromAccount, toAccount, amount, denom } = data;
    
    if (!fromAccount || !toAccount || !amount || !denom) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            success: false, 
            error: 'fromAccount, toAccount, amount and denom are required' 
        }));
        return;
    }
    
    // 注意：这实际上是转账操作，模拟增发
    // 真实的增发需要特殊的权限和模块实现
    const command = `/Users/ggbond/go/bin/feicoind tx bank send ${fromAccount} ${toAccount} ${amount}${denom} --from ${fromAccount} --keyring-backend test --chain-id feicoin --yes --node http://localhost:26657`;
    
    console.log(`Token增发(模拟): ${command}`);
    executeCommand(command, res, 'Token增发');
}

// 真实Token增发功能（使用自定义MintTokens消息）
function handleRealMintTokens(data, res) {
    const { fromAccount, toAccount, amount, denom } = data;
    
    if (!fromAccount || !toAccount || !amount || !denom) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            success: false, 
            error: 'fromAccount, toAccount, amount and denom are required' 
        }));
        return;
    }
    
    // 真实增发使用自定义的MintTokens消息
    const command = `/Users/ggbond/go/bin/feicoind tx feicoin mint-tokens ${toAccount} ${amount} ${denom} --from ${fromAccount} --keyring-backend test --chain-id feicoin --yes --node http://localhost:26657`;
    
    console.log(`Token真实增发: ${command}`);
    executeCommand(command, res, 'Token真实增发');
}


// 执行命令的通用函数
function executeCommand(command, res, operation) {
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`${operation}错误: ${error}`);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                success: false, 
                error: error.message,
                stderr: stderr 
            }));
            return;
        }
        
        console.log(`${operation}成功: ${stdout}`);
        
        // 尝试解析 JSON 输出
        let parsedOutput;
        try {
            parsedOutput = JSON.parse(stdout);
        } catch (parseError) {
            parsedOutput = stdout;
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            success: true, 
            output: parsedOutput,
            command: command
        }));
    });
}

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`🚀 区块链管理服务器运行在 http://localhost:${PORT}`);
    console.log('📋 支持的功能:');
    console.log('  💰 转账: POST /transfer');
    console.log('  🔑 创建钱包: POST /wallet/create');
    console.log('  📥 导入钱包: POST /wallet/import');
    console.log('  💸 发送代币: POST /wallet/send-tokens');
    console.log('  ⚡ 创建验证者: POST /validator/create');
    console.log('  🤝 委托质押: POST /validator/delegate');
    console.log('  ↩️  取消委托: POST /validator/undelegate');
    console.log('  🏆 提取奖励: POST /rewards/withdraw');
    console.log('  🔨 Token增发(模拟): POST /token/mint');
    console.log('  📜 钱包列表: GET /wallets/list');
    console.log('  🏛️  验证者列表: GET /validators/list');
});