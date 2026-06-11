import 'dotenv/config'
import mysql from 'mysql2/promise'
import { setTimeout as delay } from 'node:timers/promises'

export const databaseName = process.env.MYSQL_DATABASE || 'class_pet_management'
if (!/^[a-zA-Z0-9_]+$/.test(databaseName)) {
  throw new Error('MYSQL_DATABASE 只能包含字母、数字和下划线')
}

export const connectionOptions = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  charset: 'utf8mb4',
}

export const pool = mysql.createPool({
  ...connectionOptions,
  database: databaseName,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
})

const retryableTransactionErrors = new Set(['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'])

export async function withTransaction(handler, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()
      const result = await handler(connection)
      await connection.commit()
      return result
    } catch (error) {
      await connection.rollback()
      if (!retryableTransactionErrors.has(error.code) || attempt === maxAttempts) throw error
    } finally {
      connection.release()
    }
    await delay(attempt * 25)
  }
  throw new Error('Transaction retry attempts exhausted')
}
