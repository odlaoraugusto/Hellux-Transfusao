import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, Printer } from "lucide-react";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { HEMOCOMPONENTES, MODALIDADES, NOME_MODIFICACAO, OPCOES_INDICACAO, RACAS, SETORES, calcularIdade } from "@/lib/formulario";
import type { Modificacao, TipoHemocomponente } from "@/types";
import { INSTITUICAO_PRIMARIA, INSTITUICAO_SECUNDARIA } from "@/config/instituicao";
import { LogoInstituicao } from "@/components/LogoInstituicao";

/**
 * Formulário público de solicitação de transfusão (sem login) — mesmo
 * layout de campos do documento oficial STH Rev.5 (2026-09-30, pedido do
 * cliente). O link leva o id da unidade hospitalar; ao enviar, o
 * formulário é gravado e a pessoa recebe um link para abrir e baixar o PDF
 * oficial já preenchido (ver lib/gerarPdfSolicitacao.ts).
 */

interface Configuracao {
  estabelecimento: { nome: string; cnes: string | null; endereco: string | null; cidade: string | null; uf: string | null };
}

interface PacientePrefill {
  nome_paciente: string;
  nome_social: string | null;
  cpf: string | null;
  cpf_e_da_mae: boolean;
  cns: string | null;
  sexo: string | null;
  data_nascimento: string | null;
  nome_mae: string | null;
  raca_cor: string | null;
  peso_kg: number | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  codigo_ibge: string | null;
}

interface CandidatoNome {
  numero_prontuario: string;
  nome_paciente: string;
  data_nascimento: string | null;
}

interface ItemHemocomponente {
  selecionado: boolean;
  quantidade: string;
  unidade_medida: "UNIDADE" | "ML";
  modificacoes: Modificacao[];
}

type Sn = "" | "sim" | "nao";

interface FormState {
  convenio: string;
  data_solicitacao: string;
  hora_solicitacao: string;
  nome_paciente: string;
  cpf: string;
  cpf_e_da_mae: boolean;
  cns: string;
  nome_social: string;
  prontuario: string;
  sexo: "" | "M" | "F";
  data_nascimento: string;
  nome_mae: string;
  raca_cor: string;
  setor_nome: string;
  leito: string;
  peso_kg: string;
  cep: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  codigo_ibge: string;
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
  itens: Record<TipoHemocomponente, ItemHemocomponente>;
  modalidade: string;
  data_programada: string;
  hora_programada: string;
  observacoes: string;
  medico_nome: string;
  medico_crm: string;
  website: string; // isca para robôs, nunca aparece na tela
}

const ITEM_VAZIO: ItemHemocomponente = { selecionado: false, quantidade: "", unidade_medida: "UNIDADE", modificacoes: [] };

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
  "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

const ROTULOS: Record<string, string> = {
  nome_paciente: "Nome completo do paciente",
  cpf: "CPF",
  cns: "Cartão SUS (CNS)",
  prontuario: "Nº do prontuário",
  sexo: "Sexo",
  data_nascimento: "Data de nascimento",
  setor_nome: "Unidade / enfermaria",
  diagnostico: "Diagnóstico",
  nome_mae: "Nome da genitora",
  cep: "CEP",
  logradouro: "Logradouro",
  numero: "Número",
  cidade: "Cidade",
  uf: "Estado",
  hb: "Hb",
  ht: "Ht",
  indicacao: "Indicação transfusional",
  antecedentes_transfusionais: "Antecedente transfusional",
  antecedentes_obstetricos: "Antecedentes obstétricos",
  reacao_previa: "Reação transfusional prévia",
  reacao_previa_descricao: "Especificação da reação prévia",
  itens: "Ao menos um hemocomponente, com a quantidade",
  modalidade: "Modalidade da transfusão",
  data_programada: "Data programada",
  hora_programada: "Hora programada",
  medico_nome: "Nome do médico solicitante",
  medico_crm: "CRM do médico",
};

function agora(): { data: string; hora: string } {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return { data: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, hora: `${p(d.getHours())}:${p(d.getMinutes())}` };
}

function itensVazios(): Record<TipoHemocomponente, ItemHemocomponente> {
  return { CH: { ...ITEM_VAZIO }, PF: { ...ITEM_VAZIO }, CP: { ...ITEM_VAZIO }, CR: { ...ITEM_VAZIO } };
}

function estadoInicial(): FormState {
  const { data, hora } = agora();
  return {
    convenio: "SUS",
    data_solicitacao: data,
    hora_solicitacao: hora,
    nome_paciente: "",
    cpf: "",
    cpf_e_da_mae: false,
    cns: "",
    nome_social: "",
    prontuario: "",
    sexo: "",
    data_nascimento: "",
    nome_mae: "",
    raca_cor: "",
    setor_nome: "",
    leito: "",
    peso_kg: "",
    cep: "",
    logradouro: "",
    numero: "",
    bairro: "",
    cidade: "",
    uf: "",
    codigo_ibge: "",
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
    itens: itensVazios(),
    modalidade: "",
    data_programada: "",
    hora_programada: "",
    observacoes: "",
    medico_nome: "",
    medico_crm: "",
    website: "",
  };
}

/** Prontuário só aceita número (2026-10-01, pedido do cliente: colar
 * "17344/1" deve virar "173441" — descarta qualquer símbolo colado junto). */
function somenteDigitos(v: string): string {
  return v.replace(/\D/g, "");
}

function mascararCpf(v: string): string {
  const digitos = v.replace(/\D/g, "").slice(0, 11);
  return digitos.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function mascararCns(v: string): string {
  const digitos = v.replace(/\D/g, "").slice(0, 15);
  return digitos.replace(/(\d{3})(\d)/, "$1 $2").replace(/(\d{4})(\d)/, "$1 $2").replace(/(\d{4})(\d{1,4})$/, "$1 $2");
}

function mascararCep(v: string): string {
  const digitos = v.replace(/\D/g, "").slice(0, 8);
  return digitos.length > 5 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : digitos;
}

/** "8" -> "8,0", "8.53" -> "8,5" — sempre uma casa decimal, ao sair do
 * campo (2026-09-30, pedido do cliente). Deixa em branco intocado. */
function formatarUmaCasaDecimal(v: string): string {
  const limpo = v.trim().replace(",", ".");
  if (!limpo) return v;
  const n = Number(limpo);
  if (Number.isNaN(n)) return v;
  return n.toFixed(1).replace(".", ",");
}

/** "150000" -> "150.000" — separador de milhar, ao sair do campo
 * (2026-09-30, pedido do cliente). */
function formatarMilhar(v: string): string {
  const digitos = v.replace(/\D/g, "");
  if (!digitos) return v;
  return digitos.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Confere os dígitos verificadores de verdade (2026-10-02, pedido do
 * cliente: "caso digitem 000.000.000-00... trava também") — só contar 11
 * dígitos deixava passar qualquer sequência digitada só pra vencer a
 * obrigatoriedade do campo. */
function cpfValido(cpf: string): boolean {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const digitoVerificador = (tamanho: number) => {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += Number(d[i]) * (tamanho + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digitoVerificador(9) === Number(d[9]) && digitoVerificador(10) === Number(d[10]);
}

function maiusculo(v: string): string {
  return v.toUpperCase();
}

function validar(f: FormState): Record<string, string> {
  const e: Record<string, string> = {};
  const obrigatorio = (campo: keyof FormState, minimo = 1) => {
    const tamanho = String(f[campo]).trim().length;
    if (tamanho === 0) e[campo] = "Preencha este campo.";
    else if (tamanho < minimo) e[campo] = `Mínimo de ${minimo} caracteres.`;
  };
  obrigatorio("nome_paciente", 3);
  // Prontuário fica marcado como obrigatório (pedido oficialmente a quem
  // preenche), mas não trava o envio — 2026-10-02, pedido do cliente:
  // "quando tiver na contingência sem sistema, isso não ser uma trava".
  obrigatorio("nome_mae", 3);
  obrigatorio("setor_nome", 2);
  obrigatorio("diagnostico", 2);
  obrigatorio("hb");
  obrigatorio("ht");
  obrigatorio("medico_nome", 3);
  obrigatorio("medico_crm", 2);
  obrigatorio("data_solicitacao");
  obrigatorio("hora_solicitacao");
  if (f.cep.replace(/\D/g, "").length !== 8) e.cep = "CEP precisa ter 8 dígitos.";
  obrigatorio("logradouro", 2);
  obrigatorio("numero");
  obrigatorio("cidade", 2);
  if (f.uf.length !== 2) e.uf = "Selecione o estado.";
  if (!f.sexo) e.sexo = "Selecione o sexo.";
  if (!f.data_nascimento) e.data_nascimento = "Informe a data de nascimento.";
  else if (f.data_nascimento > agora().data) e.data_nascimento = "Data de nascimento no futuro.";
  if (!cpfValido(f.cpf)) e.cpf = "CPF inválido.";
  // CNS fica marcado como obrigatório (pedido oficialmente a quem
  // preenche), mas não trava o envio — mesmo motivo do prontuário
  // (2026-10-02, pedido do cliente: "alguns já estão atualizados pro
  // número do CPF").
  if (f.cns.trim() && f.cns.replace(/\D/g, "").length !== 15) e.cns = "Cartão SUS (CNS) precisa ter 15 dígitos.";
  if (!f.indicacao) e.indicacao = "Escolha uso ou reserva.";
  if (!f.antecedentes_transfusionais) e.antecedentes_transfusionais = "Responda sim ou não.";
  if (f.sexo === "F" && !f.antecedentes_obstetricos) e.antecedentes_obstetricos = "Responda sim ou não.";
  if (!f.reacao_previa) e.reacao_previa = "Responda sim ou não.";
  if (f.reacao_previa === "sim" && !f.reacao_previa_descricao.trim()) e.reacao_previa_descricao = "Descreva a reação.";
  if (!f.modalidade) e.modalidade = "Escolha a modalidade.";
  if (f.modalidade === "PROGRAMADA") {
    if (!f.data_programada) e.data_programada = "Informe a data programada.";
    if (!f.hora_programada) e.hora_programada = "Informe a hora programada.";
  }
  const selecionados = (Object.keys(f.itens) as TipoHemocomponente[]).filter((k) => f.itens[k].selecionado);
  if (selecionados.length === 0) e.itens = "Marque ao menos um hemocomponente.";
  selecionados.forEach((k) => {
    const q = Number(f.itens[k].quantidade);
    const limite = f.itens[k].unidade_medida === "UNIDADE" ? 20 : 2000;
    if (!q || q < 1 || q > limite) e[`itens.${k}`] = `Informe a quantidade de 1 a ${limite}.`;
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
  "w-full rounded-lg border bg-surface-card px-3 py-2 text-sm text-ink focus:border-formpub focus:outline-none focus:ring-2 focus:ring-formpub/20";

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="relative rounded-card border border-formpub/40 bg-surface-card px-4 pb-4 pt-6 shadow-sm">
      <h2 className="absolute -top-3 left-4 rounded bg-formpub px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-white">{titulo}</h2>
      {children}
    </section>
  );
}

function Campo({ id, rotulo, erro, dica, children, className }: { id?: string; rotulo: string; erro?: string; dica?: string; children: ReactNode; className?: string }) {
  return (
    <div className={className} data-erro={erro ? "true" : undefined}>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-formpub">
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
      <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-formpub">{rotulo}</legend>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 py-1">
        {opcoes.map((o) => (
          <label key={o.valor} className="flex cursor-pointer items-center gap-1.5 text-sm text-ink">
            <input
              type="radio"
              name={nome}
              value={o.valor}
              checked={valor === o.valor}
              onChange={() => onChange(o.valor)}
              className="h-4 w-4 accent-formpub"
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
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [buscandoProntuario, setBuscandoProntuario] = useState(false);
  const [prontuarioEncontrado, setProntuarioEncontrado] = useState(false);
  const [buscandoNome, setBuscandoNome] = useState(false);
  const [resultadosNome, setResultadosNome] = useState<CandidatoNome[]>([]);
  const [buscandoMedico, setBuscandoMedico] = useState(false);

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

  /** Busca logradouro/bairro/cidade/UF/IBGE pelo CEP (ViaCEP), assim que os
   * 8 dígitos são preenchidos — só o número continua manual (2026-09-30,
   * pedido do cliente). */
  async function buscarCep(valor: string) {
    const digitos = valor.replace(/\D/g, "");
    if (digitos.length !== 8) return;
    setBuscandoCep(true);
    setErros((e) => ({ ...e, cep: "" }));
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
      const dados = await resp.json();
      if (dados.erro) {
        setErros((e) => ({ ...e, cep: "CEP não encontrado." }));
        return;
      }
      setForm((f) => ({
        ...f,
        logradouro: (dados.logradouro || "").toUpperCase(),
        bairro: (dados.bairro || "").toUpperCase(),
        cidade: (dados.localidade || "").toUpperCase(),
        uf: dados.uf || "",
        codigo_ibge: dados.ibge || "",
      }));
    } catch {
      setErros((e) => ({ ...e, cep: "Não foi possível buscar o CEP. Preencha o endereço manualmente." }));
    } finally {
      setBuscandoCep(false);
    }
  }

  /** Aplica os dados achados (por prontuário ou, depois de escolher na
   * lista, por nome) — só completa o que ainda está em branco, nunca
   * sobrescreve o que a pessoa já digitou (2026-10-01, pedido do
   * cliente: "não importa os dados salvos do paciente"). */
  function aplicarPrefill(dados: PacientePrefill) {
    setForm((f) => ({
      ...f,
      nome_paciente: f.nome_paciente || dados.nome_paciente.toUpperCase(),
      nome_social: f.nome_social || (dados.nome_social ?? "").toUpperCase(),
      cpf: f.cpf || (dados.cpf ? mascararCpf(dados.cpf) : ""),
      cpf_e_da_mae: f.cpf_e_da_mae || dados.cpf_e_da_mae,
      cns: f.cns || (dados.cns ? mascararCns(dados.cns) : ""),
      sexo: f.sexo || (dados.sexo === "M" || dados.sexo === "F" ? dados.sexo : f.sexo),
      data_nascimento: f.data_nascimento || dados.data_nascimento || "",
      nome_mae: f.nome_mae || (dados.nome_mae ?? "").toUpperCase(),
      raca_cor: f.raca_cor || dados.raca_cor || "",
      peso_kg: f.peso_kg || (dados.peso_kg != null ? String(dados.peso_kg) : ""),
      cep: f.cep || (dados.cep ? mascararCep(dados.cep) : ""),
      logradouro: f.logradouro || (dados.logradouro ?? "").toUpperCase(),
      numero: f.numero || (dados.numero ?? "").toUpperCase(),
      bairro: f.bairro || (dados.bairro ?? "").toUpperCase(),
      cidade: f.cidade || (dados.cidade ?? "").toUpperCase(),
      uf: f.uf || (dados.uf ?? ""),
      codigo_ibge: f.codigo_ibge || (dados.codigo_ibge ?? ""),
    }));
  }

  /** Pré-preenche com os dados já cadastrados desse prontuário nesta
   * unidade. */
  async function buscarPorProntuario(valor: string) {
    const digitos = valor.replace(/\D/g, "");
    setProntuarioEncontrado(false);
    if (!digitos) return;
    setBuscandoProntuario(true);
    try {
      const dados = await api.get<PacientePrefill | null>(
        `/publico/unidades/${unidadeId}/paciente-por-prontuario?prontuario=${encodeURIComponent(digitos)}`,
      );
      if (!dados) return;
      setProntuarioEncontrado(true);
      aplicarPrefill(dados);
    } catch {
      /* sem cadastro prévio pra esse prontuário (ou falha de rede) — segue com o formulário em branco */
    } finally {
      setBuscandoProntuario(false);
    }
  }

  /** Busca por nome (2026-10-02, pedido do cliente: "quando ficamos sem
   * sistema, não temos prontuário de alguns pacientes") — só dispara se o
   * prontuário ainda estiver em branco (sinal de que não é conhecido) e
   * sempre pede confirmação na lista antes de aplicar, já que nome não é
   * chave única como o prontuário (teria risco de puxar os dados da
   * criança errada). */
  async function buscarPorNome(valor: string) {
    setResultadosNome([]);
    if (form.prontuario.trim() || valor.trim().length < 3) return;
    setBuscandoNome(true);
    try {
      const resultados = await api.get<CandidatoNome[]>(
        `/publico/unidades/${unidadeId}/pacientes/buscar?nome=${encodeURIComponent(valor.trim())}`,
      );
      setResultadosNome(resultados);
    } catch {
      /* falha de rede — segue com o formulário em branco */
    } finally {
      setBuscandoNome(false);
    }
  }

  async function selecionarCandidatoNome(candidato: CandidatoNome) {
    setResultadosNome([]);
    definir("prontuario", candidato.numero_prontuario);
    await buscarPorProntuario(candidato.numero_prontuario);
  }

  /** CRM primeiro: se já foi digitado antes nesta unidade, puxa o nome
   * completo sozinho (2026-10-02, pedido do cliente) — só completa se o
   * nome ainda estiver em branco. */
  async function buscarMedicoPorCrm(crm: string) {
    if (!crm.trim()) return;
    setBuscandoMedico(true);
    try {
      const dados = await api.get<{ nome: string } | null>(
        `/publico/unidades/${unidadeId}/medico-por-crm?crm=${encodeURIComponent(crm.trim())}`,
      );
      if (dados) setForm((f) => ({ ...f, medico_nome: f.medico_nome || dados.nome }));
    } catch {
      /* sem cadastro prévio pra esse CRM (ou falha de rede) — segue com o formulário em branco */
    } finally {
      setBuscandoMedico(false);
    }
  }

  function alternarHemocomponente(tipo: TipoHemocomponente, selecionado: boolean) {
    setForm((f) => ({ ...f, itens: { ...f.itens, [tipo]: { ...f.itens[tipo], selecionado, ...(selecionado ? {} : { quantidade: "", modificacoes: [] }) } } }));
    setErros((e) => ({ ...e, itens: "", [`itens.${tipo}`]: "" }));
  }

  function definirItem(tipo: TipoHemocomponente, parcial: Partial<ItemHemocomponente>) {
    setForm((f) => ({ ...f, itens: { ...f.itens, [tipo]: { ...f.itens[tipo], ...parcial } } }));
    setErros((e) => ({ ...e, [`itens.${tipo}`]: "" }));
  }

  function alternarModificacao(tipo: TipoHemocomponente, m: Modificacao) {
    const atuais = form.itens[tipo].modificacoes;
    definirItem(tipo, { modificacoes: atuais.includes(m) ? atuais.filter((x) => x !== m) : [...atuais, m] });
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
      const itensPayload = (Object.keys(form.itens) as TipoHemocomponente[])
        .filter((tipo) => form.itens[tipo].selecionado)
        .map((tipo) => ({
          tipo,
          quantidade: Number(form.itens[tipo].quantidade),
          unidade_medida: form.itens[tipo].unidade_medida,
          modificacoes: form.itens[tipo].modificacoes,
        }));

      const resposta = await api.post<{ protocolo: string; token_impressao: string }>(`/publico/unidades/${unidadeId}/formulario-solicitacao`, {
        website: form.website || null,
        convenio: vazioParaNulo(form.convenio),
        data_solicitacao: form.data_solicitacao,
        hora_solicitacao: form.hora_solicitacao,
        nome_paciente: form.nome_paciente,
        cpf: form.cpf,
        cns: vazioParaNulo(form.cns),
        nome_social: vazioParaNulo(form.nome_social),
        prontuario: vazioParaNulo(form.prontuario),
        sexo: form.sexo,
        data_nascimento: form.data_nascimento,
        nome_mae: form.nome_mae,
        raca_cor: vazioParaNulo(form.raca_cor),
        setor_nome: form.setor_nome,
        leito: vazioParaNulo(form.leito),
        peso_kg: form.peso_kg.trim() ? Number(form.peso_kg) : null,
        cep: form.cep,
        logradouro: form.logradouro,
        numero: form.numero,
        bairro: vazioParaNulo(form.bairro),
        cidade: form.cidade,
        uf: form.uf,
        codigo_ibge: vazioParaNulo(form.codigo_ibge),
        diagnostico: form.diagnostico,
        hb: form.hb,
        ht: form.ht,
        plaquetas: vazioParaNulo(form.plaquetas),
        tp: vazioParaNulo(form.tp),
        ttpa: vazioParaNulo(form.ttpa),
        indicacao: form.indicacao,
        antecedentes_transfusionais: form.antecedentes_transfusionais === "sim",
        antecedentes_obstetricos: form.sexo === "F" ? form.antecedentes_obstetricos === "sim" : null,
        reacao_previa: form.reacao_previa === "sim",
        reacao_previa_descricao: form.reacao_previa === "sim" ? form.reacao_previa_descricao : null,
        itens: itensPayload,
        modalidade: form.modalidade,
        data_programada: form.modalidade === "PROGRAMADA" ? form.data_programada : null,
        hora_programada: form.modalidade === "PROGRAMADA" ? form.hora_programada : null,
        observacoes: vazioParaNulo(form.observacoes),
        medico_nome: form.medico_nome,
        medico_crm: form.medico_crm,
        cpf_e_da_mae: form.cpf_e_da_mae,
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
      <div className="bg-gradient-to-r from-formpub to-formpub-dark px-4 pb-16 pt-6 text-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-4 sm:flex-nowrap sm:justify-between">
          <LogoInstituicao
            instituicao={INSTITUICAO_PRIMARIA}
            className="h-10 w-auto shrink-0 rounded-md bg-white/95 px-2 py-1 sm:h-12"
          />
          <div className="flex items-center gap-3 text-center sm:text-left">
            <img src="/brand/hemogest-simbolo.svg" alt="" className="hidden h-12 w-12 shrink-0 sm:block" />
            <div>
              <h1 className="text-xl font-semibold leading-tight sm:text-2xl">Solicitação de transfusão de hemocomponentes</h1>
              <p className="text-sm text-white/85">
                {est.nome} · STH Rev.5
              </p>
            </div>
          </div>
          {INSTITUICAO_SECUNDARIA && (
            <LogoInstituicao
              instituicao={INSTITUICAO_SECUNDARIA}
              className="h-10 w-auto shrink-0 rounded-md bg-white/95 px-2 py-1 sm:h-12"
            />
          )}
        </div>
      </div>

      <div className="mx-auto -mt-10 max-w-4xl space-y-6 px-4">
        {gravado ? (
          <div className="rounded-card border border-neutral-200 bg-surface-card p-6 text-center shadow-sm" role="status">
            <CheckCircle2 className="mx-auto mb-2 text-success" size={44} />
            <h2 className="text-xl font-semibold text-ink">Formulário gravado</h2>
            <p className="mt-1 text-sm text-ink-muted">Protocolo</p>
            <p className="font-mono text-2xl font-bold text-formpub">{gravado.protocolo}</p>
            <p className="mx-auto mt-3 max-w-md text-sm text-ink-muted">Abra a visualização para baixar o PDF oficial (STH), pronto para imprimir e assinar.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Button
                onClick={() => navigate(`/formulario/${gravado.token}`, { state: { unidadeId } })}
                className="flex items-center gap-2 !bg-formpub hover:!bg-formpub-dark"
              >
                <Printer size={16} />
                Abrir e baixar PDF
              </Button>
              <Button variant="secondary" onClick={novoFormulario} className="!border-formpub !text-formpub hover:!bg-formpub/5">
                Preencher outro formulário
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={enviar} noValidate className="space-y-6">
            {/* Aviso HEMOBA (2026-10-01, pedido do cliente) — bem visível,
             * antes de qualquer outra coisa no formulário. Fundo sólido (não
             * translúcido): esse bloco fica na faixa de sobreposição com o
             * cabeçalho escuro (-mt-10 do container pai) — com opacidade
             * baixa o verde do cabeçalho vazava por trás e sujava o texto
             * (2026-10-02, correção de bug real: "desalinhado e enorme"). */}
            <div role="alert" className="rounded-card border-2 border-danger bg-white p-3 text-center shadow-sm">
              <p className="text-sm font-bold text-danger">
                * Os campos com * deverão ser obrigatoriamente preenchidos. O não preenchimento recorre na devolução da
                solicitação e atraso no envio dos hemocomponentes.
              </p>
            </div>

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

            <Secao titulo="Dados do estabelecimento solicitante">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
                <Campo rotulo="Hospital / unidade de saúde" className="sm:col-span-3">
                  <input readOnly value={est.nome} className={clsx(campoBase, "border-neutral-200 bg-neutral-100 font-medium dark:bg-neutral-700")} />
                </Campo>
                <Campo rotulo="CNES" className="sm:col-span-1">
                  <input readOnly value={est.cnes ?? "—"} className={clsx(campoBase, "border-neutral-200 bg-neutral-100 font-medium dark:bg-neutral-700")} />
                </Campo>
                <Campo rotulo="Convênio" className="sm:col-span-2">
                  <input readOnly value={form.convenio} className={clsx(campoBase, "border-neutral-200 bg-neutral-100 font-medium dark:bg-neutral-700")} />
                </Campo>
                {enderecoCompleto && (
                  <Campo rotulo="Endereço" className="sm:col-span-6">
                    <input readOnly value={enderecoCompleto} className={clsx(campoBase, "border-neutral-200 bg-neutral-100 dark:bg-neutral-700")} />
                  </Campo>
                )}
              </div>
            </Secao>

            <Secao titulo="1 · Identificação do paciente">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
                <Campo
                  id="prontuario"
                  rotulo="Nº prontuário *"
                  erro={erro("prontuario")}
                  dica={buscandoProntuario ? "Buscando cadastro..." : prontuarioEncontrado ? "Dados do paciente preenchidos automaticamente." : undefined}
                  className="sm:col-span-3"
                >
                  <input
                    id="prontuario"
                    inputMode="numeric"
                    maxLength={30}
                    autoComplete="off"
                    value={form.prontuario}
                    onChange={(e) => definir("prontuario", somenteDigitos(e.target.value))}
                    onBlur={(e) => buscarPorProntuario(e.target.value)}
                    className={classe("prontuario")}
                  />
                </Campo>
                <Campo
                  id="nome_paciente"
                  rotulo="Nome completo do paciente *"
                  erro={erro("nome_paciente")}
                  dica={
                    buscandoNome
                      ? "Buscando cadastro..."
                      : form.prontuario.trim()
                        ? "Sem abreviações."
                        : "Sem abreviações. Sem o prontuário, procura pelo nome ao sair do campo."
                  }
                  className="sm:col-span-6"
                >
                  <input
                    id="nome_paciente"
                    maxLength={200}
                    autoComplete="off"
                    value={form.nome_paciente}
                    onChange={(e) => definir("nome_paciente", maiusculo(e.target.value))}
                    onBlur={(e) => buscarPorNome(e.target.value)}
                    className={classe("nome_paciente")}
                  />
                  {resultadosNome.length > 0 && (
                    <div className="mt-1.5 overflow-hidden rounded-lg border border-formpub/30 bg-white shadow-sm">
                      <p className="border-b border-formpub/20 bg-formpub/5 px-3 py-1.5 text-xs font-medium text-formpub">
                        Encontrei {resultadosNome.length === 1 ? "este cadastro" : "estes cadastros"} — confirme quem é:
                      </p>
                      <ul>
                        {resultadosNome.map((c) => (
                          <li key={c.numero_prontuario}>
                            <button
                              type="button"
                              onClick={() => selecionarCandidatoNome(c)}
                              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-formpub/5"
                            >
                              <span className="font-medium text-ink">{c.nome_paciente}</span>
                              <span className="shrink-0 text-xs text-ink-muted">
                                {c.data_nascimento ? new Date(`${c.data_nascimento}T12:00:00`).toLocaleDateString("pt-BR") : "—"}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        onClick={() => setResultadosNome([])}
                        className="w-full border-t border-formpub/20 px-3 py-1.5 text-center text-xs text-ink-muted hover:bg-neutral-50"
                      >
                        Nenhum destes / continuar digitando
                      </button>
                    </div>
                  )}
                </Campo>
                <Campo id="cpf" rotulo="CPF *" erro={erro("cpf")} className="sm:col-span-3">
                  <input id="cpf" inputMode="numeric" placeholder="000.000.000-00" value={form.cpf} onChange={(e) => definir("cpf", mascararCpf(e.target.value))} className={classe("cpf")} />
                  <label className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-muted">
                    <input
                      type="checkbox"
                      checked={form.cpf_e_da_mae}
                      onChange={(e) => definir("cpf_e_da_mae", e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-neutral-300"
                    />
                    CPF é da mãe (recém-nascido sem CPF próprio)
                  </label>
                </Campo>
                <Campo id="cns" rotulo="Cartão SUS (CNS) *" erro={erro("cns")} className="sm:col-span-3">
                  <input id="cns" inputMode="numeric" placeholder="000 0000 0000 0000" value={form.cns} onChange={(e) => definir("cns", mascararCns(e.target.value))} className={classe("cns")} />
                </Campo>

                <Campo id="nome_social" rotulo="Nome social" dica="Se houver." className="sm:col-span-6">
                  <input id="nome_social" maxLength={200} autoComplete="off" value={form.nome_social} onChange={(e) => definir("nome_social", maiusculo(e.target.value))} className={classe("nome_social")} />
                </Campo>
                <Campo id="nome_mae" rotulo="Nome da genitora *" erro={erro("nome_mae")} className="sm:col-span-6">
                  <input id="nome_mae" maxLength={200} autoComplete="off" value={form.nome_mae} onChange={(e) => definir("nome_mae", maiusculo(e.target.value))} className={classe("nome_mae")} />
                </Campo>

                <Campo id="setor_nome" rotulo="Unidade / enfermaria *" erro={erro("setor_nome")} className="sm:col-span-6">
                  <select id="setor_nome" value={form.setor_nome} onChange={(e) => definir("setor_nome", e.target.value)} className={classe("setor_nome")}>
                    <option value="">Selecione</option>
                    {SETORES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo id="leito" rotulo="Leito" className="sm:col-span-3">
                  <input id="leito" maxLength={20} autoComplete="off" value={form.leito} onChange={(e) => definir("leito", maiusculo(e.target.value))} className={classe("leito")} />
                </Campo>
                <Campo id="idade" rotulo="Idade" className="sm:col-span-3">
                  <input id="idade" readOnly value={idade || "Automática"} className={clsx(campoBase, "border-neutral-200 bg-neutral-100 dark:bg-neutral-700", !idade && "text-ink-muted")} />
                </Campo>

                <Campo id="cep" rotulo="CEP *" erro={erro("cep")} dica={buscandoCep ? "Buscando endereço..." : "Preenche o resto do endereço automaticamente."} className="sm:col-span-3">
                  <input
                    id="cep"
                    inputMode="numeric"
                    placeholder="00000-000"
                    value={form.cep}
                    onChange={(e) => definir("cep", mascararCep(e.target.value))}
                    onBlur={(e) => buscarCep(e.target.value)}
                    className={classe("cep")}
                  />
                </Campo>
                <Campo id="logradouro" rotulo="Logradouro *" erro={erro("logradouro")} className="sm:col-span-6">
                  <input id="logradouro" maxLength={255} autoComplete="off" value={form.logradouro} onChange={(e) => definir("logradouro", maiusculo(e.target.value))} className={classe("logradouro")} />
                </Campo>
                <Campo id="numero" rotulo="Número *" erro={erro("numero")} className="sm:col-span-3">
                  <input id="numero" maxLength={20} autoComplete="off" value={form.numero} onChange={(e) => definir("numero", maiusculo(e.target.value))} className={classe("numero")} />
                </Campo>

                <Campo id="bairro" rotulo="Bairro" className="sm:col-span-4">
                  <input id="bairro" maxLength={255} autoComplete="off" value={form.bairro} onChange={(e) => definir("bairro", maiusculo(e.target.value))} className={classe("bairro")} />
                </Campo>
                <Campo id="cidade" rotulo="Cidade *" erro={erro("cidade")} className="sm:col-span-5">
                  <input id="cidade" maxLength={120} autoComplete="off" value={form.cidade} onChange={(e) => definir("cidade", maiusculo(e.target.value))} className={classe("cidade")} />
                </Campo>
                <Campo id="uf" rotulo="Estado *" erro={erro("uf")} className="sm:col-span-3">
                  <select id="uf" value={form.uf} onChange={(e) => definir("uf", e.target.value)} className={classe("uf")}>
                    <option value="">—</option>
                    {UFS.map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </select>
                </Campo>
                <Campo id="codigo_ibge" rotulo="Código IBGE" dica="Preenchido junto com o CEP." className="sm:col-span-3">
                  <input id="codigo_ibge" readOnly value={form.codigo_ibge} className={clsx(campoBase, "border-neutral-200 bg-neutral-100 dark:bg-neutral-700")} />
                </Campo>
              </div>
            </Secao>

            <Secao titulo="3 · Clínica">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
                <Campo id="data_nascimento" rotulo="Nascimento *" erro={erro("data_nascimento")} className="sm:col-span-3">
                  <input id="data_nascimento" type="date" min="1900-01-01" max={agora().data} value={form.data_nascimento} onChange={(e) => definir("data_nascimento", e.target.value)} className={classe("data_nascimento")} />
                </Campo>
                <Campo id="sexo" rotulo="Sexo *" erro={erro("sexo")} className="sm:col-span-2">
                  <select id="sexo" value={form.sexo} onChange={(e) => definir("sexo", e.target.value as FormState["sexo"])} className={classe("sexo")}>
                    <option value="">—</option>
                    <option value="M">M</option>
                    <option value="F">F</option>
                  </select>
                </Campo>
                <Campo id="peso_kg" rotulo="Peso (kg)" dica="Ex.: 2,85" className="sm:col-span-2">
                  <input id="peso_kg" type="number" inputMode="decimal" step="0.001" min="0" value={form.peso_kg} onChange={(e) => definir("peso_kg", e.target.value)} className={classe("peso_kg")} />
                </Campo>
                <Campo id="raca_cor" rotulo="Raça / cor" className="sm:col-span-5">
                  <select id="raca_cor" value={form.raca_cor} onChange={(e) => definir("raca_cor", e.target.value)} className={classe("raca_cor")}>
                    <option value="">Selecione</option>
                    {RACAS.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </Campo>

                <Campo id="hb" rotulo="Hb (g/dL) *" erro={erro("hb")} className="sm:col-span-3">
                  <input
                    id="hb"
                    maxLength={20}
                    inputMode="decimal"
                    value={form.hb}
                    onChange={(e) => definir("hb", e.target.value)}
                    onBlur={(e) => definir("hb", formatarUmaCasaDecimal(e.target.value))}
                    className={classe("hb")}
                  />
                </Campo>
                <Campo id="ht" rotulo="Ht (%) *" erro={erro("ht")} className="sm:col-span-3">
                  <input
                    id="ht"
                    maxLength={20}
                    inputMode="decimal"
                    value={form.ht}
                    onChange={(e) => definir("ht", e.target.value)}
                    onBlur={(e) => definir("ht", formatarUmaCasaDecimal(e.target.value))}
                    className={classe("ht")}
                  />
                </Campo>
                <Campo id="plaquetas" rotulo="Plaquetas (/mm³)" className="sm:col-span-3">
                  <input
                    id="plaquetas"
                    maxLength={20}
                    inputMode="numeric"
                    value={form.plaquetas}
                    onChange={(e) => definir("plaquetas", e.target.value)}
                    onBlur={(e) => definir("plaquetas", formatarMilhar(e.target.value))}
                    className={classe("plaquetas")}
                  />
                </Campo>
                <Campo id="tp" rotulo="TP / TTPA" dica="Ex.: 1,1 / 32" className="sm:col-span-3">
                  <div className="flex gap-2">
                    <input id="tp" maxLength={20} inputMode="decimal" placeholder="TP" value={form.tp} onChange={(e) => definir("tp", e.target.value)} className={classe("tp")} />
                    <input id="ttpa" maxLength={20} inputMode="decimal" placeholder="TTPA" value={form.ttpa} onChange={(e) => definir("ttpa", e.target.value)} className={classe("ttpa")} />
                  </div>
                </Campo>

                <Campo id="diagnostico" rotulo="Diagnóstico *" erro={erro("diagnostico")} className="col-span-2 sm:col-span-12">
                  <input id="diagnostico" maxLength={500} value={form.diagnostico} onChange={(e) => definir("diagnostico", maiusculo(e.target.value))} placeholder="Diagnóstico principal" className={classe("diagnostico")} />
                </Campo>

                <Escolha rotulo="Antecedente transfusional? *" nome="ant_transf" valor={form.antecedentes_transfusionais} erro={erro("antecedentes_transfusionais")} onChange={(v) => definir("antecedentes_transfusionais", v as Sn)} opcoes={[{ valor: "nao", rotulo: "Não" }, { valor: "sim", rotulo: "Sim" }]} className="sm:col-span-4" />
                {form.sexo === "F" && (
                  <Escolha rotulo="Antecedentes obstétricos? *" nome="ant_obst" valor={form.antecedentes_obstetricos} erro={erro("antecedentes_obstetricos")} onChange={(v) => definir("antecedentes_obstetricos", v as Sn)} opcoes={[{ valor: "nao", rotulo: "Não" }, { valor: "sim", rotulo: "Sim" }]} className="sm:col-span-4" />
                )}
                <Escolha rotulo="Reação transfusional prévia? *" nome="reacao_previa" valor={form.reacao_previa} erro={erro("reacao_previa")} onChange={(v) => definir("reacao_previa", v as Sn)} opcoes={[{ valor: "nao", rotulo: "Não" }, { valor: "sim", rotulo: "Sim" }]} className="sm:col-span-4" />
                {form.reacao_previa === "sim" && (
                  <Campo id="reacao_previa_descricao" rotulo="Especificar reação transfusional *" erro={erro("reacao_previa_descricao")} className="sm:col-span-12">
                    <input id="reacao_previa_descricao" maxLength={500} value={form.reacao_previa_descricao} onChange={(e) => definir("reacao_previa_descricao", maiusculo(e.target.value))} placeholder="Tipo de reação anterior" className={classe("reacao_previa_descricao")} />
                  </Campo>
                )}
                <Escolha
                  rotulo="Indicação transfusional *"
                  nome="indicacao"
                  valor={form.indicacao}
                  erro={erro("indicacao")}
                  onChange={(v) => definir("indicacao", v as FormState["indicacao"])}
                  opcoes={[...OPCOES_INDICACAO]}
                  className="sm:col-span-4"
                />
              </div>
            </Secao>

            <Secao titulo="4 · Hemoterapia">
              {erro("itens") && (
                <p className="mb-2 text-xs text-danger" role="alert">
                  {erro("itens")}
                </p>
              )}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-neutral-300 text-left text-xs uppercase tracking-wide text-formpub">
                      <th className="py-1.5 pr-2">Hemocomponente</th>
                      <th className="py-1.5 pr-2">Nº unidades / volume</th>
                      <th className="py-1.5">Processo de modificação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {HEMOCOMPONENTES.map((h) => {
                      const item = form.itens[h.tipo];
                      const erroItem = erro(`itens.${h.tipo}`);
                      return (
                        <tr key={h.tipo} className="border-b border-neutral-100 align-top" data-erro={erroItem ? "true" : undefined}>
                          <td className="py-2 pr-2">
                            <label className="flex cursor-pointer items-center gap-1.5 text-sm font-medium text-ink">
                              <input type="checkbox" checked={item.selecionado} onChange={(e) => alternarHemocomponente(h.tipo, e.target.checked)} className="h-4 w-4 accent-formpub" />
                              {h.nome}
                            </label>
                          </td>
                          <td className="py-2 pr-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={1}
                                inputMode="numeric"
                                disabled={!item.selecionado}
                                value={item.quantidade}
                                onChange={(e) => definirItem(h.tipo, { quantidade: e.target.value })}
                                className={clsx(campoBase, "w-20", erroItem ? "border-danger bg-danger/5" : "border-neutral-300")}
                              />
                              {(["UNIDADE", "ML"] as const).map((u) => (
                                <label key={u} className="flex items-center gap-1 text-xs text-ink">
                                  <input
                                    type="radio"
                                    name={`medida-${h.tipo}`}
                                    disabled={!item.selecionado}
                                    checked={item.unidade_medida === u}
                                    onChange={() => definirItem(h.tipo, { unidade_medida: u })}
                                    className="h-3.5 w-3.5 accent-formpub"
                                  />
                                  {u === "UNIDADE" ? "Unid." : "mL"}
                                </label>
                              ))}
                            </div>
                            {erroItem && (
                              <p className="mt-1 text-xs text-danger" role="alert">
                                {erroItem}
                              </p>
                            )}
                          </td>
                          <td className="py-2">
                            {h.modificacoes.length === 0 ? (
                              <span className="text-xs text-ink-muted">—</span>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {h.modificacoes.map((m) => (
                                  <label key={m} className={clsx("flex cursor-pointer items-center gap-1 text-xs text-ink", !item.selecionado && "opacity-50")}>
                                    <input
                                      type="checkbox"
                                      disabled={!item.selecionado}
                                      checked={item.modificacoes.includes(m)}
                                      onChange={() => alternarModificacao(h.tipo, m)}
                                      className="h-3.5 w-3.5 accent-formpub"
                                    />
                                    {NOME_MODIFICACAO[m]}
                                  </label>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-ink-muted">Marque um ou mais hemocomponentes; a quantidade e as modificações de cada um só ficam habilitadas depois de marcá-lo.</p>
            </Secao>

            <Secao titulo="5 · Programação">
              <Escolha rotulo="Modalidade da transfusão *" nome="modalidade" valor={form.modalidade} erro={erro("modalidade")} onChange={(v) => definir("modalidade", v)} opcoes={MODALIDADES} />
              {form.modalidade === "PROGRAMADA" && (
                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-4">
                  <Campo id="data_programada" rotulo="Data prevista *" erro={erro("data_programada")} className="sm:col-span-2">
                    <input id="data_programada" type="date" value={form.data_programada} onChange={(e) => definir("data_programada", e.target.value)} className={classe("data_programada")} />
                  </Campo>
                  <Campo id="hora_programada" rotulo="Hora prevista *" erro={erro("hora_programada")} className="sm:col-span-2">
                    <input id="hora_programada" type="time" value={form.hora_programada} onChange={(e) => definir("hora_programada", e.target.value)} className={classe("hora_programada")} />
                  </Campo>
                </div>
              )}
            </Secao>

            <Secao titulo="Observações complementares">
              <Campo id="observacoes" rotulo="Informações clínicas complementares">
                <textarea id="observacoes" rows={3} maxLength={2000} value={form.observacoes} onChange={(e) => definir("observacoes", maiusculo(e.target.value))} placeholder="Ex.: histórico de sensibilização, urgência justificada, fenotipagem específica" className={classe("observacoes")} />
              </Campo>
            </Secao>

            <Secao titulo="6 · Médico solicitante">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Campo id="medico_crm" rotulo="CRM *" erro={erro("medico_crm")}>
                  <input
                    id="medico_crm"
                    maxLength={30}
                    autoComplete="off"
                    value={form.medico_crm}
                    onChange={(e) => definir("medico_crm", maiusculo(e.target.value))}
                    onBlur={(e) => buscarMedicoPorCrm(e.target.value)}
                    className={classe("medico_crm")}
                  />
                </Campo>
                <Campo
                  id="medico_nome"
                  rotulo="Nome completo do médico solicitante *"
                  erro={erro("medico_nome")}
                  dica={buscandoMedico ? "Buscando médico..." : undefined}
                  className="sm:col-span-2"
                >
                  <input id="medico_nome" maxLength={120} autoComplete="off" value={form.medico_nome} onChange={(e) => definir("medico_nome", maiusculo(e.target.value))} placeholder="Digite o CRM primeiro" className={classe("medico_nome")} />
                </Campo>
              </div>
              <p className="mt-2 text-xs text-ink-muted">Assinatura e telefone não são preenchidos digitalmente.</p>
            </Secao>

            <div className="flex flex-col items-center gap-2 pt-2">
              <Button type="submit" disabled={enviando} className="min-w-56 px-8 py-3 text-base !bg-formpub hover:!bg-formpub-dark">
                {enviando ? "Gravando..." : "Gravar solicitação"}
              </Button>
              <p className="text-xs text-ink-muted">Depois de gravar, você abre a visualização para baixar o PDF oficial.</p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
