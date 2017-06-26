const logger = require('winston');

const EventEmitter = require('events');

const ProtocolStates = {
    NOT_CONNECTED: 0,
    
}

class Connection extends EventEmitter {
    constructor(socket, rinfo) {
        super();

        this.d_socket = socket;
        this.d_rinfo = rinfo;
        this.d_state = 
    }

    /** Public API */
    processMessage(msg) {

    }
};

module.exports = Connection;