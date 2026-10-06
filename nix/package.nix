{
  lib,
  stdenvNoCC,
  bun,
  makeWrapper,
  fetchurl,
  python3,
}:
let
  # The only runtime dependency. Fixed-output fetch keeps the build hermetic
  # without an npm lockfile or a writable npm cache.
  commander = fetchurl {
    url = "https://registry.npmjs.org/commander/-/commander-15.0.0.tgz";
    hash = "sha256-YyweA5sx6Y+nnE+uWxCl/7v53w8hyf+z106Vc0swaW8=";
  };
  unpackCommander = ''
    mkdir -p node_modules/commander
    tar -xzf ${commander} -C node_modules/commander --strip-components=1
  '';
in
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
  nativeCheckInputs = [
    bun
    python3
  ];
  doCheck = true;
  dontBuild = true;
  checkPhase = ''
    runHook preCheck
    ${unpackCommander}
    export TEST_TMPDIR="''${TMPDIR:-/tmp}"
    ${bun}/bin/bun test tests
    ${bun}/bin/bun index.ts --help > /dev/null
    runHook postCheck
  '';
  installPhase = ''
    runHook preInstall
    ${unpackCommander}
    mkdir -p "$out/share/agent-artifacts" "$out/bin"
    cp -R index.ts src resources templates vendor node_modules "$out/share/agent-artifacts/"
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
