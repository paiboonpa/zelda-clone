import * as THREE from 'three';
import { Reflector } from 'https://unpkg.com/three@0.160.0/examples/jsm/objects/Reflector.js';

const waveGLSL=`
  float waterHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float waterNoise(vec2 p){
    vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
    return mix(mix(waterHash(i),waterHash(i+vec2(1.,0.)),f.x),mix(waterHash(i+vec2(0.,1.)),waterHash(i+vec2(1.,1.)),f.x),f.y);
  }
  float riverWave(vec2 p){
    float warp=waterNoise(p*.7)*3.0;
    return sin(p.x*1.7+p.y*4.1+warp)*.006+sin(p.x*4.2-p.y*2.9+waterNoise(p*1.4)*2.0)*.004;
  }
`;

// One planar reflection pass per visible river; wave normals distort that image.
export function makeFlowingWater(width,depth,{color='#527c7c',sunDirection,sunColor,curve,x=0,z=0,level=0,heightAt}={}){
  let geometry=new THREE.PlaneGeometry(width,depth,Math.ceil(width*2),Math.ceil(depth*4));
  if(curve){const p=geometry.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,p.getY(i)-(curve(p.getX(i)+x)-z));geometry.computeVertexNormals();}
  if(heightAt){
    // Clip each triangle to the waterline on the rendered terrain, rather than
    // leaving a rectangular sheet with exposed edges hanging over low ground.
    const p=geometry.attributes.position,indices=geometry.index.array,positions=[],depths=[];
    const point=i=>[p.getX(i),p.getY(i),level-heightAt(p.getX(i)+x,z-p.getY(i))];
    for(let i=0;i<indices.length;i+=3){
      const triangle=[point(indices[i]),point(indices[i+1]),point(indices[i+2])],polygon=[];
      for(let j=0;j<3;j++){
        const a=triangle[j],b=triangle[(j+1)%3],inside=a[2]>=.02,nextInside=b[2]>=.02;
        if(inside)polygon.push(a);
        if(inside!==nextInside){const t=(.02-a[2])/(b[2]-a[2]);polygon.push(a.map((v,k)=>v+(b[k]-v)*t));}
      }
      for(let j=1;j<polygon.length-1;j++)for(const v of [polygon[0],polygon[j],polygon[j+1]]){positions.push(v[0],v[1],0);depths.push(v[2]);}
    }
    geometry.dispose();geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('waterDepth',new THREE.Float32BufferAttribute(depths,1));geometry.computeVertexNormals();
  }
  else geometry.setAttribute('waterDepth',new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count).fill(1),1));
  const shader={
    name:'Flowing river reflection',
    uniforms:THREE.UniformsUtils.merge([THREE.UniformsLib.lights,THREE.UniformsLib.fog,{
      color:{value:new THREE.Color(color)},tDiffuse:{value:null},textureMatrix:{value:new THREE.Matrix4()},time:{value:0},sunDirection:{value:sunDirection.clone().normalize()},sunColor:{value:new THREE.Color(sunColor)},
    }]),
    vertexShader:`
      uniform mat4 textureMatrix;uniform float time;
      attribute float waterDepth;varying float vDepth;
      varying vec4 vMirror;varying vec3 vWorld;
      #include <common>
      #include <fog_pars_vertex>
      #include <shadowmap_pars_vertex>
      ${waveGLSL}
      void main(){
        vec3 transformed=position;vec4 worldPosition=modelMatrix*vec4(position,1.0);
        vec2 p=worldPosition.xz-vec2(time*.65,0.0);
        vDepth=waterDepth;
        transformed.z+=riverWave(p)*smoothstep(.04,.35,waterDepth);
        worldPosition=modelMatrix*vec4(transformed,1.0);vWorld=worldPosition.xyz;
        vMirror=textureMatrix*vec4(transformed,1.0);
        vec4 mvPosition=modelViewMatrix*vec4(transformed,1.0);gl_Position=projectionMatrix*mvPosition;
        #include <beginnormal_vertex>
        #include <defaultnormal_vertex>
        #include <shadowmap_vertex>
        #include <fog_vertex>
      }`,
    fragmentShader:`
      uniform vec3 color;uniform sampler2D tDiffuse;uniform float time;uniform vec3 sunDirection;uniform vec3 sunColor;
      varying vec4 vMirror;varying vec3 vWorld;varying float vDepth;
      #include <common>
      #include <packing>
      #include <bsdfs>
      #include <lights_pars_begin>
      #include <shadowmap_pars_fragment>
      #include <shadowmask_pars_fragment>
      #include <fog_pars_fragment>
      ${waveGLSL}
      void main(){
        vec2 p=vWorld.xz-vec2(time*.65,0.0);
        float h=riverWave(p);
        vec2 slope=vec2(riverWave(p+vec2(.04,0.0))-h,riverWave(p+vec2(0.0,.04))-h)/.04;
        vec3 n=normalize(vec3(-slope.x,1.0,-slope.y)),view=normalize(cameraPosition-vWorld);
        float fresnel=.08+.35*pow(1.0-max(dot(n,view),0.0),4.0);
        vec2 uv=vMirror.xy/vMirror.w+slope*.06;
        vec3 reflected=texture2D(tDiffuse,clamp(uv,.004,.996)).rgb*.4;
        reflected+=(texture2D(tDiffuse,clamp(uv+vec2(.003,0.),.001,.999)).rgb+texture2D(tDiffuse,clamp(uv-vec2(.003,0.),.001,.999)).rgb+texture2D(tDiffuse,clamp(uv+vec2(0.,.003),.001,.999)).rgb+texture2D(tDiffuse,clamp(uv-vec2(0.,.003),.001,.999)).rgb)*.15;
        float shadow=getShadowMask();
        vec3 base=color*(.65+.25*max(dot(n,sunDirection),0.0));
        float spec=pow(max(dot(n,normalize(view+sunDirection)),0.0),140.0)*shadow;
        vec3 water=mix(base,reflected,fresnel)*( .55+.45*shadow)+sunColor*spec*.35;
        // Blend over the already rendered riverbed and submerged character.
        // Deeper water obscures more detail; grazing views keep stronger reflections.
        float opacity=clamp(.68+.18*(1.0-exp(-vDepth*.8))+fresnel*.14,0.0,.94);
        gl_FragColor=vec4(water,opacity*smoothstep(.02,.22,vDepth));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  };
  const water=new Reflector(geometry,{textureWidth:512,textureHeight:512,multisample:0,clipBias:.003,shader,color});
  water.name='Flowing reflective river';water.material.lights=true;water.material.fog=true;water.material.transparent=true;water.material.depthWrite=false;
  water.receiveShadow=true;water.rotation.x=-Math.PI/2;
  water.userData.update=time=>{water.material.uniforms.time.value=time;};
  return water;
}
