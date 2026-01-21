// kamyoon-client.js - Simple implementation template for Cline

const axios = require('axios');

class KamyoonClient {
    constructor(token) {
        this.token = token;
        this.baseUrl = 'https://api.kamyoon.com.tr/api';
        this.requestCount = 0;
    }

    /**
     * Get the exact headers from the real iOS app
     */
    getHeaders() {
        return {
            'Host': 'api.kamyoon.com.tr',
            'Connection': 'keep-alive',
            'Accept': 'application/json, text/plain, */*',
            'User-Agent': 'EgeYurtMuavin/268 CFNetwork/3860.300.31 Darwin/25.2.0',
            'Accept-Language': 'en-US,en;q=0.9',
            'Authorization': `Bearer ${this.token}`,
            'Accept-Encoding': 'gzip, deflate, br'
        };
    }

    /**
     * Fetch WhatsApp load offers
     * @param {number} size - Number of offers to fetch (1-500)
     * @returns {Promise<Array>} Array of load offers
     */
    async getLoadOffers(size = 20) {
        try {
            this.requestCount++;
            
            console.log(`[${new Date().toISOString()}] Request #${this.requestCount}: Fetching ${size} offers...`);
            
            const response = await axios.get(
                `${this.baseUrl}/WhatsAppSelenium/GetWhatsAppLoadOffers`,
                {
                    params: { Size: size },
                    headers: this.getHeaders(),
                    timeout: 30000
                }
            );

            // Handle both response formats
            const offers = response.data.$values || response.data;
            
            console.log(`✅ Success: Received ${offers.length} offers`);
            
            return offers;

        } catch (error) {
            console.error(`❌ Error: ${error.message}`);
            
            if (error.response) {
                // Handle specific HTTP errors
                switch (error.response.status) {
                    case 401:
                        console.error('Token expired or invalid - need new token');
                        break;
                    case 429:
                        console.error('Rate limited - reduce request frequency');
                        break;
                    case 403:
                        console.error('Access forbidden - account might be banned');
                        break;
                    default:
                        console.error(`HTTP ${error.response.status}: ${error.response.statusText}`);
                }
            }
            
            throw error;
        }
    }

    /**
     * Get statistics about API usage
     */
    getStats() {
        return {
            totalRequests: this.requestCount,
            riskLevel: this.requestCount > 100 ? 'HIGH' : 
                      this.requestCount > 50 ? 'MEDIUM' : 'LOW'
        };
    }
}

// Example usage
async function main() {
    // Initialize client with token
    const token = process.env.KAMYOON_TOKEN || 'YOUR_TOKEN_HERE';
    const client = new KamyoonClient(token);

    try {
        // Fetch load offers
        const offers = await client.getLoadOffers(20);

        // Process offers
        console.log('\n📊 Sample Data:');
        offers.slice(0, 3).forEach((offer, i) => {
            console.log(`\n${i + 1}. Offer ID: ${offer.id}`);
            console.log(`   Phone: ${offer.phoneNumber}`);
            console.log(`   Time: ${offer.messageSentTime}`);
            console.log(`   Message: ${offer.message.substring(0, 100)}...`);
        });

        // Show stats
        console.log('\n📈 Stats:', client.getStats());

    } catch (error) {
        console.error('Failed to fetch offers');
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = KamyoonClient;
