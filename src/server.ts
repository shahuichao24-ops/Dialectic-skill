import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { LedgerStore } from './store.js';
import { ProductScout } from './scout.js';

export function createMcpServer(customDir?: string) {
  const store = new LedgerStore(customDir);

  const server = new Server(
    {
      name: 'dialectic-mcp',
      version: '4.0.1',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // 1. 列出可用的 5 个标准工具
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'dialectic_check_debts',
          description:
            '【Step 0 必备】启动审查前必须调用。自动排查本地账本中的待观察预测与逾期未结案坏账，杜绝算错时钟与账目掩盖。',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'dialectic_record_prediction',
          description:
            '审查完成后调用。在本地账本中安全写入一条具备可检验性的实战留痕桩，自动生成 ID 与时间戳，并同步 Markdown 账本。',
          inputSchema: {
            type: 'object',
            properties: {
              target: {
                type: 'string',
                description: '审查对象 (方案或功能名称)',
              },
              lens: {
                type: 'string',
                enum: ['friction', 'necessity', 'compliance'],
                description: '审查透镜：friction (组织阻力) ｜ necessity (功能必要) ｜ compliance (合规红线)',
              },
              prediction: {
                type: 'string',
                description: '核心预测：若 [不做某事 / 强推某事]，在观察期内必然出现 [客观指标]',
              },
              windowDays: {
                type: 'number',
                description: '观察窗口天数 (如 14, 30, 60 天，根据业务周期定，禁止盲目填天数)',
              },
              failureCondition: {
                type: 'string',
                description: '输赢边界：出现什么具体反例证明本次审查判断失误',
              },
              triggerAction: {
                type: 'string',
                description: '触发动作：若预测命中，下一步团队具体执行什么调整动作',
              },
            },
            required: ['target', 'lens', 'prediction', 'windowDays', 'failureCondition', 'triggerAction'],
          },
        },
        {
          name: 'dialectic_reconcile_debt',
          description:
            '核销结案某条已到期的历史留痕。将记录原子化移入已归档区，保证对账闭环自洽。',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: '待核销的留痕记录 ID (如 20260924-01)',
              },
              resolution: {
                type: 'string',
                enum: ['verified', 'falsified', 'insufficient_sample', 'unimplemented', 'external_disruption'],
                description:
                  '核销结果：verified (验证命中) ｜ falsified (预测失误) ｜ insufficient_sample (样本不足) ｜ unimplemented (方案未执行) ｜ external_disruption (外部干扰)',
              },
              attribution: {
                type: 'string',
                description: '归因说明 (选择 external_disruption 外部干扰时必须详细举证突发因果)',
              },
              correctionReason: {
                type: 'string',
                description: '更正归因理由 (若该留痕此前已完成核销结案，二次变更必须提供更正原因以供审计留痕，严禁静默篡改战绩)',
              },
            },
            required: ['id', 'resolution'],
          },
        },
        {
          name: 'dialectic_get_stats',
          description: '获取当前台账的历史预测战绩、有效命中率及分项指标统计。',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'dialectic_scout_product',
          description:
            '【竞品与市场情报嗅探】输入产品官网、竞品功能页或产品文章链接，零内存消耗提取高纯度 Markdown 正文与核心产品事实。',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: '目标产品/竞品网页链接 (如 https://example.com)',
              },
            },
            required: ['url'],
          },
        },
      ],
    };
  });

  // 2. 执行工具调用
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      if (name === 'dialectic_check_debts') {
        const debts = store.getDebts();
        const stats = store.getStats();

        let message = `[Step 0 账本查验完成]`;
        if (debts.overdue.length > 0) {
          message += `\n⚠️ 【逾期坏账警示】检测到 ${debts.overdue.length} 项历史留痕已过观察期未结案！请在本次审查前优先与用户对账核销，或在审查结果顶部公开展示债务标记。`;
        } else {
          message += `\n✅ 当前无逾期坏账。`;
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  message,
                  overdueCount: debts.overdue.length,
                  overdueItems: debts.overdue,
                  activePendingCount: debts.activePending.length,
                  activePendingItems: debts.activePending,
                  archivedCount: debts.archivedCount,
                  stats,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      if (name === 'dialectic_record_prediction') {
        const schema = z.object({
          target: z.string().min(1),
          lens: z.enum(['friction', 'necessity', 'compliance']),
          prediction: z.string().min(1),
          windowDays: z.number().int().positive(),
          failureCondition: z.string().min(1),
          triggerAction: z.string().min(1),
        });

        const parsed = schema.parse(args);
        const record = store.recordPrediction(parsed);
        const debts = store.getDebts();

        return {
          content: [
            {
              type: 'text',
              text: `[Step 0 留痕桩已安全写入] ID: ${record.id}，观察期截止: ${record.windowEnd}\n当前状态: 正常观察中 ${debts.activePending.length} 条, ⚠️ 逾期未对账 ${debts.overdue.length} 条, 已归档 ${debts.archivedCount} 条\n(已同步写入 ~/.dialectic/ledger.md)`,
            },
          ],
        };
      }

      if (name === 'dialectic_reconcile_debt') {
        const schema = z.object({
          id: z.string().min(1),
          resolution: z.enum(['verified', 'falsified', 'insufficient_sample', 'unimplemented', 'external_disruption']),
          attribution: z.string().optional(),
          correctionReason: z.string().optional(),
        });

        const parsed = schema.parse(args);
        const reconciled = store.reconcileDebt(parsed);

        return {
          content: [
            {
              type: 'text',
              text: `[对账核销成功] 记录 ${reconciled.id} 已核销为【${reconciled.resolution}】并移入 ## 已归档 分区。`,
            },
          ],
        };
      }

      if (name === 'dialectic_get_stats') {
        const stats = store.getStats();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(stats, null, 2),
            },
          ],
        };
      }

      if (name === 'dialectic_scout_product') {
        const schema = z.object({
          url: z.string().url(),
        });
        const parsed = schema.parse(args);
        const scout = new ProductScout();
        const result = await scout.scoutUrl(parsed.url);

        return {
          content: [
            {
              type: 'text',
              text: `# 🔍 竞品情报: ${result.title}\n- 来源: ${result.url}\n- 字符数: ${result.charCount}\n- 嗅探时间: ${result.extractedAt}\n\n---\n\n${result.content}`,
            },
          ],
        };
      }

      throw new Error(`未知的工具: ${name}`);
    } catch (err: any) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `[Dialectic 引擎错误] ${err.message || String(err)}`,
          },
        ],
      };
    }
  });

  return { server, store };
}

export async function runMcpServer() {
  const { server } = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
