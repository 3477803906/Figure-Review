# Figure Review Workbench

科研图表审校工作台的开发切片。当前包含：

- React + Vite 网页工作台
- FastAPI 审校接口
- 图片尺寸与文件事实检查（PNG、JPEG、TIFF、SVG；PDF 页面基础识别）
- OpenAI-compatible 视觉模型适配器
- 可扩展的 Agent Skill 目录

## 启动前端

```powershell
npm.cmd install
npm.cmd run dev
```

打开 `http://localhost:5173`。

## 启动后端

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
uvicorn backend.app.main:app --reload --port 8000
```

前端会把图表和配置提交到 `POST /api/review`。没有启动后端时，页面会明确提示连接失败，不把演示数据当成真实审校结果。

### 硅基流动视觉模型

网页的模型设置已预填：

```text
模型 Base URL: https://api.siliconflow.cn/v1
模型名称: Qwen/Qwen3.5-27B
```

打开页面右上角“模型设置”，只在浏览器会话中填写 API Key，然后上传图表并点击“开始审校”。硅基流动的视觉接口使用 OpenAI-compatible 的 `/chat/completions`，后端会以 base64 图片和 JSON 输出约束发送请求。请勿把 API Key 写入代码、提交到 Git 或发到聊天中。

## 说明

审校标准、范围、技能契约和验收条件见 `docs/PRODUCT_SPEC.md`。首版不把模型未执行、信息不足或工具失败显示为通过。
