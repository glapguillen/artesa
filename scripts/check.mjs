import { access, readFile } from 'node:fs/promises';

const required = [
  'index.html',
  'src/main.js',
  'src/styles.css',
  'src/data/rankings.js',
  'src/data/opportunities.js',
  'src/services/dataRepository.js',
  'src/services/analyticsService.js',
  'src/services/aiService.js',
  'src/services/exportService.js'
];

await Promise.all(required.map((file) => access(file)));
const html = await readFile('index.html', 'utf8');
if (!html.includes('src/main.js')) throw new Error('index.html must load src/main.js');
const app = await readFile('src/main.js', 'utf8');
for (const phrase of ['Reasoning', 'Conclusión', 'Ranking histórico', 'Oportunidades e IA']) {
  if (!app.includes(phrase)) throw new Error(`Missing expected dashboard phrase: ${phrase}`);
}
console.log(`Checked ${required.length} required files and core dashboard labels.`);
