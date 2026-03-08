<template>
  <div class="app-wrapper">
    <!-- Sidebar -->
    <div class="sidebar glass-panel">
      <div class="sidebar-header">
        <h2 class="logo-title">Simple RAG</h2>
      </div>

      <el-menu :default-active="activeMenu" class="custom-menu" background-color="transparent"
        text-color="var(--text-regular)" active-text-color="var(--el-color-primary)" router>
        <el-menu-item index="/chat">
          <el-icon>
            <ChatLineRound />
          </el-icon>
          <span>AI 问答</span>
        </el-menu-item>
        <el-menu-item index="/docs">
          <el-icon>
            <Document />
          </el-icon>
          <span>知识库管理</span>
        </el-menu-item>
      </el-menu>

      <div class="history-divider">
        <el-divider content-position="left">历史对话</el-divider>
      </div>

      <div class="history-list">
        <div 
          v-for="conv in chatStore.conversations" 
          :key="conv.id" 
          class="history-item"
          :class="{ active: chatStore.currentConversationId === conv.id && route.path === '/chat' }"
          @click="switchConversation(conv.id)"
        >
          <span class="conv-title">{{ conv.title || '新对话' }}</span>
          <div class="action-wrapper" @click.stop>
            <el-dropdown trigger="click" @command="handleCommand($event, conv.id, conv.title)">
              <el-icon class="action-icon"><MoreFilled /></el-icon>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="rename">修改标题</el-dropdown-item>
                  <el-dropdown-item command="delete" style="color: #f56c6c;">删除</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
      </div>

      <div class="sidebar-footer">
        <!-- Optional: Dark mode toggle, Settings, etc -->
        <el-switch v-model="isDark" class="theme-switch" inline-prompt active-icon="Moon" inactive-icon="Sunny"
          @change="toggleTheme" />
      </div>
    </div>

    <!-- Main Content -->
    <div class="main-container">
      <router-view v-slot="{ Component }">
        <transition name="fade-transform" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useChatStore } from '@/store/chat'
import { ChatLineRound, Document, MoreFilled } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const route = useRoute()
const router = useRouter()
const activeMenu = computed(() => route.path)
const chatStore = useChatStore()

const switchConversation = async (id: string) => {
  if (route.path !== '/chat') {
    router.push('/chat')
  }
  await chatStore.fetchHistory(id)
}

const handleCommand = (command: string, id: string, oldTitle: string) => {
  if (command === 'rename') {
    ElMessageBox.prompt('请输入新的对话标题', '修改标题', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputValue: oldTitle,
      inputValidator: (value) => {
        if (!value || value.trim() === '') {
          return '标题不能为空'
        }
        return true
      }
    }).then(async ({ value }) => {
      await chatStore.renameConversation(id, value)
      ElMessage.success('修改标题成功')
    }).catch(() => {})
  } else if (command === 'delete') {
    ElMessageBox.confirm('确定要删除这条对话吗？此操作不可恢复。', '确认删除', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }).then(async () => {
      await chatStore.deleteConversation(id)
      ElMessage.success('删除成功')
    }).catch(() => {})
  }
}

const isDark = ref(false)

const toggleTheme = (val: boolean) => {
  if (val) {
    document.documentElement.classList.add('dark')
    localStorage.setItem('theme', 'dark')
  } else {
    document.documentElement.classList.remove('dark')
    localStorage.setItem('theme', 'light')
  }
}

onMounted(() => {
  const theme = localStorage.getItem('theme')
  if (theme === 'dark') {
    isDark.value = true
    document.documentElement.classList.add('dark')
  }
  chatStore.fetchConversations()
})
</script>

<style scoped lang="scss">
.app-wrapper {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background-color: var(--bg-color);
}

.sidebar {
  width: 260px;
  height: 100%;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-color);
  z-index: 10;
  transition: all 0.3s ease;

  .sidebar-header {
    height: 70px;
    display: flex;
    align-items: center;
    padding: 0 20px;
    border-bottom: 1px solid var(--border-color);

    .logo-title {
      margin: 0;
      font-size: 22px;
      font-weight: 600;
      background: linear-gradient(135deg, var(--el-color-primary), #a855f7);
      background-clip: text;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
  }

  .custom-menu {
    border-right: none;
    padding-top: 10px;
    flex-shrink: 0;

    .el-menu-item {
      margin: 8px 16px;
      border-radius: 8px;
      height: 48px;
      line-height: 48px;

      &.is-active {
        background-color: rgba(64, 158, 255, 0.1);
        font-weight: 500;
      }

      &:hover {
        background-color: rgba(64, 158, 255, 0.05);
      }
    }
  }

  .history-divider {
    padding: 0 20px;
    margin-bottom: 0px;
    margin-top: -5px;
    
    :deep(.el-divider__text) {
      font-size: 13px;
      color: var(--text-secondary);
      background-color: var(--panel-bg, #fff);
    }
  }

  /* For dark mode background fix of el-divider__text */
  :global(.dark .history-divider .el-divider__text) {
     background-color: #141414 !important;
  }

  .history-list {
    flex: 1;
    overflow-y: auto;
    padding: 0 16px 16px 16px;

    .history-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 12px;
      height: 40px;
      margin-bottom: 4px;
      border-radius: 10px;
      cursor: pointer;
      color: var(--text-regular);
      transition: background-color 0.2s;

      .conv-title {
        font-size: 14px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        flex: 1;
        margin-right: 8px;
      }

      .action-wrapper {
        display: flex;
        align-items: center;

        .action-icon {
          opacity: 0;
          transition: opacity 0.2s;
          color: var(--text-secondary);
          outline: none;
          
          &:hover {
            color: var(--el-color-primary);
          }
        }
      }

      &:hover {
        background-color: var(--el-fill-color-light, rgba(0, 0, 0, 0.05));
        .action-icon {
          opacity: 1;
        }
      }

      &.active {
        background-color: rgba(64, 158, 255, 0.15); /* light blue rounded background */
        color: var(--el-color-primary);
        font-weight: 500;
        
        .action-icon {
          opacity: 1; /* always show icon on active item */
        }
      }
    }
  }

  .sidebar-footer {
    padding: 20px;
    border-top: 1px solid var(--border-color);
    display: flex;
    justify-content: center;
    align-items: center;
  }
}

.main-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  background-color: var(--bg-color);
}

/* Page transitions */
.fade-transform-enter-active,
.fade-transform-leave-active {
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.fade-transform-enter-from {
  opacity: 0;
  transform: translateX(-10px);
}

.fade-transform-leave-to {
  opacity: 0;
  transform: translateX(10px);
}
</style>
