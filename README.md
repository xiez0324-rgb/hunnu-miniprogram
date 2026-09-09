# 小小陪伴帮 · 大学城家教匹配小程序

微信小程序（Taro + React + 微信云开发）与配套 Web 管理端，用于大学城家教需求发布、师资匹配与履约跟进。

## 业务闭环

家长发布家教需求 → 老师在广场申请 → 家长确认匹配 → 双方联系并履约 → 管理端登记费用台账。

三端角色（家长 / 老师 / 管理员）共用一个微信身份，但**档案与数据按角色物理分表**。

## 仓库结构

| 目录 | 说明 |
|---|---|
| `taro-miniapp/` | 微信小程序主体（Taro 4 + React 18 + TypeScript + Sass） |
| `admin-web/` | Web 管理后台（Vite + React + CloudBase JS SDK） |
| `src/` | Web 端界面与小程序预览（Vite） |

后端为**微信云开发**（云函数 + 云数据库），无自建服务。

## 快速开始

### 小程序

```bash
cd taro-miniapp
cp .env.example .env      # 填入自己的云环境 ID 与 AppID；.env 不入库
npm install
npm run dev:weapp         # 监听编译到 dist/
```

用**微信开发者工具**打开 `taro-miniapp/`（`miniprogramRoot` 指向 `dist/`）。
`project.config.json` 中的 appid 为占位值，请把真实 AppID 填进 `.env` 的 `TARO_APP_ID`，
并在开发者工具中使用自己的微信登录。

云函数位于 `taro-miniapp/cloudfunctions/`，改动后需在开发者工具中右键「上传并部署：云端安装依赖」。

### Web 管理后台

```bash
cd admin-web
cp .env.example .env      # 填入云环境 ID
npm install
npm run dev
```

## 配置与密钥约定

本仓库为**公开仓库**，真实凭据一律不入库：

| 配置项 | 存放位置 |
|---|---|
| 小程序云环境 ID / AppID | `taro-miniapp/.env` |
| Web 端云环境 ID | `admin-web/.env` |
| 管理员口令哈希盐值 | 云开发控制台 → 云函数 → 环境变量 `ADMIN_PASSWORD_SALT` |

> ⚠️ **部署 `adminInit` / `adminLogin` / `adminChangePassword` 前，必须先在云函数配置中设置 `ADMIN_PASSWORD_SALT`**，
> 否则管理员无法登录；该值需与数据库中已有 `passwordHash` 所用盐值保持一致。
> `adminInit` 不再内置默认口令，首次初始化由调用方传入 `initialPassword`（≥ 8 位），完成后请停用该函数。

## 文档索引

`taro-miniapp/` 目录下：

| 文档 | 内容 |
|---|---|
| `HANDOVER.md` | 交接速查：技术栈、数据模型、改代码红线、验证清单 |
| `账号与数据隔离说明.md` | 身份体系、分表设计、读写流程、归属校验、已知风险 |
| `功能迭代测试报告.md` | 历次迭代变更点与离线测试结果 |

## 数据安全设计

- 前端不直接读写云数据库，所有数据经云函数，归属校验在服务端完成
- `OPENID` 仅从云函数 `cloud.getWXContext()` 获取，客户端不可伪造
- 敏感字段（`phone`、`_openid`）按归属决定是否下发

## 许可

见 [LICENSE](./LICENSE)。
