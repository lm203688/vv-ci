// 导出：CSV 与 PDF 都落本地临时目录，再用系统分享面板交给用户（无网络、无账号）
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { toCsv } from './due';

export const TYPE_LABEL = { service: 'Service', fuel: 'Fuel', repair: 'Repair', other: 'Other' };
const typeLabel = (t) => TYPE_LABEL[t] || t;

function safeName(s) {
  return String(s || 'vehicle').replace(/[^A-Za-z0-9\u4e00-\u9fa5_-]+/g, '-').slice(0, 40);
}

export function buildCsv(vehicle, logs) {
  const rows = logs.map((l) => ({
    date: l.date,
    type: typeLabel(l.type),
    odometer: l.odometer,
    cost: l.cost,
    vendor: l.vendor,
    notes: l.notes,
  }));
  return toCsv(rows);
}

export async function exportCsvToFile(vehicle, logs) {
  const name = `${safeName(vehicle.nickname)}-logs.csv`;
  const uri = FileSystem.cacheDirectory + name;
  await FileSystem.writeAsStringAsync(uri, buildCsv(vehicle, logs), { encoding: FileSystem.EncodingType.UTF8 });
  const info = await FileSystem.getInfoAsync(uri);
  return { uri, size: info.exists ? info.size : 0 };
}

export async function exportCsv(vehicle, logs) {
  const { uri } = await exportCsvToFile(vehicle, logs);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'Export CSV', UTI: 'public.comma-separated-values-text' });
  }
  return uri;
}

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function buildPdfHtml(vehicle, items, logs, computed) {
  const rows = logs.map((l) => `<tr><td>${esc(l.date)}</td><td>${esc(typeLabel(l.type))}</td><td>${esc(l.odometer)}</td><td>${l.cost != null ? '$' + esc(l.cost) : ''}</td><td>${esc(l.vendor)}</td></tr>`).join('');
  const dues = computed.map(({ item, due }) => `<tr><td>${esc(item.name)}</td><td>${esc(item.interval_miles)} mi / ${esc(item.interval_months)} mo</td><td>${esc(due.nextDueDate || '-')}</td><td>${esc(due.status)}</td></tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,Helvetica,Arial;color:#1F2937;padding:24px}
    h1{font-size:20px;margin:0 0 4px}
    .sub{color:#6B7280;font-size:12px;margin-bottom:18px}
    h2{font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:#6B7280;margin:22px 0 8px}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th,td{text-align:left;padding:7px 6px;border-bottom:1px solid #E5E7EB}
    th{color:#6B7280;font-weight:600}
  </style></head><body>
    <h1>${esc(vehicle.nickname)}</h1>
    <div class="sub">${esc([vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' '))} · ${esc(vehicle.odometer)} mi · updated ${esc(vehicle.odometer_updated_at || '-')}</div>
    <h2>Service items</h2><table><tr><th>Item</th><th>Interval</th><th>Next due</th><th>Status</th></tr>${dues}</table>
    <h2>Logs</h2><table><tr><th>Date</th><th>Type</th><th>Odometer</th><th>Cost</th><th>Vendor</th></tr>${rows || '<tr><td colspan="5">No records yet</td></tr>'}</table>
    <div class="sub" style="margin-top:22px">Generated locally on this device. No data left the phone.</div>
  </body></html>`;
}

export async function exportPdfToFile(vehicle, items, logs, computed) {
  const { uri } = await Print.printToFileAsync({ html: buildPdfHtml(vehicle, items, logs, computed) });
  const info = await FileSystem.getInfoAsync(uri);
  return { uri, size: info.exists ? info.size : 0 };
}

export async function exportPdf(vehicle, items, logs, computed) {
  const { uri } = await exportPdfToFile(vehicle, items, logs, computed);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Export PDF', UTI: 'com.adobe.pdf' });
  }
  return uri;
}
