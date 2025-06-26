use anchor_lang::prelude::*;
use crate::errors::ErrorCode::*;
use crate::states::{CertificateNFT, ProgramState};
use crate::constants::ANCHOR_DISCRIMINATOR_SIZE;

pub fn create_nft(
    ctx: Context<CreateNFTCtx>,
    title: String,
    description: String,
    ipfs_uri: String,
    issuer_name: String,
    recipient_name: String,
) -> Result<()> {
    let certificate_nft = &mut ctx.accounts.cert_nft;
    let state = &mut ctx.accounts.program_state;

    // Validasi input
    if title.len() > 64 {
        return Err(TitleTooLong.into());
    }

    if description.len() > 512 {
        return Err(DescTooLong.into());
    }

    if issuer_name.len() > 64 {
        return Err(IssuerNameTooLong.into());
    }

    if recipient_name.len() > 64 {
        return Err(RecipientNameTooLong.into());
    }

    // Validasi format ipfs_uri
    if !ipfs_uri.starts_with("ipfs://") && !ipfs_uri.starts_with("https://ipfs.io/ipfs/") {
        return Err(InvalidIpfsUri.into());
    }

    // Set waktu saat ini (Unix timestamp)
    let clock = Clock::get()?;
    let current_time = clock.unix_timestamp;

    // CRITICAL: Increment certificate count FIRST before using it
    state.certificate_count = state.certificate_count
        .checked_add(1)
        .ok_or(NumericalOverflow)?;

    // Use the incremented count as the certificate ID
    let certificate_id = state.certificate_count;

    // Set certificate NFT data
    certificate_nft.certificate_id = certificate_id;
    certificate_nft.creator = ctx.accounts.creator.key();
    certificate_nft.title = title;
    certificate_nft.description = description;
    certificate_nft.ipfs_uri = ipfs_uri;
    certificate_nft.issuer_name = issuer_name;
    certificate_nft.recipient_name = recipient_name;
    certificate_nft.issue_date = current_time;
    certificate_nft.owner = ctx.accounts.creator.key(); // Set owner to creator initially
    certificate_nft.status_verify = false;  // Default belum diverifikasi
    certificate_nft.transfer_count = 0;     // Belum pernah ditransfer
    certificate_nft.is_active = true;

    msg!("Certificate NFT created with ID: {} for creator: {}", certificate_id, ctx.accounts.creator.key());
    msg!("Updated certificate count: {}", state.certificate_count);

    Ok(())
}

#[derive(Accounts)]
pub struct CreateNFTCtx<'info> {
    #[account(
        mut,
        seeds = [b"program_state"],
        bump
    )]
    pub program_state: Account<'info, ProgramState>,

    #[account(
        init,
        payer = creator,
        space = ANCHOR_DISCRIMINATOR_SIZE + CertificateNFT::INIT_SPACE,
        seeds = [
            b"certificate_nft",
            (program_state.certificate_count + 1).to_le_bytes().as_ref()
        ],
        bump
    )]
    pub cert_nft: Account<'info, CertificateNFT>,

    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>
}