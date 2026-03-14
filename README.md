Pokémon Card Battle (Browser Game)

Este projeto é um jogo de cartas jogável diretamente no navegador que utiliza dados reais da PokéAPI para gerar cartas de Pokémon dinamicamente. A aplicação consome a API pública de Pokémon, transforma os dados retornados em cartas jogáveis e cria uma pequena experiência de batalha entre cartas baseada nos atributos dos Pokémon.

O objetivo do projeto é demonstrar consumo de API externa, manipulação de dados no front-end, renderização dinâmica de interface e organização de estado em JavaScript. Todos os dados das cartas são obtidos diretamente da PokéAPI, incluindo nome do Pokémon, imagem, tipos e atributos principais. A partir dessas informações o sistema cria automaticamente cartas utilizáveis dentro do jogo.

Quando a aplicação inicia, ela consulta a API, monta um conjunto de Pokémon e gera cartas com seus atributos. Cada carta exibe o nome do Pokémon, sprite oficial, tipos e estatísticas relevantes. Essas informações são usadas para criar mecânicas simples de batalha entre cartas, permitindo que o jogador interaja com os Pokémon de forma visual e dinâmica.

A interface foi construída com HTML e CSS, priorizando uma visualização clara das cartas e organização do layout. O JavaScript é responsável por consumir a API, transformar os dados recebidos em objetos utilizáveis dentro do jogo e renderizar as cartas dinamicamente na tela. Também existe um pequeno sistema de cache local para evitar requisições desnecessárias e melhorar a experiência de uso.

O projeto roda inteiramente no navegador e utiliza um servidor HTTP simples apenas para servir os arquivos estáticos durante o desenvolvimento. Isso permite testar o consumo da API corretamente sem problemas de CORS e facilita a execução local.

Este projeto demonstra habilidades importantes de desenvolvimento web, como:

consumo de APIs REST

manipulação de dados em JavaScript

renderização dinâmica de interface

organização de estado no front-end

construção de interfaces responsivas

integração com dados externos em tempo real

Ele pode servir como base para evoluções futuras, como mecânicas mais complexas de batalha, sistema de deck building, IA adversária ou animações mais elaboradas para as cartas.

Estrutura

index.html : layout principal da aplicação

app.js : estado, integração com a PokéAPI, renderização e cache local

styles.css : identidade visual e responsividade

server.js : servidor HTTP simples para servir os arquivos estáticos

Executar
cd /mnt/c/Users/Ian/pokemon-api-app
npm start

Abra: http://localhost:4173

Link da página do projeto: https://iangama.github.io/pokemon/
