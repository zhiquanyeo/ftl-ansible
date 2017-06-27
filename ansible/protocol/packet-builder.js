const PacketTemplates = require('./packet-templates');
const PacketUtils = require('./packet-utils');

function buildClientPacket(packet) {
    const template = PacketTemplates.Client.template;
    const minPacketSize = PacketTemplates.Client.minPacketSize;

    packet.DID = packet.DID || 0x00;
    packet.CID = packet.CID || 0x00;
    packet.SEQ = packet.SEQ || 0x00;
    packet.DATA = packet.DATA || new Buffer(0);
    packet.resetTimeout = packet.resetTimeout || false;
    packet.requestAck = packet.requestAck || false;

    var SOP2 = 0xFC | (packet.resetTimeout && 0x02) | (packet.requestAck && 0x01);

    var buffer = new Buffer(packet.DATA.length + minPacketSize);
    buffer.writeUInt8(0xFF, template.SOP1);
    buffer.writeUInt8(SOP2, template.SOP2);
    buffer.writeUInt8(packet.DID, template.DID);
    buffer.writeUInt8(packet.CID, template.CID);
    buffer.writeUInt8(packet.SEQ, template.SEQ);
    buffer.writeUInt8(packet.DATA.length + 1, template.DLEN);
    packet.DATA.copy(buffer, template.DATA);
    var checksum = PacketUtils.calculateChecksum(buffer.slice(template.DID, minPacketSize + packet.DATA.length - 1));
    buffer.writeUInt8(checksum, template.CHK + packet.DATA.length);

    return buffer;
}

function buildServerResponsePacket(packet) {
    const template = PacketTemplates.ServerResponse.template;
    const minPacketSize = PacketTemplates.ServerResponse.minPacketSize;

    packet.MSRP = packet.MSRP || 0x00;
    packet.SEQ = packet.SEQ || 0x00;
    packet.DATA = packet.DATA || new Buffer(0);

    var SOP2 = 0xFF;

    var buffer = new Buffer(packet.DATA.length + minPacketSize);
    buffer.writeUInt8(0xFF, template.SOP1);
    buffer.writeUInt8(SOP2, template.SOP2);
    buffer.writeUInt8(packet.MSRP, template.MSRP);
    buffer.writeUInt8(packet.SEQ, template.SEQ);
    buffer.writeUInt8(packet.DATA.length + 1, template.DLEN);
    packet.DATA.copy(buffer, template.DATA);
    var checksum = PacketUtils.calculateChecksum(buffer.slice(template.MSRP, minPacketSize + packet.DATA.length - 1));
    buffer.writeUInt8(checksum, template.CHK + packet.DATA.length);

    return buffer;
}

function buildServerAsyncPacket(packet) {
    const template = PacketTemplates.ServerAsync.template;
    const minPacketSize = PacketTemplates.ServerAsync.minPacketSize;

    packet.ID_CODE = packet.ID_CODE || 0x00;
    packet.DATA = packet.DATA || new Buffer(0);

    var SOP2 = 0xFE;

    var buffer = new Buffer(packet.DATA.length + minPacketSize);
    buffer.writeUInt8(0xFF, template.SOP1);
    buffer.writeUInt8(SOP2, template.SOP2);
    buffer.writeUInt8(packet.ID_CODE, template.ID_CODE);
    buffer.writeUInt16BE(packet.DATA.length + 1, template.DLEN);
    packet.DATA.copy(buffer, template.DATA);
    var checksum = PacketUtils.calculateChecksum(buffer.slice(template.ID_CODE, minPacketSize + packet.DATA.length - 1));
    buffer.writeUInt8(checksum, template.CHK + packet.DATA.length);

    return buffer;
}

module.exports = {
    buildClientPacket: buildClientPacket,
    buildServerResponsePacket: buildServerResponsePacket,
    buildServerAsyncPacket: buildServerAsyncPacket
};