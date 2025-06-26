use anchor_lang::prelude::*;
use crate::errors::ErrorCode::*;
use crate::states::{CertificateNFT, ProgramState, Transaction};

pub fn transfer_nft(
    ctx: Context<TransferNFTCtx>,
    certificate_id: u64,
    new_owner: Pubkey,
) ->Result<()> {
    let certificate = &mut ctx.accounts.cert_nft;
    let current_owner = &ctx.accounts.owner;
    let platform_account = &ctx.accounts.platform_account;
    let program_state = &ctx.accounts.program_state;
    let transaction = &mut ctx.accounts.transaction;

    // Validasi certificate_id
    if certificate.certificate_id != certificate_id {
        return Err(InvalidCertificateId.into());
    }
    
    // Validasi owner
    if certificate.owner != current_owner.key() {
        return Err(NotCertificateOwner.into());
    }
    
     // Validasi bahwa sertifikat aktif
    if !certificate.is_active {
        return Err(InactiveCertificate.into());
    }
    
    // Validasi bahwa pemilik baru tidak sama dengan pemilik saat ini
    if new_owner == current_owner.key() {
        return Err(SameOwner.into());
    }

    // Dapatkan timestamp saat ini
    let clock = Clock::get()?;
    let current_timestamp = clock.unix_timestamp as u64;
    
    let fee_amount = program_state.platform_fee;
    
    // Jika ada platform fee
    if fee_amount > 0 {
        // Transfer SOL ke platform account sebagai fee
        let transfer_instruction = anchor_lang::solana_program::system_instruction::transfer(
            &current_owner.key(),
            &platform_account.key(),
            fee_amount,
        );
        
        anchor_lang::solana_program::program::invoke(
            &transfer_instruction,
            &[
                current_owner.to_account_info(),
                platform_account.to_account_info(),
            ],
        )?;
        
        msg!("Transferred {} lamports as platform fee", fee_amount);
    }
    
    // Perbarui data kepemilikan
    let previous_owner = certificate.owner;
    certificate.owner = new_owner;
    
    // Perbarui counter transfer
    certificate.transfer_count = certificate.transfer_count
        .checked_add(1)
        .ok_or(NumericalOverflow)?;

    // Catat transaksi transfer
    transaction.certificate_id = certificate_id;
    transaction.owner = previous_owner;  // Pemilik asal (yang melakukan transfer)
    transaction.amount = fee_amount;     // Jumlah fee yang dibayarkan
    transaction.timestamp = current_timestamp;
    transaction.credited = true;         // Tandai bahwa transaksi berhasil
    
    // Log event transfer
    msg!(
        "Certificate ID {} transferred from {} to {}",
        certificate_id,
        previous_owner,
        new_owner
    );
    
    Ok(())
}

#[derive(Accounts)]
#[instruction(certificate_id: u64, new_owner: Pubkey)]
pub struct TransferNFTCtx<'info> {
    // Program state yang menyimpan data global
    pub program_state: Account<'info, ProgramState>,
    
    // Sertifikat NFT yang akan diverifikasi
    #[account(
        mut,
        seeds = [
            b"certificate_nft",
            certificate_id.to_le_bytes().as_ref(),
        ],
        bump,
        constraint = cert_nft.certificate_id == certificate_id,
        constraint = cert_nft.owner == owner.key(),
    )]
    pub cert_nft: Account<'info, CertificateNFT>,
    
    // Pihak yang memverifikasi - bisa creator atau admin platform
    #[account(mut)]
    pub owner: Signer<'info>,
    
    #[account(
        mut,
        constraint = platform_account.key() == program_state.platform_address 
    )]
    /// CHECK: Akun ini hanya digunakan untuk menerima fee platform dan divalidasi dengan membandingkan key-nya dengan program_state.platform_address
    pub platform_account: AccountInfo<'info>,
    
   // Account untuk mencatat transaksi transfer
    #[account(
        init,
        payer = owner,
        space = 8 + Transaction::INIT_SPACE,
        seeds = [
            b"transaction",
            certificate_id.to_le_bytes().as_ref(),
            owner.key().as_ref(),
            &[cert_nft.transfer_count]
        ],
        bump
    )]
    pub transaction: Account<'info, Transaction>,
    
    // System program digunakan untuk transfer SOL
    pub system_program: Program<'info, System>,
    
    // Rent sysvar dibutuhkan untuk init account
    pub rent: Sysvar<'info, Rent>,
}