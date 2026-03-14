const API_BASE = "https://pokeapi.co/api/v2";
const CACHE_KEY = "poke-tactics-cache-v1";
const CACHE_TTL = 1000 * 60 * 60 * 8;
const LAST_RESULT_KEY = "poke-tactics-last-result";
const MATCH_HISTORY_KEY = "poke-tactics-match-history";
const MATCH_HISTORY_LIMIT = 12;
const EVOLUTION_LEVEL_STEP = 3;
const SHOP_PRICES = {
  potion: 20,
  superPotion: 35,
  reviver: 50,
  battleTonic: 30,
};
const BATTLE_TONIC_MULTIPLIER = 1.35;
const SHOP_REROLL_BASE_COST = 12;
const SHOP_OFFERS = [
  {
    key: "potion",
    label: "Poção",
    kind: "item",
    price: 20,
    description: "Recupera 30 HP da carta no campo.",
  },
  {
    key: "superPotion",
    label: "Super Poção",
    kind: "item",
    price: 35,
    description: "Recupera 60 HP da carta no campo.",
  },
  {
    key: "reviver",
    label: "Reviver",
    kind: "item",
    price: 50,
    description: "Revive uma carta derrotada com escolha manual.",
  },
  {
    key: "battleTonic",
    label: "Tônico",
    kind: "item",
    price: 30,
    description: "Buff de ataque para o próximo golpe.",
  },
  {
    key: "fieldMedic",
    label: "Equipe Médica",
    kind: "service",
    price: 44,
    description: "Cura 35% da vida de todas as cartas vivas.",
  },
  {
    key: "battleDrill",
    label: "Treino Tático",
    kind: "service",
    price: 58,
    description: "Concede XP para sua carta de progresso.",
  },
];
const BIOME_SHOP_BONUS = {
  plains: "potion",
  forest: "fieldMedic",
  lake: "superPotion",
  cave: "reviver",
  mountain: "battleDrill",
  volcanic: "battleTonic",
};

const evolutionNextCache = new Map();
const typePokemonCache = new Map();

const BIOMES = [
  {
    id: "plains",
    label: "Pradaria",
    encounterRate: 0.46,
    xpFactor: 1,
    wildTypes: ["normal", "flying", "ground"],
  },
  {
    id: "forest",
    label: "Floresta",
    encounterRate: 0.58,
    xpFactor: 1.06,
    wildTypes: ["grass", "bug", "poison"],
  },
  {
    id: "lake",
    label: "Lago",
    encounterRate: 0.62,
    xpFactor: 1.1,
    wildTypes: ["water", "ice", "electric"],
  },
  {
    id: "cave",
    label: "Caverna",
    encounterRate: 0.66,
    xpFactor: 1.15,
    wildTypes: ["rock", "ground", "dark", "poison"],
  },
  {
    id: "mountain",
    label: "Montanha",
    encounterRate: 0.6,
    xpFactor: 1.2,
    wildTypes: ["rock", "ground", "dragon", "flying"],
  },
  {
    id: "volcanic",
    label: "Vulcânico",
    encounterRate: 0.68,
    xpFactor: 1.28,
    wildTypes: ["fire", "rock", "dragon"],
  },
];

const DIFFICULTY_CONFIG = {
  easy: { deckSize: 6, handSize: 4, aiWeight: 0.75 },
  normal: { deckSize: 6, handSize: 4, aiWeight: 1 },
  hard: { deckSize: 7, handSize: 4, aiWeight: 1.3 },
};

const DECK_ARCHETYPE_TYPES = {
  balanced: [],
  fire: ["fire", "rock"],
  water: ["water", "ice"],
  grass: ["grass", "bug"],
  electric: ["electric", "flying"],
};

const typeClassWhitelist = new Set([
  "fire",
  "water",
  "grass",
  "electric",
  "ice",
  "ground",
  "rock",
  "psychic",
  "dragon",
  "dark",
  "fairy",
]);

const state = {
  status: "idle",
  difficulty: "normal",
  deckArchetype: "balanced",
  typeChart: new Map(),
  turn: "player",
  resolving: false,
  selectedHandIndex: null,
  winner: null,
  logs: [],
  turnCount: 0,
  matchStartAt: null,
  damageByAttacker: {},
  encounter: {
    active: false,
    biomeId: null,
    wins: 0,
  },
  items: {
    potion: 2,
    superPotion: 1,
    reviver: 1,
    battleTonic: 1,
  },
  coins: 45,
  shop: {
    offers: [],
    rerollCost: SHOP_REROLL_BASE_COST,
    focused: false,
  },
  evolutionQueue: [],
  pendingEvolution: null,
  starterPool: [],
  starterSelectedIds: new Set(),
  starterLoading: false,
  starterSearch: "",
  starterTypeFilter: "all",
  minimap: {
    rows: 7,
    cols: 9,
    pos: { row: 3, col: 4 },
    discovered: new Set(["3:4"]),
    cells: [],
    steps: 0,
    currentBiome: "plains",
  },
  player: {
    deck: [],
    hand: [],
    field: null,
    graveyard: [],
  },
  enemy: {
    deck: [],
    hand: [],
    field: null,
    graveyard: [],
  },
};

const refs = {
  startScreen: document.getElementById("start-screen"),
  gameScreen: document.getElementById("game-screen"),
  loadingOverlay: document.getElementById("loading-overlay"),
  loadingText: document.getElementById("loading-text"),
  difficulty: document.getElementById("difficulty"),
  deckArchetype: document.getElementById("deck-archetype"),
  refreshDeckOptions: document.getElementById("refresh-deck-options"),
  autoFillDeck: document.getElementById("auto-fill-deck"),
  clearDeckSelection: document.getElementById("clear-deck-selection"),
  starterSearch: document.getElementById("starter-search"),
  starterTypeFilter: document.getElementById("starter-type-filter"),
  deckSelectInfo: document.getElementById("deck-select-info"),
  deckValidation: document.getElementById("deck-validation"),
  starterCardPool: document.getElementById("starter-card-pool"),
  startButton: document.getElementById("start-button"),
  howButton: document.getElementById("how-button"),
  closeTutorial: document.getElementById("close-tutorial"),
  tutorialModal: document.getElementById("tutorial-modal"),
  lastResult: document.getElementById("last-result"),
  historySummary: document.getElementById("history-summary"),
  historyList: document.getElementById("history-list"),
  clearHistory: document.getElementById("clear-history"),
  turnIndicator: document.getElementById("turn-indicator"),
  deckInfo: document.getElementById("deck-info"),
  handInfo: document.getElementById("hand-info"),
  coinInfo: document.getElementById("coin-info"),
  openShop: document.getElementById("open-shop"),
  shopPanel: document.getElementById("shop-panel"),
  shopStatus: document.getElementById("shop-status"),
  shopCoinsInline: document.getElementById("shop-coins-inline"),
  rerollShop: document.getElementById("reroll-shop"),
  shopStock: document.getElementById("shop-stock"),
  shopNote: document.getElementById("shop-note"),
  playerRemaining: document.getElementById("player-remaining"),
  enemyRemaining: document.getElementById("enemy-remaining"),
  playerField: document.getElementById("player-field"),
  enemyField: document.getElementById("enemy-field"),
  playerHand: document.getElementById("player-hand"),
  enemyHand: document.getElementById("enemy-hand"),
  typeFeedback: document.getElementById("type-feedback"),
  battleSpark: document.getElementById("battle-spark"),
  minimapGrid: document.getElementById("minimap-grid"),
  biomeLegend: document.getElementById("biome-legend"),
  mapStatus: document.getElementById("map-status"),
  mapEvent: document.getElementById("map-event"),
  moveUp: document.getElementById("move-up"),
  moveDown: document.getElementById("move-down"),
  moveLeft: document.getElementById("move-left"),
  moveRight: document.getElementById("move-right"),
  attackButton: document.getElementById("attack-button"),
  usePotion: document.getElementById("use-potion"),
  useSuperPotion: document.getElementById("use-super-potion"),
  useReviver: document.getElementById("use-reviver"),
  useBattleTonic: document.getElementById("use-battle-tonic"),
  progressionInfo: document.getElementById("progression-info"),
  restartButton: document.getElementById("restart-button"),
  eventLog: document.getElementById("event-log"),
  resultModal: document.getElementById("result-modal"),
  resultTitle: document.getElementById("result-title"),
  resultSubtitle: document.getElementById("result-subtitle"),
  playAgainButton: document.getElementById("play-again-button"),
  evolutionModal: document.getElementById("evolution-modal"),
  evolutionText: document.getElementById("evolution-text"),
  evolveNowButton: document.getElementById("evolve-now-button"),
  evolveLaterButton: document.getElementById("evolve-later-button"),
  reviverModal: document.getElementById("reviver-modal"),
  reviverList: document.getElementById("reviver-list"),
  closeReviverModal: document.getElementById("close-reviver-modal"),
  shopModal: document.getElementById("shop-modal"),
  shopCoins: document.getElementById("shop-coins"),
  buyPotion: document.getElementById("buy-potion"),
  buySuperPotion: document.getElementById("buy-super-potion"),
  buyReviver: document.getElementById("buy-reviver"),
  buyBattleTonic: document.getElementById("buy-battle-tonic"),
  closeShop: document.getElementById("close-shop"),
};

const fallbackTypeChart = {
  water: { double: ["fire", "ground", "rock"], half: ["water", "grass", "dragon"], no: [] },
  fire: { double: ["grass", "ice", "bug", "steel"], half: ["fire", "water", "rock", "dragon"], no: [] },
  grass: { double: ["water", "ground", "rock"], half: ["fire", "grass", "poison", "flying", "bug", "dragon", "steel"], no: [] },
  electric: { double: ["water", "flying"], half: ["electric", "grass", "dragon"], no: ["ground"] },
  ground: { double: ["fire", "electric", "poison", "rock", "steel"], half: ["grass", "bug"], no: ["flying"] },
};

function titleCase(value) {
  return String(value || "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function setLoading(visible, message = "") {
  refs.loadingOverlay.classList.toggle("hidden", !visible);
  if (message) {
    refs.loadingText.textContent = message;
  }
}

function showScreen(screen) {
  refs.startScreen.classList.toggle("active", screen === "start");
  refs.gameScreen.classList.toggle("active", screen === "game");
}

function addLog(message) {
  const stamp = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  state.logs.unshift(`[${stamp}] ${message}`);
  state.logs = state.logs.slice(0, 14);
  renderLog();
}

function renderLog() {
  refs.eventLog.innerHTML = "";
  state.logs.forEach((entry) => {
    const li = document.createElement("li");
    li.textContent = entry;
    refs.eventLog.appendChild(li);
  });
}

function loadCacheStore() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCacheStore(store) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage quota failures.
  }
}

async function fetchJson(pathOrUrl) {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${API_BASE}${pathOrUrl}`;
  const cache = loadCacheStore();
  const cached = cache[url];

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Falha ao buscar ${url} (${response.status})`);
  }

  const data = await response.json();
  cache[url] = { value: data, expiresAt: Date.now() + CACHE_TTL };
  saveCacheStore(cache);
  return data;
}

function getStatValue(pokemon, statName) {
  const entry = pokemon.stats.find((s) => s.stat.name === statName);
  return entry ? entry.base_stat : 0;
}

function pickBestSprite(pokemon) {
  return (
    pokemon?.sprites?.other?.["official-artwork"]?.front_default ||
    pokemon?.sprites?.other?.home?.front_default ||
    pokemon?.sprites?.front_default ||
    pokemon?.sprites?.front_shiny ||
    ""
  );
}

function getRarity(total) {
  if (total < 250) {
    return "common";
  }
  if (total < 320) {
    return "rare";
  }
  if (total < 390) {
    return "epic";
  }
  return "legendary";
}

function toCardModel(pokemon) {
  const hp = getStatValue(pokemon, "hp");
  const attack = getStatValue(pokemon, "attack");
  const defense = getStatValue(pokemon, "defense");
  const speed = getStatValue(pokemon, "speed");
  const total = hp + attack + defense + speed;
  const types = pokemon.types
    .slice()
    .sort((a, b) => a.slot - b.slot)
    .map((t) => t.type.name);
  const image = pickBestSprite(pokemon);

  return {
    id: pokemon.id,
    name: pokemon.name,
    image,
    types,
    stats: { hp, attack, defense, speed },
    total,
    rarity: getRarity(total),
    maxHp: hp,
    currentHp: hp,
    abilities: pokemon.abilities.map((a) => a.ability.name),
    level: 1,
    xp: 0,
    xpToNext: 100,
    canEvolve: true,
  };
}

function cloneCard(card) {
  return {
    ...card,
    stats: { ...card.stats },
    types: [...card.types],
    abilities: [...card.abilities],
    currentHp: card.maxHp,
    level: card.level || 1,
    xp: card.xp || 0,
    xpToNext: card.xpToNext || 100,
    canEvolve: card.canEvolve !== false,
    tempBuff: null,
  };
}

function getBiomeById(id) {
  return BIOMES.find((biome) => biome.id === id) || BIOMES[0];
}

function pickBiomeByRowAndCol(row, col, rows, cols) {
  const topBand = row <= 1;
  const bottomBand = row >= rows - 2;
  const leftBand = col <= 1;
  const rightBand = col >= cols - 2;

  if (topBand && (leftBand || rightBand)) {
    return Math.random() < 0.45 ? "volcanic" : "mountain";
  }
  if (topBand) {
    return Math.random() < 0.7 ? "mountain" : "forest";
  }
  if (bottomBand && (leftBand || rightBand)) {
    return Math.random() < 0.55 ? "lake" : "cave";
  }
  if (bottomBand) {
    return Math.random() < 0.52 ? "lake" : "plains";
  }
  if (leftBand || rightBand) {
    return Math.random() < 0.4 ? "cave" : "forest";
  }
  return Math.random() < 0.5 ? "plains" : "forest";
}

function createBiomeGrid(rows, cols) {
  const cells = [];
  for (let row = 0; row < rows; row += 1) {
    const line = [];
    for (let col = 0; col < cols; col += 1) {
      line.push(pickBiomeByRowAndCol(row, col, rows, cols));
    }
    cells.push(line);
  }
  return cells;
}

function getCurrentBiomeId() {
  const map = state.minimap;
  return map.cells?.[map.pos.row]?.[map.pos.col] || "plains";
}

function initializeMinimap() {
  const rows = 7;
  const cols = 9;
  const startRow = Math.floor(rows / 2);
  const startCol = Math.floor(cols / 2);
  const cells = createBiomeGrid(rows, cols);
  state.minimap = {
    rows,
    cols,
    pos: { row: startRow, col: startCol },
    discovered: new Set([`${startRow}:${startCol}`]),
    cells,
    steps: 0,
    currentBiome: cells[startRow][startCol],
  };
}

async function getPokemonByType(typeName) {
  if (typePokemonCache.has(typeName)) {
    return typePokemonCache.get(typeName);
  }

  try {
    const typeData = await fetchJson(`/type/${typeName}/`);
    const urls = typeData.pokemon.map((entry) => entry.pokemon.url);
    typePokemonCache.set(typeName, urls);
    return urls;
  } catch {
    typePokemonCache.set(typeName, []);
    return [];
  }
}

function getActiveXpTarget() {
  if (state.player.field) {
    return state.player.field;
  }
  if (state.player.hand.length) {
    return state.player.hand[0];
  }
  if (state.player.deck.length) {
    return state.player.deck[0];
  }
  return null;
}

async function getNextEvolutionName(card) {
  const cacheKey = `${card.id}:${card.name}`;
  if (evolutionNextCache.has(cacheKey)) {
    return evolutionNextCache.get(cacheKey);
  }

  try {
    const species = await fetchJson(`/pokemon-species/${card.id}/`);
    const chain = await fetchJson(species.evolution_chain.url);

    function findNext(node, targetName) {
      if (!node) {
        return null;
      }
      if (node.species?.name === targetName) {
        return node.evolves_to?.[0]?.species?.name || null;
      }
      for (const next of node.evolves_to || []) {
        const found = findNext(next, targetName);
        if (found !== null) {
          return found;
        }
      }
      return null;
    }

    const nextName = findNext(chain.chain, card.name);
    evolutionNextCache.set(cacheKey, nextName || null);
    return nextName || null;
  } catch {
    evolutionNextCache.set(cacheKey, null);
    return null;
  }
}

function shouldOfferEvolution(level) {
  return level > 0 && level % EVOLUTION_LEVEL_STEP === 0;
}

function enqueueEvolutionOption(card, nextName) {
  if (!card || !nextName) {
    return;
  }
  const alreadyQueued = state.evolutionQueue.some((item) => item.card === card && item.nextName === nextName);
  const isPending = state.pendingEvolution && state.pendingEvolution.card === card;
  if (alreadyQueued || isPending) {
    return;
  }
  state.evolutionQueue.push({ card, nextName });
}

async function applyEvolution(card, nextName) {
  if (!card || !nextName) {
    return false;
  }

  try {
    const nextRaw = await fetchJson(`/pokemon/${nextName}/`);
    const evolved = toCardModel(nextRaw);
    const hpRatio = card.maxHp > 0 ? card.currentHp / card.maxHp : 1;

    card.id = evolved.id;
    card.name = evolved.name;
    card.image = evolved.image;
    card.types = evolved.types;
    card.stats = evolved.stats;
    card.total = evolved.total;
    card.rarity = evolved.rarity;
    card.maxHp = evolved.maxHp;
    card.currentHp = Math.max(1, Math.round(evolved.maxHp * hpRatio));
    card.abilities = evolved.abilities;
    card.canEvolve = true;
    addLog(`${titleCase(card.name)} evoluiu com sucesso.`);
    return true;
  } catch {
    return false;
  }
}

async function gainCardXp(card, amount, sourceLabel) {
  if (!card || amount <= 0) {
    return;
  }

  card.xp += amount;
  addLog(`${titleCase(card.name)} ganhou ${amount} XP (${sourceLabel}).`);

  while (card.xp >= card.xpToNext) {
    card.xp -= card.xpToNext;
    card.level += 1;
    card.xpToNext = Math.round(card.xpToNext * 1.25);
    card.maxHp += 4;
    card.currentHp = Math.min(card.maxHp, card.currentHp + 8);
    card.stats.hp = card.maxHp;
    card.stats.attack += 2;
    card.stats.defense += 2;
    card.stats.speed += 1;
    card.total = card.maxHp + card.stats.attack + card.stats.defense + card.stats.speed;
    card.rarity = getRarity(card.total);
    addLog(`${titleCase(card.name)} subiu para o nível ${card.level}.`);
    if (card.canEvolve && shouldOfferEvolution(card.level)) {
      const nextName = await getNextEvolutionName(card);
      if (nextName) {
        enqueueEvolutionOption(card, nextName);
      } else {
        card.canEvolve = false;
      }
    }
  }
}

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function uniqueRandomIds(min, max, count) {
  const set = new Set();
  while (set.size < count) {
    set.add(Math.floor(Math.random() * (max - min + 1)) + min);
  }
  return [...set];
}

async function fetchPokemonPool(count) {
  const ids = uniqueRandomIds(1, 251, count * 2);
  const result = [];

  for (let i = 0; i < ids.length; i += 8) {
    const chunk = ids.slice(i, i + 8);
    const promises = chunk.map((id) => fetchJson(`/pokemon/${id}/`).catch(() => null));
    const rawList = await Promise.all(promises);

    rawList.forEach((raw) => {
      if (!raw) {
        return;
      }
      const card = toCardModel(raw);
      if (card.maxHp > 0 && card.stats.attack > 0 && card.types.length) {
        result.push(card);
      }
    });

    if (result.length >= count) {
      break;
    }
  }

  return result.slice(0, count);
}

async function fetchPokemonPoolByArchetype(archetype, count) {
  if (archetype === "balanced") {
    return fetchPokemonPool(count);
  }

  const preferredTypes = DECK_ARCHETYPE_TYPES[archetype] || [];
  const typeUrls = [];
  for (const typeName of preferredTypes) {
    const urls = await getPokemonByType(typeName);
    typeUrls.push(...urls);
  }

  const uniqueUrls = [...new Set(typeUrls)];
  const shuffledUrls = shuffle(uniqueUrls).slice(0, count * 4);
  const cards = [];

  for (let i = 0; i < shuffledUrls.length; i += 8) {
    const chunk = shuffledUrls.slice(i, i + 8);
    const rawList = await Promise.all(chunk.map((url) => fetchJson(url).catch(() => null)));
    rawList.forEach((raw) => {
      if (!raw) {
        return;
      }
      const card = toCardModel(raw);
      if (card.maxHp > 0 && card.stats.attack > 0 && card.types.length) {
        cards.push(card);
      }
    });
    if (cards.length >= count) {
      break;
    }
  }

  if (cards.length < count) {
    const fallbackCards = await fetchPokemonPool(count - cards.length);
    cards.push(...fallbackCards);
  }

  return cards.slice(0, count);
}

function getDeckSizeForDifficulty(difficulty) {
  return (DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.normal).deckSize;
}

function trimStarterSelection(maxSize) {
  const selected = [...state.starterSelectedIds];
  if (selected.length <= maxSize) {
    return;
  }
  state.starterSelectedIds = new Set(selected.slice(0, maxSize));
}

function updateDeckValidationUI() {
  const maxSize = getDeckSizeForDifficulty(refs.difficulty.value);
  const selectedSize = state.starterSelectedIds.size;
  const valid = selectedSize === maxSize;

  refs.startButton.disabled = !valid || state.starterLoading;
  refs.deckValidation.classList.toggle("deck-validation-error", !valid);
  refs.deckValidation.textContent = valid
    ? "Deck pronto para iniciar."
    : `Selecione exatamente ${maxSize} cartas para iniciar.`;
}

function autoFillStarterDeck() {
  const maxSize = getDeckSizeForDifficulty(refs.difficulty.value);
  const selected = new Set(state.starterSelectedIds);
  const available = shuffle([...state.starterPool]);

  for (const card of available) {
    if (selected.size >= maxSize) {
      break;
    }
    selected.add(card.id);
  }

  state.starterSelectedIds = selected;
  trimStarterSelection(maxSize);
  renderStarterPool();
}

function getFilteredStarterPool() {
  const query = state.starterSearch.trim().toLowerCase();
  return state.starterPool.filter((card) => {
    const byName = !query || card.name.includes(query);
    const byType =
      state.starterTypeFilter === "all" || card.types.includes(state.starterTypeFilter);
    return byName && byType;
  });
}

function renderStarterTypeFilterOptions() {
  const current = state.starterTypeFilter;
  const typeSet = new Set(state.starterPool.flatMap((card) => card.types));
  const types = [...typeSet].sort();

  refs.starterTypeFilter.innerHTML = '<option value="all">Todos os tipos</option>';
  types.forEach((type) => {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = titleCase(type);
    refs.starterTypeFilter.appendChild(option);
  });

  if (types.includes(current)) {
    refs.starterTypeFilter.value = current;
  } else {
    refs.starterTypeFilter.value = "all";
    state.starterTypeFilter = "all";
  }
}

function renderStarterPool() {
  const maxSize = getDeckSizeForDifficulty(refs.difficulty.value);
  const filteredPool = getFilteredStarterPool();
  refs.deckSelectInfo.textContent = `Selecionadas: ${state.starterSelectedIds.size}/${maxSize}`;
  refs.starterCardPool.innerHTML = "";

  if (!state.starterPool.length) {
    const empty = document.createElement("p");
    empty.className = "map-help";
    empty.textContent = state.starterLoading
      ? "Carregando opções de cartas..."
      : "Clique em Gerar Opções de Cartas.";
    refs.starterCardPool.appendChild(empty);
    updateDeckValidationUI();
    return;
  }

  if (!filteredPool.length) {
    const empty = document.createElement("p");
    empty.className = "map-help";
    empty.textContent = "Nenhuma carta encontrada para os filtros atuais.";
    refs.starterCardPool.appendChild(empty);
    updateDeckValidationUI();
    return;
  }

  filteredPool.forEach((card) => {
    const item = document.createElement("article");
    item.className = "starter-card";
    if (state.starterSelectedIds.has(card.id)) {
      item.classList.add("selected");
    }
    item.dataset.cardId = String(card.id);
    item.innerHTML = `
      <img src="${card.image || ""}" alt="${titleCase(card.name)}" loading="lazy" />
      <div class="starter-card-name">${titleCase(card.name)}</div>
      <div class="starter-card-meta">${card.types.join("/")} · ${card.total}</div>
    `;
    const img = item.querySelector("img");
    img.onerror = () => {
      img.onerror = null;
      img.src = `data:image/svg+xml;utf8,${encodeURIComponent(
        "<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><rect width='100%' height='100%' fill='#0c2133'/><circle cx='40' cy='40' r='16' fill='#d7ecfb'/></svg>"
      )}`;
    };
    refs.starterCardPool.appendChild(item);
  });
  updateDeckValidationUI();
}

async function prepareStarterPool() {
  if (state.starterLoading) {
    return;
  }
  state.starterLoading = true;
  refs.refreshDeckOptions.disabled = true;
  refs.refreshDeckOptions.textContent = "Gerando...";
  renderStarterPool();

  try {
    const archetype = refs.deckArchetype.value;
    const difficulty = refs.difficulty.value;
    const deckSize = getDeckSizeForDifficulty(difficulty);
    const poolSize = Math.max(deckSize + 6, 12);
    const pool = await fetchPokemonPoolByArchetype(archetype, poolSize);
    state.starterPool = pool.map(cloneCard);
    trimStarterSelection(deckSize);
    renderStarterTypeFilterOptions();
  } catch {
    state.starterPool = [];
    renderStarterTypeFilterOptions();
  } finally {
    state.starterLoading = false;
    refs.refreshDeckOptions.disabled = false;
    refs.refreshDeckOptions.textContent = "Gerar Opções de Cartas";
    renderStarterPool();
  }
}

function getStarterDeckCards(deckSize) {
  const selected = state.starterPool.filter((card) => state.starterSelectedIds.has(card.id));
  if (selected.length !== deckSize) {
    return [];
  }
  return selected.slice(0, deckSize).map(cloneCard);
}

async function buildEncounterEnemyDeck(biomeId, deckSize) {
  const biome = getBiomeById(biomeId);
  const urlsByTypes = [];

  for (const typeName of biome.wildTypes) {
    const urls = await getPokemonByType(typeName);
    urlsByTypes.push(...urls);
  }

  const uniqueUrls = shuffle([...new Set(urlsByTypes)]).slice(0, deckSize * 4);
  const cards = [];
  for (let i = 0; i < uniqueUrls.length; i += 8) {
    const chunk = uniqueUrls.slice(i, i + 8);
    const rawList = await Promise.all(chunk.map((url) => fetchJson(url).catch(() => null)));
    rawList.forEach((raw) => {
      if (!raw) {
        return;
      }
      const card = toCardModel(raw);
      if (card.maxHp > 0 && card.stats.attack > 0 && card.types.length) {
        cards.push(card);
      }
    });
    if (cards.length >= deckSize) {
      break;
    }
  }

  if (cards.length < deckSize) {
    cards.push(...(await fetchPokemonPool(deckSize - cards.length)));
  }

  return shuffle(cards.slice(0, deckSize)).map(cloneCard);
}

async function buildTypeChart(typeNames) {
  const map = new Map();

  try {
    const details = await Promise.all(
      [...typeNames].map((name) => fetchJson(`/type/${name}/`).catch(() => null))
    );

    details.forEach((typeData) => {
      if (!typeData || !typeData.damage_relations) {
        return;
      }

      map.set(typeData.name, {
        double: new Set(typeData.damage_relations.double_damage_to.map((t) => t.name)),
        half: new Set(typeData.damage_relations.half_damage_to.map((t) => t.name)),
        no: new Set(typeData.damage_relations.no_damage_to.map((t) => t.name)),
      });
    });
  } catch {
    // Falls back below.
  }

  Object.entries(fallbackTypeChart).forEach(([name, chart]) => {
    if (!map.has(name)) {
      map.set(name, {
        double: new Set(chart.double),
        half: new Set(chart.half),
        no: new Set(chart.no),
      });
    }
  });

  return map;
}

function typeMultiplierForPair(attackType, defendType) {
  const row = state.typeChart.get(attackType);
  if (!row) {
    return 1;
  }

  if (row.no.has(defendType)) {
    return 0;
  }
  if (row.double.has(defendType)) {
    return 2;
  }
  if (row.half.has(defendType)) {
    return 0.5;
  }
  return 1;
}

function getBestTypeOutcome(attackerTypes, defenderTypes) {
  let bestType = attackerTypes[0] || "normal";
  let bestMultiplier = 1;

  attackerTypes.forEach((attackType) => {
    const multiplier = defenderTypes.reduce(
      (acc, defendType) => acc * typeMultiplierForPair(attackType, defendType),
      1
    );

    if (multiplier > bestMultiplier) {
      bestMultiplier = multiplier;
      bestType = attackType;
    }
  });

  return { attackType: bestType, multiplier: bestMultiplier };
}

function countAlive(side) {
  const fieldAlive = side.field ? 1 : 0;
  return side.deck.length + side.hand.length + fieldAlive;
}

function drawToHand(side, amount, handLimit) {
  for (let i = 0; i < amount; i += 1) {
    if (side.hand.length >= handLimit || !side.deck.length) {
      break;
    }
    side.hand.push(side.deck.shift());
  }
}

function setTypeFeedback(text, kind = "") {
  refs.typeFeedback.textContent = text;
  refs.typeFeedback.classList.remove("strong", "weak", "immune");
  if (kind) {
    refs.typeFeedback.classList.add(kind);
  }
}

function getCardTypeClass(card) {
  const primary = card.types[0] || "default";
  return typeClassWhitelist.has(primary) ? `type-${primary}` : "type-default";
}

function createCardElement(card, options = {}) {
  const { compact = false, selectable = false, selected = false } = options;
  const node = document.createElement("article");
  node.className = `card ${card.rarity} ${getCardTypeClass(card)} ${compact ? "card-hand" : ""}`;
  if (selected) {
    node.classList.add("selected");
  }

  const hpPct = Math.max(0, (card.currentHp / card.maxHp) * 100);
  const xpPct = Math.max(0, Math.min(100, ((card.xp || 0) / (card.xpToNext || 100)) * 100));
  const safeName = titleCase(card.name);
  const imageSource = card.image || "";

  node.innerHTML = `
    <div class="card-top">
      <span class="card-name">${safeName}</span>
      <span class="card-rarity">Lv ${card.level || 1} · ${card.rarity}${card.tempBuff ? " · Buff" : ""}</span>
    </div>
    <div class="card-image-wrap">
      <img src="${imageSource}" alt="${safeName}" loading="lazy" />
    </div>
    <div class="type-tags">
      ${card.types.map((type) => `<span class="type-tag">${type}</span>`).join("")}
    </div>
    <div class="stats">
      <span>HP ${card.maxHp}</span>
      <span>ATK ${card.stats.attack}</span>
      <span>DEF ${card.stats.defense}</span>
      <span>SPD ${card.stats.speed}</span>
    </div>
    <div class="hp-wrap">
      <div class="hp-head"><span>Vida</span><span>${Math.max(0, Math.ceil(card.currentHp))}/${card.maxHp}</span></div>
      <div class="hp-bar"><div class="hp-fill" style="width:${hpPct}%"></div></div>
    </div>
    <div class="xp-wrap">
      <div class="xp-head"><span>XP</span><span>${card.xp || 0}/${card.xpToNext || 100}</span></div>
      <div class="xp-bar"><div class="xp-fill" style="width:${xpPct}%"></div></div>
    </div>
  `;

  const img = node.querySelector("img");
  img.onerror = () => {
    img.onerror = null;
    img.src = `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><rect width='100%' height='100%' fill='#0c2133'/><text x='50%' y='50%' fill='#d8eaf8' text-anchor='middle' dominant-baseline='middle' font-family='sans-serif' font-size='20'>${safeName}</text></svg>`
    )}`;
  };

  if (selectable) {
    node.setAttribute("role", "button");
    node.setAttribute("tabindex", "0");
  }

  return node;
}

function renderField(sideName) {
  const side = state[sideName];
  const target = sideName === "player" ? refs.playerField : refs.enemyField;
  target.innerHTML = "";

  if (!side.field) {
    const empty = document.createElement("div");
    empty.className = "card-placeholder";
    empty.textContent = "Sem carta no campo";
    target.appendChild(empty);
    return;
  }

  target.appendChild(createCardElement(side.field));
}

function renderHands() {
  refs.playerHand.innerHTML = "";

  state.player.hand.forEach((card, idx) => {
    const cardNode = createCardElement(card, {
      compact: true,
      selectable: true,
      selected: state.selectedHandIndex === idx,
    });
    cardNode.dataset.index = String(idx);
    refs.playerHand.appendChild(cardNode);
  });

  refs.enemyHand.innerHTML = "";
  state.enemy.hand.forEach(() => {
    const back = document.createElement("div");
    back.className = "enemy-card-back";
    back.textContent = "IA";
    refs.enemyHand.appendChild(back);
  });
}

function renderHud() {
  refs.turnIndicator.textContent = state.encounter.active
    ? state.turn === "player"
      ? "Jogador"
      : "IA"
    : "Exploração";
  refs.deckInfo.textContent = state.encounter.active
    ? `Encontro: ${titleCase(state.encounter.biomeId || "desconhecido")} | Inimigos ${state.enemy.deck.length + state.enemy.hand.length + (state.enemy.field ? 1 : 0)}`
    : `Deck Jogador: ${state.player.deck.length} no deck`;
  refs.handInfo.textContent = `Mão: ${state.player.hand.length} | Itens P:${state.items.potion} SP:${state.items.superPotion} R:${state.items.reviver} T:${state.items.battleTonic}`;
  refs.coinInfo.textContent = `Moedas: ${state.coins}`;
  refs.playerRemaining.textContent = `${countAlive(state.player)} restantes`;
  refs.enemyRemaining.textContent = state.encounter.active
    ? `${countAlive(state.enemy)} restantes`
    : "Sem batalha ativa";
}

function renderMinimap() {
  const map = state.minimap;
  refs.minimapGrid.innerHTML = "";
  refs.minimapGrid.style.gridTemplateColumns = `repeat(${map.cols}, 1fr)`;
  refs.biomeLegend.innerHTML = "";

  BIOMES.forEach((biome) => {
    const chip = document.createElement("span");
    chip.className = `biome-chip biome-${biome.id}`;
    chip.textContent = biome.label;
    refs.biomeLegend.appendChild(chip);
  });

  for (let row = 0; row < map.rows; row += 1) {
    for (let col = 0; col < map.cols; col += 1) {
      const cell = document.createElement("div");
      const key = `${row}:${col}`;
      const biomeId = map.cells[row][col];
      cell.className = `map-cell biome-${biomeId}`;
      if (map.discovered.has(key)) {
        cell.classList.add("discovered");
      }
      if (map.pos.row === row && map.pos.col === col) {
        cell.classList.add("player");
      }
      refs.minimapGrid.appendChild(cell);
    }
  }

  const currentBiome = getBiomeById(getCurrentBiomeId());
  refs.mapStatus.textContent = `Passos: ${map.steps} | ${currentBiome.label} (${map.pos.row + 1},${map.pos.col + 1})`;
}

function setMapEvent(message) {
  refs.mapEvent.textContent = message;
}

function getLevelsUntilNextEvolution(level) {
  const next = Math.ceil(level / EVOLUTION_LEVEL_STEP) * EVOLUTION_LEVEL_STEP;
  return Math.max(0, next - level);
}

function getActiveProgressCard() {
  return state.player.field || state.player.hand[0] || state.player.deck[0] || null;
}

function renderProgressionInfo() {
  const card = getActiveProgressCard();
  if (!card) {
    refs.progressionInfo.textContent = "Sem carta ativa para progresso.";
    return;
  }

  const levelsLeft = getLevelsUntilNextEvolution(card.level);
  const evoText =
    levelsLeft === 0
      ? "Marco de evolução atingido."
      : `Faltam ${levelsLeft} níveis para próximo marco de evolução.`;
  refs.progressionInfo.textContent = `${titleCase(card.name)} · Nível ${card.level} · XP ${card.xp}/${card.xpToNext}. ${evoText}`;
}

function showNextEvolutionPrompt() {
  if (state.pendingEvolution || !state.evolutionQueue.length) {
    return;
  }
  state.pendingEvolution = state.evolutionQueue.shift();
  const { card, nextName } = state.pendingEvolution;
  refs.evolutionText.textContent = `${titleCase(card.name)} pode evoluir para ${titleCase(nextName)}.`;
  refs.evolutionModal.classList.remove("hidden");
}

function closeEvolutionPrompt() {
  refs.evolutionModal.classList.add("hidden");
  state.pendingEvolution = null;
}

function grantRandomHealingItem(reasonLabel) {
  const roll = Math.random();
  let itemKey = "potion";
  if (roll < 0.6) {
    itemKey = "potion";
  } else if (roll < 0.88) {
    itemKey = "superPotion";
  } else if (roll < 0.96) {
    itemKey = "battleTonic";
  } else {
    itemKey = "reviver";
  }
  const itemLabel =
    itemKey === "potion"
      ? "Poção"
      : itemKey === "superPotion"
      ? "Super Poção"
      : itemKey === "battleTonic"
      ? "Tônico"
      : "Reviver";
  state.items[itemKey] += 1;
  addLog(`Você obteve ${itemLabel} (${reasonLabel}).`);
  setMapEvent(`Item encontrado: ${itemLabel}.`);
}

function grantCoins(amount, reasonLabel) {
  if (!Number.isFinite(amount) || amount <= 0) {
    return;
  }
  state.coins += amount;
  addLog(`+${amount} moedas (${reasonLabel}).`);
}

function useHealingItem(itemKey) {
  if (state.resolving || state.winner || state.pendingEvolution) {
    return;
  }
  const target = state.player.field;
  if (!target) {
    addLog("Coloque uma carta no campo para usar itens.");
    return;
  }
  if ((state.items[itemKey] || 0) <= 0) {
    return;
  }

  const healAmount = itemKey === "potion" ? 30 : 60;
  const before = target.currentHp;
  target.currentHp = Math.min(target.maxHp, target.currentHp + healAmount);
  const healed = target.currentHp - before;
  state.items[itemKey] -= 1;
  const itemLabel = itemKey === "potion" ? "Poção" : "Super Poção";
  addLog(`${itemLabel} usada em ${titleCase(target.name)} (+${healed} HP).`);
  setTypeFeedback(`${itemLabel} recuperou ${healed} HP.`);
  renderAll();
}

function useReviverItem() {
  if (state.resolving || state.winner || state.pendingEvolution) {
    return;
  }
  if ((state.items.reviver || 0) <= 0) {
    return;
  }
  if (!state.player.graveyard.length) {
    addLog("Nenhuma carta derrotada para reviver.");
    return;
  }
  openReviverModal();
}

function reviveFromGraveyard(index) {
  if (state.resolving || state.winner || state.pendingEvolution) {
    return;
  }
  if ((state.items.reviver || 0) <= 0 || !state.player.graveyard.length) {
    closeReviverModal();
    renderAll();
    return;
  }
  if (index < 0 || index >= state.player.graveyard.length) {
    return;
  }
  const [revived] = state.player.graveyard.splice(index, 1);
  const revivedHp = Math.max(20, Math.round(revived.maxHp * 0.4));
  revived.currentHp = Math.min(revived.maxHp, revivedHp);
  revived.tempBuff = null;

  if (!state.player.field) {
    state.player.field = revived;
  } else {
    state.player.hand.push(revived);
  }

  state.items.reviver -= 1;
  addLog(`Reviver usado: ${titleCase(revived.name)} voltou com ${revived.currentHp} HP.`);
  setTypeFeedback(`${titleCase(revived.name)} foi revivido.`);
  closeReviverModal();
  renderAll();
}

function renderReviverList() {
  refs.reviverList.innerHTML = "";
  if (!state.player.graveyard.length) {
    const empty = document.createElement("p");
    empty.className = "map-help";
    empty.textContent = "Nenhuma carta derrotada disponível.";
    refs.reviverList.appendChild(empty);
    return;
  }
  state.player.graveyard.forEach((card, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-ghost";
    button.dataset.reviverIndex = String(index);
    button.textContent = `${titleCase(card.name)} · Lv ${card.level} · ${card.rarity}`;
    refs.reviverList.appendChild(button);
  });
}

function openReviverModal() {
  renderReviverList();
  refs.reviverModal.classList.remove("hidden");
}

function closeReviverModal() {
  refs.reviverModal.classList.add("hidden");
}

function canOpenShop() {
  return !state.encounter.active && !state.resolving && !state.winner && !state.pendingEvolution;
}

function biomeDiscountKey() {
  return BIOME_SHOP_BONUS[getCurrentBiomeId()] || "potion";
}

function createShopOffers() {
  const discountKey = biomeDiscountKey();
  const winFactor = Math.min(1.35, 1 + state.encounter.wins * 0.04);
  state.shop.offers = SHOP_OFFERS.map((offer) => {
    const basePrice = Math.round(offer.price * winFactor);
    const discounted = offer.key === discountKey;
    const price = Math.max(10, discounted ? Math.round(basePrice * 0.8) : basePrice);

    let stock = 1;
    if (offer.kind === "item") {
      if (offer.key === "potion") {
        stock = 3 + Math.floor(Math.random() * 3);
      } else if (offer.key === "superPotion") {
        stock = 2 + Math.floor(Math.random() * 2);
      } else if (offer.key === "battleTonic") {
        stock = 2 + Math.floor(Math.random() * 2);
      } else {
        stock = 1 + Math.floor(Math.random() * 2);
      }
    }

    return {
      ...offer,
      discounted,
      price,
      stock,
    };
  });
}

function getOfferByKey(key) {
  return state.shop.offers.find((offer) => offer.key === key) || null;
}

function openShopModal() {
  if (!canOpenShop()) {
    addLog("A loja só pode ser aberta fora de batalhas.");
    return;
  }
  if (!state.shop.offers.length) {
    createShopOffers();
  }
  renderShopState();
  refs.shopModal.classList.remove("hidden");
}

function closeShopModal() {
  refs.shopModal.classList.add("hidden");
}

function focusShopPanel() {
  refs.shopPanel.scrollIntoView({ behavior: "smooth", block: "center" });
  refs.shopPanel.classList.add("shop-focus");
  window.setTimeout(() => refs.shopPanel.classList.remove("shop-focus"), 900);
}

function healTeamService() {
  const party = [...state.player.deck, ...state.player.hand, state.player.field].filter(Boolean);
  let healedTotal = 0;

  party.forEach((card) => {
    const before = card.currentHp;
    const amount = Math.max(8, Math.round(card.maxHp * 0.35));
    card.currentHp = Math.min(card.maxHp, card.currentHp + amount);
    healedTotal += card.currentHp - before;
  });

  return healedTotal;
}

async function applyShopOffer(offer) {
  if (!offer || offer.stock <= 0 || state.coins < offer.price) {
    return false;
  }

  state.coins -= offer.price;
  offer.stock -= 1;

  if (offer.kind === "item") {
    state.items[offer.key] += 1;
    addLog(`Compra: ${offer.label} por ${offer.price} moedas.`);
    setTypeFeedback(`${offer.label} adicionado ao inventário.`);
    refs.shopNote.textContent = `Compra concluída: ${offer.label}.`;
    return true;
  }

  if (offer.key === "fieldMedic") {
    const healed = healTeamService();
    addLog(`Equipe Médica restaurou ${healed} HP total.`);
    setTypeFeedback(`Equipe curada em ${healed} HP.`);
    refs.shopNote.textContent = `Serviço aplicado: +${healed} HP na equipe.`;
    return true;
  }

  if (offer.key === "battleDrill") {
    const target = getActiveProgressCard();
    if (!target) {
      state.coins += offer.price;
      offer.stock += 1;
      refs.shopNote.textContent = "Sem carta para treinar agora.";
      return false;
    }
    const xpGain = 48 + state.encounter.wins * 6;
    await gainCardXp(target, xpGain, "treino tático na loja");
    addLog(`${titleCase(target.name)} concluiu treino tático (+${xpGain} XP).`);
    setTypeFeedback("Treino concluído com sucesso.");
    refs.shopNote.textContent = `${titleCase(target.name)} ganhou ${xpGain} XP.`;
    return true;
  }

  return false;
}

function renderShopStockPanel() {
  refs.shopStock.innerHTML = "";
  if (!state.shop.offers.length) {
    const empty = document.createElement("p");
    empty.className = "map-help";
    empty.textContent = "Estoque indisponível.";
    refs.shopStock.appendChild(empty);
    return;
  }

  state.shop.offers.forEach((offer) => {
    const card = document.createElement("article");
    card.className = "shop-offer";
    const discountText = offer.discounted ? " · desconto do bioma" : "";
    const cantBuy = offer.stock <= 0 || state.coins < offer.price || !canOpenShop();
    card.innerHTML = `
      <h4>${offer.label}</h4>
      <p>${offer.description}</p>
      <div class="shop-offer-meta">
        <span>Preço: ${offer.price}</span>
        <span>Estoque: ${offer.stock}</span>
      </div>
      <button
        class="btn btn-ghost"
        type="button"
        data-offer-key="${offer.key}"
        ${cantBuy ? "disabled" : ""}
      >Comprar${discountText}</button>
    `;
    refs.shopStock.appendChild(card);
  });
}

function renderShopState() {
  if (!state.shop.offers.length) {
    createShopOffers();
  }

  refs.shopCoins.textContent = `Moedas: ${state.coins}`;
  refs.shopCoinsInline.textContent = `Moedas: ${state.coins}`;
  refs.shopStatus.textContent = canOpenShop()
    ? `Atualizar estoque (${state.shop.rerollCost} moedas)`
    : "Loja bloqueada durante batalha";
  refs.rerollShop.textContent = `Atualizar Estoque (${state.shop.rerollCost})`;
  refs.rerollShop.disabled = !canOpenShop() || state.coins < state.shop.rerollCost;

  const quickPotion = getOfferByKey("potion");
  const quickSuperPotion = getOfferByKey("superPotion");
  const quickReviver = getOfferByKey("reviver");
  const quickTonic = getOfferByKey("battleTonic");

  refs.buyPotion.disabled = !quickPotion || quickPotion.stock <= 0 || state.coins < quickPotion.price;
  refs.buySuperPotion.disabled =
    !quickSuperPotion || quickSuperPotion.stock <= 0 || state.coins < quickSuperPotion.price;
  refs.buyReviver.disabled = !quickReviver || quickReviver.stock <= 0 || state.coins < quickReviver.price;
  refs.buyBattleTonic.disabled = !quickTonic || quickTonic.stock <= 0 || state.coins < quickTonic.price;

  refs.buyPotion.textContent = `Poção (${quickPotion ? quickPotion.price : SHOP_PRICES.potion})`;
  refs.buySuperPotion.textContent = `Super Poção (${quickSuperPotion ? quickSuperPotion.price : SHOP_PRICES.superPotion})`;
  refs.buyReviver.textContent = `Reviver (${quickReviver ? quickReviver.price : SHOP_PRICES.reviver})`;
  refs.buyBattleTonic.textContent = `Tônico (${quickTonic ? quickTonic.price : SHOP_PRICES.battleTonic})`;

  renderShopStockPanel();
}

async function buyShopItem(itemKey) {
  if (!canOpenShop()) {
    return;
  }
  const offer = getOfferByKey(itemKey);
  if (!offer) {
    setTypeFeedback("Esse item não está no estoque atual.");
    return;
  }
  if (state.coins < offer.price) {
    setTypeFeedback("Moedas insuficientes para a compra.");
    renderShopState();
    return;
  }
  if (offer.stock <= 0) {
    setTypeFeedback("Item esgotado.");
    renderShopState();
    return;
  }

  const success = await applyShopOffer(offer);
  if (success) {
    renderAll();
  } else {
    renderShopState();
  }
}

function rerollShopStock() {
  if (!canOpenShop()) {
    return;
  }
  if (state.coins < state.shop.rerollCost) {
    setTypeFeedback("Moedas insuficientes para atualizar o estoque.");
    return;
  }
  state.coins -= state.shop.rerollCost;
  state.shop.rerollCost = Math.min(50, state.shop.rerollCost + 5);
  createShopOffers();
  refs.shopNote.textContent = "Estoque da loja atualizado.";
  addLog("Loja atualizada com novas ofertas.");
  renderAll();
}

function useBattleTonicItem() {
  if (state.resolving || state.winner || state.pendingEvolution) {
    return;
  }
  if ((state.items.battleTonic || 0) <= 0) {
    return;
  }
  if (!state.player.field) {
    addLog("Coloque uma carta em campo para usar o Tônico.");
    return;
  }
  state.player.field.tempBuff = {
    attackMultiplier: BATTLE_TONIC_MULTIPLIER,
    charges: 1,
  };
  state.items.battleTonic -= 1;
  addLog(
    `Tônico usado em ${titleCase(state.player.field.name)} (+${Math.round(
      (BATTLE_TONIC_MULTIPLIER - 1) * 100
    )}% ATK no próximo ataque).`
  );
  setTypeFeedback("Tônico ativo no próximo ataque.");
  renderAll();
}

async function startEncounterBattle(biome) {
  if (state.encounter.active) {
    return;
  }

  const enemyDeckSize = Math.min(5, 2 + Math.floor(state.minimap.steps / 8));
  const enemyDeck = await buildEncounterEnemyDeck(biome.id, enemyDeckSize);
  const handLimit = 3;

  state.enemy.deck = enemyDeck;
  state.enemy.hand = [];
  state.enemy.field = null;
  state.enemy.graveyard = [];
  drawToHand(state.enemy, handLimit, handLimit);
  autoPlaceEnemyCard();

  if (!state.player.field) {
    drawToHand(state.player, 1, DIFFICULTY_CONFIG[state.difficulty].handSize);
  }

  state.encounter.active = true;
  state.encounter.biomeId = biome.id;
  addLog(`Batalha iniciada em ${biome.label}. Inimigos: ${enemyDeckSize}.`);
  setMapEvent(`Encontro em ${biome.label}: batalha iniciada.`);
  setTypeFeedback("Encontro ativo: escolha carta e ataque.");
}

async function moveOnMap(rowDelta, colDelta) {
  if (state.resolving || state.winner || state.encounter.active || state.pendingEvolution) {
    return;
  }

  const map = state.minimap;
  const nextRow = map.pos.row + rowDelta;
  const nextCol = map.pos.col + colDelta;

  if (nextRow < 0 || nextCol < 0 || nextRow >= map.rows || nextCol >= map.cols) {
    setMapEvent("Borda do minimapa alcançada.");
    return;
  }

  map.pos.row = nextRow;
  map.pos.col = nextCol;
  map.steps += 1;
  map.discovered.add(`${nextRow}:${nextCol}`);
  map.currentBiome = getCurrentBiomeId();
  renderMinimap();

  const biome = getBiomeById(map.currentBiome);
  const hasEncounter = Math.random() < biome.encounterRate;
  if (hasEncounter) {
    state.resolving = true;
    renderAll();
    try {
      await startEncounterBattle(biome);
    } finally {
      state.resolving = false;
      renderAll();
    }
    return;
  }

  if (Math.random() < 0.35) {
    if (Math.random() < 0.55) {
      const coins = 8 + Math.floor(Math.random() * 8);
      grantCoins(coins, `exploração em ${biome.label}`);
      setMapEvent(`Você encontrou ${coins} moedas em ${biome.label}.`);
    } else {
      grantRandomHealingItem(`exploração em ${biome.label}`);
    }
    renderAll();
    return;
  }

  if (Math.random() < 0.12) {
    state.shop.rerollCost = Math.max(8, state.shop.rerollCost - 2);
    createShopOffers();
    setMapEvent(`Mercador viajante em ${biome.label}: estoque renovado e taxa reduzida.`);
    addLog("Mercador viajante apareceu e renovou a loja.");
    renderAll();
    return;
  }

  setMapEvent(`Você explorou ${biome.label} sem encontrar batalha.`);
  renderAll();
}

function renderAll() {
  renderField("player");
  renderField("enemy");
  renderHands();
  renderHud();
  renderMinimap();
  renderProgressionInfo();
  showNextEvolutionPrompt();

  const hardLocked = state.resolving || state.winner !== null || !!state.pendingEvolution;
  refs.attackButton.disabled = hardLocked || !state.encounter.active;
  refs.moveUp.disabled = hardLocked || state.encounter.active;
  refs.moveDown.disabled = hardLocked || state.encounter.active;
  refs.moveLeft.disabled = hardLocked || state.encounter.active;
  refs.moveRight.disabled = hardLocked || state.encounter.active;
  refs.usePotion.textContent = `Poção (${state.items.potion})`;
  refs.useSuperPotion.textContent = `Super Poção (${state.items.superPotion})`;
  refs.useReviver.textContent = `Reviver (${state.items.reviver})`;
  refs.useBattleTonic.textContent = `Tônico (${state.items.battleTonic})`;
  const canUseItems = !hardLocked && !!state.player.field;
  refs.usePotion.disabled = !canUseItems || state.items.potion <= 0;
  refs.useSuperPotion.disabled = !canUseItems || state.items.superPotion <= 0;
  refs.useReviver.disabled = hardLocked || state.items.reviver <= 0 || state.player.graveyard.length <= 0;
  refs.useBattleTonic.disabled = !canUseItems || state.items.battleTonic <= 0;
  refs.openShop.disabled = false;
  refs.openShop.textContent = canOpenShop() ? "Loja" : "Loja (bloqueada)";
  renderShopState();
}

function setBattleAnimation(active) {
  refs.battleSpark.classList.toggle("active", active);
}

function autoPlaceEnemyCard() {
  if (state.enemy.field || !state.enemy.hand.length) {
    return;
  }

  let bestIndex = 0;
  let bestScore = -Infinity;

  state.enemy.hand.forEach((candidate, index) => {
    let score = candidate.total;
    if (state.player.field) {
      const matchup = getBestTypeOutcome(candidate.types, state.player.field.types);
      score += matchup.multiplier * 24;
    }

    const randomness = (Math.random() * 26 - 13) / DIFFICULTY_CONFIG[state.difficulty].aiWeight;
    score += randomness;

    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  const [card] = state.enemy.hand.splice(bestIndex, 1);
  state.enemy.field = card;
  addLog(`IA colocou ${titleCase(card.name)} em campo.`);
}

function placePlayerCard(index) {
  if (state.resolving || state.turn !== "player" || state.winner) {
    return;
  }
  if (state.player.field) {
    addLog("Você já tem uma carta no campo.");
    return;
  }
  if (!state.player.hand[index]) {
    return;
  }

  const [card] = state.player.hand.splice(index, 1);
  state.player.field = card;
  state.selectedHandIndex = null;
  addLog(`Você colocou ${titleCase(card.name)} em campo.`);

  if (state.encounter.active) {
    autoPlaceEnemyCard();
  }
  renderAll();
}

function ensureFields() {
  if (!state.enemy.field) {
    autoPlaceEnemyCard();
  }

  if (!state.player.field) {
    setTypeFeedback("Escolha uma carta da mão para entrar no campo.");
    renderAll();
    return false;
  }

  if (!state.enemy.field) {
    setTypeFeedback("IA sem carta em campo.");
    renderAll();
    return false;
  }

  return true;
}

function animateField(sideName, className) {
  const target = sideName === "player" ? refs.playerField : refs.enemyField;
  const card = target.querySelector(".card");
  if (!card) {
    return;
  }
  card.classList.remove(className);
  void card.offsetWidth;
  card.classList.add(className);
}

function resolveAttack(attackerSideName, defenderSideName) {
  const attackerSide = state[attackerSideName];
  const defenderSide = state[defenderSideName];
  const attacker = attackerSide.field;
  const defender = defenderSide.field;

  if (!attacker || !defender) {
    return { knockedOut: false, attacker: null, defender: null, damage: 0 };
  }

  const matchup = getBestTypeOutcome(attacker.types, defender.types);
  const buffMultiplier = attacker.tempBuff?.attackMultiplier || 1;
  const baseAttack = (attacker.stats.attack + attacker.stats.speed * 0.35 + Math.random() * 8) * buffMultiplier;
  const mitigation = defender.stats.defense * 0.42;
  const rawDamage = (baseAttack - mitigation) * matchup.multiplier;
  const damage = Math.max(matchup.multiplier === 0 ? 0 : 6, Math.round(rawDamage));

  if (attacker.tempBuff?.charges) {
    attacker.tempBuff.charges -= 1;
    if (attacker.tempBuff.charges <= 0) {
      attacker.tempBuff = null;
    }
  }

  defender.currentHp = Math.max(0, defender.currentHp - damage);

  animateField(attackerSideName, "attack");
  animateField(defenderSideName, "damage");

  const attackerName = attackerSideName === "player" ? "Você" : "IA";
  const mvpKey = `${titleCase(attacker.name)} (${attackerSideName === "player" ? "Jogador" : "IA"})`;
  state.damageByAttacker[mvpKey] = (state.damageByAttacker[mvpKey] || 0) + damage;
  addLog(
    `${attackerName} atacou com ${titleCase(attacker.name)} (${titleCase(matchup.attackType)}) e causou ${damage} de dano.`
  );

  if (matchup.multiplier >= 2) {
    setTypeFeedback("Super efetivo!", "strong");
    addLog("Vantagem de tipo detectada (super efetivo). ");
  } else if (matchup.multiplier > 0 && matchup.multiplier < 1) {
    setTypeFeedback("Pouco efetivo.", "weak");
    addLog("Desvantagem de tipo no ataque.");
  } else if (matchup.multiplier === 0) {
    setTypeFeedback("Sem efeito contra o alvo.", "immune");
    addLog("Ataque sem efeito por imunidade de tipo.");
  } else {
    setTypeFeedback("Troca equilibrada.");
  }

  if (defender.currentHp <= 0) {
    addLog(`${titleCase(defender.name)} foi derrotado.`);
    defender.currentHp = 0;
    defenderSide.graveyard.push(defender);
    defenderSide.field = null;
    return { knockedOut: true, attacker, defender, damage };
  }

  return { knockedOut: false, attacker, defender, damage };
}

function checkWinner() {
  const playerAlive = countAlive(state.player);
  const enemyAlive = countAlive(state.enemy);

  if (playerAlive <= 0 && enemyAlive <= 0) {
    return "draw";
  }
  if (enemyAlive <= 0) {
    return "player";
  }
  if (playerAlive <= 0) {
    return "enemy";
  }
  return null;
}

async function handleEncounterVictory() {
  const biome = getBiomeById(state.encounter.biomeId || getCurrentBiomeId());
  const xpTarget = getActiveXpTarget();
  const reward = Math.round((30 + state.encounter.wins * 8) * biome.xpFactor);
  const coinReward = Math.max(14, Math.round((14 + state.encounter.wins * 3) * biome.xpFactor));
  if (xpTarget) {
    await gainCardXp(xpTarget, reward, `vitória em ${biome.label}`);
  }
  grantCoins(coinReward, `vitória em ${biome.label}`);

  state.encounter.wins += 1;
  state.encounter.active = false;
  state.encounter.biomeId = null;
  state.enemy.deck = [];
  state.enemy.hand = [];
  state.enemy.field = null;
  state.enemy.graveyard = [];
  drawToHand(state.player, 1, DIFFICULTY_CONFIG[state.difficulty].handSize);
  addLog(`Encontro vencido em ${biome.label}.`);
  setMapEvent(`Batalha vencida em ${biome.label}. Continue explorando.`);
  setTypeFeedback("Explore o mapa para um novo encontro.");
  if (Math.random() < 0.5) {
    grantRandomHealingItem(`vitória em ${biome.label}`);
  }
  createShopOffers();
  refs.shopNote.textContent = `Novas ofertas disponíveis após vitória em ${biome.label}.`;

  if (state.encounter.wins >= 5) {
    finishGame("player");
    return true;
  }
  return false;
}

function loadMatchHistory() {
  try {
    const raw = localStorage.getItem(MATCH_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistMatchHistory(record) {
  try {
    const existing = loadMatchHistory();
    existing.unshift(record);
    localStorage.setItem(
      MATCH_HISTORY_KEY,
      JSON.stringify(existing.slice(0, MATCH_HISTORY_LIMIT))
    );
  } catch {
    // Ignore storage issues.
  }
}

function clearMatchHistory() {
  try {
    localStorage.removeItem(MATCH_HISTORY_KEY);
  } catch {
    // Ignore storage issues.
  }
}

function computeMvp() {
  const entries = Object.entries(state.damageByAttacker);
  if (!entries.length) {
    return "N/A";
  }

  let bestName = "N/A";
  let bestDamage = -1;
  entries.forEach(([name, damage]) => {
    if (damage > bestDamage) {
      bestName = name;
      bestDamage = damage;
    }
  });

  return `${bestName} (${bestDamage})`;
}

function renderHistory() {
  const history = loadMatchHistory();
  if (!history.length) {
    refs.historySummary.textContent = "Historico: sem partidas registradas.";
    refs.historyList.innerHTML = "";
    return;
  }

  const wins = history.filter((entry) => entry.winner === "player").length;
  const losses = history.filter((entry) => entry.winner === "enemy").length;
  const draws = history.filter((entry) => entry.winner === "draw").length;
  refs.historySummary.textContent = `Historico: ${wins}W / ${losses}L / ${draws}E`;

  refs.historyList.innerHTML = "";
  history.forEach((entry) => {
    const li = document.createElement("li");
    const date = new Date(entry.at).toLocaleString("pt-BR");
    const result =
      entry.winner === "player"
        ? "Vitoria"
        : entry.winner === "enemy"
        ? "Derrota"
        : "Empate";

    li.textContent = `${date} | ${result} | ${entry.durationSec}s | ${entry.turns} turnos | MVP: ${entry.mvp}`;
    refs.historyList.appendChild(li);
  });
}

function persistLastResult(result) {
  try {
    localStorage.setItem(LAST_RESULT_KEY, JSON.stringify(result));
  } catch {
    // Ignore storage issues.
  }
}

function renderLastResult() {
  try {
    const raw = localStorage.getItem(LAST_RESULT_KEY);
    if (!raw) {
      refs.lastResult.textContent = "Nenhum resultado salvo ainda.";
      return;
    }

    const data = JSON.parse(raw);
    const date = new Date(data.at).toLocaleString("pt-BR");
    const label = data.winner === "player" ? "Vitória" : data.winner === "enemy" ? "Derrota" : "Empate";
    refs.lastResult.textContent = `Último resultado: ${label} (${date}) - Dificuldade ${titleCase(data.difficulty)}`;
  } catch {
    refs.lastResult.textContent = "Nenhum resultado salvo ainda.";
  }
}

function finishGame(winner) {
  state.winner = winner;
  state.resolving = false;
  state.encounter.active = false;
  state.encounter.biomeId = null;
  const durationSec = Math.max(
    1,
    Math.round((Date.now() - (state.matchStartAt || Date.now())) / 1000)
  );
  const mvp = computeMvp();

  const title = winner === "player" ? "Vitória" : winner === "enemy" ? "Derrota" : "Empate";
  refs.resultTitle.textContent = title;
  refs.resultSubtitle.textContent =
    winner === "player"
      ? "Você eliminou todas as cartas inimigas."
      : winner === "enemy"
      ? "A IA eliminou suas cartas. Tente outra estratégia."
      : "Ambos os lados ficaram sem cartas ao mesmo tempo.";

  const resultPayload = { winner, difficulty: state.difficulty, at: Date.now() };
  persistLastResult(resultPayload);
  persistMatchHistory({
    ...resultPayload,
    durationSec,
    turns: state.turnCount,
    mvp,
  });
  refs.resultModal.classList.remove("hidden");
  addLog(`Partida encerrada: ${title}. Duracao ${durationSec}s. MVP: ${mvp}.`);
  renderHistory();
  renderLastResult();
  renderAll();
}

async function runBattleTurn() {
  if (
    state.resolving ||
    state.winner ||
    state.pendingEvolution ||
    !state.encounter.active ||
    !ensureFields()
  ) {
    return;
  }

  state.turnCount += 1;
  state.resolving = true;
  state.turn = "enemy";
  renderAll();
  setBattleAnimation(true);

  await wait(220);
  const playerAttackResult = resolveAttack("player", "enemy");
  if (playerAttackResult.attacker && playerAttackResult.damage > 0) {
    const damageXp = Math.max(4, Math.round(playerAttackResult.damage * 0.18));
    await gainCardXp(playerAttackResult.attacker, damageXp, "dano causado");
  }
  if (playerAttackResult.knockedOut && playerAttackResult.attacker) {
    await gainCardXp(playerAttackResult.attacker, 48, "nocaute em batalha");
  }
  renderAll();

  let winner = checkWinner();
  if (winner) {
    setBattleAnimation(false);
    if (winner === "player") {
      const campaignFinished = await handleEncounterVictory();
      if (campaignFinished) {
        return;
      }
    } else {
      finishGame(winner);
      return;
    }
    state.turn = "player";
    state.resolving = false;
    renderAll();
    return;
  }

  if (state.enemy.field && state.player.field) {
    await wait(340);
    resolveAttack("enemy", "player");
    renderAll();
  }

  winner = checkWinner();
  if (winner) {
    setBattleAnimation(false);
    if (winner === "player") {
      const campaignFinished = await handleEncounterVictory();
      if (campaignFinished) {
        return;
      }
    } else {
      finishGame(winner);
      return;
    }
    state.turn = "player";
    state.resolving = false;
    renderAll();
    return;
  }

  const handLimit = DIFFICULTY_CONFIG[state.difficulty].handSize;
  drawToHand(state.player, 1, handLimit);
  drawToHand(state.enemy, 1, handLimit);

  if (!state.enemy.field) {
    autoPlaceEnemyCard();
  }

  state.turn = "player";
  state.resolving = false;
  setBattleAnimation(false);
  renderAll();
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startGame() {
  if (state.status === "loading") {
    return;
  }

  const requiredDeckSize = getDeckSizeForDifficulty(refs.difficulty.value);
  if (state.starterSelectedIds.size !== requiredDeckSize) {
    alert(`Selecione exatamente ${requiredDeckSize} cartas no deck inicial.`);
    return;
  }

  try {
    state.status = "loading";
    state.difficulty = refs.difficulty.value;
    state.deckArchetype = refs.deckArchetype.value;
    state.winner = null;
    state.logs = [];
    state.turnCount = 0;
    state.matchStartAt = Date.now();
    state.damageByAttacker = {};
    state.encounter.active = false;
    state.encounter.biomeId = null;
    state.encounter.wins = 0;
    state.items.potion = 2;
    state.items.superPotion = 1;
    state.items.reviver = 1;
    state.items.battleTonic = 1;
    state.coins = 45;
    state.shop.rerollCost = SHOP_REROLL_BASE_COST;
    state.shop.offers = [];
    state.evolutionQueue = [];
    state.pendingEvolution = null;
    initializeMinimap();
    refs.resultModal.classList.add("hidden");
    refs.evolutionModal.classList.add("hidden");
    refs.shopModal.classList.add("hidden");
    refs.reviverModal.classList.add("hidden");
    showScreen("game");
    setLoading(true, "Montando deck inicial...");

    const config = DIFFICULTY_CONFIG[state.difficulty];
    if (!state.starterPool.length) {
      await prepareStarterPool();
    }
    const playerDeck = getStarterDeckCards(config.deckSize);
    if (playerDeck.length < config.deckSize) {
      throw new Error("Não foi possível montar o deck inicial.");
    }

    setLoading(true, "Calculando relações de tipo...");
    const types = new Set([
      ...playerDeck.flatMap((p) => p.types),
      ...BIOMES.flatMap((biome) => biome.wildTypes),
    ]);
    state.typeChart = await buildTypeChart(types);

    state.player.deck = playerDeck;
    state.enemy.deck = [];
    state.player.hand = [];
    state.enemy.hand = [];
    state.player.field = null;
    state.enemy.field = null;
    state.player.graveyard = [];
    state.enemy.graveyard = [];
    state.turn = "player";
    state.resolving = false;
    state.selectedHandIndex = null;

    drawToHand(state.player, config.handSize, config.handSize);

    addLog(`Partida iniciada na dificuldade ${titleCase(state.difficulty)}.`);
    addLog(`Deck inicial: ${titleCase(state.deckArchetype)}.`);
    addLog("Selecione uma carta da sua mão para colocar no campo.");
    createShopOffers();
    refs.shopNote.textContent = "Loja preparada para a jornada.";
    setTypeFeedback("Explore o mapa para iniciar batalhas.");
    setMapEvent("Exploração ativa: caminhe pelos biomas para encontros aleatórios.");
    renderAll();
  } catch (error) {
    showScreen("start");
    alert(`Erro ao iniciar partida: ${error.message}`);
  } finally {
    state.status = "ready";
    setLoading(false);
  }
}

function resetToStart() {
  state.status = "idle";
  state.winner = null;
  state.resolving = false;
  state.logs = [];
  state.encounter.active = false;
  state.encounter.biomeId = null;
  state.items.potion = 2;
  state.items.superPotion = 1;
  state.items.reviver = 1;
  state.items.battleTonic = 1;
  state.coins = 45;
  state.shop.rerollCost = SHOP_REROLL_BASE_COST;
  state.shop.offers = [];
  state.evolutionQueue = [];
  state.pendingEvolution = null;
  initializeMinimap();
  state.player.graveyard = [];
  state.enemy.graveyard = [];
  refs.resultModal.classList.add("hidden");
  refs.evolutionModal.classList.add("hidden");
  refs.shopModal.classList.add("hidden");
  refs.reviverModal.classList.add("hidden");
  showScreen("start");
  renderLastResult();
  renderHistory();
  renderStarterPool();
  setMapEvent("Movimente-se para encontrar eventos aleatórios por bioma.");
}

refs.startButton.addEventListener("click", startGame);
refs.playAgainButton.addEventListener("click", startGame);
refs.restartButton.addEventListener("click", resetToStart);
refs.attackButton.addEventListener("click", runBattleTurn);
refs.usePotion.addEventListener("click", () => useHealingItem("potion"));
refs.useSuperPotion.addEventListener("click", () => useHealingItem("superPotion"));
refs.useReviver.addEventListener("click", useReviverItem);
refs.useBattleTonic.addEventListener("click", useBattleTonicItem);
refs.openShop.addEventListener("click", focusShopPanel);
refs.closeShop.addEventListener("click", closeShopModal);
refs.buyPotion.addEventListener("click", () => buyShopItem("potion"));
refs.buySuperPotion.addEventListener("click", () => buyShopItem("superPotion"));
refs.buyReviver.addEventListener("click", () => buyShopItem("reviver"));
refs.buyBattleTonic.addEventListener("click", () => buyShopItem("battleTonic"));
refs.closeReviverModal.addEventListener("click", closeReviverModal);
refs.rerollShop.addEventListener("click", rerollShopStock);
refs.refreshDeckOptions.addEventListener("click", prepareStarterPool);
refs.autoFillDeck.addEventListener("click", autoFillStarterDeck);
refs.clearDeckSelection.addEventListener("click", () => {
  state.starterSelectedIds.clear();
  renderStarterPool();
});
refs.deckArchetype.addEventListener("change", () => {
  state.starterSelectedIds.clear();
  state.starterSearch = "";
  state.starterTypeFilter = "all";
  refs.starterSearch.value = "";
  refs.starterTypeFilter.value = "all";
  prepareStarterPool();
});
refs.difficulty.addEventListener("change", () => {
  trimStarterSelection(getDeckSizeForDifficulty(refs.difficulty.value));
  renderStarterPool();
});
refs.starterSearch.addEventListener("input", (event) => {
  state.starterSearch = String(event.target.value || "");
  renderStarterPool();
});
refs.starterTypeFilter.addEventListener("change", (event) => {
  state.starterTypeFilter = String(event.target.value || "all");
  renderStarterPool();
});
refs.moveUp.addEventListener("click", () => moveOnMap(-1, 0));
refs.moveDown.addEventListener("click", () => moveOnMap(1, 0));
refs.moveLeft.addEventListener("click", () => moveOnMap(0, -1));
refs.moveRight.addEventListener("click", () => moveOnMap(0, 1));
refs.howButton.addEventListener("click", () => refs.tutorialModal.classList.remove("hidden"));
refs.closeTutorial.addEventListener("click", () => refs.tutorialModal.classList.add("hidden"));
refs.clearHistory.addEventListener("click", () => {
  clearMatchHistory();
  renderHistory();
});
refs.evolveNowButton.addEventListener("click", async () => {
  if (!state.pendingEvolution || state.resolving) {
    return;
  }
  const { card, nextName } = state.pendingEvolution;
  state.resolving = true;
  renderAll();
  try {
    await applyEvolution(card, nextName);
  } finally {
    state.resolving = false;
    closeEvolutionPrompt();
    renderAll();
  }
});
refs.evolveLaterButton.addEventListener("click", () => {
  if (!state.pendingEvolution) {
    return;
  }
  addLog(
    `${titleCase(state.pendingEvolution.card.name)} aguardará para evoluir no próximo marco de nível.`
  );
  closeEvolutionPrompt();
  renderAll();
});

refs.playerHand.addEventListener("click", (event) => {
  const card = event.target.closest(".card");
  if (!card) {
    return;
  }
  const index = Number(card.dataset.index);
  if (Number.isNaN(index)) {
    return;
  }

  if (state.player.field) {
    state.selectedHandIndex = index;
    renderHands();
    addLog("Você já tem uma carta em campo. Ataque para continuar.");
    return;
  }

  placePlayerCard(index);
});

refs.starterCardPool.addEventListener("click", (event) => {
  const cardNode = event.target.closest(".starter-card");
  if (!cardNode) {
    return;
  }
  const cardId = Number(cardNode.dataset.cardId);
  if (Number.isNaN(cardId)) {
    return;
  }

  const maxSize = getDeckSizeForDifficulty(refs.difficulty.value);
  if (state.starterSelectedIds.has(cardId)) {
    state.starterSelectedIds.delete(cardId);
    renderStarterPool();
    return;
  }

  if (state.starterSelectedIds.size >= maxSize) {
    refs.deckValidation.classList.add("deck-validation-error");
    refs.deckValidation.textContent = `Limite de ${maxSize} cartas atingido.`;
    return;
  }
  state.starterSelectedIds.add(cardId);
  renderStarterPool();
});

refs.reviverList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-reviver-index]");
  if (!button) {
    return;
  }
  const index = Number(button.dataset.reviverIndex);
  if (Number.isNaN(index)) {
    return;
  }
  reviveFromGraveyard(index);
});

refs.shopStock.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-offer-key]");
  if (!button) {
    return;
  }
  const offerKey = String(button.dataset.offerKey || "");
  if (!offerKey) {
    return;
  }
  buyShopItem(offerKey);
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    refs.tutorialModal.classList.add("hidden");
    refs.shopModal.classList.add("hidden");
    refs.reviverModal.classList.add("hidden");
    return;
  }

  if (!refs.gameScreen.classList.contains("active")) {
    return;
  }

  const key = event.key.toLowerCase();
  if (key === "arrowup" || key === "w") {
    event.preventDefault();
    moveOnMap(-1, 0);
  } else if (key === "arrowdown" || key === "s") {
    event.preventDefault();
    moveOnMap(1, 0);
  } else if (key === "arrowleft" || key === "a") {
    event.preventDefault();
    moveOnMap(0, -1);
  } else if (key === "arrowright" || key === "d") {
    event.preventDefault();
    moveOnMap(0, 1);
  }
});

renderLastResult();
renderHistory();
initializeMinimap();
prepareStarterPool();
showScreen("start");
setTypeFeedback("Aguardando início.");
setMapEvent("Movimente-se para encontrar eventos aleatórios por bioma.");
renderLog();
