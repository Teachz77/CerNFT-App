use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Transaction {
    pub certificate_id: u64,
    pub owner: Pubkey,
    pub amount: u64,
    pub timestamp: u64,
    pub credited: bool,
}