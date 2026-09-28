export type LensType = 'friction' | 'necessity' | 'compliance';

export type ResolutionStatus =
  | 'verified'              // 验证命中 (确实如当初所料)
  | 'falsified'             // 预测失误 (猜错了，现实正好相反)
  | 'insufficient_sample'   // 样本不足 (做了，但时间太短还看不出结果)
  | 'unimplemented'         // 方案未执行 (后来改变主意没做，本次不算)
  | 'external_disruption';  // 外部干扰 (遇到了突发意外阻断因果链)

export interface AuditRecord {
  previousResolution: ResolutionStatus | 'unverified';
  newResolution: ResolutionStatus;
  changedAt: string;           // ISO 8601
  reason: string;              // 审计更正理由
}

export interface LedgerEntry {
  id: string;
  status: 'pending' | 'resolved';
  createdAt: string;           // ISO 8601
  target: string;              // 审查对象 (方案/功能名称)
  lens: LensType;              // 审查透镜 (组织阻力/功能必要/合规红线)
  prediction: string;          // 核心预测 (若不做某事，必然出现...)
  windowEnd: string;           // 观察窗口截止日期 (YYYY-MM-DD)
  failureCondition: string;    // 输赢边界 (怎样算我说错了)
  triggerAction: string;       // 触发动作 (若命中，下一步具体执行什么)
  resolution: ResolutionStatus | 'unverified';
  attribution: string;         // 归因说明 (外部干扰时必填因果细节)
  resolvedAt?: string;         // 核销时间 (ISO 8601)
  auditLog?: AuditRecord[];    // 审计修改留痕（杜绝静默篡改战绩）
}

export interface LedgerData {
  version: number;
  entries: LedgerEntry[];
}

export interface LedgerStats {
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
