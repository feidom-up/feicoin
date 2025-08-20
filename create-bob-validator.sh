#!/bin/bash

# 让 Bob 成为验证者的脚本
echo "创建 Bob 验证者..."

feicoind tx staking create-validator \
  --amount=50000000stake \
  --pubkey=$(feicoind tendermint show-validator) \
  --moniker="bob-validator" \
  --commission-rate="0.05" \
  --commission-max-rate="0.20" \
  --commission-max-change-rate="0.01" \
  --min-self-delegation="1" \
  --from=bob \
  --keyring-backend=test \
  --chain-id=feicoin \
  --yes

echo "Bob 验证者创建完成！"
echo "现在网络将有2个验证者，可以看到轮换了"