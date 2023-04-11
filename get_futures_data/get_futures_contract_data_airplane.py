import airplane
import requests
import json
from pprint import pprint

# @airplane.task(
#     slug="get_futures_contract_data",
#     name="get_futures_contract_data",
# )
# def get_futures_contract_data():

markets = ["bitfinex", "bybit", "binance", "bitmex", "crosstower", "deribit", "kraken", "okex", "cryptodotcom"]
url = 'https://data-api.cryptocompare.com/futures/v1/markets/instruments'

# Create an empty dictionary to store the instruments for each market
market_instruments = {}

for market in markets:
    params = {'market': market}

    response = requests.get(url, params=params)

    if response.status_code == 200:
        data = response.json()
        instruments = data["Data"][market]["instruments"]
        market_instruments[market] = []
        market_instruments[market] = [instrument for instrument in instruments.keys() if "BTC" in instrument]
    else:
        print("Error:", response.status_code, response.text)

# Print the resulting dictionary mapping each market to its BTC instruments
# pprint(market_instruments)


# Iterate through this dictionary and pull open interest (Open Quote) data for the last 2000 days
# This should be stored in a list of json objects
# where the key is the date, which mapps to a list of aggregated open interest for each exchange.

base_url = "https://data-api.cryptocompare.com/futures/v1/historical/open-interest/days"
open_quotes_agg = {}

for exchange, instruments in market_instruments.items():
    print("exchange: ", exchange)
    for instrument in instruments:
        print("intrument: ", instrument)
        url = f"{base_url}?market={exchange}&instrument={instrument}&limit=2000"
        response = requests.get(url)

        if response.status_code == 200:
            data = response.json()
            records = data['Data']

            for record in records:

                timestamp = record.get('TIMESTAMP')
                open_quote = record.get('OPEN_QUOTE')

                if timestamp in open_quotes_agg:
                    if exchange in open_quotes_agg[timestamp]:
                        open_quotes_agg[timestamp][exchange] += open_quote
                    else:
                        open_quotes_agg[timestamp][exchange] = open_quote
                else:
                    open_quotes_agg[timestamp] = {exchange: open_quote}
        else:
            print(f"Error for {exchange} {instrument}: {response.status_code}")

result = []
for timestamp, exchanges_agg in open_quotes_agg.items():
    result.append({timestamp: exchanges_agg})

pprint(result)
