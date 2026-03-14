const API_ROOT = "https://pokeapi.co/api/v2";
const PAGE_SIZE = 18;
const CACHE_PREFIX = "pokeatlas-cache:";
const FAVORITES_KEY = "pokeatlas-favorites";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24;

const state = {
  activeFilter: "all",
  allCount: 0,
  currentList: [],
  currentOffset: 0,
  currentPokemon: null,
  favorites: new Set(loadFavorites()),
  typeMap: new Map(),
};

const form = document.getElementById("search-form");
const queryInput = document.getElementById("pokemon-query");
const statusNode = document.getElementById("status");
const typeFilter = document.getElementById("type-filter");
const randomButton = document.getElementById("random-button");
const pokemonList = document.getElementById("pokemon-list");
const favoritesList = document.getElementById("favorites-list");
const detailShell = document.getElementById("detail-shell");
const prevPageButton = document.getElementById("prev-page");
const nextPageButton = document.getElementById("next-page");
const pokedexPageLabel = document.getElementById("pokedex-page-label");
const catalogCountNode = document.getElementById("catalog-count");
const activeFilterNode = document.getElementById("active-filter");
const favoritesCountNode = document.getElementById("favorites-count");
const quickPickButtons = document.querySelectorAll("[data-pokemon]");
const detailTemplate = document.getElementById("detail-template");

function setStatus(message) {
  statusNode.textContent = message;
}

function formatLabel(value) {
  return String(value).replace(/-/g, " ");
}

function titleCase(value) {
  return formatLabel(value).replace(/\b\w/g, (char) => char.toUpperCase());
}

function parseIdFromResource(url) {
  const match = String(url).match(/\/(\d+)\/?$/);
  return match ? Number(match[1]) : null;
}

function loadFavorites() {
  try {
    const rawValue = localStorage.getItem(FAVORITES_KEY);
    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistFavorites() {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(state.favorites)));
}

function readCache(key) {
  try {
    const rawValue = localStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!rawValue) {
      return null;
    }

    const entry = JSON.parse(rawValue);
    if (!entry.expiresAt || entry.expiresAt < Date.now()) {
      localStorage.removeItem(`${CACHE_PREFIX}${key}`);
      return null;
    }

    return entry.value;
  } catch {
    return null;
  }
}

function writeCache(key, value) {
  try {
    localStorage.setItem(
      `${CACHE_PREFIX}${key}`,
      JSON.stringify({
        value,
        expiresAt: Date.now() + CACHE_TTL_MS,
      })
    );
  } catch {
    // Ignore storage quota issues and continue with network data.
  }
}

async function fetchJson(pathOrUrl) {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${API_ROOT}${pathOrUrl}`;
  const cached = readCache(url);

  if (cached) {
    return cached;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  const data = await response.json();
  writeCache(url, data);
  return data;
}

async function getPokemon(identifier) {
  return fetchJson(`/pokemon/${String(identifier).trim().toLowerCase()}/`);
}

async function getSpecies(url) {
  return fetchJson(url);
}

async function getAbility(url) {
  return fetchJson(url);
}

async function getEvolutionChain(url) {
  return fetchJson(url);
}

async function getPokemonPage(offset) {
  return fetchJson(`/pokemon?limit=${PAGE_SIZE}&offset=${offset}`);
}

async function getTypes() {
  return fetchJson("/type?limit=999");
}

async function getTypePokemon(typeName) {
  return fetchJson(`/type/${typeName}/`);
}

function getEnglishFlavorText(species) {
  const entry = species.flavor_text_entries.find(({ language }) => language.name === "en");
  return entry ? entry.flavor_text.replace(/\f|\n/g, " ") : "No flavor text available.";
}

function getEnglishGenera(species) {
  const entry = species.genera.find(({ language }) => language.name === "en");
  return entry ? entry.genus : "Unknown species";
}

function buildEvolutionSteps(node, depth = 0, output = []) {
  output.push({
    name: node.species.name,
    depth,
  });

  node.evolves_to.forEach((nextNode) => {
    buildEvolutionSteps(nextNode, depth + 1, output);
  });

  return output;
}

function getFeaturedMoves(pokemon) {
  return pokemon.moves
    .slice(0, 8)
    .map(({ move }) => titleCase(move.name));
}

function updateSummary() {
  catalogCountNode.textContent = new Intl.NumberFormat("pt-BR").format(state.allCount);
  activeFilterNode.textContent =
    state.activeFilter === "all" ? "Todos" : titleCase(state.activeFilter);
  favoritesCountNode.textContent = String(state.favorites.size);
}

function renderTypePills(container, types) {
  container.innerHTML = "";

  types.forEach((typeEntry) => {
    const pill = document.createElement("span");
    pill.className = "type-pill";
    pill.textContent = titleCase(typeEntry.type ? typeEntry.type.name : typeEntry);
    container.appendChild(pill);
  });
}

function renderList() {
  pokemonList.innerHTML = "";

  if (!state.currentList.length) {
    pokemonList.innerHTML = '<p class="empty-state">Nenhum Pokémon encontrado para esse filtro.</p>';
    pokedexPageLabel.textContent = "Sem resultados";
    prevPageButton.disabled = true;
    nextPageButton.disabled = true;
    return;
  }

  const page = Math.floor(state.currentOffset / PAGE_SIZE) + 1;
  const pageCount = Math.max(1, Math.ceil(state.currentList.length / PAGE_SIZE));
  pokedexPageLabel.textContent = `Página ${page} de ${pageCount}`;

  const items = state.currentList.slice(state.currentOffset, state.currentOffset + PAGE_SIZE);

  items.forEach((entry) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "list-item";
    button.dataset.pokemon = entry.name;
    button.innerHTML = `
      <span class="list-item-id">#${String(entry.id).padStart(4, "0")}</span>
      <strong>${titleCase(entry.name)}</strong>
    `;
    pokemonList.appendChild(button);
  });

  prevPageButton.disabled = state.currentOffset === 0;
  nextPageButton.disabled = state.currentOffset + PAGE_SIZE >= state.currentList.length;
}

function renderFavorites() {
  favoritesList.innerHTML = "";

  if (!state.favorites.size) {
    favoritesList.innerHTML = '<p class="empty-state">Adicione Pokémon aos favoritos para montar sua coleção.</p>';
    updateSummary();
    return;
  }

  Array.from(state.favorites)
    .sort((left, right) => left.localeCompare(right))
    .forEach((name) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "favorite-chip";
      button.dataset.pokemon = name;
      button.textContent = titleCase(name);
      favoritesList.appendChild(button);
    });

  updateSummary();
}

function renderProfile(profileNode, pokemon, species) {
  const items = [
    ["Altura", `${pokemon.height / 10} m`],
    ["Peso", `${pokemon.weight / 10} kg`],
    ["Experiência base", String(pokemon.base_experience ?? "N/A")],
    ["Espécie", getEnglishGenera(species)],
    ["Habitat", species.habitat ? titleCase(species.habitat.name) : "Unknown"],
    ["Geração", species.generation ? titleCase(species.generation.name) : "Unknown"],
  ];

  profileNode.innerHTML = items
    .map(
      ([label, value]) => `
        <div class="profile-row">
          <dt>${label}</dt>
          <dd>${value}</dd>
        </div>
      `
    )
    .join("");
}

function renderAbilities(abilitiesNode, abilities, abilityDetails) {
  abilitiesNode.innerHTML = "";

  abilities.forEach((entry) => {
    const detail = abilityDetails.find((candidate) => candidate.name === entry.ability.name);
    const effectEntry = detail?.effect_entries?.find(({ language }) => language.name === "en");
    const card = document.createElement("article");
    card.className = "ability-card";
    card.innerHTML = `
      <h4>${titleCase(entry.ability.name)}</h4>
      <p>${effectEntry ? effectEntry.short_effect : "No effect description available."}</p>
      <span>${entry.is_hidden ? "Hidden ability" : "Standard ability"}</span>
    `;
    abilitiesNode.appendChild(card);
  });
}

function renderStats(statsNode, stats) {
  statsNode.innerHTML = "";

  stats.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "stat-row";

    const normalizedValue = Math.min(entry.base_stat, 180);

    row.innerHTML = `
      <span class="stat-name">${titleCase(entry.stat.name)}</span>
      <strong class="stat-value">${entry.base_stat}</strong>
      <div class="stat-bar"><span style="width: ${(normalizedValue / 180) * 100}%"></span></div>
    `;

    statsNode.appendChild(row);
  });
}

function renderMoves(movesNode, pokemon) {
  const featuredMoves = getFeaturedMoves(pokemon);
  movesNode.innerHTML = "";

  if (!featuredMoves.length) {
    movesNode.innerHTML = '<p class="empty-state">Nenhum golpe disponível.</p>';
    return;
  }

  featuredMoves.forEach((move) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = move;
    movesNode.appendChild(chip);
  });
}

function renderEvolution(evolutionNode, evolutionChain, currentPokemonName) {
  const steps = buildEvolutionSteps(evolutionChain.chain);
  evolutionNode.innerHTML = "";

  steps.forEach((step) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "evolution-step";
    button.dataset.pokemon = step.name;
    if (step.name === currentPokemonName) {
      button.classList.add("active");
    }
    button.style.setProperty("--depth", String(step.depth));
    button.innerHTML = `
      <span class="evolution-stage">Stage ${step.depth + 1}</span>
      <strong>${titleCase(step.name)}</strong>
    `;
    evolutionNode.appendChild(button);
  });
}

function renderDetail({ pokemon, species, evolutionChain, abilityDetails }) {
  detailShell.innerHTML = "";
  detailShell.appendChild(detailTemplate.content.cloneNode(true));

  const nameNode = document.getElementById("pokemon-name");
  const idNode = document.getElementById("pokemon-id");
  const imageNode = document.getElementById("pokemon-image");
  const taglineNode = document.getElementById("pokemon-tagline");
  const typesNode = document.getElementById("pokemon-types");
  const profileNode = document.getElementById("pokemon-profile");
  const abilitiesNode = document.getElementById("pokemon-abilities");
  const statsNode = document.getElementById("pokemon-stats");
  const movesNode = document.getElementById("pokemon-moves");
  const evolutionNode = document.getElementById("pokemon-evolution");
  const favoriteToggle = document.getElementById("favorite-toggle");

  const artwork =
    pokemon.sprites.other["official-artwork"].front_default ||
    pokemon.sprites.front_default ||
    "";

  idNode.textContent = `#${String(pokemon.id).padStart(4, "0")}`;
  nameNode.textContent = titleCase(pokemon.name);
  taglineNode.textContent = getEnglishFlavorText(species);
  imageNode.src = artwork;
  imageNode.alt = pokemon.name;
  favoriteToggle.textContent = state.favorites.has(pokemon.name)
    ? "Remover dos favoritos"
    : "Salvar nos favoritos";

  renderTypePills(typesNode, pokemon.types);
  renderProfile(profileNode, pokemon, species);
  renderAbilities(abilitiesNode, pokemon.abilities, abilityDetails);
  renderStats(statsNode, pokemon.stats);
  renderMoves(movesNode, pokemon);
  renderEvolution(evolutionNode, evolutionChain, pokemon.name);

  favoriteToggle.addEventListener("click", () => {
    toggleFavorite(pokemon.name);
    favoriteToggle.textContent = state.favorites.has(pokemon.name)
      ? "Remover dos favoritos"
      : "Salvar nos favoritos";
  });
}

function normalizeListEntries(results) {
  return results.map((entry) => ({
    name: entry.pokemon ? entry.pokemon.name : entry.name,
    id: parseIdFromResource(entry.pokemon ? entry.pokemon.url : entry.url) ?? 0,
  }));
}

async function loadTypes() {
  const data = await getTypes();

  data.results.forEach((entry) => {
    state.typeMap.set(entry.name, entry.url);
    const option = document.createElement("option");
    option.value = entry.name;
    option.textContent = titleCase(entry.name);
    typeFilter.appendChild(option);
  });
}

async function loadList() {
  setStatus("Carregando lista da Pokédex...");

  try {
    if (state.activeFilter === "all") {
      const pageData = await getPokemonPage(state.currentOffset);
      state.allCount = pageData.count;

      const pageItems = normalizeListEntries(pageData.results);
      const syntheticList = new Array(pageData.count).fill(null).map((_, index) => ({
        name: "",
        id: index + 1,
      }));

      pageItems.forEach((item, index) => {
        syntheticList[state.currentOffset + index] = item;
      });

      state.currentList = syntheticList.map((item) =>
        item.name
          ? item
          : {
              name: `pokemon-${item.id}`,
              id: item.id,
            }
      );
    } else {
      const typeData = await getTypePokemon(state.activeFilter);
      state.currentList = normalizeListEntries(typeData.pokemon).sort((left, right) => left.id - right.id);
      state.currentOffset = 0;
    }

    renderList();
    updateSummary();
    setStatus("Pokédex atualizada.");
  } catch (error) {
    pokemonList.innerHTML = '<p class="empty-state">Não foi possível carregar a lista agora.</p>';
    setStatus("Falha ao carregar a Pokédex.");
  }
}

async function loadAllPokemonListMetadata() {
  const pageData = await getPokemonPage(0);
  state.allCount = pageData.count;
}

async function loadPokemonDetail(identifier) {
  setStatus(`Carregando ${identifier}...`);

  try {
    const pokemon = await getPokemon(identifier);
    const [species, abilityDetails] = await Promise.all([
      getSpecies(pokemon.species.url),
      Promise.all(pokemon.abilities.map((entry) => getAbility(entry.ability.url))),
    ]);
    const evolutionChain = await getEvolutionChain(species.evolution_chain.url);

    state.currentPokemon = pokemon.name;
    renderDetail({ pokemon, species, evolutionChain, abilityDetails });
    setStatus(`Exibindo dados de ${titleCase(pokemon.name)}.`);
  } catch (error) {
    detailShell.innerHTML = '<div class="detail-placeholder">Não foi possível carregar esse Pokémon.</div>';
    setStatus("Pokémon não encontrado ou indisponível.");
  }
}

function toggleFavorite(name) {
  if (state.favorites.has(name)) {
    state.favorites.delete(name);
  } else {
    state.favorites.add(name);
  }

  persistFavorites();
  renderFavorites();
}

function handleListClick(event) {
  const button = event.target.closest("[data-pokemon]");
  if (!button) {
    return;
  }

  const value = button.dataset.pokemon;
  if (!value) {
    return;
  }

  queryInput.value = value;
  loadPokemonDetail(value);
}

function handlePagination(direction) {
  const nextOffset = state.currentOffset + direction * PAGE_SIZE;

  if (nextOffset < 0 || nextOffset >= state.currentList.length) {
    return;
  }

  state.currentOffset = nextOffset;

  if (state.activeFilter === "all") {
    loadList();
    return;
  }

  renderList();
}

function bindEvents() {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = queryInput.value.trim();
    if (!query) {
      setStatus("Digite um nome ou número de Pokémon.");
      return;
    }

    loadPokemonDetail(query);
  });

  typeFilter.addEventListener("change", () => {
    state.activeFilter = typeFilter.value;
    state.currentOffset = 0;
    loadList();
  });

  randomButton.addEventListener("click", () => {
    const randomId = Math.floor(Math.random() * Math.max(state.allCount, 1025)) + 1;
    queryInput.value = String(randomId);
    loadPokemonDetail(randomId);
  });

  quickPickButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const pokemon = button.dataset.pokemon;
      queryInput.value = pokemon;
      loadPokemonDetail(pokemon);
    });
  });

  pokemonList.addEventListener("click", handleListClick);
  favoritesList.addEventListener("click", handleListClick);
  detailShell.addEventListener("click", handleListClick);

  prevPageButton.addEventListener("click", () => handlePagination(-1));
  nextPageButton.addEventListener("click", () => handlePagination(1));
}

async function initializeApp() {
  bindEvents();
  renderFavorites();
  updateSummary();

  try {
    await Promise.all([loadTypes(), loadAllPokemonListMetadata()]);
    await loadList();
    await loadPokemonDetail("pikachu");
  } catch (error) {
    setStatus("A aplicação encontrou um erro ao iniciar.");
  }
}

initializeApp();
