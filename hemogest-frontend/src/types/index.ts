export interface Usuario {
  id: string;
  nome: string;
  login: string;
  role_id: string;
  role_codigo: "ADMIN_GLOBAL" | "SUPERVISOR" | "BIOMEDICO" | "TECNICO" | "RT" | null;
  unidade_hospitalar_id: string | null;
  ativo: boolean;
  primeiro_acesso: boolean;
  ultimo_login_em: string | null;
}

export interface UnidadeHospitalar {
  id: string;
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  codigo_cnes: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  telefone: string | null;
  logo_object_name: string | null;
  ativo: boolean;
  /** Módulos opcionais (ver MODULOS.md) — cada unidade liga o que usa
   * de verdade, conforme seu fluxo real (com ou sem estoque próprio). */
  modulo_estoque_ativo: boolean;
  modulo_mapa_trabalho_ativo: boolean;
  modulo_solicitacao_hemocentro_ativo: boolean;
}

export interface Role {
  id: string;
  codigo: string;
  nome_exibicao: string;
  descricao: string | null;
  permissoes: string[];
}

export interface Paciente {
  id: string;
  nome: string;
  data_nascimento: string | null;
  sexo: string | null;
  cpf: string | null;
  cns: string | null;
  numero_prontuario: string | null;
  tipo_sanguineo: string | null;
  telefone: string | null;
  nome_mae: string | null;
}

export interface EstoqueItem {
  hemocomponente_id: string;
  nome: string;
  sigla: string | null;
  bolsas_disponiveis: number;
}

export interface IndicadorDiario {
  data: string;
  entradas: number;
  saidas: number;
  descartes: number;
  retornos: number;
}

export interface Pendencias {
  transfusoes_em_andamento: number;
  reacoes_abertas: number;
}

/** Formulário de solicitação de transfusão (formulário público). */
export interface FormularioEstabelecimento {
  nome: string;
  razao_social: string;
  cnpj: string;
  cnes: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  telefone: string | null;
}

/** Os 4 hemocomponentes fixos do documento oficial (STH Rev.5) — não um
 * catálogo configurável. */
export type TipoHemocomponente = "CH" | "PF" | "CP" | "CR";
export type Modificacao = "ALI" | "FIL" | "IRR" | "LAV";

export interface FormularioItem {
  tipo: TipoHemocomponente;
  quantidade: number;
  unidade_medida: "UNIDADE" | "ML";
  modificacoes: Modificacao[];
}

export interface FormularioSolicitacao {
  id: string;
  protocolo: string;
  criado_em: string;
  estabelecimento: FormularioEstabelecimento;
  convenio: string | null;
  data_solicitacao: string;
  hora_solicitacao: string;
  nome_paciente: string;
  cpf: string | null;
  cpf_e_da_mae: boolean;
  cns: string | null;
  nome_social: string | null;
  prontuario: string | null;
  sexo: "M" | "F";
  data_nascimento: string;
  nome_mae: string;
  raca_cor: string | null;
  setor_nome: string;
  leito: string | null;
  peso_kg: number | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  codigo_ibge: string | null;
  diagnostico: string;
  hb: string;
  ht: string;
  plaquetas: string | null;
  tp: string | null;
  ttpa: string | null;
  indicacao: "USO" | "RESERVA";
  antecedentes_transfusionais: boolean;
  antecedentes_obstetricos: boolean | null;
  reacao_previa: boolean;
  reacao_previa_descricao: string | null;
  itens: FormularioItem[];
  modalidade: "EMERGENCIA" | "URGENCIA" | "ROTINA" | "PROGRAMADA";
  data_programada: string | null;
  hora_programada: string | null;
  observacoes: string | null;
  medico_nome: string;
  medico_crm: string;
}

export interface FormularioResumo {
  id: string;
  protocolo: string;
  criado_em: string;
  data_solicitacao: string;
  hora_solicitacao: string;
  nome_paciente: string;
  setor_nome: string;
  leito: string | null;
  modalidade: FormularioSolicitacao["modalidade"];
  medico_nome: string;
  hemocomponentes: string[];
}
