export interface Usuario {
  id: string;
  nome: string;
  email: string;
  role_id: string;
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
  logo_object_name: string | null;
  ativo: boolean;
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
}

export interface FormularioItem {
  hemocomponente_id: string | null;
  hemocomponente_nome: string;
  hemocomponente_sigla: string | null;
  quantidade: number;
  unidade_medida: "UNIDADE" | "ML";
  modificacoes: string[];
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
  prontuario: string;
  sexo: "M" | "F";
  data_nascimento: string;
  nome_mae: string;
  raca_cor: string;
  setor_nome: string;
  leito: string;
  peso_kg: number;
  diagnostico: string;
  hb: string;
  ht: string;
  plaquetas: string;
  tp: string | null;
  ttpa: string | null;
  indicacao: "USO" | "RESERVA";
  antecedentes_transfusionais: boolean;
  antecedentes_obstetricos: boolean | null;
  reacao_previa: boolean;
  reacao_previa_descricao: string | null;
  itens: FormularioItem[];
  modalidade: "EMERGENCIA" | "URGENCIA" | "ROTINA" | "PROGRAMADA";
  observacoes: string | null;
  termo_heterogrupo_medico: string | null;
  termo_heterogrupo_crm: string | null;
  termo_emergencia_medico: string | null;
  termo_emergencia_crm: string | null;
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
  leito: string;
  modalidade: FormularioSolicitacao["modalidade"];
  medico_nome: string;
  hemocomponentes: string[];
}
