/**
 * 驳真 (Dialectic) 自动化可执行评测与系统完整性校验套件 (Eval Runner)
 * 运行方式: node test/eval-runner.mjs 或 npm test
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert';
import { LedgerStore, ProductScout, createMcpServer } from '../dist/index.js';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

let passedCount = 0;
let failedCount = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ${GREEN}✓${RESET} ${name}`);
    passedCount++;
  } catch (err) {
    console.log(`  ${RED}✗${RESET} ${name}`);
    console.log(`    ${RED}Error: ${err.message}${RESET}`);
    failedCount++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ${GREEN}✓${RESET} ${name}`);
    passedCount++;
  } catch (err) {
    console.log(`  ${RED}✗${RESET} ${name}`);
    console.log(`    ${RED}Error: ${err.message}${RESET}`);
    failedCount++;
  }
}

console.log(`\n${BOLD}${CYAN}==============================================================${RESET}`);
console.log(`${BOLD}${CYAN}      🛡️  DIALECTIC · 驳真自动化可执行评测套件 (Eval Runner)      ${RESET}`);
console.log(`${BOLD}${CYAN}==============================================================${RESET}\n`);

// ==========================================
// 1. 台账状态机与完整性实测 (Clean-Room 隔离目录)
// ==========================================
console.log(`${BOLD}[1/3] 台账核心状态机与完整性实测 (Ledger Store State Machine)${RESET}`);

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dialectic-eval-'));

try {
  const store = new LedgerStore(tempDir);

  runTest('1.1 留痕桩写入与写后回读校验 (Read-After-Write Verification)', () => {
    const entry = store.recordPrediction({
      target: '测试功能A',
      lens: 'necessity',
      prediction: '若不加打卡，30天内日活无显著下降',
      windowDays: 30,
      failureCondition: '日活下降超15%',
      triggerAction: '重新调研打卡诉求',
    });
    assert(entry.id, '必须生成唯一ID');
    assert.strictEqual(entry.status, 'pending');
    assert.strictEqual(entry.resolution, 'unverified');

    // 校验数据已落盘并能回读
    const rawData = JSON.parse(fs.readFileSync(path.join(tempDir, 'ledger.json'), 'utf-8'));
    const saved = rawData.entries.find((e) => e.id === entry.id);
    assert(saved, '落盘 JSON 中必须存在该记录');
    assert.strictEqual(saved.prediction, entry.prediction, '写后回读预测必须严格一致');
  });

  runTest('1.2 逾期判定与时钟比对 (Overdue Detection)', () => {
    // 写入一条已过期的记录（伪造 windowEnd）
    const entry = store.recordPrediction({
      target: '历史逾期功能',
      lens: 'friction',
      prediction: '必有经办人私下抵触',
      windowDays: 1,
      failureCondition: '无人抵触',
      triggerAction: '推行全员培训',
    });

    const rawData = JSON.parse(fs.readFileSync(path.join(tempDir, 'ledger.json'), 'utf-8'));
    const target = rawData.entries.find((e) => e.id === entry.id);
    target.windowEnd = '2020-01-01'; // 强行置为过去时间
    fs.writeFileSync(path.join(tempDir, 'ledger.json'), JSON.stringify(rawData, null, 2), 'utf-8');

    const debts = store.getDebts();
    const foundOverdue = debts.overdue.find((d) => d.id === entry.id);
    assert(foundOverdue, '过去日期必须被准确识别为逾期坏账 (overdue)');
  });

  runTest('1.3 外部干扰突发因果强制举证门 (External Disruption Attribution)', () => {
    const entry = store.recordPrediction({
      target: '突发外力测试',
      lens: 'compliance',
      prediction: '若取消必被重罚',
      windowDays: 14,
      failureCondition: '未被重罚',
      triggerAction: '立刻整改',
    });

    // 尝试不给说明进行外部干扰核销 -> 必须报错
    assert.throws(
      () => {
        store.reconcileDebt({
          id: entry.id,
          resolution: 'external_disruption',
          attribution: '',
        });
      },
      /必须提供具体的突发因果阻断说明/,
      '未举证时应被外部干扰门禁拦截'
    );

    // 提供充分说明 -> 正常通过
    const reconciled = store.reconcileDebt({
      id: entry.id,
      resolution: 'external_disruption',
      attribution: '上级监管在测试第3天全面叫停行业整顿，政策环境突变',
    });
    assert.strictEqual(reconciled.status, 'resolved');
    assert.strictEqual(reconciled.resolution, 'external_disruption');
  });

  runTest('1.4 防篡改保护门禁：禁止静默覆盖已结案记录准确率', () => {
    const entry = store.recordPrediction({
      target: '防篡改测试方案',
      lens: 'necessity',
      prediction: '做完必亏',
      windowDays: 7,
      failureCondition: '盈利',
      triggerAction: '认输',
    });

    // 首次核销为 falsified (打脸)
    store.reconcileDebt({
      id: entry.id,
      resolution: 'falsified',
    });

    // 尝试静默篡改改为 verified -> 必须被拦截抛错
    assert.throws(
      () => {
        store.reconcileDebt({
          id: entry.id,
          resolution: 'verified',
        });
      },
      /防篡改拦截/,
      '对已结案记录禁止无理由静默篡改'
    );
  });

  runTest('1.5 审计追溯链留痕：带 correctionReason 的更正被合规记录', () => {
    const rawData = JSON.parse(fs.readFileSync(path.join(tempDir, 'ledger.json'), 'utf-8'));
    const falsifiedEntry = rawData.entries.find((e) => e.target === '防篡改测试方案');

    // 附带审计更正理由进行修正
    const corrected = store.reconcileDebt({
      id: falsifiedEntry.id,
      resolution: 'verified',
      correctionReason: '因统计口径前期漏算分部数据，经业务财务联席会议复核后确系预测命中',
    });

    assert.strictEqual(corrected.resolution, 'verified');
    assert(corrected.auditLog && corrected.auditLog.length > 0, '必须保留审计日志');
    assert.strictEqual(corrected.auditLog[0].previousResolution, 'falsified');
    assert.strictEqual(corrected.auditLog[0].newResolution, 'verified');
  });

  runTest('1.6 命中率分母科学性校验 (Hit Rate Denominator Integrity)', () => {
    // 构造测试数据: 2 命中, 1 失误, 1 未执行, 1 外部干扰, 1 样本不足
    const cleanDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dialectic-stats-'));
    const testStore = new LedgerStore(cleanDir);

    const makeRecord = (res, attr) => {
      const e = testStore.recordPrediction({
        target: '统计测试',
        lens: 'necessity',
        prediction: '测试',
        windowDays: 1,
        failureCondition: '反例',
        triggerAction: '动作',
      });
      testStore.reconcileDebt({ id: e.id, resolution: res, attribution: attr });
    };

    makeRecord('verified');
    makeRecord('verified');
    makeRecord('falsified');
    makeRecord('unimplemented');
    makeRecord('external_disruption', '突发外部政策叫停');
    makeRecord('insufficient_sample');

    const stats = testStore.getStats();
    assert.strictEqual(stats.archived, 6, '归档总数必须为 6');
    assert.strictEqual(stats.verified, 2, '命中数必须为 2');
    assert.strictEqual(stats.falsified, 1, '失误数必须为 1');
    // 有效结案样本 = 2 + 1 = 3，分母不计未执行/外部/样本不足
    // 命中率 = 2 / 3 * 100% = 66.666...%
    assert(stats.hitRate !== null, '命中率不应为 null');
    assert(Math.abs(stats.hitRate - 66.67) < 0.1, `命中率应约为 66.7%，实测为 ${stats.hitRate}%`);
    assert(stats.unimplementedRate > 0, '应统计未执行率');
    assert(stats.externalDisruptionRate > 0, '应统计外部干扰率');

    fs.rmSync(cleanDir, { recursive: true, force: true });
  });

  runTest('1.7 Markdown 双向字段解析兼容性 (对账结果 vs 对账状态)', () => {
    const mdDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dialectic-md-'));
    const mdPath = path.join(mdDir, 'ledger.md');

    const sampleMd = `# 驳真实战决策台账 (Dialectic Ledger)

## 待观察 (Active Pending)
📌 【实战留痕桩】
- id: 20260901-01
- status: pending
- 审查时间：2026-09-01 10:00
- 审查对象：旧版状态字段功能
- 审查透镜：功能必要 (Necessity)
- 核心预测：若不做必卡死
- 观察窗口：至 2026-10-01
- 输赢边界：未卡死
- 触发动作：记录
- 对账状态：unverified
- 归因说明：none

📌 【实战留痕桩】
- id: 20260901-02
- status: resolved
- 审查时间：2026-09-01 11:00
- 审查对象：新版结果字段功能
- 审查透镜：组织阻力 (Friction)
- 核心预测：若强推必受阻
- 观察窗口：至 2026-10-01
- 输赢边界：顺畅
- 触发动作：复盘
- 对账结果：verified
- 归因说明：none
`;
    fs.writeFileSync(mdPath, sampleMd, 'utf-8');

    // 实例化时自动从 md 导入
    const mdStore = new LedgerStore(mdDir);
    const debts = mdStore.getDebts();
    assert.strictEqual(debts.activePending.length, 1, '对账状态应能成功解析进 pending');
    assert.strictEqual(debts.archivedCount, 1, '对账结果应能成功解析进 archived');

    fs.rmSync(mdDir, { recursive: true, force: true });
  });
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

// ==========================================
// 2. Scout SSRF 安全拦截实测
// ==========================================
console.log(`\n${BOLD}[2/3] Scout SSRF 安全防御实测 (SSRF Defense Verification)${RESET}`);

const scout = new ProductScout();

await runAsyncTest('2.1 拦截 127.0.0.1 本地回环', async () => {
  await assert.rejects(
    async () => scout.scoutUrl('http://127.0.0.1:8080/secret'),
    /安全拦截：禁止访问/,
    '必须拦截 127.0.0.1'
  );
});

await runAsyncTest('2.2 拦截 localhost 本地主机名', async () => {
  await assert.rejects(
    async () => scout.scoutUrl('http://localhost:3000/api'),
    /安全拦截：禁止访问/,
    '必须拦截 localhost'
  );
});

await runAsyncTest('2.3 拦截 169.254.169.254 云厂商实例元数据地址', async () => {
  await assert.rejects(
    async () => scout.scoutUrl('http://169.254.169.254/latest/meta-data/'),
    /安全拦截：禁止访问/,
    '必须拦截云元数据地址 169.254.169.254'
  );
});

await runAsyncTest('2.4 拦截 10.0.0.0/8 私有内网地址', async () => {
  await assert.rejects(
    async () => scout.scoutUrl('http://10.1.2.3/admin'),
    /安全拦截：禁止访问/,
    '必须拦截 10.0.0.0/8 内网'
  );
});

await runAsyncTest('2.5 拦截 192.168.0.0/16 局域网地址', async () => {
  await assert.rejects(
    async () => scout.scoutUrl('http://192.168.1.1/gateway'),
    /安全拦截：禁止访问/,
    '必须拦截 192.168.0.0/16 局域网'
  );
});

await runAsyncTest('2.6 拦截 172.16.0.0/12 私有地址', async () => {
  await assert.rejects(
    async () => scout.scoutUrl('http://172.20.10.5/conf'),
    /安全拦截：禁止访问/,
    '必须拦截 172.16.0.0/12 私有网段'
  );
});

await runAsyncTest('2.7 拦截非 HTTP/HTTPS 协议', async () => {
  await assert.rejects(
    async () => scout.scoutUrl('ftp://example.com/file'),
    /安全拦截：仅支持 HTTP 或 HTTPS 协议/,
    '必须拒绝非 HTTP/HTTPS 协议'
  );
});

// ==========================================
// 3. 脑身契约与一致性静态核验 (Skill Contract & Consistency)
// ==========================================
console.log(`\n${BOLD}[3/3] 脑（SKILL.md）与身（代码与评测）契约一致性核验${RESET}`);

const repoRoot = path.resolve(import.meta.dirname, '..');
const skillContent = fs.readFileSync(path.join(repoRoot, 'SKILL.md'), 'utf-8');
const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf-8'));
const serverContent = fs.readFileSync(path.join(repoRoot, 'src/server.ts'), 'utf-8');
const readmeContent = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf-8');
const evalsContent = fs.readFileSync(path.join(repoRoot, 'evals/test_cases.md'), 'utf-8');

runTest('3.1 SKILL.md 完整编排全部 5 个 dialectic_* MCP 工具', () => {
  const tools = [
    'dialectic_check_debts',
    'dialectic_record_prediction',
    'dialectic_reconcile_debt',
    'dialectic_get_stats',
    'dialectic_scout_product',
  ];
  for (const t of tools) {
    assert(skillContent.includes(t), `SKILL.md 必须显式声明工具 ${t} 的调用指示`);
  }
});

runTest('3.2 SKILL.md 包含 Step 0 账本查验与无 MCP 纯文本降级指示', () => {
  assert(skillContent.includes('Step 0 账本核验'), '必须包含 Step 0 账本核验');
  assert(
    skillContent.includes('当前环境无本地 MCP / 文件读写权限，已自动切换为纯文本手动台账模式'),
    '必须包含无权限环境降级声明'
  );
});

runTest('3.3 决策结论词表完整覆盖 4 态 (含补齐证据)', () => {
  assert(skillContent.includes('大方通过 (PASS)'), '必须包含 大方通过 (PASS)');
  assert(skillContent.includes('建议放弃'), '必须包含 建议放弃');
  assert(skillContent.includes('小步快跑'), '必须包含 小步快跑');
  assert(skillContent.includes('暂缓立项 / 补齐证据'), '必须包含 暂缓立项 / 补齐证据');
  assert(skillContent.includes('缺失事实清单'), '补齐证据必须要求输出缺失事实清单');
});

runTest('3.4 法规红线严格遵循三级依据标注与防捏造纪律', () => {
  assert(skillContent.includes('【条文原文】'), '必须定义【条文原文】');
  assert(skillContent.includes('【合理推断】'), '必须定义【合理推断】');
  assert(skillContent.includes('【实务惯例】'), '必须定义【实务惯例】');
  assert(skillContent.includes('严禁凭空捏造不存在的法条编号与规定'), '必须包含防编造法条红线');
});

runTest('3.5 早期个人产品【诚实声明免检】与防捏造对立角色', () => {
  assert(skillContent.includes('【诚实说明】已核查现存种子用户'), '必须包含诚实说明标准话术');
  assert(skillContent.includes('严禁无中生有捏造假想敌'), '必须包含防捏造角色红线');
});

runTest('3.6 对抗性提示注入防御守则与创新沙盒试水指引', () => {
  assert(skillContent.includes('对抗性提示注入防御守则'), '必须包含注入防御');
  assert(skillContent.includes('创新沙盒'), '必须包含创新沙盒透镜');
  assert(skillContent.includes('1/10 成本最小可验证闭环'), '必须提供低成本试水闭环');
});

runTest('3.7 Gate 编号自洽性 (Gate 0 ~ Gate 4)', () => {
  for (let i = 0; i <= 4; i++) {
    assert(skillContent.includes(`Gate ${i}`), `SKILL.md 必须包含 Gate ${i}`);
  }
  assert(!evalsContent.includes('Gate 2：对账与防穿帮'), 'evals 不得再把对账混淆为 Gate 2');
});

runTest('3.8 全链路版本号严格一致 (4.0.1)', () => {
  const pkgVer = packageJson.version;
  assert.strictEqual(pkgVer, '4.0.1', 'package.json 版本应为 4.0.1');
  assert(serverContent.includes("version: '4.0.1'"), "server.ts 版本应为 '4.0.1'");
  assert(readmeContent.includes('version-4.0.1'), 'README badge 应包含 4.0.1');
});

runTest('3.9 bin 字段完整注册 dialectic 与 dialectic-mcp', () => {
  assert(packageJson.bin['dialectic'], 'bin 必须包含 dialectic');
  assert(packageJson.bin['dialectic-mcp'], 'bin 必须包含 dialectic-mcp');
});

// ==========================================
// 总结报告
// ==========================================
console.log(`\n${BOLD}==============================================================${RESET}`);
if (failedCount === 0) {
  console.log(`${BOLD}${GREEN}  🎉 评测全部通过！共通过 ${passedCount} / ${passedCount + failedCount} 项测试。${RESET}`);
  console.log(`${BOLD}${GREEN}  Dialectic 脑身协同、台账防篡改、SSRF 防御与事实纪律验证完毕。${RESET}`);
} else {
  console.log(`${BOLD}${RED}  ❌ 评测失败！通过 ${passedCount} 项，失败 ${failedCount} 项。${RESET}`);
}
console.log(`${BOLD}==============================================================${RESET}\n`);

if (failedCount > 0) {
  process.exit(1);
}
