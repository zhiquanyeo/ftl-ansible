const chai = require('chai');
const expect = chai
                .use(require('chai-bytes'))
                .expect;
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);

const Promise = require('promise');
const Connection = require('./connection');

describe('Connection', () => {
    it('times out correctly', (done) => {
        var p = new Promise((resolve, reject) => {
            var conn = new Connection({}, true, 1000);

            // set a timeout for > 1000 that will reject
            var timeout = setTimeout(() => {
                reject();
            }, 2000);

            conn.on('timedOut', () => {
                clearTimeout(timeout);
                resolve();
            })
        });

        expect(p).to.be.fulfilled.notify(done);
    });

    it('will not timeout if not requested to', (done) => {
        var p = new Promise((resolve, reject) => {
            var conn = new Connection({}, true, -1);

            var timeout = setTimeout(() => {
                resolve();
            }, 1000);

            conn.on('timedOut', () => {
                reject();
            });
        });

        expect(p).to.be.fulfilled.notify(done);
    });

    it('changes from preconnected to connected state correctly', (done) => {
        var p = new Promise((resolve, reject) => {
            var conn = new Connection({}, true, 1000);

            var doNotReject = false;
            conn.on('stateChanged', (stateInfo) => {
                if (stateInfo.from === 'pre-connect' &&
                    stateInfo.to === 'connected') {
                        doNotReject = true;
                        resolve();
                }
            });

            conn.on('timedOut', () => {
                if (!doNotReject) {
                    reject();
                }
            });

            conn.processMessage({DID: 0, CID: 1});
        });

        expect(p).to.be.fulfilled.notify(done);
    });

    it('rejects invalid commands when pre-connected', (done) => {
        var p = new Promise((resolve, reject) => {
            var conn = new Connection({}, true, 1000);

            conn.on('stateChanged', (stateInfo) => {
                if (stateInfo.from === 'pre-connect' &&
                    stateInfo.to === 'connected') {
                        reject();
                }
            });

            conn.on('timedOut', () => {
               resolve();
            });

            conn.processMessage({DID: 0, CID: 2});
        });

        expect(p).to.be.fulfilled.notify(done);
    });

    it ('switches to the active state correctly', (done) => {
        var p = new Promise((resolve, reject) => {
            var conn = new Connection({}, true, 1000);

            var doNotReject = false;
            conn.on('stateChanged', (stateInfo) => {
                if (stateInfo.from === 'pre-connect' && 
                    stateInfo.to === 'connected') {
                    // Send the CONTROL_REQ message
                    conn.processMessage({DID: 0, CID: 2});
                }
                else if (stateInfo.from === 'connected' &&
                    stateInfo.to === 'active') {
                        doNotReject = true;
                        resolve();
                }
            });

            conn.on('timedOut', () => {
               if (!doNotReject) {
                   reject();
               }
            });

            conn.processMessage({DID: 0, CID: 1});
        });

        expect(p).to.be.fulfilled.notify(done);
    });

    it ('switches to the queued state correctly', (done) => {
        var p = new Promise((resolve, reject) => {
            var conn = new Connection({}, false, 1000);

            var doNotReject = false;
            conn.on('stateChanged', (stateInfo) => {
                if (stateInfo.from === 'pre-connect' && 
                    stateInfo.to === 'connected') {
                    // Send the CONTROL_REQ message
                    conn.processMessage({DID: 0, CID: 2});
                }
                else if (stateInfo.from === 'connected' &&
                    stateInfo.to === 'queued') {
                        doNotReject = true;
                        resolve();
                }
            });

            conn.on('timedOut', () => {
               if (!doNotReject) {
                   reject();
               }
            });

            conn.processMessage({DID: 0, CID: 1});
        });

        expect(p).to.be.fulfilled.notify(done);
    });
});