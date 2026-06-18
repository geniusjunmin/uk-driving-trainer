# DevOps Tasks

This file tracks the backlog and execution status of the DevOps Agent.

---

## 任务列表

### [DO-001] 配置 Vite 生产包分块与静态资源打包压缩优化
* **任务状态**: DONE
* **优先级**: HIGH
* **依赖关系**: [ARC-001]
* **输入**: `vite.config.ts`。
* **输出**: 
  * 更新 `vite.config.ts`。
* **验收标准**:
  * 编译包中 Three.js 核心库被拆分至单独的 vendor 块（避免单个 JS 超过 1MB）。
  * 物理引擎 Rapier WASM 文件可以被正确打包并在发布目录中被异步加载。
* **执行步骤**:
  1. 在 `vite.config.ts` 中配置 rollupOptions，使用 `manualChunks` 拆分 node_modules 依赖。
  2. 配置 Vite 插件，支持 `.wasm` 文件作为静态资源或通过特定 loader 载入。
* **完成后需要修改的文件**:
  * `vite.config.ts`
* **完成后需要记录的日志**:
  * "DO-001: 优化了 Vite 打包分块配置，支持异步载入 WASM 及三维引擎的 chunk 分离。"

---

### [DO-002] 编写 GitHub Actions 持续集成与自动化发布流水线
* **任务状态**: DONE
* **优先级**: MEDIUM
* **依赖关系**: [ARC-001], [QA-001]
* **输入**: 自动化构建与测试命令。
* **输出**:
  * 创建 `.github/workflows/ci-cd.yml`。
* **验收标准**:
  * 代码 push 到 main 分支时自动触发。
  * 包含 `Lint` 检查、`Vitest` 测试运行，并在全部通过后将打包产物发布到指定分支（如 `gh-pages`）。
* **执行步骤**:
  1. 创建 Github Actions 配置文件。
  2. 配置 Node 环境缓存 (node_modules cache)。
  3. 配置 Vitest headless 模式运行测试。
  4. 使用 Action 部署到 GitHub Pages 或 Vercel。
* **完成后需要修改的文件**:
  * `.github/workflows/ci-cd.yml`
* **完成后需要记录 the logs**:
  * "DO-002: 完成了 CI/CD 自动化构建、运行测试以及一键部署流水线的配置。"

---

### [DO-003] 编写本地容器化 Docker 与 Nginx 高性能部署配置
* **任务状态**: DONE
* **优先级**: LOW
* **依赖关系**: [DO-001]
* **输入**: Vite 静态编译文件输出目录。
* **输出**:
  * 创建 `deploy/Dockerfile`。
  * 创建 `deploy/nginx.conf`。
* **验收标准**:
  * 可以通过 `docker build -t uk-driver-trainer -f deploy/Dockerfile .` 成功构建镜像。
  * Nginx 配置开启了 gzip/brotli 压缩，并设置了 3D 模型和音频文件的强缓存头。
* **执行步骤**:
  1. 编写多阶段构建 Dockerfile（第一阶段 node 构建，第二阶段 nginx 运行）。
  2. 配置 Nginx 规则，加入静态文件缓存时长（如 `Cache-Control: max-age=31536000`）和 MIME 类型声明。
* **完成后需要修改的文件**:
  * `deploy/Dockerfile`
  * `deploy/nginx.conf`
* **完成后需要记录的日志**:
  * "DO-003: 交付了用于云端或本地部署的 Docker 容器配置与 Nginx 压缩加速配置。"
