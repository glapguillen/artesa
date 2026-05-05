export function answerQuestion(question, rankings, opportunities) {
  const normalized = question.toLowerCase();
  const reasoning = [
    'Primero se revisa el dataset local de rankings históricos, sectores, tamaños de empresa y oportunidades calculadas.',
    'Después se evalúan señales cuantitativas: mejora de ranking, crecimiento de ingresos, score de oportunidad, riesgo y proyecciones a 3, 5 y 7 años.',
    'Si la pregunta requiere datos externos en producción, el backend debe activar recuperación web con citas; esta demo deja señaladas las fuentes necesarias.'
  ];

  if (!question.trim()) {
    return {
      reasoning,
      conclusion: 'Escribe una pregunta para que el asistente evalúe rankings, sectores, tamaños de empresa u oportunidades de inversión.',
      citations: ['Dataset local: src/data/rankings.js', 'Dataset local: src/data/opportunities.js']
    };
  }

  if (normalized.includes('mediana') || normalized.includes('medium')) {
    const medium = opportunities.filter((item) => item.businessSize === 'Mediana').slice(0, 3);
    return {
      reasoning,
      conclusion: `Para empresas medianas, las mejores oportunidades son ${medium.map((item) => `${item.title} (${item.sector}, score ${item.score})`).join('; ')}. La recomendación prioriza score, demanda y riesgo ajustado.`,
      citations: ['Dataset local: oportunidades y proyecciones calculadas']
    };
  }

  if (normalized.includes('emergente') || normalized.includes('emerging')) {
    const emerging = opportunities.filter((item) => item.isEmerging);
    return {
      reasoning,
      conclusion: `Las oportunidades emergentes detectadas son: ${emerging.map((item) => `${item.title} en ${item.sector}`).join('; ')}. Se marcaron por alto score, demanda superior y competencia controlada.`,
      citations: ['Modelo local de detección: src/services/analyticsService.js']
    };
  }

  if (normalized.includes('ranking') || normalized.includes('empresa')) {
    const latestYear = Math.max(...rankings.map((record) => record.year));
    const leaders = rankings.filter((record) => record.year === latestYear).sort((a, b) => a.rank - b.rank).slice(0, 5);
    return {
      reasoning,
      conclusion: `En ${latestYear}, el ranking líder es: ${leaders.map((record) => `#${record.rank} ${record.company} (${record.sector})`).join('; ')}.`,
      citations: ['Dataset local: src/data/rankings.js']
    };
  }

  const best = opportunities.slice(0, 3);
  return {
    reasoning,
    conclusion: `Con los datos disponibles, las oportunidades de mayor prioridad son ${best.map((item) => `${item.title} (${item.businessSize}, retorno proyectado 5 años ${item.projection5Year}%)`).join('; ')}. Para una respuesta más robusta sobre mercado externo, conecte el endpoint de búsqueda web con citas.`,
    citations: ['Dataset local y modelo explicable de proyección']
  };
}
