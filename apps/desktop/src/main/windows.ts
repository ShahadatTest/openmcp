import { app, BrowserWindow, nativeTheme, shell, type BrowserWindowConstructorOptions } from "electron";
import { pathToFileURL } from "node:url";
import { join } from "node:path";

import { frameOptions, TOOLBAR_HEIGHT, windowColors } from "./theme";

const RENDERER_DIR = join(__dirname, "../renderer");

type Page = "index";

/** When true, ignore the next nativeTheme "updated" recolor (user theme change). */
let deferThemeRecolor = false;

function devServerUrl() {
  return app.isPackaged ? undefined : process.env.ELECTRON_RENDERER_URL;
}

function paintWindowChrome(window: BrowserWindow) {
  const { background, symbols } = windowColors(nativeTheme.shouldUseDarkColors);
  window.setBackgroundColor(background);
  if (process.platform !== "darwin") {
    window.setTitleBarOverlay({ color: background, symbolColor: symbols, height: TOOLBAR_HEIGHT });
  }
}

/** Skip the immediate overlay update that fires when setAppearance changes themeSource. */
export function deferWindowChromeRecolor() {
  deferThemeRecolor = true;
}

/** Paint title-bar overlay / background to match the current theme (end of renderer transition). */
export function syncWindowChrome() {
  deferThemeRecolor = false;
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) paintWindowChrome(window);
  }
}

export function createWindow(page: Page, options: BrowserWindowConstructorOptions, query: Record<string, string> = {}) {
  const window = new BrowserWindow({
    backgroundColor: windowColors(nativeTheme.shouldUseDarkColors).background,
    ...options,
    show: false,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  window.removeMenu();
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event) => event.preventDefault());

  void loadPage(window, page, query);
  return window;
}

export function createMainWindow() {
  const window = createWindow("index", {
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "OpenMCP",
    ...frameOptions(process.platform, nativeTheme.shouldUseDarkColors)
  });

  const recolor = () => {
    // User-driven appearance changes defer chrome until the renderer view
    // transition finishes (see app:syncWindowChrome). OS theme flips still
    // recolor immediately when appearance is "system".
    if (deferThemeRecolor) {
      deferThemeRecolor = false;
      return;
    }
    paintWindowChrome(window);
  };
  nativeTheme.on("updated", recolor);
  window.on("closed", () => nativeTheme.off("updated", recolor));

  return window;
}

export function isAppUrl(url: string) {
  const devUrl = devServerUrl();
  if (devUrl) return URL.parse(url)?.origin === new URL(devUrl).origin;

  return url.startsWith(`${pathToFileURL(RENDERER_DIR).href}/`);
}

function loadPage(window: BrowserWindow, page: Page, query: Record<string, string>) {
  const devUrl = devServerUrl();
  if (!devUrl) return window.loadFile(join(RENDERER_DIR, `${page}.html`), { query });

  const url = new URL(`${page}.html`, `${devUrl}/`);
  url.search = new URLSearchParams(query).toString();

  return window.loadURL(url.href);
}
