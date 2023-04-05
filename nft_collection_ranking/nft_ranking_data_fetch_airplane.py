import airplane
import pandas as pd
import requests
import json
from pprint import pprint
from pymongo import MongoClient, UpdateOne
import os
from dotenv import load_dotenv

load_dotenv()
@airplane.task()
def main():
    MONGODB_CONNECTION = os.getenv('MONGODB_CONNECTION')

    # Connect to MongoDB
    client = MongoClient(MONGODB_CONNECTION)
    db = client.historical_price_data
    col = db.nft_collection_ranking
    col.create_index("Rank", unique=True)

    url = "https://data-api.nftgo.io/eth/v1/market/rank/collection/7d?by=volume&with_rarity=false&asc=false&offset=0&limit=30"
    headers = {
		"accept": "application/json",
		"X-API-KEY": "3c27ac7e-c126-4f25-9238-4c289cb53558"
	}

    pd.set_option('display.float_format', '{:,.2f}'.format)

    response = requests.get(url, headers=headers)
    response = response.json()
    collections = response['collections']
    pprint(collections[0])

    docs = []
    for i, collection in enumerate(collections):

        contract = collection["contracts"][0]
        # Get additional data for each collection based on contract address
        collection_metrics_url = "https://data-api.nftgo.io/eth/v1/collection/" + contract + "/metrics"
        metrics = requests.get(collection_metrics_url, headers=headers)
        metrics = metrics.json()

        doc = {
            "Rank": i + 1,
            "name": collection["name"], 
            "volume_usd": collection["volume_usd"], 
            "market_cap_usd": collection["market_cap_usd"], 
            "floor_price_eth": collection["floor_price_eth"], 
            "floor_price_usd": collection["floor_price_usd"],
            "floor_change_24hr": metrics['floor_price_change_percentage']['24h'],
            "floor_change_7d": metrics['floor_price_change_percentage']['7d'],
            "floor_change_30d": metrics['floor_price_change_percentage']['30d'], 
            "total_supply": metrics['total_supply'],
            "holder_num": collection["holder_num"],
        }

        docs.append(doc)

    # Write docs to MongoDB using bulk write
    operations = [UpdateOne({"Rank": doc["Rank"]}, {"$set": doc}, upsert=True) for doc in docs]
    result = col.bulk_write(operations)
