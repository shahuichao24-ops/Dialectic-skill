#!/usr/bin/env node
import {
  LedgerStore,
  ProductScout,
  runMcpServer
} from "./chunk-3QB2UP64.js";

// src/cli.ts
import fs from "fs";
import path from "path";
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "mcp";
  if (command === "mcp") {
    await runMcpServer();
    return;
  }
  const store = new LedgerStore();
  if (command === "board") {
    const stats = store.getStats();
    const debts = store.getDebts();
    const paths = store.getPaths();
    console.log(`
\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502                   \u{1F6E1}\uFE0F  DIALECTIC \xB7 \u9A73\u771F\u6218\u7EE9\u770B\u677F                 \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
  \u{1F4C1} \u8D26\u672C\u8DEF\u5F84: ${paths.baseDir}
  \u{1F552} \u7CFB\u7EDF\u65F6\u95F4: ${(/* @__PURE__ */ new Date()).toISOString().replace("T", " ").slice(0, 16)}

  \u3010\u5B9E\u6218\u9884\u6D4B\u6982\u89C8\u3011
  - \u5F85\u89C2\u5BDF\u9884\u6D4B (Active Pending)   : ${stats.activePending} \u6761
  - \u903E\u671F\u5F85\u5F00\u7BB1 (Overdue Unbox)    : ${stats.overdue > 0 ? `\x1B[33m${stats.overdue} \u6761 \u{1F381} (\u5230\u671F\u7B49\u5F85\u63ED\u6653)\x1B[0m` : `0 \u6761 \u2705`}
  - \u5DF2\u5F52\u6863\u7ED3\u6848 (Archived Total)   : ${stats.archived} \u6761

  \u3010\u7EDF\u8BA1\u79D1\u5B66\u770B\u677F\u3011
  - \u7D2F\u8BA1\u5F52\u6863\u603B\u6837\u672C               : ${stats.archived}
  - \u6709\u6548\u7ED3\u6848\u6837\u672C (\u547D\u4E2D + \u5931\u8BEF)   : ${stats.verified + stats.falsified} ${stats.verified + stats.falsified < 20 ? "(\u65E9\u671F\u79EF\u7D2F\u671F\uFF0C\u7F6E\u4FE1\u533A\u95F4\u8FC7\u5BBD)" : "(\u5177\u5907\u7EDF\u8BA1\u53C2\u8003\u4EF7\u503C)"}
  - \u9884\u6D4B\u547D\u4E2D\u7387 (Hit Rate)        : ${stats.hitRate !== null ? `\x1B[32m${stats.hitRate.toFixed(1)}%\x1B[0m` : "-"}
  - \u9A8C\u8BC1\u547D\u4E2D\u6B21\u6570                 : ${stats.verified}
  - \u9884\u6D4B\u5931\u8BEF\u6B21\u6570 (\u6253\u8138\u8BB0\u5F55)      : ${stats.falsified}
  - \u65B9\u6848\u672A\u6267\u884C\u7387                 : ${stats.unimplementedRate.toFixed(1)}% (${stats.unimplemented} \u6B21)
  - \u5916\u90E8\u5E72\u6270\u7387                   : ${stats.externalDisruptionRate.toFixed(1)}% (${stats.externalDisruption} \u6B21)
  - \u6837\u672C\u4E0D\u8DB3\u7387                   : ${stats.insufficientSampleRate.toFixed(1)}% (${stats.insufficientSample} \u6B21)
`);
    if (debts.overdue.length > 0) {
      console.log(`\x1B[33m  \u{1F381} \u3010\u5230\u671F\u5F85\u5F00\u7BB1\u6E05\u5355 (\u770B\u770B\u5F53\u521D\u8C01\u731C\u4E2D\u4E86)\u3011\x1B[0m`);
      for (const d of debts.overdue) {
        console.log(`  - [${d.id}] \u5230\u671F\u65E5: ${d.windowEnd} | \u76EE\u6807: ${d.target} | \u9884\u6D4B: ${d.prediction}`);
      }
      console.log(``);
    }
    return;
  }
  if (command === "list") {
    const debts = store.getDebts();
    console.log(`
\u{1F4CB} \u3010\u5F85\u89C2\u5BDF\u9884\u6D4B (${debts.activePending.length} \u6761)\u3011`);
    for (const p of debts.activePending) {
      console.log(`  - [${p.id}] \u622A\u6B62: ${p.windowEnd} | \u65B9\u6848: ${p.target} | \u9884\u6D4B: ${p.prediction}`);
    }
    if (debts.overdue.length > 0) {
      console.log(`
\x1B[31m\u26A0\uFE0F \u3010\u903E\u671F\u672A\u5BF9\u8D26\u574F\u8D26 (${debts.overdue.length} \u6761)\u3011\x1B[0m`);
      for (const o of debts.overdue) {
        console.log(`  - [${o.id}] \u5230\u671F: ${o.windowEnd} | \u65B9\u6848: ${o.target} | \u9884\u6D4B: ${o.prediction}`);
      }
    } else {
      console.log(`
\u2705 \u65E0\u903E\u671F\u574F\u8D26\u3002`);
    }
    console.log(``);
    return;
  }
  if (command === "init") {
    const cursorDir = path.join(process.cwd(), ".cursor");
    const mcpJsonPath = path.join(cursorDir, "mcp.json");
    try {
      if (!fs.existsSync(cursorDir)) {
        fs.mkdirSync(cursorDir, { recursive: true });
      }
      let mcpConfig = { mcpServers: {} };
      if (fs.existsSync(mcpJsonPath)) {
        try {
          mcpConfig = JSON.parse(fs.readFileSync(mcpJsonPath, "utf-8"));
          if (!mcpConfig.mcpServers) mcpConfig.mcpServers = {};
        } catch {
        }
      }
      mcpConfig.mcpServers.dialectic = {
        command: "npx",
        args: ["-y", "dialectic-mcp"]
      };
      fs.writeFileSync(mcpJsonPath, JSON.stringify(mcpConfig, null, 2), "utf-8");
      console.log(`
\u2705 \u6210\u529F\u5728\u5F53\u524D\u76EE\u5F55\u914D\u7F6E Cursor MCP: ${mcpJsonPath}`);
      console.log(`
\u63D0\u793A\uFF1A\u91CD\u542F Cursor \u6216\u5728 Agent \u9762\u677F\u4E2D\u5237\u65B0\uFF0C\u5373\u53EF\u81EA\u52A8\u52A0\u8F7D dialectic_* 5 \u5927\u5DE5\u5177\uFF01
`);
    } catch (err) {
      console.log(`
\u65E0\u6CD5\u81EA\u52A8\u5199\u5165\u914D\u7F6E: ${err.message}`);
      console.log(`
\u4F60\u53EF\u4EE5\u624B\u52A8\u5C06\u4EE5\u4E0B\u914D\u7F6E\u586B\u5165 .cursor/mcp.json \u6216 Claude Desktop \u914D\u7F6E\u4E2D\uFF1A
`);
      console.log(
        JSON.stringify(
          {
            mcpServers: {
              dialectic: {
                command: "npx",
                args: ["-y", "dialectic-mcp"]
              }
            }
          },
          null,
          2
        )
      );
    }
    return;
  }
  if (command === "scout") {
    const targetUrl = args[1];
    if (!targetUrl) {
      console.log(`
\u274C \u8BF7\u63D0\u4F9B\u76EE\u6807\u7F51\u9875\u94FE\u63A5\uFF0C\u4F8B\u5982: dialectic scout https://example.com
`);
      return;
    }
    console.log(`
\u{1F310} \u6B63\u5728\u8F7B\u91CF\u55C5\u63A2\u5E76\u63D0\u53D6\u4EA7\u54C1\u60C5\u62A5 (0 \u5185\u5B58\u6D88\u8017): ${targetUrl} ...`);
    const scout = new ProductScout();
    try {
      const res = await scout.scoutUrl(targetUrl);
      console.log(`
\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510`);
      console.log(`\u2502                   \u{1F50D}  DIALECTIC \u7ADE\u54C1\u60C5\u62A5\u55C5\u63A2                  \u2502`);
      console.log(`\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518`);
      console.log(`  \u{1F3AF} \u76EE\u6807\u6807\u9898: ${res.title}`);
      console.log(`  \u{1F517} \u6765\u6E90\u94FE\u63A5: ${res.url}`);
      console.log(`  \u{1F4CA} \u5B57\u7B26\u89C4\u6A21: ${res.charCount} \u5B57\u7B26 (\u5DF2\u6E05\u6D17\u53BB\u566A)
`);
      console.log(res.content);
      console.log(`
\u{1F4A1} \u63D0\u793A\uFF1A\u53EF\u76F4\u63A5\u5C06\u4E0A\u8FF0\u7ADE\u54C1\u60C5\u62A5\u63D0\u4EA4\u7ED9\u9A73\u771F\u8FDB\u884C\u4E09\u5927\u900F\u955C\u5BF9\u6297\u63A8\u6F14\uFF01
`);
    } catch (err) {
      console.error(`
\u274C \u55C5\u63A2\u5931\u8D25: ${err.message}
`);
    }
    return;
  }
  console.log(`
\u{1F6E1}\uFE0F Dialectic CLI - \u9A73\u771F\u51B3\u7B56\u5BA1\u67E5\u5F15\u64CE

\u4F7F\u7528\u65B9\u6CD5:
  dialectic [mcp]       \u542F\u52A8 MCP Server (\u4F9B Cursor / Claude Code \u8FDE\u63A5)
  dialectic board       \u67E5\u770B\u5B9E\u6218\u9884\u6D4B\u547D\u4E2D\u7387\u4E0E\u6218\u7EE9\u770B\u677F
  dialectic list        \u5217\u51FA\u5F85\u89C2\u5BDF\u4E0E\u903E\u671F\u7559\u75D5\u6E05\u5355
  dialectic scout <URL> \u96F6\u5185\u5B58\u8F7B\u91CF\u55C5\u63A2\u7ADE\u54C1\u6216\u4EA7\u54C1\u7F51\u9875\u60C5\u62A5
  dialectic init        \u81EA\u52A8\u5728\u5F53\u524D\u5DE5\u7A0B\u914D\u7F6E Cursor MCP
  dialectic --help      \u67E5\u770B\u5E2E\u52A9
`);
}
main().catch((err) => {
  console.error(`\x1B[31m[Dialectic Error]\x1B[0m`, err);
  process.exit(1);
});
