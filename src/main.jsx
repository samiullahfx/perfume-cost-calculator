import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const sizes = [6, 10, 12, 20, 30, 50, 100];
const moqs = [50, 100, 500, 1000];
const packs = [100, 500, 1000];
const concentrations = [10, 15, 20, 25, 30, 40, 50, 100];
const sellingDaysPerMonth = 25;
const sellingPriceOptions = [99, 149, 199, 249, 299, 349, 399, 449, 499, 549, 599, 649, 699, 749, 799, 849, 899, 949, 999];
const defaultSellingPrice = 399;
const salesPeriods = [{value:'7',label:'Last 7 days'},{value:'30',label:'Last 30 days'},{value:'90',label:'Last 90 days'},{value:'all',label:'All time'}];
const defaultInputs = {
  oilPrices: {100: 0, 500: 0, 1000: 0},
  basePerMl: 0,
  otherPerUnit: 0,
  targetMargin: 40,
  selectedMoq: Object.fromEntries(sizes.map(s => [s, 100])),
  bottles: Object.fromEntries(sizes.map(s => [s, {50:0,100:0,500:0,1000:0}])),
  packaging: Object.fromEntries(sizes.map(s => [s, 0])),
  sellingPrices: Object.fromEntries(sizes.map(s => [s, 0])),
  monthlyFixedCosts: 0,
  monthlyTargetProfit: 0,
  monthlyUnits: 100,
  productName: 'Signature Perfume'
};
const cloneDefaultInputs = () => structuredClone(defaultInputs);
const mergeInputs = (target, source) => {
  if (!source || typeof source !== 'object') return target;
  Object.entries(source).forEach(([key, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value) && target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
      target[key] = mergeInputs(target[key], value);
      return;
    }
    target[key] = structuredClone(value);
  });
  return target;
};
const money = n => new Intl.NumberFormat('en-IN', {style:'currency', currency:'INR', maximumFractionDigits:2}).format(Number.isFinite(n) ? n : 0);
const number = n => new Intl.NumberFormat('en-IN', {maximumFractionDigits:2}).format(Number.isFinite(n) ? n : 0);
const closestSellingPrice = value => {
  const price = Number(value);
  if (!Number.isFinite(price)) return defaultSellingPrice;
  return sellingPriceOptions.reduce((closest, option) =>
    Math.abs(option - price) < Math.abs(closest - price) ? option : closest
  );
};
const localDateString = date => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
function loadSales() {
  try {
    const stored = JSON.parse(localStorage.getItem('perfume-cost-sales') || '[]');
    return Array.isArray(stored) ? stored.filter(sale =>
      sale && typeof sale.id === 'string' && typeof sale.productName === 'string' &&
      (sale.productType === 'spray' || sale.productType === 'attar') &&
      typeof sale.saleDate === 'string' && Number.isFinite(Number(sale.quantity)) &&
      Number(sale.quantity) > 0 && Number.isFinite(Number(sale.unitPrice)) && Number(sale.unitPrice) >= 0
    ) : [];
  }
  catch {
    return [];
  }
}
function calculateUnitCost({inputs, size, concentration, oilPack, productType}) {
  const oilMl = size * concentration / 100;
  const baseMl = Math.max(0, size - oilMl);
  const oilPerMl = Number(inputs.oilPrices[oilPack] || 0) / oilPack;
  const bottleCost = Number(inputs.bottles[size]?.[inputs.selectedMoq[size]] || 0);
  const packagingCost = Number(inputs.packaging[size] || 0);
  const baseCost = productType === 'attar' ? 0 : baseMl * Number(inputs.basePerMl || 0);
  const oilCost = oilMl * oilPerMl;
  const other = Number(inputs.otherPerUnit || 0);
  return {
    oilMl,
    baseMl: productType === 'attar' ? 0 : baseMl,
    oilCost,
    baseCost,
    bottleCost,
    packagingCost,
    other,
    total: oilCost + baseCost + bottleCost + packagingCost + other
  };
}
function CostCompositionChart({cost}) {
  const items = [
    {label: 'Perfume oil', value: cost.oilCost, color: '#8d6aa5'},
    {label: 'Base / alcohol', value: cost.baseCost, color: '#c99c62'},
    {label: 'Empty bottle', value: cost.bottleCost, color: '#5e9b78'},
    {label: 'Packaging', value: cost.packagingCost, color: '#648bb2'},
    {label: 'Other costs', value: cost.other, color: '#c96f78'}
  ];
  const chartItems = items.filter(item => item.value > 0);
  const chartTotal = chartItems.reduce((sum, item) => sum + item.value, 0);
  const circumference = 2 * Math.PI * 43;
  let offset = 0;

  return <div className="cost-chart-layout">
    <svg className="cost-donut" viewBox="0 0 120 120" role="img" aria-label={`Unit cost composition totaling ${money(cost.total)}`}>
      <circle cx="60" cy="60" r="43" fill="none" stroke="#eee8ef" strokeWidth="14" />
      {chartItems.map(item => {
        const length = item.value / chartTotal * circumference;
        const segment = <circle key={item.label} cx="60" cy="60" r="43" fill="none" stroke={item.color} strokeWidth="14" strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-offset} transform="rotate(-90 60 60)" />;
        offset += length;
        return segment;
      })}
      <text x="60" y="56" textAnchor="middle" className="donut-caption">Unit cost</text>
      <text x="60" y="70" textAnchor="middle" className="donut-total">{money(cost.total)}</text>
    </svg>
    <div className="chart-legend">{items.map(item=><div key={item.label}><span className="legend-dot" style={{backgroundColor:item.color}}/><span>{item.label}</span><b>{money(item.value)}</b></div>)}</div>
  </div>;
}
function MonthlyForecastChart({data}) {
  const values = data.map(item => item.value);
  const minimum = Math.min(0, ...values);
  const maximum = Math.max(0, ...values);
  const range = maximum - minimum || 1;
  const chartTop = 18;
  const chartHeight = 150;
  const zeroY = chartTop + maximum / range * chartHeight;
  const barWidth = 58;
  const positions = [55, 205, 355, 505];
  const yForValue = value => chartTop + (maximum - value) / range * chartHeight;

  return <div className="forecast-chart-wrap">
    <svg className="forecast-chart" viewBox="0 0 620 215" role="img" aria-label="Monthly revenue, variable costs, fixed costs, and estimated profit comparison">
      {[0, 1, 2, 3, 4].map(tick => {
        const y = chartTop + chartHeight * tick / 4;
        return <line key={tick} x1="30" x2="590" y1={y} y2={y} className="chart-grid-line" />;
      })}
      <line x1="30" x2="590" y1={zeroY} y2={zeroY} className="chart-zero-line" />
      {data.map((item, index) => {
        const valueY = yForValue(item.value);
        const top = Math.min(zeroY, valueY);
        const height = Math.max(1, Math.abs(valueY - zeroY));
        const x = positions[index];
        return <g key={item.label}>
          <rect x={x} y={top} width={barWidth} height={height} rx="5" fill={item.color}>
            <title>{`${item.label}: ${money(item.value)}`}</title>
          </rect>
          <text x={x + barWidth / 2} y="198" textAnchor="middle" className="chart-axis-label">{item.shortLabel}</text>
        </g>;
      })}
    </svg>
    <div className="chart-legend forecast-legend">{data.map(item=><div key={item.label}><span className="legend-dot" style={{backgroundColor:item.color}}/><span>{item.label}</span><b>{money(item.value)}</b></div>)}</div>
  </div>;
}
function loadInputs() {
  try {
    const stored = JSON.parse(localStorage.getItem('perfume-cost-inputs') || '{}');
    return mergeInputs(cloneDefaultInputs(), stored);
  }
  catch {
    return cloneDefaultInputs();
  }
}
function App() {
  const [inputs, setInputs] = useState(loadInputs);
  const [page, setPage] = useState('calculator');
  const [size, setSize] = useState(50);
  const [concentration, setConcentration] = useState(20);
  const [oilPack, setOilPack] = useState(500);
  const [sellingPrice, setSellingPrice] = useState(() => {
    const savedPrice = Number(inputs.sellingPrices[50]);
    return savedPrice > 0 ? closestSellingPrice(savedPrice) : defaultSellingPrice;
  });
  const [quantity, setQuantity] = useState(1);
  const [productType, setProductType] = useState('spray');
  const [sales, setSales] = useState(loadSales);
  const [salesPeriod, setSalesPeriod] = useState('30');
  const [saleForm, setSaleForm] = useState(() => ({
    productName: inputs.productName,
    productType,
    bottleSize: size,
    quantity: 1,
    unitPrice: sellingPrice,
    saleDate: localDateString(new Date())
  }));
  const [salesNotice, setSalesNotice] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => { localStorage.setItem('perfume-cost-inputs', JSON.stringify(inputs)); }, [inputs]);
  useEffect(() => { localStorage.setItem('perfume-cost-sales', JSON.stringify(sales)); }, [sales]);
  const update = (fn) => setInputs(prev => fn(structuredClone(prev)));
  const setField = (key, value) => update(d => { d[key] = value; return d; });
  const setCurrentSellingPrice = value => {
    const price = closestSellingPrice(value);
    setSellingPrice(price);
    update(d => { d.sellingPrices[size] = price; return d; });
  };
  const changeSize = value => {
    const nextSize = Number(value);
    const currentPrice = closestSellingPrice(sellingPrice);
    update(d => { d.sellingPrices[size] = currentPrice; return d; });
    setSize(nextSize);
    const savedPrice = Number(inputs.sellingPrices[nextSize] || 0);
    setSellingPrice(savedPrice > 0 ? closestSellingPrice(savedPrice) : currentPrice);
  };
  const unitCost = useMemo(() => {
    return calculateUnitCost({inputs, size, concentration, oilPack, productType});
  }, [size, concentration, oilPack, productType, inputs]);
  const missingOilPrice = Number(inputs.oilPrices[oilPack] || 0) <= 0;
  const missingBottlePrice = Number(inputs.bottles[size]?.[inputs.selectedMoq[size]] || 0) <= 0;
  const bulkPreview = sizes.map(bottleSize => {
    const cost = calculateUnitCost({inputs, size: bottleSize, concentration, oilPack, productType});
    const moq = Number(inputs.selectedMoq[bottleSize] || moqs[0]);
    return {
      size: bottleSize,
      moq,
      cost,
      batchCost: cost.total * moq,
      purchaseOutlay: Number(inputs.oilPrices[oilPack] || 0) + cost.bottleCost * moq,
      oilStockBottles: cost.oilMl > 0 ? Math.floor(oilPack / cost.oilMl) : 0
    };
  });
  const profit = sellingPrice - unitCost.total;
  const margin = sellingPrice > 0 ? profit / sellingPrice * 100 : 0;
  const markup = unitCost.total > 0 ? profit / unitCost.total * 100 : 0;
  const suggestedPrice = unitCost.total / (1 - Math.min(95, Math.max(0, Number(inputs.targetMargin) || 0)) / 100);
  const breakEvenUnits = unitCost.total < sellingPrice && sellingPrice > 0 ? Math.ceil(Number(inputs.monthlyFixedCosts || 0) / (sellingPrice - unitCost.total)) : null;
  const requiredUnits = unitCost.total < sellingPrice && sellingPrice > 0 ? Math.ceil((Number(inputs.monthlyFixedCosts || 0) + Number(inputs.monthlyTargetProfit || 0)) / (sellingPrice - unitCost.total)) : null;
  const targetMarginContribution = suggestedPrice - unitCost.total;
  const dailyBreakEvenUnits = targetMarginContribution > 0
    ? Math.ceil(Number(inputs.monthlyFixedCosts || 0) / targetMarginContribution / sellingDaysPerMonth)
    : null;
  const dailyRequiredUnits = targetMarginContribution > 0
    ? Math.ceil((Number(inputs.monthlyFixedCosts || 0) + Number(inputs.monthlyTargetProfit || 0)) / targetMarginContribution / sellingDaysPerMonth)
    : null;
  const monthlyRevenue = sellingPrice * Number(inputs.monthlyUnits || 0);
  const monthlyVariableCosts = unitCost.total * Number(inputs.monthlyUnits || 0);
  const estimatedMonthlyProfit = monthlyRevenue - monthlyVariableCosts - Number(inputs.monthlyFixedCosts || 0);
  const expectedDailyUnits = Number(inputs.monthlyUnits || 0) / sellingDaysPerMonth;
  const expectedDailyRevenue = monthlyRevenue / sellingDaysPerMonth;
  const estimatedDailyProfit = estimatedMonthlyProfit / sellingDaysPerMonth;
  const monthlyChartData = [
    {label: 'Revenue', shortLabel: 'Revenue', value: monthlyRevenue, color: '#648bb2'},
    {label: 'Variable costs', shortLabel: 'Variable', value: monthlyVariableCosts, color: '#c99c62'},
    {label: 'Fixed costs', shortLabel: 'Fixed', value: Number(inputs.monthlyFixedCosts || 0), color: '#8d6aa5'},
    {label: 'Estimated profit', shortLabel: 'Profit', value: estimatedMonthlyProfit, color: estimatedMonthlyProfit >= 0 ? '#5e9b78' : '#c96f78'}
  ];
  const salesCutoffDate = (() => {
    if (salesPeriod === 'all') return '';
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - Number(salesPeriod) + 1);
    return localDateString(cutoff);
  })();
  const filteredSales = sales.filter(sale => salesPeriod === 'all' || sale.saleDate >= salesCutoffDate);
  const productPerformance = useMemo(() => {
    const grouped = new Map();
    filteredSales.forEach(sale => {
      const key = `${sale.productType}:${sale.productName.trim().toLocaleLowerCase()}`;
      const product = grouped.get(key) || {
        key,
        productName: sale.productName.trim(),
        productType: sale.productType,
        unitsSold: 0,
        revenue: 0,
        lastSold: sale.saleDate
      };
      product.unitsSold += Number(sale.quantity);
      product.revenue += Number(sale.quantity) * Number(sale.unitPrice);
      if (sale.saleDate > product.lastSold) product.lastSold = sale.saleDate;
      grouped.set(key, product);
    });
    return Array.from(grouped.values()).sort((a, b) =>
      b.unitsSold - a.unitsSold || b.revenue - a.revenue || a.productName.localeCompare(b.productName)
    );
  }, [sales, salesPeriod, salesCutoffDate]);
  const salesSummary = filteredSales.reduce((summary, sale) => ({
    units: summary.units + Number(sale.quantity),
    revenue: summary.revenue + Number(sale.quantity) * Number(sale.unitPrice)
  }), {units: 0, revenue: 0});
  const recordSale = event => {
    event.preventDefault();
    const productName = saleForm.productName.trim();
    const saleQuantity = Number(saleForm.quantity);
    const unitPrice = Number(saleForm.unitPrice);
    if (!productName || !Number.isInteger(saleQuantity) || saleQuantity < 1 || !Number.isFinite(unitPrice) || unitPrice < 0 || !saleForm.saleDate || saleForm.saleDate > localDateString(new Date())) {
      setSalesNotice('Enter a product name, a sale date up to today, a whole quantity of at least 1, and a valid price.');
      return;
    }
    setSales(prev => [{
      id: crypto.randomUUID(),
      productName,
      productType: saleForm.productType,
      bottleSize: Number(saleForm.bottleSize),
      quantity: saleQuantity,
      unitPrice,
      saleDate: saleForm.saleDate
    }, ...prev]);
    setSaleForm(prev => ({...prev, productName, quantity: 1}));
    setSalesNotice('Sale recorded.');
  };
  const openSalesPage = () => {
    setSaleForm(prev => ({
      ...prev,
      productName: inputs.productName,
      productType,
      bottleSize: size,
      unitPrice: sellingPrice
    }));
    setSalesNotice('');
    setPage('sales');
  };

  const setNested = (group, key, field, value) => update(d => {
    if (!d[group]) d[group] = {};
    if (!d[group][key]) d[group][key] = {};
    d[group][key][field] = value === '' ? '' : Number(value);
    return d;
  });
  const setSizeValue = (group, key, value) => update(d => {
    if (!d[group]) d[group] = {};
    d[group][key] = value === '' ? '' : Number(value);
    return d;
  });
  const exportCsv = () => {
    const rows = [['Bottle ml','Concentration %','Oil pack ml','Oil needed ml','Base needed ml','Oil cost','Base cost','Bottle cost','Packaging','Other','Total cost','Selling price','Profit','Margin %']];
    sizes.forEach(s => concentrations.forEach(c => {
      const cost = calculateUnitCost({inputs, size: s, concentration: c, oilPack, productType});
      const price = s===size && c===concentration ? Number(sellingPrice||0) : Number(inputs.sellingPrices[s]||0);
      rows.push([s,c,oilPack,cost.oilMl,cost.baseMl,cost.oilCost,cost.baseCost,cost.bottleCost,cost.packagingCost,cost.other,cost.total,price,price-cost.total,price ? (price-cost.total)/price*100 : 0]);
    }));
    const csv = rows.map(row => row.map(v => `"${String(v ?? '').replaceAll('"','""')}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8;'})); a.download = 'perfume-cost-estimates.csv'; a.click(); URL.revokeObjectURL(a.href);
  };
  const exportPdf = async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({unit: 'mm', format: 'a4'});
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 16;
    const contentWidth = pageWidth - margin * 2;
    let y = 18;

    doc.setFillColor(56, 36, 61);
    doc.rect(0, 0, pageWidth, 39, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.text('SCENTLEDGER', margin, 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Perfume Cost Studio - Unit Cost Report', margin, 24);
    doc.text(new Date().toLocaleDateString('en-IN'), pageWidth - margin, 24, {align: 'right'});
    y = 49;

    const addSection = (title, rows) => {
      if (y > 258) {
        doc.addPage();
        y = 18;
      }
      doc.setFillColor(246, 242, 247);
      doc.roundedRect(margin, y, contentWidth, 8, 1.5, 1.5, 'F');
      doc.setTextColor(56, 36, 61);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(title, margin + 3, y + 5.5);
      y += 12;

      rows.forEach(([label, value]) => {
        const valueLines = doc.splitTextToSize(String(value), contentWidth * 0.48);
        const rowHeight = Math.max(7, valueLines.length * 4.5 + 2);
        if (y + rowHeight > 280) {
          doc.addPage();
          y = 18;
        }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(105, 94, 108);
        doc.text(label, margin + 1, y + 4);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(48, 40, 52);
        doc.text(valueLines, pageWidth - margin - 1, y + 4, {align: 'right'});
        doc.setDrawColor(238, 232, 239);
        doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);
        y += rowHeight;
      });
      y += 7;
    };
    const asMoney = value => `INR ${Number(value || 0).toFixed(2)}`;
    const batchRevenue = sellingPrice * quantity;

    addSection('Product configuration', [
      ['Product / fragrance', inputs.productName || 'Unnamed product'],
      ['Product type', productType === 'attar' ? 'Pure oil attar' : 'Alcohol-based perfume'],
      ['Bottle size', `${size} ml`],
      ['Oil concentration', `${concentration}%`],
      ['Oil purchase pack', `${number(oilPack)} ml`],
      ['Units in this order', number(quantity)]
    ]);
    addSection('Entered supplier costs', [
      ['Oil pack prices (100 / 500 / 1,000 ml)', [100, 500, 1000].map(pack => `${pack} ml: ${asMoney(inputs.oilPrices[pack])}`).join(' | ')],
      [`Selected ${number(oilPack)} ml oil pack price`, asMoney(inputs.oilPrices[oilPack])],
      ['Oil cost per ml', asMoney(Number(inputs.oilPrices[oilPack] || 0) / oilPack)],
      [`Bottle price at ${number(inputs.selectedMoq[size])}-unit MOQ`, asMoney(unitCost.bottleCost)],
      ['Bottle prices for this size by MOQ', moqs.map(moq => `${number(moq)}: ${asMoney(inputs.bottles[size]?.[moq])}`).join(' | ')],
      ['Packaging per bottle', asMoney(unitCost.packagingCost)],
      ['Base / alcohol price per ml', asMoney(inputs.basePerMl)],
      ['Other variable cost per bottle', asMoney(unitCost.other)]
    ]);
    addSection('Estimated unit cost breakdown', [
      ['Perfume oil required', `${number(unitCost.oilMl)} ml (${asMoney(unitCost.oilCost)})`],
      ['Base / alcohol required', `${number(unitCost.baseMl)} ml (${asMoney(unitCost.baseCost)})`],
      ['Empty bottle', asMoney(unitCost.bottleCost)],
      ['Packaging', asMoney(unitCost.packagingCost)],
      ['Other variable costs', asMoney(unitCost.other)],
      ['Total estimated unit cost', asMoney(unitCost.total)]
    ]);
    addSection('Profitability and batch estimate', [
      ['Retail selling price per bottle', asMoney(sellingPrice)],
      ['Estimated profit per bottle', asMoney(profit)],
      ['Estimated margin', `${number(margin)}%`],
      ['Markup', `${number(markup)}%`],
      [`Suggested price at ${number(inputs.targetMargin)}% margin`, asMoney(suggestedPrice)],
      ['Total cost for order', asMoney(unitCost.total * quantity)],
      ['Estimated order revenue', asMoney(batchRevenue)],
      ['Estimated batch profit', asMoney(profit * quantity)],
      ['Oil required for order', `${number(unitCost.oilMl * quantity)} ml`]
    ]);

    const fileName = (inputs.productName || 'perfume-cost-report')
      .trim()
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'perfume-cost-report';
    doc.save(`${fileName}-cost-report.pdf`);
  };
  const reset = () => { if (confirm('Reset all supplier costs and settings to blank sample values?')) { setInputs(cloneDefaultInputs()); setSellingPrice(defaultSellingPrice); setNotice('Inputs reset.'); } };

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">✦</div><div><strong>SCENT<span>LEDGER</span></strong><small>PERFUME COST STUDIO</small></div></div>
      <div className="side-label">WORKSPACE</div>
      <button className={page==='calculator'?'nav active':'nav'} onClick={()=>setPage('calculator')}><span>◈</span> Unit calculator</button>
      <button className={page==='costs'?'nav active':'nav'} onClick={()=>setPage('costs')}><span>▤</span> Cost & suppliers</button>
      <button className={page==='planning'?'nav active':'nav'} onClick={()=>setPage('planning')}><span>◷</span> Monthly planning</button>
      <button className={page==='sales'?'nav active':'nav'} onClick={openSalesPage}><span>↗</span> Sales insights</button>
      <div className="sidebar-bottom"><div className="status-dot"/> <span>Saved in this browser</span><p>Your entries are stored locally on this device.</p></div>
    </aside>
    <main className="main">
      <header className="topbar"><div><span className="eyebrow">YOUR PERFUME BUSINESS</span><h1>{page==='calculator'?'Unit cost calculator':page==='costs'?'Cost & supplier setup':page==='planning'?'Monthly profit planning':'Sales insights'}</h1></div><div className="top-actions"><span className="local-pill">● Local workspace</span>{page==='calculator'&&<button className="btn secondary" onClick={exportPdf}>⇩ Export PDF</button>}<button className="btn secondary" onClick={exportCsv}>⇩ Export CSV</button></div></header>
      {page==='calculator' && <>
        <section className="intro"><div><span className="eyebrow light">PRICE WITH CONFIDENCE</span><h2>Know your cost. Protect your margin.</h2><p>Calculate the true estimated cost of every perfume or attar bottle before setting your retail price.</p></div><div className="intro-icon">✧</div></section>
        <div className="grid two-col">
          <section className="panel"><div className="panel-head"><div><span className="step">01 / PRODUCT</span><h3>Product configuration</h3></div><span className="pill">Live calculation</span></div>
            <label className="field-label">Product / fragrance name<input value={inputs.productName} onChange={e=>setField('productName',e.target.value)} placeholder="e.g. Oud Royale" /></label>
            <div className="field-grid"><label className="field-label">Product type<select value={productType} onChange={e=>{setProductType(e.target.value);if(e.target.value==='attar')setConcentration(100)}}><option value="spray">Alcohol-based perfume</option><option value="attar">Pure oil attar</option></select></label>
              <label className="field-label">Bottle size<select value={size} onChange={e=>changeSize(e.target.value)}>{sizes.map(s=><option key={s} value={s}>{s} ml</option>)}</select></label></div>
            <div className="field-grid"><label className="field-label">Oil concentration<select value={concentration} disabled={productType==='attar'} onChange={e=>setConcentration(Number(e.target.value))}>{concentrations.map(c=><option key={c} value={c}>{c}% {c===100?'— pure oil':''}</option>)}</select></label>
              <label className="field-label">Oil purchase pack<select value={oilPack} onChange={e=>setOilPack(Number(e.target.value))}>{packs.map(p=><option key={p} value={p}>{p.toLocaleString('en-IN')} ml pack</option>)}</select></label></div>
            <div className="field-grid"><label className="field-label">Retail selling price (₹)<select value={sellingPrice} onChange={e=>setCurrentSellingPrice(e.target.value)}>{sellingPriceOptions.map(price=><option key={price} value={price}>₹{price}</option>)}</select></label><label className="field-label">Units in this order<input type="number" min="1" value={quantity} onChange={e=>setQuantity(Math.max(1,Number(e.target.value)||1))}/></label></div>
            <label className="field-label">Target profit margin (%)<input type="number" min="0" max="95" value={inputs.targetMargin} onChange={e=>setField('targetMargin',Math.min(95,Math.max(0,Number(e.target.value))))}/><small>Suggested retail price updates immediately. This setting is shared with Cost & suppliers.</small></label>
            <div className="hint">Results recalculate immediately. Oil uses the selected pack price; bottle cost uses the selected MOQ for this bottle size.</div>
            {(missingOilPrice || missingBottlePrice) && <div className="hint">{missingOilPrice && `No price entered for the selected ${number(oilPack)} ml oil pack. `}{missingBottlePrice && `No bottle price entered for ${size} ml at the selected ${inputs.selectedMoq[size]}-unit MOQ. `}These missing costs currently count as ₹0. Enter supplier prices in Cost & suppliers.</div>}
          </section>
          <section className="panel result-panel"><div className="panel-head"><div><span className="step">02 / RESULT</span><h3>Unit profitability</h3></div><span className={profit>=0?'pill good':'pill bad'}>{profit>=0?'Positive profit':'Loss at this price'}</span></div>
            <div className="hero-metric"><span>Estimated profit per bottle</span><strong className={profit<0?'negative':''}>{money(profit)}</strong><div className="metric-foot"><span>Estimated margin</span><b>{number(margin)}%</b><div className="progress"><i style={{width:`${Math.min(100,Math.max(0,margin))}%`}}/></div></div></div>
            <div className="mini-stats"><div><span>Unit cost</span><b>{money(unitCost.total)}</b></div><div><span>Selling price</span><b>{money(sellingPrice)}</b></div><div><span>Markup</span><b>{number(markup)}%</b></div></div>
            <div className="suggestion"><div><span>Suggested price at {inputs.targetMargin}% margin</span><strong>{money(suggestedPrice)}</strong></div><button className="btn small" onClick={()=>setCurrentSellingPrice(suggestedPrice)}>Use closest price ↗</button></div>
            <div className="hint">Retail price choices are fixed; using the suggested price selects the closest available option.</div>
            <div className="hint">Margin = profit ÷ selling price. Markup = profit ÷ unit cost. These are different measures.</div>
          </section>
        </div>
        <section className="panel cost-breakdown"><div className="panel-head"><div><span className="step">03 / BREAKDOWN</span><h3>Where your money goes</h3></div><span className="subtle">Per finished {size} ml bottle</span></div>
          <div className="formula-strip"><div><span>Perfume oil needed</span><b>{number(unitCost.oilMl)} ml</b></div><div><span>Base / alcohol needed</span><b>{number(unitCost.baseMl)} ml</b></div><div><span>Selected bottle MOQ</span><b>{inputs.selectedMoq[size]} units</b></div></div>
          <div className="breakdown-list">{[[`Perfume oil (${number(unitCost.oilMl)} ml)`,unitCost.oilCost],['Base / alcohol',unitCost.baseCost],['Empty bottle',unitCost.bottleCost],['Packaging',unitCost.packagingCost],['Other variable costs',unitCost.other]].map(([label,val])=><div className="breakdown-row" key={label}><span>{label}</span><b>{money(val)}</b><div className="bar-track"><i style={{width:`${unitCost.total ? Math.min(100,Math.max(0,val/unitCost.total*100)):0}%`}}/></div></div>)}<div className="breakdown-total"><span>Total estimated unit cost</span><strong>{money(unitCost.total)}</strong></div></div>
          <div className="chart-panel"><div className="panel-head"><div><span className="step">COST VISUALIZATION</span><h3>Unit cost composition</h3></div></div><CostCompositionChart cost={unitCost}/></div>
          <div className="batch-total"><div><span>For {number(quantity)} bottles</span><strong>{money(unitCost.total*quantity)} total cost</strong></div><div><span>Estimated batch profit</span><strong className={profit*quantity<0?'negative':'positive'}>{money(profit*quantity)}</strong></div><div><span>Oil required for batch</span><strong>{number(unitCost.oilMl*quantity)} ml</strong></div></div>
        </section>
        <section className="note-box"><b>Before you rely on this estimate</b><span>Enter actual supplier quotes under Cost & suppliers. Add GST/tax, shipping, wastage, payment fees, marketplace commission, discounts and labour to the appropriate cost fields where applicable. This tool estimates costs; it does not verify supplier prices.</span></section>
      </>}
      {page==='costs' && <>
        <section className="intro compact"><div><span className="eyebrow light">SET YOUR BASELINE</span><h2>Supplier prices & packaging</h2><p>Enter your actual quotations. Your calculator updates automatically and saves in this browser.</p></div><div className="intro-icon">⌁</div></section>
        <section className="panel"><div className="panel-head"><div><span className="step">01 / OIL</span><h3>Perfume oil purchase prices</h3><p className="panel-desc">Enter the total purchase price for each pack size, not the price per ml. For example, enter ₹5,000 for a 1,000 ml (1 litre) pack.</p></div></div><div className="field-grid three">{packs.map(p=><label className="field-label" key={p}>{p===1000?'1,000 ml (1 litre)':p.toLocaleString('en-IN')+' ml'} oil pack price (₹)<input type="number" min="0" placeholder={p===1000?'e.g. 5000':'Total pack price'} value={inputs.oilPrices[p]} onChange={e=>update(d=>{d.oilPrices[p]=e.target.value===''?'':Number(e.target.value);return d})} /></label>)}</div><div className="oil-cost-grid">{packs.map(p=><div key={p}><span>Cost per ml · {p.toLocaleString('en-IN')} ml pack</span><b>{money(Number(inputs.oilPrices[p]||0)/p)}</b></div>)}</div></section>
        <section className="panel"><div className="panel-head"><div><span className="step">02 / BOTTLES</span><h3>Empty bottle costs by MOQ</h3><p className="panel-desc">Enter per-bottle cost for each order quantity. If quoted a total order price, divide by quantity first.</p></div></div><div className="table-wrap"><table><thead><tr><th>Size</th>{moqs.map(m=><th key={m}>{m.toLocaleString('en-IN')} units · ₹/bottle</th>)}<th>Selected MOQ</th></tr></thead><tbody>{sizes.map(s=><tr key={s}><th>{s} ml</th>{moqs.map(m=><td key={m}><input className="table-input" type="number" min="0" value={inputs.bottles[s]?.[m] ?? 0} onChange={e=>setNested('bottles',s,m,e.target.value)} /></td>)}<td><select className="table-select" value={inputs.selectedMoq[s]} onChange={e=>update(d=>{d.selectedMoq[s]=Number(e.target.value);return d})}>{moqs.map(m=><option key={m} value={m}>{m}</option>)}</select></td></tr>)}</tbody></table></div></section>
        <section className="panel"><div className="panel-head"><div><span className="step">03 / BULK PREVIEW</span><h3>Live bulk costing</h3><p className="panel-desc">Updates as you enter prices or change these costing assumptions. Results also update in Unit calculator.</p></div><span className="pill good">Live calculation</span></div><div className="field-grid three"><label className="field-label">Product type<select value={productType} onChange={e=>{setProductType(e.target.value);if(e.target.value==='attar')setConcentration(100)}}><option value="spray">Alcohol-based perfume</option><option value="attar">Pure oil attar</option></select></label><label className="field-label">Oil concentration<select value={concentration} onChange={e=>setConcentration(Number(e.target.value))}>{concentrations.map(c=><option key={c} value={c}>{c}%{c===100?' — pure oil':''}</option>)}</select></label><label className="field-label">Oil pack to cost from<select value={oilPack} onChange={e=>setOilPack(Number(e.target.value))}>{packs.map(p=><option key={p} value={p}>{p===1000?'1,000 ml (1 litre)':p.toLocaleString('en-IN')+' ml'} pack</option>)}</select></label></div><div className="table-wrap"><table><thead><tr><th>Bottle</th><th>Selected MOQ</th><th>Oil / bottle</th><th>Bottle / unit</th><th>Estimated cost / bottle</th><th>Cost for MOQ</th><th>Oil pack + MOQ bottles purchase</th><th>Bottles oil pack can fill</th></tr></thead><tbody>{bulkPreview.map(({size: bottleSize, moq, cost, batchCost, purchaseOutlay, oilStockBottles})=><tr key={bottleSize}><th>{bottleSize} ml</th><td>{number(moq)}</td><td>{number(cost.oilMl)} ml</td><td>{money(cost.bottleCost)}</td><td>{money(cost.total)}</td><td>{money(batchCost)}</td><td>{money(purchaseOutlay)}</td><td>{number(oilStockBottles)}</td></tr>)}</tbody></table></div><div className="hint">MOQ batch cost includes oil used, base/alcohol, bottle, packaging, and other entered variable costs. The purchase figure includes one complete selected oil pack plus the selected MOQ of bottles, but excludes future finishing costs. Oil-supported bottle count is based on one oil pack and does not include wastage.</div></section>
        <section className="panel"><div className="panel-head"><div><span className="step">04 / FINISHING</span><h3>Packaging & additional costs</h3><p className="panel-desc">Include box, label, cap, seal, insert, wrap or other unit-level expenses.</p></div></div><div className="field-grid three">{sizes.map(s=><label className="field-label" key={s}>{s} ml packaging cost (₹)<input type="number" min="0" value={inputs.packaging[s]} onChange={e=>setSizeValue('packaging',s,e.target.value)}/></label>)}</div><div className="field-grid three top-gap"><label className="field-label">Base / alcohol cost per ml (₹)<input type="number" min="0" step="0.01" value={inputs.basePerMl} onChange={e=>setField('basePerMl',Number(e.target.value))}/></label><label className="field-label">Other variable cost per bottle (₹)<input type="number" min="0" step="0.01" value={inputs.otherPerUnit} onChange={e=>setField('otherPerUnit',Number(e.target.value))}/><small>e.g. filling labour, wastage, labels not listed above</small></label><label className="field-label">Target profit margin (%)<input type="number" min="0" max="95" value={inputs.targetMargin} onChange={e=>setField('targetMargin',Math.min(95,Math.max(0,Number(e.target.value))))}/><small>Suggested retail price uses this margin.</small></label></div></section>
        <div className="page-actions"><button className="btn secondary" onClick={reset}>Reset inputs</button><button className="btn" onClick={()=>{setNotice('Your inputs are saved in this browser automatically.');setPage('calculator');window.scrollTo(0,0)}}>Save & calculate →</button></div>{notice&&<div className="toast">{notice}</div>}
      </>}
      {page==='planning' && <>
        <section className="intro compact"><div><span className="eyebrow light">FROM UNIT TO BUSINESS</span><h2>Plan your monthly target</h2><p>Estimate how many bottles you need to sell to cover monthly fixed costs and reach a target profit.</p></div><div className="intro-icon">↗</div></section>
        <div className="grid two-col"><section className="panel"><div className="panel-head"><div><span className="step">01 / TARGETS</span><h3>Monthly business assumptions</h3></div></div><label className="field-label">Monthly fixed costs (₹)<input type="number" min="0" value={inputs.monthlyFixedCosts} onChange={e=>setField('monthlyFixedCosts',Number(e.target.value))}/><small>Rent, salary, utilities, software, etc.</small></label><label className="field-label">Desired monthly profit (₹)<input type="number" min="0" value={inputs.monthlyTargetProfit} onChange={e=>setField('monthlyTargetProfit',Number(e.target.value))}/></label><label className="field-label">Expected monthly units<input type="number" min="0" value={inputs.monthlyUnits} onChange={e=>setField('monthlyUnits',Number(e.target.value))}/></label><div className="hint">This planning view uses the current bottle size, concentration and selling price selected in Unit calculator.</div></section>
          <section className="panel result-panel"><div className="panel-head"><div><span className="step">02 / FORECAST</span><h3>Monthly estimate</h3></div></div><div className="planning-kpis"><div><span>Contribution per bottle</span><b className={profit<0?'negative':''}>{money(profit)}</b></div><div><span>Break-even bottles / month</span><b>{breakEvenUnits===null?'Not achievable':number(breakEvenUnits)}</b></div><div><span>Bottles for target profit</span><b>{requiredUnits===null?'Not achievable':number(requiredUnits)}</b></div><div><span>Estimated monthly profit</span><b className={estimatedMonthlyProfit<0?'negative':'positive'}>{money(estimatedMonthlyProfit)}</b></div></div><div className="hint">This simplified estimate excludes tax, sales fees and any costs not entered. A negative contribution means each sale loses money before fixed costs.</div></section></div>
        <section className="panel"><div className="panel-head"><div><span className="step">MONTHLY CHART</span><h3>Revenue, costs & profit</h3><p className="panel-desc">Based on {number(inputs.monthlyUnits)} units per month at the current selling price and unit cost.</p></div></div><MonthlyForecastChart data={monthlyChartData}/></section>
        <section className="panel"><div className="panel-head"><div><span className="step">03 / DAILY SALES</span><h3>Daily sales target & forecast</h3><p className="panel-desc">Based on {sellingDaysPerMonth} selling days per month.</p></div></div><div className="planning-kpis"><div><span>Expected sales / day</span><b>{number(expectedDailyUnits)} bottles</b></div><div><span>Expected revenue / day</span><b>{money(expectedDailyRevenue)}</b></div><div><span>Projected profit / day</span><b className={estimatedDailyProfit<0?'negative':'positive'}>{money(estimatedDailyProfit)}</b></div><div><span>Daily bottles to break even</span><b>{dailyBreakEvenUnits===null?'Not achievable':`${number(dailyBreakEvenUnits)} bottles`}</b></div><div><span>Daily bottles for target profit</span><b>{dailyRequiredUnits===null?'Not achievable':`${number(dailyRequiredUnits)} bottles`}</b></div></div><div className="hint">Expected sales, revenue, and projected profit per day update with Expected monthly units. Break-even and target-profit bottle counts are minimum daily requirements, so they change with costs or profit goals—not with your sales forecast. Those minimums use a suggested price of {money(suggestedPrice)} at your {number(inputs.targetMargin)}% target margin.</div></section>
      </>}
      {page==='sales' && <>
        <section className="intro compact"><div><span className="eyebrow light">LEARN FROM EVERY SALE</span><h2>See what is moving</h2><p>Log perfume and attar sales to spot fast movers to restock and slower products to give more attention.</p></div><div className="intro-icon">↗</div></section>
        <div className="sales-period-row"><div><span className="step">SALES PERFORMANCE</span><p className="panel-desc">Rankings use the number of units you record for each product.</p></div><label className="field-label">Show period<select value={salesPeriod} onChange={event=>setSalesPeriod(event.target.value)}>{salesPeriods.map(period=><option key={period.value} value={period.value}>{period.label}</option>)}</select></label></div>
        <section className="sales-summary">
          <div><span>Units sold</span><strong>{number(salesSummary.units)}</strong></div>
          <div className="sales-summary-total"><span>Total sales revenue · {salesPeriods.find(period=>period.value===salesPeriod)?.label}</span><strong>{money(salesSummary.revenue)}</strong><small>Combined across all recorded products</small></div>
          <div><span>Products with sales</span><strong>{number(productPerformance.length)}</strong></div>
        </section>
        <div className="grid two-col">
          <section className="panel"><div className="panel-head"><div><span className="step">01 / RECORD A SALE</span><h3>Add a perfume or attar sale</h3><p className="panel-desc">The current calculator product and price are filled in when you open this page.</p></div></div>
            <form onSubmit={recordSale}>
              <label className="field-label">Product / fragrance name<input required value={saleForm.productName} onChange={event=>setSaleForm(prev=>({...prev,productName:event.target.value}))} placeholder="e.g. Oud Royale" /></label>
              <div className="field-grid">
                <label className="field-label">Product type<select value={saleForm.productType} onChange={event=>setSaleForm(prev=>({...prev,productType:event.target.value}))}><option value="spray">Alcohol-based perfume</option><option value="attar">Pure oil attar</option></select></label>
                <label className="field-label">Bottle size<select value={saleForm.bottleSize} onChange={event=>setSaleForm(prev=>({...prev,bottleSize:Number(event.target.value)}))}>{sizes.map(value=><option key={value} value={value}>{value} ml</option>)}</select></label>
              </div>
              <div className="field-grid">
                <label className="field-label">Sale date<input required type="date" max={localDateString(new Date())} value={saleForm.saleDate} onChange={event=>setSaleForm(prev=>({...prev,saleDate:event.target.value}))} /></label>
                <label className="field-label">Quantity sold<input required type="number" min="1" step="1" value={saleForm.quantity} onChange={event=>setSaleForm(prev=>({...prev,quantity:event.target.value}))} /></label>
              </div>
              <label className="field-label">Selling price per bottle (₹)<input required type="number" min="0" step="0.01" value={saleForm.unitPrice} onChange={event=>setSaleForm(prev=>({...prev,unitPrice:event.target.value}))} /></label>
              <button className="btn" type="submit">＋ Record sale</button>
              {salesNotice&&<div className={salesNotice==='Sale recorded.'||salesNotice==='Sale removed.'?'toast':'sales-error'} role={salesNotice==='Sale recorded.'||salesNotice==='Sale removed.'?'status':'alert'}>{salesNotice}</div>}
            </form>
          </section>
          <section className="panel"><div className="panel-head"><div><span className="step">02 / PRODUCT RANKING</span><h3>Fast and slow movers</h3><p className="panel-desc">{salesPeriods.find(period=>period.value===salesPeriod)?.label} · ranked by units sold</p></div></div>
            {productPerformance.length===0
              ? <div className="sales-empty"><strong>No sales recorded for this period yet.</strong><span>Record your first sale to start comparing perfumes and attars.</span></div>
              : <div className="table-wrap sales-table-wrap"><table className="sales-table"><thead><tr><th>Product</th><th>Units</th><th>Revenue</th><th>Last sold</th><th>Action</th></tr></thead><tbody>{productPerformance.map((product,index)=><tr key={product.key}><td><strong>{product.productName}</strong><small>{product.productType==='attar'?'Pure oil attar':'Alcohol-based perfume'}</small></td><td>{number(product.unitsSold)}</td><td>{money(product.revenue)}</td><td>{new Date(`${product.lastSold}T00:00:00`).toLocaleDateString('en-IN')}</td><td><span className={`sales-badge ${index===0?'fast':index===productPerformance.length-1?'slow':''}`}>{index===0?'Restock priority':index===productPerformance.length-1?'Promote & review':'Steady'}</span></td></tr>)}</tbody></table></div>}
            <div className="hint">Restock priority marks the highest recorded unit sales; Promote & review marks the lowest when multiple products have sales. Use your actual stock levels and costs when deciding how much to order.</div>
          </section>
        </div>
        <section className="panel"><div className="panel-head"><div><span className="step">03 / SALES LOG</span><h3>Recent sales</h3><p className="panel-desc">Individual sales included in the selected period.</p></div></div>
          {filteredSales.length===0
            ? <div className="sales-empty"><span>Your recorded sales will appear here.</span></div>
            : <div className="table-wrap sales-table-wrap"><table className="sales-table"><thead><tr><th>Date</th><th>Product</th><th>Type / size</th><th>Units</th><th>Price / unit</th><th>Total</th><th></th></tr></thead><tbody>{[...filteredSales].sort((a,b)=>b.saleDate.localeCompare(a.saleDate)).slice(0,10).map(sale=><tr key={sale.id}><td>{new Date(`${sale.saleDate}T00:00:00`).toLocaleDateString('en-IN')}</td><td>{sale.productName}</td><td>{sale.productType==='attar'?'Attar':'Perfume'} · {number(Number(sale.bottleSize))} ml</td><td>{number(Number(sale.quantity))}</td><td>{money(Number(sale.unitPrice))}</td><td>{money(Number(sale.quantity)*Number(sale.unitPrice))}</td><td><button className="sales-delete" type="button" aria-label={`Remove sale for ${sale.productName}`} onClick={()=>{setSales(prev=>prev.filter(item=>item.id!==sale.id));setSalesNotice('Sale removed.')}}>Remove</button></td></tr>)}</tbody></table></div>}
          {filteredSales.length>10&&<p className="panel-desc">Showing the 10 most recent records. All matching records are included in the summary and rankings.</p>}
        </section>
        <div className="hint sales-disclaimer">Sales records are saved only in this browser. Rankings reflect logged sales, not stock on hand, profit, or unrecorded demand.</div>
      </>}
      <footer>SCENTLEDGER <span>•</span> Perfume & attar costing tool <span className="footer-right">Prototype · Data stays in this browser</span></footer>
    </main>
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
