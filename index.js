/**
 * Map to the various components in the ftl-ansible library
 */

const AnsibleServer = require('./ansible/ansible-server');
const AnsibleClient = require('./ansible/ansible-client');

module.exports = {
    Server: AnsibleServer,
    Client: AnsibleClient
};