// ===== 配置 =====
const API_BASE = window.location.origin;
const socket = io(API_BASE);

// 从 URL 获取 live_id
const urlPath = window.location.pathname;
const liveIdMatch = urlPath.match(/\/live\/(\d+)/);
const LIVE_ID = liveIdMatch ? parseInt(liveIdMatch[1]) : 1;

// ===== 应用状态 =====
const state = {
    photos: [],
    albums: [],
    currentAlbum: 'all',
    currentView: 'masonry',
    currentPhotoIndex: 0,
    page: 1,
    limit: 20,
    hasMore: true,
    isLoading: false,
    keyword: '',
    sortBy: 'latest',
    user: null,
    token: localStorage.getItem('token'),
    likedPhotos: new Set(JSON.parse(localStorage.getItem('likedPhotos') || '[]'))
};

// ===== DOM 元素 =====
const elements = {
    photoGrid: document.getElementById('photoGrid'),
    lightbox: document.getElementById('lightbox'),
    lightboxImage: document.getElementById('lightboxImage'),
    loading: document.getElementById('loading'),
    emptyState: document.getElementById('emptyState'),
    searchInput: document.getElementById('searchInput'),
    filterSelect: document.getElementById('filterSelect'),
    albumNav: document.getElementById('albumNav'),
    liveTitle: document.getElementById('liveTitle'),
    liveStatus: document.getElementById('liveStatus'),
    photoCount: document.getElementById('photoCount'),
    // 用户相关
    loginBtn: document.getElementById('loginBtn'),
    loginModal: document.getElementById('loginModal'),
    loginForm: document.getElementById('loginForm'),
    userInfo: document.getElementById('userInfo'),
    userNickname: document.getElementById('userNickname'),
    logoutBtn: document.getElementById('logoutBtn'),
    uploadBtn: document.getElementById('uploadBtn'),
    uploadModal: document.getElementById('uploadModal'),
    uploadForm: document.getElementById('uploadForm'),
    uploadInput: document.getElementById('uploadInput'),
    uploadArea: document.getElementById('uploadArea'),
    previewGrid: document.getElementById('previewGrid'),
    uploadAlbum: document.getElementById('uploadAlbum'),
    uploadTags: document.getElementById('uploadTags'),
    uploadSubmit: document.getElementById('uploadSubmit'),
    // 分享
    shareBtn: document.getElementById('shareBtn'),
    shareModal: document.getElementById('shareModal'),
    shareLink: document.getElementById('shareLink'),
    copyLink: document.getElementById('copyLink'),
    // 通知
    liveNotification: document.getElementById('liveNotification'),
    // 灯箱
    lightboxClose: document.getElementById('lightboxClose'),
    lightboxOverlay: document.getElementById('lightboxOverlay'),
    lightboxPrev: document.getElementById('lightboxPrev'),
    lightboxNext: document.getElementById('lightboxNext'),
    lightboxLike: document.getElementById('lightboxLike'),
    lightboxLikeCount: document.getElementById('lightboxLikeCount'),
    lightboxDownload: document.getElementById('lightboxDownload'),
    lightboxShare: document.getElementById('lightboxShare'),
    lightboxDelete: document.getElementById('lightboxDelete'),
    lightboxTitle: document.getElementById('lightboxTitle'),
    lightboxTime: document.getElementById('lightboxTime'),
    lightboxPhotographer: document.getElementById('lightboxPhotographer'),
    lightboxViews: document.getElementById('lightboxViews'),
    lightboxTags: document.getElementById('lightboxTags'),
    exifInfo: document.getElementById('exifInfo'),
    exifGrid: document.getElementById('exifGrid'),
    // 统计
    statPhotos: document.getElementById('statPhotos'),
    statViews: document.getElementById('statViews'),
    statLikes: document.getElementById('statLikes'),
    // 菜单
    menuToggle: document.getElementById('menuToggle'),
    sidebar: document.getElementById('sidebar')
};

// ===== 初始化 =====
async function init() {
    // 检查登录状态
    if (state.token) {
        await checkAuth();
    }
    
    // 加载直播信息
    await loadLiveInfo();
    
    // 加载相册分类
    await loadAlbums();
    
    // 加载图片
    await loadPhotos();
    
    // 绑定事件
    bindEvents();
    
    // 连接 WebSocket
    connectWebSocket();
    
    // 更新分享链接
    elements.shareLink.value = window.location.href;
}

// ===== API 请求 =====
async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE}/api${endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (state.token) {
        headers['Authorization'] = `Bearer ${state.token}`;
    }
    
    try {
        const response = await fetch(url, {
            ...options,
            headers
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || '请求失败');
        }
        
        return data;
    } catch (error) {
        console.error('API 请求失败:', error);
        throw error;
    }
}

// ===== 认证 =====
async function checkAuth() {
    try {
        const data = await apiRequest('/auth/me');
        state.user = data.data;
        updateUI();
    } catch (error) {
        state.token = null;
        state.user = null;
        localStorage.removeItem('token');
    }
}

async function login(username, password) {
    const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
    });
    
    state.token = data.data.token;
    state.user = data.data.user;
    localStorage.setItem('token', state.token);
    updateUI();
    
    return data;
}

function logout() {
    state.token = null;
    state.user = null;
    localStorage.removeItem('token');
    updateUI();
}

function updateUI() {
    const isLoggedIn = !!state.user;
    const isPhotographer = state.user?.role === 'photographer' || state.user?.role === 'admin';
    
    elements.loginBtn.style.display = isLoggedIn ? 'none' : 'block';
    elements.userInfo.style.display = isLoggedIn ? 'flex' : 'none';
    elements.uploadBtn.style.display = isPhotographer ? 'block' : 'none';
    elements.lightboxDelete.style.display = isPhotographer ? 'flex' : 'none';
    
    if (isLoggedIn) {
        elements.userNickname.textContent = state.user.nickname;
    }
}

// ===== 加载直播信息 =====
async function loadLiveInfo() {
    try {
        const data = await apiRequest(`/lives/${LIVE_ID}`);
        const live = data.data;
        
        elements.liveTitle.textContent = `📷 ${live.title}`;
        elements.liveStatus.textContent = live.status === 'live' ? '直播中' : '已结束';
        elements.liveStatus.className = `live-badge ${live.status}`;
        
        // 更新统计
        elements.statPhotos.textContent = live.stats?.total_photos || 0;
        elements.statViews.textContent = live.stats?.total_views || 0;
        elements.statLikes.textContent = live.stats?.total_likes || 0;
        
        // 记录浏览
        apiRequest(`/lives/${LIVE_ID}/view`, { method: 'POST' }).catch(() => {});
    } catch (error) {
        console.error('加载直播信息失败:', error);
    }
}

// ===== 加载相册 =====
async function loadAlbums() {
    try {
        const data = await apiRequest(`/albums/live/${LIVE_ID}`);
        state.albums = data.data;
        
        // 渲染相册按钮
        const albumButtons = state.albums.map(album => `
            <button class="album-btn" data-album="${album.id}">
                <span class="album-icon">${album.icon}</span>
                <span>${album.name}</span>
                <span class="album-count">${album.photo_count}</span>
            </button>
        `).join('');
        
        elements.albumNav.innerHTML = `
            <button class="album-btn active" data-album="all">
                <span class="album-icon">📸</span>
                <span>全部照片</span>
                <span class="album-count" id="countAll">0</span>
            </button>
            ${albumButtons}
        `;
        
        // 更新上传相册选择
        elements.uploadAlbum.innerHTML = state.albums.map(album => 
            `<option value="${album.id}">${album.icon} ${album.name}</option>`
        ).join('');
        
    } catch (error) {
        console.error('加载相册失败:', error);
    }
}

// ===== 加载图片 =====
async function loadPhotos(reset = false) {
    if (state.isLoading || (!state.hasMore && !reset)) return;
    
    if (reset) {
        state.page = 1;
        state.photos = [];
        state.hasMore = true;
        elements.photoGrid.innerHTML = '';
    }
    
    state.isLoading = true;
    elements.loading.classList.add('show');
    
    try {
        const params = new URLSearchParams({
            live_id: LIVE_ID,
            album_id: state.currentAlbum,
            page: state.page,
            limit: state.limit,
            sort: state.sortBy
        });
        
        if (state.keyword) {
            params.append('keyword', state.keyword);
        }
        
        const data = await apiRequest(`/photos?${params}`);
        
        if (reset) {
            state.photos = data.data.photos;
        } else {
            state.photos = [...state.photos, ...data.data.photos];
        }
        
        state.hasMore = data.data.page < data.data.pages;
        state.page = data.data.page + 1;
        
        renderPhotos();
        elements.photoCount.textContent = data.data.total;
        
        if (state.photos.length === 0) {
            elements.emptyState.style.display = 'block';
        } else {
            elements.emptyState.style.display = 'none';
        }
        
    } catch (error) {
        console.error('加载图片失败:', error);
        showToast('加载图片失败，请稍后重试', 'error');
    } finally {
        state.isLoading = false;
        elements.loading.classList.remove('show');
    }
}

// ===== 渲染图片 =====
function renderPhotos() {
    elements.photoGrid.innerHTML = state.photos.map((photo, index) => {
        const isLiked = state.likedPhotos.has(photo.id);
        const likeCount = photo.like_count + (isLiked ? 1 : 0);
        
        return `
            <div class="photo-item" data-index="${index}" data-id="${photo.id}">
                <img src="${photo.thumbnail_url}" alt="${photo.tags?.join(', ') || ''}" loading="lazy">
                <div class="photo-overlay">
                    <div class="photo-meta">
                        <span class="photo-time">${formatTime(photo.created_at)}</span>
                        <div class="photo-actions">
                            <span class="photo-action">
                                <span>${isLiked ? '❤️' : '🤍'}</span>
                                <span>${likeCount}</span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // 绑定点击事件
    elements.photoGrid.querySelectorAll('.photo-item').forEach(item => {
        item.addEventListener('click', () => {
            openLightbox(parseInt(item.dataset.index));
        });
    });
}

// ===== 灯箱功能 =====
function openLightbox(index) {
    state.currentPhotoIndex = index;
    updateLightboxContent();
    elements.lightbox.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    elements.lightbox.classList.remove('show');
    document.body.style.overflow = '';
}

function updateLightboxContent() {
    const photo = state.photos[state.currentPhotoIndex];
    if (!photo) return;
    
    elements.lightboxImage.src = photo.compressed_url;
    elements.lightboxTitle.textContent = photo.title || '图片详情';
    elements.lightboxTime.textContent = formatTime(photo.created_at);
    elements.lightboxPhotographer.textContent = photo.photographer_name || '摄影师';
    elements.lightboxViews.textContent = photo.view_count || 0;
    elements.lightboxLikeCount.textContent = photo.like_count + (state.likedPhotos.has(photo.id) ? 1 : 0);
    
    // 点赞状态
    const isLiked = state.likedPhotos.has(photo.id);
    elements.lightboxLike.classList.toggle('liked', isLiked);
    elements.lightboxLike.querySelector('.action-icon').textContent = isLiked ? '❤️' : '🤍';
    elements.lightboxLike.querySelector('span:nth-child(2)').textContent = isLiked ? '已赞' : '点赞';
    
    // 标签
    const tags = photo.tags || [];
    elements.lightboxTags.innerHTML = tags.map(tag => `<span class="tag">${tag}</span>`).join('');
    
    // EXIF 信息
    const exif = photo.exif_data || {};
    if (exif.make || exif.model || exif.exposureTime || exif.fNumber || exif.iso) {
        elements.exifInfo.style.display = 'block';
        elements.exifGrid.innerHTML = `
            ${exif.make && exif.model ? `
                <div class="exif-item">
                    <span class="exif-label">相机</span>
                    <span class="exif-value">${exif.make} ${exif.model}</span>
                </div>
            ` : ''}
            ${exif.exposureTime ? `
                <div class="exif-item">
                    <span class="exif-label">快门</span>
                    <span class="exif-value">1/${Math.round(1/exif.exposureTime)}s</span>
                </div>
            ` : ''}
            ${exif.fNumber ? `
                <div class="exif-item">
                    <span class="exif-label">光圈</span>
                    <span class="exif-value">f/${exif.fNumber}</span>
                </div>
            ` : ''}
            ${exif.iso ? `
                <div class="exif-item">
                    <span class="exif-label">ISO</span>
                    <span class="exif-value">${exif.iso}</span>
                </div>
            ` : ''}
            ${exif.focalLength ? `
                <div class="exif-item">
                    <span class="exif-label">焦距</span>
                    <span class="exif-value">${exif.focalLength}mm</span>
                </div>
            ` : ''}
        `;
    } else {
        elements.exifInfo.style.display = 'none';
    }
}

function navigateLightbox(direction) {
    const newIndex = state.currentPhotoIndex + direction;
    if (newIndex >= 0 && newIndex < state.photos.length) {
        state.currentPhotoIndex = newIndex;
        updateLightboxContent();
    }
}

async function toggleLike() {
    if (!state.token) {
        showToast('请先登录', 'info');
        elements.loginModal.classList.add('show');
        return;
    }
    
    const photo = state.photos[state.currentPhotoIndex];
    if (!photo) return;
    
    try {
        await apiRequest(`/photos/${photo.id}/like`, { method: 'POST' });
        
        if (state.likedPhotos.has(photo.id)) {
            state.likedPhotos.delete(photo.id);
        } else {
            state.likedPhotos.add(photo.id);
        }
        
        localStorage.setItem('likedPhotos', JSON.stringify([...state.likedPhotos]));
        updateLightboxContent();
        renderPhotos();
    } catch (error) {
        showToast('操作失败', 'error');
    }
}

async function deletePhoto() {
    if (!confirm('确定要删除这张图片吗？此操作不可撤销。')) return;
    
    const photo = state.photos[state.currentPhotoIndex];
    if (!photo) return;
    
    try {
        await apiRequest(`/photos/${photo.id}`, { method: 'DELETE' });
        
        state.photos.splice(state.currentPhotoIndex, 1);
        renderPhotos();
        closeLightbox();
        showToast('删除成功', 'success');
        
        // 刷新统计
        loadLiveInfo();
    } catch (error) {
        showToast('删除失败', 'error');
    }
}

// ===== 上传功能 =====
let selectedFiles = [];

function handleFileSelect(files) {
    const newFiles = Array.from(files).filter(file => 
        file.type.startsWith('image/') && file.size <= 10 * 1024 * 1024
    );
    
    selectedFiles = [...selectedFiles, ...newFiles].slice(0, 20);
    renderPreviews();
}

function renderPreviews() {
    elements.previewGrid.innerHTML = selectedFiles.map((file, index) => `
        <div class="preview-item">
            <img src="${URL.createObjectURL(file)}" alt="${file.name}">
            <button class="preview-remove" data-index="${index}">&times;</button>
        </div>
    `).join('');
    
    // 绑定删除按钮
    elements.previewGrid.querySelectorAll('.preview-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(btn.dataset.index);
            selectedFiles.splice(index, 1);
            renderPreviews();
        });
    });
}

async function uploadPhotos() {
    if (selectedFiles.length === 0) {
        showToast('请选择图片', 'info');
        return;
    }
    
    const submitBtn = elements.uploadSubmit;
    submitBtn.disabled = true;
    submitBtn.querySelector('.btn-text').style.display = 'none';
    submitBtn.querySelector('.btn-loading').style.display = 'inline';
    
    try {
        const formData = new FormData();
        formData.append('live_id', LIVE_ID);
        formData.append('album_id', elements.uploadAlbum.value);
        formData.append('tags', JSON.stringify(
            elements.uploadTags.value.split(',').map(t => t.trim()).filter(t => t)
        ));
        
        selectedFiles.forEach(file => {
            formData.append('images', file);
        });
        
        const response = await fetch(`${API_BASE}/api/photos/upload-batch`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${state.token}`
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast(data.message, 'success');
            selectedFiles = [];
            elements.previewGrid.innerHTML = '';
            elements.uploadTags.value = '';
            elements.uploadModal.classList.remove('show');
            
            // 重新加载图片
            loadPhotos(true);
            loadLiveInfo();
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        showToast(`上传失败: ${error.message}`, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.querySelector('.btn-text').style.display = 'inline';
        submitBtn.querySelector('.btn-loading').style.display = 'none';
    }
}

// ===== 分享功能 =====
function copyShareLink() {
    elements.shareLink.select();
    document.execCommand('copy');
    
    const btn = elements.copyLink;
    btn.textContent = '已复制!';
    setTimeout(() => btn.textContent = '复制链接', 2000);
}

// ===== 通知 =====
function showNotification(text) {
    elements.liveNotification.querySelector('.notification-text').textContent = text;
    elements.liveNotification.classList.add('show');
    
    setTimeout(() => {
        elements.liveNotification.classList.remove('show');
    }, 3000);
}

// ===== Toast 提示 =====
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'error' ? '#e74c3c' : type === 'success' ? '#2ecc71' : '#3498db'};
        color: white;
        padding: 0.75rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        z-index: 10000;
        animation: toastIn 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'toastOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

// ===== 事件绑定 =====
function bindEvents() {
    // 登录
    elements.loginBtn.addEventListener('click', () => {
        elements.loginModal.classList.add('show');
    });
    
    elements.loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;
        
        try {
            await login(username, password);
            elements.loginModal.classList.remove('show');
            showToast('登录成功', 'success');
        } catch (error) {
            showToast(error.message, 'error');
        }
    });
    
    elements.logoutBtn.addEventListener('click', () => {
        logout();
        showToast('已退出登录', 'success');
    });
    
    // 上传
    elements.uploadBtn.addEventListener('click', () => {
        elements.uploadModal.classList.add('show');
    });
    
    elements.uploadInput.addEventListener('change', (e) => {
        handleFileSelect(e.target.files);
    });
    
    elements.uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.uploadArea.classList.add('dragover');
    });
    
    elements.uploadArea.addEventListener('dragleave', () => {
        elements.uploadArea.classList.remove('dragover');
    });
    
    elements.uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.uploadArea.classList.remove('dragover');
        handleFileSelect(e.dataTransfer.files);
    });
    
    elements.uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await uploadPhotos();
    });
    
    // 相册切换
    elements.albumNav.addEventListener('click', (e) => {
        const btn = e.target.closest('.album-btn');
        if (btn) {
            elements.albumNav.querySelectorAll('.album-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.currentAlbum = btn.dataset.album;
            loadPhotos(true);
        }
    });
    
    // 视图切换
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.currentView = btn.dataset.view;
            elements.photoGrid.classList.toggle('grid-view', state.currentView === 'grid');
        });
    });
    
    // 搜索
    let searchTimeout;
    elements.searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            state.keyword = e.target.value.trim();
            loadPhotos(true);
        }, 500);
    });
    
    // 排序
    elements.filterSelect.addEventListener('change', (e) => {
        state.sortBy = e.target.value;
        loadPhotos(true);
    });
    
    // 灯箱
    elements.lightboxClose.addEventListener('click', closeLightbox);
    elements.lightboxOverlay.addEventListener('click', closeLightbox);
    elements.lightboxPrev.addEventListener('click', () => navigateLightbox(-1));
    elements.lightboxNext.addEventListener('click', () => navigateLightbox(1));
    elements.lightboxLike.addEventListener('click', toggleLike);
    elements.lightboxDownload.addEventListener('click', () => {
        const photo = state.photos[state.currentPhotoIndex];
        if (photo) {
            window.open(photo.original_url, '_blank');
        }
    });
    elements.lightboxShare.addEventListener('click', () => {
        elements.shareModal.classList.add('show');
    });
    elements.lightboxDelete.addEventListener('click', deletePhoto);
    
    // 键盘导航
    document.addEventListener('keydown', (e) => {
        if (!elements.lightbox.classList.contains('show')) return;
        
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft') navigateLightbox(-1);
        if (e.key === 'ArrowRight') navigateLightbox(1);
    });
    
    // 分享
    elements.shareBtn.addEventListener('click', () => {
        elements.shareModal.classList.add('show');
    });
    
    elements.copyLink.addEventListener('click', copyShareLink);
    
    // 通知关闭
    document.querySelector('.notification-close').addEventListener('click', () => {
        elements.liveNotification.classList.remove('show');
    });
    
    // 关闭弹窗
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal').classList.remove('show');
        });
    });
    
    // 点击弹窗外部关闭
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });
    });
    
    // 触摸滑动
    let touchStartX = 0;
    let touchEndX = 0;
    
    elements.lightbox.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    });
    
    elements.lightbox.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        const diff = touchStartX - touchEndX;
        if (Math.abs(diff) > 50) {
            navigateLightbox(diff > 0 ? 1 : -1);
        }
    });
    
    // 滚动加载
    window.addEventListener('scroll', () => {
        const scrollHeight = document.documentElement.scrollHeight;
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const clientHeight = document.documentElement.clientHeight;
        
        if (scrollTop + clientHeight >= scrollHeight - 500 && state.hasMore && !state.isLoading) {
            loadPhotos();
        }
    });
    
    // 移动端菜单
    elements.menuToggle.addEventListener('click', () => {
        elements.sidebar.classList.toggle('show');
    });
}

// ===== WebSocket 连接 =====
function connectWebSocket() {
    socket.on('connect', () => {
        console.log('WebSocket 已连接');
        socket.emit('join-live', LIVE_ID);
    });
    
    socket.on('photo-uploaded', (photo) => {
        showNotification('📡 摄影师上传了新照片');
        // 刷新第一页
        loadPhotos(true);
        loadLiveInfo();
    });
    
    socket.on('like-update', (data) => {
        // 可以在这里更新点赞动画等
    });
}

// ===== 工具函数 =====
function formatTime(time) {
    if (!time) return '';
    const date = new Date(time);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${month}-${day} ${hours}:${minutes}`;
}

// ===== 启动 =====
document.addEventListener('DOMContentLoaded', init);

// 添加 Toast 动画
const style = document.createElement('style');
style.textContent = `
    @keyframes toastIn {
        from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    @keyframes toastOut {
        from { opacity: 1; transform: translateX(-50%) translateY(0); }
        to { opacity: 0; transform: translateX(-50%) translateY(-20px); }
    }
`;
document.head.appendChild(style);
