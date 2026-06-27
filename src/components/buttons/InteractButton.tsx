import DeckButton from './DeckButton';
import { JoinIcon, LeaveIcon } from './DeckIcons';
import { toast } from 'react-toastify';
import { useConvex, useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
// import { SignInButton } from '@clerk/clerk-react';
import { ConvexError } from 'convex/values';
import { Id } from '../../../convex/_generated/dataModel';
import { useCallback } from 'react';
import { waitForInput } from '../../hooks/sendInput';
import { useServerGame } from '../../hooks/serverGame';

export default function InteractButton({
  userId,
  worldId,
}: {
  userId: string;
  worldId?: Id<'worlds'>;
}) {
  // const { isAuthenticated } = useConvexAuth();
  const game = useServerGame(worldId);
  const humanTokenIdentifier = useQuery(
    api.world.userStatus,
    worldId ? { worldId, userId } : 'skip',
  );
  const userPlayerId =
    game && [...game.world.players.values()].find((p) => p.human === humanTokenIdentifier)?.id;
  const join = useMutation(api.world.joinWorld);
  const leave = useMutation(api.world.leaveWorld);
  const isPlaying = !!userPlayerId;

  const convex = useConvex();
  const joinInput = useCallback(
    async (worldId: Id<'worlds'>) => {
      let inputId;
      try {
        inputId = await join({ worldId, userId });
      } catch (e: any) {
        if (e instanceof ConvexError) {
          toast.error(e.data);
          return;
        }
        throw e;
      }
      try {
        await waitForInput(convex, inputId);
      } catch (e: any) {
        toast.error(e.message);
      }
    },
    [convex, join, userId],
  );

  const joinOrLeaveGame = () => {
    if (!worldId) {
      return;
    }
    if (isPlaying) {
      console.log(`Leaving game for player ${userPlayerId}`);
      void leave({ worldId, userId });
    } else {
      console.log(`Joining game`);
      void joinInput(worldId);
    }
  };
  // if (!isAuthenticated || game === undefined) {
  //   return (
  //     <SignInButton>
  //       <Button imgUrl={interactImg}>Interact</Button>
  //     </SignInButton>
  //   );
  // }
  return (
    <DeckButton
      onClick={joinOrLeaveGame}
      active={isPlaying}
      title={isPlaying ? '离开模拟世界' : '加入模拟世界'}
      icon={isPlaying ? <LeaveIcon /> : <JoinIcon />}
    >
      {isPlaying ? '离开' : '加入'}
    </DeckButton>
  );
}
