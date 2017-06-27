const chai = require('chai');
const expect = chai
                .use(require('chai-bytes'))
                .expect;
const PacketParser = require('./packet-parser');

describe('PacketParser', () => {
    it('decodes simple client packet', () => {
        var inboundBuf = new Buffer([0xFF, 0xFE, 0x00, 0x01, 0x01, 0x01, 0xFC]);
        var expectedPacket = {
            DID: 0,
            CID: 1,
            SEQ: 1,
            resetTimeout: true,
            requestAck: false,
            DATA: new Buffer(0)
        };

        var testPacketInfo = PacketParser.decodeClientPacket(inboundBuf);
        expect(testPacketInfo.ok).to.equal(true);
        var testPacket = testPacketInfo.packet;
        expect(testPacket.DID).to.equal(expectedPacket.DID);
        expect(testPacket.CID).to.equal(expectedPacket.CID);
        expect(testPacket.SEQ).to.equal(expectedPacket.SEQ);
        expect(testPacket.resetTimeout).to.equal(expectedPacket.resetTimeout);
        expect(testPacket.requestAck).to.equal(expectedPacket.requestAck);
        
    });

    it('decodes complex client packet', () => {
        var inboundBuf = new Buffer([0xFF, 0xFE, 0x00, 0x02, 0x04, 0x05, 0x01, 0x02, 0x03, 0x04, 0xea]);
        var expectedPacket = {
            DID: 0,
            CID: 2,
            SEQ: 4,
            resetTimeout: true,
            requestAck: false,
            DATA: new Buffer([0x01, 0x02, 0x03, 0x04])
        };

        var testPacketInfo = PacketParser.decodeClientPacket(inboundBuf);
        expect(testPacketInfo.ok).to.equal(true);
        var testPacket = testPacketInfo.packet;
        expect(testPacket.DID).to.equal(expectedPacket.DID);
        expect(testPacket.CID).to.equal(expectedPacket.CID);
        expect(testPacket.SEQ).to.equal(expectedPacket.SEQ);
        expect(testPacket.resetTimeout).to.equal(expectedPacket.resetTimeout);
        expect(testPacket.requestAck).to.equal(expectedPacket.requestAck);
        
    });

    it('correctly rejects incorrect checksum', () => {
        var inboundBuf = new Buffer([0xFF, 0xFE, 0x00, 0x01, 0x01, 0x01, 0xAA]);
        var expectedPacket = {
            DID: 0,
            CID: 1,
            SEQ: 1,
            resetTimeout: true,
            requestAck: false,
            DATA: new Buffer(0)
        };

        var testPacketInfo = PacketParser.decodeClientPacket(inboundBuf);
        expect(testPacketInfo.ok).to.equal(false);
    });

    it('correctly rejects incorrect length packet', () => {
        var inboundBuf = new Buffer([0xFF, 0xFE, 0x00, 0x02, 0x04, 0x05, 0x01, 0x02, 0x03, 0xea]);
        var expectedPacket = {
            DID: 0,
            CID: 2,
            SEQ: 4,
            resetTimeout: true,
            requestAck: false,
            DATA: new Buffer([0x01, 0x02, 0x03, 0x04])
        };

        var testPacketInfo = PacketParser.decodeClientPacket(inboundBuf);
        expect(testPacketInfo.ok).to.equal(false);
    });
});