/**
 * Utilidades del módulo Cripto que comparten la pantalla de operaciones y el
 * panel de clientes cripto: métricas, exportación a Excel y comprobante.
 *
 * Todo trabaja sobre las filas que devuelve `useOperations('cripto')`
 * (operations + clients(name) + crypto_transactions(*)). Los montos ya vienen
 * calculados y guardados por el servidor (calc-engine) — aquí solo se suman y
 * se presentan, nunca se recalcula la utilidad.
 */
import { toLocalDateString } from '../format';
import { OPERATION_STATUS_LABELS, type OperationStatus } from '../domain/operation-status';

/** Mismo criterio que `divisas.is_profit_counted()` en la base. */
const PROFIT_STATUSES = new Set(['completada', 'enviada', 'en_proceso', 'con_incidencia']);

export function isCounted(op: any): boolean {
  return !op.is_demo && PROFIT_STATUSES.has(op.status);
}

export function cryptoDetail(op: any): any {
  const d = op.crypto_transactions;
  return Array.isArray(d) ? d[0] : d;
}

export interface CryptoTotals {
  operations: number;
  volume: number;
  commissions: number;
  spread: number;
  costs: number;
  netProfit: number;
}

export function cryptoTotals(ops: any[]): CryptoTotals {
  const t: CryptoTotals = { operations: 0, volume: 0, commissions: 0, spread: 0, costs: 0, netProfit: 0 };
  for (const op of ops) {
    if (!isCounted(op)) continue;
    const d = cryptoDetail(op);
    t.operations += 1;
    t.volume += Number(op.gross_revenue ?? 0);
    t.commissions += Number(d?.customer_fee_amount ?? 0);
    t.spread += Number(d?.spread_buy ?? 0) + Number(d?.spread_sell ?? 0);
    t.costs += Number(d?.provider_fee_buy ?? 0) + Number(d?.provider_fee_sell ?? 0) + Number(d?.network_fee ?? 0);
    t.netProfit += Number(op.net_profit ?? 0);
  }
  return t;
}

export function monthStart(d = new Date()): string {
  return toLocalDateString(new Date(d.getFullYear(), d.getMonth(), 1));
}

// ---------- Excel ----------

export function cryptoExcelRows(ops: any[]) {
  return ops.map((op) => {
    const d = cryptoDetail(op);
    return {
      Folio: op.folio,
      Fecha: op.operation_date,
      Cliente: op.clients?.name ?? '',
      Estado: OPERATION_STATUS_LABELS[op.status as OperationStatus] ?? op.status,
      Cripto: d?.crypto_asset_code ?? '',
      Cantidad: Number(d?.quantity ?? 0),
      'Precio mercado': Number(d?.market_price ?? 0),
      'Precio compra': Number(d?.buy_price ?? 0),
      'Precio venta': Number(d?.sell_price ?? 0),
      'Comisión %': Number(d?.customer_fee_percent ?? 0),
      'Comisión fija': Number(d?.customer_fee_fixed ?? 0),
      'Comisión cobrada': Number(d?.customer_fee_amount ?? 0),
      'Total pagado por cliente': Number(d?.total_revenue ?? op.gross_revenue ?? 0),
      'Costo de adquisición': Number(d?.acquisition_cost ?? 0),
      'Spread compra': Number(d?.spread_buy ?? 0),
      'Spread venta': Number(d?.spread_sell ?? 0),
      'Comisión exchange compra': Number(d?.provider_fee_buy ?? 0),
      'Comisión exchange venta': Number(d?.provider_fee_sell ?? 0),
      'Comisión de red (gas)': Number(d?.network_fee ?? 0),
      'Utilidad bruta': Number(op.gross_profit ?? 0),
      'Utilidad neta': Number(op.net_profit ?? 0),
      'Margen %': Number(op.margin_percent ?? 0),
      'TX Hash': d?.tx_hash ?? '',
      'Wallet origen': d?.wallet_origin_address ?? '',
      'Wallet destino': d?.wallet_destination_address ?? '',
      Referencia: op.reference ?? '',
      Observaciones: op.observations ?? '',
    };
  });
}

export async function exportCryptoExcel(ops: any[], fileTag: string) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(cryptoExcelRows(ops));
  XLSX.utils.book_append_sheet(wb, ws, 'Operaciones cripto');

  const t = cryptoTotals(ops);
  const resumen = XLSX.utils.json_to_sheet([
    { Concepto: 'Operaciones (cuentan para utilidad)', Valor: t.operations },
    { Concepto: 'Volumen vendido (MXN)', Valor: round2(t.volume) },
    { Concepto: 'Comisiones cobradas a clientes', Valor: round2(t.commissions) },
    { Concepto: 'Spread (diferencia de precio)', Valor: round2(t.spread) },
    { Concepto: 'Costos exchange + red', Valor: round2(t.costs) },
    { Concepto: 'Utilidad neta', Valor: round2(t.netProfit) },
  ]);
  XLSX.utils.book_append_sheet(wb, resumen, 'Resumen');

  const safeTag = fileTag.replace(/[^\w-]+/g, '_');
  XLSX.writeFile(wb, `EA-Divisas_cripto_${safeTag}_${toLocalDateString(new Date())}.xlsx`);
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export { openCryptoReceipt } from './receipt';

/**
 * Clientes de cripto = SOLO los de cripto: los marcados como `cripto`, más los
 * que todavía no tienen categoría pero ya operaron cripto. Un cliente marcado
 * como de transferencias o efectivo nunca aparece en la sección cripto.
 */
export function isCryptoClient(client: any, clientIdsWithCryptoOps: Set<string>): boolean {
  if (client.primary_module === 'cripto') return true;
  return !client.primary_module && clientIdsWithCryptoOps.has(client.id);
}

export function cryptoClientIds(ops: any[] | undefined): Set<string> {
  return new Set((ops ?? []).map((op) => op.client_id).filter(Boolean));
}
