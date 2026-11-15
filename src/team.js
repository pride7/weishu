// ── 队伍模拟 ──────────────────────────────────────────
// 在真实战场上摆放干员，按该回合的出怪表让敌人入场、行走、被阻挡、被击倒。
// 干员共用敌人身上的状态（元素损伤、减防减抗、麻痹）；各自的技能模型沿用单人计算。
// 干员受击（base.hurt 打开时）：敌人攻击阻挡自己的干员，或射程内最后部署的干员；生命归零就倒下，按再部署时间返场；医疗干员治疗范围内生命最低的友方。
const TEAM={
  W:9, H:4,
  PASS:new Set(['.','f','S','E','T','i','m','g','u']),          // 地面敌人可以通行的地块
  DEPLOY:{'.':1,'|':1,'i':1,'m':1,'g':1,'u':1,'H':2},           // 1 所有干员可部署，2 仅远程（高台）
  TILE_NAME:{'.':'地面','|':'围栏（敌人不能通行）','#':'不可用','f':'通道（不可部署）','S':'敌人入口','T':'敌人入口','E':'出口',
    'H':'高台（仅远程）','i':'活性源石：攻击力 +20%、攻速 +20','m':'泥沼','g':'草丛（隐匿）','u':'优化模块：攻速提升'},
};

// 卫戍协议里技能由系统自动释放，按 PRTS 卫戍协议/帮助 §技能操作 的方案：
//   基础/职业方案：攻击范围或技能范围内存在敌人（无视可选性，含隐匿、空中）时，或自身阻挡了敌人时；
//   执旗手、战术家、吟游者、游击手：始终尝试触发（技力满就放，哪怕没有敌人）；
//   特殊技能方案：下面按干员名和游戏里的技能序号列出（always 始终尝试触发；field 场上有敌人；其余是特定范围的编号）。
const TRIG_ALWAYS_BRANCH=['执旗手','战术家','吟游者','游击手'];
const TRIG_SPECIAL={'塔露拉':{3:'always'},'艾丽妮':{2:'always',3:'always'},'锏':{2:'always',3:'always'},'异客':{3:'always'},
  '荒芜拉普兰德':{3:'field'},'纯烬艾雅法拉':{3:'field'},
  '乌尔比安':{3:'6-1'},'维娜·维多利亚':{3:'x-4'},'余':{3:'3-15'},'远牙':{3:'6-1'},'贝洛内':{3:'x-2'},'玛恩纳':{3:'3-18'},
  '圣聆初雪':{1:'x-2'},'怒潮凛冬':{3:'2-4'},'史尔特尔':{2:'2-2',3:'3-2'},
  '缪尔赛思':{1:'default',2:'default',3:'default'}};   // 缪尔赛思：PRTS 写“未知”，按基础方案
function teamTrigger(op,si){ const sp=TRIG_SPECIAL[op.name]; if(sp&&sp[si+1]) return sp[si+1];
  if(TRIG_ALWAYS_BRANCH.some(b=>op.cls.includes(b))) return 'always'; return 'default'; }

// 某张地图、某个回合的场地。tok：会随机出现的障碍的选择 {"r,c": "crate"|"plat"|""}
function teamBoard(map, boss, tok){
  const rows=boss?map.bossRows:map.rows, toks=boss?map.bossTokens:map.tokens;
  const cell=[]; for(let r=0;r<TEAM.H;r++){ cell[r]=[]; for(let c=0;c<TEAM.W;c++){ const ch=rows[r][c]; cell[r][c]={ch,obs:''}; } }
  for(const t of toks){ if(t.r>=TEAM.H)continue; const kinds=t.kinds.filter(x=>x==='crate'||x==='plat'); if(!kinds.length)continue;
    const key=t.r+','+t.c, pick=t.hidden?((tok&&key in tok)?tok[key]:''):kinds[0];
    cell[t.r][t.c].obs=kinds.includes(pick)?pick:''; cell[t.r][t.c].opt=t.hidden?kinds:null; }
  const pass=(r,c)=>r>=0&&r<TEAM.H&&c>=0&&c<TEAM.W&&TEAM.PASS.has(cell[r][c].ch)&&!cell[r][c].obs;
  // 1 所有干员，2 仅远程，0 不可部署
  const deploy=(r,c)=>{ const x=cell[r]&&cell[r][c]; if(!x)return 0; if(x.obs==='crate')return 0; if(x.obs==='plat')return 2; return TEAM.DEPLOY[x.ch]||0; };
  let end=null; for(let r=0;r<TEAM.H&&!end;r++)for(let c=0;c<TEAM.W;c++)if(cell[r][c].ch==='E'){end=[r,c];break;}
  return {cell,pass,deploy,end,boss:!!boss,tokens:toks};
}

// 地面寻路：8 方向，斜走时两侧都要能通行。返回格子中心组成的折线
function teamPath(B,a,b,ignoreObs){
  const ok=(r,c)=>ignoreObs?(r>=0&&r<TEAM.H&&c>=0&&c<TEAM.W&&TEAM.PASS.has(B.cell[r][c].ch)):B.pass(r,c);
  const key=(r,c)=>r*TEAM.W+c, dist=new Map(), prev=new Map(), q=[[0,a[0],a[1]]]; dist.set(key(a[0],a[1]),0);
  while(q.length){ q.sort((x,y)=>x[0]-y[0]); const [d,r,c]=q.shift(); if(d>dist.get(key(r,c)))continue; if(r===b[0]&&c===b[1])break;
    for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){ if(!dr&&!dc)continue; const nr=r+dr,nc=c+dc; if(!ok(nr,nc))continue;
      if(dr&&dc&&(!ok(r+dr,c)||!ok(r,c+dc)))continue;
      const nd=d+(dr&&dc?Math.SQRT2:1), nk=key(nr,nc); if(nd<(dist.has(nk)?dist.get(nk):Infinity)){ dist.set(nk,nd); prev.set(nk,key(r,c)); q.push([nd,nr,nc]); } } }
  if(!dist.has(key(b[0],b[1]))) return null;
  const out=[]; let k=key(b[0],b[1]); while(k!==undefined){ out.unshift([Math.floor(k/TEAM.W),k%TEAM.W]); k=prev.get(k); }
  return out;
}

// 把一条出怪路线变成折线（[行,列] 点列，WAIT 用 {w:秒} 表示）
function teamRoute(B,route){
  const fixEnd=p=>(B.cell[p[0]]&&B.cell[p[0]][p[1]]&&B.cell[p[0]][p[1]].ch==='E')||route.fly?p:(B.end||p);
  // 巡逻点（PATROL_MOVE）：走到第一个巡逻点后在这些点之间循环，不再走向终点
  const pms=route.cp.filter(c=>c.pm).map(c=>c.pm);
  const wps=[]; for(const c of route.cp){ if(c.m)wps.push({p:c.m}); else if(c.w!=null)wps.push({w:c.w}); else if(c.pm)break; }
  if(pms.length){ for(const p of pms) wps.push({p}); wps.push({p:pms[0],close:1}); }
  else wps.push({p:fixEnd(route.e)});
  let cur=route.s; const line=[{p:cur}]; let blockedPath=false, loop=null;
  for(const w of wps){
    if(w.w!=null){ line.push({w:w.w,p:cur}); continue; }
    if(route.fly){ line.push({p:w.p}); cur=w.p; }
    else { let seg=teamPath(B,cur,w.p,false); if(!seg){ seg=teamPath(B,cur,w.p,true); blockedPath=true; }   // 被障碍堵死时，敌人会拆掉阻隔工事
      if(!seg){ line.push({p:w.p}); cur=w.p; } else { for(let i=1;i<seg.length;i++)line.push({p:seg[i]}); cur=w.p; } }
    if(pms.length&&loop==null&&w.p===pms[0]&&!w.close) loop=line.length-1;
  }
  // 预先算好每个点到终点的剩余路程，用来决定“离出口最近”的索敌优先级；巡逻的敌人不会走到出口，排在最后
  let rem=0; for(let i=line.length-1;i>=0;i--){ line[i].rem=loop!=null?50+rem:rem; if(i>0){ const a=line[i-1].p,b=line[i].p; rem+=Math.hypot(a[0]-b[0],a[1]-b[1]); } }
  return {line,fly:route.fly,len:rem,blockedPath,loop,patrol:pms.length>0};
}

// 银行家舍入（.5 取偶数），替换数量公式用
const roundHalfEven=x=>{ const f=Math.floor(x), d=x-f; if(Math.abs(d-0.5)<1e-9) return f%2===0?f:f+1; return Math.round(x); };
// 把出怪表展开成一个个敌人，并把占位敌人换成本回合的特训敌人。
// sp：{entry 特殊敌人, n 普通随从, e 精英随从}；为空时保留出怪表原样（占位敌人本身）。
// 规则（据 sganggs/Stronghold-Protocol docs/DATA.md §10，解自游戏客户端）：
//   占位 N/E/S → 普通/精英/特殊；移动方式（地面/空中）与占位不同的这一组不出；
//   数量 n' = clamp(取整(n × P(占位)/f(占位) ÷ (P(新)/f(新))), 1, 5)，P = 攻击×5 + 生命 + 防御×3 + 法抗×3，f = 战斗效能系数；
//   第 i 个在 原时间 + i × max(n×间隔/n', 0.05×n×间隔) 出场。
function teamExpand(R,sp){
  const S=FIELD.special, out=[];
  for(const s of R.spawns){
    const slot=S.slots[s.key];
    if(!slot||!sp){ for(let j=0;j<s.n;j++) out.push({t:s.t+j*s.iv,key:s.key,route:s.route}); continue; }
    const cls=slot[0], fly=slot.length>1, nk=cls==='N'?sp.n:cls==='E'?sp.e:sp.entry, ne=FIELD.enemies[nk], tp=FIELD.enemies[s.key];
    if(!ne||!!ne.fly!==fly) continue;
    const n2=Math.max(S.minN,Math.min(S.maxN,roundHalfEven(s.n*tp.P/tp.bef/(ne.P/ne.bef))));
    const step=Math.max(s.n*s.iv/n2,S.minIv*s.n*s.iv);
    for(let j=0;j<n2;j++) out.push({t:s.t+j*step,key:nk,route:s.route});
  }
  return out.sort((a,b)=>a.t-b.t);
}
// 某难度某回合普通敌人的 [攻击, 生命, 移速] 倍率
function teamScale(mode,round){ const s=mode&&mode.scale; if(!s) return [1,1,1]; return s[round]||s[Object.keys(s).pop()]||[1,1,1]; }

// 攻击范围（格子偏移，朝右）
function teamRange(op,elite,skillOn,si){
  const F=FIELD.ops[op.name]; if(!F) return [[0,0]];
  const k=elite?1:0; let id=F.rng[k];
  if(skillOn&&F.sk[si]&&F.sk[si][k]) id=F.sk[si][k];
  return FIELD.ranges[id]||[[0,0]];
}
// 当前用的是第几个技能（游戏里的技能序号，从 0 开始）
function teamSkillIndex(op,si){ const A=ALT[op.id], F=FIELD.ops[op.name];
  if(A&&si>=0&&A.list[si]) return A.list[si].no-1;
  if(A) return A.def-1; return F?F.def:0; }

// 按在场阵容判定盟约：核心盟约 3 人激活、6 人 6 人效果；附加盟约按游戏里的激活人数
function teamBonds(members){
  const cnt={};
  for(const m of members){ const bs=new Set(m.op.bonds.concat(m.sel.bond?[m.sel.bond]:[])); for(const b of bs) cnt[b]=(cnt[b]||0)+1; }
  const cores={}; for(const c in CORE){ if(CORE[c].none)continue; const n=cnt[CORE[c].name]||0; cores[c]={n,on:n>=((FIELD.bonds||{})[CORE[c].name]||3),six:n>=6}; }
  const subs={}; for(const s in SUBS){ const n=cnt[s]||0, need=(FIELD.bonds||{})[s]||2; subs[s]={n,need,on:n>=need,three:n>=3}; }
  return {cnt,cores,subs};
}

// 跑一局。setup:
//   map, boss（领袖回合时为 FIELD.bosses 里的一项）/ round（普通回合），mode（FIELD.modes 里的一项），tok，
//   members:[{op,elite,sel,r,c}]，L:{核心盟约 id: 层数}，subL:{附加盟约: 层数}，base（其余参数，同单人计算），trace
function teamRun(setup){
  const B=teamBoard(setup.map,!!setup.boss,setup.tok);
  const R=setup.boss||setup.round, mode=setup.mode, rn=setup.boss?setup.boss.round:R.n, sc=teamScale(mode,rn);
  // 作战阶段强制 2 倍速：关卡时限是现实秒数，换成游戏内时间要乘 2。领袖回合超时后战斗继续（按秒扣生命），这里最多算到 300 秒
  const T=R.T*2, TMAX=setup.boss?Math.max(T,300):T;
  const routes=R.routes.map(r=>teamRoute(B,r));
  const bonds=teamBonds(setup.members);
  const occ={}; for(const m of setup.members) occ[m.r+','+m.c]=m;
  // 阿戈尔吞噬：每名【阿戈尔】干员吞掉身前（右边）一格的干员
  const dvGain=new Map(), eaten=new Map();
  if(bonds.cores.egir&&bonds.cores.egir.on){ const L=(setup.L||{}).egir||0;
    for(const m of setup.members){ if(!m.op.bonds.includes('阿戈尔'))continue; const f=occ[m.r+','+(m.c+1)]; if(!f||eaten.has(f))continue;
      const kf=f.elite?1:0, s=STATS[f.op.name]||[0,0,0,0,0,0], own=f.op.bonds.includes('阿戈尔');
      const hp=Math.round(s[kf*3]*(own?1+(35+L)/100:1)), def=s[kf*3+1], dmg=Math.max(5000-def,250), alive=hp>dmg;
      dvGain.set(m,{atk:f.op.atk[kf],tier:TIERV[f.op.tier]||1});
      eaten.set(f,{by:m,hp,dmg,alive,dead:!alive&&!(own&&bonds.cores.egir.six)}); } }
  const enemies=[], W={f:0,enemies,agents:[],team:true};
  const HURT=!!(setup.base&&setup.base.hurt);
  // 干员的生命、防御、法抗、再部署时间（模式内练度，含模组属性）；部署顺序：从上到下、从左到右
  // 盟约的生存加成：阿戈尔 生命 +(35+层)%、乌萨斯 生命 +(10+0.3×层)%、坚守 全员生命 +(25+1.2×层)%、独行 生命 +60%、
  // 助力 全员防御 +(15+1.2×层)% 且再部署时间 −30%（PRTS 卫戍协议·规程/PRTS盟约记录）
  const coreOn=c=>bonds.cores[c]&&bonds.cores[c].on, coreL=c=>(setup.L||{})[c]||0;
  const subOn=s=>bonds.subs[s]&&bonds.subs[s].on, subL=s=>(setup.subL||{})[s]||0;
  function unitInit(u,m){ const F=FIELD.ops[m.op.name]||{}, k=m.elite?1:0, bs=m.op.bonds.concat(m.sel&&m.sel.bond?[m.sel.bond]:[]);
    let hp=(setup.base&&setup.base.xHp)||0, df=0;
    if(bs.includes('阿戈尔')&&coreOn('egir')) hp+=35+coreL('egir');
    if(bs.includes('乌萨斯')&&coreOn('ursus')) hp+=10+0.3*coreL('ursus');
    if(subOn('坚守')) hp+=25+1.2*subL('坚守');
    if(bs.includes('独行')&&bonds.subs['独行']&&bonds.subs['独行'].n===1) hp+=60;
    if(subOn('助力')) df+=15+1.2*subL('助力');
    u.maxHp=(F.hp||[1,1])[k]*(1+hp/100); u.df=(F.df||[0,0])[k]*(1+df/100); u.res=(F.res||[0,0])[k]; u.rsp=(F.rsp||[70,70])[k]*(subOn('助力')?0.7:1);
    u.jh=bs.includes('聚合')?{atk:m.op.atk[k]*(1+((setup.base&&setup.base.xAtk)||0)/100),set:new Set((FIELD.ranges[(F.rng||[])[k]]||[[0,0]]).map(([dr,dc])=>(m.r+dr)+','+(m.c+dc)))}:null;
    const ea=eaten.get(m); u.hp=ea&&ea.alive?Math.max(1,ea.hp-ea.dmg):u.maxHp;
    u.down=false; u.upAt=0; u.taken=0; u.falls=0; u.healIn=0; u.healOut=0; u.dep=(TEAM.H-1-m.r)*TEAM.W+m.c; }
  // 医疗干员：每个攻击间隔治疗范围内生命比例最低的友方（群愈师 3 名；链愈师在 3 名之间跳跃，每跳 −15%），治疗量 = 攻击力
  function healInit(u,m){ const F=FIELD.ops[m.op.name]||{}, k=m.elite?1:0, cls=m.op.cls||'';
    u.hAtk=m.op.atk[k]*(1+((setup.base&&setup.base.xAtk)||0)/100);
    u.hIv=Math.max(1,Math.round(((F.bat||[2.85,2.85])[k])/(Math.max(10,100+((setup.base&&setup.base.xAspd)||0))/100)*30))/30;
    u.hN=cls.includes('群愈师')?3:cls.includes('链愈师')?3:1; u.hDecay=cls.includes('链愈师')?0.85:1; u.hT=0;
    u.hSet=new Set((FIELD.ranges[(F.rng||[])[k]]||[[0,0]]).map(([dr,dc])=>(m.r+dr)+','+(m.c+dc))); }
  const agents=[];
  for(const m of setup.members){ if(m.op.healer)continue;
    // 干员所属、且已激活的核心盟约全部生效
    const cores={}; for(const c in bonds.cores){ const b=bonds.cores[c]; if(b.on&&m.op.bonds.includes(CORE[c].name)) cores[c]={L:(setup.L||{})[c]||0,six:b.six}; }
    const coreId=Object.keys(cores)[0]||null;
    const sub={}; for(const s in SUBS){ const b=bonds.subs[s]; sub[s]={on:b.on,L:(setup.subL||{})[s]||0,three:b.three}; }
    // 独行：在场只有 1 名时才生效
    if(sub['独行']) sub['独行'].on=bonds.subs['独行'].n===1;
    const cell=B.cell[m.r][m.c];
    const cfg=Object.assign({},setup.base,{core:coreId||'none',cores,bondOn:!!coreId,six:false,L:0,
      sub,T:TMAX,N:1,team:true,dvGain:dvGain.get(m)||null,eaten:eaten.get(m)||null,deploys:setup.members.length,sargRate:0,
      boss:!!setup.boss,teamEp:null,blocking:true,
      tileAtk:cell.ch==='i'?20:0,tileAspd:cell.ch==='i'?20:0});
    const A=makeAgent(m.op,m.elite,cfg,Object.assign({trace:!!setup.trace},m.sel),W);
    A.idx=agents.length; A.m=m; A.si=teamSkillIndex(m.op,m.sel.skill); A.blk=m.op.healer?0:((FIELD.ops[m.op.name]||{}).blk||[1,1])[m.elite?1:0]; A.blocked=[];
    A.ranged=!!m.op.r; A.trig=teamTrigger(m.op,A.si);
    unitInit(A,m);
    agents.push(A);
  }
  W.agents=agents;
  // 在场、能阻挡的单位：存活的干员，加上治疗干员（不输出，但同样占格子、阻挡敌人）。被吞噬并阵亡的干员不在场上
  const onField=agents.filter(a=>!a.dead);
  for(const m of setup.members) if(m.op.healer){ const u={m,healer:true,blk:((FIELD.ops[m.op.name]||{}).blk||[1,1])[m.elite?1:0],blocked:[]}; unitInit(u,m); healInit(u,m); onField.push(u); }
  // ── 敌人 ──
  let uid=0, leaked=0, leakedN=0, killed=0, spawned=0, lastKill=0;
  const queue=teamExpand(R,setup.sp);
  let total=queue.length;
  // 生成一个敌人。from：死后分裂出来的，从母体的位置和路线进度接着走
  const spawn=(q,from)=>{ const d=FIELD.enemies[q.key], rt=from?from.rt:routes[q.route]; if(!d||!rt)return;
    const isBoss=d.type==='BOSS', ab=d.ab||{};
    // 领袖生命按难度的固定值，不吃每回合成长；其余敌人按回合成长
    // 需要 N 次伤害击倒的敌人：生命就是次数，不随回合成长
    const hp=ab.hits?ab.hits:isBoss&&setup.boss?(setup.boss.blood[mode.id]||d.hp):d.hp*sc[1];
    const p=from?[from.y,from.x]:rt.line[0].p;
    const e=newEnemy({uid:uid++,key:q.key,name:d.name,hp,maxHp:hp,atk:(d.atk||0)*(isBoss?1:sc[0]),dt:d.dt||'p',route:from?from.route:q.route,dmgBy:{},def:d.def,res:Math.min(100,d.res+(ab.refract||0)),boss:isBoss,mass:d.mass,fly:d.fly,spd:d.spd*(isBoss?1:sc[2]),lp:d.lp,
      bat:d.bat||2,range:d.range,rt,seg:from?from.seg:0,y:p[0],x:p[1],wait:0,blockedBy:null,atkT:d.bat||2,born:W.f,ab,camo:!!ab.camo,child:!!from});
    enemies.push(e); spawned++; };
  const later=[];   // 延迟生成（死后召唤）
  // 阻挡：地面敌人与干员中心的距离小于 0.7071 格（格子外接圆）时被阻挡，停在干员身前一格；
  // 围栏（|）上的干员不阻挡地面敌人；同时碰到几名还有阻挡数的干员时，被最近的那名阻挡（PRTS 游戏数据基础·阻挡半径）
  const tryBlock=e=>{ if(e.fly||e.ab.unblock||e.blockedBy) return false; let best=null, bd=0.49999037;
    for(const a of onField){ if(a.down||!(a.blk>0)||a.blocked.length>=a.blk||B.cell[a.m.r][a.m.c].ch==='|') continue;
      const d=(e.y-a.m.r)**2+(e.x-a.m.c)**2; if(d<bd){ bd=d; best=a; } }
    if(best){ e.blockedBy=best; best.blocked.push(e); return true; } return false; };
  const tileOf=e=>[Math.round(e.y),Math.round(e.x)];
  // 范围缓存：每名干员当前用的范围（技能开启时可能变大）
  const rangeSet=a=>{ const on=a.skillOn(), key=on?1:0; a._rk=a._rk||{}; if(!a._rk[key]){ const s=new Set(); for(const [dr,dc] of teamRange(a.m.op,a.m.elite,on,a.si)) s.add((a.m.r+dr)+','+(a.m.c+dc)); a._rk[key]=s; } return a._rk[key]; };
  const remOf=e=>{ const ln=e.rt.line, i=Math.min(e.seg,ln.length-1); if(i>=ln.length-1) return 0; const nx=ln[i+1].p; return ln[i+1].rem+Math.hypot(nx[0]-e.y,nx[1]-e.x); };
  const hidden=e=>{ if(e.blockedBy)return false; if(e.camo)return true; const t=tileOf(e), c=B.cell[t[0]]&&B.cell[t[0]][t[1]]; return !!(c&&c.ch==='g'); };
  const selectable=(a,e)=>!(e.dead||e.gone||e.down>W.f||(e.fly&&!a.ranged)||hidden(e));
  // 敌人按半径 0.1 的碰撞箱判定是否在范围内：与哪个格子有重叠就算在哪个格子里（PRTS 作战机制“索敌抬手等均使用碰撞箱”）
  const COL=0.1, colKeys=e=>{ const out=[], rs=new Set([Math.round(e.y-COL),Math.round(e.y+COL)]), cs=new Set([Math.round(e.x-COL),Math.round(e.x+COL)]);
    for(const r of rs)for(const c of cs){ const dy=Math.max(0,Math.abs(e.y-r)-0.5), dx=Math.max(0,Math.abs(e.x-c)-0.5); if(dy*dy+dx*dx<COL*COL) out.push(r+','+c); }
    return out; };
  const inSet=(s,e)=>{ for(const k of colKeys(e)) if(s.has(k)) return true; return false; };
  W.inRange=(a,e)=>{ if(a.down||!selectable(a,e))return false; return e.blockedBy===a||inSet(rangeSet(a),e); };
  W.targets=a=>{ if(a.down) return []; const s=rangeSet(a), out=[];
    for(const e of enemies){ if(!selectable(a,e))continue; if(e.blockedBy===a||inSet(s,e)) out.push(e); }
    out.sort((p,q)=>((q.blockedBy===a)-(p.blockedBy===a))||(remOf(p)-remOf(q))||(p.uid-q.uid));
    return out; };
  W.deal=(a,e,d)=>{ if(e.dead||e.gone||e.down>W.f||!(d>0))return 0; if(e.ab.hits) d=1; const got=Math.min(d,e.hp); e.hp-=d; e.dmgBy[a.idx]=(e.dmgBy[a.idx]||0)+got;
    // 复苏：首次被击倒后原地倒下一段时间，然后满血站起来
    if(e.hp<=0&&e.ab.reborn!=null&&!e.reborned){ e.reborned=true; e.hp=0; e.down=W.f+Math.round(e.ab.reborn*30); e.upAt=e.down; return got; }
    if(e.hp<=0&&e.ab.split){ const sp=e.ab.split; for(let j=0;j<sp.n;j++) later.push({at:W.f+Math.round(sp.delay*30),key:sp.key,from:{y:e.y,x:e.x,rt:e.rt,seg:e.seg,route:e.route}}); total+=sp.n; }
    if(e.hp<=0){ e.dead=true; e.hp=0; e.deadAt=W.f; e.killer=a.idx; killed++; lastKill=W.f; a.killed(); if(e.blockedBy){ const b=e.blockedBy; b.blocked=b.blocked.filter(z=>z!==e); e.blockedBy=null; } }
    return got; };
  // 技能触发：按方案检查范围内有没有敌人（无视可选性：隐匿、空中的敌人同样算）
  const keysOf=(a,offs)=>{ const s=new Set(); for(const [dr,dc] of offs) s.add((a.m.r+dr)+','+(a.m.c+dc)); return s; };
  W.canCast=a=>{ if(a.down) return false; const t=a.trig; if(t==='always') return true;
    const live=e=>!(e.dead||e.gone||e.down>W.f);
    if(t==='field') return enemies.some(live);
    if(!a._trigSet){ a._trigSet=t==='default'?new Set([...rangeSet(a),...keysOf(a,teamRange(a.m.op,a.m.elite,true,a.si))]):keysOf(a,FIELD.ranges[t]||[[0,0]]); }
    for(const e of enemies) if(live(e)&&(e.blockedBy===a||inSet(a._trigSet,e))) return true;
    return false; };
  W.blocking=a=>a.blocked.length>0;
  W.blockedBy=(a,e)=>e.blockedBy===a;
  // 聚合：范围内的我方单位每秒回复 (16+0.12×层)% 攻击力的生命；3 人时范围内获得 (15+0.08×层)% 庇护
  const jhHeal=subOn('聚合')?(16+0.12*subL('聚合'))/100:0, jhGuard=subOn('聚合')&&bonds.subs['聚合'].three?(15+0.08*subL('聚合'))/100:0;
  W.attacksMe=(a,e)=>e.tgt===a;
  // 受到一次敌人攻击；生命归零时倒下，放开阻挡的敌人，按再部署时间返场
  const hurt=(u,e)=>{ const A=e.atk||0; if(!(A>0)||e.dt==='n') return;
    let d=e.dt==='m'?Math.max(A*(1-u.res/100),A*0.05):Math.max(A-u.df,A*0.05);
    if(jhGuard&&onField.some(g=>g.jh&&!g.down&&g.jh.set.has(u.m.r+','+u.m.c))) d*=1-jhGuard;
    u.hp-=d; u.taken+=d;
    if(u.hp<=0){ u.hp=0; u.down=true; u.falls++; u.upAt=W.f+Math.round(u.rsp*30);
      for(const z of u.blocked) z.blockedBy=null; u.blocked=[]; if(u.fall) u.fall(); } };
  W.blockedList=(a,n)=>a.blocked.slice(0,n);
  W.nextOf=(a,e)=>{ const t=W.targets(a); return t.find(z=>z!==e)||null; };
  W.onCast=a=>{ if(a.cores.sargon) for(const b of agents) if(b!==a&&b.cores.sargon) b.sargStack(); };
  // 回放：每 0.5 秒记一帧
  const frames=setup.trace?[]:null;
  const F=Math.round(TMAX*30); let qi=0, endF=F;
  for(W.f=0;W.f<F;W.f++){
    const t=W.f/30;
    while(qi<queue.length&&queue[qi].t<=t){ spawn(queue[qi]); qi++; }
    for(let j=later.length-1;j>=0;j--) if(later[j].at<=W.f){ const q=later.splice(j,1)[0]; spawn(q,q.from); }
    for(const e of enemies) if(e.upAt&&e.upAt<=W.f){ e.hp=e.maxHp; e.upAt=0; }
    // 减防减抗类光环：技能开启时作用于范围内所有敌人，所有干员共享
    for(const e of enemies){ e.mDef=1; e.mRes=1; }
    for(const a of agents){ if(!a.m.op.deb||!a.skillOn())continue; const b=a.buffs();
      for(const e of enemies) if(!e.dead&&!e.gone&&W.inRange(a,e)){ e.mDef=Math.min(e.mDef,b.defMul||1); e.mRes=Math.min(e.mRes,b.resMul||1); } }
    for(const a of agents) a.stepA();
    worldSecond(W);
    // 再部署：倒下的干员到时间后满血返场
    for(const u of onField) if(u.down&&W.f>=u.upAt){ u.down=false; u.hp=u.maxHp; if(u.redeploy) u.redeploy(); }
    // 敌人普通攻击：被阻挡时打阻挡它的干员；远程敌人打射程内最后部署的干员（干员碰撞箱半径 0.25 格）
    for(const e of enemies){ if(e.dead||e.gone||e.down>W.f)continue;
      let tgt=e.blockedBy&&!e.blockedBy.down?e.blockedBy:null;
      if(!tgt&&e.range>0) for(const u of onField){ if(u.down)continue; if(Math.hypot(u.m.r-e.y,u.m.c-e.x)<=e.range+0.25&&(!tgt||u.dep>tgt.dep)) tgt=u; }
      if(tgt){ e.atkT-=1/30; if(e.atkT<=0){ e.atkT+=e.bat; e.tgt=tgt; const stopped=worldEnemyAttack(W,e); if(HURT&&!stopped) hurt(tgt,e); } } else e.atkT=Math.min(e.atkT,e.bat); }
    // 聚合的每秒回复
    if(HURT&&jhHeal&&W.f%30===29) for(const g of onField){ if(!g.jh||g.down)continue; const amt=g.jh.atk*jhHeal;
      for(const v of onField){ if(v.down||v.hp>=v.maxHp||!g.jh.set.has(v.m.r+','+v.m.c))continue; const got=Math.min(amt,v.maxHp-v.hp); v.hp+=got; v.healIn+=got; g.healOut+=got; } }
    // 治疗
    if(HURT) for(const u of onField){ if(!u.healer||u.down)continue; u.hT-=1/30; if(u.hT>0)continue;
      const cand=onField.filter(v=>!v.down&&v.hp<v.maxHp&&u.hSet.has(v.m.r+','+v.m.c)).sort((p,q)=>p.hp/p.maxHp-q.hp/q.maxHp);
      if(!cand.length){ u.hT=0; continue; }
      let amt=u.hAtk; for(const v of cand.slice(0,u.hN)){ const got=Math.min(amt,v.maxHp-v.hp); v.hp+=got; v.healIn+=got; u.healOut+=got; amt*=u.hDecay; }
      u.hT=u.hIv; }
    for(const a of agents) a.stepB();
    // 敌人移动
    for(const e of enemies){ if(e.dead||e.gone||e.blockedBy||e.down>W.f)continue;
      if(tryBlock(e)) continue;
      if(e.wait>0){ e.wait-=1/30; continue; }
      let step=e.spd*R.mul/30; const ln=e.rt.line;
      while(step>0&&e.seg<ln.length-1){ const nx=ln[e.seg+1];
        if(nx.w!=null&&!nx.done){ e.seg++; e.wait=nx.w; break; }
        const dy=nx.p[0]-e.y, dx=nx.p[1]-e.x, d=Math.hypot(dy,dx);
        if(d<=step){ e.y=nx.p[0]; e.x=nx.p[1]; e.seg++; step-=d; } else { e.y+=dy/d*step; e.x+=dx/d*step; step=0; } }
      if(e.seg>=ln.length-1&&e.rt.loop!=null){ e.seg=e.rt.loop; }   // 巡逻：回到巡逻圈起点继续
      else if(e.seg>=ln.length-1&&!(e.wait>0)&&!e.boss){ e.gone=true; e.leakAt=W.f; leaked+=e.lp; leakedN++; continue; }
      tryBlock(e);
    }
    if(frames&&W.f%15===0) frames.push({t,en:enemies.filter(e=>!e.dead&&!e.gone).map(e=>[e.uid,+e.y.toFixed(2),+e.x.toFixed(2),+(e.hp/e.maxHp).toFixed(3),e.blockedBy?1:0,hidden(e)||e.down>W.f?1:0]),
      ag:agents.map(a=>[a.skillOn()?1:0,Math.round(a.result(1).total)]),u:onField.map(u=>[u.m.r,u.m.c,+(u.hp/u.maxHp).toFixed(3),u.down?1:0])});
    // 普通回合：全部出完并且场上没有敌人就结束；领袖回合：领袖倒下就结束
    if(qi>=queue.length&&!later.length&&enemies.every(e=>e.dead||e.gone)){ endF=W.f+1; break; }
    if(setup.boss){ const bo=enemies.find(e=>e.boss); if(bo&&bo.dead){ endF=W.f+1; break; } }
  }
  const dur=endF/30;
  const boss=enemies.find(e=>e.boss);
  const hurtOf=u=>u&&u.maxHp?{taken:u.taken,falls:u.falls,hp:u.down?0:u.hp/u.maxHp,healIn:u.healIn,healOut:u.healOut}:null;
  const res=agents.map(a=>{ const r=a.result(dur); return {m:a.m,r,dps:r.total/dur,total:r.total,kills:r.kills,eaten:eaten.get(a.m)||null,dv:dvGain.get(a.m)||null,hurt:hurtOf(a)}; });
  for(const u of onField) if(u.healer) res.push({m:u.m,healer:true,total:0,dps:0,kills:0,hurt:hurtOf(u)});
  // 回合结束时按未击倒的敌人数扣目标生命，每回合至多 10 点（PRTS 卫戍协议/帮助 §回合结束）
  const lifeLoss=setup.boss?0:Math.min(10,total-killed);
  return {hurtOn:HURT,falls:onField.reduce((a,u)=>a+(u.falls||0),0),dur,T,total,spawned,killed,leaked,leakedN,lifeLoss,alive:enemies.filter(e=>!e.dead&&!e.gone).length,cleared:killed+leakedN>=total&&enemies.every(e=>e.dead||e.gone),
    clearT:killed?lastKill/30:null,boss:boss?{name:boss.name,hp:boss.maxHp,left:boss.hp,dead:boss.dead,t:boss.dead?dur:null}:null,
    res,bonds,frames,routes,board:B,queue,scale:sc,enemies:enemies.map(e=>({uid:e.uid,key:e.key,name:e.name,fly:e.fly,boss:e.boss,route:e.route,child:e.child,born:e.born/30,deadAt:e.deadAt!=null?e.deadAt/30:null,leakAt:e.leakAt!=null?e.leakAt/30:null,maxHp:e.maxHp,left:e.hp,dmgBy:e.dmgBy,killer:e.killer})),eaten:[...eaten.values()]};
}
