import * as THREE from 'three';

// Shared authored surfaces and meshes for forest props.
const TAU = Math.PI * 2, textures = new Map(), materials = new Map(), rocks = new Map();
const hash = (x, y, seed = 0) => { const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453; return n - Math.floor(n); };
function noise(x, y) {
  const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix,iy),hash(ix+1,iy),u),THREE.MathUtils.lerp(hash(ix,iy+1),hash(ix+1,iy+1),u),v);
}
function surface(kind) {
  if(textures.has(kind))return textures.get(kind);
  const size=1024,c=document.createElement('canvas');c.width=c.height=size;
  const ctx=c.getContext('2d'),img=ctx.createImageData(size,size),height=ctx.createImageData(size,size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
    const u=x/size,v=y/size,n=noise(u*16,v*16),fine=hash(x,y);let tone,h;
    if(kind==='bark') {
      const warp=u+Math.sin(v*TAU*2)*.012+Math.sin(v*TAU*5)*.005;
      const ridge=.5+.5*Math.sin(warp*TAU*24+noise(u*8,v*12)*2);
      const crack=Math.pow(1-ridge,7);
      tone=.76+n*.22+ridge*.17-crack*.34+(fine-.5)*.075;
      h=.35+ridge*.4-crack*.18;
    }else {
      const coarse=noise(u*5,v*5),detail=noise(u*64,v*64);
      const vein=Math.pow(Math.max(0,1-Math.abs(Math.sin((u*5+v*3+n*.9)*TAU))*18),2);
      tone=.66+coarse*.26+n*.15+(detail-.5)*.16+(fine-.5)*.08+vein*.14;
      h=.4+n*.22+(detail-.5)*.2-vein*.08;
    }
    const i=(y*size+x)*4;
    img.data[i]=tone*255;img.data[i+1]=tone*252;img.data[i+2]=tone*244;img.data[i+3]=255;
    height.data[i]=height.data[i+1]=height.data[i+2]=h*255;height.data[i+3]=255;
  }
  ctx.putImageData(img,0,0);const b=document.createElement('canvas');b.width=b.height=size;b.getContext('2d').putImageData(height,0,0);
  const map=new THREE.CanvasTexture(c),bumpMap=new THREE.CanvasTexture(b);map.colorSpace=THREE.SRGBColorSpace;
  for(const [name,t]of Object.entries({map,bumpMap})){t.name=`Forest ${kind} ${name}`;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;if(kind==='bark')t.repeat.set(2,3);}
  textures.set(kind,{map,bumpMap});return textures.get(kind);
}
export function forestMaterial(kind,color) {
  const key=kind+color;if(materials.has(key))return materials.get(key);
  const m=new THREE.MeshStandardMaterial({color,...surface(kind),roughness:kind==='bark'?.94:.88,bumpScale:kind==='bark'?.025:.035,vertexColors:true});materials.set(key,m);return m;
}
function colorGeometry(geo,fn) {
  const p=geo.attributes.position,colors=[];
  for(let i=0;i<p.count;i++)colors.push(...fn(p.getX(i),p.getY(i),p.getZ(i)));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));return geo;
}
function smoothNormals(geo) {
  geo.computeVertexNormals();
  const p=geo.attributes.position,n=geo.attributes.normal,shared=new Map(),keys=[];
  for(let i=0;i<p.count;i++) {
    const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*100000)).join(',');keys.push(key);
    if(!shared.has(key))shared.set(key,new THREE.Vector3());
    shared.get(key).add(new THREE.Vector3(n.getX(i),n.getY(i),n.getZ(i)));
  }
  for(const normal of shared.values())normal.normalize();
  for(let i=0;i<n.count;i++){const v=shared.get(keys[i]);n.setXYZ(i,v.x,v.y,v.z);}
  return geo;
}
export function stoneGeometry(seed=0) {
  const variant=((Math.floor(seed)%8)+8)%8;if(rocks.has(variant))return rocks.get(variant);
  const geo=new THREE.IcosahedronGeometry(1,5),p=geo.attributes.position;
  for(let i=0;i<p.count;i++) {
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    const d=1+.09*Math.sin(x*8+variant)*Math.cos(z*6-y*3)+.055*Math.sin(y*13+z*5+variant);
    p.setXYZ(i,x*d,Math.max(-.62,y*d),z*d);
  }
  smoothNormals(geo);colorGeometry(geo,(x,y,z)=>{const light=.76+Math.max(0,y)*.19+noise(x*3+10,z*3+10)*.08;return [light,light,light*.97];});rocks.set(variant,geo);return geo;
}
export const trunkGeometry=(()=>{
  const g=new THREE.CylinderGeometry(.78,1,1,24,12),p=g.attributes.position;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),a=Math.atan2(z,x),base=Math.pow(.5-y,4);
    const flare=1+base*(.12+.16*(.5+.5*Math.cos(a*6)))+.028*Math.sin(a*9+y*5);
    p.setXYZ(i,x*flare+.025*Math.sin(y*5),y,z*flare);
  }
  g.computeVertexNormals();return colorGeometry(g,(x,y,z)=>{const v=.73+(y+.5)*.25;return[v,v,v];});
})();
export const rootGeometry=colorGeometry(new THREE.ConeGeometry(1,1,18,4),(x,y,z)=>{const v=.76+(y+.5)*.2;return[v,v,v];});
export const crownGeometry=(()=>{
  const g=new THREE.IcosahedronGeometry(1,2),p=g.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),r=1+.07*Math.sin(x*13+z*7)*Math.cos(y*11);p.setXYZ(i,x*r,y*r,z*r);}
  smoothNormals(g);return colorGeometry(g,(x,y,z)=>{const t=.62+Math.max(0,y)*.3+noise(x*5+8,z*5+8)*.12;return[t*.94,t,t*.85];});
})();
const leafGeometry=new THREE.PlaneGeometry(1,1,1,2);
for(let i=0;i<leafGeometry.attributes.position.count;i++) {
  const p=leafGeometry.attributes.position,y=p.getY(i);
  p.setZ(i,.12*(1-4*y*y));
}
leafGeometry.computeVertexNormals();
let leafMaterial;
function leavesMaterial(){
  if(leafMaterial)return leafMaterial;
  const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');
  const shape=()=>{x.beginPath();x.moveTo(256,18);x.bezierCurveTo(490,170,459,380,256,495);x.bezierCurveTo(54,380,23,170,256,18);};
  shape();const fill=x.createLinearGradient(60,0,450,430);fill.addColorStop(0,'#aac86c');fill.addColorStop(.5,'#739d48');fill.addColorStop(1,'#3e6b32');x.fillStyle=fill;x.fill();x.save();shape();x.clip();
  x.strokeStyle='#bed68a';x.lineWidth=5;x.beginPath();x.moveTo(256,30);x.lineTo(256,495);x.stroke();
  x.lineWidth=2;for(let i=0;i<8;i++){const y=100+i*43;for(const s of [-1,1]){x.beginPath();x.moveTo(256,y+55);x.quadraticCurveTo(256+s*80,y+15,256+s*155,y-30);x.stroke();}}x.restore();
  const map=new THREE.CanvasTexture(c);map.name='Forest leaf 512';map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=8;
  leafMaterial=new THREE.MeshStandardMaterial({map,color:'#ffffff',roughness:.85,side:THREE.DoubleSide,alphaTest:.45});return leafMaterial;
}
// Instancing keeps each cluster to one draw call, with deterministic variation.
export function leafCluster(parent,center,radii,count,seed=0,leafSize=.25){
  const mesh=new THREE.InstancedMesh(leafGeometry,leavesMaterial(),count),dummy=new THREE.Object3D(),color=new THREE.Color();
  for(let i=0;i<count;i++){
    const y=1-2*(i+.5)/count,a=i*2.399963+seed,r=Math.sqrt(1-y*y),nx=Math.cos(a)*r,nz=Math.sin(a)*r;
    dummy.position.set(center[0]+nx*radii[0],center[1]+y*radii[1],center[2]+nz*radii[2]);
    dummy.lookAt(dummy.position.clone().add(new THREE.Vector3(nx,y,nz)));dummy.rotateZ(hash(i,seed)*TAU);dummy.rotateX((hash(i,4,seed)-.5)*1.1);
    const s=leafSize*(.7+hash(i,3,seed)*.6);dummy.scale.set(s*.65,s,1);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
    color.setHSL(.25+hash(i,7,seed)*.035,.34+hash(i,8)*.16,.37+Math.max(0,y)*.16);mesh.setColorAt(i,color);
  }
  mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}

// Loose foliage sprays fill branch tips with gaps rather than opaque crown shells.
export function branchLeaves(parent,sprays,seed=0) {
  const count=sprays.reduce((n,s)=>n+s.count,0);
  const material=leavesMaterial().clone();material.color.set('#dad8b1');
  const mesh=new THREE.InstancedMesh(leafGeometry,material,count),dummy=new THREE.Object3D(),color=new THREE.Color();let index=0;
  for(const spray of sprays)for(let j=0;j<spray.count;j++,index++) {
    const y=hash(index,1,seed)*2-1,a=hash(index,2,seed)*TAU,r=Math.sqrt(1-y*y),depth=Math.cbrt(hash(index,3,seed));
    dummy.position.set(spray.center[0]+Math.cos(a)*r*depth*spray.radii[0],spray.center[1]+y*depth*spray.radii[1],spray.center[2]+Math.sin(a)*r*depth*spray.radii[2]);
    dummy.rotation.set(hash(index,4,seed)*Math.PI,hash(index,5,seed)*TAU,hash(index,6,seed)*TAU);
    const size=spray.size*(.65+hash(index,7,seed)*.7);dummy.scale.set(size*.68,size,1);dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);
    color.setHSL(.18+hash(index,8,seed)*.045,.10+hash(index,9,seed)*.15,.58+hash(index,10,seed)*.24);mesh.setColorAt(index,color);
  }
  mesh.castShadow=mesh.receiveShadow=true;mesh.name='Loose olive leaf sprays';parent.add(mesh);return mesh;
}
