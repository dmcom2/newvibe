// 제품 원가 계산기 앱 스크립트
const PROCESS_ITEMS=[
  {id:'drill',name:'드릴링',base:120,perLayer:20},
  {id:'etch',name:'에칭',base:80,perLayer:30},
  {id:'plate',name:'도금',base:150,perLayer:50},
  {id:'mask',name:'솔더마스크',base:60,perLayer:0},
  {id:'silk',name:'실크인쇄',base:30,perLayer:0},
  {id:'test',name:'전기검사',base:40,perLayer:0},
  {id:'cut',name:'외형가공',base:50,perLayer:0},
  {id:'final',name:'최종검사',base:30,perLayer:0},
];
const MAT_DEFAULTS=[
  {name:'동박적층판(CCL)',qty:1,unit:'장',price:3800},
  {name:'드라이필름',qty:1,unit:'Roll/매',price:250},
  {name:'솔더마스크잉크',qty:10,unit:'g',price:18},
  {name:'드릴비트(소모)',qty:0.2,unit:'개',price:800},
];
const COST_COLORS=['#2563eb','#059669','#d97706','#be185d'];
let matRows=[], saved=JSON.parse(localStorage.getItem('pcbCostSaved')||'[]');
let matCounter=0;

function showToast(msg){
  const t=document.getElementById('toast');
  clearTimeout(t._tid);
  t.textContent=msg;
  t.classList.add('show');
  t._tid=setTimeout(()=>t.classList.remove('show'),2800);
}

function initMaterials(){
  MAT_DEFAULTS.forEach(m=>addMaterial(m));
}

function addMaterial(preset=null){
  matCounter++;
  const id=matCounter;
  const row={id,name:preset?.name||'',qty:preset?.qty||1,unit:preset?.unit||'개',price:preset?.price||0};
  matRows.push(row);
  renderMaterialRows();
}

function renderMaterialRows(){
  document.getElementById('materialRows').innerHTML=matRows.map(r=>`
    <div class="material-row" id="mr-${r.id}">
      <input value="${r.name}" oninput="updateMat(${r.id},'name',this.value)" placeholder="재료명">
      <input type="number" value="${r.qty}" oninput="updateMat(${r.id},'qty',this.value)" min="0" step="0.01">
      <input type="number" value="${r.price}" oninput="updateMat(${r.id},'price',this.value)" min="0">
      <span style="font-size:.75rem;font-weight:700;color:var(--blue);text-align:right">₩${Math.round(r.qty*r.price).toLocaleString()}</span>
      <button class="del-btn" onclick="delMat(${r.id})">✕</button>
    </div>`).join('');
  calc();
}

function updateMat(id,field,val){
  const row=matRows.find(r=>r.id===id);
  if(row){
    row[field]=field==='name'?val:parseFloat(val)||0;
    const el=document.querySelector(`#mr-${id} span`);
    if(el) el.textContent=`₩${Math.round(row.qty*row.price).toLocaleString()}`;
  }
  calc();
}
function delMat(id){matRows=matRows.filter(r=>r.id!==id);renderMaterialRows();}

function renderProcessRows(){
  const layers=parseInt(document.getElementById('layerCnt').value)||2;
  document.getElementById('processRows').innerHTML=PROCESS_ITEMS.map(p=>{
    const cost=p.base+p.perLayer*(layers-1);
    return `<div style="display:grid;grid-template-columns:1fr 90px 80px;gap:6px;align-items:center;margin-bottom:6px;font-size:.78rem">
      <label style="font-weight:600">${p.name}</label>
      <div style="display:flex;align-items:center;gap:4px">
        <input type="number" id="proc-${p.id}" value="${cost}" oninput="calc()" style="width:80px;padding:5px 7px;border:1px solid var(--border);border-radius:5px;font-size:.78rem">
        <span style="color:var(--mute);font-size:.7rem">원</span>
      </div>
      <span style="text-align:right;font-size:.7rem;color:var(--mute)">${p.perLayer>0?`×${layers}층`:'고정'}</span>
    </div>`;
  }).join('');
}

/* 미션3: 재료비 비중 기준 원가 등급 (A/B/C) */
function getCostGrade(matPct){
  if(matPct<=45) return {label:'A등급',cls:'cost-grade-a',desc:'원가 우수'};
  if(matPct<=55) return {label:'B등급',cls:'cost-grade-b',desc:'원가 보통'};
  return {label:'C등급',cls:'cost-grade-c',desc:'원가 개선 필요'};
}

/* 미션1: 재료비 과다 경보 배너 */
function renderCostAlertBanner(matPct){
  const banner=document.getElementById('costAlertBanner');
  if(matPct>55){
    banner.innerHTML=`⚠ <span>재료비 과다</span> 재료비 비중이 ${matPct}%로 목표(55%)를 초과했습니다. 원가 구조 개선이 필요합니다.`;
    banner.style.display='flex';
  } else {
    banner.style.display='none';
  }
}

function calc(){
  const matTotal=matRows.reduce((s,r)=>s+r.qty*r.price,0);
  const procTotal=PROCESS_ITEMS.reduce((s,p)=>{
    const el=document.getElementById(`proc-${p.id}`);
    return s+(el?parseFloat(el.value)||0:0);
  },0);
  const sub=matTotal+procTotal;
  const ohRate=(parseFloat(document.getElementById('ohRate').value)||0)/100;
  const sgaRate=(parseFloat(document.getElementById('sgaRate').value)||0)/100;
  const overhead=sub*ohRate;
  const manuf=sub+overhead;
  const sga=manuf*sgaRate;
  const total=manuf+sga;
  const batch=parseInt(document.getElementById('batchQty').value)||1;
  const matPct=sub>0?Math.round(matTotal/sub*100):0;

  document.getElementById('matTotal').textContent=`₩${Math.round(matTotal).toLocaleString()}`;
  document.getElementById('procTotal').textContent=`₩${Math.round(procTotal).toLocaleString()}`;
  document.getElementById('unitCost').textContent=`₩${Math.round(total).toLocaleString()}`;
  document.getElementById('batchCost').textContent=`배치 합계: ₩${Math.round(total*batch).toLocaleString()}`;

  const grade=getCostGrade(matPct);
  document.getElementById('costGrade').innerHTML=`<span class="cost-grade-badge ${grade.cls}">${grade.label} — ${grade.desc}</span>`;

  const items=[
    {name:'재료비',amount:matTotal,color:COST_COLORS[0]},
    {name:'공정비',amount:procTotal,color:COST_COLORS[1]},
    {name:'제조간접비',amount:overhead,color:COST_COLORS[2]},
    {name:'판관비',amount:sga,color:COST_COLORS[3]},
  ];
  renderDonut(items,total);
  renderBreakdown(items,total);
  calcMargin();
  renderCostAlertBanner(matPct);
}

function renderDonut(items,total){
  if(!total){document.getElementById('donutWrap').innerHTML='';return;}
  const R=60,C=70,stroke=18;
  let offset=0;
  const arcs=items.filter(i=>i.amount>0).map(i=>{
    const pct=i.amount/total;
    const arc=pct*2*Math.PI*R;
    const dash=`${arc} ${2*Math.PI*R-arc}`;
    const el=`<circle cx="${C}" cy="${C}" r="${R}" fill="none" stroke="${i.color}" stroke-width="${stroke}" stroke-dasharray="${dash}" stroke-dashoffset="${-(offset)}" transform="rotate(-90 ${C} ${C})"/>`;
    offset+=arc;
    return el;
  }).join('');
  document.getElementById('donutWrap').innerHTML=`
    <svg viewBox="0 0 140 140">
      <circle cx="${C}" cy="${C}" r="${R}" fill="none" stroke="#e2e8f0" stroke-width="${stroke}"/>
      ${arcs}
    </svg>
    <div class="donut-center"><span>단가</span><b>₩${Math.round(total).toLocaleString()}</b></div>`;
  document.getElementById('costLegend').innerHTML=items.filter(i=>i.amount>0).map(i=>`
    <div class="legend-row">
      <div class="legend-dot" style="background:${i.color}"></div>
      <span style="flex:1">${i.name}</span>
      <span style="font-weight:700;color:${i.color}">${Math.round(i.amount/total*100)}%</span>
    </div>`).join('');
}

function renderBreakdown(items,total){
  document.getElementById('breakdownRows').innerHTML=items.map(i=>`
    <div class="breakdown-row">
      <span>${i.name}</span>
      <span style="text-align:right;font-weight:700">₩${Math.round(i.amount).toLocaleString()}</span>
      <span style="text-align:right;color:var(--mute)">${total?Math.round(i.amount/total*100):0}%</span>
    </div>`).join('')+
    `<div class="breakdown-row total-row">
      <span>합 계</span>
      <span style="text-align:right;color:var(--rose)">₩${Math.round(total).toLocaleString()}</span>
      <span style="text-align:right">100%</span>
    </div>`;
}

function calcMargin(){
  const unitCostText=document.getElementById('unitCost').textContent.replace(/[₩,]/g,'');
  const cost=parseFloat(unitCostText)||0;
  const margin=(parseFloat(document.getElementById('marginRate').value)||0)/100;
  const sell=cost/(1-margin);
  document.getElementById('sellPrice').value=`₩${Math.round(sell).toLocaleString()}`;
}

function saveCalc(){
  const name=document.getElementById('productName').value||'이름없음';
  const cost=document.getElementById('unitCost').textContent;
  const sell=document.getElementById('sellPrice').value;
  saved.push({id:Date.now(),name,cost,sell,time:new Date().toLocaleTimeString()});
  localStorage.setItem('pcbCostSaved',JSON.stringify(saved));
  renderSaved();
  showToast(`"${name}" 원가가 비교 목록에 저장되었습니다.`);
}

function clearSaved(){
  if(!confirm('모두 삭제하시겠습니까?'))return;
  saved=[];
  localStorage.setItem('pcbCostSaved','[]');
  renderSaved();
}

/* 미션2: 비교 저장 목록 + 단가 비교 바 차트 */
function renderSaved(){
  if(saved.length===0){
    document.getElementById('savedList').innerHTML='<div style="text-align:center;padding:20px;color:var(--mute);font-size:.8rem">저장된 항목이 없습니다</div>';
    document.getElementById('compareChart').innerHTML='';
    return;
  }
  document.getElementById('savedList').innerHTML=saved.map(s=>`
    <div class="saved-item">
      <div>
        <div class="saved-item-name">${s.name}</div>
        <div style="font-size:.7rem;color:var(--mute)">${s.time}</div>
      </div>
      <div style="text-align:right">
        <div class="saved-item-cost">${s.cost}</div>
        <div style="font-size:.7rem;color:var(--sub)">판매가: ${s.sell}</div>
      </div>
    </div>`).join('');

  const costVals=saved.map(s=>parseInt(s.cost.replace(/[₩,]/g,''))||0);
  const maxCost=Math.max(...costVals,1);
  document.getElementById('compareChart').innerHTML=`
    <div style="padding:10px 10px 4px;border-top:1px solid var(--border)">
      <div style="font-size:.75rem;font-weight:700;color:var(--sub);margin-bottom:8px">단가 비교</div>
      ${saved.map((s,i)=>`
        <div class="compare-bar">
          <span class="compare-bar-label" title="${s.name}">${s.name}</span>
          <div class="compare-bar-track"><div class="compare-bar-fill" style="width:${Math.round(costVals[i]/maxCost*100)}%"></div></div>
          <span class="compare-bar-val">${s.cost}</span>
        </div>`).join('')}
    </div>`;
}

function exportCSV(){
  const name=document.getElementById('productName').value;
  const batch=document.getElementById('batchQty').value;
  const unit=document.getElementById('unitCost').textContent;
  const sell=document.getElementById('sellPrice').value;
  const mat=matRows.map(r=>`${r.name}: ₩${Math.round(r.qty*r.price).toLocaleString()}`).join(' / ');
  const csv=`제품명,배치수량,재료비내역,단가,판매가\n${name},${batch},"${mat}",${unit},${sell}`;
  const blob=new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8;'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='원가계산.csv';a.click();
}

renderSaved();
initMaterials();
renderProcessRows();
document.getElementById('layerCnt').addEventListener('change',()=>{renderProcessRows();calc();});
calc();
