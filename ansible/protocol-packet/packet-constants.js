const PacketConstants = {
    ErrorTypes: {
        InvalidHeader: 'INVALID_HEADER',
        SizeMismatch: 'SIZE_MISMATCH',
        ChecksumMismatch: 'CHECKSUM_MISMATCH',
        InvalidPacketSize: 'INVALID_PACKET_SIZE'
    }
};

module.exports = PacketConstants;