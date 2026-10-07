import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '../../components/ui/Modal';
import { Hint } from '../../components/ui/Hint';
import { AttachmentsSection } from '../../components/ui/AttachmentsSection';
import { DeleteOperationButton } from '../../components/operations/DeleteOperationButton';
import { AssetChip, ClientAvatar, ClientCell, StatTile, fmtQty } from '../../components/crypto/CryptoUI';
import { ClientDataForm } from '../CryptoClientsPage';
import {
  useClients,
  useCreateOperation,
  useCryptoAssets,
  useCryptoNetworks,
  useOperations,
  useProviders,
  useUpdateCryptoOperation,
  useUpdateOperationStatus,
} from '../../lib/api/hooks';
import { useAuth } from '../../lib/auth/AuthContext';
import { fmtDate, fmtMoney, fmtNumber, fmtPercent } from '../../lib/format';
import { calcCrypto, toDisplayNumber } from '../../lib/calc-engine';
import { OPERATION_STATUS_LABELS, ALLOWED_TRANSITIONS, type OperationStatus } from '../../lib/domain/operation-status';
import { cryptoClientIds, cryptoDetail, cryptoTotals, exportCryptoExcel, isCounted, isCryptoClient, monthStart, openCryptoReceipt } from '../../lib/crypto/crypto-ops';

export function CryptoModulePage() {
  const { data: operations, isLoading } = useOperations('cripto');
  const [showForm, setShowForm] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [asset, setAsset] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const all = useMemo(() => (operations ?? []) as any[], [operations]);
  // El detalle se lee de la lista viva para que un cambio de estado se vea al instante.
  const detailOp = detailId ? all.find((op) => op.id === detailId) ?? null : null;

  const assetsInUse = useMemo(
    () => [...new Set(all.map((op) => cryptoDetail(op)?.crypto_asset_code).filter(Boolean))].sort() as string[],
    [all],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((op) => {
      const d = cryptoDetail(op);
      if (asset && d?.crypto_asset_code !== asset) return false;
      if (from && op.operation_date < from) return false;
      if (to && op.operation_date > to) return false;
      if (q) {
        const hay = [op.folio, op.clients?.name, op.reference, d?.tx_hash, d?.wallet_destination_address, d?.wallet_origin_address]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [all, search, asset, from, to]);

  const monthOps = useMemo(() => all.filter((op) => op.operation_date >= monthStart()), [all]);
  const month = useMemo(() => cryptoTotals(monthOps), [monthOps]);
  const shown = useMemo(() => cryptoTotals(filtered), [filtered]);
  const hasFilters = !!(search || asset || from || to);
  const now = new Date();
  const monthName = now.toLocaleDateString('es-MX', { month: 'long' });
  const today = now.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Top clientes del mes por volumen (mismo criterio de conteo que los KPIs).
  const topClients = useMemo(() => {
    const m = new Map<string, { name: string; volume: number; ops: number }>();
    for (const op of monthOps) {
      if (!isCounted(op) || !op.client_id) continue;
      const cur = m.get(op.client_id) ?? { name: op.clients?.name ?? '—', volume: 0, ops: 0 };
      cur.volume += Number(op.gross_revenue ?? 0);
      cur.ops += 1;
      m.set(op.client_id, cur);
    }
    return [...m.values()].sort((a, b) => b.volume - a.volume).slice(0, 5);
  }, [monthOps]);

  const avgTicket = month.operations ? month.volume / month.operations : 0;
  const effectiveRate = month.volume ? ((month.commissions + month.spread) / month.volume) * 100 : 0;

  function clearFilters() {
    setSearch('');
    setAsset('');
    setFrom('');
    setTo('');
  }

  return (
    <div>
      <div className="cx-hero">
        <div>
          <div className="cx-eyebrow">
            <span className="cx-live" /> Mesa cripto
          </div>
          <h1>Operaciones cripto</h1>
          <div className="cx-hero-sub">{today.charAt(0).toUpperCase() + today.slice(1)}</div>
        </div>
        <div className="cx-actions">
          <Link to="/cripto/clientes" className="btn btn-ghost">
            <IconUsers /> Clientes
          </Link>
          <button className="btn btn-ghost" disabled={filtered.length === 0} onClick={() => exportCryptoExcel(filtered, hasFilters ? 'filtrado' : 'todo')}>
            <IconSheet /> Exportar Excel
          </button>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            + Nueva operación
          </button>
        </div>
      </div>

      <div className="cx-stats">
        <StatTile label={`Volumen · ${monthName}`} value={fmtMoney(month.volume)} sub={plural(month.operations, 'operación', 'operaciones')} accent="var(--electric)" />
        <StatTile label={`Comisiones · ${monthName}`} value={fmtMoney(month.commissions)} sub={`+ ${fmtMoney(month.spread)} de spread`} accent="#26a17b" />
        <StatTile label={`Utilidad neta · ${monthName}`} value={fmtMoney(month.netProfit)} tone={month.netProfit >= 0 ? 'pos' : 'neg'} sub={`margen ${fmtPercent(month.volume ? (month.netProfit / month.volume) * 100 : 0)}`} accent="var(--green)" />
        <StatTile label="Histórico" value={fmtMoney(cryptoTotals(all).netProfit)} sub={plural(cryptoTotals(all).operations, 'operación', 'operaciones')} accent="var(--navy-500)" />
      </div>

      <div className="cx-insights">
        <div className="cx-panel">
          <div className="cx-panel-title">
            <span>Top clientes · {monthName}</span>
            <Link to="/cripto/clientes" style={{ color: 'var(--electric-bright)', textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>
              Ver todos →
            </Link>
          </div>
          {topClients.length === 0 && <div className="cx-dim" style={{ fontSize: 13 }}>Sin operaciones con cliente este mes.</div>}
          {topClients.map((c, i) => (
            <div key={c.name + i} className="cx-rank">
              <span className="cx-rank-n">{i + 1}</span>
              <ClientAvatar name={c.name} size={26} />
              <div className="cx-rank-name">
                <div style={{ textTransform: 'capitalize' }}>{c.name}</div>
                <div className="cx-rank-bar" style={{ width: `${Math.max(6, (c.volume / topClients[0].volume) * 100)}%` }} />
              </div>
              <span className="cx-dim" style={{ fontSize: 12 }}>{c.ops} op.</span>
              <span className="mono" style={{ minWidth: 120, textAlign: 'right' }}>{fmtMoney(c.volume)}</span>
            </div>
          ))}
        </div>
        <div className="cx-panel">
          <div className="cx-panel-title">
            <span>Rendimiento · {monthName}</span>
          </div>
          <div className="cx-metric"><span>Ticket promedio</span><span>{fmtMoney(avgTicket)}</span></div>
          <div className="cx-metric"><span>Ganancia por operación</span><span>{fmtMoney(month.operations ? month.netProfit / month.operations : 0)}</span></div>
          <div className="cx-metric"><span>Tasa efectiva (comisión + spread)</span><span>{fmtPercent(effectiveRate)}</span></div>
          <div className="cx-metric"><span>Costos exchange + red</span><span>{fmtMoney(month.costs)}</span></div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="cx-toolbar">
          <input className="cx-search" placeholder="Buscar cliente, folio, wallet o TX hash…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select value={asset} onChange={(e) => setAsset(e.target.value)} style={{ width: 160 }}>
            <option value="">Todas las cripto</option>
            {assetsInUse.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: 140 }} title="Desde" />
          <span className="cx-dim">→</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: 140 }} title="Hasta" />
          {hasFilters && (
            <button className="cx-icon-btn" onClick={clearFilters}>
              Limpiar
            </button>
          )}
          <span className="cx-count">
            {plural(filtered.length, 'operación', 'operaciones')} · {fmtMoney(shown.volume)}
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="cx-table">
            <thead>
              <tr>
                <th>Operación</th>
                <th>Cliente</th>
                <th>Cripto</th>
                <th className="num" style={{ textAlign: 'right' }}>Total cliente</th>
                <th className="num" style={{ textAlign: 'right' }}>Comisión</th>
                <th className="num" style={{ textAlign: 'right' }}>Utilidad</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={8} className="cx-dim">
                    Cargando…
                  </td>
                </tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="cx-dim" style={{ padding: 28, textAlign: 'center' }}>
                    {all.length === 0 ? 'Sin operaciones todavía. Registra la primera con “+ Nueva operación”.' : 'Ninguna operación coincide con los filtros.'}
                  </td>
                </tr>
              )}
              {filtered.map((op) => (
                <OperationRow key={op.id} op={op} onOpenDetail={() => setDetailId(op.id)} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Nueva operación — Cripto" width={640}>
        <CryptoForm onDone={() => setShowForm(false)} />
      </Modal>

      <Modal open={!!detailOp} onClose={() => setDetailId(null)} title={`Operación ${detailOp?.folio ?? ''}`} width={640}>
        {detailOp && (
          <>
            <StatusBar op={detailOp} />
            <OperationDetail key={detailOp.id} op={detailOp} onDone={() => setDetailId(null)} />
          </>
        )}
      </Modal>
    </div>
  );
}

function OperationRow({ op, onOpenDetail }: { op: any; onOpenDetail: () => void }) {
  const d = cryptoDetail(op);
  const fee = Number(d?.customer_fee_amount ?? 0);
  const profit = Number(op.net_profit ?? 0);

  return (
    <tr onClick={onOpenDetail}>
      <td>
        <div className="cx-folio">{op.folio}</div>
        <div className="cx-date" style={{ fontSize: 12, marginTop: 2 }}>{fmtDate(op.operation_date)}</div>
      </td>
      <td>
        <ClientCell name={op.clients?.name} />
      </td>
      <td>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <AssetChip code={d?.crypto_asset_code} />
          <span className="mono cx-dim" style={{ color: 'var(--ink-200)' }}>{fmtQty(d?.quantity)}</span>
        </span>
      </td>
      <td className="num">{fmtMoney(op.gross_revenue)}</td>
      <td className="num">{fee ? fmtMoney(fee) : <span className="cx-dim">—</span>}</td>
      <td className={`num ${profit >= 0 ? 'pos' : 'neg'}`} style={{ textShadow: 'none', fontWeight: 600 }}>
        {fmtMoney(profit)}
      </td>
      <td>
        <span className={`badge badge-${op.status}`}>{OPERATION_STATUS_LABELS[op.status as OperationStatus]}</span>
      </td>
      <td style={{ textAlign: 'right' }}>
        <button
          className="cx-icon-btn"
          title="Descargar comprobante"
          onClick={(e) => {
            e.stopPropagation();
            openCryptoReceipt(op);
          }}
        >
          <IconDoc /> PDF
        </button>
      </td>
    </tr>
  );
}

/** Estado de la operación + cambio de estado (antes estaba en cada fila de la tabla). */
function StatusBar({ op }: { op: any }) {
  const { mutate: updateStatus, isPending } = useUpdateOperationStatus();
  const nextStates = ALLOWED_TRANSITIONS[op.status as OperationStatus] ?? [];
  return (
    <div className="cx-statusbar">
      <span>Estado</span>
      <span className={`badge badge-${op.status}`}>{OPERATION_STATUS_LABELS[op.status as OperationStatus]}</span>
      {nextStates.length > 0 && (
        <select
          disabled={isPending}
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) updateStatus({ operationId: op.id, newStatus: e.target.value });
            e.target.value = '';
          }}
        >
          <option value="" disabled>
            Cambiar a…
          </option>
          {nextStates.map((s) => (
            <option key={s} value={s}>
              {OPERATION_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      )}
      <span style={{ marginLeft: 'auto' }}>{fmtDate(op.operation_date)}</span>
    </div>
  );
}

/**
 * Ficha de la operación: primero un resumen limpio (lo que se ve y se le
 * enseña al cliente), con el desglose interno de utilidad aparte. El formulario
 * de edición queda detrás de "Editar".
 */
function OperationDetail({ op, onDone }: { op: any; onDone: () => void }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <>
        <button type="button" style={{ ...linkBtn, marginBottom: 12 }} onClick={() => setEditing(false)}>
          ← Volver a la ficha
        </button>
        <CryptoForm editOp={op} onDone={onDone} />
      </>
    );
  }

  const d = cryptoDetail(op) ?? {};
  const qty = Number(d.quantity ?? 0);
  const fee = Number(d.customer_fee_amount ?? 0);
  const spread = Number(d.spread_buy ?? 0) + Number(d.spread_sell ?? 0);
  const exchangeFees = Number(d.provider_fee_buy ?? 0) + Number(d.provider_fee_sell ?? 0);
  const gas = Number(d.network_fee ?? 0);
  const profit = Number(op.net_profit ?? 0);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <ClientAvatar name={op.clients?.name} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, textTransform: 'capitalize' }}>{op.clients?.name ?? 'Sin cliente'}</div>
          <div className="cx-dim" style={{ fontSize: 12.5 }}>
            {[op.clients?.phone, op.clients?.email].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="mono" style={{ fontSize: 22, fontWeight: 600 }}>
            {fmtQty(qty)} <span style={{ fontSize: 14, color: 'var(--text-dim)' }}>{d.crypto_asset_code}</span>
          </div>
          {d.crypto_networks?.network_name && <span className="cx-asset-net">Red {d.crypto_networks.network_name}</span>}
        </div>
      </div>

      <div className="cx-panel" style={{ marginBottom: 12 }}>
        <div className="cx-panel-title"><span>Lo que pagó el cliente</span></div>
        <div className="cx-metric"><span>Precio por unidad</span><span>{fmtMoney(d.sell_price)}</span></div>
        <div className="cx-metric"><span>Subtotal ({fmtQty(qty)} × {fmtMoney(d.sell_price)})</span><span>{fmtMoney(qty * Number(d.sell_price ?? 0))}</span></div>
        <div className="cx-metric">
          <span>Comisión{Number(d.customer_fee_percent) ? ` (${fmtPercent(d.customer_fee_percent)})` : ''}</span>
          <span>{fmtMoney(fee)}</span>
        </div>
        <div className="cx-metric" style={{ fontSize: 15 }}><span style={{ color: 'var(--text)' }}>Total</span><span>{fmtMoney(op.gross_revenue)}</span></div>
      </div>

      <div className="cx-panel" style={{ marginBottom: 12 }}>
        <div className="cx-panel-title"><span>Utilidad para EA (interno)</span></div>
        <div className="cx-metric"><span>Costo de adquisición ({fmtMoney(d.buy_price)} c/u)</span><span>{fmtMoney(d.acquisition_cost)}</span></div>
        <div className="cx-metric"><span>Comisión cobrada</span><span>{fmtMoney(fee)}</span></div>
        <div className="cx-metric"><span>Spread (diferencia de precio)</span><span>{fmtMoney(spread)}</span></div>
        {exchangeFees !== 0 && <div className="cx-metric"><span>Comisiones del exchange</span><span>− {fmtMoney(exchangeFees)}</span></div>}
        {gas !== 0 && <div className="cx-metric"><span>Comisión de red (gas)</span><span>− {fmtMoney(gas)}</span></div>}
        <div className="cx-metric" style={{ fontSize: 15 }}>
          <span style={{ color: 'var(--text)' }}>Utilidad neta · margen {fmtPercent(op.margin_percent)}</span>
          <span className={profit >= 0 ? 'pos' : 'neg'} style={{ textShadow: 'none' }}>{fmtMoney(profit)}</span>
        </div>
      </div>

      {(d.tx_hash || d.wallet_destination_address || d.wallet_origin_address || op.reference || op.observations) && (
        <div className="cx-panel" style={{ marginBottom: 12 }}>
          <div className="cx-panel-title"><span>Datos de la transacción</span></div>
          {d.wallet_destination_address && <HashRow label="Wallet destino" value={d.wallet_destination_address} />}
          {d.wallet_origin_address && <HashRow label="Wallet origen" value={d.wallet_origin_address} />}
          {d.tx_hash && <HashRow label="TX Hash" value={d.tx_hash} />}
          {op.reference && <HashRow label="Referencia" value={op.reference} />}
          {op.observations && <div style={{ fontSize: 12.5, color: 'var(--text-dim)', paddingTop: 8, whiteSpace: 'pre-wrap' }}>{op.observations}</div>}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => openCryptoReceipt(op)}>
          Descargar comprobante (PDF)
        </button>
        <button className="btn btn-ghost" onClick={() => setEditing(true)}>
          Editar / adjuntos
        </button>
      </div>
    </div>
  );
}

function HashRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="cx-metric" style={{ gap: 12 }}>
      <span style={{ flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 400, wordBreak: 'break-all', textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function IconDoc() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M12 12v6M9 15l3 3 3-3" />
    </svg>
  );
}

function IconSheet() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M3 15h18M9 3v18" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18.5 20a6.5 6.5 0 0 0-3-5.5" />
    </svg>
  );
}

function CryptoForm({ onDone, editOp }: { onDone: () => void; editOp?: any }) {
  const { profile } = useAuth();
  const canEdit = profile && ['super_admin', 'admin'].includes(profile.role);
  const isEdit = !!editOp;
  const detail = editOp?.crypto_transactions;

  // Solo clientes de cripto en el selector (más el que ya tenga la operación,
  // para que editar nunca borre el cliente asignado).
  const { data: allClients } = useClients();
  const { data: cryptoOps } = useOperations('cripto');
  const clients = useMemo(() => {
    const ids = cryptoClientIds(cryptoOps as any[]);
    return (allClients ?? []).filter((c: any) => isCryptoClient(c, ids) || c.id === editOp?.client_id);
  }, [allClients, cryptoOps, editOp?.client_id]);
  const [showNewClient, setShowNewClient] = useState(false);
  const { data: assets } = useCryptoAssets();
  const { data: providers } = useProviders();
  const { mutate: createOperation, isPending: creating, error: createError } = useCreateOperation();
  const { mutate: updateOperation, isPending: updating, error: updateError } = useUpdateCryptoOperation();
  const isPending = creating || updating;
  const error = createError || updateError;

  const [assetCode, setAssetCode] = useState(detail?.crypto_asset_code ?? '');
  const { data: networks } = useCryptoNetworks(assetCode || null);

  // Modo RÁPIDO (por defecto en operaciones nuevas): qué cripto, cuántas monedas,
  // a cómo te costó cada una y qué % de comisión cobras. Se guarda con el MISMO
  // modelo que el detallado (cantidad real, precio, comisión % al cliente), así
  // la comisión queda registrada como comisión y no revuelta con el precio.
  // El modo detallado (precio de venta distinto, red, fees, wallets) queda detrás
  // de un botón. Al editar se abre directo en detallado.
  const [detailed, setDetailed] = useState(isEdit);
  const [quick, setQuick] = useState({
    clientId: editOp?.client_id ?? '',
    cantidad: '',
    precio: '',
    comisionPct: '',
  });
  const setQ =
    (k: keyof typeof quick) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setQuick((q) => ({ ...q, [k]: e.target.value }));
  const quickNetworkId = networks?.[0]?.id ?? '';
  const quickQty = quick.cantidad === '' ? 0 : Number(quick.cantidad);
  const quickPrice = quick.precio === '' ? 0 : Number(quick.precio);
  const quickPct = quick.comisionPct === '' ? 0 : Number(quick.comisionPct);
  const quickReady = !!(assetCode && quickNetworkId && quickQty > 0 && quickPrice > 0 && quickPct >= 0);
  const quickPreview = useMemo(
    () =>
      calcCrypto({
        quantity: quickQty,
        marketPrice: quickPrice,
        buyPrice: quickPrice,
        sellPrice: quickPrice,
        customerFeePercent: quickPct,
      }),
    [quickQty, quickPrice, quickPct],
  );

  const [form, setForm] = useState({
    clientId: editOp?.client_id ?? '',
    providerId: editOp?.provider_id ?? '',
    networkId: detail?.crypto_network_id ?? '',
    quantity: detail?.quantity != null ? String(detail.quantity) : '',
    marketPrice: detail?.market_price != null ? String(detail.market_price) : '',
    buyPrice: detail?.buy_price != null ? String(detail.buy_price) : '',
    sellPrice: detail?.sell_price != null ? String(detail.sell_price) : '',
    providerFeeBuy: detail?.provider_fee_buy != null ? String(detail.provider_fee_buy) : '0',
    providerFeeSell: detail?.provider_fee_sell != null ? String(detail.provider_fee_sell) : '0',
    networkFee: detail?.network_fee != null ? String(detail.network_fee) : '0',
    customerFeeFixed: detail?.customer_fee_fixed != null ? String(detail.customer_fee_fixed) : '0',
    customerFeePercent: detail?.customer_fee_percent != null ? String(detail.customer_fee_percent) : '0',
    txHash: detail?.tx_hash ?? '',
    walletOrigin: detail?.wallet_origin_address ?? '',
    walletDestination: detail?.wallet_destination_address ?? '',
    reference: editOp?.reference ?? '',
    observations: editOp?.observations ?? '',
  });

  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const readOnly = isEdit && !canEdit;
  // Lo opcional (comisiones, wallets, notas) arranca escondido en una operación
  // nueva para no abrumar; al editar una ya existente se muestra todo de una.
  const [showExtras, setShowExtras] = useState(isEdit);

  // El recuadro de resultado se recalcula en cada tecla (useMemo sobre `form`).
  // Siempre devuelve un cálculo — con los campos vacíos tomados como 0 — para que
  // el usuario vea el número moverse desde el primer dato. `previewReady` marca
  // cuándo ya hay cantidad y los dos precios, que es lo mínimo para que el número
  // signifique algo (y lo que exige el submit).
  const previewReady = !!(form.quantity && form.buyPrice && form.sellPrice);
  const preview = useMemo(() => {
    const n = (v: string) => (v === '' ? 0 : Number(v));
    return calcCrypto({
      quantity: n(form.quantity),
      marketPrice: n(form.marketPrice || form.buyPrice || form.sellPrice),
      buyPrice: n(form.buyPrice),
      sellPrice: n(form.sellPrice),
      providerFeeBuy: n(form.providerFeeBuy),
      providerFeeSell: n(form.providerFeeSell),
      networkFee: n(form.networkFee),
      customerFeeFixed: n(form.customerFeeFixed),
      customerFeePercent: n(form.customerFeePercent),
    });
  }, [form]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!detailed) {
      if (!quickReady) return;
      createOperation(
        {
          module: 'cripto',
          header: { client_id: quick.clientId || null, provider_id: null, reference: null, observations: null, status: 'completada' },
          details: {
            cryptoAssetCode: assetCode,
            cryptoNetworkId: quickNetworkId,
            txHash: null,
            walletOriginAddress: null,
            walletDestinationAddress: null,
            quantity: quickQty,
            marketPrice: quickPrice,
            buyPrice: quickPrice,
            sellPrice: quickPrice,
            providerFeeBuy: 0,
            providerFeeSell: 0,
            networkFee: 0,
            customerFeeFixed: 0,
            customerFeePercent: quickPct,
          },
        },
        { onSuccess: onDone },
      );
      return;
    }

    if (!previewReady) return;

    const details = {
      cryptoAssetCode: assetCode,
      cryptoNetworkId: form.networkId,
      txHash: form.txHash || null,
      walletOriginAddress: form.walletOrigin || null,
      walletDestinationAddress: form.walletDestination || null,
      quantity: Number(form.quantity),
      marketPrice: Number(form.marketPrice || form.buyPrice),
      buyPrice: Number(form.buyPrice),
      sellPrice: Number(form.sellPrice),
      providerFeeBuy: Number(form.providerFeeBuy),
      providerFeeSell: Number(form.providerFeeSell),
      networkFee: Number(form.networkFee),
      customerFeeFixed: Number(form.customerFeeFixed),
      customerFeePercent: Number(form.customerFeePercent),
    };

    if (isEdit) {
      updateOperation(
        {
          operationId: editOp.id,
          header: {
            client_id: form.clientId || null,
            provider_id: form.providerId || null,
            reference: form.reference || null,
            observations: form.observations || null,
            gross_revenue: toDisplayNumber(preview.totalRevenue),
            total_costs: toDisplayNumber(preview.acquisitionCost) + Number(form.providerFeeSell) + Number(form.networkFee),
            gross_profit: toDisplayNumber(preview.grossProfit),
            net_profit: toDisplayNumber(preview.netProfit),
            margin_percent: toDisplayNumber(preview.marginPercent),
          },
          details: {
            crypto_asset_code: details.cryptoAssetCode,
            crypto_network_id: details.cryptoNetworkId,
            tx_hash: details.txHash,
            wallet_origin_address: details.walletOriginAddress,
            wallet_destination_address: details.walletDestinationAddress,
            quantity: details.quantity,
            market_price: details.marketPrice,
            buy_price: details.buyPrice,
            sell_price: details.sellPrice,
            provider_fee_buy: details.providerFeeBuy,
            provider_fee_sell: details.providerFeeSell,
            network_fee: details.networkFee,
            customer_fee_fixed: details.customerFeeFixed,
            customer_fee_percent: details.customerFeePercent,
            customer_fee_amount: toDisplayNumber(preview.customerFeeAmount),
            spread_buy: toDisplayNumber(preview.spreadBuy),
            spread_sell: toDisplayNumber(preview.spreadSell),
            acquisition_cost: toDisplayNumber(preview.acquisitionCost),
            total_revenue: toDisplayNumber(preview.totalRevenue),
          },
        },
        { onSuccess: onDone }
      );
    } else {
      createOperation(
        {
          module: 'cripto',
          header: {
            client_id: form.clientId || null,
            provider_id: form.providerId || null,
            reference: form.reference || null,
            observations: form.observations || null,
            status: 'completada',
          },
          details,
        },
        { onSuccess: onDone }
      );
    }
  }

  return (
    <>
    <form onSubmit={handleSubmit} noValidate>
      <fieldset disabled={readOnly} style={{ border: 'none', padding: 0, margin: 0 }}>

      {!detailed && (
        <>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '0 0 16px', lineHeight: 1.55 }}>
            En 10 segundos: qué cripto, <b>cuántas monedas</b>, <b>a cómo te costó cada una</b> y <b>qué % cobras</b>. Lo que paga el cliente y tu comisión salen solos.
          </p>
          <div className="grid-2">
            <div className="field">
              <label>¿Qué cripto?</label>
              <select
                value={assetCode}
                onChange={(e) => {
                  setAssetCode(e.target.value);
                  setForm((f) => ({ ...f, networkId: '' }));
                }}
              >
                <option value="">Selecciona…</option>
                {assets?.map((a: any) => (
                  <option key={a.code} value={a.code}>{a.code} — {a.name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label style={{ display: "flex", justifyContent: "space-between" }}>Cliente (opcional) <NewClientLink onClick={() => setShowNewClient(true)} /></label>
              <select value={quick.clientId} onChange={setQ('clientId')}>
                <option value="">— sin asignar —</option>
                {clients?.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid-3">
            <div className="field">
              <label>¿Cuántas monedas?</label>
              <input type="number" step="any" inputMode="decimal" placeholder="ej. 10000" value={quick.cantidad} onChange={setQ('cantidad')} />
            </div>
            <div className="field">
              <label>¿A cómo te costó cada una? (MXN)</label>
              <input type="number" step="any" inputMode="decimal" placeholder="ej. 18.45" value={quick.precio} onChange={setQ('precio')} />
            </div>
            <div className="field">
              <label>% de comisión que cobras</label>
              <input type="number" step="any" inputMode="decimal" placeholder="ej. 1.5" value={quick.comisionPct} onChange={setQ('comisionPct')} />
            </div>
          </div>

          <div
            className="card card-tight"
            style={{
              background: 'var(--navy-850)',
              border: `1px solid ${quickReady ? (toDisplayNumber(quickPreview.netProfit) >= 0 ? 'var(--green-dim)' : 'var(--red-dim)') : 'var(--border)'}`,
              margin: '4px 0 16px',
            }}
          >
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Ganancia de esta operación (se calcula solo)
            </div>
            {quickReady ? (
              <>
                <PreviewRow label="Te costó (monedas × precio)" value={fmtMoney(toDisplayNumber(quickPreview.acquisitionCost))} />
                <PreviewRow label={`Tu comisión (${fmtPercent(quickPct)})`} value={fmtMoney(toDisplayNumber(quickPreview.customerFeeAmount))} />
                <PreviewRow label="El cliente te paga en total" value={fmtMoney(toDisplayNumber(quickPreview.totalRevenue))} bold />
                <PreviewRow
                  label="Ganancia"
                  value={fmtMoney(toDisplayNumber(quickPreview.netProfit))}
                  tone={toDisplayNumber(quickPreview.netProfit) >= 0 ? 'pos' : 'neg'}
                  bold
                />
                <div style={{ fontSize: 12, fontWeight: 600, marginTop: 6, color: toDisplayNumber(quickPreview.netProfit) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {toDisplayNumber(quickPreview.netProfit) > 0
                    ? '✓ Ganas dinero'
                    : toDisplayNumber(quickPreview.netProfit) < 0
                      ? '✕ Pierdes dinero'
                      : 'Ni ganas ni pierdes'}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12.5, color: 'var(--text-mute)' }}>
                Elige la cripto, las monedas y el precio — aquí verás lo que paga el cliente y tu comisión al instante.
              </div>
            )}
          </div>

          {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{(error as Error).message}</div>}

          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={isPending || !quickReady}>
            {isPending ? 'Guardando…' : 'Registrar operación'}
          </button>
          <button
            type="button"
            onClick={() => setDetailed(true)}
            style={{ background: 'none', border: 'none', color: 'var(--electric-bright)', cursor: 'pointer', fontSize: 13, padding: '10px 0 0' }}
          >
            + Modo detallado (cantidad, precio por moneda, red, comisiones, wallets…)
          </button>
        </>
      )}

      <div hidden={!detailed}>
      {!isEdit && (
        <button
          type="button"
          onClick={() => setDetailed(false)}
          style={{ background: 'none', border: 'none', color: 'var(--electric-bright)', cursor: 'pointer', fontSize: 13, padding: '0 0 12px' }}
        >
          ← Volver al modo rápido
        </button>
      )}
      <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '0 0 18px', lineHeight: 1.55 }}>
        Anota una compra/venta de cripto en 2 pasos. Llena lo de abajo y el sistema te dice solo
        cuánto ganaste. Comisiones, wallets y notas son opcionales — están escondidas para no estorbar.
      </p>

      <h3 className="form-section-title">Paso 1 · ¿Qué compraste o vendiste?</h3>
      <div className="grid-2">
        <div className="field">
          <label>¿Qué cripto?</label>
          <select
            required
            value={assetCode}
            onChange={(e) => {
              setAssetCode(e.target.value);
              setForm((f) => ({ ...f, networkId: '' }));
            }}
          >
            <option value="">Selecciona…</option>
            {assets?.map((a: any) => (
              <option key={a.code} value={a.code}>
                {a.code} — {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>¿En qué red?</label>
          <select required value={form.networkId} onChange={set('networkId')} disabled={!assetCode}>
            <option value="">Selecciona…</option>
            {networks?.map((n: any) => (
              <option key={n.id} value={n.id}>
                {n.network_name}
              </option>
            ))}
          </select>
          <Hint>El mismo USDT vive en varias redes (Tron, Ethereum…). Elige la que usaste.</Hint>
        </div>
        <div className="field">
          <label style={{ display: "flex", justifyContent: "space-between" }}>Cliente <NewClientLink onClick={() => setShowNewClient(true)} /></label>
          <select value={form.clientId} onChange={set('clientId')}>
            <option value="">— sin asignar —</option>
            {clients?.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <Hint>Opcional. Déjalo sin asignar si no aplica.</Hint>
        </div>
      </div>

      <h3 className="form-section-title">Paso 2 · ¿Cuánto y a qué precio?</h3>
      <div className="field">
        <label>¿Cuántas monedas?</label>
        <input required type="number" step="any" placeholder="ej. 10000" value={form.quantity} onChange={set('quantity')} style={{ maxWidth: 260 }} />
        <Hint>La cantidad de cripto, no los pesos.</Hint>
      </div>
      <div className="grid-2">
        <div className="field">
          <label>¿A cómo te salió cada una?</label>
          <input required type="number" step="any" placeholder="pesos por moneda" value={form.buyPrice} onChange={set('buyPrice')} />
          <Hint>Lo que pagó EA Divisas por cada moneda.</Hint>
        </div>
        <div className="field">
          <label>¿A cómo se la diste al cliente?</label>
          <input required type="number" step="any" placeholder="pesos por moneda" value={form.sellPrice} onChange={set('sellPrice')} />
          <Hint>Lo que el cliente pagó por cada moneda.</Hint>
        </div>
      </div>

      {/* Resultado en vivo: se recalcula con cada tecla para que el usuario vea si le conviene. */}
      <div
        className="card card-tight"
        style={{
          background: 'var(--navy-850)',
          border: `1px solid ${
            previewReady ? (toDisplayNumber(preview.netProfit) >= 0 ? 'var(--green-dim)' : 'var(--red-dim)') : 'var(--border)'
          }`,
          margin: '4px 0 16px',
        }}
      >
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Cuánto ganas con esta operación (se calcula solo)
        </div>
        {previewReady ? (
          <>
            <PreviewRow label="Te pagó el cliente" value={fmtMoney(toDisplayNumber(preview.totalRevenue))} />
            {!preview.customerFeeAmount.isZero() && (
              <PreviewRow label="  · de eso, tu comisión" value={fmtMoney(toDisplayNumber(preview.customerFeeAmount))} />
            )}
            {!preview.totalSpread.isZero() && (
              <PreviewRow label="  · diferencia de precio (spread)" value={fmtMoney(toDisplayNumber(preview.totalSpread))} />
            )}
            <PreviewRow label="Te costó (todo incluido)" value={fmtMoney(toDisplayNumber(preview.totalRevenue) - toDisplayNumber(preview.netProfit))} />
            <PreviewRow
              label="Ganancia"
              value={fmtMoney(toDisplayNumber(preview.netProfit))}
              tone={toDisplayNumber(preview.netProfit) >= 0 ? 'pos' : 'neg'}
              bold
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: toDisplayNumber(preview.netProfit) >= 0 ? 'var(--green)' : 'var(--red)',
                }}
              >
                {toDisplayNumber(preview.netProfit) > 0
                  ? '✓ Conviene — ganas dinero'
                  : toDisplayNumber(preview.netProfit) < 0
                    ? '✕ No conviene — pierdes dinero'
                    : 'Ni ganas ni pierdes'}
              </span>
              <span style={{ fontSize: 11.5, color: 'var(--text-mute)' }}>margen {fmtPercent(toDisplayNumber(preview.marginPercent))}</span>
            </div>
          </>
        ) : (
          <div style={{ fontSize: 12.5, color: 'var(--text-mute)' }}>
            Escribe la cantidad y los dos precios (aquí arriba) y al instante verás cuánto ganas o pierdes.
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowExtras((v) => !v)}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--electric-bright)',
          cursor: 'pointer',
          fontSize: 13,
          padding: '6px 0',
          marginBottom: showExtras ? 8 : 4,
        }}
      >
        {showExtras ? '− Ocultar comisiones, wallets y notas' : '+ Agregar comisiones, wallets o notas (opcional)'}
      </button>

      <div hidden={!showExtras}>
        <h3 className="form-section-title">Comisiones y costos</h3>
        <div className="grid-2">
          <div className="field">
            <label>¿Con qué plataforma operaste?</label>
            <select value={form.providerId} onChange={set('providerId')}>
              <option value="">— sin asignar —</option>
              {providers?.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <Hint>El exchange (Bitso, Binance, etc.).</Hint>
          </div>
          <div className="field">
            <label>Precio de referencia</label>
            <input type="number" step="any" placeholder="se usa el de compra si lo dejas vacío" value={form.marketPrice} onChange={set('marketPrice')} />
            <Hint>El precio de mercado en ese momento, solo para comparar.</Hint>
          </div>
          <div className="field">
            <label>Comisión del exchange al comprar</label>
            <input type="number" step="any" placeholder="0" value={form.providerFeeBuy} onChange={set('providerFeeBuy')} />
          </div>
          <div className="field">
            <label>Comisión del exchange al vender</label>
            <input type="number" step="any" placeholder="0" value={form.providerFeeSell} onChange={set('providerFeeSell')} />
          </div>
          <div className="field">
            <label>Costo de mover la cripto — "gas"</label>
            <input type="number" step="any" placeholder="0" value={form.networkFee} onChange={set('networkFee')} />
          </div>
          <div className="field">
            <label>Comisión al cliente — %</label>
            <input type="number" step="any" placeholder="0" value={form.customerFeePercent} onChange={set('customerFeePercent')} />
            <Hint>% sobre (monedas × precio de venta).</Hint>
          </div>
          <div className="field">
            <label>Comisión al cliente — monto fijo (MXN)</label>
            <input type="number" step="any" placeholder="0" value={form.customerFeeFixed} onChange={set('customerFeeFixed')} />
          </div>
        </div>

        <h3 className="form-section-title">Datos de la transacción</h3>
        <div className="grid-2">
          <div className="field">
            <label>TX Hash</label>
            <input value={form.txHash} onChange={set('txHash')} placeholder="identificador en la blockchain" />
          </div>
          <div className="field">
            <label>Referencia</label>
            <input value={form.reference} onChange={set('reference')} placeholder="folio interno, número de orden, etc." />
          </div>
          <div className="field">
            <label>Wallet de donde salió</label>
            <input value={form.walletOrigin} onChange={set('walletOrigin')} placeholder="dirección de la wallet" />
          </div>
          <div className="field">
            <label>Wallet a donde llegó</label>
            <input value={form.walletDestination} onChange={set('walletDestination')} placeholder="dirección de la wallet" />
          </div>
        </div>

        <div className="field" style={{ marginTop: 4 }}>
          <label>Observaciones</label>
          <textarea rows={2} value={form.observations} onChange={set('observations')} />
        </div>
      </div>

      {error &&<div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{(error as Error).message}</div>}

      {readOnly ? (
        <div style={{ fontSize: 12.5, color: 'var(--text-mute)', marginBottom: 12 }}>
          Solo un super_admin o admin puede corregir una operación ya creada.
        </div>
      ) : (
        <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={isPending}>
          {isPending ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Registrar operación'}
        </button>
      )}
      </div>
      </fieldset>

      {isEdit && (
        <button
          type="button"
          className="btn btn-ghost"
          style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}
          onClick={() => openCryptoReceipt(editOp)}
        >
          Descargar comprobante (PDF)
        </button>
      )}

      {isEdit && (
        <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
          <AttachmentsSection operationId={editOp.id} />
        </div>
      )}

      {isEdit && canEdit && (
        <DeleteOperationButton operationId={editOp.id} module="cripto" onDeleted={onDone} />
      )}
    </form>

    <Modal open={showNewClient} onClose={() => setShowNewClient(false)} title="Nuevo cliente cripto" width={520}>
      <ClientDataForm
        onDone={(id) => {
          setShowNewClient(false);
          if (id) {
            setQuick((q) => ({ ...q, clientId: id }));
            setForm((f) => ({ ...f, clientId: id }));
          }
        }}
      />
    </Modal>
    </>
  );
}

function PreviewRow({ label, value, tone, bold }: { label: string; value: string; tone?: 'pos' | 'neg'; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
      <span style={{ color: 'var(--text-dim)' }}>{label}</span>
      <span className={`mono ${tone === 'pos' ? 'pos' : tone === 'neg' ? 'neg' : ''}`} style={{ fontWeight: bold ? 700 : 400 }}>
        {value}
      </span>
    </div>
  );
}

function plural(n: number, one: string, many: string) {
  return `${fmtNumber(n, 0)} ${n === 1 ? one : many}`;
}

const linkBtn = {
  background: 'none',
  border: 'none',
  color: 'var(--electric-bright)',
  cursor: 'pointer',
  fontSize: 13,
  padding: 0,
} as const;

function NewClientLink({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{ ...linkBtn, fontSize: 12 }}>
      + Nuevo cliente cripto
    </button>
  );
}
