// 직원 교육이수 관리 앱 스크립트
const today=new Date().toISOString().slice(0,10);
let curTab='matrix', editEmpId=null, nextId=Date.now();

const COURSES=[
  {id:'C01',name:'산업안전보건교육',type:'법정',color:'#dc2626',typeColor:'#fee2e2',required:true,cycleMonths:3,hours:6,desc:'산업안전보건법에 의한 분기별 정기 안전보건교육 (근로자 필수)'},
  {id:'C02',name:'소방안전교육',type:'법정',color:'#ea580c',typeColor:'#ffedd5',required:true,cycleMonths:12,hours:4,desc:'소방시설 사용 및 화재 대피 요령 (연 1회)'},
  {id:'C03',name:'개인정보보호교육',type:'법정',color:'#7c3aed',typeColor:'#ede9fe',required:true,cycleMonths:12,hours:2,desc:'개인정보보호법에 따른 연간 의무 교육'},
  {id:'C04',name:'PCB 공정 기초',type:'직무',color:'#2563eb',typeColor:'#dbeafe',required:false,cycleMonths:0,hours:8,desc:'PCB 제조 공정 전반의 이해 (신규 입사자 필수)'},
  {id:'C05',name:'IPC-A-600 검사기준',type:'직무',color:'#0891b2',typeColor:'#cffafe',required:false,cycleMonths:24,hours:16,desc:'PCB 외관 검사 국제 기준 (품질/생산 필수)'},
  {id:'C06',name:'AOI 검사장비 운용',type:'직무',color:'#059669',typeColor:'#dcfce7',required:false,cycleMonths:24,hours:8,desc:'자동광학검사기 운용 및 판정 기준 교육'},
  {id:'C07',name:'화학물질 취급 안전',type:'법정',color:'#b45309',typeColor:'#fef3c7',required:true,cycleMonths:12,hours:4,desc:'MSDS, 화학물질 안전 취급 교육 (화학물질 취급자)'},
  {id:'C08',name:'5S 품질혁신',type:'사내',color:'#64748b',typeColor:'#f1f5f9',required:false,cycleMonths:12,hours:4,desc:'현장 5S 활동 및 품질 개선 방법론'},
];

let emps=JSON.parse(localStorage.getItem('pcbEmps')||'null')||genSampleEmps();
let completions=JSON.parse(localStorage.getItem('pcbEduComp')||'null')||genSampleComp();

function genSampleEmps(){
  const names=['김생산','이공정','박품질','최설비','정구매','한영업','조관리','윤라인','엄검사','신도금','류에칭','강드릴'];
  const depts=['생산부','생산부','품질부','설비부','구매부','영업부','관리부','생산부','품질부','생산부','생산부','생산부'];
  const ranks=['대리','사원','과장','과장','대리','과장','차장','사원','대리','사원','대리','사원'];
  return names.map((n,i)=>({id:Date.now()+i,name:n,empno:`EMP${String(i+1).padStart(3,'0')}`,dept:depts[i],rank:ranks[i],joinDate:`2023-0${(i%9)+1}-01`}));
}
function genSampleComp(){
  const arr=[];
  const y=today.slice(0,4);
  emps.forEach(emp=>{
    COURSES.slice(0,5).forEach((c,ci)=>{
      if(Math.random()>0.3){
        const m=String((ci+1)%12+1).padStart(2,'0');
        arr.push({empId:emp.id,courseId:c.id,date:`${y}-${m}-15`,org:'사내',note:''});
      }
    });
  });
  return arr;
}
function save(){
  localStorage.setItem('pcbEmps',JSON.stringify(emps));
  localStorage.setItem('pcbEduComp',JSON.stringify(completions));
}

function showToast(msg){
  const t=document.getElementById('toast');
  clearTimeout(t._tid);
  t.textContent=msg;
  t.classList.add('show');
  t._tid=setTimeout(()=>t.classList.remove('show'),2800);
}

function getLastCompletion(empId,courseId){
  return completions.filter(c=>c.empId===empId&&c.courseId===courseId).sort((a,b)=>b.date.localeCompare(a.date))[0]||null;
}
function getCellStatus(emp,course){
  const last=getLastCompletion(emp.id,course.id);
  if(!last) return {status:'none',text:'미이수',color:'var(--mute)'};
  if(!course.cycleMonths) return {status:'ok',text:`${last.date.slice(0,7)}`,color:'var(--green)'};
  const nextDue=new Date(last.date);
  nextDue.setMonth(nextDue.getMonth()+course.cycleMonths);
  const daysLeft=Math.ceil((nextDue-new Date(today))/(86400000));
  if(daysLeft<0) return {status:'overdue',text:'만료',color:'var(--red)'};
  if(daysLeft<=30) return {status:'due',text:`D-${daysLeft}`,color:'var(--amber)'};
  return {status:'ok',text:`${last.date.slice(0,7)}`,color:'var(--green)'};
}

/* 미션3: 직원별 법정교육 이수 등급 (A/B/C) */
function getEmpGrade(emp){
  const req=COURSES.filter(c=>c.required);
  const done=req.filter(c=>getCellStatus(emp,c).status==='ok').length;
  const pct=req.length?done/req.length*100:0;
  if(pct>=100) return {label:'A',cls:'grade-a'};
  if(pct>=60)  return {label:'B',cls:'grade-b'};
  return {label:'C',cls:'grade-c'};
}

/* 미션1: 법정교육 만료/임박 경보 배너 */
function renderAlertBanner(){
  const overdueEmps=emps.filter(e=>COURSES.filter(c=>c.required).some(c=>getCellStatus(e,c).status==='overdue'));
  const dueEmps=emps.filter(e=>COURSES.filter(c=>c.required).some(c=>getCellStatus(e,c).status==='due'));
  const banner=document.getElementById('eduAlertBanner');
  if(overdueEmps.length===0&&dueEmps.length===0){banner.style.display='none';return;}
  const parts=[];
  if(overdueEmps.length>0) parts.push(`<span>만료</span> ${overdueEmps.length}명의 법정교육이 만료되었습니다.`);
  if(dueEmps.length>0) parts.push(`<span>임박</span> ${dueEmps.length}명의 법정교육이 30일 내 만료 예정입니다.`);
  banner.innerHTML='🚨 '+parts.join(' &nbsp;|&nbsp; ');
  banner.style.display='flex';
}

function updateDeptFilter(){
  const sel=document.getElementById('deptFilter');
  const cur=sel.value;
  const depts=[...new Set(emps.map(e=>e.dept))].sort();
  sel.innerHTML='<option value="">전체 부서</option>'+depts.map(d=>`<option ${d===cur?'selected':''}>${d}</option>`).join('');
}

function getFilteredEmps(){
  const q=document.getElementById('searchQ').value;
  const d=document.getElementById('deptFilter').value;
  return emps.filter(e=>(!q||e.name.includes(q)||e.dept.includes(q))&&(!d||e.dept===d));
}

function renderKPI(){
  const total=emps.length;
  const overdueEmps=emps.filter(e=>COURSES.filter(c=>c.required).some(c=>getCellStatus(e,c).status==='overdue')).length;
  const dueEmps=emps.filter(e=>COURSES.filter(c=>c.required).some(c=>getCellStatus(e,c).status==='due')).length;
  const allDone=emps.filter(e=>COURSES.filter(c=>c.required).every(c=>getCellStatus(e,c).status==='ok')).length;
  const totalCells=emps.length*COURSES.filter(c=>c.required).length;
  const doneCells=emps.reduce((s,e)=>s+COURSES.filter(c=>c.required).filter(c=>getCellStatus(e,c).status==='ok').length,0);
  const rate=totalCells?Math.round(doneCells/totalCells*100):0;
  document.getElementById('kpiRow').innerHTML=`
    <div class="kpi" style="border-top-color:var(--cyan)"><div class="kpi-l">전체 직원</div><div class="kpi-v" style="color:var(--cyan)">${total}</div><div class="kpi-sub">명</div></div>
    <div class="kpi" style="border-top-color:var(--red)"><div class="kpi-l">법정교육 만료</div><div class="kpi-v" style="color:var(--red)">${overdueEmps}</div><div class="kpi-sub">명</div></div>
    <div class="kpi" style="border-top-color:var(--amber)"><div class="kpi-l">30일 이내 만료</div><div class="kpi-v" style="color:var(--amber)">${dueEmps}</div><div class="kpi-sub">명</div></div>
    <div class="kpi" style="border-top-color:var(--green)"><div class="kpi-l">법정교육 완료</div><div class="kpi-v" style="color:var(--green)">${allDone}</div><div class="kpi-sub">명</div></div>
    <div class="kpi" style="border-top-color:${rate>=95?'var(--green)':rate>=80?'var(--amber)':'var(--red)'}"><div class="kpi-l">법정교육 이수율</div><div class="kpi-v" style="color:${rate>=95?'var(--green)':rate>=80?'var(--amber)':'var(--red)'}">${rate}%</div><div class="kpi-sub">전체</div></div>`;
}

function switchTab(t){
  curTab=t;
  ['matrix','courses','stat'].forEach(x=>{
    document.getElementById(`${x}View`).style.display=x===t?'block':'none';
    document.getElementById(`t-${x}`).classList.toggle('active',x===t);
  });
  render();
}

function render(){
  updateDeptFilter();
  renderKPI();
  renderAlertBanner();
  if(curTab==='matrix') renderMatrix();
  else if(curTab==='courses') renderCourses();
  else renderStat();
}

/* 미션3 등급 뱃지를 이름 셀에 표시 */
function renderMatrix(){
  const list=getFilteredEmps();
  const header=COURSES.map(c=>`<th style="border-left:2px solid ${c.color}40">${c.name}<br><small style="color:${c.required?'var(--red)':'var(--mute)'}">${c.required?'법정':'선택'}</small></th>`).join('');
  const rows=list.map(emp=>{
    const grade=getEmpGrade(emp);
    const cells=COURSES.map(c=>{
      const st=getCellStatus(emp,c);
      return `<td class="cell-${st.status}" style="color:${st.color}" onclick="openCmModal('${emp.id}','${c.id}')" title="${emp.name} - ${c.name}">${st.text}</td>`;
    }).join('');
    return `<tr>
      <td style="font-weight:700;cursor:pointer" onclick="openModal('emp','${emp.id}')">${emp.name} <span class="${grade.cls}">${grade.label}</span> <small style="color:var(--mute);font-weight:400">${emp.dept}</small></td>
      ${cells}
    </tr>`;
  }).join('');
  document.getElementById('matrixView').innerHTML=`
    <div class="edu-wrap">
      <table class="edu-table">
        <thead><tr><th>직원 · 등급 (클릭: 수정)</th>${header}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function renderCourses(){
  document.getElementById('coursesView').innerHTML=`
    <div class="course-grid">
      ${COURSES.map(c=>{
        const compCount=emps.filter(e=>getLastCompletion(e.id,c.id)).length;
        const rate=emps.length?Math.round(compCount/emps.length*100):0;
        return `<div class="course-card" style="border-left-color:${c.color}">
          <div class="cc-title">${c.name}</div>
          <span class="cc-type" style="background:${c.typeColor};color:${c.color}">${c.type}${c.required?' (필수)':''}</span>
          <div class="cc-desc">${c.desc}</div>
          <div class="cc-meta">
            <span class="cc-meta-l">교육 시간</span><span>${c.hours}H</span>
            <span class="cc-meta-l">갱신 주기</span><span>${c.cycleMonths?c.cycleMonths+'개월':'최초 1회'}</span>
            <span class="cc-meta-l">이수 인원</span><span style="font-weight:700">${compCount}명 / ${emps.length}명</span>
            <span class="cc-meta-l">이수율</span><span style="font-weight:700;color:${rate>=80?'var(--green)':'var(--red)'}">${rate}%</span>
          </div>
          <div style="margin-top:8px;height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden">
            <div style="width:${rate}%;height:100%;background:${c.color};border-radius:3px"></div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

/* 미션2: 과정별 이수율 바 차트를 통계 탭 하단에 추가 */
function renderStat(){
  const depts=[...new Set(emps.map(e=>e.dept))].sort();
  const deptStats=depts.map(d=>{
    const dEmps=emps.filter(e=>e.dept===d);
    const req=COURSES.filter(c=>c.required);
    const total=dEmps.length*req.length;
    const done=dEmps.reduce((s,e)=>s+req.filter(c=>getCellStatus(e,c).status==='ok').length,0);
    return {dept:d,pct:total?Math.round(done/total*100):0};
  });
  const overdueList=emps.flatMap(e=>
    COURSES.filter(c=>c.required&&getCellStatus(e,c).status==='overdue').map(c=>({emp:e,course:c}))
  );
  const courseChart=COURSES.map(c=>{
    const compCount=emps.filter(e=>getLastCompletion(e.id,c.id)).length;
    const pct=emps.length?Math.round(compCount/emps.length*100):0;
    return `<div class="course-bar-row">
      <span class="course-bar-label" title="${c.name}">${c.name}</span>
      <div class="course-bar-track"><div class="course-bar-fill" style="width:${pct}%;background:${c.color}"></div></div>
      <span class="course-bar-pct" style="color:${pct>=80?'var(--green)':pct>=50?'var(--amber)':'var(--red)'}">${pct}%</span>
    </div>`;
  }).join('');
  document.getElementById('statView').innerHTML=`
    <div class="stat-grid">
      <div class="panel">
        <div class="panel-title">부서별 법정교육 이수율</div>
        ${deptStats.map(d=>`
          <div class="dept-bar">
            <span class="dept-label">${d.dept}</span>
            <div class="dept-track"><div class="dept-fill" style="width:${d.pct}%;background:${d.pct>=95?'var(--green)':d.pct>=80?'var(--amber)':'var(--red)'}"></div></div>
            <span class="dept-pct" style="color:${d.pct>=95?'var(--green)':d.pct>=80?'var(--amber)':'var(--red)'}">${d.pct}%</span>
          </div>`).join('')}
      </div>
      <div class="panel">
        <div class="panel-title" style="color:var(--red)">⚠ 법정교육 만료 현황 (${overdueList.length}건)</div>
        ${overdueList.length===0?'<div style="text-align:center;padding:20px;color:var(--mute)">만료된 교육 없음 ✓</div>':
          `<table style="width:100%;border-collapse:collapse;font-size:.78rem">
            <thead><tr style="border-bottom:2px solid var(--border)">
              <th style="padding:6px;text-align:left;color:var(--sub)">직원</th>
              <th style="padding:6px;text-align:left;color:var(--sub)">부서</th>
              <th style="padding:6px;text-align:left;color:var(--sub)">교육명</th>
              <th style="padding:6px;color:var(--sub)">조치</th>
            </tr></thead>
            <tbody>${overdueList.map(x=>`
              <tr style="border-bottom:1px solid var(--border)">
                <td style="padding:6px;font-weight:700">${x.emp.name}</td>
                <td style="padding:6px;color:var(--sub)">${x.emp.dept}</td>
                <td style="padding:6px">${x.course.name}</td>
                <td style="padding:6px;text-align:center">
                  <button class="btn btn-green" style="font-size:.68rem;padding:3px 7px" onclick="openCmModal('${x.emp.id}','${x.course.id}')">이수처리</button>
                </td>
              </tr>`).join('')}
            </tbody>
          </table>`}
      </div>
    </div>
    <div class="panel" style="margin-top:14px;padding:16px">
      <div class="panel-title" style="margin-bottom:12px">과정별 이수율 현황</div>
      <div class="course-bar-wrap">${courseChart}</div>
    </div>`;
}

/* 이수 모달 */
let cmEmpId=null, cmCourseId=null;
function openCmModal(empId,courseId){
  cmEmpId=empId; cmCourseId=courseId;
  const emp=emps.find(e=>String(e.id)===String(empId));
  const course=COURSES.find(c=>c.id===courseId);
  const last=getLastCompletion(empId,courseId);
  document.getElementById('completionInfo').innerHTML=`<b>${emp?.name}</b> · ${emp?.dept} &nbsp;|&nbsp; <b>${course?.name}</b> (${course?.type}${course?.required?' 필수':''})${last?`<br>최근 이수: ${last.date} (${last.org})`:' · 미이수'}`;
  document.getElementById('cm-date').value=today;
  document.getElementById('cm-org').value='사내';
  document.getElementById('cm-note').value='';
  document.getElementById('cmDelBtn').style.display=last?'block':'none';
  document.getElementById('completionModal').classList.add('show');
}
function closeCmModal(){document.getElementById('completionModal').classList.remove('show');cmEmpId=null;cmCourseId=null;}
function saveCompletion(){
  completions.push({empId:cmEmpId,courseId:cmCourseId,
    date:document.getElementById('cm-date').value,
    org:document.getElementById('cm-org').value,
    note:document.getElementById('cm-note').value,
  });
  save();closeCmModal();render();showToast('이수 등록이 완료되었습니다.');
}
function deleteCompletion(){
  if(!confirm('최근 이수 기록을 삭제하시겠습니까?'))return;
  const idx=completions.findLastIndex(c=>String(c.empId)===String(cmEmpId)&&c.courseId===cmCourseId);
  if(idx>=0) completions.splice(idx,1);
  save();closeCmModal();render();
}

/* 직원 모달 */
function openModal(type,id=null){
  if(type==='emp'){
    editEmpId=id;
    const e=id?emps.find(x=>String(x.id)===String(id)):null;
    document.getElementById('empModalTitle').textContent=id?'직원 수정':'직원 등록';
    document.getElementById('empDelBtn').style.display=id?'block':'none';
    document.getElementById('e-name').value=e?.name||'';
    document.getElementById('e-empno').value=e?.empno||`EMP${String(emps.length+1).padStart(3,'0')}`;
    document.getElementById('e-dept').value=e?.dept||'생산부';
    document.getElementById('e-rank').value=e?.rank||'사원';
    document.getElementById('e-joinDate').value=e?.joinDate||today;
    document.getElementById('empModal').classList.add('show');
  }
}
function closeEmpModal(){document.getElementById('empModal').classList.remove('show');editEmpId=null;}
function saveEmp(){
  const name=document.getElementById('e-name').value.trim();
  if(!name){showToast('이름을 입력하세요.');return;}
  const rec={id:editEmpId||nextId++,name,
    empno:document.getElementById('e-empno').value,
    dept:document.getElementById('e-dept').value,
    rank:document.getElementById('e-rank').value,
    joinDate:document.getElementById('e-joinDate').value,
  };
  if(editEmpId){const i=emps.findIndex(x=>String(x.id)===String(editEmpId));if(i>=0)emps[i]=rec;}
  else emps.push(rec);
  save();closeEmpModal();render();showToast('직원 정보가 저장되었습니다.');
}
function deleteEmp(){
  if(!confirm('삭제 시 이수 기록도 모두 삭제됩니다.'))return;
  emps=emps.filter(x=>String(x.id)!==String(editEmpId));
  completions=completions.filter(c=>String(c.empId)!==String(editEmpId));
  save();closeEmpModal();render();
}

function exportCSV(){
  const rows=['이름,사번,부서,직급,'+COURSES.map(c=>c.name).join(',')];
  emps.forEach(e=>{
    const cells=COURSES.map(c=>{const st=getCellStatus(e,c);return st.status==='none'?'미이수':st.text;});
    rows.push(`${e.name},${e.empno},${e.dept},${e.rank},${cells.join(',')}`);
  });
  const blob=new Blob(['﻿'+rows.join('\n')],{type:'text/csv;charset=utf-8;'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='교육이수현황.csv';a.click();
}

render();
