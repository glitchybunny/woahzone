// Including libraries
const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const http = require('http');
const xss = require("xss");
var path = require('path');

// Cors proofing
const cors = require('cors');
var allowCrossDomain = function(req, res, next) {
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
	res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');

	// intercept OPTIONS method
	if ('OPTIONS' == req.method) {
		res.send(200);
	} else {
		next();
	}
};
app.use(cors());
app.use(allowCrossDomain);

// Basic client list (to keep track of currently connected client IDs and names only, nothing more)
const clients = [];
const sockets = [];

// Listen for incoming connections from clients
io.on('connection', (socket) => {

	clients[socket.id] = {};
	sockets[socket.id] = socket;

	// Listen for disconnect events
	socket.on('disconnecting', (data) => {
		// Only broadcast to other clients that this one has left IF it has triggered a join event
		if (clients[socket.id].id !== undefined) {
			socket.broadcast.emit('leave', clients[socket.id].id);
		}
		delete clients[socket.id];
	});

	// Listen for client joining and let other clients know to broadcast their names
	socket.on('join', (data) => {
		// Make sure name is XSS safe
		let _id = data.id || 0;
		let _name = data.name || "";
		_name = xss(_name.substr(0, 20));

		if (_id !== 0) {
			// Add data to current client list
			clients[socket.id].id = _id;
			clients[socket.id].name = _name;

			// Broadcast join to all others (which will then respond with name for original client)
			socket.broadcast.emit('join', clients[socket.id]);

			// Note that client has joined in the console
			console.log(_id, "joined with name:", _name);
		}
	});

	// Listen for name change events
	socket.on('name', (data) => {
		// Make sure name is XSS safe
		let _id = data.id;
		let _name = data.name;
		_name = xss(_name.substr(0, 20));

		// Update name in client list
		clients[socket.id].name = _name;

		// If there's a target, only send the name to that target
		if (data.target !== undefined) {
			// Iterate over connected clients to find target and send them the message
			for (let c in clients) {
				if (clients[c].id == data.target) {
					sockets[c].emit('name', {
						id: _id,
						name: _name
					})
				}
			}
		} else {
			// Otherwise broadcast name change to all other users
			socket.broadcast.emit('name', {
				id: _id,
				name: _name
			});
		}
	});

	// Listen for movement events
	socket.on('move', (data) => {
		socket.broadcast.emit('move', data);
	});
});


// Http server
app.get('/', function(req, res) {
	res.sendFile(path.join(__dirname + '/index.html'));
});
const files = ['/js/socket.io.js', '/js/woahzone.js', '/js/WebGL.min.js', '/js/three.module.js', '/js/controls/PointerLockControls.js',
	'/js/loaders/GLTFLoader.js', '/meshes/weddingquake.glb', '/img/skybox/cloudtop_ft.jpg', '/img/skybox/cloudtop_bk.jpg', '/img/skybox/cloudtop_up.jpg',
	'/img/skybox/cloudtop_dn.jpg', '/img/skybox/cloudtop_lf.jpg', '/img/skybox/cloudtop_rt.jpg', '/meshes/player.glb',];
for (let i in files) {
	app.get(files[i], function(req, res) {res.sendFile(path.join(__dirname + files[i]));});
}

server.listen(process.env.PORT || 80);