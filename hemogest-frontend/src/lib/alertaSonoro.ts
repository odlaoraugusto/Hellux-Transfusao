/**
 * HemoGest — alerta sonoro do painel de solicitações.
 * Gera o som via Web Audio (sem arquivo de áudio). Navegadores só liberam
 * áudio depois de uma interação do usuário, por isso `desbloquear()` deve
 * ser chamado a partir de um clique (ex.: botão de ativar o som).
 * A preferência ligado/desligado fica no localStorage do navegador.
 */
const CHAVE_PREFERENCIA = "hemogest.alertaSonoro";

let contexto: AudioContext | null = null;

function obterContexto(): AudioContext | null {
  if (contexto) return contexto;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  contexto = new Ctor();
  return contexto;
}

export function alertaSonoroAtivo(): boolean {
  try {
    return localStorage.getItem(CHAVE_PREFERENCIA) !== "off";
  } catch {
    return true;
  }
}

export function definirAlertaSonoro(ativo: boolean) {
  try {
    localStorage.setItem(CHAVE_PREFERENCIA, ativo ? "on" : "off");
  } catch {
    /* navegador sem storage: vale só para esta sessão */
  }
}

export async function desbloquearAudio(): Promise<boolean> {
  const ctx = obterContexto();
  if (!ctx) return false;
  if (ctx.state === "suspended") await ctx.resume().catch(() => undefined);
  return ctx.state === "running";
}

/** Libera o áudio no primeiro gesto do usuário em QUALQUER tela do app —
 * chamado uma vez na raiz (2026-10-02, pedido do cliente: "o alerta sonoro
 * tem que ficar habilitado sempre, sem depender de clicar na tela"). Como é
 * uma SPA sem reload entre páginas, o primeiro clique em qualquer lugar
 * (ex.: o próprio botão "Entrar" do login) já libera o som pro resto da
 * sessão — quando a pessoa chega no painel de Solicitações, na prática já
 * está liberado, sem precisar clicar lá também. */
export function instalarDesbloqueioAutomatico(): () => void {
  function liberar() {
    desbloquearAudio();
    window.removeEventListener("pointerdown", liberar);
    window.removeEventListener("keydown", liberar);
  }
  window.addEventListener("pointerdown", liberar);
  window.addEventListener("keydown", liberar);
  return () => {
    window.removeEventListener("pointerdown", liberar);
    window.removeEventListener("keydown", liberar);
  };
}

function tom(ctx: AudioContext, frequencia: number, inicio: number, duracao: number, pico = 0.55) {
  const osc = ctx.createOscillator();
  const ganho = ctx.createGain();
  osc.type = "square"; // mais áspero/penetrante que sine — chama mais atenção
  osc.frequency.value = frequencia;
  ganho.gain.setValueAtTime(0.0001, inicio);
  ganho.gain.exponentialRampToValueAtTime(pico, inicio + 0.008); // ataque bem rápido
  ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + duracao);
  osc.connect(ganho).connect(ctx.destination);
  osc.start(inicio);
  osc.stop(inicio + duracao + 0.05);
}

/** Sirene: varre a frequência pra cima e pra baixo — padrão clássico de
 * alarme, bem mais chamativo que bipes discretos. */
function sirene(ctx: AudioContext, inicio: number, duracao: number, grave: number, agudo: number, pico = 0.55) {
  const osc = ctx.createOscillator();
  const ganho = ctx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(grave, inicio);
  const ciclos = Math.max(1, Math.round(duracao / 0.35));
  for (let i = 0; i < ciclos; i++) {
    const t0 = inicio + i * 0.35;
    osc.frequency.linearRampToValueAtTime(agudo, t0 + 0.175);
    osc.frequency.linearRampToValueAtTime(grave, t0 + 0.35);
  }
  ganho.gain.setValueAtTime(0.0001, inicio);
  ganho.gain.exponentialRampToValueAtTime(pico, inicio + 0.02);
  ganho.gain.setValueAtTime(pico, inicio + duracao - 0.05);
  ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + duracao);
  osc.connect(ganho).connect(ctx.destination);
  osc.start(inicio);
  osc.stop(inicio + duracao + 0.05);
}

/** Toca o alerta — repaginado pra chamar mais atenção (2026-10-01, pedido
 * do cliente: "coloca algo que chame mais atenção"): solicitação comum
 * agora é um triplo bipe agudo e alto; emergência é uma sirene de verdade
 * (varredura grave-agudo, tipo alarme), bem mais intensa. Não faz nada se
 * o som estiver desligado ou o navegador ainda não tiver liberado o áudio. */
export function tocarAlerta(emergencia = false) {
  if (!alertaSonoroAtivo()) return;
  const ctx = obterContexto();
  if (!ctx || ctx.state !== "running") return;
  const t = ctx.currentTime + 0.02;
  if (emergencia) {
    sirene(ctx, t, 1.4, 600, 1200);
    sirene(ctx, t + 1.6, 1.4, 600, 1200);
  } else {
    tom(ctx, 1175, t, 0.14);
    tom(ctx, 1175, t + 0.2, 0.14);
    tom(ctx, 1568, t + 0.4, 0.22);
  }
}
