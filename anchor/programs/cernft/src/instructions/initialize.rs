use anchor_lang::prelude::*;

use crate::constants::ANCHOR_DISCRIMINATOR_SIZE;
use crate::states::ProgramState;
use crate::errors::ErrorCode::AlreadyInitialized;

pub fn initialize(ctx: Context<InitializeCtx>) -> Result<()> {
    let state = &mut ctx.accounts.program_state;
    let owner = &ctx.accounts.owner;

    if state.initialized{
        return Err(AlreadyInitialized.into());
    }

    state.certificate_count = 0;
    state.platform_fee = 5;
    state.platform_address = owner.key();
    state.initialized = true;
    Ok(())
}

#[derive(Accounts)]
pub struct InitializeCtx<'info> {
    #[account(
        init,
        payer = owner,
        space = ANCHOR_DISCRIMINATOR_SIZE + ProgramState::INIT_SPACE,
        seeds = [b"program_state"],
        bump
    )]
    pub program_state: Account<'info, ProgramState>,

    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>
}