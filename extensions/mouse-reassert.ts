/**
 * pi-mouse-reassert
 *
 * Windows / ConPTY 下 Pi fullscreen 模式滚轮失效（滚轮表现和 ↑/↓ 一样）的修复扩展。
 *
 * 根因：Pi 的 TuiAltScreen.beforeTerminalStart() 把备用屏进入序列 (?1049h) 和
 * 鼠标启用序列 (?1000h ?1002h ?1003h ?1004h ?1006h) 放在同一次 stdout.write 里，
 * 而这次写入发生在 ProcessTerminal.start() 调用 process.stdin.setRawMode(true)
 * 之前。Windows ConPTY 在 cooked mode 下会丢弃这批 DECSET，终端于是从未进入
 * 鼠标上报模式，把备用屏里的滚轮翻译成方向键。
 *
 * 修复：在 TUI 就绪后单独补发一次鼠标启用序列。只 enable、不 disable，
 * 重复发送是幂等的，不会干扰 Pi 退出时的清理。
 *
 * 上游 issue: https://github.com/earendil-works/pi/issues/9656
 *
 * 关闭方式：环境变量 PI_MOUSE_REASSERT=0
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const ENABLE_MOUSE = "\x1b[?1000h\x1b[?1002h\x1b[?1003h\x1b[?1004h\x1b[?1006h";
const REASSERT_DELAYS = [80, 300, 800, 1600];

const ENABLED =
	process.platform === "win32" && process.env.PI_MOUSE_REASSERT !== "0";

function reassert(): void {
	if (!process.stdout.isTTY) return;
	process.stdout.write(ENABLE_MOUSE);
}

function reassertSoon(): void {
	for (const ms of REASSERT_DELAYS) setTimeout(reassert, ms);
}

export default function (pi: ExtensionAPI): void {
	if (!ENABLED) return;

	// 冷启动：session 建立时 TUI 通常已经进入备用屏
	pi.on("session_start", reassertSoon);
	// /reload：扩展加载时 TUI 已经在运行
	reassertSoon();
}
