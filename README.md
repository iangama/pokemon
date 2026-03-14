# Pokédex Atlas

Aplicação web estática refatorada para explorar os principais recursos da PokéAPI com foco em navegação, descoberta e consulta detalhada de Pokémon.

## Funcionalidades

- Busca por nome ou número da Pokédex
- Pokédex paginada
- Filtro por tipo
- Visualização detalhada com:
  - artwork oficial
  - tipos
  - texto descritivo da espécie
  - perfil físico e geração
  - habilidades com efeito resumido
  - estatísticas base
  - golpes em destaque
  - cadeia evolutiva
- Favoritos persistidos em `localStorage`
- Cache local de respostas da PokéAPI para reduzir requisições repetidas

## Estrutura

- `index.html`: layout principal da aplicação
- `app.js`: estado, integração com a PokéAPI, renderização e cache local
- `styles.css`: identidade visual e responsividade
- `server.js`: servidor HTTP simples para servir os arquivos estáticos

## Executar

```bash
cd /mnt/c/Users/Ian/pokemon-api-app
npm start
```

Abra `http://localhost:4173`.
