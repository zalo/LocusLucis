// Based entirely on this shader by @mathis
// https://www.shadertoy.com/view/NttSW7

//Settings
const vec3 SkyColor = vec3(0.2,0.5,1.);
const vec3 SunColor = vec3(1.,0.7,0.1)*10.;
const float SunA = 2.; //Sun-angle position
const float SunS = 64.; //Sun-size, higher is smaller
const vec3 EmissiveColor = vec3(1.,0.9,0.9)*4.;
#define Sun
#define InteractRadius iChannelResolution[0].y*0.05

//Other vars
#define NObjects 6
#define NVA 18
const float PI = 3.141592653;
const float PI2 = PI*2.;
const float IPI2 = 0.5/PI;
const float SSunS = sqrt(SunS);
const float ISSunS = 1./SSunS;
#define RES      iChannelResolution[0].xy
#define IRES (1./iChannelResolution[0].xy)

struct GeometryIntegral { float startAngle; float endAngle; vec4 p; vec3 E; };

float LineDF(vec2 p, vec2 a, vec2 b) {
    //Distance Field
    vec2 ba = b-a;
    float k = dot(p-a,ba)/dot(ba,ba);
    return length((a+clamp(k,0.,1.)*(b-a))-p);
}

float PlaneDF(vec2 p, vec2 a, vec2 b) {
    //Distance Field
    vec2 ba = b-a;
    vec2 lnorm = normalize(vec2(-ba.y,ba.x));
    return abs(dot(p-a,lnorm));
}

vec2 LineXI(vec2 uv, vec2 a, vec2 b) {
    //Intersection of the line from UV with dir vec2(1.,0.)
    vec2 dir = b-a;
    vec2 rp = a-uv;
    return a+dir*(-rp.y/dir.y);
}

float LineRI(vec2 uv, vec2 dir, vec4 ab) {
    //Intersection of the line
    vec2 ltan = ab.zw-ab.xy;
    vec2 lnorm = vec2(-ltan.y,ltan.x);
    return -dot(uv-ab.xy,lnorm)/dot(dir,lnorm);
}

void Sort(int CIndex, inout GeometryIntegral OUT[NVA], GeometryIntegral CG) {
    //Sort geometry MAP a0
    GeometryIntegral SI[NVA] = OUT; float Sample;
    for (int L=0; L<=CIndex; L++) {
        Sample = SI[L].startAngle;
        if (CG.startAngle<=Sample || Sample<0.) {
            for (int S=CIndex; S>=L; S=S-1) {
                SI[S+1] = SI[S];
            }
            SI[L] = CG;
            break;
        }
    }
    OUT = SI;
}

void DivideIntegral(vec2 UV, inout GeometryIntegral SI[NVA], vec4[6] lines){
    //Divide the rendering integral into smaller integrals
    int CIndex = 0; vec2 a; vec3 Emissive = vec3(0.); vec4 linep;
    for (int o=0; o<NObjects; o++) {
        if (o==5) Emissive = EmissiveColor; else Emissive = vec3(0.);
        linep = lines[o];//vec4(0.1, 0.1, 0.8, 0.8);//texture(Channel0,vec2(1.5+o,0.5)*ires);
        a = vec2(atan(UV.y-linep.y,UV.x-linep.x)+PI,
                 atan(UV.y-linep.w,UV.x-linep.z)+PI);
        if (a.x>a.y) { a = a.yx; linep = linep.zwxy; } //Order the points of the line
        if (a.y-a.x>PI) {
            //The geometry crosses the 2PI - 0 angle
            vec2 InterP = LineXI(UV,linep.xy,linep.zw);
            Sort(CIndex,SI,GeometryIntegral(0.,a.x,vec4(InterP,linep.xy),Emissive));
            Sort(CIndex+1,SI,GeometryIntegral(a.y,PI2,vec4(linep.zw,InterP),Emissive));
            CIndex += 2;
        } else {
            //Normal angles
            Sort(CIndex,SI,GeometryIntegral(a.x,a.y,linep,Emissive));
            CIndex += 1;
        }
    }
    //Gathering approach: sorting visible geometry
    int OUTIndex = 0; float Sample; vec2 PIP; GeometryIntegral CG,tmpCG,sg; GeometryIntegral OUT[NVA] = SI;
    for (int i=0; i<CIndex; i++) { //For each visible geometry
        CG=OUT[i];
        if (CG.startAngle<-1.5) continue;
        else if (CG.startAngle<-0.5) break;
        for (int o=i+1; o<CIndex; o++) { //For each object (in front of CG in the ordered list)
            sg=OUT[o];
            if (sg.startAngle<-0.5 || sg.startAngle>=CG.endAngle) break; //We have reached the end
            //We assume no plane intersection
            vec2 LTan=sg.p.xy-sg.p.zw;
            vec2 LNorm=vec2(LTan.y,-LTan.x);
            LNorm=LNorm*sign(dot(UV-sg.p.xy,LNorm));
            float CompDot=dot(CG.p.xy-sg.p.xy,LNorm);
            if (sign(CompDot)!=sign(dot(CG.p.zw-sg.p.xy,LNorm))) {
                //Test sg against CG instead
                LTan=CG.p.xy-CG.p.zw;
                LNorm=vec2(LTan.y,-LTan.x);
                LNorm=LNorm*sign(dot(UV-CG.p.xy,LNorm));
                CompDot=-dot(sg.p.xy-CG.p.xy,LNorm);
            }
            if (CompDot>=0.) {
                //CG in front of sg
                if (sg.endAngle<=CG.endAngle && sg.startAngle>=CG.startAngle) {
                    //CG covers sg
                    OUT[o]=GeometryIntegral(-2.,0.,vec4(0.),vec3(0.));
                } else {
                    //CG covers lower part of sg
                    PIP=UV+(CG.p.zw-UV)*LineRI(UV,CG.p.zw-UV,sg.p);
                    OUT[o]=GeometryIntegral(-2.,0.,vec4(0.),vec3(0.));
                    tmpCG=GeometryIntegral(CG.endAngle,sg.endAngle,vec4(PIP,sg.p.zw),sg.E);
                    for (int L=i+1; L<=NVA; L++) {
                        Sample=OUT[L].startAngle;
                        if (Sample<-1.5) continue;
                        else if (tmpCG.startAngle<=Sample || Sample<-0.5) {
                            for (int S=NVA-2; S>=L; S=S-1) {
                                OUT[S+1]=OUT[S];
                            }
                            OUT[L]=tmpCG;
                            CIndex+=1;
                            break;
                        }
                    }
                }
            } else {
                //CG behind sg
                if (CG.endAngle<=sg.endAngle && CG.startAngle==sg.startAngle) {
                    //CG blocked
                    CG=sg;
                    OUT[o]=GeometryIntegral(-2.,0.,vec4(0.),vec3(0.));
                } else if (sg.endAngle<CG.endAngle && CG.startAngle==sg.startAngle) {
                    //sg covers lower delen av CG
                    PIP=UV+(sg.p.zw-UV)*LineRI(UV,sg.p.zw-UV,CG.p);
                    OUT[o]=GeometryIntegral(-2.,0.,vec4(0.),vec3(0.));
                    tmpCG=GeometryIntegral(sg.endAngle,CG.endAngle,vec4(PIP,CG.p.zw),CG.E);
                    for (int L=i+1; L<=NVA; L++) {
                        Sample=OUT[L].startAngle;
                        if (Sample<-1.5) continue;
                        else if (tmpCG.startAngle<=Sample || Sample<-0.5) {
                            for (int S=NVA-2; S>=L; S=S-1) {
                                OUT[S+1]=OUT[S];
                            }
                            OUT[L]=tmpCG;
                            CIndex+=1;
                            break;
                        }
                    }
                    CG=sg;
                }
                if (CG.startAngle<sg.startAngle) {
                    if (sg.endAngle<CG.endAngle) {
                        //sg covers the middle part of CG
                        PIP=UV+(sg.p.zw-UV)*LineRI(UV,sg.p.zw-UV,CG.p);
                        tmpCG=GeometryIntegral(sg.endAngle,CG.endAngle,vec4(PIP,CG.p.zw),CG.E);
                        PIP=UV+(sg.p.xy-UV)*LineRI(UV,sg.p.xy-UV,CG.p);
                        CG=GeometryIntegral(CG.startAngle,sg.startAngle,vec4(CG.p.xy,PIP),CG.E);
                        for (int L=i+1; L<=NVA; L++) {
                            Sample=OUT[L].startAngle;
                            if (Sample<-1.5) continue;
                            else if (tmpCG.startAngle<=Sample || Sample<-0.5) {
                                for (int S=NVA-2; S>=L; S=S-1) {
                                    OUT[S+1]=OUT[S];
                                }
                                OUT[L] = tmpCG;
                                CIndex += 1;
                                break;
                            }
                        }
                    } else {
                        //sg covers upper part of CG
                        PIP = UV+(sg.p.xy-UV)*LineRI(UV,sg.p.xy-UV,CG.p);
                        CG = GeometryIntegral(CG.startAngle,sg.startAngle,vec4(CG.p.xy,PIP),CG.E);
                    }
                }
            }
        }
        OUT[OUTIndex] = CG;
        OUTIndex += 1;
    }
    for (int L=OUTIndex; L<=NVA; L++) {
        OUT[L] = GeometryIntegral(-1.,0.,vec4(0.),vec3(0.));
    }
    SI=OUT;
}

vec4 RenderGeometry(vec2 UV, vec4[6] lines){
    float SDF = 10.;
    float ssdf; vec3 E = vec3(0.); vec4 linep;
    for (int i=0; i<NObjects; i++) {
        linep = lines[i];//vec4(0.1, 0.1, 0.8, 0.8); //texture(ch0,vec2(1.5+i,0.5)*ires);
        ssdf = LineDF(UV,linep.xy,linep.zw);
        if (ssdf<SDF) {
            SDF = ssdf;
            if (i==5) E = EmissiveColor; else E = vec3(0.);
        }
    }
    float W = 1.-clamp(0.,1.,SDF+0.02);
    return vec4(E*W,W);
}

vec3 SkyIntegral(float a0, float a1) {
    //Integrates the sky
        //Integrand: SkyColor.xyz*(1.+0.5*sin(a))
        //Integral: SkyColor.xyz*(a-0.5*cos(a))
    vec3 SI = SkyColor*(a1-a0-0.5*(cos(a1)-cos(a0)));
    #ifdef Sun
        //Integrand: SunColor/(1+SunS*(a-SunA)^2)
        //Integral: SunColor.xyz*(-atan(sqrt(SunS)*(SunA-a)))/sqrt(SunS)
    SI += SunColor*(atan(SSunS*(SunA-a0))-atan(SSunS*(SunA-a1)))*ISSunS;
    #endif
    return SI;
}

vec3 Integrate(GeometryIntegral SI[NVA]) {
    //Compute the rendering integral from a sorted list of smaller integrals
    vec3 Light = vec3(0.);
    float BiggestAngle = 0.;
    GeometryIntegral Sample = SI[0];
    //Iterate over geometry
    for (int i=0; i<NVA; i++) {
        Sample = SI[i];
        if (Sample.startAngle<-0.5) break;
        Light += SkyIntegral(BiggestAngle,Sample.startAngle); //Integrate between geometry
        Light += Sample.E*(Sample.endAngle-Sample.startAngle); //Integrate geometry
        BiggestAngle = Sample.endAngle;
    }
    //Last sky-integral from geometry-angle to 2PI
    Light += SkyIntegral(BiggestAngle,PI2);
    //Return
    return Light*IPI2;
}

uniform float rejectionAngle, maxSteps;
uniform vec4[6] lines;
varying vec2 vUv;

#include <common>
#include <dithering_pars_fragment>

void main() {
  gl_FragColor = vec4(vUv.x, vUv.y, 0.0, 1.0);

  vec2 fragCoord = vUv;//gl_FragCoord.xy;
  vec3 Color = vec3(0.);
  // Initialize the list
  GeometryIntegral NEI = GeometryIntegral(-1.,0.,vec4(0.),vec3(0.));
  GeometryIntegral SmallerIntegrals[NVA] = GeometryIntegral[NVA](NEI,NEI,NEI,NEI,NEI,NEI,NEI,NEI,NEI,NEI,NEI,NEI,NEI,NEI,NEI,NEI,NEI,NEI);
  // Divide the rendering integral into smaller continous integrals
  DivideIntegral(fragCoord,SmallerIntegrals, lines);//,iChannel0,IRES);
  // Integrate
  Color = Integrate(SmallerIntegrals);
  // Render geometry
  //vec4 GeoC = RenderGeometry(fragCoord, lines);//,iChannel0,IRES);
  //Color = mix(Color,GeoC.xyz,GeoC.w);
  // Return
  gl_FragColor = vec4(pow(1.-exp(-1.2*Color),vec3(0.45)),1.);

  // three.js postprocessing to acount for color spaces
  #include <tonemapping_fragment>
  #include <encodings_fragment>
  #include <dithering_fragment>
}