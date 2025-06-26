import React from 'react'
import './Features.css'

const Features: React.FC = () => {
  const features = [
    {
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
          <path d="M10 12l2 2 4-4" stroke="white" strokeWidth="2" fill="none"/>
        </svg>
      ),
      title: "Blockchain Security",
      description: "Your certificates are secured by Solana's robust blockchain technology, ensuring immutability and tamper-proof verification.",
      highlight: "99.9% Uptime"
    },
    {
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      ),
      title: "NFT Certification",
      description: "Transform your certificates into unique NFTs, providing digital ownership and easy transferability across wallets.",
      highlight: "Unique Assets"
    },
    {
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      ),
      title: "Instant Verification",
      description: "Verify certificate authenticity in seconds with our blockchain-based verification system. No more manual checks.",
      highlight: "< 3 Seconds"
    },
    {
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
          <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
        </svg>
      ),
      title: "Low Cost Transactions",
      description: "Benefit from Solana's ultra-low transaction fees. Create and transfer certificates without breaking the bank.",
      highlight: "$0.001 Fees"
    },
    {
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
          <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
        </svg>
      ),
      title: "Easy Integration",
      description: "Simple APIs and SDKs to integrate certificate verification into your existing systems and applications.",
      highlight: "5 Min Setup"
    },
    {
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
        </svg>
      ),
      title: "Global Accessibility",
      description: "Access your certificates anywhere, anytime. Our decentralized platform ensures global availability 24/7.",
      highlight: "Worldwide"
    }
  ]

  return (
    <section className="features" id="features">
      <div className="container">
        <div className="features-header">
          <div className="section-badge fade-in-up">
            <span>✨ Features</span>
          </div>
          <h2 className="section-title fade-in-up">
            Why Choose Our Platform?
          </h2>
          <p className="section-description fade-in-up">
            Experience the future of digital certification with blockchain technology.
            Our platform offers unmatched security, transparency, and ease of use.
          </p>
        </div>

        <div className="features-grid">
          {features.map((feature, index) => (
            <div 
              key={index} 
              className="feature-card fade-in-up"
              style={{ animationDelay: `${0.1 * index}s` }}
            >
              <div className="feature-icon">
                <div className="icon-container">
                  {feature.icon}
                </div>
                <div className="feature-highlight">
                  {feature.highlight}
                </div>
              </div>
              
              <div className="feature-content">
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-description">{feature.description}</p>
              </div>
              
              <div className="feature-footer">
                <button className="feature-learn-more">
                  Learn More
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13.025 1l-2.847 2.828 6.176 6.176h-16.354v3.992h16.354l-6.176 6.176 2.847 2.828 10.975-11z"/>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
        
      </div>
    </section>
  )
}

export default Features