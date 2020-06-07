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

/* Main drawing context representation class */
class Drawer {
  constructor (canvas) {
    // this.startTime = Date.now();

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(45, canvas.width / canvas.height, 0.1, 100);
    this.camera.position.set(8, 8, 8);
    this.camera.lookAt(this.scene.position);

    this.controls = new THREE.OrbitControls(this.camera, canvas);

    this.renderer = new THREE.WebGLRenderer({ canvas: canvas });
    this.renderer.setSize(canvas.width, canvas.height);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMapSoft = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.meshes = {};
  }

  addMesh (geometry, material, func, name) {
    const newMesh = new THREE.Mesh(geometry, material);
    func && func(newMesh);
    this.scene.add(newMesh);
    this.meshes[name] = newMesh;
  }

  init () {
  }

  response () {
  }

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
  canvas.width = window.innerWidth;
  drawer = new Drawer(canvas);

  drawer.init();
  render();
}

/* Add event handle for dynamically updating objects */
document.addEventListener('DOMContentLoaded', threejsStart);

document.getElementById('hash').innerHTML = 'Last git commit hash: ' + hash;
document.getElementById('date').innerHTML = JSON.parse(date).date;
