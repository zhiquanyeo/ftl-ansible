/**
 * AnsibleClient
 */

const logger = require('winston');
const dgram = require('dgram');
const EventEmitter = require('events');
const Promise = require('promise');
const ProtocolCommands = require('./protocol-commands');
const ProtocolConstants = ProtocolCommands.Constants;
const PacketBuilder = require('./protocol-packet/packet-builder');

const DEFAULT_ADDR = 'localhost';
const DEFAULT_PORT = 41234;

class AnsibleClient extends EventEmitter {
    constructor(opts) {
        super();

        opts = opts || {};
        this.d_socket = this._createSocket();

        this.d_remoteAddr = opts.address || DEFAULT_ADDR;
        this.d_remotePort = opts.port !== undefined ?
                            opts.port : DEFAULT_PORT;

        this.d_seq = 1;
        this.d_outstandingRequests = {};
    }

    /** Private **/
    _createSocket() {
        const socket = dgram.createSocket('udp4');

        socket.on('error', (err) => {
            logger.error(`[FTL-ANS-CLI] Socket Error:\n${err.stack}`);
            this.emit('error', err);
            socket.close();
        });

        socket.on('message', (msg, rinfo) => {
            this._onMessageReceived(msg, rinfo);
        });

        return socket;
    }

    _onMessageReceived(msg, rinfo) {

    }
};

// Apply command setters/getters
Object.keys(ProtocolCommands.Commands).forEach((device) => {
    var deviceCmds = ProtocolCommands.Commands[device];
    Object.keys(deviceCmds).forEach((cmd) => {
        var cmdInfo = deviceCmds[cmd];
        var cmdName = device + ':' + cmd;

        if (cmdInfo.clientFnName) {
            var clientFnName = cmdInfo.clientFnName;
            AnsibleClient.prototype[clientFnName] = function() {
                console.log('Executing function: ', clientFnName, ' with args: ', arguments);
                // verify the number of params, and fill the buffer
                var dataBuf = null;
                var numParams = 0;
                if (cmdInfo.params) {
                    if (arguments.length < cmdInfo.params.length) {
                        throw new Error("Incorrect number of parameters for function '" +
                                        clientFnName + "'. Expected " + cmdInfo.params.length +
                                        " but got " + arguments.length);
                    }

                    numParams = cmdInfo.params.length;

                    // Otherwise, make a new buffer
                    var totalBufferSize = 0;
                    for (var i = 0; i < cmdInfo.params.length; i++) {
                        totalBufferSize += cmdInfo.params[i].length;
                    }

                    dataBuf = new Buffer(totalBufferSize);
                    for (var i = 0; i < cmdInfo.params.length; i++) {
                        // Write appropriate data
                        var valToWrite = arguments[i];
                        var paramInfo = cmdInfo.params[i];
                        if (paramInfo.type === 'uint8') {
                            dataBuf.writeUInt8(valToWrite, paramInfo.offset);
                        }
                        else if (paramInfo.type === 'int8') {
                            dataBuf.writeInt8(valToWrite, paramInfo.offset);
                        }
                        else if (paramInfo.type === 'uint16') {
                            dataBuf.writeUInt16BE(valToWrite, paramInfo.offset);
                        }
                        else if (paramInfo.type === 'int16') {
                            dataBuf.writeInt16BE(valToWrite, paramInfo.offset);
                        }
                    }
                }

                var packet = {
                    SEQ: this.d_seq++,
                    DID: cmdInfo.DID,
                    CID: cmdInfo.CID,
                    DATA: dataBuf,
                    resetTimeout: true,
                    requestAck: true
                };

                var pktBuf = PacketBuilder.buildClientPacket(packet)

                var seqNum = packet.SEQ;
                var pendingRequest = {
                    fnName: cmdInfo.clientFnName,
                    cmdName: cmdName,
                    args: Array.prototype.slice.call(arguments, 0),
                    timestamp: Date.now(),
                };

                if (cmdInfo.providesCallback && 
                    arguments.length > numParams && 
                    typeof arguments[numParams] === 'function') {
                    pendingRequest.callback = arguments[numParams];
                }

                this.d_outstandingRequests[seqNum] = pendingRequest;

                this.d_socket.send(pktBuf, 0, pktBuf.length, 
                      this.d_remotePort, this.d_remoteAddr, 
                      (err) => {
                            if (err) {
                                this.emit('error', err);
                                logger.error('[FTL-ANS-CLI] Error while sendind: ', err);
                            }
                            // Remove this from the outstanding requests
                            delete this.d_outstandingRequests[seqNum];

                });
            }
        }
    });
});

module.exports = AnsibleClient;