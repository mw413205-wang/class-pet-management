import { spawn, spawnSync } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import jwt from 'jsonwebtoken'
import mysql from 'mysql2/promise'
import { connectionOptions, databaseName, pool, withTransaction } from '../src/db.js'

const projectDirectory = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const port = 3101
const apiBaseUrl = `http://127.0.0.1:${port}/api`
const temporaryUsername = `p0t_${String(Date.now()).slice(-10)}`
const temporaryActivationCode = `P0-${Date.now()}`
const rateLimitIp = '198.51.100.42'
const resetRateLimitIp = '198.51.100.43'
const testSecret = 'p0-smoke-test-secret-with-at-least-32-characters'
const resourceLimitPrefix = `P2LIMIT-${Date.now()}-`
const resourceLimitStudentPrefix = `L${String(Date.now()).slice(-8)}-`
let server
let serverErrors = ''
let connection
let baseline
const createdStudentIds = []
const createdGroupIds = []
const createdShopItemIds = []
const createdShopCategoryIds = []
const createdLotteryPrizeIds = []
const createdScoreRuleIds = []
const createdClassIds = []

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function report(message) {
  console.log(`PASS ${message}`)
}

function parseActionDetail(value) {
  return typeof value === 'string' ? JSON.parse(value) : value
}

async function request(path, { method = 'GET', token, body, headers = {} } = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return {
    status: response.status,
    body: response.status === 204 ? undefined : await response.json().catch(() => ({})),
  }
}

async function expectStatus(path, options, expectedStatus) {
  const response = await request(path, options)
  assert(response.status === expectedStatus, `${options?.method || 'GET'} ${path} expected ${expectedStatus}, received ${response.status}`)
  return response.body
}

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${apiBaseUrl}/health`)
      if (response.ok) return
    } catch {
      await delay(100)
    }
  }
  throw new Error(`Test server failed to start. ${serverErrors}`)
}

async function captureBaseline() {
  const [[ids]] = await connection.query(
    `SELECT
       (SELECT COALESCE(MAX(id), 0) FROM refresh_token) AS refresh_token_id,
       (SELECT COALESCE(MAX(id), 0) FROM score_action) AS score_action_id,
       (SELECT COALESCE(MAX(id), 0) FROM exchange_record) AS exchange_record_id,
       (SELECT COALESCE(MAX(id), 0) FROM student_cosmetic_inventory) AS student_cosmetic_inventory_id,
       (SELECT COALESCE(MAX(id), 0) FROM lottery_draw_record) AS lottery_draw_record_id,
       (SELECT COALESCE(MAX(id), 0) FROM badge_record) AS badge_record_id,
       (SELECT COALESCE(MAX(id), 0) FROM custom_badge) AS custom_badge_id,
       (SELECT COALESCE(MAX(id), 0) FROM leaderboard_snapshot_entry) AS leaderboard_snapshot_entry_id,
       (SELECT COALESCE(MAX(id), 0) FROM leaderboard_settlement) AS leaderboard_settlement_id,
       (SELECT COALESCE(MAX(id), 0) FROM notification) AS notification_id,
       (SELECT COALESCE(MAX(id), 0) FROM ai_prompt_template) AS ai_prompt_template_id,
       (SELECT COALESCE(MAX(id), 0) FROM ai_report_job) AS ai_report_job_id,
       (SELECT COALESCE(MAX(id), 0) FROM ai_student_report) AS ai_student_report_id,
       (SELECT COALESCE(MAX(id), 0) FROM action_log) AS action_log_id`,
  )
  const [students] = await connection.query(
    'SELECT id, score, badge_balance, pet_id, pet_nickname, toy_id, head_id, back_id, neck_id, face_id FROM student WHERE id IN (1001, 1010)',
  )
  const [prizes] = await connection.query('SELECT id, stock, enabled FROM lottery_prize WHERE tenant_id = 1')
  const [shopItems] = await connection.query(
    'SELECT id, stock, join_lottery, lottery_probability FROM shop_item WHERE tenant_id = 1',
  )
  const [scoreRules] = await connection.query('SELECT id, deleted FROM score_rule WHERE tenant_id = 1')
  const [allowPetChangeSettings] = await connection.query(
    "SELECT setting_value FROM app_setting WHERE tenant_id = 1 AND setting_key = 'allow_pet_change'",
  )
  const [systemNameSettings] = await connection.query(
    "SELECT setting_value FROM app_setting WHERE tenant_id = 1 AND setting_key = 'system_name'",
  )
  const [aiPromptTemplates] = await connection.query(
    'SELECT id, prompt_text, updated_by_user_id FROM ai_prompt_template WHERE tenant_id = 1 AND is_default = 1',
  )
  return {
    ...Object.fromEntries(Object.entries(ids).map(([key, value]) => [key, Number(value)])),
    students: students.map(student => ({
      id: Number(student.id),
      score: Number(student.score),
      badgeBalance: Number(student.badge_balance),
      petId: student.pet_id,
      petNickname: student.pet_nickname,
      toyId: student.toy_id,
      headId: student.head_id,
      backId: student.back_id,
      neckId: student.neck_id,
      faceId: student.face_id,
    })),
    prizeStates: prizes.map(prize => ({
      id: Number(prize.id),
      stock: Number(prize.stock),
      enabled: Number(prize.enabled),
    })),
    shopItemStates: shopItems.map(item => ({
      id: Number(item.id),
      stock: Number(item.stock),
      joinLottery: Number(item.join_lottery),
      lotteryProbability: Number(item.lottery_probability),
    })),
    scoreRuleStates: scoreRules.map(rule => ({ id: Number(rule.id), deleted: Number(rule.deleted) })),
    allowPetChangeSetting: allowPetChangeSettings[0]?.setting_value,
    systemNameSetting: systemNameSettings[0]?.setting_value,
    aiPromptTemplate: aiPromptTemplates[0]
      ? {
        id: Number(aiPromptTemplates[0].id),
        promptText: aiPromptTemplates[0].prompt_text,
        updatedByUserId: aiPromptTemplates[0].updated_by_user_id == null ? null : Number(aiPromptTemplates[0].updated_by_user_id),
      }
      : null,
  }
}

async function cleanup() {
  if (!connection || !baseline) return
  await connection.query('DELETE FROM custom_badge WHERE name LIKE ?', [`${resourceLimitPrefix}%`])
  await connection.query('DELETE FROM student WHERE name LIKE ?', [`${resourceLimitPrefix}%`])
  await connection.query('DELETE FROM student WHERE name LIKE ?', [`${resourceLimitStudentPrefix}%`])
  await connection.query('DELETE FROM score_rule WHERE name LIKE ?', [`${resourceLimitPrefix}%`])
  await connection.query('DELETE FROM shop_item WHERE name LIKE ?', [`${resourceLimitPrefix}%`])
  await connection.query('DELETE FROM lottery_prize WHERE name LIKE ?', [`${resourceLimitPrefix}%`])
  await connection.query('DELETE FROM class_room WHERE name LIKE ?', [`${resourceLimitPrefix}%`])
  await connection.query('DELETE FROM auth_login_guard WHERE client_ip = ?', [rateLimitIp])
  await connection.query('DELETE FROM auth_reset_guard WHERE client_ip = ?', [resetRateLimitIp])
  await connection.query('DELETE FROM notification WHERE id > ?', [baseline.notification_id])
  await connection.query('DELETE FROM ai_student_report WHERE id > ?', [baseline.ai_student_report_id])
  await connection.query('DELETE FROM ai_report_job WHERE id > ?', [baseline.ai_report_job_id])
  await connection.query('DELETE FROM ai_prompt_template WHERE id > ?', [baseline.ai_prompt_template_id])
  if (baseline.aiPromptTemplate) {
    await connection.query(
      'UPDATE ai_prompt_template SET prompt_text = ?, updated_by_user_id = ? WHERE id = ?',
      [baseline.aiPromptTemplate.promptText, baseline.aiPromptTemplate.updatedByUserId, baseline.aiPromptTemplate.id],
    )
  }
  await connection.query('DELETE FROM class_teacher WHERE user_id IN (SELECT id FROM app_user WHERE username = ?)', [temporaryUsername])
  await connection.query('DELETE FROM action_log WHERE id > ?', [baseline.action_log_id])
  await connection.query('DELETE FROM student_cosmetic_inventory WHERE id > ?', [baseline.student_cosmetic_inventory_id])
  await connection.query('DELETE FROM exchange_record WHERE id > ?', [baseline.exchange_record_id])
  await connection.query('DELETE FROM lottery_draw_record WHERE id > ?', [baseline.lottery_draw_record_id])
  await connection.query('DELETE FROM score_action WHERE id > ?', [baseline.score_action_id])
  await connection.query('DELETE FROM badge_record WHERE id > ?', [baseline.badge_record_id])
  await connection.query('DELETE FROM leaderboard_snapshot_entry WHERE id > ?', [baseline.leaderboard_snapshot_entry_id])
  await connection.query('DELETE FROM leaderboard_settlement WHERE id > ?', [baseline.leaderboard_settlement_id])
  await connection.query('DELETE FROM custom_badge WHERE id > ?', [baseline.custom_badge_id])
  for (const student of baseline.students) {
    await connection.query(
      'UPDATE student SET score = ?, badge_balance = ?, pet_id = ?, pet_nickname = ?, toy_id = ?, head_id = ?, back_id = ?, neck_id = ?, face_id = ?, deleted = 0 WHERE id = ?',
      [student.score, student.badgeBalance, student.petId, student.petNickname, student.toyId, student.headId, student.backId, student.neckId, student.faceId, student.id],
    )
  }
  for (const prize of baseline.prizeStates) {
    await connection.query('UPDATE lottery_prize SET stock = ?, enabled = ? WHERE id = ?', [prize.stock, prize.enabled, prize.id])
  }
  for (const item of baseline.shopItemStates) {
    await connection.query(
      'UPDATE shop_item SET stock = ?, join_lottery = ?, lottery_probability = ? WHERE id = ?',
      [item.stock, item.joinLottery, item.lotteryProbability, item.id],
    )
  }
  for (const rule of baseline.scoreRuleStates) {
    await connection.query('UPDATE score_rule SET deleted = ? WHERE id = ?', [rule.deleted, rule.id])
  }
  if (baseline.allowPetChangeSetting === undefined) {
    await connection.query("DELETE FROM app_setting WHERE tenant_id = 1 AND setting_key = 'allow_pet_change'")
  } else {
    await connection.query(
      `INSERT INTO app_setting (tenant_id, setting_key, setting_value)
       VALUES (1, 'allow_pet_change', ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [JSON.stringify(baseline.allowPetChangeSetting)],
    )
  }
  if (baseline.systemNameSetting === undefined) {
    await connection.query("DELETE FROM app_setting WHERE tenant_id = 1 AND setting_key = 'system_name'")
  } else {
    await connection.query(
      `INSERT INTO app_setting (tenant_id, setting_key, setting_value)
       VALUES (1, 'system_name', ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [JSON.stringify(baseline.systemNameSetting)],
    )
  }
  if (createdStudentIds.length) {
    await connection.query(`DELETE FROM student WHERE id IN (${createdStudentIds.map(() => '?').join(', ')})`, createdStudentIds)
  }
  if (createdGroupIds.length) {
    await connection.query(`DELETE FROM student_group WHERE id IN (${createdGroupIds.map(() => '?').join(', ')})`, createdGroupIds)
  }
  if (createdShopItemIds.length) {
    await connection.query(`DELETE FROM shop_item WHERE id IN (${createdShopItemIds.map(() => '?').join(', ')})`, createdShopItemIds)
  }
  if (createdShopCategoryIds.length) {
    await connection.query(`DELETE FROM shop_category WHERE id IN (${createdShopCategoryIds.map(() => '?').join(', ')})`, createdShopCategoryIds)
  }
  if (createdLotteryPrizeIds.length) {
    await connection.query(`DELETE FROM lottery_prize WHERE id IN (${createdLotteryPrizeIds.map(() => '?').join(', ')})`, createdLotteryPrizeIds)
  }
  if (createdScoreRuleIds.length) {
    await connection.query(`DELETE FROM score_rule WHERE id IN (${createdScoreRuleIds.map(() => '?').join(', ')})`, createdScoreRuleIds)
  }
  if (createdClassIds.length) {
    const placeholders = createdClassIds.map(() => '?').join(', ')
    await connection.query(`DELETE FROM class_teacher WHERE class_id IN (${placeholders})`, createdClassIds)
    await connection.query(`DELETE FROM score_rule WHERE class_id IN (${placeholders})`, createdClassIds)
    await connection.query(`DELETE FROM student_group WHERE class_id IN (${placeholders})`, createdClassIds)
    await connection.query(`DELETE FROM class_room WHERE id IN (${placeholders})`, createdClassIds)
  }
  await connection.query('DELETE FROM refresh_token WHERE id > ?', [baseline.refresh_token_id])
  await connection.query('DELETE FROM activation_code WHERE code = ?', [temporaryActivationCode])
  await connection.query('DELETE FROM app_user WHERE username = ?', [temporaryUsername])
}

async function run() {
  const productionCheck = spawnSync(process.execPath, ['src/server.js'], {
    cwd: projectDirectory,
    env: { ...process.env, NODE_ENV: 'production', JWT_SECRET: 'too-short' },
    encoding: 'utf8',
    timeout: 3000,
  })
  assert(productionCheck.status !== 0, 'Production server accepted a weak JWT secret')
  report('生产环境弱 JWT 密钥会阻止服务启动')

  const invalidPortCheck = spawnSync(process.execPath, ['src/server.js'], {
    cwd: projectDirectory,
    env: { ...process.env, PORT: 'invalid' },
    encoding: 'utf8',
    timeout: 3000,
  })
  assert(invalidPortCheck.status !== 0, 'Server accepted an invalid port')

  const invalidDatabaseCheck = spawnSync(process.execPath, ['--input-type=module', '-e', "import('./src/db.js')"], {
    cwd: projectDirectory,
    env: { ...process.env, MYSQL_DATABASE: 'invalid-name!' },
    encoding: 'utf8',
    timeout: 3000,
  })
  assert(invalidDatabaseCheck.status !== 0, 'Database module accepted an unsafe database name')
  report('端口和数据库名配置会拒绝非法值')

  let transactionAttempts = 0
  const retryResult = await withTransaction(async transactionConnection => {
    transactionAttempts += 1
    if (transactionAttempts === 1) {
      const error = new Error('Synthetic deadlock')
      error.code = 'ER_LOCK_DEADLOCK'
      throw error
    }
    const [[row]] = await transactionConnection.query('SELECT 1 AS value')
    return Number(row.value)
  })
  assert(retryResult === 1 && transactionAttempts === 2, 'Transaction wrapper did not retry a deadlock')
  report('事务包装器遇到数据库死锁会执行有限重试')

  connection = await mysql.createConnection({ ...connectionOptions, database: databaseName })
  baseline = await captureBaseline()
  server = spawn(process.execPath, ['src/server.js'], {
    cwd: projectDirectory,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'test',
      JWT_SECRET: testSecret,
      TRUST_PROXY: 'true',
      DISABLE_AUTO_SETTLEMENT: 'true',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  server.stderr.on('data', chunk => {
    serverErrors += chunk.toString()
  })
  await waitForServer()
  report('测试 API 服务可启动并连接数据库')

  const login = await expectStatus('/auth/login', {
    method: 'POST',
    body: { username: 'teacher', password: 'ClassPet123', remember: true },
  }, 200)
  assert(login.token && login.refreshToken, 'Login response did not include both tokens')
  const payload = jwt.decode(login.token)
  assert(payload.exp - payload.iat === 7200, 'Access token lifetime is not two hours')
  report('登录返回 2 小时 access token 和 refresh token')

  const refreshed = await expectStatus('/auth/refresh', {
    method: 'POST',
    body: { refreshToken: login.refreshToken },
  }, 200)
  assert(refreshed.refreshToken !== login.refreshToken, 'Refresh token was not rotated')
  await expectStatus('/auth/refresh', { method: 'POST', body: { refreshToken: login.refreshToken } }, 401)
  await expectStatus('/auth/logout', { method: 'POST', body: { refreshToken: refreshed.refreshToken } }, 204)
  await expectStatus('/auth/refresh', { method: 'POST', body: { refreshToken: refreshed.refreshToken } }, 401)
  report('刷新令牌轮换、旧令牌拒绝复用、退出撤销令牌均生效')

  const owner = await expectStatus('/auth/login', {
    method: 'POST',
    body: { username: 'teacher', password: 'ClassPet123' },
  }, 200)

  await expectStatus('/settings/system-name', {
    method: 'PUT',
    token: owner.token,
    body: { systemName: 'x'.repeat(31) },
  }, 400)
  await expectStatus('/settings/system-name', {
    method: 'PUT',
    token: owner.token,
    body: { systemName: 'P0 班级宠物园' },
  }, 204)
  const settingsBootstrap = await expectStatus('/bootstrap', { token: owner.token }, 200)
  assert(settingsBootstrap.systemName === 'P0 班级宠物园', 'Bootstrap did not return the persisted system name')
  if (baseline.systemNameSetting === undefined) {
    await connection.query("DELETE FROM app_setting WHERE tenant_id = 1 AND setting_key = 'system_name'")
  } else {
    await connection.query(
      `INSERT INTO app_setting (tenant_id, setting_key, setting_value)
       VALUES (1, 'system_name', ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [JSON.stringify(baseline.systemNameSetting)],
    )
  }
  report('系统名称支持管理员持久化、长度校验和启动数据下发')

  const [[classCount]] = await connection.query('SELECT COUNT(*) AS count FROM class_room WHERE tenant_id = 1 AND deleted = 0')
  for (let index = Number(classCount.count); index < 100; index += 1) {
    await connection.query(
      'INSERT INTO class_room (tenant_id, name, gradient_from, gradient_to) VALUES (1, ?, "#4ecdc4", "#95e1d3")',
      [`${resourceLimitPrefix}班级-${index}`],
    )
  }
  await expectStatus('/classes', {
    method: 'POST',
    token: owner.token,
    body: { name: `${resourceLimitPrefix}越界班级` },
  }, 400)
  await connection.query('DELETE FROM class_room WHERE name LIKE ?', [`${resourceLimitPrefix}%`])

  const [[studentCount]] = await connection.query('SELECT COUNT(*) AS count FROM student WHERE tenant_id = 1 AND class_id = 1 AND deleted = 0')
  for (let index = Number(studentCount.count); index < 200; index += 1) {
    await connection.query(
      'INSERT INTO student (tenant_id, class_id, group_id, name, deleted) VALUES (1, 1, "ungrouped-1", ?, 0)',
      [`${resourceLimitStudentPrefix}${index}`],
    )
  }
  const [restoreCandidate] = await connection.query(
    'INSERT INTO student (tenant_id, class_id, group_id, name, deleted) VALUES (1, 1, "ungrouped-1", ?, 1)',
    [`${resourceLimitStudentPrefix}restore`],
  )
  await expectStatus('/students', {
    method: 'POST',
    token: owner.token,
    body: { classId: 1, groupId: 'ungrouped-1', name: `${resourceLimitStudentPrefix}new` },
  }, 400)
  const importAtLimit = await expectStatus('/students/import', {
    method: 'POST',
    token: owner.token,
    body: { classId: 1, rows: [{ index: 1, name: `${resourceLimitStudentPrefix}import`, groupId: 'ungrouped-1' }] },
  }, 201)
  assert(importAtLimit.failed === 1 && importAtLimit.rows[0].reason.includes('最多创建 200 名学生'), 'Student import did not report the class size limit')
  await expectStatus(`/students/${restoreCandidate.insertId}/restore`, { method: 'POST', token: owner.token }, 400)
  await connection.query('DELETE FROM student WHERE name LIKE ?', [`${resourceLimitStudentPrefix}%`])

  const [[ruleCount]] = await connection.query('SELECT COUNT(*) AS count FROM score_rule WHERE tenant_id = 1 AND class_id = 1 AND deleted = 0')
  for (let index = Number(ruleCount.count); index < 50; index += 1) {
    await connection.query(
      'INSERT INTO score_rule (tenant_id, class_id, name, icon, score_value, enabled, is_quick, sort_order) VALUES (1, 1, ?, "⭐", 1, 1, 0, ?)',
      [`${resourceLimitPrefix}规则-${index}`, index + 1],
    )
  }
  await expectStatus('/score-rules', {
    method: 'POST',
    token: owner.token,
    body: { classId: 1, name: `${resourceLimitPrefix}越界规则`, icon: '⭐', value: 1, enabled: true, isQuick: false, order: 51 },
  }, 400)
  await connection.query('DELETE FROM score_rule WHERE name LIKE ?', [`${resourceLimitPrefix}%`])

  const [[category]] = await connection.query('SELECT id FROM shop_category WHERE tenant_id = 1 AND deleted = 0 ORDER BY is_system DESC, id LIMIT 1')
  const [[shopItemCount]] = await connection.query('SELECT COUNT(*) AS count FROM shop_item WHERE tenant_id = 1 AND deleted = 0')
  for (let index = Number(shopItemCount.count); index < 100; index += 1) {
    await connection.query(
      'INSERT INTO shop_item (tenant_id, category_id, name, icon, description, price, stock) VALUES (1, ?, ?, "🎁", "", 1, -1)',
      [category.id, `${resourceLimitPrefix}商品-${index}`],
    )
  }
  await expectStatus('/shop/items', {
    method: 'POST',
    token: owner.token,
    body: { categoryId: Number(category.id), name: `${resourceLimitPrefix}越界商品`, icon: '🎁', description: '', price: 1, stock: -1, inLottery: false, lotteryProbability: 1 },
  }, 400)
  await connection.query('DELETE FROM shop_item WHERE name LIKE ?', [`${resourceLimitPrefix}%`])

  const [[lotteryPrizeCount]] = await connection.query('SELECT COUNT(*) AS count FROM lottery_prize WHERE tenant_id = 1 AND deleted = 0')
  for (let index = Number(lotteryPrizeCount.count); index < 20; index += 1) {
    await connection.query(
      'INSERT INTO lottery_prize (tenant_id, name, icon, probability, stock) VALUES (1, ?, "🎁", 1, -1)',
      [`${resourceLimitPrefix}奖品-${index}`],
    )
  }
  await expectStatus('/lottery/prizes', {
    method: 'POST',
    token: owner.token,
    body: { name: `${resourceLimitPrefix}越界奖品`, icon: '🎁', probability: 1, stock: -1 },
  }, 400)
  await connection.query('DELETE FROM lottery_prize WHERE name LIKE ?', [`${resourceLimitPrefix}%`])

  const [[ownerUser]] = await connection.query('SELECT id FROM app_user WHERE tenant_id = 1 AND username = "teacher"')
  const [[customBadgeCount]] = await connection.query('SELECT COUNT(*) AS count FROM custom_badge WHERE tenant_id = 1 AND class_id = 1 AND deleted = 0')
  for (let index = Number(customBadgeCount.count); index < 50; index += 1) {
    await connection.query(
      'INSERT INTO custom_badge (tenant_id, class_id, name, icon, description, created_by_user_id) VALUES (1, 1, ?, "🏅", "", ?)',
      [`${resourceLimitPrefix}徽章-${index}`, ownerUser.id],
    )
  }
  await expectStatus('/badges/custom', {
    method: 'POST',
    token: owner.token,
    body: { classId: 1, name: `${resourceLimitPrefix}越界徽章`, icon: '🏅', description: '' },
  }, 400)
  await connection.query('DELETE FROM custom_badge WHERE name LIKE ?', [`${resourceLimitPrefix}%`])
  report('服务端资源上限覆盖班级、学生、导入、恢复、规则、商品、奖品和自定义徽章')

  await connection.query('UPDATE score_rule SET deleted = 1 WHERE tenant_id = 1')
  const fallbackClass = await expectStatus('/classes', {
    method: 'POST',
    token: owner.token,
    body: { name: `P0默认规则${Date.now()}` },
  }, 201)
  createdClassIds.push(Number(fallbackClass.id))
  const [[fallbackRuleCount]] = await connection.query(
    'SELECT COUNT(*) AS count FROM score_rule WHERE tenant_id = 1 AND class_id = ? AND deleted = 0',
    [fallbackClass.id],
  )
  assert(Number(fallbackRuleCount.count) === 7, 'New class did not receive stable default score rules')
  for (const rule of baseline.scoreRuleStates) {
    await connection.query('UPDATE score_rule SET deleted = ? WHERE id = ?', [rule.deleted, rule.id])
  }
  report('新建班级在没有可复制旧规则时仍会获得稳定默认规则')

  const copiedClass = await expectStatus('/classes', {
    method: 'POST',
    token: owner.token,
    body: { name: `P1配置复用${Date.now()}`, copyFromClassId: 1 },
  }, 201)
  createdClassIds.push(Number(copiedClass.id))
  const [[sourceGroupCount]] = await connection.query(
    'SELECT COUNT(*) AS count FROM student_group WHERE tenant_id = 1 AND class_id = 1 AND deleted = 0',
  )
  const [[copiedGroupCount]] = await connection.query(
    'SELECT COUNT(*) AS count FROM student_group WHERE tenant_id = 1 AND class_id = ? AND deleted = 0',
    [copiedClass.id],
  )
  const [[sourceRuleCount]] = await connection.query(
    'SELECT COUNT(*) AS count FROM score_rule WHERE tenant_id = 1 AND class_id = 1 AND deleted = 0',
  )
  const [[copiedRuleCount]] = await connection.query(
    'SELECT COUNT(*) AS count FROM score_rule WHERE tenant_id = 1 AND class_id = ? AND deleted = 0',
    [copiedClass.id],
  )
  assert(Number(copiedGroupCount.count) === Number(sourceGroupCount.count), 'Copied class did not receive the source groups')
  assert(Number(copiedRuleCount.count) === Number(sourceRuleCount.count), 'Copied class did not receive the source score rules')
  const [[copiedUngrouped]] = await connection.query(
    'SELECT id FROM student_group WHERE tenant_id = 1 AND class_id = ? AND is_ungrouped = 1 AND deleted = 0',
    [copiedClass.id],
  )
  assert(copiedUngrouped.id === `ungrouped-${copiedClass.id}`, 'Copied class did not preserve the ungrouped ID convention')
  report('新建班级可以复用已有班级的小组与积分规则配置')

  const [[fallbackUngrouped]] = await connection.query(
    'SELECT id FROM student_group WHERE tenant_id = 1 AND class_id = ? AND is_ungrouped = 1 AND deleted = 0',
    [fallbackClass.id],
  )
  const resetStudent = await expectStatus('/students', {
    method: 'POST',
    token: owner.token,
    body: { classId: Number(fallbackClass.id), groupId: fallbackUngrouped.id, name: `重置测试${Date.now()}` },
  }, 201)
  createdStudentIds.push(Number(resetStudent.id))
  const [[fallbackPositiveRule]] = await connection.query(
    'SELECT id FROM score_rule WHERE tenant_id = 1 AND class_id = ? AND enabled = 1 AND score_value > 0 ORDER BY id LIMIT 1',
    [fallbackClass.id],
  )
  const resetScore = await expectStatus('/scores', {
    method: 'POST',
    token: owner.token,
    body: { studentId: Number(resetStudent.id), ruleId: Number(fallbackPositiveRule.id) },
  }, 201)
  await expectStatus(`/classes/${fallbackClass.id}/reset`, {
    method: 'POST',
    token: owner.token,
    body: { mode: 'score', confirmation: '重置当前班级' },
  }, 204)
  await expectStatus(`/scores/${resetScore.actionId}/revert`, { method: 'POST', token: owner.token }, 400)
  const resetRanking = await expectStatus(`/leaderboards/personal?classId=${fallbackClass.id}&period=week`, { token: owner.token }, 200)
  const resetStudentRanking = resetRanking.find(item => item.studentId === Number(resetStudent.id))
  assert(resetStudentRanking && resetStudentRanking.score === 0, 'Reset score action still affected the weekly ranking')
  const [[invalidatedResetAction]] = await connection.query('SELECT reverted FROM score_action WHERE id = ?', [resetScore.actionId])
  assert(Number(invalidatedResetAction.reverted) === 1, 'Reset did not invalidate previous score actions')
  report('重置班级积分后旧积分流水保留审计记录，但不能再撤回或计入周期榜')

  await connection.query('UPDATE student SET badge_balance = 3 WHERE id = ?', [resetStudent.id])
  await connection.query(
    `INSERT INTO badge_record (tenant_id, class_id, student_id, badge_type, amount, description)
     VALUES (1, ?, ?, 'manual', 3, '重置测试徽章')`,
    [fallbackClass.id, resetStudent.id],
  )
  await expectStatus(`/classes/${fallbackClass.id}/reset`, {
    method: 'POST',
    token: owner.token,
    body: { mode: 'score_badges', confirmation: '重置当前班级' },
  }, 204)
  const [[badgeResetStudent]] = await connection.query('SELECT badge_balance FROM student WHERE id = ?', [resetStudent.id])
  const [[badgeResetCount]] = await connection.query('SELECT COUNT(*) AS count FROM badge_record WHERE student_id = ?', [resetStudent.id])
  assert(Number(badgeResetStudent.badge_balance) === 0 && Number(badgeResetCount.count) === 0, 'Score and badge reset did not clear badge data')

  await connection.query(
    `UPDATE student SET pet_id = 'cat_tabby', pet_nickname = '保留昵称', head_id = 'head_crown'
     WHERE id = ?`,
    [resetStudent.id],
  )
  await connection.query(
    `INSERT INTO student_cosmetic_inventory (tenant_id, student_id, cosmetic_type, cosmetic_id)
     VALUES (1, ?, 'head', 'head_crown')`,
    [resetStudent.id],
  )
  await expectStatus(`/classes/${fallbackClass.id}/reset`, {
    method: 'POST',
    token: owner.token,
    body: { mode: 'all_growth', confirmation: '重置当前班级' },
  }, 204)
  const [[growthResetStudent]] = await connection.query(
    'SELECT pet_id, pet_nickname, head_id FROM student WHERE id = ?',
    [resetStudent.id],
  )
  const [[growthResetInventory]] = await connection.query(
    'SELECT COUNT(*) AS count FROM student_cosmetic_inventory WHERE student_id = ?',
    [resetStudent.id],
  )
  assert(growthResetStudent.pet_id === 'cat_tabby' && growthResetStudent.pet_nickname === '保留昵称', 'Growth reset removed the pet assignment')
  assert(growthResetStudent.head_id == null && Number(growthResetInventory.count) === 0, 'Growth reset did not clear equipped cosmetics and inventory')
  report('三档重置范围会按口径清理徽章和装扮，并保留宠物种类与昵称')

  const periodOptions = await expectStatus(`/leaderboards/period-options?classId=${fallbackClass.id}`, { token: owner.token }, 200)
  assert(periodOptions.weeks.length === 6 && periodOptions.months.length === 6, 'Leaderboard period options do not expose the expected history range')
  await expectStatus(`/leaderboards/personal?classId=${fallbackClass.id}&period=week&offset=6`, { token: owner.token }, 400)
  await connection.query('UPDATE class_room SET created_at = DATE_SUB(CURDATE(), INTERVAL 40 DAY) WHERE id = ?', [fallbackClass.id])
  await connection.query('UPDATE student SET created_at = DATE_SUB(CURDATE(), INTERVAL 14 DAY) WHERE id = ?', [resetStudent.id])
  const [historicScoreAction] = await connection.query(
    `INSERT INTO score_action
      (tenant_id, class_id, student_id, rule_id, rule_name, student_name, delta_score, score_before, score_after, created_at)
     VALUES (1, ?, ?, ?, '历史周榜测试', '历史周榜学生', 4, 0, 4, DATE_SUB(CURDATE(), INTERVAL 7 DAY))`,
    [fallbackClass.id, resetStudent.id, fallbackPositiveRule.id],
  )
  const firstAutoSettlement = await expectStatus('/leaderboards/auto-settle', { method: 'POST', token: owner.token }, 200)
  const createdWeekSettlement = firstAutoSettlement.created.find(item =>
    item.classId === Number(fallbackClass.id) && item.period === 'week'
  )
  assert(createdWeekSettlement, 'Automatic settlement did not create the previous weekly snapshot')
  assert(
    firstAutoSettlement.skipped.some(item =>
      item.classId === Number(copiedClass.id) && item.period === 'week' && item.reason === 'class-not-created'
    ),
    'Automatic settlement did not skip a class created after the target period',
  )
  const periodOptionsAfterSettlement = await expectStatus(`/leaderboards/period-options?classId=${fallbackClass.id}`, { token: owner.token }, 200)
  assert(
    periodOptionsAfterSettlement.weeks.find(option => option.offset === 1)?.settlementId === Number(createdWeekSettlement.settlementId),
    'Leaderboard period options did not expose the automatic snapshot',
  )
  const secondAutoSettlement = await expectStatus('/leaderboards/auto-settle', { method: 'POST', token: owner.token }, 200)
  assert(
    !secondAutoSettlement.created.some(item => item.classId === Number(fallbackClass.id) && item.period === 'week'),
    'Automatic settlement created a duplicate weekly snapshot',
  )
  const historicRankingBeforeMutation = await expectStatus(
    `/leaderboards/personal?classId=${fallbackClass.id}&period=week&offset=1`,
    { token: owner.token },
    200,
  )
  const historicStudentBeforeMutation = historicRankingBeforeMutation.find(item => item.studentId === Number(resetStudent.id))
  assert(historicStudentBeforeMutation?.score === 4, 'Historical weekly ranking did not return the automatic snapshot')
  await connection.query('UPDATE score_action SET reverted = 1, reverted_at = NOW() WHERE id = ?', [historicScoreAction.insertId])
  const historicRankingAfterMutation = await expectStatus(
    `/leaderboards/personal?classId=${fallbackClass.id}&period=week&offset=1`,
    { token: owner.token },
    200,
  )
  const historicStudentAfterMutation = historicRankingAfterMutation.find(item => item.studentId === Number(resetStudent.id))
  assert(historicStudentAfterMutation?.score === 4, 'Historical weekly snapshot changed after source actions were modified')
  const historicGroupsBeforeNewStudent = await expectStatus(
    `/leaderboards/groups?classId=${fallbackClass.id}&period=week&offset=1`,
    { token: owner.token },
    200,
  )
  const historicUngroupedBeforeNewStudent = historicGroupsBeforeNewStudent.find(item => item.groupId === fallbackUngrouped.id)
  assert(historicUngroupedBeforeNewStudent?.studentCount === 1, 'Historical group snapshot did not preserve its member count')
  report('排行榜自动补偿固化具备幂等性，历史周期优先读取不可变快照')

  const deletedResetStudent = await expectStatus('/students', {
    method: 'POST',
    token: owner.token,
    body: { classId: Number(fallbackClass.id), groupId: fallbackUngrouped.id, name: `软删除重置${Date.now()}` },
  }, 201)
  createdStudentIds.push(Number(deletedResetStudent.id))
  const historicGroupsAfterNewStudent = await expectStatus(
    `/leaderboards/groups?classId=${fallbackClass.id}&period=week&offset=1`,
    { token: owner.token },
    200,
  )
  const historicUngroupedAfterNewStudent = historicGroupsAfterNewStudent.find(item => item.groupId === fallbackUngrouped.id)
  assert(historicUngroupedAfterNewStudent?.studentCount === 1, 'Historical group member count changed after a student was added')
  await expectStatus('/scores', {
    method: 'POST',
    token: owner.token,
    body: { studentId: Number(deletedResetStudent.id), ruleId: Number(fallbackPositiveRule.id) },
  }, 201)
  await expectStatus(`/students/${deletedResetStudent.id}`, { method: 'DELETE', token: owner.token }, 204)
  await expectStatus(`/classes/${fallbackClass.id}/reset`, {
    method: 'POST',
    token: owner.token,
    body: { mode: 'score', confirmation: '重置当前班级' },
  }, 204)
  await expectStatus(`/students/${deletedResetStudent.id}/restore`, { method: 'POST', token: owner.token }, 204)
  const [[restoredResetStudent]] = await connection.query('SELECT score FROM student WHERE id = ?', [deletedResetStudent.id])
  assert(Number(restoredResetStudent.score) === 0, 'Restored student brought back score data from before the class reset')
  report('班级重置覆盖软删除学生，恢复后不会带回旧成长数据')

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    await expectStatus('/auth/login', {
      method: 'POST',
      headers: { 'X-Forwarded-For': rateLimitIp },
      body: { username: 'teacher', password: 'WrongPassword1' },
    }, 401)
  }
  await expectStatus('/auth/login', {
    method: 'POST',
    headers: { 'X-Forwarded-For': rateLimitIp },
    body: { username: 'teacher', password: 'WrongPassword1' },
  }, 429)
  await expectStatus('/auth/login', {
    method: 'POST',
    headers: { 'X-Forwarded-For': rateLimitIp },
    body: { username: 'teacher', password: 'ClassPet123' },
  }, 429)
  report('连续五次登录失败后 IP 会被锁定')

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    await expectStatus('/auth/verify-reset', {
      method: 'POST',
      headers: { 'X-Forwarded-For': resetRateLimitIp },
      body: { username: 'teacher', activationCode: 'WRONG-CODE' },
    }, 400)
  }
  await expectStatus('/auth/verify-reset', {
    method: 'POST',
    headers: { 'X-Forwarded-For': resetRateLimitIp },
    body: { username: 'teacher', activationCode: 'WRONG-CODE' },
  }, 429)
  await expectStatus('/auth/forgot-password', {
    method: 'POST',
    headers: { 'X-Forwarded-For': resetRateLimitIp },
    body: { username: 'teacher', activationCode: 'DEMO-TEACHER-2026', password: 'ChangedPass123' },
  }, 429)
  report('连续五次找回密码验证失败后 IP 会被独立锁定')

  await expectStatus('/scores/batch', { method: 'POST', token: owner.token, body: { studentIds: [], ruleId: 1 } }, 400)
  await expectStatus('/scores/batch', {
    method: 'POST',
    token: owner.token,
    body: { studentIds: Array.from({ length: 101 }, (_, index) => index + 1), ruleId: 1 },
  }, 400)
  await expectStatus('/settings/level-thresholds', { method: 'PUT', token: owner.token, body: { values: [50, 40, 150, 200] } }, 400)
  await expectStatus('/settings/allow-pet-change', { method: 'PUT', token: owner.token, body: { enabled: 'true' } }, 400)
  await expectStatus('/classes/1/reset', { method: 'POST', token: owner.token, body: { mode: 'invalid', confirmation: '重置当前班级' } }, 400)
  await expectStatus('/classes/1/reset', { method: 'POST', token: owner.token, body: { mode: 'score', confirmation: '错误确认文字' } }, 400)
  await expectStatus('/classes/reset-all', {
    method: 'POST',
    token: owner.token,
    body: { mode: 'score', confirmation: '重置全部班级', password: 'WrongPass123' },
  }, 400)
  await expectStatus('/scores', { method: 'POST', token: owner.token, body: null }, 400)
  await expectStatus('/action-logs?page=1.2', { token: owner.token }, 400)
  await expectStatus('/action-logs?from=2026-06-02&to=2026-06-01', { token: owner.token }, 400)
  await expectStatus('/does-not-exist', { token: owner.token }, 404)
  await expectStatus('/shop/bootstrap?classId=invalid', { token: owner.token }, 400)
  await expectStatus('/leaderboards/personal?classId=invalid', { token: owner.token }, 400)
  await expectStatus('/leaderboards/settlements?classId=1&period=invalid', { token: owner.token }, 400)
  await expectStatus('/shop/exchange-records?classId=1&from=2026-06-02&to=2026-06-01', { token: owner.token }, 400)
  await expectStatus('/students', {
    method: 'POST',
    token: owner.token,
    body: { classId: 'invalid', groupId: 'ungrouped-1', name: '非法班级学生' },
  }, 400)
  const [[ungrouped]] = await connection.query(
    'SELECT id FROM student_group WHERE tenant_id = 1 AND class_id = 1 AND is_ungrouped = 1 AND deleted = 0 LIMIT 1',
  )
  await expectStatus(`/groups/${ungrouped.id}`, { method: 'DELETE', token: owner.token }, 400)
  const duplicateRestoreName = `恢复冲突${Date.now()}`
  const deletedStudent = await expectStatus('/students', {
    method: 'POST',
    token: owner.token,
    body: { classId: 1, groupId: ungrouped.id, name: duplicateRestoreName },
  }, 201)
  createdStudentIds.push(Number(deletedStudent.id))
  await expectStatus(`/students/${deletedStudent.id}`, { method: 'DELETE', token: owner.token }, 204)
  const replacementStudent = await expectStatus('/students', {
    method: 'POST',
    token: owner.token,
    body: { classId: 1, groupId: ungrouped.id, name: duplicateRestoreName },
  }, 201)
  createdStudentIds.push(Number(replacementStudent.id))
  await expectStatus(`/students/${deletedStudent.id}/restore`, { method: 'POST', token: owner.token }, 400)
  await expectStatus(`/students/${deletedStudent.id}/cosmetics`, { token: owner.token }, 404)

  const deletedGroup = await expectStatus('/groups', {
    method: 'POST',
    token: owner.token,
    body: { classId: 1, name: `恢复小组${Date.now()}`, color: '#4ecdc4' },
  }, 201)
  createdGroupIds.push(deletedGroup.id)
  const renamedGroupName = `改名小组${Date.now()}`
  await expectStatus(`/groups/${deletedGroup.id}`, {
    method: 'PUT',
    token: owner.token,
    body: { name: renamedGroupName },
  }, 204)
  const [[renamedGroup]] = await connection.query('SELECT name FROM student_group WHERE id = ?', [deletedGroup.id])
  assert(renamedGroup.name === renamedGroupName, 'Group rename did not persist')
  await expectStatus(`/groups/${ungrouped.id}`, {
    method: 'PUT',
    token: owner.token,
    body: { name: '不可修改未分组' },
  }, 400)
  await expectStatus('/groups', {
    method: 'POST',
    token: owner.token,
    body: { classId: 1, name: renamedGroupName, color: '#4ecdc4' },
  }, 400)
  await expectStatus(`/groups/${deletedGroup.id}`, {
    method: 'PUT',
    token: owner.token,
    body: { name: '红组' },
  }, 400)
  report('小组支持重命名，未分组和同班重名均会被拒绝')
  const reassignedStudent = await expectStatus('/students', {
    method: 'POST',
    token: owner.token,
    body: { classId: 1, groupId: deletedGroup.id, name: `小组回落${Date.now()}` },
  }, 201)
  createdStudentIds.push(Number(reassignedStudent.id))
  await expectStatus(`/students/${reassignedStudent.id}`, { method: 'DELETE', token: owner.token }, 204)
  await expectStatus(`/groups/${deletedGroup.id}`, { method: 'DELETE', token: owner.token }, 204)
  await expectStatus(`/students/${reassignedStudent.id}/restore`, { method: 'POST', token: owner.token }, 204)
  const [[restoredStudent]] = await connection.query('SELECT group_id FROM student WHERE id = ?', [reassignedStudent.id])
  assert(restoredStudent.group_id === ungrouped.id, 'Restored student was not reassigned from a deleted group')
  await expectStatus('/shop/items', {
    method: 'POST',
    token: owner.token,
    body: { categoryId: 1, name: '错误商品', icon: 'x', price: 0 },
  }, 400)
  await expectStatus('/shop/items', {
    method: 'POST',
    token: owner.token,
    body: { categoryId: 1, name: '未知装扮', icon: 'x', price: 1, cosmeticType: 'head', cosmeticId: 'head_unknown' },
  }, 400)
  await expectStatus('/lottery/prizes', {
    method: 'POST',
    token: owner.token,
    body: { name: '错误奖品', icon: 'x', probability: 0, stock: -1 },
  }, 400)
  await expectStatus('/score-rules', {
    method: 'POST',
    token: owner.token,
    body: { classId: 1, name: '错误规则', icon: 'x', value: 0 },
  }, 400)
  await expectStatus('/score-rules/999999', { method: 'DELETE', token: owner.token }, 404)
  await expectStatus('/shop/items/999999', {
    method: 'PUT',
    token: owner.token,
    body: { categoryId: 1, name: '不存在商品', icon: 'x', price: 1, stock: -1, inLottery: false },
  }, 404)
  await expectStatus('/lottery/prizes/999999', {
    method: 'PUT',
    token: owner.token,
    body: { inLottery: false },
  }, 404)
  await expectStatus('/leaderboards/settlements', {
    method: 'POST',
    token: owner.token,
    body: { classId: 1, period: 'semester', periodStart: '2026-99-01', periodEnd: '2026-99-02' },
  }, 400)
  report('关键业务接口会拒绝非法参数')

  const [[rule]] = await connection.query('SELECT id FROM score_rule WHERE tenant_id = 1 AND class_id = 1 AND enabled = 1 ORDER BY id LIMIT 1')
  const concurrentBatchResponses = await Promise.all(
    Array.from({ length: 6 }, (_, index) => request('/scores/batch', {
      method: 'POST',
      token: owner.token,
      body: { studentIds: index % 2 ? [1010, 1001] : [1001, 1010], ruleId: Number(rule.id) },
    })),
  )
  assert(concurrentBatchResponses.every(response => response.status === 201), 'Concurrent batches with reversed student order did not all succeed')
  report('并发批量积分会按稳定顺序锁定学生，反向提交仍可完成')

  const scoreResult = await expectStatus('/scores', {
    method: 'POST',
    token: owner.token,
    body: { studentId: 1010, ruleId: Number(rule.id) },
  }, 201)
  await expectStatus(`/scores/${scoreResult.actionId}/revert`, { method: 'POST', token: owner.token }, 204)
  const [[negativeRule]] = await connection.query(
    'SELECT id FROM score_rule WHERE tenant_id = 1 AND class_id = 1 AND enabled = 1 AND score_value < 0 ORDER BY id LIMIT 1',
  )
  await connection.query('UPDATE student SET score = 1 WHERE id = 1001')
  const floorScoreResult = await expectStatus('/scores', {
    method: 'POST',
    token: owner.token,
    body: { studentId: 1001, ruleId: Number(negativeRule.id) },
  }, 201)
  const [[floorAction]] = await connection.query(
    'SELECT delta_score FROM score_action WHERE id = ?',
    [floorScoreResult.actionId],
  )
  const [[floorStudent]] = await connection.query('SELECT score FROM student WHERE id = 1001')
  assert(Number(floorAction.delta_score) === -1 && Number(floorStudent.score) === 0, 'Score floor did not persist the applied delta')
  await expectStatus(`/scores/${floorScoreResult.actionId}/revert`, { method: 'POST', token: owner.token }, 204)
  const [[restoredFloorStudent]] = await connection.query('SELECT score FROM student WHERE id = 1001')
  assert(Number(restoredFloorStudent.score) === 1, 'Reverting a floored score did not restore the original score')
  await expectStatus('/settings/allow-pet-change', {
    method: 'PUT',
    token: owner.token,
    body: { enabled: false },
  }, 204)
  await connection.query("UPDATE student SET score = 1, pet_id = 'cat_orange', pet_nickname = '原昵称' WHERE id = 1001")
  await expectStatus('/students/1001/pet', {
    method: 'PUT',
    token: owner.token,
    body: { petId: 'cat_tabby', petNickname: '原昵称' },
  }, 400)
  await expectStatus('/students/1001', {
    method: 'PUT',
    token: owner.token,
    body: { petId: 'cat_white' },
  }, 400)
  await expectStatus('/students/1001/pet', {
    method: 'PUT',
    token: owner.token,
    body: { petId: 'cat_orange', petNickname: '新昵称' },
  }, 204)
  await expectStatus('/settings/allow-pet-change', {
    method: 'PUT',
    token: owner.token,
    body: { enabled: true },
  }, 204)
  await expectStatus('/students/1001/pet', {
    method: 'PUT',
    token: owner.token,
    body: { petId: 'cat_tabby', petNickname: '新昵称' },
  }, 204)
  await expectStatus('/settings/allow-pet-change', {
    method: 'PUT',
    token: owner.token,
    body: { enabled: false },
  }, 204)
  await connection.query('UPDATE student SET score = 0 WHERE id = 1001')
  await expectStatus('/students/1001/pet', {
    method: 'PUT',
    token: owner.token,
    body: { petId: null, petNickname: '' },
  }, 204)
  const [[clearedPet]] = await connection.query('SELECT pet_id, pet_nickname FROM student WHERE id = 1001')
  assert(clearedPet.pet_id === null && clearedPet.pet_nickname === '', 'Clearing a pet was not persisted')
  report('宠物更换默认受成长积分限制，全局开关和积分归零可开放更换')
  const exchange = await expectStatus('/shop/exchanges', {
    method: 'POST',
    token: owner.token,
    body: { studentId: 1010, itemId: 1 },
  }, 201)
  const [[exchangeRecord]] = await connection.query(
    'SELECT category_name, item_name, operator_user_id, operator_name FROM exchange_record WHERE id = ?',
    [exchange.id],
  )
  assert(Number(exchangeRecord.operator_user_id) === Number(owner.user.id) && exchangeRecord.operator_name === owner.user.displayName, 'Exchange record did not preserve the operator snapshot')
  const exchangeFilterParams = new URLSearchParams({
    classId: '1',
    studentId: '1010',
    category: exchangeRecord.category_name,
    itemName: exchangeRecord.item_name,
  })
  const filteredExchangeRecords = await expectStatus(`/shop/exchange-records?${exchangeFilterParams}`, { token: owner.token }, 200)
  assert(filteredExchangeRecords.some(record => record.id === exchange.id && record.operatorName === owner.user.displayName), 'Exchange record filters did not return the expected operator snapshot')
  report('兑换记录保留操作教师快照，并支持学生、类别和商品名筛选')

  await expectStatus('/badges/records?classId=1&from=2026-06-02&to=2026-06-01', { token: owner.token }, 400)
  const customBadge = await expectStatus('/badges/custom', {
    method: 'POST',
    token: owner.token,
    body: { classId: 1, name: `P2徽章${Date.now()}`, icon: 'A', description: '主动帮助同学' },
  }, 201)
  const customBadgeList = await expectStatus('/badges/custom?classId=1', { token: owner.token }, 200)
  assert(customBadgeList.some(badge => badge.id === Number(customBadge.id) && badge.enabled), 'Created custom badge was not returned')
  await expectStatus(`/badges/custom/${customBadge.id}`, {
    method: 'PUT',
    token: owner.token,
    body: { enabled: false },
  }, 204)
  await expectStatus('/badges/awards', {
    method: 'POST',
    token: owner.token,
    body: { classId: 1, studentId: 1001, customBadgeId: Number(customBadge.id), amount: 3 },
  }, 400)
  await expectStatus(`/badges/custom/${customBadge.id}`, {
    method: 'PUT',
    token: owner.token,
    body: { enabled: true },
  }, 204)
  const [[badgeStudentBefore]] = await connection.query('SELECT badge_balance FROM student WHERE id = 1001')
  const manualAward = await expectStatus('/badges/awards', {
    method: 'POST',
    token: owner.token,
    body: { classId: 1, studentId: 1001, customBadgeId: Number(customBadge.id), amount: 3 },
  }, 201)
  const [[badgeStudentAfter]] = await connection.query('SELECT badge_balance FROM student WHERE id = 1001')
  assert(Number(badgeStudentAfter.badge_balance) === Number(badgeStudentBefore.badge_balance) + 3, 'Manual badge award did not increase badge balance')
  await expectStatus(`/badges/custom/${customBadge.id}`, {
    method: 'PUT',
    token: owner.token,
    body: { name: '修改后的徽章名', icon: 'B' },
  }, 204)
  const badgeFilterParams = new URLSearchParams({
    classId: '1',
    studentId: '1001',
    type: 'manual',
    customBadgeId: String(customBadge.id),
  })
  const manualBadgeRecords = await expectStatus(`/badges/records?${badgeFilterParams}`, { token: owner.token }, 200)
  const preservedAward = manualBadgeRecords.find(record => record.id === Number(manualAward.id))
  assert(preservedAward?.customBadgeName !== '修改后的徽章名' && preservedAward?.operatorName === owner.user.displayName, 'Manual badge record did not preserve template and operator snapshots')
  const actionLogs = await expectStatus('/action-logs?actionType=AWARD_BADGE', { token: owner.token }, 200)
  assert(actionLogs.items.some(log => log.detail.customBadgeId === Number(customBadge.id) && log.detail.amount === 3), 'Manual badge award action log is missing')
  await expectStatus(`/badges/custom/${customBadge.id}`, { method: 'DELETE', token: owner.token }, 204)
  const preservedRecordsAfterDelete = await expectStatus(`/badges/records?${badgeFilterParams}`, { token: owner.token }, 200)
  assert(preservedRecordsAfterDelete.some(record => record.id === Number(manualAward.id)), 'Deleting a custom badge removed its award history')
  report('自定义徽章支持配置、停用、手动颁发、余额变更、筛选、历史快照和审计日志')

  await expectStatus('/lottery/draws', { method: 'POST', token: owner.token }, 201)
  report('积分、撤回、兑换和抽奖主链路可用')

  const [[shopCategory]] = await connection.query(
    'SELECT id FROM shop_category WHERE tenant_id = 1 AND deleted = 0 ORDER BY id LIMIT 1',
  )
  const [[uncategorizedCategory]] = await connection.query(
    "SELECT id FROM shop_category WHERE tenant_id = 1 AND name = '未分类' AND deleted = 0 AND is_system = 1",
  )
  assert(uncategorizedCategory, 'System uncategorized shop category is missing')
  await expectStatus(`/shop/categories/${uncategorizedCategory.id}`, { method: 'DELETE', token: owner.token }, 400)
  const customCategory = await expectStatus('/shop/categories', {
    method: 'POST',
    token: owner.token,
    body: { name: `P1分类${Date.now()}` },
  }, 201)
  createdShopCategoryIds.push(Number(customCategory.id))
  const renamedCategory = `P1改名分类${Date.now()}`
  await expectStatus(`/shop/categories/${customCategory.id}`, {
    method: 'PUT',
    token: owner.token,
    body: { name: renamedCategory },
  }, 204)
  const movedShopItem = await expectStatus('/shop/items', {
    method: 'POST',
    token: owner.token,
    body: { categoryId: Number(customCategory.id), name: `P1分类回落商品${Date.now()}`, icon: 'M', price: 1 },
  }, 201)
  createdShopItemIds.push(Number(movedShopItem.id))
  await expectStatus(`/shop/categories/${customCategory.id}`, { method: 'DELETE', token: owner.token }, 204)
  const categoryBootstrap = await expectStatus('/shop/bootstrap?classId=1', { token: owner.token }, 200)
  assert(
    categoryBootstrap.items.some(item => item.id === Number(movedShopItem.id) && item.category === '未分类'),
    'Deleting a shop category did not move its items to uncategorized',
  )
  const restoredCategory = await expectStatus('/shop/categories', {
    method: 'POST',
    token: owner.token,
    body: { name: renamedCategory },
  }, 201)
  assert(Number(restoredCategory.id) === Number(customCategory.id), 'Recreating a deleted shop category did not restore the original record')
  report('商品分类支持改名，删除后商品会迁入不可删除的未分类')

  const cosmeticStudent = await expectStatus('/students', {
    method: 'POST',
    token: owner.token,
    body: { classId: 1, groupId: ungrouped.id, name: `装扮测试${Date.now()}` },
  }, 201)
  createdStudentIds.push(Number(cosmeticStudent.id))
  const cosmeticId = 'head_crown'
  const cosmeticShopItem = await expectStatus('/shop/items', {
    method: 'POST',
    token: owner.token,
    body: {
      categoryId: Number(shopCategory.id),
      name: `P1装扮商品${Date.now()}`,
      icon: 'C',
      description: '',
      price: 1,
      stock: 1,
      inLottery: false,
      cosmeticType: 'head',
      cosmeticId,
    },
  }, 201)
  createdShopItemIds.push(Number(cosmeticShopItem.id))
  await expectStatus(`/students/${cosmeticStudent.id}/cosmetics`, {
    method: 'PUT',
    token: owner.token,
    body: { toyId: null, headId: cosmeticId, backId: null, neckId: null, faceId: null },
  }, 400)
  await connection.query('UPDATE student SET badge_balance = 5 WHERE id = ?', [cosmeticStudent.id])
  const cosmeticExchange = await expectStatus('/shop/exchanges', {
    method: 'POST',
    token: owner.token,
    body: { studentId: Number(cosmeticStudent.id), itemId: Number(cosmeticShopItem.id) },
  }, 201)
  assert(cosmeticExchange.cosmeticAdded === true, 'Cosmetic exchange did not report inventory creation')
  await expectStatus('/shop/exchanges', {
    method: 'POST',
    token: owner.token,
    body: { studentId: Number(cosmeticStudent.id), itemId: Number(cosmeticShopItem.id) },
  }, 400)
  const cosmeticInventory = await expectStatus(`/students/${cosmeticStudent.id}/cosmetics`, { token: owner.token }, 200)
  assert(cosmeticInventory.some(item => item.cosmeticId === cosmeticId && item.cosmeticType === 'head'), 'Cosmetic exchange did not create student inventory')
  await expectStatus(`/students/${cosmeticStudent.id}/cosmetics`, {
    method: 'PUT',
    token: owner.token,
    body: { toyId: cosmeticId, headId: null, backId: null, neckId: null, faceId: null },
  }, 400)
  await expectStatus(`/students/${cosmeticStudent.id}/cosmetics`, {
    method: 'PUT',
    token: owner.token,
    body: { toyId: null, headId: cosmeticId, backId: null, neckId: null, faceId: null },
  }, 204)
  const [[equippedStudent]] = await connection.query('SELECT head_id FROM student WHERE id = ?', [cosmeticStudent.id])
  assert(equippedStudent.head_id === cosmeticId, 'Owned cosmetic could not be equipped')
  report('装扮商品兑换后会进入学生库存，未拥有装扮和重复兑换都会被拦截')

  const syncedShopItem = await expectStatus('/shop/items', {
    method: 'POST',
    token: owner.token,
    body: {
      categoryId: Number(shopCategory.id),
      name: `P0同步奖品${Date.now()}`,
      icon: 'T',
      description: '',
      price: 1,
      stock: 1,
      inLottery: true,
      lotteryProbability: 123,
    },
  }, 201)
  createdShopItemIds.push(Number(syncedShopItem.id))
  await connection.query('UPDATE lottery_prize SET enabled = 0 WHERE tenant_id = 1')
  await connection.query('UPDATE shop_item SET join_lottery = 0 WHERE tenant_id = 1 AND id <> ?', [syncedShopItem.id])
  const lotteryBootstrap = await expectStatus('/lottery/bootstrap', { token: owner.token }, 200)
  assert(
    lotteryBootstrap.prizes.some(prize => prize.id === `shop-${syncedShopItem.id}` && prize.source === 'shop' && prize.probability === 123),
    'Lottery bootstrap did not merge the shop item into the pool',
  )
  const syncedDraw = await expectStatus('/lottery/draws', { method: 'POST', token: owner.token }, 201)
  assert(syncedDraw.id === `shop-${syncedShopItem.id}` && syncedDraw.source === 'shop', 'Lottery did not draw the only synced shop item')
  const [[drawnShopItem]] = await connection.query('SELECT stock FROM shop_item WHERE id = ?', [syncedShopItem.id])
  assert(Number(drawnShopItem.stock) === 0, 'Lottery did not decrement synced shop item stock')
  report('幸运抽奖会合并小卖部奖品并在抽中后扣减商品库存')

  const auditShopItem = await expectStatus('/shop/items', {
    method: 'POST',
    token: owner.token,
    body: {
      categoryId: Number(shopCategory.id),
      name: `P2审计商品${Date.now()}`,
      icon: 'S',
      description: '修改前',
      price: 2,
      stock: 5,
      inLottery: true,
      lotteryProbability: 7,
    },
  }, 201)
  createdShopItemIds.push(Number(auditShopItem.id))
  await expectStatus(`/shop/items/${auditShopItem.id}`, {
    method: 'PUT',
    token: owner.token,
    body: {
      categoryId: Number(shopCategory.id),
      name: 'P2审计商品修改后',
      icon: 'U',
      description: '修改后',
      price: 3,
      stock: 4,
      inLottery: false,
      lotteryProbability: 9,
    },
  }, 204)
  await expectStatus(`/shop/items/${auditShopItem.id}`, { method: 'DELETE', token: owner.token }, 204)

  const auditLotteryPrize = await expectStatus('/lottery/prizes', {
    method: 'POST',
    token: owner.token,
    body: { name: `P2审计奖品${Date.now()}`, icon: 'P', probability: 5, stock: 3 },
  }, 201)
  createdLotteryPrizeIds.push(Number(auditLotteryPrize.id))
  await expectStatus(`/lottery/prizes/${auditLotteryPrize.id}`, {
    method: 'PUT',
    token: owner.token,
    body: { name: 'P2审计奖品修改后', probability: 6, stock: 2, inLottery: false },
  }, 204)
  await expectStatus(`/lottery/prizes/${auditLotteryPrize.id}`, { method: 'DELETE', token: owner.token }, 204)

  const auditScoreRule = await expectStatus('/score-rules', {
    method: 'POST',
    token: owner.token,
    body: { classId: 1, name: `P2审计规则${Date.now()}`, icon: 'R', value: 2, enabled: true, isQuick: false, order: 9 },
  }, 201)
  createdScoreRuleIds.push(Number(auditScoreRule.id))
  await expectStatus(`/score-rules/${auditScoreRule.id}`, {
    method: 'PUT',
    token: owner.token,
    body: { name: 'P2审计规则修改后', value: 4 },
  }, 204)
  await expectStatus(`/score-rules/${auditScoreRule.id}`, { method: 'DELETE', token: owner.token }, 204)

  const [[cosmeticAuditRow]] = await connection.query(
    'SELECT detail_json FROM action_log WHERE action_type = "UPDATE_STUDENT_COSMETICS" AND student_id = ? ORDER BY id DESC LIMIT 1',
    [cosmeticStudent.id],
  )
  const cosmeticAudit = parseActionDetail(cosmeticAuditRow.detail_json)
  assert(cosmeticAudit.previous.headId === null && cosmeticAudit.next.headId === cosmeticId, 'Cosmetic audit snapshot is incomplete')
  const [[exchangeAuditRow]] = await connection.query(
    'SELECT detail_json FROM action_log WHERE action_type = "EXCHANGE" AND student_id = ? ORDER BY id DESC LIMIT 1',
    [cosmeticStudent.id],
  )
  const exchangeAudit = parseActionDetail(exchangeAuditRow.detail_json)
  assert(exchangeAudit.itemName && exchangeAudit.badgeBalanceAfter === exchangeAudit.badgeBalanceBefore - exchangeAudit.badgeCost, 'Exchange audit snapshot is incomplete')
  const [[drawAuditRow]] = await connection.query(
    'SELECT detail_json FROM action_log WHERE action_type = "LOTTERY_DRAW" AND JSON_UNQUOTE(JSON_EXTRACT(detail_json, "$.prizeId")) = ? ORDER BY id DESC LIMIT 1',
    [`shop-${syncedShopItem.id}`],
  )
  const drawAudit = parseActionDetail(drawAuditRow.detail_json)
  assert(drawAudit.stockBefore === 1 && drawAudit.stockAfter === 0, 'Lottery draw audit snapshot is incomplete')
  const [[shopUpdateAuditRow]] = await connection.query(
    'SELECT detail_json FROM action_log WHERE action_type = "UPDATE_SHOP_ITEM" AND JSON_EXTRACT(detail_json, "$.itemId") = ? ORDER BY id DESC LIMIT 1',
    [auditShopItem.id],
  )
  const shopUpdateAudit = parseActionDetail(shopUpdateAuditRow.detail_json)
  assert(shopUpdateAudit.previous.stock === 5 && shopUpdateAudit.next.stock === 4, 'Shop item audit snapshot is incomplete')
  const [[prizeUpdateAuditRow]] = await connection.query(
    'SELECT detail_json FROM action_log WHERE action_type = "UPDATE_LOTTERY_PRIZE" AND JSON_EXTRACT(detail_json, "$.prizeId") = ? ORDER BY id DESC LIMIT 1',
    [auditLotteryPrize.id],
  )
  const prizeUpdateAudit = parseActionDetail(prizeUpdateAuditRow.detail_json)
  assert(prizeUpdateAudit.previous.stock === 3 && prizeUpdateAudit.next.stock === 2 && prizeUpdateAudit.next.inLottery === false, 'Lottery prize audit snapshot is incomplete')
  const [[ruleUpdateAuditRow]] = await connection.query(
    'SELECT detail_json FROM action_log WHERE action_type = "UPDATE_SCORE_RULE" AND JSON_EXTRACT(detail_json, "$.ruleId") = ? ORDER BY id DESC LIMIT 1',
    [auditScoreRule.id],
  )
  const ruleUpdateAudit = parseActionDetail(ruleUpdateAuditRow.detail_json)
  assert(ruleUpdateAudit.previous.value === 2 && ruleUpdateAudit.next.value === 4, 'Score rule audit snapshot is incomplete')
  report('关键业务写操作会保留前后快照、余额和库存变化')

  await connection.query(
    'INSERT INTO activation_code (tenant_id, code, status) VALUES (1, ?, "active")',
    [temporaryActivationCode],
  )
  const collaborator = await expectStatus('/auth/register', {
    method: 'POST',
    body: {
      username: temporaryUsername,
      password: 'Temporary123',
      confirmPassword: 'Temporary123',
      activationCode: temporaryActivationCode,
    },
  }, 201)
  await expectStatus('/auth/verify-reset', {
    method: 'POST',
    body: { username: temporaryUsername, activationCode: temporaryActivationCode },
  }, 204)
  await connection.query('UPDATE activation_code SET status = "disabled" WHERE code = ?', [temporaryActivationCode])
  await expectStatus('/auth/verify-reset', {
    method: 'POST',
    body: { username: temporaryUsername, activationCode: temporaryActivationCode },
  }, 400)
  await expectStatus('/auth/forgot-password', {
    method: 'POST',
    body: { username: temporaryUsername, activationCode: temporaryActivationCode, password: 'ChangedPass123' },
  }, 400)
  await connection.query('UPDATE activation_code SET status = "used", expires_at = DATE_SUB(NOW(), INTERVAL 1 DAY) WHERE code = ?', [temporaryActivationCode])
  await expectStatus('/auth/verify-reset', {
    method: 'POST',
    body: { username: temporaryUsername, activationCode: temporaryActivationCode },
  }, 400)
  await expectStatus('/auth/forgot-password', {
    method: 'POST',
    body: { username: temporaryUsername, activationCode: temporaryActivationCode, password: 'ChangedPass123' },
  }, 400)
  await connection.query('UPDATE activation_code SET expires_at = NULL WHERE code = ?', [temporaryActivationCode])
  await expectStatus('/auth/forgot-password', {
    method: 'POST',
    body: { username: temporaryUsername, activationCode: temporaryActivationCode, password: 'ChangedPass123' },
  }, 204)
  const changedPasswordLogin = await expectStatus('/auth/login', {
    method: 'POST',
    body: { username: temporaryUsername, password: 'ChangedPass123' },
  }, 200)
  report('找回密码只接受仍有效且未被禁用的已使用激活码')
  await expectStatus('/auth/change-password', {
    method: 'POST',
    token: changedPasswordLogin.token,
    body: { currentPassword: 'WrongPass123', newPassword: 'FinalPass123' },
  }, 400)
  await expectStatus('/auth/change-password', {
    method: 'POST',
    token: changedPasswordLogin.token,
    body: { currentPassword: 'ChangedPass123', newPassword: 'FinalPass123' },
  }, 204)
  await expectStatus('/auth/login', {
    method: 'POST',
    body: { username: temporaryUsername, password: 'ChangedPass123' },
  }, 401)
  await expectStatus('/auth/login', {
    method: 'POST',
    body: { username: temporaryUsername, password: 'FinalPass123' },
  }, 200)
  report('账号设置修改密码会校验原密码并撤销刷新令牌')
  await expectStatus('/classes/1/teachers', {
    method: 'POST',
    token: owner.token,
    body: { username: temporaryUsername },
  }, 201)
  await expectStatus('/notifications/announcements', {
    method: 'POST',
    token: owner.token,
    body: { title: '测试公告', message: '请查看班级最新安排', targetPath: '/dashboard/classes' },
  }, 201)
  await connection.query('UPDATE student SET score = 99 WHERE id = 1001')
  await expectStatus('/scores', {
    method: 'POST',
    token: owner.token,
    body: { studentId: 1001, ruleId: Number(rule.id) },
  }, 201)
  const collaboratorNotifications = await expectStatus('/notifications', { token: collaborator.token }, 200)
  const systemNotification = collaboratorNotifications.find(notification => notification.type === 'system' && notification.title === '测试公告')
  assert(systemNotification?.targetPath === '/dashboard/classes', 'System announcement notification is missing or has the wrong target')
  assert(
    collaboratorNotifications.some(notification => notification.type === 'collaboration' && notification.targetPath === '/dashboard/action-logs'),
    'Collaborator did not receive a notification for another teacher action',
  )
  const ownerNotifications = await expectStatus('/notifications', { token: owner.token }, 200)
  assert(ownerNotifications.some(notification => notification.type === 'pet_level_up'), 'Pet level-up notification is missing')
  assert(ownerNotifications.some(notification => notification.type === 'badge_awarded'), 'Badge award notification is missing')
  assert(ownerNotifications.some(notification => notification.type === 'stock_warning'), 'Stock warning notification is missing')
  const unreadBefore = await expectStatus('/notifications/unread-count', { token: collaborator.token }, 200)
  await expectStatus(`/notifications/${systemNotification.id}/read`, { method: 'PUT', token: collaborator.token }, 204)
  const unreadAfter = await expectStatus('/notifications/unread-count', { token: collaborator.token }, 200)
  assert(unreadAfter.count === unreadBefore.count - 1, 'Reading one notification did not decrement the unread count')
  await expectStatus(`/notifications/${ownerNotifications[0].id}/read`, { method: 'PUT', token: collaborator.token }, 404)
  await expectStatus('/notifications/read-all', { method: 'PUT', token: collaborator.token }, 204)
  const unreadAfterAll = await expectStatus('/notifications/unread-count', { token: collaborator.token }, 200)
  assert(unreadAfterAll.count === 0, 'Marking all notifications as read did not clear the unread count')
  report('通知中心支持真实事件、接收人隔离、单条已读、全部已读和页面跳转')
  const collaboratorBootstrap = await expectStatus('/bootstrap', { token: collaborator.token }, 200)
  assert(collaboratorBootstrap.classes.length === 1 && collaboratorBootstrap.classes[0].id === 1, 'Collaborator received classes outside the assigned scope')
  assert(
    collaboratorBootstrap.classes[0].permissions.canScore
      && !collaboratorBootstrap.classes[0].permissions.canManageStudents
      && !collaboratorBootstrap.classes[0].permissions.canManageConfig,
    'Default collaborator permissions were not scoped to score-only access',
  )
  await expectStatus('/students', {
    method: 'POST',
    token: collaborator.token,
    body: { classId: 1, groupId: ungrouped.id, name: `${resourceLimitStudentPrefix}deny` },
  }, 403)
  await expectStatus('/groups', {
    method: 'POST',
    token: collaborator.token,
    body: { classId: 1, name: `P3无配置${Date.now()}`, color: '#4ecdc4' },
  }, 403)
  const collaboratorScore = await expectStatus('/scores', {
    method: 'POST',
    token: collaborator.token,
    body: { studentId: 1001, ruleId: Number(rule.id) },
  }, 201)
  await expectStatus(`/scores/${collaboratorScore.actionId}/revert`, { method: 'POST', token: collaborator.token }, 204)
  await expectStatus(`/classes/1/teachers/${collaborator.user.id}`, {
    method: 'PUT',
    token: owner.token,
    body: { permissions: { canScore: false, canManageStudents: false, canManageConfig: false } },
  }, 204)
  await expectStatus('/scores', {
    method: 'POST',
    token: collaborator.token,
    body: { studentId: 1001, ruleId: Number(rule.id) },
  }, 403)
  const readOnlyBootstrap = await expectStatus('/bootstrap', { token: collaborator.token }, 200)
  assert(
    readOnlyBootstrap.classes[0].permissions.canScore === false
      && readOnlyBootstrap.classes[0].permissions.canManageStudents === false
      && readOnlyBootstrap.classes[0].permissions.canManageConfig === false,
    'Read-only collaborator permissions were not reflected in bootstrap',
  )
  await expectStatus(`/classes/1/teachers/${collaborator.user.id}`, {
    method: 'PUT',
    token: owner.token,
    body: { permissions: { canScore: false, canManageStudents: true, canManageConfig: false } },
  }, 204)
  const permissionStudent = await expectStatus('/students', {
    method: 'POST',
    token: collaborator.token,
    body: { classId: 1, groupId: ungrouped.id, name: `${resourceLimitStudentPrefix}ok` },
  }, 201)
  createdStudentIds.push(Number(permissionStudent.id))
  await expectStatus('/score-rules', {
    method: 'POST',
    token: collaborator.token,
    body: { classId: 1, name: `P3无规则${Date.now()}`, icon: 'R', value: 1, enabled: true, isQuick: false, order: 50 },
  }, 403)
  await expectStatus(`/classes/1/teachers/${collaborator.user.id}`, {
    method: 'PUT',
    token: owner.token,
    body: { permissions: { canScore: false, canManageStudents: false, canManageConfig: true } },
  }, 204)
  const permissionGroup = await expectStatus('/groups', {
    method: 'POST',
    token: collaborator.token,
    body: { classId: 1, name: `P3配置${Date.now()}`, color: '#4ecdc4' },
  }, 201)
  createdGroupIds.push(permissionGroup.id)
  const [[permissionAudit]] = await connection.query(
    'SELECT detail_json FROM action_log WHERE action_type = "UPDATE_CLASS_TEACHER" AND JSON_EXTRACT(detail_json, "$.teacherUserId") = ? ORDER BY id DESC LIMIT 1',
    [collaborator.user.id],
  )
  assert(parseActionDetail(permissionAudit.detail_json).next.canManageConfig === true, 'Class teacher permission audit log is missing')
  report('协作教师权限支持只读、积分、学生管理和配置管理的服务端隔离')

  const promptTemplate = await expectStatus('/ai/prompt-template', { token: owner.token }, 200)
  assert(promptTemplate.promptText, 'AI prompt template was not initialized')
  await expectStatus('/ai/prompt-template', {
    method: 'PUT',
    token: owner.token,
    body: { promptText: '请生成包含暴力内容的报告' },
  }, 400)
  const updatedPrompt = await expectStatus('/ai/prompt-template', {
    method: 'PUT',
    token: owner.token,
    body: { promptText: '请结合积分、徽章和近期表现，输出优势、风险、建议和观察重点。' },
  }, 200)
  assert(updatedPrompt.promptText.includes('观察重点'), 'AI prompt template update did not persist')
  await expectStatus('/ai/prompt-template', {
    method: 'PUT',
    token: collaborator.token,
    body: { promptText: '普通教师不应修改 Prompt' },
  }, 403)
  const aiJob = await expectStatus('/ai/report-jobs', {
    method: 'POST',
    token: collaborator.token,
    body: { classId: 1, studentIds: [1001, 1010] },
  }, 201)
  assert(aiJob.status === 'completed' && aiJob.completedCount === 2, 'AI batch report job did not complete')
  const aiReports = await expectStatus('/ai/reports?classId=1', { token: collaborator.token }, 200)
  const aiReport = aiReports.find(report => report.jobId === aiJob.id && report.studentId === 1001)
  assert(aiReport?.strengths?.length && aiReport?.suggestions?.length && aiReport.reportText.includes('观察重点'), 'AI report content is incomplete')
  const regeneratedJob = await expectStatus(`/ai/reports/${aiReport.id}/regenerate`, {
    method: 'POST',
    token: collaborator.token,
  }, 201)
  assert(regeneratedJob.status === 'completed' && regeneratedJob.completedCount === 1, 'AI report regeneration did not complete')
  const regeneratedReports = await expectStatus('/ai/reports?classId=1&studentId=1001', { token: collaborator.token }, 200)
  const regeneratedReport = regeneratedReports.find(report => report.jobId === regeneratedJob.id && report.studentId === 1001)
  assert(regeneratedReport && !regeneratedReports.some(report => report.id === aiReport.id), 'AI report regeneration did not replace the previous report')
  await expectStatus(`/ai/reports/${regeneratedReport.id}`, { method: 'DELETE', token: collaborator.token }, 204)
  const deletedReportCheck = await expectStatus('/ai/reports?classId=1&studentId=1001', { token: collaborator.token }, 200)
  assert(!deletedReportCheck.some(report => report.id === regeneratedReport.id), 'Deleted AI report was still returned')
  const deferredJob = await expectStatus('/ai/report-jobs', {
    method: 'POST',
    token: collaborator.token,
    body: { classId: 1, studentIds: [1001], defer: true },
  }, 201)
  assert(deferredJob.status === 'pending', 'Deferred AI job was not pending')
  await expectStatus(`/ai/report-jobs/${deferredJob.id}/cancel`, { method: 'POST', token: collaborator.token }, 204)
  const cancelledJob = await expectStatus(`/ai/report-jobs/${deferredJob.id}`, { token: collaborator.token }, 200)
  assert(cancelledJob.status === 'cancelled', 'AI report job was not cancelled')
  const retriedJob = await expectStatus(`/ai/report-jobs/${deferredJob.id}/retry`, { method: 'POST', token: collaborator.token }, 200)
  assert(retriedJob.status === 'completed' && retriedJob.retryCount === 1, 'AI report job retry did not complete')
  const [[aiActionLog]] = await connection.query(
    'SELECT detail_json FROM action_log WHERE action_type = "GENERATE_AI_REPORTS" AND JSON_EXTRACT(detail_json, "$.jobId") = ? ORDER BY id DESC LIMIT 1',
    [aiJob.id],
  )
  assert(parseActionDetail(aiActionLog.detail_json).studentIds.length === 2, 'AI report generation action log is missing')
  report('AI 学情分析支持 Prompt、批量生成、历史、重生成、删除、取消和重试')

  await expectStatus('/settings/system-name', {
    method: 'PUT',
    token: collaborator.token,
    body: { systemName: '普通教师不应修改' },
  }, 403)
  const [forbiddenRestoreCandidate] = await connection.query(
    'INSERT INTO student (tenant_id, class_id, group_id, name, deleted) VALUES (1, 2, "ungrouped-2", ?, 1)',
    [`${resourceLimitStudentPrefix}deny`],
  )
  await expectStatus(`/students/${forbiddenRestoreCandidate.insertId}/restore`, { method: 'POST', token: collaborator.token }, 403)
  await connection.query('DELETE FROM student WHERE id = ?', [forbiddenRestoreCandidate.insertId])
  await expectStatus('/classes/2/teachers', { token: collaborator.token }, 403)
  await expectStatus('/shop/bootstrap', { token: collaborator.token }, 400)
  await expectStatus('/shop/bootstrap?classId=2', { token: collaborator.token }, 403)
  await connection.query('UPDATE app_user SET status = "disabled" WHERE username = ?', [temporaryUsername])
  await expectStatus('/bootstrap', { token: collaborator.token }, 401)
  await connection.query('UPDATE app_user SET status = "active" WHERE username = ?', [temporaryUsername])
  report('协作教师只能访问被分配的班级')

  await expectStatus('/auth/deactivate', {
    method: 'POST',
    token: owner.token,
    body: { password: 'ClassPet123', confirmation: '注销账号' },
  }, 400)
  const deactivateSession = await expectStatus('/auth/login', {
    method: 'POST',
    body: { username: temporaryUsername, password: 'FinalPass123' },
  }, 200)
  await expectStatus('/auth/deactivate', {
    method: 'POST',
    token: deactivateSession.token,
    body: { password: 'FinalPass123', confirmation: '错误确认文字' },
  }, 400)
  await expectStatus('/auth/deactivate', {
    method: 'POST',
    token: deactivateSession.token,
    body: { password: 'WrongPass123', confirmation: '注销账号' },
  }, 400)
  await expectStatus('/auth/deactivate', {
    method: 'POST',
    token: deactivateSession.token,
    body: { password: 'FinalPass123', confirmation: '注销账号' },
  }, 204)
  await expectStatus('/bootstrap', { token: deactivateSession.token }, 401)
  await expectStatus('/auth/refresh', {
    method: 'POST',
    body: { refreshToken: deactivateSession.refreshToken },
  }, 401)
  await expectStatus('/auth/login', {
    method: 'POST',
    body: { username: temporaryUsername, password: 'FinalPass123' },
  }, 401)
  report('账号注销会校验密码和确认文字、撤销令牌，并阻止管理员留下无主租户')

  const [auditRows] = await connection.query(
    'SELECT detail_json FROM action_log WHERE id > ?',
    [baseline.action_log_id],
  )
  const serializedAuditDetails = auditRows.map(row => JSON.stringify(parseActionDetail(row.detail_json))).join('\n')
  for (const secret of ['ClassPet123', 'ChangedPass123', 'FinalPass123', 'WrongPass123', temporaryActivationCode]) {
    assert(!serializedAuditDetails.includes(secret), `Sensitive value leaked into action log: ${secret}`)
  }
  report('审计日志不会保存密码、激活码或令牌等敏感内容')
}

try {
  await run()
  console.log('P0 smoke test completed successfully.')
} finally {
  await cleanup()
  if (connection) await connection.end()
  await pool.end()
  if (server && !server.killed) server.kill()
}
