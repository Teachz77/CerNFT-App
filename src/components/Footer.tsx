import React from 'react'
import './Footer.css'

const Footer: React.FC = () => {
const currentYear = new Date().getFullYear()

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-content">
          
          {/* Company Info */}
          <div className="footer-section">
            <div className="footer-logo">
              <div className="logo-icon">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <circle cx="16" cy="16" r="16" fill="url(#footerGradient)" />
                  <path 
                    d="M10 12h12l-2 8H8l2-8z" 
                    fill="white" 
                    fillOpacity="0.9"
                  />
                  <defs>
                    <linearGradient id="footerGradient" x1="0" y1="0" x2="1" y2="1">
                      <stop stopColor="#9945FF" />
                      <stop offset="1" stopColor="#14F195" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <span className="logo-text">CertNFT</span>
            </div>
            <p className="footer-description">
              Secure your digital certificates with blockchain technology. 
              Transform your credentials into verifiable NFTs on the Solana network.
            </p>
          </div>

        </div>

        {/* Footer Bottom */}
        <div className="footer-bottom">
          <div className="footer-bottom-content">
            <div className="footer-legal">
              <span>&copy; {currentYear} CertNFT. All rights reserved.</span>
              <div className="legal-links">
                <a href="#">Privacy Policy</a>
                <a href="#">Terms of Service</a>
                <a href="#">Cookie Policy</a>
              </div>
            </div>
            <div className="footer-built-on">
              <span>Built on</span>
              <div className="solana-badge">
                <div className="solana-logo-small"></div>
                <span>Solana</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer