#!/bin/bash

# FeiCoin 转账演示脚本
# 这个脚本会执行实际的转账并展示整个过程

echo "🚀 FeiCoin 转账演示开始"
echo "========================================"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查区块链是否运行
check_chain_status() {
    echo -e "${BLUE}🔍 检查区块链状态...${NC}"
    if curl -s http://localhost:1317/cosmos/base/tendermint/v1beta1/node_info > /dev/null 2>&1; then
        echo -e "${GREEN}✅ 区块链节点运行中${NC}"
        return 0
    else
        echo -e "${RED}❌ 区块链节点未运行，请先启动: ignite chain serve${NC}"
        return 1
    fi
}

# 显示账户信息
show_account_info() {
    echo -e "\n${BLUE}💰 当前账户余额:${NC}"
    echo "----------------------------------------"
    
    echo -e "${YELLOW}Alice 账户:${NC}"
    alice_addr=$(feicoind keys show alice -a)
    echo "地址: $alice_addr"
    alice_balance=$(curl -s "http://localhost:1317/cosmos/bank/v1beta1/balances/$alice_addr")
    echo "余额: $(echo $alice_balance | grep -o '"amount":"[^"]*"' | cut -d'"' -f4 | head -1) token"
    echo "     $(echo $alice_balance | grep -o '"amount":"[^"]*"' | cut -d'"' -f4 | tail -1) stake"
    
    echo -e "\n${YELLOW}Bob 账户:${NC}"
    bob_addr=$(feicoind keys show bob -a)
    echo "地址: $bob_addr"
    bob_balance=$(curl -s "http://localhost:1317/cosmos/bank/v1beta1/balances/$bob_addr")
    echo "余额: $(echo $bob_balance | grep -o '"amount":"[^"]*"' | cut -d'"' -f4 | head -1) token"
    echo "     $(echo $bob_balance | grep -o '"amount":"[^"]*"' | cut -d'"' -f4 | tail -1) stake"
    echo ""
}

# 获取最新区块高度
get_block_height() {
    curl -s "http://localhost:1317/cosmos/base/tendermint/v1beta1/blocks/latest" | grep -o '"height":"[^"]*"' | cut -d'"' -f4
}

# 执行转账
perform_transfer() {
    local from_account=$1
    local to_account=$2
    local amount=$3
    local denom=$4
    
    echo -e "${BLUE}💸 执行转账交易...${NC}"
    echo "从: $from_account"
    echo "到: $to_account" 
    echo "金额: $amount $denom"
    echo "----------------------------------------"
    
    echo -e "${YELLOW}🔐 正在签名交易...${NC}"
    
    # 获取目标地址
    to_addr=$(feicoind keys show $to_account -a)
    
    # 获取转账前的区块高度
    before_height=$(get_block_height)
    echo -e "${BLUE}📊 转账前区块高度: $before_height${NC}"
    
    # 执行转账
    echo -e "${YELLOW}📡 广播交易到网络...${NC}"
    
    tx_result=$(feicoind tx bank send $from_account $to_addr ${amount}${denom} \
        --chain-id feicoin \
        --fees 5000stake \
        --yes \
        --output json 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        tx_hash=$(echo $tx_result | grep -o '"txhash":"[^"]*"' | cut -d'"' -f4)
        echo -e "${GREEN}✅ 交易已提交，交易哈希: $tx_hash${NC}"
        
        echo -e "${YELLOW}⏳ 等待区块确认...${NC}"
        sleep 6  # 等待区块确认
        
        # 检查新的区块高度
        after_height=$(get_block_height)
        echo -e "${GREEN}📊 确认后区块高度: $after_height${NC}"
        
        if [ $after_height -gt $before_height ]; then
            echo -e "${GREEN}🎉 交易已在区块 #$after_height 中确认！${NC}"
        else
            echo -e "${YELLOW}⏳ 等待下一个区块确认...${NC}"
            sleep 5
            final_height=$(get_block_height)
            echo -e "${GREEN}🎉 交易已在区块 #$final_height 中确认！${NC}"
        fi
        
        return 0
    else
        echo -e "${RED}❌ 交易失败${NC}"
        return 1
    fi
}

# 监控区块生成
monitor_blocks() {
    echo -e "\n${BLUE}⛓️ 实时监控区块生成 (按 Ctrl+C 退出)${NC}"
    echo "========================================"
    
    last_height=$(get_block_height)
    
    while true; do
        sleep 2
        current_height=$(get_block_height)
        
        if [ $current_height -gt $last_height ]; then
            timestamp=$(date '+%H:%M:%S')
            echo -e "${GREEN}[$timestamp] 🆕 新区块生成: #$current_height${NC}"
            
            # 获取区块信息
            block_info=$(curl -s "http://localhost:1317/cosmos/base/tendermint/v1beta1/blocks/$current_height")
            tx_count=$(echo $block_info | grep -o '"txs":\[.*\]' | grep -o ',' | wc -l)
            tx_count=$((tx_count + 1))
            
            if echo $block_info | grep -q '"txs":\[\]'; then
                tx_count=0
            fi
            
            echo -e "${BLUE}    📝 包含交易数: $tx_count${NC}"
            echo -e "${BLUE}    👥 验证者: $(echo $block_info | grep -o '"proposer_address":"[^"]*"' | cut -d'"' -f4 | head -c 10)...${NC}"
            
            last_height=$current_height
        fi
    done
}

# 主菜单
show_menu() {
    echo -e "\n${BLUE}🎛️ 选择操作:${NC}"
    echo "1. 查看账户余额"
    echo "2. Alice 转账给 Bob (100 token)"
    echo "3. Bob 转账给 Alice (50 token)" 
    echo "4. Alice 转账给 Bob (1000 stake)"
    echo "5. 实时监控区块"
    echo "6. 退出"
    echo -n "请选择 (1-6): "
}

# 主程序
main() {
    # 检查区块链状态
    if ! check_chain_status; then
        exit 1
    fi
    
    echo -e "${GREEN}🌟 FeiCoin 区块链转账演示${NC}"
    
    while true; do
        show_menu
        read -r choice
        
        case $choice in
            1)
                show_account_info
                ;;
            2)
                echo -e "\n${YELLOW}🔄 执行: Alice -> Bob (100 token)${NC}"
                show_account_info
                perform_transfer alice bob 100 token
                echo -e "\n${BLUE}📊 转账后余额:${NC}"
                show_account_info
                ;;
            3)
                echo -e "\n${YELLOW}🔄 执行: Bob -> Alice (50 token)${NC}"
                show_account_info
                perform_transfer bob alice 50 token
                echo -e "\n${BLUE}📊 转账后余额:${NC}"
                show_account_info
                ;;
            4)
                echo -e "\n${YELLOW}🔄 执行: Alice -> Bob (1000 stake)${NC}"
                show_account_info
                perform_transfer alice bob 1000 stake
                echo -e "\n${BLUE}📊 转账后余额:${NC}"
                show_account_info
                ;;
            5)
                monitor_blocks
                ;;
            6)
                echo -e "${GREEN}👋 感谢使用 FeiCoin 演示！${NC}"
                exit 0
                ;;
            *)
                echo -e "${RED}❌ 无效选择，请重试${NC}"
                ;;
        esac
    done
}

# 运行主程序
main