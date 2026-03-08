# Simple RAG Web

基于 **Vue 3** + **Vite** + **TypeScript** 构建的现代化轻量级企业知识库与 RAG（检索增强生成）问答系统前端模块。本项目是对接 Simple RAG 后端的官方配套图形化用户界面，提供直观的对话交互以及文档切片管理体验。

[后端项目](https://github.com/BreadIceCream/simple-rag)

## 🛠️ 技术栈声明
- **核心框架**: Vue 3 (Composition API / `<script setup>`)  
- **构建工具**: Vite  
- **编程语言**: TypeScript  
- **UI 组件库**: Element Plus (`element-plus`)
- **路由管理**: Vue Router 4  
- **状态管理**: Pinia  
- **网络请求**: Axios (基础请求) + Fetch API (自定义 SSE 解析支持) 
- **Markdown渲染**: `markdown-it` + `highlight.js` (安全转义并提供优异的代码染色效果)
- **样式预编**: SCSS (`sass`)

---

## ✨ 核心特性

<video src="https://github.com/BreadIceCream/simple-rag/raw/main/assets/SimpleRAG.mp4" controls width="100%"></video>

1. **智能问答 (Chat)**：

   - 全异步**流式输出 (Server-Sent Events)** 界面，响应迅速。
   - 自动化的聊天**内容格式解析** (无序/有序列表、表格、链接、代码高亮自适应渲染)。
   - **参考资料溯源抽屉**：回答附带引用的资料，点击即可在侧边抽屉查阅具体来自哪些碎片的索引和原文。
   - **白名单配置范围**：对话框前可限定或筛选 RAG 读取的文档参考库白名单，避免无关干扰。

2. **文档知识库管理 (Document Management)**：

   - 展现已处理成功的全站参考资产列表。
   - 支持动态查拉各文档底下的**底层切片详情 (Chunks) 与子块数**，带有后端直传的分页管理能力，结构直白清晰。
   - 支持直观的通过本地绝对路径进行文档上报导入以及文档销毁行为。

3. **对话历史管理 (History Management)**：

   - 全局常驻侧边栏保存对话的快照列表。
   - 在旧问答和新问答间瞬时切变，并自动高亮呈现当前激活的会话上下文。
   - 提供改名与单条对话销毁下拉操作菜单支持。

---

## 📂 项目核心结构

在 `src/` 目录下，前端应用的源码被划分为如下重点结构：

```text
src/
├── assets/         # 静态资源 (如图标, 默认图片)
├── components/     # 全局复用的 Vue 组件
├── layout/         # 页面框架组件 (如包含侧边栏聊天历史的统一布局组件 layout/index.vue)
├── router/         # 前端路由挂载点，管理各个视图的跳转
├── store/          # Pinia 全局状态库 (核心: chat.ts 负责管理当前的对话、消息队列状态)
├── styles/         # 全局通用样式以及主题配色变量
├── utils/          # 共用函数封装工具库。包含封装过拦截器的 axios: `request.ts` 与处理流数据的 `sse.ts`
├── views/          # 核心业务页面
│   ├── chat/       # 智能问答对话面板：包含 SSE 流式打字机渲染、右侧参考资料抽屉展示和引用溯源
│   └── docs/       # 知识库管理面板：文档列表、切片(Chunks)预览抽屉以及本地文档上传功能
├── App.vue         # 根挂载组件
└── main.ts         # 前端主入口文件
```

---

## 🚀 启动与运行

确保您的本地环境已有 Node.js (建议 18.x 或以上版本)。

1. **安装依赖**
   ```bash
   npm install
   ```

2. **本地环境热重载运行**
   ```bash
   npm run dev
   ```

3. **构建生产版本静态产物**
   ```bash
   npm run build
   ```

## 🔧 环境配置说明

如果需要调整对接的后端服务器地址，请移步检查 `vite.config.ts` 中的 `proxy` 跨域代理规则，以及 `src/utils/request.ts` 或全局环境变量对于 `baseURL` 的指向拦截定义。保证默认请求能够成功发送至 RAG 后台系统的 `/api` 下即可正常联动工作。
