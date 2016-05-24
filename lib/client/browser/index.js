var io = require('socket.io-client', {
    expose: 'io'
});
var client = module.exports = require('../');
client.defaultSocketModule = io;