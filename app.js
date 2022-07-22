const { program } = require('commander');
const binance = require('./services/binance')
const { colors, logColor } = require('./utils/logger')

logColor(colors.yellow, 'Welcome to Crypto Trading Spot Bot'.toLocaleUpperCase())

program
    .name('node-trading-bot')
    .description('CLI Crypto Trading Spot Bot')
    .version('1.1.0');

program
    .command('init')
    .description('Initiate the crypto trading bot')
    .argument('<market1>', 'ticker symbols of the crypto to trade, for example BTC, ETH, MATIC, etc')
    .argument('<market2>', 'ticker symbols of the crypto to pair with, usually an stable coin like USDT, BUSD, DAI, etc')
    .argument('<amount>', 'amount of crypto to buy in each iteration of the bot')
    .option('-r, --resume', 'use it to restart the process from the last state')
    .action((market1, market2, amount, options) => {
        const resume = options.resume !== undefined ? true : false
        binance(market1, market2, amount, resume)
    });

program
    .command('sell')
    .description('force the bot to sell everything to the current market price')
    .argument('<market1>', 'ticker symbols of the crypto to trade, for example BTC, ETH, MATIC, etc')
    .argument('<market2>', 'ticker symbols of the crypto to pair with, usually an stable coin like USDT, BUSD, DAI, etc')
    .action((market1, market2) => {
        console.log('market1:', market1);
        console.log('market2:', market2);
        // binance()
    });

program.parse();


