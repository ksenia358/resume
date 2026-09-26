import { DownOutlined, UpOutlined } from '@ant-design/icons';
import { Button, Card, Checkbox, Flex, Popconfirm, Segmented, Table, Typography } from 'antd';
import classNames from 'classnames';
import { useState } from 'react';

import { ThemeToggle } from '../../shared/components/ThemeToggle';
import { CardFan } from './components/CardFan';
import { DealModal } from './components/DealModal';
import { dealCards, dealPoints, deals, MAX_PLAYERS, PLAYER_COUNTS, removedCards } from './rules';
import { PokerTable } from './components/PokerTable';
import { PrizeReel } from './components/PrizeReel';
import { useKingGame } from './useKingGame';
import styles from './King.module.scss';

const { Text } = Typography;

export function KingPage() {
  const { game, champions, start, saveDeal, reset } = useKingGame();
  const [names, setNames] = useState<string[]>(() =>
    Array.from({ length: MAX_PLAYERS }, (_, i) => game?.players[i] ?? ''),
  );
  const [playerCount, setPlayerCount] = useState(game?.players.length ?? MAX_PLAYERS);
  const [hideScores, setHideScores] = useState(game?.hideScores ?? false);
  const [openDeal, setOpenDeal] = useState<number | null>(null);

  const points = game ? game.results.map((counts, i) => (counts ? dealPoints(deals[i], counts) : null)) : [];
  const totals = game
    ? game.players.map((_, player) => points.reduce((sum, deal) => sum + (deal?.[player] ?? 0), 0))
    : [];
  const nextDeal = game ? game.results.findIndex((counts) => !counts) : -1;
  const finished = Boolean(game) && nextDeal === -1;
  const winners = finished ? totals.flatMap((total, i) => (total === Math.max(...totals) ? [i] : [])) : [];

  return (
    <>
      <title>Кинг — подсчёт очков</title>
      <ThemeToggle />
      <Flex
        vertical
        className={styles.page}
      >
        {game ? (
          <PokerTable
            names={game.players}
            scores={totals}
            showScores={finished || !game.hideScores}
            dealer={finished ? undefined : nextDeal % game.players.length}
            winners={winners}
            champions={champions}
          >
            {finished ? (
              <>
                <div className={styles.dealNumber}>Игра окончена</div>
                <div className={styles.dealHint}>{winners.length > 1 ? 'Победили' : 'Победа'}</div>
                <div className={styles.winner}>👑 {winners.map((i) => game.players[i]).join(', ')}</div>
                <div className={styles.dealHint}>Приз победителю:</div>
                <PrizeReel />
              </>
            ) : (
              <>
                <div className={styles.dealNumber}>
                  Раздача {nextDeal + 1} из {deals.length}
                </div>
                <div className={styles.dealName}>{deals[nextDeal].name}</div>
                {dealCards(deals[nextDeal], game.players.length) ? (
                  <CardFan cards={dealCards(deals[nextDeal], game.players.length)!} />
                ) : (
                  <div className={styles.dealHint}>{deals[nextDeal].hint}</div>
                )}
                <Button
                  type="primary"
                  size="large"
                  className={styles.tableButton}
                  onClick={() => setOpenDeal(nextDeal)}
                >
                  Записать
                </Button>
              </>
            )}
          </PokerTable>
        ) : (
          <PokerTable
            names={names.slice(0, playerCount)}
            champions={champions}
            onNameChange={(index, name) => setNames(names.map((current, i) => (i === index ? name : current)))}
          >
            <div className={styles.suits}>♠ ♥ ♦ ♣</div>
            <div className={styles.tableTitle}>Кинг</div>
            <Segmented
              className={styles.playerCount}
              value={playerCount}
              onChange={setPlayerCount}
              options={PLAYER_COUNTS.map((count) => ({ value: count, label: `${count} игрока` }))}
            />
            <div>
              <Checkbox
                className={styles.hideScores}
                checked={hideScores}
                onChange={(event) => setHideScores(event.target.checked)}
              >
                Скрывать результаты
              </Checkbox>
            </div>
            <div className={styles.dealHint}>Уберите из колоды</div>
            <CardFan cards={removedCards(playerCount)} />
            <Button
              type="primary"
              size="large"
              className={styles.tableButton}
              onClick={() =>
                start(
                  names.slice(0, playerCount).map((name, i) => name.trim() || `Игрок ${i + 1}`),
                  deals.length,
                  hideScores,
                )
              }
            >
              Начать игру
            </Button>
          </PokerTable>
        )}

        {game && (
          <Card className={styles.card}>
            <Scores
              players={game.players}
              points={points}
              totals={totals}
              nextDeal={nextDeal}
              winners={winners}
              onOpenDeal={setOpenDeal}
              onReset={() => {
                setNames(names.map((name, i) => game.players[i] ?? name));
                setPlayerCount(game.players.length);
                reset(finished ? winners.map((i) => game.players[i]) : undefined);
              }}
            />
          </Card>
        )}
      </Flex>

      {game && openDeal !== null && (
        <DealModal
          game={deals[openDeal]}
          number={openDeal + 1}
          dealer={game.players[openDeal % game.players.length]}
          players={game.players}
          initialCounts={game.results[openDeal]}
          onSave={(counts) => {
            saveDeal(openDeal, counts);
            setOpenDeal(null);
          }}
          onClose={() => setOpenDeal(null)}
        />
      )}
    </>
  );
}

type ScoresProps = {
  players: string[];
  points: (number[] | null)[];
  totals: number[];
  nextDeal: number;
  winners: number[];
  onOpenDeal: (index: number) => void;
  onReset: () => void;
};

function Scores({ players, points, totals, nextDeal, winners, onOpenDeal, onReset }: ScoresProps) {
  const [expanded, setExpanded] = useState(false);
  const rows = deals.map((game, i) => ({ key: i, game, points: points[i] }));

  return (
    <Flex
      vertical
      gap="middle"
    >
      <Button
        icon={expanded ? <UpOutlined /> : <DownOutlined />}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? 'Скрыть таблицу' : 'Показать таблицу'}
      </Button>

      {expanded && <Text type="secondary">Все раздачи. Нажми на сыгранную, чтобы исправить.</Text>}

      {expanded && (
        <Table
          className={styles.scores}
          size="small"
          pagination={false}
          dataSource={rows}
          rowClassName={(row) =>
            classNames(styles.dealRow, { [styles.currentDeal]: row.key === nextDeal, [styles.pending]: !row.points })
          }
          onRow={(row) => ({ onClick: () => onOpenDeal(row.key) })}
          columns={[
            {
              title: 'Раздача',
              key: 'game',
              render: (_, row) => (
                <Flex
                  vertical
                  className={styles.dealCell}
                >
                  <Text>
                    {row.key + 1}. {row.game.short}
                  </Text>
                  <Text
                    type="secondary"
                    className={styles.dealer}
                  >
                    сдаёт {players[row.key % players.length]}
                  </Text>
                </Flex>
              ),
            },
            ...players.map((player, i) => ({
              title: <span className={styles.playerName}>{player}</span>,
              key: i,
              align: 'right' as const,
              render: (_: unknown, row: (typeof rows)[number]) => row.points?.[i] ?? '',
            })),
          ]}
          summary={() => (
            <Table.Summary>
              <Table.Summary.Row className={styles.totals}>
                <Table.Summary.Cell index={0}>Итого</Table.Summary.Cell>
                {totals.map((total, i) => (
                  <Table.Summary.Cell
                    key={i}
                    index={i + 1}
                    align="right"
                  >
                    {winners.includes(i) ? `👑 ${total}` : total}
                  </Table.Summary.Cell>
                ))}
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      )}

      <Popconfirm
        title="Начать новую игру?"
        description="Текущий счёт сотрётся."
        okText="Да"
        cancelText="Нет"
        onConfirm={onReset}
      >
        <Button danger>Новая игра</Button>
      </Popconfirm>
    </Flex>
  );
}
