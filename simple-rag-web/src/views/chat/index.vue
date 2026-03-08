<template>
    <div class="chat-wrapper">
        <!-- Chat Header with References Selector -->
        <div class="chat-header">
            <div class="chat-title">
                <el-icon>
                    <ChatDotRound />
                </el-icon>
                <span>{{ currentTitle || '新对话' }}</span>
            </div>
            <div class="chat-actions">
                <el-button type="primary" :icon="Plus" plain @click="startNewChat">新对话</el-button>
            </div>
        </div>

        <!-- Message List Area -->
        <div class="message-list" ref="messageListRef">
            <div v-if="chatStore.messages.length === 0" class="empty-chat">
                <el-empty description="输入问题，开始与 Simple RAG 进行对话" />
            </div>

            <div v-for="(msg, index) in chatStore.messages" :key="index"
                :class="['message-item', msg.role === 'user' ? 'is-user' : 'is-ai']">
                <el-avatar :size="40" :icon="msg.role === 'user' ? User : Platform" :class="['avatar', msg.role]" />
                <div class="message-content glass-panel">
                    <!-- Text Content -->
                    <div class="markdown-body" v-html="renderMarkdown(msg.content)"></div>

                    <!-- References (Only for AI and when available) -->
                    <div v-if="msg.references && msg.references.length > 0" class="references-block">
                        <el-divider content-position="left" class="ref-divider">
                            <el-button link type="primary" size="small" @click="openReferencesDrawer(msg.references)">
                                <el-icon class="el-icon--left"><Document /></el-icon>相关资料 ({{ msg.references.length }}篇)
                            </el-button>
                        </el-divider>
                    </div>
                </div>
            </div>

            <!-- Streaming Answer Indicator -->
            <div v-if="isStreaming" class="message-item is-ai">
                <el-avatar :size="40" :icon="Platform" class="avatar ai" />
                <div class="message-content glass-panel">
                    <div v-if="streamingStatus" class="status-indicator">
                        <el-icon class="is-loading">
                            <Loading />
                        </el-icon>
                        {{ streamingStatus }}
                    </div>
                    <div class="markdown-body" v-html="renderMarkdown(streamingContent)"></div>
                </div>
            </div>
        </div>

        <!-- Input Area -->
        <div class="input-area glass-panel">
            <div class="input-controls">
                <el-select v-model="selectedReferenceIds" multiple collapse-tags collapse-tags-tooltip clearable
                    placeholder="选择参考资料" placement="top" class="reference-selector" @visible-change="handleReferenceVisibleChange"
                    @clear="updateReferences" @remove-tag="updateReferences">
                    <template #prefix>
                        <el-icon><Document /></el-icon>
                    </template>
                    <el-option v-for="item in allDocs" :key="item.id" :label="item.file_name || item.path"
                        :value="item.id" />
                </el-select>
            </div>
            <div class="input-wrapper">
                <el-input v-model="userInput" type="textarea" :rows="3" resize="none"
                    placeholder="在这里输入您的问题... (Shift + Enter 换行，Enter 发送)" @keydown.enter.prevent="handleEnter" />
                <div class="input-actions">
                    <el-button type="primary" :icon="Position" @click="sendMessage" :loading="isStreaming" circle
                        size="large" />
                </div>
            </div>
        </div>

        <!-- References Drawer -->
        <el-drawer v-model="showRefDrawer" title="相关资料" size="40%">
            <div class="ref-drawer-content">
                <el-collapse v-model="activeRefNames">
                    <el-collapse-item v-for="(refItem, rIdx) in currentRefs" :key="rIdx"
                        :name="rIdx">
                        <template #title>
                            <span class="ref-drawer-title">[{{ Number(rIdx) + 1 }}] {{ refItem.file_name || refItem.path }}</span>
                        </template>
                        <div class="ref-chunk-container">
                            <div v-for="(pDoc, pIdx) in refItem.parent_docs" :key="pIdx" class="ref-chunk">
                                <span class="chunk-badge">片段 {{ pDoc.parent_index }}</span>
                                <div class="chunk-text">{{ pDoc.content }}</div>
                            </div>
                        </div>
                    </el-collapse-item>
                </el-collapse>
            </div>
        </el-drawer>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { Plus, Position, User, Platform, ChatDotRound, Loading, Document } from '@element-plus/icons-vue'
import { useChatStore } from '@/store/chat'
import request from '@/utils/request'
import { fetchSSE } from '@/utils/sse'
import MarkdownIt from 'markdown-it/lib/index.mjs'
import hljs from 'highlight.js'
import 'highlight.js/styles/atom-one-dark.css'
import { ElMessage } from 'element-plus'

const chatStore = useChatStore()
const md: any = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
    highlight: function (str: string, lang: string): string {
        if (lang && hljs.getLanguage(lang)) {
            try {
                return '<pre class="hljs"><code>' +
                    hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
                    '</code></pre>';
            } catch (__) { }
        }
        return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>';
    }
})

const messageListRef = ref<HTMLElement | null>(null)
const userInput = ref('')
const isStreaming = ref(false)
const streamingContent = ref('')
const streamingStatus = ref('')

const showRefDrawer = ref(false)
const currentRefs = ref<any[]>([])
const activeRefNames = ref<number[]>([])

const openReferencesDrawer = (refs: any[]) => {
    currentRefs.value = refs
    activeRefNames.value = [] // Default to all collapsed
    showRefDrawer.value = true
}

const allDocs = ref<any[]>([])
const selectedReferenceIds = ref<string[]>([])

const currentTitle = computed(() => {
    if (!chatStore.currentConversationId) return ''
    const conv = chatStore.conversations.find((c: any) => c.id === chatStore.currentConversationId)
    return conv ? conv.title : '新对话'
})

const renderMarkdown = (text: string) => {
    if (!text) return ''
    return md.render(text)
}

const scrollToBottom = () => {
    nextTick(() => {
        if (messageListRef.value) {
            messageListRef.value.scrollTop = messageListRef.value.scrollHeight
        }
    })
}

const fetchAllDocs = async () => {
    try {
        const res: any = await request.get('/documents/list')
        allDocs.value = res.data || []
    } catch (e) { }
}

const fetchCurrentReferences = async () => {
    try {
        const res: any = await request.get('/retrieval/references')
        const refs = res.data || []
        selectedReferenceIds.value = refs.map((d: any) => d.id)
    } catch (e) { }
}

const updateReferences = async () => {
    try {
        let res: any
        if (selectedReferenceIds.value.length === 0) {
            res = await request.delete('/retrieval/references')
            ElMessage.success(res?.message || '已取消参考任何资料')
        } else {
            res = await request.post('/retrieval/references', selectedReferenceIds.value)
            ElMessage.success(res?.message || '已更新参考资料范围')
        }
    } catch (e) { }
}

// Track previous state to avoid redundant requests
let previousReferenceIds: string[] = []

const handleReferenceVisibleChange = (visible: boolean) => {
    if (visible) {
        // Store current selection when dropdown opens
        previousReferenceIds = [...selectedReferenceIds.value]
    } else {
        // Compare current selection with stored selection when dropdown closes
        const hasChanged = selectedReferenceIds.value.length !== previousReferenceIds.length ||
            !selectedReferenceIds.value.every(id => previousReferenceIds.includes(id))

        if (hasChanged) {
            updateReferences()
        }
    }
}

const startNewChat = () => {
    chatStore.currentConversationId = ''
    chatStore.messages = []
    userInput.value = ''
}

const handleEnter = (e: KeyboardEvent) => {
    if (!e.shiftKey) {
        sendMessage()
    } else {
        userInput.value += '\n'
    }
}

const sendMessage = async () => {
    const content = userInput.value.trim()
    if (!content || isStreaming.value) return

    // Optimistic update for UI
    chatStore.messages.push({
        role: 'user',
        content: content
    })

    userInput.value = ''
    isStreaming.value = true
    streamingContent.value = ''
    streamingStatus.value = '即将开始...'
    scrollToBottom()

    const payload = {
        message: content,
        conversationId: chatStore.currentConversationId || undefined
    }

    try {
        await fetchSSE('/api/conversation/chat', {
            method: 'POST',
            body: JSON.stringify(payload)
        }, (eventData) => {
            // Handle the data payload
            if (eventData.status === 'progress') {
                if (eventData.event === 'Conversation created.') {
                    if (eventData.conversation) {
                        chatStore.currentConversationId = eventData.conversation.id
                        // Prepend the new conversation to update sidebar and title immediately
                        const exists = chatStore.conversations.find((c: any) => c.id === eventData.conversation.id)
                        if (!exists) {
                            chatStore.conversations.unshift(eventData.conversation)
                        }
                    }
                } else if (eventData.event === 'Token streaming.') {
                    streamingContent.value += eventData.token || ''
                    streamingStatus.value = '' // Clear loading status once text starts
                    scrollToBottom()
                } else {
                    streamingStatus.value = eventData.event // "正在检索..." etc
                }
            } else if (eventData.status === 'finished') {
                if (eventData.event === 'Answer generated.') {
                    // Stream complete, push ai message
                    chatStore.messages.push({
                        role: 'ai',
                        content: eventData.answer,
                        references: eventData.references
                    })
                    if (eventData.conversation_id) {
                        chatStore.currentConversationId = eventData.conversation_id
                        chatStore.fetchConversations() // refresh sidebar
                    }
                }
            } else if (eventData.status === 'error') {
                ElMessage.error(eventData.message || 'Stream Error')
                if (eventData.conversation_id) {
                    chatStore.currentConversationId = eventData.conversation_id
                }
            }
        }, () => {
            ElMessage.error('无法连接到服务端')
            isStreaming.value = false
        }, () => {
            // Done
            isStreaming.value = false
            streamingContent.value = ''
            streamingStatus.value = ''
            scrollToBottom()
        })
    } catch (e) {
        isStreaming.value = false
    }
}

onMounted(() => {
    fetchAllDocs()
    fetchCurrentReferences()
    chatStore.fetchConversations()
})
</script>

<style scoped lang="scss">
.chat-wrapper {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 0;
    box-sizing: border-box;
    background-color: var(--bg-color);
}

.chat-header {
    height: 60px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 24px;
    border-bottom: 1px solid var(--border-color);
    background-color: var(--panel-bg);

    .chat-title {
        font-size: 18px;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .chat-actions {
        display: flex;
        gap: 12px;
    }
}

.message-list {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    scroll-behavior: smooth;

    .empty-chat {
        display: flex;
        height: 100%;
        align-items: center;
        justify-content: center;
    }

    .message-item {
        display: flex;
        gap: 16px;
        max-width: 85%;

        &.is-user {
            align-self: flex-end;
            flex-direction: row-reverse;

            .message-content {
                background: var(--el-color-primary);
                color: #fff;
                border-radius: 12px 0 12px 12px;
            }
        }

        &.is-ai {
            align-self: flex-start;

            .message-content {
                border-radius: 0 12px 12px 12px;
            }
        }

        .avatar {
            flex-shrink: 0;

            &.user {
                background-color: #a855f7;
            }

            &.ai {
                background-color: var(--el-color-primary);
            }
        }

        .message-content {
            padding: 12px 16px;
            min-width: 100px;
            border: none;

            .status-indicator {
                font-size: 13px;
                color: var(--text-secondary);
                display: flex;
                align-items: center;
                gap: 6px;
                margin-bottom: 8px;
            }

            .references-block {
                margin-top: 16px;
                margin-bottom: 10px;
                
                .ref-divider {
                    margin: 12px 0 0 0;
                    
                    :deep(.el-divider__text) {
                        background-color: var(--panel-bg, transparent);
                        padding: 0 10px;
                        font-size: 14px;
                        
                        .el-button {
                            font-size: 12px;
                        }
                    }
                }
            }
        }
    }
}

.input-area {
    margin: 0 24px 24px 24px;
    padding: 12px;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;

    .input-controls {
        display: flex;
        padding: 0 4px;
        margin-left: 6px;

        .reference-selector {
            width: 200px;
            
            :deep(.el-input__wrapper) {
                background: transparent;
                box-shadow: none;
                padding-left: 0;

                &:hover, &.is-focus {
                    box-shadow: none;
                }
            }
        }
    }

    .input-wrapper {
        display: flex;
        gap: 12px;
        align-items: flex-end;

        :deep(.el-textarea__inner) {
            background: transparent;
            border: none;
            box-shadow: none;
            color: var(--text-primary);

            &:focus {
                box-shadow: none;
            }
        }

        .input-actions {
            padding-bottom: 4px;
            padding-right: 4px;
        }
    }
}

/* Markdown Custom Styles */
:deep(.markdown-body) {
    font-size: 14px;
    line-height: 1.6;

    & > *:first-child {
        margin-top: 0;
    }

    p {
        margin-top: 0;
        margin-bottom: 12px;
    }

    p:last-child {
        margin-bottom: 0;
    }

    h1, h2, h3, h4, h5, h6 {
        margin-top: 16px;
        margin-bottom: 8px;
        font-weight: 600;
        line-height: 1.25;
    }

    h1 { font-size: 1.4em; }
    h2 { font-size: 1.3em; }
    h3 { font-size: 1.2em; }
    h4, h5, h6 { font-size: 1.1em; }

    a {
        color: var(--el-color-primary);
        text-decoration: none;
        word-break: break-all;
        
        &:hover {
            text-decoration: underline;
        }
    }

    blockquote {
        margin: 0 0 12px 0;
        padding: 8px 16px;
        border-left: 4px solid var(--el-color-primary);
        background-color: var(--el-fill-color-light, rgba(0, 0, 0, 0.05));
        color: var(--text-secondary);
        border-radius: 0 4px 4px 0;
        
        p {
            margin-bottom: 0;
        }
    }

    table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 12px;
        overflow-x: auto;
        display: block;

        th, td {
            border: 1px solid var(--border-color);
            padding: 8px 12px;
        }

        th {
            background-color: var(--el-fill-color-light, rgba(0, 0, 0, 0.05));
            font-weight: 600;
        }
    }

    ul, ol {
        margin-bottom: 12px;
        padding-left: 20px;
    }

    ul {
        list-style-type: disc;
    }

    ol {
        list-style-type: decimal;
    }

    li {
        margin-bottom: 4px;
        line-height: inherit;
    }

    pre {
        margin-bottom: 12px;
        background: #282c34;
        border-radius: 6px;
        padding: 12px;
        overflow-x: auto;
        color: #abb2bf;

        code {
            font-family: Consolas, Monaco, monospace;
            font-size: 13px;
            background: transparent;
            padding: 0;
            color: inherit;
        }
    }

    code {
        background: var(--el-fill-color-light, rgba(0, 0, 0, 0.05));
        padding: 2px 4px;
        border-radius: 4px;
        font-family: Consolas, Monaco, monospace;
        font-size: 13px;
        color: var(--el-color-danger, #f56c6c);
    }
}
</style>

<style lang="scss">
.ref-drawer-content {
    .ref-chunk-container {
        max-height: 400px;
        overflow-y: auto;
        padding-right: 4px;
        margin-top: 8px;
        
        /* 隐藏原生滚动条使其稍微美观，可选 */
        &::-webkit-scrollbar {
            width: 6px;
        }
        &::-webkit-scrollbar-thumb {
            background-color: var(--border-color);
            border-radius: 3px;
        }
    }

    .ref-drawer-title {
        font-weight: 600;
        font-size: 16px;
        color: var(--text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        padding-right: 12px;
    }

    .ref-chunk {
        margin-bottom: 12px;
        padding: 10px;
        background-color: var(--el-fill-color-light, #f5f7fa);
        border-radius: 6px;

        .chunk-badge {
            font-size: 14px;
            font-weight: 500;
            color: var(--el-color-primary);
            margin-bottom: 4px;
            display: inline-block;
        }

        .chunk-text {
            font-size: 13px;
            line-height: 1.5;
            color: var(--text-regular);
            white-space: pre-wrap;
            word-break: break-all;
        }
    }
}
</style>
