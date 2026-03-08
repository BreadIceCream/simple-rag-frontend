import { defineStore } from 'pinia'
import { ref } from 'vue'
import request from '@/utils/request'

export const useChatStore = defineStore('chat', () => {
    const currentConversationId = ref<string>('')
    const conversations = ref<any[]>([])
    const messages = ref<any[]>([])

    const fetchConversations = async () => {
        try {
            const res: any = await request.get('/conversation/list')
            if (res.code === 200) {
                conversations.value = res.data || []
            }
        } catch (e) { }
    }

    const fetchHistory = async (id: string) => {
        try {
            const res: any = await request.get(`/conversation/history?conversation_id=${id}`)
            if (res.code === 200 && res.data) {
                messages.value = res.data.messages || []
                currentConversationId.value = id
            }
        } catch (e) { }
    }

    const renameConversation = async (id: string, newTitle: string) => {
        try {
            const res: any = await request.put(`/conversation/${id}/title`, { title: newTitle })
            if (res.code === 200 && res.data) {
                const updatedTitle = res.data.title
                const conv = conversations.value.find(c => c.id === id)
                if (conv) {
                    conv.title = updatedTitle
                }
            }
        } catch (e) { }
    }

    const deleteConversation = async (id: string) => {
        try {
            const res: any = await request.delete(`/conversation/${id}`)
            if (res.code === 200) {
                if (currentConversationId.value === id) {
                    currentConversationId.value = ''
                    messages.value = []
                }
                await fetchConversations()
            }
        } catch (e) { }
    }

    return {
        currentConversationId,
        conversations,
        messages,
        fetchConversations,
        fetchHistory,
        renameConversation,
        deleteConversation
    }
})
