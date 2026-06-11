# 部署与数据库维护

## 生产环境配置

生产环境至少需要配置：

```dotenv
NODE_ENV=production
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=class_pet
MYSQL_PASSWORD=replace-with-a-strong-password
MYSQL_DATABASE=class_pet_management
JWT_SECRET=replace-with-at-least-32-random-characters
ACCESS_TOKEN_TTL=2h
REFRESH_TOKEN_DAYS=30
TRUST_PROXY=true
CORS_ORIGINS=https://class-pet.example.com
```

`JWT_SECRET` 在生产环境中必须是至少 32 位的随机字符串。`CORS_ORIGINS` 使用英文逗号分隔允许访问 API 的前端来源。反向代理应启用 HTTPS，并把 API 服务限制在内网或本机端口。

## 初始化与迁移

首次部署：

```powershell
npm install
npm run db:init
```

后续版本上线：

```powershell
npm run db:backup
npm run db:migrate
```

迁移记录存储在 `schema_migration` 表中，可重复执行。

## 备份与恢复

创建备份：

```powershell
npm run db:backup
```

默认备份文件位于 `backups` 目录，该目录不会提交到 Git。

恢复指定备份：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/restore-db.ps1 -BackupFile backups/class_pet_management-YYYYMMDD-HHMMSS.sql
```

恢复操作会覆盖当前数据库中的业务数据，执行前应再次创建备份，并在维护窗口内完成。
