const { program } = require('commander');
const binance = require('./services/binance')
const { colors, logColor } = require('./utils/logger')

logColor(colors.yellow, 'Welcome to Crypto Trading Spot Bot'.toLocaleUpperCase())

program
    .name('node-trading-bot')
    .description('CLI Crypto Trading Spot Bot')
    .version('2.0.0');

program
    .command('trade')
    .description('Initiate the crypto trading bot')
    .argument('<pair1>', 'ticker symbol of the crypto to trade, for example BTC, ETH, MATIC, etc')
    .argument('<pair2>', 'ticker symbol of the crypto to pair with, usually an stable coin like USDT, BUSD, DAI, etc')
    .argument('<amount>', 'amount of crypto to buy in each iteration of the bot')
    .addArgument(new program.Argument('<env>', 'environment where to run').choices(['prod', 'dev']))
    .action((pair1, pair2, amount, env) => {
        process.env['APP_ENV'] = env.toLowerCase()
        binance(pair1, pair2, amount, null)
    });

program
    .command('sell')
    .description('sell all your open orders')
    .argument('<pair1>', 'ticker symbol of the crypto to trade, for example BTC, ETH, MATIC, etc')
    .argument('<pair2>', 'ticker symbol of the crypto to pair with, usually an stable coin like USDT, BUSD, DAI, etc')
    .addArgument(new program.Argument('<env>', 'environment where to run').choices(['prod', 'dev']))
    .option('-f, --force', 'force to sell at current the pair price')
    .action((pair1, pair2, env) => {
        process.env['APP_ENV'] = env.toLowerCase()
        binance(pair1, pair2, 0, { sell: true, force })
    });

program.parse();


