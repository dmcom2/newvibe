const today=new Date().toISOString().slice(0,10);

const VISUAL_ITEMS=[
  {name:'외관 이물',spec:'이물 없음'},
  {name:'스크래치',spec:'0.1mm 이하'},
  {name:'솔더마스크 박리',spec:'없음'},
  {name:'동박 노출',spec:'없음'},
  {name:'실크인쇄 선명도',spec:'명확'},
];
const DIM_ITEMS=[
  {name:'기판 길이',spec:'규격±0.2'},
  {name:'기판 폭',spec:'규격±0.2'},
  {name:'기판 두께',spec:'규격±0.1'},
  {name:'드릴 홀경',spec:'규격±0.05'},
  {name:'랜드 폭',spec:'규격±0.05'},
];
const ELEC_ITEMS=[
  {name:'절연저항',spec:'≥100MΩ'},
  {name:'단락 검사',spec:'단락 없음'},
  {name:'개방 검사',spec:'개방 없음'},
  {name:'임피던스',spec:'규격±10%'},
];

function genSample(){
  const custs=['(주)삼성전자','LG이노텍','현대모비스','(주)코리아서킷'];
  const prds=['PCB-A2401','PCB-B1802','PCB-C3305','PCB-D0401'];
  const arr=[];
  const y=today.slice(0,4);
  const DIM_VALS=['200.05','150.02','1.61','0.30','0.25'];
  for(let i=0;i<10;i++){
    const d=String((i%28)+1).padStart(2,'0');
    const m=String(Math.floor(i/5)+5).padStart(2,'0');
    const pass=i%5!==0;
    const visual=VISUAL_ITEMS.map(x=>({...x,value:x.name==='외관 이물'&&!pass?'이물 발견':'정상',result:x.name==='외관 이물'&&!pass?'NG':'OK'}));
    const dim=DIM_ITEMS.map((x,idx)=>({...x,value:DIM_VALS[idx],result:'OK'}));
    const elec=ELEC_ITEMS.map(x=>({...x,value:x.name==='절연저항'?'150MΩ':x.name.includes('검사')?'이상없음':x.name==='임피던스'?'50Ω':'정상',result:'OK'}));
    arr.push({id:Date.now()+i,
      no:`QC-${y}${m}-${String(i+1).padStart(3,'0')}`,
      date:`${y}-${m}-${d}`,
      customer:custs[i%4],poNo:`PO-${y}-${String(i+1).padStart(3,'0')}`,
      product:prds[i%4],layer:['양면','4층','양면','6층'][i%4],
      qty:100+i*10,sample:5,
      inspector:'이품질',approver:'박팀장',
      visual,dim,elec,
      overall:pass?'합격':'불합격',note:'',
    });
  }
  return arr;
}

let certs;
try{ certs=JSON.parse(localStorage.getItem('pcbCerts')||'null')||genSample(); }
catch(e){ certs=genSample(); }
let currentId=null,editId=null,nextId=Date.now();

function save(){ localStorage.setItem('pcbCerts', JSON.stringify(certs)); }

/* 토스트 */
let _toastTimer=null;
function showToast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg;t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer=setTimeout(()=>t.classList.remove('show'),2800);
}

/* 미션1: KPI 카드 */
function renderKPI(){
  const total=certs.length;
  const pass=certs.filter(c=>c.overall==='합격').length;
  const fail=certs.filter(c=>c.overall==='불합격').length;
  const thisMonth=today.slice(0,7);
  const monthCerts=certs.filter(c=>c.date.startsWith(thisMonth));
  const mPass=monthCerts.filter(c=>c.overall==='합격').length;
  const mRate=monthCerts.length?Math.round(mPass/monthCerts.length*100):0;
  const mColor=mRate>=95?'var(--green)':mRate>=80?'var(--amber)':'var(--red)';
  document.getElementById('kpiRow').innerHTML=`
    <div class="kpi" style="border-left-color:var(--teal)"><div class="kpi-l">총 성적서</div><div class="kpi-v" style="color:var(--teal)">${total}</div><div class="kpi-sub">건</div></div>
    <div class="kpi" style="border-left-color:var(--green)"><div class="kpi-l">합격</div><div class="kpi-v" style="color:var(--green)">${pass}</div><div class="kpi-sub">건</div></div>
    <div class="kpi" style="border-left-color:var(--red)"><div class="kpi-l">불합격</div><div class="kpi-v" style="color:var(--red)">${fail}</div><div class="kpi-sub">건</div></div>
    <div class="kpi" style="border-left-color:${mColor}"><div class="kpi-l">이번달 합격률</div><div class="kpi-v" style="color:${mColor}">${mRate}%</div><div class="kpi-sub">${monthCerts.length}건 중 ${mPass}건</div></div>`;
  renderMonthlyTrend();
}

/* 미션2: 월별 합격률 추이 */
function renderMonthlyTrend(){
  const monthMap={};
  certs.forEach(c=>{
    const k=c.date.slice(0,7);
    if(!monthMap[k]) monthMap[k]={pass:0,total:0};
    monthMap[k].total++;
    if(c.overall==='합격') monthMap[k].pass++;
  });
  const months=Object.keys(monthMap).sort();
  const html=months.map(m=>{
    const d=monthMap[m];
    const pct=d.total?Math.round(d.pass/d.total*100):0;
    const col=pct>=95?'var(--green)':pct>=80?'var(--amber)':'var(--red)';
    return `<div class="mt-row">
      <span class="mt-month">${m.slice(5)}월</span>
      <div class="mt-bar"><div class="mt-fill" style="width:${pct}%;background:${col}"></div></div>
      <span class="mt-pct" style="color:${col}">${pct}%</span>
    </div>`;
  }).join('');
  let wrap=document.getElementById('monthlyTrendWrap');
  if(!wrap){
    wrap=document.createElement('div');
    wrap.id='monthlyTrendWrap';
    wrap.className='monthly-trend-wrap';
    wrap.style.cssText='margin:0 28px 14px';
    document.getElementById('kpiRow').after(wrap);
  }
  wrap.innerHTML=`<div class="mt-title">📊 월별 합격률 추이</div>${html}`;
}

/* 미션3: 불합격 경보 배너 */
function renderFailBanner(){
  const el=document.getElementById('failBanner');
  const fails=certs.filter(c=>c.overall==='불합격');
  if(!fails.length){el.style.display='none';return;}
  el.style.display='flex';
  el.innerHTML='🚨 불합격 성적서 '+fails.length+'건: '+
    fails.slice(0,3).map(c=>`<span style="background:rgba(255,255,255,.2);padding:2px 8px;border-radius:4px">${c.product} (${c.customer})</span>`).join(' ')+
    (fails.length>3?` <span>외 ${fails.length-3}건</span>`:'');
}

/* 목록 */
function renderList(){
  const q=document.getElementById('searchQ').value.toLowerCase();
  const pf=document.getElementById('passFilter').value;
  const mf=document.getElementById('monthFilter').value;
  const list=certs.filter(c=>{
    const mq=!q||c.no.toLowerCase().includes(q)||c.product.toLowerCase().includes(q)||c.customer.includes(q);
    const mp=!pf||c.overall===pf;
    const mm=!mf||c.date.startsWith(mf);
    return mq&&mp&&mm;
  }).sort((a,b)=>b.date.localeCompare(a.date));
  document.getElementById('listCount').textContent=`총 ${list.length}건`;
  document.getElementById('listItems').innerHTML=list.map(c=>`
    <div class="cert-item ${String(c.id)===String(currentId)?'selected':''}" onclick="selectCert('${c.id}')">
      <div class="ci-top">
        <span class="ci-no">${c.no}</span>
        <span class="pass-badge" style="background:${c.overall==='합격'?'#dcfce7':'#fee2e2'};color:${c.overall==='합격'?'var(--green)':'var(--red)'}">${c.overall}</span>
      </div>
      <div class="ci-product">${c.product}</div>
      <div class="ci-customer">${c.customer}</div>
      <div class="ci-meta"><span>${c.date}</span><span>${c.layer}</span><span>검사: ${c.inspector}</span></div>
    </div>`).join('');
  renderKPI();
  renderFailBanner();
}

function selectCert(id){
  currentId=id;
  document.getElementById('editBtn').style.display='block';
  const c=certs.find(x=>String(x.id)===String(id));
  if(!c)return;
  const infoLeft=`
    <div class="di-row"><div class="di-label">성적서 번호</div><div class="di-value">${c.no}</div></div>
    <div class="di-row"><div class="di-label">고객사</div><div class="di-value">${c.customer}</div></div>
    <div class="di-row"><div class="di-label">제품명/모델</div><div class="di-value">${c.product}</div></div>
    <div class="di-row"><div class="di-label">층수</div><div class="di-value">${c.layer}</div></div>`;
  const infoRight=`
    <div class="di-row"><div class="di-label">검사일</div><div class="di-value">${c.date}</div></div>
    <div class="di-row"><div class="di-label">수주번호</div><div class="di-value">${c.poNo}</div></div>
    <div class="di-row"><div class="di-label">검사 수량</div><div class="di-value">${c.qty.toLocaleString()} 매</div></div>
    <div class="di-row"><div class="di-label">샘플 수</div><div class="di-value">${c.sample} 매</div></div>`;

  const mkTable=(rows)=>`
    <table class="inspect-table">
      <thead><tr><th>검사 항목</th><th>판정 기준</th><th>측정값</th><th>판정</th></tr></thead>
      <tbody>${rows.map(r=>`
        <tr>
          <td style="text-align:left">${r.name}</td>
          <td>${r.spec}</td>
          <td>${r.value}</td>
          <td class="${r.result==='OK'?'result-ok':'result-ng'}">${r.result==='OK'?'○ 합격':'✕ 불합격'}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;

  const isPass=c.overall==='합격';
  document.getElementById('certDoc').innerHTML=`
    <div class="doc-title">
      <h2>PCB 검사 성적서</h2>
      <p>PCB Manufacturing Co., Ltd.</p>
    </div>
    <div class="doc-info-grid">
      <div>${infoLeft}</div>
      <div>${infoRight}</div>
    </div>
    <div class="section-title">1. 외관 검사</div>${mkTable(c.visual)}
    <div class="section-title">2. 치수 검사</div>${mkTable(c.dim)}
    <div class="section-title">3. 전기 특성</div>${mkTable(c.elec)}
    ${c.note?`<div class="section-title">4. 특이사항</div><div style="border:1px solid var(--border);padding:10px;border-radius:6px;font-size:.8rem">${c.note}</div>`:''}
    <div class="final-result" style="border-color:${isPass?'var(--green)':'var(--red)'};background:${isPass?'#f0fdf4':'#fef2f2'}">
      <div style="font-size:1.6rem;font-weight:900;color:${isPass?'var(--green)':'var(--red)'}">${isPass?'✓ 합 격':'✗ 불 합 격'}</div>
      <div style="font-size:.78rem;color:var(--sub);margin-top:4px">상기 제품은 당사 품질 기준을 ${isPass?'충족합니다':'충족하지 못합니다'}</div>
    </div>
    <div class="sign-row">
      <div class="sign-box">검사자<br><br>${c.inspector}</div>
      <div class="sign-box">승인자<br><br>${c.approver}</div>
    </div>`;
  renderList();
}

/* 모달 */
function buildInspectRows(tbodyId, items, data){
  document.getElementById(tbodyId).innerHTML=items.map((item,idx)=>`
    <tr>
      <td style="padding:5px 8px;font-size:.75rem">${item.name}</td>
      <td style="padding:5px 8px;font-size:.75rem;color:var(--mute)">${item.spec}</td>
      <td><input value="${data?data[idx]?.value||'':''}" placeholder="측정값 입력" id="${tbodyId}-v-${idx}"></td>
      <td>
        <select id="${tbodyId}-r-${idx}">
          <option value="OK" ${data&&data[idx]?.result==='OK'?'selected':''}>OK</option>
          <option value="NG" ${data&&data[idx]?.result==='NG'?'selected':''}>NG</option>
        </select>
      </td>
    </tr>`).join('');
}
function getInspectData(tbodyId, items){
  return items.map((item,idx)=>({
    ...item,
    value:document.getElementById(`${tbodyId}-v-${idx}`).value,
    result:document.getElementById(`${tbodyId}-r-${idx}`).value,
  }));
}

function openModal(id=null){
  editId=id;
  const c=id?certs.find(x=>String(x.id)===String(id)):null;
  document.getElementById('modalTitle').textContent=id?'성적서 수정':'성적서 작성';
  document.getElementById('delBtn2').style.display=id?'block':'none';
  const newNo=`QC-${today.slice(0,4)}${today.slice(5,7)}-${String(certs.length+1).padStart(3,'0')}`;
  document.getElementById('c-no').value=c?.no||newNo;
  document.getElementById('c-date').value=c?.date||today;
  document.getElementById('c-customer').value=c?.customer||'';
  document.getElementById('c-poNo').value=c?.poNo||'';
  document.getElementById('c-product').value=c?.product||'';
  document.getElementById('c-layer').value=c?.layer||'양면';
  document.getElementById('c-qty').value=c?.qty||'';
  document.getElementById('c-sample').value=c?.sample||'5';
  document.getElementById('c-inspector').value=c?.inspector||'';
  document.getElementById('c-approver').value=c?.approver||'';
  document.getElementById('c-note').value=c?.note||'';
  buildInspectRows('visual-rows',VISUAL_ITEMS,c?.visual);
  buildInspectRows('dim-rows',DIM_ITEMS,c?.dim);
  buildInspectRows('elec-rows',ELEC_ITEMS,c?.elec);
  document.getElementById('modal').classList.add('show');
}
function closeModal(){ document.getElementById('modal').classList.remove('show'); editId=null; }

function saveCert(){
  const product=document.getElementById('c-product').value.trim();
  if(!product){showToast('제품명을 입력하세요');return;}
  const visual=getInspectData('visual-rows',VISUAL_ITEMS);
  const dim=getInspectData('dim-rows',DIM_ITEMS);
  const elec=getInspectData('elec-rows',ELEC_ITEMS);
  const allOK=[...visual,...dim,...elec].every(x=>x.result==='OK');
  const rec={id:editId||nextId++,
    no:document.getElementById('c-no').value,
    date:document.getElementById('c-date').value,
    customer:document.getElementById('c-customer').value,
    poNo:document.getElementById('c-poNo').value,
    product,
    layer:document.getElementById('c-layer').value,
    qty:parseInt(document.getElementById('c-qty').value)||0,
    sample:parseInt(document.getElementById('c-sample').value)||5,
    inspector:document.getElementById('c-inspector').value,
    approver:document.getElementById('c-approver').value,
    visual,dim,elec,
    overall:allOK?'합격':'불합격',
    note:document.getElementById('c-note').value,
  };
  if(editId){const i=certs.findIndex(x=>String(x.id)===String(editId));if(i>=0)certs[i]=rec;}
  else certs.push(rec);
  save(); closeModal();
  currentId=rec.id;
  renderList();
  selectCert(rec.id);
  showToast(`성적서 저장 완료. 판정: ${rec.overall}`);
}
function deleteItem(){
  if(!confirm('삭제하시겠습니까?'))return;
  certs=certs.filter(x=>String(x.id)!==String(editId));
  save(); closeModal(); currentId=null;
  document.getElementById('certDoc').innerHTML='<div style="text-align:center;padding:40px;color:var(--mute)">성적서를 선택하세요</div>';
  document.getElementById('editBtn').style.display='none';
  renderList();
}

function exportCSV(){
  const rows=['성적서번호,검사일,고객사,수주번호,제품명,층수,검사수량,검사자,승인자,판정'];
  certs.forEach(c=>rows.push(`${c.no},${c.date},${c.customer},${c.poNo},${c.product},${c.layer},${c.qty},${c.inspector},${c.approver},${c.overall}`));
  const blob=new Blob(['﻿'+rows.join('\n')],{type:'text/csv;charset=utf-8;'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='품질성적서목록.csv';a.click();
}

function openReport(){
  const todayStr=new Date().toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric'});
  const total=certs.length;
  const passCnt=certs.filter(c=>c.overall==='합격').length;
  const failCnt=certs.filter(c=>c.overall==='불합격').length;
  const ym=today.slice(0,7);
  const mCerts=certs.filter(c=>c.date.startsWith(ym));
  const mPass=mCerts.filter(c=>c.overall==='합격').length;
  const monthRate=mCerts.length>0?Math.round(mPass/mCerts.length*100):0;
  const rows=certs.map(c=>{
    const isPass=c.overall==='합격';
    return `<tr><td style="text-align:left;font-family:monospace;font-size:8pt">${c.no}</td><td>${c.date}</td><td style="text-align:left">${c.customer}</td><td style="text-align:left">${c.product}</td><td>${c.layer}</td><td class="num">${c.qty.toLocaleString()}</td><td>${c.inspector}</td><td>${c.approver}</td><td class="${isPass?'rpt-good':'rpt-bad'}">${c.overall}</td></tr>`;
  }).join('');
  document.getElementById('rptPage').innerHTML=`
    <div class="rpt-company"><strong>(주)PCB 제조</strong> | 품질관리<br>출력일: ${todayStr}</div>
    <div class="rpt-doc-title"><h1>품질 성적서 현황 보고서</h1><p>품질 검사 성적서 전체 현황 분석</p></div>
    <div class="rpt-kpi-grid">
      <div class="rpt-kpi-card"><div class="rk-label">총 성적서</div><div class="rk-val">${total}</div><div class="rk-unit">건</div></div>
      <div class="rpt-kpi-card"><div class="rk-label">합격</div><div class="rk-val" style="color:#059669">${passCnt}</div><div class="rk-unit">건</div></div>
      <div class="rpt-kpi-card"><div class="rk-label">불합격</div><div class="rk-val" style="color:#dc2626">${failCnt}</div><div class="rk-unit">건</div></div>
      <div class="rpt-kpi-card"><div class="rk-label">당월 합격률</div><div class="rk-val" style="color:${monthRate>=95?'#059669':monthRate>=80?'#d97706':'#dc2626'}">${monthRate}</div><div class="rk-unit">%</div></div>
    </div>
    <div class="rpt-sec"><div class="rpt-sec-title">■ 품질 성적서 목록</div>
      <table class="rpt-table"><thead><tr><th>성적서번호</th><th>검사일</th><th>고객사</th><th>제품명</th><th>층수</th><th>수량</th><th>검사자</th><th>승인자</th><th>판정</th></tr></thead><tbody>${rows}</tbody></table>
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

renderList();
if(certs.length>0) selectCert(certs[0].id);
