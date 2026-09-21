/**
 * 云开发环境配置
 *
 * 真实值**不写入仓库**：请在 `taro-miniapp/.env` 中配置（该文件已被 .gitignore 忽略，不会入库）。
 * 首次开发请复制 `.env.example` 为 `.env` 并填入自己的云环境 ID。
 *
 * 说明：小程序 AppID 由 Taro 内置的 `TARO_APP_ID` 环境变量自动注入构建产物，
 *      因此无需在此声明（参见 `types/global.d.ts` 中 Taro 的说明）。
 */
export const CLOUD_ENV_ID = process.env.TARO_APP_CLOUD_ENV_ID || ''
