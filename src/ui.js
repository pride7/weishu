(function(){
  // 数字和英文小标题用的窄体字；加载失败时退回系统字体，不影响使用
  try{const l=document.createElement('link');l.rel='stylesheet';l.href='https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&display=swap';document.head.appendChild(l);}catch(e){}
  const $=id=>document.getElementById(id);
  const PAL=['--s1','--s2','--s3','--s4','--s5','--s6','--s7','--s8'];
  const TIERN={'Ⅰ':1,'Ⅱ':2,'Ⅲ':3,'Ⅳ':4,'Ⅴ':5,'Ⅵ':6}, ROMAN=['','Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ'];
  const CORE_EN={none:'No core',iberia:'Iberia',yan:'Yan',sargon:'Sargon',victoria:'Victoria',kjerag:'Kjerag',egir:'Ægir',siracusa:'Siracusa',kazimierz:'Kazimierz',ursus:'Ursus',lethania:'Leithanien'};
  const LV={'Ⅰ':['精1 Lv55 · 技能 4 级','精2 Lv50 · 技能 7 级 · 模组 1 级'],'Ⅱ':['精1 Lv60 · 技能 4 级','精2 Lv55 · 技能 7 级 · 模组 1 级'],
    'Ⅲ':['精2 Lv1 · 技能 4 级','精2 Lv60 · 技能 7 级 · 模组 1 级'],'Ⅵ':['精2 Lv1 · 技能 4 级','精2 Lv60 · 技能 7 级 · 模组 3 级']};
  LV['Ⅳ']=LV['Ⅴ']=LV['Ⅲ'];
  // 职业图标（线稿）
  const GLYPH={'近卫':'<path d="M19 4l-9.5 9.5M19 4h-4M19 4v4M7 12l5 5M5 19l3.5-3.5"/>','狙击':'<circle cx="12" cy="12" r="6"/><path d="M12 3v5M12 16v5M3 12h5M16 12h5"/>',
    '术师':'<path d="M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z"/>','重装':'<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/>',
    '医疗':'<path d="M9 4h6v5h5v6h-5v5H9v-5H4V9h5z"/>','辅助':'<path d="M6 21V4M6 5h11l-3 4 3 4H6"/>','特种':'<path d="M12 3l9 9-9 9-9-9z"/><circle cx="12" cy="12" r="2"/>','先锋':'<path d="M5 13l7-7 7 7M5 19l7-7 7 7"/>'};
  const st={core:'iberia',elite:{},cp:{},sub:{},skill:{},eq:{},bond:{},sel:null,filter:'',showAll:false,bossMode:3,dex:'stmk'};
  OPS.forEach(o=>{st.elite[o.id]=true;st.skill[o.id]=-1;st.bond[o.id]='';st.eq[o.id]=[{id:'',adv:false},{id:'',adv:false}];});
  const XBONDS=Object.keys(SUBS).filter(s=>SUBS[s].fx);
  for(const c in CORE)for(const p of (CORE[c].params||[]))st.cp[p.id]=p.def;
  for(const s in SUBS)st.sub[s]={on:false,L:0,three:false};
  const fmt=n=>Math.round(n).toLocaleString('zh-CN');
  const num=(id,d)=>{const v=parseFloat($(id).value);return isFinite(v)?v:d;};
  const pick=(a,k)=>Array.isArray(a)?a[k]:a;
  const selOf=o=>({skill:st.skill[o.id],eq:st.eq[o.id],bond:st.bond[o.id]||null});
  // 头像：有图用图，没有就退回“首字 + 职业图标”的占位
  const AV=(typeof AVATARS!=='undefined')?AVATARS:{};
  const ava=(o,lg)=>{const src=AV[o.id];
    return `<span class="ava${lg?' lg':''}${src?' img':''}" style="--tier:var(--t${TIERN[o.tier]})">${src?`<img src="${src}" alt="" width="112" height="112">`:(/^[A-Za-z]/.test(o.name)?o.name[0].toUpperCase():o.name[0])}<span class="tr">${o.tier}</span>${src?'':`<svg viewBox="0 0 24 24" aria-hidden="true">${GLYPH[o.cls.slice(0,2)]||''}</svg>`}</span>`;};
  const defName=(o,k)=>o.skill?pick(o.skill,k).split(/[（：]/)[0]:'';
  const skillLabel=(o,k)=>{const A=ALT[o.id],si=st.skill[o.id]; if(A&&si>=0)return `技能 ${A.list[si].no} · ${A.list[si].name}`; const n=defName(o,k); return n?(A?`技能 ${A.def} · `:'')+n:'';};
  const eqName=it=>{const q=EQUIP.find(e=>e.id===it.id);return q?(it.adv&&!q.one?'进阶·':'')+q.n.replace('（只计件数）',''):'';};
  const sw=(attrs,label,checked,disabled)=>`<label class="sw"><input type="checkbox" ${attrs} ${checked?'checked':''} ${disabled?'disabled':''}><i></i><span>${label}</span></label>`;
  let roster=[], colors={}, lastCfg=null;

  function setCore(c){
    st.core=c; const C=CORE[c];
    st.showAll=false;
    $('coreCtl').hidden=!!C.none; $('onWrap').hidden=!!C.none;
    const fl=$('subFilter'); fl.hidden=!C.none;
    if(C.none) fl.innerHTML='<span class="en">Filter</span>'+[''].concat(Object.keys(SUBS)).map(s=>`<button type="button" data-f="${s}" aria-pressed="${st.filter===s}">${s||'全部'}</button>`).join('');
    buildRoster();
    document.querySelectorAll('#cores .core').forEach(b=>b.setAttribute('aria-pressed',b.dataset.c===c));
    $('coreEn').textContent=CORE_EN[c];
    $('bondF').textContent=C.f;
    $('sixWrap').hidden=!C.six; $('sixLabel').textContent=C.sixLabel||'';
    $('coreParams').innerHTML=(C.params||[]).map(p=>p.t==='chk'
      ?sw(`id="cp-${p.id}" data-cp="${p.id}"`,p.label,st.cp[p.id])
      :p.t==='op'?`<div class="fcol"><label for="cp-${p.id}">${p.label}</label><select id="cp-${p.id}" data-cp="${p.id}">${foodOptions()}</select></div>`
      :`<div class="f"><label for="cp-${p.id}">${p.label}</label><input type="number" id="cp-${p.id}" data-cp="${p.id}" value="${st.cp[p.id]}" min="${p.min??0}" max="${p.max??999}" step="${p.step??1}"></div>`).join('')
      +(C.info?'<p class="hint" id="coreInfo"></p>':'');
    renderSubs();
    $('notes').innerHTML='<li><b>盟约效果。</b>'+C.f+'</li>'+(NOTES[c]||[]).map(t=>'<li>'+t+'</li>').join('');
    update();
  }
  // 【阿戈尔】“被吞噬的干员”下拉：本阵营干员在前，其余按等阶分组，组内按基础攻击力从高到低
  function foodOptions(){
    const k=st.cp.devourElite?1:0, cur=st.cp.devourOp, own=o=>o.bonds.includes('阿戈尔'), by=(a,b)=>b.atk[k]-a.atk[k];
    const grp=(label,l)=>l.length?`<optgroup label="${label}">${l.map(o=>`<option value="${o.id}"${o.id===cur?' selected':''}>${o.name} · ${o.tier} 阶 · 攻击 ${o.atk[k]}</option>`).join('')}</optgroup>`:'';
    return '<option value="">无（不吞噬）</option>'+grp('【阿戈尔】干员',OPS.filter(own).sort(by))
      +[6,5,4,3,2,1].map(t=>grp(ROMAN[t]+' 阶',OPS.filter(o=>TIERN[o.tier]===t&&!own(o)).sort(by))).join('');
  }
  // 当前视图的干员名单与配色。无核心盟约视图里干员太多，只给当前输出最高的 8 名配色。
  function buildRoster(){
    const C=CORE[st.core];
    if(C.none){
      roster=OPS.filter(o=>!o.healer&&(!st.filter||o.bonds.includes(st.filter)||st.bond[o.id]===st.filter));
      const c=cfg(); colors={};
      roster.map(o=>({o,d:simulate(o,st.elite[o.id],c,selOf(o)).dps})).sort((a,b)=>b.d-a.d).slice(0,8).forEach((x,i)=>{colors[x.o.id]=PAL[i];});
    } else {
      roster=OPS.filter(o=>o.bonds.includes(C.name)); colors={}; let n=0;
      roster.forEach(o=>{ if(!o.healer) colors[o.id]=PAL[n++]||'--fg-3'; });
    }
    if(!roster.some(o=>o.id===st.sel)) st.sel=null;
  }
  function renderSubs(){
    const subs=Object.keys(SUBS).filter(s=>roster.some(o=>st.bond[o.id]===s||(o.bonds.includes(s)&&(SUBS[s].fx||(o.lyNeed||[]).includes(s)))));
    $('subs').innerHTML=subs.map((s,i)=>{const m=SUBS[s],v=st.sub[s];
      return `<div class="subrow" title="${m.hint}">${sw(`id="sub-on-${i}" data-sub="${s}" data-k="on"`,s,v.on)}${m.noL?'':`<input type="number" id="sub-l-${i}" data-sub="${s}" data-k="L" value="${v.L}" min="0" step="5" aria-label="${s}层数"><span class="muted">层</span>`}${m.three?sw(`id="sub-3-${i}" data-sub="${s}" data-k="three"`,'3 人',v.three):''}</div>`;}).join('')
      ||'<p class="hint">这个阵营的干员没有影响伤害的附加盟约。</p>';
  }
  function cfg(){ return Object.assign({core:st.core,L:Math.max(0,num('Ln',0)),bondOn:$('bondOn').checked,six:$('six').checked&&$('bondOn').checked,
    own:num('own',0),xAtk:num('xAtk',0),xAspd:num('xAspd',0),def:Math.max(0,num('def',0)),res:Math.max(0,Math.min(100,num('res',0))),
    T:Math.max(3,Math.min(240,num('T',30))),N:Math.max(1,Math.min(8,num('N',1))),ranged:$('ranged').checked,heavy:$('heavy').checked,
    blocking:$('blocking').checked,melee:$('melee').checked,stunt:num('stunt',0),sub:st.sub,noLev:!!(curBoss()&&!curBoss().lev),boss:!!curBoss(),bossMass:curBoss()?curBoss().mass:0},st.cp); }
  // 领袖
  const curBoss=()=>BOSSES.find(b=>b.id===$('boss').value)||null;
  const bossRaw=()=>{const b=curBoss(); if(!b)return 0; return ($('bossHid').checked&&b.hid&&b.hid[st.bossMode])?b.hid[st.bossMode]:b.hp[st.bossMode];};
  // 击杀时间用“有效生命”：把领袖自带的减伤折算成需要多打的量
  const bossEhp=()=>{const b=curBoss(); if(!b)return 1; return BOSS_INFO[b.id].ehp({blocking:$('blocking').checked},$('bossHid').checked&&!$('bossHidWrap').hidden);};
  const bossHp=()=>bossRaw()*bossEhp();
  const MODES=['标准模拟','险境模拟','绝境模拟','终极模拟'];
  const BI=(typeof BOSS_IMG!=='undefined')?BOSS_IMG:{};
  const bimg=(id,cls)=>BI[id]?`<span class="bimg ${cls||''}"><img src="${BI[id]}" alt="" width="144" height="144"></span>`:'';
  function renderDex(id){
    const b=BOSSES.find(x=>x.id===id)||BOSSES[0], I=BOSS_INFO[b.id]; st.dex=b.id;
    $('dexList').innerHTML=BOSSES.map(x=>`<button type="button" data-b="${x.id}" aria-pressed="${x.id===b.id}">${bimg(x.id,'sm')}<span>${x.name}</span></button>`).join('');
    const li=a=>'<ul class="plain">'+a.map(t=>'<li>'+t+'</li>').join('')+'</ul>';
    $('dexBody').innerHTML=`
      <div class="dex-h"><div class="who">${bimg(b.id,'lg')}<div><h3>${b.name}</h3><div class="chips"><span class="tag">${I.dmg}</span><span class="tag">${I.range}</span><span class="tag">重量 ${b.mass}</span><span class="tag${b.lev?' eq':''}">${b.lev?'可以浮空':'免疫浮空'}</span>${b.hid?'<span class="tag eq">有隐秘核心</span>':''}</div></div></div>
        <div class="btnrow"><button type="button" class="btn" id="dexUse">设为目标</button><button type="button" class="btn" id="dexClose">关闭</button></div></div>
      <div class="dex-sec"><h4>基础属性</h4><div class="dex-stats"><div><b>${fmt(b.def)}${b.hidDef?' / '+fmt(b.hidDef):''}</b><span>防御力${b.hidDef?'（普通 / 隐秘）':''}</span></div><div><b>${b.res}${b.hidRes?' / '+b.hidRes:''}</b><span>法术抗性${b.hidRes?'（普通 / 隐秘）':''}</span></div><div><b>${fmt(I.atk)}</b><span>攻击力</span></div><div><b>${I.bat}</b><span>攻击间隔（秒）</span></div></div>
        <p class="hint" style="margin-top:8px">${b.imm}。防御和法抗取自敌人基础数据，模式内是否另有加成未确认。</p></div>
      <div class="dex-sec"><h4>各难度生命值</h4><div class="tablebox"><table><thead><tr><th>难度</th><th class="n">普通</th>${b.hid?'<th class="n">隐秘核心</th>':''}</tr></thead><tbody>${MODES.map((m,i)=>`<tr><td>${m}</td><td class="n">${fmt(b.hp[i])}</td>${b.hid?`<td class="n">${b.hid[i]?fmt(b.hid[i]):'—'}</td>`:''}</tr>`).join('')}</tbody></table></div></div>
      <div class="dex-sec"><h4>能力</h4>${li(I.ab)}</div>
      ${I.hid.length?`<div class="dex-sec"><h4>隐秘核心的变化</h4>${li(I.hid)}</div>`:''}
      <div class="dex-sec"><h4>对击杀时间的影响</h4><p class="dex-tip">${I.tip}</p></div>`;
    $('dexBody').scrollTop=0;
  }
  function openDex(){ renderDex((curBoss()||{}).id||st.dex); const d=$('dex'); if(d.showModal){ if(!d.open)d.showModal(); } else d.setAttribute('open',''); }
  function closeDex(){ const d=$('dex'); if(d.close)d.close(); else d.removeAttribute('open'); }
  const fmtTime=s=>!isFinite(s)?'—':s<60?Math.round(s)+' 秒':Math.floor(s/60)+' 分 '+String(Math.round(s%60)).padStart(2,'0')+' 秒';
  function applyBoss(){
    const b=curBoss(); $('bossCtl').hidden=!b; if(!b)return;
    const hasHid=!!(b.hid&&b.hid[st.bossMode]); $('bossHidWrap').hidden=!hasHid; if(!hasHid)$('bossHid').checked=false;
    const hid=$('bossHid').checked;
    $('def').value=hid&&b.hidDef?b.hidDef:b.def; $('res').value=hid&&b.hidRes?b.hidRes:b.res;
    $('heavy').checked=b.mass>=3; $('N').value=1; if(num('T',30)<60)$('T').value=90;
    document.querySelectorAll('#bossMode button').forEach(x=>x.setAttribute('aria-pressed',+x.dataset.m===st.bossMode));
    $('bossPic').innerHTML=BI[b.id]?`<img src="${BI[b.id]}" alt="" width="144" height="144">`:''; $('bossPic').hidden=!BI[b.id];
    const e=bossEhp(); $('bossInfo').textContent='生命 '+fmt(bossRaw())+(Math.abs(e-1)>0.01?'（计入减伤后相当于 '+fmt(bossHp())+'）':'')+' · 重量 '+b.mass+' · '+b.imm;
    syncPreset();
  }
  const dot=o=>`<i class="dot" style="background:var(${colors[o.id]||'--line-2'})"></i>`;
  const barHtml=(p,max)=>{const w=v=>(v/max*100).toFixed(2)+'%';
    return `<div class="bar" title="直接 ${fmt(p.direct)} ｜ 盟约 ${fmt(p.bond)} ｜ 附加 ${fmt(p.extra)}">${p.direct>0?`<i class="d" style="width:${w(p.direct)}"></i>`:''}${p.bond>0?`<i class="b" style="width:${w(p.bond)}"></i>`:''}${p.extra>0?`<i class="x" style="width:${w(p.extra)}"></i>`:''}</div>`;};

  function renderRank(c){
    const rows=roster.map(o=>({o,r:simulate(o,st.elite[o.id],c,selOf(o))})).sort((a,b)=>b.r.dps-a.r.dps);
    const max=Math.max(1,rows[0].r.dps), food=devourInfo(c);
    if(!st.sel) st.sel=rows[0].o.id;
    const LIMIT=20, cut=CORE[c.core].none&&!st.showAll&&rows.length>LIMIT;
    $('rankMore').hidden=!cut; if(cut) $('rankMore').innerHTML=`<button type="button" class="btn" id="showAll">显示全部 ${rows.length} 名</button>`;
    $('rank').innerHTML=(cut?rows.slice(0,LIMIT):rows).map((x,i)=>{const o=x.o,r=x.r,e=st.elite[o.id],k=e?1:0;
      const eqs=st.eq[o.id].filter(it=>it.id).map(it=>`<span class="tag eq">${eqName(it)}</span>`).join('')+(st.bond[o.id]?`<span class="tag eq">同构体·${st.bond[o.id]}</span>`:'');
      const sk=skillLabel(o,k);
      return `<div class="rc${r.healer?' heal':''}${!r.healer&&i<3?' top':''}" role="button" tabindex="0" data-id="${o.id}" aria-pressed="${st.sel===o.id}" style="--col:var(${colors[o.id]||'--line-2'})">
        <span class="rk">${r.healer?'–':String(i+1).padStart(2,'0')}</span>${ava(o)}
        <div class="who"><div class="nm"><b>${o.name}</b><span>${o.cls}</span></div>
          <div class="tags">${r.healer?'<span class="tag">治疗位，不造成伤害</span>':(r.eaten?`<span class="tag eq">被吞噬 · ${food.alive?'存活':food.revive?'复活':'阵亡'}</span>`:'')+(sk?`<span class="tag">${sk}</span>`:'')+(eqs||'<span class="tag none">未装备</span>')}</div></div>
        <div class="val"><button type="button" class="elite" data-el="${o.id}" aria-pressed="${e}" title="切换初始 / 精锐">${e?'精锐':'初始'}</button><div><b>${fmt(r.dps)}</b><small>攻击力 ${fmt(r.atk)}</small></div></div>
        ${r.healer?'':`<div class="meter">${barHtml(r.parts,max)}</div>`}</div>`;}).join('');
    const a=rows[0],b=rows[1], share=Math.round(a.r.parts.bond/Math.max(1,a.r.dps)*100), top3=rows.slice(0,3).reduce((s,x)=>s+x.r.dps,0);
    $('kpis').innerHTML=`<div class="kpi"><b class="cn">${a.o.name}</b><small>最高输出 · 每秒 ${fmt(a.r.dps)}</small></div>
      <div class="kpi"><b>${(a.r.dps/Math.max(1,b.r.dps)).toFixed(2)}×</b><small>领先第二名 ${b.o.name}</small></div>
      ${bossHp()?`<div class="kpi"><b>${fmtTime(bossHp()/Math.max(1,rows.slice(0,8).reduce((s,x)=>s+x.r.dps,0)))}</b><small>前 8 名合力击杀 ${curBoss().name}</small></div>`:`<div class="kpi"><b>${fmt(top3)}</b><small>前三名合计每秒伤害</small></div>`}
      <div class="kpi"><b>${share>0?share+'%':fmt(a.r.atk)}</b><small>${share>0?'第一名的盟约伤害占比':'第一名的攻击力'}</small></div>`;
    $('rank-cap').textContent=`${c.N>1?c.N+' 个目标合计':'单目标'} · 存活 ${c.T} 秒内的平均每秒伤害`;
  }

  function timeline(r){
    const W=Math.max(260,$('tl').clientWidth||360), H=156, m={l:46,r:8,t:8,b:22}, iw=W-m.l-m.r, ih=H-m.t-m.b, n=r.sec.length;
    const ymaxRaw=Math.max(1,...r.sec), mag=Math.pow(10,Math.floor(Math.log10(ymaxRaw))), step=[0.5,1,2,2.5,5].map(v=>v*mag).find(v=>ymaxRaw/v<=3)||mag*5, ymax=Math.ceil(ymaxRaw/step)*step;
    const X=i=>m.l+i/n*iw, Y=v=>m.t+ih-v/ymax*ih;
    let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="每秒伤害随时间变化">`;
    let a=-1; for(let i=0;i<=n;i++){ if(i<n&&r.on[i]){ if(a<0)a=i; } else if(a>=0){ s+=`<rect x="${X(a)}" y="${m.t}" width="${X(i)-X(a)}" height="${ih}" fill="var(--band)"/><line x1="${X(a)}" x2="${X(i)}" y1="${m.t}" y2="${m.t}" stroke="var(--gold)" stroke-width="2"/>`; a=-1; } }
    for(let v=0;v<=ymax+1e-6;v+=step)s+=`<line x1="${m.l}" x2="${m.l+iw}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(${v===0?'--axis':'--grid'})"/><text x="${m.l-6}" y="${Y(v)+4}" text-anchor="end">${fmt(v)}</text>`;
    const tstep=n<=40?10:n<=120?30:60; for(let t=0;t<=n;t+=tstep)s+=`<text x="${X(t)}" y="${H-5}" text-anchor="middle">${t}s</text>`;
    let d=`M${X(0)} ${Y(0)}`; r.sec.forEach((v,i)=>{d+=`L${X(i).toFixed(1)} ${Y(v).toFixed(1)}L${X(i+1).toFixed(1)} ${Y(v).toFixed(1)}`;});
    s+=`<path d="${d}L${X(n)} ${Y(0)}Z" fill="var(--accent-soft)"/><path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>`;
    s+=`<line id="tlx" y1="${m.t}" y2="${m.t+ih}" stroke="var(--fg-3)" visibility="hidden"/><rect id="tlh" x="${m.l}" y="${m.t}" width="${iw}" height="${ih}" fill="transparent"/></svg><div id="tlTip" hidden></div>`;
    $('tl').innerHTML=s;
    const svg=$('tl').querySelector('svg'), tip=$('tlTip'), ln=svg.querySelector('#tlx'), hit=svg.querySelector('#tlh');
    const mv=ev=>{const bb=svg.getBoundingClientRect(), px=(ev.clientX-bb.left)/bb.width*W; let i=Math.floor((px-m.l)/iw*n); i=Math.max(0,Math.min(n-1,i));
      const cx=X(i+0.5); ln.setAttribute('x1',cx); ln.setAttribute('x2',cx); ln.setAttribute('visibility','visible');
      tip.textContent=`第 ${i+1} 秒：${fmt(r.sec[i])}${r.on[i]?' · 技能中':''}`; tip.hidden=false;
      const left=cx/W*bb.width; tip.style.left=Math.max(0,Math.min(bb.width-tip.offsetWidth,left-tip.offsetWidth/2))+'px';};
    hit.addEventListener('pointermove',mv); hit.addEventListener('pointerdown',mv);
    hit.addEventListener('pointerleave',()=>{tip.hidden=true;ln.setAttribute('visibility','hidden');});
  }

  function renderDetail(c){
    const o=roster.find(x=>x.id===st.sel)||roster[0], e=st.elite[o.id], k=e?1:0, A=ALT[o.id], si=st.skill[o.id];
    const head=`<div class="dh">${ava(o,true)}<div><h3>${o.name}</h3><p>${o.cls} ｜ ${o.lv?o.lv[k]:LV[o.tier][k]}</p><div class="chips">${o.bonds.map(b=>`<span class="tag">${b}</span>`).join('')}${st.bond[o.id]?`<span class="tag eq">${st.bond[o.id]}</span>`:''}</div></div>
      <button type="button" class="elite" data-el="${o.id}" aria-pressed="${e}">${e?'精锐':'初始'}</button></div>`;
    if(o.healer){ $('detail').innerHTML=head+`<div class="sec"><p class="txt">治疗位，不造成伤害，也不触发需要“造成伤害”的盟约效果。</p></div><div class="sec"><h4>模式特质</h4><p class="txt">${pick(o.trait,k)}</p></div>`; return; }
    const r=simulate(o,e,c,Object.assign({trace:true},selOf(o))), tot=Math.max(1,r.dps), pc=v=>Math.round(v/tot*100)+'%';
    let skills;
    if(A){ const all=[{idx:-1,no:A.def,name:defName(o,k),d:true}].concat(A.list.map((a,i)=>({idx:i,no:a.no,name:a.name}))).sort((x,y)=>x.no-y.no);
      skills=`<div class="seg">${all.map(q=>`<button type="button" data-skill="${q.idx}" aria-pressed="${si===q.idx}"><em>S${q.no}</em><span>${q.name}</span>${q.d?'<small>默认</small>':''}</button>`).join('')}</div>
        <p class="desc">${si>=0?A.list[si].text+'<br><span class="muted">“a/b”依次为初始 / 精锐的数值。</span>':pick(o.skill,k)}</p>`;
    } else skills=`<p class="desc" style="margin-top:0">${o.skill?pick(o.skill,k):'无'}<br><span class="muted">预设干员，模式内技能固定。</span></p>`;
    const opts=cur=>'<option value="">空</option>'+[1,2,3,4,5,6,0].map(t=>{const l=EQUIP.filter(q=>q.t===t); return l.length?`<optgroup label="${t?ROMAN[t]+' 阶':'其他'}">${l.map(q=>`<option value="${q.id}"${q.id===cur?' selected':''}>${q.n}</option>`).join('')}</optgroup>`:'';}).join('');
    const slots=st.eq[o.id].map((it,i)=>{const q=EQUIP.find(x=>x.id===it.id);
      return `<div class="slot"><div class="top"><span class="en">Slot ${i+1}</span>${sw(`data-adv="${i}" id="eqa-${i}"`,'进阶',it.adv,!q||q.one)}</div>
        <select data-slot="${i}" id="eq-${i}" aria-label="装备栏 ${i+1}">${opts(it.id)}</select>
        <p class="hint">${q?(q.one?q.d[0]:q.d[it.adv?1:0]):'选一件装备，看它对输出的影响。'}</p></div>`;}).join('');
    const xb=st.bond[o.id];
    $('detail').innerHTML=head+`
      <div class="tiles"><div class="tile"><b>${fmt(r.dps)}</b><span>每秒伤害</span></div><div class="tile"><b>${fmt(r.atk)}</b><span>战斗中攻击力</span></div><div class="tile"><b>${r.iv.toFixed(2)}<small>秒</small></b><span>攻击间隔</span></div></div>
      ${r.eaten?`<div class="bossline">这名干员被选为“被吞噬的干员”：${r.dead?'挨不住 5000 点伤害，开战就阵亡，本场没有输出。':'能活下来（或复活），但自己不获得吞噬的攻击力。'}</div>`:''}
      ${bossHp()?`<div class="bossline">单人打完 ${curBoss().name}（${Math.abs(bossEhp()-1)>0.01?'计入减伤后相当于 ':'生命 '}${fmt(bossHp())}）约需 <b>${fmtTime(bossHp()/Math.max(1,r.dps))}</b></div>`:''}
      <div class="sec"><h4>技能</h4>${skills}</div>
      <div class="sec"><h4>装备</h4><div class="slots">${slots}</div>
        <div class="f" style="margin-top:10px"><label for="xbond">变形同构体：额外获得盟约</label><select id="xbond" data-xbond="1"><option value="">无</option>${XBONDS.filter(b=>!o.bonds.includes(b)).map(b=>`<option value="${b}"${xb===b?' selected':''}>${b}</option>`).join('')}</select></div>
        <p class="hint" style="margin-top:6px">${xb?`已视为【${xb}】干员：${SUBS[xb].hint}。层数和“3 人”在参数栏的“附加盟约”里调。`:'游戏里它占一格装备，给哪个盟约由另一件装备决定；这里直接选结果，不占格子。'}</p></div>
      <div class="sec"><h4>输出时间轴 <small>每秒伤害；金色段 = 技能开启中</small></h4><div id="tl"></div></div>
      <div class="sec"><h4>伤害构成${c.core==='iberia'&&c.bondOn?` <small>叠满 10 层：${r.full==null?'未叠满':r.full.toFixed(1)+' 秒'}</small>`:''}${r.ep?` <small>侵蚀爆发 ${r.bursts} 次，各 5000 元素伤害（计入“附加”）</small>`:''}</h4><div class="comp">${barHtml(r.parts,tot)}
        <div class="lg"><div style="--c:var(--seg-direct)"><b>${fmt(r.parts.direct)}</b><span>直接 · ${pc(r.parts.direct)}</span></div><div style="--c:var(--seg-bond)"><b>${fmt(r.parts.bond)}</b><span>盟约 · ${pc(r.parts.bond)}</span></div><div style="--c:var(--seg-extra)"><b>${fmt(r.parts.extra)}</b><span>附加 · ${pc(r.parts.extra)}</span></div></div></div></div>
      <div class="sec"><h4>说明</h4><dl class="kv"><dt>模式特质</dt><dd>${pick(o.trait,k)}</dd>${o.extra?`<dt>天赋 / 模组</dt><dd>${pick(o.extra,k)}</dd>`:''}<dt>建模方式</dt><dd>${si>=0&&A.list[si].model?A.list[si].model:(si>=0?'非默认技能按技能说明里的数值做通用建模；以下是默认技能的说明。':'')+o.model}</dd></dl></div>`;
    timeline(r);
  }

  function renderChart(c){
    const none=CORE[c.core].none, fs=st.filter, noCurve=none&&(!fs||SUBS[fs].noL);
    $('chartSec').hidden=!!noCurve; if(noCurve) return;
    $('chartTitle').textContent=none?`输出随【${fs}】层数的变化（筛选时输出最高的 8 名）`:'输出随盟约层数的变化';
    const at=l=>none?{...c,sub:{...c.sub,[fs]:{...c.sub[fs],on:true,L:l}}}:{...c,L:l};
    const curL=none?(c.sub[fs].L||0):c.L;
    const ops=roster.filter(o=>!o.healer&&(!none||colors[o.id])), xs=[]; for(let l=0;l<=500;l+=25)xs.push(l);
    const series=ops.map(o=>({o,col:colors[o.id],ys:xs.map(l=>simulate(o,st.elite[o.id],at(l),selOf(o)).dps)}));
    const box=$('chart'), W=Math.max(300,box.clientWidth), H=Math.round(Math.min(340,Math.max(230,W*0.3)));
    const m={l:58,r:W<520?14:104,t:10,b:30}, iw=W-m.l-m.r, ih=H-m.t-m.b;
    const ymaxRaw=Math.max(1,...series.flatMap(s=>s.ys)); const mag=Math.pow(10,Math.floor(Math.log10(ymaxRaw)));
    const step=[0.5,1,2,2.5,5].map(v=>v*mag).find(v=>ymaxRaw/v<=6)||mag*5; const ymax=Math.ceil(ymaxRaw/step)*step;
    const X=l=>m.l+l/500*iw, Y=v=>m.t+ih-v/ymax*ih;
    let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="各干员每秒伤害随盟约层数变化的折线图">`;
    for(let v=0;v<=ymax+1e-6;v+=step){s+=`<line x1="${m.l}" x2="${m.l+iw}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(${v===0?'--axis':'--grid'})" stroke-width="1"/><text x="${m.l-8}" y="${Y(v)+4}" text-anchor="end">${fmt(v)}</text>`;}
    for(let l=0;l<=500;l+=100)s+=`<text x="${X(l)}" y="${H-9}" text-anchor="middle">${l} 层</text>`;
    const cl=Math.min(500,curL); s+=`<line x1="${X(cl)}" x2="${X(cl)}" y1="${m.t}" y2="${m.t+ih}" stroke="var(--fg-3)" stroke-width="1" stroke-dasharray="3 3"/>`;
    series.slice().sort((a,b)=>(a.o.id===st.sel)-(b.o.id===st.sel)).forEach(sr=>{const on=sr.o.id===st.sel;s+=`<path d="${sr.ys.map((v,i)=>(i?'L':'M')+X(xs[i]).toFixed(1)+' '+Y(v).toFixed(1)).join('')}" fill="none" stroke="var(${sr.col})" stroke-width="${on?3.5:sr.col==='--fg-3'?1.5:2}" stroke-linejoin="round" stroke-linecap="round"/>`;});
    if(m.r>40){ const ends=series.map(sr=>({sr,y:Y(sr.ys[sr.ys.length-1])})).sort((a,b)=>a.y-b.y).slice(0,4); let last=-99;
      ends.forEach(e=>{const y=Math.max(e.y,last+14);last=y;s+=`<circle cx="${X(500)}" cy="${e.y}" r="3.5" fill="var(${e.sr.col})" stroke="var(--surface)" stroke-width="2"/><text class="lab" x="${X(500)+9}" y="${y+4}">${e.sr.o.name}</text>`;}); }
    s+=`<g id="xh" visibility="hidden"><line id="xhl" y1="${m.t}" y2="${m.t+ih}" stroke="var(--axis)" stroke-width="1"/>${series.map((sr,i)=>`<circle id="xd${i}" r="4" fill="var(${sr.col})" stroke="var(--surface)" stroke-width="2"/>`).join('')}</g>`;
    s+=`<rect id="hit" x="${m.l}" y="${m.t}" width="${iw}" height="${ih}" fill="transparent"/></svg>`;
    const tip=$('tip'); box.querySelector('svg')?.remove(); box.insertAdjacentHTML('afterbegin',s);
    const svg=box.querySelector('svg'), hit=svg.querySelector('#hit'), xh=svg.querySelector('#xh');
    const move=ev=>{const r=svg.getBoundingClientRect(), px=(ev.clientX-r.left)/r.width*W; let i=Math.round((px-m.l)/iw*(xs.length-1)); i=Math.max(0,Math.min(xs.length-1,i));
      xh.setAttribute('visibility','visible'); const lx=X(xs[i]); svg.querySelector('#xhl').setAttribute('x1',lx); svg.querySelector('#xhl').setAttribute('x2',lx);
      series.forEach((sr,j)=>{const d=svg.querySelector('#xd'+j);d.setAttribute('cx',lx);d.setAttribute('cy',Y(sr.ys[i]));});
      tip.innerHTML=`<div class="t">${xs[i]} 层</div>`+series.map(sr=>({n:sr.o,v:sr.ys[i]})).sort((a,b)=>b.v-a.v).map(e=>`<div class="r"><span>${dot(e.n)}${e.n.name}</span><b>${fmt(e.v)}</b></div>`).join('');
      tip.hidden=false; const tw=tip.offsetWidth, left=lx/W*r.width; tip.style.left=Math.max(0,Math.min(r.width-tw,left>r.width/2?left-tw-12:left+12))+'px'; tip.style.top='8px';};
    hit.addEventListener('pointermove',move); hit.addEventListener('pointerdown',move);
    hit.addEventListener('pointerleave',()=>{tip.hidden=true;xh.setAttribute('visibility','hidden');});
    $('chart-legend').innerHTML=series.map(sr=>`<span><i class="ln" style="background:var(${sr.col})"></i>${sr.o.name}</span>`).join('');
    $('chart-table').innerHTML=`<table><thead><tr><th>层数</th>${series.map(sr=>`<th class="n">${sr.o.name}</th>`).join('')}</tr></thead><tbody>${xs.filter((_,i)=>i%2===0).map(l=>`<tr><td class="n" style="text-align:left">${l}</td>${series.map(sr=>`<td class="n">${fmt(sr.ys[xs.indexOf(l)])}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }

  let timer=0;
  const syncL=()=>{const v=Math.max(0,num('Ln',0));$('Lbig').textContent=v;$('L').style.setProperty('--p',Math.min(100,v/5)+'%');};
  function draw(){const c=cfg();lastCfg=c;syncL();renderRank(c);renderDetail(c);renderChart(c);
    const info=$('coreInfo'); if(info){ const t=CORE[c.core].info?CORE[c.core].info(c):''; info.textContent=t; info.hidden=!t; } }
  function update(){clearTimeout(timer);timer=setTimeout(draw,20);}

  $('cores').innerHTML=Object.keys(CORE).filter(c=>!CORE[c].none).concat('none').map(c=>`<button type="button" class="core" data-c="${c}" aria-pressed="false"><b>${CORE[c].name}</b><small>${CORE_EN[c].toUpperCase()} · ${CORE[c].none?OPS.filter(o=>!o.healer).length:OPS.filter(o=>o.bonds.includes(CORE[c].name)).length}</small></button>`).join('');
  $('subFilter').addEventListener('click',e=>{const b=e.target.closest('[data-f]');if(!b)return;st.filter=b.dataset.f;if(st.filter)st.sub[st.filter].on=true;setCore('none');});
  $('rankMore').addEventListener('click',e=>{if(e.target.closest('#showAll')){st.showAll=true;update();}});
  $('cores').addEventListener('click',e=>{const b=e.target.closest('.core');if(b)setCore(b.dataset.c);});
  $('bulkEq').innerHTML=EQUIP.map(q=>`<option value="${q.id}">${q.t?ROMAN[q.t]+' · ':''}${q.n}</option>`).join('');
  $('bulkSet').addEventListener('click',()=>{const id=$('bulkEq').value,adv=$('bulkAdv').checked;OPS.forEach(o=>{st.eq[o.id][0]={id,adv};});update();});
  $('bulkClear').addEventListener('click',()=>{OPS.forEach(o=>{st.eq[o.id]=[{id:'',adv:false},{id:'',adv:false}];});update();});
  $('L').addEventListener('input',()=>{$('Ln').value=$('L').value;syncL();update();});
  $('Ln').addEventListener('input',()=>{$('L').value=Math.min(500,num('Ln',0));syncL();update();});
  const syncPreset=()=>document.querySelectorAll('#preset button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.d===$('def').value&&b.dataset.r===$('res').value));
  $('preset').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;$('def').value=b.dataset.d;$('res').value=b.dataset.r;syncPreset();update();});
  document.querySelector('.setup').addEventListener('input',e=>{const el=e.target;
    if(el.dataset.cp){st.cp[el.dataset.cp]=el.type==='checkbox'?el.checked:el.tagName==='SELECT'?el.value:(isFinite(parseFloat(el.value))?parseFloat(el.value):0);
      if(el.dataset.cp==='devourElite'&&$('cp-devourOp'))$('cp-devourOp').innerHTML=foodOptions(); }
    else if(el.dataset.sub){const v=st.sub[el.dataset.sub];v[el.dataset.k]=el.type==='checkbox'?el.checked:(isFinite(parseFloat(el.value))?parseFloat(el.value):0);}
    if(el.id==='def'||el.id==='res')syncPreset();
    if(['L','Ln','bulkEq','bulkAdv'].includes(el.id))return; update();});
  $('allE').addEventListener('click',()=>{OPS.forEach(o=>st.elite[o.id]=true);update();});
  $('allN').addEventListener('click',()=>{OPS.forEach(o=>st.elite[o.id]=false);update();});
  const toggleElite=id=>{st.elite[id]=!st.elite[id];update();};
  $('rank').addEventListener('click',e=>{const b=e.target.closest('[data-el]');if(b){toggleElite(b.dataset.el);return;}
    const c=e.target.closest('.rc');if(c){st.sel=c.dataset.id;update();}});
  $('rank').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.classList.contains('rc')){e.preventDefault();st.sel=e.target.dataset.id;update();}});
  $('detail').addEventListener('click',e=>{const b=e.target.closest('[data-el]');if(b){toggleElite(b.dataset.el);return;}
    const s=e.target.closest('[data-skill]');if(s){st.skill[st.sel]=+s.dataset.skill;update();}});
  $('detail').addEventListener('change',e=>{const el=e.target, it=st.eq[st.sel]; if(!it)return;
    if(el.dataset.xbond){st.bond[st.sel]=el.value; if(el.value)st.sub[el.value].on=true; renderSubs(); update();}
    else if(el.dataset.slot!=null){it[+el.dataset.slot]={id:el.value,adv:it[+el.dataset.slot].adv};update();}
    else if(el.dataset.adv!=null){it[+el.dataset.adv].adv=el.checked;update();}});
  // 容器宽度变化时重画两张图（图是按像素宽度生成的）
  let rz=0, lastW=0; const relayout=()=>{clearTimeout(rz);rz=setTimeout(()=>{const w=$('chart').clientWidth; if(lastCfg&&w!==lastW){lastW=w;renderDetail(lastCfg);renderChart(lastCfg);}},120);};
  if(window.ResizeObserver) new ResizeObserver(relayout).observe($('chart')); else window.addEventListener('resize',relayout);
  $('boss').innerHTML='<option value="">不指定（用上面的预设或自己填）</option>'+BOSSES.map(b=>`<option value="${b.id}">${b.name}</option>`).join('');
  $('boss').addEventListener('input',applyBoss);
  $('blocking').addEventListener('input',()=>{if(curBoss())applyBoss();});
  $('dexOpen').addEventListener('click',openDex);
  $('dex').addEventListener('click',e=>{ if(e.target===$('dex')){closeDex();return;}
    const t=e.target.closest('[data-b]'); if(t){renderDex(t.dataset.b);return;}
    if(e.target.closest('#dexClose')){closeDex();return;}
    if(e.target.closest('#dexUse')){ $('boss').value=st.dex; applyBoss(); update(); closeDex(); } });
  $('bossHid').addEventListener('input',applyBoss);
  $('bossMode').addEventListener('click',e=>{const b=e.target.closest('[data-m]');if(!b)return;st.bossMode=+b.dataset.m;applyBoss();update();});
  setCore('iberia');
})();
