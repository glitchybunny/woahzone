/*
    woahzone.js
    a multiplayer vibe experiment by Riley Taylor (rtay.io)
*/

// Imports
import * as THREE from './three.module.js';
import {GLTFLoader} from './loaders/GLTFLoader.js';
import {DRACOLoader} from './loaders/DRACOLoader.js';
import {PointerLockControls} from './controls/PointerLockControls.js';

// Socket vars
const id = Math.round(Date.now() * Math.random() + 1);
const url = document.documentURI;
const socket = io.connect(url);
const users = {};
const tickRate = 15;
const frameRate = 60;
var name = undefined;
var animal = undefined;

// ThreeJS vars
const manager = new THREE.LoadingManager();
const dracoLoader = new DRACOLoader(manager);
const gltfLoader = new GLTFLoader(manager);
const cubeTextureLoader = new THREE.CubeTextureLoader();
const fontLoader = new THREE.FontLoader(manager);
var finishedLoading = false;

const canvasHolder = document.getElementById('canvas-holder');
const transparentMaterials = ['grass_side', 'vines_MAT'];
const playerModels = {};
var camera, scene, renderer, controls, player;
var openSansFont;

var moveForward = false;
var moveBackward = false;
var moveLeft = false;
var moveRight = false;
var moveUp = false;
var moveDown = false;
var moveSpace = false;
var moveCtrl = false;
var moveSprint = false;

var cameraMove, cameraStrafe, cameraHeave;
const moveSpdNormal = 8;
const moveSpdSprint = 14;
var moveSpd = moveSpdNormal;

var time, delta, moveTimer = 0;
var useDeltaTiming = true, weirdTiming = 0;
var prevTime = performance.now();


// This demo depends on the canvas element
if (!('getContext' in document.createElement('canvas'))) {
    alert('Sorry, it looks like your browser does not support canvas!');
}

// Make sure webgl is enabled on the current machine for performance
if (WEBGL.isWebGLAvailable()) {
    // If everything is possible, start the app, otherwise show an error
    init();
    gameLoop();
} else {
    let warning = WEBGL.getWebGLErrorMessage();
    document.body.appendChild(warning);
    canvasHolder.remove();
    throw 'WebGL disabled or not supported';
}


///// ----- ASYNC FUNCTIONS ----- /////
// Establish connection
socket.on('connect', () => {
    console.log("Connection established to server");

    // Broadcast join to other users
    socket.emit('join', {id: id});

    // Unblur screen and give control access
    canvasHolder.style.filter = "blur(0px)";
    document.getElementById('block-input').remove();
});

// Receive assigned identity
socket.on('selfIdentity', (data) => {
    name = data.name;
    animal = data.animal;
    console.log("You are an " + animal + " named " + name);
});

/// Handle information from other users
socket.on('otherJoin', (data) => {
    console.log(data.name, "has joined the server");

    // Load the player data and create them in the world
    createOtherPlayer(data.id, data.name, data.animal);

    // Send identity back if you have it
    if (name !== "" && name !== undefined) {
        emitIdentity(data.id);
        emitMove();
    }
});

socket.on('otherIdentity', (data) => {
    if (users[data.id] !== undefined) {
        users[data.id].name = data.name;
        users[data.id].animal = data.animal;
    } else {
        console.log(data.name, "is already on the server");

        // Haven't met this player before, so create them on our end
        createOtherPlayer(data.id, data.name, data.animal);
    }
});

socket.on('otherMove', (data) => {
    let userid = data.id;
    if (userid in users) {
        if (users[userid].mesh !== undefined) {
            users[userid].oldPos.copy(users[userid].mesh.position);
        }
        users[userid].pos.set(data.pos.x, data.pos.y, data.pos.z);
        users[userid].rot.set(data.rot.x, data.rot.y, data.rot.z, data.rot.w);
        users[userid].alpha = 0;
    }
});

socket.on('otherDisconnect', (userid) => {
    if (users[userid] !== undefined) {
        console.log(users[userid].name, "has disconnected");
        scene.remove(users[userid].text);
        scene.remove(users[userid].mesh);
        users[userid] = undefined;
    }
});

// Send information about self to others
function emitMove() {
    socket.emit('move', {
        id: id,
        pos: player.position,
        rot: {x:player.quaternion.x, y:player.quaternion.y, z:player.quaternion.z, w:player.quaternion.w}
    });
}

function emitIdentity(target) {
    socket.emit('identity', {
        id: id,
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
    scene = initScene("./mesh/weddingquake.min.glb");
    initSkybox(scene);
    initLights(scene);
    initPlayer(scene);
    initRenderer();
    initFonts();

    // Add a listener event for window resizing
    window.addEventListener('resize', onWindowResize, false);
}

function initManager() {
    manager.onStart = function(url, itemsLoaded, itemsTotal) {
        //console.log('Started loading: ' + url + '\nLoaded ' + itemsLoaded + ' of ' + itemsTotal + ' files.');
    };

    manager.onProgress = function (url, itemsLoaded, itemsTotal) {
        document.getElementById('progress-bar').style.width = (itemsLoaded / itemsTotal * 100) + '%';
        //console.log('Loading file: ' + url + '.\nLoaded ' + itemsLoaded + ' of ' + itemsTotal + ' files.');
    };

    manager.onLoad = function () {
        console.log('Loading complete!');
        document.getElementById('progress').hidden = true;
        finishedLoading = true;
    };
}

function initScene(sceneFile) {
    // Create a new scene
    let scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    //scene.overrideMaterial = new THREE.MeshLambertMaterial();  <--- Funny gamer mode

    // Use dracoloader for decompression
    dracoLoader.setDecoderPath('./js/loaders/draco/');
    dracoLoader.setDecoderConfig({ type: 'js' });

    // Load the scene geometry
    gltfLoader.setDRACOLoader(dracoLoader);
    gltfLoader.load(
        sceneFile,
        (gltf) => {
            // Add the level to the scene
            let root = gltf.scene;
            processMaterials(root);
            scene.add(root);
            scene.matrixAutoUpdate = false;
        },
        (xhr) => {
            //document.getElementById('progress-bar').style.width = (xhr.loaded / xhr.total * 100) + '%';
        },
        (error) => {
            console.log('Error loading', sceneFile);
            console.log(error);
        }
    );

    // Return the scene
    return scene;
}

function initSkybox(scene) {
    // Load skybox
    let skyboxArray = ["_ft.", "_bk.", "_up.", "_dn.", "_rt.", "_lf."];
    for (let i in skyboxArray) {
        skyboxArray[i] = "./img/skybox/cloudtop" + skyboxArray[i] + "jpg";
    }
    cubeTextureLoader.load(skyboxArray, (texture) => {scene.background = texture});
}

function initLights(scene) {
    // A single huge hemisphere light for global shading
    let light = new THREE.HemisphereLight(0xffffff, 0x222222, 1);
    light.position.set(100, 100, 0);

    scene.add(light);
}

function initPlayer(scene) {
    camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.02, 40);
    controls = new PointerLockControls(camera, document.body);

    player = controls.getObject();
    player.position.fromArray([0, 0, 0]);
    player.speedMultiplier = 1

    scene.add(player);

    canvasHolder.addEventListener('click', function () {
        if (finishedLoading === true) {
            controls.lock();
        }
    }, false);

    document.addEventListener('keydown', function (event) {
        switch (event.code) {
            case "ArrowUp":
            case "KeyW":
                moveForward = true;
                break;
            case "ArrowLeft":
            case "KeyA":
                moveLeft = true;
                break;
            case "ArrowDown":
            case "KeyS":
                moveBackward = true;
                break;
            case "ArrowRight":
            case "KeyD":
                moveRight = true;
                break;
            case "KeyE":
            case "PageUp":
                moveUp = true;
                break;
            case "KeyQ":
            case "PageDown":
                moveDown = true;
                break;
            case "Space":
                moveSpace = true;
                break;
            case "ControlLeft":
                moveCtrl = true;
                break;
            case "ShiftLeft":
                moveSprint = true;
                break;
        }
    }, false);

    document.addEventListener('keyup', function (event) {
        switch (event.code) {
            case "ArrowUp":
            case "KeyW":
                moveForward = false;
                break;
            case "ArrowLeft":
            case "KeyA":
                moveLeft = false;
                break;
            case "ArrowDown":
            case "KeyS":
                moveBackward = false;
                break;
            case "ArrowRight":
            case "KeyD":
                moveRight = false;
                break;
            case "KeyE":
            case "PageUp":
                moveUp = false;
                break;
            case "KeyQ":
            case "PageDown":
                moveDown = false;
                break;
            case "Space":
                moveSpace = false;
                break;
            case "ControlLeft":
                moveCtrl = false;
                break;
            case "ShiftLeft":
                moveSprint = false;
                break;
        }
    }, false);
}

function initRenderer() {
    renderer = new THREE.WebGLRenderer({antialias:true, powerPreference:"high-performance", stencil:false, alpha:false, depth:true, precision:"lowp"});
    renderer.setPixelRatio(1);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputEncoding = THREE.GammaEncoding;
    renderer.gammaFactor = 2.2;
    renderer.gammaOutput = true;
    //renderer.shadowMap.type = THREE.BasicShadowMap;
    canvasHolder.appendChild(renderer.domElement);
}

function initFonts() {
    fontLoader.load('./font/OpenSans_Regular.json',
        (font) => {
            openSansFont = font;

            // If there are any users already in the server before the font loaded, generate text for them
            for (let userid in users) {
                if (users[userid].text === undefined) {
                    let textMesh = createTextMesh(users[userid].name, 0.12);
                    users[userid].text = textMesh;
                    scene.add(textMesh);
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
    }, 1000/frameRate);
     */
    requestAnimationFrame(gameLoop);

    time = performance.now();
    if (useDeltaTiming) {
        delta = (time - prevTime) / 1000;
        // some code that checks if timing is weird and then turns off delta-timing
        if (delta === 0.1) {
            weirdTiming += 1;
            if (weirdTiming === 5) {
                useDeltaTiming = false;
                console.warn("HUMAN.Riley: performance.now() warning: The performance API in your browser is returning strange time measurements, perhaps due to a privacy or anti-fingerprinting setting you've enabled. I've disabled delta-timing so this doesn't affect your performance.")
            }
        }
    } else {
        delta = 1/frameRate;
    }

    // Process player input
    if (controls.isLocked) {
        // Sprinting
        if (moveSprint) {
            moveSpd = moveSpdSprint * player.speedMultiplier;
        } else {
            moveSpd = moveSpdNormal * player.speedMultiplier;
        }

        // Move forwards/backwards
        cameraMove = 1*moveForward - 1*moveBackward;
        if (cameraMove !== 0) {
            player.translateZ(delta * cameraMove * moveSpd * -1);
        }

        // Move left/right
        cameraStrafe = 1*moveRight - 1*moveLeft;
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
        cameraHeave = 1*moveUp - 1*moveDown;
        if (cameraHeave !== 0) {
            player.position.y += (delta * cameraHeave * moveSpd);
        }
    }

    // Broadcast movement to other players n times per second
    moveTimer += delta;
    if (moveTimer >= 1/tickRate) {
        moveTimer = 0;
        emitMove();
    }

    // Move other players (interpolate movement)
    for (let userid in users) {
        if (users[userid] !== undefined) {
            let oldPos = users[userid].oldPos;
            let pos = users[userid].pos;
            let rot = users[userid].rot;
            let a = users[userid].alpha;

            if (users[userid].mesh !== undefined) {
                users[userid].mesh.position.lerpVectors(oldPos, pos, a);
                users[userid].mesh.quaternion.rotateTowards(rot, users[userid].mesh.quaternion.angleTo(rot) * (tickRate/60));
                if (users[userid].text !== undefined) {
                    users[userid].text.position.copy(users[userid].mesh.position);
                    users[userid].text.rotation.copy(users[userid].mesh.rotation);
                }
            }

            users[userid].alpha = Math.min(a + delta*(tickRate-1), 2);
        }
    }

    prevTime = time;
    renderer.render(scene, camera);
}


// Loading functions
function loadPlayerModel(animal) {
    // Load a specific player model into the scene
    gltfLoader.load(
        './mesh/playermodels/' + animal + '.min.glb',
        (gltf) => {
            // Once model has been downloaded, scale it appropriately and load it into memory
            let model = gltf.scene;
            processMaterials(model);
            playerModels[animal] = model;

            // Also create an instance of the model for all players with that model
            for (let userid in users) {
                if (users[userid] !== undefined) {
                    if (users[userid].animal === animal) {
                        users[userid].mesh = playerModels[animal].clone();
                        scene.add(users[userid].mesh);
                    }
                }
            }
        }
    );
}

function createOtherPlayer(userid, name, animal) {
    // Init userid entry
    users[userid] = {
        'name': name,
        'animal': animal,
        'pos': new THREE.Vector3(0,0,0),
        'rot': new THREE.Quaternion(0, 0, 0, 0),
        'oldPos': new THREE.Vector3(0,0,0),
        'alpha': 0
    }

    // Load the player's 3D model based on their animal
    if (animal in playerModels && playerModels[animal] !== undefined) {
        // If it's already loaded, assign it to the player
        users[userid].mesh = playerModels[animal].clone();
        scene.add(users[userid].mesh);
    } else if (!(animal in playerModels)) {
        // If it's not loaded, and not being loaded, then load it into the scene
        // loadPlayerModel() will automatically handle assigning it to the player when the mesh is loaded
        playerModels[animal] = undefined;
        loadPlayerModel(animal);
    }

    // Add text above the player's head if the font has loaded
    // If the font hasn't loaded yet, it will automatically add text above all current player's heads when it loads
    if (openSansFont !== undefined) {
        // Create the text mesh and assign it to the player
        let textMesh = createTextMesh(name, 0.12);
        users[userid].text = textMesh;
        scene.add(textMesh);
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
    textGeometry.translate(textXOffset, 0.4, 0);
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
            if (transparentMaterials.indexOf(child.material.name) > -1) {
                //child.material.transparent = true;
                child.material.alphaTest = 0.2;
            } else {
                //child.material.transparent = false;
                child.material.alphaTest = 1;
            }

            child.material.transparent = false;
            child.material.color.convertSRGBToLinear();

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
