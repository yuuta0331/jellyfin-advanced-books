# Contributing

Thank you for improving Jellyfin Advanced Books.

Before opening a pull request, read `docs/ARCHITECTURE.md` and `docs/DEVELOPMENT.md`.

For behavior changes, include a focused test where practical. For Komga-compatibility changes, include
the source layout that demonstrates the behavior and state whether the result intentionally matches or
differs from Komga.

Please keep source-media safety as the default: scanning and reading should not rename, move, delete or
rewrite books.

Run:

```bash
dotnet build jellyfin-advanced-books.slnx -c Release
dotnet test jellyfin-advanced-books.slnx -c Release
```

before submitting changes.

## AI-assisted contributions

AI-assisted contributions are welcome, but contributors remain responsible for the correctness, security, licensing and maintainability of everything they submit.

If AI tools materially assisted a pull request, disclose that in the pull request description and briefly describe what they were used for. AI-assisted changes should receive the same review and testing as any other contribution.

See `AI_USAGE.md` for the project's disclosure policy.
