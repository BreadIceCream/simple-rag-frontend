import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: Array<RouteRecordRaw> = [
    {
        path: '/',
        component: () => import('@/layout/index.vue'),
        redirect: '/chat',
        children: [
            {
                path: 'chat',
                name: 'Chat',
                component: () => import('@/views/chat/index.vue'),
                meta: { title: 'AI 问答', icon: 'ChatLineRound' }
            },
            {
                path: 'docs',
                name: 'DocumentManagement',
                component: () => import('@/views/docs/index.vue'),
                meta: { title: '知识库管理', icon: 'Document' }
            }
        ]
    }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

export default router
