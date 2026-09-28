import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { LedgerData, LedgerEntry, LedgerStats, LensType, ResolutionStatus } from './types.js';

export class LedgerStore {
  private baseDir: string;
  private jsonPath: string;
  private mdPath: string;

  constructor(customDir?: string) {
    if (customDir) {
      this.baseDir = customDir;
    } else {
      // 默认优先用户家目录 ~/.dialectic
      const homeDir = os.homedir();
      this.baseDir = path.join(homeDir, '.dialectic');
    }

    this.jsonPath = path.join(this.baseDir, 'ledger.json');
    this.mdPath = path.join(this.baseDir, 'ledger.md');
    this.ensureInitialized();
  }

  private ensureInitialized(): void {
    try {
      if (!fs.existsSync(this.baseDir)) {
        fs.mkdirSync(this.baseDir, { recursive: true });
      }

      if (!fs.existsSync(this.jsonPath)) {
        const initialData: LedgerData = {
          version: 1,
          entries: [],
        };
        fs.writeFileSync(this.jsonPath, JSON.stringify(initialData, null, 2), 'utf-8');
      }

      // 如果 json 为空但已有 markdown 账本，自动导入
      const currentData = this.loadData();
      if (currentData.entries.length === 0 && fs.existsSync(this.mdPath)) {
        this.importFromMarkdownIfEmpty(currentData);
      }

      // 如果 md 文件不存在，同步渲染一份
      if (!fs.existsSync(this.mdPath)) {
        this.syncMarkdown(this.loadData());
      }
    } catch {
      // 若家目录受限，降级到当前工作区 ./.dialectic
      const fallbackDir = path.join(process.cwd(), '.dialectic');
      this.baseDir = fallbackDir;
      this.jsonPath = path.join(fallbackDir, 'ledger.json');
      this.mdPath = path.join(fallbackDir, 'ledger.md');
      fs.mkdirSync(fallbackDir, { recursive: true });
      if (!fs.existsSync(this.jsonPath)) {
        const initialData: LedgerData = {
          version: 1,
          entries: [],
        };
        fs.writeFileSync(this.jsonPath, JSON.stringify(initialData, null, 2), 'utf-8');
      }
      if (!fs.existsSync(this.mdPath)) {
        this.syncMarkdown(this.loadData());
      }
    }
  }

  public getPaths() {
    return {
      baseDir: this.baseDir,
      jsonPath: this.jsonPath,
      mdPath: this.mdPath,
    };
  }

  private loadData(): LedgerData {
    try {
      const raw = fs.readFileSync(this.jsonPath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return { version: 1, entries: [] };
    }
  }

  private saveData(data: LedgerData): void {
    // 写入 JSON 保证机器可读与数据强一致
    fs.writeFileSync(this.jsonPath, JSON.stringify(data, null, 2), 'utf-8');
    // 同步渲染为人性化的 Markdown 账本
    this.syncMarkdown(data);
  }

  private importFromMarkdownIfEmpty(data: LedgerData): void {
    try {
      const content = fs.readFileSync(this.mdPath, 'utf-8');
      const blocks = content.split('📌 【实战留痕桩】').slice(1);
      for (const block of blocks) {
        const idMatch = block.match(/- id:\s*([^\n\r]+)/);
        const statusMatch = block.match(/- status:\s*([^\n\r]+)/);
        const timeMatch = block.match(/- 审查时间：\s*([^\n\r]+)/);
        const targetMatch = block.match(/- 审查对象：\s*([^\n\r]+)/);
        const lensMatch = block.match(/- 审查透镜：\s*([^\n\r]+)/);
        const predMatch = block.match(/- 核心预测：\s*([^\n\r]+)/);
        const windowMatch = block.match(/- 观察窗口：\s*([^\n\r]+)/);
        const failureMatch = block.match(/- 输赢边界：\s*([^\n\r]+)/);
        const actionMatch = block.match(/- 触发动作：\s*([^\n\r]+)/);
        const resMatch = block.match(/- (?:对账结果|对账状态)：\s*([^\n\r]+)/);
        const attrMatch = block.match(/- 归因说明：\s*([^\n\r]+)/);

        if (idMatch && targetMatch && predMatch) {
          const id = idMatch[1].trim();
          let lens: LensType = 'necessity';
          const lensText = lensMatch ? lensMatch[1] : '';
          if (lensText.includes('组织')) lens = 'friction';
          else if (lensText.includes('合规')) lens = 'compliance';

          let windowEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          if (windowMatch) {
            const dateMatch = windowMatch[1].match(/\d{4}-\d{2}-\d{2}/g);
            if (dateMatch && dateMatch.length > 0) {
              windowEnd = dateMatch[dateMatch.length - 1];
            }
          }

          data.entries.push({
            id,
            status: statusMatch && statusMatch[1].trim() === 'resolved' ? 'resolved' : 'pending',
            createdAt: timeMatch ? timeMatch[1].trim().replace(' ', 'T') + ':00Z' : new Date().toISOString(),
            target: targetMatch[1].trim(),
            lens,
            prediction: predMatch[1].trim(),
            windowEnd,
            failureCondition: failureMatch ? failureMatch[1].trim() : '',
            triggerAction: actionMatch ? actionMatch[1].trim() : '',
            resolution: (resMatch ? resMatch[1].trim() : 'unverified') as any,
            attribution: attrMatch ? attrMatch[1].trim() : 'none',
          });
        }
      }
      if (data.entries.length > 0) {
        fs.writeFileSync(this.jsonPath, JSON.stringify(data, null, 2), 'utf-8');
      }
    } catch {}
  }

  private syncMarkdown(data: LedgerData): void {
    const today = new Date().toISOString().split('T')[0];

    const activePending: LedgerEntry[] = [];
    const overdueDebt: LedgerEntry[] = [];
    const archived: LedgerEntry[] = [];

    for (const entry of data.entries) {
      if (entry.status === 'resolved') {
        archived.push(entry);
      } else if (entry.windowEnd < today) {
        overdueDebt.push(entry);
      } else {
        activePending.push(entry);
      }
    }

    const renderEntry = (e: LedgerEntry): string => {
      const lines = [
        `📌 【实战留痕桩】`,
        `- id: ${e.id}`,
        `- status: ${e.status}`,
        `- 审查时间：${e.createdAt.replace('T', ' ').slice(0, 16)}`,
        `- 审查对象：${e.target}`,
        `- 审查透镜：${this.formatLens(e.lens)}`,
        `- 核心预测：${e.prediction}`,
        `- 观察窗口：至 ${e.windowEnd}`,
        `- 输赢边界：${e.failureCondition}`,
        `- 触发动作：${e.triggerAction}`,
        `- 对账结果：${e.resolution}`,
        `- 归因说明：${e.attribution || 'none'}`,
      ];
      if (e.resolvedAt) {
        lines.push(`- 核销时间：${e.resolvedAt.replace('T', ' ').slice(0, 16)}`);
      }
      if (e.auditLog && e.auditLog.length > 0) {
        const auditLines = e.auditLog.map(
          (a) => `${a.changedAt.replace('T', ' ').slice(0, 16)} 由 ${a.previousResolution} 更正为 ${a.newResolution} (原因: ${a.reason})`
        );
        lines.push(`- 审计更正记录：${auditLines.join('; ')}`);
      }
      return lines.join('\n');
    };

    const mdContent = [
      `# 驳真实战决策台账 (Dialectic Ledger)`,
      ``,
      `> 本台账由 Dialectic 引擎自动维护。自动比对系统时钟，杜绝陈年坏账掩盖。`,
      ``,
      `## 待观察 (Active Pending)`,
      `<!-- 观察期尚未届满的健康预测 -->`,
      activePending.length > 0 ? activePending.map(renderEntry).join('\n\n') : `*(暂无)*`,
      ``,
      `## 逾期未对账 (Overdue Debt)`,
      `<!-- 观察期已届满、尚未核销的坏账记录 -->`,
      overdueDebt.length > 0 ? overdueDebt.map(renderEntry).join('\n\n') : `*(暂无)*`,
      ``,
      `## 已归档 (Archived)`,
      `<!-- 已完成对账核销的历史记录 -->`,
      archived.length > 0 ? archived.map(renderEntry).join('\n\n') : `*(暂无)*`,
      ``,
    ].join('\n');

    fs.writeFileSync(this.mdPath, mdContent, 'utf-8');
  }

  private formatLens(lens: LensType): string {
    switch (lens) {
      case 'friction':
        return '组织阻力 (Friction)';
      case 'necessity':
        return '功能必要 (Necessity)';
      case 'compliance':
        return '合规红线 (Compliance)';
    }
  }

  // 获取分类账目
  public getDebts(): {
    activePending: LedgerEntry[];
    overdue: LedgerEntry[];
    archivedCount: number;
  } {
    const data = this.loadData();
    const today = new Date().toISOString().split('T')[0];

    const activePending: LedgerEntry[] = [];
    const overdue: LedgerEntry[] = [];
    let archivedCount = 0;

    for (const entry of data.entries) {
      if (entry.status === 'resolved') {
        archivedCount++;
      } else if (entry.windowEnd < today) {
        overdue.push(entry);
      } else {
        activePending.push(entry);
      }
    }

    return { activePending, overdue, archivedCount };
  }

  // 记录新预测
  public recordPrediction(params: {
    target: string;
    lens: LensType;
    prediction: string;
    windowDays: number;
    failureCondition: string;
    triggerAction: string;
  }): LedgerEntry {
    const data = this.loadData();
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // 计算观察期截止日期
    const endDate = new Date(now.getTime() + params.windowDays * 24 * 60 * 60 * 1000);
    const windowEnd = endDate.toISOString().split('T')[0];

    // 生成唯一 ID：YYYYMMDD-序号
    const datePrefix = today.replace(/-/g, '');
    const todayEntries = data.entries.filter((e) => e.id.startsWith(datePrefix));
    const nextSeq = String(todayEntries.length + 1).padStart(2, '0');
    const id = `${datePrefix}-${nextSeq}`;

    const newEntry: LedgerEntry = {
      id,
      status: 'pending',
      createdAt: now.toISOString(),
      target: params.target,
      lens: params.lens,
      prediction: params.prediction,
      windowEnd,
      failureCondition: params.failureCondition,
      triggerAction: params.triggerAction,
      resolution: 'unverified',
      attribution: 'none',
    };

    data.entries.push(newEntry);
    this.saveData(data);

    // 写后回读校验 (Read-after-write verification)
    const verifiedData = this.loadData();
    const found = verifiedData.entries.find((e) => e.id === newEntry.id);
    if (!found || found.prediction !== newEntry.prediction) {
      throw new Error(`[台账完整性错误] 留痕记录 ${newEntry.id} 写后回读校验失败，数据未能成功落盘！`);
    }

    return newEntry;
  }

  // 核销旧账
  public reconcileDebt(params: {
    id: string;
    resolution: ResolutionStatus;
    attribution?: string;
    correctionReason?: string;
  }): LedgerEntry {
    const data = this.loadData();
    const targetEntry = data.entries.find((e) => e.id === params.id);

    if (!targetEntry) {
      throw new Error(`未找到 ID 为 ${params.id} 的留痕记录`);
    }

    if (params.resolution === 'external_disruption' && (!params.attribution || params.attribution.trim() === 'none')) {
      throw new Error(`选择“外部干扰”时必须提供具体的突发因果阻断说明`);
    }

    // 防篡改防护门禁：若已被核销结案，禁止静默二次改写覆盖准确率！
    if (targetEntry.status === 'resolved') {
      if (!params.correctionReason || params.correctionReason.trim() === '') {
        throw new Error(
          `[防篡改拦截] 留痕记录 ${params.id} 已于 ${targetEntry.resolvedAt || '此前'} 核销结案为【${targetEntry.resolution}】。禁止直接静默覆盖准确率！若确系事实更正，必须提供 correctionReason (更正归因理由) 以保留审计留痕。`
        );
      }

      // 记录审计留痕
      if (!targetEntry.auditLog) {
        targetEntry.auditLog = [];
      }
      targetEntry.auditLog.push({
        previousResolution: targetEntry.resolution,
        newResolution: params.resolution,
        changedAt: new Date().toISOString(),
        reason: params.correctionReason.trim(),
      });
    }

    targetEntry.status = 'resolved';
    targetEntry.resolution = params.resolution;
    targetEntry.attribution = params.attribution || targetEntry.attribution || 'none';
    targetEntry.resolvedAt = new Date().toISOString();

    this.saveData(data);

    // 写后回读校验
    const verifiedData = this.loadData();
    const found = verifiedData.entries.find((e) => e.id === params.id);
    if (!found || found.resolution !== params.resolution) {
      throw new Error(`[台账完整性错误] 留痕记录 ${params.id} 核销写后回读校验失败！`);
    }

    return targetEntry;
  }

  // 计算严密的看板统计指标
  public getStats(): LedgerStats {
    const data = this.loadData();
    const today = new Date().toISOString().split('T')[0];

    let activePending = 0;
    let overdue = 0;
    let archived = 0;
    let verified = 0;
    let falsified = 0;
    let insufficientSample = 0;
    let unimplemented = 0;
    let externalDisruption = 0;

    for (const e of data.entries) {
      if (e.status === 'resolved') {
        archived++;
        if (e.resolution === 'verified') verified++;
        else if (e.resolution === 'falsified') falsified++;
        else if (e.resolution === 'insufficient_sample') insufficientSample++;
        else if (e.resolution === 'unimplemented') unimplemented++;
        else if (e.resolution === 'external_disruption') externalDisruption++;
      } else if (e.windowEnd < today) {
        overdue++;
      } else {
        activePending++;
      }
    }

    const effectiveTotal = verified + falsified;
    const hitRate = effectiveTotal > 0 ? (verified / effectiveTotal) * 100 : null;

    const totalArchived = archived;
    const unimplementedRate = totalArchived > 0 ? (unimplemented / totalArchived) * 100 : 0;
    const externalDisruptionRate = totalArchived > 0 ? (externalDisruption / totalArchived) * 100 : 0;
    const insufficientSampleRate = totalArchived > 0 ? (insufficientSample / totalArchived) * 100 : 0;

    return {
      total: data.entries.length,
      activePending,
      overdue,
      archived,
      verified,
      falsified,
      insufficientSample,
      unimplemented,
      externalDisruption,
      hitRate,
      unimplementedRate,
      externalDisruptionRate,
      insufficientSampleRate,
    };
  }
}
