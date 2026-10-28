import * as THREE from 'three';
import { heroSurface, heroShieldSurface } from './hero-textures.js';

// Video-guided reconstruction. Dimensions remain compatible with the player rig.
// These are authored surfaces, not recovered source-game meshes or textures.
const TAU = Math.PI * 2;
const material = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .78, ...extra });
const sphere = new THREE.SphereGeometry(1, 32, 24);
function part(parent, geometry, mat, position = [0, 0, 0], scale = [1, 1, 1]) {
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.set(...position); mesh.scale.set(...scale);
  mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function ellipsoid(parent, mat, position, scale) { return part(parent, sphere, mat, position, scale); }
function group(parent, position = [0, 0, 0]) { const g = new THREE.Group(); g.position.set(...position); parent.add(g); return g; }

// Elliptical ring surface with independent centers for cloth, boots and face.
function rings(rows, segments = 40, folds = 0) {
  const positions = [], uvs = [], indices = [];
  for (let j = 0; j < rows.length; j++) {
    const [y, rx, rz, cx = 0, cz = 0] = rows[j];
    for (let i = 0; i <= segments; i++) {
      const a = i / segments * TAU, wrinkle = 1 + Math.cos(a * 8) * folds;
      positions.push(cx + Math.sin(a) * rx * wrinkle, y, cz + Math.cos(a) * rz * wrinkle);
      uvs.push(i / segments, j / (rows.length - 1));
      if (j && i) { const p = j * (segments + 1) + i; indices.push(p, p - 1, p - segments - 2, p, p - segments - 2, p - segments - 1); }
    }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geo.setIndex(indices); geo.computeVertexNormals(); return geo;
}
function stroke(parent, points, mat, radius = .004) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  return part(parent, new THREE.TubeGeometry(curve, Math.max(12, points.length * 5), radius, 6, false), mat);
}
function outline(parent, points, depth, mat, position = [0, 0, 0]) {
  const shape = new THREE.Shape(); points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y)); shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: .006, bevelThickness: .005 });
  return part(parent, geo, mat, position);
}
export function makeReferenceHero() {
  const root = new THREE.Group(); root.name = 'Video reference hero';
  const body = group(root), torso = group(body, [0, .55, 0]), head = group(torso, [0, .44, 0]);
  const green = material('#526841', { ...heroSurface('cloth'), bumpScale: .0022, roughness: 1 });
  const edge = material('#829064', { ...heroSurface('cloth'), bumpScale: .0015 });
  const darkGreen = material('#354a30', { ...heroSurface('cloth'), bumpScale: .0015 });
  const skin = material('#efbd9b', { ...heroSurface('skin'), bumpScale: .00045, roughness: 1 });
  const leather = material('#805337', { ...heroSurface('leather'), bumpScale: .0018, roughness: 1 });
  const seam = material('#bfa579'), gold = material('#c3a15b', { ...heroSurface('steel'), metalness: .65, roughness: 1 });
  const hair = material('#bb873b', { ...heroSurface('hair'), bumpScale: .0012, roughness: 1 });
  const hairLight = material('#d4a24d', { ...heroSurface('hair'), bumpScale: .0012, roughness: 1 });
  const pants = material('#d1c5aa', { ...heroSurface('linen'), bumpScale: .0014, roughness: 1 });
  const black = material('#291d18', { ...heroSurface('leather'), bumpScale: .001 });

  // Tunic: fitted shoulders and waist, flared hem and small cloth folds.
  const tunic = rings([[-.06,.205,.132],[0,.23,.145],[.08,.198,.128],[.16,.158,.113],[.24,.167,.12],[.34,.182,.119],[.4,.164,.105],[.43,.093,.075]], 48, .025);
  // Cut the neckline into the cloth itself rather than overlaying a skin triangle.
  const vertices = tunic.attributes.position;
  for (let row = 6; row <= 7; row++) for (let i = 0; i <= 48; i++) {
    const a = i / 48 * TAU;
    if (Math.cos(a) <= 0) continue;
    const opening = Math.min(1, Math.abs(Math.sin(a)) / .65);
    vertices.setY(row * 49 + i, row === 6 ? .335 + .065 * opening : .35 + .08 * opening);
  }
  tunic.computeVertexNormals();
  part(torso, tunic, green);
  part(torso, rings([[-.062,.207,.134],[-.048,.21,.135],[-.037,.209,.135]], 48, .025), edge);
  // A shallow neckline follows the upper ring in 3D, including its front depth.
  const neckline = [];
  for (let i = 0; i <= 48; i++) {
    const index = 7 * 49 + i;
    neckline.push([vertices.getX(index), vertices.getY(index) + .002, vertices.getZ(index)]);
  }
  stroke(torso, neckline, darkGreen, .005);
  // Two folded cloth lapels, each resting on the sloped chest surface.
  for (const side of [-1, 1]) {
    const points = [
      [side*.058,.43,.063], [side*.105,.408,.087],
      [side*.055,.362,.105], [side*.009,.353,.08],
    ];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute([0,1,1,1,1,0,0,0],2));
    geo.setIndex(side === 1 ? [0,2,1,0,3,2] : [0,1,2,0,2,3]); geo.computeVertexNormals();
    part(torso,geo,material('#657c4b',{...heroSurface('cloth'),bumpScale:.0015,side:THREE.DoubleSide}));
    stroke(torso,[points[0],points[3],points[2]],edge,.002);
  }
  // Small ties span the opening; their height follows the recessed neckline.
  for(let i=0;i<2;i++) {
    const y=.367+i*.022,w=.013+i*.014,z=.078-i*.007;
    stroke(torso,[[-w,y,z],[0,y+.008,z+.004],[w,y+.014,z]],seam,.0018);
    stroke(torso,[[w,y,z+.001],[0,y+.008,z+.006],[-w,y+.014,z+.001]],seam,.0018);
  }
  // Belt and diagonal leather baldric.
  part(torso,rings([[.105,.2,.134],[.15,.199,.132]],48),leather);
  outline(torso,[[-.035,-.025],[.035,-.025],[.035,.025],[-.035,.025]],.012,gold,[0,.128,.135]);
  outline(torso,[[-.023,-.014],[.023,-.014],[.023,.014],[-.023,.014]],.013,leather,[0,.128,.146]);
  stroke(torso,[[-.14,.4,.105],[-.09,.31,.13],[0,.2,.145],[.13,.08,.12]],leather,.024);
  stroke(torso,[[-.154,.4,.121],[-.105,.31,.149],[-.015,.2,.164],[.116,.08,.139]],seam,.0018);
  for(const side of [-1,1]) for(let j=0;j<2;j++) {
    stroke(torso,[[side*(.05+j*.07),.02,.143],[side*(.075+j*.065),.047,.145],[side*(.065+j*.06),.075,.136]],edge,.0023);
  }
  ellipsoid(torso,skin,[0,.438,0],[.068,.088,.068]);

  // Reference proportions: narrow lower cheeks, a tapered jaw and a small chin.
  // Sample a smooth profile so the face has no visible horizontal ring bands.
  const profile = [
    [-.012,.003,.026,0,.025],[0,.029,.067,0,.028],
    [.025,.059,.091,0,.025],[.055,.086,.109,0,.017],
    [.095,.112,.123,0,.006],[.13,.128,.132,0,0],
    [.17,.135,.134,0,-.003],[.215,.14,.133,0,-.008],
    [.265,.139,.126,0,-.014],[.3,.118,.109,0,-.017],
    [.329,.067,.071,0,-.018],[.34,.001,.001,0,-.018],
  ];
  const faceRows = [];
  for(let j=0;j<profile.length-1;j++) for(let step=0;step<5;step++) {
    const t=step/5, row=[];
    for(let k=0;k<5;k++) {
      const a=profile[Math.max(0,j-1)][k],b=profile[j][k],c=profile[j+1][k],d=profile[Math.min(profile.length-1,j+2)][k];
      row.push(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t));
    }
    faceRows.push(row);
  }
  faceRows.push(profile[profile.length-1]);
  const faceGeometry=rings(faceRows,80),fp=faceGeometry.attributes.position;
  for(let i=0;i<fp.count;i++) {
    const x=fp.getX(i),y=fp.getY(i),z=fp.getZ(i);
    if(z<=0)continue;
    const front=Math.pow(Math.max(0,z/.135),3);
    const cheek=Math.exp(-Math.pow((Math.abs(x)-.078)/.036,2)-Math.pow((y-.12)/.028,2));
    const socket=Math.exp(-Math.pow((Math.abs(x)-.065)/.035,2)-Math.pow((y-.174)/.031,2));
    fp.setZ(i,z+front*(cheek*.0015-socket*.004));
  }
  faceGeometry.computeVertexNormals();
  part(head,faceGeometry,skin).name='sculpted face';
  // A narrow bridge blends into a small nose tip rather than a spherical button.
  ellipsoid(head,skin,[0,.138,.128],[.013,.028,.012]);
  ellipsoid(head,skin,[0,.111,.141],[.016,.013,.015]);
  for(const side of [-1,1]) {
    ellipsoid(head,skin,[side*.012,.104,.136],[.007,.006,.008]);
    ellipsoid(head,material('#a76f50'),[side*.01,.102,.148],[.003,.0018,.002]);
  }
  const lip=material('#a65c46'),lowerLip=material('#cc8c72');
  stroke(head,[[-.033,.058,.117],[-.015,.06,.127],[0,.057,.13],[.015,.06,.127],[.033,.058,.117]],lip,.0035);
  stroke(head,[[-.027,.055,.122],[0,.049,.132],[.027,.055,.122]],lowerLip,.004);
  stroke(head,[[-.03,.057,.122],[0,.054,.134],[.03,.057,.122]],material('#62372b'),.0018);
  for(const side of [-1,1]) {
    const eye = group(head,[side*.065,.174,.118]); eye.rotation.y=side*.16;
    ellipsoid(eye,material('#eee9df'),[0,0,0],[.040,.027,.012]);
    ellipsoid(eye,material('#466e86',{roughness:.42}),[0,.001,.010],[.020,.023,.004]);
    ellipsoid(eye,material('#81a8b5',{roughness:.4}),[0,-.003,.013],[.015,.018,.002]);
    ellipsoid(eye,material('#1a2c35',{roughness:.35}),[0,.002,.015],[.009,.015,.002]);
    ellipsoid(eye,material('#ffffff',{roughness:.15}),[-.006,.011,.017],[.004,.0045,.001]);
    // Upper and lower lids sit against the eye, reducing the protruding eyeball look.
    stroke(eye,[[-.037,0,.002],[-.023,.024,.009],[0,.029,.01],[.024,.021,.009],[.037,0,.002]],material('#6c4934'),.003);
    stroke(eye,[[-.037,0,.002],[-.022,-.021,.008],[0,-.026,.009],[.025,-.019,.007],[.037,0,.002]],skin,.0035);
    stroke(head,[[side*.029,.218,.128],[side*.06,.23,.129],[side*.101,.216,.111]],material('#8a5d2c'),.006);
    const ear = outline(head,[[0,-.035],[.034,-.025],[.105,.066],[.028,.038],[-.008,.02]],.012,skin,[side*.128,.155,-.008]);
    ear.scale.x=side; ear.rotation.y=side*-.18;
    const inner=outline(ear,[[.014,-.013],[.032,-.006],[.075,.039],[.024,.019]],.003,material('#cf9479'),[0,0,.014]);
    inner.name='inner ear';
  }
  // Sculpted hair locks taper from curved elliptical cross sections.
  part(head,new THREE.SphereGeometry(.158,40,24,0,TAU,0,Math.PI*.40),hair,[0,.202,-.013],[1, .9, 1]);
  // Rear hair shell covers the nape below the cap; keep the face clear.
  part(head,new THREE.SphereGeometry(.155,40,24,Math.PI,Math.PI,Math.PI*.32,Math.PI*.56),hair,[0,.19,-.014],[1,.98,1]);
  for(let i=-4;i<=4;i++){const x=i*.029;stroke(head,[[x,.24,-.145],[x*1.05,.16,-.16],[x*.93,.075,-.112]],i%2?hairLight:hair,.003);}
  for(const side of [-1,1]) {
    for(let i=0;i<4;i++) {
      const lock=part(head,rings([[.225-i*.012,.002,.002,side*(.055+i*.033),.143-i*.012],[.25,.012,.015,side*(.045+i*.028),.15-i*.012],[.28,.018,.02,side*(.025+i*.025),.12-i*.012],[.29,.025,.023,side*(.015+i*.023),.07-i*.009],[.31,.012,.014,side*(.014+i*.02),.022]],18),i%2?hair:hairLight);
      lock.name='parted fringe';
      stroke(head,[[side*(.02+i*.024),.285,.091-i*.01],[side*(.045+i*.028),.27,.151-i*.012],[side*(.055+i*.033),.23-i*.01,.145-i*.012]],hair,.0015);
    }
    for(let i=0;i<3;i++)part(head,rings([[.04,.002,.002,side*(.145+i*.005),-.015-i*.027],[.12,.025,.025,side*.151,-.015-i*.026],[.22,.024,.03,side*.137,-.02-i*.025],[.27,.01,.015,side*.115,-.04-i*.022]],18),i%2?hairLight:hair);
  }
  // Soft cap: follows the skull then curves down behind it instead of standing upright.
  part(head,rings([[.24,.16,.145,0,-.027],[.28,.157,.139,0,-.045],[.335,.133,.129,0,-.084],[.36,.106,.11,0,-.15],[.34,.075,.09,0,-.225],[.28,.047,.067,0,-.29],[.22,.019,.036,0,-.32],[.18,.001,.001,0,-.33]],48,.015),material('#526841',{...heroSurface('cloth'),bumpScale:.0022,roughness:1,side:THREE.DoubleSide}));
  stroke(head,[[-.155,.252,-.025],[-.11,.263,.08],[0,.271,.11],[.11,.263,.08],[.155,.252,-.025]],leather,.009);
  for(let i=-5;i<=5;i++)ellipsoid(head,seam,[i*.024,.274-Math.abs(i)*.002,.115-Math.pow(i*.024,2)*2.1],[.002,.003,.0015]);

  const legL=group(body,[.085,.55,0]),legR=group(body,[-.085,.55,0]);
  for(const leg of [legL,legR]) {
    part(leg,rings([[-.36,.043,.048],[-.23,.051,.053],[-.12,.057,.058],[0,.062,.063]],32),pants);
    const foot=group(leg,[0,-.44,0]);foot.name='articulated boot';
    const boot=(rows,mat)=>{const geo=rings(rows,32);geo.translate(0,.44,0);return part(foot,geo,mat);};
    boot([[-.55,.045,.093,0,.035],[-.53,.069,.13,0,.041],[-.49,.068,.13,0,.041],[-.44,.056,.071,0,.005],[-.35,.055,.057],[-.28,.06,.06]],leather);
    boot([[-.55,.047,.096,0,.035],[-.535,.07,.133,0,.041]],black);
    boot([[-.3,.062,.062],[-.28,.062,.062],[-.27,.056,.056]],leather);
    stroke(foot,[[-.047,.13,.037],[-.05,.03,.05],[-.045,-.04,.105]],seam,.0015);
    leg.foot=foot;leg.bindPosition=leg.position.clone();
  }
  const armL=group(torso,[.195,.385,0]),armR=group(torso,[-.195,.385,0]);
  for(const [arm,side] of [[armL,1],[armR,-1]]) {
    arm.rotation.order='YXZ';
    part(arm,rings([[-.16,.064,.066],[-.12,.077,.076],[-.055,.077,.075],[.015,.06,.06],[.043,.003,.003]],32),green);
    part(arm,rings([[-.36,.035,.038],[-.27,.044,.044],[-.21,.047,.048],[-.13,.05,.052]],32),skin);
    part(arm,rings([[-.32,.04,.041],[-.28,.045,.047]],32),leather);
    const hand=ellipsoid(arm,skin,[0,-.386,.006],[.045,.06,.03]); arm.userData.hand=hand;
    for(let i=0;i<4;i++)ellipsoid(arm,skin,[-.025+i*.016,-.425,.008],[.009,.026,.012]);
    ellipsoid(arm,skin,[-side*.042,-.382,.012],[.015,.03,.019]).rotation.z=side*.4;
  }
  const sword=group(armR,[0,-.39,0]); sword.name='short sword';
  part(sword,new THREE.CylinderGeometry(.022,.025,.14,16),leather);
  for(let i=0;i<7;i++)part(sword,new THREE.TorusGeometry(.024,.002,4,16),black,[0,-.06+i*.018,0]).rotation.x=Math.PI/2;
  ellipsoid(sword,gold,[0,-.085,0],[.035,.025,.027]);
  outline(sword,[[-.13,-.012],[-.105,.025],[-.035,.012],[.035,.012],[.105,.025],[.13,-.012],[.025,-.025],[-.025,-.025]],.025,gold,[0,.09,-.012]);
  const steel=material('#d1dce0',{...heroSurface('steel'),bumpScale:.00035,metalness:.7,roughness:1});
  outline(sword,[[-.034,.115],[-.037,.55],[0,.75],[.037,.55],[.034,.115]],.012,steel,[0,0,-.006]);
  stroke(sword,[[0,.13,.014],[0,.54,.014],[0,.71,.009]],material('#e8eeee',{metalness:.7,roughness:.25}),.003);
  const glow=part(sword,new THREE.BoxGeometry(.1,.72,.05),new THREE.MeshBasicMaterial({color:0x7fc8ff,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}),[0,.42,0]);
  sword.userData.base=new THREE.Vector3(0,.12,0);sword.userData.tip=new THREE.Vector3(0,.78,0);
  // Shield lies in local x/z; the existing guard animation rotates it into view.
  const shield=group(armL,[.05,-.3,0]),face=group(shield);face.rotation.x=Math.PI/2;
  const shieldPoints=[[-.19,.19],[-.17,.28],[-.1,.255],[-.055,.3],[.01,.275],[.07,.31],[.12,.255],[.18,.28],[.205,.16],[.19,-.16],[.13,-.25],[0,-.31],[-.135,-.245],[-.2,-.14]];
  const wood=material('#ffffff',{...heroShieldSurface(),bumpScale:.0025,roughness:.85});
  const shieldMesh=outline(face,shieldPoints,.04,wood,[0,0,-.02]);shieldMesh.name='carved wooden shield';
  // ExtrudeGeometry's default UVs are in model units; map the face to the artwork.
  const uv=shieldMesh.geometry.attributes.uv;for(let i=0;i<uv.count;i++){uv.setXY(i,(uv.getX(i)+.23)/.46,(uv.getY(i)+.33)/.66);}uv.needsUpdate=true;
  stroke(face,[[-.17,.17,.025],[-.175,-.12,.025],[-.11,-.23,.025],[0,-.285,.025],[.11,-.23,.025],[.17,-.12,.025],[.18,.17,.025]],material('#b99764'),.008);
  // Crossed scabbard on the back stays attached to torso during all actions.
  const scabbard=group(torso,[.04,.23,-.13]);scabbard.rotation.z=-.55;
  ellipsoid(scabbard,leather,[0,0,0],[.037,.32,.025]);
  ellipsoid(scabbard,gold,[0,-.29,0],[.038,.036,.028]);
  part(scabbard,new THREE.CylinderGeometry(.02,.02,.12,12),leather,[0,.36,0]);
  return {root,body,torso,head,armL,armR,legL,legR,sword,shield,glow};
}
