// 월간 생산 보고서 앱 스크립트
const today=new Date().toISOString().slice(0,10);
const thisYear=parseInt(today.slice(0,4));
const thisMonth=parseInt(today.slice(5,7));

const ys=document.getElementById('yearSel');
for(let y=thisYear-2;y<=thisYear;y++) ys.innerHTML+=`<option value="${y}" ${y===thisYear?'selected':''}>${y}년</option>`;
document.getElementById('monthSel').value=String(thisMonth);

const LINES=['1호기','2호기','3호기','4호기'];
const LINE_COLORS=['#2563eb','#059669','#d97706','#7c3aed'];

function genMonthData(year,month){
  const days=new Date(year,month,0).getDate();
  const lineData=LINES.map((l,li)=>{
    const target=Math.round((800+li*100+Math.random()*100)/10)*10;
    const produced=Math.round(target*(0.9+Math.random()*0.15));
    const good=Math.round(produced*(0.975+Math.random()*0.02));
    const claims=Math.floor(Math.random()*3);
    return {line:l,target,produced,good,defect:produced-good,
      yieldRate:(good/produced*100).toFixed(1),
      achieveRate:(produced/target*100).toFixed(1),
      uptime:(92+Math.random()*7).toFixed(1),
      claims,
    };
  });
  const defectTypes=[
    {name:'단락(Short)',cnt:Math.floor(Math.random()*30)+10},
    {name:'개방(Open)',cnt:Math.floor(Math.random()*20)+5},
    {name:'기공(Void)',cnt:Math.floor(Math.random()*15)+3},
    {name:'박리',cnt:Math.floor(Math.random()*12)+2},
    {name:'치수불량',cnt:Math.floor(Math.random()*10)+1},
    {name:'기타',cnt:Math.floor(Math.random()*8)+1},
  ].sort((a,b)=>b.cnt-a.cnt);
  const totDefect=defectTypes.reduce((s,d)=>s+d.cnt,0);
  let cum=0;
  defectTypes.forEach(d=>{cum+=d.cnt;d.cumPct=Math.round(cum/totDefect*100);d.pct=Math.round(d.cnt/totDefect*100);});

  const dailyData=Array.from({length:days},(_,i)=>{
    const day=i+1;const dow=new Date(year,month-1,day).getDay();
    if(dow===0||dow===6) return null;
    return {day,produced:LINES.reduce((s,l,li)=>s+Math.round((lineData[li].produced/days)*(0.85+Math.random()*.3)),0),good:0,yieldRate:0};
  }).filter(Boolean);
  dailyData.forEach(d=>{d.good=Math.round(d.produced*0.976);d.yieldRate=(d.good/d.produced*100).toFixed(1);});

  const total={
    target:lineData.reduce((s,l)=>s+l.target,0),
    produced:lineData.reduce((s,l)=>s+l.produced,0),
    good:lineData.reduce((s,l)=>s+l.good,0),
    defect:lineData.reduce((s,l)=>s+l.defect,0),
    claims:lineData.reduce((s,l)=>s+l.claims,0),
  };
  total.yieldRate=(total.good/total.produced*100).toFixed(1);
  total.achieveRate=(total.produced/total.target*100).toFixed(1);

  const prevProduced=total.produced*(0.92+Math.random()*0.1);
  const prevYield=parseFloat(total.yieldRate)-0.3+Math.random()*0.6;
  const prevAchieve=(parseFloat(total.achieveRate)-2+Math.random()*4).toFixed(1);
  const prevClaims=total.claims+Math.floor(Math.random()*3)-1;

  return {year,month,lineData,defectTypes,dailyData,total,
    prevProduced:Math.round(prevProduced),prevYield:prevYield.toFixed(1),
    prevAchieve,prevClaims:Math.max(0,prevClaims)};
}

let charts={};
function destroyCharts(){Object.values(charts).forEach(c=>{if(c)c.destroy();});charts={};}

/* 미션1: 양품률 미달 경보 배너 */
function renderYieldAlertBanner(total){
  const banner=document.getElementById('yieldAlertBanner');
  const parts=[];
  if(parseFloat(total.yieldRate)<98)
    parts.push(`<span>양품률 미달</span> 종합 양품률 ${total.yieldRate}%가 목표(98.0%)에 미달합니다.`);
  if(parseFloat(total.achieveRate)<95)
    parts.push(`<span>달성률 미달</span> 계획 달성률 ${total.achieveRate}%가 목표(95.0%)에 미달합니다.`);
  if(parts.length===0){banner.style.display='none';return;}
  banner.innerHTML='⚠ '+parts.join(' &nbsp;|&nbsp; ');
  banner.style.display='flex';
}

/* 미션3: 라인별 이상 감지 뱃지 HTML */
function getLineBadge(l){
  const badges=[];
  if(parseFloat(l.uptime)<95) badges.push(`<span class="line-alarm">가동↓${l.uptime}%</span>`);
  if(parseFloat(l.achieveRate)<95) badges.push(`<span class="line-warn">달성↓${l.achieveRate}%</span>`);
  return badges.join('');
}

function render(){
  destroyCharts();
  const year=parseInt(document.getElementById('yearSel').value);
  const month=parseInt(document.getElementById('monthSel').value);
  const data=genMonthData(year,month);
  const {total,lineData,defectTypes,dailyData}=data;
  const prodVs=((total.produced-data.prevProduced)/data.prevProduced*100).toFixed(1);
  const yieldVs=(parseFloat(total.yieldRate)-parseFloat(data.prevYield)).toFixed(1);

  renderYieldAlertBanner(total);

  /* 미션2: 전월 대비 성과 비교 테이블 */
  const compareTable=`
    <table class="compare-table">
      <thead><tr><th>지표</th><th>당월</th><th>전월</th><th>증감</th></tr></thead>
      <tbody>
        <tr><td>총 생산량 (매)</td><td style="font-weight:700;color:var(--blue)">${total.produced.toLocaleString()}</td><td>${data.prevProduced.toLocaleString()}</td>
          <td style="font-weight:700;color:${prodVs>=0?'var(--green)':'var(--red)'}">${prodVs>=0?'▲':'▼'}${Math.abs(prodVs)}%</td></tr>
        <tr><td>종합 양품률 (%)</td><td style="font-weight:700;color:${parseFloat(total.yieldRate)>=98?'var(--green)':'var(--red)'}">${total.yieldRate}%</td><td>${data.prevYield}%</td>
          <td style="font-weight:700;color:${yieldVs>=0?'var(--green)':'var(--red)'}">${yieldVs>=0?'▲':'▼'}${Math.abs(yieldVs)}%p</td></tr>
        <tr><td>계획 달성률 (%)</td><td style="font-weight:700;color:${parseFloat(total.achieveRate)>=100?'var(--green)':'var(--amber)'}">${total.achieveRate}%</td><td>${data.prevAchieve}%</td>
          <td style="font-weight:700;color:${parseFloat(total.achieveRate)>=parseFloat(data.prevAchieve)?'var(--green)':'var(--red)'}">${parseFloat(total.achieveRate)>=parseFloat(data.prevAchieve)?'▲':'▼'}${Math.abs((parseFloat(total.achieveRate)-parseFloat(data.prevAchieve)).toFixed(1))}%p</td></tr>
        <tr><td>고객 클레임 (건)</td><td style="font-weight:700;color:${total.claims===0?'var(--green)':total.claims<=2?'var(--amber)':'var(--red)'}">${total.claims}</td><td>${data.prevClaims}</td>
          <td style="font-weight:700;color:${total.claims<=data.prevClaims?'var(--green)':'var(--red)'}">${total.claims<=data.prevClaims?'▼':'▲'}${Math.abs(total.claims-data.prevClaims)}</td></tr>
      </tbody>
    </table>`;

  document.getElementById('reportBody').innerHTML=`
    <div class="cover">
      <div class="cover-title">${year}년 ${month}월 월간 생산 보고서</div>
      <div class="cover-sub">PCB Manufacturing Co., Ltd. — 생산관리팀</div>
      <div class="cover-meta">
        <div class="cover-meta-item"><b>${total.produced.toLocaleString()}</b>총 생산량(매)</div>
        <div class="cover-meta-item"><b>${total.yieldRate}%</b>종합 양품률</div>
        <div class="cover-meta-item"><b>${total.achieveRate}%</b>계획 달성률</div>
        <div class="cover-meta-item"><b>${total.claims}</b>고객 클레임</div>
        <div class="cover-meta-item"><b>${today}</b>작성일</div>
      </div>
    </div>

    <div class="sec-title">핵심 생산 지표</div>
    <div class="kpi-grid">
      <div class="kpi-card" style="border-top-color:var(--blue)">
        <div class="kpi-label">총 생산량</div><div class="kpi-val" style="color:var(--blue)">${total.produced.toLocaleString()}</div>
        <div class="kpi-unit">매</div><div class="kpi-vs ${prodVs>=0?'up':'down'}">${prodVs>=0?'▲':'▼'}${Math.abs(prodVs)}% 전월比</div>
      </div>
      <div class="kpi-card" style="border-top-color:var(--green)">
        <div class="kpi-label">총 양품수</div><div class="kpi-val" style="color:var(--green)">${total.good.toLocaleString()}</div><div class="kpi-unit">매</div>
      </div>
      <div class="kpi-card" style="border-top-color:var(--red)">
        <div class="kpi-label">총 불량수</div><div class="kpi-val" style="color:var(--red)">${total.defect.toLocaleString()}</div><div class="kpi-unit">매</div>
      </div>
      <div class="kpi-card" style="border-top-color:${parseFloat(total.yieldRate)>=98?'var(--green)':parseFloat(total.yieldRate)>=97?'var(--amber)':'var(--red)'}">
        <div class="kpi-label">종합 양품률</div>
        <div class="kpi-val" style="color:${parseFloat(total.yieldRate)>=98?'var(--green)':parseFloat(total.yieldRate)>=97?'var(--amber)':'var(--red)'}">${total.yieldRate}</div>
        <div class="kpi-unit">%</div><div class="kpi-vs ${yieldVs>=0?'up':'down'}">${yieldVs>=0?'▲':'▼'}${Math.abs(yieldVs)}%p 전월比</div>
      </div>
      <div class="kpi-card" style="border-top-color:${parseFloat(total.achieveRate)>=100?'var(--green)':parseFloat(total.achieveRate)>=95?'var(--amber)':'var(--red)'}">
        <div class="kpi-label">계획 달성률</div>
        <div class="kpi-val" style="color:${parseFloat(total.achieveRate)>=100?'var(--green)':parseFloat(total.achieveRate)>=95?'var(--amber)':'var(--red)'}">${total.achieveRate}</div><div class="kpi-unit">%</div>
      </div>
      <div class="kpi-card" style="border-top-color:${total.claims===0?'var(--green)':total.claims<=2?'var(--amber)':'var(--red)'}">
        <div class="kpi-label">고객 클레임</div>
        <div class="kpi-val" style="color:${total.claims===0?'var(--green)':total.claims<=2?'var(--amber)':'var(--red)'}">${total.claims}</div><div class="kpi-unit">건</div>
      </div>
    </div>

    <div class="sec-title">생산 추이 분석</div>
    <div class="chart-grid">
      <div class="panel">
        <div class="panel-title">일별 생산량 & 양품률 추이</div>
        <div class="chart-h200"><canvas id="dailyChart"></canvas></div>
      </div>
      <div class="panel">
        <div class="panel-title">불량 유형 파레토</div>
        <div class="chart-h200"><canvas id="paretoChart"></canvas></div>
      </div>
    </div>

    <div class="sec-title">라인별 생산 성과</div>
    <div class="chart-grid">
      <div class="panel">
        <div class="panel-title">라인별 성과 요약</div>
        <table class="perf-table">
          <thead><tr><th>라인</th><th>계획</th><th>생산</th><th>불량</th><th>양품률</th><th>달성률</th><th>가동률</th><th>클레임</th></tr></thead>
          <tbody>
            ${lineData.map((l,i)=>`
              <tr>
                <td style="font-weight:700;color:${LINE_COLORS[i]}">${l.line}${getLineBadge(l)}</td>
                <td>${l.target.toLocaleString()}</td><td>${l.produced.toLocaleString()}</td>
                <td style="color:var(--red)">${l.defect.toLocaleString()}</td>
                <td style="font-weight:700;color:${parseFloat(l.yieldRate)>=98?'var(--green)':'var(--amber)'}">${l.yieldRate}%</td>
                <td style="font-weight:700;color:${parseFloat(l.achieveRate)>=100?'var(--green)':'var(--amber)'}">${l.achieveRate}%</td>
                <td>${l.uptime}%</td>
                <td style="color:${l.claims>0?'var(--red)':''}">${l.claims}</td>
              </tr>`).join('')}
            <tr>
              <td><b>합계</b></td>
              <td><b>${total.target.toLocaleString()}</b></td><td><b>${total.produced.toLocaleString()}</b></td>
              <td><b style="color:var(--red)">${total.defect.toLocaleString()}</b></td>
              <td><b style="color:${parseFloat(total.yieldRate)>=98?'var(--green)':'var(--amber)'}">${total.yieldRate}%</b></td>
              <td><b style="color:${parseFloat(total.achieveRate)>=100?'var(--green)':'var(--amber)'}">${total.achieveRate}%</b></td>
              <td>-</td>
              <td><b style="color:${total.claims>0?'var(--red)':''}">${total.claims}</b></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="panel">
        <div class="panel-title">라인별 생산량 비교</div>
        <div class="chart-h200"><canvas id="lineChart"></canvas></div>
      </div>
    </div>

    <div class="chart-grid2">
      <div class="panel">
        <div class="panel-title">불량 유형별 현황</div>
        <table class="def-table">
          <thead><tr><th>불량 유형</th><th style="text-align:right">건수</th><th style="text-align:right">비율</th><th style="text-align:right">누적</th></tr></thead>
          <tbody>
            ${defectTypes.map((d,i)=>`
              <tr>
                <td>${i===0?'🔴 ':i<=1?'🟠 ':'⚫ '}${d.name}</td>
                <td style="text-align:right;font-weight:700">${d.cnt}</td>
                <td style="text-align:right">${d.pct}%</td>
                <td style="text-align:right;color:${d.cumPct<=80?'var(--red)':'var(--mute)'};font-weight:${d.cumPct<=80?700:400}">${d.cumPct}%</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="panel">
        <div class="panel-title">당월 생산 달성 현황</div>
        <div class="chart-h160"><canvas id="gaugeChart"></canvas></div>
      </div>
      <div class="panel">
        <div class="panel-title">종합 의견 및 차월 중점 과제</div>
        <div class="highlight-box">📈 <b>당월 성과:</b> 총 ${total.produced.toLocaleString()}매 생산, 계획 대비 ${total.achieveRate}% 달성. 전월 대비 생산량 ${prodVs>=0?'증가':'감소'} ${Math.abs(prodVs)}%.</div>
        <div class="highlight-box" style="border-color:${parseFloat(total.yieldRate)>=98?'var(--green)':'var(--red)'}">
          ${parseFloat(total.yieldRate)>=98?'✅':'⚠'} <b>품질 현황:</b> 종합 양품률 ${total.yieldRate}% (목표 98.0%). 주요 불량은 ${defectTypes[0].name}(${defectTypes[0].pct}%).
        </div>
        <div class="highlight-box" style="border-color:var(--amber)">📋 <b>차월 과제:</b> ${defectTypes[0].name} 집중 개선, 공정 파라미터 최적화, 설비 PM 일정 준수.</div>
      </div>
    </div>

    <div class="sec-title">전월 대비 성과 비교</div>
    <div class="panel" style="margin-bottom:20px">${compareTable}</div>`;

  const labels=dailyData.map(d=>`${d.day}일`);
  charts.daily=new Chart(document.getElementById('dailyChart'),{
    type:'bar',
    data:{labels,datasets:[
      {type:'bar',label:'생산량',data:dailyData.map(d=>d.produced),backgroundColor:'rgba(37,99,235,.6)',yAxisID:'y'},
      {type:'line',label:'양품률(%)',data:dailyData.map(d=>d.yieldRate),borderColor:'#059669',backgroundColor:'transparent',pointRadius:2,yAxisID:'y2',tension:.4},
    ]},
    options:{responsive:true,maintainAspectRatio:false,
      scales:{y:{beginAtZero:true,title:{display:true,text:'생산량(매)',font:{size:10}}},
        y2:{position:'right',min:95,max:100,title:{display:true,text:'양품률(%)',font:{size:10}},grid:{display:false}}},
      plugins:{legend:{position:'top',labels:{boxWidth:10,font:{size:10}}}}},
  });

  charts.pareto=new Chart(document.getElementById('paretoChart'),{
    type:'bar',
    data:{labels:defectTypes.map(d=>d.name),datasets:[
      {type:'bar',label:'건수',data:defectTypes.map(d=>d.cnt),backgroundColor:'rgba(220,38,38,.7)',yAxisID:'y'},
      {type:'line',label:'누적%',data:defectTypes.map(d=>d.cumPct),borderColor:'#2563eb',pointRadius:4,yAxisID:'y2'},
    ]},
    options:{responsive:true,maintainAspectRatio:false,
      scales:{y:{beginAtZero:true},y2:{position:'right',min:0,max:100,grid:{display:false}}},
      plugins:{legend:{position:'top',labels:{boxWidth:10,font:{size:10}}}}},
  });

  charts.line=new Chart(document.getElementById('lineChart'),{
    type:'bar',
    data:{labels:LINES,datasets:[
      {label:'계획',data:lineData.map(l=>l.target),backgroundColor:'rgba(100,116,139,.3)',borderColor:'#64748b',borderWidth:1},
      {label:'생산',data:lineData.map(l=>l.produced),backgroundColor:LINE_COLORS.map(c=>c+'cc'),borderColor:LINE_COLORS,borderWidth:1},
    ]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{position:'top',labels:{boxWidth:10,font:{size:10}}}}},
  });

  charts.gauge=new Chart(document.getElementById('gaugeChart'),{
    type:'doughnut',
    data:{labels:['달성','미달'],datasets:[{data:[parseFloat(total.achieveRate),Math.max(0,100-parseFloat(total.achieveRate))],backgroundColor:[parseFloat(total.achieveRate)>=100?'#059669':'#2563eb','#e2e8f0'],borderWidth:0,cutout:'78%'}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:i=>i.label==='달성'?`달성: ${total.achieveRate}%`:``}}}},
    plugins:[{id:'center',beforeDraw(c){const{width:w,height:h,ctx}=c;ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';const y=h/2+8;ctx.font=`bold 1.3rem sans-serif`;ctx.fillStyle=parseFloat(total.achieveRate)>=100?'#059669':'#2563eb';ctx.fillText(`${total.achieveRate}%`,w/2,y-8);ctx.font=`.65rem sans-serif`;ctx.fillStyle='#a0aec0';ctx.fillText('계획달성률',w/2,y+16);ctx.restore();}}],
  });
}

function exportCSV(){
  const year=parseInt(document.getElementById('yearSel').value);
  const month=parseInt(document.getElementById('monthSel').value);
  const data=genMonthData(year,month);
  const rows=['구분,라인,계획,생산,양품,불량,양품률,달성률,클레임'];
  data.lineData.forEach(l=>rows.push(`라인별,${l.line},${l.target},${l.produced},${l.good},${l.defect},${l.yieldRate}%,${l.achieveRate}%,${l.claims}`));
  rows.push(`합계,,${data.total.target},${data.total.produced},${data.total.good},${data.total.defect},${data.total.yieldRate}%,${data.total.achieveRate}%,${data.total.claims}`);
  const blob=new Blob(['﻿'+rows.join('\n')],{type:'text/csv;charset=utf-8;'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${year}년${month}월_생산보고서.csv`;a.click();
}

render();
