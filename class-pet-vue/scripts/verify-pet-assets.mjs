import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const petDataPath = path.join(projectRoot, 'src', 'data', 'petData.ts')
const petsRoot = path.join(projectRoot, 'public', 'pets')
const petData = fs.readFileSync(petDataPath, 'utf8')
const allPetBlocks = [...petData.matchAll(/\{\s*id:\s*'([^']+)'[\s\S]*?\n\s*\}/g)]
const petBlocks = allPetBlocks.filter(block => /hasImage:\s*true/.test(block[0]))

if (!petBlocks.length) {
  throw new Error('没有找到 hasImage=true 的宠物配置')
}

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const missing = []
const allPetIds = allPetBlocks.map(block => block[1])
const duplicatePetIds = allPetIds.filter((id, index) => allPetIds.indexOf(id) !== index)

for (const petId of new Set(duplicatePetIds)) {
  missing.push(`${petId} 宠物 ID 重复`)
}

for (const block of petBlocks) {
  const petId = block[1]
  const stages = block[0].match(/stages:\s*\[([^\]]+)\]/)
  const stageNames = stages ? [...stages[1].matchAll(/'([^']+)'/g)] : []
  if (stageNames.length !== 5) {
    missing.push(`${petId} 阶段名称不是 5 个`)
  }
  for (let stage = 0; stage < 5; stage += 1) {
    const assetPath = path.join(petsRoot, petId, `stage${stage}.png`)
    if (!fs.existsSync(assetPath)) {
      missing.push(`${petId}/stage${stage}.png 缺失`)
      continue
    }
    const file = fs.readFileSync(assetPath)
    if (file.length < pngSignature.length || !file.subarray(0, pngSignature.length).equals(pngSignature)) {
      missing.push(`${petId}/stage${stage}.png 不是有效 PNG`)
    }
  }
}

if (missing.length) {
  throw new Error(`宠物素材验收失败：\n${missing.join('\n')}`)
}

console.log(`PASS ${petBlocks.length} 种宠物的五阶段 PNG 素材完整`)
