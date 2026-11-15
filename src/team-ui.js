// 队伍模拟页面：选地图和回合、在格子上摆放干员、看回放和每人的输出
(function(){
  const U=window.__ui; if(!U||typeof teamRun!=='function') return;
  const {st,ava,selOf,defName,fmt}=U;
  const $=id=>document.getElementById(id);
  const byId=id=>OPS.find(o=>o.id===id);
  const STORE='weishu.team.v1';
  const TS={map:0,round:'r5',mode:3,tok:{},members:[],L:{},subL:{},cold:50,xAtk:0,xAspd:0,stunt:0,pick:null,sel:null,fi:0,filter:'',q:'',routes:true,real:true};
  // 第一次打开时放一套示例阵容（战场 #01、第 5 回合），之后记住自己的摆放
  let saved=null; try{ saved=JSON.parse(localStorage.getItem(STORE)||'null'); }catch(e){}
  if(saved) for(const k of ['map','round','mode','tok','members','L','subL','cold','xAtk','xAspd','stunt','routes','real']){ if(k in saved) TS[k]=saved[k]; }
  else TS.members=[{id:'indigo',r:3,c:4},{id:'bluep',r:2,c:6},{id:'thorn2',r:1,c:6},{id:'thorns',r:0,c:1},{id:'irene',r:3,c:2}];
  TS.members=(TS.members||[]).filter(m=>byId(m.id));
  const save=()=>{ try{ const o={}; for(const k of ['map','round','mode','tok','members','L','subL','cold','xAtk','xAspd','stunt','routes','real']) o[k]=TS[k]; localStorage.setItem(STORE,JSON.stringify(o)); }catch(e){} };
  const MAXN=8;
  const curMap=()=>FIELD.maps[TS.map]||FIELD.maps[0];
  const curBoss=()=>TS.round.startsWith('b:')?FIELD.bosses.find(b=>b.id===TS.round.slice(2)):null;
  const curRound=()=>curBoss()||FIELD.rounds[(+TS.round.slice(1)||1)-1];
  const board=()=>teamBoard(curMap(),!!curBoss(),TS.tok);
  const memberAt=(r,c)=>TS.members.find(m=>m.r===r&&m.c===c);
  const coreName=c=>CORE[c].name;
  const isRanged=o=>!!o.r;
  let res=null, timer=0, playT=0;
  function canPlace(op,r,c){ const d=board().deploy(r,c); return d===1||(d===2&&isRanged(op)); }

  // ── 运行 ──
  function setup(trace){
    const members=TS.members.filter(m=>canPlace(byId(m.id),m.r,m.c)).map(m=>{ const op=byId(m.id); return {op,elite:!!st.elite[op.id],sel:selOf(op),r:m.r,c:m.c}; });
    const base=Object.assign({},st.cp,{own:0,xAtk:+TS.xAtk||0,xAspd:+TS.xAspd||0,stunt:+TS.stunt||0,cold:+TS.cold||0,devour:0,eBat:0});
    const L={}; for(const c in CORE) if(!CORE[c].none) L[c]=TS.L[c]??150;
    const subL={}; for(const s in SUBS) subL[s]=TS.subL[s]??50;
    return {map:curMap(),round:curBoss()?null:curRound(),boss:curBoss(),mode:FIELD.modes[TS.mode],tok:TS.tok,members,L,subL,base,trace};
  }
  function run(){ clearTimeout(timer); timer=setTimeout(()=>{ stop(); res=TS.members.some(m=>canPlace(byId(m.id),m.r,m.c))?teamRun(setup(true)):null; TS.fi=0; render(); save(); },30); }

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
    const unit=(m,r,c)=>{ const op=byId(m.id), ai=agIdx.get(r+','+c), on=fr&&ai!=null&&fr.ag[ai]&&fr.ag[ai][0];
      const eat=res&&res.res.find(x=>x.m.r===r&&x.m.c===c&&x.eaten&&x.eaten.dead);
      return {op,cls:'pc'+(on?' on':'')+(eat?' gone':'')+(sel&&sel.r===r&&sel.c===c?' sel':'')+(canPlace(op,r,c)?'':' bad')}; };
    let h='';
    for(let r=TEAM.H-1;r>=0;r--) for(let c=0;c<TEAM.W;c++){
      const cell=B.cell[r][c], m=memberAt(r,c), dep=B.deploy(r,c);
      const can=pick?(dep===1||(dep===2&&isRanged(pick))):false;
      const cls=['tc','t-'+(TILECLS[cell.ch]||'void')];
      if(dep) cls.push('dep'); if(cell.obs) cls.push('o-'+cell.obs); if(cell.opt) cls.push('opt');
      if(rng.has(r+','+c)) cls.push('inr'); if(can&&!m) cls.push('can');
      if(sel&&sel.r===r&&sel.c===c) cls.push('sel');
      let inner='';
      if(!SG){
        if(m){ const u=unit(m,r,c); inner=`<span class="${u.cls}">${ava(u.op)}</span>`; }
        else if(cell.obs==='crate') inner='<span class="ob" title="阻隔工事：敌人绕行，不能部署">▦</span>';
        else if(cell.obs==='plat') inner='<span class="ob" title="射击台：敌人不能通行，只能部署远程干员">▲</span>';
        else if(cell.ch==='S'||cell.ch==='T') inner='<span class="mk">入</span>';
        else if(cell.ch==='E') inner='<span class="mk">出</span>';
      } else if(cell.opt&&!m) inner=`<span class="optk">${cell.obs==='crate'?'工事':cell.obs==='plat'?'射击台':'空'}</span>`;
      const tip=(cell.obs==='crate'?'阻隔工事':cell.obs==='plat'?'射击台（仅远程）':(TEAM.TILE_NAME[cell.ch]||''))+(cell.opt?'（随机障碍位：点击切换）':'');
      h+=`<button type="button" class="${cls.join(' ')}" data-r="${r}" data-c="${c}" title="${tip}" aria-label="第 ${TEAM.H-r} 行第 ${c+1} 列 ${tip}${m?' '+byId(m.id).name:''}">${inner}</button>`;
    }
    const routes=[]; if(TS.routes&&(!fr||TS.fi===0)){ const R=curRound(), seen=new Set();
      for(const rt of R.routes){ const t=teamRoute(B,rt), key=JSON.stringify(t.line.map(p=>p.p)); if(seen.has(key))continue; seen.add(key); routes.push({fly:rt.fly,pts:t.line.map(p=>p.p)}); } }
    const meta=res?new Map(res.enemies.map(e=>[e.uid,e])):null;
    const box=$('tBoard');
    if(SG){
      // 实景：截图 + 透视格子 + 正立的头像与敌人
      let ov=`<svg class="routes" viewBox="0 0 ${SG.W} ${SG.H}" aria-hidden="true">`;
      for(const rt of routes) ov+=`<polyline points="${rt.pts.map(p=>SG.at(p[1],p[0]).map(v=>v.toFixed(1)).join(',')).join(' ')}" class="${rt.fly?'fly':'gnd'}"/>`;
      ov+='</svg>';
      const units=[]; for(const m of TS.members){ const u=unit(m,m.r,m.c), p=SG.at(m.c,m.r), w=SG.cw(m.c,m.r)*0.74; units.push({y:p[1],html:`<span class="su ${u.cls}" style="left:${p[0].toFixed(1)}px;top:${p[1].toFixed(1)}px;width:${w.toFixed(1)}px;height:${w.toFixed(1)}px">${ava(u.op)}</span>`}); }
      if(fr) for(const [uid,y,x,hp,bl] of fr.en){ const e=meta.get(uid)||{}, p=SG.at(x,y), w=SG.cw(Math.max(0,Math.min(8,x)),Math.max(0,Math.min(3,y)))*(e.boss?0.42:0.24);
        units.push({y:p[1]+0.1,html:`<span class="foe sf${e.fly?' fly':''}${e.boss?' boss':''}${bl?' bl':''}" style="left:${p[0].toFixed(1)}px;top:${p[1].toFixed(1)}px;width:${w.toFixed(1)}px" title="${e.name||''} ${Math.round(hp*100)}%"><i style="width:${(hp*100).toFixed(0)}%"></i></span>`}); }
      units.sort((a,b)=>a.y-b.y);   // 远的先画，近的盖在上面
      box.className='stagebox'+(pick?' arming':'');
      box.innerHTML=`<div class="stage" data-w="${SG.W}" data-h="${SG.H}" style="width:${SG.W}px;height:${SG.H}px"><img src="${SG.img}" alt="${curMap().name} 游戏内截图" width="${SG.W}" height="${SG.H}"><div class="sgrid" style="width:${GW}px;height:${GH}px;transform:${SG.m3}">${h}</div><div class="sov">${ov}${units.map(u=>u.html).join('')}</div></div>`;
      fitStage();
    } else {
      const X=c=>((c+0.5)/TEAM.W*100), Y=r=>((TEAM.H-1-r+0.5)/TEAM.H*100);
      let ov='';
      if(routes.length){ ov+='<svg class="routes" viewBox="0 0 900 400" preserveAspectRatio="none" aria-hidden="true">';
        for(const rt of routes) ov+=`<polyline points="${rt.pts.map(p=>(X(p[1])*9).toFixed(0)+','+(Y(p[0])*4).toFixed(0)).join(' ')}" class="${rt.fly?'fly':'gnd'}"/>`; ov+='</svg>'; }
      if(fr) for(const [uid,y,x,hp,bl] of fr.en){ const e=meta.get(uid)||{};
        ov+=`<span class="foe${e.fly?' fly':''}${e.boss?' boss':''}${bl?' bl':''}" style="left:${X(x).toFixed(2)}%;top:${Y(y).toFixed(2)}%" title="${e.name||''} ${Math.round(hp*100)}%"><i style="width:${(hp*100).toFixed(0)}%"></i></span>`; }
      box.className='board'+(pick?' arming':''); box.style.height='';
      box.innerHTML=h+`<div class="ov">${ov}</div>`;
    }
    $('tViewMode').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',(b.dataset.real==='1')===!!SG));
    $('tStageCap').textContent=`战场 ${curMap().name} · ${curBoss()?'第 '+curBoss().round+' 回合 · '+curBoss().name:'第 '+curRound().n+' 回合'} · ${FIELD.modes[TS.mode].name}`;
  }
  function renderSide(){
    const MI=(typeof MAP_IMG!=='undefined')?MAP_IMG:{};
    $('tMap').innerHTML=FIELD.maps.map((m,i)=>`<button type="button" class="mthumb" data-map="${i}" aria-pressed="${i===TS.map}" title="战场 ${m.name}">${MI[m.id+'_1']?`<img src="${MI[m.id+'_1']}" alt="" width="780" height="360">`:''}<span>${m.name}</span></button>`).join('');
    const ro=FIELD.rounds.map(r=>`<option value="r${r.n}"${TS.round==='r'+r.n?' selected':''}>第 ${r.n} 回合 · ${r.spawns.reduce((a,s)=>a+s.n,0)} 个敌人 · 限时 ${r.T} 秒</option>`).join('');
    const bo=[14,15].map(n=>`<optgroup label="第 ${n} 回合 · 领袖">${FIELD.bosses.filter(b=>b.round===n).map(b=>`<option value="b:${b.id}"${TS.round==='b:'+b.id?' selected':''}>${b.name}</option>`).join('')}</optgroup>`).join('');
    $('tRound').innerHTML=`<optgroup label="普通回合">${ro}</optgroup>${bo}`;
    document.querySelectorAll('#tMode button').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.m===TS.mode));
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
      k+=`<div class="kpi"><b>${res.leakedN?'漏 '+res.leakedN:left?'未清完':'清场'}</b><small>${[res.leakedN?'扣 '+res.leaked+' 生命':'',left?'时间到还剩 '+left+' 个':'',!res.leakedN&&!left?'没有敌人漏过去':''].filter(Boolean).join('，')}</small></div>`;
      k+=`<div class="kpi"><b>${res.cleared?fmtT(res.dur):fmtT(res.dur)}</b><small>${res.cleared?'清场用时':'战斗时长'}（限时 ${res.T} 秒）</small></div>`;
    }
    const tot=res.res.reduce((a,x)=>a+x.total,0);
    k+=`<div class="kpi"><b>${res.killed}<small class="muted"> / ${res.total}</small></b><small>击倒敌人</small></div>`;
    k+=`<div class="kpi"><b>${fmt(tot/Math.max(1,res.dur))}</b><small>全队每秒伤害</small></div>`;
    $('tKpis').innerHTML=k;
    const rows=res.res.slice().sort((a,b)=>b.total-a.total), max=Math.max(1,...rows.map(x=>x.total));
    $('tList').innerHTML=rows.map((x,i)=>{ const o=x.m.op, tags=[];
      if(x.healer) tags.push('<span class="tag">治疗位，不造成伤害</span>');
      if(x.dv) tags.push(`<span class="tag eq">吞噬身前干员 · 基础攻击 +${x.dv.atk}</span>`);
      if(x.eaten) tags.push(`<span class="tag eq">被吞噬 · ${x.eaten.dead?'阵亡':x.eaten.alive?'存活':'复活'}</span>`);
      const sk=U.skillLabel(o,st.elite[o.id]?1:0); if(sk&&!x.healer) tags.push(`<span class="tag">${sk}</span>`);
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
      <div class="btnrow"><button type="button" class="btn" data-tdel="1">撤下</button><span class="hint">要移动：选中后点另一个空格子；点另一名干员则互换位置。</span></div>`;
  }
  function render(){ renderSide(); renderBoard(); renderPalette(); renderResults(); renderEditor(); }

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
  $('tRound').addEventListener('change',e=>{ TS.round=e.target.value; run(); });
  $('tMode').addEventListener('click',e=>{ const b=e.target.closest('[data-m]'); if(!b)return; TS.mode=+b.dataset.m; run(); });
  $('tBonds').addEventListener('input',e=>{ const t=e.target; const v=Math.max(0,parseFloat(t.value)||0); if(t.dataset.tl)TS.L[t.dataset.tl]=v; if(t.dataset.ts)TS.subL[t.dataset.ts]=v; clearTimeout(timer); timer=setTimeout(()=>{ res=teamRun(setup(true)); TS.fi=0; renderBoard(); renderResults(); save(); },150); });
  for(const id of ['cold','xAtk','xAspd','stunt']) $('t-'+id).addEventListener('input',e=>{ TS[id]=parseFloat(e.target.value)||0; run(); });
  $('tRoutes').addEventListener('input',e=>{ TS.routes=e.target.checked; renderBoard(); save(); });
  $('tViewMode').addEventListener('click',e=>{ const b=e.target.closest('[data-real]'); if(!b)return; TS.real=b.dataset.real==='1'; renderBoard(); save(); });
  if(window.ResizeObserver) new ResizeObserver(()=>fitStage()).observe($('tBoard')); else window.addEventListener('resize',fitStage);
  $('tClear').addEventListener('click',()=>{ TS.members=[]; TS.sel=null; TS.pick=null; run(); });
  $('tList').addEventListener('click',e=>{ const c=e.target.closest('[data-cell]'); if(!c)return; const [r,cc]=c.dataset.cell.split(',').map(Number); TS.sel=[r,cc]; render(); });
  $('tEdit').addEventListener('click',e=>{ const m=TS.sel&&memberAt(TS.sel[0],TS.sel[1]); if(!m)return; const o=byId(m.id);
    if(e.target.closest('[data-tel]')){ st.elite[o.id]=!st.elite[o.id]; U.update(); run(); return; }
    const s=e.target.closest('[data-tskill]'); if(s){ st.skill[o.id]=+s.dataset.tskill; U.update(); run(); return; }
    if(e.target.closest('[data-tdel]')){ TS.members=TS.members.filter(x=>x!==m); TS.sel=null; run(); } });
  $('tEdit').addEventListener('change',e=>{ const m=TS.sel&&memberAt(TS.sel[0],TS.sel[1]); if(!m)return; const o=byId(m.id), el=e.target, it=st.eq[o.id];
    if(el.dataset.teq!=null){ it[+el.dataset.teq]={id:el.value,adv:it[+el.dataset.teq].adv}; }
    else if(el.dataset.tadv!=null){ it[+el.dataset.tadv].adv=el.checked; }
    else if(el.dataset.tiso){ st.bond[o.id]=el.value; }
    U.update(); run(); });
  $('tSlider').addEventListener('input',e=>{ stop(); TS.fi=+e.target.value; renderBoard(); renderReplay(); });
  $('tPlay').addEventListener('click',()=>{ if(!res||!res.frames)return; if(playT){ stop(); renderReplay(); return; }
    if(TS.fi>=res.frames.length-1) TS.fi=0;
    playT=setInterval(()=>{ TS.fi++; if(TS.fi>=res.frames.length-1){ TS.fi=res.frames.length-1; stop(); } renderBoard(); renderReplay(); },100); renderReplay(); });
  // 页面切换
  const views={solo:$('soloView'),team:$('teamView')};
  $('views').addEventListener('click',e=>{ const b=e.target.closest('[data-view]'); if(!b)return; const v=b.dataset.view;
    for(const k in views) views[k].hidden=k!==v; document.querySelectorAll('#views button').forEach(x=>x.setAttribute('aria-pressed',x===b));
    try{ localStorage.setItem('weishu.view',v); }catch(err){}
    if(v==='team'){ run(); } else { stop(); U.update(); } });
  for(const id of ['cold','xAtk','xAspd','stunt']) $('t-'+id).value=TS[id];
  $('tRoutes').checked=!!TS.routes;
  let v0='solo'; try{ v0=localStorage.getItem('weishu.view')||'solo'; }catch(e){}
  if(v0==='team') document.querySelector('#views [data-view="team"]').click(); else render();
})();
