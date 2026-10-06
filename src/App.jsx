import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  ComposedChart,
  Area,
  Line,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceDot,
} from "recharts";
import {
  Play,
  TrendingUp,
  TrendingDown,
  Layers,
  Settings2,
  DollarSign,
  BarChart2,
  Percent,
  Shield,
  SlidersHorizontal,
  Activity,
  GripVertical,
  ChevronDown,
  X,
} from "lucide-react";
const DEFAULTS = {
  initialCapital: 100,
  baseLots: 0.1,
  riskPct: 0.3,
  rr: 2,
  // Reward:Risk model: "fixed" preserves the existing behavior; "range"
  // samples a bounded, center-weighted RR independently for each trade.
  rrMode: "fixed",
  rrMin: 0,
  rrMax: 2,
  feeMode: "perLot", // "perLot" | "turnover"
  feeBaseEntry: 0.1,
  feeBaseExit: 0.1,
  currentPrice: 2600,
  leverage: 1,
  entryFeeTurnoverPct: 0.045,
  exitFeeTurnoverPct: 0.045,
  cascadeMode: "profit", // Existing risk-allocation modes
  // On Profit+ (Cumulative Profit) settings. Only active when the new
  // profitCumulative allocation mode is selected.
  profitCumulativeAllocationPct: 30,
  profitCumulativeLossAdjustPct: -20,
  profitCumulativeFlipEnabled: true,
  profitCumulativeFlipAfterLosses: 5,
  winRiskPct: 65,
  lossRiskPct: 18,
  lossRiskAdjustPct: -1,
  perTradeCapPct: 70,
  overallCapPct: 30,
  // Risk Allocation reset: if calculated cascade risk reaches this % of
  // initial capital, the current trade risk is reset to this % of initial
  // capital. The next trade then continues normal Win/Loss cascade sizing.
  riskAllocationEnabled: true,
  riskAllocationTriggerPct: 100,
  riskAllocationResetPct: 50,
  slipMode: "percent",
  slipPct: 0,
  slipTicks: 1,
  tickValue: 0.15,
  entrySpread: 0,
  exitSpread: 0.2,
  winRate: 40,
  numTrades: 10,
  sweepStep: 10,
  sweepRuns: 100,
  batchCount: 200,
  // --- Day / F&O mode (Indian market) ---
  // Segment decides the sizing unit + statutory-charge rates: "intraday" (cash
  // equity — whole SHARE quantity, no lot concept), "options" or "futures"
  // (whole LOT quantity, fixed lot size per contract).
  fnoSegment: "intraday", // "intraday" | "options" | "futures"
  // Broker decides the brokerage formula. Named brokers use the exact,
  // reverse-engineered/published formula for that broker + segment. "custom"
  // falls back to the old freely-editable fee fields below.
  fnoBroker: "groww", // "groww" | "dhan" | "upstox" | "custom"
  fnoQuantity: 10, // Intraday only — baseline whole-share quantity
  fnoLots: 1, // Options/Futures only — baseline whole-lot count
  fnoLotSize: 65, // Options/Futures only — contract lot size (e.g. Nifty=75)
  fnoCurrentPrice: 22000,
  // Custom-broker fields only (ignored for named brokers, which use exact formulas)
  fnoFeeMode: "fixed", // "fixed" | "turnover"
  fnoFixedFee: 40,
  fnoFeeTurnoverPct: 0.03,
  // Other Charges combines STT + Exchange + SEBI + IPFT + Stamp Duty into a
  // single editable % of turnover, for every broker (named or custom).
  // Defaults to the real, current statutory total for the selected segment
  // (see FNO_STATUTORY_RATES / combinedStatutoryPct) and is re-seeded
  // whenever the segment changes, but stays fully user-editable.
  fnoOtherChargesPct: 0.03117, // intraday default: 0.025 + 0.00297 + 0.0001 + 0.0001 + 0.003
  // GST — tracked as its own separate %, applied on (brokerage + other
  // charges). Defaults to the standard 18% rate.
  fnoGstPct: 18,
  fnoEntrySpread: 0,
  fnoExitSpread: 0,
  // Named-broker (Groww/Dhan/Upstox) brokerage — editable so the numbers can
  // be corrected whenever a broker changes its published rates. Auto-filled
  // from FNO_BROKERAGE_DEFAULTS whenever the broker or segment is switched,
  // but the user can freely overwrite them afterwards. "custom" ignores
  // these and uses the Fixed/Turnover fields above instead.
  fnoBrokerageType: "perLeg", // "perLeg" | "turnover" | "flat" — set automatically per broker+segment
  fnoBrokerageRatePct: 0.1, // used by "perLeg" and "turnover" types
  fnoBrokerageMin: 5, // used by "perLeg" — per-leg floor in 
  fnoBrokerageMax: 20, // used by "perLeg" — per-leg cap in 
  fnoBrokerageFlatPerOrder: 20, // used by "flat" —  per executed order (round trip = 2 orders)
  // Broker leverage/MTF — e.g. some stocks allow 5x. Blank = no leverage applied.
  fnoLeverage: "",
  // --- Builder ---
  // Builder treats Total Risk as the full risk-allocation budget across the
  // selected trade set, then assigns the minimum equal slice to losses and
  // distributes the remaining budget across wins to maximize gross return.
  builderInitialCapital: 100,
  builderTotalRiskPct: 5,
  builderMinTrades: 5,
  builderMaxTrades: 10,
  // Builder sequence evaluation count. 100,000 is the hard maximum; the UI
  // automatically shows the smaller of this cap and the mathematically possible total.
  builderSequenceLimit: 100000,
  // Optional post-evaluation filter for W/L sequences. It never changes the
  // underlying simulation; it only keeps evaluated sequences matching the
  // user's structural loss-streak / final-P&L requirements.
  builderSequenceFilterEnabled: false,
  builderSequenceFilterOpen: false,
  builderSequenceFilterLeadingLosses: 2,
  builderSequenceFilterMatch: "atLeast", // "atLeast" | "exact"
  builderSequenceFilterFinalPnl: "green", // "green" | "red" | "any"
  builderSequenceFilterGreenByTrade: 0, // 0 = no recovery deadline
  // Builder search mode: "normal" keeps the original Builder; "target"
  // derives Auto Base Risk % and Auto Base Lots/Unit from a user-specified
  // target-point or risk-point distance while still respecting the Builder
  // total-risk budget and the same simulation engine.
  builderMode: "normal",
  builderTargetInputMode: "targetPoints", // "targetPoints" | "riskPoints"
  builderTargetValue: 0,
};

// ---- Broker + segment statutory charge rates (as % — divide by 100 to use) ----
// Current Sept 2026 rates (post 1-Apr-2026 STT hike on Options/Futures).
// Kept only as the reference table used to seed the combined "Other
// Charges %" field's default whenever the segment changes — the simulation
// itself no longer computes each of these individually (see
// combinedStatutoryPct / fnoOtherChargesPct).
const FNO_STATUTORY_RATES = {
  intraday: { stt: 0.025, exch: 0.00297, sebi: 0.0001, ipft: 0.0001, stamp: 0.003 },
  options: { stt: 0.15, exch: 0.03503, sebi: 0.0001, ipft: 0.0005, stamp: 0.003 },
  futures: { stt: 0.05, exch: 0.00173, sebi: 0.0001, ipft: 0.0001, stamp: 0.002 },
};

// Sums a segment's real statutory rates (STT + Exchange + SEBI + IPFT +
// Stamp Duty) into the single combined % used to seed "Other Charges %".
function combinedStatutoryPct(segment) {
  const r = FNO_STATUTORY_RATES[segment] || FNO_STATUTORY_RATES.intraday;
  return r.stt + r.exch + r.sebi + r.ipft + r.stamp;
}

// clamp(x, lo, hi) helper used by the "perLeg" brokerage formula
function clampVal(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x));
}

// Default brokerage formula + starting numbers for each named broker and
// segment, reverse-engineered from actual Groww/Dhan data and Upstox's
// published rate card. These are only the STARTING point shown in the
// Costs panel when a broker/segment is selected — every number here is
// editable in the UI, since real brokers change their rates over time.
//   type "perLeg"   → ratePct% of each leg's value, clamped to [min, max]
//   type "turnover" → ratePct% of total turnover (both legs combined)
//   type "flat"     → a flat fee per executed order (round trip = 2 orders)
const FNO_BROKERAGE_DEFAULTS = {
  groww: {
    intraday: { type: "perLeg", ratePct: 0.1, min: 5, max: 20 },
    options: { type: "flat", flatPerOrder: 20 },
    futures: { type: "flat", flatPerOrder: 20 },
  },
  dhan: {
    intraday: { type: "turnover", ratePct: 0.03 },
    options: { type: "flat", flatPerOrder: 20 },
    futures: { type: "flat", flatPerOrder: 20 },
  },
  upstox: {
    intraday: { type: "perLeg", ratePct: 0.1, min: 0, max: 20 },
    options: { type: "flat", flatPerOrder: 20 },
    futures: { type: "perLeg", ratePct: 0.05, min: 0, max: 20 },
  },
};

// Computes the broker-specific brokerage (before Other Charges/GST) for one
// round-trip trade, given each leg's traded value (price × quantity).
// Named brokers (groww/dhan/upstox) read their formula's numbers straight
// out of cfg (fnoBrokerageType/RatePct/Min/Max/FlatPerOrder) — those fields
// are seeded from FNO_BROKERAGE_DEFAULTS whenever the broker/segment is
// switched, but stay fully user-editable. "custom" keeps its own
// independent Fixed/Turnover fields.
function computeFnoBrokerage(broker, segment, buyValue, sellValue, cfg) {
  if (broker === "custom") {
    const turnover = buyValue + sellValue;
    return cfg.fnoFeeMode === "turnover"
      ? turnover * (cfg.fnoFeeTurnoverPct / 100)
      : cfg.fnoFixedFee;
  }

  const type = cfg.fnoBrokerageType;
  const ratePct = Number(cfg.fnoBrokerageRatePct) || 0;

  if (type === "turnover") {
    return (buyValue + sellValue) * (ratePct / 100);
  }
  if (type === "flat") {
    // Flat fee is charged per executed order; a round trip is 2 orders.
    return (Number(cfg.fnoBrokerageFlatPerOrder) || 0) * 2;
  }
  // "perLeg" (default): ratePct% per leg, clamped between Min and Max.
  const min = Number(cfg.fnoBrokerageMin) || 0;
  const max = Number(cfg.fnoBrokerageMax) || Infinity;
  return clampVal(buyValue * (ratePct / 100), min, max) + clampVal(sellValue * (ratePct / 100), min, max);
}

// Splits the single "Other Charges %" into its real statutory components
// (STT, Stamp Duty, Exchange+SEBI+IPFT) using the segment's known rate
// ratios (FNO_STATUTORY_RATES) and applies each to the base it's actually
// charged on:
//   - STT is charged on the SELL side only (not both legs)
//   - Stamp Duty is charged on the BUY side only (not both legs)
//   - Exchange + SEBI + IPFT are charged on full turnover (both legs)
// Applying one flat % to total turnover (as before) double-counts the
// sell-only and buy-only pieces — STT especially, since it's by far the
// largest component for Options/Futures — which is why Other Charges (and
// the GST built on top of it) came out roughly 40-70% too high.
// If the user edits "Other Charges %" away from the segment default (e.g.
// because a rate changed), the same component ratios are preserved by
// scaling every piece by the same factor.
// GST is charged only on Brokerage + Exchange/SEBI/IPFT — by law, GST does
// NOT apply to STT or Stamp Duty (they're government taxes, not a taxable
// broker service), so those two are excluded from the GST base.
function computeFnoOtherAndGst(segment, buyValue, sellValue, brokerageFee, otherChargesPct, gstPct) {
  const rates = FNO_STATUTORY_RATES[segment] || FNO_STATUTORY_RATES.intraday;
  const defaultTotalPct = combinedStatutoryPct(segment);
  const enteredPct = Number(otherChargesPct) || 0;
  const scale = defaultTotalPct > 0 ? enteredPct / defaultTotalPct : 0;

  const turnover = buyValue + sellValue;
  const sttCharge = sellValue * (rates.stt * scale) / 100;
  const stampCharge = buyValue * (rates.stamp * scale) / 100;
  const turnoverCharge = turnover * ((rates.exch + rates.sebi + rates.ipft) * scale) / 100;

  const otherCharges = sttCharge + stampCharge + turnoverCharge;
  const gst = (brokerageFee + turnoverCharge) * (Number(gstPct) || 0) / 100;
  return { otherCharges, gst, total: otherCharges + gst };
}

function fmtMoney(v) {
  const n = Number(v) || 0;
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtPct(v) {
  return Number(v).toFixed(2) + "%";
}
function fmtPct3(v) {
  return Number(v).toFixed(3) + "%";
}


function hashStringToUint32(value) {
  const text = String(value ?? "");
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Practical bounded RR model for Range mode. A triangular distribution keeps
// most winning outcomes near the middle of the chosen range while still
// allowing the configured min/max to occur. This avoids the unrealistic
// assumption that every RR inside the range is equally likely.
function sampleTriangularRR(min, max, rng = Math.random) {
  const lo = Math.max(0, Number(min) || 0);
  const hi = Math.max(lo, Number(max) || 0);
  if (hi <= lo + 1e-12) return lo;
  const mode = lo + (hi - lo) * 0.5;
  const u = Math.min(1 - Number.EPSILON, Math.max(Number.EPSILON, rng()));
  const split = (mode - lo) / (hi - lo);
  if (u <= split) {
    return lo + Math.sqrt(u * (hi - lo) * (mode - lo));
  }
  return hi - Math.sqrt((1 - u) * (hi - lo) * (hi - mode));
}

function sampleTradeRR(cfg, rng = Math.random) {
  if (cfg.rrMode !== "range") return Math.max(0, Number(cfg.rr) || 0);
  return sampleTriangularRR(cfg.rrMin, cfg.rrMax, rng);
}

function getSimulationRng(cfg) {
  return Number.isFinite(Number(cfg?._rrSeed))
    ? mulberry32(Number(cfg._rrSeed) >>> 0)
    : Math.random;
}



const RISK_ALLOCATION_MODES = [
  "profit",
  "profitCumulative",
  "capital",
];

const BUILDER_RISK_ALLOCATION_KEYS = [
  "cascadeMode",
  "profitCumulativeAllocationPct",
  "profitCumulativeLossAdjustPct",
  "profitCumulativeFlipEnabled",
  "profitCumulativeFlipAfterLosses",
  "winRiskPct",
  "lossRiskPct",
  "lossRiskAdjustPct",
  "riskAllocationEnabled",
  "riskAllocationTriggerPct",
  "riskAllocationResetPct",
];

function builderRiskAllocationFields(cfg) {
  const out = {};
  for (const key of BUILDER_RISK_ALLOCATION_KEYS) out[key] = cfg?.[key];
  return out;
}

function builderRiskAllocationSignature(cfg) {
  return JSON.stringify(builderRiskAllocationFields(cfg));
}

function riskAllocationModeLabel(mode) {
  const labels = {
    profit: "On Profit",
    profitCumulative: "On Profit+",
    capital: "On Capital",
  };
  return labels[RISK_ALLOCATION_MODES.includes(mode) ? mode : "profit"];
}

function getCumulativeProfitRiskState(cfg, consecutiveLosses) {
  // Keep the negative side above -100% so the mode can never dead-loop at
  // zero risk. Positive adjustments stay bounded and are still subject to the
  // existing Per-Trade Cap / Max Risk Cap later in the engine.
  const baseAdjustment = Math.max(
    -95,
    Math.min(100, Number(cfg.profitCumulativeLossAdjustPct) || 0)
  );
  const resetAfter = Math.max(1, Math.round(Number(cfg.profitCumulativeFlipAfterLosses) || 5));
  const flipEnabled = cfg.profitCumulativeFlipEnabled !== false;
  const lossCount = Math.max(0, Math.round(Number(consecutiveLosses) || 0));
  // N=5 means: after losses 1-5 use the configured sign; Trade 6 uses the
  // flipped sign. After losses 6-10 keep the flipped sign; Trade 11 flips back.
  const flipCount = flipEnabled ? Math.floor(lossCount / resetAfter) : 0;
  const effectiveAdjustment = flipCount % 2 === 1 ? -baseAdjustment : baseAdjustment;
  const factor = Math.max(0.05, 1 + effectiveAdjustment / 100);
  return { baseAdjustment, effectiveAdjustment, factor, flipCount, resetAfter, flipEnabled };
}

function getCumulativeProfitRiskAfterWin(cfg, cumulativeNetProfit, baseRiskAmt) {
  const allocationPct = Math.max(0, Math.min(100, Number(cfg.profitCumulativeAllocationPct) || 0));
  const pool = Number(cumulativeNetProfit) || 0;
  const allocated = Math.max(0, pool) * (allocationPct / 100);
  // Exact requested rule whenever cumulative NET realized profit is positive.
  // If the pool is zero/non-positive, using Base Risk avoids an impossible
  // negative or zero-risk next trade and keeps the simulator usable.
  return allocated > 0 ? allocated : baseRiskAmt;
}

function simulateFromSequence(cfg, winLossSeq, explicitRiskPlan = null) {
  const BASE_RISK_AMT = cfg.initialCapital * (cfg.riskPct / 100);
  const LOT_VALUE = BASE_RISK_AMT / cfg.baseLots;
  const feePerLotEntry = cfg.feeBaseEntry / cfg.baseLots;
  const feePerLotExit = cfg.feeBaseExit / cfg.baseLots;
  const isTurnoverFee = cfg.feeMode === "turnover";

  const isCapitalCascade = cfg.cascadeMode === "capital";

  let capital = cfg.initialCapital;
  let peak = cfg.initialCapital;
  let peakTradeIndex = 0; // trade number where cumulative profit peaked (== highest Cum. P/L in the log)
  let trough = cfg.initialCapital;
  let troughTradeIndex = null; // trade number where cumulative capital hit its lowest point (== lowest Cum. P/L in the log)
  let maxDD = 0;
  let maxDDValue = 0;
  let maxDDTradeIndex = null; // trade number where the biggest single peak-to-trough decline (% based) occurred — used only for the Max Drawdown stat, NOT the same thing as the lowest point on the equity curve
  let maxProfitValue = 0; // highest cumulative profit reached at any point in the run
  let maxLossValue = 0; // deepest cumulative loss reached at any point in the run (<= 0)
  let prevNet = null;
  let prevWin = null;
  let hasWon = false;        // has any trade in this run won yet?
  let lastProfitNet = null;  // net profit of the most recent WIN
  let consecutiveLosses = 0; // consecutive losses since the last win (or since the start, if no win yet)
  let cumulativeNetProfit = 0;
  let previousExecutedRiskAmt = null;
  let currentProfitCumulativeAdjustment = Number(cfg.profitCumulativeLossAdjustPct) || 0;
  let currentProfitCumulativeFlipCount = 0;
  let price = Number(cfg.currentPrice) || 0; // running instrument price (drives turnover fee + is itself driven by each trade's gross P/L)

  const trades = [];
  let stopped = false;
  let stopReason = null;

  const numTrades = Math.min(cfg.numTrades, winLossSeq.length);
  const rrRng = getSimulationRng(cfg);

  for (let i = 1; i <= numTrades; i++) {
    let riskAmt;

    if (Array.isArray(explicitRiskPlan)) {
      // Builder mode can supply an explicit, already-allocated risk plan.
      // The plan is scaled to the Builder Total Risk Budget before it reaches
      // this engine, so keep the regular cascade/reset logic out of this path.
      riskAmt = Number(explicitRiskPlan[i - 1]) || 0;
    } else if (i === 1) {
      // Trade 1 always starts at the fixed base risk in every allocation model.
      riskAmt = BASE_RISK_AMT;
    } else if (cfg.cascadeMode === "profitCumulative") {
      // On Profit+ (Cumulative):
      // WIN  -> next risk = cumulative NET realized profit × allocation %.
      // LOSS -> next risk = previous EXECUTED risk × current adjustment %.
      // After N consecutive losses the adjustment flips sign for the NEXT trade.
      // A WIN resets only the losing-streak/flip state; cumulative profit stays.
      if (prevWin) {
        riskAmt = getCumulativeProfitRiskAfterWin(cfg, cumulativeNetProfit, BASE_RISK_AMT);
      } else {
        const previousRisk = Math.max(0, Number(previousExecutedRiskAmt) || BASE_RISK_AMT);
        const state = getCumulativeProfitRiskState(cfg, consecutiveLosses);
        currentProfitCumulativeAdjustment = state.effectiveAdjustment;
        currentProfitCumulativeFlipCount = state.flipCount;
        riskAmt = previousRisk * state.factor;
      }
    } else if (cfg.cascadeMode === "profit" || cfg.cascadeMode === "capital") {
      // Existing On Profit / On Capital logic is intentionally preserved exactly.
      if (prevWin) {
        if (isCapitalCascade) {
          const builderCapitalMultiplier = Math.max(0, Number(cfg._builderCapitalRiskMultiplier) || 1);
          riskAmt = capital * (cfg.winRiskPct / 100) * builderCapitalMultiplier;
        } else if (prevNet <= 0) {
          riskAmt = BASE_RISK_AMT;
        } else {
          riskAmt = prevNet * (cfg.winRiskPct / 100);
        }
      } else if (!isCapitalCascade && !hasWon) {
        riskAmt = BASE_RISK_AMT;
      } else {
        const effectiveLossPct =
          cfg.lossRiskPct + (consecutiveLosses - 1) * cfg.lossRiskAdjustPct;
        if (effectiveLossPct <= 0) {
          stopped = true;
          stopReason = `Effective Loss Risk % dropped to ${effectiveLossPct.toFixed(
            1
          )}% after ${consecutiveLosses} consecutive losses${
            hasWon ? " since the last win" : ""
          } (base ${cfg.lossRiskPct}% ${
            cfg.lossRiskAdjustPct >= 0 ? "+" : ""
          }${cfg.lossRiskAdjustPct}% per extra loss). Simulation stopped before Trade ${i}.`;
          break;
        }
        if (isCapitalCascade) {
          const builderCapitalMultiplier = Math.max(0, Number(cfg._builderCapitalRiskMultiplier) || 1);
          riskAmt = capital * (effectiveLossPct / 100) * builderCapitalMultiplier;
        } else if (lastProfitNet <= 0) {
          riskAmt = BASE_RISK_AMT;
        } else {
          riskAmt = lastProfitNet * (effectiveLossPct / 100);
        }
      }
    } else {
      // Only the supported allocation modes are accepted.
      riskAmt = BASE_RISK_AMT;
    }

    // Safety net for any other path that could still slip through negative
    // (e.g. an "On Capital" run where capital itself has gone negative).
    riskAmt = Math.max(0, riskAmt);
    const allocationReset = Array.isArray(explicitRiskPlan)
      ? { riskAmt, resetApplied: false }
      : applyRiskAllocationReset(cfg, riskAmt);
    riskAmt = allocationReset.riskAmt;

    const lots = riskAmt / LOT_VALUE;

    if (riskAmt > capital * (cfg.perTradeCapPct / 100)) {
      stopped = true;
      stopReason = `Trade ${i} risk (${fmtMoney(riskAmt)}) exceeded ${cfg.perTradeCapPct}% of current capital (${fmtMoney(capital)}).`;
      break;
    }

   
    const entryPrice = price + (cfg.entrySpread || 0);
    const isWin = !!winLossSeq[i - 1];
    // Draw one RR realization per trade in Range mode. Losses remain -1R.
    const tradeRR = sampleTradeRR(cfg, rrRng);
    const grossPL = isWin ? riskAmt * tradeRR : -riskAmt;

    
    const priceChange = lots !== 0 ? grossPL / lots : 0;
    const trueExitPrice = price + priceChange; // clean market move, no spread
    const exitPrice = trueExitPrice - (cfg.exitSpread || 0);

    
    let fee;
    if (isTurnoverFee) {
      const entryFee = entryPrice * lots * (cfg.entryFeeTurnoverPct / 100);
      const exitFee = exitPrice * lots * (cfg.exitFeeTurnoverPct / 100);
      fee = entryFee + exitFee;
    } else {
      fee = lots * feePerLotEntry + lots * feePerLotExit;
    }

    
    const slip =
      cfg.slipMode === "ticks"
        ? lots * cfg.slipTicks * cfg.tickValue
        : lots * entryPrice * (cfg.slipPct / 100);
   

    const spreadCost = lots * ((cfg.entrySpread || 0) + (cfg.exitSpread || 0));
    const netPL = grossPL - fee - slip - spreadCost;
    capital += netPL;

    price = trueExitPrice; // baseline carries forward clean, unaffected by spread

    trades.push({
      n: i,
      win: isWin,
      rr: isWin ? tradeRR : -1,
      risk: riskAmt,
      riskAllocationReset: allocationReset.resetApplied,
      lots,
      entryPrice,
      price: exitPrice,
      grossPL,
      fee,
      slip,
      spreadCost,
      netPL,
      capital,
      cumulativeNetProfit: cumulativeNetProfit + netPL,
      profitCumulativeLossAdjustment: cfg.cascadeMode === "profitCumulative" ? currentProfitCumulativeAdjustment : null,
      profitCumulativeFlipCount: cfg.cascadeMode === "profitCumulative" ? currentProfitCumulativeFlipCount : null,
    });

    if (capital > peak) {
      peak = capital;
      peakTradeIndex = i;
    }
    if (capital < trough) {
      trough = capital;
      troughTradeIndex = i;
    }
    const ddPct = ((peak - capital) / peak) * 100;
    if (ddPct > maxDD) {
      maxDD = ddPct;
      maxDDValue = peak - capital;
      maxDDTradeIndex = i;
    }
    maxProfitValue = Math.max(maxProfitValue, capital - cfg.initialCapital);
    maxLossValue = Math.min(maxLossValue, capital - cfg.initialCapital);

    cumulativeNetProfit += netPL;
    previousExecutedRiskAmt = riskAmt;

    if (isWin) {
      hasWon = true;
      lastProfitNet = netPL;
      // WIN reset semantics for On Profit+: reset only the losing-streak and
      // flip state. Cumulative net profit is NOT reset.
      consecutiveLosses = 0;
      currentProfitCumulativeAdjustment = Number(cfg.profitCumulativeLossAdjustPct) || 0;
      currentProfitCumulativeFlipCount = 0;
    } else {
      consecutiveLosses += 1;
      if (cfg.cascadeMode === "profitCumulative") {
        const state = getCumulativeProfitRiskState(cfg, consecutiveLosses);
        currentProfitCumulativeAdjustment = state.effectiveAdjustment;
        currentProfitCumulativeFlipCount = state.flipCount;
      }
    }

    prevNet = netPL;
    prevWin = isWin;

    const overallLossPct = ((cfg.initialCapital - capital) / cfg.initialCapital) * 100;
    if (overallLossPct >= cfg.overallCapPct) {
      stopped = true;
      stopReason = `Capital drawdown from initial capital reached ${overallLossPct.toFixed(1)}%, at or above the Max Risk Cap of ${cfg.overallCapPct}%.`;
      break;
    }
  }

  const wins = trades.filter((t) => t.win);
  const losses = trades.filter((t) => !t.win);
  const winRateActual = trades.length ? (wins.length / trades.length) * 100 : 0;
  const avgWin = wins.length ? wins.reduce((s, t) => s + t.netPL, 0) / wins.length : 0;
  const avgLoss = losses.length
    ? Math.abs(losses.reduce((s, t) => s + t.netPL, 0) / losses.length)
    : 0;
  const winSum = avgWin * wins.length;
  const lossSum = avgLoss * losses.length;
  const profitFactor = lossSum !== 0 ? winSum / lossSum : wins.length ? Infinity : 0;
  const totalLots = trades.reduce((s, t) => s + t.lots, 0);
  const avgLots = trades.length ? totalLots / trades.length : 0;
  const totalFees = trades.reduce((s, t) => s + t.fee, 0);
  const expectancy = trades.length ? (capital - cfg.initialCapital) / trades.length : 0;

  return {
    trades,
    stopped,
    stopReason,
    finalCapital: capital,
    finalPrice: trades.length ? trades[trades.length - 1].price : price,
    netPL: capital - cfg.initialCapital,
    winRateActual,
    maxDD,
    maxDDValue,
    maxDDTradeIndex,
    peakTradeIndex,
    troughTradeIndex,
    maxProfitValue,
    maxLossValue,
    profitFactor,
    avgLots,
    totalLots,
    totalFees,
    expectancy,
    winsCount: wins.length,
    lossesCount: losses.length,
  };
}


// Standard browser randomness. Each simulation run gets a fresh random sequence,
// matching the original simulator behavior.
function buildWinLossSeq(n, winRatePct, rng = Math.random) {
  const targetWins = Math.max(0, Math.min(n, Math.round(n * (winRatePct / 100))));
  const seq = Array.from({ length: n }, (_, i) => i < targetWins);
  for (let i = seq.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [seq[i], seq[j]] = [seq[j], seq[i]];
  }
  return seq;
}

function applyRiskAllocationReset(cfg, targetRiskAmt) {
  if (!cfg.riskAllocationEnabled) return { riskAmt: targetRiskAmt, resetApplied: false };
  const trigger = cfg.initialCapital * (cfg.riskAllocationTriggerPct / 100);
  if (trigger > 0 && targetRiskAmt >= trigger) {
    return {
      riskAmt: Math.max(0, cfg.initialCapital * (cfg.riskAllocationResetPct / 100)),
      resetApplied: true,
    };
  }
  return { riskAmt: targetRiskAmt, resetApplied: false };
}


function simulateFromSequenceFnO(cfg, winLossSeq, explicitRiskPlan = null) {
  const BASE_RISK_AMT = cfg.initialCapital * (cfg.riskPct / 100);
  const segment = cfg.fnoSegment === "options" || cfg.fnoSegment === "futures" ? cfg.fnoSegment : "intraday";
  const broker = ["groww", "dhan", "upstox", "custom"].includes(cfg.fnoBroker) ? cfg.fnoBroker : "groww";
  const isIntraday = segment === "intraday";
  // Intraday sizes in whole SHARES (no lot concept — any integer quantity is
  // tradeable). Options/Futures size in whole LOTS of a fixed contract size.
  const baseUnits = isIntraday
    ? Math.max(1, Math.round(cfg.fnoQuantity) || 1)
    : Math.max(1, Math.round(cfg.fnoLots) || 1);
  const lotSize = isIntraday ? 1 : Math.max(1, Math.round(cfg.fnoLotSize) || 1);
  const UNIT_VALUE = BASE_RISK_AMT / baseUnits; // risk amount represented by 1 share (intraday) or 1 lot (options/futures)
  // See simulateFromSequence for what these two cascade modes mean.
  const isCapitalCascade = cfg.cascadeMode === "capital";
  // Broker leverage/MTF: lets the same risk-based sizing control a bigger
  // notional position. Blank/0/negative all mean "no leverage" (1x) so the
  // simulation is unchanged when the field is left empty.
  const leverageFactor =
    cfg.fnoLeverage && Number(cfg.fnoLeverage) > 0 ? Number(cfg.fnoLeverage) : 1;

  let capital = cfg.initialCapital;
  let peak = cfg.initialCapital;
  let peakTradeIndex = 0;
  let trough = cfg.initialCapital;
  let troughTradeIndex = null;
  let maxDD = 0;
  let maxDDValue = 0;
  let maxDDTradeIndex = null;
  let maxProfitValue = 0;
  let maxLossValue = 0;
  let prevNet = null;
  let prevWin = null;
  let hasWon = false;
  let lastProfitNet = null;
  let consecutiveLosses = 0;
  let cumulativeNetProfit = 0;
  let previousExecutedRiskAmt = null;
  let currentProfitCumulativeAdjustment = Number(cfg.profitCumulativeLossAdjustPct) || 0;
  let currentProfitCumulativeFlipCount = 0;
  let price = Number(cfg.fnoCurrentPrice) || 0;

  const trades = [];
  let stopped = false;
  let stopReason = null;

  const numTrades = Math.min(cfg.numTrades, winLossSeq.length);
  const rrRng = getSimulationRng(cfg);

  for (let i = 1; i <= numTrades; i++) {
    let targetRiskAmt;

    if (Array.isArray(explicitRiskPlan)) {
      // Builder supplies a final risk allocation; all Day/F&O trading, costs
      // and safety-stop mechanics below still run exactly as usual.
      targetRiskAmt = Number(explicitRiskPlan[i - 1]) || 0;
    } else if (i === 1) {
      targetRiskAmt = BASE_RISK_AMT;
    } else if (cfg.cascadeMode === "profitCumulative") {
      if (prevWin) {
        targetRiskAmt = getCumulativeProfitRiskAfterWin(cfg, cumulativeNetProfit, BASE_RISK_AMT);
      } else {
        const previousRisk = Math.max(0, Number(previousExecutedRiskAmt) || BASE_RISK_AMT);
        const state = getCumulativeProfitRiskState(cfg, consecutiveLosses);
        currentProfitCumulativeAdjustment = state.effectiveAdjustment;
        currentProfitCumulativeFlipCount = state.flipCount;
        targetRiskAmt = previousRisk * state.factor;
      }
    } else if (cfg.cascadeMode === "profit" || cfg.cascadeMode === "capital") {
      if (prevWin) {
        if (isCapitalCascade) {
          const builderCapitalMultiplier = Math.max(0, Number(cfg._builderCapitalRiskMultiplier) || 1);
          targetRiskAmt = capital * (cfg.winRiskPct / 100) * builderCapitalMultiplier;
        } else if (prevNet <= 0) {
          targetRiskAmt = BASE_RISK_AMT;
        } else {
          targetRiskAmt = prevNet * (cfg.winRiskPct / 100);
        }
      } else if (!isCapitalCascade && !hasWon) {
        targetRiskAmt = BASE_RISK_AMT;
      } else {
        const effectiveLossPct =
          cfg.lossRiskPct + (consecutiveLosses - 1) * cfg.lossRiskAdjustPct;
        if (effectiveLossPct <= 0) {
          stopped = true;
          stopReason = `Effective Loss Risk % dropped to ${effectiveLossPct.toFixed(
            1
          )}% after ${consecutiveLosses} consecutive losses${
            hasWon ? " since the last win" : ""
          } (base ${cfg.lossRiskPct}% ${
            cfg.lossRiskAdjustPct >= 0 ? "+" : ""
          }${cfg.lossRiskAdjustPct}% per extra loss). Simulation stopped before Trade ${i}.`;
          break;
        }
        if (isCapitalCascade) {
          const builderCapitalMultiplier = Math.max(0, Number(cfg._builderCapitalRiskMultiplier) || 1);
          targetRiskAmt = capital * (effectiveLossPct / 100) * builderCapitalMultiplier;
        } else if (lastProfitNet <= 0) {
          targetRiskAmt = BASE_RISK_AMT;
        } else {
          targetRiskAmt = lastProfitNet * (effectiveLossPct / 100);
        }
      }
    } else {
      // Only the supported allocation modes are accepted.
      targetRiskAmt = BASE_RISK_AMT;
    }

    // Safety net for any other path that could still slip through negative
    // (e.g. an "On Capital" run where capital itself has gone negative).
    targetRiskAmt = Math.max(0, targetRiskAmt);
    const allocationReset = Array.isArray(explicitRiskPlan)
      ? { riskAmt: targetRiskAmt, resetApplied: false }
      : applyRiskAllocationReset(cfg, targetRiskAmt);
    targetRiskAmt = allocationReset.riskAmt;

    // Round to the nearest whole unit (minimum 1) — Intraday can only trade
    // whole shares (1, 2, 5, 10, 17…), Options/Futures can only trade whole
    // lots (1 lot, 2 lots… never 1.2 or 1.5). Quantity is units × Lot Size
    // (Lot Size is fixed at 1 for Intraday, so quantity === units there).
    const rawUnits = targetRiskAmt / UNIT_VALUE;
    const units = Math.max(1, Math.round(rawUnits));
    const riskAmt = units * UNIT_VALUE; // actual money risked at this rounded unit count (unleveraged)
    // Leverage inflates the actual notional/quantity traded for that same
    // money risk — bigger turnover (and fees), smaller price move needed to
    // hit the same money P&L — without changing the money risked itself.
    const quantity = Math.max(1, Math.round(units * lotSize * leverageFactor));

    if (riskAmt > capital * (cfg.perTradeCapPct / 100)) {
      const unitLabel = isIntraday ? "share" : "lot";
      stopped = true;
      stopReason = `Trade ${i} risk (${fmtMoney(riskAmt)}, ${units} ${unitLabel}${units === 1 ? "" : "s"}) exceeded ${cfg.perTradeCapPct}% of current capital (${fmtMoney(capital)}).`;
      break;
    }

    const entryPrice = price + (cfg.fnoEntrySpread || 0);
    const isWin = !!winLossSeq[i - 1];
    const tradeRR = sampleTradeRR(cfg, rrRng);
    const grossPL = isWin ? riskAmt * tradeRR : -riskAmt;

    const priceChange = quantity !== 0 ? grossPL / quantity : 0;
    const trueExitPrice = price + priceChange; // clean market move, no spread
    const exitPrice = trueExitPrice - (cfg.fnoExitSpread || 0);

    // Turnover = buy value + sell value (both legs of the round trip) — this
    // is what real brokers' brokerage + Other Charges + GST are computed on.
    const buyValue = entryPrice * quantity;
    const sellValue = exitPrice * quantity;
    const turnover = buyValue + sellValue;
    const brokerageFee = computeFnoBrokerage(broker, segment, buyValue, sellValue, cfg);
    // Other Charges combines STT + Exchange + SEBI + IPFT + Stamp Duty into
    // one editable % of turnover (defaults to the real segment rate — see
    // combinedStatutoryPct — but is user-editable for every broker); GST is
    // its own separate % on (brokerage + Other Charges).
    const { otherCharges, gst } = computeFnoOtherAndGst(
      segment,
      buyValue,
      sellValue,
      brokerageFee,
      cfg.fnoOtherChargesPct,
      cfg.fnoGstPct
    );
    const fee = brokerageFee + otherCharges + gst;

    const slip =
      cfg.slipMode === "ticks"
        ? quantity * cfg.slipTicks * cfg.tickValue
        : quantity * entryPrice * (cfg.slipPct / 100);
    // Exact spread cost — entry and exit spreads charged independently.
    const spreadCost = quantity * ((cfg.fnoEntrySpread || 0) + (cfg.fnoExitSpread || 0));
    const netPL = grossPL - fee - slip - spreadCost;
    capital += netPL;

    price = trueExitPrice; // baseline carries forward clean, unaffected by spread

    trades.push({
      n: i,
      win: isWin,
      rr: isWin ? tradeRR : -1,
      risk: riskAmt,
      riskAllocationReset: allocationReset.resetApplied,
      lots: units,
      quantity,
      entryPrice,
      price: exitPrice,
      grossPL,
      fee,
      brokerageFee,
      otherCharges,
      gst,
      turnover,
      slip,
      spreadCost,
      netPL,
      capital,
      cumulativeNetProfit: cumulativeNetProfit + netPL,
      profitCumulativeLossAdjustment: cfg.cascadeMode === "profitCumulative" ? currentProfitCumulativeAdjustment : null,
      profitCumulativeFlipCount: cfg.cascadeMode === "profitCumulative" ? currentProfitCumulativeFlipCount : null,
    });

    if (capital > peak) {
      peak = capital;
      peakTradeIndex = i;
    }
    if (capital < trough) {
      trough = capital;
      troughTradeIndex = i;
    }
    const ddPct = ((peak - capital) / peak) * 100;
    if (ddPct > maxDD) {
      maxDD = ddPct;
      maxDDValue = peak - capital;
      maxDDTradeIndex = i;
    }
    maxProfitValue = Math.max(maxProfitValue, capital - cfg.initialCapital);
    maxLossValue = Math.min(maxLossValue, capital - cfg.initialCapital);

    cumulativeNetProfit += netPL;
    previousExecutedRiskAmt = riskAmt;

    if (isWin) {
      hasWon = true;
      lastProfitNet = netPL;
      // WIN reset semantics for On Profit+: reset only the losing-streak and
      // flip state. Cumulative net profit is NOT reset.
      consecutiveLosses = 0;
      currentProfitCumulativeAdjustment = Number(cfg.profitCumulativeLossAdjustPct) || 0;
      currentProfitCumulativeFlipCount = 0;
    } else {
      consecutiveLosses += 1;
      if (cfg.cascadeMode === "profitCumulative") {
        const state = getCumulativeProfitRiskState(cfg, consecutiveLosses);
        currentProfitCumulativeAdjustment = state.effectiveAdjustment;
        currentProfitCumulativeFlipCount = state.flipCount;
      }
    }

    prevNet = netPL;
    prevWin = isWin;

    const overallLossPct = ((cfg.initialCapital - capital) / cfg.initialCapital) * 100;
    if (overallLossPct >= cfg.overallCapPct) {
      stopped = true;
      stopReason = `Capital drawdown from initial capital reached ${overallLossPct.toFixed(1)}%, at or above the Max Risk Cap of ${cfg.overallCapPct}%.`;
      break;
    }
  }

  const wins = trades.filter((t) => t.win);
  const losses = trades.filter((t) => !t.win);
  const winRateActual = trades.length ? (wins.length / trades.length) * 100 : 0;
  const avgWin = wins.length ? wins.reduce((s, t) => s + t.netPL, 0) / wins.length : 0;
  const avgLoss = losses.length
    ? Math.abs(losses.reduce((s, t) => s + t.netPL, 0) / losses.length)
    : 0;
  const winSum = avgWin * wins.length;
  const lossSum = avgLoss * losses.length;
  const profitFactor = lossSum !== 0 ? winSum / lossSum : wins.length ? Infinity : 0;
  const totalLots = trades.reduce((s, t) => s + t.lots, 0);
  const avgLots = trades.length ? totalLots / trades.length : 0;
  const totalFees = trades.reduce((s, t) => s + t.fee, 0);
  const totalBrokerage = trades.reduce((s, t) => s + t.brokerageFee, 0);
  const totalOtherCharges = trades.reduce((s, t) => s + t.otherCharges, 0);
  const totalGst = trades.reduce((s, t) => s + t.gst, 0);
  const totalTurnover = trades.reduce((s, t) => s + t.turnover, 0);
  const expectancy = trades.length ? (capital - cfg.initialCapital) / trades.length : 0;

  return {
    trades,
    stopped,
    stopReason,
    finalCapital: capital,
    finalPrice: trades.length ? trades[trades.length - 1].price : price,
    netPL: capital - cfg.initialCapital,
    winRateActual,
    maxDD,
    maxDDValue,
    maxDDTradeIndex,
    peakTradeIndex,
    troughTradeIndex,
    maxProfitValue,
    maxLossValue,
    profitFactor,
    avgLots,
    totalLots,
    totalFees,
    totalBrokerage,
    totalOtherCharges,
    totalGst,
    totalTurnover,
    expectancy,
    winsCount: wins.length,
    lossesCount: losses.length,
  };
}


function runSimulation(cfg) {
  const winLossSeq = buildWinLossSeq(cfg.numTrades, cfg.winRate);
  return { ...simulateFromSequence(cfg, winLossSeq), winLossSeq };
}

// Same as runSimulation, but drives the whole-lot Day/F&O cascade.
function runSimulationFnO(cfg) {
  const winLossSeq = buildWinLossSeq(cfg.numTrades, cfg.winRate);
  return { ...simulateFromSequenceFnO(cfg, winLossSeq), winLossSeq };
}

// Runs the same strategy config across a sweep of win rates (0..100, step),
// firing `runsPerPoint` random simulations at each win rate and averaging
// the outcome, so you can see how sensitive the cascade is to win rate.
// `simType` picks which cascade engine drives the sweep: "single" uses the
// fractional-lot engine (Single Run's config), "fno" uses the whole-lot,
// Indian-market engine (Day / F&O's config) — whichever mode the user was
// last configuring before opening the sweep.
function runWinRateSweep(cfg, step, runsPerPoint, simType = "single") {
  const points = [];
  const s = Math.max(1, Math.min(50, Math.round(step) || 10));
  const runFn = simType === "fno" ? runSimulationFnO : runSimulation;

  // Loop by the raw step, but clamp each point's *displayed* win rate to
  // 100 and stop once it's reached — this guarantees the 100% point is
  // always tested exactly once, even when the step doesn't evenly divide
  // 100 (e.g. a 15% step would otherwise land 0,15,...,90 and then jump
  // straight past 100, silently skipping the top of the range).
  for (let wr = 0; ; wr += s) {
    const winRate = Math.min(100, wr);
    const results = [];
    for (let r = 0; r < runsPerPoint; r++) {
      results.push(runFn({ ...cfg, winRate }));
    }

    const finals = results.map((r) => r.finalCapital);
    const avgFinal = finals.reduce((a, b) => a + b, 0) / finals.length;
    const avgReturnPct = ((avgFinal - cfg.initialCapital) / cfg.initialCapital) * 100;
    const avgNetPL = avgFinal - cfg.initialCapital;
    const profitableCount = results.filter((r) => r.finalCapital > cfg.initialCapital).length;
    const profitableRate = (profitableCount / results.length) * 100;
    const avgMaxDD = results.reduce((s2, r) => s2 + r.maxDD, 0) / results.length;
    const avgMaxDDValue = results.reduce((s2, r) => s2 + r.maxDDValue, 0) / results.length;
    const avgMaxProfitValue = results.reduce((s2, r) => s2 + r.maxProfitValue, 0) / results.length;
    const avgMaxProfitPct = (avgMaxProfitValue / cfg.initialCapital) * 100;
    const avgMaxLossValue = results.reduce((s2, r) => s2 + r.maxLossValue, 0) / results.length;
    const avgMaxLossPct = (avgMaxLossValue / cfg.initialCapital) * 100;
    // Reward:Risk realized at this win rate — how much upside (Max Profit)
    // was on offer for each unit of downside (Max DD) actually taken.
    const rewardRiskRatio = avgMaxDDValue !== 0 ? avgMaxProfitValue / avgMaxDDValue : avgMaxProfitValue > 0 ? Infinity : 0;
    const recoveryAnalyses = results.map((r) => analyzeDrawdownRecovery(r.trades || [], cfg.initialCapital));
    const recoverySummary = summarizeRecoveryAnalyses(recoveryAnalyses);
    const breakEvenSummary = summarizeBreakEvenAnalyses(
      results.map((r) => analyzeBreakEvenRecovery(r.trades || [], cfg.initialCapital))
    );

    points.push({
      winRate,
      avgFinal,
      avgReturnPct,
      avgNetPL,
      avgMaxDD,
      avgMaxDDValue,
      avgMaxProfitValue,
      avgMaxProfitPct,
      avgMaxLossValue,
      avgMaxLossPct,
      rewardRiskRatio,
      profitableRate,
      runs: results.length,
      avgDDRecoveryTrades: recoverySummary.avgRecoveryTrades,
      medianDDRecoveryTrades: recoverySummary.medianRecoveryTrades,
      p75DDRecoveryTrades: recoverySummary.p75RecoveryTrades,
      p90DDRecoveryTrades: recoverySummary.p90RecoveryTrades,
      worstDDRecoveryTrades: recoverySummary.worstRecoveryTrades,
      recoveryPct: recoverySummary.recoveryPct,
      unrecoveredMaxDDPct: recoverySummary.unrecoveredPct,
      medianBreakEvenRecoveryTrades: breakEvenSummary.medianRecoveryTrades,
      p75BreakEvenRecoveryTrades: breakEvenSummary.p75RecoveryTrades,
      p90BreakEvenRecoveryTrades: breakEvenSummary.p90RecoveryTrades,
      worstBreakEvenRecoveryTrades: breakEvenSummary.worstRecoveryTrades,
      breakEvenRecoveryPct: breakEvenSummary.recoveryPct,
      unrecoveredBreakEvenPct: breakEvenSummary.unrecoveredPct,
    });

    if (winRate >= 100) break;
  }

  return points;
}

// Pure config-cleaning helper shared by handleRun and handleRunBatch —
// coerces every field of the raw (possibly stringy/blank) cfg state into
// the numeric/enum-safe shape the simulation engines expect.
function cleanConfig(cfg) {
  return {
    ...cfg,
    initialCapital: Number(cfg.initialCapital) || 0,
    baseLots: Number(cfg.baseLots) || 0,
    riskPct: Number(cfg.riskPct) || 0,
    rr: Number(cfg.rr) || 0,
    rrMode: cfg.rrMode === "range" ? "range" : "fixed",
    rrMin: Math.max(0, Number(cfg.rrMin) || 0),
    rrMax: Math.max(Math.max(0, Number(cfg.rrMin) || 0), Number(cfg.rrMax) || 0),
    feeMode: cfg.feeMode === "turnover" ? "turnover" : "perLot",
    feeBaseEntry: Number(cfg.feeBaseEntry) || 0,
    feeBaseExit: Number(cfg.feeBaseExit) || 0,
    currentPrice: Number(cfg.currentPrice) || 0,
    leverage: Math.min(1000, Math.max(0, Number(cfg.leverage) || 0)),
    entryFeeTurnoverPct: Number(cfg.entryFeeTurnoverPct) || 0,
    exitFeeTurnoverPct: Number(cfg.exitFeeTurnoverPct) || 0,
    cascadeMode: RISK_ALLOCATION_MODES.includes(cfg.cascadeMode) ? cfg.cascadeMode : "profit",
                                                                                profitCumulativeAllocationPct: Math.max(0, Math.min(100, Number(cfg.profitCumulativeAllocationPct) || 30)),
    profitCumulativeLossAdjustPct: Math.max(-95, Math.min(100, Number(cfg.profitCumulativeLossAdjustPct) || -20)),
    profitCumulativeFlipEnabled: cfg.profitCumulativeFlipEnabled !== false,
    profitCumulativeFlipAfterLosses: Math.max(1, Math.round(Number(cfg.profitCumulativeFlipAfterLosses) || 5)),
    winRiskPct: Number(cfg.winRiskPct) || 0,
    lossRiskPct: Number(cfg.lossRiskPct) || 0,
    lossRiskAdjustPct: Number(cfg.lossRiskAdjustPct) || 0,
    perTradeCapPct: Number(cfg.perTradeCapPct) || 100,
    overallCapPct: Number(cfg.overallCapPct) || 100,
    riskAllocationEnabled: cfg.riskAllocationEnabled !== false,
    riskAllocationTriggerPct: Math.max(0, Number(cfg.riskAllocationTriggerPct) || 0),
    riskAllocationResetPct: Math.max(0, Number(cfg.riskAllocationResetPct) || 0),
    slipPct: Number(cfg.slipPct) || 0,
    slipTicks: Number(cfg.slipTicks) || 0,
    tickValue: Number(cfg.tickValue) || 0,
    entrySpread: Number(cfg.entrySpread) || 0,
    exitSpread: Number(cfg.exitSpread) || 0,
    winRate: Number(cfg.winRate) || 0,
    numTrades: Math.max(1, Math.round(Number(cfg.numTrades) || 1)),
    fnoSegment: ["options", "futures"].includes(cfg.fnoSegment) ? cfg.fnoSegment : "intraday",
    fnoBroker: ["groww", "dhan", "upstox", "custom"].includes(cfg.fnoBroker) ? cfg.fnoBroker : "groww",
    fnoQuantity: Math.max(1, Math.round(Number(cfg.fnoQuantity) || 1)),
    fnoLots: Math.max(1, Math.round(Number(cfg.fnoLots) || 1)),
    fnoLotSize: Math.max(1, Math.round(Number(cfg.fnoLotSize) || 1)),
    fnoCurrentPrice: Number(cfg.fnoCurrentPrice) || 0,
    fnoFeeMode: cfg.fnoFeeMode === "turnover" ? "turnover" : "fixed",
    fnoFixedFee: Number(cfg.fnoFixedFee) || 0,
    fnoFeeTurnoverPct: Number(cfg.fnoFeeTurnoverPct) || 0,
    fnoOtherChargesPct: Number(cfg.fnoOtherChargesPct) || 0,
    fnoGstPct: Number(cfg.fnoGstPct) || 0,
    fnoEntrySpread: Number(cfg.fnoEntrySpread) || 0,
    fnoExitSpread: Number(cfg.fnoExitSpread) || 0,
    fnoBrokerageType: ["perLeg", "turnover", "flat"].includes(cfg.fnoBrokerageType) ? cfg.fnoBrokerageType : "perLeg",
    fnoBrokerageRatePct: Number(cfg.fnoBrokerageRatePct) || 0,
    fnoBrokerageMin: Number(cfg.fnoBrokerageMin) || 0,
    fnoBrokerageMax: Number(cfg.fnoBrokerageMax) || 0,
    fnoBrokerageFlatPerOrder: Number(cfg.fnoBrokerageFlatPerOrder) || 0,
    // Leave "" as "" (no leverage) so blank truly means unleveraged;
    // otherwise clamp to the 0–100x range brokers actually offer.
    fnoLeverage:
      cfg.fnoLeverage === "" || cfg.fnoLeverage === null || cfg.fnoLeverage === undefined
        ? ""
        : Math.min(100, Math.max(0, Number(cfg.fnoLeverage) || 0)),
    builderInitialCapital: Math.max(0, Number(cfg.builderInitialCapital) || 0),
    builderTotalRiskPct: Math.max(0, Number(cfg.builderTotalRiskPct) || 0),
    builderMinTrades: Math.max(1, Math.round(Number(cfg.builderMinTrades) || 1)),
    builderMaxTrades: Math.max(1, Math.round(Number(cfg.builderMaxTrades) || 1)),
    builderSequenceLimit: Math.min(100000, Math.max(1, Math.round(Number(cfg.builderSequenceLimit) || 100000))),
    builderSequenceFilterEnabled: cfg.builderSequenceFilterEnabled === true,
    builderSequenceFilterOpen: cfg.builderSequenceFilterOpen === true,
    builderSequenceFilterLeadingLosses: Math.min(1000, Math.max(1, Math.round(Number(cfg.builderSequenceFilterLeadingLosses) || 1))),
    builderSequenceFilterMatch: cfg.builderSequenceFilterMatch === "exact" ? "exact" : "atLeast",
    builderSequenceFilterFinalPnl: ["green", "red", "any"].includes(cfg.builderSequenceFilterFinalPnl) ? cfg.builderSequenceFilterFinalPnl : "green",
    builderSequenceFilterGreenByTrade: Math.min(1000, Math.max(0, Math.round(Number(cfg.builderSequenceFilterGreenByTrade) || 0))),
    builderMode: cfg.builderMode === "target" ? "target" : "normal",
    builderTargetInputMode: cfg.builderTargetInputMode === "riskPoints" ? "riskPoints" : "targetPoints",
    builderTargetValue: Math.max(0, Number(cfg.builderTargetValue) || 0),
  };
}

// Returns only the strategy-facing configuration fields. Builder controls are
// deliberately excluded because Builder keeps its own capital/risk/trade-range
// settings, while RR mode/range, costs, risk cascade, F&O settings, etc. should
// always follow the currently selected Single Run / Day-F&O base configuration.
// Only strategy-driving fields participate in the Builder workspace identity.
// Builder-only controls, sweep/batch controls, and transient Builder metadata
// must never make an unchanged strategy look "new".
const BUILDER_STRATEGY_KEYS = Object.keys(DEFAULTS).filter(
  (key) =>
    !key.startsWith("builder") &&
    key !== "sweepStep" &&
    key !== "sweepRuns" &&
    key !== "batchCount"
);

function normalizeBuilderSignatureValue(value) {
  if (value === null || value === undefined) return null;
  if (value === "") return "";
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return value;
}

function builderSourceConfig(cfg) {
  const source = {};
  for (const key of BUILDER_STRATEGY_KEYS) {
    source[key] = normalizeBuilderSignatureValue(cfg?.[key]);
  }
  return source;
}

function builderSourceSignature(cfg, baseMode) {
  return JSON.stringify({
    baseMode: baseMode === "fno" ? "fno" : "single",
    source: builderSourceConfig(cfg),
  });
}

function builderInputFields(cfg) {
  return {
    builderInitialCapital: cfg?.builderInitialCapital,
    builderTotalRiskPct: cfg?.builderTotalRiskPct,
    builderMinTrades: cfg?.builderMinTrades,
    builderMaxTrades: cfg?.builderMaxTrades,
    builderSequenceLimit: cfg?.builderSequenceLimit ?? DEFAULTS.builderSequenceLimit,
    builderSequenceFilterEnabled: cfg?.builderSequenceFilterEnabled ?? DEFAULTS.builderSequenceFilterEnabled,
    builderSequenceFilterOpen: cfg?.builderSequenceFilterOpen ?? DEFAULTS.builderSequenceFilterOpen,
    builderSequenceFilterLeadingLosses: cfg?.builderSequenceFilterLeadingLosses ?? DEFAULTS.builderSequenceFilterLeadingLosses,
    builderSequenceFilterMatch: cfg?.builderSequenceFilterMatch ?? DEFAULTS.builderSequenceFilterMatch,
    builderSequenceFilterFinalPnl: cfg?.builderSequenceFilterFinalPnl ?? DEFAULTS.builderSequenceFilterFinalPnl,
    builderSequenceFilterGreenByTrade: cfg?.builderSequenceFilterGreenByTrade ?? DEFAULTS.builderSequenceFilterGreenByTrade,
    builderMode: cfg?.builderMode ?? DEFAULTS.builderMode,
    builderTargetInputMode: cfg?.builderTargetInputMode,
    builderTargetValue: cfg?.builderTargetValue,
  };
}

/* ---------- design tokens (dark theme, clear per-section color coding) ---------- */
const CARD = "relative bg-zinc-900 border border-white/[0.08] rounded-xl shadow-lg shadow-black/20";
const SECTION_COLORS = {
  blue: { chip: "bg-zinc-500/15 text-zinc-300", text: "text-zinc-200", ring: "focus:border-zinc-400/70 focus:ring-zinc-400/20", dot: "bg-zinc-400" },
  violet: { chip: "bg-violet-500/15 text-violet-400", text: "text-violet-300", ring: "focus:border-violet-500/70 focus:ring-violet-500/20", dot: "bg-violet-500" },
  teal: { chip: "bg-teal-500/15 text-teal-400", text: "text-teal-300", ring: "focus:border-teal-500/70 focus:ring-teal-500/20", dot: "bg-teal-500" },
  amber: { chip: "bg-amber-500/15 text-amber-400", text: "text-amber-300", ring: "focus:border-amber-500/70 focus:ring-amber-500/20", dot: "bg-amber-500" },
  indigo: { chip: "bg-indigo-500/15 text-indigo-400", text: "text-indigo-300", ring: "focus:border-indigo-500/70 focus:ring-indigo-500/20", dot: "bg-indigo-500" },
};

function Field({ label, hint, children }) {
  return (
    <div className="mb-3">
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="text-xs text-zinc-400">{label}</label>
        {hint && <span className="text-[10px] text-zinc-600">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function NumInput({ value, onChange, step = "1", color = "blue", min, max }) {
  const c = SECTION_COLORS[color] || SECTION_COLORS.blue;
  return (
    <input
      type="number"
      value={value}
      step={step}
      min={min}
      max={max}
      onChange={onChange}
      className={`w-full bg-black/30 border border-white/[0.08] text-zinc-100 rounded-lg text-sm px-3 py-2.5 outline-none focus:ring-1 transition-colors font-mono ${c.ring}`}
    />
  );
}

function GroupTitle({ children, icon: Icon, color = "blue" }) {
  const c = SECTION_COLORS[color] || SECTION_COLORS.blue;
  return (
    <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-white/[0.06]">
      {Icon && (
        <span className={`w-6 h-6 rounded-md flex items-center justify-center flex-none ${c.chip}`}>
          <Icon size={13} />
        </span>
      )}
      <span className={`text-[13px] font-semibold ${c.text}`}>{children}</span>
    </div>
  );
}

function StatCell({ label, value, tone, icon: Icon, sub, valueColor, subColor }) {
  const toneClass = tone === "pos" ? "text-emerald-400" : tone === "neg" ? "text-red-400" : "text-zinc-100";
  const barColor = tone === "pos" ? "bg-emerald-500" : tone === "neg" ? "bg-red-500" : "bg-zinc-500";
  return (
    <div className={`${CARD} p-4 overflow-hidden`}>
      <div className={`absolute top-0 left-0 right-0 h-[2px] ${barColor}`} />
      <div className="flex items-start justify-between">
        <div className="text-[12px] text-zinc-400">{label}</div>
        {Icon && (
          <span className="text-zinc-500">
            <Icon size={14} />
          </span>
        )}
      </div>
      <div
        className={`font-semibold text-lg sm:text-xl mt-1.5 font-mono ${valueColor ? "" : toneClass}`}
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </div>
      {sub && (
        <div
          className={`text-[11px] mt-1 font-mono ${subColor ? "" : toneClass}`}
          style={subColor ? { color: subColor } : undefined}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, sub, tone, valueColor, subColor }) {
  const toneClass = tone === "pos" ? "text-emerald-400" : tone === "neg" ? "text-red-400" : "text-zinc-100";
  return (
    <div className={`${CARD} p-3.5`}>
      <div className="text-[11px] text-zinc-500">{label}</div>
      <div
        className={`font-semibold text-sm sm:text-base mt-1.5 font-mono ${toneClass}`}
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </div>
      {sub && (
        <div
          className={`text-[10px] mt-0.5 font-mono ${tone ? toneClass : "text-zinc-500"}`}
          style={subColor ? { color: subColor } : undefined}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-zinc-400">
      <span className={`w-2 h-2 rounded-full inline-block ${color}`} />
      {label}
    </span>
  );
}

// Custom tooltip for the Win Rate sweep chart — dot-per-series color match,
// signed formatting for Avg Return, and the app's own card chrome instead
// of recharts' default box, so it reads as part of the dashboard rather
// than a generic chart tooltip.
function SweepTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;

  // Recharts can send the same dataKey more than once when an Area and a
  // Line both use that dataKey. Keep one row per metric so the tooltip never
  // renders duplicate React keys or duplicate values.
  const uniqueRows = Array.from(
    new Map(
      payload
        .filter((entry) => entry?.dataKey === "avgReturnPct" || entry?.dataKey === "profitableRate")
        .map((entry) => [entry.dataKey, entry])
    ).values()
  );
  const rows = uniqueRows.sort((a, b) => {
    if (a.dataKey === "avgReturnPct") return -1;
    if (b.dataKey === "avgReturnPct") return 1;
    return 0;
  });

  if (!rows.length) return null;

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 shadow-xl shadow-black/50 font-mono">
      <div className="text-[10px] text-zinc-500 mb-1.5">Win Rate {label}</div>
      <div className="space-y-1">
        {rows.map((entry) => {
          const isReturn = entry.dataKey === "avgReturnPct";
          const numericValue = Number(entry.value);
          const safeValue = Number.isFinite(numericValue) ? numericValue : 0;
          const displayValue = isReturn ? safeValue.toFixed(2) : safeValue.toFixed(1);
          return (
            <div key={`sweep-tooltip-${entry.dataKey}`} className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full flex-none" style={{ background: entry.color }} />
              <span className="text-zinc-400">{isReturn ? "Avg Return" : "Profitable"}</span>
              <span className="ml-4 font-semibold tabular-nums" style={{ color: entry.color }}>
                {isReturn && safeValue >= 0 ? "+" : ""}
                {displayValue}
                {isReturn ? "" : "%"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Custom tooltip for the Per-Trade P/L histogram — colors the row to match
// the bar (win/loss) instead of recharts' default tooltip box.
function TradeChartsTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const rows = [];
  for (const entry of payload) {
    if (entry.dataKey === "netPL") {
      rows.push({ key: "netPL", label: "Trade P/L", value: entry.value, color: entry.payload.win ? "#7BF1A8" : "#FF8904" });
    }
  }
  if (!rows.length) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 shadow-xl shadow-black/50 font-mono">
      <div className="text-[10px] text-zinc-500 mb-1.5">Trade #{label}</div>
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full flex-none" style={{ background: r.color }} />
            <span className="text-zinc-400">{r.label}</span>
            <span className="ml-4 font-semibold tabular-nums" style={{ color: r.color }}>
              {Number(r.value) >= 0 ? "+" : ""}
              {fmtMoney(r.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Renders the per-trade P/L histogram shown above the Trade Log, colored by
// win/loss. Used by both the Single Run and Day/F&O result panels — same
// trade shape (n, netPL, capital, win), just different cfg.
function CollapsibleSectionToggle({ open, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-label={`${open ? "Collapse" : "Expand"} ${label}`}
      title={open ? `Collapse ${label}` : `Expand ${label}`}
      className="w-7 h-7 rounded-md flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/70 transition-colors flex-none"
    >
      <ChevronDown size={15} className={`transition-transform duration-200 ${open ? "rotate-0" : "-rotate-90"}`} />
    </button>
  );
}

function TradeAnalyticsSection({ trades, initialCapital, collapsible = false, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!trades || !trades.length) return null;

  const data = trades.map((t) => ({
    n: t.n,
    netPL: t.netPL,
    win: t.win,
  }));

  const wins = data.filter((d) => d.win);
  const losses = data.filter((d) => !d.win);
  const winCount = wins.length;
  const lossCount = losses.length;
  const totalWin = wins.reduce((s, d) => s + d.netPL, 0);
  const totalLoss = losses.reduce((s, d) => s + d.netPL, 0);
  const avgWin = winCount ? totalWin / winCount : 0;
  const avgLoss = lossCount ? totalLoss / lossCount : 0;

  // Longest consecutive win/loss run in this trade sequence, in order.
  let maxWinStreak = 0;
  let maxLossStreak = 0;
  let curWinStreak = 0;
  let curLossStreak = 0;
  data.forEach((d) => {
    if (d.win) {
      curWinStreak += 1;
      curLossStreak = 0;
      if (curWinStreak > maxWinStreak) maxWinStreak = curWinStreak;
    } else {
      curLossStreak += 1;
      curWinStreak = 0;
      if (curLossStreak > maxLossStreak) maxLossStreak = curLossStreak;
    }
  });

  // Single best / worst trade in the run, called out on the chart with a
  // highlighted outline + label instead of being left to blend into the rest.
  let bestIdx = -1;
  let worstIdx = -1;
  data.forEach((d, i) => {
    if (bestIdx === -1 || d.netPL > data[bestIdx].netPL) bestIdx = i;
    if (worstIdx === -1 || d.netPL < data[worstIdx].netPL) worstIdx = i;
  });

  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-zinc-800">
        <span className="flex items-center gap-2 text-[13px] font-semibold text-zinc-200">
          <BarChart2 size={14} className="text-zinc-300" />
          Per-Trade P/L
        </span>
        <span className="flex items-center gap-2">
          <span className="flex items-center gap-3">
            <LegendDot color="bg-[#7BF1A8]" label="Win" />
            <LegendDot color="bg-[#FF8904]" label="Loss" />
          </span>
          {collapsible && <CollapsibleSectionToggle open={open} onClick={() => setOpen((v) => !v)} label="Per-Trade P/L" />}
        </span>
      </div>

      {(!collapsible || open) && (
        <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-zinc-800">
        <div className="bg-zinc-900 px-3 py-2.5">
          <div className="text-[10px] text-zinc-500">Max Win Streak</div>
          <div className="font-mono text-sm mt-1" style={{ color: "#7BF1A8" }}>
            {maxWinStreak}
          </div>
        </div>
        <div className="bg-zinc-900 px-3 py-2.5">
          <div className="text-[10px] text-zinc-500">Max Loss Streak</div>
          <div className="font-mono text-sm mt-1" style={{ color: "#FF8904" }}>
            {maxLossStreak}
          </div>
        </div>
        <div className="bg-zinc-900 px-3 py-2.5">
          <div className="text-[10px] text-zinc-500">Avg Win</div>
          <div className="font-mono text-sm mt-1" style={{ color: "#7BF1A8" }}>
            {winCount ? "+" + fmtMoney(avgWin) : "—"}
          </div>
        </div>
        <div className="bg-zinc-900 px-3 py-2.5">
          <div className="text-[10px] text-zinc-500">Avg Loss</div>
          <div className="font-mono text-sm mt-1" style={{ color: "#FF8904" }}>
            {lossCount ? fmtMoney(avgLoss) : "—"}
          </div>
        </div>
      </div>

      <div className="h-60 sm:h-72 px-2 pt-6 pb-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 14, right: 12, bottom: 0, left: 0 }} barCategoryGap="24%">
            <CartesianGrid stroke="#CAD5E2" strokeOpacity={0.08} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="n"
              stroke="#737373"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              stroke="#737373"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              width={58}
              tickFormatter={(v) => fmtMoney(v)}
            />
            <ReferenceLine y={0} stroke="#52525b" strokeDasharray="4 4" />
            {winCount > 0 && (
              <ReferenceLine y={avgWin} stroke="#7CCF35" strokeOpacity={0.6} strokeDasharray="4 4" />
            )}
            {lossCount > 0 && (
              <ReferenceLine y={avgLoss} stroke="#F54927" strokeOpacity={0.6} strokeDasharray="4 4" />
            )}
            <Tooltip content={<TradeChartsTooltip />} cursor={{ fill: "rgba(202,213,226,0.06)" }} />
            <Bar dataKey="netPL" name="Trade P/L" isAnimationActive={false} maxBarSize={26}>
              {data.map((d, i) => (
                <Cell
                  key={i}
                  fill={d.win ? "#7BF1A8" : "#FF8904"}
                  stroke={i === bestIdx || i === worstIdx ? "#DDD6FF" : "none"}
                  strokeWidth={i === bestIdx || i === worstIdx ? 1.25 : 0}
                  radius={[3, 3, 0, 0]}
                />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
        </>
      )}
    </div>
  );
}

// Custom tooltip for the Multi Simulations histogram — one bar per random
// run, colored by whether that particular run finished profitable or not.
function MultiSimTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const rows = [];
  const netEntry = payload.find((p) => p.dataKey === "netPL");
  const point = netEntry?.payload || payload[0]?.payload || {};
  const sequence = Array.isArray(point.sequence) ? point.sequence : [];
  if (netEntry) {
    rows.push({
      key: "netPL",
      label: "Net P/L",
      value: netEntry.value,
      color: netEntry.payload.win ? "#7BF1A8" : "#FF8904",
    });
  }
  const avgProfitEntry = payload.find((p) => p.dataKey === "avgProfitLine");
  if (avgProfitEntry && avgProfitEntry.value != null) {
    rows.push({ key: "avgProfitLine", label: "Avg Profit", value: avgProfitEntry.value, color: "#05DF72" });
  }
  const avgLossEntry = payload.find((p) => p.dataKey === "avgLossLine");
  if (avgLossEntry && avgLossEntry.value != null) {
    rows.push({ key: "avgLossLine", label: "Avg Loss", value: avgLossEntry.value, color: "#FF692A" });
  }
  if (!rows.length) return null;
  return (
    <div className="min-w-[190px] max-w-[300px] bg-[#27272A] border border-[#57534D] rounded-lg px-3 py-2.5 shadow-xl shadow-black/50 font-mono">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="text-[10px] text-zinc-300">Scenario : {label}</div>
        <div className="text-[9px] text-zinc-500">{sequence.length} trades</div>
      </div>
      <div className="mb-2.5 rounded-md border border-[#57534D]/60 bg-black/20 px-2 py-1.5">
        <div className="text-[9px] uppercase tracking-wide text-zinc-500 mb-1">Trade Sequence</div>
        <div className="flex flex-wrap gap-1">
          {sequence.length ? sequence.map((isWin, idx) => (
            <span
              key={`${idx}-${isWin ? "W" : "L"}`}
              className="inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-[3px] border px-1 text-[9px] font-semibold leading-none"
              style={isWin
                ? { color: "#7CCF35", borderColor: "rgba(124,207,53,0.30)", background: "rgba(124,207,53,0.10)" }
                : { color: "#FF692A", borderColor: "rgba(255,105,42,0.30)", background: "rgba(255,105,42,0.10)" }}
            >
              {isWin ? "W" : "L"}
            </span>
          )) : (
            <span className="text-[9px] text-zinc-600">No sequence</span>
          )}
        </div>
      </div>
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full flex-none" style={{ background: r.color }} />
            <span className="text-zinc-400">{r.label}</span>
            <span className="ml-4 font-semibold tabular-nums" style={{ color: r.color }}>
              {r.value >= 0 ? "+" : ""}
              {fmtMoney(r.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Renders every random run from a Multi Simulations batch as one bar each,
// left to right in run order (1st through last), colored win/loss. Clicking
// a bar loads that exact run's trade sequence into the stats, chart and
// Trade Log above — same recalculation path as clicking a Scenario card.
function MultiSimHistogram({ runs, selectedRunIdx, onSelectRun }) {
  if (!runs || !runs.length) return null;

  const winRuns = runs.filter((r) => r.result.netPL >= 0);
  const lossRuns = runs.filter((r) => r.result.netPL < 0);
  const avgProfit = winRuns.length ? winRuns.reduce((s, r) => s + r.result.netPL, 0) / winRuns.length : null;
  const avgLoss = lossRuns.length ? lossRuns.reduce((s, r) => s + r.result.netPL, 0) / lossRuns.length : null;

  const data = runs.map((r) => ({
    index: r.index,
    netPL: r.result.netPL,
    win: r.result.netPL >= 0,
    sequence: Array.isArray(r.winLossSeq) ? r.winLossSeq : [],
    avgProfitLine: avgProfit,
    avgLossLine: avgLoss,
  }));

  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-zinc-800">
        <span className="flex items-center gap-2 text-[13px] font-semibold text-zinc-200">
          <BarChart2 size={14} className="text-zinc-300" />
          Simulation Outcomes
        </span>
        <span className="flex items-center gap-3">
          <LegendDot color="bg-[#31C950]" label="Profitable" />
          <LegendDot color="bg-[#F54927]" label="Losing" />
        </span>
      </div>

      <div className="h-60 sm:h-72 px-2 pt-6 pb-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 14, right: 12, bottom: 0, left: 0 }} barCategoryGap="15%">
            <CartesianGrid stroke="#CAD5E2" strokeOpacity={0.08} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="index"
              stroke="#737373"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              stroke="#737373"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              width={58}
              tickFormatter={(v) => fmtMoney(v)}
            />
            <ReferenceLine y={0} stroke="#52525b" strokeDasharray="4 4" />
            <Tooltip content={<MultiSimTooltip />} cursor={{ fill: "rgba(202,213,226,0.06)" }} />
            <Bar dataKey="netPL" name="Net P/L" isAnimationActive={false} maxBarSize={26}>
              {data.map((d, i) => (
                <Cell
                  key={i}
                  fill={d.win ? "#31C950" : "#F54927"}
                  stroke={selectedRunIdx === d.index ? "#DDD6FF" : "none"}
                  strokeWidth={selectedRunIdx === d.index ? 1.5 : 0}
                  radius={[3, 3, 0, 0]}
                  style={{ cursor: "pointer" }}
                  onClick={() => onSelectRun(runs[i])}
                />
              ))}
            </Bar>
            {avgProfit != null && (
              <Line
                type="monotone"
                dataKey="avgProfitLine"
                name="Avg Profit"
                stroke="#05DF72"
                strokeWidth={1}
                strokeOpacity={0.5}
                strokeDasharray="4 4"
                dot={false}
                activeDot={{ r: 4, fill: "#05DF72", stroke: "#0a0b0d", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            )}
            {avgLoss != null && (
              <Line
                type="monotone"
                dataKey="avgLossLine"
                name="Avg Loss"
                stroke="#FF692A"
                strokeWidth={1}
                strokeOpacity={0.5}
                strokeDasharray="4 4"
                dot={false}
                activeDot={{ r: 4, fill: "#FF692A", stroke: "#0a0b0d", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}


// Custom tooltip for the cumulative-P/L path chart. The tooltip stays compact
// and focuses on the selected scenario so large simulation sets remain readable.
function MultiSimPathsTooltip({ active, payload, label, selectedRunIdx }) {
  if (!active || !payload || !payload.length) return null;
  const tradeNo = Number(label) || 0;
  const selectedKey = selectedRunIdx != null ? `run_${selectedRunIdx}` : null;
  const selected = selectedKey ? payload.find((p) => p.dataKey === selectedKey) : null;

  return (
    <div className="bg-zinc-950/95 backdrop-blur-sm border border-zinc-700/80 rounded-xl px-3.5 py-3 shadow-2xl shadow-black/60 font-mono min-w-[185px]">
      <div className="flex items-center justify-between gap-5 text-[10px] text-zinc-500 mb-2">
        <span className="uppercase tracking-[0.12em]">Trade {tradeNo}</span>
        {selectedRunIdx != null && <span className="text-zinc-300">Scenario #{selectedRunIdx}</span>}
      </div>
      {selected ? (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full flex-none ring-2 ring-black/40"
              style={{ background: selected.value >= 0 ? "#7CCF35" : "#FF8904" }}
            />
            <span className="text-[10px] text-zinc-500 uppercase tracking-wide">Cumulative P/L</span>
          </div>
          <div
            className="text-[15px] font-semibold tabular-nums"
            style={{ color: selected.value >= 0 ? "#7CCF35" : "#FF8904" }}
          >
            {Number(selected.value) >= 0 ? "+" : ""}{fmtMoney(selected.value)}
          </div>
        </div>
      ) : (
        <div className="text-[10px] leading-relaxed text-zinc-500">
          Select a scenario from the chart or outcome bars to inspect its exact path.
        </div>
      )}
    </div>
  );
}

// Professional cumulative outcome-path view. Every simulation outcome is
// plotted from Trade 0 to the final trade. Background paths stay subtle so
// the distribution is readable at 200+ runs, while the selected scenario is
// sharply highlighted and remains clickable for exact Trade Log inspection.
function MultiSimPathsChart({ runs, selectedRunIdx, onSelectRun }) {
  if (!runs || !runs.length) return null;

  const paths = runs.map((run) => {
    let cumulative = 0;
    const values = [0];
    for (const trade of run.result?.trades || []) {
      cumulative += Number(trade?.netPL) || 0;
      values.push(cumulative);
    }
    return { run, values };
  });

  const maxTrades = Math.max(0, ...paths.map((p) => p.values.length - 1));
  const finalValues = paths
    .map((p) => Number(p.values[p.values.length - 1]) || 0)
    .sort((a, b) => a - b);
  const percentile = (arr, p) => {
    if (!arr.length) return 0;
    const pos = (arr.length - 1) * p;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    if (lo === hi) return arr[lo];
    return arr[lo] + (arr[hi] - arr[lo]) * (pos - lo);
  };
  const worst = finalValues[0] || 0;
  const best = finalValues[finalValues.length - 1] || 0;
  const median = percentile(finalValues, 0.5);
  const p10 = percentile(finalValues, 0.1);
  const p90 = percentile(finalValues, 0.9);

  const data = Array.from({ length: maxTrades + 1 }, (_, tradeNo) => {
    const row = { trade: tradeNo };
    paths.forEach(({ run, values }) => {
      row[`run_${run.index}`] = tradeNo < values.length ? values[tradeNo] : null;
    });
    return row;
  });

  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="px-4 py-3 border-b border-zinc-800/90 bg-gradient-to-b from-zinc-900/45 to-transparent">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-zinc-100">
              <Activity size={14} className="text-zinc-300" />
              Cumulative P/L Paths
            </div>
            <div className="text-[10px] text-zinc-500 mt-1 leading-relaxed">
              Every simulation outcome · cumulative Net P/L from Trade 0 to {maxTrades}
            </div>
          </div>
          <div className="flex items-center gap-2.5 text-[10px] font-mono flex-none pt-0.5">
            <span className="flex items-center gap-1.5 text-zinc-500">
              <span className="w-2 h-2 rounded-full bg-[#7CCF35]" />Profit
            </span>
            <span className="flex items-center gap-1.5 text-zinc-500">
              <span className="w-2 h-2 rounded-full bg-[#FF8904]" />Loss
            </span>
            {selectedRunIdx != null && (
              <span className="hidden sm:inline-flex items-center gap-1.5 text-zinc-300 border-l border-zinc-800 pl-2.5">
                Selected #{selectedRunIdx}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
          <div className="rounded-lg border border-zinc-800/80 bg-black/20 px-2.5 py-2">
            <div className="text-[9px] uppercase tracking-wide text-zinc-600">Best Final</div>
            <div className={`mt-0.5 text-[11px] font-semibold tabular-nums ${best >= 0 ? "text-[#7CCF35]" : "text-[#FF8904]"}`}>
              {best >= 0 ? "+" : ""}{fmtMoney(best)}
            </div>
          </div>
          <div className="rounded-lg border border-zinc-800/80 bg-black/20 px-2.5 py-2">
            <div className="text-[9px] uppercase tracking-wide text-zinc-600">Median Final</div>
            <div className={`mt-0.5 text-[11px] font-semibold tabular-nums ${median >= 0 ? "text-[#7CCF35]" : "text-[#FF8904]"}`}>
              {median >= 0 ? "+" : ""}{fmtMoney(median)}
            </div>
          </div>
          <div className="rounded-lg border border-zinc-800/80 bg-black/20 px-2.5 py-2">
            <div className="text-[9px] uppercase tracking-wide text-zinc-600">P10 → P90</div>
            <div className="mt-0.5 text-[11px] font-semibold tabular-nums text-zinc-300">
              {p10 >= 0 ? "+" : ""}{fmtMoney(p10)} <span className="text-zinc-600">→</span> {p90 >= 0 ? "+" : ""}{fmtMoney(p90)}
            </div>
          </div>
          <div className="rounded-lg border border-zinc-800/80 bg-black/20 px-2.5 py-2">
            <div className="text-[9px] uppercase tracking-wide text-zinc-600">Worst Final</div>
            <div className={`mt-0.5 text-[11px] font-semibold tabular-nums ${worst >= 0 ? "text-[#7CCF35]" : "text-[#FF8904]"}`}>
              {worst >= 0 ? "+" : ""}{fmtMoney(worst)}
            </div>
          </div>
        </div>
      </div>

      <div className="h-[25rem] sm:h-[31rem] px-2 pt-3 pb-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 18, bottom: 4, left: 4 }}>
            <CartesianGrid stroke="#CAD5E2" strokeOpacity={0.055} strokeDasharray="2 5" vertical={false} />
            <XAxis
              dataKey="trade"
              stroke="#737373"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `T${v}`}
              interval="preserveStartEnd"
              padding={{ left: 8, right: 8 }}
            />
            <YAxis
              stroke="#737373"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              width={68}
              tickFormatter={(v) => fmtMoney(v)}
              domain={["auto", "auto"]}
            />
            <ReferenceLine y={0} stroke="#71717A" strokeOpacity={0.8} strokeDasharray="5 5" />
            <Tooltip
              content={<MultiSimPathsTooltip selectedRunIdx={selectedRunIdx} />}
              cursor={{ stroke: "#94A3B8", strokeOpacity: 0.22, strokeDasharray: "4 4" }}
              isAnimationActive={false}
            />
            {paths.map(({ run }) => {
              const selected = selectedRunIdx === run.index;
              const profitable = run.result.netPL >= 0;
              const baseColor = profitable ? "#7CCF35" : "#FF8904";
              return (
                <Line
                  key={run.index}
                  type="monotone"
                  dataKey={`run_${run.index}`}
                  name={`Scenario ${run.index}`}
                  stroke={baseColor}
                  strokeWidth={selected ? 2.5 : 0.85}
                  strokeOpacity={selected ? 1 : 0.13}
                  dot={false}
                  activeDot={selected ? { r: 4, fill: baseColor, stroke: "#09090B", strokeWidth: 2 } : false}
                  isAnimationActive={false}
                  connectNulls={false}
                  onClick={() => onSelectRun(run)}
                  style={{ cursor: "pointer" }}
                />
              );
            })}
            {selectedRunIdx != null && (
              <ReferenceDot
                x={maxTrades}
                y={(() => {
                  const selectedPath = paths.find((p) => p.run.index === selectedRunIdx);
                  return selectedPath ? Number(selectedPath.values[selectedPath.values.length - 1]) || 0 : 0;
                })()}
                r={4}
                fill="#DDD6FF"
                stroke="#09090B"
                strokeWidth={2}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="px-4 py-2.5 border-t border-zinc-800/90 bg-black/10 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono">
        <span className="text-zinc-500">{runs.length.toLocaleString("en-IN")} outcomes · {maxTrades} trades · one line per outcome</span>
        <span className="text-zinc-400">Click a path or outcome bar to inspect that scenario</span>
      </div>
    </div>
  );
}


// Small clickable summary of one batch run, used by BatchRunSection for the
// Max Profit / Max Loss / Max Drawdown scenario callouts. Clicking loads
// that exact run's trade sequence into the stats/chart/Trade Log above.
function ScenarioCard({ title, run, tone, valueColor, selected, onClick }) {
  const r = run.result;
  const toneClass = tone === "pos" ? "text-emerald-400" : "text-red-400";
  return (
    <button
      onClick={onClick}
      className={`text-left ${CARD} p-3.5 transition-colors hover:border-zinc-600 ${
        selected ? "border-zinc-400 ring-1 ring-zinc-400/40" : ""
      }`}
    >
      <div className="text-[11px] text-zinc-500 mb-1.5">
        {title} <span style={{ color: "#CAD5E2" }}>: {run.index}</span>
      </div>
      <div
        className={`font-mono text-base font-semibold ${valueColor ? "" : toneClass}`}
        style={valueColor ? { color: valueColor } : undefined}
      >
        {fmtMoney(r.finalCapital)}
      </div>
      <div className={`font-mono text-[11px] mt-0.5 ${toneClass}`}>
        {r.netPL >= 0 ? "+" : ""}
        {fmtMoney(r.netPL)} net
      </div>
      <div className="font-mono text-[10px] text-zinc-500 mt-2">
        Win Rate: <span style={{ color: "#FEF9C2" }}>{fmtPct(r.winRateActual)}</span> | Max DD:{" "}
        <span style={{ color: "#FF6467" }}>
          {fmtMoney(r.maxDDValue)} ({fmtPct(r.maxDD)})
        </span>
      </div>
    </button>
  );
}

// Multi Simulations section — sits below the Trade Log on the Single Run
// and Day/F&O tabs. Re-runs the exact same strategy config N times, each
// time against a fresh random trade sequence at the same Win Rate %, so the
// user can see how consistent (or luck-dependent) their edge really is
// instead of judging it off a single run. Collapsible so it can be tucked
// away once reviewed, since the histogram + scenario cards take real space.
function BatchRunSection({ mode, cfg, batchResult, onRunBatch, onClearBatch, onSelectRun, selectedRunIdx, onBatchCountChange }) {
  const [collapsed, setCollapsed] = useState(false);
  const [chartMode, setChartMode] = useState("outcomes");
  const activeMode = mode === "fno" ? "fno" : "single";
  const hasMatchingBatch = batchResult && batchResult.mode === activeMode;
  const stats = hasMatchingBatch ? batchResult.stats : null;
  const canRun = cfg.batchCount !== "" && Number(cfg.batchCount) >= 1;

  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-zinc-800">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-2 text-[13px] font-semibold text-zinc-200 hover:text-zinc-100 transition-colors"
        >
          <Activity size={14} className="text-zinc-300" />
          Multi Simulations
          <ChevronDown
            size={14}
            className={`text-zinc-500 transition-transform ${collapsed ? "" : "rotate-180"}`}
          />
        </button>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={cfg.batchCount}
            onChange={onBatchCountChange}
            step="1"
            placeholder="200"
            className="scenario-count-input w-24 bg-black/30 border border-white/[0.08] text-zinc-100 rounded-lg text-[11px] px-2.5 py-1.5 outline-none focus:ring-1 focus:border-indigo-500/70 focus:ring-indigo-500/20 transition-colors font-mono"
          />
          <button
            onClick={onRunBatch}
            disabled={!canRun}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-mono bg-indigo-500/15 border border-indigo-500/30 hover:bg-indigo-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-none text-[#9F9FA9]"
          >
            <Play size={11} fill="currentColor" />
            RUN
          </button>
          <button
            onClick={onClearBatch}
            disabled={!hasMatchingBatch}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-mono bg-zinc-800/60 text-zinc-400 border border-zinc-700/50 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-none"
          >
            <X size={11} />
            Clear
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          {!hasMatchingBatch && (
            <div className="py-10 px-6 text-center text-zinc-500 text-xs leading-relaxed">
              Set a <span className="text-zinc-400">Scenarios</span> count above, then run to randomly re-run
              this exact strategy many times and see how consistent its edge really is.
            </div>
          )}

          {hasMatchingBatch && (
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MiniStat label="Total Simulations" value={stats.total.toLocaleString("en-IN")} />
                <MiniStat
                  label="Profitable Runs"
                  value={stats.profitableCount.toFixed(2)}
                  sub={fmtPct(stats.profitablePct)}
                  tone="pos"
                  valueColor="#51A2FF"
                />
                <MiniStat
                  label="Losing Runs"
                  value={stats.losingCount.toFixed(2)}
                  tone={stats.losingCount > 0 ? "neg" : undefined}
                  valueColor="#EC253F"
                />
                <MiniStat label="95% Return CI (Normal)" value={`${stats.ci95Low.toFixed(2)}% to ${stats.ci95High.toFixed(2)}%`} valueColor="#A3B3FF" />
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] uppercase tracking-wide text-zinc-500">Simulation View</div>
                <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-zinc-900 border border-zinc-800">
                  <button
                    onClick={() => setChartMode("outcomes")}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-mono transition-colors ${
                      chartMode === "outcomes" ? "bg-zinc-800 text-zinc-200 border border-zinc-700" : "text-zinc-500 hover:text-zinc-300 border border-transparent"
                    }`}
                  >
                    Outcomes
                  </button>
                  <button
                    onClick={() => setChartMode("paths")}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-mono transition-colors ${
                      chartMode === "paths" ? "bg-zinc-800 text-zinc-200 border border-zinc-700" : "text-zinc-500 hover:text-zinc-300 border border-transparent"
                    }`}
                  >
                    Cumulative path
                  </button>
                </div>
              </div>

              {chartMode === "outcomes" ? (
                <MultiSimHistogram
                  runs={batchResult.runs}
                  selectedRunIdx={selectedRunIdx}
                  onSelectRun={onSelectRun}
                />
              ) : (
                <MultiSimPathsChart
                  runs={batchResult.runs}
                  selectedRunIdx={selectedRunIdx}
                  onSelectRun={onSelectRun}
                />
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <ScenarioCard
                  title="Max Profit Scenario"
                  run={stats.maxProfitRun}
                  tone="pos"
                  valueColor="#7CCF35"
                  selected={selectedRunIdx === stats.maxProfitRun.index}
                  onClick={() => onSelectRun(stats.maxProfitRun)}
                />
                <ScenarioCard
                  title="Max Loss Scenario"
                  run={stats.maxLossRun}
                  tone="neg"
                  valueColor="#FF8904"
                  selected={selectedRunIdx === stats.maxLossRun.index}
                  onClick={() => onSelectRun(stats.maxLossRun)}
                />
                <ScenarioCard
                  title="Max Drawdown Scenario"
                  run={stats.maxDDRun}
                  tone="neg"
                  selected={selectedRunIdx === stats.maxDDRun.index}
                  onClick={() => onSelectRun(stats.maxDDRun)}
                />
              </div>

              <RecoveryTimeAnalysis
                runs={batchResult.runs}
                initialCapital={cfg.initialCapital}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}



// -----------------------------------------------------------------------------
// Drawdown recovery analytics
// -----------------------------------------------------------------------------
// Recovery is measured from an actual peak-to-trough drawdown in the equity
// curve. "Recovery time" is the number of executed trades from the trough back
// to the prior peak. "Underwater duration" is counted from the peak that began
// the drawdown to the trade that reclaimed that peak. If the prior peak is not
// reclaimed inside the run, the episode is marked unrecovered rather than
// inventing a recovery time.
const RECOVERY_BUCKETS = [
  { min: 0, max: 1, label: "0–1%" },
  { min: 1, max: 2, label: "1–2%" },
  { min: 2, max: 5, label: "2–5%" },
  { min: 5, max: 10, label: "5–10%" },
  { min: 10, max: Infinity, label: "10%+" },
];

function recoveryBucketForDD(ddPct) {
  const v = Math.max(0, Number(ddPct) || 0);
  return RECOVERY_BUCKETS.find((b) => v >= b.min && v < b.max) || RECOVERY_BUCKETS[RECOVERY_BUCKETS.length - 1];
}

function analyzeDrawdownRecovery(trades, initialCapital) {
  const startCapital = Number(initialCapital) || 0;
  const path = [startCapital, ...((trades || []).map((t) => Number(t?.capital)).filter(Number.isFinite))];
  if (path.length < 2) {
    return {
      episodes: [],
      maxDDPct: 0,
      maxDDValue: 0,
      maxDDPeakTrade: 0,
      maxDDTroughTrade: 0,
      maxDDRecoveryTrade: null,
      maxDDRecoveryTrades: null,
      maxDDUnderwaterTrades: null,
      maxDDRecovered: null,
      hasDrawdown: false,
      longestUnderwaterTrades: 0,
      recoveredEpisodes: 0,
      unrecoveredEpisodes: 0,
    };
  }

  let peak = path[0];
  let peakIndex = 0;
  let open = null;
  const episodes = [];
  let maxDDValue = 0;
  let maxDDPct = 0;
  let maxDDEpisode = null;

  const closeEpisode = (episode, recoveryIndex = null) => {
    if (!episode) return;
    const recovered = recoveryIndex !== null;
    const out = {
      ...episode,
      recoveryIndex,
      recovered,
      recoveryTrades: recovered ? Math.max(0, recoveryIndex - episode.troughIndex) : null,
      // For an unrecovered episode, report the observed time underwater up to
      // the end of the analyzed horizon rather than inventing a recovery time.
      underwaterTrades: recovered
        ? Math.max(0, recoveryIndex - episode.peakTrade)
        : Math.max(0, path.length - 1 - episode.peakTrade),
    };
    episodes.push(out);
    if (!maxDDEpisode || out.maxDDValue > maxDDEpisode.maxDDValue) maxDDEpisode = out;
  };

  for (let i = 1; i < path.length; i++) {
    const value = path[i];
    if (!Number.isFinite(value)) continue;

    // A recovery occurs when equity reaches the previous peak again. A new
    // higher equity level simultaneously establishes the next peak.
    if (value >= peak - 1e-12) {
      if (open) closeEpisode(open, i);
      open = null;
      if (value > peak + 1e-12) {
        peak = value;
        peakIndex = i;
      }
      continue;
    }

    const ddValue = Math.max(0, peak - value);
    const ddPct = peak > 0 ? (ddValue / peak) * 100 : 0;
    if (!open) {
      open = {
        peakTrade: peakIndex,
        peakValue: peak,
        troughIndex: i,
        troughValue: value,
        maxDDValue: ddValue,
        maxDDPct: ddPct,
      };
    } else if (ddValue > open.maxDDValue + 1e-12) {
      open.troughIndex = i;
      open.troughValue = value;
      open.maxDDValue = ddValue;
      open.maxDDPct = ddPct;
    }

    if (ddValue > maxDDValue + 1e-12 || (Math.abs(ddValue - maxDDValue) <= 1e-12 && ddPct > maxDDPct)) {
      maxDDValue = ddValue;
      maxDDPct = ddPct;
    }
  }

  if (open) closeEpisode(open, null);

  // If there were no below-peak samples, there is no drawdown episode.
  if (maxDDEpisode) {
    maxDDValue = Math.max(maxDDValue, maxDDEpisode.maxDDValue);
    maxDDPct = Math.max(maxDDPct, maxDDEpisode.maxDDPct);
  }

  const recoveredEpisodes = episodes.filter((e) => e.recovered).length;
  const unrecoveredEpisodes = episodes.length - recoveredEpisodes;
  const longestUnderwaterTrades = episodes.reduce(
    (max, e) => Math.max(max, Number(e.underwaterTrades) || 0),
    0
  );

  return {
    episodes,
    maxDDPct,
    maxDDValue,
    maxDDPeakTrade: maxDDEpisode?.peakTrade ?? 0,
    maxDDTroughTrade: maxDDEpisode?.troughIndex ?? 0,
    maxDDRecoveryTrade: maxDDEpisode?.recoveryIndex ?? null,
    maxDDRecoveryTrades: maxDDEpisode?.recoveryTrades ?? null,
    maxDDUnderwaterTrades: maxDDEpisode?.underwaterTrades ?? null,
    maxDDRecovered: maxDDEpisode ? !!maxDDEpisode.recovered : null,
    hasDrawdown: !!maxDDEpisode,
    longestUnderwaterTrades,
    recoveredEpisodes,
    unrecoveredEpisodes,
  };
}


// Break-even recovery analytics: measures the time needed to take cumulative
// realized net P/L from its deepest negative episode back to >= 0 (break-even).
// This is intentionally separate from equity drawdown recovery: equity can be
// below a prior high-water mark while cumulative P/L is still positive, and a
// run can also be net-negative without creating a traditional peak-to-trough DD.
// The analyzer selects the deepest negative P/L episode per run so aggregate
// statistics remain one comparable event per run, matching the DD analyzer's
// "maximum episode per run" convention. Time is executed trades, not clock time.
function analyzeBreakEvenRecovery(trades, initialCapital) {
  const startCapital = Number(initialCapital) || 0;
  const path = [0, ...((trades || []).map((t) => {
    const capital = Number(t?.capital);
    return Number.isFinite(capital) ? capital - startCapital : NaN;
  }))];
  if (path.length < 2) {
    return {
      episodes: [],
      maxNegativePct: 0,
      maxNegativeValue: 0,
      maxNegativeStartTrade: 0,
      maxNegativeTroughTrade: 0,
      maxNegativeRecoveryTrade: null,
      maxNegativeRecoveryTrades: null,
      maxNegativeUnderwaterTrades: null,
      maxNegativeRecovered: null,
      hasNegative: false,
      recoveredEpisodes: 0,
      unrecoveredEpisodes: 0,
    };
  }

  const EPS = 1e-10;
  let open = null;
  const episodes = [];
  let worstEpisode = null;

  const closeEpisode = (episode, recoveryIndex = null) => {
    if (!episode) return;
    const recovered = recoveryIndex !== null;
    const out = {
      ...episode,
      recoveryIndex,
      recovered,
      recoveryTrades: recovered ? Math.max(0, recoveryIndex - episode.troughIndex) : null,
      underwaterTrades: recovered
        ? Math.max(0, recoveryIndex - episode.startTrade)
        : Math.max(0, path.length - 1 - episode.startTrade),
    };
    episodes.push(out);
    if (!worstEpisode || out.troughPnl < worstEpisode.troughPnl - EPS) worstEpisode = out;
  };

  for (let i = 1; i < path.length; i++) {
    const pnl = path[i];
    if (!Number.isFinite(pnl)) continue;

    // Break-even is reached when cumulative realized P/L returns to zero or
    // positive. A positive point therefore closes the negative episode too.
    if (pnl >= -EPS) {
      if (open) closeEpisode(open, i);
      open = null;
      continue;
    }

    if (!open) {
      open = {
        startTrade: i,
        troughIndex: i,
        troughPnl: pnl,
      };
    } else if (pnl < open.troughPnl - EPS) {
      open.troughIndex = i;
      open.troughPnl = pnl;
    }
  }

  if (open) closeEpisode(open, null);

  const recoveredEpisodes = episodes.filter((e) => e.recovered).length;
  const unrecoveredEpisodes = episodes.length - recoveredEpisodes;
  const worst = worstEpisode;
  const maxNegativeValue = worst ? Math.max(0, -worst.troughPnl) : 0;
  const maxNegativePct = startCapital > 0 ? (maxNegativeValue / startCapital) * 100 : 0;

  return {
    episodes,
    maxNegativePct,
    maxNegativeValue,
    maxNegativeStartTrade: worst?.startTrade ?? 0,
    maxNegativeTroughTrade: worst?.troughIndex ?? 0,
    maxNegativeRecoveryTrade: worst?.recoveryIndex ?? null,
    maxNegativeRecoveryTrades: worst?.recoveryTrades ?? null,
    maxNegativeUnderwaterTrades: worst?.underwaterTrades ?? null,
    maxNegativeRecovered: worst ? !!worst.recovered : null,
    hasNegative: !!worst,
    recoveredEpisodes,
    unrecoveredEpisodes,
  };
}

function emptyBreakEvenAccumulator() {
  return {
    count: 0,
    negativeRuns: 0,
    recoveredCount: 0,
    unrecoveredCount: 0,
    recoveryTimes: [],
    underwaterTimes: [],
    bucketCounts: Object.fromEntries(RECOVERY_BUCKETS.map((b) => [b.label, 0])),
    bucketUnrecovered: Object.fromEntries(RECOVERY_BUCKETS.map((b) => [b.label, 0])),
    bucketRecoveryTimes: Object.fromEntries(RECOVERY_BUCKETS.map((b) => [b.label, []])),
    bucketUnderwaterTimes: Object.fromEntries(RECOVERY_BUCKETS.map((b) => [b.label, []])),
  };
}

function addBreakEvenToAccumulator(acc, analysis) {
  if (!acc || !analysis) return acc;
  acc.count += 1;
  if (!analysis.hasNegative) return acc;
  acc.negativeRuns += 1;
  if (analysis.maxNegativeRecovered) acc.recoveredCount += 1;
  else acc.unrecoveredCount += 1;

  const bucket = recoveryBucketForDD(analysis.maxNegativePct).label;
  acc.bucketCounts[bucket] = (acc.bucketCounts[bucket] || 0) + 1;
  if (!analysis.maxNegativeRecovered) acc.bucketUnrecovered[bucket] = (acc.bucketUnrecovered[bucket] || 0) + 1;

  if (analysis.maxNegativeRecoveryTrades != null && Number.isFinite(analysis.maxNegativeRecoveryTrades)) {
    const t = Math.max(0, Math.round(analysis.maxNegativeRecoveryTrades));
    acc.recoveryTimes.push(t);
    acc.bucketRecoveryTimes[bucket].push(t);
  }
  if (analysis.maxNegativeUnderwaterTrades != null && Number.isFinite(analysis.maxNegativeUnderwaterTrades)) {
    const u = Math.max(0, Math.round(analysis.maxNegativeUnderwaterTrades));
    acc.underwaterTimes.push(u);
    acc.bucketUnderwaterTimes[bucket].push(u);
  }
  return acc;
}

function finalizeBreakEvenAccumulator(acc) {
  const count = Math.max(0, Number(acc?.count) || 0);
  const negativeRuns = Math.max(0, Number(acc?.negativeRuns) || 0);
  const recoveredCount = Math.max(0, Number(acc?.recoveredCount) || 0);
  const unrecoveredCount = Math.max(0, Number(acc?.unrecoveredCount) || 0);
  const recoveryTimes = (acc?.recoveryTimes || []).filter(Number.isFinite);
  const underwaterTimes = (acc?.underwaterTimes || []).filter(Number.isFinite);
  return {
    totalRuns: count,
    negativeRuns,
    recoveredRuns: recoveredCount,
    unrecoveredRuns: unrecoveredCount,
    recoveryPct: negativeRuns ? (recoveredCount / negativeRuns) * 100 : 0,
    unrecoveredPct: negativeRuns ? (unrecoveredCount / negativeRuns) * 100 : 0,
    avgRecoveryTrades: recoveryTimes.length ? recoveryTimes.reduce((a, b) => a + b, 0) / recoveryTimes.length : null,
    medianRecoveryTrades: recoveryTimes.length ? percentileValue(recoveryTimes, 0.5) : null,
    p75RecoveryTrades: recoveryTimes.length ? percentileValue(recoveryTimes, 0.75) : null,
    p90RecoveryTrades: recoveryTimes.length ? percentileValue(recoveryTimes, 0.9) : null,
    worstRecoveryTrades: recoveryTimes.length ? Math.max(...recoveryTimes) : null,
    avgUnderwaterTrades: underwaterTimes.length ? underwaterTimes.reduce((a, b) => a + b, 0) / underwaterTimes.length : null,
    medianUnderwaterTrades: underwaterTimes.length ? percentileValue(underwaterTimes, 0.5) : null,
    p90UnderwaterTrades: underwaterTimes.length ? percentileValue(underwaterTimes, 0.9) : null,
    worstUnderwaterTrades: underwaterTimes.length ? Math.max(...underwaterTimes) : null,
    bucketRows: RECOVERY_BUCKETS.map((b) => {
      const times = (acc?.bucketRecoveryTimes?.[b.label] || []).filter(Number.isFinite);
      const uwTimes = (acc?.bucketUnderwaterTimes?.[b.label] || []).filter(Number.isFinite);
      const bucketCount = Number(acc?.bucketCounts?.[b.label]) || 0;
      const unrecovered = Number(acc?.bucketUnrecovered?.[b.label]) || 0;
      return {
        label: b.label,
        count: bucketCount,
        recovered: Math.max(0, bucketCount - unrecovered),
        unrecovered,
        median: times.length ? percentileValue(times, 0.5) : null,
        p75: times.length ? percentileValue(times, 0.75) : null,
        p90: times.length ? percentileValue(times, 0.9) : null,
        worst: times.length ? Math.max(...times) : null,
        medianUnderwater: uwTimes.length ? percentileValue(uwTimes, 0.5) : null,
        worstUnderwater: uwTimes.length ? Math.max(...uwTimes) : null,
      };
    }),
  };
}

function summarizeBreakEvenAnalyses(analyses) {
  const acc = emptyBreakEvenAccumulator();
  (analyses || []).forEach((a) => addBreakEvenToAccumulator(acc, a));
  return finalizeBreakEvenAccumulator(acc);
}

function emptyRecoveryAccumulator() {
  return {
    count: 0,
    drawdownRuns: 0,
    recoveredCount: 0,
    unrecoveredCount: 0,
    recoveryTimes: [],
    underwaterTimes: [],
    bucketCounts: Object.fromEntries(RECOVERY_BUCKETS.map((b) => [b.label, 0])),
    bucketUnrecovered: Object.fromEntries(RECOVERY_BUCKETS.map((b) => [b.label, 0])),
    bucketRecoveryTimes: Object.fromEntries(RECOVERY_BUCKETS.map((b) => [b.label, []])),
    bucketUnderwaterTimes: Object.fromEntries(RECOVERY_BUCKETS.map((b) => [b.label, []])),
    worstRecoveryTrades: 0,
    worstUnderwaterTrades: 0,
  };
}

function addRecoveryToAccumulator(acc, analysis) {
  if (!acc || !analysis) return acc;
  acc.count += 1;
  if (!analysis.hasDrawdown) return acc;
  acc.drawdownRuns += 1;
  if (analysis.maxDDRecovered) acc.recoveredCount += 1;
  else acc.unrecoveredCount += 1;

  const bucket = recoveryBucketForDD(analysis.maxDDPct).label;
  acc.bucketCounts[bucket] = (acc.bucketCounts[bucket] || 0) + 1;
  if (!analysis.maxDDRecovered) acc.bucketUnrecovered[bucket] = (acc.bucketUnrecovered[bucket] || 0) + 1;

  if (analysis.maxDDRecoveryTrades != null && Number.isFinite(analysis.maxDDRecoveryTrades)) {
    const t = Math.max(0, Math.round(analysis.maxDDRecoveryTrades));
    acc.recoveryTimes.push(t);
    if (!acc.bucketRecoveryTimes[bucket]) acc.bucketRecoveryTimes[bucket] = [];
    acc.bucketRecoveryTimes[bucket].push(t);
    acc.worstRecoveryTrades = Math.max(acc.worstRecoveryTrades, t);
  }
  if (analysis.maxDDUnderwaterTrades != null && Number.isFinite(analysis.maxDDUnderwaterTrades)) {
    const u = Math.max(0, Math.round(analysis.maxDDUnderwaterTrades));
    acc.underwaterTimes.push(u);
    if (!acc.bucketUnderwaterTimes[bucket]) acc.bucketUnderwaterTimes[bucket] = [];
    acc.bucketUnderwaterTimes[bucket].push(u);
    acc.worstUnderwaterTrades = Math.max(acc.worstUnderwaterTrades, u);
  }
  return acc;
}

function finalizeRecoveryAccumulator(acc) {
  const count = Math.max(0, Number(acc?.count) || 0);
  const recoveredCount = Math.max(0, Number(acc?.recoveredCount) || 0);
  const unrecoveredCount = Math.max(0, Number(acc?.unrecoveredCount) || 0);
  const recoveryTimes = (acc?.recoveryTimes || []).filter(Number.isFinite);
  const underwaterTimes = (acc?.underwaterTimes || []).filter(Number.isFinite);
  const drawdownRuns = Number(acc?.drawdownRuns) || 0;
  return {
    totalRuns: count,
    drawdownRuns,
    recoveredMaxDDRuns: recoveredCount,
    unrecoveredMaxDDRuns: unrecoveredCount,
    recoveryPct: drawdownRuns ? (recoveredCount / drawdownRuns) * 100 : 0,
    unrecoveredPct: drawdownRuns ? (unrecoveredCount / drawdownRuns) * 100 : 0,
    avgRecoveryTrades: recoveryTimes.length ? recoveryTimes.reduce((a, b) => a + b, 0) / recoveryTimes.length : null,
    medianRecoveryTrades: recoveryTimes.length ? percentileValue(recoveryTimes, 0.5) : null,
    p75RecoveryTrades: recoveryTimes.length ? percentileValue(recoveryTimes, 0.75) : null,
    p90RecoveryTrades: recoveryTimes.length ? percentileValue(recoveryTimes, 0.9) : null,
    worstRecoveryTrades: recoveryTimes.length ? Math.max(...recoveryTimes) : null,
    avgUnderwaterTrades: underwaterTimes.length ? underwaterTimes.reduce((a, b) => a + b, 0) / underwaterTimes.length : null,
    medianUnderwaterTrades: underwaterTimes.length ? percentileValue(underwaterTimes, 0.5) : null,
    p90UnderwaterTrades: underwaterTimes.length ? percentileValue(underwaterTimes, 0.9) : null,
    worstUnderwaterTrades: underwaterTimes.length ? Math.max(...underwaterTimes) : null,
    bucketRows: RECOVERY_BUCKETS.map((b) => {
      const times = (acc?.bucketRecoveryTimes?.[b.label] || []).filter(Number.isFinite);
      const uwTimes = (acc?.bucketUnderwaterTimes?.[b.label] || []).filter(Number.isFinite);
      const bucketCount = Number(acc?.bucketCounts?.[b.label]) || 0;
      const unrecovered = Number(acc?.bucketUnrecovered?.[b.label]) || 0;
      return {
        label: b.label,
        count: bucketCount,
        recovered: Math.max(0, bucketCount - unrecovered),
        unrecovered,
        median: times.length ? percentileValue(times, 0.5) : null,
        p75: times.length ? percentileValue(times, 0.75) : null,
        p90: times.length ? percentileValue(times, 0.9) : null,
        worst: times.length ? Math.max(...times) : null,
        medianUnderwater: uwTimes.length ? percentileValue(uwTimes, 0.5) : null,
        worstUnderwater: uwTimes.length ? Math.max(...uwTimes) : null,
      };
    }),
  };
}

function summarizeRecoveryAnalyses(analyses) {
  const acc = emptyRecoveryAccumulator();
  (analyses || []).forEach((a) => addRecoveryToAccumulator(acc, a));
  return finalizeRecoveryAccumulator(acc);
}

function RecoveryTimeAnalysis({ title = "Drawdown Recovery Time", trades, initialCapital, runs = null, summary = null, breakEvenSummary = null, compact = false }) {
  const [collapsed, setCollapsed] = useState(false);
  const [analysisMode, setAnalysisMode] = useState("drawdown");

  let drawdownRecovery = summary;
  if (!drawdownRecovery && Array.isArray(runs)) {
    drawdownRecovery = summarizeRecoveryAnalyses(
      runs.map((r) => analyzeDrawdownRecovery(r?.result?.trades || r?.trades || [], initialCapital))
    );
  }
  if (!drawdownRecovery && trades?.length) {
    drawdownRecovery = summarizeRecoveryAnalyses([
      analyzeDrawdownRecovery(trades, initialCapital),
    ]);
  }

  let breakEvenRecovery = breakEvenSummary || null;
  if (!breakEvenRecovery && Array.isArray(runs)) {
    breakEvenRecovery = summarizeBreakEvenAnalyses(
      runs.map((r) => analyzeBreakEvenRecovery(r?.result?.trades || r?.trades || [], initialCapital))
    );
  } else if (!breakEvenRecovery && trades?.length) {
    breakEvenRecovery = summarizeBreakEvenAnalyses([
      analyzeBreakEvenRecovery(trades, initialCapital),
    ]);
  }

  const recovery = analysisMode === "drawdown" ? drawdownRecovery : breakEvenRecovery;
  if (!recovery || !recovery.totalRuns) return null;

  const isBreakEven = analysisMode === "breakeven";
  const episodeCount = isBreakEven ? recovery.negativeRuns : recovery.drawdownRuns;
  const recoveredCount = isBreakEven ? recovery.recoveredRuns : recovery.recoveredMaxDDRuns;
  const unrecoveredCount = isBreakEven ? recovery.unrecoveredRuns : recovery.unrecoveredMaxDDRuns;
  const timeLabel = (value) => value == null ? "—" : `${Math.round(value)} trades`;
  const hasEpisode = episodeCount > 0;
  const hasAnyRecovered = recoveredCount > 0 || recovery.avgRecoveryTrades != null;
  const sectionTitle = isBreakEven ? "Break-even Recovery" : title;
  const subtitle = isBreakEven
    ? "Time from the deepest negative cumulative P/L point back to ₹0 or better."
    : "Peak-to-trough DD recovery from actual equity paths · time is measured in executed trades.";
  const bucketTitle = isBreakEven
    ? "Recovery by Deepest Negative P/L Severity"
    : "Recovery by Maximum Drawdown Severity";
  const bucketLabel = isBreakEven ? "Worst Neg P/L" : "Max DD";

  return (
    <div className={`${CARD} overflow-hidden`}>
      <div
        className="w-full px-4 py-3 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-2"
      >
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="min-w-0 flex-1 text-left hover:opacity-90 transition-opacity"
        >
          <div className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-zinc-100">
            <Activity size={14} className="text-[#42D3F2]" />
            {sectionTitle}
            <ChevronDown size={14} className={`text-zinc-500 transition-transform ${collapsed ? "" : "rotate-180"}`} />
          </div>
          <div className="text-[10px] text-zinc-400 mt-0.5">{subtitle}</div>
        </button>
        <div className="flex items-center gap-2 flex-none">
          <div className="flex rounded-md border border-[#57534D] bg-[#27272A] p-0.5">
            <button
              type="button"
              onClick={() => setAnalysisMode("drawdown")}
              className={`px-2.5 py-1 text-[9px] font-mono rounded transition-colors ${analysisMode === "drawdown" ? "bg-[#57534D] text-zinc-100" : "text-zinc-400 hover:text-zinc-200"}`}
            >DD Recovery</button>
            <button
              type="button"
              onClick={() => setAnalysisMode("breakeven")}
              className={`px-2.5 py-1 text-[9px] font-mono rounded transition-colors ${analysisMode === "breakeven" ? "bg-[#57534D] text-zinc-100" : "text-zinc-400 hover:text-zinc-200"}`}
            >Break-even</button>
          </div>
          <span className="text-[10px] font-mono text-zinc-300">{recovery.totalRuns.toLocaleString("en-IN")} run{recovery.totalRuns === 1 ? "" : "s"}</span>
        </div>
      </div>

      {!collapsed && (
        <>
          {!hasEpisode ? (
            <div className="px-4 py-6 text-center text-[10px] text-zinc-400">
              {isBreakEven
                ? "No negative cumulative P/L episode detected in the analyzed horizon."
                : "No drawdown episode detected in the analyzed horizon. Recovery statistics are not applicable."}
            </div>
          ) : (
            <>
              <div className={`${compact ? "grid grid-cols-2 sm:grid-cols-4" : "grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8"} gap-px bg-zinc-800`}>
                <div className="bg-zinc-900 px-3 py-2.5 min-h-[92px] flex flex-col min-w-0">
                  <div className="text-[10px] leading-tight text-zinc-400 min-h-[24px]">Median Recovery</div>
                  <div className="mt-auto pt-1 font-mono text-sm text-[#42D3F2]">{timeLabel(recovery.medianRecoveryTrades)}</div>
                  <div className="text-[9px] leading-tight text-zinc-500 mt-0.5 min-h-[22px]">{isBreakEven ? "trough → P/L ≥ 0" : "trough → prior peak"}</div>
                </div>
                <div className="bg-zinc-900 px-3 py-2.5 min-h-[92px] flex flex-col min-w-0">
                  <div className="text-[10px] leading-tight text-zinc-400 min-h-[24px]">P75 Recovery</div>
                  <div className="mt-auto pt-1 font-mono text-sm text-[#42D3F2]">{timeLabel(recovery.p75RecoveryTrades)}</div>
                  <div className="text-[9px] leading-tight text-zinc-500 mt-0.5 min-h-[22px]">upper-middle case</div>
                </div>
                <div className="bg-zinc-900 px-3 py-2.5 min-h-[92px] flex flex-col min-w-0">
                  <div className="text-[10px] leading-tight text-zinc-400 min-h-[24px]">P90 Recovery</div>
                  <div className="mt-auto pt-1 font-mono text-sm text-[#7CCF35]">{timeLabel(recovery.p90RecoveryTrades)}</div>
                  <div className="text-[9px] leading-tight text-zinc-500 mt-0.5 min-h-[22px]">90th percentile</div>
                </div>
                <div className="bg-zinc-900 px-3 py-2.5 min-h-[92px] flex flex-col min-w-0">
                  <div className="text-[10px] leading-tight text-zinc-400 min-h-[24px]">Worst Recovery</div>
                  <div className="mt-auto pt-1 font-mono text-sm text-[#FF692A]">{timeLabel(recovery.worstRecoveryTrades)}</div>
                  <div className="text-[9px] leading-tight text-zinc-500 mt-0.5 min-h-[22px]">longest recovered case</div>
                </div>
                {!compact && (
                  <>
                    <div className="bg-zinc-900 px-3 py-2.5 min-h-[92px] flex flex-col min-w-0">
                      <div className="text-[10px] leading-tight text-zinc-400 min-h-[24px]">Median Underwater</div>
                      <div className="mt-auto pt-1 font-mono text-sm text-[#42D3F2]">{timeLabel(recovery.medianUnderwaterTrades)}</div>
                      <div className="text-[9px] leading-tight text-zinc-500 mt-0.5 min-h-[22px]">{isBreakEven ? "negative → break-even" : "peak → recovery/end"}</div>
                    </div>
                    <div className="bg-zinc-900 px-3 py-2.5 min-h-[92px] flex flex-col min-w-0">
                      <div className="text-[10px] leading-tight text-zinc-400 min-h-[24px]">Worst Underwater</div>
                      <div className="mt-auto pt-1 font-mono text-sm text-[#FF692A]">{recovery.worstUnderwaterTrades ? `${recovery.worstUnderwaterTrades} trades` : "—"}</div>
                      <div className="text-[9px] leading-tight text-zinc-500 mt-0.5 min-h-[22px]">observed duration</div>
                    </div>
                    <div className="bg-zinc-900 px-3 py-2.5 min-h-[92px] flex flex-col min-w-0">
                      <div className="text-[10px] leading-tight text-zinc-400 min-h-[24px]">Recovered</div>
                      <div className="mt-auto pt-1 font-mono text-sm text-[#7CCF35]">{recoveredCount.toLocaleString("en-IN")}</div>
                      <div className="text-[9px] leading-tight text-zinc-500 mt-0.5 min-h-[22px]">{recovery.recoveryPct.toFixed(2)}% of {isBreakEven ? "negative runs" : "DD runs"}</div>
                    </div>
                    <div className="bg-zinc-900 px-3 py-2.5 min-h-[92px] flex flex-col min-w-0">
                      <div className="text-[10px] leading-tight text-zinc-400 min-h-[24px]">Unrecovered</div>
                      <div className="mt-auto pt-1 font-mono text-sm text-[#FF692A]">{unrecoveredCount.toLocaleString("en-IN")}</div>
                      <div className="text-[9px] leading-tight text-zinc-500 mt-0.5 min-h-[22px]">{recovery.unrecoveredPct.toFixed(2)}% of {isBreakEven ? "negative runs" : "DD runs"}</div>
                    </div>
                  </>
                )}
              </div>

              <div className="px-4 py-2.5 border-t border-zinc-800">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="text-[10px] uppercase tracking-wide text-zinc-400">{bucketTitle}</div>
                  <div className="text-[9px] text-zinc-500 font-mono">t = trades · UW = underwater duration</div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] font-mono text-[10px]">
                    <thead>
                      <tr className="text-zinc-500 border-b border-zinc-800">
                        <th className="text-left py-1.5 pr-3">{bucketLabel}</th>
                        <th className="text-right py-1.5 px-2">Runs</th>
                        <th className="text-right py-1.5 px-2">Recovered</th>
                        <th className="text-right py-1.5 px-2">Median</th>
                        <th className="text-right py-1.5 px-2">P75</th>
                        <th className="text-right py-1.5 px-2">P90</th>
                        <th className="text-right py-1.5 px-2">Worst</th>
                        <th className="text-right py-1.5 px-2">Median UW</th>
                        <th className="text-right py-1.5 px-2">Worst UW</th>
                        <th className="text-right py-1.5 pl-2">Unrecovered</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recovery.bucketRows.map((row) => (
                        <tr key={row.label} className="border-b border-zinc-800/60">
                          <td className="py-1.5 pr-3 text-zinc-300">{row.label}</td>
                          <td className="py-1.5 px-2 text-right text-zinc-300">{row.count.toLocaleString("en-IN")}</td>
                          <td className="py-1.5 px-2 text-right text-[#7CCF35]">{row.recovered.toLocaleString("en-IN")}</td>
                          <td className="py-1.5 px-2 text-right text-[#42D3F2]">{row.median == null ? "—" : `${Math.round(row.median)} t`}</td>
                          <td className="py-1.5 px-2 text-right text-[#42D3F2]">{row.p75 == null ? "—" : `${Math.round(row.p75)} t`}</td>
                          <td className="py-1.5 px-2 text-right text-[#7CCF35]">{row.p90 == null ? "—" : `${Math.round(row.p90)} t`}</td>
                          <td className="py-1.5 px-2 text-right text-[#FF692A]">{row.worst == null ? "—" : `${Math.round(row.worst)} t`}</td>
                          <td className="py-1.5 px-2 text-right text-[#42D3F2]">{row.medianUnderwater == null ? "—" : `${Math.round(row.medianUnderwater)} t`}</td>
                          <td className="py-1.5 px-2 text-right text-[#FF692A]">{row.worstUnderwater == null ? "—" : `${Math.round(row.worstUnderwater)} t`}</td>
                          <td className="py-1.5 pl-2 text-right text-[#FF692A]">{row.unrecovered.toLocaleString("en-IN")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="px-4 pb-3 text-[9px] text-zinc-500">
                {isBreakEven
                  ? "Break-even recovery uses cumulative realized Net P/L and counts recovery when the path returns to 0 or above. Unrecovered episodes receive no fabricated recovery time."
                  : "Recovery time excludes unrecovered episodes. Underwater duration is observed from the peak through the recovery trade, or through the end of the analyzed horizon when unrecovered."}
                {!hasAnyRecovered ? (isBreakEven ? " No negative P/L episode reached break-even within the analyzed horizon." : " No drawdown episode recovered to its prior peak within the analyzed horizon.") : ""}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function RecoveryTimeSweepSection({ points }) {
  const [collapsed, setCollapsed] = useState(false);
  const [analysisMode, setAnalysisMode] = useState("drawdown");
  if (!points?.length) return null;
  const isBreakEven = analysisMode === "breakeven";
  const data = points.map((p) => {
    const median = isBreakEven
      ? (p.medianBreakEvenRecoveryTrades == null ? null : Number(p.medianBreakEvenRecoveryTrades))
      : (p.medianDDRecoveryTrades == null ? null : Number(p.medianDDRecoveryTrades));
    const p75 = isBreakEven
      ? (p.p75BreakEvenRecoveryTrades == null ? null : Number(p.p75BreakEvenRecoveryTrades))
      : (p.p75DDRecoveryTrades == null ? null : Number(p.p75DDRecoveryTrades));
    const p90 = isBreakEven
      ? (p.p90BreakEvenRecoveryTrades == null ? null : Number(p.p90BreakEvenRecoveryTrades))
      : (p.p90DDRecoveryTrades == null ? null : Number(p.p90DDRecoveryTrades));
    const worst = isBreakEven
      ? (p.worstBreakEvenRecoveryTrades == null ? null : Number(p.worstBreakEvenRecoveryTrades))
      : (p.worstDDRecoveryTrades == null ? null : Number(p.worstDDRecoveryTrades));
    return {
      winRate: p.winRate,
      label: `${p.winRate}%`,
      medianRecovery: median,
      p75Recovery: p75,
      p90Recovery: p90,
      worstRecovery: worst,
      recoveryPct: isBreakEven ? (p.breakEvenRecoveryPct == null ? null : Number(p.breakEvenRecoveryPct)) : (p.recoveryPct == null ? null : Number(p.recoveryPct)),
      unrecoveredPct: isBreakEven ? (p.unrecoveredBreakEvenPct == null ? null : Number(p.unrecoveredBreakEvenPct)) : (p.unrecoveredMaxDDPct == null ? null : Number(p.unrecoveredMaxDDPct)),
      bandBase: median,
      bandSpread: median != null && p90 != null ? Math.max(0, p90 - median) : null,
    };
  });
  const usable = data.some((d) => d.medianRecovery != null || d.p90Recovery != null || d.worstRecovery != null);
  if (!usable) return null;
  const title = isBreakEven ? "Break-even Recovery" : "Drawdown Recovery Time";
  const subtitle = isBreakEven
    ? "How long negative cumulative P/L takes to return to break-even at each Win Rate."
    : "How long the maximum drawdown takes to reclaim the prior peak at each Win Rate.";
  const yLabel = isBreakEven ? "Trades to P/L ≥ 0" : "Trades to prior peak";
  return (
    <div className={`${CARD} overflow-hidden`}>
      <div
        className="w-full px-4 py-3 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3"
      >
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="min-w-0 flex-1 text-left hover:opacity-90 transition-opacity"
        >
          <div className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-zinc-100">
            <Activity size={14} className="text-[#42D3F2]" />
            {title}
            <ChevronDown size={14} className={`text-zinc-500 transition-transform ${collapsed ? "" : "rotate-180"}`} />
          </div>
          <div className="text-[10px] text-zinc-400 mt-0.5">{subtitle}</div>
        </button>
        <div className="flex items-center gap-2 flex-none">
          <div className="flex rounded-md border border-[#57534D] bg-[#27272A] p-0.5">
            <button type="button" onClick={() => setAnalysisMode("drawdown")} className={`px-2.5 py-1 text-[9px] font-mono rounded transition-colors ${analysisMode === "drawdown" ? "bg-[#57534D] text-zinc-100" : "text-zinc-400 hover:text-zinc-200"}`}>DD Recovery</button>
            <button type="button" onClick={() => setAnalysisMode("breakeven")} className={`px-2.5 py-1 text-[9px] font-mono rounded transition-colors ${analysisMode === "breakeven" ? "bg-[#57534D] text-zinc-100" : "text-zinc-400 hover:text-zinc-200"}`}>Break-even</button>
          </div>
          <span className="text-[10px] font-mono text-zinc-500 flex-none">{yLabel}</span>
        </div>
      </div>
      {!collapsed && (
        <>
          <div className="px-4 py-2 border-b border-zinc-800/70 flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px] font-mono text-zinc-400">
            <span><i className="inline-block w-2 h-2 rounded-full bg-[#42D3F2] mr-1" />Median</span>
            <span><i className="inline-block w-2 h-2 rounded-full bg-[#7CCF35] mr-1" />P90 upper tail</span>
            <span className="text-zinc-500">Shaded gap = Median → P90</span>
          </div>
          <div className="h-72 sm:h-80 px-2 pt-3 pb-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 10, right: 22, bottom: 4, left: 0 }}>
                <defs>
                  <linearGradient id={isBreakEven ? "breakevenBandGradient" : "recoveryBandGradientSweep"} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7CCF35" stopOpacity={0.14} />
                    <stop offset="100%" stopColor="#42D3F2" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#57534D" strokeOpacity={0.22} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" stroke="#A1A1AA" fontSize={10} tickLine={false} axisLine={false} minTickGap={10} />
                <YAxis stroke="#A1A1AA" fontSize={10} tickLine={false} axisLine={false} width={52} allowDecimals={false} tickFormatter={(v) => `${Math.round(v)}t`} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0]?.payload;
                    if (!row) return null;
                    return (
                      <div className="bg-[#27272A] border border-[#57534D] rounded-lg px-3 py-2.5 font-mono shadow-xl shadow-black/50 min-w-[180px]">
                        <div className="text-[10px] text-zinc-300 mb-2">Win Rate {label}</div>
                        <div className="flex items-center justify-between gap-4 text-[10px]"><span className="text-[#42D3F2]">Median</span><span className="text-zinc-100">{row.medianRecovery == null ? "—" : `${Math.round(row.medianRecovery)} trades`}</span></div>
                        <div className="flex items-center justify-between gap-4 text-[10px] mt-1"><span className="text-[#42D3F2]">P75</span><span className="text-zinc-100">{row.p75Recovery == null ? "—" : `${Math.round(row.p75Recovery)} trades`}</span></div>
                        <div className="flex items-center justify-between gap-4 text-[10px] mt-1"><span className="text-[#7CCF35]">P90</span><span className="text-zinc-100">{row.p90Recovery == null ? "—" : `${Math.round(row.p90Recovery)} trades`}</span></div>
                        <div className="flex items-center justify-between gap-4 text-[10px] mt-1"><span className="text-[#FF692A]">Worst</span><span className="text-zinc-100">{row.worstRecovery == null ? "—" : `${Math.round(row.worstRecovery)} trades`}</span></div>
                        <div className="flex items-center justify-between gap-4 text-[10px] mt-1"><span className="text-zinc-400">Recovered</span><span className="text-zinc-100">{row.recoveryPct == null ? "—" : `${row.recoveryPct.toFixed(1)}%`}</span></div>
                      </div>
                    );
                  }}
                />
                <Area type="monotone" dataKey="bandBase" stackId={isBreakEven ? "breakevenBand" : "recoveryBandSweep"} stroke="none" fill="transparent" fillOpacity={0} isAnimationActive={false} connectNulls={false} />
                <Area type="monotone" dataKey="bandSpread" stackId={isBreakEven ? "breakevenBand" : "recoveryBandSweep"} stroke="none" fill={`url(#${isBreakEven ? "breakevenBandGradient" : "recoveryBandGradientSweep"})`} fillOpacity={1} isAnimationActive={false} connectNulls={false} />
                <Line type="monotone" dataKey="medianRecovery" name="Median Recovery" stroke="#42D3F2" strokeWidth={2.6} dot={{ r: 2.5, fill: "#42D3F2", strokeWidth: 0 }} activeDot={{ r: 5, fill: "#42D3F2", stroke: "#27272A", strokeWidth: 2 }} isAnimationActive={false} connectNulls={false} />
                <Line type="monotone" dataKey="p90Recovery" name="P90 Recovery" stroke="#7CCF35" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 1.8, fill: "#7CCF35", strokeWidth: 0 }} activeDot={{ r: 4, fill: "#7CCF35", stroke: "#27272A", strokeWidth: 2 }} isAnimationActive={false} connectNulls={false} />
                <Line type="monotone" dataKey="worstRecovery" name="Worst Recovery" stroke="#FF692A" strokeWidth={1.2} strokeDasharray="2 4" dot={false} activeDot={{ r: 3.5, fill: "#FF692A", stroke: "#27272A", strokeWidth: 2 }} isAnimationActive={false} connectNulls={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="px-4 pb-3 text-[9px] font-mono text-zinc-500">
            {isBreakEven
              ? "Break-even recovery is measured from the deepest negative cumulative Net P/L point to the first trade where cumulative Net P/L returns to 0 or above. Unrecovered points are not assigned a false recovery time."
              : "Recovery time excludes unrecovered episodes; unrecovered points are shown via recovery rate instead of assigning a false time."}
          </div>
        </>
      )}
    </div>
  );
}

function buildBernoulliWinLossSeq(n, winRatePct, rng = Math.random) {
  const p = Math.max(0, Math.min(1, Number(winRatePct) / 100));
  return Array.from({ length: Math.max(1, Math.round(n)) }, () => rng() < p);
}

function longestLossStreak(seq) {
  let current = 0;
  let longest = 0;
  for (const isWin of seq || []) {
    if (isWin) current = 0;
    else {
      current += 1;
      longest = Math.max(longest, current);
    }
  }
  return longest;
}

function percentileValue(values, p) {
  if (!values || !values.length) return 0;
  const a = [...values].sort((x, y) => x - y);
  const pos = (a.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return a[lo];
  return a[lo] + (a[hi] - a[lo]) * (pos - lo);
}

function wilsonInterval(successes, total, z = 1.96) {
  const n = Math.max(0, Number(total) || 0);
  if (!n) return { low: 0, high: 0 };
  const p = Math.max(0, Math.min(1, (Number(successes) || 0) / n));
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const margin = (z / denom) * Math.sqrt((p * (1 - p) / n) + (z2 / (4 * n * n)));
  return {
    low: Math.max(0, center - margin),
    high: Math.min(1, center + margin),
  };
}

function makeDistributionBins(values, count = 12) {
  const nums = (values || []).map(Number).filter(Number.isFinite);
  if (!nums.length) return [];
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  if (Math.abs(max - min) < 1e-12) {
    return [{
      start: min,
      end: max,
      label: `${fmtMoney(min)}`,
      count: nums.length,
    }];
  }
  const binCount = Math.max(5, Math.min(count, Math.ceil(Math.sqrt(nums.length))));
  const width = (max - min) / binCount;
  const bins = Array.from({ length: binCount }, (_, i) => ({
    start: min + i * width,
    end: i === binCount - 1 ? max : min + (i + 1) * width,
    count: 0,
  }));
  nums.forEach((v) => {
    let idx = Math.floor((v - min) / width);
    if (idx >= binCount) idx = binCount - 1;
    if (idx < 0) idx = 0;
    bins[idx].count += 1;
  });
  return bins.map((b) => ({
    ...b,
    label: `${fmtMoney(b.start)}–${fmtMoney(b.end)}`,
  }));
}

function scaleBankrollConfig(rawCfg, baseMode, multiplier) {
  const cfg = cleanConfig(rawCfg);
  const m = Math.max(0.05, Number(multiplier) || 1);
  const next = { ...cfg };
  next.riskPct = Math.max(0.0001, cfg.riskPct * m);
  if (baseMode === "fno") {
    if (cfg.fnoSegment === "intraday") {
      next.fnoQuantity = Math.max(1, Math.round(cfg.fnoQuantity * m));
    } else {
      next.fnoLots = Math.max(1, Math.round(cfg.fnoLots * m));
    }
  } else {
    next.baseLots = Math.max(0.0001, cfg.baseLots * m);
  }
  return next;
}

function BankrollPathTooltip({ active, payload, label, initialCapital }) {
  if (!active || !payload || !payload.length) return null;
  const median = payload.find((p) => p.dataKey === "median")?.value;
  const p10 = payload.find((p) => p.dataKey === "p10")?.value;
  const p90 = payload.find((p) => p.dataKey === "p90")?.value;
  return (
    <div className="min-w-[210px] bg-[#27272A] border border-[#57534D] rounded-lg px-3 py-2.5 shadow-xl shadow-black/50 font-mono">
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="text-[10px] uppercase tracking-wide text-zinc-400">Trade {label}</span>
        <span className="text-[9px] text-zinc-600">Capital band</span>
      </div>
      {[['Median', median, '#42D3F2'], ['P10', p10, '#FF692A'], ['P90', p90, '#7CCF35']].map(([k, v, c]) => (
        <div key={k} className="flex items-center justify-between gap-4 text-[10px] leading-5">
          <span className="text-zinc-500">{k}</span>
          <span className="font-semibold" style={{ color: c }}>{v == null ? '—' : fmtMoney(v)}</span>
        </div>
      ))}
      <div className="mt-1.5 pt-1.5 border-t border-[#57534D]/50 text-[9px] text-zinc-600">
        Start {fmtMoney(initialCapital)}
      </div>
    </div>
  );
}

function BankrollRiskTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="min-w-[190px] bg-[#27272A] border border-[#57534D] rounded-lg px-3 py-2.5 shadow-xl shadow-black/50 font-mono">
      <div className="text-[10px] uppercase tracking-wide text-zinc-400 mb-2">Base Risk {d.riskPct.toFixed(2)}%</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
        <span className="text-zinc-500">Ruin</span><span className="text-right text-[#FF692A]">{d.ruinPct.toFixed(2)}%</span>
        <span className="text-zinc-500">Median Final</span><span className="text-right text-[#42D3F2]">{fmtMoney(d.medianFinal)}</span>
        <span className="text-zinc-500">P90 DD</span><span className="text-right text-[#FF692A]">{d.p90DD.toFixed(2)}%</span>
        <span className="text-zinc-500">Profitable</span><span className="text-right text-[#7CCF35]">{d.profitablePct.toFixed(1)}%</span>
      </div>
    </div>
  );
}

function BankrollDistributionTooltip({ active, payload, label, title }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="min-w-[190px] bg-[#27272A] border border-[#57534D] rounded-lg px-3 py-2.5 shadow-xl shadow-black/50 font-mono">
      <div className="text-[10px] uppercase tracking-wide text-zinc-400 mb-1">{title}</div>
      <div className="text-[11px] text-zinc-200 mb-1">{label}</div>
      <div className="text-[10px] text-zinc-500">Runs: <span className="text-zinc-200">{d.count}</span></div>
    </div>
  );
}

function BankrollPage({ baseMode, sourceCfg, runs, cycles, tradesPerRun, ruinDD, onRunsChange, onCyclesChange, onTradesChange, onRuinDDChange, onBaseModeChange, result, onRun, running, progress, error }) {
  const initialCapital = Math.max(0, Number(sourceCfg?.initialCapital) || 0);
  const sourceCfgClean = cleanConfig(sourceCfg || DEFAULTS);
  const hasResult = !!result;
  const overall = result?.overallStats || result?.stats || null;
  const totalSimulations = result ? result.pooledRunsCount || (result.runs?.length || 0) : 0;

  return (
    <div className="space-y-4">
      <div className={`${CARD} overflow-hidden`}>
        <div className="px-4 py-3 border-b border-[#57534D]/70 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[14px] font-semibold text-zinc-100">
              <Shield size={14} className="text-[#42D3F2] shrink-0" />
              Bankroll
            </div>
            <div className="mt-1 text-[10px] text-zinc-400">Long-run survival, drawdown and risk-size analysis from the active core engine.</div>
          </div>
          <div className="flex items-center gap-1.5 p-0.5 rounded-lg bg-[#27272A] border border-[#57534D]">
            {[['single', 'Single Run'], ['fno', 'Day / F&O']].map(([m, label]) => (
              <button
                key={m}
                onClick={() => onBaseModeChange(m)}
                className={`px-3 py-1.5 rounded-md text-[10px] font-mono transition-colors ${
                  baseMode === m ? 'bg-[#57534D] text-zinc-100' : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >{label}</button>
            ))}
          </div>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
            <MiniStat label="Initial Capital" value={fmtMoney(initialCapital)} valueColor="#42D3F2" />
            <MiniStat label="Win Rate" value={fmtPct(sourceCfgClean.winRate)} valueColor="#7CCF35" />
            <MiniStat label="Reward:Risk" value={sourceCfgClean.rrMode === 'range' ? `${sourceCfgClean.rrMin.toFixed(2)}–${sourceCfgClean.rrMax.toFixed(2)}` : sourceCfgClean.rr.toFixed(2)} valueColor="#7CCF35" />
            <MiniStat label="Base Risk" value={`${sourceCfgClean.riskPct.toFixed(2)}%`} valueColor="#FF692A" />
            <MiniStat label="Risk Model" value={riskAllocationModeLabel(sourceCfgClean.cascadeMode)} valueColor="#42D3F2" />
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
            <Field label="Simulations / Bankroll" hint="default 200">
              <NumInput value={runs} onChange={onRunsChange} step="50" min="20" max="2000" color="blue" />
            </Field>
            <Field label="Bankroll Repeats" hint="default 100">
              <NumInput value={cycles} onChange={onCyclesChange} step="10" min="1" max="1000" color="blue" />
            </Field>
            <Field label="Trades / Run" hint="long-horizon sample">
              <NumInput value={tradesPerRun} onChange={onTradesChange} step="10" min="10" max="1000" color="blue" />
            </Field>
            <Field label="Ruin Threshold" hint="drawdown from initial">
              <NumInput value={ruinDD} onChange={onRuinDDChange} step="5" min="50" max="99" color="blue" />
            </Field>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1 text-[10px] leading-relaxed text-zinc-400">
              One bankroll repeat = the full simulation set above. The overall summary pools every simulation across all repeats.
              {progress?.total > 0 && progress.done > 0 && running && (
                <span className="ml-2 font-mono text-[#42D3F2]">{progress.done}/{progress.total} bankroll repeats</span>
              )}
            </div>
            <button
              onClick={onRun}
              disabled={running || initialCapital <= 0}
              className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-md text-[10px] font-mono bg-[#42D3F2]/10 border border-[#42D3F2]/35 text-[#42D3F2] hover:bg-[#42D3F2]/15 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Play size={11} fill="currentColor" />
              {running ? `RUNNING ${progress?.done || 0}/${progress?.total || Number(cycles) || 0}` : 'RUN BANKROLL'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className={`${CARD} border border-[#FF692A]/35 bg-[#FF692A]/[0.05] px-4 py-3 text-[11px] text-[#FF692A] font-mono`} role="alert">
          {error}
        </div>
      )}

      {!hasResult && (
        <div className={`${CARD} py-14 text-center text-zinc-400 text-xs`}>
          Run the bankroll model to build an overall survival, drawdown and risk profile across repeated simulation sets.
        </div>
      )}

      {hasResult && overall && (
        <>
          <div className={`${CARD} overflow-hidden`}>
            <div className="px-4 py-3 border-b border-[#57534D]/70 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[13px] font-semibold text-zinc-100">Overall Summary</div>
                <div className="text-[10px] text-zinc-400 mt-0.5">Average distribution across the complete bankroll run set</div>
              </div>
              <div className="text-[10px] font-mono text-zinc-300">{result.totalBankrollCycles} bankroll repeats × {result.runsPerBankroll} simulations = {totalSimulations.toLocaleString('en-IN')} outcomes</div>
              {result.note && <div className="w-full mt-1 text-[10px] font-mono text-[#FF692A]">{result.note}</div>}
            </div>
            <div className="p-3 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5">
              <MiniStat label="Survival Rate" value={fmtPct(overall.survivalPct)} valueColor="#7CCF35" />
              <MiniStat label="Simulated Ruin" value={fmtPct(overall.ruinPct)} sub={`95% CI ${fmtPct(overall.ruinCI.low)}–${fmtPct(overall.ruinCI.high)}`} valueColor="#FF692A" />
              <MiniStat label="Average Final" value={fmtMoney(overall.meanFinal)} valueColor="#42D3F2" />
              <MiniStat label="Median Final" value={fmtMoney(overall.medianFinal)} valueColor="#42D3F2" />
              <MiniStat label="Average Max DD" value={fmtPct(overall.meanDD)} valueColor="#FF692A" />
              <MiniStat label="P90 Max DD" value={fmtPct(overall.p90DD)} valueColor="#FF692A" />
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className={`${CARD} overflow-hidden`}>
              <div className="px-4 py-3 border-b border-[#57534D]/70 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[13px] font-semibold text-zinc-100">Capital Paths</div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">Average P10–P90 bands across bankroll repeats with sample outcome paths</div>
                </div>
                <div className="text-[10px] font-mono text-zinc-300">{result.runsPerBankroll} sample paths</div>
              </div>
              <div className="h-80 px-2 pt-4 pb-2">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={result.pathChartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke="#57534D" strokeOpacity={0.32} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="trade" stroke="#A1A1AA" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis stroke="#A1A1AA" fontSize={10} tickLine={false} axisLine={false} width={62} tickFormatter={(v) => fmtMoney(v)} domain={['auto', 'auto']} />
                    <ReferenceLine y={initialCapital} stroke="#57534D" strokeDasharray="4 4" />
                    <Tooltip content={<BankrollPathTooltip initialCapital={initialCapital} />} cursor={{ stroke: '#57534D', strokeWidth: 1 }} />
                    <Area type="monotone" dataKey="bandBase" stackId="capitalBand" stroke="none" fill="transparent" fillOpacity={0} isAnimationActive={false} />
                    <Area type="monotone" dataKey="bandWidth" stackId="capitalBand" stroke="none" fill="#42D3F2" fillOpacity={0.20} isAnimationActive={false} />
                    {result.pathSeries.map((series, idx) => (
                      <Line
                        key={series.key}
                        type="monotone"
                        dataKey={series.key}
                        stroke={series.selected ? '#42D3F2' : series.final >= initialCapital ? '#7CCF35' : '#FF692A'}
                        strokeWidth={series.selected ? 2.8 : 1.45}
                        strokeOpacity={series.selected ? 1 : 0.68}
                        dot={false}
                        isAnimationActive={false}
                        connectNulls={false}
                      />
                    ))}
                    <Line type="monotone" dataKey="median" stroke="#42D3F2" strokeWidth={2.8} dot={false} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="px-4 pb-3 flex flex-wrap gap-x-4 gap-y-1 text-[9px] font-mono text-zinc-400">
                <span><i className="inline-block w-2 h-2 rounded-full bg-[#42D3F2] mr-1" />Median</span>
                <span><i className="inline-block w-2 h-2 rounded-full bg-[#7CCF35] mr-1" />Profitable paths</span>
                <span><i className="inline-block w-2 h-2 rounded-full bg-[#FF692A] mr-1" />Losing paths</span>
                <span>Reference = Initial Capital</span>
              </div>
            </div>

            <div className={`${CARD} overflow-hidden`}>
              <div className="px-4 py-3 border-b border-[#57534D]/70 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[13px] font-semibold text-zinc-100">Risk Size Sensitivity</div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">Same sampled outcome sequences replayed at different base-risk sizes</div>
                </div>
                <span className="text-[9px] font-mono text-zinc-300">Representative sample</span>
              </div>
              <div className="h-80 px-2 pt-4 pb-2">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={result.riskSensitivity} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#57534D" strokeOpacity={0.22} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="riskLabel" stroke="#A1A1AA" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="left" stroke="#FF692A" fontSize={10} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => `${v}%`} />
                    <YAxis yAxisId="right" orientation="right" stroke="#42D3F2" fontSize={10} tickLine={false} axisLine={false} width={60} tickFormatter={(v) => fmtMoney(v)} />
                    <Tooltip content={<BankrollRiskTooltip />} cursor={{ stroke: '#57534D' }} />
                    <Line yAxisId="left" type="monotone" dataKey="ruinPct" name="Ruin" stroke="#FF692A" strokeWidth={2.3} dot={{ r: 2.5, fill: '#FF692A', strokeWidth: 0 }} isAnimationActive={false} />
                    <Line yAxisId="right" type="monotone" dataKey="medianFinal" name="Median Final" stroke="#42D3F2" strokeWidth={1.9} dot={{ r: 2, fill: '#42D3F2', strokeWidth: 0 }} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="px-4 pb-3 text-[10px] text-zinc-400">Lower risk generally reduces drawdown and ruin exposure; higher risk increases both.</div>
            </div>
          </div>

          <RecoveryTimeAnalysis
            summary={result.recoverySummary}
            breakEvenSummary={result.breakEvenRecoverySummary}
            initialCapital={initialCapital}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className={`${CARD} overflow-hidden`}>
              <div className="px-4 py-3 border-b border-[#57534D]/70"><div className="text-[13px] font-semibold text-zinc-100">Final Capital Distribution</div></div>
              <div className="h-60 px-2 pt-4 pb-2">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={result.finalBins} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#57534D" strokeOpacity={0.20} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" hide />
                    <YAxis stroke="#A1A1AA" fontSize={9} tickLine={false} axisLine={false} width={36} />
                    <Tooltip content={<BankrollDistributionTooltip title="Final Capital" />} />
                    <Bar dataKey="count" name="Runs" fill="#42D3F2" isAnimationActive={false} radius={[3,3,0,0]} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="px-4 pb-3 text-[10px] text-zinc-400">P10 {fmtMoney(overall.p10Final)} · Median {fmtMoney(overall.medianFinal)} · P90 {fmtMoney(overall.p90Final)}</div>
            </div>

            <div className={`${CARD} overflow-hidden`}>
              <div className="px-4 py-3 border-b border-[#57534D]/70"><div className="text-[13px] font-semibold text-zinc-100">Drawdown Distribution</div></div>
              <div className="h-60 px-2 pt-4 pb-2">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={result.ddBins} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#57534D" strokeOpacity={0.20} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" hide />
                    <YAxis stroke="#A1A1AA" fontSize={9} tickLine={false} axisLine={false} width={36} />
                    <Tooltip content={<BankrollDistributionTooltip title="Max Drawdown" />} />
                    <Bar dataKey="count" name="Runs" fill="#FF692A" isAnimationActive={false} radius={[3,3,0,0]} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="px-4 pb-3 text-[10px] text-zinc-400">Median {fmtPct(overall.medianDD)} · P90 {fmtPct(overall.p90DD)} · Worst {fmtPct(overall.worstDD)}</div>
            </div>

            <div className={`${CARD} overflow-hidden`}>
              <div className="px-4 py-3 border-b border-[#57534D]/70"><div className="text-[13px] font-semibold text-zinc-100">Losing Streak Distribution</div></div>
              <div className="h-60 px-2 pt-4 pb-2">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={result.streakBins} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#57534D" strokeOpacity={0.20} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" hide />
                    <YAxis stroke="#A1A1AA" fontSize={9} tickLine={false} axisLine={false} width={36} />
                    <Tooltip content={<BankrollDistributionTooltip title="Longest Losing Streak" />} />
                    <Bar dataKey="count" name="Runs" fill="#7CCF35" isAnimationActive={false} radius={[3,3,0,0]} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="px-4 pb-3 text-[10px] text-zinc-400">Median {overall.medianLossStreak} losses · P90 {overall.p90LossStreak} · Worst {overall.worstLossStreak}</div>
            </div>
          </div>

          <div className={`${CARD} overflow-hidden`}>
            <div className="px-4 py-3 border-b border-[#57534D]/70 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[13px] font-semibold text-zinc-100">Risk Profile</div>
                <div className="text-[10px] text-zinc-400 mt-0.5">Overall readout across every simulated outcome</div>
              </div>
              <div className="text-[10px] font-mono text-zinc-300">Ruin = equity reaches {fmtPct(100 - result.ruinDD)} of initial capital or lower</div>
            </div>
            <div className="p-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2.5">
              {[
                ['Average Return', fmtPct(overall.meanReturn), 'Arithmetic mean across all simulated outcomes', overall.meanReturn >= 0 ? '#7CCF35' : '#FF692A'],
                ['Profitable Runs', fmtPct(overall.profitablePct), 'Outcomes finishing above starting capital', '#7CCF35'],
                ['Simulated Ruin', fmtPct(overall.ruinPct), `${overall.ruinedCount.toLocaleString('en-IN')} of ${overall.total.toLocaleString('en-IN')} outcomes`, '#FF692A'],
                ['Survival Rate', fmtPct(overall.survivalPct), 'Outcomes that stayed above the ruin level', '#7CCF35'],
                ['Stopped Runs', `${overall.stoppedCount.toLocaleString('en-IN')} / ${overall.total.toLocaleString('en-IN')}`, 'Triggered by existing safety/risk rules', '#FF692A'],
                ['Average Trades Executed', overall.avgTradesExecuted.toFixed(1), 'Accounts for early safety stops', '#42D3F2'],
                ['Average Final Capital', fmtMoney(overall.meanFinal), 'Arithmetic mean ending equity', '#42D3F2'],
                ['P90 Max Drawdown', fmtPct(overall.p90DD), '90th percentile peak-to-trough decline', '#FF692A'],
              ].map(([label, value, detail, color]) => (
                <div key={label} className="rounded-lg border border-[#57534D] bg-[#27272A]/65 px-3 py-2.5 min-w-0">
                  <div className="text-[10px] uppercase tracking-wide text-zinc-400">{label}</div>
                  <div className="mt-1 text-[13px] font-mono font-semibold tabular-nums" style={{ color }}>{value}</div>
                  <div className="mt-1 text-[9px] leading-4 text-zinc-300">{detail}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Floating Run button: fixed to the viewport (not the Configuration column)
// so it stays reachable even after that sidebar is scrolled past, and
// free-draggable to wherever on screen the user wants it parked. A plain
// click (pointer released without any real movement) fires onRun; a drag
// just relocates the button without running anything. Position is clamped
// to stay fully on-screen, including after a window resize.
function DraggableRunButton({ onRun }) {
  const [pos, setPos] = useState(null); // null until we know viewport size to place the default spot
  const btnRef = useRef(null);
  const dragRef = useRef({ dragging: false, moved: false, startX: 0, startY: 0, baseX: 0, baseY: 0 });
  const SIZE = 64;

  const clamp = useCallback((x, y) => {
    const el = btnRef.current;
    const w = el ? el.offsetWidth : SIZE;
    const h = el ? el.offsetHeight : SIZE;
    const maxX = Math.max(4, window.innerWidth - w - 4);
    const maxY = Math.max(4, window.innerHeight - h - 4);
    return { x: Math.min(Math.max(4, x), maxX), y: Math.min(Math.max(4, y), maxY) };
  }, []);

  useEffect(() => {
    setPos((p) => p || clamp(window.innerWidth - SIZE - 24, window.innerHeight - SIZE - 24));
  }, [clamp]);

  useEffect(() => {
    const onResize = () => setPos((p) => (p ? clamp(p.x, p.y) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clamp]);

  const handlePointerMove = useCallback(
    (e) => {
      const d = dragRef.current;
      if (!d.dragging) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) d.moved = true;
      setPos(clamp(d.baseX + dx, d.baseY + dy));
    },
    [clamp]
  );

  const handlePointerUp = useCallback(() => {
    const d = dragRef.current;
    d.dragging = false;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
    if (!d.moved) onRun();
  }, [handlePointerMove, onRun]);

  const handlePointerDown = (e) => {
    if (!pos) return;
    dragRef.current = { dragging: true, moved: false, startX: e.clientX, startY: e.clientY, baseX: pos.x, baseY: pos.y };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  if (!pos) return null;

  return (
    <button
      ref={btnRef}
      onPointerDown={handlePointerDown}
      style={{ position: "fixed", left: pos.x, top: pos.y, width: SIZE, height: SIZE, zIndex: 50, touchAction: "none" }}
      className="flex items-center justify-center bg-gradient-to-r from-zinc-700 to-zinc-950 border border-zinc-700 text-zinc-100 font-semibold text-sm rounded-full shadow-lg shadow-black/50 hover:brightness-125 active:brightness-95 transition-[filter] cursor-grab active:cursor-grabbing select-none"
    >
      RUN
    </button>
  );
}

// -----------------------------------------------------------------------------
// Strategy Builder
// -----------------------------------------------------------------------------
// Builder is a deterministic search layer over the SAME simulation engines used
// by Single Run and Day / F&O. The active strategy configuration supplies the
// risk model, RR, costs and safety stops. Builder controls the total risk budget
// and the allowed trade-count range, then searches every mathematically possible
// win-rate that can occur between the selected trade-count limits.
function gcd(a, b) {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x || 1;
}

function formatBuilderWinRate(value) {
  const n = Number(value) || 0;
  if (Math.abs(n - Math.round(n)) < 1e-9) return `${Math.round(n)}%`;
  return `${n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}%`;
}

function compareBuilderCandidates(a, b) {
  return (
    (b.returnPct - a.returnPct) ||
    (a.worstCaseLossValue - b.worstCaseLossValue) ||
    (a.maxDDValue - b.maxDDValue) ||
    (a.tradeCount - b.tradeCount) ||
    a.sequence.localeCompare(b.sequence)
  );
}

function getLosingRateRanges(points) {
  const sorted = [...points].sort((a, b) => a.targetWinRate - b.targetWinRate);
  const ranges = [];
  let start = null;
  let end = null;

  // A range is a contiguous run of tested win-rate points with no profitable
  // point between them. We deliberately use the actual sorted Builder points
  // instead of numeric spacing, because the exact rates are fractions such as
  // 28.57%, 30%, 33.33%, etc.
  for (const point of sorted) {
    const isLosing = point.status === "Losing Range";
    if (isLosing) {
      if (!start) start = point;
      end = point;
    } else if (start) {
      ranges.push({ start, end });
      start = null;
      end = null;
    }
  }

  if (start) ranges.push({ start, end });
  return ranges;
}

function formatLosingRateRanges(points) {
  const ranges = getLosingRateRanges(points);
  return ranges.map(({ start, end }) => {
    const startLabel = formatBuilderWinRate(start.targetWinRate);
    const endLabel = formatBuilderWinRate(end.targetWinRate);
    return start.targetWinRate === end.targetWinRate ? startLabel : `${startLabel} – ${endLabel}`;
  });
}

const BUILDER_SAFE_LIMITS = {
  maxSequenceEvaluations: 100000,
  maxGroupsSampled: 1200,
  maxStoredCandidatesPerGroup: 12,
  maxSampledTradeCounts: 48,
};

function estimateTotalBinarySequences(minTrades, maxTrades, cap = BUILDER_SAFE_LIMITS.maxSequenceEvaluations) {
  let total = 0;
  for (let n = minTrades; n <= maxTrades; n++) {
    if (n >= 53) return cap + 1;
    total += 2 ** n;
    if (total > cap) return total;
  }
  return total;
}

function forEachWinLossSequence(n, wins, visitor, stopRef = null) {
  const seq = Array(n).fill(false);
  const visit = (pos, remainingWins) => {
    if (stopRef?.stop) return;
    if (pos === n) {
      if (remainingWins === 0) visitor(seq.slice());
      return;
    }
    const left = n - pos;
    if (remainingWins > left) return;
    if (remainingWins > 0) {
      seq[pos] = true;
      visit(pos + 1, remainingWins - 1);
    }
    if (left - 1 >= remainingWins) {
      seq[pos] = false;
      visit(pos + 1, remainingWins);
    }
  };
  visit(0, Math.max(0, Math.min(n, wins)));
}

function builderSampleSeed(n, wins, salt = 0) {
  let x = (n * 374761393 + wins * 668265263 + salt * 69069) >>> 0;
  x ^= x >>> 13;
  x = Math.imul(x, 1274126177) >>> 0;
  x ^= x >>> 16;
  return x >>> 0;
}

function mulberry32(seed) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeBuilderSampleSequence(n, wins, mode = "random", seed = 1) {
  const safeWins = Math.max(0, Math.min(n, Math.round(wins)));
  const seq = Array(n).fill(false);
  if (mode === "front") {
    for (let i = 0; i < safeWins; i++) seq[i] = true;
    return seq;
  }
  if (mode === "back") {
    for (let i = n - safeWins; i < n; i++) if (i >= 0) seq[i] = true;
    return seq;
  }
  if (mode === "alternating") {
    if (safeWins === 0) return seq;
    const spacing = n / safeWins;
    for (let w = 0; w < safeWins; w++) {
      const idx = Math.min(n - 1, Math.floor(w * spacing + spacing / 2));
      seq[idx] = true;
    }
    let placed = seq.reduce((c, x) => c + (x ? 1 : 0), 0);
    for (let i = 0; placed < safeWins && i < n; i++) {
      if (!seq[i]) { seq[i] = true; placed += 1; }
    }
    return seq;
  }
  for (let i = 0; i < safeWins; i++) seq[i] = true;
  const rng = mulberry32(seed);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [seq[i], seq[j]] = [seq[j], seq[i]];
  }
  return seq;
}

function uniqueBuilderTradeCounts(minTrades, maxTrades, maxCount = BUILDER_SAFE_LIMITS.maxSampledTradeCounts) {
  const values = new Set([minTrades, maxTrades]);
  const span = Math.max(0, maxTrades - minTrades);
  const count = Math.min(maxCount, span + 1);
  if (count > 1) {
    for (let i = 0; i < count; i++) values.add(Math.round(minTrades + (span * i) / (count - 1)));
  }
  return [...values].sort((a, b) => a - b);
}

function addTopBuilderCandidate(candidates, candidate, maxKeep = BUILDER_SAFE_LIMITS.maxStoredCandidatesPerGroup) {
  candidates.push(candidate);
  if (candidates.length > maxKeep * 2) {
    candidates.sort(compareBuilderCandidates);
    candidates.length = maxKeep;
  }
}


function roundBuilderInput(value, decimals = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  const factor = 10 ** decimals;
  return Math.round((n + Number.EPSILON) * factor) / factor;
}

function buildBuilderScaledConfig(engineCfg, scale, useFno) {
  const s = Math.max(1e-9, Number(scale) || 0);
  const sourceRiskPct = Math.max(1e-9, Number(engineCfg.riskPct) || 0);
  const sourceBaseLots = Math.max(1e-9, Number(engineCfg.baseLots) || 0);
  const next = {
    ...engineCfg,
    // Builder calibrates against the same 2-decimal precision that the
    // normal Base Risk % / Base Lots inputs display. This is intentional:
    // when a user copies the Builder's Auto Base Risk/Lots into Single Run,
    // both screens then run the exact same numerical configuration rather
    // than Builder secretly using extra hidden decimals.
    riskPct: Math.max(0.01, roundBuilderInput(sourceRiskPct * s, 2)),
    baseLots: Math.max(0.01, roundBuilderInput(sourceBaseLots * s, 2)),
  };

  // F&O has whole-unit sizing. Keep its quantity/lots rules, while base risk
  // is also quantized to the same 2-decimal percentage precision.
  if (useFno) {
    if (next.fnoSegment === "intraday") {
      next.fnoQuantity = Math.max(1, Math.round((Number(engineCfg.fnoQuantity) || 1) * s));
    } else {
      next.fnoLots = Math.max(1, Math.round((Number(engineCfg.fnoLots) || 1) * s));
    }
  }

  // Builder-only normalization for On Capital: its dynamic win/loss risk is
  // calculated from current capital rather than Base Risk, so scaling Base
  // Risk alone would not scale Trades 2+. The multiplier preserves the same
  // configured capital-percentage model while fitting the Builder budget.
  if (engineCfg.cascadeMode === "capital") {
    next._builderCapitalRiskMultiplier = s;
  } else {
    next._builderCapitalRiskMultiplier = 1;
  }

  return next;
}

function simulateBuilderPlan(engineCfg, sequence, riskPlan, useFno) {
  // Legacy explicit-plan path retained for compatibility. New Builder
  // candidates use a fully re-scaled strategy config so the actual cascade
  // engine remains the source of truth for risk, lots, fees and price moves.
  return useFno
    ? simulateFromSequenceFnO(engineCfg, sequence, riskPlan)
    : simulateFromSequence(engineCfg, sequence, riskPlan);
}

function builderPlanLossMetric(engineCfg, sequence, scaledCfg, useFno) {
  const initialCapital = Math.max(0, Number(engineCfg.initialCapital) || 0);
  const selected = useFno
    ? simulateFromSequenceFnO(scaledCfg, sequence)
    : simulateFromSequence(scaledCfg, sequence);

  const allLossSequence = sequence.map(() => false);
  const allLoss = useFno
    ? simulateFromSequenceFnO(scaledCfg, allLossSequence)
    : simulateFromSequence(scaledCfg, allLossSequence);

  const selectedComplete = selected.trades.length === sequence.length && !selected.stopped;
  const allLossComplete = allLoss.trades.length === sequence.length && !allLoss.stopped;

  // The Builder budget is a hard all-in downside limit. Selected-order
  // peak-to-trough DD is also kept inside that same budget so the chosen
  // combination cannot exceed the requested downside ceiling mid-run.
  const allLossValue = Math.max(0, initialCapital - allLoss.finalCapital);
  const selectedMaxDDValue = Math.max(0, Number(selected.maxDDValue) || 0);
  const worstValue = Math.max(allLossValue, selectedMaxDDValue);

  return {
    selected,
    allLoss,
    selectedComplete,
    allLossComplete,
    complete: selectedComplete && allLossComplete,
    allLossValue,
    selectedMaxDDValue,
    worstValue,
    worstPct: initialCapital > 0 ? (worstValue / initialCapital) * 100 : 0,
  };
}

function calibrateBuilderRiskPlan(engineCfg, sequence, totalRiskAmount, useFno) {
  const budget = Math.max(0, Number(totalRiskAmount) || 0);
  if (!sequence.length || budget <= 0) return null;

  const sourceRiskPct = Math.max(1e-9, Number(engineCfg.riskPct) || 0);
  const sourceBaseLots = Math.max(1e-9, Number(engineCfg.baseLots) || 0);

  // We solve a single scalar "risk scale" and apply it to BOTH Base Risk %
  // and Base Lots. This is important: gross P/L per lot stays unchanged, so
  // the Builder does not distort the instrument price movement just because
  // it calibrated the money-risk level.
  const hardBudget = budget * (1 - 1e-9);
  const epsilon = Math.max(1e-12, budget * 1e-12);
  const minScale = 1e-8;

  const metricAt = (scale) => {
    const safeScale = Math.max(minScale, Number(scale) || 0);
    const scaledCfg = buildBuilderScaledConfig(engineCfg, safeScale, useFno);
    const metric = builderPlanLossMetric(engineCfg, sequence, scaledCfg, useFno);
    const feasible = metric.complete && metric.worstValue <= hardBudget + epsilon;
    return { scale: safeScale, cfg: scaledCfg, metric, feasible };
  };

  // Try the user's original strategy size first. Builder is allowed to scale
  // UP as well as DOWN — the target is to use as much of the 5% downside budget
  // as possible, not to blindly shrink the original settings.
  const full = metricAt(1);
  if (full.feasible) {
    let lo = 1;
    let hi = 2;
    let upper = metricAt(hi);

    // Expand until the first infeasible scale. This makes the calibration
    // useful when the original strategy is far below the Builder budget.
    for (let i = 0; i < 18 && upper.feasible; i++) {
      lo = hi;
      hi *= 2;
      upper = metricAt(hi);
    }

    if (upper.feasible) {
      // Even a very large scaled strategy is still inside the requested cap.
      // Return the highest tested scale; this is an unusual edge case, but
      // never silently reverts to the source settings.
      return upper;
    }

    // Find the largest feasible scale in [lo, hi].
    let best = full;
    for (let i = 0; i < 28; i++) {
      const mid = (lo + hi) / 2;
      const tested = metricAt(mid);
      if (tested.feasible) {
        best = tested;
        lo = mid;
      } else {
        hi = mid;
      }
    }

    return best;
  }

  // Original settings exceed the Builder hard cap: scale DOWN until feasible.
  const zero = metricAt(minScale);
  if (!zero.feasible) return null;

  let lo = minScale;
  let hi = 1;
  let best = zero;

  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2;
    const tested = metricAt(mid);
    if (tested.feasible) {
      best = tested;
      lo = mid;
    } else {
      hi = mid;
    }
  }

  // Final post-condition: make sure the exact recalculated all-loss case and
  // selected-order Max DD are both inside the requested budget.
  if (!best.feasible || best.metric.worstValue > hardBudget + epsilon) return null;

  return best;
}


function getBuilderTargetRR(engineCfg) {
  const minRR = Math.max(0, Number(engineCfg.rrMin) || 0);
  const maxRR = Math.max(minRR, Number(engineCfg.rrMax) || 0);
  if (engineCfg.rrMode === "range") {
    // A single target distance cannot exactly represent a variable RR on every
    // WIN trade. Target mode therefore uses the midpoint of the configured RR
    // range as its deterministic reference RR.
    return Math.max(1e-9, (minRR + maxRR) / 2);
  }
  return Math.max(1e-9, Number(engineCfg.rr) || 0);
}

function buildBuilderTargetConfig(engineCfg, baseRiskAmount, riskPoints, useFno, targetRR = null) {
  const initialCapital = Math.max(0, Number(engineCfg.initialCapital) || 0);
  const safeRiskPoints = Math.max(1e-9, Number(riskPoints) || 0);
  const riskAmount = Math.max(0, Number(baseRiskAmount) || 0);
  const rr = Math.max(1e-9, Number(targetRR) || getBuilderTargetRR(engineCfg));
  const next = {
    ...engineCfg,
    // Target mode owns the target/RR relationship. In RR Range mode, use the
    // deterministic reference RR returned above so the requested point distance
    // remains mathematically well-defined.
    rrMode: "fixed",
    rr,
    riskPct: initialCapital > 0 ? (riskAmount / initialCapital) * 100 : 0,
  };

  const sourceBaseRiskAmount = initialCapital > 0
    ? initialCapital * (Math.max(0, Number(engineCfg.riskPct) || 0) / 100)
    : 0;
  next._builderCapitalRiskMultiplier = engineCfg.cascadeMode === "capital" && sourceBaseRiskAmount > 0
    ? riskAmount / sourceBaseRiskAmount
    : 1;

  if (useFno) {
    const segment = engineCfg.fnoSegment === "options" || engineCfg.fnoSegment === "futures"
      ? engineCfg.fnoSegment
      : "intraday";
    const isIntraday = segment === "intraday";
    const lotSize = isIntraday ? 1 : Math.max(1, Math.round(Number(engineCfg.fnoLotSize) || 1));
    const leverage = engineCfg.fnoLeverage && Number(engineCfg.fnoLeverage) > 0
      ? Number(engineCfg.fnoLeverage)
      : 1;
    const units = Math.max(1, Math.round(riskAmount / (safeRiskPoints * lotSize * leverage)));
    const exactRiskAmount = units * safeRiskPoints * lotSize * leverage;
    next.riskPct = initialCapital > 0 ? (exactRiskAmount / initialCapital) * 100 : 0;
    if (isIntraday) {
      next.fnoQuantity = units;
    } else {
      next.fnoLots = units;
    }
    next._builderTargetRiskPoints = safeRiskPoints;
    next._builderTargetPoints = safeRiskPoints * rr;
    next._builderTargetBaseRiskAmount = exactRiskAmount;
    return next;
  }

  const lots = Math.max(1e-9, riskAmount / safeRiskPoints);
  next.baseLots = lots;
  next._builderTargetRiskPoints = safeRiskPoints;
  next._builderTargetPoints = safeRiskPoints * rr;
  next._builderTargetBaseRiskAmount = riskAmount;
  return next;
}

function targetPointMetric(engineCfg, sequence, totalRiskAmount, useFno, targetRR, riskPoints, baseRiskAmount) {
  const scaledCfg = buildBuilderTargetConfig(
    engineCfg,
    baseRiskAmount,
    riskPoints,
    useFno,
    targetRR
  );
  const metric = builderPlanLossMetric(engineCfg, sequence, scaledCfg, useFno);
  const hardBudget = Math.max(0, Number(totalRiskAmount) || 0) * (1 - 1e-9);
  const feasible = metric.complete && metric.worstValue <= hardBudget;
  return { cfg: scaledCfg, metric, feasible };
}

function calibrateBuilderTargetPoints(engineCfg, sequence, totalRiskAmount, useFno, inputMode, inputValue) {
  const budget = Math.max(0, Number(totalRiskAmount) || 0);
  const rawValue = Math.max(0, Number(inputValue) || 0);
  if (!sequence.length || budget <= 0 || rawValue <= 0) return null;

  const targetRR = getBuilderTargetRR(engineCfg);
  if (!Number.isFinite(targetRR) || targetRR <= 0) return null;

  const riskPoints = inputMode === "targetPoints"
    ? rawValue / targetRR
    : rawValue;
  const targetPoints = riskPoints * targetRR;
  if (!Number.isFinite(riskPoints) || riskPoints <= 0 || !Number.isFinite(targetPoints) || targetPoints <= 0) return null;

  const hardBudget = budget * (1 - 1e-9);
  const epsilon = Math.max(1e-12, budget * 1e-12);

  if (useFno) {
    const segment = engineCfg.fnoSegment === "options" || engineCfg.fnoSegment === "futures"
      ? engineCfg.fnoSegment
      : "intraday";
    const isIntraday = segment === "intraday";
    const lotSize = isIntraday ? 1 : Math.max(1, Math.round(Number(engineCfg.fnoLotSize) || 1));
    const leverage = engineCfg.fnoLeverage && Number(engineCfg.fnoLeverage) > 0
      ? Number(engineCfg.fnoLeverage)
      : 1;
    const riskPerUnit = riskPoints * lotSize * leverage;
    if (!Number.isFinite(riskPerUnit) || riskPerUnit <= 0) return null;

    const maxUnitsByBudget = Math.floor(hardBudget / riskPerUnit);
    if (maxUnitsByBudget < 1) return null;

    const metricAtUnits = (units) => {
      const u = Math.max(1, Math.round(units));
      const baseRiskAmount = u * riskPerUnit;
      return targetPointMetric(engineCfg, sequence, budget, useFno, targetRR, riskPoints, baseRiskAmount);
    };

    let lo = 1;
    let hi = maxUnitsByBudget;
    let best = null;
    // Discrete search: find the largest whole lot/share count that remains
    // fully feasible. The risk amount is derived from the requested point
    // distance, so the resulting Base Risk % and Base Unit are internally exact.
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const tested = metricAtUnits(mid);
      if (tested.feasible) {
        best = { units: mid, ...tested };
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    if (!best || best.metric.worstValue > hardBudget + epsilon) return null;
    const exactBaseRiskAmount = best.units * riskPerUnit;
    const finalCfg = buildBuilderTargetConfig(engineCfg, exactBaseRiskAmount, riskPoints, useFno, targetRR);
    const finalMetric = builderPlanLossMetric(engineCfg, sequence, finalCfg, useFno);
    if (!finalMetric.complete || finalMetric.worstValue > hardBudget + epsilon) return null;
    return {
      cfg: finalCfg,
      metric: finalMetric,
      baseRiskAmount: exactBaseRiskAmount,
      riskPoints,
      targetPoints,
      targetRR,
      units: best.units,
      searchUnitsMax: maxUnitsByBudget,
    };
  }

  // Single Run permits fractional Base Lots. Solve the largest feasible base
  // risk amount under the Builder hard downside budget, with Base Lots derived
  // directly from the requested 1R point distance.
  const metricAtRisk = (baseRiskAmount) => targetPointMetric(
    engineCfg,
    sequence,
    budget,
    useFno,
    targetRR,
    riskPoints,
    baseRiskAmount
  );

  const minRisk = Math.max(1e-9, budget * 1e-9);
  const nearFull = metricAtRisk(budget);
  if (!nearFull.feasible) {
    let lo = minRisk;
    let hi = budget;
    let best = metricAtRisk(minRisk);
    if (!best.feasible) return null;
    for (let i = 0; i < 42; i++) {
      const mid = (lo + hi) / 2;
      const tested = metricAtRisk(mid);
      if (tested.feasible) {
        best = tested;
        lo = mid;
      } else {
        hi = mid;
      }
    }
    const baseRiskAmount = lo;
    const finalCfg = buildBuilderTargetConfig(engineCfg, baseRiskAmount, riskPoints, useFno, targetRR);
    const finalMetric = builderPlanLossMetric(engineCfg, sequence, finalCfg, useFno);
    if (!finalMetric.complete || finalMetric.worstValue > hardBudget + epsilon) return null;
    return {
      cfg: finalCfg,
      metric: finalMetric,
      baseRiskAmount,
      riskPoints,
      targetPoints,
      targetRR,
      units: null,
    };
  }

  // Full Builder budget itself is feasible; use it. This is the maximum
  // possible initial Base Risk Amount because target points are already fixed.
  const finalCfg = buildBuilderTargetConfig(engineCfg, budget, riskPoints, useFno, targetRR);
  const finalMetric = builderPlanLossMetric(engineCfg, sequence, finalCfg, useFno);
  if (!finalMetric.complete || finalMetric.worstValue > hardBudget + epsilon) return null;
  return {
    cfg: finalCfg,
    metric: finalMetric,
    baseRiskAmount: budget,
    riskPoints,
    targetPoints,
    targetRR,
    units: null,
  };
}

function evaluateBuilderTargetSequence(engineCfg, sequence, totalRiskAmount, useFno, targetWinRate = null, inputMode = "targetPoints", inputValue = 0) {
  const initialCapital = Math.max(0, Number(engineCfg.initialCapital) || 0);
  const n = sequence.length;
  const wins = sequence.filter(Boolean).length;
  const rrSeed = hashStringToUint32(
    `builder-target|${targetWinRate ?? "actual"}|${sequence.length}|${sequence.map((x) => (x ? "W" : "L")).join("")}`
  );
  const builderEngineCfg = {
    ...engineCfg,
    _rrSeed: rrSeed,
    _riskReferenceWinRate: targetWinRate == null ? engineCfg.winRate : targetWinRate,
  };
  const calibrated = calibrateBuilderTargetPoints(
    builderEngineCfg,
    sequence,
    totalRiskAmount,
    useFno,
    inputMode,
    inputValue
  );
  if (!calibrated) return null;

  const result = calibrated.metric.selected;
  const scaledCfg = calibrated.cfg;
  if (result.trades.length !== n || calibrated.metric.allLoss.trades.length !== n) return null;
  if (result.stopped || calibrated.metric.allLoss.stopped) return null;

  const totalAllocatedRisk = result.trades.reduce(
    (sum, trade) => sum + Math.max(0, Number(trade.risk) || 0),
    0
  );
  const worstCaseLossValue = calibrated.metric.worstValue;
  const hardBudget = Math.max(0, totalRiskAmount) * (1 - 1e-9);
  if (worstCaseLossValue > hardBudget) return null;

  const allWinSequence = sequence.map(() => true);
  const allWin = useFno
    ? simulateFromSequenceFnO(scaledCfg, allWinSequence)
    : simulateFromSequence(scaledCfg, allWinSequence);
  const allWinValue = allWin.finalCapital - initialCapital;

  const actualWinRate = n > 0 ? (wins / n) * 100 : 0;
  const sequenceText = sequence.map((x) => (x ? "W" : "L")).join("");
  const wr = targetWinRate == null ? actualWinRate : targetWinRate;

  // Target mode must preserve the requested point/RR geometry. Single Run is
  // exact; F&O is exact at the whole-unit contract level by deriving risk %
  // from integer units × point distance × lot size × leverage.
  return {
    key: `target-${wr}-${n}-${sequenceText}-${calibrated.riskPoints.toFixed(8)}`,
    tradeCount: n,
    wins,
    losses: n - wins,
    actualWinRate,
    sequence: sequenceText,
    sequenceArray: sequence,
    riskPlan: result.trades.map((trade) => Math.max(0, Number(trade.risk) || 0)),
    riskScale: null,
    autoBaseRiskPct: Number(scaledCfg.riskPct) || 0,
    autoBaseLots: useFno
      ? (scaledCfg.fnoSegment === "intraday"
          ? Number(scaledCfg.fnoQuantity) || 0
          : Number(scaledCfg.fnoLots) || 0)
      : Number(scaledCfg.baseLots) || 0,
    autoStrategyCfg: scaledCfg,
    targetMode: true,
    targetInputMode: inputMode,
    targetInputValue: Number(inputValue) || 0,
    riskPoints: calibrated.riskPoints,
    targetPoints: calibrated.targetPoints,
    targetRR: calibrated.targetRR,
    totalAllocatedRiskPct: initialCapital > 0 ? (totalAllocatedRisk / initialCapital) * 100 : 0,
    totalAllocatedRiskAmount: totalAllocatedRisk,
    worstCaseLossPct: initialCapital > 0 ? (worstCaseLossValue / initialCapital) * 100 : 0,
    worstCaseLossValue,
    allLossValue: calibrated.metric.allLossValue,
    allLossPct: initialCapital > 0 ? (calibrated.metric.allLossValue / initialCapital) * 100 : 0,
    allWinValue,
    selectedMaxDDValue: calibrated.metric.selectedMaxDDValue,
    result,
    finalCapital: result.finalCapital,
    netPL: result.netPL,
    returnPct: initialCapital > 0 ? (result.netPL / initialCapital) * 100 : 0,
    maxDD: result.maxDD,
    maxDDValue: result.maxDDValue,
  };
}


function evaluateBuilderSequence(engineCfg, sequence, totalRiskAmount, useFno, targetWinRate = null) {
  const initialCapital = Math.max(0, Number(engineCfg.initialCapital) || 0);
  const n = sequence.length;
  const wins = sequence.filter(Boolean).length;

  const rrSeed = hashStringToUint32(
    `builder-rr|${targetWinRate ?? "actual"}|${sequence.length}|${sequence.map((x) => (x ? "W" : "L")).join("")}`
  );
  const builderEngineCfg = {
    ...engineCfg,
    _rrSeed: rrSeed,
    _riskReferenceWinRate: targetWinRate == null ? engineCfg.winRate : targetWinRate,
  };

  const calibrated = calibrateBuilderRiskPlan(
    builderEngineCfg,
    sequence,
    totalRiskAmount,
    useFno
  );
  if (!calibrated) return null;

  const result = calibrated.metric.selected;
  const scaledCfg = calibrated.cfg;

  if (result.trades.length !== n || calibrated.metric.allLoss.trades.length !== n) return null;
  if (result.stopped || calibrated.metric.allLoss.stopped) return null;

  const totalAllocatedRisk = result.trades.reduce(
    (sum, trade) => sum + Math.max(0, Number(trade.risk) || 0),
    0
  );

  const worstCaseLossValue = calibrated.metric.worstValue;
  const hardBudget = Math.max(0, totalRiskAmount) * (1 - 1e-9);

  if (worstCaseLossValue > hardBudget) return null;

  const allWinSequence = sequence.map(() => true);
  const allWin = useFno
    ? simulateFromSequenceFnO(scaledCfg, allWinSequence)
    : simulateFromSequence(scaledCfg, allWinSequence);
  const allWinValue = allWin.finalCapital - initialCapital;

  const actualWinRate = n > 0 ? (wins / n) * 100 : 0;
  const sequenceText = sequence.map((x) => (x ? "W" : "L")).join("");
  const wr = targetWinRate == null ? actualWinRate : targetWinRate;

  return {
    key: `${wr}-${n}-${sequenceText}`,
    tradeCount: n,
    wins,
    losses: n - wins,
    actualWinRate,
    sequence: sequenceText,
    sequenceArray: sequence,
    // Risk plan is now the exact risk sequence generated by the active
    // cascade engine under the auto-scaled Builder configuration.
    riskPlan: result.trades.map((trade) => Math.max(0, Number(trade.risk) || 0)),
    riskScale: calibrated.scale,

    // Auto-calculated source settings. Both values use the same scale factor,
    // preserving the source risk-per-lot and therefore the source price move.
    // These displayed Auto values are the SAME numeric values used by the
    // candidate Trade Log. No hidden extra precision is allowed here; this
    // keeps Builder -> Single Run copy/paste numerically identical.
    autoBaseRiskPct: Number(scaledCfg.riskPct) || 0,
    autoBaseLots: Number(scaledCfg.baseLots) || 0,
    autoStrategyCfg: scaledCfg,

    totalAllocatedRiskPct: initialCapital > 0 ? (totalAllocatedRisk / initialCapital) * 100 : 0,
    totalAllocatedRiskAmount: totalAllocatedRisk,
    worstCaseLossPct: initialCapital > 0 ? (worstCaseLossValue / initialCapital) * 100 : 0,
    worstCaseLossValue,
    allLossValue: calibrated.metric.allLossValue,
    allLossPct: initialCapital > 0 ? (calibrated.metric.allLossValue / initialCapital) * 100 : 0,
    allWinValue,
    selectedMaxDDValue: calibrated.metric.selectedMaxDDValue,
    result,
    finalCapital: result.finalCapital,
    netPL: result.netPL,
    returnPct: initialCapital > 0 ? (result.netPL / initialCapital) * 100 : 0,
    maxDD: result.maxDD,
    maxDDValue: result.maxDDValue,
  };
}

function sourceRiskForBuilder(engineCfg, scale) {
  const s = Math.max(1e-9, Number(scale) || 0);
  return {
    riskPct: Math.max(1e-9, Number(engineCfg.riskPct) || 0) * s,
    baseLots: Math.max(1e-9, Number(engineCfg.baseLots) || 0) * s,
  };
}

function deriveBuilderState(builder, points) {
  const normalizedPoints = points.map((point) => {
    const allCombinations = [...(point.allCombinations || [])].sort(compareBuilderCandidates);
    const winningCombinations = allCombinations.filter((c) => c.returnPct > 0);
    const candidate = allCombinations[0] || null;
    return {
      ...point,
      candidate,
      alternatives: allCombinations.slice(1, 4),
      allCombinations,
      winningCombinations,
      winningCombinationCount: winningCombinations.length,
      status: candidate && candidate.returnPct > 0 ? "Profitable" : "Losing Range",
      reason: candidate && candidate.returnPct > 0
        ? "Best-return complete combination found inside the all-in Builder risk budget and active safety stops."
        : candidate
        ? "Complete combinations exist, but this win rate remains unprofitable inside the all-in Builder risk budget and active safety stops."
        : point.reason,
    };
  });

  const profitablePoints = normalizedPoints.filter((p) => p.candidate?.returnPct > 0);
  const losingPoints = normalizedPoints.filter((p) => !p.candidate || p.candidate.returnPct <= 0);
  const best = normalizedPoints
    .flatMap((p) => p.winningCombinations || [])
    .sort(compareBuilderCandidates)[0] || null;
  const bestPoint = best
    ? normalizedPoints.find((p) => p.winningCombinations?.some((c) => c.key === best.key))
    : null;

  return {
    ...builder,
    points: normalizedPoints,
    validCount: normalizedPoints.filter((p) => p.candidate).length,
    profitableCount: profitablePoints.length,
    losingCount: losingPoints.length,
    bestReturnPoint: bestPoint ? { targetWinRate: bestPoint.targetWinRate, candidate: best } : null,
  };
}

function applyBuilderCandidateEdit(builder, targetWinRate, oldKey, editedCandidate) {
  const nextPoints = builder.points.map((point) => {
    if (point.targetWinRate !== targetWinRate) return point;

    const source = point.allCombinations || [];
    const filtered = source.filter((c) => c.key !== oldKey && c.key !== editedCandidate.key);
    filtered.push(editedCandidate);
    filtered.sort(compareBuilderCandidates);

    return {
      ...point,
      allCombinations: filtered,
      selectedCandidateOverride: editedCandidate,
    };
  });

  return deriveBuilderState(builder, nextPoints);
}

function normalizeBuilderSequenceFilter(rawCfg = {}) {
  return {
    enabled: rawCfg.builderSequenceFilterEnabled === true,
    leadingLosses: Math.min(1000, Math.max(1, Math.round(Number(rawCfg.builderSequenceFilterLeadingLosses) || 1))),
    match: rawCfg.builderSequenceFilterMatch === "exact" ? "exact" : "atLeast",
    finalPnl: ["green", "red", "any"].includes(rawCfg.builderSequenceFilterFinalPnl)
      ? rawCfg.builderSequenceFilterFinalPnl
      : "green",
    greenByTrade: Math.min(1000, Math.max(0, Math.round(Number(rawCfg.builderSequenceFilterGreenByTrade) || 0))),
  };
}

function getBuilderSequenceLeadingLosses(sequence) {
  let count = 0;
  for (const isWin of sequence || []) {
    if (isWin) break;
    count += 1;
  }
  return count;
}

function builderSequenceFilterMatches(candidate, filter) {
  if (!filter?.enabled) return true;
  if (!candidate) return false;

  const sequence = Array.isArray(candidate.sequenceArray)
    ? candidate.sequenceArray
    : String(candidate.sequence || "").split("").map((ch) => ch === "W");

  const leadingLosses = getBuilderSequenceLeadingLosses(sequence);
  if (filter.match === "exact" ? leadingLosses !== filter.leadingLosses : leadingLosses < filter.leadingLosses) {
    return false;
  }

  const finalPnl = Number(candidate.netPL) || 0;
  if (filter.finalPnl === "green" && !(finalPnl > 1e-10)) return false;
  if (filter.finalPnl === "red" && !(finalPnl < -1e-10)) return false;

  // Optional timing condition: by Trade N, realized cumulative Net P/L must
  // have crossed above zero at least once. This is evaluated from the actual
  // candidate trade log, so fees/spread/slippage are naturally included.
  if (filter.greenByTrade > 0) {
    const trades = candidate.result?.trades || [];
    const limit = Math.min(filter.greenByTrade, trades.length);
    let cumulative = 0;
    let greenReached = false;
    for (let i = 0; i < limit; i += 1) {
      cumulative += Number(trades[i]?.netPL) || 0;
      if (cumulative > 1e-10) {
        greenReached = true;
        break;
      }
    }
    if (!greenReached) return false;
  }

  return true;
}

function builderSequenceFilterLabel(filter) {
  if (!filter?.enabled) return "Off";
  const lead = `${filter.match === "exact" ? "exactly" : "at least"} ${filter.leadingLosses} opening losses`;
  const final = filter.finalPnl === "green" ? "green close" : filter.finalPnl === "red" ? "red close" : "any close";
  const timing = filter.greenByTrade > 0 ? ` · green by T${filter.greenByTrade}` : "";
  return `${lead} · ${final}${timing}`;
}

function runStrategyBuilder(rawCfg) {
  const initialCapital = Math.max(0, Number(rawCfg.builderInitialCapital) || 0);
  const totalRiskPct = Math.max(0, Number(rawCfg.builderTotalRiskPct) || 0);
  const requestedMinTrades = Math.round(Number(rawCfg.builderMinTrades) || 5);
  const requestedMaxTrades = Math.round(Number(rawCfg.builderMaxTrades) || 10);
  const minTrades = Math.max(1, requestedMinTrades);
  const maxTrades = Math.max(minTrades, requestedMaxTrades);
  const totalRiskAmount = initialCapital * (totalRiskPct / 100);
  const baseMode = rawCfg.builderBaseMode === "fno" ? "fno" : "single";
  const useFno = baseMode === "fno";
  const builderMode = rawCfg.builderMode === "target" ? "target" : "normal";
  const targetInputMode = rawCfg.builderTargetInputMode === "riskPoints" ? "riskPoints" : "targetPoints";
  const targetInputValue = Math.max(0, Number(rawCfg.builderTargetValue) || 0);
  const sequenceFilter = normalizeBuilderSequenceFilter(rawCfg);
  const engineCfg = cleanConfig({ ...rawCfg, initialCapital });

  const userSequenceLimit = Math.min(
    BUILDER_SAFE_LIMITS.maxSequenceEvaluations,
    Math.max(1, Math.round(Number(rawCfg.builderSequenceLimit) || BUILDER_SAFE_LIMITS.maxSequenceEvaluations))
  );

  // We only need the exact total up to the hard cap. If the true total is
  // larger, the estimator returns cap+1 and the UI represents it as "100,000+".
  const estimatedSequenceCount = estimateTotalBinarySequences(
    minTrades,
    maxTrades,
    BUILDER_SAFE_LIMITS.maxSequenceEvaluations
  );
  const totalSequenceCountKnown =
    estimatedSequenceCount <= BUILDER_SAFE_LIMITS.maxSequenceEvaluations
      ? estimatedSequenceCount
      : null;
  const effectiveSequenceLimit = Math.min(
    userSequenceLimit,
    totalSequenceCountKnown ?? BUILDER_SAFE_LIMITS.maxSequenceEvaluations
  );

  // Three modes:
  // 1) exact: all mathematically possible sequences fit within the user's limit.
  // 2) limited: the total is known and the user intentionally requested fewer
  //    sequences than the full set; enumerate deterministically until the limit.
  // 3) sampled: the true total exceeds the 100k hard cap; use representative
  //    deterministic samples so large ranges remain usable.
  const exactMode = totalSequenceCountKnown !== null && effectiveSequenceLimit >= totalSequenceCountKnown;
  const limitedMode = totalSequenceCountKnown !== null && effectiveSequenceLimit < totalSequenceCountKnown;
  const sampledMode = totalSequenceCountKnown === null;

  const sourceTradeCounts = sampledMode
    ? uniqueBuilderTradeCounts(minTrades, maxTrades)
    : Array.from({ length: maxTrades - minTrades + 1 }, (_, i) => minTrades + i);

  const rateGroups = new Map();
  for (const n of sourceTradeCounts) {
    for (let wins = 0; wins <= n; wins++) {
      const divisor = gcd(wins, n);
      const reducedNum = wins / divisor;
      const reducedDen = n / divisor;
      const rateKey = `${reducedNum}/${reducedDen}`;
      const targetWinRate = (wins / n) * 100;
      if (!rateGroups.has(rateKey)) rateGroups.set(rateKey, { key: rateKey, targetWinRate, ratios: [] });
      rateGroups.get(rateKey).ratios.push({ n, wins });
    }
  }

  let groups = [...rateGroups.values()].sort((a, b) => a.targetWinRate - b.targetWinRate);
  if (sampledMode && groups.length > BUILDER_SAFE_LIMITS.maxGroupsSampled) {
    const sampled = [];
    const seen = new Set();
    for (let i = 0; i < BUILDER_SAFE_LIMITS.maxGroupsSampled; i++) {
      const idx = Math.round((i * (groups.length - 1)) / Math.max(1, BUILDER_SAFE_LIMITS.maxGroupsSampled - 1));
      if (!seen.has(idx)) { seen.add(idx); sampled.push(groups[idx]); }
    }
    groups = sampled;
  }

  const points = [];
  let sequenceEvaluations = 0;

  const evaluateCandidate = (group, sequence) => {
    if (sequenceEvaluations >= effectiveSequenceLimit) return false;
    const candidate = builderMode === "target"
      ? evaluateBuilderTargetSequence(
          engineCfg,
          sequence,
          totalRiskAmount,
          useFno,
          group.targetWinRate,
          targetInputMode,
          targetInputValue
        )
      : evaluateBuilderSequence(
          engineCfg,
          sequence,
          totalRiskAmount,
          useFno,
          group.targetWinRate
        );
    sequenceEvaluations += 1;
    if (!candidate) return true;
    if (!builderSequenceFilterMatches(candidate, sequenceFilter)) return null;
    return candidate;
  };

  for (const group of groups) {
    if (sequenceEvaluations >= effectiveSequenceLimit) break;

    const candidates = [];
    const winningCandidates = [];
    let winningCountExact = 0;
    let filterMatchedCount = 0;
    let groupEvaluations = 0;

    if (!sampledMode) {
      // Exact/limited mode: deterministically enumerate every sequence (or stop
      // at the user's custom sequence limit). This makes 5–10 = 2,016 and a
      // user override of 2,000 = exactly 2,000 evaluated sequences.
      for (const { n, wins } of group.ratios) {
        if (sequenceEvaluations >= effectiveSequenceLimit) break;
        const stopRef = { stop: false };
        forEachWinLossSequence(n, wins, (sequence) => {
          if (sequenceEvaluations >= effectiveSequenceLimit) {
            stopRef.stop = true;
            return;
          }
          const candidate = evaluateCandidate(group, sequence);
          groupEvaluations += 1;
          if (!candidate || typeof candidate === "boolean") return;
          filterMatchedCount += 1;
          addTopBuilderCandidate(candidates, candidate);
          if (candidate.returnPct > 0) {
            winningCountExact += 1;
            addTopBuilderCandidate(winningCandidates, candidate);
          }
        }, stopRef);
      }
    } else {
      // Large ranges: distribute the user's sequence budget across the
      // available win-rate/ratio groups rather than the old fixed "6 per group".
      // This allows the new hard cap of 100,000 to be used meaningfully.
      const remainingGroups = Math.max(1, groups.length);
      const remainingBudget = Math.max(0, effectiveSequenceLimit - sequenceEvaluations);
      const groupBudget = Math.max(1, Math.ceil(remainingBudget / remainingGroups));
      const ratioCount = Math.max(1, group.ratios.length);
      const perRatio = Math.max(1, Math.ceil(groupBudget / ratioCount));

      for (const { n, wins } of group.ratios) {
        if (sequenceEvaluations >= effectiveSequenceLimit) break;

        const seen = new Set();
        const sampleModes = ["front", "back", "alternating"];
        for (let i = 0; i < perRatio && sequenceEvaluations < effectiveSequenceLimit; i++) {
          const mode = i < sampleModes.length ? sampleModes[i] : "random";
          const seed = builderSampleSeed(n, wins, i + group.key.length * 17 + sequenceEvaluations * 31);
          const seq = makeBuilderSampleSequence(n, wins, mode, seed);
          const key = seq.map((x) => (x ? "W" : "L")).join("");
          if (seen.has(key)) continue;
          seen.add(key);

          const candidate = evaluateCandidate(group, seq);
          groupEvaluations += 1;
          if (!candidate || typeof candidate === "boolean") continue;
          filterMatchedCount += 1;
          addTopBuilderCandidate(candidates, candidate);
        }
      }
    }

    candidates.sort(compareBuilderCandidates);
    candidates.length = Math.min(candidates.length, BUILDER_SAFE_LIMITS.maxStoredCandidatesPerGroup);
    winningCandidates.sort(compareBuilderCandidates);
    winningCandidates.length = Math.min(winningCandidates.length, BUILDER_SAFE_LIMITS.maxStoredCandidatesPerGroup);

    if (!candidates.length) {
      points.push({
        targetWinRate: group.targetWinRate,
        fractionKey: group.key,
        status: sequenceFilter.enabled ? "No Match" : "Losing Range",
        reason: sequenceFilter.enabled
          ? `No evaluated sequence matched the active filter (${builderSequenceFilterLabel(sequenceFilter)}).`
          : exactMode
          ? `No complete combination fits the ${totalRiskPct}% all-in Builder risk budget and active safety stops.`
          : limitedMode
          ? `Sequence limit reached before a complete profitable combination was found inside the ${totalRiskPct}% all-in Builder risk budget and active safety stops.`
          : `No sampled combination fit the ${totalRiskPct}% all-in Builder risk budget and active safety stops.`,
        candidate: null,
        alternatives: [],
        allCombinations: [],
        winningCombinations: [],
        winningCombinationCount: !sampledMode ? winningCountExact : 0,
        filterMatchedCount,
        filterEnabled: sequenceFilter.enabled,
        evaluatedSequenceCount: groupEvaluations,
        sampled: sampledMode,
      });
      continue;
    }

    const winningCombinations = exactMode || limitedMode
      ? winningCandidates
      : candidates.filter((c) => c.returnPct > 0);
    const candidate = candidates[0];
    points.push({
      targetWinRate: group.targetWinRate,
      fractionKey: group.key,
      status: candidate.returnPct > 0 ? "Profitable" : (sequenceFilter.enabled ? "Matched · Losing" : "Losing Range"),
      reason: candidate.returnPct > 0
        ? (exactMode
          ? "Best-return complete combination found inside the all-in Builder risk budget and active safety stops."
          : limitedMode
          ? "Best-return combination found inside the user-selected sequence evaluation limit and all-in Builder risk budget."
          : "Best sampled combination found inside the all-in Builder risk budget and active safety stops.")
        : (exactMode
          ? "Complete combinations exist, but this win rate remains unprofitable inside the all-in Builder risk budget and active safety stops."
          : limitedMode
          ? "Evaluated combinations did not produce a profitable result inside the user-selected sequence evaluation limit."
          : "Sampled complete combinations did not produce a profitable result inside the all-in Builder risk budget and active safety stops."),
      candidate,
      alternatives: candidates.slice(1, 4),
      allCombinations: candidates,
      winningCombinations,
      winningCombinationCount: !sampledMode ? winningCountExact : winningCombinations.length,
      filterMatchedCount,
      filterEnabled: sequenceFilter.enabled,
      evaluatedSequenceCount: groupEvaluations,
      sampled: sampledMode,
    });
  }

  const builder = {
    initialCapital,
    totalRiskPct,
    totalRiskAmount,
    minTrades,
    maxTrades,
    exactWinRateCount: groups.length,
    baseMode,
    rr: engineCfg.rr,
    rrMode: engineCfg.rrMode,
    rrMin: engineCfg.rrMin,
    rrMax: engineCfg.rrMax,
    builderMode,
    targetInputMode,
    targetInputValue,
    targetRR: builderMode === "target" ? getBuilderTargetRR(engineCfg) : null,
    targetPoints: builderMode === "target" && targetInputMode === "targetPoints" ? targetInputValue : null,
    riskPoints: builderMode === "target" && targetInputMode === "riskPoints" ? targetInputValue : null,
    strategyCfg: engineCfg,
    points,
    validCount: points.filter((p) => p.candidate).length,
    profitableCount: points.filter((p) => p.candidate?.returnPct > 0).length,
    losingCount: points.filter((p) => !p.candidate || p.candidate.returnPct <= 0).length,
    bestReturnPoint: null,
    searchMode: exactMode ? "exact" : limitedMode ? "limited" : "sampled",
    estimatedSequenceCount,
    totalSequenceCount: totalSequenceCountKnown,
    sequenceLimit: effectiveSequenceLimit,
    evaluatedSequenceCount: sequenceEvaluations,
    skippedEvaluationCount: totalSequenceCountKnown !== null
      ? Math.max(0, totalSequenceCountKnown - sequenceEvaluations)
      : Math.max(0, effectiveSequenceLimit - sequenceEvaluations),
    sampledTradeCounts: sourceTradeCounts,
    maxSequenceEvaluations: BUILDER_SAFE_LIMITS.maxSequenceEvaluations,
    maxStoredCandidatesPerGroup: BUILDER_SAFE_LIMITS.maxStoredCandidatesPerGroup,
    sequenceFilter,
    sequenceFilterLabel: builderSequenceFilterLabel(sequenceFilter),
  };

  return deriveBuilderState(builder, points);
}

function BuilderConfig({ cfg, strategyCfg, baseMode, autoCandidate, onChange, onBuild, hasResult, builderBuilding }) {
  const isFno = baseMode === "fno";
  const isTargetMode = cfg.builderMode === "target";
  const targetInputMode = cfg.builderTargetInputMode === "riskPoints" ? "riskPoints" : "targetPoints";
  const targetValue = Math.max(0, Number(cfg.builderTargetValue) || 0);
  const targetRR = getBuilderTargetRR(strategyCfg);
  const canBuild = !isTargetMode || targetValue > 0;
  return (
    <div>
      <div className="mb-5">
        <GroupTitle icon={Layers} color="blue">Builder Inputs</GroupTitle>
        <Field label="Initial Capital" hint="used by the combination log">
          <NumInput value={cfg.builderInitialCapital} onChange={onChange("builderInitialCapital")} step="1" color="blue" />
        </Field>
        <Field label="Total Risk Budget %">
          <NumInput value={cfg.builderTotalRiskPct} onChange={onChange("builderTotalRiskPct")} step="0.1" color="blue" />
        </Field>
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Min Trades">
            <NumInput value={cfg.builderMinTrades} onChange={onChange("builderMinTrades")} step="1" min="1" color="indigo" />
          </Field>
          <Field label="Max Trades">
            <NumInput value={cfg.builderMaxTrades} onChange={onChange("builderMaxTrades")} step="1" min="1" color="indigo" />
          </Field>
        </div>

        <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/30 p-2.5">
          <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1.5">Builder Mode</div>
          <div className="flex bg-zinc-800/40 border border-zinc-700/50 rounded-lg p-1">
            {["normal", "target"].map((bm) => (
              <button
                key={bm}
                type="button"
                onClick={() => onChange("builderMode")({ target: { value: bm } })}
                className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  cfg.builderMode === bm ? "bg-zinc-100 text-zinc-900" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {bm === "normal" ? "Normal" : "Target"}
              </button>
            ))}
          </div>

          {isTargetMode && (
            <div className="mt-2.5 space-y-2.5">
              <div className="flex bg-zinc-800/40 border border-zinc-700/50 rounded-lg p-1">
                {["targetPoints", "riskPoints"].map((tm) => (
                  <button
                    key={tm}
                    type="button"
                    onClick={() => onChange("builderTargetInputMode")({ target: { value: tm } })}
                    className={`flex-1 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
                      targetInputMode === tm ? "bg-violet-500/20 text-violet-300" : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {tm === "targetPoints" ? "Target Points" : "Risk Points"}
                  </button>
                ))}
              </div>
              <Field label={targetInputMode === "targetPoints" ? "Target Points" : "Risk Points"}>
                <NumInput
                  value={cfg.builderTargetValue}
                  onChange={onChange("builderTargetValue")}
                  step="0.01"
                  min="0"
                  color="violet"
                />
              </Field>
              <div className="grid grid-cols-3 gap-2 text-[9px] font-mono">
                <div className="rounded-md bg-zinc-950/60 border border-zinc-800 px-2 py-1.5">
                  <div className="text-zinc-600">RR</div>
                  <div className="text-violet-300 mt-0.5">{targetRR.toFixed(2)}</div>
                </div>
                <div className="rounded-md bg-zinc-950/60 border border-zinc-800 px-2 py-1.5">
                  <div className="text-zinc-600">Risk Pts</div>
                  <div className="text-zinc-300 mt-0.5">{targetValue > 0 ? (targetInputMode === "targetPoints" ? (targetValue / targetRR).toFixed(2) : targetValue.toFixed(2)) : "—"}</div>
                </div>
                <div className="rounded-md bg-zinc-950/60 border border-zinc-800 px-2 py-1.5">
                  <div className="text-zinc-600">Target Pts</div>
                  <div className="text-zinc-300 mt-0.5">{targetValue > 0 ? (targetInputMode === "targetPoints" ? targetValue.toFixed(2) : (targetValue * targetRR).toFixed(2)) : "—"}</div>
                </div>
              </div>
              {strategyCfg.rrMode === "range" && (
                <div className="text-[9px] text-amber-300/80">RR Range uses the midpoint as the Target reference RR.</div>
              )}
            </div>
          )}
        </div>

        {(() => {
          const minT = Math.max(1, Math.round(Number(cfg.builderMinTrades) || 1));
          const maxT = Math.max(minT, Math.round(Number(cfg.builderMaxTrades) || minT));
          const totalCap = 100000;
          const total = estimateTotalBinarySequences(minT, maxT, totalCap);
          const totalKnown = total <= totalCap;
          const totalLabel = totalKnown ? total.toLocaleString("en-IN") : `${totalCap.toLocaleString("en-IN")}+`;
          const storedLimit = Math.min(totalCap, Math.max(1, Math.round(Number(cfg.builderSequenceLimit) || totalCap)));
          const effectiveLimit = totalKnown ? Math.min(total, storedLimit) : storedLimit;
          return (
            <div className="mt-2.5 rounded-lg border border-blue-500/20 bg-blue-500/[0.04] px-3 py-2.5">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="text-[10px] uppercase tracking-wide text-zinc-500">Evaluations</div>
                <div className="text-[10px] font-mono text-zinc-400">Total possible: {totalLabel}</div>
              </div>
              <NumInput
                value={effectiveLimit}
                onChange={(e) => {
                  const v = Math.min(totalCap, Math.max(1, Math.round(Number(e.target.value) || 1)));
                  onChange("builderSequenceLimit")({ target: { value: v } });
                }}
                step="1"
                min="1"
                max={totalCap}
                color="blue"
              />
              <div className="mt-1 text-[9px] leading-relaxed text-zinc-600">
                Default: up to {totalCap.toLocaleString("en-IN")} sequences. Lower manually.
              </div>
            </div>
          );
        })()}
      </div>

      <div className="mb-5 min-w-0">
        <GroupTitle icon={SlidersHorizontal} color="violet">Sequence Filter</GroupTitle>
        <div className="rounded-lg border border-violet-500/20 bg-violet-500/[0.035] p-3 min-w-0 overflow-hidden">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => onChange("builderSequenceFilterOpen")({ target: { value: !cfg.builderSequenceFilterOpen } })}
              className="min-w-0 flex-1 flex items-center justify-between gap-2 rounded-lg border border-zinc-700/70 bg-zinc-950/60 px-3 py-2 text-[11px] font-mono text-zinc-200 hover:border-violet-500/40 transition-colors"
            >
              <span className="truncate">Filter sequences</span>
              <span className={`truncate ${cfg.builderSequenceFilterEnabled ? "text-violet-300" : "text-zinc-500"}`}>
                {cfg.builderSequenceFilterEnabled ? builderSequenceFilterLabel(normalizeBuilderSequenceFilter(cfg)) : "Off"}
              </span>
              <ChevronDown size={13} className={`shrink-0 text-zinc-500 transition-transform ${cfg.builderSequenceFilterOpen ? "rotate-180" : ""}`} />
            </button>
            <button
              type="button"
              onClick={() => onChange("builderSequenceFilterEnabled")({ target: { value: !cfg.builderSequenceFilterEnabled } })}
              className={`shrink-0 rounded-md border px-2.5 py-1.5 text-[9px] font-mono ${cfg.builderSequenceFilterEnabled ? "bg-violet-500/15 border-violet-500/35 text-violet-200" : "bg-zinc-900/60 border-zinc-800 text-zinc-500"}`}
            >
              {cfg.builderSequenceFilterEnabled ? "ON" : "OFF"}
            </button>
          </div>

          {cfg.builderSequenceFilterOpen && (
            <div className="mt-2.5">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Opening Losses" hint="leading streak">
                  <NumInput value={cfg.builderSequenceFilterLeadingLosses} onChange={onChange("builderSequenceFilterLeadingLosses")} step="1" min="1" max="1000" color="violet" />
                </Field>
                <Field label="Match">
                  <div className="min-h-[38px] flex rounded-md border border-zinc-800 bg-zinc-950/50 p-0.5">
                    {["atLeast", "exact"].map((m) => (
                      <button key={m} type="button" onClick={() => onChange("builderSequenceFilterMatch")({ target: { value: m } })} className={`flex-1 rounded text-[9px] font-mono ${cfg.builderSequenceFilterMatch === m ? "bg-violet-500/20 text-violet-200" : "text-zinc-500 hover:text-zinc-300"}`}>
                        {m === "atLeast" ? "At least" : "Exactly"}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Field label="Final P/L">
                  <div className="min-h-[38px] flex rounded-md border border-zinc-800 bg-zinc-950/50 p-0.5">
                    {["green", "any", "red"].map((m) => (
                      <button key={m} type="button" onClick={() => onChange("builderSequenceFilterFinalPnl")({ target: { value: m } })} className={`flex-1 rounded text-[9px] font-mono capitalize ${cfg.builderSequenceFilterFinalPnl === m ? "bg-violet-500/20 text-violet-200" : "text-zinc-500 hover:text-zinc-300"}`}>
                        {m}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Green by Trade" hint="0 = no deadline">
                  <NumInput value={cfg.builderSequenceFilterGreenByTrade} onChange={onChange("builderSequenceFilterGreenByTrade")} step="1" min="0" max="1000" color="violet" />
                </Field>
              </div>

              <div className="mt-1 rounded-md border border-violet-500/15 bg-zinc-950/40 px-2.5 py-2 text-[9px] leading-relaxed text-zinc-400 break-words">
                Use this to find sequences such as: <span className="text-zinc-200">first 3 losses → finish green</span>. Optional Green by Trade requires cumulative realized Net P/L to cross above zero by that trade.
              </div>
              {cfg.builderSequenceFilterGreenByTrade > 0 && cfg.builderSequenceFilterGreenByTrade <= cfg.builderSequenceFilterLeadingLosses && (
                <div className="mt-1.5 text-[9px] font-mono text-[#FF692A]">No sequence can turn green by T{cfg.builderSequenceFilterGreenByTrade} after {cfg.builderSequenceFilterLeadingLosses} opening losses. Increase Green by Trade.</div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mb-5">
        <GroupTitle icon={DollarSign} color="blue">Capital &amp; Auto Base Risk</GroupTitle>
        <div className="mb-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] px-3 py-2 text-[10px] leading-relaxed text-zinc-500">
          Builder auto-calculates risk and size from the hard Total Risk Budget. The source Base Risk % / Base Lots are ignored for Builder execution.
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Initial Capital">
            <div className="text-xs font-mono text-zinc-200 py-2.5">{fmtMoney(strategyCfg.initialCapital)}</div>
          </Field>
          <Field label={isFno ? "Auto Base Unit" : "Auto Base Lots"}>
            <div className="text-xs font-mono text-zinc-200 py-2.5">
              {isFno
                ? (autoCandidate
                    ? (strategyCfg.fnoSegment === "intraday"
                        ? Number(autoCandidate.autoStrategyCfg?.fnoQuantity || strategyCfg.fnoQuantity).toLocaleString("en-IN")
                        : `${Number(autoCandidate.autoStrategyCfg?.fnoLots || strategyCfg.fnoLots)} lot`)
                    : "—")
                : (autoCandidate
                    ? Number(autoCandidate.autoBaseLots || 0).toFixed(2)
                    : "—")}
            </div>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Auto Base Risk %">
            <div className="text-xs font-mono text-emerald-300 py-2.5">{autoCandidate ? fmtPct(autoCandidate.autoBaseRiskPct) : "—"}</div>
          </Field>
          <Field label="Reward:Risk">
            <div className="text-xs font-mono text-zinc-200 py-2.5">
              {strategyCfg.rrMode === "range"
                ? `${Number(strategyCfg.rrMin || 0).toFixed(2)}–${Number(strategyCfg.rrMax || 0).toFixed(2)}R range`
                : Number(strategyCfg.rr || 0).toFixed(2)}
            </div>
          </Field>
        </div>
      </div>

      <div className="mb-5 min-w-0">
        <GroupTitle icon={BarChart2} color="violet">Risk Allocation</GroupTitle>
        <div className="rounded-lg border border-violet-500/20 bg-violet-500/[0.04] p-3 min-w-0 overflow-hidden">
          <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-2">Mode</div>
          <button
            type="button"
            onClick={() => onChange("builderRiskMenuOpen")({ target: { value: !cfg.builderRiskMenuOpen } })}
            className="w-full min-w-0 flex items-center justify-between gap-2 rounded-lg border border-zinc-700/70 bg-zinc-950/60 px-3 py-2 text-[11px] font-mono text-zinc-200 hover:border-violet-500/40 transition-colors"
          >
            <span className="min-w-0 truncate">{riskAllocationModeLabel(cfg.cascadeMode)}</span>
            <ChevronDown size={14} className={`shrink-0 text-zinc-500 transition-transform ${cfg.builderRiskMenuOpen ? "rotate-180" : ""}`} />
          </button>

          {cfg.builderRiskMenuOpen && (
            <div className="grid grid-cols-2 gap-1.5 mt-2 min-w-0">
              {RISK_ALLOCATION_MODES.map((cm) => (
                <button
                  key={cm}
                  type="button"
                  onClick={() => {
                    onChange("cascadeMode")({ target: { value: cm } });
                    onChange("builderRiskMenuOpen")({ target: { value: false } });
                  }}
                  className={`min-w-0 text-left rounded-md border px-2 py-2 text-[10px] font-mono leading-tight transition-colors ${
                    cfg.cascadeMode === cm
                      ? "bg-violet-500/15 border-violet-500/35 text-violet-200"
                      : "bg-zinc-950/40 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                  }`}
                >
                  {riskAllocationModeLabel(cm)}
                </button>
              ))}
            </div>
          )}

          <div className="mt-2 min-w-0 rounded-md border border-violet-500/15 bg-zinc-950/40 px-2.5 py-2 text-[9px] sm:text-[10px] leading-relaxed text-zinc-300 break-words whitespace-normal overflow-hidden">
            {cfg.cascadeMode === "profitCumulative"
              ? "WIN → cumulative net profit × allocation. LOSS → previous executed risk × adjustment; the adjustment flips after the configured loss count."
              : cfg.cascadeMode === "profit"
              ? "Existing On Profit logic: winning risk is derived from usable previous profit."
              : "Existing On Capital logic: risk follows current capital."}
          </div>

          <div className="mt-2.5 grid grid-cols-2 gap-x-2 gap-y-0 min-w-0">
            {cfg.cascadeMode === "profitCumulative" ? (
              <>
                <Field label="Profit Allocation %"><NumInput value={cfg.profitCumulativeAllocationPct} onChange={onChange("profitCumulativeAllocationPct")} step="1" min="0" max="100" color="violet" /></Field>
                <Field label="Loss Adjustment %"><NumInput value={cfg.profitCumulativeLossAdjustPct} onChange={onChange("profitCumulativeLossAdjustPct")} step="1" min="-95" max="100" color="violet" /></Field>
                <Field label="Flip After Losses"><NumInput value={cfg.profitCumulativeFlipAfterLosses} onChange={onChange("profitCumulativeFlipAfterLosses")} step="1" min="1" color="violet" /></Field>
              </>
            ) : (cfg.cascadeMode === "profit" || cfg.cascadeMode === "capital") ? (
              <>
                <Field label="Win Risk %"><NumInput value={cfg.winRiskPct} onChange={onChange("winRiskPct")} step="0.1" color="violet" /></Field>
                <Field label="Loss Risk %"><NumInput value={cfg.lossRiskPct} onChange={onChange("lossRiskPct")} step="0.1" color="violet" /></Field>
                <Field label="Incr / Decr %"><NumInput value={cfg.lossRiskAdjustPct} onChange={onChange("lossRiskAdjustPct")} step="0.1" color="violet" /></Field>
              </>
            ) : null}
          </div>

          <div className="mt-1 rounded-md border border-zinc-800 bg-zinc-950/30 px-2.5 py-1.5 text-[9px] font-mono leading-relaxed text-zinc-500 break-words">
            The selected model and its settings run inside every evaluated W/L sequence. Builder keeps the configured allocation shape, auto-scales absolute size to the Total Risk Budget, and preserves existing caps/reset as final guards.
          </div>
        </div>
      </div>

      <div className="mb-5">
        <GroupTitle icon={Percent} color="teal">Costs</GroupTitle>
        <div className="text-[10px] text-zinc-500 mb-2 font-mono">
          {isFno ? `${strategyCfg.fnoBroker} · ${strategyCfg.fnoSegment}` : (strategyCfg.feeMode === "turnover" ? "Fee on Turnover" : "Fee / Lot")}
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Entry Fee"><div className="text-xs font-mono text-zinc-200 py-2.5">{isFno ? "Broker config" : (strategyCfg.feeMode === "turnover" ? fmtPct3(strategyCfg.entryFeeTurnoverPct) : fmtMoney(strategyCfg.feeBaseEntry))}</div></Field>
          <Field label="Exit Fee"><div className="text-xs font-mono text-zinc-200 py-2.5">{isFno ? "Broker config" : (strategyCfg.feeMode === "turnover" ? fmtPct3(strategyCfg.exitFeeTurnoverPct) : fmtMoney(strategyCfg.feeBaseExit))}</div></Field>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Entry Spread"><div className="text-xs font-mono text-zinc-200 py-2.5">{fmtMoney(isFno ? strategyCfg.fnoEntrySpread : strategyCfg.entrySpread)}</div></Field>
          <Field label="Exit Spread"><div className="text-xs font-mono text-zinc-200 py-2.5">{fmtMoney(isFno ? strategyCfg.fnoExitSpread : strategyCfg.exitSpread)}</div></Field>
        </div>
        <Field label={`Slippage ${strategyCfg.slipMode === "ticks" ? "Tick wise" : "% wise"}`}>
          <div className="text-xs font-mono text-zinc-200 py-2.5">{strategyCfg.slipMode === "ticks" ? `${strategyCfg.slipTicks} tick · ${fmtMoney(strategyCfg.tickValue)}` : fmtPct(strategyCfg.slipPct)}</div>
        </Field>
      </div>

      <div className="mb-5">
        <GroupTitle icon={Shield} color="amber">Safety Stops</GroupTitle>
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Per-Trade Cap %"><div className="text-xs font-mono text-zinc-200 py-2.5">{fmtPct(strategyCfg.perTradeCapPct)}</div></Field>
          <Field label="Max Risk Cap %"><div className="text-xs font-mono text-zinc-200 py-2.5">{fmtPct(strategyCfg.overallCapPct)}</div></Field>
        </div>
      </div>

      <button
        onClick={onBuild}
        disabled={builderBuilding || !canBuild}
        className="w-full bg-zinc-100 text-zinc-950 rounded-lg py-2.5 text-xs font-semibold hover:bg-white disabled:opacity-60 disabled:cursor-wait transition-colors"
      >
        {builderBuilding ? "Building…" : !canBuild ? "Enter Target / Risk Points" : hasResult ? "Rebuild Strategy" : "Build Strategy"}
      </button>

      <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
        <div className="text-[10px] uppercase tracking-wider text-amber-300/80 font-semibold">Active Configuration</div>
        <div className="text-[10px] leading-relaxed text-zinc-500 mt-1.5">
          {isTargetMode
            ? `Target: ${targetInputMode === "targetPoints" ? "Target" : "Risk"} Points → Auto Risk/Lots at RR.`
            : `Uses current ${isFno ? "F&amp;O" : "Single Run"} settings; auto-sizes to the risk budget.`}
          {strategyCfg.rrMode === "range" ? " RR Range uses midpoint RR." : ""}
        </div>
      </div>
    </div>
  );
}


function TradeAllocationScale({ trade, fno = false, riskScale, onRiskScaleChange }) {
  const originalRisk = Math.max(0, Number(trade?.risk) || 0);
  const originalLots = Math.max(0, Number(trade?.lots) || 0);
  const originalQty = fno ? Math.max(0, Number(trade?.quantity) || 0) : originalLots;
  const originalFee = Math.max(0, Number(trade?.fee) || 0);

  const clampPct = (v) => Math.min(100, Math.max(0, Number(v) || 0));
  const scale = clampPct(riskScale);
  const nowPct = scale / 100;

  const firstRisk = originalRisk * nowPct;
  const remainingRisk = originalRisk - firstRisk;
  const firstLots = originalLots * nowPct;
  const remainingLots = originalLots - firstLots;
  const firstQty = originalQty * nowPct;
  const remainingQty = originalQty - firstQty;
  const firstFee = originalFee * nowPct;
  const remainingFee = originalFee - firstFee;

  const valueText = (v) => Number(v).toFixed(2);
  const unitLabel = fno ? "qty" : "lots";

  const statCard = "min-w-0 rounded-lg bg-[#27272A] border border-[#57534D]/55";

  return (
    <div className="mt-1.5 rounded-lg border border-[#57534D]/55 bg-[#27272A] px-2.5 py-2 overflow-hidden">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-100">Trade Allocation</div>
        <div className="font-mono text-[10px] whitespace-nowrap">
          <span className="text-[#05DF72]">{scale.toFixed(0)}%</span>
          <span className="mx-1 text-[#57534D]">/</span>
          <span className="text-[#FF692A]">{(100 - scale).toFixed(0)}%</span>
          <span className="ml-1 text-zinc-400">now / reserve</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[minmax(190px,0.72fr)_minmax(0,1.28fr)] gap-2 items-stretch">
        <div className="rounded-lg border border-[#57534D]/55 bg-[#27272A] px-2.5 py-2 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[9px] font-medium uppercase tracking-[0.1em] text-zinc-400">Risk Scale</div>
            <div className="font-mono text-[11px] font-semibold text-[#42D3F2]">{scale.toFixed(0)}%</div>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={scale}
            onChange={(e) => onRiskScaleChange(clampPct(e.target.value))}
            className="mt-1.5 w-full h-1 cursor-ew-resize accent-[#42D3F2]"
            aria-label="Risk and position size scale"
          />
          <div className="mt-0.5 flex justify-between text-[8px] font-mono text-zinc-500">
            <span>0%</span><span>50%</span><span>100%</span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1.5 min-w-0">
          <div className={`${statCard} px-2 py-1.5`}>
            <div className="text-[8px] font-medium uppercase tracking-[0.08em] text-zinc-400">Risk Now</div>
            <div className="mt-0.5 font-mono text-[11px] font-semibold text-[#05DF72] truncate">{fmtMoney(firstRisk)}</div>
            <div className="text-[8px] font-mono text-zinc-500 truncate">{fmtMoney(remainingRisk)} reserve</div>
          </div>
          <div className={`${statCard} px-2 py-1.5`}>
            <div className="text-[8px] font-medium uppercase tracking-[0.08em] text-zinc-400">Size Now</div>
            <div className="mt-0.5 font-mono text-[11px] font-semibold text-[#42D3F2] truncate">{valueText(firstLots)} {unitLabel}</div>
            <div className="text-[8px] font-mono text-zinc-500 truncate">{valueText(remainingLots)} reserve</div>
          </div>
          <div className={`${statCard} px-2 py-1.5`}>
            <div className="text-[8px] font-medium uppercase tracking-[0.08em] text-zinc-400">Qty Now</div>
            <div className="mt-0.5 font-mono text-[11px] font-semibold text-[#7CCF35] truncate">{valueText(firstQty)}</div>
            <div className="text-[8px] font-mono text-zinc-500 truncate">{valueText(remainingQty)} reserve</div>
          </div>
          <div className={`${statCard} px-2 py-1.5`}>
            <div className="text-[8px] font-medium uppercase tracking-[0.08em] text-zinc-400">Fee Now</div>
            <div className="mt-0.5 font-mono text-[11px] font-semibold text-[#FF692A] truncate">{fmtMoney(firstFee)}</div>
            <div className="text-[8px] font-mono text-zinc-500 truncate">{fmtMoney(remainingFee)} reserve</div>
          </div>
        </div>
      </div>

      <div className="mt-1 text-[8px] font-mono text-zinc-400 truncate">
        Original: <span className="text-zinc-200">{fmtMoney(originalRisk)}</span> risk
        <span className="mx-1.5 text-[#57534D]">·</span>
        <span className="text-zinc-200">{valueText(originalQty)} {unitLabel}</span>
        <span className="mx-1.5 text-[#57534D]">·</span>
        <span className="text-zinc-200">{fmtMoney(originalFee)}</span> fee
      </div>
    </div>
  );
}

function TradeResultBadge({ win }) {
  return (
    <span
      className={`inline-flex min-w-[42px] h-5 items-center justify-center rounded-[4px] border px-1.5 text-[9px] font-semibold leading-none select-none transition ${
        win
          ? "bg-[#7CCF35]/12 border-[#7CCF35]/35 text-[#7CCF35]"
          : "bg-[#FF2056]/10 border-[#FF2056]/35 text-[#FF2056]"
      }`}
    >
      {win ? "WIN" : "LOSS"}
    </span>
  );
}

function CombinationBadge({ sequence, compact = false, draggable = false, onMove = null }) {
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  if (!sequence) return <span className="text-zinc-600">—</span>;

  const handleDragStart = (idx) => (e) => {
    if (!draggable) return;
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(idx));
  };
  const handleDragOver = (idx) => (e) => {
    if (!draggable) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (idx !== dragOverIdx) setDragOverIdx(idx);
  };
  const handleDrop = (idx) => (e) => {
    if (!draggable) return;
    e.preventDefault();
    const from = dragIdx ?? Number(e.dataTransfer.getData("text/plain"));
    if (Number.isInteger(from) && from >= 0 && from !== idx && onMove) {
      onMove(from, idx);
    }
    setDragIdx(null);
    setDragOverIdx(null);
  };
  const handleDragEnd = () => {
    setDragIdx(null);
    setDragOverIdx(null);
  };

  return (
    <span className={`inline-flex w-max shrink-0 items-center gap-0.5 whitespace-nowrap ${compact ? "" : "p-1 rounded-md bg-zinc-950/70 border border-white/[0.06]"} ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
      title={draggable ? "Drag W/L chips to reorder the combination" : undefined}
    >
      {sequence.split("").map((ch, i) => (
        <span
          key={`${ch}-${i}`}
          draggable={draggable}
          onDragStart={handleDragStart(i)}
          onDragOver={handleDragOver(i)}
          onDrop={handleDrop(i)}
          onDragEnd={handleDragEnd}
          className={`inline-flex items-center justify-center rounded-[4px] border font-semibold select-none transition ${
            compact ? "w-4 h-4 text-[9px]" : "w-5 h-5 text-[9px]"
          } ${
            ch === "W"
              ? "bg-[#7CCF35]/12 border-[#7CCF35]/35 text-[#7CCF35]"
              : "bg-[#FF2056]/10 border-[#FF2056]/35 text-[#FF2056]"
          } ${
            dragIdx === i ? "opacity-40" : ""
          } ${
            dragOverIdx === i && dragIdx !== i ? "ring-1 ring-violet-400/50 scale-105" : ""
          }`}
        >
          {ch}
        </span>
      ))}
    </span>
  );
}

function BuilderScenarioTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const item = payload.find((entry) => entry?.payload)?.payload;
  if (!item) return null;

  const returnPct = Number(item.returnPct) || 0;
  const tradeCount = Number(item.tradeCount) || 0;
  const allocatedRiskPct = Number(item.totalAllocatedRiskPct) || 0;
  const allLossValue = Number(item.allLossValue) || 0;
  const allWinValue = Number(item.allWinValue) || 0;
  const maxDD = Number(item.maxDD) || 0;

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 shadow-xl shadow-black/50 font-mono">
      <div className="text-[10px] text-zinc-500 mb-1.5">Scenario {label}</div>
      <div className="text-xs text-zinc-200 mb-1.5">
        <CombinationBadge sequence={item.sequence || ""} compact />
      </div>
      <div className={`text-[11px] ${returnPct >= 0 ? "text-emerald-300" : "text-red-300"}`}>
        Net Return: {returnPct >= 0 ? "+" : ""}{returnPct.toFixed(2)}
      </div>
      <div className="text-[10px] text-zinc-500 mt-1">
        Trades {tradeCount} · Risk {allocatedRiskPct.toFixed(2)} · All-Win {fmtMoney(allWinValue)} · All-Loss {fmtMoney(-Math.abs(allLossValue))} · Max DD {maxDD.toFixed(2)}
      </div>
    </div>
  );
}

function BuilderResults({ builder, selectedKey, onSelectCandidate, onReorderCombination }) {
  const [selectedWinRate, setSelectedWinRate] = useState(0);
  const [matrixOpen, setMatrixOpen] = useState(true);
  const [winningScenariosOpen, setWinningScenariosOpen] = useState(true);

  useEffect(() => {
    if (!builder) return;
    const selectedPoint = builder.points.find((p) =>
      p.candidate?.key === selectedKey ||
      p.selectedCandidateOverride?.key === selectedKey ||
      p.winningCombinations?.some((c) => c.key === selectedKey)
    ) || null;
    setSelectedWinRate(selectedPoint?.targetWinRate ?? builder.bestReturnPoint?.targetWinRate ?? builder.points[0]?.targetWinRate ?? 0);
  }, [builder, selectedKey]);

  if (!builder) {
    return (
      <div className={`${CARD} py-20 text-center`}>
        <div className="text-zinc-200 text-base font-semibold">Strategy Builder</div>
        <div className="text-zinc-500 text-xs mt-2">Set the risk budget and trade limits, then build the strategy combinations.</div>
      </div>
    );
  }

  const best = builder.bestReturnPoint?.candidate || null;
  const activeWinRatePoint = builder.points.find((p) => p.targetWinRate === selectedWinRate) || builder.points[0];
  const winningScenarios = activeWinRatePoint?.winningCombinations || [];
  const selectedRecoveryCandidate = winningScenarios.find((c) => c.key === selectedKey) || activeWinRatePoint?.candidate || best;
  const chartData = winningScenarios.map((c, i) => ({
    scenario: i + 1,
    returnPct: Number(c.returnPct) || 0,
    sequence: c.sequence || "",
    tradeCount: Number(c.tradeCount) || 0,
    totalAllocatedRiskPct: Number(c.totalAllocatedRiskPct) || 0,
    allWinValue: Number(c.allWinValue) || 0,
    allLossValue: Number(c.allLossValue) || 0,
    allLossPct: Number(c.allLossPct ?? c.worstCaseLossPct) || 0,
    maxDD: Number(c.maxDD) || 0,
    candidate: c,
  }));
  const losingRates = builder.points.filter((p) => p.status === "Losing Range").map((p) => p.targetWinRate);
  const losingRateRangeLabels = formatLosingRateRanges(builder.points);

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-lg sm:text-xl font-semibold tracking-tight">Builder</div>
          <div className="text-[11px] text-zinc-500 mt-1">
            {builder.baseMode === "fno" ? "Day / F&amp;O" : "Single Run"} configuration · {fmtMoney(builder.totalRiskAmount)} total risk budget · {builder.minTrades}–{builder.maxTrades} trades
          </div>
          <div className="text-[10px] text-zinc-600 mt-1">
            <span className={`mr-2 inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] ${builder.builderMode === "target" ? "bg-violet-500/10 border-violet-500/20 text-violet-300" : "bg-zinc-800 border-zinc-700 text-zinc-400"}`}>
              {builder.builderMode === "target" ? "Target" : "Normal"}
            </span>
            {builder.builderMode === "target" && builder.targetInputValue > 0
              ? `${builder.targetInputMode === "targetPoints" ? "Target" : "Risk"} ${Number(builder.targetInputValue).toFixed(2)} pts · RR ${Number(builder.targetRR || 0).toFixed(2)}`
              : null}
            {builder.searchMode === "exact"
              ? `Exact sequence search · ${builder.evaluatedSequenceCount.toLocaleString("en-IN")} sequences evaluated`
              : builder.searchMode === "limited"
              ? `Limited sequence search · ${builder.evaluatedSequenceCount.toLocaleString("en-IN")} of ${builder.totalSequenceCount?.toLocaleString("en-IN") || "—"} sequences evaluated`
              : `Large range safety mode · sampled representative sequences · ${builder.evaluatedSequenceCount.toLocaleString("en-IN")} evaluations`}
          </div>
          {builder.sequenceFilter?.enabled && (
            <div className="mt-1 text-[10px] text-violet-300/80 font-mono break-words">Sequence filter · {builder.sequenceFilterLabel}</div>
          )}
        </div>
        <div className="text-right font-mono text-[10px] text-zinc-500">
          {builder.rrMode === "range"
            ? `RR ${Number(builder.rrMin || 0).toFixed(2)}–${Number(builder.rrMax || 0).toFixed(2)}`
            : `RR ${Number(builder.rr || 0).toFixed(2)}`} · {builder.exactWinRateCount} WR points · {
              builder.searchMode === "exact"
                ? "Exact search"
                : builder.searchMode === "limited"
                ? "User-limited search"
                : "Fast sampled search"
            }
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <StatCell label="Valid Win-Rate Points" value={builder.validCount} icon={Layers} sub={`${builder.profitableCount} profitable`} />
        <StatCell label="Best Projected Return" value={best ? `${best.returnPct >= 0 ? "+" : ""}${best.returnPct.toFixed(2)}` : "—"} tone={best ? "pos" : "neg"} icon={TrendingUp} sub={best ? `${best.actualWinRate.toFixed(0)}% WR · ${best.tradeCount} trades` : "No profitable combination"} />
        <StatCell label="Best Combination DD" value={best ? `-${best.maxDD.toFixed(2)}` : "—"} tone="neg" icon={TrendingDown} sub={best ? `${fmtMoney(best.maxDDValue)}` : "No profitable combination"} />
        <StatCell
          label="Losing Rate Points"
          value={losingRates.length}
          tone="neg"
          icon={Shield}
          valueColor="#FF8904"
          subColor="#FF8904"
          sub={
            losingRates.length
              ? `Range: ${losingRateRangeLabels.join(" · ")} · no profitable combination`
              : "Every tested point has a profit"
          }
        />
      </div>

      <div className={`${CARD} overflow-hidden`}>
        <div className="px-4 py-2.5 border-b border-zinc-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setMatrixOpen((v) => !v)}
            className="flex-1 min-w-0 text-left hover:text-zinc-100 transition-colors"
            aria-expanded={matrixOpen}
          >
            <div className="text-[13px] font-semibold text-zinc-200">Win-Rate Strategy Matrix</div>
            {matrixOpen && (
              <div className="text-[10px] text-zinc-600 mt-1">Click a Win Rate to inspect its profitable scenarios. Drag the W/L chips in a Combination to reorder it and recalculate.</div>
            )}
          </button>
          <CollapsibleSectionToggle open={matrixOpen} onClick={() => setMatrixOpen((v) => !v)} label="Win-Rate Strategy Matrix" />
        </div>
        {matrixOpen && (
        <div className="overflow-x-auto">
          <table className={`w-full text-[11px] font-mono ${builder.builderMode === "target" ? "min-w-[1450px]" : "min-w-[1120px]"}`}>
            <thead className="bg-zinc-950/60 text-zinc-500">
              <tr className="border-b border-zinc-800">
                <th className="text-left px-3 py-2 font-medium">Win Rate</th>
                <th className="text-right px-3 py-2 font-medium">Trades</th>
                <th className="text-left px-3 py-2 font-medium">Combination</th>
                <th className="text-right px-3 py-2 font-medium">Allocated Risk</th>
                {builder.builderMode === "target" && (
                  <>
                    <th className="text-right px-3 py-2 font-medium">Auto Risk %</th>
                    <th className="text-right px-3 py-2 font-medium">Auto Lots</th>
                    <th className="text-right px-3 py-2 font-medium">Risk Pts</th>
                    <th className="text-right px-3 py-2 font-medium">Target Pts</th>
                  </>
                )}
                <th className="text-right px-3 py-2 font-medium">Net Return</th>
                <th className="text-right px-3 py-2 font-medium">Final Capital</th>
                <th className="text-right px-3 py-2 font-medium">Max DD</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {builder.points.map((point) => {
                const c = point.selectedCandidateOverride || point.candidate;
                const selected = !!c && c.key === selectedKey;
                return (
                  <tr
                    key={point.targetWinRate}
                    onClick={() => c && onSelectCandidate(c)}
                    className={`border-b border-zinc-800/60 transition-colors ${c ? "cursor-pointer hover:bg-zinc-800/30" : ""} ${selected ? "bg-zinc-500/10" : ""}`}
                  >
                    <td
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedWinRate(point.targetWinRate);
                      }}
                      title={`${point.winningCombinationCount || 0} winning combination scenario${point.winningCombinationCount === 1 ? "" : "s"}`}
                      className={`px-3 py-2 text-[#FFDF20] border-l-2 ${selected || point.targetWinRate === selectedWinRate ? "border-zinc-200 bg-zinc-800/30" : "border-transparent"} cursor-pointer hover:bg-zinc-800/40 transition-colors`}
                    >
                      <span className="inline-flex items-center gap-2">
                        <span>{formatBuilderWinRate(point.targetWinRate)}</span>
                        {point.winningCombinationCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[9px] text-emerald-300">{point.winningCombinationCount}</span>
                        )}
                        {builder.sequenceFilter?.enabled && (Number(point.filterMatchedCount) || 0) > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-violet-500/10 border border-violet-500/20 text-[9px] text-violet-300">{Number(point.filterMatchedCount).toLocaleString("en-IN")}</span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">{c ? c.tradeCount : "—"}</td>
                    <td className="px-3 py-2 align-middle">
                      {c ? (
                        <span onClick={(e) => e.stopPropagation()} className="flex min-w-0 items-center overflow-x-auto overflow-y-hidden">
                          <CombinationBadge
                            sequence={c.sequence}
                            draggable
                            onMove={(from, to) => onReorderCombination?.(c, from, to)}
                          />
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-violet-300">{c ? `${c.totalAllocatedRiskPct.toFixed(2)}%` : "—"}</td>
                    {builder.builderMode === "target" && (
                      <>
                        <td className="px-3 py-2 text-right text-emerald-300">{c ? `${Number(c.autoBaseRiskPct || 0).toFixed(2)}%` : "—"}</td>
                        <td className="px-3 py-2 text-right text-[#FEF9C2]">{c ? Number(c.autoBaseLots || 0).toFixed(2) : "—"}</td>
                        <td className="px-3 py-2 text-right text-zinc-300">{c ? Number(c.riskPoints || 0).toFixed(2) : "—"}</td>
                        <td className="px-3 py-2 text-right text-violet-300">{c ? Number(c.targetPoints || 0).toFixed(2) : "—"}</td>
                      </>
                    )}
                    <td className={`px-3 py-2 text-right font-semibold ${c && c.returnPct > 0 ? "text-emerald-400" : "text-red-400"}`}>{c ? `${c.returnPct >= 0 ? "+" : ""}${c.returnPct.toFixed(2)}` : "—"}</td>
                    <td className="px-3 py-2 text-right text-zinc-200">{c ? fmtMoney(c.finalCapital) : "—"}</td>
                    <td className="px-3 py-2 text-right text-red-400">{c ? c.maxDD.toFixed(2) : "—"}</td>
                    <td className="px-3 py-2">
                      <span style={{ color: c && c.returnPct > 0 ? "#05DF72" : "#F54927" }}>{point.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}
      </div>

      <div className={`${CARD} overflow-hidden`}>
        <div className="px-4 py-2.5 border-b border-zinc-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setWinningScenariosOpen((v) => !v)}
            className="flex-1 min-w-0 text-left hover:text-zinc-100 transition-colors"
            aria-expanded={winningScenariosOpen}
          >
            <div className="text-[13px] font-semibold text-zinc-200">Winning Combination Scenarios</div>
            {winningScenariosOpen && (
              <div className="text-[10px] text-zinc-600 mt-1">
                {formatBuilderWinRate(activeWinRatePoint?.targetWinRate ?? 0)} Win Rate · {winningScenarios.length} {builder.searchMode === "sampled" ? "sampled" : "stored"} profitable scenario{winningScenarios.length === 1 ? "" : "s"}{builder.sequenceFilter?.enabled ? ` · ${Number(activeWinRatePoint?.filterMatchedCount || 0).toLocaleString("en-IN")} filter match${Number(activeWinRatePoint?.filterMatchedCount || 0) === 1 ? "" : "es"}` : ""} · Click any bar to open that exact Trade Log.
              </div>
            )}
          </button>
          <span className="flex items-center gap-2">
            <span className="text-right font-mono text-[10px] text-emerald-300">{winningScenarios.length} scenarios</span>
            <CollapsibleSectionToggle open={winningScenariosOpen} onClick={() => setWinningScenariosOpen((v) => !v)} label="Winning Combination Scenarios" />
          </span>
        </div>
        {winningScenariosOpen && (
        <>
        {chartData.length ? (
          <div className="h-64 sm:h-72 px-2 pt-5 pb-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 6 }} barCategoryGap="18%">
                <CartesianGrid stroke="#CAD5E2" strokeOpacity={0.08} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="scenario" stroke="#737373" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis stroke="#737373" fontSize={10} tickLine={false} axisLine={false} width={54} tickFormatter={(v) => Number(v).toFixed(1)} />
                <ReferenceLine y={0} stroke="#52525b" strokeDasharray="4 4" />
                <Tooltip content={<BuilderScenarioTooltip />} cursor={{ fill: "rgba(202,213,226,0.05)" }} />
                <Bar dataKey="returnPct" name="Net Return" isAnimationActive={false} maxBarSize={28}>
                  {chartData.map((d, i) => (
                    <Cell
                      key={`${d.scenario}-${d.sequence}`}
                      fill="#05DF72"
                      fillOpacity={d.candidate.key === selectedKey ? 1 : 0.7}
                      stroke={d.candidate.key === selectedKey ? "#DDD6FF" : "none"}
                      strokeWidth={d.candidate.key === selectedKey ? 1.4 : 0}
                      radius={[4, 4, 0, 0]}
                      style={{ cursor: "pointer" }}
                      onClick={() => onSelectCandidate(d.candidate)}
                    />
                  ))}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="py-12 text-center text-zinc-500 text-xs">No profitable combination scenarios at {formatBuilderWinRate(activeWinRatePoint?.targetWinRate ?? 0)} Win Rate.</div>
        )}
        </>
        )}
      </div>

      {selectedRecoveryCandidate?.result?.trades?.length ? (
        <RecoveryTimeAnalysis
          title="Scenario Drawdown Recovery"
          trades={selectedRecoveryCandidate.result.trades}
          initialCapital={builder.initialCapital}
          compact
        />
      ) : null}

      {best && (
        <div className={`${CARD} overflow-hidden`}>
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between gap-3">
            <div>
              <div className="text-[13px] font-semibold text-zinc-200">Highest-Return Combination Found</div>
              <div className="text-[10px] text-zinc-600 mt-1">This combination uses the active strategy settings for risk model, RR, costs and safety stops.</div>
            </div>
            <div className="font-mono text-sm text-emerald-400">+{best.returnPct.toFixed(2)}</div>
          </div>
          <div className={`grid grid-cols-2 ${builder.builderMode === "target" ? "sm:grid-cols-[0.72fr_0.72fr_0.72fr_0.72fr_1.55fr_0.78fr_0.78fr]" : "sm:grid-cols-[0.82fr_0.82fr_1.8fr_0.88fr_0.88fr]"} gap-px bg-zinc-800`}>
            <div className="bg-zinc-900 px-3 py-3 min-w-0"><div className="text-[10px] text-zinc-500">Win Rate</div><div className="font-mono text-sm mt-1 text-[#FFDF20]">{formatBuilderWinRate(best.actualWinRate)}</div></div>
            <div className="bg-zinc-900 px-3 py-3 min-w-0"><div className="text-[10px] text-zinc-500">Trade Count</div><div className="font-mono text-sm mt-1 text-zinc-200">{best.tradeCount}</div></div>
            {builder.builderMode === "target" && (
              <>
                <div className="bg-zinc-900 px-3 py-3 min-w-0"><div className="text-[10px] text-zinc-500">Auto Risk %</div><div className="font-mono text-sm mt-1 text-emerald-300">{Number(best.autoBaseRiskPct || 0).toFixed(2)}%</div></div>
                <div className="bg-zinc-900 px-3 py-3 min-w-0"><div className="text-[10px] text-zinc-500">Auto Lots</div><div className="font-mono text-sm mt-1 text-[#FEF9C2]">{Number(best.autoBaseLots || 0).toFixed(2)}</div></div>
              </>
            )}
            <div className="bg-zinc-900 px-3 py-3 min-w-0">
              <div className="text-[10px] text-zinc-500">Combination</div>
              <div className="mt-1 flex min-w-0 items-center overflow-x-auto overflow-y-hidden">
                <CombinationBadge
                  sequence={best.sequence}
                  compact
                  draggable
                  onMove={(from, to) => onReorderCombination?.(best, from, to)}
                />
              </div>
            </div>
            <div className="bg-zinc-900 px-3 py-3 min-w-0"><div className="text-[10px] text-zinc-500">Total Risk</div><div className="font-mono text-sm mt-1 text-violet-300">{best.totalAllocatedRiskPct.toFixed(2)}%</div></div>
            <div className="bg-zinc-900 px-3 py-3 min-w-0"><div className="text-[10px] text-zinc-500">Max DD</div><div className="font-mono text-sm mt-1 text-red-300">{best.maxDD.toFixed(2)}</div></div>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-[10px] leading-relaxed text-zinc-500">
        <span className="text-zinc-300 font-semibold">Interpretation:</span> <span className="text-red-400">Losing Range</span> means no complete profitable combination survived the active strategy settings at that tested win rate. “—” means no exact win/trade-count combination exists or every exact combination was stopped by the configured safety rules.
      </div>
    </>
  );
}


function BuilderTradeLog({ result, strategyCfg, baseMode, activeRunLabel, onReorder }) {
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  if (!result || !result.trades?.length) return null;

  const handleDragStart = (idx) => (e) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (idx) => (e) => {
    e.preventDefault();
    if (idx !== dragOverIdx) setDragOverIdx(idx);
  };
  const handleDrop = (idx) => (e) => {
    e.preventDefault();
    if (onReorder) onReorder(dragIdx, idx);
    setDragIdx(null);
    setDragOverIdx(null);
  };
  const handleDragEnd = () => {
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const TRADE_LOG_VISIBLE_ROWS = 100;
  const TRADE_LOG_ROW_PX = 34;
  const maxHeight = result.trades.length > TRADE_LOG_VISIBLE_ROWS
    ? TRADE_LOG_VISIBLE_ROWS * TRADE_LOG_ROW_PX
    : null;
  const isFno = baseMode === "fno";
  const initialCapital = strategyCfg?.initialCapital ?? 0;
  const showPriceCol = !isFno && strategyCfg?.feeMode === "turnover";

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <MiniStat label="Final Capital" value={fmtMoney(result.finalCapital)} />
        <MiniStat
          label="Net P/L"
          value={fmtMoney(result.netPL)}
          sub={fmtPct(initialCapital ? (result.netPL / initialCapital) * 100 : 0)}
          tone={result.netPL >= 0 ? "pos" : "neg"}
        />
        <MiniStat label="Max Drawdown" value={fmtPct(result.maxDD)} sub={`-${fmtMoney(result.maxDDValue)}`} valueColor="#E7180B" subColor="#E7180B" />
      </div>

      <div className={`grid grid-cols-2 ${showPriceCol ? "sm:grid-cols-5" : "sm:grid-cols-4"} gap-3`}>
        <MiniStat label="Win Rate" value={fmtPct(result.winRateActual)} sub={`${result.winsCount}W / ${result.lossesCount}L`} valueColor="#FDC745" />
        <MiniStat label="Profit Factor" value={isFinite(result.profitFactor) ? result.profitFactor.toFixed(2) : "∞"} valueColor="#53EAFD" />
        <MiniStat label="Total Lots" value={result.totalLots.toFixed(2)} sub={`Avg: ${result.avgLots.toFixed(2)}/trade`} valueColor="#FEF9C2" />
        <MiniStat label="Expectancy" value={`${result.expectancy >= 0 ? "+" : ""}${fmtMoney(result.expectancy)}`} sub="per trade" valueColor={result.expectancy >= 0 ? "#31C950" : "#FF2056"} />
        {showPriceCol && (
          <MiniStat label="Instrument Price" value={fmtMoney(result.finalPrice)} sub={`from ${fmtMoney(strategyCfg.currentPrice)}`} valueColor="#A2F4FD" />
        )}
      </div>

      <TradeAnalyticsSection trades={result.trades} initialCapital={initialCapital} collapsible defaultOpen={true} />

      <div className={`${CARD} overflow-hidden`}>
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-zinc-800">
          <span className="flex items-center gap-2 text-[13px] font-semibold text-zinc-200">
            <Layers size={14} className="text-zinc-300" />
            Combination Trade Log
            {activeRunLabel && (
              <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px] font-mono font-normal">{activeRunLabel}</span>
            )}
          </span>
          <span className="text-[10px] text-zinc-500">Generated from the selected Builder combination</span>
        </div>
        <div className="overflow-x-auto overflow-y-auto" style={maxHeight ? { maxHeight } : undefined}>
          <table className="w-full font-mono text-xs whitespace-nowrap">
            <thead>
              <tr className="bg-zinc-900 text-zinc-500 text-[10px] uppercase tracking-wide sticky top-0 z-10">
                <th className="text-left px-3 py-2 font-medium w-8"></th>
                <th className="text-left px-3 py-2 font-medium">No</th>
                <th className="text-left px-3 py-2 font-medium">Result</th>
                <th className="text-right px-3 py-2 font-medium">Risk</th>
                <th className="text-right px-3 py-2 font-medium">RR</th>
                <th className="text-right px-3 py-2 font-medium">Lots</th>
                <th className="text-right px-3 py-2 font-medium">Gross P/L</th>
                <th className="text-right px-3 py-2 font-medium">Fee</th>
                <th className="text-right px-3 py-2 font-medium">Slippage</th>
                <th className="text-right px-3 py-2 font-medium">Spread</th>
                <th className="text-right px-3 py-2 font-medium">Net P/L</th>
                <th className="text-right px-3 py-2 font-medium">Capital</th>
                <th className="text-right px-3 py-2 font-medium">Cum. P/L</th>
                <th className="text-right px-3 py-2 font-medium">Price Chg</th>
                <th className="text-right px-3 py-2 font-medium">Price</th>
              </tr>
            </thead>
            <tbody>
              {result.trades.map((t, idx) => (
                <tr
                  key={`${t.n}-${idx}`}
                  draggable
                  onDragStart={handleDragStart(idx)}
                  onDragOver={handleDragOver(idx)}
                  onDrop={handleDrop(idx)}
                  onDragEnd={handleDragEnd}
                  className={`border-b border-zinc-800/60 hover:bg-zinc-800/20 transition-colors cursor-grab active:cursor-grabbing ${
                    dragIdx === idx ? "opacity-40" : ""
                  } ${
                    dragOverIdx === idx && dragIdx !== idx
                      ? "bg-zinc-500/10 border-t-2 border-t-zinc-300"
                      : ""
                  }`}
                >
                  <td className="px-3 py-1.5 text-zinc-600"><GripVertical size={13} /></td>
                  <td className="px-3 py-1.5 text-zinc-500">{t.n}</td>
                  <td className="px-3 py-1.5">
                    <TradeResultBadge win={t.win} />
                  </td>
                  <td className="px-3 py-1.5 text-right">{fmtMoney(t.risk)} {t.riskAllocationReset ? <span className="ml-1 text-[9px] text-violet-300">RESET</span> : null}</td>
                  <td className="px-3 py-1.5 text-right text-zinc-300">{Number(t.rr ?? -1).toFixed(2)}R</td>
                  <td className="px-3 py-1.5 text-right text-[#FEF9C2]">{t.lots.toFixed(2)}</td>
                  <td className={`px-3 py-1.5 text-right ${t.grossPL >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmtMoney(t.grossPL)}</td>
                  <td className="px-3 py-1.5 text-right text-[#C4B4FF]">{fmtMoney(t.fee)}</td>
                  <td className="px-3 py-1.5 text-right text-zinc-400">{fmtMoney(t.slip)}</td>
                  <td className="px-3 py-1.5 text-right text-zinc-400">{fmtMoney(t.spreadCost)}</td>
                  <td className={`px-3 py-1.5 text-right ${t.netPL >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmtMoney(t.netPL)}</td>
                  <td className="px-3 py-1.5 text-right text-[#74D4FF]">{fmtMoney(t.capital)}</td>
                  <td className={`px-3 py-1.5 text-right ${t.capital - initialCapital >= 0 ? "text-emerald-400" : "text-red-400"}`} style={t.n === result.peakTradeIndex ? { color: "#7CFC00" } : t.n === result.troughTradeIndex ? { color: "#FF0000" } : undefined}>{fmtMoney(t.capital - initialCapital)}</td>
                  <td className="px-3 py-1.5 text-right" style={{ color: t.price - t.entryPrice >= 0 ? "#05DF72" : "#FF692A" }}>{t.price - t.entryPrice >= 0 ? "+" : ""}{fmtMoney(t.price - t.entryPrice)}</td>
                  <td className="px-3 py-1.5 text-right text-zinc-400">{fmtMoney(t.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {result.stopped && <div className="bg-red-500/10 border-t border-red-500/40 text-red-400 font-mono text-xs px-4 py-2.5">{result.stopReason}</div>}
      </div>
    </>
  );
}
const MODE_LABEL = {
  single: "Single Run",
  sweep: "Win Rate",
  fno: "Day / F&O",
  builder: "Builder",
  bankroll: "Bankroll",
};

export default function RiskSimulator() {
  const [cfg, setCfg] = useState(DEFAULTS);
  const [mode, setMode] = useState("single");
  const [bankrollBaseMode, setBankrollBaseMode] = useState("single");
  const [bankrollRuns, setBankrollRuns] = useState(200);
  const [bankrollCycles, setBankrollCycles] = useState(100);
  const [bankrollTrades, setBankrollTrades] = useState(100);
  const [bankrollRuinDD, setBankrollRuinDD] = useState(80);
  const [bankrollResult, setBankrollResult] = useState(null);
  const [bankrollRunning, setBankrollRunning] = useState(false);
  const [bankrollProgress, setBankrollProgress] = useState({ done: 0, total: 100 });
  const [bankrollError, setBankrollError] = useState("");
  // Which base strategy engine the Win Rate Sweep should run: "single"
  // (fractional-lot engine) or "fno" (whole-lot, Indian-market engine). This
  // automatically follows whichever of the two tabs the user configured
  // most recently, so switching into Sweep always uses the right config.
  const [sweepBaseMode, setSweepBaseMode] = useState("single");
  const [strategyBaseMode, setStrategyBaseMode] = useState("single");
  const [result, setResult] = useState(null);
  const [sweep, setSweep] = useState(null);
  const [batchResult, setBatchResult] = useState(null);
  const [selectedBatchRunIdx, setSelectedBatchRunIdx] = useState(null);
  const [builderResult, setBuilderResult] = useState(null);
  const [builderSelectedKey, setBuilderSelectedKey] = useState(null);
  const [builderBuilding, setBuilderBuilding] = useState(false);
  const builderBuildIdRef = useRef(0);
  const [activeRunLabel, setActiveRunLabel] = useState(null);
  // Lets the user directly inspect any existing Multi Simulation scenario
  // from the Trade Log header (for example, change Scenario : 15 to 75).
  const [scenarioInput, setScenarioInput] = useState("");
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [allocationOpenIdx, setAllocationOpenIdx] = useState(null);
  const [allocationScales, setAllocationScales] = useState({});
  const [riskAllocationOpen, setRiskAllocationOpen] = useState(false);
  const lastCleanCfgRef = useRef(null);
  const lastRunModeRef = useRef(null);

  // Keep an independent workspace for Single Run and Day / F&O.
  // Builder can temporarily replace the visible Trade Log/result, but it must
  // never overwrite the user's last configuration/result for either strategy tab.
  const strategyWorkspaceRef = useRef({
    single: {
      cfg: { ...DEFAULTS },
      result: null,
      cleanCfg: null,
      activeRunLabel: null,
      batchResult: null,
      selectedBatchRunIdx: null,
    },
    fno: {
      cfg: { ...DEFAULTS },
      result: null,
      cleanCfg: null,
      activeRunLabel: null,
      batchResult: null,
      selectedBatchRunIdx: null,
    },
  });

  // While Single Run / Day-F&O is the active tab, continuously persist its
  // current configuration + visible result into that mode's private workspace.
  // Builder and Sweep can then freely use the shared React state without ever
  // overwriting the last Single/F&O workspace. The restore guard prevents the
  // first render after a tab switch from saving the Builder state into the
  // destination workspace before the requested snapshot has been restored.
  const restoringStrategyWorkspaceRef = useRef(false);

  // Builder gets its own completely independent workspace as well. This is
  // separate from the Single/F&O strategy snapshots so a Builder combination
  // selected in the Trade Log cannot be replaced by a strategy result while
  // the user briefly visits Single Run or Day / F&O and then returns to Builder.
  const builderWorkspaceRef = useRef(null);
  const restoringBuilderWorkspaceRef = useRef(false);

  useEffect(() => {
    if (mode !== "single" && mode !== "fno") return;

    if (restoringStrategyWorkspaceRef.current) {
      restoringStrategyWorkspaceRef.current = false;
    }

    strategyWorkspaceRef.current[mode] = {
      ...strategyWorkspaceRef.current[mode],
      cfg: { ...cfg },
      result,
      cleanCfg: lastCleanCfgRef.current ? { ...lastCleanCfgRef.current } : null,
      activeRunLabel,
      batchResult,
      selectedBatchRunIdx,
      scenarioInput,
    };
  }, [mode, cfg, result, activeRunLabel, batchResult, selectedBatchRunIdx, scenarioInput]);

  // Persist the complete Builder workspace separately from Single/F&O.
  // The workspace includes the selected combination, Builder matrix result,
  // visible Trade Log/result and the exact calibrated config used by that
  // combination. The restore guard prevents the incoming Single/F&O state
  // from being captured as Builder state during the tab switch itself.
  useEffect(() => {
    if (mode !== "builder") return;

    if (restoringBuilderWorkspaceRef.current) {
      restoringBuilderWorkspaceRef.current = false;
      return;
    }

    builderWorkspaceRef.current = {
      cfg: { ...cfg },
      result,
      builderResult,
      builderSelectedKey,
      activeRunLabel,
      batchResult,
      selectedBatchRunIdx,
      cleanCfg: lastCleanCfgRef.current ? { ...lastCleanCfgRef.current } : null,
      baseMode: strategyBaseMode,
      sourceSignature: builderSourceSignature(
      strategyWorkspaceRef.current[strategyBaseMode]?.cfg || cfg,
      strategyBaseMode
    ),
      sourceRiskAllocationSignature: builderRiskAllocationSignature(
        strategyWorkspaceRef.current[strategyBaseMode]?.cfg || cfg
      ),
    };
  }, [
    mode,
    cfg,
    result,
    builderResult,
    builderSelectedKey,
    activeRunLabel,
    batchResult,
    selectedBatchRunIdx,
    strategyBaseMode,
  ]);

  // Switching tabs restores the last workspace belonging to that strategy.
  // Builder is a separate workspace, but its STRATEGY configuration must always
  // follow the currently selected Single Run / Day-F&O base. Builder-only inputs
  // (risk budget + trade range) are preserved separately.
  const handleModeChange = useCallback(
    (nextMode) => {
      // Explicitly save the workspace we are leaving at the exact click.
      if (mode === "builder") {
        builderWorkspaceRef.current = {
          cfg: { ...cfg },
          result,
          builderResult,
          builderSelectedKey,
          activeRunLabel,
          batchResult,
          selectedBatchRunIdx,
          cleanCfg: lastCleanCfgRef.current ? { ...lastCleanCfgRef.current } : null,
          baseMode: strategyBaseMode,
          sourceSignature: builderSourceSignature(
      strategyWorkspaceRef.current[strategyBaseMode]?.cfg || cfg,
      strategyBaseMode
    ),
      sourceRiskAllocationSignature: builderRiskAllocationSignature(
        strategyWorkspaceRef.current[strategyBaseMode]?.cfg || cfg
      ),
        };
      }

      if (mode === "single" || mode === "fno") {
        strategyWorkspaceRef.current[mode] = {
          ...strategyWorkspaceRef.current[mode],
          cfg: { ...cfg },
          result,
          cleanCfg: lastCleanCfgRef.current ? { ...lastCleanCfgRef.current } : null,
          activeRunLabel,
          batchResult,
          selectedBatchRunIdx,
          scenarioInput,
        };
      }

      // Returning to Single/F&O restores that strategy's own workspace and
      // never lets a Builder combination become its visible Trade Log/result.
      if (nextMode === "single" || nextMode === "fno") {
        const workspace = strategyWorkspaceRef.current[nextMode];
        restoringStrategyWorkspaceRef.current = true;

        setCfg(workspace?.cfg ? { ...workspace.cfg } : { ...DEFAULTS });
        setResult(workspace?.result || null);
        setSweep(null);
        setBatchResult(workspace?.batchResult || null);
        setSelectedBatchRunIdx(workspace?.selectedBatchRunIdx ?? null);
        setActiveRunLabel(workspace?.activeRunLabel ?? null);
        setScenarioInput(workspace?.scenarioInput ?? (workspace?.selectedBatchRunIdx != null ? String(workspace.selectedBatchRunIdx) : ""));
        setBuilderSelectedKey(null);

        const restoredCfg = workspace?.cfg ? { ...workspace.cfg } : { ...DEFAULTS };
        lastCleanCfgRef.current =
          workspace?.cleanCfg ? { ...workspace.cleanCfg } : cleanConfig(restoredCfg);
        lastRunModeRef.current = nextMode;

        setSweepBaseMode(nextMode);
        setStrategyBaseMode(nextMode);
        setMode(nextMode);
        return;
      }

      if (nextMode === "bankroll") {
        const sourceMode = mode === "fno" ? "fno" : mode === "single" ? "single" : (mode === "builder" ? strategyBaseMode : bankrollBaseMode);
        setBankrollBaseMode(sourceMode === "fno" ? "fno" : "single");
        setBankrollResult(null);
        setMode("bankroll");
        return;
      }

      if (nextMode === "builder") {
        const strategyBase = nextMode === "builder"
          ? (mode === "fno" ? "fno" : mode === "single" ? "single" : mode === "bankroll" ? bankrollBaseMode : strategyBaseMode)
          : strategyBaseMode;
        const currentSourceCfg =
          mode === "single" || mode === "fno"
            ? { ...cfg }
            : {
                ...cfg,
                ...(strategyWorkspaceRef.current[strategyBase]?.cfg || {}),
              };
        const sourceSig = builderSourceSignature(currentSourceCfg, strategyBase);
        const workspace = builderWorkspaceRef.current;
        const workspaceSourceSig = workspace
          ? (
              workspace.sourceSignature ||
              builderSourceSignature(workspace.cfg || {}, workspace.baseMode || strategyBase)
            )
          : null;
        const workspaceMatchesSource =
          !!workspace &&
          (workspace.baseMode || strategyBase) === strategyBase &&
          workspaceSourceSig === sourceSig;

        // Always start Builder from the CURRENT strategy configuration. Keep
        // only Builder-specific controls from the previous Builder workspace.
        // This fixes the RR Fixed/Range sync issue (and also keeps all other
        // strategy settings current).
        const preservedBuilderInputs = workspace
          ? builderInputFields(workspace.cfg || {})
          : {
              builderInitialCapital: Number(currentSourceCfg.initialCapital) || 0,
              builderTotalRiskPct: Number(currentSourceCfg.builderTotalRiskPct) || 5,
              builderMinTrades: Number(currentSourceCfg.builderMinTrades) || 5,
              builderMaxTrades: Number(currentSourceCfg.builderMaxTrades) || 10,
              builderSequenceLimit: BUILDER_SAFE_LIMITS.maxSequenceEvaluations,
              builderMode: currentSourceCfg.builderMode,
              builderTargetInputMode: currentSourceCfg.builderTargetInputMode,
              builderTargetValue: currentSourceCfg.builderTargetValue,
            };
        const preservedBuilderRiskInputs = workspace && workspaceMatchesSource
          ? builderRiskAllocationFields(workspace.cfg || {})
          : {};
        const mergedBuilderCfg = {
          ...currentSourceCfg,
          ...preservedBuilderInputs,
          ...preservedBuilderRiskInputs,
          builderRiskMenuOpen: false,
        };
        if (!workspace) {
          mergedBuilderCfg.builderInitialCapital = Number(currentSourceCfg.initialCapital) || 0;
        }

        restoringBuilderWorkspaceRef.current = true;
        setCfg(mergedBuilderCfg);
        setStrategyBaseMode(strategyBase);
        setSweepBaseMode(strategyBase);
        lastRunModeRef.current = strategyBase;

        if (workspaceMatchesSource) {
          // Same underlying strategy: restore the exact previously selected
          // Builder combination/Trade Log.
          setResult(workspace.result || null);
          setBuilderResult(workspace.builderResult || null);
          setBuilderSelectedKey(workspace.builderSelectedKey ?? null);
          setActiveRunLabel(workspace.activeRunLabel ?? null);
          setBatchResult(workspace.batchResult || null);
          setSelectedBatchRunIdx(workspace.selectedBatchRunIdx ?? null);
          lastCleanCfgRef.current = workspace.cleanCfg
            ? { ...workspace.cleanCfg }
            : (workspace.result ? cleanConfig({ ...mergedBuilderCfg, initialCapital: workspace.cfg?.builderInitialCapital ?? mergedBuilderCfg.builderInitialCapital }) : null);
        } else {
          // Underlying strategy changed (including RR mode/range): old Builder
          // output is no longer valid, so preserve Builder inputs but require a
          // rebuild against the new strategy configuration.
          setResult(null);
          setBuilderResult(null);
          setBuilderSelectedKey(null);
          setActiveRunLabel(null);
          setBatchResult(null);
          setSelectedBatchRunIdx(null);
          lastCleanCfgRef.current = null;
        }

        setMode("builder");
        return;
      }

      setMode(nextMode);
    },
    [
      mode,
      cfg,
      result,
      activeRunLabel,
      batchResult,
      selectedBatchRunIdx,
      builderResult,
      builderSelectedKey,
      strategyBaseMode,
      scenarioInput,
      bankrollBaseMode,
    ]
  );

  // The config panel (and, when running a sweep, the sweep engine itself)
  // should reflect Single Run's fields while on that tab, Day/F&O's fields
  // while on that tab, and whichever of the two was set last while on Sweep.
  const effectiveMode = mode === "sweep" ? sweepBaseMode : mode;

  const setField = (key) => (e) => {
    const val = e.target.value;
    setCfg((c) => ({ ...c, [key]: val === "" ? "" : parseFloat(val) }));
  };

  const setBuilderField = (key) => (e) => {
    const val = e?.target?.value;
    const stringKeys = new Set([
      "builderMode",
      "builderTargetInputMode",
      "builderBaseMode",
      "builderSequenceFilterMatch",
      "builderSequenceFilterFinalPnl",
    ]);
    const booleanKeys = new Set(["builderRiskMenuOpen", "builderSequenceFilterEnabled", "builderSequenceFilterOpen"]);
    setCfg((c) => ({
      ...c,
      [key]: booleanKeys.has(key)
        ? Boolean(val)
        : stringKeys.has(key)
        ? String(val ?? "")
        : val === ""
        ? ""
        : parseFloat(val),
    }));
  };

  const selectBuilderCandidate = useCallback((candidate, builderCfg) => {
    if (!candidate) return;
    const baseMode = builderCfg?.baseMode === "fno" ? "fno" : "single";
    const runResult = candidate.result;
    // IMPORTANT: candidate.result was generated from the Builder's calibrated
    // autoStrategyCfg. Keep that exact calibrated config attached to the result
    // so the Combination Trade Log, price math and any later drag-reorder use
    // the same risk/lot basis that produced the candidate. Falling back to the
    // source strategy config would mix an auto-scaled risk plan with the source
    // lot value and produce a different Price Chg.
    const runCfg = candidate.autoStrategyCfg || builderCfg?.strategyCfg || cleanConfig(cfg);
    setBuilderSelectedKey(candidate.key);
    setResult({ ...runResult, winLossSeq: candidate.sequenceArray });
    lastCleanCfgRef.current = runCfg;
    lastRunModeRef.current = baseMode;
    const nextLabel = `Combination · ${candidate.actualWinRate.toFixed(0)}% WR · ${candidate.tradeCount} trades`;
    setActiveRunLabel(nextLabel);
    builderWorkspaceRef.current = {
      cfg: { ...cfg },
      result: { ...runResult, winLossSeq: candidate.sequenceArray },
      builderResult,
      builderSelectedKey: candidate.key,
      activeRunLabel: nextLabel,
      batchResult: null,
      selectedBatchRunIdx: null,
      cleanCfg: { ...runCfg },
      baseMode,
      sourceSignature: builderSourceSignature(
        strategyWorkspaceRef.current[baseMode]?.cfg || cfg,
        baseMode
      ),
      sourceRiskAllocationSignature: builderRiskAllocationSignature(
        strategyWorkspaceRef.current[baseMode]?.cfg || cfg
      ),
    };
  }, [cfg, builderResult]);

  // Builder Combination drag reorder: moving one W/L chip to another
  // position changes only the order, not the number of wins/losses. The exact
  // Builder risk budget and active Single Run / Day / F&O configuration are
  // then used again to allocate risk, calculate lots, fees, P/L and drawdown.
  const reorderBuilderCombination = useCallback((candidate, fromIdx, toIdx) => {
    if (!candidate || !builderResult || fromIdx === toIdx) return;

    const seq = [...candidate.sequenceArray];
    if (fromIdx < 0 || toIdx < 0 || fromIdx >= seq.length || toIdx >= seq.length) return;
    const [moved] = seq.splice(fromIdx, 1);
    seq.splice(toIdx, 0, moved);

    const targetWinRate = candidate.actualWinRate;
    const editedCandidate = builderResult.builderMode === "target"
      ? evaluateBuilderTargetSequence(
          builderResult.strategyCfg,
          seq,
          builderResult.totalRiskAmount,
          builderResult.baseMode === "fno",
          targetWinRate,
          builderResult.targetInputMode || "targetPoints",
          builderResult.targetInputValue || 0
        )
      : evaluateBuilderSequence(
          builderResult.strategyCfg,
          seq,
          builderResult.totalRiskAmount,
          builderResult.baseMode === "fno",
          targetWinRate
        );
    if (!editedCandidate) return;
    if (builderResult.sequenceFilter?.enabled && !builderSequenceFilterMatches(editedCandidate, builderResult.sequenceFilter)) {
      return;
    }

    const nextBuilder = applyBuilderCandidateEdit(
      builderResult,
      targetWinRate,
      candidate.key,
      editedCandidate
    );
    setBuilderResult(nextBuilder);
    setBuilderSelectedKey(editedCandidate.key);
    // Use the exact calibrated result/config produced by evaluateBuilderSequence.
    // Do NOT replay the risk plan through the unscaled source config: that mixes
    // calibrated risk amounts with the old lot-value basis and changes Price Chg,
    // fees and downstream cascade values.
    setResult({ ...editedCandidate.result, winLossSeq: seq });
    lastCleanCfgRef.current = editedCandidate.autoStrategyCfg || builderResult.strategyCfg;
    lastRunModeRef.current = builderResult.baseMode;
    const nextLabel = `Combination · ${formatBuilderWinRate(editedCandidate.actualWinRate)} WR · ${editedCandidate.tradeCount} trades · sequence reordered`;
    setActiveRunLabel(nextLabel);
    setSelectedBatchRunIdx(null);
    builderWorkspaceRef.current = {
      cfg: { ...cfg },
      result: { ...editedCandidate.result, winLossSeq: seq },
      builderResult: nextBuilder,
      builderSelectedKey: editedCandidate.key,
      activeRunLabel: nextLabel,
      batchResult: null,
      selectedBatchRunIdx: null,
      cleanCfg: { ...(editedCandidate.autoStrategyCfg || builderResult.strategyCfg) },
      baseMode: builderResult.baseMode,
      sourceSignature: builderSourceSignature(
        strategyWorkspaceRef.current[builderResult.baseMode]?.cfg || cfg,
        builderResult.baseMode
      ),
      sourceRiskAllocationSignature: builderRiskAllocationSignature(
        strategyWorkspaceRef.current[builderResult.baseMode]?.cfg || cfg
      ),
    };
  }, [builderResult, cfg]);

  const handleBuilderRun = useCallback(() => {
    if (builderBuilding) return;

    const normalized = {
      ...cfg,
      builderInitialCapital: Math.max(0, Number(cfg.builderInitialCapital) || 0),
      builderTotalRiskPct: Math.max(0, Number(cfg.builderTotalRiskPct) || 0),
      // Both controls are fully custom. Minimum is 1 trade; there is no fixed
      // Builder maximum, and Max Trades is automatically kept >= Min Trades.
      builderMinTrades: Math.max(1, Math.round(Number(cfg.builderMinTrades) || 1)),
      builderMaxTrades: Math.max(1, Math.round(Number(cfg.builderMaxTrades) || 1)),
      builderSequenceLimit: Math.min(
        BUILDER_SAFE_LIMITS.maxSequenceEvaluations,
        Math.max(1, Math.round(Number(cfg.builderSequenceLimit) || BUILDER_SAFE_LIMITS.maxSequenceEvaluations))
      ),
      builderSequenceFilterEnabled: cfg.builderSequenceFilterEnabled === true,
      builderSequenceFilterOpen: cfg.builderSequenceFilterOpen === true,
      builderSequenceFilterLeadingLosses: Math.min(1000, Math.max(1, Math.round(Number(cfg.builderSequenceFilterLeadingLosses) || 1))),
      builderSequenceFilterMatch: cfg.builderSequenceFilterMatch === "exact" ? "exact" : "atLeast",
      builderSequenceFilterFinalPnl: ["green", "red", "any"].includes(cfg.builderSequenceFilterFinalPnl) ? cfg.builderSequenceFilterFinalPnl : "green",
      builderSequenceFilterGreenByTrade: Math.min(1000, Math.max(0, Math.round(Number(cfg.builderSequenceFilterGreenByTrade) || 0))),
      builderMode: cfg.builderMode === "target" ? "target" : "normal",
      builderTargetInputMode: cfg.builderTargetInputMode === "riskPoints" ? "riskPoints" : "targetPoints",
      builderTargetValue: Math.max(0, Number(cfg.builderTargetValue) || 0),
                  builderBaseMode: strategyBaseMode,
    };
    if (normalized.builderMaxTrades < normalized.builderMinTrades) {
      normalized.builderMaxTrades = normalized.builderMinTrades;
    }
    if (normalized.builderMode === "target" && normalized.builderTargetValue <= 0) {
      setBuilderBuilding(false);
      return;
    }

    setCfg((c) => ({ ...c, ...normalized }));
    setBuilderBuilding(true);
    const buildId = ++builderBuildIdRef.current;

    // Let React paint the busy state before the exact W/L enumeration starts.
    // The Builder evaluates every mathematically possible sequence from the
    // requested custom trade window, so the small yield makes the UI feel
    // responsive instead of looking frozen for the duration of the build.
    window.setTimeout(() => {
      if (buildId !== builderBuildIdRef.current) return;

      try {
        const built = runStrategyBuilder(normalized);
        if (buildId !== builderBuildIdRef.current) return;

        setBuilderResult(built);
        const firstCandidate =
          built.bestReturnPoint?.candidate ||
          built.points.find((p) => p.candidate)?.candidate ||
          null;

        if (firstCandidate) {
          selectBuilderCandidate(firstCandidate, built);
        } else {
          setBuilderSelectedKey(null);
          setResult(null);
          lastCleanCfgRef.current = built.strategyCfg;
          lastRunModeRef.current = built.baseMode;
          setActiveRunLabel(null);
          builderWorkspaceRef.current = {
            cfg: { ...normalized },
            result: null,
            builderResult: built,
            builderSelectedKey: null,
            activeRunLabel: null,
            batchResult: null,
            selectedBatchRunIdx: null,
            cleanCfg: { ...built.strategyCfg },
            baseMode: built.baseMode,
            sourceSignature: builderSourceSignature(
              strategyWorkspaceRef.current[built.baseMode]?.cfg || normalized,
              built.baseMode
            ),
            sourceRiskAllocationSignature: builderRiskAllocationSignature(
              strategyWorkspaceRef.current[built.baseMode]?.cfg || normalized
            ),
          };
        }
      } finally {
        if (buildId === builderBuildIdRef.current) setBuilderBuilding(false);
      }
    }, 0);
  }, [cfg, selectBuilderCandidate, strategyBaseMode, builderBuilding]);

  // Switching the F&O broker or segment re-seeds the editable brokerage
  // fields (type/rate/min/max/flat fee) to that combo's known default —
  // the user can then tweak any of those numbers if the broker's real
  // rates have since changed. "custom" is left untouched since it uses its
  // own independent Fixed/Turnover fields. Other Charges % and GST % are
  // statutory (segment-only, not broker-specific), so they're only
  // re-seeded when the segment itself actually changes — switching broker
  // alone never clobbers a value the user already edited there.
  const updateFnoBrokerSegment = (updates) => {
    setCfg((c) => {
      const next = { ...c, ...updates };
      const d = FNO_BROKERAGE_DEFAULTS[next.fnoBroker]?.[next.fnoSegment];
      let merged = next;
      if (d) {
        merged = {
          ...merged,
          fnoBrokerageType: d.type,
          fnoBrokerageRatePct: d.ratePct ?? merged.fnoBrokerageRatePct,
          fnoBrokerageMin: d.min ?? 0,
          fnoBrokerageMax: d.max ?? 0,
          fnoBrokerageFlatPerOrder: d.flatPerOrder ?? merged.fnoBrokerageFlatPerOrder,
        };
      }
      if (updates.fnoSegment && updates.fnoSegment !== c.fnoSegment) {
        merged = {
          ...merged,
          fnoOtherChargesPct: Number(combinedStatutoryPct(next.fnoSegment).toFixed(5)),
          fnoGstPct: 18,
        };
      }
      return merged;
    });
  };

  const handleRun = useCallback(() => {
    const clean = cleanConfig(cfg);

    // For Sweep, validate against whichever base engine (single/fno) is
    // currently in effect, since that's the config the sweep will actually run.
    const validationMode = mode === "sweep" ? sweepBaseMode : mode;
    if (validationMode === "fno") {
      if (clean.fnoSegment === "intraday") {
        if (!clean.initialCapital || !clean.fnoQuantity) return;
      } else if (!clean.initialCapital || !clean.fnoLots || !clean.fnoLotSize) {
        return;
      }
    } else if (!clean.initialCapital || !clean.baseLots) return;

    if (mode === "single") {
      const nextResult = runSimulation(clean);
      strategyWorkspaceRef.current.single = {
        cfg: { ...cfg },
        result: nextResult,
        cleanCfg: clean,
        activeRunLabel: null,
        batchResult: null,
        selectedBatchRunIdx: null,
      };
      setSweep(null);
      lastCleanCfgRef.current = clean;
      lastRunModeRef.current = "single";
      setResult(nextResult);
      setActiveRunLabel(null);
      setSelectedBatchRunIdx(null);
      setBatchResult(null);
    } else if (mode === "fno") {
      const nextResult = runSimulationFnO(clean);
      strategyWorkspaceRef.current.fno = {
        cfg: { ...cfg },
        result: nextResult,
        cleanCfg: clean,
        activeRunLabel: null,
        batchResult: null,
        selectedBatchRunIdx: null,
      };
      setSweep(null);
      lastCleanCfgRef.current = clean;
      lastRunModeRef.current = "fno";
      setResult(nextResult);
      setActiveRunLabel(null);
      setSelectedBatchRunIdx(null);
      setBatchResult(null);
    } else if (mode === "sweep") {
      const step = Math.min(Math.max(Math.round(Number(cfg.sweepStep) || 10), 1), 50);
      let runsPerPoint = Math.min(Math.max(Math.round(Number(cfg.sweepRuns) || 1), 1), 2000);
      const requestedRunsPerPoint = runsPerPoint; // the Sample Size value the user actually set
      // Matches runWinRateSweep's loop: floor(100/step)+1 natural points
      // (0, step, 2*step, ...), plus one more whenever step doesn't land
      // exactly on 100 — that extra point is the guaranteed 100% run the
      // loop now always adds.
      const numPoints = Math.ceil(100 / step) + 1;
      if (runsPerPoint * numPoints * clean.numTrades > 400000) {
        runsPerPoint = Math.max(1, Math.floor(400000 / (numPoints * clean.numTrades)));
      }
      lastCleanCfgRef.current = clean;
      lastRunModeRef.current = "sweep";
      const points = runWinRateSweep(clean, step, runsPerPoint, sweepBaseMode);
      setResult(null);
      setSweep({ points, runsPerPoint, requestedRunsPerPoint, baseMode: sweepBaseMode });
    }
  }, [cfg, mode, sweepBaseMode]);

  // Runs the current strategy config N times (Batch Count), each against a
  // fresh random trade sequence at the same Win Rate %, then summarizes the
  // spread of outcomes: how many runs were profitable, and which run hit
  // the best profit, the worst loss, and the deepest drawdown.
  const handleRunBatch = useCallback(() => {
    const clean = cleanConfig(cfg);
    const activeMode = mode === "fno" ? "fno" : "single";

    if (activeMode === "fno") {
      if (clean.fnoSegment === "intraday") {
        if (!clean.initialCapital || !clean.fnoQuantity) return;
      } else if (!clean.initialCapital || !clean.fnoLots || !clean.fnoLotSize) {
        return;
      }
    } else if (!clean.initialCapital || !clean.baseLots) return;

    let n = Math.round(Number(cfg.batchCount) || 0);
    if (n < 1) return;
    n = Math.min(2000, n);
    if (n * clean.numTrades > 300000) {
      n = Math.max(1, Math.floor(300000 / clean.numTrades));
    }

    const runFn = activeMode === "fno" ? simulateFromSequenceFnO : simulateFromSequence;
    const runs = [];
    for (let i = 0; i < n; i++) {
      const seq = buildWinLossSeq(clean.numTrades, clean.winRate);
      runs.push({ index: i + 1, winLossSeq: seq, result: runFn(clean, seq) });
    }

    let maxProfitRun = runs[0];
    let maxLossRun = runs[0];
    let maxDDRun = runs[0];
    let profitableCount = 0;
    runs.forEach((r) => {
      if (r.result.netPL > 0) profitableCount += 1;
      if (r.result.netPL > maxProfitRun.result.netPL) maxProfitRun = r;
      if (r.result.netPL < maxLossRun.result.netPL) maxLossRun = r;
      if (r.result.maxDD > maxDDRun.result.maxDD) maxDDRun = r;
    });
    const losingCount = runs.length - profitableCount;
    const profitablePct = runs.length ? (profitableCount / runs.length) * 100 : 0;
    const netReturns = runs.map((r) => (r.result.netPL / clean.initialCapital) * 100);
    const meanReturn = netReturns.reduce((a, b) => a + b, 0) / Math.max(1, netReturns.length);
    const sdReturn = netReturns.length > 1
      ? Math.sqrt(netReturns.reduce((s2, x) => s2 + (x - meanReturn) ** 2, 0) / (netReturns.length - 1))
      : 0;
    const ci95HalfWidth = netReturns.length > 1 ? 1.96 * sdReturn / Math.sqrt(netReturns.length) : 0;
    const nextBatchResult = {
      runs,
      mode: activeMode,
      cfg: clean,
      stats: {
        total: runs.length,
        requested: Math.round(Number(cfg.batchCount) || 0),
        profitableCount,
        losingCount,
        profitablePct,
        meanReturn,
        sdReturn,
        ci95Low: meanReturn - ci95HalfWidth,
        ci95High: meanReturn + ci95HalfWidth,
        maxProfitRun,
        maxLossRun,
        maxDDRun,
      },
    };

    setBatchResult(nextBatchResult);
    setSelectedBatchRunIdx(null);
    setActiveRunLabel(null);
    setScenarioInput("");

    strategyWorkspaceRef.current[activeMode] = {
      cfg: { ...cfg },
      result,
      cleanCfg: clean,
      activeRunLabel: null,
      batchResult: nextBatchResult,
      selectedBatchRunIdx: null,
      scenarioInput: "",
    };
  }, [cfg, mode]);


  // Clears the Multi Simulations batch entirely — back to the empty "Set a
  // Scenarios count..." state — without touching the main Trade Log/stats
  // above (those keep showing whatever single run or selected batch run
  // was last loaded there).
  const handleClearBatch = useCallback(() => {
    setBatchResult(null);
    setSelectedBatchRunIdx(null);
    setScenarioInput("");
  }, []);


  // Loads one batch run's exact trade sequence + result into the normal
  // result state, so the stats cards, Per-Trade P/L chart and Trade Log
  // above all switch to showing that specific run — same recalculation
  // surface as a manual "Run Simulation", just fed from the batch instead.
  const handleSelectBatchRun = useCallback(
    (run) => {
      if (!batchResult) return;
      lastCleanCfgRef.current = batchResult.cfg;
      lastRunModeRef.current = batchResult.mode;
      const nextResult = { ...run.result, winLossSeq: run.winLossSeq };
      setResult(nextResult);
      setSelectedBatchRunIdx(run.index);
      setScenarioInput(String(run.index));
      setActiveRunLabel(`Scenario : ${run.index}`);

      if (batchResult.mode === "single" || batchResult.mode === "fno") {
        strategyWorkspaceRef.current[batchResult.mode] = {
          cfg: { ...batchResult.cfg },
          result: nextResult,
          cleanCfg: { ...batchResult.cfg },
          activeRunLabel: `Scenario : ${run.index}`,
          batchResult,
          selectedBatchRunIdx: run.index,
          scenarioInput: String(run.index),
        };
        lastCleanCfgRef.current = { ...batchResult.cfg };
        lastRunModeRef.current = batchResult.mode;
      }
    },
    [batchResult]
  );

  // Lets the user type any existing Multi Simulation scenario number directly
  // in the Trade Log header. Commit on Enter/blur so partially typed values
  // (for example changing 15 to 75) do not trigger an intermediate scenario load.
  const commitScenarioInput = useCallback(() => {
    if (!batchResult) return;

    const activeMode = mode === "fno" ? "fno" : "single";
    if (batchResult.mode !== activeMode) {
      setScenarioInput(selectedBatchRunIdx != null ? String(selectedBatchRunIdx) : "");
      return;
    }

    const scenarioNo = Math.round(Number(scenarioInput));
    if (!Number.isFinite(scenarioNo)) {
      setScenarioInput(selectedBatchRunIdx != null ? String(selectedBatchRunIdx) : "");
      return;
    }

    const run = batchResult.runs.find((r) => r.index === scenarioNo);
    if (!run) {
      setScenarioInput(selectedBatchRunIdx != null ? String(selectedBatchRunIdx) : "");
      return;
    }

    handleSelectBatchRun(run);
  }, [batchResult, mode, scenarioInput, selectedBatchRunIdx, handleSelectBatchRun]);

  // After a manual drag-reorder or Result-flip recalculates the Trade Log,
  // checks whether the new outcome (net P/L, at display precision) now
  // matches one of the runs already sitting in the Multi Simulations
  // histogram for the current mode. Returns that run (or null) so callers
  // can both relabel the Trade Log AND move the highlighted bar in
  // Simulation Outcomes to follow it — if nothing matches, there's nothing
  // to point at, so both get cleared.
  const matchBatchRun = useCallback(
    (recalculatedResult) => {
      if (!batchResult || batchResult.mode !== lastRunModeRef.current) return null;
      const targetCents = Math.round(recalculatedResult.netPL * 100);
      return batchResult.runs.find((r) => Math.round(r.result.netPL * 100) === targetCents) || null;
    },
    [batchResult]
  );

  // Builder-specific drag reorder: regenerate the Builder risk allocation for the
  // new W/L order, then replace the edited combination in the exact matrix point
  // and refresh all Builder-derived counts/Best Return state.
  const handleBuilderTradeReorder = useCallback(
    (fromIdx, toIdx) => {
      if (
        fromIdx === null ||
        toIdx === null ||
        fromIdx === toIdx ||
        !result ||
        !builderResult ||
        !lastCleanCfgRef.current ||
        lastRunModeRef.current !== builderResult.baseMode
      ) return;

      const seq = [...result.winLossSeq];
      if (fromIdx < 0 || toIdx < 0 || fromIdx >= seq.length || toIdx >= seq.length) return;
      const [moved] = seq.splice(fromIdx, 1);
      seq.splice(toIdx, 0, moved);

      const targetPoint = builderResult.points.find((p) =>
        p.candidate?.key === builderSelectedKey ||
        p.selectedCandidateOverride?.key === builderSelectedKey ||
        p.allCombinations?.some((c) => c.key === builderSelectedKey)
      );
      if (!targetPoint) return;

      const editedCandidate = evaluateBuilderSequence(
        builderResult.strategyCfg,
        seq,
        builderResult.totalRiskAmount,
        builderResult.baseMode === "fno",
        targetPoint.targetWinRate
      );
      if (!editedCandidate) return;

      const nextBuilder = applyBuilderCandidateEdit(
        builderResult,
        targetPoint.targetWinRate,
        builderSelectedKey,
        editedCandidate
      );
      setBuilderResult(nextBuilder);
      setBuilderSelectedKey(editedCandidate.key);

      // editedCandidate already contains the fully recalculated result using
      // the Builder's calibrated cascade config. Reusing it keeps the trade log
      // numerically identical to the matrix/chart candidate and preserves the
      // same risk-per-lot / Price Chg invariant as the source strategy.
      setResult({ ...editedCandidate.result, winLossSeq: seq });
      lastCleanCfgRef.current = editedCandidate.autoStrategyCfg || builderResult.strategyCfg;
      lastRunModeRef.current = builderResult.baseMode;
      const nextLabel = `Combination · ${formatBuilderWinRate(editedCandidate.actualWinRate)} WR · ${editedCandidate.tradeCount} trades · edited sequence`;
      setActiveRunLabel(nextLabel);
      setSelectedBatchRunIdx(null);
      builderWorkspaceRef.current = {
        cfg: { ...cfg },
        result: { ...editedCandidate.result, winLossSeq: seq },
        builderResult: nextBuilder,
        builderSelectedKey: editedCandidate.key,
        activeRunLabel: nextLabel,
        batchResult: null,
        selectedBatchRunIdx: null,
        cleanCfg: { ...(editedCandidate.autoStrategyCfg || builderResult.strategyCfg) },
        baseMode: builderResult.baseMode,
        sourceSignature: builderSourceSignature(
        strategyWorkspaceRef.current[builderResult.baseMode]?.cfg || cfg,
        builderResult.baseMode
      ),
      sourceRiskAllocationSignature: builderRiskAllocationSignature(
        strategyWorkspaceRef.current[builderResult.baseMode]?.cfg || cfg
      ),
      };
    },
    [result, builderResult, builderSelectedKey, cfg]
  );

  // Moves the trade at fromIdx to toIdx within the underlying win/loss
  // sequence, then re-runs the exact same cascade (same cfg used for the
  // last Single Run) on that reordered sequence so lots, risk, capital,
  // instrument price and the equity curve all recalculate around the new order.
  const reorderTrades = useCallback(
    (fromIdx, toIdx) => {
      if (
        fromIdx === null ||
        toIdx === null ||
        fromIdx === toIdx ||
        !result ||
        !lastCleanCfgRef.current
      )
        return;
      const seq = [...result.winLossSeq];
      const [moved] = seq.splice(fromIdx, 1);
      seq.splice(toIdx, 0, moved);
      const simulateFn =
        lastRunModeRef.current === "fno" ? simulateFromSequenceFnO : simulateFromSequence;
      const recalculated = simulateFn(lastCleanCfgRef.current, seq);
      setResult({ ...recalculated, winLossSeq: seq });
      const match = matchBatchRun(recalculated);
      const nextActiveRunLabel = match ? `Scenario : ${match.index}` : null;
      const nextSelectedBatchRunIdx = match ? match.index : null;
      setActiveRunLabel(nextActiveRunLabel);
      setSelectedBatchRunIdx(nextSelectedBatchRunIdx);
      setScenarioInput(match ? String(match.index) : "");

      if (lastRunModeRef.current === "single" || lastRunModeRef.current === "fno") {
        strategyWorkspaceRef.current[lastRunModeRef.current] = {
          ...strategyWorkspaceRef.current[lastRunModeRef.current],
          cfg: { ...(lastCleanCfgRef.current || cfg) },
          result: { ...recalculated, winLossSeq: seq },
          cleanCfg: lastCleanCfgRef.current ? { ...lastCleanCfgRef.current } : null,
          activeRunLabel: nextActiveRunLabel,
          batchResult,
          selectedBatchRunIdx: nextSelectedBatchRunIdx,
          scenarioInput: match ? String(match.index) : "",
        };
      }
    },
    [result, matchBatchRun]
  );

  // Flips the WIN/LOSS outcome of the trade at idx within the underlying
  // win/loss sequence, then re-runs the exact same cascade (same cfg used
  // for the last run) on that edited sequence — same recalculation path as
  // reorderTrades, just with one entry flipped instead of moved. Also syncs
  // the Win Rate % field in Configuration to the sequence's new actual win
  // rate, so the config panel never shows a stale number after an edit.
  const toggleTradeResult = useCallback(
    (idx) => {
      if (!result || !lastCleanCfgRef.current) return;
      const seq = [...result.winLossSeq];
      seq[idx] = !seq[idx];
      const simulateFn =
        lastRunModeRef.current === "fno" ? simulateFromSequenceFnO : simulateFromSequence;
      const recalculated = simulateFn(lastCleanCfgRef.current, seq);
      setResult({ ...recalculated, winLossSeq: seq });
      const match = matchBatchRun(recalculated);
      const nextActiveRunLabel = match ? `Scenario : ${match.index}` : null;
      const nextSelectedBatchRunIdx = match ? match.index : null;
      setActiveRunLabel(nextActiveRunLabel);
      setSelectedBatchRunIdx(nextSelectedBatchRunIdx);
      setScenarioInput(match ? String(match.index) : "");
      const newWinRate = seq.length ? (seq.filter(Boolean).length / seq.length) * 100 : 0;

      if (lastRunModeRef.current === "single" || lastRunModeRef.current === "fno") {
        const nextCfg = {
          ...(lastCleanCfgRef.current || cfg),
          winRate: Number(newWinRate.toFixed(2)),
        };
        strategyWorkspaceRef.current[lastRunModeRef.current] = {
          ...strategyWorkspaceRef.current[lastRunModeRef.current],
          cfg: { ...nextCfg },
          result: { ...recalculated, winLossSeq: seq },
          cleanCfg: { ...(lastCleanCfgRef.current || nextCfg) },
          activeRunLabel: nextActiveRunLabel,
          batchResult,
          selectedBatchRunIdx: nextSelectedBatchRunIdx,
          scenarioInput: match ? String(match.index) : "",
        };
      }
      setCfg((c) => ({ ...c, winRate: Number(newWinRate.toFixed(2)) }));
    },
    [result, matchBatchRun]
  );

  const handleRowDragStart = (idx) => (e) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleRowDragOver = (idx) => (e) => {
    e.preventDefault();
    if (idx !== dragOverIdx) setDragOverIdx(idx);
  };
  const handleRowDrop = (idx) => (e) => {
    e.preventDefault();
    reorderTrades(dragIdx, idx);
    setDragIdx(null);
    setDragOverIdx(null);
  };
  const handleRowDragEnd = () => {
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const openTradeAllocation = useCallback((idx) => {
    setAllocationOpenIdx((current) => (current === idx ? null : idx));
    setAllocationScales((current) => ({
      ...current,
      [idx]: current[idx] || { risk: 100 },
    }));
  }, []);

  const updateAllocationScale = useCallback((idx, value) => {
    const v = Math.min(100, Math.max(0, Number(value) || 0));
    setAllocationScales((current) => ({
      ...current,
      [idx]: { risk: v },
    }));
  }, []);

  const showPriceCol = mode === "single" && lastCleanCfgRef.current?.feeMode === "turnover";
  const isFnoResult = mode === "fno" && lastRunModeRef.current === "fno";
  const isFnoIntraday = lastCleanCfgRef.current?.fnoSegment === "intraday";

  // Trade Log renders every trade in full (no inner scroll) up to 100 rows;
  // past that, the log gets a fixed height and scrolls internally so a big
  // run doesn't turn the whole page into one giant table.
  const TRADE_LOG_VISIBLE_ROWS = 100;
  const TRADE_LOG_ROW_PX = 34; // approx row height for this compact font-mono table
  const tradeLogMaxHeightPx =
    result && result.trades.length > TRADE_LOG_VISIBLE_ROWS
      ? TRADE_LOG_VISIBLE_ROWS * TRADE_LOG_ROW_PX
      : null;

  let sweepChartData = [];
  let sweepBest = null;
  let sweepWorst = null;
  let winRateRR = null;
  let winRatePoint0 = null;
  let winRatePoint100 = null;
  if (sweep) {
    sweepChartData = sweep.points.map((p) => ({
      wr: p.winRate,
      wrLabel: p.winRate + "%",
      avgReturnPct: Number(p.avgReturnPct.toFixed(2)),
      profitableRate: Number(p.profitableRate.toFixed(1)),
      medianRecovery: p.medianDDRecoveryTrades == null ? null : Number(p.medianDDRecoveryTrades.toFixed(2)),
      p90Recovery: p.p90DDRecoveryTrades == null ? null : Number(p.p90DDRecoveryTrades.toFixed(2)),
    }));
    sweepBest = sweep.points.reduce((a, b) => (b.avgReturnPct > a.avgReturnPct ? b : a), sweep.points[0]);
    sweepWorst = sweep.points.reduce((a, b) => (b.avgReturnPct < a.avgReturnPct ? b : a), sweep.points[0]);
    // Risk:Reward implied by the two ends of the win-rate spectrum — the
    // return at 0% win rate (the pure-loss case, i.e. the "risk") against
    // the return at 100% win rate (the pure-win case, i.e. the "reward").
    winRatePoint0 = sweep.points.find((p) => p.winRate === 0) || sweep.points[0];
    winRatePoint100 = sweep.points.find((p) => p.winRate === 100) || sweep.points[sweep.points.length - 1];
    const riskMag = Math.abs(winRatePoint0.avgReturnPct);
    const rewardMag = Math.abs(winRatePoint100.avgReturnPct);
    winRateRR = riskMag > 0 ? rewardMag / riskMag : rewardMag > 0 ? Infinity : 0;
  }


  const bankrollSourceCfg = bankrollBaseMode === "fno"
    ? (strategyWorkspaceRef.current.fno?.cfg || DEFAULTS)
    : (strategyWorkspaceRef.current.single?.cfg || DEFAULTS);

  const handleRunBankroll = useCallback(async () => {
    setBankrollError("");

    // Snapshot the source configuration once at the start of a run. This keeps
    // every repeat internally consistent even if the user changes a different
    // page while a long bankroll calculation is still running.
    const source = cleanConfig(bankrollSourceCfg || DEFAULTS);
    const baseMode = bankrollBaseMode === "fno" ? "fno" : "single";
    const requestedRunCount = Math.min(2000, Math.max(20, Math.round(Number(bankrollRuns) || 200)));
    const tradeCount = Math.min(1000, Math.max(1, Math.round(Number(bankrollTrades) || 100)));
    const requestedCycles = Math.min(1000, Math.max(1, Math.round(Number(bankrollCycles) || 100)));

    if (baseMode === "fno") {
      if (!source.initialCapital) {
        setBankrollError("Initial Capital must be greater than 0.");
        return;
      }
      if (source.fnoSegment === "intraday" && !source.fnoQuantity) {
        setBankrollError("Day / F&O Intraday requires a valid Quantity.");
        return;
      }
      if (source.fnoSegment !== "intraday" && (!source.fnoLots || !source.fnoLotSize)) {
        setBankrollError("Day / F&O Options/Futures requires valid Lots and Lot Size.");
        return;
      }
    } else if (!source.initialCapital || !source.baseLots) {
      setBankrollError("Single Run requires Initial Capital and Base Lots greater than 0.");
      return;
    }

    // Keep the browser responsive by yielding between small simulation chunks.
    // The default 200 × 100 × 100 still represents the full requested workload
    // (2,000,000 core trade evaluations) rather than silently changing the model.
    const maxCoreEvaluations = 2000000;
    const perCycleEvaluations = Math.max(1, requestedRunCount * tradeCount);
    const runCount = Math.min(requestedRunCount, Math.max(20, Math.floor(300000 / tradeCount)));
    const actualCycles = Math.min(
      requestedCycles,
      Math.max(1, Math.floor(maxCoreEvaluations / Math.max(1, runCount * tradeCount)))
    );
    const chunkRuns = Math.max(5, Math.min(25, Math.floor(10000 / Math.max(1, tradeCount))));

    const bankrollCfg = { ...source, numTrades: tradeCount };
    // Resolve the selected core engine once for the entire bankroll run so the
    // same simulator function is available both in the main cycles and in
    // the later risk-sensitivity replay.
    const runFn = baseMode === "fno" ? simulateFromSequenceFnO : simulateFromSequence;
    setBankrollRunning(true);
    setBankrollProgress({ done: 0, total: actualCycles });

    const yieldToBrowser = () => new Promise((resolve) => setTimeout(resolve, 0));
    let representativeRuns = null;
    let representativeSequences = null;
    let pathAccumulator = Array.from({ length: tradeCount + 1 }, () => ({ p10: 0, p25: 0, median: 0, p75: 0, p90: 0, count: 0 }));
    const allFinalValues = [];
    const allReturns = [];
    const allDrawdowns = [];
    const allStreaks = [];
    let pooledProfitableCount = 0;
    let pooledRuinedCount = 0;
    let pooledStoppedCount = 0;
    let pooledTradesExecuted = 0;
    const recoveryAccumulator = emptyRecoveryAccumulator();
    const breakEvenAccumulator = emptyBreakEvenAccumulator();

    try {
      for (let cycle = 0; cycle < actualCycles; cycle++) {
        const sequences = Array.from({ length: runCount }, () => buildBernoulliWinLossSeq(tradeCount, bankrollCfg.winRate));
        const cycleRuns = [];

        // Chunk the synchronous core work so the React page can paint progress.
        for (let start = 0; start < runCount; start += chunkRuns) {
          const end = Math.min(runCount, start + chunkRuns);
          for (let idx = start; idx < end; idx++) {
            const seq = sequences[idx];
            const sim = runFn(bankrollCfg, seq);
            const capitalPath = [
              bankrollCfg.initialCapital,
              ...(sim.trades || []).map((t) => Number(t.capital) || bankrollCfg.initialCapital),
            ];
            const minCapital = Math.min(...capitalPath);
            const executedSeq = (sim.trades || [])
              .map((t, i) => (typeof t.win === "boolean" ? t.win : !!seq[i]))
              .slice(0, sim.trades?.length || 0);
            const longestStreak = longestLossStreak(executedSeq);
            const recovery = analyzeDrawdownRecovery(sim.trades || [], bankrollCfg.initialCapital);
            cycleRuns.push({
              index: idx + 1,
              winLossSeq: seq,
              result: sim,
              capitalPath,
              minCapital,
              ruined: minCapital <= bankrollCfg.initialCapital * (1 - Number(bankrollRuinDD || 80) / 100),
              longestLossStreak: longestStreak,
              recovery,
            });
          }
          await yieldToBrowser();
        }

        if (!representativeRuns) {
          representativeRuns = cycleRuns;
          representativeSequences = sequences;
        }

        for (let t = 0; t <= tradeCount; t++) {
          const vals = cycleRuns.map((r) => r.capitalPath[t]).filter((v) => Number.isFinite(v));
          if (!vals.length) continue;
          const point = {
            p10: percentileValue(vals, 0.10),
            p25: percentileValue(vals, 0.25),
            median: percentileValue(vals, 0.50),
            p75: percentileValue(vals, 0.75),
            p90: percentileValue(vals, 0.90),
          };
          pathAccumulator[t].p10 += point.p10;
          pathAccumulator[t].p25 += point.p25;
          pathAccumulator[t].median += point.median;
          pathAccumulator[t].p75 += point.p75;
          pathAccumulator[t].p90 += point.p90;
          pathAccumulator[t].count += 1;
        }

        cycleRuns.forEach((r) => {
          const finalValue = Number(r.result.finalCapital) || bankrollCfg.initialCapital;
          const returnPct = bankrollCfg.initialCapital > 0
            ? (Number(r.result.netPL) || 0) / bankrollCfg.initialCapital * 100
            : 0;
          const dd = Number(r.result.maxDD) || 0;
          allFinalValues.push(finalValue);
          allReturns.push(returnPct);
          allDrawdowns.push(dd);
          allStreaks.push(r.longestLossStreak);
          if (r.result.netPL > 0) pooledProfitableCount += 1;
          if (r.ruined) pooledRuinedCount += 1;
          addRecoveryToAccumulator(recoveryAccumulator, r.recovery);
          addBreakEvenToAccumulator(breakEvenAccumulator, analyzeBreakEvenRecovery(r.result?.trades || [], bankrollCfg.initialCapital));
          if (r.result.stopped) pooledStoppedCount += 1;
          pooledTradesExecuted += r.result.trades?.length || 0;
        });

        setBankrollProgress({ done: cycle + 1, total: actualCycles });
        await yieldToBrowser();
      }

      const totalOutcomes = Math.max(1, allFinalValues.length);
      const meanFinal = allFinalValues.reduce((a, b) => a + b, 0) / totalOutcomes;
      const meanReturn = allReturns.reduce((a, b) => a + b, 0) / totalOutcomes;
      const meanDD = allDrawdowns.reduce((a, b) => a + b, 0) / totalOutcomes;
      const ruinCI = wilsonInterval(pooledRuinedCount, totalOutcomes);

      // Use one shared chart-data array for percentile lines + representative
      // paths. This is more reliable than supplying a separate data array to
      // every Recharts <Line>, and fixes the previously flat/blank Capital Paths.
      const representativePathCount = Math.min(24, representativeRuns?.length || 0);
      const representativePathSeries = (representativeRuns || []).slice(0, representativePathCount).map((r, idx) => ({
        key: `path_${idx}`,
        final: Number(r.result.finalCapital) || bankrollCfg.initialCapital,
        selected: idx === 0,
        label: `Run ${r.index}`,
      }));
      const pathChartData = pathAccumulator.map((a, trade) => {
        const row = {
          trade,
          p10: a.count ? a.p10 / a.count : null,
          p25: a.count ? a.p25 / a.count : null,
          median: a.count ? a.median / a.count : null,
          p75: a.count ? a.p75 / a.count : null,
          p90: a.count ? a.p90 / a.count : null,
        };
        representativePathSeries.forEach((series, idx) => {
          const r = representativeRuns[idx];
          row[series.key] = trade < r.capitalPath.length ? r.capitalPath[trade] : null;
        });
        row.bandBase = row.p10;
        row.bandWidth = row.p10 != null && row.p90 != null ? Math.max(0, row.p90 - row.p10) : null;
        return row;
      });

      const sensitivityLevels = [0.50, 0.75, 1, 1.25, 1.50, 2, 2.50];
      const sensitivityRuns = Math.min((representativeSequences || []).length, 100);
      const sensitivity = sensitivityLevels.map((multiplier) => {
        const scaledCfg = scaleBankrollConfig(bankrollCfg, baseMode, multiplier);
        const sims = (representativeSequences || []).slice(0, sensitivityRuns).map((seq) => runFn(scaledCfg, seq));
        const sensFinals = sims.map((r) => r.finalCapital);
        const sensDD = sims.map((r) => r.maxDD);
        const ruined = sims.filter((r) => {
          const path = [scaledCfg.initialCapital, ...(r.trades || []).map((t) => Number(t.capital) || scaledCfg.initialCapital)];
          return Math.min(...path) <= scaledCfg.initialCapital * (1 - Number(bankrollRuinDD || 80) / 100);
        }).length;
        const prof = sims.filter((r) => r.netPL > 0).length;
        const baseRiskPct = scaledCfg.riskPct;
        return {
          multiplier,
          riskPct: baseRiskPct,
          riskLabel: `${baseRiskPct.toFixed(2)}%`,
          ruinPct: sims.length ? (ruined / sims.length) * 100 : 0,
          medianFinal: percentileValue(sensFinals, 0.5),
          p90DD: percentileValue(sensDD, 0.9),
          profitablePct: sims.length ? (prof / sims.length) * 100 : 0,
        };
      });

      const overallStats = {
        total: totalOutcomes,
        profitablePct: (pooledProfitableCount / totalOutcomes) * 100,
        survivalPct: ((totalOutcomes - pooledRuinedCount) / totalOutcomes) * 100,
        ruinPct: (pooledRuinedCount / totalOutcomes) * 100,
        ruinCI: { low: ruinCI.low * 100, high: ruinCI.high * 100 },
        meanFinal,
        medianFinal: percentileValue(allFinalValues, 0.50),
        p10Final: percentileValue(allFinalValues, 0.10),
        p90Final: percentileValue(allFinalValues, 0.90),
        meanDD,
        medianDD: percentileValue(allDrawdowns, 0.50),
        p90DD: percentileValue(allDrawdowns, 0.90),
        worstDD: Math.max(0, ...allDrawdowns),
        medianLossStreak: percentileValue(allStreaks, 0.50),
        p90LossStreak: percentileValue(allStreaks, 0.90),
        worstLossStreak: Math.max(0, ...allStreaks),
        meanReturn,
        stoppedCount: pooledStoppedCount,
        avgTradesExecuted: pooledTradesExecuted / totalOutcomes,
        ruinedCount: pooledRuinedCount,
      };
      const recoverySummary = finalizeRecoveryAccumulator(recoveryAccumulator);
      const breakEvenRecoverySummary = finalizeBreakEvenAccumulator(breakEvenAccumulator);

      const next = {
        sourceCfg: bankrollCfg,
        baseMode,
        runs: representativeRuns || [],
        runsPerBankroll: runCount,
        totalBankrollCycles: actualCycles,
        requestedBankrollCycles: requestedCycles,
        pooledRunsCount: totalOutcomes,
        tradesPerRun: tradeCount,
        ruinDD: Number(bankrollRuinDD || 80),
        pathChartData,
        pathSeries: representativePathSeries,
        riskSensitivity: sensitivity,
        recoverySummary,
        breakEvenRecoverySummary,
        finalBins: makeDistributionBins(allFinalValues, 12),
        ddBins: makeDistributionBins(allDrawdowns, 12),
        streakBins: makeDistributionBins(allStreaks, 12),
        overallStats,
        stats: overallStats,
        note: actualCycles < requestedCycles
          ? `Workload cap limited the requested ${requestedCycles} bankroll repeats to ${actualCycles}.`
          : null,
      };
      setBankrollResult(next);
      setBankrollProgress({ done: actualCycles, total: actualCycles });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown bankroll simulation error.";
      setBankrollError(`Bankroll run failed: ${message}`);
    } finally {
      setBankrollRunning(false);
    }
  }, [bankrollSourceCfg, bankrollBaseMode, bankrollRuns, bankrollCycles, bankrollTrades, bankrollRuinDD]);

  const builderDisplayCandidate = builderResult
    ? (builderResult.points.flatMap((p) => p.allCombinations || []).find((c) => c.key === builderSelectedKey)
        || builderResult.bestReturnPoint?.candidate
        || null)
    : null;

  return (
    <div className="min-h-screen bg-[#0a0b0d] text-zinc-100 font-sans text-sm relative overflow-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        html { overflow-y: scroll; scrollbar-gutter: stable; }
        .font-sans { font-family: 'Space Grotesk', ui-sans-serif, system-ui, -apple-system, sans-serif !important; }
        .font-mono { font-family: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace !important; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
        .scenario-count-input::-webkit-outer-spin-button,
        .scenario-count-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .scenario-count-input { -moz-appearance: textfield; }
        .scenario-inspect-input::-webkit-outer-spin-button,
        .scenario-inspect-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .scenario-inspect-input { -moz-appearance: textfield; }
      `}</style>
      {/* structural background: faint grid + single restrained vignette, no decorative color blobs */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 900px 500px at 50% -10%, rgba(161,161,170,0.08), transparent 60%)" }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pb-16">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-5 sm:py-6 mb-5 sm:mb-6 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-zinc-800 border border-zinc-700 text-zinc-300 text-base flex-none">
              &#9670;
            </div>
            <div className="min-w-0">
              <div className="text-sm sm:text-base font-semibold tracking-tight truncate">Risk Simulator</div>
              <div className="text-[10px] sm:text-[11px] font-mono text-zinc-500 truncate">
                Find Your Strategy Edge
              </div>
            </div>
          </div>
          <div className="grid grid-cols-5 sm:flex bg-zinc-900/60 border border-zinc-800 rounded-lg p-1 w-full sm:w-auto">
            {["single", "sweep", "fno", "builder", "bankroll"].map((m) => (
              <button
                key={m}
                onClick={() => handleModeChange(m)}
                className={`px-3 sm:px-4 py-2 sm:py-1.5 text-[11px] sm:text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  mode === m ? "bg-zinc-100 text-zinc-900" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>
        </div>

        {/* Fixed two-column layout: config left (fixed width), results right (fills remaining space) */}
        <div className="flex flex-row gap-5 items-start overflow-x-auto">
          {/* Config column */}
          <aside className={`${mode === "bankroll" ? "hidden" : `${CARD} w-80 shrink-0 self-start p-4 sm:p-5`}`}>
            <div className="flex items-center gap-2 mb-4">
              <Settings2 size={16} className="text-zinc-300" />
              <span className="text-[15px] font-semibold text-zinc-100">Configuration</span>
            </div>

            {mode === "builder" && (
              <BuilderConfig
                cfg={cfg}
                strategyCfg={cleanConfig({ ...cfg, initialCapital: cfg.builderInitialCapital })}
                baseMode={strategyBaseMode}
                autoCandidate={builderDisplayCandidate}
                onChange={setBuilderField}
                onBuild={handleBuilderRun}
                hasResult={!!builderResult}
                builderBuilding={builderBuilding}
              />
            )}

            {mode === "sweep" && (
              <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/25">
                <Layers size={12} className="text-indigo-400 flex-none" />
                <span className="text-[11px] font-mono text-indigo-300 leading-snug">
                  Sweeping{" "}
                  <b>
                    {effectiveMode === "fno"
                      ? `Day / F&O — ${cfg.fnoBroker} · ${cfg.fnoSegment}`
                      : "Single Run"}
                  </b>{" "}
                  config
                </span>
              </div>
            )}

            <div className={mode === "builder" ? "hidden" : ""}>
              {effectiveMode === "fno" && (
                <div className="mb-5">
                  <GroupTitle icon={Layers} color="blue">Segment</GroupTitle>
                  <div className="flex bg-zinc-800/40 border border-zinc-700/50 rounded-lg p-1 mb-1">
                    {["intraday", "options", "futures"].map((sg) => (
                      <button
                        key={sg}
                        onClick={() => updateFnoBrokerSegment({ fnoSegment: sg })}
                        className={`flex-1 py-1.5 rounded-md text-xs font-mono transition-colors capitalize ${
                          cfg.fnoSegment === sg ? "bg-blue-500/20 text-blue-300" : "text-zinc-500"
                        }`}
                      >
                        {sg}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-5">
                <GroupTitle icon={DollarSign} color="blue">Capital &amp; Base Risk</GroupTitle>
                <Field label="Initial Capital">
                  <NumInput value={cfg.initialCapital} onChange={setField("initialCapital")} color="blue" />
                </Field>
                {effectiveMode === "fno" ? (
                  <>
                    {cfg.fnoSegment === "intraday" ? (
                      <Field label="Quantity" hint="whole shares">
                        <NumInput value={cfg.fnoQuantity} onChange={setField("fnoQuantity")} step="1" color="blue" />
                      </Field>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-2.5">
                          <Field label="Lots">
                            <NumInput value={cfg.fnoLots} onChange={setField("fnoLots")} step="1" color="blue" />
                          </Field>
                          <Field label="Lot Size">
                            <NumInput value={cfg.fnoLotSize} onChange={setField("fnoLotSize")} step="1" color="blue" />
                          </Field>
                        </div>
                        <div className="text-[10px] font-mono text-zinc-600 -mt-1 mb-3">
                          = {(Math.max(1, Math.round(Number(cfg.fnoLots) || 1)) * Math.max(1, Math.round(Number(cfg.fnoLotSize) || 1))).toLocaleString("en-IN")} qty
                        </div>
                      </>
                    )}
                    <Field label="Base Risk %">
                      <NumInput value={cfg.riskPct} onChange={setField("riskPct")} step="0.1" color="blue" />
                    </Field>
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    <Field label="Base Lots">
                      <NumInput value={cfg.baseLots} onChange={setField("baseLots")} step="0.01" color="blue" />
                    </Field>
                    <Field label="Base Risk %">
                      <NumInput value={cfg.riskPct} onChange={setField("riskPct")} step="0.1" color="blue" />
                    </Field>
                  </div>
                )}
                <div className="mb-3">
                  <div className="flex items-baseline justify-between mb-1.5">
                    <label className="text-xs text-zinc-400">Reward:Risk Model</label>
                    <span className="text-[10px] text-zinc-600">winning trades</span>
                  </div>
                  <div className="flex bg-zinc-800/40 border border-zinc-700/50 rounded-lg p-1 mb-2.5">
                    {["fixed", "range"].map((rm) => (
                      <button
                        key={rm}
                        type="button"
                        onClick={() => setCfg((c) => ({ ...c, rrMode: rm }))}
                        className={`flex-1 py-1.5 rounded-md text-xs font-mono transition-colors ${
                          cfg.rrMode === rm ? "bg-blue-500/20 text-blue-300" : "text-zinc-500"
                        }`}
                      >
                        {rm === "fixed" ? "Fixed" : "Range"}
                      </button>
                    ))}
                  </div>
                  {cfg.rrMode === "range" ? (
                    <div className="grid grid-cols-2 gap-2.5">
                      <Field label="Min RR">
                        <NumInput value={cfg.rrMin} onChange={setField("rrMin")} step="0.1" min="0" color="blue" />
                      </Field>
                      <Field label="Max RR">
                        <NumInput value={cfg.rrMax} onChange={setField("rrMax")} step="0.1" min="0" color="blue" />
                      </Field>
                    </div>
                  ) : (
                    <Field label="Reward:Risk">
                      <NumInput value={cfg.rr} onChange={setField("rr")} step="0.1" min="0" color="blue" />
                    </Field>
                  )}
                  {cfg.rrMode === "range" && (
                    <div className="text-[10px] text-zinc-600 leading-relaxed -mt-1">
                      Each trade receives a bounded random RR. Middle-of-range outcomes are more common than the extremes.
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-5 min-w-0">
                <GroupTitle icon={BarChart2} color="violet">Risk Allocation</GroupTitle>

                <button
                  type="button"
                  onClick={() => setRiskAllocationOpen((v) => !v)}
                  className="w-full min-w-0 flex items-center justify-between gap-2 rounded-lg border border-zinc-700/60 bg-zinc-900/55 px-3 py-2.5 text-left hover:bg-zinc-900/75 transition-colors"
                  aria-expanded={riskAllocationOpen}
                >
                  <span className="min-w-0 flex items-center gap-2">
                    <span className="shrink-0 text-[11px] font-medium text-zinc-300">Mode</span>
                    <span className="min-w-0 truncate text-[11px] sm:text-xs font-mono font-semibold text-violet-200">
                      {riskAllocationModeLabel(cfg.cascadeMode)}
                    </span>
                  </span>
                  <ChevronDown size={14} className={`shrink-0 text-zinc-400 transition-transform ${riskAllocationOpen ? "rotate-180" : ""}`} />
                </button>

                {riskAllocationOpen && (
                  <div className="mt-2 min-w-0 rounded-lg border border-zinc-700/55 bg-zinc-900/35 p-2.5 sm:p-3">
                    <div className="grid grid-cols-2 gap-2 min-w-0">
                      {RISK_ALLOCATION_MODES.map((cm) => {
                        const active = cfg.cascadeMode === cm;
                        return (
                          <button
                            key={cm}
                            type="button"
                            onClick={() => {
                              setCfg((c) => ({ ...c, cascadeMode: cm }));
                              setRiskAllocationOpen(false);
                            }}
                            className={`min-w-0 min-h-[38px] w-full px-2 rounded-md border text-[9px] sm:text-[10px] leading-tight font-mono font-medium text-center break-words transition-colors ${
                              active
                                ? "bg-violet-500/15 text-violet-200 border-violet-500/40"
                                : "text-zinc-300 border-zinc-700/55 bg-zinc-800/30 hover:bg-zinc-800/60 hover:text-white"
                            }`}
                          >
                            {riskAllocationModeLabel(cm)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="mt-2 min-w-0 rounded-lg border border-zinc-700/55 bg-zinc-900/45 p-2.5 sm:p-3 overflow-hidden">
                  <div className="min-w-0 rounded-md border border-violet-500/20 bg-violet-500/[0.045] px-2.5 py-2 mb-2.5 overflow-hidden">
                    <div className="text-[10px] sm:text-[11px] font-semibold text-violet-200 truncate">
                      {riskAllocationModeLabel(cfg.cascadeMode)}
                    </div>
                    <div className="mt-1 text-[9px] sm:text-[10px] leading-relaxed text-zinc-300 break-words whitespace-normal">
                      {cfg.cascadeMode === "profit"
                        ? "Sizes from usable previous profit."
                        : cfg.cascadeMode === "profitCumulative"
                        ? "WIN → cumulative net profit × allocation; LOSS → previous risk × adjustment."
                        : "Sizes from current capital."}
                    </div>
                  </div>

                  <div className="min-w-0">
                    {cfg.cascadeMode === "profitCumulative" ? (
                      <>
                        <div className="grid grid-cols-2 gap-2 min-w-0">
                          <div className="min-w-0">
                            <Field label="Profit Allocation %">
                              <NumInput value={cfg.profitCumulativeAllocationPct} onChange={setField("profitCumulativeAllocationPct")} step="1" min="0" max="100" color="violet" />
                            </Field>
                          </div>
                          <div className="min-w-0">
                            <Field label="Loss Adjustment %">
                              <NumInput value={cfg.profitCumulativeLossAdjustPct} onChange={setField("profitCumulativeLossAdjustPct")} step="1" min="-95" max="100" color="violet" />
                            </Field>
                          </div>
                          <div className="min-w-0">
                            <Field label="Flip After Losses">
                              <NumInput value={cfg.profitCumulativeFlipAfterLosses} onChange={setField("profitCumulativeFlipAfterLosses")} step="1" min="1" color="violet" />
                            </Field>
                          </div>
                        </div>
                        <div className="mt-2 min-w-0 rounded-md border border-violet-500/20 bg-zinc-950/30 px-2.5 py-2 text-[9px] sm:text-[10px] leading-relaxed text-zinc-300 break-words whitespace-normal overflow-hidden">
                          <span className="text-emerald-300">WIN:</span> next risk = cumulative net profit × allocation %. <span className="text-orange-300">LOSS:</span> next risk = previous executed risk × adjustment. After the configured loss count, the adjustment sign flips for the next trade. A WIN resets the loss/flip state, not cumulative profit.
                        </div>
                      </>
                    ) : (cfg.cascadeMode === "profit" || cfg.cascadeMode === "capital") ? (
                      <div className="grid grid-cols-2 gap-2 min-w-0">
                        <div className="min-w-0"><Field label="Win Risk %"><NumInput value={cfg.winRiskPct} onChange={setField("winRiskPct")} step="0.1" color="violet" /></Field></div>
                        <div className="min-w-0"><Field label="Loss Risk %"><NumInput value={cfg.lossRiskPct} onChange={setField("lossRiskPct")} step="0.1" color="violet" /></Field></div>
                        <div className="min-w-0"><Field label="Incr / Decr %"><NumInput value={cfg.lossRiskAdjustPct} onChange={setField("lossRiskAdjustPct")} step="0.1" color="violet" /></Field></div>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-2.5 min-w-0 rounded-lg border border-violet-500/20 bg-zinc-950/30 p-2.5 overflow-hidden">
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <div className="min-w-0">
                        <div className="text-[10px] sm:text-[11px] font-semibold text-zinc-200">Risk Allocation Reset</div>
                        <div className="text-[9px] sm:text-[10px] text-zinc-300 mt-0.5 leading-relaxed break-words whitespace-normal">Applies after the calculated allocation reaches the trigger.</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCfg((c) => ({ ...c, riskAllocationEnabled: !c.riskAllocationEnabled }))}
                        className={`shrink-0 px-2.5 py-1 rounded-md text-[9px] font-mono border transition-colors ${
                          cfg.riskAllocationEnabled
                            ? "bg-violet-500/15 text-violet-300 border-violet-500/30"
                            : "bg-zinc-800/70 text-zinc-400 border-zinc-700/60"
                        }`}
                      >
                        {cfg.riskAllocationEnabled ? "ON" : "OFF"}
                      </button>
                    </div>
                    {cfg.riskAllocationEnabled && (
                      <div className="grid grid-cols-2 gap-2 mt-2 min-w-0">
                        <div className="min-w-0"><Field label="Trigger (% Initial)"><NumInput value={cfg.riskAllocationTriggerPct} onChange={setField("riskAllocationTriggerPct")} step="1" min="0" color="violet" /></Field></div>
                        <div className="min-w-0"><Field label="Reset To (% Initial)"><NumInput value={cfg.riskAllocationResetPct} onChange={setField("riskAllocationResetPct")} step="1" min="0" color="violet" /></Field></div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mb-5">
                <GroupTitle icon={Percent} color="teal">Costs</GroupTitle>

                {effectiveMode === "fno" ? (
                  <>
                    <div className="grid grid-cols-2 gap-1.5 mb-2.5">
                      {["groww", "dhan", "upstox", "custom"].map((bk) => (
                        <button
                          key={bk}
                          onClick={() => updateFnoBrokerSegment({ fnoBroker: bk })}
                          className={`py-1.5 rounded-md text-xs font-mono capitalize transition-colors border ${
                            cfg.fnoBroker === bk
                              ? "bg-teal-500/20 text-teal-300 border-teal-500/40"
                              : "text-zinc-500 border-zinc-700/50 bg-zinc-800/40"
                          }`}
                        >
                          {bk}
                        </button>
                      ))}
                    </div>

                    <Field label="Instrument Price">
                      <NumInput value={cfg.fnoCurrentPrice} onChange={setField("fnoCurrentPrice")} step="0.05" color="teal" />
                    </Field>

                    <Field label="Leverage">
                      <NumInput value={cfg.fnoLeverage} onChange={setField("fnoLeverage")} step="1" color="teal" />
                    </Field>

                    {cfg.fnoBroker === "custom" ? (
                      <>
                        <div className="flex bg-zinc-800/40 border border-zinc-700/50 rounded-lg p-1 mb-2.5">
                          {["fixed", "turnover"].map((fm) => (
                            <button
                              key={fm}
                              onClick={() => setCfg((c) => ({ ...c, fnoFeeMode: fm }))}
                              className={`flex-1 py-1.5 rounded-md text-xs font-mono transition-colors ${
                                cfg.fnoFeeMode === fm ? "bg-teal-500/20 text-teal-300" : "text-zinc-500"
                              }`}
                            >
                              {fm === "fixed" ? "Fixed" : "Turnover"}
                            </button>
                          ))}
                        </div>

                        {cfg.fnoFeeMode === "turnover" ? (
                          <Field label="Fee %">
                            <NumInput value={cfg.fnoFeeTurnoverPct} onChange={setField("fnoFeeTurnoverPct")} step="0.001" color="teal" />
                          </Field>
                        ) : (
                          <Field label="Fixed Fee">
                            <NumInput value={cfg.fnoFixedFee} onChange={setField("fnoFixedFee")} step="1" color="teal" />
                          </Field>
                        )}
                      </>
                    ) : (
                      <div className="mb-3 px-3 py-2.5 rounded-lg bg-teal-500/[0.06] border border-teal-500/20">
                        {cfg.fnoBrokerageType === "flat" && (
                          <Field label="Fee per Order" hint=" · round trip = 2 orders">
                            <NumInput
                              value={cfg.fnoBrokerageFlatPerOrder}
                              onChange={setField("fnoBrokerageFlatPerOrder")}
                              step="1"
                              color="teal"
                            />
                          </Field>
                        )}

                        {cfg.fnoBrokerageType === "turnover" && (
                          <Field label="Brokerage %" hint="of total turnover">
                            <NumInput
                              value={cfg.fnoBrokerageRatePct}
                              onChange={setField("fnoBrokerageRatePct")}
                              step="0.001"
                              color="teal"
                            />
                          </Field>
                        )}

                        {cfg.fnoBrokerageType === "perLeg" && (
                          <>
                            <Field label="Brokerage %" hint="per leg">
                              <NumInput
                                value={cfg.fnoBrokerageRatePct}
                                onChange={setField("fnoBrokerageRatePct")}
                                step="0.001"
                                color="teal"
                              />
                            </Field>
                            <div className="grid grid-cols-2 gap-2.5">
                              <Field label="Min ()" hint="per-leg floor">
                                <NumInput
                                  value={cfg.fnoBrokerageMin}
                                  onChange={setField("fnoBrokerageMin")}
                                  step="1"
                                  color="teal"
                                />
                              </Field>
                              <Field label="Max ()" hint="per-leg cap">
                                <NumInput
                                  value={cfg.fnoBrokerageMax}
                                  onChange={setField("fnoBrokerageMax")}
                                  step="1"
                                  color="teal"
                                />
                              </Field>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2.5">
                      <Field label="Other Charges %">
                        <NumInput value={cfg.fnoOtherChargesPct} onChange={setField("fnoOtherChargesPct")} step="0.00001" color="teal" />
                      </Field>
                      <Field label="GST %">
                        <NumInput value={cfg.fnoGstPct} onChange={setField("fnoGstPct")} step="0.1" color="teal" />
                      </Field>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <Field label="Entry Spread">
                        <NumInput value={cfg.fnoEntrySpread} onChange={setField("fnoEntrySpread")} step="0.01" color="teal" />
                      </Field>
                      <Field label="Exit Spread">
                        <NumInput value={cfg.fnoExitSpread} onChange={setField("fnoExitSpread")} step="0.01" color="teal" />
                      </Field>
                    </div>
                  </>
                ) : (
                  <>
                <div className="flex bg-zinc-800/40 border border-zinc-700/50 rounded-lg p-1 mb-2.5">
                  {["perLot", "turnover"].map((fm) => (
                    <button
                      key={fm}
                      onClick={() => setCfg((c) => ({ ...c, feeMode: fm }))}
                      className={`flex-1 py-1.5 rounded-md text-xs font-mono transition-colors ${
                        cfg.feeMode === fm ? "bg-teal-500/20 text-teal-300" : "text-zinc-500"
                      }`}
                    >
                      {fm === "perLot" ? "Fee / Lot" : "Fee on Turnover"}
                    </button>
                  ))}
                </div>

                {cfg.feeMode === "turnover" ? (
                  <>
                    <Field label="Instrument Price">
                      <NumInput value={cfg.currentPrice} onChange={setField("currentPrice")} step="0.01" color="teal" />
                    </Field>
                    <Field label="Leverage">
                      <NumInput value={cfg.leverage} onChange={setField("leverage")} step="1" color="teal" />
                    </Field>
                    <div className="grid grid-cols-2 gap-2.5">
                      <Field label="Entry Fee %">
                        <NumInput value={cfg.entryFeeTurnoverPct} onChange={setField("entryFeeTurnoverPct")} step="0.0001" color="teal" />
                      </Field>
                      <Field label="Exit Fee %">
                        <NumInput value={cfg.exitFeeTurnoverPct} onChange={setField("exitFeeTurnoverPct")} step="0.0001" color="teal" />
                      </Field>
                    </div>
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    <Field label="Entry Fee">
                      <NumInput value={cfg.feeBaseEntry} onChange={setField("feeBaseEntry")} step="0.01" color="teal" />
                    </Field>
                    <Field label="Exit Fee">
                      <NumInput value={cfg.feeBaseExit} onChange={setField("feeBaseExit")} step="0.01" color="teal" />
                    </Field>
                  </div>
                )}
                  </>
                )}

                {effectiveMode !== "fno" && (
                  <div className="grid grid-cols-2 gap-2.5">
                    <Field label="Entry Spread">
                      <NumInput value={cfg.entrySpread} onChange={setField("entrySpread")} step="0.01" color="teal" />
                    </Field>
                    <Field label="Exit Spread">
                      <NumInput value={cfg.exitSpread} onChange={setField("exitSpread")} step="0.01" color="teal" />
                    </Field>
                  </div>
                )}

                <div className="flex bg-zinc-800/40 border border-zinc-700/50 rounded-lg p-1 mb-2.5">
                  {["percent", "ticks"].map((sm) => (
                    <button
                      key={sm}
                      onClick={() => setCfg((c) => ({ ...c, slipMode: sm }))}
                      className={`flex-1 py-1.5 rounded-md text-xs font-mono transition-colors ${
                        cfg.slipMode === sm ? "bg-teal-500/20 text-teal-300" : "text-zinc-500"
                      }`}
                    >
                      {sm === "percent" ? "% wise" : "Tick wise"}
                    </button>
                  ))}
                </div>
                {cfg.slipMode === "percent" ? (
                  <Field label="Slippage %">
                    <NumInput value={cfg.slipPct} onChange={setField("slipPct")} step="0.01" color="teal" />
                  </Field>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    <Field label="Slippage (ticks)">
                      <NumInput value={cfg.slipTicks} onChange={setField("slipTicks")} step="1" color="teal" />
                    </Field>
                    <Field label="Tick Value">
                      <NumInput value={cfg.tickValue} onChange={setField("tickValue")} step="0.01" color="teal" />
                    </Field>
                  </div>
                )}
              </div>

              <div className="mb-5">
                <GroupTitle icon={Shield} color="amber">Safety Stops</GroupTitle>
                <Field label="Per-Trade Cap %">
                  <NumInput value={cfg.perTradeCapPct} onChange={setField("perTradeCapPct")} color="amber" />
                </Field>
                <Field label="Max Risk Cap %">
                  <NumInput value={cfg.overallCapPct} onChange={setField("overallCapPct")} color="amber" />
                </Field>
              </div>

              <div className="mb-5">
                <GroupTitle icon={SlidersHorizontal} color="indigo">Simulation</GroupTitle>
                <div className="grid grid-cols-2 gap-2.5">
                  {mode !== "sweep" && (
                    <Field label="Win Rate %">
                      <NumInput value={cfg.winRate} onChange={setField("winRate")} color="indigo" />
                    </Field>
                  )}
                  <Field label="Trades">
                    <NumInput value={cfg.numTrades} onChange={setField("numTrades")} color="indigo" />
                  </Field>
                </div>
                {mode === "sweep" && (
                  <div className="grid grid-cols-2 gap-2.5">
                    <Field label="Win Rate Step %">
                      <NumInput value={cfg.sweepStep} onChange={setField("sweepStep")} color="indigo" />
                    </Field>
                    <Field label="Sample Size">
                      <NumInput value={cfg.sweepRuns} onChange={setField("sweepRuns")} step="10" color="indigo" />
                    </Field>
                  </div>
                )}
              </div>
            </div>
          </aside>

          {/* Results column */}
          <main className={`${mode === "bankroll" ? "w-full" : "min-w-0 flex-1"} space-y-4`}>
            {mode === "bankroll" && (
              <BankrollPage
                baseMode={bankrollBaseMode}
                sourceCfg={bankrollSourceCfg}
                runs={bankrollRuns}
                cycles={bankrollCycles}
                tradesPerRun={bankrollTrades}
                ruinDD={bankrollRuinDD}
                onRunsChange={(e) => setBankrollRuns(e.target.value === "" ? "" : parseInt(e.target.value, 10))}
                onCyclesChange={(e) => setBankrollCycles(e.target.value === "" ? "" : parseInt(e.target.value, 10))}
                onTradesChange={(e) => setBankrollTrades(e.target.value === "" ? "" : parseInt(e.target.value, 10))}
                onRuinDDChange={(e) => setBankrollRuinDD(e.target.value === "" ? "" : parseFloat(e.target.value))}
                onBaseModeChange={(m) => {
                  setBankrollBaseMode(m);
                  setBankrollResult(null);
                }}
                result={bankrollResult}
                onRun={handleRunBankroll}
                running={bankrollRunning}
                progress={bankrollProgress}
                error={bankrollError}
              />
            )}

            {mode === "builder" && (
              <BuilderResults
                builder={builderResult}
                selectedKey={builderSelectedKey}
                onSelectCandidate={(candidate) => selectBuilderCandidate(candidate, builderResult)}
                onReorderCombination={reorderBuilderCombination}
              />
            )}

            {mode === "builder" && result && builderResult && lastRunModeRef.current === builderResult.baseMode && (
              <BuilderTradeLog
                result={result}
                strategyCfg={lastCleanCfgRef.current}
                baseMode={builderResult.baseMode}
                activeRunLabel={activeRunLabel}
                onReorder={handleBuilderTradeReorder}
              />
            )}

            {/* Status bar */}
            {mode === "single" && result && lastRunModeRef.current === "single" && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <MiniStat label="Final Capital" value={fmtMoney(result.finalCapital)} />
                  <MiniStat
                    label="Net P/L"
                    value={fmtMoney(result.netPL)}
                    sub={fmtPct((result.netPL / cfg.initialCapital) * 100)}
                    tone={result.netPL >= 0 ? "pos" : "neg"}
                  />
                  <MiniStat label="Max Drawdown" value={fmtPct(result.maxDD)} sub={`-${fmtMoney(result.maxDDValue)}`} valueColor="#E7180B" subColor="#E7180B" />
                </div>

                <div className={`grid grid-cols-2 ${showPriceCol ? "sm:grid-cols-5" : "sm:grid-cols-4"} gap-3`}>
                  <MiniStat
                    label="Win Rate"
                    value={fmtPct(result.winRateActual)}
                    sub={`${result.winsCount}W / ${result.lossesCount}L`}
                    valueColor="#FDC745"
                  />
                  <MiniStat
                    label="Profit Factor"
                    value={isFinite(result.profitFactor) ? result.profitFactor.toFixed(2) : "∞"}
                    valueColor="#53EAFD"
                  />
                  <MiniStat
                    label="Total Lots"
                    value={result.totalLots.toFixed(2)}
                    sub={`Avg: ${result.avgLots.toFixed(2)}/trade`}
                  />
                  <MiniStat
                    label="Trades Run"
                    value={`${result.trades.length} / ${Math.round(cfg.numTrades)}`}
                    sub={result.stopped ? "stopped early" : "completed"}
                    valueColor="#FEF9C2"
                  />
                  {showPriceCol && (
                    <MiniStat
                      label="Instrument Price"
                      value={fmtMoney(result.finalPrice)}
                      sub={`from ${fmtMoney(lastCleanCfgRef.current.currentPrice)}`}
                      tone={result.finalPrice >= lastCleanCfgRef.current.currentPrice ? "pos" : "neg"}
                      valueColor="#A2F4FD"
                      subColor="#71717a"
                    />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <MiniStat label="Total Fees" value={fmtMoney(result.totalFees)} valueColor="#C4B4FF" />
                  <MiniStat
                    label="Expectancy"
                    value={`${result.expectancy >= 0 ? "+" : ""}${fmtMoney(result.expectancy)}`}
                    sub="per trade"
                    valueColor={result.expectancy >= 0 ? "#31C950" : "#FF2056"}
                  />
                </div>

                <TradeAnalyticsSection
                  trades={result.trades}
                  initialCapital={lastCleanCfgRef.current?.initialCapital ?? cfg.initialCapital}
                />

                <RecoveryTimeAnalysis
                  trades={result.trades}
                  initialCapital={lastCleanCfgRef.current?.initialCapital ?? cfg.initialCapital}
                />

                <div className={`${CARD} overflow-hidden`}>
                  <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-zinc-800">
                    <span className="flex items-center gap-2 text-[13px] font-semibold text-zinc-200">
                      <Layers size={14} className="text-zinc-300" />
                      Trade Log
                      {activeRunLabel && activeRunLabel.startsWith("Scenario :") && batchResult?.mode === (mode === "fno" ? "fno" : "single") ? (
                        <span className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px] font-mono font-normal">
                          <span>Scenario :</span>
                          <input
                            type="number"
                            min="1"
                            max={batchResult.runs.length}
                            step="1"
                            value={scenarioInput}
                            onChange={(e) => setScenarioInput(e.target.value)}
                            onBlur={commitScenarioInput}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                commitScenarioInput();
                                e.currentTarget.blur();
                              }
                            }}
                            aria-label="Scenario number"
                            title={`Enter a scenario number from 1 to ${batchResult.runs.length}`}
                            className="scenario-inspect-input w-12 bg-black/40 border border-zinc-700 rounded px-1.5 py-0.5 text-zinc-100 text-[10px] font-mono text-center outline-none focus:border-indigo-500/70 focus:ring-1 focus:ring-indigo-500/20"
                          />
                        </span>
                      ) : activeRunLabel ? (
                        <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px] font-mono font-normal">
                          {activeRunLabel}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                      <GripVertical size={12} />
                      Click a trade to open allocation. Drag to reorder, click Result to flip.
                    </span>
                  </div>
                  <div
                    className="overflow-x-auto overflow-y-auto"
                    style={tradeLogMaxHeightPx ? { maxHeight: tradeLogMaxHeightPx } : undefined}
                  >
                    <table className="w-full font-mono text-xs whitespace-nowrap">
                      <thead>
                        <tr className="bg-zinc-900 text-zinc-500 text-[10px] uppercase tracking-wide sticky top-0 z-10">
                          <th className="text-left px-3 py-2 font-medium w-8"></th>
                          <th className="text-left px-3 py-2 font-medium">No</th>
                          <th className="text-left px-3 py-2 font-medium">Result</th>
                          <th className="text-right px-3 py-2 font-medium">Risk</th>
                          <th className="text-right px-3 py-2 font-medium">RR</th>
                          <th className="text-right px-3 py-2 font-medium">Lots</th>
                          <th className="text-right px-3 py-2 font-medium">Gross P/L</th>
                          <th className="text-right px-3 py-2 font-medium">Fee</th>
                          <th className="text-right px-3 py-2 font-medium">Slippage</th>
                          <th className="text-right px-3 py-2 font-medium">Spread</th>
                          <th className="text-right px-3 py-2 font-medium">Net P/L</th>
                          <th className="text-right px-3 py-2 font-medium">Capital</th>
                          <th className="text-right px-3 py-2 font-medium">Cum. P/L</th>
                          <th className="text-right px-3 py-2 font-medium">Price Chg</th>
                          <th className="text-right px-3 py-2 font-medium">Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.trades.map((t, idx) => (
                          <React.Fragment key={`allocation-${t.n}-${idx}`}>
                          <tr
                            key={t.n}
                            draggable
                            onDragStart={handleRowDragStart(idx)}
                            onDragOver={handleRowDragOver(idx)}
                            onDrop={handleRowDrop(idx)}
                            onDragEnd={handleRowDragEnd}
                            onClick={() => { if (dragIdx === null) openTradeAllocation(idx); }}
                            className={`border-b border-zinc-800/60 hover:bg-zinc-800/20 cursor-pointer ${dragIdx !== null ? "cursor-grab active:cursor-grabbing" : ""} transition-colors ${
                              dragIdx === idx ? "opacity-40" : ""
                            } ${
                              dragOverIdx === idx && dragIdx !== idx
                                ? "bg-zinc-500/10 border-t-2 border-t-zinc-300"
                                : ""
                            }`}
                          >
                            <td className="px-3 py-1.5 text-zinc-600">
                              <GripVertical size={13} />
                            </td>
                            <td className="px-3 py-1.5 text-zinc-500">{t.n}</td>
                            <td
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleTradeResult(idx);
                              }}
                              title="Click to flip this trade's result"
                              className="px-3 py-1.5 cursor-pointer select-none hover:brightness-125 transition"
                            >
                              <TradeResultBadge win={t.win} />
                            </td>
                            <td className="px-3 py-1.5 text-right">{fmtMoney(t.risk)} {t.riskAllocationReset ? <span className="ml-1 text-[9px] text-violet-300" title="Risk Allocation Reset">RESET</span> : null}</td>
                            <td className="px-3 py-1.5 text-right text-zinc-300">{Number(t.rr ?? -1).toFixed(2)}R</td>
                            <td className="px-3 py-1.5 text-right text-[#FEF9C2]">{t.lots.toFixed(2)}</td>
                            <td className={`px-3 py-1.5 text-right ${t.grossPL >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {fmtMoney(t.grossPL)}
                            </td>
                            <td className="px-3 py-1.5 text-right text-[#C4B4FF]">{fmtMoney(t.fee)}</td>
                            <td className="px-3 py-1.5 text-right text-zinc-400">{fmtMoney(t.slip)}</td>
                            <td className="px-3 py-1.5 text-right text-zinc-400">{fmtMoney(t.spreadCost)}</td>
                            <td className={`px-3 py-1.5 text-right ${t.netPL >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {fmtMoney(t.netPL)}
                            </td>
                            <td className="px-3 py-1.5 text-right text-[#74D4FF]">{fmtMoney(t.capital)}</td>
                            <td
                              className={`px-3 py-1.5 text-right ${
                                t.capital - (lastCleanCfgRef.current?.initialCapital ?? cfg.initialCapital) >= 0
                                  ? "text-emerald-400"
                                  : "text-red-400"
                              }`}
                              style={
                                t.n === result.peakTradeIndex
                                  ? { color: "#7CFC00" }
                                  : t.n === result.troughTradeIndex
                                  ? { color: "#FF0000" }
                                  : undefined
                              }
                            >
                              {fmtMoney(t.capital - (lastCleanCfgRef.current?.initialCapital ?? cfg.initialCapital))}
                            </td>
                            <td
                              className="px-3 py-1.5 text-right"
                              style={{ color: t.price - t.entryPrice >= 0 ? "#05DF72" : "#FF692A" }}
                            >
                              {t.price - t.entryPrice >= 0 ? "+" : ""}
                              {fmtMoney(t.price - t.entryPrice)}
                            </td>
                            <td className="px-3 py-1.5 text-right text-zinc-400">{fmtMoney(t.price)}</td>
                          </tr>
                          {allocationOpenIdx === idx && (
                            <tr className="border-b border-zinc-800/60 bg-black/20">
                              <td colSpan={15} className="px-3 py-3">
                                <TradeAllocationScale
                                  trade={t}
                                  riskScale={allocationScales[idx]?.risk ?? 100}
                                  onRiskScaleChange={(value) => updateAllocationScale(idx, value)}
                                />
                              </td>
                            </tr>
                          )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {result.stopped && (
                    <div className="bg-red-500/10 border-t border-red-500/40 text-red-400 font-mono text-xs px-4 py-2.5">
                      {result.stopReason}
                    </div>
                  )}
                </div>
              </>
            )}

            {mode === "single" && (!result || lastRunModeRef.current !== "single") && (
              <div className={`${CARD} py-16 text-center text-zinc-500 text-sm`}>
                No simulation run yet.
              </div>
            )}

            {mode === "single" && (
              <>
              <BatchRunSection
                mode="single"
                cfg={cfg}
                batchResult={batchResult}
                onRunBatch={handleRunBatch}
                onClearBatch={handleClearBatch}
                onSelectRun={handleSelectBatchRun}
                selectedRunIdx={selectedBatchRunIdx}
                onBatchCountChange={setField("batchCount")}
              />
            </>
            )}

            {mode === "fno" && result && isFnoResult && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <MiniStat label="Final Capital" value={fmtMoney(result.finalCapital)} />
                  <MiniStat
                    label="Net P/L"
                    value={fmtMoney(result.netPL)}
                    sub={fmtPct((result.netPL / cfg.initialCapital) * 100)}
                    tone={result.netPL >= 0 ? "pos" : "neg"}
                  />
                  <MiniStat label="Max Drawdown" value={fmtPct(result.maxDD)} sub={`-${fmtMoney(result.maxDDValue)}`} valueColor="#E7180B" subColor="#E7180B" />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <MiniStat
                    label="Win Rate"
                    value={fmtPct(result.winRateActual)}
                    sub={`${result.winsCount}W / ${result.lossesCount}L`}
                    valueColor="#FDC745"
                  />
                  <MiniStat
                    label="Profit Factor"
                    value={isFinite(result.profitFactor) ? result.profitFactor.toFixed(2) : "∞"}
                    valueColor="#53EAFD"
                  />
                  <MiniStat
                    label={isFnoIntraday ? "Total Shares" : "Total Lots"}
                    value={result.totalLots.toFixed(1)}
                    sub={`Avg: ${result.avgLots.toFixed(1)}/trade`}
                  />
                  <MiniStat
                    label="Trades Run"
                    value={`${result.trades.length} / ${Math.round(cfg.numTrades)}`}
                    sub={result.stopped ? "stopped early" : "completed"}
                    valueColor="#FEF9C2"
                  />
                  <MiniStat
                    label="Instrument Price"
                    value={fmtMoney(result.finalPrice)}
                    sub={`from ${fmtMoney(lastCleanCfgRef.current.fnoCurrentPrice)}`}
                    tone={result.finalPrice >= lastCleanCfgRef.current.fnoCurrentPrice ? "pos" : "neg"}
                    valueColor="#A2F4FD"
                    subColor="#71717a"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <MiniStat label="Total Fees" value={fmtMoney(result.totalFees)} valueColor="#C4B4FF" />
                  <MiniStat
                    label="Expectancy"
                    value={`${result.expectancy >= 0 ? "+" : ""}${fmtMoney(result.expectancy)}`}
                    sub="per trade"
                    valueColor={result.expectancy >= 0 ? "#31C950" : "#FF2056"}
                  />
                </div>

                <div className={`${CARD} overflow-hidden`}>
                  <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-zinc-800">
                    <span className="flex items-center gap-2 text-[13px] font-semibold text-zinc-200">
                      <Percent size={14} className="text-zinc-300" />
                      Charges Breakdown
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500 capitalize">
                      {lastCleanCfgRef.current.fnoBroker} · {lastCleanCfgRef.current.fnoSegment}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-px bg-zinc-800">
                    {[
                      ["Brokerage", result.totalBrokerage, "#C4B4FF"],
                      ["Other Charges", result.totalOtherCharges, "#FFD59E"],
                      ["GST", result.totalGst, "#BBF451"],
                    ].map(([label, val, color]) => (
                      <div key={label} className="bg-zinc-900 px-3 py-2.5">
                        <div className="text-[10px] text-zinc-500">{label}</div>
                        <div className="font-mono text-sm mt-1" style={{ color }}>
                          {fmtMoney(val)}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-2 text-[10px] font-mono text-zinc-500 border-t border-zinc-800">
                    Total turnover across all trades: {fmtMoney(result.totalTurnover)}
                  </div>
                </div>

                <TradeAnalyticsSection
                  trades={result.trades}
                  initialCapital={lastCleanCfgRef.current?.initialCapital ?? cfg.initialCapital}
                />

                <RecoveryTimeAnalysis
                  trades={result.trades}
                  initialCapital={lastCleanCfgRef.current?.initialCapital ?? cfg.initialCapital}
                />

                <div className={`${CARD} overflow-hidden`}>
                  <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-zinc-800">
                    <span className="flex items-center gap-2 text-[13px] font-semibold text-zinc-200">
                      <Layers size={14} className="text-zinc-300" />
                      Trade Log
                      {activeRunLabel && activeRunLabel.startsWith("Scenario :") && batchResult?.mode === (mode === "fno" ? "fno" : "single") ? (
                        <span className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px] font-mono font-normal">
                          <span>Scenario :</span>
                          <input
                            type="number"
                            min="1"
                            max={batchResult.runs.length}
                            step="1"
                            value={scenarioInput}
                            onChange={(e) => setScenarioInput(e.target.value)}
                            onBlur={commitScenarioInput}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                commitScenarioInput();
                                e.currentTarget.blur();
                              }
                            }}
                            aria-label="Scenario number"
                            title={`Enter a scenario number from 1 to ${batchResult.runs.length}`}
                            className="scenario-inspect-input w-12 bg-black/40 border border-zinc-700 rounded px-1.5 py-0.5 text-zinc-100 text-[10px] font-mono text-center outline-none focus:border-indigo-500/70 focus:ring-1 focus:ring-indigo-500/20"
                          />
                        </span>
                      ) : activeRunLabel ? (
                        <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px] font-mono font-normal">
                          {activeRunLabel}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                      <GripVertical size={12} />
                      Click a trade to open allocation. Drag to reorder, click Result to flip.
                    </span>
                  </div>
                  <div
                    className="overflow-x-auto overflow-y-auto"
                    style={tradeLogMaxHeightPx ? { maxHeight: tradeLogMaxHeightPx } : undefined}
                  >
                    <table className="w-full font-mono text-xs whitespace-nowrap">
                      <thead>
                        <tr className="bg-zinc-900 text-zinc-500 text-[10px] uppercase tracking-wide sticky top-0 z-10">
                          <th className="text-left px-3 py-2 font-medium w-8"></th>
                          <th className="text-left px-3 py-2 font-medium">No</th>
                          <th className="text-left px-3 py-2 font-medium">Result</th>
                          <th className="text-right px-3 py-2 font-medium">Risk</th>
                          <th className="text-right px-3 py-2 font-medium">RR</th>
                          <th className="text-right px-3 py-2 font-medium">{isFnoIntraday ? "Shares" : "Lots"}</th>
                          <th className="text-right px-3 py-2 font-medium">Qty</th>
                          <th className="text-right px-3 py-2 font-medium">Gross P/L</th>
                          <th className="text-right px-3 py-2 font-medium">Fee</th>
                          <th className="text-right px-3 py-2 font-medium">Slippage</th>
                          <th className="text-right px-3 py-2 font-medium">Spread</th>
                          <th className="text-right px-3 py-2 font-medium">Net P/L</th>
                          <th className="text-right px-3 py-2 font-medium">Capital</th>
                          <th className="text-right px-3 py-2 font-medium">Cum. P/L</th>
                          <th className="text-right px-3 py-2 font-medium">Price Chg</th>
                          <th className="text-right px-3 py-2 font-medium">Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.trades.map((t, idx) => (
                          <React.Fragment key={`allocation-fno-${t.n}-${idx}`}>
                          <tr
                            key={t.n}
                            draggable
                            onDragStart={handleRowDragStart(idx)}
                            onDragOver={handleRowDragOver(idx)}
                            onDrop={handleRowDrop(idx)}
                            onDragEnd={handleRowDragEnd}
                            onClick={() => { if (dragIdx === null) openTradeAllocation(idx); }}
                            className={`border-b border-zinc-800/60 hover:bg-zinc-800/20 cursor-pointer ${dragIdx !== null ? "cursor-grab active:cursor-grabbing" : ""} transition-colors ${
                              dragIdx === idx ? "opacity-40" : ""
                            } ${
                              dragOverIdx === idx && dragIdx !== idx
                                ? "bg-zinc-500/10 border-t-2 border-t-zinc-300"
                                : ""
                            }`}
                          >
                            <td className="px-3 py-1.5 text-zinc-600">
                              <GripVertical size={13} />
                            </td>
                            <td className="px-3 py-1.5 text-zinc-500">{t.n}</td>
                            <td
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleTradeResult(idx);
                              }}
                              title="Click to flip this trade's result"
                              className="px-3 py-1.5 cursor-pointer select-none hover:brightness-125 transition"
                            >
                              <TradeResultBadge win={t.win} />
                            </td>
                            <td className="px-3 py-1.5 text-right">{fmtMoney(t.risk)}</td>
                            <td className="px-3 py-1.5 text-right text-zinc-300">{Number(t.rr ?? -1).toFixed(2)}R</td>
                            <td className="px-3 py-1.5 text-right text-[#FEF9C2]">{t.lots}</td>
                            <td className="px-3 py-1.5 text-right">{t.quantity}</td>
                            <td className={`px-3 py-1.5 text-right ${t.grossPL >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {fmtMoney(t.grossPL)}
                            </td>
                            <td className="px-3 py-1.5 text-right text-[#C4B4FF]">{fmtMoney(t.fee)}</td>
                            <td className="px-3 py-1.5 text-right text-zinc-400">{fmtMoney(t.slip)}</td>
                            <td className="px-3 py-1.5 text-right text-zinc-400">{fmtMoney(t.spreadCost)}</td>
                            <td className={`px-3 py-1.5 text-right ${t.netPL >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {fmtMoney(t.netPL)}
                            </td>
                            <td className="px-3 py-1.5 text-right text-[#74D4FF]">{fmtMoney(t.capital)}</td>
                            <td
                              className={`px-3 py-1.5 text-right ${
                                t.capital - (lastCleanCfgRef.current?.initialCapital ?? cfg.initialCapital) >= 0
                                  ? "text-emerald-400"
                                  : "text-red-400"
                              }`}
                              style={
                                t.n === result.peakTradeIndex
                                  ? { color: "#7CFC00" }
                                  : t.n === result.troughTradeIndex
                                  ? { color: "#FF0000" }
                                  : undefined
                              }
                            >
                              {fmtMoney(t.capital - (lastCleanCfgRef.current?.initialCapital ?? cfg.initialCapital))}
                            </td>
                            <td
                              className="px-3 py-1.5 text-right"
                              style={{ color: t.price - t.entryPrice >= 0 ? "#05DF72" : "#FF692A" }}
                            >
                              {t.price - t.entryPrice >= 0 ? "+" : ""}
                              {fmtMoney(t.price - t.entryPrice)}
                            </td>
                            <td className="px-3 py-1.5 text-right text-zinc-400">{fmtMoney(t.price)}</td>
                          </tr>
                          {allocationOpenIdx === idx && (
                            <tr className="border-b border-zinc-800/60 bg-black/20">
                              <td colSpan={16} className="px-3 py-3">
                                <TradeAllocationScale
                                  trade={t}
                                  fno
                                  riskScale={allocationScales[idx]?.risk ?? 100}
                                  onRiskScaleChange={(value) => updateAllocationScale(idx, value)}
                                />
                              </td>
                            </tr>
                          )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {result.stopped && (
                    <div className="bg-red-500/10 border-t border-red-500/40 text-red-400 font-mono text-xs px-4 py-2.5">
                      {result.stopReason}
                    </div>
                  )}
                </div>
              </>
            )}

            {mode === "fno" && (!result || !isFnoResult) && (
              <div className={`${CARD} py-16 text-center text-zinc-500 text-sm`}>
                No simulation run yet.
              </div>
            )}

            {mode === "fno" && (
              <>
              <BatchRunSection
                mode="fno"
                cfg={cfg}
                batchResult={batchResult}
                onRunBatch={handleRunBatch}
                onClearBatch={handleClearBatch}
                onSelectRun={handleSelectBatchRun}
                selectedRunIdx={selectedBatchRunIdx}
                onBatchCountChange={setField("batchCount")}
              />
              </>
            )}

            {mode === "sweep" && sweep && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                  <StatCell
                    label="Scenario With Highest Avg Return"
                    value={sweepBest.winRate + "%"}
                    tone="pos"
                    icon={TrendingUp}
                    sub={`${sweepBest.avgReturnPct >= 0 ? "+" : ""}${sweepBest.avgReturnPct.toFixed(2)}% (${sweepBest.avgNetPL >= 0 ? "+" : ""}${fmtMoney(sweepBest.avgNetPL)})`}
                  />
                  <StatCell
                    label="Scenario With Lowest Avg Return"
                    value={sweepWorst.winRate + "%"}
                    tone={sweepWorst.avgReturnPct >= 0 ? "pos" : "neg"}
                    icon={sweepWorst.avgReturnPct >= 0 ? TrendingUp : TrendingDown}
                    sub={`${sweepWorst.avgReturnPct >= 0 ? "+" : ""}${sweepWorst.avgReturnPct.toFixed(2)}% (${sweepWorst.avgNetPL >= 0 ? "+" : ""}${fmtMoney(sweepWorst.avgNetPL)})`}
                  />
                  <StatCell
                    label="Win Rate RR"
                    value={isFinite(winRateRR) ? winRateRR.toFixed(2) : "∞"}
                    icon={Percent}
                    valueColor="#DAB2FF"
                    sub={`0%: ${winRatePoint0.avgReturnPct.toFixed(2)}% · 100%: ${winRatePoint100.avgReturnPct >= 0 ? "+" : ""}${winRatePoint100.avgReturnPct.toFixed(2)}%`}
                  />
                  <StatCell
                    label="Sample Size"
                    value={sweep.runsPerPoint + " / point"}
                    icon={Layers}
                    sub={
                      sweep.requestedRunsPerPoint !== sweep.runsPerPoint
                        ? `set to ${sweep.requestedRunsPerPoint}, capped`
                        : `set to ${sweep.requestedRunsPerPoint}`
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <MiniStat label="Points Tested" value={sweep.points.length} sub={`0% – 100% win rate`} />
                  <MiniStat label="Total Simulations" value={(sweep.points.length * sweep.runsPerPoint).toLocaleString("en-IN")} valueColor="#A3B3FF" />
                </div>

                <div className={`${CARD} overflow-hidden`}>
                  <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                    <span className="flex items-center gap-2 text-[13px] font-semibold text-zinc-200">
                      <Activity size={14} className="text-zinc-300" />
                      Avg Return vs Win Rate
                    </span>
                    <span className="flex items-center gap-3">
                      <LegendDot color="bg-[#42D3F2]" label="Avg Return" />
                      <LegendDot color="bg-[#BBF451]" label="% Profitable" />
                    </span>
                  </div>
                  <div className="h-64 sm:h-72 px-2 pt-5 pb-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={sweepChartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                        <defs>
                          <linearGradient id="avgReturnFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#42D3F2" stopOpacity={0.28} />
                            <stop offset="100%" stopColor="#42D3F2" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="wrLabel"
                          stroke="#52525b"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          yAxisId="left"
                          stroke="#42D3F2"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          width={52}
                          tickFormatter={(v) => v}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          domain={[0, 100]}
                          stroke="#BBF451"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          width={40}
                          tickFormatter={(v) => v + "%"}
                        />
                        <ReferenceLine yAxisId="left" y={0} stroke="#52525b" strokeDasharray="4 4" />
                        <Tooltip content={<SweepTooltip />} cursor={{ stroke: "#3f3f46", strokeWidth: 1 }} />
                        <Area
                          yAxisId="left"
                          type="monotone"
                          dataKey="avgReturnPct"
                          stroke="none"
                          fill="url(#avgReturnFill)"
                          isAnimationActive={false}
                        />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="avgReturnPct"
                          stroke="#42D3F2"
                          strokeWidth={2.5}
                          dot={{ r: 2.5, fill: "#42D3F2", strokeWidth: 0 }}
                          activeDot={{ r: 5, fill: "#42D3F2", stroke: "#0a0b0d", strokeWidth: 2 }}
                          isAnimationActive={false}
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="profitableRate"
                          stroke="#BBF451"
                          strokeWidth={1.5}
                          strokeDasharray="4 3"
                          dot={false}
                          activeDot={{ r: 4, fill: "#BBF451", stroke: "#0a0b0d", strokeWidth: 2 }}
                          isAnimationActive={false}
                        />
                        {sweepBest && (
                          <ReferenceDot
                            yAxisId="left"
                            x={sweepBest.winRate + "%"}
                            y={sweepBest.avgReturnPct}
                            r={5}
                            fill="#42D3F2"
                            stroke="#0a0b0d"
                            strokeWidth={2}
                          />
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>


                <RecoveryTimeSweepSection points={sweep.points} />

                <div className={`${CARD} overflow-hidden`}>
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
                    <Layers size={14} className="text-zinc-300" />
                    <span className="text-[13px] font-semibold text-zinc-200">Win Rate Breakdown</span>
                  </div>
                  <div className="overflow-x-auto max-h-96">
                    <table className="w-full font-mono text-xs whitespace-nowrap">
                      <thead>
                        <tr className="bg-zinc-900 text-zinc-500 text-[10px] uppercase tracking-wide sticky top-0 z-10">
                          <th className="text-left px-3 py-2 font-medium">Win Rate</th>
                          <th className="text-right px-3 py-2 font-medium">Final Capital</th>
                          <th className="text-right px-3 py-2 font-medium">Net P/L</th>
                          <th className="text-right px-3 py-2 font-medium">Max DD</th>
                          <th className="text-right px-3 py-2 font-medium">Max Profit</th>
                          <th className="text-right px-3 py-2 font-medium">Max Loss</th>
                          <th className="text-right px-3 py-2 font-medium">RR</th>
                          <th className="text-right px-3 py-2 font-medium">Profitable Runs</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sweep.points.map((p) => (
                          <tr key={p.winRate} className="border-b border-zinc-800/60 hover:bg-zinc-800/20">
                            <td
                              className={`px-3 py-1.5 border-l-2 text-[#FFDF20] ${
                                p.winRate === sweepBest.winRate
                                  ? "border-zinc-300"
                                  : "border-transparent"
                              }`}
                            >
                              {p.winRate}%
                            </td>
                            <td className="px-3 py-1.5 text-right">{fmtMoney(p.avgFinal)}</td>
                            <td
                              className={`px-3 py-1.5 text-right ${
                                p.avgNetPL >= 0 ? "text-emerald-400" : "text-red-400"
                              }`}
                            >
                              {fmtMoney(p.avgNetPL)}
                            </td>
                            <td className="px-3 py-1.5 text-right text-[#E7180B]">
                              {fmtPct(p.avgMaxDD)} ({fmtMoney(p.avgMaxDDValue)})
                            </td>
                            <td className="px-3 py-1.5 text-right text-emerald-400/80">
                              {fmtPct(p.avgMaxProfitPct)} ({fmtMoney(p.avgMaxProfitValue)})
                            </td>
                            <td className="px-3 py-1.5 text-right text-red-400/80">
                              {fmtPct(p.avgMaxLossPct)} ({fmtMoney(p.avgMaxLossValue)})
                            </td>
                            <td className="px-3 py-1.5 text-right">
                              {isFinite(p.rewardRiskRatio) ? p.rewardRiskRatio.toFixed(2) : "∞"}
                            </td>
                            <td className="px-3 py-1.5 text-right text-[#A2F4FD]">{p.profitableRate.toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {mode === "sweep" && !sweep && (
              <div className={`${CARD} py-16 text-center text-zinc-500 text-sm`}>
                No sweep run yet.
              </div>
            )}
          </main>
        </div>
      </div>

      {mode !== "builder" && mode !== "bankroll" && <DraggableRunButton onRun={handleRun} />}
    </div>
  );
}