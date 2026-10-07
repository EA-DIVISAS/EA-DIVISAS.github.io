/**
 * Comprobante de operación cripto — documento PARA EL CLIENTE.
 *
 * Muestra lo que pagó y lo que recibió; nunca el costo ni la utilidad de EA.
 * Se abre en una ventana nueva y lanza la impresión (desde ahí se guarda como
 * PDF). El logo va redibujado en SVG (no la captura .jpg oscura) para que se
 * vea nítido y con color de marca sobre papel blanco.
 */
import { fmtDate, fmtMoney, fmtNumber } from '../format';
import { OPERATION_STATUS_LABELS, type OperationStatus } from '../domain/operation-status';
import { importeConLetra } from './numero-a-letras';

const NAVY = '#1b2a5c';
const ACCENT = '#2f74ff';

/** Marca EA DIVISAS en vector: tres barras (E) + A con corte triangular + "DIVISAS". */
export function eaLogoSvg({ height = 56, color = NAVY, withText = true } = {}) {
  const vbH = withText ? 345 : 248;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 490 ${vbH}" height="${height}" aria-label="EA Divisas" role="img">
  <g fill="${color}">
    <rect x="0" y="0" width="208" height="60"/>
    <rect x="0" y="93" width="208" height="60"/>
    <rect x="0" y="187" width="208" height="61"/>
    <path fill-rule="evenodd" d="M210 248 L302 0 L389 0 L488 248 Z M347 145 L307 248 L387 248 Z"/>
    ${withText ? `<text x="244" y="335" text-anchor="middle" font-family="Montserrat, 'Segoe UI', Arial, sans-serif" font-weight="700" font-size="62" letter-spacing="17">DIVISAS</text>` : ''}
  </g>
</svg>`;
}

const STAMP_COLORS: Record<string, string> = {
  completada: '#0f8a55',
  enviada: '#2f74ff',
  en_proceso: '#2f74ff',
  pendiente: '#c27b00',
  con_incidencia: '#c27b00',
  cotizacion: '#5b6584',
  cancelada: '#c4223e',
  reembolsada: '#c4223e',
};

/** Código corto y estable para cotejar el comprobante contra el sistema. */
function verificationCode(op: any): string {
  const raw = String(op.id ?? op.folio ?? '').replace(/-/g, '').toUpperCase();
  return (raw.slice(0, 12).match(/.{1,4}/g) ?? []).join('-');
}

function cryptoDetailOf(op: any): any {
  const d = op.crypto_transactions;
  return (Array.isArray(d) ? d[0] : d) ?? {};
}

export function openCryptoReceipt(op: any) {
  const d = cryptoDetailOf(op);
  const qty = Number(d.quantity ?? 0);
  const price = Number(d.sell_price ?? 0);
  const subtotal = qty * price;
  const fee = Number(d.customer_fee_amount ?? 0);
  const feePct = Number(d.customer_fee_percent ?? 0);
  const total = Number(d.total_revenue ?? op.gross_revenue ?? subtotal + fee);
  const asset = d.crypto_asset_code ?? '';
  const network = d.crypto_networks?.network_name ?? '';
  const status = String(op.status ?? '');
  const statusLabel = OPERATION_STATUS_LABELS[status as OperationStatus] ?? status;
  const stampColor = STAMP_COLORS[status] ?? '#5b6584';
  const qtyText = qty.toLocaleString('es-MX', { maximumFractionDigits: 8 });
  const issued = new Date().toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' });

  const kv = (label: string, value: string, mono = false) =>
    value ? `<div class="kv"><span>${esc(label)}</span><b${mono ? ' class="mono"' : ''}>${esc(value)}</b></div>` : '';

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Comprobante ${esc(op.folio)} — EA Divisas</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Montserrat:wght@700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  @page { size: letter; margin: 12mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; background: #e9ecf2; font-family: Inter, 'Segoe UI', Arial, sans-serif; color: #141a2b; font-size: 12.5px; }
  .toolbar { position: sticky; top: 0; display: flex; justify-content: center; gap: 10px; padding: 12px; background: #0a0e1a; }
  .toolbar button { font: 600 13px Inter, sans-serif; padding: 9px 18px; border-radius: 6px; border: 1px solid #2f74ff; background: #2f74ff; color: #fff; cursor: pointer; }
  .toolbar button.ghost { background: transparent; color: #c7cede; border-color: #3a4a7a; }
  .sheet { position: relative; width: 216mm; min-height: 279mm; margin: 18px auto; background: #fff; padding: 16mm 16mm 14mm; box-shadow: 0 6px 30px rgba(10,14,26,.18); overflow: hidden; }
  .sheet::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 6px; background: linear-gradient(90deg, ${NAVY} 0 70%, ${ACCENT} 70% 100%); }
  .watermark { position: absolute; left: 50%; top: 52%; transform: translate(-50%, -50%) rotate(-18deg); opacity: .022; pointer-events: none; }
  header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 14px; border-bottom: 1.5px solid ${NAVY}; }
  .brand { display: flex; align-items: center; gap: 14px; }
  .brand-meta { font-size: 10.5px; color: #5b6584; line-height: 1.5; border-left: 1px solid #d5dae5; padding-left: 14px; }
  .brand-meta b { display: block; color: ${NAVY}; font-size: 11.5px; letter-spacing: .04em; }
  .doc { text-align: right; }
  .doc-type { font-size: 10px; font-weight: 700; letter-spacing: .16em; color: #5b6584; text-transform: uppercase; }
  .doc-title { font-size: 19px; font-weight: 700; color: ${NAVY}; margin: 3px 0 8px; letter-spacing: -.01em; }
  .folio { display: inline-block; border: 1.5px solid ${NAVY}; border-radius: 4px; padding: 5px 10px; text-align: left; }
  .folio span { display: block; font-size: 9px; letter-spacing: .14em; color: #5b6584; font-weight: 700; }
  .folio b { font-family: 'IBM Plex Mono', Consolas, monospace; font-size: 14px; color: ${NAVY}; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 28px; margin-top: 16px; }
  .kv { display: flex; justify-content: space-between; gap: 12px; padding: 6px 0; border-bottom: 1px dotted #c9cfdc; }
  .kv span { color: #5b6584; }
  .kv b { font-weight: 600; text-align: right; }
  .mono { font-family: 'IBM Plex Mono', Consolas, monospace; font-weight: 500 !important; font-size: 11.5px; word-break: break-all; }
  h2 { font-size: 10px; letter-spacing: .16em; text-transform: uppercase; color: ${NAVY}; margin: 22px 0 8px; display: flex; align-items: center; gap: 10px; }
  h2::after { content: ''; flex: 1; height: 1px; background: #d5dae5; }
  .hero { display: grid; grid-template-columns: 1fr 1fr; border: 1.5px solid ${NAVY}; border-radius: 6px; overflow: hidden; margin-top: 18px; position: relative; }
  .hero > div { padding: 14px 16px; }
  .hero .recv { background: #f3f5fa; border-right: 1px solid #d5dae5; }
  .hero .lbl { font-size: 9.5px; letter-spacing: .14em; text-transform: uppercase; color: #5b6584; font-weight: 700; }
  .hero .big { font-family: 'IBM Plex Mono', Consolas, monospace; font-size: 24px; font-weight: 500; color: ${NAVY}; margin-top: 4px; letter-spacing: -.02em; }
  .hero .big small { font-size: 13px; color: #5b6584; }
  .hero .note { font-size: 11px; color: #5b6584; margin-top: 3px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 9.5px; letter-spacing: .12em; text-transform: uppercase; color: #5b6584; font-weight: 700; padding: 8px 10px; background: #f3f5fa; border-bottom: 1px solid #c9cfdc; }
  td { padding: 9px 10px; border-bottom: 1px solid #e3e7ef; }
  .r { text-align: right; font-family: 'IBM Plex Mono', Consolas, monospace; }
  tr.total td { border-top: 1.5px solid ${NAVY}; border-bottom: none; font-weight: 700; font-size: 14px; color: ${NAVY}; background: #f3f5fa; }
  .letra { margin-top: 8px; padding: 8px 10px; border: 1px dashed #c9cfdc; border-radius: 4px; font-size: 11px; }
  .letra span { color: #5b6584; }
  .stamp { position: relative; width: 30mm; height: 30mm; margin-top: -16mm; border: 2.5px solid ${stampColor}; border-radius: 50%; color: ${stampColor}; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; transform: rotate(-14deg); opacity: .82; }
  .stamp::before { content: ''; position: absolute; inset: 3px; border: 1px solid ${stampColor}; border-radius: 50%; }
  .stamp small { font-size: 7.5px; letter-spacing: .14em; font-weight: 700; }
  .stamp b { font-size: 12px; letter-spacing: .06em; margin: 3px 0; text-transform: uppercase; }
  .signs { display: grid; grid-template-columns: 1fr auto 1fr; gap: 28px; align-items: end; margin-top: 56px; }
  .signs > div:not(.stamp) { border-top: 1px solid #141a2b; padding-top: 6px; text-align: center; font-size: 10.5px; color: #5b6584; }
  .signs b { display: block; color: #141a2b; font-size: 11px; }
  footer { position: absolute; left: 16mm; right: 16mm; bottom: 10mm; display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; font-size: 9.5px; color: #7a839c; border-top: 1px solid #d5dae5; padding-top: 8px; line-height: 1.5; }
  .verify { text-align: right; white-space: nowrap; }
  .verify b { font-family: 'IBM Plex Mono', Consolas, monospace; color: ${NAVY}; font-size: 11px; letter-spacing: .06em; }
  @media print {
    body { background: #fff; }
    .toolbar { display: none; }
    .sheet { margin: 0; width: auto; min-height: 255mm; box-shadow: none; padding: 6mm 4mm 0; }
    footer { left: 4mm; right: 4mm; bottom: 0; }

  }
</style></head><body>
<div class="toolbar"><button onclick="window.print()">Guardar como PDF / Imprimir</button><button class="ghost" onclick="window.close()">Cerrar</button></div>
<div class="sheet">
  <div class="watermark">${eaLogoSvg({ height: 420, withText: false })}</div>

  <header>
    <div class="brand">
      ${eaLogoSvg({ height: 58 })}
      <div class="brand-meta"><b>EA DIVISAS</b>Operaciones con activos digitales<br>Compra · Venta · Transferencia</div>
    </div>
    <div class="doc">
      <div class="doc-type">Comprobante de operación</div>
      <div class="doc-title">Activos digitales</div>
      <div class="folio"><span>FOLIO</span><b>${esc(op.folio)}</b></div>
    </div>
  </header>

  <div class="grid">
    <div>
      ${kv('Cliente', titleCase(op.clients?.name ?? 'Público en general'))}
      ${kv('Teléfono', op.clients?.phone ?? '')}
      ${kv('Correo', op.clients?.email ?? '')}
    </div>
    <div>
      ${kv('Fecha de operación', fmtDate(op.operation_date))}
      ${kv('Tipo', 'Venta de activo digital al cliente')}
      ${kv('Referencia', op.reference ?? '')}
    </div>
  </div>

  <div class="hero">
    <div class="recv">
      <div class="lbl">El cliente recibe</div>
      <div class="big">${esc(qtyText)} <small>${esc(asset)}</small></div>
      <div class="note">${network ? `Red ${esc(network)}` : '&nbsp;'}</div>
    </div>
    <div>
      <div class="lbl">Total pagado</div>
      <div class="big">${esc(fmtMoney(total))} <small>MXN</small></div>
      <div class="note">Precio unitario ${esc(fmtMoney(price))}</div>
    </div>
  </div>



  <h2>Desglose</h2>
  <table>
    <thead><tr><th>Concepto</th><th class="r" style="text-align:right">Cantidad</th><th class="r" style="text-align:right">Precio unitario</th><th class="r" style="text-align:right">Importe</th></tr></thead>
    <tbody>
      <tr><td>${esc(asset)}${network ? ` — red ${esc(network)}` : ''}</td><td class="r">${esc(qtyText)}</td><td class="r">${esc(fmtMoney(price))}</td><td class="r">${esc(fmtMoney(subtotal))}</td></tr>
      ${fee ? `<tr><td>Comisión por servicio${feePct ? ` (${esc(fmtNumber(feePct, 2))}%)` : ''}</td><td class="r">—</td><td class="r">—</td><td class="r">${esc(fmtMoney(fee))}</td></tr>` : ''}
      <tr class="total"><td colspan="3">Total pagado (MXN)</td><td class="r">${esc(fmtMoney(total))}</td></tr>
    </tbody>
  </table>
  <div class="letra"><span>Importe con letra:</span> <b>${esc(importeConLetra(total))}</b></div>

  ${
    d.wallet_destination_address || d.tx_hash || d.wallet_origin_address
      ? `<h2>Datos en blockchain</h2>
  ${kv('Wallet de destino', d.wallet_destination_address ?? '', true)}
  ${kv('Wallet de origen', d.wallet_origin_address ?? '', true)}
  ${kv('Hash de transacción (TX)', d.tx_hash ?? '', true)}`
      : ''
  }

  ${op.observations ? `<h2>Observaciones</h2><div style="font-size:11.5px;line-height:1.55">${esc(op.observations)}</div>` : ''}

  <div class="signs">
    <div><b>EA Divisas</b>Nombre y firma de quien entrega</div>
    <div class="stamp"><small>EA DIVISAS</small><b>${esc(statusLabel)}</b><small>${esc(fmtDate(op.operation_date))}</small></div>
    <div><b>${esc(titleCase(op.clients?.name ?? 'Cliente'))}</b>Nombre y firma de conformidad</div>
  </div>

  <footer>
    <div>Documento emitido por el Sistema de Operaciones de EA Divisas el ${esc(issued.replace(/\.$/, ''))}.<br>
    Las operaciones con activos digitales son irreversibles una vez confirmadas en la red. Conserve este comprobante.</div>
    <div class="verify">Código de verificación<br><b>${esc(verificationCode(op))}</b></div>
  </footer>
</div>
<script>
  // Espera a que carguen las fuentes para que el PDF salga con la tipografía correcta.
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(function(){ setTimeout(function(){ window.print(); }, 250); });
</script>
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) {
    window.alert('El navegador bloqueó la ventana del comprobante. Permite ventanas emergentes para este sitio e inténtalo de nuevo.');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function titleCase(s: string): string {
  return s.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
