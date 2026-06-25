import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import SettingRow from './buttons/SettingRow';
import { SnowflakeIcon } from './buttons/DeckIcons';

export default function FreezeButton() {
  const stopAllowed = useQuery(api.testing.stopAllowed) ?? false;
  const defaultWorld = useQuery(api.world.defaultWorldStatus);

  const frozen = defaultWorld?.status === 'stoppedByDeveloper';

  const unfreeze = useMutation(api.testing.resume);
  const freeze = useMutation(api.testing.stop);

  const flipSwitch = async () => {
    if (frozen) {
      console.log('Unfreezing');
      await unfreeze();
    } else {
      console.log('Freezing');
      await freeze();
    }
  };

  return !stopAllowed ? null : (
    <SettingRow
      icon={<SnowflakeIcon />}
      label="冻结世界"
      value={frozen ? '已冻结' : '运行中'}
      active={frozen}
      onClick={flipSwitch}
      title="冻结世界时，智能体需要一些时间停下手头的事，然后才会进入冻结状态。"
    />
  );
}
