import axios from 'axios'

// Pinata configuration from environment variables
const PINATA_API_KEY = import.meta.env.VITE_PINATA_API_KEY
const PINATA_SECRET_API_KEY = import.meta.env.VITE_PINATA_SECRET_API_KEY
const PINATA_JWT = import.meta.env.VITE_PINATA_JWT
const PINATA_GATEWAY = import.meta.env.VITE_PINATA_GATEWAY

// Pinata API endpoints
const PINATA_API_URL = 'https://api.pinata.cloud'
const PINATA_PIN_FILE_URL = `${PINATA_API_URL}/pinning/pinFileToIPFS`
const PINATA_PIN_JSON_URL = `${PINATA_API_URL}/pinning/pinJSONToIPFS`

export interface PinataResponse {
  IpfsHash: string
  PinSize: number
  Timestamp: string
}

export interface NFTMetadata {
  name: string
  description: string
  image: string
  attributes: Array<{
    trait_type: string
    value: string
  }>
  properties: {
    files: Array<{
      uri: string
      type: string
    }>
    category: string
  }
  issuer: string
  recipient: string
  issue_date: string
}

class PinataService {
  private getHeaders() {
    if (PINATA_JWT) {
      return {
        'Authorization': `Bearer ${PINATA_JWT}`,
        'Content-Type': 'application/json',
      }
    } else if (PINATA_API_KEY && PINATA_SECRET_API_KEY) {
      return {
        'pinata_api_key': PINATA_API_KEY,
        'pinata_secret_api_key': PINATA_SECRET_API_KEY,
        'Content-Type': 'application/json',
      }
    } else {
      throw new Error('Pinata credentials not found in environment variables')
    }
  }

  private getFormDataHeaders() {
    if (PINATA_JWT) {
      return {
        'Authorization': `Bearer ${PINATA_JWT}`,
      }
    } else if (PINATA_API_KEY && PINATA_SECRET_API_KEY) {
      return {
        'pinata_api_key': PINATA_API_KEY,
        'pinata_secret_api_key': PINATA_SECRET_API_KEY,
      }
    } else {
      throw new Error('Pinata credentials not found in environment variables')
    }
  }

  /**
   * Upload file to IPFS via Pinata
   */
  async uploadFile(file: File): Promise<PinataResponse> {
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      // Add metadata for the file
      const metadata = JSON.stringify({
        name: `certificate-${Date.now()}`,
        keyvalues: {
          type: 'certificate',
          uploadedAt: new Date().toISOString(),
        }
      })
      formData.append('pinataMetadata', metadata)

      // Add options for pinning
      const options = JSON.stringify({
        cidVersion: 0,
      })
      formData.append('pinataOptions', options)

      const response = await axios.post(PINATA_PIN_FILE_URL, formData, {
        headers: this.getFormDataHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      })

      console.log('File uploaded to IPFS:', response.data)
      return response.data
    } catch (error) {
      console.error('Error uploading file to Pinata:', error)
      throw new Error('Failed to upload file to IPFS')
    }
  }

  /**
   * Upload JSON metadata to IPFS via Pinata
   */
  async uploadJSON(metadata: NFTMetadata): Promise<PinataResponse> {
    try {
      const data = {
        pinataContent: metadata,
        pinataMetadata: {
          name: `metadata-${metadata.name}-${Date.now()}`,
          keyvalues: {
            type: 'nft-metadata',
            name: metadata.name,
            issuer: metadata.issuer,
            uploadedAt: new Date().toISOString(),
          }
        },
        pinataOptions: {
          cidVersion: 0,
        }
      }

      const response = await axios.post(PINATA_PIN_JSON_URL, data, {
        headers: this.getHeaders(),
      })

      console.log('Metadata uploaded to IPFS:', response.data)
      return response.data
    } catch (error) {
      console.error('Error uploading metadata to Pinata:', error)
      throw new Error('Failed to upload metadata to IPFS')
    }
  }

  /**
   * Create complete NFT metadata
   */
  createNFTMetadata(
    title: string,
    description: string,
    imageHash: string,
    issuerName: string,
    recipientName: string,
    file: File
  ): NFTMetadata {
    const currentDate = new Date().toISOString()
    // Use ipfs:// format for blockchain compatibility, but provide gateway URL for image
    const imageUrl = this.getGatewayUrl(imageHash) // Use gateway URL for image display

    return {
      name: title,
      description: description,
      image: imageUrl,
      attributes: [
        {
          trait_type: "Issuer",
          value: issuerName
        },
        {
          trait_type: "Recipient", 
          value: recipientName
        },
        {
          trait_type: "Issue Date",
          value: currentDate
        },
        {
          trait_type: "Certificate Type",
          value: "Digital Certificate"
        },
        {
          trait_type: "File Type",
          value: file.type
        },
        {
          trait_type: "IPFS Hash",
          value: imageHash
        }
      ],
      properties: {
        files: [
          {
            uri: this.getGatewayUrl(imageHash), // Gateway URL for file access
            type: file.type
          }
        ],
        category: "certificate"
      },
      issuer: issuerName,
      recipient: recipientName,
      issue_date: currentDate
    }
  }

  /**
   * Get IPFS URL from hash - Updated to match smart contract validation
   */
  getIPFSUrl(hash: string): string {
    // Smart contract only accepts ipfs:// or https://ipfs.io/ipfs/ format
    // Let's use the ipfs:// format for blockchain storage
    return `ipfs://${hash}`
  }

  /**
   * Get HTTP gateway URL for viewing/accessing files
   */
  getGatewayUrl(hash: string): string {
    if (PINATA_GATEWAY) {
      return `${PINATA_GATEWAY}/ipfs/${hash}`
    }
    return `https://gateway.pinata.cloud/ipfs/${hash}`
  }

  /**
   * Test connection to Pinata
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await axios.get(`${PINATA_API_URL}/data/testAuthentication`, {
        headers: this.getHeaders(),
      })
      
      console.log('Pinata connection test:', response.data)
      return response.data.message === 'Congratulations! You are communicating with the Pinata API!'
    } catch (error) {
      console.error('Pinata connection test failed:', error)
      return false
    }
  }
}

export const pinataService = new PinataService()
export default pinataService