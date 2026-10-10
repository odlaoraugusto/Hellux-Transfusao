/**
 * Gera o PDF oficial da Solicitação de Transfusão de Hemocomponentes
 * (STH Rev.5) sobrepondo o texto preenchido sobre o documento original —
 * não é um layout HTML impresso pelo navegador, é o próprio PDF do
 * hospital com os campos escritos em cima, nas posições exatas (2026-09-30,
 * pedido do cliente: "o formulário público será esse [documento]").
 *
 * Texto sempre em negrito e preto (2026-09-30, pedido do cliente) — nunca
 * mudar `COR_TEXTO`/`HelveticaBold` para outra cor/peso sem pedido novo.
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { FormularioEstabelecimento, FormularioSolicitacao, Modificacao, TipoHemocomponente } from "@/types";
import { INSTITUICAO_PRIMARIA, INSTITUICAO_SECUNDARIA } from "@/config/instituicao";

const TEMPLATE_URL = "/formularios/sth-rev5-template.pdf";
const COR_TEXTO: [number, number, number] = [0, 0, 0];

// Logos na caixa do título "SOLICITAÇÃO DE TRANSFUSÃO DE HEMOCOMPONENTES",
// uma de cada lado do texto (2026-10-06, pedido do cliente) — mesmas logos
// já usadas em outras telas do sistema (ver RelatoriosPage.tsx), configuráveis
// por instituição (ver src/config/instituicao.ts) em vez de fixas. Precisam
// ser PNG — pdf-lib não embute SVG. Sem logo configurada para um dos lados,
// esse lado simplesmente não é desenhado. A caixa do título mede
// x=150.5..497.38, y=14.64..56.52 (medido direto no PDF); o texto em si
// ocupa x=219.29..431.76, então sobra ~69pt à esquerda e ~66pt à direita
// pra encaixar as logos sem encostar nem no texto nem na borda.
const LOGOS_TITULO = {
  // {x, bTop, w, h}: x e bTop (topo) a partir do canto superior esquerdo da
  // página, igual à convenção de TX abaixo — só que aqui bTop é o topo da
  // imagem, não a linha de base de um texto.
  hmijs: { x: 154, bTop: 29.25, w: 60, h: 12.55 },
  fesf: { x: 435.75, bTop: 29.65, w: 58, h: 11.7 },
} as const;

/** Canto superior esquerdo da caixa "☐"; centro real = (x+2.1, y+4.8). */
const CB = {
  sus: [347.1, 184.2], conv: [474.7, 184.2],
  at_nao: [46.0, 315.0], at_sim: [77.3, 315.0],
  ao_nao: [148.6, 315.0], ao_sim: [179.9, 315.0],
  rt_nao: [247.9, 315.0], rt_sim: [279.2, 315.0],
  p_CH: [43.8, 371.3], p_PF: [43.8, 385.6], p_CP: [43.8, 399.8], p_CR: [43.8, 414.1],
  m_CH_ALI: [289.9, 371.3], m_CH_FIL: [372.9, 371.3], m_CH_IRR: [442.5, 371.3], m_CH_LAV: [510.5, 371.3],
  m_PF_ALI: [289.4, 385.6],
  m_CP_ALI: [289.4, 399.8], m_CP_FIL: [370.5, 399.8], m_CP_IRR: [434.3, 399.8],
  mod_PROGRAMADA: [148.6, 429.5], mod_ROTINA: [147.7, 441.5], mod_URGENCIA: [258.6, 441.5], mod_EMERGENCIA: [373.4, 441.5],
} as const satisfies Record<string, readonly [number, number]>;

/** x, baseline (origem no topo), largura máx. (pt), tamanho máx. da fonte. */
const TX = {
  // Telefone fica logo abaixo do nome da unidade, não embaixo do próprio
  // rótulo "Telefone de contato da Unidade:" (2026-10-06, pedido do
  // cliente: "ao lado do nome da unidade") — medido direto no PDF: o nome
  // da unidade real já ocupa quase todo o espaço da linha 1 (até ~x=331),
  // sem sobra pra encaixar o telefone na mesma linha antes do rótulo
  // "Telefone" (que começa em x=337), então ele vai na linha 2 (em branco
  // no modelo original), alinhado embaixo do nome em vez de embaixo do
  // rótulo distante.
  hospital: { x: 143, b: 122, w: 190, s: 9 }, telefone: { x: 143, b: 134, w: 300, s: 9 },
  data: { x: 463, b: 134, w: 48, s: 8.5 }, hora: { x: 518, b: 134, w: 54, s: 8.5 },
  nome: { x: 118, b: 151, w: 335, s: 10 }, cpf: { x: 485, b: 148, w: 88, s: 9 },
  // Genitora (2026-10-02, correção de bug real: célula ia até x=575.4, mas
  // só tinha 95pt alocados a partir de x=360 — nomes longos ficavam
  // minúsculos sem necessidade; célula real tem ~205pt livres ali).
  social: { x: 118, b: 172, w: 165, s: 9 }, genitora: { x: 360, b: 172, w: 205, s: 9 },
  unidade: { x: 89, b: 198.5, w: 157, s: 9 }, leito: { x: 266, b: 198, w: 18, s: 8 }, prontuario: { x: 297, b: 204, w: 43, s: 9 },
  convenio: { x: 481, b: 202, w: 92, s: 8 },
  // Espaço em branco dentro da célula "☐ Cartão SUS", ao lado de "Convênio
  // especifique:" (2026-09-30, pedido do cliente) — mesma linha, célula
  // vizinha à esquerda; medido direto no PDF (x0=341.5..469.1, y0=184.2).
  cns: { x: 347, b: 202, w: 118, s: 8 },
  // Seção 2 "Endereço" (2026-10-01, correção de bug real: campo existia no
  // PDF oficial mas nunca era preenchido) — célula "Endereço de residência
  // do paciente / Nº / Bairro" (y0=215..242) medida direto no PDF.
  logradouro: { x: 46, b: 236, w: 350, s: 9 },
  numero: { x: 406, b: 236, w: 60, s: 8.5 },
  bairro: { x: 477, b: 236, w: 94, s: 8.5 },
  // Linha de baixo "CEP / Estado de origem / Município de origem / IBGE
  // (município)" (y0=242..263) — célula mais baixa, fonte menor.
  cep: { x: 46, b: 259, w: 58, s: 7.5 },
  uf: { x: 113, b: 259, w: 97, s: 7.5 },
  municipio: { x: 219, b: 259, w: 127, s: 7.5 },
  ibge: { x: 355, b: 259, w: 77, s: 7.5 },
  nasc: { x: 46, b: 292, w: 52, s: 8.5 }, sexo: { x: 121, b: 286, w: 19, s: 9 }, peso: { x: 164, b: 286, w: 34, s: 8.5 },
  raca: { x: 220.5, b: 286, w: 19, s: 8 }, ht: { x: 263, b: 286, w: 34, s: 8.5 }, hb: { x: 320, b: 286, w: 20.5, s: 8.5 },
  plaq: { x: 362, b: 286, w: 34, s: 8.5 }, tp: { x: 431, b: 286, w: 22, s: 8 },
  rtEsp: { x: 341, b: 320.5, w: 55, s: 7 },
  q_CH: { x: 170, b: 377.3, w: 110, s: 9 }, q_PF: { x: 170, b: 391.6, w: 110, s: 9 },
  q_CP: { x: 170, b: 405.9, w: 110, s: 9 }, q_CR: { x: 170, b: 420.2, w: 110, s: 9 },
  pdata: { x: 252, b: 436.3, w: 52, s: 8.5 }, phora: { x: 330, b: 436.3, w: 40, s: 8.5 },
  medico: { x: 48, b: 516.5, w: 220, s: 9 },
  // Célula "Indicação transfusional" — em branco no documento original (sem
  // posição no arquivo recebido); medida direto no PDF (2026-09-30).
  indicacao: { x: 403, b: 320, w: 165, s: 9 },
} as const satisfies Record<string, { x: number; b: number; w: number; s: number }>;

const DIAG = { x: 458, w: 115, yTop: 281.5, yBot: 297.5 };

const NOME_TIPO: Record<TipoHemocomponente, string> = {
  CH: "Concentrado de Hemácias", PF: "Plasma Fresco", CP: "Concentrado de Plaquetas", CR: "Crioprecipitado",
};

function brData(iso: string | null): string {
  return iso ? iso.split("-").reverse().join("/") : "";
}

function horaCurta(hora: string | null): string {
  return hora ? hora.slice(0, 5) : "";
}

/** CPF vem do backend só com os 11 dígitos — formata pra exibição no PDF
 * (2026-10-01, pedido do cliente: "deve aparecer no formato xxx.xxx.xxx-xx").
 * Recém-nascido sem CPF próprio usa o da mãe — marcado com "(Mãe)" na
 * frente pra não ser confundido com o CPF do próprio paciente (2026-10-02,
 * pedido do cliente). */
function formatarCpf(cpf: string | null, ehDaMae: boolean): string {
  const d = (cpf ?? "").replace(/\D/g, "");
  const formatado = d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : cpf ?? "";
  return ehDaMae && formatado ? `(Mãe) ${formatado}` : formatado;
}

function formatarCep(cep: string | null): string {
  const d = (cep ?? "").replace(/\D/g, "");
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : cep ?? "";
}

let templateBytesCache: ArrayBuffer | null = null;
async function carregarTemplate(): Promise<ArrayBuffer> {
  if (!templateBytesCache) {
    const resp = await fetch(TEMPLATE_URL);
    if (!resp.ok) throw new Error("Não foi possível carregar o modelo do formulário oficial.");
    templateBytesCache = await resp.arrayBuffer();
  }
  return templateBytesCache;
}

const logoBytesCache = new Map<string, ArrayBuffer>();
async function carregarLogo(url: string): Promise<ArrayBuffer> {
  let bytes = logoBytesCache.get(url);
  if (!bytes) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("Não foi possível carregar uma logo do formulário.");
    bytes = await resp.arrayBuffer();
    logoBytesCache.set(url, bytes);
  }
  return bytes;
}

/** Gera os bytes do PDF preenchido — pronto para baixar/abrir num blob URL. */
export async function gerarPdfSolicitacao(dados: FormularioSolicitacao): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(await carregarTemplate());
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.getPage(0);
  const H = page.getHeight();
  const col = rgb(...COR_TEXTO);

  const logosConfiguradas = [
    [INSTITUICAO_PRIMARIA.logoUrl, LOGOS_TITULO.hmijs] as const,
    [INSTITUICAO_SECUNDARIA?.logoUrl ?? null, LOGOS_TITULO.fesf] as const,
  ].filter(([url]) => url != null) as [string, typeof LOGOS_TITULO.hmijs][];

  for (const [url, pos] of logosConfiguradas) {
    const img = await pdf.embedPng(await carregarLogo(url));
    page.drawImage(img, { x: pos.x, y: H - pos.bTop - pos.h, width: pos.w, height: pos.h });
  }

  const larguraDoTexto = (t: string, s: number) => font.widthOfTextAtSize(t, s);
  const ajustarTamanho = (t: string, w: number, s: number, min = 3.5) => {
    while (s > min && larguraDoTexto(t, s) > w) s -= 0.25;
    return s;
  };

  function put(campo: keyof typeof TX, texto: string | null | undefined) {
    if (!texto) return;
    const c = TX[campo];
    const s = ajustarTamanho(texto, c.w, c.s);
    page.drawText(texto, { x: c.x, y: H - c.b, size: s, font, color: col });
  }

  function marcar(campo: keyof typeof CB) {
    const [wx, wy] = CB[campo];
    const cx = wx + 2.1;
    const cy = H - (wy + 4.8);
    const h = 1.9;
    const o = { thickness: 0.9, color: col };
    page.drawLine({ start: { x: cx - h, y: cy - h }, end: { x: cx + h, y: cy + h }, ...o });
    page.drawLine({ start: { x: cx - h, y: cy + h }, end: { x: cx + h, y: cy - h }, ...o });
  }

  const est: FormularioEstabelecimento = dados.estabelecimento;

  // 0 · Estabelecimento
  put("hospital", est.nome);
  put("telefone", est.telefone && `Tel: ${est.telefone}`);
  // O convênio (ex.: "SUS") sempre vai escrito em "Convênio especifique:"
  // (2026-09-30, correção de bug real: estava marcando Cartão SUS à toa).
  if (dados.convenio) {
    marcar("conv");
    put("convenio", dados.convenio);
  }
  // Nº do Cartão SUS (CNS), obrigatório no formulário (2026-09-30, pedido
  // do cliente) — vai na célula "☐ Cartão SUS", ao lado de Convênio.
  if (dados.cns) {
    marcar("sus");
    put("cns", dados.cns.replace(/(\d{3})(\d{4})(\d{4})(\d{4})/, "$1 $2 $3 $4"));
  }
  put("data", brData(dados.data_solicitacao));
  put("hora", horaCurta(dados.hora_solicitacao));

  // 1 · Identificação
  put("nome", dados.nome_paciente);
  put("cpf", formatarCpf(dados.cpf, dados.cpf_e_da_mae));
  put("social", dados.nome_social);
  put("genitora", dados.nome_mae);
  put("unidade", dados.setor_nome);
  put("prontuario", dados.prontuario);
  put("leito", dados.leito);

  // 2 · Endereço (2026-10-01, correção de bug real: campo existia no PDF
  // oficial mas nunca era preenchido).
  put("logradouro", dados.logradouro);
  put("numero", dados.numero);
  put("bairro", dados.bairro);
  put("cep", formatarCep(dados.cep));
  put("uf", dados.uf);
  put("municipio", dados.cidade);
  put("ibge", dados.codigo_ibge);

  // 3 · Clínica
  put("nasc", brData(dados.data_nascimento));
  put("sexo", dados.sexo);
  put("peso", dados.peso_kg != null ? `${dados.peso_kg} kg` : "");
  put("raca", dados.raca_cor);
  put("ht", dados.ht);
  put("hb", dados.hb);
  put("plaq", dados.plaquetas);
  put("tp", [dados.tp, dados.ttpa].filter(Boolean).join("/"));

  if (dados.diagnostico) {
    const t = dados.diagnostico;
    let s = 8;
    let linhas: string[] = [];
    const quebrar = (tam: number) => {
      const saida: string[] = [];
      let atual = "";
      for (const palavra of t.split(/\s+/)) {
        const nova = atual ? `${atual} ${palavra}` : palavra;
        if (larguraDoTexto(nova, tam) <= DIAG.w) atual = nova;
        else {
          if (atual) saida.push(atual);
          atual = palavra;
        }
      }
      saida.push(atual);
      return saida;
    };
    for (; s > 3.5; s -= 0.25) {
      linhas = quebrar(s);
      if (linhas.length * s * 1.08 <= DIAG.yBot - DIAG.yTop && linhas.every((l) => larguraDoTexto(l, s) <= DIAG.w)) break;
    }
    linhas = quebrar(s);
    const lh = s * 1.08;
    const tot = linhas.length * lh;
    const mid = (DIAG.yTop + DIAG.yBot) / 2;
    linhas.forEach((l, i) => page.drawText(l, { x: DIAG.x, y: H - (mid - tot / 2 + s * 0.82 + i * lh), size: s, font, color: col }));
  }

  if (dados.antecedentes_transfusionais) marcar("at_sim");
  else marcar("at_nao");
  if (dados.sexo === "F" && dados.antecedentes_obstetricos !== null) marcar(dados.antecedentes_obstetricos ? "ao_sim" : "ao_nao");
  marcar(dados.reacao_previa ? "rt_sim" : "rt_nao");
  if (dados.reacao_previa) put("rtEsp", dados.reacao_previa_descricao);
  put("indicacao", dados.indicacao);

  // 4 · Hemoterapia
  for (const item of dados.itens) {
    marcar(`p_${item.tipo}` as keyof typeof CB);
    put(`q_${item.tipo}` as keyof typeof TX, `${item.quantidade} ${item.unidade_medida === "ML" ? "mL" : "un."}`);
    for (const mod of item.modificacoes) {
      const chave = `m_${item.tipo}_${mod}` as keyof typeof CB;
      if (chave in CB) marcar(chave);
    }
  }

  // 5 · Modalidade
  marcar(`mod_${dados.modalidade}` as keyof typeof CB);
  if (dados.modalidade === "PROGRAMADA") {
    put("pdata", brData(dados.data_programada));
    put("phora", horaCurta(dados.hora_programada));
  }

  // 6 · Médico
  if (dados.medico_nome || dados.medico_crm) {
    put("medico", [dados.medico_nome, dados.medico_crm && `CRM ${dados.medico_crm}`].filter(Boolean).join(" – "));
  }

  // A página 2 (termo de responsabilidade/verso) só sai impressa em
  // Emergência — nas outras modalidades, só a página 1 (2026-09-30,
  // pedido do cliente).
  if (dados.modalidade !== "EMERGENCIA" && pdf.getPageCount() > 1) {
    pdf.removePage(1);
  }

  return pdf.save();
}

export function nomeArquivoSolicitacao(dados: FormularioSolicitacao): string {
  const base = (dados.nome_paciente || "paciente").replace(/[^A-Za-z0-9]+/g, "_").slice(0, 30);
  const data = dados.data_solicitacao.split("-").join("");
  const hora = dados.hora_solicitacao.replace(":", "").slice(0, 4);
  return `STH_${base}_${data}_${hora}.pdf`;
}

export function nomeExibicaoTipo(tipo: TipoHemocomponente): string {
  return NOME_TIPO[tipo];
}

export function abrirBlobPdf(bytes: Uint8Array): string {
  return URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
}

export type { Modificacao, TipoHemocomponente };
