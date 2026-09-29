/* 생산 실적 관리 시스템 전체 로직 */

Chart.defaults.color = '#718096';
Chart.defaults.borderColor = '#e2e8f0';

/* ── 라인 색상 ── */
const LINE_COLORS = {'1호기':'#2563eb','2호기':'#059669','3호기':'#d97706','4호기':'#7c3aed','5호기':'#dc2626'};

/* ── 샘플 데이터 생성 ── */
function makeId() { return Date.now() + Math.random(); }
const today = new Date().toISOString().slice(0, 10);
const Y = today.slice(0, 4), M = today.slice(5, 7);

function sampleData() {
  const records = [];
  const lines    = ['1호기', '2호기', '3호기', '4호기'];
  const products = ['PCB-A2401', 'PCB-B1802', 'PCB-C3305', 'PCB-D0401'];
  const layers   = ['양면', '4층', '양면', '6층'];
  for (let d = 1; d <= 25; d++) {
    const dd   = String(d).padStart(2, '0');
    const date = `${Y}-${M}-${dd}`;
    lines.forEach((line, i) => {
      const planned  = 800 + Math.floor(Math.random() * 400);
      const produced = planned - Math.floor(Math.random() * 30);
      const defect   = Math.floor(produced * (0.01 + Math.random() * 0.04));
      const good     = produced - defect;
      records.push({id:makeId(), date, line, product:products[i], layer:layers[i],
        planned, produced, good, defect, worker:'작업자'+(i+1), note:''});
    });
  }
  return records;
}

let records  = JSON.parse(localStorage.getItem('pcbProd') || 'null') || sampleData();
let nextId   = Date.now();
let editId   = null;
let currentYM = today.slice(0, 7);
let viewMode  = 'month';
let trendChart = null, yieldChart = null;

function save() { localStorage.setItem('pcbProd', JSON.stringify(records)); }

/* ── 토스트 ── */
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2500);
}

/* ── 날짜 네비 ── */
function updateDateLabel() {
  const [y, m] = currentYM.split('-');
  document.getElementById('currentDateLabel').textContent = `${y}년 ${m}월`;
}
function changeMonth(delta) {
  const d = new Date(currentYM + '-01');
  d.setMonth(d.getMonth() + delta);
  currentYM = d.toISOString().slice(0, 7);
  updateDateLabel(); renderAll();
}
function switchView(v, btn) {
  viewMode = v;
  document.querySelectorAll('.vb').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderAll();
}

/* ── 필터된 레코드 ── */
function getRecords() {
  if (viewMode === 'month') return records.filter(r => r.date.startsWith(currentYM));
  const d = document.getElementById('singleDate').value || today;
  return records.filter(r => r.date === d);
}

/* ── KPI ── */
function renderKPI() {
  const rs           = getRecords();
  const totalProduced = rs.reduce((s, r) => s + r.produced, 0);
  const totalGood     = rs.reduce((s, r) => s + r.good, 0);
  const totalDefect   = rs.reduce((s, r) => s + r.defect, 0);
  const totalPlanned  = rs.reduce((s, r) => s + r.planned, 0);
  const yieldRate     = totalProduced ? (totalGood / totalProduced * 100) : 0;
  const achRate       = totalPlanned  ? (totalProduced / totalPlanned * 100) : 0;
  document.getElementById('kpiRow').innerHTML = `
    <div class="kpi k1"><div class="kpi-l">총 생산량</div><div class="kpi-v">${totalProduced.toLocaleString()}</div><div class="kpi-sub">매</div></div>
    <div class="kpi k2"><div class="kpi-l">총 양품수</div><div class="kpi-v">${totalGood.toLocaleString()}</div><div class="kpi-sub">매</div></div>
    <div class="kpi k3"><div class="kpi-l">총 불량수</div><div class="kpi-v">${totalDefect.toLocaleString()}</div><div class="kpi-sub">매</div></div>
    <div class="kpi k4"><div class="kpi-l">양품률</div><div class="kpi-v">${yieldRate.toFixed(2)}%</div><div class="kpi-sub">목표 97.0%</div></div>
    <div class="kpi k5"><div class="kpi-l">계획 달성률</div><div class="kpi-v">${achRate.toFixed(1)}%</div><div class="kpi-sub">목표 98.0%</div></div>`;
}

/* ── 미션 2: 라인별 실적 카드 ── */
function renderLineCards() {
  const rs = getRecords();
  const byLine = {};
  rs.forEach(r => {
    if (!byLine[r.line]) byLine[r.line] = {produced:0, good:0, planned:0};
    byLine[r.line].produced += r.produced;
    byLine[r.line].good     += r.good;
    byLine[r.line].planned  += r.planned;
  });
  const lines = Object.keys(byLine);
  const el = document.getElementById('lineCards');
  if (!lines.length) { el.innerHTML = ''; return; }
  el.innerHTML = lines.map(line => {
    const d         = byLine[line];
    const yieldRate = d.produced ? (d.good / d.produced * 100) : 0;
    const achRate   = d.planned  ? (d.produced / d.planned * 100) : 0;
    const color     = LINE_COLORS[line] || '#64748b';
    const yClass    = yieldRate >= 97 ? 'good' : yieldRate >= 94 ? 'warn' : 'bad';
    const aClass    = achRate   >= 98 ? 'good' : achRate   >= 90 ? 'warn' : 'bad';
    return `<div class="lc" style="border-top-color:${color}">
      <div class="lc-name" style="color:${color}">${line}</div>
      <div class="lc-main">${d.produced.toLocaleString()}</div>
      <div class="lc-unit">생산량 (매)</div>
      <div class="lc-pills">
        <span class="lc-pill ${yClass}">양품률 ${yieldRate.toFixed(1)}%</span>
        <span class="lc-pill ${aClass}">달성률 ${achRate.toFixed(1)}%</span>
      </div>
    </div>`;
  }).join('');
}

/* ── 미션 3: 불량률 경보 배너 ── */
function renderAlertBanner() {
  const rs = getRecords();
  const byLine = {};
  rs.forEach(r => {
    if (!byLine[r.line]) byLine[r.line] = {good:0, produced:0};
    byLine[r.line].good     += r.good;
    byLine[r.line].produced += r.produced;
  });
  const alerts = Object.keys(byLine)
    .map(line => ({line, rate: byLine[line].produced ? byLine[line].good / byLine[line].produced * 100 : 100}))
    .filter(a => a.rate < 97 && byLine[a.line].produced > 0)
    .sort((a, b) => a.rate - b.rate);

  const banner = document.getElementById('alertBanner');
  if (!alerts.length) { banner.style.display = 'none'; return; }
  banner.style.display = 'flex';
  banner.innerHTML = `⚠️ 불량률 경보 — 즉시 점검 필요:
    ${alerts.map(a => `<span style="background:rgba(255,255,255,.2);padding:2px 10px;border-radius:5px;">
      ${a.line} <strong>${a.rate.toFixed(2)}%</strong>
    </span>`).join('')}
    <span style="margin-left:auto;font-size:.78rem;font-weight:400;opacity:.85;">목표: 97.0% 이상</span>`;
}

/* ── 트렌드 차트 ── */
function renderTrend() {
  if (trendChart) trendChart.destroy();
  const rs = getRecords();
  const byDate = {};
  rs.forEach(r => { byDate[r.date] = (byDate[r.date] || 0) + r.produced; });
  const labels = Object.keys(byDate).sort();
  const ctx = document.getElementById('trendChart').getContext('2d');
  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels.map(d => d.slice(5)),
      datasets: [{label:'생산량', data:labels.map(d => byDate[d]),
        borderColor:'#2563eb', backgroundColor:'rgba(37,99,235,.1)',
        fill:true, tension:.3, pointRadius:3}]
    },
    options: {responsive:true, maintainAspectRatio:true,
      plugins: {legend:{display:false}},
      scales: {y:{ticks:{callback:v => v.toLocaleString()}}}}
  });
}

/* ── 양품률 차트 ── */
function renderYield() {
  if (yieldChart) yieldChart.destroy();
  const rs = getRecords();
  const byLine = {};
  rs.forEach(r => {
    if (!byLine[r.line]) byLine[r.line] = {good:0, produced:0};
    byLine[r.line].good     += r.good;
    byLine[r.line].produced += r.produced;
  });
  const lines  = Object.keys(byLine);
  const yields = lines.map(l => +(byLine[l].produced ? byLine[l].good / byLine[l].produced * 100 : 0).toFixed(2));
  const ctx = document.getElementById('yieldChart').getContext('2d');
  yieldChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: lines,
      datasets: [{label:'양품률(%)', data:yields,
        backgroundColor: lines.map(l => (LINE_COLORS[l] || '#64748b') + 'cc'),
        borderRadius: 6}]
    },
    options: {responsive:true, maintainAspectRatio:true,
      plugins: {legend:{display:false}},
      scales: {y:{min:90, max:100, ticks:{callback:v => v + '%'}}}}
  });
}

/* ── 이력 테이블 ── */
function renderTable() {
  const q  = document.getElementById('tableSearch').value.toLowerCase();
  const rs = getRecords().filter(r =>
    !q || r.line.includes(q) || r.product.toLowerCase().includes(q) || r.worker.includes(q)
  ).sort((a, b) => b.date.localeCompare(a.date));

  const yieldRate = r => r.produced ? (r.good / r.produced * 100) : 0;
  const chipClass = y => y >= 97 ? 'chip-good' : y >= 94 ? 'chip-warn' : 'chip-bad';

  document.getElementById('recordTable').innerHTML =
    `<thead><tr>
      <th>날짜</th><th>라인</th><th>제품명</th><th>층수</th>
      <th>계획</th><th>생산</th><th>양품</th><th>불량</th><th>양품률</th><th>작업자</th><th>편집</th>
    </tr></thead>
    <tbody>${rs.map(r => {
      const y = yieldRate(r);
      const rowClass = y < 97 ? 'row-alert' : '';
      return `<tr class="${rowClass}">
        <td>${r.date}</td>
        <td><span class="line-badge" style="background:${LINE_COLORS[r.line]||'#64748b'}">${r.line}</span></td>
        <td>${r.product}</td><td>${r.layer}</td>
        <td style="text-align:right">${r.planned.toLocaleString()}</td>
        <td style="text-align:right">${r.produced.toLocaleString()}</td>
        <td style="text-align:right;color:var(--green)">${r.good.toLocaleString()}</td>
        <td style="text-align:right;color:var(--red)">${r.defect.toLocaleString()}</td>
        <td><span class="status-chip ${chipClass(y)}">${y.toFixed(2)}%</span></td>
        <td>${r.worker}</td>
        <td><button class="edit-btn" onclick="editRecord(${r.id})">편집</button></td>
      </tr>`;
    }).join('')}</tbody>`;
}

/* ── 미션 1: 실시간 양품률 자동 계산 ── */
function autoFillGood() {
  const produced = parseInt(document.getElementById('f-produced').value) || 0;
  const defect   = parseInt(document.getElementById('f-defect').value)   || 0;
  if (produced && defect) {
    const goodEl = document.getElementById('f-good');
    if (!goodEl.value || parseInt(goodEl.value) === produced - defect + 1) {
      goodEl.value = Math.max(0, produced - defect);
    }
  }
}

function calcRealtime() {
  const planned  = parseInt(document.getElementById('f-planned').value)  || 0;
  const produced = parseInt(document.getElementById('f-produced').value) || 0;
  const good     = parseInt(document.getElementById('f-good').value)     || 0;
  const calc     = document.getElementById('realtimeCalc');
  if (!calc) return;
  if (!produced) { calc.innerHTML = ''; return; }

  const yieldRate = (good / produced * 100);
  const achRate   = planned ? (produced / planned * 100) : 0;
  const yColor    = yieldRate >= 97 ? '#059669' : yieldRate >= 94 ? '#d97706' : '#dc2626';
  const aColor    = achRate   >= 98 ? '#059669' : achRate   >= 90 ? '#d97706' : '#dc2626';

  calc.innerHTML = `
    <span>📊 실시간 계산</span>
    <span>양품률: <strong style="color:${yColor};font-size:.95rem">${yieldRate.toFixed(2)}%</strong>
      <small style="color:var(--mute)">(목표 97%)</small></span>
    ${planned ? `<span>달성률: <strong style="color:${aColor};font-size:.95rem">${achRate.toFixed(1)}%</strong>
      <small style="color:var(--mute)">(목표 98%)</small></span>` : ''}
    <span style="color:var(--mute);font-size:.75rem">불량수: ${(produced - good).toLocaleString()}매</span>`;
}

/* ── 모달 ── */
function openModal(id = null) {
  editId = id;
  const r = id ? records.find(x => x.id === id) : null;
  document.getElementById('modalTitle').textContent = id ? '실적 수정' : '생산 실적 입력';
  document.getElementById('delBtn').style.display   = id ? 'block' : 'none';
  document.getElementById('f-date').value     = r?.date    || today;
  document.getElementById('f-line').value     = r?.line    || '1호기';
  document.getElementById('f-product').value  = r?.product || '';
  document.getElementById('f-layer').value    = r?.layer   || '양면';
  document.getElementById('f-planned').value  = r?.planned  || '';
  document.getElementById('f-produced').value = r?.produced || '';
  document.getElementById('f-good').value     = r?.good    || '';
  document.getElementById('f-defect').value   = r?.defect  || '';
  document.getElementById('f-worker').value   = r?.worker  || '';
  document.getElementById('f-note').value     = r?.note    || '';
  document.getElementById('realtimeCalc').innerHTML = '';
  if (r) calcRealtime();
  document.getElementById('modal').classList.add('show');
}
function editRecord(id) { openModal(id); }
function closeModal() { document.getElementById('modal').classList.remove('show'); editId = null; }

function saveRecord() {
  const product  = document.getElementById('f-product').value.trim();
  if (!product) { showToast('❌ 제품명을 입력하세요.'); return; }
  const planned  = parseInt(document.getElementById('f-planned').value)  || 0;
  const produced = parseInt(document.getElementById('f-produced').value) || 0;
  const good     = parseInt(document.getElementById('f-good').value)     || 0;
  const defect   = parseInt(document.getElementById('f-defect').value)   || 0;
  const rec = {
    id:      editId || nextId++,
    date:    document.getElementById('f-date').value,
    line:    document.getElementById('f-line').value,
    product,
    layer:   document.getElementById('f-layer').value,
    planned, produced, good, defect,
    worker:  document.getElementById('f-worker').value,
    note:    document.getElementById('f-note').value,
  };
  if (editId) {
    const i = records.findIndex(x => x.id === editId);
    if (i >= 0) records[i] = rec;
  } else {
    records.push(rec);
  }
  save(); closeModal(); renderAll();
  showToast(editId ? '✅ 실적이 수정되었습니다.' : '✅ 실적이 저장되었습니다.');
}

function deleteRecord() {
  if (!confirm('이 실적을 삭제하시겠습니까?')) return;
  records = records.filter(x => x.id !== editId);
  save(); closeModal(); renderAll();
  showToast('🗑 실적이 삭제되었습니다.');
}

/* ── 보고서 출력 ── */
function openReport() {
  const rs = getRecords().sort((a, b) => a.date.localeCompare(b.date));
  if (!rs.length) { showToast('⚠ 표시할 데이터가 없습니다.'); return; }

  const [y, m] = currentYM.split('-');
  const periodLabel = viewMode === 'month'
    ? `${y}년 ${m}월 (${rs[0].date} ~ ${rs[rs.length-1].date})`
    : `${rs[0].date}`;

  /* 집계 */
  const totalProduced = rs.reduce((s,r)=>s+r.produced,0);
  const totalGood     = rs.reduce((s,r)=>s+r.good,0);
  const totalDefect   = rs.reduce((s,r)=>s+r.defect,0);
  const totalPlanned  = rs.reduce((s,r)=>s+r.planned,0);
  const yieldRate     = totalProduced ? (totalGood/totalProduced*100) : 0;
  const achRate       = totalPlanned  ? (totalProduced/totalPlanned*100) : 0;
  const defectRate    = totalProduced ? (totalDefect/totalProduced*100) : 0;

  /* 라인별 집계 */
  const byLine = {};
  rs.forEach(r => {
    if (!byLine[r.line]) byLine[r.line] = {planned:0, produced:0, good:0, defect:0, days:new Set()};
    byLine[r.line].planned  += r.planned;
    byLine[r.line].produced += r.produced;
    byLine[r.line].good     += r.good;
    byLine[r.line].defect   += r.defect;
    byLine[r.line].days.add(r.date);
  });

  /* 제품별 집계 */
  const byProd = {};
  rs.forEach(r => {
    if (!byProd[r.product]) byProd[r.product] = {produced:0, good:0, defect:0};
    byProd[r.product].produced += r.produced;
    byProd[r.product].good     += r.good;
    byProd[r.product].defect   += r.defect;
  });

  const fmtN = n => n.toLocaleString();
  const yColor = v => v>=97?'rpt-good':v>=94?'rpt-warn':'rpt-bad';
  const aColor = v => v>=98?'rpt-good':v>=90?'rpt-warn':'rpt-bad';

  /* 라인별 테이블 행 */
  const lineRows = Object.entries(byLine).map(([line, d]) => {
    const yr = d.produced ? (d.good/d.produced*100) : 0;
    const ar = d.planned  ? (d.produced/d.planned*100) : 0;
    return `<tr>
      <td style="font-weight:700;color:${LINE_COLORS[line]||'#333'}">${line}</td>
      <td class="num">${fmtN(d.planned)}</td>
      <td class="num">${fmtN(d.produced)}</td>
      <td class="num rpt-good">${fmtN(d.good)}</td>
      <td class="num rpt-bad">${fmtN(d.defect)}</td>
      <td class="${yColor(yr)}">${yr.toFixed(2)}%</td>
      <td class="${aColor(ar)}">${ar.toFixed(1)}%</td>
      <td>${d.days.size}일</td>
    </tr>`;
  }).join('');

  /* 제품별 테이블 행 */
  const prodRows = Object.entries(byProd).sort((a,b)=>b[1].produced-a[1].produced).map(([prod, d]) => {
    const yr = d.produced ? (d.good/d.produced*100) : 0;
    const pct= (d.produced/totalProduced*100).toFixed(1);
    return `<tr>
      <td style="text-align:left">${prod}</td>
      <td class="num">${fmtN(d.produced)}</td>
      <td>${pct}%</td>
      <td class="num rpt-good">${fmtN(d.good)}</td>
      <td class="num rpt-bad">${fmtN(d.defect)}</td>
      <td class="${yColor(yr)}">${yr.toFixed(2)}%</td>
    </tr>`;
  }).join('');

  /* 종합 의견 */
  const opinions = [];
  if (yieldRate >= 97) opinions.push(`✅ 종합 양품률 <strong>${yieldRate.toFixed(2)}%</strong>로 목표(97.0%)를 달성했습니다.`);
  else opinions.push(`⚠ 종합 양품률 <strong>${yieldRate.toFixed(2)}%</strong>로 목표(97.0%)에 미달합니다. 불량 원인 분석 및 개선 조치가 필요합니다.`);
  if (achRate >= 98) opinions.push(`✅ 계획 달성률 <strong>${achRate.toFixed(1)}%</strong>로 목표(98.0%)를 달성했습니다.`);
  else opinions.push(`⚠ 계획 달성률 <strong>${achRate.toFixed(1)}%</strong>로 목표(98.0%)에 미달합니다.`);
  const worstLine = Object.entries(byLine).sort((a,b)=>{
    const ya = a[1].produced ? a[1].good/a[1].produced*100 : 100;
    const yb = b[1].produced ? b[1].good/b[1].produced*100 : 100;
    return ya-yb;
  })[0];
  if (worstLine) {
    const wr = worstLine[1].produced ? (worstLine[1].good/worstLine[1].produced*100) : 100;
    if (wr < 97) opinions.push(`🔴 <strong>${worstLine[0]}</strong> 라인 양품률(${wr.toFixed(2)}%)이 가장 낮아 집중 점검이 필요합니다.`);
  }

  document.getElementById('rptPage').innerHTML = `
    <div class="rpt-company">
      <strong>PCB Manufacturing Co., Ltd.</strong>&nbsp;&nbsp;|&nbsp;&nbsp;생산관리
    </div>

    <div class="rpt-doc-title">
      <h1>생 산 실 적 보 고 서</h1>
      <p>Production Performance Report</p>
    </div>

    <table class="rpt-info-box">
      <tr>
        <td class="rpt-label">보고 기간</td><td>${periodLabel}</td>
        <td class="rpt-label">작성일</td><td>${today}</td>
      </tr>
      <tr>
        <td class="rpt-label">보고 구분</td><td>${viewMode==='month'?'월간 보고':'일간 보고'}</td>
        <td class="rpt-label">작성 부서</td><td>생산관리팀</td>
      </tr>
    </table>

    <div class="rpt-sec">
      <div class="rpt-sec-title">1. 핵심 생산 지표 (Key Performance Indicators)</div>
      <div class="rpt-kpi-grid">
        <div class="rpt-kpi-card">
          <div class="rk-label">총 생산량</div>
          <div class="rk-val">${(totalProduced/1000).toFixed(1)}K</div>
          <div class="rk-unit">매 (${fmtN(totalProduced)})</div>
        </div>
        <div class="rpt-kpi-card">
          <div class="rk-label">총 양품수</div>
          <div class="rk-val" style="color:#059669">${(totalGood/1000).toFixed(1)}K</div>
          <div class="rk-unit">매 (${fmtN(totalGood)})</div>
        </div>
        <div class="rpt-kpi-card">
          <div class="rk-label">총 불량수</div>
          <div class="rk-val" style="color:#dc2626">${fmtN(totalDefect)}</div>
          <div class="rk-unit">매 (불량률 ${defectRate.toFixed(2)}%)</div>
        </div>
        <div class="rpt-kpi-card" style="border-top-color:${yieldRate>=97?'#059669':yieldRate>=94?'#d97706':'#dc2626'}">
          <div class="rk-label">종합 양품률</div>
          <div class="rk-val" style="color:${yieldRate>=97?'#059669':yieldRate>=94?'#d97706':'#dc2626'}">${yieldRate.toFixed(2)}%</div>
          <div class="rk-unit">목표 97.0%</div>
        </div>
        <div class="rpt-kpi-card" style="border-top-color:${achRate>=98?'#059669':achRate>=90?'#d97706':'#dc2626'}">
          <div class="rk-label">계획 달성률</div>
          <div class="rk-val" style="color:${achRate>=98?'#059669':achRate>=90?'#d97706':'#dc2626'}">${achRate.toFixed(1)}%</div>
          <div class="rk-unit">목표 98.0%</div>
        </div>
      </div>
    </div>

    <div class="rpt-sec">
      <div class="rpt-sec-title">2. 라인별 생산 실적</div>
      <table class="rpt-table">
        <thead><tr>
          <th>라인</th><th>계획량(매)</th><th>생산량(매)</th><th>양품수(매)</th><th>불량수(매)</th><th>양품률</th><th>달성률</th><th>가동일수</th>
        </tr></thead>
        <tbody>
          ${lineRows}
          <tr class="rpt-total">
            <td>합 계</td>
            <td class="num">${fmtN(totalPlanned)}</td>
            <td class="num">${fmtN(totalProduced)}</td>
            <td class="num rpt-good">${fmtN(totalGood)}</td>
            <td class="num rpt-bad">${fmtN(totalDefect)}</td>
            <td class="${yColor(yieldRate)}">${yieldRate.toFixed(2)}%</td>
            <td class="${aColor(achRate)}">${achRate.toFixed(1)}%</td>
            <td>-</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="rpt-sec">
      <div class="rpt-sec-title">3. 제품별 생산 현황</div>
      <table class="rpt-table">
        <thead><tr>
          <th>제품명/모델</th><th>생산량(매)</th><th>생산 비중</th><th>양품수(매)</th><th>불량수(매)</th><th>양품률</th>
        </tr></thead>
        <tbody>${prodRows}</tbody>
      </table>
    </div>

    <div class="rpt-sec">
      <div class="rpt-sec-title">4. 종합 의견 및 조치 사항</div>
      <table class="rpt-table">
        <thead><tr><th style="width:30px">No.</th><th style="text-align:left">내용</th></tr></thead>
        <tbody>
          ${opinions.map((o,i)=>`<tr><td>${i+1}</td><td style="text-align:left;padding-left:12px">${o}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>

    <table class="rpt-sign">
      <tr>
        <td class="rpt-label">작성</td><td class="sign-box"></td>
        <td class="rpt-label">검토</td><td class="sign-box"></td>
        <td class="rpt-label">승인</td><td class="sign-box"></td>
      </tr>
    </table>

    <div class="rpt-footer">
      본 보고서는 PCB Manufacturing 생산관리 시스템에서 자동 생성되었습니다. &nbsp;|&nbsp; 출력일시: ${new Date().toLocaleString('ko-KR')}
    </div>`;

  document.getElementById('rptOverlay').classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeReport() {
  document.getElementById('rptOverlay').classList.remove('show');
  document.body.style.overflow = '';
}

/* ── CSV 내보내기 ── */
function exportCSV() {
  const rs   = getRecords().sort((a, b) => a.date.localeCompare(b.date));
  const rows = ['날짜,라인,제품명,층수,계획량,생산량,양품수,불량수,양품률(%),작업자,비고'];
  rs.forEach(r => {
    const y = r.produced ? (r.good / r.produced * 100).toFixed(2) : '0.00';
    rows.push(`${r.date},${r.line},${r.product},${r.layer},${r.planned},${r.produced},${r.good},${r.defect},${y},${r.worker},${r.note}`);
  });
  const blob = new Blob(['﻿' + rows.join('\n')], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `생산실적_${currentYM}.csv`;
  a.click();
  showToast('📥 CSV 파일을 내보냈습니다.');
}

function renderAll() {
  renderKPI();
  renderLineCards();
  renderAlertBanner();
  renderTrend();
  renderYield();
  renderTable();
}

/* ── 단축키 ── */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (document.getElementById('rptOverlay').classList.contains('show')) closeReport();
    else if (document.getElementById('modal').classList.contains('show')) closeModal();
  }
});

/* ── 초기화 ── */
document.getElementById('singleDate').value = today;
updateDateLabel();
renderAll();
