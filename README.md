# node-trading-bot 
Trading bot based on grid strategy (more coming) for Binance (KuCoin next) made in Node JS to earn money in the form of passive income thanks to the crypto market volatility.

## What Is Grid Trading?
Grid trading is when orders are placed above and below a set price, creating a grid of orders at incrementally increasing and decreasing prices. Grid trading is most commonly associated with the foreign exchange market. Overall the technique seeks to capitalize on normal price volatility in an asset by placing buy and sell orders at certain regular intervals above and below a predefined base price.

## In order to use this bot, you need to create a .env file at the application root level as follow

APP_SLEEP_TIME=in-milliseconds

APP_PRICE_PERCENT=in-percent-like-0.2

APP_BINANCE_APIKEY=your-binance-apikey

APP_BINANCE_SECRET=your-binance-secret

# This bot run as a process
For example, from inside the docker container or server run as follow:

`
node app.js ROSE BUSD 200
`

Or using the keyword "resume" at the end to restart the process from the last state:

`
node app.js ROSE BUSD 200 resume
`

## Params description
- First param: ticker symbols of the crypto to trade, for example BTC, ETH or MATIC.
- Second param: ticker symbols of the crypto to pair with, usually an stable coin like USDT
- Third parameter: the amount of crypto to buy in each iteration of the bot
- Four parameter: it's option only if you want continue the last execution

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
