import { AnchorProvider, BN, Program, Wallet } from '@coral-xyz/anchor'
import { Connection, PublicKey, TransactionSignature, SystemProgram, LAMPORTS_PER_SOL, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'
import { Cernft } from '../../anchor/target/types/cernft'
import idl from '../../anchor/target/idl/cernft.json'


// Interfaces
export interface CreateNFTParams {
  program: Program<Cernft>
  publicKey: PublicKey
  title: string
  description: string
  ipfsUri: string
  issuerName: string
  recipientName: string
}

export interface NFTCreationResult {
  transactionSignature: string
  certificateId: number
  nftAddress: string
}

export interface BlockchainNFT {
  certificateId: number
  title: string
  description: string
  issuerName: string
  recipientName: string
  issueDate: number
  owner: string
  creator: string
  statusVerify: boolean
  transferCount: number
  isActive: boolean
  ipfsUri: string
}

export interface ProgramStateInfo {
  initialized: boolean
  certificateCount: number
  platformFee: number
  platformAddress: string
}

export interface CertificateVerificationResult {
  exists: boolean
  isActive: boolean
  isVerified: boolean
  owner: string
  creator: string
  transferCount: number
  issueDate: number
  title: string
  description: string
  issuerName: string
  recipientName: string
  ipfsUri: string
}

export interface FileHashVerificationResult {
  certificateExists: boolean
  fileHashMatches: boolean
  originalHash?: string
  uploadedHash: string
  message: string
}

// Transfer NFT Interfaces
export interface TransferNFTParams {
  program: Program<Cernft>
  publicKey: PublicKey
  certificateId: number
  newOwner: PublicKey
}

export interface TransferNFTResult {
  transactionSignature: string
  certificateId: number
  previousOwner: string
  newOwner: string
  platformFee: number
  gasUsed: number
  transferCount: number
}

export const getClusterURL = (cluster: string): string => {
  const clusterUrls: Record<string, string> = {
    'mainnet-beta': 'https://api.mainnet-beta.solana.com',
    'testnet': 'https://api.testnet.solana.com',
    'devnet': 'https://api.devnet.solana.com',
    'localhost': 'http://127.0.0.1:8899',
  }

  return clusterUrls[cluster] || clusterUrls['devnet']
}

const CLUSTER: string = import.meta.env.VITE_PUBLIC_CLUSTER || 'devnet'
const RPC_URL: string = getClusterURL(CLUSTER)

export const getProvider = (
  publicKey: PublicKey | null,
  signTransaction: any,
  sendTransaction: any
): Program<Cernft> | null => {
  if (!publicKey || !signTransaction) {
    console.error('Wallet not connected or missing signTransaction')
    return null
  }

  const connection = new Connection(RPC_URL, 'confirmed')
  const provider = new AnchorProvider(
    connection,
    { publicKey, signTransaction, sendTransaction } as unknown as Wallet,
    { commitment: 'processed' }
  )

  return new Program<Cernft>(idl as any, provider)
}

export const getProviderReadonly = (): Program<Cernft> => {
  const connection = new Connection(RPC_URL, 'confirmed')

  const wallet = {
    publicKey: PublicKey.default,
    signTransaction: async () => {
      throw new Error('Read-only provider cannot sign transactions.')
    },
    signAllTransactions: async () => {
      throw new Error('Read-only provider cannot sign transactions.')
    },
  }

  const provider = new AnchorProvider(
    connection,
    wallet as unknown as Wallet,
    { commitment: 'processed' }
  )

  return new Program<Cernft>(idl as any, provider)
}

// Helper Functions
export const checkWalletBalance = async (
  publicKey: PublicKey
): Promise<{ balance: number; hasEnoughSOL: boolean; requiredSOL: number }> => {
  try {
    const connection = new Connection(RPC_URL, 'confirmed')
    const balance = await connection.getBalance(publicKey)
    const balanceInSOL = balance / LAMPORTS_PER_SOL
    const requiredSOL = 0.01 // Estimate for transaction fees
    
    return {
      balance: balanceInSOL,
      hasEnoughSOL: balanceInSOL >= requiredSOL,
      requiredSOL
    }
  } catch (error) {
    console.error('Error checking wallet balance:', error)
    return {
      balance: 0,
      hasEnoughSOL: false,
      requiredSOL: 0.01
    }
  }
}

export const requestAirdrop = async (publicKey: PublicKey): Promise<boolean> => {
  try {
    if (CLUSTER !== 'devnet') {
      throw new Error('Airdrop only available on devnet')
    }

    const connection = new Connection(RPC_URL, 'confirmed')
    const airdropSignature = await connection.requestAirdrop(
      publicKey,
      2 * LAMPORTS_PER_SOL // Request 2 SOL
    )
    
    await connection.confirmTransaction(airdropSignature, 'finalized')
    console.log('Airdrop successful:', airdropSignature)
    return true
  } catch (error) {
    console.error('Airdrop failed:', error)
    return false
  }
}

// Program State Functions
export const isProgramInitialized = async (program: Program<Cernft>): Promise<boolean> => {
  try {
    const [programStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('program_state')],
      program.programId
    )
    
    const state = await program.account.programState.fetch(programStatePda)
    return state.initialized
  } catch (error) {
    console.log('Program not initialized:', error)
    return false
  }
}

export const getFreshProgramState = async (program: Program<Cernft>): Promise<ProgramStateInfo> => {
  const [programStatePda] = PublicKey.findProgramAddressSync(
    [Buffer.from('program_state')],
    program.programId
  )
  
  // Force fresh fetch from blockchain
  const connection = program.provider.connection
  await connection.getRecentBlockhash() // Force connection refresh
  
  const state = await program.account.programState.fetch(programStatePda)
  
  return {
    initialized: state.initialized,
    certificateCount: state.certificateCount.toNumber(),
    platformFee: state.platformFee.toNumber(),
    platformAddress: state.platformAddress.toString()
  }
}

export const initializeProgram = async (
  program: Program<Cernft>,
  publicKey: PublicKey
): Promise<TransactionSignature> => {
  try {
    // Check balance before initialization
    const balanceInfo = await checkWalletBalance(publicKey)
    if (!balanceInfo.hasEnoughSOL && CLUSTER === 'devnet') {
      console.log('Requesting airdrop for program initialization...')
      await requestAirdrop(publicKey)
    }

    const [programStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('program_state')],
      program.programId
    )

    const tx = await program.methods
      .initialize()
      .accountsPartial({
        programState: programStatePda,
        owner: publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc()

    const connection = new Connection(
      program.provider.connection.rpcEndpoint,
      'confirmed'
    )
    await connection.confirmTransaction(tx, 'finalized')
    
    return tx
  } catch (error) {
    console.error('Error initializing program:', error)
    throw error
  }
}

// NFT Fetching Functions
export const fetchActiveNFTs = async (
  program: Program<Cernft>,
  ownerPublicKey?: PublicKey
): Promise<BlockchainNFT[]> => {
  try {
    console.log('🔍 Fetching active NFTs from blockchain...')
    
    // Check if program is initialized first
    const programInitialized = await isProgramInitialized(program)
    if (!programInitialized) {
      console.log('⚠️ Program not initialized')
      return []
    }
    
    // Get program state untuk mengetahui total certificates
    const state = await getFreshProgramState(program)
    const totalCertificates = state.certificateCount
    
    console.log(`📊 Total certificates in program state: ${totalCertificates}`)
    
    if (totalCertificates === 0) {
      console.log('📭 No certificates found in program state')
      return []
    }
    
    const activeNFTs: BlockchainNFT[] = []
    
    // Loop through all possible certificate IDs
    for (let i = 1; i <= totalCertificates; i++) {
      try {
        // Generate PDA untuk certificate ID ini
        const [certNftPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('certificate_nft'), new BN(i).toArrayLike(Buffer, 'le', 8)],
          program.programId
        )
        
        // Fetch NFT data
        const nftData = await program.account.certificateNft.fetch(certNftPda)
        
        // Jika ownerPublicKey diberikan, filter berdasarkan owner
        if (ownerPublicKey && nftData.owner.toString() !== ownerPublicKey.toString()) {
          continue
        }
        
        // Hanya ambil NFT yang aktif
        if (!nftData.isActive) {
          console.log(`⚠️ Certificate #${i} is inactive, skipping`)
          continue
        }
        
        const blockchainNFT: BlockchainNFT = {
          certificateId: i,
          title: nftData.title,
          description: nftData.description,
          issuerName: nftData.issuerName,
          recipientName: nftData.recipientName,
          issueDate: nftData.issueDate,
          owner: nftData.owner.toString(),
          creator: nftData.creator.toString(),
          statusVerify: nftData.statusVerify,
          transferCount: nftData.transferCount,
          isActive: nftData.isActive,
          ipfsUri: nftData.ipfsUri
        }
        
        activeNFTs.push(blockchainNFT)
        console.log(`✅ Found active NFT #${i}: "${nftData.title}" (Owner: ${nftData.owner.toString().slice(0, 8)}...)`)
        
      } catch (error) {
        // NFT dengan ID ini tidak ada atau error, skip
        console.log(`❌ Certificate #${i} not found or error: ${error}`)
        continue
      }
    }
    
    console.log(`🎯 Found ${activeNFTs.length} active NFTs total`)
    return activeNFTs
    
  } catch (error) {
    console.error('💥 Error fetching active NFTs:', error)
    throw new Error(`Failed to fetch NFTs from blockchain: ${error}`)
  }
}

export const fetchUserNFTs = async (
  program: Program<Cernft>,
  userPublicKey: PublicKey
): Promise<BlockchainNFT[]> => {
  console.log(`👤 Fetching NFTs for user: ${userPublicKey.toString().slice(0, 8)}...`)
  return fetchActiveNFTs(program, userPublicKey)
}

export const fetchSingleNFT = async (
  program: Program<Cernft>,
  certificateId: number
): Promise<BlockchainNFT | null> => {
  try {
    const [certNftPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('certificate_nft'), new BN(certificateId).toArrayLike(Buffer, 'le', 8)],
      program.programId
    )
    
    const nftData = await program.account.certificateNft.fetch(certNftPda)
    
    return {
      certificateId,
      title: nftData.title,
      description: nftData.description,
      issuerName: nftData.issuerName,
      recipientName: nftData.recipientName,
      issueDate: nftData.issueDate,
      owner: nftData.owner.toString(),
      creator: nftData.creator.toString(),
      statusVerify: nftData.statusVerify,
      transferCount: nftData.transferCount,
      isActive: nftData.isActive,
      ipfsUri: nftData.ipfsUri
    }
  } catch (error) {
    console.log(`NFT #${certificateId} not found:`, error)
    return null
  }
}

// NFT Creation Function
export const createNft = async (
  params: CreateNFTParams
): Promise<NFTCreationResult> => {
  const { program, publicKey, title, description, ipfsUri, issuerName, recipientName } = params

  try {
    // Check wallet balance first
    console.log('💰 Checking wallet balance...')
    const balanceInfo = await checkWalletBalance(publicKey)
    console.log(`💰 Wallet balance: ${balanceInfo.balance} SOL`)
    
    if (!balanceInfo.hasEnoughSOL) {
      if (CLUSTER === 'devnet') {
        console.log('💸 Insufficient balance. Requesting airdrop...')
        const airdropSuccess = await requestAirdrop(publicKey)
        if (!airdropSuccess) {
          throw new Error(
            `Insufficient SOL balance: ${balanceInfo.balance} SOL. Required: ${balanceInfo.requiredSOL} SOL. ` +
            `Please visit https://faucet.solana.com/ to get devnet SOL.`
          )
        }
        console.log('✅ Airdrop completed. Proceeding with transaction...')
      } else {
        throw new Error(
          `Insufficient SOL balance: ${balanceInfo.balance} SOL. Required: ${balanceInfo.requiredSOL} SOL. ` +
          `Please add SOL to your wallet.`
        )
      }
    }

    // Validate IPFS URI format before sending to blockchain
    if (!ipfsUri.startsWith('ipfs://') && !ipfsUri.startsWith('https://ipfs.io/ipfs/')) {
      console.error('❌ Invalid IPFS URI format:', ipfsUri)
      throw new Error('IPFS URI must start with "ipfs://" or "https://ipfs.io/ipfs/"')
    }

    console.log('✅ IPFS URI format validated:', ipfsUri)

    // Get program state PDA
    const [programStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('program_state')],
      program.programId
    )

    console.log('🏛️ Program State PDA:', programStatePda.toString())

    // Fetch current state to get next certificate ID (with forced refresh)
    let state
    try {
      // Force fresh fetch by getting recent blockhash first
      await program.provider.connection.getRecentBlockhash('finalized')
      
      state = await program.account.programState.fetch(programStatePda)
      console.log('📊 Current certificate count:', state.certificateCount.toString())
      
      // Double-check by refetching if count seems wrong
      if (state.certificateCount.toNumber() === 0) {
        console.log('🔄 Certificate count is 0, checking if this is correct...')
        
        // Small delay and refetch
        await new Promise(resolve => setTimeout(resolve, 1000))
        state = await program.account.programState.fetch(programStatePda)
        console.log('🔄 Refetched certificate count:', state.certificateCount.toString())
      }
      
    } catch (error) {
      console.error('❌ Error fetching program state. Program may need to be initialized.')
      throw new Error('Program state not found. Please ensure the program is initialized.')
    }

    // Calculate next certificate ID
    const certificateId = state.certificateCount.add(new BN(1))
    console.log('🆔 Next certificate ID:', certificateId.toString())

    // Generate certificate NFT PDA
    const [certNftPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('certificate_nft'), certificateId.toArrayLike(Buffer, 'le', 8)],
      program.programId
    )

    console.log('🎫 Certificate NFT PDA:', certNftPda.toString())

    // Check if the NFT account already exists
    try {
      const existingNft = await program.account.certificateNft.fetch(certNftPda)
      console.log('⚠️ NFT already exists:', existingNft)
      
      // If NFT exists, we need to use a different approach
      // This might happen if a previous transaction partially succeeded
      throw new Error(
        `Certificate with ID ${certificateId.toString()} already exists. ` +
        'This might be due to a previous transaction that partially completed. ' +
        'Please refresh the page and try again.'
      )
    } catch (fetchError) {
      // If fetch fails, the account doesn't exist (which is what we want)
      console.log('✅ NFT account does not exist yet. Proceeding with creation...')
    }

    // Check program state is mutable
    try {
      const programStateAccount = await program.provider.connection.getAccountInfo(programStatePda)
      if (!programStateAccount) {
        throw new Error('Program state account not found')
      }
      console.log('✅ Program state account confirmed')
    } catch (error) {
      console.error('❌ Program state validation failed:', error)
      throw new Error('Program state is not properly initialized')
    }

    // Execute the transaction with retry logic
    console.log('🚀 Executing create NFT transaction...')
    
    let retryCount = 0
    const maxRetries = 3
    
    while (retryCount < maxRetries) {
      try {
        const tx = await program.methods
          .createNft(title, description, ipfsUri, issuerName, recipientName)
          .accountsPartial({
            programState: programStatePda,
            certNft: certNftPda,
            creator: publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc({
            skipPreflight: false,
            preflightCommitment: 'processed',
            commitment: 'processed'
          })

        console.log('📤 Transaction sent:', tx)

        // Wait for confirmation
        const connection = new Connection(
          program.provider.connection.rpcEndpoint,
          'confirmed'
        )
        
        console.log('⏳ Waiting for transaction confirmation...')
        const confirmation = await connection.confirmTransaction(tx, 'finalized')
        
        if (confirmation.value.err) {
          throw new Error(`Transaction failed: ${confirmation.value.err}`)
        }
        
        console.log('✅ Transaction confirmed!')

        // Verify the NFT was created successfully
        try {
          const createdNft = await program.account.certificateNft.fetch(certNftPda)
          console.log('✅ NFT creation verified:', {
            id: createdNft.certificateId.toString(),
            title: createdNft.title,
            owner: createdNft.owner.toString().slice(0, 8) + '...'
          })
        } catch (verifyError) {
          console.warn('⚠️ Could not verify NFT creation, but transaction succeeded')
        }

        return {
          transactionSignature: tx,
          certificateId: certificateId.toNumber(),
          nftAddress: certNftPda.toString()
        }
        
      } catch (txError) {
        retryCount++
        console.log(`❌ Transaction attempt ${retryCount} failed:`, txError)
        
        if (retryCount >= maxRetries) {
          throw txError
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount))
      }
    }

    throw new Error('Transaction failed after maximum retries')

  } catch (error) {
    console.error('💥 Error creating NFT:', error)
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('already in use') || error.message.includes('already exists')) {
        throw new Error(
          'This certificate ID is already in use. This might happen if a previous transaction partially succeeded. ' +
          'Please refresh the page and try creating the NFT again.'
        )
      } else if (error.message.includes('Attempt to debit an account but found no record of a prior credit')) {
        throw new Error(
          'Insufficient SOL balance for transaction fees. ' +
          (CLUSTER === 'devnet' 
            ? 'Please visit https://faucet.solana.com/ to get free devnet SOL.' 
            : 'Please add SOL to your wallet.')
        )
      } else if (error.message.includes('0x1')) {
        throw new Error('Insufficient funds for transaction fees')
      } else if (error.message.includes('0x0') && error.message.includes('already in use')) {
        throw new Error(
          'Account collision detected. Please refresh the page and try again. ' +
          'If the problem persists, there might be an issue with the program state.'
        )
      } else if (error.message.includes('User rejected')) {
        throw new Error('Transaction was rejected by user')
      } else if (error.message.includes('blockhash not found')) {
        throw new Error('Network congestion. Please try again in a moment.')
      }
    }
    
    throw error
  }
}

export const verifyCertificateById = async (
  certificateId: number
): Promise<CertificateVerificationResult | null> => {
  try {
    console.log(`🔍 Verifying certificate ID: ${certificateId}`)
    
    const program = getProviderReadonly()
    
    // Check if program is initialized
    const programInitialized = await isProgramInitialized(program)
    if (!programInitialized) {
      throw new Error('Program not initialized on blockchain')
    }

    // Generate PDA for this certificate ID
    const [certNftPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('certificate_nft'), new BN(certificateId).toArrayLike(Buffer, 'le', 8)],
      program.programId
    )

    // Fetch certificate data
    const certificateData = await program.account.certificateNft.fetch(certNftPda)
    
    const result: CertificateVerificationResult = {
      exists: true,
      isActive: certificateData.isActive,
      isVerified: certificateData.statusVerify,
      owner: certificateData.owner.toString(),
      creator: certificateData.creator.toString(),
      transferCount: certificateData.transferCount,
      issueDate: certificateData.issueDate,
      title: certificateData.title,
      description: certificateData.description,
      issuerName: certificateData.issuerName,
      recipientName: certificateData.recipientName,
      ipfsUri: certificateData.ipfsUri
    }

    console.log('✅ Certificate verification successful:', result)
    return result

  } catch (error) {
    console.log(`❌ Certificate ${certificateId} not found or error:`, error)
    return null
  }
}

export const verifyCertificateByFileHash = async (
  fileHash: string
): Promise<CertificateVerificationResult[]> => {
  try {
    console.log(`🔍 Searching certificates by file hash: ${fileHash.slice(0, 16)}...`)
    
    const program = getProviderReadonly()
    
    // Check if program is initialized
    const programInitialized = await isProgramInitialized(program)
    if (!programInitialized) {
      throw new Error('Program not initialized on blockchain')
    }

    // Get total certificate count
    const state = await getFreshProgramState(program)
    const totalCertificates = state.certificateCount
    
    console.log(`📊 Searching through ${totalCertificates} certificates...`)
    
    const matchingCertificates: CertificateVerificationResult[] = []
    
    // Search through all certificates
    for (let i = 1; i <= totalCertificates; i++) {
      try {
        const [certNftPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('certificate_nft'), new BN(i).toArrayLike(Buffer, 'le', 8)],
          program.programId
        )
        
        const certificateData = await program.account.certificateNft.fetch(certNftPda)
        
        // For file hash comparison, we would need to fetch metadata from IPFS
        // and compare the stored file hash. This is a complex operation that
        // requires fetching metadata for each certificate.
        
        // For now, we'll implement a simplified version
        console.log(`🔍 Checking certificate ${i}...`)
        
        // TODO: Implement actual file hash comparison with IPFS metadata
        // This would involve:
        // 1. Fetch metadata from IPFS using certificateData.ipfsUri
        // 2. Extract file hash from metadata attributes
        // 3. Compare with provided fileHash
        
      } catch (error) {
        // Certificate doesn't exist, continue
        continue
      }
    }
    
    console.log(`🎯 Found ${matchingCertificates.length} matching certificates`)
    return matchingCertificates
    
  } catch (error) {
    console.error('💥 Error searching certificates by file hash:', error)
    throw error
  }
}

export const verifyFileHashAgainstCertificate = async (
  certificateId: number,
  fileHash: string
): Promise<FileHashVerificationResult> => {
  try {
    console.log(`🔍 Verifying file hash against certificate ${certificateId}`)
    
    // First verify the certificate exists
    const certificateResult = await verifyCertificateById(certificateId)
    
    if (!certificateResult) {
      return {
        certificateExists: false,
        fileHashMatches: false,
        uploadedHash: fileHash,
        message: 'Certificate not found on blockchain'
      }
    }

    // Fetch metadata from IPFS to get original file hash
    try {
      const ipfsHash = certificateResult.ipfsUri.replace('ipfs://', '')
      const metadataUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`
      
      console.log('🔍 Fetching metadata from IPFS:', metadataUrl)
      
      const response = await fetch(metadataUrl)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const metadata = await response.json()
      
      // Look for file hash in metadata attributes
      const hashAttribute = metadata.attributes?.find(
        (attr: any) => attr.trait_type === 'IPFS Hash' || attr.trait_type === 'File Hash'
      )
      
      if (hashAttribute && hashAttribute.value === fileHash) {
        return {
          certificateExists: true,
          fileHashMatches: true,
          originalHash: hashAttribute.value,
          uploadedHash: fileHash,
          message: 'File hash matches perfectly! This is the authentic certificate file.'
        }
      } else if (hashAttribute) {
        return {
          certificateExists: true,
          fileHashMatches: false,
          originalHash: hashAttribute.value,
          uploadedHash: fileHash,
          message: 'File hash does not match. This file may have been modified or is not the original certificate.'
        }
      } else {
        return {
          certificateExists: true,
          fileHashMatches: false,
          uploadedHash: fileHash,
          message: 'Certificate exists but no file hash found in metadata for comparison.'
        }
      }
      
    } catch (metadataError) {
      console.warn('⚠️ Could not fetch or parse metadata:', metadataError)
      return {
        certificateExists: true,
        fileHashMatches: false,
        uploadedHash: fileHash,
        message: 'Certificate exists on blockchain but metadata could not be verified from IPFS.'
      }
    }
    
  } catch (error) {
    console.error('💥 Error verifying file hash against certificate:', error)
    return {
      certificateExists: false,
      fileHashMatches: false,
      uploadedHash: fileHash,
      message: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

export const getCertificatesWithVerificationInfo = async (
  walletAddress: string
): Promise<CertificateVerificationResult[]> => {
  try {
    console.log(`🔍 Getting certificates with verification info for wallet: ${walletAddress.slice(0, 8)}...`)
    
    const program = getProviderReadonly()
    const walletPublicKey = new PublicKey(walletAddress)
    
    // Fetch user NFTs
    const userNFTs = await fetchUserNFTs(program, walletPublicKey)
    
    // Convert to verification result format
    const verificationResults: CertificateVerificationResult[] = userNFTs.map(nft => ({
      exists: true,
      isActive: nft.isActive,
      isVerified: nft.statusVerify,
      owner: nft.owner,
      creator: nft.creator,
      transferCount: nft.transferCount,
      issueDate: nft.issueDate,
      title: nft.title,
      description: nft.description,
      issuerName: nft.issuerName,
      recipientName: nft.recipientName,
      ipfsUri: nft.ipfsUri
    }))
    
    console.log(`✅ Found ${verificationResults.length} certificates for wallet`)
    return verificationResults
    
  } catch (error) {
    console.error('💥 Error getting certificates with verification info:', error)
    throw error
  }
}

export const performComprehensiveVerification = async (
  certificateId: number
): Promise<{
  blockchainVerification: boolean
  ipfsVerification: boolean
  metadataIntegrity: boolean
  ownershipVerification: boolean
  issuerVerification: boolean
  details: CertificateVerificationResult | null
  issues: string[]
}> => {
  const issues: string[] = []
  let blockchainVerification = false
  let ipfsVerification = false
  let metadataIntegrity = false
  let ownershipVerification = false
  let issuerVerification = false
  let details: CertificateVerificationResult | null = null
  
  try {
    console.log(`🔍 Performing comprehensive verification for certificate ${certificateId}`)
    
    // 1. Blockchain verification
    details = await verifyCertificateById(certificateId)
    if (details) {
      blockchainVerification = true
      console.log('✅ Blockchain verification passed')
      
      // 2. Check if certificate is active
      if (!details.isActive) {
        issues.push('Certificate is marked as inactive')
      }
      
      // 3. IPFS verification
      try {
        const ipfsHash = details.ipfsUri.replace('ipfs://', '')
        const metadataUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`
        
        const response = await fetch(metadataUrl)
        if (response.ok) {
          ipfsVerification = true
          console.log('✅ IPFS verification passed')
          
          // 4. Metadata integrity check
          try {
            const metadata = await response.json()
            if (metadata.name && metadata.description && metadata.attributes) {
              metadataIntegrity = true
              console.log('✅ Metadata integrity check passed')
              
              // Check if metadata matches blockchain data
              if (metadata.name !== details.title) {
                issues.push('Metadata title does not match blockchain data')
              }
              if (metadata.description !== details.description) {
                issues.push('Metadata description does not match blockchain data')
              }
            } else {
              issues.push('Metadata structure is incomplete or invalid')
            }
          } catch (metadataError) {
            issues.push('Metadata is corrupted or not valid JSON')
          }
        } else {
          issues.push('IPFS metadata is not accessible')
        }
      } catch (ipfsError) {
        issues.push('Failed to access IPFS storage')
      }
      
      // 5. Ownership verification (check if owner exists and is valid)
      try {
        new PublicKey(details.owner)
        ownershipVerification = true
        console.log('✅ Ownership verification passed')
      } catch (ownerError) {
        issues.push('Owner address is not a valid Solana public key')
      }
      
      // 6. Issuer verification (check if creator exists and is valid)
      try {
        new PublicKey(details.creator)
        issuerVerification = true
        console.log('✅ Issuer verification passed')
      } catch (issuerError) {
        issues.push('Issuer/Creator address is not a valid Solana public key')
      }
      
    } else {
      issues.push('Certificate does not exist on blockchain')
    }
    
    console.log(`🔍 Comprehensive verification complete. Issues found: ${issues.length}`)
    
    return {
      blockchainVerification,
      ipfsVerification,
      metadataIntegrity,
      ownershipVerification,
      issuerVerification,
      details,
      issues
    }
    
  } catch (error) {
    console.error('💥 Error in comprehensive verification:', error)
    issues.push(`Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    
    return {
      blockchainVerification,
      ipfsVerification,
      metadataIntegrity,
      ownershipVerification,
      issuerVerification,
      details,
      issues
    }
  }
}

export const batchVerifyCertificates = async (
  certificateIds: number[]
): Promise<Map<number, CertificateVerificationResult | null>> => {
  console.log(`🔍 Batch verifying ${certificateIds.length} certificates`)
  
  const results = new Map<number, CertificateVerificationResult | null>()
  
  // Use Promise.allSettled to handle failures gracefully
  const verificationPromises = certificateIds.map(async (id) => {
    try {
      const result = await verifyCertificateById(id)
      return { id, result }
    } catch (error) {
      console.warn(`⚠️ Failed to verify certificate ${id}:`, error)
      return { id, result: null }
    }
  })
  
  const settledResults = await Promise.allSettled(verificationPromises)
  
  settledResults.forEach((settledResult) => {
    if (settledResult.status === 'fulfilled') {
      const { id, result } = settledResult.value
      results.set(id, result)
    }
  })
  
  console.log(`✅ Batch verification complete. ${results.size} results processed`)
  return results
}

export const searchCertificatesByIssuer = async (
  issuerName: string
): Promise<CertificateVerificationResult[]> => {
  try {
    console.log(`🔍 Searching certificates by issuer: ${issuerName}`)
    
    const program = getProviderReadonly()
    
    // Check if program is initialized
    const programInitialized = await isProgramInitialized(program)
    if (!programInitialized) {
      throw new Error('Program not initialized on blockchain')
    }

    // Get total certificate count
    const state = await getFreshProgramState(program)
    const totalCertificates = state.certificateCount
    
    console.log(`📊 Searching through ${totalCertificates} certificates for issuer: ${issuerName}`)
    
    const matchingCertificates: CertificateVerificationResult[] = []
    
    // Search through all certificates
    for (let i = 1; i <= totalCertificates; i++) {
      try {
        const [certNftPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('certificate_nft'), new BN(i).toArrayLike(Buffer, 'le', 8)],
          program.programId
        )
        
        const certificateData = await program.account.certificateNft.fetch(certNftPda)
        
        // Check if issuer name matches (case-insensitive)
        if (certificateData.issuerName.toLowerCase().includes(issuerName.toLowerCase())) {
          const result: CertificateVerificationResult = {
            exists: true,
            isActive: certificateData.isActive,
            isVerified: certificateData.statusVerify,
            owner: certificateData.owner.toString(),
            creator: certificateData.creator.toString(),
            transferCount: certificateData.transferCount,
            issueDate: certificateData.issueDate,
            title: certificateData.title,
            description: certificateData.description,
            issuerName: certificateData.issuerName,
            recipientName: certificateData.recipientName,
            ipfsUri: certificateData.ipfsUri
          }
          
          matchingCertificates.push(result)
        }
        
      } catch (error) {
        // Certificate doesn't exist, continue
        continue
      }
    }
    
    console.log(`🎯 Found ${matchingCertificates.length} certificates from issuer: ${issuerName}`)
    return matchingCertificates
    
  } catch (error) {
    console.error('💥 Error searching certificates by issuer:', error)
    throw error
  }
}

export const getWalletVerificationStats = async (
  walletAddress: string
): Promise<{
  totalCertificates: number
  verifiedCertificates: number
  activeCertificates: number
  totalTransfers: number
  uniqueIssuers: number
  oldestCertificate?: Date
  newestCertificate?: Date
}> => {
  try {
    console.log(`📊 Getting verification stats for wallet: ${walletAddress.slice(0, 8)}...`)
    
    const certificates = await getCertificatesWithVerificationInfo(walletAddress)
    
    const stats = {
      totalCertificates: certificates.length,
      verifiedCertificates: certificates.filter(cert => cert.isVerified).length,
      activeCertificates: certificates.filter(cert => cert.isActive).length,
      totalTransfers: certificates.reduce((sum, cert) => sum + cert.transferCount, 0),
      uniqueIssuers: new Set(certificates.map(cert => cert.issuerName)).size,
      oldestCertificate: certificates.length > 0 
        ? new Date(Math.min(...certificates.map(cert => cert.issueDate * 1000)))
        : undefined,
      newestCertificate: certificates.length > 0 
        ? new Date(Math.max(...certificates.map(cert => cert.issueDate * 1000)))
        : undefined
    }
    
    console.log(`📊 Wallet verification stats:`, stats)
    return stats
    
  } catch (error) {
    console.error('💥 Error getting wallet verification stats:', error)
    throw error
  }
}

export const validateCertificateOwnershipChain = async (
  certificateId: number
): Promise<{
  isValid: boolean
  currentOwner: string
  originalCreator: string
  transferHistory: Array<{
    transferNumber: number
    timestamp?: number
    // Note: Full transfer history would require additional on-chain storage
  }>
  issues: string[]
}> => {
  try {
    console.log(`🔍 Validating ownership chain for certificate ${certificateId}`)
    
    const certificate = await verifyCertificateById(certificateId)
    const issues: string[] = []
    
    if (!certificate) {
      return {
        isValid: false,
        currentOwner: '',
        originalCreator: '',
        transferHistory: [],
        issues: ['Certificate does not exist']
      }
    }
    
    // Basic validation
    let isValid = true
    
    // Check if current owner is valid
    try {
      new PublicKey(certificate.owner)
    } catch {
      issues.push('Current owner address is invalid')
      isValid = false
    }
    
    // Check if creator is valid
    try {
      new PublicKey(certificate.creator)
    } catch {
      issues.push('Creator address is invalid')
      isValid = false
    }
    
    // Check transfer count consistency
    if (certificate.transferCount < 0) {
      issues.push('Transfer count is negative')
      isValid = false
    }
    
    // Note: For full transfer history, we would need additional on-chain storage
    // Currently, we only have the transfer count
    const transferHistory = Array.from({ length: certificate.transferCount }, (_, index) => ({
      transferNumber: index + 1
      // timestamp would come from transaction records if stored
    }))
    
    console.log(`✅ Ownership chain validation complete. Valid: ${isValid}`)
    
    return {
      isValid,
      currentOwner: certificate.owner,
      originalCreator: certificate.creator,
      transferHistory,
      issues
    }
    
  } catch (error) {
    console.error('💥 Error validating ownership chain:', error)
    return {
      isValid: false,
      currentOwner: '',
      originalCreator: '',
      transferHistory: [],
      issues: [`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
    }
  }
}

export const generateVerificationReport = async (
  certificateId: number
): Promise<{
  certificateId: number
  timestamp: string
  verificationPassed: boolean
  comprehensiveCheck: Awaited<ReturnType<typeof performComprehensiveVerification>>
  ownershipValidation: Awaited<ReturnType<typeof validateCertificateOwnershipChain>>
  summary: string
  recommendations: string[]
}> => {
  try {
    console.log(`📋 Generating verification report for certificate ${certificateId}`)
    
    const [comprehensiveCheck, ownershipValidation] = await Promise.all([
      performComprehensiveVerification(certificateId),
      validateCertificateOwnershipChain(certificateId)
    ])
    
    const verificationPassed = 
      comprehensiveCheck.blockchainVerification &&
      comprehensiveCheck.ipfsVerification &&
      comprehensiveCheck.metadataIntegrity &&
      ownershipValidation.isValid &&
      comprehensiveCheck.issues.length === 0
    
    let summary = ''
    const recommendations: string[] = []
    
    if (verificationPassed) {
      summary = 'Certificate verification passed all checks. This is an authentic, valid certificate.'
    } else {
      summary = 'Certificate verification found issues that need attention.'
      
      // Add specific recommendations based on issues found
      if (!comprehensiveCheck.blockchainVerification) {
        recommendations.push('Certificate could not be verified on the blockchain')
      }
      if (!comprehensiveCheck.ipfsVerification) {
        recommendations.push('Certificate metadata is not accessible on IPFS')
      }
      if (!comprehensiveCheck.metadataIntegrity) {
        recommendations.push('Certificate metadata integrity should be verified')
      }
      if (!ownershipValidation.isValid) {
        recommendations.push('Certificate ownership chain should be investigated')
      }
      
      // Add issue-specific recommendations
      comprehensiveCheck.issues.forEach(issue => {
        recommendations.push(`Address issue: ${issue}`)
      })
      
      ownershipValidation.issues.forEach(issue => {
        recommendations.push(`Resolve ownership issue: ${issue}`)
      })
    }
    
    const report = {
      certificateId,
      timestamp: new Date().toISOString(),
      verificationPassed,
      comprehensiveCheck,
      ownershipValidation,
      summary,
      recommendations
    }
    
    console.log(`📋 Verification report generated. Passed: ${verificationPassed}`)
    return report
    
  } catch (error) {
    console.error('💥 Error generating verification report:', error)
    throw error
  }
}

// Utility Functions
export const checkNFTExists = async (
  program: Program<Cernft>, 
  certificateId: number
): Promise<boolean> => {
  try {
    const [certNftPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('certificate_nft'), new BN(certificateId).toArrayLike(Buffer, 'le', 8)],
      program.programId
    )
    
    await program.account.certificateNft.fetch(certNftPda)
    return true
  } catch (error) {
    return false
  }
}

export const refreshBlockchainState = async (program: Program<Cernft>) => {
  try {
    const connection = program.provider.connection
    
    // Force refresh connection
    await connection.getRecentBlockhash('finalized')
    
    // Small delay to ensure state consistency
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    return true
  } catch (error) {
    console.error('Error refreshing blockchain state:', error)
    return false
  }
}

// Debug Functions (for development)
export const debugProgramState = async (program: Program<Cernft>) => {
  try {
    console.log('🔍 Debug: Checking program state...')
    
    const isInit = await isProgramInitialized(program)
    console.log('🔍 Debug: Program initialized:', isInit)
    
    if (isInit) {
      const state = await getFreshProgramState(program)
      console.log('🔍 Debug: Program state:', state)
    }
    
    return { initialized: isInit }
  } catch (error) {
    console.error('🔍 Debug error:', error)
    return { initialized: false, error: error }
  }
}

// Main Transfer NFT Function
export const transferNFT = async (
  params: TransferNFTParams
): Promise<TransferNFTResult> => {
  const { program, publicKey, certificateId, newOwner } = params

  try {
    console.log(`🔄 Starting NFT transfer for certificate ${certificateId}`)
    console.log(`👤 From: ${publicKey.toString()}`)
    console.log(`👤 To: ${newOwner.toString()}`)
    
    // Step 1: Check wallet balance
    console.log('💰 Checking wallet balance...')
    const balanceInfo = await checkWalletBalance(publicKey)
    console.log(`💰 Current balance: ${balanceInfo.balance} SOL`)
    
    if (!balanceInfo.hasEnoughSOL) {
      if (CLUSTER === 'devnet') {
        console.log('💸 Insufficient balance. Requesting airdrop...')
        const airdropSuccess = await requestAirdrop(publicKey)
        if (!airdropSuccess) {
          throw new Error(
            `Insufficient SOL balance: ${balanceInfo.balance} SOL. ` +
            `Please visit https://faucet.solana.com/ to get devnet SOL.`
          )
        }
        console.log('✅ Airdrop completed.')
      } else {
        throw new Error(
          `Insufficient SOL balance: ${balanceInfo.balance} SOL. ` +
          `Required: ${balanceInfo.requiredSOL} SOL. Please add SOL to your wallet.`
        )
      }
    }

    // Step 2: Get program state PDA
    const [programStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('program_state')],
      program.programId
    )
    console.log('🏛️ Program State PDA:', programStatePda.toString())

    // Step 3: Get program state to check platform fee
    let programState
    try {
      programState = await program.account.programState.fetch(programStatePda)
      console.log('📊 Platform fee:', programState.platformFee.toString(), 'lamports')
      console.log('🏛️ Platform address:', programState.platformAddress.toString())
    } catch (error) {
      console.error('❌ Error fetching program state:', error)
      throw new Error('Program state not found. Please ensure the program is initialized.')
    }

    // Step 4: Generate certificate NFT PDA
    const [certNftPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('certificate_nft'), new BN(certificateId).toArrayLike(Buffer, 'le', 8)],
      program.programId
    )
    console.log('🎫 Certificate NFT PDA:', certNftPda.toString())

    // Step 5: Get current NFT data for validation
    let currentNFT
    try {
      currentNFT = await program.account.certificateNft.fetch(certNftPda)
      console.log('📋 Current NFT data:')
      console.log('  - Owner:', currentNFT.owner.toString())
      console.log('  - Active:', currentNFT.isActive)
      console.log('  - Transfer count:', currentNFT.transferCount)
    } catch (error) {
      console.error('❌ Error fetching NFT data:', error)
      throw new Error(`Certificate ${certificateId} not found on blockchain`)
    }
    
    // Step 6: Validate ownership and status
    if (currentNFT.owner.toString() !== publicKey.toString()) {
      throw new Error(
        `You are not the owner of this NFT. ` +
        `Current owner: ${currentNFT.owner.toString()}, ` +
        `Your address: ${publicKey.toString()}`
      )
    }
    
    if (!currentNFT.isActive) {
      throw new Error('This NFT is not active and cannot be transferred')
    }

    if (newOwner.toString() === publicKey.toString()) {
      throw new Error('Cannot transfer to the same wallet address')
    }

    // Step 7: Generate transaction PDA
    const [transactionPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('transaction'),
        new BN(certificateId).toArrayLike(Buffer, 'le', 8),
        publicKey.toBuffer(),
        Buffer.from([currentNFT.transferCount])
      ],
      program.programId
    )
    console.log('📝 Transaction PDA:', transactionPda.toString())

    // Step 8: Check if transaction PDA already exists (duplicate transfer protection)
    try {
      const existingTransaction = await program.account.transaction.fetch(transactionPda)
      if (existingTransaction) {
        console.warn('⚠️ Transaction record already exists, this might be a duplicate transfer')
      }
    } catch (error) {
      // Transaction doesn't exist yet, which is expected for new transfers
      console.log('✅ New transaction - no existing record found')
    }

    // Step 9: Execute the transfer transaction
    console.log('🚀 Executing transfer transaction...')
    console.log('📋 Transaction accounts:')
    console.log('  - Program State:', programStatePda.toString())
    console.log('  - Certificate NFT:', certNftPda.toString())
    console.log('  - Owner (current):', publicKey.toString())
    console.log('  - Platform Account:', programState.platformAddress.toString())
    console.log('  - Transaction Record:', transactionPda.toString())
    console.log('  - New Owner:', newOwner.toString())

    let retryCount = 0
    const maxRetries = 3
    
    while (retryCount < maxRetries) {
      try {
        const tx = await program.methods
          .transferNft(new BN(certificateId), newOwner)
          .accountsPartial({
            programState: programStatePda,
            certNft: certNftPda,
            owner: publicKey,
            platformAccount: programState.platformAddress,
            transaction: transactionPda,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY
          })
          .rpc({
            skipPreflight: false,
            preflightCommitment: 'processed',
            commitment: 'processed'
          })

        console.log('📤 Transfer transaction sent:', tx)

        // Step 10: Wait for confirmation
        const connection = new Connection(
          program.provider.connection.rpcEndpoint,
          'confirmed'
        )
        
        console.log('⏳ Waiting for transaction confirmation...')
        const confirmation = await connection.confirmTransaction(tx, 'finalized')
        
        if (confirmation.value.err) {
          throw new Error(`Transfer transaction failed: ${confirmation.value.err}`)
        }
        
        console.log('✅ Transfer transaction confirmed!')

        // Step 11: Verify the transfer was successful
        try {
          const updatedNFT = await program.account.certificateNft.fetch(certNftPda)
          console.log('✅ Transfer verification:')
          console.log('  - New owner:', updatedNFT.owner.toString())
          console.log('  - Transfer count:', updatedNFT.transferCount)
          console.log('  - Still active:', updatedNFT.isActive)
          
          if (updatedNFT.owner.toString() !== newOwner.toString()) {
            throw new Error('Transfer verification failed: Owner was not updated correctly')
          }
          
          if (updatedNFT.transferCount !== currentNFT.transferCount + 1) {
            console.warn('⚠️ Transfer count may not have been updated correctly')
          }
          
        } catch (verifyError) {
          console.warn('⚠️ Could not verify transfer immediately, but transaction succeeded:', verifyError)
        }

        // Step 12: Get transaction details for gas calculation
        let gasUsed = 0
        try {
          const txDetails = await connection.getTransaction(tx, {
            commitment: 'confirmed'
          })
          gasUsed = txDetails?.meta?.fee || 0
          console.log('💰 Transaction fee (gas):', gasUsed, 'lamports')
        } catch (gasError) {
          console.warn('⚠️ Could not fetch gas details:', gasError)
        }

        // Step 13: Get transaction record for additional verification
        try {
          const transactionRecord = await program.account.transaction.fetch(transactionPda)
          console.log('📝 Transaction record created:')
          console.log('  - Certificate ID:', transactionRecord.certificateId.toString())
          console.log('  - Previous owner:', transactionRecord.owner.toString())
          console.log('  - Amount (fee):', transactionRecord.amount.toString())
          console.log('  - Credited:', transactionRecord.credited)
        } catch (recordError) {
          console.warn('⚠️ Could not fetch transaction record:', recordError)
        }

        // Return successful result
        return {
          transactionSignature: tx,
          certificateId: certificateId,
          previousOwner: publicKey.toString(),
          newOwner: newOwner.toString(),
          platformFee: programState.platformFee.toNumber(),
          gasUsed: gasUsed,
          transferCount: currentNFT.transferCount + 1
        }
        
      } catch (txError) {
        retryCount++
        console.log(`❌ Transfer attempt ${retryCount} failed:`, txError)
        
        if (retryCount >= maxRetries) {
          throw txError
        }
        
        // Wait before retry with exponential backoff
        const waitTime = 1000 * Math.pow(2, retryCount - 1)
        console.log(`⏳ Waiting ${waitTime}ms before retry...`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
    }

    throw new Error('Transfer failed after maximum retries')

  } catch (error) {
    console.error('💥 Error transferring NFT:', error)
    
    // Provide specific error messages based on common errors
    if (error instanceof Error) {
      if (error.message.includes('NotCertificateOwner') || error.message.includes('ConstraintRaw')) {
        throw new Error('You are not the owner of this certificate')
      } else if (error.message.includes('SameOwner')) {
        throw new Error('Cannot transfer to the same wallet address')
      } else if (error.message.includes('InactiveCertificate')) {
        throw new Error('This certificate is inactive and cannot be transferred')
      } else if (error.message.includes('InvalidCertificateId')) {
        throw new Error('Invalid certificate ID')
      } else if (error.message.includes('NumericalOverflow')) {
        throw new Error('Transfer count overflow - too many transfers')
      } else if (error.message.includes('Insufficient SOL')) {
        throw new Error('Insufficient SOL balance for transaction fees')
      } else if (error.message.includes('User rejected')) {
        throw new Error('Transaction was rejected by user')
      } else if (error.message.includes('blockhash not found')) {
        throw new Error('Network congestion. Please try again in a moment.')
      } else if (error.message.includes('already exists') || error.message.includes('already in use')) {
        throw new Error('Transaction conflict detected. Please wait a moment and try again.')
      }
    }
    
    throw error
  }
}

// Helper function to get transfer history for a certificate
export const getCertificateTransferHistory = async (
  program: Program<Cernft>,
  certificateId: number
): Promise<Array<{
  transferNumber: number
  transactionPda: string
  owner: string
  amount: number
  timestamp: number
  credited: boolean
}>> => {
  try {
    console.log(`🔍 Getting transfer history for certificate ${certificateId}`)
    
    // Get current NFT to know how many transfers have occurred
    const [certNftPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('certificate_nft'), new BN(certificateId).toArrayLike(Buffer, 'le', 8)],
      program.programId
    )
    
    const currentNFT = await program.account.certificateNft.fetch(certNftPda)
    const transferCount = currentNFT.transferCount
    
    console.log(`📊 Certificate has ${transferCount} transfers`)
    
    const transferHistory: { transferNumber: number; transactionPda: string; owner: string; amount: number; timestamp: number; credited: boolean }[] | PromiseLike<{ transferNumber: number; transactionPda: string; owner: string; amount: number; timestamp: number; credited: boolean }[]> = []
    
    // Note: This is a simplified approach
    // In a real implementation, you'd need to store more detailed transfer history
    // or query transaction logs from the blockchain
    
    for (let i = 0; i < transferCount; i++) {
      try {
        // This is a simplified approach - in reality you'd need the actual owner addresses
        // for each transfer to generate the correct PDA
        console.log(`📝 Transfer ${i + 1} - PDA calculation would need historical owner data`)
        
        // For now, we can only get the latest transfer record
        // A more complete implementation would require additional on-chain storage
      } catch (error) {
        console.warn(`⚠️ Could not fetch transfer ${i + 1}:`, error)
      }
    }
    
    return transferHistory
    
  } catch (error) {
    console.error('💥 Error getting transfer history:', error)
    return []
  }
}

// Helper function to validate transfer before execution
export const validateTransferRequest = async (
  program: Program<Cernft>,
  publicKey: PublicKey,
  certificateId: number,
  newOwner: PublicKey
): Promise<{
  isValid: boolean
  issues: string[]
  currentOwner: string
  isActive: boolean
  transferCount: number
  platformFee: number
}> => {
  const issues: string[] = []
  
  try {
    console.log(`🔍 Validating transfer request for certificate ${certificateId}`)
    
    // Check program state
    const [programStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('program_state')],
      program.programId
    )
    
    const programState = await program.account.programState.fetch(programStatePda)
    
    // Check certificate exists and get data
    const [certNftPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('certificate_nft'), new BN(certificateId).toArrayLike(Buffer, 'le', 8)],
      program.programId
    )
    
    const certificateNFT = await program.account.certificateNft.fetch(certNftPda)
    
    // Validation checks
    if (certificateNFT.owner.toString() !== publicKey.toString()) {
      issues.push('You are not the owner of this certificate')
    }
    
    if (!certificateNFT.isActive) {
      issues.push('Certificate is not active')
    }
    
    if (newOwner.toString() === publicKey.toString()) {
      issues.push('Cannot transfer to the same wallet')
    }
    
    // Check if new owner address is valid
    try {
      new PublicKey(newOwner)
    } catch {
      issues.push('Invalid recipient wallet address')
    }
    
    // Check wallet balance
    const balanceInfo = await checkWalletBalance(publicKey)
    if (!balanceInfo.hasEnoughSOL) {
      issues.push(`Insufficient SOL balance. Current: ${balanceInfo.balance} SOL, Required: ${balanceInfo.requiredSOL} SOL`)
    }
    
    return {
      isValid: issues.length === 0,
      issues,
      currentOwner: certificateNFT.owner.toString(),
      isActive: certificateNFT.isActive,
      transferCount: certificateNFT.transferCount,
      platformFee: programState.platformFee.toNumber()
    }
    
  } catch (error) {
    console.error('💥 Error validating transfer request:', error)
    issues.push(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    
    return {
      isValid: false,
      issues,
      currentOwner: '',
      isActive: false,
      transferCount: 0,
      platformFee: 0
    }
  }
}

// Helper function to estimate transfer costs
export const estimateTransferCosts = async (
  program: Program<Cernft>,
  certificateId: number
): Promise<{
  platformFee: number
  estimatedGasFee: number
  totalCost: number
  costInSOL: number
}> => {
  try {
    console.log(`💰 Estimating transfer costs for certificate ${certificateId}`)
    
    // Get platform fee from program state
    const [programStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('program_state')],
      program.programId
    )
    
    const programState = await program.account.programState.fetch(programStatePda)
    const platformFee = programState.platformFee.toNumber()
    
    // Estimate gas fee (this is an approximation)
    // Actual gas fees depend on network congestion and transaction complexity
    const estimatedGasFee = 5000 // ~5000 lamports is typical for simple transactions
    
    const totalCost = platformFee + estimatedGasFee
    const costInSOL = totalCost / LAMPORTS_PER_SOL
    
    console.log(`💰 Cost estimation:`)
    console.log(`  - Platform fee: ${platformFee} lamports`)
    console.log(`  - Estimated gas: ${estimatedGasFee} lamports`)
    console.log(`  - Total cost: ${totalCost} lamports (${costInSOL} SOL)`)
    
    return {
      platformFee,
      estimatedGasFee,
      totalCost,
      costInSOL
    }
    
  } catch (error) {
    console.error('💥 Error estimating transfer costs:', error)
    
    // Return default estimates if we can't get exact values
    return {
      platformFee: 5000, // Default platform fee estimate
      estimatedGasFee: 5000,
      totalCost: 10000,
      costInSOL: 0.00001
    }
  }
}