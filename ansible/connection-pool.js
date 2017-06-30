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
const PacketParser = require('./protocol-packet/packet-parser');

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
        var connActive = false;

        if (this.d_connectionQueue.length === 0) {
            connActive = true;
        }

        // Set up the new connection
        var connection = new Connection(rinfo, connActive);
        const clientAddr = generateClientAddr(rinfo);
        
        this.d_connections[clientAddr] = connection;
        this.d_connectionQueue.push({
            clientAddr: clientAddr,
            connection: connection
        });

        connection.on('timedOut', 
                this._handleConnectionTimeout.bind(this, connection));
        connection.on('stateChanged', 
                this._handleConnectionStateChanged.bind(this, connection));
        connection.on('sendResponse', 
                this._handleConnectionResponse.bind(this, connection));
    }

    _handleConnectionTimeout(connection) {

    }

    _handleConnectionStateChanged(connection, stateInfo) {

    }

    _handleConnectionResponse(connection, originalRequest, response) {

    }

    /** Public API */
    processMessage(msg, rinfo) {
        const clientAddr = generateClientAddr(rinfo);
        if (!this.d_connections[clientAddr]) {
            this._newConnection(rinfo);
        }

        // Parse the packet
        var packetInfo = PacketParser.decodeClientPacket(msg);
        
        if (packetInfo.ok) {

        }
        else {
            logger.warn('[FTL-ANS] Dropping Packet due to error (' + 
                        packetInfo.errorType +'): ' + packetInfo.errorMsg);
        }

        // TODO If it's a CONN or DCONN command, pass it to the connection
        // Otherwise, we should check if this is bound for the active connection
    }

}

module.exports = ConnectionPool;