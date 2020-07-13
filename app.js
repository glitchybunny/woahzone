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

// Usernames
const nameList = ["Alfa", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel", "India", "Juliett", "Kilo",
	"Lima", "Mike", "November", "Oscar", "Papa", "Quebec", "Romeo", "Sierra", "Tango", "Uniform", "Victor", "Whiskey",
	"X-ray", "Yankee", "Zulu"];
const animalList = ["Aardvark","Alpacca","Anteater","ArabianGazelle","ArcticFox","ArcticHare","ArcticWolf","Armadillo",
	"BabySeal","Bel","BighornSheep1","BighornSheep2"];

function randomName() {
	return nameList[nameList.length * Math.random() | 0];
}
function randomAnimal() {
	return animalList[animalList.length * Math.random() | 0];
}

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
			socket.broadcast.emit('otherDisconnect', clients[socket.id].id);
		}
		delete clients[socket.id];
	});

	// Listen for client joining and assign a name
	socket.on('join', (data) => {
		// Make sure name is XSS safe
		let _id = data.id || 0;
		let _name = randomName();
		let _animal = randomAnimal();

		if (_id !== 0) {
			// Add data to current client list
			clients[socket.id].id = _id;
			clients[socket.id].name = _name;
			clients[socket.id].animal = _animal;

			// Broadcast join to all others (which will then respond with name for original client)
			socket.broadcast.emit('otherJoin', clients[socket.id]);

			// Note that client has joined in the console
			console.log(_id, "joined. Name:", _name, ", Animal:", _animal);
		}

		// Tell user their assigned name
		if (data.id !== 0) {
			sockets[socket.id].emit('selfIdentity', {
				name: _name,
				animal: _animal
			})
		}
	});

	// Listen for name change events
	socket.on('identity', (data) => {
		// Make sure name is XSS safe
		let _id = data.id;
		let _name = data.name;
		let _animal = data.animal;
		_name = xss(_name.substr(0, 20));

		// Update name in client list
		clients[socket.id].name = _name;
		clients[socket.id].animal = _animal;

		// If there's a target, only send the name to that target
		if (data.target !== undefined) {
			// Iterate over connected clients to find target and send them the message
			for (let c in clients) {
				if (clients[c].id == data.target) {
					sockets[c].emit('otherIdentity', {
						id: _id,
						name: _name,
						animal: _animal
					})
				}
			}
		} else {
			// Otherwise broadcast name change to all other users
			socket.broadcast.emit('otherIdentity', {
				id: _id,
				name: _name,
				animal: _animal
			});
		}
	});

	// Listen for movement events
	socket.on('move', (data) => {
		socket.broadcast.emit('otherMove', data);
	});
});


// Http server
app.get('/', function(req, res) {
	res.sendFile(path.join(__dirname + '/index.html'));
});
app.use(express.static('static'));


// Open server to manage server things
server.listen(process.env.PORT || 80);