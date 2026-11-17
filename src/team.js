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

// 干员受击时的减伤（精锐模组特性与天赋，取自模式内游戏数据）：
//   physHi 生命高于一半时物理伤害降低；blkDr 受到自身阻挡单位的伤害降低；dr 受到的伤害降低；loDr 生命低于一半时庇护；
//   defBlk 阻挡时防御力提高；dodgeP 物理闪避（取期望）；healIn 受到的治疗提高；noHeal 不能被友方治疗；
//   revive 被击倒时不撤退并回复到该比例的生命（每次部署 1 次）；last 受到致命伤时保持 1 点生命若干秒后才倒下
const TOUGH={'艾丝黛尔':{physHi:0.2},'摆渡人':{physHi:0.2},'斥罪':{blkDr:0.15},'折桠':{blkDr:0.15},'“暴躁铁皮”':{blkDr:0.15},
  '瑕光':{dr:0.15},'赫拉格':{loDr:0.25},'宴':{loDr:0.25},'拜松':{defBlk:0.2},'泡泡':{defBlk:0.2},'蛇屠箱':{defBlk:0.2},
  '忍冬':{defBlk:0.08},'青枳':{defBlk:0.08},'杰克':{dodgeP:0.15},'乌尔比安':{healIn:1.2},'赫德雷':{healIn:1.2},
  '海沫':{noHeal:1},'隐德来希':{noHeal:1},'斯卡蒂':{revive:0.4},'史尔特尔':{last:9}};

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

// 官方地面寻路（据 sganggs/Stronghold-Protocol docs/research/08 §3.1，解自游戏客户端 Torappu.Battle.SPFA）：
//   从目的地出发做 4 方向 SPFA，邻居顺序 上(行+1)、右、下、左，阻隔工事代价 1000、其余 1，同代价时保留最先到达的父节点；
//   然后按行优先、原地做视线平滑：每个格子的父节点沿链往前跳，只要 Bresenham 视线畅通（斜步时两侧都要能通行）。
//   敌人从所在格子直走向父节点的中心。行号与游戏一致（0 在最下面）。
function teamFlow(B,dest){
  const key=dest[0]+','+dest[1]; B._ff=B._ff||{}; if(B._ff[key]) return B._ff[key];
  const H=TEAM.H, W=TEAM.W, N=H*W, id=(r,c)=>r*W+c;
  // 射击台把地块改成高地（PRTS：可以阻挡路线，无敌），地面敌人不能通行；阻隔工事可以被拆，按代价 1000 绕行
  const walk=(r,c)=>r>=0&&r<H&&c>=0&&c<W&&TEAM.PASS.has(B.cell[r][c].ch)&&B.cell[r][c].obs!=='plat';
  const crate=(r,c)=>B.cell[r][c].obs==='crate';
  const clear=(r,c)=>walk(r,c)&&!crate(r,c);
  const dist=new Int32Array(N).fill(-1), par=new Int32Array(N).fill(-1), inQ=new Uint8Array(N);
  if(!walk(dest[0],dest[1])) return (B._ff[key]={dist,par});
  const q=[id(dest[0],dest[1])]; dist[q[0]]=0; inQ[q[0]]=1;
  for(let h=0;h<q.length;h++){ const cur=q[h]; inQ[cur]=0; const r=Math.floor(cur/W), c=cur%W;
    for(const [dr,dc] of [[1,0],[0,1],[-1,0],[0,-1]]){ const nr=r+dr, nc=c+dc; if(!walk(nr,nc)) continue;
      const nb=id(nr,nc), nd=dist[cur]+(crate(nr,nc)?1000:1);
      if(dist[nb]<0||nd<dist[nb]){ dist[nb]=nd; par[nb]=cur; if(!inQ[nb]){ q.push(nb); inQ[nb]=1; } } } }
  const los=(a,b)=>{ let r0=Math.floor(a/W), c0=a%W; const r1=Math.floor(b/W), c1=b%W;
    const dx=Math.abs(c1-c0), dy=-Math.abs(r1-r0), sx=c0<c1?1:-1, sy=r0<r1?1:-1; let err=dx+dy;
    while(true){ if(!clear(r0,c0)) return false; if(r0===r1&&c0===c1) return true;
      const e2=2*err; let mc=false, mr=false; if(e2>dy){ err+=dy; c0+=sx; mc=true; } if(e2<dx){ err+=dx; r0+=sy; mr=true; }   // 恰好居中时先走直步，再走斜步
      if(mc&&mr&&(!clear(r0-sy,c0)||!clear(r0,c0-sx))) return false; } };
  for(let r=0;r<H;r++) for(let c=0;c<W;c++){ const n=id(r,c); if(dist[n]<0||par[n]<0) continue;
    let b=par[n]; while(par[b]>=0&&los(n,par[b])) b=par[b]; par[n]=b; }
  return (B._ff[key]={dist,par});
}
// 沿流场从 a 走到 b：返回格子中心组成的折线；走不到时返回 null
function teamFlowPath(B,a,b){ const F=teamFlow(B,b), W=TEAM.W; let n=a[0]*W+a[1]; if(F.dist[n]<0) return null;
  const out=[[a[0],a[1]]]; let guard=0; while(F.par[n]>=0&&guard++<200){ n=F.par[n]; out.push([Math.floor(n/W),n%W]); } return out; }

// 把一条出怪路线变成折线（[行,列] 点列，WAIT 用 {w:秒} 表示）
function teamRoute(B,route){
  const fixEnd=p=>(B.cell[p[0]]&&B.cell[p[0]][p[1]]&&B.cell[p[0]][p[1]].ch==='E')||route.fly?p:(B.end||p);
  // 巡逻点（PATROL_MOVE）：走到第一个巡逻点后在这些点之间循环，不再走向终点
  const pms=route.cp.filter(c=>c.pm).map(c=>c.pm);
  const wps=[]; for(const c of route.cp){ if(c.m)wps.push({p:c.m}); else if(c.w!=null)wps.push({w:c.w}); else if(c.pm)break; }
  if(pms.length){ for(const p of pms) wps.push({p}); wps.push({p:pms[0],close:1}); }
  else wps.push({p:fixEnd(route.e)});
  let cur=route.s; const line=[{p:cur}], legs=[]; let blockedPath=false, loop=null;
  for(const w of wps){
    if(w.w!=null){ line.push({w:w.w,p:cur}); continue; }
    if(route.fly){ line.push({p:w.p}); cur=w.p; }
    else { const seg=teamFlowPath(B,cur,w.p), F=teamFlow(B,w.p), d0=F.dist[cur[0]*TEAM.W+cur[1]];
      if(d0>=1000) blockedPath=true;   // 只能穿过阻隔工事：敌人被工事挡住并把它拆掉
      legs.push({dest:w.p,F});
      if(!seg){ line.push({p:w.p,leg:legs.length-1}); cur=w.p; } else { for(let i=1;i<seg.length;i++)line.push({p:seg[i],leg:legs.length-1}); cur=w.p; } }
    if(pms.length&&loop==null&&w.p===pms[0]&&!w.close) loop=line.length-1;
  }
  // 预先算好每个点到终点的剩余路程，用来决定“离出口最近”的索敌优先级；巡逻的敌人不会走到出口，排在最后
  let rem=0; for(let i=line.length-1;i>=0;i--){ line[i].rem=loop!=null?50+rem:rem; if(i>0){ const a=line[i-1].p,b=line[i].p; rem+=Math.hypot(a[0]-b[0],a[1]-b[1]); } }
  // 地面路线：每一段（到某个检查点/终点）的流场距离，后面各段的距离加起来作为“段尾”，索敌按 PRTS 仇恨的路径距离计算
  if(!route.fly&&!pms.length){ let tail=0; for(let i=legs.length-1;i>=0;i--){ legs[i].tail=tail; const st=i?legs[i-1].dest:route.s, d=legs[i].F.dist[st[0]*TEAM.W+st[1]]; tail+=d>=1000?d-999:d>=0?d:0; } }
  return {line,fly:route.fly,len:rem,blockedPath,loop,patrol:pms.length>0,legs:!route.fly&&!pms.length?legs:null};
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

// 朝向：0 右、1 上、2 左、3 下（第 0 行在最下面）。范围数据按朝右给出，按朝向旋转：
// 右 (dr,dc)、上 (dc,−dr)、左 (−dr,−dc)、下 (−dc,dr)（规则见 sganggs/Stronghold-Protocol docs/SIM.md「Facing」，解自游戏客户端）
const TEAM_FWD=[[0,1],[1,0],[0,-1],[-1,0]];
function teamRot(offs,dir){ dir=dir||0; if(!dir) return offs;
  return offs.map(([dr,dc])=>dir===1?[dc,-dr]:dir===2?[-dr,-dc]:[-dc,dr]); }
// 攻击范围（格子偏移，已按朝向旋转）
function teamRange(op,elite,skillOn,si,dir){
  const F=FIELD.ops[op.name]; if(!F) return [[0,0]];
  const k=elite?1:0; let id=F.rng[k];
  if(skillOn&&F.sk[si]&&F.sk[si][k]) id=F.sk[si][k];
  return teamRot(FIELD.ranges[id]||[[0,0]],dir);
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
//   members:[{op,elite,sel,r,c,dir}]（dir 朝向，缺省朝右），L:{核心盟约 id: 层数}，subL:{附加盟约: 层数}，base（其余参数，同单人计算），trace
function teamRun(setup){
  const B=teamBoard(setup.map,!!setup.boss,setup.tok);
  const R=setup.boss||setup.round, mode=setup.mode, rn=setup.boss?setup.boss.round:R.n, sc=teamScale(mode,rn);
  // 作战阶段强制 2 倍速：关卡时限是现实秒数，换成游戏内时间要乘 2。领袖回合超时后战斗继续（按秒扣生命），这里最多算到 300 秒
  const T=R.T*2, TMAX=setup.boss?Math.max(T,300):T;
  const routes=R.routes.map(r=>teamRoute(B,r));
  const bonds=teamBonds(setup.members);
  const occ={}; for(const m of setup.members) occ[m.r+','+m.c]=m;
  // 阿戈尔吞噬：每名【阿戈尔】干员吞掉身前（朝向的前方）一格的干员
  const dvGain=new Map(), eaten=new Map();
  if(bonds.cores.egir&&bonds.cores.egir.on){ const L=(setup.L||{}).egir||0;
    for(const m of setup.members){ if(!m.op.bonds.includes('阿戈尔'))continue; const fw=TEAM_FWD[m.dir||0], f=occ[(m.r+fw[0])+','+(m.c+fw[1])]; if(!f||eaten.has(f))continue;
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
    u.jh=bs.includes('聚合')?{atk:m.op.atk[k]*(1+((setup.base&&setup.base.xAtk)||0)/100),set:new Set(teamRot(FIELD.ranges[(F.rng||[])[k]]||[[0,0]],m.dir).map(([dr,dc])=>(m.r+dr)+','+(m.c+dc)))}:null;
    const ea=eaten.get(m); u.hp=ea&&ea.alive?Math.max(1,ea.hp-ea.dmg):u.maxHp;
    u.down=false; u.upAt=0; u.taken=0; u.falls=0; u.healIn=0; u.healOut=0; u.dep=(TEAM.H-1-m.r)*TEAM.W+m.c;
    u.tough=m.elite?TOUGH[m.op.name]||null:null; u.revived=false; u.lastUntil=0; }
  // 医疗干员：每个攻击间隔治疗范围内生命比例最低的友方（群愈师 3 名；链愈师在 3 名之间跳跃，每跳 −15%），治疗量 = 攻击力
  function healInit(u,m){ const F=FIELD.ops[m.op.name]||{}, k=m.elite?1:0, cls=m.op.cls||'';
    u.hAtk=m.op.atk[k]*(1+((setup.base&&setup.base.xAtk)||0)/100);
    u.hIv=Math.max(1,Math.round(((F.bat||[2.85,2.85])[k])/(Math.max(10,100+((setup.base&&setup.base.xAspd)||0))/100)*30))/30;
    u.hBat=(F.bat||[2.85,2.85])[k]; u.hAspd=Math.max(10,100+((setup.base&&setup.base.xAspd)||0));
    u.hN=cls.includes('群愈师')?3:cls.includes('链愈师')?3:1; u.hDecay=cls.includes('链愈师')?0.85:1; u.hT=0;
    u.hSet=new Set(teamRot(FIELD.ranges[(F.rng||[])[k]]||[[0,0]],m.dir).map(([dr,dc])=>(m.r+dr)+','+(m.c+dc))); }
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
  // ── 敌人技能 ──（setup.base.eab===false 时关闭：只保留分裂、复苏、次数击倒、无法阻挡、隐匿、折射）
  const EAB=!(setup.base&&setup.base.eab===false);
  const later=[];   // 延迟生成（死后召唤、分裂、周期召唤）
  const fxq=[];     // 延迟生效的效果 {at, fn}
  const zones=[];   // 地面区域：污染秽蚀、毒雾 {y,x,r,until,fn}
  const live=e=>!(e.dead||e.gone), act=e=>live(e)&&!(e.down>W.f);
  const dEE=(a,b)=>Math.hypot(a.y-b.y,a.x-b.x), dEU=(e,u)=>Math.hypot(e.y-u.m.r,e.x-u.m.c);
  W.dist=(a,e)=>dEU(e,a);   // 干员到敌人的距离（格），精准狙击镜按它判定
  // 确定性的“随机”：按敌人编号取值，同一布置每次结果相同，多只时比例接近概率
  const rnd=n=>{ let x=Math.imul((n+1)>>>0,2654435761)>>>0; x^=x>>>15; x=Math.imul(x,2246822519)>>>0; x^=x>>>13; return (x>>>0)/4294967296; };
  const pick=(opts,r)=>{ let s=0; for(const [k,p] of opts){ s+=p; if(r<s) return k; } return opts[opts.length-1][0]; };
  const fromOf=(e,x)=>Object.assign({y:e.y,x:e.x,rt:e.rt,seg:e.seg,route:e.route},x||{});
  const isKin=e=>/^enemy_122[01]_dzom/.test(e.key);   // 重生造物
  let roarUntil=0, roarV=0, ccStun=0, ccDis=0;
  let frostSrc=[], guardSrc=[], hideSrc=[], kinN=0;
  const queue=teamExpand(R,setup.sp);
  let total=queue.length;
  // 生成一个敌人。from：死后分裂出来的，从母体的位置和路线进度接着走
  const spawn=(q,from)=>{ const d=FIELD.enemies[q.key], rt=from?from.rt:routes[q.route]; if(!d||!rt)return;
    const isBoss=d.type==='BOSS', ab0=d.ab||{}, ab=EAB?ab0:{camo:ab0.camo,refract:ab0.refract,split:ab0.split,reborn:ab0.reborn,hits:ab0.hits,unblock:ab0.unblock};
    // 领袖生命按难度的固定值，不吃每回合成长；其余敌人按回合成长
    // 需要 N 次伤害击倒的敌人：生命就是次数，不随回合成长
    let hp=ab.hits?ab.hits:isBoss&&setup.boss?(setup.boss.blood[mode.id]||d.hp):d.hp*sc[1];
    if(ab.hpMul&&!ab.hits) hp*=ab.hpMul;   // 镜膜：最大生命 +100%
    const p=from?[from.y,from.x]:rt.line[0].p;
    const e=newEnemy({uid:uid++,key:q.key,name:d.name,hp,maxHp:hp,atk:(d.atk||0)*(isBoss?1:sc[0]),dt:d.dt||'p',route:from?from.route:q.route,dmgBy:{},def:d.def,res:Math.min(100,d.res+(ab.refract||0)),boss:isBoss,mass:d.mass,fly:d.fly,spd:d.spd*(isBoss?1:sc[2]),lp:d.lp,
      bat:d.bat||2,range:d.range,rt,seg:from?from.seg:0,y:p[0],x:p[1],wait:0,blockedBy:null,atkT:d.bat||2,born:W.f,ab,camo:!!ab.camo,child:!!from,
      aw:d.aw||'',taunt:ab.taunt||0,bv:ab.bv||1,hitsMode:!!ab.hits,spdMul:from&&from.spdMul||1});
    e.def0=e.def; e.res0=e.res; e.atk0=e.atk;
    if(EAB){ const at=s=>W.f+Math.round(s*30);
      e.shieldN=ab.shield||0; e.stack=0; e.blades=ab.blades?ab.blades.n:0; e.prison=ab.prison?{free:false}:null; e.nAtk=0;
      e.ammo=ab.disarm?ab.disarm.ammo:ab.ammoSplash?ab.ammoSplash.ammo:ab.ammoHit?ab.ammoHit.ammo:0;
      e.ambush=!!ab.ambush; e.charged=!!ab.charge; e.firstAtk=!!ab.firstSplash; e.rushN=0; e.rushRun=0; e.horn=0; e.rage=0; e.crit=new Set();
      e.sumAt=ab.summon?at(ab.summon.init):0; e.hideAt=ab.hideAura?at(ab.hideAura.init):0; e.hideOn=0;
      e.roarAt=ab.roar?at(ab.roar.init):0; e.weakAt=ab.weaken?at(ab.weaken.init):0; e.crossAt=ab.cross?at(ab.cross.init):0;
      e.feed=ab.feeder?pick(ab.feeder.opts,rnd(e.uid)):null; e.evStep=0; e.evadeUntil=0; e.fearUntil=0; e.fearDone=false; e.lowOn=false; e.noSplit=!!(from&&from.noSplit);
      e.stoneUntil=0; e.emberOn=false; e.bombed=false; e.gren=0; }
    if(from&&from.hpRatio!=null) e.hp=e.maxHp*from.hpRatio;
    enemies.push(e); spawned++; return e; };
  // 在敌人当前位置、沿它的路线生成 n 只 key（计入本回合敌人总数）
  const spawnAt=(e,key,n,delay,x)=>{ if(!FIELD.enemies[key]) return; for(let j=0;j<n;j++) later.push({at:W.f+Math.round((delay||0)*30),key,from:fromOf(e,x)}); total+=n; };
  const release=e=>{ if(e.blockedBy){ const b=e.blockedBy; b.blocked=b.blocked.filter(z=>z!==e); e.blockedBy=null; } };
  // 阻挡：地面敌人与干员中心的距离小于 0.7071 格（格子外接圆）时被阻挡，停在干员身前一格；
  // 围栏（|）上的干员不阻挡地面敌人；同时碰到几名还有阻挡数的干员时，被最近的那名阻挡（PRTS 游戏数据基础·阻挡半径）
  const capOf=a=>{ let c=a.blk; if(EAB){ let g=0; for(const z of a.blocked) if(z.ab.blkGive) g+=z.ab.blkGive.v; c+=Math.min(6,g);
      for(const z of enemies) if(z.ab.blkDown&&act(z)&&dEU(z,a)<=z.ab.blkDown.r){ c-=z.ab.blkDown.v; break; } } return c; };
  const usedOf=a=>{ let s=0; for(const z of a.blocked) s+=z.bv||1; return s; };
  const stunned=u=>u.stunUntil>W.f;
  const tryBlock=e=>{ if(e.fly||e.ab.unblock||e.blockedBy) return false;
    if(EAB&&(e.stoneUntil>W.f||(e.emberOn&&e.ab.ember.unblk))) return false;
    let best=null, bd=0.49999037;
    for(const a of onField){ if(a.down||!(a.blk>0)||(EAB&&stunned(a))||capOf(a)-usedOf(a)<(e.bv||1)||B.cell[a.m.r][a.m.c].ch==='|') continue;
      const d=(e.y-a.m.r)**2+(e.x-a.m.c)**2; if(d<bd){ bd=d; best=a; } }
    if(best){ e.blockedBy=best; best.blocked.push(e); return true; } return false; };
  const tileOf=e=>[Math.round(e.y),Math.round(e.x)];
  // 范围缓存：每名干员当前用的范围（技能开启时可能变大）
  const rangeSet=a=>{ const on=a.skillOn(), key=on?1:0; a._rk=a._rk||{}; if(!a._rk[key]){ const s=new Set(); for(const [dr,dc] of teamRange(a.m.op,a.m.elite,on,a.si,a.m.dir)) s.add((a.m.r+dr)+','+(a.m.c+dc)); a._rk[key]=s; } return a._rk[key]; };
  // 离终点的距离（索敌用）：地面路线按 PRTS 仇恨——所在格子到终点的寻路距离 + 修正值（所在位置→格子中心的向量在前进方向上的投影）
  const remOf=e=>{ const ln=e.rt.line, i=Math.min(e.seg,ln.length-1); if(i>=ln.length-1) return 0; const nx=ln[i+1].p;
    const L=e.rt.legs&&ln[i+1].leg!=null?e.rt.legs[ln[i+1].leg]:null;
    if(L){ const tr=Math.round(e.y), tc=Math.round(e.x), d=tr>=0&&tr<TEAM.H&&tc>=0&&tc<TEAM.W?L.F.dist[tr*TEAM.W+tc]:-1;
      if(d>=0){ const vy=nx[0]-e.y, vx=nx[1]-e.x, n=Math.hypot(vy,vx)||1; return (d>=1000?d-999:d)+L.tail+((tr-e.y)*vy+(tc-e.x)*vx)/n; } }
    return ln[i+1].rem+Math.hypot(nx[0]-e.y,nx[1]-e.x); };
  const hidden=e=>{ if(e.blockedBy)return false; if(e.camo)return true;
    if(EAB){ if(e.emberOn&&e.ab.ember.hide) return true; for(const z of hideSrc) if(z!==e&&dEE(z,e)<=z.ab.hideAura.r) return true; } const t=tileOf(e), c=B.cell[t[0]]&&B.cell[t[0]][t[1]]; return !!(c&&c.ch==='g'); };
  const selectable=(a,e)=>!(e.dead||e.gone||e.down>W.f||(e.fly&&!a.ranged)||hidden(e));
  // 敌人按半径 0.1 的碰撞箱判定是否在范围内：与哪个格子有重叠就算在哪个格子里（PRTS 作战机制“索敌抬手等均使用碰撞箱”）
  const COL=0.1, colKeys=e=>{ const out=[], rs=new Set([Math.round(e.y-COL),Math.round(e.y+COL)]), cs=new Set([Math.round(e.x-COL),Math.round(e.x+COL)]);
    for(const r of rs)for(const c of cs){ const dy=Math.max(0,Math.abs(e.y-r)-0.5), dx=Math.max(0,Math.abs(e.x-c)-0.5); if(dy*dy+dx*dx<COL*COL) out.push(r+','+c); }
    return out; };
  const inSet=(s,e)=>{ for(const k of colKeys(e)) if(s.has(k)) return true; return false; };
  W.inRange=(a,e)=>{ if(a.down||!selectable(a,e))return false; return e.blockedBy===a||inSet(rangeSet(a),e); };
  W.targets=a=>{ if(a.down) return []; const s=rangeSet(a), out=[];
    for(const e of enemies){ if(!selectable(a,e))continue; if(e.blockedBy===a||inSet(s,e)) out.push(e); }
    out.sort((p,q)=>((q.blockedBy===a)-(p.blockedBy===a))||((q.taunt||0)-(p.taunt||0))||(remOf(p)-remOf(q))||(p.uid-q.uid));
    return out; };
  W.deal=(a,e,d,t,noShare)=>{ if(e.dead||e.gone||e.down>W.f||!(d>0))return 0;
    if(EAB){ const ab=e.ab, pm=t!=='t'&&t!=='e';
      if(pm&&e.shieldN>0){ e.shieldN--; return 0; }   // 护盾：抵挡一次物理/法术伤害
      if(pm){ let m=e.auraDm||1; if(ab.dr) m*=1-ab.dr; if(ab.drUnblk&&!e.blockedBy) m*=1-ab.drUnblk;
        if(ab.lowDr&&e.hp<e.maxHp*ab.lowDr.hp) m*=1-ab.lowDr.v;
        if(ab.drMove) m*=1-(e.blockedBy||e.wait>0?ab.drMove.stop:ab.drMove.move);
        if(ab.lowDodge&&e.hp<e.maxHp*ab.lowDodge.hp) m*=1-ab.lowDodge.v;   // 闪避按期望
        if(ab.evade&&e.evadeUntil>W.f) m*=1-ab.evade.p;
        d*=m; }
      // 圣杯：周围地面敌人只受 5%，减少的部分由圣杯以真实伤害承担
      if(!noShare&&!e.fly&&!ab.share) for(const c of enemies) if(c.ab.share&&c!==e&&act(c)&&dEE(c,e)<=c.ab.share.r){ const keep=d*c.ab.share.v; W.deal(a,c,d-keep,'t',true); d=keep; break; }
      if(ab.hitAspd&&(!ab.hitAspd.magic||t==='m')){ const k=e.key.slice(0,10), o=a.hitDeb||(a.hitDeb={}), cur=o[k];
        if(!cur||cur.until<=W.f||ab.hitAspd.refresh) o[k]={v:ab.hitAspd.v,until:W.f+Math.round(ab.hitAspd.t*30)}; }
      if(ab.expose&&!ab.expose.death){ a.expUntil=W.f+Math.round(ab.expose.t*30); a.expV=ab.expose.v; } }
    if(e.hitsMode) d=1; const got=Math.min(d,e.hp); e.hp-=d; e.dmgBy[a.idx]=(e.dmgBy[a.idx]||0)+got;
    if(EAB) afterHit(e,a);
    const wasEmber=e.emberOn; if(e.hp<=0&&wasEmber){ e.emberOn=false; e.maxHp=e.emberMax; }   // 余烬被击倒：真正倒下
    // 复苏：首次被击倒后原地倒下一段时间，然后满血站起来
    if(e.hp<=0&&e.ab.reborn!=null&&!e.reborned){ e.reborned=true; e.hp=0; e.down=W.f+Math.round(e.ab.reborn*30); e.upAt=e.down; return got; }
    // 守墓石像：首次被击倒时回满生命，变为石像（防御 +800、法抗 +30，不能移动、不能被阻挡）10 秒，然后变为飞行单位
    if(EAB&&e.hp<=0&&e.ab.stone&&!e.stoned){ e.stoned=true; e.hp=e.maxHp; e.stoneUntil=W.f+Math.round(e.ab.stone.t*30); release(e); return got; }
    // 逐火 / 再生：被击倒后 1 秒重生 + 1 秒无敌，变为需要 N 次伤害击倒的余烬/再生状态；若干秒内没被击倒就满血复活
    if(EAB&&e.hp<=0&&e.ab.ember&&!wasEmber){ const m=e.ab.ember; e.emberOn=true; e.emberMax=e.maxHp; e.maxHp=m.hits; e.hp=m.hits; e.hitsMode=true;
      e.down=W.f+60; e.emberEnd=W.f+Math.round((1+m.t)*30); release(e);
      if(m.shield) for(const z of enemies) if(z!==e&&act(z)&&dEE(z,e)<=m.r) z.shieldN=Math.max(z.shieldN||0,m.shield);
      return got; }
    if(e.hp<=0&&e.ab.split){ const sp=e.ab.split, n=EAB&&e.ab.blades?Math.max(1,e.blades):sp.n;   // 沉沙：召唤剩余断刃数量的铜矛头（至少 1 个）
      for(let j=0;j<n;j++) later.push({at:W.f+Math.round(sp.delay*30),key:sp.key,from:fromOf(e)}); total+=n; }
    if(e.hp<=0){ e.dead=true; e.hp=0; e.deadAt=W.f; e.killer=a.idx; killed++; lastKill=W.f; a.killed(); release(e); if(EAB) onDeath(e,a); }
    return got; };
  // 受到伤害后：弧光镜卫叠层、孽生者临战、掷弹兵掷弹、恐惧、集养者分裂、茧的伪装、阿利斯泰尔半血强化
  function afterHit(e,a){ const ab=e.ab;
    if(ab.defStack) e.stack=Math.min(ab.defStack.max,e.stack+1);
    if(ab.wake) e.awake=true;
    if(ab.grenade&&!e.gren&&!e.blockedBy&&e.hp>0){ e.gren=1; if(HURT) for(const [dy,dx] of [[0,1],[0,-1],[1,0],[-1,0]]){ let hit=null, hd=99;
        for(const u of onField){ if(u.down)continue; const ry=u.m.r-e.y, rx=u.m.c-e.x; const along=dy?ry*dy:rx*dx, side=dy?Math.abs(rx):Math.abs(ry); if(along>0&&side<0.5&&along<hd){ hd=along; hit=u; } }
        if(hit) for(const u of onField) if(!u.down&&Math.hypot(u.m.r-hit.m.r,u.m.c-hit.m.c)<=ab.grenade.r) hurt(u,e,e.atk*ab.grenade.scale,'p'); } }
    if(ab.fear&&!e.fearDone&&e.hp>0&&e.hp<e.maxHp*0.5){ e.fearDone=true; e.fearUntil=W.f+Math.round(ab.fear.t*30); }
    if(ab.halfSplit&&!e.noSplit&&e.hp>0&&e.hp<e.maxHp*ab.halfSplit.ratio){ e.noSplit=true; spawnAt(e,ab.halfSplit.key,1,0,{hpRatio:e.hp/e.maxHp,noSplit:true}); }
    if(ab.evade){ const st=Math.floor((1-Math.max(0,e.hp)/e.maxHp)/ab.evade.step+1e-9); if(st>e.evStep){ e.evStep=st; e.evadeUntil=W.f+Math.round(ab.evade.t*30); } }
    if(ab.lowUp&&!e.lowOn&&e.hp<e.maxHp*ab.lowUp.hp) e.lowOn=true; }
  // 倒下时：寄生者召唤、饲育者释放、沸血骑士叠层；受击开启时还有死亡爆炸、污染秽蚀、毒雾、暴露
  function onDeath(e,a){ const ab=e.ab;
    if(!isKin(e)) for(const z of enemies) if(z.ab.parasite&&z!==e&&act(z)&&dEE(z,e)<=z.ab.parasite.r){ spawnAt(e,z.ab.parasite.key,1,0); break; }
    if(e.feed) spawnAt(e,e.feed,1,0,{spdMul:1+ab.feeder.spd});
    for(const z of enemies) if(z.ab.rage&&act(z)&&z!==e) z.rage=Math.min(z.ab.rage.max,z.rage+1);
    if(!HURT) return; const y=e.y, x=e.x, atk=e.atk;
    if(ab.boom) fxq.push({at:W.f+Math.round(ab.boom.delay*30),fn:()=>{ for(const u of onField) if(!u.down&&Math.hypot(u.m.r-y,u.m.c-x)<=ab.boom.r) hurt(u,e,atk*ab.boom.scale,ab.boom.dt); }});
    if(ab.pollute) zones.push({y,x,r:ab.pollute.r,until:W.f+Math.round(ab.pollute.t*30),key:'pollute',fn:u=>hurt(u,e,u.m.op.r?ab.pollute.v/2:ab.pollute.v,'t',{raw:1})});
    if(ab.poison&&a&&a.m) zones.push({y:a.m.r,x:a.m.c,r:ab.poison.r,until:W.f+Math.round(ab.poison.t*30),key:'poison'+e.uid,fn:u=>hurt(u,e,atk*ab.poison.scale,'m')});
    if(ab.expose&&ab.expose.death) for(const u of onField) if(!u.down&&Math.hypot(u.m.r-y,u.m.c-x)<=ab.expose.r){ u.expUntil=W.f+Math.round(ab.expose.t*30); u.expV=ab.expose.v; } }
  // 每帧：光环（防御/法抗/减伤）、回复、各种计时技能
  function enemyFrame(){ const src=enemies.filter(act);
    const defA=src.filter(z=>z.ab.auraDef), resA=src.filter(z=>z.ab.auraRes), phA=src.filter(z=>z.ab.phalanx), drA=src.filter(z=>z.ab.auraDr);
    frostSrc=src.filter(z=>z.ab.aspdAura); hideSrc=src.filter(z=>z.hideOn>W.f&&z.ab.hideAura);
    guardSrc=src.filter(z=>z.ab.guardAspd&&src.some(s=>s!==z&&s.key.startsWith(z.ab.guardAspd.near)&&dEE(s,z)<=z.ab.guardAspd.nr));
    kinN=src.filter(isKin).length;
    for(const e of enemies){ if(!live(e))continue; const ab=e.ab;
      let def=e.def0, res=e.res0;
      if(e.prison){ if(!e.prison.free) def+=ab.prison.def; else res+=ab.prison.res; }
      if(e.stoneUntil>W.f){ def+=ab.stone.def; res+=ab.stone.res; }
      if(e.lowOn){ def*=ab.lowUp.defMul; res+=ab.lowUp.res; }
      let ad=0; for(const z of defA) if(z!==e&&dEE(z,e)<=z.ab.auraDef.r) ad=Math.max(ad,z.ab.auraDef.v); def+=ad;
      let ar=0; for(const z of resA) if(z!==e&&dEE(z,e)<=z.ab.auraRes.r) ar=Math.max(ar,z.ab.auraRes.v); res+=ar;
      if(ab.phalanx) for(const z of phA) if(z!==e&&dEE(z,e)<=z.ab.phalanx.r) def+=z.ab.phalanx.v;
      if(ab.defStack&&e.stack>=2){ def=Math.max(0,def+ab.defStack.def*e.stack); res+=ab.defStack.res*e.stack; }
      e.def=def; e.res=Math.min(100,Math.max(0,res));
      let dm=1; for(const z of drA) if(dEE(z,e)<=z.ab.auraDr.r) dm*=1-z.ab.auraDr.v; e.auraDm=dm;
      // 解除阻挡时：战线推进者获得强击标记；山海众重新隐匿，获得强击标记
      if(e.wasBlk&&!e.blockedBy){ if(ab.charge) e.charged=true; if(ab.ambush) e.ambush=true; } e.wasBlk=!!e.blockedBy;
      if(e.down>W.f) continue;
      let rg=ab.regen||0; if(e.prison&&e.prison.free) rg+=ab.prison.regen;
      if(rg&&!e.emberOn&&e.hp<e.maxHp) e.hp=Math.min(e.maxHp,e.hp+rg/30);
      if(e.stoneUntil&&W.f>=e.stoneUntil){ e.stoneUntil=0; e.fly=true; e.dt='m'; }   // 石像结束：变为飞行单位，远程法术攻击
      if(e.emberOn&&W.f>=e.emberEnd){ e.emberOn=false; e.hitsMode=!!ab.hits; e.maxHp=e.emberMax; e.hp=e.maxHp; }   // 余烬撑过时限：满血复活
      // 冲撞（穿刺手、凶豕兽）：未被阻挡时每隔一段时间移动速度 +一层
      if(ab.rush){ if(!e.blockedBy&&!(e.wait>0)){ e.rushRun+=1/30; e.rushN=Math.min(ab.rush.n,Math.max(0,Math.floor((e.rushRun-ab.rush.pre)/ab.rush.per+1e-9))); } }
      // 管乐家：未被阻挡时每 0.5 秒攻击力 +30（最多 30 层，攻击后清空）
      if(ab.horn&&!e.blockedBy&&(W.f-e.born)%15===14) e.horn=Math.min(ab.horn.max,e.horn+1);
      if(e.emberOn||e.stoneUntil>W.f) continue;
      if(ab.summon&&W.f>=e.sumAt){ e.sumAt+=Math.round(ab.summon.cd*30); spawnAt(e,ab.summon.key,ab.summon.n,0); }
      if(ab.hideAura&&W.f>=e.hideAt){ e.hideAt+=Math.round(ab.hideAura.cd*30); e.hideOn=W.f+Math.round(ab.hideAura.t*30); }
      if(ab.roar&&W.f>=e.roarAt){ e.roarAt+=Math.round(ab.roar.cd*30); roarUntil=Math.max(roarUntil,W.f+Math.round(ab.roar.t*30)); roarV=ab.roar.aspd; }
      // 锋盔：攻击力最高、且没被削弱的我方单位攻击力最终降至 50%，25 秒
      if(ab.weaken&&W.f>=e.weakAt){ let best=null, bv=-1; for(const u of onField){ if(u.down||u.weakUntil>W.f)continue; const v=u.atkNow?u.atkNow():u.hAtk||0; if(v>bv){ bv=v; best=u; } }
        if(best){ best.weakUntil=W.f+Math.round(ab.weaken.t*30); best.weakMul=ab.weaken.mul; e.weakAt+=Math.round(ab.weaken.cd*30); } }
      // 重弩突袭者：与我方处于同一行/列时，蓄力 1.4 秒后射出弩箭，命中的首个单位受到法术伤害并晕眩
      if(ab.cross&&W.f>=e.crossAt){ let hit=null, hd=99; for(const u of onField){ if(u.down)continue; const ry=u.m.r-e.y, rx=u.m.c-e.x; const d=Math.abs(ry)<0.5?Math.abs(rx):Math.abs(rx)<0.5?Math.abs(ry):99; if(d<hd){ hd=d; hit=u; } }
        if(hit){ e.crossAt+=Math.round(ab.cross.cd*30); fxq.push({at:W.f+42,fn:()=>{ if(!live(e)||hit.down) return; stun(hit,ab.cross.t); if(HURT) hurt(hit,e,e.atk*ab.cross.scale,'m'); }}); } }
      // 暴鸰：攻击范围内有我方单位时投弹（目标及周围八格），之后移动速度提升至 200%
      if(ab.bomber&&!e.bombed){ let tg=null; for(const u of onField) if(!u.down&&dEU(e,u)<=ab.bomber.r+0.25&&(!tg||u.dep>tg.dep)) tg=u;
        if(tg){ e.bombed=true; if(HURT) for(const u of onField) if(!u.down&&Math.abs(u.m.r-tg.m.r)<=1&&Math.abs(u.m.c-tg.m.c)<=1) hurt(u,e,e.atk*ab.bomber.scale,'p'); } } } }
  // 当前移动速度
  const spdNow=e=>{ let s=e.spd; if(!EAB) return s; const ab=e.ab;
    if(e.gren) s+=ab.grenade.spd;
    s*=e.spdMul||1;
    if(e.fearUntil>W.f) s*=ab.fear.spd;
    if(e.awake) s*=ab.wake.spd;
    if(ab.rush&&e.rushN) s*=1+ab.rush.v*e.rushN;
    if(e.bombed) s*=ab.bomber.spd;
    return s; };
  // 敌人给干员的削弱
  const stun=(u,t)=>{ if(u.down) return; u.stunUntil=Math.max(u.stunUntil||0,W.f+Math.round(t*30)); for(const z of u.blocked||[]) z.blockedBy=null; if(u.blocked) u.blocked=[]; };
  const aspdModOf=u=>{ if(!EAB) return null; let add=0, mul=1;
    if(roarUntil>W.f) add+=roarV;
    for(const z of guardSrc) if(dEU(z,u)<=z.ab.guardAspd.r){ add+=z.ab.guardAspd.v; break; }
    if(u.hitDeb) for(const k in u.hitDeb) if(u.hitDeb[k].until>W.f) add+=u.hitDeb[k].v;
    for(const z of frostSrc) if(dEU(z,u)<=z.ab.aspdAura.r){ mul*=z.ab.aspdAura.mul; break; }
    if(u.blocked) for(const z of u.blocked) if(z.ab.blkAspd){ mul*=z.ab.blkAspd; break; }
    return add||mul!==1?{add,mul}:null; };
  W.aspdMod=a=>aspdModOf(a);
  W.atkMul=a=>EAB&&a.weakUntil>W.f?a.weakMul:1;
  W.cc=a=>EAB&&(a.stunUntil>W.f||a.disarmUntil>W.f)?{noAtk:true,noCast:true}:null;
  // 技能触发：按方案检查范围内有没有敌人（无视可选性：隐匿、空中的敌人同样算）
  const keysOf=(a,offs)=>{ const s=new Set(); for(const [dr,dc] of offs) s.add((a.m.r+dr)+','+(a.m.c+dc)); return s; };
  W.canCast=a=>{ if(a.down) return false; const t=a.trig; if(t==='always') return true;
    const live=e=>!(e.dead||e.gone||e.down>W.f);
    if(t==='field') return enemies.some(live);
    if(!a._trigSet){ a._trigSet=t==='default'?new Set([...rangeSet(a),...keysOf(a,teamRange(a.m.op,a.m.elite,true,a.si,a.m.dir))]):keysOf(a,teamRot(FIELD.ranges[t]||[[0,0]],a.m.dir)); }
    for(const e of enemies) if(live(e)&&(e.blockedBy===a||inSet(a._trigSet,e))) return true;
    return false; };
  W.blocking=a=>a.blocked.length>0;
  W.blockedBy=(a,e)=>e.blockedBy===a;
  // 聚合：范围内的我方单位每秒回复 (16+0.12×层)% 攻击力的生命；3 人时范围内获得 (15+0.08×层)% 庇护
  const jhHeal=subOn('聚合')?(16+0.12*subL('聚合'))/100:0, jhGuard=subOn('聚合')&&bonds.subs['聚合'].three?(15+0.08*subL('聚合'))/100:0;
  W.attacksMe=(a,e)=>e.tgt===a;
  // 受到一次敌人攻击；生命归零时倒下，放开阻挡的敌人，按再部署时间返场
  const hurt=(u,e,Aov,dtOv,o)=>{ const A=Aov!=null?Aov:e.atk||0, dt=dtOv||e.dt; if(!(A>0)||dt==='n') return 0; o=o||{};
    const T=u.tough||{}, df=u.df*(T.defBlk&&u.blocked&&u.blocked.length?1+T.defBlk:1);
    if(u.lastUntil>W.f) return;   // 史尔特尔：保持 1 点生命期间不再受伤
    let d=o.raw?A:dt==='t'?A:dt==='m'?Math.max(A*(1-u.res/100),A*0.05):Math.max(A-df*(1-(o.pen||0)),A*0.05);
    if(EAB&&u.expUntil>W.f) d*=u.expV||1;   // 暴露：受到的伤害提升
    if(dt==='p'){ if(T.physHi&&u.hp>u.maxHp/2) d*=1-T.physHi; if(T.dodgeP) d*=1-T.dodgeP; }
    if(T.dr) d*=1-T.dr; if(T.blkDr&&e.blockedBy===u) d*=1-T.blkDr; if(T.loDr&&u.hp<u.maxHp/2) d*=1-T.loDr;
    if(jhGuard&&onField.some(g=>g.jh&&!g.down&&g.jh.set.has(u.m.r+','+u.m.c))) d*=1-jhGuard;
    if(o.noKill) d=Math.min(d,Math.max(0,u.hp-1));
    u.hp-=d; u.taken+=d;
    if(u.hp<=0&&T.revive&&!u.revived){ u.revived=true; u.hp=u.maxHp*T.revive; return d; }
    if(u.hp<=0&&T.last&&!u.lastUntil){ u.hp=1; u.lastUntil=W.f+Math.round(T.last*30); return d; }
    if(u.hp<=0){ u.hp=0; u.down=true; u.falls++; u.upAt=W.f+Math.round(u.rsp*30);
      for(const z of u.blocked) z.blockedBy=null; u.blocked=[]; if(u.fall) u.fall(); u.bleed=null; }
    return d; };
  // 敌人的一次普通攻击（没被麻痹打断）：计数类技能、弹药、晕眩/缴械；受击开启时再算伤害、溅射、跳跃、流血、吸血
  let prisonAll=false;
  const freePrison=e=>{ e.prison.free=true; if(e.ab.prison.all&&!prisonAll){ prisonAll=true; for(const z of enemies) if(z.prison&&live(z)) z.prison.free=true; } };
  function enemyHit(e,u){
    if(!EAB){ if(HURT) hurt(u,e); return; }
    const ab=e.ab; e.nAtk++;
    // 囚犯：第 4 次攻击前解放（攻击力 +50%，拳师无视 80% 防御，强壮囚犯法抗 +40 并每秒回复）
    if(e.prison&&!e.prison.free&&e.nAtk>=ab.prison.times) freePrison(e);
    let pct=0; if(e.prison&&e.prison.free) pct+=ab.prison.atk; if(e.blades>0) pct+=ab.blades.atk; if(e.rage) pct+=e.rage*ab.rage.atk; if(ab.hate) pct+=ab.hate.atk*Math.min(ab.hate.max,kinN);
    let A=e.atk*(1+pct)+(e.horn?e.horn*ab.horn.v:0), dt=e.dt, scale=1;
    const pen=e.prison&&e.prison.free?ab.prison.pen:0;
    if(ab.blkMul&&e.blockedBy===u) scale*=ab.blkMul;                    // 枯朽战车：被阻挡时 200%
    if(e.ambush&&ab.ambush){ scale*=ab.ambush; e.ambush=false; }        // 山海众：隐匿生效后的下一次攻击
    if(e.charged&&ab.charge){ A*=ab.charge; e.charged=false; }          // 战线推进者：入场/解除阻挡后的首次攻击
    if(ab.leech) scale*=1+ab.leech.per*((u.blocked||[]).length);        // 新生血裔：按目标阻挡的敌人数
    if(ab.crit&&!e.crit.has(u)){ scale*=ab.crit.v; e.crit.add(u); u.noHealUntil=W.f+Math.round(ab.crit.noHeal*30); }   // 丛生：对每个目标首次伤害 200% 并禁疗
    if(e.ammo>0&&ab.disarm){ e.ammo--; u.disarmUntil=Math.max(u.disarmUntil||0,W.f+Math.round(ab.disarm.t*30)); scale*=ab.disarm.scale; dt='m'; }   // 寻路者信使：无法攻击或治疗 15 秒
    else if(e.ammo>0&&ab.ammoSplash){ e.ammo--; if(HURT) for(const v of onField) if(v!==u&&!v.down&&Math.abs(v.m.r-u.m.r)<=1&&Math.abs(v.m.c-u.m.c)<=1) hurt(v,e,A*ab.ammoSplash.scale,'p'); }
    else if(e.ammo>0&&ab.ammoHit){ e.ammo--; scale*=ab.ammoHit.scale; }
    if(e.firstAtk&&ab.firstSplash){ e.firstAtk=false; const fs=ab.firstSplash; if(fs.dt) dt=fs.dt; scale*=fs.scale;
      if(HURT) for(const v of onField) if(v!==u&&!v.down&&(fs.cross?Math.abs(v.m.r-u.m.r)+Math.abs(v.m.c-u.m.c)<=1:Math.hypot(v.m.r-u.m.r,v.m.c-u.m.c)<=fs.r)) hurt(v,e,A*fs.scale,dt,{pen}); }
    if(ab.rush&&e.rushN>0&&ab.rush.hit){ if(HURT) hurt(u,e,spdNow(e)*ab.rush.hit,'p',{pen}); e.rushN=0; e.rushRun=0; }   // 冲撞后的一击：当前移动速度 × 600
    if(e.horn) e.horn=0;
    if(e.blades>0) e.blades--;
    if(ab.stunHit&&e.nAtk%ab.stunHit.every===0){
      if(ab.stunHit.r){ for(const v of onField) if(!v.down&&dEU(e,v)<=ab.stunHit.r+0.25){ stun(v,ab.stunHit.t); if(HURT&&v!==u) hurt(v,e,A*(ab.stunHit.scale||1),'p'); } }
      else stun(u,ab.stunHit.t); }
    if(!HURT) return;
    if(ab.lob){ const y=u.m.r, x=u.m.c; fxq.push({at:W.f+Math.round(ab.lob.delay*30),fn:()=>{ for(const v of onField) if(!v.down&&Math.hypot(v.m.r-y,v.m.c-x)<=ab.lob.r) hurt(v,e,A,'p'); }}); return; }   // 轰击者：延时爆炸
    const got=hurt(u,e,A*scale,dt,{pen});
    if(ab.leech&&got>0) e.hp=Math.min(e.maxHp,e.hp+got*ab.leech.heal);
    if(ab.bleed) u.bleed={v:ab.bleed.v,until:W.f+Math.round(ab.bleed.t*30),e};
    if(ab.splash) for(const v of onField){ if(v===u||v.down)continue; if(ab.splash.all?dEU(e,v)<=(e.range||0)+0.25:Math.abs(v.m.r-u.m.r)+Math.abs(v.m.c-u.m.c)<=1) hurt(v,e,A*ab.splash.scale,dt); }
    if(ab.chain){ let cur=u, k=1; const seen=new Set([u]);
      for(let j=1;j<ab.chain.n;j++){ k*=ab.chain.dec; let nx=null, nd=99; for(const v of onField){ if(v.down||seen.has(v))continue; const d=Math.hypot(v.m.r-cur.m.r,v.m.c-cur.m.c); if(d<=ab.chain.r&&d<nd){ nd=d; nx=v; } }
        if(!nx) break; seen.add(nx); hurt(nx,e,A*scale*k,dt); cur=nx; } } }
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
    if(EAB){ for(let j=fxq.length-1;j>=0;j--) if(fxq[j].at<=W.f){ const q=fxq.splice(j,1)[0]; q.fn(); } enemyFrame(); }
    // 减防减抗类光环：技能开启时作用于范围内所有敌人，所有干员共享
    for(const e of enemies){ e.mDef=1; e.mRes=1; }
    for(const a of agents){ if(!a.m.op.deb||!a.skillOn())continue; const b=a.buffs();
      for(const e of enemies) if(!e.dead&&!e.gone&&W.inRange(a,e)){ e.mDef=Math.min(e.mDef,b.defMul||1); e.mRes=Math.min(e.mRes,b.resMul||1); } }
    for(const a of agents) a.stepA();
    worldSecond(W);
    // 再部署：倒下的干员到时间后满血返场
    for(const u of onField) if(u.lastUntil&&!u.down&&W.f===u.lastUntil){ u.hp=0; u.down=true; u.falls++; u.upAt=W.f+Math.round(u.rsp*30); for(const z of u.blocked) z.blockedBy=null; u.blocked=[]; if(u.fall) u.fall(); }
    for(const u of onField) if(u.down&&W.f>=u.upAt){ u.down=false; u.hp=u.maxHp; u.revived=false; u.lastUntil=0; if(u.redeploy) u.redeploy(); }
    // 敌人普通攻击：被阻挡时打阻挡它的干员；远程敌人打射程内最后部署的干员（干员碰撞箱半径 0.25 格）
    for(const e of enemies){ if(e.dead||e.gone||e.down>W.f)continue;
      let bat=e.bat;
      if(EAB){ const ab=e.ab;
        // 不进行普通攻击：静态刚体/不攻击的敌人、石像、余烬、恐惧中
        if(e.dt==='n'||e.stoneUntil>W.f||e.emberOn||e.fearUntil>W.f||(ab.wake&&!e.awake)){ e.atkT=Math.min(e.atkT,e.bat); continue; }
        let as=100; if(e.prison&&!e.prison.free) as+=ab.prison.aspd; if(e.rage) as+=e.rage*ab.rage.aspd;
        if(ab.shadowBat&&enemies.some(z=>z!==e&&act(z)&&z.key.startsWith(ab.shadowBat.near)&&dEE(z,e)<=ab.shadowBat.nr)) bat=Math.max(0.1,bat+ab.shadowBat.v);
        bat=bat/(Math.max(20,as)/100); }
      let tgt=e.blockedBy&&!e.blockedBy.down?e.blockedBy:null;
      // 近战敌人只打阻挡它的单位；投石机首次攻击、带弹药的寻路者可以远程
      const canRange=e.range>0&&!(EAB&&((e.aw==='MELEE'&&!(e.ab.firstSplash&&e.firstAtk))||((e.ab.disarm||e.ab.ammoSplash)&&e.ammo<=0)));
      if(!tgt&&canRange){ const pd=EAB&&e.ab.disarm&&e.ammo>0;
        for(const u of onField){ if(u.down)continue; if(Math.hypot(u.m.r-e.y,u.m.c-e.x)<=e.range+0.25){ const sc0=(pd&&u.disarmUntil>W.f?-1e6:0)+u.dep; if(!tgt||sc0>tgt._s){ tgt=u; u._s=sc0; } } } }
      if(tgt){ e.atkT-=1/30; if(e.atkT<=0){ e.atkT+=bat; e.tgt=tgt; const stopped=worldEnemyAttack(W,e); if(!stopped) enemyHit(e,tgt); } } else e.atkT=Math.min(e.atkT,bat); }
    // 持续伤害：巢涌者的光环、地面区域、逐腐兽的流血（受击开启时）
    if(EAB&&HURT&&W.f%30===29){
      for(const e of enemies) if(e.ab.burn&&act(e)) for(const u of onField) if(!u.down&&dEU(e,u)<=e.ab.burn.r+0.25) hurt(u,e,e.atk*e.ab.burn.scale,'m');
      for(let j=zones.length-1;j>=0;j--){ const z=zones[j]; if(z.until<=W.f){ zones.splice(j,1); continue; } for(const u of onField) if(!u.down&&Math.hypot(u.m.r-z.y,u.m.c-z.x)<=z.r+0.25) z.fn(u); }
      for(const u of onField) if(u.bleed&&!u.down){ if(u.bleed.until<=W.f) u.bleed=null; else hurt(u,u.bleed.e,u.bleed.v,'m',{raw:0,noKill:1}); } }
    if(EAB) for(const u of onField) if(!u.down){ if(u.stunUntil>W.f) ccStun++; else if(u.disarmUntil>W.f) ccDis++; if(u.stunUntil>W.f||u.disarmUntil>W.f) u.ccF=(u.ccF||0)+1; }
    // 聚合的每秒回复
    if(HURT&&jhHeal&&W.f%30===29) for(const g of onField){ if(!g.jh||g.down)continue; const amt=g.jh.atk*jhHeal;
      for(const v of onField){ if(v.down||v.hp>=v.maxHp||(v.tough&&v.tough.noHeal)||v.noHealUntil>W.f||!g.jh.set.has(v.m.r+','+v.m.c))continue; const got=Math.min(amt*((v.tough&&v.tough.healIn)||1),v.maxHp-v.hp); v.hp+=got; v.healIn+=got; g.healOut+=got; v.bleed=null; } }
    // 治疗
    if(HURT) for(const u of onField){ if(!u.healer||u.down)continue; u.hT-=1/30; if(u.hT>0)continue;
      if(EAB&&(u.stunUntil>W.f||u.disarmUntil>W.f)){ u.hT=0; continue; }
      const cand=onField.filter(v=>!v.down&&v.hp<v.maxHp&&!(v.tough&&v.tough.noHeal)&&!(v.noHealUntil>W.f)&&u.hSet.has(v.m.r+','+v.m.c)).sort((p,q)=>p.hp/p.maxHp-q.hp/q.maxHp);
      if(!cand.length){ u.hT=0; continue; }
      let amt=u.hAtk*(EAB&&u.weakUntil>W.f?u.weakMul:1); for(const v of cand.slice(0,u.hN)){ const got=Math.min(amt*((v.tough&&v.tough.healIn)||1),v.maxHp-v.hp); v.hp+=got; v.healIn+=got; u.healOut+=got; amt*=u.hDecay; v.bleed=null; }
      const em=aspdModOf(u); u.hT=em?Math.max(1,Math.round(u.hBat/(Math.max(10,Math.max(10,Math.min(600,u.hAspd+em.add))*em.mul)/100)*30))/30:u.hIv; }
    for(const a of agents) a.stepB();
    // 敌人移动
    for(const e of enemies){ if(e.dead||e.gone||e.blockedBy||e.down>W.f)continue;
      if(EAB&&e.stoneUntil>W.f) continue;
      if(tryBlock(e)) continue;
      if(e.wait>0){ e.wait-=1/30; continue; }
      let step=spdNow(e)*R.mul/30; const ln=e.rt.line;
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
  const hurtOf=u=>u&&u.maxHp?{taken:u.taken,falls:u.falls,hp:u.down?0:u.hp/u.maxHp,healIn:u.healIn,healOut:u.healOut,cc:(u.ccF||0)/30}:null;
  const res=agents.map(a=>{ const r=a.result(dur); return {m:a.m,r,dps:r.total/dur,total:r.total,kills:r.kills,eaten:eaten.get(a.m)||null,dv:dvGain.get(a.m)||null,hurt:hurtOf(a)}; });
  for(const u of onField) if(u.healer) res.push({m:u.m,healer:true,total:0,dps:0,kills:0,hurt:hurtOf(u)});
  // 回合结束时按未击倒的敌人数扣目标生命，每回合至多 10 点（PRTS 卫戍协议/帮助 §回合结束）
  const lifeLoss=setup.boss?0:Math.min(10,total-killed);
  return {hurtOn:HURT,eab:EAB,ccSec:(ccStun+ccDis)/30,falls:onField.reduce((a,u)=>a+(u.falls||0),0),dur,T,total,spawned,killed,leaked,leakedN,lifeLoss,alive:enemies.filter(e=>!e.dead&&!e.gone).length,cleared:killed+leakedN>=total&&enemies.every(e=>e.dead||e.gone),
    clearT:killed?lastKill/30:null,boss:boss?{name:boss.name,hp:boss.maxHp,left:boss.hp,dead:boss.dead,t:boss.dead?dur:null}:null,
    res,bonds,frames,routes,board:B,queue,scale:sc,enemies:enemies.map(e=>({uid:e.uid,key:e.key,name:e.name,fly:e.fly,boss:e.boss,route:e.route,child:e.child,born:e.born/30,deadAt:e.deadAt!=null?e.deadAt/30:null,leakAt:e.leakAt!=null?e.leakAt/30:null,maxHp:e.maxHp,left:e.hp,dmgBy:e.dmgBy,killer:e.killer})),eaten:[...eaten.values()]};
}
