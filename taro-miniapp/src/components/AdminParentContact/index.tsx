import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import styles from './index.module.scss'

export interface AdminParentContactProps {
  nickname?: string
  phone?: string
  wechat?: string
  area?: string
  /**
   * 展示形态：
   * - bar：列表视图用（一行紧凑展示，点按直接拨打）
   * - card：详情视图用（完整区块：称呼 / 电话 / 微信 / 区域 + 拨打、复制按钮）
   */
  variant?: 'bar' | 'card'
}

const isWeapp = process.env.TARO_ENV === 'weapp'

// 号码清洗：仅保留数字与可选的前导 +，避免历史脏数据（空格/横线/“电话：”前缀）导致拨号失败
function normalizePhone(raw?: string): string {
  const v = String(raw || '').trim()
  if (!v) return ''
  const cleaned = v.replace(/[^\d+]/g, '')
  return /^\d{6,}$/.test(cleaned.replace(/^\+/, '')) ? cleaned : ''
}

/**
 * 家长联系电话（仅管理员可见）
 * 列表与详情共用同一套渲染与交互，保证后台各页面展示口径一致。
 * 字段缺失时降级为「未填写」提示，不会因空值渲染异常。
 */
export default function AdminParentContact({
  nickname,
  phone,
  wechat,
  area,
  variant = 'bar',
}: AdminParentContactProps) {
  const tel = normalizePhone(phone)
  const raw = String(phone || '').trim()

  // 拨打：微信内直接呼起拨号盘；H5 / 调用失败时降级为复制号码，保证管理员始终能拿到号码
  const call = () => {
    if (!tel) {
      Taro.showToast({ title: '该家长暂未填写联系电话', icon: 'none' })
      return
    }
    if (isWeapp) {
      Taro.makePhoneCall({ phoneNumber: tel }).catch(() => copy())
      return
    }
    copy()
  }

  const copy = () => {
    if (!tel) {
      Taro.showToast({ title: '该家长暂未填写联系电话', icon: 'none' })
      return
    }
    Taro.setClipboardData({
      data: tel,
      success: () => Taro.showToast({ title: '已复制家长电话', icon: 'none' }),
      fail: () => Taro.showToast({ title: `请手动记录：${tel}`, icon: 'none' }),
    })
  }

  // 列表卡片整体可点进详情：电话模块的点击需阻止冒泡，避免误跳转
  const onCall = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    call()
  }

  const onCopy = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    copy()
  }

  if (variant === 'bar') {
    return (
      <View className={styles.bar} onClick={onCall}>
        <View className={styles.barLeft}>
          <Text className={styles.barLabel}>📞 家长电话</Text>
          <Text className={tel ? styles.barPhone : styles.barEmpty}>
            {tel || (raw ? `号码无效：${raw}` : '家长未填写，可先了解需求')}
          </Text>
        </View>
        {tel ? <Text className={styles.barAction}>拨打 ›</Text> : null}
      </View>
    )
  }

  return (
    <View className={styles.card}>
      <View className={styles.cardHead}>
        <Text className={styles.cardTitle}>📞 家长联系电话</Text>
        <Text className={styles.cardTag}>仅管理员可见</Text>
      </View>

      <View className={styles.row}>
        <Text className={styles.rowKey}>家长称呼</Text>
        <Text className={styles.rowVal}>{nickname || '未填写'}</Text>
      </View>
      <View className={styles.row}>
        <Text className={styles.rowKey}>联系电话</Text>
        <Text className={tel ? styles.rowPhone : styles.rowEmpty}>
          {tel || (raw ? `号码无效：${raw}` : '未填写')}
        </Text>
      </View>
      <View className={styles.row}>
        <Text className={styles.rowKey}>微信号</Text>
        <Text className={styles.rowVal}>{wechat || '未填写'}</Text>
      </View>
      <View className={styles.row}>
        <Text className={styles.rowKey}>所在区域</Text>
        <Text className={styles.rowVal}>{area || '未填写'}</Text>
      </View>

      <View className={styles.actions}>
        <View
          className={`admBtn ${tel ? 'admBtnPrimary' : 'admBtnGhost'} ${styles.actionBtn}`}
          onClick={onCall}
        >
          <Text>{tel ? '拨打电话' : '暂无号码'}</Text>
        </View>
        <View
          className={`admBtn admBtnGhost ${styles.actionBtn}`}
          onClick={onCopy}
        >
          <Text>复制号码</Text>
        </View>
      </View>
    </View>
  )
}
