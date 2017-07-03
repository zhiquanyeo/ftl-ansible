const chai = require('chai');
const expect = chai
                .use(require('chai-bytes'))
                .expect;
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);

const Promise = require('promise');
const ConnectionPool = require('./connection-pool');
const EventEmitter = require('events');
const PacketBuilder = require('./protocol-packet/packet-builder');

// Set up a mock socket
class MockSocket extends EventEmitter {
    constructor() {
        super();
        this.d_lastDest = {
            address: '',
            port: 0
        };

        this.d_transmissions = [];
        this.d_lastBuffer = new Buffer(0);
        this.d_lastCallback = null;
    }

    get lastBuffer() {
        if (this.d_transmissions.length > 0) {
            return this.d_transmissions[this.d_transmissions.length - 1].buffer;
        }
        return new Buffer(0);
    }

    get lastDestination() {
        if (this.d_transmissions.length > 0) {
            return this.d_transmissions[this.d_transmissions.length - 1].dest;
        }
        return {
            address: '',
            port: 0
        };
    }

    get transmissionLog() {
        return this.d_transmissions;
    }

    send(data, offset, length, port, address, callback) {
        this.d_lastBuffer = data.slice(offset, length);
        this.d_lastDest.address = address;
        this.d_lastDest.port = port;
        
        this.d_transmissions.push({
            buffer: data.slice(offset, length),
            dest: {
                address: address,
                port: port
            }
        });
        if (callback) callback(null);
    }

    reset() {
        this.d_lastDest = {
            address: '',
            port: 0
        };

        this.d_transmissions = [];
        this.d_lastBuffer = new Buffer(0);
    }

    clearTransmissionLog() {
        this.d_transmissions = [];
    }
}

const mockSocket = new MockSocket();

describe('ConnectionPool', () => {
    it('creates a new connection', () => {
        mockSocket.reset();
        var connPool = new ConnectionPool(mockSocket);

        // Simulate a new connection message
        var connRinfo = {
            address: 'localhost',
            port: 1
        };
        var connPacket = PacketBuilder.buildClientPacket({
            SEQ: 1,
            DID: 0,
            CID: 1
        });

        //Simulate the message send
        connPool.processMessage(connPacket, connRinfo);

        expect(connPool.numConnections).to.equal(1);
    });

    it('creates multiple connections correctly', () => {
        mockSocket.reset();
        var connPool = new ConnectionPool(mockSocket);

        // Set up 2 connections
        var conn1rinfo = {
            address: 'localhost',
            port: 1
        };
        var conn1packet = PacketBuilder.buildClientPacket({
            SEQ: 1,
            DID: 0,
            CID: 1
        });

        var conn2rinfo = {
            address: 'localhost',
            port: 2
        };
        var conn2packet = PacketBuilder.buildClientPacket({
            SEQ: 1,
            DID: 0,
            CID: 1
        });

        connPool.processMessage(conn1packet, conn1rinfo);
        connPool.processMessage(conn2packet, conn2rinfo);

        expect(connPool.numConnections).to.equal(2);
        expect(connPool.d_connectionQueue[0].connection.active).to.equal(true);
        expect(connPool.d_connectionQueue[1].connection.active).to.equal(false);
        expect(connPool.d_connectionQueue[0].connection.clientId).to.equal('localhost:1');
        expect(connPool.d_connectionQueue[1].connection.clientId).to.equal('localhost:2');
    });

    it('sends a response correctly', () => {
        mockSocket.reset();
        var connPool = new ConnectionPool(mockSocket);

        // Set up 2 connections
        var conn1rinfo = {
            address: 'localhost',
            port: 1
        };
        var conn1packet = PacketBuilder.buildClientPacket({
            SEQ: 1,
            DID: 0,
            CID: 1
        });

        var expectedResponse = PacketBuilder.buildServerResponsePacket({
            SEQ: 1,
            MRSP: 0
        });

        connPool.processMessage(conn1packet, conn1rinfo);
        expect(mockSocket.lastDestination.address).to.equal('localhost');
        expect(mockSocket.lastDestination.port).to.equal(1);
        expect(mockSocket.lastBuffer).to.equalBytes(expectedResponse);
    });

    it('emits a dataRequested event correctly', (done) => {
        var p = new Promise((resolve, reject) => {

            mockSocket.reset();
            var connPool = new ConnectionPool(mockSocket);

            connPool.on('dataRequired', (evt) => {
                expect(evt.dataRequired).to.equal('SYS:VERS');
                expect(evt.respond).to.be.a('function');
                resolve();
            });

            // Set up 2 connections
            var conn1rinfo = {
                address: 'localhost',
                port: 1
            };

            // Initial connection packet
            var conn1packet = PacketBuilder.buildClientPacket({
                SEQ: 1,
                DID: 0,
                CID: 1
            });
            
            connPool.processMessage(conn1packet, conn1rinfo);

            //CONTROL_REQ packet
            conn1packet = PacketBuilder.buildClientPacket({
                SEQ: 2,
                DID: 0,
                CID: 2
            });
            connPool.processMessage(conn1packet, conn1rinfo);

            //VERS packet
            conn1packet = PacketBuilder.buildClientPacket({
                SEQ: 2,
                DID: 0,
                CID: 4
            });
            connPool.processMessage(conn1packet, conn1rinfo);
        });

        expect(p).to.be.fulfilled.notify(done);
    });

    it('handles a dataRequested event correctly', (done) => {
        var p = new Promise((resolve, reject) => {

            mockSocket.reset();
            var connPool = new ConnectionPool(mockSocket);

            connPool.on('dataRequired', (evt) => {
                expect(evt.dataRequired).to.equal('SYS:VERS');
                expect(evt.respond).to.be.a('function');
                evt.respond(0, new Buffer([1]));
                
                var expected = PacketBuilder.buildServerResponsePacket({
                    MRSP: 0,
                    SEQ: 3,
                    DATA: new Buffer([1])
                });

                expect(mockSocket.lastBuffer).to.be.equalBytes(expected);
                resolve();
            });

            // Set up 2 connections
            var conn1rinfo = {
                address: 'localhost',
                port: 1
            };

            // Initial connection packet
            var conn1packet = PacketBuilder.buildClientPacket({
                SEQ: 1,
                DID: 0,
                CID: 1
            });
            
            connPool.processMessage(conn1packet, conn1rinfo);

            //CONTROL_REQ packet
            conn1packet = PacketBuilder.buildClientPacket({
                SEQ: 2,
                DID: 0,
                CID: 2
            });
            connPool.processMessage(conn1packet, conn1rinfo);

            //VERS packet
            conn1packet = PacketBuilder.buildClientPacket({
                SEQ: 3,
                DID: 0,
                CID: 4
            });
            connPool.processMessage(conn1packet, conn1rinfo);
        });

        expect(p).to.be.fulfilled.notify(done);
    });

    it('emits command events correctly', (done) => {
        var p = new Promise((resolve, reject) => {

            mockSocket.reset();
            var connPool = new ConnectionPool(mockSocket);

            connPool.on('commandReceived', (command, packet) => {
                expect(command).to.equal('ROBOT:SET_MOTOR');
                resolve();
            });

            // Set up 2 connections
            var conn1rinfo = {
                address: 'localhost',
                port: 1
            };

            // Initial connection packet
            var conn1packet = PacketBuilder.buildClientPacket({
                SEQ: 1,
                DID: 0,
                CID: 1
            });
            
            connPool.processMessage(conn1packet, conn1rinfo);

            //CONTROL_REQ packet
            conn1packet = PacketBuilder.buildClientPacket({
                SEQ: 2,
                DID: 0,
                CID: 2
            });
            connPool.processMessage(conn1packet, conn1rinfo);

            //SETMOTOR packet
            conn1packet = PacketBuilder.buildClientPacket({
                SEQ: 3,
                DID: 1,
                CID: 3
            });
            connPool.processMessage(conn1packet, conn1rinfo);
        });

        expect(p).to.be.fulfilled.notify(done);
    });

    it('sends a non-broadcast async message to the correct connection', () => {
        mockSocket.reset();
        var connPool = new ConnectionPool(mockSocket);

        // Set up 2 connections
        var conn1rinfo = {
            address: 'localhost',
            port: 1
        };
        var conn1packet = PacketBuilder.buildClientPacket({
            SEQ: 1,
            DID: 0,
            CID: 1
        });

        var conn2rinfo = {
            address: 'localhost',
            port: 2
        };
        var conn2packet = PacketBuilder.buildClientPacket({
            SEQ: 1,
            DID: 0,
            CID: 1
        });

        connPool.processMessage(conn1packet, conn1rinfo);
        connPool.processMessage(conn2packet, conn2rinfo);

        conn1packet = PacketBuilder.buildClientPacket({
            SEQ: 2,
            DID: 0,
            CID: 2
        });
        connPool.processMessage(conn1packet, conn1rinfo);

        conn2packet = PacketBuilder.buildClientPacket({
            SEQ: 2,
            DID: 0,
            CID: 2
        });
        connPool.processMessage(conn2packet, conn2rinfo);

        // By this point conn1 has active state, so we expect that it receives
        // the async message
        connPool.sendAsyncMessage(0x04, new Buffer([0x1, 0x2, 0x3]));
        expect(mockSocket.lastDestination.address).to.equal('localhost');
        expect(mockSocket.lastDestination.port).to.equal(1);

        var expectedBuf = PacketBuilder.buildServerAsyncPacket({
            ID_CODE: 0x04,
            DATA: new Buffer([0x1, 0x2, 0x3])
        });
        expect(mockSocket.lastBuffer).to.equalBytes(expectedBuf);
    });

    it('sends a broadcast async message to the correct connection', () => {
        mockSocket.reset();
        var connPool = new ConnectionPool(mockSocket);

        // Set up 2 connections
        var conn1rinfo = {
            address: 'localhost',
            port: 1
        };
        var conn1packet = PacketBuilder.buildClientPacket({
            SEQ: 1,
            DID: 0,
            CID: 1
        });

        var conn2rinfo = {
            address: 'localhost',
            port: 2
        };
        var conn2packet = PacketBuilder.buildClientPacket({
            SEQ: 1,
            DID: 0,
            CID: 1
        });

        connPool.processMessage(conn1packet, conn1rinfo);
        connPool.processMessage(conn2packet, conn2rinfo);

        conn1packet = PacketBuilder.buildClientPacket({
            SEQ: 2,
            DID: 0,
            CID: 2
        });
        connPool.processMessage(conn1packet, conn1rinfo);

        conn2packet = PacketBuilder.buildClientPacket({
            SEQ: 2,
            DID: 0,
            CID: 2
        });
        connPool.processMessage(conn2packet, conn2rinfo);

        // Clear the transmission log here, and expect 2 messages
        mockSocket.clearTransmissionLog();

        connPool.sendAsyncMessage(0x04, new Buffer([0x1, 0x2, 0x3]), true);
        expect(mockSocket.transmissionLog.length).to.equal(2);

        var expectedBuf = PacketBuilder.buildServerAsyncPacket({
            ID_CODE: 0x04,
            DATA: new Buffer([0x1, 0x2, 0x3])
        });

        var remainingTargets = {
            'localhost:1': true,
            'localhost:2': true
        };

        for (var i = 0; i < mockSocket.transmissionLog.length; i++) {
            var transmission = mockSocket.transmissionLog[i];
            var addr = transmission.dest.address + ':' + transmission.dest.port;
            expect(remainingTargets).to.have.any.keys(addr);
            delete remainingTargets[addr];
            expect(transmission.buffer).to.equalBytes(expectedBuf);

        }
    });

});