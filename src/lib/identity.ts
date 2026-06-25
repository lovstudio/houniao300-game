// 匿名玩家 id（鉴权接入后替换为真实 user id）。全局唯一，存 localStorage。
export function getAnonUserId(): string {
  let id = localStorage.getItem('hn_uid');
  if (!id) {
    id = 'u_' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem('hn_uid', id);
  }
  return id;
}

export type Gender = 'male' | 'female' | 'other';
