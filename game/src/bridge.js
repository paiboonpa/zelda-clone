import * as THREE from 'three';

let woodMaps;
const hash=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
function weatheredWood(){
  if(woodMaps)return woodMaps;
  const width=1024,height=512,canvases=Array.from({length:3},()=>{const c=document.createElement('canvas');c.width=width;c.height=height;return c;});
  const contexts=canvases.map(c=>c.getContext('2d')),images=contexts.map(c=>c.createImageData(width,height));
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const u=x/width,v=y/height,warp=v+Math.sin(u*17)*.006+Math.sin(u*43+v*13)*.002;
    const grain=Math.sin(warp*610)*.035+Math.sin(warp*1420)*.018;
    const knot=Math.sin(Math.hypot((u-.68)*.65,(v-.43)*2.1)*320)*Math.exp(-Math.abs(u-.68)*14-Math.abs(v-.43)*9)*.13;
    const split=Math.pow(.5+.5*Math.sin(warp*290),35)*(.04+.05*Math.sin(u*6));
    const edge=Math.pow(Math.abs(v-.5)*2,12),wear=Math.sin(u*12+v*5)*.025;
    const tone=.96+grain+knot+wear-split-edge*.15+(hash(x,y)-.5)*.045;
    const moss=edge*Math.max(0,Math.sin(u*34+Math.sin(v*60)))*.15;
    const i=(y*width+x)*4;
    images[0].data[i]=139*tone-moss*55;images[0].data[i+1]=119*tone;images[0].data[i+2]=91*tone-moss*30;
    const relief=(.53+grain*2+knot*.4-split*2)*255,rough=(.82+edge*.1)*255;
    for(let ch=0;ch<3;ch++){images[1].data[i+ch]=relief;images[2].data[i+ch]=rough;}
    for(const img of images)img.data[i+3]=255;
  }
  const maps=canvases.map((c,i)=>{contexts[i].putImageData(images[i],0,0);const t=new THREE.CanvasTexture(c);t.colorSpace=i===0?THREE.SRGBColorSpace:THREE.NoColorSpace;t.anisotropy=8;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.name=['Weathered bridge wood color','Bridge wood relief','Bridge wood roughness'][i];return t;});
  woodMaps={map:maps[0],bumpMap:maps[1],roughnessMap:maps[2]};return woodMaps;
}
let cachedBridge;
export function makeBridge(){
  if(cachedBridge)return cachedBridge.clone(true);
  const root=new THREE.Group();root.name='Weathered plank bridge';
  const maps=weatheredWood(),boardGeometry=new THREE.BoxGeometry(3,.18,6.4/18-.022);
  const palette=['#d4c9b2','#b9b19d','#d0c0a5','#c3b99f'];
  const materials=palette.map(color=>new THREE.MeshStandardMaterial({color,...maps,bumpScale:.018,roughness:1}));
  function piece(geometry,material,x,y,z){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;root.add(m);return m;}
  for(let i=0;i<18;i++){
    const board=piece(boardGeometry,materials[i%materials.length],0,.225+(i%3-1)*.002,-3.2+(i+.5)*6.4/18);
    board.rotation.y=(hash(i,3)-.5)*.009;
  }
  const beamGeometry=new THREE.BoxGeometry(.16,.22,6.55);
  for(const side of [-1,1])piece(beamGeometry,materials[1],side*1.15,.04,0);
  const postGeometry=new THREE.CylinderGeometry(.075,.095,1.05,12);
  for(const side of [-1,1]){
    for(const z of [-2.8,0,2.8])piece(postGeometry,materials[1],side*1.45,.72,z);
    const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(side*1.45,1.17,-2.8),new THREE.Vector3(side*1.45,1.04,-1.4),new THREE.Vector3(side*1.45,1.17,0),new THREE.Vector3(side*1.45,1.04,1.4),new THREE.Vector3(side*1.45,1.17,2.8)]);
    piece(new THREE.TubeGeometry(curve,48,.023,6,false),new THREE.MeshStandardMaterial({color:'#9c8a60',roughness:.95}),0,0,0);
  }
  const nails=new THREE.InstancedMesh(new THREE.CylinderGeometry(.017,.017,.008,8),new THREE.MeshStandardMaterial({color:'#49483c',metalness:.55,roughness:.8}),36),dummy=new THREE.Object3D();let n=0;
  for(let i=0;i<18;i++)for(const side of [-1,1]){dummy.position.set(side*1.2,.321+(i%3-1)*.002,-3.2+(i+.5)*6.4/18);dummy.updateMatrix();nails.setMatrixAt(n++,dummy.matrix);}nails.receiveShadow=true;root.add(nails);
  cachedBridge=root;return root.clone(true);
}
