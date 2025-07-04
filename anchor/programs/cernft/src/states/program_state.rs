use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct ProgramState {
    pub initialized: bool,
    pub certificate_count: u64,
    pub platform_fee: u64,
    pub platform_address: Pubkey,
}