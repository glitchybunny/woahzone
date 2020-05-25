// This demo depends on the canvas element
if(!('getContext' in document.createElement('canvas'))){
    alert('Sorry, it looks like your browser does not support canvas!');
}

// Make sure webgl is enabled on the current machine for performance
if (WEBGL.isWebGLAvailable()) {
    // If everything is possible, automatically select the input element
    let input = document.getElementById('name-input');
    input.focus();
    input.select();
} else {
    let warning = WEBGL.getWebGLErrorMessage();
    document.body.appendChild(warning);
}

/*
// The URL of your web server (the port is set in app.js)
const url = document.documentURI;
const canvas = document.getElementById('paper');
const ctx = canvas.getContext('2d');
var id = Math.round(Date.now()*Math.random());

// A flag for drawing activity
var drawing = false;
var clients = {};
var cursors = {};
var socket = io.connect(url);

// Send message on connect
socket.on('connect', (data) => {
    socket.emit('join', 'Hello World from client');
});

socket.on('moving', (data) => {
    // Move the mouse pointer
    cursors[data.id].style.left = data.x;
    cursors[data.id].style.top = data.y;

    // Is the user drawing?
    if(data.drawing && clients[data.id]){
        // Draw a line on the canvas. clients[data.id] holds
        // the previous position of this user's mouse pointer
        drawLine(clients[data.id].x, clients[data.id].y, data.x, data.y);
    }

    // Saving the current client state
    clients[data.id] = data;
    clients[data.id].updated = Date.now();
})

var prev = {};

canvas.addEventListener('mousedown', (e) => {
    e.preventDefault();
    drawing = true;
    prev.x = e.pageX;
    prev.y = e.pageY;
})

document.addEventListener('mouseup', () => {
    drawing = false;
});

document.addEventListener('mouseleave', () => {
    drawing = false;
})


var lastEmit = Date.now();

document.addEventListener('mousemove', function(e) {
    if (Date.now()-lastEmit > 30) {
        socket.emit('mousemove', {
            'x': e.pageX,
            'y': e.pageY,
            'drawing': drawing,
            'id': id
        });
        lastEmit = Date.now();
    }

    // Draw a line for the current user's movement, as it is
    // not received in the socket.on('moving') event above

    if(drawing){
        drawLine(prev.x, prev.y, e.pageX, e.pageY);

        prev.x = e.pageX;
        prev.y = e.pageY;
    }
})


// Remove inactive clients after 10 seconds of inactivity
setInterval(function(){
    for(let ident in clients) {
        if (Date.now() - clients[ident].updated > 10000) {

            // Last update was more than 10 seconds ago.
            // This user has probably closed the page

            cursors[ident].remove();
            delete clients[ident];
            delete cursors[ident];
        }
    }
},10000);

function drawLine(fromx, fromy, tox, toy){
    ctx.moveTo(fromx, fromy);
    ctx.lineTo(tox, toy);
    ctx.stroke();
}

window.addEventListener( 'resize', () => {
    document.getElementById('paper').setSize(window.innerWidth, window.innerHeight);
}, false );
 */
