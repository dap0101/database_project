# MIS205 Part 2 - 需求规格说明书
# "别瞎买" (Don't Buy It!) 校园生活真实红黑榜

---

## 1. 项目概述

### 1.1 单线描述
**"别瞎买" (Don't Buy It!)** —— 专属于在校大学生的校园生活"真实红黑榜"与店铺五星评分统计搜索引擎。致力于为大学生打造一个真实、可信、实名制的校园消费评价体系，彻底杜绝水军刷评，让每一位同学都能参考真实的红黑榜体验，"别瞎买"。

### 1.2 目标用户
- **核心用户**：在校大学生（本科/研究生）
- **使用场景**：日常消费决策前查询店铺真实评价、消费后分享真实体验
- **用户痛点**：现有平台水军泛滥、难以辨别真实评价、缺乏专门针对校园周边消费的真实评价体系

---

## 2. 核心实体与数据模型

### 2.1 实体关系总览

```
┌─────────────────┐         ┌─────────────────┐
│     Users       │◄────────│     Posts       │
│   (用户实体)     │   1:N   │   (帖子实体)     │
└─────────────────┘         └─────────────────┘
```

### 2.2 Users 表 - 用户实体

| 字段名 | 数据类型 | 约束 | 说明 |
|--------|----------|------|------|
| `id` | `UUID` | PRIMARY KEY, DEFAULT gen_random_uuid() | Supabase Auth 生成的唯一标识符，主键 |
| `email` | `VARCHAR(255)` | NOT NULL, UNIQUE | Supabase Auth 登录邮箱 |
| `school_name` | `VARCHAR(100)` | NOT NULL | 学校全称，如"南方科技大学" |
| `student_name` | `VARCHAR(50)` | NOT NULL | 真实姓名，与学号一致 |
| `student_id` | `VARCHAR(20)` | NOT NULL, UNIQUE | 学号，建立唯一索引彻底防止一人多号刷评 |
| `phone_or_email` | `VARCHAR(100)` | NULLABLE | 备用联系方式，手机号或备用邮箱 |
| `is_verified` | `BOOLEAN` | DEFAULT FALSE | 实名认证状态，后台审核通过后设为TRUE |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | DEFAULT NOW() | 账户创建时间 |
| `updated_at` | `TIMESTAMP WITH TIME ZONE` | DEFAULT NOW() | 信息更新时间 |

**关键设计说明：**
- 与 Supabase Auth 深度集成，`id` 字段直接对接 Supabase Auth 的 UUID
- `student_id` 建立 **UNIQUE 唯一索引**，从数据库层面彻底封杀"一人多号刷好评"的可能
- `is_verified` 字段支持后台人工审核模式，确保实名信息真实有效

### 2.3 Posts 表 - 帖子/评价实体

| 字段名 | 数据类型 | 约束 | 说明 |
|--------|----------|------|------|
| `id` | `BIGSERIAL` | PRIMARY KEY | 自增主键 |
| `user_id` | `UUID` | NOT NULL, FOREIGN KEY | 外键关联 Users.id，级联删除 |
| `shop_name` | `VARCHAR(200)` | NOT NULL | 店铺标准化名称，支持全称/常用缩写 |
| `rating` | `INTEGER` | NOT NULL, CHECK(1-5) | 星级评分，1-5整数，5星最高 |
| `title` | `VARCHAR(200)` | NOT NULL | 帖子标题，简短概括体验 |
| `content` | `TEXT` | NOT NULL | 详细正文，支持多段落描述 |
| `type` | `VARCHAR(10)` | NOT NULL, CHECK | 红榜/黑榜属性，'RED'或'BLACK' |
| `tags` | `TEXT[]` | DEFAULT '{}' | 多维分类标签数组，如['美食', '性价比'] |
| `is_anonymous` | `BOOLEAN` | DEFAULT FALSE | 是否匿名发帖（实名认证用户可选） |
| `is_deleted` | `BOOLEAN` | DEFAULT FALSE | 软删除标记，用户删除后标记而非物理删除 |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | DEFAULT NOW() | 帖子发布时间 |
| `updated_at` | `TIMESTAMP WITH TIME ZONE` | DEFAULT NOW() | 帖子更新时间 |

**关键设计说明：**
- `user_id` 外键关联 Users 表，**级联删除**：用户注销时其所有帖子自动清理
- `shop_name` + `rating` 建立**复合索引 (COMPOSITE INDEX)**，优化聚合检索性能
- `type` 字段区分红榜(RED)/黑榜(BLACK)，支持首页分区展示
- `tags` 使用 PostgreSQL 数组类型，支持多维度标签筛选
- `is_deleted` 软删除机制，保留数据完整性的同时支持用户"删除"操作

---

## 3. 核心用户流程 (User Flows)

### 3.1 实名认证与会话越权拦截流

**流程目标**：确保只有经过实名认证的真实在校生才能使用系统，防止水军刷评，同时建立坚固的会话安全机制。

**详细步骤**：

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 1: 用户访问首页                                                        │
│  ├─ 系统检测当前会话状态 (Supabase Auth Session)                             │
│  └─ 未登录用户可浏览公开内容(搜索、查看帖子)，但无法发帖/评论                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 2: 点击"登录/注册"进入认证流程                                          │
│  ├─ 系统跳转至登录页 (/login)                                                │
│  ├─ 新用户：点击注册 → 输入邮箱+密码 → Supabase Auth 创建账户                  │
│  └─ 老用户：输入邮箱+密码 → Supabase Auth 验证登录                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 3: 实名认证信息填报 (关键步骤)                                          │
│  ├─ 首次登录后，系统强制跳转至实名认证页 (/verify)                             │
│  ├─ 用户必须填写：                                                            │
│  │   ├─ school_name: 下拉选择学校（预设南方科技大学等）                          │
│  │   ├─ student_name: 输入真实姓名（与学号一致）                                │
│  │   ├─ student_id: 输入学号（如 12010001）                                    │
│  │   └─ phone_or_email: 备用联系方式                                          │
│  └─ 点击"提交认证" → 系统校验 student_id 唯一性                                │
│     ├─ 若学号已被注册 → 提示"该学号已认证，请联系管理员"                        │
│     └─ 若学号未注册 → 创建 Users 记录，is_verified = false                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 4: 等待审核与功能解锁                                                    │
│  ├─ 提交后页面显示"实名认证审核中，请耐心等待"                                │
│  ├─ 后台管理员审核通过后，设置 is_verified = true                              │
│  └─ 用户重新登录后，系统检测到 is_verified = true，解锁发帖/编辑/删除权限        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 5: 会话安全守护与越权拦截机制 (重点)                                     │
│                                                                             │
│  【场景A：正常注销流程】                                                       │
│  ├─ 用户点击"退出登录"                                                       │
│  ├─ 前端调用 Supabase Auth signOut()                                         │
│  ├─ 服务端清除 Session，前端清除本地存储                                         │
│  └─ 用户被重定向至登录页 (/login)                                              │
│                                                                             │
│  【场景B：恶意越权拦截——复制内部网址强制重定向】                                │
│  ├─ 用户A已登录，正在浏览 /post/123 (帖子详情页)                                │
│  ├─ 用户A复制当前URL，然后在浏览器中点击"退出登录"                              │
│  ├─ 用户A尝试直接访问刚才复制的 /post/123 链接 (或新开标签页粘贴访问)            │
│  ├─ 【拦截触发】                                                              │
│  │   ├─ 系统检测到当前 Session 已失效/不存在                                    │
│  │   ├─ 系统识别到用户正在尝试访问需要认证的内部页面                               │
│  │   └─ 前端路由守卫 (Route Guard) 拦截该请求                                    │
│  └─ 【强制重定向】                                                              │
│      ├─ 系统记录用户试图访问的目标路径 (如 /post/123)                             │
│      ├─ 立即重定向至登录页 (/login)                                            │
│      └─ 登录成功后，自动跳转回之前试图访问的 /post/123 (可选：记忆重定向)          │
│                                                                             │
│  【场景C：未登录直接访问受限API】                                              │
│  ├─ 攻击者尝试直接调用 POST /api/posts (创建帖子接口)                           │
│  ├─ 服务端中间件验证 JWT Token                                                │
│  ├─ Token 不存在/无效/已过期                                                   │
│  └─ 服务端返回 401 Unauthorized，拒绝请求                                        │
│                                                                             │
│  【安全设计原则总结】                                                          │
│  ├─ 前端路由守卫：所有需要认证的路由统一拦截                                     │
│  ├─ 服务端鉴权：每个API请求独立验证 JWT Token                                   │
│  ├─ 会话时效性：Session 过期后强制重新登录                                       │
│  └─ 越权防御：注销后复制内部URL强制重定向回登录页，防止未授权访问                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 店铺评分聚合检索流

**流程目标**：用户可以搜索任意店铺，系统展示该店铺的五星评分统计直方图及所有相关评价帖子。

**详细步骤**：

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 1: 用户进入搜索页                                                      │
│  ├─ 首页展示搜索框，提示文字："搜索店铺，看真实红黑榜..."                       │
│  └─ 支持热门店铺快捷标签展示                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 2: 输入店名并提交                                                      │
│  ├─ 用户在搜索框输入店铺名称（支持模糊匹配）                                   │
│  ├─ 点击"搜索"按钮提交                                                       │
│  └─ 系统接收参数：shop_name（模糊匹配）                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 3: 执行聚合统计查询 (后端核心逻辑)                                        │
│                                                                             │
│  【SQL 聚合逻辑】：                                                           │
│  ├─ 根据输入的 shop_name 模糊匹配所有相关帖子                                  │
│  ├─ 对匹配结果执行 GROUP BY rating 分组统计                                    │
│  ├─ 计算：总评价数、5星/4星/3星/2星/1星各自数量                                │
│  └─ 计算：平均分 = SUM(rating) / COUNT(*)                                    │
│                                                                             │
│  【索引优化】：                                                               │
│  ├─ 复合索引 (shop_name, rating) 加速 GROUP BY 聚合查询                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 4: 渲染统计图表与帖子列表 (前端展示)                                      │
│                                                                             │
│  【顶部统计区】：                                                              │
│  ├─ 店铺名称大标题展示                                                        │
│  ├─ 综合评分：显示平均分（如 4.2/5.0）                                         │
│  ├─ 总评价数：显示总帖子数量                                                  │
│  └─ 星级直方图：可视化展示 5星/4星/3星/2星/1星各自的数量柱状图                    │
│                                                                             │
│  【下方帖子列表】：                                                            │
│  ├─ 按时间倒序展示该店铺的所有评价帖子                                          │
│  ├─ 每条帖子展示：发布者昵称、发布时间、红/黑榜标识、星级、标题、摘要            │
│  └─ 点击帖子进入详情页查看完整内容                                              │
│                                                                             │
│  【筛选与排序】（可选扩展）：                                                   │
│  ├─ 按红黑榜类型筛选（只看红榜/只看黑榜）                                        │
│  ├─ 按星级筛选（只看5星/4星等）                                                │
│  └─ 按时间排序（最新优先/最早优先）                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

**聚合查询核心 SQL 示例**：

```sql
-- 统计某店铺的评分分布
SELECT 
    rating,
    COUNT(*) as count
FROM posts
WHERE shop_name ILIKE '%肯德基%' AND is_deleted = FALSE
GROUP BY rating
ORDER BY rating DESC;

-- 计算平均分
SELECT 
    AVG(rating) as avg_rating,
    COUNT(*) as total_count
FROM posts
WHERE shop_name ILIKE '%肯德基%' AND is_deleted = FALSE;
```

### 3.3 高精准发帖流

**流程目标**：已登录且通过实名认证的用户可以发布店铺评价，形成真实红黑榜内容。

**详细步骤**：

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 1: 用户触发发帖                                                        │
│  ├─ 场景A：用户在帖子详情页点击"写评价"按钮                                    │
│  ├─ 场景B：用户在搜索店铺后点击"去评价"                                       │
│  └─ 场景C：用户从个人中心点击"发布新评价"                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 2: 认证状态检查 (路由守卫)                                               │
│  ├─ 系统检测当前会话状态                                                       │
│  ├─ 【未登录】→ 拦截，重定向至登录页 (/login)，提示"请先登录后再发布评价"         │
│  ├─ 【已登录但未实名认证】→ 拦截，重定向至实名认证页 (/verify)，提示"请先完成实名认证"│
│  └─ 【已登录且已实名认证】→ 放行，进入发帖页面 (/post/create)                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 3: 填写发帖表单                                                          │
│                                                                             │
│  【表单字段】：                                                                │
│  ├─ 店铺名称 (shop_name):                                                     │
│  │   ├─ 输入框，支持自动补全已存在的店铺名                                      │
│  │   └─ 必填，提示"请输入店铺全称或常用缩写"                                     │
│  │                                                                            │
│  ├─ 星级评分 (rating):                                                        │
│  │   ├─ 五星评分组件（鼠标悬停高亮，点击选中）                                   │
│  │   ├─ 1星 = 极差 | 2星 = 较差 | 3星 = 一般 | 4星 = 推荐 | 5星 = 强烈推荐         │
│  │   └─ 必填，默认未选中，必须手动选择                                           │
│  │                                                                            │
│  ├─ 红黑榜类型 (type):                                                        │
│  │   ├─ 单选按钮组：○ 红榜 (推荐)  ○ 黑榜 (避坑)                               │
│  │   ├─ 红榜 = 正面推荐（4-5星）                                               │
│  │   ├─ 黑榜 = 负面避坑（1-2星）                                               │
│  │   └─ 系统可根据评分自动建议，用户可手动调整                                   │
│  │                                                                            │
│  ├─ 帖子标题 (title):                                                         │
│  │   ├─ 单行文本输入，限制 5-50 个字符                                          │
│  │   ├─ 提示："一句话概括你的体验，如：这家火锅真的绝！"                          │
│  │   └─ 必填                                                                  │
│  │                                                                            │
│  ├─ 详细正文 (content):                                                        │
│  │   ├─ 多行文本输入，限制 20-2000 个字符                                         │
│  │   ├─ 提示："详细描述你的消费体验，包括价格、环境、服务等"                       │
│  │   ├─ 支持换行分段                                                              │
│  │   └─ 必填                                                                      │
│  │                                                                               │
│  ├─ 分类标签 (tags):                                                             │
│  │   ├─ 多选标签组件                                                              │
│  │   ├─ 预设标签：美食、饮品、娱乐、购物、住宿、交通、学习、其他                   │
│  │   ├─ 支持自定义输入（输入后按回车添加）                                        │
│  │   └─ 可选，最多5个标签                                                         │
│  │                                                                               │
│  └─ 匿名发布 (is_anonymous):                                                     │
│     ├─ 复选框：☐ 匿名发布（实名认证用户可选）                                     │
│     ├─ 勾选后帖子显示为"匿名用户"而非真实姓名                                     │
│     └─ 默认不勾选，鼓励真实评价                                                   │
│                                                                                   │
│  【表单验证】：                                                                    │
│  ├─ 所有必填字段不能为空                                                          │
│  ├─ rating 必须在 1-5 之间                                                        │
│  ├─ title 长度 5-50 字符                                                          │
│  ├─ content 长度 20-2000 字符                                                     │
│  ├─ tags 最多 5 个                                                                │
│  └─ 验证失败时显示具体错误提示，高亮错误字段                                      │
└──────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 4: 提交表单并创建帖子                                                    │
│  ├─ 用户点击"发布评价"按钮                                                    │
│  ├─ 前端执行表单验证，失败则阻止提交并提示错误                                  │
│  ├─ 验证通过 → 调用 Supabase Client API                                         │
│  │   ├─ 插入 posts 表：填入 shop_name, rating, title, content, type, tags 等   │
│  │   ├─ user_id 自动从当前 Session 获取                                        │
│  │   ├─ created_at, updated_at 默认 NOW()                                       │
│  │   └─ 返回新创建的 post_id                                                    │
│  ├─ 创建成功 → 前端提示"发布成功！"，跳转至该帖子详情页 (/post/[id])             │
│  └─ 创建失败 → 显示错误提示，保留表单数据允许重新提交                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.4 帖子管理流（Update & Delete - 完整 CRUD）

**流程目标**：已登录用户可以在个人中心查看、编辑和删除自己发布的帖子，实现完整的 CRUD 操作。

**详细步骤**：

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 1: 进入个人中心                                                          │
│  ├─ 用户点击顶部导航栏"我的"或头像下拉菜单中的"个人中心"                        │
│  ├─ 系统跳转至个人中心页 (/profile)                                           │
│  └─ 页面加载时，调用 Supabase API 查询当前用户的所有帖子                        │
│      ├─ SELECT * FROM posts WHERE user_id = current_user_id                   │
│      │             AND is_deleted = FALSE                                       │
│      └─ ORDER BY created_at DESC                                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 2: 查看我的帖子列表                                                      │
│  ├─ 页面展示该用户发布的所有帖子，以卡片列表形式呈现                            │
│  ├─ 每张卡片显示：                                                              │
│  │   ├─ 店铺名称 (shop_name)                                                   │
│  │   ├─ 星级评分 (★★★★☆)                                                       │
│  │   ├─ 红黑榜标识 (红榜🔴 / 黑榜⚫)                                            │
│  │   ├─ 帖子标题 (title)                                                       │
│  │   ├─ 发布日期 (created_at)                                                   │
│  │   └─ 状态标签：已发布 / 审核中 / 已下架                                       │
│  └─ 每张卡片提供操作按钮：【编辑】和【删除】                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 3: 编辑帖子 (UPDATE 操作)                                                │
│                                                                             │
│  【触发编辑】                                                                  │
│  ├─ 用户在帖子卡片上点击【编辑】按钮                                           │
│  ├─ 系统校验：当前登录用户 = 该帖子作者 (user_id 匹配)                         │
│  ├─ 校验失败 → 提示"无权编辑他人帖子"，终止操作                                 │
│  └─ 校验成功 → 跳转至编辑页 (/post/[id]/edit)                                  │
│                                                                             │
│  【编辑页面加载】                                                              │
│  ├─ 系统根据 post_id 查询该帖子详情                                            │
│  ├─ 将所有字段预填充至编辑表单：                                                │
│  │   ├─ shop_name: 当前值，可修改                                              │
│  │   ├─ rating: 当前星级，可修改                                               │
│  │   ├─ type: 红榜/黑榜，可修改                                                │
│  │   ├─ title: 当前标题，可修改                                                  │
│  │   ├─ content: 当前正文，可修改                                                │
│  │   ├─ tags: 当前标签，可增删改                                                │
│  │   └─ is_anonymous: 是否匿名，可修改                                         │
│  └─ 页面底部显示【保存修改】和【取消】按钮                                       │
│                                                                             │
│  【提交编辑】                                                                  │
│  ├─ 用户修改字段后点击【保存修改】                                              │
│  ├─ 前端执行与发帖时相同的表单验证                                              │
│  ├─ 验证通过 → 调用 Supabase API:                                               │
│  │   UPDATE posts                                                             │
│  │   SET shop_name = ?, rating = ?, type = ?,                                 │
│  │       title = ?, content = ?, tags = ?,                                    │
│  │       is_anonymous = ?, updated_at = NOW()                                  │
│  │   WHERE id = ? AND user_id = current_user_id                                │
│  │         AND is_deleted = FALSE                                               │
│  ├─ 返回成功 → 提示"修改已保存"，跳转至帖子详情页                                │
│  └─ 返回失败 → 显示错误提示，保留表单数据                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 4: 删除帖子 (DELETE 操作 - 软删除)                                        │
│                                                                             │
│  【触发删除】                                                                  │
│  ├─ 用户在帖子卡片上点击【删除】按钮                                             │
│  ├─ 系统再次确认：弹出模态框提示"确定要删除这条评价吗？此操作不可恢复。"          │
│  └─ 用户点击【确认删除】                                                       │
│                                                                             │
│  【权限校验】                                                                  │
│  ├─ 系统校验：当前登录用户 = 该帖子作者 (user_id 匹配)                           │
│  ├─ 校验失败 → 提示"无权删除他人帖子"，终止操作                                 │
│  └─ 校验成功 → 执行软删除                                                       │
│                                                                             │
│  【执行软删除】                                                                │
│  ├─ 调用 Supabase API (软删除，非物理删除)：                                    │
│  │   UPDATE posts                                                             │
│  │   SET is_deleted = TRUE, updated_at = NOW()                                 │
│  │   WHERE id = ? AND user_id = current_user_id                                │
│  │         AND is_deleted = FALSE                                               │
│  ├─ 返回成功 → 帖子卡片从列表中移除 (或标记为"已删除")                          │
│  ├─ 提示"评价已删除"                                                          │
│  └─ 刷新帖子列表，已删除帖子不再显示                                            │
│                                                                             │
│  【软删除设计说明】                                                            │
│  ├─ 物理删除风险高，一旦误删无法恢复                                            │
│  ├─ 软删除保留数据完整性，支持审计追踪                                          │
│  ├─ 用户视角：帖子"消失"，实现删除效果                                          │
│  └─ 管理视角：可在后台查看已删除内容，支持违规内容追溯                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. 数据库 Schema SQL (PostgreSQL)

以下 SQL 脚本可直接在 **Supabase SQL Editor** 中执行，创建完整的数据库结构。

```sql
-- =====================================================
-- "别瞎买" (Don't Buy It!) - 数据库初始化脚本
-- 适用环境: Supabase PostgreSQL
-- 创建时间: 2026-05-21
-- =====================================================

-- 启用 UUID 扩展（如未启用）
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. Users 表 - 用户实体
-- 与 Supabase Auth 对接，存储扩展实名信息
-- =====================================================
CREATE TABLE users (
    -- 主键：与 Supabase Auth 的 UUID 对应
    id UUID PRIMARY KEY,
    
    -- 邮箱（与 Supabase Auth 同步）
    email VARCHAR(255) NOT NULL,
    
    -- 学校名称
    school_name VARCHAR(100) NOT NULL,
    
    -- 真实姓名
    student_name VARCHAR(50) NOT NULL,
    
    -- 学号（建立唯一索引，彻底封杀一人多号刷评）
    student_id VARCHAR(20) NOT NULL,
    
    -- 备用联系方式
    phone_or_email VARCHAR(100),
    
    -- 实名认证状态（后台审核后设为TRUE）
    is_verified BOOLEAN DEFAULT FALSE,
    
    -- 账户创建时间
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 信息更新时间
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 约束定义
    CONSTRAINT users_email_unique UNIQUE (email),
    CONSTRAINT users_student_id_unique UNIQUE (student_id),
    CONSTRAINT users_student_id_check CHECK (student_id ~ '^[A-Za-z0-9]+$')
);

-- Users 表索引
CREATE INDEX idx_users_school ON users(school_name);
CREATE INDEX idx_users_verified ON users(is_verified);
CREATE INDEX idx_users_created_at ON users(created_at);

-- 创建 updated_at 自动更新触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 2. Posts 表 - 帖子/评价实体
-- 存储用户对店铺的评价内容
-- =====================================================
CREATE TABLE posts (
    -- 自增主键
    id BIGSERIAL PRIMARY KEY,
    
    -- 外键：发布者用户ID
    user_id UUID NOT NULL,
    
    -- 店铺名称（标准化全称/缩写）
    shop_name VARCHAR(200) NOT NULL,
    
    -- 星级评分（1-5整数）
    rating INTEGER NOT NULL,
    
    -- 帖子标题
    title VARCHAR(200) NOT NULL,
    
    -- 详细正文
    content TEXT NOT NULL,
    
    -- 红黑榜类型：'RED' = 红榜(推荐), 'BLACK' = 黑榜(避坑)
    type VARCHAR(10) NOT NULL,
    
    -- 多维分类标签数组
    tags TEXT[] DEFAULT '{}',
    
    -- 是否匿名发布
    is_anonymous BOOLEAN DEFAULT FALSE,
    
    -- 软删除标记
    is_deleted BOOLEAN DEFAULT FALSE,
    
    -- 帖子发布时间
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 帖子更新时间
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 外键约束：级联删除，用户注销时自动清理其所有帖子
    CONSTRAINT fk_posts_user_id
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE,
    
    -- 星级评分范围约束
    CONSTRAINT posts_rating_check 
        CHECK (rating >= 1 AND rating <= 5),
    
    -- 红黑榜类型约束
    CONSTRAINT posts_type_check 
        CHECK (type IN ('RED', 'BLACK'))
);

-- Posts 表关键索引
-- 复合索引：优化按店铺名聚合统计评分的查询性能
CREATE INDEX idx_posts_shop_rating ON posts(shop_name, rating);

-- 其他常用查询索引
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_posts_type ON posts(type);
CREATE INDEX idx_posts_is_deleted ON posts(is_deleted);

-- 标签数组 GIN 索引（用于标签筛选查询）
CREATE INDEX idx_posts_tags ON posts USING GIN(tags);

-- 店铺名模糊搜索索引（使用 pg_trgm 扩展）
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_posts_shop_name_trgm ON posts USING GIN(shop_name gin_trgm_ops);

-- Posts 表 updated_at 自动更新触发器
CREATE TRIGGER update_posts_updated_at
    BEFORE UPDATE ON posts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 3. 视图：店铺评分统计（可选优化）
-- 预聚合店铺评分数据，加速首页热门店铺展示
-- =====================================================
CREATE VIEW shop_rating_stats AS
SELECT 
    shop_name,
    COUNT(*) as total_reviews,
    AVG(rating) as avg_rating,
    COUNT(*) FILTER (WHERE rating = 5) as five_star_count,
    COUNT(*) FILTER (WHERE rating = 4) as four_star_count,
    COUNT(*) FILTER (WHERE rating = 3) as three_star_count,
    COUNT(*) FILTER (WHERE rating = 2) as two_star_count,
    COUNT(*) FILTER (WHERE rating = 1) as one_star_count,
    MAX(created_at) as last_review_date
FROM posts
WHERE is_deleted = FALSE
GROUP BY shop_name;

-- 为统计视图创建索引（物化视图时更有用）
CREATE INDEX idx_posts_shop_name ON posts(shop_name);

-- =====================================================
-- 4. Row Level Security (RLS) 策略
-- 启用行级安全，确保用户只能访问/修改自己的数据
-- =====================================================

-- Users 表 RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的完整信息
CREATE POLICY users_select_own ON users
    FOR SELECT
    USING (id = auth.uid());

-- 用户只能更新自己的信息
CREATE POLICY users_update_own ON users
    FOR UPDATE
    USING (id = auth.uid());

-- Posts 表 RLS
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- 所有人可以查看未被删除的帖子
CREATE POLICY posts_select_all ON posts
    FOR SELECT
    USING (is_deleted = FALSE);

-- 用户只能创建自己的帖子（通过触发器确保 user_id = auth.uid()）
CREATE POLICY posts_insert_own ON posts
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- 用户只能更新自己的帖子
CREATE POLICY posts_update_own ON posts
    FOR UPDATE
    USING (user_id = auth.uid());

-- 用户只能删除（软删除）自己的帖子
CREATE POLICY posts_delete_own ON posts
    FOR DELETE
    USING (user_id = auth.uid());

-- =====================================================
-- 初始化完成
-- =====================================================

COMMENT ON TABLE users IS '用户表，存储实名认证信息，与Supabase Auth集成';
COMMENT ON TABLE posts IS '帖子表，存储用户对店铺的评价内容';
COMMENT ON VIEW shop_rating_stats IS '店铺评分统计视图，预聚合各店铺的评分数据';

-- 验证安装
SELECT 'Database schema created successfully!' as status;
```

---

## 5. 技术架构说明

### 5.1 技术栈选型

| 层级 | 技术/服务 | 说明 |
|------|-----------|------|
| **前端** | HTML5 + CSS3 + Vanilla JS | 原生实现，轻量高效，无需构建工具 |
| **后端/数据库** | Supabase (PostgreSQL) | BaaS 后端，内置 Auth + 实时订阅 |
| **认证** | Supabase Auth | 邮箱+密码登录，JWT Token 会话管理 |
| **部署** | GitHub Pages / Vercel | 静态托管，免费且访问稳定 |

### 5.2 安全设计要点

1. **实名认证防火墙**：`is_verified` 字段控制发帖权限，未实名用户只能浏览
2. **学号唯一性约束**：数据库层 `UNIQUE` 索引彻底杜绝多号刷评
3. **RLS 行级安全**：用户只能操作自己的数据，即使 SQL 注入也无法越权
4. **软删除机制**：`is_deleted` 标记保护数据完整性，支持审计追溯
5. **会话越权拦截**：注销后复制内部 URL 强制重定向至登录页，防止未授权访问

---

## 6. 文档变更记录

| 版本 | 日期 | 修改内容 | 作者 |
|------|------|----------|------|
| v1.0 | 2026-05-21 | 初始版本，完整定义需求、实体、用户流、Schema | 同学A |

---

**文档结束**
