import * as THREE from 'three';
import { trunkGeometry, forestMaterial } from './environment-detail.js';

function labelTexture(text){
  const c=document.createElement('canvas');c.width=768;c.height=160;const x=c.getContext('2d');
  x.fillStyle='rgba(15,28,20,.92)';x.beginPath();x.roundRect(8,8,752,144,24);x.fill();x.strokeStyle='#edda99';x.lineWidth=4;x.stroke();
  x.fillStyle='#fff0bd';x.font='bold 64px system-ui';x.textAlign='center';x.textBaseline='middle';x.fillText(text,384,80);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
export function markDoorway(world,x,z,{title,yaw=0,r=1,signHeight=3.3}={}){
  const root=new THREE.Group();root.position.set(x,world.groundAt(x,z),z);root.rotation.y=yaw;root.name=title;
  const label=new THREE.Sprite(new THREE.SpriteMaterial({map:labelTexture(title),depthTest:true}));label.position.y=signHeight;label.scale.set(3.6,.75,1);root.add(label);
  const ring=new THREE.Mesh(new THREE.RingGeometry(r*.75,r*.88,48),new THREE.MeshBasicMaterial({color:'#edd78d',transparent:true,opacity:.7,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=.045;root.add(ring);
  const light=new THREE.PointLight('#e4edaa',8,5,2);light.position.set(0,1.5,0);root.add(light);
  for(const side of [-1,1]){
    const lamp=new THREE.Mesh(new THREE.SphereGeometry(.11,12,8),new THREE.MeshBasicMaterial({color:'#fff0b3'}));lamp.position.set(side*1.05,1.45,.1);root.add(lamp);
  }
  world.scene.add(root);return root;
}
export function interiorDoorway(world,z,width=2.5,height=3.2,entrance=false){
  const root=new THREE.Group();root.position.set(0,world.groundAt(0,z),z);root.name='Daylit exit opening';
  const wood=new THREE.MeshStandardMaterial({color:'#816345',roughness:.9});
  const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(-width/2,0,0),new THREE.Vector3(-width/2,height*.68,0),new THREE.Vector3(-width*.38,height*.94,0),new THREE.Vector3(0,height,0),new THREE.Vector3(width*.38,height*.94,0),new THREE.Vector3(width/2,height*.68,0),new THREE.Vector3(width/2,0,0)]);
  const frame=new THREE.Mesh(new THREE.TubeGeometry(curve,48,.16,10,false),wood);frame.castShadow=true;root.add(frame);
  const c=document.createElement('canvas');c.width=256;c.height=512;const ctx=c.getContext('2d'),sky=ctx.createLinearGradient(0,0,0,512);sky.addColorStop(0,entrance?'#16170d':'#83c9d8');sky.addColorStop(.6,entrance?'#302a17':'#ecf2c4');sky.addColorStop(1,entrance?'#6b6338':'#779848');ctx.fillStyle=sky;ctx.fillRect(0,0,256,512);
  ctx.fillStyle=entrance?'#3f3923':'#a9bc76';ctx.beginPath();ctx.moveTo(0,360);ctx.quadraticCurveTo(100,290,256,350);ctx.lineTo(256,512);ctx.lineTo(0,512);ctx.fill();
  const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;
  const shape=new THREE.Shape();shape.moveTo(-width/2,0);shape.lineTo(width/2,0);shape.lineTo(width/2,height*.68);shape.quadraticCurveTo(width/2,height,0,height);shape.quadraticCurveTo(-width/2,height,-width/2,height*.68);shape.closePath();
  const geo=new THREE.ShapeGeometry(shape),p=geo.attributes.position,uv=geo.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,(p.getX(i)+width/2)/width,p.getY(i)/height);
  const outside=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({map,side:THREE.DoubleSide}));outside.position.z=.15;root.add(outside);
  const light=new THREE.PointLight('#f2f4c0',20,8,2);light.position.set(0,height*.7,-.9);root.add(light);
  // Floor arrows point toward the opening from inside the room.
  const arrowShape=new THREE.Shape();arrowShape.moveTo(0,.45);arrowShape.lineTo(.32,0);arrowShape.lineTo(.12,0);arrowShape.lineTo(.12,-.35);arrowShape.lineTo(-.12,-.35);arrowShape.lineTo(-.12,0);arrowShape.lineTo(-.32,0);arrowShape.closePath();
  const arrowGeo=new THREE.ShapeGeometry(arrowShape),arrowMat=new THREE.MeshBasicMaterial({color:'#efdc9b',side:THREE.DoubleSide,transparent:true,opacity:.8});
  for(const distance of [1.3,2.5]){const arrow=new THREE.Mesh(arrowGeo,arrowMat);arrow.rotation.x=Math.PI/2;arrow.position.set(0,.04,-distance);root.add(arrow);}
  world.scene.add(root);return root;
}

export function exteriorDoorway(world,x,z,yaw,width=2.5,height=3.1){
  const door=interiorDoorway(world,0,width,height,true);
  door.position.set(x,world.groundAt(x,z),z);door.rotation.y=yaw+Math.PI;
  return door;
}

// Fit the arch to the actual trunk surface at every height, including its flare.
export function attachedTreeDoorway(world,x,z,yaw){
  const door=exteriorDoorway(world,x,z,yaw,2.6,2.95),p=trunkGeometry.attributes.position;
  const profile=[];
  for(let row=0;row<=12;row++){
    let radius=0;
    for(let i=0;i<=24;i++){const n=row*25+i;if(p.getZ(n)>radius)radius=p.getZ(n);}
    profile.push({y:(p.getY(row*25)+.5)*6,depth:radius*3.4});
  }
  profile.sort((a,b)=>a.y-b.y);
  const depth=y=>{for(let i=1;i<profile.length;i++)if(y<=profile[i].y){const a=profile[i-1],b=profile[i];return THREE.MathUtils.lerp(a.depth,b.depth,THREE.MathUtils.clamp((y-a.y)/(b.y-a.y),0,1));}return profile.at(-1).depth;};
  for(const child of door.children){
    if(child.isMesh && (child.geometry.type!=='ShapeGeometry' || child.position.z===.15)){
      if(child.position.z===.15){
        // Subdivide the inset as well as its border so it follows the curved
        // center of the trunk instead of cutting across it as a flat chord.
        const flat=child.geometry.toNonIndexed(),source=flat.attributes.position;
        const vertices=[];
        const split=(a,b,c,n)=>{
          if(!n){vertices.push(...a,...b,...c);return;}
          const mid=(p,q)=>p.map((v,i)=>(v+q[i])*.5),ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);
          split(a,ab,ca,n-1);split(ab,b,bc,n-1);split(ca,bc,c,n-1);split(ab,bc,ca,n-1);
        };
        for(let i=0;i<source.count;i+=3){const point=j=>[source.getX(j),source.getY(j),source.getZ(j)];split(point(i),point(i+1),point(i+2),3);}
        const inset=new THREE.BufferGeometry();inset.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
        const uv=[];for(let i=0;i<vertices.length;i+=3)uv.push((vertices[i]+1.3)/2.6,vertices[i+1]/2.95);
        inset.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));flat.dispose();child.geometry.dispose();child.geometry=inset;
      }
      const geo=child.geometry,positions=geo.attributes.position;
      for(let i=0;i<positions.count;i++)positions.setZ(i,positions.getZ(i)-depth(positions.getY(i))*Math.sqrt(Math.max(.1,1-Math.pow(positions.getX(i)/depth(positions.getY(i)),2)))-.12);
      if(child.position.z===.15)child.position.z=-.15;
      positions.needsUpdate=true;geo.computeVertexNormals();geo.computeBoundingSphere();
    }else if(child.isPointLight)child.position.z=-depth(child.position.y)-.7;
    else if(child.isMesh)child.position.z-=depth(0);
  }
  return door;
}

// A solid rock facade with a real arch-shaped hole; frame and cliff share a plane.
export function caveEntrance(world,x,z,yaw){
  const root=new THREE.Group();root.position.set(x,world.groundAt(x,z),z);root.rotation.y=yaw;
  const shape=new THREE.Shape();const outer=[[-4.4,-.2],[-4.7,1.3],[-3.6,3.8],[-2.5,4.9],[-.9,5.4],[.8,5.1],[2.6,4.4],[4,2.9],[4.5,-.2]];
  outer.forEach(([a,b],i)=>i?shape.lineTo(a,b):shape.moveTo(a,b));shape.closePath();
  const hole=new THREE.Path();hole.moveTo(-1.65,-.1);hole.lineTo(1.65,-.1);hole.lineTo(1.65,2.5);hole.quadraticCurveTo(1.65,3.65,0,3.65);hole.quadraticCurveTo(-1.65,3.65,-1.65,2.5);hole.closePath();shape.holes.push(hole);
  const geo=new THREE.ExtrudeGeometry(shape,{depth:2.5,steps:1,bevelEnabled:true,bevelSize:.18,bevelThickness:.15,bevelSegments:3});geo.translate(0,0,-2.6);
  const colors=new Float32Array(geo.attributes.position.count*3);colors.fill(1);geo.setAttribute('color',new THREE.BufferAttribute(colors,3));
  const rock=new THREE.Mesh(geo,forestMaterial('rock','#70664e'));rock.castShadow=rock.receiveShadow=true;root.add(rock);world.scene.add(root);
  const door=exteriorDoorway(world,x,z,yaw,3.2,3.6);door.position.add(new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw)).multiplyScalar(.025));
  world.occluders.push(rock);
  // Collide only with the rock sides; keep the central mouth walkable.
  for(const side of [-1,1])world.circle(x+Math.cos(yaw)*side*3,z-Math.sin(yaw)*side*3,1.5);
  return root;
}
