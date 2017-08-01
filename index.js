/**
 * Map to the various components in the ftl-ansible library
 */

const AnsibleServerUDP = require('./ansible/ansible-server');
const AnsibleClientUDP = require('./ansible/ansible-client');
const AnsibleServerTCP = require('./ansible/ansible-server-tcp');
const AnsibleClientTCP = require('./ansible/ansible-client-tcp');

module.exports = {
    UDPServer: AnsibleServerUDP,
    UDPClient: AnsibleClientUDP,
    TCPServer: AnsibleServerTCP,
    TCPClient: AnsibleClientTCP
};