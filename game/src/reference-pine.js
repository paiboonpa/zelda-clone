import * as THREE from 'three';
import { forestMaterial } from './environment-detail.js';

const TAU=Math.PI*2;
const hash=(i,s)=>{const n=Math.sin(i*127.1+s*311.7)*43758.5453;return n-Math.floor(n);};
let source;
function buildPine(){
  const positions=[],uvs=[],colors=[],indices=[],sprays=[];
  function branch(points,r0,r1){
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),steps=r0>.1?14:6,sides=r0>.1?14:5;
    const frames=curve.computeFrenetFrames(steps,false),offset=positions.length/3;
    for(let j=0;j<=steps;j++){
      const t=j/steps,p=curve.getPointAt(t),radius=THREE.MathUtils.lerp(r0,r1,t)+(r0>.1?.08*Math.exp(-t*20):0);
      for(let i=0;i<=sides;i++){
        const a=i/sides*TAU,n=frames.normals[j].clone().multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[j],Math.sin(a));
        const v=p.clone().addScaledVector(n,radius*(1+.035*Math.sin(a*5+t*10)));
        positions.push(v.x,v.y,v.z);uvs.push(i/sides,t);const c=.8+Math.max(0,n.y)*.15;colors.push(c,c,c*.95);
        if(j&&i){const q=offset+j*(sides+1)+i;indices.push(q,q-1,q-sides-2,q,q-sides-2,q-sides-1);}
      }
    }
  }
  branch([[0,-.03,0],[.025,.8,-.015],[-.025,2,.02],[.035,3.6,0],[0,5.8,.025]],.19,.008);
  for(let i=0;i<5;i++){
    const a=i/5*TAU;
    branch([[Math.cos(a)*.38,-.04,Math.sin(a)*.38],[Math.cos(a)*.18,.1,Math.sin(a)*.18],[0,.35,0]],.035,.09);
  }
  for(let tier=0;tier<9;tier++){
    const y=1.6+tier*.43,reach=1.5*(1-tier/10),count=tier<6?5:4;
    for(let j=0;j<count;j++){
      const a=j/count*TAU+tier*1.7,dx=Math.cos(a),dz=Math.sin(a),len=reach*(.8+hash(j,tier)*.4);
      const tip=[dx*len,y+.22+tier*.018,dz*len];
      branch([[0,y,0],[dx*len*.48,y-.07,dz*len*.48],tip],.055*(1-tier*.075),.004);
      for(let fork=0;fork<3;fork++){
        const t=.42+fork*.24,side=fork%2?1:-1,start=[dx*len*t,y+.1*t,dz*len*t];
        const end=[dx*len*(t+.14)-dz*side*len*.25,y+.22+fork*.07,dz*len*(t+.14)+dx*side*len*.25];
        branch([start,[(start[0]+end[0])/2,y+.08,(start[2]+end[2])/2],end],.018,.002);
        sprays.push({center:end,yaw:a+side*.5,size:.58*(1-tier*.055),seed:tier*20+j*3+fork});
      }
      sprays.push({center:tip,yaw:a,size:.58*(1-tier*.055),seed:tier*30+j});
    }
  }
  for(let i=0;i<5;i++)sprays.push({center:[Math.sin(i*2)*.12,5.3+i*.14,Math.cos(i*2)*.12],yaw:i*2,size:.32,seed:300+i});
  const wood=new THREE.BufferGeometry();wood.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));wood.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));wood.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));wood.setIndex(indices);wood.computeVertexNormals();
  const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d');
  // A whole feathery shoot per card, rather than broad oval leaves on a cone.
  ctx.lineCap='round';ctx.strokeStyle='#817f50';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(256,495);ctx.quadraticCurveTo(245,240,256,18);ctx.stroke();
  for(let i=0;i<22;i++){
    const y=45+i*19,spread=(20+Math.sin(i/22*Math.PI)*118)*( .85+hash(i,2)*.2);
    for(const side of [-1,1]){
      ctx.strokeStyle=i%3?'#9ba98a':'#c1c7a1';ctx.lineWidth=4+hash(i,side)*3;
      ctx.beginPath();ctx.moveTo(256,y+25);ctx.quadraticCurveTo(256+side*spread*.65,y+8,256+side*spread,y-26);ctx.stroke();
      ctx.strokeStyle='#748567';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(256,y+20);ctx.lineTo(256+side*spread*.84,y-35);ctx.stroke();
    }
  }
  const map=new THREE.CanvasTexture(c);map.name='Reference conifer needle shoots 512';map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=8;
  const material=new THREE.MeshStandardMaterial({map,roughness:.95,alphaTest:.28,side:THREE.DoubleSide,color:'#e4e8d5',emissive:'#56634b',emissiveIntensity:.15});
  const foliage=new THREE.PlaneGeometry(1,1,1,3),p=foliage.attributes.position;
  for(let i=0;i<p.count;i++)p.setZ(i,.12*(1-4*p.getY(i)*p.getY(i)));foliage.computeVertexNormals();
  return {wood,foliage,material,sprays};
}
export function makeReferencePine(scale=1){
  if(!source)source=buildPine();const root=new THREE.Group();root.name='Tall open reference conifer';
  const wood=new THREE.Mesh(source.wood,forestMaterial('bark','#a29b7c'));wood.castShadow=wood.receiveShadow=true;root.add(wood);
  const leaves=new THREE.InstancedMesh(source.foliage,source.material,source.sprays.length*3),dummy=new THREE.Object3D(),color=new THREE.Color();let i=0;
  for(const s of source.sprays)for(let layer=0;layer<3;layer++,i++){
    dummy.position.set(s.center[0]+(hash(i,2)-.5)*s.size*.35,s.center[1]+(hash(i,3)-.5)*s.size*.22,s.center[2]+(hash(i,4)-.5)*s.size*.35);
    dummy.rotation.set(-1.05+(hash(i,5)-.5)*.8,s.yaw+layer*Math.PI*.5,(hash(i,6)-.5)*.65);
    dummy.scale.set(s.size*.6,s.size*(.9+hash(i,7)*.4),1);dummy.updateMatrix();leaves.setMatrixAt(i,dummy.matrix);
    color.setHSL(.23+hash(i,8)*.03,.1+hash(i,9)*.12,.6+hash(i,10)*.2);leaves.setColorAt(i,color);
  }
  leaves.castShadow=leaves.receiveShadow=true;root.add(leaves);root.scale.setScalar(scale);root.userData.groundFit={height:.8,embed:.07};return root;
}
