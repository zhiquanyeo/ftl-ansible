const EventEmitter = require('events');
const ProtocolCommands = require('./protocol-commands');

// Re-map
const ProtocolResponses = ProtocolCommands.responses;

const ConnectionState = {
    PRE_CONNECT : 'PRE_CONNECT',
    CONNECTED   : 'CONNECTED',
    ACTIVE      : 'ACTIVE',
    QUEUED      : 'QUEUED'
};

function _generateResponsePacket(seq, mrsp, data) {
    return {
        SEQ: seq || 0,
        MRSP: mrsp || 0,
        DATA: data || new Buffer(0)
    };
}

class Connection extends EventEmitter {
    constructor(rinfo, active, hbeatTimeout) {
        super();

        this.d_rinfo = rinfo;
        this.active = active;
        this.d_useHeartbeat = false;
        
        if (hbeatTimeout === undefined) {
            hbeatTimeout = 5000;
        }

        this.d_hbeatTimeout = hbeatTimeout;

        if (hbeatTimeout !== -1) {
            this.d_useHeartbeat = true;
            this.d_hbeatTimer = setTimeout(() => {
                this.emit('timedOut');
            }, this.d_hbeatTimeout);
        }

        this.d_state = ConnectionState.PRE_CONNECT;
    }

    set active(val) {
        this.d_active = !!val;
        if (this.d_state === ConnectionState.CONNECTED ||
            this.d_state === ConnectionState.ACTIVE ||
            this.d_state === ConnectionState.QUEUED) {
            
            var oldState = this.d_state;
            
            this.d_state = this.d_active ? ConnectionState.ACTIVE :
                                           ConnectionState.QUEUED;
            this.emit('stateChanged', {
                from: oldState,
                to: this.d_state
            });
        }
    }

    get state() {
        return this.d_state;
    }

    processMessage(packet) {
        var result = false;
        switch (this.d_state) {
            case ConnectionState.PRE_CONNECT: 
                result = this._handlePreconnectState(packet);
                break;
            case ConnectionState.CONNECTED:
                result = this._handleConnectedState(packet);
                break;
            case ConnectionState.ACTIVE:
                result = this._handleActiveState(packet);
                break;
            case ConnectionState.QUEUED:
                result = this._handleQueuedState(packet);
                break;
        }

        // Only clear the timeout if we handled the message correctly
        if (result && this.d_useHeartbeat && packet.resetTimeout) {
            clearTimeout(this.d_hbeatTimer);
            this.d_hbeatTimer = setTimeout(() => {
                this.emit('timedOut');
            }, this.d_hbeatTimeout);
        }
    }

    // Private API
    _handlePreconnectState(packet) {
        var command = ProtocolCommands.getCommandType(packet.DID, packet.CID);
        var respPacket;
        var handled = false;

        if (command === 'SYS:CONN') {
            respPacket = _generateResponsePacket(packet.SEQ, 0);
            // Tell the connection pool to send this on our behalf
            this.emit('sendResponse', respPacket);
            this.d_state = ConnectionState.CONNECTED;
            
            // Also emit a state changed event
            this.emit('stateChanged', {
                from: ConnectionState.PRE_CONNECT,
                to: ConnectionState.CONNECTED
            });
            handled = true;
        }

        return handled;
    }

    _handleConnectedState(packet) {
        var command = ProtocolCommands.getCommandType(packet.DID, packet.CID);
        var respPacket;
        var handled = false;

        if (command === 'SYS:CONTROL_REQ') {
            if (this.d_active) {
                respPacket = _generateResponsePacket(packet.SEQ, 
                        ProtocolResponses.ConnectionActiveState.ACTIVE);
                this.d_state = ConnectionState.ACTIVE;
                
                this.emit('stateChanged', {
                    from: ConnectionState.CONNECTED,
                    to: ConnectionState.ACTIVE
                });

                handled = true;
            }
            else {
                respPacket = _generateResponsePacket(packet.SEQ, 
                        ProtocolResponses.ConnectionActiveState.QUEUED);
                this.d_state = ConnectionState.QUEUED;

                this.emit('stateChanged', {
                    from: ConnectionState.CONNECTED,
                    to: ConnectionState.QUEUED
                });

                handled = true;
            }
        }

        if (respPacket) {
            this.emit('sendResponse', respPacket);
        }

        return handled;
    }

    // This handles the bulk of stuff
    _handleActiveState(packet) {
        var command = ProtocolCommands.getCommandType(packet.DID, packet.CID);
        var respPacket;
        var handled = false;

        switch(command) {
            case 'SYS:HBEAT': {
                _handleHBEAT();
                return true;
            }
        }

        // Handle everything else
        var commandDetails = ProtocolCommands.getCommandDetails(command);
        if (commandDetails) {
            // if we need data, forward it out, otherwise just say we need to 
            // send a response
            if (commandDetails.dataRequired) {
                this.emit('dataRequired', {
                    packet: packet,
                    dataRequired: command,
                    respond: function (mrsp, data) {
                        var respPacket = _generateResponsePacket(packet.SEQ,
                                                            mrsp, data);
                        this.emit('sendResponse', respPacket);
                    }.bind(this)
                });
                handled = true;
            }
            else {
                respPacket = _generateResponsePacket(packet.SEQ, 0);
                handled = true;
            }
        }
        
        if (respPacket) {
            this.emit('sendResponse', respPacket);
        }
        return handled;
    }

    _handleQueuedState(packet) {
        var command = ProtocolCommands.getCommandType(packet.DID, packet.CID);
        var respPacket;

        switch(command) {
            case 'SYS:HBEAT': {
                _handleHBEAT();
                return true;
            }
        }

        // Everything else gets dropped
        return false;
    }

    // Common handlers
    _handleHBEAT(packet) {
        var respPacket = _generateResponsePacket(packet.SEQ, 
                this.d_active ? ProtocolResponses.ConnectionActiveState.ACTIVE :
                                ProtocolResponses.ConnectionActiveState.QUEUED);
        this.emit('sendResponse', respPacket);
    }

}

module.exports = Connection;