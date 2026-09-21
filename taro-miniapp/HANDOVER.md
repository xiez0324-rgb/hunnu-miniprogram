# HANDOVER.md — 二次开发交接说明

> 工程：二号开发版本 / taro-miniapp
> 产品：**小小陪伴帮**（大学城家教匹配小程序，微信小程序 + 云开发）
> 云环境：微信云开发 `[环境 ID 见本地 .env]`
> 交接对象：二次开发执行者（人 / AI harness）
> 更新时间：2026-09-21

---

## 1. 这是个什么项目

家长在小程序发布家教需求 → 老师在广场看到并申请 → 家长确认匹配 → 双方联系、履约、记费用。
三端角色共用一个微信身份，但**档案与数据按角色物理分表**：

- **家长**：发需求（`demands`）、看报名、确认匹配、联系老师
- **老师**：填简历（`resumes`）、实名认证（`verifications`）、在广场申请需求（`applications`）
- **管理员**：审核需求/实名、订单流转、费用台账（隐藏入口，不走 tabBar）

---

## 2. 技术栈

| 项 | 版本/说明 |
|---|---|
| Taro | **4.1.9**（React 模板 + TypeScript + Sass） |
| 前端框架 | React 18 + TSX，状态管理用 React Context（`src/store/user.tsx`） |
| 编译目标 | 微信小程序（weapp）为主；`dev:h5` 可调试页面 |
| 后端 | **微信云开发**：云函数（Node.js）+ 云数据库，无自建后端 |
| UI | 自写组件（24 个，`src/components/`），无第三方 UI 库 |

---

## 3. 启动与构建

```bash
npm install                # node_modules 已在仓库，换机才需要重装
npm run dev:weapp          # 监听编译到 dist/（开发用）
npm run build:weapp        # 生产构建
```

然后在**微信开发者工具**里打开本项目根目录（`miniprogramRoot` 指向 `dist/`），appid `[AppID 见本地 .env]`。
云函数在 `cloudfunctions/`，改完需在开发者工具里右键「上传并部署：云端安装依赖」。

---

## 4. 目录结构速览

```
src/
├── app.tsx / app.config.ts   # 入口；app.config.ts 注册全部 27 个页面 + tabBar
├── pages/                    # 21 个业务页面（首页/进度/我的 三个 tab）
│   └── admin/                # 管理端 9 个页面（隐藏入口）
├── components/               # 24 个自写组件（DemandCard/TeacherCard/Plaza/MyDemands...）
├── services/                 # 云函数调用封装：cloud.ts / admin.ts / privacy.ts / subscribe.ts
├── store/user.tsx            # 全局用户态（openid / role / profile）
├── utils/                    # 工具：imageUtil / teacherProfile / verifyUpload / adminDelivery...
├── constants/  data/  hooks/  styles/  types/
cloudfunctions/              # 45 个云函数（命名见第 6 节）
config/                       # Taro 构建配置
```

**新增页面**要同步登记到 `src/app.config.ts` 的 `pages` 数组，否则不生效。

---

## 5. 数据模型（必须先理解，否则改必错）

| 集合 | 主键/归属 | 存什么 |
|---|---|---|
| `parent_users` | `userId = parent_<openid>` | 家长档案 |
| `teacher_users` | `userId = teacher_<openid>` | 老师档案 |
| `demands` | `_openid` 服务端注入 | 需求单（status / auditStatus / recruiting / applicants） |
| `applications` | `_openid` 服务端注入 | 老师报名记录 |
| `resumes` / `verifications` | `_openid` | 老师简历 / 实名认证材料 |
| `matches` | `_id` = orderId | 撮合订单 |
| `inquiries` | — | 家长向老师发起的咨询 |
| `fee_records` | 管理端 | 费用台账 |
| `admins` | — | 管理员账号（token → openid 三级校验） |

关键约定：
- `OPENID` 只能从云函数 `cloud.getWXContext()` 取，**客户端不可伪造**；
- `demandId` / `teacherId` / `orderId` 是**客户端可传的业务 id**——所有写接口必须在服务端再校验归属，不能只信 id；
- `getProfile` / `updateProfile` / `login` / `notifyPref` **必须显式传 `role`**，role 决定操作哪张表。

---

## 6. 云函数分组（45 个）

- **账号/档案**：`login` / `getProfile` / `updateProfile` / `notifyPref` / `saveResume` / `submitVerification` / `getMyResume` / `getMyVerification`
- **撮合流程**：`createDemand` / `applyDemand` / `cancelApplication` / `getDemands`(广场) / `getDemandDetail` / `getApplicants` / `confirmMatch` / `cancelConfirm` / `requestTeacherInfo` / `cancelConfirm` / `getMyData`
- **老师侧**：`getTeachers` / `getTeacherDetail` / `getFeeRecords` / `getNotices`
- **管理端（全部走 requireAdmin）**：`adminLogin` / `adminDashboard` / `adminReviewDemand` / `adminReviewVerify` / `adminRecommend` / `adminListApplications|Demands|Deliveries|FeeRecords|Orders|Verifications` / `adminUpdateOrder` / `adminWithdrawOrder` / `adminRegisterFee` / `adminChangePassword` / `adminQueryOrder` / `adminUpdateRealName`
- **初始化/迁移**：`initDatabase` / `migrateSeedData` / `assignTeacherNumbers` / `adminInit`

---

## 7. 改代码红线（务必遵守）

1. **前端绝不直接读写云数据库**——所有数据经云函数；`services/cloud.ts` 里的 `getDatabase()` 是遗留代码，无调用点，别学它。
2. **新增/修改写接口时**：在云函数内校验 `_openid` 归属（参考 `confirmMatch` / `requestTeacherInfo` 的写法），不要只校验业务 id。
3. **role 显式传参**：任何按角色查档案的调用都要带 `role`，禁止隐式默认。
4. **敏感数据不下发**：`phone`、`_openid` 等字段在详情接口按归属决定是否置空。
5. 改完云函数记得**右键上传部署**，改完前端记得重新 `dev:weapp`。

---

## 8. 已知残留风险（别当 bug 修，也别忽略）

详见《账号与数据隔离说明.md》第七节：
- `applyDemand` 报名上限是 check-then-act，并发下理论可突破 5 条上限；
- 高频查询缺索引（`demands(status,auditStatus,createTime)` 等）；
- 老师报名列表服务端默认 100 条，无分页；
- `adminDashboard` 费用汇总全表取出，台账大了会慢；
- 管理端多人共用账号会互相顶下线。

---

## 9. 验证清单（每次改完跑）

| # | 场景 | 预期 |
|---|---|---|
| 1 | 家长 A 看「我的需求」 | 只有 A 自己的需求 |
| 2 | A 传 B 的 demandId 调 confirmMatch | 拒绝且无写入 |
| 3 | 老师 X 看「我的报名」 | 只有 X 自己的 |
| 4 | 同微信切老师→切回家长 | 两套档案不串 |
| 5 | 新家长/新老师首登 | 各页面空态正确、无演示数据残留 |

完整 23 项回归见《功能迭代测试报告》。

---

## 10. 已有文档索引（先读这些再动手）

| 文档 | 内容 |
|---|---|
| `账号与数据隔离说明.md` | 身份体系、分表设计、读写流程、归属校验、已知风险（**最重要**） |
| `功能迭代测试报告.md` | 上一轮迭代的变更点与 23 项离线测试结果 |
| 本文档 | 速查导航，AI 接手入口 |

---

## 11. 给二次开发执行者的建议

- 一次只做一个小需求，改完立刻在微信开发者工具里跑通相关页面，不要攒大版本；
- 新增页面先登记 `app.config.ts`，新云函数先建目录再按现有函数的 requireAdmin / 归属校验模板写；
- 每次完成后同步更新本文件与《功能迭代测试报告》，保持"改了什么、怎么验证的"有记录。
