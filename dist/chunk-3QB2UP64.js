#!/usr/bin/env node

// src/store.ts
import fs from "fs";
import path from "path";
import os from "os";
var LedgerStore = class {
  baseDir;
  jsonPath;
  mdPath;
  constructor(customDir) {
    if (customDir) {
      this.baseDir = customDir;
    } else {
      const homeDir = os.homedir();
      this.baseDir = path.join(homeDir, ".dialectic");
    }
    this.jsonPath = path.join(this.baseDir, "ledger.json");
    this.mdPath = path.join(this.baseDir, "ledger.md");
    this.ensureInitialized();
  }
  ensureInitialized() {
    try {
      if (!fs.existsSync(this.baseDir)) {
        fs.mkdirSync(this.baseDir, { recursive: true });
      }
      if (!fs.existsSync(this.jsonPath)) {
        const initialData = {
          version: 1,
          entries: []
        };
        fs.writeFileSync(this.jsonPath, JSON.stringify(initialData, null, 2), "utf-8");
      }
      const currentData = this.loadData();
      if (currentData.entries.length === 0 && fs.existsSync(this.mdPath)) {
        this.importFromMarkdownIfEmpty(currentData);
      }
      if (!fs.existsSync(this.mdPath)) {
        this.syncMarkdown(this.loadData());
      }
    } catch {
      const fallbackDir = path.join(process.cwd(), ".dialectic");
      this.baseDir = fallbackDir;
      this.jsonPath = path.join(fallbackDir, "ledger.json");
      this.mdPath = path.join(fallbackDir, "ledger.md");
      fs.mkdirSync(fallbackDir, { recursive: true });
      if (!fs.existsSync(this.jsonPath)) {
        const initialData = {
          version: 1,
          entries: []
        };
        fs.writeFileSync(this.jsonPath, JSON.stringify(initialData, null, 2), "utf-8");
      }
      if (!fs.existsSync(this.mdPath)) {
        this.syncMarkdown(this.loadData());
      }
    }
  }
  getPaths() {
    return {
      baseDir: this.baseDir,
      jsonPath: this.jsonPath,
      mdPath: this.mdPath
    };
  }
  loadData() {
    try {
      const raw = fs.readFileSync(this.jsonPath, "utf-8");
      return JSON.parse(raw);
    } catch {
      return { version: 1, entries: [] };
    }
  }
  saveData(data) {
    fs.writeFileSync(this.jsonPath, JSON.stringify(data, null, 2), "utf-8");
    this.syncMarkdown(data);
  }
  importFromMarkdownIfEmpty(data) {
    try {
      const content = fs.readFileSync(this.mdPath, "utf-8");
      const blocks = content.split("\u{1F4CC} \u3010\u5B9E\u6218\u7559\u75D5\u6869\u3011").slice(1);
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
          let lens = "necessity";
          const lensText = lensMatch ? lensMatch[1] : "";
          if (lensText.includes("\u7EC4\u7EC7")) lens = "friction";
          else if (lensText.includes("\u5408\u89C4")) lens = "compliance";
          let windowEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3).toISOString().split("T")[0];
          if (windowMatch) {
            const dateMatch = windowMatch[1].match(/\d{4}-\d{2}-\d{2}/g);
            if (dateMatch && dateMatch.length > 0) {
              windowEnd = dateMatch[dateMatch.length - 1];
            }
          }
          data.entries.push({
            id,
            status: statusMatch && statusMatch[1].trim() === "resolved" ? "resolved" : "pending",
            createdAt: timeMatch ? timeMatch[1].trim().replace(" ", "T") + ":00Z" : (/* @__PURE__ */ new Date()).toISOString(),
            target: targetMatch[1].trim(),
            lens,
            prediction: predMatch[1].trim(),
            windowEnd,
            failureCondition: failureMatch ? failureMatch[1].trim() : "",
            triggerAction: actionMatch ? actionMatch[1].trim() : "",
            resolution: resMatch ? resMatch[1].trim() : "unverified",
            attribution: attrMatch ? attrMatch[1].trim() : "none"
          });
        }
      }
      if (data.entries.length > 0) {
        fs.writeFileSync(this.jsonPath, JSON.stringify(data, null, 2), "utf-8");
      }
    } catch {
    }
  }
  syncMarkdown(data) {
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const activePending = [];
    const overdueDebt = [];
    const archived = [];
    for (const entry of data.entries) {
      if (entry.status === "resolved") {
        archived.push(entry);
      } else if (entry.windowEnd < today) {
        overdueDebt.push(entry);
      } else {
        activePending.push(entry);
      }
    }
    const renderEntry = (e) => {
      const lines = [
        `\u{1F4CC} \u3010\u5B9E\u6218\u7559\u75D5\u6869\u3011`,
        `- id: ${e.id}`,
        `- status: ${e.status}`,
        `- \u5BA1\u67E5\u65F6\u95F4\uFF1A${e.createdAt.replace("T", " ").slice(0, 16)}`,
        `- \u5BA1\u67E5\u5BF9\u8C61\uFF1A${e.target}`,
        `- \u5BA1\u67E5\u900F\u955C\uFF1A${this.formatLens(e.lens)}`,
        `- \u6838\u5FC3\u9884\u6D4B\uFF1A${e.prediction}`,
        `- \u89C2\u5BDF\u7A97\u53E3\uFF1A\u81F3 ${e.windowEnd}`,
        `- \u8F93\u8D62\u8FB9\u754C\uFF1A${e.failureCondition}`,
        `- \u89E6\u53D1\u52A8\u4F5C\uFF1A${e.triggerAction}`,
        `- \u5BF9\u8D26\u7ED3\u679C\uFF1A${e.resolution}`,
        `- \u5F52\u56E0\u8BF4\u660E\uFF1A${e.attribution || "none"}`
      ];
      if (e.resolvedAt) {
        lines.push(`- \u6838\u9500\u65F6\u95F4\uFF1A${e.resolvedAt.replace("T", " ").slice(0, 16)}`);
      }
      if (e.auditLog && e.auditLog.length > 0) {
        const auditLines = e.auditLog.map(
          (a) => `${a.changedAt.replace("T", " ").slice(0, 16)} \u7531 ${a.previousResolution} \u66F4\u6B63\u4E3A ${a.newResolution} (\u539F\u56E0: ${a.reason})`
        );
        lines.push(`- \u5BA1\u8BA1\u66F4\u6B63\u8BB0\u5F55\uFF1A${auditLines.join("; ")}`);
      }
      return lines.join("\n");
    };
    const mdContent = [
      `# \u9A73\u771F\u5B9E\u6218\u51B3\u7B56\u53F0\u8D26 (Dialectic Ledger)`,
      ``,
      `> \u672C\u53F0\u8D26\u7531 Dialectic \u5F15\u64CE\u81EA\u52A8\u7EF4\u62A4\u3002\u81EA\u52A8\u6BD4\u5BF9\u7CFB\u7EDF\u65F6\u949F\uFF0C\u675C\u7EDD\u9648\u5E74\u574F\u8D26\u63A9\u76D6\u3002`,
      ``,
      `## \u5F85\u89C2\u5BDF (Active Pending)`,
      `<!-- \u89C2\u5BDF\u671F\u5C1A\u672A\u5C4A\u6EE1\u7684\u5065\u5EB7\u9884\u6D4B -->`,
      activePending.length > 0 ? activePending.map(renderEntry).join("\n\n") : `*(\u6682\u65E0)*`,
      ``,
      `## \u903E\u671F\u672A\u5BF9\u8D26 (Overdue Debt)`,
      `<!-- \u89C2\u5BDF\u671F\u5DF2\u5C4A\u6EE1\u3001\u5C1A\u672A\u6838\u9500\u7684\u574F\u8D26\u8BB0\u5F55 -->`,
      overdueDebt.length > 0 ? overdueDebt.map(renderEntry).join("\n\n") : `*(\u6682\u65E0)*`,
      ``,
      `## \u5DF2\u5F52\u6863 (Archived)`,
      `<!-- \u5DF2\u5B8C\u6210\u5BF9\u8D26\u6838\u9500\u7684\u5386\u53F2\u8BB0\u5F55 -->`,
      archived.length > 0 ? archived.map(renderEntry).join("\n\n") : `*(\u6682\u65E0)*`,
      ``
    ].join("\n");
    fs.writeFileSync(this.mdPath, mdContent, "utf-8");
  }
  formatLens(lens) {
    switch (lens) {
      case "friction":
        return "\u7EC4\u7EC7\u963B\u529B (Friction)";
      case "necessity":
        return "\u529F\u80FD\u5FC5\u8981 (Necessity)";
      case "compliance":
        return "\u5408\u89C4\u7EA2\u7EBF (Compliance)";
    }
  }
  // 获取分类账目
  getDebts() {
    const data = this.loadData();
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const activePending = [];
    const overdue = [];
    let archivedCount = 0;
    for (const entry of data.entries) {
      if (entry.status === "resolved") {
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
  recordPrediction(params) {
    const data = this.loadData();
    const now = /* @__PURE__ */ new Date();
    const today = now.toISOString().split("T")[0];
    const endDate = new Date(now.getTime() + params.windowDays * 24 * 60 * 60 * 1e3);
    const windowEnd = endDate.toISOString().split("T")[0];
    const datePrefix = today.replace(/-/g, "");
    const todayEntries = data.entries.filter((e) => e.id.startsWith(datePrefix));
    const nextSeq = String(todayEntries.length + 1).padStart(2, "0");
    const id = `${datePrefix}-${nextSeq}`;
    const newEntry = {
      id,
      status: "pending",
      createdAt: now.toISOString(),
      target: params.target,
      lens: params.lens,
      prediction: params.prediction,
      windowEnd,
      failureCondition: params.failureCondition,
      triggerAction: params.triggerAction,
      resolution: "unverified",
      attribution: "none"
    };
    data.entries.push(newEntry);
    this.saveData(data);
    const verifiedData = this.loadData();
    const found = verifiedData.entries.find((e) => e.id === newEntry.id);
    if (!found || found.prediction !== newEntry.prediction) {
      throw new Error(`[\u53F0\u8D26\u5B8C\u6574\u6027\u9519\u8BEF] \u7559\u75D5\u8BB0\u5F55 ${newEntry.id} \u5199\u540E\u56DE\u8BFB\u6821\u9A8C\u5931\u8D25\uFF0C\u6570\u636E\u672A\u80FD\u6210\u529F\u843D\u76D8\uFF01`);
    }
    return newEntry;
  }
  // 核销旧账
  reconcileDebt(params) {
    const data = this.loadData();
    const targetEntry = data.entries.find((e) => e.id === params.id);
    if (!targetEntry) {
      throw new Error(`\u672A\u627E\u5230 ID \u4E3A ${params.id} \u7684\u7559\u75D5\u8BB0\u5F55`);
    }
    if (params.resolution === "external_disruption" && (!params.attribution || params.attribution.trim() === "none")) {
      throw new Error(`\u9009\u62E9\u201C\u5916\u90E8\u5E72\u6270\u201D\u65F6\u5FC5\u987B\u63D0\u4F9B\u5177\u4F53\u7684\u7A81\u53D1\u56E0\u679C\u963B\u65AD\u8BF4\u660E`);
    }
    if (targetEntry.status === "resolved") {
      if (!params.correctionReason || params.correctionReason.trim() === "") {
        throw new Error(
          `[\u9632\u7BE1\u6539\u62E6\u622A] \u7559\u75D5\u8BB0\u5F55 ${params.id} \u5DF2\u4E8E ${targetEntry.resolvedAt || "\u6B64\u524D"} \u6838\u9500\u7ED3\u6848\u4E3A\u3010${targetEntry.resolution}\u3011\u3002\u7981\u6B62\u76F4\u63A5\u9759\u9ED8\u8986\u76D6\u51C6\u786E\u7387\uFF01\u82E5\u786E\u7CFB\u4E8B\u5B9E\u66F4\u6B63\uFF0C\u5FC5\u987B\u63D0\u4F9B correctionReason (\u66F4\u6B63\u5F52\u56E0\u7406\u7531) \u4EE5\u4FDD\u7559\u5BA1\u8BA1\u7559\u75D5\u3002`
        );
      }
      if (!targetEntry.auditLog) {
        targetEntry.auditLog = [];
      }
      targetEntry.auditLog.push({
        previousResolution: targetEntry.resolution,
        newResolution: params.resolution,
        changedAt: (/* @__PURE__ */ new Date()).toISOString(),
        reason: params.correctionReason.trim()
      });
    }
    targetEntry.status = "resolved";
    targetEntry.resolution = params.resolution;
    targetEntry.attribution = params.attribution || targetEntry.attribution || "none";
    targetEntry.resolvedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.saveData(data);
    const verifiedData = this.loadData();
    const found = verifiedData.entries.find((e) => e.id === params.id);
    if (!found || found.resolution !== params.resolution) {
      throw new Error(`[\u53F0\u8D26\u5B8C\u6574\u6027\u9519\u8BEF] \u7559\u75D5\u8BB0\u5F55 ${params.id} \u6838\u9500\u5199\u540E\u56DE\u8BFB\u6821\u9A8C\u5931\u8D25\uFF01`);
    }
    return targetEntry;
  }
  // 计算严密的看板统计指标
  getStats() {
    const data = this.loadData();
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    let activePending = 0;
    let overdue = 0;
    let archived = 0;
    let verified = 0;
    let falsified = 0;
    let insufficientSample = 0;
    let unimplemented = 0;
    let externalDisruption = 0;
    for (const e of data.entries) {
      if (e.status === "resolved") {
        archived++;
        if (e.resolution === "verified") verified++;
        else if (e.resolution === "falsified") falsified++;
        else if (e.resolution === "insufficient_sample") insufficientSample++;
        else if (e.resolution === "unimplemented") unimplemented++;
        else if (e.resolution === "external_disruption") externalDisruption++;
      } else if (e.windowEnd < today) {
        overdue++;
      } else {
        activePending++;
      }
    }
    const effectiveTotal = verified + falsified;
    const hitRate = effectiveTotal > 0 ? verified / effectiveTotal * 100 : null;
    const totalArchived = archived;
    const unimplementedRate = totalArchived > 0 ? unimplemented / totalArchived * 100 : 0;
    const externalDisruptionRate = totalArchived > 0 ? externalDisruption / totalArchived * 100 : 0;
    const insufficientSampleRate = totalArchived > 0 ? insufficientSample / totalArchived * 100 : 0;
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
      insufficientSampleRate
    };
  }
};

// src/scout.ts
var ProductScout = class {
  timeoutMs;
  constructor(timeoutMs = 15e3) {
    this.timeoutMs = timeoutMs;
  }
  /**
   * SSRF 防护校验：禁止访问私有内网、本地回环及云厂商元数据服务
   */
  validateUrlSecurity(url) {
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error(`\u5B89\u5168\u62E6\u622A\uFF1A\u4EC5\u652F\u6301 HTTP \u6216 HTTPS \u534F\u8BAE\u94FE\u63A5 (${url.protocol})`);
    }
    const hostname = url.hostname.toLowerCase();
    if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal") || hostname.endsWith(".lan") || hostname === "127.0.0.1" || hostname === "0.0.0.0" || hostname === "::1" || hostname === "[::1]") {
      throw new Error(`\u5B89\u5168\u62E6\u622A\uFF1A\u7981\u6B62\u8BBF\u95EE\u672C\u5730\u56DE\u73AF\u6216\u5C40\u57DF\u7F51\u5730\u5740 (${hostname})`);
    }
    if (hostname === "169.254.169.254" || hostname.startsWith("169.254.")) {
      throw new Error(`\u5B89\u5168\u62E6\u622A\uFF1A\u7981\u6B62\u8BBF\u95EE\u4E91\u5382\u5546\u5B9E\u4F8B\u5143\u6570\u636E\u5730\u5740 (${hostname})`);
    }
    const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4Match) {
      const octet1 = parseInt(ipv4Match[1], 10);
      const octet2 = parseInt(ipv4Match[2], 10);
      if (octet1 === 10) {
        throw new Error(`\u5B89\u5168\u62E6\u622A\uFF1A\u7981\u6B62\u8BBF\u95EE 10.0.0.0/8 \u79C1\u6709\u5185\u7F51\u7F51\u6BB5 (${hostname})`);
      }
      if (octet1 === 127) {
        throw new Error(`\u5B89\u5168\u62E6\u622A\uFF1A\u7981\u6B62\u8BBF\u95EE 127.0.0.0/8 \u56DE\u73AF\u7F51\u6BB5 (${hostname})`);
      }
      if (octet1 === 172 && octet2 >= 16 && octet2 <= 31) {
        throw new Error(`\u5B89\u5168\u62E6\u622A\uFF1A\u7981\u6B62\u8BBF\u95EE 172.16.0.0/12 \u79C1\u6709\u5185\u7F51\u7F51\u6BB5 (${hostname})`);
      }
      if (octet1 === 192 && octet2 === 168) {
        throw new Error(`\u5B89\u5168\u62E6\u622A\uFF1A\u7981\u6B62\u8BBF\u95EE 192.168.0.0/16 \u79C1\u6709\u5C40\u57DF\u7F51\u7F51\u6BB5 (${hostname})`);
      }
      if (octet1 === 100 && octet2 >= 64 && octet2 <= 127) {
        throw new Error(`\u5B89\u5168\u62E6\u622A\uFF1A\u7981\u6B62\u8BBF\u95EE 100.64.0.0/10 \u8FD0\u8425\u5546\u7EA7\u5185\u7F51\u7F51\u6BB5 (${hostname})`);
      }
      if (octet1 === 0) {
        throw new Error(`\u5B89\u5168\u62E6\u622A\uFF1A\u7981\u6B62\u8BBF\u95EE 0.0.0.0/8 \u7279\u6B8A\u7F51\u6BB5 (${hostname})`);
      }
    }
    if (hostname.startsWith("[fc") || hostname.startsWith("[fd") || hostname.startsWith("[fe8") || hostname.startsWith("[fe9") || hostname.startsWith("[fea") || hostname.startsWith("[feb")) {
      throw new Error(`\u5B89\u5168\u62E6\u622A\uFF1A\u7981\u6B62\u8BBF\u95EE IPv6 \u79C1\u6709\u6216\u94FE\u8DEF\u672C\u5730\u5730\u5740 (${hostname})`);
    }
  }
  /**
   * 嗅探并提取指定产品/竞品网页的核心内容与结构化 Markdown
   * 策略：默认优先原生直连提取 (100% 独立、无依赖、防封锁)，若配置了 JINA_API_KEY 则走增强通道
   */
  async scoutUrl(targetUrl) {
    let validUrl;
    try {
      validUrl = new URL(targetUrl);
    } catch {
      throw new Error(`\u65E0\u6548\u7684 URL \u683C\u5F0F: ${targetUrl}`);
    }
    this.validateUrlSecurity(validUrl);
    try {
      return await this.scoutDirect(validUrl.toString());
    } catch (directErr) {
      if (process.env.JINA_API_KEY) {
        return await this.scoutViaJina(validUrl.toString());
      }
      throw new Error(`\u60C5\u62A5\u55C5\u63A2\u5931\u8D25: ${directErr.message || String(directErr)}`);
    }
  }
  /**
   * 原生独立抓取：标准 HTTP fetch + 智能 HTML 去噪蒸馏 (毫秒级、0 外部依赖)
   */
  async scoutDirect(url) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      const html = await response.text();
      return this.distillHtml(url, html);
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") {
        throw new Error(`\u8BF7\u6C42\u8D85\u65F6 (${this.timeoutMs / 1e3} \u79D2)`);
      }
      throw err;
    }
  }
  /**
   * HTML 智能去噪与 Markdown 提炼引擎
   */
  distillHtml(url, html) {
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? this.cleanHtmlEntities(titleMatch[1].trim()) : "\u672A\u547D\u540D\u4EA7\u54C1\u9875\u9762";
    let body = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "").replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "").replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, "").replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, "").replace(/<!--[\s\S]*?-->/g, "");
    const mainMatch = body.match(/<(main|article)\b[^>]*>([\s\S]*?)<\/\1>/i);
    if (mainMatch) {
      body = mainMatch[2];
    } else {
      const bodyMatch = body.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
      if (bodyMatch) {
        body = bodyMatch[1];
      }
    }
    let md = body.replace(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi, "\n\n# $1\n\n").replace(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi, "\n\n## $1\n\n").replace(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi, "\n\n### $1\n\n").replace(/<h4\b[^>]*>([\s\S]*?)<\/h4>/gi, "\n\n#### $1\n\n").replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, "\n- $1").replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, "\n\n$1\n\n").replace(/<br\s*[\/]?>/gi, "\n").replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)").replace(/<[^>]+>/g, " ");
    md = this.cleanHtmlEntities(md);
    md = md.replace(/[ \t]+/g, " ").replace(/\n\s*\n\s*\n/g, "\n\n").trim();
    const MAX_CHARS = 1e4;
    if (md.length > MAX_CHARS) {
      md = md.slice(0, MAX_CHARS) + `

*(\u5185\u5BB9\u8FC7\u957F\uFF0C\u5DF2\u622A\u53D6\u524D ${MAX_CHARS} \u5B57\u7B26\u6838\u5FC3\u6B63\u6587)*`;
    }
    return {
      url,
      title,
      content: md,
      charCount: md.length,
      extractedAt: (/* @__PURE__ */ new Date()).toISOString(),
      method: "native-distill"
    };
  }
  cleanHtmlEntities(text) {
    return text.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&copy;/g, "\xA9");
  }
  /**
   * 云端 Reader 备用通道 (支持 JINA_API_KEY)
   */
  async scoutViaJina(url) {
    const jinaUrl = `https://r.jina.ai/${url}`;
    const headers = {
      "User-Agent": "DialecticScout/4.0"
    };
    if (process.env.JINA_API_KEY) {
      headers["Authorization"] = `Bearer ${process.env.JINA_API_KEY}`;
    }
    const response = await fetch(jinaUrl, { headers });
    if (!response.ok) {
      throw new Error(`\u4E91\u7AEF Reader \u5F02\u5E38: HTTP ${response.status}`);
    }
    const text = await response.text();
    return {
      url,
      title: "\u4E91\u7AEF\u84B8\u998F\u60C5\u62A5",
      content: text.slice(0, 1e4),
      charCount: text.length,
      extractedAt: (/* @__PURE__ */ new Date()).toISOString(),
      method: "cloud-reader"
    };
  }
};

// src/server.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
function createMcpServer(customDir) {
  const store = new LedgerStore(customDir);
  const server = new Server(
    {
      name: "dialectic-mcp",
      version: "4.0.1"
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "dialectic_check_debts",
          description: "\u3010Step 0 \u5FC5\u5907\u3011\u542F\u52A8\u5BA1\u67E5\u524D\u5FC5\u987B\u8C03\u7528\u3002\u81EA\u52A8\u6392\u67E5\u672C\u5730\u8D26\u672C\u4E2D\u7684\u5F85\u89C2\u5BDF\u9884\u6D4B\u4E0E\u903E\u671F\u672A\u7ED3\u6848\u574F\u8D26\uFF0C\u675C\u7EDD\u7B97\u9519\u65F6\u949F\u4E0E\u8D26\u76EE\u63A9\u76D6\u3002",
          inputSchema: {
            type: "object",
            properties: {}
          }
        },
        {
          name: "dialectic_record_prediction",
          description: "\u5BA1\u67E5\u5B8C\u6210\u540E\u8C03\u7528\u3002\u5728\u672C\u5730\u8D26\u672C\u4E2D\u5B89\u5168\u5199\u5165\u4E00\u6761\u5177\u5907\u53EF\u68C0\u9A8C\u6027\u7684\u5B9E\u6218\u7559\u75D5\u6869\uFF0C\u81EA\u52A8\u751F\u6210 ID \u4E0E\u65F6\u95F4\u6233\uFF0C\u5E76\u540C\u6B65 Markdown \u8D26\u672C\u3002",
          inputSchema: {
            type: "object",
            properties: {
              target: {
                type: "string",
                description: "\u5BA1\u67E5\u5BF9\u8C61 (\u65B9\u6848\u6216\u529F\u80FD\u540D\u79F0)"
              },
              lens: {
                type: "string",
                enum: ["friction", "necessity", "compliance"],
                description: "\u5BA1\u67E5\u900F\u955C\uFF1Afriction (\u7EC4\u7EC7\u963B\u529B) \uFF5C necessity (\u529F\u80FD\u5FC5\u8981) \uFF5C compliance (\u5408\u89C4\u7EA2\u7EBF)"
              },
              prediction: {
                type: "string",
                description: "\u6838\u5FC3\u9884\u6D4B\uFF1A\u82E5 [\u4E0D\u505A\u67D0\u4E8B / \u5F3A\u63A8\u67D0\u4E8B]\uFF0C\u5728\u89C2\u5BDF\u671F\u5185\u5FC5\u7136\u51FA\u73B0 [\u5BA2\u89C2\u6307\u6807]"
              },
              windowDays: {
                type: "number",
                description: "\u89C2\u5BDF\u7A97\u53E3\u5929\u6570 (\u5982 14, 30, 60 \u5929\uFF0C\u6839\u636E\u4E1A\u52A1\u5468\u671F\u5B9A\uFF0C\u7981\u6B62\u76F2\u76EE\u586B\u5929\u6570)"
              },
              failureCondition: {
                type: "string",
                description: "\u8F93\u8D62\u8FB9\u754C\uFF1A\u51FA\u73B0\u4EC0\u4E48\u5177\u4F53\u53CD\u4F8B\u8BC1\u660E\u672C\u6B21\u5BA1\u67E5\u5224\u65AD\u5931\u8BEF"
              },
              triggerAction: {
                type: "string",
                description: "\u89E6\u53D1\u52A8\u4F5C\uFF1A\u82E5\u9884\u6D4B\u547D\u4E2D\uFF0C\u4E0B\u4E00\u6B65\u56E2\u961F\u5177\u4F53\u6267\u884C\u4EC0\u4E48\u8C03\u6574\u52A8\u4F5C"
              }
            },
            required: ["target", "lens", "prediction", "windowDays", "failureCondition", "triggerAction"]
          }
        },
        {
          name: "dialectic_reconcile_debt",
          description: "\u6838\u9500\u7ED3\u6848\u67D0\u6761\u5DF2\u5230\u671F\u7684\u5386\u53F2\u7559\u75D5\u3002\u5C06\u8BB0\u5F55\u539F\u5B50\u5316\u79FB\u5165\u5DF2\u5F52\u6863\u533A\uFF0C\u4FDD\u8BC1\u5BF9\u8D26\u95ED\u73AF\u81EA\u6D3D\u3002",
          inputSchema: {
            type: "object",
            properties: {
              id: {
                type: "string",
                description: "\u5F85\u6838\u9500\u7684\u7559\u75D5\u8BB0\u5F55 ID (\u5982 20260924-01)"
              },
              resolution: {
                type: "string",
                enum: ["verified", "falsified", "insufficient_sample", "unimplemented", "external_disruption"],
                description: "\u6838\u9500\u7ED3\u679C\uFF1Averified (\u9A8C\u8BC1\u547D\u4E2D) \uFF5C falsified (\u9884\u6D4B\u5931\u8BEF) \uFF5C insufficient_sample (\u6837\u672C\u4E0D\u8DB3) \uFF5C unimplemented (\u65B9\u6848\u672A\u6267\u884C) \uFF5C external_disruption (\u5916\u90E8\u5E72\u6270)"
              },
              attribution: {
                type: "string",
                description: "\u5F52\u56E0\u8BF4\u660E (\u9009\u62E9 external_disruption \u5916\u90E8\u5E72\u6270\u65F6\u5FC5\u987B\u8BE6\u7EC6\u4E3E\u8BC1\u7A81\u53D1\u56E0\u679C)"
              },
              correctionReason: {
                type: "string",
                description: "\u66F4\u6B63\u5F52\u56E0\u7406\u7531 (\u82E5\u8BE5\u7559\u75D5\u6B64\u524D\u5DF2\u5B8C\u6210\u6838\u9500\u7ED3\u6848\uFF0C\u4E8C\u6B21\u53D8\u66F4\u5FC5\u987B\u63D0\u4F9B\u66F4\u6B63\u539F\u56E0\u4EE5\u4F9B\u5BA1\u8BA1\u7559\u75D5\uFF0C\u4E25\u7981\u9759\u9ED8\u7BE1\u6539\u6218\u7EE9)"
              }
            },
            required: ["id", "resolution"]
          }
        },
        {
          name: "dialectic_get_stats",
          description: "\u83B7\u53D6\u5F53\u524D\u53F0\u8D26\u7684\u5386\u53F2\u9884\u6D4B\u6218\u7EE9\u3001\u6709\u6548\u547D\u4E2D\u7387\u53CA\u5206\u9879\u6307\u6807\u7EDF\u8BA1\u3002",
          inputSchema: {
            type: "object",
            properties: {}
          }
        },
        {
          name: "dialectic_scout_product",
          description: "\u3010\u7ADE\u54C1\u4E0E\u5E02\u573A\u60C5\u62A5\u55C5\u63A2\u3011\u8F93\u5165\u4EA7\u54C1\u5B98\u7F51\u3001\u7ADE\u54C1\u529F\u80FD\u9875\u6216\u4EA7\u54C1\u6587\u7AE0\u94FE\u63A5\uFF0C\u96F6\u5185\u5B58\u6D88\u8017\u63D0\u53D6\u9AD8\u7EAF\u5EA6 Markdown \u6B63\u6587\u4E0E\u6838\u5FC3\u4EA7\u54C1\u4E8B\u5B9E\u3002",
          inputSchema: {
            type: "object",
            properties: {
              url: {
                type: "string",
                description: "\u76EE\u6807\u4EA7\u54C1/\u7ADE\u54C1\u7F51\u9875\u94FE\u63A5 (\u5982 https://example.com)"
              }
            },
            required: ["url"]
          }
        }
      ]
    };
  });
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      if (name === "dialectic_check_debts") {
        const debts = store.getDebts();
        const stats = store.getStats();
        let message = `[Step 0 \u8D26\u672C\u67E5\u9A8C\u5B8C\u6210]`;
        if (debts.overdue.length > 0) {
          message += `
\u26A0\uFE0F \u3010\u903E\u671F\u574F\u8D26\u8B66\u793A\u3011\u68C0\u6D4B\u5230 ${debts.overdue.length} \u9879\u5386\u53F2\u7559\u75D5\u5DF2\u8FC7\u89C2\u5BDF\u671F\u672A\u7ED3\u6848\uFF01\u8BF7\u5728\u672C\u6B21\u5BA1\u67E5\u524D\u4F18\u5148\u4E0E\u7528\u6237\u5BF9\u8D26\u6838\u9500\uFF0C\u6216\u5728\u5BA1\u67E5\u7ED3\u679C\u9876\u90E8\u516C\u5F00\u5C55\u793A\u503A\u52A1\u6807\u8BB0\u3002`;
        } else {
          message += `
\u2705 \u5F53\u524D\u65E0\u903E\u671F\u574F\u8D26\u3002`;
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  message,
                  overdueCount: debts.overdue.length,
                  overdueItems: debts.overdue,
                  activePendingCount: debts.activePending.length,
                  activePendingItems: debts.activePending,
                  archivedCount: debts.archivedCount,
                  stats
                },
                null,
                2
              )
            }
          ]
        };
      }
      if (name === "dialectic_record_prediction") {
        const schema = z.object({
          target: z.string().min(1),
          lens: z.enum(["friction", "necessity", "compliance"]),
          prediction: z.string().min(1),
          windowDays: z.number().int().positive(),
          failureCondition: z.string().min(1),
          triggerAction: z.string().min(1)
        });
        const parsed = schema.parse(args);
        const record = store.recordPrediction(parsed);
        const debts = store.getDebts();
        return {
          content: [
            {
              type: "text",
              text: `[Step 0 \u7559\u75D5\u6869\u5DF2\u5B89\u5168\u5199\u5165] ID: ${record.id}\uFF0C\u89C2\u5BDF\u671F\u622A\u6B62: ${record.windowEnd}
\u5F53\u524D\u72B6\u6001: \u6B63\u5E38\u89C2\u5BDF\u4E2D ${debts.activePending.length} \u6761, \u26A0\uFE0F \u903E\u671F\u672A\u5BF9\u8D26 ${debts.overdue.length} \u6761, \u5DF2\u5F52\u6863 ${debts.archivedCount} \u6761
(\u5DF2\u540C\u6B65\u5199\u5165 ~/.dialectic/ledger.md)`
            }
          ]
        };
      }
      if (name === "dialectic_reconcile_debt") {
        const schema = z.object({
          id: z.string().min(1),
          resolution: z.enum(["verified", "falsified", "insufficient_sample", "unimplemented", "external_disruption"]),
          attribution: z.string().optional(),
          correctionReason: z.string().optional()
        });
        const parsed = schema.parse(args);
        const reconciled = store.reconcileDebt(parsed);
        return {
          content: [
            {
              type: "text",
              text: `[\u5BF9\u8D26\u6838\u9500\u6210\u529F] \u8BB0\u5F55 ${reconciled.id} \u5DF2\u6838\u9500\u4E3A\u3010${reconciled.resolution}\u3011\u5E76\u79FB\u5165 ## \u5DF2\u5F52\u6863 \u5206\u533A\u3002`
            }
          ]
        };
      }
      if (name === "dialectic_get_stats") {
        const stats = store.getStats();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(stats, null, 2)
            }
          ]
        };
      }
      if (name === "dialectic_scout_product") {
        const schema = z.object({
          url: z.string().url()
        });
        const parsed = schema.parse(args);
        const scout = new ProductScout();
        const result = await scout.scoutUrl(parsed.url);
        return {
          content: [
            {
              type: "text",
              text: `# \u{1F50D} \u7ADE\u54C1\u60C5\u62A5: ${result.title}
- \u6765\u6E90: ${result.url}
- \u5B57\u7B26\u6570: ${result.charCount}
- \u55C5\u63A2\u65F6\u95F4: ${result.extractedAt}

---

${result.content}`
            }
          ]
        };
      }
      throw new Error(`\u672A\u77E5\u7684\u5DE5\u5177: ${name}`);
    } catch (err) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `[Dialectic \u5F15\u64CE\u9519\u8BEF] ${err.message || String(err)}`
          }
        ]
      };
    }
  });
  return { server, store };
}
async function runMcpServer() {
  const { server } = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

export {
  LedgerStore,
  ProductScout,
  createMcpServer,
  runMcpServer
};
