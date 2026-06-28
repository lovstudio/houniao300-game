import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { toast } from 'react-toastify';

export type Character = { id: string; name: string };

function hue(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}

// 浏览器语音识别（Web Speech API），无第三方依赖；不支持时优雅降级（不显示苇笛）。
function getSpeechRecognition(): any {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

// 主视图底部居中的「传话器」：向沙城说话，可语音/文字，可 @ 角色。
// @ 到 AI 角色时，后端会让该角色基于上下文回应，落回通知系统。
export default function Composer({
  worldId,
  userId,
  characters,
}: {
  worldId: Id<'worlds'>;
  userId: string;
  characters: Character[];
}) {
  const say = useMutation(api.notifications.say);
  const [text, setText] = useState('');
  const [target, setTarget] = useState<Character | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [listening, setListening] = useState(false);
  const [sending, setSending] = useState(false);

  const taRef = useRef<HTMLTextAreaElement>(null);
  const recRef = useRef<any>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const SpeechRec = useMemo(getSpeechRecognition, []);

  // 自适应高度。
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 96) + 'px';
  }, [text]);

  // 点击别处收起角色选择器。
  useEffect(() => {
    if (!pickerOpen) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setPickerOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [pickerOpen]);

  const filtered = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    const list = q ? characters.filter((c) => c.name.toLowerCase().includes(q)) : characters;
    return list.slice(0, 40);
  }, [characters, pickerQuery]);

  const pickTarget = (c: Character) => {
    setTarget(c);
    setPickerOpen(false);
    setPickerQuery('');
    // 去掉文本里触发用的末尾 "@"。
    setText((t) => t.replace(/@$/, ''));
    taRef.current?.focus();
  };

  const onChange = (v: string) => {
    setText(v);
    // 末尾刚敲了 "@" → 升起角色选择器。
    if (v.endsWith('@') && characters.length) {
      setPickerOpen(true);
      setPickerQuery('');
    }
  };

  const toggleVoice = () => {
    if (!SpeechRec) return;
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new SpeechRec();
    rec.lang = 'zh-CN';
    rec.interimResults = true;
    rec.continuous = false;
    let base = text ? text + ' ' : '';
    rec.onresult = (e: any) => {
      let s = '';
      for (let i = e.resultIndex; i < e.results.length; i++) s += e.results[i][0].transcript;
      setText(base + s);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  useEffect(() => () => recRef.current?.stop?.(), []);

  const send = async () => {
    const clean = text.trim();
    if (!clean || sending) return;
    setSending(true);
    if (listening) recRef.current?.stop?.();
    try {
      await say({ worldId, userId, text: clean, targetName: target?.name });
      setText('');
      if (target) toast.info(`传话已送达「${target.name}」，等待回应…`, { autoClose: 2200 });
    } catch (e: any) {
      toast.error(e?.data ?? e?.message ?? '传话失败');
    } finally {
      setSending(false);
      setTarget(null);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-40 flex justify-center px-3">
      <div ref={wrapRef} className="pointer-events-auto relative w-full max-w-xl">
        {pickerOpen && (
          <div className="sand-slip">
            <div className="shrink-0 border-b border-[rgba(198,154,90,0.4)] px-2.5 py-2">
              <input
                autoFocus
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
                placeholder="向谁传话…"
                className="w-full bg-transparent text-sm text-[#2a1c14] placeholder:text-[#a8906c] focus:outline-none"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto py-1">
              {filtered.length ? (
                filtered.map((c) => (
                  <button key={c.id} onClick={() => pickTarget(c)} className="sand-slip-row w-full">
                    <span className="sand-slip-glyph" style={{ background: `hsl(${hue(c.id)} 45% 45%)` }}>
                      {c.name.slice(0, 1)}
                    </span>
                    <span className="truncate text-sm font-medium">{c.name}</span>
                  </button>
                ))
              ) : (
                <p className="px-3 py-4 text-center text-xs text-[#9c7e5e]">没有匹配的居民</p>
              )}
            </div>
          </div>
        )}

        <div className="sand-composer">
          {SpeechRec && (
            <button
              type="button"
              onClick={toggleVoice}
              className={'sand-orb sand-mic' + (listening ? ' is-live' : '')}
              title={listening ? '停止说话' : '按下说话'}
              aria-label="语音输入"
            >
              <MicIcon />
            </button>
          )}

          {target && (
            <span className="sand-mention">
              对 {target.name} 说
              <button onClick={() => setTarget(null)} title="取消" aria-label="取消对象">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <path d="M6 6 18 18M18 6 6 18" />
                </svg>
              </button>
            </span>
          )}

          <textarea
            ref={taRef}
            rows={1}
            value={text}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={target ? `对 ${target.name} 说点什么…` : '向沙城说点什么…（输入 @ 可指定居民）'}
          />

          <button
            type="button"
            onClick={() => {
              setPickerOpen((v) => !v);
              setPickerQuery('');
            }}
            className={'sand-orb' + (pickerOpen ? ' is-on' : '')}
            title="@ 一位居民"
            aria-label="选择对象"
          >
            <AtIcon />
          </button>

          <button
            type="button"
            onClick={() => void send()}
            disabled={!text.trim() || sending}
            className="sand-send font-brush"
            title="传话"
            aria-label="发送"
          >
            传
          </button>
        </div>
      </div>
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0M12 17v4" />
    </svg>
  );
}

function AtIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" />
    </svg>
  );
}
