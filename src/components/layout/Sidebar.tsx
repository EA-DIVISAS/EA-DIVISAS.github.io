import type { CSSProperties } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../lib/auth/AuthContext';
import type { ProfileRole } from '../../lib/auth/AuthContext';

interface NavItem {
  to: string;
  label: string;
  tag?: string;
  roles?: ProfileRole[];
  children?: NavItem[];
}

// Cripto es el negocio principal: va primero y con su propio bloque.
const NAV: NavItem[] = [
  {
    to: '/operaciones/cripto',
    label: 'Cripto',
    tag: 'PRINCIPAL',
    children: [
      { to: '/operaciones/cripto', label: 'Operaciones cripto' },
      { to: '/cripto/clientes', label: 'Clientes cripto' },
    ],
  },
  { to: '/resumen', label: 'Resumen general' },
  {
    to: '/operaciones',
    label: 'Otras operaciones',
    children: [
      { to: '/operaciones/transferencias', label: 'Transferencias' },
      { to: '/operaciones/efectivo', label: 'Efectivo' },
    ],
  },
  { to: '/clientes', label: 'Clientes' },
  { to: '/tipos-de-cambio', label: 'Tipos de Cambio' },
  { to: '/proveedores', label: 'Proveedores', roles: ['super_admin', 'admin'] },
  { to: '/comisiones', label: 'Comisiones', roles: ['super_admin', 'admin'] },
  { to: '/conciliacion', label: 'Conciliación' },
  { to: '/reportes', label: 'Reportes' },
  { to: '/auditoria', label: 'Auditoría', roles: ['super_admin', 'admin', 'auditor'] },
  { to: '/usuarios', label: 'Usuarios', roles: ['super_admin'] },
];

export function Sidebar({ open, onNavigate }: { open?: boolean; onNavigate?: () => void }) {
  const { profile, signOut } = useAuth();

  const visible = NAV.filter((item) => !item.roles || (profile && item.roles.includes(profile.role)));

  return (
    <aside
      className={`sidebar${open ? ' open' : ''}`}
      style={{
        width: 240,
        flexShrink: 0,
        background: 'var(--navy-900)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'sticky',
        top: 0,
        left: 0,
      }}
    >
      <div style={{ padding: '18px 20px 14px', display: 'flex', justifyContent: 'center' }}>
        <img
          src="/ea-divisas-logo.jpg"
          alt="EA Divisas"
          style={{
            width: '100%',
            maxHeight: 56,
            objectFit: 'contain',
            display: 'block',
            mixBlendMode: 'screen',
            filter: 'brightness(2.2) contrast(1.15) saturate(1.3)',
          }}
        />
      </div>

      <nav style={{ flex: 1, overflowY: 'auto', padding: '4px 12px' }} onClick={onNavigate}>
        {visible.map((item) => (
          <div key={item.to} style={{ marginBottom: item.children ? 4 : 2 }}>
            {item.children ? (
              <div style={{ ...navStyle(false, false), color: 'var(--text)', fontWeight: 600, cursor: 'default' }}>
                {item.label}
                {item.tag && <span className="nav-tag">{item.tag}</span>}
              </div>
            ) : (
              <NavLink to={item.to} end={item.to === '/'} style={({ isActive }) => navStyle(isActive, false)}>
                {item.label}
              </NavLink>
            )}
            {item.children && (
              <div style={{ marginLeft: 10, borderLeft: '1px solid var(--border)', paddingLeft: 4 }}>
                {item.children.map((child) => (
                  <NavLink key={child.to} to={child.to} style={({ isActive }) => navStyle(isActive, true)}>
                    {child.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      <div style={{ padding: 16, borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{profile?.full_name}</div>
        <div style={{ marginBottom: 10 }}>
          <span className="role-badge">{roleLabel(profile?.role)}</span>
        </div>
        <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', fontSize: 12.5 }} onClick={() => signOut()}>
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

function navStyle(isActive: boolean, isChild: boolean): CSSProperties {
  return {
    display: 'block',
    padding: isChild ? '7px 12px' : '9px 12px',
    marginBottom: 1,
    borderRadius: 8,
    fontSize: isChild ? 13 : 13.5,
    fontWeight: isActive ? 600 : 500,
    color: isActive ? '#fff' : 'var(--text-dim)',
    background: isActive ? 'var(--electric-dim)' : 'transparent',
  };
}

function roleLabel(role?: ProfileRole) {
  switch (role) {
    case 'super_admin':
      return 'Super Admin';
    case 'admin':
      return 'Admin';
    case 'operador':
      return 'Operador';
    case 'auditor':
      return 'Auditor';
    default:
      return '';
  }
}
