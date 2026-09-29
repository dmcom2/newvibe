// 원자재 재고 관리 스크립트

const CAT_COLORS = {
  '동박적층판(CCL)':'#2563eb','드릴비트':'#059669','솔더마스크':'#d97706',
  '도금약품':'#dc2626','에칭약품':'#7c3aed','필름':'#0891b2','기타':'#6b7280'
};

const SAMPLE_ITEMS = [
  {id:'MAT001', code:'MAT-001', cat:'동박적층판(CCL)', name:'FR-4 1.6T 양면 CCL', unit:'매', stock:850, min:300, max:2000, vendor:'(주)CCL재료', lead:7, dailyUse:35},
  {id:'MAT002', code:'MAT-002', cat:'동박적층판(CCL)', name:'FR-4 1.6T 4층 CCL', unit:'매', stock:420, min:200, max:1500, vendor:'(주)CCL재료', lead:7, dailyUse:22},
  {id:'MAT003', code:'MAT-003', cat:'드릴비트', name:'드릴비트 Φ0.3mm', unit:'개', stock:180, min:200, max:800, vendor:'드릴코리아', lead:3, dailyUse:25},
  {id:'MAT004', code:'MAT-004', cat:'드릴비트', name:'드릴비트 Φ0.5mm', unit:'개', stock:95, min:200, max:600, vendor:'드릴코리아', lead:3, dailyUse:18},
  {id:'MAT005', code:'MAT-005', cat:'솔더마스크', name:'그린 솔더마스크 잉크', unit:'kg', stock:45, min:30, max:150, vendor:'잉크솔루션', lead:5, dailyUse:3.5},
  {id:'MAT006', code:'MAT-006', cat:'도금약품', name:'황산구리 1급', unit:'kg', stock:380, min:100, max:1000, vendor:'화학약품(주)', lead:10, dailyUse:28},
  {id:'MAT007', code:'MAT-007', cat:'도금약품', name:'황산 98%', unit:'L', stock:220, min:80, max:600, vendor:'화학약품(주)', lead:10, dailyUse:12},
  {id:'MAT008', code:'MAT-008', cat:'에칭약품', name:'염화구리 에칭액', unit:'L', stock:60, min:100, max:500, vendor:'에칭케미칼', lead:7, dailyUse:8},
  {id:'MAT009', code:'MAT-009', cat:'필름', name:'드라이 필름 포토레지스트', unit:'롤', stock:12, min:5, max:40, vendor:'필름코리아', lead:14, dailyUse:0.8},
  {id:'MAT010', code:'MAT-010', cat:'기타', name:'구리박 전해동박 18μm', unit:'롤', stock:28, min:10, max:80, vendor:'동박전문', lead:21, dailyUse:1.5},
];

const SAMPLE_TXNS = [
  {id:'TX001', date:'2026-08-01', type:'in', itemId:'MAT001', qty:500, vendor:'(주)CCL재료', worker:'김재고', note:'PO-2026-071'},
  {id:'TX002', date:'2026-08-02', type:'out', itemId:'MAT001', qty:70, vendor:'1호기 생산라인', worker:'이생산', note:'WO-2026-201'},
  {id:'TX003', date:'2026-08-03', type:'out', itemId:'MAT003', qty:50, vendor:'드릴링 라인', worker:'이생산', note:''},
  {id:'TX004', date:'2026-08-04', type:'in', itemId:'MAT006', qty:200, vendor:'화학약품(주)', worker:'박자재', note:'로트B-22'},
  {id:'TX005', date:'2026-08-05', type:'out', itemId:'MAT008', qty:16, vendor:'에칭라인', worker:'이생산', note:''},
];

let items = [], txns = [], catChart, statusChart, activeTab = 'stock';
let editItemId = null;

function getItems() { try { return JSON.parse(localStorage.getItem('stock_items')) || SAMPLE_ITEMS; } catch { return SAMPLE_ITEMS; } }
function getTxns() { try { return JSON.parse(localStorage.getItem('stock_txns')) || SAMPLE_TXNS; } catch { return SAMPLE_TXNS; } }
function saveItems() { localStorage.setItem('stock_items', JSON.stringify(items)); }
function saveTxns() { localStorage.setItem('stock_txns', JSON.stringify(txns)); }

let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

function calcStatus(item) {
  if (item.stock <= 0) return {key:'low', label:'소진', cls:'s-low'};
  if (item.stock < item.min) return {key:'low', label:'부족', cls:'s-low'};
  if (item.stock < item.min * 1.3) return {key:'warn', label:'주의', cls:'s-warn'};
  if (item.stock > item.max) return {key:'over', label:'과잉', cls:'s-over'};
  return {key:'good', label:'정상', cls:'s-good'};
}

// ── 미션 3: 소진예상일 계산 ──
function calcExhaustDay(itemId) {
  const item = items.find(i => i.id === itemId);
  if (!item || !item.dailyUse || item.dailyUse <= 0) return {text:'계산불가', cls:'ex-ok'};
  const days = Math.floor(item.stock / item.dailyUse);
  if (days <= 3) return {text:`D-${days}`, cls:'ex-urgent'};
  if (days <= 7) return {text:`${days}일`, cls:'ex-warn'};
  return {text:`${days}일`, cls:'ex-ok'};
}

// ── 미션 1: 긴급 발주 경보 배너 ──
function renderOrderBanner() {
  const urgentItems = items.filter(i => i.stock < i.min);
  const el = document.getElementById('orderBanner');
  if (!urgentItems.length) { el.style.display = 'none'; return; }
  el.style.display = 'flex';
  el.innerHTML = `🚨 <strong>긴급 발주 필요 ${urgentItems.length}건</strong> &nbsp;|&nbsp;
    ${urgentItems.slice(0, 3).map(i => `<span style="background:rgba(255,255,255,.2);border-radius:4px;padding:2px 8px">${i.name} (${i.stock}${i.unit} / 최소 ${i.min}${i.unit})</span>`).join(' ')}
    ${urgentItems.length > 3 ? `<span>외 ${urgentItems.length - 3}건</span>` : ''}`;
}

// ── 미션 2: 차트 렌더링 ──
function renderCharts() {
  const byCat = {};
  items.forEach(item => { byCat[item.cat] = (byCat[item.cat] || 0) + item.stock; });
  const catLabels = Object.keys(byCat);
  const catData = catLabels.map(k => byCat[k]);
  const catColors = catLabels.map(k => CAT_COLORS[k] || '#aaa');

  if (catChart) catChart.destroy();
  catChart = new Chart(document.getElementById('catChart'), {
    type: 'doughnut',
    data: {labels: catLabels, datasets: [{data: catData, backgroundColor: catColors, borderWidth: 2}]},
    options: {plugins: {legend: {position:'right', labels:{font:{size:10},boxWidth:12}}}, maintainAspectRatio: false}
  });

  const statusCount = {정상:0, 주의:0, 부족:0, 과잉:0};
  items.forEach(item => {
    const s = calcStatus(item);
    if (s.key === 'good') statusCount['정상']++;
    else if (s.key === 'warn') statusCount['주의']++;
    else if (s.key === 'low') statusCount['부족']++;
    else statusCount['과잉']++;
  });
  if (statusChart) statusChart.destroy();
  statusChart = new Chart(document.getElementById('statusChart'), {
    type: 'doughnut',
    data: {
      labels: Object.keys(statusCount),
      datasets: [{data: Object.values(statusCount), backgroundColor: ['#059669','#d97706','#dc2626','#0891b2'], borderWidth: 2}]
    },
    options: {plugins: {legend: {position:'right', labels:{font:{size:10},boxWidth:12}}}, maintainAspectRatio: false}
  });
}

function renderKPI() {
  const total = items.length;
  const low = items.filter(i => i.stock < i.min).length;
  const warn = items.filter(i => calcStatus(i).key === 'warn').length;
  const good = items.filter(i => calcStatus(i).key === 'good').length;
  document.getElementById('kpiRow').innerHTML = `
    <div class="kpi k-blue"><div class="kpi-l">총 품목 수</div><div class="kpi-v">${total}</div><div class="kpi-sub">등록 자재</div></div>
    <div class="kpi k-green"><div class="kpi-l">정상 재고</div><div class="kpi-v">${good}</div><div class="kpi-sub">품목</div></div>
    <div class="kpi k-amber"><div class="kpi-l">주의 재고</div><div class="kpi-v">${warn}</div><div class="kpi-sub">발주 검토 필요</div></div>
    <div class="kpi k-red"><div class="kpi-l">긴급 발주</div><div class="kpi-v" style="color:var(--red)">${low}</div><div class="kpi-sub">즉시 발주 필요</div></div>`;
}

function renderStock() {
  const search = document.getElementById('stockSearch').value.toLowerCase();
  const cat = document.getElementById('catFilter').value;
  const statusF = document.getElementById('statusFilter').value;
  let filtered = items.filter(i => {
    const matchText = !search || i.name.toLowerCase().includes(search) || i.code.toLowerCase().includes(search);
    const matchCat = !cat || i.cat === cat;
    const matchStatus = !statusF || calcStatus(i).key === statusF;
    return matchText && matchCat && matchStatus;
  });
  document.getElementById('stockCount').textContent = filtered.length;
  const pct = item => item.max ? Math.min(item.stock / item.max * 100, 100) : 0;
  const fillColor = item => { const s = calcStatus(item); return s.key === 'low' ? 'var(--red)' : s.key === 'warn' ? 'var(--amber)' : s.key === 'over' ? 'var(--blue)' : 'var(--green)'; };
  const minPct = item => item.max ? Math.min(item.min / item.max * 100, 100) : 0;
  const catColor = cat => CAT_COLORS[cat] || '#aaa';
  const ex = item => calcExhaustDay(item.id);
  document.getElementById('stockTable').innerHTML = `
    <thead><tr>
      <th>코드</th><th>자재명</th><th>카테고리</th><th>재고</th><th>재고 현황</th><th>상태</th>
      <th>소진예상일</th><th>거래처</th><th>조작</th>
    </tr></thead>
    <tbody>${filtered.map(item => {
      const s = calcStatus(item);
      const e = ex(item);
      return `<tr>
        <td style="font-family:monospace;font-size:.78rem">${item.code}</td>
        <td style="font-weight:700">${item.name}</td>
        <td><span class="cat-badge" style="background:${catColor(item.cat)}22;color:${catColor(item.cat)}">${item.cat}</span></td>
        <td style="font-weight:700">${item.stock.toLocaleString()} ${item.unit}</td>
        <td style="min-width:100px">
          <div class="stock-bar">
            <div class="stock-fill" style="width:${pct(item)}%;background:${fillColor(item)}"></div>
            <div class="stock-min-marker" style="left:${minPct(item)}%"></div>
          </div>
          <div style="font-size:.65rem;color:var(--mute);margin-top:2px">최소 ${item.min} / 최대 ${item.max}</div>
        </td>
        <td><span class="status-chip ${s.cls}">${s.label}</span></td>
        <td><span class="exhaust-day ${e.cls}">${e.text}</span></td>
        <td style="font-size:.78rem">${item.vendor}</td>
        <td>
          <div class="action-btns">
            <button class="action-btn" style="color:var(--indigo);border-color:var(--indigo)" onclick="openItemModal('${item.id}')">수정</button>
            <button class="action-btn" style="color:var(--green);border-color:var(--green)" onclick="quickIn('${item.id}')">입고+</button>
          </div>
        </td>
      </tr>`;
    }).join('')}</tbody>`;
}

function renderHistory() {
  const from = document.getElementById('histFrom').value;
  const to = document.getElementById('histTo').value;
  const typeF = document.getElementById('txTypeFilter').value;
  let filtered = txns.filter(t => {
    const matchDate = (!from || t.date >= from) && (!to || t.date <= to);
    const matchType = !typeF || t.type === typeF;
    return matchDate && matchType;
  });
  filtered.sort((a, b) => b.date.localeCompare(a.date));
  document.getElementById('histTable').innerHTML = `
    <thead><tr><th>날짜</th><th>구분</th><th>자재명</th><th>수량</th><th>거래처/용도</th><th>담당자</th><th>비고</th></tr></thead>
    <tbody>${filtered.map(t => {
      const item = items.find(i => i.id === t.itemId);
      return `<tr>
        <td>${t.date}</td>
        <td><span class="${t.type === 'in' ? 'type-in' : 'type-out'}">${t.type === 'in' ? '▲ 입고' : '▼ 출고'}</span></td>
        <td>${item ? item.name : t.itemId}</td>
        <td style="font-weight:700">${t.qty.toLocaleString()} ${item ? item.unit : ''}</td>
        <td>${t.vendor}</td><td>${t.worker}</td><td style="color:var(--mute)">${t.note}</td>
      </tr>`;
    }).join('')}</tbody>`;
}

function renderAlerts() {
  const lowItems = items.filter(i => calcStatus(i).key !== 'good');
  document.getElementById('alertBadge').textContent = lowItems.length;
  document.getElementById('alertBadge').style.display = lowItems.length ? '' : 'none';
  const iconMap = {low:'🔴', warn:'🟡', over:'🔵'};
  document.getElementById('alertList').innerHTML = lowItems.length
    ? lowItems.map(i => {
        const s = calcStatus(i);
        const e = calcExhaustDay(i.id);
        return `<div class="alert-item">
          <span class="alert-icon">${iconMap[s.key] || '⚪'}</span>
          <div>
            <div class="alert-name">${i.name} <span class="status-chip ${s.cls}" style="font-size:.68rem">${s.label}</span></div>
            <div class="alert-detail">현재 ${i.stock}${i.unit} / 최소 ${i.min}${i.unit} | 소진예상 ${e.text} | 리드타임 ${i.lead}일</div>
          </div>
        </div>`;
      }).join('')
    : '<div style="color:var(--mute);font-size:.85rem;text-align:center;padding:20px">모든 재고가 정상입니다.</div>';
}

function switchTab(tab, el) {
  activeTab = tab;
  ['stock','history','alert'].forEach(t => {
    const el2 = document.getElementById(`tab-${t}`);
    if (el2) el2.style.display = t === tab ? (t === 'alert' ? 'flex' : 'block') : 'none';
  });
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  if (tab === 'history') renderHistory();
  if (tab === 'alert') renderAlerts();
}

function openTxModal() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('t-date').value = today;
  const sel = document.getElementById('t-item');
  sel.innerHTML = items.map(i => `<option value="${i.id}">${i.name} (${i.stock}${i.unit})</option>`).join('');
  updateTxUnit();
  document.getElementById('txModal').classList.add('show');
}
function closeTxModal() { document.getElementById('txModal').classList.remove('show'); }
function updateTxUnit() {
  const itemId = document.getElementById('t-item').value;
  const item = items.find(i => i.id === itemId);
  document.getElementById('t-unit').value = item ? item.unit : '';
}

function saveTx() {
  const itemId = document.getElementById('t-item').value;
  const type = document.getElementById('t-type').value;
  const qty = parseFloat(document.getElementById('t-qty').value);
  if (!qty || qty <= 0) { showToast('수량을 입력해 주세요.'); return; }
  const item = items.find(i => i.id === itemId);
  if (!item) return;
  if (type === 'out' && item.stock < qty) { showToast('재고 부족으로 출고할 수 없습니다.'); return; }
  const tx = {
    id: 'TX' + Date.now(),
    date: document.getElementById('t-date').value,
    type, itemId, qty,
    vendor: document.getElementById('t-vendor').value,
    worker: document.getElementById('t-worker').value,
    note: document.getElementById('t-note').value,
  };
  if (type === 'in') item.stock += qty;
  else item.stock -= qty;
  txns.push(tx);
  saveItems(); saveTxns();
  closeTxModal();
  renderAll();
  showToast(`${type === 'in' ? '입고' : '출고'} 등록 완료 (${qty}${item.unit})`);
}

function quickIn(itemId) {
  const item = items.find(i => i.id === itemId);
  if (!item) return;
  const qty = parseFloat(prompt(`${item.name} 입고 수량 입력 (단위: ${item.unit})`));
  if (!qty || qty <= 0) return;
  item.stock += qty;
  txns.push({id:'TX'+Date.now(), date:new Date().toISOString().split('T')[0], type:'in', itemId, qty, vendor:'', worker:'', note:'빠른 입고'});
  saveItems(); saveTxns();
  renderAll();
  showToast(`빠른 입고 처리: ${qty}${item.unit}`);
}

function openItemModal(itemId) {
  editItemId = itemId || null;
  const el = document.getElementById('itemModal');
  const delBtn = document.getElementById('itemDelBtn');
  if (itemId) {
    const item = items.find(i => i.id === itemId);
    document.getElementById('itemModalTitle').textContent = '자재 수정';
    document.getElementById('i-code').value = item.code;
    document.getElementById('i-cat').value = item.cat;
    document.getElementById('i-name').value = item.name;
    document.getElementById('i-unit').value = item.unit;
    document.getElementById('i-stock').value = item.stock;
    document.getElementById('i-min').value = item.min;
    document.getElementById('i-max').value = item.max;
    document.getElementById('i-vendor').value = item.vendor;
    document.getElementById('i-lead').value = item.lead;
    delBtn.style.display = '';
  } else {
    document.getElementById('itemModalTitle').textContent = '자재 등록';
    ['i-code','i-name','i-unit','i-stock','i-min','i-max','i-vendor','i-lead'].forEach(id => document.getElementById(id).value = '');
    delBtn.style.display = 'none';
  }
  el.classList.add('show');
}
function closeItemModal() { document.getElementById('itemModal').classList.remove('show'); }

function saveItem() {
  const name = document.getElementById('i-name').value.trim();
  if (!name) { showToast('자재명을 입력해 주세요.'); return; }
  const data = {
    code: document.getElementById('i-code').value,
    cat: document.getElementById('i-cat').value,
    name,
    unit: document.getElementById('i-unit').value || '개',
    stock: parseFloat(document.getElementById('i-stock').value) || 0,
    min: parseFloat(document.getElementById('i-min').value) || 0,
    max: parseFloat(document.getElementById('i-max').value) || 9999,
    vendor: document.getElementById('i-vendor').value,
    lead: parseInt(document.getElementById('i-lead').value) || 7,
    dailyUse: 10,
  };
  if (editItemId) {
    const idx = items.findIndex(i => i.id === editItemId);
    items[idx] = {...items[idx], ...data};
    showToast('자재 정보가 수정되었습니다.');
  } else {
    data.id = 'MAT' + Date.now();
    items.push(data);
    showToast('자재가 등록되었습니다.');
  }
  saveItems(); closeItemModal(); renderAll();
}

function deleteItem() {
  if (!confirm('자재를 삭제하시겠습니까?')) return;
  items = items.filter(i => i.id !== editItemId);
  saveItems(); closeItemModal(); renderAll();
  showToast('자재가 삭제되었습니다.');
}

function exportCSV() {
  let csv = '코드,자재명,카테고리,재고,단위,최소재고,최대재고,상태,거래처\n';
  items.forEach(i => {
    const s = calcStatus(i);
    csv += `"${i.code}","${i.name}","${i.cat}",${i.stock},"${i.unit}",${i.min},${i.max},"${s.label}","${i.vendor}"\n`;
  });
  const blob = new Blob(['﻿' + csv], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `재고현황_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  showToast('Excel 파일이 저장되었습니다.');
}

document.getElementById('t-item').addEventListener('change', updateTxUnit);

/* ── 보고서 출력 ── */
function openReport() {
  const lowItems  = items.filter(i => calcStatus(i).key === 'low');
  const warnItems = items.filter(i => calcStatus(i).key === 'warn');
  const goodItems = items.filter(i => calcStatus(i).key === 'good');
  const now = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
  document.getElementById('rptPage').innerHTML = `
    <div class="rpt-company"><strong>PCB Manufacturing Co., Ltd.</strong><br>자재관리부</div>
    <div class="rpt-doc-title"><h1>원 자 재 재 고 보 고 서</h1><p>작성일: ${now}</p></div>
    <table class="rpt-info-box">
      <tr><td class="rpt-label">작성일</td><td>${now}</td><td class="rpt-label">작성부서</td><td>자재관리부</td></tr>
      <tr><td class="rpt-label">작성자</td><td></td><td class="rpt-label">결재</td><td></td></tr>
    </table>
    <div class="rpt-sec">
      <div class="rpt-sec-title">■ 1. 재고 현황 KPI</div>
      <div class="rpt-kpi-grid">
        <div class="rpt-kpi-card"><div class="rk-label">전체 품목</div><div class="rk-val">${items.length}</div><div class="rk-unit">품목</div></div>
        <div class="rpt-kpi-card"><div class="rk-label">부족 (긴급 발주)</div><div class="rk-val rpt-bad">${lowItems.length}</div><div class="rk-unit">품목</div></div>
        <div class="rpt-kpi-card"><div class="rk-label">주의</div><div class="rk-val rpt-warn">${warnItems.length}</div><div class="rk-unit">품목</div></div>
        <div class="rpt-kpi-card"><div class="rk-label">정상</div><div class="rk-val rpt-good">${goodItems.length}</div><div class="rk-unit">품목</div></div>
      </div>
    </div>
    ${lowItems.length ? `
    <div class="rpt-sec">
      <div class="rpt-sec-title">■ 2. 긴급 발주 필요 품목</div>
      <table class="rpt-table">
        <thead><tr><th>자재코드</th><th>카테고리</th><th>자재명</th><th>현재고</th><th>최소재고</th><th>단위</th><th>주거래처</th><th>리드타임</th></tr></thead>
        <tbody>
          ${lowItems.map(i => `<tr>
            <td>${i.code}</td><td>${i.cat}</td><td style="text-align:left">${i.name}</td>
            <td class="num rpt-bad">${i.stock.toLocaleString()}</td>
            <td class="num">${i.min.toLocaleString()}</td>
            <td>${i.unit}</td><td>${i.vendor}</td><td>${i.lead}일</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : ''}
    <div class="rpt-sec">
      <div class="rpt-sec-title">■ ${lowItems.length ? '3' : '2'}. 전체 재고 현황</div>
      <table class="rpt-table">
        <thead><tr><th>자재코드</th><th>카테고리</th><th>자재명</th><th>현재고</th><th>최소</th><th>최대</th><th>단위</th><th>상태</th><th>소진예상</th></tr></thead>
        <tbody>
          ${items.map(i => { const s = calcStatus(i); const ex = calcExhaustDay(i.id); return `<tr>
            <td>${i.code}</td><td>${i.cat}</td><td style="text-align:left">${i.name}</td>
            <td class="num">${i.stock.toLocaleString()}</td>
            <td class="num">${i.min.toLocaleString()}</td>
            <td class="num">${i.max.toLocaleString()}</td>
            <td>${i.unit}</td>
            <td class="${s.key === 'low' ? 'rpt-bad' : s.key === 'warn' ? 'rpt-warn' : s.key === 'good' ? 'rpt-good' : ''}">${s.label}</td>
            <td class="${ex.cls === 'ex-urgent' ? 'rpt-bad' : ex.cls === 'ex-warn' ? 'rpt-warn' : ''}">${ex.text}</td>
          </tr>`; }).join('')}
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
    <div class="rpt-footer">본 보고서는 PCB Manufacturing 자재관리 시스템에서 자동 생성되었습니다.</div>
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

function renderAll() {
  renderOrderBanner();
  renderKPI();
  renderCharts();
  renderStock();
  renderAlerts();
}

function init() {
  items = getItems();
  txns = getTxns();
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  document.getElementById('histFrom').value = weekAgo;
  document.getElementById('histTo').value = today;
  renderAll();
}

init();
