import { useEffect } from "react";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { instalarDesbloqueioAutomatico } from "@/lib/alertaSonoro";
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
import { FolhaHemotransfusaoPage } from "@/pages/FolhaHemotransfusaoPage";
import { ReacoesTransfusionaisPage } from "@/pages/ReacoesTransfusionaisPage";
import { DevolucoesDescartesPage } from "@/pages/DevolucoesDescartesPage";
import { RelatoriosPage } from "@/pages/RelatoriosPage";
import { IndicadoresPage } from "@/pages/IndicadoresPage";
import { ParametrizacoesPage } from "@/pages/ParametrizacoesPage";
import { UsuariosPage } from "@/pages/UsuariosPage";
import { PermissoesPage } from "@/pages/PermissoesPage";
import { AuditoriaPage } from "@/pages/AuditoriaPage";
import { TrocarSenhaPage } from "@/pages/TrocarSenhaPage";

export function App() {
  // Liberação do alerta sonoro no primeiro clique em QUALQUER tela
  // (2026-10-02, pedido do cliente) — fica na raiz, não só no painel de
  // Solicitações, pra pegar o primeiro gesto bem antes (ex.: clicar em
  // "Entrar" no login).
  useEffect(() => instalarDesbloqueioAutomatico(), []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            {/* Formulário público de solicitação: sem login. O link de impressão leva um token secreto. */}
            {/* Link curto pra divulgação (2026-09-30, pedido do cliente) — troca por um
             * cadastro de slug por unidade se algum dia existir mais de uma unidade real. */}
            <Route path="/solicitar/hmijs" element={<Navigate to="/solicitar/03ef2766-0fa1-4a86-a1de-0d186bee55c4" replace />} />
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
              path="/solicitacoes/:id/bolsas/:bolsaId/folha"
              element={
                <ProtectedRoute>
                  <FolhaHemotransfusaoPage />
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
              <Route path="/permissoes" element={<PermissoesPage />} />
              <Route path="/auditoria" element={<AuditoriaPage />} />
              <Route path="/conta/senha" element={<TrocarSenhaPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
