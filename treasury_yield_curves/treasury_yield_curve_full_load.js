const { MongoClient } = require("mongodb");
const axios = require("axios");
const parser = require('xml2json');
require('dotenv').config()

const URL = process.env.MONGODB_CONNECTION;;
const client = new MongoClient(URL);
const db = client.db("historical_price_data")
const col = db.collection("treasury_yield_curves");

// Data source:
// https://home.treasury.gov/treasury-daily-interest-rate-xml-feed

export default async function(params) {
  
    try{
        // Initial data load - To loop through all pages, increments page number by one until there is no data inside the "<entry>" tag. For each page, pull the data into an array then write it to the db
        // Daily Update - we should also have a function that just pulls recent data

        await client.connect()
        let page = 0
        let done = false

        while(!done) {
            // increment page with each iteration
            const url = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value=all&page=${page}`
            const xmlData = await getData(url);
            const jsonData = parser.toJson(xmlData, {object:true})
            let entries

            if(jsonData.feed.entry !== undefined) {
                entries = jsonData.feed.entry
            } else {
                // there is no more data
                done = true
                break
            }

            const mappedArr = entries.map((element, index, array) => {
                let mappedElement = {}
                console.dir(element.content["m:properties"])
                for (const row in element.content["m:properties"]) {
                    if (row == 'd:NEW_DATE') {
                        // console.dir(element.content["m:properties"][row]["$t"])
                        // console.dir(Date.parse(element.content["m:properties"][row]["$t"]))
                        const str = element.content["m:properties"][row]["$t"]
                        mappedElement["date"] = str.substring(0,str.indexOf('T'))
                        mappedElement["timestamp"] = Date.parse(str)   
                    } else {
                        mappedElement[row.substring(2).toLowerCase()] = parseFloat(element.content["m:properties"][row]["$t"])
                    }
                }
                return mappedElement
            })
            // console.dir(mappedArr)
            col.createIndex( { "date": 1 }, { unique: true } )
            await col.insertMany(mappedArr);
            page++
        }
    } catch(err) {
        console.error("An error occurred: " + err)
    } finally {
        await client.close()
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
