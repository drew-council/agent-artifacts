{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    topiary-nushell = {
      url = "github:drew-council/topiary-nushell-nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    treefmt-nix.url = "github:numtide/treefmt-nix";
  };
  outputs =
    inputs@{
      self,
      nixpkgs,
      flake-utils,
      topiary-nushell,
      treefmt-nix,
      ...
    }:
    {
      homeManagerModules.default = import ./nix/home-manager.nix;
      homeManagerModules.nixos = import ./nix/home-manager.nix;
      homeManagerModules.darwin = import ./nix/home-manager.nix;
    }
    // flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs {
          inherit system;
        };
        treefmtEval = treefmt-nix.lib.evalModule pkgs {
          imports = [
            topiary-nushell.treefmtModules.default
            ./treefmt.nix
          ];
        };
      in
      {
        packages.default = pkgs.callPackage ./nix/package.nix { };
        packages.agent-artifacts = self.packages.${system}.default;
        apps.default = {
          type = "app";
          program = "${self.packages.${system}.default}/bin/agent-artifacts";
        };

        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            (aspellWithDicts (ps: with ps; [ en ]))
            nushell
            bun
            biome
          ];
        };

        formatter = treefmtEval.config.build.wrapper;
        checks = {
          formatting = treefmtEval.config.build.check self;
          unit =
            pkgs.runCommand "agent-artifacts-tests"
              {
                nativeBuildInputs = [
                  pkgs.bun
                  pkgs.python3
                ];
              }
              ''
                export TEST_TMPDIR="$TMPDIR"
                bun test ${self}/tests
                touch "$out"
              '';
          cli =
            pkgs.runCommand "agent-artifacts-cli"
              {
                nativeBuildInputs = [ self.packages.${system}.default ];
              }
              ''
                agent-artifacts --help > "$out"
              '';
        };
      }
    );
}
