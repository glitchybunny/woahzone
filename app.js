// Including libraries
const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const http = require('http');
const xss = require("xss");
var path = require('path');

// Usernames
const nameListAdjective = ["Creepy", "Deadly", "Eerie", "Howling", "Icy", "Invisible", "Jumpy", "Dark", "Savage",
	"Quiet", "Grim", "Dangerous", "Cursed", "Frightful", "Bitter", "Gloomy", "Menacing", "Crackling", "Magical",
	"Lurking", "Gravestone", "Wicked", "Phantom", "Scarlet", "Haunted", "Witchy", "Spooky", "Scary", "Weird", "Nerdy"];
const nameListNoun = ["Spider", "Ghost", "Pumpkin", "Skull", "Vampire", "Goblin", "Potion", "Shadow", "Monster", "Fog",
	"Owl", "Bat", "Hunter", "Stalker", "Cat", "Candy", "Ghoul", "Zombie", "Moon", "Werewolf", "Skeleton", "Web",
	"Thief", "Eyeball", "Eyes", "Candle", "Mist", "Midnight", "Creature", "Nerd"];
const playerModelList = ["ghost", "vampire", "werewolf"];

function randomName() {
	return nameListAdjective[nameListAdjective.length * Math.random() | 0] + nameListNoun[nameListNoun.length * Math.random() | 0] + Math.floor(Math.random().toFixed(2)*100);
}
function randomPlayerModel() {
	return playerModelList[playerModelList.length * Math.random() | 0];
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
		let _id = data.id || 0;
		let _name = randomName();
		let _model = randomPlayerModel();

		if (_id !== 0) {
			// Add data to current client list
			clients[socket.id].id = _id;
			clients[socket.id].name = _name;
			clients[socket.id].model = _model;

			// Broadcast join to all others (which will then respond with name for original client)
			socket.broadcast.emit('otherJoin', clients[socket.id]);

			// Note that client has joined in the console
			console.log(_id, "joined as a " + _model + " named " + _name);
		}

		// Tell user their assigned name
		if (data.id !== 0) {
			sockets[socket.id].emit('selfIdentity', {
				name: _name,
				model: _model
			})
		}
	});

	// Listen for name change events
	socket.on('identity', (data) => {
		let _id = data.id;
		let _name = data.name;
		let _model = data.model;
		_name = xss(_name.substr(0, 20));  // Make sure name is XSS safe

		// Update name in client list
		clients[socket.id].name = _name;
		clients[socket.id].model = _model;

		// If there's a target, only send the name to that target
		if (data.target !== undefined) {
			// Iterate over connected clients to find target and send them the message
			for (let c in clients) {
				if (clients[c].id == data.target) {
					sockets[c].emit('otherIdentity', {
						id: _id,
						name: _name,
						model: _model
					})
				}
			}
		} else {
			// Otherwise broadcast name change to all other users
			socket.broadcast.emit('otherIdentity', {
				id: _id,
				name: _name,
				model: _model
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