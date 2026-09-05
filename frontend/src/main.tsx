import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Upload, Play, Download, Settings2, FileCheck2, ChevronDown, AlertTriangle, CheckCircle2, Info, SlidersHorizontal } from 'lucide-react';
import './styles.css';
import './overrides.css';

type Area = {x:number;y:number;w:number;h:number};
type Issue = { id: string; skill_id?: string; status?: string; severity: '高'|'中'|'建议'; title: string; detail: string; source: string; evidence?: string[]; suggestion?: string; area?: Area|null };
type ReviewData = { task_id: string; file: {name:string;content_type:string;sha256:string}; context: {figure_type:string;purpose:string;preset:string;caption:string}; measurements: Record<string, unknown>; findings: Issue[]; coverage: Record<string, unknown>; status: string; elapsed_ms: number };

function validArea(value: unknown): Area | null {
  if (!value || typeof value !== 'object') return null;
  const a = value as Record<string, unknown>;
  const nums = ['x','y','w','h'].map(key => Number(a[key]));
  if (nums.some(n => !Number.isFinite(n)) || nums[2] <= 0 || nums[3] <= 0) return null;
  if (nums[2] > 0.78 || nums[3] > 0.78) return null;
  return {x: Math.max(0, Math.min(1, nums[0])), y: Math.max(0, Math.min(1, nums[1])), w: Math.max(0, Math.min(1, nums[2])), h: Math.max(0, Math.min(1, nums[3]))};
}
function normalizeSeverity(value: unknown): '高'|'中'|'建议' {
  const text = String(value || '').trim().toLowerCase();
  if (text === '高' || text === 'high' || text === 'critical') return '高';
  if (text === '中' || text === 'medium' || text === 'major') return '中';
  return '建议';
}

const demoIssues: Issue[] = [
  { id:'VIS-001', severity:'高', title:'面板 b 的横轴标签可能被裁切', detail:'右侧边界距离文字过近，缩小到目标宽度后可能影响阅读。', source:'视觉审校 · 图像区域 (72%, 86%)', suggestion:'增加右侧边距，并在最终排版宽度下重新检查标签是否完整。' },
  { id:'SEM-002', severity:'中', title:'误差线含义未在图注中说明', detail:'图中检测到误差线，但当前图注没有说明它代表 SD、SEM 或置信区间。', source:'语义审校 · 图注', suggestion:'在图注中明确误差线代表的统计量，并说明样本或重复定义。' },
  { id:'TECH-003', severity:'建议', title:'建议导出可编辑矢量格式', detail:'当前文件为 PNG。若用于投稿，建议从绘图源导出 SVG 或 PDF。', source:'技术审校 · 文件属性', suggestion:'从原始绘图脚本导出 SVG 或保留可编辑文字的 PDF，不要将 PNG 直接封装进 PDF。' },
];

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [tab, setTab] = useState<'issues'|'details'>('issues');
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [modelName, setModelName] = useState('Qwen/Qwen3.5-27B');
  const backendUrl = import.meta.env.DEV ? 'http://localhost:8000' : '';
  const [modelBaseUrl, setModelBaseUrl] = useState('https://api.siliconflow.cn/v1');
  const [apiKey, setApiKey] = useState('');
  const [caption, setCaption] = useState('');
  const [contextNote, setContextNote] = useState('');
  const [figureType, setFigureType] = useState('多面板组合');
  const [purpose, setPurpose] = useState('论文投稿');
  const [showSettings, setShowSettings] = useState(false);
  const [testingModel, setTestingModel] = useState(false);
  const [modelTestMessage, setModelTestMessage] = useState('');
  const [modelTestOk, setModelTestOk] = useState(false);
  const [issues, setIssues] = useState<Issue[]>(demoIssues);
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [preset, setPreset] = useState('通用科研图表');
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const isTiff = /\.(tif|tiff)$/i.test(file.name);
    let objectUrl = '';
    let cancelled = false;
    if (isTiff) {
      const body = new FormData(); body.append('file', file);
      fetch(`${backendUrl}/api/preview`, { method: 'POST', body }).then(r => r.ok ? r.blob() : Promise.reject(new Error('preview failed'))).then(blob => {
        if (!cancelled) { objectUrl = URL.createObjectURL(blob); setPreview(objectUrl); }
      }).catch(() => { if (!cancelled) setPreview(null); });
    } else {
      objectUrl = URL.createObjectURL(file); setPreview(objectUrl);
    }
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [file, backendUrl]);
  const runReview = async () => {
    if (!file) return;
    setRunning(true); setDone(false); setError('');
    const body = new FormData();
    body.append('file', file); body.append('figure_type', figureType); body.append('purpose', purpose);
    body.append('preset', preset === 'Nature 风格' ? 'nature' : 'general'); body.append('caption', caption); body.append('context_note', contextNote);
    body.append('model_json', JSON.stringify({ base_url: modelBaseUrl.replace(/\/$/, ''), api_key: apiKey, model: modelName }));
    try {
      const response = await fetch(`${backendUrl}/api/review`, { method: 'POST', body });
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      const findings = (data.findings || []).map((x: any) => ({ id: x.id, skill_id: x.skill_id, status: x.status, severity: normalizeSeverity(x.severity), title: x.title, detail: x.detail, source: x.source, evidence: x.evidence || [], suggestion: x.suggestion, area: validArea(x.area) }));
      setIssues(findings); setReviewData({...data, findings});
      setDone(true);
    } catch (e) {
      setError('后端未连接或审校请求失败。请启动 FastAPI 后端，或检查模型接口设置。');
    } finally { setRunning(false); }
  };
  const download = (name: string, content: BlobPart, type: string) => { const url = URL.createObjectURL(new Blob([content], {type})); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); };
  const exportReport = async () => {
    if (!file || !reviewData) return;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const markdown = [`# 科研图表审校报告`, ``, `- 文件：${reviewData.file.name}`, `- 类型：${reviewData.file.content_type}`, `- 文件 SHA-256：${reviewData.file.sha256}`, `- 图表类型：${reviewData.context.figure_type}`, `- 目标用途：${reviewData.context.purpose}`, `- 标准：${reviewData.context.preset}`, `- 任务状态：${reviewData.status}`, `- 执行耗时：${reviewData.elapsed_ms} ms`, ``, `## 测量信息`, ``, '```json', JSON.stringify(reviewData.measurements, null, 2), '```', ``, `## 检查结果`, ``];
    reviewData.findings.forEach((x, i) => { markdown.push(`### ${i + 1}. [${x.severity}] ${x.title}`, ``, `- 状态：${(x as any).status || '模型审校结果'}`, `- 技能：${(x as any).skill_id || 'figure-visual-audit'}`, `- 依据：${x.source}`, `- 说明：${x.detail}`, `- 证据：${(x as any).evidence?.join('；') || '未提供'}`, `- 修改建议：${x.suggestion || '未提供'}`, `- 区域：${x.area ? JSON.stringify(x.area) : '未可靠定位'}`, ``); });
    download(`figure-review-${stamp}.md`, markdown.join('\n'), 'text/markdown;charset=utf-8');
    download(`figure-review-${stamp}.json`, JSON.stringify(reviewData, null, 2), 'application/json;charset=utf-8');
    if (preview) await exportAnnotatedPng(`figure-review-${stamp}-annotated.png`);
  };
  const exportAnnotatedPng = (name: string) => new Promise<void>((resolve) => { if (!preview) return resolve(); const image = new Image(); image.onload = () => { const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight; const ctx = canvas.getContext('2d'); if (!ctx) return resolve(); ctx.drawImage(image, 0, 0); issues.filter(x => x.area).forEach((x, i) => { const a = x.area!; ctx.strokeStyle = x.severity === '高' ? '#d36a4e' : x.severity === '中' ? '#c28a28' : '#3d8490'; ctx.lineWidth = Math.max(3, canvas.width / 360); ctx.strokeRect(a.x * canvas.width, a.y * canvas.height, a.w * canvas.width, a.h * canvas.height); ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(a.x * canvas.width, a.y * canvas.height, Math.max(14, canvas.width / 90), 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.max(16, canvas.width / 65)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), a.x * canvas.width, a.y * canvas.height); }); canvas.toBlob(blob => { if (blob) { const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); } resolve(); }, 'image/png'); }; image.src = preview; });
  const testModel = async () => {
    setTestingModel(true); setModelTestMessage('正在测试连接…'); setModelTestOk(false);
    const body = new FormData(); body.append('model_json', JSON.stringify({ base_url: modelBaseUrl.replace(/\/$/, ''), api_key: apiKey, model: modelName }));
    try {
      const response = await fetch(`${backendUrl}/api/model-test`, { method: 'POST', body });
      const data = await response.json();
      setModelTestOk(Boolean(data.ok)); setModelTestMessage(data.message || '模型测试完成');
    } catch { setModelTestMessage('无法连接本地后端，请确认 8000 端口服务正在运行。'); }
    finally { setTestingModel(false); }
  };

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark">ƒ</div><div><strong>Figure Review</strong><span>科研图表审校工作台</span></div></div>
      <div className="top-actions"><button className="ghost" onClick={()=>setShowSettings(true)}><Settings2 size={16}/>模型设置</button><button className="ghost" disabled={!done || !reviewData} onClick={exportReport}><Download size={16}/>导出报告</button><div className="avatar">AI</div></div>
    </header>
    <main className="workspace">
      <aside className="left-panel">
        <div className="section-label">当前任务</div><div className="task-title">未命名审校任务<span className="status-dot"/></div>
        <label className="upload-box"><Upload size={20}/><strong>{file ? '更换图表文件' : '上传图表文件'}</strong><small>SVG / TIFF / PNG / JPG / PDF 单页</small><input type="file" accept="image/*,.svg,.tif,.tiff,.pdf" onChange={e=>setFile(e.target.files?.[0] || null)}/></label>
        <div className="section-label spaced">审校配置</div>
        <label className="field"><span>图表类型</span><select value={figureType} onChange={e=>setFigureType(e.target.value)}><option>多面板组合</option><option>折线图</option><option>柱状图</option><option>散点图</option><option>热图</option></select><ChevronDown size={14}/></label>
        <label className="field"><span>目标用途</span><select value={purpose} onChange={e=>setPurpose(e.target.value)}><option>论文投稿</option><option>组会汇报</option><option>海报展示</option></select><ChevronDown size={14}/></label>
        <label className="field"><span>审校标准</span><select value={preset} onChange={e=>setPreset(e.target.value)}><option>通用科研图表</option><option>Nature 风格</option><option>自定义规则</option></select><ChevronDown size={14}/></label>
        <label className="caption-field"><span>图注（可选）</span><textarea value={caption} onChange={e=>setCaption(e.target.value)} placeholder="补充图注，帮助语义审校" /></label>
        <label className="caption-field"><span>实验背景（推荐）</span><textarea value={contextNote} onChange={e=>setContextNote(e.target.value)} placeholder="例如：这是模型超参数实验，横轴为学习率，纵轴为 F1，比较不同数据集表现" /></label>
        <div className="skill-list"><div className="section-label">已启用 Skills</div>{['技术规格审校','视觉可读性审校','图注语义审校','修订版复审'].map((s,i)=><div className="skill-row" key={s}><span className={'skill-icon s'+i}>{i===0?'T':i===1?'V':i===2?'S':'R'}</span><span>{s}</span><CheckCircle2 size={14}/></div>)}</div>
        <button className="run-button" onClick={runReview} disabled={running || !file}><Play size={17} fill="currentColor"/>{running ? '正在审校…' : '开始审校'}</button>
      </aside>
      <section className="canvas-panel">
        <div className="canvas-toolbar"><div className="crumb">工作台 <span>/</span> {file?.name || '等待上传图表'}</div><div className="zoom-tools"><button>−</button><span>100%</span><button>＋</button><button>适应窗口</button></div></div>
        <div className="canvas-stage" ref={stageRef}>{preview ? <div className="figure-wrap"><img ref={imageRef} src={preview} className="figure-preview"/>{done && issues.map((x, i) => x.area && <React.Fragment key={x.id}><button className={'area-box '+(selectedIssue===x.id?'selected':'')} style={{left:`${x.area.x*100}%`,top:`${x.area.y*100}%`,width:`${x.area.w*100}%`,height:`${x.area.h*100}%`}} onClick={()=>{setSelectedIssue(x.id);setExpandedIssue(x.id)}} aria-label={`定位问题区域 ${i+1}`}/><button className={'annotation '+(selectedIssue===x.id?'selected':'')} style={{left:`${x.area.x*100}%`,top:`${x.area.y*100}%`}} onClick={()=>{setSelectedIssue(x.id);setExpandedIssue(x.id)}} aria-label={`定位问题 ${i+1}`}>{i+1}</button></React.Fragment>)}</div> : file ? <div className="empty-state"><div className="empty-icon"><FileCheck2 size={28}/></div><h2>文件已上传</h2><p>该文件暂时无法在浏览器中预览，但仍可提交技术审校。</p></div> : <div className="empty-state"><div className="empty-icon"><FileCheck2 size={28}/></div><h2>从一张图开始</h2><p>上传论文图表，系统会结合规则与模型给出带证据的审校结果。</p><label className="primary-upload">选择文件<input type="file" accept="image/*,.svg,.tif,.tiff,.pdf" onChange={e=>setFile(e.target.files?.[0] || null)}/></label></div>}</div>
        <div className="canvas-footer"><span>{file ? `${file.name} · ${Math.round(file.size/1024)} KB` : '尚未选择文件'}</span><span className="footer-hint"><Info size={14}/>原图不会被修改，标注作为独立图层显示</span></div>
      </section>
      <aside className="right-panel"><div className="result-head"><div><div className="eyebrow">审校结果</div><h1>{done ? `发现 ${issues.length} 项审校结果` : error ? '审校未完成' : '等待开始审校'}</h1></div><button className="icon-button"><SlidersHorizontal size={17}/></button></div>{error && <div className="error-banner"><AlertTriangle size={15}/><span>{error}</span></div>}{done && <div className="summary-strip"><div><strong>{issues.length}</strong><span>发现</span></div><div><strong>{issues.filter(x=>x.severity === '高').length}</strong><span>高优先级</span></div><div><strong>4</strong><span>技能覆盖</span></div></div>}<div className="tabs"><button className={tab==='issues'?'active':''} onClick={()=>setTab('issues')}>问题清单</button><button className={tab==='details'?'active':''} onClick={()=>setTab('details')}>执行详情</button></div>{done && tab==='issues' ? <div className="issue-list">{issues.map((x)=><div className={'issue '+(selectedIssue===x.id?'selected':'')} key={x.id} onClick={()=>x.area && setSelectedIssue(x.id)}><div className="issue-top"><span className={'severity '+x.severity}>{x.severity}</span><span className="issue-id">{x.id}</span></div><h3>{x.title}</h3><p>{x.detail}</p><div className="issue-source">{x.source}</div><button className="suggestion" onClick={()=>{setSelectedIssue(x.id);setExpandedIssue(expandedIssue===x.id?null:x.id)}}><span>{expandedIssue===x.id?'收起修改建议':'查看修改建议'}</span><ChevronDown size={14}/></button>{expandedIssue===x.id && <div className="suggestion-body">{x.suggestion || '当前结果未提供单独的修改建议，请根据问题说明进行调整并上传修订版复审。'}</div>}</div>)}</div> : <div className="detail-empty"><Info size={18}/><p>{done ? '本次任务使用了技术规格、视觉可读性、语义对应和复审四类 Skills。未执行或信息不足的检查不会被计为通过。' : '开始审校后，这里会显示每个 Skill 的执行状态、耗时和覆盖范围。'}</p></div>}</aside>
    </main>
    {showSettings && <div className="modal-backdrop" onClick={()=>setShowSettings(false)}><div className="settings-modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><div className="eyebrow">模型设置</div><h2>连接视觉模型</h2></div><button className="icon-button" onClick={()=>setShowSettings(false)}>×</button></div><p className="modal-copy">已预填硅基流动的 OpenAI-compatible 视觉接口。API Key 只在浏览器会话中使用。</p><label className="modal-field"><span>模型 Base URL</span><input value={modelBaseUrl} onChange={e=>{setModelBaseUrl(e.target.value);setModelTestMessage('')}} placeholder="https://api.siliconflow.cn/v1" /></label><label className="modal-field"><span>模型名称</span><input value={modelName} onChange={e=>{setModelName(e.target.value);setModelTestMessage('')}} placeholder="Qwen/Qwen3.5-27B" /></label><label className="modal-field"><span>API Key</span><input type="password" value={apiKey} onChange={e=>{setApiKey(e.target.value);setModelTestMessage('')}} placeholder="可留空，仅运行本地技术检查" /></label>{modelTestMessage && <div className={'model-test '+(modelTestOk?'ok':'bad')}><span>{modelTestOk ? '✓' : '!'}</span>{modelTestMessage}</div>}<div className="modal-foot"><button className="test-model" onClick={testModel} disabled={testingModel}>{testingModel ? '测试中…' : '测试连接'}</button><span className="model-note"><CheckCircle2 size={14}/>未保存到服务器</span><button className="run-button modal-save" onClick={()=>setShowSettings(false)}>完成设置</button></div></div></div>}
  </div>
}
createRoot(document.getElementById('root')!).render(<App />);
