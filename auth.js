/**
 * ============================================
 * auth.js - 实名认证底层通信模块
 * ============================================
 * 
 * 功能：处理用户注册、实名信息写入、异常处理
 * 依赖：Supabase CDN 引入的 supabaseClient
 * 规范：严格遵循 spec.md 定义的字段名和流程
 */

/**
 * 使用 Supabase 克隆客户端进行实名认证注册
 * 
 * @param {Object} authData - 认证基础信息
 * @param {string} authData.email - 用户邮箱
 * @param {string} authData.password - 用户密码
 * @param {Object} realNameData - 实名认证信息（严格遵循 spec.md 字段规范）
 * @param {string} realNameData.school_name - 学校全称，如"南方科技大学"
 * @param {string} realNameData.student_name - 真实姓名，与学号一致
 * @param {string} realNameData.student_id - 学号，如"12010001"
 * @param {string} [realNameData.phone_or_email] - 备用联系方式，手机号或备用邮箱
 * @returns {Promise<Object>} - 返回注册结果对象
 */
async function signUpWithRealName(authData, realNameData) {
  try {
    // =====================================
    // 步骤 1: 验证输入数据完整性
    // =====================================
    if (!authData.email || !authData.password) {
      throw new Error('邮箱和密码不能为空');
    }

    // 严格检查 spec.md 定义的所有实名认证必填字段
    const requiredFields = ['school_name', 'student_name', 'student_id'];
    for (const field of requiredFields) {
      if (!realNameData[field]) {
        throw new Error(`实名认证字段 ${field} 不能为空`);
      }
    }

    // =====================================
    // 步骤 2: 调用 Supabase Auth 注册账号
    // =====================================
    console.log('[Auth] 开始注册 Supabase Auth 账号...');
    
    const { data: authResponse, error: authError } = await supabaseClient.auth.signUp({
      email: authData.email,
      password: authData.password
    });

    if (authError) {
      // 处理常见的 Auth 错误
      if (authError.message.includes('already registered')) {
        throw new Error('该邮箱已被注册，请直接登录');
      }
      if (authError.message.includes('password')) {
        throw new Error('密码强度不足，请使用至少6位密码');
      }
      throw new Error(`注册失败: ${authError.message}`);
    }

    if (!authResponse.user) {
      throw new Error('注册成功但未返回用户信息，请重试');
    }

    const userId = authResponse.user.id;
    console.log('[Auth] Supabase Auth 注册成功, User ID:', userId);

    // =====================================
    // 步骤 3: 将实名信息写入 users 表
    // =====================================
    console.log('[Auth] 开始写入实名信息到 users 表...');

    const { data: userData, error: userError } = await supabaseClient
      .from('users')
      .insert([
        {
          id: userId,                           // 与 Supabase Auth 的 UUID 对应
          email: authData.email,                // 登录邮箱
          school_name: realNameData.school_name,       // 学校全称
          student_name: realNameData.student_name,     // 真实姓名
          student_id: realNameData.student_id,         // 学号（UNIQUE）
          phone_or_email: realNameData.phone_or_email || null,  // 备用联系方式
          is_verified: false,                 // 初始未审核状态
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ])
      .select();

    if (userError) {
      // =====================================
      // 关键错误处理：捕获学号重复等唯一性冲突
      // =====================================
      
      // 23505 是 PostgreSQL 的唯一性冲突错误码
      if (userError.code === '23505') {
        const errorDetail = userError.details || userError.message || '';
        
        if (errorDetail.includes('student_id') || userError.message.includes('student_id')) {
          // 学号重复 - 友好弹窗提示
          window.alert('⚠️ 实名认证失败\n\n该学号已被注册，请确认：\n1. 你是否已经注册过账号？\n2. 学号是否输入正确？\n\n如需帮助，请联系管理员。');
          throw new Error('STUDENT_ID_DUPLICATE');
        }
        
        if (errorDetail.includes('email') || userError.message.includes('email')) {
          window.alert('⚠️ 该邮箱已被注册，请直接登录或使用其他邮箱。');
          throw new Error('EMAIL_DUPLICATE');
        }
      }

      // 其他数据库错误
      console.error('[Auth] 写入 users 表失败:', userError);
      window.alert('⚠️ 实名认证信息保存失败，请稍后重试。');
      throw new Error(`实名信息保存失败: ${userError.message}`);
    }

    console.log('[Auth] 实名信息写入成功:', userData);

    // =====================================
    // 步骤 4: 返回注册成功结果
    // =====================================
    return {
      success: true,
      userId: userId,
      email: authData.email,
      realNameInfo: {
        school_name: realNameData.school_name,
        student_name: realNameData.student_name,
        student_id: realNameData.student_id
      },
      message: '注册成功！请等待实名认证审核通过后即可发帖。',
      redirectTo: '/login.html'
    };

  } catch (error) {
    console.error('[Auth] signUpWithRealName 异常:', error);
    
    // 如果是已处理的特定错误类型，直接抛出
    if (error.message === 'STUDENT_ID_DUPLICATE' || 
        error.message === 'EMAIL_DUPLICATE') {
      throw error;
    }
    
    // 通用错误处理
    if (!window.alert.toString().includes('⚠️')) {
      window.alert('⚠️ 注册过程中发生错误，请检查网络连接后重试。');
    }
    
    throw error;
  }
}

/**
 * 用户登录函数（简化包装）
 * @param {string} email - 邮箱
 * @param {string} password - 密码
 * @returns {Promise<Object>} - 登录结果
 */
async function signInWithEmail(email, password) {
  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        throw new Error('邮箱或密码错误，请重试');
      }
      throw new Error(`登录失败: ${error.message}`);
    }

    return {
      success: true,
      user: data.user,
      session: data.session,
      message: '登录成功！'
    };
  } catch (error) {
    console.error('[Auth] 登录失败:', error);
    throw error;
  }
}

/**
 * 用户注销函数
 * @returns {Promise<Object>} - 注销结果
 */
async function signOut() {
  try {
    const { error } = await supabaseClient.auth.signOut();
    
    if (error) {
      throw new Error(`注销失败: ${error.message}`);
    }

    // 清除本地存储的任何缓存数据
    localStorage.removeItem('sb-session-cache');
    
    return {
      success: true,
      message: '已成功退出登录'
    };
  } catch (error) {
    console.error('[Auth] 注销失败:', error);
    throw error;
  }
}

/**
 * 获取当前会话信息
 * @returns {Promise<Object>} - 当前会话
 */
async function getCurrentSession() {
  try {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    
    if (error) {
      throw new Error(`获取会话失败: ${error.message}`);
    }

    return {
      success: true,
      session: session,
      isLoggedIn: !!session,
      userId: session?.user?.id || null
    };
  } catch (error) {
    console.error('[Auth] 获取会话失败:', error);
    return {
      success: false,
      session: null,
      isLoggedIn: false,
      userId: null,
      error: error.message
    };
  }
}

/**
 * 检查用户实名认证状态
 * @param {string} userId - 用户ID
 * @returns {Promise<Object>} - 认证状态
 */
async function checkVerificationStatus(userId) {
  try {
    const { data, error } = await supabaseClient
      .from('users')
      .select('is_verified, school_name, student_name, student_id')
      .eq('id', userId)
      .single();

    if (error) {
      throw new Error(`查询认证状态失败: ${error.message}`);
    }

    return {
      success: true,
      isVerified: data?.is_verified || false,
      realNameInfo: {
        school_name: data?.school_name,
        student_name: data?.student_name,
        student_id: data?.student_id
      }
    };
  } catch (error) {
    console.error('[Auth] 检查认证状态失败:', error);
    return {
      success: false,
      isVerified: false,
      error: error.message
    };
  }
}

// ============================================
// 导出模块（支持 ES Module 和 CommonJS）
// ============================================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    signUpWithRealName,
    signInWithEmail,
    signOut,
    getCurrentSession,
    checkVerificationStatus
  };
}