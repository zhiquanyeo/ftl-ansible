const logger = require('winston');

const EventEmitter = require('events');

const ConnectionStates = {
    PRE_CONNECT: 0,
    CONNECTED: 1,
    ACTIVE: 2,
    QUEUED: 3,
};

class Connection extends EventEmitter {
    constructor(rinfo) {
        super();

        this.d_rinfo = rinfo;
        this.d_state = ConnectionStates.PRE_CONNECT;
        this.d_creationTime = Date.now();
        this.d_lastActive = Date.now();
    }

    /** Public API */
    processMessage(msg) {

    }
};

module.exports = Connection;