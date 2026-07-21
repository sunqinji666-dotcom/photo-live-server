const slug = window.location.pathname.split('/').filter(Boolean).pop();
const accessStorageKey = `photo_live_access_${slug}`;
const favoritesStorageKey = `photo_live_favorites_${slug}`;
const liveCacheStorageKey = `photo_live_cache_${slug}`;

const state = {
    live: null,
    photos: [],
    album: 'all',
    page: 1,
    pages: 1,
    keyword: '',
    sort: 'latest',
    smartFiltersOpen: false,
    filters: {
        camera: '',
        lens: '',
        focal_length: '',
        aperture: '',
        iso: '',
        format: ''
    },
    filterOptions: null,
    autoHeroImage: '',
    loading: false,
    loadingLive: false,
    currentIndex: 0,
    accessToken: localStorage.getItem(accessStorageKey) || '',
    previewExpanded: false,
    originalLoaded: false,
    lastTapAt: 0,
    searchOpen: false,
    viewMode: '',
    favorites: new Set(JSON.parse(localStorage.getItem(favoritesStorageKey) || '[]')),
    favoritesManageMode: false,
    favoriteSelections: new Set(),
    selectionMode: false,
    selectedPhotoIds: new Set(),
    renderedCount: 0,
    renderChunkSize: 18,
    fetchLimit: 18,
    infoOpen: true,
    autoplayMode: 'off',
    touchStartX: 0,
    lightboxLoadToken: 0,
    lightboxTransitionTimer: 0,
    downloadJob: null,
    downloadJobMinimized: false,
    downloadJobPollTimer: 0,
    mobileFeedMode: 'count',
    mobileFeedModeTimer: 0,
    mobileFavoriteFloatTimer: 0,
    mobileFavoriteFloatDismissTimer: 0,
    scrollUiRaf: 0,
    scrollLockY: 0,
    liveVersionPollTimer: 0,
    contentVersion: '',
    viewerSessionId: Number(sessionStorage.getItem(`photo_live_session_${slug}`) || 0),
    viewerSessionStartedAt: Number(sessionStorage.getItem(`photo_live_session_started_${slug}`) || 0),
    viewerSessionEnded: false,
    openingVisible: false,
    openingTimer: 0,
    openingCountdown: 3
};

const isWeChat = /MicroMessenger/i.test(navigator.userAgent);
const isSafariLike = (() => {
    const ua = navigator.userAgent;
    if (/iP(hone|ad|od)/i.test(ua) && /AppleWebKit/i.test(ua)) {
        return true;
    }
    return /Safari/i.test(ua) && !/Chrome|Chromium|Android|CriOS|FxiOS|EdgiOS|Edg\//i.test(ua);
})();
const isMobileSafari = isSafariLike && /iP(hone|ad|od)/i.test(navigator.userAgent);
const isDesktopSafari = isSafariLike && !/iP(hone|ad|od)/i.test(navigator.userAgent);

const elements = {
    accessForm: document.getElementById('accessForm'),
    accessHint: document.getElementById('accessHint'),
    accessInput: document.getElementById('accessInput'),
    accessLayer: document.getElementById('accessLayer'),
    albumStrip: document.getElementById('albumStrip'),
    batchDownloadButton: document.getElementById('batchDownloadButton'),
    bgMusic: document.getElementById('bgMusic'),
    detailGrid: document.getElementById('detailGrid'),
    desktopHintButton: document.getElementById('desktopHintButton'),
    desktopGalleryActions: document.getElementById('desktopGalleryActions'),
    desktopRail: document.getElementById('desktopRail'),
    desktopRailDownload: document.getElementById('desktopRailDownload'),
    desktopRailHint: document.getElementById('desktopRailHint'),
    desktopRailMode: document.getElementById('desktopRailMode'),
    desktopFavoritesButton: document.getElementById('desktopFavoritesButton'),
    desktopInfoButton: document.getElementById('desktopInfoButton'),
    copyPhotoLinkButton: document.getElementById('copyPhotoLinkButton'),
    dismissWechatTip: document.getElementById('dismissWechatTip'),
    downloadAllButton: document.getElementById('downloadAllButton'),
    downloadJobCard: document.getElementById('downloadJobCard'),
    downloadJobCloseButton: document.getElementById('downloadJobCloseButton'),
    downloadJobCopy: document.getElementById('downloadJobCopy'),
    downloadJobDismissButton: document.getElementById('downloadJobDismissButton'),
    downloadJobEyebrow: document.getElementById('downloadJobEyebrow'),
    downloadJobLink: document.getElementById('downloadJobLink'),
    downloadJobModal: document.getElementById('downloadJobModal'),
    downloadJobProgressFill: document.getElementById('downloadJobProgressFill'),
    downloadJobRestoreButton: document.getElementById('downloadJobRestoreButton'),
    downloadJobRestoreText: document.getElementById('downloadJobRestoreText'),
    downloadJobStatusTag: document.getElementById('downloadJobStatusTag'),
    downloadJobTitle: document.getElementById('downloadJobTitle'),
    downloadButton: document.getElementById('downloadButton'),
    enterGalleryButton: document.getElementById('enterGalleryButton'),
    emptyState: document.getElementById('emptyState'),
    favoriteEntryButton: document.getElementById('favoriteEntryButton'),
    featureStrip: document.getElementById('featureStrip'),
    favoriteBadge: document.getElementById('favoriteBadge'),
    favoriteButton: document.getElementById('favoriteButton'),
    favoritesActions: document.getElementById('favoritesActions'),
    favoritesBackButton: document.getElementById('favoritesBackButton'),
    favoritesDownloadButton: document.getElementById('favoritesDownloadButton'),
    favoritesDrawer: document.getElementById('favoritesDrawer'),
    favoritesClearButton: document.getElementById('favoritesClearButton'),
    favoritesDropzone: document.getElementById('favoritesDropzone'),
    favoritesGrid: document.getElementById('favoritesGrid'),
    favoritesManageButton: document.getElementById('favoritesManageButton'),
    favoritesSelectAllButton: document.getElementById('favoritesSelectAllButton'),
    favoritesSummary: document.getElementById('favoritesSummary'),
    heroBackdrop: document.getElementById('heroBackdrop'),
    heroButtonsMain: document.getElementById('heroButtonsMain'),
    heroButtonsSub: document.getElementById('heroButtonsSub'),
    heroShellDescription: document.getElementById('heroShellDescription'),
    gestureHint: document.getElementById('gestureHint'),
    heroCardTitle: document.getElementById('heroCardTitle'),
    heroPill: document.getElementById('heroPill'),
    lightboxLiveTitle: document.getElementById('lightboxLiveTitle'),
    lightbox: document.getElementById('lightbox'),
    lightboxImage: document.getElementById('lightboxImage'),
    lightboxImageShell: document.getElementById('lightboxImageShell'),
    likeButton: document.getElementById('likeButton'),
    liveDate: document.getElementById('liveDate'),
    liveDescription: document.getElementById('liveDescription'),
    liveLocation: document.getElementById('liveLocation'),
    liveStatus: document.getElementById('liveStatus'),
    liveSubtitle: document.getElementById('liveSubtitle'),
    liveTitle: document.getElementById('liveTitle'),
    loading: document.getElementById('loading'),
    loadingFill: document.getElementById('loadingFill'),
    loadingLabel: document.getElementById('loadingLabel'),
    loadingMeta: document.getElementById('loadingMeta'),
    metricLikes: document.getElementById('metricLikes'),
    metricPhotos: document.getElementById('metricPhotos'),
    metricViews: document.getElementById('metricViews'),
    mobileCopyLinkButton: document.getElementById('mobileCopyLinkButton'),
    mobileFavoriteFloat: document.getElementById('mobileFavoriteFloat'),
    mobileFavoriteFloatCount: document.getElementById('mobileFavoriteFloatCount'),
    mobilePopularHero: document.getElementById('mobilePopularHero'),
    nextButton: document.getElementById('nextButton'),
    photoGrid: document.getElementById('photoGrid'),
    photoProgress: document.getElementById('photoProgress'),
    photoCounter: document.getElementById('photoCounter'),
    photoMeta: document.getElementById('photoMeta'),
    photoTitle: document.getElementById('photoTitle'),
    prevButton: document.getElementById('prevButton'),
    previewHint: document.getElementById('previewHint'),
    printButton: document.getElementById('printButton'),
    searchInput: document.getElementById('searchInput'),
    searchSheet: document.getElementById('searchSheet'),
    searchSheetInput: document.getElementById('searchSheetInput'),
    searchSheetHelper: document.getElementById('searchSheetHelper'),
    searchSheetCloseButton: document.getElementById('searchSheetCloseButton'),
    searchSheetClearButton: document.getElementById('searchSheetClearButton'),
    searchSheetFilters: document.getElementById('searchSheetFilters'),
    searchSheetFilterGroups: document.getElementById('searchSheetFilterGroups'),
    clearSearchSheetFiltersButton: document.getElementById('clearSearchSheetFiltersButton'),
    searchHelper: document.getElementById('searchHelper'),
    smartFilters: document.getElementById('smartFilters'),
    smartFilterGroups: document.getElementById('smartFilterGroups'),
    clearSmartFiltersButton: document.getElementById('clearSmartFiltersButton'),
    selectionBar: document.getElementById('selectionBar'),
    selectionCancelButton: document.getElementById('selectionCancelButton'),
    selectionClearButton: document.getElementById('selectionClearButton'),
    selectionCountText: document.getElementById('selectionCountText'),
    selectionHintText: document.getElementById('selectionHintText'),
    shellEyebrow: document.getElementById('shellEyebrow'),
    shareButton: document.getElementById('shareButton'),
    sortSelect: document.getElementById('sortSelect'),
    tagList: document.getElementById('tagList'),
    toast: document.getElementById('toast'),
    toastText: document.getElementById('toastText'),
    toastTitle: document.getElementById('toastTitle'),
    toolbarActions: document.getElementById('toolbarActions'),
    toolbarTabs: document.getElementById('toolbarTabs'),
    toggleInfoButton: document.getElementById('toggleInfoButton'),
    toggleSelectButton: document.getElementById('toggleSelectButton'),
    wechatTip: document.getElementById('wechatTip'),
    searchToggleButton: document.getElementById('searchToggleButton'),
    lightboxSide: document.getElementById('lightboxSide'),
    lightboxThumbStrip: document.getElementById('lightboxThumbStrip'),
    autoplayButton: document.getElementById('autoplayButton'),
    shuffleButton: document.getElementById('shuffleButton'),
    smartFilterToggleButton: document.getElementById('smartFilterToggleButton'),
    jobStageQueued: document.getElementById('jobStageQueued'),
    jobStageProcessing: document.getElementById('jobStageProcessing'),
    jobStageReady: document.getElementById('jobStageReady'),
    mobileSharpButton: document.getElementById('mobileSharpButton'),
    openingScreen: document.getElementById('openingScreen'),
    openingImage: document.getElementById('openingImage'),
    openingSkipButton: document.getElementById('openingSkipButton')
};

const socket = io({ transports: ['polling'], upgrade: false, autoConnect: false });

init().catch((error) => {
    showToast(error.message || '页面加载失败');
});

async function init() {
    setupViewportCompatibility();
    bindEvents();
    syncPerformanceMode();
    applyClientShell();
    renderPhotoSkeletons();
    await loadLive();

    socket.on('connect', () => {
        if (state.live?.id) {
            socket.emit('join-live', state.live.id);
        }
    });

    socket.on('photo-uploaded', async () => {
        if (!state.live?.access_granted) {
            return;
        }
        showToast('有新照片更新');
        await loadPhotos(true);
        await loadLive(false);
    });
}

function setupViewportCompatibility() {
    document.body.classList.toggle('safari-browser', isSafariLike);
    document.body.classList.toggle('safari-mobile-browser', isMobileSafari);
    document.body.classList.toggle('safari-desktop-browser', isDesktopSafari);
    document.body.classList.toggle('webkit-browser', /AppleWebKit/i.test(navigator.userAgent));
    document.body.classList.toggle('ios-browser', /iP(hone|ad|od)/i.test(navigator.userAgent));

    const updateViewportVars = () => {
        const viewport = window.visualViewport;
        const height = Math.round(viewport?.height || window.innerHeight || document.documentElement.clientHeight || 0);
        const width = Math.round(viewport?.width || window.innerWidth || document.documentElement.clientWidth || 0);
        if (height > 0) {
            document.documentElement.style.setProperty('--app-height', `${height}px`);
        }
        if (width > 0) {
            document.documentElement.style.setProperty('--app-width', `${width}px`);
        }
    };

    updateViewportVars();
    window.addEventListener('resize', updateViewportVars, { passive: true });
    window.addEventListener('orientationchange', updateViewportVars, { passive: true });
    window.visualViewport?.addEventListener('resize', updateViewportVars, { passive: true });
    window.visualViewport?.addEventListener('scroll', updateViewportVars, { passive: true });
}

function lockPageScroll() {
    if (document.body.dataset.scrollLocked === '1') {
        return;
    }
    state.scrollLockY = window.scrollY || window.pageYOffset || 0;
    document.body.dataset.scrollLocked = '1';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${state.scrollLockY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
}

function unlockPageScroll() {
    if (document.body.dataset.scrollLocked !== '1') {
        return;
    }
    const scrollY = state.scrollLockY || 0;
    delete document.body.dataset.scrollLocked;
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    window.scrollTo(0, scrollY);
}

async function loadLive(trackView = true) {
    setLiveLoading(true);
    const versionResponse = await api(`/lives/slug/${slug}/version`);
    const versionInfo = versionResponse.data || {};
    state.contentVersion = versionInfo.content_version || '';

    const cached = readLiveCache();
    if (
        cached &&
        cached.version === state.contentVersion &&
        versionInfo.access_granted &&
        cached.live?.access_granted
    ) {
        state.live = cached.live;
        syncOpeningShellState();
        state.filterOptions = cached.filterOptions || null;
        state.photos = cached.photos || [];
        state.page = cached.page || 1;
        state.pages = cached.pages || 1;
        state.autoHeroImage = cached.autoHeroImage || '';
        state.renderedCount = Math.min(state.renderChunkSize, state.photos.length);
        syncCanonicalLiveUrl();
        renderLive();
        renderPhotos();
        renderSelectionBar();
        syncHeroBackdrop();
        syncLiveSocket();
        setLiveLoading(false);
        maybeShowOpeningSplash();
        maybeShowWechatTip();
        scheduleLiveVersionPolling();

        if (trackView) {
            api(`/lives/${state.live.id}/view`, { method: 'POST' }).catch(() => {});
            ensureViewerSession().catch(() => {});
        }
        return;
    }

    const response = await api(`/lives/slug/${slug}`);
    state.live = response.data;
    syncOpeningShellState();
    state.autoHeroImage = '';
    syncCanonicalLiveUrl();
    maybeShowOpeningSplash();
    renderLive();

    if (!state.live.access_granted) {
        syncLiveSocket();
        elements.accessLayer.hidden = false;
        elements.wechatTip.hidden = true;
        setFeedStatus('访问受保护', '请输入访问密码后查看照片', 0);
        setLiveLoading(false);
        scheduleLiveVersionPolling();
        return;
    }

    elements.accessLayer.hidden = true;
    await loadFilterOptions();
    await loadPhotos(true);
    syncLiveSocket();
    setLiveLoading(false);
    maybeShowWechatTip();
    persistLiveCache();
    scheduleLiveVersionPolling();

    if (trackView) {
        api(`/lives/${state.live.id}/view`, { method: 'POST' }).catch(() => {});
        ensureViewerSession().catch(() => {});
    }
}

function syncOpeningShellState() {
    const shouldShowOpening = Number(state.live?.show_opening ?? 0) === 1 && Boolean(state.live?.opening_image);
    document.body.classList.toggle('pre-opening', shouldShowOpening);
}

function syncCanonicalLiveUrl() {
    if (!state.live?.slug) {
        return;
    }

    const canonicalPath = `/live/${encodeURIComponent(state.live.slug)}`;
    if (window.location.pathname !== canonicalPath) {
        const nextUrl = `${canonicalPath}${window.location.search}${window.location.hash}`;
        window.history.replaceState({}, '', nextUrl);
    }
}

async function loadPhotos(reset = false) {
    if (!state.live?.access_granted) {
        return;
    }

    if (state.loading || (!reset && state.page > state.pages)) {
        return;
    }

    if (reset) {
        state.page = 1;
        state.pages = 1;
        state.photos = [];
        state.renderedCount = 0;
        renderPhotoSkeletons();
    }

    state.loading = true;
    updateFeedLoadingState();

    try {
        const query = new URLSearchParams({
            live_id: String(state.live.id),
            album_id: state.album,
            page: String(state.page),
            sort: state.sort,
            limit: String(state.fetchLimit)
        });

        if (state.keyword) {
            query.set('keyword', state.keyword);
        }

        Object.entries(state.filters).forEach(([key, value]) => {
            if (value) {
                query.set(key, value);
            }
        });

        const response = await api(`/photos?${query.toString()}`);
        state.photos = reset ? response.data.photos : state.photos.concat(response.data.photos);
        if (reset && !state.live?.banner_image && !state.live?.cover_image && !state.autoHeroImage && response.data.photos.length) {
            state.autoHeroImage = pickAutoHeroImage(response.data.photos);
        }
        if (reset) {
            state.renderedCount = Math.min(state.renderChunkSize, state.photos.length);
        }
        if (reset && state.selectionMode) {
            state.selectedPhotoIds.clear();
        }
        state.page = response.data.page + 1;
        state.pages = response.data.pages;
        renderPhotos();
        renderSelectionBar();
        syncHeroBackdrop();
        elements.emptyState.hidden = state.photos.length > 0;
        if (reset) {
            persistLiveCache();
        }
    } catch (error) {
        showToast(error.message || '加载失败');
    } finally {
        state.loading = false;
        updateFeedLoadingState();
    }
}

async function loadFilterOptions() {
    if (!state.live?.access_granted) {
        return;
    }

    const query = new URLSearchParams();
    if (state.album !== 'all') {
        query.set('album_id', state.album);
    }

    const suffix = query.toString() ? `?${query.toString()}` : '';
    const response = await api(`/photos/live/${state.live.id}/filter-options${suffix}`);
    state.filterOptions = response.data;
    renderSearchHelper();
    renderSmartFilters();
    if (state.album === 'all' && !state.keyword && state.sort === 'latest' && !Object.values(state.filters).some(Boolean)) {
        persistLiveCache();
    }
}

function renderLive() {
    document.title = `${state.live.title} | 客户相册`;
    if (!state.viewMode) {
        state.viewMode = state.live.layout_mode === 'grid' ? 'grid' : 'waterfall';
    }
    elements.liveTitle.textContent = state.live.title;
    if (elements.liveSubtitle) {
        const subtitle = String(state.live.subtitle || '').trim();
        elements.liveSubtitle.textContent = subtitle;
        elements.liveSubtitle.hidden = !subtitle;
    }
    elements.heroCardTitle.textContent = state.live.subtitle || '向下滑动开始看照片';
    elements.liveDescription.textContent = state.live.description || '客户可直接在手机和电脑上查看、筛选和下载照片。';
    elements.liveDate.textContent = state.live.event_date ? formatDate(state.live.event_date) : '时间待定';
    elements.liveLocation.textContent = state.live.location_name || '拍摄现场';
    elements.liveStatus.textContent = state.live.status === 'live' ? '可查看' : state.live.status === 'ended' ? '已归档' : '整理中';
    elements.liveStatus.className = `status-badge ${state.live.status === 'ended' ? 'ended' : ''}`;
    elements.metricPhotos.textContent = state.live.total_photos || 0;
    elements.metricViews.textContent = state.live.total_views || 0;
    elements.metricLikes.textContent = state.live.total_likes || 0;
    const batchEnabled = Number(state.live.allow_batch_download) === 1;
    elements.batchDownloadButton.hidden = !batchEnabled;
    elements.downloadAllButton.hidden = !batchEnabled || isMobileViewport();
    elements.toggleSelectButton.hidden = !batchEnabled || isMobileViewport();
    elements.downloadAllButton.textContent = state.album === 'all' ? '打包整场' : '打包本组';
    elements.shareButton.hidden = Number(state.live.enable_share) !== 1;
    elements.heroPill.textContent = state.live.status === 'live' ? '照片直播' : '客户相册';
    elements.shellEyebrow.textContent = isMobileViewport() ? '微信查看页' : '桌面浏览页';
    elements.heroShellDescription.textContent = isMobileViewport()
        ? '手机里先轻量看图，点按钮加载原图后再长按保存。'
        : '电脑端适合筛选、批量选择和云端打包原图。';
    elements.desktopRailMode.textContent = state.viewMode === 'grid' ? '桌面网格浏览' : '桌面瀑布浏览';
    elements.desktopRailDownload.textContent = Number(state.live.allow_batch_download) === 1 ? '原图 ZIP · 七牛云端打包' : '当前未开启批量下载';
    elements.desktopRailHint.textContent = Number(state.live.allow_batch_download) === 1
        ? '打包整场是整组原图，批量下载是所选原图'
        : '当前相册只保留单张原图下载';
    applyViewMode();

    const albums = [
        { id: 'all', icon: '📷', name: '全部照片', photo_count: state.live.total_photos || 0 },
        ...(state.live.albums || [])
    ];

    elements.albumStrip.innerHTML = albums.map((album) => `
        <button type="button" class="${state.album === String(album.id) ? 'active' : ''}" data-album="${album.id}">
            ${album.icon || '📷'} ${album.name} (${album.photo_count || 0})
        </button>
    `).join('');

    elements.favoriteEntryButton.textContent = `收藏夹 ${state.favorites.size}`;
    renderSearchHelper();
    renderSmartFilters();
    renderFeatureStrip();
    renderToolbarTabs();
    renderSelectionBar();
    syncHeroBackdrop();
    syncMusic();
}

function renderFeatureStrip() {
    const items = [
        {
            label: '访问',
            value: state.live.requires_access_code ? '密码查看' : '公开查看'
        },
        {
            label: '分享',
            value: Number(state.live.enable_share) === 1 ? '可转发' : '不显示分享'
        },
        {
            label: '下载',
            value: buildDownloadLabel()
        }
    ];

    if (state.live.subtitle) {
        items.unshift({
            label: '相册主题',
            value: state.live.subtitle
        });
    }

    if (state.live.background_music) {
        items.push({
            label: '音乐',
            value: elements.bgMusic.paused ? '点击播放' : '正在播放',
            action: 'toggle-music'
        });
    }

    elements.featureStrip.innerHTML = items.map((item) => `
        <button class="feature-card ${item.action ? 'action' : ''}" type="button" ${item.action ? `data-action="${item.action}"` : 'disabled'}>
            <span>${escapeHtml(item.label)}</span>
            <strong>${escapeHtml(item.value)}</strong>
        </button>
    `).join('');
}

function renderPhotos() {
    const mobilePopularOffset = isMobileViewport() && state.sort === 'popular' && state.photos.length ? 1 : 0;
    const visiblePhotos = state.photos.slice(mobilePopularOffset, (state.renderedCount || state.photos.length) + mobilePopularOffset);
    elements.photoGrid.innerHTML = visiblePhotos.map((photo, index) => `
        <article class="photo-card ${state.selectionMode ? 'selection-mode' : ''} ${state.selectedPhotoIds.has(String(photo.id)) ? 'selected' : ''}" data-index="${index + mobilePopularOffset}" data-photo-id="${photo.id}">
            <img
                class="is-preview progressive-photo"
                src="${buildAdaptivePhotoSrc(photo, 'thumb')}"
                data-preview-src="${buildViewerImageSrc(photo)}"
                alt="${escapeHtml(photo.title || state.live.title)}"
                loading="lazy"
            >
            <button class="photo-card-favorite ${isFavorite(photo.id) ? 'active' : ''}" type="button" data-favorite-toggle="${photo.id}" aria-label="收藏照片">
                ${isFavorite(photo.id) ? '★' : '♡'}
            </button>
            <button class="photo-card-check" type="button" aria-label="选择照片">
                <span>${state.selectedPhotoIds.has(String(photo.id)) ? '✓' : ''}</span>
            </button>
            <span class="photo-card-selected-flag">已选中</span>
            <div class="photo-card-info">
                <div class="photo-card-title">
                    <strong>${escapeHtml(photo.title || state.live.title)}</strong>
                    <span>${formatShort(photo.created_at)} · ${escapeHtml(photo.album_name || '未分类')}</span>
                </div>
                <span class="photo-card-stat">${isFavorite(photo.id) ? '已收藏' : `♡ ${photo.like_count || 0}`}</span>
            </div>
        </article>
    `).join('');

    enhanceProgressiveGridImages();
    renderMobilePopularHero();
    updateFeedLoadingState();
    scheduleMobileFeedTopToggle();
    ensureFeedObserver();
}

function renderMobilePopularHero() {
    if (!elements.mobilePopularHero) {
        return;
    }

    const shouldShow = isMobileViewport() && state.sort === 'popular' && state.photos.length > 0;
    elements.mobilePopularHero.hidden = !shouldShow;
    if (!shouldShow) {
        elements.mobilePopularHero.innerHTML = '';
        return;
    }

    const photo = state.photos[0];
    elements.mobilePopularHero.innerHTML = `
        <button class="mobile-popular-card" type="button" data-mobile-popular-open="${photo.id}">
            <span class="mobile-popular-badge">TOP 1</span>
            <img src="${buildAdaptivePhotoSrc(photo, 'popular')}" alt="${escapeHtml(photo.title || state.live.title)}">
            <div class="mobile-popular-copy">
                <strong>${escapeHtml(photo.title || state.live.title)}</strong>
                <span>${photo.like_count || 0} 人喜欢 · ${escapeHtml(photo.album_name || '热门照片')}</span>
            </div>
        </button>
    `;
}

function revealMoreRenderedPhotos() {
    if (state.renderedCount >= state.photos.length) {
        return false;
    }
    state.renderedCount = Math.min(state.renderedCount + state.renderChunkSize, state.photos.length);
    renderPhotos();
    return true;
}

function updateFeedLoadingState() {
    if (!state.live?.access_granted) {
        return;
    }

    const { percent, count } = getBrowseProgressSnapshot();
    const allLoaded = state.renderedCount >= state.photos.length && state.page > state.pages;
    const reachedEnd = allLoaded && percent >= 99;

    elements.loading.classList.toggle('is-busy', state.loading);
    elements.loading.classList.toggle('has-more-local', state.renderedCount < state.photos.length);
    elements.loading.classList.toggle('has-more-remote', state.renderedCount >= state.photos.length && state.page <= state.pages);
    elements.loading.classList.toggle('is-complete', reachedEnd);

    if (state.loading) {
        setFeedStatus(buildFeedCountLabel(count), '正在加载更多照片...', percent);
        return;
    }
    if (reachedEnd) {
        setFeedStatus(isMobileViewport() ? '↑ TOP' : '已经到底了', isMobileViewport() ? '返回顶部' : '当前照片已经全部浏览完成', 100);
        return;
    }
    if (state.renderedCount < state.photos.length) {
        setFeedStatus(buildFeedCountLabel(count), '继续下滑，显示更多照片', percent);
        return;
    }
    if (state.page <= state.pages) {
        setFeedStatus(buildFeedCountLabel(count), '继续下滑，加载下一批照片', percent);
        return;
    }
    setFeedStatus(buildFeedCountLabel(count), '继续下滑浏览剩余照片', percent);
}

function ensureFeedObserver() {
    if (ensureFeedObserver.observer) {
        ensureFeedObserver.observer.disconnect();
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting || !state.live?.access_granted) {
                return;
            }

            if (revealMoreRenderedPhotos()) {
                return;
            }

            if (!state.loading && state.page <= state.pages) {
                loadPhotos(false).catch(() => {});
            }
        });
    }, {
        rootMargin: '900px 0px'
    });

    observer.observe(elements.loading);
    ensureFeedObserver.observer = observer;
}

function renderPhotoSkeletons() {
    elements.photoGrid.innerHTML = Array.from({ length: 8 }).map(() => `
        <article class="photo-card skeleton-card">
            <div class="skeleton skeleton-photo"></div>
            <div class="photo-card-info">
                <div class="photo-card-title">
                    <span class="skeleton skeleton-line"></span>
                    <span class="skeleton skeleton-line short"></span>
                </div>
            </div>
        </article>
    `).join('');
}

function openLightbox(index) {
    const previousIndex = state.currentIndex;
    state.currentIndex = index;
    state.previewExpanded = false;
    state.originalLoaded = false;
    state.infoOpen = !isMobileViewport();
    const photo = state.photos[index];
    if (!photo) {
        return;
    }

    elements.lightbox.hidden = false;
    lockPageScroll();
    elements.lightboxLiveTitle.textContent = state.live?.title || '客户相册';
    pulseLightboxTransition(index !== previousIndex);
    setLightboxImageLoading(true);
    const previewSrc = buildInitialPreviewSrc(photo);
    loadLightboxImage(previewSrc);
    elements.lightboxImage.classList.add('is-preview');
    elements.lightboxImage.classList.remove('is-sharp');
    renderLightboxPhoto(photo);
    renderThumbnails();
    renderFavoritesDrawer();
    showGestureHint();
    window.clearTimeout(openLightbox.upgradeTimer);
    openLightbox.upgradeTimer = window.setTimeout(() => {
        expandCurrentPreview();
    }, 220);
    api(`/photos/${photo.id}`).then((response) => {
        const fresh = response.data;
        state.photos[index] = fresh;
        renderLightboxPhoto(fresh);
        renderThumbnails();
    }).catch(() => {});
}

function openPhotoWithFlash(index) {
    showToast('正在打开照片，请稍候', {
        title: '正在打开',
        variant: 'opening',
        duration: 720
    });
    openLightbox(index);
}

function setLightboxImageLoading(loading) {
    elements.lightboxImageShell.classList.toggle('is-loading', loading);
    elements.lightboxImage.classList.toggle('is-loading', loading);
}

function pulseLightboxTransition(strong = false) {
    window.clearTimeout(state.lightboxTransitionTimer);
    elements.lightboxImageShell.classList.remove('is-transitioning', 'is-transitioning-strong');
    void elements.lightboxImageShell.offsetWidth;
    elements.lightboxImageShell.classList.add('is-transitioning');
    if (strong) {
        elements.lightboxImageShell.classList.add('is-transitioning-strong');
    }
    state.lightboxTransitionTimer = window.setTimeout(() => {
        elements.lightboxImageShell.classList.remove('is-transitioning', 'is-transitioning-strong');
    }, strong ? 360 : 280);
}

function loadLightboxImage(src) {
    const token = ++state.lightboxLoadToken;
    const handleLoad = () => {
        if (token !== state.lightboxLoadToken) {
            return;
        }
        setLightboxImageLoading(false);
    };

    elements.lightboxImage.onload = handleLoad;
    elements.lightboxImage.onerror = handleLoad;
    elements.lightboxImage.src = src;
}

function closeLightbox() {
    elements.lightbox.hidden = true;
    elements.lightbox.classList.remove('mobile-info-open');
    unlockPageScroll();
    window.clearTimeout(openLightbox.upgradeTimer);
    window.clearTimeout(showGestureHint.timer);
    elements.gestureHint.hidden = true;
    stopAutoplay();
}

function moveLightbox(step) {
    const next = state.currentIndex + step;
    if (next < 0 || next >= state.photos.length) {
        return;
    }
    openLightbox(next);
}

function expandCurrentPreview() {
    const photo = state.photos[state.currentIndex];
    if (!photo) {
        return;
    }

    if (state.previewExpanded) {
        if (!state.originalLoaded) {
            loadOriginalPreview(photo);
        }
        return;
    }

    const sharpSrc = buildViewerImageSrc(photo);
    if (!sharpSrc) {
        return;
    }

    state.previewExpanded = true;
    pulseLightboxTransition();
    setLightboxImageLoading(true);
    const probe = new Image();
    probe.onload = () => {
        if (state.photos[state.currentIndex]?.id !== photo.id) {
            return;
        }
        loadLightboxImage(sharpSrc);
        elements.lightboxImage.classList.remove('is-preview');
        elements.lightboxImage.classList.add('is-sharp');
        elements.previewHint.textContent = buildPreviewHint();
        elements.mobileSharpButton.textContent = isMobileViewport() ? '加载原图' : '加载原图';
    };
    probe.src = sharpSrc;
}

function loadOriginalPreview(photo) {
    const originalSrc = buildOriginalPreviewSrc(photo);
    if (!originalSrc) {
        return;
    }

    pulseLightboxTransition();
    setLightboxImageLoading(true);
    const probe = new Image();
    probe.onload = () => {
        if (state.photos[state.currentIndex]?.id !== photo.id) {
            return;
        }
        state.originalLoaded = true;
        loadLightboxImage(originalSrc);
        elements.lightboxImage.classList.remove('is-preview');
        elements.lightboxImage.classList.add('is-sharp');
        elements.previewHint.textContent = buildPreviewHint();
        elements.mobileSharpButton.textContent = isMobileViewport() ? '长按保存' : '原图已加载';
        if (!isMobileViewport()) {
            showToast('已切换到原图预览');
        }
    };
    probe.src = originalSrc;
}

async function likeCurrentPhoto() {
    const photo = state.photos[state.currentIndex];
    if (!photo) {
        return;
    }

    const response = await api(`/photos/${photo.id}/like`, { method: 'POST' });
    photo.like_count = Math.max(0, (photo.like_count || 0) + (response.liked ? 1 : -1));
    elements.likeButton.textContent = `点赞 (${photo.like_count || 0})`;
    renderPhotos();
}

function renderLightboxPhoto(photo) {
    elements.photoTitle.textContent = photo.title || state.live.title;
    elements.photoMeta.textContent = buildPhotoMeta(photo);
    elements.previewHint.textContent = buildPreviewHint();
    elements.downloadButton.href = buildDownloadHref(photo);
    elements.downloadButton.download = buildOriginalFileName(photo);
    elements.downloadButton.hidden = !elements.downloadButton.href;
    elements.downloadButton.textContent = '下载原图';
    const allowClientLinkCopy = Number(state.live?.enable_client_link_copy || 0) === 1;
    elements.copyPhotoLinkButton.hidden = !allowClientLinkCopy;
    elements.mobileCopyLinkButton.hidden = !allowClientLinkCopy;
    elements.likeButton.textContent = `点赞 ${photo.like_count || 0}`;
    elements.favoriteButton.textContent = isFavorite(photo.id) ? '已收藏' : '收藏';
    elements.mobileSharpButton.textContent = state.originalLoaded ? '长按保存' : state.previewExpanded ? '加载原图' : '查看高清图';
    elements.tagList.innerHTML = (photo.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join('');
    elements.detailGrid.innerHTML = buildDetails(photo.exif_data || {});
    elements.photoCounter.textContent = `${state.currentIndex + 1} / ${state.photos.length}`;
    elements.photoProgress.max = String(Math.max(state.photos.length, 1));
    elements.photoProgress.value = String(state.currentIndex + 1);
    elements.favoriteBadge.textContent = `收藏夹 ${state.favorites.size}`;
    elements.favoriteEntryButton.textContent = `收藏夹 ${state.favorites.size}`;
    elements.lightboxSide.hidden = !state.infoOpen;
    elements.lightbox.classList.toggle('mobile-info-open', isMobileViewport() && state.infoOpen);
    elements.desktopInfoButton.classList.toggle('active', state.infoOpen);
    elements.toggleInfoButton.classList.toggle('active', state.infoOpen);
    elements.toggleInfoButton.textContent = state.infoOpen ? '收起' : '信息';
}

function showGestureHint() {
    if (!isMobileViewport()) {
        elements.gestureHint.hidden = true;
        return;
    }
    elements.gestureHint.hidden = false;
    window.clearTimeout(showGestureHint.timer);
    showGestureHint.timer = window.setTimeout(() => {
        elements.gestureHint.hidden = true;
    }, 3200);
}

function renderThumbnails() {
    const start = Math.max(0, state.currentIndex - 8);
    const end = Math.min(state.photos.length, start + 18);
    elements.lightboxThumbStrip.innerHTML = state.photos.slice(start, end).map((photo, offset) => {
        const index = start + offset;
        return `
            <button class="thumb-tile ${index === state.currentIndex ? 'active' : ''}" type="button" data-thumb-index="${index}">
                <img src="${buildAdaptivePhotoSrc(photo, 'thumb')}" alt="${escapeHtml(photo.title || state.live.title)}">
            </button>
        `;
    }).join('');
}

async function verifyAccess(event) {
    event.preventDefault();
    if (!state.live?.id) {
        return;
    }

    const response = await api(`/lives/${state.live.id}/verify-access`, {
        method: 'POST',
        body: JSON.stringify({
            code: elements.accessInput.value.trim()
        })
    });

    state.accessToken = response.data.accessToken;
    localStorage.setItem(accessStorageKey, state.accessToken);
    elements.accessInput.value = '';
    await loadLive(false);
    showToast('访问验证成功');
}

async function batchDownload() {
    if (!state.live?.allow_batch_download || !state.live.access_granted) {
        return;
    }

    const ids = Array.from(state.selectedPhotoIds);
    if (!ids.length) {
        showToast('先选择要打包的照片');
        return;
    }

    const job = await requestDownloadJob({ ids });
    openDownloadJobModal(job);
}

async function downloadPhotosByIds(ids, filename = `${slug}.zip`) {
    if (!ids.length || !state.live?.id) {
        return;
    }

    if (isMobileViewport()) {
        closeSheet('favorites');
    }
    const job = await requestDownloadJob({ ids, filename });
    openDownloadJobModal(job);
}

async function downloadAllPhotos() {
    if (!state.live?.allow_batch_download || !state.live?.access_granted) {
        return;
    }

    const job = await requestDownloadJob({});
    openDownloadJobModal(job);
}

async function requestDownloadJob({ ids = [], filename = '' }) {
    const payload = {};
    if (ids.length) {
        payload.ids = ids;
    } else if (state.album !== 'all') {
        payload.album_id = state.album;
    }
    if (filename) {
        payload.filename = filename;
    }

    const response = await api(`/photos/live/${state.live.id}/download-jobs`, {
        method: 'POST',
        body: JSON.stringify(payload)
    });
    return response.data;
}

function openDownloadJobModal(job) {
    if (isMobileViewport()) {
        handleMobileDownloadJob(job).catch((error) => {
            showToast(error.message || '压缩包准备失败');
        });
        return;
    }
    state.downloadJob = job;
    state.downloadJobMinimized = false;
    renderDownloadJobModal();
    elements.downloadJobModal.hidden = false;
    if (job?.status !== 'ready' && job?.id) {
        pollDownloadJob(job.id);
    }
}

async function handleMobileDownloadJob(job) {
    if (!job?.id) {
        throw new Error('压缩包任务创建失败');
    }

    showToast('正在准备压缩包，准备好后会自动复制下载地址到剪贴板。', {
        title: '批量下载',
        duration: 2400
    });

    let currentJob = job;
    const startedAt = Date.now();
    while (Date.now() - startedAt < 120000) {
        if (currentJob.status === 'ready' && currentJob.download_url) {
            const copied = await copyTextToClipboard(currentJob.download_url);
            showToast(
                copied
                    ? '压缩包地址已复制，请粘贴到手机系统浏览器打开并下载。'
                    : '压缩包已准备好，请复制地址到手机系统浏览器打开下载。',
                { title: '批量下载', duration: 3200 }
            );
            return;
        }

        if (currentJob.status === 'failed') {
            throw new Error(currentJob.error_message || '压缩包准备失败');
        }

        await new Promise((resolve) => window.setTimeout(resolve, 1800));
        const response = await api(`/photos/live/${state.live.id}/download-jobs/${job.id}`);
        currentJob = response.data;
    }

    throw new Error('压缩包准备超时，请稍后重试');
}

function closeDownloadJobModal() {
    state.downloadJobMinimized = true;
    renderDownloadJobModal();
}

function dismissDownloadJobModal() {
    window.clearTimeout(state.downloadJobPollTimer);
    state.downloadJobPollTimer = 0;
    state.downloadJob = null;
    state.downloadJobMinimized = false;
    renderDownloadJobModal();
}

function restoreDownloadJobModal() {
    state.downloadJobMinimized = false;
    renderDownloadJobModal();
}

function renderDownloadJobModal() {
    const job = state.downloadJob;
    if (!job) {
        elements.downloadJobModal.hidden = true;
        return;
    }

    elements.downloadJobModal.hidden = false;
    elements.downloadJobTitle.textContent = job.status === 'ready'
        ? '原图打包完成，可以下载了'
        : job.status === 'failed'
            ? '打包失败'
            : '正在准备原图打包任务';
    elements.downloadJobCopy.textContent = job.status === 'ready'
        ? `已准备好 ${job.selection_count || 0} 张原图的 ZIP 包，点击按钮直接下载。`
        : job.status === 'failed'
            ? (job.error_message || '云端打包失败，请稍后重试。')
            : `正在用七牛云端打包 ${job.selection_count || 0} 张原图，页面可以继续看图。`;
    elements.downloadJobEyebrow.textContent = isMobileViewport() ? '手机端提示' : '桌面端原图下载';
    elements.downloadJobStatusTag.textContent = job.status === 'ready' ? '原图就绪' : job.status === 'failed' ? '失败' : '打包中';
    elements.downloadJobStatusTag.className = `job-status-tag ${job.status === 'ready' ? 'ready' : job.status === 'failed' ? 'failed' : ''}`;
    elements.downloadJobLink.hidden = job.status !== 'ready' || !job.download_url;
    if (job.download_url) {
        elements.downloadJobLink.href = job.download_url;
        elements.downloadJobLink.textContent = '下载原图 ZIP';
    }
    elements.downloadJobProgressFill.style.width = `${job.status === 'ready' ? 100 : job.status === 'failed' ? 100 : job.status === 'processing' ? 66 : 28}%`;
    elements.jobStageQueued.classList.toggle('active', ['queued', 'processing', 'ready'].includes(job.status));
    elements.jobStageProcessing.classList.toggle('active', ['processing', 'ready'].includes(job.status));
    elements.jobStageReady.classList.toggle('active', job.status === 'ready');
    elements.downloadJobCard.hidden = state.downloadJobMinimized;
    elements.downloadJobRestoreButton.hidden = !state.downloadJobMinimized;
    elements.downloadJobRestoreButton.className = `job-widget-pill ${job.status === 'ready' ? 'ready' : job.status === 'failed' ? 'failed' : ''}`;
    elements.downloadJobRestoreText.textContent = job.status === 'ready'
        ? `原图已就绪，可下载 ${job.selection_count || 0} 张`
        : job.status === 'failed'
            ? '打包失败，点我查看'
            : `正在打包 ${job.selection_count || 0} 张原图`;
}

async function pollDownloadJob(jobId) {
    window.clearTimeout(state.downloadJobPollTimer);
    try {
        const response = await api(`/photos/live/${state.live.id}/download-jobs/${jobId}`);
        const previousStatus = state.downloadJob?.status;
        state.downloadJob = response.data;
        renderDownloadJobModal();
        if (response.data.status === 'ready' && previousStatus !== 'ready') {
            showToast('下载包已经准备好了');
        }
        if (response.data.status === 'ready' || response.data.status === 'failed') {
            return;
        }
    } catch (error) {
        state.downloadJob = {
            ...(state.downloadJob || {}),
            status: 'failed',
            error_message: error.message || '查询打包任务失败'
        };
        renderDownloadJobModal();
        return;
    }

    state.downloadJobPollTimer = window.setTimeout(() => {
        pollDownloadJob(jobId).catch(() => {});
    }, 1800);
}

function isFavorite(photoId) {
    return state.favorites.has(String(photoId));
}

function toggleFavorite(photoId) {
    const key = String(photoId);
    if (state.favorites.has(key)) {
        state.favorites.delete(key);
    } else {
        state.favorites.add(key);
    }
    persistFavorites();
}

function getFavoritePhotos() {
    return state.photos.filter((photo) => isFavorite(photo.id));
}

function renderFavoritesDrawer() {
    const favorites = getFavoritePhotos();
    elements.favoritesSummary.textContent = `本机收藏 · 共 ${favorites.length} 项`;
    elements.favoritesManageButton.textContent = state.favoritesManageMode ? '完成' : '管理';
    elements.favoritesClearButton.textContent = state.favoritesManageMode ? '移除已选' : '清空';
    elements.favoritesActions.classList.toggle('manage-mode', state.favoritesManageMode);
    elements.favoritesDropzone.hidden = !state.favoritesManageMode || !favorites.length;
    elements.favoritesDropzone.classList.remove('drag-over');
    elements.favoritesGrid.innerHTML = favorites.length ? favorites.map((photo) => `
        <button class="favorite-tile ${state.favoriteSelections.has(String(photo.id)) ? 'selected' : ''}" type="button" data-favorite-id="${photo.id}" draggable="${state.favoritesManageMode ? 'true' : 'false'}">
            <img src="${photo.thumbnail_url}" alt="${escapeHtml(photo.title || state.live.title)}">
            <span>${escapeHtml(photo.title || state.live.title)}</span>
        </button>
    `).join('') : '<p class="sheet-empty">还没有收藏照片</p>';
    if (elements.mobileFavoriteFloatCount) {
        elements.mobileFavoriteFloatCount.textContent = String(favorites.length);
    }
}

function renderSearchSheet() {
    if (!elements.searchSheet) {
        return;
    }

    if (elements.searchSheetInput) {
        elements.searchSheetInput.value = state.keyword;
    }
    if (elements.searchSheetHelper) {
        elements.searchSheetHelper.innerHTML = elements.searchHelper?.innerHTML || '';
    }
    if (elements.searchSheetFilters) {
        elements.searchSheetFilters.hidden = !hasSmartFilters();
    }
    if (elements.searchSheetFilterGroups) {
        elements.searchSheetFilterGroups.innerHTML = elements.smartFilterGroups?.innerHTML || '';
    }
}

function applyClientShell() {
    syncPerformanceMode();
    const mobile = isMobileViewport();
    if (!mobile && isDesktopSafari && state.viewMode !== 'grid') {
        state.viewMode = 'grid';
    }
    document.body.classList.toggle('mobile-shell', mobile);
    document.body.classList.toggle('desktop-shell', !mobile);
    elements.desktopRail.hidden = mobile;
    if (mobile && state.selectionMode) {
        state.selectionMode = false;
        state.selectedPhotoIds.clear();
    }
    if (state.live) {
        renderLive();
        renderPhotos();
    }
    scheduleMobileFavoriteFloat();
    relocateDesktopActions(mobile);
    if (isMobileSafari) {
        updateSafariMobileFloatingUI();
    }
}

function syncPerformanceMode() {
    if (isMobileViewport()) {
        state.renderChunkSize = 12;
        state.fetchLimit = 12;
        return;
    }

    state.renderChunkSize = window.innerWidth >= 1440 ? 20 : 18;
    state.fetchLimit = window.innerWidth >= 1440 ? 20 : 18;
}

function syncLiveSocket() {
    const shouldConnect = Boolean(
        state.live?.id &&
        state.live?.access_granted &&
        state.live?.status === 'live'
    );

    if (shouldConnect) {
        if (!socket.connected) {
            socket.connect();
        }
        socket.emit('join-live', state.live.id);
        return;
    }

    if (socket.connected) {
        socket.disconnect();
    }
}

function scheduleLiveVersionPolling() {
    window.clearTimeout(state.liveVersionPollTimer);
    if (!state.live?.id) {
        return;
    }

    const delay = document.visibilityState === 'hidden'
        ? 30000
        : state.live.status === 'live'
            ? 5000
            : 60000;

    state.liveVersionPollTimer = window.setTimeout(async () => {
        try {
            const response = await api(`/lives/slug/${slug}/version`);
            const nextVersion = response.data?.content_version || '';
            if (nextVersion && nextVersion !== state.contentVersion) {
                state.contentVersion = nextVersion;
                await loadLive(false);
                return;
            }
        } catch (_error) {
        }
        scheduleLiveVersionPolling();
    }, delay);
}

function readLiveCache() {
    try {
        return JSON.parse(localStorage.getItem(liveCacheStorageKey) || 'null');
    } catch (_error) {
        return null;
    }
}

function persistLiveCache() {
    if (!state.live?.id || !state.live?.access_granted) {
        return;
    }

    if (state.album !== 'all' || state.keyword || state.sort !== 'latest' || Object.values(state.filters).some(Boolean)) {
        return;
    }

    try {
        localStorage.setItem(liveCacheStorageKey, JSON.stringify({
            version: state.contentVersion,
            live: state.live,
            filterOptions: state.filterOptions,
            photos: state.photos,
            page: state.page,
            pages: state.pages,
            autoHeroImage: state.autoHeroImage
        }));
    } catch (_error) {
    }
}

function relocateDesktopActions(mobile = isMobileViewport()) {
    if (mobile) {
        if (elements.downloadAllButton.parentElement !== elements.heroButtonsMain) {
            elements.heroButtonsMain.appendChild(elements.downloadAllButton);
        }
        if (elements.toggleSelectButton.parentElement !== elements.heroButtonsSub) {
            elements.heroButtonsSub.appendChild(elements.toggleSelectButton);
        }
        if (elements.desktopHintButton.parentElement !== elements.heroButtonsSub) {
            elements.heroButtonsSub.appendChild(elements.desktopHintButton);
        }
        return;
    }

    [elements.toggleSelectButton, elements.downloadAllButton, elements.desktopHintButton].forEach((button) => {
        if (button.parentElement !== elements.desktopGalleryActions) {
            elements.desktopGalleryActions.appendChild(button);
        }
    });
}

function renderSelectionBar() {
    const visible = state.selectionMode && !isMobileViewport() && Number(state.live?.allow_batch_download) === 1;
    const selectedSizeText = formatBytes(getSelectedOriginalBytes());
    elements.selectionBar.hidden = !visible;
    document.body.classList.toggle('selection-mode-active', visible);
    elements.selectionCountText.textContent = `已选择 ${state.selectedPhotoIds.size} 张照片`;
    elements.selectionHintText.textContent = state.selectedPhotoIds.size
        ? `预计原图大小约 ${selectedSizeText}，准备好后可直接下载原图压缩包。`
        : '点击照片卡片即可勾选，准备好后再批量下载所选原图。';
    elements.toggleSelectButton.textContent = visible ? '退出批量' : '批量选择';
    elements.batchDownloadButton.disabled = state.selectedPhotoIds.size === 0;
    elements.batchDownloadButton.textContent = state.selectedPhotoIds.size
        ? `打包已选原图 (${state.selectedPhotoIds.size} · ${selectedSizeText})`
        : '批量下载所选';
    elements.selectionBar.classList.toggle('selection-bar-active', visible && state.selectedPhotoIds.size > 0);
}

function toggleSelectionMode() {
    if (isMobileViewport()) {
        showToast('手机端不推荐批量下载原图，建议收藏后长按保存');
        return;
    }
    state.selectionMode = !state.selectionMode;
    if (!state.selectionMode) {
        state.selectedPhotoIds.clear();
    }
    applyViewMode();
    renderToolbarTabs();
    renderSelectionBar();
    renderPhotos();
}

function togglePhotoSelection(photoId) {
    const key = String(photoId);
    if (state.selectedPhotoIds.has(key)) {
        state.selectedPhotoIds.delete(key);
    } else {
        state.selectedPhotoIds.add(key);
    }
    renderSelectionBar();
    updatePhotoCardSelectionState(key);
}

function updatePhotoCardSelectionState(photoId) {
    const card = elements.photoGrid.querySelector(`[data-photo-id="${CSS.escape(String(photoId))}"]`);
    if (!card) {
        return;
    }
    const selected = state.selectedPhotoIds.has(String(photoId));
    card.classList.toggle('selected', selected);
    const check = card.querySelector('.photo-card-check span');
    if (check) {
        check.textContent = selected ? '✓' : '';
    }
}

function getSelectedOriginalBytes() {
    if (!state.selectedPhotoIds.size) {
        return 0;
    }
    return state.photos.reduce((total, photo) => {
        if (!state.selectedPhotoIds.has(String(photo.id))) {
            return total;
        }
        return total + Number(photo.file_size || 0);
    }, 0);
}

function openSheet(name) {
    if (name === 'favorites') {
        renderFavoritesDrawer();
        elements.mobileFavoriteFloat.classList.remove('show');
        elements.favoritesDrawer.hidden = false;
        return;
    }

    if (name === 'search') {
        renderSearchSheet();
        elements.searchSheet.hidden = false;
    }
}

function closeSheet(name) {
    if (name === 'favorites') {
        elements.favoritesDrawer.hidden = true;
        scheduleMobileFavoriteFloat();
        return;
    }

    if (name === 'search') {
        elements.searchSheet.hidden = true;
    }
}

function printCurrentPhoto() {
    const photo = state.photos[state.currentIndex];
    if (!photo) {
        return;
    }
    const printable = window.open('', '_blank', 'width=1000,height=800');
    if (!printable) {
        showToast('浏览器拦截了打印窗口');
        return;
    }
    printable.document.write(`
        <html>
        <head><title>打印照片</title><style>body{margin:0;display:grid;place-items:center;background:#111}img{max-width:100vw;max-height:100vh;object-fit:contain}</style></head>
        <body><img src="${buildViewerImageSrc(photo) || buildInitialPreviewSrc(photo)}" alt=""></body>
        </html>
    `);
    printable.document.close();
    printable.focus();
    printable.print();
}

async function downloadCurrentOriginal(event) {
    event.preventDefault();
    const photo = state.photos[state.currentIndex];
    if (!photo?.original_url) {
        showToast('当前没有可下载的原图');
        return;
    }

    elements.downloadButton.classList.add('active');
    try {
        api(`/analytics/photos/${photo.id}/download`, {
            method: 'POST'
        }).catch(() => {});
        const link = document.createElement('a');
        link.href = buildDownloadHref(photo);
        link.download = buildOriginalFileName(photo);
        link.rel = 'noreferrer';
        document.body.appendChild(link);
        link.click();
        link.remove();
        showToast('原图下载已开始');
    } catch (error) {
        showToast(error.message || '原图下载失败');
    } finally {
        elements.downloadButton.classList.remove('active');
    }
}

async function ensureViewerSession() {
    if (!state.live?.id || state.viewerSessionId || state.viewerSessionEnded) {
        return;
    }

    const response = await api(`/analytics/live/${state.live.id}/session-start`, {
        method: 'POST',
        body: JSON.stringify({
            entry_path: window.location.pathname
        })
    });
    state.viewerSessionId = Number(response.data?.session_id || 0);
    state.viewerSessionStartedAt = Date.now();
    state.viewerSessionEnded = false;
    sessionStorage.setItem(`photo_live_session_${slug}`, String(state.viewerSessionId || ''));
    sessionStorage.setItem(`photo_live_session_started_${slug}`, String(state.viewerSessionStartedAt || ''));
}

function endViewerSession() {
    if (!state.viewerSessionId || state.viewerSessionEnded) {
        return;
    }

    state.viewerSessionEnded = true;
    const durationSeconds = state.viewerSessionStartedAt
        ? Math.max(1, Math.round((Date.now() - state.viewerSessionStartedAt) / 1000))
        : 0;
    const payload = {
        exit_path: window.location.pathname,
        last_photo_id: state.photos[state.currentIndex]?.id || null,
        duration_seconds: durationSeconds
    };

    const url = `/api/analytics/sessions/${state.viewerSessionId}/end`;
    try {
        if (navigator.sendBeacon) {
            const body = new Blob([JSON.stringify(payload)], { type: 'application/json' });
            navigator.sendBeacon(url, body);
        } else {
            fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(state.accessToken ? { 'x-live-access': state.accessToken } : {})
                },
                body: JSON.stringify(payload),
                keepalive: true
            }).catch(() => {});
        }
    } catch (_error) {}

    sessionStorage.removeItem(`photo_live_session_${slug}`);
    sessionStorage.removeItem(`photo_live_session_started_${slug}`);
}

function startAutoplay(mode) {
    if (state.photos.length <= 1) {
        showToast('至少需要两张照片才能播放');
        return;
    }
    state.autoplayMode = mode;
    window.clearInterval(stopAutoplay.timer);
    showToast(mode === 'shuffle' ? '已开始随机播放' : '已开始顺序播放');
    elements.autoplayButton.textContent = mode === 'forward' ? '播放中' : '顺序播放';
    elements.shuffleButton.textContent = mode === 'shuffle' ? '随机中' : '随机播放';
    stopAutoplay.timer = window.setInterval(() => {
        if (elements.lightbox.hidden) {
            stopAutoplay();
            return;
        }
        if (mode === 'shuffle') {
            let next = Math.floor(Math.random() * state.photos.length);
            if (next === state.currentIndex) {
                next = (state.currentIndex + 1) % state.photos.length;
            }
            openLightbox(next);
            return;
        }
        moveLightbox(state.currentIndex >= state.photos.length - 1 ? -state.currentIndex : 1);
    }, 3200);
    elements.autoplayButton.classList.toggle('active', mode === 'forward');
    elements.shuffleButton.classList.toggle('active', mode === 'shuffle');
}

function stopAutoplay() {
    window.clearInterval(stopAutoplay.timer);
    state.autoplayMode = 'off';
    elements.autoplayButton.classList.remove('active');
    elements.shuffleButton.classList.remove('active');
    elements.autoplayButton.textContent = '顺序播放';
    elements.shuffleButton.textContent = '随机播放';
}

function toggleAutoplay(mode) {
    if (state.autoplayMode === mode) {
        stopAutoplay();
        return;
    }
    stopAutoplay();
    startAutoplay(mode);
}

function isMobileViewport() {
    return window.innerWidth <= 640;
}

function bindEvents() {
    renderToolbarTabs();
    elements.openingSkipButton?.addEventListener('click', () => {
        hideOpeningSplash();
    });

    elements.accessForm.addEventListener('submit', (event) => {
        verifyAccess(event).catch((error) => {
            elements.accessHint.textContent = error.message || '访问验证失败';
        });
    });

    elements.albumStrip.addEventListener('click', async (event) => {
        const button = event.target.closest('button[data-album]');
        if (!button) {
            return;
        }
        state.album = button.dataset.album;
        resetSmartFilters();
        await loadFilterOptions();
        await loadPhotos(true);
        renderLive();
    });

    elements.featureStrip.addEventListener('click', (event) => {
        const actionElement = event.target.closest('[data-action]');
        if (!actionElement) {
            return;
        }

        if (actionElement.dataset.action === 'toggle-music') {
            toggleMusic().catch(() => {});
        }
    });

    elements.toolbarTabs.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-tab]');
        if (!button) {
            return;
        }

        const { tab } = button.dataset;
        state.searchOpen = false;
        state.sort = tab === 'popular' ? 'popular' : 'latest';
        renderToolbarTabs();
        loadPhotos(true);
    });

    elements.searchToggleButton.addEventListener('click', () => {
        if (isMobileViewport()) {
            openSheet('search');
            return;
        }
        state.searchOpen = !state.searchOpen;
        renderToolbarTabs();
        if (state.searchOpen) {
            elements.searchInput.focus();
        }
    });

    elements.smartFilterToggleButton?.addEventListener('click', () => {
        if (isMobileViewport()) {
            openSheet('search');
            return;
        }
        state.smartFiltersOpen = !state.smartFiltersOpen;
        renderToolbarTabs();
    });

    let searchTimer;
    elements.searchInput.addEventListener('input', () => {
        window.clearTimeout(searchTimer);
        searchTimer = window.setTimeout(() => {
            state.keyword = elements.searchInput.value.trim();
            loadPhotos(true);
        }, 250);
    });

    elements.searchHelper?.addEventListener('click', (event) => {
        const chip = event.target.closest('[data-search-example]');
        if (!chip) {
            return;
        }
        applySearchKeyword(chip.dataset.searchExample || '');
        loadPhotos(true);
    });

    elements.searchSheetHelper?.addEventListener('click', (event) => {
        const chip = event.target.closest('[data-search-example]');
        if (!chip) {
            return;
        }
        applySearchKeyword(chip.dataset.searchExample || '');
        loadPhotos(true);
    });

    elements.smartFilterGroups?.addEventListener('click', (event) => {
        const chip = event.target.closest('[data-filter-key][data-filter-value]');
        if (!chip) {
            return;
        }

        const key = chip.dataset.filterKey;
        const value = chip.dataset.filterValue;
        if (!key) {
            return;
        }

        state.filters[key] = state.filters[key] === value ? '' : value;
        renderSmartFilters();
        loadPhotos(true);
    });

    elements.clearSmartFiltersButton?.addEventListener('click', () => {
        resetSmartFilters();
        renderSmartFilters();
        loadPhotos(true);
    });

    elements.searchSheetFilterGroups?.addEventListener('click', (event) => {
        const chip = event.target.closest('[data-filter-key][data-filter-value]');
        if (!chip) {
            return;
        }

        const key = chip.dataset.filterKey;
        const value = chip.dataset.filterValue;
        if (!key) {
            return;
        }

        state.filters[key] = state.filters[key] === value ? '' : value;
        renderSmartFilters();
        loadPhotos(true);
    });

    elements.clearSearchSheetFiltersButton?.addEventListener('click', () => {
        resetSmartFilters();
        renderSmartFilters();
        loadPhotos(true);
    });

    elements.searchSheetCloseButton?.addEventListener('click', () => closeSheet('search'));
    elements.searchSheetClearButton?.addEventListener('click', () => {
        applySearchKeyword('');
        resetSmartFilters();
        renderSmartFilters();
        loadPhotos(true);
    });

    let mobileSearchTimer;
    elements.searchSheetInput?.addEventListener('input', () => {
        window.clearTimeout(mobileSearchTimer);
        mobileSearchTimer = window.setTimeout(() => {
            applySearchKeyword(elements.searchSheetInput.value.trim());
            loadPhotos(true);
        }, 220);
    });

    elements.sortSelect.addEventListener('change', () => {
        state.sort = elements.sortSelect.value;
        state.searchOpen = true;
        renderToolbarTabs();
        loadPhotos(true);
    });

    elements.loading.addEventListener('click', () => {
        if (!isMobileViewport()) {
            return;
        }
        if (isMobileSafari) {
            window.scrollTo(0, 0);
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });

    elements.photoGrid.addEventListener('click', (event) => {
        const favoriteToggle = event.target.closest('[data-favorite-toggle]');
        if (favoriteToggle) {
            event.stopPropagation();
            toggleFavorite(favoriteToggle.dataset.favoriteToggle);
            showToast(isFavorite(favoriteToggle.dataset.favoriteToggle) ? '已加入收藏' : '已取消收藏');
            return;
        }
        const card = event.target.closest('[data-index]');
        if (!card) {
            return;
        }
        if (state.selectionMode && !isMobileViewport()) {
            togglePhotoSelection(card.dataset.photoId);
            return;
        }
        openPhotoWithFlash(Number(card.dataset.index));
    });

    elements.mobilePopularHero?.addEventListener('click', (event) => {
        const trigger = event.target.closest('[data-mobile-popular-open]');
        if (!trigger) {
            return;
        }
        openPhotoWithFlash(0);
    });

    elements.lightboxThumbStrip.addEventListener('click', (event) => {
        const button = event.target.closest('[data-thumb-index]');
        if (!button) {
            return;
        }
        openLightbox(Number(button.dataset.thumbIndex));
    });

    elements.lightboxImageShell.addEventListener('dblclick', () => {
        if (isMobileViewport()) {
            return;
        }
        expandCurrentPreview();
    });

    elements.lightboxImageShell.addEventListener('touchstart', (event) => {
        state.touchStartX = event.changedTouches[0]?.clientX || 0;
    }, { passive: true });

    elements.lightboxImageShell.addEventListener('touchend', (event) => {
        const endX = event.changedTouches[0]?.clientX || 0;
        const delta = endX - state.touchStartX;
        if (Math.abs(delta) < 44) {
            return;
        }
        moveLightbox(delta < 0 ? 1 : -1);
    }, { passive: true });

    elements.shareButton.addEventListener('click', async () => {
        const url = state.live?.slug
            ? `${window.location.origin}/live/${encodeURIComponent(state.live.slug)}`
            : window.location.href;
        const copied = await copyTextToClipboard(url);
        showToast(copied ? '客户链接已复制' : '链接已选中，请手动复制', {
            title: '分享链接'
        });
        elements.shareButton.hidden = true;
        elements.wechatTip.hidden = true;
    });

    elements.enterGalleryButton.addEventListener('click', () => {
        const toolbar = document.getElementById('galleryToolbar');
        if (!toolbar) {
            return;
        }
        if (isMobileSafari) {
            const offset = Math.max(0, toolbar.getBoundingClientRect().top + window.scrollY - 8);
            window.scrollTo(0, offset);
        } else {
            toolbar.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });

    elements.batchDownloadButton.addEventListener('click', () => {
        batchDownload().catch((error) => showToast(error.message));
    });
    elements.downloadAllButton.addEventListener('click', () => {
        downloadAllPhotos().catch((error) => showToast(error.message));
    });
    elements.toggleSelectButton.addEventListener('click', () => toggleSelectionMode());
    elements.selectionClearButton.addEventListener('click', () => {
        state.selectedPhotoIds.clear();
        renderSelectionBar();
        renderPhotos();
    });
    elements.selectionCancelButton.addEventListener('click', () => toggleSelectionMode());
    elements.desktopHintButton.addEventListener('click', () => {
        showToast(isMobileViewport()
            ? '左右滑动切图，点底部按钮加载原图后长按保存'
            : '电脑端可先点批量选择，再把勾选照片交给七牛云端打包');
    });
    elements.downloadJobCloseButton.addEventListener('click', () => closeDownloadJobModal());
    elements.downloadJobDismissButton.addEventListener('click', () => dismissDownloadJobModal());
    elements.downloadJobRestoreButton.addEventListener('click', () => restoreDownloadJobModal());

    elements.dismissWechatTip.addEventListener('click', () => {
        elements.wechatTip.hidden = true;
    });

    elements.lightbox.addEventListener('click', (event) => {
        if (event.target.dataset.close) {
            closeLightbox();
        }
    });

    elements.likeButton.addEventListener('click', () => likeCurrentPhoto().catch((error) => showToast(error.message)));
    elements.favoriteButton.addEventListener('click', () => {
        const photo = state.photos[state.currentIndex];
        if (!photo) {
            return;
        }
        toggleFavorite(photo.id);
        showToast(isFavorite(photo.id) ? '已加入收藏' : '已取消收藏');
    });
    elements.favoriteBadge.addEventListener('click', () => openSheet('favorites'));
    elements.favoriteEntryButton.addEventListener('click', () => openSheet('favorites'));
    elements.mobileFavoriteFloat.addEventListener('click', () => openSheet('favorites'));
    elements.copyPhotoLinkButton.addEventListener('click', () => {
        copyCurrentPhotoLink().catch((error) => showToast(error.message));
    });
    elements.mobileCopyLinkButton.addEventListener('click', () => {
        copyCurrentPhotoLink().catch((error) => showToast(error.message));
    });
    elements.downloadButton.addEventListener('click', (event) => {
        downloadCurrentOriginal(event).catch((error) => showToast(error.message));
    });
    elements.mobileSharpButton.addEventListener('click', () => {
        const photo = state.photos[state.currentIndex];
        if (!photo) {
            return;
        }
        if (!state.previewExpanded) {
            expandCurrentPreview();
            return;
        }
        if (!state.originalLoaded) {
            loadOriginalPreview(photo);
            return;
        }
    });
    elements.prevButton.addEventListener('click', () => moveLightbox(-1));
    elements.nextButton.addEventListener('click', () => moveLightbox(1));
    elements.photoProgress.addEventListener('input', () => {
        openLightbox(Number(elements.photoProgress.value) - 1);
    });
    elements.toggleInfoButton.addEventListener('click', () => {
        state.infoOpen = !state.infoOpen;
        const current = state.photos[state.currentIndex];
        if (current) {
            renderLightboxPhoto(current);
        }
    });
    elements.desktopInfoButton.addEventListener('click', () => {
        state.infoOpen = !state.infoOpen;
        const current = state.photos[state.currentIndex];
        if (current) {
            renderLightboxPhoto(current);
        }
    });
    elements.desktopFavoritesButton.addEventListener('click', () => openSheet('favorites'));
    elements.printButton.addEventListener('click', () => printCurrentPhoto());
    elements.autoplayButton.addEventListener('click', () => toggleAutoplay('forward'));
    elements.shuffleButton.addEventListener('click', () => toggleAutoplay('shuffle'));

    elements.favoritesManageButton.addEventListener('click', () => {
        state.favoritesManageMode = !state.favoritesManageMode;
        if (!state.favoritesManageMode) {
            state.favoriteSelections.clear();
        }
        renderFavoritesDrawer();
    });
    elements.favoritesClearButton.addEventListener('click', () => {
        clearFavorites().catch((error) => showToast(error.message));
    });
    elements.favoritesGrid.addEventListener('click', (event) => {
        const tile = event.target.closest('[data-favorite-id]');
        if (!tile) {
            return;
        }
        const id = String(tile.dataset.favoriteId);
        if (state.favoritesManageMode) {
            if (state.favoriteSelections.has(id)) {
                state.favoriteSelections.delete(id);
            } else {
                state.favoriteSelections.add(id);
            }
            renderFavoritesDrawer();
            return;
        }
        const index = state.photos.findIndex((photo) => String(photo.id) === id);
        if (index >= 0) {
            closeSheet('favorites');
            openPhotoWithFlash(index);
        }
    });
    elements.favoritesGrid.addEventListener('dragstart', (event) => {
        const tile = event.target.closest('[data-favorite-id]');
        if (!tile || !state.favoritesManageMode) {
            return;
        }
        event.dataTransfer?.setData('text/plain', tile.dataset.favoriteId || '');
        event.dataTransfer.effectAllowed = 'move';
    });
    elements.favoritesDropzone?.addEventListener('dragover', (event) => {
        event.preventDefault();
        elements.favoritesDropzone.classList.add('drag-over');
    });
    elements.favoritesDropzone?.addEventListener('dragleave', () => {
        elements.favoritesDropzone.classList.remove('drag-over');
    });
    elements.favoritesDropzone?.addEventListener('drop', (event) => {
        event.preventDefault();
        elements.favoritesDropzone.classList.remove('drag-over');
        const id = event.dataTransfer?.getData('text/plain');
        if (id) {
            removeFavoriteById(id);
        }
    });
    elements.favoritesBackButton.addEventListener('click', () => closeSheet('favorites'));
    elements.favoritesSelectAllButton.addEventListener('click', () => {
        const favorites = getFavoritePhotos().map((photo) => String(photo.id));
        if (state.favoriteSelections.size === favorites.length) {
            state.favoriteSelections.clear();
        } else {
            state.favoriteSelections = new Set(favorites);
        }
        renderFavoritesDrawer();
    });
    elements.favoritesDownloadButton.addEventListener('click', () => {
        const ids = Array.from(state.favoriteSelections.size ? state.favoriteSelections : new Set(getFavoritePhotos().map((photo) => String(photo.id))));
        downloadPhotosByIds(ids, `${slug}-favorites.zip`).catch((error) => showToast(error.message));
    });

    document.querySelectorAll('[data-close-sheet]').forEach((element) => {
        element.addEventListener('click', () => {
            closeSheet(element.dataset.closeSheet);
        });
    });
    window.addEventListener('keydown', (event) => {
        if (elements.lightbox.hidden) {
            return;
        }
        if (event.key === 'Escape') {
            closeLightbox();
        }
        if (event.key === 'ArrowLeft') {
            moveLightbox(-1);
        }
        if (event.key === 'ArrowRight') {
            moveLightbox(1);
        }
    });

    window.addEventListener('resize', () => {
        renderToolbarTabs();
        applyClientShell();
        queueScrollUiRefresh();
    });

    window.addEventListener('scroll', () => {
        queueScrollUiRefresh();
    }, { passive: true });
    window.addEventListener('pagehide', endViewerSession);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            endViewerSession();
        }
        scheduleLiveVersionPolling();
    });
}

function queueScrollUiRefresh() {
    if (state.scrollUiRaf) {
        return;
    }

    state.scrollUiRaf = window.requestAnimationFrame(() => {
        state.scrollUiRaf = 0;
        if (isMobileSafari) {
            updateSafariMobileFloatingUI();
            return;
        }
        updateFeedLoadingState();
        scheduleMobileFeedTopToggle();
        scheduleMobileFavoriteFloat();
    });
}

async function api(path, options = {}) {
    const response = await fetch(`/api${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(state.accessToken ? { 'x-live-access': state.accessToken } : {}),
            ...(options.headers || {})
        }
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || '请求失败');
    }
    return data;
}

function syncMusic() {
    if (!state.live?.background_music) {
        elements.bgMusic.pause();
        elements.bgMusic.removeAttribute('src');
        return;
    }

    if (elements.bgMusic.src !== state.live.background_music) {
        elements.bgMusic.src = state.live.background_music;
    }
}

function setLiveLoading(active) {
    state.loadingLive = active;
    document.body.classList.toggle('live-loading', active);
}

function renderToolbarTabs() {
    const activeTab = state.sort === 'popular' ? 'popular' : 'latest';
    elements.toolbarTabs.querySelectorAll('button').forEach((button) => {
        button.classList.toggle('active', button.dataset.tab === activeTab);
    });
    elements.toolbarActions.hidden = !state.searchOpen && window.innerWidth < 821;
    elements.sortSelect.value = state.sort;
    elements.searchToggleButton.classList.toggle('active', state.searchOpen);
    elements.smartFilterToggleButton?.classList.toggle('active', state.smartFiltersOpen);
    if (elements.searchHelper) {
        elements.searchHelper.hidden = !state.searchOpen;
    }
    if (elements.smartFilters) {
        elements.smartFilters.hidden = !state.smartFiltersOpen || !hasSmartFilters();
    }
    if (elements.viewToggleButton) {
        elements.viewToggleButton.hidden = isDesktopSafari && !isMobileViewport();
    }
}

function hasSmartFilters() {
    if (!state.filterOptions) {
        return false;
    }

    return [
        state.filterOptions.cameras,
        state.filterOptions.lenses,
        state.filterOptions.focal_lengths,
        state.filterOptions.apertures,
        state.filterOptions.iso_values,
        state.filterOptions.formats
    ].some((items) => Array.isArray(items) && items.length > 0);
}

function renderSearchHelper() {
    if (!elements.searchHelper) {
        return;
    }

    const examples = buildSearchExamples();
    elements.searchHelper.innerHTML = `
        <span class="search-helper-label">示例：</span>
        ${examples.map((value) => `
            <button class="search-chip" type="button" data-search-example="${escapeHtml(value)}">${escapeHtml(value)}</button>
        `).join('')}
    `;
    if (elements.searchSheetHelper && !elements.searchSheet.hidden) {
        elements.searchSheetHelper.innerHTML = elements.searchHelper.innerHTML;
    }
}

function buildSearchExamples() {
    const fallback = ['SONY', '24-70', 'ISO 800', 'JPEG', '主会场'];
    if (!state.filterOptions) {
        return fallback;
    }

    const candidates = [
        state.filterOptions.cameras?.[0]?.label,
        state.filterOptions.lenses?.[0]?.label,
        state.filterOptions.iso_values?.[0]?.label,
        state.filterOptions.formats?.[0]?.label,
        state.filterOptions.albums?.[0]?.label
    ].filter(Boolean);

    return Array.from(new Set([...candidates, ...fallback])).slice(0, 5);
}

function renderSmartFilters() {
    if (!elements.smartFilters || !elements.smartFilterGroups) {
        return;
    }

    const groups = [
        { key: 'camera', label: '机身', items: state.filterOptions?.cameras || [] },
        { key: 'lens', label: '镜头', items: state.filterOptions?.lenses || [] },
        { key: 'focal_length', label: '焦段', items: state.filterOptions?.focal_lengths || [] },
        { key: 'aperture', label: '光圈', items: state.filterOptions?.apertures || [] },
        { key: 'iso', label: 'ISO', items: state.filterOptions?.iso_values || [] },
        { key: 'format', label: '格式', items: state.filterOptions?.formats || [] }
    ].filter((group) => group.items.length);

    if (!groups.length) {
        elements.smartFilterGroups.innerHTML = '';
        elements.smartFilters.hidden = true;
        return;
    }

    elements.smartFilterGroups.innerHTML = groups.map((group) => `
        <section class="smart-filter-group">
            <span class="smart-filter-label">${escapeHtml(group.label)}</span>
            <div class="smart-filter-chips">
                ${group.items.map((item) => `
                    <button
                        type="button"
                        class="smart-filter-chip ${String(state.filters[group.key]) === String(item.value) ? 'active' : ''}"
                        data-filter-key="${group.key}"
                        data-filter-value="${escapeHtml(String(item.value))}"
                    >
                        ${escapeHtml(String(item.label))}
                        <small>${item.count}</small>
                    </button>
                `).join('')}
            </div>
        </section>
    `).join('');
    elements.smartFilters.hidden = !state.smartFiltersOpen;
    if (elements.searchSheetFilterGroups) {
        elements.searchSheetFilterGroups.innerHTML = elements.smartFilterGroups.innerHTML;
    }
    if (elements.searchSheetFilters) {
        elements.searchSheetFilters.hidden = !groups.length;
    }
}

function resetSmartFilters() {
    Object.keys(state.filters).forEach((key) => {
        state.filters[key] = '';
    });
}

function applySearchKeyword(value) {
    state.keyword = String(value || '').trim();
    if (elements.searchInput) {
        elements.searchInput.value = state.keyword;
    }
    if (elements.searchSheetInput) {
        elements.searchSheetInput.value = state.keyword;
    }
}

function syncHeroBackdrop() {
    const heroEnabled = Number(state.live?.show_banner ?? 1) === 1;
    const heroImage = heroEnabled ? (state.live?.banner_image
        || state.live?.cover_image
        || state.autoHeroImage
        || (() => {
            const photo = state.photos.find((item) => item.original_url || item.compressed_url || item.thumbnail_url);
            return photo ? buildAdaptivePhotoSrc(photo, 'hero') : '';
        })()
        || '') : '';

    if (heroImage) {
        elements.heroBackdrop.style.background = `
            linear-gradient(180deg, rgba(18, 20, 28, 0.06), rgba(18, 20, 28, 0.16)),
            radial-gradient(circle at top right, rgba(255, 255, 255, 0.12), transparent 28%),
            url("${heroImage}") center/cover
        `;
        return;
    }

    elements.heroBackdrop.style.background = `
        radial-gradient(circle at top right, rgba(255, 255, 255, 0.12), transparent 24%),
        linear-gradient(135deg, #d11f31, #99121d)
    `;
}

function maybeShowOpeningSplash() {
    if (!state.live?.access_granted) {
        hideOpeningSplash(true);
        return;
    }

    const openingEnabled = Number(state.live?.show_opening ?? 0) === 1;
    const openingImage = state.live?.opening_image || '';
    if (!openingEnabled || !openingImage) {
        hideOpeningSplash(true);
        return;
    }

    const openingShownKey = `photo_live_opening_${slug}_${state.contentVersion || openingImage}`;
    if (sessionStorage.getItem(openingShownKey)) {
        hideOpeningSplash(true);
        return;
    }

    state.openingCountdown = Math.min(Math.max(Number(state.live?.opening_duration || 3), 1), 9);
    state.openingVisible = true;
    sessionStorage.setItem(openingShownKey, '1');
    if (elements.openingImage) {
        elements.openingImage.src = openingImage;
    }
    elements.openingScreen.hidden = false;
    document.body.classList.add('opening-active');
    lockPageScroll();
    updateOpeningCountdownUi();
    window.clearInterval(state.openingTimer);
    state.openingTimer = window.setInterval(() => {
        state.openingCountdown -= 1;
        if (state.openingCountdown <= 0) {
            hideOpeningSplash();
            return;
        }
        updateOpeningCountdownUi();
    }, 1000);
}

function updateOpeningCountdownUi() {
    if (!elements.openingSkipButton) {
        return;
    }
    elements.openingSkipButton.textContent = `${state.openingCountdown}s 跳过`;
}

function hideOpeningSplash(immediate = false) {
    state.openingVisible = false;
    window.clearInterval(state.openingTimer);
    if (!elements.openingScreen || elements.openingScreen.hidden) {
        return;
    }
    if (immediate) {
        elements.openingScreen.hidden = true;
        elements.openingScreen.classList.remove('is-leaving');
        document.body.classList.remove('opening-active');
        document.body.classList.remove('pre-opening');
        unlockPageScroll();
        return;
    }
    elements.openingScreen.classList.add('is-leaving');
    window.setTimeout(() => {
        elements.openingScreen.hidden = true;
        elements.openingScreen.classList.remove('is-leaving');
        document.body.classList.remove('opening-active');
        document.body.classList.remove('pre-opening');
        unlockPageScroll();
    }, 420);
}

function pickAutoHeroImage(photos) {
    const items = Array.isArray(photos) ? photos.filter(Boolean) : [];
    if (!items.length) {
        return '';
    }

    const pool = items.slice(0, Math.min(items.length, 24));
    const seed = Math.abs(hashString(`${slug}-${state.live?.id || ''}-${pool.length}`));
    const selected = pool[seed % pool.length];
    return selected ? buildAdaptivePhotoSrc(selected, 'hero') : '';
}

function maybeShowWechatTip() {
    if (!isWeChat || !state.live?.access_granted || Number(state.live.enable_share) !== 1) {
        return;
    }

    const tipKey = `photo_live_wechat_tip_${slug}`;
    if (sessionStorage.getItem(tipKey)) {
        return;
    }

    elements.wechatTip.hidden = false;
    sessionStorage.setItem(tipKey, '1');
    window.setTimeout(() => {
        elements.wechatTip.hidden = true;
    }, 3600);
}

function applyViewMode() {
    const effectiveViewMode = (state.selectionMode && !isMobileViewport()) || (!isMobileViewport() && isDesktopSafari)
        ? 'grid'
        : state.viewMode;
    elements.photoGrid.classList.toggle('grid-mode', effectiveViewMode === 'grid');
    elements.photoGrid.classList.toggle('waterfall-mode', effectiveViewMode !== 'grid');
}

async function clearFavorites() {
    const favorites = getFavoritePhotos();
    if (!favorites.length) {
        showToast('当前没有收藏照片');
        return;
    }

    if (state.favoritesManageMode && state.favoriteSelections.size) {
        Array.from(state.favoriteSelections).forEach((id) => state.favorites.delete(String(id)));
        state.favoriteSelections.clear();
        persistFavorites();
        showToast('已移除选中的收藏');
        return;
    }

    if (!window.confirm('确定清空当前相册的所有本机收藏吗？')) {
        return;
    }

    state.favorites.clear();
    state.favoriteSelections.clear();
    persistFavorites();
    showToast('收藏已全部清空');
}

function removeFavoriteById(photoId) {
    const key = String(photoId);
    if (!state.favorites.has(key)) {
        return;
    }
    state.favorites.delete(key);
    state.favoriteSelections.delete(key);
    persistFavorites();
    showToast('已移出收藏');
}

function persistFavorites() {
    localStorage.setItem(favoritesStorageKey, JSON.stringify(Array.from(state.favorites)));
    renderPhotos();
    renderFavoritesDrawer();
    if (state.live) {
        elements.favoriteEntryButton.textContent = `收藏夹 ${state.favorites.size}`;
    }
    if (elements.mobileFavoriteFloatCount) {
        elements.mobileFavoriteFloatCount.textContent = String(state.favorites.size);
    }
    const current = state.photos[state.currentIndex];
    if (current && !elements.lightbox.hidden) {
        renderLightboxPhoto(current);
    }
    scheduleMobileFavoriteFloat(true);
}

function enhanceProgressiveGridImages() {
    if (enhanceProgressiveGridImages.observer) {
        enhanceProgressiveGridImages.observer.disconnect();
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) {
                return;
            }

            const image = entry.target;
            observer.unobserve(image);
            const nextSrc = image.dataset.previewSrc;
            if (!nextSrc || nextSrc === image.currentSrc || image.dataset.upgraded === '1') {
                image.classList.add('is-sharp');
                image.classList.remove('is-preview');
                return;
            }

            window.setTimeout(() => {
                const probe = new Image();
                probe.onload = () => {
                    image.src = nextSrc;
                    image.dataset.upgraded = '1';
                    image.classList.add('is-sharp');
                    image.classList.remove('is-preview');
                };
                probe.src = nextSrc;
            }, 140);
        });
    }, {
        rootMargin: '180px 0px'
    });

    document.querySelectorAll('.progressive-photo').forEach((image) => {
        observer.observe(image);
    });
    enhanceProgressiveGridImages.observer = observer;
}

async function toggleMusic() {
    if (!state.live?.background_music) {
        return;
    }

    if (elements.bgMusic.paused) {
        await elements.bgMusic.play();
    } else {
        elements.bgMusic.pause();
    }

    renderFeatureStrip();
}

function buildPhotoMeta(photo) {
    const parts = [formatDate(photo.created_at)];
    if (Number(state.live.show_photographer) === 1) {
        parts.push(photo.photographer_name || '官方摄影');
    }
    parts.push(photo.album_name || '未分类');
    return parts.join(' · ');
}

function buildDownloadHref(photo) {
    if (!photo?.original_url) {
        return '';
    }

    try {
        const url = new URL(photo.original_url, window.location.href);
        url.searchParams.set('attname', buildOriginalFileName(photo));
        return url.toString();
    } catch (_error) {
        return photo.original_url;
    }
}

function buildInitialPreviewSrc(photo) {
    return buildAdaptivePhotoSrc(photo, 'preview');
}

function buildViewerImageSrc(photo) {
    if (Number(state.live.watermark_enabled) === 1) {
        return photo.watermarked_url || buildAdaptivePhotoSrc(photo, 'viewer');
    }

    return buildAdaptivePhotoSrc(photo, 'viewer');
}

function buildOriginalPreviewSrc(photo) {
    return photo.original_url || buildViewerImageSrc(photo);
}

function buildAdaptivePhotoSrc(photo, mode = 'viewer') {
    const original = String(photo?.original_url || '').trim();
    if (original && isTransformableCdnUrl(original)) {
        const viewportWidth = Math.max(window.innerWidth || 0, 320);
        if (mode === 'thumb') {
            const size = isMobileViewport() ? 280 : 360;
            return buildQiniuSizedUrl(original, `imageView2/1/w/${size}/h/${size}/m_fill/interlace/1/q/52/format/webp`);
        }
        if (mode === 'hero') {
            const width = isMobileViewport() ? 900 : Math.min(1440, Math.round(viewportWidth * 1.2));
            return buildQiniuSizedUrl(original, `imageView2/2/w/${width}/interlace/1/q/56/format/webp`);
        }
        if (mode === 'popular') {
            const width = isMobileViewport() ? 720 : 960;
            return buildQiniuSizedUrl(original, `imageView2/2/w/${width}/interlace/1/q/58/format/webp`);
        }
        if (mode === 'preview') {
            const width = isMobileViewport() ? 720 : 960;
            return buildQiniuSizedUrl(original, `imageView2/2/w/${width}/interlace/1/q/58/format/webp`);
        }
        const width = isMobileViewport() ? 1280 : Math.min(1680, Math.round(viewportWidth * 1.35));
        return buildQiniuSizedUrl(original, `imageView2/2/w/${width}/interlace/1/q/66/format/webp`);
    }

    if (mode === 'thumb') {
        return photo.thumbnail_url || photo.compressed_url || photo.original_url || photo.watermarked_url || '';
    }
    if (mode === 'hero' || mode === 'popular' || mode === 'preview') {
        return photo.compressed_url || photo.thumbnail_url || photo.original_url || photo.watermarked_url || '';
    }
    return photo.compressed_url || photo.original_url || photo.watermarked_url || photo.thumbnail_url || '';
}

function isTransformableCdnUrl(url) {
    return /qiniu|clouddn|qiniucdn|qbox\.me|jack-sun\.com\/qiniu/i.test(String(url || ''));
}

function buildQiniuSizedUrl(baseUrl, operations) {
    if (!baseUrl) {
        return '';
    }
    const [cleanUrl] = String(baseUrl).split(/[?#]/);
    return `${cleanUrl}?${operations}`;
}

function buildPreviewHint() {
    if (state.originalLoaded) {
        return isMobileViewport()
            ? '当前已切换到原图，长按图片可保存到相册。'
            : '当前已切换到原图预览，下载按钮仍可单独下载原图。';
    }

    if (state.previewExpanded) {
        return isMobileViewport()
            ? '当前为高清预览，可点下方“加载原图”，加载完成后长按保存。'
            : '当前为高清预览，双击图片可切换到原图。';
    }

    return '已先载入快速预览，正在自动切换更清晰版本。';
}

function buildDownloadLabel() {
    if (Number(state.live.allow_batch_download) === 1) {
        return isMobileViewport() ? '点按钮加载原图后长按保存' : '整场原图打包 / 所选原图下载';
    }
    return '点开下载原图';
}

function buildDetails(exif) {
    const items = [];
    if (exif.camera) {
        items.push(`<span>机身 ${escapeHtml(exif.camera)}</span>`);
    }
    if (exif.lens) {
        items.push(`<span>镜头 ${escapeHtml(exif.lens)}</span>`);
    }
    if (exif.focalLength) {
        items.push(`<span>焦距 ${escapeHtml(String(exif.focalLength))}</span>`);
    }
    if (exif.aperture) {
        items.push(`<span>光圈 ${escapeHtml(String(exif.aperture))}</span>`);
    }
    if (exif.shutterSpeed) {
        items.push(`<span>快门 ${escapeHtml(String(exif.shutterSpeed))}</span>`);
    }
    if (exif.iso) {
        items.push(`<span>ISO ${escapeHtml(String(exif.iso))}</span>`);
    }
    if (exif.width && exif.height) {
        items.push(`<span>${exif.width} × ${exif.height}</span>`);
    }
    if (exif.format) {
        items.push(`<span>${String(exif.format).toUpperCase()}</span>`);
    }
    if (exif.space) {
        items.push(`<span>${escapeHtml(exif.space)}</span>`);
    }
    if (Number(state.live.watermark_enabled) === 1 && state.live.watermark_text) {
        items.push(`<span>水印：${escapeHtml(state.live.watermark_text)}</span>`);
    }
    if (!items.length) {
        items.push('<span>这张照片暂未提取到拍摄参数，后续新上传照片会自动显示。</span>');
    }
    return items.join('');
}

function buildOriginalFileName(photo) {
    const originalName = String(photo.original_name || '').trim();
    if (originalName) {
        const normalized = originalName
            .replace(/[\\/:*?"<>|]+/g, '-')
            .trim()
            .slice(0, 120);
        if (normalized) {
            return normalized;
        }
    }

    const originalUrl = String(photo.original_url || '');
    let ext = '.jpg';
    try {
        ext = originalUrl ? (new URL(originalUrl).pathname.match(/\.[a-z0-9]+$/i)?.[0] || ext) : ext;
    } catch (_error) {}
    return `${String(state.currentIndex + 1).padStart(3, '0')}-${safeFileName(photo.title || state.live?.title || 'photo')}${ext}`;
}

function safeFileName(input) {
    return String(input || 'photo')
        .trim()
        .replace(/[\\/:*?"<>|]+/g, '-')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80) || 'photo';
}

function hashString(value) {
    return Array.from(String(value || '')).reduce((hash, char) => {
        return ((hash << 5) - hash) + char.charCodeAt(0);
    }, 0);
}

function formatDate(value) {
    return new Date(value).toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatShort(value) {
    return new Date(value).toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatBytes(value) {
    const bytes = Number(value || 0);
    if (!Number.isFinite(bytes) || bytes <= 0) {
        return '未知';
    }
    if (bytes >= 1024 * 1024 * 1024) {
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    if (bytes >= 1024 * 1024) {
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${Math.round(bytes / 1024)} KB`;
}

function getBrowseProgressSnapshot() {
    const total = Math.max(Number(state.live?.total_photos || state.photos.length || 0), 0);
    if (window.scrollY <= 24) {
        return {
            count: 0,
            percent: 0
        };
    }
    const cards = Array.from(elements.photoGrid?.querySelectorAll('[data-index]') || []);

    if (!cards.length) {
        return {
            count: 0,
            percent: 0
        };
    }

    const viewportBottom = window.innerHeight || document.documentElement.clientHeight || 0;
    const anchorLine = Math.max(88, Math.min(180, viewportBottom * 0.24));
    let anchorIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;

    cards.forEach((card) => {
        const rect = card.getBoundingClientRect();
        const photoIndex = Number(card.dataset.index || 0);
        const containsAnchor = rect.top <= anchorLine && rect.bottom >= anchorLine;
        const distance = containsAnchor
            ? 0
            : Math.min(
                Math.abs(rect.top - anchorLine),
                Math.abs(rect.bottom - anchorLine)
            );

        if (distance < bestDistance) {
            bestDistance = distance;
            anchorIndex = photoIndex;
        }
    });

    const count = Math.max(0, Math.min(total, anchorIndex));
    const percent = total > 0
        ? Math.max(0, Math.min(100, Math.round((count / total) * 100)))
        : 0;
    return { count, percent };
}

function buildFeedCountLabel(count) {
    const total = Math.max(Number(state.live?.total_photos || state.photos.length || 0), 0);
    return `${Math.max(0, count)}/${total}`;
}

function setFeedStatus(label, meta, percent) {
    if (isMobileViewport()) {
        const topReady = label === '↑ TOP' || state.mobileFeedMode === 'top';
        elements.loading.dataset.mode = topReady ? 'top' : 'count';
        elements.loadingLabel.textContent = topReady ? '↑ TOP' : label;
        elements.loadingMeta.textContent = topReady ? '返回顶部' : meta;
        elements.loading.classList.toggle('top-ready', topReady);
    } else {
        elements.loading.dataset.mode = 'count';
        elements.loadingLabel.textContent = label;
        elements.loadingMeta.textContent = meta;
        elements.loading.classList.remove('top-ready');
    }
    elements.loadingFill.style.width = `${Math.max(0, Math.min(100, Number(percent) || 0))}%`;
}

function scheduleMobileFeedTopToggle() {
    if (!isMobileViewport()) {
        return;
    }
    if (isMobileSafari) {
        updateSafariMobileFloatingUI();
        return;
    }
    state.mobileFeedMode = 'count';
    updateFeedLoadingState();
    window.clearTimeout(state.mobileFeedModeTimer);
    state.mobileFeedModeTimer = window.setTimeout(() => {
        state.mobileFeedMode = 'top';
        updateFeedLoadingState();
    }, 1200);
}

function scheduleMobileFavoriteFloat(forceShow = false) {
    if (!elements.mobileFavoriteFloat) {
        return;
    }
    if (isMobileSafari) {
        updateSafariMobileFloatingUI(forceShow);
        return;
    }
    if (!isMobileViewport() || !state.live?.access_granted || !elements.lightbox.hidden) {
        elements.mobileFavoriteFloat.hidden = true;
        elements.mobileFavoriteFloat.classList.remove('show');
        window.clearTimeout(state.mobileFavoriteFloatTimer);
        window.clearTimeout(state.mobileFavoriteFloatDismissTimer);
        return;
    }

    window.clearTimeout(state.mobileFavoriteFloatTimer);
    window.clearTimeout(state.mobileFavoriteFloatDismissTimer);
    const delay = forceShow ? 80 : 1800;
    state.mobileFavoriteFloatTimer = window.setTimeout(() => {
        elements.mobileFavoriteFloat.hidden = false;
        elements.mobileFavoriteFloat.classList.add('show');
    }, delay);
}

function updateSafariMobileFloatingUI(forceShow = false) {
    const mobile = isMobileViewport();
    const canShowFavorite = Boolean(
        elements.mobileFavoriteFloat &&
        mobile &&
        state.live?.access_granted &&
        elements.lightbox.hidden
    );

    state.mobileFeedMode = window.scrollY > 220 ? 'top' : 'count';
    updateFeedLoadingState();

    if (!canShowFavorite) {
        elements.mobileFavoriteFloat.hidden = true;
        elements.mobileFavoriteFloat.classList.remove('show');
        return;
    }

    const shouldShow = forceShow || window.scrollY > 120;
    elements.mobileFavoriteFloat.hidden = !shouldShow;
    elements.mobileFavoriteFloat.classList.toggle('show', shouldShow);
}

function showToast(text, options = {}) {
    elements.toastTitle.textContent = options.title || inferToastTitle(text);
    elements.toastText.textContent = text;
    elements.toast.dataset.variant = options.variant || 'spotlight';
    elements.toast.classList.add('show');
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => {
        elements.toast.classList.remove('show');
    }, options.duration || 2200);
}

async function copyTextToClipboard(text) {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch (_error) {
    }

    try {
        const input = document.createElement('input');
        input.value = text;
        input.setAttribute('readonly', 'readonly');
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        const copied = document.execCommand('copy');
        input.remove();
        return copied;
    } catch (_error) {
        return false;
    }
}

async function copyCurrentPhotoLink() {
    const photo = state.photos[state.currentIndex];
    if (!photo) {
        throw new Error('当前没有可复制的图片');
    }

    const url = photo.original_url || photo.compressed_url || photo.thumbnail_url;
    if (!url) {
        throw new Error('当前图片还没有可复制的链接');
    }

    const copied = await copyTextToClipboard(url);
    showToast(copied ? '图片链接已复制' : '链接已选中，请手动复制', {
        title: '图片外链'
    });
}

function inferToastTitle(text) {
    if (/下载|打包/.test(text)) {
        return '下载任务';
    }
    if (/收藏/.test(text)) {
        return '收藏提示';
    }
    if (/播放/.test(text)) {
        return '播放模式';
    }
    if (/成功|完成/.test(text)) {
        return '操作完成';
    }
    if (/失败|错误|拦截/.test(text)) {
        return '操作提醒';
    }
    return '当前提示';
}

function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
