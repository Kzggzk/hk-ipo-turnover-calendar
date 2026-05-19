#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const data = JSON.parse(await readFile(path.join(root, "data", "latest.json"), "utf8"));
const distDir = path.join(root, "dist");

await mkdir(distDir, { recursive: true });
await writeFile(path.join(distDir, "index.html"), render(data), "utf8");
console.log(`Built dist/index.html from data/latest.json (${data.meta?.fetchedAt || "unknown"})`);

function render(data) {
  const days = calendarDays(data.meta.coverageStart, data.meta.coverageEnd);
  const holidays = new Set((data.holidays || []).map((holiday) => holiday.date));
  const tradingDays = days.filter((day) => day.weekday !== 0 && day.weekday !== 6 && !holidays.has(day.iso));
  const asOf = data.meta.runDate || data.meta.asOfDate || data.meta.coverageStart;
  const okSources = data.audit?.okSourceCount ?? (data.sourceChecks || []).filter((source) => source.ok).length;
  const sourceCount = data.audit?.sourceCount ?? (data.sources || []).length;
  const monthColumns = days.length;
  const activeIpos = data.ipos.filter((ipo) => ipo.status !== "listed-reference" || dayIndex(days, ipo.listingDate) >= 0);
  const scoredIpos = data.ipos
    .filter((ipo) => typeof ipo.score === "number" && ipo.status !== "listed-reference")
    .sort((a, b) => b.score - a.score);
  const topOpen = scoredIpos.find((ipo) => ipo.status === "open") || scoredIpos[0];

  return `<!doctype html>
<html lang="zh-Hans">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="900">
  <title>${escapeHtml(data.meta.siteTitleZh)} | ${escapeHtml(data.meta.siteTitleEn)}</title>
  <style>
    :root{
      color-scheme:dark;
      --bg:#080b0d;--panel:#0e1417;--panel2:#111b20;--panel3:#16242a;
      --line:#27363d;--line2:#3f535d;--text:#edf5f7;--muted:#8fa2ab;
      --cyan:#32d5ff;--cyan2:#0e7f9c;--amber:#ffbf3d;--green:#21d07a;--red:#ff5b5b;
      --blue:#4f7cff;--gray:#5f6b73;--black:#050708;
      --day:54px;--row:58px;--name:220px;
    }
    *{box-sizing:border-box}
    html,body{max-width:100%;overflow-x:hidden}
    body{margin:0;background:var(--bg);color:var(--text);font-family:Inter,-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI","PingFang SC","Microsoft YaHei",Arial,sans-serif;font-size:12px;line-height:1.42;letter-spacing:0}
    a{color:var(--cyan);text-decoration:none}a:hover{text-decoration:underline}
    .app{max-width:1720px;margin:0 auto;padding:10px 10px 28px}
    .terminal{border:1px solid var(--line2);background:linear-gradient(180deg,#0b1114 0%,#080b0d 100%);box-shadow:0 0 0 1px rgba(255,255,255,.02) inset}
    .topbar{display:grid;grid-template-columns:1fr auto;gap:14px;align-items:start;padding:11px 12px;border-bottom:1px solid var(--line2)}
    h1{margin:0;font-size:24px;line-height:1;font-weight:820;letter-spacing:0;color:#fff}
    h2{margin:0;font-size:13px;line-height:1.2;font-weight:760;text-transform:uppercase;color:#dceff3}
    h3{margin:0;font-size:12px;line-height:1.2;font-weight:760}
    .ticker{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}
    .pill{display:inline-flex;align-items:center;gap:5px;min-height:22px;border:1px solid var(--line2);background:var(--panel2);padding:3px 7px;color:var(--muted);white-space:normal;max-width:100%;overflow-wrap:anywhere}
    .pill.hot{border-color:rgba(50,213,255,.65);color:var(--cyan);background:rgba(50,213,255,.08)}
    .pill.warn{border-color:rgba(255,191,61,.65);color:var(--amber);background:rgba(255,191,61,.08)}
    .pill.red{border-color:rgba(255,91,91,.7);color:#ffb0b0;background:rgba(255,91,91,.09)}
    .status{text-align:right;color:var(--muted);font-family:"SF Mono","Roboto Mono",Menlo,Consolas,monospace}
    .status b{display:block;color:var(--cyan);font-size:16px;line-height:1.2}
    .decision{display:grid;grid-template-columns:1.35fr .65fr;border-bottom:1px solid var(--line2)}
    .decision-main,.decision-side{padding:12px;border-right:1px solid var(--line2);background:var(--panel)}
    .decision-side{border-right:0;background:linear-gradient(180deg,rgba(255,191,61,.10),rgba(255,91,91,.07))}
    .decision b{display:block;margin-bottom:5px;color:#fff;font-size:14px}
    .kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));border-bottom:1px solid var(--line2)}
    .kpi{padding:10px 12px;border-right:1px solid var(--line);min-height:76px;background:#0c1215}
    .kpi:last-child{border-right:0}
    .label{font-size:10px;text-transform:uppercase;color:var(--muted);font-family:"SF Mono","Roboto Mono",Menlo,Consolas,monospace}
    .value{font-size:23px;font-weight:840;line-height:1.05;margin-top:4px;color:#fff;font-family:"SF Mono","Roboto Mono",Menlo,Consolas,monospace}
    .note{margin-top:4px;color:var(--muted)}
    .grid{display:grid;grid-template-columns:1fr 392px;gap:10px;padding:10px}
    .panel{border:1px solid var(--line2);background:var(--panel)}
    .panel-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border-bottom:1px solid var(--line2);background:var(--panel2)}
    .panel-body{padding:10px}
    .calendar{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));border-top:1px solid var(--line);border-left:1px solid var(--line)}
    .day{min-height:112px;padding:7px;border-right:1px solid var(--line);border-bottom:1px solid var(--line);background:#0b1114;position:relative;overflow:hidden}
    .day.weekend,.day.holiday{background:#090d10;color:var(--gray)}
    .day.today{outline:2px solid var(--cyan);outline-offset:-2px;background:#0f1d22}
    .date{display:flex;justify-content:space-between;gap:6px;font-family:"SF Mono","Roboto Mono",Menlo,Consolas,monospace;color:#e9f4f6;font-weight:760}
    .dow{color:var(--muted);font-weight:520}
    .event{margin-top:5px;border-left:3px solid var(--line2);padding:3px 5px;background:rgba(255,255,255,.035);font-size:11px}
    .event.deadline{border-color:var(--red)}
    .event.broker{border-color:var(--amber)}
    .event.result{border-color:var(--cyan)}
    .event.refund{border-color:var(--green)}
    .event.listing{border-color:var(--blue)}
    .event.watch{border-color:var(--gray);color:var(--muted)}
    .timeline{overflow-x:auto;border-top:1px solid var(--line)}
    .tl-grid{min-width:calc(${monthColumns} * var(--day) + var(--name));display:grid;grid-template-columns:var(--name) repeat(${monthColumns},var(--day))}
    .tl-cell{height:31px;border-right:1px solid var(--line);border-bottom:1px solid var(--line);display:flex;align-items:center;padding:0 6px;background:#0b1114;color:var(--muted);font-family:"SF Mono","Roboto Mono",Menlo,Consolas,monospace}
    .tl-head{height:38px;background:#10191d;color:#d9edf1;font-weight:780}
    .tl-name{position:sticky;left:0;z-index:3;background:#10191d;color:#fff;border-right:1px solid var(--line2);font-family:inherit}
    .tl-row-name{height:var(--row);display:block;padding:8px 9px}
    .tl-row-name strong{display:block;font-size:16px;font-family:"SF Mono","Roboto Mono",Menlo,Consolas,monospace}
    .tl-row-name span{display:block;color:var(--muted);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .bar-row{height:var(--row);position:relative;display:grid;grid-template-columns:repeat(${monthColumns},var(--day));border-bottom:1px solid var(--line);grid-column:2/-1;background:repeating-linear-gradient(90deg,transparent 0,transparent calc(var(--day) - 1px),var(--line) calc(var(--day) - 1px),var(--line) var(--day))}
    .bar{align-self:center;height:28px;border:1px solid var(--line2);background:#17262c;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 8px;overflow:hidden;white-space:nowrap;font-family:"SF Mono","Roboto Mono",Menlo,Consolas,monospace}
    .bar.open{border-color:var(--cyan);background:rgba(50,213,255,.12);color:#c9f6ff}
    .bar.closed{border-color:var(--amber);background:rgba(255,191,61,.10);color:#ffe5a7}
    .bar.to-list{border-color:var(--blue);background:rgba(79,124,255,.11);color:#d3dcff}
    .bar.listed-reference{border-color:var(--gray);background:rgba(95,107,115,.10);color:#a6b4bb}
    .marker{align-self:end;margin-bottom:3px;justify-self:center;z-index:2;min-width:20px;text-align:center;border:1px solid var(--line2);background:#0a0f12;color:#dfeef2;font-size:10px;line-height:14px;font-family:"SF Mono","Roboto Mono",Menlo,Consolas,monospace}
    .marker.broker{border-color:var(--amber);color:var(--amber)}
    .marker.official{border-color:var(--red);color:#ffb4b4}
    .marker.result{border-color:var(--cyan);color:var(--cyan)}
    .marker.refund{border-color:var(--green);color:var(--green)}
    .marker.listing{border-color:var(--blue);color:#bfd0ff}
    .score-list{display:grid;gap:8px}
    .score-card{border:1px solid var(--line);background:#0b1114;padding:9px}
    .score-top{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:start}
    .score-code{font-size:15px;font-weight:830;font-family:"SF Mono","Roboto Mono",Menlo,Consolas,monospace;color:#fff}
    .score-num{width:42px;height:42px;display:grid;place-items:center;border:1px solid var(--cyan);background:rgba(50,213,255,.10);font-size:22px;font-weight:840;color:var(--cyan);font-family:"SF Mono","Roboto Mono",Menlo,Consolas,monospace}
    .score-num.high{border-color:var(--green);color:var(--green);background:rgba(33,208,122,.10)}
    .score-num.mid{border-color:var(--amber);color:var(--amber);background:rgba(255,191,61,.10)}
    .score-num.low{border-color:var(--gray);color:#b2bdc3;background:rgba(95,107,115,.10)}
    .brief{color:var(--muted);margin-top:5px}
    .meters{display:grid;gap:4px;margin-top:8px}
    .meter{display:grid;grid-template-columns:64px 1fr 25px;gap:6px;align-items:center;color:var(--muted);font-size:10px}
    .track{height:7px;border:1px solid var(--line2);background:#080c0f}
    .fill{display:block;height:100%;background:var(--cyan)}
    .conflicts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    .conflict{border:1px solid var(--line2);background:#0b1114;padding:10px;min-height:128px}
    .conflict.hard{border-color:rgba(255,91,91,.72);background:rgba(255,91,91,.07)}
    .conflict.tight{border-color:rgba(255,191,61,.72);background:rgba(255,191,61,.07)}
    .conflict.same{border-color:rgba(50,213,255,.62);background:rgba(50,213,255,.06)}
    .conflict b{display:block;margin:7px 0;color:#fff;font-size:15px}
    table{width:100%;border-collapse:collapse}
    th,td{border:1px solid var(--line);padding:7px 8px;text-align:left;vertical-align:top}
    th{background:#10191d;color:#dceff3;font-weight:760}
    td{background:#0b1114;color:#cdd9dd}
    .muted{color:var(--muted)}
    .small{font-size:10px}
    .source-list{margin:0;padding:0;list-style:none;display:grid;gap:5px}
    .source-list li{display:grid;grid-template-columns:88px 1fr;gap:8px;border-bottom:1px solid var(--line);padding-bottom:5px}
    .source-status{font-family:"SF Mono","Roboto Mono",Menlo,Consolas,monospace;color:var(--muted)}
    .ok{color:var(--green)}.fail{color:var(--red)}
    .method{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
    .method-card{border:1px solid var(--line);background:#0b1114;padding:9px}
    .method-card b{color:#fff}
    .watch-strip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    .watch-card{border:1px dashed var(--line2);background:#0a0e10;color:var(--muted);padding:9px}
    @media(max-width:1180px){.grid{grid-template-columns:1fr}.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.decision{grid-template-columns:1fr}.decision-main{border-right:0;border-bottom:1px solid var(--line2)}.conflicts,.method,.watch-strip{grid-template-columns:1fr}.status{text-align:left}.topbar{grid-template-columns:1fr}}
    @media(max-width:760px){:root{--day:46px;--name:168px}.app{padding:6px}.calendar{grid-template-columns:1fr}.day{min-height:88px}.kpis{grid-template-columns:1fr}h1{font-size:19px}.value{font-size:20px}.grid{padding:6px}.tl-row-name strong{font-size:13px}.source-list li{grid-template-columns:1fr}}
    @media print{body{background:#fff;color:#111}.app{max-width:none}.terminal,.panel{border-color:#999;background:#fff}.calendar,.grid{display:block}.timeline{overflow:visible}.status,.ticker{color:#111}}
  </style>
</head>
<body>
  <main class="app">
    <section class="terminal">
      <div class="topbar">
        <div>
          <h1>${escapeHtml(data.meta.siteTitleZh)} <span class="muted">/ ${escapeHtml(data.meta.siteTitleEn)}</span></h1>
          <div class="ticker">
            <span class="pill hot">LIVE WINDOW ${escapeHtml(data.meta.coverageLabel)}</span>
            <span class="pill warn">NEXT REFRESH ${escapeHtml(data.meta.nextRefreshLocal)}</span>
            <span class="pill red">NON-ADVICE</span>
            <span class="pill">${escapeHtml(data.scoreWindow.ruleZh)}</span>
          </div>
        </div>
        <div class="status">
          <b>更新于 ${escapeHtml(formatTimestamp(data.meta.fetchedAt))}</b>
          HKT / sources ${okSources}/${sourceCount}<br>
          数据状态 ${escapeHtml(data.meta.dataStatus || "unknown")}
        </div>
      </div>
      <div class="decision">
        <div class="decision-main">
          <b>${escapeHtml(data.decision.headlineZh)}</b>
          ${escapeHtml(data.decision.bodyZh)}
        </div>
        <div class="decision-side">
          <b>当前最高优先级</b>
          ${topOpen ? `${escapeHtml(topOpen.code)} ${escapeHtml(topOpen.nameZh)}：${escapeHtml(topOpen.actionZh)}` : "等待新增招股书。"}
        </div>
      </div>
      <div class="kpis">
        ${renderKpi("下一券商硬截止", "05-20 12:00", "00901 / 02723 / 03310")}
        ${renderKpi("下一官方打款截止", "05-21 12:00", "三只同窗公开发售")}
        ${renderKpi("下一退款释放", "05-20", "01511 / 07688 条件接力")}
        ${renderKpi("明确不可接力", "06872", "退款 05-22，错过 05-21")}
        ${renderKpi("最高分窗口", topOpen ? `${topOpen.code} ${topOpen.score.toFixed(1)}` : "-", topOpen ? topOpen.scoreLabelZh : "-")}
      </div>
    </section>

    <section class="grid">
      <div class="panel">
        <div class="panel-head">
          <h2>Month Calendar / 未来一个月事件日历</h2>
          <span class="muted">今日线：${escapeHtml(asOf)}</span>
        </div>
        <div class="panel-body">
          <div class="calendar">
            ${renderCalendar(days, data, holidays, asOf)}
          </div>
        </div>
      </div>
      <aside class="panel">
        <div class="panel-head">
          <h2>10D IPO Score / 打新评分</h2>
          <span class="muted">1-5</span>
        </div>
        <div class="panel-body score-list">
          ${scoredIpos.map(renderScoreCard).join("")}
        </div>
      </aside>
    </section>

    <section class="panel" style="margin:0 10px 10px">
      <div class="panel-head">
        <h2>Cash Turnover Timeline / 资金接力时间轴</h2>
        <span class="muted">B=券商截止 O=官方截止 A=结果 R=退款 L=上市</span>
      </div>
      <div class="timeline">
        <div class="tl-grid">
          <div class="tl-cell tl-head tl-name">标的</div>
          ${days.map((day) => `<div class="tl-cell tl-head">${escapeHtml(day.mmdd)}<br>${escapeHtml(day.dow)}</div>`).join("")}
          ${activeIpos.map((ipo) => renderTimelineRow(ipo, days)).join("")}
        </div>
      </div>
    </section>

    <section class="grid">
      <div class="panel">
        <div class="panel-head"><h2>Capital Conflict Matrix / 互斥资金矩阵</h2></div>
        <div class="panel-body">
          <div class="conflicts">
            ${(data.conflicts || []).map(renderConflict).join("")}
          </div>
        </div>
      </div>
      <aside class="panel">
        <div class="panel-head"><h2>Grey Zone / 远期灰区</h2></div>
        <div class="panel-body watch-strip">
          ${(data.watchlist || []).map((item) => `<div class="watch-card"><b>${escapeHtml(item.date)}</b><br>${escapeHtml(item.labelZh)}</div>`).join("")}
        </div>
      </aside>
    </section>

    <section class="grid">
      <div class="panel">
        <div class="panel-head"><h2>Daily Brief / 逐日提示</h2></div>
        <div class="panel-body">
          <table>
            <thead><tr><th>日期</th><th>事件</th><th>资金判断</th></tr></thead>
            <tbody>${(data.dailyNotes || []).map((note) => `<tr><td>${escapeHtml(note.date)}</td><td>${escapeHtml(note.titleZh)}</td><td>${escapeHtml(note.bodyZh)}</td></tr>`).join("")}</tbody>
          </table>
        </div>
      </div>
      <aside class="panel">
        <div class="panel-head"><h2>Score Method / 评分口径</h2></div>
        <div class="panel-body method">
          ${(data.methodology || []).map((item) => `<div class="method-card"><b>${escapeHtml(item.nameZh)} ${escapeHtml(item.weight)}</b><br><span class="muted">${escapeHtml(item.bodyZh)}</span></div>`).join("")}
        </div>
      </aside>
    </section>

    <section class="grid">
      <div class="panel">
        <div class="panel-head"><h2>Research Notes / 单票逻辑</h2></div>
        <div class="panel-body">
          <table>
            <thead><tr><th>代码</th><th>动作</th><th>克制理由</th><th>资金备注</th></tr></thead>
            <tbody>${scoredIpos.map(renderResearchRow).join("")}</tbody>
          </table>
        </div>
      </div>
      <aside class="panel">
        <div class="panel-head"><h2>Sources / 来源核验</h2></div>
        <div class="panel-body">
          <ul class="source-list">
            ${(data.sources || []).map((source) => renderSource(source, data.sourceChecks || [])).join("")}
          </ul>
        </div>
      </aside>
    </section>

    <section class="panel" style="margin:0 10px">
      <div class="panel-head"><h2>Disclaimer</h2></div>
      <div class="panel-body muted">${escapeHtml(data.meta.nonAdviceZh)}</div>
    </section>
  </main>
</body>
</html>`;
}

function renderKpi(label, value, note) {
  return `<div class="kpi"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div><div class="note">${escapeHtml(note)}</div></div>`;
}

function renderCalendar(days, data, holidays, asOf) {
  const events = eventsByDate(data);
  return days.map((day) => {
    const classes = ["day"];
    if (day.weekday === 0 || day.weekday === 6) classes.push("weekend");
    if (holidays.has(day.iso)) classes.push("holiday");
    if (day.iso === asOf) classes.push("today");
    const eventHtml = (events.get(day.iso) || [])
      .map((event) => `<div class="event ${event.type}">${escapeHtml(event.label)}</div>`)
      .join("");
    return `<div class="${classes.join(" ")}"><div class="date"><span>${escapeHtml(day.mmdd)}</span><span class="dow">${escapeHtml(day.dow)}</span></div>${eventHtml}</div>`;
  }).join("");
}

function renderTimelineRow(ipo, days) {
  const start = Math.max(0, dayIndex(days, dateOnly(ipo.offerStart)));
  const end = Math.max(start, dayIndex(days, ipo.listingDate || ipo.refundDate || dateOnly(ipo.officialCutoff)));
  const barClass = ipo.status === "open" ? "open" : ipo.status === "closed" ? "closed" : ipo.status === "to-list" ? "to-list" : "listed-reference";
  const markers = [
    ["B", ipo.brokerCutoff, "broker"],
    ["O", ipo.officialCutoff, "official"],
    ["A", ipo.resultTime, "result"],
    ["R", ipo.refundDate, "refund"],
    ["L", ipo.listingDate, "listing"]
  ].map(([label, value, type]) => renderMarker(label, value, type, days)).join("");

  return `<div class="tl-cell tl-name tl-row-name"><strong>${escapeHtml(ipo.code)}</strong><span>${escapeHtml(ipo.nameZh)} / ${escapeHtml(ipo.statusZh)}</span></div><div class="bar-row"><div class="bar ${barClass}" style="grid-column:${start + 1}/${end + 2}"><span>${escapeHtml(ipo.price)}</span><span>${escapeHtml(ipo.entryFee)}</span></div>${markers}</div>`;
}

function renderMarker(label, value, type, days) {
  if (!value) return "";
  const idx = dayIndex(days, dateOnly(value));
  if (idx < 0) return "";
  return `<span class="marker ${type}" style="grid-column:${idx + 1}">${escapeHtml(label)}</span>`;
}

function renderScoreCard(ipo) {
  const scoreClass = ipo.score >= 4.2 ? "high" : ipo.score >= 3.4 ? "mid" : "low";
  const breakdown = ipo.scoreBreakdown || {};
  const meters = [
    ["日程", breakdown.schedule],
    ["热度", breakdown.heat],
    ["资金", breakdown.cash],
    ["风险", breakdown.risk]
  ].map(([label, value]) => {
    const width = Math.max(0, Math.min(100, Number(value || 0) * 20));
    return `<div class="meter"><span>${escapeHtml(label)}</span><span class="track"><span class="fill" style="width:${width}%"></span></span><span>${Number(value || 0).toFixed(1)}</span></div>`;
  }).join("");
  return `<article class="score-card"><div class="score-top"><div><div class="score-code">${escapeHtml(ipo.code)} ${escapeHtml(ipo.nameZh)}</div><div class="brief">${escapeHtml(ipo.actionZh)}</div></div><div class="score-num ${scoreClass}">${ipo.score.toFixed(1)}</div></div><div class="meters">${meters}</div><div class="brief">${escapeHtml(ipo.scoreLabelZh)} · ${escapeHtml(ipo.entryFee)} · ${escapeHtml(ipo.statusZh)}</div></article>`;
}

function renderConflict(conflict) {
  return `<div class="conflict ${escapeHtml(conflict.type)}"><h3>${escapeHtml(conflict.titleZh)}</h3><b>${escapeHtml(conflict.verdictZh)}</b><p class="muted">${escapeHtml(conflict.bodyZh)}</p></div>`;
}

function renderResearchRow(ipo) {
  const thesis = (ipo.thesisZh || []).map((item) => `• ${escapeHtml(item)}`).join("<br>");
  return `<tr><td><b>${escapeHtml(ipo.code)}</b><br><span class="muted">${escapeHtml(ipo.nameZh)}</span></td><td>${escapeHtml(ipo.actionZh)}</td><td>${thesis}</td><td>${escapeHtml(ipo.capitalNoteZh || "")}</td></tr>`;
}

function renderSource(source, checks) {
  const check = checks.find((item) => item.id === source.id);
  const status = check ? (check.ok ? "VERIFIED" : "FAILED") : "PENDING";
  const klass = check ? (check.ok ? "ok" : "fail") : "";
  return `<li><span class="source-status ${klass}">${escapeHtml(status)}</span><span><a href="${escapeAttr(source.url)}">${escapeHtml(source.name)}</a></span></li>`;
}

function eventsByDate(data) {
  const map = new Map();
  const add = (date, label, type) => {
    if (!date) return;
    const iso = dateOnly(date);
    if (!map.has(iso)) map.set(iso, []);
    map.get(iso).push({ label, type });
  };
  for (const ipo of data.ipos || []) {
    add(ipo.brokerCutoff, `${ipo.code} 券商 ${timeOnly(ipo.brokerCutoff)}`, "broker");
    add(ipo.officialCutoff, `${ipo.code} 官方 ${timeOnly(ipo.officialCutoff)}`, "deadline");
    add(ipo.resultTime, `${ipo.code} 结果`, "result");
    add(ipo.refundDate, `${ipo.code} 退款`, "refund");
    add(ipo.listingDate, `${ipo.code} 上市`, "listing");
  }
  for (const note of data.dailyNotes || []) add(note.date, note.titleZh, "watch");
  for (const item of data.watchlist || []) add(item.date, item.labelZh, "watch");
  return map;
}

function calendarDays(start, end) {
  const days = [];
  const cursor = parseDate(start);
  const last = parseDate(end);
  while (cursor <= last) {
    const iso = toIsoDate(cursor);
    days.push({
      iso,
      mmdd: iso.slice(5).replace("-", "/"),
      dow: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][cursor.getUTCDay()],
      weekday: cursor.getUTCDay()
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function dayIndex(days, date) {
  return days.findIndex((day) => day.iso === date);
}

function parseDate(date) {
  return new Date(`${date}T00:00:00Z`);
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function dateOnly(value) {
  return String(value || "").slice(0, 10);
}

function timeOnly(value) {
  const text = String(value || "");
  const match = text.match(/T(\d{2}:\d{2})/);
  return match ? match[1] : "";
}

function formatTimestamp(value) {
  const text = String(value || "");
  return text.replace("T", " ").replace("+08:00", " HKT");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[ch]);
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}
