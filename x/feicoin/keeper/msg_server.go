package keeper

import (
	"context"
	"feicoin/x/feicoin/types"
	"fmt"

	sdk "github.com/cosmos/cosmos-sdk/types"
	sdkerrors "github.com/cosmos/cosmos-sdk/types/errors"
)

type msgServer struct {
	Keeper
}

// NewMsgServerImpl returns an implementation of the MsgServer interface
// for the provided Keeper.
func NewMsgServerImpl(keeper Keeper) types.MsgServer {
	return &msgServer{Keeper: keeper}
}

var _ types.MsgServer = msgServer{}

// MintTokens allows authorized users to mint new tokens
func (k msgServer) MintTokens(goCtx context.Context, req *types.MsgMintTokens) (*types.MsgMintTokensResponse, error) {
	ctx := sdk.UnwrapSDKContext(goCtx)

	// Get bob's address for permission check
	bobAddress := "feic1kfde52eamxnnwkn2yjv9uj5xuf0amxuh70tnpw" // Bob's address

	// Check if the authority is bob (the authorized minter)
	if req.Authority != bobAddress {
		return nil, sdkerrors.Wrapf(sdkerrors.ErrUnauthorized, 
			"only %s can mint tokens, got %s", bobAddress, req.Authority)
	}

	// Parse the recipient address
	recipientAddr, err := sdk.AccAddressFromBech32(req.Recipient)
	if err != nil {
		return nil, sdkerrors.Wrapf(sdkerrors.ErrInvalidAddress, 
			"invalid recipient address: %s", err)
	}

	// Create the coin to mint
	coin := sdk.NewCoin(req.Denom, req.Amount)
	coins := sdk.NewCoins(coin)

	// Mint coins to the module account first
	if err := k.bankKeeper.MintCoins(ctx, types.ModuleName, coins); err != nil {
		return nil, sdkerrors.Wrap(err, "failed to mint coins")
	}

	// Send coins from module account to recipient
	if err := k.bankKeeper.SendCoinsFromModuleToAccount(
		ctx, types.ModuleName, recipientAddr, coins); err != nil {
		return nil, sdkerrors.Wrap(err, "failed to send minted coins to recipient")
	}

	// Emit event
	ctx.EventManager().EmitEvent(
		sdk.NewEvent(
			"token_minted",
			sdk.NewAttribute("minter", req.Authority),
			sdk.NewAttribute("recipient", req.Recipient),
			sdk.NewAttribute("amount", req.Amount.String()),
			sdk.NewAttribute("denom", req.Denom),
		),
	)

	return &types.MsgMintTokensResponse{}, nil
}
