const OPS = OPS_IBERIA.concat(OPS_MORE, OPS_SUB);
OPS.forEach(o=>{ if(o.ranged) o.r=1; });

// 核心盟约。six=1 表示 6 人效果已建模；params 是该盟约专属的输入项。
const CORE = {
 none:{name:'无核心盟约',none:1,six:0,f:'不激活任何核心盟约：只计算干员自身、附加盟约、技能和装备。'},
 iberia:{name:'伊比利亚',six:1,sixLabel:'6 人效果（持续法伤 ×2、弹射）',
  f:'每次造成伤害给目标挂 1 层：每层每秒 (11 + 0.06×层数)% 攻击力的法伤，至多 10 层，持续 10 秒。',
  params:[{id:'indirect',t:'chk',label:'毒伤、附加法伤等间接伤害也触发叠层',def:true},{id:'near',t:'chk',label:'引星棘刺范围内有队友（炼金单元延时）',def:true},{id:'dotOwn',t:'chk',label:'持续法伤算作干员自己造成的伤害（吃伤害倍率和无视法抗）',def:true}]},
 yan:{name:'炎',six:0,f:'【炎】干员攻击力 +(23 + 0.9×层数)%。'},
 sargon:{name:'萨尔贡',six:1,sixLabel:'6 人效果（流沙地面伤害）',
  f:'任一【萨尔贡】干员开启技能时，全体【萨尔贡】干员攻速 +12（至多 +300），持续 (5 + 0.22×层数) 秒。',
  params:[{id:'sargRate',label:'队友每秒开技能次数',def:0.3,step:0.1,min:0,max:5}]},
 victoria:{name:'维多利亚',six:1,sixLabel:'6 人效果（每件装备攻击力 +40%，进阶 +80%）',
  f:'携带装备的【维多利亚】干员伤害提升至 (125 + 0.8×层数)%。要给干员装上装备才生效。'},
 kjerag:{name:'谢拉格',six:0,f:'【谢拉格】干员伤害提升至 125%，对寒冷和冻结敌人再提升至 (135 + 层数)%。',
  params:[{id:'cold',label:'敌人处于寒冷/冻结的时间占比 %',def:50,min:0,max:100,step:10}]},
 egir:{name:'阿戈尔',six:0,f:'【阿戈尔】干员生命值 +(35 + 层数)%；开战时吞噬身前一格干员，获得其基础攻击力和阻挡数。',
  params:[{id:'devour',label:'吞噬获得的基础攻击力',def:0,min:0,max:3000,step:50}]},
 siracusa:{name:'叙拉古',six:0,f:'【叙拉古】干员部署后攻速 +(25 + 0.8×层数)，持续 (32 + 0.4×层数) 秒。'},
 kazimierz:{name:'卡西米尔',six:1,sixLabel:'6 人效果（开技能/部署后 30 秒内攻击附带 65% 真伤）',
  f:'每次有干员部署，【卡西米尔】干员攻击力 +20%，至多 +(50 + 层数)%，持续到战斗结束。',
  params:[{id:'deploys',label:'本场已部署干员次数',def:8,min:0,max:40,step:1}]},
 ursus:{name:'乌萨斯',six:1,sixLabel:'6 人效果（阻挡时每秒 (50 + 0.25×层数)% 攻击力法伤）',
  f:'【乌萨斯】干员攻击力 +(35 + 0.75×层数)%，生命值 +(10 + 0.3×层数)%；击倒单位叠临时层数。'},
 lethania:{name:'莱塔尼亚',six:1,sixLabel:'6 人效果（“乐部”在场：攻速 +20）',
  f:'【莱塔尼亚】干员和召唤物攻击力 +(30 + 层数)%；敌人被击倒时召唤“一个小节”。'},
};

// 附加盟约。fx=1 表示对伤害有直接影响；其余只是给干员特质提供层数。
const SUBS = {
 '精准':{fx:1,three:1,hint:'攻击力 +(10 + 1.2×层数)%；3 人时覆盖所有远程干员并无视 30% 防御和法抗'},
 '奥术':{fx:1,three:1,hint:'造成伤害时附加 (20 + 0.4×层数)% 攻击力法伤；3 人时全场敌人减法抗'},
 '迅捷':{fx:1,hint:'技能结束时 (20 + 0.35×层数)% 概率回复 12 点技力'},
 '灵巧':{fx:1,hint:'攻速 +(10 + 层数)'},
 '突袭':{fx:1,hint:'攻击力 +(25 + 层数)%；达到 50 层全队攻速 +50'},
 '协防干员':{fx:1,noL:1,hint:'伤害 ×120%，精锐 ×140%'},
 '独行':{fx:1,noL:1,hint:'在场仅 1 名时攻击力 +60%，初始技力 +15'},
 '投资人':{hint:'只为特质提供层数'},'不屈':{hint:'只为特质提供层数'},'奇迹':{hint:'只为特质提供层数'},
 '远见':{hint:'只为特质提供层数'},'坚守':{hint:'不影响伤害'},'助力':{hint:'不影响伤害'},'聚合':{hint:'不影响伤害'},'调和':{noL:1,hint:'不影响伤害'},
};

const V=(a,k)=>Array.isArray(a)?a[k]:a;

// 领袖。hp 依次为 标准 / 险境 / 绝境 / 终极模拟；hid 为“隐秘核心”强化版的生命（标准模拟没有）。
// 防御、法抗取自敌人基础数据；模式内是否另有加成未确认。lev=1 表示可以被浮空。
const BOSSES = [
 {id:'stmk', name:'假想敌：胄', def:1000,res:25,mass:10,hp:[283680,945600,2364000,3940000],hid:[0,1641600,4104000,6840000],hidDef:1200,hidRes:30,imm:'免疫晕眩、沉默、沉睡、冻结、浮空'},
 {id:'hunt', name:'假想敌：铳', def:1100,res:60,mass:10,hp:[162000,540000,1350000,2250000],hid:[0,1435200,3588000,5980000],imm:'免疫晕眩、沉默、沉睡、冻结、浮空'},
 {id:'duml', name:'假想敌：管', def:700,res:50,mass:7,hp:[302400,1008000,2520000,4200000],hid:[0,1732800,4332000,7220000],imm:'免疫晕眩、沉默、沉睡、冻结、浮空'},
 {id:'fnc',  name:'假想敌：械', def:600,res:30,mass:9,hp:[239400,798000,1995000,3325000],hid:[0,1254000,3135000,5225000],imm:'免疫晕眩、沉睡、冻结、浮空；可沉默'},
 {id:'spider',name:'假想敌：茧', def:800,res:30,mass:9,hp:[298800,996000,2490000,4150000],hid:[0,1892400,4731000,7885000],imm:'免疫晕眩、沉睡、冻结、浮空；可沉默'},
 {id:'eel',  name:'假想敌：鳍', def:600,res:30,mass:9,lev:1,hp:[151200,504000,1260000,2100000],hid:[0,1482000,3705000,6175000],imm:'免疫晕眩、沉睡、冻结；可沉默、可浮空'},
 {id:'lily', name:'盐风主教昆图斯', def:500,res:50,mass:10,hp:[314640,1048800,2622000,4370000],imm:'免疫晕眩、沉默、沉睡、冻结、浮空'},
 {id:'lionk',name:'阿利斯泰尔，帝国余晖', def:1030,res:20,mass:10,hp:[266400,888000,2220000,3700000],imm:'免疫沉睡、浮空；可晕眩、冻结、沉默'},
 {id:'deer', name:'“萨米的意志”', def:800,res:40,mass:10,hp:[290880,969600,2424000,4040000],imm:'免疫晕眩、沉默、沉睡、冻结、浮空'},
 {id:'jsfg', name:'矩兽', def:1000,res:10,mass:10,hp:[140400,468000,1170000,1950000],imm:'免疫沉默、浮空；可晕眩、沉睡、冻结'},
];

const mlynarModel=v=>({
 sk:{type:'time',cost:v.c,init:v.i,dur:v.d},
 can(x){return x.S.skillOn;},
 buffs(x){return x.S.skillOn?{atk:(x.S.held||0)*v.mul,batAdd:v.ba||0}:{};},
 onCast(x){const el=(x.f-(x.S.resetF||0))/30;x.S.held=Math.min(200,(x.S.casts===1&&x.k?100:0)+200*el/40);},
 onEnd(x){x.S.resetF=x.f;},
 attack(x){const sc=V(v.sc,x.k)*(x.N>=3?1.15:1.1);for(let i=0;i<Math.min(x.N,v.tg);i++)for(let h=0;h<v.hits;h++)x.hit(i,'p',sc,'direct');}});
MODELS.mlynar=mlynarModel({c:[50,45],i:[15,20],d:26,sc:[1.25,1.5],tg:5,hits:1,mul:2});
MODELS.mlynar1=mlynarModel({c:[35,30],i:[15,15],d:[25,30],sc:[1.45,1.7],tg:1,hits:1,mul:1});
MODELS.mlynar2=mlynarModel({c:[35,30],i:[10,10],d:20,sc:[1.3,1.6],tg:1,hits:2,mul:1,ba:0.3});

// 换技能后的干员变体（缓存）
function variant(op, si){
  const A=ALT[op.id]; if(si==null||si<0||!A||!A.list[si]) return op;
  op._v=op._v||{}; if(op._v[si]) return op._v[si];
  const a=A.list[si];
  return (op._v[si]=Object.assign({},op,A.base||{},A.over||{},a.over||{},{sk:a.sk||undefined,m:a.m||'gen',_m:null,_v:null,vid:op.id+'#'+a.no}));
}
// 汇总装备加成
function equipFx(list){
  const E={atk:0,aspd:0,sp:0,dm:1,rdm:1,init:0,cost:1,skAspd:0,skAtk:0,layers:0,xm:0,xt:0,flag:0,weak:0,castAtk:null,aspdSec:null,aspdAtk:null,n:0,adv:0};
  for(const it of (list||[])){ if(!it||!it.id) continue; const q=EQUIP.find(e=>e.id===it.id); if(!q) continue;
    const adv=!!it.adv&&!q.one, f=q.fx(adv); E.n++; if(adv) E.adv++;
    for(const key of ['atk','aspd','sp','init','skAspd','skAtk','layers','xm','xt']) E[key]+=f[key]||0;
    if(f.dm) E.dm*=f.dm; if(f.rdm) E.rdm*=f.rdm; if(f.cost) E.cost*=f.cost; if(f.flag) E.flag=Math.max(E.flag,f.flag); if(f.weak) E.weak=1;
    for(const key of ['castAtk','aspdSec','aspdAtk']) if(f[key]) E[key]=E[key]?[E[key][0]+f[key][0],E[key][1]+f[key][1]]:f[key].slice();
  }
  return E;
}

// 由数据行生成通用模型
function gen(op){
  if(op._m) return op._m;
  const s=op.sk||null, M={};
  if(s&&s.t!=='next'&&s.t!=='passive') M.sk={type:s.t==='atk'?'attack':'time',cost:s.c,init:s.i,dur:s.d};
  if(s&&s.t==='next'&&s.src==='time') M.nextTime=s.c;
  M.atkPct=k=>V(op.ap,k)||0;
  M.spBonus=x=>V(op.spr,x.k)||0;
  const isOn=x=>s&&(s.t==='passive'?x.f<V(s.d,x.k)*30:x.S.skillOn);
  M.buffs=x=>{ const k=x.k,S=x.S,b={atk:0,aspd:0,batMul:1,batAdd:0,dm:1,resMul:1,defMul:1};
    if(!isOn(x)) return b;
    const two=S.casts>=2, d=Math.max(1,V(s.d,k));
    let a=(two&&s.atk2)?V(s.atk2,k):(V(s.atk,k)||0)*(two&&s.perm2&&!s.atk2?2:1);
    if(s.atkRamp) a*=Math.min(1,S.skT/d);
    if(s.rampAtk) a+=V(s.rampAtk[0],k)*Math.min(V(s.rampAtk[1],k),S.skAtk);
    b.atk=a;
    let sp=(V(s.aspd,k)||0)*(two&&s.perm2&&!s.atk2?2:1);
    if(s.aspdDecay) sp*=Math.max(0,1-S.skT/d);
    if(s.rampAspd) sp+=V(s.rampAspd[0],k)*Math.min(V(s.rampAspd[1],k),S.skAtk);
    b.aspd=sp;
    if(s.bm) b.batMul=V(s.bm,k); if(s.ba) b.batAdd=V(s.ba,k);
    if(s.dm) b.dm=V(s.dm,k); if(s.resMul) b.resMul=V(s.resMul,k); if(s.defMul) b.defMul=V(s.defMul,k);
    return b; };
  M.can=x=>{ const on=isOn(x);
    if(s&&s.stop&&on) return false;
    if(op.idle&&!on) return false;
    if(s&&s.leave&&!on) return false;
    if(op.idleHalf&&!on&&x.S.sp<=V(s.c,x.k)/2) return false;
    return true; };
  M.attack=x=>{ const k=x.k,S=x.S,N=x.N,on=isOn(x); let next=false;
    if(s&&s.t==='next'){ if(S.sp>=V(s.c,k)*x.costMul){next=true;S.sp-=V(s.c,k)*x.costMul;x.castEvent();} else if(s.src!=='time') S.sp++; }
    const u=(on||next)?s:null;
    const ty=(u&&u.ty)||op.ty||'p';
    const tg=(u&&u.tg!=null)?V(u.tg,k):(V(op.tg,k)||1);
    let hits=(u&&V(u.hits,k))||op.hits||1; if(u&&u.hits2&&S.casts>=2) hits=u.hits2;
    let sc=(u&&u.sc!=null)?V(u.sc,k):(op.sc!=null?V(op.sc,k):1);
    if(x.fx.sc&&!u) sc*=x.fx.sc;
    if(u&&u.sc1&&N===1) sc*=V(u.sc1,k);
    if(op.lord&&!(u&&u.noPen)&&!x.cfg.melee) sc*=0.8;
    if(op.heavySc&&x.cfg.heavy) sc*=V(op.heavySc,k);
    if(op.lightSc&&!x.cfg.heavy) sc*=op.lightSc;
    const hx=V(op.hx,k)||1, o={defFlat:(V(op.igF,k)||0)+((u&&u.igAdd)||0),defPct:V(op.igP,k)||0,w:hx};
    const xhs=[]; if(op.xh) xhs.push(op.xh); if(u&&u.xh) xhs.push(u.xh);
    const n=Math.min(N,tg);
    for(let i=0;i<n;i++){ let c=sc;
      if(i===0&&op.sc0) c*=V(op.sc0,k);
      if(i>0&&op.splash) c*=V(op.splash,k);
      if(i>0&&op.chain) c*=Math.pow(V(op.chain,k),i);
      for(let h=0;h<hits;h++) x.hit(i,ty,c,'direct',o);
      if(op.shock){ const ns=V(op.shock[0],k)+((u&&u.shockAdd)||0); for(let j=0;j<ns;j++) x.hit(i,'p',c*op.shock[1],'direct',o); }
      if(op.xf) x.hit(i,'m',0,'extra',{fixed:V(op.xf,k)*hits,indirect:true,noArc:true});
      for(const e of xhs){ if(e.until&&x.f>=e.until*30) continue;
        if(i>=((u&&u.xhTg)||e.tg||99)) continue;
        const es=V(e.sc,k)*((u&&V(u.xhMul,k))||1); if(es) x.hit(i,e.ty||'m',es,'extra',{w:hx*(e.perHit?hits:1),indirect:true,noArc:true}); }
      if(op.dot) x.poison(i,Math.round(op.dot.dur*30)+3);
    }
    if(next&&s.burst) bursts(x);
    if(on&&s.ammo){ S.ammo--; if(S.ammo<=0) x.endSkill(); }
    if(op.hunter){ if(S.hA==null) S.hA=8; S.hA--; if(S.hA<=0){ S.delay=op.bat; S.hA=1+(k?1:0); } }
  };
  if(op.dot) M.poisonTick=(x,i)=>{ const mul=(x.S.skillOn&&s&&s.dotMul)||1;
    if(op.dot.fix) x.hit(i,'m',0,'extra',{fixed:V(op.dot.fix,x.k),indirect:true,noArc:true});
    else x.hit(i,'m',V(op.dot.sc,x.k)*mul,'extra',{indirect:true,noArc:true}); };
  const pushTick=(x,t,dur)=>x.S.ticks.push({f:0,iv:Math.round(t.iv*30),dur:Math.round(dur*30),ty:t.ty,sc:V(t.sc,x.k),tg:t.tg||1});
  const bursts=x=>{ const k=x.k; for(const b of (s.burst||[])){ const n=V(b.n,k)||1;
      for(let h=0;h<n;h++){ const fire=()=>{ const tg=Math.min(x.N,V(b.tg,k)||1); for(let i=0;i<tg;i++) x.hit(i,b.ty,V(b.sc,k),'direct',{defPct:b.igP||0}); };
        const at=(b.at||0)+(b.gap||0)*h; if(at>0) x.later(at,fire); else fire(); } } };
  M.onCast=x=>{ const k=x.k,S=x.S;
    if(s.ammo){ S.ammo=V(s.ammo,k); S.skillOn=true; S.skillLeft=Infinity; }
    if(s.perm||(s.perm2&&S.casts>=2)){ S.skillOn=true; S.skillLeft=Infinity; }
    if(s.d2&&S.casts>=2) S.skillLeft=s.d2;
    bursts(x);
    if(s.tick) pushTick(x,s.tick,V(s.tick.dur,k)||V(s.d,k));
  };
  M.onEnd=x=>{ const k=x.k,S=x.S;
    if(s.end){ const tg=Math.min(x.N,s.end.tg||1); S.skillOn=true; for(let i=0;i<tg;i++) x.hit(i,s.end.ty,V(s.end.sc,k),'direct'); S.skillOn=false; }
    if(s.after){ if(s.after.lock) S.lock=s.after.lock; if(s.after.hold) S.hold=s.after.lock; if(s.after.tick) pushTick(x,s.after.tick,s.after.tick.dur); } };
  M.frame=x=>{ const k=x.k,S=x.S,a=op.aura;
    if(a&&(!a.block||x.cfg.blocking)&&x.f>0&&x.f%Math.round(a.iv*30)===0){ const tg=Math.min(x.N,a.tg||1);
      for(let i=0;i<tg;i++){ if(a.fix) x.hit(i,'m',0,'extra',{fixed:V(a.fix,k),indirect:true,noArc:true}); else x.hit(i,a.ty,V(a.sc,k),'direct',{indirect:true,noArc:true}); } }
    for(let j=S.ticks.length-1;j>=0;j--){ const t=S.ticks[j]; t.f++;
      if(t.f%t.iv===0){ const tg=Math.min(x.N,t.tg); for(let i=0;i<tg;i++) x.hit(i,t.ty,t.sc,'direct',{indirect:true}); }
      if(t.f>=t.dur) S.ticks.splice(j,1); } };
  return (op._m=M);
}

function simulate(op0, elite, cfg, sel){
  const k=elite?1:0; sel=sel||{};
  if(op0.healer) return {dps:0,main:0,parts:{direct:0,bond:0,extra:0},atk:op0.atk[k],full:null,healer:true};
  const op=variant(op0,sel.skill), E=equipFx(sel.eq);
  const m=(op.m!=='gen'&&MODELS[op.m||op.id])||gen(op);
  const N=Math.max(1,Math.min(8,cfg.N|0)), T=Math.max(1,cfg.T), F=Math.round(T*30), dt=1/30;
  const C=CORE[cfg.core], has=b=>op.bonds.includes(b)||sel.bond===b;   // sel.bond：变形同构体给的额外盟约
  const core=cfg.bondOn&&has(C.name)?cfg.core:null, L=core?cfg.L+E.layers:0, six=core&&C.six&&cfg.six;
  const subOf=b=>cfg.sub[b]&&cfg.sub[b].on?cfg.sub[b]:null;
  const ly=b=>b===C.name?L:(subOf(b)?subOf(b).L||0:0);
  const sb=b=>has(b)?subOf(b):null;
  const pre=subOf('精准'), preOn=pre&&(has('精准')||(pre.three&&op.r));
  const arc=subOf('奥术'), arcC=sb('奥术')?0.2+0.004*arc.L:0;
  const swi=subOf('迅捷'), swiftP=swi?Math.min(1,(20+0.35*swi.L)/100):0;
  const raid=subOf('突袭');
  const tf=op.tf?op.tf(k,ly):{}, fx=op.fx?op.fx(k,cfg):{};
  const dotC=core==='iberia'?(0.11+0.0006*L)*(six?2:1):0;
  let sPct=E.atk+cfg.own+cfg.xAtk+(cfg.stunt>=2&&k?30:0)+(m.atkPct?m.atkPct(k,cfg):0)+(fx.atk||0);
  if(preOn) sPct+=10+1.2*pre.L;
  if(sb('突袭')) sPct+=25+raid.L;
  if(sb('独行')) sPct+=60;
  if(core==='yan') sPct+=23+0.9*L;
  if(core==='ursus') sPct+=35+0.75*L;
  if(core==='lethania') sPct+=30+L;
  if(core==='kazimierz') sPct+=Math.min(50+L,20*cfg.deploys);
  if(core==='victoria'&&six) sPct+=40*(E.n-E.adv)+80*E.adv;
  let sAspd=E.aspd+cfg.xAspd+(fx.aspd||0);
  if(sb('灵巧')) sAspd+=10+subOf('灵巧').L;
  if(raid&&raid.L>=50) sAspd+=50;
  if(core==='lethania'&&six) sAspd+=20;
  let dmMul=(V(op.dm,k)||1)*(fx.dm||1)*E.dm*(op.r?E.rdm:1);
  const weak=op.weak||E.weak;
  if(core==='victoria'&&E.n>0) dmMul*=1.25+0.008*L;
  if(core==='kjerag') dmMul*=1.25*(1+(cfg.cold/100)*(0.35+0.01*L));
  if(sb('协防干员')) dmMul*=k?1.4:1.2;
  const baseAtk=op.atk[k]+(core==='egir'?cfg.devour:0);
  const sirF=core==='siracusa'?(32+0.4*L)*30:0, sirAspd=25+0.8*L;
  const sgDur=core==='sargon'?5+0.22*L:0;
  const def0=cfg.def*(preOn&&pre.three?0.7:1)*(V(op.defMul,k)||1);
  let res0=Math.max(0,cfg.res-(arc&&arc.three?30+0.05*arc.L:0)); if(preOn&&pre.three) res0*=0.7; res0=Math.min(100,Math.max(0,res0-(V(op.resF,k)||0)));
  const rm0=1-res0/100;
  // 盟约持续法伤：dotOwn=true 时算作干员自己的伤害（吃伤害倍率和攻击方的无视法抗）；
  // 否则按无来源伤害处理，只受目标身上的减抗影响
  const rmD=cfg.dotOwn?rm0:1-Math.min(100,Math.max(0,cfg.res-(arc&&arc.three?30+0.05*arc.L:0)))/100;
  const sk=m.sk, costMul=E.cost*(cfg.stunt>=5&&k?0.7:1), cost=sk?Math.max(1,V(sk.cost,k)*costMul):0;
  const S={sp:(sk||m.nextTime?V((sk||op.sk).init||op.sk.i,k)||0:0)+(sb('独行')?15:0)+E.init,skillOn:false,skillLeft:0,casts:0,nAtk:0,atkT:0,lock:0,hold:0,delay:0,skT:0,skAtk:0,units:[],q:[],ticks:[],sg:[],sand:null,lastCast:null,castN:0};
  const sec=sel.trace?new Array(Math.ceil(T)).fill(0):null, onArr=sel.trace?new Array(Math.ceil(T)).fill(0):null;
  const stacks=new Array(N).fill(0), stackEnd=new Array(N).fill(-1), dotF=new Array(N).fill(0);
  const poiEnd=new Array(N).fill(-1), poiF=new Array(N).fill(0);
  const parts={direct:0,bond:0,extra:0}; let main=0, full=null, f=0;
  const x={S,k,N,cfg,fx,costMul,get f(){return f;}};
  const buffs=()=>m.buffs?m.buffs(x):{};
  const tfOn=()=>!tf.dur||f<tf.dur*30;
  const atkNow=()=>{const on=tfOn();let p=sPct+(on?tf.atk||0:0)+(buffs().atk||0);
    if(E.castAtk)p+=Math.min(E.castAtk[1],E.castAtk[0]*S.castN); if(E.skAtk&&S.skillOn)p+=E.skAtk;
    return (baseAtk+(on?tf.base||0:0))*(1+p/100);};
  const flagMul=()=>{ if(!E.flag)return 1; const t=f/30; return t<15?E.flag:t<30?1+(E.flag-1)*(30-t)/15:1; };
  x.interval=()=>{ const b=buffs(); let a=op.aspd[k]+sAspd+(b.aspd||0)+(tfOn()?tf.aspd||0:0)+(f<sirF?sirAspd:0);
    if(E.aspdSec)a+=Math.min(E.aspdSec[1],E.aspdSec[0]*Math.floor(f/30)); if(E.aspdAtk)a+=Math.min(E.aspdAtk[1],E.aspdAtk[0]*S.nAtk); if(S.skillOn)a+=E.skAspd;
    if(sgDur){ let n=0; for(const e of S.sg) if(e>f) n++; a+=Math.min(300,12*(n+cfg.sargRate*sgDur)); }
    a=Math.max(10,Math.min(600,a));
    return Math.max(0.1,(op.bat+(b.batAdd||0))*(b.batMul||1))/(a/100); };
  const add=(g,d,i)=>{parts[g]+=d;if(i===0)main+=d;if(sec)sec[Math.min(sec.length-1,Math.floor(f/30))]+=d;};
  const proc=(i,w,A)=>{ if(!dotC)return; if(stacks[i]<=0)dotF[i]=0;
    stacks[i]=Math.min(10,stacks[i]+w); stackEnd[i]=f+300;
    if(full===null&&i===0&&stacks[0]>=9.999)full=f*dt;
    if(six&&N>=2)add('bond',0.2*3*A*rm0*w,(i+1)%N); };
  x.hit=(i,type,scale,g,o={})=>{ const b=buffs(), A=atkNow(), w=o.w==null?1:o.w, t=type[0];
    const rm=1-Math.min(100,res0*(b.resMul||1))/100;
    const ph=()=>{const df=Math.max(0,def0*(b.defMul||1)-(o.defFlat||0))*(1-(o.defPct||0));return Math.max(A*scale-df,A*scale*0.05);};
    const mg=()=>Math.max(A*scale*rm,A*scale*0.05);
    let d;
    if(o.fixed!=null) d=o.fixed*rm;
    else if(t==='t') d=A*scale;
    else if(weak) d=Math.max(ph(),mg());
    else d=t==='p'?ph():mg();
    const fm=flagMul();
    d*=dmMul*(b.dm||1)*fm;
    add(g,d*w,i);
    if(!o.noArc&&(E.xm||E.xt)){ add('extra',(Math.max(A*E.xm*rm,A*E.xm*0.05)+A*E.xt)*dmMul*fm*w,i); if(E.xm&&cfg.indirect)proc(i,w,A); }
    if(arcC&&!o.noArc){add('extra',Math.max(A*arcC*rm,A*arcC*0.05)*dmMul*w,i); if(cfg.indirect)proc(i,w,A);}
    if(!o.indirect||cfg.indirect)proc(i,w,A); };
  x.poison=(i,dur)=>{ if(poiEnd[i]<f)poiF[i]=0; poiEnd[i]=f+(dur||93); };
  x.later=(sec,fn)=>S.q.push({at:f+Math.round(sec*30),fn});
  const noteCast=()=>{ S.lastCast=f; S.castN++; if(sgDur){ S.sg.push(f+sgDur*30); if(S.sg.length>60)S.sg=S.sg.filter(e=>e>f); if(S.sand==null)S.sand=f; } };
  x.castEvent=noteCast;
  // 迅捷按期望值返还技力；返还量不超过一次技能的消耗，避免低消耗技能被算成无限连放
  const swiftEnd=()=>{ if(swiftP) S.sp+=swiftP*Math.min(cost||99,(has('迅捷')?12:0)+(swi.L>=40?15:0)); };
  const endSkill=()=>{ S.skillOn=false; if(m.onEnd)m.onEnd(x); swiftEnd(); };
  x.endSkill=endSkill;
  const cast=()=>{ S.sp=0; S.casts++; S.skT=0; S.skAtk=0; const d=V(sk.dur,k); if(d>0){S.skillOn=true;S.skillLeft=d;}
    noteCast(); if(m.onCast)m.onCast(x); if(!S.skillOn)swiftEnd(); };
  for(f=0;f<F;f++){
    if(onArr&&S.skillOn)onArr[Math.min(onArr.length-1,Math.floor(f/30))]=1;
    if(S.skillOn){ S.skT+=dt; if(S.skillLeft!==Infinity){S.skillLeft-=dt;if(S.skillLeft<=0)endSkill();} }
    const spGain=dt*(1+E.sp+(m.spBonus?m.spBonus(x):0)+(tfOn()?tf.sp||0:0));
    if(sk&&sk.type==='time'&&!S.skillOn){ if(S.hold>0)S.hold-=dt; else if(!(op.spBlock&&!cfg.blocking))S.sp+=spGain; }
    if(m.nextTime) S.sp=Math.min(V(m.nextTime,k)*3,S.sp+spGain);
    if(op.spT&&sk&&sk.type==='attack'&&!S.skillOn) S.sp+=dt*op.spT;
    if(S.lock>0)S.lock-=dt;
    if(sk&&!S.skillOn&&S.sp>=cost&&S.lock<=0)cast();
    for(let j=S.q.length-1;j>=0;j--)if(S.q[j].at<=f){const e=S.q.splice(j,1)[0];e.fn();}
    S.atkT-=dt;
    if(S.atkT<=0&&S.lock<=0&&(!m.can||m.can(x))){ m.attack(x); S.nAtk++; if(S.skillOn)S.skAtk++;
      if(sk&&sk.type==='attack'&&!S.skillOn)S.sp++;
      if(core==='kazimierz'&&six&&(f<900||(S.lastCast!=null&&f-S.lastCast<900)))add('bond',0.65*atkNow(),0);
      S.atkT+=x.interval()+S.delay; S.delay=0; if(S.atkT<0)S.atkT=x.interval(); }
    if(m.frame)m.frame(x);
    for(let j=S.units.length-1;j>=0;j--){const u=S.units[j];u.f++;
      if(u.f%30===0)for(let i=0;i<N;i++)x.hit(i,'magic',u.scale,'direct');
      if(u.f>=u.dur)S.units.splice(j,1);}
    if(f%30===29){
      if(core==='ursus'&&six&&cfg.blocking&&op.blk&&!op.r){const A=atkNow();for(let i=0;i<Math.min(N,op.blk);i++)add('bond',(0.5+0.0025*L)*A*rm0,i);}
      if(core==='sargon'&&six&&S.sand!=null&&S.skillOn)for(let i=0;i<N;i++)add('bond',(800+4*L)*rm0,i);
    }
    if(core==='sargon'&&six&&S.sand!=null&&f>S.sand&&(f-S.sand)%150===0)for(let i=0;i<N;i++)add('bond',(5000+25*L)*rm0,i);
    for(let i=0;i<N;i++){
      if(poiEnd[i]>=f){poiF[i]++; if(poiF[i]%30===0){ if(m.poisonTick)m.poisonTick(x,i); else x.hit(i,'magic',0,'extra',{fixed:m.poison(k,cfg),indirect:true,noArc:true}); }}
      if(stacks[i]>0){ if(stackEnd[i]<f){stacks[i]=0;} else {dotF[i]++; if(dotF[i]%30===0)add('bond',stacks[i]*dotC*atkNow()*rmD*(cfg.dotOwn?dmMul*(buffs().dm||1)*flagMul():1),i);} }
    }
  }
  const total=parts.direct+parts.bond+parts.extra;
  return {dps:total/T,main:main/T,parts:{direct:parts.direct/T,bond:parts.bond/T,extra:parts.extra/T},atk:Math.round(atkNow()),full,iv:x.interval(),sec,on:onArr,casts:S.castN};
}
