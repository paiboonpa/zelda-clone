import * as THREE from 'three';

let texture;
function contactTexture(){
  if(texture)return texture;
  const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),g=x.createRadialGradient(32,32,2,32,32,31);
  g.addColorStop(0,'rgba(0,0,0,.8)');g.addColorStop(.4,'rgba(0,0,0,.45)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,64,64);texture=new THREE.CanvasTexture(c);return texture;
}
/** Small ambient contact cues complement the directional sun shadow. */
export class FootShadows {
  constructor(){
    this.root=new THREE.Group();this.root.name='Hero foot contact shadows';this.point=new THREE.Vector3();
    this.meshes=Array.from({length:2},()=>{
      const geometry=new THREE.PlaneGeometry(1,1,3,3);geometry.rotateX(-Math.PI/2);
      const material=new THREE.MeshBasicMaterial({map:contactTexture(),transparent:true,opacity:.28,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
      const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;this.root.add(mesh);return mesh;
    });
  }
  update(player,world){
    player.root.updateMatrixWorld(true);
    for(const [i,leg]of [player.rig.legL,player.rig.legR].entries()){
      const mesh=this.meshes[i],foot=leg.foot;
      if(!foot){mesh.visible=false;continue;}
      foot.localToWorld(this.point.set(0,-.11,.035));
      const ground=world.groundAt(this.point.x,this.point.z,player.pos.y),clearance=Math.max(0,this.point.y-ground);
      const water=world.inWater?.(this.point.x,this.point.z);
      mesh.visible=player.root.visible && player.grounded && clearance<.16 && !(water&&ground<water.y-.03);
      if(!mesh.visible)continue;
      mesh.material.opacity=.28*Math.pow(Math.max(0,1-clearance/.16),2);
      const width=.19+clearance*.45,length=.32+clearance*.6,c=Math.cos(player.yaw),s=Math.sin(player.yaw),p=mesh.geometry.attributes.position;
      const base=mesh.geometry.parameters;
      for(let j=0;j<p.count;j++){
        const col=j%(base.widthSegments+1),row=Math.floor(j/(base.widthSegments+1));
        const lx=(col/base.widthSegments-.5)*width,lz=(row/base.heightSegments-.5)*length;
        const x=this.point.x+lx*c+lz*s,z=this.point.z-lx*s+lz*c;
        p.setXYZ(j,x,world.groundAt(x,z,ground)+.008,z);
      }
      p.needsUpdate=true;
    }
  }
}
