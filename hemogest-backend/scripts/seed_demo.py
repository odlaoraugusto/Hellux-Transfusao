"""
HemoGest / Hellux — Seed de dados fictícios para demonstração.

Lacuna conhecida (ver CHECKLIST_ROADMAP.md §3): sem dados de exemplo, um
revisor de artigo ou um gestor de TI avaliando o sistema precisa cadastrar à
mão uma unidade, setores, usuários, pacientes e bolsas antes de conseguir
ver qualquer tela em uso real. Este script resolve isso de uma vez.

Cria uma unidade hospitalar fictícia ("Hospital Demonstração Hellux") com:
  - 4 setores (Pronto Socorro, UTI Adulto, Centro Cirúrgico, Pediatria);
  - 3 usuários, um por papel operacional (Supervisor, Biomédico, Técnico),
    já prontos para logar (ver login/senha impressos no final);
  - 2 médicos requisitantes fictícios;
  - catálogo de hemocomponentes (CH, PF, CP, CR) e motivos de
    devolução/descarte;
  - estoque de bolsas (`UnidadeHemocomponente`) em todos os status —
    disponível, reservada, transfundida, devolvida e descartada —
    incluindo um exemplo de fracionamento em bolsas satélites e uma bolsa
    próxima do vencimento (para o alerta de estoque crítico do dashboard);
  - 3 pacientes fictícios com uma internação cada;
  - 4 solicitações transfusionais em estágios diferentes do fluxo
    (solicitado, em processamento, entregue e cancelado);
  - um acompanhamento transfusional já FINALIZADO com sinais vitais nos
    quatro momentos protocolares — o histórico de transfusão — e uma reação
    transfusional ENCERRADA associada a ele (hemovigilância);
  - uma devolução e um descarte de bolsa, com motivo registrado.

ATENÇÃO — tudo abaixo é inteiramente fictício: nomes, CPF, CNS, números de
prontuário e CRM não correspondem a nenhuma pessoa real. Nunca rode este
script contra um banco de produção, e nunca substitua estes valores por
dados reais de paciente (ver SECURITY.md).

Uso:
    python scripts/seed_demo.py
    python scripts/seed_demo.py --create-tables   # atalho para SQLite local

Idempotente: se a unidade demo já existir (mesmo CNPJ fictício), o script
não faz nada e avisa — para recriar os dados, remova a unidade manualmente
ou rode contra um banco novo.
"""
import argparse
import sys
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.security import hash_password  # noqa: E402
from app.db.encrypted_types import blind_index  # noqa: E402
from app.db.session import Base, SessionLocal, engine  # noqa: E402
from app.models.acompanhamento_transfusional import (  # noqa: E402
    AcompanhamentoTransfusional,
    MomentoSinalVital,
    SinalVital,
    StatusAcompanhamento,
)
from app.models.devolucao_descarte import Descarte, Devolucao  # noqa: E402
from app.models.internacao import Internacao, StatusInternacao  # noqa: E402
from app.models.medico import Medico  # noqa: E402
from app.models.paciente import Paciente  # noqa: E402
from app.models.parametrizacao import Gravidade, Hemocomponente, MotivoDevolucao, TipoReacao  # noqa: E402
from app.models.reacao_transfusional import ReacaoTransfusional, StatusReacao  # noqa: E402
from app.models.role import Role, RoleCodigo  # noqa: E402
from app.models.setor import Setor  # noqa: E402
from app.models.solicitacao_transfusional import (  # noqa: E402
    PrioridadeSolicitacao,
    SolicitacaoBolsa,
    SolicitacaoTransfusional,
    StatusSolicitacao,
)
from app.models.unidade_hemocomponente import StatusHemocomponente, UnidadeHemocomponente  # noqa: E402
from app.models.unidade_hospitalar import UnidadeHospitalar  # noqa: E402
from app.models.usuario import Usuario  # noqa: E402

import app.models  # noqa: E402,F401 — registra todos os models no Base.metadata

CNPJ_DEMO = "00000000000000"
SENHA_DEMO = "Demo123!"
HOJE = date.today()


def agora_menos(horas: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(hours=horas)


def garantir_roles(db) -> dict:
    papeis = [
        (RoleCodigo.SUPERVISOR, "Supervisor", []),
        (RoleCodigo.BIOMEDICO, "Biomédico", []),
        (RoleCodigo.TECNICO, "Técnico", []),
    ]
    por_codigo = {}
    for codigo, nome_exibicao, permissoes in papeis:
        role = db.query(Role).filter(Role.codigo == codigo).first()
        if role is None:
            role = Role(codigo=codigo, nome_exibicao=nome_exibicao, permissoes=permissoes)
            db.add(role)
            db.flush()
        por_codigo[codigo] = role
    return por_codigo


def main() -> None:
    parser = argparse.ArgumentParser(description="Popula o Hellux com dados fictícios de demonstração.")
    parser.add_argument(
        "--create-tables",
        action="store_true",
        help="Cria as tabelas via Base.metadata.create_all antes do seed (atalho para SQLite local).",
    )
    args = parser.parse_args()

    if args.create_tables:
        Base.metadata.create_all(bind=engine)
        print("Tabelas criadas/conferidas via Base.metadata.create_all().")

    db = SessionLocal()
    try:
        existente = db.query(UnidadeHospitalar).filter(UnidadeHospitalar.cnpj == CNPJ_DEMO).first()
        if existente is not None:
            print(f"Unidade demo já existe (id={existente.id}) — nada a fazer. Veja CHECKLIST_ROADMAP.md para recriar.")
            return

        # --- Unidade hospitalar fictícia ---
        unidade = UnidadeHospitalar(
            razao_social="Hospital Demonstração Hellux (dados fictícios)",
            nome_fantasia="Hospital Demonstração Hellux",
            cnpj=CNPJ_DEMO,
            codigo_cnes=None,
            endereco="Rua Fictícia, 123",
            cidade="Cidade Demonstração",
            uf="BA",
            telefone="(71) 0000-0000",
            ativo=True,
        )
        db.add(unidade)
        db.flush()

        # --- Setores ---
        nomes_setores = ["Pronto Socorro", "UTI Adulto", "Centro Cirúrgico", "Pediatria"]
        setores = {}
        for nome in nomes_setores:
            setor = Setor(nome=nome, sigla=nome[:3].upper(), ativo=True, unidade_hospitalar_id=unidade.id)
            db.add(setor)
            db.flush()
            setores[nome] = setor

        # --- Usuários (um por papel operacional), prontos para logar ---
        roles = garantir_roles(db)
        usuarios_demo = [
            ("demo.supervisor", "Supervisor Demonstração", RoleCodigo.SUPERVISOR),
            ("demo.biomedico", "Biomédico Demonstração", RoleCodigo.BIOMEDICO),
            ("demo.tecnico", "Técnico Demonstração", RoleCodigo.TECNICO),
        ]
        for login, nome, codigo_role in usuarios_demo:
            db.add(
                Usuario(
                    nome=nome,
                    login=login,
                    senha_hash=hash_password(SENHA_DEMO),
                    role_id=roles[codigo_role].id,
                    unidade_hospitalar_id=unidade.id,
                    ativo=True,
                    primeiro_acesso=False,
                )
            )
        db.flush()

        # --- Médicos requisitantes fictícios ---
        medico1 = Medico(crm="00001-BA", nome="Dr. Fictício da Demonstração", unidade_hospitalar_id=unidade.id)
        medico2 = Medico(crm="00002-BA", nome="Dra. Exemplo da Demonstração", unidade_hospitalar_id=unidade.id)
        db.add_all([medico1, medico2])
        db.flush()

        # --- Catálogo de hemocomponentes (mesmas siglas usadas no formulário público) ---
        catalogo = [
            ("Concentrado de Hemácias", "CH", 35),
            ("Plasma Fresco", "PF", 365),
            ("Concentrado de Plaquetas", "CP", 5),
            ("Crioprecipitado", "CR", 365),
        ]
        hemocomponentes = {}
        for ordem, (nome, sigla, validade_dias) in enumerate(catalogo):
            hc = Hemocomponente(
                nome=nome, sigla=sigla, validade_padrao_dias=validade_dias, ordem=ordem, ativo=True,
                unidade_hospitalar_id=unidade.id,
            )
            db.add(hc)
            db.flush()
            hemocomponentes[sigla] = hc

        # --- Motivos de devolução/descarte ---
        motivo_vencida = MotivoDevolucao(nome="Bolsa vencida", ordem=0, ativo=True, unidade_hospitalar_id=unidade.id)
        motivo_nao_compareceu = MotivoDevolucao(
            nome="Paciente não compareceu à transfusão", ordem=1, ativo=True, unidade_hospitalar_id=unidade.id
        )
        db.add_all([motivo_vencida, motivo_nao_compareceu])
        db.flush()

        # --- Tipo de reação e gravidade (hemovigilância) ---
        tipo_reacao = TipoReacao(
            nome="Reação Febril Não Hemolítica", ordem=0, ativo=True, unidade_hospitalar_id=unidade.id
        )
        gravidade_leve = Gravidade(nome="Leve", nivel=1, ordem=0, ativo=True, unidade_hospitalar_id=unidade.id)
        db.add_all([tipo_reacao, gravidade_leve])
        db.flush()

        # --- Pacientes fictícios ---
        def novo_paciente(nome, nasc, sexo, tipo_sanguineo, cpf, cns, prontuario, nome_mae=None, telefone=None):
            return Paciente(
                nome=nome,
                data_nascimento=nasc,
                sexo=sexo,
                tipo_sanguineo=tipo_sanguineo,
                cpf=cpf,
                cpf_hash=blind_index(cpf) if cpf else None,
                cns=cns,
                numero_prontuario=prontuario,
                numero_prontuario_hash=blind_index(prontuario) if prontuario else None,
                nome_mae=nome_mae,
                telefone=telefone,
                unidade_hospitalar_id=unidade.id,
            )

        paciente1 = novo_paciente(
            "Maria Fictícia da Silva (dado de demonstração)", date(1985, 4, 12), "F", "O+",
            "00000000001", "000000000000001", "DEMO-0001", telefone="(71) 00000-0001",
        )
        paciente2 = novo_paciente(
            "José Fictício Pereira (dado de demonstração)", date(1970, 11, 3), "M", "A+",
            "00000000002", "000000000000002", "DEMO-0002", telefone="(71) 00000-0002",
        )
        paciente3 = novo_paciente(
            "Recém-Nascido Fictício de Souza (dado de demonstração)", HOJE - timedelta(days=5), "M", "O-",
            cpf=None, cns=None, prontuario="DEMO-0003", nome_mae="Ana Fictícia de Souza (dado de demonstração)",
        )
        db.add_all([paciente1, paciente2, paciente3])
        db.flush()

        # --- Internações ---
        internacao1 = Internacao(
            paciente_id=paciente1.id, setor_atual_id=setores["UTI Adulto"].id,
            numero_internacao="DEMO-INT-0001", leito="UTI-02", data_entrada=HOJE - timedelta(days=3),
            status=StatusInternacao.ATIVA, unidade_hospitalar_id=unidade.id,
        )
        internacao2 = Internacao(
            paciente_id=paciente2.id, setor_atual_id=setores["Centro Cirúrgico"].id,
            numero_internacao="DEMO-INT-0002", leito="CC-01", data_entrada=HOJE - timedelta(days=1),
            status=StatusInternacao.ATIVA, unidade_hospitalar_id=unidade.id,
        )
        db.add_all([internacao1, internacao2])
        db.flush()

        # --- Estoque de bolsas (UnidadeHemocomponente) ---
        def nova_bolsa(numero, sigla, validade, status=StatusHemocomponente.DISPONIVEL, codigo_satelite=None,
                       bolsa_mae_id=None, paciente_reservado_id=None, tipo_sanguineo="O+"):
            return UnidadeHemocomponente(
                hemocomponente_id=hemocomponentes[sigla].id,
                numero_bolsa=numero,
                codigo_satelite=codigo_satelite,
                bolsa_mae_id=bolsa_mae_id,
                tipo_sanguineo=tipo_sanguineo,
                data_coleta=HOJE - timedelta(days=2),
                data_validade=validade,
                status=status,
                paciente_reservado_id=paciente_reservado_id,
                unidade_hospitalar_id=unidade.id,
            )

        bolsas_disponiveis = [
            nova_bolsa("DEMO-CH-0001", "CH", HOJE + timedelta(days=30)),
            nova_bolsa("DEMO-CH-0002", "CH", HOJE + timedelta(days=28), tipo_sanguineo="A+"),
            nova_bolsa("DEMO-PF-0001", "PF", HOJE + timedelta(days=300)),
            nova_bolsa("DEMO-CR-0001", "CR", HOJE + timedelta(days=300)),
            # Próxima do vencimento — exercita o alerta de estoque crítico do dashboard.
            nova_bolsa("DEMO-CP-0001", "CP", HOJE + timedelta(days=2)),
        ]
        db.add_all(bolsas_disponiveis)
        db.flush()

        # Fracionamento: bolsa-mãe de CH dividida em duas bolsas satélites.
        bolsa_mae = nova_bolsa("DEMO-CH-0003", "CH", HOJE + timedelta(days=30), tipo_sanguineo="B+")
        db.add(bolsa_mae)
        db.flush()
        satelites = [
            nova_bolsa("DEMO-CH-0003", "CH", HOJE + timedelta(days=30), codigo_satelite="A",
                       bolsa_mae_id=bolsa_mae.id, tipo_sanguineo="B+"),
            nova_bolsa("DEMO-CH-0003", "CH", HOJE + timedelta(days=30), codigo_satelite="B",
                       bolsa_mae_id=bolsa_mae.id, tipo_sanguineo="B+"),
        ]
        db.add_all(satelites)

        bolsa_reservada = nova_bolsa(
            "DEMO-CH-0004", "CH", HOJE + timedelta(days=25),
            status=StatusHemocomponente.RESERVADO, paciente_reservado_id=paciente1.id,
        )
        bolsa_transfundida = nova_bolsa("DEMO-CH-0005", "CH", HOJE + timedelta(days=20), status=StatusHemocomponente.TRANSFUNDIDO)
        bolsa_devolvida = nova_bolsa("DEMO-PF-0002", "PF", HOJE + timedelta(days=280), status=StatusHemocomponente.DEVOLVIDO)
        bolsa_descartada = nova_bolsa("DEMO-CP-0002", "CP", HOJE - timedelta(days=1), status=StatusHemocomponente.DESCARTADO)
        db.add_all([bolsa_reservada, bolsa_transfundida, bolsa_devolvida, bolsa_descartada])
        db.flush()

        db.add(Devolucao(
            unidade_hemocomponente_id=bolsa_devolvida.id, motivo_devolucao_id=motivo_nao_compareceu.id,
            observacao="Paciente recebeu alta antes da transfusão (dado fictício).",
            unidade_hospitalar_id=unidade.id,
        ))
        db.add(Descarte(
            unidade_hemocomponente_id=bolsa_descartada.id, motivo_descarte_id=motivo_vencida.id,
            observacao="Bolsa vencida sem uso (dado fictício).", unidade_hospitalar_id=unidade.id,
        ))

        # --- Solicitações transfusionais em estágios diferentes ---
        solicitacao_solicitada = SolicitacaoTransfusional(
            internacao_id=internacao1.id, paciente_id=paciente1.id, setor_solicitante_id=setores["UTI Adulto"].id,
            hemocomponente_id=hemocomponentes["CH"].id, quantidade=2, prioridade=PrioridadeSolicitacao.ROTINA,
            indicacao="Anemia sintomática (indicação fictícia, dado de demonstração).",
            medico_solicitante=medico1.nome, status=StatusSolicitacao.SOLICITADO,
            unidade_hospitalar_id=unidade.id,
        )
        solicitacao_em_processamento = SolicitacaoTransfusional(
            internacao_id=internacao2.id, paciente_id=paciente2.id, setor_solicitante_id=setores["Centro Cirúrgico"].id,
            hemocomponente_id=hemocomponentes["CP"].id, quantidade=1, prioridade=PrioridadeSolicitacao.URGENTE,
            indicacao="Plaquetopenia pré-operatória (indicação fictícia, dado de demonstração).",
            medico_solicitante=medico2.nome, status=StatusSolicitacao.EM_PROCESSAMENTO,
            data_inicio_processamento=agora_menos(1), unidade_hospitalar_id=unidade.id,
        )
        solicitacao_cancelada = SolicitacaoTransfusional(
            internacao_id=internacao2.id, paciente_id=paciente2.id, setor_solicitante_id=setores["Centro Cirúrgico"].id,
            hemocomponente_id=hemocomponentes["PF"].id, quantidade=1, prioridade=PrioridadeSolicitacao.ROTINA,
            indicacao="Pedido duplicado por engano (dado fictício).", medico_solicitante=medico2.nome,
            status=StatusSolicitacao.CANCELADO, motivo_cancelamento="Erro de digitação — pedido duplicado (dado fictício).",
            cancelado_em=agora_menos(2), unidade_hospitalar_id=unidade.id,
        )
        db.add_all([solicitacao_solicitada, solicitacao_em_processamento, solicitacao_cancelada])
        db.flush()

        registrador_demo_id = uuid.uuid4()  # placeholder de auditoria — não aponta a um usuário real específico

        # Solicitação já ENTREGUE, com histórico completo de transfusão.
        solicitacao_entregue = SolicitacaoTransfusional(
            paciente_id=paciente1.id, setor_solicitante_id=setores["UTI Adulto"].id,
            hemocomponente_id=hemocomponentes["CH"].id, quantidade=1, prioridade=PrioridadeSolicitacao.ROTINA,
            indicacao="Anemia pós-operatória (indicação fictícia, dado de demonstração).",
            medico_solicitante=medico1.nome, status=StatusSolicitacao.ENTREGUE,
            data_solicitacao=agora_menos(5), data_inicio_processamento=agora_menos(4), data_entrega=agora_menos(3),
            abo_paciente="O+", pesquisa_anticorpos_irregulares="NEGATIVA", unidade_hospitalar_id=unidade.id,
        )
        db.add(solicitacao_entregue)
        db.flush()

        db.add(SolicitacaoBolsa(
            solicitacao_id=solicitacao_entregue.id, numero_bolsa="DEMO-CH-0006", tipo_sanguineo="O+",
            data_validade=HOJE + timedelta(days=15), volume_ml=280, prova_cruzada="COMPATIVEL",
            responsavel_testes="Biomédico Demonstração", folha_emitida_por=registrador_demo_id,
            folha_emitida_em=agora_menos(4), temperatura_transporte_c=4.0, recebido_por="Enfermagem UTI (fictício)",
            entregue_em=agora_menos(3), entregue_por=registrador_demo_id,
        ))

        acompanhamento = AcompanhamentoTransfusional(
            solicitacao_id=solicitacao_entregue.id, status=StatusAcompanhamento.FINALIZADO,
            data_inicio=agora_menos(3), data_fim=agora_menos(2),
            observacoes_finalizacao="Transfusão concluída sem intercorrências graves (dado fictício).",
            unidade_hospitalar_id=unidade.id,
        )
        db.add(acompanhamento)
        db.flush()

        sinais = [
            (MomentoSinalVital.PRE, agora_menos(3), 36.5, "120/80", 78, 16, 98),
            (MomentoSinalVital.DEZ_MINUTOS, agora_menos(3) + timedelta(minutes=10), 36.6, "122/80", 80, 16, 98),
            (MomentoSinalVital.UMA_HORA, agora_menos(3) + timedelta(hours=1), 36.8, "118/78", 76, 15, 99),
            (MomentoSinalVital.FINAL, agora_menos(2), 36.7, "120/80", 77, 16, 99),
        ]
        for momento, quando, temp, pa, fc, fr, sat in sinais:
            db.add(SinalVital(
                acompanhamento_id=acompanhamento.id, momento=momento, data_hora=quando,
                temperatura_c=temp, pressao_arterial=pa, frequencia_cardiaca_bpm=fc,
                frequencia_respiratoria_ipm=fr, saturacao_o2_pct=sat, registrado_por=registrador_demo_id,
            ))

        db.add(ReacaoTransfusional(
            acompanhamento_id=acompanhamento.id, tipo_reacao_id=tipo_reacao.id, gravidade_id=gravidade_leve.id,
            status=StatusReacao.ENCERRADA,
            descricao="Episódio febril leve durante a transfusão, sem outros sinais (dado fictício).",
            data_abertura=agora_menos(2) + timedelta(minutes=30),
            investigacao="Investigação não identificou outra causa além de reação febril não hemolítica (dado fictício).",
            conclusao="Resolvido com antitérmico, sem necessidade de interromper a transfusão (dado fictício).",
            data_encerramento=agora_menos(1), unidade_hospitalar_id=unidade.id,
        ))

        db.commit()

        print("Dados de demonstração criados com sucesso.")
        print(f"Unidade: Hospital Demonstração Hellux (id={unidade.id})")
        print("Usuários para login (todos com a mesma senha de demonstração):")
        for login, nome, _ in usuarios_demo:
            print(f"  - login: {login} / senha: {SENHA_DEMO}  ({nome})")
    finally:
        db.close()


if __name__ == "__main__":
    main()
