const { MongoClient, MongoBulkWriteError } = require("mongodb");
const axios = require("axios");
const parser = require('xml2json');
require('dotenv').config()

const URL = process.env.MONGODB_CONNECTION;
const client = new MongoClient(URL);
const db = client.db("historical_price_data")
const col = db.collection("usd_liquidity_conditions_index");
let result

export default async function() {
  
  try {

    await client.connect()
    const walcl = await getData('WALCL')
    const rrpontsyd = await getData('RRPONTSYD')
    const wdtgal = await getData('WDTGAL')

    let usdLiquidityConditionsIndex = []
    // map a new array calculating the index from componet parts
    for(let i=0; i<walcl.length; i++) {
      // look at the first date in wacl then search for a matching date in wdtgal
      const wdtgal_result = wdtgal.find(({ date }) => date === walcl[i].date);
      const rrpontsyd_result = rrpontsyd.find(({ date }) => date === walcl[i].date);
  
      if(wdtgal_result && rrpontsyd_result ) {
  
        const walclVal = parseFloat(walcl[i].value)
        const wdtgalVal = parseFloat(wdtgal_result.value)
        const rrpontsydVal = isNaN(rrpontsyd_result.value) ? 0.0 : parseFloat(rrpontsyd_result.value)
        const liquidityIndexVal = ( walclVal - (wdtgalVal + rrpontsydVal * 1000.0) )
  
        usdLiquidityConditionsIndex.push({
          date: walcl[i].date,
          walcl: walclVal,
          wdtgal: wdtgalVal,
          rrpontsyd: rrpontsydVal,
          liquidity_index: liquidityIndexVal
        })
      } else {
        continue
      }

    }
    
    // const usdLiquidityConditionsIndex = walcl.map((element) => {
      
    // })

    col.createIndex( { "date": 1 }, { unique: true } )
    const data = await col.insertMany(usdLiquidityConditionsIndex, {ordered:false});
    console.log(`Records Inserted: ${data.insertedCount}`)

    // console.log(`Records Inserted: ${JSON.stringify(err.result.result.nInserted)}`)
    
  } 
  catch (err) {
    if (err instanceof MongoBulkWriteError) {
      console.log(`Skipping duplicates - Records Inserted: ${err.result.nInserted}`)
    } else {
      throw err
    }
  } finally {
    await client.close()
  }
}

async function getData(id) {
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=548c3cd93771c7a37f7a593639e0ca8a`
  return axios.get(url)
    .then(response => {
        if (!response === 200) {
            throw new Error(
                `This is an HTTP error: The status is ${response.status}`
            );
        }
        const json = parser.toJson(response.data, {object:true});
        return json.observations.observation
    })

}
