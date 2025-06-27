use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod states;

use instructions::*;
#[allow(unused_imports)]
use states::*;

declare_id!("Aei8GrZ6qdq5pFZJkrDztVqKFe7oLdoiyS2KCxj7M13n");

#[program]
pub mod cernft {
    use super::*;

    pub fn initialize(ctx: Context<InitializeCtx>) -> Result<()> {
        instructions::initialize(ctx)
    }

    pub fn create_nft(
        ctx: Context<CreateNFTCtx>,
        title: String,
        description: String,
        ipfs_uri: String,         // Parameter untuk IPFS URI
        issuer_name: String,      // Parameter untuk issuer
        recipient_name: String,   // Parameter untuk recipient
    ) ->Result<()> {
        instructions::create_nft(ctx, title, description, ipfs_uri, issuer_name, recipient_name)
    }

    pub fn verify_nft(
        ctx: Context<VerifyNFTCtx>,
        certificate_id: u64,
    ) ->Result<()> {
        instructions::verify_nft(ctx, certificate_id)
    }

    pub fn transfer_nft(
        ctx: Context<TransferNFTCtx>,
        certificate_id: u64,
        new_owner: Pubkey,
    ) ->Result<()> {
        instructions::transfer_nft(ctx, certificate_id, new_owner)
    }

    pub fn update_platform_settings(
        ctx: Context<UpdatePlatformSettingsCtx>, 
        new_platform_fee: u64,
    ) -> Result<()> {
        instructions::update_platform_settings(ctx, new_platform_fee)
    }
    
}

