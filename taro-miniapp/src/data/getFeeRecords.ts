// mock: getFeeRecords 云函数（信息费记录）
import type { FeeRecord } from '@/types'
import { feeRecords } from './shared'

export default function getFeeRecords(): { list: FeeRecord[] } {
  return { list: feeRecords }
}
