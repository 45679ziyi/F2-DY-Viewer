document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    const selectFolderBtn = document.getElementById('selectFolder');
    const previewArea = document.getElementById('previewArea');

    // 拖拽事件处理
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });

    function highlight() {
        dropZone.classList.add('dragover');
    }

    function unhighlight() {
        dropZone.classList.remove('dragover');
    }

    let selectedFolderPath = '';

    // 处理文件夹拖放
    dropZone.addEventListener('drop', async (e) => {
        const items = e.dataTransfer.items;
        for (let item of items) {
            if (item.kind === 'file') {
                const entry = item.webkitGetAsEntry();
                if (entry.isDirectory) {
                    selectedFolderPath = entry.fullPath;
                    await processDirectory(entry);
                }
            }
        }
    });

    // 处理文件夹选择按钮
    selectFolderBtn.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.webkitdirectory = true;
        input.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                selectedFolderPath = e.target.files[0].webkitRelativePath.split('/')[0];
                handleFileSelect(e);
            }
        });
        input.click();
    });

    async function handleFileSelect(e) {
        const files = Array.from(e.target.files);
        savedFiles = files; // 保存文件列表
        await processFiles(files);
    }

    // 处理文件夹
    async function processDirectory(dirEntry) {
        const weiboFolders = [];
        await findWeiboFolders(dirEntry, weiboFolders);

        if (weiboFolders.length === 0) {
            alert('未找到weibo文件夹，请确保上传的文件夹包含weibo文件夹！');
            return;
        }

        if (weiboFolders.length > 1) {
            const confirmMessage = `检测到${weiboFolders.length}个weibo文件夹，是否全部导入？\n${weiboFolders.map(folder => folder.fullPath).join('\n')}`;
            if (!confirm(confirmMessage)) {
                return;
            }
        }

        for (const folder of weiboFolders) {
            const files = await readDirectory(folder);
            await processFiles(files);
        }
    }

    function readDirectory(dirEntry) {
        return new Promise((resolve) => {
            const files = [];
            const reader = dirEntry.createReader();
            function readEntries() {
                reader.readEntries((entries) => {
                    if (!entries.length) {
                        resolve(files);
                    } else {
                        processEntries(entries);
                        readEntries();
                    }
                });
            }

            function processEntries(entries) {
                entries.forEach(entry => {
                    if (entry.isFile) {
                        entry.file(file => files.push(file));
                    }
                });
            }

            readEntries();
        });
    }

    // 递归查找weibo文件夹
    async function findWeiboFolders(dirEntry, result) {
        const reader = dirEntry.createReader();
        const entries = await new Promise(resolve => {
            const allEntries = [];
            function readEntries() {
                reader.readEntries(entries => {
                    if (!entries.length) {
                        resolve(allEntries);
                    } else {
                        allEntries.push(...entries);
                        readEntries();
                    }
                });
            }
            readEntries();
        });

        for (const entry of entries) {
            if (entry.isDirectory) {
                if (entry.name === 'weibo') {
                    result.push(entry);
                } else {
                    await findWeiboFolders(entry, result);
                }
            }
        }
    }

    // 处理文件
    let currentUser = null;
let currentPage = 0;
let isLoading = false;
let allWeiboData = [];
let isLazyLoadEnabled = true;
let totalFiles = 0;
let processedFiles = 0;
let batchSize = 5; // 每批处理的文件数量
let savedFiles = []; // 保存文件列表的全局变量

async function processFiles(files) {
    const userFiles = files.filter(file => file.name === 'users.csv');
    const weiboFiles = files.filter(file => file.name.endsWith('.csv') && file.name !== 'users.csv');

    // 计算总文件大小
    const totalSize = files.reduce((acc, file) => acc + file.size, 0);
    const sizeInGB = totalSize / (1024 * 1024 * 1024);
    
    if (sizeInGB > 1) { // 如果文件夹大于1GB，显示警告
        if (!confirm(`文件夹大小为 ${sizeInGB.toFixed(2)}GB，加载大量数据可能会影响性能，是否继续？`)) {
            return;
        }
    }

    totalFiles = weiboFiles.length;
    processedFiles = 0;
    updateLoadingStatus();

    if (userFiles.length > 0) {
        const userData = await readCSVFile(userFiles[0]);
        if (userData.length > 0) {
            currentUser = userData[0];
        }
        displayUserList(userData);
    }

    if (weiboFiles.length > 0) {
        // 分批处理文件
        for (let i = 0; i < weiboFiles.length; i += batchSize) {
            const batch = weiboFiles.slice(i, i + batchSize);
            await processBatch(batch);
        }
        loadMoreWeibos();
    }

    previewArea.classList.add('active');
    setupEventListeners();
}

async function processBatch(files) {
    for (const file of files) {
        const weiboData = await readCSVFile(file);
        allWeiboData = allWeiboData.concat(weiboData);
        processedFiles++;
        updateLoadingStatus();
    }
}

function updateLoadingStatus() {
    const loading = document.getElementById('loading');
    if (totalFiles > 0) {
        const progress = Math.round((processedFiles / totalFiles) * 100);
        loading.innerHTML = `<span class="loading-text">正在加载文件... ${progress}% (${processedFiles}/${totalFiles})</span>`;
    }
}

    // 读取CSV文件
    function readCSVFile(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target.result;
                const lines = text.split('\n');
                const headers = lines[0].split(',');
                const data = [];

                for (let i = 1; i < lines.length; i++) {
                    if (!lines[i].trim()) continue;
                    const values = lines[i].split(',');
                    const entry = {};
                    headers.forEach((header, index) => {
                        entry[header.trim()] = values[index]?.trim() || '';
                    });
                    data.push(entry);
                }

                resolve(data);
            };
            reader.readAsText(file);
        });
    }

    // 显示用户列表
    function displayUserList(userData) {
        const userList = document.getElementById('userList');
        userList.innerHTML = '';

        userData.forEach((user, index) => {
            const userItem = document.createElement('div');
            userItem.className = 'user-item';
            userItem.innerHTML = `
                <div class="user-item-info">
                    <h3>${user.昵称 || ''}</h3>
                    <p>粉丝：${user.粉丝数 || '0'}</p>
                </div>
            `;

            userItem.addEventListener('click', async () => {
                document.querySelectorAll('.user-item').forEach(item => item.classList.remove('active'));
                userItem.classList.add('active');
                currentUser = user;
                // 使用昵称作为文件夹名称
                if (!currentUser?.昵称) {
                    console.error('用户昵称未定义');
                    alert('无法加载用户数据：用户昵称未定义');
                    return;
                }
                currentPage = 0;
                allWeiboData = [];
                document.getElementById('weiboContainer').innerHTML = '';
                // 使用保存的文件列表
                const userNickname = currentUser.昵称;
                const weiboFiles = savedFiles.filter(file => {
                    return file.name.endsWith('.csv') && 
                           file.name !== 'users.csv' && 
                           file.webkitRelativePath.includes(`weibo/${userNickname}/`);
                });
                if (weiboFiles.length === 0) {
                    console.error('未找到该用户的微博数据文件');
                    alert('未找到该用户的微博数据文件');
                    return;
                }
                const loading = document.getElementById('loading');
                loading.innerHTML = '<span class="loading-text">正在加载用户数据...</span>';
                loading.classList.add('active');
                try {
                    for (const file of weiboFiles) {
                        const weiboData = await readCSVFile(file);
                        allWeiboData = allWeiboData.concat(weiboData);
                    }
                    loadMoreWeibos();
                } catch (error) {
                    console.error('加载用户数据时出错:', error);
                    alert('加载用户数据时出错');
                } finally {
                    loading.classList.remove('active');
                }
            });

            userList.appendChild(userItem);

            // 自动选择第一个用户
            if (index === 0) {
                userItem.classList.add('active');
                currentUser = user;
                userItem.click(); // 触发点击事件来加载第一个用户的数据
            }
        });
    }

    // 加载更多微博
    function loadMoreWeibos() {
        if (isLoading) return;
        isLoading = true;
    
        const weiboContainer = document.getElementById('weiboContainer');
        const loading = document.getElementById('loading');
        loading.classList.add('active');
    
        const start = currentPage * 50;
        const end = start + 50;
        const weibos = allWeiboData.slice(start, end);
    
        weibos.forEach(weibo => {
            if (!weibo.正文) return;
    
            const weiboItem = document.createElement('div');
            weiboItem.className = 'weibo-item';
    
            const content = `
                <div class="weibo-content">${weibo.正文}</div>
                ${weibo.原始图片url ? `
                    <div class="weibo-media">
                        ${(() => {
                            const date = weibo.完整日期.split(' ')[0].replace(/-/g, '');
                            const id = weibo.id;
                            const urls = weibo.原始图片url.split(',');
                            return urls.map((url, index) => {
                                const fileName = `${date}T_${id}_${index + 1}.jpg`;
                                const userNickname = currentUser?.昵称;
                                if (!userNickname) {
                                    console.error('用户昵称未定义，无法加载图片');
                                    return '';
                                }
                                const localPath = `weibo/${userNickname}/img/原创微博图片/${fileName}`;
                                return `<img data-src="${localPath}" alt="微博图片" class="lazy" onclick="showMedia('${localPath}', 'image')">`;
                            }).join('');
                        })()}
                    </div>
                ` : ''}
                ${weibo.视频url ? `
                    <div class="weibo-media">
                        ${(() => {
                            try {
                                const date = weibo.完整日期.split(' ')[0].replace(/-/g, '');
                                const id = weibo.id;
                                const fileName = `${date}T_${id}_1.mp4`;
                                if (!fileName) return '';
                                const userNickname = currentUser?.昵称;
                                if (!userNickname) {
                                    console.error('用户昵称未定义，无法加载视频');
                                    return '';
                                }
                                const localPath = `weibo/${userNickname}/video/原创微博视频/${fileName}`;
                                return `<video data-src="${localPath}" class="lazy" controls onclick="showMedia('${localPath}', 'video')"></video>`;
                            } catch (error) {
                                console.error('处理视频URL时出错:', error);
                                return '';
                            }
                        })()}
                    </div>
                ` : ''}
    
                <div class="weibo-info">
                    <span>发布时间：${weibo.完整日期 || ''}</span>
                    <span>点赞：${weibo.点赞数 || '0'}</span>
                    <span>评论：${weibo.评论数 || '0'}</span>
                    <span>转发：${weibo.转发数 || '0'}</span>
                </div>
            `;
    
            weiboItem.innerHTML = content;
            weiboContainer.appendChild(weiboItem);
        });
    
        // 初始化懒加载
        const lazyImages = document.querySelectorAll('img.lazy, video.lazy');
        const lazyLoadObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const media = entry.target;
                    media.src = media.dataset.src;
                    media.classList.remove('lazy');
                    observer.unobserve(media);
                }
            });
        });
    
        lazyImages.forEach(img => lazyLoadObserver.observe(img));
    
        currentPage++;
        isLoading = false;
        loading.classList.remove('active');
    
        if (end >= allWeiboData.length) {
            window.removeEventListener('scroll', scrollHandler);
        }
    }

    // 设置事件监听器
    function setupEventListeners() {
        // 滚动加载
        window.addEventListener('scroll', scrollHandler);

        // 加载全部按钮
        document.getElementById('loadAllBtn').addEventListener('click', () => {
            isLazyLoadEnabled = false;
            window.removeEventListener('scroll', scrollHandler);
            while (currentPage * 50 < allWeiboData.length) {
                loadMoreWeibos();
            }
        });

        // 媒体预览
        const modal = document.getElementById('mediaModal');
        const closeBtn = document.getElementById('closeModal');
        const mediaContainer = document.getElementById('mediaContainer');

        window.showMedia = (url, type) => {
            mediaContainer.innerHTML = type === 'image' 
                ? `<img src="${url}" alt="微博图片">` 
                : `<video src="${url}" controls autoplay></video>`;
            modal.classList.add('active');
        };

        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
            mediaContainer.innerHTML = '';
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                modal.classList.remove('active');
                mediaContainer.innerHTML = '';
            }
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
                mediaContainer.innerHTML = '';
            }
        });
    }

    // 滚动处理函数
    function scrollHandler() {
        if (!isLazyLoadEnabled || isLoading) return;

        const scrollHeight = document.documentElement.scrollHeight;
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const clientHeight = window.innerHeight || document.documentElement.clientHeight;

        if (scrollHeight - scrollTop - clientHeight < 100) {
            loadMoreWeibos();
        }
    }
});
