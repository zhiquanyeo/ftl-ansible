const PacketTemplates = {
    Client: {
        minPacketSize: 7,
        headerSize: 6,
        template: {
            SOP1:   0,
            SOP2:   1,
            DID:    2,
            CID:    3,
            SEQ:    4,
            DLEN:   5,
            DATA:   6,
            CHK:    6
        },
        dLenBytes:  1,
        packetStartByte: 2
    },
    ServerResponse: {
        minPacketSize: 6,
        headerSize: 5,
        template: {
            SOP1:   0,
            SOP2:   1,
            MSRP:   2,
            SEQ:    3,
            DLEN:   4,
            DATA:   5,
            CHK:    5
        },
        dLenBytes:  1,
        packetStartByte: 2
    },
    ServerAsync: {
        minPacketSize: 6,
        headerSize: 5,
        template: {
            SOP1:       0,
            SOP2:       1,
            ID_CODE:    2,
            DLEN:       3, // 2 bytes
            DATA:       5,
            CHK:        5
        },
        dLenBytes:  2,
        packetStartByte: 2
    }
};

module.exports = PacketTemplates;