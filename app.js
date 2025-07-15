// Инициализация Firebase
const firebaseConfig = {
  // Замените на ваш конфиг Firebase
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Загрузка навигации
async function loadNav() {
  const response = await fetch('nav.html');
  const navHtml = await response.text();
  document.getElementById('nav').innerHTML = navHtml;
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
  await auth.signOut();
  window.location.href = 'index.html';
}

// Загрузка меню: категории и блюда (только видимые категории)
async function loadMenu() {
  if (!document.getElementById('categories')) return;
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
}

// Управление промокодами
async function addPromocode() {
  const code = document.getElementById('promo-code')?.value;
  const discount = parseInt(document.getElementById('promo-discount')?.value);
  await db.collection('promocodes').add({ code, discount });
  loadPromocodes();
}

async function loadPromocodes() {
  if (!document.getElementById('promocodes-list')) return;
  const promocodes = await db.collection('promocodes').get();
  const list = document.getElementById('promocodes-list');
  list.innerHTML = '';
  promocodes.forEach(promo => {
    list.innerHTML += `<li>${promo.data().code} - ${promo.data().discount}%</li>`;
  });
}

// Управление блюдами и категориями
async function addDish() {
  const name = document.getElementById('dish-name')?.value;
  const price = parseInt(document.getElementById('dish-price')?.value);
  const category = document.getElementById('dish-category')?.value;
  await db.collection('dishes').add({ name, price, category });
  loadDishes();
}

async function addCategory() {
  const name = document.getElementById('category-name')?.value;
  const isVisible = document.getElementById('category-visible')?.checked;
  await db.collection('categories').add({ name, isVisible });
  loadCategories();
  loadCategoryList();
}

async function loadCategories() {
  if (!document.getElementById('dish-category')) return;
  const categories = await db.collection('categories').get();
  const select = document.getElementById('dish-category');
  select.innerHTML = '';
  categories.forEach(cat => {
    select.innerHTML += `<option value="${cat.id}">${cat.data().name}</option>`;
  });
}

async function loadCategoryList() {
  if (!document.getElementById('categories-list')) return;
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
}

async function toggleCategoryVisibility(categoryId, isVisible) {
  await db.collection('categories').doc(categoryId).update({ isVisible });
  loadCategoryList();
}

async function loadDishes() {
  if (!document.getElementById('dishes-list')) return;
  const dishes = await db.collection('dishes').get();
  const list = document.getElementById('dishes-list');
  list.innerHTML = '';
  dishes.forEach(dish => {
    list.innerHTML += `<li>${dish.data().name} - ${dish.data().price} $ (${dish.data().category})</li>`;
  });
}

// Инвентаризация
async function addIngredient() {
  const name = document.getElementById('ingredient-name')?.value;
  const quantity = parseInt(document.getElementById('ingredient-quantity')?.value);
  const price = parseInt(document.getElementById('ingredient-price')?.value);
  await db.collection('ingredients').add({ name, quantity, price });
  loadInventory();
}

async function loadInventory() {
  if (!document.getElementById('inventory-list')) return;
  const ingredients = await db.collection('ingredients').get();
  const list = document.getElementById('inventory-list');
  list.innerHTML = '';
  ingredients.forEach(ing => {
    list.innerHTML += `<li>${ing.data().name} - ${ing.data().quantity} (Цена: ${ing.data().price} $)</li>`;
  });
}

// Заказ ингредиентов
async function loadOrderIngredients() {
  if (!document.getElementById('order-ingredients-list')) return;
  const ingredients = await db.collection('ingredients').get();
  const list = document.getElementById('order-ingredients-list');
  list.innerHTML = '';
  ingredients.forEach(ing => {
    if (ing.data().quantity < 10) {
      list.innerHTML += `<li>${ing.data().name} - Нужно: ${10 - ing.data().quantity}</li>`;
    }
  });
}

async function placeIngredientOrder() {
  alert('Заказ ингредиентов оформлен!');
}

// Отчетность
async function loadPersonalReport() {
  if (!document.getElementById('personal-report-list')) return;
  const orders = await db.collection('orders').where('user', '==', auth.currentUser.uid).get();
  const list = document.getElementById('personal-report-list');
  list.innerHTML = '';
  orders.forEach(order => {
    list.innerHTML += `<li>Заказ: ${order.data().items.map(item => item.name).join(', ')}</li>`;
  });
}

async function generateGeneralReport() {
  if (!document.getElementById('general-report-list')) return;
  const start = new Date(document.getElementById('report-start')?.value);
  const end = new Date(document.getElementById('report-end')?.value);
  const orders = await db.collection('orders').where('timestamp', '>=', start).where('timestamp', '<=', end).get();
  const list = document.getElementById('general-report-list');
  list.innerHTML = '';
  orders.forEach(order => {
    list.innerHTML += `<li>Заказ: ${order.data().items.map(item => item.name).join(', ')}</li>`;
  });
}

// Сотрудники
async function addEmployee() {
  const name = document.getElementById('employee-name')?.value;
  const phone = document.getElementById('employee-phone')?.value;
  await db.collection('employees').add({ name, phone });
  loadEmployees();
}

async function loadEmployees() {
  if (!document.getElementById('employees-list')) return;
  const employees = await db.collection('employees').get();
  const list = document.getElementById('employees-list');
  list.innerHTML = '';
  employees.forEach(emp => {
    list.innerHTML += `<li>${emp.data().name} - ${emp.data().phone}</li>`;
  });
}

// Доставка
async function loadDeliveryMenu() {
  if (!document.getElementById('delivery-menu')) return;
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
}

async function loadDeliveryOrders() {
  if (!document.getElementById('delivery-orders-list')) return;
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
}

async function updateDeliveryStatus(orderId, status) {
  await db.collection('delivery-orders').doc(orderId).update({ status });
  loadDeliveryOrders();
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
