CREATE DATABASE IF NOT EXISTS class_pet_management
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE class_pet_management;

CREATE TABLE IF NOT EXISTS schema_migration (
  migration_id VARCHAR(100) PRIMARY KEY,
  applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tenant (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS app_user (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  username VARCHAR(50) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  role ENUM('owner', 'teacher') NOT NULL DEFAULT 'teacher',
  status ENUM('active', 'disabled') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_app_user_username (username),
  INDEX idx_app_user_tenant (tenant_id, status),
  CONSTRAINT fk_app_user_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS refresh_token (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  token_hash CHAR(64) NOT NULL,
  ttl_days INT NOT NULL DEFAULT 1,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  last_used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_refresh_token_hash (token_hash),
  INDEX idx_refresh_token_user (tenant_id, user_id, expires_at),
  CONSTRAINT fk_refresh_token_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(id),
  CONSTRAINT fk_refresh_token_user FOREIGN KEY (user_id) REFERENCES app_user(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS auth_login_guard (
  client_ip VARCHAR(64) PRIMARY KEY,
  failure_count INT NOT NULL DEFAULT 0,
  first_failed_at DATETIME NULL,
  locked_until DATETIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_auth_login_guard_lock (locked_until)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS auth_reset_guard (
  client_ip VARCHAR(64) PRIMARY KEY,
  failure_count INT NOT NULL DEFAULT 0,
  first_failed_at DATETIME NULL,
  locked_until DATETIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_auth_reset_guard_lock (locked_until)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS activation_code (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  code VARCHAR(64) NOT NULL,
  status ENUM('active', 'used', 'disabled') NOT NULL DEFAULT 'active',
  expires_at DATETIME NULL,
  used_by_user_id BIGINT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_activation_code_code (code),
  INDEX idx_activation_code_tenant (tenant_id, status),
  CONSTRAINT fk_activation_code_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS class_room (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  name VARCHAR(100) NOT NULL,
  gradient_from VARCHAR(20) NOT NULL DEFAULT '#4ecdc4',
  gradient_to VARCHAR(20) NOT NULL DEFAULT '#95e1d3',
  deleted TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_class_room_tenant (tenant_id, deleted),
  CONSTRAINT fk_class_room_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS class_teacher (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  class_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  added_by_user_id BIGINT NULL,
  can_score TINYINT(1) NOT NULL DEFAULT 1,
  can_manage_students TINYINT(1) NOT NULL DEFAULT 0,
  can_manage_config TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_class_teacher (tenant_id, class_id, user_id),
  INDEX idx_class_teacher_user (tenant_id, user_id, class_id),
  CONSTRAINT fk_class_teacher_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(id),
  CONSTRAINT fk_class_teacher_class FOREIGN KEY (class_id) REFERENCES class_room(id),
  CONSTRAINT fk_class_teacher_user FOREIGN KEY (user_id) REFERENCES app_user(id),
  CONSTRAINT fk_class_teacher_added_by FOREIGN KEY (added_by_user_id) REFERENCES app_user(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS student_group (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id BIGINT NOT NULL,
  class_id BIGINT NOT NULL,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(20) NOT NULL,
  bg_class VARCHAR(100) NOT NULL DEFAULT '',
  text_class VARCHAR(100) NOT NULL DEFAULT '',
  border_color VARCHAR(20) NOT NULL,
  is_ungrouped TINYINT(1) NOT NULL DEFAULT 0,
  deleted TINYINT(1) NOT NULL DEFAULT 0,
  active_name VARCHAR(100) GENERATED ALWAYS AS (CASE WHEN deleted = 0 THEN name ELSE NULL END) STORED,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_student_group_active_name (tenant_id, class_id, active_name),
  INDEX idx_student_group_class (tenant_id, class_id, deleted),
  CONSTRAINT fk_student_group_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(id),
  CONSTRAINT fk_student_group_class FOREIGN KEY (class_id) REFERENCES class_room(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS student (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  class_id BIGINT NOT NULL,
  group_id VARCHAR(64) NOT NULL,
  name VARCHAR(100) NOT NULL,
  pet_id VARCHAR(64) NULL,
  pet_nickname VARCHAR(100) NOT NULL DEFAULT '',
  score INT NOT NULL DEFAULT 0,
  badge_balance INT NOT NULL DEFAULT 0,
  toy_id VARCHAR(64) NULL,
  head_id VARCHAR(64) NULL,
  back_id VARCHAR(64) NULL,
  neck_id VARCHAR(64) NULL,
  face_id VARCHAR(64) NULL,
  deleted TINYINT(1) NOT NULL DEFAULT 0,
  active_name VARCHAR(100) GENERATED ALWAYS AS (CASE WHEN deleted = 0 THEN name ELSE NULL END) STORED,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_student_active_name (tenant_id, class_id, active_name),
  INDEX idx_student_class (tenant_id, class_id, deleted),
  INDEX idx_student_group (tenant_id, group_id, deleted),
  CONSTRAINT fk_student_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(id),
  CONSTRAINT fk_student_class FOREIGN KEY (class_id) REFERENCES class_room(id),
  CONSTRAINT fk_student_group FOREIGN KEY (group_id) REFERENCES student_group(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS score_rule (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  class_id BIGINT NOT NULL,
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(32) NOT NULL,
  score_value INT NOT NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  is_quick TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  deleted TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_score_rule_class (tenant_id, class_id, deleted, sort_order),
  CONSTRAINT fk_score_rule_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(id),
  CONSTRAINT fk_score_rule_class FOREIGN KEY (class_id) REFERENCES class_room(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS score_action (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  class_id BIGINT NOT NULL,
  student_id BIGINT NOT NULL,
  rule_id BIGINT NULL,
  rule_name VARCHAR(100) NOT NULL,
  student_name VARCHAR(100) NOT NULL,
  delta_score INT NOT NULL,
  score_before INT NOT NULL,
  score_after INT NOT NULL,
  reverted TINYINT(1) NOT NULL DEFAULT 0,
  reverted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_score_action_class_time (tenant_id, class_id, created_at),
  INDEX idx_score_action_student_time (tenant_id, student_id, created_at),
  CONSTRAINT fk_score_action_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(id),
  CONSTRAINT fk_score_action_class FOREIGN KEY (class_id) REFERENCES class_room(id),
  CONSTRAINT fk_score_action_student FOREIGN KEY (student_id) REFERENCES student(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS leaderboard_settlement (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  class_id BIGINT NOT NULL,
  period ENUM('week', 'month', 'semester') NOT NULL,
  period_key VARCHAR(64) NOT NULL,
  period_start DATE NULL,
  period_end DATE NULL,
  awarded_count INT NOT NULL DEFAULT 0,
  created_by_user_id BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_leaderboard_settlement_period (tenant_id, class_id, period, period_key),
  INDEX idx_leaderboard_settlement_class_time (tenant_id, class_id, created_at),
  CONSTRAINT fk_leaderboard_settlement_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(id),
  CONSTRAINT fk_leaderboard_settlement_class FOREIGN KEY (class_id) REFERENCES class_room(id),
  CONSTRAINT fk_leaderboard_settlement_creator FOREIGN KEY (created_by_user_id) REFERENCES app_user(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS custom_badge (
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
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS badge_record (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  class_id BIGINT NOT NULL,
  student_id BIGINT NOT NULL,
  badge_type ENUM('milestone', 'exchange', 'manual', 'weekly', 'monthly', 'semester') NOT NULL,
  amount INT NOT NULL,
  description VARCHAR(255) NOT NULL,
  milestone INT NULL,
  settlement_id BIGINT NULL,
  custom_badge_id BIGINT NULL,
  custom_badge_name VARCHAR(100) NULL,
  badge_icon VARCHAR(32) NULL,
  student_name VARCHAR(100) NULL,
  operator_user_id BIGINT NULL,
  operator_name VARCHAR(100) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_badge_milestone (tenant_id, student_id, badge_type, milestone),
  UNIQUE KEY uk_badge_settlement_student (settlement_id, student_id),
  INDEX idx_badge_record_class_time (tenant_id, class_id, created_at),
  INDEX idx_badge_record_custom_badge (tenant_id, custom_badge_id, created_at),
  INDEX idx_badge_record_operator (tenant_id, operator_user_id),
  CONSTRAINT fk_badge_record_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(id),
  CONSTRAINT fk_badge_record_class FOREIGN KEY (class_id) REFERENCES class_room(id),
  CONSTRAINT fk_badge_record_student FOREIGN KEY (student_id) REFERENCES student(id),
  CONSTRAINT fk_badge_record_settlement FOREIGN KEY (settlement_id) REFERENCES leaderboard_settlement(id),
  CONSTRAINT fk_badge_record_custom_badge FOREIGN KEY (custom_badge_id) REFERENCES custom_badge(id),
  CONSTRAINT fk_badge_record_operator FOREIGN KEY (operator_user_id) REFERENCES app_user(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS leaderboard_snapshot_entry (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  settlement_id BIGINT NOT NULL,
  class_id BIGINT NOT NULL,
  scope ENUM('student', 'group') NOT NULL,
  subject_id VARCHAR(64) NOT NULL,
  subject_name VARCHAR(100) NOT NULL,
  student_id BIGINT NULL,
  score INT NOT NULL,
  student_count INT NULL,
  rank_no INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_leaderboard_snapshot_subject (settlement_id, scope, subject_id),
  INDEX idx_leaderboard_snapshot_rank (tenant_id, settlement_id, scope, rank_no),
  CONSTRAINT fk_leaderboard_snapshot_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(id),
  CONSTRAINT fk_leaderboard_snapshot_settlement FOREIGN KEY (settlement_id) REFERENCES leaderboard_settlement(id),
  CONSTRAINT fk_leaderboard_snapshot_class FOREIGN KEY (class_id) REFERENCES class_room(id),
  CONSTRAINT fk_leaderboard_snapshot_student FOREIGN KEY (student_id) REFERENCES student(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS app_setting (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  setting_key VARCHAR(100) NOT NULL,
  setting_value JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_app_setting (tenant_id, setting_key),
  CONSTRAINT fk_app_setting_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS shop_category (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  name VARCHAR(100) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_system TINYINT(1) NOT NULL DEFAULT 0,
  deleted TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_shop_category_name (tenant_id, name),
  CONSTRAINT fk_shop_category_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS shop_item (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  category_id BIGINT NOT NULL,
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(32) NOT NULL,
  description VARCHAR(255) NOT NULL DEFAULT '',
  price INT NOT NULL,
  stock INT NOT NULL DEFAULT -1,
  join_lottery TINYINT(1) NOT NULL DEFAULT 0,
  lottery_probability INT NOT NULL DEFAULT 10,
  cosmetic_type ENUM('toy', 'head', 'back', 'neck', 'face') NULL,
  cosmetic_id VARCHAR(64) NULL,
  deleted TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_shop_item_tenant (tenant_id, deleted),
  CONSTRAINT fk_shop_item_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(id),
  CONSTRAINT fk_shop_item_category FOREIGN KEY (category_id) REFERENCES shop_category(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS student_cosmetic_inventory (
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
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS exchange_record (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  class_id BIGINT NOT NULL,
  student_id BIGINT NOT NULL,
  shop_item_id BIGINT NOT NULL,
  student_name VARCHAR(100) NOT NULL,
  item_name VARCHAR(100) NOT NULL,
  item_icon VARCHAR(32) NOT NULL,
  category_name VARCHAR(100) NOT NULL,
  badge_cost INT NOT NULL,
  operator_user_id BIGINT NULL,
  operator_name VARCHAR(100) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_exchange_record_class_time (tenant_id, class_id, created_at),
  INDEX idx_exchange_record_operator (tenant_id, operator_user_id),
  CONSTRAINT fk_exchange_record_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(id),
  CONSTRAINT fk_exchange_record_class FOREIGN KEY (class_id) REFERENCES class_room(id),
  CONSTRAINT fk_exchange_record_student FOREIGN KEY (student_id) REFERENCES student(id),
  CONSTRAINT fk_exchange_record_item FOREIGN KEY (shop_item_id) REFERENCES shop_item(id),
  CONSTRAINT fk_exchange_record_operator FOREIGN KEY (operator_user_id) REFERENCES app_user(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS lottery_prize (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(32) NOT NULL,
  probability INT NOT NULL DEFAULT 10,
  stock INT NOT NULL DEFAULT -1,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  deleted TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_lottery_prize_tenant (tenant_id, deleted, enabled),
  CONSTRAINT fk_lottery_prize_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS lottery_draw_record (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  source_type ENUM('independent', 'shop') NOT NULL DEFAULT 'independent',
  lottery_prize_id BIGINT NULL,
  shop_item_id BIGINT NULL,
  prize_name VARCHAR(100) NOT NULL,
  prize_icon VARCHAR(32) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_lottery_draw_tenant_time (tenant_id, created_at),
  INDEX idx_lottery_draw_shop_item (shop_item_id),
  CONSTRAINT fk_lottery_draw_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(id),
  CONSTRAINT fk_lottery_draw_prize FOREIGN KEY (lottery_prize_id) REFERENCES lottery_prize(id),
  CONSTRAINT fk_lottery_draw_shop_item FOREIGN KEY (shop_item_id) REFERENCES shop_item(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS action_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  class_id BIGINT NULL,
  student_id BIGINT NULL,
  operator_user_id BIGINT NULL,
  action_type VARCHAR(50) NOT NULL,
  detail_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_action_log_tenant_time (tenant_id, created_at),
  INDEX idx_action_log_operator (tenant_id, operator_user_id),
  CONSTRAINT fk_action_log_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(id),
  CONSTRAINT fk_action_log_operator FOREIGN KEY (operator_user_id) REFERENCES app_user(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notification (
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
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ai_prompt_template (
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
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ai_report_job (
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
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ai_student_report (
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
) ENGINE=InnoDB;
