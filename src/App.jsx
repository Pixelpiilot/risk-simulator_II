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
  rr: 2.5,
  feeMode: "perLot", // "perLot" | "turnover"
  feeBaseEntry: 0.1,
  feeBaseExit: 0.1,
  currentPrice: 2600,
  leverage: 1,
  entryFeeTurnoverPct: 0.045,
  exitFeeTurnoverPct: 0.045,
  cascadeMode: "profit", // "profit" (size off last win's/loss's profit) | "capital" (size off current capital)
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
  // Risk-of-Ruin uses a fixed internal 80% loss threshold; no user-facing input.
  slipMode: "percent",
  slipPct: 0,
  slipTicks: 1,
  tickValue: 0.1,
  entrySpread: 0,
  exitSpread: 0.2,
  winRate: 40,
  numTrades: 10,
  sweepStep: 5,
  sweepRuns: 100,
  batchCount: "",
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
  let price = Number(cfg.currentPrice) || 0; // running instrument price (drives turnover fee + is itself driven by each trade's gross P/L)

  const trades = [];
  let stopped = false;
  let stopReason = null;

  const numTrades = Math.min(cfg.numTrades, winLossSeq.length);

  for (let i = 1; i <= numTrades; i++) {
    let riskAmt;

    if (Array.isArray(explicitRiskPlan)) {
      // Builder mode can supply an explicit, already-allocated risk plan.
      // The plan is scaled to the Builder Total Risk Budget before it reaches
      // this engine, so keep the regular cascade/reset logic out of this path.
      riskAmt = Number(explicitRiskPlan[i - 1]) || 0;
    } else if (i === 1) {
      // Trade 1 always starts at the fixed base risk.
      riskAmt = BASE_RISK_AMT;
    } else if (prevWin) {

      if (isCapitalCascade) {
        riskAmt = capital * (cfg.winRiskPct / 100);
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
        riskAmt = capital * (effectiveLossPct / 100);
      } else if (lastProfitNet <= 0) {
        // The last recorded win left no usable net profit either — same
        // restart-at-base fallback as above, so the cascade doesn't stay
        // stuck at zero risk for the rest of the run.
        riskAmt = BASE_RISK_AMT;
      } else {
        riskAmt = lastProfitNet * (effectiveLossPct / 100);
      }
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
    const grossPL = isWin ? riskAmt * cfg.rr : -riskAmt;

    
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

    if (isWin) {
      hasWon = true;
      lastProfitNet = netPL;
      consecutiveLosses = 0;
    } else {
      consecutiveLosses += 1;
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
  let price = Number(cfg.fnoCurrentPrice) || 0;

  const trades = [];
  let stopped = false;
  let stopReason = null;

  const numTrades = Math.min(cfg.numTrades, winLossSeq.length);

  for (let i = 1; i <= numTrades; i++) {
    let targetRiskAmt;

    if (Array.isArray(explicitRiskPlan)) {
      // Builder supplies a final risk allocation; all Day/F&O trading, costs
      // and safety-stop mechanics below still run exactly as usual.
      targetRiskAmt = Number(explicitRiskPlan[i - 1]) || 0;
    } else if (i === 1) {
      targetRiskAmt = BASE_RISK_AMT;
    } else if (prevWin) {
      if (isCapitalCascade) {
        targetRiskAmt = capital * (cfg.winRiskPct / 100);
      } else if (prevNet <= 0) {
        // The trade that just won left no usable net profit behind — reset
        // to base risk instead of sizing off zero/negative forever.
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
        targetRiskAmt = capital * (effectiveLossPct / 100);
      } else if (lastProfitNet <= 0) {
        // Same restart-at-base fallback as above, for the loss-sizing path.
        targetRiskAmt = BASE_RISK_AMT;
      } else {
        targetRiskAmt = lastProfitNet * (effectiveLossPct / 100);
      }
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
    const grossPL = isWin ? riskAmt * cfg.rr : -riskAmt;

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

    if (isWin) {
      hasWon = true;
      lastProfitNet = netPL;
      consecutiveLosses = 0;
    } else {
      consecutiveLosses += 1;
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
    feeMode: cfg.feeMode === "turnover" ? "turnover" : "perLot",
    feeBaseEntry: Number(cfg.feeBaseEntry) || 0,
    feeBaseExit: Number(cfg.feeBaseExit) || 0,
    currentPrice: Number(cfg.currentPrice) || 0,
    leverage: Math.min(1000, Math.max(0, Number(cfg.leverage) || 0)),
    entryFeeTurnoverPct: Number(cfg.entryFeeTurnoverPct) || 0,
    exitFeeTurnoverPct: Number(cfg.exitFeeTurnoverPct) || 0,
    cascadeMode: cfg.cascadeMode === "capital" ? "capital" : "profit",
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
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 shadow-xl shadow-black/50 font-mono">
      <div className="text-[10px] text-zinc-500 mb-1.5">Scenario : {label}</div>
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
            placeholder="e.g. 100"
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
                <MiniStat label="Risk of Ruin" value={fmtPct(stats.riskOfRuinPct)} sub={`${stats.ruinedCount} ruined runs`} tone={stats.riskOfRuinPct > 0 ? "neg" : undefined} />
              </div>

              <MultiSimHistogram
                runs={batchResult.runs}
                selectedRunIdx={selectedRunIdx}
                onSelectRun={onSelectRun}
              />

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
            </div>
          )}
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

function buildAllWinLossSequences(n, wins) {
  const out = [];
  const seq = Array(n).fill(false);
  const visit = (pos, remainingWins) => {
    if (pos === n) {
      if (remainingWins === 0) out.push(seq.slice());
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
  return out;
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

function evaluateBuilderSequence(engineCfg, sequence, totalRiskAmount, useFno, targetWinRate = null) {
  const initialCapital = Math.max(0, Number(engineCfg.initialCapital) || 0);
  const n = sequence.length;
  const wins = sequence.filter(Boolean).length;

  const calibrated = calibrateBuilderRiskPlan(
    engineCfg,
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

  const engineCfg = cleanConfig({
    ...rawCfg,
    initialCapital,
  });

  // Group every mathematically possible W/L ratio inside the user-selected
  // custom trade range (minimum 1, no fixed maximum) by its reduced fraction.
  // This means 50% from 6, 8 and 10 trades is one matrix row, while 33.33%,
  // 37.50%, 42.86%, etc. are also tested automatically.
  const rateGroups = new Map();
  for (let n = minTrades; n <= maxTrades; n++) {
    for (let wins = 0; wins <= n; wins++) {
      const divisor = gcd(wins, n);
      const reducedNum = wins / divisor;
      const reducedDen = n / divisor;
      const rateKey = `${reducedNum}/${reducedDen}`;
      const targetWinRate = (wins / n) * 100;
      if (!rateGroups.has(rateKey)) {
        rateGroups.set(rateKey, {
          key: rateKey,
          targetWinRate,
          ratios: [],
        });
      }
      rateGroups.get(rateKey).ratios.push({ n, wins });
    }
  }

  const groups = [...rateGroups.values()].sort((a, b) => a.targetWinRate - b.targetWinRate);
  const points = [];

  for (const group of groups) {
    const candidates = [];

    for (const { n, wins } of group.ratios) {
      const sequences = buildAllWinLossSequences(n, wins);
      for (const sequence of sequences) {
        const candidate = evaluateBuilderSequence(
          engineCfg,
          sequence,
          totalRiskAmount,
          useFno,
          group.targetWinRate
        );
        if (candidate) candidates.push(candidate);
      }
    }

    candidates.sort(compareBuilderCandidates);

    if (!candidates.length) {
      points.push({
        targetWinRate: group.targetWinRate,
        fractionKey: group.key,
        status: "Losing Range",
        reason: `No complete combination fits the ${totalRiskPct}% all-in Builder risk budget and active safety stops.`,
        candidate: null,
        alternatives: [],
        allCombinations: [],
        winningCombinations: [],
        winningCombinationCount: 0,
      });
      continue;
    }

    const winningCombinations = candidates.filter((c) => c.returnPct > 0);
    const candidate = candidates[0];
    points.push({
      targetWinRate: group.targetWinRate,
      fractionKey: group.key,
      status: candidate.returnPct > 0 ? "Profitable" : "Losing Range",
      reason: candidate.returnPct > 0
        ? "Best-return complete combination found inside the all-in Builder risk budget and active safety stops."
        : "Complete combinations exist, but this win rate remains unprofitable inside the all-in Builder risk budget and active safety stops.",
      candidate,
      alternatives: candidates.slice(1, 4),
      allCombinations: candidates,
      winningCombinations,
      winningCombinationCount: winningCombinations.length,
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
    strategyCfg: engineCfg,
    points,
    validCount: points.filter((p) => p.candidate).length,
    profitableCount: points.filter((p) => p.candidate?.returnPct > 0).length,
    losingCount: points.filter((p) => !p.candidate || p.candidate.returnPct <= 0).length,
    bestReturnPoint: null,
  };

  return deriveBuilderState(builder, points);
}

function BuilderConfig({ cfg, strategyCfg, baseMode, autoCandidate, onChange, onBuild, hasResult, builderBuilding }) {
  const isFno = baseMode === "fno";
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
            <div className="text-xs font-mono text-zinc-200 py-2.5">{Number(strategyCfg.rr || 0).toFixed(2)}</div>
          </Field>
        </div>
      </div>

      <div className="mb-5">
        <GroupTitle icon={BarChart2} color="violet">Risk Allocation</GroupTitle>
        <div className="flex items-center justify-between text-[11px] font-mono mb-2">
          <span className="text-zinc-400">{strategyCfg.cascadeMode === "profit" ? "On Profit" : "On Capital"}</span>
          <span className={strategyCfg.riskAllocationEnabled ? "text-violet-300" : "text-zinc-600"}>Reset {strategyCfg.riskAllocationEnabled ? "ON" : "OFF"}</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Win Risk %"><div className="text-xs font-mono text-zinc-200 py-2.5">{fmtPct(strategyCfg.winRiskPct)}</div></Field>
          <Field label="Loss Risk %"><div className="text-xs font-mono text-zinc-200 py-2.5">{fmtPct(strategyCfg.lossRiskPct)}</div></Field>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Incr/Decr Risk %"><div className="text-xs font-mono text-zinc-200 py-2.5">{fmtPct(strategyCfg.lossRiskAdjustPct)}</div></Field>
          <Field label="Trigger (% Initial)"><div className="text-xs font-mono text-zinc-200 py-2.5">{fmtPct(strategyCfg.riskAllocationTriggerPct)}</div></Field>
        </div>
        <Field label="Reset To (% Initial)"><div className="text-xs font-mono text-zinc-200 py-2.5">{fmtPct(strategyCfg.riskAllocationResetPct)}</div></Field>
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
        disabled={builderBuilding}
        className="w-full bg-zinc-100 text-zinc-950 rounded-lg py-2.5 text-xs font-semibold hover:bg-white disabled:opacity-60 disabled:cursor-wait transition-colors"
      >
        {builderBuilding ? "Building…" : hasResult ? "Rebuild Strategy" : "Build Strategy"}
      </button>

      <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
        <div className="text-[10px] uppercase tracking-wider text-amber-300/80 font-semibold">Active Configuration</div>
        <div className="text-[10px] leading-relaxed text-zinc-500 mt-1.5">
          Builder uses the current {isFno ? "Day / F&amp;O" : "Single Run"} configuration for RR, risk allocation, costs and safety stops, while auto-scaling Base Risk and size to the Builder downside cap.
        </div>
      </div>
    </div>
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
  const allLossPct = Number(item.allLossPct ?? item.worstCaseLossPct) || 0;
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
        Trades {tradeCount} · Risk {allocatedRiskPct.toFixed(2)} · All-Loss {allLossPct.toFixed(2)} · Max DD {maxDD.toFixed(2)}
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
  const chartData = winningScenarios.map((c, i) => ({
    scenario: i + 1,
    returnPct: Number(c.returnPct) || 0,
    sequence: c.sequence || "",
    tradeCount: Number(c.tradeCount) || 0,
    totalAllocatedRiskPct: Number(c.totalAllocatedRiskPct) || 0,
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
        </div>
        <div className="text-right font-mono text-[10px] text-zinc-500">RR {builder.rr.toFixed(2)} · {builder.exactWinRateCount} exact WR points</div>
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
          <table className="w-full text-[11px] font-mono min-w-[1120px]">
            <thead className="bg-zinc-950/60 text-zinc-500">
              <tr className="border-b border-zinc-800">
                <th className="text-left px-3 py-2 font-medium">Win Rate</th>
                <th className="text-right px-3 py-2 font-medium">Trades</th>
                <th className="text-left px-3 py-2 font-medium">Combination</th>
                <th className="text-right px-3 py-2 font-medium">Allocated Risk</th>
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
              <div className="text-[10px] text-zinc-600 mt-1">{formatBuilderWinRate(activeWinRatePoint?.targetWinRate ?? 0)} Win Rate · {winningScenarios.length} profitable combination{winningScenarios.length === 1 ? "" : "s"} · Click any bar to open that exact Trade Log.</div>
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

      {best && (
        <div className={`${CARD} overflow-hidden`}>
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between gap-3">
            <div>
              <div className="text-[13px] font-semibold text-zinc-200">Highest-Return Combination Found</div>
              <div className="text-[10px] text-zinc-600 mt-1">This combination uses the active strategy settings for risk model, RR, costs and safety stops.</div>
            </div>
            <div className="font-mono text-sm text-emerald-400">+{best.returnPct.toFixed(2)}</div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-[0.82fr_0.82fr_1.8fr_0.88fr_0.88fr] gap-px bg-zinc-800">
            <div className="bg-zinc-900 px-3 py-3 min-w-0"><div className="text-[10px] text-zinc-500">Win Rate</div><div className="font-mono text-sm mt-1 text-[#FFDF20]">{formatBuilderWinRate(best.actualWinRate)}</div></div>
            <div className="bg-zinc-900 px-3 py-3 min-w-0"><div className="text-[10px] text-zinc-500">Trade Count</div><div className="font-mono text-sm mt-1 text-zinc-200">{best.tradeCount}</div></div>
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
                <th className="text-right px-3 py-2 font-medium">Lots</th>
                <th className="text-right px-3 py-2 font-medium">Gross P/L</th>
                <th className="text-right px-3 py-2 font-medium">Fee</th>
                <th className="text-right px-3 py-2 font-medium">Slippage</th>
                <th className="text-right px-3 py-2 font-medium">Spread</th>
                <th className="text-right px-3 py-2 font-medium">Net P/L</th>
                <th className="text-right px-3 py-2 font-medium">Capital</th>
                <th className="text-right px-3 py-2 font-medium">Cum. P/L</th>
                <th className="text-right px-3 py-2 font-medium">Price</th>
                <th className="text-right px-3 py-2 font-medium">Price Chg</th>
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
                  <td className={`px-3 py-1.5 border-l-2 ${t.win ? "border-emerald-400 text-emerald-400" : "border-red-400 text-red-400"}`}>
                    {t.win ? "WIN" : "LOSS"}
                  </td>
                  <td className="px-3 py-1.5 text-right">{fmtMoney(t.risk)} {t.riskAllocationReset ? <span className="ml-1 text-[9px] text-violet-300">RESET</span> : null}</td>
                  <td className="px-3 py-1.5 text-right text-[#FEF9C2]">{t.lots.toFixed(2)}</td>
                  <td className={`px-3 py-1.5 text-right ${t.grossPL >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmtMoney(t.grossPL)}</td>
                  <td className="px-3 py-1.5 text-right text-[#C4B4FF]">{fmtMoney(t.fee)}</td>
                  <td className="px-3 py-1.5 text-right text-zinc-400">{fmtMoney(t.slip)}</td>
                  <td className="px-3 py-1.5 text-right text-zinc-400">{fmtMoney(t.spreadCost)}</td>
                  <td className={`px-3 py-1.5 text-right ${t.netPL >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmtMoney(t.netPL)}</td>
                  <td className="px-3 py-1.5 text-right text-[#74D4FF]">{fmtMoney(t.capital)}</td>
                  <td className={`px-3 py-1.5 text-right ${t.capital - initialCapital >= 0 ? "text-emerald-400" : "text-red-400"}`} style={t.n === result.peakTradeIndex ? { color: "#7CFC00" } : t.n === result.troughTradeIndex ? { color: "#FF0000" } : undefined}>{fmtMoney(t.capital - initialCapital)}</td>
                  <td className="px-3 py-1.5 text-right text-zinc-400">{fmtMoney(t.price)}</td>
                  <td className="px-3 py-1.5 text-right" style={{ color: t.price - t.entryPrice >= 0 ? "#05DF72" : "#FF692A" }}>{t.price - t.entryPrice >= 0 ? "+" : ""}{fmtMoney(t.price - t.entryPrice)}</td>
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
};

export default function RiskSimulator() {
  const [cfg, setCfg] = useState(DEFAULTS);
  const [mode, setMode] = useState("single");
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
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const lastCleanCfgRef = useRef(null);
  const lastRunModeRef = useRef(null);

  // The config panel (and, when running a sweep, the sweep engine itself)
  // should reflect Single Run's fields while on that tab, Day/F&O's fields
  // while on that tab, and whichever of the two was set last while on Sweep.
  const effectiveMode = mode === "sweep" ? sweepBaseMode : mode;

  const setField = (key) => (e) => {
    const val = e.target.value;
    setCfg((c) => ({ ...c, [key]: val === "" ? "" : parseFloat(val) }));
  };

  const setBuilderField = (key) => (e) => {
    const val = e.target.value;
    setCfg((c) => ({ ...c, [key]: val === "" ? "" : parseFloat(val) }));
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
    setActiveRunLabel(`Combination · ${candidate.actualWinRate.toFixed(0)}% WR · ${candidate.tradeCount} trades`);
  }, [cfg]);

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
    const editedCandidate = evaluateBuilderSequence(
      builderResult.strategyCfg,
      seq,
      builderResult.totalRiskAmount,
      builderResult.baseMode === "fno",
      targetWinRate
    );
    if (!editedCandidate) return;

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
    setActiveRunLabel(`Combination · ${formatBuilderWinRate(editedCandidate.actualWinRate)} WR · ${editedCandidate.tradeCount} trades · sequence reordered`);
    setSelectedBatchRunIdx(null);
  }, [builderResult]);

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
      builderBaseMode: strategyBaseMode,
    };
    if (normalized.builderMaxTrades < normalized.builderMinTrades) {
      normalized.builderMaxTrades = normalized.builderMinTrades;
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
      setSweep(null);
      lastCleanCfgRef.current = clean;
      lastRunModeRef.current = "single";
      setResult(runSimulation(clean));
      setActiveRunLabel(null);
      setSelectedBatchRunIdx(null);
      setBatchResult(null);
    } else if (mode === "fno") {
      setSweep(null);
      lastCleanCfgRef.current = clean;
      lastRunModeRef.current = "fno";
      setResult(runSimulationFnO(clean));
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
    const ruinLossPct = 80;
    const ruinThresholdCapital = clean.initialCapital * (1 - ruinLossPct / 100);
    const ruinedCount = runs.filter((r) => r.result.finalCapital <= ruinThresholdCapital || r.result.maxLossValue <= -clean.initialCapital * (ruinLossPct / 100)).length;
    const riskOfRuinPct = runs.length ? (ruinedCount / runs.length) * 100 : 0;

    setBatchResult({
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
        riskOfRuinPct,
        ruinedCount,
        maxProfitRun,
        maxLossRun,
        maxDDRun,
      },
    });
    setSelectedBatchRunIdx(null);
    setActiveRunLabel(null);
  }, [cfg, mode]);


  // Clears the Multi Simulations batch entirely — back to the empty "Set a
  // Scenarios count..." state — without touching the main Trade Log/stats
  // above (those keep showing whatever single run or selected batch run
  // was last loaded there).
  const handleClearBatch = useCallback(() => {
    setBatchResult(null);
    setSelectedBatchRunIdx(null);
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
      setResult({ ...run.result, winLossSeq: run.winLossSeq });
      setSelectedBatchRunIdx(run.index);
      setActiveRunLabel(`Scenario : ${run.index}`);
    },
    [batchResult]
  );

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
      setActiveRunLabel(`Combination · ${formatBuilderWinRate(editedCandidate.actualWinRate)} WR · ${editedCandidate.tradeCount} trades · edited sequence`);
      setSelectedBatchRunIdx(null);
    },
    [result, builderResult, builderSelectedKey]
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
      setActiveRunLabel(match ? `Scenario : ${match.index}` : null);
      setSelectedBatchRunIdx(match ? match.index : null);
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
      setActiveRunLabel(match ? `Scenario : ${match.index}` : null);
      setSelectedBatchRunIdx(match ? match.index : null);
      const newWinRate = seq.length ? (seq.filter(Boolean).length / seq.length) * 100 : 0;
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
          <div className="grid grid-cols-4 sm:flex bg-zinc-900/60 border border-zinc-800 rounded-lg p-1 w-full sm:w-auto">
            {["single", "sweep", "fno", "builder"].map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  if (m === "single" || m === "fno") {
                    setSweepBaseMode(m);
                    setStrategyBaseMode(m);
                  }
                  if (m === "builder") {
                    setCfg((c) => ({ ...c, builderInitialCapital: c.initialCapital }));
                    setBuilderSelectedKey(null);
                  }
                }}
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
          <aside className={`${CARD} w-80 shrink-0 self-start p-4 sm:p-5`}>
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
                <Field label="Reward:Risk">
                  <NumInput value={cfg.rr} onChange={setField("rr")} step="0.1" color="blue" />
                </Field>
              </div>

              <div className="mb-5">
                <GroupTitle icon={BarChart2} color="violet">Risk Allocation</GroupTitle>
                <div className="flex bg-zinc-800/40 border border-zinc-700/50 rounded-lg p-1 mb-2.5">
                  {["profit", "capital"].map((cm) => (
                    <button
                      key={cm}
                      onClick={() => setCfg((c) => ({ ...c, cascadeMode: cm }))}
                      className={`flex-1 py-1.5 rounded-md text-xs font-mono transition-colors ${
                        cfg.cascadeMode === cm ? "bg-violet-500/20 text-violet-300" : "text-zinc-500"
                      }`}
                    >
                      {cm === "profit" ? "On Profit" : "On Capital"}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <Field label="Win Risk %">
                    <NumInput value={cfg.winRiskPct} onChange={setField("winRiskPct")} step="0.1" color="violet" />
                  </Field>
                  <Field label="Loss Risk %">
                    <NumInput value={cfg.lossRiskPct} onChange={setField("lossRiskPct")} step="0.1" color="violet" />
                  </Field>
                </div>
                <Field label="Incr/Decr Risk %">
                  <NumInput value={cfg.lossRiskAdjustPct} onChange={setField("lossRiskAdjustPct")} step="0.1" color="violet" />
                </Field>
                <div className="mt-2 p-2.5 rounded-lg border border-violet-500/20 bg-violet-500/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] text-violet-300 font-medium">Risk Allocation Reset</span>
                    <button onClick={() => setCfg((c) => ({ ...c, riskAllocationEnabled: !c.riskAllocationEnabled }))} className={`px-2 py-1 rounded text-[10px] font-mono ${cfg.riskAllocationEnabled ? "bg-violet-500/20 text-violet-300" : "bg-zinc-800 text-zinc-500"}`}>{cfg.riskAllocationEnabled ? "ON" : "OFF"}</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Trigger (% Initial)">
                      <NumInput value={cfg.riskAllocationTriggerPct} onChange={setField("riskAllocationTriggerPct")} step="1" color="violet" />
                    </Field>
                    <Field label="Reset To (% Initial)">
                      <NumInput value={cfg.riskAllocationResetPct} onChange={setField("riskAllocationResetPct")} step="1" color="violet" />
                    </Field>
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
          <main className="min-w-0 flex-1 space-y-4">
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

                <div className={`${CARD} overflow-hidden`}>
                  <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-zinc-800">
                    <span className="flex items-center gap-2 text-[13px] font-semibold text-zinc-200">
                      <Layers size={14} className="text-zinc-300" />
                      Trade Log
                      {activeRunLabel && (
                        <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px] font-mono font-normal">
                          {activeRunLabel}
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                      <GripVertical size={12} />
                      Drag to reorder, click Result to flip &mdash; recalcs automatically
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
                          <th className="text-right px-3 py-2 font-medium">Lots</th>
                          <th className="text-right px-3 py-2 font-medium">Gross P/L</th>
                          <th className="text-right px-3 py-2 font-medium">Fee</th>
                          <th className="text-right px-3 py-2 font-medium">Slippage</th>
                          <th className="text-right px-3 py-2 font-medium">Spread</th>
                          <th className="text-right px-3 py-2 font-medium">Net P/L</th>
                          <th className="text-right px-3 py-2 font-medium">Capital</th>
                          <th className="text-right px-3 py-2 font-medium">Cum. P/L</th>
                          <th className="text-right px-3 py-2 font-medium">Price</th>
                          <th className="text-right px-3 py-2 font-medium">Price Chg</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.trades.map((t, idx) => (
                          <tr
                            key={t.n}
                            draggable
                            onDragStart={handleRowDragStart(idx)}
                            onDragOver={handleRowDragOver(idx)}
                            onDrop={handleRowDrop(idx)}
                            onDragEnd={handleRowDragEnd}
                            className={`border-b border-zinc-800/60 hover:bg-zinc-800/20 cursor-grab active:cursor-grabbing transition-colors ${
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
                              onClick={() => toggleTradeResult(idx)}
                              title="Click to flip this trade's result"
                              className={`px-3 py-1.5 border-l-2 cursor-pointer select-none hover:brightness-125 transition ${
                                t.win ? "border-emerald-400 text-emerald-400" : "border-red-400 text-red-400"
                              }`}
                            >
                              {t.win ? "WIN" : "LOSS"}
                            </td>
                            <td className="px-3 py-1.5 text-right">{fmtMoney(t.risk)} {t.riskAllocationReset ? <span className="ml-1 text-[9px] text-violet-300" title="Risk Allocation Reset">RESET</span> : null}</td>
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
                            <td className="px-3 py-1.5 text-right text-zinc-400">{fmtMoney(t.price)}</td>
                            <td
                              className="px-3 py-1.5 text-right"
                              style={{ color: t.price - t.entryPrice >= 0 ? "#05DF72" : "#FF692A" }}
                            >
                              {t.price - t.entryPrice >= 0 ? "+" : ""}
                              {fmtMoney(t.price - t.entryPrice)}
                            </td>
                          </tr>
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

                <div className={`${CARD} overflow-hidden`}>
                  <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-zinc-800">
                    <span className="flex items-center gap-2 text-[13px] font-semibold text-zinc-200">
                      <Layers size={14} className="text-zinc-300" />
                      Trade Log
                      {activeRunLabel && (
                        <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px] font-mono font-normal">
                          {activeRunLabel}
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                      <GripVertical size={12} />
                      Drag to reorder, click Result to flip &mdash; recalcs automatically
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
                          <th className="text-right px-3 py-2 font-medium">{isFnoIntraday ? "Shares" : "Lots"}</th>
                          <th className="text-right px-3 py-2 font-medium">Qty</th>
                          <th className="text-right px-3 py-2 font-medium">Gross P/L</th>
                          <th className="text-right px-3 py-2 font-medium">Fee</th>
                          <th className="text-right px-3 py-2 font-medium">Slippage</th>
                          <th className="text-right px-3 py-2 font-medium">Spread</th>
                          <th className="text-right px-3 py-2 font-medium">Net P/L</th>
                          <th className="text-right px-3 py-2 font-medium">Capital</th>
                          <th className="text-right px-3 py-2 font-medium">Cum. P/L</th>
                          <th className="text-right px-3 py-2 font-medium">Price</th>
                          <th className="text-right px-3 py-2 font-medium">Price Chg</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.trades.map((t, idx) => (
                          <tr
                            key={t.n}
                            draggable
                            onDragStart={handleRowDragStart(idx)}
                            onDragOver={handleRowDragOver(idx)}
                            onDrop={handleRowDrop(idx)}
                            onDragEnd={handleRowDragEnd}
                            className={`border-b border-zinc-800/60 hover:bg-zinc-800/20 cursor-grab active:cursor-grabbing transition-colors ${
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
                              onClick={() => toggleTradeResult(idx)}
                              title="Click to flip this trade's result"
                              className={`px-3 py-1.5 border-l-2 cursor-pointer select-none hover:brightness-125 transition ${
                                t.win ? "border-emerald-400 text-emerald-400" : "border-red-400 text-red-400"
                              }`}
                            >
                              {t.win ? "WIN" : "LOSS"}
                            </td>
                            <td className="px-3 py-1.5 text-right">{fmtMoney(t.risk)}</td>
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
                            <td className="px-3 py-1.5 text-right text-zinc-400">{fmtMoney(t.price)}</td>
                            <td
                              className="px-3 py-1.5 text-right"
                              style={{ color: t.price - t.entryPrice >= 0 ? "#05DF72" : "#FF692A" }}
                            >
                              {t.price - t.entryPrice >= 0 ? "+" : ""}
                              {fmtMoney(t.price - t.entryPrice)}
                            </td>
                          </tr>
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

      {mode !== "builder" && <DraggableRunButton onRun={handleRun} />}
    </div>
  );
}