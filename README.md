# 🇪🇬 EGX Trading Signal Dashboard

A high-performance, real-time trading signal dashboard for the Egyptian Stock Exchange (EGX). This application monitors all 254+ active EGX stocks, detecting buy and sell signals based on a custom self-adaptive technical analysis engine.

## 🚀 Features

- **Full Market Coverage**: Scans 254+ active EGX stocks (mapped from TradingView).
- **Self-Adaptive Technical Engine**: Custom Pine Script logic ported to TypeScript, using adaptive Z-Score filters and volume trend analysis.
- **Real-Time Data**: Connects directly to TradingView's WebSocket datafeed via a local Python proxy (no API keys required).
- **Dual Timeframe Analysis**: Monitors signals on both **H1 (1-Hour)** and **H4 (4-Hour)** intervals.
- **Intra-Candle Detection**: Real-time "LIVE" status badges for active signals.
- **AI-Powered Analysis**: High-fidelity technical and fundamental analysis panel for each stock.
- **Automated Trade Setup**: Calculates entry, stop-loss, and three take-profit targets based on institutional risk/reward ratios.
- **Market Hours Aware**: Auto-refreshes every 15 minutes only during EGX market hours (Sun-Thu, 07:00-17:00 Egypt time).

## 🛠 Tech Stack

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS (minimal), Lucide Icons.
- **Data Backend**: Python 3 (Flask) handling WebSocket proxy and cache.
- **Styling**: Custom CSS and Framer-inspired animations for a premium dark-mode feel.

## 📦 Installation & Setup

### 1. Prerequisites
- Node.js (v18+)
- Python 3.9+
- Git

### 2. Clone the repository
```bash
git clone https://github.com/bugsbunny110/egx-signals.git
cd egx-signals
```

### 3. Install Dependencies
```bash
npm install
pip install flask requests websocket-client flask-cors
```

### 4. Run the Application

You need two terminals running simultaneously:

**Terminal 1: Data Server (Python)**
```bash
python tv_server.py
```

**Terminal 2: Web App (Next.js)**
```bash
npm run dev
```

Visit `http://localhost:3000` to see the dashboard.

## 📊 Signal Engine Details
The core logic uses a proprietary "Universal Self-Adaptive EMA" ported from Pine Script. It calculates:
- Adaptive Z-Score for trend direction.
- Relative volume filter to confirm institutional activity.
- Triple Take-Profit (TP) levels based on support/resistance and dynamic ATR estimates.

## ⚖️ Disclaimer
This tool is for educational and informational purposes only. Trading involves risk. Always conduct your own research before making investment decisions.

## 📄 License
MIT
