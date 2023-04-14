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

@airplane.task(
    slug="get_top_web3_games",
    name="get_top_web3_games",
)
def get_top_web3_games():

    url = "https://api.footprint.network/api/v1/native"

    payload = {"query": "select * from ethereum_token_transfers where block_timestamp >= date_add('day',-1,current_date) limit 10"}
    headers = {
        "accept": "application/json",
        "api-key": "8NgCNAl+m/6P6hA/HY1TI3k0zVkLqpOhHkRdXBolzHGAeFp4kn7OXQMCdGNpsDYp",
        "content-type": "application/json"
    }

    response = requests.post(url, json=payload, headers=headers)

    print(response.text)






    


