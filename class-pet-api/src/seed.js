import bcrypt from 'bcryptjs'

const gradients = [
  ['#4ecdc4', '#95e1d3'],
  ['#ff6b9d', '#c44569'],
]

const names = [
  '陈静', '刘明', '王芳', '张磊', '李娜', '赵平', '周洋', '吴敏', '郑美', '钱帅',
  '孙华', '李强', '周杰', '吴桐', '郑宇', '王梅', '赵聪', '周欣', '吴超', '叶文',
  '孙丽', '马骏', '黄鑫', '陈帅', '刘晓', '林佳', '徐明', '朱亮', '高燕', '唐飞',
]

const scores = [12, 25, 38, 45, 53, 67, 72, 85, 91, 105, 118, 125, 133, 148, 156, 162, 178, 183, 195, 208, 220, 235, 18, 44, 88, 130, 165, 192, 48, 78]
const petIds = ['cat_orange', 'cat_tabby', 'cat_white']

const groups = [
  ['ungrouped', '未分组', '#9ca3af', 'bg-gray-100', 'text-gray-600'],
  ['red', '红组', '#ef4444', 'bg-[#fecaca]', 'text-[#991b1b]'],
  ['blue', '蓝组', '#3b82f6', 'bg-[#bfdbfe]', 'text-[#1e40af]'],
  ['yellow', '黄组', '#f59e0b', 'bg-[#fef08a]', 'text-[#854d0e]'],
  ['green', '绿组', '#22c55e', 'bg-[#bbf7d0]', 'text-[#166534]'],
]

const rules = [
  ['认真听讲', '👂', 2, 1],
  ['积极回答', '✋', 3, 1],
  ['作业优秀', '📝', 5, 1],
  ['帮助同学', '🤝', 3, 0],
  ['课堂表现优秀', '⭐', 5, 0],
  ['违反纪律', '⚠️', -2, 0],
  ['未完成作业', '❌', -3, 0],
]

const categories = ['文具', '奖励', '特权', '未分类']
const shopItems = [
  [1, '铅笔', '✏️', '优质2B铅笔一支', 1, -1, 0],
  [1, '橡皮', '🧽', '大块无尘橡皮', 1, -1, 0],
  [1, '笔记本', '📒', '精美笔记本一本', 3, 10, 1],
  [2, '贴纸包', '🌟', '精美贴纸若干', 2, 20, 1],
  [2, '小零食', '🍪', '美味小零食一份', 2, 15, 1],
  [3, '免作业券', '📋', '一次免做作业的机会', 5, 5, 1],
  [3, '座位自选券', '💺', '一次自由选座位机会', 8, 3, 0],
  [2, '图书借阅券', '📚', '优先借阅图书馆书籍', 3, -1, 0],
]

const lotteryPrizes = [
  ['铅笔一支', '✏️', 30, -1],
  ['橡皮一块', '🧽', 25, -1],
  ['笔记本', '📒', 20, 5],
  ['书签', '🔖', 15, 10],
  ['再来一次', '🔁', 10, -1],
]

export async function seedDemoData(connection) {
  const [[tenantCount]] = await connection.query('SELECT COUNT(*) AS count FROM tenant')
  if (Number(tenantCount.count) === 0) {
    await connection.query('INSERT INTO tenant (id, name) VALUES (1, ?)', ['本地演示租户'])
  }

  const [[userCount]] = await connection.query('SELECT COUNT(*) AS count FROM app_user WHERE username = ?', ['teacher'])
  if (Number(userCount.count) === 0) {
    const passwordHash = await bcrypt.hash('ClassPet123', 10)
    const [userResult] = await connection.query(
      `INSERT INTO app_user (tenant_id, username, password_hash, display_name, role)
       VALUES (1, 'teacher', ?, '张老师', 'owner')`,
      [passwordHash],
    )
    await connection.query(
      `INSERT IGNORE INTO activation_code
        (tenant_id, code, status, used_by_user_id, used_at)
       VALUES (1, 'DEMO-TEACHER-2026', 'used', ?, NOW())`,
      [userResult.insertId],
    )
  }
  await connection.query(
    `INSERT IGNORE INTO activation_code (tenant_id, code, status)
     VALUES (1, 'DEMO-REGISTER-2026', 'active')`,
  )

  const [[classCount]] = await connection.query('SELECT COUNT(*) AS count FROM class_room WHERE tenant_id = 1')
  if (Number(classCount.count) > 0) {
    await seedClassTeachers(connection)
    return
  }

  for (let classId = 1; classId <= 2; classId += 1) {
    await connection.query(
      'INSERT INTO class_room (id, tenant_id, name, gradient_from, gradient_to) VALUES (?, 1, ?, ?, ?)',
      [classId, `三年级(${classId})班`, gradients[classId - 1][0], gradients[classId - 1][1]],
    )

    for (const [key, name, color, bgClass, textClass] of groups) {
      await connection.query(
        `INSERT INTO student_group
          (id, tenant_id, class_id, name, color, bg_class, text_class, border_color, is_ungrouped)
         VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?)`,
        [`${key}-${classId}`, classId, name, color, bgClass, textClass, color, key === 'ungrouped' ? 1 : 0],
      )
    }

    for (let index = 0; index < rules.length; index += 1) {
      const [name, icon, value, isQuick] = rules[index]
      await connection.query(
        `INSERT INTO score_rule
          (tenant_id, class_id, name, icon, score_value, enabled, is_quick, sort_order)
         VALUES (1, ?, ?, ?, ?, 1, ?, ?)`,
        [classId, name, icon, value, isQuick, index + 1],
      )
    }

    const activeGroupIds = ['red', 'blue', 'yellow', 'green'].map(group => `${group}-${classId}`)
    for (let index = 0; index < names.length; index += 1) {
      const studentId = classId * 1000 + index + 1
      const score = scores[index]
      const badgeBalance = Math.floor(score / 100)
      await connection.query(
        `INSERT INTO student
          (id, tenant_id, class_id, group_id, name, pet_id, score, badge_balance)
         VALUES (?, 1, ?, ?, ?, ?, ?, ?)`,
        [studentId, classId, activeGroupIds[index % activeGroupIds.length], names[index], petIds[index % petIds.length], score, badgeBalance],
      )
      for (let milestone = 100; milestone <= score; milestone += 100) {
        await connection.query(
          `INSERT INTO badge_record
            (tenant_id, class_id, student_id, badge_type, amount, description, milestone)
           VALUES (1, ?, ?, 'milestone', 1, ?, ?)`,
          [classId, studentId, `达到 ${milestone} 积分`, milestone],
        )
      }
    }
  }

  await connection.query(
    `INSERT INTO app_setting (tenant_id, setting_key, setting_value)
     VALUES (1, 'level_thresholds', JSON_ARRAY(50, 100, 150, 200))`,
  )

  for (let index = 0; index < categories.length; index += 1) {
    await connection.query(
      'INSERT INTO shop_category (id, tenant_id, name, sort_order, is_system) VALUES (?, 1, ?, ?, ?)',
      [index + 1, categories[index], index + 1, categories[index] === '未分类' ? 1 : 0],
    )
  }

  for (const [categoryId, name, icon, description, price, stock, joinLottery] of shopItems) {
    await connection.query(
      `INSERT INTO shop_item
        (tenant_id, category_id, name, icon, description, price, stock, join_lottery)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?)`,
      [categoryId, name, icon, description, price, stock, joinLottery],
    )
  }

  for (const [name, icon, probability, stock] of lotteryPrizes) {
    await connection.query(
      `INSERT INTO lottery_prize
        (tenant_id, name, icon, probability, stock)
       VALUES (1, ?, ?, ?, ?)`,
      [name, icon, probability, stock],
    )
  }

  await seedClassTeachers(connection)
}

async function seedClassTeachers(connection) {
  const [[teacher]] = await connection.query(
    `SELECT id FROM app_user
     WHERE tenant_id = 1 AND username = 'teacher' AND status = 'active'`,
  )
  if (!teacher) return
  await connection.query(
    `INSERT IGNORE INTO class_teacher (tenant_id, class_id, user_id, added_by_user_id)
     SELECT tenant_id, id, ?, ?
     FROM class_room
     WHERE tenant_id = 1 AND deleted = 0`,
    [teacher.id, teacher.id],
  )
}
