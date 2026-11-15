// 伊比利亚干员在「规程·序列I」中的固定配置。数组两项依次为 [初始, 精锐]。
const OPS_IBERIA = [
 {id:'bluep', name:'蓝毒', tier:'Ⅱ', cls:'狙击 · 速射手', bonds:['伊比利亚'], color:'--s1', ranged:true,
  lv:['精1 Lv60 · 技能 4 级','精2 Lv55 · 技能 7 级 · 模组 1 级'], atk:[418,524], bat:1.0, aspd:[100,110],
  trait:['【伊比利亚】每叠加 2 层，本干员攻击力 +1%','【伊比利亚】每叠加 1 层，本干员攻击力 +1%'],
  skill:['二重射击·自动：每攻击 3 次，下一次攻击额外打一个目标，倍率 140%','二重射击·自动：每攻击 3 次，下一次攻击额外打一个目标，倍率 155%'],
  extra:['天赋：攻击使目标中毒，3 秒内每秒 30 点法伤','天赋：中毒每秒 75 点法伤；模组：攻击 +20，攻速 +10（范围内有地面敌人）'],
  model:'单体物理普攻，每 4 次攻击中 1 次为技能攻击；毒伤为固定数值，每秒一跳。'},
 {id:'thorns', name:'棘刺', tier:'Ⅴ', cls:'近卫 · 领主', bonds:['伊比利亚','奥术'], color:'--s2',
  lv:['精2 Lv1 · 技能 4 级','精2 Lv60 · 技能 7 级 · 模组 1 级'], atk:[575,704], bat:1.3, aspd:[100,105],
  trait:['休整期结束时，【伊比利亚】叠加等同于场上所有干员售价的层数（每回合至多 12 层）','同上，售价 2 倍（每回合至多 24 层）'],
  skill:['至高之术：攻击 15 次充能。首次开启 30 秒，攻击力 +33%、攻速 +14；第二次起加成翻倍且永久','至高之术：首次攻击力 +40%、攻速 +16；第二次起翻倍且永久'],
  extra:['天赋：中毒 3 秒内每秒 125 点法伤（对远程敌人 250）；远程攻击时攻击力 80%','同左；模组：攻击 +39、攻速 +5，每次攻击附带 10% 攻击力法伤'],
  model:'默认站远程位（技能外 80% 攻击力）。第二次技能要到开战约 1 分钟后才出现，存活时间短时吃不到。'},
 {id:'indigo', name:'深靛', tier:'Ⅰ', cls:'术师 · 秘术师', bonds:['伊比利亚'], color:'--s3', ranged:true,
  lv:['精1 Lv55 · 技能 4 级','精2 Lv50 · 技能 7 级 · 模组 1 级'], atk:[885,1099], bat:3.0, aspd:[100,103],
  trait:['休整期结束时，已激活的【伊比利亚】层数 +2','休整期结束时，已激活的【伊比利亚】层数 +4'],
  skill:['光影迷宫（47 技力，20 秒）：攻击间隔 ×0.7，束缚概率 ×2，被束缚敌人每 0.5 秒受 12% 攻击力法伤','光影迷宫（44 技力，20 秒）：攻击间隔 ×0.65，束缚概率 ×2.5，每 0.5 秒 15% 攻击力法伤'],
  extra:['天赋：攻击 12% 概率束缚 4 秒，不攻击被束缚的敌人','天赋：18% 概率束缚；模组：攻击 +45、攻速 +3'],
  model:'单体法伤。束缚按期望折算；目标被束缚时她会蓄力后一并打出，按不损失攻击次数处理。'},
 {id:'thorn2', name:'引星棘刺', tier:'Ⅵ', cls:'特种 · 炼金师', bonds:['伊比利亚','迅捷'], color:'--s4', ranged:true,
  lv:['精2 Lv1 · 技能 4 级','精2 Lv60 · 技能 7 级 · 模组 3 级'], atk:[405,519], bat:1.5, aspd:[105,105],
  trait:['休整期结束时，已激活的【伊比利亚】【迅捷】层数 +12','休整期结束时，已激活的【伊比利亚】【迅捷】层数 +24'],
  skill:['解构涌潮（27 技力）：投掷炼金单元 12 秒，范围内地面敌人每秒受 120% 攻击力法伤','解构涌潮（24 技力）：炼金单元 15 秒，每秒 140% 攻击力法伤'],
  extra:['天赋：攻击力 +10%，范围内有队友时炼金单元延长 3 秒；全队攻速 +5','天赋（模组）：攻击力 +15%，延长 4 秒；有炼金单元时技力回复 +0.1/秒'],
  model:'普攻单体物理；炼金单元对范围内所有敌人每秒一跳，每跳都算一次伤害、都能叠层。'},
 {id:'irene', name:'艾丽妮', tier:'Ⅴ', cls:'近卫 · 剑豪', bonds:['伊比利亚'], color:'--s5',
  lv:['精2 Lv1 · 技能 4 级','精2 Lv60 · 技能 7 级 · 模组 1 级'], atk:[484,625], bat:1.3, aspd:[118,118],
  trait:['周围 12 格每有一名敌人被击倒，自身回复 3 点技力','周围 12 格每有一名敌人被击倒，自身回复 6 点技力'],
  skill:['判决（32 技力，初始 8）：范围 250% 物理并浮空，再轰击 10 次，每次 200%','判决（30 技力，初始 16）：250% + 10 次 230%'],
  extra:['普攻两连击；50% 概率无视 50% 防御（对空中必定）','同左；模组：攻击 +50，无视 70 点防御'],
  model:'技能约 3.5 秒内不普攻；浮空后的 10 次轰击按必定无视 50% 防御。击倒回技力未计入。'},
 {id:'highmo', name:'海沫', tier:'Ⅲ', cls:'近卫 · 收割者', bonds:['伊比利亚','不屈'], color:'--s6',
  lv:['精2 Lv1 · 技能 4 级','精2 Lv60 · 技能 7 级 · 模组 1 级'], atk:[569,644], bat:1.3, aspd:[100,104],
  trait:['休整期结束时，自身售价 +1（至多 4）','休整期结束时，自身售价 +2（至多 8）'],
  skill:['回首，断舍：每攻击 3 次，下一次攻击倍率 120% 并连击两次','回首，断舍：倍率 135% 并连击两次'],
  extra:['群体物理，命中范围内所有敌人','同左；模组：攻速 +4'],
  model:'群体物理，打到范围内全部敌人。售价高，配合棘刺、旅骨给层数。'},
 {id:'hbound', name:'旅骨', tier:'Ⅲ', cls:'特种 · 炼金师', bonds:['伊比利亚','精准'], color:'--s7', ranged:true,
  lv:['精2 Lv1 · 技能 4 级','精2 Lv60 · 技能 7 级 · 模组 1 级'], atk:[373,459], bat:1.5, aspd:[100,100],
  trait:['休整期结束时，自身及身前一格干员已激活的盟约叠加等同于其售价的层数','同上，售价 2 倍'],
  skill:['座浅（57 技力，初始 26）：炼金单元 31 秒，每秒 14% 攻击力法伤；重量 ≥3 的敌人每秒再受 120%','座浅（54 技力，初始 29）：32 秒，每秒 17%；重量 ≥3 再受 150%'],
  extra:['—','模组：攻击 +20；有炼金单元时技力回复 +0.1/秒'],
  model:'普攻单体物理；炼金单元每秒一跳，倍率很低，主要价值是稳定叠层和给层数。'},
 {id:'weedy', name:'温蒂', tier:'Ⅳ', cls:'特种 · 推击手', bonds:['伊比利亚','坚守'], color:'--s8',
  lv:['精2 Lv1 · 技能 4 级','精2 Lv60 · 技能 7 级 · 模组 1 级'], atk:[548,684], bat:1.2, aspd:[100,100],
  trait:['售出价格为 3','售出价格为 6'],
  skill:['液氮大炮（40 技力，初始 13）：290% 攻击力群体法伤并推开','液氮大炮（37 技力，初始 16）：320% 群体法伤'],
  extra:['同时攻击阻挡的所有敌人（至多 2 个）','同左；模组：攻击 +50'],
  model:'推动真伤和蓄水炮未计入。售价固定偏高，是给棘刺、旅骨凑层数的。'},
 {id:'rosesa', name:'瑰盐', tier:'Ⅱ', cls:'医疗 · 群愈师', bonds:['伊比利亚','聚合'], healer:true,
  lv:['精1 Lv60','精2 Lv55'], atk:[254,334],
  trait:['【伊比利亚】每叠加 3 层，本干员攻击力 +1%','【伊比利亚】每叠加 3 层，本干员攻击力 +2%'],
  model:'治疗位，攻击力加成只提高治疗量，不造成伤害。'},
 {id:'lumen', name:'流明', tier:'Ⅳ', cls:'医疗 · 疗养师', bonds:['伊比利亚','聚合'], healer:true,
  lv:['精2 Lv1','精2 Lv60'], atk:[432,534],
  trait:['战斗结束时每有一名存活的我方干员，【伊比利亚】【聚合】层数 +1','同上，层数 +2'],
  model:'治疗位，不造成伤害；每回合稳定给层数。'},
];

const MODELS = {
 bluep:{
  atkPct:(k,c)=>(c.core==='iberia'&&c.bondOn)?Math.floor(c.L/(k?1:2)):0,
  poison:(k)=>[30,75][k],
  attack(x){const sc=[1.4,1.55][x.k];
   if(x.S.sp>=3){x.castEvent();x.hit(0,'phys',sc,'direct');x.poison(0);if(x.N>=2){x.hit(1,'phys',sc,'direct');x.poison(1);}x.S.sp=0;}
   else{x.hit(0,'phys',1,'direct');x.poison(0);x.S.sp++;}}},
 thorns:{
  sk:{type:'attack',cost:[15,15],init:[0,0],dur:30},
  poison:(k,c)=>c.ranged?250:125,
  buffs(x){if(!x.S.skillOn)return{};const m=x.S.casts>=2?2:1;return{atk:[33,40][x.k]*m,aspd:[14,16][x.k]*m};},
  onCast(x){if(x.S.casts>=2)x.S.skillLeft=Infinity;},
  attack(x){const sc=x.S.skillOn||x.cfg.melee?1:0.8;x.hit(0,'phys',sc,'direct');
   if(x.k)x.hit(0,'magic',0.1,'extra',{indirect:true,noArc:true});x.poison(0);}},
 indigo:{
  sk:{type:'time',cost:[47,44],init:[10,15],dur:20},
  buffs(x){return x.S.skillOn?{batMul:[0.7,0.65][x.k]}:{};},
  bound(x){const p=[.12,.18][x.k]*(x.S.skillOn?[2,2.5][x.k]:1),q=4*p/x.interval();return q/(1+q);},
  attack(x){if(x.N<2){x.hit(0,'magic',1,'direct');return;}const b=this.bound(x);x.hit(0,'magic',1,'direct',{w:1-b});x.hit(1,'magic',1,'direct',{w:b});},
  frame(x){if(x.S.skillOn&&x.f%15===0){const b=this.bound(x),sc=[.12,.15][x.k];
   x.hit(0,'magic',sc,'direct',{w:b,indirect:true,noArc:true});if(x.N>=2)x.hit(1,'magic',sc,'direct',{w:b*b,indirect:true,noArc:true});}}},
 thorn2:{
  atkPct:(k)=>[10,15][k],
  sk:{type:'time',cost:[27,24],init:[12,13],dur:0},
  spBonus(x){return x.k&&x.S.units.length?0.1:0;},
  onCast(x){x.S.units.push({f:0,dur:([12,15][x.k]+(x.cfg.near?[3,4][x.k]:0))*30,scale:[1.2,1.4][x.k]});},
  attack(x){x.hit(0,'phys',1,'direct');}},
 irene:{
  sk:{type:'attack',cost:[32,30],init:[8,16],dur:0},
  attack(x){const o={defFlat:x.k?70:0};for(let h=0;h<2;h++){x.hit(0,'phys',1,'direct',{...o,w:.5,defPct:.5});x.hit(0,'phys',1,'direct',{...o,w:.5});}},
  onCast(x){const o={defFlat:x.k?70:0};x.S.lock=3.5;
   for(let i=0;i<x.N;i++){x.hit(i,'phys',2.5,'direct',{...o,w:.5,defPct:.5});x.hit(i,'phys',2.5,'direct',{...o,w:.5});}
   // 浮空成功时十段必定无视 50% 防御；目标免疫浮空（多数领袖）时退回天赋的 50% 概率
   const big=i=>{const s=[2,2.3][x.k]; if(x.cfg.noLev){x.hit(i,'phys',s,'direct',{...o,w:.5,defPct:.5});x.hit(i,'phys',s,'direct',{...o,w:.5});} else x.hit(i,'phys',s,'direct',{...o,defPct:.5});};
   for(let h=0;h<10;h++)x.later(0.5+0.3*h,()=>{big(h%x.N); if(x.N>=2)big((h+1)%x.N);});}},
 highmo:{
  attack(x){const sc=[1.2,1.35][x.k];
   if(x.S.sp>=3){x.castEvent();for(let i=0;i<x.N;i++){x.hit(i,'phys',sc,'direct');x.hit(i,'phys',sc,'direct');}x.S.sp=0;}
   else{for(let i=0;i<x.N;i++)x.hit(i,'phys',1,'direct');x.S.sp++;}}},
 hbound:{
  sk:{type:'time',cost:[57,54],init:[26,29],dur:0},
  spBonus(x){return x.k&&x.S.units.length?0.1:0;},
  onCast(x){x.S.units.push({f:0,dur:[31,32][x.k]*30,scale:[.14,.17][x.k]+(x.cfg.heavy?[1.2,1.5][x.k]:0)});},
  attack(x){x.hit(0,'phys',1,'direct');}},
 weedy:{
  sk:{type:'time',cost:[40,37],init:[13,16],dur:0},
  onCast(x){for(let i=0;i<x.N;i++)x.hit(i,'magic',[2.9,3.2][x.k],'direct');},
  attack(x){for(let i=0;i<Math.min(x.N,2);i++)x.hit(i,'phys',1,'direct');}},
};

