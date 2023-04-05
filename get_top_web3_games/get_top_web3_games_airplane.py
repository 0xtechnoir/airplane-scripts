import airplane
import os
from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver import FirefoxOptions
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

load_dotenv()

@airplane.task(
    slug="get_top_web3_games",
    name="get_top_web3_games",
)
def get_top_web3_games(url: str = 'https://dappradar.com/rankings/category/games?period=week'):
    """
    Loads up the top games page on DappRadar and scrapes the names from the first page.

    Args:
        url: URL to fetch.

    Returns:
        A dictionary with the keys "links" and "count" indicating the
        number of links found and the list of links.
    """

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

    
    




