/**
 * AnsibleServer
 * 
 */

const logger = require('winston');
const dgram = require('dgram');

const EventEmitter = require('events');

const ConnectionPool = require('./connection-pool');
const ProtocolCommands = require('./protocol-commands');

const ProtocolConstants = ProtocolCommands.Constants;

const DEFAULT_PORT = 41234;

function _generateParamsList(commandInfo, rawData) {
    var ret = {};
    if (!commandInfo || !commandInfo.params || !rawData) {
        return ret;
    }

    for (var i = 0; i < commandInfo.params.length; i++) {
        var param = commandInfo.params[i];
        var value;
        if (param.type) {
            switch(param.type) {
                case 'uint8': {
                    value = rawData.readUInt8(param.offset);
                } break;
                case 'int8': {
                    value = rawData.readInt8(param.offset);
                } break;
                case 'uint16': {
                    value = rawData.readUInt16BE(param.offset);
                } break;
                case 'int16': {
                    value = rawData.readInt16BE(param.offset);
                } break;
                default: {
                    value = rawData.slice(param.offset, param.offset + param.length);
                }
            }
        }
        else {
            value = rawPacket.DATA.slice(param.offset, param.offset + param.length);
        }
        ret[param.name] = value;
    }

    return ret;
}

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

            this.emit('dataRequired', {
                command: dataRequiredEvent.command,
                params: _generateParamsList(
                            ProtocolCommands.getCommandDetails(dataRequiredEvent.dataRequired),
                            dataRequiredEvent.packet.DATA),
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
            this.emit('commandReceived', {
                command: command,
                params: _generateParamsList(
                            ProtocolCommands.getCommandDetails(command),
                            packet.DATA)
            })
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
    sendAsyncMessage(idCode, data, broadcast) {
        this.d_connectionPool.sendAsyncMessage(idCode, data, broadcast);
    }
};

module.exports = AnsibleServer;