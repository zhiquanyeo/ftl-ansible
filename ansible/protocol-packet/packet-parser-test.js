const chai = require('chai');
const expect = chai
                .use(require('chai-bytes'))
                .expect;
const PacketParser = require('./packet-parser');
const PacketConstants = require('./packet-constants');

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
        expect(testPacket.DATA).to.equalBytes(expectedPacket.DATA);
    });

    it('correctly rejects smaller than normal sized packets', () => {
        var inboundBuf = new Buffer([0xFF, 0x01]); // 2 sized buffer

        var testPacketInfo = PacketParser.decodeClientPacket(inboundBuf);
        expect(testPacketInfo.ok).to.be.false;
        testPacketInfo = PacketParser.decodeServerAsyncPacket(inboundBuf);
        expect(testPacketInfo.ok).to.be.false;
        testPacketInfo = PacketParser.decodeServerResponsePacket(inboundBuf);
        expect(testPacketInfo.ok).to.be.false;
    });

    it('correctly rejects incorrect checksum in client packet', () => {
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
        expect(testPacketInfo.errorType)
                .to.equal(PacketConstants.ErrorTypes.ChecksumMismatch);
    });

    it('correctly rejects incorrect length packet in client packet', () => {
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
        expect(testPacketInfo.errorType)
                .to.equal(PacketConstants.ErrorTypes.SizeMismatch);
    });

    it('decodes simple server response packet', () => {
        var inboundBuf = new Buffer([0xFF, 0xFF, 0x00, 0x01, 0x01, 0xFD]);
        var expectedPacket = {
            MRSP: 0,
            SEQ: 1,
            DATA: new Buffer(0)
        };

        var testPacketInfo = PacketParser.decodeServerResponsePacket(inboundBuf);
        expect(testPacketInfo.ok).to.equal(true);
        var testPacket = testPacketInfo.packet;
        expect(testPacket.MRSP).to.equal(expectedPacket.MRSP);
        expect(testPacket.SEQ).to.equal(expectedPacket.SEQ);
        expect(testPacket.DATA).to.equalBytes(expectedPacket.DATA);
    });

    it('decodes complex server response packet', () => {
        var inboundBuf = new Buffer([0xFF, 0xFF, 0x00, 0x04, 0x05, 0x01, 0x02, 0x03, 0x04, 0xec]);
        var expectedPacket = {
            MRSP: 0,
            SEQ: 4,
            DATA: new Buffer([0x01, 0x02, 0x03, 0x04])
        };

        var testPacketInfo = PacketParser.decodeServerResponsePacket(inboundBuf);
        expect(testPacketInfo.ok).to.equal(true);
        var testPacket = testPacketInfo.packet;
        expect(testPacket.MRSP).to.equal(expectedPacket.MRSP);
        expect(testPacket.SEQ).to.equal(expectedPacket.SEQ);
        expect(testPacket.DATA).to.equalBytes(expectedPacket.DATA);
    });

    it('correctly rejects incorrect checksum in server response packet', () => {
        var inboundBuf = new Buffer([0xFF, 0xFF, 0x00, 0x04, 0x05, 0x01, 0x02, 0x03, 0x04, 0xAA]);
        var expectedPacket = {
            MRSP: 0,
            SEQ: 4,
            DATA: new Buffer([0x01, 0x02, 0x03, 0x04])
        };

        var testPacketInfo = PacketParser.decodeServerResponsePacket(inboundBuf);
        expect(testPacketInfo.ok).to.equal(false);
        expect(testPacketInfo.errorType)
                .to.equal(PacketConstants.ErrorTypes.ChecksumMismatch);
    });

    it('correctly rejects incorrect length packet in server response packet', () => {
        var inboundBuf = new Buffer([0xFF, 0xFF, 0x00, 0x04, 0x02, 0x01, 0x02, 0x03, 0x04, 0xAA]);
        var expectedPacket = {
            MRSP: 0,
            SEQ: 4,
            DATA: new Buffer([0x01, 0x02, 0x03, 0x04])
        };

        var testPacketInfo = PacketParser.decodeServerResponsePacket(inboundBuf);
        expect(testPacketInfo.ok).to.equal(false);
        expect(testPacketInfo.errorType)
                .to.equal(PacketConstants.ErrorTypes.SizeMismatch);
    });

    it('decodes simple server async packet', () => {
        var inboundBuf = new Buffer([0xFF, 0xFE, 0x00, 0x00, 0x01, 0xFE]);
        var expectedPacket = {
            ID_CODE: 0,
            DATA: new Buffer(0)
        };

        var testPacketInfo = PacketParser.decodeServerAsyncPacket(inboundBuf);
        expect(testPacketInfo.ok).to.equal(true);
        var testPacket = testPacketInfo.packet;
        expect(testPacket.ID_CODE).to.equal(expectedPacket.ID_CODE);
        expect(testPacket.DATA).to.equalBytes(expectedPacket.DATA);
    });

    it('decodes complex server async packet', () => {
        var inboundBuf = new Buffer([0xFF, 0xFF, 0x06, 0x00, 0x05, 0x01, 0x02, 0x03, 0x04, 0xea]);
        var expectedPacket = {
            ID_CODE: 6,
            DATA: new Buffer([0x01, 0x02, 0x03, 0x04])
        };

        var testPacketInfo = PacketParser.decodeServerAsyncPacket(inboundBuf);
        expect(testPacketInfo.ok).to.equal(true);
        var testPacket = testPacketInfo.packet;
        expect(testPacket.ID_CODE).to.equal(expectedPacket.ID_CODE)
        expect(testPacket.DATA).to.equalBytes(expectedPacket.DATA);
    });

    it('correctly rejects incorrect checksum in server async packet', () => {
        var inboundBuf = new Buffer([0xFF, 0xFF, 0x06, 0x00, 0x05, 0x01, 0x02, 0x03, 0x04, 0xAA]);
        var expectedPacket = {
            ID_CODE: 6,
            DATA: new Buffer([0x01, 0x02, 0x03, 0x04])
        };

        var testPacketInfo = PacketParser.decodeServerAsyncPacket(inboundBuf);
        expect(testPacketInfo.ok).to.equal(false);
        expect(testPacketInfo.errorType)
                .to.equal(PacketConstants.ErrorTypes.ChecksumMismatch);
    });

    it('correctly rejects incorrect length packet in server async packet', () => {
        var inboundBuf = new Buffer([0xFF, 0xFF, 0x06, 0x02, 0x05, 0x01, 0x02, 0x03, 0x04, 0xAA]);
        var expectedPacket = {
            ID_CODE: 6,
            DATA: new Buffer([0x01, 0x02, 0x03, 0x04])
        };

        var testPacketInfo = PacketParser.decodeServerAsyncPacket(inboundBuf);
        expect(testPacketInfo.ok).to.equal(false);
        expect(testPacketInfo.errorType)
                .to.equal(PacketConstants.ErrorTypes.SizeMismatch);
    });
});