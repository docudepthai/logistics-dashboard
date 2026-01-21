# Kamyoon API Integration Guide for Cline

## Overview
This document contains everything needed to make API requests to Kamyoon's WhatsApp load offers endpoint. Follow these specifications exactly to avoid detection.

## Base Information

**Base URL:** `https://api.kamyoon.com.tr/api`

**Target Endpoint:** `/WhatsAppSelenium/GetWhatsAppLoadOffers`

**Method:** `GET`

**Authentication:** Bearer Token (JWT)

## Authentication

**Token Type:** JWT Bearer Token

**Token Format:**
```
eyJhbGciOiJodHRwOi8vd3d3LnczLm9yZy8yMDAxLzA0L3htbGRzaWctbW9yZSNobWFjLXNoYTI1NiIsInR5cCI6IkpXVCJ9.eyJodHRwOi8vc2NoZW1hcy54bWxzb2FwLm9yZy93cy8yMDA1LzA1L2lkZW50aXR5L2NsYWltcy9uYW1laWRlbnRpZmllciI6ImViOGU3YzgxLTE5OGItNDA4OS05OTE3LTJmMDYwOGIyMmRjMyIsImh0dHA6Ly9zY2hlbWFzLnhtbHNvYXAub3JnL3dzLzIwMDUvMDUvaWRlbnRpdHkvY2xhaW1zL25hbWUiOiI1MzMyMTE3NjA5IiwiaHR0cDovL3NjaGVtYXMubWljcm9zb2Z0LmNvbS93cy8yMDA4LzA2L2lkZW50aXR5L2NsYWltcy9yb2xlIjoiNDE5OTUiLCJodHRwOi8vc2NoZW1hcy54bWxzb2FwLm9yZy93cy8yMDA5LzA5L2lkZW50aXR5L2NsYWltcy9hY3RvciI6Ijg1MDQ4YmUzLWZiZmItNDA2Yy1hYjFlLWJhZTI3ODdkYjE0ZiIsInBlcm1pc3Npb24iOiI5NDc3YjcxZC0yZWU0LTQxZmQtYjFhOC04Y2Y4MThiODJkYWYiLCJuYmYiOjE3NjY3NzM2NDgsImV4cCI6MTc5ODMwOTY0OCwiaXNzIjoid3d3LmF1dGhlbnRpY2F5dWtzaXMuY29tIiwiYXVkIjoid3d3Lnl1a3Npcy5jb20ifQ.PqEGlJ3GHqnN9OpUgQiJWg0XT6mBBwC0lTTkdBvj234
```

**Token Expiration:** January 14, 2027

**Usage in Request:**
```
Authorization: Bearer <TOKEN>
```

## Required Headers (CRITICAL - Must Match Exactly)

These headers are captured from the real iOS app. Use them EXACTLY as shown:

```
Host: api.kamyoon.com.tr
Connection: keep-alive
Accept: application/json, text/plain, */*
User-Agent: EgeYurtMuavin/268 CFNetwork/3860.300.31 Darwin/25.2.0
Accept-Language: en-US,en;q=0.9
Authorization: Bearer <TOKEN>
Accept-Encoding: gzip, deflate, br
```

**Critical Notes:**
- `User-Agent` MUST be exactly: `EgeYurtMuavin/268 CFNetwork/3860.300.31 Darwin/25.2.0`
- This mimics the real iOS app (NOT "Kamyoon" branding)
- Any deviation will flag as bot traffic

## Query Parameters

**Parameter:** `Size`

**Type:** Integer

**Range:** 1 - 500

**Description:** Number of load offers to retrieve

**Recommended Values:**
- Development/testing: 10-20
- Production: 15-50 (vary this to look human)
- Never always use 500 (too obvious)

**Example:**
```
?Size=20
```

## Complete API Request Specification

### Full URL Format
```
https://api.kamyoon.com.tr/api/WhatsAppSelenium/GetWhatsAppLoadOffers?Size=20
```

### Complete cURL Example
```bash
curl "https://api.kamyoon.com.tr/api/WhatsAppSelenium/GetWhatsAppLoadOffers?Size=20" \
  -H "Host: api.kamyoon.com.tr" \
  -H "Connection: keep-alive" \
  -H "Accept: application/json, text/plain, */*" \
  -H "User-Agent: EgeYurtMuavin/268 CFNetwork/3860.300.31 Darwin/25.2.0" \
  -H "Accept-Language: en-US,en;q=0.9" \
  -H "Authorization: Bearer eyJhbGciOiJodHRwOi8vd3d3LnczLm9yZy8yMDAxLzA0L3htbGRzaWctbW9yZSNobWFjLXNoYTI1NiIsInR5cCI6IkpXVCJ9.eyJodHRwOi8vc2NoZW1hcy54bWxzb2FwLm9yZy93cy8yMDA1LzA1L2lkZW50aXR5L2NsYWltcy9uYW1laWRlbnRpZmllciI6ImViOGU3YzgxLTE5OGItNDA4OS05OTE3LTJmMDYwOGIyMmRjMyIsImh0dHA6Ly9zY2hlbWFzLnhtbHNvYXAub3JnL3dzLzIwMDUvMDUvaWRlbnRpdHkvY2xhaW1zL25hbWUiOiI1MzMyMTE3NjA5IiwiaHR0cDovL3NjaGVtYXMubWljcm9zb2Z0LmNvbS93cy8yMDA4LzA2L2lkZW50aXR5L2NsYWltcy9yb2xlIjoiNDE5OTUiLCJodHRwOi8vc2NoZW1hcy54bWxzb2FwLm9yZy93cy8yMDA5LzA5L2lkZW50aXR5L2NsYWltcy9hY3RvciI6Ijg1MDQ4YmUzLWZiZmItNDA2Yy1hYjFlLWJhZTI3ODdkYjE0ZiIsInBlcm1pc3Npb24iOiI5NDc3YjcxZC0yZWU0LTQxZmQtYjFhOC04Y2Y4MThiODJkYWYiLCJuYmYiOjE3NjY3NzM2NDgsImV4cCI6MTc5ODMwOTY0OCwiaXNzIjoid3d3LmF1dGhlbnRpY2F5dWtzaXMuY29tIiwiYXVkIjoid3d3Lnl1a3Npcy5jb20ifQ.PqEGlJ3GHqnN9OpUgQiJWg0XT6mBBwC0lTTkdBvj234" \
  -H "Accept-Encoding: gzip, deflate, br"
```

## Response Format

### Success Response (HTTP 200)

**Content-Type:** `application/json`

**Structure:**
```json
{
  "$id": "1",
  "$values": [
    {
      "$id": "2",
      "id": 2226256,
      "loadOfferGroupTitle": "",
      "message": "*📍BURSA GEMLİK YÜKLEMELİ*\n*✅KÜTAHYA MERKEZ*\n*🟥DAMPERLİ TIRLAR*\n*💥HEMEN YÜKLER*\n*✅EMİRCAN LOJİSTİK*\n*📲0 552 947 88 83*",
      "phoneNumber": "05529478883",
      "messageHtml": "",
      "messageSentTime": "2026-01-15T03:57:37",
      "reactions": {
        "$id": "3",
        "$values": []
      }
    },
    {
      "$id": "4",
      "id": 2226255,
      "loadOfferGroupTitle": "",
      "message": "...",
      "phoneNumber": "05529478883",
      "messageHtml": "",
      "messageSentTime": "2026-01-15T03:57:36",
      "reactions": {
        "$id": "5",
        "$values": []
      }
    }
  ]
}
```

**Key Fields:**
- `$values`: Array of load offers
- `id`: Unique offer ID
- `message`: Raw WhatsApp message with load details (Turkish text with emojis)
- `phoneNumber`: Poster's phone number (Turkish format: 05XXXXXXXXX)
- `messageSentTime`: ISO 8601 timestamp
- `loadOfferGroupTitle`: Usually empty (they don't expose group names)

### Error Responses

**401 Unauthorized:**
```json
{
  "error": "Invalid or expired token"
}
```
**Action:** Token needs refresh

**429 Too Many Requests:**
```json
{
  "error": "Rate limit exceeded"
}
```
**Action:** Reduce request frequency

**403 Forbidden:**
```json
{
  "error": "Access denied"
}
```
**Action:** Account might be banned

## Implementation Examples

### JavaScript/Node.js (axios)

```javascript
const axios = require('axios');

async function getKamyoonLoads(size = 20) {
    const token = 'YOUR_TOKEN_HERE';
    
    try {
        const response = await axios.get(
            'https://api.kamyoon.com.tr/api/WhatsAppSelenium/GetWhatsAppLoadOffers',
            {
                params: { Size: size },
                headers: {
                    'Host': 'api.kamyoon.com.tr',
                    'Connection': 'keep-alive',
                    'Accept': 'application/json, text/plain, */*',
                    'User-Agent': 'EgeYurtMuavin/268 CFNetwork/3860.300.31 Darwin/25.2.0',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Authorization': `Bearer ${token}`,
                    'Accept-Encoding': 'gzip, deflate, br'
                },
                timeout: 30000
            }
        );
        
        const offers = response.data.$values || response.data;
        return offers;
        
    } catch (error) {
        if (error.response?.status === 401) {
            console.error('Token expired or invalid');
        } else if (error.response?.status === 429) {
            console.error('Rate limited - reduce frequency');
        }
        throw error;
    }
}

// Usage
getKamyoonLoads(20)
    .then(offers => {
        console.log(`Fetched ${offers.length} load offers`);
        offers.forEach(offer => {
            console.log(`Offer ${offer.id}: ${offer.phoneNumber}`);
        });
    })
    .catch(err => console.error('Error:', err.message));
```

### Python (requests)

```python
import requests
import json

def get_kamyoon_loads(size=20):
    token = 'YOUR_TOKEN_HERE'
    
    url = 'https://api.kamyoon.com.tr/api/WhatsAppSelenium/GetWhatsAppLoadOffers'
    
    headers = {
        'Host': 'api.kamyoon.com.tr',
        'Connection': 'keep-alive',
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'EgeYurtMuavin/268 CFNetwork/3860.300.31 Darwin/25.2.0',
        'Accept-Language': 'en-US,en;q=0.9',
        'Authorization': f'Bearer {token}',
        'Accept-Encoding': 'gzip, deflate, br'
    }
    
    params = {'Size': size}
    
    try:
        response = requests.get(url, headers=headers, params=params, timeout=30)
        response.raise_for_status()
        
        data = response.json()
        offers = data.get('$values', data)
        
        return offers
        
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 401:
            print('Token expired or invalid')
        elif e.response.status_code == 429:
            print('Rate limited - reduce frequency')
        raise
    
# Usage
offers = get_kamyoon_loads(20)
print(f'Fetched {len(offers)} load offers')

for offer in offers:
    print(f"Offer {offer['id']}: {offer['phoneNumber']}")
```

## Anti-Detection Best Practices

### 1. Rate Limiting
```
NEVER:
- Request every 30 seconds
- Use Size=500 every time
- Run 24/7 without breaks

INSTEAD:
- Minimum 5 minutes between requests
- Vary Size parameter (10, 15, 20, 25, 30, 50)
- Only during Turkish business hours (8am-8pm Istanbul time)
```

### 2. Request Patterns
```python
import random
import time

def get_random_size():
    """Vary request sizes to look human"""
    return random.choice([10, 15, 20, 25, 30, 50])

def get_random_delay():
    """Random delay between requests (5-15 minutes)"""
    return random.randint(300, 900)  # seconds

# Usage
size = get_random_size()
offers = get_kamyoon_loads(size)

# Wait before next request
delay = get_random_delay()
time.sleep(delay)
```

### 3. Business Hours Check
```python
from datetime import datetime
import pytz

def is_turkish_business_hours():
    """Check if current time is Turkish business hours"""
    istanbul_tz = pytz.timezone('Europe/Istanbul')
    istanbul_time = datetime.now(istanbul_tz)
    
    hour = istanbul_time.hour
    day = istanbul_time.weekday()  # 0=Monday, 6=Sunday
    
    # Monday-Friday, 8am-8pm
    return day < 5 and 8 <= hour <= 20

# Usage
if is_turkish_business_hours():
    offers = get_kamyoon_loads()
else:
    print("Outside business hours - skipping request")
```

## Data Processing

### Parsing Turkish Messages

Messages contain load details in Turkish with emojis. Extract structured data:

```javascript
function parseLoadMessage(message) {
    const data = {
        origins: [],
        destinations: [],
        prices: [],
        cargoTypes: [],
        vehicleTypes: []
    };
    
    // Extract origins (YÜKLEMELİ pattern)
    const originMatch = message.match(/([A-ZİĞÜŞÖÇ][A-Za-zığüşöç\s]+)\s+YÜKLEMELİ/gi);
    if (originMatch) {
        data.origins = originMatch.map(m => m.replace(/\s+YÜKLEMELİ/i, '').trim());
    }
    
    // Extract destinations (➡️ or → pattern)
    const destMatch = message.match(/➡️\s*([A-ZİĞÜŞÖÇ][A-Za-zığüşöç\s]+)/g);
    if (destMatch) {
        data.destinations = destMatch.map(m => m.replace(/➡️\s*/, '').trim());
    }
    
    // Extract prices (###+ pattern)
    const priceMatch = message.matchAll(/(\d+)\+(?:KDV)?/g);
    for (const match of priceMatch) {
        data.prices.push(parseInt(match[1]));
    }
    
    // Extract cargo types
    if (/DÖKME\s+MADEN/i.test(message)) data.cargoTypes.push('Dökme Maden');
    if (/DÖKME\s+KÖMÜR|TORBALI\s+KÖMÜR/i.test(message)) data.cargoTypes.push('Dökme Kömür');
    if (/DÖKME\s+HUBUBAT/i.test(message)) data.cargoTypes.push('Dökme Hububat');
    
    // Extract vehicle types
    if (/DAMPERLİ\s+TIR/i.test(message)) data.vehicleTypes.push('Damperli TIR');
    if (/AÇIK\s+TIR/i.test(message)) data.vehicleTypes.push('Açık TIR');
    if (/UZUN\s+DORSE/i.test(message)) data.vehicleTypes.push('Uzun Dorse');
    
    return data;
}

// Usage
offers.forEach(offer => {
    const parsed = parseLoadMessage(offer.message);
    console.log('Route:', parsed.origins[0], '→', parsed.destinations[0]);
    console.log('Price:', parsed.prices[0], 'TL+KDV');
});
```

## Security Considerations

### Token Storage
```bash
# Store token in environment variable
export KAMYOON_TOKEN="your_token_here"

# Never commit token to git
echo ".env" >> .gitignore
```

### Error Handling
```javascript
async function safeRequest() {
    try {
        const offers = await getKamyoonLoads();
        return offers;
    } catch (error) {
        if (error.response?.status === 401) {
            // Token expired - need to refresh
            console.error('Authentication failed');
            // Notify admin to get new token
        } else if (error.response?.status === 429) {
            // Rate limited - back off
            console.error('Rate limited - waiting 15 minutes');
            await sleep(15 * 60 * 1000);
        } else {
            console.error('Request failed:', error.message);
        }
        return [];
    }
}
```

## Testing

### Quick Test
```bash
# Test with cURL
curl "https://api.kamyoon.com.tr/api/WhatsAppSelenium/GetWhatsAppLoadOffers?Size=5" \
  -H "User-Agent: EgeYurtMuavin/268 CFNetwork/3860.300.31 Darwin/25.2.0" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Accept: application/json, text/plain, */*" | jq .
```

### Expected Output
```json
{
  "$id": "1",
  "$values": [
    {
      "id": 2226256,
      "message": "...",
      "phoneNumber": "05529478883",
      "messageSentTime": "2026-01-15T03:57:37"
    }
  ]
}
```

If you see this structure, the API is working correctly.

## Monitoring & Logging

### Track Usage
```javascript
let requestCount = 0;
let lastRequestTime = null;

function logRequest(size, responseLength) {
    requestCount++;
    lastRequestTime = new Date();
    
    console.log({
        timestamp: lastRequestTime.toISOString(),
        requestNumber: requestCount,
        requestSize: size,
        responseLength: responseLength,
        detectionRisk: requestCount > 100 ? 'HIGH' : 
                       requestCount > 50 ? 'MEDIUM' : 'LOW'
    });
}
```

## Common Issues & Solutions

### Issue 1: Network Errors
```
Error: connect ETIMEDOUT
Solution: Check internet connection, try again
```

### Issue 2: Invalid Response Format
```
Error: Cannot read property '$values' of undefined
Solution: Response format changed, check response.data structure
```

### Issue 3: Empty Results
```
Response: {"$values": []}
Solution: Normal - might be no new posts. Try again later.
```

## Integration Checklist

- [ ] Token stored securely (environment variable)
- [ ] Headers match EXACTLY as specified
- [ ] User-Agent is: `EgeYurtMuavin/268 CFNetwork/3860.300.31 Darwin/25.2.0`
- [ ] Rate limiting implemented (5+ min between requests)
- [ ] Size parameter varies (10-50 range)
- [ ] Business hours check implemented
- [ ] Error handling for 401, 429, 403
- [ ] Logging implemented
- [ ] Parser for Turkish messages implemented

## Production Deployment Recommendations

1. **Use Environment Variables**
   ```bash
   KAMYOON_TOKEN=xxx
   RATE_LIMIT_MINUTES=5
   MAX_DAILY_REQUESTS=100
   ```

2. **Add Request Counter**
   - Track daily request count
   - Alert if exceeds 100 requests/day

3. **Implement Backoff**
   - On 429: Wait 15 minutes
   - On 403: Stop scraping, alert admin

4. **Log All Requests**
   - Timestamp
   - Request size
   - Response status
   - Number of results

5. **Health Monitoring**
   - Alert if no data for 24 hours
   - Alert if token expires soon
   - Track success rate

## Support & Updates

**Token Expiration:** January 14, 2027

**When Token Expires:**
1. Open Kamyoon app on iPhone
2. Use Proxyman to intercept API call
3. Copy new Bearer token from Authorization header
4. Update environment variable

**If API Changes:**
- Monitor for response format changes
- Update parsers accordingly
- Keep headers up to date with latest iOS app version

---

**Document Version:** 1.0
**Last Updated:** January 14, 2026
**Next Token Refresh:** January 14, 2027
