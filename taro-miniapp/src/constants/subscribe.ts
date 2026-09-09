// ============================================================
// 微信订阅消息模板配置（一次调用最多 3 条，每条模板标题需不同）
// ------------------------------------------------------------
// 使用前必须在「微信公众平台 → 功能 → 订阅消息」中选用模板并申请模板 ID，
// 然后复制到下方对应事件即可；模板 ID 形如：xxxx-xxxxx_xxxxxxxxxxxxxx
// 留空时前端会隐藏「开启」按钮并提示开发者配置，功能不会报错。
// ============================================================

export type SubscribeEventKey =
  // 家长侧
  | 'parent_demand_published' // 需求发布成功
  | 'parent_new_applicant' // 有人报名
  | 'parent_recommended' // 已推荐人选
  // 老师侧
  | 'teacher_new_demand' // 新需求上架
  | 'teacher_recommended' // 报名被推荐
  | 'teacher_confirmed' // 家长确认成交

export interface SubscribeEventDef {
  key: SubscribeEventKey
  title: string
  desc: string
  tmplId: string
}

export const SUBSCRIBE_CONFIG: Record<'parent' | 'teacher', SubscribeEventDef[]> = {
  parent: [
    {
      key: 'parent_demand_published',
      title: '需求发布成功',
      desc: '需求成功上架时提醒',
      tmplId: '', // TODO: 从公众平台复制家长「需求发布成功」模板 ID
    },
    {
      key: 'parent_new_applicant',
      title: '有老师报名',
      desc: '老师报名你的需求时提醒',
      tmplId: '', // TODO: 复制家长「有新报名」模板 ID
    },
    {
      key: 'parent_recommended',
      title: '已推荐人选',
      desc: '代理人推荐合适人选时提醒',
      tmplId: '', // TODO: 复制家长「已推荐人选」模板 ID
    },
  ],
  teacher: [
    {
      key: 'teacher_new_demand',
      title: '新需求上架',
      desc: '符合条件的新需求提醒',
      tmplId: '', // TODO: 复制老师「新需求上架」模板 ID
    },
    {
      key: 'teacher_recommended',
      title: '报名被推荐',
      desc: '报名被推荐给家长时提醒',
      tmplId: '', // TODO: 复制老师「报名被推荐」模板 ID
    },
    {
      key: 'teacher_confirmed',
      title: '家长确认成交',
      desc: '家长确认你为老师时提醒',
      tmplId: '', // TODO: 复制老师「家长确认成交」模板 ID
    },
  ],
}
