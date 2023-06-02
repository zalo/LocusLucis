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

    this.camera = new THREE.PerspectiveCamera( 35, this.width / this.height, 1.0, 2000.0 );
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

      this.uniforms = {
        //map                   : { value: /*this.testTexture*/ null },
        lineResolution        : { value: 512 },
        angularResolution     : { value: 512 },
        stepDistance          : { value: 0.005 },
        stepDirection         : { value: 0.00 },
        sampleBias            : { value: 0.003 },
        outputResolutionScale : { value: 1.0 },
      }
  
      this.gui = new GUI()
      //this.gui.add(this.uniforms.       lineResolution, 'value', 0.1  , 1.0 ).name('Line Resolution');
      //this.gui.add(this.uniforms.    angularResolution, 'value', 0.1  , 1.0 ).name('Angular Resolution');
      this.gui.add(this.uniforms.         stepDistance, 'value', 0.001, 0.01).name('Step Distance');
      this.gui.add(this.uniforms.        stepDirection, 'value', 0.0,   6.28318530718).name('Step Direction');
      this.gui.add(this.uniforms.           sampleBias, 'value', -0.01, 0.01).name('Bias');
      this.gui.add(this.uniforms.outputResolutionScale, 'value', 0.1  , 1.0 ).name('Quality')
        .onChange(() => { this.renderer.setPixelRatio(window.devicePixelRatio * this.uniforms.outputResolutionScale.value); });
      this.gui.open();
  
      this.isovistComputation = new MultiTargetGPUComputationRenderer(
                                  this.uniforms.lineResolution.value, this.uniforms.angularResolution.value, this.renderer);
      this.isovist = this.isovistComputation.addVariable("textureIsovist");
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
            return vec2( tN, tF );//vec2( -0.5, 0.5 );//
        }

        void isovistUVToLinePosDir(in vec2 uv, out vec2 boxIntersections, out vec2 direction, out vec2 lineUV) {
          float angularCoordinate = uv.y * 6.28318530718;

          // Calculate where on the line we are
          vec2 lineDirection      = vec2(cos(angularCoordinate + 1.57079632679), 
                                         sin(angularCoordinate + 1.57079632679));
          vec2 lineBoxIntersects  = boxIntersection(vec2(0.0, 0.0), lineDirection, vec2(0.5, 0.5));
          lineUV                  =  (lineDirection * mix(lineBoxIntersects.x, lineBoxIntersects.y, uv.x));
          //lineUV = vec2(round(lineUV.x * 512.0) / 512.0,
          //              round(lineUV.y * 512.0) / 512.0);

          // Calculate where we are sweeping from and to
          direction               = vec2(cos(angularCoordinate), 
                                         sin(angularCoordinate));
          boxIntersections        = boxIntersection(lineUV, direction, vec2(0.5, 0.5));
        }

        void main() {
          vec2 boxIntersections, direction, lineUV;
          isovistUVToLinePosDir(gl_FragCoord.xy / resolution.xy, boxIntersections, direction, lineUV);

          // Record the first four hits along this line
          vec4 lastColor   = vec4(1.0, 1.0, 1.0, 1.0);
          vec4 colorToDraw = vec4(-1000.0, -1000.0, -1000.0, -1000.0);
          for(float i = boxIntersections.x; i < boxIntersections.y; i += stepDistance) {
            vec2 samplePosition = vec2(0.5, 0.5) + lineUV + (direction * i);
            //samplePosition = vec2(round(samplePosition.x * 512.0) / 512.0,
            //                      round(samplePosition.y * 512.0) / 512.0);
            vec4 sampledColor = texture2D(map, samplePosition);
            if(lastColor == vec4(1.0, 1.0, 1.0, 1.0) && sampledColor.g < 1.0){// ||
               //lastColor != vec4(1.0, 1.0, 1.0, 1.0) && sampledColor == vec4(1.0, 1.0, 1.0, 1.0) ) {
              // Record this hit position in successive color channels
                     if (colorToDraw.x == -1000.0) { colorToDraw.r = i;
              } else if (colorToDraw.y == -1000.0) { colorToDraw.g = i;
              } else if (colorToDraw.z == -1000.0) { colorToDraw.b = i;
              } else if (colorToDraw.w == -1000.0) { colorToDraw.a = i;
                break;
              }
            }
            lastColor = sampledColor;
          }

          pc_fragColor = colorToDraw + 0.5;
        }`);
      Object.assign(this.isovistPass.material.uniforms, this.uniforms);
      this.isovistPass.material.uniforms["map"] = { value: this.testTexture };
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
      this.labelMesh.position.set(25, 0, 0);
      this.labelMesh.scale   .set(1, 1, 1);
      this.scene.add(this.labelMesh);

      this.uniforms["isovist"] = { value: null };
      this.uniforms["map"]     = { value: this.testTexture };

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
          uniform sampler2D isovist, map;
          uniform float lineResolution, angularResolution, stepDistance, stepDirection, outputResolutionScale, sampleBias;
          varying vec2 vUv;

          vec2 boxIntersection( in vec2 ro, in vec2 rd, in vec2 rad ) {
            vec2 m = 1.0/rd;
            vec2 n = m*ro;
            vec2 k = abs(m)*rad;
            vec2 t1 = -n - k;
            vec2 t2 = -n + k;
            float tN = max( t1.x, t1.y );
            float tF = min( t2.x, t2.y );
            return vec2( tN, tF );//vec2( -0.5, 0.5 );//
          }

          float invMix(float from, float to, float value){
            return (value - from) / (to - from);
          }
  
          void mapUVToIsovistUVT(in vec2 uv, in float angle, out vec2 lineUV, out vec2 direction,  out vec2 isovistUV, out float isovistT) {
            vec2 lineDirection      = vec2(cos(angle + 1.57079632679), 
                                           sin(angle + 1.57079632679));
            // Project the current uv onto the line direction to get lineUV (which is in box-centered space)
            float lineT             = dot(uv - vec2(0.5, 0.5), lineDirection);
            lineT                   = round(lineT * lineResolution) / lineResolution;
            lineUV                  = lineDirection * lineT;
            lineUV = vec2(round(lineUV.x * 512.0) / 512.0,
                          round(lineUV.y * 512.0) / 512.0);

            // Calculate the from/to of the sweep
            direction               = vec2(cos(angle),
                                           sin(angle));
            vec2 boxIntersections   = boxIntersection(lineUV, direction, vec2(0.5, 0.5));

            vec2 lineBoxIntersects  = boxIntersection(vec2(0.0, 0.0), lineDirection, vec2(0.5, 0.5));
            isovistUV = vec2(invMix(lineBoxIntersects.x, lineBoxIntersects.y, lineT), angle/6.28318530718);
            //isovistUV = vec2(round(isovistUV.x *    lineResolution)/   lineResolution, 
            //                 round(isovistUV.y * angularResolution)/angularResolution);

            // Calculate the current i
            isovistT  = dot(uv - vec2(0.5, 0.5), direction);
          }

          void main() {
            gl_FragColor = texture2D(map, vUv);

            if(gl_FragColor == vec4(1.0)){
              float increment = 6.28318530718/angularResolution;
              for (float angle = 0.0; angle < 6.28318530718; angle += increment) {
                vec2 isovistUV, lineUV, direction;
                float isovistT;
                mapUVToIsovistUVT(vUv, angle, lineUV, direction, isovistUV, isovistT);
                vec4 isovistDepths = texture2D(isovist, isovistUV) - 0.5;

                float depthToSample = 0.0;
                      if (isovistT < isovistDepths.r){ depthToSample = isovistDepths.r;
                }else if (isovistT < isovistDepths.g){ depthToSample = isovistDepths.g;
                }else if (isovistT < isovistDepths.b){ depthToSample = isovistDepths.b;
                }else if (isovistT < isovistDepths.a){ depthToSample = isovistDepths.a; }

                if (depthToSample != 0.0){
                  depthToSample += sampleBias;
                  vec2 samplePosition = vec2(0.5, 0.5) + lineUV + (direction * depthToSample);
                  //samplePosition = vec2(round(samplePosition.x * 512.0) / 512.0,
                  //                      round(samplePosition.y * 512.0) / 512.0);
                  gl_FragColor.rgb += texture2D(map, samplePosition).rgb;
                }else{
                  gl_FragColor.rgb += vec3(0.5);
                }
              }

              gl_FragColor.rgb /= angularResolution;
            }
          }`
      });
  
      this.reprojectionMesh = new THREE.Mesh( new THREE.PlaneGeometry( 50, 50 ), this.reprojectionMaterial );
      this.reprojectionMesh.position.set(-25, 0, 0);
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

      this.uniforms["isovist"].value = this.isovistComputation.getCurrentRenderTarget(this.isovist).texture;
    }

    //if(this.time - this.lastTime < 500){
      this.renderer.render(this.scene, this.camera);
    //}
  }
}

window.LocusLucis = new LocusLucis();
