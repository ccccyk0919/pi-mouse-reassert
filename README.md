# pi-mouse-reassert

修复 **Windows 下 Pi fullscreen 模式鼠标滚轮失效** 的 Pi 扩展（滚轮表现和键盘 ↑/↓ 一样，无法滚动 transcript）。

## 症状

- Pi `tuiMode: "fullscreen"`，滚轮滚一下，transcript 不动，效果等于按了几次 ↑/↓
- `PageUp` / `PageDown`、`Ctrl+Home` 能正常滚动
- 常见于 Windows + WezTerm / Windows Terminal / Tabby / Zellij / mintty，以及 SSH 回 Windows 的场景

## 根因

Pi 的 `TuiAltScreen.beforeTerminalStart()` 把备用屏进入序列（`?1049h`）和鼠标启用序列（`?1000h ?1002h ?1003h ?1004h ?1006h`）放在**同一次** `stdout.write` 里，而这次写入发生在 `process.stdin.setRawMode(true)` **之前**。

Windows ConPTY 在 cooked mode 下会丢弃这批 DECSET，终端因此从未进入鼠标上报模式；备用屏里的滚轮于是被终端翻译成方向键（`alternate_buffer_wheel_scroll_speed` 个 ↑/↓），Pi 收到的是键盘事件。

非 Windows 平台没有这个顺序问题，扩展会自动跳过。

## 安装

### 方式 1：复制单个文件（最快，无需任何依赖）

1. 把 [`extensions/mouse-reassert.ts`](extensions/mouse-reassert.ts) 复制到：
   - Windows: `C:\Users\<你>\.pi\agent\extensions\mouse-reassert.ts`
   - Linux/macOS: `~/.pi/agent/extensions/mouse-reassert.ts`
2. 重启 Pi，或在 Pi 里执行 `/reload`
3. 在 fullscreen 模式下滚动滚轮验证

### 方式 2：作为 Pi 包安装（git）

```bash
pi install git:github.com/ccccyk0919/pi-mouse-reassert
```

### 方式 3：npm（如果已发布）

```bash
pi install npm:pi-mouse-reassert
```

安装后用 `pi list` 确认，`pi remove <source>` 卸载。

## 验证

- 重启后滚轮应滚动 transcript（每次 1–6 行，`Alt+滚轮` 一次 5 倍）
- 若仍无效：确认 `process.platform` 是 `win32`、没有设置 `PI_MOUSE_REASSERT=0`，并临时禁用其他扩展排查冲突

## 关闭

```powershell
# Windows PowerShell
$env:PI_MOUSE_REASSERT = "0"
```

```bash
# bash / zsh
export PI_MOUSE_REASSERT=0
```

然后重启 Pi。适合上游修复已合并、或你在 `regular` 模式下不想让扩展开启鼠标追踪的情况。

## 原理

扩展在 TUI 就绪后（`session_start` 以及 `/reload` 时）在 80/300/800/1600ms 四个时间点补发：

```text
ESC[?1000h ESC[?1002h ESC[?1003h ESC[?1004h ESC[?1006h
```

- 只 enable、不 disable：不会破坏 Pi 退出时的清理，也不会干扰嵌套视图
- 幂等：上游修复后重复发送无副作用，可以保留
- 平台守卫：仅 `process.platform === "win32"` 时生效

## 上游 issue

- https://github.com/earendil-works/pi/issues/9656

上游正式修复方向：只把鼠标 DECSET 从 `beforeTerminalStart()` 移到 `afterTerminalStart()`（`setRawMode(true)` 之后），**不要移动 `?1049h`**（移动备用屏会改变 Kitty 键盘协议栈的归属）。

## License

MIT
