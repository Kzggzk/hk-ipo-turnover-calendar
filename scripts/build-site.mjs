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
  const displayIpos = data.ipos.filter((ipo) => ["to-list", "closed", "open"].includes(ipo.status));
  const openIpos = displayIpos.filter((ipo) => ipo.status === "open");
  const asOf = formatTimestamp(data.meta.fetchedAt);
  const okSources = data.audit?.okSourceCount ?? (data.sourceChecks || []).filter((source) => source.ok).length;
  const sourceCount = data.audit?.sourceCount ?? (data.sources || []).length;

  return `<!doctype html>
<html lang="zh-Hans">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="900">
  <title>${escapeHtml(data.meta.siteTitleZh)} | ${escapeHtml(data.meta.siteTitleEn)}</title>
  <style>
    :root{
      color-scheme:light;
      --bg:#f6f7f8;--page:#ffffff;--card:#ffffff;--soft:#f0f3f5;
      --text:#172027;--muted:#66737d;--line:#dfe5e9;--line2:#cfd8df;
      --blue:#3f7dd7;--purple:#8c5cc3;--green:#4b9a5a;--orange:#e68a2f;--red:#c4584f;
      --shadow:0 14px 34px rgba(29,43,54,.08);--radius:18px;
    }
    body.dark{
      color-scheme:dark;
      --bg:#0d1114;--page:#11181d;--card:#151e24;--soft:#1b252b;
      --text:#eef4f6;--muted:#9aa8b1;--line:#2b3942;--line2:#42525d;
      --blue:#6fa3ff;--purple:#b58aff;--green:#74c885;--orange:#f0a456;--red:#ef8178;
      --shadow:0 18px 42px rgba(0,0,0,.24);
    }
    *{box-sizing:border-box}
    html,body{max-width:100%;overflow-x:hidden}
    body{margin:0;background:var(--bg);color:var(--text);font-family:Inter,-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI","PingFang SC","Microsoft YaHei",Arial,sans-serif;font-size:14px;line-height:1.45;letter-spacing:0}
    a{color:inherit}
    .app{max-width:1480px;margin:0 auto;padding:16px}
    .shell{min-height:calc(100vh - 32px);border:1px solid var(--line);border-radius:26px;background:var(--page);box-shadow:var(--shadow);padding:26px}
    .top{display:grid;grid-template-columns:1fr auto auto;gap:18px;align-items:start;margin-bottom:24px}
    h1{font-size:26px;line-height:1.05;margin:0;font-weight:780}
    .subtitle{margin-top:7px;color:var(--muted);font-size:15px}
    .controls{display:flex;gap:10px;align-items:center;justify-content:center}
    .seg,.stamp{display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:999px;background:var(--soft);padding:8px 10px;color:var(--muted);white-space:nowrap}
    button{border:0;background:transparent;color:var(--muted);border-radius:999px;padding:7px 11px;font:inherit;cursor:pointer}
    button.active{background:var(--card);color:var(--text);box-shadow:0 1px 3px rgba(0,0,0,.08)}
    .stamp{padding:11px 16px;font-size:13px}
    .timeline-card{border:1px solid var(--line);border-radius:24px;background:var(--card);padding:28px 24px 24px;position:relative}
    .microcopy{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px;color:var(--muted);font-size:13px}
    .microcopy span{border:1px solid var(--line);border-radius:999px;background:var(--soft);padding:7px 11px}
    .timeline-wrap{overflow-x:auto;overflow-y:visible;padding:8px 4px 24px;scrollbar-width:thin}
    .timeline{min-width:1180px;position:relative;display:grid;grid-template-columns:repeat(6,1fr);gap:16px;align-items:stretch}
    .timeline:before{content:"";position:absolute;left:34px;right:34px;top:66px;height:2px;background:var(--line2)}
    .timeline:after{content:"";position:absolute;right:28px;top:61px;border-left:10px solid var(--line2);border-top:6px solid transparent;border-bottom:6px solid transparent}
    .ipo{position:relative;z-index:2}
    .ipo:hover{z-index:50}
    .ipo-card{position:relative;border:1px solid var(--line2);border-radius:18px;background:linear-gradient(180deg,var(--card),var(--soft));padding:16px 14px;text-align:left;min-height:190px;cursor:default;transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease}
    .ipo-card:hover{transform:translateY(-4px);border-color:var(--blue);box-shadow:var(--shadow)}
    .code{font-size:17px;font-weight:760;font-variant-numeric:tabular-nums}
    .name{margin-top:7px;font-weight:700}
    .ename{margin-top:2px;color:var(--muted);font-size:12px}
    .score-chip{position:absolute;right:10px;top:10px;color:var(--muted);font-size:12px}
    .mini{display:grid;gap:9px;margin-top:18px}
    .mini-row{display:grid;grid-template-columns:54px 1fr;gap:10px;align-items:center;border:1px solid var(--line);border-radius:12px;background:color-mix(in srgb,var(--card) 70%,transparent);padding:9px 10px}
    .mini-k{color:var(--muted);font-size:12px}
    .mini-v{font-weight:760;font-variant-numeric:tabular-nums}
    .verdict{margin-top:10px;border-radius:12px;padding:10px 11px;font-weight:700;font-size:13px}
    .verdict.good{color:var(--green);background:color-mix(in srgb,var(--green) 10%,var(--card))}
    .verdict.bad{color:var(--red);background:color-mix(in srgb,var(--red) 10%,var(--card))}
    .verdict.warn{color:var(--orange);background:color-mix(in srgb,var(--orange) 12%,var(--card))}
    .tooltip{position:absolute;left:100%;top:0;z-index:30;width:390px;max-width:calc(100vw - 48px);transform:translateX(12px) translateY(8px);opacity:0;pointer-events:none;transition:opacity .14s ease,transform .14s ease;border:1px solid var(--line2);border-radius:18px;background:var(--card);box-shadow:var(--shadow);padding:16px;text-align:left}
    .ipo-card:hover .tooltip{opacity:1;transform:translateX(12px) translateY(0)}
    .ipo:nth-last-child(-n+2) .tooltip{left:auto;right:100%;transform:translateX(-12px) translateY(8px)}
    .ipo:nth-last-child(-n+2) .ipo-card:hover .tooltip{transform:translateX(-12px) translateY(0)}
    .tip-row{display:grid;grid-template-columns:90px 1fr;gap:10px;padding:7px 0;border-bottom:1px solid var(--line)}
    .tip-row:last-child{border-bottom:0}
    .tip-key{color:var(--muted)}
    .tip-value{font-weight:620}
    .tip-value.good{color:var(--green)}.tip-value.bad{color:var(--red)}.tip-value.warn{color:var(--orange)}
    .summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin-top:20px}
    .summary-card{border:1px solid var(--line);border-radius:18px;background:var(--card);padding:18px;min-height:152px}
    .summary-card.good{background:color-mix(in srgb,var(--green) 7%,var(--card));border-color:color-mix(in srgb,var(--green) 35%,var(--line))}
    .summary-card.bad{background:color-mix(in srgb,var(--red) 7%,var(--card));border-color:color-mix(in srgb,var(--red) 35%,var(--line))}
    .summary-card.same{background:color-mix(in srgb,var(--orange) 9%,var(--card));border-color:color-mix(in srgb,var(--orange) 38%,var(--line))}
    .summary-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:14px;font-size:18px;font-weight:760}
    .summary-list{display:grid;gap:8px}
    .summary-line{display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid var(--line);border-radius:10px;background:color-mix(in srgb,var(--card) 74%,transparent);padding:8px 10px}
    .muted{color:var(--muted)}
    .en{display:none}body.en-mode .zh{display:none}body.en-mode .en{display:inline}body.en-mode .zh-block{display:none}body:not(.en-mode) .en-block{display:none}
    .hide-mobile{display:inline}
    @media(max-width:980px){.top{grid-template-columns:1fr}.controls{justify-content:flex-start}.stamp{width:max-content}.summary{grid-template-columns:1fr}.shell{padding:18px;border-radius:22px}.timeline-card{padding:18px 12px}.timeline-wrap{padding-left:0;padding-right:0}.hide-mobile{display:none}}
    @media(max-width:560px){.app{padding:8px}.shell{padding:14px}.top{gap:12px}h1{font-size:23px}.controls{flex-wrap:wrap}.seg,.stamp{max-width:100%;white-space:normal}.timeline{min-width:1120px}.tooltip{width:340px}.summary-card{min-height:auto}}
  </style>
</head>
<body>
  <main class="app">
    <section class="shell">
      <header class="top">
        <div>
          <h1><span class="zh">港股打新现金接力时间轴</span><span class="en">HK IPO Cash Relay Timeline</span></h1>
          <div class="subtitle"><span class="zh">付款、配发、退款、上市。只回答一件事：钱回不回来得及。</span><span class="en">Payment, allotment, refund, listing. One question: can the cash catch the next deal?</span></div>
        </div>
        <div class="controls" aria-label="view controls">
          <div class="seg"><button id="zhBtn" class="active" type="button">简体</button><button id="enBtn" type="button">EN</button></div>
          <div class="seg"><button id="lightBtn" class="active" type="button">浅色</button><button id="darkBtn" type="button">深色</button></div>
        </div>
        <div class="stamp"><span class="zh">更新于</span><span class="en">Updated</span> ${escapeHtml(asOf)} · ${okSources}/${sourceCount}</div>
      </header>

      <section class="timeline-card">
        <div class="microcopy">
          <span><span class="zh">每张卡只看付款和退款</span><span class="en">Each card shows only pay and refund</span></span>
          <span><span class="zh">悬停查看评分、来源、配发、上市</span><span class="en">Hover for score, sources, allotment, listing</span></span>
        </div>
        <div class="timeline-wrap" aria-label="cash relay timeline">
          <div class="timeline">
            ${displayIpos.map((ipo, index) => renderIpo(ipo, index, displayIpos.length)).join("")}
          </div>
        </div>
      </section>

      <section class="summary">
        ${renderRelayCard("good", "可接力", "Can Relay", [
          ["01511 / 07688", "05/20 退款，只有上午到账才可接 05/20 券商截止"],
          ["06872", "05/22 退款，可接 05/23 后的新波次"]
        ])}
        ${renderRelayCard("bad", "不可接力", "Cannot Relay", [
          ["06872 -> 三只同窗", "退款 05/22，晚于 05/21 官方截止"],
          ["未显示可用现金", "一律按不能接力处理"]
        ])}
        ${renderRelayCard("same", "同窗期", "Choose One", openIpos.map((ipo) => [ipo.code, `${ipo.nameZh} · 05/20 券商 / 05/21 官方`]))}
      </section>
    </section>
  </main>
  <script>
    const body=document.body;
    const zhBtn=document.getElementById('zhBtn'),enBtn=document.getElementById('enBtn'),lightBtn=document.getElementById('lightBtn'),darkBtn=document.getElementById('darkBtn');
    zhBtn.addEventListener('click',()=>{body.classList.remove('en-mode');zhBtn.classList.add('active');enBtn.classList.remove('active')});
    enBtn.addEventListener('click',()=>{body.classList.add('en-mode');enBtn.classList.add('active');zhBtn.classList.remove('active')});
    lightBtn.addEventListener('click',()=>{body.classList.remove('dark');lightBtn.classList.add('active');darkBtn.classList.remove('active')});
    darkBtn.addEventListener('click',()=>{body.classList.add('dark');darkBtn.classList.add('active');lightBtn.classList.remove('active')});
  </script>
</body>
</html>`;
}

function renderIpo(ipo, index, total) {
  const score = typeof ipo.score === "number" ? ipo.score.toFixed(1) : "--";
  const relay = relayVerdict(ipo);
  return `<article class="ipo">
    <div class="ipo-card">
      <span class="score-chip">${escapeHtml(score)}</span>
      <div class="code">${escapeHtml(ipo.code)}</div>
      <div class="name"><span class="zh">${escapeHtml(ipo.nameZh)}</span><span class="en">${escapeHtml(ipo.nameEn)}</span></div>
      <div class="ename">${escapeHtml(ipo.industryZh || ipo.statusZh)}</div>
      <div class="mini">
        <div class="mini-row"><span class="mini-k"><span class="zh">付款</span><span class="en">Pay</span></span><span class="mini-v">${escapeHtml(dateLabel(ipo.brokerCutoff || ipo.officialCutoff))}</span></div>
        <div class="mini-row"><span class="mini-k"><span class="zh">退款</span><span class="en">Refund</span></span><span class="mini-v">${escapeHtml(dateLabel(ipo.refundDate))}</span></div>
      </div>
      <div class="verdict ${relay.kind}">${escapeHtml(relay.short)}</div>
      <div class="tooltip">
        <div class="tip-row"><div class="tip-key"><span class="zh">打新评分</span><span class="en">Score</span></div><div class="tip-value">${escapeHtml(score)} / 5 · ${escapeHtml(ipo.scoreLabelZh || "")}</div></div>
        <div class="tip-row"><div class="tip-key"><span class="zh">接力结论</span><span class="en">Relay</span></div><div class="tip-value ${relay.kind === "bad" ? "bad" : relay.kind === "good" ? "good" : "warn"}">${escapeHtml(relay.text)}</div></div>
        <div class="tip-row"><div class="tip-key"><span class="zh">核心理由</span><span class="en">Reason</span></div><div>${escapeHtml((ipo.thesisZh || [ipo.actionZh || ""])[0])}</div></div>
        <div class="tip-row"><div class="tip-key"><span class="zh">资金占用</span><span class="en">Cash</span></div><div>${escapeHtml(ipo.entryFee || "-")} · ${escapeHtml(ipo.capitalNoteZh || "")}</div></div>
        <div class="tip-row"><div class="tip-key"><span class="zh">来源</span><span class="en">Sources</span></div><div class="muted">${escapeHtml((ipo.sourceRefs || []).slice(0,4).join(" / "))}</div></div>
      </div>
    </div>
  </article>`;
}

function renderRelayCard(kind, zhTitle, enTitle, rows) {
  return `<article class="summary-card ${kind}">
    <div class="summary-head"><span><span class="zh">${escapeHtml(zhTitle)}</span><span class="en">${escapeHtml(enTitle)}</span></span><span>${rows.length}</span></div>
    <div class="summary-list">
      ${rows.map(([left, right]) => `<div class="summary-line"><strong>${escapeHtml(left)}</strong><span class="muted">${escapeHtml(right)}</span></div>`).join("")}
    </div>
  </article>`;
}

function relayVerdict(ipo) {
  if (ipo.code === "06872") return { kind: "bad", short: "不能接 05/21", text: "不可接三只同窗；退款晚于截止" };
  if (["01511", "07688"].includes(ipo.code)) return { kind: "warn", short: "上午到账才可接", text: "条件接力：05/20 上午到账才算" };
  if (["02723", "03310", "00901"].includes(ipo.code)) return { kind: "warn", short: "同窗择一/分仓", text: "同窗互斥：同一笔钱只能择一或分仓" };
  return { kind: "good", short: "已释放", text: "已释放或只作观察" };
}

function dateLabel(value) {
  const text = String(value || "");
  const mmdd = text.slice(5, 10).replace("-", "/");
  const time = text.match(/T(\d{2}:\d{2})/)?.[1];
  return time ? `${mmdd} ${time}` : mmdd;
}

function formatTimestamp(value) {
  return String(value || "").replace("T", " ").replace("+08:00", " HKT");
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
