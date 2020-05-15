// Including libraries
const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);

const cors = require('cors');
app.use(cors());
app.use((req, res, next) => {
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
	next();
});

// Listen for incoming connections from clients
io.on('connection', (client) => {
	console.log("Client connected: ", client.id);

	client.on('join', function(data) {
		console.log(data);
	});

	// Start listening for mouse move events
	client.on('mousemove', function (data) {
		
		// This line sends the event (broadcasts it)
		// to everyone except the originating client.
		client.broadcast.emit('moving', data);
	});
});

server.listen(443);