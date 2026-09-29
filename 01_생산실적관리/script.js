/* 생산 실적 관리 시스템 전체 로직 */

Chart.defaults.color = '#64748b';
Chart.defaults.borderColor = '#edf1f5';
Chart.defaults.font.family = "'Pretendard','맑은 고딕',sans-serif";

/* ── 라인 색상 ── */
const LINE_COLORS = {'1호기':'#2563eb','2호기':'#059669','3호기':'#d97706','4호기':'#7c3aed','5호기':'#dc2626'};

/* ── 목표 기준값 ── */
const YIELD_TARGET = 97.0;   // 양품률 목표(%)
const ACH_TARGET   = 98.0;   // 계획달성률 목표(%)
const yieldLevel = y => y >= YIELD_TARGET ? 'good' : y >= 94 ? 'warn' : 'bad';
const achLevel   = a => a >= ACH_TARGET   ? 'good' : a >= 90 ? 'warn' : 'bad';
const LEVEL_TEXT = {good:'달성', warn:'주의', bad:'미달'};

/* ── 샘플 데이터 생성 ── */
function makeId() { return Date.now() + Math.random(); }
// 로컬(한국) 날짜 기준 YYYY-MM-DD — toISOString()은 UTC라 오전 9시 이전엔 전날로 나옴
const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
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

/* ── 조회 기간 라벨 ── */
function renderPeriod() {
  const rs = getRecords();
  const label = viewMode === 'month'
    ? `${currentYM.replace('-', '년 ')}월 월간 집계`
    : `${document.getElementById('singleDate').value || today} 일간 집계`;
  const days = new Set(rs.map(r => r.date)).size;
  document.getElementById('periodLabel').textContent = `${label} · 가동 ${days}일 · 실적 ${rs.length}건`;
}

/* ── 헤더 상태: 시계 · 보고 마감 · 금일 입력 라인 수 ── */
function renderStatus() {
  const now = new Date();
  document.getElementById('clock').textContent =
    now.toLocaleTimeString('ko-KR', {hour:'2-digit', minute:'2-digit', hour12:false});

  // 매일 09:00 보고 마감까지 남은 시간
  const due  = new Date(now); due.setHours(9, 0, 0, 0);
  const left = Math.round((due - now) / 60000);
  const dl   = document.getElementById('deadline');
  if (left > 0) {
    dl.textContent = `${Math.floor(left / 60)}시간 ${left % 60}분 남음`;
    dl.className = 'st-val ' + (left <= 30 ? 'bad' : left <= 90 ? 'warn' : 'ok');
  } else {
    dl.textContent = '금일 마감 경과';
    dl.className = 'st-val';
  }

  // 오늘 날짜로 실적이 입력된 라인 수 / 전체 운영 라인 수
  const allLines   = new Set(records.map(r => r.line));
  const todayLines = new Set(records.filter(r => r.date === today).map(r => r.line));
  const ti = document.getElementById('todayInput');
  ti.textContent = `${todayLines.size} / ${allLines.size} 라인`;
  ti.className = 'st-val ' + (allLines.size && todayLines.size >= allLines.size ? 'ok' : 'warn');
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
  const defectRate    = totalProduced ? (totalDefect / totalProduced * 100) : 0;
  const yl = rs.length ? yieldLevel(yieldRate) : '';
  const al = rs.length ? achLevel(achRate) : '';

  // 목표 게이지: 표시 범위(min~max) 안에서 현재값·목표선 위치를 %로 환산
  const gauge = (v, goal, min, max) => {
    const pos = x => Math.max(0, Math.min(100, (x - min) / (max - min) * 100));
    return `<div class="gauge"><div class="gauge-fill" style="width:${pos(v)}%"></div><div class="gauge-goal" style="left:${pos(goal)}%"></div></div>
      <div class="gauge-scale"><span>${min}%</span><span>목표 ${goal.toFixed(1)}%</span><span>${max}%</span></div>`;
  };

  document.getElementById('kpiRow').innerHTML = `
    <div class="kpi k1">
      <div class="kpi-top"><span class="kpi-l">총 생산량</span><span class="tag info">계획 ${totalPlanned.toLocaleString()}</span></div>
      <div class="kpi-v">${totalProduced.toLocaleString()}<small>매</small></div>
      <div class="kpi-sub">계획 대비 ${(totalProduced - totalPlanned).toLocaleString()}매</div>
    </div>
    <div class="kpi k2">
      <div class="kpi-top"><span class="kpi-l">총 양품수</span></div>
      <div class="kpi-v" style="color:var(--green)">${totalGood.toLocaleString()}<small>매</small></div>
      <div class="kpi-sub">출하 가능 수량</div>
    </div>
    <div class="kpi k3">
      <div class="kpi-top"><span class="kpi-l">총 불량수</span><span class="tag bad">불량률 ${defectRate.toFixed(2)}%</span></div>
      <div class="kpi-v">${totalDefect.toLocaleString()}<small>매</small></div>
      <div class="kpi-sub">재작업·폐기 대상</div>
    </div>
    <div class="kpi ${yl}">
      <div class="kpi-top"><span class="kpi-l">양품률</span>${yl ? `<span class="tag ${yl}">${LEVEL_TEXT[yl]}</span>` : ''}</div>
      <div class="kpi-v">${yieldRate.toFixed(2)}<small>%</small></div>
      ${gauge(yieldRate, YIELD_TARGET, 90, 100)}
    </div>
    <div class="kpi ${al}">
      <div class="kpi-top"><span class="kpi-l">계획 달성률</span>${al ? `<span class="tag ${al}">${LEVEL_TEXT[al]}</span>` : ''}</div>
      <div class="kpi-v">${achRate.toFixed(1)}<small>%</small></div>
      ${gauge(achRate, ACH_TARGET, 80, 110)}
    </div>`;
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
  const lines = Object.keys(byLine).sort();
  const el = document.getElementById('lineCards');
  if (!lines.length) { el.innerHTML = '<div class="lc-empty">조회 기간에 입력된 실적이 없습니다. 상단 [＋ 실적 입력]으로 등록하세요.</div>'; return; }
  el.innerHTML = lines.map(line => {
    const d         = byLine[line];
    const yieldRate = d.produced ? (d.good / d.produced * 100) : 0;
    const achRate   = d.planned  ? (d.produced / d.planned * 100) : 0;
    const color     = LINE_COLORS[line] || '#64748b';
    const yClass    = yieldLevel(yieldRate);
    const aClass    = achLevel(achRate);
    // 램프 색: 양품률·달성률 중 더 나쁜 상태를 표시
    const order     = ['good', 'warn', 'bad'];
    const lamp      = order[Math.max(order.indexOf(yClass), order.indexOf(aClass))];
    return `<div class="lc">
      <div class="lc-head">
        <i class="lc-chip" style="background:${color}"></i>
        <span class="lc-name">${line}</span>
        <i class="lamp ${lamp}" title="${LEVEL_TEXT[lamp]}"></i>
      </div>
      <div class="lc-body">
        <div class="lc-main">${d.produced.toLocaleString()}<small>/ ${d.planned.toLocaleString()} 매</small></div>
        <div class="gauge ${aClass}"><div class="gauge-fill" style="width:${Math.min(100, achRate)}%"></div></div>
        <div class="lc-stats">
          <div class="lc-stat ${yClass}"><span>양품률</span><b>${yieldRate.toFixed(2)}%</b></div>
          <div class="lc-stat ${aClass}"><span>달성률</span><b>${achRate.toFixed(1)}%</b></div>
        </div>
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
  banner.innerHTML = `<i class="pulse"></i> 불량률 경보 · 양품률 목표 미달 라인 즉시 점검 필요
    ${alerts.map(a => `<span class="alert-tag">${a.line} <b>${a.rate.toFixed(2)}%</b></span>`).join('')}
    <span class="alert-goal">기준: 양품률 ${YIELD_TARGET.toFixed(1)}% 이상</span>`;
}

/* ── 트렌드 차트 ── */
function renderTrend() {
  if (trendChart) trendChart.destroy();
  // 일간 뷰에서도 해당 월 전체 추이를 보여주고, 조회일을 강조
  const rs = records.filter(r => r.date.startsWith(currentYM));
  const sel = viewMode === 'day' ? document.getElementById('singleDate').value : null;
  const byDate = {}, planDate = {};
  rs.forEach(r => {
    byDate[r.date]   = (byDate[r.date]   || 0) + r.produced;
    planDate[r.date] = (planDate[r.date] || 0) + r.planned;
  });
  const labels = Object.keys(byDate).sort();
  const ctx = document.getElementById('trendChart').getContext('2d');
  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels.map(d => d.slice(5)),
      datasets: [
        {label:'생산량', data:labels.map(d => byDate[d]),
          borderColor:'#2563eb', backgroundColor:'rgba(37,99,235,.08)', borderWidth:2,
          fill:true, tension:.3,
          pointRadius:labels.map(d => d === sel ? 6 : 2.5),
          pointBackgroundColor:labels.map(d => d === sel ? '#0b1629' : '#2563eb')},
        {label:'계획량', data:labels.map(d => planDate[d]),
          borderColor:'#94a3b8', borderDash:[5, 4], borderWidth:1.5, pointRadius:0, fill:false, tension:.3}
      ]
    },
    options: {responsive:true, maintainAspectRatio:false,
      interaction: {mode:'index', intersect:false},
      plugins: {legend:{position:'top', align:'end', labels:{boxWidth:10, boxHeight:10, usePointStyle:true}},
        tooltip:{callbacks:{label:c => `${c.dataset.label}: ${c.parsed.y.toLocaleString()}매`}}},
      scales: {x:{grid:{display:false}}, y:{ticks:{callback:v => v.toLocaleString()}}}}
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
  const lines  = Object.keys(byLine).sort();
  const yields = lines.map(l => +(byLine[l].produced ? byLine[l].good / byLine[l].produced * 100 : 0).toFixed(2));
  const ctx = document.getElementById('yieldChart').getContext('2d');
  yieldChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: lines,
      datasets: [
        {label:'양품률(%)', data:yields,
          // 목표 미달 라인은 빨간색으로 강조
          backgroundColor: lines.map((l, i) => yields[i] < YIELD_TARGET ? '#ef4444' : (LINE_COLORS[l] || '#64748b')),
          borderRadius:4, maxBarThickness:44},
        {type:'line', label:'목표', data:lines.map(() => YIELD_TARGET),
          borderColor:'#0b1629', borderDash:[4, 4], borderWidth:1.5, pointRadius:0}
      ]
    },
    options: {responsive:true, maintainAspectRatio:false,
      plugins: {legend:{display:false},
        tooltip:{callbacks:{label:c => `${c.dataset.label}: ${c.parsed.y.toFixed(2)}%`}}},
      scales: {x:{grid:{display:false}}, y:{min:90, max:100, ticks:{callback:v => v + '%'}}}}
  });
}

/* ── 이력 테이블 ── */
function renderTable() {
  const q  = document.getElementById('tableSearch').value.toLowerCase();
  const rs = getRecords().filter(r =>
    !q || r.line.includes(q) || r.product.toLowerCase().includes(q) || r.worker.includes(q)
  ).sort((a, b) => b.date.localeCompare(a.date));

  const yieldRate = r => r.produced ? (r.good / r.produced * 100) : 0;
  const achRate   = r => r.planned  ? (r.produced / r.planned * 100) : 0;
  const chipClass = y => 'chip-' + yieldLevel(y);

  document.getElementById('rowCount').textContent = `${rs.length}건`;
  document.getElementById('recordTable').innerHTML =
    `<thead><tr>
      <th>날짜</th><th>라인</th><th>제품명</th><th>층수</th>
      <th class="num">계획</th><th class="num">생산</th><th class="num">양품</th><th class="num">불량</th>
      <th class="num">달성률</th><th>양품률</th><th>작업자</th><th>비고</th><th></th>
    </tr></thead>
    <tbody>${rs.length ? rs.map(r => {
      const y = yieldRate(r);
      const rowClass = y < YIELD_TARGET ? 'row-alert' : '';
      // 행 전체 클릭 시 수정 모달 열기
      return `<tr class="${rowClass}" onclick="editRecord(${r.id})">
        <td class="mono">${r.date}</td>
        <td><span class="line-badge"><i style="background:${LINE_COLORS[r.line]||'#64748b'}"></i>${r.line}</span></td>
        <td>${r.product}</td><td class="td-mute">${r.layer}</td>
        <td class="num td-mute">${r.planned.toLocaleString()}</td>
        <td class="num"><b>${r.produced.toLocaleString()}</b></td>
        <td class="num td-good">${r.good.toLocaleString()}</td>
        <td class="num td-bad">${r.defect.toLocaleString()}</td>
        <td class="num">${achRate(r).toFixed(1)}%</td>
        <td><span class="status-chip ${chipClass(y)}">${y.toFixed(2)}%</span></td>
        <td>${r.worker}</td>
        <td class="td-mute">${r.note || ''}</td>
        <td><button class="edit-btn" onclick="event.stopPropagation();editRecord(${r.id})">편집</button></td>
      </tr>`;
    }).join('') : '<tr class="empty"><td colspan="13">조회된 실적이 없습니다.</td></tr>'}</tbody>`;
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

  calc.innerHTML = `
    <div class="rc-box ${yieldLevel(yieldRate)}"><span>양품률 <em>목표 ${YIELD_TARGET}%</em></span><b>${yieldRate.toFixed(2)}%</b></div>
    <div class="rc-box ${planned ? achLevel(achRate) : ''}"><span>달성률 <em>목표 ${ACH_TARGET}%</em></span><b>${planned ? achRate.toFixed(1) + '%' : '-'}</b></div>
    <div class="rc-box"><span>불량(생산-양품)</span><b>${(produced - good).toLocaleString()}매</b></div>`;
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
  renderPeriod();
  renderStatus();
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
setInterval(renderStatus, 30000);   // 시계·마감 표시 30초마다 갱신
