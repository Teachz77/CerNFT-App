use anchor_lang::prelude::*;
use crate::errors::ErrorCode::*;
use crate::states::{CertificateNFT, ProgramState};

pub fn verify_nft(
    ctx: Context<VerifyNFTCtx>,
    certificate_id: u64,
) ->Result<()> {

    let cert_nft = &mut ctx.accounts.cert_nft;
    let program_state = &ctx.accounts.program_state;
    let verifier = &ctx.accounts.verifier;

    // Validasi bahwa certificate_id sesuai dengan account yang diberikan
    if cert_nft.certificate_id != certificate_id {
        return Err(InvalidCertificateId.into());
    }

    if cert_nft.status_verify{
        return Err(AlreadyVerified.into());
    }

    if cert_nft.creator != verifier.key(){
        if program_state.platform_address != verifier.key(){
            return Err(UnauthorizedVerifier.into());
        }
    }

    if !cert_nft.is_active {
        return Err(InactiveCertificate.into());
    }

    cert_nft.status_verify = true;

    // Ambil waktu saat ini dan perbarui timestamp

    // let clock = Clock::get()?;

    // Certificate tidak memiliki field last_updated, jadi kita tidak perlu memperbaruinya
    
    // Log event verifikasi
    msg!("Certificate with ID {} has been verified", certificate_id);
    
    Ok(())  
}

#[derive(Accounts)]
#[instruction(certificate_id: u64)]
pub struct VerifyNFTCtx<'info> {
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
        constraint = cert_nft.certificate_id == certificate_id 
    )]
    pub cert_nft: Account<'info, CertificateNFT>,
    
    // Pihak yang memverifikasi - bisa creator atau admin platform
    #[account(mut)]
    pub verifier: Signer<'info>,
    
    // System program
    pub system_program: Program<'info, System>,
}