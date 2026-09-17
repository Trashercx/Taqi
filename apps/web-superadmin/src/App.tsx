import { Route, Routes } from 'react-router';
import { AppShell } from './shell/AppShell';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { AcceptInvitationPage } from './pages/AcceptInvitationPage';
import { DashboardPage } from './pages/DashboardPage';
import { ComingSoonPage } from './pages/ComingSoonPage';
import { OrganizationsListPage } from './pages/organizations/OrganizationsListPage';
import { OrganizationDetailPage } from './pages/organizations/OrganizationDetailPage';
import { UsersListPage } from './pages/users/UsersListPage';
import { LicensesListPage } from './pages/licenses/LicensesListPage';
import { LicenseDetailPage } from './pages/licenses/LicenseDetailPage';
import { PlansListPage } from './pages/plans/PlansListPage';
import { UsagePage } from './pages/usage/UsagePage';
import { FinancePage } from './pages/finance/FinancePage';
import { AuditPage } from './pages/audit/AuditPage';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/aceptar-invitacion/:token" element={<AcceptInvitationPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="clientes" element={<OrganizationsListPage />} />
          <Route path="clientes/:id" element={<OrganizationDetailPage />} />
          <Route path="usuarios" element={<UsersListPage />} />
          <Route path="licencias" element={<LicensesListPage />} />
          <Route path="licencias/:id" element={<LicenseDetailPage />} />
          <Route path="planes" element={<PlansListPage />} />
          <Route path="consumo" element={<UsagePage />} />
          <Route path="finanzas" element={<FinancePage />} />
          <Route path="alertas" element={<ComingSoonPage title="Alertas" />} />
          <Route path="auditoria" element={<AuditPage />} />
          <Route path="salud" element={<ComingSoonPage title="Salud del sistema" />} />
          <Route path="configuracion" element={<ComingSoonPage title="Configuracion" />} />
        </Route>
      </Route>
    </Routes>
  );
}
