import 原GAL模板文本 from './gal界面v3_1（空白素材模板）.json?raw';
import {
  getAssetEntryPosition,
  getOutputEntryPosition,
  getSelectedRegexName,
  buildGalAssetLibrary,
  buildGalRegexReplaceString,
  buildProjectExport,
  isHttpImageUrl,
  makeUniqueImageKey,
  mergeResourceGroupNames,
  parseImageUrls,
  parseProjectImport,
  resolveEntryTarget,
  resolveRegexTarget,
  suggestImageKey,
  shouldCloseDialogFromBackdrop,
} from './release-targets.mjs';

type 素材类型 = '角色立绘' | '背景';
type 素材 = { id: string; 类型: 素材类型; 角色名称?: string; 场景名称?: string; key: string; url: string };
type 音乐资源 = { id: string; key: string; urls: string[] };
type 角色名称纠错 = { id: string; 默认立绘: string; 别名: string[] };
type 素材分组 = { id: string; 类型: 素材类型; 名称: string };
type 批量素材预览 = { id: string; url: string; key: string; 已存在: boolean };
type 玩家默认设置 = {
  fontSize: number;
  uiScale: number;
  panelScale: number;
  hideUi: boolean;
  hideStatusInfo: boolean;
  globalSpriteScale: number;
  spriteOffsetLeft: number;
  spriteOffsetCenter: number;
  spriteOffsetRight: number;
  backgroundPositionX: number;
};
type 界面设置 = {
  界面字体: string;
  对话框背景: string;
  文字颜色: string;
  名字颜色: string;
  选项背景: string;
  选项文字: string;
  边框颜色: string;
  全屏按钮: string;
  全屏按钮颜色: string;
  设置按钮: string;
  设置按钮颜色: string;
  历史按钮: string;
  历史按钮颜色: string;
  状态按钮: string;
  状态按钮颜色: string;
  手机按钮: string;
  手机按钮颜色: string;
  播放暂停按钮: string;
  播放暂停按钮颜色: string;
  玩家默认设置: 玩家默认设置;
};
type 发布草稿 = {
  世界书选择?: string;
  新世界书名?: string;
  素材条目选择?: string;
  输出条目选择?: string;
  正则范围?: 'character' | 'global';
  正则操作?: 'new' | 'replace';
  regexId?: string;
  正则名?: string;
};
type 配置 = {
  项目id: string;
  项目名称: string;
  世界书名: string;
  正则名: string;
  正则范围: 'character' | 'global';
  素材条目uid?: number;
  输出条目uid?: number;
  regexId?: string;
  世界书条目选择?: Record<string, { 素材条目uid?: number; 输出条目uid?: number }>;
  上次更新正则?: Partial<Record<'character' | 'global', string>>;
  上次发布正则?: Partial<Record<'character' | 'global', string>>;
  发布草稿?: 发布草稿;
  素材: 素材[];
  分组: 素材分组[];
  音乐: 音乐资源[];
  角色名称纠错: 角色名称纠错[];
  界面: 界面设置;
};
type 项目存档 = { 当前项目id: string; 项目列表: 配置[] };

const 配置键 = 'gal制作器';
const 标记 = '文游制作器';
const 默认玩家默认设置: 玩家默认设置 = {
  fontSize: 20,
  uiScale: 1,
  panelScale: 1,
  hideUi: false,
  hideStatusInfo: false,
  globalSpriteScale: 1,
  spriteOffsetLeft: -10,
  spriteOffsetCenter: -50,
  spriteOffsetRight: -10,
  backgroundPositionX: 50,
};
const 默认界面: 界面设置 = {
  界面字体: '原模板默认字体',
  对话框背景: '#171717',
  文字颜色: '#ffffff',
  名字颜色: '#f0c76b',
  选项背景: '#ffffff',
  选项文字: '#1d1d1d',
  边框颜色: '#1d1d1d',
  全屏按钮: '',
  全屏按钮颜色: '#ffffff',
  设置按钮: '',
  设置按钮颜色: '#ffffff',
  历史按钮: '',
  历史按钮颜色: '#ffffff',
  状态按钮: '',
  状态按钮颜色: '#ffffff',
  手机按钮: '',
  手机按钮颜色: '#ffffff',
  播放暂停按钮: '',
  播放暂停按钮颜色: '#ffffff',
  玩家默认设置: { ...默认玩家默认设置 },
};
const 默认配置 = (项目名称 = '我的第一个文游'): 配置 => ({
  项目id: crypto.randomUUID?.() || `项目_${Date.now()}`,
  项目名称,
  世界书名: '我的文游素材库',
  正则名: '我的文游界面',
  正则范围: 'character',
  素材: [],
  分组: [],
  音乐: [],
  角色名称纠错: [],
  界面: { ...默认界面 },
});

let 配置数据: 配置;
let 项目列表: 配置[] = [];
let 当前项目id = '';
let 当前类型: 素材类型 = '角色立绘';
let 编辑素材id: string | null = null;
let 遮罩按下目标: EventTarget | null = null;
let 素材输入模式: 'single' | 'batch' | 'group' = 'single';
let 当前角色筛选 = '__全部__';
let 批量导入类型: 素材类型 | null = null;
let 批量素材预览列表: 批量素材预览[] = [];
let 批量分类名称 = '';
let 批量粘贴文本 = '';

function 读取配置(): 配置 {
  const 已存 = getVariables({ type: 'script' })[配置键] as Partial<项目存档 & 配置> | undefined;
  const 标准化 = (原配置: Partial<配置>): 配置 => {
    const 素材 = Array.isArray(原配置.素材)
        ? 原配置.素材.map((素材: any) => ({
            ...素材,
            角色名称: 素材.角色名称 || (素材.类型 === '角色立绘' ? 素材.名称 || '' : ''),
            场景名称: 素材.场景名称 || (素材.类型 === '背景' ? 素材.名称 || '' : ''),
          }))
        : [],
      分组 = Array.isArray(原配置.分组)
        ? 原配置.分组
            .filter(
              (分组: any) =>
                分组 && (分组.类型 === '角色立绘' || 分组.类型 === '背景') && String(分组.名称 || '').trim(),
            )
            .map((分组: any) => ({ id: 分组.id || 新素材id(), 类型: 分组.类型, 名称: String(分组.名称).trim() }))
        : [];
    const 音乐 = Array.isArray(原配置.音乐)
      ? 原配置.音乐
          .map((项: any) => ({
            id: 项.id || 新素材id(),
            key: String(项.key || 项.使用场景 || '').trim(),
            urls: Array.isArray(项.urls) ? 项.urls.map(String).filter((url: string) => /^https?:\/\//i.test(url)) : [],
          }))
          .filter((项: 音乐资源) => 项.key && 项.urls.length)
      : [];
    const 角色名称纠错 = Array.isArray(原配置.角色名称纠错)
      ? 原配置.角色名称纠错
          .map((项: any) => ({
            id: 项.id || 新素材id(),
            默认立绘: String(项.默认立绘 || '').trim(),
            别名: Array.isArray(项.别名)
              ? 项.别名
                  .map(String)
                  .map((名: string) => 名.trim())
                  .filter(Boolean)
              : [],
          }))
          .filter((项: 角色名称纠错) => 项.默认立绘 && 项.别名.length)
      : [];
    for (const 类型 of ['角色立绘', '背景'] as 素材类型[]) {
      const 字段 = 类型 === '角色立绘' ? '角色名称' : '场景名称';
      for (const 名称 of mergeResourceGroupNames({
        resources: 素材.filter(项 => 项.类型 === 类型),
        savedNames: [],
        field: 字段,
      })) {
        if (!分组.some(项 => 项.类型 === 类型 && 项.名称 === 名称)) 分组.push({ id: 新素材id(), 类型, 名称 });
      }
    }
    return {
      ...默认配置(原配置.项目名称 || '我的第一个文游'),
      ...原配置,
      项目id: 原配置.项目id || crypto.randomUUID?.() || `项目_${Date.now()}`,
      素材,
      分组,
      音乐,
      角色名称纠错,
      界面: {
        ...(Object.fromEntries(
          Object.entries({ ...默认界面, ...原配置.界面 }).map(([key, value]) => [
            key,
            typeof value === 'string' && /^#[0-9a-f]{8}$/i.test(value) ? value.slice(0, 7) : value,
          ]),
        ) as 界面设置),
        玩家默认设置: { ...默认玩家默认设置, ...(原配置.界面?.玩家默认设置 || {}) },
      },
    };
  };
  项目列表 = Array.isArray(已存?.项目列表) ? 已存!.项目列表.map(标准化) : [标准化(已存 || {})];
  当前项目id = 已存?.当前项目id || 项目列表[0].项目id;
  return 项目列表.find(项目 => 项目.项目id === 当前项目id) || 项目列表[0];
}
function 保存配置() {
  const 索引 = 项目列表.findIndex(项目 => 项目.项目id === 配置数据.项目id);
  if (索引 >= 0) 项目列表[索引] = 配置数据;
  else 项目列表.push(配置数据);
  当前项目id = 配置数据.项目id;
  replaceVariables(
    { ...getVariables({ type: 'script' }), [配置键]: { 当前项目id, 项目列表 } satisfies 项目存档 },
    { type: 'script' },
  );
}
function 标准化导入项目(原项目: Record<string, any>): 配置 {
  const 默认值 = 默认配置(String(原项目.项目名称 || '导入的文游项目'));
  return {
    ...默认值,
    ...原项目,
    项目id: 默认值.项目id,
    项目名称: String(原项目.项目名称 || 默认值.项目名称),
    素材: Array.isArray(原项目.素材) ? 原项目.素材 : [],
    分组: Array.isArray(原项目.分组) ? 原项目.分组 : [],
    音乐: Array.isArray(原项目.音乐) ? 原项目.音乐 : [],
    角色名称纠错: Array.isArray(原项目.角色名称纠错) ? 原项目.角色名称纠错 : [],
    界面: {
      ...默认界面,
      ...(原项目.界面 && typeof 原项目.界面 === 'object' ? 原项目.界面 : {}),
      玩家默认设置: { ...默认玩家默认设置, ...(原项目.界面?.玩家默认设置 || {}) },
    },
  } as 配置;
}
function 导出当前项目() {
  const 文件内容 = buildProjectExport(配置数据);
  const 文件 = new Blob([文件内容], { type: 'application/json;charset=utf-8' });
  const 页面 = window.parent;
  const 地址 = 页面.URL.createObjectURL(文件);
  const 下载 = 页面.document.createElement('a');
  const 名称 = String(配置数据.项目名称 || '文游项目').replace(/[\\/:*?"<>|]/g, '_');
  下载.href = 地址;
  下载.download = `文游制作器项目-${名称}.json`;
  下载.click();
  setTimeout(() => 页面.URL.revokeObjectURL(地址), 0);
  toastr.success('项目已导出。');
}
async function 导入项目文件(文件: File) {
  const 原项目 = parseProjectImport(await 文件.text()) as Record<string, any>;
  配置数据 = 标准化导入项目(原项目);
  项目列表.push(配置数据);
  保存配置();
  toastr.success(`已导入并切换到：${配置数据.项目名称}`);
  渲染项目页();
}
function 转义文字(文字: string) {
  return $('<div>').text(文字).html();
}
function 转义属性(文字: string) {
  return 转义文字(文字).replace(/"/g, '&quot;');
}
function 规范化网址(文字: string) {
  const 原文 = String(文字 || '').trim();
  const Markdown = 原文.match(/^\[[^\]]*\]\((https?:\/\/[^)]+)\)$/i);
  return Markdown ? Markdown[1] : 原文;
}
function 生成key(文字: string) {
  return (
    文字
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_\-\u4e00-\u9fff]+/g, '_')
      .replace(/^_+|_+$/g, '') || `素材_${Date.now().toString(36)}`
  );
}
function 唯一key(key: string, 排除id?: string) {
  const 已用 = new Set(配置数据.素材.filter(素材 => 素材.id !== 排除id).map(素材 => 素材.key));
  return makeUniqueImageKey(key, 已用);
}
function 获取素材(类型: 素材类型) {
  return 配置数据.素材.filter(素材 => 素材.类型 === 类型);
}
function 获取分组(类型: 素材类型) {
  const 字段 = 类型 === '角色立绘' ? '角色名称' : '场景名称';
  return mergeResourceGroupNames({
    savedNames: 配置数据.分组.filter(分组 => 分组.类型 === 类型).map(分组 => 分组.名称),
    resources: 获取素材(类型),
    field: 字段,
  });
}

function 安装样式() {
  $('#gal制作器样式').remove();
  $('head').append(`<style id="gal制作器样式">
    #gal制作器遮罩{position:fixed;inset:0;z-index:10051;background:rgba(20,28,45,.28);display:none;align-items:center;justify-content:center;overflow:auto;padding:18px;color:#273043;backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}
    #gal制作器窗口{width:min(940px,calc(100vw - 36px));max-height:calc(100dvh - 36px);margin:auto;overflow:auto;background:#f7f9fc;border:1px solid #d9e0eb;border-top:4px solid #5366a5;border-radius:16px;box-shadow:0 24px 70px rgba(36,48,77,.22);font:14px/1.55 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif}
    #gal制作器窗口 *{box-sizing:border-box}.gal头部{display:flex;justify-content:space-between;align-items:center;padding:20px 26px;border-bottom:1px solid #e3e8f0}.gal头部 h2{margin:0;font-size:21px;font-weight:800;letter-spacing:.01em;color:#202b43}.gal关闭{border:1px solid #d9e0eb;border-radius:10px;background:#f8fafc;font-size:26px;cursor:pointer;color:#667085}.gal关闭:hover{color:#26386f;background:#eef2ff}
    .gal主体{padding:24px 26px}.gal导航{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px;padding:5px;border:1px solid #e0e6ef;border-radius:13px;background:#edf1f7}.gal导航 button,.gal按钮{border:1px solid #cbd4e2;border-radius:9px;background:#fff;padding:9px 13px;cursor:pointer;color:#42516b;font:inherit;transition:transform .15s ease,border-color .15s ease,background .15s ease}.gal导航 button:hover,.gal按钮:hover{border-color:#91a1cd;background:#f3f5ff}.gal导航 button:active,.gal按钮:active{transform:translateY(1px)}.gal导航 button.选中,.gal主按钮{background:#5366a5!important;color:#fff!important;border-color:#5366a5!important}.gal页面{display:none}.gal页面.显示{display:block}
    .gal网格{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;align-items:start}.gal卡片{padding:20px;background:#fff;border:1px solid #e0e6ef;border-radius:14px}.gal卡片 h3{margin:0 0 8px;font-size:17px;line-height:1.35;color:#273452}.gal字段{display:grid;gap:8px;margin:17px 0}.gal字段 label{font-size:15px;font-weight:700;line-height:1.45;color:#34415a}.gal字段 input,.gal字段 select,.gal字段 textarea{width:100%;min-height:40px;padding:9px 11px;border:1px solid #cfd8e6;border-radius:9px;background:#fbfcfe;color:#273043;font:14px/1.4 Arial,"Microsoft YaHei",sans-serif;box-shadow:inset 0 1px 1px rgba(37,53,82,.035);outline:none}.gal字段 textarea{min-height:136px;resize:vertical}.gal字段 input::placeholder,.gal字段 textarea::placeholder{color:#8a96a8}.gal字段 input:focus,.gal字段 select:focus,.gal字段 textarea:focus{border-color:#7082bd;box-shadow:0 0 0 3px rgba(83,102,165,.14)}.gal行{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.gal模式栏,.gal筛选栏{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0 0 16px}.gal筛选栏 label{font-size:14px;font-weight:700}.gal筛选栏 select{min-height:36px;padding:6px 9px;border:1px solid #cfd8e6;border-radius:9px;background:#fbfcfe;color:#273043;font:14px Arial,"Microsoft YaHei",sans-serif}.gal预览{display:none;width:100%;max-height:210px;object-fit:contain;background:#edf1f6;border:1px solid #d9e0eb;border-radius:8px;margin:14px 0}.gal提示{margin:0;color:#728096;font-size:13px;line-height:1.55}.gal错误,.gal必填{color:#c14d4d}.gal必填{font-weight:700}.gal素材库{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-top:18px}.gal素材{padding:10px;border:1px solid #e0e6ef;border-radius:11px;background:#fbfcfe}.gal素材 img{width:100%;height:130px;object-fit:contain;background:#edf1f6;border-radius:7px}.gal素材 strong,.gal素材 code{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gal素材 strong{margin-top:8px}.gal素材 code{color:#6375ad;font-size:12px;margin:3px 0 8px}.gal批量列表{display:grid;gap:10px;margin-top:16px}.gal批量项{display:grid;grid-template-columns:72px minmax(0,1fr);gap:10px;padding:10px;border:1px solid #e0e6ef;border-radius:11px;background:#fbfcfe}.gal批量项 img{width:72px;height:72px;object-fit:contain;background:#edf1f6;border-radius:7px}.gal批量项 code{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#728096;font-size:12px}.gal批量项 input{width:100%;min-height:36px;margin:6px 0;padding:7px 9px;border:1px solid #cfd8e6;border-radius:9px;font:14px Arial,"Microsoft YaHei",sans-serif}.gal状态提示{color:#c14d4d;font-size:12px}.gal底部{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:16px 26px;border-top:1px solid #e0e6ef}.gal颜色{height:40px;padding:3px!important}.gal隐藏{display:none!important}@media(max-width:650px){.gal网格{grid-template-columns:1fr}.gal主体{padding:18px}.gal头部{padding:16px 18px}.gal底部{padding:14px 18px;align-items:flex-start;flex-direction:column}.gal底部 .gal按钮{width:100%}.gal批量项{grid-template-columns:56px minmax(0,1fr)}.gal批量项 img{width:56px;height:56px}}
  </style>`);
}

function 安装界面() {
  $('#gal制作器遮罩').remove();
  $('body')
    .append(`<div id="gal制作器遮罩"><section id="gal制作器窗口" role="dialog" aria-modal="true" aria-label="文游制作器"><header class="gal头部"><div><h2>文游制作器</h2><div class="gal提示">素材只保存图片URL；请通过快速回复按钮打开本窗口。</div></div><button class="gal关闭" type="button" aria-label="关闭">×</button></header><div class="gal主体">
    <nav class="gal导航"><button data-页面="文游项目" type="button">文游项目</button><button data-页面="角色立绘" type="button">角色立绘</button><button data-页面="背景" type="button">背景</button><button data-页面="音乐" type="button">音乐</button><button data-页面="界面设置" type="button">进阶设置</button><button data-页面="发布" type="button">发布到酒馆</button></nav>
    <section class="gal页面" data-内容="文游项目"></section><section class="gal页面" data-内容="角色立绘"></section><section class="gal页面" data-内容="背景"></section><section class="gal页面" data-内容="音乐"></section><section class="gal页面" data-内容="界面设置"></section><section class="gal页面" data-内容="发布"></section>
  </div><footer class="gal底部" id="gal制作器底栏"></footer></section></div>`);
  (window as any).GAL制作器打开 = () => 打开页面('文游项目');
  (window as any).GAL制作器关闭 = () => 关闭界面();
  $('#gal制作器遮罩').on('pointerdown', 事件 => {
    遮罩按下目标 = 事件.target;
  });
  $('#gal制作器遮罩').on('click', 事件 => {
    if (shouldCloseDialogFromBackdrop(遮罩按下目标, 事件.target, 事件.currentTarget)) 关闭界面();
    遮罩按下目标 = null;
  });
  $('.gal关闭').on('click', 关闭界面);
  $('.gal导航').on('click', 'button', function () {
    打开页面(String($(this).data('页面')));
  });
  $(window.parent).off('resize.gal制作器').on('resize.gal制作器', 调整制作器弹窗);
}
function 调整制作器弹窗() {
  const 页面窗口 = window.parent;
  const 视图 = 页面窗口.visualViewport;
  const 宽度 = Math.round(视图?.width || 页面窗口.innerWidth);
  const 高度 = Math.round(视图?.height || 页面窗口.innerHeight);
  const 左侧 = Math.round(视图?.offsetLeft || 0);
  const 顶部 = Math.round(视图?.offsetTop || 0);
  $('#gal制作器遮罩').css({
    left: `${左侧}px`,
    top: `${顶部}px`,
    right: 'auto',
    bottom: 'auto',
    width: `${宽度}px`,
    height: `${高度}px`,
  });
  $('#gal制作器窗口').css({
    width: `${Math.max(280, Math.min(940, 宽度 - 36))}px`,
    maxHeight: `${Math.max(180, 高度 - 36)}px`,
  });
}
function 打开页面(页面: string) {
  调整制作器弹窗();
  $('#gal制作器遮罩').css('display', 'flex');
  $('.gal导航 button').toggleClass('选中', false);
  $(`.gal导航 button[data-页面="${页面}"]`).addClass('选中');
  $('.gal页面').removeClass('显示');
  $(`.gal页面[data-内容="${页面}"]`).addClass('显示');
  渲染底栏(页面);
  if (页面 === '角色立绘' || 页面 === '背景') 渲染素材页(页面);
  if (页面 === '音乐') 渲染音乐页();
  if (页面 === '文游项目') 渲染项目页();
  if (页面 === '界面设置') 渲染界面设置();
  if (页面 === '发布') 渲染发布页();
}
function 获取发布草稿(): 发布草稿 {
  return (配置数据.发布草稿 ||= {
    世界书选择: 配置数据.世界书名,
    新世界书名: 配置数据.世界书名,
    正则范围: 配置数据.正则范围,
    正则操作: 'new',
    正则名: 配置数据.正则名,
  });
}
function 保存发布草稿(更新: Partial<发布草稿>) {
  Object.assign(获取发布草稿(), 更新);
  保存配置();
}
function 渲染底栏(页面: string) {
  const 底栏 = $('#gal制作器底栏');
  if (页面 !== '发布') {
    底栏.empty();
    return;
  }
  底栏.html(
    `<span class="gal提示">当前角色立绘：${获取素材('角色立绘').length} 张　背景：${获取素材('背景').length} 张</span><button id="gal底栏同步" class="gal按钮 gal主按钮" type="button">同步到酒馆</button>`,
  );
  $('#gal底栏同步').on('click', 发布);
}
function 关闭界面() {
  $('#gal制作器遮罩').hide();
}

function 渲染项目页() {
  const 容器 = $('.gal页面[data-内容="文游项目"]');
  容器.html(
    `<div class="gal网格"><div class="gal卡片"><h3>新建文游项目</h3><div class="gal字段"><label><span class="gal必填">*</span> 项目名称</label><input id="gal新项目名称" placeholder="例如：罗马诺文游"></div><button id="gal新建项目" class="gal按钮 gal主按钮" type="button">新建并切换</button></div><div class="gal卡片"><h3>当前文游项目</h3><div class="gal字段"><label>切换项目</label><select id="gal项目选择">${项目列表.map(项目 => `<option value="${项目.项目id}" ${项目.项目id === 配置数据.项目id ? 'selected' : ''}>${转义文字(项目.项目名称)}</option>`).join('')}</select></div><p class="gal提示">项目分别保存素材、世界书条目UID、正则和进阶设置。不同角色卡的文游不会共用这些数据。</p><p class="gal提示">请点击酒馆脚本按钮中的“文游制作器”按钮打开本窗口。</p></div><div class="gal卡片"><h3>导入与导出项目</h3><p class="gal提示">导出会保存当前项目所有数据，包括素材、分组、音乐、进阶设置、发布记录及未来新增数据。导入会新建项目，不覆盖当前项目。</p><div class="gal行"><button id="gal导出项目" class="gal按钮 gal主按钮" type="button">导出项目</button><button id="gal导入项目" class="gal按钮" type="button">导入项目</button><input id="gal导入项目文件" class="gal隐藏" type="file" accept="application/json,.json"></div></div></div>`,
  );
  $('#gal项目选择').on('change', () => {
    const 项目 = 项目列表.find(项 => 项.项目id === String($('#gal项目选择').val()));
    if (!项目) return;
    配置数据 = 项目;
    保存配置();
    toastr.success(`已切换到：${项目.项目名称}`);
    渲染项目页();
  });
  $('#gal新建项目').on('click', () => {
    const 名称 = String($('#gal新项目名称').val() || '').trim();
    if (!名称) {
      toastr.error('请填写项目名称。');
      return;
    }
    配置数据 = 默认配置(名称);
    项目列表.push(配置数据);
    保存配置();
    toastr.success(`已新建：${名称}`);
    渲染项目页();
  });
  $('#gal导出项目').on('click', 导出当前项目);
  $('#gal导入项目').on('click', () => $('#gal导入项目文件').trigger('click'));
  $('#gal导入项目文件').on('change', async function () {
    const 文件 = (this as HTMLInputElement).files?.[0];
    if (!文件) return;
    try {
      await 导入项目文件(文件);
    } catch (错误) {
      toastr.error(错误 instanceof Error ? 错误.message : '导入项目失败。');
    } finally {
      $(this).val('');
    }
  });
}

function 新素材id() {
  return crypto.randomUUID?.() || `${Date.now()}_${Math.random()}`;
}
function 渲染素材页(类型: 素材类型) {
  当前类型 = 类型;
  if (批量导入类型 && 批量导入类型 !== 类型) {
    批量导入类型 = null;
    批量素材预览列表 = [];
    批量分类名称 = '';
    批量粘贴文本 = '';
    素材输入模式 = 'single';
  }
  const 容器 = $(`.gal页面[data-内容="${类型}"]`);
  容器.off('.gal素材');
  const 已编辑 = 编辑素材id ? 配置数据.素材.find(素材 => 素材.id === 编辑素材id) : undefined;
  const 全部列表 = 获取素材(类型);
  const 角色分组 = 获取分组(类型);
  if (
    类型 === '角色立绘' &&
    当前角色筛选 !== '__全部__' &&
    当前角色筛选 !== '__未分组__' &&
    !角色分组.includes(当前角色筛选)
  )
    当前角色筛选 = '__全部__';
  const 列表 =
    类型 === '角色立绘'
      ? 全部列表.filter(素材 => {
          const 角色名 = String(素材.角色名称 || '').trim();
          return 当前角色筛选 === '__全部__' || (当前角色筛选 === '__未分组__' ? !角色名 : 角色名 === 当前角色筛选);
        })
      : 全部列表;
  const 名称标签 =
    类型 === '角色立绘'
      ? '角色名称，e.g. 马特奥（可选）。系统将会以此名称作分组标准'
      : '场景分类，e.g. 室外/室内（可选）';
  const 名称 = 类型 === '角色立绘' ? 已编辑?.角色名称 : 已编辑?.场景名称;
  const 是批量模式 = 素材输入模式 === 'batch' && 批量导入类型 === 类型;
  const 是分组模式 = 素材输入模式 === 'group';
  const 角色分组建议 = 角色分组.map(名称 => `<option value="${转义属性(名称)}"></option>`).join('');
  const 分组建议列表 = `<datalist id="gal角色分组建议">${角色分组建议}</datalist>`;
  const 单个表单 = `<h3>${类型 === '角色立绘' ? '上传角色立绘' : '上传背景图片'}</h3><div class="gal字段"><label><span class="gal必填">*</span> 图片URL</label><input id="gal图片URL" placeholder="https://example.com/image.png" value="${转义属性(已编辑?.url || '')}"></div><img id="gal图片预览" class="gal预览" alt="图片预览"><div id="gal预览错误" class="gal提示 gal错误"></div><div class="gal字段"><label>${名称标签}</label><input id="gal素材名称" list="gal角色分组建议" placeholder="${类型 === '角色立绘' ? '例如：马特奥；留空为未分组' : '例如：室外；可留空'}" value="${转义属性(名称 || '')}"></div>${分组建议列表}<div class="gal字段"><label><span class="gal必填">*</span> ${类型 === '角色立绘' ? '供AI阅读的立绘资源名称。建议以角色名字+状态命名，例如 matteohappy' : '供AI阅读的背景资源名称，例如 street_day'}</label><input id="gal素材key" placeholder="${类型 === '角色立绘' ? '例如：matteohappy' : '例如：street_day'}" value="${转义属性(已编辑?.key || '')}"></div><div class="gal行"><button id="gal确认素材" class="gal按钮 gal主按钮" type="button">保存</button><button id="gal取消编辑" class="gal按钮" type="button">取消</button></div>`;
  const 批量表单 = `<h3>批量导入${类型 === '角色立绘' ? '角色立绘' : '背景图片'}</h3><p class="gal提示">可粘贴纯图片URL或 Markdown 链接。会自动读取文件名作为资源 key；确认前可逐项改名或移除。</p><div class="gal字段"><label>${类型 === '角色立绘' ? '角色名称（可选）' : '场景分类（可选）'}</label><input id="gal批量素材名称" list="gal角色分组建议" placeholder="${类型 === '角色立绘' ? '选择已有角色或输入新角色；留空为未分组' : '例如：室外；可留空'}" value="${转义属性(批量分类名称)}"></div>${分组建议列表}<div class="gal字段"><label><span class="gal必填">*</span> 图片URL列表</label><textarea id="gal批量URL" placeholder="https://i.postimg.cc/.../matteohappy.png&#10;[另一张图片](https://files.catbox.moe/example.webp)">${转义文字(批量粘贴文本)}</textarea></div><div class="gal行"><button id="gal解析批量URL" class="gal按钮 gal主按钮" type="button">解析并预览</button><button id="gal取消批量" class="gal按钮" type="button">返回单个上传</button></div>${批量素材预览列表.length ? `<div class="gal批量列表">${批量素材预览列表.map(素材 => `<article class="gal批量项"><img src="${转义属性(素材.url)}" alt="批量图片预览"><div><code title="${转义属性(素材.url)}">${转义文字(素材.url)}</code><input data-批量key="${素材.id}" value="${转义属性(素材.key)}" aria-label="资源 key">${素材.已存在 ? '<div class="gal状态提示">该URL已在此素材库，确认时会跳过。</div>' : ''}<button class="gal按钮" data-移除批量="${素材.id}" type="button">移除</button></div></article>`).join('')}</div><div class="gal行" style="margin-top:16px"><button id="gal确认批量导入" class="gal按钮 gal主按钮" type="button">确认导入 ${批量素材预览列表.length} 项</button></div>` : ''}`;
  const 筛选栏 =
    类型 === '角色立绘'
      ? `<div class="gal筛选栏"><label for="gal角色筛选">显示角色</label><select id="gal角色筛选"><option value="__全部__">全部角色</option><option value="__未分组__">未分组</option>${角色分组.map(名称 => `<option value="${转义属性(名称)}" ${名称 === 当前角色筛选 ? 'selected' : ''}>${转义文字(名称)}</option>`).join('')}</select></div>`
      : '';
  const 分组类型名称 = 类型 === '角色立绘' ? '角色' : '背景';
  const 分组表单 = `<h3>新增${类型 === '角色立绘' ? '角色分组' : '场景分类'}</h3><p class="gal提示">${类型 === '角色立绘' ? '新增角色分组后，世界书里会将同一个角色立绘分为一组，格式为「角色名称：立绘资源1、立绘资源名称2」，例如「马特奥可用key：马特奥高兴、马特奥伤心」。' : '新增场景分组后，世界书里会将同一类背景并列，格式为「场景分类：背景1、背景2」，例如「室外：球场、天台」。'}</p><div class="gal字段"><label><span class="gal必填">*</span> ${类型 === '角色立绘' ? '角色名称' : '场景分类名称'}</label><input id="gal新分组名称" placeholder="例如：${类型 === '角色立绘' ? '马特奥' : '室外'}"></div><div class="gal行"><button id="gal确认创建分组" class="gal按钮 gal主按钮" type="button">创建${分组类型名称}分组</button><button id="gal取消创建分组" class="gal按钮" type="button">返回上传</button></div>`;
  const 批量表单显示 = 批量表单.replace(
    '[另一张图片](https://files.catbox.moe/example.webp)',
    'https://example.com/matteosad.png',
  );
  const 分组表单显示 = 分组表单.replace('马特奥可用key：', '马特奥：');
  容器.html(
    `<div class="gal网格"><div class="gal卡片"><div class="gal模式栏"><button id="gal新增分组" class="gal按钮 ${是分组模式 ? 'gal主按钮' : ''}" type="button">新增${类型 === '角色立绘' ? '角色分组' : '场景分类'}</button><button id="gal单个上传" class="gal按钮 ${是批量模式 || 是分组模式 ? '' : 'gal主按钮'}" type="button">单个上传</button><button id="gal批量导入" class="gal按钮 ${是批量模式 ? 'gal主按钮' : ''}" type="button">批量导入</button></div>${是分组模式 ? 分组表单显示 : 是批量模式 ? 批量表单显示 : 单个表单}</div><div class="gal卡片"><h3>${类型}库（${列表.length}/${全部列表.length}）</h3>${筛选栏}<p class="gal提示">${类型 === '角色立绘' ? '角色按角色名称分组；留空的立绘归入未分组，并在世界书中逐行列出。' : '背景按场景分类分组，未分类背景单独列出。'}</p><div class="gal素材库">${
      列表.length
        ? 列表
            .map(素材 => {
              const 项名称 = 类型 === '角色立绘' ? 素材.角色名称 : 素材.场景名称;
              return `<article class="gal素材"><img src="${转义属性(素材.url)}" alt="${转义属性(项名称 || 素材.key)}"><strong title="${转义属性(项名称 || 素材.key)}">${转义文字(项名称 || 素材.key)}</strong><code>${转义文字(素材.key)}</code><div class="gal行"><button class="gal按钮" data-编辑="${素材.id}">编辑</button><button class="gal按钮" data-删除="${素材.id}">删除</button></div></article>`;
            })
            .join('')
        : '<p class="gal提示">还没有素材。</p>'
    }</div></div></div>`,
  );
  容器.find('#gal单个上传,#gal取消批量,#gal取消创建分组').on('click', () => {
    编辑素材id = null;
    素材输入模式 = 'single';
    批量导入类型 = null;
    批量素材预览列表 = [];
    批量分类名称 = '';
    批量粘贴文本 = '';
    渲染素材页(类型);
  });
  容器.find('#gal批量导入').on('click', () => {
    编辑素材id = null;
    素材输入模式 = 'batch';
    批量导入类型 = 类型;
    批量素材预览列表 = [];
    批量分类名称 = '';
    批量粘贴文本 = '';
    渲染素材页(类型);
  });
  容器.find('#gal新增分组').on('click', () => {
    素材输入模式 = 'group';
    批量导入类型 = null;
    批量素材预览列表 = [];
    渲染素材页(类型);
  });
  容器.find('#gal角色筛选').on('change', () => {
    当前角色筛选 = String(容器.find('#gal角色筛选').val() || '__全部__');
    渲染素材页(类型);
  });
  容器.find('#gal确认创建分组').on('click', () => {
    const 名称 = String(容器.find('#gal新分组名称').val() || '').trim();
    if (!名称) {
      toastr.error('请填写分组名称。');
      return;
    }
    if (获取分组(类型).includes(名称)) {
      toastr.error('这个分组已经存在。');
      return;
    }
    配置数据.分组.push({ id: 新素材id(), 类型, 名称 });
    保存配置();
    素材输入模式 = 'single';
    if (类型 === '角色立绘') 当前角色筛选 = 名称;
    toastr.success(`已创建${分组类型名称}分组：${名称}`);
    渲染素材页(类型);
  });
  容器.on('click.gal素材', '[data-编辑]', function () {
    编辑素材id = String($(this).data('编辑'));
    素材输入模式 = 'single';
    批量导入类型 = null;
    渲染素材页(类型);
  });
  容器.on('click.gal素材', '[data-删除]', function () {
    配置数据.素材 = 配置数据.素材.filter(素材 => 素材.id !== String($(this).data('删除')));
    保存配置();
    渲染素材页(类型);
  });
  if (是批量模式) {
    容器.find('#gal解析批量URL').on('click', () => {
      批量分类名称 = String(容器.find('#gal批量素材名称').val() || '').trim();
      批量粘贴文本 = String(容器.find('#gal批量URL').val() || '');
      const urls = parseImageUrls(批量粘贴文本);
      if (!urls.length) {
        toastr.error('没有找到可导入的 HTTP/HTTPS 图片URL。');
        return;
      }
      const 已用key = new Set(配置数据.素材.map(素材 => 素材.key));
      const 已有URL = new Set(获取素材(类型).map(素材 => 素材.url));
      批量素材预览列表 = urls.map(url => {
        const key = makeUniqueImageKey(suggestImageKey(url), 已用key);
        已用key.add(key);
        return { id: 新素材id(), url, key, 已存在: 已有URL.has(url) };
      });
      渲染素材页(类型);
    });
    容器.find('#gal批量素材名称').on('input', function () {
      批量分类名称 = String($(this).val() || '');
    });
    容器.find('#gal批量URL').on('input', function () {
      批量粘贴文本 = String($(this).val() || '');
    });
    容器.on('input.gal素材', '[data-批量key]', function () {
      const 项 = 批量素材预览列表.find(素材 => 素材.id === String($(this).data('批量key')));
      if (项) 项.key = String($(this).val() || '');
    });
    容器.on('click.gal素材', '[data-移除批量]', function () {
      批量素材预览列表 = 批量素材预览列表.filter(素材 => 素材.id !== String($(this).data('移除批量')));
      渲染素材页(类型);
    });
    容器.find('#gal确认批量导入').on('click', () => 保存批量素材(类型));
    return;
  }
  const 显示预览 = () => {
    const url = String(容器.find('#gal图片URL').val() || '').trim();
    const 图片 = 容器.find('#gal图片预览');
    容器.find('#gal预览错误').text('');
    if (!url) {
      图片.hide();
      return;
    }
    图片.attr('src', url).show();
  };
  容器.find('#gal图片URL').on('input', 显示预览);
  容器.find('#gal图片预览').on('error', () =>
    容器.find('#gal预览错误').text('无法加载图片。请检查URL、跨域限制或图片是否公开。'),
  );
  if (已编辑?.url) 显示预览();
  容器.find('#gal确认素材').on('click', 保存素材);
  容器.find('#gal取消编辑').on('click', () => {
    编辑素材id = null;
    渲染素材页(类型);
  });
}
function 保存批量素材(类型: 素材类型) {
  const 容器 = $(`.gal页面[data-内容="${类型}"]`);
  const 名称 = String(容器.find('#gal批量素材名称').val() || '').trim();
  const 已有URL = new Set(获取素材(类型).map(素材 => 素材.url));
  const 已用key = new Set(配置数据.素材.map(素材 => 素材.key));
  const 新素材: 素材[] = [];
  for (const 预览 of 批量素材预览列表) {
    if (已有URL.has(预览.url)) continue;
    if (!isHttpImageUrl(预览.url)) {
      toastr.error('批量列表中包含无效图片URL。请移除或重新解析。');
      return;
    }
    if (!预览.key.trim()) {
      toastr.error('请为每一张图片填写资源 key。');
      return;
    }
    const key = makeUniqueImageKey(生成key(预览.key), 已用key);
    已用key.add(key);
    新素材.push({
      id: 新素材id(),
      类型,
      key,
      url: 预览.url,
      ...(类型 === '角色立绘' ? { 角色名称: 名称, 场景名称: '' } : { 场景名称: 名称, 角色名称: '' }),
    });
  }
  if (!新素材.length) {
    toastr.info('没有新的素材可导入；相同URL已经存在。');
    return;
  }
  配置数据.素材.push(...新素材);
  保存配置();
  素材输入模式 = 'single';
  批量导入类型 = null;
  批量素材预览列表 = [];
  批量分类名称 = '';
  批量粘贴文本 = '';
  if (类型 === '角色立绘') 当前角色筛选 = 名称 || '__未分组__';
  toastr.success(`已导入 ${新素材.length} 项素材。`);
  渲染素材页(类型);
}
function 保存素材() {
  const 容器 = $(`.gal页面[data-内容="${当前类型}"]`);
  const url = String(容器.find('#gal图片URL').val() || '').trim();
  const 名称 = String(容器.find('#gal素材名称').val() || '').trim();
  const 原key = String(容器.find('#gal素材key').val() || '').trim();
  if (!isHttpImageUrl(url)) {
    toastr.error('请输入完整图片URL。');
    return;
  }
  if (!原key) {
    toastr.error('请填写资源名称。');
    return;
  }
  const 原素材 = 编辑素材id ? 配置数据.素材.find(素材 => 素材.id === 编辑素材id) : undefined;
  const 素材: 素材 = {
    id: 原素材?.id || 新素材id(),
    类型: 当前类型,
    key: 唯一key(生成key(原key), 原素材?.id),
    url,
    ...(当前类型 === '角色立绘' ? { 角色名称: 名称, 场景名称: '' } : { 场景名称: 名称, 角色名称: '' }),
  };
  if (原素材) Object.assign(原素材, 素材);
  else 配置数据.素材.push(素材);
  编辑素材id = null;
  保存配置();
  toastr.success('素材已保存。');
  渲染素材页(当前类型);
}

function 渲染音乐页() {
  const 容器 = $('.gal页面[data-内容="音乐"]');
  容器.off('.gal音乐');
  const 编辑 = (window as any).__gal音乐编辑 as string | undefined;
  const 当前 = 配置数据.音乐.find(项 => 项.id === 编辑);
  const 列表 = 配置数据.音乐;
  容器.html(
    `<div class="gal网格"><div class="gal卡片"><h3>新增音乐</h3><p class="gal提示">音乐场景名需使用 AI 可以理解的名称，例如：日常BGM、伤心BGM。一个音乐场景可以连接多个音频 URL；AI 输出这个场景关键词时，系统会随机播放其中一个音频。</p><div class="gal字段"><label><span class="gal必填">*</span> 音乐场景名</label><input id="gal音乐key" placeholder="例如：日常BGM 或 dailycalmbgm" value="${转义属性(当前?.key || '')}"></div><div class="gal字段"><label><span class="gal必填">*</span> BGM URL 列表</label><p class="gal提示">同一个音乐场景可以连接多个音频 URL，每行一个。</p><textarea id="gal音乐urls" placeholder="https://example.com/calm-1.mp3&#10;https://example.com/calm-2.mp3&#10;https://example.com/calm-3.mp3">${转义文字((当前?.urls || []).join('\\n'))}</textarea></div><div class="gal行"><button id="gal保存音乐" class="gal按钮 gal主按钮" type="button">保存音乐</button><button id="gal取消音乐" class="gal按钮" type="button">取消</button></div></div><div class="gal卡片"><h3>音乐资源库（${列表.length} 个音乐场景）</h3><p class="gal提示">世界书和正则使用相同的音乐场景名；每个场景名下面保存多个随机播放 URL。</p><div class="gal素材库">${列表.length ? 列表.map(项 => `<article class="gal素材"><strong title="${转义属性(项.key)}">${转义文字(项.key)}</strong><p class="gal提示">${项.urls.length} 个音频 URL</p>${项.urls.map((url, i) => `<audio controls preload="none" src="${转义属性(url)}" style="width:100%;margin-top:6px" aria-label="${转义属性(项.key)} 音频 ${i + 1}"></audio>`).join('')}<div class="gal行" style="margin-top:8px"><button class="gal按钮" data-编辑音乐="${项.id}" type="button">编辑</button><button class="gal按钮" data-删除音乐="${项.id}" type="button">删除</button></div></article>`).join('') : '<p class="gal提示">还没有音乐素材（可留空）。</p>'}</div></div></div>`,
  );
  容器.find('#gal保存音乐').on('click', () => {
    const key = String(容器.find('#gal音乐key').val() || '').trim();
    const urls = String(容器.find('#gal音乐urls').val() || '')
      .split(/\s+/)
      .map(url => url.trim())
      .filter(Boolean);
    if (!key || !urls.length || urls.some(url => !/^https?:\/\//i.test(url))) {
      toastr.error('请填写音乐场景名，并为每行填写有效的 HTTP/HTTPS 音频URL。');
      return;
    }
    const 已有 = 配置数据.音乐.find(项 => 项.id === 编辑) || 配置数据.音乐.find(项 => 项.key === key);
    if (已有) Object.assign(已有, { key, urls: [...new Set(urls)] });
    else 配置数据.音乐.push({ id: 新素材id(), key, urls: [...new Set(urls)] });
    delete (window as any).__gal音乐编辑;
    保存配置();
    toastr.success('音乐已保存。');
    渲染音乐页();
  });
  容器.find('#gal取消音乐').on('click', () => {
    delete (window as any).__gal音乐编辑;
    渲染音乐页();
  });
  容器.on('click.gal音乐', '[data-编辑音乐]', function () {
    (window as any).__gal音乐编辑 = String($(this).data('编辑音乐'));
    渲染音乐页();
  });
  容器.on('click.gal音乐', '[data-删除音乐]', function () {
    配置数据.音乐 = 配置数据.音乐.filter(项 => 项.id !== String($(this).data('删除音乐')));
    保存配置();
    渲染音乐页();
  });
}

function 渲染界面设置() {
  const 设置 = 配置数据.界面;
  const 容器 = $('.gal页面[data-内容="界面设置"]');
  const 字段 = (标签: keyof 界面设置, 类型 = 'color', 显示标签 = 标签) =>
    `<div class="gal字段"><label>${显示标签}</label><input class="gal界面字段 ${类型 === 'color' ? 'gal颜色' : ''}" data-字段="${标签}" type="${类型}" value="${转义属性(设置[标签])}" ${类型 === 'url' ? 'placeholder="https://example.com/icon.png"' : ''}></div>`;
  const 字体选项 = [
    ['原模板默认字体', '原模板默认字体'],
    ['方塘像素体 16x16', 'SqrPond 16x16'],
    ['汇文明朝体', 'Huiwen-mincho'],
    ['江城黑体', 'JiangChengHeiTi 400W'],
    ['霞鹜臻楷', 'LXGW ZhenKai GB'],
  ];
  const 界面字体字段 = `<div class="gal字段"><label>界面字体</label><select class="gal界面字段" data-字段="界面字体">${字体选项.map(([名称, 值]) => `<option value="${转义属性(值)}" ${设置.界面字体 === 值 ? 'selected' : ''}>${转义文字(名称)}</option>`).join('')}</select></div>`;
  const 玩家设置 = 设置.玩家默认设置;
  const 玩家数字字段 = (字段名: keyof 玩家默认设置, 标签: string, min: number, max: number, step: number) =>
    `<div class="gal字段"><label>${标签}</label><input class="gal玩家默认字段" data-字段="${字段名}" type="number" min="${min}" max="${max}" step="${step}" value="${玩家设置[字段名]}"></div>`;
  const 玩家开关字段 = (字段名: 'hideUi' | 'hideStatusInfo', 标签: string) =>
    `<div class="gal字段"><label>${标签}</label><input class="gal玩家默认字段" data-字段="${字段名}" type="checkbox" ${玩家设置[字段名] ? 'checked' : ''}></div>`;
  const 玩家默认设置面板 = `<div class="gal卡片"><h3>玩家默认显示与立绘</h3><p class="gal提示">发布后作为玩家「显示」与「立绘」的初始值。玩家自行调整优先；玩家点击「恢复默认」会回到这里设置的值。</p><div class="gal网格"><div><h3>显示</h3>${玩家数字字段('fontSize', '对话字号', 12, 32, 1)}${玩家数字字段('uiScale', 'UI大小', 0.5, 1.5, 0.01)}${玩家数字字段('panelScale', '面板缩放', 0.5, 1.5, 0.01)}${玩家开关字段('hideUi', '默认隐藏界面')}${玩家开关字段('hideStatusInfo', '默认隐藏时间地点')}</div><div><h3>立绘</h3>${玩家数字字段('globalSpriteScale', '立绘大小', 0.8, 2.8, 0.01)}${玩家数字字段('spriteOffsetLeft', '左侧偏移', -50, 50, 1)}${玩家数字字段('spriteOffsetCenter', '中间偏移', -100, 0, 1)}${玩家数字字段('spriteOffsetRight', '右侧偏移', -50, 50, 1)}${玩家数字字段('backgroundPositionX', '背景横向位置', 0, 100, 1)}</div></div><button id="gal保存玩家默认设置" class="gal按钮 gal主按钮" type="button">保存进阶设置</button></div>`;
  const 按钮字段 = ([图片, 颜色, 名称]: [keyof 界面设置, keyof 界面设置, string]) =>
    `<div class="gal卡片" style="padding:14px"><h3>${名称}</h3>${字段(图片, 'url', '图片链接（可选）')}${字段(颜色, 'color', '按钮颜色')}</div>`;
  const 按钮设置 = [
    ['全屏按钮', '全屏按钮颜色', '全屏按钮'],
    ['设置按钮', '设置按钮颜色', '设置按钮'],
    ['历史按钮', '历史按钮颜色', '历史按钮'],
    ['状态按钮', '状态按钮颜色', '状态按钮'],
    ['手机按钮', '手机按钮颜色', '手机按钮'],
    ['播放暂停按钮', '播放暂停按钮颜色', '播放／暂停按钮'],
  ]
    .map(项 => 按钮字段(项 as [keyof 界面设置, keyof 界面设置, string]))
    .join('');
  容器.html(
    `<div class="gal网格"><div class="gal卡片"><h3>界面配色</h3><p class="gal提示">自由调整Gal界面的默认颜色</p>${字段('对话框背景')}${字段('文字颜色')}${字段('名字颜色', 'color', '角色名字颜色')}${字段('选项背景')}${字段('选项文字')}${字段('边框颜色')}${界面字体字段}<button id="gal保存界面" class="gal按钮 gal主按钮" type="button">保存进阶设置</button></div><div class="gal卡片"><h3>界面按钮外观</h3><p class="gal提示">可填写自定义按键素材图片链接；留空时显示默认emoji，并可调整emoji颜色。</p><div class="gal按钮设置网格">${按钮设置}</div><button id="gal保存界面2" class="gal按钮 gal主按钮" type="button">保存进阶设置</button></div>${玩家默认设置面板}<div class="gal卡片"><h3>角色立绘名称纠错</h3><p class="gal提示">当 AI 输出角色立绘名称时，如果出现错别字、难字、角色别名，或者 AI 把角色名称搞混，系统会自动改用你指定的默认立绘。<br>例如：将「马里奥、马礼欧、小马」统一改为使用「马特奥默认」立绘。</p><div class="gal字段"><label>后备立绘 key</label><select id="gal纠错默认立绘"><option value="">请选择角色立绘</option>${获取素材(
      '角色立绘',
    )
      .map(项 => `<option value="${转义属性(项.key)}">${转义文字(项.key)}</option>`)
      .join(
        '',
      )}</select></div><div class="gal字段"><label>角色别名 / AI容易输出错误的名称</label><textarea id="gal纠错别名" placeholder="每行填写一个：&#10;马里奥&#10;马礼欧&#10;小马"></textarea></div><button id="gal保存纠错" class="gal按钮 gal主按钮" type="button">保存名称纠错规则</button><div class="gal素材库" style="margin-top:14px">${配置数据.角色名称纠错.length ? 配置数据.角色名称纠错.map(规则 => `<article class="gal素材"><strong>${转义文字(规则.别名.join('、'))}</strong><p class="gal提示">→ ${转义文字(规则.默认立绘)}</p><button class="gal按钮" data-删除纠错="${规则.id}" type="button">删除</button></article>`).join('') : '<p class="gal提示">尚未设置名称纠错规则。</p>'}</div></div></div>`,
  );
  const 保存全部进阶设置 = () => {
    容器.find('.gal界面字段').each(function () {
      const 字段名 = String($(this).data('字段')) as keyof 界面设置;
      配置数据.界面[字段名] = 规范化网址(String($(this).val() || ''));
    });
    容器.find('.gal玩家默认字段').each(function () {
      const 输入 = this as HTMLInputElement;
      const 字段名 = String($(this).data('字段')) as keyof 玩家默认设置;
      (配置数据.界面.玩家默认设置 as Record<string, number | boolean>)[字段名] =
        输入.type === 'checkbox' ? 输入.checked : Number(输入.value);
    });
    保存配置();
    toastr.success('进阶设置已保存，将在发布到酒馆时同步。');
  };
  容器.find('#gal保存界面,#gal保存界面2,#gal保存玩家默认设置').on('click', 保存全部进阶设置);
  容器.find('#gal保存纠错').on('click', () => {
    const 默认立绘 = String(容器.find('#gal纠错默认立绘').val() || '').trim();
    const 别名 = String(容器.find('#gal纠错别名').val() || '')
      .split(/\n/)
      .map(名 => 名.trim())
      .filter(Boolean);
    if (!默认立绘 || !别名.length) {
      toastr.error('请选择后备立绘，并填写至少一个角色别名或错误名称。');
      return;
    }
    const 规则 = 配置数据.角色名称纠错.find(项 => 项.默认立绘 === 默认立绘);
    if (规则) 规则.别名 = [...new Set([...规则.别名, ...别名])];
    else 配置数据.角色名称纠错.push({ id: 新素材id(), 默认立绘, 别名: [...new Set(别名)] });
    保存配置();
    toastr.success('名称纠错规则已保存。');
    渲染界面设置();
  });
  容器.on('click.gal纠错', '[data-删除纠错]', function () {
    配置数据.角色名称纠错 = 配置数据.角色名称纠错.filter(项 => 项.id !== String($(this).data('删除纠错')));
    保存配置();
    渲染界面设置();
  });
}

type 条目目标 = { mode: 'skip' } | { mode: 'new' } | { mode: 'replace'; uid: number };
type 正则目标 = { mode: 'new' } | { mode: 'replace'; id: string };
type 发布字段 = {
  世界书名: string;
  正则名: string;
  正则范围: 'character' | 'global';
  素材目标: 条目目标;
  输出目标: 条目目标;
  正则目标: 正则目标;
};

function 世界书条目选项(条目: any[], 已选值: string | undefined) {
  return [
    `<option value="__不更新__" ${已选值 === '__不更新__' || !已选值 ? 'selected' : ''}>不更新此条目</option>`,
    `<option value="__新建__" ${已选值 === '__新建__' ? 'selected' : ''}>自动新增世界书条目</option>`,
    ...条目.map(项 => {
      const 选中 = String(项.uid) === 已选值 ? 'selected' : '';
      return `<option value="${项.uid}" ${选中}>${转义文字(项.name || '未命名条目')}（UID：${项.uid}）</option>`;
    }),
  ].join('');
}

async function 渲染发布页() {
  const 容器 = $('.gal页面[data-内容="发布"]');
  容器.html('<p class="gal提示">正在读取酒馆世界书和Regex列表…</p>');
  try {
    const 草稿 = 获取发布草稿();
    const 正则范围 = 草稿.正则范围 || 配置数据.正则范围;
    const 世界书 = getWorldbookNames();
    const 正则 = getTavernRegexes({ scope: 正则范围 });
    const 当前世界书名称 = 草稿.世界书选择 || 配置数据.世界书名;
    const 当前世界书 = 世界书.includes(当前世界书名称) ? 当前世界书名称 : '';
    const 条目 = 当前世界书 ? await getWorldbook(当前世界书) : [];
    const 世界书选项 = 世界书
      .map(
        名称 =>
          `<option value="${转义属性(名称)}" ${名称 === 当前世界书名称 ? 'selected' : ''}>${转义文字(名称)}</option>`,
      )
      .join('');
    const 上次更新 = 配置数据.上次更新正则?.[正则范围];
    const 正则选项 = [...正则]
      .sort((a, b) => Number(b.id === 上次更新) - Number(a.id === 上次更新))
      .map(
        项 =>
          `<option value="${转义属性(项.id)}">${项.id === 上次更新 ? '上次更新｜' : ''}${转义文字(项.script_name)}</option>`,
      )
      .join('');
    容器.html(
      `<div class="gal网格"><div class="gal卡片"><h3>世界书目标</h3><div class="gal字段"><label>选择世界书</label><select id="gal目标世界书"><option value="__新建__" ${当前世界书 ? '' : 'selected'}>新建世界书</option>${世界书选项}</select></div><div class="gal字段 ${当前世界书 ? 'gal隐藏' : ''}" id="gal新世界书名称字段"><label>新世界书名称</label><input id="gal新世界书名" value="${转义属性(草稿.新世界书名 || 配置数据.世界书名)}"></div><div class="gal字段"><label>选择素材库条目（可选）（首次制作选「自动新增世界书条目」，后续可选择不更新条目或覆盖旧有条目）</label><select id="gal素材条目目标" ${当前世界书 ? '' : 'disabled'}>${当前世界书 ? 世界书条目选项(条目, 草稿.素材条目选择) : '<option value="__新建__">自动新增世界书条目</option>'}</select></div><div class="gal字段"><label>选择输出格式条目（可选）（首次制作选「自动新增世界书条目」系统会自动新增，后续可选择不更新或覆盖旧有条目）</label><select id="gal输出条目目标" ${当前世界书 ? '' : 'disabled'}>${当前世界书 ? 世界书条目选项(条目, 草稿.输出条目选择) : '<option value="__新建__">自动新增世界书条目</option>'}</select></div><p class="gal提示">选择“不更新”时不会读取或改写任何条目。输出格式写入时使用系统消息、深度 1、顺序 100；素材库使用深度 1、顺序 101。</p></div><div class="gal卡片"><h3>正则目标</h3><div class="gal字段"><label>正则范围</label><select id="gal正则范围"><option value="character" ${正则范围 === 'character' ? 'selected' : ''}>当前角色卡</option><option value="global" ${正则范围 === 'global' ? 'selected' : ''}>全局</option></select></div><div class="gal字段"><label>新增或替换正则？</label><select id="gal正则操作"><option value="new" ${草稿.正则操作 !== 'replace' ? 'selected' : ''}>新增正则</option><option value="replace" ${草稿.正则操作 === 'replace' ? 'selected' : ''}>更新已有正则</option></select></div><div class="gal字段 ${草稿.正则操作 === 'replace' ? '' : 'gal隐藏'}" id="gal正则更新字段"><label>要替换的正则</label><select id="gal目标Regex"><option value="">请选择</option>${正则选项}</select></div><div class="gal字段" id="gal正则名称字段"><label>正则名称</label><input id="gal正则名" value="${转义属性(草稿.正则名 || 配置数据.正则名)}"></div><p class="gal提示">新增或更新都可编辑名称。更新已有正则时，默认保留被选择正则的原名。</p></div></div>`,
    );
    const 必填标签 = new Set(['选择世界书', '新世界书名称', '正则范围', '新增或替换正则？', '正则名称']);
    容器.find('label').each(function () {
      const 标签 = $(this);
      if (必填标签.has(标签.text().trim())) 标签.prepend('<span class="gal必填">*</span> ');
    });
    $('#gal正则更新字段 label').prepend('<span class="gal必填">*</span> ');
    $('#gal正则范围').on('change', () => {
      保存发布草稿({ 正则范围: String($('#gal正则范围').val()) as 'character' | 'global' });
      渲染发布页();
    });
    $('#gal目标世界书').on('change', () => {
      const 世界书名 = String($('#gal目标世界书').val() || '');
      保存发布草稿({
        世界书选择: 世界书名,
        素材条目选择: 世界书名 === '__新建__' ? '__新建__' : '__不更新__',
        输出条目选择: 世界书名 === '__新建__' ? '__新建__' : '__不更新__',
      });
      if (世界书名 === '__新建__') {
        $('#gal新世界书名称字段').removeClass('gal隐藏');
        $('#gal素材条目目标,#gal输出条目目标')
          .prop('disabled', true)
          .html('<option value="__新建__">新世界书将新增条目</option>');
        return;
      }
      渲染发布页();
    });
    $('#gal正则操作').on('change', () => {
      const 更新已有 = $('#gal正则操作').val() === 'replace';
      保存发布草稿({ 正则操作: 更新已有 ? 'replace' : 'new' });
      $('#gal正则更新字段').toggleClass('gal隐藏', !更新已有);
    });
    $('#gal目标Regex').val(草稿.regexId || '');
    $('#gal目标Regex').on('change', () => {
      const regexId = String($('#gal目标Regex').val() || '');
      const 正则名 = getSelectedRegexName(正则, regexId, 配置数据.正则名);
      $('#gal正则名').val(正则名);
      保存发布草稿({ regexId, 正则名 });
    });
    $('#gal新世界书名').on('input', () => 保存发布草稿({ 新世界书名: String($('#gal新世界书名').val() || '') }));
    $('#gal正则名').on('input', () => 保存发布草稿({ 正则名: String($('#gal正则名').val() || '') }));
    $('#gal素材条目目标,#gal输出条目目标')
      .on('change', () => {
        const 素材uid = String($('#gal素材条目目标').val());
        const 输出uid = String($('#gal输出条目目标').val());
        $('#gal素材条目目标 option,#gal输出条目目标 option').prop('disabled', false);
        if (!素材uid.startsWith('__') && 素材uid !== '__新建__')
          $(`#gal输出条目目标 option[value="${素材uid}"]`).prop('disabled', true);
        if (!输出uid.startsWith('__') && 输出uid !== '__新建__')
          $(`#gal素材条目目标 option[value="${输出uid}"]`).prop('disabled', true);
        保存发布草稿({ 素材条目选择: 素材uid, 输出条目选择: 输出uid });
      })
      .trigger('change');
  } catch (错误) {
    console.error('读取发布目标失败', 错误);
    容器.html('<p class="gal错误">无法读取酒馆世界书或Regex。请确认酒馆助手可用，并已打开角色卡。</p>');
  }
}
function 读取发布字段(): 发布字段 {
  const 选择世界书 = String($('#gal目标世界书').val() || '');
  const 世界书名 = 选择世界书 === '__新建__' ? String($('#gal新世界书名').val() || '').trim() : 选择世界书;
  const 正则名 = String($('#gal正则名').val() || '').trim();
  const 正则范围 = String($('#gal正则范围').val()) as 'character' | 'global';
  const 条目目标 = (value: string): 条目目标 => {
    if (value === '__不更新__') return { mode: 'skip' };
    return value === '__新建__' ? { mode: 'new' } : { mode: 'replace', uid: Number(value) };
  };
  const 正则操作 = String($('#gal正则操作').val());
  const regexId = String($('#gal目标Regex').val() || '');
  if (!世界书名 || !正则名) throw new Error('请填写世界书和 Regex 名称。');
  return {
    世界书名,
    正则名,
    正则范围,
    素材目标: 条目目标(String($('#gal素材条目目标').val() || '__新建__')),
    输出目标: 条目目标(String($('#gal输出条目目标').val() || '__新建__')),
    正则目标: 正则操作 === 'replace' ? { mode: 'replace', id: regexId } : { mode: 'new' },
  };
}
function 世界书条目(名称: string, 内容: string): any {
  return {
    name: `${标记}｜${名称}`,
    enabled: true,
    strategy: {
      type: 'constant',
      keys: [],
      keys_secondary: { logic: 'and_any', keys: [] },
      scan_depth: 'same_as_global',
    },
    position: 名称 === '输出格式' ? getOutputEntryPosition() : getAssetEntryPosition(),
    content:
      名称 === '输出格式'
        ? '{{//指导AI输出文游格式的地方，建议阅读}}\n' + 内容
        : '{{//放置立绘素材key名称的地方，AI读这个条目便知道有什么立绘他能用}}\n' + 内容,
    probability: 100,
    recursion: { prevent_incoming: false, prevent_outgoing: false, delay_until: null },
    effect: { sticky: null, cooldown: null, delay: null },
  };
}
function 生成世界书内容() {
  const 素材库 = buildGalAssetLibrary({
    characters: 获取素材('角色立绘').map(素材 => ({ key: 素材.key, characterName: 素材.角色名称 })),
    backgrounds: 获取素材('背景').map(素材 => ({ key: 素材.key, sceneName: 素材.场景名称 })),
    bgm: 配置数据.音乐.map(项 => ({ key: 项.key })),
  });
  const 输出 = `<outputformatrules>
正文必须以<gal_data>格式演绎，<gal_data> 包裹在 <content> 内
# 1. 背景与音乐
- 每轮头部输出@bg及@bgm初始化场景。如剧情发生时间或空间切换，格式示例：
@bg: <bg>中选择背景, e.g. 餐厅
@bgm: <bgm>中选择音乐key, e.g. dailycalmbgm
# 2. 角色对白
剧情以旁白及角色对白形式演绎, 格式示例：
- 旁白> 旁白叙事（无立绘）
- {{user}}> "英文对话" (中文翻译)（注意{{user}}无立绘）
- 角色名(立绘key, center/left/right, speaking或silent)> "对白"
  * e.g.小明(小明高兴, right, speaking)> "你好."
  ** 只输出角色说出口的对白**。禁止以括号输出描述角色动作行为，角色动作交由旁白描述
  ** 如有双语对白要求应遵守双语对白要求 **
- 角色对白占正文约50%
# 3. 旁白
- 作用：场景描述、角色行动描述。每次2-3句
## 资源
- 必须从<sprites><bg><bgm>中选择key，禁止创作新key。如找不到恰当key，使用角色default立绘或generic背景
## 位置3选1（left / center / right）
- 只有角色与{{user}} 对话或单人戏份=位置设为 \`center\`。
- 两个非{{user}}角色在场互动=分设一个 \`left\`，一个 \`right\`
- 一个角色离场，留下的在场角色设为center
- 三个或以上角色，每次只可出现2张立绘，因此必须选出2个重点角色设为left 与 right，left&right&center不可同时出现3个角色。若角色为center，left&right的角色会自动清空
- 若角色 A 原本在 \`center\`，此时角色 B 出场对话，可让 A 退到 \`left\` 保持 \`silent\`，让 B 在 \`right\` 处于 \`speaking\` 登场。
## 说话状态2选1（speaking / silent）
- 剧情中在听、没有说话->状态为 \`silent\`。
- 剧情中角色作为重点，有身体动作但无对白，例如战斗中 >状态可以为 \`speaking\`以保持立绘高亮状态
# 4. 行动选项
- 剧情最后输出4个行动选项，格式 ：
* {{user}}主动选项
* {{user}}被动选项
* {{user}}推动剧情选项
* 歐亨尼式特殊向选项
## 可選-场景切分 (---)
- 发生场景转换需要更换背景时，单独使用一行 \`---\`作为分割线 \`---\`下方输出新的@bg來更換bg
# 示例
<content>
<gal_data>
@bg: 街道
@bgm: sadbgm
旁白> 窗外下雨
小罗(小罗困惑, center, speaking)> "他在哪？"
{{user}}> "等等吧。"
小雷(小雷高兴, right, speaking)> "迟到"
小罗(小罗高兴, left, speaking)> "你到了"
---
@bg: 餐厅
旁白> 晚上三人在吃饭
* 选项1
* 选项2
* 选项3
* 选项4
</gal_data>
</content>
</outputformatrules>`;
  return { 素材库, 输出 };
}

function 生成旧简化Regex(): TavernRegex {
  const 资源 = Object.fromEntries(配置数据.素材.map(素材 => [素材.key, { url: 素材.url, scale: 素材.缩放 }]));
  const 设置 = 配置数据.界面;
  const 数据 = JSON.stringify({ 资源, 设置 }).replace(/'/g, '&#39;');
  const 图标 = (url: string, 功能: string, 标签: string) =>
    url
      ? `<button data-功能="${功能}" type="button"><img src="${转义属性(url)}" alt="${标签}"></button>`
      : `<button data-功能="${功能}" type="button">${标签}</button>`;
  const 工具栏 = `${图标(设置.全屏按钮, '全屏', '全屏')}${图标(设置.设置按钮, '设置', '设置')}${图标(设置.历史按钮, '历史', '历史')}${图标(设置.状态按钮, '状态', '状态')}`;
  const 替换 = `<div class="gal制作器游戏" data-gal制作器='${数据}'><style>.gal制作器游戏{max-width:680px;margin:10px auto;border:2px solid ${设置.边框颜色};background:#111;font-family:Arial,"Microsoft YaHei",sans-serif;overflow:hidden}.gal制作器舞台{height:300px;position:relative;background:#333 center/cover}.gal制作器背景{position:absolute;inset:0;background:center/cover}.gal制作器立绘{position:absolute;bottom:0;max-width:52%;height:96%;object-fit:contain;transform-origin:bottom}.gal制作器左{left:0}.gal制作器中{left:50%;transform:translateX(-50%);max-width:68%}.gal制作器右{right:0}.gal制作器说话{filter:brightness(1.15)}.gal制作器工具栏{position:absolute;right:8px;top:8px;z-index:5;display:flex;gap:5px}.gal制作器工具栏 button{width:30px;height:30px;padding:0;border:1px solid #ffffff55;background:#0008;color:#fff;cursor:pointer}.gal制作器工具栏 img{display:block;width:100%;height:100%;object-fit:contain}.gal制作器对话{min-height:145px;padding:14px 18px;background:${设置.对话框背景};color:${设置.文字颜色}}.gal制作器名字{display:block;margin-bottom:8px;color:${设置.名字颜色};font-weight:bold}.gal制作器选项{display:grid;gap:6px;margin-top:12px}.gal制作器选项 button{padding:8px;border:1px solid ${设置.边框颜色};background:${设置.选项背景};color:${设置.选项文字};text-align:left;cursor:pointer}@media(max-width:600px){.gal制作器舞台{height:230px}}</style><div class="gal制作器舞台"><div class="gal制作器背景"></div><img class="gal制作器立绘 gal制作器左"><img class="gal制作器立绘 gal制作器中"><img class="gal制作器立绘 gal制作器右"><div class="gal制作器工具栏">${工具栏}</div></div><div class="gal制作器对话"><b class="gal制作器名字"></b><div class="gal制作器文字"></div><div class="gal制作器选项"></div></div></div><script>(()=>{const 根=document.currentScript.previousElementSibling,设=JSON.parse(根.dataset.gal制作器),取=s=>根.querySelector(s),位={left:取('.gal制作器左'),center:取('.gal制作器中'),right:取('.gal制作器右')},行=String('$1').trim().split(/\\n/);let 名字='',文字='',选项=[];for(const 原行 of 行){const 行文=原行.trim();if(!行文)continue;if(行文.startsWith('@bg:')){const 图=设.资源[行文.slice(4).trim()];取('.gal制作器背景').style.backgroundImage=图?\`url("\${图.url}")\`:'';continue}if(行文.startsWith('*')){选项.push(行文.slice(1).trim());continue}const 对白=行文.match(/^(.+?)\\(([^,]+),\\s*(left|center|right),\\s*(speaking|silent)\\)>\\s*(.+)$/);if(对白){const 图=设.资源[对白[2].trim()],槽=位[对白[3]];名字=对白[1];文字+=(文字?' ':'')+对白[5];if(图){if(对白[3]==='center'){位.left.removeAttribute('src');位.right.removeAttribute('src')}槽.src=图.url;槽.style.transform=对白[3]==='center'?\`translateX(-50%) scale(\${图.scale})\`:\`scale(\${图.scale})\`;Object.values(位).forEach(项=>项.classList.remove('gal制作器说话'));槽.classList.toggle('gal制作器说话',对白[4]==='speaking')}continue}if(行文.startsWith('旁白>')){名字='旁白';文字+=(文字?' ':'')+行文.slice(3).trim()}}取('.gal制作器名字').textContent=名字;取('.gal制作器文字').textContent=文字;取('.gal制作器选项').innerHTML=选项.map(项=>\`<button type="button">\${项}</button>\`).join('');根.querySelectorAll('.gal制作器选项 button').forEach(钮=>钮.onclick=()=>parent.$('#send_textarea').val(钮.textContent).trigger('input'));根.querySelectorAll('[data-功能]').forEach(钮=>钮.onclick=()=>{const 功能=钮.dataset.功能;if(功能==='全屏'){根.requestFullscreen?.()}else{alert(功能==='状态'?'当前场景：'+(取('.gal制作器背景').style.backgroundImage||'未设置背景'):'此按钮外观已可配置；互动功能将在后续版本加入。')}})})()</script>`;
  return {
    id: `gal制作器:${配置数据.正则名}`,
    script_name: 配置数据.正则名,
    enabled: true,
    run_on_edit: true,
    scope: 配置数据.正则范围,
    find_regex: '<gal_data>([\\s\\S]*?)<\\/gal_data>',
    replace_string: 替换,
    source: { user_input: false, ai_output: true, slash_command: false, world_info: false },
    destination: { display: true, prompt: false },
    min_depth: null,
    max_depth: null,
  };
}

function 生成Regex(id: string): TavernRegex {
  const 模板 = JSON.parse(原GAL模板文本) as { replaceString: string };
  const 角色资源 = Object.fromEntries(获取素材('角色立绘').map(素材 => [素材.key, 规范化网址(素材.url)]));
  const 背景资源 = Object.fromEntries(获取素材('背景').map(素材 => [素材.key, 规范化网址(素材.url)]));
  const 音乐资源 = Object.fromEntries(配置数据.音乐.map(项 => [项.key, 项.urls]));
  const 角色名称纠错 = Object.fromEntries(
    配置数据.角色名称纠错.flatMap(规则 => 规则.别名.map(别名 => [别名, 规则.默认立绘])),
  );
  let 替换 = buildGalRegexReplaceString(模板.replaceString, {
    characters: 角色资源,
    backgrounds: 背景资源,
    bgm: 音乐资源,
    characterFallbacks: 角色名称纠错,
    interface: 配置数据.界面,
    settingsKey: `gal制作器:${配置数据.项目id}`,
  });
  替换 = 替换.replace(
    "dialogueBox.addEventListener('click', (e) => {\n        if (window.getSelection().toString().length > 0) return;",
    "let GAL制作器正在选择文字 = false;\n    const GAL制作器检查选择文字 = () => { GAL制作器正在选择文字 = window.getSelection().toString().length > 0; };\n    document.addEventListener('selectionchange', GAL制作器检查选择文字);\n    window.addEventListener('mouseup', () => setTimeout(GAL制作器检查选择文字, 0), true);\n    dialogueBox.addEventListener('click', (e) => {\n        if (GAL制作器正在选择文字 || window.getSelection().toString().length > 0) { GAL制作器正在选择文字 = false; return; }",
  );
  return {
    id,
    script_name: 配置数据.正则名,
    enabled: true,
    run_on_edit: true,
    scope: 配置数据.正则范围,
    find_regex: '<gal_data>([\\s\\S]*?)<\\/gal_data>',
    replace_string: 替换,
    source: { user_input: false, ai_output: true, slash_command: false, world_info: false },
    destination: { display: true, prompt: false },
    min_depth: null,
    max_depth: null,
  };
}

async function 发布() {
  const 发布结果: string[] = [];
  try {
    const 字段 = 读取发布字段();
    const 已有世界书 = getWorldbookNames().includes(字段.世界书名);
    const 正则列表 = getTavernRegexes({ scope: 字段.正则范围 });
    const 内容 = 生成世界书内容();
    if (!已有世界书) await createWorldbook(字段.世界书名, []);
    let 条目 = await getWorldbook(字段.世界书名);
    const 素材目标 = resolveEntryTarget(条目, 字段.素材目标);
    const 输出目标 = resolveEntryTarget(条目, 字段.输出目标);
    if (素材目标.mode === 'replace' && 输出目标.mode === 'replace' && 素材目标.uid === 输出目标.uid) {
      throw new Error('素材库和输出格式不能覆盖同一个世界书条目。');
    }
    const 写入条目 = async (名称: string, 内容文本: string, 目标选择: 条目目标) => {
      if (目标选择.mode === 'skip') return undefined;
      if (目标选择.mode === 'replace') {
        const 目标 = 条目.find(项 => 项.uid === 目标选择.uid);
        if (!目标) throw new Error(`所选${名称}条目已不存在；请刷新后重新选择。`);
        Object.assign(目标, { ...世界书条目(名称, 内容文本), uid: 目标.uid });
        发布结果.push(`${名称}：已覆盖 UID ${目标.uid}`);
        return 目标.uid;
      }
      const 结果 = await createWorldbookEntries(字段.世界书名, [世界书条目(名称, 内容文本)], {
        render: 'immediate',
      });
      条目 = 结果.worldbook;
      const 新条目 = 结果.new_entries[0];
      if (!新条目) throw new Error(`无法新增${名称}条目。`);
      发布结果.push(`${名称}：已新增 UID ${新条目.uid}`);
      return 新条目.uid;
    };
    const 素材uid = await 写入条目('素材库', 内容.素材库, 素材目标);
    const 输出uid = await 写入条目('输出格式', 内容.输出, 输出目标);
    if (素材uid !== undefined || 输出uid !== undefined) {
      await replaceWorldbook(字段.世界书名, 条目, { render: 'immediate' });
    }
    const 正则目标 = resolveRegexTarget(正则列表, 字段.正则范围, 字段.正则目标);
    const 新Regex = 生成Regex(
      正则目标.mode === 'replace' ? 正则目标.id : crypto.randomUUID?.() || `gal制作器_${Date.now()}`,
    );
    新Regex.script_name = 字段.正则名;
    新Regex.scope = 字段.正则范围;
    await replaceTavernRegexes(
      正则目标.mode === 'replace' ? 正则列表.map(项 => (项.id === 正则目标.id ? 新Regex : 项)) : [...正则列表, 新Regex],
      { scope: 字段.正则范围 },
    );
    发布结果.push(`Regex：${正则目标.mode === 'replace' ? `已更新 ${字段.正则名}` : `已新增 ${字段.正则名}`}`);
    配置数据.世界书名 = 字段.世界书名;
    配置数据.正则名 = 字段.正则名;
    配置数据.正则范围 = 字段.正则范围;
    if (素材uid !== undefined || 输出uid !== undefined) {
      配置数据.世界书条目选择 ||= {};
      配置数据.世界书条目选择[字段.世界书名] = {
        ...配置数据.世界书条目选择[字段.世界书名],
        ...(素材uid === undefined ? {} : { 素材条目uid: 素材uid }),
        ...(输出uid === undefined ? {} : { 输出条目uid: 输出uid }),
      };
    }
    if (正则目标.mode === 'replace') {
      配置数据.上次更新正则 ||= {};
      配置数据.上次更新正则[字段.正则范围] = 正则目标.id;
    }
    配置数据.上次发布正则 ||= {};
    配置数据.上次发布正则[字段.正则范围] = 新Regex.id;
    配置数据.发布草稿 = {
      ...获取发布草稿(),
      世界书选择: 字段.世界书名,
      新世界书名: 字段.世界书名,
      正则范围: 字段.正则范围,
      正则操作: 字段.正则目标.mode,
      regexId: 字段.正则目标.mode === 'replace' ? 字段.正则目标.id : 新Regex.id,
      正则名: 字段.正则名,
    };
    保存配置();
    toastr.success(`同步完成：${发布结果.join('；')}`);
    打开页面('发布');
  } catch (错误) {
    console.error('文游制作器发布失败', 错误);
    const 已完成 = 发布结果.length ? `已完成：${发布结果.join('；')}。` : '';
    toastr.error(`${已完成}${错误 instanceof Error ? 错误.message : '发布失败。请检查酒馆助手和当前角色卡。'}`);
  }
}

$(() => {
  配置数据 = 读取配置();
  安装样式();
  安装界面();
  appendInexistentScriptButtons([{ name: '文游制作器', visible: true }]);
  eventOn(getButtonEvent('文游制作器'), () => 打开页面('文游项目'));
  console.info('文游制作器已加载');
  $(window).on('pagehide', () => {
    delete (window as any).GAL制作器打开;
    delete (window as any).GAL制作器关闭;
    $('#gal制作器遮罩,#gal制作器样式').remove();
  });
});
