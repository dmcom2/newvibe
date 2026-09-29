// 고객 클레임 관리(8D) 앱 스크립트
const today=new Date().toISOString().slice(0,10);

const STATUS_META={
  open:{label:'접수',color:'#64748b',bg:'#f1f5f9'},
  analysis:{label:'원인분석',color:'#2563eb',bg:'#dbeafe'},
  action:{label:'대책수립',color:'#d97706',bg:'#fef3c7'},
  verify:{label:'효과검증',color:'#7c3aed',bg:'#ede9fe'},
  closed:{label:'완료',color:'#059669',bg:'#dcfce7'},
};
const SEV_META={
  critical:{label:'긴급',color:'#dc2626',bg:'#fee2e2'},
  major:{label:'중요',color:'#d97706',bg:'#fef3c7'},
  minor:{label:'경미',color:'#64748b',bg:'#f1f5f9'},
};
const D_COLORS=['#64748b','#2563eb','#dc2626','#7c3aed','#d97706','#059669','#0891b2','#475569'];

/* 미션3: SLA 기한 기준 (일) */
const SLA_DAYS={critical:5,major:10,minor:20};

let claims=JSON.parse(localStorage.getItem('pcbClaims')||'null')||genSample();
let selectedId=null, editId=null, nextId=Date.now();

function genSample(){
  const custs=['(주)삼성전자','LG이노텍','현대모비스','(주)코리아서킷'];
  const prds=['PCB-A2401','PCB-B1802','PCB-C3305','PCB-D0401'];
  const issues=['단락(Short) 발생','외관 스크래치','솔더마스크 박리','치수 불량','드릴홀 위치 편차','절연저항 불량'];
  const sts=Object.keys(STATUS_META);
  const sevs=['critical','major','major','minor','minor'];
  return Array.from({length:10},(_,i)=>{
    const d=String((i%20)+1).padStart(2,'0');
    const m=String(Math.floor(i/5)+4).padStart(2,'0');
    return {id:Date.now()+i,
      no:`8D-${today.slice(0,4)}${m}-${String(i+1).padStart(3,'0')}`,
      date:`${today.slice(0,4)}-${m}-${d}`,
      customer:custs[i%4],product:prds[i%4],
      sev:sevs[i%5],status:sts[i%5],
      qty:10+i*5,manager:'박품질',
      d1:'품질팀장, 생산팀장, 공정엔지니어',
      d2:`${issues[i%6]}으로 인한 고객 클레임 접수. 수량: ${10+i*5}매, 불량률 ${(1+i*0.2).toFixed(1)}%`,
      d3:'불량 LOT 전수 출하 중단 및 재검사 실시',
      d4:`Why1: ${issues[i%6]} 발생 → Why2: 공정 파라미터 이탈 → Why3: 설비 노후화`,
      d5:'설비 정기 점검 주기 단축, 공정 파라미터 관리 기준 강화',
      d6:i<5?'조치 완료 후 샘플 검사 결과 이상 없음':'진행 중',
      d7:'유사 공정 전체 파라미터 재검토 및 작업 표준서 개정',
      d8:sts[i%5]==='closed'?`${today.slice(0,4)}-${m}-${String(parseInt(d)+5).padStart(2,'0')} 종결 완료`:'',
    };
  });
}
function save(){localStorage.setItem('pcbClaims',JSON.stringify(claims));}

function showToast(msg){
  const t=document.getElementById('toast');
  clearTimeout(t._tid);t.textContent=msg;t.classList.add('show');
  t._tid=setTimeout(()=>t.classList.remove('show'),2800);
}

/* 미션3: SLA 기한 상태 계산 */
function getSlaStatus(c){
  if(c.status==='closed') return null;
  const elapsed=Math.ceil((new Date(today)-new Date(c.date))/86400000);
  const limit=SLA_DAYS[c.sev];
  const left=limit-elapsed;
  if(left<0) return {type:'overdue',daysOver:-left};
  if(left<=2) return {type:'warn',daysLeft:left};
  return null;
}

function renderKPI(){
  const open=claims.filter(c=>c.status==='open').length;
  const critical=claims.filter(c=>c.sev==='critical'&&c.status!=='closed').length;
  const closed=claims.filter(c=>c.status==='closed').length;
  const total=claims.length;
  const rate=total?Math.round(closed/total*100):0;
  const avgDays=closed?Math.round(claims.filter(c=>c.status==='closed').reduce((s,c)=>{
    const d=c.d8?.slice(0,10);
    if(!d) return s;
    return s+Math.max(0,Math.ceil((new Date(d)-new Date(c.date))/(86400000)));
  },0)/closed):0;
  document.getElementById('kpiRow').innerHTML=`
    <div class="kpi" style="border-top-color:var(--slate)"><div class="kpi-l">전체 클레임</div><div class="kpi-v" style="color:var(--slate)">${total}</div><div class="kpi-sub">건</div></div>
    <div class="kpi" style="border-top-color:var(--red)"><div class="kpi-l">긴급 미결</div><div class="kpi-v" style="color:var(--red)">${critical}</div><div class="kpi-sub">건</div></div>
    <div class="kpi" style="border-top-color:var(--amber)"><div class="kpi-l">처리중</div><div class="kpi-v" style="color:var(--amber)">${open}</div><div class="kpi-sub">건</div></div>
    <div class="kpi" style="border-top-color:var(--green)"><div class="kpi-l">처리 완료</div><div class="kpi-v" style="color:var(--green)">${closed}</div><div class="kpi-sub">건</div></div>
    <div class="kpi" style="border-top-color:var(--blue)"><div class="kpi-l">평균 처리일</div><div class="kpi-v" style="color:var(--blue)">${avgDays}</div><div class="kpi-sub">일</div></div>`;
}

/* 미션1: 긴급 클레임 경보 배너 */
function renderAlertBanner(){
  const criticals=claims.filter(c=>c.sev==='critical'&&c.status!=='closed');
  const overdue=claims.filter(c=>c.status!=='closed'&&getSlaStatus(c)?.type==='overdue');
  const banner=document.getElementById('claimAlertBanner');
  if(criticals.length===0&&overdue.length===0){banner.style.display='none';return;}
  const parts=[];
  if(criticals.length>0) parts.push(`<span>긴급</span> ${criticals.length}건의 Critical 클레임이 미결입니다.`);
  if(overdue.length>0) parts.push(`<span>기한초과</span> ${overdue.length}건이 SLA 처리 기한을 초과했습니다.`);
  banner.innerHTML='🚨 '+parts.join(' &nbsp;|&nbsp; ');
  banner.style.display='flex';
}

/* 미션2: 상태별/심각도별 현황 바 차트 */
function renderStatusChart(){
  const total=claims.length||1;
  const statusBars=Object.entries(STATUS_META).map(([k,v])=>{
    const cnt=claims.filter(c=>c.status===k).length;
    const pct=Math.round(cnt/total*100);
    return `<div class="sc-bar-row"><span class="sc-bar-label">${v.label}</span><div class="sc-bar-track"><div class="sc-bar-fill" style="width:${pct}%;background:${v.color}"></div></div><span class="sc-bar-cnt" style="color:${v.color}">${cnt}</span></div>`;
  }).join('');
  const sevBars=Object.entries(SEV_META).map(([k,v])=>{
    const cnt=claims.filter(c=>c.sev===k).length;
    const pct=Math.round(cnt/total*100);
    return `<div class="sc-bar-row"><span class="sc-bar-label">${v.label}</span><div class="sc-bar-track"><div class="sc-bar-fill" style="width:${pct}%;background:${v.color}"></div></div><span class="sc-bar-cnt" style="color:${v.color}">${cnt}</span></div>`;
  }).join('');
  document.getElementById('statusChart').innerHTML=`
    <div class="status-chart-wrap">
      <div><div class="sc-title">처리 상태별 현황</div>${statusBars}</div>
      <div><div class="sc-title">심각도별 현황</div>${sevBars}</div>
    </div>`;
}

function getFiltered(){
  const q=document.getElementById('searchQ').value.toLowerCase();
  const s=document.getElementById('statusF').value;
  const sev=document.getElementById('sevF').value;
  return claims.filter(c=>{
    const mq=!q||c.no.toLowerCase().includes(q)||c.customer.includes(q)||c.product.toLowerCase().includes(q)||c.d2?.includes(q);
    return mq&&(!s||c.status===s)&&(!sev||c.sev===sev);
  }).sort((a,b)=>{
    const so={critical:0,major:1,minor:2};
    if(so[a.sev]!==so[b.sev]) return so[a.sev]-so[b.sev];
    return b.date.localeCompare(a.date);
  });
}

function render(){
  renderKPI();
  renderAlertBanner();
  renderStatusChart();
  const list=getFiltered();
  document.getElementById('claimList').innerHTML=list.map(c=>{
    const sm=STATUS_META[c.status];
    const sev=SEV_META[c.sev];
    const sla=getSlaStatus(c);
    const slaBadge=sla?.type==='overdue'?`<span class="sla-overdue">기한+${sla.daysOver}일</span>`:
                    sla?.type==='warn'?`<span class="sla-warn">D-${sla.daysLeft}</span>`:'';
    return `<div class="claim-item ${String(c.id)===String(selectedId)?'selected':''}" onclick="selectClaim('${c.id}')">
      <div class="ci-header">
        <span class="ci-no">${c.no}</span>
        <span class="status-chip" style="background:${sm.bg};color:${sm.color}">${sm.label}</span>
      </div>
      <div class="ci-title">${c.d2?.slice(0,35)||'(내용없음)'}${(c.d2?.length||0)>35?'...':''}</div>
      <div class="ci-customer">${c.customer} | ${c.product}</div>
      <div class="ci-meta">
        <span><span class="sev-dot" style="background:${sev.color}"></span>${sev.label}</span>
        <span>${c.date}</span>
        <span>${c.manager}</span>
        ${slaBadge}
      </div>
    </div>`;
  }).join('')||'<div style="text-align:center;padding:30px;color:var(--mute)">검색 결과 없음</div>';
}

function selectClaim(id){
  selectedId=id;
  const c=claims.find(x=>String(x.id)===String(id));
  if(!c) return;
  const sm=STATUS_META[c.status];
  const sev=SEV_META[c.sev];
  const steps=[
    {d:'D1',title:'팀 구성',content:c.d1},
    {d:'D2',title:'문제 정의',content:c.d2},
    {d:'D3',title:'긴급 봉쇄 조치',content:c.d3},
    {d:'D4',title:'근본 원인 분석',content:c.d4},
    {d:'D5',title:'영구 시정 조치 계획',content:c.d5},
    {d:'D6',title:'시정 조치 실시 및 검증',content:c.d6},
    {d:'D7',title:'재발 방지 대책',content:c.d7},
    {d:'D8',title:'팀 공인 및 종결',content:c.d8},
  ];
  document.getElementById('reportPanel').innerHTML=`
    <div class="report-header">
      <div>
        <div style="font-size:.78rem;color:var(--mute)">${c.no} | ${c.date}</div>
        <div style="font-size:.95rem;font-weight:800">${c.customer} — ${c.product}</div>
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        <span class="status-chip" style="background:${sev.bg};color:${sev.color}">${sev.label}</span>
        <span class="status-chip" style="background:${sm.bg};color:${sm.color}">${sm.label}</span>
        <button class="btn btn-outline" style="font-size:.75rem;padding:4px 10px" onclick="openModal('${c.id}')">수정</button>
        <button class="btn btn-ghost" style="font-size:.75rem;padding:4px 10px;background:var(--slate);color:#fff" onclick="window.print()">🖨</button>
      </div>
    </div>
    <div style="padding:16px 20px">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px;background:var(--bg);border-radius:8px;padding:12px">
        <div><div style="font-size:.7rem;color:var(--mute)">클레임 수량</div><div style="font-weight:700">${c.qty} 매</div></div>
        <div><div style="font-size:.7rem;color:var(--mute)">담당자</div><div style="font-weight:700">${c.manager}</div></div>
        <div><div style="font-size:.7rem;color:var(--mute)">접수일</div><div style="font-weight:700">${c.date}</div></div>
      </div>
      ${steps.map((s,i)=>`
        <div class="d-step">
          <div class="d-step-header" style="background:${D_COLORS[i]}15">
            <div class="d-badge" style="background:${D_COLORS[i]}">${s.d}</div>
            <span style="color:${D_COLORS[i]}">${s.title}</span>
          </div>
          <div class="d-body ${s.content?'':'empty'}">${s.content||'미입력'}</div>
        </div>`).join('')}
    </div>`;
  render();
}

function openModal(id=null){
  editId=id;
  const c=id?claims.find(x=>String(x.id)===String(id)):null;
  document.getElementById('modalTitle').textContent=id?'클레임 수정':'클레임 등록';
  document.getElementById('delBtn').style.display=id?'block':'none';
  const newNo=`8D-${today.slice(0,4)}${today.slice(5,7)}-${String(claims.length+1).padStart(3,'0')}`;
  document.getElementById('c-no').value=c?.no||newNo;
  document.getElementById('c-date').value=c?.date||today;
  document.getElementById('c-customer').value=c?.customer||'';
  document.getElementById('c-product').value=c?.product||'';
  document.getElementById('c-sev').value=c?.sev||'major';
  document.getElementById('c-status').value=c?.status||'open';
  document.getElementById('c-qty').value=c?.qty||'';
  document.getElementById('c-manager').value=c?.manager||'';
  ['d1','d2','d3','d4','d5','d6','d7','d8'].forEach(k=>{document.getElementById(k).value=c?.[k]||'';});
  document.getElementById('modal').classList.add('show');
}
function closeModal(){document.getElementById('modal').classList.remove('show');editId=null;}

function saveItem(){
  const customer=document.getElementById('c-customer').value.trim();
  if(!customer){showToast('고객사를 입력하세요.');return;}
  const rec={id:editId||nextId++,
    no:document.getElementById('c-no').value,
    date:document.getElementById('c-date').value,
    customer,product:document.getElementById('c-product').value,
    sev:document.getElementById('c-sev').value,
    status:document.getElementById('c-status').value,
    qty:parseInt(document.getElementById('c-qty').value)||0,
    manager:document.getElementById('c-manager').value,
    d1:document.getElementById('d1').value,d2:document.getElementById('d2').value,
    d3:document.getElementById('d3').value,d4:document.getElementById('d4').value,
    d5:document.getElementById('d5').value,d6:document.getElementById('d6').value,
    d7:document.getElementById('d7').value,d8:document.getElementById('d8').value,
  };
  if(editId){const i=claims.findIndex(x=>String(x.id)===String(editId));if(i>=0)claims[i]=rec;}
  else claims.push(rec);
  save();closeModal();
  selectedId=rec.id;
  render();selectClaim(rec.id);
  showToast('클레임이 저장되었습니다.');
}
function deleteItem(){
  if(!confirm('삭제하시겠습니까?'))return;
  claims=claims.filter(x=>String(x.id)!==String(editId));
  save();closeModal();selectedId=null;
  document.getElementById('reportPanel').innerHTML='<div style="text-align:center;padding:40px;color:var(--mute)">클레임을 선택하세요</div>';
  render();
}

function exportCSV(){
  const rows=['번호,접수일,고객사,제품,심각도,상태,수량,담당자,D2문제,D4원인,D7재발방지'];
  claims.forEach(c=>rows.push(`${c.no},${c.date},${c.customer},${c.product},${SEV_META[c.sev]?.label},${STATUS_META[c.status]?.label},${c.qty},${c.manager},"${c.d2||''}","${c.d4||''}","${c.d7||''}"`));
  const blob=new Blob(['﻿'+rows.join('\n')],{type:'text/csv;charset=utf-8;'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='클레임현황.csv';a.click();
}

render();
if(claims.length>0) selectClaim(claims[0].id);
