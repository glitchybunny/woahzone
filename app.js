// Including libraries

const cors = require('cors');
const app = require('http').createServer(handler);
const io = require('socket.io').listen(app);

app.options('*', cors())

// Listen for incoming connections from clients
io.on('connection', function (socket) {

	// Start listening for mouse move events
	socket.on('mousemove', function (data) {
		
		// This line sends the event (broadcasts it)
		// to everyone except the originating client.
		socket.broadcast.emit('moving', data);
	});
});