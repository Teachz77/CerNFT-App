import React, { useState, useMemo } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { useNFT, CertificateNFT } from '../context/NFTContext'
import './Collection.css'

interface FilterOptions {
  verified: 'all' | 'verified' | 'unverified'
  issuer: string
  sortBy: 'newest' | 'oldest' | 'title' | 'issuer'
  viewMode: 'grid' | 'list'
}

const Collection: React.FC = () => {
  const { connected } = useWallet()
  const {
    nftCollection,
    stats,
    refreshCollection,
    isLoading: contextLoading,
    lastSyncTime,
    syncStatus,
    updateNFT,
    getNFTById,
  } = useNFT()

  const [filters, setFilters] = useState<FilterOptions>({
    verified: 'all',
    issuer: '',
    sortBy: 'newest',
    viewMode: 'grid'
  })

  const [selectedNFT, setSelectedNFT] = useState<CertificateNFT | null>(null)
  const [showNFTModal, setShowNFTModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Get unique issuers for filter dropdown
  const uniqueIssuers = useMemo(() => {
    return Array.from(new Set(nftCollection.map(nft => nft.issuer))).sort()
  }, [nftCollection])

  // Filter and sort NFTs
  const filteredNFTs = useMemo(() => {
    return nftCollection
      .filter(nft => {
        // Filter by verification status
        if (filters.verified === 'verified' && !nft.isVerified) return false
        if (filters.verified === 'unverified' && nft.isVerified) return false

        // Filter by issuer
        if (filters.issuer && nft.issuer !== filters.issuer) return false

        // Filter by search query
        if (searchQuery) {
          const query = searchQuery.toLowerCase()
          return (
            nft.title.toLowerCase().includes(query) ||
            nft.issuer.toLowerCase().includes(query) ||
            nft.description.toLowerCase().includes(query) ||
            nft.certificateId.toString().includes(query)
          )
        }

        return true
      })
      .sort((a, b) => {
        switch (filters.sortBy) {
          case 'newest':
            return new Date(b.createdAt || b.issueDate).getTime() - new Date(a.createdAt || a.issueDate).getTime()
          case 'oldest':
            return new Date(a.createdAt || a.issueDate).getTime() - new Date(b.createdAt || b.issueDate).getTime()
          case 'title':
            return a.title.localeCompare(b.title)
          case 'issuer':
            return a.issuer.localeCompare(b.issuer)
          default:
            return 0
        }
      })
  }, [nftCollection, filters, searchQuery])

  const handleFilterChange = (key: keyof FilterOptions, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const handleNFTClick = (nft: CertificateNFT) => {
    setSelectedNFT(nft)
    setShowNFTModal(true)
  }

  const handleCloseModal = () => {
    setShowNFTModal(false)
    setSelectedNFT(null)
  }

  const handleRefresh = async () => {
    await refreshCollection(false) // Smart sync by default
  }

  const resetFilters = () => {
    setFilters({
      verified: 'all',
      issuer: '',
      sortBy: 'newest',
      viewMode: 'grid'
    })
    setSearchQuery('')
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatLastSyncTime = (date: Date | null) => {
    if (!date) return 'Never'

    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffInSeconds < 60) return 'Just now'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`
    return formatDate(date.toISOString())
  }

  const handleVerifyNFT = async (certificateId: number) => {
  try {
    // Dapatkan NFT yang akan diverifikasi untuk mempertahankan semua data
    const nftToVerify = getNFTById(certificateId)
    if (!nftToVerify) {
      alert('❌ Certificate not found')
      return
    }

    // Update dengan mempertahankan semua data existing
    const updatedData: Partial<CertificateNFT> = {
      isVerified: true,
      // Pastikan data penting tidak hilang
      transactionSignature: nftToVerify.transactionSignature,
      fileHash: nftToVerify.fileHash,
      metadataUri: nftToVerify.metadataUri,
      imagePreview: nftToVerify.imagePreview,
      ipfsUri: nftToVerify.ipfsUri,
      createdAt: nftToVerify.createdAt
    }

    // Update NFT dengan data yang aman
    updateNFT(certificateId, updatedData)

    // Update selected NFT jika ini yang sedang ditampilkan
    if (selectedNFT && selectedNFT.certificateId === certificateId) {
      setSelectedNFT(prev => prev ? { 
        ...prev, 
        ...updatedData
      } : null)
    }

    // Show success message
    alert(`✅ Certificate #${certificateId} has been verified!`)

  } catch (error) {
    console.error('❌ Error verifying certificate:', error)
    alert('❌ Error verifying certificate. Please try again.')
  }
  }

  const getSyncStatusIcon = () => {
    switch (syncStatus) {
      case 'syncing':
        return <div className="loading-spinner small"></div>
      case 'success':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#14F195' }}>
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
        )
      case 'error':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#dc3545' }}>
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        )
      default:
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#A8A8A8' }}>
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
        )
    }
  }

  if (!connected) {
    return (
      <div className="collection-page">
        <div className="container">
          <div className="wallet-connect-prompt">
            <div className="prompt-content">
              <div className="prompt-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z"/>
                </svg>
              </div>
              <h2>Connect Your Wallet</h2>
              <p>Connect your Solana wallet to view your certificate NFT collection and manage your digital credentials.</p>
              <WalletMultiButton />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="collection-page">
      <div className="container">
        {/* Page Header */}
        <div className="page-header">
          <div className="header-content">
            <h1>My Certificate Collection</h1>
            <p>Manage and view your verified digital certificates stored on the Solana blockchain</p>

            {/* Sync Status Info */}
            <div className="sync-status-info">
              <div className="sync-status">
                {getSyncStatusIcon()}
                <span className="sync-text">
                  Last sync: {formatLastSyncTime(lastSyncTime)}
                </span>
              </div>
              {syncStatus === 'error' && (
                <span className="sync-error-text">
                  Unable to sync with blockchain
                </span>
              )}
            </div>
          </div>

          <div className="header-actions">
            <button
              className="btn btn-secondary"
              onClick={handleRefresh}
              disabled={contextLoading}
              title="Refresh collection from blockchain"
            >
              {contextLoading ? (
                <>
                  <div className="loading-spinner small"></div>
                  Syncing...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                  </svg>
                  Refresh
                </>
              )}
            </button>

            <a href="/create-nft" className="btn btn-primary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
              </svg>
              Create NFT
            </a>
          </div>
        </div>

        {/* Collection Stats */}
        <div className="collection-stats">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z"/>
                </svg>
              </div>
              <div className="stat-content">
                <h3>{stats.totalNFTs}</h3>
                <p>Total NFTs</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon verified">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
                  <path d="M10 12l2 2 4-4" stroke="white" strokeWidth="2" fill="none"/>
                </svg>
              </div>
              <div className="stat-content">
                <h3>{stats.verifiedNFTs}</h3>
                <p>Verified</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16.01 11H4v2h12.01v3L20 12l-3.99-4z"/>
                </svg>
              </div>
              <div className="stat-content">
                <h3>{stats.totalTransfers}</h3>
                <p>Total Transfers</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              <div className="stat-content">
                <h3>{stats.uniqueIssuers}</h3>
                <p>Issuers</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="collection-controls">
          <div className="search-section">
            <div className="search-input-container">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="search-icon">
                <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
              </svg>
              <input
                type="text"
                placeholder="Search certificates by title, issuer, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              {searchQuery && (
                <button
                  className="clear-search"
                  onClick={() => setSearchQuery('')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                  </svg>
                </button>
              )}
            </div>
          </div>

          <div className="filter-section">
            <div className="filter-group">
              <label>Status:</label>
              <select
                value={filters.verified}
                onChange={(e) => handleFilterChange('verified', e.target.value)}
                className="filter-select"
              >
                <option value="all">All</option>
                <option value="verified">Verified</option>
                <option value="unverified">Unverified</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Issuer:</label>
              <select
                value={filters.issuer}
                onChange={(e) => handleFilterChange('issuer', e.target.value)}
                className="filter-select"
              >
                <option value="">All Issuers</option>
                {uniqueIssuers.map(issuer => (
                  <option key={issuer} value={issuer}>{issuer}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Sort by:</label>
              <select
                value={filters.sortBy}
                onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                className="filter-select"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="title">Title A-Z</option>
                <option value="issuer">Issuer A-Z</option>
              </select>
            </div>

            <button
              className="btn btn-secondary btn-small"
              onClick={resetFilters}
            >
              Reset Filters
            </button>
          </div>

          <div className="view-controls">
            <div className="view-mode-toggle">
              <button
                className={`view-btn ${filters.viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => handleFilterChange('viewMode', 'grid')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M4 11h5V5H4v6zm0 7h5v-6H4v6zm6 0h5v-6h-5v6zm6 0h5v-6h-5v6zm-6-7h5V5h-5v6zm6-6v6h5V5h-5z"/>
                </svg>
                Grid
              </button>
              <button
                className={`view-btn ${filters.viewMode === 'list' ? 'active' : ''}`}
                onClick={() => handleFilterChange('viewMode', 'list')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
                </svg>
                List
              </button>
            </div>
          </div>
        </div>

        {/* Results Summary */}
        <div className="results-summary">
          <p>
            Showing {filteredNFTs.length} of {stats.totalNFTs} certificates
            {searchQuery && <span> for "{searchQuery}"</span>}
          </p>
          {contextLoading && (
            <div className="loading-indicator">
              <div className="loading-spinner small"></div>
              <span>Syncing with blockchain...</span>
            </div>
          )}
        </div>

        {/* NFT Collection */}
        {filteredNFTs.length === 0 ? (
          <div className="empty-collection">
            <div className="empty-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
              </svg>
            </div>
            <h3>No certificates found</h3>
            <p>
              {searchQuery || filters.verified !== 'all' || filters.issuer
                ? 'Try adjusting your search or filter criteria.'
                : 'You don\'t have any certificate NFTs yet.'}
            </p>
            {(!searchQuery && filters.verified === 'all' && !filters.issuer) && (
              <a href="/create-nft" className="btn btn-primary">
                Create Your First Certificate
              </a>
            )}
          </div>
        ) : (
          <div className={`nft-collection ${filters.viewMode}`}>
            {filteredNFTs.map((nft) => (
              <div
                key={nft.certificateId}
                className="nft-item"
                onClick={() => handleNFTClick(nft)}
              >
                {filters.viewMode === 'grid' ? (
                  <>
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
                              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                            </svg>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="nft-info">
                      <h3>#{nft.certificateId}</h3>
                      <h4>{nft.title}</h4>
                      <div className="nft-meta">
                        <span><strong>Issuer:</strong> {nft.issuer}</span>
                        <span><strong>Date:</strong> {formatDate(nft.issueDate)}</span>
                        <span><strong>Transfers:</strong> {nft.transferCount}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="list-image">
                      {nft.imagePreview ? (
                        <img src={nft.imagePreview} alt={nft.title} />
                      ) : (
                        <div className="list-placeholder">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="list-content">
                      <div className="list-header">
                        <div className="list-title">
                          <h3>#{nft.certificateId} - {nft.title}</h3>
                          <div className={`verification-status ${nft.isVerified ? 'verified' : 'unverified'}`}>
                            {nft.isVerified ? (
                              <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
                                  <path d="M10 12l2 2 4-4" stroke="white" strokeWidth="2" fill="none"/>
                                </svg>
                                Verified
                              </>
                            ) : (
                              <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                                </svg>
                                Unverified
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="list-details">
                        <div className="detail-item">
                          <span>Issuer:</span>
                          <span>{nft.issuer}</span>
                        </div>
                        <div className="detail-item">
                          <span>Issue Date:</span>
                          <span>{formatDate(nft.issueDate)}</span>
                        </div>
                        <div className="detail-item">
                          <span>Transfers:</span>
                          <span>{nft.transferCount}</span>
                        </div>
                      </div>
                      <p className="list-description">{nft.description}</p>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* NFT Detail Modal */}
        {showNFTModal && selectedNFT && (
          <div className="modal-overlay" onClick={handleCloseModal}>
            <div className="nft-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Certificate Details</h3>
                <button className="modal-close" onClick={handleCloseModal}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                  </svg>
                </button>
              </div>

              <div className="modal-content">
                <div className="modal-image">
                  {selectedNFT.imagePreview ? (
                    <img src={selectedNFT.imagePreview} alt={selectedNFT.title} />
                  ) : (
                    <div className="modal-placeholder">
                      <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                      </svg>
                    </div>
                  )}
                </div>

                <div className="modal-details">
                  <div className="detail-header">
                    <h4>#{selectedNFT.certificateId} - {selectedNFT.title}</h4>
                    <div className={`verification-badge large ${selectedNFT.isVerified ? 'verified' : 'unverified'}`}>
                      {selectedNFT.isVerified ? (
                        <>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
                            <path d="M10 12l2 2 4-4" stroke="white" strokeWidth="2" fill="none"/>
                          </svg>
                          Verified
                        </>
                      ) : (
                        <>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                          </svg>
                          Unverified
                        </>
                      )}
                    </div>
                  </div>

                  <div className="detail-description">
                    <p>{selectedNFT.description}</p>
                  </div>

                  <div className="detail-grid">
                    <div className="detail-row">
                      <span>Issuer:</span>
                      <span>{selectedNFT.issuer}</span>
                    </div>
                    <div className="detail-row">
                      <span>Recipient:</span>
                      <span>{selectedNFT.recipient}</span>
                    </div>
                    <div className="detail-row">
                      <span>Issue Date:</span>
                      <span>{formatDate(selectedNFT.issueDate)}</span>
                    </div>
                    <div className="detail-row">
                      <span>Transfer Count:</span>
                      <span>{selectedNFT.transferCount}</span>
                    </div>
                    <div className="detail-row">
                      <span>Status:</span>
                      <span>{selectedNFT.isActive ? 'Active' : 'Inactive'}</span>
                    </div>
                    <div className="detail-row">
                      <span>Owner:</span>
                      <span className="mono">{selectedNFT.owner.slice(0, 8)}...{selectedNFT.owner.slice(-8)}</span>
                    </div>
                    <div className="detail-row">
                      <span>Creator:</span>
                      <span className="mono">{selectedNFT.creator.slice(0, 8)}...{selectedNFT.creator.slice(-8)}</span>
                    </div>
                    {selectedNFT.createdAt && (
                      <div className="detail-row">
                        <span>Created:</span>
                        <span>{formatDate(selectedNFT.createdAt)}</span>
                      </div>
                    )}
                    {selectedNFT.fileHash && (
                      <div className="detail-row">
                        <span>File Hash:</span>
                        <span className="mono file-hash">{selectedNFT.fileHash.slice(0, 16)}...</span>
                      </div>
                    )}
                  </div>

                  <div className="modal-links">
                    <a
                      href={selectedNFT.metadataUri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link-btn"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z"/>
                      </svg>
                      View Metadata
                    </a>
                    {selectedNFT.transactionSignature && (
                      <a
                        href={`https://explorer.solana.com/tx/${selectedNFT.transactionSignature}?cluster=localhost`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link-btn"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z"/>
                        </svg>
                        View on Explorer
                      </a>
                    )}
                    <a
                      href="/verify-nft"
                      className="link-btn"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
                        <path d="M10 12l2 2 4-4" stroke="white" strokeWidth="2" fill="none"/>
                      </svg>
                      Verify File
                    </a>
                  </div>
                </div>
              </div>

              <div className="modal-actions">
                {!selectedNFT.isVerified && (
                  <button
                    onClick={() => handleVerifyNFT(selectedNFT.certificateId)}
                    className="btn btn-secondary"
                    title="Mark this certificate as verified (local only)"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
                      <path d="M10 12l2 2 4-4" stroke="white" strokeWidth="2" fill="none"/>
                    </svg>
                    Mark as Verified
                  </button>
                )}
                <a
                  href="/transfer-nft"
                  className="btn btn-primary"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16.01 11H4v2h12.01v3L20 12l-3.99-4z"/>
                  </svg>
                  Transfer NFT
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Collection