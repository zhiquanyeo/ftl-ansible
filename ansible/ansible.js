/**
 * Ansible
 * 
 * This module handles all communication between a FTL gateway client and the actual robot.
 * It will spin up a UDP server and pass all connections 
 */

const logger = require('winston');
const dgram = require('dgram');

const EventEmitter = require('events');
const Connection = require('./connection');

const DEFAULT_PORT = 41234;

class Ansible extends EventEmitter {
    constructor(opts) {
        super();

        opts = opts || {};
        this.d_server = this._createServer(opts);
        this.d_clientConnections = {};
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
        // If a client connection does not currently exist, create one, and then pass the message on to that
        // Each connection object will be in charge of managing the protocol for that connection

        const clientAddr = rinfo.address + ':' + rinfo.port;
        if (!this.d_clientConnections[clientAddr]) {
            logger.info(`[FTL-ANS] Adding client connection (${clientAddr})`);
            this.d_clientConnections[clientAddr] = new Connection(this.d_server, rinfo);
        }

        this.d_clientConnections[clientAddr].processMessage(msg);
    }
    /** Public API **/
};

module.exports = Ansible;