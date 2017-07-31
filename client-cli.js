const repl = require('repl');
const AnsibleClient = require('./ansible/ansible-client');
const commandLineArgs = require('command-line-args');

const optionDefs = [
	{ name: 'port', alias: 'p', type: Number, defaultOption: true }
];

const DEFAULT_PORT = 41236;

// Initial Setup
const opts = commandLineArgs(optionDefs, { partial: true });

const usePort = opts.port !== undefined ? opts.port : DEFAULT_PORT;

console.log('Initializing connection via port ', usePort);
var client = new AnsibleClient({ port: usePort });

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
