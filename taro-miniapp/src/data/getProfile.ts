// mock: getProfile 云函数（读取当前登录者个人信息档案）
// H5 预览：模拟"暂无档案"，页面使用本地默认占位展示；真实小程序由 users 集合返回
export default function getProfile(): { profile: null } {
  return { profile: null }
}
