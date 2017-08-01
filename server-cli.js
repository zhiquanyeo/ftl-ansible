const repl = require('repl');
const AnsibleServerUDP = require('./ansible/ansible-server');
const AnsibleServerTCP = require('./ansible/ansible-server-tcp');
const commandLineArgs = require('command-line-args');

const optionDefs = [
    { name: 'port', alias: 'p', type: Number, defaultOption: true},
    { name: 'type', alias: 't', type: String }
];

const DEFAULT_PORT = 41236;
const DEFAULT_TYPE = 'UDP';

const opts = commandLineArgs(optionDefs, { partial: true });

const usePort = opts.port !== undefined ? opts.port : DEFAULT_PORT;
const serverType = opts.type || DEFAULT_TYPE;

if (serverType !== 'UDP' && serverType !== 'TCP') {
    serverType = DEFAULT_TYPE;
}

var server;
if (serverType === 'UDP') {
    console.log('Creating UDP Server');
    server = new AnsibleServerUDP({ port: usePort });
}
else {
    console.log('Creating TCP Server');
    server = new AnsibleServerTCP({ port: usePort });
}

server.on('dataRequired', (evt) => {
    console.log('Data Required Event received: ', evt);
});

server.on('commandReceived', (evt) => {
    console.log('Command Received Event received: ', evt);
});

const r = repl.start('> ');
r.context.server = server;