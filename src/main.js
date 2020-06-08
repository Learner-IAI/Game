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

/* Car representation class */
class Car {
  constructor () {
    this.geom = new THREE.CubeGeometry(20, 4, 4);
    this.material = new THREE.MeshPhongMaterial({
      color: 0x232323
    });
    this.dir = new THREE.Vector3(1, 0, 0);
  }

  /* Put car on landscape static method */
  /*
  static putOnLandscape (car, mesh, land, x, y) {
    const pos = land.geom.vertices[y * land.width + x];
    mesh.position.set(...Object.values(pos));

    const normal = land.geom.faces[2 * (y * land.width + x)].vertexNormals[0];
    const offset = new THREE.Vector3();
    offset.addVectors(normal, new THREE.Vector3(0.01, 0.01, 0.01));

    const newDir = normal.applyAxisAngle(offset, Math.PI / 2);
    const cross = new THREE.Vector3();
    cross.crossVectors(car.dir, newDir);
    mesh.rotation.set(
      cross,
      -Math.acos(car.dir.dot(newDir) / (car.dir.length() * newDir.length()))
    );
    car.dir = car.dir.applyAxisAngle(
      cross,
      -Math.acos(car.dir.dot(newDir) / (car.dir.length() * newDir.length()))
    );
  }
  */
}

/* Landscape representation class */
class Landscape {
  constructor () {
    this.geom = new THREE.Geometry();
  }

  /* Make torus geometry for landscape method */
  makeTorus (width, height, innerRadius = 0.3, outerRadius = 1) {
    const R = (outerRadius + innerRadius) / 2;
    const r = (outerRadius - innerRadius) / 2;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        this.geom.vertices.push(new THREE.Vector3(
          (R + r * Math.cos(x / width * 2 * Math.PI)) * Math.cos(y / height * 2 * Math.PI),
          r * Math.sin(x / width * 2 * Math.PI),
          (R + r * Math.cos(x / width * 2 * Math.PI)) * Math.sin(y / height * 2 * Math.PI)
        ));
        this.geom.faces.push(
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
        this.geom.faceVertexUvs[0].push(
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
    this.geom.computeVertexNormals();
  }

  /* Set height of some point of torus method */
  setTorusHeight (x, y, value) {
    const theta = x * 2 * Math.PI / (this.width - 1);
    const phi = y * 2 * Math.PI / (this.height - 1);
    this.geom.vertices[(y % this.height) * this.width + (x % this.width)].add(new THREE.Vector3(
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
      this.geom.computeVertexNormals();
      deferredFunc();
    };
    imgLoader.load(heightMapUrl, handleImageData);
  }
}

/* Main drawing context representation class */
class Drawer {
  constructor (canvas) {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(45, canvas.width / canvas.height, 0.1, 300);
    this.camera.position.set(150, 150, 150);

    this.controls = new THREE.OrbitControls(this.camera, canvas);

    this.renderer = new THREE.WebGLRenderer({ canvas: canvas });
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
    const Axes = new THREE.AxesHelper(120, 120, 120);
    this.scene.add(Axes);

    // Add lights
    this.addLight('amb', null, 0xffffff, 0.2);
    this.addLight('spot', (light) => {
      light.position.set(300, 300, 0);
      light.castShadow = true;
      light.shadow.radius = 8;
    }, 0xffffff, 1);

    // Add toroidal landscape
    const land = new Landscape();
    const loader = new THREE.TextureLoader();
    const texture = loader.load('../tex.png');
    land.loadHeightMap('../hm.png', () => {
      const material = new THREE.MeshPhongMaterial({
        color: 'white',
        side: THREE.DoubleSide,
        map: texture
      });
      land.geom.scale(100, 100, 100);
      this.addMesh(land.geom, material, (land) => {
        land.name = 'land';
        land.castShadow = false;
        land.receiveShadow = true;
      });
      /*
      this.scene.remove(carMesh);
      this.scene.getObjectByName('land').add(carMesh);
      Car.putOnLandscape(car, carMesh, land, 0, 0);
      */
    });

    // Add car
    /*
    const car = new Car();
    const carMesh = new THREE.Mesh(car.geom, car.material);
    carMesh.castShadow = true;
    carMesh.receiveShadow = true;
    carMesh.position.set(0, 50, 0);
    carMesh.name = 'car';
    this.scene.add(carMesh);
    */
  }

  /* Interframe responce method */
  response () {
  }

  /* Render method */
  render () {
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

/* Add event handle for dynamically updating objects */
document.addEventListener('DOMContentLoaded', threejsStart);

document.getElementById('hash').innerHTML = 'Last git commit hash: ' + hash;
document.getElementById('date').innerHTML = JSON.parse(date).date;
