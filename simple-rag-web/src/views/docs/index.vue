<template>
    <div class="docs-container">
        <div class="header-actions">
            <h2>知识库管理</h2>
            <div class="actions">
                <el-button type="primary" :icon="Upload" @click="showUploadDialog = true">上传文档</el-button>
                <el-button type="success" :icon="Link" @click="showUrlDialog = true">导入网页</el-button>
                <el-button :icon="Refresh" circle @click="fetchDocs" />
            </div>
        </div>

        <el-table :data="docList" v-loading="loading" style="width: 100%" class="glass-panel"
            height="calc(100vh - 120px)" @row-dblclick="handleRowDblclick">
            <el-table-column prop="file_name" label="文件名/网页标题" min-width="120">
                <template #default="scope">
                    <span>{{ scope.row.file_name || scope.row.path }}</span>
                </template>
            </el-table-column>
            <el-table-column prop="path" label="路径" min-width="200">
                <template #default="scope">
                    <span>{{ scope.row.path }}</span>
                </template>
            </el-table-column>
            <el-table-column prop="file_extension" label="类型" width="80">
                <template #default="scope">
                    <el-tag :type="scope.row.is_url ? 'success' : 'info'">
                        {{ scope.row.is_url ? 'URL' : scope.row.file_extension }}
                    </el-tag>
                </template>
            </el-table-column>
            <el-table-column prop="last_modified" label="更新时间" width="150">
                <template #default="scope">
                    {{ formatDate(scope.row.last_modified) }}
                </template>
            </el-table-column>
            <el-table-column label="操作" width="200" fixed="right">
                <template #default="scope">
                    <el-button link type="primary" size="small" @click="previewChunks(scope.row)">分块预览</el-button>
                    <el-popconfirm width="auto"  title="确认删除?" @confirm="handleDelete(scope.row.id)">
                        <template #reference>
                            <el-button link type="danger" size="small">删除</el-button>
                        </template>
                    </el-popconfirm>
                </template>
            </el-table-column>
        </el-table>

        <!-- Upload Dialog -->
        <el-dialog v-model="showUploadDialog" title="上传本地文档" width="500px">
            <el-form label-width="80px">
                <el-form-item label="绝对路径">
                    <el-input v-model="uploadForm.filePath" placeholder="C:\path\to\file.pdf 或 /path/to/file.pdf"
                        clearable />
                </el-form-item>
            </el-form>
            <template #footer>
                <span class="dialog-footer">
                    <el-button @click="showUploadDialog = false">取消</el-button>
                    <el-button type="primary" @click="submitLocalUpload" :loading="uploadSubmitting">导入</el-button>
                </span>
            </template>
        </el-dialog>

        <!-- URL Dialog -->
        <el-dialog v-model="showUrlDialog" title="导入网络网页" width="500px">
            <el-form label-width="80px">
                <el-form-item label="网页 URL">
                    <el-input v-model="urlForm.url" placeholder="https://example.com" clearable />
                </el-form-item>
            </el-form>
            <template #footer>
                <span class="dialog-footer">
                    <el-button @click="showUrlDialog = false">取消</el-button>
                    <el-button type="primary" @click="submitUrl" :loading="urlSubmitting">导入</el-button>
                </span>
            </template>
        </el-dialog>

        <!-- Chunks Drawer -->
        <el-drawer v-model="showChunksDrawer" :title="`分块预览: ${currentDoc?.file_name || currentDoc?.path}`" size="40%">
            <div v-loading="chunksLoading" class="chunks-container">
                <div v-if="chunksTotal === 0 && !chunksLoading">该文档无分块数据</div>
                <div class="chunks-list">
                    <el-collapse v-model="activeChunkIds">
                        <el-collapse-item v-for="(chunk, idx) in chunks" :key="chunk.id || idx" :name="chunk.id || idx">
                            <template #title>
                                <div class="chunk-header-title">
                                    <span class="chunk-index">{{ chunk.metadata?.parent_index !== undefined ? chunk.metadata.parent_index + 1 : idx + 1 }}</span>
                                    <span class="chunk-id">: {{ chunk.id || 'N/A' }}</span>
                                    <div class="chunk-meta">
                                        <el-tag size="small" type="success" v-if="chunk.metadata?.children_count !== undefined">子块数: {{ chunk.metadata.children_count }}</el-tag>
                                    </div>
                                </div>
                            </template>
                            <div class="chunk-content">{{ chunk.page_content }}</div>
                        </el-collapse-item>
                    </el-collapse>
                </div>
                
                <div class="pagination-wrapper" v-if="chunksTotal > 0">
                    <el-pagination v-model:current-page="chunkCurrentPage" v-model:page-size="chunkPageSize" 
                        :page-sizes="[10, 20, 50]" layout="total, sizes, prev, pager, next" :total="chunksTotal" 
                        @size-change="handleChunkPageChange" @current-change="handleChunkPageChange" />
                </div>
            </div>
        </el-drawer>
        <!-- Document Details Dialog -->
        <el-dialog v-model="showDetailsDialog" title="文档详情" width="600px">
            <div v-loading="detailsLoading" v-if="docDetails">
                <el-descriptions :column="1" border>
                    <el-descriptions-item label="文档 ID">{{ docDetails.id }}</el-descriptions-item>
                    <el-descriptions-item label="类型">{{ docDetails.is_url ? 'URL' : '本地文件' }}</el-descriptions-item>
                    <el-descriptions-item label="路径">{{ docDetails.path }}</el-descriptions-item>
                    <el-descriptions-item label="文件名" v-if="!docDetails.is_url">{{ docDetails.file_name
                        }}</el-descriptions-item>
                    <el-descriptions-item label="网页标题" v-else-if="docDetails.is_url">{{ docDetails.file_name
                        }}</el-descriptions-item>
                    <el-descriptions-item label="文件所在目录" v-if="!docDetails.is_url">{{ docDetails.file_directory
                        }}</el-descriptions-item>
                    <el-descriptions-item label="后缀名">{{ docDetails.file_extension }}</el-descriptions-item>
                    <el-descriptions-item label="MIME 类型">{{ docDetails.mime_type || '-' }}</el-descriptions-item>
                    <el-descriptions-item label="最后修改时间" v-if="!docDetails.is_url">{{
                        formatDate(docDetails.last_modified)
                        }}</el-descriptions-item>
                    <el-descriptions-item label="子文档数量">{{ docDetails.children_count }}</el-descriptions-item>
                    <el-descriptions-item label="入库时间">{{ formatDate(docDetails.created_at) }}</el-descriptions-item>
                    <el-descriptions-item label="入库元信息">
                        <pre style="white-space: pre-wrap; word-break: break-all; margin: 0; font-size: 12px; color: var(--text-secondary); text-align: left;">{{ JSON.stringify(docDetails.load_metadata, null, 2) }}</pre>
                    </el-descriptions-item>
                </el-descriptions>
            </div>
        </el-dialog>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Upload, Link, Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import request from '@/utils/request'

const docList = ref<any[]>([])
const loading = ref(false)

const showUploadDialog = ref(false)
const uploadForm = ref({ filePath: '' })
const uploadSubmitting = ref(false)

const showUrlDialog = ref(false)
const urlForm = ref({ url: '' })
const urlSubmitting = ref(false)

const showChunksDrawer = ref(false)
const chunksLoading = ref(false)
const currentDoc = ref<any>(null)
const chunks = ref<any[]>([])
const activeChunkIds = ref<string[]>([])
const chunkCurrentPage = ref(1)
const chunkPageSize = ref(10)
const chunksTotal = ref(0)

const showDetailsDialog = ref(false)
const detailsLoading = ref(false)
const docDetails = ref<any>(null)

const fetchDocs = async () => {
    loading.value = true
    try {
        const res: any = await request.get('/documents/list')
        docList.value = res.data || []
    } catch (error) {
        // Error handled by interceptor
    } finally {
        loading.value = false
    }
}

const submitLocalUpload = async () => {
    if (!uploadForm.value.filePath) return ElMessage.warning('请输入本地文件绝对路径')
    // 校验必须是绝对路径
    const isAbsolutePath = /^(?:[a-zA-Z]:[\\/]|\\\\|\/)/.test(uploadForm.value.filePath)
    if (!isAbsolutePath) {
        return ElMessage.warning('请输入有效的文件绝对路径 (例如 C:\\xxx\\yyy.pdf 或 /xxx/yyy.pdf)')
    }

    uploadSubmitting.value = true
    try {
        const res: any = await request.post(`/documents/local?file_path=${encodeURIComponent(uploadForm.value.filePath)}`)
        if (res.code === 200) {
            ElMessage.success(res.message || '上传成功')
            showUploadDialog.value = false
            uploadForm.value.filePath = ''
            fetchDocs()
        }
    } catch (err) {
        // Interceptor handle
    } finally {
        uploadSubmitting.value = false
    }
}

const submitUrl = async () => {
    if (!urlForm.value.url) return ElMessage.warning('请输入 URL')
    urlSubmitting.value = true
    try {
        const res: any = await request.post(`/documents/url?url=${encodeURIComponent(urlForm.value.url)}`)
        if (res.code === 200) {
            ElMessage.success(res.message || 'URL 导入成功')
            showUrlDialog.value = false
            urlForm.value.url = ''
            fetchDocs()
        }
    } catch (err) {
        // Interceptor handle
    } finally {
        urlSubmitting.value = false
    }
}

const handleDelete = async (id: string) => {
    try {
        const res: any = await request.delete(`/documents/${id}`)
        if (res.code === 200) {
            ElMessage.success(res.message || '删除成功')
            fetchDocs()
        }
    } catch (e) { }
}

const previewChunks = async (row: any = null) => {
    if (row) {
        currentDoc.value = row
        showChunksDrawer.value = true
        chunkCurrentPage.value = 1
    }
    chunksLoading.value = true
    chunks.value = []
    try {
        const offset = (chunkCurrentPage.value - 1) * chunkPageSize.value
        const res: any = await request.get(`/documents/parents?docId=${currentDoc.value.id}&offset=${offset}&limit=${chunkPageSize.value}`)
        if (res.code === 200 && res.data) {
            chunks.value = res.data.chunks || []
            chunksTotal.value = res.data.total || 0
        }
    } catch (e) {
    } finally {
        chunksLoading.value = false
    }
}

const handleChunkPageChange = () => {
    previewChunks()
}

const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString()
}

const handleRowDblclick = async (row: any) => {
    showDetailsDialog.value = true
    detailsLoading.value = true
    docDetails.value = null
    try {
        const res: any = await request.get(`/documents/${row.id}`)
        if (res.code === 200 && res.data) {
            docDetails.value = res.data
        }
    } catch (e) {
        showDetailsDialog.value = false
    } finally {
        detailsLoading.value = false
    }
}

onMounted(() => {
    fetchDocs()
})
</script>

<style scoped lang="scss">
.docs-container {
    padding: 24px;
    height: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
}

.header-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;

    h2 {
        margin: 0;
        font-size: 24px;
        font-weight: 500;
    }
}

.chunks-container {
    display: flex;
    flex-direction: column;
    height: 100%;
}

.chunks-list {
    flex: 1;
    overflow-y: auto;
    padding-bottom: 20px;

    .chunk-header-title {
        display: flex;
        align-items: center;
        width: 100%;
        padding-right: 12px;
        line-height: 1.2;

        .chunk-index {
            font-size: 20px;
            font-weight: bold;
            color: var(--el-color-primary);
            margin-left: 10px;
        }

        .chunk-id {
            font-size: 15px;
            color: var(--text-secondary);
            margin-left: 10px;
        }

        .chunk-meta {
            margin-left: auto;
            display: flex;
            align-items: center;
        }
    }

    .chunk-content {
        font-size: 13px;
        line-height: 1.6;
        white-space: pre-wrap;
        word-break: break-all;
        background-color: var(--el-fill-color-light, #f5f7fa);
        padding: 12px;
        border-radius: 4px;
        margin-top: 8px;
        max-height: 400px;
        overflow-y: auto;
    }
}

.pagination-wrapper {
    margin-top: 16px;
    display: flex;
    justify-content: flex-end;
    padding-top: 12px;
    border-top: 1px solid var(--border-color);
}
</style>

<style lang="scss">
/* Global styles specifically targeting Element Plus poppers appended to body */
.el-popconfirm__main {
    justify-content: center;
}
</style>
