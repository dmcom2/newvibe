/* 불량 분석 리포트 전체 로직 */

Chart.defaults.color = '#718096';
Chart.defaults.borderColor = '#e2e8f0';

const LINE_COLORS = {'1호기':'#2563eb','2호기':'#059669','3호기':'#d97706','4호기':'#7c3aed','5호기':'#dc2626'};
const LINES = ['1호기','2호기','3호기','4호기','5호기'];
const DEFECT_TYPES = ['단락(Short)','개방(Open)','기공(Void)','이물(Foreign Material)','치수불량','박리(Peeling)','도금불량','변색','기타'];

/* ── 샘플 데이터 ── */
const today = new Date().toISOString().slice(0, 10);
const Y = today.slice(0, 4), M = today.slice(5, 7);

function genSample() {
  const arr = [];
  const prods   = ['PCB-A2401','PCB-B1802','PCB-C3305','PCB-D0401','PCB-E0502'];
  const procs   = ['에칭','도금','외관검사','전기검사','출하검사'];
  const sevs    = ['critical','major','minor','minor','minor'];
  const causes  = ['원자재 품질 이상','작업자 숙련도 부족','설비 파라미터 오류','오염물질 유입','마스크 손상'];
  for (let d = 1; d <= 25; d++) {
    const dd   = String(d).padStart(2, '0');
    const date = `${Y}-${M}-${dd}`;
    const cnt  = Math.floor(Math.random() * 5) + 1;
    for (let i = 0; i < cnt; i++) {
      const ti = Math.floor(Math.random() * DEFECT_TYPES.length);
      arr.push({
        id:       Date.now() + Math.random(),
        date,
        line:     LINES[Math.floor(Math.random() * LINES.length)],
        product:  prods[Math.floor(Math.random() * prods.length)],
        type:     DEFECT_TYPES[ti],
        qty:      Math.floor(Math.random() * 10) + 1,
        severity: sevs[Math.floor(Math.random() * sevs.length)],
        process:  procs[Math.floor(Math.random() * procs.length)],
        worker:   '검사원' + (Math.floor(Math.random() * 3) + 1),
        cause:    causes[Math.floor(Math.random() * causes.length)],
        action:   '',
      });
    }
  }
  return arr;
}

let defects = JSON.parse(localStorage.getItem('pcbDefects') || 'null') || genSample();
let editId  = null;
let nextId  = Date.now();
let paretoChart = null, lineChart = null, trendChart = null, severityChart = null;

function save() { localStorage.setItem('pcbDefects', JSON.stringify(defects)); }

/* ── 토스트 ── */
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2500);
}

/* ── 필터 ── */
function getFiltered() {
  const from = document.getElementById('f-from').value;
  const to   = document.getElementById('f-to').value;
  const line = document.getElementById('f-line').value;
  const type = document.getElementById('f-type').value;
  return defects.filter(d => {
    if (from && d.date < from) return false;
    if (to   && d.date > to)   return false;
    if (line && d.line !== line) return false;
    if (type && d.type !== type) return false;
    return true;
  });
}

/* ── KPI ── */
function renderKPI() {
  const ds       = getFiltered();
  const total    = ds.reduce((s, d) => s + d.qty, 0);
  const critical = ds.filter(d => d.severity === 'critical').reduce((s, d) => s + d.qty, 0);
  const major    = ds.filter(d => d.severity === 'major').reduce((s, d) => s + d.qty, 0);
  const types    = new Set(ds.map(d => d.type)).size;
  document.getElementById('kpiRow').innerHTML = `
    <div class="kpi k1"><div class="kpi-l">총 불량 건수</div><div class="kpi-v" style="color:var(--red)">${ds.length}</div><div class="kpi-sub">총 ${total.toLocaleString()}매</div></div>
    <div class="kpi k2"><div class="kpi-l">심각(Critical)</div><div class="kpi-v" style="color:#b91c1c">${ds.filter(d => d.severity === 'critical').length}</div><div class="kpi-sub">${critical}매</div></div>
    <div class="kpi k3"><div class="kpi-l">주의(Major)</div><div class="kpi-v" style="color:var(--amber)">${ds.filter(d => d.severity === 'major').length}</div><div class="kpi-sub">${major}매</div></div>
    <div class="kpi k4"><div class="kpi-l">불량 유형 수</div><div class="kpi-v" style="color:var(--blue)">${types}</div><div class="kpi-sub">개 유형</div></div>`;
}

/* ── 파레토 차트 ── */
function renderPareto() {
  if (paretoChart) paretoChart.destroy();
  const ds     = getFiltered();
  const byType = {};
  ds.forEach(d => { byType[d.type] = (byType[d.type] || 0) + d.qty; });
  const sorted  = Object.entries(byType).sort((a, b) => b[1] - a[1]);
  const total   = sorted.reduce((s, [, v]) => s + v, 0);
  let cum = 0;
  const cumPcts = sorted.map(([, v]) => { cum += v; return +(cum / total * 100).toFixed(1); });
  const ctx = document.getElementById('paretoChart').getContext('2d');
  paretoChart = new Chart(ctx, {
    data: {
      labels: sorted.map(([k]) => k),
      datasets: [
        {type:'bar', label:'불량수(매)', data:sorted.map(([, v]) => v),
          backgroundColor:'rgba(220,38,38,.7)', borderRadius:4, yAxisID:'y'},
        {type:'line', label:'누적률(%)', data:cumPcts,
          borderColor:'#2563eb', backgroundColor:'transparent',
          tension:0.1, pointRadius:4, yAxisID:'y2'}
      ]
    },
    options: {responsive:true, maintainAspectRatio:true,
      scales: {y:{beginAtZero:true}, y2:{min:0, max:100, position:'right', ticks:{callback:v => v + '%'}}},
      plugins: {legend:{labels:{font:{size:10}}}}}
  });
}

/* ── 라인별 도넛 차트 ── */
function renderLine() {
  if (lineChart) lineChart.destroy();
  const ds     = getFiltered();
  const byLine = {};
  ds.forEach(d => { byLine[d.line] = (byLine[d.line] || 0) + d.qty; });
  const lines = Object.keys(byLine);
  const ctx = document.getElementById('lineChart').getContext('2d');
  lineChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: lines,
      datasets: [{data: lines.map(l => byLine[l]),
        backgroundColor: lines.map(l => LINE_COLORS[l] || '#64748b'),
        borderColor: '#fff', borderWidth: 2}]
    },
    options: {responsive:true, maintainAspectRatio:true,
      plugins: {legend:{position:'right', labels:{font:{size:10}}}}}
  });
}

/* ── 트렌드 차트 ── */
function renderTrend() {
  if (trendChart) trendChart.destroy();
  const ds     = getFiltered();
  const byDate = {};
  ds.forEach(d => { byDate[d.date] = (byDate[d.date] || 0) + d.qty; });
  const dates = Object.keys(byDate).sort();
  const ctx = document.getElementById('trendChart').getContext('2d');
  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates.map(d => d.slice(5)),
      datasets: [{label:'불량수(매)', data:dates.map(d => byDate[d]),
        borderColor:'#dc2626', backgroundColor:'rgba(220,38,38,.08)',
        fill:true, tension:.3, pointRadius:3}]
    },
    options: {responsive:true, maintainAspectRatio:true, plugins:{legend:{display:false}}}
  });
}

/* ── 파레토 테이블 ── */
function renderParetoTable() {
  const ds     = getFiltered();
  const byType = {};
  ds.forEach(d => { byType[d.type] = (byType[d.type] || 0) + d.qty; });
  const sorted = Object.entries(byType).sort((a, b) => b[1] - a[1]);
  const total  = sorted.reduce((s, [, v]) => s + v, 0);
  const maxVal = sorted.length ? sorted[0][1] : 1;
  let cum = 0;
  document.getElementById('paretoTable').innerHTML =
    `<thead><tr><th>불량 유형</th><th>건수(매)</th><th>비율</th><th>누적률</th></tr></thead>
    <tbody>${sorted.map(([type, cnt]) => {
      const pct = total ? (cnt / total * 100) : 0;
      cum += pct;
      return `<tr>
        <td>${type}</td>
        <td style="text-align:right;font-weight:700">${cnt}</td>
        <td>${pct.toFixed(1)}%<div class="pareto-bar"><div class="pareto-fill" style="width:${cnt / maxVal * 100}%"></div></div></td>
        <td class="cum-cell" style="color:${cum <= 80 ? 'var(--red)' : 'var(--sub)'}">${cum.toFixed(1)}%</td>
      </tr>`;
    }).join('')}</tbody>`;
}

/* ── 미션 1: 날짜 × 라인 히트맵 ── */
function renderHeatmap() {
  const ds     = getFiltered();
  const byKey  = {};
  ds.forEach(d => {
    const k = `${d.date}|${d.line}`;
    byKey[k] = (byKey[k] || 0) + d.qty;
  });
  const dates  = [...new Set(ds.map(d => d.date))].sort().slice(-20);
  const lines  = LINES.filter(l => ds.some(d => d.line === l));
  const maxVal = Math.max(1, ...Object.values(byKey));

  const thead = `<tr><th>날짜</th>${lines.map(l =>
    `<th style="color:${LINE_COLORS[l]||'#64748b'}">${l}</th>`).join('')}<th>합계</th></tr>`;

  const tbody = dates.map(date => {
    const cells = lines.map(line => {
      const v = byKey[`${date}|${line}`] || 0;
      if (!v) return `<td class="hm-0">-</td>`;
      const intensity = Math.round(v / maxVal * 80) + 10;
      return `<td style="background:rgba(220,38,38,${intensity / 100});color:${intensity > 50 ? '#fff' : '#7c1d1d'}">${v}</td>`;
    });
    const rowTotal = lines.reduce((s, l) => s + (byKey[`${date}|${l}`] || 0), 0);
    return `<tr><td class="hm-date">${date.slice(5)}</td>${cells.join('')}<td class="hm-total">${rowTotal}</td></tr>`;
  }).join('');

  const colTotals = lines.map(l => dates.reduce((s, d) => s + (byKey[`${d}|${l}`] || 0), 0));
  const grandTotal = colTotals.reduce((s, v) => s + v, 0);
  const tfoot = `<tr style="background:var(--bg);font-weight:700"><td>합계</td>${colTotals.map(v => `<td>${v}</td>`).join('')}<td>${grandTotal}</td></tr>`;

  document.getElementById('heatmapWrap').innerHTML =
    `<table class="heatmap-table"><thead>${thead}</thead><tbody>${tbody}</tbody><tfoot>${tfoot}</tfoot></table>`;
}

/* ── 미션 2: 심각도별 라인 비교 스택 바 차트 ── */
function renderSeverityChart() {
  if (severityChart) severityChart.destroy();
  const ds      = getFiltered();
  const lines   = LINES.filter(l => ds.some(d => d.line === l));
  const sevKeys = ['critical','major','minor'];
  const sevLabels = {'critical':'심각(Critical)','major':'주의(Major)','minor':'경미(Minor)'};
  const sevColors = {'critical':'rgba(185,28,28,.85)','major':'rgba(217,119,6,.85)','minor':'rgba(5,150,105,.85)'};

  const counts = {};
  lines.forEach(l => {
    counts[l] = {critical:0, major:0, minor:0};
  });
  ds.forEach(d => {
    if (counts[d.line]) counts[d.line][d.severity] = (counts[d.line][d.severity] || 0) + 1;
  });

  const ctx = document.getElementById('severityChart').getContext('2d');
  severityChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: lines,
      datasets: sevKeys.map(sev => ({
        label:           sevLabels[sev],
        data:            lines.map(l => counts[l]?.[sev] || 0),
        backgroundColor: sevColors[sev],
        borderRadius:    4,
      }))
    },
    options: {responsive:true, maintainAspectRatio:false,
      scales: {x:{stacked:true}, y:{stacked:true, beginAtZero:true, ticks:{stepSize:1}}},
      plugins: {legend:{labels:{font:{size:11}}}}}
  });
  document.getElementById('severityChart').style.maxHeight = '220px';
}

/* ── 미션 3: 파레토 집중 경보 ── */
function renderParetoAlert() {
  const ds     = getFiltered();
  const byType = {};
  ds.forEach(d => { byType[d.type] = (byType[d.type] || 0) + d.qty; });
  const sorted = Object.entries(byType).sort((a, b) => b[1] - a[1]);
  const total  = sorted.reduce((s, [, v]) => s + v, 0);

  const banner = document.getElementById('paretoAlert');
  if (!sorted.length || !total) { banner.style.display = 'none'; return; }

  const [topType, topQty] = sorted[0];
  const topPct = (topQty / total * 100).toFixed(1);

  if (topQty / total >= 0.5) {
    banner.style.display = 'flex';
    banner.innerHTML = `⚠️ 파레토 집중 경보
      <span style="background:rgba(255,255,255,.2);padding:2px 12px;border-radius:5px;">
        <strong>${topType}</strong> — 전체의 <strong>${topPct}%</strong> 집중
      </span>
      <span style="margin-left:auto;font-size:.78rem;font-weight:400;opacity:.85;">
        즉시 원인 분석 및 개선조치 필요
      </span>`;
  } else {
    banner.style.display = 'none';
  }
}

/* ── 불량 목록 ── */
function renderDefectList() {
  const q  = document.getElementById('searchInput').value.toLowerCase();
  const ds = getFiltered()
    .filter(d => !q || d.product.toLowerCase().includes(q) || d.type.includes(q) ||
                 (d.cause||'').includes(q) || d.worker.includes(q))
    .sort((a, b) => b.date.localeCompare(a.date));
  const sevMap   = {critical:'sev-critical', major:'sev-major', minor:'sev-minor'};
  const sevLabel = {critical:'심각', major:'주의', minor:'경미'};
  document.getElementById('defectTable').innerHTML =
    `<thead><tr><th>날짜</th><th>라인</th><th>제품명</th><th>불량유형</th><th>수량</th><th>심각도</th><th>발견공정</th><th>원인</th><th>담당자</th><th>편집</th></tr></thead>
    <tbody>${ds.map(d => `<tr>
      <td>${d.date}</td>
      <td><span class="line-badge" style="background:${LINE_COLORS[d.line]||'#64748b'}">${d.line}</span></td>
      <td>${d.product}</td><td>${d.type}</td>
      <td style="text-align:right;font-weight:700;color:var(--red)">${d.qty}</td>
      <td><span class="sev-chip ${sevMap[d.severity]||''}">${sevLabel[d.severity]||d.severity}</span></td>
      <td>${d.process}</td>
      <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.cause||'-'}</td>
      <td>${d.worker}</td>
      <td><button class="edit-btn" onclick="editDefect(${d.id})">편집</button></td>
    </tr>`).join('')}</tbody>`;
}

/* ── 모달 ── */
function openModal(id = null) {
  editId = id;
  const d = id ? defects.find(x => x.id === id) : null;
  document.getElementById('modalTitle').textContent = id ? '불량 수정' : '불량 발생 등록';
  document.getElementById('delBtn').style.display   = id ? 'block' : 'none';
  document.getElementById('d-date').value     = d?.date     || today;
  document.getElementById('d-line').value     = d?.line     || '1호기';
  document.getElementById('d-product').value  = d?.product  || '';
  document.getElementById('d-type').value     = d?.type     || DEFECT_TYPES[0];
  document.getElementById('d-qty').value      = d?.qty      || '';
  document.getElementById('d-severity').value = d?.severity || 'minor';
  document.getElementById('d-process').value  = d?.process  || '외관검사';
  document.getElementById('d-worker').value   = d?.worker   || '';
  document.getElementById('d-cause').value    = d?.cause    || '';
  document.getElementById('d-action').value   = d?.action   || '';
  document.getElementById('modal').classList.add('show');
}
function editDefect(id) { openModal(id); }
function closeModal() { document.getElementById('modal').classList.remove('show'); editId = null; }

function saveDefect() {
  const product = document.getElementById('d-product').value.trim();
  if (!product) { showToast('❌ 제품명을 입력하세요.'); return; }
  const rec = {
    id:       editId || nextId++,
    date:     document.getElementById('d-date').value,
    line:     document.getElementById('d-line').value,
    product,
    type:     document.getElementById('d-type').value,
    qty:      parseInt(document.getElementById('d-qty').value) || 1,
    severity: document.getElementById('d-severity').value,
    process:  document.getElementById('d-process').value,
    worker:   document.getElementById('d-worker').value,
    cause:    document.getElementById('d-cause').value,
    action:   document.getElementById('d-action').value,
  };
  if (editId) {
    const i = defects.findIndex(x => x.id === editId);
    if (i >= 0) defects[i] = rec;
  } else {
    defects.push(rec);
  }
  save(); closeModal(); renderAll();
  showToast(editId ? '✅ 불량 정보가 수정되었습니다.' : '✅ 불량이 등록되었습니다.');
}

function deleteDefect() {
  if (!confirm('이 불량 기록을 삭제하시겠습니까?')) return;
  defects = defects.filter(x => x.id !== editId);
  save(); closeModal(); renderAll();
  showToast('🗑 불량 기록이 삭제되었습니다.');
}

/* ── CSV 내보내기 ── */
function exportCSV() {
  const ds   = getFiltered();
  const rows = ['날짜,라인,제품명,불량유형,수량,심각도,발견공정,원인,조치내용,담당자'];
  ds.forEach(d => rows.push(
    `${d.date},${d.line},${d.product},${d.type},${d.qty},${d.severity},${d.process},"${d.cause}","${d.action}",${d.worker}`
  ));
  const blob = new Blob(['﻿' + rows.join('\n')], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '불량분석.csv';
  a.click();
  showToast('📥 CSV 파일을 내보냈습니다.');
}

function renderAll() {
  renderKPI();
  renderParetoAlert();
  renderPareto();
  renderLine();
  renderTrend();
  renderHeatmap();
  renderSeverityChart();
  renderParetoTable();
  renderDefectList();
}

/* ── 보고서 출력 ── */
function openReport() {
  const from = document.getElementById('f-from').value;
  const to   = document.getElementById('f-to').value;
  const line = document.getElementById('f-line').value;
  const type = document.getElementById('f-type').value;
  const filtered = getFiltered();
  const total = filtered.reduce((s, d) => s + d.qty, 0);
  const critical = filtered.filter(d => d.severity === 'critical').length;
  const byType = {};
  filtered.forEach(d => { byType[d.type] = (byType[d.type] || 0) + d.qty; });
  const sortedTypes = Object.entries(byType).sort((a, b) => b[1] - a[1]);
  const top1 = sortedTypes[0] ? sortedTypes[0][0].split('(')[0] : '-';
  const byLine = {};
  LINES.forEach(l => { byLine[l] = 0; });
  filtered.forEach(d => { byLine[d.line] = (byLine[d.line] || 0) + d.qty; });
  const now = new Date().toLocaleDateString('ko-KR', {year:'numeric', month:'2-digit', day:'2-digit'});
  const filterDesc = [line ? '라인: ' + line : '', type ? '유형: ' + type : ''].filter(Boolean).join(' | ');
  document.getElementById('rptPage').innerHTML = `
    <div class="rpt-company"><strong>PCB Manufacturing Co., Ltd.</strong><br>품질관리부</div>
    <div class="rpt-doc-title"><h1>불 량 분 석 보 고 서</h1><p>조회기간: ${from} ~ ${to}${filterDesc ? ' | ' + filterDesc : ''}</p></div>
    <table class="rpt-info-box">
      <tr><td class="rpt-label">작성일</td><td>${now}</td><td class="rpt-label">작성부서</td><td>품질관리부</td></tr>
      <tr><td class="rpt-label">작성자</td><td></td><td class="rpt-label">결재</td><td></td></tr>
    </table>
    <div class="rpt-sec">
      <div class="rpt-sec-title">■ 1. 불량 현황 KPI</div>
      <div class="rpt-kpi-grid">
        <div class="rpt-kpi-card"><div class="rk-label">총 불량 건수</div><div class="rk-val">${filtered.length}</div><div class="rk-unit">건</div></div>
        <div class="rpt-kpi-card"><div class="rk-label">총 불량 수량</div><div class="rk-val">${total}</div><div class="rk-unit">매</div></div>
        <div class="rpt-kpi-card"><div class="rk-label">심각(Critical)</div><div class="rk-val rpt-bad">${critical}</div><div class="rk-unit">건</div></div>
        <div class="rpt-kpi-card"><div class="rk-label">최다 불량 유형</div><div class="rk-val" style="font-size:8pt">${top1}</div><div class="rk-unit">&nbsp;</div></div>
      </div>
    </div>
    <div class="rpt-sec">
      <div class="rpt-sec-title">■ 2. 불량 유형별 현황 (파레토 순)</div>
      <table class="rpt-table">
        <thead><tr><th>순위</th><th>불량 유형</th><th>불량 수량 (매)</th><th>비율 (%)</th></tr></thead>
        <tbody>
          ${sortedTypes.map(([t, q], i) => `<tr><td>${i + 1}</td><td style="text-align:left">${t}</td><td class="num">${q}</td><td>${total ? ((q / total) * 100).toFixed(1) : '0.0'}%</td></tr>`).join('')}
          <tr class="rpt-total"><td colspan="2">합 계</td><td class="num">${total}</td><td>100%</td></tr>
        </tbody>
      </table>
    </div>
    <div class="rpt-sec">
      <div class="rpt-sec-title">■ 3. 라인별 불량 현황</div>
      <table class="rpt-table">
        <thead><tr><th>라인</th><th>불량 수량 (매)</th><th>비율 (%)</th></tr></thead>
        <tbody>
          ${LINES.map(l => `<tr><td>${l}</td><td class="num">${byLine[l]}</td><td>${total ? ((byLine[l] / total) * 100).toFixed(1) : '0.0'}%</td></tr>`).join('')}
          <tr class="rpt-total"><td>합 계</td><td class="num">${total}</td><td>100%</td></tr>
        </tbody>
      </table>
    </div>
    <div class="rpt-sec">
      <div class="rpt-sec-title">■ 4. 최근 불량 발생 목록 (최근 10건)</div>
      <table class="rpt-table">
        <thead><tr><th>발생일</th><th>라인</th><th>불량유형</th><th>수량</th><th>심각도</th><th>공정</th></tr></thead>
        <tbody>
          ${[...filtered].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10).map(d => `<tr>
            <td>${d.date}</td><td>${d.line}</td><td style="text-align:left">${d.type}</td>
            <td class="num">${d.qty}</td>
            <td class="${d.severity === 'critical' ? 'rpt-bad' : d.severity === 'major' ? 'rpt-warn' : 'rpt-good'}">${d.severity === 'critical' ? '심각' : d.severity === 'major' ? '주의' : '경미'}</td>
            <td>${d.process}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <table class="rpt-sign">
      <tr>
        <td class="rpt-label">담당</td><td class="sign-box"></td>
        <td class="rpt-label">팀장</td><td class="sign-box"></td>
        <td class="rpt-label">부장</td><td class="sign-box"></td>
        <td class="rpt-label">임원</td><td class="sign-box"></td>
      </tr>
    </table>
    <div class="rpt-footer">본 보고서는 PCB Manufacturing QA 시스템에서 자동 생성되었습니다.</div>
  `;
  document.getElementById('rptOverlay').classList.add('show');
  document.body.style.overflow = 'hidden';
}
function closeReport() {
  document.getElementById('rptOverlay').classList.remove('show');
  document.body.style.overflow = '';
}

/* ── 단축키 ── */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.getElementById('rptOverlay').classList.contains('show')) { closeReport(); return; }
  if (e.key === 'Escape' && document.getElementById('modal').classList.contains('show')) closeModal();
});

/* ── 초기화 ── */
const firstDay = `${Y}-${M}-01`;
document.getElementById('f-from').value = firstDay;
document.getElementById('f-to').value   = today;
renderAll();
