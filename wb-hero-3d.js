/* wb-hero-3d.js — clay construction loop (three.js) for Journeyman Web Co.
   <wb-hero-3d mode="clay|wireframe" anim="on|off"> — fills its container.
   Story: blueprint footprint draws → shop building rises wall by wall → roof
   drops on → door/windows/sign snap in → pickup pulls up → the mast RINGS → reset. */
(() => {
if (customElements.get('wb-hero-3d')) return;
const THREE_URL = 'https://unpkg.com/three@0.160.0/build/three.module.js';
const C = { steel:0x5980a6, steelDeep:0x3c5a78, steelLight:0x9fb6cd, ink:0x24272a, inkSoft:0x4a4e52, paper:0xfafafa, neutral:0xcfd2d5, neutralDark:0xa8acb0, wood:0xb9bcbf };
const clamp01 = x => Math.max(0, Math.min(1, x));
const u = (t,a,b) => clamp01((t-a)/(b-a));
const smooth = x => x*x*(3-2*x);
const outBack = x => { const c1=1.70158, c3=c1+1; return 1 + c3*Math.pow(x-1,3) + c1*Math.pow(x-1,2); };
const outBounce = x => {
  const n1=7.5625, d1=2.75;
  if (x < 1/d1) return n1*x*x;
  if (x < 2/d1) return n1*(x-=1.5/d1)*x + 0.75;
  if (x < 2.5/d1) return n1*(x-=2.25/d1)*x + 0.9375;
  return n1*(x-=2.625/d1)*x + 0.984375;
};

class WbHero3d extends HTMLElement {
  static get observedAttributes(){ return ['mode','anim']; }
  connectedCallback(){ this._init(); }
  attributeChangedCallback(){ if (this._built){ this._teardown(); this._init(); } }
  disconnectedCallback(){ this._teardown(); }
  _teardown(){
    this._built = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._ro && this._ro.disconnect(); this._io && this._io.disconnect();
    if (this._renderer){ this._renderer.dispose(); this._renderer.domElement.remove(); }
    this._renderer = null;
  }
  async _init(){
    if (this._building || !this.isConnected) return;
    this._building = true;
    this.style.display='block'; this.style.overflow='hidden';
    this.style.width='100%'; this.style.height='100%';
    let p = this.parentElement;
    while (p && !p.classList.contains('blueprint') && p.clientHeight === 0){ p.style.height='100%'; p = p.parentElement; }
    let THREE;
    try { THREE = await import(THREE_URL); } catch(e){ console.warn('three failed to load', e); this._building=false; return; }
    if (!this.isConnected){ this._building=false; return; }
    const wire = this.getAttribute('mode') === 'wireframe';
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const animate = this.getAttribute('anim') !== 'off' && !reduced;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(6.2, 4.6, 9.4);
    const LOOK = new THREE.Vector3(0.2, 1.35, 0);
    camera.lookAt(LOOK);
    const renderer = new THREE.WebGLRenderer({ alpha:true, antialias:true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    if (!wire){ renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; }
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';
    this.appendChild(renderer.domElement);
    this._renderer = renderer; this._built = true; this._building = false;

    scene.add(new THREE.HemisphereLight(0xffffff, 0xb9c2cb, wire ? 1.2 : 1.05));
    const key = new THREE.DirectionalLight(0xffffff, 1.7); key.position.set(5, 9, 5);
    key.castShadow = !wire; key.shadow.mapSize.set(1024,1024);
    key.shadow.camera.left=-7; key.shadow.camera.right=7; key.shadow.camera.top=8; key.shadow.camera.bottom=-7;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xdfe8f0, 0.45); fill.position.set(-6, 3, -4); scene.add(fill);

    const mat = c => wire
      ? new THREE.MeshBasicMaterial({ color: C.steel, wireframe: true, transparent:true, opacity:0.9 })
      : new THREE.MeshStandardMaterial({ color: c, roughness: 0.88, metalness: 0.04 });
    const M = (geo, c, edges) => {
      const m = new THREE.Mesh(geo, mat(c));
      if (!wire){ m.castShadow = true; m.receiveShadow = true; }
      if (edges && !wire){
        m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30),
          new THREE.LineBasicMaterial({ color: C.ink, transparent:true, opacity:0.2 })));
      }
      return m;
    };
    const at = (m,x,y,z) => { m.position.set(x,y,z); return m; };
    const bottomBox = (w,h,d,c,edges) => { // origin at base so scaleY grows upward
      const g = new THREE.BoxGeometry(w,h,d); g.translate(0, h/2, 0);
      return M(g, c, edges);
    };

    const rig = new THREE.Group(); scene.add(rig); rig.rotation.y = -0.32;

    if (!wire){
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(40,40), new THREE.ShadowMaterial({ opacity: 0.16 }));
      ground.rotation.x = -Math.PI/2; ground.receiveShadow = true; rig.add(ground);
    }
    const grid = new THREE.GridHelper(22, 22, C.steel, C.steel);
    grid.material.transparent = true; grid.material.opacity = wire ? 0.25 : 0.12; rig.add(grid);

    const intro = [];
    const pop = (obj, delay) => { if (animate) obj.scale.setScalar(0.0001); rig.add(obj); intro.push({obj, delay}); return obj; };

    // — set dressing: traffic cone + pallet stack —
    const cone = new THREE.Group();
    cone.add(M(new THREE.CylinderGeometry(0.02,0.16,0.42,12), C.steel));
    cone.add(at(M(new THREE.BoxGeometry(0.34,0.03,0.34), C.steelDeep), 0, -0.2, 0));
    cone.position.set(-2.9, 0.21, 1.6); pop(cone, 0.5);
    const pallet = new THREE.Group();
    for (let i=0;i<2;i++) pallet.add(at(M(new THREE.BoxGeometry(0.8,0.09,0.6), C.wood, true), 0, 0.05+i*0.12, 0));
    pallet.position.set(2.9, 0, -1.7); pallet.rotation.y = 0.5; pop(pallet, 0.62);

    // — floating registration crosses —
    const crossGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.12,0,0), new THREE.Vector3(0.12,0,0),
      new THREE.Vector3(0,-0.12,0), new THREE.Vector3(0,0.12,0)]);
    const crossMat = new THREE.LineBasicMaterial({ color: C.ink, transparent:true, opacity: 0.38 });
    for (const [x,y,z,d] of [[-3.2,2.7,0.6,1.0],[3.3,1.6,0.8,1.15],[-2.4,0.8,-1.6,1.3]])
      pop(at(new THREE.LineSegments(crossGeo, crossMat), x, y, z), d);

    // ============ THE BUILD ============
    const site = new THREE.Group(); site.position.set(-0.1, 0, -0.3); rig.add(site);
    const steps = []; // {obj, t, dur, kind}
    const add = (obj, t, dur, kind) => {
      site.add(obj); steps.push({ obj, t, dur, kind,
        y0: obj.position.y, x0: obj.position.x, z0: obj.position.z });
      return obj;
    };

    // blueprint footprint (drawn outline)
    const fpPts = [];
    const rect = (x0,z0,x1,z1) => fpPts.push(
      new THREE.Vector3(x0,0.02,z0), new THREE.Vector3(x1,0.02,z0),
      new THREE.Vector3(x1,0.02,z0), new THREE.Vector3(x1,0.02,z1),
      new THREE.Vector3(x1,0.02,z1), new THREE.Vector3(x0,0.02,z1),
      new THREE.Vector3(x0,0.02,z1), new THREE.Vector3(x0,0.02,z0));
    rect(-1.85,-1.25, 0.75, 1.25);   // main shop
    rect( 0.75,-1.05, 2.25, 1.05);   // bay
    const footprint = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(fpPts),
      new THREE.LineBasicMaterial({ color: C.steelDeep, transparent:true, opacity:0.8 }));
    add(footprint, 0.0, 0.6, 'flat');

    // walls rise
    const mainWalls = bottomBox(2.6,1.9,2.5, C.neutral, true);
    add(mainWalls, 0.55, 0.9, 'rise'); mainWalls.position.x = -0.55;
    const bayWalls = bottomBox(1.5,1.3,2.1, C.neutralDark, true);
    add(bayWalls, 1.15, 0.8, 'rise'); bayWalls.position.x = 1.5;

    // gable roof (triangular prism) drops onto main shop
    const tri = new THREE.Shape();
    tri.moveTo(-1.45,0); tri.lineTo(1.45,0); tri.lineTo(0,0.8); tri.closePath();
    const roofGeo = new THREE.ExtrudeGeometry(tri, { depth: 2.7, bevelEnabled: false });
    roofGeo.translate(0, 0, -1.35);
    const roof = M(roofGeo, C.steel, true);
    roof.position.set(-0.55, 1.9, 0);
    add(roof, 2.05, 0.7, 'drop');
    // bay roof slab
    const bayRoof = at(M(new THREE.BoxGeometry(1.7,0.14,2.3), C.steelDeep, true), 1.5, 1.37, 0);
    add(bayRoof, 2.55, 0.55, 'drop');

    // facade details (front is +z)
    const door = at(M(new THREE.BoxGeometry(0.5,0.95,0.07), C.steelDeep, true), -1.15, 0.48, 1.26);
    add(door, 3.0, 0.45, 'pop');
    const win1 = at(M(new THREE.BoxGeometry(0.55,0.5,0.07), C.paper, true), -0.25, 1.05, 1.26);
    add(win1, 3.25, 0.45, 'pop');
    const win2 = at(M(new THREE.BoxGeometry(0.55,0.5,0.07), C.paper, true), 0.45, 1.05, 1.26);
    add(win2, 3.5, 0.45, 'pop');
    // rolling bay door with slats
    const rollDoor = new THREE.Group();
    for (let i=0;i<5;i++) rollDoor.add(at(M(new THREE.BoxGeometry(1.05,0.17,0.06), C.paper, false), 0, 0.12+i*0.19, 0));
    rollDoor.position.set(1.5, 0, 1.06);
    add(rollDoor, 3.75, 0.5, 'pop');
    // sign board flies onto the gable
    const sign = new THREE.Group();
    sign.add(M(new THREE.BoxGeometry(1.9,0.44,0.12), C.steelDeep, true));
    sign.add(at(M(new THREE.BoxGeometry(1.66,0.24,0.04), C.paper, false), 0, 0, 0.07));
    sign.position.set(-0.55, 2.25, 1.42);
    add(sign, 4.15, 0.6, 'fly');
    // mast on the roof peak
    const mast = new THREE.Group();
    mast.add(at(M(new THREE.CylinderGeometry(0.035,0.035,0.75,8), C.inkSoft), 0, 0.375, 0));
    mast.add(at(M(new THREE.SphereGeometry(0.07,12,10), C.steel), 0, 0.78, 0));
    mast.position.set(-0.55, 2.7, 0);
    add(mast, 4.7, 0.5, 'rise');

    // — pickup truck —
    const truck = new THREE.Group();
    const tBody = at(M(new THREE.BoxGeometry(1.55,0.34,0.72), C.steel, true), 0, 0.42, 0);
    truck.add(tBody);
    truck.add(at(M(new THREE.BoxGeometry(0.62,0.4,0.66), C.steelDeep, true), 0.22, 0.79, 0));
    truck.add(at(M(new THREE.BoxGeometry(0.56,0.2,0.6), C.paper, false), 0.23, 0.86, 0)); // cab glass
    truck.add(at(M(new THREE.BoxGeometry(0.62,0.14,0.6), C.inkSoft, false), -0.42, 0.62, 0)); // bed load
    const wheels = [];
    for (const [wx,wz] of [[0.5,0.4],[0.5,-0.4],[-0.5,0.4],[-0.5,-0.4]]){
      const wg = new THREE.Group();
      const wm = M(new THREE.CylinderGeometry(0.17,0.17,0.14,16), C.ink);
      wm.rotation.x = Math.PI/2; wg.add(wm);
      wg.position.set(wx, 0.17, wz); truck.add(wg); wheels.push(wg);
    }
    truck.rotation.y = Math.PI; // nose toward -x (driving in from the right)
    site.add(truck);
    const TR_FROM = new THREE.Vector3(6.5, 0, 2.2), TR_TO = new THREE.Vector3(1.7, 0, 2.2);
    truck.position.copy(TR_FROM);
    truck.visible = false;

    // — signal rings from the mast —
    const rings = [];
    for (let i=0;i<3;i++){
      const ring = at(new THREE.Mesh(new THREE.TorusGeometry(1,0.022,8,48),
        new THREE.MeshBasicMaterial({ color: C.steel, transparent:true, opacity:0 })), -0.65, 3.5, -0.3);
      ring.rotation.x = Math.PI/2; rig.add(ring); rings.push(ring);
    }

    // static frame = fully built
    const setDone = s => {
      s.obj.visible = true; s.obj.scale.setScalar(1);
      s.obj.position.set(s.x0, s.y0, s.z0);
      if (s.kind === 'rise') s.obj.scale.set(1,1,1);
    };
    if (!animate){
      intro.forEach(p => p.obj.scale.setScalar(1));
      steps.forEach(setDone);
      truck.visible = true; truck.position.copy(TR_TO);
    } else steps.forEach(s => { s.obj.visible = false; });

    const resize = () => {
      const w = this.clientWidth || 640, h = this.clientHeight || 480;
      renderer.setSize(w, h, false); camera.aspect = w/h; camera.updateProjectionMatrix();
      if (!animate) renderer.render(scene, camera);
    };
    this._ro = new ResizeObserver(resize); this._ro.observe(this); resize();
    if (!animate){ renderer.render(scene, camera); return; }

    let visible = true;
    this._io = new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: 0.02 });
    this._io.observe(this);

    // — timeline —
    const L = 13.5;                 // loop length (s)
    const TR0 = 5.3, TR1 = 6.9;     // truck drive
    const R0 = 7.3, R1 = 10.2;      // ring phase
    const CL = 11.4;                // clear phase
    const t0 = performance.now();

    const loop = (now) => {
      this._raf = requestAnimationFrame(loop);
      if (!visible || !this._built) return;
      const t = (now - t0) / 1000;

      for (const p of intro){
        const k = u(t, p.delay, p.delay + 0.75);
        p.obj.scale.setScalar(k >= 1 ? 1 : Math.max(0.0001, outBack(k)));
      }
      rig.rotation.y = -0.32 + Math.sin(t * 0.16) * 0.22;
      camera.position.y = 4.6 + Math.sin(t * 0.1) * 0.22;
      camera.lookAt(LOOK);
      cone.rotation.y = Math.sin(t*0.5)*0.25;

      const lt = t % L;
      const out = smooth(u(lt, CL, CL + 0.55)); // global dissolve at loop end

      steps.forEach(s => {
        const k = u(lt, s.t, s.t + s.dur);
        if (k <= 0){ s.obj.visible = false; return; }
        s.obj.visible = true;
        const ok = 1 - out;
        if (s.kind === 'flat'){
          s.obj.scale.set(Math.max(0.0001, smooth(k)), 1, Math.max(0.0001, smooth(k)));
          if (s.obj.material) s.obj.material.opacity = 0.8 * ok;
        } else if (s.kind === 'rise'){
          s.obj.scale.set(1, Math.max(0.0001, outBack(k) * ok) , 1);
        } else if (s.kind === 'drop'){
          s.obj.scale.setScalar(Math.max(0.0001, ok));
          s.obj.position.y = s.y0 + (1 - outBounce(k)) * 2.4;
        } else if (s.kind === 'pop'){
          s.obj.scale.setScalar(Math.max(0.0001, outBack(k) * ok));
        } else if (s.kind === 'fly'){
          s.obj.scale.setScalar(Math.max(0.0001, clamp01(k*1.5) * ok));
          const e = outBack(k);
          s.obj.position.z = s.z0 + (1 - e) * 2.2;
          s.obj.position.y = s.y0 + (1 - e) * 0.8;
        }
      });

      // truck drives in, dips on stop, leaves during clear
      const drive = smooth(u(lt, TR0, TR1));
      const leave = smooth(u(lt, CL, CL + 0.9));
      if (lt >= TR0 && leave < 1){
        truck.visible = true;
        truck.position.lerpVectors(TR_FROM, TR_TO, drive);
        truck.position.x += leave * -7; // exits left
        const moving = (drive > 0 && drive < 1) || leave > 0;
        if (moving) wheels.forEach(w => { w.rotation.z += 0.32; });
        const stopK = u(lt, TR1 - 0.15, TR1 + 0.25);
        tBody.rotation.z = (stopK > 0 && stopK < 1) ? Math.sin(stopK * Math.PI) * -0.05 : 0;
        truck.position.y = drive < 1 ? Math.abs(Math.sin(lt * 22)) * 0.012 * (1 - drive) : 0;
      } else truck.visible = false;

      // the mast rings
      const ringEnv = u(lt, R0, R0 + 0.2) * (1 - u(lt, R1 - 0.3, R1));
      rings.forEach((ring, i) => {
        let op = 0, sc = 0.3;
        for (const b of [R0, R0 + 1.0, R0 + 2.0]){
          const rt = u(lt, b + i * 0.24, b + i * 0.24 + 1.1);
          if (rt > 0 && rt < 1){ sc = 0.3 + rt * 1.5; op = (1 - rt) * 0.75 * ringEnv; }
        }
        ring.scale.setScalar(Math.max(0.0001, sc)); ring.material.opacity = op;
      });
      mast.rotation.z = Math.sin(lt * 40) * 0.06 * ringEnv;
      if (sign.visible && ringEnv > 0) sign.scale.multiplyScalar(1 + Math.sin(lt * 12) * 0.03 * ringEnv);

      renderer.render(scene, camera);
    };
    this._raf = requestAnimationFrame(loop);
  }
}
customElements.define('wb-hero-3d', WbHero3d);
})();
