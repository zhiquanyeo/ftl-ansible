const machina = require('machina');
const EventEmitter = require('events');
const ProtocolCommands = require('./protocol-commands');

class Connection extends EventEmitter {
    constructor(rinfo, active, hbeatTimeout) {
        super();

        this.d_rinfo = rinfo;
        this.d_active = false;
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

        this.d_fsm = new machina.Fsm({
            initialization: function (options) {

            },

            namespace: 'ansible-connection',
            initialState: 'pre-connect',
            states: {
                'pre-connect': {
                    // Handlers
                    'SYS:CONN': function (packet) {
                        // Set up the response
                        var resp = {
                            MRSP: 0, // OK
                            SEQ: packet.SEQ || 0,
                        };
                        this.emit('sendResponse', resp);
                        this.transition('connected');
                    }
                },
                'connected': {
                    'SYS:CONTROL_REQ': function () {
                        if (this.d_connActive) {
                            this.transition('active');
                        }
                        else {
                            this.transition('queued');
                        }
                    },
                },
                'active': {
                    'queued': 'queued',
                },
                'queued': {
                    'active': 'active',
                }
            },

            // Public API
            setConnActive: function (val) {
                this.d_connActive = !!val;
                if (this.d_connActive) {
                    this.handle('active');
                }
                else {
                    this.handle('queued');
                }
            },

            processCommand: function(cmd, packet) {
                this.handle(cmd, packet);
            }
        });
        
        this.d_fsm.on('transition', (data) => {
            this.emit('stateChanged', {
                from: data.fromState,
                to: data.toState
            });
        });

        this.d_fsm.on('sendResponse', (resp) => {
            this.emit('sendResponse', resp);
        });

        this.active = !!active;
    }

    set active(val) {
        this.d_active = !!val;
        this.d_fsm.setConnActive(this.d_active);
    }

    get state() {
        return this.d_fsm.state;
    }

    processMessage(packet) {
        var command = ProtocolCommands.getCommandType(packet.DID, packet.CID);
        if (!command) command = '';
        this.d_fsm.processCommand(command, packet);

        if (this.d_useHeartbeat) {
            clearTimeout(this.d_hbeatTimer);
            this.d_hbeatTimer = setTimeout(() => {
                this.emit('timedOut');
            }, this.d_hbeatTimeout);
        }
    }
}

module.exports = Connection;