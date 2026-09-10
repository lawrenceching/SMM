
import pino from 'pino'



const logger = pino({
  browser: {
    asObject: true,
    serialize: true,
  },
  timestamp: () => {
    return new Date().toLocaleTimeString()
  }
})

export { logger }