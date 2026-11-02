/**
 * EngVerse - Admin Route Guard Middleware
 * Protects /admin routes against unauthenticated client navigation.
 */

export default defineNuxtRouteMiddleware((to) => {
  const adminCookie = useCookie<string | null>('engverse_admin_token');
  const hasToken = Boolean(adminCookie.value && adminCookie.value.trim().length > 0);

  // If already logged in and visiting login page, redirect to dashboard
  if (to.path === '/admin/login') {
    if (hasToken) {
      return navigateTo('/admin');
    }
    return;
  }

  // Guard all /admin routes
  if (to.path.startsWith('/admin')) {
    if (!hasToken) {
      return navigateTo({
        path: '/admin/login',
        query: { redirect: to.fullPath },
      });
    }
  }
});

