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
    type: gd('levelType') || 'NORMAL', lp: gd('lifePointReduce') ?? 1, range: gd('rangeRadius') };
  // 替换数量公式要用的“属性强度”和“战斗效能系数”（官方 randomEnemyAttributeDict）
  o.P = (g('atk') || 0) * 5 + (g('maxHp') || 0) + (g('def') || 0) * 3 + (g('magicResistance') || 0) * 3;
  const ra = acd.randomEnemyAttributeDict[key]; o.bef = ra ? ra.enemyBattleEffectivenessFactor : 1;
  // 伤害类型（图鉴）：p 物理、m 法术、n 不造成伤害；物理和法术都有时按物理
  const dt = (hb[key] && hb[key].damageType) || ['PHYSIC'];
  o.dt = dt.includes('PHYSIC') ? 'p' : dt.includes('MAGIC') ? 'm' : 'n';
  // 图鉴里的能力说明
  const h = hb[key]; if (h && h.abilityList && h.abilityList.length) o.abt = h.abilityList.map(a => String(a.text || '').replace(/<[^>]+>/g, '')).filter(Boolean);
  // 能建模的能力
  const ab = {};
  if (skills.includes('InvisibleCombat')) ab.camo = 1;
  if (bb['refracting.magic_resistance']) ab.refract = +bb['refracting.magic_resistance'];
  if (bb['DeadSpawn.enemy_key']) ab.split = { key: bb['DeadSpawn.enemy_key'], n: +bb['DeadSpawn.cnt'] || 1, delay: 0 };
  if (bb['deathrattle.enemy_key']) ab.split = { key: bb['deathrattle.enemy_key'], n: 1, delay: +bb['deathrattle.delay'] || 0 };
  if (bb['reborn.duration'] != null) ab.reborn = +bb['reborn.duration'];
  // 图鉴写明的：需要 N 次伤害击倒（每次受到伤害只算 1 点）、无法被阻挡
  const txt = (o.abt || []).join('；'), mh = txt.match(/需要(d+)次伤害击倒/);
  if (mh) ab.hits = +mh[1];
  if (/无法被阻挡/.test(txt)) ab.unblock = 1;
  if (Object.keys(ab).length) o.ab = ab;
  if (ab.split) enemy(ab.split.key);
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
