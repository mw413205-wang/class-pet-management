# Class Pet API

本地持久化后端，使用 Node.js、Express 与 MySQL 8。

## 初始化

```powershell
cd E:\Code\class_pet\class-pet-api
npm install
npm run db:init
```

初始化脚本会创建 `class_pet_management` 数据库、业务表和演示数据。重复执行不会重复插入班级种子数据。

## 运行

```powershell
npm run dev
```

默认地址：`http://127.0.0.1:3001`

健康检查：`GET http://127.0.0.1:3001/api/health`

## 演示账号

| 项 | 值 |
|---|---|
| 用户名 | `teacher` |
| 密码 | `ClassPet123` |
| 绑定激活码 | `DEMO-TEACHER-2026` |
| 可用于注册新账号的演示激活码 | `DEMO-REGISTER-2026` |

除健康检查与认证接口外，其余 `/api` 接口均要求 `Authorization: Bearer <token>`。租户身份从 JWT 中解析，不接受前端自行指定。

当前后端还包括：

- 默认 2 小时 access token、刷新令牌轮换、退出失效和登录失败 IP 限流。
- 班级协作教师关联与班级级访问控制。
- 操作日志中的执行教师记录，以及分页筛选查询接口。
- 学生批量导入事务接口；文本名单与 `.xlsx` 文件由前端预览后提交。
- 周榜、月榜和学期榜结算；结算时固化个人榜与小组榜快照，并向前 10 名发放荣誉徽章。

## 配置

将 `.env.example` 复制为 `.env` 并填写本地 MySQL 连接参数。`.env` 已加入忽略规则，不会提交数据库密码。

生产部署、迁移、备份与恢复说明见 `DEPLOYMENT.md`。常用维护命令：

```powershell
npm run db:backup
npm run db:migrate
npm test
```
