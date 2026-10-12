<p align="center">
  <h1 align="center">🛡️ 驳真 · Dialectic</h1>
  <p align="center">
    <b>30 秒替你找破绽，30 天陪你见真章。</b><br/>
    <sub>在拍板“做不做”前做一次极限压力测试，到期后让时间裁决输赢。</sub>
  </p>
  <p align="center">
    <img src="https://img.shields.io/badge/version-4.0.1-black?style=flat-square" alt="v4.0.1">
    <img src="https://img.shields.io/badge/mcp-supported-brightgreen?style=flat-square" alt="MCP Supported">
    <img src="https://img.shields.io/badge/prompt-~2.4k%20tokens-blue?style=flat-square" alt="~2.4k tokens">
    <img src="https://img.shields.io/badge/tests-27%2F27%20passed-success?style=flat-square" alt="27/27 Tests Passed">
    <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="MIT">
  </p>
  <p align="center">
    <img src="assets/banner.jpg" alt="Dialectic Banner" width="100%">
  </p>
</p>

---

## 🇨🇳 中文版

### 1. 是什么？

**驳真 (Dialectic) 是一个专为你挑方案死穴的“AI 挑刺合伙人”。**

就像苹果在产品立项时反复推敲“这个东西到底该不该存在”一样——驳真在你在写下第一行代码、投入研发资源之前，对你的方案做一次**极限压力测试**。

- **拒绝无脑捧场**：主流的大模型几乎全是“奉承大师”，无论你说什么都回答“太棒了”；驳真不当应声虫，它会像挑剔的设计评审一样，直接指出你的方案最薄弱的死穴。
- **好方案大方放行**：对低成本、高确定性的好方案直接放行 (`PASS`)，绝不为了显摆深刻而无病呻吟。
- **否定必给生路**：如果否定你的方案，必须给出一个仅需 1/10 成本试水的备选方案，绝不只挑刺不给解法。
- **立字据对赌验证**：随手回复一句“打个赌 7天”，AI 就会立下预测契约；观察期结束后，一起回头看看当初究竟谁被时间打脸。

---

### 2. 使用场景是什么？

它只帮你回答一个最昂贵的问题：**“这个需求/功能，到底做不做？”**

| 场景 | 典型困境 | 驳真能帮你做什么 |
|---|---|---|
| 🛠️ **独立开发防自嗨** | 突然冒出个点子想做个复杂功能（如打卡积分系统） | 30 秒泼冷水，深扒竞品真实差评，测出是不是伪需求，省下两周无效编码。 |
| 🏢 **方案上会与跨部门评审** | 方案要推给领导或跨部门评审，心里没底 | 站在利益受损者视角刁钻推演：“动了谁的奶酪”、“出事谁背锅”，备齐所有应对退路。 |
| 🧪 **全新概念无先例探索** | 全新交互或创意，市面上缺乏现成数据参考 | 启动【创新沙盒】，不因缺乏数据一棍子打死，给出 1/10 成本的最小验证闭环。 |

> ⚠️ **严禁使用场景（自动退出）**：常规文档审校、找错别字、代码审查 (Code Review)、写具体代码。遇到这些直接退出，按普通助理干活。

---

### 3. 怎么安装与使用？

#### 方式 A：零代码开箱即用（极力推荐 · 适合所有人）
**不需要装任何环境，10 秒搞定：**
1. 打开本仓库的 [`SKILL.md`](SKILL.md)，复制全部文本；
2. 粘贴到你的 **Cursor Rules**、**Claude Project**、**ChatGPT 自定义指令** 或 **Antigravity 技能库** 中；
3. 平时像说话一样提问（例如：*“我想在小工具里加个每日打卡功能提高日活，帮我做个方案压力测试”*），立刻开始审查！

#### 方式 B：本地极客 & MCP 增强（全自动记账与战绩看板）
如果你想体验本地自动排查逾期坏账、自动落盘防篡改台账与命令行看板：

```bash
# 1. 克隆并编译
git clone https://github.com/shahuichao24-ops/Dialectic-skill.git
cd Dialectic-skill && npm install && npm run build

# 2. 常用命令
node ./dist/cli.js init            # 自动为当前项目生成 Cursor MCP 配置
node ./dist/cli.js board --card    # 查看 AI 预测命中率与对决看板
node ./dist/cli.js dossier <ID>    # 导出单页【方案压力测试备忘录】(可直接贴入 PRD 决策章节)
node ./dist/cli.js scout <URL>     # 嗅探竞品网页核心正文 (内置 SSRF 内网安全隔离)
```

---

## 🇬🇧 English Version

### 1. What is it?

**Dialectic is an adversarial "Idea Challenger" AI designed to stress-test your product decisions.**

Just like Steve Jobs challenging every feature with *"Why does this matter?"* — Dialectic puts your proposals through an uncompromising **stress test** before you write a single line of code or burn engineering hours.

- **No Sycophantic Flattery**: Mainstream LLMs are echo chambers that praise every idea. Dialectic refuses to be a yes-man; it acts like a rigorous design reviewer, exposing the fatal blind spots in your plan.
- **Clear Approval for Good Ideas**: Approves low-cost, high-conviction ideas with an immediate `PASS`. No bikeshedding just to look smart.
- **Mandatory Fallback**: Every rejection must come with a 1/10-cost low-risk alternative. Never just a "no" without a way forward.
- **Accountable Bets**: Simply reply *"bet 7 days"*, and Dialectic logs a falsifiable prediction into your local ledger. When the window ends, see whether the AI or your intuition was right.

---

### 2. When to use it?

Dialectic focuses strictly on the single most expensive question in product building: **"Should we build this, or not?"**

| Scenario | Pain Point | How Dialectic Helps |
|---|---|---|
| 🛠️ **Solo Indie Hackers** | Falling in love with vanity features (e.g., daily check-in points). | 30-second cold-water test. Digs into competitor user complaints to prevent weeks of wasted coding. |
| 🏢 **B2B Product Reviews** | Unsure if a proposal will survive stakeholder meetings. | Stresses "Friction" (who bears the burden?) and "Compliance" (who takes the blame?), preparing solid defenses. |
| 🧪 **Zero-to-One Concepts** | Brand-new interactions with zero market data available. | Activates the "Innovation Sandbox" to design a 1/10-cost experiment without prematurely killing innovation. |

> ⚠️ **Out of Scope (Auto-Exit)**: Proofreading, Code Review, bug fixing, or writing implementation code. The framework exits immediately to standard assistant mode.

---

### 3. How to install & use?

#### Method A: Zero-Code Prompt (Recommended for Everyone)
**No installation needed. Ready in 10 seconds:**
1. Copy the full content of [`SKILL.md`](SKILL.md);
2. Paste it into your **Cursor Rules**, **Claude Project Instructions**, **ChatGPT Custom Instructions**, or **Antigravity Skills**;
3. Ask your idea naturally (e.g., *"I want to add a daily streak system to my desktop tool, stress-test it for me"*).

#### Method B: Local CLI & MCP Engine (Automated Ledger & Dashboards)
For local deterministic tracking, tamper-proof state machines, and terminal dashboards:

```bash
# 1. Clone & Build
git clone https://github.com/shahuichao24-ops/Dialectic-skill.git
cd Dialectic-skill && npm install && npm run build

# 2. CLI Commands
node ./dist/cli.js init            # Generate Cursor MCP configuration
node ./dist/cli.js board --card    # View hit-rate battle cards
node ./dist/cli.js dossier <ID>    # Export a 1-page Stress-Test Memo (pasteable into PRDs)
node ./dist/cli.js scout <URL>     # Extract competitor facts (with SSRF security)
```

---

## 📄 License
MIT © 2026 [shahuichao](https://github.com/shahuichao24-ops)
