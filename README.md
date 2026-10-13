# NIFTY OI Direction Engine — Backend (GitHub + Render)

## Deploy to GitHub / Render
1. Extract this ZIP and upload its root files to a new GitHub repository.
2. Create a Render **Web Service** from that repository.
3. Keep Root Directory blank. Build command: `npm install`; Start command: `npm start`.
4. Add environment variables from `.env.example`. Set a strong `INGEST_TOKEN`; keep it secret. Do not put broker credentials in the frontend.
5. After deploy, test `https://YOUR-SERVICE.onrender.com/api/health`.

## Critical live-data limitation
This package is a normalized API receiver and WebSocket broadcaster. It does **not** authenticate with Dhan/NSE or independently fetch live option-chain data. To get live data, connect an authorized provider/bridge that POSTs each normalized snapshot to `/api/ingest` with header `x-ingest-token: YOUR_INGEST_TOKEN`. A provider adapter must map real spot, strike-wise CE/PE OI, LTP and volume into the schema below. Never label demo or stale data as live.

## Ingest schema
```json
{
  "spot": {"price": 22400, "timestamp": 1791800000000},
  "timestamp": 1791800000000,
  "source": "authorized-provider",
  "optionChain": [
    {"strike":22400,"ce":{"oi":100000,"ltp":120.5,"volume":50000,"bidQty":200,"askQty":180},"pe":{"oi":110000,"ltp":115.2,"volume":52000,"bidQty":160,"askQty":210}}
  ]
}
```

The timestamp is Unix milliseconds. `GET /api/state` returns the latest snapshot and `stale` flag; `GET /api/option-chain` returns chain data; `/ws` broadcasts `{ "type":"state", "state": ... }` on each ingest. The frontend currently polls `/api/state` every 5 seconds.

## Safety and strategy semantics
OI and premium combinations are pattern clues, not direct proof of writing or short covering. Each option contract has both a buyer and seller. The frontend requires spot direction plus OI/premium evidence and should be backtested with real historical data before any live use. This API does not place orders.
