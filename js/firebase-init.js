let firebaseApp = null;

function initializeApp() {
  if (typeof firebase === 'undefined') {
    console.error('Firebase SDK не загружен. Проверьте подключение скриптов.');
    return;
  }
  console.log('Firebase загружен успешно.');

  if (!firebase.apps || firebase.apps.length === 0) {
    const firebaseConfig = {
      apiKey: "AIzaSyB3PAQQTpeTxlaeT7cIXqqspGDOcAkBQog",
      authDomain: "evabar-ac842.firebaseapp.com",
      databaseURL: "https://evabar-ac842-default-rtdb.europe-west1.firebasedatabase.app",
      projectId: "evabar-ac842",
      storageBucket: "evabar-ac842.firebasestorage.app",
      messagingSenderId: "938549088383",
      appId: "1:938549088383:web:9a6d241040520ccfef6f4a"
    };

    try {
      firebaseApp = firebase.initializeApp(firebaseConfig);
      console.log('Firebase инициализирован.');
    } catch (error) {
      console.error('Ошибка инициализации Firebase:', error);
      return;
    }
  } else {
    firebaseApp = firebase.app();
    console.log('Firebase уже инициализирован, используется существующее приложение.');
  }

  const auth = firebaseApp.auth();

  function loadNav() {
    const navElement = document.getElementById('nav');
    if (!navElement) {
      console.warn('Элемент с id="nav" не найден. Загрузка nav.html пропущена.');
      return;
    }
    navElement.innerHTML = `
      <nav>
        <div class="nav-container">
          <a href="/bar/menu.html">Меню</a>
          <a href="/bar/promocodes.html">Промокоды</a>
          <a href="/bar/dishes.html">Блюда</a>
          <a href="/bar/inventory.html">Инвентаризация</a>
          <a href="/bar/personal-report.html">Личная отчетность</a>
          <a href="/bar/general-report.html">Общая отчетность</a>
          <a href="/bar/employees.html">Сотрудники</a>
          <button onclick="logout()">Выход</button>
        </div>
      </nav>
    `;
    console.log('Навигация вставлена в DOM');
  }

  function login() {
    if (!firebaseApp) {
      alert('Firebase не инициализирован. Перезагрузите страницу.');
      return;
    }
    const email = document.getElementById('email')?.value;
    const password = document.getElementById('password')?.value;
    if (!email || !password) {
      alert('Ошибка входа: Введите email и пароль.');
      return;
    }
    auth.signInWithEmailAndPassword(email, password)
      .then(() => {
        window.location.href = '/bar/menu.html';
      })
      .catch((error) => {
        console.error('Ошибка входа:', error);
        alert('Ошибка входа: Неверный email или пароль.');
      });
  }

  function logout() {
    if (!firebaseApp) {
      alert('Firebase не инициализирован. Перезагрузите страницу.');
      return;
    }
    auth.signOut()
      .then(() => {
        window.location.href = '/bar/index.html';
      })
      .catch((error) => {
        console.error('Ошибка выхода:', error);
        alert('Ошибка выхода: ' + error.message);
      });
  }

  window.login = login;
  window.logout = logout;

  auth.onAuthStateChanged((user) => {
    console.log('Состояние авторизации:', user ? 'Авторизован' : 'Не авторизован');
    if (document.getElementById('nav')) loadNav();
    if (document.getElementById('dishes-list')) loadDishes();
    if (document.getElementById('categories-list')) loadCategoryList();
    if (document.getElementById('dish-category')) loadCategories();
    if (document.getElementById('inventory-list')) loadInventory();
    if (document.getElementById('ingredients-container')) loadIngredientsSelect();
  });
}

document.addEventListener('DOMContentLoaded', function() {
  if (typeof window.initializeAppDone === 'undefined') {
    initializeApp();
    window.initializeAppDone = true;
  }
});
