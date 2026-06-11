import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import { databaseName, pool, withTransaction } from './db.js'

const app = express()
const port = Number(process.env.PORT || 3001)
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.')
}
const developmentJwtSecret = 'class-pet-development-secret'
const configuredJwtSecret = String(process.env.JWT_SECRET || '').trim()
const jwtSecret = configuredJwtSecret || developmentJwtSecret
const accessTokenTtl = process.env.ACCESS_TOKEN_TTL || '2h'
const rememberedRefreshTokenDays = Math.max(1, Number(process.env.REFRESH_TOKEN_DAYS) || 30)
const sessionRefreshTokenDays = 1
const loginFailureLimit = 5
const loginFailureWindowMinutes = 5
const loginLockMinutes = 15
const resourceLimits = {
  classesPerTenant: 100,
  studentsPerClass: 200,
  scoreRulesPerClass: 50,
  shopItemsPerTenant: 100,
  lotteryPrizesPerTenant: 20,
  customBadgesPerClass: 50,
}
const defaultAiPromptText = '请基于学生积分、徽章、近期课堂表现和小组信息生成教师可执行的学情分析，包含优势、风险、建议和下一步观察重点。'
const aiSensitiveTerms = ['暴力', '自杀', '色情', '毒品', '赌博', '仇恨', '歧视']
const aiJobTimeoutMs = 5000
const authGuardTables = {
  login: 'auth_login_guard',
  reset: 'auth_reset_guard',
}
const configuredCorsOrigins = String(process.env.CORS_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean)

if (
  process.env.NODE_ENV === 'production'
  && (
    configuredJwtSecret.length < 32
    || configuredJwtSecret === developmentJwtSecret
    || configuredJwtSecret.includes('change-me')
  )
) {
  throw new Error('Production requires a JWT_SECRET with at least 32 characters.')
}

app.set('trust proxy', process.env.TRUST_PROXY === 'true')

const gradients = [
  ['#4ecdc4', '#95e1d3'],
  ['#ff6b9d', '#c44569'],
  ['#ffd93d', '#ff9a3c'],
  ['#a8edea', '#fed6e3'],
  ['#96e6a1', '#d4fc79'],
]

const groupTemplates = [
  ['ungrouped', '未分组', '#9ca3af', 'bg-gray-100', 'text-gray-600', 1],
  ['red', '红组', '#ef4444', 'bg-[#fecaca]', 'text-[#991b1b]', 0],
  ['blue', '蓝组', '#3b82f6', 'bg-[#bfdbfe]', 'text-[#1e40af]', 0],
  ['yellow', '黄组', '#f59e0b', 'bg-[#fef08a]', 'text-[#854d0e]', 0],
  ['green', '绿组', '#22c55e', 'bg-[#bbf7d0]', 'text-[#166534]', 0],
]

const scoreRuleTemplates = [
  ['认真听讲', '👂', 2, 1],
  ['积极回答', '✋', 3, 1],
  ['作业优秀', '📝', 5, 1],
  ['帮助同学', '🤝', 3, 0],
  ['课堂表现优秀', '⭐', 5, 0],
  ['违反纪律', '⚠️', -2, 0],
  ['未完成作业', '❌', -3, 0],
]

const cosmeticCatalog = new Map([
  ['toy_ball', 'toy'],
  ['toy_frisbee', 'toy'],
  ['toy_bone', 'toy'],
  ['toy_bell', 'toy'],
  ['toy_yarn', 'toy'],
  ['head_birthday', 'head'],
  ['head_grad', 'head'],
  ['head_crown', 'head'],
  ['head_santa', 'head'],
  ['back_angel', 'back'],
  ['back_butterfly', 'back'],
  ['back_cape', 'back'],
  ['neck_scarf', 'neck'],
  ['neck_bow', 'neck'],
  ['face_glasses', 'face'],
])
const cosmeticTypes = [...new Set(cosmeticCatalog.values())]

app.use(cors({
  origin(origin, callback) {
    const allowLocalDevelopment = process.env.NODE_ENV !== 'production'
      && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin || '')
    if (!origin || configuredCorsOrigins.includes(origin) || allowLocalDevelopment) {
      callback(null, true)
      return
    }
    callback(new Error('不允许的跨域来源'))
  },
}))
app.use(express.json())
app.use((request, response, next) => {
  if (request.body == null) request.body = {}
  if (Array.isArray(request.body) || typeof request.body !== 'object') {
    return response.status(400).json({ message: '请求体必须是 JSON 对象' })
  }
  next()
})

function route(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next)
  }
}

function parseJson(value, fallback) {
  if (value == null) return fallback
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return fallback
    }
  }
  return value
}

function parseLevelThresholds(value) {
  const fallback = [50, 100, 150, 200]
  const thresholds = parseJson(value, fallback)
  if (
    !Array.isArray(thresholds)
    || thresholds.length !== 4
    || thresholds.some(item => !Number.isInteger(Number(item)) || Number(item) <= 0)
    || thresholds.some((item, index) => index > 0 && Number(item) <= Number(thresholds[index - 1]))
  ) {
    return fallback
  }
  return thresholds.map(Number)
}

function parseBooleanSetting(value, fallback = false) {
  const parsed = parseJson(value, fallback)
  return typeof parsed === 'boolean' ? parsed : fallback
}

function parseTextSetting(value, fallback) {
  const parsed = typeof value === 'string' ? value : parseJson(value, fallback)
  return typeof parsed === 'string' && parsed.trim() ? parsed.trim() : fallback
}

function createAccessToken(user) {
  return jwt.sign(
    {
      userId: Number(user.id),
      tenantId: Number(user.tenant_id),
      username: user.username,
      role: user.role,
      displayName: user.display_name,
    },
    jwtSecret,
    { expiresIn: accessTokenTtl },
  )
}

function mapAuthUser(user) {
  return {
    id: Number(user.id),
    tenantId: Number(user.tenant_id),
    username: user.username,
    displayName: user.display_name,
    role: user.role,
  }
}

function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

async function issueRefreshToken(connection, user, ttlDays) {
  const refreshToken = crypto.randomBytes(48).toString('base64url')
  await connection.query(
    `INSERT INTO refresh_token (tenant_id, user_id, token_hash, ttl_days, expires_at)
     VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))`,
    [user.tenant_id, user.id, hashRefreshToken(refreshToken), ttlDays, ttlDays],
  )
  return refreshToken
}

async function createAuthSession(connection, user, remember = false) {
  const ttlDays = remember ? rememberedRefreshTokenDays : sessionRefreshTokenDays
  return {
    token: createAccessToken(user),
    refreshToken: await issueRefreshToken(connection, user, ttlDays),
    user: mapAuthUser(user),
  }
}

function getClientIp(request) {
  return String(request.ip || request.socket.remoteAddress || 'unknown').replace(/^::ffff:/, '').slice(0, 64)
}

function getAuthGuardTable(scope) {
  const table = authGuardTables[scope]
  if (!table) throw new Error(`Unknown auth guard scope: ${scope}`)
  return table
}

async function isAuthAttemptLocked(scope, clientIp) {
  const table = getAuthGuardTable(scope)
  const [[guard]] = await pool.query(
    `SELECT locked_until > NOW() AS locked FROM ${table} WHERE client_ip = ?`,
    [clientIp],
  )
  return Boolean(guard?.locked)
}

async function recordAuthAttemptFailure(scope, clientIp) {
  const table = getAuthGuardTable(scope)
  return withTransaction(async connection => {
    const [[guard]] = await connection.query(
      `SELECT failure_count,
              first_failed_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE) AS within_window,
              locked_until > NOW() AS locked
       FROM ${table} WHERE client_ip = ? FOR UPDATE`,
      [loginFailureWindowMinutes, clientIp],
    )
    if (guard?.locked) return true
    const withinWindow = Boolean(guard?.within_window)
    const failureCount = withinWindow ? Number(guard.failure_count) + 1 : 1
    const shouldLock = failureCount >= loginFailureLimit
    if (!guard) {
      await connection.query(
        `INSERT INTO ${table} (client_ip, failure_count, first_failed_at, locked_until)
         VALUES (?, ?, NOW(), IF(?, DATE_ADD(NOW(), INTERVAL ? MINUTE), NULL))`,
        [clientIp, failureCount, shouldLock, loginLockMinutes],
      )
    } else {
      await connection.query(
        `UPDATE ${table}
         SET failure_count = ?,
             first_failed_at = IF(?, first_failed_at, NOW()),
             locked_until = IF(?, DATE_ADD(NOW(), INTERVAL ? MINUTE), NULL)
         WHERE client_ip = ?`,
        [failureCount, withinWindow, shouldLock, loginLockMinutes, clientIp],
      )
    }
    return shouldLock
  })
}

async function clearAuthAttemptFailures(scope, clientIp) {
  const table = getAuthGuardTable(scope)
  await pool.query(`DELETE FROM ${table} WHERE client_ip = ?`, [clientIp])
}

const isLoginLocked = clientIp => isAuthAttemptLocked('login', clientIp)
const recordLoginFailure = clientIp => recordAuthAttemptFailure('login', clientIp)
const clearLoginFailures = clientIp => clearAuthAttemptFailures('login', clientIp)
const isResetLocked = clientIp => isAuthAttemptLocked('reset', clientIp)
const recordResetFailure = clientIp => recordAuthAttemptFailure('reset', clientIp)
const clearResetFailures = clientIp => clearAuthAttemptFailures('reset', clientIp)

async function rejectResetAttempt(response, clientIp) {
  const locked = await recordResetFailure(clientIp)
  return response.status(locked ? 429 : 400).json({
    message: locked ? '找回密码尝试次数过多，请 15 分钟后再试' : '用户名或激活码不正确',
  })
}

function authenticate(request, response, next) {
  const authorization = request.header('authorization') || ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!token) return response.status(401).json({ message: '请先登录' })
  try {
    const payload = jwt.verify(token, jwtSecret)
    pool.query(
      `SELECT id, tenant_id, username, display_name, role
       FROM app_user WHERE id = ? AND tenant_id = ? AND status = 'active'`,
      [payload.userId, payload.tenantId],
    ).then(([[user]]) => {
      if (!user) return response.status(401).json({ message: '登录账号已停用，请重新登录' })
      request.user = {
        userId: Number(user.id),
        tenantId: Number(user.tenant_id),
        username: user.username,
        displayName: user.display_name,
        role: user.role,
      }
      request.tenantId = Number(user.tenant_id)
      next()
    }).catch(next)
  } catch {
    response.status(401).json({ message: '登录状态已失效，请重新登录' })
  }
}

function isValidUsername(username) {
  return /^[a-zA-Z0-9_]{4,20}$/.test(username)
}

function isValidPassword(password) {
  return typeof password === 'string'
    && password.length >= 8
    && password.length <= 20
    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /\d/.test(password)
}

function badRequest(message) {
  const error = new Error(message)
  error.statusCode = 400
  throw error
}

function notFound(message) {
  const error = new Error(message)
  error.statusCode = 404
  throw error
}

function requireText(value, label, maxLength) {
  const text = String(value ?? '').trim()
  if (!text) badRequest(`${label}不能为空`)
  if (text.length > maxLength) badRequest(`${label}不能超过 ${maxLength} 个字符`)
  return text
}

function optionalText(value, label, maxLength, { nullable = false } = {}) {
  if (value == null && nullable) return null
  const text = String(value ?? '').trim()
  if (text.length > maxLength) badRequest(`${label}不能超过 ${maxLength} 个字符`)
  return text
}

function optionalIdentifier(value, label) {
  const text = optionalText(value, label, 64, { nullable: true })
  if (text && !/^[a-zA-Z0-9_-]+$/.test(text)) badRequest(`${label}格式不正确`)
  return text || null
}

function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function requireInteger(value, label, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
  const number = Number(value)
  if (!Number.isInteger(number) || number < min || number > max) {
    badRequest(`${label}必须是 ${min} 到 ${max} 之间的整数`)
  }
  return number
}

function requireBoolean(value, label) {
  if (typeof value !== 'boolean') badRequest(`${label}必须是布尔值`)
  return value
}

function validateScoreRule(body, partial = false) {
  const values = {}
  if (!partial || Object.hasOwn(body, 'name')) values.name = requireText(body.name, '规则名称', 32)
  if (!partial || Object.hasOwn(body, 'icon')) values.icon = requireText(body.icon, '规则图标', 32)
  if (!partial || Object.hasOwn(body, 'value')) {
    values.value = requireInteger(body.value, '积分值', { min: -1000, max: 1000 })
    if (values.value === 0) badRequest('积分值不能为 0')
  }
  if (!partial || Object.hasOwn(body, 'enabled')) values.enabled = requireBoolean(body.enabled ?? true, '启用状态')
  if (!partial || Object.hasOwn(body, 'isQuick')) values.isQuick = requireBoolean(body.isQuick ?? false, '快捷状态')
  if (!partial || Object.hasOwn(body, 'order')) values.order = requireInteger(body.order ?? 0, '排序值', { min: 0, max: 10000 })
  return values
}

function validateShopItem(body) {
  const description = String(body.description ?? '').trim()
  if (description.length > 255) badRequest('商品描述不能超过 255 个字符')
  const cosmeticType = body.cosmeticType == null || body.cosmeticType === ''
    ? null
    : String(body.cosmeticType)
  if (cosmeticType && !cosmeticTypes.includes(cosmeticType)) badRequest('装扮类型不正确')
  const cosmeticId = optionalIdentifier(body.cosmeticId, '装扮 ID')
  if (Boolean(cosmeticType) !== Boolean(cosmeticId)) badRequest('装扮类型和装扮 ID 必须同时填写')
  if (cosmeticId && cosmeticCatalog.get(cosmeticId) !== cosmeticType) badRequest('装扮 ID 不存在或与装扮类型不匹配')
  return {
    categoryId: requireInteger(body.categoryId, '分类 ID', { min: 1 }),
    name: requireText(body.name, '商品名称', 50),
    icon: requireText(body.icon, '商品图标', 32),
    description,
    price: requireInteger(body.price, '商品价格', { min: 1, max: 100000 }),
    stock: requireInteger(body.stock ?? -1, '商品库存', { min: -1, max: 100000 }),
    inLottery: requireBoolean(body.inLottery ?? false, '加入奖池状态'),
    lotteryProbability: requireInteger(body.lotteryProbability ?? 10, '抽奖权重', { min: 1, max: 100000 }),
    cosmeticType,
    cosmeticId,
  }
}

function validateLotteryPrize(body, partial = false) {
  const values = {}
  if (!partial || Object.hasOwn(body, 'name')) values.name = requireText(body.name, '奖品名称', 50)
  if (!partial || Object.hasOwn(body, 'icon')) values.icon = requireText(body.icon, '奖品图标', 32)
  if (!partial || Object.hasOwn(body, 'probability')) values.probability = requireInteger(body.probability ?? 10, '中奖权重', { min: 1, max: 100000 })
  if (!partial || Object.hasOwn(body, 'stock')) values.stock = requireInteger(body.stock ?? -1, '奖品库存', { min: -1, max: 100000 })
  if (Object.hasOwn(body, 'inLottery')) values.inLottery = requireBoolean(body.inLottery, '加入奖池状态')
  return values
}

function mapScoreRuleSnapshot(rule) {
  return {
    name: rule.name,
    icon: rule.icon,
    value: Number(rule.score_value),
    enabled: Boolean(rule.enabled),
    isQuick: Boolean(rule.is_quick),
    order: Number(rule.sort_order),
  }
}

function mapShopItemSnapshot(item) {
  return {
    categoryId: Number(item.category_id),
    name: item.name,
    icon: item.icon,
    description: item.description,
    price: Number(item.price),
    stock: Number(item.stock),
    inLottery: Boolean(item.join_lottery),
    lotteryProbability: Number(item.lottery_probability),
    cosmeticType: item.cosmetic_type,
    cosmeticId: item.cosmetic_id,
  }
}

function mapLotteryPrizeSnapshot(prize) {
  return {
    name: prize.name,
    icon: prize.icon,
    probability: Number(prize.probability),
    stock: Number(prize.stock),
    inLottery: Boolean(prize.enabled),
  }
}

function mapStudentCosmeticsSnapshot(student) {
  return {
    toyId: student.toy_id,
    headId: student.head_id,
    backId: student.back_id,
    neckId: student.neck_id,
    faceId: student.face_id,
  }
}

function mapStudent(row) {
  return {
    id: Number(row.id),
    name: row.name,
    classId: Number(row.class_id),
    groupId: row.group_id,
    petId: row.pet_id,
    petNickname: row.pet_nickname,
    score: Number(row.score),
    badges: Number(row.badge_balance),
    cosmetics: {
      toyId: row.toy_id,
      headId: row.head_id,
      backId: row.back_id,
      neckId: row.neck_id,
      faceId: row.face_id,
    },
  }
}

const collaborationActionLabels = {
  ADD_SCORE: '调整了学生积分',
  DEDUCT_SCORE: '调整了学生积分',
  REVERT: '撤回了积分操作',
  RESET_CLASS: '重置了班级成长进度',
  AWARD_BADGE: '手动颁发了徽章',
  EXCHANGE: '完成了小卖部兑换',
  UPDATE_STUDENT_PET: '更新了学生宠物',
  ADD_CLASS_TEACHER: '添加了协作教师',
  REMOVE_CLASS_TEACHER: '移除了协作教师',
  UPDATE_CLASS_TEACHER: '调整了协作权限',
}

async function createNotifications(connection, {
  tenantId,
  classId = null,
  studentId = null,
  type,
  title,
  message,
  targetPath = '/dashboard',
  dedupeKey = null,
  excludeUserId = null,
}) {
  const [users] = classId == null
    ? await connection.query(
      `SELECT id FROM app_user
       WHERE tenant_id = ? AND status = 'active'
       ORDER BY id`,
      [tenantId],
    )
    : await connection.query(
      `SELECT DISTINCT user.id
       FROM app_user user
       LEFT JOIN class_teacher teacher
         ON teacher.tenant_id = user.tenant_id
        AND teacher.user_id = user.id
        AND teacher.class_id = ?
       WHERE user.tenant_id = ? AND user.status = 'active'
         AND (user.role = 'owner' OR teacher.id IS NOT NULL)
       ORDER BY user.id`,
      [classId, tenantId],
    )
  for (const user of users) {
    if (excludeUserId != null && Number(user.id) === Number(excludeUserId)) continue
    await connection.query(
      `INSERT IGNORE INTO notification
        (tenant_id, recipient_user_id, class_id, student_id, notification_type, title, message, target_path, dedupe_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenantId, user.id, classId, studentId, type, title, message, targetPath, dedupeKey],
    )
  }
}

async function getTenantLevelThresholds(connection, tenantId) {
  const [[setting]] = await connection.query(
    `SELECT setting_value FROM app_setting
     WHERE tenant_id = ? AND setting_key = 'level_thresholds'`,
    [tenantId],
  )
  return parseLevelThresholds(setting?.setting_value)
}

function getLevelFromThresholds(score, thresholds) {
  if (score >= thresholds[3]) return 4
  if (score >= thresholds[2]) return 3
  if (score >= thresholds[1]) return 2
  if (score >= thresholds[0]) return 1
  return 0
}

async function createStockWarning(connection, tenantId, { source, itemId, itemName, stock }) {
  if (stock < 0 || stock > 3) return
  await createNotifications(connection, {
    tenantId,
    type: 'stock_warning',
    title: '库存预警',
    message: `《${itemName}》库存仅剩 ${stock} 件`,
    targetPath: source === 'shop' ? '/dashboard/rewards' : '/dashboard/lucky-draw',
    dedupeKey: `stock-warning:${source}:${itemId}:${stock}`,
  })
}

async function writeAction(connection, tenantId, operatorUserId, actionType, detail = {}) {
  const [result] = await connection.query(
    `INSERT INTO action_log (tenant_id, class_id, student_id, operator_user_id, action_type, detail_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [tenantId, detail.classId || null, detail.studentId || null, operatorUserId || null, actionType, JSON.stringify(detail)],
  )
  const collaborationLabel = collaborationActionLabels[actionType]
  if (operatorUserId && detail.classId && collaborationLabel) {
    const [[operator]] = await connection.query(
      'SELECT display_name FROM app_user WHERE tenant_id = ? AND id = ?',
      [tenantId, operatorUserId],
    )
    await createNotifications(connection, {
      tenantId,
      classId: Number(detail.classId),
      studentId: detail.studentId ? Number(detail.studentId) : null,
      type: 'collaboration',
      title: '协作教师操作',
      message: `${operator?.display_name || '协作教师'}${collaborationLabel}`,
      targetPath: '/dashboard/action-logs',
      dedupeKey: `collaboration:${result.insertId}`,
      excludeUserId: operatorUserId,
    })
  }
  return Number(result.insertId)
}

function writeRequestAction(connection, request, actionType, detail = {}) {
  return writeAction(connection, request.tenantId, Number(request.user.userId), actionType, detail)
}

function requireOwner(request, response, next) {
  if (request.user.role !== 'owner') {
    return response.status(403).json({ message: '仅租户管理员可执行此操作' })
  }
  next()
}

function requireClassTeacherPermissions(value = {}, defaults = {}) {
  const source = value && typeof value === 'object' ? value : {}
  const permissions = {
    canScore: Object.hasOwn(source, 'canScore') ? requireBoolean(source.canScore, '积分权限') : Boolean(defaults.canScore),
    canManageStudents: Object.hasOwn(source, 'canManageStudents') ? requireBoolean(source.canManageStudents, '学生管理权限') : Boolean(defaults.canManageStudents),
    canManageConfig: Object.hasOwn(source, 'canManageConfig') ? requireBoolean(source.canManageConfig, '配置管理权限') : Boolean(defaults.canManageConfig),
  }
  return permissions
}

function mapClassTeacherPermissions(row) {
  return {
    canScore: Boolean(row.can_score),
    canManageStudents: Boolean(row.can_manage_students),
    canManageConfig: Boolean(row.can_manage_config),
  }
}

function containsAiSensitiveTerm(text) {
  const normalized = String(text || '').toLowerCase()
  return aiSensitiveTerms.some(term => normalized.includes(term.toLowerCase()))
}

function maskAiSensitiveTerms(text) {
  return aiSensitiveTerms.reduce(
    (result, term) => result.replaceAll(term, `${term[0]}***`),
    String(text || ''),
  )
}

function requireAiPromptText(value) {
  const promptText = requireText(value, 'Prompt 模板', 2000)
  if (containsAiSensitiveTerm(promptText)) badRequest('Prompt 模板包含敏感词，请调整后再保存')
  return promptText
}

function requireAiStudentIds(value) {
  if (!Array.isArray(value) || !value.length) badRequest('请选择至少 1 名学生')
  if (value.length > 100) badRequest('单次最多生成 100 名学生报告')
  const ids = [...new Set(value.map(item => requireInteger(item, '学生 ID', { min: 1 })))]
  if (!ids.length) badRequest('请选择至少 1 名学生')
  return ids
}

async function getDefaultAiPromptTemplate(connection, tenantId, userId = null) {
  let [[template]] = await connection.query(
    `SELECT id, name, prompt_text, updated_at
     FROM ai_prompt_template
     WHERE tenant_id = ? AND is_default = 1`,
    [tenantId],
  )
  if (!template) {
    const [created] = await connection.query(
      `INSERT INTO ai_prompt_template (tenant_id, name, prompt_text, is_default, updated_by_user_id)
       VALUES (?, '默认学情分析模板', ?, 1, ?)`,
      [tenantId, defaultAiPromptText, userId],
    )
    template = {
      id: created.insertId,
      name: '默认学情分析模板',
      prompt_text: defaultAiPromptText,
      updated_at: new Date(),
    }
  }
  return template
}

function mapAiReport(row) {
  return {
    id: Number(row.id),
    classId: Number(row.class_id),
    studentId: Number(row.student_id),
    jobId: Number(row.job_id),
    studentName: row.student_name,
    scoreSnapshot: Number(row.score_snapshot),
    badgeSnapshot: Number(row.badge_snapshot),
    riskLevel: row.risk_level,
    strengths: parseJson(row.strengths_json, []),
    suggestions: parseJson(row.suggestions_json, []),
    metrics: parseJson(row.metrics_json, {}),
    reportText: row.report_text,
    createdByName: row.created_by_name || null,
    createdAt: row.created_at,
  }
}

function mapAiJob(row) {
  return {
    id: Number(row.id),
    classId: Number(row.class_id),
    scope: row.scope,
    status: row.status,
    totalCount: Number(row.total_count),
    completedCount: Number(row.completed_count),
    failedCount: Number(row.failed_count),
    targetStudentIds: parseJson(row.target_student_ids, []),
    errorMessage: row.error_message,
    retryCount: Number(row.retry_count),
    createdByName: row.created_by_name || null,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    cancelledAt: row.cancelled_at,
  }
}

async function collectAiStudentMetrics(connection, tenantId, classId, studentId) {
  const [[student]] = await connection.query(
    `SELECT student.id, student.class_id, student.name, student.score, student.badge_balance,
            student_group.name AS group_name
     FROM student
     LEFT JOIN student_group ON student_group.id = student.group_id
     WHERE student.tenant_id = ? AND student.class_id = ? AND student.id = ? AND student.deleted = 0`,
    [tenantId, classId, studentId],
  )
  if (!student) return null
  const [[actions]] = await connection.query(
    `SELECT
       COALESCE(SUM(CASE WHEN delta_score > 0 AND reverted = 0 THEN delta_score ELSE 0 END), 0) AS positive_score,
       COALESCE(SUM(CASE WHEN delta_score < 0 AND reverted = 0 THEN delta_score ELSE 0 END), 0) AS negative_score,
       COUNT(CASE WHEN delta_score > 0 AND reverted = 0 THEN 1 END) AS positive_count,
       COUNT(CASE WHEN delta_score < 0 AND reverted = 0 THEN 1 END) AS negative_count
     FROM score_action
     WHERE tenant_id = ? AND class_id = ? AND student_id = ?
       AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
    [tenantId, classId, studentId],
  )
  const [topRules] = await connection.query(
    `SELECT rule_name, SUM(delta_score) AS score, COUNT(*) AS count
     FROM score_action
     WHERE tenant_id = ? AND class_id = ? AND student_id = ? AND reverted = 0
       AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
     GROUP BY rule_name
     ORDER BY ABS(score) DESC, count DESC
     LIMIT 3`,
    [tenantId, classId, studentId],
  )
  return {
    studentId: Number(student.id),
    classId: Number(student.class_id),
    studentName: student.name,
    groupName: student.group_name || '未分组',
    score: Number(student.score),
    badges: Number(student.badge_balance),
    positiveScore30d: Number(actions.positive_score),
    negativeScore30d: Number(actions.negative_score),
    positiveCount30d: Number(actions.positive_count),
    negativeCount30d: Number(actions.negative_count),
    topRules: topRules.map(item => ({
      ruleName: item.rule_name,
      score: Number(item.score),
      count: Number(item.count),
    })),
  }
}

function buildAiReportContent(metrics, promptText) {
  const strengths = []
  const suggestions = []
  if (metrics.score >= 150) strengths.push('成长积分较高，持续表现稳定')
  if (metrics.positiveCount30d >= 3) strengths.push('近 30 天正向表现频繁，可继续强化成功经验')
  if (metrics.badges > 0) strengths.push(`已累计 ${metrics.badges} 枚徽章，具备可见成长成果`)
  if (!strengths.length) strengths.push('当前成长数据较少，适合从小目标开始建立正反馈')

  if (metrics.negativeCount30d >= 3) suggestions.push('近期扣分次数偏多，建议安排一次简短沟通并明确课堂期待')
  if (metrics.score < 30) suggestions.push('当前积分偏低，可设置 1-2 个容易达成的短期目标')
  if (metrics.positiveCount30d === 0) suggestions.push('近 30 天缺少正向记录，建议增加观察和及时表扬')
  if (!suggestions.length) suggestions.push('保持当前节奏，下一阶段关注稳定性和同伴协作')

  const riskLevel = metrics.negativeCount30d >= 3 || metrics.score < 20
    ? 'high'
    : (metrics.negativeCount30d > 0 || metrics.score < 60 ? 'medium' : 'low')
  const topRuleText = metrics.topRules.length
    ? metrics.topRules.map(item => `${item.ruleName}(${item.score > 0 ? '+' : ''}${item.score})`).join('、')
    : '暂无明显高频项目'
  const reportText = [
    `【学生概况】${metrics.studentName} 当前在「${metrics.groupName}」，累计 ${metrics.score} 分、${metrics.badges} 枚徽章。`,
    `【近期表现】近 30 天正向记录 ${metrics.positiveCount30d} 次、负向记录 ${metrics.negativeCount30d} 次，主要项目：${topRuleText}。`,
    `【优势】${strengths.join('；')}。`,
    `【建议】${suggestions.join('；')}。`,
    `【观察重点】未来一周关注课堂参与、作业完成和同伴协作，及时记录可量化变化。`,
    `【Prompt 摘要】${promptText.slice(0, 80)}${promptText.length > 80 ? '...' : ''}`,
  ].join('\n')
  return {
    riskLevel,
    strengths,
    suggestions,
    reportText: maskAiSensitiveTerms(reportText),
  }
}

async function createAiReportsForJob(connection, request, jobId, classId, studentIds, template, retryCount = 0) {
  const startedAt = Date.now()
  await connection.query(
    `UPDATE ai_report_job SET status = 'running', started_at = NOW(), retry_count = ?
     WHERE tenant_id = ? AND id = ?`,
    [retryCount, request.tenantId, jobId],
  )
  let completed = 0
  let failed = 0
  let errorMessage = null
  for (const studentId of studentIds) {
    if (Date.now() - startedAt > aiJobTimeoutMs) {
      errorMessage = '报告生成超时，可稍后重试'
      break
    }
    const metrics = await collectAiStudentMetrics(connection, request.tenantId, classId, studentId)
    if (!metrics) {
      failed += 1
      continue
    }
    const generated = buildAiReportContent(metrics, template.prompt_text)
    await connection.query(
      `INSERT INTO ai_student_report
        (tenant_id, class_id, student_id, job_id, prompt_template_id, prompt_snapshot,
         student_name, score_snapshot, badge_snapshot, risk_level, strengths_json,
         suggestions_json, metrics_json, report_text, created_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        request.tenantId,
        classId,
        metrics.studentId,
        jobId,
        template.id,
        template.prompt_text,
        metrics.studentName,
        metrics.score,
        metrics.badges,
        generated.riskLevel,
        JSON.stringify(generated.strengths),
        JSON.stringify(generated.suggestions),
        JSON.stringify(metrics),
        generated.reportText,
        request.user.userId,
      ],
    )
    completed += 1
  }
  const status = errorMessage ? 'timed_out' : (completed > 0 ? 'completed' : 'failed')
  if (!errorMessage && failed > 0 && completed === 0) errorMessage = '未找到可分析的学生'
  await connection.query(
    `UPDATE ai_report_job
     SET status = ?, completed_count = ?, failed_count = ?, error_message = ?, completed_at = NOW()
     WHERE tenant_id = ? AND id = ?`,
    [status, completed, failed, errorMessage, request.tenantId, jobId],
  )
}

function requireResetMode(value) {
  const mode = String(value || '')
  if (!['score', 'score_badges', 'all_growth'].includes(mode)) {
    badRequest('重置范围必须是 score、score_badges 或 all_growth')
  }
  return mode
}

async function resetClassGrowthData(connection, tenantId, classIds, mode) {
  if (!classIds.length) {
    return { invalidatedScoreActionCount: 0, deletedCosmeticInventoryCount: 0 }
  }
  const placeholders = classIds.map(() => '?').join(', ')
  const classParams = [tenantId, ...classIds]
  await connection.query(
    `UPDATE student SET score = 0
     WHERE tenant_id = ? AND class_id IN (${placeholders})`,
    classParams,
  )
  const [invalidatedActions] = await connection.query(
    `UPDATE score_action
     SET reverted = 1, reverted_at = NOW()
     WHERE tenant_id = ? AND class_id IN (${placeholders}) AND reverted = 0`,
    classParams,
  )
  if (mode !== 'score') {
    await connection.query(
      `UPDATE student SET badge_balance = 0
       WHERE tenant_id = ? AND class_id IN (${placeholders})`,
      classParams,
    )
    await connection.query(
      `DELETE FROM badge_record
       WHERE tenant_id = ? AND class_id IN (${placeholders})`,
      classParams,
    )
  }
  let deletedCosmeticInventoryCount = 0
  if (mode === 'all_growth') {
    await connection.query(
      `UPDATE student
       SET toy_id = NULL, head_id = NULL, back_id = NULL, neck_id = NULL, face_id = NULL
       WHERE tenant_id = ? AND class_id IN (${placeholders})`,
      classParams,
    )
    const [deletedInventory] = await connection.query(
      `DELETE inventory FROM student_cosmetic_inventory inventory
       JOIN student ON student.id = inventory.student_id
       WHERE inventory.tenant_id = ? AND student.tenant_id = ?
         AND student.class_id IN (${placeholders})`,
      [tenantId, tenantId, ...classIds],
    )
    deletedCosmeticInventoryCount = Number(deletedInventory.affectedRows)
  }
  return {
    invalidatedScoreActionCount: Number(invalidatedActions.affectedRows),
    deletedCosmeticInventoryCount,
  }
}

async function getAllowPetChange(connection, tenantId) {
  const [[setting]] = await connection.query(
    `SELECT setting_value FROM app_setting
     WHERE tenant_id = ? AND setting_key = 'allow_pet_change'`,
    [tenantId],
  )
  return parseBooleanSetting(setting?.setting_value)
}

async function assertPetChangeAllowed(connection, tenantId, student, petId) {
  if (student.pet_id == null || student.pet_id === petId || Number(student.score) === 0) return
  if (!await getAllowPetChange(connection, tenantId)) {
    badRequest('该学生已有成长积分，请先重置积分或在系统设置中允许更换宠物')
  }
}

async function canAccessClass(connection, request, classId, includeDeleted = false) {
  if (!Number.isInteger(Number(classId)) || Number(classId) <= 0) return false
  const deletedCondition = includeDeleted ? '' : 'AND class_room.deleted = 0'
  if (request.user.role === 'owner') {
    const [[classRoom]] = await connection.query(
      `SELECT class_room.id FROM class_room
       WHERE class_room.tenant_id = ? AND class_room.id = ? ${deletedCondition}`,
      [request.tenantId, classId],
    )
    return Boolean(classRoom)
  }
  const [[classRoom]] = await connection.query(
    `SELECT class_room.id
     FROM class_room
     JOIN class_teacher
       ON class_teacher.tenant_id = class_room.tenant_id
      AND class_teacher.class_id = class_room.id
      AND class_teacher.user_id = ?
     WHERE class_room.tenant_id = ? AND class_room.id = ? ${deletedCondition}`,
    [request.user.userId, request.tenantId, classId],
  )
  return Boolean(classRoom)
}

async function assertClassAccess(connection, request, classId, includeDeleted = false) {
  if (!await canAccessClass(connection, request, Number(classId), includeDeleted)) {
    const error = new Error('无权访问该班级')
    error.statusCode = 403
    throw error
  }
}

async function getClassPermissionRow(connection, request, classId, includeDeleted = false) {
  const normalizedClassId = Number(classId)
  if (!Number.isInteger(normalizedClassId) || normalizedClassId <= 0) return null
  const deletedCondition = includeDeleted ? '' : 'AND class_room.deleted = 0'
  const [[row]] = await connection.query(
    `SELECT teacher.can_score, teacher.can_manage_students, teacher.can_manage_config
     FROM class_room
     JOIN class_teacher teacher
       ON teacher.tenant_id = class_room.tenant_id
      AND teacher.class_id = class_room.id
      AND teacher.user_id = ?
     WHERE class_room.tenant_id = ? AND class_room.id = ? ${deletedCondition}`,
    [request.user.userId, request.tenantId, normalizedClassId],
  )
  return row || null
}

async function assertClassPermission(connection, request, classId, permission, includeDeleted = false) {
  if (request.user.role === 'owner') {
    await assertClassAccess(connection, request, classId, includeDeleted)
    return
  }
  const row = await getClassPermissionRow(connection, request, classId, includeDeleted)
  if (!row) {
    const error = new Error('无权访问该班级')
    error.statusCode = 403
    throw error
  }
  if (permission && !Boolean(row[permission])) {
    const error = new Error('当前账号没有执行该操作的班级权限')
    error.statusCode = 403
    throw error
  }
}

async function getAccessibleClassIds(user) {
  if (user.role === 'owner') {
    const [rows] = await pool.query(
      'SELECT id FROM class_room WHERE tenant_id = ? AND deleted = 0 ORDER BY id',
      [user.tenantId],
    )
    return rows.map(item => Number(item.id))
  }
  const [rows] = await pool.query(
    `SELECT class_room.id
     FROM class_room
     JOIN class_teacher
       ON class_teacher.tenant_id = class_room.tenant_id
      AND class_teacher.class_id = class_room.id
      AND class_teacher.user_id = ?
     WHERE class_room.tenant_id = ? AND class_room.deleted = 0
     ORDER BY class_room.id`,
    [user.userId, user.tenantId],
  )
  return rows.map(item => Number(item.id))
}

async function getBootstrap(user) {
  const tenantId = Number(user.tenantId)
  const classIds = await getAccessibleClassIds(user)
  const classPlaceholders = classIds.map(() => '?').join(', ') || 'NULL'
  const [
    [classes],
    [groups],
    [students],
    [rules],
    [actions],
    [badges],
    [settings],
  ] = await Promise.all([
    pool.query(
      `SELECT class_room.id, class_room.name, class_room.gradient_from, class_room.gradient_to,
              COUNT(class_teacher.id) AS teacher_count,
              current_teacher.can_score,
              current_teacher.can_manage_students,
              current_teacher.can_manage_config
       FROM class_room
       LEFT JOIN class_teacher
         ON class_teacher.tenant_id = class_room.tenant_id
        AND class_teacher.class_id = class_room.id
       LEFT JOIN class_teacher current_teacher
         ON current_teacher.tenant_id = class_room.tenant_id
        AND current_teacher.class_id = class_room.id
        AND current_teacher.user_id = ?
       WHERE class_room.tenant_id = ? AND class_room.deleted = 0
         AND class_room.id IN (${classPlaceholders})
       GROUP BY class_room.id, class_room.name, class_room.gradient_from, class_room.gradient_to,
                current_teacher.can_score, current_teacher.can_manage_students, current_teacher.can_manage_config
       ORDER BY class_room.id`,
      [user.userId, tenantId, ...classIds],
    ),
    pool.query(
      `SELECT id, class_id, name, color, bg_class, text_class, border_color
       FROM student_group WHERE tenant_id = ? AND deleted = 0 AND class_id IN (${classPlaceholders})
       ORDER BY class_id, is_ungrouped DESC, id`,
      [tenantId, ...classIds],
    ),
    pool.query(
      `SELECT id, class_id, group_id, name, pet_id, pet_nickname, score, badge_balance,
              toy_id, head_id, back_id, neck_id, face_id
       FROM student WHERE tenant_id = ? AND deleted = 0 AND class_id IN (${classPlaceholders}) ORDER BY id`,
      [tenantId, ...classIds],
    ),
    pool.query(
      `SELECT id, class_id, name, icon, score_value, enabled, is_quick, sort_order
       FROM score_rule WHERE tenant_id = ? AND deleted = 0 AND class_id IN (${classPlaceholders})
       ORDER BY class_id, sort_order, id`,
      [tenantId, ...classIds],
    ),
    pool.query(
      `SELECT id, student_id, rule_id, rule_name, student_name, delta_score, reverted,
              UNIX_TIMESTAMP(created_at) * 1000 AS timestamp
       FROM score_action WHERE tenant_id = ? AND class_id IN (${classPlaceholders})
       ORDER BY created_at DESC, id DESC LIMIT 200`,
      [tenantId, ...classIds],
    ),
    pool.query(
      `SELECT id, student_id, badge_type, amount, description, milestone, settlement_id,
              custom_badge_id, custom_badge_name, badge_icon, operator_name,
              UNIX_TIMESTAMP(created_at) * 1000 AS timestamp
       FROM badge_record WHERE tenant_id = ? AND class_id IN (${classPlaceholders})
       ORDER BY created_at DESC, id DESC`,
      [tenantId, ...classIds],
    ),
    pool.query(
      `SELECT setting_key, setting_value FROM app_setting WHERE tenant_id = ?`,
      [tenantId],
    ),
  ])

  const levelThresholdSetting = settings.find(setting => setting.setting_key === 'level_thresholds')
  const allowPetChangeSetting = settings.find(setting => setting.setting_key === 'allow_pet_change')
  const systemNameSetting = settings.find(setting => setting.setting_key === 'system_name')
  return {
    classes: classes.map(item => ({
      id: Number(item.id),
      name: item.name,
      gradientFrom: item.gradient_from,
      gradientTo: item.gradient_to,
      teacherCount: Number(item.teacher_count),
      permissions: user.role === 'owner'
        ? { canScore: true, canManageStudents: true, canManageConfig: true }
        : mapClassTeacherPermissions(item),
    })),
    groups: groups.map(item => ({
      id: item.id,
      name: item.name,
      color: item.color,
      bgClass: item.bg_class,
      textClass: item.text_class,
      borderColor: item.border_color,
      classId: Number(item.class_id),
    })),
    students: students.map(mapStudent),
    scoreRules: rules.map(item => ({
      id: Number(item.id),
      name: item.name,
      icon: item.icon,
      value: Number(item.score_value),
      enabled: Boolean(item.enabled),
      isQuick: Boolean(item.is_quick),
      order: Number(item.sort_order),
      classId: Number(item.class_id),
    })),
    recentActions: actions.map(item => ({
      id: Number(item.id),
      studentId: Number(item.student_id),
      ruleId: item.rule_id == null ? 0 : Number(item.rule_id),
      ruleName: item.rule_name,
      studentName: item.student_name,
      value: Number(item.delta_score),
      timestamp: Number(item.timestamp),
      reverted: Boolean(item.reverted),
    })),
    badgeRecords: badges.map(item => ({
      id: Number(item.id),
      studentId: Number(item.student_id),
      type: item.badge_type,
      amount: Number(item.amount),
      description: item.description,
      timestamp: Number(item.timestamp),
      milestone: item.milestone == null ? undefined : Number(item.milestone),
      settlementId: item.settlement_id == null ? undefined : Number(item.settlement_id),
      customBadgeId: item.custom_badge_id == null ? undefined : Number(item.custom_badge_id),
      customBadgeName: item.custom_badge_name ?? undefined,
      icon: item.badge_icon ?? undefined,
      operatorName: item.operator_name ?? undefined,
    })),
    levelThresholds: parseLevelThresholds(levelThresholdSetting?.setting_value),
    allowPetChange: parseBooleanSetting(allowPetChangeSetting?.setting_value),
    systemName: parseTextSetting(systemNameSetting?.setting_value, '班级宠物园'),
  }
}

async function getShopBootstrap(tenantId, classId) {
  const [[categories], [items], [records]] = await Promise.all([
    pool.query(
      `SELECT id, name, is_system FROM shop_category
       WHERE tenant_id = ? AND deleted = 0 ORDER BY sort_order, id`,
      [tenantId],
    ),
    pool.query(
      `SELECT item.id, item.name, item.icon, item.description, item.price, item.stock,
              item.join_lottery, item.lottery_probability, item.cosmetic_type, item.cosmetic_id,
              category.id AS category_id, category.name AS category
       FROM shop_item item
       JOIN shop_category category ON category.id = item.category_id
       WHERE item.tenant_id = ? AND item.deleted = 0
       ORDER BY item.id`,
      [tenantId],
    ),
    pool.query(
      `SELECT id, student_name, item_name, item_icon, category_name, badge_cost, operator_name,
              DATE_FORMAT(created_at, '%m-%d %H:%i') AS time
       FROM exchange_record
       WHERE tenant_id = ? AND (? IS NULL OR class_id = ?)
       ORDER BY created_at DESC, id DESC LIMIT 100`,
      [tenantId, classId || null, classId || null],
    ),
  ])
  return {
    categories: categories.map(item => ({ id: Number(item.id), name: item.name, isSystem: Boolean(item.is_system) })),
    items: items.map(item => ({
      id: Number(item.id),
      name: item.name,
      icon: item.icon,
      description: item.description,
      price: Number(item.price),
      stock: Number(item.stock),
      categoryId: Number(item.category_id),
      category: item.category,
      inLottery: Boolean(item.join_lottery),
      lotteryProbability: Number(item.lottery_probability),
      cosmeticType: item.cosmetic_type,
      cosmeticId: item.cosmetic_id,
    })),
    exchangeRecords: records.map(item => ({
      id: Number(item.id),
      studentName: item.student_name,
      itemName: item.item_name,
      itemIcon: item.item_icon,
      category: item.category_name,
      price: Number(item.badge_cost),
      time: item.time,
      operatorName: item.operator_name,
    })),
  }
}

async function getExchangeRecords(tenantId, classId, filters = {}) {
  const conditions = ['tenant_id = ?', 'class_id = ?']
  const params = [tenantId, classId]
  if (filters.from) {
    conditions.push('created_at >= ?')
    params.push(`${filters.from} 00:00:00`)
  }
  if (filters.to) {
    conditions.push('created_at < DATE_ADD(?, INTERVAL 1 DAY)')
    params.push(`${filters.to} 00:00:00`)
  }
  if (filters.studentId) {
    conditions.push('student_id = ?')
    params.push(filters.studentId)
  }
  if (filters.category) {
    conditions.push('category_name = ?')
    params.push(filters.category)
  }
  if (filters.itemName) {
    conditions.push('item_name LIKE ?')
    params.push(`%${filters.itemName}%`)
  }
  const [records] = await pool.query(
    `SELECT id, student_name, item_name, item_icon, category_name, badge_cost, operator_name,
            DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') AS time
     FROM exchange_record
     WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC, id DESC
     LIMIT 200`,
    params,
  )
  return records.map(item => ({
    id: Number(item.id),
    studentName: item.student_name,
    itemName: item.item_name,
    itemIcon: item.item_icon,
    category: item.category_name,
    price: Number(item.badge_cost),
    time: item.time,
    operatorName: item.operator_name,
  }))
}

function mapCustomBadge(row) {
  return {
    id: Number(row.id),
    classId: Number(row.class_id),
    name: row.name,
    icon: row.icon,
    description: row.description,
    enabled: Boolean(row.enabled),
  }
}

async function getBadgeRecords(tenantId, classId, filters = {}) {
  const conditions = ['record.tenant_id = ?', 'record.class_id = ?']
  const params = [tenantId, classId]
  if (filters.from) {
    conditions.push('record.created_at >= ?')
    params.push(`${filters.from} 00:00:00`)
  }
  if (filters.to) {
    conditions.push('record.created_at < DATE_ADD(?, INTERVAL 1 DAY)')
    params.push(`${filters.to} 00:00:00`)
  }
  if (filters.studentId) {
    conditions.push('record.student_id = ?')
    params.push(filters.studentId)
  }
  if (filters.type) {
    conditions.push('record.badge_type = ?')
    params.push(filters.type)
  }
  if (filters.customBadgeId) {
    conditions.push('record.custom_badge_id = ?')
    params.push(filters.customBadgeId)
  }
  const [records] = await pool.query(
    `SELECT record.id, record.student_id, COALESCE(record.student_name, student.name) AS student_name,
            record.badge_type, record.amount, record.description, record.milestone,
            record.settlement_id, record.custom_badge_id, record.custom_badge_name,
            record.badge_icon, record.operator_name,
            DATE_FORMAT(record.created_at, '%Y-%m-%d %H:%i') AS time
     FROM badge_record record
     LEFT JOIN student ON student.tenant_id = record.tenant_id AND student.id = record.student_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY record.created_at DESC, record.id DESC
     LIMIT 200`,
    params,
  )
  return records.map(record => ({
    id: Number(record.id),
    studentId: Number(record.student_id),
    studentName: record.student_name,
    type: record.badge_type,
    amount: Number(record.amount),
    description: record.description,
    milestone: record.milestone == null ? undefined : Number(record.milestone),
    settlementId: record.settlement_id == null ? undefined : Number(record.settlement_id),
    customBadgeId: record.custom_badge_id == null ? undefined : Number(record.custom_badge_id),
    customBadgeName: record.custom_badge_name ?? undefined,
    icon: record.badge_icon ?? undefined,
    operatorName: record.operator_name ?? undefined,
    time: record.time,
  }))
}

async function getLotteryBootstrap(tenantId) {
  const [[independentPrizes], [shopPrizes], [history]] = await Promise.all([
    pool.query(
      `SELECT id, name, icon, probability, stock, enabled
       FROM lottery_prize WHERE tenant_id = ? AND deleted = 0 ORDER BY id`,
      [tenantId],
    ),
    pool.query(
      `SELECT item.id, item.name, item.icon, item.lottery_probability AS probability, item.stock
       FROM shop_item item
       JOIN shop_category category ON category.id = item.category_id
       WHERE item.tenant_id = ? AND item.deleted = 0 AND item.join_lottery = 1 AND category.deleted = 0
       ORDER BY item.id`,
      [tenantId],
    ),
    pool.query(
      `SELECT id, source_type, lottery_prize_id, shop_item_id, prize_name, prize_icon,
              DATE_FORMAT(created_at, '%H:%i') AS time
       FROM lottery_draw_record WHERE tenant_id = ? ORDER BY created_at DESC, id DESC LIMIT 20`,
      [tenantId],
    ),
  ])
  return {
    prizes: [
      ...independentPrizes.map(item => ({
        id: `prize-${item.id}`,
        source: 'independent',
        sourceId: Number(item.id),
        name: item.name,
        icon: item.icon,
        probability: Number(item.probability),
        stock: Number(item.stock),
        inLottery: Boolean(item.enabled),
      })),
      ...shopPrizes.map(item => ({
        id: `shop-${item.id}`,
        source: 'shop',
        sourceId: Number(item.id),
        name: item.name,
        icon: item.icon,
        probability: Number(item.probability),
        stock: Number(item.stock),
        inLottery: true,
      })),
    ],
    history: history.map(item => ({
      id: Number(item.id),
      source: item.source_type,
      sourceId: Number(item.source_type === 'shop' ? item.shop_item_id : item.lottery_prize_id),
      prize: { name: item.prize_name, icon: item.prize_icon },
      time: item.time,
    })),
  }
}

app.get('/api/health', route(async (_request, response) => {
  await pool.query('SELECT 1')
  response.json({ status: 'ok', database: databaseName })
}))

app.post('/api/auth/login', route(async (request, response) => {
  const username = String(request.body.username || '').trim()
  const password = String(request.body.password || '')
  const clientIp = getClientIp(request)
  if (await isLoginLocked(clientIp)) {
    return response.status(429).json({ message: '登录失败次数过多，请 15 分钟后再试' })
  }
  const [[user]] = await pool.query(
    `SELECT id, tenant_id, username, password_hash, display_name, role
     FROM app_user WHERE username = ? AND status = 'active'`,
    [username],
  )
  if (!user || !await bcrypt.compare(password, user.password_hash)) {
    const locked = await recordLoginFailure(clientIp)
    if (locked) return response.status(429).json({ message: '登录失败次数过多，请 15 分钟后再试' })
    return response.status(401).json({ message: '用户名或密码错误' })
  }
  await clearLoginFailures(clientIp)
  response.json(await createAuthSession(pool, user, request.body.remember === true))
}))

app.post('/api/auth/register', route(async (request, response) => {
  const username = String(request.body.username || '').trim()
  const password = String(request.body.password || '')
  const activationCode = String(request.body.activationCode || '').trim()
  if (!isValidUsername(username)) return response.status(400).json({ message: '用户名需为 4-20 位字母、数字或下划线' })
  if (!isValidPassword(password)) return response.status(400).json({ message: '密码需为 8-20 位，并包含大小写字母和数字' })

  const session = await withTransaction(async connection => {
    const [[code]] = await connection.query(
      `SELECT id, tenant_id FROM activation_code
       WHERE code = ? AND status = 'active' AND (expires_at IS NULL OR expires_at > NOW())
       FOR UPDATE`,
      [activationCode],
    )
    if (!code) badRequest('激活码无效、已使用或已过期')
    await connection.query('SELECT id FROM tenant WHERE id = ? FOR UPDATE', [code.tenant_id])
    const [[activeOwner]] = await connection.query(
      `SELECT id FROM app_user
       WHERE tenant_id = ? AND role = 'owner' AND status = 'active'
       LIMIT 1`,
      [code.tenant_id],
    )
    if (!activeOwner) badRequest('租户管理员账号已停用，无法注册协作教师')
    const [[existing]] = await connection.query('SELECT id FROM app_user WHERE username = ?', [username])
    if (existing) badRequest('用户名已存在')
    const passwordHash = await bcrypt.hash(password, 10)
    const [result] = await connection.query(
      `INSERT INTO app_user (tenant_id, username, password_hash, display_name, role)
       VALUES (?, ?, ?, ?, 'teacher')`,
      [code.tenant_id, username, passwordHash, username],
    )
    await connection.query(
      `UPDATE activation_code SET status = 'used', used_by_user_id = ?, used_at = NOW()
       WHERE id = ?`,
      [result.insertId, code.id],
    )
    const user = {
      id: Number(result.insertId),
      tenant_id: Number(code.tenant_id),
      username,
      display_name: username,
      role: 'teacher',
    }
    return createAuthSession(connection, user, true)
  })

  response.status(201).json(session)
}))

app.post('/api/auth/refresh', route(async (request, response) => {
  const refreshToken = String(request.body.refreshToken || '')
  if (!refreshToken) return response.status(401).json({ message: '刷新令牌无效，请重新登录' })
  const session = await withTransaction(async connection => {
    const [[storedToken]] = await connection.query(
      `SELECT token.id AS token_id, token.ttl_days,
              user.id, user.tenant_id, user.username, user.display_name, user.role
       FROM refresh_token token
       JOIN app_user user ON user.id = token.user_id
       WHERE token.token_hash = ?
         AND token.revoked_at IS NULL
         AND token.expires_at > NOW()
         AND user.status = 'active'
       FOR UPDATE`,
      [hashRefreshToken(refreshToken)],
    )
    if (!storedToken) {
      const error = new Error('刷新令牌已失效，请重新登录')
      error.statusCode = 401
      throw error
    }
    await connection.query(
      'UPDATE refresh_token SET revoked_at = NOW(), last_used_at = NOW() WHERE id = ?',
      [storedToken.token_id],
    )
    return createAuthSession(connection, storedToken, Number(storedToken.ttl_days) > sessionRefreshTokenDays)
  })
  response.json(session)
}))

app.post('/api/auth/logout', route(async (request, response) => {
  const refreshToken = String(request.body.refreshToken || '')
  if (refreshToken) {
    await pool.query(
      'UPDATE refresh_token SET revoked_at = NOW() WHERE token_hash = ? AND revoked_at IS NULL',
      [hashRefreshToken(refreshToken)],
    )
  }
  response.status(204).end()
}))

app.post('/api/auth/forgot-password', route(async (request, response) => {
  const clientIp = getClientIp(request)
  if (await isResetLocked(clientIp)) {
    return response.status(429).json({ message: '找回密码尝试次数过多，请 15 分钟后再试' })
  }
  const username = String(request.body.username || '').trim()
  const activationCode = String(request.body.activationCode || '').trim()
  const password = String(request.body.password || '')
  if (!isValidPassword(password)) return response.status(400).json({ message: '新密码需为 8-20 位，并包含大小写字母和数字' })
  const userId = await withTransaction(async connection => {
    const [[user]] = await connection.query(
      `SELECT user.id
       FROM app_user user
       JOIN activation_code code ON code.used_by_user_id = user.id
       WHERE user.username = ? AND code.code = ? AND user.status = 'active'
         AND code.status = 'used' AND (code.expires_at IS NULL OR code.expires_at > NOW())
       FOR UPDATE`,
      [username, activationCode],
    )
    if (!user) return null
    await connection.query(
      'UPDATE app_user SET password_hash = ? WHERE id = ?',
      [await bcrypt.hash(password, 10), user.id],
    )
    await connection.query(
      'UPDATE refresh_token SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL',
      [user.id],
    )
    return Number(user.id)
  })
  if (!userId) return rejectResetAttempt(response, clientIp)
  await clearResetFailures(clientIp)
  response.status(204).end()
}))

app.post('/api/auth/verify-reset', route(async (request, response) => {
  const clientIp = getClientIp(request)
  if (await isResetLocked(clientIp)) {
    return response.status(429).json({ message: '找回密码尝试次数过多，请 15 分钟后再试' })
  }
  const username = String(request.body.username || '').trim()
  const activationCode = String(request.body.activationCode || '').trim()
  const [[user]] = await pool.query(
    `SELECT user.id
     FROM app_user user
     JOIN activation_code code ON code.used_by_user_id = user.id
     WHERE user.username = ? AND code.code = ? AND user.status = 'active'
       AND code.status = 'used' AND (code.expires_at IS NULL OR code.expires_at > NOW())`,
    [username, activationCode],
  )
  if (!user) return rejectResetAttempt(response, clientIp)
  await clearResetFailures(clientIp)
  response.status(204).end()
}))

app.use('/api', authenticate)

app.post('/api/classes/reset-all', requireOwner, route(async (request, response) => {
  const mode = requireResetMode(request.body.mode)
  const password = String(request.body.password || '')
  const confirmation = String(request.body.confirmation || '')
  if (!password) badRequest('请输入当前密码')
  if (confirmation !== '重置全部班级') badRequest('请输入“重置全部班级”确认操作')
  await withTransaction(async connection => {
    await connection.query('SELECT id FROM tenant WHERE id = ? FOR UPDATE', [request.tenantId])
    const [[user]] = await connection.query(
      `SELECT password_hash FROM app_user
       WHERE tenant_id = ? AND id = ? AND status = 'active'
       FOR UPDATE`,
      [request.tenantId, request.user.userId],
    )
    if (!user || !await bcrypt.compare(password, user.password_hash)) badRequest('当前密码不正确')
    const [classes] = await connection.query(
      `SELECT id FROM class_room
       WHERE tenant_id = ? AND deleted = 0
       ORDER BY id
       FOR UPDATE`,
      [request.tenantId],
    )
    const classIds = classes.map(item => Number(item.id))
    const summary = await resetClassGrowthData(connection, request.tenantId, classIds, mode)
    await writeRequestAction(connection, request, 'RESET_ALL_CLASSES', { classIds, mode, ...summary })
  })
  response.status(204).end()
}))

app.use('/api/classes/:id', route(async (request, _response, next) => {
  await assertClassAccess(pool, request, request.params.id)
  next()
}))

app.use('/api/students/:id', route(async (request, _response, next) => {
  if (request.params.id === 'import') return next()
  const [[student]] = await pool.query(
    'SELECT class_id FROM student WHERE tenant_id = ? AND id = ?',
    [request.tenantId, request.params.id],
  )
  if (!student) notFound('学生不存在')
  await assertClassAccess(pool, request, student.class_id)
  next()
}))

app.use('/api/groups/:id', route(async (request, _response, next) => {
  const [[group]] = await pool.query(
    'SELECT class_id FROM student_group WHERE tenant_id = ? AND id = ? AND deleted = 0',
    [request.tenantId, request.params.id],
  )
  if (!group) notFound('小组不存在')
  await assertClassAccess(pool, request, group.class_id)
  next()
}))

app.use('/api/score-rules/:id', route(async (request, _response, next) => {
  const [[rule]] = await pool.query(
    'SELECT class_id FROM score_rule WHERE tenant_id = ? AND id = ? AND deleted = 0',
    [request.tenantId, request.params.id],
  )
  if (!rule) notFound('积分规则不存在')
  await assertClassAccess(pool, request, rule.class_id)
  next()
}))

app.get('/api/auth/me', route(async (request, response) => {
  response.json({
    id: request.user.userId,
    tenantId: request.tenantId,
    username: request.user.username,
    displayName: request.user.displayName,
    role: request.user.role,
  })
}))

app.post('/api/auth/change-password', route(async (request, response) => {
  const currentPassword = String(request.body.currentPassword || '')
  const newPassword = String(request.body.newPassword || '')
  if (!currentPassword) badRequest('请输入当前密码')
  if (!isValidPassword(newPassword)) badRequest('新密码需为 8-20 位，并包含大小写字母和数字')
  await withTransaction(async connection => {
    const [[user]] = await connection.query(
      `SELECT password_hash FROM app_user
       WHERE tenant_id = ? AND id = ? AND status = 'active'
       FOR UPDATE`,
      [request.tenantId, request.user.userId],
    )
    if (!user || !await bcrypt.compare(currentPassword, user.password_hash)) badRequest('当前密码不正确')
    await connection.query(
      'UPDATE app_user SET password_hash = ? WHERE tenant_id = ? AND id = ?',
      [await bcrypt.hash(newPassword, 10), request.tenantId, request.user.userId],
    )
    await connection.query(
      'UPDATE refresh_token SET revoked_at = NOW() WHERE tenant_id = ? AND user_id = ? AND revoked_at IS NULL',
      [request.tenantId, request.user.userId],
    )
    await writeRequestAction(connection, request, 'CHANGE_PASSWORD')
  })
  response.status(204).end()
}))

app.post('/api/auth/deactivate', route(async (request, response) => {
  const password = String(request.body.password || '')
  const confirmation = String(request.body.confirmation || '')
  if (!password) badRequest('请输入当前密码')
  if (confirmation !== '注销账号') badRequest('请输入“注销账号”确认操作')

  await withTransaction(async connection => {
    await connection.query('SELECT id FROM tenant WHERE id = ? FOR UPDATE', [request.tenantId])
    const [[user]] = await connection.query(
      `SELECT id, username, password_hash, role FROM app_user
       WHERE tenant_id = ? AND id = ? AND status = 'active'
       FOR UPDATE`,
      [request.tenantId, request.user.userId],
    )
    if (!user || !await bcrypt.compare(password, user.password_hash)) badRequest('当前密码不正确')
    if (user.role === 'owner') {
      const [[otherActiveUser]] = await connection.query(
        `SELECT id FROM app_user
         WHERE tenant_id = ? AND id <> ? AND status = 'active'
         LIMIT 1
         FOR UPDATE`,
        [request.tenantId, user.id],
      )
      if (otherActiveUser) badRequest('租户管理员注销前，请先处理其他协作教师账号')
    }
    await connection.query(
      `UPDATE app_user SET status = 'disabled'
       WHERE tenant_id = ? AND id = ?`,
      [request.tenantId, user.id],
    )
    await connection.query(
      `UPDATE refresh_token SET revoked_at = NOW()
       WHERE tenant_id = ? AND user_id = ? AND revoked_at IS NULL`,
      [request.tenantId, user.id],
    )
    await writeRequestAction(connection, request, 'DEACTIVATE_ACCOUNT', {
      username: user.username,
      role: user.role,
    })
  })
  response.status(204).end()
}))

app.get('/api/bootstrap', route(async (request, response) => {
  response.json(await getBootstrap(request.user))
}))

app.get('/api/notifications', route(async (request, response) => {
  const limit = request.query.limit == null
    ? 30
    : requireInteger(request.query.limit, '通知数量', { min: 1, max: 100 })
  const [rows] = await pool.query(
    `SELECT id, class_id, student_id, notification_type, title, message, target_path,
            read_at, DATE_FORMAT(created_at, '%m-%d %H:%i') AS time
     FROM notification
     WHERE tenant_id = ? AND recipient_user_id = ?
     ORDER BY created_at DESC, id DESC
     LIMIT ?`,
    [request.tenantId, request.user.userId, limit],
  )
  response.json(rows.map(row => ({
    id: Number(row.id),
    classId: row.class_id == null ? null : Number(row.class_id),
    studentId: row.student_id == null ? null : Number(row.student_id),
    type: row.notification_type,
    title: row.title,
    message: row.message,
    targetPath: row.target_path,
    read: Boolean(row.read_at),
    time: row.time,
  })))
}))

app.get('/api/notifications/unread-count', route(async (request, response) => {
  const [[row]] = await pool.query(
    `SELECT COUNT(*) AS count FROM notification
     WHERE tenant_id = ? AND recipient_user_id = ? AND read_at IS NULL`,
    [request.tenantId, request.user.userId],
  )
  response.json({ count: Number(row.count) })
}))

app.put('/api/notifications/read-all', route(async (request, response) => {
  await pool.query(
    `UPDATE notification SET read_at = COALESCE(read_at, NOW())
     WHERE tenant_id = ? AND recipient_user_id = ?`,
    [request.tenantId, request.user.userId],
  )
  response.status(204).end()
}))

app.put('/api/notifications/:id/read', route(async (request, response) => {
  const notificationId = requireInteger(request.params.id, '通知 ID', { min: 1 })
  const [result] = await pool.query(
    `UPDATE notification SET read_at = COALESCE(read_at, NOW())
     WHERE tenant_id = ? AND recipient_user_id = ? AND id = ?`,
    [request.tenantId, request.user.userId, notificationId],
  )
  if (!result.affectedRows) notFound('通知不存在')
  response.status(204).end()
}))

app.post('/api/notifications/announcements', requireOwner, route(async (request, response) => {
  const title = requireText(request.body.title, '公告标题', 50)
  const message = requireText(request.body.message, '公告内容', 200)
  const targetPath = optionalText(request.body.targetPath, '跳转路径', 255) || '/dashboard'
  if (!targetPath.startsWith('/dashboard')) badRequest('公告跳转路径必须是系统内部页面')
  await withTransaction(async connection => {
    await createNotifications(connection, {
      tenantId: request.tenantId,
      type: 'system',
      title,
      message,
      targetPath,
    })
    await writeRequestAction(connection, request, 'CREATE_SYSTEM_ANNOUNCEMENT', { title, targetPath })
  })
  response.status(201).json({ created: true })
}))

app.get('/api/badges/custom', route(async (request, response) => {
  const classId = requireInteger(request.query.classId, '班级 ID', { min: 1 })
  await assertClassAccess(pool, request, classId)
  const [rows] = await pool.query(
    `SELECT id, class_id, name, icon, description, enabled
     FROM custom_badge
     WHERE tenant_id = ? AND class_id = ? AND deleted = 0
     ORDER BY id`,
    [request.tenantId, classId],
  )
  response.json(rows.map(mapCustomBadge))
}))

app.post('/api/badges/custom', route(async (request, response) => {
  const classId = requireInteger(request.body.classId, '班级 ID', { min: 1 })
  const name = requireText(request.body.name, '徽章名称', 40)
  const icon = optionalText(request.body.icon, '徽章图标', 32) || '🏅'
  const description = optionalText(request.body.description, '徽章说明', 100)
  await assertClassPermission(pool, request, classId, 'can_manage_config')
  const id = await withTransaction(async connection => {
    const [[lockedClass]] = await connection.query(
      'SELECT id FROM class_room WHERE tenant_id = ? AND id = ? AND deleted = 0 FOR UPDATE',
      [request.tenantId, classId],
    )
    if (!lockedClass) badRequest('班级不存在或已删除')
    const [[count]] = await connection.query(
      'SELECT COUNT(*) AS count FROM custom_badge WHERE tenant_id = ? AND class_id = ? AND deleted = 0',
      [request.tenantId, classId],
    )
    if (Number(count.count) >= resourceLimits.customBadgesPerClass) badRequest('每个班级最多创建 50 种自定义徽章')
    const [created] = await connection.query(
      `INSERT INTO custom_badge
        (tenant_id, class_id, name, icon, description, created_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [request.tenantId, classId, name, icon, description, request.user.userId],
    )
    await writeRequestAction(connection, request, 'CREATE_CUSTOM_BADGE', {
      classId,
      customBadgeId: Number(created.insertId),
      name,
      icon,
      description,
    })
    return Number(created.insertId)
  })
  response.status(201).json({ id })
}))

app.put('/api/badges/custom/:id', route(async (request, response) => {
  const customBadgeId = requireInteger(request.params.id, '自定义徽章 ID', { min: 1 })
  const updates = []
  const params = []
  const snapshot = {}
  if (Object.hasOwn(request.body, 'name')) {
    snapshot.name = requireText(request.body.name, '徽章名称', 40)
    updates.push('name = ?')
    params.push(snapshot.name)
  }
  if (Object.hasOwn(request.body, 'icon')) {
    snapshot.icon = optionalText(request.body.icon, '徽章图标', 32) || '🏅'
    updates.push('icon = ?')
    params.push(snapshot.icon)
  }
  if (Object.hasOwn(request.body, 'description')) {
    snapshot.description = optionalText(request.body.description, '徽章说明', 100)
    updates.push('description = ?')
    params.push(snapshot.description)
  }
  if (Object.hasOwn(request.body, 'enabled')) {
    snapshot.enabled = requireBoolean(request.body.enabled, '启用状态')
    updates.push('enabled = ?')
    params.push(snapshot.enabled ? 1 : 0)
  }
  if (!updates.length) badRequest('没有可更新的自定义徽章字段')
  await withTransaction(async connection => {
    const [[badge]] = await connection.query(
      `SELECT id, class_id, name, icon, description, enabled
       FROM custom_badge
       WHERE tenant_id = ? AND id = ? AND deleted = 0
       FOR UPDATE`,
      [request.tenantId, customBadgeId],
    )
    if (!badge) notFound('自定义徽章不存在')
    await assertClassPermission(connection, request, badge.class_id, 'can_manage_config')
    await connection.query(
      `UPDATE custom_badge SET ${updates.join(', ')} WHERE tenant_id = ? AND id = ?`,
      [...params, request.tenantId, customBadgeId],
    )
    await writeRequestAction(connection, request, 'UPDATE_CUSTOM_BADGE', {
      classId: Number(badge.class_id),
      customBadgeId,
      previous: {
        name: badge.name,
        icon: badge.icon,
        description: badge.description,
        enabled: Boolean(badge.enabled),
      },
      next: snapshot,
    })
  })
  response.status(204).end()
}))

app.delete('/api/badges/custom/:id', route(async (request, response) => {
  const customBadgeId = requireInteger(request.params.id, '自定义徽章 ID', { min: 1 })
  await withTransaction(async connection => {
    const [[badge]] = await connection.query(
      `SELECT id, class_id, name, icon
       FROM custom_badge
       WHERE tenant_id = ? AND id = ? AND deleted = 0
       FOR UPDATE`,
      [request.tenantId, customBadgeId],
    )
    if (!badge) notFound('自定义徽章不存在')
    await assertClassPermission(connection, request, badge.class_id, 'can_manage_config')
    await connection.query(
      'UPDATE custom_badge SET deleted = 1, enabled = 0 WHERE tenant_id = ? AND id = ?',
      [request.tenantId, customBadgeId],
    )
    await writeRequestAction(connection, request, 'DELETE_CUSTOM_BADGE', {
      classId: Number(badge.class_id),
      customBadgeId,
      name: badge.name,
      icon: badge.icon,
    })
  })
  response.status(204).end()
}))

app.get('/api/badges/records', route(async (request, response) => {
  const classId = requireInteger(request.query.classId, '班级 ID', { min: 1 })
  const from = request.query.from ? String(request.query.from) : ''
  const to = request.query.to ? String(request.query.to) : ''
  if (from && !isValidIsoDate(from)) badRequest('开始日期格式不正确')
  if (to && !isValidIsoDate(to)) badRequest('结束日期格式不正确')
  if (from && to && from > to) badRequest('开始日期不能晚于结束日期')
  const studentId = request.query.studentId
    ? requireInteger(request.query.studentId, '学生 ID', { min: 1 })
    : null
  const customBadgeId = request.query.customBadgeId
    ? requireInteger(request.query.customBadgeId, '自定义徽章 ID', { min: 1 })
    : null
  const type = request.query.type ? String(request.query.type) : ''
  if (type && !['milestone', 'exchange', 'manual', 'weekly', 'monthly', 'semester'].includes(type)) {
    badRequest('徽章流水类型不正确')
  }
  await assertClassAccess(pool, request, classId)
  response.json(await getBadgeRecords(request.tenantId, classId, { from, to, studentId, customBadgeId, type }))
}))

app.post('/api/badges/awards', route(async (request, response) => {
  const classId = requireInteger(request.body.classId, '班级 ID', { min: 1 })
  const studentId = requireInteger(request.body.studentId, '学生 ID', { min: 1 })
  const customBadgeId = requireInteger(request.body.customBadgeId, '自定义徽章 ID', { min: 1 })
  const amount = requireInteger(request.body.amount, '颁发数量', { min: 1, max: 1000 })
  await assertClassPermission(pool, request, classId, 'can_score')
  const id = await withTransaction(async connection => {
    const [[lockedClass]] = await connection.query(
      'SELECT id FROM class_room WHERE tenant_id = ? AND id = ? AND deleted = 0 FOR UPDATE',
      [request.tenantId, classId],
    )
    if (!lockedClass) badRequest('班级不存在或已删除')
    const [[badge]] = await connection.query(
      `SELECT id, class_id, name, icon, description
       FROM custom_badge
       WHERE tenant_id = ? AND id = ? AND class_id = ? AND deleted = 0 AND enabled = 1
       FOR UPDATE`,
      [request.tenantId, customBadgeId, classId],
    )
    if (!badge) badRequest('自定义徽章不存在或已停用')
    const [[student]] = await connection.query(
      `SELECT id, class_id, name
       FROM student
       WHERE tenant_id = ? AND id = ? AND class_id = ? AND deleted = 0
       FOR UPDATE`,
      [request.tenantId, studentId, classId],
    )
    if (!student) badRequest('学生不存在或不属于当前班级')
    await connection.query(
      'UPDATE student SET badge_balance = badge_balance + ? WHERE tenant_id = ? AND id = ?',
      [amount, request.tenantId, studentId],
    )
    const [created] = await connection.query(
      `INSERT INTO badge_record
        (tenant_id, class_id, student_id, badge_type, amount, description,
         custom_badge_id, custom_badge_name, badge_icon, student_name, operator_user_id, operator_name)
       VALUES (?, ?, ?, 'manual', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        request.tenantId,
        classId,
        studentId,
        amount,
        badge.description || `教师颁发《${badge.name}》`,
        badge.id,
        badge.name,
        badge.icon,
        student.name,
        request.user.userId,
        request.user.displayName,
      ],
    )
    await writeRequestAction(connection, request, 'AWARD_BADGE', {
      classId,
      studentId,
      studentName: student.name,
      customBadgeId,
      customBadgeName: badge.name,
      icon: badge.icon,
      amount,
    })
    await createNotifications(connection, {
      tenantId: request.tenantId,
      classId,
      studentId,
      type: 'badge_awarded',
      title: '教师颁发徽章',
      message: `${student.name} 获得 ${amount} 枚《${badge.name}》`,
      targetPath: '/dashboard/badges',
      dedupeKey: `manual-badge:${created.insertId}`,
    })
    return Number(created.insertId)
  })
  response.status(201).json({ id })
}))

app.get('/api/action-logs', route(async (request, response) => {
  const page = request.query.page == null
    ? 1
    : requireInteger(request.query.page, '页码', { min: 1, max: 1_000_000 })
  const pageSize = request.query.pageSize == null
    ? 20
    : requireInteger(request.query.pageSize, '每页数量', { min: 1, max: 100 })
  const conditions = ['log.tenant_id = ?']
  const params = [request.tenantId]
  const from = request.query.from ? String(request.query.from) : ''
  const to = request.query.to ? String(request.query.to) : ''
  if (from && !isValidIsoDate(from)) badRequest('开始日期格式不正确')
  if (to && !isValidIsoDate(to)) badRequest('结束日期格式不正确')
  if (from && to && from > to) badRequest('开始日期不能晚于结束日期')
  if (request.user.role !== 'owner') {
    conditions.push(`(
      log.operator_user_id = ? OR EXISTS (
        SELECT 1 FROM class_teacher access
        WHERE access.tenant_id = log.tenant_id
          AND access.class_id = log.class_id
          AND access.user_id = ?
      )
    )`)
    params.push(request.user.userId, request.user.userId)
  }
  if (request.query.classId) {
    const classId = requireInteger(request.query.classId, '班级 ID', { min: 1 })
    await assertClassAccess(pool, request, classId)
    conditions.push('log.class_id = ?')
    params.push(classId)
  }
  if (request.query.studentId) {
    conditions.push('log.student_id = ?')
    params.push(requireInteger(request.query.studentId, '学生 ID', { min: 1 }))
  }
  if (request.query.actionType) {
    const actionType = String(request.query.actionType).trim()
    if (actionType.length > 50) badRequest('操作类型不能超过 50 个字符')
    conditions.push('log.action_type = ?')
    params.push(actionType)
  }
  if (from) {
    conditions.push('log.created_at >= ?')
    params.push(from)
  }
  if (to) {
    conditions.push('log.created_at <= ?')
    params.push(`${to} 23:59:59`)
  }
  const where = conditions.join(' AND ')
  const [[count]] = await pool.query(`SELECT COUNT(*) AS total FROM action_log log WHERE ${where}`, params)
  const [rows] = await pool.query(
    `SELECT log.id, log.class_id, log.student_id, log.action_type, log.detail_json,
            DATE_FORMAT(log.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
            class_room.name AS class_name, student.name AS student_name,
            user.username AS operator_username, user.display_name AS operator_name
     FROM action_log log
     LEFT JOIN class_room ON class_room.id = log.class_id
     LEFT JOIN student ON student.id = log.student_id
     LEFT JOIN app_user user ON user.id = log.operator_user_id
     WHERE ${where}
     ORDER BY log.created_at DESC, log.id DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize],
  )
  response.json({
    items: rows.map(item => ({
      id: Number(item.id),
      classId: item.class_id == null ? null : Number(item.class_id),
      className: item.class_name,
      studentId: item.student_id == null ? null : Number(item.student_id),
      studentName: item.student_name,
      actionType: item.action_type,
      detail: parseJson(item.detail_json, {}),
      operatorUsername: item.operator_username,
      operatorName: item.operator_name,
      createdAt: item.created_at,
    })),
    total: Number(count.total),
    page,
    pageSize,
  })
}))

app.post('/api/classes', requireOwner, route(async (request, response) => {
  const { name } = request.body
  const copyFromClassId = request.body.copyFromClassId == null || request.body.copyFromClassId === ''
    ? null
    : requireInteger(request.body.copyFromClassId, '来源班级 ID', { min: 1 })
  const normalizedName = String(name || '').trim()
  if (!normalizedName || normalizedName.length > 32) return response.status(400).json({ message: '班级名称不能为空且最多 32 个字符' })
  const classId = await withTransaction(async connection => {
    const [[tenant]] = await connection.query('SELECT id FROM tenant WHERE id = ? FOR UPDATE', [request.tenantId])
    if (!tenant) notFound('租户不存在')
    const [[count]] = await connection.query(
      'SELECT COUNT(*) AS count FROM class_room WHERE tenant_id = ? AND deleted = 0',
      [request.tenantId],
    )
    if (Number(count.count) >= resourceLimits.classesPerTenant) badRequest('每个租户最多创建 100 个班级')
    const [[existing]] = await connection.query(
      'SELECT id FROM class_room WHERE tenant_id = ? AND name = ? AND deleted = 0',
      [request.tenantId, normalizedName],
    )
    if (existing) badRequest('当前租户已存在同名班级')
    if (copyFromClassId) {
      const [[sourceClass]] = await connection.query(
        'SELECT id FROM class_room WHERE tenant_id = ? AND id = ? AND deleted = 0',
        [request.tenantId, copyFromClassId],
      )
      if (!sourceClass) badRequest('来源班级不存在或已删除')
    }
    const [result] = await connection.query(
      'INSERT INTO class_room (tenant_id, name, gradient_from, gradient_to) VALUES (?, ?, ?, ?)',
      [request.tenantId, normalizedName, gradients[0][0], gradients[0][1]],
    )
    const id = Number(result.insertId)
    const gradient = gradients[(id - 1) % gradients.length]
    await connection.query(
      'UPDATE class_room SET gradient_from = ?, gradient_to = ? WHERE tenant_id = ? AND id = ?',
      [gradient[0], gradient[1], request.tenantId, id],
    )
    const [sourceGroups] = copyFromClassId
      ? await connection.query(
        `SELECT name, color, bg_class, text_class, border_color, is_ungrouped
         FROM student_group
         WHERE tenant_id = ? AND class_id = ? AND deleted = 0
         ORDER BY is_ungrouped DESC, id`,
        [request.tenantId, copyFromClassId],
      )
      : [[]]
    const groupsToCreate = sourceGroups.length
      ? sourceGroups.map((group, index) => [
        Number(group.is_ungrouped) ? `ungrouped-${id}` : `copy-${id}-${index}`,
        group.name,
        group.color,
        group.bg_class,
        group.text_class,
        Number(group.is_ungrouped),
        group.border_color,
      ])
      : groupTemplates.map(([key, groupName, color, bgClass, textClass, isUngrouped]) => [
        `${key}-${id}`,
        groupName,
        color,
        bgClass,
        textClass,
        isUngrouped,
        color,
      ])
    if (groupsToCreate.filter(([, , , , , isUngrouped]) => Number(isUngrouped) === 1).length !== 1) {
      badRequest('来源班级的未分组配置不正确')
    }
    for (const [groupId, groupName, color, bgClass, textClass, isUngrouped, borderColor] of groupsToCreate) {
      await connection.query(
        `INSERT INTO student_group
          (id, tenant_id, class_id, name, color, bg_class, text_class, border_color, is_ungrouped)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [groupId, request.tenantId, id, groupName, color, bgClass, textClass, borderColor, isUngrouped],
      )
    }
    const [sourceRules] = copyFromClassId
      ? await connection.query(
        `SELECT name, icon, score_value, enabled, is_quick, sort_order
         FROM score_rule
         WHERE tenant_id = ? AND class_id = ? AND deleted = 0
         ORDER BY sort_order, id`,
        [request.tenantId, copyFromClassId],
      )
      : [[]]
    const rulesToCreate = sourceRules.length
      ? sourceRules.map(rule => [rule.name, rule.icon, Number(rule.score_value), Number(rule.enabled), Number(rule.is_quick), Number(rule.sort_order)])
      : scoreRuleTemplates.map(([ruleName, icon, value, isQuick], index) => [ruleName, icon, value, 1, isQuick, index + 1])
    if (rulesToCreate.length > resourceLimits.scoreRulesPerClass) badRequest('来源班级积分规则超过 50 条，无法复制')
    for (const [ruleName, icon, value, enabled, isQuick, order] of rulesToCreate) {
      await connection.query(
        `INSERT INTO score_rule
          (tenant_id, class_id, name, icon, score_value, enabled, is_quick, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [request.tenantId, id, ruleName, icon, value, enabled, isQuick, order],
      )
    }
    await connection.query(
      `INSERT INTO class_teacher (tenant_id, class_id, user_id, added_by_user_id)
       VALUES (?, ?, ?, ?)`,
      [request.tenantId, id, request.user.userId, request.user.userId],
    )
    await writeRequestAction(connection, request, 'CREATE_CLASS', { classId: id, name: normalizedName, copyFromClassId })
    return id
  })
  response.status(201).json({ id: classId })
}))

app.get('/api/classes/:id/teachers', route(async (request, response) => {
  const [rows] = await pool.query(
    `SELECT user.id, user.username, user.display_name, user.role,
            class_teacher.created_at, class_teacher.added_by_user_id,
            class_teacher.can_score, class_teacher.can_manage_students, class_teacher.can_manage_config
     FROM class_teacher
     JOIN app_user user ON user.id = class_teacher.user_id
     WHERE class_teacher.tenant_id = ? AND class_teacher.class_id = ?
     ORDER BY user.role = 'owner' DESC, user.display_name, user.id`,
    [request.tenantId, request.params.id],
  )
  response.json(rows.map(item => ({
    id: Number(item.id),
    username: item.username,
    displayName: item.display_name,
    role: item.role,
    permissions: item.role === 'owner'
      ? { canScore: true, canManageStudents: true, canManageConfig: true }
      : mapClassTeacherPermissions(item),
    addedByUserId: item.added_by_user_id == null ? null : Number(item.added_by_user_id),
    createdAt: item.created_at,
  })))
}))

app.post('/api/classes/:id/teachers', requireOwner, route(async (request, response) => {
  const classId = Number(request.params.id)
  const username = String(request.body.username || '').trim()
  const permissions = requireClassTeacherPermissions(request.body.permissions, { canScore: true })
  if (!username) return response.status(400).json({ message: '请输入教师用户名' })
  const [[user]] = await pool.query(
    `SELECT id, username, display_name, role
     FROM app_user WHERE tenant_id = ? AND username = ? AND status = 'active'`,
    [request.tenantId, username],
  )
  if (!user) return response.status(404).json({ message: '未找到该租户下的教师账号' })
  const [result] = await pool.query(
    `INSERT IGNORE INTO class_teacher
       (tenant_id, class_id, user_id, added_by_user_id, can_score, can_manage_students, can_manage_config)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      request.tenantId,
      classId,
      user.id,
      request.user.userId,
      permissions.canScore ? 1 : 0,
      permissions.canManageStudents ? 1 : 0,
      permissions.canManageConfig ? 1 : 0,
    ],
  )
  if (!result.affectedRows) return response.status(400).json({ message: '该教师已在班级中' })
  await writeRequestAction(pool, request, 'ADD_CLASS_TEACHER', {
    classId,
    teacherUserId: Number(user.id),
    teacherUsername: user.username,
    permissions,
  })
  response.status(201).json({
    id: Number(user.id),
    username: user.username,
    displayName: user.display_name,
    role: user.role,
    permissions: user.role === 'owner'
      ? { canScore: true, canManageStudents: true, canManageConfig: true }
      : permissions,
  })
}))

app.put('/api/classes/:id/teachers/:userId', requireOwner, route(async (request, response) => {
  const classId = Number(request.params.id)
  const userId = Number(request.params.userId)
  const permissions = requireClassTeacherPermissions(request.body.permissions)
  await withTransaction(async connection => {
    const [[teacher]] = await connection.query(
      `SELECT user.username, user.role,
              class_teacher.can_score, class_teacher.can_manage_students, class_teacher.can_manage_config
       FROM class_teacher
       JOIN app_user user ON user.id = class_teacher.user_id
       WHERE class_teacher.tenant_id = ? AND class_teacher.class_id = ? AND class_teacher.user_id = ?
       FOR UPDATE`,
      [request.tenantId, classId, userId],
    )
    if (!teacher) notFound('该教师不在当前班级中')
    if (teacher.role === 'owner') badRequest('不能修改租户管理员的班级权限')
    await connection.query(
      `UPDATE class_teacher
       SET can_score = ?, can_manage_students = ?, can_manage_config = ?
       WHERE tenant_id = ? AND class_id = ? AND user_id = ?`,
      [
        permissions.canScore ? 1 : 0,
        permissions.canManageStudents ? 1 : 0,
        permissions.canManageConfig ? 1 : 0,
        request.tenantId,
        classId,
        userId,
      ],
    )
    await writeRequestAction(connection, request, 'UPDATE_CLASS_TEACHER', {
      classId,
      teacherUserId: userId,
      teacherUsername: teacher.username,
      previous: mapClassTeacherPermissions(teacher),
      next: permissions,
    })
  })
  response.status(204).end()
}))

app.delete('/api/classes/:id/teachers/:userId', requireOwner, route(async (request, response) => {
  const classId = Number(request.params.id)
  const userId = Number(request.params.userId)
  const [[user]] = await pool.query(
    'SELECT username, role FROM app_user WHERE tenant_id = ? AND id = ?',
    [request.tenantId, userId],
  )
  if (!user) return response.status(404).json({ message: '教师账号不存在' })
  if (user.role === 'owner') return response.status(400).json({ message: '不能移出租户管理员' })
  const [result] = await pool.query(
    'DELETE FROM class_teacher WHERE tenant_id = ? AND class_id = ? AND user_id = ?',
    [request.tenantId, classId, userId],
  )
  if (!result.affectedRows) return response.status(404).json({ message: '该教师不在当前班级中' })
  await writeRequestAction(pool, request, 'REMOVE_CLASS_TEACHER', {
    classId,
    teacherUserId: userId,
    teacherUsername: user.username,
  })
  response.status(204).end()
}))

app.put('/api/classes/:id', route(async (request, response) => {
  const classId = Number(request.params.id)
  const name = String(request.body.name || '').trim()
  if (!name || name.length > 32) return response.status(400).json({ message: '班级名称不能为空且最多 32 个字符' })
  await assertClassPermission(pool, request, classId, 'can_manage_config')
  await withTransaction(async connection => {
    await connection.query('SELECT id FROM tenant WHERE id = ? FOR UPDATE', [request.tenantId])
    const [[classRoom]] = await connection.query(
      'SELECT name FROM class_room WHERE tenant_id = ? AND id = ? AND deleted = 0 FOR UPDATE',
      [request.tenantId, classId],
    )
    if (!classRoom) notFound('班级不存在')
    if (classRoom.name === name) return
    const [[existing]] = await connection.query(
      'SELECT id FROM class_room WHERE tenant_id = ? AND name = ? AND id <> ? AND deleted = 0',
      [request.tenantId, name, classId],
    )
    if (existing) badRequest('当前租户已存在同名班级')
    await connection.query(
      'UPDATE class_room SET name = ? WHERE tenant_id = ? AND id = ? AND deleted = 0',
      [name, request.tenantId, classId],
    )
    await writeRequestAction(connection, request, 'UPDATE_CLASS', {
      classId,
      previousName: classRoom.name,
      name,
    })
  })
  response.status(204).end()
}))

app.delete('/api/classes/:id', route(async (request, response) => {
  const classId = Number(request.params.id)
  await assertClassPermission(pool, request, classId, 'can_manage_config')
  await withTransaction(async connection => {
    const [[classRoom]] = await connection.query(
      'SELECT name FROM class_room WHERE tenant_id = ? AND id = ? AND deleted = 0 FOR UPDATE',
      [request.tenantId, classId],
    )
    if (!classRoom) notFound('班级不存在')
    await connection.query('UPDATE class_room SET deleted = 1 WHERE tenant_id = ? AND id = ?', [request.tenantId, classId])
    const [deletedStudents] = await connection.query('UPDATE student SET deleted = 1 WHERE tenant_id = ? AND class_id = ? AND deleted = 0', [request.tenantId, classId])
    const [deletedGroups] = await connection.query('UPDATE student_group SET deleted = 1 WHERE tenant_id = ? AND class_id = ? AND deleted = 0', [request.tenantId, classId])
    const [deletedRules] = await connection.query('UPDATE score_rule SET deleted = 1 WHERE tenant_id = ? AND class_id = ? AND deleted = 0', [request.tenantId, classId])
    await writeRequestAction(connection, request, 'DELETE_CLASS', {
      classId,
      name: classRoom.name,
      deletedStudentCount: Number(deletedStudents.affectedRows),
      deletedGroupCount: Number(deletedGroups.affectedRows),
      deletedRuleCount: Number(deletedRules.affectedRows),
    })
  })
  response.status(204).end()
}))

app.post('/api/classes/:id/reset', route(async (request, response) => {
  const classId = Number(request.params.id)
  const mode = requireResetMode(request.body.mode)
  if (request.body.confirmation !== '重置当前班级') badRequest('请输入“重置当前班级”确认操作')
  await assertClassPermission(pool, request, classId, 'can_manage_config')
  await withTransaction(async connection => {
    const [[classRoom]] = await connection.query(
      `SELECT id FROM class_room
       WHERE tenant_id = ? AND id = ? AND deleted = 0
       FOR UPDATE`,
      [request.tenantId, classId],
    )
    if (!classRoom) notFound('班级不存在')
    const summary = await resetClassGrowthData(connection, request.tenantId, [classId], mode)
    await writeRequestAction(connection, request, 'RESET_CLASS', {
      classId,
      mode,
      ...summary,
    })
  })
  response.status(204).end()
}))

app.post('/api/groups', route(async (request, response) => {
  const id = `custom-${request.tenantId}-${crypto.randomUUID()}`
  const classId = requireInteger(request.body.classId, '班级 ID', { min: 1 })
  const name = requireText(request.body.name, '小组名称', 20)
  const color = String(request.body.color || '#4ecdc4')
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) badRequest('小组颜色格式不正确')
  await assertClassPermission(pool, request, classId, 'can_manage_config')
  await withTransaction(async connection => {
    const [[classRoom]] = await connection.query(
      'SELECT id FROM class_room WHERE tenant_id = ? AND id = ? AND deleted = 0 FOR UPDATE',
      [request.tenantId, classId],
    )
    if (!classRoom) badRequest('班级不存在')
    const [[existing]] = await connection.query(
      'SELECT id FROM student_group WHERE tenant_id = ? AND class_id = ? AND name = ? AND deleted = 0',
      [request.tenantId, classId, name],
    )
    if (existing) badRequest('当前班级已存在同名小组')
    await connection.query(
      `INSERT INTO student_group
        (id, tenant_id, class_id, name, color, bg_class, text_class, border_color)
       VALUES (?, ?, ?, ?, ?, '', '', ?)`,
      [id, request.tenantId, classId, name, color, color],
    )
    await writeRequestAction(connection, request, 'CREATE_GROUP', { classId, groupId: id, name })
  })
  response.status(201).json({ id })
}))

app.put('/api/groups/:id', route(async (request, response) => {
  const name = requireText(request.body.name, '小组名称', 20)
  await withTransaction(async connection => {
    const [[group]] = await connection.query(
      `SELECT class_id, name, is_ungrouped FROM student_group
       WHERE tenant_id = ? AND id = ? AND deleted = 0
       FOR UPDATE`,
      [request.tenantId, request.params.id],
    )
    if (!group) notFound('小组不存在')
    await assertClassPermission(connection, request, group.class_id, 'can_manage_config')
    if (group.is_ungrouped) badRequest('未分组小组不能重命名')
    if (group.name === name) return
    const [[existing]] = await connection.query(
      `SELECT id FROM student_group
       WHERE tenant_id = ? AND class_id = ? AND id <> ? AND name = ? AND deleted = 0
       LIMIT 1`,
      [request.tenantId, group.class_id, request.params.id, name],
    )
    if (existing) badRequest('当前班级已存在同名小组')
    await connection.query(
      'UPDATE student_group SET name = ? WHERE tenant_id = ? AND id = ?',
      [name, request.tenantId, request.params.id],
    )
    await writeRequestAction(connection, request, 'UPDATE_GROUP', {
      classId: Number(group.class_id),
      groupId: request.params.id,
      previousName: group.name,
      name,
    })
  })
  response.status(204).end()
}))

app.delete('/api/groups/:id', route(async (request, response) => {
  await withTransaction(async connection => {
    const [[group]] = await connection.query(
      'SELECT class_id, name, is_ungrouped FROM student_group WHERE tenant_id = ? AND id = ? AND deleted = 0 FOR UPDATE',
      [request.tenantId, request.params.id],
    )
    if (!group) notFound('小组不存在')
    await assertClassPermission(connection, request, group.class_id, 'can_manage_config')
    if (group.is_ungrouped) badRequest('未分组小组不能删除')
    const [[ungrouped]] = await connection.query(
      'SELECT id FROM student_group WHERE tenant_id = ? AND class_id = ? AND is_ungrouped = 1 AND deleted = 0 FOR UPDATE',
      [request.tenantId, group.class_id],
    )
    if (!ungrouped) throw new Error('当前班级缺少未分组小组')
    const [movedStudents] = await connection.query(
      'UPDATE student SET group_id = ? WHERE tenant_id = ? AND group_id = ? AND deleted = 0',
      [ungrouped.id, request.tenantId, request.params.id],
    )
    await connection.query('UPDATE student_group SET deleted = 1 WHERE tenant_id = ? AND id = ?', [request.tenantId, request.params.id])
    await writeRequestAction(connection, request, 'DELETE_GROUP', {
      classId: Number(group.class_id),
      groupId: request.params.id,
      name: group.name,
      movedStudentCount: Number(movedStudents.affectedRows),
    })
  })
  response.status(204).end()
}))

app.post('/api/students', route(async (request, response) => {
  const { classId, groupId, name, petId = null, petNickname = '' } = request.body
  const normalizedClassId = requireInteger(classId, '班级 ID', { min: 1 })
  const normalizedName = String(name || '').trim()
  if (!normalizedName || normalizedName.length > 20) return response.status(400).json({ message: '学生姓名不能为空且最多 20 个字符' })
  const normalizedPetId = optionalIdentifier(petId, '宠物 ID')
  const normalizedPetNickname = optionalText(petNickname, '宠物昵称', 20)
  await assertClassPermission(pool, request, normalizedClassId, 'can_manage_students')
  const result = await withTransaction(async connection => {
    const [[classRoom]] = await connection.query(
      'SELECT id FROM class_room WHERE tenant_id = ? AND id = ? AND deleted = 0 FOR UPDATE',
      [request.tenantId, normalizedClassId],
    )
    if (!classRoom) badRequest('班级不存在或已删除')
    const [[count]] = await connection.query(
      'SELECT COUNT(*) AS count FROM student WHERE tenant_id = ? AND class_id = ? AND deleted = 0',
      [request.tenantId, normalizedClassId],
    )
    if (Number(count.count) >= resourceLimits.studentsPerClass) badRequest('每个班级最多创建 200 名学生')
    const [[group]] = await connection.query(
      'SELECT id FROM student_group WHERE tenant_id = ? AND class_id = ? AND id = ? AND deleted = 0 FOR UPDATE',
      [request.tenantId, normalizedClassId, groupId],
    )
    if (!group) badRequest('学生小组不存在或不属于当前班级')
    const [[existing]] = await connection.query(
      'SELECT id FROM student WHERE tenant_id = ? AND class_id = ? AND name = ? AND deleted = 0',
      [request.tenantId, normalizedClassId, normalizedName],
    )
    if (existing) badRequest('当前班级已存在同名学生')
    const [created] = await connection.query(
      `INSERT INTO student (tenant_id, class_id, group_id, name, pet_id, pet_nickname)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [request.tenantId, normalizedClassId, groupId, normalizedName, normalizedPetId, normalizedPetNickname],
    )
    await writeRequestAction(connection, request, 'CREATE_STUDENT', {
      classId: normalizedClassId,
      studentId: Number(created.insertId),
      name: normalizedName,
      groupId,
      petId: normalizedPetId,
      petNickname: normalizedPetNickname,
    })
    return created
  })
  response.status(201).json({ id: Number(result.insertId) })
}))

app.post('/api/students/import', route(async (request, response) => {
  const classId = requireInteger(request.body.classId, '班级 ID', { min: 1 })
  const rows = Array.isArray(request.body.rows) ? request.body.rows.slice(0, 201) : []
  if (!rows.length) return response.status(400).json({ message: '请提供待导入学生' })
  if (rows.length > 200) return response.status(400).json({ message: '单次最多导入 200 名学生' })
  await assertClassPermission(pool, request, classId, 'can_manage_students')
  const result = await withTransaction(async connection => {
    const [[classRoom]] = await connection.query(
      'SELECT id FROM class_room WHERE tenant_id = ? AND id = ? AND deleted = 0 FOR UPDATE',
      [request.tenantId, classId],
    )
    if (!classRoom) badRequest('班级不存在或已删除')
    const [groups] = await connection.query(
      `SELECT id, is_ungrouped
       FROM student_group WHERE tenant_id = ? AND class_id = ? AND deleted = 0
       FOR UPDATE`,
      [request.tenantId, classId],
    )
    const groupIds = new Set(groups.map(item => item.id))
    const ungrouped = groups.find(item => item.is_ungrouped)
    if (!ungrouped) throw new Error('当前班级缺少未分组小组')
    const [existingStudents] = await connection.query(
      `SELECT name FROM student
       WHERE tenant_id = ? AND class_id = ? AND deleted = 0
       FOR UPDATE`,
      [request.tenantId, classId],
    )
    const existingNames = new Set(existingStudents.map(item => item.name))
    const results = []
    let created = 0
    let skipped = 0
    let failed = 0
    for (let position = 0; position < rows.length; position += 1) {
      const row = rows[position] || {}
      const index = Number(row.index) || position + 1
      const name = String(row.name || '').trim()
      const groupId = String(row.groupId || ungrouped.id)
      const petId = row.petId ? String(row.petId) : null
      if (!name || name.length > 20) {
        failed += 1
        results.push({ index, name, status: 'failed', reason: '姓名不能为空且最多 20 个字符' })
        continue
      }
      if (!groupIds.has(groupId)) {
        failed += 1
        results.push({ index, name, status: 'failed', reason: '小组不存在' })
        continue
      }
      if (petId && (!/^[a-zA-Z0-9_-]+$/.test(petId) || petId.length > 64)) {
        failed += 1
        results.push({ index, name, status: 'failed', reason: '宠物 ID 格式不正确' })
        continue
      }
      if (existingNames.has(name)) {
        skipped += 1
        results.push({ index, name, status: 'skipped', reason: '当前班级已存在同名学生' })
        continue
      }
      if (existingStudents.length + created >= resourceLimits.studentsPerClass) {
        failed += 1
        results.push({ index, name, status: 'failed', reason: '每个班级最多创建 200 名学生' })
        continue
      }
      const [student] = await connection.query(
        `INSERT INTO student (tenant_id, class_id, group_id, name, pet_id)
         VALUES (?, ?, ?, ?, ?)`,
        [request.tenantId, classId, groupId, name, petId],
      )
      existingNames.add(name)
      created += 1
      results.push({ index, name, studentId: Number(student.insertId), status: 'created' })
    }
    await writeRequestAction(connection, request, 'IMPORT_STUDENTS', {
      classId,
      created,
      skipped,
      failed,
    })
    return { created, skipped, failed, rows: results }
  })
  response.status(201).json(result)
}))

app.put('/api/students/:id', route(async (request, response) => {
  await withTransaction(async connection => {
    const [[student]] = await connection.query(
      `SELECT class_id, name, group_id, pet_id, pet_nickname, score FROM student
       WHERE tenant_id = ? AND id = ? AND deleted = 0
       FOR UPDATE`,
      [request.tenantId, request.params.id],
    )
    if (!student) notFound('学生不存在')
    await assertClassPermission(connection, request, student.class_id, 'can_manage_students')
    if (Object.hasOwn(request.body, 'name')) {
      const name = String(request.body.name || '').trim()
      if (!name || name.length > 20) badRequest('学生姓名不能为空且最多 20 个字符')
      const [[existing]] = await connection.query(
        'SELECT id FROM student WHERE tenant_id = ? AND class_id = ? AND name = ? AND id <> ? AND deleted = 0',
        [request.tenantId, student.class_id, name, request.params.id],
      )
      if (existing) badRequest('当前班级已存在同名学生')
      request.body.name = name
    }
    if (Object.hasOwn(request.body, 'petId')) {
      request.body.petId = optionalIdentifier(request.body.petId, '宠物 ID')
      await assertPetChangeAllowed(connection, request.tenantId, student, request.body.petId)
    }
    if (Object.hasOwn(request.body, 'petNickname')) request.body.petNickname = optionalText(request.body.petNickname, '宠物昵称', 20)
    const allowed = {
      name: 'name',
      groupId: 'group_id',
      petId: 'pet_id',
      petNickname: 'pet_nickname',
    }
    const updates = Object.entries(allowed)
      .filter(([key]) => Object.hasOwn(request.body, key))
      .map(([key, column]) => ({ column, value: request.body[key] }))
    if (!updates.length) return
    if (Object.hasOwn(request.body, 'groupId')) {
      const [[group]] = await connection.query(
        'SELECT id FROM student_group WHERE tenant_id = ? AND class_id = ? AND id = ? AND deleted = 0 FOR UPDATE',
        [request.tenantId, student.class_id, request.body.groupId],
      )
      if (!group) badRequest('目标小组不存在或不属于学生班级')
    }
    await connection.query(
      `UPDATE student SET ${updates.map(item => `${item.column} = ?`).join(', ')}
       WHERE tenant_id = ? AND id = ?`,
      [...updates.map(item => item.value), request.tenantId, request.params.id],
    )
    await writeRequestAction(connection, request, 'UPDATE_STUDENT', {
      classId: Number(student.class_id),
      studentId: Number(request.params.id),
      fields: updates.map(item => item.column),
      previous: {
        name: student.name,
        groupId: student.group_id,
        petId: student.pet_id,
        petNickname: student.pet_nickname,
      },
      next: {
        name: Object.hasOwn(request.body, 'name') ? request.body.name : student.name,
        groupId: Object.hasOwn(request.body, 'groupId') ? request.body.groupId : student.group_id,
        petId: Object.hasOwn(request.body, 'petId') ? request.body.petId : student.pet_id,
        petNickname: Object.hasOwn(request.body, 'petNickname') ? request.body.petNickname : student.pet_nickname,
      },
    })
  })
  response.status(204).end()
}))

app.delete('/api/students/:id', route(async (request, response) => {
  await withTransaction(async connection => {
    const [[student]] = await connection.query(
      `SELECT class_id, group_id, name, pet_id, pet_nickname, score, badge_balance
       FROM student WHERE tenant_id = ? AND id = ? AND deleted = 0 FOR UPDATE`,
      [request.tenantId, request.params.id],
    )
    if (!student) notFound('学生不存在或已删除')
    await assertClassPermission(connection, request, student.class_id, 'can_manage_students')
    await connection.query('UPDATE student SET deleted = 1 WHERE tenant_id = ? AND id = ? AND deleted = 0', [request.tenantId, request.params.id])
    await writeRequestAction(connection, request, 'DELETE_STUDENT', {
      classId: Number(student.class_id),
      studentId: Number(request.params.id),
      name: student.name,
      groupId: student.group_id,
      petId: student.pet_id,
      petNickname: student.pet_nickname,
      score: Number(student.score),
      badgeBalance: Number(student.badge_balance),
    })
  })
  response.status(204).end()
}))

app.post('/api/students/:id/restore', route(async (request, response) => {
  const [[candidate]] = await pool.query(
    'SELECT class_id FROM student WHERE tenant_id = ? AND id = ? AND deleted = 1',
    [request.tenantId, request.params.id],
  )
  if (!candidate) notFound('待恢复学生不存在')
  await assertClassPermission(pool, request, Number(candidate.class_id), 'can_manage_students')
  const restoredStudent = await withTransaction(async connection => {
    const [[classRoom]] = await connection.query(
      'SELECT id FROM class_room WHERE tenant_id = ? AND id = ? AND deleted = 0 FOR UPDATE',
      [request.tenantId, candidate.class_id],
    )
    if (!classRoom) badRequest('学生所属班级不存在或已删除')
    const [[student]] = await connection.query(
      'SELECT class_id, group_id, name FROM student WHERE tenant_id = ? AND id = ? AND deleted = 1 FOR UPDATE',
      [request.tenantId, request.params.id],
    )
    if (!student) notFound('待恢复学生不存在')
    const [[count]] = await connection.query(
      'SELECT COUNT(*) AS count FROM student WHERE tenant_id = ? AND class_id = ? AND deleted = 0',
      [request.tenantId, student.class_id],
    )
    if (Number(count.count) >= resourceLimits.studentsPerClass) badRequest('每个班级最多创建 200 名学生，暂时无法恢复')

    const [[duplicate]] = await connection.query(
      `SELECT id FROM student
       WHERE tenant_id = ? AND class_id = ? AND name = ? AND id <> ? AND deleted = 0
       LIMIT 1 FOR UPDATE`,
      [request.tenantId, student.class_id, student.name, request.params.id],
    )
    if (duplicate) badRequest('当前班级已存在同名学生，无法恢复')

    const [[group]] = await connection.query(
      `SELECT id FROM student_group
       WHERE tenant_id = ? AND class_id = ? AND id = ? AND deleted = 0
       FOR UPDATE`,
      [request.tenantId, student.class_id, student.group_id],
    )
    let groupId = student.group_id
    if (!group) {
      const [[ungroupedGroup]] = await connection.query(
        `SELECT id FROM student_group
         WHERE tenant_id = ? AND class_id = ? AND is_ungrouped = 1 AND deleted = 0
         LIMIT 1 FOR UPDATE`,
        [request.tenantId, student.class_id],
      )
      if (!ungroupedGroup) throw new Error('当前班级缺少未分组小组')
      groupId = ungroupedGroup.id
    }

    await connection.query(
      'UPDATE student SET deleted = 0, group_id = ? WHERE tenant_id = ? AND id = ? AND deleted = 1',
      [groupId, request.tenantId, request.params.id],
    )
    await writeRequestAction(connection, request, 'RESTORE_STUDENT', {
      classId: Number(student.class_id),
      studentId: Number(request.params.id),
      name: student.name,
      groupId,
    })
    return student
  })
  if (!restoredStudent) return response.status(404).json({ message: '待恢复学生不存在' })
  response.status(204).end()
}))

app.put('/api/students/:id/pet', route(async (request, response) => {
  const petId = optionalIdentifier(request.body.petId, '宠物 ID')
  const petNickname = optionalText(request.body.petNickname, '宠物昵称', 20)
  await withTransaction(async connection => {
    const [[student]] = await connection.query(
      `SELECT class_id, pet_id, pet_nickname, score FROM student
       WHERE tenant_id = ? AND id = ? AND deleted = 0
       FOR UPDATE`,
      [request.tenantId, request.params.id],
    )
    if (!student) notFound('学生不存在或已删除')
    await assertClassPermission(connection, request, student.class_id, 'can_manage_students')
    await assertPetChangeAllowed(connection, request.tenantId, student, petId)
    await connection.query(
      'UPDATE student SET pet_id = ?, pet_nickname = ? WHERE tenant_id = ? AND id = ? AND deleted = 0',
      [petId, petNickname, request.tenantId, request.params.id],
    )
    await writeRequestAction(connection, request, 'UPDATE_STUDENT_PET', {
      classId: Number(student.class_id),
      studentId: Number(request.params.id),
      previousPetId: student.pet_id,
      previousPetNickname: student.pet_nickname,
      petId,
      petNickname,
    })
  })
  response.status(204).end()
}))

app.get('/api/students/:id/cosmetics', route(async (request, response) => {
  const [[student]] = await pool.query(
    'SELECT id FROM student WHERE tenant_id = ? AND id = ? AND deleted = 0',
    [request.tenantId, request.params.id],
  )
  if (!student) return response.status(404).json({ message: '学生不存在或已删除' })
  const [rows] = await pool.query(
    `SELECT cosmetic_type, cosmetic_id, source_shop_item_id, created_at
     FROM student_cosmetic_inventory
     WHERE tenant_id = ? AND student_id = ?
     ORDER BY created_at, id`,
    [request.tenantId, request.params.id],
  )
  response.json(rows.map(item => ({
    cosmeticType: item.cosmetic_type,
    cosmeticId: item.cosmetic_id,
    sourceShopItemId: item.source_shop_item_id == null ? null : Number(item.source_shop_item_id),
    createdAt: item.created_at,
  })))
}))

app.put('/api/students/:id/cosmetics', route(async (request, response) => {
  const cosmetics = request.body
  const normalizedCosmetics = {
    toyId: optionalIdentifier(cosmetics.toyId, '玩具装扮 ID'),
    headId: optionalIdentifier(cosmetics.headId, '头部装扮 ID'),
    backId: optionalIdentifier(cosmetics.backId, '背部装扮 ID'),
    neckId: optionalIdentifier(cosmetics.neckId, '颈部装扮 ID'),
    faceId: optionalIdentifier(cosmetics.faceId, '脸部装扮 ID'),
  }
  const equippedCosmetics = [
    ['toy', normalizedCosmetics.toyId],
    ['head', normalizedCosmetics.headId],
    ['back', normalizedCosmetics.backId],
    ['neck', normalizedCosmetics.neckId],
    ['face', normalizedCosmetics.faceId],
  ].filter(([, cosmeticId]) => cosmeticId)
  const equippedCosmeticIds = equippedCosmetics.map(([, cosmeticId]) => cosmeticId)
  await withTransaction(async connection => {
    const [[student]] = await connection.query(
      `SELECT class_id, toy_id, head_id, back_id, neck_id, face_id
       FROM student WHERE tenant_id = ? AND id = ? AND deleted = 0 FOR UPDATE`,
      [request.tenantId, request.params.id],
    )
    if (!student) notFound('学生不存在或已删除')
    await assertClassPermission(connection, request, student.class_id, 'can_manage_students')
    if (equippedCosmeticIds.length) {
      const [ownedCosmetics] = await connection.query(
        `SELECT cosmetic_type, cosmetic_id
         FROM student_cosmetic_inventory
         WHERE tenant_id = ? AND student_id = ? AND cosmetic_id IN (?)`,
        [request.tenantId, request.params.id, equippedCosmeticIds],
      )
      const ownedTypes = new Map(ownedCosmetics.map(item => [item.cosmetic_id, item.cosmetic_type]))
      if (equippedCosmetics.some(([cosmeticType, cosmeticId]) => ownedTypes.get(cosmeticId) !== cosmeticType)) {
        badRequest('学生尚未拥有所选装扮，或装扮类型不匹配')
      }
    }
    await connection.query(
      `UPDATE student SET toy_id = ?, head_id = ?, back_id = ?, neck_id = ?, face_id = ?
       WHERE tenant_id = ? AND id = ? AND deleted = 0`,
      [normalizedCosmetics.toyId, normalizedCosmetics.headId, normalizedCosmetics.backId, normalizedCosmetics.neckId, normalizedCosmetics.faceId, request.tenantId, request.params.id],
    )
    await writeRequestAction(connection, request, 'UPDATE_STUDENT_COSMETICS', {
      classId: Number(student.class_id),
      studentId: Number(request.params.id),
      previous: mapStudentCosmeticsSnapshot(student),
      next: normalizedCosmetics,
    })
  })
  response.status(204).end()
}))

app.post('/api/score-rules', route(async (request, response) => {
  const classId = requireInteger(request.body.classId, '班级 ID', { min: 1 })
  const { name, icon, value, enabled, isQuick, order } = validateScoreRule(request.body)
  await assertClassPermission(pool, request, classId, 'can_manage_config')
  const id = await withTransaction(async connection => {
    const [[classRoom]] = await connection.query(
      'SELECT id FROM class_room WHERE tenant_id = ? AND id = ? AND deleted = 0 FOR UPDATE',
      [request.tenantId, classId],
    )
    if (!classRoom) badRequest('班级不存在或已删除')
    const [[count]] = await connection.query(
      'SELECT COUNT(*) AS count FROM score_rule WHERE tenant_id = ? AND class_id = ? AND deleted = 0',
      [request.tenantId, classId],
    )
    if (Number(count.count) >= resourceLimits.scoreRulesPerClass) badRequest('每个班级最多创建 50 条积分规则')
    const [result] = await connection.query(
      `INSERT INTO score_rule
        (tenant_id, class_id, name, icon, score_value, enabled, is_quick, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [request.tenantId, classId, name, icon, value, enabled, isQuick, order],
    )
    await writeRequestAction(connection, request, 'CREATE_SCORE_RULE', {
      classId: Number(classId),
      ruleId: Number(result.insertId),
      name,
      icon,
      value,
      enabled,
      isQuick,
      order,
    })
    return Number(result.insertId)
  })
  response.status(201).json({ id })
}))

app.put('/api/score-rules/:id', route(async (request, response) => {
  const values = validateScoreRule(request.body, true)
  const allowed = {
    name: 'name',
    icon: 'icon',
    value: 'score_value',
    enabled: 'enabled',
    isQuick: 'is_quick',
    order: 'sort_order',
  }
  const updates = Object.entries(allowed)
    .filter(([key]) => Object.hasOwn(request.body, key))
    .map(([key, column]) => ({ column, value: values[key] }))
  if (updates.length) {
    await withTransaction(async connection => {
      const [[rule]] = await connection.query(
        `SELECT class_id, name, icon, score_value, enabled, is_quick, sort_order
         FROM score_rule WHERE tenant_id = ? AND id = ? AND deleted = 0 FOR UPDATE`,
        [request.tenantId, request.params.id],
      )
      if (!rule) notFound('积分规则不存在')
      await assertClassPermission(connection, request, rule.class_id, 'can_manage_config')
      await connection.query(
        `UPDATE score_rule SET ${updates.map(item => `${item.column} = ?`).join(', ')}
         WHERE tenant_id = ? AND id = ? AND deleted = 0`,
        [...updates.map(item => item.value), request.tenantId, request.params.id],
      )
      const next = {
        ...mapScoreRuleSnapshot(rule),
        ...Object.fromEntries(Object.keys(allowed)
          .filter(key => Object.hasOwn(request.body, key))
          .map(key => [key, values[key]])),
      }
      await writeRequestAction(connection, request, 'UPDATE_SCORE_RULE', {
        classId: Number(rule.class_id),
        ruleId: Number(request.params.id),
        previous: mapScoreRuleSnapshot(rule),
        next,
      })
    })
  }
  response.status(204).end()
}))

app.delete('/api/score-rules/:id', route(async (request, response) => {
  await withTransaction(async connection => {
    const [[rule]] = await connection.query(
      `SELECT class_id, name, icon, score_value, enabled, is_quick, sort_order
       FROM score_rule WHERE tenant_id = ? AND id = ? AND deleted = 0 FOR UPDATE`,
      [request.tenantId, request.params.id],
    )
    if (!rule) notFound('积分规则不存在')
    await assertClassPermission(connection, request, rule.class_id, 'can_manage_config')
    await connection.query('UPDATE score_rule SET deleted = 1 WHERE tenant_id = ? AND id = ? AND deleted = 0', [request.tenantId, request.params.id])
    await writeRequestAction(connection, request, 'DELETE_SCORE_RULE', {
      classId: Number(rule.class_id),
      ruleId: Number(request.params.id),
      ...mapScoreRuleSnapshot(rule),
    })
  })
  response.status(204).end()
}))

async function addScore(connection, request, studentId, ruleId) {
  const tenantId = request.tenantId
  const [[student]] = await connection.query(
    'SELECT id, class_id, name, score FROM student WHERE tenant_id = ? AND id = ? AND deleted = 0 FOR UPDATE',
    [tenantId, studentId],
  )
  if (!student) notFound('学生不存在')
  await assertClassPermission(connection, request, student.class_id, 'can_score')
  const [[rule]] = await connection.query(
    'SELECT id, name, score_value FROM score_rule WHERE tenant_id = ? AND class_id = ? AND id = ? AND deleted = 0 AND enabled = 1',
    [tenantId, student.class_id, ruleId],
  )
  if (!rule) notFound('积分规则不存在')

  const scoreBefore = Number(student.score)
  const scoreAfter = Math.max(0, scoreBefore + Number(rule.score_value))
  const deltaScore = scoreAfter - scoreBefore
  await connection.query('UPDATE student SET score = ? WHERE tenant_id = ? AND id = ?', [scoreAfter, tenantId, studentId])

  let badgesCount = 0
  if (scoreAfter > scoreBefore) {
    const firstMilestone = (Math.floor(scoreBefore / 100) + 1) * 100
    for (let milestone = firstMilestone; milestone <= scoreAfter; milestone += 100) {
      const [result] = await connection.query(
        `INSERT IGNORE INTO badge_record
          (tenant_id, class_id, student_id, badge_type, amount, description, milestone)
         VALUES (?, ?, ?, 'milestone', 1, ?, ?)`,
        [tenantId, student.class_id, studentId, `达到 ${milestone} 积分`, milestone],
      )
      if (result.affectedRows) badgesCount += 1
    }
  }
  if (badgesCount) {
    await connection.query('UPDATE student SET badge_balance = badge_balance + ? WHERE tenant_id = ? AND id = ?', [badgesCount, tenantId, studentId])
  }

  const [result] = await connection.query(
    `INSERT INTO score_action
      (tenant_id, class_id, student_id, rule_id, rule_name, student_name, delta_score, score_before, score_after)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [tenantId, student.class_id, studentId, rule.id, rule.name, student.name, deltaScore, scoreBefore, scoreAfter],
  )
  await writeRequestAction(connection, request, deltaScore >= 0 ? 'ADD_SCORE' : 'DEDUCT_SCORE', {
    classId: Number(student.class_id),
    studentId: Number(studentId),
    ruleId: Number(rule.id),
    deltaScore,
    badgeAwarded: badgesCount,
  })
  if (scoreAfter > scoreBefore) {
    const thresholds = await getTenantLevelThresholds(connection, tenantId)
    const levelBefore = getLevelFromThresholds(scoreBefore, thresholds)
    const levelAfter = getLevelFromThresholds(scoreAfter, thresholds)
    if (levelAfter > levelBefore) {
      const isMaxLevel = levelAfter === 4
      await createNotifications(connection, {
        tenantId,
        classId: Number(student.class_id),
        studentId: Number(studentId),
        type: isMaxLevel ? 'pet_max_level' : 'pet_level_up',
        title: isMaxLevel ? '宠物达到满级' : '宠物升级',
        message: `${student.name} 的宠物成长到 Lv.${levelAfter + 1}`,
        targetPath: '/dashboard',
        dedupeKey: `pet-level:${studentId}:${levelAfter}`,
      })
    }
  }
  if (badgesCount) {
    await createNotifications(connection, {
      tenantId,
      classId: Number(student.class_id),
      studentId: Number(studentId),
      type: 'badge_awarded',
      title: '获得里程碑徽章',
      message: `${student.name} 获得 ${badgesCount} 枚里程碑徽章`,
      targetPath: '/dashboard/badges',
      dedupeKey: `milestone-badge:${studentId}:${scoreAfter}`,
    })
  }
  return { actionId: Number(result.insertId), badgeAwarded: badgesCount > 0, badgesCount }
}

app.post('/api/scores', route(async (request, response) => {
  const studentId = requireInteger(request.body.studentId, '学生 ID', { min: 1 })
  const ruleId = requireInteger(request.body.ruleId, '规则 ID', { min: 1 })
  const result = await withTransaction(connection => addScore(connection, request, studentId, ruleId))
  response.status(201).json(result)
}))

app.post('/api/scores/batch', route(async (request, response) => {
  if (!Array.isArray(request.body.studentIds)) badRequest('学生列表必须是数组')
  const studentIds = [...new Set(request.body.studentIds.map(value => requireInteger(value, '学生 ID', { min: 1 })))]
  if (!studentIds.length || studentIds.length > 100) badRequest('批量积分每次必须选择 1 到 100 名学生')
  const ruleId = requireInteger(request.body.ruleId, '规则 ID', { min: 1 })
  const result = await withTransaction(async connection => {
    const lockStudentIds = [...studentIds].sort((left, right) => left - right)
    const [lockedStudents] = await connection.query(
      `SELECT id FROM student
       WHERE tenant_id = ? AND id IN (?) AND deleted = 0
       ORDER BY id FOR UPDATE`,
      [request.tenantId, lockStudentIds],
    )
    if (lockedStudents.length !== lockStudentIds.length) notFound('学生不存在')
    const actions = []
    for (const studentId of studentIds) {
      actions.push(await addScore(connection, request, studentId, ruleId))
    }
    return actions
  })
  response.status(201).json({ actions: result })
}))

app.post('/api/scores/:id/revert', route(async (request, response) => {
  await withTransaction(async connection => {
    const [[candidateAction]] = await connection.query(
      `SELECT id, class_id, student_id, delta_score, reverted,
              TIMESTAMPDIFF(SECOND, created_at, NOW()) AS age_seconds
       FROM score_action WHERE tenant_id = ? AND id = ?`,
      [request.tenantId, request.params.id],
    )
    if (!candidateAction || candidateAction.reverted || Number(candidateAction.age_seconds) > 86400) {
      badRequest('操作不存在、已撤回或超过 24 小时')
    }
    await assertClassPermission(connection, request, candidateAction.class_id, 'can_score')
    const [[student]] = await connection.query(
      'SELECT id FROM student WHERE tenant_id = ? AND id = ? FOR UPDATE',
      [request.tenantId, candidateAction.student_id],
    )
    if (!student) notFound('学生不存在')
    const [[action]] = await connection.query(
      `SELECT id, class_id, student_id, delta_score, reverted,
              TIMESTAMPDIFF(SECOND, created_at, NOW()) AS age_seconds
       FROM score_action WHERE tenant_id = ? AND id = ? FOR UPDATE`,
      [request.tenantId, request.params.id],
    )
    if (!action || action.reverted || Number(action.age_seconds) > 86400) badRequest('操作不存在、已撤回或超过 24 小时')
    await connection.query(
      'UPDATE student SET score = GREATEST(0, score - ?) WHERE tenant_id = ? AND id = ?',
      [action.delta_score, request.tenantId, action.student_id],
    )
    await connection.query('UPDATE score_action SET reverted = 1, reverted_at = NOW() WHERE tenant_id = ? AND id = ?', [request.tenantId, action.id])
    await writeRequestAction(connection, request, 'REVERT', {
      classId: Number(action.class_id),
      studentId: Number(action.student_id),
      scoreActionId: Number(action.id),
    })
  })
  response.status(204).end()
}))

app.put('/api/settings/level-thresholds', requireOwner, route(async (request, response) => {
  if (!Array.isArray(request.body.values)) return response.status(400).json({ message: '等级阈值必须是数组' })
  const values = request.body.values.map(Number)
  if (
    values.length !== 4
    || values.some(value => !Number.isInteger(value) || value <= 0)
    || values.some((value, index) => index > 0 && value <= values[index - 1])
  ) {
    return response.status(400).json({ message: '等级阈值必须是四个递增的正整数' })
  }
  await withTransaction(async connection => {
    const previousValues = await getTenantLevelThresholds(connection, request.tenantId)
    await connection.query(
      `INSERT INTO app_setting (tenant_id, setting_key, setting_value)
       VALUES (?, 'level_thresholds', ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [request.tenantId, JSON.stringify(values)],
    )
    await writeRequestAction(connection, request, 'UPDATE_LEVEL_THRESHOLDS', {
      previousValues,
      values,
    })
  })
  response.status(204).end()
}))

app.put('/api/settings/allow-pet-change', requireOwner, route(async (request, response) => {
  const enabled = requireBoolean(request.body.enabled, '允许更换宠物状态')
  await withTransaction(async connection => {
    const previousEnabled = await getAllowPetChange(connection, request.tenantId)
    await connection.query(
      `INSERT INTO app_setting (tenant_id, setting_key, setting_value)
       VALUES (?, 'allow_pet_change', ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [request.tenantId, JSON.stringify(enabled)],
    )
    await writeRequestAction(connection, request, 'UPDATE_ALLOW_PET_CHANGE', {
      previousEnabled,
      enabled,
    })
  })
  response.status(204).end()
}))

app.put('/api/settings/system-name', requireOwner, route(async (request, response) => {
  const systemName = requireText(request.body.systemName, '系统名称', 30)
  await withTransaction(async connection => {
    const [[setting]] = await connection.query(
      `SELECT setting_value FROM app_setting
       WHERE tenant_id = ? AND setting_key = 'system_name'`,
      [request.tenantId],
    )
    const previousSystemName = parseTextSetting(setting?.setting_value, '班级宠物园')
    await connection.query(
      `INSERT INTO app_setting (tenant_id, setting_key, setting_value)
       VALUES (?, 'system_name', ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [request.tenantId, JSON.stringify(systemName)],
    )
    await writeRequestAction(connection, request, 'UPDATE_SYSTEM_NAME', {
      previousSystemName,
      systemName,
    })
  })
  response.status(204).end()
}))

app.get('/api/shop/bootstrap', route(async (request, response) => {
  const classId = request.query.classId == null || request.query.classId === ''
    ? null
    : requireInteger(request.query.classId, '班级 ID', { min: 1 })
  if (!classId && request.user.role !== 'owner') badRequest('普通教师查询兑换记录时必须指定班级')
  if (classId) await assertClassAccess(pool, request, classId)
  response.json(await getShopBootstrap(request.tenantId, classId))
}))

app.get('/api/shop/exchange-records', route(async (request, response) => {
  const classId = requireInteger(request.query.classId, '班级 ID', { min: 1 })
  await assertClassAccess(pool, request, classId)
  const from = request.query.from ? String(request.query.from) : ''
  const to = request.query.to ? String(request.query.to) : ''
  if (from && !isValidIsoDate(from)) badRequest('开始日期格式不正确')
  if (to && !isValidIsoDate(to)) badRequest('结束日期格式不正确')
  if (from && to && from > to) badRequest('开始日期不能晚于结束日期')
  const studentId = request.query.studentId
    ? requireInteger(request.query.studentId, '学生 ID', { min: 1 })
    : null
  const category = request.query.category ? optionalText(request.query.category, '商品类别', 32) : ''
  const itemName = request.query.itemName ? optionalText(request.query.itemName, '商品名称', 50) : ''
  response.json(await getExchangeRecords(request.tenantId, classId, { from, to, studentId, category, itemName }))
}))

app.post('/api/shop/categories', requireOwner, route(async (request, response) => {
  const name = requireText(request.body.name, '分类名称', 32)
  if (name === '未分类') badRequest('“未分类”为系统内置分类')
  const [[existing]] = await pool.query(
    'SELECT id, deleted FROM shop_category WHERE tenant_id = ? AND name = ?',
    [request.tenantId, name],
  )
  if (existing) {
    if (!existing.deleted) badRequest('分类名称已存在')
    await pool.query(
      'UPDATE shop_category SET deleted = 0, sort_order = 100, is_system = 0 WHERE tenant_id = ? AND id = ?',
      [request.tenantId, existing.id],
    )
    await writeRequestAction(pool, request, 'RESTORE_SHOP_CATEGORY', {
      categoryId: Number(existing.id),
      name,
    })
    return response.status(201).json({ id: Number(existing.id) })
  }
  const [result] = await pool.query(
    'INSERT INTO shop_category (tenant_id, name, sort_order) VALUES (?, ?, 100)',
    [request.tenantId, name],
  )
  await writeRequestAction(pool, request, 'CREATE_SHOP_CATEGORY', {
    categoryId: Number(result.insertId),
    name,
  })
  response.status(201).json({ id: Number(result.insertId) })
}))

app.put('/api/shop/categories/:id', requireOwner, route(async (request, response) => {
  const name = requireText(request.body.name, '分类名称', 32)
  if (name === '未分类') badRequest('“未分类”为系统内置分类')
  await withTransaction(async connection => {
    const [[category]] = await connection.query(
      `SELECT name FROM shop_category
       WHERE tenant_id = ? AND id = ? AND deleted = 0 AND is_system = 0
       FOR UPDATE`,
      [request.tenantId, request.params.id],
    )
    if (!category) notFound('分类不存在或不可编辑')
    await connection.query(
      'UPDATE shop_category SET name = ? WHERE tenant_id = ? AND id = ?',
      [name, request.tenantId, request.params.id],
    )
    await writeRequestAction(connection, request, 'UPDATE_SHOP_CATEGORY', {
      categoryId: Number(request.params.id),
      previousName: category.name,
      name,
    })
  })
  response.status(204).end()
}))

app.delete('/api/shop/categories/:id', requireOwner, route(async (request, response) => {
  await withTransaction(async connection => {
    const [[category]] = await connection.query(
      `SELECT id, name, is_system
       FROM shop_category
       WHERE tenant_id = ? AND id = ? AND deleted = 0
       FOR UPDATE`,
      [request.tenantId, request.params.id],
    )
    if (!category) notFound('分类不存在')
    if (category.is_system) badRequest('系统内置分类不可删除')
    await connection.query(
      `INSERT INTO shop_category (tenant_id, name, sort_order, is_system, deleted)
       VALUES (?, '未分类', 0, 1, 0)
       ON DUPLICATE KEY UPDATE sort_order = 0, is_system = 1, deleted = 0`,
      [request.tenantId],
    )
    const [[uncategorized]] = await connection.query(
      `SELECT id FROM shop_category
       WHERE tenant_id = ? AND name = '未分类' AND deleted = 0
       FOR UPDATE`,
      [request.tenantId],
    )
    const [movedItems] = await connection.query(
      `UPDATE shop_item SET category_id = ?
       WHERE tenant_id = ? AND category_id = ? AND deleted = 0`,
      [uncategorized.id, request.tenantId, category.id],
    )
    await connection.query(
      'UPDATE shop_category SET deleted = 1 WHERE tenant_id = ? AND id = ? AND deleted = 0',
      [request.tenantId, category.id],
    )
    await writeRequestAction(connection, request, 'DELETE_SHOP_CATEGORY', {
      categoryId: Number(category.id),
      name: category.name,
      movedItemCount: Number(movedItems.affectedRows),
    })
  })
  response.status(204).end()
}))

app.post('/api/shop/items', requireOwner, route(async (request, response) => {
  const { categoryId, name, icon, description, price, stock, inLottery, lotteryProbability, cosmeticType, cosmeticId } = validateShopItem(request.body)
  const id = await withTransaction(async connection => {
    await connection.query('SELECT id FROM tenant WHERE id = ? FOR UPDATE', [request.tenantId])
    const [[count]] = await connection.query(
      'SELECT COUNT(*) AS count FROM shop_item WHERE tenant_id = ? AND deleted = 0',
      [request.tenantId],
    )
    if (Number(count.count) >= resourceLimits.shopItemsPerTenant) badRequest('每个租户最多创建 100 种小卖部商品')
    const [[category]] = await connection.query(
      'SELECT id FROM shop_category WHERE tenant_id = ? AND id = ? AND deleted = 0',
      [request.tenantId, categoryId],
    )
    if (!category) badRequest('商品分类不存在')
    const [result] = await connection.query(
      `INSERT INTO shop_item
        (tenant_id, category_id, name, icon, description, price, stock, join_lottery, lottery_probability, cosmetic_type, cosmetic_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [request.tenantId, categoryId, name, icon, description, price, stock, inLottery, lotteryProbability, cosmeticType, cosmeticId],
    )
    await writeRequestAction(connection, request, 'CREATE_SHOP_ITEM', {
      itemId: Number(result.insertId),
      categoryId,
      name,
      icon,
      description,
      price,
      stock,
      inLottery,
      lotteryProbability,
      cosmeticType,
      cosmeticId,
    })
    return Number(result.insertId)
  })
  response.status(201).json({ id })
}))

app.put('/api/shop/items/:id', requireOwner, route(async (request, response) => {
  const { categoryId, name, icon, description, price, stock, inLottery, lotteryProbability, cosmeticType, cosmeticId } = validateShopItem(request.body)
  await withTransaction(async connection => {
    const [[category]] = await connection.query(
      'SELECT id FROM shop_category WHERE tenant_id = ? AND id = ? AND deleted = 0',
      [request.tenantId, categoryId],
    )
    if (!category) badRequest('商品分类不存在')
    const [[item]] = await connection.query(
      `SELECT category_id, name, icon, description, price, stock, join_lottery, lottery_probability, cosmetic_type, cosmetic_id
       FROM shop_item WHERE tenant_id = ? AND id = ? AND deleted = 0 FOR UPDATE`,
      [request.tenantId, request.params.id],
    )
    if (!item) notFound('商品不存在')
    await connection.query(
      `UPDATE shop_item SET category_id = ?, name = ?, icon = ?, description = ?, price = ?, stock = ?, join_lottery = ?, lottery_probability = ?, cosmetic_type = ?, cosmetic_id = ?
       WHERE tenant_id = ? AND id = ? AND deleted = 0`,
      [categoryId, name, icon, description, price, stock, inLottery, lotteryProbability, cosmeticType, cosmeticId, request.tenantId, request.params.id],
    )
    await writeRequestAction(connection, request, 'UPDATE_SHOP_ITEM', {
      itemId: Number(request.params.id),
      previous: mapShopItemSnapshot(item),
      next: { categoryId, name, icon, description, price, stock, inLottery, lotteryProbability, cosmeticType, cosmeticId },
    })
  })
  response.status(204).end()
}))

app.delete('/api/shop/items/:id', requireOwner, route(async (request, response) => {
  await withTransaction(async connection => {
    const [[item]] = await connection.query(
      `SELECT category_id, name, icon, description, price, stock, join_lottery, lottery_probability, cosmetic_type, cosmetic_id
       FROM shop_item WHERE tenant_id = ? AND id = ? AND deleted = 0 FOR UPDATE`,
      [request.tenantId, request.params.id],
    )
    if (!item) notFound('商品不存在')
    await connection.query('UPDATE shop_item SET deleted = 1 WHERE tenant_id = ? AND id = ? AND deleted = 0', [request.tenantId, request.params.id])
    await writeRequestAction(connection, request, 'DELETE_SHOP_ITEM', {
      itemId: Number(request.params.id),
      ...mapShopItemSnapshot(item),
    })
  })
  response.status(204).end()
}))

app.post('/api/shop/exchanges', route(async (request, response) => {
  const studentId = requireInteger(request.body.studentId, '学生 ID', { min: 1 })
  const itemId = requireInteger(request.body.itemId, '商品 ID', { min: 1 })
  const result = await withTransaction(async connection => {
    const [[student]] = await connection.query(
      'SELECT id, class_id, name, badge_balance FROM student WHERE tenant_id = ? AND id = ? AND deleted = 0 FOR UPDATE',
      [request.tenantId, studentId],
    )
    const [[item]] = await connection.query(
      `SELECT item.id, item.name, item.icon, item.price, item.stock, item.cosmetic_type, item.cosmetic_id,
              category.name AS category
       FROM shop_item item JOIN shop_category category ON category.id = item.category_id
       WHERE item.tenant_id = ? AND item.id = ? AND item.deleted = 0 FOR UPDATE`,
      [request.tenantId, itemId],
    )
    if (!student || !item) notFound('学生或商品不存在')
    await assertClassPermission(connection, request, student.class_id, 'can_score')
    if (Number(item.stock) === 0) badRequest('商品库存不足')
    if (Number(student.badge_balance) < Number(item.price)) badRequest('学生徽章余额不足')
    if (item.cosmetic_id) {
      const [[ownedCosmetic]] = await connection.query(
        `SELECT id FROM student_cosmetic_inventory
         WHERE tenant_id = ? AND student_id = ? AND cosmetic_id = ?`,
        [request.tenantId, student.id, item.cosmetic_id],
      )
      if (ownedCosmetic) badRequest('学生已拥有该装扮')
    }
    await connection.query('UPDATE student SET badge_balance = badge_balance - ? WHERE tenant_id = ? AND id = ?', [item.price, request.tenantId, student.id])
    if (Number(item.stock) > 0) {
      await connection.query('UPDATE shop_item SET stock = stock - 1 WHERE tenant_id = ? AND id = ?', [request.tenantId, item.id])
      await createStockWarning(connection, request.tenantId, {
        source: 'shop',
        itemId: Number(item.id),
        itemName: item.name,
        stock: Number(item.stock) - 1,
      })
    }
    await connection.query(
      `INSERT INTO badge_record (tenant_id, class_id, student_id, badge_type, amount, description)
       VALUES (?, ?, ?, 'exchange', ?, ?)`,
      [request.tenantId, student.class_id, student.id, -Number(item.price), `兑换《${item.name}》`],
    )
    const [record] = await connection.query(
      `INSERT INTO exchange_record
        (tenant_id, class_id, student_id, shop_item_id, student_name, item_name, item_icon, category_name, badge_cost, operator_user_id, operator_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [request.tenantId, student.class_id, student.id, item.id, student.name, item.name, item.icon, item.category, item.price, request.user.userId, request.user.displayName],
    )
    if (item.cosmetic_id) {
      await connection.query(
        `INSERT INTO student_cosmetic_inventory
          (tenant_id, student_id, cosmetic_type, cosmetic_id, source_shop_item_id)
         VALUES (?, ?, ?, ?, ?)`,
        [request.tenantId, student.id, item.cosmetic_type, item.cosmetic_id, item.id],
      )
    }
    await writeRequestAction(connection, request, 'EXCHANGE', {
      classId: Number(student.class_id),
      studentId: Number(student.id),
      studentName: student.name,
      itemId: Number(item.id),
      itemName: item.name,
      category: item.category,
      badgeCost: Number(item.price),
      badgeBalanceBefore: Number(student.badge_balance),
      badgeBalanceAfter: Number(student.badge_balance) - Number(item.price),
      stockBefore: Number(item.stock),
      stockAfter: Number(item.stock) > 0 ? Number(item.stock) - 1 : Number(item.stock),
      cosmeticAdded: Boolean(item.cosmetic_id),
    })
    return { id: Number(record.insertId), cosmeticAdded: Boolean(item.cosmetic_id) }
  })
  response.status(201).json(result)
}))

app.get('/api/lottery/bootstrap', route(async (request, response) => {
  response.json(await getLotteryBootstrap(request.tenantId))
}))

app.post('/api/lottery/prizes', requireOwner, route(async (request, response) => {
  const { name, icon, probability, stock } = validateLotteryPrize(request.body)
  const id = await withTransaction(async connection => {
    await connection.query('SELECT id FROM tenant WHERE id = ? FOR UPDATE', [request.tenantId])
    const [[count]] = await connection.query(
      'SELECT COUNT(*) AS count FROM lottery_prize WHERE tenant_id = ? AND deleted = 0',
      [request.tenantId],
    )
    if (Number(count.count) >= resourceLimits.lotteryPrizesPerTenant) badRequest('每个租户最多创建 20 种独立抽奖奖品')
    const [result] = await connection.query(
      'INSERT INTO lottery_prize (tenant_id, name, icon, probability, stock) VALUES (?, ?, ?, ?, ?)',
      [request.tenantId, name, icon, probability, stock],
    )
    await writeRequestAction(connection, request, 'CREATE_LOTTERY_PRIZE', {
      prizeId: Number(result.insertId),
      name,
      icon,
      probability,
      stock,
      inLottery: true,
    })
    return Number(result.insertId)
  })
  response.status(201).json({ id })
}))

app.put('/api/lottery/prizes/:id', requireOwner, route(async (request, response) => {
  const { name, icon, probability, stock, inLottery } = validateLotteryPrize(request.body, true)
  await withTransaction(async connection => {
    const [[prize]] = await connection.query(
      `SELECT name, icon, probability, stock, enabled
       FROM lottery_prize WHERE tenant_id = ? AND id = ? AND deleted = 0 FOR UPDATE`,
      [request.tenantId, request.params.id],
    )
    if (!prize) notFound('奖品不存在')
    await connection.query(
      `UPDATE lottery_prize SET
        name = COALESCE(?, name),
        icon = COALESCE(?, icon),
        probability = COALESCE(?, probability),
        stock = COALESCE(?, stock),
        enabled = COALESCE(?, enabled)
       WHERE tenant_id = ? AND id = ? AND deleted = 0`,
      [name ?? null, icon ?? null, probability ?? null, stock ?? null, inLottery ?? null, request.tenantId, request.params.id],
    )
    await writeRequestAction(connection, request, 'UPDATE_LOTTERY_PRIZE', {
      prizeId: Number(request.params.id),
      previous: mapLotteryPrizeSnapshot(prize),
      next: {
        ...mapLotteryPrizeSnapshot(prize),
        ...(name === undefined ? {} : { name }),
        ...(icon === undefined ? {} : { icon }),
        ...(probability === undefined ? {} : { probability }),
        ...(stock === undefined ? {} : { stock }),
        ...(inLottery === undefined ? {} : { inLottery }),
      },
    })
  })
  response.status(204).end()
}))

app.delete('/api/lottery/prizes/:id', requireOwner, route(async (request, response) => {
  await withTransaction(async connection => {
    const [[prize]] = await connection.query(
      `SELECT name, icon, probability, stock, enabled
       FROM lottery_prize WHERE tenant_id = ? AND id = ? AND deleted = 0 FOR UPDATE`,
      [request.tenantId, request.params.id],
    )
    if (!prize) notFound('奖品不存在')
    await connection.query('UPDATE lottery_prize SET deleted = 1 WHERE tenant_id = ? AND id = ? AND deleted = 0', [request.tenantId, request.params.id])
    await writeRequestAction(connection, request, 'DELETE_LOTTERY_PRIZE', {
      prizeId: Number(request.params.id),
      ...mapLotteryPrizeSnapshot(prize),
    })
  })
  response.status(204).end()
}))

app.post('/api/lottery/draws', route(async (request, response) => {
  const prize = await withTransaction(async connection => {
    const [independentPrizes] = await connection.query(
      `SELECT id, name, icon, probability, stock
       FROM lottery_prize
       WHERE tenant_id = ? AND deleted = 0 AND enabled = 1 AND (stock = -1 OR stock > 0)
       FOR UPDATE`,
      [request.tenantId],
    )
    const [shopPrizes] = await connection.query(
      `SELECT item.id, item.name, item.icon, item.lottery_probability AS probability, item.stock
       FROM shop_item item
       JOIN shop_category category ON category.id = item.category_id
       WHERE item.tenant_id = ? AND item.deleted = 0 AND item.join_lottery = 1
         AND category.deleted = 0 AND (item.stock = -1 OR item.stock > 0)
       FOR UPDATE`,
      [request.tenantId],
    )
    const prizes = [
      ...independentPrizes.map(item => ({ ...item, source: 'independent', sourceId: Number(item.id) })),
      ...shopPrizes.map(item => ({ ...item, source: 'shop', sourceId: Number(item.id) })),
    ]
    if (!prizes.length) badRequest('奖池为空')
    const total = prizes.reduce((sum, item) => sum + Number(item.probability), 0)
    if (!Number.isFinite(total) || total <= 0) badRequest('奖池权重配置不正确')
    let random = Math.random() * total
    const winner = prizes.find(item => {
      random -= Number(item.probability)
      return random <= 0
    }) || prizes[prizes.length - 1]
    const stockBefore = Number(winner.stock)
    if (Number(winner.stock) > 0) {
      const table = winner.source === 'shop' ? 'shop_item' : 'lottery_prize'
      await connection.query(`UPDATE ${table} SET stock = stock - 1 WHERE tenant_id = ? AND id = ?`, [request.tenantId, winner.sourceId])
      winner.stock -= 1
      await createStockWarning(connection, request.tenantId, {
        source: winner.source === 'shop' ? 'shop' : 'lottery',
        itemId: winner.sourceId,
        itemName: winner.name,
        stock: Number(winner.stock),
      })
    }
    const [result] = await connection.query(
      `INSERT INTO lottery_draw_record
        (tenant_id, source_type, lottery_prize_id, shop_item_id, prize_name, prize_icon)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        request.tenantId,
        winner.source,
        winner.source === 'independent' ? winner.sourceId : null,
        winner.source === 'shop' ? winner.sourceId : null,
        winner.name,
        winner.icon,
      ],
    )
    await writeRequestAction(connection, request, 'LOTTERY_DRAW', {
      prizeId: `${winner.source === 'shop' ? 'shop' : 'prize'}-${winner.sourceId}`,
      prizeSource: winner.source,
      prizeName: winner.name,
      stockBefore,
      stockAfter: Number(winner.stock),
    })
    return {
      ...winner,
      id: `${winner.source === 'shop' ? 'shop' : 'prize'}-${winner.sourceId}`,
      probability: Number(winner.probability),
      stock: Number(winner.stock),
      inLottery: true,
      recordId: Number(result.insertId),
    }
  })
  response.status(201).json(prize)
}))

app.get('/api/ai/prompt-template', route(async (request, response) => {
  const template = await getDefaultAiPromptTemplate(pool, request.tenantId, request.user.userId)
  response.json({
    id: Number(template.id),
    name: template.name,
    promptText: template.prompt_text,
    updatedAt: template.updated_at,
  })
}))

app.put('/api/ai/prompt-template', requireOwner, route(async (request, response) => {
  const promptText = requireAiPromptText(request.body.promptText)
  const template = await withTransaction(async connection => {
    const current = await getDefaultAiPromptTemplate(connection, request.tenantId, request.user.userId)
    await connection.query(
      `UPDATE ai_prompt_template
       SET prompt_text = ?, updated_by_user_id = ?
       WHERE tenant_id = ? AND id = ?`,
      [promptText, request.user.userId, request.tenantId, current.id],
    )
    await writeRequestAction(connection, request, 'UPDATE_AI_PROMPT_TEMPLATE', {
      promptTemplateId: Number(current.id),
      previousLength: String(current.prompt_text).length,
      nextLength: promptText.length,
    })
    return { ...current, prompt_text: promptText }
  })
  response.json({
    id: Number(template.id),
    name: template.name,
    promptText: template.prompt_text,
  })
}))

app.get('/api/ai/reports', route(async (request, response) => {
  const classId = requireInteger(request.query.classId, '班级 ID', { min: 1 })
  await assertClassAccess(pool, request, classId)
  const studentId = request.query.studentId ? requireInteger(request.query.studentId, '学生 ID', { min: 1 }) : null
  const conditions = ['report.tenant_id = ?', 'report.class_id = ?', 'report.deleted = 0']
  const params = [request.tenantId, classId]
  if (studentId) {
    conditions.push('report.student_id = ?')
    params.push(studentId)
  }
  const [rows] = await pool.query(
    `SELECT report.*, DATE_FORMAT(report.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
            user.display_name AS created_by_name
     FROM ai_student_report report
     LEFT JOIN app_user user ON user.id = report.created_by_user_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY report.created_at DESC, report.id DESC
     LIMIT 200`,
    params,
  )
  response.json(rows.map(mapAiReport))
}))

app.get('/api/ai/report-jobs/:id', route(async (request, response) => {
  const jobId = requireInteger(request.params.id, '任务 ID', { min: 1 })
  const [[job]] = await pool.query(
    `SELECT job.*, DATE_FORMAT(job.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
            DATE_FORMAT(job.started_at, '%Y-%m-%d %H:%i:%s') AS started_at,
            DATE_FORMAT(job.completed_at, '%Y-%m-%d %H:%i:%s') AS completed_at,
            DATE_FORMAT(job.cancelled_at, '%Y-%m-%d %H:%i:%s') AS cancelled_at,
            user.display_name AS created_by_name
     FROM ai_report_job job
     LEFT JOIN app_user user ON user.id = job.created_by_user_id
     WHERE job.tenant_id = ? AND job.id = ?`,
    [request.tenantId, jobId],
  )
  if (!job) notFound('报告任务不存在')
  await assertClassAccess(pool, request, job.class_id)
  response.json(mapAiJob(job))
}))

app.post('/api/ai/report-jobs', route(async (request, response) => {
  const classId = requireInteger(request.body.classId, '班级 ID', { min: 1 })
  const studentIds = requireAiStudentIds(request.body.studentIds)
  await assertClassAccess(pool, request, classId)
  const job = await withTransaction(async connection => {
    const shouldDefer = process.env.NODE_ENV === 'test' && request.body.defer === true
    const template = await getDefaultAiPromptTemplate(connection, request.tenantId, request.user.userId)
    const [created] = await connection.query(
      `INSERT INTO ai_report_job
        (tenant_id, class_id, scope, status, total_count, target_student_ids, prompt_template_id,
         prompt_snapshot, created_by_user_id)
       VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
      [
        request.tenantId,
        classId,
        studentIds.length === 1 ? 'single' : 'batch',
        studentIds.length,
        JSON.stringify(studentIds),
        template.id,
        template.prompt_text,
        request.user.userId,
      ],
    )
    const jobId = Number(created.insertId)
    if (!shouldDefer) {
      await createAiReportsForJob(connection, request, jobId, classId, studentIds, template)
    }
    await writeRequestAction(connection, request, 'GENERATE_AI_REPORTS', {
      classId,
      jobId,
      studentIds,
      deferred: shouldDefer,
    })
    const [[row]] = await connection.query(
      `SELECT job.*, DATE_FORMAT(job.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
              DATE_FORMAT(job.started_at, '%Y-%m-%d %H:%i:%s') AS started_at,
              DATE_FORMAT(job.completed_at, '%Y-%m-%d %H:%i:%s') AS completed_at,
              DATE_FORMAT(job.cancelled_at, '%Y-%m-%d %H:%i:%s') AS cancelled_at,
              user.display_name AS created_by_name
       FROM ai_report_job job
       LEFT JOIN app_user user ON user.id = job.created_by_user_id
       WHERE job.tenant_id = ? AND job.id = ?`,
      [request.tenantId, jobId],
    )
    return row
  })
  response.status(201).json(mapAiJob(job))
}))

app.post('/api/ai/report-jobs/:id/cancel', route(async (request, response) => {
  const jobId = requireInteger(request.params.id, '任务 ID', { min: 1 })
  await withTransaction(async connection => {
    const [[job]] = await connection.query(
      `SELECT id, class_id, status FROM ai_report_job
       WHERE tenant_id = ? AND id = ? FOR UPDATE`,
      [request.tenantId, jobId],
    )
    if (!job) notFound('报告任务不存在')
    await assertClassAccess(connection, request, job.class_id)
    if (!['pending', 'running'].includes(job.status)) badRequest('只能取消待处理或运行中的任务')
    await connection.query(
      `UPDATE ai_report_job SET status = 'cancelled', cancelled_at = NOW(), completed_at = NOW()
       WHERE tenant_id = ? AND id = ?`,
      [request.tenantId, jobId],
    )
    await writeRequestAction(connection, request, 'CANCEL_AI_REPORT_JOB', {
      classId: Number(job.class_id),
      jobId,
    })
  })
  response.status(204).end()
}))

app.post('/api/ai/report-jobs/:id/retry', route(async (request, response) => {
  const jobId = requireInteger(request.params.id, '任务 ID', { min: 1 })
  const job = await withTransaction(async connection => {
    const [[jobRow]] = await connection.query(
      `SELECT id, class_id, status, target_student_ids, retry_count, prompt_template_id, prompt_snapshot
       FROM ai_report_job
       WHERE tenant_id = ? AND id = ? FOR UPDATE`,
      [request.tenantId, jobId],
    )
    if (!jobRow) notFound('报告任务不存在')
    await assertClassAccess(connection, request, jobRow.class_id)
    if (!['failed', 'cancelled', 'timed_out'].includes(jobRow.status)) badRequest('当前任务状态不支持重试')
    const studentIds = parseJson(jobRow.target_student_ids, [])
    await connection.query('DELETE FROM ai_student_report WHERE tenant_id = ? AND job_id = ?', [request.tenantId, jobId])
    await createAiReportsForJob(connection, request, jobId, Number(jobRow.class_id), studentIds, {
      id: jobRow.prompt_template_id,
      prompt_text: jobRow.prompt_snapshot,
    }, Number(jobRow.retry_count) + 1)
    await writeRequestAction(connection, request, 'RETRY_AI_REPORT_JOB', {
      classId: Number(jobRow.class_id),
      jobId,
    })
    const [[row]] = await connection.query(
      `SELECT job.*, DATE_FORMAT(job.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
              DATE_FORMAT(job.started_at, '%Y-%m-%d %H:%i:%s') AS started_at,
              DATE_FORMAT(job.completed_at, '%Y-%m-%d %H:%i:%s') AS completed_at,
              DATE_FORMAT(job.cancelled_at, '%Y-%m-%d %H:%i:%s') AS cancelled_at,
              user.display_name AS created_by_name
       FROM ai_report_job job
       LEFT JOIN app_user user ON user.id = job.created_by_user_id
       WHERE job.tenant_id = ? AND job.id = ?`,
      [request.tenantId, jobId],
    )
    return row
  })
  response.json(mapAiJob(job))
}))

app.post('/api/ai/reports/:id/regenerate', route(async (request, response) => {
  const reportId = requireInteger(request.params.id, '报告 ID', { min: 1 })
  const job = await withTransaction(async connection => {
    const [[report]] = await connection.query(
      `SELECT class_id, student_id FROM ai_student_report
       WHERE tenant_id = ? AND id = ? AND deleted = 0 FOR UPDATE`,
      [request.tenantId, reportId],
    )
    if (!report) notFound('学情报告不存在')
    await assertClassAccess(connection, request, report.class_id)
    await connection.query('UPDATE ai_student_report SET deleted = 1 WHERE tenant_id = ? AND id = ?', [request.tenantId, reportId])
    const template = await getDefaultAiPromptTemplate(connection, request.tenantId, request.user.userId)
    const [created] = await connection.query(
      `INSERT INTO ai_report_job
        (tenant_id, class_id, scope, status, total_count, target_student_ids, prompt_template_id,
         prompt_snapshot, created_by_user_id)
       VALUES (?, ?, 'single', 'pending', 1, ?, ?, ?, ?)`,
      [request.tenantId, report.class_id, JSON.stringify([Number(report.student_id)]), template.id, template.prompt_text, request.user.userId],
    )
    const jobId = Number(created.insertId)
    await createAiReportsForJob(connection, request, jobId, Number(report.class_id), [Number(report.student_id)], template)
    await writeRequestAction(connection, request, 'REGENERATE_AI_REPORT', {
      classId: Number(report.class_id),
      studentId: Number(report.student_id),
      previousReportId: reportId,
      jobId,
    })
    const [[row]] = await connection.query(
      `SELECT job.*, DATE_FORMAT(job.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
              DATE_FORMAT(job.started_at, '%Y-%m-%d %H:%i:%s') AS started_at,
              DATE_FORMAT(job.completed_at, '%Y-%m-%d %H:%i:%s') AS completed_at,
              DATE_FORMAT(job.cancelled_at, '%Y-%m-%d %H:%i:%s') AS cancelled_at,
              user.display_name AS created_by_name
       FROM ai_report_job job
       LEFT JOIN app_user user ON user.id = job.created_by_user_id
       WHERE job.tenant_id = ? AND job.id = ?`,
      [request.tenantId, jobId],
    )
    return row
  })
  response.status(201).json(mapAiJob(job))
}))

app.delete('/api/ai/reports/:id', route(async (request, response) => {
  const reportId = requireInteger(request.params.id, '报告 ID', { min: 1 })
  await withTransaction(async connection => {
    const [[report]] = await connection.query(
      `SELECT class_id, student_id, student_name FROM ai_student_report
       WHERE tenant_id = ? AND id = ? AND deleted = 0 FOR UPDATE`,
      [request.tenantId, reportId],
    )
    if (!report) notFound('学情报告不存在')
    await assertClassAccess(connection, request, report.class_id)
    await connection.query('UPDATE ai_student_report SET deleted = 1 WHERE tenant_id = ? AND id = ?', [request.tenantId, reportId])
    await writeRequestAction(connection, request, 'DELETE_AI_REPORT', {
      classId: Number(report.class_id),
      studentId: Number(report.student_id),
      reportId,
      studentName: report.student_name,
    })
  })
  response.status(204).end()
}))

async function getPeriodDefinition(connection, period, options = {}) {
  if (period === 'week') {
    const offset = requireInteger(options.offset ?? 0, '周榜偏移量', { min: 0, max: 5 })
    const [[row]] = await connection.query(
      `SELECT
         DATE_FORMAT(DATE_SUB(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL ? WEEK), '%Y-%m-%d') AS periodStart,
         DATE_FORMAT(DATE_ADD(DATE_SUB(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL ? WEEK), INTERVAL 6 DAY), '%Y-%m-%d') AS periodEnd,
         DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL ? WEEK), '%x-W%v') AS periodKey`,
      [offset, offset, offset],
    )
    return { ...row, offset }
  }
  if (period === 'month') {
    const offset = requireInteger(options.offset ?? 0, '月榜偏移量', { min: 0, max: 5 })
    const [[row]] = await connection.query(
      `SELECT
         DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL ? MONTH), '%Y-%m-01') AS periodStart,
         DATE_FORMAT(LAST_DAY(DATE_SUB(CURDATE(), INTERVAL ? MONTH)), '%Y-%m-%d') AS periodEnd,
         DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL ? MONTH), '%Y-%m') AS periodKey`,
      [offset, offset, offset],
    )
    return { ...row, offset }
  }
  if (period === 'semester') {
    const periodStart = String(options.periodStart || '')
    const periodEnd = String(options.periodEnd || '')
    if (!isValidIsoDate(periodStart) || !isValidIsoDate(periodEnd) || periodStart > periodEnd) {
      badRequest('学期榜结算需要有效的开始和结束日期')
    }
    return {
      periodStart,
      periodEnd,
      periodKey: `${periodStart}_${periodEnd}`,
    }
  }
  badRequest('排行榜周期不正确')
}

async function getSnapshotRanking(connection, tenantId, classId, period, periodDefinition, scope) {
  if (!periodDefinition?.offset) return null
  const [[settlement]] = await connection.query(
    `SELECT id FROM leaderboard_settlement
     WHERE tenant_id = ? AND class_id = ? AND period = ? AND period_key = ?`,
    [tenantId, classId, period, periodDefinition.periodKey],
  )
  if (!settlement) return null
  const [rows] = await connection.query(
    `SELECT subject_id, subject_name, student_id, score, student_count, rank_no
     FROM leaderboard_snapshot_entry
     WHERE tenant_id = ? AND settlement_id = ? AND scope = ?
     ORDER BY rank_no`,
    [tenantId, settlement.id, scope],
  )
  if (scope === 'student') {
    return rows.map(row => ({
      studentId: Number(row.student_id),
      name: row.subject_name,
      score: Number(row.score),
      rank: Number(row.rank_no),
    }))
  }
  return rows.map(row => ({
    groupId: row.subject_id,
    name: row.subject_name,
    score: Number(row.score),
    studentCount: row.student_count == null ? undefined : Number(row.student_count),
    rank: Number(row.rank_no),
  }))
}

async function getPersonalRanking(connection, tenantId, classId, period, periodDefinition) {
  if (period === 'total') {
    const [rows] = await connection.query(
      `SELECT id AS studentId, name, score
       FROM student
       WHERE tenant_id = ? AND class_id = ? AND deleted = 0
       ORDER BY score DESC, id`,
      [tenantId, classId],
    )
    return rows.map(row => ({ studentId: Number(row.studentId), name: row.name, score: Number(row.score) }))
  }
  const [rows] = await connection.query(
    `SELECT student.id AS studentId, student.name,
            COALESCE(SUM(CASE WHEN action.reverted = 0 THEN action.delta_score ELSE 0 END), 0) AS score
     FROM student
     LEFT JOIN score_action action
       ON action.tenant_id = student.tenant_id
      AND action.class_id = student.class_id
      AND action.student_id = student.id
      AND action.created_at >= ?
      AND action.created_at < DATE_ADD(?, INTERVAL 1 DAY)
     WHERE student.tenant_id = ? AND student.class_id = ? AND student.deleted = 0
       AND student.created_at < DATE_ADD(?, INTERVAL 1 DAY)
     GROUP BY student.id, student.name
     ORDER BY score DESC, student.id`,
    [periodDefinition.periodStart, periodDefinition.periodEnd, tenantId, classId, periodDefinition.periodEnd],
  )
  return rows.map(row => ({ studentId: Number(row.studentId), name: row.name, score: Number(row.score) }))
}

async function getGroupRanking(connection, tenantId, classId, period, periodDefinition) {
  const scoreExpression = period === 'total'
    ? 'COALESCE(SUM(student.score), 0)'
    : 'COALESCE(SUM(CASE WHEN action.reverted = 0 THEN action.delta_score ELSE 0 END), 0)'
  const actionJoin = period === 'total'
    ? ''
    : `LEFT JOIN score_action action
         ON action.tenant_id = student.tenant_id
        AND action.class_id = student.class_id
        AND action.student_id = student.id
        AND action.created_at >= ?
        AND action.created_at < DATE_ADD(?, INTERVAL 1 DAY)`
  const studentPeriodCondition = period === 'total'
    ? ''
    : 'AND student.created_at < DATE_ADD(?, INTERVAL 1 DAY)'
  const params = period === 'total'
    ? [tenantId, classId]
    : [periodDefinition.periodEnd, periodDefinition.periodStart, periodDefinition.periodEnd, tenantId, classId]
  const [rows] = await connection.query(
    `SELECT student_group.id AS groupId, student_group.name,
            ${scoreExpression} AS score, COUNT(DISTINCT student.id) AS studentCount
     FROM student_group
     LEFT JOIN student
      ON student.tenant_id = student_group.tenant_id
     AND student.group_id = student_group.id
     AND student.deleted = 0
     ${studentPeriodCondition}
     ${actionJoin}
     WHERE student_group.tenant_id = ? AND student_group.class_id = ? AND student_group.deleted = 0
     GROUP BY student_group.id, student_group.name
     ORDER BY score DESC, student_group.id`,
    params,
  )
  return rows.map(row => ({
    groupId: row.groupId,
    name: row.name,
    score: Number(row.score),
    studentCount: Number(row.studentCount),
  }))
}

app.get('/api/leaderboards/personal', route(async (request, response) => {
  const classId = requireInteger(request.query.classId, '班级 ID', { min: 1 })
  await assertClassAccess(pool, request, classId)
  const period = request.query.period || 'total'
  const definition = period === 'total' ? null : await getPeriodDefinition(pool, period, request.query)
  const snapshot = period === 'total' ? null : await getSnapshotRanking(pool, request.tenantId, classId, period, definition, 'student')
  response.json(snapshot || await getPersonalRanking(pool, request.tenantId, classId, period, definition))
}))

app.get('/api/leaderboards/groups', route(async (request, response) => {
  const classId = requireInteger(request.query.classId, '班级 ID', { min: 1 })
  await assertClassAccess(pool, request, classId)
  const period = request.query.period || 'total'
  const definition = period === 'total' ? null : await getPeriodDefinition(pool, period, request.query)
  const snapshot = period === 'total' ? null : await getSnapshotRanking(pool, request.tenantId, classId, period, definition, 'group')
  response.json(snapshot || await getGroupRanking(pool, request.tenantId, classId, period, definition))
}))

app.get('/api/leaderboards/period-options', route(async (request, response) => {
  const classId = requireInteger(request.query.classId, '班级 ID', { min: 1 })
  await assertClassAccess(pool, request, classId)
  const weeks = []
  const months = []
  for (let offset = 0; offset <= 5; offset += 1) {
    weeks.push(await getPeriodDefinition(pool, 'week', { offset }))
    months.push(await getPeriodDefinition(pool, 'month', { offset }))
  }
  const [settlements] = await pool.query(
    `SELECT id, period, period_key
     FROM leaderboard_settlement
     WHERE tenant_id = ? AND class_id = ? AND period IN ('week', 'month')`,
    [request.tenantId, classId],
  )
  const settlementIds = new Map(settlements.map(item => [`${item.period}:${item.period_key}`, Number(item.id)]))
  const mapOption = (item, period) => ({
    ...item,
    settlementId: settlementIds.get(`${period}:${item.periodKey}`) ?? null,
  })
  response.json({
    weeks: weeks.map(item => mapOption(item, 'week')),
    months: months.map(item => mapOption(item, 'month')),
  })
}))

app.get('/api/leaderboards/settlements', route(async (request, response) => {
  const classId = requireInteger(request.query.classId, '班级 ID', { min: 1 })
  await assertClassAccess(pool, request, classId)
  const conditions = ['settlement.tenant_id = ?', 'settlement.class_id = ?']
  const params = [request.tenantId, classId]
  if (request.query.period) {
    if (!['week', 'month', 'semester'].includes(String(request.query.period))) {
      badRequest('结算周期不正确')
    }
    conditions.push('settlement.period = ?')
    params.push(String(request.query.period))
  }
  const [rows] = await pool.query(
    `SELECT settlement.id, settlement.period, settlement.period_key,
            DATE_FORMAT(settlement.period_start, '%Y-%m-%d') AS period_start,
            DATE_FORMAT(settlement.period_end, '%Y-%m-%d') AS period_end,
            settlement.awarded_count, settlement.created_at,
            user.display_name AS created_by_name
     FROM leaderboard_settlement settlement
     LEFT JOIN app_user user ON user.id = settlement.created_by_user_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY settlement.created_at DESC, settlement.id DESC
     LIMIT 30`,
    params,
  )
  response.json(rows.map(row => ({
    id: Number(row.id),
    period: row.period,
    periodKey: row.period_key,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    awardedCount: Number(row.awarded_count),
    createdAt: row.created_at,
    createdByName: row.created_by_name,
  })))
}))

app.get('/api/leaderboards/settlements/:id', route(async (request, response) => {
  const [[settlement]] = await pool.query(
    `SELECT id, class_id, period, period_key,
            DATE_FORMAT(period_start, '%Y-%m-%d') AS period_start,
            DATE_FORMAT(period_end, '%Y-%m-%d') AS period_end,
            awarded_count, created_at
     FROM leaderboard_settlement WHERE tenant_id = ? AND id = ?`,
    [request.tenantId, request.params.id],
  )
  if (!settlement) return response.status(404).json({ message: '结算快照不存在' })
  await assertClassAccess(pool, request, settlement.class_id)
  const [entries] = await pool.query(
    `SELECT scope, subject_id, subject_name, student_id, score, student_count, rank_no
     FROM leaderboard_snapshot_entry
     WHERE tenant_id = ? AND settlement_id = ?
     ORDER BY scope, rank_no`,
    [request.tenantId, settlement.id],
  )
  response.json({
    id: Number(settlement.id),
    classId: Number(settlement.class_id),
    period: settlement.period,
    periodKey: settlement.period_key,
    periodStart: settlement.period_start,
    periodEnd: settlement.period_end,
    awardedCount: Number(settlement.awarded_count),
    createdAt: settlement.created_at,
    students: entries.filter(entry => entry.scope === 'student').map(entry => ({
      studentId: Number(entry.student_id),
      name: entry.subject_name,
      score: Number(entry.score),
      rank: Number(entry.rank_no),
    })),
    groups: entries.filter(entry => entry.scope === 'group').map(entry => ({
      groupId: entry.subject_id,
      name: entry.subject_name,
      score: Number(entry.score),
      studentCount: entry.student_count == null ? undefined : Number(entry.student_count),
      rank: Number(entry.rank_no),
    })),
  })
}))

async function createLeaderboardSettlement(connection, {
  tenantId,
  classId,
  period,
  definition,
  operatorUserId = null,
  source = 'manual',
}) {
  const [[lockedClass]] = await connection.query(
    'SELECT id FROM class_room WHERE tenant_id = ? AND id = ? AND deleted = 0 FOR UPDATE',
    [tenantId, classId],
  )
  if (!lockedClass) badRequest('班级不存在或已删除')
  const [[existing]] = await connection.query(
    `SELECT id FROM leaderboard_settlement
     WHERE tenant_id = ? AND class_id = ? AND period = ? AND period_key = ?
     FOR UPDATE`,
    [tenantId, classId, period, definition.periodKey],
  )
  if (existing) return { created: false, id: Number(existing.id) }
  const students = await getPersonalRanking(connection, tenantId, classId, period, definition)
  const groups = await getGroupRanking(connection, tenantId, classId, period, definition)
  const [created] = await connection.query(
    `INSERT INTO leaderboard_settlement
      (tenant_id, class_id, period, period_key, period_start, period_end, created_by_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [tenantId, classId, period, definition.periodKey, definition.periodStart, definition.periodEnd, operatorUserId],
  )
  const settlementId = Number(created.insertId)
  for (let index = 0; index < students.length; index += 1) {
    const student = students[index]
    await connection.query(
      `INSERT INTO leaderboard_snapshot_entry
        (tenant_id, settlement_id, class_id, scope, subject_id, subject_name, student_id, score, rank_no)
       VALUES (?, ?, ?, 'student', ?, ?, ?, ?, ?)`,
      [tenantId, settlementId, classId, String(student.studentId), student.name, student.studentId, student.score, index + 1],
    )
  }
  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index]
    await connection.query(
      `INSERT INTO leaderboard_snapshot_entry
        (tenant_id, settlement_id, class_id, scope, subject_id, subject_name, score, student_count, rank_no)
       VALUES (?, ?, ?, 'group', ?, ?, ?, ?, ?)`,
      [tenantId, settlementId, classId, group.groupId, group.name, group.score, group.studentCount, index + 1],
    )
  }
  const badgeType = { week: 'weekly', month: 'monthly', semester: 'semester' }[period]
  const label = { week: '周榜', month: '月榜', semester: '学期榜' }[period]
  const winners = students.filter(student => student.score > 0).slice(0, 10)
  for (let index = 0; index < winners.length; index += 1) {
    const winner = winners[index]
    await connection.query(
      `INSERT INTO badge_record
        (tenant_id, class_id, student_id, badge_type, amount, description, settlement_id, student_name)
       VALUES (?, ?, ?, ?, 1, ?, ?, ?)`,
      [tenantId, classId, winner.studentId, badgeType, `${label}第 ${index + 1} 名`, settlementId, winner.name],
    )
    await connection.query(
      'UPDATE student SET badge_balance = badge_balance + 1 WHERE tenant_id = ? AND id = ?',
      [tenantId, winner.studentId],
    )
    await createNotifications(connection, {
      tenantId,
      classId,
      studentId: winner.studentId,
      type: 'badge_awarded',
      title: '获得排行榜荣誉徽章',
      message: `${winner.name} 获得${label}第 ${index + 1} 名荣誉徽章`,
      targetPath: '/dashboard/badges',
      dedupeKey: `leaderboard-badge:${settlementId}:${winner.studentId}`,
    })
  }
  await connection.query(
    'UPDATE leaderboard_settlement SET awarded_count = ? WHERE tenant_id = ? AND id = ?',
    [winners.length, tenantId, settlementId],
  )
  await writeAction(connection, tenantId, operatorUserId, 'SETTLE_LEADERBOARD', {
    classId,
    settlementId,
    period,
    periodKey: definition.periodKey,
    awardedCount: winners.length,
    source,
  })
  return {
    created: true,
    id: settlementId,
    period,
    periodKey: definition.periodKey,
    periodStart: definition.periodStart,
    periodEnd: definition.periodEnd,
    awardedCount: winners.length,
    students,
    groups,
  }
}

async function runAutomaticSettlements() {
  const [weekDefinition, monthDefinition] = await Promise.all([
    getPeriodDefinition(pool, 'week', { offset: 1 }),
    getPeriodDefinition(pool, 'month', { offset: 1 }),
  ])
  const [classes] = await pool.query(
    `SELECT id, tenant_id, DATE_FORMAT(created_at, '%Y-%m-%d') AS created_date
     FROM class_room WHERE deleted = 0 ORDER BY tenant_id, id`,
  )
  const summary = { created: [], skipped: [], failed: [] }
  for (const classRoom of classes) {
    for (const [period, definition] of [['week', weekDefinition], ['month', monthDefinition]]) {
      if (classRoom.created_date > definition.periodEnd) {
        summary.skipped.push({
          classId: Number(classRoom.id),
          period,
          periodKey: definition.periodKey,
          reason: 'class-not-created',
        })
        continue
      }
      try {
        const result = await withTransaction(connection => createLeaderboardSettlement(connection, {
          tenantId: Number(classRoom.tenant_id),
          classId: Number(classRoom.id),
          period,
          definition,
          source: 'automatic',
        }))
        summary[result.created ? 'created' : 'skipped'].push({
          classId: Number(classRoom.id),
          period,
          periodKey: definition.periodKey,
          settlementId: result.id,
        })
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          summary.skipped.push({ classId: Number(classRoom.id), period, periodKey: definition.periodKey })
          continue
        }
        console.error('Automatic leaderboard settlement failed', {
          classId: Number(classRoom.id),
          period,
          periodKey: definition.periodKey,
          error,
        })
        summary.failed.push({
          classId: Number(classRoom.id),
          period,
          periodKey: definition.periodKey,
          message: error.message,
        })
      }
    }
  }
  return summary
}

app.post('/api/leaderboards/auto-settle', requireOwner, route(async (_request, response) => {
  response.json(await runAutomaticSettlements())
}))

app.post('/api/leaderboards/settlements', route(async (request, response) => {
  const classId = requireInteger(request.body.classId, '班级 ID', { min: 1 })
  const period = String(request.body.period || '')
  await assertClassPermission(pool, request, classId, 'can_manage_config')
  const definition = await getPeriodDefinition(pool, period, request.body)
  const result = await withTransaction(connection => createLeaderboardSettlement(connection, {
    tenantId: request.tenantId,
    classId,
    period,
    definition,
    operatorUserId: request.user.userId,
  }))
  if (!result.created) {
    const error = new Error('该周期已经结算，不能重复发放荣誉徽章')
    error.statusCode = 409
    throw error
  }
  response.status(201).json(result)
}))

app.use('/api', (_request, response) => {
  response.status(404).json({ message: '接口不存在' })
})

app.use((error, _request, response, _next) => {
  console.error(error)
  if (error.code === 'ER_DUP_ENTRY') {
    return response.status(400).json({ message: '数据已存在，请勿重复提交' })
  }
  if (error.code === 'ER_NO_REFERENCED_ROW_2') {
    return response.status(400).json({ message: '关联数据不存在或已被修改' })
  }
  const statusCode = Number(error.statusCode || error.status) || 500
  response.status(statusCode).json({ message: statusCode >= 500 ? '请求处理失败' : error.message || '请求处理失败' })
})

let automaticSettlementRunning = false

async function checkAutomaticSettlements() {
  if (automaticSettlementRunning) return
  automaticSettlementRunning = true
  try {
    await runAutomaticSettlements()
  } catch (error) {
    console.error('Automatic leaderboard settlement check failed', error)
  } finally {
    automaticSettlementRunning = false
  }
}

app.listen(port, () => {
  console.log(`Class Pet API listening on http://127.0.0.1:${port}`)
  if (process.env.DISABLE_AUTO_SETTLEMENT !== 'true') {
    void checkAutomaticSettlements()
    const timer = setInterval(() => void checkAutomaticSettlements(), 60_000)
    timer.unref()
  }
})
