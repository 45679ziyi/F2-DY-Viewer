document.addEventListener('DOMContentLoaded', () => {
    const oneButton = document.getElementById('oneButton');
    const postButton = document.getElementById('postButton');
    const likeButton = document.getElementById('likeButton');
    const mixButton = document.getElementById('mixButton');
    const folderSelector = document.getElementById('folderSelector');
    const accountList = document.getElementById('accountList');
    const timeline = document.getElementById('timeline');
    const loadAllButton = document.createElement('button');
    const themeToggleButton = document.createElement('button');
    const randomImageButton = document.createElement('button');
    const randomVideoButton = document.createElement('button');
    
    loadAllButton.id = 'loadAllButton';
    loadAllButton.className = 'nav-button';
    loadAllButton.textContent = '加载全部';
    themeToggleButton.id = 'themeToggleButton';
    themeToggleButton.className = 'nav-button';
    themeToggleButton.textContent = '切换主题';
    
    randomImageButton.id = 'randomImageButton';
    randomImageButton.className = 'nav-button';
    randomImageButton.textContent = '随机图片';
    randomVideoButton.id = 'randomVideoButton';
    randomVideoButton.className = 'nav-button';
    randomVideoButton.textContent = '随机视频';
    
    const navButtons = document.querySelector('.nav-buttons');
    navButtons.appendChild(loadAllButton);
    navButtons.appendChild(themeToggleButton);
    navButtons.appendChild(randomImageButton);
    navButtons.appendChild(randomVideoButton);

    let currentMode = 'one';
    let currentFolder = '';
    let currentAccount = '';
    let currentPage = 1;
    let isLoadingMore = false;
    let loadAll = false;
    const PAGE_SIZE = 50;

    // 存储所有媒体文件
    let allMediaFiles = [];

    // 加载所有媒体文件
    async function loadAllMediaFiles() {
        if (!currentFolder) return;
        allMediaFiles = [];

        const modes = ['one', 'post', 'like', 'mix'];
        for (const mode of modes) {
            try {
                const modeDir = await currentFolder.getDirectoryHandle(mode).catch(() => null);
                if (!modeDir) continue;

                for await (const accountEntry of modeDir.values()) {
                    if (accountEntry.kind === 'directory') {
                        try {
                            const accountDir = await modeDir.getDirectoryHandle(accountEntry.name);
                            for await (const entry of accountDir.values()) {
                                if (entry.kind === 'file') {
                                    const match = entry.name.match(/^(\d{4}-\d{2}-\d{2} \d{2}-\d{2}-\d{2})_(.+?)_(image|video|live).*\.(jpg|webp|mp4)$/);
                                    if (match) {
                                        allMediaFiles.push({
                                            name: entry.name,
                                            timestamp: match[1],
                                            title: match[2],
                                            type: match[3],
                                            entry: entry,
                                            mode: mode,
                                            account: accountEntry.name
                                        });
                                    }
                                }
                            }
                        } catch (err) {
                            console.warn(`无法访问账号目录 ${accountEntry.name}:`, err);
                            continue;
                        }
                    }
                }
            } catch (err) {
                console.warn(`目录 ${mode} 不存在或无法访问`);
                continue;
            }
        }
    }

    // 创建媒体查看器
    function createMediaViewer(mediaElement, groupFiles, currentIndex, timestamp, title, isRandom = false) {
        const overlay = document.createElement('div');
        overlay.className = 'media-viewer-overlay';
        
        const content = document.createElement('div');
        content.className = 'media-viewer-content';
        
        const titleBar = document.createElement('div');
        titleBar.className = 'media-viewer-title';
        titleBar.textContent = `${timestamp} - ${title}`;
        
        const closeButton = document.createElement('button');
        closeButton.className = 'media-viewer-close';
        closeButton.innerHTML = '×';
        
        const clonedMedia = mediaElement.cloneNode(true);
        if (clonedMedia.tagName === 'VIDEO') {
            clonedMedia.controls = true;
        }
        
        content.appendChild(titleBar);
        content.appendChild(clonedMedia);
        content.appendChild(closeButton);
        overlay.appendChild(content);
        document.body.appendChild(overlay);
        
        // 统一的清理函数
        const cleanup = () => {
            document.removeEventListener('keydown', handleKeyboard);
            // 如果是视频，在移除前暂停播放
            if (clonedMedia.tagName === 'VIDEO') {
                clonedMedia.pause();
            }
            overlay.remove();
        };
        
        closeButton.onclick = cleanup;
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                cleanup();
            }
        };
        
        // 添加键盘事件监听
        const handleKeyboard = async (e) => {
            if (e.key === 'Escape') {
                cleanup();
            } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                e.preventDefault();
                
                if (isRandom) {
                    // 在随机模式下，处理历史记录的前进和后退
                    let newIndex;
                    const currentType = mediaElement.tagName.toLowerCase() === 'img' ? 'image' : 'video';
                    const history = currentType === 'image' ? imageViewHistory : videoViewHistory;
                    const currentIndex = currentType === 'image' ? currentImageHistoryIndex : currentVideoHistoryIndex;
                    
                    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                        // 后退到上一个历史记录
                        newIndex = currentIndex > 0 ? currentIndex - 1 : 0;
                    } else {
                        // 前进到下一个历史记录，如果已经是最后一个，则随机选择新的
                        if (currentIndex < history.length - 1) {
                            newIndex = currentIndex + 1;
                        } else {
                            cleanup();
                            await createRandomMediaViewer(currentType);
                            return;
                        }
                    }
                    
                    cleanup();
                    await createRandomMediaViewer(currentType, newIndex);
                } else {
                    // 在非随机模式下保持原有的组内切换逻辑
                    let newIndex;
                    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                        newIndex = currentIndex > 0 ? currentIndex - 1 : groupFiles.length - 1;
                    } else {
                        newIndex = currentIndex < groupFiles.length - 1 ? currentIndex + 1 : 0;
                    }
                    
                    const newFile = groupFiles[newIndex];
                    const newMediaElement = document.createElement(newFile.type === 'image' ? 'img' : 'video');
                    
                    if (newFile.type === 'video' || newFile.type === 'live') {
                        newMediaElement.controls = true;
                        newMediaElement.preload = 'metadata';
                        newMediaElement.style.maxWidth = '100%';
                    }
                    
                    newFile.entry.getFile().then(f => {
                        const url = URL.createObjectURL(f);
                        if (newFile.type === 'image') {
                            newMediaElement.src = url;
                        } else {
                            newMediaElement.src = url;
                            newMediaElement.onloadedmetadata = () => {
                                if (newMediaElement.videoWidth > newMediaElement.videoHeight) {
                                    newMediaElement.style.width = '100%';
                                    newMediaElement.style.height = 'auto';
                                } else {
                                    newMediaElement.style.width = 'auto';
                                    newMediaElement.style.height = '100%';
                                }
                            };
                        }
                        
                        cleanup();
                        createMediaViewer(newMediaElement, groupFiles, newIndex, timestamp, title);
                    });
                }
            }
        };
        
        document.addEventListener('keydown', handleKeyboard);
    }

    // 随机选择媒体文件
    // 添加历史记录数组
    let imageViewHistory = [];
    let videoViewHistory = [];
    let currentImageHistoryIndex = -1;
    let currentVideoHistoryIndex = -1;

    function getRandomMediaFile(type) {
        const mediaFiles = allMediaFiles.filter(file => {
            if (type === 'image') return file.type === 'image';
            return file.type === 'video' || file.type === 'live';
        });
        if (mediaFiles.length === 0) return null;
        return mediaFiles[Math.floor(Math.random() * mediaFiles.length)];
    }

    async function createRandomMediaViewer(type, historyIndex = null) {
        // 根据类型选择对应的历史记录
        const history = type === 'image' ? imageViewHistory : videoViewHistory;
        let currentIndex = type === 'image' ? currentImageHistoryIndex : currentVideoHistoryIndex;

        // 如果提供了历史索引，从历史记录中加载
        if (historyIndex !== null && historyIndex >= 0 && historyIndex < history.length) {
            const historyItem = history[historyIndex];
            if (type === 'image') {
                currentImageHistoryIndex = historyIndex;
            } else {
                currentVideoHistoryIndex = historyIndex;
            }
            createMediaViewer(
                historyItem.mediaElement,
                [historyItem.file],
                0,
                historyItem.timestamp,
                historyItem.title,
                true
            );
            return;
        }

        // 加载新的随机媒体
        if (allMediaFiles.length === 0) {
            await loadAllMediaFiles();
        }

        const file = getRandomMediaFile(type);
        if (!file) {
            alert(`没有找到${type === 'image' ? '图片' : '视频'}文件`);
            return;
        }

        const mediaElement = document.createElement(type === 'image' ? 'img' : 'video');
        if (type !== 'image') {
            mediaElement.controls = true;
            mediaElement.preload = 'metadata';
            mediaElement.style.maxWidth = '100%';
        }

        const fileHandle = await file.entry.getFile();
        const url = URL.createObjectURL(fileHandle);
        mediaElement.src = url;

        // 获取正确的来源信息
        let sourceType = '';
        let accountName = '';
        
        // 从文件对象中获取来源信息
        if (file.mode === 'post') sourceType = '作品';
        else if (file.mode === 'like') sourceType = '喜欢';
        else if (file.mode === 'mix') sourceType = '合集';
        else if (file.mode === 'one') sourceType = '内容';
        
        // 获取账号名称
        accountName = file.account;

        const sourceInfo = `来自${sourceType}-${accountName || '未知账号'}`;
        
        // 更新历史记录
        if (type === 'image') {
            currentImageHistoryIndex++;
            imageViewHistory = imageViewHistory.slice(0, currentImageHistoryIndex);
            imageViewHistory.push({
                file,
                mediaElement,
                timestamp: file.timestamp,
                title: `${file.title} (${sourceInfo})`
            });
        } else {
            currentVideoHistoryIndex++;
            videoViewHistory = videoViewHistory.slice(0, currentVideoHistoryIndex);
            videoViewHistory.push({
                file,
                mediaElement,
                timestamp: file.timestamp,
                title: `${file.title} (${sourceInfo})`
            });
        }

        createMediaViewer(mediaElement, [file], 0, file.timestamp, `${file.title} (${sourceInfo})`, true);
    }

    // 添加随机按钮事件监听
    randomImageButton.addEventListener('click', () => createRandomMediaViewer('image'));
    randomVideoButton.addEventListener('click', () => createRandomMediaViewer('video'));

    // 主题切换
    let isDarkMode = localStorage.getItem('darkMode') === 'true';
    function toggleTheme() {
        isDarkMode = !isDarkMode;
        document.body.classList.toggle('dark-mode', isDarkMode);
        localStorage.setItem('darkMode', isDarkMode);
    }

    themeToggleButton.addEventListener('click', toggleTheme);
    document.body.classList.toggle('dark-mode', isDarkMode);

    // 加载全部内容
    loadAllButton.addEventListener('click', () => {
        loadAll = !loadAll;
        loadAllButton.classList.toggle('active', loadAll);
        if (currentAccount) {
            currentPage = 1;
            loadContent();
        }
    });

    // 添加拖拽区域
    document.body.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });

    document.body.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const items = e.dataTransfer.items;
        if (items && items.length > 0) {
            const item = items[0];
            if (item.kind === 'file') {
                const handle = await item.getAsFileSystemHandle();
                if (handle.kind === 'directory') {
                    await handleFolderSelection(handle);
                }
            }
        }
    });

    // 切换模式（one/post/like/mix）
    oneButton.addEventListener('click', () => {
        currentMode = 'one';
        oneButton.classList.add('active');
        postButton.classList.remove('active');
        likeButton.classList.remove('active');
        mixButton.classList.remove('active');
        loadAccounts();
    });

    postButton.addEventListener('click', () => {
        currentMode = 'post';
        postButton.classList.add('active');
        oneButton.classList.remove('active');
        likeButton.classList.remove('active');
        mixButton.classList.remove('active');
        loadAccounts();
    });

    likeButton.addEventListener('click', () => {
        currentMode = 'like';
        likeButton.classList.add('active');
        oneButton.classList.remove('active');
        postButton.classList.remove('active');
        mixButton.classList.remove('active');
        loadAccounts();
    });

    mixButton.addEventListener('click', () => {
        currentMode = 'mix';
        mixButton.classList.add('active');
        oneButton.classList.remove('active');
        postButton.classList.remove('active');
        likeButton.classList.remove('active');
        loadAccounts();
    });

    // 选择文件夹
    folderSelector.addEventListener('click', async () => {
        try {
            const dirHandle = await window.showDirectoryPicker();
            await handleFolderSelection(dirHandle);
        } catch (err) {
            console.error('Error selecting folder:', err);
        }
    });

    // 处理文件夹选择
    async function handleFolderSelection(dirHandle) {
        try {
            const douyinDirs = await findDouyinFolders(dirHandle);
            if (douyinDirs.length === 0) {
                alert('未找到douyin文件夹，请选择正确的目录');
            } else if (douyinDirs.length > 1) {
                alert('检测到多个douyin文件夹，请确保目录结构正确');
            } else {
                currentFolder = douyinDirs[0];
                // 清空媒体文件列表和随机浏览历史
                allMediaFiles = [];
                imageViewHistory = [];
                videoViewHistory = [];
                currentImageHistoryIndex = -1;
                currentVideoHistoryIndex = -1;
                loadAccounts();
            }
        } catch (err) {
            console.error('Error handling folder selection:', err);
        }
    }

    // 递归查找douyin文件夹
    async function findDouyinFolders(dirHandle, depth = 0, results = []) {
        if (depth > 5) return results;
        
        if (dirHandle.name === 'douyin') {
            results.push(dirHandle);
        }

        try {
            for await (const entry of dirHandle.values()) {
                if (entry.kind === 'directory') {
                    await findDouyinFolders(entry, depth + 1, results);
                }
            }
        } catch (err) {
            console.error('Error searching directory:', err);
        }

        return results;
    }

    // 加载账号列表
    async function loadAccounts() {
        accountList.innerHTML = '';
        if (!currentFolder) return;

        try {
            const targetDir = await getTargetDirectory();
            if (!targetDir) return;

            const accounts = new Set();

            for await (const entry of targetDir.values()) {
                if (entry.kind === 'directory') {
                    accounts.add(entry.name);
                }
            }

            accounts.forEach(account => {
                const div = document.createElement('div');
                div.className = 'account-item';
                div.textContent = account;
                div.addEventListener('click', () => {
                    document.querySelectorAll('.account-item').forEach(item => {
                        item.classList.remove('active');
                    });
                    div.classList.add('active');
                    currentAccount = account;
                    currentPage = 1;
                    loadContent();
                });
                accountList.appendChild(div);
            });
        } catch (err) {
            console.error('Error loading accounts:', err);
        }
    }

    // 获取目标目录（one或post）
    async function getTargetDirectory() {
        try {
            return await currentFolder.getDirectoryHandle(currentMode);
        } catch (err) {
            console.error(`Error accessing ${currentMode} directory:`, err);
            return null;
        }
    }

    // 检查是否需要加载更多
    const content = document.querySelector('.content');
    content.addEventListener('scroll', checkLoadMore);

    function checkLoadMore() {
        if (isLoadingMore) return;
        
        const scrollHeight = content.scrollHeight;
        const scrollTop = content.scrollTop;
        const clientHeight = content.clientHeight;
    
        if (scrollHeight - scrollTop - clientHeight < 100) {
            loadContent(true);
        }
    }

    window.addEventListener('scroll', checkLoadMore);

    // 加载内容
    async function loadContent(append = false) {
        if (!currentFolder || !currentAccount || isLoadingMore) return;

        try {
            isLoadingMore = true;
            const targetDir = await getTargetDirectory();
            if (!targetDir) return;

            const accountDir = await targetDir.getDirectoryHandle(currentAccount);
            if (!append) {
                timeline.innerHTML = '';
            }

            const files = [];
            for await (const entry of accountDir.values()) {
                if (entry.kind === 'file') {
                    const match = entry.name.match(/^(\d{4}-\d{2}-\d{2} \d{2}-\d{2}-\d{2})_(.+?)_(image|video|live).*\.(jpg|webp|mp4)$/);
                    if (match) {
                        files.push({
                            name: entry.name,
                            timestamp: match[1],
                            title: match[2],
                            type: match[3],
                            entry: entry
                        });
                    }
                }
            }

            // 按时间戳排序
            files.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

            // 分页处理
            const startIndex = (currentPage - 1) * PAGE_SIZE;
            const endIndex = loadAll ? files.length : currentPage * PAGE_SIZE;
            const pageFiles = files.slice(startIndex, endIndex);

            // 按时间戳分组
            const groups = {};
            pageFiles.forEach(file => {
                if (!groups[file.timestamp]) {
                    groups[file.timestamp] = {
                        title: file.title,
                        files: []
                    };
                }
                groups[file.timestamp].files.push(file);
            });

            // 创建帖子
            for (const timestamp in groups) {
                const group = groups[timestamp];
                const post = document.createElement('div');
                post.className = 'post';

                const header = document.createElement('div');
                header.className = 'post-header';

                const time = document.createElement('div');
                time.className = 'post-time';
                time.textContent = timestamp;

                const title = document.createElement('div');
                title.className = 'post-title';
                title.textContent = group.title;

                const content = document.createElement('div');
                content.className = 'post-content';

                header.appendChild(time);
                header.appendChild(title);
                post.appendChild(header);
                post.appendChild(content);

                // 创建媒体查看器
                function createMediaViewer(mediaElement, groupFiles, currentIndex) {
                    const overlay = document.createElement('div');
                    overlay.className = 'media-viewer-overlay';
                    
                    const content = document.createElement('div');
                    content.className = 'media-viewer-content';
                    
                    const titleBar = document.createElement('div');
                    titleBar.className = 'media-viewer-title';
                    titleBar.textContent = `${timestamp} - ${group.title}`;
                    
                    const closeButton = document.createElement('button');
                    closeButton.className = 'media-viewer-close';
                    closeButton.innerHTML = '×';
                    
                    const clonedMedia = mediaElement.cloneNode(true);
                    if (clonedMedia.tagName === 'VIDEO') {
                        clonedMedia.controls = true;
                    }
                    
                    content.appendChild(titleBar);
                    content.appendChild(clonedMedia);
                    content.appendChild(closeButton);
                    overlay.appendChild(content);
                    document.body.appendChild(overlay);
                    
                    // 统一的清理函数
                    const cleanup = () => {
                        document.removeEventListener('keydown', handleKeyboard);
                        overlay.remove();
                    };
                    
                    closeButton.onclick = cleanup;
                    overlay.onclick = (e) => {
                        if (e.target === overlay) {
                            cleanup();
                        }
                    };
                    
                    // 添加键盘事件监听
                    const handleKeyboard = (e) => {
                        if (e.key === 'Escape') {
                            cleanup();
                        } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                            e.preventDefault();
                            let newIndex;
                            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                                newIndex = currentIndex > 0 ? currentIndex - 1 : groupFiles.length - 1;
                            } else {
                                newIndex = currentIndex < groupFiles.length - 1 ? currentIndex + 1 : 0;
                            }
                            
                            const newFile = groupFiles[newIndex];
                            const newMediaElement = document.createElement(newFile.type === 'image' ? 'img' : 'video');
                            
                            if (newFile.type === 'video' || newFile.type === 'live') {
                                newMediaElement.controls = true;
                                newMediaElement.preload = 'metadata';
                                newMediaElement.style.maxWidth = '100%';
                            }
                            
                            newFile.entry.getFile().then(f => {
                                const url = URL.createObjectURL(f);
                                if (newFile.type === 'image') {
                                    newMediaElement.src = url;
                                } else {
                                    newMediaElement.src = url;
                                    newMediaElement.onloadedmetadata = () => {
                                        if (newMediaElement.videoWidth > newMediaElement.videoHeight) {
                                            newMediaElement.style.width = '100%';
                                            newMediaElement.style.height = 'auto';
                                        } else {
                                            newMediaElement.style.width = 'auto';
                                            newMediaElement.style.height = '100%';
                                        }
                                    };
                                }
                                
                                // 清理旧的事件监听器和元素
                                cleanup();
                                
                                // 创建新的查看器
                                createMediaViewer(newMediaElement, groupFiles, newIndex);
                            });
                        }
                    };
                    
                    document.addEventListener('keydown', handleKeyboard);
                }

                // 添加媒体文件
                for (const file of group.files) {
                    const mediaItem = document.createElement('div');
                    mediaItem.className = 'media-item';

                    if (file.type === 'image') {
                        const img = document.createElement('img');
                        file.entry.getFile().then(f => {
                            img.src = URL.createObjectURL(f);
                        });
                        img.onclick = () => createMediaViewer(img, group.files, group.files.indexOf(file));
                        mediaItem.appendChild(img);
                    } else if (file.type === 'video' || file.type === 'live') {
                        const video = document.createElement('video');
                        video.controls = true;
                        video.preload = 'metadata';
                        video.style.maxWidth = '100%';
                        file.entry.getFile().then(f => {
                            const url = URL.createObjectURL(f);
                            video.src = url;
                            video.onloadedmetadata = () => {
                                if (video.videoWidth > video.videoHeight) {
                                    video.style.width = '100%';
                                    video.style.height = 'auto';
                                } else {
                                    video.style.width = 'auto';
                                    video.style.height = '100%';
                                }
                            };
                        });
                        video.onclick = () => createMediaViewer(video, group.files, group.files.indexOf(file));
                        mediaItem.appendChild(video);
                    }

                    content.appendChild(mediaItem);
                }

                timeline.appendChild(post);
            }

            if (pageFiles.length > 0) {
                currentPage++;
            }
        } catch (err) {
            console.error('Error loading content:', err);
        } finally {
            isLoadingMore = false;
        }
    }
});