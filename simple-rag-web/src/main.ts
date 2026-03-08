import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { setupStore } from './store'

import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

import './styles/index.scss'

const app = createApp(App)

// 注册 Element Plus 和图标
app.use(ElementPlus)
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, component)
}

// 注册状态管理和路由
setupStore(app)
app.use(router)

app.mount('#app')
