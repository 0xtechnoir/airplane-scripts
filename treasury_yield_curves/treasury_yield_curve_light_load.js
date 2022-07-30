const { MongoClient } = require("mongodb");
require('dotenv').config()

const axios = require("axios");
const parser = require('xml2json');

const URL = process.env.MONGODB_CONNECTION;
const client = new MongoClient(URL);
const db = client.db("historical_price_data")
const col = db.collection("treasury_yield_curves");

// Data source:
// https://home.treasury.gov/treasury-daily-interest-rate-xml-feed

// This task should be run daily to update the database with the most recent treasury yields

export default async function(params) {
  
    try{
        await client.connect()
    
        const d = new Date()
        const year = d.getFullYear() // current year
        const month = ("0" + (d.getMonth() + 1)).slice(-2) // current month
        const url = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value_month=${year + month}`
        const xmlData = await getData(url);
        const jsonData = parser.toJson(xmlData, {object:true})
        const entries = jsonData.feed.entry

        const mappedArr = entries.map((element) => {
            let mappedElement = {}
            for (const row in element.content["m:properties"]) {
                if (row == 'd:NEW_DATE') {
                    const str = element.content["m:properties"][row]["$t"]
                    mappedElement["date"] = str.substring(0,str.indexOf('T'))
                    mappedElement["timestamp"] = Date.parse(str)   
                } else {
                    mappedElement[row.substring(2).toLowerCase()] = parseFloat(element.content["m:properties"][row]["$t"])
                }
            }
            return mappedElement
        })

        // from the current month create an array of items that are not in the database. 
        const docsToWrite = await writeDocs(mappedArr, col) 

        if (docsToWrite.length) {
            await col.insertMany(docsToWrite);
        } else {
            console.log("No new documents to add")
        }
        
    } catch(err) {
        console.error("An error occurred: " + err)
    } finally {
        await client.close()
        console.log("Process complete. Database connection closed.")
    } 
}

async function getData(_url) {
    return axios.get(_url)
    .then(response => {
        if (!response === 200) {
            throw new Error(
                `This is an HTTP error: The status is ${response.status}`
            );
        }
        return response.data;
    })
}

async function writeDocs(mappedData, col) {   
  const docsToAdd = [];
  for (const x of mappedData){
      const count = await col.countDocuments( { date: x.date })
      if(!count) {
          docsToAdd.push(x);
          console.log(`Adding treasury yield data for: ${x.date}`)
      }
  }
  return docsToAdd
}
