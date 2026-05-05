export function exportCsv(filename, rows) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]).filter((key) => typeof rows[0][key] !== 'object');
  const csv = [headers.join(','), ...rows.map((row) => headers.map((key) => JSON.stringify(row[key] ?? '')).join(','))].join('\n');
  download(filename, csv, 'text/csv;charset=utf-8');
}

export function exportJson(filename, payload) {
  download(filename, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
}

export function printToPdf() {
  window.print();
}

function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
