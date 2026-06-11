装扮真实图片素材目录。

推荐路径：
- /cosmetics/head/*.png
- /cosmetics/back/*.png
- /cosmetics/neck/*.png
- /cosmetics/face/*.png
- /cosmetics/toy/*.png

要求：
- 支持 PNG 或 WebP。
- 图片应为透明背景。
- 在 src/data/cosmeticData.ts 为装扮项配置 assetPath 后，会优先使用真实图片；图片缺失时回退到 emoji。
- 运行 npm run test:cosmetics 可校验已配置素材路径。
