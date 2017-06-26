/**
 * Driver Application
 * 
 * This module instantiates the gateway
 */
const logger = require('winston');

const Gateway = require('./ansible/ansible');

logger.info('Initializing FTL Ansible');
var gateway = new Gateway();