// 云环境接入配置（与小程序共用同一云环境）
// 接入前提：云环境需已绑定腾讯云（可在 CloudBase 控制台管理），并在
// 「身份认证」中开启「匿名登录」或「用户名密码登录」，且把本机 localhost / 部署域名加入安全域名白名单。
export const ENV_ID = "[环境 ID 见本地 .env]";

// 云函数名清单（与 cloudfunctions/ 目录一一对应）
export const FN = {
  login: "adminLogin",
  dashboard: "adminDashboard",
  listOrders: "adminListOrders",
  updateOrder: "adminUpdateOrder",
  listVerifications: "adminListVerifications",
  reviewVerify: "adminReviewVerify",
  listDeliveries: "adminListDeliveries",
  recommend: "adminRecommend",
  listFees: "adminListFeeRecords",
  registerFee: "adminRegisterFee",
} as const;
