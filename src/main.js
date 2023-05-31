import * as THREE from 'three';
import { GUI                 } from '../node_modules/three/examples/jsm/libs/lil-gui.module.min.js';
class LocusLucis {
  constructor() {
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
    this.renderer.setPixelRatio( window.devicePixelRatio );
    this.renderer.setSize(this.width, this.height);
    this.renderer.setAnimationLoop(this.render.bind(this));
    this.renderer.setClearAlpha(0.0);
    this.renderer.setClearColor(new THREE.Color(1, 1, 1), 0.0);
    this.renderer.domElement.style.position = 'fixed';
    this.renderer.domElement.style.zIndex   = '-1000';
    this.container.appendChild(this.renderer.domElement);

    window.addEventListener('resize', this.resize.bind(this));
    //window.addEventListener('pointerdown', ()=>{ this.lastTime=this.time; });
    //window.addEventListener('pointerup', ()=>{ this.lastTime=this.time; });
    //window.addEventListener('pointermove', ()=>{ this.lastTime=this.time; });
    //window.addEventListener('wheel', ()=>{ this.lastTime=this.time; });
    this.resize();

    fetch('./assets/Lighting.glsl')
      .then(data => data.text())
      .then(shaderText => {
        console.log("Loaded Lighting Shader!");
        this.line_geometry = [
          //new THREE.Vector4(0.1 ,0.1 ,0.9  ,0.3 ), //Floor
          //new THREE.Vector4(0.1 ,0.1 ,0.05 ,0.95), //Vertical wall
          //new THREE.Vector4(0.05,0.95,0.4  ,0.8 ), //Small ceiling
          //new THREE.Vector4(0.5 ,0.77,0.9  ,0.4 ), //Ceiling higher up
          new THREE.Vector4(0.45 ,0.40 , 0.45 ,0.60),
          new THREE.Vector4(0.45 ,0.40 , 0.55 ,0.40), 
          new THREE.Vector4(0.55 ,0.60 , 0.55 ,0.40), 
          new THREE.Vector4(0.55 ,0.60 , 0.45 ,0.60), 
          new THREE.Vector4(0.25 ,0.75 , 0.25 ,0.5 ), //Wall in front of emissive
          new THREE.Vector4(0.725 ,0.8  , 0.75,0.65), //Emissive red
        ];

        this.uniforms = {
          lines                     : { value: this.line_geometry       },
          rejectionAngle            : { value: 0.8                      },
          maxSteps                  : { value: 50.0                     }
        }
        this.gui = new GUI()
        this.gui.add(this.uniforms.rejectionAngle, 'value', -1.0,   1.0).name('Rejection Angle');
        this.gui.add(this.uniforms.maxSteps      , 'value', 20.0, 150.0).name('Quality');
        this.gui.open();

        this.reprojectionMaterial = new THREE.ShaderMaterial( {
          side: THREE.FrontSide,
          //dithering: true,
          //transparent: true,
          uniforms: this.uniforms,
          vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                //gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
                gl_Position = vec4( ( uv - 0.5 ) * 2.0, 0.0, 1.0 );
            }`,
          fragmentShader: shaderText
        });

        this.reprojectionMaterial.dithering = true;

        this.reprojectionMesh = new THREE.Mesh( new THREE.PlaneGeometry( 50, 50 ), this.reprojectionMaterial );
        this.reprojectionMesh.position.set(0, 0, 0);
        this.reprojectionMesh.scale   .set(1, 1, 1);
        this.scene.add(this.reprojectionMesh);
    });

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

    if (this.line_geometry) {
      this.line_geometry[4].x = 0.25 + 0.05 * Math.sin(this.time * 0.001);
      //this.line_geometry[5].x = 0.725 + 0.05 * Math.sin(this.time * 0.001);
      //this.line_geometry[5].z = 0.750 + 0.05 * Math.sin(this.time * 0.001);

      let elem = document.querySelector("img");
      let rect = elem.getBoundingClientRect();
      // Left Side
      this.line_geometry[0].x =        rect.  left / this.width;
      this.line_geometry[0].y = 1.0 - (rect.bottom / this.height);
      this.line_geometry[0].z =        rect.  left / this.width;
      this.line_geometry[0].w = 1.0 - (rect.top / this.height);

      // Bottom Side
      this.line_geometry[1].x =        rect.  left / this.width;
      this.line_geometry[1].y = 1.0 - (rect.bottom / this.height);
      this.line_geometry[1].z =        rect. right / this.width;
      this.line_geometry[1].w = 1.0 - (rect.bottom / this.height);

      // Right Side
      this.line_geometry[2].x =        rect. right / this.width;
      this.line_geometry[2].y = 1.0 - (rect.   top / this.height);
      this.line_geometry[2].z =        rect. right / this.width;
      this.line_geometry[2].w = 1.0 - (rect.bottom / this.height);

      // Top Side
      this.line_geometry[3].x =        rect. right / this.width;
      this.line_geometry[3].y = 1.0 - (rect.   top / this.height);
      this.line_geometry[3].z =        rect.  left / this.width;
      this.line_geometry[3].w = 1.0 - (rect.   top / this.height);
    }

    //if(this.time - this.lastTime < 500){
      this.renderer.render(this.scene, this.camera);
    //}
  }
}

window.LocusLucis = new LocusLucis();
