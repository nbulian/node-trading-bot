# node-trading-bot 
Trading bot based on grid strategy for Binance made in Node JS to earn money in the form of passive income thanks to the crypto market volatility.

## What Is Grid Trading?
Grid trading is when orders are placed above and below a set price, creating a grid of orders at incrementally increasing and decreasing prices. Grid trading is most commonly associated with the foreign exchange market. Overall the technique seeks to capitalize on normal price volatility in an asset by placing buy and sell orders at certain regular intervals above and below a predefined base price.

## In order to use this bot, you need to create a .env file at the application root level as follow
```
APP_BINANCE_SLEEP_TIME=2000 # time in milliseconds to wait between each call to binance api
APP_IN_PERIOD_TIME=30 # bot will process messages sent in last X seconds
APP_MAX_LEVERAGE=5
APP_MIN_AMOUNT=15 # minimum amount of USDT to invest in an order
APP_MAX_AMOUNT=100 # maximum amount of USDT to invest in an order
APP_PRICE_PERCENT=0.01 # price variation on spot needed to trigger a buy order
APP_BINANCE_MIN_INVESTING=15
APP_BINANCE_SPOT_APIKEY=your-binance-apikey
APP_BINANCE_SPOT_SECRET=your-binance-secret
APP_BINANCE_SPOT_TEST_APIKEY=your-binance-apikey
APP_BINANCE_SPOT_TEST_SECRET=your-binance-secret
```
# This bot run as a process
For example, from inside the docker container or server run as follow:

`
node app.js trade ADA USDT 20 prod
`

or in Binance Test net like this:

`
node app.js trade ADA USDT 20 dev
`

Or using the keyword "resume" at the end to restart the process from the last state:

`
node app.js init ADA USDT 20 -r
`

## To obtain help from the process run this

`
node app.js -h
`

### It will show something like this

```
WELCOME TO CRYPTO TRADING SPOT BOT
Usage: node-trading-bot [options] [command]

CLI Crypto Trading Spot Bot

Options:
  -V, --version                         output the version number
  -h, --help                            display help for command

Commands:
  trade <pair1> <pair2> <amount> <env>  Initiate the crypto trading bot
  sell [options] <pair1> <pair2> <env>  sell all your open orders
  help [command]                        display help for command
```

## To obtain help from a command run like this

`
node app.js trade -h
`

### It will show 

```
WELCOME TO CRYPTO TRADING SPOT BOT
Usage: node-trading-bot trade [options] <pair1> <pair2> <amount> <env>

Initiate the crypto trading bot

Arguments:
  pair1       ticker symbol of the crypto to trade, for example BTC, ETH, MATIC, etc
  pair2       ticker symbol of the crypto to pair with, usually an stable coin like USDT, BUSD, DAI, etc
  amount      amount of crypto to buy in each iteration of the bot
  env         environment where to run (choices: "prod", "dev")

Options:
  -h, --help  display help for command
```

# Docker
Execute the following command on your terminal to create the container

`
docker-compose up --build
`

## Access the console to the created container

`
docker exec -it trading-bot /bin/bash
`

One you are inside the container you are able to run npm to install all the dependencies and then run the bot.

`
npm i
`

## Author

* **Nahuel Bulián Hernández** - [My GitHub Profile](https://github.com/nbulian)
