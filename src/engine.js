const OPS = OPS_IBERIA.concat(OPS_MORE, OPS_SUB);
OPS.forEach(o=>{ if(o.ranged) o.r=1; });

// 核心盟约。six=1 表示 6 人效果已建模；params 是该盟约专属的输入项。
const CORE = {
 none:{name:'无核心盟约',none:1,six:0,f:'不激活任何核心盟约：只计算干员自身、附加盟约、技能和装备。'},
 iberia:{name:'伊比利亚',six:1,sixLabel:'6 人效果（持续法伤 ×2、弹射）',
  f:'每次造成伤害给目标挂 1 层：每层每秒 (11 + 0.06×层数)% 攻击力的法伤，至多 10 层，持续 10 秒。',
  params:[{id:'indirect',t:'chk',label:'毒伤、附加法伤等间接伤害也触发叠层',def:true},{id:'near',t:'chk',label:'引星棘刺范围内有队友（炼金单元延时）',def:true},{id:'dotOwn',t:'chk',label:'持续法伤算作干员自己造成的伤害（吃伤害倍率和无视法抗）',def:true}]},
 yan:{name:'炎',six:1,sixLabel:'6 人效果（攻击附带随机元素损伤，敌人元素爆发的冷却加快）',f:'【炎】干员攻击力 +(23 + 0.9×层数)%。6 人：每次攻击造成 6% 攻击力的随机元素损伤，全场敌人元素损伤恢复速度 +(40 + 0.3×层数)%。'},
 sargon:{name:'萨尔贡',six:1,sixLabel:'6 人效果（流沙地面伤害）',
  f:'任一【萨尔贡】干员开启技能时，全体【萨尔贡】干员攻速 +12（至多 +300），持续 (5 + 0.22×层数) 秒。',
  params:[{id:'sargRate',label:'队友每秒开技能次数',def:0.3,step:0.1,min:0,max:5}]},
 victoria:{name:'维多利亚',six:1,sixLabel:'6 人效果（每件装备攻击力 +40%，进阶 +80%）',
  f:'携带装备的【维多利亚】干员伤害提升至 (125 + 0.8×层数)%。要给干员装上装备才生效。'},
 kjerag:{name:'谢拉格',six:0,f:'【谢拉格】干员伤害提升至 125%，对寒冷和冻结敌人再提升至 (135 + 层数)%。',
  params:[{id:'cold',label:'敌人处于寒冷/冻结的时间占比 %',def:50,min:0,max:100,step:10}]},
 egir:{name:'阿戈尔',six:1,sixLabel:'6 人效果（前 3 名被击倒的【阿戈尔】干员立刻复活）',
  f:'【阿戈尔】干员生命值 +(35 + 层数)%。开战时依次吞噬身前一格的干员：对它造成 5000 点物理伤害，获得它的基础攻击力和阻挡数，盟约层数加上它的等阶。',
  params:[{id:'devourOp',t:'op',label:'被吞噬的干员',def:''},{id:'devourElite',t:'chk',label:'被吞噬的干员是精锐',def:true},{id:'devour',label:'另外追加的基础攻击力',def:0,min:0,max:5000,step:50}],
  info:c=>{ if(!c.bondOn) return ''; const d=devourInfo(c);
    if(!d) return '还没选被吞噬的干员：【阿戈尔】干员只按自身攻击力计算。';
    return d.o.name+'（'+d.o.tier+' 阶，'+(d.k?'精锐':'初始')+'）：吞噬者基础攻击力 +'+d.atk+'，盟约层数 +'+d.tier+'。它受到 '+d.dmg+' 点伤害（防御 '+d.def+'），生命 '+d.hp+(d.own?'（含盟约加成）':'')+'，'
      +(d.alive?'能活下来继续作战。':d.revive?'会被击倒，6 人效果让它立刻复活。':'会直接阵亡，这一格本场不再输出。')+'其他加生命的效果没有计入。'; }},
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
const TIERV={'Ⅰ':1,'Ⅱ':2,'Ⅲ':3,'Ⅳ':4,'Ⅴ':5,'Ⅵ':6};

// 【阿戈尔】吞噬：被吞噬者受到 5000 点物理伤害；吞噬者获得它的基础攻击力，盟约层数加上它的等阶。
// 返回被吞噬者的情况；没选或盟约未激活时返回 null。
function devourInfo(cfg){
  if(cfg.core!=='egir'||!cfg.bondOn||!cfg.devourOp) return null;
  const o=OPS.find(x=>x.id===cfg.devourOp); if(!o) return null;
  const k=cfg.devourElite?1:0, s=STATS[o.name]||[0,0,0,0,0,0], tier=TIERV[o.tier]||1, own=o.bonds.includes('阿戈尔');
  const hp=Math.round(s[k*3]*(own?1+(35+cfg.L)/100:1)), def=s[k*3+1], dmg=Math.max(5000-def,250);
  const alive=hp>dmg;
  return {o,k,atk:o.atk[k],tier,own,hp,def,dmg,alive,revive:!alive&&own&&!!cfg.six};
}

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

// 克莱门莎。攻击和技能会给敌人累计侵蚀损伤，累计满时“侵蚀爆发”（见 simulate 里的 x.erode）。
// 天赋：造成物理伤害时 25% 概率攻击力提升至 135%，目标防御低于初始值（已经爆发过）时概率 50%，按期望值计算。
// n 是技能编号：1 冲蚀，2 风暴潮，3 与海为敌。
const clemModel=n=>{ const tal=(x,i)=>1+(x.defDown(i)>0?0.5:0.25)*0.35;
 return {
  ep:1,
  sk:n===1?null:{type:'time',cost:n===2?[22,20]:[58,45],init:n===2?[9,12]:[27,28],dur:n===2?16:0},
  buffs(x){return n===2&&x.S.skillOn?{aspd:100}:{};},
  // 风暴潮：放逐舱飞行约 1.5 秒，期间不能攻击；之后留下漩涡。与海为敌：10 发弹药，打完才结束。
  onCast(x){const S=x.S; if(n===2){S.lock=1.5;S.vt=0;} else {S.skillOn=true;S.skillLeft=Infinity;S.ammo=10;}},
  attack(x){const k=x.k,S=x.S,N=x.N;
    if(n===1){ let nx=false; if(S.sp>=3*x.costMul){nx=true;S.sp-=3*x.costMul;x.castEvent();} else S.sp++;
      const d=x.hit(0,'p',(nx?V([2.05,2.25],k):1)*tal(x,0),'direct'); if(nx)x.erode(0,d*V([0.25,0.3],k)); return; }
    if(!S.skillOn){ x.hit(0,'p',tal(x,0),'direct'); return; }
    if(n===2){ for(let i=0;i<Math.min(N,5);i++)x.hit(i,'p',V([2.2,2.3],k)*tal(x,i),'direct'); return; }
    for(let i=0;i<Math.min(N,3);i++){ const d=x.hit(i,'p',V([1.8,2],k)*tal(x,i),'direct'); x.erode(i,d*0.2); } },
  // 漩涡：每秒 200 点侵蚀损伤 + 物理伤害，按持续到技能结束计算。
  // 漩涡落在前方约 3 格。放逐舱只带得走总重量不超过 8 的敌人，所以被她挡在身前的重型领袖不在漩涡里。
  frame(x){const S=x.S; if(n!==2||!S.skillOn||S.skT<1.5)return; S.vt++;
    if(S.vt%30===0)for(let i=0;i<x.N;i++){ if(x.heavyBlocked(i))continue;
      x.hit(i,'p',V([2.65,2.85],x.k)*tal(x,i),'direct',{indirect:true}); x.erode(i,200); } },
  // 与海为敌：技能期间每有敌人侵蚀爆发，消耗 1 发弹药轰击 3 次（间隔 1 秒），每次物理 + 元素伤害
  onBurst(x,i,t){const S=x.S,k=x.k; if(n!==3||t!=='w'||!S.skillOn||S.ammo<=0)return; S.ammo--;
    for(let h=1;h<=3;h++)x.later(h,()=>{ for(let i=0;i<x.N;i++){ x.hit(i,'p',V([2.5,2.7],k)*tal(x,i),'direct',{indirect:true}); x.hit(i,'e',V([1.8,2],k),'direct',{indirect:true}); } });
    if(S.ammo<=0)x.endSkill(); }
 };};
MODELS.clemensa=clemModel(2); MODELS.clemensa1=clemModel(1); MODELS.clemensa3=clemModel(3);

// 换技能后的干员变体（缓存）
function variant(op, si){
  const A=ALT[op.id]; if(si==null||si<0||!A||!A.list[si]) return op;
  op._v=op._v||{}; if(op._v[si]) return op._v[si];
  const a=A.list[si];
  return (op._v[si]=Object.assign({},op,A.base||{},A.over||{},a.over||{},{sk:a.sk||undefined,m:a.m||'gen',_m:null,_v:null,vid:op.id+'#'+a.no}));
}
// 汇总装备加成
function equipFx(list){
  const E={atk:0,aspd:0,sp:0,dm:1,rdm:1,init:0,cost:1,skAspd:0,skAtk:0,layers:0,xm:0,xt:0,brDm:0,flag:0,weak:0,castAtk:null,aspdSec:null,aspdAtk:null,n:0,adv:0};
  for(const it of (list||[])){ if(!it||!it.id) continue; const q=EQUIP.find(e=>e.id===it.id); if(!q) continue;
    const adv=!!it.adv&&!q.one, f=q.fx(adv); E.n++; if(adv) E.adv++;
    for(const key of ['atk','aspd','sp','init','skAspd','skAtk','layers','xm','xt','brDm']) E[key]+=f[key]||0;
    if(f.dm) E.dm*=f.dm; if(f.rdm) E.rdm*=f.rdm; if(f.cost) E.cost*=f.cost; if(f.flag) E.flag=Math.max(E.flag,f.flag); if(f.weak) E.weak=1;
    for(const key of ['castAtk','aspdSec','aspdAtk']) if(f[key]) E[key]=E[key]?[E[key][0]+f[key][0],E[key][1]+f[key][1]]:f[key].slice();
  }
  return E;
}

// 由数据行生成通用模型
function gen(op){
  if(op._m) return op._m;
  const s=op.sk||null, M={};
  if(s&&s.t!=='next'&&s.t!=='passive') M.sk={type:s.t==='atk'?'attack':s.t==='def'?'def':'time',cost:s.c,init:s.i,dur:s.d};
  if(s&&s.t==='next'&&s.src==='time') M.nextTime=s.c;
  M.atkPct=k=>V(op.ap,k)||0;
  M.spBonus=x=>V(op.spr,x.k)||0;
  const isOn=x=>s&&(s.t==='passive'?x.f<V(s.d,x.k)*30:x.S.skillOn);
  M.buffs=x=>{ const k=x.k,S=x.S,b={atk:0,aspd:0,batMul:1,batAdd:0,dm:1,resMul:1,defMul:1};
    // 元素爆发带来的加成：范围内有敌人处于某种爆发、爆发后的限时加成、按爆发次数叠层
    if(op.brAtk){ for(let i=0;i<x.N;i++) if(x.inBr(i,op.brAtk.t)){ b.atk+=V(op.brAtk.atk,k); break; } }
    if(op.onBr&&S.brBuff>x.f) b.atk+=V(op.onBr.atk,k)||0;
    if(op.brStack&&S.brN){ b.atk+=S.brN*V(op.brStack.atk,k); if(S.brN>=op.brStack.max) b.aspd+=V(op.brStack.aspd,k)||0; }
    // apAt：[攻击力%, 秒]，开战（在场）若干秒后才生效的天赋
    if(op.apAt&&x.f>=V(op.apAt[1],k)*30) b.atk+=V(op.apAt[0],k)||0;
    // apStep / aspdStep：[每层, 每多少秒一层, 最多层数]，随在场时间叠加
    if(op.apStep) b.atk+=V(op.apStep[0],k)*Math.min(op.apStep[2],Math.floor(x.f/30/op.apStep[1]));
    if(op.aspdStep) b.aspd+=V(op.aspdStep[0],k)*Math.min(op.aspdStep[2],Math.floor(x.f/30/op.aspdStep[1]));
    if(!isOn(x)) return b;
    const two=S.casts>=2, d=Math.max(1,V(s.d,k));
    let a=(two&&s.atk2)?V(s.atk2,k):(V(s.atk,k)||0)*(two&&s.perm2&&!s.atk2?2:1);
    if(s.atkRamp) a*=Math.min(1,S.skT/d);
    if(s.rampAtk) a+=V(s.rampAtk[0],k)*Math.min(V(s.rampAtk[1],k),S.skAtk);
    b.atk+=a;
    let sp=(V(s.aspd,k)||0)*(two&&s.perm2&&!s.atk2?2:1);
    if(s.aspdDecay) sp*=Math.max(0,1-S.skT/d);
    if(s.rampAspd) sp+=V(s.rampAspd[0],k)*Math.min(V(s.rampAspd[1],k),S.skAtk);
    // stepAspd：每用过一次技能，之后开启时攻速再加一层
    if(s.stepAspd) sp+=V(s.stepAspd[0],k)*Math.min(s.stepAspd[1],Math.max(0,S.casts-1));
    b.aspd+=sp;
    if(s.bm) b.batMul=V(s.bm,k); if(s.ba) b.batAdd=V(s.ba,k);
    if(s.dm) b.dm=V(s.dm,k); if(s.resMul) b.resMul=V(s.resMul,k); if(s.defMul) b.defMul=V(s.defMul,k);
    if(s.resF) b.resF=V(s.resF,k);   // 技能期间无视固定法抗
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
    if(u&&u.epBoost){ S.epBoost=x.f+Math.round(V(u.epBoost.dur,k)*30); S.epBoostMul=V(u.epBoost.mul,k); }
    // crowd：[倍率, 人数]，一次打到的敌人不少于这个数时整次攻击的攻击力提高
    const crowd=op.crowd&&n>=op.crowd[1]?V(op.crowd[0],k):1;
    for(let i=0;i<n;i++){ let c=sc*crowd;
      if(i===0&&op.sc0) c*=V(op.sc0,k);
      if(i>0&&op.splash) c*=V(op.splash,k);
      if(i>0&&op.chain) c*=Math.pow(V(op.chain,k),i);
      // brTy：目标处于该种爆发时，这次攻击改为元素伤害
      const bt=(u&&u.brTy)||op.brTy, tyI=bt&&x.inBr(i,bt)?'e':ty; let dsum=0;
      for(let h=0;h<hits;h++) dsum+=x.hit(i,tyI,c,'direct',o);
      // epA：攻击附带元素损伤（of:'dmg' 按这次伤害的比例，否则按攻击力的比例；sp 是对周围其他敌人的比例）
      for(const eA of [op.epA,u&&u.epA]) if(eA){ const mul=S.epBoost>x.f?S.epBoostMul:1; S.mk=S.mk||{};
        x.erode(i,(eA.of==='dmg'?dsum:x.atk())*V(eA.r,k)*mul,eA.t); S.mk[x.uid(i)]=1;
        if(eA.sp&&i===0) for(let j=1;j<N;j++){ x.erode(j,x.atk()*V(eA.sp,k)*mul,eA.t); S.mk[x.uid(j)]=1; } }
      // brX：目标处于该种爆发时额外造成元素伤害
      for(const bx of [op.brX,u&&u.brX]) if(bx&&V(bx.sc,k)&&x.inBr(i,bx.t)) x.hit(i,'e',V(bx.sc,k),'extra',{indirect:true,noArc:true});
      // brDot：攻击到处于爆发的敌人后，让它每秒受到元素伤害，直到爆发结束
      if(op.brDot&&x.inBr(i,op.brDot.t)){ S.dot=S.dot||{}; const u=x.uid(i); S.dot[u]=Math.max(S.dot[u]||0,V(op.brDot.sc,k)); }
      if(op.shock){ const ns=V(op.shock[0],k)+((u&&u.shockAdd)||0); for(let j=0;j<ns;j++) x.hit(i,'p',c*op.shock[1],'direct',o); }
      if(op.xf) x.hit(i,'m',0,'extra',{fixed:V(op.xf,k)*hits,indirect:true,noArc:true});
      for(const e of xhs){ if(e.until&&x.f>=e.until*30) continue;
        // emit：每次攻击按概率对范围内若干个（随机）目标追加伤害，xf 是每份追加附带的固定法伤期望
        if(e.emit){ const m=Math.min(N,V(e.emit,k)||1); for(let j=0;j<m;j++){ x.hit(j,e.ty||'m',V(e.sc,k),'extra',{indirect:true,noArc:true});
            if(e.xf) x.hit(j,'m',0,'extra',{fixed:V(e.xf,k),indirect:true,noArc:true}); } continue; }
        if(i>=((u&&u.xhTg)||e.tg||99)) continue;
        const es=V(e.sc,k)*((u&&V(u.xhMul,k))||1); if(es) x.hit(i,e.ty||'m',es,'extra',{w:hx*(e.perHit?hits:1),indirect:true,noArc:true}); }
      if(op.dot) x.poison(i,Math.round(op.dot.dur*30)+3);
    }
    if(next&&s.burst) bursts(x);
    // spHit：技能外普攻后额外回技力（boss:1 只在主目标是精英/领袖时）；目标被这次攻击击倒时不回
    if(op.spHit&&!on&&V(op.spHit.v,k)){ const e=x.byUid(x.uid(0)); if(e&&!e.dead&&(!op.spHit.boss||e.boss)) S.sp+=V(op.spHit.v,k); }
    if(on&&s.ammo){ S.ammo--; if(S.ammo<=0) x.endSkill(); }
    if(op.hunter){ if(S.hA==null) S.hA=8; S.hA--; if(S.hA<=0){ S.delay=op.bat; S.hA=1+(k?1:0); } }
  };
  if(op.dot) M.poisonTick=(x,i)=>{ const mul=(x.S.skillOn&&s&&s.dotMul)||1;
    if(op.dot.fix) x.hit(i,'m',0,'extra',{fixed:V(op.dot.fix,x.k),indirect:true,noArc:true});
    else x.hit(i,'m',V(op.dot.sc,x.k)*mul,'extra',{indirect:true,noArc:true}); };
  const pushTick=(x,t,dur,only)=>x.S.ticks.push({f:0,iv:Math.round(t.iv*30),dur:Math.round(dur*30),ty:t.ty,sc:V(t.sc,x.k),tg:t.tg||1,ep:t.ep,brX:t.brX,brTy:t.brTy,only});
  const bursts=x=>{ const k=x.k; for(const b of (s.burst||[])){ const n=V(b.n,k)||1;
      for(let h=0;h<n;h++){ const fire=()=>{
          // rot：每一发依次落在不同敌人身上（中心倍率），outer 是同一次轰炸对其余敌人的外圈倍率
          if(b.rot){ if(!x.N) return; const j=h%x.N; x.hit(j,b.ty,V(b.sc,k),'direct',{defPct:b.igP||0});
            if(b.outer) for(let i=0;i<x.N;i++) if(i!==j) x.hit(i,b.ty,V(b.outer,k),'direct',{defPct:b.igP||0}); return; }
          const tg=Math.min(x.N,V(b.tg,k)||1); for(let i=0;i<tg;i++){
            if(b.brDot&&op.brDot&&x.inBr(i,op.brDot.t)){ x.S.dot=x.S.dot||{}; const u=x.uid(i); x.S.dot[u]=Math.max(x.S.dot[u]||0,V(b.brDot,k)); }
            const d=x.hit(i,b.ty,V(b.sc,k),'direct',{defPct:b.igP||0}); if(b.ep)x.erode(i,d*V(b.ep.r,k),b.ep.t); } };
        const at=(b.at||0)+(b.gap||0)*h; if(at>0) x.later(at,fire); else fire(); } } };
  M.onCast=x=>{ const k=x.k,S=x.S;
    if(s.ammo){ S.ammo=V(s.ammo,k); S.skillOn=true; S.skillLeft=Infinity; }
    if(s.perm||(s.perm2&&S.casts>=2)){ S.skillOn=true; S.skillLeft=Infinity; }
    if(s.d2&&S.casts>=2) S.skillLeft=s.d2;
    bursts(x);
    if(s.tick) pushTick(x,s.tick,V(s.tick.dur,k)||V(s.d,k));
    // 开技能给范围内敌人叠麻痹（真言）；之后队友每开一次技能再叠一次
    if(s.palsy){ S.pTrig=1; S.pNext=x.f+Math.round(30/Math.max(0.01,x.cfg.sargRate||0)); for(let i=0;i<x.N;i++)x.palsyAdd(i,s.palsy.add); }
  };
  M.onEnd=x=>{ const k=x.k,S=x.S;
    if(s.end){ const tg=Math.min(x.N,s.end.tg||1); S.skillOn=true; for(let i=0;i<tg;i++) x.hit(i,s.end.ty,V(s.end.sc,k),'direct'); S.skillOn=false; }
    if(s.after){ if(s.after.lock) S.lock=s.after.lock; if(s.after.hold) S.hold=s.after.lock; if(s.after.tick) pushTick(x,s.after.tick,s.after.tick.dur); } };
  M.frame=x=>{ const k=x.k,S=x.S,a=op.aura;
    if(a&&(!a.block||x.blocking())&&x.f>0&&x.f%Math.round(a.iv*30)===0){ const tg=Math.min(x.N,a.tg||1);
      for(let i=0;i<tg;i++){ if(a.fix) x.hit(i,'m',0,'extra',{fixed:V(a.fix,k),indirect:true,noArc:true}); else x.hit(i,a.ty,V(a.sc,k),'direct',{indirect:true,noArc:true});
        if(a.ep)x.erode(i,x.atk()*V(a.ep.r,k),a.ep.t); } }
    for(let j=S.ticks.length-1;j>=0;j--){ const t=S.ticks[j]; t.f++;
      if(t.f%t.iv===0){ const tg=t.only!=null?1:Math.min(x.N,t.tg);
        for(let q=0;q<tg;q++){ const i=t.only!=null?t.only:q, ty=t.brTy&&x.inBr(i,t.brTy)?'e':t.ty;
          const d=x.hit(i,ty,t.sc,'direct',{indirect:true});
          if(t.ep)x.erode(i,(t.ep.of==='dmg'?d:x.atk())*V(t.ep.r,k),t.ep.t);
          if(t.brX&&x.inBr(i,t.brX.t))x.hit(i,'e',V(t.brX.sc,k),'extra',{indirect:true,noArc:true}); } }
      if(t.f>=t.dur) S.ticks.splice(j,1); }
    if(x.f%30===29){
      if(S.dot) for(const u in S.dot) if(S.dot[u]){ const e=x.byUid(u); if(!e||e.dead){ delete S.dot[u]; continue; } if(x.inBr(e,op.brDot.t)) x.hit(e,'e',S.dot[u],'extra',{indirect:true,noArc:true}); else S.dot[u]=0; }
      // 技能期间，被她打过的敌人每秒继续累计元素损伤，直到爆发（酒神）
      if(s&&s.epTick&&S.mk&&isOn(x)) for(const u in S.mk){ const e=x.byUid(u); if(!e||e.dead){ delete S.mk[u]; continue; } if(!x.inBr(e)) x.erode(e,x.atk()*V(s.epTick.r,k),s.epTick.t); }
    }
    if(s&&s.palsy&&isOn(x)&&S.pTrig<s.palsy.max&&x.cfg.sargRate>0&&x.f>=S.pNext){ S.pTrig++; S.pNext=x.f+Math.round(30/x.cfg.sargRate); for(let i=0;i<x.N;i++)x.palsyAdd(i,s.palsy.add); } };
  // —— 元素损伤相关的回调 ——
  // e 是爆发的敌人。“全场”类效果不看范围；妮芙的叠层只算自己攻击范围内的
  M.onBurst=(x,e,t)=>{ const k=x.k,S=x.S;
    if(op.onBr&&op.onBr.t===t){ x.hit(e,'e',V(op.onBr.sc,k),'extra',{indirect:true,noArc:true}); if(V(op.onBr.atk,k))S.brBuff=x.f+op.onBr.dur*30; }
    if(op.brStack&&op.brStack.t===t&&x.inRange(e)) S.brN=Math.min(op.brStack.max,(S.brN||0)+1);
    if(op.brTick&&op.brTick.t===t) pushTick(x,op.brTick,op.brTick.dur,e);
    if(s&&s.ammoBr&&s.ammoBr.t===t&&isOn(x)&&S.ammo>0) S.ammo+=s.ammoBr.n; };
  M.onPalsy=(x,e,w)=>{ if(op.onPalsy&&(!op.onPalsy.range||x.inRange(e))) x.hit(e,'e',V(op.onPalsy.sc,x.k),'extra',{w,indirect:true,noArc:true}); };
  M.palsyKeep=x=>op.onPalsy?V(op.onPalsy.keep,x.k)||0:0;
  M.palCap=x=>(s&&s.palsy&&isOn(x))?s.palsy.cap:3;
  M.onPalsyOver=(x,e,over)=>{ if(!(s&&s.palsy&&isOn(x)&&x.inRange(e)))return; const sc=V(s.palsy.sc,x.k);
    x.hit(e,'e',sc,'extra',{w:over,indirect:true,noArc:true}); const nx=x.N>1?x.nextOf(e):null; if(nx)x.hit(nx,'e',sc,'extra',{w:over,indirect:true,noArc:true}); };
  // me：这次攻击打的是不是本干员（被它阻挡）
  M.onEnemyAtk=(x,e,stopped,me)=>{ const k=x.k,S=x.S;
    if(op.eAtkEp&&x.inRange(e)) x.erode(e,V(op.eAtkEp.v,k),op.eAtkEp.t);
    if(s&&s.t==='def'&&!stopped&&me){ if(isOn(x)){ if(s.onAtked)x.erode(e,x.atk()*V(s.onAtked.r,k),s.onAtked.t); } else S.sp++; } };
  M.epSpd=(x,t)=>(s&&s.epSpd&&isOn(x)&&s.epSpd[t])||0;
  M.epMul=(x,e)=>(op.epBoss&&x.isBoss(e)?V(op.epBoss,x.k):1)*(op.epBlk&&x.blocking()?V(op.epBlk,x.k):1);
  return (op._m=M);
}

// ── 战场上的敌人 ──────────────────────────────────────
// 元素损伤、爆发、减防、麻痹记在敌人身上，所有干员共享；各干员自己的叠层（伊比利亚、中毒）记在干员那边。
const EL={n:{dur:10,dmg:6000},w:{dur:8,dmg:5000},f:{dur:10,dmg:7000},d:{dur:15},a:{dur:15}};
function newEnemy(o){
  const e=Object.assign({hp:Infinity,def:0,res:0,boss:false,mass:0,main:false,dead:false,mDef:1,mRes:1},o);
  e.ep={}; for(const q in EL)e.ep[q]=0; e.own=new Map(); e.brEnd=-1; e.brT=''; e.brF=0; e.brShare=new Map(); e.defDn=0; e.palsy=0;
  return e;
}
const inBurst=(W,e,q)=>W.f<e.brEnd&&(!q||e.brT===q);
// 元素损伤累计。by 为造成损伤的干员（队友输入时为 null）。累计满时爆发：
// 爆发的固定伤害是无来源伤害，按各干员在这次累计里的占比记到各自头上。
function worldErode(W,e,q,v,by){
  if(!(v>0)||e.dead||W.f<e.brEnd)return;
  e.ep[q]+=v; if(by){ const o=e.own.get(by)||{}; o[q]=(o[q]||0)+v; e.own.set(by,o); }
  if(e.ep[q]<(e.boss?2000:1000))return;
  const tot=e.ep[q]; e.brShare=new Map(); for(const [a,o] of e.own) if(o[q]>0) e.brShare.set(a,Math.min(1,o[q]/tot));
  for(const z in EL)e.ep[z]=0; e.own=new Map();
  let spd=0; for(const a of W.agents) spd=Math.max(spd,a.epSpd(q)||0);
  e.brT=q; e.brF=0; e.brEnd=W.f+Math.round(EL[q].dur*30/(1+spd/100));
  if(q==='w')e.defDn+=120;
  for(const a of W.agents) if(W.inRange(a,e)) a.noteBurst();
  if(EL[q].dmg) for(const [a,sh] of e.brShare) a.add('extra',EL[q].dmg*sh,e);
  if(q==='n')worldPalsy(W,e,3);
  for(const a of W.agents) a.onBurst(e,q);
}
// 麻痹：上限 3 层（真言技能期间 2 层），超出上限的层数交给模型处理
function worldPalsy(W,e,n){
  let cap=3; for(const a of W.agents) cap=Math.min(cap,a.palCap());
  const over=Math.max(0,e.palsy+n-cap); e.palsy=Math.min(cap,e.palsy+n);
  if(over>0) for(const a of W.agents) a.onPalsyOver(e,over);
}
// 每秒：队友的元素损伤、凋亡与狂躁爆发期间的持续伤害
function worldSecond(W){
  if(W.f%30!==29)return;
  const te=W.teamEp; if(te) for(const e of W.enemies) if(!e.dead) for(const q in te) if(te[q]>0&&EL[q]) worldErode(W,e,q,te[q],null);
  for(const e of W.enemies) if(!e.dead&&W.f<e.brEnd){ e.brF++;
    const d=e.brT==='d'?800:e.brT==='a'?Math.min(2110,160+130*e.brF):0;
    if(d) for(const [a,sh] of e.brShare) a.add('extra',d*sh,e); }
}
// 敌人发动一次普通攻击：有麻痹时被打断并消耗一层
function worldEnemyAttack(W,e){
  let stopped=false;
  if(e.palsy>1e-9){ let keep=0; for(const a of W.agents) keep=Math.max(keep,a.palsyKeep());
    const use=1-keep, w=Math.min(1,e.palsy/use); e.palsy=Math.max(0,e.palsy-use); stopped=true;
    for(const a of W.agents) a.onPalsy(e,w); }
  for(const a of W.agents) a.onEnemyAtk(e,stopped);
  return stopped;
}

// ── 干员个体 ──────────────────────────────────────────
// world 需要提供：f、enemies、agents、targets(agent)（当前能攻击的敌人，已按优先级排序）、deal(agent,e,d)（返回实际伤害）、
// blocking(agent)、blockedBy(agent,e)、inRange(agent,e)、nextOf(agent,e)、onCast(agent)，以及 teamEp（可选）。
function makeAgent(op0, elite, cfg, sel, W){
  const k=elite?1:0; sel=sel||{};
  const op=variant(op0,sel.skill), E=equipFx(sel.eq);
  const m=(op.m!=='gen'&&MODELS[op.m||op.id])||gen(op);
  const T=Math.max(1,cfg.T), dt=1/30;
  const C=CORE[cfg.core], has=b=>op.bonds.includes(b)||sel.bond===b;   // sel.bond：变形同构体给的额外盟约
  // 吞噬：单人排行里按参数栏选的干员计算；队伍模拟里由站位决定（cfg.dvGain / cfg.eaten）
  const dv=cfg.team?cfg.dvGain:devourInfo(cfg);
  // 生效的核心盟约：单人排行只有当前选中的那个；队伍模拟里干员所属的、已激活的核心盟约都生效（cfg.cores）
  const CS={};
  if(cfg.team){ for(const c in (cfg.cores||{})) if(op.bonds.includes(CORE[c].name)) CS[c]={L:cfg.cores[c].L+E.layers+(c==='egir'&&dv?dv.tier:0),six:!!(CORE[c].six&&cfg.cores[c].six)}; }
  else if(cfg.bondOn&&C&&has(C.name)) CS[cfg.core]={L:cfg.L+E.layers+(cfg.core==='egir'&&dv?dv.tier:0),six:!!(C.six&&cfg.six)};
  const isC=c=>!!CS[c], Lc=c=>CS[c]?CS[c].L:0, sixC=c=>!!(CS[c]&&CS[c].six);
  const core=Object.keys(CS)[0]||null, L=core?CS[core].L:0, six=core?CS[core].six:false;
  // 自己就是被吞噬的那一个：不获得攻击力；活不下来（也没有复活）就整场没有输出
  const eaten=cfg.team?!!cfg.eaten:!!(isC('egir')&&dv&&dv.o.id===op0.id);
  const dead=cfg.team?!!(cfg.eaten&&cfg.eaten.dead):eaten&&!dv.alive&&!dv.revive;
  const subOf=b=>cfg.sub[b]&&cfg.sub[b].on?cfg.sub[b]:null;
  const ly=b=>{ for(const c in CS) if(CORE[c].name===b) return CS[c].L; return subOf(b)?subOf(b).L||0:0; };
  const sb=b=>has(b)?subOf(b):null;
  const pre=subOf('精准'), preOn=pre&&(has('精准')||(pre.three&&op.r));
  const arc=subOf('奥术'), arcC=sb('奥术')?0.2+0.004*arc.L:0;
  const swi=subOf('迅捷'), swiftP=swi?Math.min(1,(20+0.35*swi.L)/100):0;
  const raid=subOf('突袭');
  const tf=op.tf?op.tf(k,ly):{}, fx=op.fx?op.fx(k,cfg):{};
  // 队伍模拟里，与“范围内敌人数、是否在阻挡”有关的天赋按当前实际情况重新算；单人计算沿用参数栏的设定
  const fxLive=cfg.team&&op.fx, fxOf=()=>fxLive?op.fx(k,Object.assign({},cfg,{N:tl.length,blocking:W.blocking(A)})):fx;
  const fxD=key=>fxLive?(fxOf()[key]||0)-(fx[key]||0):0, fxDm=()=>fxLive?(fxOf().dm||1)/(fx.dm||1):1;
  const dotC=isC('iberia')?(0.11+0.0006*Lc('iberia'))*(sixC('iberia')?2:1):0;
  let sPct=E.atk+cfg.own+cfg.xAtk+(cfg.stunt>=2&&k?30:0)+(m.atkPct?m.atkPct(k,cfg):0)+(fx.atk||0)+(cfg.tileAtk||0);
  if(preOn) sPct+=10+1.2*pre.L;
  if(sb('突袭')) sPct+=25+raid.L;
  if(sb('独行')) sPct+=60;
  if(isC('yan')) sPct+=23+0.9*Lc('yan');
  if(isC('ursus')) sPct+=35+0.75*Lc('ursus');
  if(isC('lethania')) sPct+=30+Lc('lethania');
  if(isC('kazimierz')) sPct+=Math.min(50+Lc('kazimierz'),20*cfg.deploys);
  if(sixC('victoria')) sPct+=40*(E.n-E.adv)+80*E.adv;
  let sAspd=E.aspd+cfg.xAspd+(fx.aspd||0)+(cfg.tileAspd||0);
  if(sb('灵巧')) sAspd+=10+subOf('灵巧').L;
  if(raid&&raid.L>=50) sAspd+=50;
  if(sixC('lethania')) sAspd+=20;
  let dmMul=(V(op.dm,k)||1)*(fx.dm||1)*E.dm*(op.r?E.rdm:1);
  const weak=op.weak||E.weak, brDm=(V(op.burstDm,k)||1)*(1+E.brDm);   // brDm：对元素爆发期间的敌人的伤害倍率
  if(isC('victoria')&&E.n>0) dmMul*=1.25+0.008*Lc('victoria');
  if(isC('kjerag')) dmMul*=1.25*(1+(cfg.cold/100)*(0.35+0.01*Lc('kjerag')));
  if(sb('协防干员')) dmMul*=k?1.4:1.2;
  const baseAtk=op.atk[k]+(isC('egir')?(cfg.devour||0)+(dv&&!eaten?dv.atk:0):0);
  const sirF=isC('siracusa')?(32+0.4*Lc('siracusa'))*30:0, sirAspd=25+0.8*Lc('siracusa');
  const sgDur=isC('sargon')?5+0.22*Lc('sargon'):0;
  const pre3=preOn&&pre.three, arcRes=arc&&arc.three?30+0.05*arc.L:0;
  const defOf=e=>e.def*(pre3?0.7:1)*(V(op.defMul,k)||1);
  const resOf=e=>{ let r=Math.max(0,e.res-arcRes); if(pre3) r*=0.7; return Math.min(100,Math.max(0,r-(V(op.resF,k)||0))); };
  const rm0=e=>1-resOf(e)/100;
  // 盟约持续法伤：dotOwn=true 时算作干员自己的伤害（吃伤害倍率和攻击方的无视法抗）；
  // 否则按无来源伤害处理，只受目标身上的减抗影响
  const rmD=e=>cfg.dotOwn?rm0(e):1-Math.min(100,Math.max(0,e.res-arcRes))/100;
  const sk=m.sk, costMul=E.cost*(cfg.stunt>=5&&k?0.7:1), cost=sk?Math.max(1,V(sk.cost,k)*costMul):0;
  const S={sp:(sk||m.nextTime?V((sk||op.sk).init||op.sk.i,k)||0:0)+(sb('独行')?15:0)+E.init,skillOn:false,skillLeft:0,casts:0,nAtk:0,atkT:0,lock:0,hold:0,delay:0,skT:0,skAtk:0,units:[],q:[],ticks:[],sg:[],sand:null,lastCast:null,castN:0};
  const sp0=S.sp;
  const sec=sel.trace?new Array(Math.ceil(T)).fill(0):null, onArr=sel.trace?new Array(Math.ceil(T)).fill(0):null;
  const mine=new Map();   // 每个敌人身上属于本干员的状态：伊比利亚叠层、中毒、本帧是否打到
  const my=e=>{ let s=mine.get(e); if(!s){ s={st:0,end:-1,dotF:0,poiEnd:-1,poiF:0,mark:-1}; mine.set(e,s); } return s; };
  const parts={direct:0,bond:0,extra:0}; let main=0, full=null, kills=0, dealt=0;
  let tl=[];   // 本帧的目标列表
  const A={op:op0,cfg,sel,k,core,six,L,cores:CS};
  const x={S,k,cfg,costMul,get fx(){return fxOf();},get f(){return W.f;},get N(){return tl.length;}};
  const R=i=>typeof i==='object'?i:tl[i];
  x.uid=i=>{ const e=R(i); return e?e.uid:-1; };
  x.byUid=u=>W.enemies.find(e=>e.uid==u);
  x.inRange=e=>W.inRange(A,e);
  x.isBoss=i=>{ const e=R(i); return !!(e&&e.boss); };
  x.blocking=()=>W.blocking(A);
  x.heavyBlocked=i=>{ const e=R(i); return !!(e&&W.blockedBy(A,e)&&e.mass>8); };
  const buffs=()=>m.buffs?m.buffs(x):{};
  const tfOn=()=>!tf.dur||W.f<tf.dur*30;
  const atkNow=()=>{const on=tfOn();let p=sPct+(on?tf.atk||0:0)+(buffs().atk||0);
    if(E.castAtk)p+=Math.min(E.castAtk[1],E.castAtk[0]*S.castN); if(E.skAtk&&S.skillOn)p+=E.skAtk;
    // killAtk / killAp：击倒敌人后叠基础攻击力 / 攻击力%（只有队伍模拟里敌人会倒下）
    if(op.killAp)p+=V(op.killAp.v,k)*Math.min(V(op.killAp.max,k),kills);
    const kb=op.killAtk?V(op.killAtk.v,k)*Math.min(V(op.killAtk.max,k),kills):0;
    if(fxLive)p+=fxD('atk');
    return (baseAtk+kb+(on?tf.base||0:0))*(1+p/100);};
  const flagMul=()=>{ if(!E.flag)return 1; const t=W.f/30; return t<15?E.flag:t<30?1+(E.flag-1)*(30-t)/15:1; };
  x.interval=()=>{ const b=buffs(); let a=op.aspd[k]+sAspd+(b.aspd||0)+(tfOn()?tf.aspd||0:0)+(W.f<sirF?sirAspd:0)+fxD('aspd');
    if(E.aspdSec)a+=Math.min(E.aspdSec[1],E.aspdSec[0]*Math.floor(W.f/30)); if(E.aspdAtk)a+=Math.min(E.aspdAtk[1],E.aspdAtk[0]*S.nAtk); if(S.skillOn)a+=E.skAspd;
    if(sgDur){ let n=0; for(const e of S.sg) if(e>W.f) n++; a+=Math.min(300,12*(n+cfg.sargRate*sgDur)); }
    a=Math.max(10,Math.min(600,a));
    return Math.max(0.1,(op.bat+(b.batAdd||0))*(b.batMul||1))/(a/100); };
  const add=(g,d,e)=>{ if(dead||!e)return; const got=W.deal(A,e,d); parts[g]+=got; dealt+=got; if(e.main)main+=got; if(sec)sec[Math.min(sec.length-1,Math.floor(W.f/30))]+=got; };
  A.add=add; A.killed=()=>{kills++;};
  x.defDown=i=>{ const e=R(i); return e?e.defDn:0; };
  x.inBr=(i,q)=>{ const e=R(i); return !!e&&inBurst(W,e,q); };
  x.atk=()=>atkNow();
  x.palsyAdd=(i,n)=>{ const e=R(i); if(e)worldPalsy(W,e,n); };
  x.erode=(i,v,q)=>{ const e=R(i); if(e)worldErode(W,e,q||'w',v*(m.epMul?m.epMul(x,e):1),A); };
  const proc=(e,w,Atk)=>{ if(!dotC||!e)return; const s=my(e); if(s.st<=0)s.dotF=0;
    s.st=Math.min(10,s.st+w); s.end=W.f+300;
    if(full===null&&e.main&&s.st>=9.999)full=W.f*dt;
    if(sixC('iberia')&&tl.length>=2){ const nx=W.nextOf(A,e); if(nx)add('bond',0.2*3*Atk*rm0(nx)*w,nx); } };
  x.hit=(i,type,scale,g,o={})=>{ const e=R(i); if(!e||e.dead)return 0;
    const b=buffs(), Atk=atkNow(), w=o.w==null?1:o.w, t=type[0];
    if(op.flySc&&e.fly) scale*=V(op.flySc,k);   // 攻击空中目标时攻击力提高（只有队伍模拟里有空中敌人）
    const rm=1-Math.min(100,Math.max(0,resOf(e)*Math.min(b.resMul||1,e.mRes)-(inBurst(W,e,'f')?20:0)-(b.resF||0)))/100;   // 灼燃爆发期间法抗 −20
    const ph=()=>{const df=Math.max(0,defOf(e)*Math.min(b.defMul||1,e.mDef)-e.defDn-(o.defFlat||0))*(1-(o.defPct||0));return Math.max(Atk*scale-df,Atk*scale*0.05);};
    const mg=()=>Math.max(Atk*scale*rm,Atk*scale*0.05);
    let d;
    if(o.fixed!=null) d=o.fixed*rm;
    else if(t==='t'||t==='e') d=Atk*scale;   // 真实伤害、元素伤害：无视防御和法抗
    else if(weak) d=Math.max(ph(),mg());
    else d=t==='p'?ph():mg();
    const fm=flagMul();
    d*=dmMul*fxDm()*(b.dm||1)*fm;
    if(brDm!==1&&inBurst(W,e))d*=brDm;
    // dmBoss：[倍率, 秒]，领袖在场若干秒后受到本干员的伤害提高（蕾缪安的“通缉”）
    if(op.dmBoss&&e.boss&&W.f>=op.dmBoss[1]*30)d*=V(op.dmBoss[0],k);
    add(g,d*w,e);
    if(g==='direct'&&!o.indirect)my(e).mark=W.f;
    // epAll：造成的每一份法术伤害都附带一定比例的元素损伤（塔露拉、黑键模组）
    if(op.epAll&&t==='m'&&o.fixed==null&&V(op.epAll.r,k))x.erode(e,d*w*V(op.epAll.r,k),op.epAll.t);
    if(!o.noArc&&(E.xm||E.xt)){ add('extra',(Math.max(Atk*E.xm*rm,Atk*E.xm*0.05)+Atk*E.xt)*dmMul*fxDm()*fm*w,e); if(E.xm&&cfg.indirect)proc(e,w,Atk); }
    if(arcC&&!o.noArc){add('extra',Math.max(Atk*arcC*rm,Atk*arcC*0.05)*dmMul*fxDm()*w,e); if(cfg.indirect)proc(e,w,Atk);}
    if(!o.indirect||cfg.indirect)proc(e,w,Atk);
    return d*w; };
  x.poison=(i,dur)=>{ const e=R(i); if(!e)return; const s=my(e); if(s.poiEnd<W.f)s.poiF=0; s.poiEnd=W.f+(dur||93); };
  x.later=(sec,fn)=>S.q.push({at:W.f+Math.round(sec*30),fn});
  const noteCast=()=>{ S.lastCast=W.f; S.castN++; if(sgDur){ S.sg.push(W.f+sgDur*30); if(S.sg.length>60)S.sg=S.sg.filter(e=>e>W.f); if(S.sand==null)S.sand=W.f; } if(W.onCast)W.onCast(A); };
  x.castEvent=noteCast;
  A.sargStack=()=>{ if(sgDur){ S.sg.push(W.f+sgDur*30); if(S.sand==null)S.sand=W.f; } };
  // 迅捷按期望值返还技力；返还量不超过一次技能的消耗，避免低消耗技能被算成无限连放
  const swiftEnd=()=>{ if(swiftP) S.sp+=swiftP*Math.min(cost||99,(has('迅捷')?12:0)+(swi.L>=40?15:0)); };
  const endSkill=()=>{ S.skillOn=false; if(m.onEnd)m.onEnd(x); swiftEnd(); };
  x.endSkill=endSkill;
  const cast=()=>{ S.sp=0; S.casts++; S.skT=0; S.skAtk=0; const d=V(sk.dur,k); if(d>0){S.skillOn=true;S.skillLeft=d;}
    noteCast(); if(m.onCast)m.onCast(x); if(!S.skillOn)swiftEnd(); };
  // 世界回调
  A.epSpd=q=>(q==='w'?tf.epCd||0:0)+(sixC('yan')?40+0.3*Lc('yan'):0)+(m.epSpd?m.epSpd(x,q):0);
  A.noteBurst=()=>{ S.bursts=(S.bursts||0)+1; };
  A.onBurst=(e,q)=>{ if(m.onBurst)m.onBurst(x,e,q); };
  A.palCap=()=>m.palCap?m.palCap(x):3;
  A.onPalsyOver=(e,over)=>{ if(m.onPalsyOver)m.onPalsyOver(x,e,over); };
  A.palsyKeep=()=>m.palsyKeep?m.palsyKeep(x):0;
  A.onPalsy=(e,w)=>{ if(m.onPalsy)m.onPalsy(x,e,w); };
  A.onEnemyAtk=(e,stopped)=>{ if(m.onEnemyAtk)m.onEnemyAtk(x,e,stopped,W.attacksMe(A,e)); };
  x.nextOf=e=>W.nextOf(A,e);
  // 队伍模拟：倒下时技能中断；再部署时技力回到初始值、状态清空（技能开启次数保留）
  A.fall=()=>{ S.skillOn=false; S.skillLeft=0; S.units=[]; S.q=[]; S.ticks=[]; S.ammo=0; };
  A.redeploy=()=>{ Object.assign(S,{sp:sp0,skillOn:false,skillLeft:0,atkT:0,lock:0,hold:0,delay:0,skT:0,skAtk:0,units:[],q:[],ticks:[],ammo:0}); };
  A.skillOn=()=>S.skillOn;
  A.buffs=buffs;
  A.dead=dead;
  // 一帧的前半：技能、技力、攻击、模型逐帧逻辑
  A.stepA=()=>{ const f=W.f; tl=dead?[]:W.targets(A);
    if(onArr&&S.skillOn)onArr[Math.min(onArr.length-1,Math.floor(f/30))]=1;
    if(S.skillOn){ S.skT+=dt; if(S.skillLeft!==Infinity){S.skillLeft-=dt;if(S.skillLeft<=0)endSkill();} }
    const spGain=dt*(1+E.sp+(m.spBonus?m.spBonus(x):0)+(tfOn()?tf.sp||0:0));
    if(sk&&sk.type==='time'&&!S.skillOn){ if(S.hold>0)S.hold-=dt; else if(!(op.spBlock&&!x.blocking()))S.sp+=spGain; }
    if(m.nextTime) S.sp=Math.min(V(m.nextTime,k)*3,S.sp+spGain);
    if(op.spT&&sk&&sk.type==='attack'&&!S.skillOn) S.sp+=dt*op.spT;
    if(S.lock>0)S.lock-=dt;
    // 什么时候放技能：单人计算里目标一直在范围内；队伍模拟按游戏的技能操作方案（W.canCast）
    if(sk&&!S.skillOn&&S.sp>=cost&&S.lock<=0&&(W.canCast?W.canCast(A):tl.length>0))cast();
    for(let j=S.q.length-1;j>=0;j--)if(S.q[j].at<=f){const e=S.q.splice(j,1)[0];e.fn();}
    S.atkT-=dt;
    if(S.atkT<=0&&S.lock<=0&&tl.length>0&&(!m.can||m.can(x))){ m.attack(x); S.nAtk++; if(S.skillOn)S.skAtk++;
      if(sk&&sk.type==='attack'&&!S.skillOn)S.sp++;
      if(sixC('kazimierz')&&(f<900||(S.lastCast!=null&&f-S.lastCast<900)))add('bond',0.65*atkNow(),tl[0]);
      // 【炎】6 人：每次攻击对打到的敌人造成 6% 攻击力的随机元素损伤，按五种元素各分到 1/5 的期望值计算；
      // 五种同时累计满时只爆发一种，每次爆发后换下一种，相当于爆发的种类是随机的
      if(sixC('yan')){ const Atk=atkNow(), ks=Object.keys(EL); for(const e of W.enemies){ const s=mine.get(e); if(s&&s.mark===f&&!e.dead) for(let z=0;z<ks.length;z++) worldErode(W,e,ks[(z+(S.bursts||0))%ks.length],Atk*0.012*(m.epMul?m.epMul(x,e):1),A); } }
      // 攻击间隔按帧对齐：换算成帧数后四舍五入（PRTS 作战机制「帧对齐机制对攻速的影响」）
      const ivF=Math.max(1,Math.round(x.interval()*30))/30;
      S.atkT+=ivF+S.delay; S.delay=0; if(S.atkT<0)S.atkT=ivF; }
    if(m.frame)m.frame(x); };
  // 一帧的后半：召唤单元、盟约的周期伤害、中毒与伊比利亚持续法伤
  A.stepB=()=>{ const f=W.f;
    for(let j=S.units.length-1;j>=0;j--){const u=S.units[j];u.f++;
      if(u.f%30===0)for(let i=0;i<tl.length;i++)x.hit(i,'magic',u.scale,'direct');
      if(u.f>=u.dur)S.units.splice(j,1);}
    if(f%30===29){
      if(sixC('ursus')&&op.blk&&!op.r){const Atk=atkNow();for(const e of W.blockedList(A,op.blk))add('bond',(0.5+0.0025*Lc('ursus'))*Atk*rm0(e),e);}
      if(sixC('sargon')&&S.sand!=null&&S.skillOn)for(const e of tl)add('bond',(800+4*Lc('sargon'))*rm0(e),e);
    }
    if(sixC('sargon')&&S.sand!=null&&f>S.sand&&(f-S.sand)%150===0)for(const e of tl)add('bond',(5000+25*Lc('sargon'))*rm0(e),e);
    for(const e of W.enemies){ const s=mine.get(e); if(!s||e.dead)continue;
      if(s.poiEnd>=f){s.poiF++; if(s.poiF%30===0){ if(m.poisonTick)m.poisonTick(x,e); else x.hit(e,'magic',0,'extra',{fixed:m.poison(k,cfg),indirect:true,noArc:true}); }}
      if(s.st>0){ if(s.end<f){s.st=0;} else {s.dotF++; if(s.dotF%30===0)add('bond',s.st*dotC*atkNow()*rmD(e)*(cfg.dotOwn?dmMul*fxDm()*(buffs().dm||1)*flagMul():1),e);} }
    } };
  A.result=Tlen=>{ const total=parts.direct+parts.bond+parts.extra;
    return {dps:total/Tlen,main:main/Tlen,total,parts:{direct:parts.direct/Tlen,bond:parts.bond/Tlen,extra:parts.extra/Tlen},atk:Math.round(atkNow()),full,iv:x.interval(),sec,on:onArr,casts:S.castN,ep:!!(m.ep||op.elem||S.bursts),bursts:S.bursts||0,eaten,dead,kills}; };
  return A;
}

// 单人排行：一名干员对 N 个不会死、不会动、一直在范围里的目标
function simulate(op0, elite, cfg, sel){
  const k=elite?1:0; sel=sel||{};
  if(op0.healer) return {dps:0,main:0,parts:{direct:0,bond:0,extra:0},atk:op0.atk[k],full:null,healer:true};
  const N=Math.max(1,Math.min(8,cfg.N|0)), T=Math.max(1,cfg.T), F=Math.round(T*30);
  const enemies=[]; for(let i=0;i<N;i++) enemies.push(newEnemy({uid:i,idx:i,main:i===0,def:cfg.def,res:cfg.res,boss:!!(cfg.boss&&i===0),mass:i===0?cfg.bossMass||0:0}));
  const blk=Math.max(1,(variant(op0,sel.skill).blk)||1);
  const W={f:0,enemies,agents:[],teamEp:cfg.teamEp,
    targets:()=>enemies, deal:(a,e,d)=>d, inRange:()=>true,
    blocking:()=>!!cfg.blocking, blockedBy:(a,e)=>!!cfg.blocking&&e.idx<blk, attacksMe:(a,e)=>e.idx<blk,
    blockedList:(a,n)=>cfg.blocking?enemies.slice(0,Math.min(N,n)):[],
    nextOf:(a,e)=>enemies[(e.idx+1)%N]};
  const A=makeAgent(op0,elite,cfg,sel,W); W.agents=[A];
  const eIv=cfg.eBat>0?Math.max(1,Math.round(cfg.eBat*30)):0;
  for(W.f=0;W.f<F;W.f++){
    A.stepA(); worldSecond(W);
    if(eIv&&W.f>0&&W.f%eIv===0) for(const e of enemies) worldEnemyAttack(W,e);
    A.stepB();
  }
  return A.result(T);
}
