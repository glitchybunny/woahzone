const io = require('socket.io')({
	"log level": 1,
	"transports": [
		'websocket',
		'flashsocket',
		'htmlfile',
		'xhr-polling',
		'jsonp-polling'
	],
	"origins": "http://localhost:* http://127.0.0.1:* https://rtay.io:*"
});
const signalServer = require('simple-signal-server')(io);
const allIDs = new Set();


// Handle server behaviour
signalServer.on('discover', (request) => {
	const clientID = request.socket.id; // you can use any kind of identity, here we use socket.id
	allIDs.add(clientID); // keep track of all connected peers
	request.discover(clientID, Array.from(allIDs)); // respond with id and list of other peers
})

signalServer.on('disconnect', (socket) => {
	const clientID = socket.id;
	allIDs.delete(clientID);
})

signalServer.on('request', (request) => {
	request.forward(); // forward all requests to connect
})