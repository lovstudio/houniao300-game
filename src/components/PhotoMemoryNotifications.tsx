import { useEffect, useRef } from 'react';
import { useQuery } from 'convex/react';
import { toast } from 'react-toastify';
import { api } from '../../convex/_generated/api';

export default function PhotoMemoryNotifications({ userId }: { userId: string }) {
  const recent = useQuery(api.photoMemories.recentSharedPhotoMemories);
  const seenRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!recent) return;
    const ids = recent.map((item) => item._id);
    if (seenRef.current === null) {
      seenRef.current = new Set(ids);
      return;
    }
    for (const item of [...recent].reverse()) {
      if (seenRef.current.has(item._id)) continue;
      seenRef.current.add(item._id);
      if (item.userId === userId) continue;
      const where = item.venue ?? item.activityTitle;
      toast.info(`${item.userName} 生成了一张「${item.title}」${where ? ` · ${where}` : ''}`, {
        toastId: `photo-memory-${item._id}`,
      });
    }
    seenRef.current = new Set([...seenRef.current, ...ids].slice(-40));
  }, [recent, userId]);

  return null;
}
