import type { Capability } from '../lib/capabilities';

/**
 * Navegación del Superadmin — debe reflejar exactamente la lista aprobada
 * en PLANTEAMIENTO_SUPERADMIN.md §7. Añadir una ruta aquí requiere primero
 * actualizar ese contrato.
 *
 * `capability`, si está presente, solo oculta el ítem cuando el usuario no
 * la tiene (evita mostrar una sección que la API va a rechazar con 403).
 * La autorización real siempre la hace la API, no esta lista.
 */
export interface NavItem {
  label: string;
  path: string;
  capability?: Capability;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Resumen', path: '/' },
  { label: 'Clientes', path: '/clientes', capability: 'organizations.read' },
  { label: 'Usuarios', path: '/usuarios', capability: 'users.invite' },
  { label: 'Licencias', path: '/licencias', capability: 'licenses.read' },
  { label: 'Planes', path: '/planes', capability: 'plans.read' },
  { label: 'Consumo', path: '/consumo', capability: 'usage.read' },
  { label: 'Finanzas', path: '/finanzas', capability: 'finance.read' },
  { label: 'Alertas', path: '/alertas' },
  { label: 'Auditoría', path: '/auditoria', capability: 'audit.read' },
  { label: 'Salud del sistema', path: '/salud' },
  { label: 'Configuración', path: '/configuracion', capability: 'platform.settings.manage' },
];
