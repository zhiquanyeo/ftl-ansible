const logger = require('winston');
const net = require('net');
const EventEmitter = require('events');
const ProtocolCommands = require('./protocol-commands');
const ConnectionPool = require('./connection-pool-tcp');

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
        this.d_connectionPool = new ConnectionPool();
        this.d_server = net.createServer((socket) => {
            this.d_connectionPool.registerSocket(socket);
        });

        this.d_server.on('error', (err) => {
            logger.error(`[FTL-ANS-SRV] TCP Server Error:\n${err.stack}`);
            this.emit('error', err);
            server.close();
        });

        var port = opts.port || DEFAULT_PORT;

        this.d_server.listen(port);
        this.d_server.on('listening', () => {
            const address = this.d_server.address();
            logger.info(`[FTL-ANS-SRV] TCP Server Listening ${address.address}:${address.port}`);
        })

        this.d_server.on('close', () => {
            console.log('Server closing');
        });

        this.d_connectionPool.on('dataRequired', (dataRequiredEvt) => {
            var timeoutTriggered = false;

            // Forward this up the chain, but set a timeout on response
            var timeoutResponder = setTimeout(() => {
                timeoutTriggered = true;
                dataRequiredEvt.respond(ProtocolConstants.REQUEST_TIMED_OUT);
            }, 1500);

            this.emit('dataRequired', {
                command: dataRequiredEvt.command,
                params: _generateParamsList(
                            ProtocolCommands.getCommandDetails(dataRequiredEvt.command),
                            dataRequiredEvt.packet.DATA),
                respond: function (data) {
                    clearTimeout(timeoutResponder);
                    if (!timeoutTriggered) {
                        dataRequiredEvt.respond(ProtocolConstants.OK, data);
                    }
                }
            });
        });

        this.d_connectionPool.on('commandReceived', (command, packet) => {
            this.emit('commandReceived', {
                command: command,
                params: _generateParamsList(
                            ProtocolCommands.getCommandDetails(command),
                            packet.DATA)
            });
        });
    }

    sendAsyncMessage(idCode, data, broadcast) {
        this.d_connectionPool.sendAsyncMessage(idCode, data, broadcast);
    }
};

module.exports = AnsibleServer;