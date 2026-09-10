# Development Guide

## Prerequisites

- .NET 10 SDK
- Git
- a Jellyfin 12 test server for integration testing

The plugin references Jellyfin 12.0.0 NuGet packages and targets `net10.0`.

## Build and test

From the repository root:

```bash
dotnet restore jellyfin-advanced-books.slnx
dotnet build jellyfin-advanced-books.slnx -c Release
dotnet test jellyfin-advanced-books.slnx -c Release
```

The Jellyfin assemblies are compile-time dependencies and are excluded from the plugin's runtime
assets. Do not copy Jellyfin server assemblies into the plugin package.

## Project layout

```text
src/
  Jellyfin.AdvancedBooks.Core/       host-independent logic
  Jellyfin.Plugin.AdvancedBooks/     Jellyfin plugin integration
tests/
  Jellyfin.AdvancedBooks.Core.Tests/ unit tests
docs/
  ARCHITECTURE.md
  DEVELOPMENT.md
  ROADMAP.md
```

## Local Jellyfin testing

Use a disposable or backed-up Jellyfin 12 test instance.

1. Build the solution in `Release`.
2. Create a plugin directory named `Advanced Books` under the Jellyfin plugins directory.
3. Copy `Jellyfin.Plugin.AdvancedBooks.dll` and `Jellyfin.AdvancedBooks.Core.dll` into that directory.
4. Restart Jellyfin.
5. Open Dashboard -> Plugins -> Advanced Books and configure the One-Shots matcher.
6. Rescan a small Books test library.

Do not start integration testing with a production-scale library. First test a fixture containing
regular series, several `_oneshots` files, one nested `_oneshots`, and one folder that contains the
text `_oneshots` in the middle of its name.

Packaging/installation metadata will be automated before the first tagged release.

## Coding rules

- Keep Jellyfin-specific types out of `Jellyfin.AdvancedBooks.Core`.
- Add tests for path parsing, ordering and archive edge cases.
- Never use client-provided filesystem paths in future HTTP APIs.
- Prefer streaming over buffering full comic archives.
- Preserve the user's source files; metadata writes must be explicit opt-in behavior if introduced.
- Keep UI integration isolated from server-domain logic.

## Updating Jellyfin dependencies

Jellyfin plugin ABI changes can be breaking. Update `Jellyfin.Controller`, `Jellyfin.Model`,
`Jellyfin.Naming`, `build.yaml`'s `targetAbi`, and the target framework together, then run unit and
integration tests.

## Pull requests

Keep changes focused. A feature that changes resolver behavior should include fixture-style tests and
document any intentional difference from Komga.
