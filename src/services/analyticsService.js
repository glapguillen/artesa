const riskPenalty = { Bajo: 4, Medio: 8, Alto: 13 };

export function projectCompound(base, annualGrowthPercent, years) {
  return Number((base * Math.pow(1 + annualGrowthPercent / 100, years)).toFixed(1));
}

export function analyzeOpportunity(opportunity) {
  const efficiency = opportunity.automationPotential * 0.18;
  const demand = opportunity.demandGrowth * 0.42;
  const returnScore = opportunity.baseReturn * 1.15;
  const competitionDiscount = opportunity.competitionIntensity * 0.16;
  const score = Math.max(0, Math.min(100, demand + efficiency + returnScore - competitionDiscount - riskPenalty[opportunity.risk] + 45));
  const projectedGrowth = opportunity.demandGrowth * 0.32 + opportunity.automationPotential * 0.07 - opportunity.competitionIntensity * 0.04;
  const isEmerging = score >= 72 && opportunity.demandGrowth >= 28 && opportunity.competitionIntensity <= 56;

  return {
    ...opportunity,
    score: Number(score.toFixed(1)),
    isEmerging,
    projection3Year: projectCompound(opportunity.baseReturn, projectedGrowth, 3),
    projection5Year: projectCompound(opportunity.baseReturn, projectedGrowth, 5),
    projection7Year: projectCompound(opportunity.baseReturn, projectedGrowth, 7),
    reasoning: [
      `Demanda sectorial estimada en ${opportunity.demandGrowth}% y retorno base de ${opportunity.baseReturn}%.`,
      `Potencial de automatización de ${opportunity.automationPotential}/100, útil para escalar margen operativo.`,
      `Riesgo ${opportunity.risk.toLowerCase()} y competencia ${opportunity.competitionIntensity}/100 ajustan el score final.`
    ]
  };
}

export function analyzeOpportunities(opportunities) {
  return opportunities.map(analyzeOpportunity).sort((a, b) => b.score - a.score);
}

export function getCompanyTrend(records, company) {
  return records
    .filter((record) => record.company === company)
    .sort((a, b) => a.year - b.year)
    .map((record) => ({ year: record.year, value: record.rank }));
}

export function detectRankingMomentum(records) {
  const byCompany = new Map();
  records.forEach((record) => byCompany.set(record.company, [...(byCompany.get(record.company) ?? []), record]));

  return [...byCompany.entries()]
    .map(([company, rows]) => {
      const sorted = rows.sort((a, b) => a.year - b.year);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const rankImprovement = first.rank - last.rank;
      const revenueGrowth = ((last.revenue - first.revenue) / first.revenue) * 100;
      return { company, rankImprovement, revenueGrowth };
    })
    .filter((item) => item.rankImprovement >= 4 || item.revenueGrowth >= 100)
    .sort((a, b) => b.rankImprovement - a.rankImprovement)
    .map((item) => `${item.company}: mejora ${item.rankImprovement} posiciones y crece ${item.revenueGrowth.toFixed(0)}% en ingresos.`);
}

export function buildProjectionSeries(opportunity) {
  return [
    { year: 0, value: opportunity.baseReturn },
    { year: 3, value: opportunity.projection3Year },
    { year: 5, value: opportunity.projection5Year },
    { year: 7, value: opportunity.projection7Year }
  ];
}
