import React, { useState, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useNavigate } from 'react-router-dom';
import {
  getProvider,
  createNft,
  getFreshProgramState,
  initializeProgram,
  checkWalletBalance,
  requestAirdrop,
} from '../services/blockchain';
import { pinataService } from '../services/pinata';
import { useNFT } from '../context/NFTContext';
import './CreateNFT.css';

interface FormData {
  title: string;
  description: string;
  issuerName: string;
  recipientName: string;
  file: File | null;
}

interface CreationStep {
  step: number;
  title: string;
  status: 'pending' | 'loading' | 'completed' | 'error';
  message?: string;
}

const CreateNFT: React.FC = () => {
  const { connected, publicKey, sendTransaction, signTransaction } = useWallet();
  const { addNFT } = useNFT();
  const navigate = useNavigate();

  const program = useMemo(
    () => getProvider(publicKey, signTransaction, sendTransaction),
    [publicKey, signTransaction, sendTransaction]
  );

  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    issuerName: '',
    recipientName: '',
    file: null,
  });

  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [creationSteps, setCreationSteps] = useState<CreationStep[]>([]);
  const [nftResult, setNftResult] = useState<{
    transactionSignature: string;
    certificateId: number;
    nftAddress: string;
    metadataUri: string;
  } | null>(null);

  const updateStep = (stepNumber: number, status: CreationStep['status'], message?: string) => {
    setCreationSteps((prev) =>
      prev.map((step) =>
        step.step === stepNumber ? { ...step, status, message } : step
      )
    );
  };

  const initializeSteps = () => {
    setCreationSteps([
      { step: 1, title: 'Checking wallet balance and program state', status: 'pending' },
      { step: 2, title: 'Uploading certificate file to IPFS', status: 'pending' },
      { step: 3, title: 'Creating NFT metadata', status: 'pending' },
      { step: 4, title: 'Uploading metadata to IPFS', status: 'pending' },
      { step: 5, title: 'Creating NFT on Solana blockchain', status: 'pending' },
      { step: 6, title: 'Confirming transaction', status: 'pending' },
      { step: 7, title: 'Adding to your collection', status: 'pending' },
    ]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileSelect = (file: File) => {
    setFormData((prev) => ({ ...prev, file }));

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const generateFileHash = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!connected || !publicKey || !program) {
      alert('Please connect your wallet first');
      return;
    }

    if (!formData.file) {
      alert('Please select a certificate file');
      return;
    }

    setIsUploading(true);
    setNftResult(null);
    initializeSteps();

    try {
      updateStep(1, 'loading', 'Checking wallet balance...');
      const balanceInfo = await checkWalletBalance(publicKey);

      if (!balanceInfo.hasEnoughSOL) {
        updateStep(1, 'loading', 'Insufficient balance. Requesting airdrop...');
        const airdropSuccess = await requestAirdrop(publicKey);
        if (!airdropSuccess) {
          throw new Error('Failed to get SOL airdrop. Please visit https://faucet.solana.com/');
        }
      }

      try {
        const state = await getFreshProgramState(program);
        updateStep(1, 'completed', `Program ready. Certificate count: ${state.certificateCount.toString()}`);
      } catch (error) {
        updateStep(1, 'loading', 'Program not initialized. Initializing...');
        await initializeProgram(program, publicKey);
        updateStep(1, 'completed', 'Program initialized successfully');
      }

      updateStep(2, 'loading', 'Uploading file to IPFS...');
      const fileUploadResponse = await pinataService.uploadFile(formData.file);
      updateStep(2, 'completed', `File uploaded: ${fileUploadResponse.IpfsHash}`);

      const fileHash = await generateFileHash(formData.file);

      updateStep(3, 'loading', 'Creating metadata...');
      const metadata = pinataService.createNFTMetadata(
        formData.title,
        formData.description,
        fileUploadResponse.IpfsHash,
        formData.issuerName,
        formData.recipientName,
        formData.file
      );
      updateStep(3, 'completed', 'Metadata created successfully');

      updateStep(4, 'loading', 'Uploading metadata to IPFS...');
      const metadataUploadResponse = await pinataService.uploadJSON(metadata);
      const metadataUri = pinataService.getIPFSUrl(metadataUploadResponse.IpfsHash);
      updateStep(4, 'completed', `Metadata uploaded: ${metadataUploadResponse.IpfsHash}`);

      updateStep(5, 'loading', 'Creating NFT on Solana blockchain...');
      const nftResult = await createNft({
        program,
        publicKey,
        title: formData.title,
        description: formData.description,
        ipfsUri: metadataUri,
        issuerName: formData.issuerName,
        recipientName: formData.recipientName,
      });
      updateStep(5, 'completed', `NFT created with ID: ${nftResult.certificateId}`);

      updateStep(6, 'completed', 'Transaction confirmed on blockchain');

      updateStep(7, 'loading', 'Adding NFT to your collection...');
      const nftData = {
        title: formData.title,
        description: formData.description,
        ipfsUri: metadataUri,
        issuerName: formData.issuerName,
        recipientName: formData.recipientName,
        file: formData.file,
        fileHash,
        metadataUri: pinataService.getGatewayUrl(metadataUploadResponse.IpfsHash),
        imagePreview: preview,
      };

      addNFT(nftData, nftResult);
      updateStep(7, 'completed', 'NFT added to your collection successfully');

      setNftResult({
        ...nftResult,
        metadataUri: pinataService.getGatewayUrl(metadataUploadResponse.IpfsHash),
      });

      setFormData({
        title: '',
        description: '',
        issuerName: '',
        recipientName: '',
        file: null,
      });
      setPreview(null);

      setTimeout(() => {
        navigate('/collection');
      }, 3000);
    } catch (error) {
      const currentStep = creationSteps.find((step) => step.status === 'loading');
      if (currentStep) {
        updateStep(currentStep.step, 'error', error instanceof Error ? error.message : 'An error occurred');
      }

      let errorMessage = 'Unknown error occurred';
      if (error instanceof Error) {
        if (error.message.includes('already exists') || error.message.includes('already in use')) {
          errorMessage = 'This certificate ID already exists. Please refresh the page and try again.';
        } else if (error.message.includes('Insufficient SOL')) {
          errorMessage = 'Insufficient SOL balance. Please get more SOL from faucet.solana.com';
        } else if (error.message.includes('User rejected')) {
          errorMessage = 'Transaction was rejected by user';
        } else {
          errorMessage = error.message;
        }
      }

      alert(`Error creating NFT: ${errorMessage}`);
    } finally {
      setIsUploading(false);
    }
  };

  const isFormValid = formData.title && formData.description && formData.issuerName && formData.recipientName && formData.file;

  if (!connected) {
    return (
      <div className="create-nft-page">
        <div className="container">
          <div className="wallet-connect-prompt">
            <div className="prompt-content">
              <div className="prompt-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21 7h-2V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v2H3a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1zM7 5h10v2H7V5zm12 13H5V9h14v9z" />
                  <circle cx="16" cy="13" r="2" />
                </svg>
              </div>
              <h2>Connect Your Wallet</h2>
              <p>You need to connect your Solana wallet to create NFT certificates.</p>
              <WalletMultiButton />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="create-nft-page">
      <div className="container">
        <div className="page-header">
          <h1>Create Certificate NFT</h1>
          <p>Transform your digital certificate into a verifiable NFT on the Solana blockchain</p>
        </div>

        {isUploading && (
          <div className="creation-progress">
            <h3>Creating Your NFT...</h3>
            <div className="progress-steps">
              {creationSteps.map((step) => (
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

        {nftResult && !isUploading && (
          <div className="success-result">
            <div className="success-header">
              <div className="success-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </div>
              <h3>NFT Created Successfully!</h3>
              <p className="redirect-message">Redirecting to your collection in 3 seconds...</p>
            </div>
            <div className="result-details">
              <div className="result-item">
                <span>Certificate ID:</span>
                <span className="result-value">#{nftResult.certificateId}</span>
              </div>
              <div className="result-item">
                <span>Transaction:</span>
                <a
                  href={`https://explorer.solana.com/tx/${nftResult.transactionSignature}?cluster=localhost`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="result-link"
                >
                  View on Explorer
                </a>
              </div>
              <div className="result-item">
                <span>NFT Address:</span>
                <span className="result-value mono">{nftResult.nftAddress.slice(0, 8)}...{nftResult.nftAddress.slice(-8)}</span>
              </div>
              <div className="result-item">
                <span>Metadata URI:</span>
                <a
                  href={nftResult.metadataUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="result-link"
                >
                  View Metadata
                </a>
              </div>
            </div>
            <div className="success-actions">
              <button
                onClick={() => navigate('/collection')}
                className="btn btn-primary"
              >
                View in Collection
              </button>
              <button
                onClick={() => window.location.reload()}
                className="btn btn-secondary"
              >
                Create Another NFT
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="create-nft-form">
          <div className="form-grid">
            <div className="form-fields">
              <div className="field-group">
                <label htmlFor="title" className="field-label">
                  Certificate Title *
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="e.g., Certificate of Completion"
                  className="field-input"
                  maxLength={64}
                  required
                  disabled={isUploading}
                />
                <span className="field-hint">{formData.title.length}/64 characters</span>
              </div>

              <div className="field-group">
                <label htmlFor="description" className="field-label">
                  Description *
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Describe what this certificate represents..."
                  className="field-textarea"
                  rows={4}
                  maxLength={512}
                  required
                  disabled={isUploading}
                />
                <span className="field-hint">{formData.description.length}/512 characters</span>
              </div>

              <div className="field-row">
                <div className="field-group">
                  <label htmlFor="issuerName" className="field-label">
                    Issuer Name *
                  </label>
                  <input
                    type="text"
                    id="issuerName"
                    name="issuerName"
                    value={formData.issuerName}
                    onChange={handleInputChange}
                    placeholder="Organization or issuer name"
                    className="field-input"
                    maxLength={64}
                    required
                    disabled={isUploading}
                  />
                </div>

                <div className="field-group">
                  <label htmlFor="recipientName" className="field-label">
                    Recipient Name *
                  </label>
                  <input
                    type="text"
                    id="recipientName"
                    name="recipientName"
                    value={formData.recipientName}
                    onChange={handleInputChange}
                    placeholder="Certificate recipient name"
                    className="field-input"
                    maxLength={64}
                    required
                    disabled={isUploading}
                  />
                </div>
              </div>
            </div>

            <div className="file-upload-section">
              <label className="field-label">Certificate File *</label>

              <div
                className={`file-upload-area ${dragActive ? 'drag-active' : ''} ${formData.file ? 'has-file' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrop}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept="image/*,.pdf,.doc,.docx"
                  className="file-input"
                  id="certificate-file"
                  disabled={isUploading}
                />

                {!formData.file ? (
                  <label htmlFor="certificate-file" className="file-upload-content">
                    <div className="upload-icon">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                      </svg>
                    </div>
                    <h3>Upload Certificate</h3>
                    <p>Drag and drop or click to select</p>
                    <span className="file-types">Supports: PNG, JPG, PDF, DOC</span>
                  </label>
                ) : (
                  <div className="file-preview">
                    {preview ? (
                      <img src={preview} alt="Preview" className="preview-image" />
                    ) : (
                      <div className="file-icon">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                        </svg>
                      </div>
                    )}
                    <div className="file-info">
                      <h4>{formData.file.name}</h4>
                      <p>{(formData.file.size / 1024 / 1024).toFixed(2)} MB</p>
                      {/* <button
                        type="button"
                        onClick={() => {
                          setFormData((prev) => ({ ...prev, file: null }));
                          setPreview(null);
                        }}
                        className="remove-file-btn"
                        disabled={isUploading}
                      >
                        Remove File
                      </button> */}
                    </div>
                    
                  </div>
                )}
              </div>
                <button
                  type="button"
                  onClick={() => {
                    setFormData((prev) => ({ ...prev, file: null }));
                    setPreview(null);
                  }}
                  className="remove-file-btn"
                  disabled={isUploading}
                >
                  Remove File
                </button>
            </div>
          </div>

          <div className="form-actions">
            <button
              type="submit"
              disabled={!isFormValid || isUploading}
              className="btn btn-primary btn-large"
            >
              {isUploading ? (
                <>
                  <div className="loading-spinner"></div>
                  Creating NFT...
                </>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                  Create Certificate NFT
                </>
              )}
            </button>

            <div className="wallet-info">
              <span>Connected:</span>
              <span className="wallet-address">
                {publicKey?.toString().slice(0, 4)}...{publicKey?.toString().slice(-4)}
              </span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateNFT;