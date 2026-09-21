// 管理端纯函数：将投递/咨询记录按需求单(demandId)聚合
import type { DeliveryRow } from '@/types/admin'

export interface DeliveryGroup {
  /** 需求单业务 id（无则回退 ''，表示未关联需求单） */
  demandId: string
  demandLabel: string
  demand?: DeliveryRow['demand']
  parent?: DeliveryRow['parent']
  items: DeliveryRow[]
  total: number
  recommendedCount: number
  /** 已产生的订单状态集合（去重，如 ['待联系','已成交']） */
  orderStatuses: string[]
  latestTime?: string | null
}

function pick<T, K extends keyof T>(a: T | undefined, b: T | undefined, k: K): T[K] | undefined {
  return a && a[k] !== undefined && a[k] !== null && a[k] !== '' ? a[k] : b ? b[k] : undefined
}

function labelOf(group: DeliveryGroup): string {
  const d = group.demand
  return (
    `${d?.grade || ''} ${d?.subject || (group.parent?.nickname ? '家长咨询' : '需求单')}`.trim() ||
    '未关联需求单'
  )
}

/** 按需求单聚合全部投递记录；组内默认「平台推荐优先、其次按创建时间倒序」 */
export function groupDeliveries(rows: DeliveryRow[]): DeliveryGroup[] {
  const map = new Map<string, DeliveryGroup>()

  for (const row of rows) {
    const demandId = row.demandId || ''
    let g = map.get(demandId)
    if (!g) {
      g = {
        demandId,
        demandLabel: '',
        demand: row.demand,
        parent: row.parent,
        items: [],
        total: 0,
        recommendedCount: 0,
        orderStatuses: [],
        latestTime: row.createTime,
      }
      map.set(demandId, g)
    }
    g.items.push(row)
    if (row.recommended) g.recommendedCount++
    if (row.orderStatus && !g.orderStatuses.includes(row.orderStatus)) g.orderStatuses.push(row.orderStatus)
    if (!g.latestTime || (row.createTime && row.createTime > g.latestTime)) g.latestTime = row.createTime || g.latestTime
    g.demand = {
      ...(row.demand || {}),
      grade: pick(row.demand, g.demand, 'grade'),
      subject: pick(row.demand, g.demand, 'subject'),
      category: pick(row.demand, g.demand, 'category'),
      title: pick(row.demand, g.demand, 'title'),
      area: pick(row.demand, g.demand, 'area'),
      budget: pick(row.demand, g.demand, 'budget'),
      gender: pick(row.demand, g.demand, 'gender'),
      classTime: pick(row.demand, g.demand, 'classTime'),
      note: pick(row.demand, g.demand, 'note'),
    } as DeliveryRow['demand']
    if (!g.parent?.nickname && row.parent?.nickname) g.parent = row.parent
  }

  const groups = [...map.values()]
  for (const g of groups) {
    g.total = g.items.length
    g.demandLabel = labelOf(g)
    g.items.sort((a, b) => {
      if (!!a.recommended !== !!b.recommended) return a.recommended ? -1 : 1
      return (b.createTime || '').localeCompare(a.createTime || '')
    })
  }
  groups.sort((a, b) => (b.latestTime || '').localeCompare(a.latestTime || ''))
  return groups
}
