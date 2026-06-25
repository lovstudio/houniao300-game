import { useCallback, useEffect, useState } from 'react';
import { sound } from '@pixi/sound';
import SettingRow from './SettingRow';
import { MusicIcon } from './DeckIcons';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';

export default function MusicButton() {
  const musicUrl = useQuery(api.music.getBackgroundMusic);
  const [isPlaying, setPlaying] = useState(false);

  useEffect(() => {
    if (musicUrl) {
      sound.add('background', musicUrl).loop = true;
    }
  }, [musicUrl]);

  const flipSwitch = async () => {
    if (isPlaying) {
      sound.stop('background');
    } else {
      await sound.play('background');
    }
    setPlaying(!isPlaying);
  };

  const handleKeyPress = useCallback(
    (event: { key: string }) => {
      if (event.key === 'm' || event.key === 'M') {
        void flipSwitch();
      }
    },
    [flipSwitch],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  return (
    <SettingRow
      icon={<MusicIcon />}
      label="音乐"
      value={isPlaying ? '播放中' : '关'}
      active={isPlaying}
      onClick={() => void flipSwitch()}
      title="播放 AI 生成的音乐（按 m 播放/静音）"
    />
  );
}
