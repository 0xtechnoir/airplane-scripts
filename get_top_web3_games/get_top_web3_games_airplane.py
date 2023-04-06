import airplane
import os
from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver import FirefoxOptions
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import requests
from pprint import pprint
from pymongo import MongoClient, UpdateOne
import time
import random

load_dotenv()

# API Calls per run
# Paginating through Dapp data - 277 calls
# Retrieving metrics for each of the 26 dapps - 78 calls
# Total 355 per run

# Allows us to insert a random delay in the calling of the API endpoints
#  This is a measure to try and avoid bot detection and IP throttling 
def random_sleep(min_seconds=3, max_seconds=6):
    sleep_duration = random.uniform(min_seconds, max_seconds)
    print("Waiting: ", sleep_duration, " seconds")
    time.sleep(sleep_duration)

@airplane.task(
    slug="get_top_web3_games",
    name="get_top_web3_games",
)
def get_top_web3_games(url: str = 'https://dappradar.com/rankings/category/games?period=week'):
    """
    Loads up the top games page on DappRadar and scrapes the names from the first page. 
    Calls the 'Get Multiple Daaps data' DappRadar endpoint and cycles through the paginated database find the dappIds of each game.
    Then uses the list of dappIds created to call the 'Get single Dapp data' endpoint and retrieve dapp mertics for each game.

    Args:
        url: URL to fetch.

    Returns:
        Writes top 25 games metrics to mongodb copllection
    """

    # ============ Scrape DappRadar Top Web3 Games Page ==============

    opts = FirefoxOptions()
    opts.add_argument("--headless")
    names = set()

    with webdriver.Firefox(options=opts) as driver:

        driver.get(url)

          # Define a wait object with a timeout
        wait = WebDriverWait(driver, 10)  # Timeout of 10 seconds

        # Wait for at least one element to be present with the specified class name
        wait.until(EC.presence_of_element_located((By.CLASS_NAME, 'dapp-name-link-comp')))

        elements = driver.find_elements(By.CLASS_NAME, "dapp-name-link-comp")
        for elem in elements:
            name = elem.text
            if name:
                names.add(name)
       
    print(names)

    # ============ Call Dapp Radar "Get multiple Dapps data" endpoint ==============

    # Cycle through every page of apps and add them all to the list
    # Use the list of dapps scraped from DappRadars website to copy the top dapps into a new list

    DAPP_RADAR_API_KEY = os.getenv('DAPP_RADAR_API_KEY')

    project = "4tsxo4vuhotaojtl"
    url = "https://api.dappradar.com/" + project + "/dapps"

    query = {
        "page": "1",
        "resultsPerPage": "50"
    }

    headers = {"X-BLOBR-KEY": DAPP_RADAR_API_KEY}

    response = requests.get(url, headers=headers, params=query)
    data = response.json()
    pprint(data)

    page_count = data['pageCount']
    print("Pages to Query: ", page_count)

    # Initialize an empty global list to store all results
    dappIds = []

    # Loop through all pages from 1 to pageCount (inclusive)
    for page in range(1, page_count + 1):
        random_sleep()
        print("querying page: ", page)
        query['page'] = str(page)
        response = requests.get(url, headers=headers, params=query)
        if response.status_code == 200:
            data = response.json()
            results = data['results']
            
            # for every result on the page, check and see if the dapp name is in the list we scraped from DappRadar
            # If a match is found add the dappId to dappIds list and remove the name from the ori9ginal list
            for result in results:
                if result['name'] in names:
                    print("Found: ", result['name'])
                    dappIds.append(result['dappId'])
                    names.remove(result['name'])

            if not names:  # Break the loop if all names have been found
                break
        else:
            break

    pprint("DappIds: {}".format(dappIds))

    # dappIds_test = [2194, 3388, 3517, 3803, 5314, 6249, 6969, 8430, 8948, 9001, 9152, 9495, 12162, 14556, 14612, 14696, 14795, 15631, 16824, 18031, 18111, 25136, 25939, 27978, 30197, 32757]

    # ============ Use the list of dappIds created to call the 'Get single Dapp data' endpoint and retrieve dapp mertics for each game ==============
    
    dappdata = []

    for index, id in enumerate(dappIds):

        print("Pulling metrics for dappId: ", id)
        
        project = "4tsxo4vuhotaojtl"
        url = "https://api.dappradar.com/" + project + "/dapps/" + str(id)
        headers = {"X-BLOBR-KEY": DAPP_RADAR_API_KEY}

        # We want to get dapp metrics for 24h, 7D and 30D
        random_sleep()
        response_24h = requests.get(url, headers=headers, params={"range": "24h"})
        data_24h = response_24h.json()
        random_sleep()
        response_7d = requests.get(url, headers=headers, params={"range": "7d"})
        data_7d = response_7d.json()
        random_sleep()
        response_30d = requests.get(url, headers=headers, params={"range": "30d"})
        data_30d = response_30d.json()
        
        # Create a document to write to mongodb
        doc = {
            "Index": index,
            "Name": data_24h['results']['name'],
            "24H metrics": data_24h['results']['metrics'],
            "7D metrics": data_7d['results']['metrics'],
            "30D metrics": data_30d['results']['metrics'],
            "Chain": data_24h['results']['chains']
        }
        dappdata.append(doc)
            
    print("Establishing connection to Mongodb")

    # Finally we want to add all these docs to mongodb
    # Connect to MongoDB
    MONGODB_CONNECTION = os.getenv('MONGODB_CONNECTION')
    client = MongoClient(MONGODB_CONNECTION)
    db = client.historical_price_data
    col = db.top_web3_games
    col.create_index("Index", unique=True)
   
    print("Writing documents")
    operations = [UpdateOne({"Index": doc["Index"]}, {"$set": doc}, upsert=True) for doc in dappdata]
    result = col.bulk_write(operations)

    result_info = {
        'inserted': result.inserted_count,
        'matched': result.matched_count,
        'modified': result.modified_count,
        'upserted': result.upserted_count,
        'deleted': result.deleted_count,
        'upserted_ids': result.upserted_ids,
    }

    print("Results")
    pprint(result_info)






    


