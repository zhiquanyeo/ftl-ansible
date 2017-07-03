const chai = require('chai');
const expect = chai
                .use(require('chai-bytes'))
                .expect;
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);

const Promise = require('promise');
const mockery = require('mockery');
const sinon = require('sinon');
const sinonTestFactory = require('sinon-test');
const sinonTest = sinonTestFactory(sinon);

const EventEmitter = require('events');
const PacketBuilder = require('./protocol-packet/packet-builder');

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

describe('Ansible Server', () => {
    var AnsibleServer;
    before(() => {
        mockery.enable({
            warnOnReplace: false,
            warnOnUnregistered: false,
            useCleanCache: true
        });

        mockery.registerMock('dgram', MockDgram);
        AnsibleServer = require('./ansible-server');
    });

    after(() => {
        mockery.disable();
    });

    it('should process a message from the socket correctly', sinonTest(function() {
        mockSocket.reset();
        var server = new AnsibleServer();
        var msgReceivedSpy = this.spy(server, '_onMessageReceived');

        // Emit the event
        mockSocket.emit('message', new Buffer(0), {
            address: 'localhost',
            port: 1
        });

        sinon.assert.calledOnce(msgReceivedSpy);
    }));

    it('should emit a commandReceived event correctly', (done) => {
        var p = new Promise((resolve, reject) => {
            mockSocket.reset();
            var server = new AnsibleServer();

            server.on('commandReceived', (commandEvent) => {
                expect(commandEvent.command).to.be.equal('ROBOT:SET_MOTOR');
                expect(commandEvent.params).to.have.all.keys('port');
                expect(commandEvent.params.port).to.be.equal(0x0BCD);
                resolve();
            })

            var mockRinfo = {
                address: 'localhost',
                port: 1
            }

            var packetBuf = PacketBuilder.buildClientPacket({
                SEQ: 1,
                DID: 0,
                CID: 1
            });
            mockSocket.emit('message', packetBuf, mockRinfo);

            packetBuf = PacketBuilder.buildClientPacket({
                SEQ: 2,
                DID: 0,
                CID: 2
            });
            mockSocket.emit('message', packetBuf, mockRinfo);

            packetBuf = PacketBuilder.buildClientPacket({
                SEQ: 3,
                DID: 1,
                CID: 3,
                DATA: new Buffer([0x0B, 0xCD])
            });
            mockSocket.emit('message', packetBuf, mockRinfo);
        });

        expect(p).to.be.fulfilled.notify(done);
    });
});