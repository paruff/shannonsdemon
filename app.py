import streamlit as st
import pandas as pd
import numpy as np
import yfinance as yf
import plotly.express as px

# --- CONFIGURATION ---
st.set_page_config(page_title="Risk Parity & Tax Location Optimizer", layout="wide")

# --- HELPER FUNCTIONS ---

def get_market_data(tickers, period="1y"):
    """Fetch historical data to calculate volatility."""
    data = yf.download(tickers, period=period, group_by='ticker', auto_adjust=True)
    
    # Handle single vs multiple tickers
    if len(tickers) == 1:
        if 'Close' not in data.columns:
            raise ValueError(f"Close price data not available for {tickers[0]}")
        close_data = data['Close']
    else:
        # For multiple tickers, extract Close prices
        close_data = pd.DataFrame({ticker: data[ticker]['Close'] for ticker in tickers if ticker in data.columns.get_level_values(0)})
    
    if close_data.empty:
        raise ValueError("No valid price data could be retrieved")
    
    # Calculate daily returns
    returns = close_data.pct_change().dropna()
    # Calculate annualized volatility
    volatility = returns.std() * np.sqrt(252)
    return volatility, close_data.iloc[-1]

def calculate_risk_parity_weights(volatilities):
    """
    Simple Risk Parity: Inverse Volatility Weighting.
    Weight_i = (1/Vol_i) / Sum(1/Vol_j)
    """
    # Handle zero or near-zero volatility
    min_vol = 0.001  # Minimum volatility threshold
    volatilities = volatilities.clip(lower=min_vol)
    
    inv_vol = 1 / volatilities
    weights = inv_vol / inv_vol.sum()
    return weights

def optimize_asset_location(total_portfolio_value, target_weights, accounts):
    """
    The Waterfall Algorithm for Tax Efficiency.
    
    Heuristic:
    1. Rank Assets by 'Tax Inefficiency' (High to Low).
       - High: Bonds, REITs, High Div (Put in IRA/Roth)
       - Low: Growth Stocks, ETFs (Put in Taxable)
       
    2. Rank Accounts by 'Tax Advantage' (High to Low).
       - High: Roth, HSA
       - Med: 401k/Traditional IRA
       - Low: Taxable
       
    3. Fill best accounts with worst tax assets.
    """
    
    # 1. Determine Target $ Amount for each Asset
    target_amounts = target_weights * total_portfolio_value
    
    # 2. Define Tax Inefficiency Score (Arbitrary Heuristic for this demo)
    # Higher score = Worse for taxable account (Needs shelter)
    tax_inefficiency = {
        'TLT': 10, 'IEF': 10, 'BND': 10,  # Bonds (Interest taxed as income)
        'GLD': 8, 'DBC': 8,               # Commodities (Collectibles tax / K-1s)
        'VNQ': 9,                         # REITs (Unqualified divs)
        'SPY': 2, 'VTI': 2, 'QQQ': 2,     # Stocks (Capital gains/Qualified divs)
        'EEM': 3, 'VEA': 3                # International (Foreign tax credit potential)
    }
    
    # Create a DataFrame for allocation logic
    assets_df = pd.DataFrame({
        'Target_Value': target_amounts,
        'Inefficiency_Score': [tax_inefficiency.get(t, 5) for t in target_amounts.index]
    }).sort_values(by='Inefficiency_Score', ascending=False) # Most inefficient first
    
    # Prepare Accounts (Sort by tax advantage priority)
    # Priority: Roth/HSA (Best) > Trad/401k (Deferral) > Taxable (Worst)
    sorted_accounts = []
    for acc_name, balance in accounts.items():
        priority = 3 # Default to taxable
        if 'Roth' in acc_name or 'HSA' in acc_name: 
            priority = 1
        elif 'IRA' in acc_name or '401k' in acc_name: 
            priority = 2
        
        sorted_accounts.append({
            'Name': acc_name,
            'Balance': balance,
            'Remaining': balance,
            'Priority': priority,
            'Holdings': {}
        })
    
    # Sort accounts: Best shelter first
    sorted_accounts.sort(key=lambda x: x['Priority'])
    
    # 3. The Filling Algorithm
    final_allocation = []
    
    for asset, row in assets_df.iterrows():
        amount_needed = row['Target_Value']
        
        for account in sorted_accounts:
            if amount_needed <= 0:
                break
                
            if account['Remaining'] > 0:
                # How much of this asset can we fit in this account?
                amount_to_place = min(amount_needed, account['Remaining'])
                
                # Update tracking
                account['Holdings'][asset] = amount_to_place
                account['Remaining'] -= amount_to_place
                amount_needed -= amount_to_place
                
                final_allocation.append({
                    'Account': account['Name'],
                    'Asset': asset,
                    'Value': amount_to_place,
                    'Tax_Type': 'Tax-Free' if account['Priority'] == 1 else ('Deferred' if account['Priority'] == 2 else 'Taxable')
                })
                
    return pd.DataFrame(final_allocation)

# --- UI LAYOUT ---

st.title("📉 Shannon's Demon & Risk Parity Rebalancer")
st.markdown("""
**Goal:** Harvest volatility premiums (Shannon's Demon) while minimizing tax drag.
1. Calculates **Risk Parity Targets** (Inverse Volatility) using live data.
2. Checks if your portfolio has drifted beyond your **Rebalance Band**.
3. Suggests trades based on **Asset Location** (Bonds in IRAs, Stocks in Taxable).
""")

with st.sidebar:
    st.header("1. Portfolio Configuration")
    tickers_input = st.text_area("Tickers (comma separated)", "SPY, TLT, GLD, VNQ, EEM", height=70)
    tickers = [t.strip().upper() for t in tickers_input.split(',')]
    
    lookback = st.selectbox("Volatility Lookback", ["3mo", "6mo", "1y", "2y"], index=2)
    rebalance_band = st.slider("Rebalance Threshold (%)", 1, 20, 5, help="Only rebalance if drift > X%. Tighter bands = more trades (Shannon's Demon) but higher costs.")

    st.header("2. Current Account Balances")
    taxable_bal = st.number_input("Taxable Brokerage ($)", min_value=0.0, value=50000.0, step=1000.0)
    trad_bal = st.number_input("Traditional IRA / 401k ($)", min_value=0.0, value=30000.0, step=1000.0)
    roth_bal = st.number_input("Roth IRA ($)", min_value=0.0, value=20000.0, step=1000.0)
    
    total_equity = taxable_bal + trad_bal + roth_bal
    st.metric("Total Portfolio Value", f"${total_equity:,.2f}")

# --- MAIN LOGIC ---

if st.button("Analyze & Generate Trades"):
    with st.spinner('Fetching market data and optimizing...'):
        try:
            # 1. Get Data & Calculate Targets
            vols, prices = get_market_data(tickers, period=lookback)
            target_weights = calculate_risk_parity_weights(vols)
            
            st.subheader("1. Risk Parity Targets (Inverse Volatility)")
            
            # Display Weights & Vols
            col1, col2 = st.columns(2)
            
            display_df = pd.DataFrame({
                'Volatility (Ann.)': vols,
                'Target Weight': target_weights,
                'Target Value ($)': target_weights * total_equity
            }).sort_values(by='Target Weight', ascending=False)
            
            col1.dataframe(display_df.style.format({
                'Volatility (Ann.)': '{:.2%}',
                'Target Weight': '{:.2%}',
                'Target Value ($)': '${:,.2f}'
            }))
            
            fig = px.pie(display_df, values='Target Weight', names=display_df.index, title='Risk Parity Allocation')
            col2.plotly_chart(fig, use_container_width=True)
            
            # 2. Asset Location Optimization
            st.subheader("2. Tax-Efficient Account Placement")
            st.info(f"Distributing assets to prioritize putting Tax-Inefficient assets (e.g., Bonds, REITs) into Tax-Advantaged accounts.")
            
            accounts = {
                'Taxable Account': taxable_bal,
                'Traditional IRA/401k': trad_bal,
                'Roth IRA': roth_bal
            }
            
            allocation_plan = optimize_asset_location(total_equity, target_weights, accounts)
            
            # Pivot for readability
            pivot_plan = allocation_plan.pivot_table(index='Asset', columns='Account', values='Value', fill_value=0)
            st.dataframe(pivot_plan.style.format("${:,.0f}"))

            # 3. Trade Generation (Mockup logic for rebalancing)
            st.subheader("3. Action Plan (Shannon's Demon)")
            
            st.markdown(f"""
            *Logic: If you hold these positions currently, calculate the difference. 
            Only execute trades if the weight drift exceeds **{rebalance_band}%** to capture volatility variance.*
            """)
            
            # Group by Account for the "Shopping List"
            for account in accounts.keys():
                st.markdown(f"**{account}**")
                subset = allocation_plan[allocation_plan['Account'] == account]
                if subset.empty:
                    st.write("No assets allocated to this account.")
                else:
                    # Calculate shares
                    subset = subset.copy()
                    subset['Current_Price'] = subset['Asset'].map(prices)
                    
                    # Validate prices before division
                    if subset['Current_Price'].isna().any() or (subset['Current_Price'] <= 0).any():
                        st.warning(f"Warning: Some assets in {account} have invalid prices. Shares calculation skipped.")
                        st.table(subset[['Asset', 'Value', 'Current_Price']].style.format({
                            'Value': '${:,.2f}',
                            'Current_Price': '${:,.2f}'
                        }))
                    else:
                        subset['Shares_To_Own'] = subset['Value'] / subset['Current_Price']
                        
                        st.table(subset[['Asset', 'Value', 'Current_Price', 'Shares_To_Own']].style.format({
                            'Value': '${:,.2f}',
                            'Current_Price': '${:,.2f}',
                            'Shares_To_Own': '{:,.2f}'
                        }))

        except Exception as e:
            st.error(f"An error occurred: {e}")
            st.warning("Make sure the tickers are valid and Yahoo Finance is accessible.")

else:
    st.info("Adjust settings in the sidebar and click 'Analyze' to start.")

# --- FOOTER ---
st.markdown("---")
st.caption("Disclaimer: This is a simulation tool for educational purposes. It does not constitute financial advice. Tax efficiency rules are simplified heuristics.")
