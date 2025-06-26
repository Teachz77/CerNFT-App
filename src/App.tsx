import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import NFTProvider from './context/NFTContext'
import './assets/App.css'
import Header from './components/Header'
import Footer from './components/Footer'
import HomePage from './pages/HomePage'
import CreateNFT from './pages/CreateNFT'
import VerifyNFT from './pages/VerifyNFT'
import TransferNFT from './pages/TransferNFT'
import Collection from './pages/Collection'

function App() {
  return (
    <Router>
      <NFTProvider>
        <div className="App">
          <Header />
          <main>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/create-nft" element={<CreateNFT />} />
              <Route path="/verify-nft"  element={<VerifyNFT />}/>
              <Route path="/transfer-nft" element={<TransferNFT />} />
              <Route path="/collection" element={<Collection />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </NFTProvider>

    </Router>
  )
}

export default App