require('dotenv').config()
const Storage = require('node-storage')
const Binance = require('node-binance-api')
const moment = require('moment')

const { colors, log, logColor } = require('../utils/logger')

const client = new Binance().options({
    APIKEY: process.env.APP_BINANCE_APIKEY,
    APISECRET: process.env.APP_BINANCE_SECRET
})

let MARKET1 = undefined
let MARKET2 = undefined
let MARKET = undefined
let BUY_ORDER_AMOUNT = undefined
let storage = undefined

const sleep = (milliseconds) => new Promise(resolve => setTimeout(resolve, milliseconds))

const elapsedTime = () => {
    const diff = Date.now() - storage.get('start_time')
    return moment.utc(diff).format('HH:mm:ss')
}

const _balances = async () => {
    return await client.balance()
}

// Reset the entry price when the bot starts
const _newPriceReset = (_market, balance, price) => {
    const market = _market == 1 ? MARKET1 : MARKET2
    const marketBalance = parseFloat(storage.get(`${market.toLowerCase()}_balance`))
    if (marketBalance <= balance) {
        storage.put('start_price', price)
    }
}

const _updateBalances = async () => {
    const balances = await _balances()
    storage.put(`${MARKET1.toLowerCase()}_balance`, parseFloat(balances[MARKET1].available))
    storage.put(`${MARKET2.toLowerCase()}_balance`, parseFloat(balances[MARKET2].available))
}

const _calculateProfits = async () => {
    const orders = storage.get('orders')
    const sold = orders.filter(order => {
        return order.status === 'sold'
    })
    const totalSoldProfits = sold.length > 0 ?
        sold.map(order => order.profit).reduce((total, next) => parseFloat(total) + parseFloat(next)) :
        0
    storage.put('profits', totalSoldProfits + parseFloat(storage.get('profits')))
}

const _logProfits = (price) => {
    const profits = parseFloat(storage.get('profits'))
    const isGainerProfit = profits > 0 ? 1 : (profits < 0 ? 2 : 0) // 1 profit, 2 loss and 0 breakeven

    logColor((isGainerProfit === 1 ?
        colors.green : isGainerProfit === 2 ?
            colors.yellow : colors.gray),
        `Global Profits: ${parseFloat(storage.get('profits')).toFixed(3)} ${MARKET2}`)

    const market1Balance = parseFloat(storage.get(`${MARKET1.toLowerCase()}_balance`)) || 0
    const market2Balance = parseFloat(storage.get(`${MARKET2.toLowerCase()}_balance`)) || 0
    const initialBalance = parseFloat(storage.get(`initial_${MARKET2.toLowerCase()}_balance`)) || 0
    const currentBalance = parseFloat(market1Balance * price + market2Balance) || 0

    logColor(colors.gray,
        `Balance: ${market1Balance} ${MARKET1}, ${market2Balance} ${MARKET2}, Current: ${currentBalance.toFixed(2)} ${MARKET2}, Initial: ${initialBalance.toFixed(2)} ${MARKET2}`)
}

const _buy = async (price, amount) => {
    if (parseFloat(storage.get(`${MARKET2.toLowerCase()}_balance`)) >= (BUY_ORDER_AMOUNT * price)) {
        const orders = storage.get('orders')
        const factor = process.env.APP_PRICE_PERCENT * price / 100

        const order = {
            buy_price: price,
            amount,
            sell_price: price + factor,
            sold_price: 0,
            status: 'pending',
            profit: 0
        }

        log(`
            Buying ${MARKET1}
            ==================
            amountIn: ${parseFloat(BUY_ORDER_AMOUNT * price).toFixed(2)} ${MARKET2}
            amountOut: ${BUY_ORDER_AMOUNT} ${MARKET1}
        `)

        try {
            const response = await client.marketBuy(MARKET, order.amount)

            if (response && response.status === 'FILLED') {
                order.status = 'bought'
                order.id = response.orderId
                order.buy_price = parseFloat(response.fills[0].price)

                orders.push(order)
                storage.put('start_price', order.buy_price)
                await _updateBalances()

                logColor(colors.green, '==================')
                logColor(colors.green, `Bought ${BUY_ORDER_AMOUNT} ${MARKET1} for ${parseFloat(BUY_ORDER_AMOUNT * price).toFixed(2)} ${MARKET2}, Price: ${order.buy_price}\n`)
                logColor(colors.green, '==================')

                await _calculateProfits()
            } else _newPriceReset(2, BUY_ORDER_AMOUNT * price, price)
        } catch (error) {
            logColor(colors.red, `Error buying ${order.amount} ${MARKET} ${error.body}`)
        }
    } else _newPriceReset(2, BUY_ORDER_AMOUNT * price, price)
}

const _sell = async (price) => {
    let orders = storage.get('orders')
    const toSold = []

    if (orders && orders.length > 0) {
        orders.forEach(order => {
            if (price >= order.sell_price) {
                order.sold_price = price
                order.status = 'pending'
                toSold.push(order)
            }
        });
    }

    if (toSold.length > 0) {
        const totalAmount = parseFloat(toSold.map(order => order.amount).reduce((total, next) => parseFloat(total) + parseFloat(next)))
        if (totalAmount > 0 && parseFloat(storage.get(`${MARKET1.toLowerCase()}_balance`)) >= totalAmount) {
            log(`
                Selling ${MARKET1}
                ==================
                amountIn: ${totalAmount.toFixed(2)} ${MARKET1}
                amountOut: ${parseFloat(totalAmount * price)} ${MARKET2}
            `)

            const response = await client.marketSell(MARKET, totalAmount)

            if (response && response.status === 'FILLED') {
                const sellPrice = parseFloat(response.fills[0].price)

                orders.forEach(order => {
                    order.sold_price = sellPrice
                    order.status = 'pending'
                    toSold.forEach(item => {
                        if (order.id === item.id) {
                            item.profit = (parseFloat(item.amount) * sellPrice)
                                - (parseFloat(item.amount) * parseFloat(item.buy_price))
                            item.status = 'sold'
                            order = item
                        }
                    })
                });

                storage.put('start_price', sellPrice)
                await _updateBalances()

                logColor(colors.yellow, '==================')
                logColor(colors.yellow, `Sold ${totalAmount} ${MARKET1} for ${parseFloat(totalAmount * sellPrice).toFixed(2)} ${MARKET2}, Price: ${sellPrice}\n`)
                logColor(colors.yellow, '==================')

                await _calculateProfits()

                // removing orders with status sold
                orders = orders.filter(order => order.status !== 'sold');

            } else storage.put('start_price', price)
        } else storage.put('start_price', price)
    } else storage.put('start_price', price)
}

const _broadcast = async () => {
    while (true) {
        try {
            let marketPrice = await client.prices(MARKET)
            marketPrice = parseFloat(marketPrice[MARKET])

            if (marketPrice) {
                const startPrice = storage.get('start_price')

                console.clear()

                log(`Running Time: ${elapsedTime()}`)
                log('================================================================================')
                _logProfits(marketPrice)
                log('================================================================================')
                log(`Prev price: ${startPrice} `)
                log(`New price: ${marketPrice} `)

                if (marketPrice < startPrice) {
                    const factor = (startPrice - marketPrice)
                    const percent = 100 * factor / startPrice
                    logColor(colors.yellow, `Losers: -${parseFloat(percent).toFixed(3)}% ==> -$${parseFloat(factor).toFixed(5)}}`)
                    storage.put('percent', `-${parseFloat(percent).toFixed(3)}`)

                    if (percent >= process.env.APP_PRICE_PERCENT) {
                        await _buy(marketPrice, BUY_ORDER_AMOUNT)
                    }
                } else {
                    const factor = (marketPrice - startPrice)
                    const percent = 100 * factor / marketPrice
                    logColor(colors.green, `Gainers: +${parseFloat(percent).toFixed(3)}% ==> +$${parseFloat(factor).toFixed(5)}}`)
                    storage.put('percent', `+${parseFloat(percent).toFixed(3)}`)

                    await _sell(marketPrice)
                }
            }
        } catch (error) {
            logColor(colors.red, error)
        }

        await sleep(process.env.APP_SLEEP_TIME)
    }
}

const init = async (market1, market2, amount, resume) => {

    MARKET1 = market1
    MARKET2 = market2
    MARKET = MARKET1 + MARKET2
    BUY_ORDER_AMOUNT = amount

    storage = new Storage(`./data/${MARKET}.json`)

    if (!resume) {
        const startTime = Date.now()
        const price = await client.prices(MARKET)
        const balances = await _balances()
        storage.put('start_time', startTime)
        storage.put('start_price', parseFloat(price[MARKET]))
        storage.put('orders', [])
        storage.put('profits', 0)
        storage.put(`${MARKET1.toLowerCase()}_balance`, parseFloat(balances[MARKET1].available))
        storage.put(`${MARKET2.toLowerCase()}_balance`, parseFloat(balances[MARKET2].available))
        storage.put(`initial_${MARKET1.toLowerCase()}_balance`, storage.get(`${MARKET1.toLowerCase()}_balance`))
        storage.put(`initial_${MARKET2.toLowerCase()}_balance`, storage.get(`${MARKET2.toLowerCase()}_balance`))
    }

    _broadcast()
}

module.exports = init
