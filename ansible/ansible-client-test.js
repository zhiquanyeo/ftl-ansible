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
})