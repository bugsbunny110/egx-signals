"""
TradingView Local Data Server
Connects to TradingView's WebSocket datafeed (same protocol as the chart widget)
and serves OHLCV candle data via a local REST API on port 8765.

No API key required — uses the same public data TradingView charts use.
"""

import json
import random
import re
import string
import time
import threading
from datetime import datetime
from flask import Flask, jsonify, request
from flask_cors import CORS
import websocket

app = Flask(__name__)
CORS(app)

# In-memory cache
cache = {}
CACHE_TTL = 60  # 1 minute (allows fresh intra-candle data)

# TradingView WebSocket endpoint
WS_URL = "wss://data.tradingview.com/socket.io/websocket?from=chart&date=2024_12_06"

# Interval mapping: our format -> TradingView format
INTERVAL_MAP = {
    "1h": "60",
    "4h": "240",
    "1d": "D",
}

def generate_session():
    return "qs_" + "".join(random.choices(string.ascii_lowercase, k=12))

def generate_chart_session():
    return "cs_" + "".join(random.choices(string.ascii_lowercase, k=12))

def prepend_header(msg):
    return f"~m~{len(msg)}~m~{msg}"

def construct_message(method, params):
    return json.dumps({"m": method, "p": params}, separators=(",", ":"))

def send_message(ws, method, params):
    msg = prepend_header(construct_message(method, params))
    ws.send(msg)

def fetch_candles_from_tv(symbol: str, exchange: str, interval: str, n_bars: int = 300):
    """
    Connect to TradingView WebSocket and fetch OHLCV bars.
    Returns list of dicts with: datetime, open, high, low, close, volume
    """
    result = {"candles": None, "error": None, "done": threading.Event()}
    collected_bars = []

    session = generate_session()
    chart_session = generate_chart_session()
    tv_interval = INTERVAL_MAP.get(interval, "60")
    full_symbol = f"{exchange}:{symbol}"

    def on_open(ws):
        # TradingView WebSocket handshake sequence
        send_message(ws, "set_auth_token", ["unauthorized_user_token"])
        send_message(ws, "chart_create_session", [chart_session, ""])
        send_message(ws, "quote_create_session", [session])
        send_message(ws, "quote_set_fields", [session, "ch", "chp", "current_session",
                                               "description", "local_description", "language",
                                               "exchange", "fractional", "is_tradable",
                                               "lp", "lp_time", "minmov", "minmove2",
                                               "original_name", "pricescale", "pro_name",
                                               "short_name", "type", "update_mode",
                                               "volume", "currency_code"])
        send_message(ws, "quote_add_symbols", [session, full_symbol, {"flags": ["force_permission"]}])
        send_message(ws, "resolve_symbol", [chart_session, "symbol_1",
                                             f'={{"symbol":"{full_symbol}","adjustment":"splits"}}'])
        send_message(ws, "create_series", [chart_session, "s1", "s1", "symbol_1",
                                            tv_interval, n_bars])

    def on_message(ws, message):
        # Parse incoming packets
        packets = re.split(r"~m~\d+~m~", message)
        for packet in packets:
            if not packet.strip():
                continue

            # Heartbeat
            if packet.startswith("~h~"):
                ws.send(prepend_header(packet))
                continue

            try:
                data = json.loads(packet)
            except json.JSONDecodeError:
                continue

            method = data.get("m", "")

            # Series data
            if method == "timescale_update":
                try:
                    series_data = data["p"][1].get("s1", {})
                    bars = series_data.get("s", [])
                    for bar in bars:
                        v = bar.get("v", [])
                        if len(v) >= 6:
                            ts, o, h, l, c, vol = v[0], v[1], v[2], v[3], v[4], v[5]
                            dt = datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d %H:%M:%S")
                            collected_bars.append({
                                "datetime": dt,
                                "open": round(float(o), 4),
                                "high": round(float(h), 4),
                                "low": round(float(l), 4),
                                "close": round(float(c), 4),
                                "volume": round(float(vol), 2),
                            })
                except (KeyError, IndexError, TypeError):
                    pass

            # Series completed
            if method == "series_completed":
                result["candles"] = collected_bars
                result["done"].set()
                ws.close()

            # Error handling
            if method == "series_error":
                result["error"] = f"TradingView series error for {full_symbol}"
                result["done"].set()
                ws.close()

    def on_error(ws, error):
        result["error"] = str(error)
        result["done"].set()

    def on_close(ws, *args):
        if not result["done"].is_set():
            if collected_bars:
                result["candles"] = collected_bars
            result["done"].set()

    ws_app = websocket.WebSocketApp(
        WS_URL,
        on_open=on_open,
        on_message=on_message,
        on_error=on_error,
        on_close=on_close,
        header={"Origin": "https://www.tradingview.com"}
    )

    thread = threading.Thread(target=lambda: ws_app.run_forever(ping_interval=30))
    thread.daemon = True
    thread.start()

    # Wait up to 30 seconds for data
    result["done"].wait(timeout=30)

    if result["error"]:
        raise ValueError(result["error"])

    candles = result["candles"]
    if not candles:
        raise ValueError(f"No data returned for {full_symbol} ({interval})")

    return candles


@app.route("/candles")
def get_candles():
    """
    GET /candles?symbol=COMI&exchange=EGX&interval=1h&bars=300
    Returns OHLCV candle data from TradingView.
    """
    symbol = request.args.get("symbol", "").upper()
    exchange = request.args.get("exchange", "EGX").upper()
    interval = request.args.get("interval", "1h")
    bars = int(request.args.get("bars", 300))

    if not symbol:
        return jsonify({"error": "symbol is required"}), 400

    if interval not in INTERVAL_MAP:
        return jsonify({"error": f"interval must be one of {list(INTERVAL_MAP.keys())}"}), 400

    cache_key = f"{exchange}:{symbol}:{interval}"
    cached = cache.get(cache_key)
    if cached and time.time() < cached["expires_at"]:
        return jsonify({"symbol": symbol, "exchange": exchange, "interval": interval,
                        "candles": cached["data"], "cached": True})

    try:
        candles = fetch_candles_from_tv(symbol, exchange, interval, bars)
        cache[cache_key] = {"data": candles, "expires_at": time.time() + CACHE_TTL}
        return jsonify({"symbol": symbol, "exchange": exchange, "interval": interval,
                        "candles": candles, "cached": False, "count": len(candles)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/fundamentals")
def get_fundamentals():
    """
    GET /fundamentals
    Returns a map of symbols to their fundamental data (P/E, Market Cap, Debt/Equity).
    """
    import requests
    url = 'https://scanner.tradingview.com/egypt/scan'
    payload = {
        'columns': ['description', 'price_earnings_ttm', 'market_cap_basic', 'debt_to_equity', 'long_term_debt_to_equity_fq'],
        'sort': {'sortBy': 'name', 'sortOrder': 'asc'},
        'range': [0, 500]
    }
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.post(url, json=payload, headers=headers)
        data = response.json()
        fundamentals = {}
        for item in data.get('data', []):
            symbol = item['s'].split(':')[-1]
            fundamentals[symbol] = {
                'pe': item['d'][1],
                'market_cap': item['d'][2],
                'debt_to_equity': item['d'][3],
                'ld_debt_to_equity': item['d'][4]
            }
        return jsonify(fundamentals)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/health")
def health():
    return jsonify({"status": "ok", "message": "TradingView data server running"})


@app.route("/cache/clear")
def clear_cache():
    cache.clear()
    return jsonify({"status": "ok", "message": "Cache cleared"})


if __name__ == "__main__":
    print("=" * 55)
    print("  TradingView Local Data Server")
    print("  Connecting to TradingView's WebSocket datafeed")
    print("  No API key required")
    print("=" * 55)
    print(f"  -> http://localhost:8765/candles?symbol=COMI&exchange=EGX&interval=1h")
    print(f"  -> http://localhost:8765/health")
    print("=" * 55)
    app.run(host="0.0.0.0", port=8765, debug=False)
