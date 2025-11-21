# Shannon's Demon & Risk Parity Rebalancer

A Streamlit web application for portfolio optimization using risk parity principles and tax-efficient asset location strategies.

## Overview

This tool helps investors:
- Calculate **Risk Parity Targets** using inverse volatility weighting with live market data
- Optimize **Asset Location** to minimize tax drag (placing bonds in IRAs, stocks in taxable accounts)
- Generate rebalancing trades based on Shannon's Demon principle to harvest volatility premiums

## Features

- **Risk Parity Allocation**: Automatically calculates optimal portfolio weights based on historical volatility
- **Tax-Efficient Placement**: Intelligently distributes assets across Taxable, Traditional IRA/401k, and Roth IRA accounts
- **Rebalancing Guidance**: Suggests trades only when drift exceeds your specified threshold
- **Interactive UI**: Easy-to-use sidebar controls with real-time market data from Yahoo Finance

## Installation

1. Clone this repository:
```bash
git clone https://github.com/paruff/shannonsdemon.git
cd shannonsdemon
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

## Usage

Run the Streamlit app:
```bash
streamlit run app.py
```

The app will open in your default web browser at `http://localhost:8501`.

### Configuration

1. **Portfolio Configuration** (Sidebar):
   - Enter tickers (comma-separated): e.g., `SPY, TLT, GLD, VNQ, EEM`
   - Select volatility lookback period: 3mo, 6mo, 1y, or 2y
   - Set rebalance threshold: Only rebalance if drift exceeds this percentage

2. **Account Balances** (Sidebar):
   - Enter balances for:
     - Taxable Brokerage
     - Traditional IRA / 401k
     - Roth IRA

3. Click **"Analyze & Generate Trades"** to:
   - See risk parity target weights
   - View tax-efficient account placement
   - Get a detailed action plan with shares to buy/sell

## How It Works

### Risk Parity
Uses inverse volatility weighting to balance risk across assets:
- Lower volatility assets get higher weights
- Higher volatility assets get lower weights
- Result: Each asset contributes equally to portfolio risk

### Tax Optimization
Implements a waterfall algorithm:
1. Ranks assets by tax inefficiency (bonds > commodities > REITs > stocks)
2. Ranks accounts by tax advantage (Roth > Traditional > Taxable)
3. Places tax-inefficient assets in tax-advantaged accounts first

### Shannon's Demon
Only rebalances when drift exceeds threshold to:
- Capture volatility premiums
- Minimize transaction costs
- Maintain target risk levels

## Disclaimer

This is a simulation tool for educational purposes. It does not constitute financial advice. Tax efficiency rules are simplified heuristics. Always consult with a qualified financial advisor before making investment decisions.

## License

See [LICENSE](LICENSE) file for details.