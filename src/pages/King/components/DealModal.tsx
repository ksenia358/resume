import { Alert, Flex, InputNumber, Modal, Typography } from 'antd';
import { useState } from 'react';

import {
  categories,
  categoryTotal,
  dealCategories,
  dealPoints,
  isDealComplete,
  type DealCounts,
  type Game,
} from '../rules';
import styles from '../King.module.scss';

const { Text } = Typography;

type Props = {
  game: Game;
  number: number;
  dealer: string;
  players: string[];
  initialCounts: DealCounts | null;
  onSave: (counts: DealCounts) => void;
  onClose: () => void;
};

export function DealModal({ game, number, dealer, players, initialCounts, onSave, onClose }: Props) {
  const [counts, setCounts] = useState<DealCounts>(() => initialCounts ?? players.map(() => ({})));
  const shownCategories = dealCategories(game);
  const points = dealPoints(game, counts);
  const complete = isDealComplete(game, counts);

  const setCount = (player: number, category: keyof typeof categories, value: number | null) =>
    setCounts((current) => current.map((taken, i) => (i === player ? { ...taken, [category]: value ?? 0 } : taken)));

  return (
    <Modal
      open
      title={`${number}. ${game.name}`}
      okText="Сохранить"
      cancelText="Отмена"
      okButtonProps={{ disabled: !complete }}
      onOk={() => onSave(counts)}
      onCancel={onClose}
    >
      <Text type="secondary">
        {game.hint}. Сдаёт {dealer}.
      </Text>

      <table className={styles.dealTable}>
        <thead>
          <tr>
            <th />
            {players.map((player, i) => (
              <th key={i}>
                <span className={styles.dealPlayer}>{player}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shownCategories.map((category) => {
            const left =
              categoryTotal(category, players.length) - counts.reduce((sum, taken) => sum + (taken[category] ?? 0), 0);
            return (
              <tr key={category}>
                <td className={styles.dealCategory}>
                  {categories[category].label}
                  <Text
                    type={left === 0 ? 'success' : 'danger'}
                    className={styles.left}
                  >
                    {left === 0 ? 'всё' : `ещё ${left}`}
                  </Text>
                </td>
                {players.map((_, i) => (
                  <td key={i}>
                    <InputNumber
                      min={0}
                      max={categoryTotal(category, players.length)}
                      precision={0}
                      inputMode="numeric"
                      controls={false}
                      value={counts[i][category] ?? 0}
                      onChange={(value) => setCount(i, category, value)}
                      onFocus={(event) => event.target.select()}
                      className={styles.countInput}
                    />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td className={styles.dealCategory}>Очки</td>
            {points.map((value, i) => (
              <td
                key={i}
                className={styles.dealPoints}
              >
                {value}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>

      {!complete && (
        <Flex className={styles.dealAlert}>
          <Alert
            type="info"
            showIcon
            title="Распредели все карты и взятки, чтобы сохранить раздачу"
          />
        </Flex>
      )}
    </Modal>
  );
}
