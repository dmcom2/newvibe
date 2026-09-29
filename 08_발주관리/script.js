const today=new Date().toISOString().slice(0,10);

const MATERIALS=['동박적층판(CCL)','드릴비트 세트','솔더마스크 잉크','드라이필름','금도금액','주석도금액','현상액','박리액','기판 절단날','테스트 프로브'];
const UNITS=['장','세트','kg','L','Roll','개'];
const STATUS_META={
  ordered:{label:'발주완료',color:'#2563eb',bg:'#dbeafe'},
  partial:{label:'부분입고',color:'#d97706',bg:'#fef3c7'},
  received:{label:'입고완료',color:'#059669',bg:'#dcfce7'},
  cancelled:{label:'취소',color:'#64748b',bg:'#f1f5f9'},
};

let pos=JSON.parse(localStorage.getItem('pcbPO')||'null')||genSample();
let editPoId=null, receivePoId=null, nextId=Date.now(), curTab='list';

function genSample(){
  const vendors=['(주)일신소재','(주)동양CCL','코리아동박(주)','(주)한국솔더마스크','(주)대흥드릴'];
  const arr=[];
  for(let i=0;i<15;i++){
    const dOff=i*3-20;
    const od=new Date(new Date(today).setDate(new Date(today).getDate()+dOff)).toISOString().slice(0,10);
    const due=new Date(new Date(od).setDate(new Date(od).getDate()+7)).toISOString().slice(0,10);
    const items=[];
    const cnt=1+Math.floor(Math.random()*3);
    for(let j=0;j<cnt;j++){
      const qty=10+Math.floor(Math.random()*90);
      const price=5000+Math.floor(Math.random()*50000/1000)*1000;
      const recv=i<8?qty:Math.floor(qty*0.6);
      items.push({name:MATERIALS[(i+j)%10],spec:`규격-${(j+1)*100}`,unit:UNITS[j%6],qty,price,received:recv});
    }
    const st=i<5?'received':i<8?'partial':'ordered';
    arr.push({id:Date.now()+i,
      no:`PO-${today.slice(0,4)}${today.slice(5,7)}-${String(i+1).padStart(3,'0')}`,
      date:od,dueDate:due,
      vendor:vendors[i%5],payment:'월말 30일 결제',
      manager:'김구매',note:'',status:st,items,
      receiveDate:st==='received'?due:'',receiveWorker:'박창고',
    });
  }
  return arr;
}
function save(){ localStorage.setItem('pcbPO', JSON.stringify(pos)); }

function calcTotal(items){ return items.reduce((s,i)=>s+i.qty*i.price,0); }
function calcReceived(items){ return items.reduce((s,i)=>s+i.received,0); }
function calcOrdered(items){ return items.reduce((s,i)=>s+i.qty,0); }

/* 토스트 */
let _toastTimer=null;
function showToast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg;t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer=setTimeout(()=>t.classList.remove('show'),2800);
}

/* 미션1: 납기 초과 발주 경보 배너 */
function renderOverdueBanner(){
  const el=document.getElementById('overdueBanner');
  const overdue=pos.filter(p=>['ordered','partial'].includes(p.status)&&p.dueDate<today);
  if(!overdue.length){el.style.display='none';return;}
  el.style.display='flex';
  el.innerHTML='🚨 납기 초과 '+overdue.length+'건: '+
    overdue.map(p=>`<span style="background:rgba(255,255,255,.2);padding:2px 8px;border-radius:4px">${p.no} ${p.vendor.replace('(주)','').replace('코리아','').slice(0,4)} (${p.dueDate})</span>`).join(' ');
}

function renderKPI(){
  const active=pos.filter(p=>['ordered','partial'].includes(p.status)).length;
  const rec=pos.filter(p=>p.status==='received').length;
  const overdue=pos.filter(p=>['ordered','partial'].includes(p.status)&&p.dueDate<today).length;
  const totalAmt=pos.filter(p=>p.status!=='cancelled').reduce((s,p)=>s+calcTotal(p.items),0);
  const pending=pos.filter(p=>['ordered','partial'].includes(p.status)).reduce((s,p)=>s+calcTotal(p.items),0);
  document.getElementById('kpiRow').innerHTML=`
    <div class="kpi" style="border-top-color:var(--orange)"><div class="kpi-l">발주 진행중</div><div class="kpi-v" style="color:var(--orange)">${active}</div><div class="kpi-sub">건</div></div>
    <div class="kpi" style="border-top-color:var(--green)"><div class="kpi-l">입고 완료</div><div class="kpi-v" style="color:var(--green)">${rec}</div><div class="kpi-sub">건</div></div>
    <div class="kpi" style="border-top-color:var(--red)"><div class="kpi-l">납기 지연</div><div class="kpi-v" style="color:var(--red)">${overdue}</div><div class="kpi-sub">건</div></div>
    <div class="kpi" style="border-top-color:var(--blue)"><div class="kpi-l">이월 발주금액</div><div class="kpi-v" style="color:var(--blue);font-size:1rem">${(pending/1e6).toFixed(1)}M</div><div class="kpi-sub">원</div></div>
    <div class="kpi" style="border-top-color:var(--sub)"><div class="kpi-l">누적 발주금액</div><div class="kpi-v" style="color:var(--sub);font-size:1rem">${(totalAmt/1e6).toFixed(1)}M</div><div class="kpi-sub">원</div></div>`;
}

function switchTab(t){
  curTab=t;
  document.getElementById('listView').style.display=t==='list'?'block':'none';
  document.getElementById('vendorView').style.display=t==='vendor'?'block':'none';
  document.getElementById('t-list').classList.toggle('active',t==='list');
  document.getElementById('t-vendor').classList.toggle('active',t==='vendor');
  render();
}

function getFiltered(){
  const q=document.getElementById('searchQ').value.toLowerCase();
  const s=document.getElementById('statusFilter').value;
  const m=document.getElementById('monthFilter').value;
  return pos.filter(p=>{
    const mq=!q||p.no.toLowerCase().includes(q)||p.vendor.includes(q)||p.items.some(i=>i.name.includes(q));
    const ms=!s||p.status===s;
    const mm=!m||p.date.startsWith(m);
    return mq&&ms&&mm;
  }).sort((a,b)=>b.date.localeCompare(a.date));
}

function render(){
  renderKPI();
  renderOverdueBanner();
  if(curTab==='list') renderList();
  else renderVendor();
}

function renderList(){
  const list=getFiltered();
  document.getElementById('listView').innerHTML=`
    <div class="po-table-wrap">
      <table class="po-table">
        <thead><tr>
          <th>발주번호</th><th>발주일</th><th>공급업체</th><th>품목</th>
          <th>발주금액</th><th>납기요청</th><th>입고 진행</th><th>상태</th><th>액션</th>
        </tr></thead>
        <tbody>
          ${list.map(p=>{
            const sm=STATUS_META[p.status]||STATUS_META.ordered;
            const tot=calcTotal(p.items);
            const recvQty=calcReceived(p.items);
            const ordQty=calcOrdered(p.items);
            const pct=ordQty?Math.round(recvQty/ordQty*100):0;
            const isLate=['ordered','partial'].includes(p.status)&&p.dueDate<today;
            return `<tr onclick="openPoModal('${p.id}')">
              <td style="font-family:monospace;font-size:.75rem">${p.no}</td>
              <td>${p.date}</td>
              <td>${p.vendor}</td>
              <td style="font-size:.75rem;color:var(--sub)">${p.items.map(i=>i.name).join(', ')}</td>
              <td style="font-weight:700">₩${tot.toLocaleString()}</td>
              <td style="color:${isLate?'var(--red)':''}; font-weight:${isLate?700:400}">${p.dueDate}${isLate?' ⚠':''}</td>
              <td><div class="progress-cell">
                <div class="mini-bar"><div class="mini-fill" style="width:${pct}%;background:${pct>=100?'var(--green)':'var(--orange)'}"></div></div>
                <span style="font-size:.72rem;font-weight:700;color:${pct>=100?'var(--green)':'var(--orange)'}">${pct}%</span>
              </div></td>
              <td><span class="status-chip" style="background:${sm.bg};color:${sm.color}">${sm.label}</span></td>
              <td onclick="event.stopPropagation()">
                ${['ordered','partial'].includes(p.status)?`<button class="btn btn-green" style="font-size:.72rem;padding:4px 8px" onclick="openReceive('${p.id}')">입고처리</button>`:''}
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

/* 미션2+3: 업체별 발주금액 바 차트 + 이행률 등급 */
function renderVendor(){
  const vendors=[...new Set(pos.map(p=>p.vendor))].sort();
  const COLORS=['#ea580c','#2563eb','#059669','#7c3aed','#d97706'];

  const vendorAmts=vendors.map(v=>({
    vendor:v,
    total:pos.filter(p=>p.vendor===v&&p.status!=='cancelled').reduce((s,p)=>s+calcTotal(p.items),0),
  }));
  const maxAmt=Math.max(...vendorAmts.map(x=>x.total),1);
  const chartHtml=vendorAmts.map((va,i)=>`
    <div class="vc-row">
      <span class="vc-label">${va.vendor}</span>
      <div class="vc-bar"><div class="vc-fill" style="width:${va.total/maxAmt*100}%;background:${COLORS[i%5]}"></div></div>
      <span class="vc-amt">₩${(va.total/1e6).toFixed(1)}M</span>
    </div>`).join('');

  const rateClass=r=>r>=90?'rate-a':r>=70?'rate-b':'rate-c';
  const rateLabel=r=>r>=90?'A등급':r>=70?'B등급':'C등급';

  document.getElementById('vendorView').innerHTML=`
    <div class="vendor-chart-wrap">
      <div class="vendor-chart-title">📊 업체별 발주금액</div>
      ${chartHtml}
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px">
      ${vendors.map((v,i)=>{
        const vPos=pos.filter(p=>p.vendor===v);
        const total=vPos.reduce((s,p)=>s+calcTotal(p.items),0);
        const rec=vPos.filter(p=>p.status==='received').length;
        const active=vPos.filter(p=>['ordered','partial'].includes(p.status)).length;
        const overdue=vPos.filter(p=>['ordered','partial'].includes(p.status)&&p.dueDate<today).length;
        const rate=vPos.length?Math.round(rec/vPos.length*100):0;
        return `<div style="background:var(--surface);border-radius:var(--rad);padding:16px;box-shadow:var(--shadow);border-top:3px solid ${COLORS[i%5]}">
          <div style="font-size:.9rem;font-weight:800;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center">
            <span>${v}</span>
            <span class="rate-badge ${rateClass(rate)}">${rateLabel(rate)}</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:.78rem">
            <div><div style="color:var(--mute);font-size:.7rem">총 발주건수</div><div style="font-weight:700">${vPos.length}건</div></div>
            <div><div style="color:var(--mute);font-size:.7rem">발주 금액</div><div style="font-weight:700">₩${(total/1e6).toFixed(1)}M</div></div>
            <div><div style="color:var(--mute);font-size:.7rem">진행중</div><div style="font-weight:700;color:var(--orange)">${active}건</div></div>
            <div><div style="color:var(--mute);font-size:.7rem">입고이행률</div><div style="font-weight:700;color:${rate>=80?'var(--green)':'var(--amber)'}">${rate}%</div></div>
          </div>
          ${overdue>0?`<div style="margin-top:8px;font-size:.72rem;color:var(--red);font-weight:700">⚠ 납기초과 ${overdue}건</div>`:''}
        </div>`;
      }).join('')}
    </div>`;
}

/* 발주 모달 */
let itemCount=0;
function addItemRow(item=null){
  itemCount++;
  const idx=itemCount;
  const row=document.createElement('tr');
  row.id=`item-row-${idx}`;
  row.innerHTML=`
    <td><input id="i-name-${idx}" list="materialList" value="${item?.name||''}" oninput="calcRowTotal(${idx})"></td>
    <td><input id="i-spec-${idx}" value="${item?.spec||''}"></td>
    <td><select id="i-unit-${idx}">${UNITS.map(u=>`<option ${u===(item?.unit||'장')?'selected':''}>${u}</option>`).join('')}</select></td>
    <td><input type="number" id="i-qty-${idx}" value="${item?.qty||''}" oninput="calcRowTotal(${idx})"></td>
    <td><input type="number" id="i-price-${idx}" value="${item?.price||''}" oninput="calcRowTotal(${idx})"></td>
    <td id="i-total-${idx}" style="text-align:right;font-weight:700">₩0</td>
    <td><button class="btn btn-red" style="padding:3px 7px;font-size:.72rem" onclick="document.getElementById('item-row-${idx}').remove();updateTotal()">✕</button></td>`;
  document.getElementById('itemRows').appendChild(row);
  if(item) calcRowTotal(idx);
}
function calcRowTotal(idx){
  const q=parseFloat(document.getElementById(`i-qty-${idx}`)?.value)||0;
  const p=parseFloat(document.getElementById(`i-price-${idx}`)?.value)||0;
  const t=q*p;
  const el=document.getElementById(`i-total-${idx}`);
  if(el) el.textContent=`₩${t.toLocaleString()}`;
  updateTotal();
}
function updateTotal(){
  let tot=0;
  document.querySelectorAll('[id^="i-qty-"]').forEach(el=>{
    const idx=el.id.split('-').pop();
    const q=parseFloat(el.value)||0;
    const p=parseFloat(document.getElementById(`i-price-${idx}`)?.value)||0;
    tot+=q*p;
  });
  document.getElementById('totalAmount').textContent=`₩${tot.toLocaleString()}`;
}

function openPoModal(id=null){
  editPoId=id;
  const p=id?pos.find(x=>String(x.id)===String(id)):null;
  document.getElementById('modalTitle').textContent=id?'발주서 수정':'발주서 작성';
  document.getElementById('delPoBtn').style.display=id?'block':'none';
  const newNo=`PO-${today.slice(0,4)}${today.slice(5,7)}-${String(pos.length+1).padStart(3,'0')}`;
  document.getElementById('p-no').value=p?.no||newNo;
  document.getElementById('p-date').value=p?.date||today;
  document.getElementById('p-vendor').value=p?.vendor||'';
  document.getElementById('p-dueDate').value=p?.dueDate||'';
  document.getElementById('p-payment').value=p?.payment||'월말 30일 결제';
  document.getElementById('p-manager').value=p?.manager||'';
  document.getElementById('p-note').value=p?.note||'';
  document.getElementById('itemRows').innerHTML='';
  itemCount=0;
  if(p) p.items.forEach(i=>addItemRow(i));
  else addItemRow();
  document.getElementById('poModal').classList.add('show');
}
function closePoModal(){document.getElementById('poModal').classList.remove('show');editPoId=null;}

function getItemsFromForm(){
  const items=[];
  document.querySelectorAll('[id^="i-name-"]').forEach(el=>{
    const idx=el.id.split('-').pop();
    const name=el.value.trim();
    if(!name) return;
    const p=pos.find(x=>String(x.id)===String(editPoId));
    const existItem=p?.items.find(i=>i.name===name);
    items.push({
      name,
      spec:document.getElementById(`i-spec-${idx}`).value,
      unit:document.getElementById(`i-unit-${idx}`).value,
      qty:parseFloat(document.getElementById(`i-qty-${idx}`).value)||0,
      price:parseFloat(document.getElementById(`i-price-${idx}`).value)||0,
      received:existItem?.received||0,
    });
  });
  return items;
}

function savePO(){
  const vendor=document.getElementById('p-vendor').value.trim();
  if(!vendor){showToast('공급업체를 입력하세요');return;}
  const items=getItemsFromForm();
  if(!items.length){showToast('품목을 입력하세요');return;}
  const status=editPoId?pos.find(x=>String(x.id)===String(editPoId))?.status||'ordered':'ordered';
  const rec={id:editPoId||nextId++,
    no:document.getElementById('p-no').value,
    date:document.getElementById('p-date').value,
    vendor,
    dueDate:document.getElementById('p-dueDate').value,
    payment:document.getElementById('p-payment').value,
    manager:document.getElementById('p-manager').value,
    note:document.getElementById('p-note').value,
    status,items,receiveDate:'',receiveWorker:'',
  };
  if(editPoId){const i=pos.findIndex(x=>String(x.id)===String(editPoId));if(i>=0)pos[i]=rec;}
  else pos.push(rec);
  save();closePoModal();render();
  showToast('발주서가 저장되었습니다.');
}
function deletePO(){
  if(!confirm('삭제하시겠습니까?'))return;
  pos=pos.filter(x=>String(x.id)!==String(editPoId));
  save();closePoModal();render();
}

/* 입고 처리 */
function openReceive(id){
  receivePoId=id;
  const p=pos.find(x=>String(x.id)===String(id));
  if(!p) return;
  document.getElementById('receiveInfo').textContent=`발주번호: ${p.no} | 공급업체: ${p.vendor}`;
  document.getElementById('r-date').value=today;
  document.getElementById('r-worker').value='박창고';
  document.getElementById('receiveRows').innerHTML=p.items.map((item,idx)=>`
    <tr>
      <td>${item.name}</td>
      <td style="text-align:right">${item.qty.toLocaleString()} ${item.unit}</td>
      <td style="text-align:right">${item.received.toLocaleString()} ${item.unit}</td>
      <td><input type="number" id="r-qty-${idx}" value="${Math.max(0,item.qty-item.received)}" max="${item.qty-item.received}"></td>
    </tr>`).join('');
  document.getElementById('receiveModal').classList.add('show');
}
function closeReceive(){document.getElementById('receiveModal').classList.remove('show');receivePoId=null;}
function saveReceive(){
  const p=pos.find(x=>String(x.id)===String(receivePoId));
  if(!p) return;
  p.items.forEach((item,idx)=>{
    const add=parseInt(document.getElementById(`r-qty-${idx}`)?.value)||0;
    item.received=Math.min(item.qty, item.received+add);
  });
  const allDone=p.items.every(i=>i.received>=i.qty);
  p.status=allDone?'received':'partial';
  if(allDone){p.receiveDate=document.getElementById('r-date').value;p.receiveWorker=document.getElementById('r-worker').value;}
  save();closeReceive();render();
  showToast(allDone?'입고 완료 처리되었습니다.':'부분 입고 처리되었습니다.');
}

function printPO(){
  const p=editPoId?pos.find(x=>String(x.id)===String(editPoId)):null;
  if(!p){showToast('저장 후 출력하세요');return;}
  const tot=calcTotal(p.items);
  document.getElementById('printArea').innerHTML=`
    <div class="po-print-title"><h2>발 주 서</h2><p>PCB Manufacturing Co., Ltd.</p></div>
    <div class="po-meta-grid">
      <div>
        <div class="pm-row"><div class="pm-label">발주번호</div><div class="pm-value">${p.no}</div></div>
        <div class="pm-row"><div class="pm-label">발주일</div><div class="pm-value">${p.date}</div></div>
        <div class="pm-row"><div class="pm-label">공급업체</div><div class="pm-value">${p.vendor}</div></div>
      </div>
      <div>
        <div class="pm-row"><div class="pm-label">납기 요청일</div><div class="pm-value">${p.dueDate}</div></div>
        <div class="pm-row"><div class="pm-label">결제 조건</div><div class="pm-value">${p.payment}</div></div>
        <div class="pm-row"><div class="pm-label">담당자</div><div class="pm-value">${p.manager}</div></div>
      </div>
    </div>
    <table class="po-items-table">
      <thead><tr><th>No</th><th>자재명</th><th>규격</th><th>단위</th><th>수량</th><th>단가</th><th>금액</th></tr></thead>
      <tbody>
        ${p.items.map((i,n)=>`<tr><td>${n+1}</td><td style="text-align:left">${i.name}</td><td>${i.spec}</td><td>${i.unit}</td><td>${i.qty.toLocaleString()}</td><td>₩${i.price.toLocaleString()}</td><td>₩${(i.qty*i.price).toLocaleString()}</td></tr>`).join('')}
        <tr class="total-row"><td colspan="6" style="text-align:right">합 계</td><td>₩${tot.toLocaleString()}</td></tr>
      </tbody>
    </table>
    ${p.note?`<div style="border:1px solid var(--border);padding:8px;font-size:.8rem;margin-top:12px"><b>비고:</b> ${p.note}</div>`:''}
    <div style="display:flex;justify-content:flex-end;gap:50px;margin-top:24px;font-size:.8rem">
      <div style="text-align:center;border-top:1px solid;padding-top:6px;min-width:80px">구매담당<br><br>${p.manager}</div>
      <div style="text-align:center;border-top:1px solid;padding-top:6px;min-width:80px">팀 장<br><br>&nbsp;</div>
      <div style="text-align:center;border-top:1px solid;padding-top:6px;min-width:80px">임 원<br><br>&nbsp;</div>
    </div>`;
  window.print();
}

function exportCSV(){
  const rows=['발주번호,발주일,공급업체,납기요청일,상태,자재목록,총금액,담당자'];
  pos.forEach(p=>{
    const items=p.items.map(i=>i.name).join('/');
    rows.push(`${p.no},${p.date},${p.vendor},${p.dueDate},${STATUS_META[p.status]?.label},${items},${calcTotal(p.items)},${p.manager}`);
  });
  const blob=new Blob(['﻿'+rows.join('\n')],{type:'text/csv;charset=utf-8;'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='발주현황.csv';a.click();
}

function openReport(){
  const todayStr=new Date().toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric'});
  const orderedCnt=pos.filter(p=>p.status==='ordered'||p.status==='partial').length;
  const receivedCnt=pos.filter(p=>p.status==='received').length;
  const overdueCnt=pos.filter(p=>p.status!=='received'&&p.status!=='cancelled'&&p.dueDate<today).length;
  const pendingAmt=pos.filter(p=>p.status!=='received'&&p.status!=='cancelled').reduce((s,p)=>s+calcTotal(p.items),0);
  const rows=pos.map(p=>{
    const sm=STATUS_META[p.status]||{label:p.status,color:'#888'};
    const overdue=p.status!=='received'&&p.status!=='cancelled'&&p.dueDate<today;
    const matList=p.items.map(i=>i.name).join(', ');
    return `<tr><td style="text-align:left;font-family:monospace;font-size:8pt">${p.no}</td><td>${p.date}</td><td style="text-align:left">${p.vendor}</td><td class="${overdue?'rpt-bad':''}">${p.dueDate}</td><td style="text-align:left;font-size:7.5pt">${matList}</td><td class="num">₩${calcTotal(p.items).toLocaleString()}</td><td>${p.manager}</td><td><span style="color:${sm.color};font-weight:700">${sm.label}</span></td></tr>`;
  }).join('');
  document.getElementById('rptPage').innerHTML=`
    <div class="rpt-company"><strong>(주)PCB 제조</strong> | 구매관리<br>출력일: ${todayStr}</div>
    <div class="rpt-doc-title"><h1>발주 현황 보고서</h1><p>발주 전체 현황 및 입고 현황 분석</p></div>
    <div class="rpt-kpi-grid">
      <div class="rpt-kpi-card"><div class="rk-label">발주 진행중</div><div class="rk-val" style="color:#2563eb">${orderedCnt}</div><div class="rk-unit">건</div></div>
      <div class="rpt-kpi-card"><div class="rk-label">입고 완료</div><div class="rk-val" style="color:#059669">${receivedCnt}</div><div class="rk-unit">건</div></div>
      <div class="rpt-kpi-card"><div class="rk-label">납기 지연</div><div class="rk-val" style="color:#dc2626">${overdueCnt}</div><div class="rk-unit">건</div></div>
      <div class="rpt-kpi-card"><div class="rk-label">미납 잔액</div><div class="rk-val" style="color:#d97706;font-size:10pt">${Math.round(pendingAmt/10000).toLocaleString()}</div><div class="rk-unit">만원</div></div>
    </div>
    <div class="rpt-sec"><div class="rpt-sec-title">■ 발주 목록</div>
      <table class="rpt-table"><thead><tr><th>발주번호</th><th>발주일</th><th>공급업체</th><th>납기요청일</th><th>자재목록</th><th>총금액</th><th>담당자</th><th>상태</th></tr></thead><tbody>${rows}</tbody></table>
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
    closePoModal();
  }
});

render();
