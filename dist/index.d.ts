import { Server } from '@modelcontextprotocol/sdk/server/index.js';

type LensType = 'friction' | 'necessity' | 'compliance';
type ResolutionStatus = 'verified' | 'falsified' | 'insufficient_sample' | 'unimplemented' | 'external_disruption';
interface AuditRecord {
    previousResolution: ResolutionStatus | 'unverified';
    newResolution: ResolutionStatus;
    changedAt: string;
    reason: string;
}
interface LedgerEntry {
    id: string;
    status: 'pending' | 'resolved';
    createdAt: string;
    target: string;
    lens: LensType;
    prediction: string;
    windowEnd: string;
    failureCondition: string;
    triggerAction: string;
    resolution: ResolutionStatus | 'unverified';
    attribution: string;
    resolvedAt?: string;
    auditLog?: AuditRecord[];
}
interface LedgerData {
    version: number;
    entries: LedgerEntry[];
}
interface LedgerStats {
    total: number;
    activePending: number;
    overdue: number;
    archived: number;
    verified: number;
    falsified: number;
    insufficientSample: number;
    unimplemented: number;
    externalDisruption: number;
    hitRate: number | null;
    unimplementedRate: number;
    externalDisruptionRate: number;
    insufficientSampleRate: number;
}

declare class LedgerStore {
    private baseDir;
    private jsonPath;
    private mdPath;
    constructor(customDir?: string);
    private ensureInitialized;
    getPaths(): {
        baseDir: string;
        jsonPath: string;
        mdPath: string;
    };
    private loadData;
    private saveData;
    private importFromMarkdownIfEmpty;
    private syncMarkdown;
    private formatLens;
    getDebts(): {
        activePending: LedgerEntry[];
        overdue: LedgerEntry[];
        archivedCount: number;
    };
    recordPrediction(params: {
        target: string;
        lens: LensType;
        prediction: string;
        windowDays: number;
        failureCondition: string;
        triggerAction: string;
    }): LedgerEntry;
    reconcileDebt(params: {
        id: string;
        resolution: ResolutionStatus;
        attribution?: string;
        correctionReason?: string;
    }): LedgerEntry;
    getStats(): LedgerStats;
}

declare function createMcpServer(customDir?: string): {
    server: Server<{
        method: string;
        params?: {
            [x: string]: unknown;
            _meta?: {
                [x: string]: unknown;
                progressToken?: string | number | undefined;
                "io.modelcontextprotocol/related-task"?: {
                    taskId: string;
                } | undefined;
            } | undefined;
        } | undefined;
    }, {
        method: string;
        params?: {
            [x: string]: unknown;
            _meta?: {
                [x: string]: unknown;
                progressToken?: string | number | undefined;
                "io.modelcontextprotocol/related-task"?: {
                    taskId: string;
                } | undefined;
            } | undefined;
        } | undefined;
    }, {
        [x: string]: unknown;
        _meta?: {
            [x: string]: unknown;
            progressToken?: string | number | undefined;
            "io.modelcontextprotocol/related-task"?: {
                taskId: string;
            } | undefined;
        } | undefined;
    }>;
    store: LedgerStore;
};
declare function runMcpServer(): Promise<void>;

/**
 * Dialectic Scout - 轻量级竞品与产品情报嗅探器
 * 核心原则：零内存占用 (Zero-Memory Overhead)，多级容错兜底，原生极速解析。
 */
interface ScoutResult {
    url: string;
    title: string;
    content: string;
    charCount: number;
    extractedAt: string;
    method: 'native-distill' | 'cloud-reader';
}
declare class ProductScout {
    private timeoutMs;
    constructor(timeoutMs?: number);
    /**
     * SSRF 防护校验：禁止访问私有内网、本地回环及云厂商元数据服务
     */
    private validateUrlSecurity;
    /**
     * 嗅探并提取指定产品/竞品网页的核心内容与结构化 Markdown
     * 策略：默认优先原生直连提取 (100% 独立、无依赖、防封锁)，若配置了 JINA_API_KEY 则走增强通道
     */
    scoutUrl(targetUrl: string): Promise<ScoutResult>;
    /**
     * 原生独立抓取：标准 HTTP fetch + 智能 HTML 去噪蒸馏 (毫秒级、0 外部依赖)
     */
    private scoutDirect;
    /**
     * HTML 智能去噪与 Markdown 提炼引擎
     */
    private distillHtml;
    private cleanHtmlEntities;
    /**
     * 云端 Reader 备用通道 (支持 JINA_API_KEY)
     */
    private scoutViaJina;
}

export { type AuditRecord, type LedgerData, type LedgerEntry, type LedgerStats, LedgerStore, type LensType, ProductScout, type ResolutionStatus, type ScoutResult, createMcpServer, runMcpServer };
