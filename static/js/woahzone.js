/*
    woahzone.js
    a multiplayer vibe experiment by Riley Taylor (rtay.io)
*/

/// --- IMPORTS --- ///
import * as THREE from './three.module.js';
import {GLTFLoader} from './loaders/GLTFLoader.js';
import {DRACOLoader} from './loaders/DRACOLoader.js';
import {PointerLockControls} from './controls/PointerLockControls.js';

/// --- SOCKET CONSTANTS --- ///
const ID = Math.round(Date.now() * Math.random() + 1);
const SOCKET = io.connect(document.documentURI);
const USERS = {};
const TICKRATE = 15;
const FRAMERATE = 60;

/// --- THREEJS CONSTANTS --- ///
const MANAGER = new THREE.LoadingManager();
const DRACO_LOADER = new DRACOLoader(MANAGER);
const GLTF_LOADER = new GLTFLoader(MANAGER);
const CUBE_TEXTURE_LOADER = new THREE.CubeTextureLoader();
const FONT_LOADER = new THREE.FontLoader(MANAGER);
const FONT_SIZE = 0.08;

const CANVAS_HOLDER = document.getElementById('canvas-holder');

const CAMERA = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.02, 60);
const SCENE = new THREE.Scene();
const RENDERER = new THREE.WebGLRenderer({antialias:true, powerPreference:"high-performance", stencil:false, alpha:true, depth:true, precision:"lowp"});
const CONTROLS = new PointerLockControls(CAMERA, document.body);
const PLAYER = CONTROLS.getObject();

const TRANSPARENT_MATERIALS = ['grass_side', 'vines_MAT'];
const PLAYER_MODELS = {};

const DIR = {FORWARD:0, BACKWARD:1, LEFT:2, RIGHT:3, UP:4, DOWN:5, SPRINT:6};
const PLAYER_MOVE = [0, 0, 0, 0, 0, 0, 0];
const SPEED_NORMAL = 8;
const SPEED_SPRINT = 14;

/// --- VARIABLES --- ///
var name = undefined;
var animal = undefined;

var time, delta, moveTimer = 0;
var useDeltaTiming = true, weirdTiming = 0;
var prevTime = performance.now();

var openSansFont;


// This demo depends on the canvas element
if (!('getContext' in document.createElement('canvas'))) {
    alert('Sorry, it looks like your browser does not support canvas!');
}

// Also make sure webgl is enabled on the current machine
if (WEBGL.isWebGLAvailable()) {
    // If everything is possible, start the app, otherwise show an error
    init();
    gameLoop();
} else {
    let warning = WEBGL.getWebGLErrorMessage();
    document.body.appendChild(warning);
    CANVAS_HOLDER.remove();
    throw 'WebGL disabled or not supported';
}


///// ----- ASYNC FUNCTIONS ----- /////
// Establish connection
SOCKET.on('connect', () => {
    console.log("Connection established to server");

    // Broadcast join to other users
    SOCKET.emit('join', {id: ID});

    // Unblur screen and give control access
    CANVAS_HOLDER.style.filter = "blur(0px)";
    document.getElementById('block-input').remove();
});

// Receive assigned identity
SOCKET.on('selfIdentity', (data) => {
    name = data.name;
    animal = data.animal;
    console.log("You are a " + animal + " with the name " + name);
});

/// Handle information from other users
SOCKET.on('otherJoin', (data) => {
    console.log(data.name, "has joined the server");

    // Load the player data and create them in the world
    createOtherPlayer(data.id, data.name, data.animal);

    // Send identity back if you have it
    if (name !== "" && name !== undefined) {
        emitIdentity(data.id);
        emitMove();
    }
});

SOCKET.on('otherIdentity', (data) => {
    if (USERS[data.id] !== undefined) {
        USERS[data.id].name = data.name;
        USERS[data.id].animal = data.animal;
    } else {
        console.log(data.name, "is already on the server");

        // Haven't met this player before, so create them on our end
        createOtherPlayer(data.id, data.name, data.animal);
    }
});

SOCKET.on('otherMove', (data) => {
    let userid = data.id;
    if (userid in USERS) {
        if (USERS[userid].mesh !== undefined) {
            USERS[userid].oldPos.copy(USERS[userid].mesh.position);
        }
        USERS[userid].pos.set(data.pos.x, data.pos.y, data.pos.z);
        USERS[userid].rot.set(data.rot.x, data.rot.y, data.rot.z, data.rot.w);
        USERS[userid].alpha = 0;
    }
});

SOCKET.on('otherDisconnect', (userid) => {
    if (USERS[userid] !== undefined) {
        console.log(USERS[userid].name, "has disconnected");
        SCENE.remove(USERS[userid].text);
        SCENE.remove(USERS[userid].mesh);
        USERS[userid] = undefined;
    }
});

// Send information about self to others
function emitMove() {
    SOCKET.emit('move', {
        id: ID,
        pos: PLAYER.position,
        rot: {x:PLAYER.quaternion.x, y:PLAYER.quaternion.y, z:PLAYER.quaternion.z, w:PLAYER.quaternion.w}
    });
}

function emitIdentity(target) {
    SOCKET.emit('identity', {
        id: ID,
        name: name,
        animal: animal,
        target: target
    });
}


///// ----- SYNCRHONOUS FUNCTIONS ----- /////
// ThreeJS initialisation stuff
function init() {
    // Create the loading manager
    initManager()

    // Initialise everything in the scene
    initScene("./mesh/weddingquake.min.glb");
    initSkybox();
    initLights();
    initPlayer();
    initRenderer();
    initFonts();

    // Add a listener event for window resizing
    window.addEventListener('resize', onWindowResize, false);
}

function initManager() {
    MANAGER.onStart = function(managerUrl, itemsLoaded, itemsTotal) {
        //console.log('Started loading: ' + managerUrl + '\nLoaded ' + itemsLoaded + ' of ' + itemsTotal + ' files.');
    };

    MANAGER.onProgress = function(managerUrl, itemsLoaded, itemsTotal) {
        document.getElementById('progress-bar').style.width = (itemsLoaded / itemsTotal * 100) + '%';
        //console.log('Loading file: ' + managerUrl + '.\nLoaded ' + itemsLoaded + ' of ' + itemsTotal + ' files.');
    };

    MANAGER.onLoad = function () {
        console.log('Loading complete!');
        document.getElementById('progress').hidden = true;
    };
}

function initScene(sceneFile) {
    // Create a new scene
    SCENE.background = new THREE.Color(0x000000);
    //SCENE.overrideMaterial = new THREE.MeshLambertMaterial();  <--- Funny gamer mode

    // Use dracoloader for decompression
    DRACO_LOADER.setDecoderPath('./js/loaders/draco/');
    DRACO_LOADER.setDecoderConfig({ type: 'js' });

    // Load the scene geometry
    GLTF_LOADER.setDRACOLoader(DRACO_LOADER);
    GLTF_LOADER.load(
        sceneFile,
        (gltf) => {
            // Add the level to the scene
            let root = gltf.scene;
            processMaterials(root);
            SCENE.add(root);
            SCENE.matrixAutoUpdate = false;
        },
        (xhr) => {
            //document.getElementById('progress-bar').style.width = (xhr.loaded / xhr.total * 100) + '%';
        },
        (error) => {
            console.log('Error loading', sceneFile);
            console.log(error);
        }
    );
}

function initSkybox() {
    // Load skybox
    let skyboxArray = ["_ft.", "_bk.", "_up.", "_dn.", "_rt.", "_lf."];
    for (let i in skyboxArray) {
        skyboxArray[i] = "./img/skybox/cloudtop" + skyboxArray[i] + "jpg";
    }
    CUBE_TEXTURE_LOADER.load(skyboxArray, (texture) => {SCENE.background = texture});
}

function initLights() {
    // A single huge hemisphere light for global shading
    let light = new THREE.HemisphereLight(0xffffff, 0x222222, 1);
    light.position.set(100, 100, 0);
    SCENE.add(light);
}

function initPlayer() {
    PLAYER.position.fromArray([0, 0, 0]);
    PLAYER.speedMultiplier = 1
    SCENE.add(PLAYER);

    CANVAS_HOLDER.addEventListener('click', function () {
        CONTROLS.lock();
    }, false);

    document.addEventListener('keydown', function (event) {
        switch (event.code) {
            case "ArrowUp":
            case "KeyW":
                PLAYER_MOVE[DIR.FORWARD] = true;
                break;
            case "ArrowLeft":
            case "KeyA":
                PLAYER_MOVE[DIR.LEFT] = true;
                break;
            case "ArrowDown":
            case "KeyS":
                PLAYER_MOVE[DIR.BACKWARD] = true;
                break;
            case "ArrowRight":
            case "KeyD":
                PLAYER_MOVE[DIR.RIGHT] = true;
                break;
            case "KeyE":
            case "PageUp":
            case "Space":
                PLAYER_MOVE[DIR.UP] = true;
                break;
            case "KeyQ":
            case "PageDown":
                PLAYER_MOVE[DIR.DOWN] = true;
                break;
            case "ShiftLeft":
                PLAYER_MOVE[DIR.SPRINT] = true;
                break;
        }
    }, false);

    document.addEventListener('keyup', function (event) {
        switch (event.code) {
            case "ArrowUp":
            case "KeyW":
                PLAYER_MOVE[DIR.FORWARD] = false;
                break;
            case "ArrowLeft":
            case "KeyA":
                PLAYER_MOVE[DIR.LEFT] = false;
                break;
            case "ArrowDown":
            case "KeyS":
                PLAYER_MOVE[DIR.BACKWARD] = false;
                break;
            case "ArrowRight":
            case "KeyD":
                PLAYER_MOVE[DIR.RIGHT] = false;
                break;
            case "KeyE":
            case "PageUp":
            case "Space":
                PLAYER_MOVE[DIR.UP] = false;
                break;
            case "KeyQ":
            case "PageDown":
                PLAYER_MOVE[DIR.DOWN] = false;
                break;
            case "ShiftLeft":
                PLAYER_MOVE[DIR.SPRINT] = false;
                break;
        }
    }, false);
}

function initRenderer() {
    RENDERER.setPixelRatio(0.7);
    RENDERER.setSize(window.innerWidth, window.innerHeight);
    RENDERER.outputEncoding = THREE.GammaEncoding;
    RENDERER.gammaFactor = 2.2;
    CANVAS_HOLDER.appendChild(RENDERER.domElement);
}

function initFonts() {
    FONT_LOADER.load('./font/OpenSans_Regular.json',
        (font) => {
            openSansFont = font;

            // If there are any users already in the server before the font loaded, generate text for them
            for (let userid in USERS) {
                if (USERS[userid].text === undefined) {
                    let textMesh = createTextMesh(USERS[userid].name, FONT_SIZE);
                    USERS[userid].text = textMesh;
                    SCENE.add(textMesh);
                }
            }
        }
    );
}


// ThreeJS main game/render loop
function gameLoop() {
    /*
    setTimeout(function () {
        requestAnimationFrame(gameLoop);
        // honestly FUCK whatever the fuck is happening
        // when I try to cap this
    }, 1000/FRAMERATE);
     */
    requestAnimationFrame(gameLoop);

    time = performance.now();
    if (useDeltaTiming) {
        delta = (time - prevTime) / 1000;
        // some code that checks if timing is weird and then turns off delta-timing
        // this is specifically for those people running this in firefox with privacy.resistFingerprinting enabled
        if (delta === 0.1) {
            weirdTiming += 1;
            if (weirdTiming === 5) {
                useDeltaTiming = false;
                console.warn("HUMAN.Riley: performance.now() warning: The performance API in your browser is returning strange time measurements, perhaps due to a privacy or anti-fingerprinting setting you've enabled. I've disabled delta-timing so this doesn't affect your performance.")
            }
        }
    } else {
        delta = 1/FRAMERATE;
    }

    // Process player input
    if (CONTROLS.isLocked) {
        // Sprinting
        let moveSpd;
        if (PLAYER_MOVE[DIR.SPRINT]) {
            moveSpd = SPEED_SPRINT * PLAYER.speedMultiplier;
        } else {
            moveSpd = SPEED_NORMAL * PLAYER.speedMultiplier;
        }

        // Move forwards/backwards
        let dolly = PLAYER_MOVE[DIR.BACKWARD] - PLAYER_MOVE[DIR.FORWARD];
        if (dolly !== 0) {
            PLAYER.translateZ(dolly * moveSpd * delta);
        }

        // Move left/right
        let strafe = PLAYER_MOVE[DIR.RIGHT] - PLAYER_MOVE[DIR.LEFT];
        if (strafe !== 0) {
            PLAYER.translateX(strafe * moveSpd * delta);
        }

        // Move up/down
        let heave = PLAYER_MOVE[DIR.UP] - PLAYER_MOVE[DIR.DOWN];
        if (heave !== 0) {
            PLAYER.position.y += (heave * moveSpd * delta);
        }
    }

    // Broadcast movement to other players n times per second
    moveTimer += delta;
    if (moveTimer >= 1/TICKRATE) {
        moveTimer = 0;
        emitMove();
    }

    // Move other players (interpolate movement)
    for (let userid in USERS) {
        if (USERS[userid] !== undefined) {
            let oldPos = USERS[userid].oldPos;
            let pos = USERS[userid].pos;
            let rot = USERS[userid].rot;
            let a = USERS[userid].alpha;

            if (USERS[userid].mesh !== undefined) {
                USERS[userid].mesh.position.lerpVectors(oldPos, pos, a);
                USERS[userid].mesh.quaternion.rotateTowards(rot, USERS[userid].mesh.quaternion.angleTo(rot) * (TICKRATE * delta));
                if (USERS[userid].text !== undefined) {
                    USERS[userid].text.position.copy(USERS[userid].mesh.position);
                    USERS[userid].text.rotation.copy(USERS[userid].mesh.rotation);
                }
            }

            USERS[userid].alpha = Math.min(a + delta*(TICKRATE-1), 2);
        }
    }

    prevTime = time;
    RENDERER.render(SCENE, CAMERA);
}


// Loading functions
function loadPlayerModel(animal) {
    // Load a specific player model into the scene
    GLTF_LOADER.load(
        './mesh/playermodels/' + animal + '.min.glb',
        (gltf) => {
            // Once model has been downloaded, scale it appropriately and load it into memory
            let model = gltf.scene;
            processMaterials(model);
            PLAYER_MODELS[animal] = model;

            // Also create an instance of the model for all players with that model
            for (let userid in USERS) {
                if (USERS[userid] !== undefined) {
                    if (USERS[userid].animal === animal) {
                        USERS[userid].mesh = PLAYER_MODELS[animal].clone();
                        SCENE.add(USERS[userid].mesh);
                    }
                }
            }
        }
    );
}

function createOtherPlayer(userid, name, animal) {
    // Init userid entry
    USERS[userid] = {
        'name': name,
        'animal': animal,
        'pos': new THREE.Vector3(0,0,0),
        'rot': new THREE.Quaternion(0, 0, 0, 0),
        'oldPos': new THREE.Vector3(0,0,0),
        'alpha': 0
    }

    // Load 3D model based on the animal
    if (animal in PLAYER_MODELS && PLAYER_MODELS[animal] !== undefined) {
        // If it's already loaded, assign it to the user
        USERS[userid].mesh = PLAYER_MODELS[animal].clone();
        SCENE.add(USERS[userid].mesh);
    } else if (!(animal in PLAYER_MODELS)) {
        // If it's not loaded, and not being loaded, then load it into the scene
        // loadPlayerModel() will automatically assign it to the user when the mesh is loaded
        PLAYER_MODELS[animal] = undefined;
        loadPlayerModel(animal);
    }

    // Add text above the user's head if the font has loaded
    // If the font hasn't loaded yet, it will automatically add text above all current user's heads when it loads
    if (openSansFont !== undefined) {
        // Create the text mesh and assign it to the user
        let textMesh = createTextMesh(name, FONT_SIZE);
        USERS[userid].text = textMesh;
        SCENE.add(textMesh);
    }
}

function createTextMesh(message, fontSize) {
    let textMat, textShapes, textGeometry, textXOffset, textMesh;

    // Create the text geometry and material
    textMat = new THREE.MeshBasicMaterial({color: 0x000000, side: THREE.DoubleSide})
    textShapes = openSansFont.generateShapes(message, fontSize);
    textGeometry = new THREE.ShapeBufferGeometry(textShapes);
    textGeometry.computeBoundingBox();

    // Center align text
    textXOffset = -0.5 * (textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x);
    textGeometry.translate(textXOffset, 0.3, 0);
    textGeometry.rotateY(Math.PI);

    // Generate text mesh
    textMesh = new THREE.Mesh(textGeometry, textMat);
    return textMesh;
}


// Miscellaneous functions
function processMaterials(obj) {
    // Recursively goes through all materials and modifies them so the scene is displayed correctly
    //  - Enables backface culling on all materials
    //  - Enables transparency for some materials

    obj.children.forEach((child) => {
        if (child.hasOwnProperty("material")) {

            // Enable backface culling
            child.material.side = THREE.FrontSide;

            // Don't blur materials up close
            if (child.material.map != null) {
                child.material.map.magFilter = THREE.NearestFilter;
                child.material.map.minFilter = THREE.NearestMipmapNearestFilter;//THREE.LinearMipmapNearestFilter;
            }

            // Enable transparency if the material is tagged as transparent
            if (TRANSPARENT_MATERIALS.indexOf(child.material.name) > -1) {
                //child.material.transparent = true;
                child.material.alphaTest = 0.2;
            } else {
                //child.material.transparent = false;
                child.material.alphaTest = 1;
            }

            child.material.transparent = false;
            child.material.color.convertSRGBToLinear();

            // TODO: Materials could be converted into MeshLambertMaterial instead of MeshStandardMaterial for optimisation, would SCENE.overrideMaterial work?
        }
        processMaterials(child);
    });
}

function onWindowResize() {
    CAMERA.aspect = window.innerWidth / window.innerHeight;
    CAMERA.updateProjectionMatrix();
    RENDERER.setSize(window.innerWidth, window.innerHeight);
}
