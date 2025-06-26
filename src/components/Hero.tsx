import React from 'react'
import { Link } from 'react-router'
import './Hero.css'

const Hero: React.FC = () => {
  return (
    <section className="hero" id="home">
      <div className="hero-background">
        <div className="hero-grid"></div>
        <div className="hero-glow"></div>
      </div>
      
      <div className="container">
        <div className="hero-content">
          <div className="hero-text">
            
            <h1 className="hero-title fade-in-up">
              Secure Your Digital 
              <span className="text-gradient"> Certificates</span>
              <br />
              with NFT Technology
            </h1>
            
            <p className="hero-description fade-in-up">
              Transform your digital certificates into verifiable NFTs on the Solana blockchain. 
              Ensure authenticity, prevent forgery, and enable seamless verification with our 
              decentralized certificate management platform.
            </p>
            

            <div className="hero-actions fade-in-up">
              <Link to="/create-nft" style={{textDecoration: 'none'}}>
                <button className="btn btn-primary btn-large">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                  Get Started
                </button>
              </Link>
            </div>

          </div>
          
          <div className="hero-visual">
            <div className="certificate-preview float">
              <div className="certificate-card">
                <div className="certificate-header">
                  <div className="certificate-badge">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                  </div>
                  <div className="certificate-status">Verified</div>
                </div>
                
                <div className="certificate-content">
                  <h3>Certificate of Completion</h3>
                  <p>Blockchain Development Course</p>
                  <div className="certificate-details">
                    <div className="detail-row">
                      <span>Issued to:</span>
                      <span>John Doe</span>
                    </div>
                    <div className="detail-row">
                      <span>Date:</span>
                      <span>Dec 2024</span>
                    </div>
                    <div className="detail-row">
                      <span>NFT ID:</span>
                      <span className="nft-id">#1234</span>
                    </div>
                  </div>
                </div>
                
                <div className="certificate-footer">
                  <div className="blockchain-badge">
                    <div className="solana-logo"></div>
                    <span>Solana</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="floating-elements">
              <div className="floating-nft floating-nft-1">NFT</div>
              <div className="floating-nft floating-nft-2">🔐</div>
              <div className="floating-nft floating-nft-3">✅</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Hero