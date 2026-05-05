import { rankingHistory } from '../data/rankings.js';
import { opportunities } from '../data/opportunities.js';

export const dataRepository = {
  getRankingHistory(filters = {}) {
    return rankingHistory.filter((record) => {
      const withinYears = record.year >= (filters.startYear ?? 0) && record.year <= (filters.endYear ?? 9999);
      const sectorMatch = !filters.sector || filters.sector === 'Todos' || record.sector === filters.sector;
      const sizeMatch = !filters.size || filters.size === 'Todas' || record.size === filters.size;
      const searchMatch = !filters.search || record.company.toLowerCase().includes(filters.search.toLowerCase());
      return withinYears && sectorMatch && sizeMatch && searchMatch;
    });
  },
  getOpportunities() {
    return opportunities;
  },
  getSectors() {
    return [...new Set(rankingHistory.map((record) => record.sector))].sort();
  },
  getCompanies() {
    return [...new Set(rankingHistory.map((record) => record.company))].sort();
  },
  getYearRange() {
    const years = rankingHistory.map((record) => record.year);
    return [Math.min(...years), Math.max(...years)];
  }
};
