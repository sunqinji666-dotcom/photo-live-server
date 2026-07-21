// ===== 演示版本 - 使用本地数据模拟 =====
// 此版本无需后端，可直接在浏览器打开使用

const API_BASE = '';
const DEMO_MODE = true;

// 从 URL 获取 live_id（演示模式默认为 1）
const LIVE_ID = 1;

// ===== 演示数据 =====
const DEMO_DATA = {
    live: {
        id: 1,
        title: '桂林银行 - 2024年度盛典',
        description: '桂林银行年度盛会图片直播',
        status: 'live',
        view_count: 1523,
        like_count: 856,
        total_photos: 48,
        stats: {
            total_photos: 48,
            total_views: 1523,
            total_likes: 856
        },
        albums: [
            { id: 1, live_id: 1, name: '开幕仪式', icon: '🎊', sort_order: 1, photo_count: 12 },
            { id: 2, live_id: 1, name: '文艺表演', icon: '🎭', sort_order: 2, photo_count: 15 },
            { id: 3, live_id: 1, name: '颁奖典礼', icon: '🏆', sort_order: 3, photo_count: 10 },
            { id: 4, live_id: 1, name: '宴会合影', icon: '🍽️', sort_order: 4, photo_count: 11 }
        ]
    },
    
    photos: [
        // 开幕仪式
        { id: 1, live_id: 1, album_id: 1, photographer_name: 'Jack', 
          original_url: 'https://picsum.photos/seed/live1/1920/1280',
          compressed_url: 'https://picsum.photos/seed/live1/800/533',
          thumbnail_url: 'https://picsum.photos/seed/live1/400/267',
          title: '开幕致辞', tags: ['开幕', '致辞', '领导'],
          exif_data: { make: 'Canon', model: 'EOS R5', exposureTime: 0.008, fNumber: 2.8, iso: 400, focalLength: 85 },
          width: 1920, height: 1280, view_count: 156, like_count: 45, download_count: 23,
          created_at: '2024-04-03T14:00:00Z' },
        
        { id: 2, live_id: 1, album_id: 1, photographer_name: 'Jack',
          original_url: 'https://picsum.photos/seed/live2/1920/1080',
          compressed_url: 'https://picsum.photos/seed/live2/800/450',
          thumbnail_url: 'https://picsum.photos/seed/live2/400/225',
          title: '剪彩仪式', tags: ['剪彩', '仪式'],
          exif_data: { make: 'Sony', model: 'A7M4', exposureTime: 0.004, fNumber: 2.0, iso: 200, focalLength: 50 },
          width: 1920, height: 1080, view_count: 134, like_count: 38, download_count: 19,
          created_at: '2024-04-03T14:10:00Z' },
        
        { id: 3, live_id: 1, album_id: 1, photographer_name: 'Jack',
          original_url: 'https://picsum.photos/seed/live3/1920/1440',
          compressed_url: 'https://picsum.photos/seed/live3/800/600',
          thumbnail_url: 'https://picsum.photos/seed/live3/400/300',
          title: '嘉宾合影', tags: ['合影', '嘉宾'],
          exif_data: { make: 'Nikon', model: 'Z8', exposureTime: 0.01, fNumber: 4.0, iso: 100 },
          width: 1920, height: 1440, view_count: 98, like_count: 32, download_count: 15,
          created_at: '2024-04-03T14:20:00Z' },
        
        // 文艺表演
        { id: 4, live_id: 1, album_id: 2, photographer_name: 'Jack',
          original_url: 'https://picsum.photos/seed/live4/1920/1280',
          compressed_url: 'https://picsum.photos/seed/live4/800/533',
          thumbnail_url: 'https://picsum.photos/seed/live4/400/267',
          title: '舞蹈表演', tags: ['舞蹈', '表演'],
          exif_data: { make: 'Canon', model: 'EOS R6', exposureTime: 0.002, fNumber: 1.8, iso: 800, focalLength: 135 },
          width: 1920, height: 1280, view_count: 203, like_count: 67, download_count: 34,
          created_at: '2024-04-03T15:00:00Z' },
        
        { id: 5, live_id: 1, album_id: 2, photographer_name: 'Jack',
          original_url: 'https://picsum.photos/seed/live5/1920/1080',
          compressed_url: 'https://picsum.photos/seed/live5/800/450',
          thumbnail_url: 'https://picsum.photos/seed/live5/400/225',
          title: '乐队演奏', tags: ['音乐', '乐队'],
          exif_data: { make: 'Sony', model: 'A7S3', exposureTime: 0.005, fNumber: 2.8, iso: 640 },
          width: 1920, height: 1080, view_count: 178, like_count: 52, download_count: 28,
          created_at: '2024-04-03T15:20:00Z' },
        
        { id: 6, live_id: 1, album_id: 2, photographer_name: 'Jack',
          original_url: 'https://picsum.photos/seed/live6/1920/1440',
          compressed_url: 'https://picsum.photos/seed/live6/800/600',
          thumbnail_url: 'https://picsum.photos/seed/live6/400/300',
          title: '歌曲独唱', tags: ['唱歌', '独唱'],
          exif_data: { make: 'Canon', model: 'EOS R5', exposureTime: 0.004, fNumber: 2.0, iso: 500 },
          width: 1920, height: 1440, view_count: 145, like_count: 48, download_count: 21,
          created_at: '2024-04-03T15:40:00Z' },
        
        { id: 7, live_id: 1, album_id: 2, photographer_name: 'Jack',
          original_url: 'https://picsum.photos/seed/live7/1920/1280',
          compressed_url: 'https://picsum.photos/seed/live7/800/533',
          thumbnail_url: 'https://picsum.photos/seed/live7/400/267',
          title: '魔术表演', tags: ['魔术', '互动'],
          exif_data: { make: 'Sony', model: 'A7M4', exposureTime: 0.008, fNumber: 2.8, iso: 400 },
          width: 1920, height: 1280, view_count: 167, like_count: 55, download_count: 26,
          created_at: '2024-04-03T15:50:00Z' },
        
        // 颁奖典礼
        { id: 8, live_id: 1, album_id: 3, photographer_name: 'Jack',
          original_url: 'https://picsum.photos/seed/live8/1920/1080',
          compressed_url: 'https://picsum.photos/seed/live8/800/450',
          thumbnail_url: 'https://picsum.photos/seed/live8/400/225',
          title: '优秀员工颁奖', tags: ['颁奖', '优秀员工'],
          exif_data: { make: 'Nikon', model: 'Z8', exposureTime: 0.01, fNumber: 2.8, iso: 320 },
          width: 1920, height: 1080, view_count: 234, like_count: 89, download_count: 45,
          created_at: '2024-04-03T16:00:00Z' },
        
        { id: 9, live_id: 1, album_id: 3, photographer_name: 'Jack',
          original_url: 'https://picsum.photos/seed/live9/1920/1280',
          compressed_url: 'https://picsum.photos/seed/live9/800/533',
          thumbnail_url: 'https://picsum.photos/seed/live9/400/267',
          title: '团队奖颁发', tags: ['团队', '荣誉'],
          exif_data: { make: 'Canon', model: 'EOS R5', exposureTime: 0.008, fNumber: 2.8, iso: 400 },
          width: 1920, height: 1280, view_count: 198, like_count: 73, download_count: 38,
          created_at: '2024-04-03T16:20:00Z' },
        
        { id: 10, live_id: 1, album_id: 3, photographer_name: 'Jack',
          original_url: 'https://picsum.photos/seed/live10/1920/1440',
          compressed_url: 'https://picsum.photos/seed/live10/800/600',
          thumbnail_url: 'https://picsum.photos/seed/live10/400/300',
          title: '特等奖揭晓', tags: ['特等', '大奖'],
          exif_data: { make: 'Sony', model: 'A7M4', exposureTime: 0.005, fNumber: 2.0, iso: 640 },
          width: 1920, height: 1440, view_count: 289, like_count: 95, download_count: 52,
          created_at: '2024-04-03T16:40:00Z' },
        
        // 宴会合影
        { id: 11, live_id: 1, album_id: 4, photographer_name: 'Jack',
          original_url: 'https://picsum.photos/seed/live11/1920/1080',
          compressed_url: 'https://picsum.photos/seed/live11/800/450',
          thumbnail_url: 'https://picsum.photos/seed/live11/400/225',
          title: '宴会开场', tags: ['宴会', '干杯'],
          exif_data: { make: 'Canon', model: 'EOS R6', exposureTime: 0.0125, fNumber: 2.8, iso: 800 },
          width: 1920, height: 1080, view_count: 112, like_count: 41, download_count: 18,
          created_at: '2024-04-03T18:00:00Z' },
        
        { id: 12, live_id: 1, album_id: 4, photographer_name: 'Jack',
          original_url: 'https://picsum.photos/seed/live12/1920/1280',
          compressed_url: 'https://picsum.photos/seed/live12/800/533',
          thumbnail_url: 'https://picsum.photos/seed/live12/400/267',
          title: '全员大合影', tags: ['合影', '全家福'],
          exif_data: { make: 'Nikon', model: 'Z8', exposureTime: 0.0125, fNumber: 4.0, iso: 200 },
          width: 1920, height: 1280, view_count: 223, like_count: 62, download_count: 35,
          created_at: '2024-04-03T18:30:00Z' },
    ]
};

// ===== 应用状态 =====
const state = {
    photos: [...DEMO_DATA.photos],
    albums: DEMO_DATA.live.albums,
    currentAlbum: 'all',
    currentView: 'masonry',
    currentPhotoIndex: 0,
    keyword: '',
    sortBy: 'latest',
    filteredPhotos: [...DEMO_DATA.photos],
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
    loginBtn: document.getElementById('loginBtn'),
    userInfo: document.getElementById('userInfo'),
    userNickname: document.getElementById('userNickname'),
    uploadBtn: document.getElementById('uploadBtn'),
    shareBtn: document.getElementById('shareBtn'),
    shareModal: document.getElementById('shareModal'),
    shareLink: document.getElementById('shareLink'),
    copyLink: document.getElementById('copyLink'),
    liveNotification: document.getElementById('liveNotification'),
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
    statPhotos: document.getElementById('statPhotos'),
    statViews: document.getElementById('statViews'),
    statLikes: document.getElementById('statLikes'),
    menuToggle: document.getElementById('menuToggle'),
    sidebar: document.getElementById('sidebar')
};

// ===== 初始化 =====
function init() {
    loadLiveInfo();
    loadAlbums();
    filterPhotos();
    bindEvents();
    elements.shareLink.value = window.location.href;
    
    // 显示演示模式提示
    setTimeout(() => {
        showToast('📷 演示模式 - 所有功能均可体验', 'info');
    }, 1000);
}

// ===== 加载直播信息 =====
function loadLiveInfo() {
    elements.liveTitle.textContent = `📷 ${DEMO_DATA.live.title}`;
    elements.liveStatus.textContent = '直播中';
    elements.liveStatus.className = 'live-badge live';
    elements.statPhotos.textContent = DEMO_DATA.live.stats.total_photos;
    elements.statViews.textContent = DEMO_DATA.live.stats.total_views;
    elements.statLikes.textContent = DEMO_DATA.live.stats.total_likes;
}

// ===== 加载相册 =====
function loadAlbums() {
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
            <span class="album-count" id="countAll">${DEMO_DATA.live.total_photos}</span>
        </button>
        ${albumButtons}
    `;
}

// ===== 筛选图片 =====
function filterPhotos() {
    let filtered = [...state.photos];
    
    if (state.currentAlbum !== 'all') {
        filtered = filtered.filter(photo => photo.album_id === parseInt(state.currentAlbum));
    }
    
    if (state.keyword) {
        filtered = filtered.filter(photo => 
            photo.tags.some(tag => tag.includes(state.keyword))
        );
    }
    
    if (state.sortBy === 'popular') {
        filtered.sort((a, b) => b.like_count - a.like_count);
    } else if (state.sortBy === 'oldest') {
        filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } else {
        filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    
    state.filteredPhotos = filtered;
    renderPhotos();
    elements.photoCount.textContent = filtered.length;
    
    if (filtered.length === 0) {
        elements.emptyState.style.display = 'block';
    } else {
        elements.emptyState.style.display = 'none';
    }
}

// ===== 渲染图片 =====
function renderPhotos() {
    elements.photoGrid.innerHTML = state.filteredPhotos.map((photo, index) => {
        const isLiked = state.likedPhotos.has(photo.id);
        const likeCount = photo.like_count + (isLiked ? 1 : 0);
        
        return `
            <div class="photo-item" data-index="${index}">
                <img src="${photo.thumbnail_url}" alt="${photo.tags.join(', ')}" loading="lazy">
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
    const photo = state.filteredPhotos[state.currentPhotoIndex];
    if (!photo) return;
    
    elements.lightboxImage.src = photo.compressed_url;
    elements.lightboxTitle.textContent = photo.title;
    elements.lightboxTime.textContent = formatTime(photo.created_at);
    elements.lightboxPhotographer.textContent = `摄影师：${photo.photographer_name}`;
    elements.lightboxViews.textContent = photo.view_count;
    elements.lightboxLikeCount.textContent = photo.like_count + (state.likedPhotos.has(photo.id) ? 1 : 0);
    
    const isLiked = state.likedPhotos.has(photo.id);
    elements.lightboxLike.classList.toggle('liked', isLiked);
    elements.lightboxLike.querySelector('.action-icon').textContent = isLiked ? '❤️' : '🤍';
    elements.lightboxLike.querySelector('span:nth-child(2)').textContent = isLiked ? '已赞' : '点赞';
    
    elements.lightboxTags.innerHTML = photo.tags.map(tag => `<span class="tag">${tag}</span>`).join('');
    
    if (photo.exif_data.make || photo.exif_data.exposureTime) {
        elements.exifInfo.style.display = 'block';
        const exif = photo.exif_data;
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
    if (newIndex >= 0 && newIndex < state.filteredPhotos.length) {
        state.currentPhotoIndex = newIndex;
        updateLightboxContent();
    }
}

function toggleLike() {
    const photo = state.filteredPhotos[state.currentPhotoIndex];
    if (!photo) return;
    
    if (state.likedPhotos.has(photo.id)) {
        state.likedPhotos.delete(photo.id);
    } else {
        state.likedPhotos.add(photo.id);
    }
    
    localStorage.setItem('likedPhotos', JSON.stringify([...state.likedPhotos]));
    updateLightboxContent();
    filterPhotos();
}

// ===== 事件绑定 =====
function bindEvents() {
    elements.albumNav.addEventListener('click', (e) => {
        const btn = e.target.closest('.album-btn');
        if (btn) {
            elements.albumNav.querySelectorAll('.album-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.currentAlbum = btn.dataset.album;
            filterPhotos();
        }
    });
    
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.currentView = btn.dataset.view;
            elements.photoGrid.classList.toggle('grid-view', state.currentView === 'grid');
        });
    });
    
    let searchTimeout;
    elements.searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            state.keyword = e.target.value.trim();
            filterPhotos();
        }, 300);
    });
    
    elements.filterSelect.addEventListener('change', (e) => {
        state.sortBy = e.target.value;
        filterPhotos();
    });
    
    elements.lightboxClose.addEventListener('click', closeLightbox);
    elements.lightboxOverlay.addEventListener('click', closeLightbox);
    elements.lightboxPrev.addEventListener('click', () => navigateLightbox(-1));
    elements.lightboxNext.addEventListener('click', () => navigateLightbox(1));
    elements.lightboxLike.addEventListener('click', toggleLike);
    elements.lightboxDownload.addEventListener('click', () => {
        const photo = state.filteredPhotos[state.currentPhotoIndex];
        if (photo) window.open(photo.original_url, '_blank');
    });
    elements.lightboxShare.addEventListener('click', () => elements.shareModal.classList.add('show'));
    
    document.addEventListener('keydown', (e) => {
        if (!elements.lightbox.classList.contains('show')) return;
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft') navigateLightbox(-1);
        if (e.key === 'ArrowRight') navigateLightbox(1);
    });
    
    elements.shareBtn.addEventListener('click', () => elements.shareModal.classList.add('show'));
    elements.copyLink.addEventListener('click', () => {
        elements.shareLink.select();
        document.execCommand('copy');
        elements.copyLink.textContent = '已复制!';
        setTimeout(() => elements.copyLink.textContent = '复制链接', 2000);
    });
    
    document.querySelector('.notification-close').addEventListener('click', () => {
        elements.liveNotification.classList.remove('show');
    });
    
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => btn.closest('.modal').classList.remove('show'));
    });
    
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('show');
        });
    });
    
    let touchStartX = 0;
    elements.lightbox.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    });
    
    elements.lightbox.addEventListener('touchend', (e) => {
        const diff = touchStartX - e.changedTouches[0].screenX;
        if (Math.abs(diff) > 50) navigateLightbox(diff > 0 ? 1 : -1);
    });
    
    elements.menuToggle.addEventListener('click', () => {
        elements.sidebar.classList.toggle('show');
    });
}

function formatTime(time) {
    const date = new Date(time);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${month}-${day} ${hours}:${minutes}`;
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
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
    }, 2500);
}

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

document.addEventListener('DOMContentLoaded', init);
