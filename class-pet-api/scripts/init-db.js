import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'
import { connectionOptions, databaseName } from '../src/db.js'
import { seedDemoData } from '../src/seed.js'

const directory = path.dirname(fileURLToPath(import.meta.url))
const schemaPath = path.resolve(directory, '../sql/schema.sql')
const schema = (await fs.readFile(schemaPath, 'utf8')).replaceAll('class_pet_management', databaseName)
const connection = await mysql.createConnection({
  ...connectionOptions,
  multipleStatements: true,
})

async function applyMigration(migrationId, handler) {
  const [[applied]] = await connection.query(
    'SELECT migration_id FROM schema_migration WHERE migration_id = ?',
    [migrationId],
  )
  if (applied) return
  await handler()
  await connection.query('INSERT INTO schema_migration (migration_id) VALUES (?)', [migrationId])
  console.log(`Applied migration ${migrationId}.`)
}

async function runMigrations() {
  await applyMigration('20260601_action_log_operator', async () => {
    const [[operatorColumn]] = await connection.query(
      `SELECT COUNT(*) AS count
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ?
         AND TABLE_NAME = 'action_log'
         AND COLUMN_NAME = 'operator_user_id'`,
      [databaseName],
    )
    if (!Number(operatorColumn.count)) {
      await connection.query('ALTER TABLE action_log ADD COLUMN operator_user_id BIGINT NULL AFTER student_id')
    }

    const [[operatorIndex]] = await connection.query(
      `SELECT COUNT(*) AS count
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = ?
         AND TABLE_NAME = 'action_log'
         AND INDEX_NAME = 'idx_action_log_operator'`,
      [databaseName],
    )
    if (!Number(operatorIndex.count)) {
      await connection.query('ALTER TABLE action_log ADD INDEX idx_action_log_operator (tenant_id, operator_user_id)')
    }

    const [[operatorForeignKey]] = await connection.query(
      `SELECT COUNT(*) AS count
       FROM information_schema.TABLE_CONSTRAINTS
       WHERE CONSTRAINT_SCHEMA = ?
         AND TABLE_NAME = 'action_log'
         AND CONSTRAINT_NAME = 'fk_action_log_operator'`,
      [databaseName],
    )
    if (!Number(operatorForeignKey.count)) {
      await connection.query(
        'ALTER TABLE action_log ADD CONSTRAINT fk_action_log_operator FOREIGN KEY (operator_user_id) REFERENCES app_user(id)',
      )
    }
  })

  await applyMigration('20260602_leaderboard_settlement', async () => {
    const [[settlementColumn]] = await connection.query(
      `SELECT COUNT(*) AS count
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ?
         AND TABLE_NAME = 'badge_record'
         AND COLUMN_NAME = 'settlement_id'`,
      [databaseName],
    )
    if (!Number(settlementColumn.count)) {
      await connection.query('ALTER TABLE badge_record ADD COLUMN settlement_id BIGINT NULL AFTER milestone')
    }

    const [[settlementIndex]] = await connection.query(
      `SELECT COUNT(*) AS count
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = ?
         AND TABLE_NAME = 'badge_record'
         AND INDEX_NAME = 'uk_badge_settlement_student'`,
      [databaseName],
    )
    if (!Number(settlementIndex.count)) {
      await connection.query('ALTER TABLE badge_record ADD UNIQUE KEY uk_badge_settlement_student (settlement_id, student_id)')
    }

    const [[settlementForeignKey]] = await connection.query(
      `SELECT COUNT(*) AS count
       FROM information_schema.TABLE_CONSTRAINTS
       WHERE CONSTRAINT_SCHEMA = ?
         AND TABLE_NAME = 'badge_record'
         AND CONSTRAINT_NAME = 'fk_badge_record_settlement'`,
      [databaseName],
    )
    if (!Number(settlementForeignKey.count)) {
      await connection.query(
        'ALTER TABLE badge_record ADD CONSTRAINT fk_badge_record_settlement FOREIGN KEY (settlement_id) REFERENCES leaderboard_settlement(id)',
      )
    }
  })

  await applyMigration('20260602_p0_auth_safety', async () => {})

  await applyMigration('20260602_auth_reset_guard', async () => {
    await connection.query(
      `CREATE TABLE IF NOT EXISTS auth_reset_guard (
        client_ip VARCHAR(64) PRIMARY KEY,
        failure_count INT NOT NULL DEFAULT 0,
        first_failed_at DATETIME NULL,
        locked_until DATETIME NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_auth_reset_guard_lock (locked_until)
      ) ENGINE=InnoDB`,
    )
  })

  await applyMigration('20260602_lottery_shop_items', async () => {
    const [[lotteryProbabilityColumn]] = await connection.query(
      `SELECT COUNT(*) AS count
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ?
         AND TABLE_NAME = 'shop_item'
         AND COLUMN_NAME = 'lottery_probability'`,
      [databaseName],
    )
    if (!Number(lotteryProbabilityColumn.count)) {
      await connection.query('ALTER TABLE shop_item ADD COLUMN lottery_probability INT NOT NULL DEFAULT 10 AFTER join_lottery')
    }

    const [[sourceTypeColumn]] = await connection.query(
      `SELECT COUNT(*) AS count
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ?
         AND TABLE_NAME = 'lottery_draw_record'
         AND COLUMN_NAME = 'source_type'`,
      [databaseName],
    )
    if (!Number(sourceTypeColumn.count)) {
      await connection.query("ALTER TABLE lottery_draw_record ADD COLUMN source_type ENUM('independent', 'shop') NOT NULL DEFAULT 'independent' AFTER tenant_id")
    }

    const [[shopItemColumn]] = await connection.query(
      `SELECT COUNT(*) AS count
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ?
         AND TABLE_NAME = 'lottery_draw_record'
         AND COLUMN_NAME = 'shop_item_id'`,
      [databaseName],
    )
    if (!Number(shopItemColumn.count)) {
      await connection.query('ALTER TABLE lottery_draw_record ADD COLUMN shop_item_id BIGINT NULL AFTER lottery_prize_id')
    }

    const [[lotteryPrizeColumn]] = await connection.query(
      `SELECT IS_NULLABLE AS isNullable
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ?
         AND TABLE_NAME = 'lottery_draw_record'
         AND COLUMN_NAME = 'lottery_prize_id'`,
      [databaseName],
    )
    if (lotteryPrizeColumn?.isNullable !== 'YES') {
      await connection.query('ALTER TABLE lottery_draw_record MODIFY COLUMN lottery_prize_id BIGINT NULL')
    }

    const [[shopItemIndex]] = await connection.query(
      `SELECT COUNT(*) AS count
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = ?
         AND TABLE_NAME = 'lottery_draw_record'
         AND INDEX_NAME = 'idx_lottery_draw_shop_item'`,
      [databaseName],
    )
    if (!Number(shopItemIndex.count)) {
      await connection.query('ALTER TABLE lottery_draw_record ADD INDEX idx_lottery_draw_shop_item (shop_item_id)')
    }

    const [[shopItemForeignKey]] = await connection.query(
      `SELECT COUNT(*) AS count
       FROM information_schema.TABLE_CONSTRAINTS
       WHERE CONSTRAINT_SCHEMA = ?
         AND TABLE_NAME = 'lottery_draw_record'
         AND CONSTRAINT_NAME = 'fk_lottery_draw_shop_item'`,
      [databaseName],
    )
    if (!Number(shopItemForeignKey.count)) {
      await connection.query(
        'ALTER TABLE lottery_draw_record ADD CONSTRAINT fk_lottery_draw_shop_item FOREIGN KEY (shop_item_id) REFERENCES shop_item(id)',
      )
    }
  })

  await applyMigration('20260602_student_active_name', async () => {
    const [[activeNameColumn]] = await connection.query(
      `SELECT COUNT(*) AS count
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ?
         AND TABLE_NAME = 'student'
         AND COLUMN_NAME = 'active_name'`,
      [databaseName],
    )
    if (!Number(activeNameColumn.count)) {
      await connection.query(
        'ALTER TABLE student ADD COLUMN active_name VARCHAR(100) GENERATED ALWAYS AS (CASE WHEN deleted = 0 THEN name ELSE NULL END) STORED AFTER deleted',
      )
    }

    const [[activeNameIndex]] = await connection.query(
      `SELECT COUNT(*) AS count
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = ?
         AND TABLE_NAME = 'student'
         AND INDEX_NAME = 'uk_student_active_name'`,
      [databaseName],
    )
    if (!Number(activeNameIndex.count)) {
      const [[duplicate]] = await connection.query(
        `SELECT tenant_id, class_id, name, COUNT(*) AS count
         FROM student
         WHERE deleted = 0
         GROUP BY tenant_id, class_id, name
         HAVING COUNT(*) > 1
         LIMIT 1`,
      )
      if (duplicate) {
        throw new Error(`Cannot add uk_student_active_name: duplicate active student name ${duplicate.name}.`)
      }
      await connection.query(
        'ALTER TABLE student ADD UNIQUE KEY uk_student_active_name (tenant_id, class_id, active_name)',
      )
    }
  })

  await applyMigration('20260602_student_group_active_name', async () => {
    const [[activeNameColumn]] = await connection.query(
      `SELECT COUNT(*) AS count
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ?
         AND TABLE_NAME = 'student_group'
         AND COLUMN_NAME = 'active_name'`,
      [databaseName],
    )
    if (!Number(activeNameColumn.count)) {
      await connection.query(
        'ALTER TABLE student_group ADD COLUMN active_name VARCHAR(100) GENERATED ALWAYS AS (CASE WHEN deleted = 0 THEN name ELSE NULL END) STORED AFTER deleted',
      )
    }

    const [[activeNameIndex]] = await connection.query(
      `SELECT COUNT(*) AS count
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = ?
         AND TABLE_NAME = 'student_group'
         AND INDEX_NAME = 'uk_student_group_active_name'`,
      [databaseName],
    )
    if (!Number(activeNameIndex.count)) {
      const [[duplicate]] = await connection.query(
        `SELECT tenant_id, class_id, name, COUNT(*) AS count
         FROM student_group
         WHERE deleted = 0
         GROUP BY tenant_id, class_id, name
         HAVING COUNT(*) > 1
         LIMIT 1`,
      )
      if (duplicate) {
        throw new Error(`Cannot add uk_student_group_active_name: duplicate active group name ${duplicate.name}.`)
      }
      await connection.query(
        'ALTER TABLE student_group ADD UNIQUE KEY uk_student_group_active_name (tenant_id, class_id, active_name)',
      )
    }
  })

  await applyMigration('20260602_exchange_record_operator', async () => {
    for (const [columnName, definition] of [
      ['operator_user_id', 'BIGINT NULL AFTER badge_cost'],
      ['operator_name', 'VARCHAR(100) NULL AFTER operator_user_id'],
    ]) {
      const [[column]] = await connection.query(
        `SELECT COUNT(*) AS count
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ?
           AND TABLE_NAME = 'exchange_record'
           AND COLUMN_NAME = ?`,
        [databaseName, columnName],
      )
      if (!Number(column.count)) {
        await connection.query(`ALTER TABLE exchange_record ADD COLUMN ${columnName} ${definition}`)
      }
    }

    const [[operatorIndex]] = await connection.query(
      `SELECT COUNT(*) AS count
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = ?
         AND TABLE_NAME = 'exchange_record'
         AND INDEX_NAME = 'idx_exchange_record_operator'`,
      [databaseName],
    )
    if (!Number(operatorIndex.count)) {
      await connection.query('ALTER TABLE exchange_record ADD INDEX idx_exchange_record_operator (tenant_id, operator_user_id)')
    }

    const [[operatorForeignKey]] = await connection.query(
      `SELECT COUNT(*) AS count
       FROM information_schema.TABLE_CONSTRAINTS
       WHERE CONSTRAINT_SCHEMA = ?
         AND TABLE_NAME = 'exchange_record'
         AND CONSTRAINT_NAME = 'fk_exchange_record_operator'`,
      [databaseName],
    )
    if (!Number(operatorForeignKey.count)) {
      await connection.query(
        'ALTER TABLE exchange_record ADD CONSTRAINT fk_exchange_record_operator FOREIGN KEY (operator_user_id) REFERENCES app_user(id)',
      )
    }
  })

  await applyMigration('20260602_custom_badges', async () => {
    await connection.query(
      `CREATE TABLE IF NOT EXISTS custom_badge (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        tenant_id BIGINT NOT NULL,
        class_id BIGINT NOT NULL,
        name VARCHAR(100) NOT NULL,
        icon VARCHAR(32) NOT NULL DEFAULT '🏅',
        description VARCHAR(255) NOT NULL DEFAULT '',
        enabled TINYINT(1) NOT NULL DEFAULT 1,
        deleted TINYINT(1) NOT NULL DEFAULT 0,
        active_name VARCHAR(100) GENERATED ALWAYS AS (CASE WHEN deleted = 0 THEN name ELSE NULL END) STORED,
        created_by_user_id BIGINT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_custom_badge_active_name (tenant_id, class_id, active_name),
        INDEX idx_custom_badge_class (tenant_id, class_id, deleted, enabled),
        CONSTRAINT fk_custom_badge_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(id),
        CONSTRAINT fk_custom_badge_class FOREIGN KEY (class_id) REFERENCES class_room(id),
        CONSTRAINT fk_custom_badge_creator FOREIGN KEY (created_by_user_id) REFERENCES app_user(id)
      ) ENGINE=InnoDB`,
    )

    for (const [columnName, definition] of [
      ['custom_badge_id', 'BIGINT NULL AFTER settlement_id'],
      ['custom_badge_name', 'VARCHAR(100) NULL AFTER custom_badge_id'],
      ['badge_icon', 'VARCHAR(32) NULL AFTER custom_badge_name'],
      ['student_name', 'VARCHAR(100) NULL AFTER badge_icon'],
      ['operator_user_id', 'BIGINT NULL AFTER student_name'],
      ['operator_name', 'VARCHAR(100) NULL AFTER operator_user_id'],
    ]) {
      const [[column]] = await connection.query(
        `SELECT COUNT(*) AS count
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ?
           AND TABLE_NAME = 'badge_record'
           AND COLUMN_NAME = ?`,
        [databaseName, columnName],
      )
      if (!Number(column.count)) {
        await connection.query(`ALTER TABLE badge_record ADD COLUMN ${columnName} ${definition}`)
      }
    }

    for (const [indexName, definition] of [
      ['idx_badge_record_custom_badge', '(tenant_id, custom_badge_id, created_at)'],
      ['idx_badge_record_operator', '(tenant_id, operator_user_id)'],
    ]) {
      const [[index]] = await connection.query(
        `SELECT COUNT(*) AS count
         FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = ?
           AND TABLE_NAME = 'badge_record'
           AND INDEX_NAME = ?`,
        [databaseName, indexName],
      )
      if (!Number(index.count)) {
        await connection.query(`ALTER TABLE badge_record ADD INDEX ${indexName} ${definition}`)
      }
    }

    for (const [constraintName, definition] of [
      ['fk_badge_record_custom_badge', 'FOREIGN KEY (custom_badge_id) REFERENCES custom_badge(id)'],
      ['fk_badge_record_operator', 'FOREIGN KEY (operator_user_id) REFERENCES app_user(id)'],
    ]) {
      const [[constraint]] = await connection.query(
        `SELECT COUNT(*) AS count
         FROM information_schema.TABLE_CONSTRAINTS
         WHERE CONSTRAINT_SCHEMA = ?
           AND TABLE_NAME = 'badge_record'
           AND CONSTRAINT_NAME = ?`,
        [databaseName, constraintName],
      )
      if (!Number(constraint.count)) {
        await connection.query(`ALTER TABLE badge_record ADD CONSTRAINT ${constraintName} ${definition}`)
      }
    }
  })

  await applyMigration('20260602_leaderboard_group_student_count', async () => {
    const [[studentCountColumn]] = await connection.query(
      `SELECT COUNT(*) AS count
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ?
         AND TABLE_NAME = 'leaderboard_snapshot_entry'
         AND COLUMN_NAME = 'student_count'`,
      [databaseName],
    )
    if (!Number(studentCountColumn.count)) {
      await connection.query(
        'ALTER TABLE leaderboard_snapshot_entry ADD COLUMN student_count INT NULL AFTER score',
      )
    }
  })

  await applyMigration('20260602_notifications', async () => {
    await connection.query(
      `CREATE TABLE IF NOT EXISTS notification (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        tenant_id BIGINT NOT NULL,
        recipient_user_id BIGINT NOT NULL,
        class_id BIGINT NULL,
        student_id BIGINT NULL,
        notification_type ENUM('pet_level_up', 'pet_max_level', 'badge_awarded', 'stock_warning', 'collaboration', 'system') NOT NULL,
        title VARCHAR(100) NOT NULL,
        message VARCHAR(255) NOT NULL,
        target_path VARCHAR(255) NOT NULL DEFAULT '/dashboard',
        dedupe_key VARCHAR(191) NULL,
        read_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_notification_dedupe (tenant_id, recipient_user_id, dedupe_key),
        INDEX idx_notification_recipient_time (tenant_id, recipient_user_id, read_at, created_at),
        CONSTRAINT fk_notification_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(id),
        CONSTRAINT fk_notification_recipient FOREIGN KEY (recipient_user_id) REFERENCES app_user(id),
        CONSTRAINT fk_notification_class FOREIGN KEY (class_id) REFERENCES class_room(id),
        CONSTRAINT fk_notification_student FOREIGN KEY (student_id) REFERENCES student(id)
      ) ENGINE=InnoDB`,
    )
  })

  await applyMigration('20260602_cosmetic_inventory', async () => {
    for (const [columnName, columnDefinition] of [
      ['cosmetic_type', "ENUM('toy', 'head', 'back', 'neck', 'face') NULL"],
      ['cosmetic_id', 'VARCHAR(64) NULL'],
    ]) {
      const [[column]] = await connection.query(
        `SELECT COUNT(*) AS count
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ?
           AND TABLE_NAME = 'shop_item'
           AND COLUMN_NAME = ?`,
        [databaseName, columnName],
      )
      if (!Number(column.count)) {
        await connection.query(`ALTER TABLE shop_item ADD COLUMN ${columnName} ${columnDefinition} AFTER lottery_probability`)
      }
    }

    await connection.query(
      `CREATE TABLE IF NOT EXISTS student_cosmetic_inventory (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        tenant_id BIGINT NOT NULL,
        student_id BIGINT NOT NULL,
        cosmetic_type ENUM('toy', 'head', 'back', 'neck', 'face') NOT NULL,
        cosmetic_id VARCHAR(64) NOT NULL,
        source_shop_item_id BIGINT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_student_cosmetic_inventory (tenant_id, student_id, cosmetic_id),
        INDEX idx_student_cosmetic_inventory_student (tenant_id, student_id),
        CONSTRAINT fk_student_cosmetic_inventory_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(id),
        CONSTRAINT fk_student_cosmetic_inventory_student FOREIGN KEY (student_id) REFERENCES student(id),
        CONSTRAINT fk_student_cosmetic_inventory_shop_item FOREIGN KEY (source_shop_item_id) REFERENCES shop_item(id)
      ) ENGINE=InnoDB`,
    )
  })

  await applyMigration('20260602_shop_uncategorized', async () => {
    const [[systemColumn]] = await connection.query(
      `SELECT COUNT(*) AS count
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ?
         AND TABLE_NAME = 'shop_category'
         AND COLUMN_NAME = 'is_system'`,
      [databaseName],
    )
    if (!Number(systemColumn.count)) {
      await connection.query('ALTER TABLE shop_category ADD COLUMN is_system TINYINT(1) NOT NULL DEFAULT 0 AFTER sort_order')
    }
    await connection.query(
      `INSERT INTO shop_category (tenant_id, name, sort_order, is_system, deleted)
       SELECT id, '未分类', 0, 1, 0 FROM tenant
       ON DUPLICATE KEY UPDATE sort_order = 0, is_system = 1, deleted = 0`,
    )
  })

  await applyMigration('20260603_class_teacher_permissions', async () => {
    for (const [columnName, definition] of [
      ['can_score', 'TINYINT(1) NOT NULL DEFAULT 1 AFTER added_by_user_id'],
      ['can_manage_students', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER can_score'],
      ['can_manage_config', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER can_manage_students'],
    ]) {
      const [[column]] = await connection.query(
        `SELECT COUNT(*) AS count
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ?
           AND TABLE_NAME = 'class_teacher'
           AND COLUMN_NAME = ?`,
        [databaseName, columnName],
      )
      if (!Number(column.count)) {
        await connection.query(`ALTER TABLE class_teacher ADD COLUMN ${columnName} ${definition}`)
      }
    }
    await connection.query(
      `UPDATE class_teacher
       SET can_score = 1, can_manage_students = 1, can_manage_config = 1
       WHERE can_score = 1 AND can_manage_students = 0 AND can_manage_config = 0`,
    )
  })

  await applyMigration('20260603_ai_analysis', async () => {
    await connection.query(
      `CREATE TABLE IF NOT EXISTS ai_prompt_template (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        tenant_id BIGINT NOT NULL,
        name VARCHAR(100) NOT NULL,
        prompt_text TEXT NOT NULL,
        is_default TINYINT(1) NOT NULL DEFAULT 1,
        updated_by_user_id BIGINT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_ai_prompt_default (tenant_id, is_default),
        CONSTRAINT fk_ai_prompt_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(id),
        CONSTRAINT fk_ai_prompt_updater FOREIGN KEY (updated_by_user_id) REFERENCES app_user(id)
      ) ENGINE=InnoDB`,
    )
    await connection.query(
      `CREATE TABLE IF NOT EXISTS ai_report_job (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        tenant_id BIGINT NOT NULL,
        class_id BIGINT NOT NULL,
        scope ENUM('single', 'batch') NOT NULL,
        status ENUM('pending', 'running', 'completed', 'failed', 'cancelled', 'timed_out') NOT NULL DEFAULT 'pending',
        total_count INT NOT NULL DEFAULT 0,
        completed_count INT NOT NULL DEFAULT 0,
        failed_count INT NOT NULL DEFAULT 0,
        target_student_ids JSON NOT NULL,
        prompt_template_id BIGINT NULL,
        prompt_snapshot TEXT NOT NULL,
        error_message VARCHAR(255) NULL,
        retry_count INT NOT NULL DEFAULT 0,
        created_by_user_id BIGINT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        started_at DATETIME NULL,
        completed_at DATETIME NULL,
        cancelled_at DATETIME NULL,
        INDEX idx_ai_report_job_class_time (tenant_id, class_id, created_at),
        INDEX idx_ai_report_job_status (tenant_id, status, created_at),
        CONSTRAINT fk_ai_report_job_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(id),
        CONSTRAINT fk_ai_report_job_class FOREIGN KEY (class_id) REFERENCES class_room(id),
        CONSTRAINT fk_ai_report_job_prompt FOREIGN KEY (prompt_template_id) REFERENCES ai_prompt_template(id),
        CONSTRAINT fk_ai_report_job_creator FOREIGN KEY (created_by_user_id) REFERENCES app_user(id)
      ) ENGINE=InnoDB`,
    )
    await connection.query(
      `CREATE TABLE IF NOT EXISTS ai_student_report (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        tenant_id BIGINT NOT NULL,
        class_id BIGINT NOT NULL,
        student_id BIGINT NOT NULL,
        job_id BIGINT NOT NULL,
        prompt_template_id BIGINT NULL,
        prompt_snapshot TEXT NOT NULL,
        student_name VARCHAR(100) NOT NULL,
        score_snapshot INT NOT NULL DEFAULT 0,
        badge_snapshot INT NOT NULL DEFAULT 0,
        risk_level ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'low',
        strengths_json JSON NOT NULL,
        suggestions_json JSON NOT NULL,
        metrics_json JSON NOT NULL,
        report_text TEXT NOT NULL,
        deleted TINYINT(1) NOT NULL DEFAULT 0,
        created_by_user_id BIGINT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_ai_student_report_class_time (tenant_id, class_id, deleted, created_at),
        INDEX idx_ai_student_report_student_time (tenant_id, student_id, deleted, created_at),
        CONSTRAINT fk_ai_student_report_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(id),
        CONSTRAINT fk_ai_student_report_class FOREIGN KEY (class_id) REFERENCES class_room(id),
        CONSTRAINT fk_ai_student_report_student FOREIGN KEY (student_id) REFERENCES student(id),
        CONSTRAINT fk_ai_student_report_job FOREIGN KEY (job_id) REFERENCES ai_report_job(id),
        CONSTRAINT fk_ai_student_report_prompt FOREIGN KEY (prompt_template_id) REFERENCES ai_prompt_template(id),
        CONSTRAINT fk_ai_student_report_creator FOREIGN KEY (created_by_user_id) REFERENCES app_user(id)
      ) ENGINE=InnoDB`,
    )
  })
}

try {
  await connection.query(schema)
  await connection.query(`USE \`${databaseName}\``)
  await runMigrations()
  if (!process.argv.includes('--migrate-only')) {
    await seedDemoData(connection)
  }
  console.log(`Database ${databaseName} ${process.argv.includes('--migrate-only') ? 'migrated' : 'initialized'}.`)
} finally {
  await connection.end()
}
