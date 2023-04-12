import airplane
import requests
import json
from pprint import pprint

@airplane.task(
    slug="get_futures_contract_data",
    name="get_futures_contract_data",
)
def get_futures_contract_data():

    markets = ["bitfinex", "bybit", "binance", "bitmex", "crosstower", "deribit", "kraken", "okex", "cryptodotcom"]
    url = 'https://data-api.cryptocompare.com/futures/v1/markets/instruments'

    # Create an empty dictionary to store the instruments for each market
    market_instruments = {}

    # Pull the names of all USD/BTC instruments from each market and store them in a dictionary, keyed by market name 
    for market in markets:
        params = {'market': market}
        response = requests.get(url, params=params)
        if response.status_code == 200:
            data = response.json()
            instruments = data["Data"][market]["instruments"]
            market_instruments[market] = []
            market_instruments[market] = [instrument for instrument in instruments.keys() if "BTC" in instrument and "USD" in instrument]
        else:
            print("Error:", response.status_code, response.text)

    aggregated_open_interest = {}
    base_url = "https://data-api.cryptocompare.com/futures/v1/historical/open-interest/days"

    # Loop through market_instruments dictionary by key (market) and by value (instrument) using a nested loop
    for market, instruments in market_instruments.items():
        print("Fetching data for market: ", market)
        # Pull historical data for each instrument for the last 2000 days
        for instrument in instruments:
            print("Fetching data for instrument: ", instrument)
            url = f"{base_url}?market={market}&instrument={instrument}&limit=2000"
            response = requests.get(url)

            if response.status_code == 200:
                data = response.json()
                records = data['Data']

                # for each historical record 
                for record in records:
                    timestamp = record.get('TIMESTAMP')
                    open_quote = record.get('OPEN_QUOTE')
                    quote_currency = record.get('QUOTE_CURRENCY')

                    # if the quote currency is USD, USDC or USDT
                    if "USD" in quote_currency:

                        # aggregated_open_interest is keyed by timestamp (day). See bottom of page for structure
                        # First check to see if a timestamp key exists
                        if timestamp in aggregated_open_interest:
                            # Then check to see if there is a nested key for the market
                            if market in aggregated_open_interest[timestamp]:
                                # If there is add the open quote amount to the existing value
                                aggregated_open_interest[timestamp][market] += open_quote
                            else:
                                # If there isn't, create a key for the market and store the open quote value
                                aggregated_open_interest[timestamp][market] = open_quote
                        else:
                            # If there is now timestamp key yet, create one.
                            aggregated_open_interest[timestamp] = {market: open_quote}
            else:
                print(f"Error for {market} {instrument}: {response.status_code}")

    result = []

    for timestamp, exchanges_agg in aggregated_open_interest.items():
        result.append({timestamp: exchanges_agg})

"""  
Example of a record in aggregated_open_interest
   
   {1678060800: {'binance': 3089612558.6351748,
               'bitfinex': 120369466.05015,
               'bitmex': 463739200,
               'bybit': 1654568290.07882,
               'crosstower': 3544097.562551,
               'cryptodotcom': 5406820.632200001,
               'deribit': 417216898.634,
               'kraken': 51692629.743799895,
               'okex': 1288364768.7196121}}, 
               
"""
