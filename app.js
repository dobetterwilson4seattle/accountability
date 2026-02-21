async function loadData() {
  const res = await fetch('./data.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('Could not load data.json');
  return res.json();
}

function statusLabel(status){
  const map = {
    in_progress: 'In progress',
    completed: 'Completed',
    broken: 'Broken',
    stalled: 'Stalled',
    pending: 'Pending'
  };
  return map[status] || status;
}

function computeScore(promises){
  const total = promises.length || 1;
  const completed = promises.filter(p => p.status === 'completed').length;
  const broken = promises.filter(p => p.status === 'broken').length;

  // Simple “accountability score” heuristic:
  // completed adds +1, broken subtracts 1, normalized to 0..100.
  let raw = (completed - broken) / total;
  let pct = Math.round((raw + 1) * 1); // maps [-1..1] -> [0..100]
  pct = Math.max(0, Math.min(100, pct));

  let label = 'Mixed';
  if (pct >= 67) label = 'Strong';
  else if (pct >= 34) label = 'Moderate';
  else label = 'Weak';

  return { pct, label, completed, broken, total };
}

function setGauge(pct){
  const gauge = document.querySelector('.gauge');
  // red->green gradient feel by switching color at runtime:
  const color = pct >= 67 ? '#27ae60' : (pct >= 34 ? '#1e95d6' : '#ef4b5a');
  gauge.style.background = `conic-gradient(${color} 0deg, ${color} ${pct*3.6}deg, #e8eef7 ${pct*3.6}deg 360deg)`;
  document.getElementById('scoreValue').textContent = `${pct}%`;

  const pill = document.getElementById('scoreLabel');
  pill.textContent = labelFromPct(pct);
  if (pct >= 67){
    pill.style.background = '#dcfce7'; pill.style.color = '#166534';
  } else if (pct >= 34){
    pill.style.background = '#dbeafe'; pill.style.color = '#1e40af';
  } else {
    pill.style.background = '#fee2e2'; pill.style.color = '#b4232d';
  }
}

function labelFromPct(pct){
  if (pct >= 67) return 'Strong';
  if (pct >= 34) return 'Moderate';
  return 'Weak';
}

function renderCards(promises){
  const total = promises.length;
  const inProgress = promises.filter(p => p.status === 'in_progress').length;
  const completed = promises.filter(p => p.status === 'completed').length;
  const broken = promises.filter(p => p.status === 'broken').length;

  const cards = [
    { cls:'bg-total', label:'Total Promises', value: total, sub:'', icon:'◎' },
    { cls:'bg-progress', label:'In Progress', value: inProgress, sub:'', icon:'◷' },
    { cls:'bg-completed', label:'Completed', value: completed, sub:'', icon:'✓' },
    { cls:'bg-broken', label:'Broken', value: broken, sub:'', icon:'✕' },
  ];

  const wrap = document.getElementById('summary-cards');
  wrap.innerHTML = cards.map(c => `
    <div class="card ${c.cls}">
      <div>
        <div class="label">${c.label}</div>
        <div class="value">${c.value}</div>
        <div class="sub">${c.sub}</div>
      </div>
      <div class="icon">${c.icon}</div>
    </div>
  `).join('');
}

function renderCategoryOptions(promises){
  const categories = Array.from(new Set(promises.map(p => p.category))).sort();
  const select = document.getElementById('categorySelect');
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  });
}

function renderTable(promises){
  const tbody = document.getElementById('promiseTbody');
  tbody.innerHTML = promises.map(p => `
    <tr>
      <td><strong>${escapeHtml(p.promise)}</strong></td>
      <td>${escapeHtml(p.category || '')}</td>
      <td><span class="badge ${p.status}">${statusLabel(p.status)}</span></td>
      <td>${escapeHtml(p.target_deadline || p.deadline || '')}</td>
      <td>${p.source_url ? `<a href="${p.source_url}" target="_blank" rel="noopener">link</a>` : ''}</td>
    </tr>
  `).join('');
}

function escapeHtml(str){
  return (str || '').replace(/[&<>"']/g, (m) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[m]));
}

function applyFilters(allPromises){
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  const cat = document.getElementById('categorySelect').value;
  const status = document.getElementById('statusSelect').value;

  return allPromises.filter(p => {
    const matchesQ =
      !q ||
      (p.promise || '').toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q);

    const matchesCat = (cat === 'all') || (p.category === cat);
    const matchesStatus = (status === 'all') || (p.status === status);

    return matchesQ && matchesCat && matchesStatus;
  });
}

async function main(){
  const data = await loadData();
  const promises = data.promises || [];

  // header title personalization
  document.title = `${data.subject || 'Mayor'} Promise Tracker`;
  document.querySelector('h1').textContent = `${data.subject || 'Mayor'} Promise Tracker`;

  renderCards(promises);

  const score = computeScore(promises);
  setGauge(score.pct);

  document.getElementById('scoreDesc').textContent =
    `Based on ${score.completed} completed and ${score.broken} broken promises out of ${score.total} total commitments.`;

  renderCategoryOptions(promises);
  renderTable(promises);

  // Filters
  const rerender = () => renderTable(applyFilters(promises));
  document.getElementById('searchInput').addEventListener('input', rerender);
  document.getElementById('categorySelect').addEventListener('change', rerender);
  document.getElementById('statusSelect').addEventListener('change', rerender);
}

main().catch(err => {
  console.error(err);
  alert('Error loading site data. Check data.json formatting.');
});
