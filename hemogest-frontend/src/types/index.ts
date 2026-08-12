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
