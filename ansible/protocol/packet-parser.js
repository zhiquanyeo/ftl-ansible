const PacketTemplates = require('./packet-templates');
const PacketUtils = require('./packet-utils');

function decodeClientPacket(buffer) {
    const template = PacketTemplates.Client.template;
    const minPacketSize = PacketTemplates.Client.minPacketSize;
    const headerSize = PacketTemplates.Client.headerSize;

    var ret = {
        ok: false,
        packet: {
            DID: 0,
            CID: 0,
            SEQ: 0,
            DATA: null,
            resetTimeout: false,
            requestAck: false
        },
        error: null
    };

    // Check header
    if (buffer.readUInt8(template.SOP1) !== 0xFF) {
        ret.error = 'Invalid header';
        return ret;
    }

    // Check length
    var dLen = buffer.readUInt8(template.DLEN);
    if (buffer.length != headerSize + dLen) {
        ret.error = 'Buffer size mismatch. Expected ' + 
                    (headerSize + dLen) + ', got ' + 
                    buffer.length + ' instead';
        return ret;
    }

    // Check checksum
    var checksum = PacketUtils.calculateChecksum(buffer.slice(template.DID, headerSize + dLen - 1));
    if (buffer.readUInt8(buffer.length - 1) !== checksum) {
        ret.error = 'Checksum mismatch. Expected ' + 
                    checksum + ', got ' + 
                    buffer.readUInt8(buffer.length - 1) + 
                    ' instead';
        return ret;
    }

    // Seems ok
    ret.ok = true;
    var SOP2 = buffer.readUInt8(template.SOP2);
    var resetTimeout = !!(SOP2 & 0x02);
    var requestAck = !!(SOP2 & 0x01);

    ret.packet.DID = buffer.readUInt8(template.DID);
    ret.packet.CID = buffer.readUInt8(template.CID);
    ret.packet.SEQ = buffer.readUInt8(template.SEQ);
    ret.packet.requestAck = requestAck;
    ret.packet.resetTimeout = resetTimeout;
    ret.packet.DATA = buffer.slice(template.DATA, template.DATA + dLen);

    return ret;
}

module.exports = {
    decodeClientPacket: decodeClientPacket
};