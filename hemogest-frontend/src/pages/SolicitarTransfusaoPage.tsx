import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, Plus, Printer, Trash2 } from "lucide-react";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { MODALIDADES, MODIFICACOES, RACAS, calcularIdade } from "@/lib/formulario";

/**
 * Formulário público de solicitação de transfusão (sem login). O link leva o
 * id da unidade hospitalar; ao enviar, o formulário é gravado e a pessoa
 * recebe um link para abrir a visualização de impressão.
 */

interface Configuracao {
  estabelecimento: { nome: string; cnes: string | null; endereco: string | null; cidade: string | null; uf: string | null };
  hemocomponentes: { id: string; nome: string; sigla: string | null }[];
  setores: string[];
}

interface ItemForm {
  hemocomponente_id: string;
  quantidade: string;
  unidade_medida: "UNIDADE" | "ML";
  modificacoes: string[];
}

type Sn = "" | "sim" | "nao";

interface FormState {
  convenio: string;
  data_solicitacao: string;
  hora_solicitacao: string;
  nome_paciente: string;
  prontuario: string;
  sexo: "" | "M" | "F";
  data_nascimento: string;
  nome_mae: string;
  raca_cor: string;
  setor_nome: string;
  leito: string;
  peso_kg: string;
  diagnostico: string;
  hb: string;
  ht: string;
  plaquetas: string;
  tp: string;
  ttpa: string;
  indicacao: "" | "USO" | "RESERVA";
  antecedentes_transfusionais: Sn;
  antecedentes_obstetricos: Sn;
  reacao_previa: Sn;
  reacao_previa_descricao: string;
  itens: ItemForm[];
  modalidade: string;
  observacoes: string;
  termo_heterogrupo_medico: string;
  termo_heterogrupo_crm: string;
  termo_emergencia_medico: string;
  termo_emergencia_crm: string;
  medico_nome: string;
  medico_crm: string;
  website: string; // isca para robôs, nunca aparece na tela
}

const MAX_ITENS = 3;
const ITEM_VAZIO: ItemForm = { hemocomponente_id: "", quantidade: "", unidade_medida: "UNIDADE", modificacoes: [] };

const ROTULOS: Record<string, string> = {
  nome_paciente: "Nome completo do paciente",
  prontuario: "Nº do prontuário",
  sexo: "Sexo",
  data_nascimento: "Data de nascimento",
  nome_mae: "Nome da mãe",
  raca_cor: "Raça / cor",
  setor_nome: "Unidade / enfermaria",
  leito: "Leito",
  peso_kg: "Peso",
  data_solicitacao: "Data da solicitação",
  hora_solicitacao: "Horário",
  diagnostico: "Diagnóstico",
  hb: "Hb",
  ht: "Ht",
  plaquetas: "Plaquetas",
  indicacao: "Indicação (uso ou reserva)",
  antecedentes_transfusionais: "Antecedentes transfusionais",
  antecedentes_obstetricos: "Antecedentes obstétricos",
  reacao_previa: "Reação transfusional prévia",
  reacao_previa_descricao: "Descrição da reação anterior",
  itens: "Hemocomponente",
  modalidade: "Modalidade da transfusão",
  medico_nome: "Nome do médico solicitante",
  medico_crm: "CRM do médico",
};

function agora(): { data: string; hora: string } {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return { data: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, hora: `${p(d.getHours())}:${p(d.getMinutes())}` };
}

function estadoInicial(): FormState {
  const { data, hora } = agora();
  return {
    convenio: "SUS",
    data_solicitacao: data,
    hora_solicitacao: hora,
    nome_paciente: "",
    prontuario: "",
    sexo: "",
    data_nascimento: "",
    nome_mae: "",
    raca_cor: "",
    setor_nome: "",
    leito: "",
    peso_kg: "",
    diagnostico: "",
    hb: "",
    ht: "",
    plaquetas: "",
    tp: "",
    ttpa: "",
    indicacao: "",
    antecedentes_transfusionais: "",
    antecedentes_obstetricos: "",
    reacao_previa: "",
    reacao_previa_descricao: "",
    itens: [{ ...ITEM_VAZIO }],
    modalidade: "",
    observacoes: "",
    termo_heterogrupo_medico: "",
    termo_heterogrupo_crm: "",
    termo_emergencia_medico: "",
    termo_emergencia_crm: "",
    medico_nome: "",
    medico_crm: "",
    website: "",
  };
}

function validar(f: FormState): Record<string, string> {
  const e: Record<string, string> = {};
  const obrigatorio = (campo: keyof FormState, minimo = 1) => {
    const tamanho = String(f[campo]).trim().length;
    if (tamanho === 0) e[campo] = "Preencha este campo.";
    else if (tamanho < minimo) e[campo] = `Mínimo de ${minimo} caracteres.`;
  };
  obrigatorio("nome_paciente", 3);
  obrigatorio("prontuario");
  obrigatorio("nome_mae", 3);
  obrigatorio("setor_nome", 2);
  obrigatorio("leito");
  obrigatorio("diagnostico", 2);
  obrigatorio("hb");
  obrigatorio("ht");
  obrigatorio("plaquetas");
  obrigatorio("medico_nome", 3);
  obrigatorio("medico_crm", 2);
  obrigatorio("data_solicitacao");
  obrigatorio("hora_solicitacao");
  if (!f.sexo) e.sexo = "Selecione o sexo.";
  if (!f.raca_cor) e.raca_cor = "Selecione a raça / cor.";
  if (!f.data_nascimento) e.data_nascimento = "Informe a data de nascimento.";
  else if (f.data_nascimento > agora().data) e.data_nascimento = "Data de nascimento no futuro.";
  const peso = Number(f.peso_kg);
  if (!f.peso_kg || !(peso > 0) || peso > 500) e.peso_kg = "Informe o peso em kg (ex.: 2,85).";
  if (!f.indicacao) e.indicacao = "Escolha uso ou reserva.";
  if (!f.antecedentes_transfusionais) e.antecedentes_transfusionais = "Responda sim ou não.";
  if (f.sexo === "F" && !f.antecedentes_obstetricos) e.antecedentes_obstetricos = "Responda sim ou não.";
  if (!f.reacao_previa) e.reacao_previa = "Responda sim ou não.";
  if (f.reacao_previa === "sim" && !f.reacao_previa_descricao.trim()) e.reacao_previa_descricao = "Descreva a reação.";
  if (!f.modalidade) e.modalidade = "Escolha a modalidade.";
  f.itens.forEach((item, i) => {
    if (!item.hemocomponente_id) e[`itens.${i}.hemocomponente_id`] = "Selecione o hemocomponente.";
    const q = Number(item.quantidade);
    const limite = item.unidade_medida === "UNIDADE" ? 20 : 2000;
    if (!Number.isInteger(q) || q < 1 || q > limite) e[`itens.${i}.quantidade`] = `Informe de 1 a ${limite}.`;
  });
  return e;
}

function rotuloDoErro(chave: string): string {
  if (chave.startsWith("itens.")) return ROTULOS.itens;
  return ROTULOS[chave] ?? chave;
}

/** Converte o 422 do servidor em lista legível (o servidor confere tudo de novo). */
function errosDoServidor(body: unknown): string[] {
  const detalhe = body && typeof body === "object" ? (body as { detail?: unknown }).detail : null;
  if (typeof detalhe === "string") return [detalhe];
  if (!Array.isArray(detalhe)) return [];
  const lista = detalhe.map((d: { loc?: unknown[]; msg?: string }) => {
    const campo = String(d.loc?.[d.loc.length - 1] ?? "");
    if (d.msg?.startsWith("Value error, ")) return d.msg.replace("Value error, ", "");
    return ROTULOS[campo] ?? campo ?? "Campo inválido";
  });
  return [...new Set(lista)];
}

const campoBase =
  "w-full rounded-lg border bg-surface-card px-3 py-2 text-sm text-ink focus:border-hemo focus:outline-none focus:ring-2 focus:ring-hemo/20";

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="relative rounded-card border border-hemo/40 bg-surface-card px-4 pb-4 pt-6 shadow-sm">
      <h2 className="absolute -top-3 left-4 rounded bg-hemo px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-white">{titulo}</h2>
      {children}
    </section>
  );
}

function Campo({ id, rotulo, erro, dica, children, className }: { id?: string; rotulo: string; erro?: string; dica?: string; children: ReactNode; className?: string }) {
  return (
    <div className={className} data-erro={erro ? "true" : undefined}>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-hemo">
        {rotulo}
      </label>
      {children}
      {dica && !erro && <p className="mt-1 text-xs text-ink-muted">{dica}</p>}
      {erro && (
        <p className="mt-1 text-xs text-danger" role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}

function Escolha({
  rotulo,
  nome,
  valor,
  opcoes,
  onChange,
  erro,
  className,
}: {
  rotulo: string;
  nome: string;
  valor: string;
  opcoes: { valor: string; rotulo: string; dica?: string }[];
  onChange: (v: string) => void;
  erro?: string;
  className?: string;
}) {
  return (
    <fieldset className={className} data-erro={erro ? "true" : undefined}>
      <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-hemo">{rotulo}</legend>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 py-1">
        {opcoes.map((o) => (
          <label key={o.valor} className="flex cursor-pointer items-center gap-1.5 text-sm text-ink">
            <input
              type="radio"
              name={nome}
              value={o.valor}
              checked={valor === o.valor}
              onChange={() => onChange(o.valor)}
              className="h-4 w-4 accent-hemo"
            />
            {o.rotulo}
            {o.dica && <span className="text-xs text-ink-muted">({o.dica})</span>}
          </label>
        ))}
      </div>
      {erro && (
        <p className="text-xs text-danger" role="alert">
          {erro}
        </p>
      )}
    </fieldset>
  );
}

export function SolicitarTransfusaoPage() {
  const { unidadeId } = useParams();
  const navigate = useNavigate();

  const [config, setConfig] = useState<Configuracao | null>(null);
  const [indisponivel, setIndisponivel] = useState(false);
  const [form, setForm] = useState<FormState>(estadoInicial);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [errosServidor, setErrosServidor] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [gravado, setGravado] = useState<{ protocolo: string; token: string } | null>(null);

  useEffect(() => {
    document.title = "Solicitação de transfusão";
    api
      .get<Configuracao>(`/publico/unidades/${unidadeId}/formulario-solicitacao`)
      .then(setConfig)
      .catch(() => setIndisponivel(true));
  }, [unidadeId]);

  const idade = useMemo(() => calcularIdade(form.data_nascimento, form.data_solicitacao), [form.data_nascimento, form.data_solicitacao]);
  const mensagens = useMemo(
    () => [...new Set(Object.entries(erros).filter(([, texto]) => texto).map(([chave]) => rotuloDoErro(chave)))],
    [erros],
  );

  function definir<K extends keyof FormState>(campo: K, valor: FormState[K]) {
    setForm((f) => ({ ...f, [campo]: valor }));
    if (erros[campo as string]) setErros((e) => ({ ...e, [campo as string]: "" }));
  }

  function definirItem(indice: number, parcial: Partial<ItemForm>) {
    setForm((f) => ({ ...f, itens: f.itens.map((it, i) => (i === indice ? { ...it, ...parcial } : it)) }));
    setErros((e) => ({ ...e, [`itens.${indice}.hemocomponente_id`]: "", [`itens.${indice}.quantidade`]: "" }));
  }

  function alternarModificacao(indice: number, m: string) {
    const atuais = form.itens[indice].modificacoes;
    definirItem(indice, { modificacoes: atuais.includes(m) ? atuais.filter((x) => x !== m) : [...atuais, m] });
  }

  function irParaPrimeiroErro() {
    requestAnimationFrame(() => {
      const alvo = document.querySelector<HTMLElement>('[data-erro="true"]');
      alvo?.scrollIntoView({ behavior: "smooth", block: "center" });
      alvo?.querySelector<HTMLElement>("input,select,textarea")?.focus({ preventScroll: true });
    });
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErrosServidor([]);
    const encontrados = validar(form);
    const ativos = Object.fromEntries(Object.entries(encontrados).filter(([, v]) => v));
    setErros(ativos);
    if (Object.keys(ativos).length) {
      irParaPrimeiroErro();
      return;
    }

    setEnviando(true);
    try {
      const vazioParaNulo = (v: string) => (v.trim() ? v.trim() : null);
      const resposta = await api.post<{ protocolo: string; token_impressao: string }>(`/publico/unidades/${unidadeId}/formulario-solicitacao`, {
        website: form.website || null,
        convenio: vazioParaNulo(form.convenio),
        data_solicitacao: form.data_solicitacao,
        hora_solicitacao: form.hora_solicitacao,
        nome_paciente: form.nome_paciente,
        prontuario: form.prontuario,
        sexo: form.sexo,
        data_nascimento: form.data_nascimento,
        nome_mae: form.nome_mae,
        raca_cor: form.raca_cor,
        setor_nome: form.setor_nome,
        leito: form.leito,
        peso_kg: Number(form.peso_kg),
        diagnostico: form.diagnostico,
        hb: form.hb,
        ht: form.ht,
        plaquetas: form.plaquetas,
        tp: vazioParaNulo(form.tp),
        ttpa: vazioParaNulo(form.ttpa),
        indicacao: form.indicacao,
        antecedentes_transfusionais: form.antecedentes_transfusionais === "sim",
        antecedentes_obstetricos: form.sexo === "F" ? form.antecedentes_obstetricos === "sim" : null,
        reacao_previa: form.reacao_previa === "sim",
        reacao_previa_descricao: form.reacao_previa === "sim" ? form.reacao_previa_descricao : null,
        itens: form.itens.map((i) => ({
          hemocomponente_id: i.hemocomponente_id,
          quantidade: Number(i.quantidade),
          unidade_medida: i.unidade_medida,
          modificacoes: i.modificacoes,
        })),
        modalidade: form.modalidade,
        observacoes: vazioParaNulo(form.observacoes),
        termo_heterogrupo_medico: vazioParaNulo(form.termo_heterogrupo_medico),
        termo_heterogrupo_crm: vazioParaNulo(form.termo_heterogrupo_crm),
        termo_emergencia_medico: vazioParaNulo(form.termo_emergencia_medico),
        termo_emergencia_crm: vazioParaNulo(form.termo_emergencia_crm),
        medico_nome: form.medico_nome,
        medico_crm: form.medico_crm,
      });
      setGravado({ protocolo: resposta.protocolo, token: resposta.token_impressao });
      window.scrollTo({ top: 0 });
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setErrosServidor(["Muitos envios em pouco tempo. Aguarde alguns minutos e tente de novo."]);
      } else if (err instanceof ApiError && (err.status === 422 || err.status === 404)) {
        setErrosServidor(errosDoServidor(err.body).length ? errosDoServidor(err.body) : ["Confira os dados e tente novamente."]);
      } else {
        setErrosServidor(["Não foi possível gravar o formulário. Confira a conexão e tente de novo. Os dados preenchidos foram mantidos."]);
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setEnviando(false);
    }
  }

  function novoFormulario() {
    setForm(estadoInicial());
    setErros({});
    setErrosServidor([]);
    setGravado(null);
  }

  const erro = (campo: string) => erros[campo] || undefined;
  const classe = (campo: string) => clsx(campoBase, erros[campo] ? "border-danger bg-danger/5" : "border-neutral-300");

  if (indisponivel) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-bg p-6">
        <div className="max-w-md rounded-card border border-neutral-200 bg-surface-card p-6 text-center shadow-sm">
          <img src="/brand/hemogest-simbolo.svg" alt="" className="mx-auto mb-3 h-12 w-12" />
          <h1 className="text-lg font-semibold text-ink">Formulário indisponível</h1>
          <p className="mt-2 text-sm text-ink-muted">O endereço não está correto ou a unidade não recebe solicitações por aqui. Confirme o link com a agência transfusional.</p>
        </div>
      </div>
    );
  }

  if (!config) return <p className="p-6 text-ink-muted">Carregando formulário...</p>;

  const est = config.estabelecimento;
  const enderecoCompleto = [est.endereco, [est.cidade, est.uf].filter(Boolean).join(" - ")].filter(Boolean).join(", ");

  return (
    <div className="min-h-screen bg-surface-bg pb-12">
      <div className="bg-gradient-to-r from-hemo to-hemo-dark px-4 pb-16 pt-6 text-white">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <img src="/brand/hemogest-simbolo.svg" alt="" className="h-12 w-12 shrink-0" />
          <div>
            <h1 className="text-xl font-semibold leading-tight sm:text-2xl">Solicitação de transfusão de hemocomponentes</h1>
            <p className="text-sm text-white/85">{est.nome}</p>
          </div>
        </div>
      </div>

      <div className="mx-auto -mt-10 max-w-4xl space-y-6 px-4">
        {gravado ? (
          <div className="rounded-card border border-neutral-200 bg-surface-card p-6 text-center shadow-sm" role="status">
            <CheckCircle2 className="mx-auto mb-2 text-success" size={44} />
            <h2 className="text-xl font-semibold text-ink">Formulário gravado</h2>
            <p className="mt-1 text-sm text-ink-muted">Protocolo</p>
            <p className="font-mono text-2xl font-bold text-hemo">{gravado.protocolo}</p>
            <p className="mx-auto mt-3 max-w-md text-sm text-ink-muted">
              Abra a visualização para imprimir.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Button onClick={() => navigate(`/formulario/${gravado.token}`, { state: { unidadeId } })} className="flex items-center gap-2">
                <Printer size={16} />
                Abrir para imprimir
              </Button>
              <Button variant="secondary" onClick={novoFormulario}>
                Preencher outro formulário
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={enviar} noValidate className="space-y-6">
            {(mensagens.length > 0 || errosServidor.length > 0) && (
              <div role="alert" className="rounded-card border border-danger bg-surface-card p-4 text-sm shadow-sm">
                {mensagens.length > 0 && (
                  <>
                    <p className="font-semibold text-danger">Falta preencher ou corrigir:</p>
                    <ul className="ml-5 mt-1 list-disc text-ink">
                      {mensagens.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                  </>
                )}
                {errosServidor.map((m) => (
                  <p key={m} className="text-danger">
                    {m}
                  </p>
                ))}
              </div>
            )}

            {/* Isca para robôs: escondida da tela e do teclado */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label>
                Site
                <input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => definir("website", e.target.value)} />
              </label>
            </div>

            <Secao titulo="Estabelecimento solicitante">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
                <Campo rotulo="Hospital / unidade de saúde" className="sm:col-span-3">
                  <input readOnly value={est.nome} className={clsx(campoBase, "border-neutral-200 bg-neutral-100 font-medium dark:bg-neutral-700")} />
                </Campo>
                <Campo rotulo="CNES" className="sm:col-span-1">
                  <input readOnly value={est.cnes ?? "—"} className={clsx(campoBase, "border-neutral-200 bg-neutral-100 font-medium dark:bg-neutral-700")} />
                </Campo>
                <Campo id="convenio" rotulo="Convênio" className="sm:col-span-2">
                  <input id="convenio" maxLength={60} value={form.convenio} onChange={(e) => definir("convenio", e.target.value)} className={classe("convenio")} />
                </Campo>
                {enderecoCompleto && (
                  <Campo rotulo="Endereço" className="sm:col-span-6">
                    <input readOnly value={enderecoCompleto} className={clsx(campoBase, "border-neutral-200 bg-neutral-100 dark:bg-neutral-700")} />
                  </Campo>
                )}
              </div>
            </Secao>

            <Secao titulo="Identificação do paciente">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
                <Campo id="nome_paciente" rotulo="Nome completo do paciente *" erro={erro("nome_paciente")} dica="Sem abreviações." className="sm:col-span-6">
                  <input id="nome_paciente" maxLength={200} autoComplete="off" value={form.nome_paciente} onChange={(e) => definir("nome_paciente", e.target.value)} className={classe("nome_paciente")} />
                </Campo>
                <Campo id="prontuario" rotulo="Nº prontuário *" erro={erro("prontuario")} className="sm:col-span-2">
                  <input id="prontuario" maxLength={30} autoComplete="off" value={form.prontuario} onChange={(e) => definir("prontuario", e.target.value)} className={classe("prontuario")} />
                </Campo>
                <Campo id="sexo" rotulo="Sexo *" erro={erro("sexo")} className="sm:col-span-1">
                  <select id="sexo" value={form.sexo} onChange={(e) => definir("sexo", e.target.value as FormState["sexo"])} className={classe("sexo")}>
                    <option value="">—</option>
                    <option value="M">M</option>
                    <option value="F">F</option>
                  </select>
                </Campo>
                <Campo id="data_nascimento" rotulo="Nascimento *" erro={erro("data_nascimento")} className="sm:col-span-3">
                  <input id="data_nascimento" type="date" min="1900-01-01" max={agora().data} value={form.data_nascimento} onChange={(e) => definir("data_nascimento", e.target.value)} className={classe("data_nascimento")} />
                </Campo>

                <Campo id="nome_mae" rotulo="Nome da mãe (genitora) *" erro={erro("nome_mae")} className="sm:col-span-6">
                  <input id="nome_mae" maxLength={200} autoComplete="off" value={form.nome_mae} onChange={(e) => definir("nome_mae", e.target.value)} className={classe("nome_mae")} />
                </Campo>
                <Campo id="idade" rotulo="Idade" className="sm:col-span-3">
                  <input id="idade" readOnly value={idade || "Automática"} className={clsx(campoBase, "border-neutral-200 bg-neutral-100 dark:bg-neutral-700", !idade && "text-ink-muted")} />
                </Campo>
                <Campo id="raca_cor" rotulo="Raça / cor *" erro={erro("raca_cor")} className="sm:col-span-3">
                  <select id="raca_cor" value={form.raca_cor} onChange={(e) => definir("raca_cor", e.target.value)} className={classe("raca_cor")}>
                    <option value="">Selecione</option>
                    {RACAS.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </Campo>

                <Campo id="setor_nome" rotulo="Unidade / enfermaria *" erro={erro("setor_nome")} className="sm:col-span-3">
                  <input id="setor_nome" list="lista-setores" maxLength={120} autoComplete="off" placeholder="Ex.: UTI Neonatal, Pediatria" value={form.setor_nome} onChange={(e) => definir("setor_nome", e.target.value)} className={classe("setor_nome")} />
                  <datalist id="lista-setores">
                    {config.setores.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </Campo>
                <Campo id="leito" rotulo="Leito *" erro={erro("leito")} className="sm:col-span-2">
                  <input id="leito" maxLength={20} autoComplete="off" value={form.leito} onChange={(e) => definir("leito", e.target.value)} className={classe("leito")} />
                </Campo>
                <Campo id="peso_kg" rotulo="Peso (kg) *" erro={erro("peso_kg")} dica="Ex.: 2,85" className="sm:col-span-2">
                  <input id="peso_kg" type="number" inputMode="decimal" step="0.001" min="0" value={form.peso_kg} onChange={(e) => definir("peso_kg", e.target.value)} className={classe("peso_kg")} />
                </Campo>
                <Campo id="data_solicitacao" rotulo="Data solicit. *" erro={erro("data_solicitacao")} className="sm:col-span-3">
                  <input id="data_solicitacao" type="date" value={form.data_solicitacao} onChange={(e) => definir("data_solicitacao", e.target.value)} className={classe("data_solicitacao")} />
                </Campo>
                <Campo id="hora_solicitacao" rotulo="Horário *" erro={erro("hora_solicitacao")} className="sm:col-span-2">
                  <input id="hora_solicitacao" type="time" value={form.hora_solicitacao} onChange={(e) => definir("hora_solicitacao", e.target.value)} className={classe("hora_solicitacao")} />
                </Campo>
              </div>
            </Secao>

            <Secao titulo="Dados clínicos e laboratoriais">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-10">
                <Campo id="diagnostico" rotulo="Diagnóstico *" erro={erro("diagnostico")} className="col-span-2 sm:col-span-10">
                  <input id="diagnostico" maxLength={500} value={form.diagnostico} onChange={(e) => definir("diagnostico", e.target.value)} placeholder="Diagnóstico principal" className={classe("diagnostico")} />
                </Campo>
                <Campo id="hb" rotulo="Hb (g/dL) *" erro={erro("hb")} className="sm:col-span-2">
                  <input id="hb" maxLength={20} inputMode="decimal" value={form.hb} onChange={(e) => definir("hb", e.target.value)} className={classe("hb")} />
                </Campo>
                <Campo id="ht" rotulo="Ht (%) *" erro={erro("ht")} className="sm:col-span-2">
                  <input id="ht" maxLength={20} inputMode="decimal" value={form.ht} onChange={(e) => definir("ht", e.target.value)} className={classe("ht")} />
                </Campo>
                <Campo id="plaquetas" rotulo="Plaquetas (/mm³) *" erro={erro("plaquetas")} className="sm:col-span-2">
                  <input id="plaquetas" maxLength={20} inputMode="numeric" value={form.plaquetas} onChange={(e) => definir("plaquetas", e.target.value)} className={classe("plaquetas")} />
                </Campo>
                <Campo id="tp" rotulo="TP (s)" className="sm:col-span-2">
                  <input id="tp" maxLength={20} inputMode="decimal" placeholder="Opcional" value={form.tp} onChange={(e) => definir("tp", e.target.value)} className={classe("tp")} />
                </Campo>
                <Campo id="ttpa" rotulo="TTPA (s)" className="sm:col-span-2">
                  <input id="ttpa" maxLength={20} inputMode="decimal" placeholder="Opcional" value={form.ttpa} onChange={(e) => definir("ttpa", e.target.value)} className={classe("ttpa")} />
                </Campo>
              </div>
            </Secao>

            <Secao titulo="Histórico transfusional e indicação">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <Escolha rotulo="Indicação *" nome="indicacao" valor={form.indicacao} erro={erro("indicacao")} onChange={(v) => definir("indicacao", v as FormState["indicacao"])} opcoes={[{ valor: "USO", rotulo: "Uso" }, { valor: "RESERVA", rotulo: "Reserva" }]} />
                <Escolha rotulo="Antecedentes transfusionais *" nome="ant_transf" valor={form.antecedentes_transfusionais} erro={erro("antecedentes_transfusionais")} onChange={(v) => definir("antecedentes_transfusionais", v as Sn)} opcoes={[{ valor: "sim", rotulo: "Sim" }, { valor: "nao", rotulo: "Não" }]} />
                {form.sexo === "F" && (
                  <Escolha rotulo="Antecedentes obstétricos *" nome="ant_obst" valor={form.antecedentes_obstetricos} erro={erro("antecedentes_obstetricos")} onChange={(v) => definir("antecedentes_obstetricos", v as Sn)} opcoes={[{ valor: "sim", rotulo: "Sim" }, { valor: "nao", rotulo: "Não" }]} />
                )}
                <Escolha rotulo="Reação transfusional prévia *" nome="reacao_previa" valor={form.reacao_previa} erro={erro("reacao_previa")} onChange={(v) => definir("reacao_previa", v as Sn)} opcoes={[{ valor: "sim", rotulo: "Sim" }, { valor: "nao", rotulo: "Não" }]} />
                {form.reacao_previa === "sim" && (
                  <Campo id="reacao_previa_descricao" rotulo="Especificar reação transfusional *" erro={erro("reacao_previa_descricao")} className="sm:col-span-4">
                    <input id="reacao_previa_descricao" maxLength={500} value={form.reacao_previa_descricao} onChange={(e) => definir("reacao_previa_descricao", e.target.value)} placeholder="Sintomas e tipo de reação anterior" className={classe("reacao_previa_descricao")} />
                  </Campo>
                )}
              </div>
            </Secao>

            <Secao titulo="Hemocomponente(s) e modificação">
              {config.hemocomponentes.length === 0 && (
                <p className="mb-3 rounded-lg bg-warning/10 p-3 text-sm text-ink">Esta unidade ainda não cadastrou hemocomponentes. Fale com a agência transfusional.</p>
              )}
              <div className="space-y-3">
                {form.itens.map((item, i) => (
                  <div key={i} className="rounded-lg border border-neutral-200 p-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                      <Campo id={`hemo-${i}`} rotulo={`Hemocomponente ${form.itens.length > 1 ? i + 1 : ""} *`} erro={erro(`itens.${i}.hemocomponente_id`)} className="sm:col-span-5">
                        <select id={`hemo-${i}`} value={item.hemocomponente_id} onChange={(e) => definirItem(i, { hemocomponente_id: e.target.value })} className={classe(`itens.${i}.hemocomponente_id`)}>
                          <option value="">Selecione...</option>
                          {config.hemocomponentes.map((h) => (
                            <option key={h.id} value={h.id}>
                              {h.sigla ? `${h.sigla} · ${h.nome}` : h.nome}
                            </option>
                          ))}
                        </select>
                      </Campo>
                      <Campo id={`qtd-${i}`} rotulo="Quantidade *" erro={erro(`itens.${i}.quantidade`)} className="sm:col-span-4">
                        <div className="flex items-center gap-3">
                          <input id={`qtd-${i}`} type="number" min={1} inputMode="numeric" value={item.quantidade} onChange={(e) => definirItem(i, { quantidade: e.target.value })} className={clsx(classe(`itens.${i}.quantidade`), "w-24")} />
                          {(["UNIDADE", "ML"] as const).map((u) => (
                            <label key={u} className="flex cursor-pointer items-center gap-1 text-sm text-ink">
                              <input type="radio" name={`medida-${i}`} checked={item.unidade_medida === u} onChange={() => definirItem(i, { unidade_medida: u })} className="h-4 w-4 accent-hemo" />
                              {u === "UNIDADE" ? "Unid." : "mL"}
                            </label>
                          ))}
                        </div>
                      </Campo>
                      <div className="flex items-end justify-end sm:col-span-3">
                        {i > 0 && (
                          <button type="button" onClick={() => setForm((f) => ({ ...f, itens: f.itens.filter((_, k) => k !== i) }))} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-danger hover:bg-danger/10">
                            <Trash2 size={15} /> Remover
                          </button>
                        )}
                      </div>
                      <div className="sm:col-span-12">
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-hemo">Processo de modificação</span>
                        <div className="flex flex-wrap gap-2">
                          {MODIFICACOES.map((m) => (
                            <label key={m} className={clsx("flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm text-ink", item.modificacoes.includes(m) ? "border-hemo bg-hemo/10 text-hemo" : "border-neutral-300")}>
                              <input type="checkbox" checked={item.modificacoes.includes(m)} onChange={() => alternarModificacao(i, m)} className="accent-hemo" />
                              {m}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between">
                {form.itens.length < MAX_ITENS ? (
                  <Button type="button" variant="secondary" onClick={() => setForm((f) => ({ ...f, itens: [...f.itens, { ...ITEM_VAZIO }] }))} className="flex items-center gap-1.5">
                    <Plus size={15} /> Adicionar outro hemocomponente
                  </Button>
                ) : (
                  <span />
                )}
                <span className="text-xs text-ink-muted">Máximo de {MAX_ITENS} itens.</span>
              </div>
              <div className="mt-4 border-t border-neutral-200 pt-3">
                <Escolha rotulo="Modalidade da transfusão *" nome="modalidade" valor={form.modalidade} erro={erro("modalidade")} onChange={(v) => definir("modalidade", v)} opcoes={MODALIDADES} />
              </div>
            </Secao>

            <Secao titulo="Observações complementares">
              <Campo id="observacoes" rotulo="Informações clínicas complementares">
                <textarea id="observacoes" rows={3} maxLength={2000} value={form.observacoes} onChange={(e) => definir("observacoes", e.target.value)} placeholder="Ex.: histórico de sensibilização, urgência justificada, fenotipagem específica" className={classe("observacoes")} />
              </Campo>
            </Secao>

            <Secao titulo="Termos de responsabilidade e consentimento">
              <p className="mb-3 text-sm text-ink-muted">Preencha só se o termo se aplicar.</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-dashed border-hemo/50 p-3">
                  <h3 className="border-l-4 border-hemo pl-2 text-xs font-bold uppercase text-hemo">Termo: transfusão heterogrupo</h3>
                  <p className="mb-2 mt-1.5 text-xs leading-relaxed text-ink-muted">Autorizo a transfusão de hemocomponentes heterogrupo compatível para o(a) paciente identificado acima, seguindo as diretrizes de segurança imuno-hematológica vigentes.</p>
                  <div className="grid grid-cols-3 gap-2">
                    <Campo id="termo_hetero_medico" rotulo="Médico" className="col-span-2">
                      <input id="termo_hetero_medico" maxLength={120} value={form.termo_heterogrupo_medico} onChange={(e) => definir("termo_heterogrupo_medico", e.target.value)} className={classe("termo_heterogrupo_medico")} />
                    </Campo>
                    <Campo id="termo_hetero_crm" rotulo="CRM">
                      <input id="termo_hetero_crm" maxLength={30} value={form.termo_heterogrupo_crm} onChange={(e) => definir("termo_heterogrupo_crm", e.target.value)} className={classe("termo_heterogrupo_crm")} />
                    </Campo>
                  </div>
                </div>
                <div className="rounded-lg border border-dashed border-hemo/50 p-3">
                  <h3 className="border-l-4 border-hemo pl-2 text-xs font-bold uppercase text-hemo">Termo: emergência</h3>
                  <p className="mb-2 mt-1.5 text-xs leading-relaxed text-ink-muted">Autorizo ao serviço de hemoterapia o fornecimento de concentrado de hemácias (CH) em caráter de emergência para o(a) paciente identificado acima antes da conclusão dos testes pré-transfusionais, ciente de que o retardo acarreta risco à vida do(a) mesmo(a). Conforme legislação vigente, afirmo conhecer o risco de tal procedimento e concordo com a autorização do mesmo.</p>
                  <div className="grid grid-cols-3 gap-2">
                    <Campo id="termo_emerg_medico" rotulo="Médico" className="col-span-2">
                      <input id="termo_emerg_medico" maxLength={120} value={form.termo_emergencia_medico} onChange={(e) => definir("termo_emergencia_medico", e.target.value)} className={classe("termo_emergencia_medico")} />
                    </Campo>
                    <Campo id="termo_emerg_crm" rotulo="CRM">
                      <input id="termo_emerg_crm" maxLength={30} value={form.termo_emergencia_crm} onChange={(e) => definir("termo_emergencia_crm", e.target.value)} className={classe("termo_emergencia_crm")} />
                    </Campo>
                  </div>
                </div>
              </div>
            </Secao>

            <Secao titulo="Médico requisitante">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Campo id="medico_nome" rotulo="Nome completo do médico solicitante *" erro={erro("medico_nome")} className="sm:col-span-2">
                  <input id="medico_nome" maxLength={120} autoComplete="off" value={form.medico_nome} onChange={(e) => definir("medico_nome", e.target.value)} placeholder="Nome por extenso" className={classe("medico_nome")} />
                </Campo>
                <Campo id="medico_crm" rotulo="CRM *" erro={erro("medico_crm")}>
                  <input id="medico_crm" maxLength={30} autoComplete="off" value={form.medico_crm} onChange={(e) => definir("medico_crm", e.target.value)} className={classe("medico_crm")} />
                </Campo>
              </div>
            </Secao>

            <div className="flex flex-col items-center gap-2 pt-2">
              <Button type="submit" disabled={enviando || config.hemocomponentes.length === 0} className="min-w-56 px-8 py-3 text-base">
                {enviando ? "Gravando..." : "Gravar solicitação"}
              </Button>
              <p className="text-xs text-ink-muted">Depois de gravar, você abre a visualização para imprimir.</p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
