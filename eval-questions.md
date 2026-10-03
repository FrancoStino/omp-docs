# Chat eval: 10 questions with known answers
Run after every big sync. Ask the chat, compare, note regressions.

1. How do I resume my last session? → `omp --continue` in the same project directory.
2. How do I pick from recent sessions? → `omp --resume` shows the picker.
3. How do I install omp on macOS/Linux? → `curl -fsSL https://omp.sh/install | sh`, then `omp --version`.
4. Where do user settings live? → `~/.omp/agent/config.yml` (user layer); project layer is `.omp/config.yml`.
5. How do I change model mid-session? → `/model` command.
6. What does /plan do? → Plan mode: review the approach before implementation.
7. How do I fork a session? → `/session fork` (or session operations in Sessions page).
8. Where are API keys configured? → Providers page: env vars like `ANTHROPIC_API_KEY` or OAuth sign-in via `/login`.
9. How do I stop a running turn? → Press `Esc`.
10. What is prewalk? → Worker starts on the resolved model for planning, then one-time handoff; `@smol` default target.
