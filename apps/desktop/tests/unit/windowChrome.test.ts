import { afterEach, expect, test, vi } from "vitest";

const setBackgroundColor = vi.fn();
const setTitleBarOverlay = vi.fn();

vi.mock("electron", () => {
  const window = {
    setBackgroundColor,
    setTitleBarOverlay,
    isDestroyed: () => false
  };
  return {
    app: { isPackaged: true },
    shell: { openExternal: vi.fn() },
    nativeTheme: { shouldUseDarkColors: true, on: vi.fn(), off: vi.fn() },
    BrowserWindow: { getAllWindows: () => [window] }
  };
});

afterEach(() => {
  setBackgroundColor.mockClear();
  setTitleBarOverlay.mockClear();
  vi.resetModules();
});

test("syncWindowChrome paints overlay colors for the current theme", async () => {
  const { syncWindowChrome } = await import("../../src/main/windows");
  Object.defineProperty(process, "platform", { configurable: true, value: "linux" });

  syncWindowChrome();

  expect(setBackgroundColor).toHaveBeenCalledWith("#0b1018");
  expect(setTitleBarOverlay).toHaveBeenCalledWith({
    color: "#0b1018",
    symbolColor: "#aab2c4",
    height: 52
  });
});

test("syncWindowChrome clears a deferred recolor so the next OS update paints", async () => {
  const { deferWindowChromeRecolor, syncWindowChrome } = await import("../../src/main/windows");
  Object.defineProperty(process, "platform", { configurable: true, value: "win32" });

  deferWindowChromeRecolor();
  syncWindowChrome();

  expect(setTitleBarOverlay).toHaveBeenCalledTimes(1);
  // A second sync (e.g. after another transition) still paints.
  syncWindowChrome();
  expect(setTitleBarOverlay).toHaveBeenCalledTimes(2);
});
