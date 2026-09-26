import classNames from 'classnames';

import { CARD_BACK } from '../rules';
import styles from './CardFan.module.scss';

// Cards like '10♥' (or face-down ones) fanned out as if held in a hand.
export function CardFan({ cards }: { cards: string[] }) {
  const spread = Math.min(6, 30 / cards.length);

  return (
    <div className={styles.fan}>
      {cards.map((card, i) => {
        const style = { transform: `rotate(${(i - (cards.length - 1) / 2) * spread}deg)` };
        if (card === CARD_BACK) {
          return (
            <div
              key={i}
              className={classNames(styles.card, styles.back)}
              style={style}
            />
          );
        }

        const suit = card.slice(-1);
        const rank = card.slice(0, -1);
        return (
          <div
            key={card}
            className={classNames(styles.card, { [styles.red]: suit === '♥' || suit === '♦' })}
            style={style}
          >
            <span className={styles.corner}>
              {rank}
              <br />
              {suit}
            </span>
            <span className={styles.suit}>{suit}</span>
          </div>
        );
      })}
    </div>
  );
}
