const repl = require('repl');
const AnsibleClientUDP = require('./ansible/ansible-client');
const AnsibleClientTCP = require('./ansible/ansible-client-tcp');
const commandLineArgs = require('command-line-args');

const optionDefs = [
    { name: 'port', alias: 'p', type: Number, defaultOption: true },
    { name: 'type', alias: 't', type: String }
];

const DEFAULT_PORT = 41236;
const DEFAULT_TYPE = 'UDP';

// Initial Setup
const opts = commandLineArgs(optionDefs, { partial: true });

const usePort = opts.port !== undefined ? opts.port : DEFAULT_PORT;
const clientType = opts.type || DEFAULT_TYPE;

if (clientType !== 'UDP' && clientType !== 'TCP') {
    clientType = DEFAULT_TYPE;
}

var client;
if (clientType === 'UDP') {
    console.log('Creating UDP Client');
    client = new AnsibleClientUDP({ port: usePort });
}
else {
    console.log('Creating TCP Client');
    client = new AnsibleClientTCP({ port: usePort });
}

var startTime, endTime;
client.connect()
.then((status) => {
    startTime = Date.now();

    console.log('Connection established: ', status);
    client.on('disconnected', (reason) => {
        console.log('Disconnected: ', reason.reason);
        endTime = Date.now();
        console.log('Time Alive: ', (endTime - startTime), 'ms');
        process.exit(reason.code);
    });

    client.on('stateChanged', (stateInfo) => {
        console.log('State changed from ', stateInfo.oldState, ' to ', stateInfo.newState);
    });

    client.on('asyncEvent', (evt) => {
        console.log('Async Event Received: ', evt);
    })

    _configureRepl();
})
.catch((err) => {
    console.error('Error: ', err);
    console.log('=== Exiting ===');
    process.exit(1);
});

function _configureRepl() {
    const r = repl.start('> ');
    r.context.client = client;
}
