async function loadNav() {
  const navElement = document.getElementById('nav');
  if (!navElement) {
    console.warn('Элемент с id="nav" не найден. Загрузка nav.html пропущена.');
    return;
  }
  try {
    const response = await fetch('nav.html');
    const navHtml = await response.text();
    navElement.innerHTML = navHtml;
  } catch (error) {
    console.error('Ошибка загрузки nav.html:', error);
  }
}

async function login() {
  const email = document.getElementById('email')?.value;
  const password = document.getElementById('password')?.value;
  if (!email || !password) {
    alert('Ошибка входа: Введите email и пароль.');
    return;
  }
  try {
    await firebase.auth().signInWithEmailAndPassword(email, password);
    window.location.href = 'menu.html';
  } catch (error) {
    console.error('Ошибка входа:', error);
    alert('Ошибка входа: Неверный email или пароль.');
  }
}

async function logout() {
  try {
    await firebase.auth().signOut();
    window.location.href = 'index.html';
  } catch (error) {
    console.error('Ошибка выхода:', error);
    alert('Ошибка выхода: ' + error.message);
  }
}
