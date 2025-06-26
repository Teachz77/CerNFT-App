import React, { useMemo, ReactNode } from 'react'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets'
import { clusterApiUrl } from '@solana/web3.js'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'

// Import default styles
import '@solana/wallet-adapter-react-ui/styles.css'

interface WalletContextProps {
  children: ReactNode
}

const WalletContext: React.FC<WalletContextProps> = ({ children }) => {
  // Set network to devnet for development
  const network = WalletAdapterNetwork.Devnet
  
  // Get RPC endpoint for the network
  const endpoint = useMemo(() => clusterApiUrl(network), [network])
  
  // Initialize wallet adapters
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  )

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}

export default WalletContext