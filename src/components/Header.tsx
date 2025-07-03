import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import './Header.css'

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const location = useLocation()

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  const handleMenuClick = () => {
    setIsMenuOpen(false)
  }

  // Close mobile menu when wallet modal opens
  useEffect(() => {
    const handleWalletModalOpen = () => {
      setIsMenuOpen(false)
    }

    const walletButton = document.querySelector('.wallet-adapter-button')
    if (walletButton) {
      walletButton.addEventListener('click', handleWalletModalOpen)
    }

    return () => {
      if (walletButton) {
        walletButton.removeEventListener('click', handleWalletModalOpen)
      }
    }
  }, [])

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      const mobileMenu = document.querySelector('.mobile-menu')
      const menuToggle = document.querySelector('.mobile-menu-toggle')
      
      if (isMenuOpen && 
          mobileMenu && 
          !mobileMenu.contains(target) && 
          !menuToggle?.contains(target)) {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isMenuOpen])

  const menuItems = [
    { id: 'home', label: 'Home', path: '/' },
    { id: 'create-nft', label: 'Create NFT', path: '/create-nft' },
    { id: 'verify-nft', label: 'Verify NFT', path: '/verify-nft' },
    { id: 'transfer-nft', label: 'Transfer NFT', path: '/transfer-nft' },
    { id: 'collection', label: 'Collection', path: '/collection' }
  ]

  return (
    <header className="header">
      <div className="container">
        <nav className="nav">
          {/* Logo */}
          <Link to="/" className="nav-logo">
            <div className="logo-icon">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="16" fill="url(#gradient)" />
                <path 
                  d="M10 12h12l-2 8H8l2-8z" 
                  fill="white" 
                  fillOpacity="0.9"
                />
                <defs>
                  <linearGradient id="gradient" x1="0" y1="0" x2="1" y2="1">
                    <stop stopColor="#9945FF" />
                    <stop offset="1" stopColor="#14F195" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <span className="logo-text">CertNFT</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="nav-links">
            {menuItems.map((item) => (
              <Link 
                key={item.id}
                to={item.path} 
                className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Desktop Wallet Connection */}
          <div className="nav-actions">
            <WalletMultiButton />
          </div>

          {/* Mobile Actions: Wallet + Menu Toggle */}
          <div className="mobile-actions">
            <div className="mobile-wallet">
              <WalletMultiButton />
            </div>
            <button 
              className="mobile-menu-toggle"
              onClick={toggleMenu}
              aria-label="Toggle menu"
            >
              <span className={`hamburger ${isMenuOpen ? 'active' : ''}`}>
                <span></span>
              </span>
            </button>
          </div>
        </nav>

        {/* Mobile Menu */}
        <div className={`mobile-menu ${isMenuOpen ? 'active' : ''}`}>
          <div className="mobile-menu-links">
            {menuItems.map((item) => (
              <Link 
                key={item.id}
                to={item.path} 
                className={`mobile-nav-link ${location.pathname === item.path ? 'active' : ''}`}
                onClick={handleMenuClick}
              >
                <div className="mobile-nav-item">
                  <span className="mobile-nav-icon">
                    {item.id === 'home' && (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
                      </svg>
                    )}
                    {item.id === 'create-nft' && (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                      </svg>
                    )}
                    {item.id === 'verify-nft' && (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
                        <path d="M10 12l2 2 4-4" stroke="white" strokeWidth="2" fill="none"/>
                      </svg>
                    )}
                    {item.id === 'transfer-nft' && (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M16.01 11H4v2h12.01v3L20 12l-3.99-4z"/>
                      </svg>
                    )}
                    {item.id === 'collection' && (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z"/>
                      </svg>
                    )}
                  </span>
                  <span className="mobile-nav-label">{item.label}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile Menu Backdrop */}
      {isMenuOpen && (
        <div 
          className={`mobile-menu-backdrop ${isMenuOpen ? 'active' : ''}`} 
          onClick={() => setIsMenuOpen(false)} 
        />
      )}
    </header>
  )
}

export default Header