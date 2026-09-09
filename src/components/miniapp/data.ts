export type ApplyStatus = "已报名" | "已推荐" | "已确认" | "已成交" | "已取消";

export type Category = "主科" | "体育" | "艺术" | "编程";

export type Gender = "男" | "女" | "不限";

export type Demand = {
  id: string;
  grade: string;
  subject: string;
  category: Category;
  title: string;
  goal: string;
  time: string;
  budget: string;
  area: string;
  note: string;
  applicants: number;
  recommended: number;
  status: "进行中" | "已成交" | "已下架";
  gender: Gender;
  applied?: boolean;
};

export type TeacherResume = {
  subjects: string[];
  grades: string[];
  times: string[];
  area: string;
  intro: string;
};

export type Teacher = {
  id: string;
  name: string;
  school: string;
  subject: string;
  rate: string;
  meta: string;
  quote: string;
  verified: boolean;
  resume: TeacherResume;
};

export type Applicant = Teacher & { recommended: boolean };

export const demands: Demand[] = [
  {
    id: "1024",
    grade: "初三",
    subject: "数学",
    category: "主科",
    title: "中考冲刺提分",
    goal: "中考冲刺提分",
    time: "周六 / 周日 14:00-16:00",
    budget: "100-150 元/时",
    area: "岳麓区 · 师大附近",
    note: "学生基础中等，需要耐心讲解",
    applicants: 3,
    recommended: 1,
    status: "进行中",
    gender: "不限",
  },
  {
    id: "1025",
    grade: "五年级",
    subject: "数学",
    category: "主科",
    title: "小学奥数培优",
    goal: "培优拔高",
    time: "周三、周五 18:30-20:00",
    budget: "80-120 元/时",
    area: "岳麓区 · 湖大附近",
    note: "希望老师风格活泼",
    applicants: 5,
    recommended: 2,
    status: "进行中",
    gender: "女",
  },
  {
    id: "1026",
    grade: "高二",
    subject: "英语",
    category: "主科",
    title: "英语阅读专项",
    goal: "阅读与写作提分",
    time: "周日全天可约",
    budget: "120-160 元/时",
    area: "开福区 · 五一广场",
    note: "口语基础较弱",
    applicants: 2,
    recommended: 0,
    status: "进行中",
    gender: "男",
  },
  {
    id: "1027",
    grade: "四年级",
    subject: "少儿编程",
    category: "编程",
    title: "图形化编程启蒙",
    goal: "Scratch 入门与逻辑思维",
    time: "周三、周五 19:00-20:30",
    budget: "90-130 元/时",
    area: "开福区 · 北辰三角洲",
    note: "零基础，希望老师有耐心",
    applicants: 4,
    recommended: 1,
    status: "进行中",
    gender: "不限",
  },
  {
    id: "1028",
    grade: "六年级",
    subject: "羽毛球",
    category: "体育",
    title: "羽毛球基础训练",
    goal: "零基础入门，掌握基本步法",
    time: "周六 9:00-11:00",
    budget: "80-120 元/时",
    area: "岳麓区 · 大学城体育馆",
    note: "孩子个子高，体力好",
    applicants: 2,
    recommended: 0,
    status: "进行中",
    gender: "男",
  },
  {
    id: "1029",
    grade: "三年级",
    subject: "钢琴",
    category: "艺术",
    title: "钢琴启蒙陪练",
    goal: "识谱与基础指法",
    time: "周六 15:00-16:00",
    budget: "100-150 元/时",
    area: "芙蓉区 · 湖南大剧院附近",
    note: "家中有钢琴",
    applicants: 1,
    recommended: 0,
    status: "进行中",
    gender: "女",
  },
];

export const myApplies: {
  id: string;
  demandId: string;
  title: string;
  budget: string;
  meta: string;
  status: ApplyStatus;
}[] = [
  {
    id: "a1",
    demandId: "1024",
    title: "初三 · 数学",
    budget: "100-150 元/时",
    meta: "周六 · 师大附近",
    status: "已推荐",
  },
  {
    id: "a2",
    demandId: "1025",
    title: "五年级 · 数学",
    budget: "80-120 元/时",
    meta: "周三周五晚 · 湖大附近",
    status: "已报名",
  },
  {
    id: "a3",
    demandId: "1026",
    title: "高二 · 英语",
    budget: "120-160 元/时",
    meta: "周日 · 五一广场",
    status: "已成交",
  },
  {
    id: "a4",
    demandId: "1027",
    title: "四年级 · 少儿编程",
    budget: "90-130 元/时",
    meta: "周三周五晚 · 北辰三角洲",
    status: "已报名",
  },
];

/** 老师端「信息费记录」：成交订单的具体信息（无支付入口，收款走代理人微信私信） */
export type FeeRecord = {
  id: string;
  demandId: string;
  title: string;
  parent: string;
  totalFee: number;
  fee8: number;
  status: "待付" | "已付";
};

export const myFees: FeeRecord[] = [
  {
    id: "mf1",
    demandId: "1018",
    title: "高二 · 英语 · 阅读专项",
    parent: "刘先生",
    totalFee: 1500,
    fee8: 120,
    status: "待付",
  },
  {
    id: "mf2",
    demandId: "1015",
    title: "五年级 · 数学 · 奥数培优",
    parent: "赵先生",
    totalFee: 800,
    fee8: 64,
    status: "已付",
  },
  {
    id: "mf3",
    demandId: "1012",
    title: "初三 · 数学 · 中考冲刺",
    parent: "张女士",
    totalFee: 1200,
    fee8: 96,
    status: "已付",
  },
];

export const teachers: Teacher[] = [
  {
    id: "t1",
    name: "王晨",
    school: "湖南大学 · 数学系",
    subject: "数学",
    rate: "120 元/时",
    meta: "初三 · 一对一",
    quote: "讲解特别有耐心，孩子进步明显。",
    verified: true,
    resume: {
      subjects: ["数学", "物理"],
      grades: ["初中", "高中"],
      times: ["周六全天", "周日全天"],
      area: "岳麓区",
      intro: "湖南大学数学系大三在读，带过 3 届中考数学冲刺，学生平均提分 20+，讲解耐心、善于归纳题型。",
    },
  },
  {
    id: "t2",
    name: "李思",
    school: "湖南师大 · 英语系",
    subject: "英语",
    rate: "110 元/时",
    meta: "初三 · 小班",
    quote: "阅读方法讲得很系统。",
    verified: true,
    resume: {
      subjects: ["英语"],
      grades: ["初中", "高中"],
      times: ["周一至周五晚", "周日全天"],
      area: "岳麓区 · 开福区",
      intro: "湖南师大英语系，专四专八高分通过，擅长阅读与写作专项，带过高考英语冲刺班。",
    },
  },
  {
    id: "t3",
    name: "刘洋",
    school: "中南大学 · 计算机系",
    subject: "少儿编程",
    rate: "130 元/时",
    meta: "四年级 · 一对一",
    quote: "带孩子做项目很有方法。",
    verified: true,
    resume: {
      subjects: ["少儿编程", "数学"],
      grades: ["小学", "初中"],
      times: ["周三、周五晚", "周六全天"],
      area: "岳麓区 · 长沙县",
      intro: "中南大学计算机系，熟悉 Scratch / Python 少儿编程，曾指导学生完成多个创意项目并获奖。",
    },
  },
  {
    id: "t4",
    name: "赵敏",
    school: "湖南师大 · 体育学院",
    subject: "羽毛球",
    rate: "100 元/时",
    meta: "六年级 · 一对二",
    quote: "羽毛球国家二级运动员。",
    verified: false,
    resume: {
      subjects: ["羽毛球"],
      grades: ["小学", "初中"],
      times: ["周六上午", "周日下午"],
      area: "岳麓区 · 大学城体育馆",
      intro: "湖南师大体育学院，羽毛球国家二级运动员，擅长零基础启蒙与基础步法教学。",
    },
  },
  {
    id: "t5",
    name: "陈晨",
    school: "湖南大学 · 艺术系",
    subject: "钢琴",
    rate: "140 元/时",
    meta: "三年级 · 上门",
    quote: "钢琴十级，擅长陪练启蒙。",
    verified: true,
    resume: {
      subjects: ["钢琴", "音乐"],
      grades: ["小学", "初中"],
      times: ["周六下午", "周日全天"],
      area: "岳麓区 · 芙蓉区",
      intro: "湖南大学艺术系，钢琴十级，擅长少儿钢琴启蒙与陪练，教学有亲和力。",
    },
  },
  {
    id: "t6",
    name: "周杰",
    school: "中南大学 · 数学系",
    subject: "数学",
    rate: "110 元/时",
    meta: "初三 · 一对一",
    quote: "带过两届中考冲刺。",
    verified: false,
    resume: {
      subjects: ["数学"],
      grades: ["初中", "高中"],
      times: ["周一至周五晚", "周末均可"],
      area: "岳麓区 · 中南大学附近",
      intro: "中南大学数学系，带过两届中考冲刺与一届高考一轮复习，注重基础巩固与拔高。",
    },
  },
];

/** 各需求单的报名老师列表：recommended 标记是否被平台推荐（家长端置顶展示） */
export const applicantsByDemand: Record<string, Applicant[]> = {
  "1024": [
    { ...teachers[0]!, recommended: true },
    { ...teachers[5]!, recommended: false },
    { ...teachers[1]!, recommended: false },
  ],
  "1025": [
    { ...teachers[1]!, recommended: true },
    { ...teachers[2]!, recommended: false },
    { ...teachers[0]!, recommended: false },
  ],
  "1026": [
    { ...teachers[1]!, recommended: false },
    { ...teachers[0]!, recommended: false },
  ],
  "1027": [
    { ...teachers[2]!, recommended: true },
    { ...teachers[5]!, recommended: false },
  ],
  "1028": [
    { ...teachers[3]!, recommended: false },
    { ...teachers[2]!, recommended: false },
  ],
  "1029": [
    { ...teachers[4]!, recommended: false },
  ],
};

export const feeTip =
  "家长联系方式不公开，由平台代理人核验后牵线对接，成交后按总课时费 8% 收取一次性信息费。";

/** 长沙服务区域（发布需求滑动选项卡） */
export const districts = [
  "岳麓区",
  "芙蓉区",
  "天心区",
  "开福区",
  "雨花区",
  "望城区",
  "长沙县",
];

/** 需求广场可展开的全部科目（覆盖语数外及副科 + 兴趣课） */
export const allSubjects = [
  "语文",
  "数学",
  "英语",
  "物理",
  "化学",
  "生物",
  "历史",
  "地理",
  "政治",
  "音乐",
  "美术",
  "少儿编程",
  "羽毛球",
  "篮球",
  "足球",
  "钢琴",
];
