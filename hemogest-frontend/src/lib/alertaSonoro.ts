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

function tom(ctx: AudioContext, frequencia: number, inicio: number, duracao: number) {
  const osc = ctx.createOscillator();
  const ganho = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = frequencia;
  ganho.gain.setValueAtTime(0.0001, inicio);
  ganho.gain.exponentialRampToValueAtTime(0.35, inicio + 0.02);
  ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + duracao);
  osc.connect(ganho).connect(ctx.destination);
  osc.start(inicio);
  osc.stop(inicio + duracao + 0.05);
}

/** Toca o alerta: dois tons para solicitação comum, três bipes agudos
 * repetidos para emergência. Não faz nada se o som estiver desligado ou
 * o navegador ainda não tiver liberado o áudio. */
export function tocarAlerta(emergencia = false) {
  if (!alertaSonoroAtivo()) return;
  const ctx = obterContexto();
  if (!ctx || ctx.state !== "running") return;
  const t = ctx.currentTime + 0.02;
  if (emergencia) {
    for (let rep = 0; rep < 2; rep++) {
      for (let i = 0; i < 3; i++) tom(ctx, 1046, t + rep * 0.9 + i * 0.18, 0.12);
    }
  } else {
    tom(ctx, 784, t, 0.25);
    tom(ctx, 1046, t + 0.22, 0.4);
  }
}
