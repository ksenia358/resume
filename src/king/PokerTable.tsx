import { Input } from 'antd';
import classNames from 'classnames';
import type { ReactNode } from 'react';

import styles from './PokerTable.module.scss';

// Clockwise from the bottom, so the deal goes round the table the way it does in real life.
const seatPositions: Record<number, string[]> = {
  3: ['bottom', 'left', 'right'],
  4: ['bottom', 'left', 'top', 'right'],
};

type Props = {
  names: string[];
  // Without scores the seats are name inputs: the game hasn't started yet.
  scores?: number[];
  onNameChange?: (index: number, name: string) => void;
  dealer?: number;
  winners?: number[];
  // Names that won the previous game and wear the badge.
  champions?: string[];
  children: ReactNode;
};

export function PokerTable({ names, scores, onNameChange, dealer, winners = [], champions = [], children }: Props) {
  return (
    <div className={styles.wrap}>
      <div className={styles.rim}>
        <div className={styles.felt}>
          <div className={styles.center}>{children}</div>
        </div>
      </div>

      {names.map((name, i) => (
        <div
          key={i}
          className={classNames(styles.seat, styles[seatPositions[names.length][i]])}
        >
          <div className={classNames(styles.avatar, styles[`player${i}`])}>
            {winners.includes(i) ? '👑' : (name.trim()[0] ?? i + 1)}
            {dealer === i && <span className={styles.dealerChip}>D</span>}
            {name.trim() && champions.includes(name.trim()) && (
              <span
                className={styles.championBadge}
                title="Победитель прошлой игры"
              >
                🏅
              </span>
            )}
          </div>
          {scores ? (
            <>
              <div className={styles.name}>{name}</div>
              <div className={classNames(styles.score, { [styles.negative]: scores[i] < 0 })}>{scores[i]}</div>
            </>
          ) : (
            <Input
              size="small"
              placeholder={`Игрок ${i + 1}`}
              value={name}
              onChange={(event) => onNameChange?.(i, event.target.value)}
              className={styles.nameInput}
            />
          )}
        </div>
      ))}
    </div>
  );
}
