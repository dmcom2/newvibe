// 작업지시서 관리 스크립트

const STATUS_META = {
  waiting: {label:'대기', color:'#6b7280', bg:'#f3f4f6'},
  progress: {label:'진행중', color:'#2563eb', bg:'#eff6ff'},
  inspect: {label:'검사중', color:'#d97706', bg:'#fffbeb'},
  done: {label:'완료', color:'#059669', bg:'#f0fdf4'},
  hold: {label:'보류', color:'#dc2626', bg:'#fef2f2'},
};

// 미션 3: 공정 타임라인 단계
const PROCESS_STEPS = ['원자재 준비', '드릴링', '도금', '에칭', '솔더마스크', 'AOI 검사', '외형 가공', '포장/출하'];

const SAMPLE_WOS = [
  {id:'WO001', no:'WO-2026-001', customer:'(주)삼성전자', orderNo:'PO-2026-071', product:'PCB-A2401', layer:'4층', qty:2000, line:'1호기', issueDate:'2026-07-25', startDate:'2026-07-28', dueDate:'2026-08-07', worker:'김생산', status:'progress', step:4, produced:1200, note:''},
  {id:'WO002', no:'WO-2026-002', customer:'LG이노텍', orderNo:'PO-2026-072', product:'PCB-B3301', layer:'양면', qty:5000, line:'2호기', issueDate:'2026-07-26', startDate:'2026-07-29', dueDate:'2026-08-08', worker:'이공정', status:'inspect', step:6, produced:5000, note:'AOI 진행 중'},
  {id:'WO003', no:'WO-2026-003', customer:'현대모비스', orderNo:'PO-2026-073', product:'PCB-C1201', layer:'6층', qty:800, line:'3호기', issueDate:'2026-07-27', startDate:'2026-07-30', dueDate:'2026-08-09', worker:'박제조', status:'progress', step:3, produced:350, note:''},
  {id:'WO004', no:'WO-2026-004', customer:'(주)현대전자', orderNo:'PO-2026-074', product:'PCB-D5501', layer:'단면', qty:10000, line:'1호기', issueDate:'2026-07-28', startDate:'2026-08-01', dueDate:'2026-08-05', worker:'최라인', status:'done', step:8, produced:10000, note:'완료'},
  {id:'WO005', no:'WO-2026-005', customer:'SK하이닉스', orderNo:'PO-2026-075', product:'PCB-E8801', layer:'8층', qty:300, line:'4호기', issueDate:'2026-07-30', startDate:'2026-08-04', dueDate:'2026-08-06', worker:'한담당', status:'progress', step:2, produced:80, note:'고난도 기판'},
  {id:'WO006', no:'WO-2026-006', customer:'보쉬코리아', orderNo:'PO-2026-076', product:'PCB-F2201', layer:'양면', qty:3000, line:'2호기', issueDate:'2026-08-01', startDate:'2026-08-05', dueDate:'2026-08-15', worker:'이공정', status:'waiting', step:0, produced:0, note:''},
  {id:'WO007', no:'WO-2026-007', customer:'덴소코리아', orderNo:'PO-2026-077', product:'PCB-G4401', layer:'4층', qty:1500, line:'3호기', issueDate:'2026-08-02', startDate:'2026-08-06', dueDate:'2026-08-20', worker:'박제조', status:'waiting', step:0, produced:0, note:''},
  {id:'WO008', no:'WO-2026-008', customer:'LS전선', orderNo:'PO-2026-078', product:'PCB-H1101', layer:'단면', qty:8000, line:'4호기', issueDate:'2026-08-03', startDate:'2026-08-04', dueDate:'2026-08-06', worker:'최라인', status:'hold', step:1, produced:200, note:'원자재 공급 지연'},
];

let wos = [], activeFilter = '', editId = null;

function getWos() { try { return JSON.parse(localStorage.getItem('wo_list')) || SAMPLE_WOS; } catch { return SAMPLE_WOS; } }
function saveWos() { localStorage.setItem('wo_list', JSON.stringify(wos)); }

let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

function daysUntil(dateStr) {
  const now = new Date(); now.setHours(0,0,0,0);
  const d = new Date(dateStr);
  return Math.ceil((d - now) / 86400000);
}

// ── 미션 1: 납기 D-3 경보 배너 ──
function renderDueAlert() {
  const urgentWos = wos.filter(w => w.status !== 'done' && w.status !== 'hold' && daysUntil(w.dueDate) <= 3);
  const el = document.getElementById('dueAlert');
  if (!urgentWos.length) { el.style.display = 'none'; return; }
  el.style.display = 'flex';
  el.innerHTML = `🚨 <strong>납기 임박 ${urgentWos.length}건</strong> &nbsp;|&nbsp;
    ${urgentWos.slice(0, 3).map(w => {
      const d = daysUntil(w.dueDate);
      return `<span style="background:rgba(255,255,255,.2);border-radius:4px;padding:2px 8px">${w.product} — D${d <= 0 ? d : '+' + d > 0 ? '-' + Math.abs(d) : d}(${w.dueDate})</span>`;
    }).join(' ')}
    ${urgentWos.length > 3 ? `<span>외 ${urgentWos.length - 3}건</span>` : ''}`;
}

// ── 미션 2: 라인별 작업 부하 현황 ──
function renderLineLoad() {
  const lines = ['1호기','2호기','3호기','4호기'];
  const wrap = document.getElementById('lineLoadWrap');
  wrap.className = 'line-load-grid';
  wrap.innerHTML = lines.map(line => {
    const lineWos = wos.filter(w => w.line === line && (w.status === 'progress' || w.status === 'inspect' || w.status === 'waiting'));
    const active = wos.filter(w => w.line === line && (w.status === 'progress' || w.status === 'inspect')).length;
    const total = lineWos.length;
    const load = Math.min(total / 3, 1);
    const fillColor = load > 0.8 ? 'var(--red)' : load > 0.5 ? 'var(--amber)' : 'var(--green)';
    return `<div class="ll-card">
      <div class="ll-name">🏭 ${line}</div>
      <div class="ll-stats">
        <span>진행중 <span class="ll-stat-v" style="color:var(--blue)">${active}</span>건</span>
        <span>대기 <span class="ll-stat-v" style="color:var(--mute)">${total - active}</span>건</span>
      </div>
      <div class="ll-track"><div class="ll-fill" style="width:${load*100}%;background:${fillColor}"></div></div>
    </div>`;
  }).join('');
}

function renderKPI() {
  const total = wos.length;
  const active = wos.filter(w => w.status === 'progress').length;
  const done = wos.filter(w => w.status === 'done').length;
  const hold = wos.filter(w => w.status === 'hold').length;
  const overdue = wos.filter(w => w.status !== 'done' && daysUntil(w.dueDate) < 0).length;
  document.getElementById('kpiRow').innerHTML = `
    <div class="kpi" style="border-top:3px solid var(--sub)"><div class="kpi-l">전체</div><div class="kpi-v">${total}</div><div class="kpi-sub">작업지시서</div></div>
    <div class="kpi" style="border-top:3px solid var(--blue)"><div class="kpi-l">진행중</div><div class="kpi-v">${active}</div><div class="kpi-sub">건</div></div>
    <div class="kpi" style="border-top:3px solid var(--green)"><div class="kpi-l">완료</div><div class="kpi-v">${done}</div><div class="kpi-sub">건</div></div>
    <div class="kpi" style="border-top:3px solid var(--red)"><div class="kpi-l">보류</div><div class="kpi-v">${hold}</div><div class="kpi-sub">건</div></div>
    <div class="kpi" style="border-top:3px solid var(--red)"><div class="kpi-l">납기 초과</div><div class="kpi-v" style="color:var(--red)">${overdue}</div><div class="kpi-sub">건</div></div>`;
}

// ── 미션 3: 공정 타임라인 렌더링 ──
function buildTimeline(wo) {
  const steps = PROCESS_STEPS;
  const curStep = wo.step || 0;
  const pairs = [];
  steps.forEach((s, i) => {
    if (i > 0) pairs.push({type:'line', done: i <= curStep});
    pairs.push({type:'step', label: s, done: i < curStep, current: i === curStep});
  });
  return `<div class="proc-timeline">${pairs.map(p => {
    if (p.type === 'line') return `<div class="proc-line${p.done ? ' done' : ''}"></div>`;
    const cls = p.done ? 'done' : p.current ? 'current' : '';
    return `<div class="proc-step">
      <div class="proc-dot ${cls}"></div>
      <div class="proc-label ${cls}">${p.label}</div>
    </div>`;
  }).join('')}</div>`;
}

function renderCards() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const line = document.getElementById('lineFilter').value;
  let filtered = wos.filter(w => {
    const matchText = !search || w.no.toLowerCase().includes(search) || w.product.toLowerCase().includes(search) || w.customer.toLowerCase().includes(search);
    const matchStatus = !activeFilter || w.status === activeFilter;
    const matchLine = !line || w.line === line;
    return matchText && matchStatus && matchLine;
  });
  filtered.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const container = document.getElementById('woCards');
  container.innerHTML = filtered.map(wo => {
    const m = STATUS_META[wo.status] || STATUS_META.waiting;
    const prog = wo.qty > 0 ? Math.round(wo.produced / wo.qty * 100) : 0;
    const du = daysUntil(wo.dueDate);
    const dueClass = du <= 0 ? 'due-warn' : du <= 3 ? 'due-warn' : '';
    const dueLabel = du < 0 ? `납기 ${Math.abs(du)}일 초과` : du === 0 ? '오늘 납기' : `D-${du}`;
    return `<div class="wo-card" style="border-left-color:${m.color}" onclick="openModal('${wo.id}')">
      <div class="wo-header">
        <div>
          <div class="wo-no">${wo.no}</div>
          <div class="wo-product">${wo.product}</div>
          <div class="wo-customer">${wo.customer}</div>
        </div>
        <span class="status-badge" style="background:${m.bg};color:${m.color}">${m.label}</span>
      </div>
      <div class="wo-info">
        <span class="wi-label">라인</span><span class="wi-value">${wo.line}</span>
        <span class="wi-label">지시수량</span><span class="wi-value">${wo.qty.toLocaleString()} 매</span>
        <span class="wi-label">층수</span><span class="wi-value">${wo.layer}</span>
        <span class="wi-label">납기일</span><span class="wi-value ${dueClass}">${wo.dueDate} (${dueLabel})</span>
      </div>
      <div class="wo-progress">
        <div class="wo-prog-row">
          <span style="color:var(--mute)">생산진도</span>
          <div class="wo-prog-bar"><div class="wo-prog-fill" style="width:${prog}%;background:${m.color}"></div></div>
          <span style="font-weight:700;color:${m.color}">${prog}%</span>
        </div>
      </div>
      ${buildTimeline(wo)}
      <div class="wo-tags">
        <span class="wo-tag">👷 ${wo.worker}</span>
        <span class="wo-tag">🏭 ${wo.line}</span>
        ${wo.note ? `<span class="wo-tag">💬 ${wo.note.slice(0, 12)}${wo.note.length > 12 ? '...' : ''}</span>` : ''}
      </div>
    </div>`;
  }).join('') || '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--mute)">조회된 작업지시서가 없습니다.</div>';
}

function filterStatus(status, btn) {
  activeFilter = status;
  document.querySelectorAll('.sf-btn').forEach(b => {
    b.classList.remove('active');
    b.style.background = 'transparent';
    b.style.color = 'var(--sub)';
  });
  btn.classList.add('active');
  const m = STATUS_META[status];
  btn.style.background = m ? m.color : 'var(--sub)';
  btn.style.color = '#fff';
  renderCards();
}

function openModal(woId) {
  editId = woId || null;
  const modal = document.getElementById('modal');
  const delBtn = document.getElementById('delBtn');
  const today = new Date().toISOString().split('T')[0];

  if (woId) {
    const wo = wos.find(w => w.id === woId);
    document.getElementById('modalTitle').textContent = '작업지시서 상세/수정';
    document.getElementById('w-no').value = wo.no;
    document.getElementById('w-issueDate').value = wo.issueDate;
    document.getElementById('w-customer').value = wo.customer;
    document.getElementById('w-orderNo').value = wo.orderNo;
    document.getElementById('w-product').value = wo.product;
    document.getElementById('w-layer').value = wo.layer;
    document.getElementById('w-qty').value = wo.qty;
    document.getElementById('w-line').value = wo.line;
    document.getElementById('w-startDate').value = wo.startDate;
    document.getElementById('w-dueDate').value = wo.dueDate;
    document.getElementById('w-worker').value = wo.worker;
    document.getElementById('w-status').value = wo.status;
    document.getElementById('w-produced').value = wo.produced;
    document.getElementById('w-note').value = wo.note;
    delBtn.style.display = '';
  } else {
    document.getElementById('modalTitle').textContent = '작업지시서 발행';
    const newNo = 'WO-2026-' + String(wos.length + 1).padStart(3, '0');
    document.getElementById('w-no').value = newNo;
    document.getElementById('w-issueDate').value = today;
    document.getElementById('w-startDate').value = today;
    document.getElementById('w-dueDate').value = '';
    ['w-customer','w-orderNo','w-product','w-produced','w-note','w-worker'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('w-qty').value = '';
    document.getElementById('w-status').value = 'waiting';
    delBtn.style.display = 'none';
  }
  renderStepBtns(editId ? wos.find(w => w.id === woId)?.step || 0 : 0);
  modal.classList.add('show');
}

function renderStepBtns(currentStep) {
  const container = document.getElementById('stepBtns');
  container.innerHTML = PROCESS_STEPS.map((s, i) =>
    `<button class="step-btn${i === currentStep ? ' active' : ''}" onclick="selectStep(${i},this)">${i + 1}.${s}</button>`
  ).join('');
}

function selectStep(idx, btn) {
  document.querySelectorAll('.step-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function getSelectedStep() {
  const active = document.querySelector('.step-btn.active');
  if (!active) return 0;
  return Array.from(document.querySelectorAll('.step-btn')).indexOf(active);
}

function closeModal() { document.getElementById('modal').classList.remove('show'); }

function saveWO() {
  const product = document.getElementById('w-product').value.trim();
  const customer = document.getElementById('w-customer').value.trim();
  const dueDate = document.getElementById('w-dueDate').value;
  if (!product || !customer || !dueDate) { showToast('제품명, 고객사, 납기일은 필수입니다.'); return; }
  const data = {
    no: document.getElementById('w-no').value,
    issueDate: document.getElementById('w-issueDate').value,
    customer, orderNo: document.getElementById('w-orderNo').value,
    product, layer: document.getElementById('w-layer').value,
    qty: parseInt(document.getElementById('w-qty').value) || 0,
    line: document.getElementById('w-line').value,
    startDate: document.getElementById('w-startDate').value, dueDate,
    worker: document.getElementById('w-worker').value,
    status: document.getElementById('w-status').value,
    step: getSelectedStep(),
    produced: parseInt(document.getElementById('w-produced').value) || 0,
    note: document.getElementById('w-note').value,
  };
  if (editId) {
    const idx = wos.findIndex(w => w.id === editId);
    wos[idx] = {...wos[idx], ...data};
    showToast('작업지시서가 수정되었습니다.');
  } else {
    data.id = 'WO' + Date.now();
    wos.push(data);
    showToast('작업지시서가 발행되었습니다.');
  }
  saveWos(); closeModal(); renderAll();
}

function deleteWO() {
  if (!confirm('작업지시서를 삭제하시겠습니까?')) return;
  wos = wos.filter(w => w.id !== editId);
  saveWos(); closeModal(); renderAll();
  showToast('삭제되었습니다.');
}

function printWO() { window.print(); }

function exportCSV() {
  let csv = '지시번호,고객사,제품명,층수,지시수량,라인,착수일,납기일,담당자,상태,생산완료,진행률\n';
  wos.forEach(w => {
    const prog = w.qty > 0 ? Math.round(w.produced / w.qty * 100) : 0;
    csv += `"${w.no}","${w.customer}","${w.product}","${w.layer}",${w.qty},"${w.line}","${w.startDate}","${w.dueDate}","${w.worker}","${STATUS_META[w.status]?.label || w.status}",${w.produced},${prog}%\n`;
  });
  const blob = new Blob(['﻿' + csv], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `작업지시서_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  showToast('저장되었습니다.');
}

function renderAll() {
  renderDueAlert();
  renderKPI();
  renderLineLoad();
  renderCards();
}

function init() {
  wos = getWos();
  renderAll();
}

function openReport(){
  const all=getWos();
  const total=all.length;
  const inProg=all.filter(w=>w.status==='progress'||w.status==='inspect').length;
  const done=all.filter(w=>w.status==='done').length;
  const hold=all.filter(w=>w.status==='hold').length;
  const todayStr=new Date().toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric'});
  const lineMap={};
  all.forEach(w=>{
    if(!lineMap[w.line]) lineMap[w.line]={total:0,done:0,progress:0};
    lineMap[w.line].total++;
    if(w.status==='done') lineMap[w.line].done++;
    if(w.status==='progress'||w.status==='inspect') lineMap[w.line].progress++;
  });
  const lineRows=Object.entries(lineMap).sort((a,b)=>a[0].localeCompare(b[0])).map(([line,v])=>{
    const rate=v.total>0?Math.round(v.done/v.total*100):0;
    return `<tr><td>${line}</td><td class="num">${v.total}</td><td class="num rpt-good">${v.done}</td><td class="num" style="color:#2563eb">${v.progress}</td><td class="num">${rate}%</td></tr>`;
  }).join('');
  const rows=all.map(w=>{
    const sm=STATUS_META[w.status]||{label:w.status,color:'#888'};
    const due=daysUntil(w.dueDate);
    const dueClass=due<0?'rpt-bad':due<=3?'rpt-warn':'';
    return `<tr><td style="text-align:left;font-family:monospace;font-size:8pt">${w.no}</td><td style="text-align:left">${w.customer}</td><td style="text-align:left">${w.product}</td><td>${w.layer}</td><td class="num">${w.qty.toLocaleString()}</td><td class="num">${w.produced.toLocaleString()}</td><td>${w.line}</td><td class="${dueClass}">${w.dueDate}</td><td><span style="color:${sm.color};font-weight:700">${sm.label}</span></td></tr>`;
  }).join('');
  document.getElementById('rptPage').innerHTML=`
    <div class="rpt-company"><strong>(주)PCB 제조</strong> | 생산관리<br>출력일: ${todayStr}</div>
    <div class="rpt-doc-title"><h1>작업지시서 현황 보고서</h1><p>작업지시서 전체 현황 및 라인별 분석</p></div>
    <div class="rpt-kpi-grid">
      <div class="rpt-kpi-card"><div class="rk-label">전체 지시</div><div class="rk-val">${total}</div><div class="rk-unit">건</div></div>
      <div class="rpt-kpi-card"><div class="rk-label">진행중/검사</div><div class="rk-val" style="color:#2563eb">${inProg}</div><div class="rk-unit">건</div></div>
      <div class="rpt-kpi-card"><div class="rk-label">완료</div><div class="rk-val" style="color:#059669">${done}</div><div class="rk-unit">건</div></div>
      <div class="rpt-kpi-card"><div class="rk-label">보류</div><div class="rk-val" style="color:#d97706">${hold}</div><div class="rk-unit">건</div></div>
    </div>
    <div class="rpt-sec"><div class="rpt-sec-title">■ 라인별 현황</div>
      <table class="rpt-table"><thead><tr><th>라인</th><th>전체</th><th>완료</th><th>진행중/검사</th><th>완료율</th></tr></thead><tbody>${lineRows}</tbody></table>
    </div>
    <div class="rpt-sec"><div class="rpt-sec-title">■ 작업지시서 목록</div>
      <table class="rpt-table"><thead><tr><th>지시번호</th><th>고객사</th><th>제품명</th><th>층수</th><th>지시수량</th><th>생산수량</th><th>라인</th><th>납기일</th><th>상태</th></tr></thead><tbody>${rows}</tbody></table>
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

init();
