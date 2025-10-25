# 图像美学评分

## 简介

Flying Bird Wallpaper 使用基于 ONNX 的深度学习模型来计算图像美学评分。该系统能够自动评估图像的视觉美感，并为每张图像生成 1-100 分的评分，用于排序和筛选高质量壁纸。

## 技术架构

### 模型信息

- **模型文件**: [picture_score_fp16.onnx](../resources/models/picture_score_fp16.onnx)
- **模型来源**: 基于Hugging Face Spaces上的[picture_score](https://huggingface.co/spaces/inksnow/picture_score)项目
- **模型类型**: 深度学习神经网络
- **精度格式**: float16 (半精度浮点数)
- **输入尺寸**: 224×224×3 (RGB图像)
- **输出维度**: 3个评分维度
  - 视觉吸引力 (Visual Appeal)
  - 构图质量 (Composition Quality)
  - 图像质量 (Image Quality)

### 评分维度说明

1. **视觉吸引力 (Visual Appeal)** - 权重 25%
   - 评估图像的色彩搭配
   - 评估图像的主题吸引力
   - 评估图像的整体视觉冲击力

2. **构图质量 (Composition Quality)** - 权重 35%
   - 评估图像的构图平衡性
   - 评估图像的焦点分布
   - 评估图像的视觉引导线

3. **图像质量 (Image Quality)** - 权重 40%
   - 评估图像的清晰度
   - 评估图像的噪点水平
   - 评估图像的细节丰富程度

### 综合评分算法

综合评分采用加权平均算法：

```
综合评分 = 视觉吸引力 × 0.25 + 构图质量 × 0.35 + 图像质量 × 0.4
```

## 实现细节

### 图像预处理流程

1. **图像加载**: 使用 `sharp` 库读取图像文件
2. **尺寸调整**: 统一调整为 224×224 像素
3. **色彩空间转换**: 确保为 RGB 格式，移除 Alpha 通道
4. **数据归一化**: 像素值从 0-255 转换为 0-1 范围
5. **格式转换**: 转换为 CHW (Channel-Height-Width) 格式
6. **精度转换**: 从 float32 转换为 float16 以匹配模型输入要求

### 模型推理过程

1. **模型加载**: 使用 ONNX Runtime Node.js 版本加载模型
2. **张量构建**: 将预处理后的图像数据构建为模型输入张量
3. **推理执行**: 运行模型推理计算
4. **结果解码**: 将 float16 输出转换为 float32 格式
5. **数值校正**: 应用 0.95 倍的缩放校正因子
6. **评分映射**: 将 0-1 范围的输出映射到 1-100 分制

### 评分后处理

为确保评分的合理性和可用性，系统对原始模型输出进行以下处理：

1. **数值裁剪**: 确保所有评分在 0-1 范围内
2. **范围映射**: 将 0-1 映射到 1-100 分制
3. **权重计算**: 按照预设权重计算综合评分
4. **精度调整**: 四舍五入到整数

## 使用示例

### 基本用法

```javascript
import ImageScorer from './src/main/utils/ImageScorer.mjs'

// 获取评分器实例
const scorer = ImageScorer.getInstance()

// 计算图像评分
const score = await scorer.predict('/path/to/image.jpg')
console.log(`图像评分为: ${score}`)
```

### 批量处理

```javascript
import { calculateImageScore } from './src/main/utils/utils.mjs'

// 批量计算多张图像的评分
const imagePaths = ['/path/to/image1.jpg', '/path/to/image2.png', '/path/to/image3.webp']

const scores = await Promise.all(
  imagePaths.map(async (path) => {
    const score = await calculateImageScore(path)
    return { path, score }
  })
)

console.log('批量评分结果:', scores)
```

## 性能优化

### 模型加载优化

- 使用单例模式确保模型只加载一次
- 启用 ONNX Runtime 的图优化选项
- 使用 CPU 执行提供者以确保兼容性

### 图像处理优化

- 使用 `sharp` 库进行高效的图像处理
- 实现流水线式图像预处理
- 内存友好的数据转换过程

### 评分缓存

为提高性能，系统对图像评分结果进行数据库缓存：

```sql
-- 评分数据存储在资源表的 score 字段中
ALTER TABLE fbw_resources ADD COLUMN score INTEGER NOT NULL DEFAULT 0;
```

## 注意事项

1. **模型依赖**: 确保 `picture_score_fp16.onnx` 文件存在于资源目录中
2. **性能考量**: 首次评分需要加载模型，可能耗时较长
3. **内存使用**: 模型加载后会占用一定内存，但支持重复使用
4. **图像格式**: 支持常见图像格式 (JPEG, PNG, WebP等)
5. **错误处理**: 评分失败时返回 0 分，不影响主流程

## 评分标准参考

- **90-100分**: 极高质量图像，各方面表现优秀
- **80-89分**: 高质量图像，有少量改进空间
- **70-79分**: 中等质量图像，构图或技术方面一般
- **60-69分**: 较低质量图像，有多方面不足
- **0-59分**: 低质量图像，不推荐使用

## 扩展性

系统设计支持模型替换和扩展：

1. 可以通过构造函数参数指定不同的模型路径
2. 可以调整评分权重以适应不同应用场景
3. 可以修改后处理算法以满足特定需求
4. 支持未来升级到更先进的模型版本
