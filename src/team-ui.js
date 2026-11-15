// 队伍模拟页面：选地图和回合、在格子上摆放干员、看回放和每人的输出
(function(){
  const U=window.__ui; if(!U||typeof teamRun!=='function') return;
  const {st,ava,selOf,defName,fmt}=U;
  const $=id=>document.getElementById(id);
  const byId=id=>OPS.find(o=>o.id===id);
  const STORE='weishu.team.v1';
  const TS={map:0,round:'r5',mode:'mode_multi_abyss',spTypes:[],spPick:{},tok:{},members:[],L:{},subL:{},cold:50,xAtk:0,xAspd:0,xHp:0,hurt:true,stunt:0,pick:null,sel:null,fi:0,filter:'',q:'',routes:true,real:true};
  // 第一次打开时放一套示例阵容（战场 #01、第 5 回合），之后记住自己的摆放
  let saved=null; try{ saved=JSON.parse(localStorage.getItem(STORE)||'null'); }catch(e){}
  if(saved) for(const k of ['map','round','mode','tok','members','L','subL','cold','xAtk','xAspd','xHp','hurt','stunt','routes','real','spTypes','spPick']){ if(k in saved) TS[k]=saved[k]; }
  else TS.members=[{id:'indigo',r:3,c:4},{id:'bluep',r:2,c:6},{id:'thorn2',r:1,c:6},{id:'thorns',r:0,c:1},{id:'irene',r:3,c:2}];
  TS.members=(TS.members||[]).filter(m=>byId(m.id));
  // 阵容快照：位置之外还带上每名干员的精锐、技能、装备、变形同构体（这些设置和单人排行共用）
  const blankEq=()=>[{id:'',adv:false},{id:'',adv:false}];
  const snap=()=>({members:TS.members.map(m=>({id:m.id,r:m.r,c:m.c,e:!!st.elite[m.id],s:st.skill[m.id],q:JSON.parse(JSON.stringify(st.eq[m.id]||blankEq())),b:st.bond[m.id]||''})),L:Object.assign({},TS.L),subL:Object.assign({},TS.subL)});
  const applyOps=list=>{ for(const m of list){ if(!byId(m.id))continue; if(m.e!=null)st.elite[m.id]=!!m.e; if(m.s!=null)st.skill[m.id]=m.s; if(Array.isArray(m.q)&&m.q.length)st.eq[m.id]=JSON.parse(JSON.stringify(m.q)); if(m.b!=null)st.bond[m.id]=m.b; } };
  const applySnap=sn=>{ const ms=(sn.members||[]).filter(m=>byId(m.id)); applyOps(ms); TS.members=ms.map(m=>({id:m.id,r:m.r,c:m.c})); TS.L=Object.assign({},sn.L||{}); TS.subL=Object.assign({},sn.subL||{}); TS.sel=null; TS.pick=null; };
  if(saved&&saved.members) applyOps(saved.members);
  const save=()=>{ try{ const o={}; for(const k of ['map','round','mode','tok','L','subL','cold','xAtk','xAspd','xHp','hurt','stunt','routes','real','spTypes','spPick']) o[k]=TS[k]; o.members=snap().members; localStorage.setItem(STORE,JSON.stringify(o)); }catch(e){} };
  const MAXN=8;
  const curMap=()=>FIELD.maps[TS.map]||FIELD.maps[0];
  const bossOf=rk=>rk.startsWith('b:')?FIELD.bosses.find(b=>b.id===rk.slice(2)):null;
  const roundOf=rk=>bossOf(rk)||FIELD.rounds[(+rk.slice(1)||1)-1];
  const roundNoOf=rk=>bossOf(rk)?bossOf(rk).round:roundOf(rk).n;
  const curBoss=()=>bossOf(TS.round);
  const curRound=()=>roundOf(TS.round);
  const board=()=>teamBoard(curMap(),!!curBoss(),TS.tok);
  const memberAt=(r,c)=>TS.members.find(m=>m.r===r&&m.c===c);
  const coreName=c=>CORE[c].name;
  const isRanged=o=>!!o.r;
  let res=null, timer=0, playT=0;
  // 旧版本存的是难度序号，换成编号
  if(typeof TS.mode==='number') TS.mode=(FIELD.modes[TS.mode]||FIELD.modes[3]).id;
  const curMode=()=>FIELD.modes.find(m=>m.id===TS.mode)||FIELD.modes[3];
  const roundNo=()=>roundNoOf(TS.round);
  const SPN=()=>curMode().single?2:3;   // 本局特训类型数：联机 3 种，单人 2 种
  const spType=id=>FIELD.special.types.find(t=>t.id===id);
  // 某类型在本回合可抽到的特训敌人：前 7 回合用前半程名单，之后用后半程名单；去掉本难度禁用的
  const spPool=(type,rk=TS.round)=>{ const half=roundNoOf(rk)<=FIELD.special.firstHalfMaxRound, ban=new Set(curMode().inactive||[]);
    const all=FIELD.special.entries.filter(x=>x.type===type&&!ban.has(x.key)); const h=all.filter(x=>x.first===half); return h.length?h:all; };
  // 本回合的抽取结果（可手动改）；没设过时用本局组合的第一种，没选组合则是“特异”
  function curPick(rk=TS.round){ const st0=TS.spPick[rk]||{}; let type=st0.type||(TS.spTypes[0]||'SPECIAL');
    if(type==='NONE') return {type};
    if(!spType(type)) type='SPECIAL';
    const pool=spPool(type,rk); let x=pool.find(p=>p.key===st0.entry)||pool[0]; if(!x) return {type:'NONE'};
    const n=x.N.includes(st0.n)?st0.n:x.N[0], e=x.E.includes(st0.e)?st0.e:x.E[0];
    return {type,entry:x.key,n,e,x,pool}; }
  const spOf=rk=>{ const p=curPick(rk); return p.type==='NONE'?null:{entry:p.entry,n:p.n,e:p.e}; };
  const curSp=()=>spOf(TS.round);
  const curQueue=()=>teamExpand(curRound(),curSp());
  const EI=(typeof ENEMY_IMG!=='undefined')?ENEMY_IMG:{};
  // 敌人头像；没有图的用名字首字代替
  const foeFace=(key,name)=>EI[key]?`<img src="${EI[key]}" alt="" width="64" height="64">`:`<b>${String(name||'?').replace(/[“”"]/g,'')[0]}</b>`;
  // 敌人种类的颜色：同一种敌人在路线和列表里用同一个颜色
  const EC=['#ff5a5a','#ffa94d','#ffd43b','#69db7c','#38d9a9','#4dabf7','#9775fa','#f783ac','#e599f7','#a9e34b'];
  function canPlace(op,r,c){ const d=board().deploy(r,c); return d===1||(d===2&&isRanged(op)); }

  // ── 运行 ──
  // 按阵容快照和回合生成一局的设置；领袖回合用领袖战的场地，落在不能部署的格子上的干员不参与
  function setupFor(sn,rk,trace){
    const boss=bossOf(rk), B=teamBoard(curMap(),!!boss,TS.tok);
    const ok=(op,r,c)=>{ const d=B.deploy(r,c); return d===1||(d===2&&isRanged(op)); };
    const members=sn.members.filter(m=>byId(m.id)&&ok(byId(m.id),m.r,m.c)).map(m=>({op:byId(m.id),elite:!!m.e,sel:{skill:m.s==null?-1:m.s,eq:m.q||blankEq(),bond:m.b||null},r:m.r,c:m.c}));
    const base=Object.assign({},st.cp,{own:0,xAtk:+TS.xAtk||0,xAspd:+TS.xAspd||0,xHp:+TS.xHp||0,hurt:TS.hurt!==false,stunt:+TS.stunt||0,cold:+TS.cold||0,devour:0,eBat:0});
    const L={}; for(const c in CORE) if(!CORE[c].none) L[c]=(sn.L||{})[c]??150;
    const subL={}; for(const s in SUBS) subL[s]=(sn.subL||{})[s]??50;
    return {map:curMap(),round:boss?null:roundOf(rk),boss,mode:curMode(),sp:spOf(rk),tok:TS.tok,members,L,subL,base,trace,skipped:sn.members.length-members.length};
  }
  const setup=trace=>setupFor(snap(),TS.round,trace);
  function run(){ clearTimeout(timer); timer=setTimeout(()=>{ stop(); TS.ef=TS.ef&&enemyKinds().some(k=>k.key===TS.ef)?TS.ef:null; res=TS.members.some(m=>canPlace(byId(m.id),m.r,m.c))?teamRun(setup(true)):null; TS.fi=0; render(); save(); },30); }

  // ── 渲染 ──
  const TILECLS={'.':'road','|':'fence','#':'void','f':'floor','S':'start','T':'start','E':'end','H':'high','i':'infect','m':'mire','g':'grass','u':'speed'};
  // 格子坐标（列 0–8、行 0–3，可以是小数）→ 截图上的像素位置。
  // 截图上的场地是透视的：用四个角求出单应矩阵，格子层用 CSS matrix3d 贴上去，头像和敌人按投影点摆放、保持正立。
  function homography(src,dst){
    const A=[],b=[]; for(let i=0;i<4;i++){ const [x,y]=src[i],[X,Y]=dst[i];
      A.push([x,y,1,0,0,0,-X*x,-X*y]); b.push(X); A.push([0,0,0,x,y,1,-Y*x,-Y*y]); b.push(Y); }
    const n=8, M=A.map((r,i)=>r.concat(b[i]));
    for(let i=0;i<n;i++){ let p=i; for(let r=i+1;r<n;r++) if(Math.abs(M[r][i])>Math.abs(M[p][i])) p=r; [M[i],M[p]]=[M[p],M[i]];
      for(let r=0;r<n;r++) if(r!==i){ const k=M[r][i]/M[i][i]; for(let c=i;c<=n;c++) M[r][c]-=k*M[i][c]; } }
    const h=M.map((r,i)=>r[n]/r[i]); h.push(1); return h;
  }
  const GW=900, GH=400;   // 格子层的逻辑尺寸：每格 100×100
  function stageOf(){
    const key=curMap().id+'_'+(curBoss()?3:1), img=(typeof MAP_IMG!=='undefined')&&MAP_IMG[key], Q=(typeof MAP_QUAD!=='undefined')&&MAP_QUAD.quad[key];
    if(!img||!Q) return null;
    // 四角顺序：左下、右下、右上、左上（格子外框）；格子层坐标：左上 (0,0)，右下 (900,400)
    const h=homography([[0,GH],[GW,GH],[GW,0],[0,0]],Q);
    const P=(X,Y)=>{ const w=h[6]*X+h[7]*Y+1; return [(h[0]*X+h[1]*Y+h[2])/w,(h[3]*X+h[4]*Y+h[5])/w]; };
    const at=(c,r)=>P((c+0.5)*100,(TEAM.H-1-r+0.5)*100);
    const cw=(c,r)=>{ const a=at(c-0.5,r), b=at(c+0.5,r); return Math.hypot(a[0]-b[0],a[1]-b[1]); };
    const m3=`matrix3d(${h[0]},${h[3]},0,${h[6]},${h[1]},${h[4]},0,${h[7]},0,0,1,0,${h[2]},${h[5]},0,1)`;
    return {img,W:MAP_QUAD.w,H:MAP_QUAD.h,at,cw,m3};
  }
  function fitStage(){ const box=$('tBoard'), sg=box.querySelector('.stage'); if(!sg)return; const k=box.clientWidth/(+sg.dataset.w);
    sg.style.transform=`scale(${k})`; box.style.height=(+sg.dataset.h*k)+'px'; }
  function renderBoard(){
    const B=board(), sel=TS.sel&&memberAt(TS.sel[0],TS.sel[1]), pick=TS.pick&&byId(TS.pick);
    let rng=new Set();
    if(sel){ const op=byId(sel.id); for(const [dr,dc] of teamRange(op,!!st.elite[op.id],false,teamSkillIndex(op,st.skill[op.id]))) rng.add((sel.r+dr)+','+(sel.c+dc)); }
    const fr=res&&res.frames&&res.frames[TS.fi];
    const agIdx=new Map(); if(res) res.res.forEach((x,i)=>{ if(!x.healer) agIdx.set(x.m.r+','+x.m.c,i); });
    const SG=TS.real?stageOf():null;
    const HC=heatCells();
    const hpAt=new Map(); if(fr&&fr.u) for(const [r,c,hp,dn] of fr.u) hpAt.set(r+','+c,{hp,dn});
    const unit=(m,r,c)=>{ const op=byId(m.id), ai=agIdx.get(r+','+c), on=fr&&ai!=null&&fr.ag[ai]&&fr.ag[ai][0];
      const eat=res&&res.res.find(x=>x.m.r===r&&x.m.c===c&&x.eaten&&x.eaten.dead), hp=res&&res.hurtOn&&TS.fi>0?hpAt.get(r+','+c):null;
      return {op,hp,cls:'pc'+(on?' on':'')+(eat||(hp&&hp.dn)?' gone':'')+(sel&&sel.r===r&&sel.c===c?' sel':'')+(canPlace(op,r,c)?'':' bad')}; };
    const hpBar=u=>u.hp&&!u.hp.dn?`<i class="uhp${u.hp.hp<0.35?' low':''}" style="width:${(u.hp.hp*100).toFixed(0)}%"></i>`:'';
    let h='';
    for(let r=TEAM.H-1;r>=0;r--) for(let c=0;c<TEAM.W;c++){
      const cell=B.cell[r][c], m=memberAt(r,c), dep=B.deploy(r,c);
      const can=pick?(dep===1||(dep===2&&isRanged(pick))):false;
      const cls=['tc','t-'+(TILECLS[cell.ch]||'void')];
      if(dep) cls.push('dep'); if(cell.obs) cls.push('o-'+cell.obs); if(cell.opt) cls.push('opt');
      if(rng.has(r+','+c)) cls.push('inr'); if(can&&!m) cls.push('can');
      if(sel&&sel.r===r&&sel.c===c) cls.push('sel');
      const hv=HC&&HC.cells[r+','+c]; let hstyle='';
      if(hv){ cls.push('hm'); if(HC.best===r+','+c) cls.push('hbest'); hstyle=` style="--hm:${(0.12+0.6*hv.n).toFixed(2)}"`; }
      let inner='';
      if(!SG){
        if(m){ const u=unit(m,r,c); inner=`<span class="${u.cls}">${ava(u.op)}${hpBar(u)}</span>`; }
        else if(cell.obs==='crate') inner='<span class="ob" title="阻隔工事：敌人绕行，不能部署">▦</span>';
        else if(cell.obs==='plat') inner='<span class="ob" title="射击台：敌人不能通行，只能部署远程干员">▲</span>';
        else if(cell.ch==='S'||cell.ch==='T') inner='<span class="mk">入</span>';
        else if(cell.ch==='E') inner='<span class="mk">出</span>';
      } else if(cell.opt&&!m) inner=`<span class="optk">${cell.obs==='crate'?'工事':cell.obs==='plat'?'射击台':'空'}</span>`;
      const tip=(cell.obs==='crate'?'阻隔工事':cell.obs==='plat'?'射击台（仅远程）':(TEAM.TILE_NAME[cell.ch]||''))+(cell.opt?'（随机障碍位：点击切换）':'');
      if(hv&&!SG) inner+=`<span class="hv ${hv.cls||''}">${hv.lab}</span>`;
      h+=`<button type="button" class="${cls.join(' ')}"${hstyle} data-r="${r}" data-c="${c}" title="${tip}" aria-label="第 ${TEAM.H-r} 行第 ${c+1} 列 ${tip}${m?' '+byId(m.id).name:''}">${inner}</button>`;
    }
    const routes=[], R0=curRound(), kinds=enemyKinds(), Q=curQueue();
    const showRoutes=TS.ef||(TS.routes&&(!fr||TS.fi===0));
    if(showRoutes){ const seen=new Map();
      R0.routes.forEach((rt,i)=>{ const keys=[...new Set(Q.filter(s=>s.route===i).map(s=>s.key))]; if(!keys.length)return;
        if(TS.ef&&!keys.includes(TS.ef))return;
        const t=teamRoute(B,rt), k=JSON.stringify(t.line.map(p=>p.p));
        if(seen.has(k)){ seen.get(k).keys.push(...keys); return; }
        const o={fly:rt.fly,pts:t.line.map(p=>p.p),keys:[...keys],patrol:t.patrol}; seen.set(k,o); routes.push(o); }); }
    const rcol=rt=>TS.ef?EC[kinds.findIndex(x=>x.key===TS.ef)%EC.length]:null;
    const meta=res?new Map(res.enemies.map(e=>[e.uid,e])):null;
    const box=$('tBoard');
    if(SG){
      // 实景：截图 + 透视格子 + 正立的头像与敌人
      let ov=`<svg class="routes${TS.ef?' focus':''}" viewBox="0 0 ${SG.W} ${SG.H}" aria-hidden="true"><defs><marker id="arw" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="context-stroke"/></marker></defs>`;
      routes.forEach((rt,j)=>{ const off=TS.ef?(j-(routes.length-1)/2)*3:0, c=rcol(rt);
        ov+=`<polyline points="${rt.pts.map(p=>SG.at(p[1],p[0]).map(v=>(v+off).toFixed(1)).join(',')).join(' ')}" class="${rt.fly?'fly':'gnd'}"${c?` style="stroke:${c}"`:''} marker-end="url(#arw)"/>`; });
      ov+='</svg>';
      const units=[]; for(const m of TS.members){ const u=unit(m,m.r,m.c), p=SG.at(m.c,m.r), w=SG.cw(m.c,m.r)*0.74; units.push({y:p[1],html:`<span class="su ${u.cls}" style="left:${p[0].toFixed(1)}px;top:${p[1].toFixed(1)}px;width:${w.toFixed(1)}px;height:${w.toFixed(1)}px">${ava(u.op)}${hpBar(u)}</span>`}); }
      if(fr) for(const [uid,y,x,hp,bl,hd] of fr.en){ const e=meta.get(uid)||{}, p=SG.at(x,y), w=SG.cw(Math.max(0,Math.min(8,x)),Math.max(0,Math.min(3,y)))*(e.boss?0.42:0.24);
        const dim=TS.ef&&e.key!==TS.ef;
        units.push({y:p[1]+0.1,html:`<span class="foe sf${e.fly?' fly':''}${e.boss?' boss':''}${bl?' bl':''}${hd?' hid':''}${dim?' dim':''}" style="left:${p[0].toFixed(1)}px;top:${p[1].toFixed(1)}px;width:${(w*1.5).toFixed(1)}px" title="${e.name||''} ${Math.round(hp*100)}%">${foeFace(e.key,e.name)}<i style="width:${(hp*100).toFixed(0)}%"></i></span>`}); }
      if(HC) for(const k in HC.cells){ const [r,c]=k.split(',').map(Number), hv=HC.cells[k], p=SG.at(c,r-0.32); units.push({y:p[1]+50,html:`<span class="shv hv ${hv.cls||''}" style="left:${p[0].toFixed(1)}px;top:${p[1].toFixed(1)}px">${hv.lab}</span>`}); }
      units.sort((a,b)=>a.y-b.y);   // 远的先画，近的盖在上面
      box.className='stagebox'+(pick?' arming':'');
      box.innerHTML=`<div class="stage" data-w="${SG.W}" data-h="${SG.H}" style="width:${SG.W}px;height:${SG.H}px"><img src="${SG.img}" alt="${curMap().name} 游戏内截图" width="${SG.W}" height="${SG.H}"><div class="sgrid" style="width:${GW}px;height:${GH}px;transform:${SG.m3}">${h}</div><div class="sov">${ov}${units.map(u=>u.html).join('')}</div></div>`;
      fitStage();
    } else {
      const X=c=>((c+0.5)/TEAM.W*100), Y=r=>((TEAM.H-1-r+0.5)/TEAM.H*100);
      let ov='';
      if(routes.length){ ov+='<svg class="routes" viewBox="0 0 900 400" preserveAspectRatio="none" aria-hidden="true">';
        for(const rt of routes){ const c=rcol(rt); ov+=`<polyline points="${rt.pts.map(p=>(X(p[1])*9).toFixed(0)+','+(Y(p[0])*4).toFixed(0)).join(' ')}" class="${rt.fly?'fly':'gnd'}"${c?` style="stroke:${c}"`:''}/>`; } ov+='</svg>'; }
      if(fr) for(const [uid,y,x,hp,bl,hd] of fr.en){ const e=meta.get(uid)||{};
        ov+=`<span class="foe${e.fly?' fly':''}${e.boss?' boss':''}${bl?' bl':''}${hd?' hid':''}${TS.ef&&e.key!==TS.ef?' dim':''}" style="left:${X(x).toFixed(2)}%;top:${Y(y).toFixed(2)}%" title="${e.name||''} ${Math.round(hp*100)}%">${foeFace(e.key,e.name)}<i style="width:${(hp*100).toFixed(0)}%"></i></span>`; }
      box.className='board'+(pick?' arming':''); box.style.height='';
      box.innerHTML=h+`<div class="ov">${ov}</div>`;
    }
    $('tViewMode').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',(b.dataset.real==='1')===!!SG));
    $('tStageCap').textContent=`战场 ${curMap().name} · ${curBoss()?'第 '+curBoss().round+' 回合 · '+curBoss().name:'第 '+curRound().n+' 回合'} · ${curMode().name}${curPick().x?' · 特训：'+spType(curPick().type).name:''}`;
  }
  function renderSide(){
    const MI=(typeof MAP_IMG!=='undefined')?MAP_IMG:{};
    $('tMap').innerHTML=FIELD.maps.map((m,i)=>`<button type="button" class="mthumb" data-map="${i}" aria-pressed="${i===TS.map}" title="战场 ${m.name}">${MI[m.id+'_1']?`<img src="${MI[m.id+'_1']}" alt="" width="780" height="360">`:''}<span>${m.name}</span></button>`).join('');
    const ro=FIELD.rounds.map(r=>`<option value="r${r.n}"${TS.round==='r'+r.n?' selected':''}>第 ${r.n} 回合 · 限时 ${r.T*2} 秒</option>`).join('');
    const bo=[14,15].map(n=>`<optgroup label="第 ${n} 回合 · 领袖">${FIELD.bosses.filter(b=>b.round===n).map(b=>`<option value="b:${b.id}"${TS.round==='b:'+b.id?' selected':''}>${b.name}</option>`).join('')}</optgroup>`).join('');
    $('tRound').innerHTML=`<optgroup label="普通回合">${ro}</optgroup>${bo}`;
    const grp=(label,list)=>`<optgroup label="${label}">${list.map(m=>`<option value="${m.id}"${m.id===TS.mode?' selected':''}>${m.name}</option>`).join('')}</optgroup>`;
    $('tMode').innerHTML=grp('联合模拟',FIELD.modes.filter(m=>!m.single))+grp('独立模拟',FIELD.modes.filter(m=>m.single));
    renderSpecial();
    const B=board(), opts=B.cell.flat().filter(c=>c.opt).length;
    $('tTok').textContent=opts?`这张图有 ${opts} 个随机障碍位（虚线框），游戏里每局可能是阻隔工事、射击台或空地，点击格子切换。`:'';
    // 盟约：按在场阵容自动判定
    const members=TS.members.map(m=>({op:byId(m.id),sel:selOf(byId(m.id))}));
    const bd=teamBonds(members);
    const cores=Object.keys(bd.cores).filter(c=>bd.cores[c].n>0).sort((a,b)=>bd.cores[b].n-bd.cores[a].n);
    const subs=Object.keys(bd.subs).filter(s=>bd.subs[s].n>0&&SUBS[s].fx).sort((a,b)=>bd.subs[b].n-bd.subs[a].n);
    const row=(name,n,need,on,six,key,val,kind)=>`<div class="bd${on?' on':''}"><span class="nm">${name}</span><span class="ct">${n}/${need}${six?' · 6 人':''}</span>${on?`<input type="number" min="0" max="999" step="5" value="${val}" data-${kind}="${key}" aria-label="${name}层数"><span class="muted">层</span>`:'<span class="muted">未激活</span>'}</div>`;
    $('tBonds').innerHTML=(cores.map(c=>row(coreName(c),bd.cores[c].n,(FIELD.bonds||{})[coreName(c)]||3,bd.cores[c].on,bd.cores[c].six&&CORE[c].six,c,TS.L[c]??150,'tl')).join('')
      +subs.map(s=>row(s,bd.subs[s].n,bd.subs[s].need,bd.subs[s].on,false,s,TS.subL[s]??50,'ts')).join(''))||'<p class="hint">放上干员后，这里会按在场人数自动判定盟约。</p>';
  }
  function renderPalette(){
    const q=TS.q.trim(), fl=TS.filter;
    const list=OPS.filter(o=>(!fl||o.bonds.includes(fl))&&(!q||o.name.includes(q)));
    const used=new Set(TS.members.map(m=>m.id));
    const tiers=[6,5,4,3,2,1];
    $('tPal').innerHTML=tiers.map(t=>{ const l=list.filter(o=>U.TIERN[o.tier]===t); if(!l.length)return '';
      return `<div class="pg"><span class="en">${U.ROMAN[t]}</span><div class="pl">${l.map(o=>`<button type="button" class="pk${TS.pick===o.id?' armed':''}${used.has(o.id)?' used':''}" data-pick="${o.id}" title="${o.name} · ${o.cls}${o.r?'':' · 近战'}" aria-pressed="${TS.pick===o.id}">${ava(o)}<span>${o.name}</span></button>`).join('')}</div></div>`; }).join('')||'<p class="hint">没有符合的干员。</p>';
    $('tCount').textContent=`${TS.members.length} / ${MAXN}`;
    const bad=TS.members.filter(m=>!canPlace(byId(m.id),m.r,m.c)).map(m=>byId(m.id).name);
    $('tHint').textContent=(bad.length?`${bad.join('、')} 所在的格子在这张图上不能部署（标红），暂不参与计算，请移动到别的格子。`:'')+(TS.pick?`已选中 ${byId(TS.pick).name}，点亮着的格子可以放置${byId(TS.pick).r?'':'（近战干员不能上高台和射击台）'}。再点一次头像取消。`:'点选干员，再点战场上的格子放置；点场上的干员可以调整技能装备、移动或撤下。');
  }
  const fmtT=s=>s==null?'—':(s<60?s.toFixed(1)+' 秒':Math.floor(s/60)+' 分 '+(s%60).toFixed(0).padStart(2,'0')+' 秒');
  function renderResults(){
    const R=curRound(), boss=curBoss();
    if(!res){ $('tKpis').innerHTML=''; $('tList').innerHTML='<p class="hint" style="padding:14px 16px">还没有干员上场。</p>'; $('tReplay').hidden=true; return; }
    $('tReplay').hidden=!res.frames||!res.frames.length;
    let k='';
    if(boss){ const b=res.boss||{left:0,hp:1};
      k+=`<div class="kpi"><b>${b.dead?fmtT(b.t):Math.round(b.left/b.hp*100)+'%'}</b><small>${b.dead?'击倒领袖用时':'领袖剩余生命（算到 '+Math.round(res.dur)+' 秒）'}</small></div>`;
      k+=`<div class="kpi"><b>${b.dead&&b.t<=res.T?'限时内':b.dead?'超时':'未击倒'}</b><small>限时 ${res.T} 秒，超时后每秒扣 1 生命</small></div>`;
    } else {
      const left=res.alive+(res.total-res.spawned);
      k+=`<div class="kpi"><b>${res.leakedN?'漏 '+res.leakedN:left?'未清完':'清场'}</b><small>${[left?'时间到还剩 '+left+' 个':'',res.lifeLoss?'扣 '+res.lifeLoss+' 目标生命（每回合至多 10）':'没有敌人漏过去'].filter(Boolean).join('，')}</small></div>`;
      k+=`<div class="kpi"><b>${res.cleared?fmtT(res.dur):fmtT(res.dur)}</b><small>${res.cleared&&!res.leakedN?'清场用时':res.cleared?'战斗结束用时':'战斗时长'}（限时 ${res.T} 秒）</small></div>`;
    }
    const tot=res.res.reduce((a,x)=>a+x.total,0);
    k+=`<div class="kpi"><b>${res.killed}<small class="muted"> / ${res.total}</small></b><small>击倒敌人${res.hurtOn?' · 干员倒下 '+res.falls+' 次':''}</small></div>`;
    k+=`<div class="kpi"><b>${fmt(tot/Math.max(1,res.dur))}</b><small>全队每秒伤害</small></div>`;
    $('tKpis').innerHTML=k;
    const rows=res.res.slice().sort((a,b)=>b.total-a.total), max=Math.max(1,...rows.map(x=>x.total));
    $('tList').innerHTML=rows.map((x,i)=>{ const o=x.m.op, tags=[];
      if(x.healer) tags.push('<span class="tag">治疗位，不造成伤害</span>');
      if(x.dv) tags.push(`<span class="tag eq">吞噬身前干员 · 基础攻击 +${x.dv.atk}</span>`);
      if(x.eaten) tags.push(`<span class="tag eq">被吞噬 · ${x.eaten.dead?'阵亡':x.eaten.alive?'存活':'复活'}</span>`);
      const sk=U.skillLabel(o,st.elite[o.id]?1:0); if(sk&&!x.healer) tags.push(`<span class="tag">${sk}</span>`);
      if(res.hurtOn&&x.hurt){ const H=x.hurt; if(H.falls) tags.push(`<span class="tag bad">倒下 ${H.falls} 次</span>`); if(H.taken) tags.push(`<span class="tag">受到 ${fmt(H.taken)}</span>`); if(H.healOut) tags.push(`<span class="tag ok">治疗 ${fmt(H.healOut)}</span>`); }
      return `<div class="rc${x.healer?' heal':''}${TS.sel&&TS.sel[0]===x.m.r&&TS.sel[1]===x.m.c?'':''}" role="button" tabindex="0" data-cell="${x.m.r},${x.m.c}" aria-pressed="${!!(TS.sel&&TS.sel[0]===x.m.r&&TS.sel[1]===x.m.c)}">
        <span class="rk">${x.healer?'–':String(i+1).padStart(2,'0')}</span>${ava(o)}
        <div class="who"><div class="nm"><b>${o.name}</b><span>第 ${TEAM.H-x.m.r} 行第 ${x.m.c+1} 列${x.kills?' · 击倒 '+x.kills:''}</span></div><div class="tags">${tags.join('')}</div></div>
        <div class="val"><div><b>${fmt(x.total)}</b><small>每秒 ${fmt(x.dps)}</small></div></div>
        ${x.healer?'':`<div class="meter"><div class="bar"><i class="b" style="width:${(x.total/max*100).toFixed(1)}%"></i></div></div>`}</div>`; }).join('');
    renderReplay();
  }
  function renderReplay(){ if(!res||!res.frames)return; const n=res.frames.length;
    $('tSlider').max=n-1; $('tSlider').value=TS.fi; $('tSlider').style.setProperty('--p',(TS.fi/Math.max(1,n-1)*100)+'%');
    const fr=res.frames[TS.fi]; $('tTime').textContent=`第 ${fr?fr.t.toFixed(1):0} 秒 · 场上敌人 ${fr?fr.en.length:0}`; $('tPlay').textContent=playT?'暂停':'播放'; }
  // 选中的场上干员：技能、装备、移除
  function renderEditor(){
    const m=TS.sel&&memberAt(TS.sel[0],TS.sel[1]); const box=$('tEdit');
    if(!m){ box.innerHTML='<p class="hint">点场上的干员，在这里调整精锐、技能和装备。</p>'; return; }
    const o=byId(m.id), e=!!st.elite[o.id], k=e?1:0, A=ALT[o.id], si=st.skill[o.id];
    let skills='';
    if(A){ const all=[{idx:-1,no:A.def,name:defName(o,k),d:true}].concat(A.list.map((a,i)=>({idx:i,no:a.no,name:a.name}))).sort((x,y)=>x.no-y.no);
      skills=`<div class="seg">${all.map(q=>`<button type="button" data-tskill="${q.idx}" aria-pressed="${si===q.idx}"><em>S${q.no}</em><span>${q.name}</span></button>`).join('')}</div>`; }
    else skills=`<p class="hint">${o.skill?String(Array.isArray(o.skill)?o.skill[k]:o.skill).split(/[（：]/)[0]:'无'} · 预设干员，技能固定</p>`;
    const opts=cur=>'<option value="">空</option>'+[1,2,3,4,5,6,0].map(t=>{const l=EQUIP.filter(q=>q.t===t); return l.length?`<optgroup label="${t?U.ROMAN[t]+' 阶':'其他'}">${l.map(q=>`<option value="${q.id}"${q.id===cur?' selected':''}>${q.n}</option>`).join('')}</optgroup>`:'';}).join('');
    const eq=st.eq[o.id];
    box.innerHTML=`<div class="ed-h">${ava(o)}<div><b>${o.name}</b><span>${o.cls}</span></div><button type="button" class="elite" data-tel="1" aria-pressed="${e}">${e?'精锐':'初始'}</button></div>
      <div class="ed-s"><span class="en">Skill</span>${skills}</div>
      <div class="ed-s"><span class="en">Equipment</span><div class="eqs">${eq.map((it,i)=>{const q=EQUIP.find(z=>z.id===it.id);return `<div class="eqr"><select data-teq="${i}" aria-label="装备栏 ${i+1}">${opts(it.id)}</select><label class="sw"><input type="checkbox" data-tadv="${i}" ${it.adv?'checked':''} ${!q||q.one?'disabled':''}><i></i><span>进阶</span></label></div>`;}).join('')}</div></div>
      <div class="ed-s"><div class="f"><label for="tIso">变形同构体</label><select id="tIso" data-tiso="1"><option value="">无</option>${U.XBONDS.filter(b=>!o.bonds.includes(b)).map(b=>`<option value="${b}"${st.bond[o.id]===b?' selected':''}>${b}</option>`).join('')}</select></div></div>
      <div class="ed-s"><span class="en">Placement</span><div class="btnrow"><button type="button" class="btn" data-theat="1">试遍能放的格子</button><span class="hint">把这名干员挪到每个能放的空格子各跑一局，结果标在战场上。</span></div></div>
      <div class="btnrow"><button type="button" class="btn" data-tdel="1">撤下</button><span class="hint">要移动：选中后点另一个空格子；点另一名干员则互换位置。</span></div>`;
  }
  // 本回合的敌人种类（按出场先后），以及模拟结果里每种敌人的情况
  function enemyKinds(){ const boss=curBoss(), M=curMode(), sc=teamScale(M,roundNo()), out=[], idx={};
    const add=(key,t,route,child)=>{ if(!(key in idx)){ const d=FIELD.enemies[key]; idx[key]=out.length;
        out.push({key,d,n:0,first:t,routes:new Set(),child,hp:d.type==='BOSS'&&boss?(boss.blood[M.id]||d.hp):d.hp*sc[1],atk:(d.atk||0)*(d.type==='BOSS'?1:sc[0]),spd:d.spd*(d.type==='BOSS'?1:sc[2])}); }
      const o=out[idx[key]]; o.n++; if(route!=null)o.routes.add(route); };
    for(const s of curQueue()) add(s.key,s.t,s.route,false);
    if(res) for(const e of res.enemies) if(e.child&&!(e.key in idx)) add(e.key,e.born,null,true), out[idx[e.key]].n=res.enemies.filter(z=>z.key===e.key).length;
    return out; }
  // 特训敌人：本局组合、本回合类型和抽到的敌人
  function renderSpecial(){
    const types=FIELD.special.types, pick=curPick(), max=SPN(), E=k=>FIELD.enemies[k]||{name:k};
    TS.spTypes=TS.spTypes.filter(id=>types.some(t=>t.id===id&&t.random)).slice(0,max);
    $('tSpTypes').innerHTML=types.filter(t=>t.random).map(t=>`<button type="button" class="tchip" data-spt="${t.id}" aria-pressed="${TS.spTypes.includes(t.id)}" title="${t.desc}"><span class="tf">${foeFace(t.show,t.name)}</span><span>${t.name}</span></button>`).join('');
    $('tSpCount').textContent=`${TS.spTypes.length}/${max}`;
    const opts=[...TS.spTypes,'SPECIAL'].map(id=>`<option value="${id}"${pick.type===id?' selected':''}>${spType(id).name}${id==='SPECIAL'?'（其余回合）':''}</option>`).join('')
      +(TS.spTypes.includes(pick.type)||pick.type==='SPECIAL'||pick.type==='NONE'?'':`<option value="${pick.type}" selected>${spType(pick.type).name}</option>`)
      +`<option value="NONE"${pick.type==='NONE'?' selected':''}>不替换（显示出怪表里的占位敌人）</option>`;
    $('tSpType').innerHTML=opts;
    const hasE=!!pick.x;
    $('tSpEntryWrap').hidden=!hasE; $('tSpAtt').hidden=!hasE;
    if(hasE){
      $('tSpEntry').innerHTML=pick.pool.map(x=>`<option value="${x.key}"${x.key===pick.entry?' selected':''}>${E(x.key).name}${x.N.length+x.E.length?' + '+[...new Set(x.N.concat(x.E).map(k=>E(k).name))].join('、'):''}</option>`).join('');
      const sel=(lab,kind,list,cur)=>`<div class="f"><label>${lab}</label>${list.length>1?`<select data-spa="${kind}">${list.map(k=>`<option value="${k}"${k===cur?' selected':''}>${E(k).name}</option>`).join('')}</select>`:`<span class="muted">${list[0]?E(list[0]).name:'—'}</span>`}</div>`;
      $('tSpAtt').innerHTML=sel('普通随从','n',pick.x.N,pick.n)+sel('精英随从','e',pick.x.E,pick.e);
    }
    $('tSpHint').textContent=pick.type==='NONE'?'出怪表里的萨卡兹枯朽前锋、“灵幛”、孽罪奇美拉、妖怪、寒霜、暴鸰都是占位，实战中会被替换，这里只供对照。'
      :`第 ${roundNo()} 回合属于${roundNo()<=FIELD.special.firstHalfMaxRound?'前':'后'}半程，从这一档名单里等概率抽一个。${spType(pick.type).desc}。`;
  }
  function spSet(patch){ const cur=curPick(); TS.spPick[TS.round]=Object.assign({type:cur.type,entry:cur.entry,n:cur.n,e:cur.e},patch); run(); }
  function renderEnemies(){
    const kinds=enemyKinds(), box=$('tEnemies'); if(!box)return;
    const by={}; if(res) for(const e of res.enemies){ (by[e.key]=by[e.key]||[]).push(e); }
    const names=res?res.res.map(x=>x.m.op.name):[];
    const R=curRound(), ent=k=>{ const ss=new Set(); for(const i of k.routes){ const rt=R.routes[i]; if(rt) ss.add(rt.s[0]===TEAM.H-1?'上':rt.s[0]===0?'下':'中'); } return [...ss].join('、'); };
    $('tEnemyHead').textContent=`本回合敌人 · ${kinds.length} 种 ${kinds.reduce((a,k)=>a+k.n,0)} 个`;
    box.innerHTML=kinds.map((k,i)=>{ const d=k.d, list=by[k.key]||[], dead=list.filter(e=>e.deadAt!=null), leak=list.filter(e=>e.leakAt!=null), left=list.length-dead.length-leak.length+(k.n-list.length);
      const AB={camo:'隐匿',refract:'折射',split:'死后生成',reborn:'复苏',hits:'按次数击倒',unblock:'无法被阻挡'}, mod=Object.keys(d.ab||{}).map(a=>AB[a]).filter(Boolean);
      const tags=[d.fly?'空中':'地面', d.type==='BOSS'?'领袖':d.type==='ELITE'?'精英':'', k.child?'由其他敌人生成':'', R.routes&&[...k.routes].some(r=>R.routes[r]&&R.routes[r].cp.some(c=>c.pm))?'巡逻':''].filter(Boolean);
      const life=dead.length?dead.reduce((a,e)=>a+(e.deadAt-e.born),0)/dead.length:null;
      const dmg={}; for(const e of list) for(const a in e.dmgBy) dmg[a]=(dmg[a]||0)+e.dmgBy[a];
      const top=Object.entries(dmg).sort((a,b)=>b[1]-a[1])[0];
      const out=res?[dead.length?`<span class="ok">击倒 ${dead.length}</span>`:'',leak.length?`<span class="bad">漏 ${leak.length}</span>`:'',left>0?`<span class="mid">剩 ${left}</span>`:''].filter(Boolean).join(' '):'';
      return `<button type="button" class="ek" data-ek="${k.key}" aria-pressed="${TS.ef===k.key}" style="--ec:${EC[i%EC.length]}">
        <span class="ef">${foeFace(k.key,d.name)}</span>
        <span class="ei"><b>${d.name} <small>×${k.n}</small></b><span>${tags.join(' · ')} · ${k.first.toFixed(0)} 秒起${k.routes.size?' · '+ent(k)+'路入口':''}</span>
          <span class="num">生命 ${fmt(k.hp)} · 攻 ${d.dt==='n'||!d.atk?'—':fmt(k.atk)+(d.dt==='m'?' 法术':' 物理')} · 防 ${fmt(d.def)} · 抗 ${Math.min(100,d.res+((d.ab&&d.ab.refract)||0))} · ${(k.spd*R.mul).toFixed(2)} 格/秒${d.range>0?' · 射程 '+d.range:''}</span>
          ${d.abt?`<span class="abt">${d.abt.join('；')}${mod.length?` <em>已计入：${mod.join('、')}</em>`:' <em class="no">能力未计入</em>'}</span>`:''}</span>
        <span class="eo">${out}${life!=null?`<small>平均 ${life.toFixed(1)} 秒倒下</small>`:''}${top&&names[top[0]]?`<small>主要由 ${names[top[0]]} 击杀</small>`:''}</span></button>`; }).join('');
  }
  // ── 研究工具 ──
  // 分批跑多局模拟，每批之间让出主线程，界面不卡
  let job=null;
  function runJobs(list,onEach,onDone){ const id={}; job=id; let i=0;
    const step=()=>{ if(job!==id)return; const t0=performance.now();
      while(i<list.length&&performance.now()-t0<60){ onEach(i,list[i]()); i++; }
      if(i<list.length) setTimeout(step,0); else { job=null; onDone(); } };
    setTimeout(step,0); return id; }
  // 一局的战果：普通回合看漏怪和清场用时，领袖回合看击倒用时和剩余生命。score 越大越好
  function outcome(R){
    if(R.isBoss){ const b=R.boss||{left:1,hp:1,dead:false};
      if(b.dead) return {cls:b.t<=R.T?'ok':'mid',lab:(b.t<=R.T?'':'超时 ')+b.t.toFixed(0)+' 秒',score:1000-b.t};
      const p=b.left/b.hp; return {cls:'bad',lab:'剩 '+Math.round(p*100)+'%',score:-100*p}; }
    const left=R.alive+(R.total-R.spawned);
    const fl=R.hurtOn&&R.falls?' · 倒下 '+R.falls:'';
    if(R.leakedN) return {cls:'bad',lab:'漏 '+R.leakedN,sub:'扣 '+R.lifeLoss+' 生命'+fl,score:-1000*R.leakedN-left-R.falls*0.5};
    if(left) return {cls:'mid',lab:'剩 '+left,sub:'时间到 · 扣 '+R.lifeLoss+' 生命'+fl,score:-left-R.falls*0.5};
    return {cls:'ok',lab:R.dur.toFixed(0)+' 秒',sub:fl?fl.slice(3):'',score:1000-R.dur-R.falls*5}; }
  const runOne=(sn,rk)=>{ const S=setupFor(sn,rk,false); const R=S.members.length?teamRun(S):null; if(R){ R.isBoss=!!S.boss; R.skipped=S.skipped; } return R; };
  // 方案：保存的阵容（位置 + 干员设置 + 层数）
  const SLOTS='weishu.team.slots';
  let slots=[]; try{ slots=JSON.parse(localStorage.getItem(SLOTS)||'[]')||[]; }catch(e){ slots=[]; }
  const saveSlots=()=>{ try{ localStorage.setItem(SLOTS,JSON.stringify(slots)); }catch(e){} };
  const roundLabel=rk=>bossOf(rk)?'第 '+bossOf(rk).round+' 回合 · '+bossOf(rk).name:'第 '+roundOf(rk).n+' 回合';
  let sweep=null;   // {cols:[{name,n}], rows:[rk], cells:{'rk|i':outcome}, done, n}
  function sweepRun(){
    const cols=[{name:'当前阵容',sn:snap()}].concat(slots.filter(x=>x.cmp).map(x=>({name:x.name,sn:x})));
    const rows=FIELD.rounds.map(r=>'r'+r.n); if(curBoss()) rows.push(TS.round);
    const jobs=[]; for(const rk of rows) cols.forEach((c,i)=>jobs.push(()=>({rk,i,R:runOne(c.sn,rk)})));
    sweep={cols:cols.map(c=>({name:c.name,n:c.sn.members.length})),rows,cells:{},done:0,n:jobs.length,map:curMap().name,mode:curMode().name};
    renderLab();
    runJobs(jobs,(k,o)=>{ sweep.cells[o.rk+'|'+o.i]=o.R?Object.assign(outcome(o.R),{dps:o.R.res.reduce((a,x)=>a+x.total,0)/Math.max(1,o.R.dur),skipped:o.R.skipped}):{cls:'',lab:'—',score:-1e9};
      sweep.done=k+1; if((k+1)%3===0||k+1===jobs.length) renderLab(); },()=>renderLab()); }
  // 摆位试算：把选中的干员挪到每个能放的空格子，各跑一局
  let heat=null;   // {key,id,vals:{'r,c':{out,dmg}},done,n}
  const heatKey=id=>{ const sn=snap(); sn.members=sn.members.map(m=>m.id===id?Object.assign({},m,{r:-1,c:-1}):m);
    return JSON.stringify([TS.map,TS.round,TS.mode,curSp(),TS.tok,TS.xAtk,TS.xAspd,TS.xHp,TS.hurt,TS.cold,TS.stunt,sn]); };
  const heatOn=()=>heat&&TS.members.some(m=>m.id===heat.id)&&heat.key===heatKey(heat.id)?heat:null;
  function heatRun(){ const m=TS.sel&&memberAt(TS.sel[0],TS.sel[1]); if(!m)return; const op=byId(m.id);
    const tiles=[]; for(let r=0;r<TEAM.H;r++)for(let c=0;c<TEAM.W;c++){ const o=memberAt(r,c); if(canPlace(op,r,c)&&(!o||o===m)) tiles.push([r,c]); }
    const base=snap(), idx=base.members.findIndex(x=>x.id===m.id);
    heat={key:heatKey(m.id),id:m.id,vals:{},done:0,n:tiles.length};
    renderBoard(); renderHeatCap();
    runJobs(tiles.map(([r,c])=>()=>{ const sn=JSON.parse(JSON.stringify(base)); sn.members[idx].r=r; sn.members[idx].c=c; const R=runOne(sn,TS.round); const me=R&&R.res.find(x=>x.m.op.id===m.id); return {r,c,out:R?outcome(R):null,dmg:me?me.total:0}; }),
      (k,o)=>{ heat.vals[o.r+','+o.c]={out:o.out,dmg:o.dmg}; heat.done=k+1; if((k+1)%3===0){ renderBoard(); renderHeatCap(); } },()=>{ renderBoard(); renderHeatCap(); }); }
  const wan=n=>n>=1e4?(n/1e4).toFixed(n>=1e5?0:1)+'万':String(Math.round(n));
  // 每个格子的试算值（0–1，越大越好）和标签
  function heatCells(){ const H=heatOn(); if(!H)return null; const met=TS.hm||'out', out={}; const ks=Object.keys(H.vals); if(!ks.length)return {cells:out,best:null};
    const v=k=>met==='dmg'?H.vals[k].dmg:(H.vals[k].out?H.vals[k].out.score:-1e9);
    const vs=ks.map(v), lo=Math.min(...vs), hi=Math.max(...vs); let best=null;
    for(const k of ks){ const x=v(k), n=hi>lo?(x-lo)/(hi-lo):1;
      out[k]={n,lab:met==='dmg'?wan(H.vals[k].dmg):(H.vals[k].out?H.vals[k].out.lab.replace(' 秒','s'):'—'),cls:met==='dmg'?'':(H.vals[k].out||{}).cls};
      if(best==null||x>v(best)) best=k; }
    return {cells:out,best}; }
  function renderHeatCap(){ const el=$('tHeatCap'), H=heatOn(); if(!H){ el.hidden=true; el.innerHTML=''; return; } el.hidden=false;
    const name=byId(H.id).name, met=TS.hm||'out';
    el.innerHTML=`<span class="hc-t"><b>摆位试算 · ${name}</b> ${H.done<H.n?`计算中 ${H.done}/${H.n}`:`${H.n} 个格子`}。${met==='dmg'?'数字是这名干员的总伤害':'数字是全队战果（清场用时或漏怪数）'}，颜色越深越好，金框是最好的格子。</span><span class="segs" role="group" aria-label="试算指标"><button type="button" data-hm="out" aria-pressed="${met==='out'}">全队战果</button><button type="button" data-hm="dmg" aria-pressed="${met==='dmg'}">该干员伤害</button></span><button type="button" class="btn" data-hclr="1">清除</button>`; }
  // 分享：阵容和战场设置编码进链接
  const b64e=o=>{ const b=new TextEncoder().encode(JSON.stringify(o)); let bin=''; b.forEach(x=>bin+=String.fromCharCode(x)); return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); };
  const b64d=str=>{ str=str.replace(/-/g,'+').replace(/_/g,'/'); while(str.length%4)str+='='; const bin=atob(str); return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin,c=>c.charCodeAt(0)))); };
  function shareCode(){ const sn=snap();
    return b64e({v:1,map:curMap().id,round:TS.round,mode:TS.mode,sp:TS.spTypes,pk:TS.spPick,tok:TS.tok,x:[+TS.xAtk||0,+TS.xAspd||0,+TS.cold||0,+TS.stunt||0,+TS.xHp||0,TS.hurt===false?0:1],L:sn.L,S:sn.subL,
      m:sn.members.map(m=>[m.id,m.r,m.c,m.e?1:0,m.s,m.q.map(q=>[q.id,q.adv?1:0]),m.b])}); }
  function importCode(code){ const o=b64d(code); if(!o||o.v!==1) throw new Error('版本不对');
    const mi=FIELD.maps.findIndex(x=>x.id===o.map); if(mi>=0) TS.map=mi;
    if(o.round&&(bossOf(o.round)||/^r\d+$/.test(o.round))) TS.round=o.round;
    if(FIELD.modes.some(x=>x.id===o.mode)) TS.mode=o.mode;
    TS.spTypes=o.sp||[]; TS.spPick=o.pk||{}; TS.tok=o.tok||{};
    const xx=o.x||[]; [TS.xAtk,TS.xAspd,TS.cold,TS.stunt,TS.xHp]=[xx[0]||0,xx[1]||0,xx[2]??50,xx[3]||0,xx[4]||0]; TS.hurt=xx[5]!==0; $('tHurt').checked=TS.hurt;
    applySnap({members:(o.m||[]).map(a=>({id:a[0],r:a[1],c:a[2],e:!!a[3],s:a[4],q:(a[5]||[]).map(q=>({id:q[0],adv:!!q[1]})),b:a[6]||''})),L:o.L,subL:o.S});
    for(const id of ['cold','xAtk','xAspd','xHp','stunt']) $('t-'+id).value=TS[id];
    U.update(); }
  const shareLink=()=>location.href.split('#')[0]+'#team='+shareCode();
  function renderLab(){
    $('tSlots').innerHTML=slots.length?slots.map((x,i)=>`<div class="slot"><label class="sw"><input type="checkbox" data-scmp="${i}" ${x.cmp?'checked':''}><i></i><span>对比</span></label>
      <span class="sn"><b>${x.name}</b><span class="savas">${x.members.filter(m=>byId(m.id)).map(m=>ava(byId(m.id))).join('')}</span></span>
      <span class="sbtn"><button type="button" class="btn" data-sload="${i}">载入</button><button type="button" class="btn" data-sdel="${i}" aria-label="删除方案 ${x.name}">删除</button></span></div>`).join('')
      :'<p class="hint">还没有保存的方案。摆好一套阵容后起个名字保存，之后可以随时载入，或勾选“对比”放进全回合对比。</p>';
    const out=$('tSweepOut');
    if(!sweep){ out.innerHTML='<p class="hint">用当前的地图、难度和特训设置，把当前阵容（以及勾选了“对比”的方案）在第 1–13 回合各跑一遍；选中的是领袖回合时也会算上。点回合名可以切换到那一回合看回放。</p>'; $('tSweepProg').textContent=''; return; }
    $('tSweepProg').textContent=sweep.done<sweep.n?`计算中 ${sweep.done}/${sweep.n}`:`${sweep.map} · ${sweep.mode}`;
    const best={}; for(const rk of sweep.rows){ let b=null; sweep.cols.forEach((c,i)=>{ const x=sweep.cells[rk+'|'+i]; if(x&&(b==null||x.score>b))b=x.score; }); best[rk]=b; }
    out.innerHTML=`<table class="sweep"><thead><tr><th scope="col">回合</th>${sweep.cols.map(c=>`<th scope="col">${c.name}<small>${c.n} 人</small></th>`).join('')}</tr></thead><tbody>${sweep.rows.map(rk=>`<tr${rk===TS.round?' class="cur"':''}><th scope="row"><button type="button" class="lnk" data-sround="${rk}">${roundLabel(rk)}</button></th>${sweep.cols.map((c,i)=>{ const x=sweep.cells[rk+'|'+i];
      if(!x) return '<td class="pend">…</td>';
      return `<td class="${sweep.cols.length>1&&x.score===best[rk]&&x.score>-1e9?'top':''}"><b class="${x.cls}">${x.lab}</b><small>${x.sub?x.sub+' · ':''}每秒 ${fmt(x.dps||0)}${x.skipped?` · ${x.skipped} 人不能部署`:''}</small></td>`; }).join('')}</tr>`).join('')}</tbody></table>`;
  }
  function render(){ renderSide(); renderBoard(); renderPalette(); renderResults(); renderEditor(); renderEnemies(); renderHeatCap(); renderLab(); }

  // ── 交互 ──
  function stop(){ if(playT){ clearInterval(playT); playT=0; } }
  $('tBoard').addEventListener('click',e=>{ const b=e.target.closest('.tc'); if(!b)return; const r=+b.dataset.r,c=+b.dataset.c, m=memberAt(r,c), B=board(), cell=B.cell[r][c];
    if(TS.pick){ const op=byId(TS.pick);
      if(!canPlace(op,r,c))return;
      if(m){ m.id=op.id; } else { if(TS.members.length>=MAXN)return; TS.members.push({id:op.id,r,c}); }
      TS.members=TS.members.filter((x,i,a)=>a.findIndex(y=>y.id===x.id)===i||(x.r===r&&x.c===c));
      // 同一名干员只放一次：放到新位置时移走旧的
      const dup=TS.members.filter(x=>x.id===op.id); if(dup.length>1) TS.members=TS.members.filter(x=>x.id!==op.id||(x.r===r&&x.c===c));
      TS.sel=[r,c]; TS.pick=null; run(); return; }
    if(TS.sel&&!(TS.sel[0]===r&&TS.sel[1]===c)){ const s=memberAt(TS.sel[0],TS.sel[1]);
      if(s){ if(m){ if(canPlace(byId(s.id),r,c)&&canPlace(byId(m.id),s.r,s.c)){ const t=[s.r,s.c]; s.r=r;s.c=c; m.r=t[0]; m.c=t[1]; TS.sel=[r,c]; run(); return; } }
        else if(canPlace(byId(s.id),r,c)){ s.r=r; s.c=c; TS.sel=[r,c]; run(); return; } } }
    if(m){ TS.sel=(TS.sel&&TS.sel[0]===r&&TS.sel[1]===c)?null:[r,c]; render(); return; }
    if(cell.opt){ const seq=[''].concat(cell.opt), key=r+','+c, cur=TS.tok[key]||''; TS.tok[key]=seq[(seq.indexOf(cur)+1)%seq.length];
      if(TS.tok[key]&&memberAt(r,c)&&!canPlace(byId(memberAt(r,c).id),r,c)) TS.members=TS.members.filter(x=>!(x.r===r&&x.c===c));
      run(); return; }
    TS.sel=null; render(); });
  $('tPal').addEventListener('click',e=>{ const b=e.target.closest('[data-pick]'); if(!b)return; TS.pick=TS.pick===b.dataset.pick?null:b.dataset.pick; TS.sel=null; renderBoard(); renderPalette(); renderEditor(); });
  $('tQ').addEventListener('input',e=>{ TS.q=e.target.value; renderPalette(); });
  $('tFilter').innerHTML='<button type="button" data-tf="" aria-pressed="true">全部</button>'+Object.keys(CORE).filter(c=>!CORE[c].none).map(c=>`<button type="button" data-tf="${CORE[c].name}" aria-pressed="false">${CORE[c].name}</button>`).join('');
  $('tFilter').addEventListener('click',e=>{ const b=e.target.closest('[data-tf]'); if(!b)return; TS.filter=b.dataset.tf; document.querySelectorAll('#tFilter button').forEach(x=>x.setAttribute('aria-pressed',x===b)); renderPalette(); });
  // 换地图、换回合时保留阵容；落在不能部署的格子上的干员标红、暂不参与计算
  $('tMap').addEventListener('click',e=>{ const b=e.target.closest('[data-map]'); if(!b)return; TS.map=+b.dataset.map; TS.tok={}; run(); });
  $('tRound').addEventListener('change',e=>{ TS.round=e.target.value; renderSpecial(); run(); });
  $('tMode').addEventListener('change',e=>{ TS.mode=e.target.value; renderSpecial(); run(); });
  $('tSpTypes').addEventListener('click',e=>{ const b=e.target.closest('[data-spt]'); if(!b)return; const id=b.dataset.spt;
    if(TS.spTypes.includes(id)) TS.spTypes=TS.spTypes.filter(x=>x!==id); else { if(TS.spTypes.length>=SPN()) TS.spTypes.shift(); TS.spTypes.push(id); }
    TS.spPick={}; renderSpecial(); run(); });
  $('tSpType').addEventListener('change',e=>{ TS.spPick[TS.round]={type:e.target.value}; renderSpecial(); run(); });
  $('tSpEntry').addEventListener('change',e=>{ spSet({entry:e.target.value,n:null,e:null}); renderSpecial(); });
  $('tSpAtt').addEventListener('change',e=>{ const s=e.target.closest('[data-spa]'); if(!s)return; spSet({[s.dataset.spa]:s.value}); renderSpecial(); });
  $('tBonds').addEventListener('input',e=>{ const t=e.target; const v=Math.max(0,parseFloat(t.value)||0); if(t.dataset.tl)TS.L[t.dataset.tl]=v; if(t.dataset.ts)TS.subL[t.dataset.ts]=v; clearTimeout(timer); timer=setTimeout(()=>{ res=teamRun(setup(true)); TS.fi=0; renderBoard(); renderResults(); save(); },150); });
  for(const id of ['cold','xAtk','xAspd','xHp','stunt']) $('t-'+id).addEventListener('input',e=>{ TS[id]=parseFloat(e.target.value)||0; run(); });
  $('tHurt').addEventListener('input',e=>{ TS.hurt=e.target.checked; run(); });
  $('tRoutes').addEventListener('input',e=>{ TS.routes=e.target.checked; renderBoard(); save(); });
  $('tViewMode').addEventListener('click',e=>{ const b=e.target.closest('[data-real]'); if(!b)return; TS.real=b.dataset.real==='1'; renderBoard(); save(); });
  if(window.ResizeObserver) new ResizeObserver(()=>fitStage()).observe($('tBoard')); else window.addEventListener('resize',fitStage);
  $('tClear').addEventListener('click',()=>{ TS.members=[]; TS.sel=null; TS.pick=null; run(); });
  $('tList').addEventListener('click',e=>{ const c=e.target.closest('[data-cell]'); if(!c)return; const [r,cc]=c.dataset.cell.split(',').map(Number); TS.sel=[r,cc]; render(); });
  $('tEdit').addEventListener('click',e=>{ const m=TS.sel&&memberAt(TS.sel[0],TS.sel[1]); if(!m)return; const o=byId(m.id);
    if(e.target.closest('[data-tel]')){ st.elite[o.id]=!st.elite[o.id]; U.update(); run(); return; }
    const s=e.target.closest('[data-tskill]'); if(s){ st.skill[o.id]=+s.dataset.tskill; U.update(); run(); return; }
    if(e.target.closest('[data-theat]')){ heatRun(); return; }
    if(e.target.closest('[data-tdel]')){ TS.members=TS.members.filter(x=>x!==m); TS.sel=null; run(); } });
  $('tEdit').addEventListener('change',e=>{ const m=TS.sel&&memberAt(TS.sel[0],TS.sel[1]); if(!m)return; const o=byId(m.id), el=e.target, it=st.eq[o.id];
    if(el.dataset.teq!=null){ it[+el.dataset.teq]={id:el.value,adv:it[+el.dataset.teq].adv}; }
    else if(el.dataset.tadv!=null){ it[+el.dataset.tadv].adv=el.checked; }
    else if(el.dataset.tiso){ st.bond[o.id]=el.value; }
    U.update(); run(); });
  $('tEnemies').addEventListener('click',e=>{ const b=e.target.closest('[data-ek]'); if(!b)return; TS.ef=TS.ef===b.dataset.ek?null:b.dataset.ek; renderBoard(); renderEnemies(); });
  $('tSlider').addEventListener('input',e=>{ stop(); TS.fi=+e.target.value; renderBoard(); renderReplay(); });
  $('tPlay').addEventListener('click',()=>{ if(!res||!res.frames)return; if(playT){ stop(); renderReplay(); return; }
    if(TS.fi>=res.frames.length-1) TS.fi=0;
    playT=setInterval(()=>{ TS.fi++; if(TS.fi>=res.frames.length-1){ TS.fi=res.frames.length-1; stop(); } renderBoard(); renderReplay(); },100); renderReplay(); });
  $('tSlotSave').addEventListener('click',()=>{ if(!TS.members.length)return; const nm=($('tSlotName').value||'').trim()||('方案 '+(slots.length+1));
    const i=slots.findIndex(x=>x.name===nm); const o=Object.assign({name:nm,cmp:i>=0?slots[i].cmp:true},snap()); if(i>=0) slots[i]=o; else slots.push(o); saveSlots(); $('tSlotName').value=''; renderLab(); });
  $('tSlots').addEventListener('click',e=>{ const l=e.target.closest('[data-sload]'), d=e.target.closest('[data-sdel]');
    if(l){ applySnap(slots[+l.dataset.sload]); U.update(); run(); return; }
    if(d){ slots.splice(+d.dataset.sdel,1); saveSlots(); renderLab(); } });
  $('tSlots').addEventListener('change',e=>{ const c=e.target.closest('[data-scmp]'); if(!c)return; slots[+c.dataset.scmp].cmp=c.checked; saveSlots(); });
  $('tSweep').addEventListener('click',()=>sweepRun());
  $('tSweepOut').addEventListener('click',e=>{ const b=e.target.closest('[data-sround]'); if(!b)return; TS.round=b.dataset.sround; renderSpecial(); run(); });
  $('tHeatCap').addEventListener('click',e=>{ const m=e.target.closest('[data-hm]'); if(m){ TS.hm=m.dataset.hm; renderBoard(); renderHeatCap(); return; }
    if(e.target.closest('[data-hclr]')){ heat=null; job=null; renderBoard(); renderHeatCap(); } });
  $('tShare').addEventListener('click',async()=>{ const link=shareLink(); const box=$('tShareOut'); box.value=link; box.hidden=false; box.select();
    let ok=false; try{ await navigator.clipboard.writeText(link); ok=true; }catch(err){}
    $('tShareHint').textContent=ok?'链接已复制。打开链接会还原这套阵容（含精锐、技能、装备）、地图、回合、难度、特训和层数。':'浏览器没有允许自动复制，请手动复制上面的链接。'; });
  $('tImportGo').addEventListener('click',()=>{ const v=($('tImport').value||'').trim(); const m=v.match(/team=([\w-]+)/); const code=m?m[1]:v;
    try{ importCode(code); $('tImport').value=''; $('tShareHint').textContent='已导入。'; run(); }catch(err){ $('tShareHint').textContent='没能识别这段链接或代码。'; } });
  // 页面切换
  const views={solo:$('soloView'),team:$('teamView')};
  $('views').addEventListener('click',e=>{ const b=e.target.closest('[data-view]'); if(!b)return; const v=b.dataset.view;
    for(const k in views) views[k].hidden=k!==v; document.querySelectorAll('#views button').forEach(x=>x.setAttribute('aria-pressed',x===b));
    try{ localStorage.setItem('weishu.view',v); }catch(err){}
    if(v==='team'){ run(); } else { stop(); U.update(); } });
  for(const id of ['cold','xAtk','xAspd','xHp','stunt']) $('t-'+id).value=TS[id];
  $('tRoutes').checked=!!TS.routes; $('tHurt').checked=TS.hurt!==false;
  let v0='solo'; try{ v0=localStorage.getItem('weishu.view')||'solo'; }catch(e){}
  // 打开带 #team= 的分享链接时导入，然后去掉地址里的这段，之后的修改照常保存
  const hm=location.hash.match(/team=([\w-]+)/);
  if(hm){ try{ importCode(hm[1]); v0='team'; history.replaceState(null,'',location.href.split('#')[0]); }catch(e){} }
  if(v0==='team') document.querySelector('#views [data-view="team"]').click(); else render();
})();
