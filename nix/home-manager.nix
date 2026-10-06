{
  config,
  lib,
  pkgs,
  ...
}:
let
  cfg = config.services.agent-artifacts;
  configFile = "${config.xdg.configHome}/agent-artifacts/config.json";
  command = pkgs.writeShellScriptBin "agent-artifacts" ''
    export AGENT_ARTIFACTS_CONFIG="''${AGENT_ARTIFACTS_CONFIG:-${configFile}}"
    exec ${lib.getExe cfg.package} "$@"
  '';
  logs = "${config.home.homeDirectory}/Library/Logs/agent-artifacts";
in
{
  options.services.agent-artifacts = {
    enable = lib.mkEnableOption "the local artifact host and submission CLI";
    package = lib.mkOption {
      type = lib.types.package;
      default = pkgs.callPackage ./package.nix { };
      description = "The agent-artifacts package.";
    };
    dataDir = lib.mkOption {
      type = lib.types.str;
      default = "${config.xdg.dataHome}/agent-artifacts";
      description = "Private local inbox, artifact snapshots and failed submissions.";
    };
    port = lib.mkOption {
      type = lib.types.port;
      default = 41780;
      description = "Loopback-only HTTP port.";
    };
    pollIntervalMs = lib.mkOption {
      type = lib.types.ints.between 100 60000;
      default = 1000;
    };
  };
  config = lib.mkIf cfg.enable {
    home.packages = [
      command
      pkgs.bun
    ];
    xdg.configFile."agent-artifacts/config.json".text = builtins.toJSON {
      inherit (cfg) dataDir port pollIntervalMs;
    };
    systemd.user.services.agent-artifacts = lib.mkIf pkgs.stdenv.hostPlatform.isLinux {
      Unit = {
        Description = "Local agent artifact host";
        After = [ "default.target" ];
      };
      Service = {
        ExecStart = "${command}/bin/agent-artifacts serve";
        Restart = "on-failure";
        RestartSec = 2;
        UMask = "0077";
        NoNewPrivileges = true;
      };
      Install.WantedBy = [ "default.target" ];
    };
    launchd.agents.agent-artifacts = lib.mkIf pkgs.stdenv.hostPlatform.isDarwin {
      enable = true;
      config = {
        ProgramArguments = [
          "${command}/bin/agent-artifacts"
          "serve"
        ];
        RunAtLoad = true;
        KeepAlive = true;
        ThrottleInterval = 2;
        Umask = 63;
        StandardOutPath = "${logs}/stdout.log";
        StandardErrorPath = "${logs}/stderr.log";
      };
    };
    home.activation.agentArtifactsDirectories = lib.hm.dag.entryAfter [ "writeBoundary" ] ''
      run mkdir -p ${lib.escapeShellArg cfg.dataDir}
      run chmod 700 ${lib.escapeShellArg cfg.dataDir}
      ${lib.optionalString pkgs.stdenv.hostPlatform.isDarwin ''
        run mkdir -p ${lib.escapeShellArg logs}
      ''}
    '';
  };
}
