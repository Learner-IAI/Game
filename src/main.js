/*************************************
 * Landscape driver game main JS file
 *************************************/

/* CSS styles import */
import './styles.css';

/* Three.js library import */
import * as THREE from 'three';

/* Orbit controls import */
import { OrbitControls } from 'three-orbitcontrols/OrbitControls.js';

/* .GLTF model loader import */
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

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
    if (!this.isPause) {
      this.time = (Date.now() - this.start) / 1000;
    }
  }
}

/* Particle representation class */
class Particle {
  constructor (position, velocity, maxLifespan, texture, initFunction, changeFunction, parent) {
    this._sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture
      })
    );
    this._sprite.scale.set(2, 2, 2);
    this.position = position.clone();
    this.velocity = velocity.clone();

    this._birthTime = Date.now();
    this.lifespan = 0; // In seconds
    this.maxLifespan = maxLifespan; // In seconds
    this.mustDie = false;

    initFunction instanceof Function && initFunction.call(this);
    this.changeFunction = changeFunction;

    parent.add(this._sprite);
  }

  // Remove particle mesh from object method
  removeFrom (obj) {
    obj.remove(this._sprite);
  }

  // Handle particle behaviour method
  handle () {
    this.lifespan = (Date.now() - this._birthTime) / 1000;
    if (this.lifespan > this.maxLifespan) {
      this.mustDie = true;
      return;
    }
    this.changeFunction && this.changeFunction();

    this._sprite.position.set(this.position.x, this.position.y, this.position.z);
  }
}

/* Particle emitter representation class */
class Emitter extends THREE.Object3D {
  constructor (position, interval, particleVelocity, maxParticleLifespan, textureURL, particleInitFunction, particleChangeFunction) {
    super();
    this.position.set(position.x, position.y, position.z);
    this.interval = interval;

    this.maxParticleLifespan = maxParticleLifespan;
    this.particleVelocity = particleVelocity;
    this.particleQueue = [];

    const loader = new THREE.TextureLoader();
    const texture = loader.load(textureURL);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    this.particleTexture = texture;

    this.particleInitFunction = particleInitFunction;
    this.particleChangeFunction = particleChangeFunction;

    this.active = false;
  }

  // Activate emitter function
  activate () {
    const emit = () => this.emit();
    this.intervalId = setInterval(emit, this.interval * 1000);
    this.active = true;
  }

  // Deactivate emitter function
  deactivate () {
    clearInterval(this.intervalId);
    this.active = false;
  }

  // Emit one new particle method
  emit () {
    this.particleQueue.push(new Particle(
      this.position,
      this.particleVelocity,
      this.maxParticleLifespan,
      this.particleTexture,
      this.particleInitFunction,
      this.particleChangeFunction,
      this
    ));
  }

  // Handle all particles behaviour method
  handleParticles () {
    let ind;
    for (ind in this.particleQueue) {
      const p = this.particleQueue[ind];
      if (p.mustDie) {
        p.removeFrom(this);
        this.particleQueue.splice(ind, 1);
        continue;
      }
      p.handle();
    }
  }
}

/* Car representation class */
class Car {
  constructor () {
    this.group = new THREE.Group();

    this.dir2 = new THREE.Vector2(1, 0);
    this.coords = new THREE.Vector2(0, 0);

    this.velocity = 0.5;
    this.rotVelocity = Math.PI / 75;

    this.camVec = new THREE.Vector3(20, 10, 1.5);

    this.done = false;

    this.emitters = [];
  }

  /* Load car model method */
  loadModel (modelURL, callback) {
    const loader = new GLTFLoader();
    loader.load(modelURL, callback);
  }

  /* Put car on landscape method */
  putOnLandscape (land, vec) {
    const EPS = 0.01;

    let H1;
    let H2;

    // Current matrices evaluation
    const [curPosition, curHeight] = [land.getPoint(this.coords), land.getHeight(this.coords)];

    H1 = new THREE.Vector3(EPS, land.getHeight(new THREE.Vector2(this.coords.x + EPS, this.coords.y)) - curHeight, 0);
    H2 = new THREE.Vector3(0, land.getHeight(new THREE.Vector2(this.coords.x, this.coords.y + EPS)) - curHeight, EPS);

    const curNormal1 = H1.clone().cross(H2).normalize();
    const curTangent1 = H1.clone().cross(curNormal1).normalize();
    const curBitangent1 = curNormal1.clone().cross(curTangent1).normalize();
    const curMatrix1 = new THREE.Matrix4().makeBasis(curTangent1, curNormal1, curBitangent1);

    const curNormal = land.getNormal(this.coords);
    const curTangent = (new THREE.Vector3(curPosition.x, 0, curPosition.z)).cross(new THREE.Vector3(0, 1, 0)).normalize();
    const curBitangent = curNormal.clone().cross(curTangent).normalize();
    const curMatrix = new THREE.Matrix4().makeBasis(curTangent, curNormal, curBitangent).multiply(curMatrix1);
    const inverseCurMatrix = new THREE.Matrix4().getInverse(curMatrix);

    // New matrices evaluation
    const [newPosition, newHeight] = [land.getPoint(vec), land.getHeight(vec)];

    H1 = new THREE.Vector3(EPS, land.getHeight(new THREE.Vector2(vec.x + EPS, vec.y)) - newHeight, 0);
    H2 = new THREE.Vector3(0, land.getHeight(new THREE.Vector2(vec.x, vec.y + EPS)) - newHeight, EPS);

    const newNormal1 = H1.clone().cross(H2).normalize();
    const newTangent1 = H1.clone().cross(newNormal1).normalize();
    const newBitangent1 = newNormal1.clone().cross(newTangent1).normalize();
    const newMatrix1 = new THREE.Matrix4().makeBasis(newTangent1, newNormal1, newBitangent1);

    const newNormal = land.getNormal(vec);
    const newTangent = (new THREE.Vector3(newPosition.x, 0, newPosition.z)).cross(new THREE.Vector3(0, 1, 0)).normalize();
    const newBitangent = newNormal.clone().cross(newTangent).normalize();
    const newMatrix = new THREE.Matrix4().makeBasis(newTangent, newNormal, newBitangent).multiply(newMatrix1);

    // Transform matrix evaluation and applyment
    const transform = newMatrix.clone().multiply(inverseCurMatrix);
    this.group.applyMatrix4(transform);
    newPosition.add(newNormal);
    this.group.position.set(newPosition.x, newPosition.y, newPosition.z);
  }
}

/* Landscape representation class */
class Landscape extends THREE.Geometry {
  constructor () {
    super();
    this.done = false;
  }

  /* Get point coordinates from some local landscape coordinates method */
  getPoint (vec) {
    let x = vec.x;
    let y = vec.y;
    while (x < 0) {
      x += this.width;
    }
    while (y < 0) {
      y += this.height;
    }
    x %= this.width;
    y %= this.height;

    const X = x - Math.floor(x);
    const Y = y - Math.floor(y);
    x = Math.floor(x);
    y = Math.floor(y);

    const p1 = this.vertices[y * this.width + x];
    const p2 = this.vertices[y * this.width + (x + 1) % this.width];
    const p3 = this.vertices[(y + 1) % this.height * this.width + x];
    const p4 = this.vertices[(y + 1) % this.height * this.width + (x + 1) % this.width];

    const point = p1.clone().multiplyScalar((1 - X) * (1 - Y))
      .add(p2.clone().multiplyScalar(X * (1 - Y)))
      .add(p3.clone().multiplyScalar((1 - X) * Y))
      .add(p4.clone().multiplyScalar(X * Y));
    return point;
  }

  /* Get height from some local landscape coordinates method */
  getHeight (vec) {
    let x = vec.x;
    let y = vec.y;
    while (x < 0) {
      x += this.width;
    }
    while (y < 0) {
      y += this.height;
    }
    x %= this.width;
    y %= this.height;

    const X = x - Math.floor(x);
    const Y = y - Math.floor(y);
    x = Math.floor(x);
    y = Math.floor(y);

    const h1 = this.heights[y * this.width + x];
    const h2 = this.heights[y * this.width + (x + 1) % this.width];
    const h3 = this.heights[(y + 1) % this.height * this.width + x];
    const h4 = this.heights[(y + 1) % this.height * this.width + (x + 1) % this.width];

    const height = h1 * (1 - X) * (1 - Y) +
      h2 * X * (1 - Y) +
      h3 * (1 - X) * Y +
      h4 * X * Y;
    return height;
  }

  /* Get normal coordinates from some local landscape coordinates method */
  getNormal (vec) {
    let x = vec.x;
    let y = vec.y;
    while (x < 0) {
      x += this.width;
    }
    while (y < 0) {
      y += this.height;
    }
    x %= this.width;
    y %= this.height;

    const X = x - Math.floor(x);
    const Y = y - Math.floor(y);
    x = Math.floor(x);
    y = Math.floor(y);

    const n1 = this.faces[2 * (y * this.width + x)].vertexNormals[0];
    const n2 = this.faces[2 * (y * this.width + (x + 1) % this.width)].vertexNormals[0];
    const n3 = this.faces[2 * ((y + 1) % this.height * this.width + x)].vertexNormals[0];
    const n4 = this.faces[2 * ((y + 1) % this.height * this.width + (x + 1) % this.width)].vertexNormals[0];

    const normal = n1.clone().multiplyScalar((1 - X) * (1 - Y))
      .add(n2.clone().multiplyScalar(X * (1 - Y)))
      .add(n3.clone().multiplyScalar((1 - X) * Y))
      .add(n4.clone().multiplyScalar(X * Y)).negate().normalize();
    return normal;
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
  loadHeightMap (heightMapUrl, callback) {
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
      this.heights = [].fill(0);
      this.makeTorus(this.width, this.height);
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          /*
          const h = data[(y * this.width + x) * 4] / 255 * 0.1;
          this.setTorusHeight(x, y, h);
          this.heights[y * this.width + x] = h;
          */
        }
      }
      this.computeVertexNormals();
      callback();
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
    this.camera.bound = false;

    this.controls = new THREE.OrbitControls(this.camera, canvas);

    this.renderer = new THREE.WebGLRenderer({ canvas: canvas });
    this.renderer.autoClearColor = false;
    this.renderer.setSize(canvas.width, canvas.height);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMapSoft = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.keyboard = {};
    this.keyboardOld = {};
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

  /* Keyboard input (key down) handle method */
  handleInputDown (event) {
    const keyCode = event.key;
    this.keyboard[keyCode] = true;
  }

  /* Keyboard input (key up) handle method */
  handleInputUp (event) {
    const keyCode = event.key;
    this.keyboard[keyCode] = false;
  }

  /* Handle all the input has come */
  handleInput () {
    const carObj = this.car.group.children[0].children[0].children[0];
    if (('w' in this.keyboard && this.keyboard.w) ||
        ('W' in this.keyboard && this.keyboard.W) ||
        ('ц' in this.keyboard && this.keyboard.ц) ||
        ('Ц' in this.keyboard && this.keyboard.Ц)) {
      const offset = this.car.dir2.clone().multiplyScalar(this.car.velocity);
      this.car.putOnLandscape(this.land, this.car.coords.clone().add(offset));
      this.car.coords.add(offset);

      carObj.children[3].rotateOnAxis(new THREE.Vector3(1, 0, 0), Math.PI / 8);
      carObj.children[8].rotateOnAxis(new THREE.Vector3(1, 0, 0), Math.PI / 8);
      carObj.children[6].rotateOnAxis(new THREE.Vector3(1, 0, 0), Math.PI / 8);
      carObj.children[9].rotateOnAxis(new THREE.Vector3(1, 0, 0), Math.PI / 8);
    }
    if (('s' in this.keyboard && this.keyboard.s) ||
        ('S' in this.keyboard && this.keyboard.S) ||
        ('ы' in this.keyboard && this.keyboard.ы) ||
        ('Ы' in this.keyboard && this.keyboard.Ы)) {
      const offset = this.car.dir2.clone().multiplyScalar(this.car.velocity);
      this.car.putOnLandscape(this.land, this.car.coords.clone().sub(offset));
      this.car.coords.sub(offset);

      carObj.children[3].rotateOnAxis(new THREE.Vector3(1, 0, 0), -Math.PI / 8);
      carObj.children[8].rotateOnAxis(new THREE.Vector3(1, 0, 0), -Math.PI / 8);
      carObj.children[6].rotateOnAxis(new THREE.Vector3(1, 0, 0), -Math.PI / 8);
      carObj.children[9].rotateOnAxis(new THREE.Vector3(1, 0, 0), -Math.PI / 8);
    }
    if (('a' in this.keyboard && this.keyboard.a) ||
        ('A' in this.keyboard && this.keyboard.A) ||
        ('ф' in this.keyboard && this.keyboard.ф) ||
        ('Ф' in this.keyboard && this.keyboard.Ф)) {
      this.car.dir2.rotateAround(new THREE.Vector2(0, 0), this.car.rotVelocity);
      this.car.group.rotateOnAxis(new THREE.Vector3(0, 1, 0), this.car.rotVelocity);
    }
    if (('d' in this.keyboard && this.keyboard.d) ||
        ('D' in this.keyboard && this.keyboard.D) ||
        ('в' in this.keyboard && this.keyboard.в) ||
        ('В' in this.keyboard && this.keyboard.В)) {
      this.car.dir2.rotateAround(new THREE.Vector2(0, 0), -this.car.rotVelocity);
      this.car.group.rotateOnAxis(new THREE.Vector3(0, 1, 0), -this.car.rotVelocity);
    }
    if ((('b' in this.keyboard && this.keyboard.b) && !('b' in this.keyboardOld && this.keyboardOld.b)) ||
        (('B' in this.keyboard && this.keyboard.B) && !('B' in this.keyboardOld && this.keyboardOld.B)) ||
        (('и' in this.keyboard && this.keyboard.и) && !('и' in this.keyboardOld && this.keyboardOld.и)) ||
        (('И' in this.keyboard && this.keyboard.И) && !('И' in this.keyboardOld && this.keyboardOld.И))) {
      if (this.camera.bound) {
        const pos = new THREE.Vector3();
        this.camera.getWorldPosition(pos);
        this.car.group.remove(this.camera);
        this.camera.position.set(pos.x, pos.y, pos.z);
        this.controls.enabled = true;
        this.controls.update();
      } else {
        this.car.group.add(this.camera);
        this.camera.position.set(this.car.camVec.x, this.car.camVec.y, this.car.camVec.z);
        this.controls.enabled = false;
      }
      this.camera.bound = !this.camera.bound;
    }
    Object.assign(this.keyboardOld, this.keyboard);
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
    }, 0xffff88, 0.5);

    // Add toroidal landscape
    this.land = new Landscape();
    texture = loader.load('../bin/tex.jpg');
    this.land.loadHeightMap('../bin/hm.jpg', () => {
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
    });

    // Add car
    this.car = new Car();
    this.car.loadModel('../bin/car.glb', (gltf) => {
      this.car.group.name = 'car';

      const root = gltf.scene;
      root.traverse(function (object) {
        if (object.isMesh) {
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });
      root.scale.set(10, 10, 10);

      const bbox = new THREE.Box3();
      bbox.setFromObject(root);
      const offset = bbox.getCenter().negate();
      this.car.group.position.set(offset.x, offset.y, offset.z);
      this.car.group.position.add(new THREE.Vector3(0, 25, 0));
      this.car.group.offset = offset;

      // Lights
      const lights = new THREE.Group();

      const leftLight = new THREE.SpotLight(0xffffff, 1, 100, Math.PI / 6, 0.5);
      leftLight.position.set(-4.2, 0.1, -0.95).sub(this.car.group.offset);
      leftLight.target.position.set(-6, -0.1, -0.95).sub(this.car.group.offset);
      lights.add(leftLight);
      lights.add(leftLight.target);
      const leftLightMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      leftLightMesh.position.set(-4.2, 0.1, -0.95).sub(this.car.group.offset);
      lights.add(leftLightMesh);

      const rightight = new THREE.SpotLight(0xffffff, 1, 100, Math.PI / 6, 0.5);
      rightight.position.set(-4.2, 0.1, 0.95).sub(this.car.group.offset);
      rightight.target.position.set(-6, -0.1, 0.95).sub(this.car.group.offset);
      lights.add(rightight);
      lights.add(rightight.target);
      const rightLightMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      rightLightMesh.position.set(-4.2, 0.1, 0.95).sub(this.car.group.offset);
      lights.add(rightLightMesh);

      this.car.group.add(root);
      this.car.group.add(lights);

      this.car.group.rotateZ(-Math.PI / 2);
      const initPos = this.land.getPoint(new THREE.Vector2(0, 0));
      this.car.group.position.set(initPos.x + 0.5, initPos.y, initPos.z);
      this.camera.position.set(initPos.x + 80, initPos.y + 26, initPos.z);
      this.scene.add(this.car.group);

      // Dust emitters
      const positions = [new THREE.Vector3(1.9, -0.3, 0.1), new THREE.Vector3(1.9, -0.3, 1.4)];
      for (let i = 0; i < positions.length; i++) {
        const emitter = new Emitter(
          positions[i], 0.1, new THREE.Vector3(0.1, 0, 0), 1, '../bin/dust.png',
          function () {
            this.velocity.add(new THREE.Vector3(
              0,
              (Math.random() * 2 - 1) / 2,
              (Math.random() * 2 - 1) / 2
            ).multiplyScalar(0.1)).normalize().multiplyScalar(0.1);
          },
          function () {
            this._sprite.material.setValues({ opacity: 1 - this.lifespan / this.maxLifespan });
            this.position.add(this.velocity);
          }
        );
        this.car.emitters.push(emitter);
        emitter.activate();
        this.car.group.add(emitter);
      }

      this.car.done = true;
    });
  }

  /* Interframe response method */
  response () {
    this.timer.update();

    // Update light (day-night cycle)
    const sun = this.scene.getObjectByName('spot');
    sun.position.set(300 * Math.cos(this.timer.time * (2 * Math.PI) / 30), 300 * Math.sin(this.timer.time * (2 * Math.PI) / 30), 0);
    sun.color = new THREE.Color(1, 0.6 + 2 * 0.4 * Math.sin((this.timer.time + Math.PI / 4) * (2 * Math.PI) / 30), 0);
    sun.intensity = Math.sin(this.timer.time * (2 * Math.PI) / 30) + 1;

    const hem = this.scene.getObjectByName('hem');
    hem.intensity = 0.2 + 0.3 * Math.sin(this.timer.time * (2 * Math.PI) / 30);
    this.bgMesh2.material.opacity = 0.5 - 0.5 * (Math.sin(this.timer.time * (2 * Math.PI) / 30 + 1) / 2);

    if (this.car.done && this.land.done) {
      // Handle keyboard input
      this.handleInput();

      // Update camera
      const target = this.car.group.position.clone().sub(this.car.group.offset);
      this.camera.lookAt(target);
      this.controls.target.set(target.x, target.y, target.z);
      this.controls.update();

      // Update dust emitters
      let emitter;
      for (emitter of this.car.emitters) {
        emitter.handleParticles();
      }
    }

    // Update skybox position
    const camPos = new THREE.Vector3();
    this.camera.getWorldPosition(camPos);
    this.bgMesh.position.copy(camPos);
    this.bgMesh2.position.copy(camPos);
  }

  /* Render method */
  render () {
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
  window.alert(
`CONTROLS:
   • W,A,S,D - move car;
   • B - switch camera mode.`
  );
  render();
}

/* Keyboard input handle function */
function onDocumentKeyDown (event) {
  drawer.handleInputDown(event);
}

/* Keyboard input handle function */
function onDocumentKeyUp (event) {
  drawer.handleInputUp(event);
}

/* Add event handle for dynamically updating objects */
document.addEventListener('DOMContentLoaded', threejsStart);
document.addEventListener('keydown', onDocumentKeyDown);
document.addEventListener('keyup', onDocumentKeyUp);

document.getElementById('hash').innerHTML = 'Last git commit hash: ' + hash;
document.getElementById('date').innerHTML = JSON.parse(date).date;
