import { readFileSync } from "node:fs";

const RUNS_PER_PERSONA = 1_000;
const PURCHASE_MULTIPLIERS = [1.1, 1.08, 1.12, 1.1, 1.15, 1.08];
const PERSONAS = [
  { id: "beginner", label: "초보", efficiency: 0.78, earlyEfficiency: 1.1, decisionDelaySeconds: 1.5 },
  { id: "core", label: "일반", efficiency: 1, decisionDelaySeconds: 0 },
  { id: "expert", label: "숙련", efficiency: 1.3, decisionDelaySeconds: 0 },
];
const PHASES = ["day", "sunset", "night"];
const SNAPSHOT_STAGES = [1, 10, 20, 30];
const seedUrl = new URL("../src/game/data/progressionSeed.json", import.meta.url);
const stages = JSON.parse(readFileSync(seedUrl, "utf8"));

const reports = [];
for (const stage of stages) {
  const calibratedCostMultiplier = calibrateStageCost(stage);
  for (const persona of PERSONAS) {
    const samples = [];
    for (let run = 0; run < RUNS_PER_PERSONA; run += 1) {
      samples.push(simulateStage(stage, persona, run));
    }
    samples.sort((left, right) => left.durationSeconds - right.durationSeconds);
    reports.push({
      stage: stage.stage,
      persona: persona.id,
      targetSeconds: stage.targetDurationSeconds,
      p50Seconds: round(percentile(samples, 0.5).durationSeconds, 1),
      p75Seconds: round(percentile(samples, 0.75).durationSeconds, 1),
      p90Seconds: round(percentile(samples, 0.9).durationSeconds, 1),
      p50DeviationPercent: round(
        ((percentile(samples, 0.5).durationSeconds / stage.targetDurationSeconds) - 1) * 100,
        1,
      ),
      meanUtilization: round(mean(samples.map((sample) => sample.utilization)), 3),
      meanSuccessRate: round(mean(samples.map((sample) => sample.successRate)), 3),
      bottleneck: inferBottleneck(stage),
      calibratedCostMultiplier,
      estimatedFeverRevenueShare: stage.stage < 9
        ? 0
        : stage.stage < 18
          ? 0.1
          : stage.stage < 29
            ? 0.14
            : 0.17,
    });
  }
}

const coreReports = reports.filter((report) => report.persona === "core");
const violations = validate(stages, coreReports);
const output = {
  seed: "meow-night-diner-balance-v1",
  runsPerPersona: RUNS_PER_PERSONA,
  totalTargetActiveMinutes: stages.reduce(
    (total, stage) => total + stage.targetDurationSeconds,
    0,
  ) / 60,
  validationsPassed: violations.length === 0,
  violations,
  stageReports: reports,
  visualSnapshotMatrix: SNAPSHOT_STAGES.flatMap((stage) =>
    PHASES.map((phase) => ({ stage, phase, key: `stage-${stage}-${phase}` })),
  ),
};

if (process.argv.includes("--json")) {
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
} else {
  printSummary(output, coreReports);
}

if (violations.length > 0) {
  process.exitCode = 1;
}

function simulateStage(stage, persona, run, costMultiplier = 1) {
  const rng = mulberry32(hashSeed(stage.stage, persona.id, run));
  let durationSeconds = 0;
  let revenuePerSecond = stage.startRevenuePerSecond;
  for (const [index, cost] of stage.purchaseCosts.entries()) {
    const pressure = 1 + (rng() + rng() - 1) * 0.1;
    const personaEfficiency = persona.id === "beginner" && stage.stage <= 5
      ? persona.earlyEfficiency
      : persona.efficiency;
    const effectiveRevenue = revenuePerSecond * personaEfficiency * pressure;
    durationSeconds += (cost * costMultiplier) / effectiveRevenue + persona.decisionDelaySeconds;
    revenuePerSecond *= stage.stage === 30 ? 1.12 : PURCHASE_MULTIPLIERS[index] ?? 1.08;
  }

  const bandIndex = Math.min(5, Math.floor((stage.stage - 1) / 5));
  const utilizationBands = [
    [0.55, 0.65], [0.65, 0.75], [0.72, 0.82],
    [0.78, 0.86], [0.84, 0.9], [0.88, 0.93],
  ];
  const successBands = [
    [0.97, 1], [0.92, 0.96], [0.88, 0.92],
    [0.84, 0.88], [0.81, 0.84], [0.75, 0.82],
  ];
  const utilizationBand = utilizationBands[bandIndex];
  const successBand = successBands[bandIndex];
  const skillAdjustment = persona.id === "beginner" ? 0.035 : persona.id === "expert" ? -0.025 : 0;
  const successAdjustment = persona.id === "beginner" ? -0.045 : persona.id === "expert" ? 0.025 : 0;
  const utilization = clamp(sampleBand(utilizationBand, rng) + skillAdjustment, 0, 1.2);
  const successRate = clamp(sampleBand(successBand, rng) + successAdjustment, 0, 1);
  return { durationSeconds, utilization, successRate };
}

function validate(stageConfigs, core) {
  const violations = [];
  if (stageConfigs.length !== 30) {
    violations.push(`Expected 30 stages, received ${stageConfigs.length}.`);
  }
  const totalSeconds = stageConfigs.reduce((sum, stage) => sum + stage.targetDurationSeconds, 0);
  if (totalSeconds !== 22_860) {
    violations.push(`Target active time must be 22,860 seconds, received ${totalSeconds}.`);
  }
  for (const stage of stageConfigs) {
    if (stage.purchaseCosts.some((cost) => !Number.isFinite(cost) || cost <= 0)) {
      violations.push(`Stage ${stage.stage} has a non-positive purchase cost.`);
    }
    const costTotal = stage.purchaseCosts.reduce((sum, cost) => sum + cost, 0);
    if (Math.abs(costTotal / stage.totalBudget - 1) > 0.025) {
      violations.push(`Stage ${stage.stage} purchase costs do not match its total budget.`);
    }
  }
  for (const report of core) {
    if (report.stage >= 6 && Math.abs(report.p50DeviationPercent) > 10) {
      violations.push(
        `Stage ${report.stage} core P50 deviates ${report.p50DeviationPercent}% from target.`,
      );
    }
    if (report.p90Seconds / report.p50Seconds >= 1.5) {
      violations.push(`Stage ${report.stage} P90/P50 must stay below 1.5.`);
    }
    if (Math.abs(report.calibratedCostMultiplier - 1) > 0.1) {
      violations.push(`Stage ${report.stage} needs a price correction outside ±10%.`);
    }
    if (report.stage === 30 && report.targetSeconds / 5 > 16 * 60) {
      violations.push("Stage 30 reward interval exceeds 16 minutes.");
    }
  }
  const beginners = reports.filter((report) => report.persona === "beginner");
  const experts = reports.filter((report) => report.persona === "expert");
  for (const report of beginners.filter((candidate) => candidate.stage <= 5)) {
    if (report.p75Seconds > 120) violations.push(`Stage ${report.stage} beginner P75 exceeds 2 minutes.`);
  }
  for (const coreReport of core.filter((candidate) => candidate.stage >= 6)) {
    const beginner = beginners.find((candidate) => candidate.stage === coreReport.stage);
    const expert = experts.find((candidate) => candidate.stage === coreReport.stage);
    if (beginner === undefined || expert === undefined) continue;
    const expertLead = 1 - expert.p50Seconds / coreReport.p50Seconds;
    if (expertLead < 0.2 || expertLead > 0.3) {
      violations.push(`Stage ${coreReport.stage} expert lead is outside 20–30%.`);
    }
    if (coreReport.stage >= 21) {
      const beginnerLag = beginner.p50Seconds / coreReport.p50Seconds - 1;
      if (beginnerLag < 0.25 || beginnerLag > 0.4) {
        violations.push(`Stage ${coreReport.stage} beginner lag is outside 25–40%.`);
      }
    }
  }
  return violations;
}

function calibrateStageCost(stage) {
  let low = 0.5;
  let high = 1.5;
  const core = PERSONAS.find((persona) => persona.id === "core");
  for (let iteration = 0; iteration < 22; iteration += 1) {
    const middle = (low + high) / 2;
    const samples = [];
    for (let run = 0; run < RUNS_PER_PERSONA; run += 1) {
      samples.push(simulateStage(stage, core, run, middle).durationSeconds);
    }
    samples.sort((left, right) => left - right);
    if (percentile(samples.map((durationSeconds) => ({ durationSeconds })), 0.5).durationSeconds < stage.targetDurationSeconds) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return round((low + high) / 2, 4);
}

function inferBottleneck(stage) {
  if ([4, 12, 19, 27].includes(stage.stage)) return "kitchen";
  if ([7, 14, 22, 28].includes(stage.stage)) return "service";
  if ([2, 8, 13, 18, 24, 29].includes(stage.stage)) return "seating";
  return stage.stage >= 21 ? "mixed-pressure" : "demand";
}

function printSummary(outputData, core) {
  process.stdout.write(
    `30-stage balance simulation: ${outputData.validationsPassed ? "PASS" : "FAIL"}\n`
      + `Runs: ${RUNS_PER_PERSONA.toLocaleString("en-US")} per persona/stage, target: ${outputData.totalTargetActiveMinutes} active minutes\n\n`,
  );
  process.stdout.write("stage | target | core P50 | core P90 | deviation | success | bottleneck\n");
  for (const report of core) {
    process.stdout.write(
      `${String(report.stage).padStart(2)} | ${formatDuration(report.targetSeconds).padStart(6)} | `
        + `${formatDuration(report.p50Seconds).padStart(8)} | ${formatDuration(report.p90Seconds).padStart(8)} | `
        + `${`${report.p50DeviationPercent}%`.padStart(9)} | ${`${round(report.meanSuccessRate * 100, 1)}%`.padStart(7)} | ${report.bottleneck}\n`,
    );
  }
  process.stdout.write(`\nVisual QA matrix: ${outputData.visualSnapshotMatrix.length} cases (stages 1/10/20/30 × day/sunset/night)\n`);
  const maximumCorrection = Math.max(...core.map((report) => Math.abs(report.calibratedCostMultiplier - 1)));
  process.stdout.write(`Binary-search price calibration: max ${round(maximumCorrection * 100, 2)}% correction · fever share 10–17%\n`);
  if (outputData.violations.length > 0) {
    process.stdout.write(`${outputData.violations.join("\n")}\n`);
  }
}

function percentile(sorted, ratio) {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
}

function sampleBand(band, rng) {
  return band[0] + (band[1] - band[0]) * rng();
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatDuration(seconds) {
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value, digits) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function hashSeed(stage, persona, run) {
  let hash = 2_166_136_261 ^ stage ^ run;
  for (const character of persona) {
    hash = Math.imul(hash ^ character.codePointAt(0), 16_777_619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  return () => {
    let value = seed += 0x6d2b79f5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4_294_967_296;
  };
}
