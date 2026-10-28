import * as THREE from 'three';
import { leafCluster } from './environment-detail.js';

/** Short cut reaction followed by tumbling, gravity-driven leaf fragments. */
export class BushCutEffects {
  constructor(scene){this.scene=scene;this.active=[];}
  attach(scene){
    for(const effect of this.active)this.remove(effect);
    this.active.length=0;this.scene=scene;
  }
  cut(mesh,yaw=0){
    if(this.active.some(e=>e.bush===mesh))return;
    const group=new THREE.Group();group.position.copy(mesh.position);this.scene.add(group);
    const leaves=leafCluster(group,[0,.35,0],[.42,.26,.42],34,Math.random()*20,.18);
    leaves.instanceMatrix.setUsage(THREE.DynamicDrawUsage);leaves.frustumCulled=false;
    const particles=[],matrix=new THREE.Matrix4(),position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();
    const dx=Math.cos(yaw),dz=-Math.sin(yaw);
    for(let i=0;i<leaves.count;i++){
      leaves.getMatrixAt(i,matrix);matrix.decompose(position,rotation,scale);
      const a=Math.random()*Math.PI*2,speed=1.1+Math.random()*1.5;
      particles.push({position:position.clone(),rotation:new THREE.Euler().setFromQuaternion(rotation),scale:scale.clone(),velocity:new THREE.Vector3(Math.cos(a)*speed+dx*1.3,1.6+Math.random()*2.1,Math.sin(a)*speed+dz*1.3),spin:new THREE.Vector3((Math.random()-.5)*14,(Math.random()-.5)*12,(Math.random()-.5)*16),life:.7+Math.random()*.5});
    }
    this.active.push({bush:mesh,baseScale:mesh.scale.clone(),baseRotation:mesh.rotation.clone(),group,leaves,particles,age:0,dx,dz});
  }
  remove(e){e.bush.visible=false;e.group.removeFromParent();e.leaves.dispose();}
  update(dt){
    const dummy=new THREE.Object3D();
    for(let index=this.active.length-1;index>=0;index--){
      const e=this.active[index];e.age+=dt;
      const t=Math.min(1,e.age/.18),reaction=Math.sin(t*Math.PI);
      e.bush.scale.set(e.baseScale.x*(1+reaction*.12)*(1-t*.2),e.baseScale.y*(1-t)*(1-t),e.baseScale.z*(1+reaction*.12)*(1-t*.2));
      e.bush.rotation.x=e.baseRotation.x+e.dz*reaction*.16;e.bush.rotation.z=e.baseRotation.z-e.dx*reaction*.16;
      if(t>=1)e.bush.visible=false;
      for(let i=0;i<e.particles.length;i++){
        const p=e.particles[i],drag=Math.exp(-1.5*dt);p.velocity.x*=drag;p.velocity.z*=drag;p.velocity.y-=6*dt;p.position.addScaledVector(p.velocity,dt);
        if(p.position.y<.025){p.position.y=.025;p.velocity.y=0;p.velocity.x*=Math.exp(-10*dt);p.velocity.z*=Math.exp(-10*dt);}
        else {p.rotation.x+=p.spin.x*dt;p.rotation.y+=p.spin.y*dt;p.rotation.z+=p.spin.z*dt;}
        const fade=Math.max(0,Math.min(1,(p.life-e.age)/.25));
        dummy.position.copy(p.position);dummy.rotation.copy(p.rotation);dummy.scale.copy(p.scale).multiplyScalar(fade);dummy.updateMatrix();e.leaves.setMatrixAt(i,dummy.matrix);
      }
      e.leaves.instanceMatrix.needsUpdate=true;
      if(e.age>=1.25){this.remove(e);this.active.splice(index,1);}
    }
  }
}
