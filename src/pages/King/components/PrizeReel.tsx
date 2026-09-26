import classNames from 'classnames';
import { useState, type CSSProperties } from 'react';

import styles from './PrizeReel.module.scss';

const PRIZES = [
  { title: '🏠 Квартира в центре Москвы' },
  { title: '🚗 Автомобиль BMW' },
  { title: '🏅 Значок победителя', note: 'на аватарку на всю следующую игру' },
];

// A few slow turns that end on the badge, plus one prize below it so the window is full when it stops.
const TURNS = 3;
const REEL = [...Array.from({ length: TURNS }, () => PRIZES).flat(), PRIZES[0]];
const STOP = TURNS * PRIZES.length - 1;

// A lottery-style reel that spins for 3 seconds and lands on the winner's badge in the middle row.
export function PrizeReel() {
  const [stopped, setStopped] = useState(false);

  return (
    <div className={styles.prize}>
      <div className={classNames(styles.window, { [styles.stopped]: stopped })}>
        <div className={styles.line} />
        <div
          className={styles.reel}
          style={{ '--stop': STOP } as CSSProperties}
          onAnimationEnd={() => setStopped(true)}
        >
          {REEL.map((prize, i) => (
            <div
              key={i}
              className={styles.item}
            >
              {prize.title}
              {prize.note && <span className={styles.note}>{prize.note}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
