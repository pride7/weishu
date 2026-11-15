// 从游戏数据整理出队伍模拟用的地图、回合、敌人、攻击范围，写到 src/field.js。
// 用法：node tools/extract.js <游戏数据目录>
// 目录里需要：activity_table.json character_table.json skill_table.json range_table.json
//             enemy_database.json enemy_handbook_table.json char_patch_table.json，以及 lv/ 下的关卡文件：
//             m01.json…（各战场，对应 level_act3autochess_mXX）和 level_act3autochess_*.json（各回合）。
// 数据取自 https://torappu.prts.wiki/gamedata/latest/ （PRTS 整理的游戏数据）。
const fs = require('fs'), path = require('path');
const dir = process.argv[2];
if (!dir) { console.error('usage: node tools/extract.js <gamedata dir>'); process.exit(1); }
const J = f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const actAll = J('activity_table.json'), act = actAll.activity.AUTOCHESS.act3autochess.V3_1, acd = actAll.autoChessData;
const hb = (J('enemy_handbook_table.json').enemyData) || {};
// 每回合普通敌人的成长倍率：官方数据里没有，取自 sganggs/Stronghold-Protocol 的研究整理（tools/enemy-scale.json）
const SCALE = JSON.parse(fs.readFileSync(path.join(__dirname, 'enemy-scale.json'), 'utf8'));
const ct = J('character_table.json'), pt = J('char_patch_table.json').patchChars || {};
const sk = J('skill_table.json'), rg = J('range_table.json');
const be = J('battle_equip_table.json');
const edb = J('enemy_database.json').enemies;
const CH = id => ct[id] || pt[id];
const LV = name => J(path.join('lv', name + '.json'));

// ── 地图 ──────────────────────────────────────────────
// 每张战场文件是一个“大厅”，里面有 4 名玩家各自的场地和中间的领袖场地。
// 单人普通回合的场地：大厅第 31–34 行、第 2–10 列（对应回合关卡的 0–3 行、0–8 列）。
// 单人领袖回合的场地：大厅第 17–20 行、第 2–10 列（领袖关卡的 1–4 行）。
const TILE = { road: '.', fence_bound: '|', forbidden: '#', floor: 'f', start: 'S', end: 'E', telout: 'T', telin: 'f',
  wall: 'H', infection: 'i', mire: 'm', duel_grassland: 'g', speedup: 'u' };
const TOKEN = { trap_1105_accrate: 'crate', trap_1106_achplat: 'plat', trap_013_blower: 'blower', trap_1112_acblzd: 'blizzard', trap_098_mire: 'mire' };
const MAPS = ['m01', 'm02', 'm03', 'm04', 'm05', 'm06', 'm09', 'm10', 'm11', 'm12'];
function region(L, r0, c0) {
  const md = L.mapData, H = md.map.length, rows = [];
  for (let r = 0; r < 4; r++) { let s = ''; for (let c = 0; c < 9; c++) {
    const t = md.tiles[md.map[H - 1 - (r0 + r)][c0 + c]], k = t.tileKey.replace('tile_', '');
    if (!(k in TILE)) throw new Error('unknown tile ' + k);
    s += TILE[k]; } rows.push(s); }
  const toks = {};
  for (const t of (L.predefines && L.predefines.tokenInsts) || []) {
    const r = t.position.row - r0, c = t.position.col - c0, kind = TOKEN[t.inst.characterKey];
    if (!kind || c < 0 || c > 8 || r < 0 || r > 4) continue;
    const key = r + ',' + c; const o = toks[key] = toks[key] || { r, c, kinds: [], hidden: true, dir: t.direction };
    if (!o.kinds.includes(kind)) o.kinds.push(kind); if (!t.hidden) o.hidden = false;
  }
  return { rows, tokens: Object.values(toks) };
}
const maps = MAPS.map(id => {
  const L = LV(id), n = region(L, 31, 2), b = region(L, 17, 2);
  return { id, name: '#' + id.slice(1), rows: n.rows, tokens: n.tokens, bossRows: b.rows, bossTokens: b.tokens };
});

// ── 敌人 ──────────────────────────────────────────────
const enemies = {};
function enemy(key) {
  if (enemies[key]) return; const e = edb.find(x => x.Key === key); if (!e) throw new Error('no enemy ' + key);
  const g = k => { for (const v of e.Value) { const a = v.enemyData.attributes[k]; if (a && a.m_defined) return a.m_value; } };
  const gd = k => { for (const v of e.Value) { const a = v.enemyData[k]; if (a && a.m_defined) return a.m_value; } };
  const d0 = e.Value[0].enemyData, bb = {}; for (const b of d0.talentBlackboard || []) bb[b.key] = b.valueStr ?? b.value;
  const skills = (d0.skills || []).map(s => s.prefabKey);
  const o = enemies[key] = { name: gd('name'), hp: g('maxHp'), atk: g('atk'), def: g('def') || 0, res: g('magicResistance') || 0,
    spd: g('moveSpeed') || 1, bat: g('baseAttackTime'), mass: g('massLevel') || 0, fly: gd('motion') === 'FLY',
    type: gd('levelType') || 'NORMAL', lp: gd('lifePointReduce') ?? 1, range: gd('rangeRadius'), aw: gd('applyWay') || '' };
  // 替换数量公式要用的“属性强度”和“战斗效能系数”（官方 randomEnemyAttributeDict）
  o.P = (g('atk') || 0) * 5 + (g('maxHp') || 0) + (g('def') || 0) * 3 + (g('magicResistance') || 0) * 3;
  const ra = acd.randomEnemyAttributeDict[key]; o.bef = ra ? ra.enemyBattleEffectivenessFactor : 1;
  // 伤害类型（图鉴）：p 物理、m 法术、n 不造成伤害；物理和法术都有时按物理
  const dt = (hb[key] && hb[key].damageType) || ['PHYSIC'];
  o.dt = dt.includes('PHYSIC') ? 'p' : dt.includes('MAGIC') ? 'm' : 'n';
  // 图鉴里的能力说明
  const h = hb[key]; if (h && h.abilityList && h.abilityList.length) o.abt = h.abilityList.map(a => String(a.text || '').replace(/<[^>]+>/g, '')).filter(Boolean);
  // 能建模的能力（数值取自游戏数据的天赋/技能参数，含义按 PRTS 各敌人页面的天赋说明）
  const ab = {}, N = k => bb[k] == null ? undefined : +bb[k];
  const sk1 = name => (d0.skills || []).find(s => s.prefabKey === name);
  const sbb = s => { const o = {}; for (const b of (s && s.blackboard) || []) o[b.key] = b.valueStr ?? b.value; return o; };
  const A = k => g(k);
  const txt0 = (o.abt || []).join('；');
  // 隐匿：技能 InvisibleCombat，或图鉴能力里以“隐匿”开头的一条（潜水员只在水中隐匿，不算）
  if (skills.includes('InvisibleCombat') || (o.abt || []).some(t => /^隐匿/.test(t))) ab.camo = 1;
  if (bb['refracting.magic_resistance'] || bb['Refracting.magic_resistance']) ab.refract = N('refracting.magic_resistance') || N('Refracting.magic_resistance');
  if (bb['DeadSpawn.enemy_key']) ab.split = { key: bb['DeadSpawn.enemy_key'], n: N('DeadSpawn.cnt') || 1, delay: 0 };
  if (bb['deathrattle.enemy_key']) ab.split = { key: bb['deathrattle.enemy_key'], n: N('deathrattle.cnt') || 1, delay: N('deathrattle.delay') || 0 };
  if (bb['reborn.duration'] != null) ab.reborn = N('reborn.duration');
  // 图鉴写明的：需要 N 次伤害击倒（每次受到伤害只算 1 点）、无法被阻挡
  const mh = txt0.match(/需要(\d+)次伤害击倒/);
  if (mh && !/被击倒时暂时变为/.test(txt0)) ab.hits = +mh[1];
  if ((o.abt || []).some(t => /^无法被阻挡/.test(t))) ab.unblock = 1;
  // 占用的阻挡数
  const bv = txt0.match(/只能被阻挡数大于等于(\d)的单位阻挡/); if (bv) ab.bv = +bv[1];
  if (key.startsWith('enemy_1309_mhboar')) ab.bv = 2;
  if (key.startsWith('enemy_2124_dyjsfg')) ab.bv = 3;
  // ── 自身的生存能力 ──
  if (A('hpRecoveryPerSec')) ab.regen = A('hpRecoveryPerSec');                                   // 每秒回复
  if (A('tauntLevel')) ab.taunt = A('tauntLevel'); if (N('taunt.taunt_level')) ab.taunt = (ab.taunt || 0) + N('taunt.taunt_level');   // 嘲讽等级
  if (N('dmg_res.damage_resistance')) ab.dr = N('dmg_res.damage_resistance');                   // 重生造物：受到的物理/法术伤害 −90%
  if (N('buff_to_blocker.block_cnt')) ab.blkGive = { v: N('buff_to_blocker.block_cnt'), max: N('buff_to_blocker.max_valid_stack_cnt') || 6 };   // 阻挡它的干员阻挡数 +1
  if (N('DmgResist.damage_resistance')) ab.drUnblk = N('DmgResist.damage_resistance');          // 未被阻挡时庇护
  if (N('defup.def')) ab.auraDef = { v: N('defup.def'), r: N('defup.range_radius') || o.range || 2.5 };   // 周围其他敌人防御 +（不叠加）
  if (N('magdef_add.magic_resistance')) ab.auraRes = { v: N('magdef_add.magic_resistance'), r: o.range || 2.5 };   // 周围其他敌人法抗 +（不叠加）
  if (N('auraDefup.def')) ab.phalanx = { v: N('auraDefup.def'), r: o.range || 1.5 };           // 周围其他方阵战士防御 +（可叠加）
  if (N('Talent1.damage_resistance')) ab.auraDr = { v: N('Talent1.damage_resistance'), r: 1.7 }; // 半径 1.7 内所有敌人受到的伤害 ×0.75（可乘算叠加）
  if (N('takeDmg.damage_scale') != null) ab.share = { v: N('takeDmg.damage_scale'), r: N('takeDmg.range_radius') || 1.7 };   // 圣杯：周围地面敌人只受 5%，其余由自身以真实伤害承担
  if (N('def_reduce.max_stack_cnt')) { const m = N('def_reduce.max_stack_cnt'); ab.defStack = { def: N('def_reduce.def') / m, res: N('def_reduce.magic_resistance') / m, max: m }; }
  if (N('Shield.max_block_damage_cnt')) ab.shield = N('Shield.max_block_damage_cnt');             // 抵挡若干次物理/法术伤害
  if (N('Revive[Trigger].prop_max_hp')) ab.ember = { hits: N('Revive[Trigger].prop_max_hp'), t: N('Revive[Trigger].interval'),
    shield: N('Aura.max_damage_block_cnt') || 0, r: 1.8, hide: !N('Aura.max_damage_block_cnt'), unblk: !!N('Aura.max_damage_block_cnt') };
  if (N('stone.def')) ab.stone = { def: N('stone.def'), res: N('stone.magic_resistance') || 0, t: N('stone.duration') || 10 };
  if (N('Refracting.max_hp')) ab.hpMul = 1 + N('Refracting.max_hp');
  if (sk1('InvisibleShield')) { const s = sk1('InvisibleShield'); ab.hideAura = { cd: s.cooldown, init: s.initCooldown, t: N('InvisibleShield.duration') || 3, r: o.range || 2 }; }
  if (sk1('SummonToken')) { const s = sbb(sk1('SummonToken')); ab.summon = { key: s.enemy_key, n: +s.cnt || 1, cd: sk1('SummonToken').cooldown, init: sk1('SummonToken').initCooldown }; }
  if (key.startsWith('enemy_1436_dsdivi')) ab.halfSplit = { key, ratio: N('0.hp_ratio') || 0.5 };   // 生命首次低于一半时分裂出一只同生命比例的
  if (bb['Aura.enemy_key'] && N('Aura.range_radius')) ab.parasite = { key: bb['Aura.enemy_key'], r: N('Aura.range_radius') };   // 周围敌人倒下时召唤
  if (bb['0.enemy_1']) { const p1 = N('0.prob1'), p2 = N('0.prob2'); ab.feeder = { opts: [[bb['0.enemy_1'], p1], [bb['0.enemy_2'], p2], [bb['0.enemy_3'], Math.max(0, 1 - p1 - p2)]], spd: N('0.move_speed') || 2 }; }
  if (N('DeadSpawn.cnt_add')) ab.blades = { n: N('DeadSpawn.cnt'), atk: N('Atkup.atk') || 0 };   // 沉沙：每次攻击消耗 1 个断刃
  if (N('confinement.times')) ab.prison = { times: N('confinement.times'), aspd: N('confinement.attack_speed') || 0, def: N('confinement.def') || 0,
    atk: N('liberty.atk') || 0, pen: N('liberty.def_penetrate') || 0, res: N('liberty.magic_resistance') || 0, regen: N('liberty.hp_recovery_per_sec') || 0, all: /解放全场敌人/.test(txt0) };
  // ── 对干员的削弱 ──
  if (N('atkSpeedDown.attack_speed')) { const mul = 1 + N('atkSpeedDown.attack_speed');
    if (/被阻挡时/.test(txt0)) ab.blkAspd = mul; else ab.aspdAura = { mul, r: N('defup.range_radius') || o.range || 2.5 }; }   // 攻击速度直接乘算（不可叠加）
  if (N('traitAbility.attack_speed')) ab.guardAspd = { v: N('traitAbility.attack_speed'), r: N('traitAbility.range_radius') || 1.1, near: 'enemy_1175', nr: 1.4 };
  if (N('traitAbility.base_attack_time')) ab.shadowBat = { v: N('traitAbility.base_attack_time'), near: 'enemy_1174', nr: 1.4 };
  if (sk1('Roar')) { const s = sbb(sk1('Roar')); ab.roar = { aspd: +s.attack_speed, t: +s.duration, cd: sk1('Roar').cooldown, init: sk1('Roar').initCooldown }; }
  if (sk1('AtkDesWeaken')) { const s = sbb(sk1('AtkDesWeaken')); ab.weaken = { mul: 1 + +s.atk, t: +s.duration, cd: sk1('AtkDesWeaken').cooldown, init: sk1('AtkDesWeaken').initCooldown }; }
  if (N('refracting.attack_speed')) ab.hitAspd = { v: N('refracting.attack_speed'), t: N('refracting.duration'), magic: 1, refresh: 1 };
  if (N('Summon.attack_speed')) ab.hitAspd = { v: N('Summon.attack_speed'), t: N('Summon.duration'), magic: 0, refresh: 0 };
  if (N('Aura.block_cnt')) ab.blkDown = { v: -N('Aura.block_cnt'), r: N('Aura.range_radius') };
  if (sk1('stuncombat')) { const s = sk1('stuncombat'); ab.stunHit = { every: (s.spCost || 2) + 1, t: +sbb(s).stun }; }
  if (sk1('StunAttack')) { const s = sk1('StunAttack'); ab.stunHit = { every: (s.spCost || 3) + 1, t: +sbb(s).stun, r: 1, scale: 1 }; }
  if (sk1('CrossAttack') && sbb(sk1('CrossAttack')).stun) { const s = sk1('CrossAttack'); ab.cross = { cd: s.cooldown, init: s.initCooldown, t: +sbb(s).stun, scale: +sbb(s).atk_scale || 1 }; }
  if (N('shotbuff.attack@headshot_disarmed_duration')) ab.disarm = { t: N('shotbuff.attack@headshot_disarmed_duration'), scale: N('shotbuff.attack@headshot_atk_scale') || 1, ammo: 1 };
  // ── 移动 ──
  if (N('SelfFear.fear')) ab.fear = { t: N('SelfFear.fear'), spd: N('SelfFear.move_speed') || 1.5 };
  if (bb['rush.dlancer_t[trigger].move_speed']) ab.rush = { per: N('rush.dlancer_t[trigger].interval'), v: N('rush.dlancer_t[trigger].move_speed'), n: N('rush.dlancer_t[trigger].trig_cnt'), pre: 0, hit: N('firstattack.atk_scale') };
  if (bb['Rush.mhboar_t[trigger].move_speed']) ab.rush = { per: N('Rush.mhboar_t[trigger].interval'), v: N('Rush.mhboar_t[trigger].move_speed'), n: N('Rush.mhboar_t[trigger].trig_cnt'), pre: N('Rush.mhboar_t_predelay.predelay') || 0, hit: N('FirstAttack.atk_scale'), crash: N('Crash.atk_scale') };
  if (key.startsWith('enemy_1439_dslntf')) ab.wake = { spd: 1 + (N('0.move_speed') || 4), r: N('1.range_radius') || 2.5 };   // 受到伤害后移动速度 +400%
  if (sk1('boomb')) ab.bomber = { spd: +sbb(sk1('boomb')).move_speed || 2, r: o.range || 2, scale: 1 };
  if (N('Light.move_speed')) ab.grenade = { spd: N('Light.move_speed'), scale: +sbb(sk1('Bomb')).atk_scale || 2, r: +sbb(sk1('Bomb')).projectile_range || 1.1 };
  // ── 攻击（只影响干员受击） ──
  if (key.startsWith('enemy_1161_tidmag')) ab.splash = { r: 1, cross: 1, scale: 1 };   // 目标及周围四格
  if (key.startsWith('enemy_1427_lrnazg')) ab.splash = { all: 1, scale: 1 };                       // 攻击范围内所有单位
  if (N('shotbuff.attack@headshot_trapdamage') && !ab.disarm) ab.ammoSplash = { ammo: 2, r: 1.5, scale: N('shotbuff.attack@headshot_atk_scale') || 1 };   // 3×3
  if (N('shotbuff.attack@headshot_atk_scale') && !ab.disarm && !ab.ammoSplash) ab.ammoHit = { ammo: 1, scale: N('shotbuff.attack@headshot_atk_scale') };
  if (N('FirstAttack.attack@first_atk_scale')) ab.firstSplash = { r: 1, cross: 1, scale: N('FirstAttack.attack@first_atk_scale'), dt: 'm' };
  if (sk1('AOEAttack')) ab.firstSplash = { r: 1.5, scale: +sbb(sk1('AOEAttack')).atk_scale || 1.5, dt: 'p', main: 1 };
  if (N('Attack.attack@projectile_radius')) ab.lob = { r: N('Attack.attack@projectile_radius'), delay: N('Attack.attack@projectile_delay_time') || 0 };
  if (N('epdamage.attack@max_target')) ab.chain = { n: N('epdamage.attack@max_target'), dec: N('epdamage.attack@chain.atk_scale') || 0.85, r: N('epdamage.attack@projectile_range') || 1.6 };
  if (N('Empty.attack@chuang_atk_scale')) ab.blkMul = N('Empty.attack@chuang_atk_scale');        // 被阻挡时攻击力 200%
  if (sk1('InvisibleCombat') && +sbb(sk1('InvisibleCombat')).atk_scale) ab.ambush = +sbb(sk1('InvisibleCombat')).atk_scale;   // 隐匿生效后下一次攻击
  if (sk1('PowerHit')) ab.charge = 1 + (+sbb(sk1('PowerHit')).atk || 0);                           // 入场/解除阻挡后首次攻击
  if (N('CriticalHit.damage_scale')) ab.crit = { v: N('CriticalHit.damage_scale'), noHeal: N('CriticalHit.duration') };
  if (N('DamageUp.scale_ratio')) ab.leech = { per: N('DamageUp.scale_ratio'), heal: N('vampire.heal_scale') || 0 };
  if (N('Bleeding.attack@bleeding_damage')) ab.bleed = { v: N('Bleeding.attack@bleeding_damage'), t: N('Bleeding.attack@duration') };
  if (key.startsWith('enemy_1234_dsubrl')) ab.burn = { scale: 1, r: o.range || 1.6 };               // 范围内所有干员每秒受到攻击力 100% 的法术伤害
  if (N('enhance.max_stack_cnt')) ab.rage = { atk: N('enhance.atk'), aspd: N('enhance.attack_speed'), max: N('enhance.max_stack_cnt') };
  if (N('aura.max_valid_stack_cnt') && N('aura.atk')) ab.hate = { atk: N('aura.atk'), max: N('aura.max_valid_stack_cnt') };   // 场上每有 1 个重生造物攻击力提升
  if (N('atkboostCore.atk')) ab.horn = { v: N('atkboostCore.atk'), max: N('atkboostCore.max_stack_count') };
  if (N('Expose.damage_scale')) ab.expose = { v: N('Expose.damage_scale'), t: N('Expose.weak[limit]'), r: N('Expose.range_radius') || 0, death: !!N('Expose.range_radius') };
  // 死亡爆炸 / 死亡后留下的区域
  if (N('boom.atk_scale') && !key.startsWith('enemy_10065')) ab.boom = { r: 1.65, scale: N('boom.atk_scale'), dt: key.startsWith('enemy_1191') ? 'm' : 'p', delay: key.startsWith('enemy_1191') ? 1.2 : 1 };
  if (N('Boom.atk_scale') && key.startsWith('enemy_1424')) ab.boom = { r: 1.3, scale: N('Boom.atk_scale'), dt: 'p', delay: 1 };
  if (N('Boom.atk_scale') && key.startsWith('enemy_1385')) ab.boom = { r: 1.55, scale: N('Boom.atk_scale'), dt: 'm', delay: 0 };
  if (N('PollutedDie.polluted_damage_low')) ab.pollute = { v: N('PollutedDie.polluted_damage_low'), t: N('PollutedDie.projectile_life_time'), r: N('PollutedDie.projectile_range') };
  if (key.startsWith('enemy_9006_actoxi')) ab.poison = { scale: N('1.damage_atk_scale'), t: N('1.projectile_life_time'), r: N('1.projectile_range') };
  // ── 领袖 ──
  if (key.startsWith('enemy_9013_acstmk')) ab.lowDr = { hp: N('1.hp_ratio'), v: 1 - N('1.damage_scale') };
  if (key.startsWith('enemy_9033_acdeer')) ab.lowDr = { hp: 0.5, v: N('Madness.damage_resistance') };
  if (key.startsWith('enemy_9032_aclionk')) ab.lowUp = { hp: N('advance.hp_ratio'), defMul: 1 + N('advance.def'), res: N('advance.magic_resistance') };
  if (key.startsWith('enemy_9021_acduml')) ab.lowDodge = { hp: 0.5, v: 0.1 };
  if (key.startsWith('enemy_9037_aceel')) { const s = sbb(sk1('ShieldGen')); ab.drUnblk = +s.damage_resistance; }
  if (key.startsWith('enemy_2124_dyjsfg')) ab.drMove = { move: N('Huge.enemy_dyjsfg_high_damage_resistance.damage_resistance'), stop: N('Huge.enemy_dyjsfg_low_damage_resistance.damage_resistance') };
  if (key.startsWith('enemy_9035_acspider')) ab.evade = { step: N('Evade.hp_ratio'), p: N('Evade.prob'), t: N('Evade.duration') };
  if (Object.keys(ab).length) o.ab = ab;
  for (const k of [ab.split && ab.split.key, ab.summon && ab.summon.key, ab.parasite && ab.parasite.key].concat(ab.feeder ? ab.feeder.opts.map(x => x[0]) : [])) if (k && edb.find(x => x.Key === k)) enemy(k);
}

// ── 回合 ──────────────────────────────────────────────
// 普通回合：0–3 行就是场地；领袖回合：关卡第 1–4 行是场地，所以行号减 1。
function round(name, boss) {
  const L = LV(name), dr = boss ? -1 : 0;
  const P = p => [Math.max(0, p.row + dr), p.col];
  const routes = L.routes.map(r => ({ fly: r.motionMode === 'FLY', s: P(r.startPosition), e: P(r.endPosition),
    // MOVE：走到该点；PATROL_MOVE：之后在这些点之间来回巡逻，不再走向终点；WAIT_FOR_SECONDS：原地等待
    cp: r.checkpoints.map(c => c.type === 'MOVE' ? { m: P(c.position) } : c.type === 'PATROL_MOVE' ? { pm: P(c.position) } : c.type === 'WAIT_FOR_SECONDS' ? { w: c.time } : { o: c.type }) }));
  const spawns = []; const packs = {};
  for (const w of L.waves) { let t0 = w.preDelay || 0;
    for (const fr of w.fragments) { const tf = t0 + (fr.preDelay || 0);
      for (const a of fr.actions) {
        if (a.actionType !== 'SPAWN' || !a.key || a.hiddenGroup) continue;
        // 随机出怪组：固定取编号最小的那一组，结果可重复
        if (a.randomSpawnGroupKey) { const g = a.randomSpawnGroupKey, p = a.randomSpawnGroupPackKey || '';
          if (packs[g] == null || p < packs[g]) packs[g] = p; }
        enemy(a.key);
        spawns.push({ t: tf + (a.preDelay || 0), key: a.key, n: a.count, iv: a.interval || 0, route: a.routeIndex, g: a.randomSpawnGroupKey || null, p: a.randomSpawnGroupPackKey || '' });
      } } }
  const sp = spawns.filter(s => !s.g || s.p === packs[s.g]).map(({ g, p, ...s }) => s).sort((a, b) => a.t - b.t);
  return { T: L.options.maxPlayTime, routes, spawns: sp, mul: L.options.moveMultiplier ?? 0.5 };
}
// ── 特训敌人 ──────────────────────────────────────────
// 官方：每局随机若干种特训类型（联机 3 种、单人 2 种），每种占若干回合（联机 3 个、单人 4 个），其余回合是“特异”。
// 每回合出怪表里的占位敌人按该回合抽到的特训敌人替换（规则见 sganggs/Stronghold-Protocol 的 docs/DATA.md §10，
// 据其说明解自游戏客户端 RandomEnemyGenerater）。
const types = Object.values(acd.enemyTypeDatas).sort((a, b) => a.typeIdentifier - b.typeIdentifier).map(t => {
  const r = act.specialEnemyRandomTypeDict[t.type] || {};
  return { id: t.type, name: t.name.replace('特训敌人·', ''), desc: t.description, random: !!t.involveRandom, count: r.count, countSingle: r.countSingle, show: r.showEnemyId };
});
const entries = Object.values(act.specialEnemyInfoDict).map(s => {
  enemy(s.specialEnemyKey); s.attachedNormalEnemyKeys.forEach(enemy); s.attachedEliteEnemyKeys.forEach(enemy);
  return { key: s.specialEnemyKey, type: s.type, w: s.randomWeight, first: s.isInFirstHalf, N: s.attachedNormalEnemyKeys, E: s.attachedEliteEnemyKeys };
});
types.forEach(t => { if (t.show) enemy(t.show); });
const special = { types, entries, firstHalfMaxRound: 7, minN: 1, maxN: 5, minIv: 0.05,
  // 出怪表里的占位敌人：N/E/S 地面普通/精英/特殊，NF/EF/SF 空中
  slots: { enemy_1422_lrsldr: 'N', enemy_1427_lrnazg: 'E', enemy_1425_lrcmra: 'S', enemy_1005_yokai: 'NF', enemy_1042_frostd: 'EF', enemy_1040_bombd: 'SF' } };

const bd = act.battleDataDict.mode_multi_abyss;
const rounds = [];
for (let r = 1; r <= 13; r++) { const l = bd[r][0].levelId.split('/').pop(); rounds.push(Object.assign({ n: r, lv: l.replace('level_act3autochess_', '') }, round(l, false))); }
const bosses = [];
for (const r of [14, 15]) for (const x of bd[r]) {
  const l = x.levelId.split('/').pop() + '_s', R = round(l, true);
  const bk = R.spawns.map(s => s.key).find(k => enemies[k].type === 'BOSS');
  const info = act.bossInfoDict[x.bossId];
  bosses.push(Object.assign({ id: x.bossId, round: r, lv: l.replace('level_act3autochess_', ''), key: bk, name: enemies[bk].name, blood: info.bloodDataDict }, R));
}

// ── 难度 ──────────────────────────────────────────────
// 联机四档 + 单人规程等级。scale：每回合普通敌人的 [攻击, 生命, 移速] 倍率（研究整理）
const modeIds = ['mode_multi_funny', 'mode_multi_normal', 'mode_multi_hard', 'mode_multi_abyss', 'mode_single_funny'].concat([...Array(20)].map((_, i) => 'mode_single_' + (i + 1)));
const modes = modeIds.filter(id => act.modeDataDict[id] && SCALE.modes[id]).map(id => {
  const M = act.modeDataDict[id];
  return { id, name: M.name, single: M.modeType !== 'MULTI', factor: M.factor, scale: SCALE.modes[id].scale, inactive: M.inactiveEnemyKey || [] };
});

// ── 干员：攻击范围、阻挡数 ────────────────────────────
const ops = {};
const ranges = {};
const useRange = id => { if (!id || ranges[id]) return; const R = rg[id]; if (!R) return; ranges[id] = R.grids.map(g => [g.row, g.col]); };
for (const s of Object.values(act.charShopChessDatas)) {
  const c = CH(s.charId); if (!c) continue;
  const o = { cid: s.charId, rng: [], blk: [], sk: [], hp: [], df: [], res: [], rsp: [], bat: [] };
  [s.chessId, s.goldenChessId].forEach((id, k) => {
    const q = act.charChessDataDict[id].status, pi = +String(q.evolvePhase).slice(-1), ph = c.phases[pi];
    o.rng[k] = ph.rangeId; useRange(ph.rangeId);
    // 生命、防御、法抗、再部署时间、攻击间隔：按模式内的等级在两个关键帧之间插值，再加上模组属性（干员受击与治疗用）
    { const K = ph.attributesKeyFrames, lo = K[0], hi = K[K.length - 1], t = hi.level > lo.level ? (q.charLevel - lo.level) / (hi.level - lo.level) : 0;
      const at = x => lo.data[x] + (hi.data[x] - lo.data[x]) * Math.max(0, Math.min(1, t));
      const add = { max_hp: 0, def: 0, magic_resistance: 0 };
      if (s.defaultUniEquipId && q.equipLevel > 0 && be[s.defaultUniEquipId]) for (const b of be[s.defaultUniEquipId].phases[q.equipLevel - 1].attributeBlackboard) if (b.key in add) add[b.key] += b.value;
      o.hp[k] = Math.round(at('maxHp') + add.max_hp); o.df[k] = Math.round(at('def') + add.def); o.res[k] = +(at('magicResistance') + add.magic_resistance).toFixed(1);
      o.rsp[k] = lo.data.respawnTime; o.bat[k] = lo.data.baseAttackTime; }
    const a = ph.attributesKeyFrames[0].data, b = ph.attributesKeyFrames[1].data; o.blk[k] = a.blockCnt === b.blockCnt ? a.blockCnt : (q.charLevel >= ph.attributesKeyFrames[1].level ? b.blockCnt : a.blockCnt);
    c.skills.forEach((x, i) => { const S = sk[x.skillId]; if (!S) return; const L = S.levels[Math.min(S.levels.length - 1, q.skillLevel - 1)];
      (o.sk[i] = o.sk[i] || [null, null])[k] = L.rangeId || null; useRange(L.rangeId); });
  });
  o.def = s.defaultSkillIndex;
  ops[c.name] = o;
}

// 技能触发方案里用到的特定范围（PRTS 卫戍协议/帮助 §技能操作 特殊技能方案）
for (const id of ['6-1', 'x-4', '3-15', 'x-2', '3-18', '2-4', '3-2', '2-2']) useRange(id);

// 盟约激活需要的在场人数
const bonds = {}; for (const b of Object.values(act.bondInfoDict)) bonds[b.name] = b.activeCount;

const out = { maps, rounds, bosses, modes, enemies, ops, ranges, bonds, special };
const js = '// 由 tools/extract.js 生成，不要手改。数据来源：PRTS 整理的游戏数据（卫戍协议·规程 序列 I）。\nconst FIELD = ' + JSON.stringify(out) + ';\n';
fs.writeFileSync(path.join(__dirname, '..', 'src', 'field.js'), js);
console.log('maps', maps.length, 'rounds', rounds.length, 'bosses', bosses.length, 'enemies', Object.keys(enemies).length, 'ops', Object.keys(ops).length, 'ranges', Object.keys(ranges).length, 'bytes', js.length);
