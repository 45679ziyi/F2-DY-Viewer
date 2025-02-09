# F2_DY_Viewer - F2 DY内容查看器

一个简单的DY内容本地查看工具，支持浏览下载的抖音视频、图片和直播回放。

> **免责声明**：本项目仅用于本地数据展示，与F2无任何关联。项目的唯一目的是提供一个简单的本地媒体文件浏览工具。

## 主要功能

### 内容浏览
- 支持四种浏览模式：
  - 作品模式：查看用户发布的作品
  - 内容模式：浏览收藏的内容
  - 喜欢模式：查看点赞过的内容
  - 合集模式：浏览合集内容

### 文件管理
- 支持文件夹拖拽导入
- 自动识别douyin文件夹结构
- 按账号分类展示内容

### 媒体查看
- 支持图片、视频
- 媒体文件全屏预览
- 视频播放器支持基本控制功能
- 支持随机浏览功能：
  - 随机查看图片或视频内容
  - 使用方向键浏览历史记录
  - 显示媒体来源信息（账号、类型）

### 界面特性
- 响应式布局设计
- 支持明暗主题切换
- 支持分页加载和一键加载全部内容
- 按时间顺序展示并分组

## 使用说明

1. 选择文件夹
   - 点击「选择文件夹」按钮
   - 或直接拖拽文件夹到页面

2. 选择浏览模式
   - 点击顶部导航栏选择需要的浏览模式

3. 查看内容
   - 从左侧账号列表选择要查看的账号
   - 内容区域会显示该账号下的所有媒体文件
   - 点击媒体缩略图可以全屏查看

4. 其他功能
   - 点击「切换主题」可以在明暗主题间切换
   - 点击「加载全部」可以一次性加载所有内容

## 技术特点

- 使用原生JavaScript开发，无需任何框架
- 采用File System Access API实现文件系统访问
- 支持媒体文件异步加载和懒加载
- 使用LocalStorage保存主题设置
