use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct CertificateNFT {
    pub certificate_id: u64,
    pub creator: Pubkey,
    #[max_len(64)]
    pub title: String,
    #[max_len(512)]
    pub description: String,
    #[max_len(256)]
    pub ipfs_uri: String,
    #[max_len(64)]
    pub issuer_name: String,
    #[max_len(64)]
    pub recipient_name: String,
    pub issue_date: i64,
    pub owner: Pubkey,
    pub status_verify: bool,  
    pub transfer_count: u8,
    pub is_active: bool,
}






