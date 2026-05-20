const PRETO = "b";
const BRANCO = "w";
const COR_IA = PRETO;
const PROFUNDIDADE_MINIMAX = 8;
const SIMULACOES_MCTS = 1500;
const UCB_MCTS = Math.SQRT2;
const MAX_PASSOS_SIMULACAO = 200;
const ATRASO_PENSAR = 500;
const ATRASO_PASSO = 450;
const MAX_LANCES = 120;
const URL_GEMINI =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent";
const CHAVE_GEMINI = "YOUR_API_KEY_HERE"; // coloque uma chave do gemini aqui

function dormir(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const tabuleiroEl = document.getElementById("tabuleiro");
const contadorPretoEl = document.getElementById("contador-preto");
const contadorBrancoEl = document.getElementById("contador-branco");
const papelPretoEl = document.getElementById("papel-preto");
const papelBrancoEl = document.getElementById("papel-branco");
const jogadorPretoEl = document.getElementById("jogador-preto");
const jogadorBrancoEl = document.getElementById("jogador-branco");
const botaoReiniciar = document.getElementById("reiniciar");
const historicoEl = document.getElementById("historico");
const modoAdversarioEl = document.getElementById("modo-adversario");
const botaoDica = document.getElementById("botao-dica");
const statusDicaEl = document.getElementById("status-dica");
const saidaDicaEl = document.getElementById("saida-dica");

let estado = { tabuleiro: [], vez: BRANCO, selecionada: null };
let modoAdversario = "manual";
let iaPensando = false;
let jogoAcabou = false;
let vencedor = null;
let historico = [];
let dicaUsadaNoTurno = false;
let resumoPedido = false;
let dicaCarregando = false;
let minimaxEhPreto = true; // sorteado a cada nova partida no modo IA vs IA
let partidaAtual = 0; // incrementado em novoJogo() para cancelar fluxos da partida anterior

function clonarTabuleiro(tabuleiro) {
  return tabuleiro.map((linha) =>
    linha.map((casa) => (casa ? { cor: casa.cor, dama: casa.dama } : null)),
  );
}

// reinicia tudo e começa o jogo
function novoJogo() {
  partidaAtual++; // invalida todos os fluxos assíncronos da partida anterior
  cancelarArraste();

  const t = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let l = 0; l < 3; l++)
    for (let c = 0; c < 8; c++) if ((l + c) % 2 === 1) t[l][c] = { cor: PRETO, dama: false };
  for (let l = 5; l < 8; l++)
    for (let c = 0; c < 8; c++) if ((l + c) % 2 === 1) t[l][c] = { cor: BRANCO, dama: false };

  if (modoIAvsIA()) minimaxEhPreto = Math.random() < 0.5;

  estado = { tabuleiro: t, vez: BRANCO, selecionada: null };
  jogoAcabou = false;
  vencedor = null;
  iaPensando = false;
  historico = [];
  dicaUsadaNoTurno = false;
  resumoPedido = false;
  dicaCarregando = false;
  if (saidaDicaEl) saidaDicaEl.textContent = "";
  if (statusDicaEl) statusDicaEl.textContent = "";
  desenhar();
  agendarTurnoIA();
}

function modoIAvsIA() {
  return modoAdversario === "minimax-vs-montecarlo";
}

function corControladaPelaIA(cor) {
  if (modoAdversario === "manual") return false;
  if (modoIAvsIA()) return true;
  return cor === COR_IA;
}

function ehVezDaIA() {
  return corControladaPelaIA(estado.vez) && !jogoAcabou;
}

function corControladaPorHumano(cor) {
  return !corControladaPelaIA(cor);
}

// atualiza a tela com o estado atual
function desenhar() {
  tabuleiroEl.innerHTML = "";
  const temCaptura = existeCaptura(estado.tabuleiro, estado.vez);
  for (let l = 0; l < 8; l++) {
    for (let c = 0; c < 8; c++) {
      const casa = document.createElement("div");
      casa.className = "casa " + ((l + c) % 2 ? "escura" : "clara");
      casa.dataset.r = l;
      casa.dataset.c = c;
      const peca = estado.tabuleiro[l][c];
      if (peca) {
        const el = document.createElement("div");
        const ehDaVez = peca.cor === estado.vez && corControladaPorHumano(peca.cor) && !iaPensando;
        const podeCapturar = ehDaVez && temCaptura && capturasDe(estado.tabuleiro, l, c).length > 0;
        el.className =
          "peca " +
          (peca.cor === PRETO ? "preta" : "branca") +
          (peca.dama ? " dama" : "") +
          (podeCapturar ? " deve-mover" : "");
        el.dataset.r = l;
        el.dataset.c = c;
        if (ehDaVez) el.addEventListener("mousedown", iniciarArraste);
        casa.appendChild(el);
      }
      tabuleiroEl.appendChild(casa);
    }
  }
  if (contadorPretoEl) contadorPretoEl.textContent = contarPecas(estado.tabuleiro, PRETO);
  if (contadorBrancoEl) contadorBrancoEl.textContent = contarPecas(estado.tabuleiro, BRANCO);
  atualizarPainelJogadores();
  atualizarBotaoDica();
}

function nomeJogador(cor) {
  if (modoAdversario === "manual") return "Humano";
  if (modoIAvsIA()) {
    const ehMinimax = (cor === PRETO) === minimaxEhPreto;
    return ehMinimax ? "Minimax (α-β)" : "Monte Carlo";
  }
  if (cor === COR_IA) return modoAdversario === "minimax" ? "Minimax (α-β)" : "Monte Carlo";
  return "Humano";
}

function atualizarPainelJogadores() {
  if (papelPretoEl) papelPretoEl.textContent = nomeJogador(PRETO);
  if (papelBrancoEl) papelBrancoEl.textContent = nomeJogador(BRANCO);
  if (jogadorPretoEl) jogadorPretoEl.classList.toggle("ativo", estado.vez === PRETO && !jogoAcabou);
  if (jogadorBrancoEl) jogadorBrancoEl.classList.toggle("ativo", estado.vez === BRANCO && !jogoAcabou);
}

function dentroDoTabuleiro(l, c) {
  return l >= 0 && l < 8 && c >= 0 && c < 8;
}

function adversario(cor) {
  return cor === PRETO ? BRANCO : PRETO;
}

function casaNoPonto(x, y) {
  const el = document.elementFromPoint(x, y);
  return el ? el.closest(".casa") : null;
}

// casas onde a peça pode ir sem capturar
function movimentosSimples(tabuleiro, l, c) {
  const peca = tabuleiro[l][c];
  if (!peca) return [];
  const movimentos = [];
  const direcoes = peca.dama
    ? [[1, 1], [1, -1], [-1, 1], [-1, -1]]
    : peca.cor === PRETO
      ? [[1, 1], [1, -1]]
      : [[-1, 1], [-1, -1]];

  for (const [dl, dc] of direcoes) {
    if (peca.dama) {
      let nl = l + dl, nc = c + dc;
      while (dentroDoTabuleiro(nl, nc) && !tabuleiro[nl][nc]) {
        movimentos.push([nl, nc]);
        nl += dl;
        nc += dc;
      }
    } else {
      const nl = l + dl, nc = c + dc;
      if (dentroDoTabuleiro(nl, nc) && !tabuleiro[nl][nc]) movimentos.push([nl, nc]);
    }
  }
  return movimentos;
}

// destinos possíveis de captura para a peça
function capturasDe(tabuleiro, l, c) {
  const peca = tabuleiro[l][c];
  if (!peca) return [];
  const capturas = [];
  const direcoes = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

  for (const [dl, dc] of direcoes) {
    if (peca.dama) {
      let nl = l + dl, nc = c + dc, achouAdversario = false;
      while (dentroDoTabuleiro(nl, nc)) {
        const casa = tabuleiro[nl][nc];
        if (!achouAdversario) {
          if (casa) {
            if (casa.cor === adversario(peca.cor)) achouAdversario = true;
            else break;
          }
        } else {
          if (!casa) capturas.push([nl, nc]);
          else break;
        }
        nl += dl;
        nc += dc;
      }
    } else {
      const nl = l + dl, nc = c + dc, sl = l + 2 * dl, sc = c + 2 * dc;
      if (
        dentroDoTabuleiro(sl, sc) &&
        tabuleiro[nl]?.[nc] &&
        tabuleiro[nl][nc].cor === adversario(peca.cor) &&
        !tabuleiro[sl][sc]
      ) {
        capturas.push([sl, sc]);
      }
    }
  }
  return capturas;
}

function existeCaptura(tabuleiro, cor) {
  for (let l = 0; l < 8; l++)
    for (let c = 0; c < 8; c++) {
      const peca = tabuleiro[l][c];
      if (peca && peca.cor === cor && capturasDe(tabuleiro, l, c).length) return true;
    }
  return false;
}

function temMovimentos(tabuleiro, cor) {
  for (let l = 0; l < 8; l++)
    for (let c = 0; c < 8; c++) {
      const peca = tabuleiro[l][c];
      if (peca && peca.cor === cor) {
        if (capturasDe(tabuleiro, l, c).length) return true;
        if (movimentosSimples(tabuleiro, l, c).length) return true;
      }
    }
  return false;
}

function coroarSeNecessario(tabuleiro, l, c) {
  const peca = tabuleiro[l][c];
  if (!peca || peca.dama) return;
  if (peca.cor === PRETO && l === 7) peca.dama = true;
  if (peca.cor === BRANCO && l === 0) peca.dama = true;
}

// encontra a peça que foi saltada no caminho
function casaCapturada(tabuleiro, deL, deC, paraL, paraC) {
  const dl = paraL - deL, dc = paraC - deC;
  const absL = Math.abs(dl), absC = Math.abs(dc);
  if (absL === 0 || absL !== absC) return null;
  const passoL = dl / absL, passoC = dc / absC;
  let nl = deL + passoL, nc = deC + passoC;
  while (nl !== paraL || nc !== paraC) {
    if (tabuleiro[nl][nc]) return [nl, nc];
    nl += passoL;
    nc += passoC;
  }
  return null;
}

// move, captura e coroa se chegou na última linha
function aplicarPasso(tabuleiro, deL, deC, paraL, paraC) {
  const peca = tabuleiro[deL][deC];
  if (!peca) return false;
  const capturada = casaCapturada(tabuleiro, deL, deC, paraL, paraC);
  tabuleiro[paraL][paraC] = peca;
  tabuleiro[deL][deC] = null;
  if (capturada) tabuleiro[capturada[0]][capturada[1]] = null;
  coroarSeNecessario(tabuleiro, paraL, paraC);
  return true;
}

// todas as sequências de saltos possíveis a partir da peça
function sequenciasDeCaptura(tabuleiro, l, c) {
  const sequencias = [];

  function buscar(tab, al, ac, passos) {
    const capturas = capturasDe(tab, al, ac);
    if (capturas.length === 0) {
      if (passos.length) sequencias.push(passos.slice());
      return;
    }
    for (const [pl, pc] of capturas) {
      const proximo = clonarTabuleiro(tab);
      aplicarPasso(proximo, al, ac, pl, pc);
      passos.push({ deL: al, deC: ac, paraL: pl, paraC: pc });
      buscar(proximo, pl, pc, passos);
      passos.pop();
    }
  }

  buscar(tabuleiro, l, c, []);
  return sequencias;
}

// capturas são obrigatórias e têm prioridade sobre movimentos simples
function todosOsMovimentos(tabuleiro, cor) {
  const movimentos = [];
  const obrigaCaptura = existeCaptura(tabuleiro, cor);

  for (let l = 0; l < 8; l++) {
    for (let c = 0; c < 8; c++) {
      const peca = tabuleiro[l][c];
      if (!peca || peca.cor !== cor) continue;
      if (obrigaCaptura) {
        for (const passos of sequenciasDeCaptura(tabuleiro, l, c)) movimentos.push({ passos });
      } else {
        for (const [pl, pc] of movimentosSimples(tabuleiro, l, c))
          movimentos.push({ passos: [{ deL: l, deC: c, paraL: pl, paraC: pc }] });
      }
    }
  }
  return movimentos;
}

function aplicarMovimento(tabuleiro, movimento) {
  const proximo = clonarTabuleiro(tabuleiro);
  for (const p of movimento.passos) aplicarPasso(proximo, p.deL, p.deC, p.paraL, p.paraC);
  return proximo;
}

function clonarEstado(est) {
  return { tabuleiro: clonarTabuleiro(est.tabuleiro), vez: est.vez };
}

function aplicarMovimentoNoEstado(est, movimento) {
  const proximo = clonarEstado(est);
  for (const p of movimento.passos) aplicarPasso(proximo.tabuleiro, p.deL, p.deC, p.paraL, p.paraC);
  proximo.vez = adversario(est.vez);
  return proximo;
}

function contarPecas(tabuleiro, cor) {
  return tabuleiro.flat().filter((p) => p && p.cor === cor).length;
}

// implementação do Monte Carlo (MCTS)

// 1 = IA ganhou, 0 = perdeu, null = ainda em jogo
function resultadoTerminal(est, corIA) {
  if (contarPecas(est.tabuleiro, corIA) === 0) return 0;
  if (contarPecas(est.tabuleiro, adversario(corIA)) === 0) return 1;
  if (!temMovimentos(est.tabuleiro, est.vez)) return est.vez === corIA ? 0 : 1;
  return null;
}

// estimativa pelo material quando a simulação não termina
function resultadoHeuristico(tabuleiro, corIA) {
  let score = 0;
  for (let l = 0; l < 8; l++)
    for (let c = 0; c < 8; c++) {
      const p = tabuleiro[l][c];
      if (!p) continue;
      score += (p.cor === corIA ? 1 : -1) * (p.dama ? 3 : 1);
    }
  return Math.max(0, Math.min(1, (score + 15) / 30));
}

// simula jogadas aleatórias para avaliar a posição
function simulacaoAleatoria(est, corIA) {
  let atual = clonarEstado(est);
  for (let i = 0; i < MAX_PASSOS_SIMULACAO; i++) {
    const terminal = resultadoTerminal(atual, corIA);
    if (terminal !== null) return terminal;
    const movimentos = todosOsMovimentos(atual.tabuleiro, atual.vez);
    if (!movimentos.length) return atual.vez === corIA ? 0 : 1;
    atual = aplicarMovimentoNoEstado(atual, movimentos[Math.floor(Math.random() * movimentos.length)]);
  }
  return resultadoHeuristico(atual.tabuleiro, corIA);
}

class NoMCTS {
  constructor(est, pai, movimento) {
    this.estado = est;
    this.pai = pai;
    this.movimento = movimento;
    this.filhos = [];
    this.naoExplorados = todosOsMovimentos(est.tabuleiro, est.vez);
    this.visitas = 0;
    this.vitoriasIA = 0;
  }
}

// UCB: equilibra explorar o desconhecido e aproveitar o que já funciona
function escolherFilhoMCTS(no, corIA) {
  const maximiza = no.estado.vez === corIA;
  let melhor = no.filhos[0];
  let melhorScore = -Infinity;
  for (const filho of no.filhos) {
    if (filho.visitas === 0) return filho;
    const taxa = filho.vitoriasIA / filho.visitas;
    const explorar = maximiza ? taxa : 1 - taxa;
    const investigar = UCB_MCTS * Math.sqrt(Math.log(no.visitas) / filho.visitas);
    const score = explorar + investigar;
    if (score > melhorScore) {
      melhorScore = score;
      melhor = filho;
    }
  }
  return melhor;
}

// a jogada mais visitada depois das simulações
function melhorJogadaMCTS(tabuleiro, vez, corIA, simulacoes) {
  const stats = { simulacoes: 0, nosArvore: 1, filhos: [] };
  const raizEstado = { tabuleiro, vez };
  const raiz = new NoMCTS(clonarEstado(raizEstado), null, null);
  const movimentos = todosOsMovimentos(tabuleiro, vez);

  if (!movimentos.length) return { jogada: null, stats };
  if (movimentos.length === 1) return { jogada: movimentos[0], stats };

  for (let i = 0; i < simulacoes; i++) {
    stats.simulacoes++;
    let no = raiz;
    let est = clonarEstado(raizEstado);

    while (no.naoExplorados.length === 0 && no.filhos.length > 0) {
      no = escolherFilhoMCTS(no, corIA);
      est = aplicarMovimentoNoEstado(est, no.movimento);
    }

    if (no.naoExplorados.length > 0) {
      const idx = Math.floor(Math.random() * no.naoExplorados.length);
      const movimento = no.naoExplorados.splice(idx, 1)[0];
      est = aplicarMovimentoNoEstado(est, movimento);
      const filho = new NoMCTS(clonarEstado(est), no, movimento);
      no.filhos.push(filho);
      stats.nosArvore++;
      no = filho;
    }

    const resultado = simulacaoAleatoria(est, corIA);
    while (no) {
      no.visitas++;
      no.vitoriasIA += resultado;
      no = no.pai;
    }
  }

  const melhorFilho = raiz.filhos.reduce((melhor, filho) => (filho.visitas > melhor.visitas ? filho : melhor));
  stats.filhos = raiz.filhos
    .map((filho) => ({
      jogada: notacaoDoMovimento(filho.movimento),
      visitas: filho.visitas,
      taxaVitoria: filho.visitas > 0 ? filho.vitoriasIA / filho.visitas : 0,
    }))
    .sort((a, b) => b.visitas - a.visitas);

  return { jogada: melhorFilho.movimento, stats };
}

// implementacao do Minimax (alfa-beta)

// material, avanço e controle do centro
function avaliar(tabuleiro, corIA) {
  let score = 0;
  for (let l = 0; l < 8; l++)
    for (let c = 0; c < 8; c++) {
      const p = tabuleiro[l][c];
      if (!p) continue;
      const sinal = p.cor === corIA ? 1 : -1;
      score += sinal * (p.dama ? 3 : 1);
      if (!p.dama) score += sinal * (p.cor === PRETO ? l : 7 - l) * 0.05;
      score += sinal * (3.5 - Math.abs(c - 3.5)) * 0.02;
    }
  if (!temMovimentos(tabuleiro, corIA)) score -= 10000;
  if (!temMovimentos(tabuleiro, adversario(corIA))) score += 10000;
  return score;
}

// minimax recursivo com poda alfa-beta
function minimax(tabuleiro, profundidade, alfa, beta, maximiza, corIA, stats) {
  stats.nos++;
  const cor = maximiza ? corIA : adversario(corIA);
  const movimentos = todosOsMovimentos(tabuleiro, cor);

  if (profundidade === 0 || movimentos.length === 0) {
    stats.folhas++;
    return avaliar(tabuleiro, corIA);
  }

  if (maximiza) {
    let melhor = -Infinity;
    for (const movimento of movimentos) {
      const valor = minimax(aplicarMovimento(tabuleiro, movimento), profundidade - 1, alfa, beta, false, corIA, stats);
      melhor = Math.max(melhor, valor);
      alfa = Math.max(alfa, valor);
      if (beta <= alfa) {
        stats.podas++;
        break;
      }
    }
    return melhor;
  }

  let melhor = Infinity;
  for (const movimento of movimentos) {
    const valor = minimax(aplicarMovimento(tabuleiro, movimento), profundidade - 1, alfa, beta, true, corIA, stats);
    melhor = Math.min(melhor, valor);
    beta = Math.min(beta, valor);
    if (beta <= alfa) {
      stats.podas++;
      break;
    }
  }
  return melhor;
}

// testa todas as jogadas e retorna a melhor
function melhorJogadaMinimax(tabuleiro, corIA, profundidade) {
  const stats = { nos: 0, podas: 0, folhas: 0 };
  const movimentos = todosOsMovimentos(tabuleiro, corIA);
  if (!movimentos.length) return { jogada: null, stats };

  let melhorJogada = movimentos[0];
  let melhorScore = -Infinity;
  let alfa = -Infinity;

  for (const movimento of movimentos) {
    const score = minimax(aplicarMovimento(tabuleiro, movimento), profundidade - 1, alfa, Infinity, false, corIA, stats);
    if (score > melhorScore) {
      melhorScore = score;
      melhorJogada = movimento;
    }
    alfa = Math.max(alfa, score);
  }

  return { jogada: melhorJogada, stats };
}


function notacaoDoMovimento(movimento) {
  const colunas = "ABCDEFGH";
  const primeiro = movimento.passos[0];
  const ultimo = movimento.passos[movimento.passos.length - 1];
  const de = colunas[primeiro.deC] + (8 - primeiro.deL);
  const para = colunas[ultimo.paraC] + (8 - ultimo.paraL);
  return movimento.passos.length > 1 ? `${de}x${para}` : `${de}-${para}`;
}

function notacaoDoPasso(deL, deC, paraL, paraC, ehCaptura) {
  const colunas = "ABCDEFGH";
  const de = colunas[deC] + (8 - deL);
  const para = colunas[paraC] + (8 - paraL);
  return ehCaptura ? `${de}x${para}` : `${de}-${para}`;
}

function nomeCor(cor) {
  return cor === PRETO ? "Preto" : "Branco";
}

// converte o tabuleiro para o Gemini ler
function tabuleiroEmTexto(tabuleiro) {
  const linhas = [];
  for (let l = 0; l < 8; l++) {
    let linha = `${8 - l} `;
    for (let c = 0; c < 8; c++) {
      const p = tabuleiro[l][c];
      if (!p) linha += ".";
      else if (p.cor === PRETO) linha += p.dama ? "B" : "b";
      else linha += p.dama ? "W" : "w";
      linha += " ";
    }
    linhas.push(linha.trim());
  }
  return linhas.join("\n") + "\n(b/B=preto, w/W=branco, .=vazio, colunas A-H)";
}

function nomeAdversario() {
  if (modoIAvsIA()) {
    const nomePReto = minimaxEhPreto ? "Minimax (α-β)" : "Monte Carlo";
    const nomeBranco = minimaxEhPreto ? "Monte Carlo" : "Minimax (α-β)";
    return `${nomePReto} (Preto) vs ${nomeBranco} (Branco)`;
  }
  if (modoAdversario === "minimax") return "IA Minimax (α-β)";
  if (modoAdversario === "montecarlo") return "IA Monte Carlo";
  return "2 jogadores humanos";
}

function registrarLance(cor, notacao) {
  historico.push(`${nomeCor(cor)}: ${notacao}`);
}


const ESQUEMA_DICA = {
  type: "OBJECT",
  properties: {
    situacao: { type: "STRING", enum: ["boa", "neutra", "ruim"] },
    situacao_detalhe: { type: "STRING" },
    vantagem: { type: "STRING", enum: ["preto", "branco", "empate"] },
    melhor_jogada: { type: "STRING" },
    melhor_jogada_motivo: { type: "STRING" },
  },
  required: ["situacao", "situacao_detalhe", "vantagem", "melhor_jogada", "melhor_jogada_motivo"],
};

const ESQUEMA_RESUMO = {
  type: "OBJECT",
  properties: {
    resumo: { type: "STRING" },
    preto_pontos_fortes: { type: "STRING" },
    preto_melhorar: { type: "STRING" },
    branco_pontos_fortes: { type: "STRING" },
    branco_melhorar: { type: "STRING" },
  },
  required: ["resumo", "preto_pontos_fortes", "preto_melhorar", "branco_pontos_fortes", "branco_melhorar"],
};

const ROTULO_SITUACAO = { boa: "Boa", neutra: "Neutra", ruim: "Ruim" };
const ROTULO_VANTAGEM = { preto: "Preto", branco: "Branco", empate: "Empate" };

function formatarDica(dados) {
  return [
    `Situação: ${ROTULO_SITUACAO[dados.situacao] || dados.situacao}`,
    dados.situacao_detalhe,
    "",
    `Quem está ganhando: ${ROTULO_VANTAGEM[dados.vantagem] || dados.vantagem}`,
    "",
    `Melhor jogada: ${dados.melhor_jogada}`,
    dados.melhor_jogada_motivo,
  ].join("\n");
}

function formatarResumo(dados) {
  return [
    "Resumo da partida",
    dados.resumo,
    "",
    "Preto",
    `Pontos fortes: ${dados.preto_pontos_fortes}`,
    `O que melhorar: ${dados.preto_melhorar}`,
    "",
    "Branco",
    `Pontos fortes: ${dados.branco_pontos_fortes}`,
    `O que melhorar: ${dados.branco_melhorar}`,
  ].join("\n");
}

function montarPromptDica() {
  const historicoTexto = historico.length ? historico.join("\n") : "Nenhuma jogada registrada.";
  return `Analise esta posição de damas brasileiras (8x8) e sugira a melhor jogada para o jogador atual.

Modo: ${nomeAdversario()}
Jogador atual: ${nomeCor(estado.vez)}
Peças - Preto: ${contarPecas(estado.tabuleiro, PRETO)}, Branco: ${contarPecas(estado.tabuleiro, BRANCO)}

Tabuleiro:
${tabuleiroEmTexto(estado.tabuleiro)}

Histórico:
${historicoTexto}

Use notação de coluna+linha (ex: C3-D4 ou E5xG3) em melhor_jogada.`;
}

function montarPromptResumo() {
  const historicoTexto = historico.length ? historico.join("\n") : "Nenhuma jogada registrada.";
  return `Analise esta partida de damas brasileiras encerrada.

Modo: ${nomeAdversario()}
Vencedor: ${vencedor ? nomeCor(vencedor) : "Indefinido"}
Peças finais - Preto: ${contarPecas(estado.tabuleiro, PRETO)}, Branco: ${contarPecas(estado.tabuleiro, BRANCO)}

Tabuleiro final:
${tabuleiroEmTexto(estado.tabuleiro)}

Histórico:
${historicoTexto}`;
}

// chama o Gemini e retorna o JSON
async function chamarGemini(prompt, esquema) {
  const resposta = await fetch(URL_GEMINI, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-goog-api-key": CHAVE_GEMINI },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: esquema },
    }),
  });
  if (!resposta.ok) throw new Error(`Erro na API (${resposta.status})`);
  const dados = await resposta.json();
  const texto = dados.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!texto) throw new Error("Resposta vazia da IA");
  try {
    return JSON.parse(texto);
  } catch {
    throw new Error("Resposta da IA em formato inválido");
  }
}

// sincroniza o botão de dica com o estado atual
function atualizarBotaoDica() {
  if (!botaoDica) return;
  if (dicaCarregando) {
    botaoDica.disabled = true;
    botaoDica.textContent = "Consultando IA...";
    return;
  }
  if (jogoAcabou) {
    botaoDica.textContent = resumoPedido ? "Resumo obtido" : "Resumo da partida";
    botaoDica.disabled = resumoPedido;
    if (statusDicaEl)
      statusDicaEl.textContent = resumoPedido ? "Resumo disponível abaixo." : "Partida encerrada - peça um resumo da IA.";
    return;
  }
  botaoDica.textContent = "Pedir dica da IA ✨";
  botaoDica.disabled = !(corControladaPorHumano(estado.vez) && !dicaUsadaNoTurno && !iaPensando);
  if (statusDicaEl) {
    if (modoIAvsIA()) statusDicaEl.textContent = "Partida IA vs IA - assista o confronto.";
    else if (!corControladaPorHumano(estado.vez)) statusDicaEl.textContent = "Aguardando jogada da IA.";
    else if (dicaUsadaNoTurno) statusDicaEl.textContent = "Dica já usada neste turno.";
    else if (iaPensando) statusDicaEl.textContent = "IA pensando...";
    else statusDicaEl.textContent = "Uma dica por turno.";
  }
}

async function pedirDica() {
  if (dicaCarregando) return;
  dicaCarregando = true;
  const geracao = partidaAtual;
  if (saidaDicaEl) saidaDicaEl.textContent = "";
  atualizarBotaoDica();
  try {
    const dados = await chamarGemini(montarPromptDica(), ESQUEMA_DICA);
    if (geracao !== partidaAtual) return; // partida reiniciada durante a chamada
    dicaUsadaNoTurno = true;
    if (saidaDicaEl) saidaDicaEl.textContent = formatarDica(dados);
  } catch (erro) {
    if (geracao !== partidaAtual) return;
    if (saidaDicaEl) saidaDicaEl.textContent = String(erro.message || erro);
  } finally {
    if (geracao === partidaAtual) {
      dicaCarregando = false;
      atualizarBotaoDica();
    }
  }
}

async function pedirResumo() {
  if (dicaCarregando || resumoPedido) return;
  dicaCarregando = true;
  const geracao = partidaAtual;
  if (saidaDicaEl) saidaDicaEl.textContent = "";
  atualizarBotaoDica();
  try {
    const dados = await chamarGemini(montarPromptResumo(), ESQUEMA_RESUMO);
    if (geracao !== partidaAtual) return; // partida reiniciada durante a chamada
    resumoPedido = true;
    if (saidaDicaEl) saidaDicaEl.textContent = formatarResumo(dados);
  } catch (erro) {
    if (geracao !== partidaAtual) return;
    if (saidaDicaEl) saidaDicaEl.textContent = String(erro.message || erro);
  } finally {
    if (geracao === partidaAtual) {
      dicaCarregando = false;
      atualizarBotaoDica();
    }
  }
}

function aoClicarDica() {
  if (jogoAcabou) void pedirResumo();
  else void pedirDica();
}

// anima cada passo do movimento da IA
async function executarMovimentoAnimado(movimento, geracao) {
  for (const passo of movimento.passos) {
    await dormir(ATRASO_PASSO);
    if (geracao !== partidaAtual) return; // partida reiniciada durante a animação
    aplicarPasso(estado.tabuleiro, passo.deL, passo.deC, passo.paraL, passo.paraC);
    desenhar();
  }
  if (geracao !== partidaAtual) return;
  const notacao = notacaoDoMovimento(movimento);
  registrarLance(estado.vez, notacao);
  anunciar(`${nomeCor(estado.vez)}: ${notacao}`);
  iaPensando = false;
  terminarTurno();
}

function algoritmoDaVez() {
  if (modoIAvsIA()) {
    const minimaxVezAgora = (estado.vez === PRETO) === minimaxEhPreto;
    return minimaxVezAgora ? "minimax" : "montecarlo";
  }
  return modoAdversario;
}

// escolhe a jogada pelo algoritmo ativo no turno
function escolherJogadaIA() {
  const cor = estado.vez;
  const algoritmo = algoritmoDaVez();
  if (algoritmo === "minimax") return melhorJogadaMinimax(estado.tabuleiro, cor, PROFUNDIDADE_MINIMAX).jogada;
  if (algoritmo === "montecarlo") return melhorJogadaMCTS(estado.tabuleiro, estado.vez, cor, SIMULACOES_MCTS).jogada;
  return null;
}

function agendarTurnoIA() {
  if (!ehVezDaIA() || iaPensando) return;
  iaPensando = true;
  desenhar();
  void rodarTurnoIA();
}

async function rodarTurnoIA() {
  const geracao = partidaAtual;
  await dormir(ATRASO_PENSAR);
  if (geracao !== partidaAtual || !ehVezDaIA() || jogoAcabou) {
    iaPensando = false;
    desenhar();
    return;
  }
  const movimento = escolherJogadaIA();
  if (geracao !== partidaAtual) return; // reiniciou durante o cálculo
  if (movimento) {
    await executarMovimentoAnimado(movimento, geracao);
  } else {
    iaPensando = false;
    verificarFimDeJogo();
    desenhar();
  }
}

function anunciar(texto) {
  if (!texto) {
    historicoEl.innerHTML = "";
    return;
  }
  const linha = document.createElement("div");
  linha.textContent = texto;
  historicoEl.prepend(linha);
}

function pontuacaoMaterial(tabuleiro, cor) {
  return tabuleiro.flat().filter((p) => p && p.cor === cor).reduce((soma, p) => soma + (p.dama ? 3 : 1), 0);
}

// checa fim de jogo: sem peças, sem jogadas ou limite de lances atingido
function verificarFimDeJogo() {
  if (historico.length >= MAX_LANCES) {
    jogoAcabou = true;
    const preto = pontuacaoMaterial(estado.tabuleiro, PRETO);
    const branco = pontuacaoMaterial(estado.tabuleiro, BRANCO);
    vencedor = preto > branco ? PRETO : branco > preto ? BRANCO : null;
    const desfecho = vencedor ? `${nomeCor(vencedor)} vence por material` : "empate por material";
    anunciar(`Limite de ${MAX_LANCES} lances - ${desfecho}.`);
    atualizarBotaoDica();
    return true;
  }

  const adv = estado.vez;
  const temPecas = estado.tabuleiro.flat().some((p) => p && p.cor === adv);
  if (!temPecas || !temMovimentos(estado.tabuleiro, adv)) {
    jogoAcabou = true;
    vencedor = adversario(adv);
    anunciar(`${nomeCor(vencedor)} venceu - fim de jogo.`);
    atualizarBotaoDica();
    return true;
  }
  return false;
}

function terminarTurno() {
  dicaUsadaNoTurno = false;
  estado.vez = adversario(estado.vez);
  desenhar();
  if (verificarFimDeJogo()) return;
  agendarTurnoIA();
}

let fantasma = null;
let origem = null;

// começa o arraste ao clicar numa peça
function iniciarArraste(evento) {
  if (evento.button !== 0 || iaPensando || jogoAcabou) return;
  if (!corControladaPorHumano(estado.vez)) return;
  const l = +this.dataset.r, c = +this.dataset.c;
  const peca = estado.tabuleiro[l][c];
  if (!peca || peca.cor !== estado.vez) return;

  const obrigaCaptura = existeCaptura(estado.tabuleiro, estado.vez);
  const destinos = obrigaCaptura
    ? capturasDe(estado.tabuleiro, l, c)
    : [...movimentosSimples(estado.tabuleiro, l, c), ...capturasDe(estado.tabuleiro, l, c)];
  if (destinos.length === 0) return;

  cancelarArraste();

  origem = { l, c };
  fantasma = this.cloneNode(true);
  fantasma.classList.add("fantasma");
  const area = this.getBoundingClientRect();
  fantasma.style.width = area.width + "px";
  fantasma.style.height = area.height + "px";
  fantasma.style.position = "fixed";
  fantasma.style.inset = "auto";
  fantasma.style.margin = "0";
  fantasma.style.transform = "none";
  fantasma.style.left = evento.clientX - area.width / 2 + "px";
  fantasma.style.top = evento.clientY - area.height / 2 + "px";
  document.body.appendChild(fantasma);
  this.style.opacity = "0.2";
  tabuleiroEl.classList.add("arrastando");
  window.addEventListener("mousemove", aoMoverMouse);
  window.addEventListener("mouseup", aoSoltarMouse);
}

function moverFantasma(x, y) {
  if (!fantasma) return;
  fantasma.style.left = x - fantasma.offsetWidth / 2 + "px";
  fantasma.style.top = y - fantasma.offsetHeight / 2 + "px";
}

function aoMoverMouse(evento) {
  moverFantasma(evento.clientX, evento.clientY);
}

// ao soltar, valida e aplica a jogada
function aoSoltarMouse(evento) {
  window.removeEventListener("mousemove", aoMoverMouse);
  window.removeEventListener("mouseup", aoSoltarMouse);
  tabuleiroEl.classList.remove("arrastando");
  if (!origem) return limparArraste();

  const casa = casaNoPonto(evento.clientX, evento.clientY);
  if (!casa) return limparArraste();

  const paraL = +casa.dataset.r, paraC = +casa.dataset.c;
  const deL = origem.l, deC = origem.c;
  const dl = paraL - deL, dc = paraC - deC;
  const absL = Math.abs(dl), absC = Math.abs(dc);
  if (absL === 0 || absL !== absC) return limparArraste();

  const obrigaCaptura = existeCaptura(estado.tabuleiro, estado.vez);
  const ehCapturaLegal = capturasDe(estado.tabuleiro, deL, deC).some(([r, c]) => r === paraL && c === paraC);
  if (obrigaCaptura && !ehCapturaLegal) return limparArraste();

  if (ehCapturaLegal) {
    aplicarPasso(estado.tabuleiro, deL, deC, paraL, paraC);
    registrarLance(estado.vez, notacaoDoPasso(deL, deC, paraL, paraC, true));
    desenhar();
    if (capturasDe(estado.tabuleiro, paraL, paraC).length) return limparArraste();
    terminarTurno();
    return limparArraste();
  }

  const ehMovimentoLegal = movimentosSimples(estado.tabuleiro, deL, deC).some(([r, c]) => r === paraL && c === paraC);
  if (!obrigaCaptura && ehMovimentoLegal) {
    aplicarPasso(estado.tabuleiro, deL, deC, paraL, paraC);
    registrarLance(estado.vez, notacaoDoPasso(deL, deC, paraL, paraC, false));
    terminarTurno();
  }
  limparArraste();
}

// limpa o clone flutuante da tela
function limparArraste() {
  document.querySelectorAll(".peca:not(.fantasma)").forEach((p) => (p.style.opacity = "1"));
  document.querySelectorAll(".fantasma").forEach((g) => g.remove());
  fantasma = null;
  origem = null;
}

function cancelarArraste() {
  window.removeEventListener("mousemove", aoMoverMouse);
  window.removeEventListener("mouseup", aoSoltarMouse);
  tabuleiroEl.classList.remove("arrastando");
  limparArraste();
}

// encerra o arraste se o usuário sair da aba
window.addEventListener("blur", cancelarArraste);

botaoReiniciar.addEventListener("click", () => {
  novoJogo();
  historicoEl.innerHTML = "";
});
if (botaoDica) botaoDica.addEventListener("click", aoClicarDica);

modoAdversarioEl.addEventListener("change", () => {
  modoAdversario = modoAdversarioEl.value;
  novoJogo();
  historicoEl.innerHTML = "";
});

novoJogo();
