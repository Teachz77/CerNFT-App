import React, { useState, useMemo } from 'react'
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

  // Helper function untuk generate SHA-256 hash dari file
  const generateFileHash = async (file: File): Promise<string> => {
    try {
      const buffer = await file.arrayBuffer()
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    } catch (error) {
      console.error('❌ Error generating file hash:', error)
      throw new Error('Failed to generate file hash')
    }
  }

  // Helper function untuk fetch metadata dari IPFS
  const fetchIPFSMetadata = async (ipfsUri: string): Promise<any> => {
    try {
      const ipfsHash = ipfsUri.replace('ipfs://', '')
      const metadataUrl = pinataService.getGatewayUrl(ipfsHash)
      
      console.log('🔍 Fetching metadata from:', metadataUrl)

      // Add timeout untuk avoid hanging requests
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
      
      const response = await fetch(metadataUrl, { 
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        }
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const metadata = await response.json()
      return metadata
    } catch (error) {
      console.warn('⚠️ Could not fetch metadata from IPFS:', error)
      return null
    }
  }

  // Extract file hash dari metadata
  const extractFileHashFromMetadata = (metadata: any): string | null => {
    try {
      if (!metadata || !metadata.attributes) {
        return null
      }

      // Cari hash file dari berbagai kemungkinan attribute names
      const hashAttributes = metadata.attributes.find((attr: any) => 
        attr.trait_type === 'IPFS Hash' || 
        attr.trait_type === 'File Hash' || 
        attr.trait_type === 'SHA256' ||
        attr.trait_type === 'FileHash'
      )

      return hashAttributes ? hashAttributes.value : null
    } catch (error) {
      console.warn('⚠️ Error extracting file hash from metadata:', error)
      return null
    }
  }

  // Update verification step
  const updateStep = (stepNumber: number, status: VerificationStep['status'], message?: string) => {
    setVerificationSteps(prev => prev.map(step => 
      step.step === stepNumber 
        ? { ...step, status, message }
        : step
    ))
  }

  // Initialize verification steps
  const initializeSteps = () => {
    setVerificationSteps([
      { step: 1, title: 'Generating file hash', status: 'pending' },
      { step: 2, title: 'Checking blockchain connection', status: 'pending' },
      { step: 3, title: 'Fetching all certificates from blockchain', status: 'pending' },
      { step: 4, title: 'Comparing file hash with certificate metadata', status: 'pending' },
      { step: 5, title: 'Finalizing verification result', status: 'pending' }
    ])
  }

  // Main verification function
 const verifyFileAgainstBlockchain = async (file: File): Promise<VerificationResult | null> => {
  try {
    initializeSteps()

    // Step 1: Generate file hash
    updateStep(1, 'loading', 'Computing SHA-256 hash of uploaded file...')
    const uploadedFileHash = await generateFileHash(file)
    console.log('📄 Generated hash for uploaded file:', uploadedFileHash)
    updateStep(1, 'completed', `File hash: ${uploadedFileHash.slice(0, 16)}...`)

    // Step 2: Check local collection first
    updateStep(2, 'loading', 'Checking local collection...')
    
    // Cek koleksi lokal dulu
    for (const localNFT of nftCollection) {
      if (localNFT.fileHash && localNFT.fileHash.toLowerCase() === uploadedFileHash.toLowerCase()) {
        console.log(`✅ MATCH FOUND IN LOCAL COLLECTION! Certificate #${localNFT.certificateId}`)
        
        updateStep(2, 'completed', `Match found in local collection: #${localNFT.certificateId}`)
        updateStep(3, 'completed', 'Skipped blockchain search (found locally)')
        updateStep(4, 'completed', 'Hash comparison completed')
        updateStep(5, 'completed', 'Verification completed successfully')

        const result: VerificationResult = {
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
          message: 'Perfect match found in your local collection! This file is an authentic certificate.'
        }

        return result
      }
    }
    
    updateStep(2, 'completed', `Checked ${nftCollection.length} local certificates - no match`)

    // Step 3: Check blockchain connection
    updateStep(3, 'loading', 'Connecting to Solana blockchain...')
    const program = getProviderReadonly()
    
    const programInitialized = await isProgramInitialized(program)
    if (!programInitialized) {
      updateStep(3, 'error', 'Program not initialized on blockchain')
      throw new Error('Certificate program not initialized on blockchain')
    }
    updateStep(3, 'completed', 'Connected to blockchain successfully')

    // Step 4: Fetch all certificates from blockchain
    updateStep(4, 'loading', 'Retrieving all certificates from blockchain...')
    
    const programState = await getFreshProgramState(program)
    const totalCertificates = programState.certificateCount
    console.log(`📊 Total certificates to check: ${totalCertificates}`)
    
    if (totalCertificates === 0) {
      updateStep(4, 'error', 'No certificates found on blockchain')
      throw new Error('No certificates found on blockchain to compare against')
    }

    const allNFTs = await fetchActiveNFTs(program)
    console.log(`📦 Retrieved ${allNFTs.length} active certificates from blockchain`)
    updateStep(4, 'completed', `Found ${allNFTs.length} certificates to check`)

    // Step 5: Compare hashes
    updateStep(5, 'loading', `Comparing file hash with ${allNFTs.length} certificate metadata...`)
    
    let matchingCertificate: BlockchainNFT | null = null
    let originalFileHash = ''
    let checked = 0
    
    for (const nft of allNFTs) {
      checked++
      
      if (checked % 5 === 0 || checked === allNFTs.length) {
        updateStep(5, 'loading', `Checked ${checked}/${allNFTs.length} certificates...`)
      }

      try {
        const metadata = await fetchIPFSMetadata(nft.ipfsUri)
        
        if (metadata) {
          const storedFileHash = extractFileHashFromMetadata(metadata)
          
          if (storedFileHash) {
            console.log(`🔍 Certificate #${nft.certificateId}: ${storedFileHash}`)
            
            if (storedFileHash.toLowerCase() === uploadedFileHash.toLowerCase()) {
              console.log(`✅ MATCH FOUND! Certificate #${nft.certificateId}`)
              matchingCertificate = nft
              originalFileHash = storedFileHash
              break
            }
          } else {
            console.log(`⚠️ Certificate #${nft.certificateId}: No file hash in metadata`)
          }
        } else {
          console.log(`❌ Certificate #${nft.certificateId}: Could not fetch metadata`)
        }
      } catch (error) {
        console.warn(`⚠️ Error checking certificate #${nft.certificateId}:`, error)
        continue
      }

      if (checked % 3 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    // Finalize result
    if (matchingCertificate) {
      updateStep(5, 'completed', `Hash match found in certificate #${matchingCertificate.certificateId}`)

      const result: VerificationResult = {
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
        message: 'Perfect match found on blockchain! This file is an authentic, unmodified certificate.'
      }

      return result
    } else {
      updateStep(5, 'completed', `No matching hash found in ${checked} certificates`)

      const result: VerificationResult = {
        certificateId: 0,
        title: '',
        issuer: '',
        recipient: '',
        issueDate: '',
        isVerified: false,
        owner: '',
        creator: '',
        transferCount: 0,
        isActive: false,
        ipfsUri: '',
        fileMatches: false,
        uploadedFileHash,
        originalFileHash: '',
        confidenceLevel: 'NO_MATCH',
        message: 'No matching certificate found in local collection or blockchain. This file may not be an authentic certificate or may have been modified.'
      }

      return result
    }

  } catch (error) {
    console.error('❌ Error in file verification:', error)
    
    const currentStep = verificationSteps.find(step => step.status === 'loading')
    if (currentStep) {
      updateStep(currentStep.step, 'error', error instanceof Error ? error.message : 'Verification failed')
    }
    
    throw error
  }
}

  const handleFileSelect = (file: File) => {
    setUploadedFile(file)
    setVerificationResult(null) // Reset previous results
    
    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setFilePreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    } else {
      setFilePreview(null)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!uploadedFile) {
      alert('Please select a file to verify')
      return
    }

    setIsVerifying(true)
    setVerificationResult(null)
    
    try {
      console.log('🔍 Starting file verification for:', uploadedFile.name)
      const result = await verifyFileAgainstBlockchain(uploadedFile)
      setVerificationResult(result)
      
    } catch (error) {
      console.error('❌ Verification error:', error)
      alert(`Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
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
              <h2>Connect Your Wallet</h2>
              <p>Connect your Solana wallet to verify certificate files against the blockchain.</p>
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
          <p>Upload a certificate file to verify its authenticity against the Solana blockchain</p>
          
          <div className="verification-info">
            <div className="info-card">
              <div className="info-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              <div className="info-content">
                <h3>How it works</h3>
                <p>
                  When you upload a file, we calculate its SHA-256 hash and compare it with 
                  all certificate metadata stored on the Solana blockchain. If we find a match, 
                  it proves the file is an authentic, unmodified certificate.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* File Upload Form */}
        <form onSubmit={handleVerify} className="verify-nft-form">
          <div className="form-content">
            <div className="verification-input">
              <label className="field-label">Certificate File *</label>
              <div
                className={`file-upload-area ${dragActive ? 'drag-active' : ''} ${uploadedFile ? 'has-file' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept="image/*,.pdf,.doc,.docx"
                  className="file-input"
                  id="certificate-file"
                  disabled={isVerifying}
                />
                
                {!uploadedFile ? (
                  <label htmlFor="certificate-file" className="file-upload-content">
                    <div className="upload-icon">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                      </svg>
                    </div>
                    <h4>Upload Certificate to Verify</h4>
                    <p>Drag and drop or click to select</p>
                    <span className="file-types">Supports: PNG, JPG, PDF, DOC, DOCX</span>
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
                        type="button" 
                        onClick={() => {
                          setUploadedFile(null)
                          setFilePreview(null)
                          setVerificationResult(null)
                          setVerificationSteps([])
                        }}
                        className="remove-file-btn"
                        disabled={isVerifying}
                      >
                        Remove File
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <span className="field-hint">
                Upload the certificate file you want to verify. The system will calculate its hash and search for matches in the blockchain.
              </span>
            </div>
          </div>

          {/* Form Actions */}
          <div className="form-actions">
            <button
              type="submit"
              disabled={!uploadedFile || isVerifying}
              className="btn btn-primary btn-large"
            >
              {isVerifying ? (
                <>
                  <div className="loading-spinner"></div>
                  Verifying File...
                </>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
                    <path d="M10 12l2 2 4-4" stroke="currentColor" strokeWidth="2" fill="none"/>
                  </svg>
                  Verify Certificate File
                </>
              )}
            </button>
            
            <button
              type="button"
              onClick={resetForm}
              className="btn btn-secondary"
              disabled={isVerifying}
            >
              Reset
            </button>
          </div>
        </form>

        {/* Verification Progress */}
        {isVerifying && verificationSteps.length > 0 && (
          <div className="verification-progress">
            <h3>Verifying Certificate...</h3>
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

        {/* Verification Result */}
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
                  {verificationResult.fileMatches 
                    ? '✅ Certificate Verified' 
                    : '❌ Certificate Not Found'
                  }
                </h3>
                <p>{verificationResult.message}</p>
              </div>
            </div>

            {/* Hash Comparison */}
            <div className="hash-comparison">
              <h4>Hash Comparison</h4>
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
                    {verificationResult.fileMatches ? '✅ Hashes Match' : '❌ No Hash Match Found'}
                  </span>
                </div>
              </div>
            </div>

            {/* Certificate Details (only if match found) */}
            {verificationResult.fileMatches && (
              <div className="certificate-details">
                <h4>Certificate Details</h4>
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
                    <span className="detail-label">Current Owner:</span>
                    <span className="detail-value mono">{verificationResult.owner.slice(0, 8)}...{verificationResult.owner.slice(-8)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Transfer Count:</span>
                    <span className="detail-value">{verificationResult.transferCount}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Verification Status:</span>
                    <span className={`detail-badge ${verificationResult.isVerified ? 'verified' : 'unverified'}`}>
                      {verificationResult.isVerified ? 'Verified by Issuer' : 'Pending Verification'}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Status:</span>
                    <span className={`detail-badge ${verificationResult.isActive ? 'active' : 'inactive'}`}>
                      {verificationResult.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                {/* Verification Links */}
                <div className="verification-links">
                  <h4>Verification Links</h4>
                  <div className="links-grid">
                    <a 
                      href={pinataService.getGatewayUrl(verificationResult.ipfsUri.replace('ipfs://', ''))}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z"/>
                      </svg>
                      View on IPFS
                    </a>
                    
                    <a 
                      href={`https://explorer.solana.com/address/${verificationResult.owner}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z"/>
                      </svg>
                      View Owner on Solana Explorer
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* Security Information */}
            <div className="security-information">
              <h4>Security Information</h4>
              <div className="security-details">
                <div className="security-item">
                  <div className="security-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6,2C4.89,2 4,2.89 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2H6Z"/>
                    </svg>
                  </div>
                  <div className="security-content">
                    <h5>Blockchain Storage</h5>
                    <p>Certificate metadata permanently stored on Solana blockchain</p>
                  </div>
                </div>
                <div className="security-item">
                  <div className="security-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12,3L1,9L12,15L21,10.09V17H23V9M5,13.18V17.18L12,21L19,17.18V13.18L12,17L5,13.18Z"/>
                    </svg>
                  </div>
                  <div className="security-content">
                    <h5>Decentralized Storage</h5>
                    <p>File metadata stored on IPFS for permanent, tamper-proof access</p>
                  </div>
                </div>
                {verificationResult.fileMatches && (
                  <div className="security-item success">
                    <div className="security-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z"/>
                      </svg>
                    </div>
                    <div className="security-content">
                      <h5>Authenticity Confirmed</h5>
                      <p>This file has been cryptographically verified as an authentic certificate</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default VerifyNFT 