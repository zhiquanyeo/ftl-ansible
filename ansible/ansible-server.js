/**
 * AnsibleServer
 * 
 */

const logger = require('winston');
const dgram = require('dgram');

const EventEmitter = require('events');
const Connection = require('./connection');

const ConnectionPool = require('./connection-pool');
const ProtocolCommands = require('./protocol-commands');

const ProtocolConstants = ProtocolCommands.Constants;

const DEFAULT_PORT = 41234;

class AnsibleServer extends EventEmitter {
    constructor(opts) {
        super();

        opts = opts || {};
        this.d_server = this._createServer(opts);
        this.d_connectionPool = new ConnectionPool(this.d_server);
        this._hookupConnectionPoolEvents();
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

    _hookupConnectionPoolEvents() {
        this.d_connectionPool.on('dataRequired', (dataRequiredEvent) => {
            var timeoutTriggered = false;

            // Forward this up the chain, but set a timeout on a response
            var timeoutResponder = setTimeout(() => {
                timeoutTriggered = true;
                dataRequiredEvent.respond(ProtocolConstants.REQUEST_TIMED_OUT);
            }, 1500);

            // TODO We should also do some transformation here. Maybe not pass the
            // raw packet, but instead transform the event into a higher-level form
            this.emit('dataRequired', {
                rawPacket: dataRequiredEvent.packet,
                dataRequired: dataRequiredEvent.dataRequired,
                respond: function (data) {
                    clearTimeout(timeoutResponder);
                    if (!timeoutTriggered) {
                        dataRequiredEvent.respond(ProtocolConstants.OK, data);
                    }
                }
            });
        });

        this.d_connectionPool.on('commandReceived', (command, packet) => {
            // Here, we should convert the command + packet into something more
            // useful. All binary protocol things should happen at this level
        });
    }

    _onMessageReceived(msg, rinfo) {
        // Pass along to the connection pool
        this.d_connectionPool.processMessage(msg, rinfo);
    }
    
    /** Public API **/
    
    /**
     * Send a non-response, non-solicited message back to an Ansible client
     * Usually used for async events, or for streaming data
     */
    sendAsyncMessage(idCode, data) {
        
    }
};

module.exports = AnsibleServer;