import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { 
  getProviderReadonly,
  fetchUserNFTs, 
  isProgramInitialized,
  BlockchainNFT,
  debugProgramState,
  getFreshProgramState
} from '../services/blockchain'

export interface CertificateNFT {
  certificateId: number
  title: string
  description: string
  issuer: string
  recipient: string
  issueDate: string
  isVerified: boolean
  transferCount: number
  ipfsUri: string
  metadataUri: string
  imagePreview?: string
  owner: string
  isActive: boolean
  transactionSignature?: string
  creator: string
  createdAt: string
  fileHash?: string
}

export interface NFTCreationData {
  title: string
  description: string
  ipfsUri: string
  issuerName: string
  recipientName: string
  file: File
  fileHash: string
  metadataUri: string
  imagePreview?: string | null
}

interface NFTContextType {
  nftCollection: CertificateNFT[]
  addNFT: (nftData: NFTCreationData, transactionResult: any) => void
  updateNFT: (certificateId: number, updates: Partial<CertificateNFT>) => void
  removeNFT: (certificateId: number) => void
  getNFTById: (certificateId: number) => CertificateNFT | undefined
  getUserNFTs: () => CertificateNFT[]
  refreshCollection: (forceFromBlockchain?: boolean) => Promise<void>
  clearCollection: () => void
  debugBlockchainState: () => Promise<void>
  isLoading: boolean
  lastSyncTime: Date | null
  syncStatus: 'idle' | 'syncing' | 'success' | 'error'
  stats: {
    totalNFTs: number
    verifiedNFTs: number
    totalTransfers: number
    uniqueIssuers: number
  }
}

const NFTContext = createContext<NFTContextType | undefined>(undefined)

export const useNFT = () => {
  const context = useContext(NFTContext)
  if (context === undefined) {
    throw new Error('useNFT must be used within a NFTProvider')
  }
  return context
}

interface NFTProviderProps {
  children: ReactNode
}

export const NFTProvider: React.FC<NFTProviderProps> = ({ children }) => {
  const { publicKey, connected } = useWallet()
  const [nftCollection, setNftCollection] = useState<CertificateNFT[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle')
  const [lastKnownCertificateCount, setLastKnownCertificateCount] = useState<number>(0)

  // Storage keys for persisting NFTs
  const STORAGE_KEY = `solana_nft_collection_${publicKey?.toString() || 'default'}`
  const SYNC_TIME_KEY = `solana_nft_sync_time_${publicKey?.toString() || 'default'}`
  const CERT_COUNT_KEY = `solana_cert_count_${publicKey?.toString() || 'default'}`

  // Load NFTs from localStorage on component mount
  useEffect(() => {
    if (connected && publicKey) {
      loadNFTsFromStorage()
      loadLastSyncTime()
      loadLastKnownCertificateCount()
      
      // Delay initial sync to allow UI to load first
      setTimeout(() => {
        smartSyncWithBlockchain()
      }, 1500)
    } else {
      // Clear data when wallet disconnected
      setNftCollection([])
      setLastSyncTime(null)
      setSyncStatus('idle')
      setLastKnownCertificateCount(0)
    }
  }, [connected, publicKey])

  // Save NFTs to localStorage whenever collection changes
  useEffect(() => {
    if (connected && publicKey && nftCollection.length >= 0) {
      saveNFTsToStorage()
    }
  }, [nftCollection, connected, publicKey])

  const loadNFTsFromStorage = () => {
    try {
      const storedNFTs = localStorage.getItem(STORAGE_KEY)
      if (storedNFTs) {
        const parsedNFTs = JSON.parse(storedNFTs) as CertificateNFT[]
        console.log('📱 Loaded NFTs from localStorage:', parsedNFTs.length)
        setNftCollection(parsedNFTs)
      } else {
        console.log('📱 No NFTs found in localStorage')
        setNftCollection([])
      }
    } catch (error) {
      console.error('❌ Error loading NFTs from storage:', error)
      setNftCollection([])
    }
  }

  const saveNFTsToStorage = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nftCollection))
      console.log('💾 Saved NFTs to localStorage:', nftCollection.length)
    } catch (error) {
      console.error('❌ Error saving NFTs to storage:', error)
    }
  }

  const loadLastSyncTime = () => {
    try {
      const syncTime = localStorage.getItem(SYNC_TIME_KEY)
      if (syncTime) {
        setLastSyncTime(new Date(syncTime))
      }
    } catch (error) {
      console.error('❌ Error loading sync time:', error)
    }
  }

  const saveLastSyncTime = (time: Date) => {
    try {
      localStorage.setItem(SYNC_TIME_KEY, time.toISOString())
      setLastSyncTime(time)
    } catch (error) {
      console.error('❌ Error saving sync time:', error)
    }
  }

  const loadLastKnownCertificateCount = () => {
    try {
      const count = localStorage.getItem(CERT_COUNT_KEY)
      if (count) {
        setLastKnownCertificateCount(parseInt(count, 10))
      }
    } catch (error) {
      console.error('❌ Error loading last known certificate count:', error)
    }
  }

  const saveLastKnownCertificateCount = (count: number) => {
    try {
      localStorage.setItem(CERT_COUNT_KEY, count.toString())
      setLastKnownCertificateCount(count)
    } catch (error) {
      console.error('❌ Error saving last known certificate count:', error)
    }
  }

  // Detect blockchain reset by comparing certificate counts
  const detectBlockchainReset = async (program: any): Promise<boolean> => {
    try {
      const state = await getFreshProgramState(program)
      const currentCertificateCount = state.certificateCount
      
      console.log('🔍 Checking for blockchain reset:')
      console.log('  - Current blockchain count:', currentCertificateCount)
      console.log('  - Last known count:', lastKnownCertificateCount)
      console.log('  - Local NFTs count:', nftCollection.length)
      
      // If blockchain count is 0 but we have local NFTs and previously had a higher count
      if (currentCertificateCount === 0 && 
          lastKnownCertificateCount > 0 && 
          nftCollection.length > 0) {
        console.log('🚨 BLOCKCHAIN RESET DETECTED!')
        console.log('  - Blockchain certificate count went from', lastKnownCertificateCount, 'to 0')
        console.log('  - LocalStorage still has', nftCollection.length, 'NFTs')
        return true
      }
      
      // If current count is significantly less than what we had before
      if (currentCertificateCount > 0 && 
          lastKnownCertificateCount > currentCertificateCount &&
          (lastKnownCertificateCount - currentCertificateCount) >= nftCollection.length) {
        console.log('🚨 POSSIBLE BLOCKCHAIN RESET DETECTED!')
        console.log('  - Certificate count dropped significantly')
        return true
      }
      
      // Update the last known count if it's higher
      if (currentCertificateCount > lastKnownCertificateCount) {
        saveLastKnownCertificateCount(currentCertificateCount)
      }
      
      return false
    } catch (error) {
      console.error('❌ Error detecting blockchain reset:', error)
      return false
    }
  }

  // Clear all local data when blockchain reset is detected
  const handleBlockchainReset = () => {
    console.log('🧹 Handling blockchain reset - clearing local data...')
    
    // Clear localStorage
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(SYNC_TIME_KEY)
    localStorage.removeItem(CERT_COUNT_KEY)
    
    // Reset state
    setNftCollection([])
    setLastSyncTime(null)
    setLastKnownCertificateCount(0)
    
    console.log('✅ Local data cleared due to blockchain reset')
  }

  // Convert blockchain NFT to app NFT format
  const convertBlockchainToAppNFT = (blockchainNFT: BlockchainNFT, existingNFT?: CertificateNFT): CertificateNFT => {
    return {
      certificateId: blockchainNFT.certificateId,
      title: blockchainNFT.title,
      description: blockchainNFT.description,
      issuer: blockchainNFT.issuerName,
      recipient: blockchainNFT.recipientName,
      issueDate: new Date(blockchainNFT.issueDate * 1000).toISOString().split('T')[0],
      isVerified: blockchainNFT.statusVerify,
      transferCount: blockchainNFT.transferCount,
      ipfsUri: blockchainNFT.ipfsUri,
      metadataUri: existingNFT?.metadataUri || blockchainNFT.ipfsUri,
      imagePreview: existingNFT?.imagePreview,
      owner: blockchainNFT.owner,
      isActive: blockchainNFT.isActive,
      transactionSignature: existingNFT?.transactionSignature,
      creator: blockchainNFT.creator,
      createdAt: existingNFT?.createdAt || new Date(blockchainNFT.issueDate * 1000).toISOString(),
      fileHash: existingNFT?.fileHash
    }
  }

  // Smart sync - combines localStorage with blockchain data intelligently
  const smartSyncWithBlockchain = async () => {
    if (!connected || !publicKey) return
    
    try {
      setIsLoading(true)
      setSyncStatus('syncing')
      console.log('🔄 Starting smart sync with blockchain...')
      
      const program = getProviderReadonly()
      
      // Check if program is initialized
      const programInitialized = await isProgramInitialized(program)
      if (!programInitialized) {
        console.log('⚠️ Program not initialized - keeping localStorage data')
        setSyncStatus('error')
        return
      }
      
      // Check for blockchain reset BEFORE fetching NFTs
      const isReset = await detectBlockchainReset(program)
      if (isReset) {
        handleBlockchainReset()
        setSyncStatus('success')
        saveLastSyncTime(new Date())
        return
      }
      
      // Fetch NFTs from blockchain for this user
      const blockchainNFTs = await fetchUserNFTs(program, publicKey)
      console.log(`📦 Found ${blockchainNFTs.length} NFTs on blockchain for user`)
      
      // Update last known certificate count after successful fetch
      const state = await getFreshProgramState(program)
      saveLastKnownCertificateCount(state.certificateCount)
      
      // Convert blockchain NFTs to app format
      const convertedNFTs: CertificateNFT[] = blockchainNFTs.map(nft => {
        // Find additional data from localStorage
        const existingNFT = nftCollection.find(existing => existing.certificateId === nft.certificateId)
        return convertBlockchainToAppNFT(nft, existingNFT)
      })
      
      // Smart merge strategy: combine blockchain data with localStorage
      const currentLocalNFTs = nftCollection
      const mergedNFTs: CertificateNFT[] = []
      
      // Add all NFTs from blockchain (source of truth for ownership)
      convertedNFTs.forEach(blockchainNFT => {
        mergedNFTs.push(blockchainNFT)
      })
      
      // Add NFTs from localStorage that are not on blockchain yet
      // (maybe newly created and not yet synced)
      currentLocalNFTs.forEach(localNFT => {
        const existsInBlockchain = convertedNFTs.some(
          blockchainNFT => blockchainNFT.certificateId === localNFT.certificateId
        )
        
        if (!existsInBlockchain) {
          // Check if this NFT is still owned by current user
          if (localNFT.owner === publicKey.toString()) {
            console.log(`📋 Keeping localStorage NFT #${localNFT.certificateId} (not yet on blockchain)`)
            mergedNFTs.push(localNFT)
          } else {
            console.log(`🗑️ Removing localStorage NFT #${localNFT.certificateId} (no longer owned)`)
          }
        }
      })
      
      // Sort by certificate ID descending (newest first)
      mergedNFTs.sort((a, b) => b.certificateId - a.certificateId)
      
      // Update collection with merged data
      setNftCollection(mergedNFTs)
      saveLastSyncTime(new Date())
      setSyncStatus('success')
      console.log(`✅ Smart sync complete: ${mergedNFTs.length} total NFTs`)
      
    } catch (error) {
      console.error('❌ Error in smart sync with blockchain:', error)
      console.log('📱 Keeping localStorage data due to sync error')
      setSyncStatus('error')
    } finally {
      setIsLoading(false)
    }
  }

  // Force refresh - gets pure data from blockchain
  const forceRefreshFromBlockchain = async () => {
    if (!connected || !publicKey) return
    
    try {
      setIsLoading(true)
      setSyncStatus('syncing')
      console.log('🔄 Force refreshing from blockchain...')
      
      const program = getProviderReadonly()
      
      // Check program initialization
      const programInitialized = await isProgramInitialized(program)
      if (!programInitialized) {
        console.log('⚠️ Program not initialized - cannot force refresh')
        setSyncStatus('error')
        return
      }
      
      // Check for blockchain reset
      const isReset = await detectBlockchainReset(program)
      if (isReset) {
        handleBlockchainReset()
        setSyncStatus('success')
        saveLastSyncTime(new Date())
        return
      }
      
      const blockchainNFTs = await fetchUserNFTs(program, publicKey)
      
      // Update last known certificate count
      const state = await getFreshProgramState(program)
      saveLastKnownCertificateCount(state.certificateCount)
      
      const convertedNFTs: CertificateNFT[] = blockchainNFTs.map(nft => ({
        certificateId: nft.certificateId,
        title: nft.title,
        description: nft.description,
        issuer: nft.issuerName,
        recipient: nft.recipientName,
        issueDate: new Date(nft.issueDate * 1000).toISOString().split('T')[0],
        isVerified: nft.statusVerify,
        transferCount: nft.transferCount,
        ipfsUri: nft.ipfsUri,
        metadataUri: nft.ipfsUri, // Reset to blockchain data
        imagePreview: undefined, // Reset preview
        owner: nft.owner,
        isActive: nft.isActive,
        transactionSignature: undefined, // Reset transaction signature
        creator: nft.creator,
        createdAt: new Date(nft.issueDate * 1000).toISOString(),
        fileHash: undefined // Reset file hash
      }))
      
      // Sort by certificate ID descending
      convertedNFTs.sort((a, b) => b.certificateId - a.certificateId)
      
      // Overwrite with pure blockchain data
      setNftCollection(convertedNFTs)
      saveLastSyncTime(new Date())
      setSyncStatus('success')
      console.log(`🔄 Force refresh complete: ${convertedNFTs.length} NFTs from blockchain`)
      
    } catch (error) {
      console.error('❌ Error force refreshing:', error)
      setSyncStatus('error')
    } finally {
      setIsLoading(false)
    }
  }

  // Public refresh function with options
  const refreshCollection = async (forceFromBlockchain = false) => {
    console.log(`🔄 Manual refresh requested (force: ${forceFromBlockchain})`)
    
    if (forceFromBlockchain) {
      await forceRefreshFromBlockchain()
    } else {
      await smartSyncWithBlockchain()
    }
  }

  // Add new NFT to collection
  const addNFT = (nftData: NFTCreationData, transactionResult: any) => {
    const newNFT: CertificateNFT = {
      certificateId: transactionResult.certificateId,
      title: nftData.title,
      description: nftData.description,
      issuer: nftData.issuerName,
      recipient: nftData.recipientName,
      issueDate: new Date().toISOString().split('T')[0],
      isVerified: false, // Default to unverified when created
      transferCount: 0,
      ipfsUri: nftData.ipfsUri,
      metadataUri: nftData.metadataUri,
      imagePreview: nftData.imagePreview || undefined,
      owner: publicKey?.toString() || '',
      isActive: true,
      transactionSignature: transactionResult.transactionSignature,
      creator: publicKey?.toString() || '',
      createdAt: new Date().toISOString(),
      fileHash: nftData.fileHash
    }

    // Add to collection (maintain existing NFTs + add new one)
    setNftCollection(prev => {
      // Check if NFT already exists to avoid duplicates
      const exists = prev.find(nft => nft.certificateId === newNFT.certificateId)
      if (exists) {
        console.log('🔄 NFT already exists in collection, updating...')
        const updated = prev.map(nft => nft.certificateId === newNFT.certificateId ? newNFT : nft)
        return updated.sort((a, b) => b.certificateId - a.certificateId)
      } else {
        console.log('➕ Adding new NFT to collection')
        const newCollection = [newNFT, ...prev]
        return newCollection.sort((a, b) => b.certificateId - a.certificateId)
      }
    })
    
    // Update last known certificate count since we added a new one
    setLastKnownCertificateCount(prev => Math.max(prev, transactionResult.certificateId))
    
    console.log('✅ NFT added to collection:', {
      id: newNFT.certificateId,
      title: newNFT.title,
      owner: newNFT.owner.slice(0, 8) + '...'
    })
  }

  // Update existing NFT
  const updateNFT = (certificateId: number, updates: Partial<CertificateNFT>) => {
    setNftCollection(prev => 
      prev.map(nft => 
        nft.certificateId === certificateId 
          ? { ...nft, ...updates }
          : nft
      )
    )
    
    console.log(`🔄 Updated NFT #${certificateId}:`, updates)
  }

  // Remove NFT from collection
  const removeNFT = (certificateId: number) => {
    setNftCollection(prev => prev.filter(nft => nft.certificateId !== certificateId))
    console.log(`🗑️ Removed NFT #${certificateId} from collection`)
  }

  // Get NFT by ID
  const getNFTById = (certificateId: number): CertificateNFT | undefined => {
    return nftCollection.find(nft => nft.certificateId === certificateId)
  }

  // Get all NFTs for current user
  const getUserNFTs = (): CertificateNFT[] => {
    if (!publicKey) return []
    return nftCollection.filter(nft => nft.owner === publicKey.toString())
  }

  // Clear all collection data (for testing/development)
  const clearCollection = () => {
    setNftCollection([])
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(SYNC_TIME_KEY)
    localStorage.removeItem(CERT_COUNT_KEY)
    setLastSyncTime(null)
    setLastKnownCertificateCount(0)
    setSyncStatus('idle')
    console.log('🗑️ Collection cleared')
  }

  // Debug blockchain state (for development)
  const debugBlockchainState = async () => {
    if (!connected || !publicKey) {
      console.log('🔍 Debug: Wallet not connected')
      return
    }
    
    try {
      const program = getProviderReadonly()
      const debugInfo = await debugProgramState(program)
      console.log('🔍 Debug blockchain state:', debugInfo)
      
      if (debugInfo.initialized) {
        const userNFTs = await fetchUserNFTs(program, publicKey)
        console.log('🔍 Debug user NFTs from blockchain:', userNFTs)
        
        // Debug reset detection
        const isReset = await detectBlockchainReset(program)
        console.log('🔍 Debug reset detection:', isReset)
      }
      
    } catch (error) {
      console.log('🔍 Debug error:', error)
    }
  }

  // Calculate collection statistics
  const userNFTs = getUserNFTs()
  const stats = {
    totalNFTs: userNFTs.length,
    verifiedNFTs: userNFTs.filter(nft => nft.isVerified).length,
    totalTransfers: userNFTs.reduce((sum, nft) => sum + nft.transferCount, 0),
    uniqueIssuers: new Set(userNFTs.map(nft => nft.issuer)).size
  }

  const value: NFTContextType = {
    nftCollection: getUserNFTs(),
    addNFT,
    updateNFT,
    removeNFT,
    getNFTById,
    getUserNFTs,
    refreshCollection,
    clearCollection,
    debugBlockchainState,
    isLoading,
    lastSyncTime,
    syncStatus,
    stats
  }

  return (
    <NFTContext.Provider value={value}>
      {children}
    </NFTContext.Provider>
  )
}

export default NFTProvider