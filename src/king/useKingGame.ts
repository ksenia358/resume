import { useEffect, useState } from 'react';

import { deals, type DealCounts } from './rules';

const STORAGE_KEY = 'king-game';
// Names of the last game's winners: they wear the winner's badge through the next game.
const CHAMPIONS_KEY = 'king-champions';

export type KingGame = {
  players: string[];
  // Saved deals by index in `deals`; unplayed ones are null.
  results: (DealCounts | null)[];
};

function loadGame(): KingGame | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const game = stored ? (JSON.parse(stored) as KingGame) : null;
    // A game saved under other rules can't be shown against the current deals.
    return game?.results.length === deals.length ? game : null;
  } catch {
    return null;
  }
}

function loadChampions(): string[] {
  try {
    return JSON.parse(localStorage.getItem(CHAMPIONS_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

// The game lives in the browser, so a reload or a closed tab doesn't lose the score.
export function useKingGame() {
  const [game, setGame] = useState<KingGame | null>(loadGame);
  const [champions, setChampions] = useState<string[]>(loadChampions);

  useEffect(() => {
    try {
      if (game) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Private mode or blocked storage: the game still works until the tab is closed.
    }
  }, [game]);

  useEffect(() => {
    try {
      localStorage.setItem(CHAMPIONS_KEY, JSON.stringify(champions));
    } catch {
      // Same as above: the badge just won't survive a reload.
    }
  }, [champions]);

  return {
    game,
    champions,
    start: (players: string[], dealCount: number) =>
      setGame({ players, results: Array.from({ length: dealCount }, () => null) }),
    saveDeal: (index: number, counts: DealCounts) =>
      setGame(
        (current) =>
          current && { ...current, results: current.results.map((result, i) => (i === index ? counts : result)) },
      ),
    // Winners of a finished game take the badge; leaving a game halfway keeps the old one.
    reset: (winners?: string[]) => {
      if (winners) {
        setChampions(winners);
      }
      setGame(null);
    },
  };
}
