#!/bin/bash

# FeiCoin 区块链服务启动脚本
# 用于启动所有必要的服务

echo "🚀 启动 FeiCoin 区块链服务..."
echo "==============================================="

# 设置环境变量
export CGO_ENABLED=0

# 检查必要的命令是否存在
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo "❌ 错误: $1 命令未找到，请先安装"
        exit 1
    fi
}

echo "🔍 检查依赖..."
check_command "ignite"
check_command "node"
check_command "go"

# 清理可能的残留进程
echo "🧹 清理残留进程..."
pkill -f "feicoind" 2>/dev/null || true
pkill -f "wallet-manager.js" 2>/dev/null || true
pkill -f "ignite chain serve" 2>/dev/null || true

# 等待进程完全停止
sleep 2

echo "📦 启动服务..."

# 创建日志目录
mkdir -p logs

# 1. 启动钱包管理后端服务
echo "  📊 启动钱包管理后端服务 (端口: 3001)..."
nohup node wallet-manager.js > logs/wallet-manager.log 2>&1 &
WALLET_PID=$!
echo "    ✓ 钱包管理服务 PID: $WALLET_PID"

# 等待钱包服务启动
sleep 3

# 2. 启动区块链服务
echo "  ⛓️  启动区块链服务 (端口: 1317, 26657, 4500)..."
echo "    提示: 按 'q' 键可以停止区块链服务"
echo "    区块链服务将在前台运行..."

# 启动区块链服务（前台运行）
ignite chain serve --skip-proto

# 如果用户停止了区块链服务，也停止钱包服务
echo "🛑 正在停止所有服务..."
kill $WALLET_PID 2>/dev/null || true
pkill -f "feicoind" 2>/dev/null || true
pkill -f "wallet-manager.js" 2>/dev/null || true

echo "✅ 所有服务已停止"