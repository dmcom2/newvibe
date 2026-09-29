// 설비 점검 체크리스트 스크립트

const EQUIPMENTS = [
  {id:'EQ01', name:'노광기 #1', type:'노광(Exposure)', icon:'💡', color:'#2563eb',
    sections:[
      {title:'광원 및 렌즈 점검', items:[
        {id:'e01s1i1', name:'광원 조도 확인', desc:'조도계로 측정 (허용범위: 1000±50 lux)', priority:'high', cycle:'일상'},
        {id:'e01s1i2', name:'렌즈 청결 상태', desc:'이물질·스크래치 없음', priority:'high', cycle:'일상'},
        {id:'e01s1i3', name:'마스크 정렬 상태', desc:'얼라이먼트 마크 기준 ±0.02mm', priority:'high', cycle:'일상'},
      ]},
      {title:'기계적 동작 점검', items:[
        {id:'e01s2i1', name:'척 흡착 진공압', desc:'−65kPa 이상 유지', priority:'mid', cycle:'일상'},
        {id:'e01s2i2', name:'이송 테이블 직진도', desc:'레이저 측정기 기준 0.05mm/m', priority:'mid', cycle:'주간'},
        {id:'e01s2i3', name:'UV 차단 셔터 동작', desc:'응답시간 < 0.5sec', priority:'low', cycle:'주간'},
      ]},
    ]},
  {id:'EQ02', name:'드릴링 머신 #1', type:'드릴(Drilling)', icon:'🔩', color:'#059669',
    sections:[
      {title:'드릴 비트 점검', items:[
        {id:'e02s1i1', name:'드릴 비트 마모도', desc:'교체 주기 기준(홀수 3000개) 확인', priority:'high', cycle:'일상'},
        {id:'e02s1i2', name:'비트 클램핑 토크', desc:'규정 토크 3.5 N·m ±0.2', priority:'high', cycle:'일상'},
        {id:'e02s1i3', name:'드릴 런아웃 확인', desc:'TIR ≤ 0.005mm', priority:'high', cycle:'주간'},
      ]},
      {title:'집진 및 냉각 점검', items:[
        {id:'e02s2i1', name:'집진 흡입력', desc:'흡입구 풍속 15m/s 이상', priority:'mid', cycle:'일상'},
        {id:'e02s2i2', name:'에어 냉각 압력', desc:'0.5±0.05 MPa', priority:'mid', cycle:'일상'},
        {id:'e02s2i3', name:'집진 필터 상태', desc:'차압 500Pa 이하', priority:'low', cycle:'주간'},
      ]},
    ]},
  {id:'EQ03', name:'도금조 #1', type:'도금(Plating)', icon:'⚗️', color:'#d97706',
    sections:[
      {title:'약액 농도 점검', items:[
        {id:'e03s1i1', name:'황산구리 농도', desc:'규정 범위: 60~80 g/L', priority:'high', cycle:'일상'},
        {id:'e03s1i2', name:'황산 농도', desc:'규정 범위: 180~220 g/L', priority:'high', cycle:'일상'},
        {id:'e03s1i3', name:'첨가제 농도', desc:'광택제/평활제 규정치', priority:'high', cycle:'일상'},
      ]},
      {title:'전기/온도 점검', items:[
        {id:'e03s2i1', name:'전류밀도 설정값', desc:'2.0±0.2 ASD', priority:'mid', cycle:'일상'},
        {id:'e03s2i2', name:'조 온도', desc:'25±2°C', priority:'mid', cycle:'일상'},
        {id:'e03s2i3', name:'에어레이션 상태', desc:'기포 균일 발생 확인', priority:'low', cycle:'일상'},
      ]},
    ]},
  {id:'EQ04', name:'에칭 라인 #1', type:'에칭(Etching)', icon:'🧪', color:'#dc2626',
    sections:[
      {title:'에칭액 관리', items:[
        {id:'e04s1i1', name:'에칭 속도 확인', desc:'동 두께 35μm 기준 2±0.3 m/min', priority:'high', cycle:'일상'},
        {id:'e04s1i2', name:'염화구리 농도', desc:'Specific Gravity: 1.28~1.32', priority:'high', cycle:'일상'},
        {id:'e04s1i3', name:'스프레이 노즐 막힘', desc:'전체 노즐 분사 패턴 균일', priority:'mid', cycle:'주간'},
      ]},
      {title:'수세 및 건조', items:[
        {id:'e04s2i1', name:'수세 수질 (전도도)', desc:'< 20 μS/cm', priority:'mid', cycle:'일상'},
        {id:'e04s2i2', name:'건조 온도', desc:'80±5°C', priority:'low', cycle:'일상'},
      ]},
    ]},
  {id:'EQ05', name:'AOI 검사기 #1', type:'자동광학검사(AOI)', icon:'🔍', color:'#7c3aed',
    sections:[
      {title:'카메라 및 조명', items:[
        {id:'e05s1i1', name:'카메라 청결 상태', desc:'렌즈 이물질 없음, 초점 선명', priority:'high', cycle:'일상'},
        {id:'e05s1i2', name:'조명 균일도', desc:'밝기 편차 ≤ 5%', priority:'high', cycle:'주간'},
        {id:'e05s1i3', name:'마스터 패턴 등록', desc:'기준 패턴과 일치 확인', priority:'mid', cycle:'일상'},
      ]},
      {title:'기구 동작 점검', items:[
        {id:'e05s2i1', name:'기판 이송 속도', desc:'설정값 ±2% 이내', priority:'mid', cycle:'일상'},
        {id:'e05s2i2', name:'NG 배출 기구 동작', desc:'불량 검출 후 정확 배출 확인', priority:'mid', cycle:'일상'},
      ]},
    ]},
];

let currentEqId = EQUIPMENTS[0].id;
let results = {};

function getKey(eqId) { return `check_${eqId}`; }
function loadResults(eqId) {
  try { return JSON.parse(localStorage.getItem(getKey(eqId))) || {}; } catch { return {}; }
}
function saveResults(eqId) {
  localStorage.setItem(getKey(eqId), JSON.stringify(results));
}

let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

// ── 미션 1: 전체 점검 현황 배너 ──
function renderSummaryBanner() {
  let totalOk = 0, totalNg = 0, totalPending = 0;
  EQUIPMENTS.forEach(eq => {
    const r = loadResults(eq.id);
    eq.sections.forEach(sec => sec.items.forEach(item => {
      const v = r[item.id];
      if (v === 'ok') totalOk++;
      else if (v === 'ng') totalNg++;
      else totalPending++;
    }));
  });
  const total = totalOk + totalNg + totalPending;
  const doneTotal = totalOk + totalNg;
  const pct = total ? Math.round(doneTotal / total * 100) : 0;
  document.getElementById('summaryBanner').innerHTML = `
    <div class="summary-banner">
      <div class="sb-stat"><span class="sb-stat-v" style="color:var(--green)">${totalOk}</span><span class="sb-stat-l">정상</span></div>
      <div class="sb-divider"></div>
      <div class="sb-stat"><span class="sb-stat-v" style="color:var(--red)">${totalNg}</span><span class="sb-stat-l">이상</span></div>
      <div class="sb-divider"></div>
      <div class="sb-stat"><span class="sb-stat-v" style="color:var(--mute)">${totalPending}</span><span class="sb-stat-l">미점검</span></div>
      <div class="sb-divider"></div>
      <div class="sb-prog-wrap">
        <div class="sb-prog-track"><div class="sb-prog-fill" style="width:${pct}%"></div></div>
        <span style="font-size:.65rem;color:var(--mute)">전체 ${pct}% 완료</span>
      </div>
    </div>`;
}

function renderEqList() {
  const today = document.getElementById('dateInput').value;
  document.getElementById('eqList').innerHTML = EQUIPMENTS.map(eq => {
    const r = loadResults(eq.id);
    let ok = 0, ng = 0, total = 0;
    eq.sections.forEach(sec => sec.items.forEach(item => {
      total++;
      if (r[item.id] === 'ok') ok++;
      else if (r[item.id] === 'ng') ng++;
    }));
    const done = ok + ng;
    const pct = total ? Math.round(done / total * 100) : 0;
    const isActive = eq.id === currentEqId;
    const dotColor = ng > 0 ? 'var(--red)' : (pct === 100 ? 'var(--green)' : (pct > 0 ? 'var(--amber)' : 'var(--mute)'));
    const fillColor = ng > 0 ? 'var(--red)' : (pct === 100 ? 'var(--green)' : 'var(--teal)');
    return `<div class="eq-item${isActive ? ' active' : ''}" onclick="selectEq('${eq.id}')">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:1.1rem">${eq.icon}</span>
        <div style="flex:1">
          <div class="eq-name">${eq.name}</div>
          <div class="eq-type">${eq.type}</div>
        </div>
        <div class="status-dot" style="background:${dotColor}"></div>
      </div>
      <div class="eq-prog">
        <div class="prog-bar"><div class="prog-fill" style="width:${pct}%;background:${fillColor}"></div></div>
        <span class="prog-pct" style="color:${fillColor}">${pct}%</span>
      </div>
    </div>`;
  }).join('');
}

function selectEq(eqId) {
  currentEqId = eqId;
  results = loadResults(eqId);
  renderEqList();
  renderMain();
}

// ── 미션 2: NG 요약 패널 ──
function buildNgPanel(eq) {
  const ngItems = [];
  eq.sections.forEach(sec => sec.items.forEach(item => {
    if (results[item.id] === 'ng') {
      ngItems.push({name: item.name, note: results[item.id + '_note'] || ''});
    }
  }));
  if (!ngItems.length) return '';
  return `<div class="ng-panel">
    <div class="ng-panel-title">⚠️ 이상 항목 (${ngItems.length}건)</div>
    ${ngItems.map(n => `<div class="ng-row">
      <span class="ng-badge">NG</span>
      <span class="ng-name">${n.name}</span>
      <span class="ng-note">${n.note || '비고 없음'}</span>
    </div>`).join('')}
  </div>`;
}

function renderMain() {
  const eq = EQUIPMENTS.find(e => e.id === currentEqId);
  results = loadResults(currentEqId);

  let total = 0, ok = 0, ng = 0;
  eq.sections.forEach(sec => sec.items.forEach(item => {
    total++;
    if (results[item.id] === 'ok') ok++;
    else if (results[item.id] === 'ng') ng++;
  }));
  const done = ok + ng;

  const sectionsHtml = eq.sections.map((sec, si) => {
    let sOk = 0, sDone = 0;
    sec.items.forEach(item => {
      if (results[item.id]) sDone++;
      if (results[item.id] === 'ok') sOk++;
    });
    const sPct = sec.items.length ? Math.round(sDone / sec.items.length * 100) : 0;
    const pctColor = sDone < sec.items.length ? 'background:#fef3c7;color:#b45309' : 'background:#dcfce7;color:#15803d';
    const itemsHtml = sec.items.map(item => {
      const v = results[item.id];
      const note = results[item.id + '_note'] || '';
      const priorityMap = {high:'p-high 🔴 중요', mid:'p-mid 🟡 보통', low:'p-low 🟢 낮음'};
      const pClass = priorityMap[item.priority] || 'p-low';
      const [cls, ...pLabel] = pClass.split(' ');
      const isNg = v === 'ng';
      const isOk = v === 'ok';
      return `<div class="check-item${isOk ? ' checked' : ''}${isNg ? ' abnormal' : ''}" id="item-${item.id}">
        <div class="check-circle${isOk ? ' ok' : ''}${isNg ? ' ng' : ''}" onclick="cycleResult('${item.id}')">
          ${isOk ? '✓' : isNg ? '✕' : ''}
        </div>
        <div class="check-body">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <span class="check-name">${item.name}</span>
            <span class="priority-badge ${cls}">${pLabel.join(' ')}</span>
            <span class="cycle-tag">${item.cycle}</span>
          </div>
          <div class="check-desc">${item.desc}</div>
          <div class="check-actions">
            <button class="result-btn btn-ok${isOk ? ' active' : ''}" onclick="setResult('${item.id}','ok')">✓ 정상</button>
            <button class="result-btn btn-ng${isNg ? ' active' : ''}" onclick="setResult('${item.id}','ng')">✕ 이상</button>
            ${v ? `<button class="result-btn" style="color:var(--mute);border-color:var(--border)" onclick="clearResult('${item.id}')">초기화</button>` : ''}
          </div>
          <textarea class="check-note" placeholder="특이사항 입력..." onchange="setNote('${item.id}',this.value)">${note}</textarea>
        </div>
      </div>`;
    }).join('');
    return `<div class="check-section">
      <div class="section-header">
        <span class="section-title">${sec.title}</span>
        <span class="section-pct" style="${pctColor}">${sPct}%</span>
      </div>
      <div class="check-list">${itemsHtml}</div>
    </div>`;
  }).join('');

  document.getElementById('mainArea').innerHTML = `
    <div class="eq-header">
      <div class="eq-icon" style="background:${eq.color}22">${eq.icon}</div>
      <div class="eq-info">
        <h2>${eq.name}</h2>
        <p>${eq.type}</p>
      </div>
      <div class="eq-stats">
        <div class="stat"><div class="stat-v" style="color:var(--green)">${ok}</div><div class="stat-l">정상</div></div>
        <div class="stat"><div class="stat-v" style="color:var(--red)">${ng}</div><div class="stat-l">이상</div></div>
        <div class="stat"><div class="stat-v" style="color:var(--mute)">${total - done}</div><div class="stat-l">미점검</div></div>
        <div class="stat"><div class="stat-v" style="color:var(--teal)">${total ? Math.round(done/total*100) : 0}%</div><div class="stat-l">완료율</div></div>
      </div>
    </div>
    ${buildNgPanel(eq)}
    ${sectionsHtml}`;
}

function cycleResult(itemId) {
  const cur = results[itemId];
  if (!cur) results[itemId] = 'ok';
  else if (cur === 'ok') results[itemId] = 'ng';
  else delete results[itemId];
  saveResults(currentEqId);
  afterChange();
}

function setResult(itemId, val) {
  results[itemId] = val;
  saveResults(currentEqId);
  afterChange();
}

function clearResult(itemId) {
  delete results[itemId];
  delete results[itemId + '_note'];
  saveResults(currentEqId);
  afterChange();
}

function setNote(itemId, val) {
  results[itemId + '_note'] = val;
  saveResults(currentEqId);
}

// ── 미션 3: 100% 완료 토스트 알림 ──
function checkAllComplete() {
  const eq = EQUIPMENTS.find(e => e.id === currentEqId);
  let total = 0, done = 0;
  eq.sections.forEach(sec => sec.items.forEach(item => {
    total++;
    if (results[item.id]) done++;
  }));
  if (total > 0 && total === done) {
    showToast(`✅ ${eq.name} 전체 점검 완료!`);
  }
}

function afterChange() {
  renderMain();
  renderEqList();
  renderSummaryBanner();
  checkAllComplete();
}

function checkAll(eqId, val) {
  const eq = EQUIPMENTS.find(e => e.id === eqId);
  eq.sections.forEach(sec => sec.items.forEach(item => { results[item.id] = val; }));
  saveResults(eqId);
  afterChange();
  showToast(val === 'ok' ? '전체 정상 처리되었습니다.' : '전체 이상으로 처리되었습니다.');
}

function exportReport() {
  const today = document.getElementById('dateInput').value;
  let csv = '점검일,설비,항목,우선순위,결과,비고\n';
  EQUIPMENTS.forEach(eq => {
    const r = loadResults(eq.id);
    eq.sections.forEach(sec => sec.items.forEach(item => {
      const res = r[item.id] || '미점검';
      const note = r[item.id + '_note'] || '';
      csv += `${today},"${eq.name}","${item.name}","${item.priority}","${res}","${note}"\n`;
    }));
  });
  const blob = new Blob(['﻿' + csv], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `점검결과_${today}.csv`;
  a.click();
  showToast('결과가 저장되었습니다.');
}

/* ── 보고서 출력 ── */
function openReport() {
  const date = document.getElementById('dateInput').value;
  let totalItems = 0, okItems = 0, ngItems = 0, uncheckedItems = 0;
  const eqRows = [];
  EQUIPMENTS.forEach(eq => {
    const r = loadResults(eq.id);
    let eqOk = 0, eqNg = 0, eqUnchk = 0;
    eq.sections.forEach(sec => sec.items.forEach(item => {
      totalItems++;
      const res = r[item.id];
      if (!res) { eqUnchk++; uncheckedItems++; }
      else if (res === 'ok') { eqOk++; okItems++; }
      else { eqNg++; ngItems++; }
    }));
    eqRows.push({ eq, eqOk, eqNg, eqUnchk, total: eqOk + eqNg + eqUnchk });
  });
  const ngDetails = [];
  EQUIPMENTS.forEach(eq => {
    const r = loadResults(eq.id);
    eq.sections.forEach(sec => sec.items.forEach(item => {
      if (r[item.id] === 'ng') {
        ngDetails.push({ eqName: eq.name, secTitle: sec.title, itemName: item.name, priority: item.priority, note: r[item.id + '_note'] || '' });
      }
    }));
  });
  const now = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
  document.getElementById('rptPage').innerHTML = `
    <div class="rpt-company"><strong>PCB Manufacturing Co., Ltd.</strong><br>설비관리부</div>
    <div class="rpt-doc-title"><h1>설 비 점 검 보 고 서</h1><p>점검일: ${date}</p></div>
    <table class="rpt-info-box">
      <tr><td class="rpt-label">작성일</td><td>${now}</td><td class="rpt-label">작성부서</td><td>설비관리부</td></tr>
      <tr><td class="rpt-label">작성자</td><td></td><td class="rpt-label">결재</td><td></td></tr>
    </table>
    <div class="rpt-sec">
      <div class="rpt-sec-title">■ 1. 점검 현황 KPI</div>
      <div class="rpt-kpi-grid">
        <div class="rpt-kpi-card"><div class="rk-label">전체 점검 항목</div><div class="rk-val">${totalItems}</div><div class="rk-unit">항목</div></div>
        <div class="rpt-kpi-card"><div class="rk-label">정상 (OK)</div><div class="rk-val rpt-good">${okItems}</div><div class="rk-unit">항목</div></div>
        <div class="rpt-kpi-card"><div class="rk-label">이상 (NG)</div><div class="rk-val rpt-bad">${ngItems}</div><div class="rk-unit">항목</div></div>
        <div class="rpt-kpi-card"><div class="rk-label">미점검</div><div class="rk-val rpt-warn">${uncheckedItems}</div><div class="rk-unit">항목</div></div>
      </div>
    </div>
    <div class="rpt-sec">
      <div class="rpt-sec-title">■ 2. 설비별 점검 현황</div>
      <table class="rpt-table">
        <thead><tr><th>설비명</th><th>유형</th><th>전체</th><th>정상(OK)</th><th>이상(NG)</th><th>미점검</th><th>점검율</th></tr></thead>
        <tbody>
          ${eqRows.map(({ eq, eqOk, eqNg, eqUnchk, total }) => `<tr>
            <td style="text-align:left">${eq.name}</td><td>${eq.type}</td><td>${total}</td>
            <td class="rpt-good">${eqOk}</td>
            <td class="${eqNg ? 'rpt-bad' : ''}">${eqNg}</td>
            <td class="${eqUnchk ? 'rpt-warn' : ''}">${eqUnchk}</td>
            <td>${total ? Math.round((eqOk + eqNg) / total * 100) : 0}%</td>
          </tr>`).join('')}
          <tr class="rpt-total">
            <td colspan="2">합 계</td><td>${totalItems}</td>
            <td class="rpt-good">${okItems}</td>
            <td class="${ngItems ? 'rpt-bad' : ''}">${ngItems}</td>
            <td class="${uncheckedItems ? 'rpt-warn' : ''}">${uncheckedItems}</td>
            <td>${totalItems ? Math.round((okItems + ngItems) / totalItems * 100) : 0}%</td>
          </tr>
        </tbody>
      </table>
    </div>
    ${ngDetails.length ? `
    <div class="rpt-sec">
      <div class="rpt-sec-title">■ 3. 이상(NG) 항목 상세</div>
      <table class="rpt-table">
        <thead><tr><th>설비</th><th>점검 섹션</th><th>점검 항목</th><th>우선순위</th><th>비고</th></tr></thead>
        <tbody>
          ${ngDetails.map(n => `<tr>
            <td>${n.eqName}</td><td>${n.secTitle}</td>
            <td style="text-align:left">${n.itemName}</td>
            <td class="${n.priority === 'high' ? 'rpt-bad' : n.priority === 'mid' ? 'rpt-warn' : ''}">${n.priority === 'high' ? '상' : n.priority === 'mid' ? '중' : '하'}</td>
            <td style="text-align:left">${n.note}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : ''}
    <table class="rpt-sign">
      <tr>
        <td class="rpt-label">담당</td><td class="sign-box"></td>
        <td class="rpt-label">팀장</td><td class="sign-box"></td>
        <td class="rpt-label">부장</td><td class="sign-box"></td>
        <td class="rpt-label">임원</td><td class="sign-box"></td>
      </tr>
    </table>
    <div class="rpt-footer">본 보고서는 PCB Manufacturing 설비점검 시스템에서 자동 생성되었습니다.</div>
  `;
  document.getElementById('rptOverlay').classList.add('show');
  document.body.style.overflow = 'hidden';
}
function closeReport() {
  document.getElementById('rptOverlay').classList.remove('show');
  document.body.style.overflow = '';
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.getElementById('rptOverlay').classList.contains('show')) closeReport();
});

function init() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('dateInput').value = today;
  results = loadResults(currentEqId);
  renderSummaryBanner();
  renderEqList();
  renderMain();
}

init();
