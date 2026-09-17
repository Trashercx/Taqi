/**
 * Navegación del Superadmin — debe reflejar exactamente la lista aprobada
 * en PLANTEAMIENTO_SUPERADMIN.md §7. Añadir una ruta aquí requiere primero
 * actualizar ese contrato.
 */
export interface NavItem {
  label: string;
  path: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Resumen', path: '/' },
  { label: 'Clientes', path: '/clientes' },
  { label: 'Usuarios', path: '/usuarios' },
  { label: 'Licencias', path: '/licencias' },
  { label: 'Planes', path: '/planes' },
  { label: 'Consumo', path: '/consumo' },
  { label: 'Finanzas', path: '/finanzas' },
  { label: 'Alertas', path: '/alertas' },
  { label: 'Auditoría', path: '/auditoria' },
  { label: 'Salud del sistema', path: '/salud' },
  { label: 'Configuración', path: '/configuracion' },
];
