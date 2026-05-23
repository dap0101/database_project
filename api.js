/**
 * ============================================================
 * "别瞎买" (Don't Buy It!) - 数据交互与聚合引擎模块
 * ============================================================
 *
 * 本模块作为后端与数据聚合核心,通过纯前端 JavaScript 直接调用
 * Supabase 客户端 SDK 实现所有数据交互功能。
 *
 * 核心功能:
 * 1. fetchShopStats(shopName) - 店铺评分级直方图聚合查询
 * 2. fetchShopPosts(shopName) - 获取店铺详细帖子列表
 * 3. createPost(postData) - 高精准发帖入库
 *
 * @author 同学A(后端与数据聚合负责人)
 * @branch feat/backend-api-integration
 * @date 2026-05-22
 * ============================================================
 */

// ============================================================
// 模块依赖:Supabase 客户端实例
// ============================================================
// 注意:本项目在全局作用域中通过 supabaseClient 变量注入已配置好的
// Supabase 客户端实例。该实例已完成 Auth 配置,可直接使用。
//
// 使用前请确保已在 HTML 中引入:
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
// 并在全局初始化:window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ============================================================
// 错误处理工具函数
// ============================================================

/**
 * 统一的错误包装器
 * 将 Supabase 错误转换为统一的错误对象,便于前端统一处理
 *
 * @param {Error} error - Supabase 返回的原始错误
 * @param {string} context - 错误发生的上下文描述
 * @returns {Error} 包装后的错误对象
 */
function wrapError(error, context) {
  const wrappedError = new Error(`[${context}] ${error.message || '未知错误'}`);
  wrappedError.originalError = error;
  wrappedError.context = context;
  wrappedError.code = error.code || 'UNKNOWN_ERROR';
  return wrappedError;
}

/**
 * 会话状态检查
 * 检查当前是否存在有效的用户会话
 *
 * @returns {Promise<{session: Object|null, user: Object|null}>} 会话信息
 */
/**
 * 会话状态检查
 */
async function checkSession() {
  try {
    // 彻底抛弃 supabase，直接用 window.supabaseClient
    const { data: { session }, error } = await window.supabaseClient.auth.getSession();
    if (error) throw error;

    const { data: { user } } = await window.supabaseClient.auth.getUser();

    return { session, user };
  } catch (error) {
    console.error('会话检查失败:', error);
    return { session: null, user: null };
  }
}

// ============================================================
// 功能 1: 店铺评分级直方图聚合查询
// ============================================================

/**
 * 获取店铺评分统计数据(直方图聚合)
 *
 * 本函数首先尝试从预聚合的 shop_rating_stats 视图中获取数据。
 * 如果视图不存在或查询失败,则回退到对 posts 表进行实时聚合查询。
 *
 * 返回的数据格式专为同学B的前端直方图组件设计,可直接绑定到图表库。
 *
 * @param {string} shopName - 店铺标准化名称(如"麦当劳")
 * @returns {Promise<Object>} 店铺评分统计数据对象,结构如下:
 *   {
 *     shop_name: string,        // 店铺名称
 *     total_reviews: number,    // 总评价数
 *     avg_rating: number,       // 平均星级(保留2位小数)
 *     histogram: {               // 星级分布直方图数据
 *       five_star: number,      // 5星评价数
 *       four_star: number,      // 4星评价数
 *       three_star: number,     // 3星评价数
 *       two_star: number,       // 2星评价数
 *       one_star: number        // 1星评价数
 *     },
 *     raw_data: Object|null     // 原始查询数据(调试用)
 *   }
 * @throws {Error} 当查询失败时抛出错误
 *
 * @example
 * const stats = await fetchShopStats('麦当劳');
 * console.log(`麦当劳平均评分: ${stats.avg_rating}`);
 * console.log(`5星好评数: ${stats.histogram.five_star}`);
 */
async function fetchShopStats(shopName) {
  // 参数校验
  if (!shopName || typeof shopName !== 'string') {
    throw new Error('[fetchShopStats] 店铺名称参数无效,必须提供非空字符串');
  }

  // 标准化店铺名称(去除首尾空格)
  const normalizedShopName = shopName.trim();

  if (normalizedShopName.length === 0) {
    throw new Error('[fetchShopStats] 店铺名称不能为空');
  }

  try {
    // 策略 A: 优先查询预聚合视图，直接使用 window.supabaseClient
    const { data: viewData, error: viewError } = await window.supabaseClient
      .from('shop_rating_stats')
      .select('*')
      .eq('shop_name', normalizedShopName)
      .single();

    if (!viewError && viewData) {
      return formatStatsResponse(viewData, normalizedShopName, true);
    }

    console.warn(`[fetchShopStats] 视图查询未返回数据,回退到实时聚合查询: ${normalizedShopName}`);

    // 策略 B: 回退到实时聚合查询，直接使用 window.supabaseClient
    const { data: aggData, error: aggError } = await window.supabaseClient
      .from('posts')
      .select('rating')
      .eq('shop_name', normalizedShopName)
      .eq('is_deleted', false);

    if (aggError) throw aggError;

    // 手动计算统计数据
    const stats = calculateStatsFromRawData(aggData || [], normalizedShopName);
    return formatStatsResponse(stats, normalizedShopName, false);

  } catch (error) {
    console.error('[fetchShopStats] 查询失败:', error);
    throw wrapError(error, 'fetchShopStats');
  }
}

/**
 * 从原始评分数据计算统计指标
 * @private
 */
function calculateStatsFromRawData(ratings, shopName) {
  const totalReviews = ratings.length;

  if (totalReviews === 0) {
    return {
      shop_name: shopName,
      total_reviews: 0,
      avg_rating: 0,
      five_star_count: 0,
      four_star_count: 0,
      three_star_count: 0,
      two_star_count: 0,
      one_star_count: 0
    };
  }

  // 统计各星级数量
  const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let sum = 0;

  for (const row of ratings) {
    const rating = row.rating;
    if (counts[rating] !== undefined) {
      counts[rating]++;
      sum += rating;
    }
  }

  return {
    shop_name: shopName,
    total_reviews: totalReviews,
    avg_rating: parseFloat((sum / totalReviews).toFixed(2)),
    five_star_count: counts[5],
    four_star_count: counts[4],
    three_star_count: counts[3],
    two_star_count: counts[2],
    one_star_count: counts[1]
  };
}

/**
 * 格式化统计响应对象
 * @private
 */
function formatStatsResponse(rawData, shopName, fromView) {
  return {
    shop_name: rawData.shop_name || shopName,
    total_reviews: parseInt(rawData.total_reviews) || 0,
    avg_rating: parseFloat(rawData.avg_rating) || 0,
    histogram: {
      five_star: parseInt(rawData.five_star_count) || 0,
      four_star: parseInt(rawData.four_star_count) || 0,
      three_star: parseInt(rawData.three_star_count) || 0,
      two_star: parseInt(rawData.two_star_count) || 0,
      one_star: parseInt(rawData.one_star_count) || 0
    },
    // 原始数据(调试用,生产环境可移除)
    raw_data: null,
    // 数据来源标记
    _meta: {
      from_view: fromView,
      timestamp: new Date().toISOString()
    }
  };
}

// ============================================================
// 功能 2: 获取店铺详细帖子列表
// ============================================================

/**
 * 获取指定店铺的详细帖子列表
 *
 * 本函数按创建时间倒序返回指定店铺的所有有效(未软删除)帖子。
 * 对于匿名帖子,自动处理用户信息脱敏,隐藏真实身份。
 *
 * @param {string} shopName - 店铺标准化名称
 * @param {Object} options - 可选配置参数
 * @param {number} options.limit - 返回最大数量(默认 100,最大 1000)
 * @param {number} options.offset - 分页偏移量(默认 0)
 * @param {string} options.orderBy - 排序字段(默认 'created_at')
 * @param {string} options.orderDirection - 排序方向 'asc'|'desc'(默认 'desc')
 * @returns {Promise<Object>} 帖子列表响应对象,结构如下:
 *   {
 *     data: Array<{
 *       id: number,              // 帖子ID
 *       user_id: string|null,    // 用户ID(匿名时为 null)
 *       author_name: string,     // 显示的作者名称
 *       shop_name: string,       // 店铺名称
 *       rating: number,          // 星级评分 1-5
 *       title: string,           // 帖子标题
 *       content: string,         // 帖子正文
 *       type: 'RED'|'BLACK',     // 红黑榜类型
 *       tags: string[],         // 标签数组
 *       is_anonymous: boolean,   // 是否匿名
 *       created_at: string,      // 创建时间 ISO 格式
 *       updated_at: string       // 更新时间 ISO 格式
 *     }>,
 *     pagination: {
 *       total: number,          // 总帖子数
 *       limit: number,          // 当前限制数
 *       offset: number,         // 当前偏移量
 *       hasMore: boolean      // 是否还有更多
 *     },
 *     meta: {
 *       shop_name: string,
 *       fetched_at: string
 *     }
 *   }
 * @throws {Error} 当查询失败时抛出错误
 *
 * @example
 * // 基础用法
 * const result = await fetchShopPosts('麦当劳');
 * console.log(`共找到 ${result.pagination.total} 条评价`);
 * result.data.forEach(post => {
 *   console.log(`${post.author_name}: ${post.title}`);
 * });
 *
 * // 分页加载
 * const page2 = await fetchShopPosts('麦当劳', {
 *   limit: 20,
 *   offset: 20
 * });
 */
async function fetchShopPosts(shopName, options = {}) {
  // 参数校验
  if (!shopName || typeof shopName !== 'string') {
    throw new Error('[fetchShopPosts] 店铺名称参数无效,必须提供非空字符串');
  }

  const normalizedShopName = shopName.trim();
  if (normalizedShopName.length === 0) {
    throw new Error('[fetchShopPosts] 店铺名称不能为空');
  }

  // 解析配置参数
  const {
    limit = 100,
    offset = 0,
    orderBy = 'created_at',
    orderDirection = 'desc'
  } = options;

  // 安全校验分页参数
  const safeLimit = Math.min(Math.max(parseInt(limit) || 100, 1), 1000);
  const safeOffset = Math.max(parseInt(offset) || 0, 0);
  const safeOrderDirection = orderDirection.toLowerCase() === 'asc' ? 'asc' : 'desc';

  try {
    // 步骤 1: 查询符合条件的帖子总数，直接使用 window.supabaseClient
    const { count: totalCount, error: countError } = await window.supabaseClient
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('shop_name', normalizedShopName)
      .eq('is_deleted', false);

    if (countError) throw countError;

    const selectFields = `
      id,
      user_id,
      shop_name,
      rating,
      title,
      content,
      type,
      tags,
      is_anonymous,
      created_at,
      updated_at
    `;

    // 步骤 2: 查询帖子列表数据，直接使用 window.supabaseClient
    const { data: posts, error: postsError } = await window.supabaseClient
      .from('posts')
      .select(selectFields)
      .eq('shop_name', normalizedShopName)
      .eq('is_deleted', false)
      .order(orderBy, { ascending: safeOrderDirection === 'asc' })
      .range(safeOffset, safeOffset + safeLimit - 1);

    if (postsError) throw postsError;

    // 收集所有需要查询 user_id
    const userIdsToFetch = [];
    for (const post of (posts || [])) {
      if (!post.is_anonymous && post.user_id) {
        userIdsToFetch.push(post.user_id);
      }
    }

    // 批量查询用户信息，直接使用 window.supabaseClient
    const userInfoMap = new Map();
    if (userIdsToFetch.length > 0) {
      const { data: users, error: userError } = await window.supabaseClient
        .from('users')
        .select('id, student_name')
        .in('id', userIdsToFetch);

      if (!userError && users) {
        for (const user of users) {
          userInfoMap.set(user.id, user.student_name || '未知用户');
        }
      }
    }
    // =====================================================
    // 步骤 4: 组装最终响应数据
    // =====================================================
    const formattedPosts = (posts || []).map(post => {
      // 处理匿名逻辑
      let authorName;
      let displayUserId;

      if (post.is_anonymous) {
        // 匿名帖子:隐藏真实身份
        authorName = '某不愿透露姓名的校友';
        displayUserId = null;
      } else {
        // 实名帖子:显示学生姓名
        authorName = userInfoMap.get(post.user_id) || '未知用户';
        displayUserId = post.user_id;
      }

      return {
        id: post.id,
        user_id: displayUserId,
        author_name: authorName,
        shop_name: post.shop_name,
        rating: post.rating,
        title: post.title,
        content: post.content,
        type: post.type,
        tags: post.tags || [],
        is_anonymous: post.is_anonymous,
        created_at: post.created_at,
        updated_at: post.updated_at
      };
    });

    // 组装分页信息
    const total = totalCount || 0;
    const hasMore = safeOffset + safeLimit < total;

    return {
      data: formattedPosts,
      pagination: {
        total: total,
        limit: safeLimit,
        offset: safeOffset,
        hasMore: hasMore
      },
      meta: {
        shop_name: normalizedShopName,
        fetched_at: new Date().toISOString()
      }
    };

  } catch (error) {
    console.error('[fetchShopPosts] 查询失败:', error);
    throw wrapError(error, 'fetchShopPosts');
  }
}

// ============================================================
// 功能 3: 高精准发帖入库
// ============================================================

/**
 * 创建新帖子（高精准发帖入库）
 *
 * 本函数实现了完整的帖子创建流程，严格遵循以下安全原则：
 * 1. user_id 必须通过当前登录会话的 auth.uid() 动态获取，禁止前端传参伪造
 * 2. 所有字段严格校验，确保符合 schema.sql 的约束定义
 * 3. 利用 Supabase RLS 策略进行双重权限校验
 *
 * 发帖成功后，可选择自动更新 shop_rating_stats 视图关联的聚合数据
 * （由于 shop_rating_stats 是动态视图，数据会自动保持最新，无需手动更新）
 *
 * @param {Object} postData - 帖子数据对象
 * @param {string} postData.shop_name - 店铺名称（必填，1-200字符）
 * @param {number} postData.rating - 星级评分（必填，1-5整数）
 * @param {string} postData.title - 帖子标题（必填，1-200字符）
 * @param {string} postData.content - 详细正文（必填，非空）
 * @param {string} postData.type - 红黑榜类型（必填，'RED'|'BLACK'）
 * @param {string[]} [postData.tags] - 分类标签数组（可选，默认空数组）
 * @param {boolean} [postData.is_anonymous] - 是否匿名发布（可选，默认false）
 * @returns {Promise<Object>} 创建结果对象，结构如下：
 *   {
 *     success: true,              // 操作是否成功
 *     data: {
 *       id: number,               // 新创建的帖子ID
 *       user_id: string,          // 发布者用户ID
 *       shop_name: string,      // 店铺名称
 *       rating: number,         // 星级
 *       title: string,          // 标题
 *       content: string,        // 内容
 *       type: string,           // 类型
 *       tags: string[],         // 标签
 *       is_anonymous: boolean,  // 是否匿名
 *       created_at: string,     // 创建时间
 *       updated_at: string      // 更新时间
 *     },
 *     message: '帖子发布成功！'   // 提示信息
 *   }
 * @throws {Error} 当验证失败或数据库操作失败时抛出错误
 *
 * @example
 * // 标准发帖示例
 * const result = await createPost({
 *   shop_name: '麦当劳（南科大店）',
 *   rating: 5,
 *   title: '这家麦当劳真的绝！',
 *   content: '服务态度超好，汉堡现做现卖，薯条永远脆脆的...',
 *   type: 'RED',
 *   tags: ['美食', '快餐', '性价比高'],
 *   is_anonymous: false
 * });
 * console.log('新帖子ID:', result.data.id);
 *
 * // 匿名黑榜发帖示例
 * const result = await createPost({
 *   shop_name: '某黑店',
 *   rating: 1,
 *   title: '严重踩雷！',
 *   content: '食材不新鲜，吃完就拉肚子...',
 *   type: 'BLACK',
 *   is_anonymous: true
 * });
 */
async function createPost(postData) {
  try {
  // =====================================================
  // 步骤 1: 严格参数校验
  // =====================================================
  if (!postData || typeof postData !== 'object') {
    throw new Error('[createPost] 帖子数据不能为空');
  }

  // 定义必需字段及其校验规则
  const requiredFields = [
    { key: 'shop_name', type: 'string', minLength: 1, maxLength: 200 },
    { key: 'rating', type: 'number', min: 1, max: 5, integer: true },
    { key: 'title', type: 'string', minLength: 1, maxLength: 200 },
    { key: 'content', type: 'string', minLength: 1 },
    { key: 'type', type: 'string', allowed: ['RED', 'BLACK'] }
  ];

  // 执行字段校验
  for (const field of requiredFields) {
    const value = postData[field.key];

    // 检查必填
    if (value === undefined || value === null) {
      throw new Error(`[createPost] 缺少必需字段: ${field.key}`);
    }

    // 类型校验
    if (field.type === 'string' && typeof value !== 'string') {
      throw new Error(`[createPost] 字段 ${field.key} 必须是字符串类型`);
    }
    if (field.type === 'number' && (typeof value !== 'number' || isNaN(value))) {
      throw new Error(`[createPost] 字段 ${field.key} 必须是有效数字`);
    }

    // 字符串长度校验
    if (field.type === 'string' && field.minLength !== undefined) {
      if (value.trim().length < field.minLength) {
        throw new Error(`[createPost] 字段 ${field.key} 至少需要 ${field.minLength} 个字符`);
      }
    }
    if (field.type === 'string' && field.maxLength !== undefined) {
      if (value.length > field.maxLength) {
        throw new Error(`[createPost] 字段 ${field.key} 最多允许 ${field.maxLength} 个字符`);
      }
    }

    // 数字范围校验
    if (field.type === 'number') {
      if (field.min !== undefined && value < field.min) {
        throw new Error(`[createPost] 字段 ${field.key} 最小值为 ${field.min}`);
      }
      if (field.max !== undefined && value > field.max) {
        throw new Error(`[createPost] 字段 ${field.key} 最大值为 ${field.max}`);
      }
      if (field.integer && !Number.isInteger(value)) {
        throw new Error(`[createPost] 字段 ${field.key} 必须是整数`);
      }
    }

    // 枚举值校验
    if (field.allowed && !field.allowed.includes(value)) {
      throw new Error(`[createPost] 字段 ${field.key} 必须是以下值之一: ${field.allowed.join(', ')}`);
    }
  }

  // 可选字段校验
  const tags = postData.tags;
  if (tags !== undefined && !Array.isArray(tags)) {
    throw new Error('[createPost] 字段 tags 必须是数组类型');
  }
  if (Array.isArray(tags) && tags.length > 5) {
    throw new Error('[createPost] 标签数量不能超过 5 个');
  }

  const isAnonymous = postData.is_anonymous;
  if (isAnonymous !== undefined && typeof isAnonymous !== 'boolean') {
    throw new Error('[createPost] 字段 is_anonymous 必须是布尔类型');
  }

  // =====================================================
  // 步骤 2: 获取当前登录用户 ID（核心安全校验）
  // =====================================================
  const { session, user } = await checkSession();

  if (!session || !user) {
    throw new Error('[createPost] 用户未登录，无法发布帖子。请先登录。');
  }

  // 从 Supabase Auth 获取用户 UUID
  const currentUserId = user.id;

  if (!currentUserId) {
    throw new Error('[createPost] 无法获取当前用户 ID，请重新登录。');
  }

  // 额外校验：检查用户是否已完成实名认证
  // 注意：此处的校验仅作为前端辅助，真正的权限控制由 RLS 策略执行
  try {
    const { data: userInfo, error: userError } = await window.supabaseClient
      .from('users')
      .select('is_verified')
      .eq('id', currentUserId)
      .single();

    if (!userError && userInfo && !userInfo.is_verified) {
      console.warn('[createPost] 警告：用户未完成实名认证，发帖可能因 RLS 策略被拒绝');
      // 注意：此处不阻止发帖，让 RLS 策略决定是否真正允许插入
    }
  } catch (verifyError) {
    // 校验失败不阻止主流程，依赖 RLS 做最终控制
    console.warn('[createPost] 实名认证校验失败:', verifyError);
  }

  // =====================================================
  // 步骤 3: 组装插入数据
  // =====================================================
  const insertData = {
    user_id: currentUserId,  // 强制从 session 获取，禁止前端伪造
    shop_name: postData.shop_name.trim(),
    rating: postData.rating,
    title: postData.title.trim(),
    content: postData.content.trim(),
    type: postData.type,
    tags: postData.tags || [],
    is_anonymous: postData.is_anonymous || false,
    // is_deleted 默认为 false，created_at/updated_at 由数据库自动设置
  };

  // =====================================================
  // 步骤 4: 执行数据库插入
  // =====================================================
  const { data: insertedPost, error: insertError } = await window.supabaseClient
    .from('posts')
    .insert(insertData)
    .select();

  if (insertError) {
    throw wrapError(insertError, 'createPost - 数据库插入失败');
  }

  if (!insertedPost || insertedPost.length === 0) {
    throw new Error('[createPost] 帖子创建失败：数据库返回空结果');
  }

  return {
    success: true,
    data: insertedPost[0],
    message: '帖子发布成功！'
  };

} catch (error) {
  console.error('[createPost] 发帖失败:', error);
  throw wrapError(error, 'createPost');
}
}

// ============================================================
// 功能 4: 获取当前登录用户的所有帖子（个人中心用）
// ============================================================

/**
 * 获取当前登录用户的所有帖子列表
 *
 * @param {Object} options - 可选配置参数
 * @param {number} options.limit - 返回最大数量(默认 50)
 * @param {number} options.offset - 分页偏移量(默认 0)
 * @returns {Promise<Object>} 用户帖子列表响应对象
 */
async function fetchUserPosts(options = {}) {
  try {
    // 获取当前会话
    const { session, user } = await checkSession();
    if (!session || !user) {
      throw new Error('[fetchUserPosts] 用户未登录');
    }

    const { limit = 50, offset = 0 } = options;
    const safeLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 100);
    const safeOffset = Math.max(parseInt(offset) || 0, 0);

    const { data: posts, error, count } = await window.supabaseClient
      .from('posts')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .range(safeOffset, safeOffset + safeLimit - 1);

    if (error) throw error;

    return {
      data: posts || [],
      pagination: {
        total: count || 0,
        limit: safeLimit,
        offset: safeOffset,
        hasMore: (safeOffset + safeLimit) < (count || 0)
      },
      meta: {
        fetched_at: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('[fetchUserPosts] 查询失败:', error);
    throw wrapError(error, 'fetchUserPosts');
  }
}

// ============================================================
// 功能 5: 软删除帖子（将 is_deleted 设为 true）
// ============================================================

/**
 * 软删除指定帖子（仅限帖子作者或管理员）
 *
 * @param {number} postId - 要删除的帖子ID
 * @returns {Promise<Object>} 删除结果
 */
async function deletePost(postId) {
  try {
    if (!postId || typeof postId !== 'number') {
      throw new Error('[deletePost] 无效的帖子ID');
    }

    // 获取当前会话验证权限
    const { session, user } = await checkSession();
    if (!session || !user) {
      throw new Error('[deletePost] 用户未登录，无法删除帖子');
    }

    // 先查询帖子确认作者身份
    const { data: post, error: fetchError } = await window.supabaseClient
      .from('posts')
      .select('user_id')
      .eq('id', postId)
      .single();

    if (fetchError) throw fetchError;
    if (!post) throw new Error('[deletePost] 帖子不存在');

    // 权限校验：只能删除自己的帖子
    if (post.user_id !== user.id) {
      throw new Error('[deletePost] 无权删除：只能删除自己发布的帖子');
    }

    // 执行软删除
    const { error: updateError } = await window.supabaseClient
      .from('posts')
      .update({ 
        is_deleted: true, 
        updated_at: new Date().toISOString(),
        user_id: user.id   // 👈 【核弹级修复】：强行塞入 user_id，满足底层的 WITH CHECK 胃口！
      })
      .eq('id', postId);

    if (updateError) throw updateError;

    return {
      success: true,
      message: '帖子删除成功',
      deleted_post_id: postId
    };
  } catch (error) {
    console.error('[deletePost] 删除失败:', error);
    throw wrapError(error, 'deletePost');
  }
}

// ============================================================
// 功能 6: 更新帖子内容（U - Update）
// ============================================================

/**
 * 更新指定帖子的内容（仅限帖子作者）
 *
 * @param {number} postId - 要更新的帖子ID
 * @param {Object} updateData - 更新的数据对象
 * @returns {Promise<Object>} 更新结果
 */
async function updatePost(postId, updateData) {
  try {
    if (!postId || typeof postId !== 'number') {
      throw new Error('[updatePost] 无效的帖子ID');
    }
    if (!updateData || typeof updateData !== 'object') {
      throw new Error('[updatePost] 更新数据不能为空');
    }

    // 获取当前会话
    const { session, user } = await checkSession();
    if (!session || !user) {
      throw new Error('[updatePost] 用户未登录');
    }

    // 查询帖子并验证作者身份
    const { data: post, error: fetchError } = await window.supabaseClient
      .from('posts')
      .select('user_id')
      .eq('id', postId)
      .single();

    if (fetchError) throw fetchError;
    if (!post) throw new Error('[updatePost] 帖子不存在');
    if (post.user_id !== user.id) {
      throw new Error('[updatePost] 无权更新：只能修改自己发布的帖子');
    }

    // 构建允许的更新字段（白名单机制）
    const allowedFields = ['title', 'content', 'rating', 'type', 'tags', 'is_anonymous'];
    const sanitizedData = {};
    
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        sanitizedData[field] = updateData[field];
      }
    }

    // 自动更新 updated_at 时间戳
    sanitizedData.updated_at = new Date().toISOString();

    // 执行更新
    const { data: updatedPost, error: updateError } = await window.supabaseClient
      .from('posts')
      .update(sanitizedData)
      .eq('id', postId)
      .select();

    if (updateError) throw updateError;

    return {
      success: true,
      data: updatedPost[0],
      message: '帖子更新成功'
    };
  } catch (error) {
    console.error('[updatePost] 更新失败:', error);
    throw wrapError(error, 'updatePost');
  }
}

window.fetchShopStats = fetchShopStats;
window.fetchShopPosts = fetchShopPosts;
window.createPost = createPost;
window.fetchUserPosts = fetchUserPosts;
window.deletePost = deletePost;
window.updatePost = updatePost;
