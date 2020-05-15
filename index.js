const io = require('socket.io')();
const signalServer = require('simple-signal-server')(io);
const allIDs = new Set();

// Configure socket.io to work with CORS
io.configure('production', function(){
    console.log("Server in production mode");
    io.enable('browser client minification');  // send minified client
    io.enable('browser client etag'); // apply etag caching logic based on version number
    io.enable('browser client gzip'); // the file
    io.set('log level', 1);           // logging
    io.set('transports', [            // all transports (optional if you want flashsocket)
        'websocket',
		'flashsocket',
		'htmlfile',
		'xhr-polling',
		'jsonp-polling'
    ]);
	io.set('origins', "http://localhost:* http://127.0.0.1:* https://rtay.io:*");
});

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