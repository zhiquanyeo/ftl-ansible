// These are all commands originating from the client side
const ProtocolCommands = {
    SYS: {
        CONN: {
            DID: 0x00,
            CID: 0x01
        },
        CONTROL_REQ: {
            DID: 0x00,
            CID: 0x02
        },
        HBEAT: {
            DID: 0x00,
            CID: 0x03
        },
        VERS: {
            DID: 0x00,
            CID: 0x04
        }
    }
};

// Generate a map
var commandMap = {};
for (var deviceId in ProtocolCommands) {
    var deviceCommands = ProtocolCommands[deviceId];
    for (var command in deviceCommands) {
        var commandBytes = deviceCommands[command];

        var commandDesc = deviceId + ':' + command;
        var commandKey = commandBytes.DID + ':' + commandBytes.CID;
        commandMap[commandKey] = commandDesc;
    }
}

function getSysCommandBytes(cmd) {
    return ProtocolCommands.SYS[cmd];
}

function getCommandType(DID, CID) {
    var commandKey = DID + ':' + CID;
    return commandMap[commandKey];
}

module.exports = {
    commands: ProtocolCommands,
    getCommandType: getCommandType,
    getSysCommandBytes: getSysCommandBytes
};