const { MongoClient } = require("mongodb");
const axios = require("axios");
const parser = require('xml2json');

const URL = "mongodb+srv://bkCryptoTeam:Vw01wuSjeNkyeZrj@cluster0.tmpq7.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(URL);
const db = client.db("macro_financial_data")
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
                for (const row in element.content["m:properties"]) {
                    if (row == 'd:NEW_DATE') {
                        mappedElement[row.substring(2).toLowerCase()] = Date.parse(element.content["m:properties"][row]["$t"])
                    } else {
                        mappedElement[row.substring(2).toLowerCase()] = parseFloat(element.content["m:properties"][row]["$t"])
                    }
                }
                return mappedElement
            })
            console.dir(mappedArr)
            col.createIndex( { "new_date": 1 }, { unique: true } )
            await col.insertMany(mappedArr);
            page++
        }
    } catch(err) {
        console.error("An error occurred: " + e)
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
