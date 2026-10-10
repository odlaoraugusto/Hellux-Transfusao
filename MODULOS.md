# Módulos configuráveis

Cada agência transfusional do SUS organiza o próprio fluxo de um jeito
diferente. Algumas só transfundem — recebem a bolsa já pronta e não mantêm
estoque próprio, então o lançamento é simples. Outras recebem bolsas do
hemocentro de referência, fazem os próprios testes pré-transfusionais e
controlam estoque internamente, num fluxo bem mais completo.

Em vez de impor um fluxo único, o Hellux tem três seções que cada unidade
liga ou desliga conforme o que faz de verdade. Isso evita dois problemas:
telas que não se aplicam poluindo o dia a dia de quem tem o fluxo simples,
e falta de controle de verdade pra quem tem o fluxo completo.

## Os três módulos

### 1. Estoque de bolsas (`modulo_estoque_ativo`)

Tela **Hemocomponentes**: entrada de bolsas (número, tipo sanguíneo,
validade, nº macarrão), fracionamento em bolsas satélites e reserva para
paciente. Alimenta o indicador de estoque do Dashboard.

- **Ligue** se a unidade recebe e guarda bolsas (do hemocentro, de outro
  serviço, ou produção própria) antes de usá-las.
- **Desligue** se a unidade só transfunde bolsas que já chegam prontas,
  registradas direto na Solicitação — nesse caso, o estoque gerenciado pelo
  sistema não existe de verdade, e a tela só confundiria.

Desligar este módulo **não** afeta o fluxo principal de Solicitações: o
registro de bolsa dentro de uma Solicitação (número, ABO/Rh, validade,
prova cruzada) é digitado direto, independente de haver estoque controlado
ou não — os dois fluxos são desacoplados de propósito.

### 2. Mapa de trabalho pré-transfusional (`modulo_mapa_trabalho_ativo`)

Ficha técnica de laboratório para cada bolsa registrada numa Solicitação:
confirmação de ABO/Rh do receptor e do doador, técnica da prova cruzada e
da pesquisa de anticorpos irregulares, lotes dos reagentes usados, validade
dos reagentes, temperatura da amostra e o período de execução. Fica
arquivada junto com a Solicitação — acessível pelo mesmo ícone que abre a
Folha de Hemotransfusão da bolsa.

- **Ligue** se a própria unidade realiza os testes pré-transfusionais
  (ABO/Rh, prova cruzada, PAI) e precisa manter o registro técnico de como
  foram feitos — rastreabilidade de lote de reagente e dupla checagem,
  entre outras coisas, que a hemovigilância pode exigir depois.
- **Desligue** se os testes são feitos em outro serviço (ex.: o próprio
  hemocentro envia a bolsa já testada e liberada) — os campos mínimos de
  compatibilidade (prova cruzada, responsável pelos testes) continuam
  registrados na Solicitação independentemente deste módulo; o que
  desliga é só a ficha técnica detalhada extra.

### 3. Solicitação ao hemocentro (`modulo_solicitacao_hemocentro_ativo`)

Tela **Solicitação Hemocentro**: o caminho inverso do formulário público —
em vez de um setor pedir hemocomponente à agência, a própria agência pede
reposição de estoque ao hemocentro de referência. Acompanha o pedido por
status (solicitada → enviada → recebida) e, ao confirmar o recebimento, já
lança as bolsas chegadas no estoque, com a solicitação marcada como
origem — sem precisar lançar a mesma informação duas vezes.

- **Ligue** se a unidade de fato pede reposição de estoque a um hemocentro
  e quer rastrear esse pedido pelo sistema.
- **Desligue** se a unidade não controla estoque próprio (não faz sentido
  pedir reposição de algo que não existe) ou se esse controle já é feito
  por outro meio, fora do sistema.

Este módulo **exige** o módulo de Estoque ligado — o sistema bloqueia
tentar ativá-lo sem o Estoque, e o `400` que a API devolve explica o
motivo.

## Como ligar/desligar

Só o **Administrador Global** vê e edita os módulos — é uma decisão de
implantação/TI de cada unidade, não uma configuração do dia a dia
assistencial (por isso nem o Supervisor da própria unidade pode mudar).

Na tela **Unidade Hospitalar**, o Admin Global encontra o ícone de
controles deslizantes ao lado de cada unidade na lista, que abre o painel
de módulos com os três interruptores e uma explicação curta de cada um.
Mudar um módulo tem efeito imediato: a tela correspondente aparece ou
desaparece do menu da própria unidade na próxima atualização.

Via API, a mesma operação é:

```
PATCH /api/v1/unidades-hospitalares/{id}/modulos
Authorization: Bearer <token do Admin Global>
Content-Type: application/json

{"modulo_estoque_ativo": true, "modulo_solicitacao_hemocentro_ativo": true}
```

Campos omitidos mantêm o valor atual — não precisa reenviar os três toda
vez.

## Valores padrão

| Módulo | Padrão | Por quê |
|---|---|---|
| Estoque de bolsas | Ligado | Preserva o comportamento já existente antes desta funcionalidade. |
| Mapa de trabalho pré-transfusional | Ligado | Novo, mas não custa nada deixar disponível; quem não faz os testes na própria unidade simplesmente não o usa. |
| Solicitação ao hemocentro | Desligado | Fluxo novo e mais específico — cada unidade liga quando decidir usá-lo. |

## Dois perfis de exemplo

**Unidade que só transfunde** (recebe a bolsa já testada e pronta):
- Estoque de bolsas: **desligado**
- Mapa de trabalho pré-transfusional: **desligado**
- Solicitação ao hemocentro: **desligado**

Fica só com o fluxo central de Solicitações: pedido do setor → entrega da
bolsa (com os dados mínimos de compatibilidade) → acompanhamento da
transfusão.

**Unidade com estoque e testes completos** (recebe do hemocentro, testa e
guarda bolsas):
- Estoque de bolsas: **ligado**
- Mapa de trabalho pré-transfusional: **ligado**
- Solicitação ao hemocentro: **ligado**

Usa o sistema inteiro: controla estoque, registra a ficha técnica de cada
teste, e pede reposição ao hemocentro quando o estoque está baixo.

Nada impede uma combinação no meio do caminho — por exemplo, manter
estoque próprio mas sem pedir reposição pelo sistema (estoque ligado,
hemocentro desligado), se a reposição ainda for feita por fora.
