import * as THREE from 'three';
import { GUI } from '../node_modules/three/examples/jsm/libs/lil-gui.module.min.js';

class LocusLucis {
  constructor() {
    this.container = document.createElement( 'div' );
    document.body.appendChild( this.container );

    this.scene = new THREE.Scene();
    this.scene.name = 'Scene';

    this.width  = window.innerWidth;
    this.height = window.innerHeight;

    this.camera = new THREE.PerspectiveCamera( 35, this.width / this.height, 1.0, 2000.0 );
    this.camera.position.set( 0, 0, 100 );
    this.scene.add(this.camera);

    this.time = 0;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, transparent: true, alpha: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(this.width, this.height);
    this.renderer.setAnimationLoop(this.render.bind(this));
    this.renderer.setClearAlpha(0.0);
    this.renderer.setClearColor(new THREE.Color(0.0, 0.0, 0.0), 0.0);
    this.renderer.domElement.style.position = 'fixed';
    this.renderer.domElement.style.zIndex   = '-1000';
    this.container.appendChild(this.renderer.domElement);

    this.boxes = [];
    for (let i = 0; i < 32; i++){
      this.boxes.push(new THREE.Vector4(Math.random()      , Math.random()      ,
                                        Math.random() * 0.1, Math.random() * 0.1));
    }

    this.uniforms = {
      lineResolution        : { value: 512 },
      angularResolution     : { value: 512 },
      stepDistance          : { value: 0.008 },
      sunDirection          : { value: 2.0 },
      emissivity            : { value: 1.00 },
      outputResolutionScale : { value: 1.0 },
      outputResolutionScale : { value: 1.0 },
      boxes                 : { value: this.boxes },
    }

    this.gui = new GUI()
    this.gui.add(this.uniforms.         sunDirection, 'value',   0.1,    6.2      ).name('Sun Direction');
    //this.gui.add(this.uniforms.           emissivity, 'value',   1.0,    5.0      ).name('Emissivity');
    //this.gui.add(this.uniforms.       lineResolution, 'value',  64.0, 1024.0, 64.0).name('Line Resolution');
      //.onChange(() => { this.createRadiositySystem(this.uniforms.lineResolution, this.uniforms.angularResolution); });
    this.gui.add(this.uniforms.    angularResolution, 'value',  64.0, 1024.0, 64.0).name('Angular Resolution');
      //.onChange(() => { this.createRadiositySystem(this.uniforms.lineResolution, this.uniforms.angularResolution); });
    //this.gui.add(this.uniforms.         stepDistance, 'value',   0.001,  0.01     ).name('Step Distance');
    this.gui.add(this.uniforms.outputResolutionScale, 'value',   0.1  ,  1.0      ).name('Resolution Scale')
      .onChange(() => { this.renderer.setPixelRatio(window.devicePixelRatio * this.uniforms.outputResolutionScale.value); });
    this.gui.open();

    this.createRadiositySystem(this.uniforms.angularResolution);

    window.addEventListener('resize', this.resize.bind(this));
    this.resize();

    this.lastTime = this.time;
  }

  createRadiositySystem(angularResolution) {
    if (this.isovistComputation) {
      this.scene.remove(this.reprojectionMesh);
      this.reprojectionMaterial.dispose();
    }

    this.reprojectionMaterial = new THREE.ShaderMaterial( {
      side: THREE.FrontSide,
      dithering: true,
      //transparent: true,
      uniforms: this.uniforms,
      vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            //gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
            gl_Position = vec4( ( uv - 0.5 ) * 2.0, 0.0, 1.0 );
        }`,
      fragmentShader: `
        uniform float angularResolution, sunDirection;
        uniform vec4 boxes[16];
        varying vec2 vUv;

        bool boxIntersection( in vec2 ro, in vec2 rd, in vec2 rad ) {
          vec2 m   = 1.0/rd;
          vec2 n   = m*ro;
          vec2 k   = abs(m)*rad;
          vec2 t1  = -n - k;
          vec2 t2  = -n + k;
          float tN = max( t1.x, t1.y );
          float tF = min( t2.x, t2.y );
          if( tN>tF || tF<0.0) return false;
          return true;
        }

        float rand( const in vec2 uv ) {
          const float a = 12.9898, b = 78.233, c = 43758.5453;
          float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, 3.141592 );
          return fract( sin( sn ) * c );
        }

        #include <dithering_pars_fragment>

        void main() {
          gl_FragColor.a = 1.0;
          float increment = 6.28318530718/angularResolution;
          for (float angle = rand(vUv) * increment; angle < 6.28318530718; angle += increment) {
            vec2 rayDirection = vec2(cos(angle), 
                                     sin(angle));

            bool rayGoesToSky = true;
            for(int b = 0; b < 16; b++){
              vec4 box = boxes[b];
              if (boxIntersection(vUv - box.xy, rayDirection, box.zw)){
                rayGoesToSky = false;
                break;
              }
            }

            if (rayGoesToSky){
              // Add the Sky Lighting Contribution; From: https://www.shadertoy.com/view/NttSW7
              const vec3 SkyColor = vec3(0.2,0.5,1.);
              const vec3 SunColor = vec3(1.,0.7,0.1)*10.;
              float SunA = sunDirection;//2.; //Sun-angle position
              const float SunS = 64.; //Sun-size, higher is smaller
              vec3 SI = SkyColor.xyz*(1.+0.5*sin(angle));
              float angleDiff = (angle-SunA); angleDiff *= angleDiff;
              SI += SunColor/(1.0+SunS*angleDiff);
              gl_FragColor.rgb += SI;
            }
          }

          gl_FragColor.rgb /= angularResolution;
          gl_FragColor.rgb = pow(1.-exp(-1.2*gl_FragColor.rgb),vec3(0.45));

          // three.js postprocessing to acount for color spaces
          #include <tonemapping_fragment>
          #include <encodings_fragment>
          #include <dithering_fragment>
        }`
    });
  
    this.reprojectionMesh = new THREE.Mesh( new THREE.PlaneGeometry( 50, 50 ), this.reprojectionMaterial );
    this.reprojectionMesh.position.set(-25, 0, 0);
    this.reprojectionMesh.scale   .set(1, 1, 1);
    this.scene.add(this.reprojectionMesh);
    //console.log(this.reprojectionMesh);
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
    //this.time = timeMS;
    //if (this.time == 0) { this.lastTime = this.time; }


    //if(this.time - this.lastTime < 500){
      this.renderer.render(this.scene, this.camera);
    //}
  }
}

window.LocusLucis = new LocusLucis();
