/**
 * Connection Pool
 * 
 * This module manages a set of connections, including managing a queue
 * of active connections, as well as timing out connections that have not
 * been responsive.
 * 
 * This is the gateway's interface to the various connections, and for 
 * all intents and purposes should be treated as "just another connection"
 */

const logger = require('winston');

const EventEmitter = require('events');
const Connection = require('./connection');

function generateClientAddr(rinfo) {
    return rinfo.address + ':' + rinfo.port;
}

class ConnectionPool extends EventEmitter {
    constructor(socket) {
        super();

        this.d_socket = socket;

        // Map of all connections
        this.d_connections = {};

        // Ordering of connections
        this.d_connectionQueue = [];
    }

    _activeConnection() {
        if (this.d_connectionQueue.length > 0) {
            return this.d_connectionQueue[0].connection;
        }
        else {
            return null;
        }
    }

    /**
     * Set up a new connection and add it to the queue
     * @param {Object} rinfo 
     * @private
     */
    _newConnection(rinfo) {
        // Set up the new connection
        var connection = new Connection(rinfo);
        const clientAddr = generateClientAddr(rinfo);
        
        this.d_connections[clientAddr] = connection;
        this.d_connectionQueue.push({
            clientAddr: clientAddr,
            connection: connection
        });
    }

    /** Public API */
    processMessage(msg, rinfo) {
        const clientAddr = generateClientAddr(rinfo);
        if (!this.d_connections[clientAddr]) {
            this._newConnection(rinfo);
        }

        // TODO If it's a CONN or DCONN command, pass it to the connection
        // Otherwise, we should check if this is bound for the active connection
    }

}

module.exports = ConnectionPool;