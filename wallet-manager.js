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
    const urlParts = path.split('?');
    const basePath = urlParts[0];
    const queryParams = new URLSearchParams(urlParts[1] || '');
    
    switch (basePath) {
        case '/wallets/list':
            handleListWallets(res);
            break;
        case '/validators/list':
            handleListValidators(res);
            break;
        case '/transactions/search':
            handleSearchTransactions(queryParams, res);
            break;
        case '/transactions/list':
            handleListTransactions(queryParams, res);
            break;
        default:
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Endpoint not found' }));
    }
}

// 转账功能 - 增强版，支持备注信息
function handleTransfer(data, res) {
    const { fromAccount, toAccount, amount, denom, memo } = data;
    
    // 构建带备注的转账命令
    let command = `/Users/ggbond/go/bin/feicoind tx bank send ${fromAccount} ${toAccount} ${amount}${denom} --from ${fromAccount} --keyring-backend test --chain-id feicoin --yes --node http://localhost:26657`;
    
    // 如果有备注，添加到命令中
    if (memo && memo.trim()) {
        command += ` --note "${memo.trim()}"`;
    }
    
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

// 从区块链查询交易记录
async function handleListTransactions(queryParams, res) {
    try {
        const page = parseInt(queryParams.get('page') || '1');
        const limit = Math.min(parseInt(queryParams.get('limit') || '20'), 100);
        const account = queryParams.get('account') || '';
        
        console.log(`查询交易记录 - 页码: ${page}, 限制: ${limit}, 账户: ${account}`);
        
        // 使用区块链RPC接口查询交易
        const transactions = await getTransactionsFromBlockchain(account, page, limit);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            data: {
                transactions: transactions,
                page: page,
                limit: limit,
                total: transactions.length
            }
        }));
        
    } catch (error) {
        console.error(`查询交易记录失败: ${error}`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: error.message
        }));
    }
}

// 搜索交易记录
async function handleSearchTransactions(queryParams, res) {
    try {
        const query = queryParams.get('q') || '';
        const type = queryParams.get('type') || '';
        const account = queryParams.get('account') || '';
        const page = parseInt(queryParams.get('page') || '1');
        const limit = Math.min(parseInt(queryParams.get('limit') || '20'), 100);
        
        console.log(`搜索交易记录 - 查询: ${query}, 类型: ${type}, 账户: ${account}`);
        
        // 从区块链搜索交易
        const transactions = await searchTransactionsFromBlockchain(query, type, account, page, limit);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            data: {
                transactions: transactions,
                query: query,
                type: type,
                account: account,
                page: page,
                limit: limit,
                total: transactions.length
            }
        }));
        
    } catch (error) {
        console.error(`搜索交易失败: ${error}`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: error.message
        }));
    }
}

// 从区块链获取交易记录的核心函数
async function getTransactionsFromBlockchain(targetAccount = '', page = 1, limit = 20) {
    try {
        console.log(`开始从区块链获取交易记录...`);
        
        // 获取最新区块高度
        const latestResponse = await fetch('http://localhost:1317/cosmos/base/tendermint/v1beta1/blocks/latest');
        const latestData = await latestResponse.json();
        const latestHeight = parseInt(latestData.block.header.height);
        
        console.log(`最新区块高度: ${latestHeight}`);
        
        let allTransactions = [];
        
        // 先尝试查询一些已知有交易的区块
        const knownTxBlocks = [5055, 4765, 4738]; // 已知的有交易的区块
        for (const height of knownTxBlocks) {
            try {
                console.log(`查询已知交易区块 ${height}...`);
                const txResponse = await fetch(`http://localhost:1317/cosmos/tx/v1beta1/txs?query=tx.height=${height}&limit=100`);
                if (txResponse.ok) {
                    const txData = await txResponse.json();
                    if (txData.tx_responses && txData.tx_responses.length > 0) {
                        console.log(`已知区块 ${height} 找到 ${txData.tx_responses.length} 笔交易`);
                        for (const txResponse of txData.tx_responses) {
                            try {
                                const transaction = parseTransactionData(txResponse, txResponse.timestamp);
                                if (targetAccount && !isTransactionRelatedToAccount(transaction, targetAccount)) {
                                    continue;
                                }
                                allTransactions.push(transaction);
                                console.log(`解析交易: ${transaction.txhash.substring(0, 8)}... 类型: ${transaction.type} 从: ${transaction.from_address.substring(0, 12)}... 到: ${transaction.to_address.substring(0, 12)}... 金额: ${transaction.amount.map(a => a.amount + a.denom).join(',')}`);
                            } catch (txError) {
                                console.error(`解析交易失败:`, txError.message);
                            }
                        }
                    }
                }
            } catch (error) {
                console.error(`查询已知区块 ${height} 失败:`, error.message);
            }
        }
        
        // 如果已经找到足够的交易，直接返回
        if (allTransactions.length >= limit) {
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const paginatedTransactions = allTransactions.slice(startIndex, endIndex);
            console.log(`从已知区块获取到 ${allTransactions.length} 笔交易，返回第 ${page} 页的 ${paginatedTransactions.length} 笔`);
            return paginatedTransactions;
        }
        
        const startHeight = Math.max(1, latestHeight - 50); // 查询最近50个区块
        
        // 使用更简单的方法：直接按区块高度查询交易
        for (let height = latestHeight; height >= startHeight && allTransactions.length < limit * 2; height--) {
            try {
                console.log(`查询区块 ${height} 的交易...`);
                
                // 查询该区块的所有交易
                const txResponse = await fetch(`http://localhost:1317/cosmos/tx/v1beta1/txs?query=tx.height=${height}&limit=100`);
                if (!txResponse.ok) {
                    console.log(`区块 ${height} 查询失败，状态码: ${txResponse.status}`);
                    continue;
                }
                
                const txData = await txResponse.json();
                console.log(`区块 ${height} 查询结果:`, JSON.stringify(txData).substring(0, 200) + '...');
                
                if (!txData.tx_responses || txData.tx_responses.length === 0) {
                    console.log(`区块 ${height} 没有交易`);
                    continue;
                }
                
                console.log(`区块 ${height} 找到 ${txData.tx_responses.length} 笔交易`);
                
                // 处理每个交易
                for (const txResponse of txData.tx_responses) {
                    try {
                        const transaction = parseTransactionData(txResponse, txResponse.timestamp);
                        
                        // 如果指定了账户，进行过滤
                        if (targetAccount && !isTransactionRelatedToAccount(transaction, targetAccount)) {
                            continue;
                        }
                        
                        allTransactions.push(transaction);
                        console.log(`解析交易: ${transaction.txhash.substring(0, 8)}... 类型: ${transaction.type} 从: ${transaction.from_address.substring(0, 12)}... 到: ${transaction.to_address.substring(0, 12)}... 金额: ${transaction.amount.map(a => a.amount + a.denom).join(',')}`);
                    } catch (txError) {
                        console.error(`解析交易失败:`, txError.message);
                    }
                }
            } catch (blockError) {
                console.error(`查询区块 ${height} 的交易失败:`, blockError.message);
            }
        }
        
        // 按时间戳降序排序
        allTransactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // 分页处理
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedTransactions = allTransactions.slice(startIndex, endIndex);
        
        console.log(`获取到 ${allTransactions.length} 笔交易，返回第 ${page} 页的 ${paginatedTransactions.length} 笔`);
        
        return paginatedTransactions;
        
    } catch (error) {
        console.error('从区块链获取交易失败:', error);
        return [];
    }
}

// 从区块事件中解析交易信息
async function parseTransactionFromBlockEvents(blockData, txIndex, txHash, blockTime) {
    const crypto = require('crypto');
    
    const transaction = {
        txhash: txHash,
        height: blockData.block.header.height,
        timestamp: blockTime,
        gas_used: '0',
        gas_wanted: '0',
        type: 'bank_send',
        status: 'success',
        from_address: '',
        to_address: '',
        amount: [],
        memo: '',
        fee: [],
        tx_index: txIndex
    };
    
    try {
        // 查询区块结果来获取事件信息
        const blockResultsResponse = await fetch(`http://localhost:1317/cosmos/base/tendermint/v1beta1/block_results/${blockData.block.header.height}`);
        if (blockResultsResponse.ok) {
            const blockResults = await blockResultsResponse.json();
            
            if (blockResults.block_results && blockResults.block_results.txs_results && blockResults.block_results.txs_results[txIndex]) {
                const txResult = blockResults.block_results.txs_results[txIndex];
                
                // 从事件中提取交易信息
                if (txResult.events) {
                    for (const event of txResult.events) {
                        if (event.type === 'transfer') {
                            // 解析转账事件
                            let sender = '';
                            let recipient = '';
                            let amount = '';
                            
                            for (const attr of event.attributes) {
                                const key = Buffer.from(attr.key, 'base64').toString('utf8');
                                const value = Buffer.from(attr.value, 'base64').toString('utf8');
                                
                                if (key === 'sender') {
                                    sender = value;
                                } else if (key === 'recipient') {
                                    recipient = value;
                                } else if (key === 'amount') {
                                    amount = value;
                                }
                            }
                            
                            if (sender && recipient && amount) {
                                transaction.from_address = sender;
                                transaction.to_address = recipient;
                                
                                // 解析金额，格式类似 "1000token"
                                const amountMatch = amount.match(/^(\d+)([a-zA-Z]+)$/);
                                if (amountMatch) {
                                    transaction.amount = [{
                                        amount: amountMatch[1],
                                        denom: amountMatch[2]
                                    }];
                                }
                            }
                        } else if (event.type === 'message') {
                            // 从message事件中获取更多信息
                            for (const attr of event.attributes) {
                                const key = Buffer.from(attr.key, 'base64').toString('utf8');
                                const value = Buffer.from(attr.value, 'base64').toString('utf8');
                                
                                if (key === 'sender') {
                                    transaction.from_address = transaction.from_address || value;
                                }
                            }
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.log(`解析区块事件失败: ${error.message}`);
    }
    
    return transaction;
}

// 解析区块中的交易
async function parseBlockTransaction(txBase64, height, blockTime, txIndex) {
    const crypto = require('crypto');
    
    // 生成交易哈希
    const txHash = crypto.createHash('sha256').update(txBase64).digest('hex').toUpperCase();
    
    const transaction = {
        txhash: txHash,
        height: height.toString(),
        timestamp: blockTime,
        gas_used: '0',
        gas_wanted: '0',
        type: 'unknown',
        status: 'success',
        from_address: '',
        to_address: '',
        amount: [],
        memo: '',
        fee: [],
        tx_index: txIndex
    };
    
    try {
        // 尝试查询具体的交易信息
        const txResponse = await fetch(`http://localhost:1317/cosmos/tx/v1beta1/txs/${txHash}`);
        if (txResponse.ok) {
            const txData = await txResponse.json();
            return parseTransactionData(txData.tx_response, blockTime);
        }
    } catch (error) {
        // 如果无法获取详细信息，返回基础信息
    }
    
    // 尝试从 base64 数据中提取基本信息
    try {
        const txBuffer = Buffer.from(txBase64, 'base64');
        // 这里可以添加更复杂的交易解析逻辑
        // 目前返回基本的交易结构
        transaction.type = 'bank_send'; // 假设大多数是转账交易
    } catch (decodeError) {
        console.error('解码交易数据失败:', decodeError.message);
    }
    
    return transaction;
}

// 解析交易数据
function parseTransactionData(txResponse, blockTime) {
    const transaction = {
        txhash: txResponse.txhash,
        height: txResponse.height,
        timestamp: txResponse.timestamp || blockTime,
        gas_used: txResponse.gas_used || '0',
        gas_wanted: txResponse.gas_wanted || '0',
        type: 'unknown',
        status: txResponse.code === 0 ? 'success' : 'failed',
        from_address: '',
        to_address: '',
        amount: [],
        memo: '',
        fee: []
    };
    
    // 解析交易类型和消息
    if (txResponse.tx && txResponse.tx.body) {
        // 在新版本中，备注可能存储在memo或note字段中
        transaction.memo = txResponse.tx.body.memo || txResponse.tx.body.note || '';
        
        if (txResponse.tx.body.messages && txResponse.tx.body.messages.length > 0) {
            const message = txResponse.tx.body.messages[0];
            
            if (message['@type']) {
                if (message['@type'].includes('bank.v1beta1.MsgSend')) {
                    transaction.type = 'bank_send';
                    transaction.from_address = message.from_address;
                    transaction.to_address = message.to_address;
                    transaction.amount = message.amount || [];
                } else if (message['@type'].includes('staking.v1beta1.MsgDelegate')) {
                    transaction.type = 'delegate';
                    transaction.from_address = message.delegator_address;
                    transaction.to_address = message.validator_address;
                    transaction.amount = [message.amount];
                } else if (message['@type'].includes('staking.v1beta1.MsgCreateValidator')) {
                    transaction.type = 'create_validator';
                    transaction.from_address = message.delegator_address;
                    transaction.amount = [message.value];
                } else if (message['@type'].includes('distribution.v1beta1.MsgWithdrawDelegatorReward')) {
                    transaction.type = 'withdraw_reward';
                    transaction.from_address = message.delegator_address;
                    transaction.to_address = message.validator_address;
                } else if (message['@type'].includes('feicoin.MintTokens')) {
                    transaction.type = 'mint_tokens';
                    transaction.to_address = message.to_address;
                    transaction.amount = [{
                        denom: message.denom,
                        amount: message.amount
                    }];
                }
            }
        }
    }
    
    // 如果从消息中没有获取到地址和金额信息，尝试从事件中获取
    if ((!transaction.from_address || !transaction.to_address || !transaction.amount.length) && txResponse.events) {
        for (const event of txResponse.events) {
            if (event.type === 'transfer') {
                for (const attr of event.attributes) {
                    if (attr.key === 'sender' && !transaction.from_address) {
                        transaction.from_address = attr.value;
                    } else if (attr.key === 'recipient' && !transaction.to_address) {
                        transaction.to_address = attr.value;
                    } else if (attr.key === 'amount' && !transaction.amount.length) {
                        // 解析金额字符串，如 "1000token"
                        const amountMatch = attr.value.match(/^(\d+)([a-zA-Z]+)$/);
                        if (amountMatch) {
                            transaction.amount = [{
                                amount: amountMatch[1],
                                denom: amountMatch[2]
                            }];
                        }
                    }
                }
            }
        }
    }
    
    // 解析手续费
    if (txResponse.tx && txResponse.tx.auth_info && txResponse.tx.auth_info.fee) {
        transaction.fee = txResponse.tx.auth_info.fee.amount || [];
    }
    
    return transaction;
}

// 检查交易是否与指定账户相关
function isTransactionRelatedToAccount(transaction, account) {
    // 检查发送方和接收方地址
    if (transaction.from_address === account || transaction.to_address === account) {
        return true;
    }
    
    // 检查金额中的相关地址
    if (transaction.amount && Array.isArray(transaction.amount)) {
        for (const amt of transaction.amount) {
            if (amt.address === account) {
                return true;
            }
        }
    }
    
    return false;
}

// 搜索交易记录
async function searchTransactionsFromBlockchain(query, type, account, page, limit) {
    try {
        // 首先获取所有交易
        const allTransactions = await getTransactionsFromBlockchain(account, 1, 100);
        
        let filteredTransactions = allTransactions;
        
        // 按类型过滤
        if (type && type !== 'all') {
            filteredTransactions = filteredTransactions.filter(tx => tx.type === type);
        }
        
        // 按查询字符串过滤
        if (query) {
            const queryLower = query.toLowerCase();
            filteredTransactions = filteredTransactions.filter(tx => {
                return (
                    tx.txhash.toLowerCase().includes(queryLower) ||
                    tx.memo.toLowerCase().includes(queryLower) ||
                    (tx.from_address && tx.from_address.toLowerCase().includes(queryLower)) ||
                    (tx.to_address && tx.to_address.toLowerCase().includes(queryLower)) ||
                    tx.type.toLowerCase().includes(queryLower)
                );
            });
        }
        
        // 分页
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        
        return filteredTransactions.slice(startIndex, endIndex);
        
    } catch (error) {
        console.error('搜索交易失败:', error);
        return [];
    }
}

// 添加一个简单的 fetch 实现（如果 Node.js 版本不支持）
if (typeof fetch === 'undefined') {
    global.fetch = require('node-fetch');
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
    console.log('  💎 Token真实增发: POST /token/real-mint');
    console.log('  📜 钱包列表: GET /wallets/list');
    console.log('  🏛️  验证者列表: GET /validators/list');
    console.log('  📋 交易记录: GET /transactions/list?account=&page=1&limit=20');
    console.log('  🔍 搜索交易: GET /transactions/search?q=&type=&account=&page=1&limit=20');
});