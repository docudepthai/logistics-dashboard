# Kamyoon API Quick Reference

## Endpoint
```
GET https://api.kamyoon.com.tr/api/WhatsAppSelenium/GetWhatsAppLoadOffers?Size=20
```

## Headers (Copy-Paste Ready)
```
Host: api.kamyoon.com.tr
Connection: keep-alive
Accept: application/json, text/plain, */*
User-Agent: EgeYurtMuavin/268 CFNetwork/3860.300.31 Darwin/25.2.0
Accept-Language: en-US,en;q=0.9
Authorization: Bearer eyJhbGciOiJodHRwOi8vd3d3LnczLm9yZy8yMDAxLzA0L3htbGRzaWctbW9yZSNobWFjLXNoYTI1NiIsInR5cCI6IkpXVCJ9.eyJodHRwOi8vc2NoZW1hcy54bWxzb2FwLm9yZy93cy8yMDA1LzA1L2lkZW50aXR5L2NsYWltcy9uYW1laWRlbnRpZmllciI6ImViOGU3YzgxLTE5OGItNDA4OS05OTE3LTJmMDYwOGIyMmRjMyIsImh0dHA6Ly9zY2hlbWFzLnhtbHNvYXAub3JnL3dzLzIwMDUvMDUvaWRlbnRpdHkvY2xhaW1zL25hbWUiOiI1MzMyMTE3NjA5IiwiaHR0cDovL3NjaGVtYXMubWljcm9zb2Z0LmNvbS93cy8yMDA4LzA2L2lkZW50aXR5L2NsYWltcy9yb2xlIjoiNDE5OTUiLCJodHRwOi8vc2NoZW1hcy54bWxzb2FwLm9yZy93cy8yMDA5LzA5L2lkZW50aXR5L2NsYWltcy9hY3RvciI6Ijg1MDQ4YmUzLWZiZmItNDA2Yy1hYjFlLWJhZTI3ODdkYjE0ZiIsInBlcm1pc3Npb24iOiI5NDc3YjcxZC0yZWU0LTQxZmQtYjFhOC04Y2Y4MThiODJkYWYiLCJuYmYiOjE3NjY3NzM2NDgsImV4cCI6MTc5ODMwOTY0OCwiaXNzIjoid3d3LmF1dGhlbnRpY2F5dWtzaXMuY29tIiwiYXVkIjoid3d3Lnl1a3Npcy5jb20ifQ.PqEGlJ3GHqnN9OpUgQiJWg0XT6mBBwC0lTTkdBvj234
Accept-Encoding: gzip, deflate, br
```

## Node.js Example (Copy-Paste Ready)
```javascript
const axios = require('axios');

const response = await axios.get(
    'https://api.kamyoon.com.tr/api/WhatsAppSelenium/GetWhatsAppLoadOffers',
    {
        params: { Size: 20 },
        headers: {
            'Host': 'api.kamyoon.com.tr',
            'Connection': 'keep-alive',
            'Accept': 'application/json, text/plain, */*',
            'User-Agent': 'EgeYurtMuavin/268 CFNetwork/3860.300.31 Darwin/25.2.0',
            'Accept-Language': 'en-US,en;q=0.9',
            'Authorization': 'Bearer eyJhbGciOiJodHRwOi8vd3d3LnczLm9yZy8yMDAxLzA0L3htbGRzaWctbW9yZSNobWFjLXNoYTI1NiIsInR5cCI6IkpXVCJ9.eyJodHRwOi8vc2NoZW1hcy54bWxzb2FwLm9yZy93cy8yMDA1LzA1L2lkZW50aXR5L2NsYWltcy9uYW1laWRlbnRpZmllciI6ImViOGU3YzgxLTE5OGItNDA4OS05OTE3LTJmMDYwOGIyMmRjMyIsImh0dHA6Ly9zY2hlbWFzLnhtbHNvYXAub3JnL3dzLzIwMDUvMDUvaWRlbnRpdHkvY2xhaW1zL25hbWUiOiI1MzMyMTE3NjA5IiwiaHR0cDovL3NjaGVtYXMubWljcm9zb2Z0LmNvbS93cy8yMDA4LzA2L2lkZW50aXR5L2NsYWltcy9yb2xlIjoiNDE5OTUiLCJodHRwOi8vc2NoZW1hcy54bWxzb2FwLm9yZy93cy8yMDA5LzA5L2lkZW50aXR5L2NsYWltcy9hY3RvciI6Ijg1MDQ4YmUzLWZiZmItNDA2Yy1hYjFlLWJhZTI3ODdkYjE0ZiIsInBlcm1pc3Npb24iOiI5NDc3YjcxZC0yZWU0LTQxZmQtYjFhOC04Y2Y4MThiODJkYWYiLCJuYmYiOjE3NjY3NzM2NDgsImV4cCI6MTc5ODMwOTY0OCwiaXNzIjoid3d3LmF1dGhlbnRpY2F5dWtzaXMuY29tIiwiYXVkIjoid3d3Lnl1a3Npcy5jb20ifQ.PqEGlJ3GHqnN9OpUgQiJWg0XT6mBBwC0lTTkdBvj234',
            'Accept-Encoding': 'gzip, deflate, br'
        }
    }
);

const offers = response.data.$values || response.data;
console.log(`Got ${offers.length} offers`);
```

## Response Format
```json
{
  "$values": [
    {
      "id": 2226256,
      "message": "Turkish WhatsApp message with load details",
      "phoneNumber": "05529478883",
      "messageSentTime": "2026-01-15T03:57:37"
    }
  ]
}
```

## Critical Rules
1. ✅ Use EXACT User-Agent: `EgeYurtMuavin/268 CFNetwork/3860.300.31 Darwin/25.2.0`
2. ✅ Minimum 5 minutes between requests
3. ✅ Vary Size parameter (10-50, not always max)
4. ✅ Only scrape 8am-8pm Turkey time
5. ❌ Never use Size=500 every time
6. ❌ Never run 24/7
