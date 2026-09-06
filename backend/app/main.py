from __future__ import annotations

import hashlib
import io
import os
import time
import uuid
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from typing import Any

import httpx
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from PIL import Image
from pydantic import BaseModel, Field

app = FastAPI(title="Figure Review API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ModelConfig(BaseModel):
    base_url: str = Field(default="https://api.openai.com/v1")
    api_key: str = Field(default="", repr=False)
    model: str = Field(default="gpt-4o-mini")


class ReviewRequest(BaseModel):
    figure_type: str = "multi_panel"
    purpose: str = "paper"
    preset: str = "general"
    caption: str = ""
    context_note: str = ""
    model: ModelConfig | None = None


@dataclass
class UploadRecord:
    data: bytes
    name: str
    content_type: str


def issue(issue_id: str, skill_id: str, status: str, severity: str, title: str, detail: str, source: str, area: dict[str, float] | None = None, evidence: list[str] | None = None, suggestion: str | None = None) -> dict[str, Any]:
    return {
        "id": issue_id,
        "skill_id": skill_id,
        "status": status,
        "severity": severity,
        "title": title,
        "detail": detail,
        "source": source,
        "area": area,
        "evidence": evidence or [],
        "suggestion": suggestion,
    }


def technical_audit(record: UploadRecord, request: ReviewRequest) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    measurements: dict[str, Any] = {"file_name": record.name, "bytes": len(record.data), "content_type": record.content_type}
    suffix = record.name.lower().rsplit(".", 1)[-1] if "." in record.name else ""
    content_type = record.content_type
    if content_type == "application/octet-stream" and suffix in {"svg", "tif", "tiff"}:
        content_type = "image/svg+xml" if suffix == "svg" else "image/tiff"
    measurements["detected_type"] = content_type
    if content_type == "image/svg+xml" or suffix == "svg":
        try:
            root = ET.fromstring(record.data)
            tag = root.tag.rsplit("}", 1)[-1]
            if tag != "svg":
                raise ValueError("根元素不是 SVG")
            view_box = root.attrib.get("viewBox", "").split()
            measurements.update({"format": "SVG", "vector": True, "width": root.attrib.get("width"), "height": root.attrib.get("height"), "viewBox": view_box or None})
            if not view_box and not root.attrib.get("width") and not root.attrib.get("height"):
                findings.append(issue("TECH-004", "figure-technical-audit", "待人工确认", "中", "SVG 缺少可识别的尺寸信息", "文件是可解析的 SVG，但没有 width、height 或 viewBox，最终排版尺寸需要人工确认。", "技术审校 · SVG"))
            else:
                findings.append(issue("TECH-004", "figure-technical-audit", "通过", "建议", "SVG 矢量结构已识别", "检测到 SVG 根元素和尺寸信息；文字是否仍为可编辑文本需要进一步检查。", "技术审校 · SVG", evidence=["解析到 SVG 根元素"]))
        except (ET.ParseError, ValueError) as exc:
            findings.append(issue("TECH-ERR", "figure-technical-audit", "执行失败", "高", "无法读取 SVG", str(exc), "技术审校 · SVG 文件解析"))
    elif content_type.startswith("image/"):
        try:
            image = Image.open(io.BytesIO(record.data))
            width, height = image.size
            measurements.update({"width_px": width, "height_px": height, "mode": image.mode, "format": image.format})
            if width < 1200 or height < 800:
                findings.append(issue("TECH-001", "figure-technical-audit", "发现问题", "中", "图像尺寸偏小", f"当前尺寸为 {width} × {height} px。若最终用于论文排版，需结合目标宽度计算有效分辨率。", "技术审校 · 图像属性", evidence=[f"读取到像素尺寸 {width} × {height}"]))
            else:
                findings.append(issue("TECH-001", "figure-technical-audit", "通过", "建议", "像素尺寸已读取", f"当前尺寸为 {width} × {height} px；尚未提供最终排版宽度，因此不直接判定 DPI。", "技术审校 · 图像属性", evidence=[f"读取到像素尺寸 {width} × {height}"]))
        except Exception as exc:
            findings.append(issue("TECH-ERR", "figure-technical-audit", "执行失败", "高", "无法读取图像", str(exc), "技术审校 · 文件解析"))
    elif content_type == "application/pdf":
        findings.append(issue("TECH-002", "figure-technical-audit", "待人工确认", "中", "PDF 页面解析将在下一版接入", "当前切片只对图片完成像素测量；PDF 已保存，但尚未把页面尺寸、嵌入位图和文字层拆开检查。", "技术审校 · PDF", evidence=["文件类型为 PDF"]))
    else:
        findings.append(issue("TECH-003", "figure-technical-audit", "执行失败", "高", "文件类型不受支持", f"收到 {record.content_type}，首版支持 PNG、JPEG、TIFF、SVG 和 PDF。", "技术审校 · 文件类型"))
    return findings, measurements


async def model_audit(record: UploadRecord, request: ReviewRequest) -> list[dict[str, Any]]:
    config = request.model
    if not config or not config.api_key or not config.base_url or not config.model:
        return [issue("MODEL-001", "figure-visual-audit", "信息不足", "建议", "尚未执行视觉模型审校", "请在模型设置中配置支持图片输入的兼容接口；技术审校仍可独立完成。", "模型执行状态")]
    if not record.content_type.startswith("image/"):
        return [issue("MODEL-002", "figure-visual-audit", "信息不足", "建议", "当前文件无法发送给视觉模型", "首版视觉模型路径只接受图片输入。", "模型执行状态")]
    image_b64 = __import__("base64").b64encode(record.data).decode("ascii")
    prompt = f"""请审校这张用于“{request.purpose}”的“{request.figure_type}”科研图表。
图注：{request.caption or '未提供'}
实验背景或审校上下文：{request.context_note or '未提供'}

只返回严格 JSON 对象，根字段为 issues 数组。每一项必须包含：
- id：简短规则编号；
- skill_id：figure-visual-audit 或 figure-semantic-audit；
- status：只能是“发现问题”“待人工确认”“通过”“信息不足”；
- severity：只能是“高”“中”“建议”；
- title：简体中文短标题；
- detail：简体中文解释，说明对阅读或科学表达的实际影响；
- source：简体中文依据类别，例如“数据逻辑检查”“视觉可读性检查”“图注一致性检查”；
- area：能可靠定位时返回原图归一化坐标 x、y、w、h，不能可靠定位时为 null；
- evidence：简体中文证据数组，指标名、公式、变量名和专有名词可以保留英文；
- suggestion：简体中文、可执行且不改变科研数据的修改建议。

审校要求：
1. 所有自然语言字段必须使用简体中文，不要输出英文段落。
2. 数据逻辑矛盾、明显错误使用“高”；影响理解的缺失标签或遮挡使用“中”；版式统一、配色优化等使用“建议”。
3. 区分明确错误和美观建议。多面板坐标范围不同不一定错误，应根据比较需求表述为建议或待确认。
3.1. 如果上下文说明这是超参数、模型或基准实验，优先检查参数含义、指标逻辑、比较公平性和可读性；不要把图例、网格线或默认绘图区直接称为“非科研内容”。
4. 不编造原始数据、样本量、统计方法、期刊规定或精确字号。
5. 未提供图注时，不要断言论文没有图注；相应检查标记为“信息不足”。
6. 不要求所有图都有单位、误差棒、p 值或显著性标记，先判断图型和上下文是否适用。
7. 最多返回 8 项高价值结果，避免重复和泛泛而谈。
8. 只有能指出局部问题时才返回 area；区域应紧贴问题对象。覆盖大半张图的框、仅表示全图建议的框和不确定位置请返回 null。"""
    payload = {"model": config.model, "messages": [{"role": "system", "content": "你是严谨的科研图表审校员。关闭思考过程，只返回完整、可解析的 JSON，不要 Markdown 代码围栏，并使用简体中文。"}, {"role": "user", "content": [{"type": "text", "text": prompt}, {"type": "image_url", "image_url": {"url": f"data:{record.content_type};base64,{image_b64}"}}]}], "temperature": 0.1, "max_tokens": 6000, "enable_thinking": False, "response_format": {"type": "json_object"}}
    try:
        async with httpx.AsyncClient(timeout=90) as client:
            response = await client.post(config.base_url.rstrip("/") + "/chat/completions", headers={"Authorization": f"Bearer {config.api_key}", "Content-Type": "application/json"}, json=payload)
            response.raise_for_status()
            data = response.json()
        content = data["choices"][0]["message"]["content"]
        if isinstance(content, list):
            content = "".join(str(part.get("text", "")) if isinstance(part, dict) else str(part) for part in content)
        import json
        parsed = parse_model_json(str(content))
        issues = parsed.get("issues", []) if isinstance(parsed, dict) else []
        return [normalize_model_issue(item, index) for index, item in enumerate(issues)] or [issue("MODEL-EMPTY", "figure-visual-audit", "待人工确认", "建议", "模型未返回结构化问题", "接口返回为空，建议检查模型是否支持视觉输入和 JSON 输出。", "视觉模型执行")]
    except (httpx.HTTPError, KeyError, ValueError, TypeError) as exc:
        return [issue("MODEL-ERR", "figure-visual-audit", "执行失败", "高", "视觉模型调用失败", model_error_detail(exc), "视觉模型执行")]


def parse_model_json(content: str) -> dict[str, Any]:
    """Parse strict JSON while tolerating a surrounding markdown fence or prose."""
    import json
    text = content.strip()
    if "```" in text:
        blocks = [block.strip() for block in text.split("```") if block.strip()]
        text = next((block[4:].strip() for block in blocks if block.lower().startswith("json")), blocks[0] if blocks else text)
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start < 0 or end <= start:
            raise ValueError("模型没有返回完整 JSON")
        try:
            parsed = json.loads(text[start:end + 1])
        except json.JSONDecodeError as exc:
            raise ValueError("模型返回的 JSON 不完整或格式错误，请重试；可先减少图片尺寸或问题数量") from exc
    if not isinstance(parsed, dict):
        raise ValueError("模型返回的 JSON 根对象不是对象")
    return parsed


def model_error_detail(exc: Exception) -> str:
    if isinstance(exc, httpx.ConnectError):
        return "后端无法连接模型服务。请检查网络、代理或防火墙；这不是图表解析错误。"
    if isinstance(exc, httpx.TimeoutException):
        return "模型服务响应超时。请重试，或降低图片尺寸后再提交。"
    if isinstance(exc, httpx.HTTPStatusError):
        status = exc.response.status_code
        if status in {401, 403}:
            return "模型服务拒绝鉴权。请检查 API Key、Base URL 和账号权限。"
        if status == 404:
            return "模型服务找不到接口或模型。请检查 Base URL 是否包含 /v1，以及模型名称是否有效。"
        if status == 429:
            return "模型服务触发限流或余额限制，请稍后重试并检查平台额度。"
        return f"模型服务返回 HTTP {status}。请在模型平台查看错误详情。"
    if "JSON" in str(exc) or "json" in str(exc):
        return str(exc)
    return str(exc)


def normalize_model_issue(item: Any, index: int) -> dict[str, Any]:
    if not isinstance(item, dict):
        return issue(f"MODEL-{index:03d}", "figure-visual-audit", "待人工确认", "建议", "模型返回了无法解析的项目", "请人工复核原图。", "视觉模型输出")
    status = item.get("status") if item.get("status") in {"发现问题", "待人工确认", "通过", "信息不足"} else "待人工确认"
    severity = item.get("severity") if item.get("severity") in {"高", "中", "建议"} else "建议"
    area = item.get("area") if isinstance(item.get("area"), dict) else None
    return issue(str(item.get("id") or f"MODEL-{index:03d}"), str(item.get("skill_id") or "figure-visual-audit"), status, severity, str(item.get("title") or "模型发现的待确认事项"), str(item.get("detail") or "模型未提供具体说明。"), str(item.get("source") or "视觉模型执行"), area, [str(x) for x in item.get("evidence", []) if isinstance(x, (str, int, float))], str(item.get("suggestion") or "") or None)


@app.get("/api/health")
@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "version": app.version}


@app.post("/api/preview")
@app.post("/preview")
async def preview(file: UploadFile = File(...)) -> Response:
    """Render browser-incompatible raster formats for preview only."""
    data = await file.read()
    try:
        image = Image.open(io.BytesIO(data))
        image.thumbnail((2400, 1600))
        output = io.BytesIO()
        image.convert("RGB").save(output, format="PNG", optimize=True)
        return Response(content=output.getvalue(), media_type="image/png")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"无法生成预览: {exc}") from exc


@app.post("/api/model-test")
@app.post("/model-test")
async def model_test(model_json: str = Form("")) -> dict[str, Any]:
    """Test endpoint reachability and authentication without uploading a figure."""
    try:
        import json
        config = ModelConfig(**json.loads(model_json)) if model_json else ModelConfig()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"模型配置格式错误: {exc}") from exc
    if not config.api_key:
        return {"ok": False, "code": "missing_key", "message": "尚未填写 API Key。"}
    payload = {"model": config.model, "messages": [{"role": "user", "content": "Reply with OK."}], "max_tokens": 8, "temperature": 0}
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(config.base_url.rstrip("/") + "/chat/completions", headers={"Authorization": f"Bearer {config.api_key}", "Content-Type": "application/json"}, json=payload)
            response.raise_for_status()
        return {"ok": True, "code": "ok", "message": "模型连接和鉴权成功。", "model": config.model}
    except (httpx.HTTPError, ValueError) as exc:
        return {"ok": False, "code": "request_failed", "message": model_error_detail(exc)}


@app.post("/api/review")
@app.post("/review")
async def review(file: UploadFile = File(...), figure_type: str = Form("multi_panel"), purpose: str = Form("paper"), preset: str = Form("general"), caption: str = Form(""), context_note: str = Form(""), model_json: str = Form("")) -> dict[str, Any]:
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="文件为空")
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="首版限制单文件不超过 25 MB")
    try:
        import json
        model = ModelConfig(**json.loads(model_json)) if model_json else None
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"模型配置格式错误: {exc}") from exc
    request = ReviewRequest(figure_type=figure_type, purpose=purpose, preset=preset, caption=caption, context_note=context_note, model=model)
    record = UploadRecord(data=data, name=file.filename or "upload", content_type=file.content_type or "application/octet-stream")
    suffix = record.name.lower().rsplit(".", 1)[-1] if "." in record.name else ""
    if record.content_type == "application/octet-stream" and suffix in {"svg", "tif", "tiff"}:
        record.content_type = "image/svg+xml" if suffix == "svg" else "image/tiff"
    started = time.perf_counter()
    technical, measurements = technical_audit(record, request)
    model_findings = await model_audit(record, request)
    all_findings = technical + model_findings
    return {"task_id": str(uuid.uuid4()), "file": {"name": record.name, "content_type": record.content_type, "sha256": hashlib.sha256(data).hexdigest()}, "context": request.model_dump(exclude={"model"}), "measurements": measurements, "findings": all_findings, "coverage": {"checked": 1 + (1 if request.caption else 0), "available": 4, "skills": ["figure-technical-audit", "figure-visual-audit", "figure-semantic-audit", "figure-recheck"]}, "status": "partial" if any(x["status"] in {"信息不足", "执行失败", "待人工确认"} for x in all_findings) else "complete", "elapsed_ms": round((time.perf_counter() - started) * 1000)}
