import * as THREE from 'three';
import { forestMaterial, branchLeaves } from './environment-detail.js';

// Open, spreading tree authored against the supplied screenshot. All woody
// branches share one mesh; the separate leaf sprays share one instanced mesh.
const TAU=Math.PI*2,cache=new Map();
const random=(i,s)=>{const n=Math.sin(i*127.1+s*311.7)*43758.5453;return n-Math.floor(n);};
export function makeSpreadingTree(scale=1,seed=0){
  const variant=((Math.floor(seed)%6)+6)%6;
  if(!cache.has(variant))cache.set(variant,buildTree(variant));
  const source=cache.get(variant),root=new THREE.Group();
  const wood=new THREE.Mesh(source.geometry,forestMaterial('bark','#b9ac83'));
  wood.castShadow=wood.receiveShadow=true;root.add(wood);
  branchLeaves(root,source.sprays,variant);
  root.scale.setScalar(scale);root.name='Open spreading reference tree';root.userData.groundFit={height:1.1,embed:.07};return root;
}
function buildTree(seed){
  const positions=[],uvs=[],colors=[],indices=[],sprays=[];
  function branch(points,radii){
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),steps=Math.max(6,points.length*3),sides=radii[0]>.15?12:radii[0]>.04?8:5;
    const frames=curve.computeFrenetFrames(steps,false),offset=positions.length/3;
    for(let j=0;j<=steps;j++){
      const t=j/steps,p=curve.getPointAt(t),r=t*(radii.length-1),k=Math.min(radii.length-2,Math.floor(r));
      const radius=THREE.MathUtils.lerp(radii[k],radii[k+1],r-k);
      for(let i=0;i<=sides;i++){
        const a=i/sides*TAU,ridge=1+.045*Math.sin(a*5+t*8);
        const n=frames.normals[j].clone().multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[j],Math.sin(a));
        const v=p.clone().addScaledVector(n,radius*ridge);positions.push(v.x,v.y,v.z);uvs.push(i/sides,t*points.length*.4);
        const light=.8+Math.max(0,n.y)*.16;colors.push(light,light,light*.96);
        if(j&&i){const q=offset+j*(sides+1)+i;indices.push(q,q-1,q-sides-2,q,q-sides-2,q-sides-1);}
      }
    }
  }
  branch([[0,-.06,0],[-.10,.45,.02],[.08,1.1,0],[.03,1.65,-.06],[.18,2.25,-.06],[.05,3.1,0],[.18,3.85,-.1]], [.43,.32,.25,.22,.18,.11,.035]);
  // Broad buttress roots merge into the flared trunk.
  for(let i=0;i<5;i++){
    const a=i/5*TAU+.3;
    branch([[Math.cos(a)*.62,-.04,Math.sin(a)*.62],[Math.cos(a)*.32,.14,Math.sin(a)*.32],[0,.58,0]],[.045,.17,.21]);
  }
  // Lower limbs reach sideways; upper limbs lift and divide into an uneven crown.
  for(let i=0;i<9;i++){
    const a=i*2.39996+seed*.15,base=1.3+i*.24,reach=i<5?1.65+random(i,seed)*.55:1.1+random(i,seed)*.5;
    const dx=Math.cos(a),dz=Math.sin(a),start=[.06,base,0];
    const elbow=[dx*reach*.5,base+.25,dz*reach*.5];
    const end=[dx*reach,base+.85+random(i,5)*.4,dz*reach];
    branch([start,elbow,end],[.16-i*.008,.105-i*.004,.025]);
    sprays.push({center:[end[0]*.77,end[1]-.12,end[2]*.77],radii:[.5,.3,.5],count:18,size:.23});
    for(let j=0;j<3;j++){
      const turn=a+(j-1)*.58,r=.42+random(i*3+j,seed+9)*.4;
      const fork=[dx*reach*.78,base+.55,dz*reach*.78];
      const tip=[end[0]+Math.cos(turn)*r,end[1]+.3+j*.13,end[2]+Math.sin(turn)*r];
      branch([fork,[end[0],end[1]-.05,end[2]],tip],[.045,.026,.006]);
      sprays.push({center:[tip[0],tip[1]-.05,tip[2]],radii:[.7,.5,.65],count:36,size:.25});
      // Thin twigs remain visible through the gaps in the leaf sprays.
      const twig=[tip[0]+Math.cos(turn+.7)*.25,tip[1]+.28,tip[2]+Math.sin(turn+.7)*.25];
      branch([[end[0],end[1],end[2]],tip,twig],[.019,.011,.002]);
    }
  }
  for(let i=0;i<3;i++){
    const a=i*2.1,tip=[Math.cos(a)*.75,4.65+random(i,seed)*.3,Math.sin(a)*.75];
    branch([[.05,2.8,0],[.18,3.7,-.1],tip],[.11,.065,.008]);
    sprays.push({center:tip,radii:[.78,.5,.72],count:58,size:.26});
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();return {geometry,sprays};
}
