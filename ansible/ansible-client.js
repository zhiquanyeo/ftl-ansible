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
const PacketParser = require('./protocol-packet/packet-parser');

const DEFAULT_ADDR = 'localhost';
const DEFAULT_PORT = 41234;

const ConnectionState = {
    PRE_CONNECT : 'PRE_CONNECT',
    CONNECTED   : 'CONNECTED',
    ACTIVE      : 'ACTIVE',
    QUEUED      : 'QUEUED'
};

const MISSED_HEARTBEATS_TILL_DISCONNECT = 5;
const HEARTBEAT_INTERVAL = 200; // ms
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

        this.d_connected = false;
        this.d_state = ConnectionState.PRE_CONNECT;

        this.d_packetTimeout = opts.packetTimeout || 2000;

        this.d_heartbeatToken = null;
        this.d_missedHeartbeats = 0;

        this.d_heartbeatInterval = opts.heartbeatInterval ||
                                   HEARTBEAT_INTERVAL;
        this.d_missedHbeatTillDisconnect = opts.missedHbeatDisconnect ||
                                           MISSED_HEARTBEATS_TILL_DISCONNECT;
    }

    /** Private **/
    _createSocket() {
        const socket = dgram.createSocket('udp4');

        socket.on('error', (err) => {
            logger.error(`[FTL-ANS-CLI] Socket Error:\n${err.stack}`);
            this.emit('error', err);
        });

        socket.on('message', (msg, rinfo) => {
            this._onMessageReceived(msg, rinfo);
        });

        return socket;
    }

    _onMessageReceived(msg, rinfo) {
        // Parse into a packet object
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
                logger.warn('[FTL-ANS-CLI] Invalid command type');
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
    }

    _sendRequestP(reqType, argArray) {
        return new Promise((resolve, reject) => {
            var commandDetails = ProtocolCommands.getCommandDetailsFromFn(reqType);
            if (!commandDetails) {
                reject(new Error('Invalid Request: ' + reqType));
                return;
            }

            if (commandDetails.params && 
                (!argArray || 
                 argArray.length < commandDetails.params.length)) {
                reject(new Error('Too few arguments for ' + reqType));
                return;
            }

            // set timeout 
            // TODO maybe only set this if we need to ack?
            var _requestTimeout = setTimeout(() => {
                reject(new Error('Request Timed Out'));
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
                timeoutToken: _requestTimeout
            };
            
            this.d_outstandingRequests[seqNum] = pendingRequest;

            this.d_socket.send(pktBuf, 0, pktBuf.length, 
                    this.d_remotePort, this.d_remoteAddr,
                    (err) => {
                        if (err) {
                            // If there was an error, remove this from outstanding requests
                            delete this.d_outstandingRequests[seqNum];
                            reject(err);
                            logger.error('[FTL-ANS-CLI] Error while sending: ', err);
                        }
                    });
        });
    }

    _setupHeartbeat() {
        this.d_heartbeatToken = setInterval(() => {
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
                
                // If we are over the missed hbeat threshold
                // disconnect and restart the socket
                if (this.d_missedHeartbeats >= this.d_missedHbeatTillDisconnect) {
                    clearInterval(this.d_heartbeatToken);
                    this.d_connected = false;
                    var oldState = this.d_state;
                    this.d_state = ConnectionState.PRE_CONNECT;
                    this.emit('disconnected');
                    this.emit('stateChanged', {
                        oldState: oldState,
                        newState: this.d_state
                    });

                    this.d_socket.removeAllListeners();
                    this.d_socket = this._createSocket();
                }
            });
        }, this.d_heartbeatInterval);
    }

    connect() {
        if (this.d_connected) {
            return Promise.resolve();
        }

        return this._sendRequestP('sendConn')
        .then(() => {
            var oldState = this.d_state;
            this.d_state = ConnectionState.CONNECTED;
            this.emit('stateChanged', {
                oldState: oldState,
                newState: this.d_state
            });

            return this._sendRequestP('sendControlReq');
        })
        .then((status) => {
            var oldState = this.d_state;
            if (status === ProtocolCommands.Responses.ConnectionActiveState.ACTIVE) {
                this.d_state = ConnectionState.ACTIVE;
            }
            else {
                this.d_state = ConnectionState.QUEUED;
            }

            this.d_connected = true;
            this.emit('stateChanged', {
                oldState: oldState,
                newState: this.d_state
            });

            this._setupHeartbeat();

            return this.d_state;
        })
        .catch((err) => {
            logger.error('[FTL-ANS-CLI] Error during connection: ', err);
        });
    }

    close() {
        // Send a final CLOSE request to the server
        this._sendRequestP('sendClose');
        
        if (this.d_heartbeatToken) {
            clearInterval(this.d_heartbeatToken);
        }

        for (var k in this.d_outstandingRequests) {
            clearTimeout(this.d_outstandingRequests[k].timeoutToken);
        }

        this.d_connected = false;
        var oldState = this.d_state;
        this.d_state = ConnectionState.PRE_CONNECT;
        this.emit('stateChanged', {
            oldState: oldState,
            newState: this.d_state
        });

        this.d_socket.removeAllListeners();
        this.d_socket = this._createSocket();
    }
};

ProtocolCommands.listClientFnNames().forEach((fnName) => {
    AnsibleClient.prototype[fnName + 'P'] = function() {
        return this._sendRequestP(fnName, Array.prototype.slice.call(arguments, 0))
    };

    AnsibleClient.prototype[fnName] = function() {
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

module.exports = AnsibleClient;