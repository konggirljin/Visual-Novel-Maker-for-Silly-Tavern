/**
 * 发布目标的纯逻辑：只处理用户在本次界面明确选择的目标，绝不根据旧配置猜测。
 */
export function getOutputEntryPosition() {
  return { type: 'at_depth', role: 'system', depth: 1, order: 100 };
}

export function getAssetEntryPosition() {
  return { type: 'at_depth', role: 'system', depth: 1, order: 101 };
}

const PROJECT_EXPORT_FORMAT = '文游制作器项目';

export function buildProjectExport(project) {
  return JSON.stringify(
    {
      format: PROJECT_EXPORT_FORMAT,
      version: 1,
      project,
    },
    null,
    2,
  );
}

export function parseProjectImport(text) {
  let parsed;
  try {
    parsed = JSON.parse(String(text));
  } catch {
    throw new Error('导入文件不是有效的 JSON。');
  }
  const project = parsed?.format === PROJECT_EXPORT_FORMAT ? parsed.project : parsed;
  if (!project || Array.isArray(project) || typeof project !== 'object' || typeof project.项目名称 !== 'string') {
    throw new Error('导入文件不是文游制作器项目。');
  }
  return project;
}

export function resolveEntryTarget(entries, target) {
  if (target.mode === 'skip') return { mode: 'skip' };
  if (target.mode === 'new') return { mode: 'new' };
  if (!Number.isInteger(target.uid)) throw new Error('请选择要覆盖的世界书条目。');
  if (!entries.some(entry => entry.uid === target.uid)) {
    throw new Error(`所选世界书条目 UID ${target.uid} 不存在；请刷新后重新选择。`);
  }
  return { mode: 'replace', uid: target.uid };
}

export function resolveRegexTarget(regexes, scope, target) {
  if (target.mode === 'new') return { mode: 'new' };
  if (!target.id) throw new Error('请选择要更新的 Regex。');
  if (!regexes.some(regex => regex.id === target.id && regex.scope === scope)) {
    throw new Error('所选 Regex 不在当前范围内；请刷新后重新选择。');
  }
  return { mode: 'replace', id: target.id };
}

export function isHttpImageUrl(value) {
  return /^https?:\/\/[^\s]+$/i.test(String(value).trim());
}

function normalizeImageKey(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_\-\u4e00-\u9fff]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function trimPastedUrl(value) {
  return String(value).replace(/[),.;!?\]}]+$/g, '');
}

export function parseImageUrls(text) {
  const uniqueUrls = new Set();
  const candidates = String(text).match(/https?:\/\/[^\s<>"'`]+/gi) || [];
  for (const candidate of candidates) {
    const url = trimPastedUrl(candidate);
    if (!isHttpImageUrl(url)) continue;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue;
      uniqueUrls.add(url);
    } catch {
      // 粘贴框中的普通文本不应阻止其他合法 URL 导入。
    }
  }
  return [...uniqueUrls];
}

export function suggestImageKey(url) {
  try {
    const parsed = new URL(String(url));
    const filename = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).at(-1) || '');
    const nameWithoutExtension = filename.replace(/\.[a-z0-9]{2,5}$/i, '');
    return normalizeImageKey(nameWithoutExtension) || 'image';
  } catch {
    return 'image';
  }
}

export function makeUniqueImageKey(baseKey, usedKeys) {
  const used = usedKeys instanceof Set ? usedKeys : new Set(usedKeys || []);
  const normalized = normalizeImageKey(baseKey) || 'image';
  let candidate = normalized;
  let suffix = 1;
  while (used.has(candidate)) candidate = `${normalized}${suffix++}`;
  return candidate;
}

export function mergeResourceGroupNames({ savedNames, resources, field }) {
  const names = [];
  for (const value of [...(savedNames || []), ...(resources || []).map(resource => resource?.[field])]) {
    const name = String(value || '').trim();
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

export function shouldCloseDialogFromBackdrop(pointerDownTarget, clickTarget, backdrop) {
  return pointerDownTarget === backdrop && clickTarget === backdrop;
}

export function stripCharacterFallbackDefaults(template) {
  return template.replace(
    /const CHARACTER_FALLBACK_DEFAULTS = \{[\s\S]*?\};/,
    'const CHARACTER_FALLBACK_DEFAULTS = {};',
  );
}

export function stripLegacyGalAssets(template) {
  return stripCharacterFallbackDefaults(template).replace(
    /const ASSETS = \{[\s\S]*?\};\n\/\*\*\n \* Resolves a keyword or raw URL to a full URL\./,
    'const ASSETS = {\n    characters: {},\n    backgrounds: {},\n    bgm: {}\n};\n/**\n * Resolves a keyword or raw URL to a full URL.',
  );
}

export function injectGalAssets(template, injection) {
  return template.replace(
    /const ASSETS = \{[\s\S]*?\n\};\n\/\*\*\n \* Resolves a keyword or raw URL to a full URL\./,
    `const ASSETS = { characters: {}, backgrounds: {}, bgm: {} };${injection}\n/**\n * Resolves a keyword or raw URL to a full URL.`,
  );
}

export function buildGalAssetLibrary({ characters, backgrounds, bgm = [] }) {
  const characterGroups = new Map();
  const ungroupedCharacters = [];
  for (const character of characters) {
    const name = String(character.characterName || '').trim();
    if (!name) {
      ungroupedCharacters.push(character.key);
      continue;
    }
    characterGroups.set(name, [...(characterGroups.get(name) || []), character.key]);
  }
  const characterLines = [
    ...[...characterGroups.entries()].map(([name, keys]) => `- ${name}可用key：${keys.join('、')}`),
    ...ungroupedCharacters.map(key => `- ${key}`),
  ].join('\n') || '- 无';

  const backgroundGroups = new Map();
  const ungroupedBackgrounds = [];
  for (const background of backgrounds) {
    if (!background.sceneName) {
      ungroupedBackgrounds.push(background.key);
      continue;
    }
    backgroundGroups.set(background.sceneName, [...(backgroundGroups.get(background.sceneName) || []), background.key]);
  }
  const backgroundLines = [
    ...[...backgroundGroups.entries()].map(([name, keys]) => `- ${name}：${keys.join('、')}`),
    ...ungroupedBackgrounds.map(key => `- ${key}`),
  ].join('\n') || '- 无';

  const bgmLines = bgm.map(item => item.key).join(', ') || '无';
  return `<gal_asset_library>\n<sprites>\n${characterLines}\n</sprites>\n<bg>\n${backgroundLines}\n</bg>\n<bgm>\n${bgmLines}\n</bgm>\n</gal_asset_library>`;
}

function replaceTemplatePart(template, source, replacement, name) {
  if (!template.includes(source)) throw new Error(`模板缺少${name}，无法注入文游制作器设置。`);
  return template.replace(source, replacement);
}

function injectPlayerSettingsResetControls(template) {
  let published = replaceTemplatePart(
    template,
    `                    <div class="settings-item"><label for="hide-status-info-toggle">隐藏时间地点</label><input id="hide-status-info-toggle" type="checkbox"></div>\n                </div>`,
    `                    <div class="settings-item"><label for="hide-status-info-toggle">隐藏时间地点</label><input id="hide-status-info-toggle" type="checkbox"></div>\n                    <div class="theme-slider-nav"><button id="display-reset-btn">恢复默认</button></div>\n                </div>`,
    '显示恢复默认按钮位置',
  );
  published = replaceTemplatePart(
    published,
    `                    <div class="settings-item"><label>移动背景</label><input id="background-position-slider" type="range" min="0" max="100" value="50"></div>\n                </div>`,
    `                    <div class="settings-item"><label>移动背景</label><input id="background-position-slider" type="range" min="0" max="100" value="50"></div>\n                    <div class="theme-slider-nav"><button id="sprite-reset-btn">恢复默认</button></div>\n                </div>`,
    '立绘恢复默认按钮位置',
  );
  published = replaceTemplatePart(
    published,
    `const themeResetBtn = document.getElementById('theme-reset-btn');`,
    `const themeResetBtn = document.getElementById('theme-reset-btn');\n    const displayResetBtn = document.getElementById('display-reset-btn');\n    const spriteResetBtn = document.getElementById('sprite-reset-btn');`,
    '恢复默认按钮引用位置',
  );
  published = replaceTemplatePart(
    published,
    `    window.playSfx =`,
    `    settingsManager.resetKeys = (keys) => {\n        keys.forEach(key => { settingsManager.settings[key] = settingsManager.defaults[key]; });\n        settingsManager.applyAll(); settingsManager.save();\n    };\n\n    window.playSfx =`,
    '恢复默认函数位置',
  );
  return replaceTemplatePart(
    published,
    `    themeResetBtn.addEventListener('click', () => settingsManager.resetTheme());`,
    `    themeResetBtn.addEventListener('click', () => settingsManager.resetTheme());\n    displayResetBtn?.addEventListener('click', () => settingsManager.resetKeys(['fontSize', 'uiScale', 'panelScale', 'hideUi', 'hideStatusInfo']));\n    spriteResetBtn?.addEventListener('click', () => settingsManager.resetKeys(['globalSpriteScale', 'spriteOffsetLeft', 'spriteOffsetCenter', 'spriteOffsetRight', 'backgroundPositionX']));`,
    '恢复默认按钮事件位置',
  );
}

export function buildGalRegexReplaceString(template, { characters, backgrounds, bgm = {}, characterFallbacks = {}, interface: settings, settingsKey }) {
  const playerDefaults = {
    fontSize: 20, uiScale: 1, panelScale: 1, hideUi: false, hideStatusInfo: false,
    globalSpriteScale: 1, spriteOffsetLeft: -10, spriteOffsetCenter: -50, spriteOffsetRight: -10, backgroundPositionX: 50,
    ...(settings.玩家默认设置 || {}),
  };
  const themeDefaults = {
    dialogueBgHex: settings.对话框背景,
    mainTextColor: settings.文字颜色,
    nameTagText: settings.名字颜色,
    choiceBtnBg: settings.选项背景,
    choiceBtnText: settings.选项文字,
    mainBorderColor: settings.边框颜色,
    choiceBtnBorder: settings.边框颜色,
    ...playerDefaults,
  };
  const fontPresets = {
    'SqrPond 16x16': { url: 'https://fontsapi.zeoseven.com/2376/main/result.css', family: 'SqrPond 16x16' },
    'Huiwen-mincho': { url: 'https://fontsapi.zeoseven.com/256/main/result.css', family: 'Huiwen-mincho' },
    'JiangChengHeiTi 400W': { url: 'https://fontsapi.zeoseven.com/194/main/result.css', family: 'JiangChengHeiTi 400W' },
    'LXGW ZhenKai GB': { url: 'https://fontsapi.zeoseven.com/2/main/result.css', family: 'LXGW ZhenKai GB' },
  };
  const selectedFont = fontPresets[settings.界面字体];
  const fontStyle = selectedFont
    ? `\n@import url('${selectedFont.url}');\nbody, .game-wrapper, .game-wrapper * { font-family: "${selectedFont.family}", sans-serif !important; }\n`
    : '';
  const 注入数据 = JSON.stringify({ characters, backgrounds, bgm, characterFallbacks, buttons: settings, themeDefaults, settingsKey }, null, 2);
  const injection = `
const GAL制作器资源 = ${注入数据};
const GAL制作器主题默认值 = GAL制作器资源.themeDefaults;
Object.assign(ASSETS.characters, GAL制作器资源.characters);
Object.assign(ASSETS.backgrounds, GAL制作器资源.backgrounds);
Object.assign(ASSETS.bgm, GAL制作器资源.bgm);

const GAL制作器读取网址 = (value) => {
  const text = String(value || '').trim();
  const markdown = text.match(/^\\[[^\\]]*\\]\\((https?:\\/\\/[^)]+)\\)$/i);
  return markdown ? markdown[1] : text;
};

const GAL制作器按钮配置 = [
  ['#fullscreen-icon', '全屏按钮', '全屏按钮颜色'],
  ['#settings-btn .toolbar-glyph-symbol', '设置按钮', '设置按钮颜色'],
  ['#history-btn .toolbar-glyph-symbol', '历史按钮', '历史按钮颜色'],
  ['#status-icon', '状态按钮', '状态按钮颜色'],
  ['#phone-btn .toolbar-glyph-symbol', '手机按钮', '手机按钮颜色'],
  ['#bgm-toggle-icon', '播放暂停按钮', '播放暂停按钮颜色'],
];

GAL制作器按钮配置.forEach(([selector, imageKey, colorKey]) => {
  const icon = document.querySelector(selector);
  if (!icon) return;

  icon.style.setProperty('color', GAL制作器资源.buttons[colorKey] || '#ffffff', 'important');
  const url = GAL制作器读取网址(GAL制作器资源.buttons[imageKey]);
  if (!url) return;

  if (icon instanceof HTMLImageElement) {
    icon.src = url;
    return;
  }

  const image = document.createElement('img');
  image.className = 'icon-img';
  image.src = url;
  image.alt = imageKey;
  image.id = icon.id;
  icon.replaceWith(image);
});
`;
  const safeSettingsKey = String(settingsKey || 'pixelGameSettings_v4').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  let published = injectGalAssets(template, injection);
  if (fontStyle) published = published.replace('<style>', `<style>${fontStyle}`);
  published = published.replace(
    'const CHARACTER_FALLBACK_DEFAULTS = {};',
    'const CHARACTER_FALLBACK_DEFAULTS = GAL制作器资源.characterFallbacks || {};',
  );
  published = published.replace(
    'if (normalized.includes(needle)) {',
    "if (String(trimmed).toLowerCase().includes(String(needle).toLowerCase()) || (normalizeAssetKey(needle) && normalized.includes(normalizeAssetKey(needle)))) {",
  );
  published = published.replace(
    /const settingsManager = \{\n\s*key: 'pixelGameSettings_v4',\n\s*defaults: \{/, 
    `const settingsManager = {\n        key: '${safeSettingsKey}',\n        defaults: {`,
  );
  published = published.replace(
    /(modalBodyText: '#000000')\n\s*},\n\s*settings: \{\},/,
    '$1,\n        ...GAL制作器主题默认值,\n        },\n        settings: {},',
  );
  published = published.replace(
    'this.settings = { ...this.defaults, ...storedSettings };',
    'this.settings = { ...this.defaults, ...(storedSettings?.overrides || storedSettings) };',
  );
  published = published.replace(
    "save() { localStorage.setItem(this.key, JSON.stringify(this.settings)); },",
    "save() { const overrides = Object.fromEntries(Object.entries(this.settings).filter(([key, value]) => value !== this.defaults[key])); localStorage.setItem(this.key, JSON.stringify({ version: 2, overrides })); },",
  );
  return injectPlayerSettingsResetControls(published);
}

export function findPublishedRegex(regexes, id) {
  return regexes.find(regex => regex.id === id);
}

export function getSelectedRegexName(regexes, id, fallbackName) {
  return findPublishedRegex(regexes, id)?.script_name || fallbackName;
}
