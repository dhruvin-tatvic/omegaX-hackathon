# Be The Answer

Internal Tatvic app for Apex Moto: AI Visibility & Answer Intelligence.

http://localhost:3460

## Routes

- `/` redirects to Traffic Intelligence
- `/traffic` Traffic Intelligence
- `/human-view` Human View
- `/readability` AI vs Human Readability
- `/comparison` Comparison Overview
- `/comparison/recommendations` Gap Analysis & Recommendations
- `/comparison/runs` Run History

## Start

```bash
cd tools/analytics
npm install
npm run start:all
```

Required backends:

1. Traffic API on port 3456: `cd tools/traffic-dashboard && npm start`
2. Comparison API on port 3457: `cd tools/comparison-dashboard && node server.js`
3. This UI on port 3460: `cd tools/analytics && npm start`

## Tests

```bash
cd tools/analytics
npm test
```
