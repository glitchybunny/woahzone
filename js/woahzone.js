/*
    woahzone.js
    a multiplayer vibe experiment by Riley Taylor (rtay.io)
*/

// Imports
import * as THREE from './three.module.js';
import {GLTFLoader} from './loaders/GLTFLoader.js';
import {PointerLockControls} from './controls/PointerLockControls.js';

// Socket vars
const id = Math.round(Date.now() * Math.random() + 1);
const url = document.documentURI;
const socket = io.connect(url);
const users = {};
var joined = false;
var name = "";

// ThreeJS vars
const manager = new THREE.LoadingManager();
const canvasHolder = document.getElementById('canvas-holder');
var camera, scene, renderer, composer, currentScene, updateScene = false, transparentMaterials = [];
var loader, root, light, playerModel, finishedLoading = false;
var controls, player;

var moveForward = false;
var moveBackward = false;
var moveLeft = false;
var moveRight = false;
var moveUp = false;
var moveDown = false;
var moveSpace = false;
var moveCtrl = false;
var moveSprint = false;
var onKeyDown, onKeyUp;

var cameraDir = new THREE.Vector3();
var cameraMove, cameraStrafe, cameraHeave;
var moveSpdNormal = 8;
var moveSpdSprint = 16;
var moveSpd = moveSpdNormal;

var time, delta;
var useDeltaTiming = true;
var weirdTiming = 0;
var prevTime = performance.now();


// This demo depends on the canvas element
if (!('getContext' in document.createElement('canvas'))) {
    alert('Sorry, it looks like your browser does not support canvas!');
}

// Make sure webgl is enabled on the current machine for performance
if (WEBGL.isWebGLAvailable()) {
    // If everything is possible, automatically select the input element
    let input = document.getElementById('name-input');
    input.focus();
    input.select();
    init();
    gameLoop();
} else {
    let warning = WEBGL.getWebGLErrorMessage();
    document.body.appendChild(warning);
    document.getElementById('name-div-center').remove();
    document.getElementById('canvas-holder').remove();
    throw 'WebGL disabled or not supported';
}


// Establish connection
socket.on('connect', () => {
    console.log("Connection established to server");

    document.getElementById('name-submit').addEventListener('click', () => {
        if (joined === false) {
            name = document.getElementById('name-input').value;
            socket.emit('join', {
                id: id,
                name: name
            });
            joined = true;
            canvasHolder.style.filter = "blur(0px)";
            document.getElementById('name-div-center').remove();
            document.getElementById('block-input').remove();
        }
    }, false);
});

// Respond when other user joins
socket.on('join', (data) => {
    console.log(data.name, "has joined the server");
    users[data.id] = {'name': data.name}

    if (playerModel !== undefined) {
        let mesh = playerModel.clone()
        scene.add(mesh);
        users[data.id].mesh = mesh;
    }

    // Send name back if you've already joined
    if (joined) {
        emitName(data.id);
        emitMove();
    }
})

// Get other users names
socket.on('name', (data) => {
    if (users[data.id] !== undefined) {
        users[data.id].name = data.name;
    } else {
        let mesh = playerModel.clone()
        scene.add(mesh);
        users[data.id] = {
            name: data.name,
            mesh: mesh,
        }
    }
});

// Get user updating position
socket.on('move', (data) => {
    if (users[data.id] !== undefined) {
        if (users[data.id].mesh !== undefined) {
            users[data.id].mesh.position.set(data.pos.x, data.pos.y, data.pos.z);
            users[data.id].mesh.rotation.set(data.rot.x, data.rot.y, data.rot.z);
        } else {
            let mesh = playerModel.clone()
            scene.add(mesh);
            users[data.id].mesh = mesh;
        }
    }
});

// Know if other users have disconnected
socket.on('leave', (id) => {
    if (users[id] !== undefined) {
        console.log(users[id].name, "has disconnected");
        scene.remove(users[id].mesh);
    }
})


// Synchronous threejs stuff
function init() {
    // Load the scene
    scene = new THREE.Scene();
    loadScene("weddingquake.glb");
    scene.background = new THREE.Color(0x000000);

    // Add lighting
    light = new THREE.HemisphereLight(0xffffff, 0x222222, 1);
    light.position.set(100, 100, 0);
    scene.add(light);

    // Create and configure player
    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.02, 500);
    player = playerInit();

    // Setup the renderer and composer
    renderer = new THREE.WebGLRenderer({antialias: true, powerPreference: "low-power", stencil: false, alpha: true});
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputEncoding = THREE.GammaEncoding;
    renderer.gammaFactor = 2.2;
    renderer.shadowMap.type = THREE.BasicShadowMap;
    canvasHolder.appendChild(renderer.domElement);

    // Add a listener event for window resizing
    window.addEventListener('resize', onWindowResize, false);
}

function loadScene(sceneFile) {
    // Change to new scene
    var progressBar = document.getElementById('progress-bar');
    var progress = document.getElementById('progress');
    progress.hidden = false;

    manager.onLoad = function () {
        // print completion
        console.log('Loading complete!');
        finishedLoading = true;

        // remove loading bar
        progress.hidden = true;
    };

    // Load geometry
    loader = new GLTFLoader(manager);
    loader.setPath('/meshes/');
    loader.load(
        sceneFile,

        (gltf) => {
            // initialise scene object
            root = gltf.scene;
            processMaterials(root);

            // add new scene
            scene.add(root);

            // Also reset all movement variables to stop a drifting bug that sometimes occurs in safari
            moveForward = false;
            moveBackward = false;
            moveLeft = false;
            moveRight = false;
            moveUp = false;
            moveDown = false;
            moveSpace = false;
            moveCtrl = false;
            moveSprint = false;

            // Tell the game to update the renderer
            updateScene = true;
        },

        (xhr) => {
            document.getElementById('progress-bar').style.width = (xhr.loaded / xhr.total * 100) + '%';
        },

        (error) => {
            console.log('An error happened');
            console.log(error);
        }
    );

    // Load player models
    let playerLoader = new GLTFLoader(manager);
    loader.setPath('/meshes/');
    loader.load(
        'player.glb',

        (gltf) => {
            // initialise player object
            playerModel = gltf.scene;
            processMaterials(playerModel);

            // add player model to any other players in the scene
            console.log(users);
            //scene.add(playerModel);

            // Tell the game to update the renderer
            updateScene = true;
        },

        (xhr) => {
            document.getElementById('progress-bar').style.width = (xhr.loaded / xhr.total * 100) + '%';
        },

        (error) => {
            console.log('An error happened');
            console.log(error);
        }
    );

    // Load skybox
    let skyboxPath = ["cloudtop", "jpg"];
    let skyboxArray = ["_ft.", "_bk.", "_up.", "_dn.", "_rt.", "_lf."];
    for (let i in skyboxArray) {
        skyboxArray[i] = skyboxPath[0] + skyboxArray[i] + skyboxPath[1];
    }
    let skybox = new THREE.CubeTextureLoader()
        .setPath("/img/skybox/")
        .load(skyboxArray,
            (texture) => {
                // Set background to skybox texture
                scene.background = texture;
            });
}

function playerInit() {
    // Initialise the player camera and controller
    controls = new PointerLockControls(camera, document.body);
    player = controls.getObject();
    player.position.fromArray([0, 0, 0]);
    player.speedMultiplier = 1;
    scene.add(player);

    canvasHolder.addEventListener('click', function () {
        if (finishedLoading === true) {
            controls.lock();
        }
    }, false);

    onKeyDown = function (event) {
        switch (event.keyCode) {
            case 38: // up
            case 87: // w
                moveForward = true;
                break;
            case 37: // left
            case 65: // a
                moveLeft = true;
                break;
            case 40: // down
            case 83: // s
                moveBackward = true;
                break;
            case 39: // right
            case 68: // d
                moveRight = true;
                break;
            case 69: // e
            case 33: // page up
                moveUp = true;
                break;
            case 81: // q
            case 34: // page down
                moveDown = true;
                break;
            case 32: // space
                moveSpace = true;
                break;
            case 17: // control
                moveCtrl = true;
                break;
            case 16: // shift
                moveSprint = true;
                break;
            case 80: // p
                console.log(player.position, player.rotation);
                break;
        }
    };

    onKeyUp = function (event) {
        switch (event.keyCode) {
            case 38: // up
            case 87: // w
                moveForward = false;
                break;
            case 37: // left
            case 65: // a
                moveLeft = false;
                break;
            case 40: // down
            case 83: // s
                moveBackward = false;
                break;
            case 39: // right
            case 68: // d
                moveRight = false;
                break;
            case 32: // space
                moveSpace = false;
            case 69: // e
            case 33: // page up
                moveUp = false;
                break;
            case 17: // control
                moveCtrl = false;
            case 81: // q
            case 34: // page down
                moveDown = false;
                break;
            case 16: // shift
                moveSprint = false;
                break;
        }
    };

    document.addEventListener('keydown', onKeyDown, false);
    document.addEventListener('keyup', onKeyUp, false);

    return player;
}

function gameLoop() {
    setTimeout(function () {
        requestAnimationFrame(gameLoop);
    }, 14.28571);

    time = performance.now();
    if (useDeltaTiming) {
        delta = (time - prevTime) / 1000;
        // some code that checks if timing is weird and then turns off deltatiming
        if (delta == 0.1) {
            weirdTiming += 1;
            if (weirdTiming === 5) {
                useDeltaTiming = false;
                console.warn("HUMAN.Riley: performance.now() warning: The performance API in your browser is returning strange time measurements, perhaps due to a privacy or anti-fingerprinting setting you've enabled. I've disabled delta-timing so this doesn't affect your performance.")
            }
        }
    } else {
        delta = 0.0167;
    }

    if (controls.isLocked || updateScene) {
        updateScene = false;

        // Sprinting
        if (moveSprint) {
            moveSpd = moveSpdSprint * player.speedMultiplier;
        } else {
            moveSpd = moveSpdNormal * player.speedMultiplier;
        }

        // Move forwards/backwards
        cameraMove = Number(moveForward) - Number(moveBackward);
        if (cameraMove !== 0) {
            player.translateZ(delta * cameraMove * moveSpd * -1);
        }

        // Move left/right
        cameraStrafe = Number(moveRight) - Number(moveLeft);
        if (cameraStrafe !== 0) {
            player.translateX(delta * cameraStrafe * moveSpd);
        }

        // Move up/down
        if (moveSpace) {
            if (moveCtrl) {
                moveUp = false;
                moveDown = true;
            } else {
                moveUp = true;
                moveDown = false;
            }
        }
        cameraHeave = Number(moveUp) - Number(moveDown);
        if (cameraHeave !== 0) {
            player.position.y += (delta * cameraHeave * moveSpd);
        }

        emitMove();
    }

    prevTime = time;
    renderer.render(scene, camera);
}

function emitMove() {
    socket.emit('move', {
        id: id,
        pos: player.position,
        rot: {x: player.rotation.x, y: player.rotation.y, z: player.rotation.z}
    });
}

function emitName(target) {
    if (target !== undefined) {
        socket.emit('name', {
            id: id,
            name: name,
            target: target,
        });
    } else {
        socket.emit('name', {
            id: id,
            name: name,
        });
    }
}


// Miscellaneous functions
function dumpObject(obj, lines = [], isLast = true, prefix = '') {
    const localPrefix = isLast ? '└─' : '├─';
    lines.push(`${prefix}${prefix ? localPrefix : ''}${obj.name || '*no-name*'} [${obj.type}]`);
    const newPrefix = prefix + (isLast ? '  ' : '│ ');
    const lastNdx = obj.children.length - 1;
    obj.children.forEach((child, ndx) => {
        const isLast = ndx === lastNdx;
        dumpObject(child, lines, isLast, newPrefix);
    });
    return lines;
}

function processMaterials(obj) {
    // Recursively goes through all materials and modifies them so the scene is displayed correctly
    //  - Enables backface culling on all materials
    //  - Enables transparency for some materials

    obj.children.forEach((child, ndx) => {
        if (child.hasOwnProperty("material")) {

            // Enable backface culling
            child.material.side = THREE.FrontSide;

            // Enable transparency if the material is tagged as transparent
            if (transparentMaterials.indexOf(child.material.name) > -1) {
                child.material.transparent = true;
                child.material.alphaTest = 0.2;
            } else {
                child.material.transparent = false;
                child.material.alphaTest = 1;
            }

            // TODO: Materials could be converted into MeshLambertMaterial instead of MeshStandardMaterial for optimisation, would scene.overrideMaterial work?
        }
        processMaterials(child);
    });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
