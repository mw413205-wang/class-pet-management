import assert from 'node:assert/strict'
import { read, utils, write } from 'xlsx'

const workbook = utils.book_new()
utils.book_append_sheet(workbook, utils.aoa_to_sheet([
  ['姓名', '小组', '宠物名称'],
  ['测试学生', '红组', '橘猫'],
]), '学生名单')

const legacyWorkbook = write(workbook, { bookType: 'biff8', type: 'buffer' })
const parsedWorkbook = read(legacyWorkbook, { type: 'buffer' })
const rows = utils.sheet_to_json(parsedWorkbook.Sheets[parsedWorkbook.SheetNames[0]], {
  header: 1,
  raw: false,
  defval: '',
})

assert.deepEqual(rows, [
  ['姓名', '小组', '宠物名称'],
  ['测试学生', '红组', '橘猫'],
])
console.log('PASS 旧版 BIFF8 .xls 工作簿可以生成并解析')
