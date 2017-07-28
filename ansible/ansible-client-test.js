const chai = require('chai');
const expect = chai
                .use(require('chai-bytes'))
                .expect;
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);

const Promise = require('promise');
const mockery = require('mockery');

const EventEmitter = require('events');
const PacketBuilder = require('./protocol-packet/packet-builder');
const PacketParser = require('./protocol-packet/packet-parser');
const ProtocolCommands = require('./protocol-commands');

class MockSocket extends EventEmitter {
    constructor() {
        super();
        this.d_boundPort = 0;
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

    bind(port) {
        this.d_boundPort = port;
    }

    send(data, offset, length, port, address, callback) {
        this.emit('dataSent', {
            data: data,
            offset: offset,
            length: length,
            port: port,
            address: address
        });

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

const MockDgram = {
    createSocket: function () {
        return mockSocket;
    }
}

describe('Ansible Client', () => {
    var AnsibleClient;
    before(() => {
        mockery.enable({
            warnOnReplace: false,
            warnOnUnregistered: false,
            useCleanCache: true
        });

        mockery.registerMock('dgram', MockDgram);
        AnsibleClient = require('./ansible-client');
    });

    after(() => {
        mockery.disable();
    });

    it('should contain setters/getters for all commands', () => {
        // Generate the list of commands
        var commandList = [];
        for (var device in ProtocolCommands.Commands) {
            var deviceCmds = ProtocolCommands.Commands[device];
            for (var cmd in deviceCmds) {
                var cmdInfo = deviceCmds[cmd];
                if (cmdInfo.clientFnName) {
                    commandList.push(cmdInfo.clientFnName);
                    commandList.push(cmdInfo.clientFnName + 'P');
                }
            }
        }

        var testClient = new AnsibleClient();
        commandList.forEach((fnName) => {
            expect(testClient[fnName]).to.be.a('function');
        });
    });

    it('should send correct packet buffers', () => {
        mockSocket.reset();
        var testClient = new AnsibleClient();

        var expectedBuffer = PacketBuilder.buildClientPacket({
            SEQ: 1,
            DID: 0,
            CID: 1,
            resetTimeout: true,
            requestAck: true
        });

        testClient.sendConn();
        expect(mockSocket.lastBuffer).to.be.equalBytes(expectedBuffer);
    });

    it('should connect to an Ansible Server correctly', () => {
        var p = new Promise((resolve, reject) => {
            mockSocket.reset();
            mockSocket.removeAllListeners();
            var testClient = new AnsibleClient();

            var packetNum = 1;
            mockSocket.on('dataSent', (dataArgs) => {
                var buf = dataArgs.data.slice(dataArgs.offset, dataArgs.length);
                var pktInfo = PacketParser.decodeClientPacket(buf);
                
                if (packetNum === 1) {
                    // Expect the first packet to be a CONN packet
                    expect(pktInfo.ok).to.be.true;
                    expect(pktInfo.packet.DID).to.equal(0);
                    expect(pktInfo.packet.CID).to.equal(1);
                    
                    // Build a response
                    var respPkt = {
                        SEQ: pktInfo.packet.SEQ,
                        MRSP: 0
                    };
                    var respBuf = PacketBuilder.buildServerResponsePacket(respPkt);
                    mockSocket.emit('message', respBuf);
                    packetNum++;
                }
                else if (packetNum === 2) {
                    // Should have gotten a connreq
                    expect(pktInfo.ok).to.be.true;
                    expect(pktInfo.packet.DID).to.equal(0);
                    expect(pktInfo.packet.CID).to.equal(2);

                    // Build a response
                    var respPkt = {
                        SEQ: pktInfo.packet.SEQ,
                        MRSP: 0,
                        DATA: new Buffer([0x00])
                    };
                    var respBuf = PacketBuilder.buildServerResponsePacket(respPkt);
                    mockSocket.emit('message', respBuf);
                    packetNum++;
                }
            });

            testClient.connect()
            .then((state) => {
                testClient.close();
                resolve(state);
            });
        });
        
        expect(p).to.eventually.be.equal('ACTIVE');
    });

    it('sends heartbeat pings correctly', (done) => {
        var p = new Promise((resolve, reject) => {
            mockSocket.reset();
            mockSocket.removeAllListeners();
            var testClient = new AnsibleClient();

            var packetNum = 1;
            mockSocket.on('dataSent', (dataArgs) => {
                var buf = dataArgs.data.slice(dataArgs.offset, dataArgs.length);
                var pktInfo = PacketParser.decodeClientPacket(buf);
                
                if (packetNum === 1) {
                    // Expect the first packet to be a CONN packet
                    expect(pktInfo.ok).to.be.true;
                    expect(pktInfo.packet.DID).to.equal(0);
                    expect(pktInfo.packet.CID).to.equal(1);
                    
                    // Build a response
                    var respPkt = {
                        SEQ: pktInfo.packet.SEQ,
                        MRSP: 0
                    };
                    var respBuf = PacketBuilder.buildServerResponsePacket(respPkt);
                    mockSocket.emit('message', respBuf);
                }
                else if (packetNum === 2) {
                    // Should have gotten a connreq
                    expect(pktInfo.ok).to.be.true;
                    expect(pktInfo.packet.DID).to.equal(0);
                    expect(pktInfo.packet.CID).to.equal(2);

                    // Build a response
                    var respPkt = {
                        SEQ: pktInfo.packet.SEQ,
                        MRSP: 0,
                        DATA: new Buffer([0x00])
                    };
                    var respBuf = PacketBuilder.buildServerResponsePacket(respPkt);
                    mockSocket.emit('message', respBuf);
                }
                else {
                    if (pktInfo.packet.DID === 0 &&
                        pktInfo.packet.CID === 3) {
                        // HBEAT
                        testClient.removeAllListeners();
                        testClient.close();
                        resolve();
                    }
                }

                packetNum++;
            });

            testClient.connect();
        });
        
        expect(p).to.be.fulfilled.notify(done);
    });

    it('disconnects if too many heartbeats have been missed', (done) => {
        var p = new Promise((resolve, reject) => {
            mockSocket.reset();
            mockSocket.removeAllListeners();

            // Create a client with a shortened timeout tolerance
            // For testing purposes
            var testClient = new AnsibleClient({
                packetTimeout: 200
            });

            var packetNum = 1;
            mockSocket.on('dataSent', (dataArgs) => {
                var buf = dataArgs.data.slice(dataArgs.offset, dataArgs.length);
                var pktInfo = PacketParser.decodeClientPacket(buf);
                
                if (packetNum === 1) {
                    // Expect the first packet to be a CONN packet
                    expect(pktInfo.ok).to.be.true;
                    expect(pktInfo.packet.DID).to.equal(0);
                    expect(pktInfo.packet.CID).to.equal(1);
                    
                    // Build a response
                    var respPkt = {
                        SEQ: pktInfo.packet.SEQ,
                        MRSP: 0
                    };
                    var respBuf = PacketBuilder.buildServerResponsePacket(respPkt);
                    mockSocket.emit('message', respBuf);
                }
                else if (packetNum === 2) {
                    // Should have gotten a connreq
                    expect(pktInfo.ok).to.be.true;
                    expect(pktInfo.packet.DID).to.equal(0);
                    expect(pktInfo.packet.CID).to.equal(2);

                    // Build a response
                    var respPkt = {
                        SEQ: pktInfo.packet.SEQ,
                        MRSP: 0,
                        DATA: new Buffer([0x00])
                    };
                    var respBuf = PacketBuilder.buildServerResponsePacket(respPkt);
                    mockSocket.emit('message', respBuf);
                }

                packetNum++;
            });

            testClient.on('disconnected', () => {
                testClient.removeAllListeners();
                testClient.close();
                resolve();
            });

            testClient.connect();
        });
        
        expect(p).to.be.fulfilled.notify(done);
    });

    it('switches active/queued states correctly', (done) => {
        var p = new Promise((resolve, reject) => {
            mockSocket.reset();
            mockSocket.removeAllListeners();
            var testClient = new AnsibleClient();

            var packetNum = 1;
            mockSocket.on('dataSent', (dataArgs) => {
                var buf = dataArgs.data.slice(dataArgs.offset, dataArgs.length);
                var pktInfo = PacketParser.decodeClientPacket(buf);
                
                if (packetNum === 1) {
                    // Expect the first packet to be a CONN packet
                    expect(pktInfo.ok).to.be.true;
                    expect(pktInfo.packet.DID).to.equal(0);
                    expect(pktInfo.packet.CID).to.equal(1);
                    
                    // Build a response
                    var respPkt = {
                        SEQ: pktInfo.packet.SEQ,
                        MRSP: 0
                    };
                    var respBuf = PacketBuilder.buildServerResponsePacket(respPkt);
                    mockSocket.emit('message', respBuf);
                }
                else if (packetNum === 2) {
                    // Should have gotten a connreq
                    expect(pktInfo.ok).to.be.true;
                    expect(pktInfo.packet.DID).to.equal(0);
                    expect(pktInfo.packet.CID).to.equal(2);

                    // Build a response
                    var respPkt = {
                        SEQ: pktInfo.packet.SEQ,
                        MRSP: 0,
                        DATA: new Buffer([0x01])
                    };
                    var respBuf = PacketBuilder.buildServerResponsePacket(respPkt);
                    mockSocket.emit('message', respBuf);
                }
                else if (packetNum < 5) {
                    // Just respond
                    var respPkt = {
                        SEQ: pktInfo.packet.SEQ,
                        MRSP: 0,
                        DATA: new Buffer([0x01])
                    };
                    var respBuf = PacketBuilder.buildServerResponsePacket(respPkt);
                    mockSocket.emit('message', respBuf);
                }
                else if (packetNum === 5) {
                    expect(pktInfo.ok).to.be.true;
                    expect(pktInfo.packet.DID).to.equal(0);
                    expect(pktInfo.packet.CID).to.equal(3);
                    var respPkt = {
                        SEQ: pktInfo.packet.SEQ,
                        MRSP: 0,
                        DATA: new Buffer([0x00])
                    };
                    var respBuf = PacketBuilder.buildServerResponsePacket(respPkt);
                    mockSocket.emit('message', respBuf);
                }

                packetNum++;
            });

            testClient.on('stateChanged', (stateInfo) => {
                if (stateInfo.newState === 'ACTIVE') {
                    testClient.removeAllListeners();
                    testClient.close();
                    resolve();
                }
            })

            testClient.connect();
        });
        
        expect(p).to.be.fulfilled.notify(done);
    });
})