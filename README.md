# 💣 Bomber Arena — Multiplayer em Node.js

Jogo de arena inspirado na mecânica clássica de bombas, para **2 a 4 jogadores**, cada um no próprio navegador. Interface em português, com teclado e controles touch.

## Requisitos

- Node.js 18 ou superior
- NPM

## Como rodar

```bash
npm install
npm start
```

Abra **http://localhost:3000**. Escolha um apelido e clique em **CRIAR SALA**.

Para jogar com amigos na mesma rede Wi-Fi: descubra o IP local do computador que está rodando o servidor e compartilhe `http://SEU-IP:3000`. Todos acessam pelo próprio dispositivo. Copie o link de convite ou informe o código de 6 caracteres.

Para jogar pela internet, hospede o projeto em uma plataforma Node.js que suporte WebSockets (por exemplo, Render, Railway ou VPS) e compartilhe a URL pública. O projeto utiliza a variável de ambiente `PORT` quando disponível.

## Controles

- **WASD** ou **setas**: movimentar
- **Espaço**: posicionar bomba
- **Celular**: direcional na tela e botão de bomba

## Regras

- Até 4 jogadores por sala, mínimo de 2 para iniciar.
- Criador da sala inicia cada rodada e pode reiniciar ao final.
- Explosões em cruz destroem caixas; paredes sólidas bloqueiam o fogo.
- Bombas detonam após cerca de 2,1 segundos e podem ativar bombas próximas.
- Melhorias: 🔥 aumenta alcance; + aumenta quantidade simultânea de bombas.
- Último sobrevivente vence. Se todos morrerem, há empate.
- Se o criador sair, a liderança passa ao próximo jogador.

## Estrutura

```
server.js          servidor Express + Socket.IO; estado e regras autoritativos
public/index.html  interface
public/style.css   visual responsivo
public/game.js     canvas e controles de entrada
```

## Melhorias de latência (v1.1)

- O servidor aplica o primeiro movimento **ao receber a tecla**, sem esperar o próximo ciclo de simulação.
- Ciclo interno de 25 ms; movimento contínuo a cada 95 ms enquanto a tecla estiver pressionada.
- Estados só são retransmitidos quando algo muda, diminuindo tráfego em salas paradas.
- Renderização no navegador usa `requestAnimationFrame`.
- WebSocket é preferido e polling fica como fallback quando necessário.
- **Limite de 4 jogadores por sala validado no servidor**. Novas entradas em salas completas são recusadas.

Observação: a latência de rede depende da distância dos jogadores ao servidor e do plano de hospedagem; para partidas no Brasil, prefira um servidor próximo dos jogadores. Reinícios ou suspensão de instâncias gratuitas podem causar atrasos adicionais.

## Notas de produção

Este é um protótipo jogável: salas são mantidas em memória e se perdem quando o servidor reinicia. Não há login, chat nem reconexão de sessão; cada jogador precisa abrir a página novamente ao perder a conexão. Para alto volume, adicione persistência, autenticação, rate limiting e orquestração de salas entre instâncias. Recomendado hospedar atrás de HTTPS.

## v1.2 — inspirado na dinâmica de Super Bomberman 3

- Arena mais colorida em estilo retrô (arte original, sem sprites licenciados).
- Power-ups adicionais: velocidade (⚡) e chute de bombas (👟).
- Morte súbita: após 150 segundos as bordas da arena começam a fechar.
- Máximo de 4 jogadores por sala, imposto pelo servidor.
- Código de convite corrigido no botão de copiar.

Para atualizar o serviço no Render: substitua os arquivos no repositório conectado, faça commit e push; ou inicie um deploy manual na dashboard, conforme a configuração do serviço. A publicação requer acesso à sua conta Render.

## v1.3 – Batalha 16-bit original
- Personagens pixelados e novos ladrilhos originais inspirados nos jogos de arena 16-bit.
- Novos poderes: luva (Q), bomba remota (E), bomba perfurante e escudo.
- Mantidos chute, velocidade, fogo e capacidade, limite de 4 jogadores.
- Arte criada para este projeto; não contém sprites oficiais.
