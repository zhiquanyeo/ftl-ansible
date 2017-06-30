/**
 * Driver Application
 * 
 * This module instantiates the gateway
 */
const logger = require('winston');

const AnsibleServer = require('./ansible/ansible-server');

logger.info('Initializing FTL AnsibleServer');
var ansible = new AnsibleServer();