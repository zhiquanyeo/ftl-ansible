/**
 * AnsibleServer
 * 
 */

const logger = require('winston');
const dgram = require('dgram');

const EventEmitter = require('events');
const Connection = require('./connection');

const ConnectionPool = require('./connection-pool');

const DEFAULT_PORT = 41234;

class AnsibleServer extends EventEmitter {
    constructor(opts) {
        super();

        opts = opts || {};
        this.d_server = this._createServer(opts);
        this.d_connectionPool = new ConnectionPool(this.d_server);
    }

    /** "Private" **/
    _createServer(opts) {
        const server = dgram.createSocket('udp4');
        
        server.on('error', (err) => {
            logger.error(`[FTL-ANS] UDP Server Error:\n${err.stack}`);
            server.close();
        });

        server.on('message', (msg, rinfo) => {
            logger.info(`[FTL-ANS] UDP Server Message: ${msg} from ${rinfo.address}:${rinfo.port}`);
            this._onMessageReceived(msg, rinfo);
        });

        server.on('listening', () => {
            const address = server.address();
            logger.info(`[FTL-ANS] UDP Server Listening ${address.address}:${address.port}`);
        });

        server.bind(opts.port || DEFAULT_PORT);

        return server;
    }

    _onMessageReceived(msg, rinfo) {
        // Pass along to the connection pool
        this.d_connectionPool.processMessage(msg, rinfo);
    }
    
    /** Public API **/
};

module.exports = AnsibleServer;