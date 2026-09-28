import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/layout/AppLayout";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { PacientesPage } from "@/pages/PacientesPage";
import { UnidadeHospitalarPage } from "@/pages/UnidadeHospitalarPage";
import { HemocomponentesPage } from "@/pages/HemocomponentesPage";
import { AcompanhamentosPage } from "@/pages/AcompanhamentosPage";
import { SolicitacoesPage } from "@/pages/SolicitacoesPage";
import { FormulariosRecebidosPage } from "@/pages/FormulariosRecebidosPage";
import { SolicitarTransfusaoPage } from "@/pages/SolicitarTransfusaoPage";
import { ImpressaoFormularioPage } from "@/pages/ImpressaoFormularioPage";
import { ReacoesTransfusionaisPage } from "@/pages/ReacoesTransfusionaisPage";
import { DevolucoesDescartesPage } from "@/pages/DevolucoesDescartesPage";
import { RelatoriosPage } from "@/pages/RelatoriosPage";
import { IndicadoresPage } from "@/pages/IndicadoresPage";
import { ParametrizacoesPage } from "@/pages/ParametrizacoesPage";
import { UsuariosPage } from "@/pages/UsuariosPage";
import { AuditoriaPage } from "@/pages/AuditoriaPage";
import { TrocarSenhaPage } from "@/pages/TrocarSenhaPage";

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            {/* Formulário público de solicitação: sem login. O link de impressão leva um token secreto. */}
            <Route path="/solicitar/:unidadeId" element={<SolicitarTransfusaoPage />} />
            <Route path="/formulario/:token" element={<ImpressaoFormularioPage modo="publico" />} />
            <Route
              path="/formularios/:id/imprimir"
              element={
                <ProtectedRoute>
                  <ImpressaoFormularioPage modo="interno" />
                </ProtectedRoute>
              }
            />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<DashboardPage />} />
              <Route path="/pacientes" element={<PacientesPage />} />
              <Route path="/unidade" element={<UnidadeHospitalarPage />} />
              <Route path="/hemocomponentes" element={<HemocomponentesPage />} />
              <Route path="/solicitacoes" element={<SolicitacoesPage />} />
              <Route path="/formularios" element={<FormulariosRecebidosPage />} />
              <Route path="/acompanhamentos" element={<AcompanhamentosPage />} />
              <Route path="/reacoes" element={<ReacoesTransfusionaisPage />} />
              <Route path="/devolucoes-descartes" element={<DevolucoesDescartesPage />} />
              <Route path="/relatorios" element={<RelatoriosPage />} />
              <Route path="/indicadores" element={<IndicadoresPage />} />
              <Route path="/parametrizacoes" element={<ParametrizacoesPage />} />
              <Route path="/usuarios" element={<UsuariosPage />} />
              <Route path="/auditoria" element={<AuditoriaPage />} />
              <Route path="/conta/senha" element={<TrocarSenhaPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
