// King for 4 players with a 32-card deck, or for 3 without the 7♠ and 7♣ (10 cards each).
// "Don't take" deals come first, then the same ones as "take" with the sign flipped.
// Both halves are worth the same, so correct totals always sum to zero.

// Eralash (all penalties in one deal) is left out of the game for now.
const WITH_ERALASH = false;

export const PLAYER_COUNTS = [3, 4];
export const MAX_PLAYERS = 4;

export type Category = 'tricks' | 'hearts' | 'boys' | 'queens' | 'lastTwo' | 'king';

export const categories: Record<Category, { label: string; total: number }> = {
  tricks: { label: 'Взятки', total: 8 },
  hearts: { label: 'Черви', total: 8 },
  // Boys are the kings, so the king of hearts is also a boy in Eralash.
  boys: { label: 'Мальчики', total: 4 },
  queens: { label: 'Девочки', total: 4 },
  lastTwo: { label: 'Последние', total: 2 },
  king: { label: 'Кинг', total: 1 },
};

// How many cards or tricks of a category a deal has: only the number of tricks depends on the players.
export function categoryTotal(category: Category, playerCount: number): number {
  return category === 'tricks' ? (playerCount === 3 ? 10 : 8) : categories[category].total;
}

export type Game = {
  name: string;
  // Fits the score table on a phone.
  short: string;
  hint: string;
  // Penalty cards drawn on the table, like '7♥' or 'Q♠'; deals about tricks show face-down cards instead.
  cards?: string[];
  // Points for each card or trick of a category.
  points: Partial<Record<Category, number>>;
};

const eralash: Game = {
  name: 'Ералаш',
  short: 'Ералаш',
  hint: 'Все штрафы сразу',
  points: { tricks: -2, hearts: -2, boys: -4, queens: -4, lastTwo: -8, king: -16 },
};

const ranks = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const suits = ['♠', '♥', '♦', '♣'];

export const CARD_BACK = 'back';

// What to draw on the table for a deal: its cards, or one face-down trick, or the two last tricks' cards.
export function dealCards(game: Game, playerCount: number): string[] | undefined {
  const [category, ...others] = dealCategories(game);
  if (game.cards || others.length) {
    return game.cards;
  }
  return Array.from({ length: category === 'lastTwo' ? 2 : playerCount }, () => CARD_BACK);
}

// Cards taken out of a 36-card deck before the game.
export function removedCards(playerCount: number): string[] {
  const sixes = suits.map((suit) => '6' + suit);
  return playerCount === 3 ? [...sixes, '7♠', '7♣'] : sixes;
}

const dontTake: Game[] = [
  { name: 'Не брать взяток', short: 'Взятки', hint: '−2 за взятку', points: { tricks: -2 } },
  {
    name: 'Не брать червей',
    short: 'Черви',
    hint: '−2 за черву',
    cards: ranks.map((rank) => rank + '♥'),
    points: { hearts: -2 },
  },
  {
    name: 'Не брать мальчиков',
    short: 'Мальчики',
    hint: '−4 за короля',
    cards: suits.map((suit) => 'K' + suit),
    points: { boys: -4 },
  },
  {
    name: 'Не брать девочек',
    short: 'Девочки',
    hint: '−4 за даму',
    cards: suits.map((suit) => 'Q' + suit),
    points: { queens: -4 },
  },
  { name: 'Не брать две последние', short: 'Последние', hint: '−8 за взятку', points: { lastTwo: -8 } },
  { name: 'Не брать кинга', short: 'Кинг', hint: '−16 за короля червей', cards: ['K♥'], points: { king: -16 } },
  ...(WITH_ERALASH ? [eralash] : []),
];

// Where "Не брать X" doesn't simply turn into "Брать X".
const takeNames: Record<string, string> = {
  'Не брать взяток': 'Брать взятки',
  'Не брать червей': 'Брать черви',
  Ералаш: 'Ералаш — брать всё',
};

const take: Game[] = dontTake.map((game) => ({
  ...game,
  name: takeNames[game.name] ?? game.name.replace('Не брать', 'Брать'),
  short: '+ ' + game.short,
  hint: game.name === 'Ералаш' ? 'Все очки сразу' : game.hint.replace('−', '+'),
  points: Object.fromEntries(Object.entries(game.points).map(([category, points]) => [category, -points])),
}));

export const deals: Game[] = [...dontTake, ...take];

// What each player took in a deal: counts[player][category].
export type DealCounts = Partial<Record<Category, number>>[];

export function dealCategories(game: Game): Category[] {
  return Object.keys(game.points) as Category[];
}

export function dealPoints(game: Game, counts: DealCounts): number[] {
  return counts.map((taken) =>
    dealCategories(game).reduce((sum, category) => sum + (taken[category] ?? 0) * game.points[category]!, 0),
  );
}

export function isDealComplete(game: Game, counts: DealCounts): boolean {
  return dealCategories(game).every(
    (category) =>
      counts.reduce((sum, taken) => sum + (taken[category] ?? 0), 0) === categoryTotal(category, counts.length),
  );
}
