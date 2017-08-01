// These are all commands originating from the client side
// Documented with parameters and byte length/offset in the data field
const ProtocolVersions = {
    API_MAJOR: 0x01,
    API_MINOR: 0x00,
};

const ProtocolCommands = {
    SYS: {
        CONN: {
            DID: 0x00,
            CID: 0x01,
            clientFnName: 'sendConn'
        },
        CONTROL_REQ: {
            DID: 0x00,
            CID: 0x02,
            clientFnName: 'sendControlReq',
            returnType: 'uint8'
        },
        HBEAT: {
            DID: 0x00,
            CID: 0x03,
            clientFnName: 'sendHbeat',
            returnType: 'uint8'
        },
        VERS: {
            DID: 0x00,
            CID: 0x04,
            dataRequired: true,
            clientFnName: 'getVers',
            returnType: 'uint16'
        },
        CLOSE: {
            DID: 0x00,
            CID: 0x05,
            clientFnName: 'sendClose'
        }
    },
    ROBOT: {
        GET_DIGITAL: {
            DID: 0x01,
            CID: 0x01,
            dataRequired: true,
            params: [
                {
                    name: 'port',
                    offset: 0,
                    length: 1,
                    type: 'uint8'
                }
            ],
            clientFnName: 'getDigital',
            returnType: 'uint8',
            providesCallback: true
        },
        GET_ANALOG: {
            DID: 0x01,
            CID: 0x02,
            dataRequired: true,
            params: [
                {
                    name: 'port',
                    offset: 0,
                    length: 1,
                    type: 'uint8'
                }
            ],
            clientFnName: 'getAnalog',
            returnType: 'uint16',
            providesCallback: true
        },
        SET_DIGITAL: {
            DID: 0x01,
            CID: 0x03,
            params: [
                {
                    name: 'port',
                    offset: 0,
                    length: 1,
                    type: 'uint8'
                },
                {
                    name: 'value',
                    offset: 1,
                    length: 1,
                    type: 'uint8'
                }
            ],
            clientFnName: 'setDigital'
        },
        SET_ANALOG: {
            DID: 0x01,
            CID: 0x04,
            params: [
                {
                    name: 'port',
                    offset: 0,
                    length: 1,
                    type: 'uint8'
                },
                {
                    name: 'value',
                    offset: 1,
                    length: 2,
                    type: 'uint16'
                }
            ],
            clientFnName: 'setAnalog'
        },
        SET_PWM: {
            DID: 0x01,
            CID: 0x05,
            params: [
                {
                    name: 'port',
                    offset: 0,
                    length: 1,
                    type: 'uint8'
                },
                {
                    name: 'value',
                    offset: 1,
                    length: 2,
                    type: 'int16'
                }
            ],
            clientFnName: 'setPwm'
        },
        SET_MOTOR: {
            DID: 0x01,
            CID: 0x06,
            params: [
                {
                    name: 'port',
                    offset: 0,
                    length: 1,
                    type: 'uint8'
                },
                {
                    name: 'value',
                    offset: 1,
                    length: 2,
                    type: 'int16'
                }
            ],
            clientFnName: 'setMotor'
        },
    }
};

const AsyncEvents = {
    ASYNC: {
        POWER_NOTIFICATION: {
            ID_CODE: 0x01,
            payload: [
                {
                    name: 'battV',
                    type: 'uint8',
                    offset: 0,
                    length: 1
                },
                {
                    name: 'battVdec',
                    type: 'uint8',
                    offset: 0,
                    length: 1
                }
            ]
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
var clientFnNameToDetails = {}; // e.g. sendConn -> {DID, CID, type}
for (var deviceId in ProtocolCommands) {
    var deviceCommands = ProtocolCommands[deviceId];
    for (var command in deviceCommands) {
        var commandDetails = deviceCommands[command];
        
        var commandDesc = deviceId + ':' + command;
        var commandKey = commandDetails.DID + ':' + commandDetails.CID;
        
        commandDetails.commandName = commandDesc;

        commandMap[commandKey] = commandDesc;
        commandToDetails[commandDesc] = commandDetails;
        if (commandDetails.clientFnName) {
            clientFnNameToDetails[commandDetails.clientFnName] = commandDetails;
        }
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

function getCommandDetailsFromFn(fnName) {
    return clientFnNameToDetails[fnName];
}

function listClientFnNames() {
    return Object.keys(clientFnNameToDetails);
}

module.exports = {
    Commands: ProtocolCommands,
    Responses: ProtocolResponses,
    Constants: ProtocolConstants,
    VersionInfo: ProtocolVersions,

    getCommandType: getCommandType,
    getCommandDetails: getCommandDetails,
    getSysCommandBytes: getSysCommandBytes,
    getCommandDetailsFromFn: getCommandDetailsFromFn,
    listClientFnNames: listClientFnNames
};