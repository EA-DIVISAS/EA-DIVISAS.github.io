import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AssetChip, ClientAvatar, ClientCell, StatTile, fmtQty } from '../components/crypto/CryptoUI';
import { Modal } from '../components/ui/Modal';
import { useClients, useCreateClient, useOperations, useUpdateClient } from '../lib/api/hooks';
import { useAuth } from '../lib/auth/AuthContext';
import { fmtDate, fmtMoney, fmtNumber } from '../lib/format';
import { OPERATION_STATUS_LABELS, type OperationStatus } from '../lib/domain/operation-status';
import { cryptoDetail, cryptoTotals, exportCryptoExcel, isCounted, isCryptoClient, openCryptoReceipt } from '../lib/crypto/crypto-ops';

interface ClientRow {
  client: any;
  ops: any[];
  operations: number;
  volume: number;
  commissions: number;
  netProfit: number;
  lastDate: string | null;
  assets: string[];
}

/**
 * Panel de clientes cripto: cualquier cliente marcado como "cripto" o que ya
 * tenga al menos una operación de cripto. Las cifras se arman sumando sus
 * operaciones (mismo criterio que la base: sin demo, solo estados que cuentan).
 */
export function CryptoClientsPage() {
  const { data: clients, isLoading: loadingClients } = useClients();
  const { data: operations, isLoading: loadingOps } = useOperations('cripto');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const rows = useMemo<ClientRow[]>(() => {
    const byClient = new Map<string, any[]>();
    for (const op of (operations ?? []) as any[]) {
      if (!op.client_id) continue;
      const list = byClient.get(op.client_id) ?? [];
      list.push(op);
      byClient.set(op.client_id, list);
    }
    return (clients ?? [])
      .filter((c: any) => isCryptoClient(c, new Set(byClient.keys())))
      .map((c: any) => {
        const ops = byClient.get(c.id) ?? [];
        const t = cryptoTotals(ops);
        return {
          client: c,
          ops,
          operations: t.operations,
          volume: t.volume,
          commissions: t.commissions,
          netProfit: t.netProfit,
          lastDate: ops.reduce<string | null>((m, op) => (!m || op.operation_date > m ? op.operation_date : m), null),
          assets: [...new Set(ops.map((op) => cryptoDetail(op)?.crypto_asset_code).filter(Boolean))] as string[],
        };
      })
      .sort((a: ClientRow, b: ClientRow) => b.volume - a.volume);
  }, [clients, operations]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.client.name, r.client.phone, r.client.email, r.client.internal_reference].filter(Boolean).join(' ').toLowerCase().includes(q),
    );
  }, [rows, search]);

  const unassigned = (operations ?? []).filter((op: any) => !op.client_id && isCounted(op)).length;
  const totals = useMemo(
    () => ({
      clients: rows.length,
      active: rows.filter((r) => r.operations > 0).length,
      volume: rows.reduce((s, r) => s + r.volume, 0),
      commissions: rows.reduce((s, r) => s + r.commissions, 0),
    }),
    [rows],
  );

  const selected = rows.find((r) => r.client.id === selectedId) ?? null;
  const isLoading = loadingClients || loadingOps;

  return (
    <div>
      <div className="cx-hero">
        <div>
          <div className="cx-eyebrow">
            <span className="cx-live" /> Mesa cripto
          </div>
          <h1>Clientes cripto</h1>
          <div className="cx-hero-sub">Solo clientes de cripto: cuánto mueven, cuánto te dejan en comisiones y sus wallets</div>
        </div>
        <div className="cx-actions">
          <Link to="/operaciones/cripto" className="btn btn-ghost">
            ← Operaciones
          </Link>
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>
            + Nuevo cliente cripto
          </button>
        </div>
      </div>

      <div className="cx-stats">
        <StatTile label="Clientes cripto" value={fmtNumber(totals.clients, 0)} sub={`${fmtNumber(totals.active, 0)} con operaciones`} accent="var(--electric)" />
        <StatTile label="Volumen histórico" value={fmtMoney(totals.volume)} accent="#26a17b" />
        <StatTile label="Comisiones cobradas" value={fmtMoney(totals.commissions)} accent="var(--green)" />
        <StatTile
          label="Operaciones sin cliente"
          value={fmtNumber(unassigned, 0)}
          tone={unassigned > 0 ? 'neg' : undefined}
          sub={unassigned > 0 ? 'Asígnalas desde la ficha de la operación' : 'Todo asignado'}
          accent="var(--navy-500)"
        />
      </div>

      <div className={selected ? 'sidebar-layout' : undefined}>
        <div>
          <div className="card" style={{ padding: 0 }}>
            <div className="cx-toolbar">
              <input className="cx-search" placeholder="Buscar por nombre, teléfono, email…" value={search} onChange={(e) => setSearch(e.target.value)} />
              <span className="cx-count">{fmtNumber(filtered.length, 0)} clientes</span>
            </div>
            <div style={{ overflowX: "auto" }}>
            <table className="cx-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Teléfono</th>
                  <th>Cripto</th>
                  <th className="num">Operaciones</th>
                  <th className="num">Volumen</th>
                  <th className="num">Comisiones</th>
                  <th className="num">Utilidad</th>
                  <th>Última</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={8} style={{ color: 'var(--text-mute)' }}>
                      Cargando…
                    </td>
                  </tr>
                )}
                {!isLoading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ color: 'var(--text-mute)' }}>
                      {rows.length === 0 ? 'Todavía no hay clientes cripto. Crea uno o asigna un cliente a una operación de cripto.' : 'Sin resultados.'}
                    </td>
                  </tr>
                )}
                {filtered.map((r) => (
                  <tr
                    key={r.client.id}
                    onClick={() => setSelectedId(r.client.id)}
                    style={{ cursor: 'pointer', background: r.client.id === selectedId ? 'rgba(47, 116, 255, 0.12)' : undefined, boxShadow: r.client.id === selectedId ? 'inset 3px 0 0 var(--electric)' : undefined }}
                  >
                    <td>
                      <ClientCell name={r.client.name} />
                    </td>
                    <td>{r.client.phone ?? '—'}</td>
                    <td>{r.assets.length ? r.assets.map((a) => <AssetChip key={a} code={a} />) : <span className="cx-dim">—</span>}</td>
                    <td className="num">{fmtNumber(r.operations, 0)}</td>
                    <td className="num">{fmtMoney(r.volume)}</td>
                    <td className="num">{fmtMoney(r.commissions)}</td>
                    <td className={`num ${r.netProfit >= 0 ? 'pos' : 'neg'}`}>{fmtMoney(r.netProfit)}</td>
                    <td className="cx-date">{fmtDate(r.lastDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>

        {selected && <ClientPanel row={selected} onClose={() => setSelectedId(null)} />}
      </div>

      <Modal open={showNew} onClose={() => setShowNew(false)} title="Nuevo cliente cripto" width={520}>
        <ClientDataForm
          onDone={(id) => {
            setShowNew(false);
            if (id) setSelectedId(id);
          }}
        />
      </Modal>
    </div>
  );
}

function ClientPanel({ row, onClose }: { row: ClientRow; onClose: () => void }) {
  const { profile } = useAuth();
  const canEdit = profile && ['super_admin', 'admin', 'operador'].includes(profile.role);
  const [editing, setEditing] = useState(false);
  const c = row.client;

  // Wallets que ha usado el cliente, sacadas de sus operaciones (con cuántas veces).
  const wallets = useMemo(() => {
    const m = new Map<string, { address: string; asset: string; network: string; uses: number }>();
    for (const op of row.ops) {
      const d = cryptoDetail(op);
      const address = d?.wallet_destination_address;
      if (!address) continue;
      const prev = m.get(address);
      if (prev) prev.uses += 1;
      else m.set(address, { address, asset: d.crypto_asset_code, network: d.crypto_networks?.network_name ?? '', uses: 1 });
    }
    return [...m.values()].sort((a, b) => b.uses - a.uses);
  }, [row.ops]);

  return (
    <div className="card" style={{ alignSelf: 'start' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ClientAvatar name={c.name} size={40} />
          <h3 style={{ fontSize: 16, textTransform: 'capitalize' }}>{c.name}</h3>
        </div>
        <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={onClose}>
          ✕
        </button>
      </div>
      <div style={{ marginBottom: 12 }}>
        <span className={`badge ${c.status === 'activo' ? 'badge-completada' : 'badge-cancelada'}`}>{c.status}</span>
        {c.commissioners?.name && <span style={{ fontSize: 12, color: 'var(--text-dim)', marginLeft: 8 }}>Comisionista: {c.commissioners.name}</span>}
      </div>

      {editing ? (
        <ClientDataForm client={c} onDone={() => setEditing(false)} />
      ) : (
        <>
          <Section title="Datos">
            <Row label="Teléfono" value={c.phone} />
            <Row label="Email" value={c.email} />
            <Row label="País" value={c.country} />
            <Row label="Identificación / ref." value={c.internal_reference} />
            <Row label="Alta" value={fmtDate(c.created_at)} />
            {c.notes && <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 8, whiteSpace: 'pre-wrap' }}>{c.notes}</div>}
            {canEdit && (
              <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', marginTop: 10, fontSize: 12.5 }} onClick={() => setEditing(true)}>
                Editar datos
              </button>
            )}
          </Section>

          <Section title="Números">
            <Row label="Operaciones" value={fmtNumber(row.operations, 0)} />
            <Row label="Volumen comprado" value={fmtMoney(row.volume)} />
            <Row label="Comisiones cobradas" value={fmtMoney(row.commissions)} />
            <Row label="Utilidad que dejó" value={fmtMoney(row.netProfit)} />
            <Row label="Ticket promedio" value={row.operations ? fmtMoney(row.volume / row.operations) : '—'} />
          </Section>

          <Section title={`Wallets (${wallets.length})`}>
            {wallets.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--text-mute)' }}>Sin wallets registradas en sus operaciones.</div>}
            {wallets.map((w) => (
              <div key={w.address} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                <div className="mono" style={{ wordBreak: 'break-all' }}>{w.address}</div>
                <div style={{ color: 'var(--text-mute)' }}>
                  {w.asset}
                  {w.network ? ` · ${w.network}` : ''} · {w.uses} {w.uses === 1 ? 'vez' : 'veces'}
                </div>
              </div>
            ))}
          </Section>

          <Section title={`Operaciones (${row.ops.length})`}>
            {row.ops.length > 0 && (
              <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', marginBottom: 8, fontSize: 12.5 }} onClick={() => exportCryptoExcel(row.ops, c.name)}>
                Exportar historial a Excel
              </button>
            )}
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {row.ops.map((op) => {
                const d = cryptoDetail(op);
                return (
                  <div key={op.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 12.5 }}>
                    <div>
                      <div>
                        <span className="mono">{op.folio}</span> · {fmtDate(op.operation_date)}
                      </div>
                      <div style={{ color: 'var(--text-mute)' }}>
                        {fmtQty(d?.quantity)} {d?.crypto_asset_code} · {OPERATION_STATUS_LABELS[op.status as OperationStatus]}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="mono">{fmtMoney(op.gross_revenue)}</div>
                      <button
                        style={{ background: 'none', border: 'none', color: 'var(--electric-bright)', cursor: 'pointer', fontSize: 12, padding: 0 }}
                        onClick={() => openCryptoReceipt(op)}
                      >
                        Comprobante
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 11.5, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
      <span style={{ color: 'var(--text-dim)' }}>{label}</span>
      <span style={{ textAlign: 'right', wordBreak: 'break-word' }}>{value || '—'}</span>
    </div>
  );
}

/** Alta (sin `client`) o edición (con `client`) de los datos de un cliente cripto. */
export function ClientDataForm({ client, onDone }: { client?: any; onDone: (id?: string) => void }) {
  const { mutate: createClient, isPending: creating, error: createError } = useCreateClient();
  const { mutate: updateClient, isPending: updating, error: updateError } = useUpdateClient();
  const [form, setForm] = useState({
    name: client?.name ?? '',
    phone: client?.phone ?? '',
    email: client?.email ?? '',
    country: client?.country ?? '',
    internal_reference: client?.internal_reference ?? '',
    notes: client?.notes ?? '',
    status: client?.status ?? 'activo',
  });
  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const error = createError || updateError;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const clean = {
      name: form.name.trim(),
      phone: form.phone || null,
      email: form.email || null,
      country: form.country || null,
      internal_reference: form.internal_reference || null,
      notes: form.notes || null,
    };
    if (client) {
      updateClient({ id: client.id, patch: { ...clean, status: form.status, primary_module: 'cripto' } }, { onSuccess: () => onDone(client.id) });
    } else {
      createClient({ ...clean, primary_module: 'cripto' } as any, { onSuccess: (data: any) => onDone(data.id) });
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="field">
        <label>Nombre</label>
        <input required value={form.name} onChange={set('name')} autoFocus={!client} />
      </div>
      <div className="grid-2">
        <div className="field">
          <label>Teléfono</label>
          <input value={form.phone} onChange={set('phone')} />
        </div>
        <div className="field">
          <label>Email</label>
          <input type="email" value={form.email} onChange={set('email')} />
        </div>
        <div className="field">
          <label>País</label>
          <input value={form.country} onChange={set('country')} />
        </div>
        <div className="field">
          <label>Identificación / referencia</label>
          <input value={form.internal_reference} onChange={set('internal_reference')} placeholder="INE, RFC, ID interno…" />
        </div>
        {client && (
          <div className="field">
            <label>Estado</label>
            <select value={form.status} onChange={set('status')}>
              <option value="activo">activo</option>
              <option value="inactivo">inactivo</option>
            </select>
          </div>
        )}
      </div>
      <div className="field">
        <label>Notas</label>
        <textarea rows={3} value={form.notes} onChange={set('notes')} placeholder="Wallets frecuentes, preferencias, límites…" />
      </div>
      {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{(error as Error).message}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={creating || updating || !form.name.trim()}>
          {creating || updating ? 'Guardando…' : client ? 'Guardar cambios' : 'Guardar cliente'}
        </button>
        {client && (
          <button type="button" className="btn btn-ghost" onClick={() => onDone()}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
