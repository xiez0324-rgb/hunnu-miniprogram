// mock: getMyVerification 云函数（读取本人最近一次实名学籍认证状态）
// H5 演示：默认返回 null（未提交过），认证页展示可编辑表单
export default function getMyVerification(): { verification: null } {
  return { verification: null }
}
