/**
 * Piezas visuales del módulo Cripto ("mesa cripto"): chip de activo con su
 * color, avatar de cliente con iniciales, y tiras de indicadores. Los estilos
 * viven en theme.css bajo el prefijo `.cx-`.
 */
import type { ReactNode } from 'react';

const ASSET_COLORS: Record<string, string> = {
  USDT: '#26a17b',
  USDC: '#2775ca',
  BTC: '#f7931a',
  ETH: '#627eea',
  SOL: '#9945ff',
  TRX: '#ef0027',
  BNB: '#f3ba2f',
  DAI: '#f5ac37',
};

export function assetColor(code?: string | null) {
  return (code && ASSET_COLORS[code.toUpperCase()]) || '#5b6584';
}

export function AssetChip({ code, network }: { code?: string | null; network?: string | null }) {
  if (!code) return <span style={{ color: 'var(--text-mute)' }}>—</span>;
  const color = assetColor(code);
  return (
    <span className="cx-asset" title={network ? `${code} · ${network}` : code}>
      <span className="cx-asset-dot" style={{ background: color, boxShadow: `0 0 0 3px ${color}22` }}>
        {code.slice(0, 1)}
      </span>
      <span className="cx-asset-code">{code}</span>
      {network && <span className="cx-asset-net">{network}</span>}
    </span>
  );
}

export function ClientAvatar({ name, size = 28 }: { name?: string | null; size?: number }) {
  const initials = (name ?? '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  // Tono estable por nombre para que cada cliente se reconozca de un vistazo.
  let h = 0;
  for (const ch of name ?? '') h = (h * 31 + ch.charCodeAt(0)) % 360;
  return (
    <span
      className="cx-avatar"
      style={{ width: size, height: size, fontSize: size * 0.4, background: `hsl(${h} 45% 22%)`, color: `hsl(${h} 80% 78%)` }}
    >
      {initials || '?'}
    </span>
  );
}

export function ClientCell({ name }: { name?: string | null }) {
  if (!name) return <span style={{ color: 'var(--text-mute)' }}>Sin cliente</span>;
  return (
    <span className="cx-client">
      <ClientAvatar name={name} />
      <span className="cx-client-name">{name}</span>
    </span>
  );
}

export function StatTile({ label, value, sub, tone, accent }: { label: string; value: string; sub?: ReactNode; tone?: 'pos' | 'neg'; accent?: string }) {
  return (
    <div className="cx-stat" style={accent ? { borderTopColor: accent } : undefined}>
      <div className="cx-stat-label">{label}</div>
      <div className={`cx-stat-value ${tone ?? ''}`}>{value}</div>
      {sub && <div className="cx-stat-sub">{sub}</div>}
    </div>
  );
}

/** Cantidad de cripto sin ceros de relleno: 35,000 · 29,010.57 · 0.00125. */
export function fmtQty(value: number | string | null | undefined) {
  return Number(value ?? 0).toLocaleString('es-MX', { maximumFractionDigits: 8 });
}
