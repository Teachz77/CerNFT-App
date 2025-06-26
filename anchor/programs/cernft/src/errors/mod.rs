use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("The program has already initialized")]
    AlreadyInitialized,

    #[msg("Maximum character is 64")]
    TitleTooLong,

    #[msg("Maximum character is 512")]
    DescTooLong,

    #[msg("Maximum character is 64")]
    IssuerNameTooLong,

    #[msg("Maximum character is 64")]
    RecipientNameTooLong,

    #[msg("Required field cannot be empty")]
    EmptyRequiredField,
    
    #[msg("Invalid IPFS URI format")]
    InvalidIpfsUri,

    #[msg("Invalid certificate ID")]
    InvalidCertificateId,

    #[msg("Certificate already verified")]
    AlreadyVerified,

    #[msg("Unauthorized verifier")]
    UnauthorizedVerifier,

    #[msg("Unauthorized updater")]
    UnauthorizedUpdater,

    #[msg("Certificate is inactive")]
    InactiveCertificate,

    #[msg("Signer is not the certificate owner")]
    NotCertificateOwner,

    #[msg("New owner is the same as current owner")]
    SameOwner,

    #[msg("Certificate has not been verified")]
    CertificateNotVerified,
    
    #[msg("Invalid platform account")]
    InvalidPlatformAccount,

    #[msg("Numerical overflow occurred")]
    NumericalOverflow,

    #[msg("Invalid Platform Fee")]
    InvalidPlatformFee,
}