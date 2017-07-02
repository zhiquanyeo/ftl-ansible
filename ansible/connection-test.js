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
                if (stateInfo.from === 'PRE_CONNECT' &&
                    stateInfo.to === 'CONNECTED') {
                        doNotReject = true;
                        resolve();
                }
            });

            conn.on('timedOut', () => {
                if (!doNotReject) {
                    reject();
                }
            });

            conn.processMessage({DID: 0, CID: 1, SEQ: 1});
        });

        expect(p).to.be.fulfilled.notify(done);
    });

    it('rejects invalid commands when pre-connected', (done) => {
        var p = new Promise((resolve, reject) => {
            var conn = new Connection({}, true, 1000);

            conn.on('stateChanged', (stateInfo) => {
                if (stateInfo.from === 'PRE_CONNECT' &&
                    stateInfo.to === 'CONNECTED') {
                        reject();
                }
            });

            conn.on('timedOut', () => {
               resolve();
            });

            conn.processMessage({DID: 0, CID: 2, SEQ: 1});
        });

        expect(p).to.be.fulfilled.notify(done);
    });

    it ('switches to the active state correctly', (done) => {
        var p = new Promise((resolve, reject) => {
            var conn = new Connection({}, true, 1000);

            var doNotReject = false;
            conn.on('stateChanged', (stateInfo) => {
                if (stateInfo.from === 'PRE_CONNECT' && 
                    stateInfo.to === 'CONNECTED') {
                    // Send the CONTROL_REQ message
                    conn.processMessage({DID: 0, CID: 2, SEQ: 1});
                }
                else if (stateInfo.from === 'CONNECTED' &&
                    stateInfo.to === 'ACTIVE') {
                        doNotReject = true;
                        resolve();
                }
            });

            conn.on('timedOut', () => {
               if (!doNotReject) {
                   reject('timed out');
               }
            });

            conn.processMessage({DID: 0, CID: 1, SEQ: 1});
        });

        expect(p).to.be.fulfilled.notify(done);
    });

    it ('switches to the queued state correctly', (done) => {
        var p = new Promise((resolve, reject) => {
            var conn = new Connection({}, false, 1000);

            var doNotReject = false;
            conn.on('stateChanged', (stateInfo) => {
                if (stateInfo.from === 'PRE_CONNECT' && 
                    stateInfo.to === 'CONNECTED') {
                    // Send the CONTROL_REQ message
                    conn.processMessage({DID: 0, CID: 2});
                }
                else if (stateInfo.from === 'CONNECTED' &&
                    stateInfo.to === 'QUEUED') {
                        doNotReject = true;
                        resolve();
                }
            });

            conn.on('timedOut', () => {
               if (!doNotReject) {
                   reject('timed out');
               }
            });

            conn.processMessage({DID: 0, CID: 1, SEQ: 1});
        });

        expect(p).to.be.fulfilled.notify(done);
    });

    it('sends connection ack', (done) => {
        var p = new Promise((resolve, reject) => {
            var conn = new Connection({}, false, 1000);

            var doNotReject = false;
            conn.on('sendResponse', (resp) => {
                doNotReject = true;
                resolve();
            })

            conn.on('timedOut', () => {
               if (!doNotReject) {
                   reject('timed out');
               }
            });

            conn.processMessage({DID: 0, CID: 1, SEQ: 1});
        });

        expect(p).to.be.fulfilled.notify(done);
    });

    it('emits the correct dataRequired event when needed', (done) => {
        var p = new Promise((resolve, reject) => {
            var conn = new Connection({}, true, 1000);

            var doNotReject = false;
            conn.on('dataRequired', (data) => {
                expect(data.packet.SEQ).to.equal(3);
                expect(data.respond).to.be.a('function');
                doNotReject = true;
                resolve();
            });

            conn.on('timedOut', () => {
                if (!doNotReject) {
                    reject('timed out');
                }
            });

            conn.processMessage({DID: 0, CID: 1, SEQ: 1});
            conn.processMessage({DID: 0, CID: 2, SEQ: 2});
            conn.processMessage({DID: 0, CID: 4, SEQ: 3});
        });

        expect(p).to.be.fulfilled.notify(done);
    });

    it('responds to a CONTROL_REQ correctly when active', (done) => {
        var p = new Promise((resolve, reject) => {
            var conn = new Connection({}, true, 1000);

            var doNotReject = false;
            conn.on('sendResponse', (data) => {
                if (data.SEQ === 2) {
                    expect(data.MRSP).to.be.equal(0);
                    expect(data.DATA).to.be.equalBytes(new Buffer([0]));
                    doNotReject = true;
                    resolve();
                }
            });

            conn.on('timedOut', () => {
                if (!doNotReject) {
                    reject('timed out');
                }
            });

            conn.processMessage({DID: 0, CID: 1, SEQ: 1});
            // ControlReq
            conn.processMessage({DID: 0, CID: 2, SEQ: 2});
        });

        expect(p).to.be.fulfilled.notify(done);
    });

    it('responds to a CONTROL_REQ correctly when queued', (done) => {
        var p = new Promise((resolve, reject) => {
            var conn = new Connection({}, false, 1000);

            var doNotReject = false;
            conn.on('sendResponse', (data) => {
                if (data.SEQ === 2) {
                    expect(data.MRSP).to.be.equal(0);
                    expect(data.DATA).to.be.equalBytes(new Buffer([1]));
                    doNotReject = true;
                    resolve();
                }
            });

            conn.on('timedOut', () => {
                if (!doNotReject) {
                    reject('timed out');
                }
            });

            conn.processMessage({DID: 0, CID: 1, SEQ: 1});
            // ControlReq
            conn.processMessage({DID: 0, CID: 2, SEQ: 2});
        });

        expect(p).to.be.fulfilled.notify(done);
    });
});