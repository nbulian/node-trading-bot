require('dotenv').config()
const Storage = require('node-storage')
const Binance = require('node-binance-api')
const { colors, log, logColor } = require('../utils/logger')
const { sleep, elapsedTime } = require('../utils/time')

let PAIR1 = undefined
let PAIR2 = undefined
let SYMBOL = undefined
let BUY_ORDER_AMOUNT = undefined
let storage = undefined

const binance = new Binance()

const _exchangeInfo = async (symbols) => {
    await binance.exchangeInfo(function (error, data) {
        let minimums = {};
        for (let obj of data.symbols) {
            if (symbols.includes(obj.symbol)) {
                let filters = { status: obj.status };
                for (let filter of obj.filters) {
                    if (filter.filterType == "MIN_NOTIONAL") {
                        filters.minNotional = filter.minNotional;
                    } else if (filter.filterType == "PRICE_FILTER") {
                        filters.minPrice = filter.minPrice;
                        filters.maxPrice = filter.maxPrice;
                        filters.tickSize = filter.tickSize;
                    } else if (filter.filterType == "LOT_SIZE") {
                        filters.stepSize = filter.stepSize;
                        filters.minQty = filter.minQty;
                        filters.maxQty = filter.maxQty;
                    } else if (filter.filterType == "PERCENT_PRICE") {
                        filters.multiplierUp = filter.multiplierUp;
                        filters.multiplierDown = filter.multiplierDown;
                        filters.avgPriceMins = filter.avgPriceMins;
                    }
                }
                filters.orderTypes = obj.orderTypes;
                filters.icebergAllowed = obj.icebergAllowed;
                minimums[obj.symbol] = filters;
            }
        }
        storage.put('exchange_info', minimums)
    });
}

const _updateBalances = async (isInitial) => {
    const balancesObj = await binance.balance()
    const currentBalances = storage.get('balances')
    const balances = {}

    for (const symbol in balancesObj) {
        if (balancesObj[symbol].available > 0 || balancesObj[symbol].onOrder > 0) {
            const initial = isInitial ? balancesObj[symbol].available : currentBalances.hasOwnProperty(symbol) ? currentBalances[symbol].initial : 0
            balances[symbol] = {
                initial,
                available: balancesObj[symbol].available,
                onOrder: balancesObj[symbol].onOrder
            }
        }
    }

    storage.put('balances', balances)
}

const _storeInitialData = async () => {

    await _exchangeInfo(SYMBOL)

    const positions = storage.get('positions')
    const startTime = Date.now()
    const marketPrice = parseFloat((await binance.prices(SYMBOL))[SYMBOL])

    storage.put('start_time', startTime)
    storage.put('last_price', marketPrice)

    if (positions && positions.length > 0) {
        logColor(colors.yellow, 'Resuming from last run...')
    } else {
        logColor(colors.yellow, 'Creating storage data...')
        storage.put('positions', [])
        storage.put('profits', 0)
        storage.put(`initial_${PAIR1.toLowerCase()}_balance`, storage.get(`${PAIR1.toLowerCase()}_balance`))
        storage.put(`initial_${PAIR2.toLowerCase()}_balance`, storage.get(`${PAIR2.toLowerCase()}_balance`))
        await _updateBalances(true)
    }
}

const _logProfits = async () => {
    const balances = storage.get('balances')

    const profits = parseFloat(storage.get('profits'))
    const isGainerProfit = profits > 0 ? 1 : (profits < 0 ? 2 : 0) // 1 profit, 2 loss and 0 breakeven

    logColor((isGainerProfit === 1 ?
        colors.green : isGainerProfit === 2 ?
            colors.red : colors.yellow),
        `Global Profits: ${parseFloat(storage.get('profits')).toFixed(3)} ${PAIR2} | Initial: ${parseFloat(balances[PAIR2].initial).toFixed(2)}`)

    log('================================================================================')

    for (const symbol in balances) {
        if ((balances[symbol].available > 0 || balances[symbol].onOrder > 0)) {
            log(`${symbol} Balance ${parseFloat(balances[symbol].available).toFixed(4)} | On Order ${parseFloat(balances[symbol].onOrder).toFixed(4)} `)
        }
    }

}

const _handleQuantityFilters = (symbol, quantity, price) => {

    const exchangeInfo = storage.get('exchange_info')

    // Set minimum order quantity with minQty
    if (quantity < exchangeInfo[symbol].minQty) quantity = exchangeInfo[symbol].minQty;

    // Set minimum order quantity with minNotional
    if (price * quantity < exchangeInfo[symbol].minNotional) {
        quantity = exchangeInfo[symbol].minNotional / price;
    }

    // Round to stepSize
    return binance.roundStep(quantity, exchangeInfo[symbol].stepSize);
}

const _handlePriceFilters = (symbol, price) => {
    const exchangeInfo = storage.get('exchange_info')

    const tickSize = exchangeInfo[symbol].tickSize

    return binance.roundTicks(price, tickSize)
}

const _sell = async (marketPrice, force) => {

    const positions = storage.get('positions')

    const updatedPositions = positions.map(position => {

        if (position.status == 'BOUGHT') {
            if (marketPrice < position.sell_price) {
                position.status = 'SELLING'
            } else {
                position.sell_price = marketPrice
            }
        }

        return position;
    })

    const filterBy = force ? () => true : (position) => position.status === 'SELLING'

    const positionsToSell = updatedPositions.filter(filterBy)

    if (positionsToSell.length > 0) {
        const totalQuantity = parseFloat(positionsToSell.map(position => position.quantity).reduce((prev, next) => parseFloat(prev) + parseFloat(next)))

        if (totalQuantity > 0) {

            logColor(colors.red, `
            Creating order on exchange... 
            =============================
            Selling ${SYMBOL}
            At price: ${marketPrice} ${PAIR2}
            Amount: ${parseFloat(totalQuantity * marketPrice).toFixed(2)} ${PAIR2}
            Quantity: ${totalQuantity.toFixed(4)} 
            `)

            try {

                const profits = parseFloat(storage.get('profits'))
                const quantity = _handleQuantityFilters(SYMBOL, totalQuantity, marketPrice)
                const response = await binance.marketSell(SYMBOL, quantity)

                if (response.status === 'FILLED' || response.status === 'PARTIALLY_FILLED') {

                    const sellPrice = parseFloat(response.fills[0].price)

                    const finalPositions = updatedPositions.map(position => {

                        const positionFounded = positionsToSell.find(item => position.id === item.id)

                        if (positionFounded) {
                            position.status = 'SOLD'
                            position.sellId = response.orderId
                            position.sold_price = sellPrice
                            position.profit = (parseFloat(response.executedQty) * sellPrice)
                                - (parseFloat(response.executedQty) * parseFloat(positionFounded.buy_price))
                        }

                        storage.put('profits', profits + parseFloat(position.profit))

                        return position
                    });

                    storage.put('positions', finalPositions)

                    await _updateBalances(false)

                    logColor(colors.green, `Sold ${totalQuantity.toFixed(4)} ${PAIR1} for ${parseFloat(totalQuantity * sellPrice).toFixed(2)} ${PAIR2}\n`)

                    return response
                }

            } catch (error) {
                logColor(colors.red, `Selling: ${JSON.stringify(error)}`)
            }
        }
    }
}

const _buy = async (marketPrice, lastPrice) => {

    const factor = (lastPrice - marketPrice)
    const percent = 100 * factor / lastPrice

    if (percent >= process.env.APP_PRICE_PERCENT) {

        const balances = storage.get('balances')

        if (parseFloat(balances[PAIR2].available) < parseFloat(BUY_ORDER_AMOUNT)) {
            logColor(colors.red, 'Buying: account has insufficient balance for requested action.')
            return false;
        }

        const quantity = _handleQuantityFilters(SYMBOL, (BUY_ORDER_AMOUNT / marketPrice), marketPrice)

        const order = {
            symbol: SYMBOL,
            quantity,
            buy_price: marketPrice,
            sell_price: marketPrice,
            sold_price: 0,
            profit: 0,
            status: 'BUYING',
        }

        logColor(colors.green, `
            Creating order on exchange... 
            =============================
            Buying ${SYMBOL}
            At price: ${marketPrice} ${PAIR2}
            Amount: ${BUY_ORDER_AMOUNT} ${PAIR2}
            Quantity: ${quantity.toFixed(4)} 
        `)

        try {
            const response = await binance.marketBuy(SYMBOL, quantity)

            if (response.status === 'FILLED' || response.status === 'PARTIALLY_FILLED') {
                order.status = 'BOUGHT'
                order.id = response.orderId
                order.buy_price = parseFloat(response.fills[0].price)

                const positions = storage.get('positions')
                positions.push(order)
                storage.put('positions', positions)

                await _updateBalances(false)

                logColor(colors.green, `Bought ${quantity.toFixed(4)} ${PAIR1} for ${(order.buy_price).toFixed(2)} ${PAIR2}\n`)

                return response
            } else {
                // Temp check
                console.log('CHECK THIS', response)
                process.exit(1);
            }
        } catch (error) {
            logColor(colors.red, `Buying: ${JSON.stringify(error)}`)
        }
    }
}

const _broadcast = async () => {
    while (true) {
        try {
            const marketPrice = parseFloat((await binance.prices(SYMBOL))[SYMBOL])

            if (marketPrice) {

                console.clear()

                const lastPrice = storage.get('last_price')
                const time = storage.get('start_time')

                log(`Running Time: ${elapsedTime(time)}`)
                log('================================================================================')
                _logProfits(marketPrice)
                log('================================================================================')
                log(`Last price: ${lastPrice} `)
                log(`New price: ${marketPrice} `)


                _sell(marketPrice)

                if (marketPrice < lastPrice) {
                    _buy(marketPrice, lastPrice)
                }
            }

            storage.put('last_price', marketPrice)

            await _updateBalances(false)

        } catch (error) {
            logColor(colors.red, error)
        }

        await sleep(process.env.APP_BINANCE_SLEEP_TIME)
    }
}

const init = async (pair1, pair2, amount, options) => {

    console.clear()

    if (['production', 'prod', 'live'].includes(process.env.APP_ENV)) {
        binance.options({
            APIKEY: process.env.APP_BINANCE_SPOT_APIKEY,
            APISECRET: process.env.APP_BINANCE_SPOT_SECRET
        })
    } else {
        binance.options({
            APIKEY: process.env.APP_BINANCE_SPOT_TEST_APIKEY,
            APISECRET: process.env.APP_BINANCE_SPOT_TEST_SECRET,
            test: true,
            useServerTime: true,
            verbose: true,
            urls: {
                base: 'https://testnet.binance.vision/api/',
            }
        })
    }

    PAIR1 = pair1
    PAIR2 = pair2
    SYMBOL = PAIR1 + PAIR2
    BUY_ORDER_AMOUNT = amount

    storage = new Storage(`./data/${SYMBOL}.json`)

    await _storeInitialData()

    if (options) {
        if (options.sell && !options.force) {
            const marketPrice = parseFloat((await binance.prices(SYMBOL))[SYMBOL])
            _sell(marketPrice, options.sell)
        } else {
            const balances = await binance.balance()
            const quantity = balances[PAIR1].available
            if (quantity>0) {
                const result = await binance.marketSell(SYMBOL, quantity)
                logColor(colors.red, `Forced sell for ${SYMBOL}`)
            } else {
                logColor(colors.yellow, `Nothing to sell for ${SYMBOL}`)
            }
        }
    } else {
        // amount validation
        if (isNaN(amount)) throw new Error('amount should be a valid number')
        if (parseFloat(amount) < parseFloat(process.env.APP_MIN_AMOUNT)) throw new Error(`amount should be bigger than ${process.env.APP_MIN_AMOUNT} `)
        if (parseFloat(amount) > parseFloat(process.env.APP_MAX_AMOUNT)) throw new Error(`amount should be lower than ${process.env.APP_MAX_AMOUNT} `)

        _broadcast()
    }
}

module.exports = init
