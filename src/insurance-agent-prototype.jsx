import { useState, useEffect, useRef } from "react";

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const VEHICLES = [
  { id: "luxury",  label: "Luxury (Tesla / BMW / MB)",  score: 0.88, life: "Whole Life — estate framing",       card: "Amex Platinum / Chase Sapphire"  },
  { id: "sports",  label: "Sports Car",                 score: 0.72, life: "Term Life — income protection",     card: "Cash Back / Travel Rewards"       },
  { id: "suv",     label: "Family SUV",                 score: 0.67, life: "Term Life — family protection",     card: "Rewards Card"                     },
  { id: "ev",      label: "EV (Non-Luxury)",            score: 0.62, life: "Term Life — standard",              card: "Green Rewards / EV Cashback"      },
  { id: "pickup",  label: "Pickup Truck / SUV",         score: 0.58, life: "Term Life — standard",              card: "Cashback / Hardware Rewards"      },
  { id: "older",   label: "Older / Low-Value",          score: 0.40, life: "Accidental Death Policy",           card: "Secured Credit Card"              },
];

const POLICIES = [
  { id: "comprehensive", label: "Comprehensive / High",  score: 0.90 },
  { id: "midtier",       label: "Mid-Tier",              score: 0.65 },
  { id: "standard",      label: "Standard",              score: 0.55 },
  { id: "minimum",       label: "Minimum Coverage",      score: 0.35 },
];

const GATE_DEFS = [
  { id: "g1", label: "SSN + Address Integrity",   icon: "🔐", type: "HARD_BLOCK", detail: "Salted SHA-256 hash match against address registry" },
  { id: "g2", label: "Accident History Gate",     icon: "⚠️", type: "ADJUST",    detail: "2+ accidents → +15% risk per accident, capped at 60%" },
  { id: "g3", label: "Life Insurance Boost",      icon: "💚", type: "BOOST",     detail: "Age > 55 AND dependents > 2 → BOOST (1.45× / −12% premium)" },
  { id: "g4", label: "Risk Scoring Engine",       icon: "📊", type: "SCORE",     detail: "Composite: 30% vehicle + 25% policy + 20% neighborhood + 15% age + 10% property" },
  { id: "g5", label: "Cross-Sell Orchestration",  icon: "🎯", type: "ROUTE",     detail: "Score > 0.65 threshold → Life + Credit Card agents activated" },
];

const AGENT_DEFS = [
  { id: "orchestrator", label: "Orchestrator",      abbr: "ORCH",   color: "#a78bfa", trigger: "Session start",   silent: false },
  { id: "intent",       label: "Intent Agent",      abbr: "INTENT", color: "#38bdf8", trigger: "First message",   silent: false },
  { id: "car",          label: "Car Insurance",     abbr: "CAR",    color: "#00e676", trigger: "Post Gate 1",     silent: false },
  { id: "risk",         label: "Risk Profiler",     abbr: "RISK",   color: "#fb923c", trigger: "Background",      silent: true  },
  { id: "life",         label: "Life Insurance",    abbr: "LIFE",   color: "#4ade80", trigger: "Score > 0.65",    silent: false },
  { id: "credit",       label: "Credit Card",       abbr: "CC",     color: "#fbbf24", trigger: "Score > 0.65",    silent: false },
];

const COLORS = {
  bg:        "#040d18",
  surface:   "#0b1d30",
  card:      "#0f2440",
  border:    "#163352",
  borderBright: "#1e4a78",
  green:     "#00e676",
  greenDim:  "#00b248",
  greenSurf: "#0a2218",
  text:      "#dff0ff",
  muted:     "#5f8ab0",
  dimmed:    "#3a5a7a",
  red:       "#ff4757",
  orange:    "#ffa502",
  gold:      "#ffd32a",
};

// ═══════════════════════════════════════════════════════════════
// BUSINESS LOGIC
// ═══════════════════════════════════════════════════════════════

function processGates(f) {
  const fraudFlag     = f.ssn.trim().startsWith("999");
  const accidents     = parseInt(f.accidents) || 0;
  const accidentAdj   = accidents >= 2 ? Math.min(0.15 * (accidents - 1), 0.60) : 0;
  const age           = parseInt(f.age) || 0;
  const deps          = parseInt(f.dependents) || 0;

  let lifeBoost = "STANDARD", lifeMultiplier = 1.0, lifePremiumDiscount = 0, lifeFraming = "income_protection";
  if (age > 55 && deps > 2) {
    lifeBoost = "BOOST"; lifeMultiplier = 1.45; lifePremiumDiscount = 12; lifeFraming = "legacy_and_dependent_protection";
  } else if (age > 55) {
    lifeBoost = "SOFT_BOOST"; lifeMultiplier = 1.15; lifePremiumDiscount = 5; lifeFraming = "retirement_security";
  } else if (deps > 2) {
    lifeBoost = "SOFT_BOOST"; lifeMultiplier = 1.20; lifePremiumDiscount = 6; lifeFraming = "family_income_replacement";
  }

  return { fraudFlag, accidents, accidentAdj, lifeBoost, lifeMultiplier, lifePremiumDiscount, lifeFraming };
}

function computeScore(f, g) {
  const v    = VEHICLES.find(x => x.id === f.vehicle) || VEHICLES[2];
  const p    = POLICIES.find(x => x.id === f.policy)  || POLICIES[1];
  const age  = Math.min((parseInt(f.age) || 35) / 65, 1.0);
  const zip  = Math.min(parseInt(f.zip?.slice(-4) || "5000") / 9999, 1.0);
  const base = 0.30 * v.score + 0.25 * p.score + 0.20 * zip + 0.15 * age + 0.10 * 0.6;
  return Math.min(base + g.accidentAdj * 0.25, 1.0);
}

// ── Car Insurance Premium Breakdown ──────────────────────────
function computeCarQuote(f, g) {
  const v       = VEHICLES.find(x => x.id === f.vehicle) || VEHICLES[2];
  const p       = POLICIES.find(x => x.id === f.policy)  || POLICIES[1];
  const age     = parseInt(f.age) || 40;
  const ageFactor = age > 65 ? 1.18 : age > 55 ? 1.08 : age < 25 ? 1.35 : 1.0;
  const accFactor = 1 + g.accidentAdj;

  // Base rates by vehicle type
  const bases = { luxury:420, sports:390, suv:280, ev:310, pickup:265, older:185 };
  const base  = bases[f.vehicle] || 280;

  // Policy multiplier
  const pMult = { comprehensive:1.0, midtier:0.72, standard:0.58, minimum:0.38 };
  const pm    = pMult[f.policy] || 0.72;

  const r = (n) => Math.round(n * pm * ageFactor * accFactor);

  const liability     = r(base * 0.30);
  const propDamage    = r(base * 0.18);
  const uninsured     = r(base * 0.12);
  const comprehensive = p.id === "minimum" ? 0 : r(base * 0.20);
  const collision     = p.id === "minimum" ? 0 : r(base * 0.28);
  const pip           = r(base * 0.08);               // Personal Injury Protection
  const total         = liability + propDamage + uninsured + comprehensive + collision + pip;

  return {
    lines: [
      { label:"Bodily Injury Liability",          sublabel:"$100k/$300k per occurrence",    monthly: liability,     included: true  },
      { label:"Property Damage Liability",         sublabel:"$100k per accident",            monthly: propDamage,    included: true  },
      { label:"Uninsured Motorist",                sublabel:"$100k/$300k UM / UIM",          monthly: uninsured,     included: true  },
      { label:"Personal Injury Protection (PIP)",  sublabel:"$10k medical, no-fault",        monthly: pip,           included: true  },
      { label:"Comprehensive",                     sublabel:"Theft, weather, non-collision",  monthly: comprehensive, included: p.id !== "minimum" },
      { label:"Collision",                         sublabel:"$500 deductible",               monthly: collision,     included: p.id !== "minimum" },
    ],
    total,
    annual: total * 12,
    policy: p.label,
    vehicle: v.label,
  };
}

// ── Life Insurance Options (58yo, healthy, non-smoker, social drinker) ──
function computeLifeOptions(f, g) {
  const age     = parseInt(f.age) || 58;
  const ageLoad = age > 65 ? 1.55 : age > 60 ? 1.30 : age > 55 ? 1.12 : 1.0;
  const boostDiscount = g.lifePremiumDiscount / 100;

  return [
    {
      id:          "term20",
      name:        "20-Year Term Life",
      coverage:    "$500,000",
      monthly:     Math.round(187 * ageLoad * (1 - boostDiscount)),
      highlight:   "Best value — pure protection",
      tag:         "RECOMMENDED",
      tagColor:    COLORS.green,
      features:    ["Level premiums for 20 years", "Convertible to permanent", "Accelerated death benefit rider", "Non-smoker preferred rate"],
      bestFor:     "Income replacement & dependents",
    },
    {
      id:          "whole",
      name:        "Whole Life",
      coverage:    "$250,000",
      monthly:     Math.round(312 * ageLoad * (1 - boostDiscount)),
      highlight:   "Builds tax-deferred cash value",
      tag:         "ESTATE PLANNING",
      tagColor:    "#a78bfa",
      features:    ["Guaranteed death benefit", "Cash value accumulation", "Dividend eligibility", "Estate framing — legacy transfer"],
      bestFor:     "Legacy & wealth transfer",
    },
    {
      id:          "universal",
      name:        "Universal Life",
      coverage:    "$350,000",
      monthly:     Math.round(245 * ageLoad * (1 - boostDiscount)),
      highlight:   "Flexible premiums + investment component",
      tag:         "FLEXIBLE",
      tagColor:    COLORS.gold,
      features:    ["Adjustable death benefit", "Flexible premium schedule", "Indexed cash value growth", "Long-term care rider available"],
      bestFor:     "Flexible planning horizon",
    },
  ];
}

// ── Credit Card Options by vehicle type ──
function computeCreditOptions(f) {
  const cardSets = {
    luxury:  [
      { name:"Amex Platinum",        network:"AMEX",  annualFee:695,  apr:"19.99%", rewards:"5x travel, 5x flights, $200 hotel credit", perks:["Airport lounge access","Global Entry credit","Concierge service"], tagColor:"#e5c97a", tag:"PREMIUM" },
      { name:"Chase Sapphire Reserve",network:"VISA",  annualFee:550,  apr:"22.49%", rewards:"3x dining & travel, 10x hotels via portal", perks:["$300 travel credit","Priority Pass lounges","Trip cancellation protection"], tagColor:"#a78bfa", tag:"TRAVEL" },
    ],
    sports:  [
      { name:"Chase Freedom Unlimited",network:"VISA", annualFee:0,   apr:"20.49%", rewards:"1.5% cash back on everything, 3% dining", perks:["No annual fee","Purchase protection","Extended warranty"], tagColor:COLORS.green, tag:"NO FEE" },
      { name:"Citi Double Cash",       network:"MC",   annualFee:0,   apr:"19.99%", rewards:"2% cash back — 1% purchase + 1% payoff", perks:["No annual fee","Balance transfer option","Identity theft protection"], tagColor:COLORS.gold, tag:"CASH BACK" },
    ],
    suv:     [
      { name:"Blue Cash Preferred",    network:"AMEX", annualFee:95,  apr:"19.24%", rewards:"6% US supermarkets, 3% gas, 3% transit", perks:["$84 Disney Bundle credit","Return protection","Car rental loss coverage"], tagColor:COLORS.green, tag:"FAMILY" },
      { name:"Capital One Savor",      network:"MC",   annualFee:95,  apr:"20.99%", rewards:"4% dining & entertainment, 3% groceries", perks:["Unlimited cash back","Travel accident insurance","Price protection"], tagColor:COLORS.gold, tag:"LIFESTYLE" },
    ],
    ev:      [
      { name:"Bank of America Travel", network:"VISA", annualFee:95,  apr:"18.99%", rewards:"3x travel, 1.5% all purchases + EV charging", perks:["EV charging rewards","$100 airline credit","No foreign transaction fees"], tagColor:COLORS.green, tag:"GREEN" },
      { name:"Wells Fargo Active Cash",network:"VISA", annualFee:0,   apr:"20.24%", rewards:"2% unlimited cash rewards on purchases", perks:["No annual fee","Cell phone protection","Zero liability protection"], tagColor:COLORS.gold, tag:"SIMPLE" },
    ],
    pickup:  [
      { name:"Costco Anywhere Visa",   network:"VISA", annualFee:0,   apr:"20.49%", rewards:"4% gas, 3% restaurants & travel, 2% Costco", perks:["No annual fee (with membership)","Damage & theft protection","Extended warranty"], tagColor:COLORS.green, tag:"GAS & SUPPLIES" },
      { name:"Discover it Cash Back",  network:"DISC", annualFee:0,   apr:"17.24%", rewards:"5% rotating categories, 1% all else", perks:["First-year cash back match","No annual fee","Free FICO score"], tagColor:COLORS.gold, tag:"CASH BACK" },
    ],
    older:   [
      { name:"Discover it Secured",    network:"DISC", annualFee:0,   apr:"28.24%", rewards:"2% gas & restaurants, 1% all else", perks:["Build/rebuild credit","$200 minimum deposit","Automatic credit review at 7 mo"], tagColor:COLORS.muted, tag:"SECURED" },
    ],
  };
  return cardSets[f.vehicle] || cardSets.suv;
}

function buildSystemPrompt(agentId, f, g, score) {
  const v   = VEHICLES.find(x => x.id === f.vehicle) || VEHICLES[2];
  const ctx = `
## LIVE CAG CONTEXT (Cache-Augmented Generation)
- Vehicle        : ${v.label}
- Policy Tier    : ${f.policy}
- Age            : ${f.age}  |  Dependents: ${f.dependents}  |  Accidents (3yr): ${f.accidents}
- Gate 2 Result  : ${g.accidentAdj > 0 ? `ADJUST — +${Math.round(g.accidentAdj * 100)}% risk load` : "PASS — no adjustment"}
- Gate 3 Result  : ${g.lifeBoost} (${g.lifePremiumDiscount}% premium discount eligible)
- Risk Score     : ${score.toFixed(3)} / 1.000
- Cross-Sell     : ${score > 0.65 ? "ACTIVE ✓" : "below threshold"}
- Life Product   : ${v.life}
- Card Product   : ${v.card}
DO_NOT_SAY: "retirement planning", "investment vehicle", raw SSN values, accident fault details`;

  switch (agentId) {
    case "car":
      return `You are the Car Insurance Agent in an AI-powered insurance system. Be professional, helpful, and concise.
Your role: Handle coverage questions, quote generation, and objection handling.
Keep every response to 2-3 sentences. Do NOT mention life insurance or credit cards — other agents handle cross-selling.
${ctx}`;
    case "life":
      return `You are the Life Insurance Agent. You've been triggered because the customer's risk score exceeds the cross-sell threshold.
Your ONLY job: Present ONE life insurance offer in exactly 2-3 sentences.
Product: ${v.life}
Framing: ${g.lifeFraming.replace(/_/g, " ")}
${g.lifePremiumDiscount > 0 ? `Include the ${g.lifePremiumDiscount}% premium discount as a highlight.` : ""}
End with a soft, single-sentence call to action. Do NOT discuss car insurance or credit cards.
${ctx}`;
    case "credit":
      return `You are the Credit Card Agent making a cross-sell offer. Be brief and enthusiastic.
Your ONLY job: Pitch ONE card in 1-2 sentences.
Card: ${v.card}
Frame it around their ${v.label} lifestyle and driving habits.
End with a one-line call to action.
${ctx}`;
    default:
      return `You are an AI insurance assistant. Be helpful, accurate, and concise.\n${ctx}`;
  }
}

async function callClaude(systemPrompt, history) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages: history.map(m => ({ role: m.role, content: m.content })),
    }),
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.content?.[0]?.text || "Connection error. Please try again.";
}

// ═══════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Space+Mono:wght@400;700&family=DM+Sans:wght@400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #040d18; }
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: #0b1d30; }
  ::-webkit-scrollbar-thumb { background: #163352; border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: #1e4a78; }

  @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:.4 } }
  @keyframes fadeUp { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
  @keyframes shimmer { from { left:-100% } to { left:200% } }
  @keyframes glow { 0%,100% { box-shadow:0 0 8px #00e67640 } 50% { box-shadow:0 0 20px #00e676a0 } }
  @keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
  @keyframes scanline { from { transform:translateY(-100%) } to { transform:translateY(100vh) } }

  .fade-up { animation: fadeUp 0.3s ease forwards; }
  .pulse { animation: pulse 1.4s infinite; }
  .spin { animation: spin 1s linear infinite; }
  .glow-green { animation: glow 2s ease infinite; }

  .gate-item { transition: all 0.3s ease; }
  .chat-input:focus { outline: none; border-color: #00e676 !important; box-shadow: 0 0 0 2px #00e67620; }
  .btn-primary:hover { background: #00e676 !important; color: #040d18 !important; }
  .btn-primary:active { transform: scale(0.97); }
  .agent-chip:hover { border-color: var(--agent-color) !important; }
  select:focus, input:focus { outline: none; }

  .thinking-dot { width:7px; height:7px; border-radius:50%; background:#00e676; display:inline-block; }
  .thinking-dot:nth-child(1) { animation: pulse 1.2s 0s infinite; }
  .thinking-dot:nth-child(2) { animation: pulse 1.2s 0.2s infinite; }
  .thinking-dot:nth-child(3) { animation: pulse 1.2s 0.4s infinite; }

  .score-bar { transition: width 1.2s cubic-bezier(.4,0,.2,1); }
  .gate-progress { transition: width 0.6s ease; }
`;

// ═══════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

function Logo() {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
      <div style={{ width:32, height:32, background:`linear-gradient(135deg, ${COLORS.green}, ${COLORS.greenDim})`, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>◈</div>
      <div>
        <div style={{ fontFamily:"'Syne', sans-serif", fontWeight:800, fontSize:15, letterSpacing:1, color:COLORS.text }}>AXON INSURANCE</div>
        <div style={{ fontFamily:"'Space Mono', monospace", fontSize:9, color:COLORS.muted, letterSpacing:2 }}>AI AGENT SYSTEM v2.0</div>
      </div>
    </div>
  );
}

function Tag({ children, color = COLORS.green, bg }) {
  return (
    <span style={{ fontFamily:"'Space Mono', monospace", fontSize:10, padding:"2px 7px", borderRadius:3, background: bg || `${color}18`, color, border:`1px solid ${color}40`, letterSpacing:0.5 }}>
      {children}
    </span>
  );
}

function AgentBadge({ agentId, status, small }) {
  const a = AGENT_DEFS.find(x => x.id === agentId);
  if (!a) return null;
  const isActive  = status === "active";
  const isDone    = status === "done";
  const isTriggered = status === "triggered";
  const isIdle    = status === "idle" || !status;

  const dotColor  = isActive ? a.color : isDone ? COLORS.muted : isTriggered ? COLORS.gold : COLORS.dimmed;
  const opacity   = isIdle ? 0.45 : 1;

  return (
    <div className="agent-chip" style={{ "--agent-color": a.color, display:"flex", alignItems:"center", gap:8, padding: small ? "5px 8px" : "8px 12px", borderRadius:8, background: isActive ? `${a.color}12` : COLORS.card, border:`1px solid ${isActive ? a.color + "50" : COLORS.border}`, opacity, transition:"all 0.3s" }}>
      <div style={{ width:7, height:7, borderRadius:"50%", background:dotColor, flexShrink:0, boxShadow: isActive ? `0 0 8px ${a.color}` : "none" }} className={isActive ? "pulse" : ""} />
      <div>
        <div style={{ fontFamily:"'Space Mono', monospace", fontSize: small ? 10 : 11, fontWeight:700, color: isActive ? a.color : COLORS.text, letterSpacing:0.5 }}>{a.abbr}</div>
        {!small && <div style={{ fontSize:10, color:COLORS.muted, marginTop:1 }}>{a.trigger}</div>}
      </div>
      {isActive && a.silent && <Tag color={COLORS.orange} small>SILENT</Tag>}
      {isTriggered && <Tag color={COLORS.gold}>QUEUED</Tag>}
    </div>
  );
}

function ScoreGauge({ score }) {
  const pct = Math.round(score * 100);
  const color = score > 0.65 ? COLORS.green : score > 0.45 ? COLORS.orange : COLORS.red;
  const segments = [
    { label:"Vehicle",     weight:"30%", val: Math.round(score * 30) },
    { label:"Policy",      weight:"25%", val: Math.round(score * 25) },
    { label:"Neighborhood",weight:"20%", val: Math.round(score * 20) },
    { label:"Age",         weight:"15%", val: Math.round(score * 15) },
    { label:"Property",    weight:"10%", val: Math.round(score * 10) },
  ];

  return (
    <div style={{ padding:"16px 14px", background:COLORS.card, borderRadius:12, border:`1px solid ${COLORS.border}` }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <span style={{ fontFamily:"'Space Mono', monospace", fontSize:11, color:COLORS.muted, letterSpacing:1 }}>RISK SCORE</span>
        <span style={{ fontFamily:"'Syne', sans-serif", fontSize:28, fontWeight:800, color, lineHeight:1 }}>{pct}<span style={{ fontSize:14, color:COLORS.muted }}>/100</span></span>
      </div>
      <div style={{ height:6, background:COLORS.border, borderRadius:3, marginBottom:12, overflow:"hidden" }}>
        <div className="score-bar" style={{ height:"100%", width:`${pct}%`, background:`linear-gradient(90deg, ${color}80, ${color})`, borderRadius:3 }} />
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
        <span style={{ fontSize:10, color: score > 0.65 ? COLORS.green : COLORS.muted }}>threshold: 0.65</span>
        <Tag color={score > 0.65 ? COLORS.green : COLORS.muted}>{score > 0.65 ? "CROSS-SELL ACTIVE" : "BELOW THRESHOLD"}</Tag>
      </div>
      <div style={{ borderTop:`1px solid ${COLORS.border}`, paddingTop:10, display:"flex", flexDirection:"column", gap:5 }}>
        {segments.map(s => (
          <div key={s.label} style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:70, fontSize:9, color:COLORS.muted, fontFamily:"'Space Mono', monospace" }}>{s.label}</div>
            <div style={{ flex:1, height:3, background:COLORS.border, borderRadius:2, overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${s.val * 3.3}%`, background:color + "90", borderRadius:2, transition:"width 1s ease" }} />
            </div>
            <div style={{ width:24, fontSize:9, color:COLORS.muted, fontFamily:"'Space Mono', monospace", textAlign:"right" }}>{s.weight}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GateResult({ gateId, status }) {
  const g = GATE_DEFS.find(x => x.id === gateId);
  if (!g) return null;

  const statusMap = {
    pending:   { color: COLORS.dimmed,  label: "—",       icon: "○" },
    running:   { color: COLORS.gold,    label: "RUNNING",  icon: "◌" },
    pass:      { color: COLORS.green,   label: "PASS",     icon: "●" },
    fail:      { color: COLORS.red,     label: "BLOCKED",  icon: "✕" },
    adjust:    { color: COLORS.orange,  label: "ADJUST",   icon: "▲" },
    boost:     { color: COLORS.green,   label: "BOOST",    icon: "↑" },
    softboost: { color: COLORS.gold,    label: "SOFT +",   icon: "↗" },
    score:     { color: COLORS.text,    label: "SCORED",   icon: "●" },
    route:     { color: COLORS.green,   label: "ROUTED",   icon: "→" },
  };
  const s = statusMap[status] || statusMap.pending;

  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 0", borderBottom:`1px solid ${COLORS.border}20` }}>
      <span style={{ fontSize:13, width:20, textAlign:"center" }}>{g.icon}</span>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:11, color:COLORS.text, fontWeight:500 }}>{g.label}</div>
      </div>
      <Tag color={s.color}>{s.label}</Tag>
    </div>
  );
}

function QuoteCard({ quote }) {
  const [sel, setSel] = useState(null);
  return (
    <div className="fade-up" style={{ marginBottom:16, maxWidth:"92%" }}>
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
        <div style={{ width:6, height:6, borderRadius:"50%", background:COLORS.green }} />
        <span style={{ fontFamily:"'Space Mono', monospace", fontSize:10, color:COLORS.green, letterSpacing:0.5 }}>CAR INSURANCE — QUOTE BREAKDOWN</span>
      </div>
      <div style={{ background:COLORS.card, border:`1px solid ${COLORS.border}`, borderRadius:12, overflow:"hidden" }}>
        {/* Header */}
        <div style={{ padding:"12px 16px", background:`${COLORS.green}10`, borderBottom:`1px solid ${COLORS.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:13, fontWeight:600, color:COLORS.text }}>{quote.vehicle}</div>
            <div style={{ fontSize:11, color:COLORS.muted }}>{quote.policy}</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontFamily:"'Syne', sans-serif", fontSize:24, fontWeight:800, color:COLORS.green, lineHeight:1 }}>${quote.total}<span style={{ fontSize:12, color:COLORS.muted }}>/mo</span></div>
            <div style={{ fontSize:10, color:COLORS.muted }}>${quote.annual.toLocaleString()}/year</div>
          </div>
        </div>
        {/* Line items */}
        <div style={{ padding:"4px 0" }}>
          {quote.lines.map((line, i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 16px", borderBottom: i < quote.lines.length - 1 ? `1px solid ${COLORS.border}30` : "none", opacity: line.included ? 1 : 0.4 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, color: line.included ? COLORS.text : COLORS.muted, fontWeight:500 }}>{line.label}</div>
                <div style={{ fontSize:10, color:COLORS.muted }}>{line.sublabel}</div>
              </div>
              <div style={{ fontFamily:"'Space Mono', monospace", fontSize:12, color: line.included ? COLORS.green : COLORS.dimmed, textAlign:"right", flexShrink:0, marginLeft:12 }}>
                {line.included ? `$${line.monthly}/mo` : "not included"}
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding:"10px 16px", borderTop:`1px solid ${COLORS.border}`, display:"flex", gap:8 }}>
          <button onClick={() => setSel(sel === "accept" ? null : "accept")} style={{ flex:1, padding:"8px 0", background: sel === "accept" ? COLORS.green : "transparent", border:`1px solid ${sel==="accept" ? COLORS.green : COLORS.border}`, borderRadius:8, color: sel === "accept" ? COLORS.bg : COLORS.muted, fontSize:11, fontFamily:"'Space Mono', monospace", cursor:"pointer", transition:"all 0.2s" }}>
            {sel === "accept" ? "✓ ACCEPTED" : "ACCEPT QUOTE"}
          </button>
          <button onClick={() => setSel(sel === "modify" ? null : "modify")} style={{ flex:1, padding:"8px 0", background:"transparent", border:`1px solid ${COLORS.border}`, borderRadius:8, color:COLORS.muted, fontSize:11, fontFamily:"'Space Mono', monospace", cursor:"pointer" }}>
            MODIFY COVERAGE
          </button>
        </div>
      </div>
    </div>
  );
}

function LifeOptionsCard({ options, discount }) {
  const [sel, setSel] = useState(null);
  return (
    <div className="fade-up" style={{ marginBottom:16, maxWidth:"94%" }}>
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
        <div style={{ width:6, height:6, borderRadius:"50%", background:"#4ade80" }} />
        <span style={{ fontFamily:"'Space Mono', monospace", fontSize:10, color:"#4ade80", letterSpacing:0.5 }}>LIFE INSURANCE — 3 OPTIONS</span>
        {discount > 0 && <Tag color={COLORS.green}>{discount}% BOOST DISCOUNT APPLIED</Tag>}
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {options.map(opt => (
          <div key={opt.id} onClick={() => setSel(sel === opt.id ? null : opt.id)} style={{ background: sel === opt.id ? `${opt.tagColor}18` : COLORS.card, border:`1.5px solid ${sel === opt.id ? opt.tagColor : COLORS.border}`, borderRadius:12, overflow:"hidden", cursor:"pointer", transition:"all 0.2s" }}>
            <div style={{ padding:"12px 16px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                    <span style={{ fontSize:13, fontWeight:600, color:COLORS.text }}>{opt.name}</span>
                    <Tag color={opt.tagColor}>{opt.tag}</Tag>
                  </div>
                  <div style={{ fontSize:11, color:COLORS.muted }}>{opt.highlight}</div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0, marginLeft:16 }}>
                  <div style={{ fontFamily:"'Syne', sans-serif", fontSize:20, fontWeight:800, color:opt.tagColor, lineHeight:1 }}>${opt.monthly}<span style={{ fontSize:10, color:COLORS.muted }}>/mo</span></div>
                  <div style={{ fontSize:10, color:COLORS.muted, marginTop:2 }}>{opt.coverage} coverage</div>
                </div>
              </div>
              <div style={{ fontSize:10, color:COLORS.muted, fontStyle:"italic" }}>Best for: {opt.bestFor}</div>
              {sel === opt.id && (
                <div style={{ marginTop:10, paddingTop:10, borderTop:`1px solid ${COLORS.border}` }}>
                  {opt.features.map((f, i) => <div key={i} style={{ fontSize:11, color:COLORS.text, padding:"2px 0" }}>✓ {f}</div>)}
                  <button style={{ marginTop:10, width:"100%", padding:"8px 0", background:opt.tagColor, border:"none", borderRadius:8, color:COLORS.bg, fontSize:11, fontFamily:"'Space Mono', monospace", fontWeight:700, cursor:"pointer" }}>
                    SELECT THIS PLAN →
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CreditOptionsCard({ options }) {
  const [sel, setSel] = useState(null);
  return (
    <div className="fade-up" style={{ marginBottom:16, maxWidth:"94%" }}>
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
        <div style={{ width:6, height:6, borderRadius:"50%", background:COLORS.gold }} />
        <span style={{ fontFamily:"'Space Mono', monospace", fontSize:10, color:COLORS.gold, letterSpacing:0.5 }}>CREDIT CARD — MATCHED OPTIONS</span>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {options.map(opt => (
          <div key={opt.name} onClick={() => setSel(sel === opt.name ? null : opt.name)} style={{ background: sel === opt.name ? `${opt.tagColor}15` : COLORS.card, border:`1.5px solid ${sel === opt.name ? opt.tagColor : COLORS.border}`, borderRadius:12, cursor:"pointer", transition:"all 0.2s", padding:"12px 16px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                  <span style={{ fontSize:13, fontWeight:600, color:COLORS.text }}>{opt.name}</span>
                  <Tag color={opt.tagColor}>{opt.tag}</Tag>
                  <span style={{ fontFamily:"'Space Mono', monospace", fontSize:9, color:COLORS.dimmed }}>{opt.network}</span>
                </div>
                <div style={{ fontSize:11, color:COLORS.muted }}>{opt.rewards}</div>
              </div>
              <div style={{ textAlign:"right", flexShrink:0, marginLeft:12 }}>
                <div style={{ fontFamily:"'Space Mono', monospace", fontSize:11, color: opt.annualFee === 0 ? COLORS.green : COLORS.gold }}>{opt.annualFee === 0 ? "NO ANNUAL FEE" : `$${opt.annualFee}/yr`}</div>
                <div style={{ fontSize:10, color:COLORS.muted }}>APR {opt.apr}</div>
              </div>
            </div>
            {sel === opt.name && (
              <div style={{ marginTop:10, paddingTop:10, borderTop:`1px solid ${COLORS.border}` }}>
                {opt.perks.map((p, i) => <div key={i} style={{ fontSize:11, color:COLORS.text, padding:"2px 0" }}>✓ {p}</div>)}
                <button style={{ marginTop:10, width:"100%", padding:"8px 0", background:opt.tagColor, border:"none", borderRadius:8, color:COLORS.bg, fontSize:11, fontFamily:"'Space Mono', monospace", fontWeight:700, cursor:"pointer" }}>
                  APPLY NOW →
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ChatBubble({ msg, form, gates, score }) {
  const isUser  = msg.role === "user";
  const agent   = AGENT_DEFS.find(a => a.id === msg.agent);
  const aColor  = agent?.color || COLORS.green;

  // Render rich product cards for special message types
  if (msg.type === "quote") return <QuoteCard quote={msg.quote} />;
  if (msg.type === "life_options") return <LifeOptionsCard options={msg.options} discount={msg.discount} />;
  if (msg.type === "credit_options") return <CreditOptionsCard options={msg.options} />;

  return (
    <div className="fade-up" style={{ display:"flex", flexDirection:"column", alignItems: isUser ? "flex-end" : "flex-start", marginBottom:16 }}>
      {!isUser && agent && (
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:5 }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background:aColor }} />
          <span style={{ fontFamily:"'Space Mono', monospace", fontSize:10, color:aColor, letterSpacing:0.5 }}>{agent.label.toUpperCase()}</span>
          {agent.silent && <Tag color={COLORS.orange}>SILENT</Tag>}
        </div>
      )}
      <div style={{
        maxWidth:"82%", padding:"10px 14px", borderRadius: isUser ? "14px 14px 4px 14px" : "4px 14px 14px 14px",
        background: isUser ? `linear-gradient(135deg, ${COLORS.green}20, ${COLORS.greenDim}30)` : COLORS.card,
        border: `1px solid ${isUser ? COLORS.green + "40" : COLORS.border}`,
        fontSize:14, lineHeight:1.6, color:COLORS.text,
      }}>
        {msg.content}
      </div>
    </div>
  );
}

function ThinkingIndicator({ agent }) {
  const a = AGENT_DEFS.find(x => x.id === agent);
  return (
    <div className="fade-up" style={{ display:"flex", flexDirection:"column", alignItems:"flex-start", marginBottom:16 }}>
      {a && (
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:5 }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background:a.color, animation:"pulse 1.2s infinite" }} />
          <span style={{ fontFamily:"'Space Mono', monospace", fontSize:10, color:a.color, letterSpacing:0.5 }}>{a.label.toUpperCase()}</span>
        </div>
      )}
      <div style={{ padding:"10px 16px", background:COLORS.card, border:`1px solid ${COLORS.border}`, borderRadius:"4px 14px 14px 14px", display:"flex", gap:5, alignItems:"center" }}>
        <div className="thinking-dot" /><div className="thinking-dot" /><div className="thinking-dot" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// VIEWS
// ═══════════════════════════════════════════════════════════════

function IntakeView({ form, setForm, onSubmit }) {
  const F = (key, val) => setForm(p => ({ ...p, [key]: val }));
  const inputStyle = { background:COLORS.surface, border:`1px solid ${COLORS.border}`, borderRadius:8, padding:"9px 12px", color:COLORS.text, fontSize:13, width:"100%", fontFamily:"inherit", transition:"border-color 0.2s" };
  const labelStyle = { fontSize:11, color:COLORS.muted, marginBottom:5, display:"block", fontFamily:"'Space Mono', monospace", letterSpacing:0.5 };

  return (
    <div style={{ minHeight:"100vh", background:COLORS.bg, display:"flex", alignItems:"center", justifyContent:"center", padding:24, fontFamily:"'DM Sans', sans-serif" }}>
      <div style={{ width:"100%", maxWidth:560 }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <Logo />
          <div style={{ marginTop:20 }}>
            <h1 style={{ fontFamily:"'Syne', sans-serif", fontWeight:800, fontSize:30, color:COLORS.text, letterSpacing:-0.5 }}>Customer Intake</h1>
            <p style={{ color:COLORS.muted, fontSize:14, marginTop:6 }}>5-gate AI pipeline with 6 specialist agents</p>
          </div>
        </div>

        <div style={{ background:COLORS.surface, borderRadius:16, border:`1px solid ${COLORS.border}`, padding:28 }}>
          {/* Vehicle & Policy */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>
            <div>
              <label style={labelStyle}>VEHICLE TYPE</label>
              <select value={form.vehicle} onChange={e => F("vehicle", e.target.value)} style={inputStyle}>
                {VEHICLES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>POLICY TIER</label>
              <select value={form.policy} onChange={e => F("policy", e.target.value)} style={inputStyle}>
                {POLICIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
          </div>

          {/* Age, Dependents, Accidents */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16, marginBottom:16 }}>
            <div>
              <label style={labelStyle}>AGE</label>
              <input type="number" value={form.age} onChange={e => F("age", e.target.value)} style={inputStyle} className="chat-input" min="18" max="90" />
            </div>
            <div>
              <label style={labelStyle}>DEPENDENTS</label>
              <input type="number" value={form.dependents} onChange={e => F("dependents", e.target.value)} style={inputStyle} className="chat-input" min="0" max="10" />
            </div>
            <div>
              <label style={labelStyle}>ACCIDENTS (3YR)</label>
              <input type="number" value={form.accidents} onChange={e => F("accidents", e.target.value)} style={inputStyle} className="chat-input" min="0" max="10" />
            </div>
          </div>

          {/* ZIP, SSN, Address */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>
            <div>
              <label style={labelStyle}>ZIP CODE</label>
              <input type="text" value={form.zip} onChange={e => F("zip", e.target.value)} style={inputStyle} className="chat-input" placeholder="33445" />
            </div>
            <div>
              <label style={labelStyle}>SSN (LAST 4) <Tag color={COLORS.muted}>DEMO</Tag></label>
              <input type="text" value={form.ssn} onChange={e => F("ssn", e.target.value)} style={inputStyle} className="chat-input" placeholder="Enter 999 to trigger fraud flag" />
            </div>
          </div>
          <div style={{ marginBottom:20 }}>
            <label style={labelStyle}>ADDRESS</label>
            <input type="text" value={form.address} onChange={e => F("address", e.target.value)} style={inputStyle} className="chat-input" />
          </div>

          <div style={{ background:COLORS.greenSurf, border:`1px solid ${COLORS.green}25`, borderRadius:8, padding:"10px 14px", marginBottom:20 }}>
            <div style={{ fontFamily:"'Space Mono', monospace", fontSize:10, color:COLORS.green, marginBottom:4 }}>💡 DEMO TIPS</div>
            <div style={{ fontSize:12, color:COLORS.muted, lineHeight:1.6 }}>
              • SSN starting with <strong style={{ color:COLORS.text }}>999</strong> → triggers fraud block<br />
              • Age <strong style={{ color:COLORS.text }}>&gt; 55</strong> + dependents <strong style={{ color:COLORS.text }}>&gt; 2</strong> → Life Boost activated<br />
              • Accidents <strong style={{ color:COLORS.text }}>≥ 2</strong> → risk adjustment applied<br />
              • Luxury/Sports vehicle → higher cross-sell score
            </div>
          </div>

          <button onClick={onSubmit} className="btn-primary" style={{ width:"100%", padding:"13px 24px", background:"transparent", border:`1.5px solid ${COLORS.green}`, borderRadius:10, color:COLORS.green, fontFamily:"'Space Mono', monospace", fontSize:13, fontWeight:700, letterSpacing:1, cursor:"pointer", transition:"all 0.2s" }}>
            RUN GATE PIPELINE →
          </button>
        </div>
      </div>
    </div>
  );
}

function GatesView({ gateAnim }) {
  const statusColors = { running: COLORS.gold, pass: COLORS.green, fail: COLORS.red, adjust: COLORS.orange, boost: COLORS.green, softboost: COLORS.gold, score: COLORS.text, route: COLORS.green };
  const statusLabels = { running: "RUNNING...", pass: "PASS ✓", fail: "HARD BLOCK ✕", adjust: "ADJUST ▲", boost: "BOOST ↑", softboost: "SOFT BOOST ↗", score: "COMPUTED ●", route: "ROUTED →" };

  return (
    <div style={{ minHeight:"100vh", background:COLORS.bg, display:"flex", alignItems:"center", justifyContent:"center", padding:24, fontFamily:"'DM Sans', sans-serif" }}>
      <div style={{ width:"100%", maxWidth:500 }}>
        <div style={{ textAlign:"center", marginBottom:36 }}>
          <Logo />
          <h2 style={{ fontFamily:"'Syne', sans-serif", fontSize:22, fontWeight:800, color:COLORS.text, marginTop:20 }}>Running Gate Pipeline</h2>
          <p style={{ color:COLORS.muted, fontSize:13, marginTop:6 }}>5-gate fraud detection & scoring sequence</p>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {GATE_DEFS.map((gate, i) => {
            const anim = gateAnim.find(g => g.id === gate.id);
            const status = anim?.status || "pending";
            const active = status === "running";
            const color  = statusColors[status] || COLORS.dimmed;
            const label  = statusLabels[status] || "WAITING";

            return (
              <div key={gate.id} className="gate-item fade-up" style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 18px", borderRadius:12, background: active ? `${COLORS.gold}12` : status !== "pending" ? COLORS.card : COLORS.surface, border:`1px solid ${active ? COLORS.gold + "60" : status !== "pending" ? color + "40" : COLORS.border}`, animationDelay:`${i * 0.08}s` }}>
                <div style={{ fontSize:22, flexShrink:0 }}>{gate.icon}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600, color: active ? COLORS.gold : status !== "pending" ? COLORS.text : COLORS.muted }}>{gate.label}</div>
                  <div style={{ fontSize:11, color:COLORS.muted, marginTop:2 }}>{gate.detail}</div>
                </div>
                <div style={{ fontFamily:"'Space Mono', monospace", fontSize:10, color, letterSpacing:0.5, textAlign:"right", flexShrink:0 }}>
                  {active ? <span className="pulse">{label}</span> : label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BlockedView({ onReset }) {
  return (
    <div style={{ minHeight:"100vh", background:COLORS.bg, display:"flex", alignItems:"center", justifyContent:"center", padding:24, fontFamily:"'DM Sans', sans-serif" }}>
      <div style={{ textAlign:"center", maxWidth:420 }}>
        <div style={{ fontSize:64, marginBottom:20 }}>🚨</div>
        <h2 style={{ fontFamily:"'Syne', sans-serif", fontWeight:800, fontSize:28, color:COLORS.red, marginBottom:12, letterSpacing:-0.5 }}>GATE 1 — HARD BLOCK</h2>
        <p style={{ color:COLORS.muted, fontSize:14, lineHeight:1.7, marginBottom:20 }}>
          SSN + address mismatch detected. A fraud flag has been created and routed to the compliance team.
          This session has been terminated.
        </p>
        <div style={{ background:`${COLORS.red}12`, border:`1px solid ${COLORS.red}40`, borderRadius:10, padding:"12px 16px", marginBottom:24, textAlign:"left" }}>
          <div style={{ fontFamily:"'Space Mono', monospace", fontSize:10, color:COLORS.red, marginBottom:8 }}>GATE 1 AUDIT LOG</div>
          {["SSN hash mismatch against address registry", "FraudFlag node created in knowledge graph", "Compliance officer notified (PII-safe alert)", "Session terminated — user sees generic message"].map((line, i) => (
            <div key={i} style={{ fontSize:12, color:COLORS.muted, padding:"3px 0", borderBottom: i < 3 ? `1px solid ${COLORS.border}30` : "none" }}>● {line}</div>
          ))}
        </div>
        <button onClick={onReset} style={{ padding:"11px 28px", background:"transparent", border:`1.5px solid ${COLORS.border}`, borderRadius:10, color:COLORS.muted, fontFamily:"'Space Mono', monospace", fontSize:12, cursor:"pointer" }}>
          ← START NEW SESSION
        </button>
      </div>
    </div>
  );
}

function ChatView({ form, gates, score, msgs, input, setInput, loading, onSend, agentStatus, crossSell, messagesEndRef, onReset }) {
  const vehicle = VEHICLES.find(v => v.id === form.vehicle) || VEHICLES[2];
  const activeAgent = msgs.length > 0 ? (msgs[msgs.length - 1].agent || "car") : "car";

  return (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column", background:COLORS.bg, fontFamily:"'DM Sans', sans-serif", overflow:"hidden" }}>
      {/* TOP BAR */}
      <div style={{ padding:"12px 20px", borderBottom:`1px solid ${COLORS.border}`, background:COLORS.surface, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <Logo />
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <Tag color={COLORS.green}>LIVE</Tag>
          <Tag color={COLORS.muted}>{vehicle.label}</Tag>
          <button onClick={onReset} style={{ padding:"5px 12px", background:"transparent", border:`1px solid ${COLORS.border}`, borderRadius:6, color:COLORS.muted, fontSize:11, fontFamily:"'Space Mono', monospace", cursor:"pointer" }}>RESET</button>
        </div>
      </div>

      <div style={{ flex:1, display:"grid", gridTemplateColumns:"220px 1fr 260px", overflow:"hidden" }}>

        {/* LEFT: AGENT NETWORK */}
        <div style={{ borderRight:`1px solid ${COLORS.border}`, padding:16, overflowY:"auto", background:COLORS.surface, display:"flex", flexDirection:"column", gap:8 }}>
          <div style={{ fontFamily:"'Space Mono', monospace", fontSize:10, color:COLORS.muted, letterSpacing:1.5, marginBottom:4 }}>AGENT NETWORK</div>
          {AGENT_DEFS.map(a => <AgentBadge key={a.id} agentId={a.id} status={agentStatus[a.id]} />)}

          <div style={{ marginTop:8, paddingTop:12, borderTop:`1px solid ${COLORS.border}` }}>
            <div style={{ fontFamily:"'Space Mono', monospace", fontSize:10, color:COLORS.muted, letterSpacing:1.5, marginBottom:8 }}>GATE STATUS</div>
            {GATE_DEFS.map((g, i) => {
              const statuses = ["pass", "pass", gates.lifeBoost !== "STANDARD" ? (gates.lifeBoost === "BOOST" ? "boost" : "softboost") : "pass", "score", score > 0.65 ? "route" : "pass"];
              return <GateResult key={g.id} gateId={g.id} status={statuses[i]} />;
            })}
          </div>
        </div>

        {/* CENTER: CHAT */}
        <div style={{ display:"flex", flexDirection:"column", overflow:"hidden" }}>
          <div style={{ flex:1, overflowY:"auto", padding:"20px 24px" }}>
            {msgs.map(m => <ChatBubble key={m.id} msg={m} form={form} gates={gates} score={score} />)}
            {loading && <ThinkingIndicator agent={activeAgent} />}
            <div ref={messagesEndRef} />
          </div>

          {/* INPUT */}
          <div style={{ padding:"14px 20px", borderTop:`1px solid ${COLORS.border}`, background:COLORS.surface, flexShrink:0 }}>
            <div style={{ display:"flex", gap:10, alignItems:"center" }}>
              <div style={{ flex:1, position:"relative" }}>
                <input
                  className="chat-input"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && onSend()}
                  placeholder="Ask about your coverage, rates, or policy options..."
                  style={{ width:"100%", background:COLORS.card, border:`1px solid ${COLORS.border}`, borderRadius:10, padding:"11px 16px", color:COLORS.text, fontSize:14, fontFamily:"inherit" }}
                  disabled={loading}
                />
              </div>
              <button onClick={onSend} disabled={loading || !input.trim()} style={{ padding:"11px 20px", background: input.trim() && !loading ? COLORS.green : COLORS.border, borderRadius:10, border:"none", color: input.trim() && !loading ? COLORS.bg : COLORS.muted, fontFamily:"'Space Mono', monospace", fontSize:12, fontWeight:700, cursor: input.trim() && !loading ? "pointer" : "default", transition:"all 0.2s", flexShrink:0 }}>
                SEND →
              </button>
            </div>
            <div style={{ marginTop:8, display:"flex", gap:8, flexWrap:"wrap" }}>
              {["What's covered?", "Show me a quote", "Tell me about life insurance"].map(q => (
                <button key={q} onClick={() => setInput(q)} style={{ padding:"4px 10px", background:"transparent", border:`1px solid ${COLORS.border}`, borderRadius:6, color:COLORS.muted, fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>{q}</button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: RISK + CROSS-SELL */}
        <div style={{ borderLeft:`1px solid ${COLORS.border}`, padding:16, overflowY:"auto", background:COLORS.surface, display:"flex", flexDirection:"column", gap:12 }}>
          <ScoreGauge score={score} />

          {/* Gate 2 */}
          {gates.accidentAdj > 0 && (
            <div style={{ padding:"12px 14px", background:`${COLORS.orange}12`, border:`1px solid ${COLORS.orange}40`, borderRadius:10 }}>
              <div style={{ fontFamily:"'Space Mono', monospace", fontSize:10, color:COLORS.orange, marginBottom:6 }}>⚠️ ACCIDENT ADJUSTMENT</div>
              <div style={{ fontSize:12, color:COLORS.text }}>{gates.accidents} accidents → <strong style={{ color:COLORS.orange }}>+{Math.round(gates.accidentAdj * 100)}%</strong> risk load applied</div>
            </div>
          )}

          {/* Gate 3 */}
          {gates.lifeBoost !== "STANDARD" && (
            <div style={{ padding:"12px 14px", background:`${COLORS.green}10`, border:`1px solid ${COLORS.green}35`, borderRadius:10 }}>
              <div style={{ fontFamily:"'Space Mono', monospace", fontSize:10, color:COLORS.green, marginBottom:6 }}>💚 LIFE BOOST: {gates.lifeBoost}</div>
              <div style={{ fontSize:12, color:COLORS.text }}>{gates.lifePremiumDiscount}% premium discount — {gates.lifeFraming.replace(/_/g," ")} framing</div>
            </div>
          )}

          {/* Cross-sell products */}
          {crossSell.life && (
            <div className="glow-green" style={{ padding:"12px 14px", background:`${COLORS.greenDim}15`, border:`1px solid ${COLORS.green}50`, borderRadius:10 }}>
              <div style={{ fontFamily:"'Space Mono', monospace", fontSize:10, color:COLORS.green, marginBottom:8 }}>LIFE AGENT — QUEUED</div>
              <div style={{ fontSize:13, fontWeight:600, color:COLORS.text, marginBottom:4 }}>{vehicle.life}</div>
              <div style={{ fontSize:11, color:COLORS.muted }}>Will pitch after 2nd exchange</div>
            </div>
          )}

          {crossSell.credit && (
            <div style={{ padding:"12px 14px", background:`${COLORS.gold}10`, border:`1px solid ${COLORS.gold}40`, borderRadius:10 }}>
              <div style={{ fontFamily:"'Space Mono', monospace", fontSize:10, color:COLORS.gold, marginBottom:8 }}>CC AGENT — QUEUED</div>
              <div style={{ fontSize:13, fontWeight:600, color:COLORS.text, marginBottom:4 }}>{vehicle.card}</div>
              <div style={{ fontSize:11, color:COLORS.muted }}>Will pitch after 4th exchange</div>
            </div>
          )}

          {/* Model info */}
          <div style={{ marginTop:"auto", padding:"10px 12px", background:COLORS.card, border:`1px solid ${COLORS.border}`, borderRadius:8 }}>
            <div style={{ fontFamily:"'Space Mono', monospace", fontSize:9, color:COLORS.muted, letterSpacing:1, marginBottom:6 }}>MODEL</div>
            <div style={{ fontFamily:"'Space Mono', monospace", fontSize:10, color:COLORS.text }}>claude-sonnet-4-20250514</div>
            <div style={{ fontSize:10, color:COLORS.muted, marginTop:4 }}>CAG context shared across agents</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

export default function App() {
  const [view,         setView]         = useState("intake");
  // Default to Luxury + Comprehensive so score always clears 0.65 in demo
  const [form,         setForm]         = useState({ vehicle:"luxury", policy:"comprehensive", age:"58", dependents:"3", accidents:"0", zip:"33445", ssn:"5678", address:"456 Oak Ave, Boca Raton FL" });
  const [gates,        setGates]        = useState(null);
  const [score,        setScore]        = useState(0);
  const [gateAnim,     setGateAnim]     = useState([]);
  const [msgs,         setMsgs]         = useState([]);
  const [input,        setInput]        = useState("");
  const [loading,      setLoading]      = useState(false);
  const [agentStatus,  setAgentStatus]  = useState({});
  const [crossSell,    setCrossSell]    = useState({ life:false, credit:false });
  const [msgCount,     setMsgCount]     = useState(0);
  const messagesEndRef = useRef(null);

  // ── Refs to avoid stale closures inside async sendMessage ──
  const crossSellRef = useRef({ life:false, credit:false });
  const msgCountRef  = useRef(0);
  const scoreRef     = useRef(0);
  const gatesRef     = useRef(null);
  const formRef      = useRef(form);
  const msgsRef      = useRef([]);

  // Keep refs in sync with state
  useEffect(() => { crossSellRef.current = crossSell; }, [crossSell]);
  useEffect(() => { msgCountRef.current  = msgCount;  }, [msgCount]);
  useEffect(() => { scoreRef.current     = score;     }, [score]);
  useEffect(() => { gatesRef.current     = gates;     }, [gates]);
  useEffect(() => { formRef.current      = form;      }, [form]);
  useEffect(() => { msgsRef.current      = msgs;      }, [msgs]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior:"smooth" }); }, [msgs, loading]);

  async function runGates(f) {
    setView("gates");
    setGateAnim([]);

    const g = processGates(f);
    const s = computeScore(f, g);

    for (let i = 0; i < GATE_DEFS.length; i++) {
      const gd = GATE_DEFS[i];
      setGateAnim(prev => [...prev.filter(x => x.id !== gd.id), { id:gd.id, status:"running" }]);
      await new Promise(r => setTimeout(r, 700));

      let status = "pass";
      if (i === 0 && g.fraudFlag)                                            status = "fail";
      else if (i === 1 && g.accidentAdj > 0)                                status = "adjust";
      else if (i === 2 && g.lifeBoost === "BOOST")                           status = "boost";
      else if (i === 2 && g.lifeBoost === "SOFT_BOOST")                      status = "softboost";
      else if (i === 3)                                                       status = "score";
      else if (i === 4)                                                       status = s > 0.65 ? "route" : "pass";

      setGateAnim(prev => prev.map(x => x.id === gd.id ? { ...x, status } : x));
      await new Promise(r => setTimeout(r, 450));

      if (status === "fail") {
        setGates(g); gatesRef.current = g;
        await new Promise(r => setTimeout(r, 900));
        setView("blocked");
        return;
      }
    }

    // Commit all session state — refs updated immediately so sendMessage reads them correctly
    const crossSellVal = { life: s > 0.65, credit: s > 0.65 };
    setGates(g);          gatesRef.current     = g;
    setScore(s);          scoreRef.current     = s;
    setCrossSell(crossSellVal); crossSellRef.current = crossSellVal;
    setMsgCount(1);       msgCountRef.current  = 1;
    formRef.current = f;

    await new Promise(r => setTimeout(r, 600));

    setAgentStatus({ orchestrator:"active", intent:"active", car:"active", risk:"active", life: s > 0.65 ? "triggered" : "idle", credit: s > 0.65 ? "triggered" : "idle" });

    const v = VEHICLES.find(x => x.id === f.vehicle) || VEHICLES[2];
    const policyDesc = f.policy === "comprehensive" ? "comprehensive coverage with full collision, comprehensive, and liability" : f.policy === "minimum" ? "minimum liability coverage" : "mid-tier coverage with standard collision and liability";
    const initMsg = [{ id:Date.now(), role:"assistant", agent:"car", content:`Welcome! I can see you're looking at ${v.label} coverage. Based on your profile, I'm prepared to offer you ${policyDesc}. What specific coverage questions do you have, or would you like me to walk you through a quote?` }];
    setMsgs(initMsg); msgsRef.current = initMsg;
    setView("chat");
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;

    // Read from refs — always current, no stale closure
    const currentMsgs      = msgsRef.current;
    const currentCount     = msgCountRef.current;
    const currentCrossSell = crossSellRef.current;
    const currentScore     = scoreRef.current;
    const currentGates     = gatesRef.current;
    const currentForm      = formRef.current;

    const userMsg = { id:Date.now(), role:"user", content:input };
    const history = [...currentMsgs, userMsg];
    setMsgs(history); msgsRef.current = history;
    setInput("");
    setLoading(true);

    const newCount = currentCount + 1;
    setMsgCount(newCount); msgCountRef.current = newCount;

    try {
      // Orchestrator routing:
      // 2nd user message → Life Insurance agent (if score > 0.65 and not yet pitched)
      // 3rd user message → Credit Card agent (if score > 0.65 and not yet pitched)
      // Otherwise → Car Insurance agent
      const lifePitched   = currentMsgs.some(m => m.agent === "life");
      const creditPitched = currentMsgs.some(m => m.agent === "credit");
      const quotePushed   = currentMsgs.some(m => m.type === "quote");

      let respondingAgent = "car";
      if      (newCount >= 3 && currentCrossSell.life   && !lifePitched)   respondingAgent = "life";
      else if (newCount >= 5 && currentCrossSell.credit && !creditPitched) respondingAgent = "credit";

      setAgentStatus(prev => ({ ...prev, [respondingAgent]:"active", risk:"active" }));

      const sys        = buildSystemPrompt(respondingAgent, currentForm, currentGates, currentScore);
      // Only pass text messages to the API (not card/quote messages)
      const apiHistory = history
        .filter(m => m.type !== "quote" && m.type !== "life_options" && m.type !== "credit_options")
        .map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.content }));
      const reply = await callClaude(sys, apiHistory);

      const agentMsg = { id:Date.now()+1, role:"assistant", agent:respondingAgent, content:reply };

      // After the agent text, automatically append the relevant product card
      const extraCards = [];

      if (respondingAgent === "car" && !quotePushed) {
        // First car agent response — push detailed premium quote card
        const quote = computeCarQuote(currentForm, currentGates);
        extraCards.push({ id:Date.now()+2, role:"assistant", type:"quote", quote });
      }

      if (respondingAgent === "life") {
        // Life agent just pitched — push 3 life insurance option cards
        const options = computeLifeOptions(currentForm, currentGates);
        extraCards.push({ id:Date.now()+2, role:"assistant", type:"life_options", options, discount: currentGates.lifePremiumDiscount });
      }

      if (respondingAgent === "credit") {
        // Credit agent just pitched — push matched credit card options
        const options = computeCreditOptions(currentForm);
        extraCards.push({ id:Date.now()+2, role:"assistant", type:"credit_options", options });
      }

      setMsgs(prev => {
        const next = [...prev, agentMsg, ...extraCards];
        msgsRef.current = next;
        return next;
      });
      setAgentStatus(prev => ({ ...prev, [respondingAgent]:"done", risk:"done", orchestrator:"active" }));
    } catch (err) {
      setMsgs(prev => { const next = [...prev, { id:Date.now(), role:"assistant", agent:"car", content:`Connection error: ${err.message}. Please check your API key and try again.` }]; msgsRef.current = next; return next; });
    }
    setLoading(false);
  }

  function reset() {
    const defaultForm = { vehicle:"luxury", policy:"comprehensive", age:"58", dependents:"3", accidents:"0", zip:"33445", ssn:"5678", address:"456 Oak Ave, Boca Raton FL" };
    setView("intake"); setForm(defaultForm); formRef.current = defaultForm;
    setGates(null); gatesRef.current = null;
    setScore(0); scoreRef.current = 0;
    setGateAnim([]); setMsgs([]); msgsRef.current = [];
    setInput(""); setLoading(false);
    setAgentStatus({});
    setCrossSell({ life:false, credit:false }); crossSellRef.current = { life:false, credit:false };
    setMsgCount(0); msgCountRef.current = 0;
  }

  return (
    <>
      <style>{css}</style>
      {view === "intake"  && <IntakeView form={form} setForm={setForm} onSubmit={() => runGates(form)} />}
      {view === "gates"   && <GatesView gateAnim={gateAnim} />}
      {view === "blocked" && <BlockedView onReset={reset} />}
      {view === "chat"    && <ChatView form={form} gates={gates} score={score} msgs={msgs} input={input} setInput={setInput} loading={loading} onSend={sendMessage} agentStatus={agentStatus} crossSell={crossSell} messagesEndRef={messagesEndRef} onReset={reset} />}
    </>
  );
}
