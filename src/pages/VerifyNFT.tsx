import React, { useState} from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { 
  getProviderReadonly,
  fetchActiveNFTs, 
  isProgramInitialized,
  BlockchainNFT,
  getFreshProgramState
} from '../services/blockchain'
import { useNFT } from '../context/NFTContext'
import { pinataService } from '../services/pinata'
import './VerifyNFT.css'

interface VerificationResult {
  certificateId: number
  title: string
  issuer: string
  recipient: string
  issueDate: string
  isVerified: boolean
  owner: string
  creator: string
  transferCount: number
  isActive: boolean
  ipfsUri: string
  fileMatches: boolean
  uploadedFileHash: string
  originalFileHash: string
  confidenceLevel: 'PERFECT_MATCH' | 'NO_MATCH' | 'METADATA_ERROR'
  message: string
}

interface VerificationStep {
  step: number
  title: string
  status: 'pending' | 'loading' | 'completed' | 'error'
  message?: string
}

const VerifyNFT: React.FC = () => {
  const { connected } = useWallet()
  
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [verificationSteps, setVerificationSteps] = useState<VerificationStep[]>([])

  const { nftCollection } = useNFT()

  // Helper untuk menghasilkan hash SHA-256 dari file
  const generateFileHash = async (file: File): Promise<string> => {
    try {
      const buffer = await file.arrayBuffer()
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    } catch (error) {
      console.error('Gagal menghasilkan hash file:', error)
      throw new Error('Gagal menghasilkan hash file')
    }
  }

  // Helper untuk mengambil metadata dari IPFS
  const fetchIPFSMetadata = async (ipfsUri: string): Promise<any> => {
    try {
      const ipfsHash = ipfsUri.replace('ipfs://', '')
      const metadataUrl = pinataService.getGatewayUrl(ipfsHash)
      
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 detik timeout
      
      const response = await fetch(metadataUrl, { 
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      return await response.json()
    } catch (error) {
      // Tidak menampilkan error ke pengguna, hanya untuk internal
      return null
    }
  }

  // Mengekstrak hash file dari metadata
  const extractFileHashFromMetadata = (metadata: any): string | null => {
    if (!metadata || !metadata.attributes) {
      return null
    }
    const hashAttributes = metadata.attributes.find((attr: any) => 
      ['IPFS Hash', 'File Hash', 'SHA256', 'FileHash'].includes(attr.trait_type)
    )
    return hashAttributes ? hashAttributes.value : null
  }

  // Memperbarui langkah verifikasi
  const updateStep = (stepNumber: number, status: VerificationStep['status'], message?: string) => {
    setVerificationSteps(prev => prev.map(step => 
      step.step === stepNumber ? { ...step, status, message } : step
    ))
  }

  // Inisialisasi langkah-langkah verifikasi
  const initializeSteps = () => {
    setVerificationSteps([
      { step: 1, title: 'Menghasilkan hash file', status: 'pending' },
      { step: 2, title: 'Memeriksa koneksi blockchain', status: 'pending' },
      { step: 3, title: 'Mengambil semua sertifikat dari blockchain', status: 'pending' },
      { step: 4, title: 'Membandingkan hash file dengan metadata sertifikat', status: 'pending' },
      { step: 5, title: 'Menyelesaikan hasil verifikasi', status: 'pending' }
    ])
  }

  // Fungsi verifikasi utama
  const verifyFileAgainstBlockchain = async (file: File): Promise<VerificationResult | null> => {
  try {
    initializeSteps()

    // Langkah 1: Hasilkan hash file
    updateStep(1, 'loading', 'Menghitung hash SHA-256 dari file yang diunggah...')
    const uploadedFileHash = await generateFileHash(file)
    updateStep(1, 'completed', `Hash file: ${uploadedFileHash.slice(0, 16)}...`)

    // Langkah 2: Cek koleksi lokal terlebih dahulu
    updateStep(2, 'loading', 'Memeriksa koleksi lokal...')
    for (const localNFT of nftCollection) {
      if (localNFT.fileHash && localNFT.fileHash.toLowerCase() === uploadedFileHash.toLowerCase()) {
        updateStep(2, 'completed', `Kecocokan ditemukan di koleksi lokal: #${localNFT.certificateId}`)
        updateStep(3, 'completed', 'Pencarian blockchain dilewati (ditemukan secara lokal)')
        updateStep(4, 'completed', 'Perbandingan hash selesai')
        updateStep(5, 'completed', 'Verifikasi berhasil diselesaikan')
        return {
          certificateId: localNFT.certificateId,
          title: localNFT.title,
          issuer: localNFT.issuer,
          recipient: localNFT.recipient,
          issueDate: localNFT.issueDate,
          isVerified: localNFT.isVerified,
          owner: localNFT.owner,
          creator: localNFT.creator,
          transferCount: localNFT.transferCount,
          isActive: localNFT.isActive,
          ipfsUri: localNFT.ipfsUri,
          fileMatches: true,
          uploadedFileHash,
          originalFileHash: localNFT.fileHash,
          confidenceLevel: 'PERFECT_MATCH',
          message: 'Kecocokan sempurna ditemukan di koleksi lokal Anda! File ini adalah sertifikat asli.'
        }
      }
    }
    updateStep(2, 'completed', `Memeriksa ${nftCollection.length} sertifikat lokal - tidak ada kecocokan`)

    // Langkah 3: Periksa koneksi blockchain
    updateStep(3, 'loading', 'Menghubungkan ke blockchain Solana...')
    const program = getProviderReadonly()
    if (!await isProgramInitialized(program)) {
      updateStep(3, 'error', 'Program belum diinisialisasi di blockchain')
      throw new Error('Program sertifikat belum diinisialisasi di blockchain')
    }
    updateStep(3, 'completed', 'Berhasil terhubung ke blockchain')

    // Langkah 4: Ambil semua sertifikat dari blockchain
    updateStep(4, 'loading', 'Mengambil semua sertifikat dari blockchain...')
    const programState = await getFreshProgramState(program)
    const totalCertificates = programState.certificateCount
    if (totalCertificates === 0) {
      updateStep(4, 'error', 'Tidak ada sertifikat yang ditemukan di blockchain')
      throw new Error('Tidak ada sertifikat yang ditemukan di blockchain untuk dibandingkan')
    }
    const allNFTs = await fetchActiveNFTs(program)
    updateStep(4, 'completed', `Ditemukan ${allNFTs.length} sertifikat untuk diperiksa`)

    // Langkah 5: Bandingkan hash
    updateStep(5, 'loading', `Membandingkan hash file dengan ${allNFTs.length} metadata sertifikat...`)
    let matchingCertificate: BlockchainNFT | null = null
    let originalFileHash = ''
    
    for (const [index, nft] of allNFTs.entries()) {
      if ((index + 1) % 5 === 0 || (index + 1) === allNFTs.length) {
        updateStep(5, 'loading', `Memeriksa ${index + 1}/${allNFTs.length} sertifikat...`)
      }
      try {
        const metadata = await fetchIPFSMetadata(nft.ipfsUri)
        if (metadata) {
          const storedFileHash = extractFileHashFromMetadata(metadata)
          if (storedFileHash && storedFileHash.toLowerCase() === uploadedFileHash.toLowerCase()) {
            matchingCertificate = nft
            originalFileHash = storedFileHash
            break
          }
        }
      } catch (error) {
        // Abaikan error untuk sertifikat individual dan lanjutkan
        continue
      }
       // Delay kecil untuk mencegah pembatasan rate
      if ((index + 1) % 3 === 0) await new Promise(resolve => setTimeout(resolve, 100))
    }

    // Selesaikan hasil
    if (matchingCertificate) {
      updateStep(5, 'completed', `Kecocokan hash ditemukan di sertifikat #${matchingCertificate.certificateId}`)
      return {
        certificateId: matchingCertificate.certificateId,
        title: matchingCertificate.title,
        issuer: matchingCertificate.issuerName,
        recipient: matchingCertificate.recipientName,
        issueDate: new Date(matchingCertificate.issueDate * 1000).toISOString().split('T')[0],
        isVerified: matchingCertificate.statusVerify,
        owner: matchingCertificate.owner,
        creator: matchingCertificate.creator,
        transferCount: matchingCertificate.transferCount,
        isActive: matchingCertificate.isActive,
        ipfsUri: matchingCertificate.ipfsUri,
        fileMatches: true,
        uploadedFileHash,
        originalFileHash,
        confidenceLevel: 'PERFECT_MATCH',
        message: 'Kecocokan sempurna ditemukan di blockchain! File ini adalah sertifikat asli yang tidak dimodifikasi.'
      }
    } else {
      updateStep(5, 'completed', `Tidak ada hash yang cocok ditemukan di ${allNFTs.length} sertifikat`)
      return {
        certificateId: 0, title: '', issuer: '', recipient: '', issueDate: '', isVerified: false,
        owner: '', creator: '', transferCount: 0, isActive: false, ipfsUri: '', fileMatches: false,
        uploadedFileHash, originalFileHash: '', confidenceLevel: 'NO_MATCH',
        message: 'Tidak ada sertifikat yang cocok ditemukan di koleksi lokal atau blockchain. File ini mungkin bukan sertifikat asli atau telah dimodifikasi.'
      }
    }
  } catch (error) {
    const currentStep = verificationSteps.find(step => step.status === 'loading')
    if (currentStep) {
      updateStep(currentStep.step, 'error', error instanceof Error ? error.message : 'Verifikasi gagal')
    }
    throw error
  }
  }

  const handleFileSelect = (file: File) => {
    setUploadedFile(file)
    setVerificationResult(null)
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => setFilePreview(e.target?.result as string)
      reader.readAsDataURL(file)
    } else {
      setFilePreview(null)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFileSelect(e.target.files[0])
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(e.type === 'dragenter' || e.type === 'dragover')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files?.[0]) handleFileSelect(e.dataTransfer.files[0])
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadedFile) {
      alert('Silakan pilih file untuk diverifikasi')
      return
    }
    setIsVerifying(true)
    setVerificationResult(null)
    try {
      const result = await verifyFileAgainstBlockchain(uploadedFile)
      setVerificationResult(result)
    } catch (error) {
      alert(`Verifikasi gagal: ${error instanceof Error ? error.message : 'Error tidak diketahui'}`)
    } finally {
      setIsVerifying(false)
    }
  }

  const resetForm = () => {
    setUploadedFile(null)
    setFilePreview(null)
    setVerificationResult(null)
    setVerificationSteps([])
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  if (!connected) {
    return (
      <div className="verify-nft-page">
        <div className="container">
          <div className="wallet-connect-prompt">
            <div className="prompt-content">
              <div className="prompt-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
                  <path d="M10 12l2 2 4-4" stroke="white" strokeWidth="2" fill="none"/>
                </svg>
              </div>
              <h2>Hubungkan Dompet Anda</h2>
              <p>Hubungkan dompet Solana Anda untuk memverifikasi file sertifikat terhadap blockchain.</p>
              <WalletMultiButton />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="verify-nft-page">
      <div className="container">
        <div className="page-header">
          <h1>Verify Certificate File</h1>
          <p>Upload the certificate file to verify its authenticity with the Solana blockchain</p>
          <div className="verification-info">
            <div className="info-card">
              <div className="info-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              <div className="info-content">
                <h3>How to work</h3>
                <p>
                  When you upload a file, the system calculates a SHA-256 hash and compares it to 
                  all the certificate metadata stored on the Solana blockchain. If we find a match, 
                  it proves the file is the original, unmodified certificate.
                </p>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleVerify} className="verify-nft-form">
          <div className="form-content">
            <div className="verification-input">
              <label className="field-label">Certificate/Document *</label>
              <div
                className={`file-upload-area ${dragActive ? 'drag-active' : ''} ${uploadedFile ? 'has-file' : ''}`}
                onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
              >
                <input
                  type="file" onChange={handleFileChange} accept="image/*,.pdf,.doc,.docx"
                  className="file-input" id="certificate-file" disabled={isVerifying}
                />
                {!uploadedFile ? (
                  <label htmlFor="certificate-file" className="file-upload-content">
                    <div className="upload-icon">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                      </svg>
                    </div>
                    <h4>Upload Certificate for Verification</h4>
                    <p>Drag and drop or click to select</p>
                    <span className="file-types">Support: PNG, JPG, PDF, DOC, DOCX</span>
                  </label>
                ) : (
                  <div className="file-preview">
                    {filePreview ? (
                      <img src={filePreview} alt="Preview" className="preview-image" />
                    ) : (
                      <div className="file-icon">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                        </svg>
                      </div>
                    )}
                    <div className="file-info">
                      <h4>{uploadedFile.name}</h4>
                      <p>{(uploadedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      <button 
                        type="button" onClick={resetForm}
                        className="remove-file-btn" disabled={isVerifying}
                      > Remove File </button>
                    </div>
                  </div>
                )}
              </div>
              <span className="field-hint">
                Upload the certificate file you want to verify. 
                The system will calculate its hash and look for a match in the blockchain.
              </span>
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" disabled={!uploadedFile || isVerifying} className="btn btn-primary btn-large">
              {isVerifying ? (
                <><div className="loading-spinner"></div> Verifying Files...</>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
                    <path d="M10 12l2 2 4-4" stroke="currentColor" strokeWidth="2" fill="none"/>
                  </svg>
                  Verification certificate file
                </>
              )}
            </button>
            <button type="button" onClick={resetForm} className="btn btn-secondary" disabled={isVerifying}> Reset </button>
          </div>
        </form>

        {isVerifying && verificationSteps.length > 0 && (
          <div className="verification-progress">
            <h3>Verifying Files...</h3>
            <div className="progress-steps">
              {verificationSteps.map((step) => (
                <div key={step.step} className={`progress-step ${step.status}`}>
                  <div className="step-indicator">
                    {step.status === 'loading' && <div className="loading-spinner small"></div>}
                    {step.status === 'completed' && <span className="check-icon">✓</span>}
                    {step.status === 'error' && <span className="error-icon">✗</span>}
                    {step.status === 'pending' && <span className="step-number">{step.step}</span>}
                  </div>
                  <div className="step-content">
                    <h4>{step.title}</h4>
                    {step.message && <p>{step.message}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {verificationResult && !isVerifying && (
          <div className="verification-result">
            <div className="result-header">
              <div className={`result-icon ${verificationResult.fileMatches ? 'verified' : 'unverified'}`}>
                {verificationResult.fileMatches ? (
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
                    <path d="M10 12l2 2 4-4" stroke="white" strokeWidth="2" fill="none"/>
                  </svg>
                ) : (
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                )}
              </div>
              <div className="result-status">
                <h3>
                  {verificationResult.fileMatches ? '✅ Sertifikat Terverifikasi' : '❌ Sertifikat Tidak Ditemukan'}
                </h3>
                <p>{verificationResult.message}</p>
              </div>
            </div>

            <div className="hash-comparison">
              <h4>Hash comparison</h4>
              <div className="hash-details">
                <div className="hash-item">
                  <span className="hash-label">Uploaded File Hash:</span>
                  <span className="hash-value mono">{verificationResult.uploadedFileHash}</span>
                </div>
                {verificationResult.originalFileHash && (
                  <div className="hash-item">
                    <span className="hash-label">Original Certificate Hash:</span>
                    <span className="hash-value mono">{verificationResult.originalFileHash}</span>
                  </div>
                )}
                <div className="hash-match">
                  <span className={`match-indicator ${verificationResult.fileMatches ? 'match' : 'no-match'}`}>
                    {verificationResult.fileMatches ? '✅ Hash Cocok' : '❌ Hash Tidak Cocok'}
                  </span>
                </div>
              </div>
            </div>

            {verificationResult.fileMatches && (
              <div className="certificate-details">
                <h4>Certificate details</h4>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Certificate ID:</span>
                    <span className="detail-value">#{verificationResult.certificateId}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Title:</span>
                    <span className="detail-value">{verificationResult.title}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Issuer:</span>
                    <span className="detail-value">{verificationResult.issuer}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Recipient:</span>
                    <span className="detail-value">{verificationResult.recipient}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Issue Date:</span>
                    <span className="detail-value">{formatDate(verificationResult.issueDate)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Owner:</span>
                    <span className="detail-value mono">{verificationResult.owner.slice(0, 8)}...{verificationResult.owner.slice(-8)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Transfer Count:</span>
                    <span className="detail-value">{verificationResult.transferCount}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Verification Status:</span>
                    <span className={`detail-badge ${verificationResult.isVerified ? 'verified' : 'unverified'}`}>
                      {verificationResult.isVerified ? 'Terverifikasi oleh Penerbit' : 'Menunggu Verifikasi'}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Status:</span>
                    <span className={`detail-badge ${verificationResult.isActive ? 'active' : 'inactive'}`}>
                      {verificationResult.isActive ? 'Aktif' : 'Tidak Aktif'}
                    </span>
                  </div>
                </div>

                <div className="verification-links">
                  <h4>Verification Link</h4>
                  <div className="links-grid">
                    <a 
                      href={pinataService.getGatewayUrl(verificationResult.ipfsUri.replace('ipfs://', ''))}
                      target="_blank" rel="noopener noreferrer" className="btn btn-outline"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z"/>
                      </svg>
                      Look at IPFS
                    </a>
                    <a 
                      href={`https://explorer.solana.com/address/${verificationResult.owner}?cluster=devnet`}
                      target="_blank" rel="noopener noreferrer" className="btn btn-outline"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z"/>
                      </svg>
                      View Owners in Solana Explorer
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default VerifyNFT