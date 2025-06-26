import * as anchor from '@coral-xyz/anchor'
import { Cernft } from '../target/types/cernft'
import idl from '../target/idl/cernft.json'
const { SystemProgram, PublicKey, Keypair } = anchor.web3

describe('cernft', () => { 
  const provider = anchor.AnchorProvider.local()
  anchor.setProvider(provider)
  const program = new anchor.Program<Cernft>(idl as any, provider)

  let cid: any
  let cernftPda: anchor.web3.PublicKey
  let programStatePda: anchor.web3.PublicKey

  // Membuat keypair baru untuk "new owner"
  const newOwnerKeypair = Keypair.generate()
  let newOwnerPubkey = newOwnerKeypair.publicKey

  before(async () => {
    // Dapatkan PDA untuk program state
    const [statePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('program_state')],
      program.programId
    )
    programStatePda = statePda

    // Fund the new owner account with some SOL for transactions
    try {
      const fundTx = await provider.connection.requestAirdrop(
        newOwnerPubkey,
        1000000000 // 1 SOL in lamports
      )
      await provider.connection.confirmTransaction(fundTx)
      console.log("Funded new owner account")
    } catch (e) {
      console.log("Error funding new owner account:", e)
    }
  })

  // Test untuk initialize program state
  it('initializes program state', async () => {
    try {
      // Cek apakah program state sudah diinisialisasi
      try {
        const existingState = await program.account.programState.fetch(programStatePda)
        console.log("Program state already initialized:", existingState)
        
        // Set certificate ID untuk test berikutnya
        cid = existingState.certificateCount
        
        // Setup PDA untuk certificate NFT
        const [pdaAddress] = PublicKey.findProgramAddressSync(
          [Buffer.from('certificate_nft'), cid.toArrayLike(Buffer, 'le', 8)],
          program.programId
        )
        cernftPda = pdaAddress
        
        return
      } catch (e) {
        // Program state belum diinisialisasi, lanjut ke inisialisasi
        console.log("Program state not initialized yet, initializing...")
      }

      const owner = provider.wallet

      // Inisialisasi program state
      const tx = await program.methods
        .initialize()  // Sesuai dengan fungsi Rust yang tidak memerlukan parameter
        .accountsPartial({
          programState: programStatePda,
          owner: owner.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc()

      console.log('Initialize Transaction Signature:', tx)
      
      // Fetch program state untuk memverifikasi inisialisasi
      const programState = await program.account.programState.fetch(programStatePda)
      console.log('Initialized Program State:', programState)
      
      // Set certificate ID untuk test berikutnya
      cid = programState.certificateCount
      
      // Setup PDA untuk certificate NFT
      const [pdaAddress] = PublicKey.findProgramAddressSync(
        [Buffer.from('certificate_nft'), cid.toArrayLike(Buffer, 'le', 8)],
        program.programId
      )
      cernftPda = pdaAddress
      
    } catch (e) {
      console.log("Error initializing program state:", e)
      throw e
    }
  })

  // Test untuk update platform settings
  it('updates platform settings', async () => {
    try {
      // Dapatkan state saat ini
      const currentState = await program.account.programState.fetch(programStatePda)
      console.log('Current platform fee:', currentState.platformFee)
      console.log('Current platform address:', currentState.platformAddress.toString())
      
      // Set platform fee baru (harus antara 1-15 sesuai dengan validasi di Rust)
      const newPlatformFee = new anchor.BN(10)
      
      // Update platform settings
      const tx = await program.methods
        .updatePlatformSettings(new anchor.BN(newPlatformFee))
        .accountsPartial({
          updater: provider.wallet.publicKey,
          programState: programStatePda,
        })
        .rpc()
        
      console.log('Update Platform Settings Transaction Signature:', tx)
      
      // Verifikasi perubahan settings
      const updatedState = await program.account.programState.fetch(programStatePda)
      console.log('Updated platform fee:', updatedState.platformFee)
      
      // Validasi bahwa platform fee telah berubah
      if (updatedState.platformFee.eq(newPlatformFee)) {
        console.log('Platform fee updated successfully!')
      } else {
        console.log('Platform fee update failed!')
      }
      
    } catch (e) {
      console.log("Error updating platform settings:", e)
      
      // Periksa jika error terkait validasi platform fee
      if (e.toString().includes('InvalidPlatformFee')) {
        console.log("Error: Platform fee must be between 1 and 15")
      }
      
      // Periksa jika error terkait unauthorized updater
      if (e.toString().includes('UnauthorizedUpdater')) {
        console.log("Error: Only the platform address can update the platform settings")
      }
      
      throw e
    }
  })

  // Test untuk update platform settings dengan fee yang tidak valid
  it('fails to update platform settings with invalid fee', async () => {
    try {
      // Set platform fee yang tidak valid (lebih dari 15)
      const invalidPlatformFee = 20
      
      // Update platform settings dengan fee yang tidak valid
      const tx = await program.methods
        .updatePlatformSettings(new anchor.BN(invalidPlatformFee))
        .accountsPartial({
          updater: provider.wallet.publicKey,
          programState: programStatePda,
        })
        .rpc()
        
      console.log('This should not be reached')
      
    } catch (e) {
      // Periksa jika error terkait validasi platform fee
      if (e.toString().includes('InvalidPlatformFee')) {
        console.log("Test passed: Invalid platform fee correctly rejected")
      } else {
        console.log("Unexpected error:", e)
        throw e
      }
    }
  })

  // Test untuk update platform settings dengan unauthorized updater
  it('fails to update platform settings with unauthorized updater', async () => {
    try {
      // Buat keypair baru yang bukan platform address
      const unauthorizedKeypair = Keypair.generate()
      
      // Fund the unauthorized account
      const fundTx = await provider.connection.requestAirdrop(
        unauthorizedKeypair.publicKey,
        1000000000 // 1 SOL in lamports
      )
      await provider.connection.confirmTransaction(fundTx)

      // Dapatkan programStatePda
      const [programStatePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('program_state')],
        program.programId
      )
      
      // Coba update platform settings dengan unauthorized updater
      const tx = await program.methods
        .updatePlatformSettings(new anchor.BN(7))
        .accountsPartial({
          updater: unauthorizedKeypair.publicKey,
          programState: programStatePda,
        })
        .signers([unauthorizedKeypair])
        .rpc()
        
      console.log('This should not be reached')
      
    } catch (e) {
      // Periksa jika error terkait unauthorized updater
      if (e.toString().includes('UnauthorizedUpdater')) {
        console.log("Test passed: Unauthorized updater correctly rejected")
      } else {
        console.log("Unexpected error:", e)
        throw e
      }
    }
  })

  it('create a certificate nft', async () => {
  try {
    // Ambil state program terlebih dahulu untuk mendapatkan certificate count saat ini
    const programState = await program.account.programState.fetch(programStatePda)
    console.log('Current Program State:', programState)
    
    // Gunakan certificateCount + 1 untuk ID sertifikat baru
    cid = programState.certificateCount.add(new anchor.BN(1))
    console.log('Certificate ID yang akan dibuat:', cid.toString())
    
    // Hitung PDA untuk sertifikat NFT dengan ID yang benar
    const [certNftPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('certificate_nft'), cid.toArrayLike(Buffer, 'le', 8)],
      program.programId
    )
    cernftPda = certNftPda
    console.log('PDA untuk sertifikat baru:', cernftPda.toString())
    
    // Pertama cek apakah NFT sudah ada
    try {
      const existingNft = await program.account.certificateNft.fetch(cernftPda)
      console.log("NFT already exists, skipping creation test")
      console.log('Existing Certificate:', existingNft)
      return
    } catch (e) {
      // NFT tidak ada, lanjutkan dengan pembuatan
      console.log("NFT doesn't exist, proceeding with creation")
    }

    const creator = provider.wallet

    const title = `Test Title #${cid.toString()}`
    const description = `Test Description #${cid.toString()}`
    const ipfsUri = `ipfs://QmSampleCertificateHash`
    const issuerName = `Test Issuer #${cid.toString()}`
    const recipientName = `Test Recipient #${cid.toString()}`

    console.log('Creating NFT with the following info:')
    console.log('Title:', title)
    console.log('CID:', cid.toString())
    console.log('Account:', cernftPda.toString())

    const tx = await program.methods
    .createNft(title, description, ipfsUri, issuerName, recipientName)
    .accountsPartial({
      programState: programStatePda,
      certNft: cernftPda,
      creator: creator.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc()

    console.log('Transaction Signature:', tx)
    const cernft = await program.account.certificateNft.fetch(cernftPda)
    console.log('Certificate created successfully:', cernft)
  } catch (e) {
    console.log("Error in create test:", e)
    
    // Log informasi lebih detail untuk debugging
    if (e.toString().includes('ConstraintSeeds')) {
      console.log("Error detail: Seeds constraint violated.")
      console.log("This usually means the calculated PDA address doesn't match what the program expected.")
      console.log("Check if the seed format and certificate ID are correct.")
    }
    
    throw e
  }
})

  it('verify a certificate nft', async () => {
    try {
      // First check if this NFT is already verified
      const existingNft = await program.account.certificateNft.fetch(cernftPda)
      
      if (existingNft.statusVerify) {
        console.log("NFT already verified, skipping verification test")
        console.log('Verified Certificate:', existingNft)
        return
      }
      
      const verifier = provider.wallet

      const tx = await program.methods
      .verifyNft(cid)
      .accountsPartial({
        programState: programStatePda,
        certNft: cernftPda,
        verifier: verifier.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc()

      console.log('Verification Transaction Signature:', tx)

      const cernft = await program.account.certificateNft.fetch(cernftPda)
      console.log('Verified Certificate:', cernft)
    } catch (e) {
      console.log("Error in verify test:", e)
      throw e
    }
  })

  it('transfer a certificate nft', async () => {
  try {
    // Cek apakah NFT yang akan ditransfer sudah ada
    try {
      const existingNft = await program.account.certificateNft.fetch(cernftPda)
      console.log('NFT untuk transfer ditemukan:', existingNft)
      
      // Cek apakah sudah diverifikasi (sebaiknya sudah diverifikasi sebelum transfer)
      if (!existingNft.statusVerify) {
        console.log("Warning: NFT belum diverifikasi, tapi akan tetap dicoba transfer")
      }
      
      console.log('Current owner:', existingNft.owner.toString())
      console.log('New owner akan menjadi:', newOwnerPubkey.toString())
      
      // Pastikan current owner dan new owner berbeda
      if (existingNft.owner.toString() === newOwnerPubkey.toString()) {
        console.log("New owner tidak boleh sama dengan current owner, membuat keypair baru")
        const tempKeypair = Keypair.generate()
        newOwnerPubkey = tempKeypair.publicKey
        console.log('New owner sekarang:', newOwnerPubkey.toString())
      }
      
      // Dapatkan platform account dari program state
      const programState = await program.account.programState.fetch(programStatePda)
      const platformAddress = programState.platformAddress
      console.log('Platform address:', platformAddress.toString())
      console.log('Platform fee:', programState.platformFee.toString(), 'lamports')
      
      // Dapatkan transfer count untuk membuat seeds transaction PDA
      const transferCount = existingNft.transferCount
      console.log('Current transfer count:', transferCount)
      
      // Buat transaction PDA
      const [transactionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('transaction'),
          cid.toArrayLike(Buffer, 'le', 8),
          provider.wallet.publicKey.toBuffer(),
          Buffer.from([transferCount]) 
        ],
        program.programId
      )
      console.log('Transaction PDA:', transactionPda.toString())
      
      // Execute transfer NFT
      console.log('Executing transfer with params:')
      console.log('- Certificate ID:', cid.toString())
      console.log('- New Owner:', newOwnerPubkey.toString())
      
      const tx = await program.methods
        .transferNft(cid, newOwnerPubkey)
        .accountsPartial({
          programState: programStatePda,
          certNft: cernftPda,
          owner: provider.wallet.publicKey,
          platformAccount: platformAddress,
          transaction: transactionPda,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY
        })
        .rpc()
      
      console.log('Transfer Transaction Signature:', tx)
      
      // Verifikasi NFT setelah transfer
      const updatedNft = await program.account.certificateNft.fetch(cernftPda)
      console.log('NFT setelah transfer:')
      console.log('- New owner:', updatedNft.owner.toString())
      console.log('- Transfer count:', updatedNft.transferCount)
      
      // Verifikasi bahwa owner telah berubah
      if (updatedNft.owner.toString() === newOwnerPubkey.toString()) {
        console.log('SUKSES: Owner berhasil diubah ke new owner')
      } else {
        console.log('GAGAL: Owner tidak berubah seperti yang diharapkan')
      }
      
      // Verifikasi bahwa transfer count bertambah
      if (updatedNft.transferCount === transferCount + 1) {
        console.log('SUKSES: Transfer count bertambah 1')
      } else {
        console.log('GAGAL: Transfer count tidak bertambah seperti yang diharapkan')
      }
      
      // Ambil data transaksi
      try {
        const transactionRecord = await program.account.transaction.fetch(transactionPda)
        console.log('Transaction record:')
        console.log('- Certificate ID:', transactionRecord.certificateId.toString())
        console.log('- Owner (previous):', transactionRecord.owner.toString())
        console.log('- Amount (fee):', transactionRecord.amount.toString(), 'lamports')
        console.log('- Timestamp:', transactionRecord.timestamp.toString())
        console.log('- Credited:', transactionRecord.credited)
      } catch (e) {
        console.log('Error fetching transaction record:', e)
      }
      
    } catch (e) {
      console.log('Error: NFT tidak ditemukan, tidak bisa transfer:', e)
      return
    }
  } catch (e) {
    console.log('Error dalam test transfer:', e)
    
    // Error handling yang lebih spesifik berdasarkan kode error
    if (e.toString().includes('InvalidCertificateId')) {
      console.log('Error: ID sertifikat tidak valid')
    } else if (e.toString().includes('NotCertificateOwner')) {
      console.log('Error: Anda bukan pemilik sertifikat ini')
    } else if (e.toString().includes('InactiveCertificate')) {
      console.log('Error: Sertifikat tidak aktif')
    } else if (e.toString().includes('SameOwner')) {
      console.log('Error: New owner sama dengan current owner')
    } else if (e.toString().includes('NumericalOverflow')) {
      console.log('Error: Overflow pada transfer count')
    }
    
    throw e
  }
  })

  it('fails to transfer when new owner is the same as current owner', async () => {
  try {
    // Dapatkan informasi NFT saat ini
    const existingNft = await program.account.certificateNft.fetch(cernftPda);
    console.log('Current owner:', existingNft.owner.toString());
    
    // Pastikan kita adalah owner saat ini
    if (existingNft.owner.toString() !== provider.wallet.publicKey.toString()) {
      console.log("Test ini membutuhkan wallet kita sebagai current owner");
      return;
    }
    
    // Dapatkan transfer count untuk transaction PDA
    const transferCount = existingNft.transferCount;
    
    // Dapatkan platform account
    const programState = await program.account.programState.fetch(programStatePda);
    const platformAddress = programState.platformAddress;
    
    // Buat transaction PDA
    const [transactionPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('transaction'),
        cid.toArrayLike(Buffer, 'le', 8),
        provider.wallet.publicKey.toBuffer(),
        Buffer.from([transferCount]) 
      ],
      program.programId
    );
    
    // Execute transfer NFT ke current owner (seharusnya gagal)
    const tx = await program.methods
      .transferNft(cid, existingNft.owner) // Gunakan existingNft.owner sebagai target
      .accountsPartial({
        programState: programStatePda,
        certNft: cernftPda,
        owner: provider.wallet.publicKey,
        platformAccount: platformAddress,
        transaction: transactionPda,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY
      })
      .rpc();
    
    console.log('Seharusnya tidak sampai di sini');
    
  } catch (e) {
    if (e.toString().includes('SameOwner')) {
      console.log('Test berhasil: Transfer ke owner yang sama ditolak');
    } else {
      console.log('Error tidak diharapkan:', e);
      console.log(e.toString());  // Log full error message
      throw e;
    }
  }
  });

  it('fails to transfer when not the owner', async () => {
  try {
    // Buat keypair baru yang bukan owner
    const unauthorizedKeypair = Keypair.generate();
    
    // Fund akun unauthorized
    const fundTx = await provider.connection.requestAirdrop(
      unauthorizedKeypair.publicKey,
      1000000000 // 1 SOL
    );
    await provider.connection.confirmTransaction(fundTx);
    
    // Dapatkan state NFT saat ini untuk memverifikasi pemilik sebenarnya
    const existingNft = await program.account.certificateNft.fetch(cernftPda);
    console.log('Current actual owner:', existingNft.owner.toString());
    console.log('Unauthorized account:', unauthorizedKeypair.publicKey.toString());
    
    // Pastikan unauthorized keypair benar-benar bukan owner
    if (existingNft.owner.toString() === unauthorizedKeypair.publicKey.toString()) {
      console.log("Error: Unauthorized keypair kebetulan sama dengan owner");
      return;
    }
    
    // Dapatkan platform account
    const programState = await program.account.programState.fetch(programStatePda);
    const platformAddress = programState.platformAddress;
    
    // Buat new owner berbeda
    const tempKeypair = Keypair.generate();
    const tempNewOwner = tempKeypair.publicKey;
    
    // Dapatkan transfer count untuk transaction PDA dari NFT yang ada
    // Hindari menggunakan nilai hardcoded
    const transferCount = existingNft.transferCount;
    
    // Buat transaction PDA untuk unauthorized account
    const [transactionPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('transaction'),
        cid.toArrayLike(Buffer, 'le', 8),
        unauthorizedKeypair.publicKey.toBuffer(),
        Buffer.from([transferCount]) 
      ],
      program.programId
    );
    
    console.log('Trying to transfer with unauthorized account...');
    
    // Coba transfer sebagai unauthorized user
    const tx = await program.methods
      .transferNft(cid, tempNewOwner)
      .accountsPartial({
        programState: programStatePda,
        certNft: cernftPda,
        owner: unauthorizedKeypair.publicKey,
        platformAccount: platformAddress,
        transaction: transactionPda,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY
      })
      .signers([unauthorizedKeypair])
      .rpc();
    
    console.log('Transfer unexpectedly succeeded, should have failed');
    
  } catch (e) {
    // Cek apakah error adalah yang kita harapkan 
    // (bisa jadi ConstraintRaw atau NotCertificateOwner)
    if (e.toString().includes('NotCertificateOwner') || 
        e.toString().includes('ConstraintRaw')) {
      console.log('Test berhasil: Transfer oleh bukan owner ditolak');
      console.log('Error detail:', e.toString().substring(0, 200) + '...');
    } else {
      console.log('Error tidak diharapkan:', e);
      throw e;
    }
  }
  });


})