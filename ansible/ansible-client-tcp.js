const logger = require('winston');
const net = require('net');
const EventEmitter = require('events');
const Promise = require('promise');
const ProtocolCommands = require('./protocol-commands');
const ProtocolConstants = ProtocolCommands.Constants;
const PacketBuilder = require('./protocol-packet/packet-builder');
const PacketParser = require('./protocol-packet/packet-parser');

const DEFAULT_ADDR = 'localhost';
const DEFAULT_PORT = 41234;

const MISSED_HEARTBEATS_TILL_DISCONNECT = 5;
const HEARTBEAT_INTERVAL = 200; // ms

const ConnectionState = {
    NOT_CONNECTED : 'NOT_CONNECTED',
    ACTIVE        : 'ACTIVE',
    QUEUED        : 'QUEUED'
};

function _makeMethods(clientObj) {
    ProtocolCommands.listClientFnNames().forEach((fnName) => {
        clientObj[fnName + 'P'] = function() {
            return this._sendRequestP(fnName, Array.prototype.slice.call(arguments, 0))
        };

        clientObj[fnName] = function() {
            var cmdInfo = ProtocolCommands.getCommandDetailsFromFn(fnName);
            var callback = null;
            if (cmdInfo.params && arguments.length > cmdInfo.params.length &&
                typeof(arguments[cmdInfo.params.length]) === 'function') {
                callback = arguments[cmdInfo.params.length];
            }

            this._sendRequestP(fnName, Array.prototype.slice.call(arguments, 0))
            .then((result) => {
                if (callback) {
                    callback(null, result);
                }
            })
            .catch((err) => {
                callback(err);
            });
        }
    });
}

class AnsibleClient extends EventEmitter {
    constructor(opts) {
        super();

        _makeMethods(this);

        opts = opts || {};
        this.d_remoteAddr = opts.address || DEFAULT_ADDR;
        this.d_remotePort = opts.port !== undefined ?
                            opts.port : DEFAULT_PORT;

        this.d_seq = 1;
        this.d_outstandingRequests = {};

        this.d_state = ConnectionState.NOT_CONNECTED;
        this.d_packetTimeout = opts.packetTimeout || 2000;

        this.d_heartbeatToken = null;
        this.d_missedHeartbeats = 0;

        this.d_heartbeatInterval = opts.heartbeatInterval || HEARTBEAT_INTERVAL;
        this.d_missedHbeatTillDisconnect = opts.missedHbeatDisconnect || 
                                            MISSED_HEARTBEATS_TILL_DISCONNECT;

        this.d_connected = false;
        this.d_socket = null;
    }

    _onMessageReceived(msg) {
        var packetType = PacketParser.checkServerPacketType(msg);
        var packetInfo;
        if (packetType === 'UNKNOWN') {
            logger.error('[FTL-ANS-CLI] Invalid packet type');
            return;
        }
        else if (packetType === 'RESPONSE') {
            packetInfo = PacketParser.decodeServerResponsePacket(msg);
        }
        else {
            packetInfo = PacketParser.decodeServerAsyncPacket(msg);
        }

        if (!packetInfo.ok) {
            logger.error('[FTL-ANS-CLI] Could not decode packet. Error type: ' + 
                        packetInfo.errorType + ': ' + packetInfo.errorMsg);
            return;
        }

        if (packetType === 'RESPONSE') {
            var pendingRequest = this.d_outstandingRequests[packetInfo.packet.SEQ];
            if (!pendingRequest) {
                logger.warn('[FTL-ANS-CLI] No pending request with sequence number ' + packetInfo.packet.SEQ);
                return;
            }

            var commandInfo = ProtocolCommands.getCommandDetails(pendingRequest.cmdName);
            if (!commandInfo) {
                logger.warn('[FTL-ANS-CLI] Invalid command type: ', pendingRequest.cmdName);
                // TODO Wipe this from pending request list?
                return;
            }

            // If the MRSP is NOT 0, we should reject
            if (packetInfo.packet.MRSP !== ProtocolConstants.OK) {
                clearTimeout(pendingRequest.timeoutToken);
                pendingRequest.reject(new Error("Problem with request. Error Code: " + packetInfo.packet.MRSP));
                delete this.d_outstandingRequests[packetInfo.packet.SEQ];
                return;
            }

            // Try to parse data from the DATA buffer
            var returnVal = null;
            if (commandInfo.returnType) {
                switch (commandInfo.returnType) {
                    case 'uint8': {
                        returnVal = packetInfo.packet.DATA.readUInt8(0);
                    } break;
                    case 'int8': {
                        returnVal = packetInfo.packet.DATA.readInt8(0);
                    } break;
                    case 'uint16': {
                        returnVal = packetInfo.packet.DATA.readUInt16BE(0);
                    } break;
                    case 'int16': {
                        returnVal = packetInfo.packet.DATA.readInt16BE(0);
                    } break;
                }
            }

            clearTimeout(pendingRequest.timeoutToken);
            pendingRequest.resolve(returnVal);
            delete this.d_outstandingRequests[packetInfo.packet.SEQ];
        }
        else {
            // TODO Handle the async messages
            var eventType = ProtocolCommands.getAsyncEventType(packetInfo.packet.ID_CODE);
            if (!eventType) {
                logger.warn('[FTL-ANS-CLI] Invalid Async Event ID_CODE: ', packetInfo.packet.ID_CODE);
                return;
            }

            // TODO We could do something smart with parsing values here, but
            // for now, just return the raw buffer
            this.emit('asyncEvent', {
                type: eventType,
                data: packetInfo.packet.DATA
            });
        }
    }

    _sendRequestP(reqType, argArray) {
        return new Promise((resolve, reject) => {
            if (!this.d_socket) {
                reject(new Error('Not connected'));
                return;
            }

            var commandDetails = ProtocolCommands.getCommandDetailsFromFn(reqType);
            if (!commandDetails) {
                reject(new Error('Invalid request: ' + reqType));
                return;
            }

            if (commandDetails.commandName.indexOf('SYS:') !== 0 && this.d_state !== ConnectionState.ACTIVE) {
                reject(new Error('Invalid Client State: ' + this.d_state));
                return;
            }

            if (commandDetails.params &&
                (!argArray ||
                 argArray.length < commandDetails.params.length)) {
                reject(new Error('Too few arguments for ' + reqType));
                return;
            }

            var _requestTimeout = setTimeout(() => {
                reject(new Error('Request timed out'));
            }, this.d_packetTimeout);

            var dataBuf = null;
            var numFnParams = 0;

            if (commandDetails.params) {
                numFnParams = commandDetails.params.length;
                var totalBufferSize = 0;
                for (var i = 0; i < numFnParams; i++) {
                    totalBufferSize += commandDetails.params[i].length;
                }

                dataBuf = new Buffer(totalBufferSize);
                for (var i = 0; i < numFnParams; i++) {
                    // Write appropriate data
                    var valToWrite = argArray[i];
                    var paramInfo = commandDetails.params[i];
                    switch(paramInfo.type) {
                        case 'uint8': {
                            dataBuf.writeUInt8(valToWrite, paramInfo.offset);
                        } break;
                        case 'int8': {
                            dataBuf.writeInt8(valToWrite, paramInfo.offset);
                        } break;
                        case 'uint16': {
                            dataBuf.writeUInt16BE(valToWrite, paramInfo.offset);
                        } break;
                        case 'int16': {
                            dataBuf.writeInt16BE(valToWrite, paramInfo.offset);
                        } break;
                    }
                }
            }

            var packet = {
                SEQ: this.d_seq++,
                DID: commandDetails.DID,
                CID: commandDetails.CID,
                DATA: dataBuf,
                resetTimeout: true,
                requestAck: true, // TODO make this optional?
            };

            var pktBuf = PacketBuilder.buildClientPacket(packet);
            var seqNum = packet.SEQ;

            var pendingRequest = {
                cmdName: commandDetails.commandName,
                resolve: resolve,
                reject: reject,
                timeoutToken: _requestTimeout
            };
            
            if (reqType !== 'sendClose') {
                this.d_outstandingRequests[seqNum] = pendingRequest;
            }

            this.d_socket.write(pktBuf, () => {
                if (reqType === 'sendClose') {
                    resolve();
                }
            });

            // Also reset the sequence number if necessary
            if (this.d_seq > 0xFF) {
                this.d_seq = 1;
            }
        });
    }

    _setupHeartbeat() {
        this.d_heartbeatToken = setInterval(() => {
            var seq = this.d_seq;
            this._sendRequestP('sendHbeat')
            .then((connState) => {
                this.d_missedHeartbeats = 0;
                var oldState = this.d_state;

                if (connState === 0) {
                    this.d_state = ConnectionState.ACTIVE;
                }
                else if (connState === 1) {
                    this.d_state = ConnectionState.QUEUED;
                }

                if (oldState !== this.d_state) {
                    this.emit('stateChanged', {
                        oldState: oldState,
                        newState: this.d_state
                    });
                }
            })
            .catch((err) => {
                this.d_missedHeartbeats++;
                console.log('Missed Packet #', seq);

                if (this.d_missedHeartbeats >= this.d_missedHbeatTillDisconnect) {
                    clearInterval(this.d_heartbeatToken);
                    this.d_missedHeartbeats = 0;
                    this.d_connected = false;
                    var oldState = this.d_state;
                    this.d_state = ConnectionState.NOT_CONNECTED;
                    this.emit('disconnected', {
                        code: 1,
                        reason: 'MISSED_HBEAT'
                    });
                    this.emit('stateChanged', {
                        oldState: oldState,
                        newState: this.d_state
                    });

                    this.d_socket.removeAllListeners();
                    this.d_socket.end();
                    this.d_socket.destroy();
                    this.d_socket = null;
                }
            })
        }, this.d_heartbeatInterval);
    }

    connect() {
        if (this.d_connected) {
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            this.d_socket = net.createConnection(this.d_remotePort, this.d_remoteAddr, () => {
                this.d_connected = true;
                resolve();
            });
            this.d_socket.on('error', (err) => {
                logger.error(`[FTL-ANS-CLI] Socket Error:\n${err.stack}`);
                this.emit('error', err);
            });

            this.d_socket.on('close', (wasError) => {
                var errcode = 0;
                var reason = 'SOCKET_CLOSED';
                if (wasError) {
                    errcode = 1;
                    reason = 'SOCKET_ERROR'
                }

                this.emit('disconnected', {
                    code: errcode,
                    reason: reason
                });
            });

            this.d_socket.on('data', this._onMessageReceived.bind(this));

            this._setupHeartbeat();
        });
    }

    closeConnection() {
        this._sendRequestP('sendClose')
        .then(() => {
            this.d_missedHeartbeats = 0;
            
            if (this.d_heartbeatToken) {
                clearInterval(this.d_heartbeatToken);
            }

            for (var k in this.d_outstandingRequests) {
                clearTimeout(this.d_outstandingRequests[k].timeoutToken);
            }

            this.d_connected = false;
            this.emit('disconnected', {
                code: 0,
                reason: 'SOCKET_CLOSED'
            });

            this.d_socket.end();
            this.d_socket = null;
        })
    }
};

module.exports = AnsibleClient;