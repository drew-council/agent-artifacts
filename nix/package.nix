{
  lib,
  stdenvNoCC,
  bun,
  makeWrapper,
}:
stdenvNoCC.mkDerivation {
  pname = "agent-artifacts";
  version = "0.1.0";
  src = lib.cleanSourceWith {
    src = ../.;
    filter =
      path: type:
      let
        name = baseNameOf path;
      in
      !(builtins.elem name [
        ".git"
        "node_modules"
        "dist"
        ".direnv"
        "result"
      ]);
  };
  nativeBuildInputs = [ makeWrapper ];
  dontBuild = true;
  installPhase = ''
    runHook preInstall
    mkdir -p "$out/share/agent-artifacts" "$out/bin"
    cp -R index.ts src templates skills vendor "$out/share/agent-artifacts/"
    makeWrapper ${bun}/bin/bun "$out/bin/agent-artifacts" \
      --add-flags "$out/share/agent-artifacts/index.ts" \
      --set-default AGENT_ARTIFACTS_TEMPLATE "$out/share/agent-artifacts/templates/react-shadcn"
    runHook postInstall
  '';
  meta = {
    description = "Local React/TypeScript artifacts, publication inbox, gallery and portable ZIP exports";
    license = with lib.licenses; [
      mit
      asl20
    ];
    platforms = lib.platforms.unix;
    mainProgram = "agent-artifacts";
  };
}
