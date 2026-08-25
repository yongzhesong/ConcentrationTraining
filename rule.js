(function (global) {
  'use strict';

  // ============================================================
  // 1. 颜色池：12 种高区分度颜色
  //    说明：采用 HSL 色彩空间，色相按 30° 等间隔分布，
  //    配以不同的亮度/饱和度，确保任意两色色相差≥30°，
  //    不会出现视觉相似的颜色。
  //    每条颜色记录包含：英文名（key）、中文名、HSL 值、标准 HEX 值
  // ============================================================
  const COLOR_POOL = [
    { key: 'scarlet',    name: '猩红色',   hsl: 'hsl(0,   85%, 50%)',  hex: '#E50000' },
    { key: 'tangerine',  name: '橘红色',   hsl: 'hsl(30,  90%, 52%)',  hex: '#F2810F' },
    { key: 'canary',     name: '金丝雀黄', hsl: 'hsl(60,  95%, 55%)',  hex: '#F5DE23' },
    { key: 'lime',       name: '青柠色',   hsl: 'hsl(90,  80%, 50%)',  hex: '#8ED610' },
    { key: 'forest',     name: '森林绿',   hsl: 'hsl(120, 70%, 38%)',  hex: '#1D911D' },
    { key: 'mint',       name: '薄荷绿',   hsl: 'hsl(150, 70%, 60%)',  hex: '#5DDD9C' },
    { key: 'teal',       name: '蓝绿色',   hsl: 'hsl(180, 75%, 42%)',  hex: '#1BAEAE' },
    { key: 'azure',      name: '天蓝色',   hsl: 'hsl(210, 90%, 55%)',  hex: '#3A95F5' },
    { key: 'royal',      name: '宝蓝色',   hsl: 'hsl(240, 85%, 55%)',  hex: '#3D3DF7' },
    { key: 'violet',     name: '紫罗兰',   hsl: 'hsl(270, 75%, 55%)',  hex: '#9B40F2' },
    { key: 'fuchsia',    name: '品红色',   hsl: 'hsl(300, 85%, 52%)',  hex: '#E01BE0' },
    { key: 'rose',       name: '玫瑰红',   hsl: 'hsl(330, 85%, 58%)',  hex: '#F2468F' }
  ];

  // ============================================================
  // 2. 操作类型定义
  // ============================================================
  const ACTION_TYPES = [
    {
      key: 'click',
      name: '单击',
      textTemplate: '{color}灯亮起，则点一下熄灭'
    },
    {
      key: 'doubleClick',
      name: '双击',
      textTemplate: '{color}灯亮起则点两下熄灭'
    },
    {
      key: 'longPress',
      name: '长按',
      textTemplate: '{color}灯亮起，长按0.5秒熄灭'
    }
  ];

  // ============================================================
  // 3. 工具函数
  // ============================================================

  /**
   * 从数组中随机抽取 n 个不重复元素（Fisher-Yates 部分洗牌）
   * @param {Array} arr
   * @param {number} n
   * @returns {Array}
   */
  function sampleUnique(arr, n) {
    if (n > arr.length) throw new Error('sampleUnique: n 大于数组长度');
    const copy = arr.slice();
    for (let i = 0; i < n; i++) {
      const j = i + Math.floor(Math.random() * (copy.length - i));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, n);
  }

  /**
   * 对颜色池按色相（HSL 中的 H 值）排序，便于抽取「相似但有区分度」的操作色
   * @param {Array} colors
   * @returns {Array} 按色相升序排列的颜色数组
   */
  function sortByHue(colors) {
    return colors.slice().sort((a, b) => {
      const ha = parseFloat(a.hsl.match(/hsl\((\d+)/)[1]);
      const hb = parseFloat(b.hsl.match(/hsl\((\d+)/)[1]);
      return ha - hb;
    });
  }

  /**
   * 从颜色池中抽取 n 种「操作色」：
   *   策略——在色相环上选取一个随机起点，然后按等间隔抽取 n 种颜色，
   *   使得它们之间既相似（色相集中在某一段）又保持足够区分度（有最小间隔）。
   * @param {number} n 2 或 3
   * @returns {Array} 选中的颜色对象数组
   */
  function pickOperationColors(n) {
    const sorted = sortByHue(COLOR_POOL);
    const total = sorted.length;

    // 每种操作色之间至少相差这么多颜色索引（色相差≥60°，确保高区分度）
    const minStep = 2;
    // 生成所有合法的 n 元索引组合
    const combos = [];
    (function pick(startIdx, picked) {
      if (picked.length === n) {
        combos.push(picked.slice());
        return;
      }
      for (let i = startIdx; i < total; i++) {
        if (picked.length && i - picked[picked.length - 1] < minStep) continue;
        picked.push(i);
        pick(i + 1, picked);
        picked.pop();
      }
    })(0, []);

    // 但需求是「操作色相似但有区分度」，所以我们倾向于选择色相集中的组合
    // 这里改为：随机选一个起始位置，然后在其后 n*minStep 范围内选择 n 个
    const start = Math.floor(Math.random() * (total - (n - 1) * minStep));
    const result = [];
    for (let i = 0; i < n; i++) {
      const idx = start + i * minStep + (i === 0 ? 0 : Math.floor(Math.random() * (minStep)));
      result.push(sorted[Math.min(idx, total - 1 - (n - 1 - i) * minStep)]);
    }
    // 打乱顺序，避免每次都按色相排列
    return result.sort(() => Math.random() - 0.5);
  }

  // ============================================================
  // 4. 规则生成主函数
  // ============================================================

  /**
   * 生成一轮游戏的完整规则
   * @returns {{
   *   operationLights: Array<{
   *     colorKey: string,
   *     colorName: string,
   *     hsl: string,
   *     hex: string,
   *     action: 'click'|'doubleClick'|'longPress',
   *     actionName: string
   *   }>,
   *   distractionColors: Array<{
   *     colorKey: string,
   *     colorName: string,
   *     hsl: string,
   *     hex: string
   *   }>,
   *   ruleText: string,   // 符合格式的中文规则描述
   *   roundId: string     // 规则唯一 ID，用于调试
   * }}
   */
  function generateRoundRule() {
    // 步骤 1：随机决定本轮操作灯数量 n = 2 或 3
    const operationCount = Math.random() < 0.5 ? 2 : 3;

    // 步骤 2：抽取 n 种操作色（相似但有区分度）
    const selectedOpColors = pickOperationColors(operationCount);

    // 步骤 3：为每种操作色分配不同的操作类型（随机排列操作类型后取前 n 个）
    const shuffledActions = sampleUnique(ACTION_TYPES, operationCount);

    const operationLights = selectedOpColors.map((color, i) => ({
      colorKey: color.key,
      colorName: color.name,
      hsl: color.hsl,
      hex: color.hex,
      action: shuffledActions[i].key,
      actionName: shuffledActions[i].name
    }));

    // 步骤 4：其余颜色作为干扰灯颜色池
    const opColorKeys = new Set(selectedOpColors.map(c => c.key));
    const distractionColors = COLOR_POOL
      .filter(c => !opColorKeys.has(c.key))
      .map(c => ({
        colorKey: c.key,
        colorName: c.name,
        hsl: c.hsl,
        hex: c.hex
      }));

    // 步骤 5：生成规则文本（严格遵循用户给出的格式）
    //   格式：
    //     "本轮游戏中会出现 n 种颜色，分别为 x色，y色，z色。
    //      X色灯亮起，则点一下熄灭，Y色灯亮起，长按0.5秒熄灭，Z色灯亮起则点两下熄灭。"
    const colorListStr = operationLights.map(o => o.colorName).join('，');
    let actionTextList = operationLights.map(o => {
      const tpl = ACTION_TYPES.find(a => a.key === o.action).textTemplate;
      return tpl.replace('{color}', o.colorName);
    });

    // 规则格式微调：第一句用句号分隔灯列表，然后每个操作说明用逗号分隔（参考用户示例）
    const ruleText =
      '本轮游戏中会出现' +
      operationCount +
      '种颜色，分别为' +
      colorListStr +
      '。' +
      actionTextList.join('，') +
      '。';

    return {
      roundId: 'R' + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36),
      operationLights,
      distractionColors,
      ruleText
    };
  }

  // ============================================================
  // 5. 对外导出
  // ============================================================
  const RuleEngine = {
    /** 颜色池（只读） */
    get COLOR_POOL() { return COLOR_POOL.slice(); },
    /** 操作类型（只读） */
    get ACTION_TYPES() { return ACTION_TYPES.slice(); },
    /** 生成一轮规则 */
    generateRoundRule,
    /** 工具函数：从数组中随机抽 n 个不重复元素 */
    sampleUnique
  };

  // 兼容浏览器 & Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RuleEngine;
  } else {
    global.RuleEngine = RuleEngine;
  }
})(typeof window !== 'undefined' ? window : globalThis);

