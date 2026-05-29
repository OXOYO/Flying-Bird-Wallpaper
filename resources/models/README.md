# 模型文件

| 文件                               | 用途                             |
| ---------------------------------- | -------------------------------- |
| `picture_score_fp16.onnx`          | 美学评分（可选）                 |
| `mobileclip2_s0_vision.onnx`       | 找相似 · 视觉向量 MobileCLIP2-S0 |
| `mobileclip2_s0_preprocessor.json` | 预处理配置（参考）               |

若缺少视觉模型，在项目根目录执行：

```bash
node scripts/download-mobileclip2-s0.mjs
```

来源：[plhery/mobileclip2-onnx](https://huggingface.co/plhery/mobileclip2-onnx)（基于 Apple MobileCLIP2-S0）
