import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey } from '@solana/web3.js';
import { useNFT, CertificateNFT } from '../context/NFTContext';
import {
  getProvider,
  transferNFT,
  validateTransferRequest,
  estimateTransferCosts,
  TransferNFTResult
} from '../services/blockchain';
import './TransferNFT.css';

// Interface untuk state komponen
interface TransferState {
  selectedNFT: CertificateNFT | null;
  recipientAddress: string;
  isTransferring: boolean;
  transferSteps: TransferStep[];
  transferResult: TransferNFTResult | null;
  platformFee: number;
  showConfirmModal: boolean;
  validationErrors: string[];
  estimatedCosts: {
    platformFee: number;
    estimatedGasFee: number;
    totalCost: number;
    costInSOL: number;
  } | null;
}

// Interface untuk setiap langkah dalam proses transfer
interface TransferStep {
  step: number;
  title: string;
  status: 'pending' | 'loading' | 'completed' | 'error';
  message?: string;
}

// State awal untuk komponen
const initialTransferState: TransferState = {
  selectedNFT: null,
  recipientAddress: '',
  isTransferring: false,
  transferSteps: [],
  transferResult: null,
  platformFee: 0.001, // Default fee
  showConfirmModal: false,
  validationErrors: [],
  estimatedCosts: null
};

const TransferNFT: React.FC = () => {
  const { connected, publicKey, sendTransaction, signTransaction } = useWallet();
  const {
    nftCollection,
    updateNFT,
    refreshCollection,
    isLoading: contextLoading,
    syncStatus
  } = useNFT();

  const [transferState, setTransferState] = useState<TransferState>(initialTransferState);

  const program = useMemo(
    () => getProvider(publicKey, signTransaction, sendTransaction),
    [publicKey, signTransaction, sendTransaction]
  );

  const ownedNFTs = useMemo(() => {
    if (!publicKey || !nftCollection.length) return [];
    return nftCollection
      .filter(nft => nft.owner === publicKey.toString() && nft.isActive)
      .sort((a, b) => b.certificateId - a.certificateId);
  }, [nftCollection, publicKey]);

  const recipientValidation = useMemo(() => {
    const { recipientAddress } = transferState;
    if (!recipientAddress.trim()) {
      return { isValid: false, error: '' };
    }
    try {
      new PublicKey(recipientAddress);
      if (recipientAddress === publicKey?.toString()) {
        return { isValid: false, error: 'Tidak dapat mentransfer ke dompet sendiri' };
      }
      return { isValid: true, error: '' };
    } catch {
      return { isValid: false, error: 'Format alamat Solana tidak valid' };
    }
  }, [transferState.recipientAddress, publicKey]);

  const isFormValid = useMemo(() => {
    return !!(transferState.selectedNFT && recipientValidation.isValid && !transferState.isTransferring);
  }, [transferState.selectedNFT, recipientValidation.isValid, transferState.isTransferring]);

  const updateTransferState = useCallback((updates: Partial<TransferState>) => {
    setTransferState(prev => ({ ...prev, ...updates }));
  }, []);

  const updateStep = useCallback((stepNumber: number, status: TransferStep['status'], message?: string) => {
    updateTransferState({
      transferSteps: transferState.transferSteps.map(step =>
        step.step === stepNumber
          ? { ...step, status, message }
          : step
      )
    });
  }, [transferState.transferSteps, updateTransferState]);

  const initializeSteps = useCallback(() => {
    const steps: TransferStep[] = [
      { step: 1, title: 'Validasi pra-transfer', status: 'pending' },
      { step: 2, title: 'Estimasi biaya dan kalkulasi fee', status: 'pending' },
      { step: 3, title: 'Menjalankan transfer di blockchain', status: 'pending' },
      { step: 4, title: 'Memperbarui state lokal', status: 'pending' },
      { step: 5, title: 'Sinkronisasi dengan blockchain', status: 'pending' }
    ];
    updateTransferState({ transferSteps: steps });
  }, [updateTransferState]);

  useEffect(() => {
    if (!connected) {
      setTransferState(initialTransferState);
    }
  }, [connected]);

  useEffect(() => {
    if (connected && publicKey && !contextLoading && ownedNFTs.length === 0) {
      refreshCollection(false);
    }
  }, [connected, publicKey, contextLoading, ownedNFTs.length, refreshCollection]);

  useEffect(() => {
    if (!transferState.selectedNFT || !program) return;
    const estimateCosts = async () => {
      try {
        const costs = await estimateTransferCosts(program, transferState.selectedNFT!.certificateId);
        updateTransferState({
          estimatedCosts: costs,
          platformFee: costs.costInSOL
        });
      } catch (error) {
        console.warn('Gagal melakukan estimasi biaya:', error);
      }
    };
    estimateCosts();
  }, [transferState.selectedNFT, program, updateTransferState]);

  useEffect(() => {
    if (!transferState.recipientAddress || !transferState.selectedNFT || !program || !publicKey) {
      updateTransferState({ validationErrors: [] });
      return;
    }

    const validateInRealTime = async () => {
      try {
        const newOwnerPubkey = new PublicKey(transferState.recipientAddress);
        const validation = await validateTransferRequest(
          program,
          publicKey,
          transferState.selectedNFT!.certificateId,
          newOwnerPubkey
        );
        updateTransferState({ validationErrors: validation.issues });
      } catch (error) {
        updateTransferState({ validationErrors: ['Alamat penerima tidak valid'] });
      }
    };

    const timeoutId = setTimeout(validateInRealTime, 500);
    return () => clearTimeout(timeoutId);
  }, [transferState.recipientAddress, transferState.selectedNFT, program, publicKey, updateTransferState]);

  const handleNFTSelect = useCallback((nft: CertificateNFT) => {
    updateTransferState({
      selectedNFT: nft,
      transferResult: null,
      validationErrors: []
    });
  }, [updateTransferState]);

  const handleRecipientChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.trim();
    updateTransferState({
      recipientAddress: value,
      validationErrors: []
    });
  }, [updateTransferState]);

  const handleTransferSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;
    updateTransferState({ showConfirmModal: true });
  }, [isFormValid, updateTransferState]);

  const handleConfirmTransfer = useCallback(async () => {
    if (!transferState.selectedNFT || !program || !publicKey) return;
    
    updateTransferState({ 
      showConfirmModal: false,
      isTransferring: true,
      transferResult: null
    });
    initializeSteps();
    
    try {
      const newOwnerPubkey = new PublicKey(transferState.recipientAddress);
      
      updateStep(1, 'loading', 'Memvalidasi permintaan transfer...');
      const validation = await validateTransferRequest(program, publicKey, transferState.selectedNFT.certificateId, newOwnerPubkey);
      if (!validation.isValid) {
        throw new Error(`Validasi gagal: ${validation.issues.join(', ')}`);
      }
      updateStep(1, 'completed', 'Validasi transfer berhasil');

      updateStep(2, 'loading', 'Menghitung biaya transfer final...');
      const costs = await estimateTransferCosts(program, transferState.selectedNFT.certificateId);
      updateTransferState({ estimatedCosts: costs, platformFee: costs.costInSOL });
      updateStep(2, 'completed', `Fee platform: ${costs.platformFee} lamports`);

      updateStep(3, 'loading', 'Menjalankan transfer di blockchain...');
      const transferResult = await transferNFT({ program, publicKey, certificateId: transferState.selectedNFT.certificateId, newOwner: newOwnerPubkey });
      updateStep(3, 'completed', 'Transfer di blockchain selesai');

      updateStep(4, 'loading', 'Memperbarui koleksi lokal...');
      updateNFT(transferState.selectedNFT.certificateId, { owner: transferState.recipientAddress, transferCount: transferResult.transferCount });
      updateTransferState({ transferResult });
      updateStep(4, 'completed', 'Koleksi lokal diperbarui');

      updateStep(5, 'loading', 'Sinkronisasi dengan blockchain...');
      await refreshCollection(true);
      updateStep(5, 'completed', 'Berhasil sinkronisasi dengan blockchain');

      updateTransferState({ selectedNFT: null, recipientAddress: '', validationErrors: [] });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Transfer gagal. Silakan coba lagi.';
      const currentStep = transferState.transferSteps.find(step => step.status === 'loading');
      if (currentStep) {
        updateStep(currentStep.step, 'error', errorMessage);
      }
      alert(`Transfer gagal: ${errorMessage}`);
    } finally {
      updateTransferState({ isTransferring: false });
    }
  }, [program, publicKey, refreshCollection, transferState.recipientAddress, transferState.selectedNFT, transferState.transferSteps, updateNFT, updateTransferState, updateStep, initializeSteps]);
  
  const handleCancelTransfer = useCallback(() => {
    updateTransferState({ showConfirmModal: false });
  }, [updateTransferState]);

  const resetForm = useCallback(() => {
    setTransferState({
      ...initialTransferState,
      estimatedCosts: transferState.estimatedCosts
    });
  }, [transferState.estimatedCosts]);

  const getValidationIcon = useCallback(() => {
    if (!transferState.recipientAddress) return null;
    if (recipientValidation.isValid) {
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="validation-success-icon">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
        </svg>
      );
    } else {
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="validation-error-icon">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      );
    }
  }, [transferState.recipientAddress, recipientValidation]);

  // Loading state when context is syncing
  if (contextLoading && syncStatus === 'syncing') {
    return (
      <div className="transfer-nft-page">
        <div className="container">
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <h3>Syncing with blockchain...</h3>
            <p>Please wait while we fetch your latest NFT collection.</p>
          </div>
        </div>
      </div>
    )
  }

  if (!connected) {
    return (
      <div className="transfer-nft-page">
        <div className="container">
          <div className="wallet-connect-prompt">
            <div className="prompt-content">
              <div className="prompt-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16.01 11H4v2h12.01v3L20 12l-3.99-4z"/>
                </svg>
              </div>
              <h2>Connect Your Wallet</h2>
              <p>Connect your Solana wallet to transfer your certificate NFTs to other addresses.</p>
              <WalletMultiButton />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="transfer-nft-page">
      <div className="container">
        <div className="page-header">
          <h1>Transfer Certificate NFT</h1>
          <p>Transfer ownership of your certificate NFTs to another Solana wallet address</p>
          
          {/* Sync status indicator */}
          {syncStatus === 'error' && (
            <div className="sync-warning">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
              </svg>
              <span>Unable to sync with blockchain. Showing local data only.</span>
              <button onClick={() => refreshCollection(true)} className="btn btn-small">
                Retry Sync
              </button>
            </div>
          )}
        </div>

        {/* NFT Selection */}
        <div className="nft-selection">
          <div className="nft-selection-header">
            <h3>Select Certificate to Transfer</h3>
            <div className="nft-stats">
              <span>{ownedNFTs.length} NFTs available</span>
              {contextLoading && <span className="syncing-indicator">Syncing...</span>}
            </div>
          </div>
          
          {ownedNFTs.length === 0 ? (
            <div className="no-nfts">
              <div className="no-nfts-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                </svg>
              </div>
              <h4>No Transferable NFTs Found</h4>
              <p>You don't have any active certificate NFTs to transfer yet.</p>
              <div className="no-nfts-actions">
                <a href="/create-nft" className="btn btn-primary">
                  Create Your First NFT
                </a>
                <button onClick={() => refreshCollection(true)} className="btn btn-secondary">
                  Refresh Collection
                </button>
              </div>
            </div>
          ) : (
            <div className="nft-grid">
              {ownedNFTs.map((nft) => (
                <div
                  key={nft.certificateId}
                  className={`nft-card ${transferState.selectedNFT?.certificateId === nft.certificateId ? 'selected' : ''}`}
                  onClick={() => handleNFTSelect(nft)}
                >
                  <div className="nft-image">
                    {nft.imagePreview ? (
                      <img src={nft.imagePreview} alt={nft.title} />
                    ) : (
                      <div className="nft-placeholder">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                        </svg>
                      </div>
                    )}
                    <div className="nft-overlay">
                      <div className={`verification-badge ${nft.isVerified ? 'verified' : 'unverified'}`}>
                        {nft.isVerified ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
                            <path d="M10 12l2 2 4-4" stroke="white" strokeWidth="2" fill="none"/>
                          </svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="nft-info">
                    <h4>#{nft.certificateId}</h4>
                    <h5>{nft.title}</h5>
                    <div className="nft-meta">
                      <span>Issuer: {nft.issuer}</span>
                      <span>Transfers: {nft.transferCount}</span>
                    </div>
                  </div>
                  <div className="selection-indicator">
                    <div className={`radio-dot ${transferState.selectedNFT?.certificateId === nft.certificateId ? 'checked' : ''}`} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Transfer Form */}
        {transferState.selectedNFT && (
          <form onSubmit={handleTransferSubmit} className="transfer-form">
            <div className="form-header">
              <h3>Transfer Details</h3>
              <div className="selected-nft-preview">
                <div className="preview-image">
                  {transferState.selectedNFT.imagePreview ? (
                    <img src={transferState.selectedNFT.imagePreview} alt={transferState.selectedNFT.title} />
                  ) : (
                    <div className="placeholder-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                      </svg>
                    </div>
                  )}
                </div>
                <div className="preview-info">
                  <h4>#{transferState.selectedNFT.certificateId} - {transferState.selectedNFT.title}</h4>
                  <p>{transferState.selectedNFT.issuer}</p>
                </div>
              </div>
            </div>

            <div className="form-content">
              <div className="field-group">
                <label htmlFor="recipientAddress" className="field-label">
                  Recipient Wallet Address *
                </label>
                <div className="input-with-validation">
                  <input
                    type="text"
                    id="recipientAddress"
                    value={transferState.recipientAddress}
                    onChange={handleRecipientChange}
                    placeholder="Enter Solana wallet address (e.g., 7xKhCw...9mN2p8)"
                    className={`field-input wallet-input ${
                      transferState.recipientAddress && !recipientValidation.isValid ? 'error' : ''
                    } ${
                      transferState.recipientAddress && recipientValidation.isValid ? 'success' : ''
                    }`}
                    disabled={transferState.isTransferring}
                  />
                  <div className="validation-icon">
                    {getValidationIcon()}
                  </div>
                </div>
                
                <div className="field-validation">
                  {transferState.recipientAddress && recipientValidation.isValid && (
                    <span className="validation-success">
                      Valid Solana address
                    </span>
                  )}
                  {transferState.recipientAddress && recipientValidation.error && (
                    <span className="validation-error">
                      {recipientValidation.error}
                    </span>
                  )}
                  {transferState.validationErrors.length > 0 && (
                    <div className="validation-errors">
                      {transferState.validationErrors.map((error, index) => (
                        <span key={index} className="validation-error">
                          {error}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                
                <span className="field-hint">
                  Enter the complete Solana wallet address of the recipient
                </span>
              </div>

              <div className="transfer-info">
                <h4>Transfer Information</h4>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">Platform Fee:</span>
                    <span className="info-value">
                      {transferState.estimatedCosts 
                        ? `${transferState.estimatedCosts.costInSOL.toFixed(6)} SOL` 
                        : `${transferState.platformFee} SOL`}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Current Owner:</span>
                    <span className="info-value mono">
                      {publicKey?.toString().slice(0, 8)}...{publicKey?.toString().slice(-8)}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">New Transfer Count:</span>
                    <span className="info-value">{transferState.selectedNFT.transferCount + 1}</span>
                  </div>
                  {transferState.estimatedCosts && (
                    <div className="info-item">
                      <span className="info-label">Estimated Gas:</span>
                      <span className="info-value">
                        {(transferState.estimatedCosts.estimatedGasFee / 1000000000).toFixed(6)} SOL
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button
                type="submit"
                disabled={!isFormValid}
                className="btn btn-primary btn-large"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16.01 11H4v2h12.01v3L20 12l-3.99-4z"/>
                </svg>
                Transfer NFT
              </button>
              
              <button
                type="button"
                onClick={resetForm}
                className="btn btn-secondary"
                disabled={transferState.isTransferring}
              >
                Reset
              </button>
            </div>
          </form>
        )}

        {/* Transfer Progress */}
        {transferState.isTransferring && (
          <div className="transfer-progress">
            <h3>Transferring NFT...</h3>
            <div className="progress-steps">
              {transferState.transferSteps.map((step) => (
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

        {/* Transfer Result */}
        {transferState.transferResult && !transferState.isTransferring && (
          <div className="transfer-result">
            <div className="result-header">
              <div className="result-icon success">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
              </div>
              <div className="result-status">
                <h3>Transfer Successful!</h3>
                <p>Certificate NFT has been transferred successfully</p>
              </div>
            </div>

            <div className="result-details">
              <div className="detail-item">
                <span>Certificate ID:</span>
                <span className="detail-value">#{transferState.transferResult.certificateId}</span>
              </div>
              <div className="detail-item">
                <span>Previous Owner:</span>
                <span className="detail-value mono">
                  {transferState.transferResult.previousOwner.slice(0, 8)}...{transferState.transferResult.previousOwner.slice(-8)}
                </span>
              </div>
              <div className="detail-item">
                <span>New Owner:</span>
                <span className="detail-value mono">
                  {transferState.transferResult.newOwner.slice(0, 8)}...{transferState.transferResult.newOwner.slice(-8)}
                </span>
              </div>
              <div className="detail-item">
                <span>Platform Fee Paid:</span>
                <span className="detail-value">
                  {(transferState.transferResult.platformFee / 1000000000).toFixed(6)} SOL
                </span>
              </div>
              <div className="detail-item">
                <span>Gas Fee:</span>
                <span className="detail-value">
                  {(transferState.transferResult.gasUsed / 1000000000).toFixed(6)} SOL
                </span>
              </div>
              <div className="detail-item">
                <span>New Transfer Count:</span>
                <span className="detail-value">{transferState.transferResult.transferCount}</span>
              </div>
              <div className="detail-item">
                <span>Transaction:</span>
                <a 
                  href={`https://explorer.solana.com/tx/${transferState.transferResult.transactionSignature}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="result-link"
                >
                  View on Solana Explorer
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Modal */}
        {transferState.showConfirmModal && transferState.selectedNFT && (
          <div className="modal-overlay">
            <div className="confirmation-modal">
              <div className="modal-header">
                <h3>Confirm Transfer</h3>
                <button 
                  className="modal-close" 
                  onClick={handleCancelTransfer}
                  type="button"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                  </svg>
                </button>
              </div>
              
              <div className="modal-content">
                <div className="confirmation-summary">
                  <div className="summary-nft">
                    <div className="summary-image">
                      {transferState.selectedNFT.imagePreview ? (
                        <img src={transferState.selectedNFT.imagePreview} alt={transferState.selectedNFT.title} />
                      ) : (
                        <div className="summary-placeholder">
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="summary-info">
                      <h4>#{transferState.selectedNFT.certificateId}</h4>
                      <p>{transferState.selectedNFT.title}</p>
                      <span>{transferState.selectedNFT.issuer}</span>
                    </div>
                  </div>
                  
                  <div className="transfer-arrow">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M16.01 11H4v2h12.01v3L20 12l-3.99-4z"/>
                    </svg>
                  </div>
                  
                  <div className="summary-recipient">
                    <div className="recipient-icon">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M21 7h-2V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v2H3a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1zM7 5h10v2H7V5zm12 13H5V9h14v9z"/>
                        <circle cx="16" cy="13" r="2"/>
                      </svg>
                    </div>
                    <div className="recipient-info">
                      <h4>New Owner</h4>
                      <p className="mono">{transferState.recipientAddress}</p>
                    </div>
                  </div>
                </div>

                <div className="confirmation-details">
                  <h4>Transaction Details</h4>
                  <div className="detail-list">
                    <div className="detail-row">
                      <span>Certificate:</span>
                      <span>#{transferState.selectedNFT.certificateId} - {transferState.selectedNFT.title}</span>
                    </div>
                    <div className="detail-row">
                      <span>From:</span>
                      <span className="mono">{publicKey?.toString()}</span>
                    </div>
                    <div className="detail-row">
                      <span>To:</span>
                      <span className="mono">{transferState.recipientAddress}</span>
                    </div>
                    <div className="detail-row">
                      <span>Platform Fee:</span>
                      <span>
                        {transferState.estimatedCosts 
                          ? `${transferState.estimatedCosts.costInSOL.toFixed(6)} SOL` 
                          : `${transferState.platformFee} SOL`}
                      </span>
                    </div>
                    {transferState.estimatedCosts && (
                      <div className="detail-row">
                        <span>Estimated Gas:</span>
                        <span>{(transferState.estimatedCosts.estimatedGasFee / 1000000000).toFixed(6)} SOL</span>
                      </div>
                    )}
                    <div className="detail-row total">
                      <span>Total Cost:</span>
                      <span className="highlight">
                        {transferState.estimatedCosts 
                          ? `~${transferState.estimatedCosts.costInSOL.toFixed(6)} SOL` 
                          : `~${transferState.platformFee} SOL`}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="warning-message">
                  <div className="warning-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                    </svg>
                  </div>
                  <div className="warning-content">
                    <h5>Important Notice</h5>
                    <p>This action cannot be undone. The NFT ownership will be permanently transferred to the recipient address. Please verify the recipient address is correct before proceeding.</p>
                  </div>
                </div>

                {/* Real-time validation warnings */}
                {transferState.validationErrors.length > 0 && (
                  <div className="validation-warnings">
                    <h5>Validation Warnings:</h5>
                    <ul>
                      {transferState.validationErrors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              
              <div className="modal-actions">
                <button 
                  className="btn btn-secondary" 
                  onClick={handleCancelTransfer}
                  type="button"
                  disabled={transferState.isTransferring}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn-primary" 
                  onClick={handleConfirmTransfer}
                  type="button"
                  disabled={transferState.isTransferring || transferState.validationErrors.length > 0}
                >
                  {transferState.isTransferring ? (
                    <>
                      <div className="loading-spinner small"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M16.01 11H4v2h12.01v3L20 12l-3.99-4z"/>
                      </svg>
                      Confirm Transfer
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default TransferNFT