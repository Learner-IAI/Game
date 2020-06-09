/*************************************
 * Landscape driver game main JS file
 *************************************/

/* CSS styles import */
import './styles.css';

/* Three.js library import */
import * as THREE from 'three';

/* Orbit controls import */
import { OrbitControls } from 'three-orbitcontrols/OrbitControls.js';

/* Git last commit hash import */
import hash from '../hash.txt';

/* Webpack build date import */
import date from '../version.txt';

/* Timer representation class */
class Timer {
  constructor () {
    this.start = Date.now();
    this.time = 0; // In seconds
  }

  /* Update timer method */
  update () {
    this.time = (Date.now() - this.start) / 1000;
  }
}

/* Car representation class */
class Car {
  constructor () {
    this.geom = new THREE.CubeGeometry(20, 4, 4);
    this.material = new THREE.MeshPhongMaterial({
      color: 0xdedede
    });
    this.normal = new THREE.Vector3(0, 1, 0);
    this.coords = new THREE.Vector2();
  }

  /* Put car on landscape static method */
  putOnLandscape (mesh, land, x, y) {
    x %= land.width;
    if (x < 0) {
      x += land.width;
    }
    y %= land.height;
    if (y < 0) {
      y += land.height;
    }
    this.coords = new THREE.Vector2(x, y);
    const pos = land.vertices[y * land.width + x];
    mesh.position.set(...Object.values(pos));

    const newNormal = land.faces[2 * (y * land.width + x)].vertexNormals[0];
    newNormal.negate();
    const cross = new THREE.Vector3();
    cross.crossVectors(this.normal, newNormal);
    const dot = newNormal.dot(this.normal);
    const angle = -Math.acos(dot / (newNormal.length() * this.normal.length()));
    this.normal.applyAxisAngle(cross, angle);
    if (Number.isNaN(this.normal.x)) {
      return;
    }

    mesh.rotateOnAxis(cross, angle);
  }
}

/* Landscape representation class */
class Landscape extends THREE.Geometry {
  constructor () {
    super();
    this.done = false;
  }

  /* Make torus geometry for landscape method */
  makeTorus (width, height, innerRadius = 0.3, outerRadius = 1) {
    const R = (outerRadius + innerRadius) / 2;
    const r = (outerRadius - innerRadius) / 2;
    this.r = r;
    this.R = R;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        this.vertices.push(new THREE.Vector3(
          (R + r * Math.cos(x / width * 2 * Math.PI)) * Math.cos(y / height * 2 * Math.PI),
          r * Math.sin(x / width * 2 * Math.PI),
          (R + r * Math.cos(x / width * 2 * Math.PI)) * Math.sin(y / height * 2 * Math.PI)
        ));
        this.faces.push(
          new THREE.Face3(
            y * width + x,
            ((y + 1) % height) * width + ((x + 1) % width),
            y * width + ((x + 1) % width)
          ),
          new THREE.Face3(
            y * width + x,
            ((y + 1) % height) * width + x,
            ((y + 1) % height) * width + ((x + 1) % width)
          )
        );
        this.faceVertexUvs[0].push(
          [
            new THREE.Vector2(x / width, 1 - y / height),
            new THREE.Vector2((x + 1) / width, 1 - (y + 1) / height),
            new THREE.Vector2((x + 1) / width, 1 - y / height)
          ],
          [
            new THREE.Vector2(x / width, 1 - y / height),
            new THREE.Vector2(x / width, 1 - (y + 1) / height),
            new THREE.Vector2((x + 1) / width, 1 - (y + 1) / height)
          ]
        );
      }
    }
    this.computeVertexNormals();
  }

  /* Set height of some point of torus method */
  setTorusHeight (x, y, value) {
    const theta = x * 2 * Math.PI / (this.width - 1);
    const phi = y * 2 * Math.PI / (this.height - 1);
    this.vertices[(y % this.height) * this.width + (x % this.width)].add(new THREE.Vector3(
      value * Math.cos(theta) * Math.cos(phi),
      value * Math.sin(theta),
      value * Math.cos(theta) * Math.sin(phi)
    ));
  }

  /* Load and apply height map of the landscape method */
  loadHeightMap (heightMapUrl, deferredFunc) {
    const imgLoader = new THREE.ImageLoader();
    const handleImageData = (image) => {
      const ctx = document.createElement('canvas').getContext('2d');
      const { width, height } = image;
      ctx.canvas.width = width;
      ctx.canvas.height = height;
      ctx.drawImage(image, 0, 0);
      const { data } = ctx.getImageData(0, 0, width, height);

      this.width = width;
      this.height = height;
      this.makeTorus(this.width, this.height);
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          this.setTorusHeight(x, y, data[(y * this.width + x) * 4] / 255 * 0.1);
        }
      }
      this.computeVertexNormals();
      deferredFunc();
      this.done = true;
    };
    imgLoader.load(heightMapUrl, handleImageData);
  }
}

/* Main drawing context representation class */
class Drawer {
  constructor (canvas) {
    this.timer = new Timer();

    this.scene = new THREE.Scene();
    this.bgScene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(45, canvas.width / canvas.height, 0.1, 10000);
    this.camera.position.set(150, 150, 150);

    this.controls = new THREE.OrbitControls(this.camera, canvas);

    this.renderer = new THREE.WebGLRenderer({ canvas: canvas });
    this.renderer.autoClearColor = false;
    this.renderer.setSize(canvas.width, canvas.height);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMapSoft = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  /* Add light to scene method */
  addLight (type, func, ...params) {
    let light;
    switch (type) {
      case 'amb':
        light = new THREE.AmbientLight(...params);
        break;
      case 'hem':
        light = new THREE.HemisphereLight(...params);
        break;
      case 'dir':
        light = new THREE.DirectionalLight(...params);
        break;
      case 'point':
        light = new THREE.PointLight(...params);
        break;
      case 'spot':
        light = new THREE.SpotLight(...params);
        break;
      default:
        throw new Error(`No such type of light supported: ${type}`);
    }
    func && func(light);
    this.scene.add(light);
  }

  /* Add mesh to scene method */
  addMesh (geometry, material, func) {
    const newMesh = new THREE.Mesh(geometry, material);
    func && func(newMesh);
    this.scene.add(newMesh);
  }

  /* Initialize drawing context method */
  init () {
    // Add sky wrapping background
    const loader = new THREE.TextureLoader();
    let texture = loader.load('../bin/sky_bg.jpg');
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;

    const shader = THREE.ShaderLib.equirect;
    const material = new THREE.ShaderMaterial({
      fragmentShader: shader.fragmentShader,
      vertexShader: shader.vertexShader,
      uniforms: shader.uniforms,
      depthWrite: false,
      side: THREE.BackSide
    });
    const material2 = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0,
      side: THREE.BackSide
    });
    material.uniforms.tEquirect.value = texture;
    const bg = new THREE.BoxBufferGeometry(2, 2, 2);
    const bg2 = new THREE.BoxBufferGeometry(1.99, 1.99, 1.99);
    this.bgMesh = new THREE.Mesh(bg, material);
    this.bgMesh2 = new THREE.Mesh(bg2, material2);
    this.bgScene.add(this.bgMesh);
    this.bgScene.add(this.bgMesh2);

    // Create axes
    const Axes = new THREE.AxesHelper(120, 120, 120);
    this.scene.add(Axes);

    // Add lights
    this.addLight('amb', (light) => { light.name = 'amb'; }, 0xffffff, 0.2);
    this.addLight('hem', (light) => { light.name = 'hem'; }, 0xeeeeff, 0x000000, 0.5);
    this.addLight('spot', (light) => {
      light.name = 'spot';
      light.position.set(300, 300, 0);
      light.castShadow = true;
      light.shadow.radius = 8;
    }, 0xffff55, 1);

    // Add toroidal landscape
    this.land = new Landscape();
    texture = loader.load('../bin/tex.png');
    this.land.loadHeightMap('../bin/hm.png', () => {
      const material = new THREE.MeshPhongMaterial({
        color: 'white',
        side: THREE.DoubleSide,
        // wireframe: true,
        map: texture
      });
      this.land.scale(100, 100, 100);
      this.addMesh(this.land, material, (land) => {
        land.castShadow = false;
        land.receiveShadow = true;
      });
      this.car.putOnLandscape(carMesh, this.land, 0, 0);
    });

    // Add car
    this.car = new Car();
    const carMesh = new THREE.Mesh(this.car.geom, this.car.material);
    carMesh.castShadow = true;
    carMesh.receiveShadow = true;
    carMesh.position.set(0, 50, 0);
    carMesh.name = 'car';
    this.scene.add(carMesh);

    const carAxes = new THREE.AxesHelper(10, 10, 10);
    carMesh.add(carAxes);
  }

  /* Keyboard input handle method */
  handleInput (event) {
    if (!this.land.done) {
      return;
    }
    const keyCode = event.key;
    const carMesh = this.scene.getObjectByName('car');
    switch (keyCode) {
      case 'w':
        this.car.putOnLandscape(carMesh, this.land, this.car.coords.x + 1, this.car.coords.y);
        break;
      case 'a':
        this.car.putOnLandscape(carMesh, this.land, this.car.coords.x, this.car.coords.y + 1);
        break;
      case 's':
        this.car.putOnLandscape(carMesh, this.land, this.car.coords.x - 1, this.car.coords.y);
        break;
      case 'd':
        this.car.putOnLandscape(carMesh, this.land, this.car.coords.x, this.car.coords.y - 1);
        break;
      case '0':
        this.car.putOnLandscape(carMesh, this.land, 0, 0);
        break;
    }
  }

  /* Interframe responce method */
  response () {
    // Update global time
    this.timer.update();

    // Update light (day-night cycle)
    const sun = this.scene.getObjectByName('spot');
    sun.position.set(300 * Math.cos(this.timer.time * (2 * Math.PI) / 30), 300 * Math.sin(this.timer.time * (2 * Math.PI) / 30), 0);
    sun.color = new THREE.Color(1, 0.6 + 2 * 0.4 * Math.sin((this.timer.time + Math.PI / 4) * (2 * Math.PI) / 30), 0);
    sun.intensity = Math.sin(this.timer.time * (2 * Math.PI) / 30) + 1;

    const hem = this.scene.getObjectByName('hem');
    hem.intensity = 0.2 + 0.3 * Math.sin(this.timer.time * (2 * Math.PI) / 30);
    this.bgMesh2.material.opacity = 0.5 - 0.5 * (Math.sin(this.timer.time * (2 * Math.PI) / 30 + 1) / 2);
  }

  /* Render method */
  render () {
    this.bgMesh.position.copy(this.camera.position);
    this.bgMesh2.position.copy(this.camera.position);
    this.renderer.render(this.bgScene, this.camera);
    this.renderer.render(this.scene, this.camera);
  }
}

/* Main program drawing context */
let drawer;

/* Main render function */
function render () {
  window.requestAnimationFrame(render);

  drawer.response();
  drawer.render();
}

/* Start render function */
function threejsStart () {
  const canvas = document.getElementById('canvas');
  canvas.width = window.innerWidth - 40;
  drawer = new Drawer(canvas);

  drawer.init();
  render();
}

/* Keyboard input handle function */
function onDocumentKeyDown (event) {
  drawer.handleInput(event);
}

/* Add event handle for dynamically updating objects */
document.addEventListener('DOMContentLoaded', threejsStart);
document.addEventListener('keydown', onDocumentKeyDown, false);

document.getElementById('hash').innerHTML = 'Last git commit hash: ' + hash;
document.getElementById('date').innerHTML = JSON.parse(date).date;
