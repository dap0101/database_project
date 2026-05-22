/**
 * ============================================
 * guard.js - 会话越权硬核拦截器
 * ============================================
 * 
 * 功能：所有内部页面加载时最先执行，拦截未授权访问
 * 特性：
 *   - DOM 加载瞬间立即执行会话检查
 *   - 严格的越权拦截逻辑
 *   - 强制重定向至 login.html
 * 
 * 规范：严格遵循 spec.md 第 3.1 节"会话安全守护与越权拦截机制"
 */

(function() {
  'use strict';

  // ============================================
  // 配置常量（与 spec.md 保持一致）
  // ============================================
  const CONFIG = {
    // 登录页面路径
    LOGIN_PAGE: 'login.html',
    // 首页路径（可选跳转目标）
    INDEX_PAGE: 'index.html',
    // 免拦截的公开页面列表
    PUBLIC_PAGES: [
      'login.html',
      'register.html'     
    ]
  };

  // ============================================
  // 工具函数
  // ============================================

  /**
   * 获取当前页面文件名
   * @returns {string} 当前页面文件名，如 "post.html"
   */
  function getCurrentPage() {
    const path = window.location.pathname;
    const filename = path.substring(path.lastIndexOf('/') + 1);
    return filename || 'index.html';
  }

  /**
   * 检查当前页面是否在免拦截列表中
   * @returns {boolean} 是否免拦截
   */
  function isPublicPage() {
    const currentPage = getCurrentPage().toLowerCase();
    return CONFIG.PUBLIC_PAGES.some(page => 
      currentPage === page.toLowerCase() ||
      currentPage.endsWith('/' + page.toLowerCase())
    );
  }

  /**
   * 执行强制重定向到登录页
   * @param {string} [reason] - 重定向原因，用于日志
   */
  function redirectToLogin(reason = '未授权访问') {
    console.warn(`[Guard] 安全拦截: ${reason}，重定向至 ${CONFIG.LOGIN_PAGE}`);
    
    // 记录用户试图访问的目标路径（可选：支持登录后跳转回来）
    try {
      const attemptedUrl = window.location.href;
      sessionStorage.setItem('guard_redirect_after_login', attemptedUrl);
    } catch (e) {
      // 忽略存储异常
    }
    
    // 强制重定向至登录页
    window.location.href = CONFIG.LOGIN_PAGE;
  }

  /**
   * 显示安全警报并执行重定向
   * @param {string} message - 警报消息
   */
  function showSecurityAlert(message) {
    // 使用 window.alert 强制中断用户操作
    window.alert(message);
    // alert 关闭后立即重定向
    redirectToLogin('安全验证失败');
  }

  // ============================================
  // 核心拦截逻辑
  // ============================================

  /**
   * 主守卫函数 - 执行会话验证和越权拦截
   * 这是页面加载时最先执行的核心安全逻辑
   */
  async function executeSecurityGuard() {
    console.log('[Guard] 安全守卫启动，正在验证会话...');

    // 步骤 1: 检查当前页面是否在免拦截列表
    if (isPublicPage()) {
      console.log('[Guard] 当前页面为公开页面，跳过拦截:', getCurrentPage());
      return;
    }

    console.log('[Guard] 当前页面需要认证:', getCurrentPage());

    // 步骤 2: 检查 Supabase 客户端是否可用
    if (typeof window.supabaseClient === 'undefined') {
      console.error('[Guard] 错误: supabaseClient 未定义');
      showSecurityAlert('安全警报：系统初始化失败，请刷新页面重试！');
      return;
    }

    // 步骤 3: 获取当前会话状态
    let session = null;
    try {
      console.log('[Guard] 正在获取当前会话...');
      const { data: { session: currentSession }, error: sessionError } = 
        await window.supabaseClient.auth.getSession();
  

      if (sessionError) {
        throw new Error(`获取会话失败: ${sessionError.message}`);
      }

      session = currentSession;
      console.log('[Guard] 会话状态:', session ? '已登录' : '未登录');

    } catch (error) {
      console.error('[Guard] 会话获取异常:', error);
      showSecurityAlert('安全警报：会话验证失败，请重新登录！');
      return;
    }

    // 步骤 4: 安全越权拦截逻辑
    if (!session) {
      // ============================================
      // 【核心拦截场景 B】恶意越权拦截
      // 未登录或会话已失效，尝试访问内部页面
      // ============================================
      console.warn('[Guard] 拦截未授权访问:', window.location.href);
      
      // 强制弹窗警告（spec.md 要求的精确提示语）
      window.alert('安全警报：请先进行校内实名登录！');
      
      // 强制重定向至登录页
      redirectToLogin('会话为空（未登录）');
      return;
    }

    // 步骤 5: 验证会话有效性（可选：检查 token 是否过期）
    try {
      const expiresAt = session.expires_at;
      if (expiresAt && new Date(expiresAt * 1000) < new Date()) {
        console.warn('[Guard] 会话已过期');
        window.alert('安全警报：登录会话已过期，请重新登录！');
        redirectToLogin('会话已过期');
        return;
      }
    } catch (e) {
      // 忽略过期时间检查失败
    }

    // 步骤 6: 用户已登录且会话有效，允许访问
    console.log('[Guard] 验证通过，用户 ID:', session.user.id);
    console.log('[Guard] 允许访问页面:', getCurrentPage());
    
    // 可选：将用户信息附加到 window，供页面使用
    window.__currentUser = session.user;
    
    return;
  }

  // ============================================
  // 立即执行守卫（页面加载时最先执行）
  // ============================================
  
  // 方式 1: DOM 加载瞬间立即执行
  if (document.readyState === 'loading') {
    // DOM 还在加载中，添加事件监听器
    document.addEventListener('DOMContentLoaded', function() {
      executeSecurityGuard();
    });
  } else {
    // DOM 已经加载完成，立即执行
    executeSecurityGuard();
  }

  // 方式 2: 同时也在 window.onload 时再检查一次（双重保险）
  window.addEventListener('load', function() {
    // 可选：再次验证会话状态
    console.log('[Guard] 页面完全加载，守卫状态正常');
  });

  // ============================================
  // 暴露全局 API（供其他脚本调用）
  // ============================================
  window.SecurityGuard = {
    // 手动触发守卫检查
    check: executeSecurityGuard,
    // 获取当前会话
   getSession: async function() {
      if (typeof window.supabaseClient === 'undefined') return null;
      const { data: { session } } = await window.supabaseClient.auth.getSession();
      return session;
    },
   
    // 检查是否已登录
    isLoggedIn: async function() {
      const session = await this.getSession();
      return !!session;
    },
    // 重定向到登录页
    redirectToLogin: function() {
      redirectToLogin('手动触发');
    }
  };

  console.log('[Guard] 安全守卫模块已加载');

})();