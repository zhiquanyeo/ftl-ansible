const PacketTemplates = require('./packet-templates');
const PacketUtils = require('./packet-utils');
const PacketConstants = require('./packet-constants');

function initialChecks(buffer, returnObj, templateType) {
    var template = templateType.template;
    var minPacketSize = templateType.minPacketSize;
    var headerSize = templateType.headerSize;

    // Check min size
    if (buffer.length < minPacketSize) {
        returnObj.errorType = PacketConstants.ErrorTypes.InvalidPacketSize;
        returnObj.errorMsg = 'Invalid Packet Size';
        return false;
    }

    // Check Header
    if (buffer.readUInt8(template.SOP1) !== 0xFF) {
        returnObj.errorType = PacketConstants.ErrorTypes.InvalidHeader;
        returnObj.errorMsg = 'Invalid header';
        return false;
    }

    // Check packet length
    var dLen;
    if (templateType.dLenBytes === 1) {
        dLen = buffer.readUInt8(template.DLEN);
    }
    else {
        dLen = buffer.readUInt16BE(template.DLEN);
    }
    
    if (buffer.length != headerSize + dLen) {
        returnObj.errorType = PacketConstants.ErrorTypes.SizeMismatch;
        returnObj.errorMsg = 'Buffer size mismatch. Expected ' +
                    (headerSize + dLen) + ', got ' + 
                    buffer.length + ' instead';
        return false;
    }

    // Check checksum
    var checksum = PacketUtils.calculateChecksum(
                    buffer.slice(templateType.packetStartByte, 
                                 headerSize + dLen - 1));
    
    if (buffer.readUInt8(buffer.length - 1) !== checksum) {
        returnObj.errorType = PacketConstants.ErrorTypes.ChecksumMismatch;
        returnObj.error = 'Checksum mismatch. Expected ' + checksum + 
                    ', got ' + buffer.readUInt8(buffer.length - 1) + 
                    ' instead';
        return false;
    }

    return true;
}

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
        errorType: null,
        errorMsg: null
    };

    if (!initialChecks(buffer, ret, PacketTemplates.Client)) {
        return ret;
    }

    var dLen = buffer.readUInt8(template.DLEN);

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
    ret.packet.DATA = buffer.slice(template.DATA, template.DATA + dLen - 1);

    return ret;
}

function decodeServerResponsePacket(buffer) {
    const template = PacketTemplates.ServerResponse.template;
    const minPacketSize = PacketTemplates.ServerResponse.minPacketSize;
    const headerSize = PacketTemplates.ServerResponse.headerSize;

    var ret = {
        ok: false,
        packet: {
            MRSP: 0,
            SEQ: 0,
            DATA: null,
        },
        errorType: null,
        errorMsg: null
    };

    if (!initialChecks(buffer, ret, PacketTemplates.ServerResponse)) {
        return ret;
    }

    var dLen = buffer.readUInt8(template.DLEN);

    ret.ok = true;
    ret.packet.MRSP = buffer.readUInt8(template.MRSP);
    ret.packet.SEQ = buffer.readUInt8(template.SEQ);
    ret.packet.DATA = buffer.slice(template.DATA, template.DATA + dLen - 1);

    return ret;
};

function decodeServerAsyncPacket(buffer) {
    const template = PacketTemplates.ServerAsync.template;
    const minPacketSize = PacketTemplates.ServerAsync.minPacketSize;
    const headerSize = PacketTemplates.ServerAsync.headerSize;

    var ret = {
        ok: false,
        packet: {
            ID_CODE: 0,
            DATA: null,
        },
        errorType: null,
        errorMsg: null
    };

    if (!initialChecks(buffer, ret, PacketTemplates.ServerAsync)) {
        return ret;
    }

    var dLen = buffer.readUInt16BE(template.DLEN);

    ret.ok = true;
    ret.packet.ID_CODE = buffer.readUInt8(template.ID_CODE);
    ret.packet.DATA = buffer.slice(template.DATA, template.DATA + dLen - 1);

    return ret;
}

module.exports = {
    decodeClientPacket: decodeClientPacket,
    decodeServerResponsePacket: decodeServerResponsePacket,
    decodeServerAsyncPacket: decodeServerAsyncPacket
};