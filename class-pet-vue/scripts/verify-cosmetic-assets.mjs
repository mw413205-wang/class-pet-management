import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const cosmeticDataPath = path.join(projectRoot, 'src', 'data', 'cosmeticData.ts')
const publicRoot = path.join(projectRoot, 'public')
const cosmeticData = fs.readFileSync(cosmeticDataPath, 'utf8')
const itemBlocks = [...cosmeticData.matchAll(/\{\s*id:\s*'([^']+)'[\s\S]*?\}/g)]
const allowedTypes = new Set(['toy', 'head', 'back', 'neck', 'face'])
const ids = []
const failures = []
let configuredAssetCount = 0

for (const block of itemBlocks) {
  const source = block[0]
  const id = block[1]
  ids.push(id)

  const type = source.match(/type:\s*'([^']+)'/)?.[1]
  if (!allowedTypes.has(type)) failures.push(`${id} 装扮类型非法：${type || '缺失'}`)

  const icon = source.match(/icon:\s*'([^']+)'/)?.[1]
  if (!icon) failures.push(`${id} 缺少 emoji 兜底 icon`)

  const assetPath = source.match(/assetPath:\s*'([^']+)'/)?.[1]
  if (!assetPath) continue
  configuredAssetCount += 1

  if (!/\.(png|webp)$/i.test(assetPath)) {
    failures.push(`${id} assetPath 只支持 PNG 或 WebP：${assetPath}`)
    continue
  }

  const normalizedPath = assetPath.startsWith('/') ? assetPath.slice(1) : `cosmetics/${assetPath}`
  const filePath = path.join(publicRoot, normalizedPath)
  if (!fs.existsSync(filePath)) {
    failures.push(`${id} 素材文件缺失：${assetPath}`)
    continue
  }

  const file = fs.readFileSync(filePath)
  const isPng = file.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  const isWebp = file.subarray(0, 4).toString('ascii') === 'RIFF' && file.subarray(8, 12).toString('ascii') === 'WEBP'
  if (!isPng && !isWebp) failures.push(`${id} 不是有效 PNG/WebP：${assetPath}`)
}

for (const id of new Set(ids.filter((id, index) => ids.indexOf(id) !== index))) {
  failures.push(`${id} 装扮 ID 重复`)
}

if (failures.length) {
  throw new Error(`装扮素材验收失败：\n${failures.join('\n')}`)
}

console.log(`PASS ${itemBlocks.length} 个装扮配置合法，${configuredAssetCount} 个真实图片素材已校验`)
