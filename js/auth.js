async function checkAuth(requiredRole = 'user') {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = 'login.html?redirect=' + encodeURIComponent(location.pathname);
    return null;
  }
  const role = session.user.user_metadata?.role || 'user';
  if (requiredRole === 'admin' && role !== 'admin') {
    window.location.href = 'index.html';
    return null;
  }
  const bar = document.getElementById('user-bar');
  if (bar) {
    const emailEl = document.getElementById('user-email');
    if (emailEl) emailEl.textContent = session.user.email;
    bar.style.display = 'flex';
  }
  return session;
}

async function getUserRole() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  return session.user.user_metadata?.role || 'user';
}

async function isAdmin() {
  return (await getUserRole()) === 'admin';
}

async function logout() {
  await supabase.auth.signOut();
  window.location.href = 'login.html';
}
