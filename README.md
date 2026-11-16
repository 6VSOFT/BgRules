# 桌游规则书 · BgRules

可离线使用的桌游规则图文速查 PWA（纯静态，无需构建）。

- 书架首页 → 选游戏 → 分章阅读 / 全屏演示（方向键、滑动翻页）
- 安装到主屏幕后可离线使用

## 本地预览

```bash
python -m http.server 5180
```

## 添加一款游戏

1. 新建 `games/<id>/rules.html`（每章一个 `<section data-num data-title>`）和 `games/<id>/img/`
2. 在 `games/index.json` 里加一条
3. 在 `sw.js` 的 `GAME_FILES` 里列出文件，并把 `VERSION` 加一

规则图片来自各游戏官方规则书，仅用于学习交流。
