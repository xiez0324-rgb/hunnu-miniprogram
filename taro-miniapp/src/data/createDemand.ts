// mock: createDemand 云函数（家长发布需求）
// 单号格式与云函数一致：8 位小写字母+数字（剔除 0/o/1/l/i）
const ID_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789'

export default function createDemand(_data: Record<string, unknown>): { id: string } {
  return {
    id: Array.from({ length: 8 }, () => ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)]).join(''),
  }
}
