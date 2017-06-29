/**
 * Driver Application
 * 
 * This module instantiates the gateway
 */
const logger = require('winston');

const Ansible = require('./ansible/ansible');

logger.info('Initializing FTL Ansible');
var ansible = new Ansible();