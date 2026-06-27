import { useCallback, useEffect, useRef, useState } from 'react';
import SettingRow from './SettingRow';
import { MusicIcon } from './DeckIcons';

// base-aware path: `/ai-town/assets/bgm.mp3` in dev, `/assets/bgm.mp3` on the dedicated domain.
// BASE_URL may or may not carry a trailing slash, so normalize before joining.
const BGM_URL = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/assets/bgm.mp3`;

export default function MusicButton() {
  // Plain HTML5 <audio>: streams the 13MB file and loops natively. We deliberately avoid
  // @pixi/sound here, which decodes the whole clip into a Web Audio buffer and fails on
  // large files / suspended AudioContext ("Unable to decode audio data").
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setPlaying] = useState(false);

  const flipSwitch = useCallback(async () => {
    if (!audioRef.current) {
      const el = new Audio(BGM_URL);
      el.loop = true;
      el.preload = 'none'; // only fetched once the user opts in
      audioRef.current = el;
    }
    const el = audioRef.current;
    if (isPlaying) {
      el.pause();
      setPlaying(false);
    } else {
      try {
        await el.play(); // called from a user gesture, so autoplay policy is satisfied
        setPlaying(true);
      } catch (err) {
        console.error('BGM play failed', err);
      }
    }
  }, [isPlaying]);

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

  // stop playback if the button unmounts
  useEffect(() => () => audioRef.current?.pause(), []);

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
