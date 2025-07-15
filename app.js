// Функция для проверки загрузки Firebase SDK
function initializeApp() {
  // Проверяем, что firebase определен
  if (typeof firebase === 'undefined') {
    console.error('Firebase SDK не загружен. Проверьте подключение скриптов.');
    return;
  }

  // Инициализация Firebase с вашим конфигом
  const firebaseConfig = {
    apiKey: "AIzaSyB3PAQQTpeTxlaeT7cIXqqspGDOcAkBQog",
    authDomain: "evabar-ac842.firebaseapp.com",
    databaseURL: "https://evabar-ac842-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "evabar-ac842",
    storageBucket: "evabar-ac842.firebasestorage.app",
    messagingSenderId: "938549088383",
    appId: "1:938549088383:web:9a6d241040520ccfef6f4a"
  };
  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();

  // Загрузка навигации
  async function loadNav() {
    try {
      const response = await fetch('nav.html');
      const navHtml = await response.text();
      document.getElementById('nav').innerHTML = navHtml;
    } catch (error) {
      console.error('Ошибка загрузки nav.html:', error);
    }
  }

  // Авторизация: вход пользователя
  async function login() {
    const email = document.getElementById('email')?.value;
    const password = document.getElementById('password')?.value;
    try {
      await auth.signInWithEmailAndPassword(email, password);
      window.location.href = 'menu.html';
    } catch (error) {
      alert('Ошибка входа: ' + error.message);
    }
  }

  // Выход из системы
  async function logout() {
    try {
      await auth.signOut();
      window.location.href = 'index.html';
    } catch (error) {
      console.error('Ошибка выхода:', error);
    }
  }

  // Загрузка меню: категории и блюда (только видимые категории)
  async function loadMenu() {
    if (!document.getElementById('categories')) return;
    try {
      const categories = await db.collection('categories').where('isVisible', '==', true).get();
      const dishes = await db.collection('dishes').get();
      const categoriesDiv = document.getElementById('categories');
      categoriesDiv.innerHTML = '';
      categories.forEach(cat => {
        const catDiv = document.createElement('div');
        catDiv.innerHTML = `<h2 class="text-xl">${cat.data().name}</h2>`;
        dishes.forEach(dish => {
          if (dish.data().category === cat.id) {
            catDiv.innerHTML += `
              <div class="border p-2">
                <p>${dish.data().name} - ${dish.data().price} $</p>
                <button onclick="addToOrder('${dish.id}', '${dish.data().name}', ${dish.data().price})" class="bg-blue-600 text-white p-1 rounded">Добавить</button>
              </div>`;
          }
        });
        categoriesDiv.appendChild(catDiv);
      });
    } catch (error) {
      console.error('Ошибка загрузки меню:', error);
    }
  }

  // Управление заказом
  let orderItems = [];
  function addToOrder(dishId, name, price) {
    orderItems.push({ dishId, name, price });
    renderOrder();
  }

  function renderOrder() {
    const orderList = document.getElementById('order-items');
    if (!orderList) return;
    orderList.innerHTML = '';
    orderItems.forEach(item => {
      orderList.innerHTML += `<li>${item.name} - ${item.price} $</li>`;
    });
  }

  // Оформление заказа
  async function placeOrder() {
    const comment = document.getElementById('order-comment')?.value;
    try {
      await db.collection('orders').add({
        items: orderItems,
        comment,
        user: auth.currentUser.uid,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
      // Списание ингредиентов
      for (const item of orderItems) {
        const dish = await db.collection('dishes').doc(item.dishId).get();
        const ingredients = dish.data().ingredients || [];
        for (const ing of ingredients) {
          const ingredientRef = db.collection('ingredients').doc(ing.id);
          const ingredient = await ingredientRef.get();
          await ingredientRef.update({
            quantity: ingredient.data().quantity - ing.quantity
          });
        }
      }
      orderItems = [];
      renderOrder();
      alert('Заказ оформлен!');
    } catch (error) {
      console.error('Ошибка оформления заказа:', error);
      alert('Ошибка при оформлении заказа: ' + error.message);
    }
  }

  // Управление промокодами
  async function addPromocode() {
    const code = document.getElementById('promo-code')?.value;
    const discount = parseInt(document.getElementById('promo-discount')?.value);
    try {
      await db.collection('promocodes').add({ code, discount });
      loadPromocodes();
    } catch (error) {
      console.error('Ошибка добавления промокода:', error);
    }
  }

  async function loadPromocodes() {
    if (!document.getElementById('promocodes-list')) return;
    try {
      const promocodes = await db.collection('promocodes').get();
      const list = document.getElementById('promocodes-list');
      list.innerHTML = '';
      promocodes.forEach(promo => {
        list.innerHTML += `<li>${promo.data().code} - ${promo.data().discount}%</li>`;
      });
    } catch (error) {
      console.error('Ошибка загрузки промокодов:', error);
    }
  }

  // Управление блюдами и категориями
  async function addDish() {
    const name = document.getElementById('dish-name')?.value;
    const price = parseInt(document.getElementById('dish-price')?.value);
    const category = document.getElementById('dish-category')?.value;
    try {
      await db.collection('dishes').add({ name, price, category });
      loadDishes();
    } catch (error) {
      console.error('Ошибка добавления блюда:', error);
    }
  }

  async function addCategory() {
    const name = document.getElementById('category-name')?.value;
    const isVisible = document.getElementById('category-visible')?.checked;
    try {
      await db.collection('categories').add({ name, isVisible });
      loadCategories();
      loadCategoryList();
    } catch (error) {
      console.error('Ошибка добавления категории:', error);
    }
  }

  async function loadCategories() {
    if (!document.getElementById('dish-category')) return;
    try {
      const categories = await db.collection('categories').get();
      const select = document.getElementById('dish-category');
      select.innerHTML = '';
      categories.forEach(cat => {
        select.innerHTML += `<option value="${cat.id}">${cat.data().name}</option>`;
      });
    } catch (error) {
      console.error('Ошибка загрузки категорий:', error);
    }
  }

  async function loadCategoryList() {
    if (!document.getElementById('categories-list')) return;
    try {
      const categories = await db.collection('categories').get();
      const list = document.getElementById('categories-list');
      list.innerHTML = '';
      categories.forEach(cat => {
        list.innerHTML += `
          <li>
            ${cat.data().name} (Видимость: ${cat.data().isVisible ? 'Вкл' : 'Выкл'})
            <button onclick="toggleCategoryVisibility('${cat.id}', ${!cat.data().isVisible})" class="bg-blue-600 text-white p-1 rounded ml-2">
              ${cat.data().isVisible ? 'Скрыть' : 'Показать'}
            </button>
          </li>`;
      });
    } catch (error) {
      console.error('Ошибка загрузки списка категорий:', error);
    }
  }

  async function toggleCategoryVisibility(categoryId, isVisible) {
    try {
      await db.collection('categories').doc(categoryId).update({ isVisible });
      loadCategoryList();
    } catch (error) {
      console.error('Ошибка изменения видимости категории:', error);
    }
  }

  async function loadDishes() {
    if (!document.getElementById('dishes-list')) return;
    try {
      const dishes = await db.collection('dishes').get();
      const list = document.getElementById('dishes-list');
      list.innerHTML = '';
      dishes.forEach(dish => {
        list.innerHTML += `<li>${dish.data().name} - ${dish.data().price} $ (${dish.data().category})</li>`;
      });
    } catch (error) {
      console.error('Ошибка загрузки блюд:', error);
    }
  }

  // Инвентаризация
  async function addIngredient() {
    const name = document.getElementById('ingredient-name')?.value;
    const quantity = parseInt(document.getElementById('ingredient-quantity')?.value);
    const price = parseInt(document.getElementById('ingredient-price')?.value);
    try {
      await db.collection('ingredients').add({ name, quantity, price });
      loadInventory();
    } catch (error) {
      console.error('Ошибка добавления ингредиента:', error);
    }
  }

  async function loadInventory() {
    if (!document.getElementById('inventory-list')) return;
    try {
      const ingredients = await db.collection('ingredients').get();
      const list = document.getElementById('inventory-list');
      list.innerHTML = '';
      ingredients.forEach(ing => {
        list.innerHTML += `<li>${ing.data().name} - ${ing.data().quantity} (Цена: ${ing.data().price} $)</li>`;
      });
    } catch (error) {
      console.error('Ошибка загрузки инвентаря:', error);
    }
  }

  // Заказ ингредиентов
  async function loadOrderIngredients() {
    if (!document.getElementById('order-ingredients-list')) return;
    try {
      const ingredients = await db.collection('ingredients').get();
      const list = document.getElementById('order-ingredients-list');
      list.innerHTML = '';
      ingredients.forEach(ing => {
        if (ing.data().quantity < 10) {
          list.innerHTML += `<li>${ing.data().name} - Нужно: ${10 - ing.data().quantity}</li>`;
        }
      });
    } catch (error) {
      console.error('Ошибка загрузки заказа ингредиентов:', error);
    }
  }

  async function placeIngredientOrder() {
    alert('Заказ ингредиентов оформлен!');
  }

  // Отчетность
  async function loadPersonalReport() {
    if (!document.getElementById('personal-report-list')) return;
    try {
      const orders = await db.collection('orders').where('user', '==', auth.currentUser.uid).get();
      const list = document.getElementById('personal-report-list');
      list.innerHTML = '';
      orders.forEach(order => {
        list.innerHTML += `<li>Заказ: ${order.data().items.map(item => item.name).join(', ')}</li>`;
      });
    } catch (error) {
      console.error('Ошибка загрузки личной отчетности:', error);
    }
  }

  async function generateGeneralReport() {
    if (!document.getElementById('general-report-list')) return;
    try {
      const start = new Date(document.getElementById('report-start')?.value);
      const end = new Date(document.getElementById('report-end')?.value);
      const orders = await db.collection('orders').where('timestamp', '>=', start).where('timestamp', '<=', end).get();
      const list = document.getElementById('general-report-list');
      list.innerHTML = '';
      orders.forEach(order => {
        list.innerHTML += `<li>Заказ: ${order.data().items.map(item => item.name).join(', ')}</li>`;
      });
    } catch (error) {
      console.error('Ошибка генерации общей отчетности:', error);
    }
  }

  // Сотрудники
  async function addEmployee() {
    const name = document.getElementById('employee-name')?.value;
    const phone = document.getElementById('employee-phone')?.value;
    try {
      await db.collection('employees').add({ name, phone });
      loadEmployees();
    } catch (error) {
      console.error('Ошибка добавления сотрудника:', error);
    }
  }

  async function loadEmployees() {
    if (!document.getElementById('employees-list')) return;
    try {
      const employees = await db.collection('employees').get();
      const list = document.getElementById('employees-list');
      list.innerHTML = '';
      employees.forEach(emp => {
        list.innerHTML += `<li>${emp.data().name} - ${emp.data().phone}</li>`;
      });
    } catch (error) {
      console.error('Ошибка загрузки сотрудников:', error);
    }
  }

  // Доставка
  async function loadDeliveryMenu() {
    if (!document.getElementById('delivery-menu')) return;
    try {
      const categories = await db.collection('categories').where('isVisible', '==', true).get();
      const dishes = await db.collection('dishes').get();
      const deliveryMenu = document.getElementById('delivery-menu');
      deliveryMenu.innerHTML = '';
      categories.forEach(cat => {
        const catDiv = document.createElement('div');
        catDiv.innerHTML = `<h2 class="text-xl">${cat.data().name}</h2>`;
        dishes.forEach(dish => {
          if (dish.data().category === cat.id) {
            catDiv.innerHTML += `
              <div class="border p-2">
                <p>${dish.data().name} - ${dish.data().price} $</p>
                <button onclick="addToDeliveryOrder('${dish.id}', '${dish.data().name}', ${dish.data().price})" class="bg-blue-600 text-white p-1 rounded">Добавить</button>
              </div>`;
          }
        });
        deliveryMenu.appendChild(catDiv);
      });
    } catch (error) {
      console.error('Ошибка загрузки меню доставки:', error);
    }
  }

  let deliveryOrderItems = [];
  function addToDeliveryOrder(dishId, name, price) {
    deliveryOrderItems.push({ dishId, name, price });
    renderDeliveryOrder();
  }

  function renderDeliveryOrder() {
    const orderList = document.getElementById('delivery-order-items');
    if (!orderList) return;
    orderList.innerHTML = '';
    deliveryOrderItems.forEach(item => {
      orderList.innerHTML += `<li>${item.name} - ${item.price} $</li>`;
    });
  }

  async function placeDeliveryOrder() {
    const address = document.getElementById('delivery-address')?.value;
    const comment = document.getElementById('delivery-comment')?.value;
    try {
      await db.collection('delivery-orders').add({
        items: deliveryOrderItems,
        address,
        comment,
        user: auth.currentUser.uid,
        status: 'pending',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
      deliveryOrderItems = [];
      renderDeliveryOrder();
      alert('Заказ доставки оформлен!');
    } catch (error) {
      console.error('Ошибка оформления заказа доставки:', error);
      alert('Ошибка при оформлении заказа доставки: ' + error.message);
    }
  }

  async function loadDeliveryOrders() {
    if (!document.getElementById('delivery-orders-list')) return;
    try {
      const orders = await db.collection('delivery-orders').get();
      const list = document.getElementById('delivery-orders-list');
      list.innerHTML = '';
      orders.forEach(order => {
        list.innerHTML += `
          <li>
            Заказ: ${order.data().items.map(item => item.name).join(', ')}<br>
            Адрес: ${order.data().address}<br>
            Статус: ${order.data().status}
            <button onclick="updateDeliveryStatus('${order.id}', 'confirmed')" class="bg-green-600 text-white p-1 rounded ml-2">Подтвердить</button>
            <button onclick="updateDeliveryStatus('${order.id}', 'cancelled')" class="bg-red-600 text-white p-1 rounded ml-2">Отменить</button>
          </li>`;
      });
    } catch (error) {
      console.error('Ошибка загрузки заказов доставки:', error);
    }
  }

  async function updateDeliveryStatus(orderId, status) {
    try {
      await db.collection('delivery-orders').doc(orderId).update({ status });
      loadDeliveryOrders();
    } catch (error) {
      console.error('Ошибка обновления статуса доставки:', error);
    }
  }

  // Инициализация при загрузке страницы
  auth.onAuthStateChanged(user => {
    loadNav().then(() => {
      if (user) {
        document.getElementById('nav-login')?.classList.add('hidden');
        document.querySelectorAll('#nav a:not(#nav-login), #logout').forEach(el => el.classList.remove('hidden'));
        loadMenu();
        loadPromocodes();
        loadDishes();
        loadCategories();
        loadCategoryList();
        loadInventory();
        loadOrderIngredients();
        loadPersonalReport();
        loadEmployees();
        loadDeliveryMenu();
        loadDeliveryOrders();
      } else {
        document.getElementById('nav-login')?.classList.remove('hidden');
        document.querySelectorAll('#nav a:not(#nav-login), #logout').forEach(el => el.classList.add('hidden'));
        if (window.location.pathname !== '/index.html') {
          window.location.href = 'index.html';
        }
      }
    });
  });
}

// Проверяем, загружен ли Firebase SDK, перед запуском приложения
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

// Экспортируем функции для глобального доступа
window.login = login;
window.logout = logout;
window.addToOrder = addToOrder;
window.placeOrder = placeOrder;
window.addPromocode = addPromocode;
window.addDish = addDish;
window.addCategory = addCategory;
window.toggleCategoryVisibility = toggleCategoryVisibility;
window.addIngredient = addIngredient;
window.placeIngredientOrder = placeIngredientOrder;
window.addEmployee = addEmployee;
window.addToDeliveryOrder = addToDeliveryOrder;
window.placeDeliveryOrder = placeDeliveryOrder;
window.updateDeliveryStatus = updateDeliveryStatus;
window.generateGeneralReport = generateGeneralReport;
