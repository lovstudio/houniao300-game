import { useCallback, useEffect, useState } from 'react';
import { sound } from '@pixi/sound';
import SettingRow from './SettingRow';
import { MusicIcon } from './DeckIcons';

// base-aware path: `/ai-town/assets/bgm.mp3` in dev, `/assets/bgm.mp3` on the dedicated domain.
// BASE_URL may or may not carry a trailing slash, so normalize before joining.
const BGM_URL = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/assets/bgm.mp3`;

export default function MusicButton() {
  const [isPlaying, setPlaying] = useState(false);

  const flipSwitch = async () => {
    if (isPlaying) {
      sound.stop('background');
    } else {
      // lazy add so the 13MB file is only fetched once the user opts in
      if (!sound.exists('background')) {
        sound.add('background', BGM_URL).loop = true;
      }
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
      title="播放背景音乐（按 m 播放/静音）"
    />
  );
}
