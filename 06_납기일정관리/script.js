const today = new Date().toISOString().slice(0,10);
const toDate = s => new Date(s);
let curTab='cal', editId=null, nextId=Date.now();
let calYear=parseInt(today.slice(0,4)), calMonth=parseInt(today.slice(5,7));

const STATUS_META={
  scheduled:{label:'예정',color:'#64748b',bg:'#f1f5f9'},
  progress:{label:'진행중',color:'#2563eb',bg:'#dbeafe'},
  delay:{label:'지연우려',color:'#d97706',bg:'#fef3c7'},
  done:{label:'납기완료',color:'#059669',bg:'#dcfce7'},
  late:{label:'납기지연',color:'#dc2626',bg:'#fee2e2'},
};

let items = JSON.parse(localStorage.getItem('pcbDelivery')||'null') || genSample();

function genSample(){
  const cus=['(주)삼성전자','LG이노텍','현대모비스','(주)코리아서킷','SKC','(주)대덕전자'];
  const prds=['PCB-A2401','PCB-B1802','PCB-C3305','PCB-D0401','PCB-E0502','PCB-F0601'];
  const sts=['scheduled','progress','progress','done','delay','late','done','progress'];
  const arr=[];
  const y=today.slice(0,4),m=today.slice(5,7);
  for(let i=0;i<18;i++){
    const dOff=i*2-5;
    const dDate=new Date(new Date(today).setDate(new Date(today).getDate()+dOff));
    const dStr=dDate.toISOString().slice(0,10);
    const st=sts[i%8];
    const act=st==='done'?new Date(new Date(dDate).setDate(dDate.getDate()-1)).toISOString().slice(0,10):(st==='late'?new Date(new Date(dDate).setDate(dDate.getDate()+2)).toISOString().slice(0,10):'');
    arr.push({id:Date.now()+i,
      customer:cus[i%6],poNo:`PO-${y}-${String(i+1).padStart(3,'0')}`,
      product:prds[i%6],qty:500+i*100,
      orderDate:new Date(new Date(dDate).setDate(dDate.getDate()-14)).toISOString().slice(0,10),
      dueDate:dStr,actualDate:act,
      status:st,manager:['김영업','이영업','박담당'][i%3],note:'',
    });
  }
  return arr;
}
function save(){ localStorage.setItem('pcbDelivery', JSON.stringify(items)); }

/* 필터 고객사 갱신 */
function updateCustomerFilter(){
  const sel=document.getElementById('customerFilter');
  const cur=sel.value;
  const custs=[...new Set(items.map(i=>i.customer))].sort();
  sel.innerHTML='<option value="">전체 고객사</option>'+custs.map(c=>`<option value="${c}" ${c===cur?'selected':''}>${c}</option>`).join('');
}

function getFiltered(){
  const c=document.getElementById('customerFilter').value;
  const s=document.getElementById('statusFilter').value;
  return items.filter(i=>(!c||i.customer===c)&&(!s||i.status===s));
}

/* KPI */
function renderKPI(){
  const on=items.filter(i=>i.status!=='done').length;
  const done=items.filter(i=>i.status==='done').length;
  const late=items.filter(i=>i.status==='late').length;
  const total=items.filter(i=>['done','late'].includes(i.status)).length;
  const ontime=items.filter(i=>i.status==='done').length;
  const rate=total>0?Math.round(ontime/total*100):0;
  const near=items.filter(i=>i.status!=='done'&&i.status!=='late'&&i.dueDate>=today&&daysBetween(today,i.dueDate)<=3).length;
  document.getElementById('kpiRow').innerHTML=`
    <div class="kpi" style="border-top-color:var(--violet)"><div class="kpi-l">진행중 건수</div><div class="kpi-v" style="color:var(--violet)">${on}</div><div class="kpi-sub">건</div></div>
    <div class="kpi" style="border-top-color:var(--green)"><div class="kpi-l">납기 완료</div><div class="kpi-v" style="color:var(--green)">${done}</div><div class="kpi-sub">건</div></div>
    <div class="kpi" style="border-top-color:var(--red)"><div class="kpi-l">납기 지연</div><div class="kpi-v" style="color:var(--red)">${late}</div><div class="kpi-sub">건</div></div>
    <div class="kpi" style="border-top-color:var(--amber)"><div class="kpi-l">D-3 이내</div><div class="kpi-v" style="color:var(--amber)">${near}</div><div class="kpi-sub">건</div></div>
    <div class="kpi" style="border-top-color:${rate>=95?'var(--green)':rate>=90?'var(--amber)':'var(--red)'}"><div class="kpi-l">납기 준수율</div><div class="kpi-v" style="color:${rate>=95?'var(--green)':rate>=90?'var(--amber)':'var(--red)'}">${rate}%</div><div class="kpi-sub">이번달</div></div>`;
}

function daysBetween(a,b){ return Math.ceil((new Date(b)-new Date(a))/(86400000)); }

/* 탭 */
function switchTab(t){
  curTab=t;
  ['cal','list','stat'].forEach(x=>{
    document.getElementById(`${x}View`).style.display=x===t?'block':'none';
    document.getElementById(`t-${x}`).classList.toggle('active',x===t);
  });
  render();
}

function render(){
  autoUpdateLateStatus();
  updateCustomerFilter();
  renderKPI();
  renderUrgentBanner();
  if(curTab==='cal') renderCal();
  else if(curTab==='list') renderList();
  else renderStat();
}

/* 캘린더 */
function renderCal(){
  const firstDay=new Date(calYear,calMonth-1,1);
  const lastDay=new Date(calYear,calMonth,0);
  const daysInMonth=lastDay.getDate();
  const startDow=firstDay.getDay();
  const filtered=getFiltered();

  let cells='';
  const prevLast=new Date(calYear,calMonth-1,0).getDate();
  for(let i=0;i<startDow;i++){
    const d=prevLast-startDow+i+1;
    cells+=`<div class="cal-day other-month"><div class="day-no">${d}</div></div>`;
  }
  for(let d=1;d<=daysInMonth;d++){
    const ds=`${calYear}-${String(calMonth).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dow=(startDow+d-1)%7;
    const dayItems=filtered.filter(i=>i.dueDate===ds);
    const isToday=ds===today;
    const dayNoClass=`day-no${isToday?' today':dow===0?' sunday':dow===6?' saturday':''}`;
    const noHTML=isToday?`<div class="${dayNoClass}">${d}</div>`:`<span class="${dayNoClass}">${d}</span>`;
    const evHTML=dayItems.map(i=>{
      const m=STATUS_META[i.status]||STATUS_META.scheduled;
      return `<div class="cal-event" style="background:${m.bg};color:${m.color}" title="${i.customer} / ${i.product}" onclick="openModal('${i.id}')">${i.customer.replace('(주)','').slice(0,4)} ${i.product}</div>`;
    }).join('');
    cells+=`<div class="cal-day">${noHTML}${evHTML}</div>`;
  }
  const total=startDow+daysInMonth;
  for(let d=1;d<=7-total%7;d++){
    cells+=d<=7-total%7&&total%7!==0?`<div class="cal-day other-month"><div class="day-no">${d}</div></div>`:'';
  }

  const MONTHS=['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  const DOWS=['일','월','화','수','목','금','토'];
  document.getElementById('calView').innerHTML=`
    <div class="cal-wrap">
      <div class="cal-header">
        <span class="cal-title">${calYear}년 ${MONTHS[calMonth-1]}</span>
        <div style="display:flex;gap:6px;align-items:center;font-size:.78rem;color:var(--sub)">
          ${Object.entries(STATUS_META).map(([k,m])=>`<span style="width:8px;height:8px;border-radius:50%;background:${m.color};display:inline-block"></span>${m.label}`).join(' &nbsp;')}
        </div>
        <div class="cal-nav">
          <button class="nav-btn" onclick="moveCal(-1)">‹</button>
          <button class="nav-btn" onclick="goToday()">오늘</button>
          <button class="nav-btn" onclick="moveCal(1)">›</button>
        </div>
      </div>
      <div class="cal-grid">${DOWS.map(d=>`<div class="cal-dow">${d}</div>`).join('')}${cells}</div>
    </div>`;
}

function moveCal(d){
  calMonth+=d;
  if(calMonth>12){calMonth=1;calYear++;}
  if(calMonth<1){calMonth=12;calYear--;}
  renderCal();
}
function goToday(){
  calYear=parseInt(today.slice(0,4));
  calMonth=parseInt(today.slice(5,7));
  renderCal();
}

/* 목록 */
function renderList(){
  const list=getFiltered().sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
  document.getElementById('listView').innerHTML=`
    <div style="background:var(--surface);border-radius:var(--rad);box-shadow:var(--shadow);overflow:hidden">
      <table class="list-table">
        <thead><tr>
          <th>수주번호</th><th>고객사</th><th>제품명</th><th>수량</th>
          <th>수주일</th><th>납기일</th><th>실납기일</th><th>상태</th><th>담당자</th>
        </tr></thead>
        <tbody>
          ${list.map(i=>{
            const m=STATUS_META[i.status]||STATUS_META.scheduled;
            const dl=daysBetween(today,i.dueDate);
            const isUrgent=i.status!=='done'&&i.status!=='late'&&dl<=3&&dl>=0;
            return `<tr style="cursor:pointer" onclick="openModal('${i.id}')">
              <td style="font-family:monospace;font-size:.78rem">${i.poNo}</td>
              <td>${i.customer}</td>
              <td>${i.product}</td>
              <td>${i.qty.toLocaleString()}</td>
              <td>${i.orderDate}</td>
              <td style="font-weight:700;color:${i.status==='late'?'var(--red)':isUrgent?'var(--amber)':''}">
                ${i.dueDate} ${isUrgent?`<small>D-${dl}</small>`:''}
              </td>
              <td>${i.actualDate||'-'}</td>
              <td><span class="status-chip" style="background:${m.bg};color:${m.color}">${m.label}</span></td>
              <td>${i.manager}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

/* 통계 */
function renderStat(){
  const custs=[...new Set(items.map(i=>i.customer))].sort();
  const gauges=custs.map(c=>{
    const cItems=items.filter(i=>i.customer===c&&['done','late'].includes(i.status));
    const ontime=cItems.filter(i=>i.status==='done').length;
    const pct=cItems.length?Math.round(ontime/cItems.length*100):null;
    return {customer:c, pct, total:cItems.length};
  }).filter(g=>g.pct!==null).sort((a,b)=>b.pct-a.pct);

  const monthMap={};
  items.forEach(i=>{
    const k=i.dueDate.slice(0,7);
    if(!monthMap[k]) monthMap[k]={total:0,done:0,late:0};
    if(i.status==='done'||i.status==='late') monthMap[k].total++;
    if(i.status==='done') monthMap[k].done++;
    if(i.status==='late') monthMap[k].late++;
  });

  // 미션2: 주차별 납기 분포 (진행중 건 기준)
  const WEEK_LABELS=['지난주 이전','지난주','이번주','다음주','2주 후','3주 이상'];
  const weekDist=[0,0,0,0,0,0];
  items.filter(i=>i.status!=='done'&&i.status!=='late').forEach(i=>{
    const diff=daysBetween(today,i.dueDate);
    if(diff<-7) weekDist[0]++;
    else if(diff<0) weekDist[1]++;
    else if(diff<7) weekDist[2]++;
    else if(diff<14) weekDist[3]++;
    else if(diff<21) weekDist[4]++;
    else weekDist[5]++;
  });
  const maxW=Math.max(...weekDist,1);
  const wColors=['var(--red)','var(--amber)','var(--violet)','var(--blue)','var(--green)','#64748b'];
  const weeklyHtml=WEEK_LABELS.map((lb,i)=>`
    <div class="weekly-dist-row">
      <span class="weekly-dist-label">${lb}</span>
      <div class="weekly-dist-bar"><div class="weekly-dist-fill" style="width:${weekDist[i]/maxW*100}%;background:${wColors[i]}"></div></div>
      <span class="weekly-dist-count">${weekDist[i]}</span>
    </div>`).join('');

  document.getElementById('statView').innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
      <div style="background:var(--surface);border-radius:var(--rad);padding:16px;box-shadow:var(--shadow)">
        <div style="font-size:.88rem;font-weight:700;margin-bottom:12px">고객사별 납기 준수율</div>
        ${gauges.map(g=>`
          <div class="gauge-row">
            <span class="gauge-label">${g.customer}</span>
            <div class="gauge-bar"><div class="gauge-fill" style="width:${g.pct}%;background:${g.pct>=95?'var(--green)':g.pct>=85?'var(--amber)':'var(--red)'}"></div></div>
            <span class="gauge-pct" style="color:${g.pct>=95?'var(--green)':g.pct>=85?'var(--amber)':'var(--red)'}">${g.pct}%</span>
          </div>`).join('')}
      </div>
      <div style="background:var(--surface);border-radius:var(--rad);padding:16px;box-shadow:var(--shadow)">
        <div style="font-size:.88rem;font-weight:700;margin-bottom:12px">월별 납기 현황</div>
        <table style="width:100%;font-size:.8rem;border-collapse:collapse">
          <thead><tr style="border-bottom:2px solid var(--border)">
            <th style="padding:6px 8px;text-align:left;color:var(--sub)">월</th>
            <th style="padding:6px 8px;text-align:right;color:var(--sub)">완료</th>
            <th style="padding:6px 8px;text-align:right;color:var(--sub)">지연</th>
            <th style="padding:6px 8px;text-align:right;color:var(--sub)">준수율</th>
          </tr></thead>
          <tbody>
            ${Object.entries(monthMap).sort().map(([k,v])=>{
              const pct=v.total?Math.round(v.done/v.total*100):0;
              return `<tr style="border-bottom:1px solid var(--border)">
                <td style="padding:7px 8px;font-weight:700">${k}</td>
                <td style="padding:7px 8px;text-align:right;color:var(--green)">${v.done}</td>
                <td style="padding:7px 8px;text-align:right;color:var(--red)">${v.late}</td>
                <td style="padding:7px 8px;text-align:right;font-weight:700;color:${pct>=95?'var(--green)':pct>=85?'var(--amber)':'var(--red)'}">${pct}%</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
    <div class="weekly-dist-wrap" style="margin-top:14px;background:var(--surface);border-radius:var(--rad);padding:16px;box-shadow:var(--shadow)">
      <div style="font-size:.88rem;font-weight:700;margin-bottom:12px">📅 주차별 납기 분포 (진행중 건)</div>
      ${weeklyHtml}
    </div>`;
}

/* 모달 */
function openModal(id=null){
  editId=id;
  const item=id?items.find(x=>String(x.id)===String(id)):null;
  document.getElementById('modalTitle').textContent=id?'납기 수정':'납기 등록';
  document.getElementById('delBtn').style.display=id?'block':'none';
  document.getElementById('d-customer').value=item?.customer||'';
  document.getElementById('d-poNo').value=item?.poNo||'';
  document.getElementById('d-product').value=item?.product||'';
  document.getElementById('d-qty').value=item?.qty||'';
  document.getElementById('d-orderDate').value=item?.orderDate||today;
  document.getElementById('d-dueDate').value=item?.dueDate||'';
  document.getElementById('d-status').value=item?.status||'scheduled';
  document.getElementById('d-actualDate').value=item?.actualDate||'';
  document.getElementById('d-manager').value=item?.manager||'';
  document.getElementById('d-note').value=item?.note||'';
  document.getElementById('modal').classList.add('show');
}
function closeModal(){document.getElementById('modal').classList.remove('show');editId=null;}
function saveItem(){
  const dueDate=document.getElementById('d-dueDate').value;
  if(!dueDate){showToast('납기일을 입력하세요');return;}
  const isEdit=!!editId;
  const rec={id:editId||nextId++,
    customer:document.getElementById('d-customer').value,
    poNo:document.getElementById('d-poNo').value,
    product:document.getElementById('d-product').value,
    qty:parseInt(document.getElementById('d-qty').value)||0,
    orderDate:document.getElementById('d-orderDate').value,
    dueDate,
    status:document.getElementById('d-status').value,
    actualDate:document.getElementById('d-actualDate').value,
    manager:document.getElementById('d-manager').value,
    note:document.getElementById('d-note').value,
  };
  if(editId){const i=items.findIndex(x=>String(x.id)===String(editId));if(i>=0)items[i]=rec;}
  else items.push(rec);
  save();closeModal();render();
  showToast(isEdit?'납기 정보가 수정되었습니다.':'납기 건이 등록되었습니다.');
}
function deleteItem(){
  if(!confirm('삭제하시겠습니까?'))return;
  items=items.filter(x=>String(x.id)!==String(editId));
  save();closeModal();render();
}

function exportCSV(){
  const rows=['수주번호,고객사,제품명,수량,수주일,납기일,실납기일,상태,담당자'];
  items.forEach(i=>rows.push(`${i.poNo},${i.customer},${i.product},${i.qty},${i.orderDate},${i.dueDate},${i.actualDate||''},${STATUS_META[i.status]?.label},${i.manager}`));
  const blob=new Blob(['﻿'+rows.join('\n')],{type:'text/csv;charset=utf-8;'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='납기일정.csv';a.click();
}

/* 토스트 */
let _toastTimer=null;
function showToast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg;t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer=setTimeout(()=>t.classList.remove('show'),2800);
}

/* 미션1: 납기 임박 경보 배너 (D-3 이내 미완료) */
function renderUrgentBanner(){
  const el=document.getElementById('urgentBanner');
  const urgent=items.filter(i=>
    i.status!=='done'&&i.status!=='late'&&
    i.dueDate>=today&&daysBetween(today,i.dueDate)<=3
  );
  if(!urgent.length){el.style.display='none';return;}
  el.style.display='flex';
  el.innerHTML='⚠ 납기 D-3 이내 '+urgent.length+'건: '+
    urgent.map(i=>`<span style="background:rgba(255,255,255,.2);padding:2px 8px;border-radius:4px">${i.customer.replace('(주)','').slice(0,4)} ${i.product} (D-${daysBetween(today,i.dueDate)})</span>`).join(' ');
}

/* 미션3: 납기 경과 건 자동 "납기지연" 전환 */
function autoUpdateLateStatus(){
  let changed=false;
  items.forEach(i=>{
    if(i.status!=='done'&&i.status!=='late'&&i.dueDate<today){
      i.status='late';changed=true;
    }
  });
  if(changed){
    save();
    showToast('납기 경과 건의 상태가 자동으로 "납기지연"으로 변경되었습니다.');
  }
}

function openReport(){
  const todayStr=new Date().toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric'});
  const total=items.length;
  const doneCnt=items.filter(i=>i.status==='done').length;
  const lateCnt=items.filter(i=>i.status==='late').length;
  const rate=total>0?Math.round(doneCnt/total*100):0;
  const rows=items.map(i=>{
    const sm=STATUS_META[i.status]||{label:i.status,color:'#888'};
    const dClass=i.status==='late'?'rpt-bad':i.status==='delay'?'rpt-warn':i.status==='done'?'rpt-good':'';
    return `<tr><td style="text-align:left;font-family:monospace;font-size:8pt">${i.poNo}</td><td style="text-align:left">${i.customer}</td><td style="text-align:left">${i.product}</td><td class="num">${i.qty.toLocaleString()}</td><td>${i.orderDate}</td><td>${i.dueDate}</td><td>${i.actualDate||'-'}</td><td>${i.manager}</td><td class="${dClass}"><span style="color:${sm.color};font-weight:700">${sm.label}</span></td></tr>`;
  }).join('');
  document.getElementById('rptPage').innerHTML=`
    <div class="rpt-company"><strong>(주)PCB 제조</strong> | 영업관리<br>출력일: ${todayStr}</div>
    <div class="rpt-doc-title"><h1>납기일정 현황 보고서</h1><p>전체 납기일정 현황 분석</p></div>
    <div class="rpt-kpi-grid">
      <div class="rpt-kpi-card"><div class="rk-label">전체</div><div class="rk-val">${total}</div><div class="rk-unit">건</div></div>
      <div class="rpt-kpi-card"><div class="rk-label">납기완료</div><div class="rk-val" style="color:#059669">${doneCnt}</div><div class="rk-unit">건</div></div>
      <div class="rpt-kpi-card"><div class="rk-label">납기지연</div><div class="rk-val" style="color:#dc2626">${lateCnt}</div><div class="rk-unit">건</div></div>
      <div class="rpt-kpi-card"><div class="rk-label">납기준수율</div><div class="rk-val" style="color:${rate>=90?'#059669':rate>=70?'#d97706':'#dc2626'}">${rate}</div><div class="rk-unit">%</div></div>
    </div>
    <div class="rpt-sec"><div class="rpt-sec-title">■ 납기일정 목록</div>
      <table class="rpt-table"><thead><tr><th>수주번호</th><th>고객사</th><th>제품명</th><th>수량</th><th>수주일</th><th>납기일</th><th>실제납기일</th><th>담당자</th><th>상태</th></tr></thead><tbody>${rows}</tbody></table>
    </div>
    <table class="rpt-sign"><tr>
      <td class="rpt-label">작성</td><td class="sign-box"></td>
      <td class="rpt-label">검토</td><td class="sign-box"></td>
      <td class="rpt-label">승인</td><td class="sign-box"></td>
    </tr></table>
    <div class="rpt-footer">본 보고서는 시스템에서 자동 생성되었습니다. | 출력: ${todayStr}</div>`;
  document.getElementById('rptOverlay').classList.add('show');
}
function closeReport(){document.getElementById('rptOverlay').classList.remove('show');}
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    const ov=document.getElementById('rptOverlay');
    if(ov.classList.contains('show')){closeReport();return;}
    closeModal();
  }
});

render();
