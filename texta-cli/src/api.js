const axios = require('axios');
const {
    getToken,
    getRefreshToken,
    getBaseUrl,
    setAuth,
    clearAuth,
    getUser,
} = require('./config');

function unwrapResponse(res) {
    return res?.data?.data ?? res?.data;
}

function inferContentTypeFromUrl(value) {
    const lower = String(value || '').toLowerCase();
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.gif')) return 'image/gif';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.svg')) return 'image/svg+xml';
    if (lower.endsWith('.pdf')) return 'application/pdf';
    if (lower.endsWith('.txt')) return 'text/plain';
    if (lower.endsWith('.json')) return 'application/json';
    return null;
}

function inferCategory(contentType) {
    if (!contentType) return 'other';
    if (contentType.startsWith('image/')) return 'image';
    if (
        contentType === 'application/pdf' ||
        contentType.includes('word') ||
        contentType.includes('sheet') ||
        contentType.includes('presentation') ||
        contentType.startsWith('text/')
    ) {
        return 'document';
    }
    return 'other';
}

function getFilenameFromUrl(value, index) {
    const raw = String(value || '').split('?')[0];
    const segment = raw.split('/').filter(Boolean).pop();
    return segment ? decodeURIComponent(segment) : `file-${index + 1}`;
}

function normalizeList(list) {
    const urls = Array.isArray(list?.url) ? list.url : [];
    const attachments = urls.map((entry, index) => {
        const contentType = inferContentTypeFromUrl(entry);
        return {
            _id: String(index + 1),
            key: entry,
            url: entry,
            name: getFilenameFromUrl(entry, index),
            contentType,
            category: inferCategory(contentType),
            size: null,
        };
    });

    return {
        ...list,
        id: list?._id,
        message: list?.text || '',
        deleteAt: list?.scheduledDeleteAt || null,
        attachments,
    };
}

function createClient() {
    const token = getToken();
    const client = axios.create({
        baseURL: getBaseUrl(),
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        timeout: 30000,
    });

    client.interceptors.response.use(
        (response) => response,
        async (error) => {
            const originalRequest = error.config;
            const status = error.response?.status;
            const isRefreshRequest =
                typeof originalRequest?.url === 'string' &&
                originalRequest.url.includes('/auth/refreshToken');

            if (status !== 401 || !originalRequest || originalRequest._retry || isRefreshRequest) {
                throw error;
            }

            const refreshToken = getRefreshToken();
            if (!refreshToken) {
                clearAuth();
                throw error;
            }

            originalRequest._retry = true;

            try {
                const refreshResponse = await axios.post(
                    `${getBaseUrl()}/auth/refreshToken`,
                    { refreshToken },
                    {
                        headers: { 'Content-Type': 'application/json' },
                        timeout: 30000,
                    }
                );

                const authData = unwrapResponse(refreshResponse);
                const nextUser = authData.user || getUser();
                setAuth(authData.accessToken, authData.refreshToken, nextUser);
                originalRequest.headers = {
                    ...(originalRequest.headers || {}),
                    Authorization: `Bearer ${authData.accessToken}`,
                };

                return client(originalRequest);
            } catch (refreshError) {
                clearAuth();
                throw refreshError;
            }
        }
    );

    return client;
}

async function register(username, email, password) {
    const res = await createClient().post('/auth/register', { username, email, password });
    return unwrapResponse(res);
}

async function login(identifier, password) {
    const payload = identifier.includes('@')
        ? { email: identifier, password }
        : { username: identifier, password };
    const res = await createClient().post('/auth/login', payload);
    return unwrapResponse(res);
}

async function logout() {
    const res = await createClient().post('/auth/logout');
    return unwrapResponse(res);
}

async function getTasks(filters = {}) {
    const res = await createClient().get('/lists');
    let tasks = unwrapResponse(res);
    tasks = Array.isArray(tasks) ? tasks.map(normalizeList) : [];

    if (filters.status) {
        tasks = tasks.filter((task) => task.status === filters.status);
    }

    if (filters.search) {
        const query = filters.search.trim().toLowerCase();
        tasks = tasks.filter((task) => {
            const haystack = `${task.text || ''} ${task.description || ''}`.toLowerCase();
            return haystack.includes(query);
        });
    }

    return tasks;
}

async function getTask(id) {
    const res = await createClient().get(`/lists/${id}`);
    return normalizeList(unwrapResponse(res));
}

async function createTask(message, options = {}) {
    const createRes = await createClient().post('/lists', {
        text: message,
        description: options.description,
    });

    let task = normalizeList(unwrapResponse(createRes));

    if (options.status && options.status !== 'pending') {
        const statusRes = await createClient().patch(`/lists/${task.id}`, { status: options.status });
        task = normalizeList(unwrapResponse(statusRes));
    }

    return task;
}

async function updateTask(id, updates) {
    const payload = {};

    if (updates.message !== undefined) payload.text = updates.message;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.url !== undefined) payload.url = updates.url;

    let task = null;

    if (Object.keys(payload).length > 0) {
        const updateRes = await createClient().put(`/lists/${id}`, payload);
        task = normalizeList(unwrapResponse(updateRes));
    }

    if (updates.status !== undefined) {
        const statusRes = await createClient().patch(`/lists/${id}`, { status: updates.status });
        task = normalizeList(unwrapResponse(statusRes));
    }

    if (!task) {
        return getTask(id);
    }

    return task;
}

async function deleteTask(id) {
    const res = await createClient().delete(`/lists/${id}`);
    return unwrapResponse(res);
}

async function deleteBulkTasks({ ids, all }) {
    if (all) {
        await createClient().delete('/lists');
        return { deleted: 'all' };
    }

    const res = await createClient().post('/lists/bulk-delete', { listIds: ids });
    const data = unwrapResponse(res);
    return { deleted: data.deletedCount ?? 0 };
}

async function scheduleDelete(id, duration) {
    const res = await createClient().patch(`/lists/${id}/schedule-delete`, { duration });
    return normalizeList(unwrapResponse(res));
}

async function cancelScheduledDelete(id) {
    const res = await createClient().delete(`/lists/${id}/schedule-delete`);
    return normalizeList(unwrapResponse(res));
}

async function getPresignedUrls(taskId, fileNames) {
    const res = await createClient().post('/lists/upload', {
        listid: taskId,
        fileNames,
    });
    return unwrapResponse(res);
}

async function uploadFileToS3(presignedUrl, filePath, contentType) {
    const fs = require('fs');
    const fileData = fs.readFileSync(filePath);
    await axios.put(presignedUrl, fileData, {
        headers: { 'Content-Type': contentType, 'Content-Length': fileData.length },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 120000,
    });
}

module.exports = {
    register,
    login,
    logout,
    getTasks,
    getTask,
    createTask,
    updateTask,
    deleteTask,
    deleteBulkTasks,
    scheduleDelete,
    cancelScheduledDelete,
    getPresignedUrls,
    uploadFileToS3,
};
