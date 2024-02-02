const { MongoClient } = require("mongodb");
const axios = require("axios");
require('dotenv').config()

const URL = process.env.MONGODB_CONNECTION;
const cryptoRankAPIKey = process.env.CRYPTORANK_API_KEY;
const client = new MongoClient(URL);

export default async function() {

/*
Token IDs:

MANA  121
SAND  21407
ILV   29958
GALA  23865
AXS   26691
RNDR  7481
ENJ   112
WAXP  105
AURY  170039
MYTH  178125
PRIME 181246
APE   173608
MAGIC 169601
RONIN 172730
UOS   7847
DAR   170227
SWEAT 176027
RAINI 50207
PET   157367FF
WRLD  27705
DUST  174085
GUILD 171188
ALU   7314
GQ    173270
NAKA  101315
EJS   169622
REVO  30524
HIGH  169597
WEMIX 26764
CROWN 183271
GFAL  179147
BEAM  186254
SHRAP 174652
MYRIA 181281
ELU     170492
BIGTIME 179870
SENATE  170918
DIO     171924
SUPER   29242
SIPHER  171614
IMX     165915
MC      5355
GMT     173314
LORDS   122013 (Realms)
METAL   173031
PAPER   169100
TOPIA   185652
GSWIFT  185362
AOF     187681
FAR     186604
MXM     179114
*/

  try {
    
    await client.connect()
    const db = client.db("historical_price_data")
    coinIDs = '121,21407,29958,23865,26691,7481,112,105,170039,178125,181246,173608,169601,172730,7847,170227,176027,50207,157367,27705,174085,171188,7314,173270,101315,169622,30524,169597,26764,183271,179147,186254,174652,181281,170492,179870,170918,171924,29242,171614,165915,5355,173314,122013,173031,169100,185652,185362,187681,186604,179114'
    // const response = await axios.get(`https://api.cryptorank.io/v1/currencies?api_key=${cryptoRankAPIKey}&symbols=${tokens}`)
    const response = await axios.get(`https://api.cryptorank.io/v1/currencies?api_key=${cryptoRankAPIKey}&ids=${coinIDs}`)
  
    const data = response.data.data  
    for(let i=0 ; i< data.length; i++) {

      console.log(data[i])
      
      let fdv, maxSupply
      if (data[i].maxSupply) {
        // the token has a capped limit
        fdv = data[i].values.USD.price * data[i].maxSupply
        maxSupply = data[i].maxSupply
      } else if (data[i].totalSupply) {
        // if maxSupply is missing use total supply to calc fdv
        fdv = data[i].values.USD.price * data[i].totalSupply
      }

      function getFormattedPercentChange(dataItem, property) {
        const value = dataItem?.values?.USD?.[property] ?? null;
        return value === null 
            ? null 
            : (value >= 0 
                ? `${value.toFixed(2)}%` 
                : `(${Math.abs(value.toFixed(2))}%)`);
    }
    
      const percChange24h = getFormattedPercentChange(data[i], 'percentChange24h');
      const percChange7d = getFormattedPercentChange(data[i], 'percentChange7d');
      const percChange30d = getFormattedPercentChange(data[i], 'percentChange30d');
      const percChange3m = getFormattedPercentChange(data[i], 'percentChange3m');
      const percChange6m = getFormattedPercentChange(data[i], 'percentChange6m');
      
      const price = data[i].values.USD.price
      const vol24h = data[i].values.USD.volume24h
      const mc = data[i].values.USD.marketCap
      const circSupply = data[i].circulatingSupply
      const totalSupply = data[i].totalSupply

      console.log("Token Name: ", data[i].symbol.toUpperCase())
      console.log("Circ Supply: ", data[i].circulatingSupply)

      const document = {
        "coin_id": data[i].id,
        "token": data[i].symbol.toUpperCase(),
        "rank": data[i].rank,
        "price": price,
        "price_change_pc_24hr": percChange24h,
        "price_change_pc_7d": percChange7d,
        "price_change_pc_30d": percChange30d,
        "price_change_pc_3m": percChange3m,
        "price_change_pc_6m": percChange6m,
        "volume_24h": vol24h ? vol24h : null,
        "market_cap": mc ? mc : null,
        "fdv": fdv ? fdv : null,
        // "circulating_supply": abbreviate(data[i].circulatingSupply, 2, false, false),
        "circulating_supply": circSupply ? circSupply : null,
        "total_supply" : totalSupply ? totalSupply : null,
        "max_supply": maxSupply ? maxSupply : null,
        "pc_circulating": (maxSupply && circSupply && maxSupply != 0) ? ((circSupply / maxSupply) * 100) : null
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