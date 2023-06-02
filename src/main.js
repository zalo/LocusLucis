import * as THREE from 'three';
import { GUI } from '../node_modules/three/examples/jsm/libs/lil-gui.module.min.js';
import { MultiTargetGPUComputationRenderer } from './MultiTargetGPUComputationRenderer.js';

class LocusLucis {
  constructor() {
    //let debug = new Debug();

    this.container = document.createElement( 'div' );
    document.body.appendChild( this.container );

    this.scene = new THREE.Scene();
    this.scene.name = 'Scene';

    this.width  = window.innerWidth;
    this.height = window.innerHeight;

    this.camera = new THREE.PerspectiveCamera( 45, this.width / this.height, 1.0, 2000.0 );
    this.camera.position.set( 0, 0, 100 );
    this.scene.add(this.camera);

    this.time = 0;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, transparent: true, alpha: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(this.width, this.height);
    this.renderer.setAnimationLoop(this.render.bind(this));
    this.renderer.setClearAlpha(0.0);
    this.renderer.setClearColor(new THREE.Color(1, 1, 1), 0.0);
    this.renderer.domElement.style.position = 'fixed';
    this.renderer.domElement.style.zIndex   = '-1000';
    this.container.appendChild(this.renderer.domElement);

    new THREE.TextureLoader().load('./assets/RadiosityTest.png', (texture) => {
      this.testTexture = texture;
      this.testTexture.minFilter = THREE.NearestFilter;
      this.testTexture.magFilter = THREE.NearestFilter;
      console.log(this.testTexture);

      this.uniforms = {
        map                   : { value: this.testTexture },
        lineResolution        : { value: 512 },
        angularResolution     : { value: 128 },
        stepDistance          : { value: 0.001 },
        stepDirection         : { value: 0.00 },
        outputResolutionScale : { value: 1.0 },
      }
  
      this.gui = new GUI()
      //this.gui.add(this.uniforms.       lineResolution, 'value', 0.1  , 1.0 ).name('Line Resolution');
      //this.gui.add(this.uniforms.    angularResolution, 'value', 0.1  , 1.0 ).name('Angular Resolution');
      this.gui.add(this.uniforms.         stepDistance, 'value', 0.001, 0.01).name('Step Distance');
      this.gui.add(this.uniforms.        stepDirection, 'value', 0.0,   6.28).name('Step Direction');
      this.gui.add(this.uniforms.outputResolutionScale, 'value', 0.1  , 1.0 ).name('Quality')
        .onChange(() => { this.renderer.setPixelRatio(window.devicePixelRatio * this.uniforms.outputResolutionScale.value); });
      this.gui.open();
  
      this.isovistComputation = new MultiTargetGPUComputationRenderer(
                                  this.uniforms.lineResolution.value, this.uniforms.angularResolution.value, this.renderer);
      this.initialIsovist     = this.isovistComputation.createTexture();
      this.isovist            = this.isovistComputation.addVariable("textureIsovist"    , this.initialIsovist);

      this.isovistPass = this.isovistComputation.addPass(this.isovist, [], `
        out highp vec4 pc_fragColor;
        uniform sampler2D map;
        uniform float lineResolution, angularResolution, stepDistance, stepDirection, outputResolutionScale;

        vec2 boxIntersection( in vec2 ro, in vec2 rd, in vec2 rad ) {
            vec2 m = 1.0/rd;
            vec2 n = m*ro;
            vec2 k = abs(m)*rad;
            vec2 t1 = -n - k;
            vec2 t2 = -n + k;
            float tN = max( t1.x, t1.y );
            float tF = min( t2.x, t2.y );
            return vec2( tN, tF );
        }

        void main() {
          vec2 uv = gl_FragCoord.xy / resolution.xy; //vec2(lineResolution, angularResolution);//
          vec2 direction = vec2(cos(stepDirection), sin(stepDirection));
          vec2 boxIntersections = boxIntersection(uv, direction, vec2(1.0, 1.0));

          //vec4 colorToDraw = texture2D(map, uv);
          vec4 colorToDraw = vec4(1.0, 1.0, 1.0, 1.0);
          for(float i = boxIntersections.x; i < 0.0; i += stepDistance) {
            vec4 sampledColor = texture2D(map, uv + (direction * i));
            if(sampledColor.g < 1.0) {
              colorToDraw = sampledColor;
            }
          }

          pc_fragColor = colorToDraw;
        }`);
      Object.assign(this.isovistPass.material.uniforms, this.uniforms);
      this.isovistPass.material.uniformsNeedUpdate = true;
      this.isovistPass.material.needsUpdate = true;
      console.log(this.isovistPass.material.uniforms);

      const error = this.isovistComputation.init();
      if ( error !== null ) { console.error( error ); }

      console.log(this.isovistComputation.getCurrentRenderTarget(this.isovist));
      this.labelMaterial = new THREE.MeshBasicMaterial( 
        { map: this.isovistComputation.getCurrentRenderTarget(this.isovist).texture, side: THREE.DoubleSide });
      this.labelPlane = new THREE.PlaneGeometry(50, 50);
      this.labelMesh = new THREE.Mesh(this.labelPlane, this.labelMaterial);
      this.labelMesh.position.set(50, 0, 0);
      this.labelMesh.scale   .set(1, 1, 1);
      this.scene.add(this.labelMesh);

      this.reprojectionMaterial = new THREE.ShaderMaterial( {
        side: THREE.FrontSide,
        //dithering: true,
        //transparent: true,
        uniforms: this.uniforms,
        vertexShader: `
          varying vec2 vUv;
          void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
              //gl_Position = vec4( ( uv - 0.5 ) * 2.0, 0.0, 1.0 );
          }`,
        fragmentShader: `
          uniform sampler2D map;
          uniform float lineResolution, angularResolution, stepDistance, stepDirection, outputResolutionScale;
          varying vec2 vUv;

          #include <common>
          #include <dithering_pars_fragment>

          vec2 boxIntersection( in vec2 ro, in vec2 rd, in vec2 rad ) {
              vec2 m = 1.0/rd;
              vec2 n = m*ro;
              vec2 k = abs(m)*rad;
              vec2 t1 = -n - k;
              vec2 t2 = -n + k;
              float tN = max( t1.x, t1.y );
              float tF = min( t2.x, t2.y );
              return vec2( tN, tF );
          }

          void main() {
            vec2 direction = vec2(cos(stepDirection), sin(stepDirection));
            vec2 boxIntersections = boxIntersection(vUv, direction, vec2(1.0, 1.0));

            vec4 colorToDraw = vec4(1.0, 1.0, 1.0, 1.0);
            for(float i = boxIntersections.x; i < 0.0; i += stepDistance) {
              vec4 sampledColor = texture2D(map, vUv + (direction * i));
              if(sampledColor.g < 1.0) {
                colorToDraw = sampledColor;
              }
            }

            gl_FragColor = colorToDraw;
            #include <dithering_fragment>
          }`
      });
  
      this.reprojectionMesh = new THREE.Mesh( new THREE.PlaneGeometry( 50, 50 ), this.reprojectionMaterial );
      this.reprojectionMesh.position.set(0, 0, 0);
      this.reprojectionMesh.scale   .set(1, 1, 1);
      this.scene.add(this.reprojectionMesh);




    } ); 

    window.addEventListener('resize', this.resize.bind(this));
    this.resize();

    this.lastTime = this.time;
  }

  resize() {
    this.width  = window.innerWidth;
    this.height = window.innerHeight;
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize( this.width, this.height);
    this.lastTime=this.time;
  }

  render(timeMS) {
    this.time = timeMS;
    if (this.time == 0) { this.lastTime = this.time; }

    if (this.isovistComputation) {
      this.isovistComputation.compute();
    }

    //if(this.time - this.lastTime < 500){
      this.renderer.render(this.scene, this.camera);
    //}
  }
}

window.LocusLucis = new LocusLucis();
