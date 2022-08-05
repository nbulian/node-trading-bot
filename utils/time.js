const moment = require('moment')

const sleep = (milliseconds) => new Promise(resolve => setTimeout(resolve, milliseconds))

const elapsedTime = (time) => {
    const diff = Date.now() - time
    return moment.utc(diff).format('HH:mm:ss')
}

module.exports = {
    sleep,
    elapsedTime
}
