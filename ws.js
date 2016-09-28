var WebSocketServer = require('ws').Server;
var config = require('./config');

var wss;

var connectionListener = function(ws) {
  console.log('new connection');

  var message = {
    type: 'init'
  };

  var cookie = ws.upgradeReq.headers.cookie;

  ws.send(JSON.stringify(message));

  //wss.clients.forEach(function(client, i, arr) {
  //});

  ws.on('close', function() {
    console.log('connection closed');
  });
};

module.exports = function(server, bluetoothServices) {
  wss = new WebSocketServer({
    server: server,
    path: config.SOCKET_URL
  });

  wss.on('connection', connectionListener);
}
