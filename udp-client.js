const dgram = require('dgram');

const GWY_ADDR = '127.0.0.1';
const GWY_PORT = 41234;

var msgCount = 1;

var client = dgram.createSocket('udp4');
setInterval(() => {

    var message = `This is message ${msgCount}`;
    msgCount++;

    var msgBuf = new Buffer(message);
    
    client.send(message, 0, message.length, GWY_PORT, GWY_ADDR, (err, bytes) => {
        if (err) {
            console.error(err);
        }
        else {
            console.log('UDP Message sent ');
        }
    })
}, 2000);

const AnsibleClient = require('./ansible/ansible-client');
var aClient = new AnsibleClient();
aClient.sendConn();