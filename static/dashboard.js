// Scripts



// ======= Demo data generator (TS2000-like financials) =======
  const INDUSTRIES = ["제조", "건설", "서비스", "유통", "IT", "운송", "에너지", "바이오"];
  const rnd = (min, max) => Math.random() * (max - min) + min;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const fmtPct = (v) => (v == null ? "—" : (v*100).toFixed(1)+"%");
  const fmt = (v, dig=1) => v==null?"—":Number(v).toFixed(dig);

  let DEMO_MODE = true; // can be toggled in header

  function generateCompany(i) {
    const ind = INDUSTRIES[i % INDUSTRIES.length];
    const baseDebt = rnd(50, 500); // %
    const baseICR = rnd(0.3, 6.5); // interest coverage ratio
    const p = clamp( (baseDebt/1000) + (1/(baseICR+1.5)) + rnd(-0.1,0.1), 0.01, 0.9 );
    return {
      id: "C" + (1000+i),
      name: `기업 ${String.fromCharCode(65 + (i%26))}-${i}`,
      industry: ind,
      debt_ratio: Number(baseDebt.toFixed(1)),
      icr: Number(baseICR.toFixed(2)),
      default_prob: Number((p).toFixed(3)),
      risk: p>0.35?"High":(p>0.18?"Medium":"Low"),
      quarters: Array.from({length: 8}, (_,k)=>({
        q: `Q${8-k}`,
        debt: clamp(baseDebt + rnd(-40,40), 20, 900),
        icr: clamp(baseICR + rnd(-1.2,1.2), 0.1, 9),
        prob: clamp(p + rnd(-0.1,0.1), 0.01, 0.95)
      }))
    };
  }

  function makePortfolio(n=120) { return Array.from({length:n}, (_,i)=>generateCompany(i)); }

  // ======= State =======
  let state = {
    portfolio: makePortfolio(),
    search: "",
    period: "8Q",
    riskFilter: { High:true, Medium:true, Low:false },
    industries: new Set(INDUSTRIES),
    page: 1,
    pageSize: 25,
    sortBy: "default_prob_desc",
    thresholdICR: true,
    thresholdDebt: true,
    smooth: false
  };

  // ======= UI helpers =======
  const qs = (sel)=>document.querySelector(sel);
  const qsa = (sel)=>Array.from(document.querySelectorAll(sel));

  function toast(msg){
    const host = qs('#toast');
    const el = document.createElement('div');
    el.className='item'; el.textContent = msg;
    host.appendChild(el);
    setTimeout(()=>{ el.style.opacity=0; setTimeout(()=>el.remove(), 400); }, 2000);
  }

  function tagRisk(r){
    const cls = r==='High'? 'tag high' : (r==='Medium'? 'tag medium': 'tag low');
    return `<span class="${cls}">${r}</span>`;
  }

  function calcKPIs(rows){
    const n = rows.length;
    const high = rows.filter(r=>r.risk==='High').length;
    const avgProb = rows.reduce((s,r)=>s+r.default_prob,0)/Math.max(1,n);
    const avgICR = rows.reduce((s,r)=>s+r.icr,0)/Math.max(1,n);
    return { n, high, avgProb, avgICR };
  }

  function updateKPIs(rows){
    const {n, high, avgProb, avgICR} = calcKPIs(rows);
    qs('#kpiTotal').textContent = n.toLocaleString();
    qs('#kpiHigh').textContent = high.toLocaleString();
    qs('#kpiAvgProb').textContent = (avgProb*100).toFixed(1)+'%';
    qs('#kpiICR').textContent = avgICR.toFixed(2);
    // Mock deltas
    qs('#kpiTotalDelta').textContent = '▲ 1.2% QoQ'; qs('#kpiTotalDelta').className='delta up';
    qs('#kpiHighDelta').textContent = '▼ 0.7% QoQ'; qs('#kpiHighDelta').className='delta down';
    qs('#kpiAvgProbDelta').textContent = '▲ 0.3% QoQ'; qs('#kpiAvgProbDelta').className='delta up';
    qs('#kpiICRDelta').textContent = '▼ 0.1 QoQ'; qs('#kpiICRDelta').className='delta down';
  }

  

  // ======= Filters & sorting =======
  function filteredRows(){
    let rows = state.portfolio;
    if(state.search){ rows = rows.filter(r=> r.name.toLowerCase().includes(state.search.toLowerCase())); }
    rows = rows.filter(r=> state.riskFilter[r.risk]);
    rows = rows.filter(r=> state.industries.has(r.industry));
    switch(state.sortBy){
      case 'default_prob_desc': rows = rows.slice().sort((a,b)=>b.default_prob - a.default_prob); break;
      case 'icr_asc': rows = rows.slice().sort((a,b)=>a.icr - b.icr); break;
      case 'debt_desc': rows = rows.slice().sort((a,b)=>b.debt_ratio - a.debt_ratio); break;
      case 'name_asc': rows = rows.slice().sort((a,b)=>a.name.localeCompare(b.name)); break;
    }
    return rows;
  }

  function renderTable(){
    const rows = filteredRows();
    const start = (state.page-1)*state.pageSize;
    const pageRows = rows.slice(start, start+state.pageSize);
    const tbody = qs('#riskTbody');
    tbody.innerHTML = '';
    pageRows.forEach((r, i)=>{
      const tr = document.createElement('tr'); tr.tabIndex=0; tr.setAttribute('role','button');
      tr.innerHTML = `
        <td class="rank">${start + i + 1}</td>
        <td>${r.name}</td>
        <td>${r.industry}</td>
        <td style="text-align:right; color:${r.debt_ratio>400? 'var(--danger)':'inherit'}">${fmt(r.debt_ratio)}</td>
        <td style="text-align:right; color:${r.icr<1? 'var(--danger)':'inherit'}">${fmt(r.icr,2)}</td>
        <td style="text-align:right;">${fmt(r.default_prob*100,1)}</td>
        <td style="text-align:center;">${tagRisk(r.risk)}</td>`;
      tr.addEventListener('click', ()=> openDetail(r));
      tbody.appendChild(tr);
    });
    qs('#tableCount').textContent = rows.length;
    updateKPIs(rows);
    updateAlerts(rows);
  }

  // ======= Charts (overview) =======
  let probLineChart, industryBarChart;

  function buildProbLine(){
    const labels = Array.from({length:8},(_,i)=>`Q${i+1}`);
    const rows = filteredRows();
    const series = labels.map((_,i)=>{
      const s = rows.reduce((acc,r)=>acc + (r.quarters[7-i]?.prob ?? r.default_prob),0);
      return (s / Math.max(1, rows.length))*100;
    });
    const smooth = state.smooth;
    const smoothed = series.map((v,i,arr)=>{
      if(!smooth) return v;
      const window = arr.slice(Math.max(0,i-2), i+1);
      return window.reduce((a,b)=>a+b,0)/window.length;
    });
    const ctx = qs('#probLine');
    if(probLineChart) probLineChart.destroy();
    probLineChart = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [{ label: 'Avg Default Probability', data: smoothed, tension: 0.35, fill: true }] },
      options: {
        plugins: { legend: { display:false } },
        scales: {
          x: { grid: { color: '#1b2330' } },
          y: { grid: { color: '#1b2330' }, ticks: { callback: v=>v+'%' } }
        }
      }
    });
  }

  function buildIndustryBar(){
    const rows = filteredRows();
    const inds = [...state.industries];
    const data = inds.map(ind=>{
      const all = rows.filter(r=>r.industry===ind).length;
      const high = rows.filter(r=>r.industry===ind && r.risk==='High').length;
      return all? (high/all)*100 : 0;
    });
    const ctx = qs('#industryBar');
    if(industryBarChart) industryBarChart.destroy();
    industryBarChart = new Chart(ctx, {
      type: 'bar',
      data: { labels: inds, datasets: [{ label: 'High Risk Share', data }] },
      options: {
        plugins: { legend: { display:false } },
        scales: {
          x: { grid: { color: '#1b2330' } },
          y: { grid: { color: '#1b2330' }, ticks: { callback: v=>v+'%' } }
        }
      }
    });
  }

  // ======= Alerts =======
  function updateAlerts(rows){
    const host = qs('#alertList'); host.innerHTML='';
    const redICR = rows.filter(r=>r.icr<1).slice(0,5);
    const highDebt = rows.filter(r=>r.debt_ratio>400).slice(0,5);
    const highRaise = rows.filter(r=> (r.quarters[7].prob - r.quarters[6].prob) > 0.08).slice(0,5);
    const bullet = (txt)=>{ const li=document.createElement('li'); li.innerHTML=txt; host.appendChild(li); };
    if(qs('#threshICR').checked && redICR.length) bullet(`ICR&lt;1 기업: <strong>${redICR.length}</strong> (예: ${redICR.map(r=>r.name).slice(0,3).join(', ')} …)`);
    if(qs('#threshDebt').checked && highDebt.length) bullet(`부채비율&gt;400% 기업: <strong>${highDebt.length}</strong> (예: ${highDebt.map(r=>r.name).slice(0,3).join(', ')} …)`);
    if(highRaise.length) bullet(`예측 부실확률 급등(>+8%p QoQ): <strong>${highRaise.length}</strong>곳 감지`);
    if(!host.children.length){ const li=document.createElement('li'); li.textContent='현재 규칙 기반 경보 없음'; host.appendChild(li); }
  }

  // ======= Detail Modal =======
  let detailLine, detailProb;
  function openDetail(r){
    qs('#modal').style.display='flex';
    qs('#modalTitle').textContent = `${r.name} · ${r.industry}`;
    const meta = qs('#companyMeta');
    meta.innerHTML = `
      <div class="kpi"><h4>부채비율(%)</h4><div class="val">${fmt(r.debt_ratio)}</div></div>
      <div class="kpi"><h4>이자보상배율</h4><div class="val">${fmt(r.icr,2)}</div></div>
      <div class="kpi"><h4>부실확률</h4><div class="val">${fmt(r.default_prob*100,1)}%</div></div>
      <div class="kpi"><h4>위험등급</h4><div class="val">${tagRisk(r.risk)}</div></div>`;
    const labels = r.quarters.map(q=>q.q).reverse();
    const debt = r.quarters.map(q=>q.debt).reverse();
    const icr = r.quarters.map(q=>q.icr).reverse();
    const prob = r.quarters.map(q=>q.prob*100).reverse();
    if(detailLine) detailLine.destroy();
    detailLine = new Chart(qs('#detailLine'), {
      type:'line', data: { labels, datasets:[{label:'부채비율(%)', data:debt, tension:.35, fill:true}, {label:'ICR', data:icr, yAxisID:'y1', tension:.35}]},
      options:{ plugins:{legend:{display:true}}, scales:{ x:{grid:{color:'#1b2330'}}, y:{grid:{color:'#1b2330'}, position:'left'}, y1:{grid:{display:false}, position:'right'} } }
    });
    if(detailProb) detailProb.destroy();
    detailProb = new Chart(qs('#detailProb'), {
      type:'line', data:{ labels, datasets:[{label:'부실확률(%)', data:prob, tension:.3, fill:true}] },
      options:{ plugins:{legend:{display:false}}, scales:{ x:{grid:{color:'#1b2330'}}, y:{grid:{color:'#1b2330'}, ticks:{callback:v=>v+'%'} } } }
    });
  }
  qs('#closeModal').addEventListener('click', ()=> qs('#modal').style.display='none');
  qs('#modal').addEventListener('click', (e)=>{ if(e.target.id==='modal') qs('#modal').style.display='none'; });




  // ======= Export CSV =======
  function exportCSV(){
    const rows = filteredRows();
    const header = ['corp_id','name','industry','debt_ratio','icr','default_prob','risk'];
    const lines = [header.join(',')].concat(rows.map(r=>[
      r.id, r.name, r.industry, r.debt_ratio, r.icr, r.default_prob, r.risk
    ].join(',')));
    const blob = new Blob(["\ufeff" + lines.join('\n')], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='ews_portfolio.csv'; a.click();
    URL.revokeObjectURL(url);
    toast('CSV가 다운로드되었습니다.');
  }

  // ======= Industry chips =======
  function renderIndustryChips(){
    const host = qs('#industryChips'); host.innerHTML='';
    INDUSTRIES.forEach(ind=>{
      const el = document.createElement('label'); el.className='chip';
      const ck = document.createElement('input'); ck.type='checkbox'; ck.checked = state.industries.has(ind);
      ck.addEventListener('change', ()=>{ if(ck.checked) state.industries.add(ind); else state.industries.delete(ind); rerender(); });
      el.appendChild(ck); el.append(` ${ind}`);
      host.appendChild(el);
    });
  }

  // ======= Rerender =======
  function rerender(){ renderTable(); buildProbLine(); buildIndustryBar(); }

  // ======= Init =======
  function init(){
    renderIndustryChips();
    // Hook controls
    qs('#search').addEventListener('input', e=>{ state.search = e.target.value.trim(); if(qs('#autoRefresh').checked) rerender(); });
    qs('#period').addEventListener('change', e=>{ state.period = e.target.value; toast('기간이 변경되었습니다. (데모)'); });
    qs('#pageSize').addEventListener('change', e=>{ state.pageSize = parseInt(e.target.value,10); state.page=1; rerender(); });
    qs('#sortBy').addEventListener('change', e=>{ state.sortBy = e.target.value; rerender(); });
    qs('#prevPage').addEventListener('click', ()=>{ state.page = Math.max(1, state.page-1); renderTable(); });
    qs('#nextPage').addEventListener('click', ()=>{ const maxPage = Math.ceil(filteredRows().length/state.pageSize); state.page = Math.min(maxPage, state.page+1); renderTable(); });
    qs('#exportBtn').addEventListener('click', exportCSV);
    qs('#refreshBtn').addEventListener('click', ()=>{ toast('새로고침 완료 (데모 데이터)'); rerender(); });
    qs('#demoToggle').addEventListener('click', ()=>{ DEMO_MODE=!DEMO_MODE; qs('#demoToggle').textContent = DEMO_MODE? '데모데이터 ON' : '데모데이터 OFF'; toast('데모 토글: 실제 API 연동 시 이 스위치를 끄세요.'); });
    qs('#fltHigh').addEventListener('change', e=>{ state.riskFilter.High = e.target.checked; rerender(); });
    qs('#fltMed').addEventListener('change', e=>{ state.riskFilter.Medium = e.target.checked; rerender(); });
    qs('#fltLow').addEventListener('change', e=>{ state.riskFilter.Low = e.target.checked; rerender(); });
    qs('#btnSmooth').addEventListener('click', ()=>{ state.smooth=!state.smooth; rerender(); });

    // First render
    rerender();
  }

  // ======= (Optional) Real API wiring example =======
  async function fetchPortfolioFromAPI(){
    const r = await fetch('/api/portfolio', { headers: { 'Accept': 'application/json' } });
    if (!r.ok) throw new Error(await r.text());
    const data = await r.json();
    state.portfolio = data;   // ← 여기!
    state.page = 1;
    rerender();
  }

  window.addEventListener('DOMContentLoaded', init);


