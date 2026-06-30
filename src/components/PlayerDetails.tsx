import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import closeImg from '../../assets/close.svg';
import { SelectElement } from './Player';
import { Messages } from './Messages';
import { toastOnError } from '../toasts';
import { useSendInput } from '../hooks/sendInput';
import { Player } from '../../convex/aiTown/player';
import { GameId } from '../../convex/aiTown/ids';
import { ServerGame } from '../hooks/serverGame';

const actionButtonClass =
  'mt-4 inline-block align-top button text-white shadow-solid text-base sm:text-lg cursor-pointer pointer-events-auto';
const actionButtonInnerClass =
  'inline-flex min-h-8 items-center justify-center bg-clay-700 px-3 py-1 text-center leading-none';

export default function PlayerDetails({
  worldId,
  engineId,
  game,
  userId,
  playerId,
  setSelectedElement,
  scrollViewRef,
}: {
  worldId: Id<'worlds'>;
  engineId: Id<'engines'>;
  game: ServerGame;
  userId: string;
  playerId?: GameId<'players'>;
  setSelectedElement: SelectElement;
  scrollViewRef: React.RefObject<HTMLDivElement>;
}) {
  const humanTokenIdentifier = useQuery(api.world.userStatus, { worldId, userId });

  const players = [...game.world.players.values()];
  const humanPlayer = players.find((p) => p.human === humanTokenIdentifier);
  const humanConversation = humanPlayer ? game.world.playerConversation(humanPlayer) : undefined;

  const player = playerId && game.world.players.get(playerId);
  const playerConversation = player && game.world.playerConversation(player);

  const previousConversation = useQuery(
    api.world.previousConversation,
    playerId ? { worldId, playerId } : 'skip',
  );

  const playerDescription = playerId && game.playerDescriptions.get(playerId);

  const startConversation = useSendInput(engineId, 'startConversation');
  const acceptInvite = useSendInput(engineId, 'acceptInvite');
  const rejectInvite = useSendInput(engineId, 'rejectInvite');
  const leaveConversation = useSendInput(engineId, 'leaveConversation');

  if (!playerId) {
    return (
      <div className="h-full text-xl flex text-center items-center p-4">
        Click on an agent on the map to see chat history.
      </div>
    );
  }
  if (!player) {
    return null;
  }
  const isMe = humanPlayer && player.id === humanPlayer.id;
  const canInvite = !isMe && !playerConversation && humanPlayer && !humanConversation;
  const sameConversation =
    !isMe &&
    humanPlayer &&
    humanConversation &&
    playerConversation &&
    humanConversation.id === playerConversation.id;

  const humanStatus =
    humanPlayer && humanConversation && humanConversation.participants.get(humanPlayer.id)?.status;
  const playerStatus = playerConversation && playerConversation.participants.get(playerId)?.status;

  const haveInvite = sameConversation && humanStatus?.kind === 'invited';
  const waitingForAccept =
    sameConversation && playerConversation.participants.get(playerId)?.status.kind === 'invited';
  const waitingForNearby =
    sameConversation && playerStatus?.kind === 'walkingOver' && humanStatus?.kind === 'walkingOver';

  const inConversationWithMe =
    sameConversation &&
    playerStatus?.kind === 'participating' &&
    humanStatus?.kind === 'participating';
  const isHuman = !!player.human;
  const displayName = playerDescription?.name ?? '居民';
  const isTalking = !!playerConversation;
  const detailTag = isMe ? '你' : isHuman ? '真人玩家' : 'AI 居民';
  const statusText = isMe
    ? isTalking
      ? '你正在一段对话里。想继续探索时，可以先离开对话。'
      : '你正在沙城里漫步。靠近作品、空间或其他居民，就会出现可互动的入口。'
    : isHuman
      ? isTalking
        ? inConversationWithMe
          ? '你们正在面对面聊天。'
          : '对方正在和别人交谈，稍后再打招呼会更自然。'
        : '对方也在沙城现场。可以点地图靠近，或直接发起一次对话。'
      : isTalking
        ? inConversationWithMe
          ? '这位 AI 居民正在和你对话。'
          : '这位 AI 居民正在交谈中。'
        : '这位 AI 居民正在沙城里游荡，随时可以被叫住。';
  const detailText = isMe
    ? '这是你在这座沙城里的化身。这里不需要自我介绍，重要的是你接下来要去哪里、和谁相遇、想留下什么。'
    : isHuman
      ? `${displayName} 和你一样，是正在这座沙城里移动的真人玩家。你看到的是对方此刻在场的化身，不是系统身份档案。`
      : playerDescription?.description;

  const onStartConversation = async () => {
    if (!humanPlayer || !playerId) {
      return;
    }
    console.log(`Starting conversation`);
    await toastOnError(startConversation({ playerId: humanPlayer.id, invitee: playerId }));
  };
  const onAcceptInvite = async () => {
    if (!humanPlayer || !humanConversation || !playerId) {
      return;
    }
    await toastOnError(
      acceptInvite({
        playerId: humanPlayer.id,
        conversationId: humanConversation.id,
      }),
    );
  };
  const onRejectInvite = async () => {
    if (!humanPlayer || !humanConversation) {
      return;
    }
    await toastOnError(
      rejectInvite({
        playerId: humanPlayer.id,
        conversationId: humanConversation.id,
      }),
    );
  };
  const onLeaveConversation = async () => {
    if (!humanPlayer || !inConversationWithMe || !humanConversation) {
      return;
    }
    await toastOnError(
      leaveConversation({
        playerId: humanPlayer.id,
        conversationId: humanConversation.id,
      }),
    );
  };
  // const pendingSuffix = (inputName: string) =>
  //   [...inflightInputs.values()].find((i) => i.name === inputName) ? ' opacity-50' : '';

  const pendingSuffix = (s: string) => '';
  return (
    <>
      <div className="flex gap-4">
        <div className="box w-3/4 sm:w-full mr-auto">
          <div className="bg-[#e3d2ad] p-3 shadow-solid text-center">
            <div className="mb-1 text-[10px] font-bold tracking-[0.22em] text-[#9c4b34]">
              {detailTag}
            </div>
            <h2 className="font-display text-2xl tracking-wider sm:text-4xl">{displayName}</h2>
          </div>
        </div>
        <a
          className="button text-white shadow-solid text-2xl cursor-pointer pointer-events-auto"
          onClick={() => setSelectedElement(undefined)}
        >
          <h2 className="h-full bg-clay-700">
            <img className="w-4 h-4 sm:w-5 sm:h-5" src={closeImg} />
          </h2>
        </a>
      </div>
      {canInvite && (
        <a
          className={actionButtonClass + pendingSuffix('startConversation')}
          onClick={onStartConversation}
        >
          <div className={actionButtonInnerClass}>
            <span>{isHuman ? '打个招呼' : '发起对话'}</span>
          </div>
        </a>
      )}
      {waitingForAccept && (
        <a className={`${actionButtonClass} opacity-50`}>
          <div className={actionButtonInnerClass}>
            <span>等待对方接受…</span>
          </div>
        </a>
      )}
      {waitingForNearby && (
        <a className={`${actionButtonClass} opacity-50`}>
          <div className={actionButtonInnerClass}>
            <span>正在走过来…</span>
          </div>
        </a>
      )}
      {inConversationWithMe && (
        <a
          className={actionButtonClass + pendingSuffix('leaveConversation')}
          onClick={onLeaveConversation}
        >
          <div className={actionButtonInnerClass}>
            <span>离开对话</span>
          </div>
        </a>
      )}
      {haveInvite && (
        <>
          <a
            className={actionButtonClass + pendingSuffix('acceptInvite')}
            onClick={onAcceptInvite}
          >
            <div className={actionButtonInnerClass}>
              <span>接受</span>
            </div>
          </a>
          <a
            className={actionButtonClass + pendingSuffix('rejectInvite')}
            onClick={onRejectInvite}
          >
            <div className={actionButtonInnerClass}>
              <span>拒绝</span>
            </div>
          </a>
        </>
      )}
      {!playerConversation && player.activity && player.activity.until > Date.now() && (
        <div className="box flex-grow mt-6">
          <h2 className="bg-[#e3d2ad] text-base sm:text-lg text-center">
            {player.activity.description}
          </h2>
        </div>
      )}
      <div className="desc my-6">
        <p className="leading-tight -m-4 bg-[#e3d2ad] text-base sm:text-sm">
          <span className="block font-semibold text-[#9c4b34]">{statusText}</span>
          {detailText && <span className="mt-3 block">{detailText}</span>}
        </p>
      </div>
      {!isMe && playerConversation && playerStatus?.kind === 'participating' && (
        <Messages
          worldId={worldId}
          engineId={engineId}
          inConversationWithMe={inConversationWithMe ?? false}
          conversation={{ kind: 'active', doc: playerConversation }}
          humanPlayer={humanPlayer}
          userId={userId}
          scrollViewRef={scrollViewRef}
        />
      )}
      {!playerConversation && previousConversation && (
        <>
          <div className="box flex-grow">
            <h2 className="bg-[#e3d2ad] text-lg text-center">上一次对话</h2>
          </div>
          <Messages
            worldId={worldId}
            engineId={engineId}
            inConversationWithMe={false}
            conversation={{ kind: 'archived', doc: previousConversation }}
            humanPlayer={humanPlayer}
            userId={userId}
            scrollViewRef={scrollViewRef}
          />
        </>
      )}
    </>
  );
}
