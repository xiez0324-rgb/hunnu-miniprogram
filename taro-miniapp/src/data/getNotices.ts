// mock: getNotices 云函数（站内信）
// H5 演示：新账号保持空白初始态（与线上一致，不使用演示通知常量）
export default function getNotices(): {
  list: Array<{ id: string; type: string; title: string; content: string; role: string; demandId: string; read: boolean; createTime: string | null }>
  unread: number
} {
  return { list: [], unread: 0 }
}
