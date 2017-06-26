

const ClientPacketTemplate = {
    SOP1:   0,
    SOP2:   1,
    DID:    2,
    CID:    3,
    SEQ:    4,
    DLEN:   5,
    DATA:   6,
    CHK:    6
};

const minClientPacketSize = 7;

const ServerPacketTemplate = {
    SOP1:   0,
    SOP2:   1,
    MSRP:   2,
    SEQ:    3,
    DLEN:   4,
    DATA:   5,
    CHK:    5
};

const minServerPacketSize = 6;

function buildClientPacket(packet) {
    packet.DID = packet.DID || 0x00;
    packet.CID = packet.CID || 0x00;
    packet.SEQ = packet.SEQ || 0x00;
    packet.DATA = packet.DATA || new Buffer(0);
    packet.resetTimeout = packet.resetTimeout || false;
    packet.requestAck = packet.requestAck || false;

    var SOP2 = 0xFC | (packet.resetTimeout && 0x02) | (packet.requestAck && 0x01);

    var buffer = new Buffer(packet.DATA.length + minClientPacketSize);
    buffer.writeUInt8(0xFF, ClientPacketTemplate.SOP1);
    buffer.writeUInt8(SOP2, ClientPacketTemplate.SOP2);
    buffer.writeUInt8(packet.DID, ClientPacketTemplate.DID);
    buffer.writeUInt8(packet.CID, ClientPacketTemplate.CID);
    buffer.writeUInt8(packet.SEQ, ClientPacketTemplate.SEQ);
    buffer.writeUInt8(packet.DATA.length + 1, ClientPacketTemplate.DLEN);
    packet.DATA.copy(buffer, ClientPacketTemplate.DATA);
    var checksum = PacketUtils.calculateChecksum(buffer.slice(ClientPacketTemplate.DID, minClientPacketSize + packet.DATA.length - 1));
    buffer.writeUInt8(checksum, ClientPacketTemplate.CHK + packet.DATA.length);

    return buffer;
}

function buildServerPacket(packet) {
    packet.MSRP = packet.MSRP || 0x00;
    packet.SEQ = packet.SEQ || 0x00;
    packet.isAck = packet.isAck || false;
    packet.DATA = packet.DATA || new Buffer(0);

    var SOP2 = packet.isAck ? 0xFF : 0xFE;

    var buffer = new Buffer(packet.DATA.length + minClientPacketSize);
    buffer.writeUInt8(0xFF, ServerPacketTemplate.SOP1);
    buffer.writeUInt8(SOP2, ServerPacketTemplate.SOP2);
    buffer.writeUInt8(packet.MSRP, ServerPacketTemplate.MSRP);
    buffer.writeUInt8(packet.SEQ, ServerPacketTemplate.SEQ);
    buffer.writeUInt8(packet.DATA.length + 1, ServerPacketTemplate.DLEN);
    packet.DATA.copy(buffer, ServerPacketTemplate.DATA);
    var checksum = PacketUtils.calculateChecksum(buffer.slice(ServerPacketTemplate.MSRP, minClientPacketSize + packet.DATA.length - 1));
    buffer.writeUInt8(checksum, ServerPacketTemplate.CHK + packet.DATA.length);

    return buffer;
}

module.exports = {
    buildClientPacket: buildClientPacket,
    buildServerPacket: buildServerPacket
};