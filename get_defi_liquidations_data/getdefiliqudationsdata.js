import { gql, request } from "graphql-request";
const { MongoClient } = require("mongodb");
require('dotenv').config()

const DATABASE_URL = process.env.MONGODB_CONNECTION;;
const client = new MongoClient(DATABASE_URL);
const db = client.db("historical_price_data")

const query = gql`
  query users($lastId: String) {
    users(first: 1000, where: { borrowedReservesCount_gt: 0, id_gt: $lastId }) {
      id
      reserves {
        usageAsCollateralEnabledOnUser
        reserve {
          symbol
          usageAsCollateralEnabled
          underlyingAsset
          price {
            priceInEth
          }
          decimals
          reserveLiquidationThreshold
        }
        currentATokenBalance
        currentTotalDebt
      }
    }
    _meta {
      block {
        number
      }
    }
  }
`;

const ethPriceQuery = (usdcAddress) => gql`
  {
    priceOracleAsset(id: "${usdcAddress}") {
      priceInEth
    }
  }
`;

const rc = {
  "ethereum": {
    name: "aave",
    chain: "ethereum",
    usdcAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    subgraphUrl: "https://api.thegraph.com/subgraphs/name/aave/protocol-v2",
    explorerBaseUrl: "https://etherscan.io/address/",
  },
  "polygon": {
    name: "aave",
    chain: "polygon",
    usdcAddress: "0x2791bca1f2de4661ed88a30c99a7a9449aa84174",
    subgraphUrl: "https://api.thegraph.com/subgraphs/name/aave/aave-v2-matic",
    explorerBaseUrl: "https://polygonscan.com/address/",
  },
};

const  positions = async (chain) => {
  const explorerBaseUrl = rc[chain].explorerBaseUrl;
  const subgraphUrl = rc[chain].subgraphUrl;
  const usdcAddress = rc[chain].usdcAddress;
  const _ethPriceQuery = ethPriceQuery(usdcAddress);
  const users = await getPagedGql(rc[chain].subgraphUrl, query, "users");
  const ethPrice = 1 / ((await request(subgraphUrl, _ethPriceQuery)).priceOracleAsset.priceInEth / 1e18);
  const positions = users
    .map((user) => {
      let totalDebt = 0,
        totalCollateral = 0;
      const debts = (user.reserves).map((reserve) => {
        const decimals = 10 ** reserve.reserve.decimals;
        const price = (Number(reserve.reserve.price.priceInEth) / 1e18) * ethPrice;
        const liqThreshold = Number(reserve.reserve.reserveLiquidationThreshold) / 1e4; // belongs to [0, 1]
        let debt = Number(reserve.currentTotalDebt);
        if (reserve.usageAsCollateralEnabledOnUser === true) {
          debt -= Number(reserve.currentATokenBalance) * liqThreshold;
        }
        debt *= price / decimals;
        if (debt > 0) {
          totalDebt += debt;
        } else {
          totalCollateral -= debt;
        }
        return {
          debt,
          price,
          token: reserve.reserve.underlyingAsset,
          totalBal: reserve.currentATokenBalance,
          decimals,
        };
      });

      const liquidablePositions = debts
        .filter(({ debt }) => debt < 0)
        .map((pos) => {
          const usdPosNetCollateral = -pos.debt;
          const otherCollateral = totalCollateral - usdPosNetCollateral;
          const diffDebt = totalDebt - otherCollateral;
          if (diffDebt > 0) {
            const amountCollateral = usdPosNetCollateral / pos.price; // accounts for liqThreshold
            const liqPrice = diffDebt / amountCollateral;
            // if liqPrice > pos.price -> bad debt
            return {
              owner: user.id,
              liqPrice,
              collateral: `${chain}:` + pos.token,
              collateralAmount: pos.totalBal,
              extra: {
                url: explorerBaseUrl + user.id,
              },
            }
          } else {
            return {
              owner: "",
              liqPrice: 0,
              collateral: "",
              collateralAmount: "",
            };
          }
        })
        .filter((t) => !!t.owner);

      return liquidablePositions;
    })
    .flat();
  return positions;
};

async function getPagedGql(url, query, itemName){
    let lastId = "";
    let all = []
    let page;
    do {
        page = (await request(url, query, {
            lastId
        }))[itemName]
        all = all.concat(page)
        lastId = page[page.length - 1]?.id
    } while (page.length === 1e3);
    return all
}

export default async function(params) {
 
  try{
    const ethPositions = await positions("ethereum")
    const polygonPositions = await positions("polygon")
    
    let col = db.collection("etheruem_liqudation_positions");
    await col.insertMany(ethPositions)
    
    col = db.collection("polygon_liqudation_positions");
    await col.insertMany(polygonPositions)
  } catch(e) {
    console.log(e)
    throw e
  } finally {
    await client.close()
    console.log("Disconnected")
  }
  


  // console.log(ethPositions)
  // console.log(polygonPositions)

}




