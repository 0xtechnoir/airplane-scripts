const { MongoClient } = require("mongodb");
const axios = require("axios");
require('dotenv').config()

const URL = process.env.MONGODB_CONNECTION;
const client = new MongoClient(URL);
let ethereumPriceData = []

export default async function() {
  
  try {
    
    await client.connect()
    const db = client.db("historical_price_data")
    const tokens = ['decentraland', 'gala', 'illuvium', 'the-sandbox', 'axie-infinity', 'enjincoin', 'render-token', 'wax']
	  const startDate = 1609462800 // Jan 1st 2021
    const endDate = Math.round(Date.now() / 1000)
    const col = db.collection("historical_token_watchlist_price_data");
  
    // First pull ethereum prices
    const ethereumData = await getPriceData("ethereum", startDate, endDate)
    ethereumPriceData = mapPriceData(ethereumData, "ethereum")
    
    col.createIndex( { "token" : 1 }, { unique: true } )
  
    for (let i = 0; i < tokens.length; i++) {
      await sleep(5000) // wait 5 seconds to avoid throttling 

      const data = await getPriceData(tokens[i], startDate, endDate)
      const mappedData = mapPriceData(data, tokens[i])

      const update =  {
          "token" : tokens[i],
          "data" : mappedData
        }
      
      const query = { "token": update.token }
      const options = { upsert: true }

      const result = await col.replaceOne(query, update, options);
      if(result.modifiedCount == 1) {
        console.log(`${update.token} record updated`)
      } else if (result.upsertedCount == 1) {
        console.log(`${update.token} record inserted`)
      } else {
        console.log(`Error writing data for ${update.token}. Result: ${result}`)
      }
      
    }
  } catch (err) {
    console.log("Caught Error: " + err)
    throw err
  } finally {
    await client.close()
    console.log("Client Disconnected")
  }
}

async function getPriceData(_coinName, _startDate, _endDate) {
  const URL = `https://api.coingecko.com/api/v3/coins/${_coinName}/market_chart/range?vs_currency=usd&from=${_startDate}&to=${_endDate}`
  const data = await axios.get(URL)
  console.log(`Data retrieved successfully for ${_coinName}: ${data.status == 200 ? 'Yes' : 'No'}`)
  return data.data.prices
}

function mapPriceData(priceDataArray, _coinName) {
	
	return priceDataArray.map((element, index, array) => {
    console.log(JSON.stringify(element))
  
		const firstValueInUSD = array[0][1]
		const currentValueInUSD = element[1]

		const firstValueInETH = (_coinName == "ethereum") ? 1 : calculateEthPrice(array[0])
		const currentValueInETH = (_coinName == "ethereum") ? 1 : calculateEthPrice(element)

		// calculate indexed USD value 
		let indexedValueUSD, indexedValueETH
		if (index < 1) {
			indexedValueUSD = 100
			indexedValueETH = 100
		} else {
			indexedValueUSD = 100 * ( currentValueInUSD / firstValueInUSD)
			indexedValueETH = 100 * ( currentValueInUSD / firstValueInETH)
		} 
  
		return {
			"timestamp" : element[0],
      "date": new Date(element[0]).toLocaleString(),
			"usd_value" : parseFloat(element[1]),
			"eth_value" : currentValueInETH,
			"indexed_usd_value": indexedValueUSD,
			"indexed_eth_value": indexedValueETH,
		}
	})

}

function calculateEthPrice(tokenElement) {
  const timestamp = tokenElement[0]
  const ethElement = ethereumPriceData.find(x => x.timestamp == timestamp)
  return tokenElement[1] / ethElement.usd_value
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}