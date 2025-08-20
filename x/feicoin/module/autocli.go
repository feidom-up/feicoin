package feicoin

import (
	autocliv1 "cosmossdk.io/api/cosmos/autocli/v1"

	"feicoin/x/feicoin/types"
)

// AutoCLIOptions implements the autocli.HasAutoCLIConfig interface.
func (am AppModule) AutoCLIOptions() *autocliv1.ModuleOptions {
	return &autocliv1.ModuleOptions{
		Query: &autocliv1.ServiceCommandDescriptor{
			Service: types.Query_serviceDesc.ServiceName,
			RpcCommandOptions: []*autocliv1.RpcCommandOptions{
				{
					RpcMethod: "Params",
					Use:       "params",
					Short:     "Shows the parameters of the module",
				},
				// this line is used by ignite scaffolding # autocli/query
			},
		},
		Tx: &autocliv1.ServiceCommandDescriptor{
			Service:              types.Msg_serviceDesc.ServiceName,
			EnhanceCustomCommand: true, // only required if you want to use the custom command
			RpcCommandOptions: []*autocliv1.RpcCommandOptions{
				{
					RpcMethod: "UpdateParams",
					Skip:      true, // skipped because authority gated
				},
				{
					RpcMethod: "MintTokens",
					Use:       "mint-tokens [recipient] [amount] [denom]",
					Short:     "Mint new tokens (bob only)",
					Long:      "Mint new tokens and send them to the specified recipient. Only bob can execute this command.",
					PositionalArgs: []*autocliv1.PositionalArgDescriptor{
						{ProtoField: "recipient"},
						{ProtoField: "amount"},
						{ProtoField: "denom"},
					},
				},
				// this line is used by ignite scaffolding # autocli/tx
			},
		},
	}
}
