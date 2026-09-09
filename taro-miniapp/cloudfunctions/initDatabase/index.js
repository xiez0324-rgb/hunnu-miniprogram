const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 需要创建的集合
const COLLECTIONS = [
  'demands',
  'parent_users',
  'teacher_users',
  'applications',
  'matches',
  'verifications',
  'resumes',
  'inquiries',
  'fee_records',
  'teachers',
]

// ===== 种子数据（与 src/data/shared.ts 对齐，扁平字段）=====
// createTime 统一使用 Date 类型（相对当前时刻的偏移），与前端新发布需求（db.serverDate()）类型一致，
// 避免 orderBy('createTime') 时字符串/Date 混排；时间取"数小时/天前"便于演示排序
const now = Date.now()
const HOUR = 3600 * 1000
const demands = [
  { id: '1024', grade: '初三', subject: '数学', category: '主科', title: '中考冲刺提分', goal: '中考冲刺提分', time: '周六 / 周日 14:00-16:00', budget: '100-150 元/时', area: '岳麓区 · 师大附近', gender: '不限', phone: '138****1201', note: '学生基础中等，需要耐心讲解', applicants: 3, recommended: 1, status: '进行中', createTime: new Date(now - 2 * HOUR) },
  { id: '1025', grade: '五年级', subject: '数学', category: '主科', title: '小学奥数培优', goal: '培优拔高', time: '周三、周五 18:30-20:00', budget: '80-120 元/时', area: '岳麓区 · 湖大附近', gender: '女', phone: '139****5520', note: '希望老师风格活泼', applicants: 5, recommended: 2, status: '进行中', createTime: new Date(now - 26 * HOUR) },
  { id: '1026', grade: '高二', subject: '英语', category: '主科', title: '英语阅读专项', goal: '阅读与写作提分', time: '周日全天可约', budget: '120-160 元/时', area: '开福区 · 五一广场', gender: '男', phone: '137****3399', note: '口语基础较弱', applicants: 2, recommended: 0, status: '进行中', createTime: new Date(now - 2 * 24 * HOUR) },
  { id: '1027', grade: '四年级', subject: '少儿编程', category: '编程', title: '图形化编程启蒙', goal: 'Scratch 入门与逻辑思维', time: '周三、周五 19:00-20:30', budget: '90-130 元/时', area: '开福区 · 北辰三角洲', gender: '不限', phone: '135****8890', note: '零基础，希望老师有耐心', applicants: 4, recommended: 1, status: '进行中', createTime: new Date(now - 3 * 24 * HOUR) },
  { id: '1028', grade: '六年级', subject: '羽毛球', category: '体育', title: '羽毛球基础训练', goal: '零基础入门，掌握基本步法', time: '周六 9:00-11:00', budget: '80-120 元/时', area: '岳麓区 · 大学城体育馆', gender: '男', phone: '136****2210', note: '孩子个子高，体力好', applicants: 2, recommended: 0, status: '进行中', createTime: new Date(now - 4 * 24 * HOUR) },
  { id: '1029', grade: '三年级', subject: '钢琴', category: '艺术', title: '钢琴启蒙陪练', goal: '识谱与基础指法', time: '周六 15:00-16:00', budget: '100-150 元/时', area: '芙蓉区 · 湖南大剧院附近', gender: '女', phone: '134****7705', note: '家中有钢琴', applicants: 1, recommended: 0, status: '进行中', createTime: new Date(now - 5 * 24 * HOUR) },
]

const teachers = [
  { id: 't1', name: '王晨', school: '湖南大学 · 数学系', subject: '数学', rate: '120 元/时', meta: '初三 · 一对一', quote: '讲解特别有耐心，孩子进步明显。', verified: true },
  { id: 't2', name: '李思', school: '湖南师大 · 英语系', subject: '英语', rate: '110 元/时', meta: '初三 · 小班', quote: '阅读方法讲得很系统。', verified: true },
  { id: 't3', name: '刘洋', school: '中南大学 · 计算机系', subject: '少儿编程', rate: '130 元/时', meta: '四年级 · 一对一', quote: '带孩子做项目很有方法。', verified: true },
  { id: 't4', name: '赵敏', school: '湖南师大 · 体育学院', subject: '羽毛球', rate: '100 元/时', meta: '六年级 · 一对二', quote: '羽毛球国家二级运动员。', verified: false },
  { id: 't5', name: '陈晨', school: '湖南大学 · 艺术系', subject: '钢琴', rate: '140 元/时', meta: '三年级 · 上门', quote: '钢琴十级，擅长陪练启蒙。', verified: true },
  { id: 't6', name: '周杰', school: '中南大学 · 数学系', subject: '数学', rate: '110 元/时', meta: '初三 · 一对一', quote: '带过两届中考冲刺。', verified: false },
]

const resumes = [
  { teacherId: 't1', subjects: ['数学'], grades: ['初中', '高中'], timeSlots: ['周一至周五', '周六', '周末'], rate: '120 元/时', districts: ['岳麓区', '芙蓉区'], intro: '湖南大学数学系大三，带过 3 届中考冲刺，学员平均提分 20+，擅长基础薄弱学生的查漏补缺，讲解耐心有方法。' },
  { teacherId: 't2', subjects: ['英语'], grades: ['小学', '初中', '高中'], timeSlots: ['周六', '周末'], rate: '110 元/时', districts: ['岳麓区', '开福区'], intro: '湖南师大英语系大四，英语专八，辅导英语阅读与写作提分明显，曾带初三学生从 70 分提至 105 分。' },
  { teacherId: 't3', subjects: ['少儿编程'], grades: ['小学', '初中'], timeSlots: ['周一至周五', '周六'], rate: '130 元/时', districts: ['岳麓区', '开福区', '芙蓉区'], intro: '中南大学计算机系，Scratch/Python 少儿编程教学 2 年，带孩子完成多个小项目，注重逻辑思维培养。' },
  { teacherId: 't4', subjects: ['羽毛球'], grades: ['小学', '初中'], timeSlots: ['周六', '周末'], rate: '100 元/时', districts: ['岳麓区'], intro: '湖南师大体育学院，国家二级运动员，擅长羽毛球零基础教学与步法训练，带过校队青少年队员。' },
  { teacherId: 't5', subjects: ['钢琴'], grades: ['小学'], timeSlots: ['周六', '周末'], rate: '140 元/时', districts: ['芙蓉区', '岳麓区'], intro: '湖南大学艺术系，钢琴十级，3 年陪练启蒙经验，擅长识谱与基础指法教学，孩子喜欢、家长放心。' },
  { teacherId: 't6', subjects: ['数学'], grades: ['初中', '高中'], timeSlots: ['周一至周五', '周末'], rate: '110 元/时', districts: ['岳麓区', '天心区'], intro: '中南大学数学系研究生，带过两届中考冲刺与高一衔接，逻辑清晰，能帮助学生建立数学思维体系。' },
]

const feeRecords = [
  { demand: '#1026 高二 · 英语', totalFee: 1200, fee8: 96, status: '待付' },
  { demand: '#1012 初三 · 数学', totalFee: 2400, fee8: 192, status: '已付' },
]

async function seed(collection, list) {
  const col = db.collection(collection)
  const existing = await col.count()
  if (existing.total > 0) {
    return `skipped（已有 ${existing.total} 条）`
  }
  for (const item of list) {
    await col.add({ data: item })
  }
  return `已灌入 ${list.length} 条`
}

exports.main = async () => {
  const result = { created: [], skipped: [], seeded: {} }

  // 1. 创建集合（幂等：已存在则跳过）
  for (const name of COLLECTIONS) {
    try {
      await db.createCollection(name)
      result.created.push(name)
    } catch (e) {
      result.skipped.push(name)
    }
  }

  // 2. 灌入种子数据（幂等：已有数据则跳过）
  result.seeded.demands = await seed('demands', demands)
  result.seeded.teachers = await seed('teachers', teachers)
  result.seeded.resumes = await seed('resumes', resumes)
  result.seeded.fee_records = await seed('fee_records', feeRecords)

  return { code: 0, message: 'success', data: result }
}
