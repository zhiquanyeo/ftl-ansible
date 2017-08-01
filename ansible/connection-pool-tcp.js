const logger = require('winston');
const EventEmitter = require('events');
const PacketParser = require('./protocol-packet/packet-parser');
const PacketBuilder = require('./protocol-packet/packet-builder');
const ProtocolCommands = require('./protocol-commands');
const Connection = require('./connection-tcp');

function generateClientId(socket) {
    var address = socket.address();
    return address.address + ':' + address.port;
}

class ConnectionPool extends EventEmitter {
    constructor() {
        super();

        this.d_connections = {};
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

    registerSocket(socket) {
        var connActive = false;

        if (this.d_connectionQueue.length === 0) {
            connActive = true;
        }

        var connection = new Connection(socket, connActive);
        const clientId = generateClientId(socket);

        this.d_connections[clientId] = connection;
        this.d_connectionQueue.push({
            clientId: clientId,
            connection: connection
        });

        connection.on('timedOut',
                this._handleRemoveConnection.bind(this, connection, 'timed out'));
        connection.on('closed',
                this._handleRemoveConnection.bind(this, connection, 'closed'));
        connection.on('dataRequired',
                this._handleConnectionDataRequired.bind(this, connection));
        connection.on('commandReceived',
                this._handleCommandReceived.bind(this, connection));
    }

    _handleRemoveConnection(connection, reason, details) {
        logger.info('Removing connection: ', connection.clientId, ' due to ', reason, '(', details.reason, ')');
        connection.removeAllListeners();

        var connectionRemoved = false;
        for (var i = 0; i < this.d_connectionQueue.length; i++) {
            if (this.d_connectionQueue[i].clientId === connection.clientId) {
                connectionRemoved = true;
                this.d_connectionQueue.splice(i, 1);
                break;
            }
        }

        if (!connectionRemoved) {
            logger.warn('[FTL-ANS] Could not find connection ' + connection.clientId);
            return;
        }

        connection.shutdown();

        if (this.d_connectionQueue.length > 0) {
            this.d_connectionQueue[0].connection.active = true;
        }
    }

    _handleConnectionDataRequired(connection, dataReqdEvt) {
        this.emit('dataRequired', dataReqdEvt);
    }

    _handleCommandReceived(connection, command, packet) {
        this.emit('commandReceived', command, packet);
    }

    /** Public API **/
    get numConnection() {
        return this.d_connectionQueue.length;
    }

    sendAsyncMessage(idCode, data, broadcast) {
        if (broadcast) {
            for (var i = 0; i < this.d_connectionQueue.length; i++) {
                this.d_connectionQueue[i].connection.sendAsyncMessage(idCode, data);
            }
        }
        else if (this._activeConnection()) {
            this._activeConnection().sendAsyncMessage(idCode, data);
        }
    }
};

module.exports = ConnectionPool;