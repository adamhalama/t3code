// @effect-diagnostics nodeBuiltinImport:off -- Adapter for electron-updater's native Mac download and installation boundary.
import * as NodeChildProcess from "node:child_process";
import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";

import { app } from "electron";
import { AppUpdater } from "electron-updater";
import type { DownloadUpdateOptions } from "electron-updater/out/AppUpdater.js";
import { ElectronHttpExecutor } from "electron-updater/out/electronHttpExecutor.js";

import { stageForkMacUpdate } from "./forkMacInstall.ts";

export class ForkMacUpdater extends AppUpdater {
  private readonly architecture: NodeJS.Architecture;
  private staged: Awaited<ReturnType<typeof stageForkMacUpdate>> | undefined;
  private installing = false;
  private readonly executor = new ElectronHttpExecutor((info, callback) =>
    this.emit("login", info, callback),
  );

  constructor(architecture: NodeJS.Architecture) {
    super(undefined);
    this.architecture = architecture;
  }

  protected override async doDownloadUpdate(options: DownloadUpdateOptions) {
    const { provider, info } = options.updateInfoAndProvider;
    const arch = app.runningUnderARM64Translation ? "arm64" : this.architecture;
    const file = provider.resolveFiles(info).find((file) => {
      const name = NodePath.basename(decodeURIComponent(file.url.pathname));
      return name.endsWith(`-${arch}.zip`);
    });
    if (!file?.info.sha512) throw new Error(`No checksummed Mac ${arch} ZIP in the release.`);
    return this.executeDownload({
      fileExtension: "zip",
      fileInfo: file,
      downloadUpdateOptions: options,
      task: (destination, downloadOptions) =>
        this.executor.download(file.url, destination, downloadOptions),
      done: async (event) => {
        const staged = await stageForkMacUpdate({
          archive: event.downloadedFile,
          target: NodePath.resolve(app.getAppPath(), "../../.."),
          version: event.version,
        });
        if (this.staged) await NodeFSP.rm(this.staged.directory, { recursive: true, force: true });
        this.staged = staged;
        this.dispatchUpdateDownloaded(event);
      },
    });
  }

  override async quitAndInstall() {
    if (this.installing) return;
    if (!this.staged) throw new Error("Download the update before installing.");
    const staged = this.staged;
    const log = await NodeFSP.open(
      NodePath.join(app.getPath("userData"), "fork-update.log"),
      "a",
      0o600,
    );
    try {
      const child = NodeChildProcess.spawn(
        "/bin/sh",
        [staged.script, String(process.pid), staged.target, staged.directory, staged.executable],
        { detached: true, stdio: ["ignore", log.fd, log.fd] },
      );
      await new Promise<void>((resolve, reject) => {
        child.once("error", reject);
        child.once("spawn", resolve);
      });
      child.unref();
      this.installing = true;
      app.quit();
    } finally {
      await log.close();
    }
  }

  async dispose() {
    if (this.staged && !this.installing) {
      await NodeFSP.rm(this.staged.directory, { recursive: true, force: true });
    }
  }
}
