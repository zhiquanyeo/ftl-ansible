const chai = require('chai');
const expect = chai
                .use(require('chai-bytes'))
                .expect;
const PacketBuilder = require('./packet-builder');
const PacketParser = require('./packet-parser');
const PacketConstants = require('./packet-constants');

describe('Packet Build and Parse Tests', () => {
    it('correctly builds and parses a simple client packet', () => {
        var expectedPacket = {
            DID: 0,
            CID: 1,
            SEQ: 1,
            resetTimeout: true,
            requestAck: false,
            DATA: new Buffer(0)
        };

        var testPacketInfo = PacketParser.decodeClientPacket(
                PacketBuilder.buildClientPacket(expectedPacket));
        expect(testPacketInfo.ok).to.equal(true);
        var testPacket = testPacketInfo.packet;
        expect(testPacket.DID).to.equal(expectedPacket.DID);
        expect(testPacket.CID).to.equal(expectedPacket.CID);
        expect(testPacket.SEQ).to.equal(expectedPacket.SEQ);
        expect(testPacket.resetTimeout).to.equal(expectedPacket.resetTimeout);
        expect(testPacket.requestAck).to.equal(expectedPacket.requestAck);
        expect(testPacket.DATA).to.equalBytes(expectedPacket.DATA);
    });

    it('correctly builds and parses a complex client packet', () => {
        var expectedPacket = {
            DID: 0,
            CID: 1,
            SEQ: 1,
            resetTimeout: true,
            requestAck: false,
            DATA: new Buffer([0x01, 0x02, 0x03, 0x04])
        };

        var testPacketInfo = PacketParser.decodeClientPacket(
                PacketBuilder.buildClientPacket(expectedPacket));
        expect(testPacketInfo.ok).to.equal(true);
        var testPacket = testPacketInfo.packet;
        expect(testPacket.DID).to.equal(expectedPacket.DID);
        expect(testPacket.CID).to.equal(expectedPacket.CID);
        expect(testPacket.SEQ).to.equal(expectedPacket.SEQ);
        expect(testPacket.resetTimeout).to.equal(expectedPacket.resetTimeout);
        expect(testPacket.requestAck).to.equal(expectedPacket.requestAck);
        expect(testPacket.DATA).to.equalBytes(expectedPacket.DATA);
    });

    it('correctly builds and parses a simple server response packet', () => {
        var expectedPacket = {
            MRSP: 0,
            SEQ: 1,
            DATA: new Buffer(0)
        };

        var testPacketInfo = PacketParser.decodeServerResponsePacket(
                PacketBuilder.buildServerResponsePacket(expectedPacket));
        expect(testPacketInfo.ok).to.equal(true);
        var testPacket = testPacketInfo.packet;
        expect(testPacket.MRSP).to.equal(expectedPacket.MRSP);
        expect(testPacket.SEQ).to.equal(expectedPacket.SEQ);
        expect(testPacket.DATA).to.equalBytes(expectedPacket.DATA);
    });

    it('correctly builds and parses a complex server response packet', () => {
        var expectedPacket = {
            MRSP: 0,
            SEQ: 4,
            DATA: new Buffer([0x01, 0x02, 0x03, 0x04])
        };

        var testPacketInfo = PacketParser.decodeServerResponsePacket(
                PacketBuilder.buildServerResponsePacket(expectedPacket));
        expect(testPacketInfo.ok).to.equal(true);
        var testPacket = testPacketInfo.packet;
        expect(testPacket.MRSP).to.equal(expectedPacket.MRSP);
        expect(testPacket.SEQ).to.equal(expectedPacket.SEQ);
        expect(testPacket.DATA).to.equalBytes(expectedPacket.DATA);
    });

    it('correctly builds and parses a simple server async packet', () => {
        var expectedPacket = {
            ID_CODE: 7,
            DATA: new Buffer(0)
        };

        var testPacketInfo = PacketParser.decodeServerAsyncPacket(
                PacketBuilder.buildServerAsyncPacket(expectedPacket));
        expect(testPacketInfo.ok).to.equal(true);
        var testPacket = testPacketInfo.packet;
        expect(testPacket.ID_CODE).to.equal(expectedPacket.ID_CODE);
        expect(testPacket.DATA).to.equalBytes(expectedPacket.DATA);
    });

    it('correctly builds and parses a complex server async packet', () => {
        var expectedPacket = {
            ID_CODE: 7,
            DATA: new Buffer([0x01, 0x02, 0x03, 0x04])
        };

        var testPacketInfo = PacketParser.decodeServerAsyncPacket(
                PacketBuilder.buildServerAsyncPacket(expectedPacket));
        expect(testPacketInfo.ok).to.equal(true);
        var testPacket = testPacketInfo.packet;
        expect(testPacket.ID_CODE).to.equal(expectedPacket.ID_CODE);
        expect(testPacket.DATA).to.equalBytes(expectedPacket.DATA);
    });
})