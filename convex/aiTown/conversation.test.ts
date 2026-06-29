import { Conversation } from './conversation';
import { Player } from './player';
import { allocGameId } from './ids';
import { playerInputs } from './player';

function makePlayer(idNumber: number, x: number, y: number) {
  return new Player({
    id: allocGameId('players', idNumber),
    human: `human-${idNumber}`,
    lastInput: 0,
    position: { x, y },
    facing: { dx: 0, dy: 1 },
    speed: 0,
  });
}

function makeConversation(player1: Player, player2: Player) {
  return new Conversation({
    id: allocGameId('conversations', 0),
    creator: player1.id,
    created: 0,
    numMessages: 0,
    participants: [
      { playerId: player1.id, invited: 0, status: { kind: 'walkingOver' } },
      { playerId: player2.id, invited: 0, status: { kind: 'walkingOver' } },
    ],
  });
}

function makeGame(player1: Player, player2: Player, conversation: Conversation) {
  return {
    world: {
      players: new Map([
        [player1.id, player1],
        [player2.id, player2],
      ]),
      conversations: new Map([[conversation.id, conversation]]),
      agents: new Map(),
      playerConversation(player: Player) {
        return [...this.conversations.values()].find((c) => c.participants.has(player.id));
      },
    },
    worldMap: {
      width: 12,
      height: 12,
      objectTiles: [
        Array.from({ length: 12 }, () => Array.from({ length: 12 }, () => -1)),
      ],
    },
  } as any;
}

describe('Conversation walkingOver', () => {
  test('starts participating when accepted players are already nearby', () => {
    const player1 = makePlayer(0, 1, 1);
    const player2 = makePlayer(1, 2, 1);
    const conversation = makeConversation(player1, player2);

    conversation.tick(makeGame(player1, player2, conversation), 1000);

    expect(conversation.participants.get(player1.id)?.status.kind).toBe('participating');
    expect(conversation.participants.get(player2.id)?.status.kind).toBe('participating');
  });

  test('keeps accepted human players walking toward each other when they are not nearby yet', () => {
    const player1 = makePlayer(0, 1, 1);
    const player2 = makePlayer(1, 8, 1);
    const conversation = makeConversation(player1, player2);

    conversation.tick(makeGame(player1, player2, conversation), 1000);

    expect(conversation.participants.get(player1.id)?.status.kind).toBe('walkingOver');
    expect(conversation.participants.get(player2.id)?.status.kind).toBe('walkingOver');
    expect(player1.pathfinding?.state.kind).toBe('needsPath');
    expect(player2.pathfinding?.state.kind).toBe('needsPath');
  });

  test('lets player movement leave an active conversation before walking', () => {
    const player1 = makePlayer(0, 1, 1);
    const player2 = makePlayer(1, 2, 1);
    const conversation = makeConversation(player1, player2);
    const game = makeGame(player1, player2, conversation);
    conversation.tick(game, 1000);

    playerInputs.moveTo.handler(game, 1100, {
      playerId: player1.id,
      destination: { x: 4, y: 1 },
    });

    expect(game.world.conversations.size).toBe(0);
    expect(player1.pathfinding?.destination).toEqual({ x: 4, y: 1 });
    expect(player1.pathfinding?.state.kind).toBe('needsPath');
  });
});
