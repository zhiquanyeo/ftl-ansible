const chai = require('chai');
const expect = chai
            .use(require('chai-bytes'))
            .expect;
const PacketBuilder = require('./packet-builder');

describe('PacketBuilder', () => {
    it('builds simple client packet', () => {
        var packet = {
            DID: 0,
            CID: 1,
            SEQ: 1,
            resetTimeout: true
        };

        var expected = new Uint8Array([0xFF, 0xFE, 0x00, 0x01, 0x01, 0x01, 0xFC]);
        var buf = PacketBuilder.buildClientPacket(packet);
        expect(buf).to.equalBytes(expected);
    });

    it('builds complex client packet', () => {
        var packet = {
            DID: 0,
            CID: 2,
            SEQ: 4,
            DATA: new Buffer([0x01, 0x02, 0x03, 0x04]),
            resetTimeout: true,
        };

        var expected = new Uint8Array([0xFF, 0xFE, 0x00, 0x02, 0x04, 0x05, 0x01, 0x02, 0x03, 0x04, 0xea]);
        var buf = PacketBuilder.buildClientPacket(packet);
        expect(buf).to.equalBytes(expected);
    });

    it('builds simple server response packet', () => {
        var packet = {
            MRSP: 0,
            SEQ: 1,
        };

        var expected = new Uint8Array([0xFF, 0xFF, 0x00, 0x01, 0x01, 0xFD]);
        var buf = PacketBuilder.buildServerResponsePacket(packet);

        expect(buf).to.equalBytes(expected);
    });

    it('builds complex server response packet', () => {
        var packet = {
            MRSP: 1,
            SEQ: 5,
            DATA: new Buffer([0x01, 0x02, 0x03, 0x04])
        };

        var expected = new Uint8Array([0xFF, 0xFF, 0x01, 0x05, 0x05, 0x01, 0x02, 0x03, 0x04, 0xEA]);
        var buf = PacketBuilder.buildServerResponsePacket(packet);

        expect(buf).to.equalBytes(expected);
    });

    it('builds simple server async packet', () => {
        var packet = {
            ID_CODE: 5
        };

        var expected = new Uint8Array([0xFF, 0xFE, 0x05, 0x00, 0x01, 0xF9]);
        var buf = PacketBuilder.buildServerAsyncPacket(packet);

        expect(buf).to.equalBytes(expected);
    });

    it('builds complex server async packet', () => {
        var packet = {
            ID_CODE: 5,
            DATA: new Buffer([0x01, 0x02, 0x03, 0x04])
        };

        var expected = new Uint8Array([0xFF, 0xFE, 0x05, 0x00, 0x05, 0x01, 0x02, 0x03, 0x04, 0xEB]);
        var buf = PacketBuilder.buildServerAsyncPacket(packet);

        expect(buf).to.equalBytes(expected);
    });
});