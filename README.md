# woahzone
A prototype 3D hangout space built on [three.js](https://github.com/mrdoob/three.js) and [socket.io](https://github.com/socketio/socket.io).

Created because I wanted a space to hang out with friends digitally when we couldn't meet in person due to COVID-19. 

:ghost: *Currently halloween themed* :ghost:

## Instructions
It's designed to be as simple as possible to install and host without having to read too much documentation. You should be able to run this on a heroku instance without much trouble, and I imagine it'll work self-hosted and on other platforms too.

For reference, app.js is the node server, and /static/js/woahzone.js is the main javascript module loaded by the client when they connect.

**How to run locally:**
1. Make sure you have npm and nodejs installed - they're required for this.
2. Clone the repo and navigate to the cloned directory.
3. Run `npm install` to download all the dependencies.
4. Run `node app.js` to test the server locally.
5. Connect to the server by going to `localhost` or `127.0.0.1` in your browser.

## Demonstration
The latest version of woahzone can be played at [woahzone.glitch.gay](https://woahzone.glitch.gay/). 

If nobody else is online, try inviting some friends* or opening a couple of windows with the website to simulate the experience. 

*\*Friends not included*
