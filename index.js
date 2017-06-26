/**
 * Driver Application
 * 
 * This module instantiates the gateway
 */
const logger = require('winston');

const Gateway = require('./gateway/gateway');

logger.info('Initializing FTL Gateway');
var gateway = new Gateway();