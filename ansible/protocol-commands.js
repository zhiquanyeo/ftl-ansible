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
            CID: 0x04,
            dataRequired: true,
        }
    },
    ROBOT: {
        SETMOTOR: {
            DID: 0x01,
            CID: 0x01
        }
    }
};

const ProtocolResponses = {
    ConnectionActiveState: {
        ACTIVE: 0,
        QUEUED: 1
    }
};

const ProtocolConstants = {
    OK: 0,
    INVALID_STATE: 1,
    REQUEST_TIMED_OUT: 2,
    INVALID_COMMAND: 3,
};

// Generate a map
var commandMap = {};
var commandToDetails = {}; // e.g. SYS:CONN -> {DID, CID, type}
for (var deviceId in ProtocolCommands) {
    var deviceCommands = ProtocolCommands[deviceId];
    for (var command in deviceCommands) {
        var commandDetails = deviceCommands[command];

        var commandDesc = deviceId + ':' + command;
        var commandKey = commandDetails.DID + ':' + commandDetails.CID;
        commandMap[commandKey] = commandDesc;
        commandToDetails[commandDesc] = commandDetails;
    }
}

function getSysCommandBytes(cmd) {
    return ProtocolCommands.SYS[cmd];
}

function getCommandType(DID, CID) {
    var commandKey = DID + ':' + CID;
    return commandMap[commandKey];
}

function getCommandDetails(command) {
    return commandToDetails[command];
}

module.exports = {
    Commands: ProtocolCommands,
    Responses: ProtocolResponses,
    Constants: ProtocolConstants,
    getCommandType: getCommandType,
    getCommandDetails: getCommandDetails,
    getSysCommandBytes: getSysCommandBytes
};