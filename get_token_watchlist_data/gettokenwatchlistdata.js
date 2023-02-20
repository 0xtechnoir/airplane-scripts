const { MongoClient } = require("mongodb");
const axios = require("axios");
require('dotenv').config()

const URL = process.env.MONGODB_CONNECTION;
const cryptoRankAPIKey = process.env.CRYPTORANK_API_KEY;
const client = new MongoClient(URL);

export default async function() {
  
  try {
    
    await client.connect()
    const db = client.db("historical_price_data")
    const tokens = 'MANA,SAND,ILV,GALA,AXS,RNDR,ENJ,WAXP'
    const response = await axios.get(`https://api.cryptorank.io/v1/currencies?api_key=${cryptoRankAPIKey}&symbols=${tokens}`)
    
    
    const data = response.data.data  
    for(let i=0 ; i< data.length; i++) {
      
      let fdv, maxSupply
      if (data[i].maxSupply) {
        // the token has a capped limit
        fdv = data[i].values.USD.price * data[i].maxSupply
        maxSupply = data[i].maxSupply
      }
      
      const percChange24h = data[i].values.USD.percentChange24h > 0 ? `${data[i].values.USD.percentChange24h.toFixed(2)}%` : `(${Math.abs(data[i].values.USD.percentChange24h.toFixed(2))}%)`
      const percChange7d = data[i].values.USD.percentChange7d > 0 ? `${data[i].values.USD.percentChange7d.toFixed(2)}%` : `(${Math.abs(data[i].values.USD.percentChange7d.toFixed(2))}%)`
      const percChange30d = data[i].values.USD.percentChange30d > 0 ? `${data[i].values.USD.percentChange30d.toFixed(2)}%` : `(${Math.abs(data[i].values.USD.percentChange30d.toFixed(2))}%)`
      const percChange3m = data[i].values.USD.percentChange3m > 0 ? `${data[i].values.USD.percentChange3m.toFixed(2)}%` : `(${Math.abs(data[i].values.USD.percentChange3m.toFixed(2))}%)`
      const percChange6m = data[i].values.USD.percentChange6m > 0 ? `${data[i].values.USD.percentChange6m.toFixed(2)}%` : `(${Math.abs(data[i].values.USD.percentChange6m.toFixed(2))}%)`
      
      const document = {
        "coin_id": data[i].id,
        "token": data[i].symbol.toUpperCase(),
        "rank": data[i].rank,
        "price": Intl.NumberFormat().format(data[i].values.USD.price),
        "price_change_pc_24hr": percChange24h,
        "price_change_pc_7d": percChange7d,
        "price_change_pc_30d": percChange30d,
        "price_change_pc_3m": percChange3m,
        "price_change_pc_6m": percChange6m,
        "volume_24h": abbreviate(data[i].values.USD.volume24h, 2, false, false),
        "market_cap": abbreviate(data[i].values.USD.marketCap, 2, false, false),
        "fdv": fdv ? abbreviate(fdv, 2, false, false) : '-',
        "circulating_supply": abbreviate(data[i].circulatingSupply, 2, false, false),
        "total_supply" : abbreviate(data[i].totalSupply, 2, false, false),
        "max_supply": maxSupply ? abbreviate(parseInt(data[i].maxSupply), 2, false, false) : '-',
        "pc_circulating": maxSupply ? ((data[i].circulatingSupply / data[i].maxSupply) * 100).toFixed(0) : '100'
      }

      const query = { coin_id: data[i].id }
      const update = document
      const options = { upsert: true }
      const col = db.collection("token_watchlist");
      col.createIndex( { "coin_id": 1 }, { unique: true } )
      const result = await col.replaceOne(query, update, options);  
    }
  } catch (err) {
    console.log("Caught Error: " + err)
      throw err
  } finally {
    console.log("closing connection")
    await client.close()
    console.log("Disconnected")
  }
}

function abbreviate(number, maxPlaces, forcePlaces, forceLetter) {
  number = Number(number)
  forceLetter = forceLetter || false
  if(forceLetter !== false) {
      return annotate(number, maxPlaces, forcePlaces, forceLetter)
  }
  var abbr
  if(number >= 1e12) {
      abbr = 'T'
  }
  else if(number >= 1e9) {
      abbr = 'B'
  }
  else if(number >= 1e6) {
      abbr = 'M'
  }
  else if(number >= 1e3) {
      abbr = 'K'
  }
  else {
      abbr = ''
  }
  return annotate(number, maxPlaces, forcePlaces, abbr)
}

function annotate(number, maxPlaces, forcePlaces, abbr) {
  // set places to false to not round
  var rounded = 0
  switch(abbr) {
    case 'T':
      rounded = number / 1e12
      break
    case 'B':
      rounded = number / 1e9
      break
    case 'M':
      rounded = number / 1e6
      break
    case 'K':
      rounded = number / 1e3
      break
    case '':
      rounded = number
      break
  }
  if(maxPlaces !== false) {
    var test = new RegExp('\\.\\d{' + (maxPlaces + 1) + ',}$')
    if(test.test(('' + rounded))) {
      rounded = rounded.toFixed(maxPlaces)
    }
  }
  if(forcePlaces !== false) {
    rounded = Number(rounded).toFixed(forcePlaces)
  }
  return rounded + abbr
}