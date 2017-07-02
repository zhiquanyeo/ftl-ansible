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
const PacketBuilder = require('./protocol-packet/packet-builder');

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
        connection.on('dataRequired',
                this._handleConnectionDataRequired.bind(this, connection));
        connection.on('commandReceived',
                this._handleCommandReceived.bind(this, connection));
    }

    _handleConnectionTimeout(connection) {
        // Splice out the connection
        var connectionRemoved = false;
        for (var i = 0; i < this.d_connectionQueue.length; i++) {
            if (this.d_connectionQueue[i].clientAddr === connection.clientId) {
                connectionRemoved = true;
                this.d_connectionQueue.splice(i, 1);
                break;
            }
        }

        if (!connectionRemoved) {
            logger.warn('[FTL-ANS] Could not find connection ' + connection.clientId + ' for removal');
            return;
        }

        // Inform the new first connection that they are active
        if (this.d_connectionQueue.length > 0) {
            this.d_connectionQueue[0].connection.active = true;
        }
    }

    _handleConnectionStateChanged(connection, stateInfo) {
        // This might not be needed?
    }

    _handleConnectionResponse(connection, responsePacket) {
        // Just forward this along
        var respBuffer = PacketBuilder.buildServerResponsePacket(responsePacket);
        this.d_socket.send(respBuffer, 0, respBuffer.length, connection.rinfo.port, connection.rinfo.address);
    }

    _handleConnectionDataRequired(connection, dataReqdEvt) {
        // Ask the outside world for help, but attach a timeout(?)
        this.emit('dataRequired', dataReqdEvt);
    }

    _handleCommandReceived(connection, command, packet) {
        this.emit('commandReceived', command, packet);
    }

    /** Public API */
    get numConnections() {
        return this.d_connectionQueue.length;
    }

    processMessage(msg, rinfo) {
        const clientAddr = generateClientAddr(rinfo);
        if (!this.d_connections[clientAddr]) {
            this._newConnection(rinfo);
        }

        // Parse the packet
        var packetInfo = PacketParser.decodeClientPacket(msg);
        
        if (packetInfo.ok) {
            var activeConnection = this._activeConnection();
            if (activeConnection) {
                activeConnection.processMessage(packetInfo.packet);
            }
        }
        else {
            logger.warn('[FTL-ANS] Dropping Packet due to error (' + 
                        packetInfo.errorType +'): ' + packetInfo.errorMsg);
        }
    }

}

module.exports = ConnectionPool;