# Damas Inteligente

Jogo de damas brasileiro rodando no navegador, sem servidor e sem bibliotecas externas. Dois agentes de IA se enfrentam: Minimax com Poda Alfa-Beta e Monte Carlo Tree Search. Um LLM comenta as jogadas.

## O que tem aqui

- Jogue contra Minimax ou Monte Carlo
- Veja os dois agentes se enfrentarem automaticamente
- Comentarista com LLM que narra o jogo em português
- Tabuleiro 8×8, tudo no navegador

## Algoritmos

### Minimax com Poda Alfa-Beta

Busca em profundidade 8 na árvore de jogadas. A poda alfa-beta descarta ramos que não mudam a decisão final (sem ela, a profundidade 8 seria inviável). A avaliação de cada posição leva em conta diferença de peças, diferença de damas (com peso maior) e posicionamento no tabuleiro.

### Monte Carlo Tree Search

Roda 1.500 simulações aleatórias por jogada e usa os resultados para guiar a busca. A fórmula UCT (C = √2) decide quando explorar linhas novas e quando insistir nas que já funcionaram. Cada simulação tem limite de 200 lances para evitar ciclos.

## Resultados

Fizemos 200 partidas IA vs IA alternando as cores, metade com Minimax de Pretas e metade com Minimax de Brancas:

| Medida                | Minimax     | Monte Carlo |
| --------------------- | ----------- | ----------- |
| Partidas vencidas     | 139 (69,5%) | 57 (28,5%)  |
| Empates               | 4           |             |
| Tempo médio por lance | 104,8 ms    | 104,6 ms    |
| Variação de tempo     | 23–747 ms   | 59–141 ms   |

O Minimax ganhou pela leitura mais profunda do tabuleiro. Os tempos médios ficaram iguais, mas o Monte Carlo foi muito mais regular. Nunca passou de 141 ms, enquanto o Minimax chegou a 747 ms nas posições mais complicadas.

## Como usar

Abra `index.html` no navegador, escolha o modo e o agente, clique nas peças para mover. Sem instalação necessária.

## Regras das damas brasileiras

Tabuleiro 8x8, 12 peças por lado:

- Movimento diagonal
- Captura obrigatória pelo maior número de peças possível
- Promoção a dama ao alcançar a última fileira
- Damas movem livremente nas diagonais em qualquer distância

## Tecnologias

JavaScript puro, HTML5 e CSS3. O comentarista usa a API do Gemini Pro (opcional; o jogo funciona sem ele).

## Arquivos

```
index.html   interface do jogo
script.js    agentes, regras, UI
style.css    visual do tabuleiro
```

## Autores

Pedro Lucas Santos Ferreira e Hícaro Vitor Teixeira de Abreu, da Universidade Federal de Viçosa.

Trabalho para INF 420 - Inteligência Artificial I (2025). Artigo completo em LaTeX no repositório.
