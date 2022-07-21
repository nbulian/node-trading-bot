const Binance = require('node-binance-api')
const cli = require('nodemon/lib/cli')
const client = new Binance().options({
    APIKEY: process.env.APP_BINANCE_APIKEY,
    APISECRET: process.env.APP_BINANCE_SECRET
})
module.exports = client