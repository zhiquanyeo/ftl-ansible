const logger = require('winston');
const EventEmitter = require('events');

const PacketParser = require('./protocol-packet/packet-parser');
const PacketBuilder = require('./protocol-packet/packet-builder');
const ProtocolCommands = require('./protocol-commands');
const ProtocolConstants = ProtocolCommands.Constants;
const ProtocolResponses = ProtocolCommands.Responses;

function _generateResponsePacket(seq, mrsp, data) {
    return {
        SEQ: seq || 0,
        MRSP: mrsp || 0,
        DATA: data || new Buffer(0)
    };
}

class Connection extends EventEmitter {
    constructor(socket, isActive, hbeatTimeout) {
        super();

        this.d_socket = socket;
        this.d_active = false;

        var sockAddr = socket.address();
        this.d_clientId = sockAddr.address + ':' + sockAddr.port;

        // Run through the codepath whenever active changes
        this.active = isActive;
        this.d_useHeartbeat = false;

        if (hbeatTimeout === undefined) {
            hbeatTimeout = 5000;
        }

        this.d_hbeatTimeout = hbeatTimeout;

        if (hbeatTimeout !== -1) {
            this.d_useHeartbeat = true;
            this.d_hbeatTimer = setTimeout(() => {
                this._handleSocketTimeout('Heartbeat Timeout');
            }, this.d_hbeatTimeout);
        }

        // Hook up connection messages
        socket.on('timeout', this._handleSocketTimeout.bind(this, 'TCP Timeout'));
        socket.on('error', this._handleSocketError.bind(this));
        socket.on('close', this._handleSocketClose.bind(this));
        socket.on('data', this._handleSocketData.bind(this));
    }

    _handleSocketTimeout(reason) {
        this.emit('timedOut', { reason: reason });
    }

    _handleSocketError(err) {
        this.emit('error', err);
    }

    _handleSocketClose() {
        this.emit('closed', {
            reason: 'SOCKET_CLOSED'
        });
    }

    _handleSocketData(msg) {
        var packetInfo = PacketParser.decodeClientPacket(msg);

        if (packetInfo.ok) {
            var cmdType = ProtocolCommands.getCommandType(
                                    packetInfo.packet.DID,
                                    packetInfo.packet.CID);
            // If this is a sys command, handle it now
            if (cmdType.indexOf('SYS:') === 0) {
                this._handleSysMessage(cmdType, packetInfo.packet);
                return;
            }

            if (this.active) {
                this._handleMessage(cmdType, packetInfo.packet);
            }
            else {
                // Generate a response packet for a 'dropped' packet
                var respPacket = _generateResponsePacket(packetInfo.packet.SEQ, ProtocolConstants.INVALID_STATE);
                var respBuf = PacketBuilder.buildServerResponsePacket(respPacket);
                this.d_socket.write(respBuf, () => {
                    // Handle data written
                });
            }

            if (this.d_useHeartbeat && packetInfo.packet.resetTimeout) {
                clearTimeout(this.d_hbeatTimer);
                this.d_hbeatTimer = setTimeout(() => {
                    this._handleSocketTimeout('Heartbeat Timeout');
                }, this.d_hbeatTimeout);
            }
        }
        else {
            logger.warn('[FTL-ANS] Dropping packet due to error (' + 
                        packetInfo.errorType + '): ' + packetInfo.errorMsg);
        }
    }

    _handleSysMessage(cmdType, packet) {
        var respPacket, respBuf;
        switch (cmdType) {
            case 'SYS:HBEAT': {
                respPacket = _generateResponsePacket(packet.SEQ, ProtocolConstants.OK,
                        this.d_active ? new Buffer([ProtocolResponses.ConnectionActiveState.ACTIVE]) :
                                        new Buffer([ProtocolResponses.ConnectionActiveState.QUEUED]));
                respBuf = PacketBuilder.buildServerResponsePacket(respPacket);

            } break;
            case 'SYS:CLOSE': {
                this.d_socket.end();
                this.emit('closed', {
                    reason: 'SYS:CLOSE'
                });
            } break;
            case 'SYS:VERS': {
                // Send the version in packed form
                // [ byte 1: Major ] [ byte 2: Minor ]
                var version = 
                    ((ProtocolCommands.VersionInfo.API_MAJOR & 0xFF) << 8 | 
                    (ProtocolCommands.VersionInfo.API_MINOR & 0xFF)) & 0xFFFF;
                var versionBuf = new Buffer(2);
                
                versionBuf.writeUInt16BE(version, 0);
                respPacket = _generateResponsePacket(
                                        packet.SEQ, 
                                        ProtocolConstants.OK,
                                        versionBuf);
                respBuf = PacketBuilder.buildServerResponsePacket(respPacket);
            } break;
        }

        if (respBuf) {
            this.d_socket.write(respBuf, () => {
                // Handle data written
            });
        }

        if (this.d_useHeartbeat && packet.resetTimeout) {
            clearTimeout(this.d_hbeatTimer);
            this.d_hbeatTimer = setTimeout(() => {
                this._handleSocketTimeout('Heartbeat Timeout');
            }, this.d_hbeatTimeout);
        }
    }

    // General message handler
    _handleMessage(cmdType, packet) {
        var respPacket, respBuf;
        
        var commandDetails = ProtocolCommands.getCommandDetails(cmdType);
        if (commandDetails) {
            // If we need data, forward it out. Otherwise just send a response
            if (commandDetails.dataRequired) {
                this.emit('dataRequired', {
                    packet: packet,
                    command: cmdType,
                    respond: function (mrsp, data) {
                        var pkt = _generateResponsePacket(packet.SEQ, mrsp, data);
                        var buf = PacketBuilder.buildServerResponsePacket(pkt);
                        this.d_socket.write(buf, () => {
                            // Handle data written
                        });
                    }.bind(this)
                });
            }
            else {
                // Emit a commandReceived event
                this.emit('commandReceived', cmdType, packet);
                respPacket = _generateResponsePacket(packet.SEQ, ProtocolConstants.OK);
                respBuf = PacketBuilder.buildServerResponsePacket(respPacket);
            }
        }
        else {
            respPacket = _generateResponsePacket(packet.SEQ, ProtocolConstants.INVALID_COMMAND);
            respBuf = PacketBuilder.buildServerResponsePacket(respPacket);
        }

        if (respBuf) {
            this.d_socket.write(respBuf, () => {
                // Handle Data Written
            });
        }
    }

    get clientId() {
        return this.d_clientId;
    }

    get active() {
        return this.d_active;
    }

    set active (val) {
        var incomingVal = !!val;
        if (incomingVal !== this.d_active) {
            this.d_active = incomingVal;

            this.emit('stateChanged', this.d_active);
        }
    }

    shutdown() {
        clearTimeout(this.d_hbeatTimeout);
        this.d_hbeatTimeout = undefined;
        this.d_clientId = undefined;
        this.d_socket.destroy();
    }

    sendAsyncMessage(idCode, data) {
        var asyncPkt = {
            ID_CODE: idCode,
            DATA: data
        };

        var buf = PacketBuilder.buildServerAsyncPacket(asyncPkt);
        this.d_socket.write(buf, () => {

        });
    }
};

module.exports = Connection;